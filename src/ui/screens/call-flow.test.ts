// The exit table for a call before it goes live (docs/ui-ux-audit.md): the open call and its step
// live in history, the draft outside the screens, so Back, browser Back and Forward and a detour to
// another tab keep both, and deploying drops them.
import { describe, expect, it } from 'vitest';
import { CALL_FLOW_HISTORY_KEY, createCallFlow } from './call-flow';

/** A browser history in memory: push truncates the forward entries, back and forward move and pop. */
function memoryHistory() {
  const entries: unknown[] = [{}];
  let index = 0;
  let flow: ReturnType<typeof createCallFlow> | null = null;
  const history = {
    get state() { return entries[index] as Record<string, unknown>; },
    pushState(state: unknown) { entries.splice(index + 1); entries.push(state); index++; },
    replaceState(state: unknown) { entries[index] = state; },
    back() { if (index > 0) { index--; flow?.onPop(); } },
    forward() { if (index < entries.length - 1) { index++; flow?.onPop(); } },
    /** Another owner (the shell's tabs) pushing its own entry, spreading the current state. */
    pushOther(extra: Record<string, unknown>) { this.pushState({ ...this.state, ...extra }); },
    attach(f: ReturnType<typeof createCallFlow>) { flow = f; },
  };
  return history;
}

describe('a call before it goes live', () => {
  it('moves board, brief and deploy with Back, browser Back and Forward, keeping the draft', () => {
    const history = memoryHistory();
    const flow = createCallFlow(history);
    history.attach(flow);
    const step = () => flow.getSnapshot().open?.step ?? 'board';
    flow.openCall('call_1');
    expect(step()).toBe('brief');
    flow.goStep('deploy');
    const [, setChosen] = flow.field('call_1', flow.draft('call_1'), 'chosen');
    setChosen(['A']);
    flow.back();
    expect(step()).toBe('brief');
    history.back();
    expect(step()).toBe('board');
    history.forward();
    history.forward();
    expect(step()).toBe('deploy');
    expect(flow.draft('call_1').chosen).toEqual(['A']);
    // Back on the brief walks history to the board; reopening the call keeps the draft.
    flow.back();
    flow.back();
    expect(step()).toBe('board');
    flow.openCall('call_1');
    expect(flow.draft('call_1').chosen).toEqual(['A']);
  });

  it('keeps the step through a detour to another tab and back', () => {
    const history = memoryHistory();
    const flow = createCallFlow(history);
    history.attach(flow);
    flow.openCall('call_1');
    flow.goStep('deploy');
    history.pushOther({ shell: 'hq' });
    expect(history.state[CALL_FLOW_HISTORY_KEY]).toMatchObject({ open: { scenarioId: 'call_1', step: 'deploy' } });
    history.pushOther({ shell: 'calls' });
    expect(flow.getSnapshot().open).toEqual({ scenarioId: 'call_1', step: 'deploy' });
    history.back();
    history.back();
    expect(flow.getSnapshot().open).toEqual({ scenarioId: 'call_1', step: 'deploy' });
  });

  it('drops the draft when the call deploys or leaves the board', () => {
    const flow = createCallFlow(null);
    flow.openCall('call_1');
    flow.field('call_1', flow.draft('call_1'), 'chosen')[1](['A']);
    flow.field('call_2', flow.draft('call_2'), 'chosen')[1](['B']);
    flow.close('call_1');
    expect(flow.getSnapshot().open).toBeNull();
    expect(flow.draft('call_1').chosen).toEqual([]);
    flow.prune((id) => id !== 'call_2');
    expect(flow.draft('call_2').chosen).toEqual([]);
  });
});
