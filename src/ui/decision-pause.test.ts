// Step out's pause (docs/ui-ux-audit.md, chrome-contract): the open decision's stall runs only while
// the live call is on screen and the page is visible. Visibility alone never resumes a call the player
// stepped out of, so backgrounding, a reload and a long wait on HQ keep the elapsed time; coming back
// to the call resumes it where it was, and the department keeps earning the whole time.
import { describe, expect, it } from 'vitest';
import { CALL_TREES } from '../content/call-trees';
import { CLOCK_RULES_V1, lapsedThreat, openDither, openThreat } from '../sim/clocks';
import { dispatch } from '../sim/game';
import { deserialize, serialize } from '../sim/save';
import { getScenario } from '../sim/scenario-registry';
import { NOW } from '../sim/test-fixtures';
import type { Command, GameState } from '../sim/types';
import { drawCalls } from '../gen/incident/trees-v13/balance';
import { startGateRun } from '../gen/incident/gates/engine-driver';
import { decisionPauseCommand, type DecisionWatch } from './decision-pause';

const MIN = 60_000;
const ON_CALL: DecisionWatch = { callShown: true, pageVisible: true };
const STEPPED_OUT: DecisionWatch = { callShown: false, pageVisible: true };
const HIDDEN_OFF_CALL: DecisionWatch = { callShown: false, pageVisible: false };
const HIDDEN_ON_CALL: DecisionWatch = { callShown: true, pageVisible: false };

/** A live hostage call at its first decision, driven the way the store drives it: every command
 * through the game's dispatch at the Standard timer, the pause synced from what the player sees. */
function session() {
  const [call] = drawCalls(CALL_TREES.hostage_crisis!, 1, 1, 1);
  let state: GameState = startGateRun(call.scenarioId, call.seed);
  const scenario = getScenario(state.activeRun!.scenarioId)!;
  const ctx = (now: number) => ({ now, timer: 'standard' as const });
  const send = (cmd: Command, now: number) => {
    const next = dispatch(state, cmd, ctx(now));
    if (next.result.ok) state = next.state;
    return next.result;
  };
  const sync = (watch: DecisionWatch, now: number) => {
    const command = decisionPauseCommand(state, watch);
    if (command) expect(send(command, now).ok, command.type).toBe(true);
    return command?.type ?? null;
  };
  const dither = (now: number) => openDither(scenario, state.activeRun!, state.department.clockHighWater, now, 'standard');
  const due = (now: number) => lapsedThreat(scenario, state.activeRun!, state.department.clockHighWater, now, 'standard');
  const drainMs = openThreat(scenario, state.activeRun!)!.minutes / CLOCK_RULES_V1.dither.standard.gameMinutesPerRealMinute * MIN;
  return { get state() { return state; }, set state(next: GameState) { state = next; }, send, sync, dither, due, drainMs };
}

describe('Step out pauses the open decision, and only the call resumes it', () => {
  it('pauses on stepping out and stays paused through background, return on HQ, reload and a long wait', () => {
    const call = session();
    expect(call.sync(ON_CALL, NOW)).toBeNull();
    const out = NOW + call.drainMs / 4;
    const before = call.dither(out);
    expect(before).toBeGreaterThan(0);
    // Step out: the call leaves the screen, the stall stops where it was.
    expect(call.sync(STEPPED_OUT, out)).toBe('pauseDecision');
    // Background and come back to HQ: visibility alone resumes nothing.
    expect(call.sync(HIDDEN_OFF_CALL, out + MIN)).toBeNull();
    expect(call.sync(STEPPED_OUT, out + 2 * MIN)).toBeNull();
    expect(call.state.activeRun!.decisionPausedAt).toBeDefined();
    // Reload: the pause is in the save, and a load that lands off the call keeps it.
    call.state = deserialize(serialize(call.state, out + 3 * MIN))!;
    expect(call.state.activeRun!.decisionPausedAt).toBeDefined();
    expect(call.sync(STEPPED_OUT, out + 3 * MIN)).toBeNull();
    // A long wait, well past the threat's window: nothing runs out, the stall holds, the department earns.
    const later = out + 10 * call.drainMs + 60 * MIN;
    const funding = call.state.department.funding;
    expect(call.send({ type: 'tick' }, later).ok).toBe(true);
    expect(call.state.department.funding, 'the department keeps earning while the call waits').toBeGreaterThan(funding);
    expect(call.due(later), 'a paused decision never runs out').toBeNull();
    expect(call.dither(later)).toBeCloseTo(before, 6);
    // Back on the call: it resumes with the elapsed time it had, and runs again from there.
    expect(call.sync(ON_CALL, later)).toBe('resumeDecision');
    expect(call.state.activeRun!.decisionPausedAt).toBeUndefined();
    expect(call.dither(later)).toBeCloseTo(before, 6);
    expect(call.dither(later + MIN)).toBeGreaterThan(before);
    expect(call.due(later + call.drainMs), 'the threat still runs out once the player is back and waits').not.toBeNull();
  });

  it('pauses while the app is hidden on the call and resumes when it shows again', () => {
    const call = session();
    const away = call.dither(NOW + MIN);
    expect(call.sync(HIDDEN_ON_CALL, NOW + MIN)).toBe('pauseDecision');
    expect(call.sync(ON_CALL, NOW + 30 * MIN)).toBe('resumeDecision');
    expect(call.dither(NOW + 30 * MIN), 'the time hidden never counts').toBeCloseTo(away, 6);
  });

  it('a reload that lands on the call resumes it; one that lands elsewhere does not', () => {
    const call = session();
    expect(call.sync(HIDDEN_ON_CALL, NOW + MIN)).toBe('pauseDecision');
    const saved = serialize(call.state, NOW + 5 * MIN);
    call.state = deserialize(saved)!;
    // The store's first sync runs before any screen mounts: off the call.
    expect(call.sync(STEPPED_OUT, NOW + 5 * MIN)).toBeNull();
    // The player opens Calls.
    expect(call.sync(ON_CALL, NOW + 6 * MIN)).toBe('resumeDecision');
  });

  it('never pauses a decision that has not opened, and does nothing without a live call', () => {
    const call = session();
    const pending = structuredClone(call.state);
    pending.activeRun!.decisionPending = true;
    expect(decisionPauseCommand(pending, STEPPED_OUT)).toBeNull();
    const none = structuredClone(call.state);
    none.activeRun = null;
    expect(decisionPauseCommand(none, STEPPED_OUT)).toBeNull();
  });
});
