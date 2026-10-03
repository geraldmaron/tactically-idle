import { withLegacyRadios } from './test-fixtures';
import { describe, expect, it } from 'vitest';
import type { BuiltLocation, Contributor, GameState, Id, SquadId } from './types';
import type { ScenarioDefinition } from './scenario-types';
import { scenarioActions } from './scenario-types';
import { SCENARIOS } from '../content/scenarios';
import { deriveLocation, LOCATION_FAMILIES } from './location';
import { applyChoices } from './location-variation';
import {
  bandFor,
  bandProbabilities,
  builtFor,
  conditionFraction,
  evaluateAction,
  riskBand,
  strainFor,
  type Evaluation,
} from './resolution';
import { validateScenario } from './operation';
import { makeState, setRun, startRun } from './test-fixtures';

const occ = SCENARIOS.ms_occupancy;
const urg = SCENARIOS.ms_urgent;

function actionOf(s: ScenarioDefinition, id: Id) {
  const a = scenarioActions(s).find((x) => x.id === id);
  if (!a) throw new Error(`no action ${id}`);
  return a;
}

function evalAction(
  state: GameState,
  scenario: ScenarioDefinition,
  actionId: Id,
  acting: SquadId[],
  support: SquadId[] = [],
  built?: BuiltLocation,
): Evaluation {
  const run = state.activeRun!;
  return evaluateAction({
    state,
    run,
    scenario,
    action: actionOf(scenario, actionId),
    built: built ?? builtFor(run.locationFamilyId, run.locationSeed, run.flags),
    acting,
    support,
  });
}

const without = (cs: Contributor[], pred: (c: Contributor) => boolean) => cs.filter((c) => !pred(c));
const withRatings = (s: GameState, id: Id, r: Partial<GameState['officers'][Id]['ratings']>) => {
  const c = structuredClone(s);
  Object.assign(c.officers[id].ratings, r);
  return c;
};

describe('content validity', () => {
  it('both scenarios validate against their location', () => {
    for (const s of Object.values(SCENARIOS)) {
      const built = builtFor(s.locationFamilyId, s.locationSeed, []);
      expect(built.issues.filter((i) => i.severity === 'error')).toEqual([]);
      expect(validateScenario(s, built)).toEqual([]);
    }
  });

  it('shooting only ever appears in execution checks', () => {
    for (const s of Object.values(SCENARIOS))
      for (const a of scenarioActions(s))
        if (a.check.kind !== 'execution') expect(a.check.ratings.every((r) => r.key !== 'shooting' || r.weight === 0)).toBe(true);
  });
});

describe('bands and probability', () => {
  it('maps a saved sample to a band deterministically and monotonically', () => {
    for (const margin of [-30, -5, 0, 10, 30]) {
      const bands = Array.from({ length: 101 }, (_, i) => bandFor(margin, i / 101));
      const rank = { adverse: 0, mixed: 1, favorable: 2 } as const;
      for (let i = 1; i < bands.length; i++) expect(rank[bands[i]]).toBeGreaterThanOrEqual(rank[bands[i - 1]]);
      expect(bandFor(margin, 0.37)).toBe(bandFor(margin, 0.37));
    }
  });

  it('stated probabilities match the frequency a uniform sample produces', () => {
    for (const margin of [-20, 0, 12, 25]) {
      const p = bandProbabilities(margin);
      expect(p.favorable + p.mixed + p.adverse).toBeCloseTo(1, 6);
      const n = 4000;
      let fav = 0;
      for (let i = 0; i < n; i++) if (bandFor(margin, (i + 0.5) / n) === 'favorable') fav++;
      expect(fav / n).toBeCloseTo(p.favorable, 1);
    }
  });

  it('risk band falls as the favorable chance falls', () => {
    expect(['low', 'moderate', 'high', 'severe']).toEqual([0.9, 0.5, 0.3, 0.05].map(riskBand));
  });
});

describe('rating relevance (acceptance 16)', () => {
  const base = startRun(makeState(), 'ms_occupancy', ['A']);
  const atResolve = setRun(base, { stage: 'resolve', flags: ['in_contact'] });
  const atAdapt = setRun(base, { stage: 'adapt' });

  it('raising only shooting changes only the execution check contributor of that officer', () => {
    const better = withRatings(atResolve, 'off_brooks', { shooting: 95 });
    const a = evalAction(atResolve, occ, 'ms_controlled_entry', ['A']);
    const b = evalAction(better, occ, 'ms_controlled_entry', ['A']);
    const lead = (cs: Contributor[]) => cs.find((c) => c.source === 'rating' && c.ref === 'off_brooks')!;
    expect(lead(b.contributors).value).toBeGreaterThan(lead(a.contributors).value);
    const rest = (e: Evaluation) => without(e.contributors, (c) => c.source === 'rating' && c.ref === 'off_brooks');
    expect(rest(b)).toEqual(rest(a));
    expect(b.margin).toBeGreaterThan(a.margin);
  });

  it('raising only shooting changes nothing for contact, observation, medical or support checks', () => {
    const better = withRatings(atAdapt, 'off_brooks', { shooting: 99 });
    const better2 = withRatings(better, 'off_chen', { shooting: 99 });
    const better3 = withRatings(better2, 'off_vale', { shooting: 99 });
    const sc = withRatings(better3, 'off_ortiz', { shooting: 99 });
    for (const id of ['ms_perimeter_watch', 'ms_preserve_time']) {
      expect(evalAction(sc, occ, id, ['A']).contributors).toEqual(evalAction(atAdapt, occ, id, ['A']).contributors);
    }
    const c0 = setRun(base, { stage: 'assess' });
    const c1 = setRun(sc, { stage: 'assess' });
    for (const id of ['ms_contact', 'ms_gather']) expect(evalAction(c1, occ, id, ['A']).contributors).toEqual(evalAction(c0, occ, id, ['A']).contributors);
    expect(evalAction(c1, occ, 'ms_contact', ['A']).contributors.some((c) => /shooting/.test(c.label))).toBe(false);
  });

  it('the engine itself ignores a shooting weight on a non-execution check (even if content tried)', () => {
    const s = setRun(base, { stage: 'assess' });
    const run = s.activeRun!;
    const built = builtFor(run.locationFamilyId, run.locationSeed, run.flags);
    const sneaky = structuredClone(actionOf(occ, 'ms_contact'));
    sneaky.check.ratings.push({ key: 'shooting', weight: 5 });
    const better = withRatings(s, 'off_chen', { shooting: 100 });
    const ev = (st: GameState) => evaluateAction({ state: st, run: st.activeRun!, scenario: occ, action: sneaky, built, acting: ['A'], support: [] });
    expect(ev(better).contributors).toEqual(ev(s).contributors);
    // The same weight on an execution check does count.
    const exec = structuredClone(actionOf(occ, 'ms_controlled_entry'));
    const atResolve = setRun(base, { stage: 'resolve', flags: ['in_contact'] });
    const evx = (st: GameState) => evaluateAction({ state: st, run: st.activeRun!, scenario: occ, action: exec, built, acting: ['A'], support: [] });
    expect(evx(withRatings(atResolve, 'off_brooks', { shooting: 100 })).score).toBeGreaterThan(evx(atResolve).score);
  });

  it('raising only composure shrinks the pressure contributor and leaves unrelated contributors alone', () => {
    // ms_gather weights awareness and coordination only, so composure can act only through pressure.
    const tense = setRun(base, { stage: 'assess', pressure: 80 });
    const calmer = withRatings(tense, 'off_vale', { composure: 95 });
    const a = evalAction(tense, occ, 'ms_gather', ['A']);
    const b = evalAction(calmer, occ, 'ms_gather', ['A']);
    const pen = (e: Evaluation) => e.contributors.find((c) => c.source === 'pressure' && c.ref === 'off_vale')!;
    expect(pen(a).value).toBeLessThan(0);
    expect(pen(b).value).toBeGreaterThan(pen(a).value);
    const rest = (e: Evaluation) => without(e.contributors, (c) => c.source === 'pressure' && c.ref === 'off_vale');
    expect(rest(b)).toEqual(rest(a));
  });

  it('pressure checks weigh composure directly, and pressure itself hits low-composure officers harder', () => {
    const tense = setRun(base, { stage: 'adapt', pressure: 80 });
    const calm = withRatings(tense, 'off_chen', { composure: 95 });
    const a = evalAction(tense, occ, 'ms_preserve_time', ['A']);
    const b = evalAction(calm, occ, 'ms_preserve_time', ['A']);
    const rating = (e: Evaluation) => e.contributors.find((c) => c.source === 'rating' && c.ref === 'off_chen')!.value;
    expect(rating(b)).toBeGreaterThan(rating(a));
  });

  it('strain is counted once: condition scales the rating contribution and leaves pressure alone', () => {
    // Keep Vale in the lead seat in both runs so seat weight does not change between them.
    const fresh = withRatings(setRun(base, { stage: 'assess', pressure: 60 }), 'off_vale', { awareness: 100 });
    const tired = structuredClone(fresh);
    tired.officers.off_vale.stress = 55;
    const a = evalAction(fresh, occ, 'ms_gather', ['A']);
    const b = evalAction(tired, occ, 'ms_gather', ['A']);
    const cond = b.contributors.filter((c) => c.source === 'condition' && c.ref === 'off_vale');
    expect(cond).toHaveLength(1);
    const rating = b.contributors.find((c) => c.source === 'rating' && c.ref === 'off_vale')!.value;
    expect(cond[0].value).toBeCloseTo(-rating * conditionFraction(55), 0);
    const p = (e: Evaluation) => e.contributors.find((c) => c.source === 'pressure' && c.ref === 'off_vale')!.value;
    expect(p(b)).toBe(p(a));
    expect(b.score).toBeCloseTo(a.score + cond[0].value, 0);
  });
});

describe('geometry affects play (acceptance 15)', () => {
  const s0 = setRun(startRun(makeState(), 'ms_occupancy', ['A']), { stage: 'assess' });
  const family = LOCATION_FAMILIES.maple_street;
  const variant = (choices: Record<string, string | number | boolean>): BuiltLocation => {
    const location = applyChoices(family, choices);
    return { location, derived: deriveLocation(location), issues: [] };
  };

  it('a deeper east bedroom increases the search workload, time and space contributor', () => {
    const small = variant({ east_bedroom_depth: -1 });
    const big = variant({ east_bedroom_depth: 1 });
    expect(big.derived.spaces.bedroom_e.area).toBeGreaterThan(small.derived.spaces.bedroom_e.area);
    const a = evalAction(s0, occ, 'ms_gather', ['A'], [], small);
    const b = evalAction(s0, occ, 'ms_gather', ['A'], [], big);
    const space = (e: Evaluation) => e.contributors.find((c) => c.source === 'space' && /Work area/.test(c.label))!;
    expect(space(b).value).toBeLessThan(space(a).value);
    expect(b.workloadMinutes).toBeGreaterThan(a.workloadMinutes);
    expect(b.timeBase).toBeGreaterThan(a.timeBase);
    expect(b.margin).toBeLessThan(a.margin);
  });

  it('a different connection changes travel: a locked hall door lengthens a path approach', () => {
    const s1 = setRun(s0, { stage: 'resolve' });
    const open = variant({});
    const locked = structuredClone(open.location);
    locked.openings.find((o) => o.id === 'd_hall_bede')!.state = 'locked';
    const lockedBuilt: BuiltLocation = { location: locked, derived: deriveLocation(locked), issues: [] };
    const a = evalAction(s1, occ, 'ms_controlled_entry', ['A'], [], open);
    const b = evalAction(s1, occ, 'ms_controlled_entry', ['A'], [], lockedBuilt);
    expect(b.travelMinutes).toBeGreaterThan(a.travelMinutes);
    expect(b.timeBase).toBeGreaterThan(a.timeBase);
  });

  it('capacity limits useful participants and the trace says so', () => {
    const s1 = setRun(s0, { stage: 'resolve' });
    const e = evalAction(s1, occ, 'ms_controlled_entry', ['A']);
    expect(e.participantIds).toHaveLength(1);
    expect(e.contributors.some((c) => c.source === 'space' && /fits 1: 3 officers can't contribute/.test(c.label))).toBe(true);
    const roomy = structuredClone(builtFor('maple_street', 0, []));
    roomy.derived.spaces.hall.capacity = 4;
    const wide = evalAction(s1, occ, 'ms_controlled_entry', ['A'], [], roomy);
    // Only entry-trained Brooks plus the others by aptitude; capacity 4 admits all four, with diminishing weight.
    expect(wide.participantIds).toHaveLength(4);
    expect(wide.score).toBeGreaterThan(e.score);
  });
});

describe('diminishing returns and support', () => {
  it('more officers and squads add less than their raw ratings and never make a result certain', () => {
    const s = setRun(startRun(makeState({ squadC: true }), 'ms_occupancy', ['A', 'B', 'C']), { stage: 'adapt' });
    const one = evalAction(s, occ, 'ms_perimeter_watch', ['A']);
    const three = evalAction(s, occ, 'ms_perimeter_watch', ['A', 'B', 'C']);
    const ratingSum = (e: Evaluation) => e.contributors.filter((c) => c.source === 'rating').reduce((t, c) => t + c.value, 0);
    expect(three.participantIds.length).toBeGreaterThan(one.participantIds.length);
    expect(ratingSum(three)).toBeGreaterThan(ratingSum(one));
    expect(ratingSum(three) / ratingSum(one)).toBeLessThan(1.6);
    expect(three.pFavorable).toBeLessThan(0.97);
    expect(three.pAdverse).toBeGreaterThan(0.03);
    // Wider cover is real, but it costs travel time.
    expect(three.contributors.some((c) => /Wider cover/.test(c.label))).toBe(true);
    expect(three.timeBase).toBeGreaterThanOrEqual(one.timeBase);
  });

  it('a supporting squad contributes according to where it is and how it is linked', () => {
    const base = setRun(startRun(makeState(), 'ms_occupancy', ['A', 'B']), { stage: 'resolve', flags: ['in_contact'] });
    // A supporting squad's total is its coordination share plus its radio link.
    const sup = (e: Evaluation) => e.contributors.filter((c) => (c.source === 'support' || c.source === 'equipment') && c.ref !== undefined && /Squad B/.test(c.label) && c.value > 0).reduce((t, c) => t + c.value, 0);
    const near = evalAction(base, occ, 'ms_controlled_entry', ['A'], ['B']); // B starts in the east side yard
    const far = evalAction(setRun(base, { positions: { B: 'back_yard' } }), occ, 'ms_controlled_entry', ['A'], ['B']);
    expect(sup(near)).toBeGreaterThan(sup(far));
    expect(sup(far)).toBeGreaterThan(0);
    const noRadio = withLegacyRadios(startRun(makeState(), 'ms_occupancy', ['A', 'B'], { loadouts: { B: { ballistic_shield: 1, trauma_kit: 1 } } }), { B: 0 });
    const dull = evalAction(setRun(noRadio, { stage: 'resolve', flags: ['in_contact'] }), occ, 'ms_controlled_entry', ['A'], ['B']);
    expect(sup(dull)).toBeLessThan(sup(near));
    expect(dull.contributors.some((c) => /Squad B link: one radio only/.test(c.label))).toBe(true);
  });
});

describe('officer fitness', () => {
  it('overloaded officers are excluded from high-risk work with a visible reason', () => {
    const s = setRun(startRun(makeState(), 'ms_occupancy', ['A']), { stage: 'resolve', flags: ['in_contact'] });
    const tired = structuredClone(s);
    tired.officers.off_brooks.stress = 65;
    const e = evalAction(tired, occ, 'ms_controlled_entry', ['A']);
    expect(e.eligible).toBe(false);
    expect(e.reason).toMatch(/Brooks is overloaded/);
    expect(e.excluded.map((x) => x.officerId)).toContain('off_brooks');
    // Same overload does not block a non-execution action.
    const c = evalAction(tired, occ, 'ms_negotiated_exit', ['A']);
    expect(c.eligible).toBe(true);
    // Another squad's entry-trained officer can still go in.
    const two = structuredClone(setRun(startRun(makeState(), 'ms_occupancy', ['A', 'B']), { stage: 'resolve', flags: ['in_contact'] }));
    two.officers.off_brooks.stress = 65;
    expect(evalAction(two, occ, 'ms_controlled_entry', ['B']).eligible).toBe(true);
  });

  it('strain accrues by exposure and composure only shapes the pressure-driven extra', () => {
    const s = setRun(startRun(makeState(), 'ms_occupancy', ['A', 'B']), { stage: 'assess', pressure: 70 });
    const run = s.activeRun!;
    const action = actionOf(occ, 'ms_gather');
    const ev = evalAction(s, occ, 'ms_gather', ['A']);
    const built = builtFor(run.locationFamilyId, run.locationSeed, run.flags);
    const input = { state: s, run, scenario: occ, action, built, acting: ['A'] as SquadId[], support: [] as SquadId[] };
    const d = strainFor(input, ev, 'mixed');
    expect(d.off_vale).toBeGreaterThan(d.off_okafor); // participant outranks a squad that only watches
    const calm = structuredClone(s);
    calm.officers.off_vale.ratings.composure = 100;
    const dCalm = strainFor({ ...input, state: calm, run: calm.activeRun! }, ev, 'mixed');
    expect(dCalm.off_vale).toBeLessThan(d.off_vale);
  });
});

describe('traits apply only under their documented condition', () => {
  const base = startRun(makeState(), 'ms_occupancy', ['A', 'B']);
  const trait = (e: Evaluation, ref: Id) => e.contributors.find((c) => c.source === 'trait' && c.ref === ref);

  it('calm voice helps contact only', () => {
    const s = setRun(base, { stage: 'assess' });
    expect(trait(evalAction(s, occ, 'ms_contact', ['A']), 'off_chen')!.value).toBeGreaterThan(0);
    expect(trait(evalAction(s, occ, 'ms_preserve_time', ['A']), 'off_chen')).toBeUndefined();
  });

  it('observant helps observation only while a report is unresolved', () => {
    const s = setRun(base, { stage: 'assess' });
    expect(trait(evalAction(s, occ, 'ms_gather', ['A']), 'off_vale')!.value).toBeGreaterThan(0);
    const settled = setRun(s, { knowledge: { f_second: 'disproved', f_occ_e: 'confirmed' } });
    expect(trait(evalAction(settled, occ, 'ms_gather', ['A']), 'off_vale')).toBeUndefined();
    expect(trait(evalAction(s, occ, 'ms_negotiated_exit', ['A']), 'off_vale')).toBeUndefined();
  });

  it('impatient: penalty on waiting actions, bonus under high pressure on active ones', () => {
    const s = setRun(base, { stage: 'adapt' });
    // Reyes leads when Squad B watches; waiting costs him.
    const wait = evalAction(s, occ, 'ms_preserve_time', ['B']);
    expect(trait(wait, 'off_reyes')!.value).toBeLessThan(0);
    const hot = setRun(base, { stage: 'resolve', flags: ['in_contact'], pressure: 70 });
    const go = evalAction(hot, occ, 'ms_negotiated_exit', ['B']);
    expect(trait(go, 'off_reyes')!.value).toBeGreaterThan(0);
    const cool = setRun(base, { stage: 'resolve', flags: ['in_contact'], pressure: 20 });
    expect(trait(evalAction(cool, occ, 'ms_negotiated_exit', ['B']), 'off_reyes')).toBeUndefined();
  });

  it('rookie is a small penalty, softened when a mentor is in the same squad', () => {
    // Park holds the first-aid cert, so leads the medic action in both runs (seat weight 1).
    const s = setRun(startRun(makeState(), 'ms_urgent', ['B']), { stage: 'adapt' });
    const withMentor = trait(evalAction(s, urg, 'mu_stage_medic', ['B']), 'off_park')!;
    const alone = structuredClone(s);
    alone.squads[1].officerIds = ['off_lindqvist', 'off_reyes', 'off_park'];
    alone.officers.off_okafor.squadId = null;
    const noMentor = trait(evalAction(alone, urg, 'mu_stage_medic', ['B']), 'off_park')!;
    expect(withMentor.value).toBe(-1);
    expect(noMentor.value).toBe(-4);
  });

  it('steady lowers strain only when something is still uncertain', () => {
    const s = setRun(base, { stage: 'assess' });
    const run = s.activeRun!;
    const built = builtFor(run.locationFamilyId, run.locationSeed, run.flags);
    const action = actionOf(occ, 'ms_gather');
    const input = { state: s, run, scenario: occ, action, built, acting: ['A'] as SquadId[], support: [] as SquadId[] };
    const unsure = strainFor(input, evalAction(s, occ, 'ms_gather', ['A']), 'mixed');
    const steadyOff = structuredClone(s);
    steadyOff.officers.off_brooks.traits = [];
    const withoutTrait = strainFor({ ...input, state: steadyOff }, evalAction(steadyOff, occ, 'ms_gather', ['A']), 'mixed');
    expect(unsure.off_brooks).toBeLessThan(withoutTrait.off_brooks);
  });
});

describe('scenario shape', () => {
  it('assess and adapt of the occupancy scenario reward different priorities than the urgent one', () => {
    expect(occ.pressure.perMinute).toBeLessThan(urg.pressure.perMinute);
    expect(occ.pressure.civilianPerMinute * occ.pressure.perMinute).toBeLessThan(urg.pressure.civilianPerMinute * urg.pressure.perMinute);
  });
});
