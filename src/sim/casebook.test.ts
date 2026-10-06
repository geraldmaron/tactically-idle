import { describe, expect, it } from 'vitest';
import { dispatch } from './game';
import { createInitialState } from './department';
import { HOUR_MS } from './economy';
import { playerArcContext, takeIncident } from './incidents';
import { casebookRecipes, foldDebriefs, noveltyWeights, recipeOfScenario, situationCount } from './casebook';
import { deserialize, serialize } from './save';
import { drawIncidentSpec, incidentId } from '../gen/incident';
import { specForSituationV10 } from '../content/scenario-recipes';
import { SCENARIO_TYPES_V11 } from '../content/scenario-types-v11';
import { DEFAULT_UNLOCK, isUnlocked, missingRequirements, unlockRule, unlockedTypes } from '../content/unlocks';
import type { DebriefResult, GameState } from './types';
import type { IncidentType } from './scenario-types';

const T0 = Date.UTC(2026, 0, 5, 12, 0, 0);
const ALL = SCENARIO_TYPES_V11.map((info) => info.type);

function tick(state: GameState, now: number): GameState {
  const r = dispatch(state, { type: 'tick' }, { now });
  expect(r.result).toEqual({ ok: true });
  return r.state;
}

/** Every card type the board shows over `hours` of hourly ticks. */
function boardTypes(state: GameState, hours: number): Set<string> {
  const types = new Set(state.incidents.map((card) => card.type));
  let s = state;
  for (let h = 1; h <= hours; h++) {
    s = tick(s, T0 + h * HOUR_MS);
    for (const card of s.incidents) types.add(card.type);
  }
  return types;
}

function debrief(scenarioId: string, practice: boolean, objective: number, completed: boolean): DebriefResult {
  return {
    runId: `run_${objective}`, scenarioId, endingId: 'e', endingTitle: 'Ending', practice,
    objective: { score: objective, label: completed ? 'Resolved' : 'Partial progress' }, civilianSafety: { score: 90, label: 'Safe' },
    completionAchieved: completed, disposition: completed ? 'resolved' : 'relief_partial',
    officerCondition: [], informationPreserved: [], resources: [], unitWear: [], trustDelta: 0, fundingReward: 0, devPointReward: 0, causes: [],
  };
}

describe('capability unlocks', () => {
  it('opens ordinary and business calls to a new department and names what protected rescue needs', () => {
    const s = createInitialState(T0);
    expect(missingRequirements(s, 'protected_rescue')).toEqual({ anyCert: ['vehicle_operations'] });
    for (const type of ALL.filter((t) => t !== 'protected_rescue')) expect(isUnlocked(s, type), type).toBe(true);
    s.officers.off_park.certs.push('vehicle_operations');
    expect(isUnlocked(s, 'protected_rescue')).toBe(true);
  });

  it('gates specialist calls on certification and equipment, and unknown frameworks on level', () => {
    const s = createInitialState(T0);
    for (const officer of Object.values(s.officers)) officer.certs = officer.certs.filter((cert) => cert !== 'entry_team' && cert !== 'crisis_negotiation');
    expect(missingRequirements(s, 'active_armed_incident')).toEqual({ anyCert: ['entry_team', 'less_lethal'] });
    expect(missingRequirements(s, 'hostage_crisis')).toEqual({ anyCert: ['crisis_negotiation'] });
    expect(missingRequirements(s, 'barricaded')).toEqual({ anyCert: ['crisis_negotiation', 'deescalation'] });
    s.officers.off_park.certs.push('less_lethal');
    for (const unit of Object.values(s.units)) if (unit.itemId === 'ballistic_shield') unit.status = 'scrapped';
    expect(missingRequirements(s, 'active_armed_incident')).toEqual({ anyItem: ['ballistic_shield', 'light_protection', 'rescue_shield'] });
    expect(unlockRule('holding' as IncidentType)).toBe(DEFAULT_UNLOCK);
    s.department.level = 2;
    expect(missingRequirements(s, 'burglary')).toEqual({ level: 3 });
  });

  it('never strands a department with nothing unlocked', () => {
    const s = createInitialState(T0);
    s.department.level = 0;
    const open = unlockedTypes(s, ALL);
    expect(open.length).toBeGreaterThan(0);
    expect(open.every((type) => unlockRule(type).level === 1 && !unlockRule(type).anyCert)).toBe(true);
    expect(playerArcContext(s).unlockedTypes).toEqual(open);
  });
});

describe('v11 board draws', () => {
  it('draw only unlocked frameworks, and a new certification opens protected rescue', () => {
    const locked = createInitialState(T0, 777);
    expect(boardTypes(locked, 24 * 6).has('protected_rescue')).toBe(false);
    const open = createInitialState(T0, 777);
    open.officers.off_park.certs.push('vehicle_operations');
    const drawn = (s: GameState) => new Set(Array.from({ length: 3000 }, (_, rng) => drawIncidentSpec(rng + 1, { level: 3, trust: 78, contentVersion: 11, ...playerArcContext(s) }).spec.type));
    expect(drawn(locked).has('protected_rescue')).toBe(false);
    expect(drawn(open).has('protected_rescue')).toBe(true);
  });

  it('stay deterministic, and one long settlement matches hourly ticks', () => {
    const a = tick(createInitialState(T0, 4242), T0 + 30 * HOUR_MS);
    const b = tick(createInitialState(T0, 4242), T0 + 30 * HOUR_MS);
    expect(a.incidents).toEqual(b.incidents);
    let c = createInitialState(T0, 4242);
    for (let h = 1; h <= 30; h++) c = tick(c, T0 + h * HOUR_MS);
    expect(c.incidents).toEqual(a.incidents);
    expect(c.casebook).toEqual(a.casebook);
  });

  it('badge the first card of each framework only', () => {
    const s = createInitialState(T0, 99);
    expect(s.incidents.every((card) => card.newKind)).toBe(true);
    expect(s.casebook!.frameworksSeen).toEqual([...s.incidents].reverse().map((card) => card.type));
    let later = s;
    const first = new Map(s.incidents.map((c) => [c.type, c.id] as const));
    for (let h = 1; h <= 48; h++) {
      later = tick(later, T0 + h * HOUR_MS);
      for (const c of [...later.incidents].reverse()) {
        if (c.newKind) expect(first.get(c.type) ?? c.id, c.type).toBe(c.id);
        else expect(first.has(c.type), c.type).toBe(true);
        if (!first.has(c.type)) first.set(c.type, c.id);
      }
    }
    const newKinds = later.incidents.filter((card) => card.newKind).map((card) => card.type);
    expect(new Set(newKinds).size).toBe(newKinds.length);
  });

  it('weight unseen frameworks first, then undiscovered situations, without extra draws', () => {
    const s = createInitialState(T0, 5);
    s.casebook = { frameworksSeen: ['welfare_check', 'domestic'], recipes: { 'domestic/cedar_close/0/ordinary': { firstAt: T0 }, 'domestic/cedar_close/1/ordinary': { firstAt: T0 }, 'domestic/cedar_close/2/ordinary': { firstAt: T0 } } };
    const weights = noveltyWeights(s, ['welfare_check', 'domestic', 'burglary']);
    expect(situationCount('domestic')).toBe(3);
    expect(weights).toEqual({ welfare_check: 2, domestic: 1, burglary: 3 });
    const base = { level: 3, trust: 78, contentVersion: 11 };
    let favored = 0, plain = 0;
    for (let rng = 1; rng <= 400; rng++) {
      const weighted = drawIncidentSpec(rng, { ...base, typeWeights: { burglary: 8 } });
      const unweighted = drawIncidentSpec(rng, base);
      expect(weighted.state).toBe(unweighted.state);
      if (weighted.spec.type === 'burglary') favored++;
      if (unweighted.spec.type === 'burglary') plain++;
    }
    expect(favored).toBeGreaterThan(plain * 2);
  });

  it('leave earlier content versions unchanged', () => {
    for (let rng = 1; rng <= 50; rng++) {
      const ctx = { level: 3, trust: 78, contentVersion: 10 };
      expect(drawIncidentSpec(rng, { ...ctx, unlockedTypes: ['burglary'], typeWeights: { burglary: 8 } })).toEqual(drawIncidentSpec(rng, ctx));
    }
  });
});

describe('casebook record', () => {
  const card = (s: GameState, type: IncidentType, familyId: string, variant: 0 | 1 | 2) => {
    const spec = { ...specForSituationV10(type, familyId, { variant, characteristic: 'ordinary' }, 9), contentVersion: 11 };
    const id = incidentId(spec);
    s.incidents.unshift({ id, type, familyId, tier: spec.tier, arrivedAt: T0, expiresAt: T0 + HOUR_MS, seen: true });
    return id;
  };

  it('discovers a recipe on dispatch, never from the board, and keeps the best live result', () => {
    const s = createInitialState(T0, 31);
    const id = card(s, 'domestic', 'cedar_close', 1);
    expect(casebookRecipes(s).size).toBe(0);
    takeIncident(s, id);
    const ref = recipeOfScenario(id)!;
    expect(ref).toMatchObject({ type: 'domestic', variant: 1, characteristic: 'ordinary' });
    expect(Object.keys(s.casebook!.recipes)).toEqual([ref.key]);
    s.debriefs = [debrief(id, false, 40, false)];
    expect(casebookRecipes(s).get(ref.key)!.best).toEqual({ completed: false, objective: 40, safety: 90, label: 'Partial progress' });
    s.debriefs = [debrief(id, false, 30, true), ...s.debriefs];
    const second = card(s, 'welfare_check', 'harbour_court', 0);
    takeIncident(s, second);
    expect(s.casebook!.recipes[ref.key].best).toEqual({ completed: true, objective: 30, safety: 90, label: 'Resolved' });
    s.debriefs = [];
    expect(casebookRecipes(s).get(ref.key)!.best!.completed).toBe(true);
  });

  it('counts a better practice result on a situation already met live, and never discovers by practice', () => {
    const s = createInitialState(T0, 31);
    const id = card(s, 'domestic', 'cedar_close', 1);
    takeIncident(s, id);
    const ref = recipeOfScenario(id)!;
    s.debriefs = [debrief(id, true, 100, true), debrief(id, false, 40, false)];
    expect(casebookRecipes(s).get(ref.key)!.best).toEqual({ completed: true, objective: 100, safety: 90, label: 'Resolved', practice: true });
    // The same situation practiced on another building type: the best counts, but the
    // building is marked practice-only, so it is not listed as visited.
    const elsewhere = incidentId({ ...specForSituationV10('domestic', 'harbour_court', { variant: 1, characteristic: 'ordinary' }, 9), contentVersion: 11 });
    const otherRef = recipeOfScenario(elsewhere)!;
    expect(otherRef.key).not.toBe(ref.key);
    // A framework or situation never met live stays undiscovered, whatever practice scored.
    const unmet = incidentId({ ...specForSituationV10('domestic', 'cedar_close', { variant: 0, characteristic: 'ordinary' }, 9), contentVersion: 11 });
    const neverSent = incidentId({ ...specForSituationV10('disturbance', 'cedar_close', { variant: 0, characteristic: 'ordinary' }, 9), contentVersion: 11 });
    s.debriefs = [debrief(elsewhere, true, 90, true), debrief(unmet, true, 100, true), debrief(neverSent, true, 100, true), ...s.debriefs];
    foldDebriefs(s, T0 + HOUR_MS);
    expect(s.casebook!.recipes[otherRef.key]).toEqual({ firstAt: T0 + HOUR_MS, practiceOnly: true, best: { completed: true, objective: 90, safety: 90, label: 'Resolved', practice: true } });
    expect(s.casebook!.recipes[recipeOfScenario(unmet)!.key]).toBeUndefined();
    expect(s.casebook!.recipes[recipeOfScenario(neverSent)!.key]).toBeUndefined();
    // A live dispatch to that building type later makes it a visited building.
    s.incidents.unshift({ id: elsewhere, type: 'domestic', familyId: 'harbour_court', tier: 2, arrivedAt: T0, expiresAt: T0 + HOUR_MS, seen: true });
    takeIncident(s, elsewhere);
    expect(s.casebook!.recipes[otherRef.key].practiceOnly).toBeUndefined();
    expect(deserialize(serialize(s, T0))!.casebook).toEqual(s.casebook);
  });

  it('migrates a v5 save from its board and live debriefs, and round-trips v6', () => {
    const s = createInitialState(T0, 12);
    const live = incidentId({ ...specForSituationV10('disturbance', 'cedar_close', { variant: 2, characteristic: 'ordinary' }, 9), contentVersion: 10 });
    s.debriefs = [debrief(live, false, 70, true)];
    delete s.casebook;
    for (const c of s.incidents) delete c.newKind;
    s.saveVersion = 5;
    const migrated = deserialize(serialize(s, T0))!;
    expect(migrated).not.toBeNull();
    expect(migrated.saveVersion).toBe(6);
    expect(migrated.incidents.some((c) => c.newKind)).toBe(false);
    const ref = recipeOfScenario(live)!;
    expect(migrated.casebook!.frameworksSeen).toEqual([...new Set(['disturbance', ...[...s.incidents].reverse().map((c) => c.type)])]);
    expect(migrated.casebook!.recipes[ref.key]).toEqual({ firstAt: T0, best: { completed: true, objective: 70, safety: 90, label: 'Resolved' } });
    expect(deserialize(serialize(migrated, T0))).toEqual(migrated);
    const bad = structuredClone(migrated) as unknown as { casebook: { recipes: Record<string, unknown> } };
    bad.casebook.recipes['not a key'] = { firstAt: 1 };
    expect(deserialize(serialize(bad as unknown as GameState, T0))).toBeNull();
  });
});
