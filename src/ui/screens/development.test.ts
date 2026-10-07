import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEV_NODES } from '../../content/dev-tree';
import { createInitialState } from '../../sim/department';
import { DEVELOP_HANDLERS } from '../../sim/develop';
import { nodeOptions } from '../../sim/department-selectors';
import { DevelopmentDetail, DevelopmentTile, DevelopScreen, filterDevelopmentOptions, layoutBranch, tileColumns, tileState } from './Develop';

const NOW = Date.UTC(2026, 9, 3, 12);
const state = createInitialState(NOW, 1);
state.department.devPoints = 100;
state.department.funding = 100_000;
vi.mock('../store', () => ({ useGame: () => state, useDevelopmentBudget: () => ({ totalDP: state.department.devPoints }), unlockDevelopment: vi.fn() }));
vi.mock('../components/toast', () => ({ useToast: () => ({ notify: vi.fn() }) }));
vi.mock('../components/PointPacks', () => ({ PointPacks: () => null }));
vi.mock('../components/Sheet', () => ({ Sheet: ({ open, title, children, footer }: { open: boolean; title: string; children: ReactNode; footer?: ReactNode }) => open ? createElement('section', { role: 'dialog', 'aria-label': title }, children, footer) : null }));
function option(nodeId: string, tier = 0) {
  const sample = structuredClone(state);
  for (let target = 1; target <= tier; target++) expect(DEVELOP_HANDLERS.unlockNode(sample, nodeId, target)).toEqual({ ok: true });
  return nodeOptions(sample).find((candidate) => candidate.node.id === nodeId)!;
}
function detail(nodeId: string, tier = 0, patch = {}) {
  return renderToStaticMarkup(createElement(DevelopmentDetail, { option: option(nodeId, tier), onClose: () => {}, pending: false, failure: null, purchasedTier: null, onPurchase: () => {}, ...patch }));
}

describe('development browsing and shared detail', () => {
  it('renders compact stats, branch tabs with progress, a ready rail and one tile per development', () => {
    const html = renderToStaticMarkup(createElement(DevelopScreen, { highlightedNode: 'personnel_academy', highlightRequest: 2 }));
    expect(html).toContain('aria-label="100 development points"');
    expect(html).toContain('Get Points');
    expect(html).toContain('aria-label="Development branches"');
    expect(html).not.toContain('aria-label="Development ownership"');
    expect(html).toContain('aria-label="Staff, 0 of 6 owned"');
    expect(html).toContain('Ready to buy');
    expect(html).toContain('Expanded barracks');
    expect(html).toMatch(/data-development-node="personnel_academy"[^>]*class="dev-tile store-node-highlight"/);
    expect((html.match(/data-development-node=/g) ?? [])).toHaveLength(Object.keys(DEV_NODES).length);
    expect(html).not.toMatch(/earned \+|test DP|department level/i);
  });

  it('feeds the ready rail with genuinely affordable developments, scoped by branch', () => {
    const sample = structuredClone(state);
    DEVELOP_HANDLERS.unlockNode(sample, 'personnel_academy', 1);
    DEVELOP_HANDLERS.unlockNode(sample, 'intel_records', 1);
    sample.department.devPoints = 3;
    sample.department.funding = 3000;
    const options = nodeOptions(sample);
    expect(filterDevelopmentOptions(options, 'all', 'owned').map((entry) => entry.node.id)).toEqual(['personnel_academy', 'intel_records']);
    const available = filterDevelopmentOptions(options, 'all', 'available').map((entry) => entry.node.id);
    expect(available).toContain('intel_records');
    expect(available).not.toContain('personnel_academy');
    expect(available).not.toContain('intel_drone');
    expect(filterDevelopmentOptions(options, 'personnel', 'owned').map((entry) => entry.node.id)).toEqual(['personnel_academy']);
    expect(filterDevelopmentOptions(options, 'wellbeing', 'owned')).toEqual([]);
  });

  it('fits three tile columns at 320 and four at 390', () => {
    expect(tileColumns(288)).toBe(3);
    expect(tileColumns(358)).toBe(4);
  });

  it('lays each branch out as a tree: chains left to right, a second child under its parent, no overlaps', () => {
    for (const columns of [3, 4]) {
      for (const branch of ['personnel', 'field', 'intel', 'logistics', 'wellbeing'] as const) {
        const nodes = nodeOptions(state).filter((entry) => entry.node.branch === branch);
        const cells = layoutBranch(nodes, columns);
        expect(cells).toHaveLength(nodes.length);
        expect(new Set(cells.map((cell) => `${cell.row}:${cell.col}`)).size).toBe(cells.length);
        expect(cells.every((cell) => cell.col >= 0 && cell.col < columns)).toBe(true);
        expect(Math.max(...cells.map((cell) => cell.row)) + 1).toBeLessThanOrEqual(2);
        // Every development whose prerequisite is in the branch is drawn connected to it.
        for (const cell of cells) if (cell.option.node.requires.some((id) => nodes.some((entry) => entry.node.id === id))) expect(cell.link).not.toBeNull();
      }
      const field = layoutBranch(nodeOptions(state).filter((entry) => entry.node.branch === 'field'), columns);
      const at = (id: string) => field.find((cell) => cell.option.node.id === id)!;
      expect([at('field_response_program').row, at('field_response_program').col]).toEqual([at('field_entry_course').row, at('field_entry_course').col + 1]);
      expect(at('field_specialist_response').link).toBe('left');
      expect(at('field_controlled_access')).toMatchObject({ row: at('field_entry_course').row + 1, col: at('field_entry_course').col, link: 'up' });
    }
  });

  it('shows state, tier pips and cost on a tile, with the full story in its label', () => {
    const budget = { dp: 100, funding: 100_000 };
    const tiered = renderToStaticMarkup(createElement(DevelopmentTile, { option: option('personnel_academy', 1), budget, highlighted: false, onOpen: () => {} }));
    expect(tiered).toContain('data-state="ready"');
    expect(tiered).toContain('Training academy. Ready to buy. Tier 1 of 3. Next costs 4 DP and $4,000');
    expect((tiered.match(/<i[ >]/g) ?? [])).toHaveLength(3);
    expect(tiered).toContain('<i data-on="yes"></i><i></i><i></i>');
    expect((tiered.match(/<button/g) ?? [])).toHaveLength(1);
    const locked = renderToStaticMarkup(createElement(DevelopmentTile, { option: option('intel_drone'), link: 'left', budget, highlighted: false, onOpen: () => {} }));
    expect(locked).toContain('data-state="locked"');
    expect(locked).toContain('data-link="left"');
    expect(locked).toContain('Locked, needs Thermal imaging');
    const broke = structuredClone(state);
    broke.department.funding = 0;
    const short = renderToStaticMarkup(createElement(DevelopmentTile, { option: nodeOptions(broke).find((entry) => entry.node.id === 'personnel_academy')!, budget: { dp: 100, funding: 0 }, highlighted: false, onOpen: () => {} }));
    expect(short).toContain('Needs more funding');
    expect(short).toMatch(/<span data-short="yes">\$2,500<\/span>/);
    const owned = option('personnel_negotiation', 1);
    expect(tileState(owned)).toBe('owned');
    expect(renderToStaticMarkup(createElement(DevelopmentTile, { option: owned, budget, highlighted: false, onOpen: () => {} }))).toContain('Negotiation training. Owned');
  });

  it('shows the baseline and the entire ladder, prerequisites, unlocks and contextual links', () => {
    const academy = detail('personnel_academy');
    expect(academy).toContain('role="dialog" aria-label="Training academy"');
    expect(academy).toContain('1 total training slot');
    expect(academy).toContain('2 total training slots');
    for (const line of ['3 DP · $2,500', '4 DP · $4,000', '6 DP · $6,500', 'Tier ladder', 'Current', 'Open Training', 'Upgrade to tier I']) expect(academy).toContain(line);
    expect(academy).not.toContain('Needs first');
    expect(academy).not.toContain('Open Gear');
    const manager = detail('logistics_equipment_manager');
    for (const line of ['Standard repair prices', '25% cheaper repairs', '35% cheaper repairs', '45% cheaper repairs', '4 automatic service jobs', 'Open Gear']) expect(manager).toContain(line);
    const drone = detail('intel_drone');
    expect(drone).toContain('Needs first');
    expect(drone).toMatch(/Thermal imaging<span class="sr-only"> · Required<\/span>/);
    expect(drone).toContain('Unlocks');
    expect(drone).toContain('Camera drone');
    expect(drone).toContain('Open Training');
    expect(drone).toContain('Open Gear');
    expect(drone).toContain('disabled=""');
    expect((drone.match(/btn-primary/g) ?? [])).toHaveLength(1);
  });

  it('keeps the sheet useful after purchase with the changed current and next tiers', () => {
    const html = detail('intel_records', 2, { purchasedTier: 2 });
    expect(html).toContain('Tier II purchased');
    expect(html).toContain('+$120/h funding');
    expect(html).toContain('+$200/h funding');
    expect(html).toMatch(/data-state="current" aria-current="step"><span class="dev-ladder-tier">II</);
    expect(html).toContain('Upgrade to tier III');
    expect(html).toContain('5 DP · $6,000');
  });

  it('removes the purchase CTA at max tier and keeps one-time programs complete', () => {
    const html = detail('wellbeing_peer_support', 3, { purchasedTier: 3 });
    expect(html).toMatch(/data-state="current" aria-current="step"><span class="dev-ladder-tier">III</);
    expect(html).toContain('x2 faster');
    expect(html).toContain('Fully upgraded');
    expect(html).not.toContain('Upgrade to tier');
    const program = detail('personnel_negotiation', 1);
    expect(program).toContain('Program owned');
    expect(program).not.toContain('Tier ladder');
    expect(program).not.toContain('Unlock program');
  });

  it('disables buying while pending or short of funds and exposes failure feedback', () => {
    const pending = detail('personnel_academy', 1, { pending: true });
    expect(pending).toContain('disabled=""');
    expect(pending).toContain('Upgrading…');
    const sample = structuredClone(state);
    sample.department.funding = 0;
    const unavailable = nodeOptions(sample).find((entry) => entry.node.id === 'personnel_academy')!;
    const html = detail('personnel_academy', 0, { option: unavailable, failure: 'Development changed; review this tier.' });
    expect(html).toContain('Needs $2,500');
    expect(html).toContain('disabled=""');
    expect(html).toContain('role="alert"');
    expect(html).toContain('Development changed; review this tier.');
  });
});
