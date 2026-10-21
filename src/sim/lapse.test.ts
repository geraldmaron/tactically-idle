// The lapse (docs/call-pressure.md, "When the time runs out"; owner 2026-10-21): when a decision
// point's drain empties with no choice made, the threat lands, the record says nobody chose, and the
// call moves to the moment its timeout names. One rule (lapsedThreat) settles the window, so a lapse
// and a late choice can never both commit it; the record replays, saves and reloads like a decision.
import { describe, expect, it } from 'vitest';
import { CALL_TREES } from '../content/call-trees';
import { CLOCK_RULES_V1, lapsedThreat, openThreat } from './clocks';
import { spentFlag } from './conditions';
import { computeDebrief, decisionViewsFor, traceRun } from './operation';
import { actionViews } from './operation-selectors';
import { deserialize, serialize } from './save';
import { getScenario } from './scenario-registry';
import { apply, NOW } from './test-fixtures';
import { decisionsOf, isLapse } from './types';
import type { GameState, LapseRecord } from './types';
import { applyMove, availableMoves, lapseMove, startGateRun } from '../gen/incident/gates/engine-driver';
import { generateIncident } from '../gen/incident';
import { specForSituation } from '../gen/incident/gates/catalog';
import { SCENARIO_TYPES } from '../content/scenario-types';
import { timeoutNexts } from '../gen/incident/trees-v13/compile';
import { drawCalls } from '../gen/incident/trees-v13/balance';
import { decodePath, encodePath } from '../dev/lab/model/call';
import { historyTokens } from '../ui/lab-handoff';
import { playPath } from '../dev/lab/model/session';

const MIN = 60_000;
const tree = CALL_TREES.hostage_crisis!;

function hostageStart(seed = 1): GameState {
  const [call] = drawCalls(tree, 1, 1, seed);
  return startGateRun(call.scenarioId, call.seed);
}
const scenarioOf = (state: GameState) => getScenario(state.activeRun!.scenarioId)!;
/** Real minutes at Standard until the open threat's drain empties. */
const drainMs = (state: GameState) => openThreat(scenarioOf(state), state.activeRun!)!.minutes / CLOCK_RULES_V1.dither.standard.gameMinutesPerRealMinute * MIN;
const nodeOf = (state: GameState) => [...state.activeRun!.flags].reverse().find(flag => flag.startsWith('at:'))?.slice(3) ?? tree.root;
const lapseCmd = (state: GameState) => ({ type: 'lapse' as const, revision: state.activeRun!.revision, threatId: openThreat(scenarioOf(state), state.activeRun!)!.id });

describe('a threat that runs out with no choice made', () => {
  const start = hostageStart();
  const run = start.activeRun!;
  const threat = openThreat(scenarioOf(start), run)!;
  const due = NOW + drainMs(start) + 1000;

  it('settles only once the drain is empty, and never with the timer off', () => {
    expect(threat.timeout?.length, 'Going Live’s first threat has somewhere to go').toBeGreaterThan(0);
    expect(lapsedThreat(scenarioOf(start), run, start.department.clockHighWater, NOW + drainMs(start) / 2, 'standard')).toBeNull();
    expect(apply(start, lapseCmd(start), NOW + drainMs(start) / 2, { timer: 'standard' }).result.ok).toBe(false);
    expect(apply(start, lapseCmd(start), due + 600 * MIN, { timer: 'off' }).result.ok).toBe(false);
    expect(apply(start, lapseCmd(start), due + 600 * MIN).result.ok, 'no timer given means Off').toBe(false);
    expect(apply(start, lapseCmd(start), due, { timer: 'standard' }).result.ok).toBe(true);
  });

  it('records the indecision with no action, band, sample, squads or strain, and moves to the authored moment', () => {
    const after = apply(start, lapseCmd(start), due, { timer: 'standard' }).state;
    const next = after.activeRun!;
    const record = next.history.at(-1)!;
    expect(isLapse(record)).toBe(true);
    const lapse = record as LapseRecord;
    expect(lapse).toMatchObject({ kind: 'lapse', revision: run.revision, threatId: threat.id, timeCost: threat.minutes, stage: 'assess' });
    for (const key of ['actionId', 'band', 'sample', 'actingSquadIds', 'officerIds', 'stressDeltas']) expect(lapse, key).not.toHaveProperty(key);
    expect(next.revision).toBe(run.revision + 1);
    expect(next.rngState, 'nothing was rolled').toBe(run.rngState);
    expect(next.decisionPending, 'its result is read before the next decision opens').toBe(true);
    expect(nodeOf(after)).toBe('address_out');
    expect(next.flags).toContain(spentFlag(threat.id));
    expect(next.clock).toBeCloseTo(run.clock + threat.minutes, 5);
    for (const id of Object.keys(start.officers)) expect(after.officers[id].stress, `${id} takes no strain from a lapse`).toBe(start.officers[id].stress);
    // The result beat names the indecision, the threat's line, the inaction and the new moment.
    expect(lapse.explanation[0]).toBe(`No call made: ${threat.label}.`);
    const landing = threat.effects.map(effect => effect.text).find(Boolean)!;
    // The landing and the beats played live in the comms log: told once, folded, never retold.
    expect(lapse.committed.heard?.map(line => line.line)).toContain(landing);
    expect(lapse.committed.consequences).not.toContain(landing);
    expect(lapse.committed.consequences[0]).toBe(threat.timeout![0].text);
    expect(lapse.committed.exchange ?? []).toEqual([]);
    expect(lapse.committed.consequences.at(-1)).toMatch(/^Next: /);
    const views = decisionViewsFor(after, next, scenarioOf(after));
    expect(views.at(-1)).toMatchObject({ lapse: true, band: null, title: `No call made: ${threat.label}`, stressDeltas: [] });
  });

  it('refuses a choice once the time has run out, and any command from an older screen', () => {
    const view = actionViews(start, NOW, 'A').find(entry => entry.eligible)!;
    const decide = { type: 'decide' as const, actionId: view.id, actingSquadIds: view.actingSquadIds, supportSquadIds: view.supportSquadIds };
    expect(apply(start, decide, due, { timer: 'standard' }).result.ok, 'the lapse settles the window, never a late choice').toBe(false);
    expect(apply(start, decide, due, { timer: 'off' }).result.ok, 'Timer Off: a slow choice still commits').toBe(true);
    expect(apply(start, { ...decide, revision: run.revision + 1 }, NOW).result.ok).toBe(false);
    const after = apply(start, lapseCmd(start), due, { timer: 'standard' }).state;
    expect(apply(after, lapseCmd(start), due + 60 * MIN, { timer: 'standard' }).result.ok, 'the same lapse twice').toBe(false);
    expect(apply(after, { ...decide, revision: run.revision }, due).result.ok, 'a choice from the screen before the lapse').toBe(false);
  });

  it('never lapses while the app is hidden, however long it stays hidden', () => {
    const paused = apply(start, { type: 'pauseDecision', revision: run.revision }, NOW + drainMs(start) / 2).state;
    expect(apply(paused, lapseCmd(paused), due + 600 * MIN, { timer: 'standard' }).result.ok).toBe(false);
  });

  it('replays: the trace ends where the run is, and the save round-trips and stays valid', () => {
    const after = apply(start, lapseCmd(start), due, { timer: 'standard' }).state;
    const next = after.activeRun!;
    const { end } = traceRun(scenarioOf(after), next);
    expect(end).toMatchObject({ pressure: next.pressure, objective: next.objective, civilianSafety: next.civilianSafety, clock: next.clock, knowledge: next.knowledge });
    expect([...end.flags].sort()).toEqual([...next.flags].sort());
    const back = deserialize(serialize(after, due));
    expect(back?.activeRun?.history.at(-1)).toEqual(next.history.at(-1));
    // A lapse that claims a band, or a threat this call doesn't have, is not a save the game wrote.
    const tampered = (patch: Record<string, unknown>) => { const copy = structuredClone(after); Object.assign(copy.activeRun!.history.at(-1)!, patch); return deserialize(serialize(copy, due)); };
    expect(tampered({ band: 'favorable' })).toBeNull();
    expect(tampered({ threatId: 'no_such_node' })).toBeNull();
    expect(tampered({ timeCost: 1 })).toBeNull();
  });

  it('replays in the Lab from its path tokens, the same as the game recorded it', () => {
    const after = apply(start, lapseCmd(start), due, { timer: 'standard' }).state;
    const tokens = historyTokens(after.activeRun!);
    expect(tokens).toBe(`${threat.id}~lapse`);
    expect(encodePath(decodePath(tokens))).toBe(tokens);
    const { frames, stopped } = playPath(start, tokens);
    expect(stopped).toBeNull();
    const replayed = frames.at(-1)!.state.activeRun!;
    expect(nodeOf(frames.at(-1)!.state)).toBe('address_out');
    expect(replayed.history.at(-1)).toMatchObject({ kind: 'lapse', threatId: threat.id, committed: (after.activeRun!.history.at(-1) as LapseRecord).committed });
  });
});

describe('continued inaction', () => {
  it('moves forward every time a drain empties and ends the call held, never frozen', () => {
    for (const seed of [1, 2]) {
      let state = hostageStart(seed);
      const visited: string[] = [];
      for (let step = 0; step < 12 && state.activeRun!.status === 'active'; step++) {
        visited.push(nodeOf(state));
        const move = lapseMove(state);
        expect(move, `${nodeOf(state)} has nowhere to go when its time runs out`).not.toBeNull();
        const next = applyMove(state, move!);
        expect(next, `the lapse at ${nodeOf(state)}`).not.toBeNull();
        state = next!;
      }
      const run = state.activeRun!;
      expect(run.status, `seed ${seed}: ${visited.join(' > ')}`).toBe('debrief');
      expect(['held_both', 'held_counter', 'rider_held']).toContain(run.endingId);
      expect(decisionsOf(run.history), 'nobody chose anything').toHaveLength(0);
      const debrief = computeDebrief(state, run)!;
      expect(debrief.decisions?.every(view => view.lapse && view.band === null)).toBe(true);
      expect(debrief.causes.some(cause => cause.startsWith('No call made: ')), 'the debrief names the indecision').toBe(true);
      expect(debrief.officerCondition.every(officer => officer.xpGained === 0), 'a call nobody acted in teaches nothing').toBe(true);
    }
  });
});

describe('every Going Live threat', () => {
  it('lands on the moment its timeout names when it runs out, wherever the call reaches it', () => {
    const family = SCENARIO_TYPES.find(info => info.type === tree.type)!.families[0];
    const withThreat = new Set(tree.nodes.filter(node => node.threat).map(node => node.id));
    const lapsed = new Map<string, string>();
    for (const variant of tree.situations.map((_, i) => i as 0 | 1)) {
      const queue = [startGateRun(generateIncident(specForSituation(tree.type, family, variant)).id)];
      const seen = new Set<string>();
      while (queue.length && lapsed.size < withThreat.size) {
        const state = queue.shift()!;
        if (state.activeRun!.status !== 'active') continue;
        const at = nodeOf(state);
        if (seen.has(at)) continue;
        seen.add(at);
        const move = lapseMove(state);
        if (withThreat.has(at) && move && !lapsed.has(at)) {
          const after = applyMove(state, move)!;
          const node = tree.nodes.find(entry => entry.id === at)!;
          const targets = timeoutNexts(node).map(next => 'node' in next ? next.node : 'ending' in next ? `end:${next.ending}` : next.turn);
          const landed = after.activeRun!.status === 'active' ? nodeOf(after) : `end:${after.activeRun!.endingId}`;
          expect(targets, `${at} ran out to ${landed}`).toContain(landed);
          expect(after.activeRun!.history.at(-1)).toMatchObject({ kind: 'lapse', threatId: at });
          lapsed.set(at, landed);
        }
        // Choices with each band the dice allow, and the lapse itself: a run-out moment is reached
        // only by letting the time run out.
        for (const next of availableMoves(state)) { const after = applyMove(state, next); if (after) queue.push(after); }
      }
    }
    expect([...withThreat].filter(id => !lapsed.has(id)), `threats the walk never let run out (lapsed ${[...lapsed].map(([from, to]) => `${from}>${to}`).join(', ')})`).toEqual([]);
  }, 300000);
});
