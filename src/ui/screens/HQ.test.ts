// The City's "your move" Open lands on the named call's brief (backlog `ui-leftovers`), not the whole board,
// and the City shows the blocks a department needs on one screen: the move, the radio, the districts and the results.
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

// The old HQ home is the City tab (HQ.tsx only re-exports it). Squads with their faces, the command posts and the patrol
// card moved to the Team tab, and are tested with it (Squad.test.ts, CommandStaff.test.ts, Patrol.test.ts).
describe('City surfaces (the old HQ home)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    state = withCallOnBoard(makeState(), testCallId('hostage'));
    state.world.onboarding.stage = 'done';
    seedPatrol(state, NOW);
  });
  afterEach(() => vi.useRealTimers());
  const html = () => renderToStaticMarkup(createElement(HQ));

  it('shows the move, the radio, the districts as a list and the results', () => {
    const page = html();
    // The move is the next call, one button that opens it; the radio and the district list sit beside the map.
    expect(page).toMatch(/<button[^>]*class="city-now city-now-call"[^>]*aria-label="[^"]*\. Open"/);
    for (const part of ['aria-label="Radio"', 'Districts', 'data-district="pike"', 'No results yet']) expect(page, part).toContain(part);
  });

  it('leaves funding, trust and level to the resource bar', () => {
    const page = html();
    for (const part of ['Department net', 'hq-vital']) expect(page, part).not.toContain(part);
  });

  it('opens the first district and keeps the others for the level that opens them', () => {
    const page = html();
    expect(page.match(/data-state="open"/g)).toHaveLength(1);
    expect(page).toContain('Opens at department level');
  });

  it('offers a waiting shift report', () => {
    state = { ...state, report: { from: NOW - HOUR_MS, to: NOW, accruedHours: 1, gross: 900, wages: 200, operating: 100, restockSpend: 0, net: 600, completedCourses: [], recovered: [], shortages: [], capped: false, personnel: [], equipment: [] } as unknown as GameState['report'] };
    const page = html();
    expect(page).toContain('While you were off');
    expect(page).toContain('Open the report');
  });
});
