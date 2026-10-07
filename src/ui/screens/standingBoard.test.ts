import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCENARIO_ORDER } from '../../content/scenarios';
import { briefing } from '../../sim/operation-selectors';
import { registerCapabilityFixtures } from '../../sim/fixtures/capability-scenarios';
import { makeState, NOW } from '../../sim/test-fixtures';
import { BOARD_LIMIT, boardEntries, boardPlan, standingEntries } from './helpers';
import { OpsPrepare } from './OpsPrepare';
import { OpsBoard } from './OpsBoard';

const state = makeState();
vi.mock('../store', () => ({ useGame: () => state, send: vi.fn() }));
vi.mock('../components/toast', () => ({ useToast: () => ({ act: vi.fn(), notify: vi.fn() }) }));
vi.mock('../blueprint/Blueprint', () => ({ Blueprint: () => createElement('div', null, 'Map preview') }));

afterEach(() => vi.restoreAllMocks());

describe('the ops board: live calls first, standing assignments fill open places', () => {
  it('lists the standing assignments as live operations when no incident is open', () => {
    const incidents = state.incidents;
    state.incidents = [];
    try {
      const html = renderToStaticMarkup(createElement(OpsBoard, { onPrepare: () => {} }));
      expect(html).toContain('No open incidents');
      expect(html).toContain('Standing assignments');
      expect(html).not.toContain('featured-card');
      const launches = html.match(/>Prepare<\/button>/g) ?? [];
      expect(launches.length).toBe(SCENARIO_ORDER.length);
      expect(html).not.toContain('join the board as places open');
      expect(boardEntries(state, NOW)).toEqual([]);
    } finally { state.incidents = incidents; }
  });

  it('never offers more than five operations, and only standing assignments wait for a place', () => {
    const standing = standingEntries(state, NOW);
    expect(standing.map((entry) => entry.card.id)).toEqual(SCENARIO_ORDER);
    const live = (n: number) => Array.from({ length: n }, (_, i) => ({ card: { ...standing[0].card, id: `live_${i}` }, incident: {} as never, scenario: null }));
    expect(boardPlan([], standing)).toEqual({ live: [], standing, waiting: 0 });
    const four = boardPlan(live(4), standing);
    expect(four.live.length + four.standing.length).toBe(BOARD_LIMIT);
    expect(four.standing.map((entry) => entry.card.id)).toEqual([SCENARIO_ORDER[0]]);
    expect(four.waiting).toBe(SCENARIO_ORDER.length - 1);
    const full = boardPlan(live(7), standing);
    expect(full.live).toHaveLength(BOARD_LIMIT);
    expect(full.standing).toEqual([]);
    expect(full.waiting).toBe(SCENARIO_ORDER.length);
  });

  it('prepares a standing assignment as an ordinary deployment', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const html = renderToStaticMarkup(createElement(OpsPrepare, { scenarioId: 'ms_occupancy', onCancel: () => {} }));
    expect(html).toMatch(/>Deploy<\/button>/);
    expect(html).not.toContain('type="checkbox"');
  });

  it('suggests capability equipment and companion supplies the scene can use', () => {
    registerCapabilityFixtures();
    const signals = briefing('capability_signals_v2').usefulItemIds;
    expect(signals).toEqual(expect.arrayContaining(['portable_light', 'radio_relay', 'command_van']));
    expect(signals).not.toContain('observation_binoculars');
    expect(signals).not.toContain('battery_pack');
  });
});
