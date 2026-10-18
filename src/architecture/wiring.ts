// What moves the odds. Each probe changes one input a system feeds into a call and measures, over
// decision points sampled through several calls of every call tree, how many choices respond in the
// expected direction. A choice counts only when it is offered and eligible both before and after;
// eligibility flips are reported apart, never as a response. A live probe must keep its measured
// share, move nothing the wrong way, and (where marked) respond on every tree. A gap probe must stay
// at zero, so the day a gap is wired the test fails and asks for the entry to be promoted.
// Test support.
import { CALL_TREES } from '../content/call-trees';
import { startGateRun } from '../gen/incident/gates/engine-driver';
import { drawCalls, playToEnd } from '../gen/incident/trees-v13/balance';
import { getScenario } from '../sim/scenario-registry';
import { buildLocation } from '../sim/location';
import { openingFlag } from '../sim/resolution';
import { actionViews } from '../sim/operation-selectors';
import { NOW } from '../sim/test-fixtures';
import type { GameState, RatingKey } from '../sim/types';
import type { System } from './manifest';

export interface Probe {
  id: string;
  system: System;
  input: string;
  /** Changes one input on a sampled decision point. `restart` re-starts the same call with other
   * options; probes that use it are measured on openings only. */
  perturb: (state: GameState, restart: (opts?: Parameters<typeof startGateRun>[2]) => GameState) => GameState;
  openingOnly?: boolean;
  /** Which way a responsive choice's favorable chance must move. */
  direction: 'up' | 'down' | 'any';
  status: 'live' | 'gap';
  /** Live: the least share of sampled eligible choices that must respond. Set to the measured share,
   * so wiring can only grow: raise it when more choices respond. */
  minShare: number;
  /** Live: every call tree must have at least one responsive choice. */
  everyTree?: boolean;
  /** Gap: what is missing and where it was found. */
  gap?: string;
  evidence: string;
}

const RATING_KEYS: readonly RatingKey[] = ['shooting', 'composure', 'communication', 'awareness', 'medical', 'coordination'];
const squadOfficers = (state: GameState) => state.squads.find(squad => squad.id === 'A')!.officerIds.map(id => state.officers[id]);
const edit = (state: GameState, fn: (draft: GameState) => void) => { const draft = structuredClone(state); fn(draft); return draft; };

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
    id: 'items-none', system: 'item', input: 'Carried equipment (squad A deploys with nothing)', direction: 'down', status: 'live', minShare: 0.1, openingOnly: true,
    perturb: (_state, restart) => restart({ items: [] }),
    evidence: 'Equipment bonuses apply only where a choice declares them (src/gen/incident/trees-v13/compile.ts)',
  },
  {
    id: 'blueprint-locked', system: 'blueprint', input: 'Door and window states (every opening locked)', direction: 'any', status: 'live', minShare: 0.13,
    perturb: state => edit(state, draft => {
      const run = draft.activeRun!;
      const built = buildLocation(run.locationFamilyId, run.locationSeed);
      run.flags = [...run.flags, ...built.location.openings.map(opening => openingFlag(opening.id, 'locked'))];
    }),
    evidence: 'v13 choices compile with `approach: none`, so routes, entries and openings mostly never reach the roll (src/gen/incident/trees-v13/compile.ts). Raise minShare as entries are wired.',
  },
  {
    id: 'subject-armament', system: 'subject', input: 'The subject\'s weapon (the reported weapon disproved)', direction: 'up', status: 'live', minShare: 0.81,
    perturb: state => edit(state, draft => {
      const scenario = getScenario(draft.activeRun!.scenarioId)!;
      for (const person of scenario.incidentPeople ?? []) if (person.armamentFactId) draft.activeRun!.knowledge[person.armamentFactId] = 'disproved';
    }),
    evidence: '`incidentSubjects` reads armament knowledge into `threatFx` (src/sim/incident-factors.ts). The rescue tree has no armed person on scene, so it never responds.',
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
      const restart = (opts?: Parameters<typeof startGateRun>[2]) => baseline(startGateRun(point.scenarioId, 719, opts));
      const before = odds(base), after = odds(probe.perturb(base, restart));
      const tree = (byTree[point.type] ??= { choices: 0, moved: 0 });
      for (const [id, b] of before) {
        const a = after.get(id);
        if (!b.eligible) continue;
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
