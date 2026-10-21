// clock-forks-read-travel: a clock fork reads the minutes the decision runs the clocks by, travel
// through the building and forcing a door included (sim/clocks.ts teamMinutes and decisionMinutes,
// one formula for the commit and the fork). The decision saves its team minutes, so a replay reads
// what the commit read. Exercised on the group fixture with a clock built for it.
import { decisionsOf } from '../../sim/types';
import { describe, expect, it } from 'vitest';
import type { CallTree, TreeChoice } from '../../content/call-trees/types';
import type { Clock, IncidentTemplate } from '../../content/incidents/types';
import { CALL_TREES } from '../../content/call-trees';
import { clockConditionsHold, decisionMinutes, forkMinutes, stepClock, teamMinutes } from '../../sim/clocks';
import { validExternalSupportState } from '../../sim/external-support';
import { buildLocation } from '../../sim/location';
import { traceRun } from '../../sim/operation';
import { builtFor, evaluateAction, RESOLUTION_TUNING } from '../../sim/resolution';
import { deserialize, serialize } from '../../sim/save';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { getScenario } from '../../sim/scenario-registry';
import { NOW } from '../../sim/test-fixtures';
import type { GameState, StageId } from '../../sim/types';
import { applyNaturalMove, startGateRun, withDraftScenario } from './gates/engine-driver';
import { generateIncident } from './index';
import { compileIncident, hostedSpec } from './instance';
import { findStoryRoute } from './story-bindings';
import { drawCalls, playToEnd, POLICIES } from './trees-v13/balance';
import { choiceActionId } from './trees-v13/compile';
import { GROUP_TEMPLATE, GROUP_TREE } from './trees-v13/group-fixture';

const id = (node: string, choice: string) => choiceActionId('hostage_crisis', node, choice);
const WORK = 2;

/** The group fixture with a clock on the courier that runs `rate` a minute from `start`, cued at
 * once, and a choice at `talk` that walks the team to the counter: out, the call is handed over;
 * still running, it goes on to the last node. */
function template(start: number, rate: number): IncidentTemplate {
  const tree: CallTree = structuredClone(GROUP_TREE);
  const counter: TreeChoice = { id: 'to_counter', title: 'Walk to the counter', summary: 'You walk to the counter.', preview: { favorable: 'You reach it.', mixed: 'You reach it.', adverse: 'You reach it.' },
    icon: 'door', check: GROUP_TREE.nodes[0].choices[0].check, minutes: WORK, team: { to: 'scene' },
    outcomes: Object.fromEntries((['favorable', 'mixed', 'adverse'] as const).map(band => [band, [
      { if: { clock: 'nerve', out: true }, text: 'The courier is gone from the door.', next: { ending: 'handed_over' } },
      { if: { clock: 'nerve', out: false }, text: 'The courier is still at the door.', next: { node: 'final' } },
    ]])) as TreeChoice['outcomes'] };
  tree.nodes.find(node => node.id === 'talk')!.choices.push(counter);
  const clock: Clock = { id: 'nerve', label: 'The courier’s nerve', kind: 'deadline', owner: 'courier', start, ratePerMin: rate, rateKnown: false,
    cues: [{ at: start - 0.5, text: 'The courier keeps looking at the door.', mark: 'courier_restless' }] };
  return { ...GROUP_TEMPLATE, tree, situations: GROUP_TEMPLATE.situations.map(situation => ({ ...situation, clocks: [clock] })) };
}

/** The first seed whose building hosts the fixture; `compile` builds any template on it. */
const host = (() => {
  for (let seed = 1; seed < 200; seed++) {
    const { clocks: _c, incidentPeople: _p, threats: _t, ...base } = generateIncident({ type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: 13 });
    const spec = hostedSpec(base), built = buildLocation(base.locationFamilyId, base.locationSeed);
    const compile = (t: IncidentTemplate) => compileIncident({ ...base, id: `clock-forks-${seed}`, incident: spec }, built, t);
    try { compile(template(100, 1)); } catch { continue; }
    return { compile };
  }
  throw new Error('No seed hosts the fixture');
})();

/** Watch from the glass (three minutes, no travel), so the cue fires; then the team's minutes for
 * the walk to the counter, as the commit will evaluate them, with `flags` on the run. */
function measure(scenarioId: string, flags: string[] = [], campaign = 719) {
  let state = applyNaturalMove(startGateRun(scenarioId, campaign), { kind: 'decide', actionId: id('open', 'watch') })!;
  state = { ...state, activeRun: { ...state.activeRun!, flags: [...state.activeRun!.flags, ...flags] } };
  const run = state.activeRun!, scenario = getScenario(scenarioId)!;
  const action = scenario.stages.adapt.actions.find(entry => entry.id === id('talk', 'to_counter'))!;
  const ev = evaluateAction({ state, run, scenario, action, built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting: ['A'], support: [] });
  return { state, action, ev, team: teamMinutes(ev, action, 'favorable') };
}

/** Plays the walk to the counter on natural dice, from the first campaign whose rolls land it
 * favorable (so the waits validator re-derives every saved sample), and checks live play,
 * traceRun, the waits validator and a reload all took the out branch. */
function walkRunsOut(scenarioId: string, flags: string[] = []) {
  const scenario = getScenario(scenarioId)!;
  let after: GameState | null = null, team = NaN;
  for (let campaign = 1; campaign < 200 && decisionsOf(after?.activeRun?.history).at(-1)?.band !== 'favorable'; campaign++) {
    const measured = measure(scenarioId, flags, campaign);
    team = measured.team;
    after = applyNaturalMove(measured.state, { kind: 'decide', actionId: id('talk', 'to_counter') });
  }
  expect(decisionsOf(after?.activeRun?.history).at(-1)?.band, 'a favorable roll').toBe('favorable');
  const run = after!.activeRun!, decision = decisionsOf(run.history).at(-1)!;
  expect(decision.clockBaseMinutes).toBe(team);
  expect(run.stage, 'the fork read the clock as out').toBe('debrief');
  expect(run.flags).toContain('end:handed_over');
  // The doors the test locked aren't part of the call's own history, so replays don't carry them.
  const own = (list: readonly string[]) => list.filter(flag => !flags.includes(flag));
  expect(own(traceRun(scenario, run).end.flags)).toEqual(own(run.flags));
  expect(validExternalSupportState(run, scenario), 'the waits replay agrees').toBe(true);
  const copy = structuredClone(after!);
  copy.incidents = [];
  delete copy.activeRun!.sourceIncident;
  const back = deserialize(serialize(copy, NOW))!;
  expect(back, 'the save loads').not.toBeNull();
  expect(decisionsOf(back.activeRun!.history).at(-1)!.clockBaseMinutes).toBe(team);
  expect(own(traceRun(scenario, back.activeRun!).end.flags)).toEqual(own(run.flags));
}

describe('a clock fork reads the decision’s full minutes', () => {
  // Measured on a probe clock that never runs out, then a clock tuned to run out between the
  // choice's own work and the whole walk: the old lookahead (work alone) would read it as running.
  const probe = host.compile(template(100, 1));
  const measured = withDraftScenario(probe, sid => measure(sid).team);
  const remaining = Math.round(((WORK + measured) / 2) * 10) / 10;
  const s: ScenarioDefinition = host.compile(template(3 + remaining, 1));

  it('the walk takes the team longer than the work alone, so travel matters here', () => {
    expect(measured, 'travel and clearing on top of the work').toBeGreaterThan(WORK + 0.4);
    expect(remaining).toBeGreaterThan(WORK);
    expect(remaining).toBeLessThan(measured);
  });

  it('travel alone carries the clock past zero inside the decision: the fork reads it out everywhere', () => {
    withDraftScenario(s, sid => {
      const { state, action, ev, team } = measure(sid);
      expect(team).toBe(measured);
      expect(ev.travelMinutes, 'the squad walks in').toBeGreaterThan(0);
      // The old lookahead (the work alone) reads the clock as still running.
      const out = action.outcomes.favorable[0];
      expect(clockConditionsHold(out.clocks, s, state.activeRun!, forkMinutes(action, 'favorable', out))).toBe(false);
      expect(clockConditionsHold(out.clocks, s, state.activeRun!, forkMinutes(action, 'favorable', out, team))).toBe(true);
      walkRunsOut(sid);
    });
  });

  it('forcing a locked door on the way counts too', () => {
    withDraftScenario(s, sid => {
      const open = measure(sid);
      // Lock every door on the walk from the street to the counter.
      const built = buildLocation(s.locationFamilyId, s.locationSeed);
      const way = findStoryRoute(built, built.location.entries[0], s.story!.bindings.people.taker.initial.spaceId, 'walking')!;
      const lockedFlags = way.filter(opening => built.location.openings.find(entry => entry.id === opening)!.type !== 'window').map(opening => `opening:${opening}=locked`);
      expect(lockedFlags.length, 'doors on the way in').toBeGreaterThan(0);
      const locked = measure(sid, lockedFlags);
      expect(locked.team, 'forcing takes longer').toBeGreaterThan(open.team);
      // A clock with just enough for the open walk runs out when the door has to be forced.
      const tight = host.compile(template(3 + Math.round(((open.team + locked.team) / 2) * 10) / 10, 1));
      withDraftScenario({ ...tight, id: `${tight.id}-tight` }, tid => {
        const free = measure(tid);
        expect(free.state.activeRun!.flags.includes('end:handed_over')).toBe(false);
        walkRunsOut(tid, lockedFlags);
      });
    });
  });

  it('one formula: the commit charges the fork’s minutes plus what the outcomes add', () => {
    const action = { awaitSupport: undefined };
    expect(decisionMinutes(teamMinutes({ timeBase: 5, storyMovementMinutes: 2 }, action, 'mixed'), 1, action)).toBe(Math.round((3 * RESOLUTION_TUNING.bandTime.mixed + 1) * 10) / 10);
    expect(decisionMinutes(teamMinutes({ timeBase: 5, storyMovementMinutes: 2 }, action, 'mixed', true), 0, action)).toBe(Math.round(5 * RESOLUTION_TUNING.bandTime.mixed * 10) / 10);
    expect(decisionMinutes(0.1, 0, action)).toBe(0.5);
    expect(decisionMinutes(teamMinutes({ timeBase: 7 }, { awaitSupport: 'ambulance' } as never, 'adverse'), 3, { awaitSupport: 'ambulance' } as never)).toBe(7);
  });
});

describe('the saved team minutes match the live evaluation', () => {
  it('on sampled plays of every shipping call, each committed decision saved the minutes its evaluation computed', () => {
    let checked = 0;
    for (const tree of Object.values(CALL_TREES)) for (const { scenarioId, seed } of drawCalls(tree!, 3, 12)) for (const policy of POLICIES.slice(0, 2)) {
      playToEnd(scenarioId, policy, seed, { onStep: ({ before, choice, after }) => {
        const run = before.activeRun!, scenario = getScenario(run.scenarioId)!;
        const action = scenario.stages[run.stage as StageId].actions.find(entry => entry.id === choice.id)!;
        const decision = decisionsOf(after.activeRun!.history).at(-1)!;
        const ev = evaluateAction({ state: before, run, scenario, action, built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting: decision.actingSquadIds, support: decision.supportSquadIds });
        expect(decision.clockBaseMinutes, `${scenarioId} ${choice.id}`).toBe(teamMinutes(ev, action, decision.band));
        checked++;
      } });
    }
    expect(checked).toBeGreaterThan(50);
  });
});

/** What the fork still leaves out: a walk by a person the outcome moves, and another outcome's extra
 * minutes. Counts the decisions where that difference flips a clock from running to out. */
function residualFlips(policies = POLICIES, calls = 4): { decisions: number; withClockFork: number; flipped: number } {
  const tally = { decisions: 0, withClockFork: 0, flipped: 0 };
  for (const tree of Object.values(CALL_TREES)) for (const { scenarioId, seed } of drawCalls(tree!, 3, calls)) for (const policy of policies) {
    playToEnd(scenarioId, policy, seed, { onStep: ({ before, after }) => {
      tally.decisions++;
      const run = before.activeRun!, scenario = getScenario(run.scenarioId)!;
      const decision = decisionsOf(after.activeRun!.history).at(-1)!;
      const action = scenario.stages[run.stage as StageId].actions.find(entry => entry.id === decision.actionId)!;
      const forks = action.outcomes[decision.band].filter(effect => effect.clocks?.length);
      if (!forks.length || !run.clocks) return;
      tally.withClockFork++;
      const flips = forks.some(effect => (scenario.clocks ?? []).some(def => {
        const state = run.clocks![def.id];
        if (!state) return false;
        const read = stepClock(def, state, forkMinutes(action, decision.band, effect, decision.clockBaseMinutes), run.flags).value <= 0;
        const ran = stepClock(def, state, decision.timeCost, run.flags).value <= 0;
        return ran && !read;
      }));
      if (flips) tally.flipped++;
    } });
  }
  return tally;
}

describe('what the fork still leaves out', () => {
  // Measured at 60 calls a tree under every policy: 3,272 decisions, 572 on a clock fork, none
  // flipped. A tripwire at a smaller sample: if content starts walking people or stacking extras
  // across a fork's edge, it's time for the fixed point.
  it('a walk or another outcome’s extra minutes rarely carries a clock out after a fork read it running', () => {
    const tally = residualFlips(POLICIES, 6);
    // A shipping call with no clock fork leaves the tripwire nothing to watch.
    const forking = Object.values(CALL_TREES).some(tree => tree!.nodes.some(node => node.choices.some(choice =>
      (['favorable', 'mixed', 'adverse'] as const).some(band => choice.outcomes[band].some(outcome => ([] as unknown[]).concat(outcome.if ?? []).some(entry => typeof entry === 'object' && entry !== null && 'clock' in entry))))));
    if (!forking) { expect(tally.withClockFork).toBe(0); return; }
    expect(tally.withClockFork, 'decisions with a clock fork').toBeGreaterThan(30);
    expect(tally.flipped / tally.withClockFork, JSON.stringify(tally)).toBeLessThan(0.01);
  }, 120_000);
});
