import { describe, expect, it } from 'vitest';
import { drawIncidentSpec, generateIncident } from '../gen/incident';
import { applyMove, availableMoves, NOW, startGateRun } from '../gen/incident/gates/engine-driver';
import { actionViews } from './operation-selectors';
import type { GameState } from './types';
import { buildLocation } from './location';
import { evaluateAction } from './resolution';
import { INCIDENT_CLASS_V1, incidentClass, incidentFactors } from './incident-factors';
import { applyMoves } from './meters';
import { THREAT_TUNING } from './threat';
import { withTuning } from './tuning';
import type { IncidentPersonDef } from './scenario-types';
import type { ScenarioDefinition } from './scenario-types';
import type { IncidentType } from './scenario-types';

// M2 sensitivity gate (docs/incident-domain-model.md): the same action on the same call, with one
// thing about the people or the building changed, gets different odds, for a labelled reason.

function calls(type: IncidentType, n: number, seed = 5150): ScenarioDefinition[] {
  const out: ScenarioDefinition[] = [];
  let state = seed;
  for (let i = 0; i < n; i++) {
    const drawn = drawIncidentSpec(state, { level: 10, trust: 90, unlockedTypes: [type] });
    state = drawn.state;
    out.push(generateIncident(drawn.spec));
  }
  return out;
}

function odds(s: ScenarioDefinition, actionSuffix: string, change: (scenario: ScenarioDefinition, knowledge: Record<string, string>, flags: string[]) => void = () => {}) {
  const state = startGateRun(s.id, 719);
  const run = structuredClone(state.activeRun!);
  const scenario = structuredClone(s);
  change(scenario, run.knowledge as Record<string, string>, run.flags);
  const action = Object.values(scenario.stages).flatMap(stage => stage.actions).find(entry => entry.id.endsWith(actionSuffix))!;
  const ev = evaluateAction({ state, run, scenario, action, built: buildLocation(scenario.locationFamilyId, scenario.locationSeed), acting: ['A'], support: [] });
  return { p: ev.pFavorable, labels: ev.contributors.map(c => c.label) };
}

describe('incident factors: the people and the building change the odds', () => {
  const armed = calls('active_armed_incident', 40);
  const covered = armed.find(s => s.incidentPeople?.some(person => person.cover))!;

  it('cover between an armed subject and the door makes an entry harder', () => {
    expect(covered, 'a drawn armed call with cover').toBeDefined();
    const withCover = odds(covered, '_shots_go_now');
    const without = odds(covered, '_shots_go_now', scenario => { for (const person of scenario.incidentPeople!) delete person.cover; });
    expect(withCover.p).toBeLessThan(without.p);
    expect(withCover.labels.some(label => /for cover|to hide behind/.test(label))).toBe(true);
  });

  it('a weapon the team knows about weighs more than an unknown one, and a revealed temper changes talk', () => {
    const s = armed[0];
    const subject = s.incidentPeople!.find(person => person.threat)!;
    const reported = odds(s, '_shots_go_now');
    const unknown = odds(s, '_shots_go_now', (_, knowledge) => { knowledge[subject.armamentFactId!] = 'unknown'; });
    expect(unknown.p).not.toBe(reported.p);
    const hostage = calls('hostage_crisis', 12).find(entry => entry.incidentPeople?.some(person => person.threat?.disposition === 'hostile' && person.dispositionFactId))!;
    const taker = hostage.incidentPeople!.find(person => person.threat)!;
    const hidden = odds(hostage, '_offer_ask_both');
    const revealed = odds(hostage, '_offer_ask_both', (_, knowledge) => { knowledge[taker.dispositionFactId!] = 'confirmed'; });
    expect(revealed.p).toBeLessThan(hidden.p);
  });

  it('a subject with the team no longer weighs on the odds', () => {
    const s = armed[1];
    const subject = s.incidentPeople!.find(person => person.threat)!;
    const inside = odds(s, '_shots_go_now');
    const out = odds(s, '_shots_go_now', (_, __, flags) => { flags.push(`out:${subject.id}`); });
    expect(out.p).toBeGreaterThan(inside.p);
  });

  it('waiting helps against a barricade and costs against someone seeking a victim', () => {
    const labelsOf = (s: ScenarioDefinition) => {
      const state = startGateRun(s.id, 719);
      const wait = Object.values(s.stages).flatMap(stage => stage.actions).find(action => action.icon === 'wait')!;
      const fx = incidentFactors(s, buildLocation(s.locationFamilyId, s.locationSeed), state.activeRun!, wait, []);
      return fx!.score.map(c => `${c.label} ${c.value}`);
    };
    expect(labelsOf(calls('barricaded', 1)[0]).some(label => /waiting is safe/.test(label) && / 4$/.test(label))).toBe(true);
    expect(labelsOf(armed[2]).some(label => /may hurt someone/.test(label) && / -5$/.test(label))).toBe(true);
  });

  it('carries the threat rules\' strain and time multipliers into the evaluation', () => {
    type Action = ScenarioDefinition['stages'][keyof ScenarioDefinition['stages']]['actions'][number];
    const evaluate = (s: ScenarioDefinition, pick: (action: Action) => boolean, change: (scenario: ScenarioDefinition) => void = () => {}) => {
      const state = startGateRun(s.id, 719);
      const scenario = structuredClone(s);
      change(scenario);
      // The first stage that offers a matching choice, with the run standing on it.
      const [stage, action] = Object.entries(scenario.stages).flatMap(([id, entry]) => entry.actions.filter(pick).map(found => [id, found] as const))[0];
      const run = { ...state.activeRun!, stage: stage as keyof ScenarioDefinition['stages'] };
      const built = buildLocation(scenario.locationFamilyId, scenario.locationSeed);
      const fx = incidentFactors(scenario, built, run, action, [])!;
      return { fx, ev: () => evaluateAction({ state, run, scenario, action, built, acting: ['A'], support: [] }) };
    };
    // An armed subject near the work: the officers taking part carry more strain; unarmed, none.
    const armedCall = armed[0];
    const near = (action: Action) => action.check.kind === 'execution' || Boolean(action.entry) || action.check.kind === 'contact';
    const withArms = evaluate(armedCall, near);
    const disarmed = evaluate(armedCall, near, scenario => { for (const person of scenario.incidentPeople!) if (person.threat) person.threat.armament = 'none'; });
    expect(withArms.fx.strainMult).toBeGreaterThan(1);
    expect(disarmed.fx.strainMult).toBe(1);
    expect(withArms.ev().exposureMult / disarmed.ev().exposureMult).toBeCloseTo(withArms.fx.strainMult, 5);
    // Waiting out a barricade: the wait takes longer, and the card says so. Play the call until a
    // wait is on offer, then evaluate it there.
    const barricade = calls('barricaded', 1)[0];
    const isWait = (id: string) => Object.values(barricade.stages).flatMap(stage => stage.actions).find(action => action.id === id)?.icon === 'wait';
    let frontier = [startGateRun(barricade.id, 719)], at: GameState | null = null;
    for (let depth = 0; depth < 5 && !at; depth++) {
      at = frontier.find(state => actionViews(state, NOW, 'A').some(view => view.eligible && isWait(view.id))) ?? null;
      frontier = frontier.flatMap(state => availableMoves(state).filter(move => move.band === 'favorable').map(move => applyMove(state, move)).filter((next): next is GameState => !!next)).slice(0, 40);
    }
    expect(at, 'a reachable wait on the barricade call').not.toBeNull();
    const run = at!.activeRun!;
    const waitAction = barricade.stages[run.stage as keyof ScenarioDefinition['stages']].actions.find(action => isWait(action.id) && actionViews(at!, NOW, 'A').some(view => view.id === action.id && view.eligible))!;
    const built = buildLocation(barricade.locationFamilyId, barricade.locationSeed);
    expect(incidentFactors(barricade, built, run, waitAction, [])!.timeMult).toBe(THREAT_TUNING.barricadeSlow);
    const evaluateWait = () => evaluateAction({ state: at!, run, scenario: barricade, action: waitAction, built, acting: ['A'], support: [] });
    const slow = evaluateWait(), plain = withTuning({ THREAT_TUNING: { barricadeSlow: 1 } }, evaluateWait);
    expect(slow.timeBase).toBeGreaterThan(plain.timeBase);
    expect(slow.details.some(line => /Waiting out a barricade is slow/.test(line))).toBe(true);
  });
});

// M2 slice 5 (docs/incident-domain-model.md §1): the incident class weights time and temper. The
// same barricade call, with the trapped child held by the subject: over the subject's grievance (a
// victim incident) or as leverage (a hostage incident).
describe('incident factors: the incident class', () => {
  const s = calls('barricaded', 1, 77)[0];
  const subject = s.incidentPeople!.find(person => person.meters)!;
  const heldId = s.incidentPeople!.find(person => person.id !== subject.id)!.id;
  const hold = (kind: NonNullable<IncidentPersonDef['hold']>['kind'] | null) => (scenario: ScenarioDefinition) => {
    const held = scenario.incidentPeople!.find(person => person.id === heldId)!;
    if (kind) held.hold = { by: subject.id, kind }; else delete held.hold;
  };
  function evaluate(actionSuffix: string, patch: (scenario: ScenarioDefinition) => void, events: ('provoked' | 'heard')[] = [], flags: string[] = []) {
    const state = startGateRun(s.id, 719);
    const run = structuredClone(state.activeRun!);
    const scenario = structuredClone(s);
    patch(scenario);
    // At the node where the subject is on the line: its choices are the ones being weighed.
    run.flags = ['tree:started', 'at:on_the_line', ...flags];
    applyMoves(run, scenario, events.map(event => ({ moves: [{ personId: subject.id, event }] })));
    const action = Object.values(scenario.stages).flatMap(stage => stage.actions).find(entry => entry.id.endsWith(actionSuffix))!;
    const ev = evaluateAction({ state, run, scenario, action, built: buildLocation(scenario.locationFamilyId, scenario.locationSeed), acting: ['A'], support: [] });
    return { p: ev.pFavorable, contributors: ev.contributors };
  }
  const value = (contributors: { label: string; value: number }[], match: RegExp) => contributors.find(c => match.test(c.label))?.value;

  it('derives the class from who is still held, never from the call', () => {
    const scenario = structuredClone(s);
    hold('expressive')(scenario);
    expect(incidentClass(scenario, { flags: [] })?.key).toBe('victim');
    hold('incidental')(scenario);
    expect(incidentClass(scenario, { flags: [] })?.key).toBe('hostage');
    hold('expressive')(scenario);
    expect(incidentClass(scenario, { flags: [`safe:${heldId}`] })).toBeNull();
    hold(null)(scenario);
    expect(incidentClass(scenario, { flags: [] })).toBeNull();
  });

  it('waiting gives less when someone is held over the subject’s grievance, as one labelled contributor', () => {
    const victim = evaluate('_let_him_talk', hold('expressive'));
    const hostage = evaluate('_let_him_talk', hold('instrumental'));
    const nobody = evaluate('_let_him_talk', hold(null));
    expect(victim.p).toBeLessThan(hostage.p);
    expect(hostage.p).toBe(nobody.p);
    expect(value(victim.contributors, /^Waiting while .+ is the one .+ blames$/)).toBe(INCIDENT_CLASS_V1.victim.waiting);
    expect(value(hostage.contributors, /^Waiting while/)).toBeUndefined();
    // The held person out of the building: waiting weighs as it does with nobody held.
    expect(evaluate('_let_him_talk', hold('expressive'), [], [`safe:${heldId}`, `out:${heldId}`]).p).toBe(nobody.p);
  });

  it('provoking the person who holds them costs more; calming them is weighed the same', () => {
    const worked = /is more worked up now/;
    const victim = evaluate('_honest_no', hold('expressive'), ['provoked', 'provoked']);
    const hostage = evaluate('_honest_no', hold('instrumental'), ['provoked', 'provoked']);
    expect(victim.p).toBeLessThan(hostage.p);
    expect(value(victim.contributors, worked)).toBe(Math.round(value(hostage.contributors, worked)! * INCIDENT_CLASS_V1.victim.agitation * 10) / 10);
    expect(victim.contributors.some(c => worked.test(c.label) && c.label.endsWith(`and blames ${s.incidentPeople!.find(person => person.id === heldId)!.label}`))).toBe(true);
    // Choices that only hear the subject out are not provocation: no scale.
    const calmVictim = evaluate('_honest_no', hold('expressive'), ['heard', 'heard']);
    const calmHostage = evaluate('_honest_no', hold('instrumental'), ['heard', 'heard']);
    expect(calmVictim.p).toBe(calmHostage.p);
  });
});
