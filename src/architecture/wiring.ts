// What moves the odds. Each probe changes one input a system feeds into a call and measures, over
// decision points sampled through several calls of every call tree, how many choices respond in the
// expected direction. A choice counts only when it is offered and eligible both before and after;
// eligibility flips are reported apart, never as a response. A live probe must keep its measured
// share, move nothing the wrong way, and (where marked) respond on every tree. A gap probe must stay
// at zero, so the day a gap is wired the test fails and asks for the entry to be promoted.
// Test support.
import { CALL_TREES } from '../content/call-trees';
import { applyMove, startGateRun } from '../gen/incident/gates/engine-driver';
import { drawCalls, playToEnd } from '../gen/incident/trees-v13/balance';
import { getScenario } from '../sim/scenario-registry';
import { generateIncident } from '../gen/incident';
import { hashSeed } from '../sim/rng';
import { buildLocation } from '../sim/location';
import { openingFlag } from '../sim/resolution';
import { actionViews } from '../sim/operation-selectors';
import { NOW } from '../sim/test-fixtures';
import type { GameState, RatingKey } from '../sim/types';
import type { CheckKind } from '../sim/scenario-types';
import type { System } from './manifest';

export interface Probe {
  id: string;
  system: System;
  input: string;
  /** Changes one input on a sampled decision point. `restart` re-starts the call (by default the
   * same one) with other options; probes that use it are measured on openings only. */
  perturb: (state: GameState, restart: (opts?: Parameters<typeof startGateRun>[2], scenarioId?: string) => GameState) => GameState;
  openingOnly?: boolean;
  /** Which way a responsive choice's favorable chance must move. */
  direction: 'up' | 'down' | 'any';
  status: 'live' | 'gap';
  /** Live: the least share of sampled eligible choices that must respond. Set to the measured share,
   * so wiring can only grow: raise it when more choices respond. */
  minShare: number;
  /** Live: every call tree must have at least one responsive choice. */
  everyTree?: boolean;
  /** Only choices of these check kinds count: the input reaches no other kind by design, so a menu
   * that adds a look or a move doesn't read as lost wiring. */
  kinds?: readonly CheckKind[];
  /** Gap: what is missing and where it was found. */
  gap?: string;
  evidence: string;
}

const RATING_KEYS: readonly RatingKey[] = ['shooting', 'composure', 'communication', 'awareness', 'medical', 'coordination'];
const squadOfficers = (state: GameState) => state.squads.find(squad => squad.id === 'A')!.officerIds.map(id => state.officers[id]);
const edit = (state: GameState, fn: (draft: GameState) => void) => { const draft = structuredClone(state); fn(draft); return draft; };

/** The same call (type, situation, turns, pacing, cast) hosted on another building of its type:
 * the drawn spec with another building seed. Null when no other seed gives a different building. */
export function onAnotherBuilding(scenarioId: string): string | null {
  const s = getScenario(scenarioId)!;
  for (let k = 1; k <= 8; k++) {
    try {
      const other = generateIncident({ ...s.incident!, buildingSeed: hashSeed(`${s.incident!.buildingSeed}:another-building:${k}`) });
      if (other.locationSeed !== s.locationSeed || other.locationFamilyId !== s.locationFamilyId) return other.id;
    } catch { /* this seed can't host the call; try the next */ }
  }
  return null;
}

/** Measured 2026-10-18 (6 of 33 opening choices); floors only rise. */
const MIN_BUILDING_SHARE = 0.18;
/** Share of opening choices whose travel changes on another building, measured 2026-10-18 (6 of 33). */
export const MIN_BUILDING_TRAVEL_SHARE = 0.18;

export const WIRING: readonly Probe[] = [
  {
    id: 'officer-ratings', system: 'officer', input: 'Officer ratings (every rating of squad A at 95 instead of 60)', direction: 'up', status: 'live', minShare: 1, everyTree: true,
    perturb: state => edit(state, draft => { for (const officer of squadOfficers(draft)) for (const key of RATING_KEYS) officer.ratings[key] = 95; }),
    evidence: '`aptitude` weights each rating per task (src/sim/resolution.ts); the task-weight test checks each choice reads only its own ratings',
  },
  {
    id: 'officer-stress', system: 'officer', input: 'Officer strain (squad A at stress 90)', direction: 'down', status: 'live', minShare: 1, everyTree: true,
    perturb: state => edit(state, draft => { for (const officer of squadOfficers(draft)) officer.stress = 90; }),
    evidence: '`conditionFraction` takes strain off each rating (src/sim/officer.ts)',
  },
  {
    id: 'officer-certs', system: 'officer', input: 'Certificates (squad A holds none)', direction: 'down', status: 'live', minShare: 0.086,
    perturb: state => edit(state, draft => { for (const officer of squadOfficers(draft)) officer.certs = []; }),
    evidence: 'A choice with a certBonus credits the first officer taking part who holds it (src/sim/resolution.ts): a crisis negotiator on the talk, an advanced first aider on care, a surveillance specialist on a watch (owner 2026-10-20: the certificates finally matter). Measured 2026-10-20: 10 of 115 sampled choices, all hostage; the legacy trees carry none yet.',
  },
  {
    id: 'items-none', system: 'item', input: 'Carried equipment (squad A deploys with nothing)', direction: 'down', status: 'live', minShare: 0.2, openingOnly: true,
    perturb: (_state, restart) => restart({ items: [] }),
    evidence: 'A choice gets the gear its physical act asks for (src/gen/incident/action-gear.ts): a shield when the team goes in, the hailer for a voice through the walls, observation aids for a watch from outside, plus any gear the choice authors. Phone calls, texts, waits and walk-outs ask nothing of carried gear, and radios are standard issue, so neither responds. Measured 2026-10-18: 6 of 30 opening choices.',
  },
  {
    id: 'blueprint-locked', system: 'blueprint', input: 'Door and window states (every opening locked)', direction: 'any', status: 'live', minShare: 0.27,
    perturb: state => edit(state, draft => {
      const run = draft.activeRun!;
      const built = buildLocation(run.locationFamilyId, run.locationSeed);
      run.flags = [...run.flags, ...built.location.openings.map(opening => openingFlag(opening.id, 'locked'))];
    }),
    evidence: 'A choice that moves the team (TreeTeam: into a room, to a vantage, an escort) or walks someone out routes through the building, so a locked door costs force time or the entry tool (src/gen/incident/trees-v13/compile.ts). Phone calls, waits and a voice through a door that was already shut never respond, and should not.',
  },
  {
    id: 'blueprint-building', system: 'blueprint', input: 'The building (the same call on another building of its type)', direction: 'any', status: 'live', minShare: MIN_BUILDING_SHARE, openingOnly: true,
    perturb: (state, restart) => restart(undefined, onAnotherBuilding(state.activeRun!.scenarioId) ?? state.activeRun!.scenarioId),
    evidence: 'Routes, doors, room sizes, how far the subject stands from a door and what a sightline reads all come from the generated building (src/sim/resolution.ts), and a sightline fact is settled by it (src/sim/spatial-factors.ts sightFromStreet).',
  },
  {
    id: 'subject-armament', system: 'subject', input: 'The subject\'s weapon (the reported weapon disproved)', direction: 'up', status: 'live', minShare: 0.83,
    perturb: state => edit(state, draft => {
      const scenario = getScenario(draft.activeRun!.scenarioId)!;
      for (const person of scenario.incidentPeople ?? []) if (person.armamentFactId) draft.activeRun!.knowledge[person.armamentFactId] = 'disproved';
    }),
    evidence: '`incidentSubjects` reads armament knowledge into `threatFx` (src/sim/incident-factors.ts), group members included: their weapon fact claims anything at all, so disproving it reads them unarmed (`armamentClaim`). The rescue tree has no armed person on scene, so it never responds.',
  },
  {
    id: 'intel-confirmed', system: 'subject', input: 'What the team has confirmed (every person\'s weapon and location settled to the truth)', direction: 'up', status: 'live', minShare: 0.82,
    perturb: state => edit(state, draft => {
      const scenario = getScenario(draft.activeRun!.scenarioId)!;
      const facts = new Map(scenario.facts.map(fact => [fact.id, fact]));
      for (const person of scenario.incidentPeople ?? []) for (const id of [person.armamentFactId, person.locationFactId]) {
        const fact = id ? facts.get(id) : undefined;
        if (fact) draft.activeRun!.knowledge[fact.id] = fact.truth ? 'confirmed' : 'disproved';
      }
    }),
    evidence: 'A weapon held only on report costs a share of the threat on top (THREAT_TUNING.unconfirmed, src/sim/threat.ts), and an entry or a look into a room goes better once the team has seen where the armed person in it is (INTEL_V1.knownPosition, src/sim/incident-factors.ts). Confirming either takes the cost off or adds the credit. Measured 2026-10-18: 97 of 117 sampled choices.',
  },
  {
    id: 'reputation-lean', system: 'metric', input: 'Department reputation (a full name for going in hard)', direction: 'any', status: 'live', minShare: 1, everyTree: true, kinds: ['contact', 'pressure', 'execution'],
    perturb: state => edit(state, draft => { draft.department.reputation = { lean: 1, choices: 100 }; }),
    evidence: '`reputationContributor` adds a named line to contact and pressure checks (people have heard of the department) and to execution checks (the team has drilled it), capped at REPUTATION_TUNING.maxPoints (src/sim/reputation.ts). Observation, medical and coordination checks never respond, so the probe counts only the kinds it reaches. Measured 2026-10-20: 96 of 96 sampled contact, pressure and execution choices, every tree.',
  },
  {
    id: 'officer-traits', system: 'officer', input: 'Officer traits (squad A all calm voices)', direction: 'up', status: 'live', minShare: 1, kinds: ['contact'],
    perturb: state => edit(state, draft => { for (const officer of squadOfficers(draft)) officer.traits = ['calm_voice']; }),
    evidence: 'Trait effects are data (src/content/traits.ts TRAIT_EFFECTS), each with its condition; the resolver names every one that holds (src/sim/resolution.ts). A calm voice reaches contact checks only, and a choice can favor it on top (ActionDefinition.favors).',
  },
  {
    id: 'officer-role', system: 'officer', input: 'Officer role (squad A all negotiators by training)', direction: 'up', status: 'live', minShare: 0.9, kinds: ['contact'],
    perturb: state => edit(state, draft => { for (const officer of squadOfficers(draft)) officer.role = 'comms'; }),
    evidence: 'ROLE_CHECKS (src/content/traits.ts): a seat trained for the check adds a small named line. Officers already in that role don\'t move, so the floor sits below 1. Measured 2026-10-21: 18 of 18 on Going Live.',
  },
  {
    id: 'officer-history', system: 'officer', input: 'Calls like this one worked before (squad A, four each)', direction: 'up', status: 'live', minShare: 1, everyTree: true,
    perturb: state => edit(state, draft => {
      const type = getScenario(draft.activeRun!.scenarioId)!.incident!.type;
      for (const officer of squadOfficers(draft)) officer.career.byType = { ...officer.career.byType, [type]: 4 };
    }),
    evidence: 'Officer.career.byType counts each type at debrief (src/sim/operation.ts); the resolver credits it as familiarity, capped (TYPE_HISTORY, src/content/traits.ts).',
  },
  {
    id: 'source-pull', system: 'scenario', input: 'Pressure sources (every source nearly full, its first cue heard)', direction: 'down', status: 'live', minShare: 1, kinds: ['contact', 'pressure', 'coordination', 'execution'],
    perturb: state => edit(state, draft => {
      const scenario = getScenario(draft.activeRun!.scenarioId)!;
      for (const def of scenario.clocks ?? []) if (def.source?.odds && draft.activeRun!.clocks?.[def.id]) draft.activeRun!.clocks[def.id] = { value: 95, cued: Math.max(1, draft.activeRun!.clocks[def.id].cued) };
    }),
    evidence: 'PressureSource.odds (src/sim/pressure-sources.ts sourceOdds): a source whose first cue is heard takes points off the checks it weighs on, named with its count. In Going Live the stream weighs on contact, pressure and coordination.',
  },
  {
    id: 'funding-balance', system: 'metric', input: 'Funding (the department ten million richer)', direction: 'any', status: 'gap', minShare: 0,
    perturb: state => edit(state, draft => { draft.department.funding += 10_000_000; }),
    gap: 'By design, never wired (docs/player-profile.md): money changes the odds only through what it buys, the kit and the people, never directly. This probe must stay at zero.',
    evidence: 'The resolver never reads Department.funding or the ledger (src/sim/resolution.ts).',
  },
  {
    id: 'metric-pressure', system: 'scenario', input: 'Time pressure on the call (pressure 95)', direction: 'down', status: 'live', minShare: 1, everyTree: true,
    perturb: state => edit(state, draft => { draft.activeRun!.pressure = 95; }),
    evidence: 'Pressure penalty scaled by composure (src/sim/resolution.ts)',
  },
];

/** Calls sampled per tree, and the tier they are drawn at. */
export const CALLS_PER_TREE = 3;
const TIER = 3;

/** Squad A at rating 60, stress 0 and the run at pressure 0, so chances sit inside the curve and not
 * on its 3% or 96% stops, and composure's pressure shield is out of play. */
export const baseline = (state: GameState) => edit(state, draft => {
  for (const officer of squadOfficers(draft)) { for (const key of RATING_KEYS) officer.ratings[key] = 60; officer.stress = 0; }
  if (draft.activeRun) draft.activeRun.pressure = 0;
});

export interface Point { type: string; scenarioId: string; opening: boolean; state: GameState }

/** Decision points: the opening and every later point a random play reaches, per sampled call. */
export function samplePoints(): Point[] {
  const points: Point[] = [];
  for (const tree of Object.values(CALL_TREES)) {
    for (const [index, { scenarioId }] of drawCalls(tree!, TIER, CALLS_PER_TREE).entries()) {
      const start = startGateRun(scenarioId);
      points.push({ type: tree!.type, scenarioId, opening: true, state: start });
      playToEnd(scenarioId, 'random', 100 + index, { start, onStep: step => { points.push({ type: tree!.type, scenarioId, opening: false, state: step.after }); } });
    }
  }
  return points.filter(point => point.state.activeRun?.status === 'active' && point.state.activeRun.stage !== 'debrief');
}

export interface ProbeResult { probe: Probe; choices: number; moved: number; wrong: string[]; flips: number; share: number; byTree: Record<string, { choices: number; moved: number }> }

type Odds = Map<string, { eligible: boolean; favorable: number }>;
const odds = (state: GameState): Odds => new Map(actionViews(state, NOW, 'A').map(view => [view.id, { eligible: view.eligible, favorable: view.likelihood.favorable }]));
const EPS = 0.005;

export function measureWiring(probes: readonly Probe[] = WIRING, points: readonly Point[] = samplePoints()): ProbeResult[] {
  return probes.map(probe => {
    const byTree: ProbeResult['byTree'] = {};
    const wrong: string[] = [];
    let flips = 0;
    for (const point of points.filter(p => !probe.openingOnly || p.opening)) {
      const base = baseline(point.state);
      const restart = (opts?: Parameters<typeof startGateRun>[2], scenarioId = point.scenarioId) => baseline(startGateRun(scenarioId, 719, opts));
      const before = odds(base), after = odds(probe.perturb(base, restart));
      const tree = (byTree[point.type] ??= { choices: 0, moved: 0 });
      const kindOf = probe.kinds ? new Map(Object.values(getScenario(point.scenarioId)!.stages).flatMap(stage => stage.actions).map(action => [action.id, action.check.kind])) : null;
      for (const [id, b] of before) {
        const a = after.get(id);
        if (!b.eligible) continue;
        if (kindOf && !probe.kinds!.includes(kindOf.get(id)!)) continue;
        if (!a || !a.eligible) { flips++; continue; }
        tree.choices++;
        const delta = a.favorable - b.favorable;
        if (Math.abs(delta) <= EPS) continue;
        const right = probe.direction === 'any' || (probe.direction === 'up' ? delta > 0 : delta < 0);
        if (right) tree.moved++; else wrong.push(`${id} ${b.favorable.toFixed(3)} -> ${a.favorable.toFixed(3)}`);
      }
    }
    const choices = Object.values(byTree).reduce((n, t) => n + t.choices, 0);
    const moved = Object.values(byTree).reduce((n, t) => n + t.moved, 0);
    return { probe, choices, moved, wrong, flips, share: choices ? moved / choices : 0, byTree };
  });
}

/** Each eligible choice, raised only on the ratings its check weights, must get likelier; raised
 * only on the ratings it does not weight, must not change. Returns the violations. */
export function taskWeightViolations(points: readonly Point[] = samplePoints()): { checked: number; violations: string[] } {
  const violations: string[] = [];
  let checked = 0;
  for (const point of points) {
    const base = baseline(point.state);
    const run = base.activeRun!;
    const stage = run.stage;
    if (stage === 'debrief') continue;
    const scenario = getScenario(run.scenarioId)!;
    const before = odds(base);
    for (const action of scenario.stages[stage].actions) {
      const b = before.get(action.id);
      if (!b?.eligible || !action.check.ratings.length) continue;
      const weighted = new Set(action.check.ratings.filter(r => r.weight > 0).map(r => r.key));
      const raise = (keys: (key: RatingKey) => boolean) => odds(edit(base, draft => { for (const officer of squadOfficers(draft)) for (const key of RATING_KEYS) if (keys(key)) officer.ratings[key] = 95; })).get(action.id);
      const own = raise(key => weighted.has(key)), other = raise(key => !weighted.has(key));
      checked++;
      if (!own?.eligible || own.favorable <= b.favorable + EPS) violations.push(`${action.id}: its own ratings (${[...weighted].join(', ')}) did not raise it (${b.favorable.toFixed(3)} -> ${own?.favorable.toFixed(3)})`);
      if (other?.eligible && Math.abs(other.favorable - b.favorable) > EPS) violations.push(`${action.id}: ratings it does not weight moved it (${b.favorable.toFixed(3)} -> ${other.favorable.toFixed(3)})`);
    }
  }
  return { checked, violations };
}

/** On the opening of each sampled call, how many eligible choices take a different time moving
 * through the building when the same call is hosted on another building (onAnotherBuilding). */
export function buildingTravelChanges(points: readonly Point[] = samplePoints()): { checked: number; changed: number; byTree: Record<string, number> } {
  let checked = 0, changed = 0;
  const byTree: Record<string, number> = {};
  for (const point of points.filter(p => p.opening)) {
    const other = onAnotherBuilding(point.scenarioId);
    if (!other) continue;
    const travel = (state: GameState) => new Map(actionViews(baseline(state), NOW, 'A').filter(view => view.eligible).map(view => [view.id, view.travelMinutes]));
    const before = travel(point.state), after = travel(startGateRun(other, 719));
    for (const [id, minutes] of before) {
      const next = after.get(id);
      if (next === undefined) continue;
      checked++;
      if (Math.abs(next - minutes) > 0.05) { changed++; byTree[point.type] = (byTree[point.type] ?? 0) + 1; }
    }
  }
  return { checked, changed, byTree };
}

/** Share of sampled observing choices whose favorable result settles where someone is, measured
 * 2026-10-18 (15 of 15: barricade 1, armed 11, rescue 3). A floor: it may only rise. */
export const MIN_SIGHTING_SHARE = 1;

/** What being there teaches the team (sim/sightings.ts). At every sampled point, each eligible
 * choice is committed on a favorable result: a choice that observes a room (ActionDefinition.
 * observes) counts when it settles where someone is, and a choice that observes nothing must
 * never settle anyone's location, since no authored outcome does. So `observes` can't go silently
 * dead: if the engine stopped reading it, no observing choice would respond. */
export function sightingsWiring(points: readonly Point[] = samplePoints()): { choices: number; moved: number; wrong: string[]; byTree: Record<string, { choices: number; moved: number }> } {
  const byTree: Record<string, { choices: number; moved: number }> = {};
  const wrong: string[] = [];
  for (const point of points) {
    const run = point.state.activeRun!;
    const scenario = getScenario(run.scenarioId)!;
    const located = new Set((scenario.incidentPeople ?? []).flatMap(person => person.locationFactId ? [person.locationFactId] : []));
    const views = actionViews(point.state, NOW, 'A');
    const tree = (byTree[point.type] ??= { choices: 0, moved: 0 });
    for (const action of scenario.stages[run.stage as keyof typeof scenario.stages]?.actions ?? []) {
      if (!views.some(view => view.id === action.id && view.eligible)) continue;
      const after = applyMove(point.state, { kind: 'decide', actionId: action.id, band: 'favorable' }, views);
      if (!after) continue;
      const learned = (after.activeRun?.history.at(-1)?.knowledgeChanges ?? []).filter(change => located.has(change.factId));
      if (action.observes?.length) { tree.choices++; if (learned.length) tree.moved++; }
      else if (learned.length) wrong.push(`${action.id} settled ${learned.map(change => change.factId).join(', ')} without observing a room`);
    }
  }
  const choices = Object.values(byTree).reduce((n, t) => n + t.choices, 0);
  const moved = Object.values(byTree).reduce((n, t) => n + t.moved, 0);
  return { choices, moved, wrong, byTree };
}
