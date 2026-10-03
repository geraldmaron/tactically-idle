import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEV_NODES } from '../../content/dev-tree';
import { createInitialState } from '../../sim/department';
import { DEVELOP_HANDLERS } from '../../sim/develop';
import { nodeOptions } from '../../sim/department-selectors';
import { DevelopmentCard, DevelopmentDetail, DevelopScreen, filterDevelopmentOptions } from './Develop';

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
  it('renders compact balances, branch and ownership filters, and request-target markers', () => {
    const html = renderToStaticMarkup(createElement(DevelopScreen, { highlightedNode: 'personnel_academy', highlightRequest: 2 }));
    expect(html).toContain('100 DP</span>');
    expect(html).toContain('Get Points');
    expect(html).toContain('aria-label="Development branches"');
    expect(html).toContain('aria-label="Development ownership"');
    for (const label of ['All branches', 'Available', 'Owned', 'Expanded barracks']) expect(html).toContain(label);
    expect(html).toContain('data-development-node="personnel_academy" class="development-card node-available store-node-highlight"');
    expect((html.match(/data-development-node=/g) ?? [])).toHaveLength(Object.keys(DEV_NODES).length);
    expect(html).not.toMatch(/earned \+|test DP|department level/i);
  });

  it('combines branch, genuinely affordable, and owned filters without hiding owned upgrades', () => {
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

  it('shows current tier, next total benefit and only one card CTA', () => {
    const html = renderToStaticMarkup(createElement(DevelopmentCard, { option: option('personnel_academy', 1), highlighted: false, onOpen: () => {} }));
    expect(html).toContain('Tier I / III');
    expect(html).toContain('Next · Tier II');
    expect(html).toContain('3 total training slots');
    expect(html).toContain('$4,000');
    expect((html.match(/<button/g) ?? [])).toHaveLength(1);
    expect(html).toContain('>Upgrade</button>');
    expect(html).not.toContain('Tier ladder');
  });

  it('shows baseline → tier I, the entire incremental ladder, prerequisites and contextual links', () => {
    const academy = detail('personnel_academy');
    expect(academy).toContain('role="dialog" aria-label="Training academy"');
    expect(academy).toContain('Current · Not owned');
    expect(academy).toContain('1 total training slot');
    expect(academy).toContain('Next · Tier I');
    expect(academy).toContain('2 total training slots');
    for (const line of ['3 DP + $2,500 funding', '4 DP + $4,000 funding', '6 DP + $6,500 funding', 'Tier ladder', 'Prerequisites', 'None', 'Open Training']) expect(academy).toContain(line);
    expect(academy).not.toContain('Open Gear');
    const manager = detail('logistics_equipment_manager');
    for (const line of ['Standard repair prices', '25% cheaper repairs', '35% cheaper repairs', '45% cheaper repairs', '4 automatic service jobs', 'Open Gear']) expect(manager).toContain(line);
    const drone = detail('intel_drone');
    expect(drone).toContain('Thermal imaging · Required');
    expect(drone).toContain('Open Training');
    expect(drone).toContain('Open Gear');
    expect(drone).toContain('disabled=""');
  });

  it('keeps the sheet useful after purchase with the changed current and next totals', () => {
    const html = detail('intel_records', 2, { purchasedTier: 2 });
    expect(html).toContain('Tier II purchased');
    expect(html).toContain('Current · Tier II');
    expect(html).toContain('+$120/h funding');
    expect(html).toContain('Next · Tier III');
    expect(html).toContain('+$200/h funding');
    expect(html).toContain('Upgrade to tier III');
    expect(html).toContain('5 DP + $6,000 funding');
  });

  it('removes the purchase CTA at max tier and keeps one-time programs complete', () => {
    const html = detail('wellbeing_peer_support', 3, { purchasedTier: 3 });
    expect(html).toContain('Current · Tier III');
    expect(html).toContain('x2 faster');
    expect(html).toContain('Fully upgraded');
    expect(html).not.toContain('Upgrade to tier');
    const program = detail('personnel_negotiation', 1);
    expect(program).toContain('Current · Owned');
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
