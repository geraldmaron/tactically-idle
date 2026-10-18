import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { briefing } from '../../sim/operation-selectors';
import { registerCapabilityFixtures } from '../../sim/fixtures/capability-scenarios';
import { makeState, NOW } from '../../sim/test-fixtures';
import { BOARD_LIMIT, boardEntries, boardPlan } from './helpers';
import { OpsPrepare } from './OpsPrepare';
import { OpsBoard } from './OpsBoard';

const state = makeState();
vi.mock('../store', () => ({ useGame: () => state, send: vi.fn() }));
vi.mock('../components/toast', () => ({ useToast: () => ({ act: vi.fn(), notify: vi.fn() }) }));
vi.mock('../blueprint/Blueprint', () => ({ Blueprint: () => createElement('div', null, 'Map preview') }));

afterEach(() => vi.restoreAllMocks());

describe('the ops board: tactical call-outs only', () => {
  it('shows no standing assignments and says so when no call-out is live', () => {
    const incidents = state.incidents;
    state.incidents = [];
    try {
      const html = renderToStaticMarkup(createElement(OpsBoard, { onPrepare: () => {} }));
      expect(html).toContain('No call-outs right now');
      expect(html).not.toContain('Standing assignments');
      expect(html).not.toContain('>Prepare</button>');
      expect(boardEntries(state, NOW)).toEqual([]);
    } finally { state.incidents = incidents; }
  });

  it('never offers more than five call-outs', () => {
    const live = (n: number) => Array.from({ length: n }, (_, i) => ({ card: { id: `live_${i}` }, incident: {}, scenario: null }) as never);
    expect(boardPlan(live(3))).toHaveLength(3);
    expect(boardPlan(live(7))).toHaveLength(BOARD_LIMIT);
  });

  it('still prepares an authored scenario as an ordinary deployment', () => {
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
