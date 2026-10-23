// HQ's "your move" Open lands on the named call's brief (backlog `ui-leftovers`), not the whole board,
// and HQ shows every block a department needs: the move, notices, squads with every member, patrol and
// the department net, trust and level, command staff and results.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '../../sim/types';
import { HOUR_MS } from '../../sim/economy';
import { seedPatrol } from '../../sim/patrol';
import { makeState, NOW, testCallId, withCallOnBoard } from '../../sim/test-fixtures';
import type { NavApi } from '../components/nav';
import { callFlow } from './call-flow';
import { HQ, openCallBrief } from './HQ';

let state: GameState = makeState();
vi.mock('../store', () => ({
  useGame: () => state,
  useCampaigns: () => ({ session: 0, activeSlotId: null, campaignId: null, slots: [], issue: null, dirty: false }),
  send: vi.fn(),
}));
vi.mock('../components/toast', () => ({ useToast: () => ({ act: vi.fn(), notify: vi.fn() }) }));
vi.mock('../components/Sheet', () => ({ Sheet: () => null }));

describe('HQ "your move" Open', () => {
  afterEach(() => callFlow.close());

  it('goes to the Calls tab with the named call open on its brief', () => {
    const go = vi.fn<NavApi['go']>();
    openCallBrief({ go }, 'call_1');
    expect(go).toHaveBeenCalledWith('ops');
    expect(callFlow.getSnapshot().open).toEqual({ scenarioId: 'call_1', step: 'brief' });
  });

  it('leaves the call on its brief, not on the board, when another call was open', () => {
    callFlow.openCall('call_2');
    openCallBrief({ go: vi.fn() }, 'call_1');
    expect(callFlow.getSnapshot().open).toEqual({ scenarioId: 'call_1', step: 'brief' });
  });
});

describe('HQ surfaces', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    state = withCallOnBoard(makeState(), testCallId('hostage'));
    seedPatrol(state, NOW);
  });
  afterEach(() => vi.useRealTimers());
  const html = () => renderToStaticMarkup(createElement(HQ));

  it('shows the move, squads, patrol with the department net, vitals, command staff and results', () => {
    const page = html();
    for (const part of ['aria-label="Your move"', 'SWAT readiness', 'Patrol and funding', 'Department net', 'hq-patrol-rate', 'Trust', 'Level', 'Command staff', 'Recent results'])
      expect(page, part).toContain(part);
  });

  it('stacks every member of a squad on its tile', () => {
    const tiles = html().split('class="hq-faces hq-faces-md"').slice(1);
    expect(tiles).toHaveLength(state.squads.length);
    tiles.forEach((tile, i) => expect(tile.split('hq-squad-name')[0].match(/class="face face-md/g)).toHaveLength(state.squads[i].officerIds.length));
  });

  it('warns when hourly income is about to stop, and when it has', () => {
    expect(html()).not.toContain('Hourly income');
    vi.setSystemTime(NOW + 20 * HOUR_MS);
    expect(html()).toContain('Stops in');
    vi.setSystemTime(NOW + 25 * HOUR_MS);
    expect(html()).toContain('Paused. Your next order resumes it.');
  });

  it('offers a waiting shift report', () => {
    state = { ...state, report: { from: NOW - HOUR_MS, to: NOW, accruedHours: 1, gross: 900, wages: 200, operating: 100, restockSpend: 0, net: 600, completedCourses: [], recovered: [], shortages: [], capped: false, personnel: [], equipment: [] } as unknown as GameState['report'] };
    expect(html()).toContain('Shift report');
  });
});
