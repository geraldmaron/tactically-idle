import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEV_NODES } from '../../content/dev-tree';
import { createInitialState } from '../../sim/department';
import { DEVELOP_HANDLERS } from '../../sim/develop';
import { nodeOptions } from '../../sim/department-selectors';
import { DevelopmentDetail, DevelopmentTile, DevelopScreen, filterDevelopmentOptions, nextDevelopment, nodeSummary, tileState, trackRows } from './Develop';

const NOW = Date.UTC(2026, 9, 3, 12);
const state = createInitialState(NOW, 1);

state.department.funding = 100_000;
vi.mock('../store', () => ({ useGame: () => state, send: vi.fn() }));
vi.mock('../components/toast', () => ({ useToast: () => ({ notify: vi.fn() }) }));
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
  it('renders one Next card, named branch chips and the highlighted branch as one track, with funding said once in the bar (develop-track)', () => {
    const html = renderToStaticMarkup(createElement(DevelopScreen, { highlightedNode: 'personnel_academy', highlightRequest: 2 }));
    expect(html).not.toContain('$100,000');
    expect(html).not.toContain('/h</small>');
    expect(html).toMatch(/role="tab" aria-selected="(true|false)" class="dev-branch-chip[^"]*" aria-label="Staff, 0 of 8 owned[^"]*">Staff/);
    expect(html.match(/class="btn btn-primary/g)?.length ?? 0).toBeLessThanOrEqual(1);
    expect(html).not.toMatch(/development points|Get Points|\bDP\b/);
    expect(html).toContain('Free at Level 3');
    expect(html).toContain('aria-label="Development branches"');
    expect(html).toContain('aria-label="Staff, 0 of 8 owned');
    expect(html).toContain('Next up');
    expect(html).toContain('class="dev-track"');
    expect(html).toMatch(/data-development-node="personnel_academy"[^>]*class="dev-node store-node-highlight"/);
    const staff = Object.values(DEV_NODES).filter((node) => node.branch === 'personnel').length;
    expect((html.match(/data-development-node=/g) ?? [])).toHaveLength(staff);
    expect(html).not.toMatch(/earned \+|test DP/i);
  });

  it('feeds the ready rail with genuinely affordable developments, scoped by branch', () => {
    const sample = structuredClone(state);
    DEVELOP_HANDLERS.unlockNode(sample, 'personnel_academy', 1);
    DEVELOP_HANDLERS.unlockNode(sample, 'intel_records', 1);

    sample.department.funding = 6000;
    const options = nodeOptions(sample);
    expect(filterDevelopmentOptions(options, 'all', 'owned').map((entry) => entry.node.id)).toEqual(['personnel_academy', 'intel_records']);
    const available = filterDevelopmentOptions(options, 'all', 'available').map((entry) => entry.node.id);
    expect(available).toContain('intel_records');
    expect(available).not.toContain('personnel_academy');
    expect(available).not.toContain('intel_drone');
    expect(filterDevelopmentOptions(options, 'personnel', 'owned').map((entry) => entry.node.id)).toEqual(['personnel_academy']);
    expect(filterDevelopmentOptions(options, 'wellbeing', 'owned')).toEqual([]);
  });

  it('lays a branch out as one track: each development right after what it needs, one step deeper', () => {
    for (const branch of ['personnel', 'field', 'intel', 'logistics', 'wellbeing'] as const) {
      const nodes = nodeOptions(state).filter((entry) => entry.node.branch === branch);
      const rows = trackRows(nodes);
      expect(rows.map((row) => row.option.node.id).sort()).toEqual(nodes.map((entry) => entry.node.id).sort());
      rows.forEach((row, index) => {
        if (!row.parentId) { expect(row.depth).toBe(0); return; }
        const parent = rows.findIndex((r) => r.option.node.id === row.parentId);
        expect(parent).toBeLessThan(index);
        expect(row.depth).toBe(rows[parent].depth + 1);
      });
    }
    const intel = trackRows(nodeOptions(state).filter((entry) => entry.node.branch === 'intel'));
    const drone = intel.find((row) => row.option.node.id === 'intel_drone')!;
    expect(drone.parentId).toBe('intel_thermal');
  });

  it('points at the cheapest development that can be bought now, else the cheapest that is open', () => {
    const options = nodeOptions(state);
    const next = nextDevelopment(options)!;
    expect(next.quote.ok).toBe(true);
    for (const other of options.filter((entry) => entry.quote.ok)) expect(next.quote.cost!.funding).toBeLessThanOrEqual(other.quote.cost!.funding);
    const broke = structuredClone(state);
    broke.department.funding = 0;

    const open = nextDevelopment(nodeOptions(broke))!;
    expect(open.status).not.toBe('locked');
    expect(open.quote.ok).toBe(false);
    expect(nodeSummary(option('intel_drone'))).toMatch(/^Unlocks Camera drone/);
  });

  it('shows state, tier pips and cost on a tile, with the full story in its label', () => {
    const budget = { funding: 100_000 };
    const tiered = renderToStaticMarkup(createElement(DevelopmentTile, { option: option('personnel_academy', 1), budget, highlighted: false, onOpen: () => {} }));
    expect(tiered).toContain('data-state="ready"');
    expect(tiered).toContain('Training academy. Ready to buy. Tier 1 of 3. Next costs $7,200. Or granted at Level 5, 1 of 5');
    expect(tiered).toContain('Free at Level 5<b>1 of 5</b>');
    expect(((tiered.match(/<span class="dev-pips">(.*?)<\/span>/)?.[1] ?? '').match(/<i[ >]/g) ?? [])).toHaveLength(3);
    expect(tiered).toContain('<i data-on="yes"></i><i></i><i></i>');
    expect((tiered.match(/<button/g) ?? [])).toHaveLength(1);
    const locked = renderToStaticMarkup(createElement(DevelopmentTile, { option: option('intel_drone'), budget, highlighted: false, onOpen: () => {} }));
    expect(locked).toContain('data-state="locked"');
    expect(locked).toContain('Needs Thermal imaging');
    expect(locked).toContain('Locked, needs Thermal imaging');
    const broke = structuredClone(state);
    broke.department.funding = 0;
    const short = renderToStaticMarkup(createElement(DevelopmentTile, { option: nodeOptions(broke).find((entry) => entry.node.id === 'personnel_academy')!, budget: { funding: 0 }, highlighted: false, onOpen: () => {} }));
    expect(short).toContain('Needs more funding');
    expect(short).toMatch(/<span class="dev-price" data-state="short" data-short="yes">\$4,900<\/span>/);
    const owned = option('personnel_negotiation', 1);
    expect(tileState(owned)).toBe('owned');
    expect(renderToStaticMarkup(createElement(DevelopmentTile, { option: owned, budget, highlighted: false, onOpen: () => {} }))).toContain('Negotiation training. Owned');
  });

  it('shows the baseline and the entire ladder, prerequisites, unlocks and contextual links', () => {
    const academy = detail('personnel_academy');
    expect(academy).toContain('role="dialog" aria-label="Training academy"');
    expect(academy).toContain('1 total training slot');
    expect(academy).toContain('2 total training slots');
    for (const line of ['$4,900 or Level 3', '$7,200 or Level 5', '$11.3K or Level 7', 'Tier ladder', 'Current', 'Open Training', 'Buy tier I for $4,900', 'Buy now', 'Or free', 'Free at Level 3']) expect(academy).toContain(line);
    expect(academy).not.toContain('Needs first');
    expect(academy).not.toContain('Open Armory');
    const manager = detail('logistics_equipment_manager');
    for (const line of ['Standard repair prices', '25% cheaper repairs', '35% cheaper repairs', '45% cheaper repairs', '4 automatic service jobs', 'Open Armory']) expect(manager).toContain(line);
    const drone = detail('intel_drone');
    expect(drone).toContain('Needs first');
    expect(drone).toMatch(/Thermal imaging<span class="sr-only"> · Required<\/span>/);
    expect(drone).toContain('Unlocks');
    expect(drone).toContain('Camera drone');
    expect(drone).toContain('Open Training');
    expect(drone).toContain('Open Armory');
    expect(drone).toContain('disabled=""');
    expect((drone.match(/btn-primary/g) ?? [])).toHaveLength(1);
  });

  it('keeps the sheet useful after purchase with the changed current and next tiers', () => {
    const html = detail('intel_records', 2, { purchasedTier: 2 });
    expect(html).toContain('Tier II purchased');
    expect(html).toContain('+$120/h funding');
    expect(html).toContain('+$200/h funding');
    expect(html).toMatch(/data-state="current" aria-current="step"><span class="dev-ladder-tier">II</);
    expect(html).toContain('Buy tier III');
    expect(html).toContain('Free at Level 8');
  });

  it('removes the purchase CTA at max tier and keeps one-time programs complete', () => {
    const html = detail('wellbeing_peer_support', 3, { purchasedTier: 3 });
    expect(html).toMatch(/data-state="current" aria-current="step"><span class="dev-ladder-tier">III</);
    expect(html).toContain('x2 faster');
    expect(html).toContain('Fully upgraded');
    expect(html).not.toContain('Buy tier');
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
    expect(html).toContain('Needs $4,900');
    expect(html).toContain('disabled=""');
    expect(html).toContain('role="alert"');
    expect(html).toContain('Development changed; review this tier.');
  });
});
