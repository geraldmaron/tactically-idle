import { describe, expect, it } from 'vitest';
import { dispatch } from './game';
import { createInitialState } from './department';
import { HOUR_MS } from './economy';
import { playerArcContext, takeIncident } from './incidents';
import { casebookRecipes, noveltyWeights, recipeOfScenario, situationCount } from './casebook';
import { drawIncidentSpec, incidentId } from '../gen/incident';
import { specForSituation } from '../content/scenario-recipes';
import { SCENARIO_TYPES } from '../content/scenario-types';
import { DEFAULT_UNLOCK, isUnlocked, missingRequirements, unlockRule, unlockedTypes } from '../content/unlocks';
import type { DebriefResult, GameState } from './types';
import type { IncidentType } from './scenario-types';

const T0 = Date.UTC(2026, 0, 5, 12, 0, 0);
const ALL = SCENARIO_TYPES.map((info) => info.type);

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

function debrief(scenarioId: string, objective: number, completed: boolean): DebriefResult {
  return {
    runId: `run_${objective}`, scenarioId, endingId: 'e', endingTitle: 'Ending',
    objective: { score: objective, label: completed ? 'Resolved' : 'Partial progress' }, civilianSafety: { score: 90, label: 'Safe' },
    completionAchieved: completed, disposition: completed ? 'resolved' : 'relief_partial',
    officerCondition: [], informationPreserved: [], resources: [], unitWear: [], trustDelta: 0, fundingReward: 0, devPointReward: 0, causes: [],
  };
}

describe('capability unlocks', () => {
  it('opens home and tactical calls to a new department, shops at level 2 and businesses at 3', () => {
    const s = createInitialState(T0);
    expect(s.department.level).toBe(1);
    const open = (level: number) => { s.department.level = level; return ALL.filter((type) => isUnlocked(s, type)); };
    // Tactical calls open from the first day for a roster holding their capability; the
    // starting roster has no vehicle-trained officer for protected rescue and no response
    // firearm for the armed incident's urgent response.
    expect(open(1)).toEqual(ALL.filter((type) => unlockRule(type).level === 1 && type !== 'protected_rescue' && type !== 'active_armed_incident'));
    expect(open(1)).toEqual(expect.arrayContaining(['barricaded', 'hostage_crisis']));
    expect(missingRequirements(s, 'active_armed_incident')).toEqual({ anyItem: ['service_sidearm', 'compact_carbine', 'response_shotgun'] });
    const shield = Object.values(s.units).find((unit) => unit.itemId === 'ballistic_shield')!;
    s.units.test_sidearm = { ...shield, id: 'test_sidearm', itemId: 'service_sidearm' };
    expect(isUnlocked(s, 'active_armed_incident')).toBe(true);
    expect(open(1)).toContain('active_armed_incident');
    expect(open(5)).toEqual(expect.arrayContaining(['barricaded', 'active_armed_incident', 'hostage_crisis']));
  });

  it('gates specialist calls on certification and equipment, and unknown frameworks on level', () => {
    const s = createInitialState(T0);
    s.department.level = 10;
    for (const officer of Object.values(s.officers)) officer.certs = officer.certs.filter((cert) => cert !== 'entry_team' && cert !== 'crisis_negotiation');
    expect(missingRequirements(s, 'active_armed_incident')).toEqual({ anyCert: ['entry_team', 'less_lethal'], anyItem: ['service_sidearm', 'compact_carbine', 'response_shotgun'] });
    expect(missingRequirements(s, 'hostage_crisis')).toEqual({ anyCert: ['crisis_negotiation'] });
    expect(missingRequirements(s, 'barricaded')).toEqual({ anyCert: ['crisis_negotiation', 'deescalation'] });
    s.officers.off_park.certs.push('less_lethal');
    expect(missingRequirements(s, 'active_armed_incident')).toEqual({ anyItem: ['service_sidearm', 'compact_carbine', 'response_shotgun'] });
    const shield = Object.values(s.units).find((unit) => unit.itemId === 'ballistic_shield')!;
    s.units.test_carbine = { ...shield, id: 'test_carbine', itemId: 'compact_carbine' };
    expect(missingRequirements(s, 'active_armed_incident')).toEqual({});
    s.units.test_carbine.status = 'scrapped';
    expect(missingRequirements(s, 'active_armed_incident')).toEqual({ anyItem: ['service_sidearm', 'compact_carbine', 'response_shotgun'] });
    expect(unlockRule('holding' as IncidentType)).toBe(DEFAULT_UNLOCK);
    s.department.level = 1;
    expect(missingRequirements(s, 'active_armed_incident').anyItem).toContain('service_sidearm');
  });

  it('never strands a department with nothing unlocked', () => {
    const s = createInitialState(T0);
    s.department.level = 0;
    const open = unlockedTypes(s, ALL);
    expect(open.length).toBeGreaterThan(0);
    // Every dispatched framework is tactical and needs a capability, so the fallback offers the
    // lowest-level ones rather than nothing.
    expect(open.every((type) => unlockRule(type).level === 1)).toBe(true);
    expect(playerArcContext(s).unlockedTypes).toEqual(open);
  });
});

describe('v11 board draws', () => {
  it('draw only unlocked frameworks, and a new certification opens protected rescue', () => {
    const locked = createInitialState(T0, 777);
    expect(boardTypes(locked, 24 * 6).has('protected_rescue')).toBe(false);
    const open = createInitialState(T0, 777);
    open.department.level = 4;
    open.officers.off_park.certs.push('vehicle_operations');
    const drawn = (s: GameState) => new Set(Array.from({ length: 3000 }, (_, rng) => drawIncidentSpec(rng + 1, { level: 3, trust: 78, ...playerArcContext(s) }).spec.type));
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
    s.casebook = { frameworksSeen: ['barricaded', 'hostage_crisis'], recipes: { 'hostage_crisis/market_row/0/ordinary': { firstAt: T0 }, 'hostage_crisis/market_row/1/ordinary': { firstAt: T0 }, 'hostage_crisis/market_row/2/ordinary': { firstAt: T0 } } };
    const weights = noveltyWeights(s, ['barricaded', 'hostage_crisis', 'active_armed_incident']);
    expect(situationCount('hostage_crisis')).toBe(3);
    expect(weights).toEqual({ barricaded: 2, hostage_crisis: 1, active_armed_incident: 3 });
    const base = { level: 3, trust: 78, contentVersion: 13 };
    let favored = 0, plain = 0;
    for (let rng = 1; rng <= 400; rng++) {
      const weighted = drawIncidentSpec(rng, { ...base, typeWeights: { active_armed_incident: 8 } });
      const unweighted = drawIncidentSpec(rng, base);
      expect(weighted.state).toBe(unweighted.state);
      if (weighted.spec.type === 'active_armed_incident') favored++;
      if (unweighted.spec.type === 'active_armed_incident') plain++;
    }
    expect(favored).toBeGreaterThan(plain * 2);
  });

});

describe('casebook record', () => {
  const card = (s: GameState, type: IncidentType, familyId: string, variant: 0 | 1 | 2) => {
    const spec = { ...specForSituation(type, familyId, { variant, characteristic: 'ordinary' }, 9), contentVersion: 13 };
    const id = incidentId(spec);
    s.incidents.unshift({ id, type, familyId, tier: spec.tier, arrivedAt: T0, expiresAt: T0 + HOUR_MS, seen: true });
    return id;
  };

  it('discovers a recipe on dispatch, never from the board, and keeps the best live result', () => {
    const s = createInitialState(T0, 31);
    const id = card(s, 'hostage_crisis', 'market_row', 1);
    expect(casebookRecipes(s).size).toBe(0);
    takeIncident(s, id);
    const ref = recipeOfScenario(id)!;
    expect(ref).toMatchObject({ type: 'hostage_crisis', variant: 1, characteristic: 'ordinary' });
    expect(Object.keys(s.casebook!.recipes)).toEqual([ref.key]);
    s.debriefs = [debrief(id, 40, false)];
    expect(casebookRecipes(s).get(ref.key)!.best).toEqual({ completed: false, objective: 40, safety: 90, label: 'Partial progress' });
    s.debriefs = [debrief(id, 30, true), ...s.debriefs];
    const second = card(s, 'barricaded', 'harbour_court', 0);
    takeIncident(s, second);
    expect(s.casebook!.recipes[ref.key].best).toEqual({ completed: true, objective: 30, safety: 90, label: 'Resolved' });
    s.debriefs = [];
    expect(casebookRecipes(s).get(ref.key)!.best!.completed).toBe(true);
  });


});
