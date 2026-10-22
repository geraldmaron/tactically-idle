// HQ's "your move" Open lands on the named call's brief (backlog `ui-leftovers`), not the whole board.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NavApi } from '../components/nav';
import { callFlow } from './call-flow';
import { openCallBrief } from './HQ';

vi.mock('../store', () => ({ useGame: () => null, useCampaigns: () => null, send: vi.fn() }));

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
