import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SCENARIOS } from '../content/scenarios';
import { DEV_NODES } from '../content/dev-tree';
import type { ActionDefinition, OutcomeEffect, ScenarioDefinition } from './scenario-types';
import type { ForceRiskPreview, GameState } from './types';
import { createInitialState } from './department';
import { apply, makeUnit, NOW, startRun } from './test-fixtures';
import { evaluateAction, getBuilt } from './resolution';
import { computeDebrief, validateScenario } from './operation';
import { forceSeverity, FORCE_RISK_V1, selectedForceRisk } from './force-risk';
import { civilianOutcomeViews, validPersonConsequences } from './incident-consequences';
import { deserialize, serialize } from './save';
import { next } from './rng';
import { storyPoint } from './story-bindings';
import { actionEquipmentRequirements } from './equipment-requirements';

const ID = 'test_force_risk_v7';
function action(id: string, effect: OutcomeEffect, extra: Partial<ActionDefinition> = {}): ActionDefinition {
  return { id, stage: 'assess', title: id, icon: 'radio', summary: id, targetId: 'front_yard', task: id,
    requires: {}, check: { kind: 'coordination', ratings: [{ key: 'coordination', weight: 1 }], difficulty: 20 },
    approach: 'none', workload: { base: 1, perSqFt: 0 }, stressBase: 1,
    outcomes: { favorable: [effect], mixed: [effect], adverse: [effect] }, ...extra };
}
function definition(): ScenarioDefinition {
  const base = structuredClone(SCENARIOS.ms_occupancy);
  const at = storyPoint(getBuilt(base.locationFamilyId, base.locationSeed), 'front_yard', 12)!;
  const force = (kind: ForceRiskPreview['profile']) => action(kind, { setFlags: ['task_done'], stage: 'assess', objective: 20 }, {
    storyTargetPersonId: 'sam', forceProfile: { kind, personId: 'sam', personRole: 'subject' },
    check: { kind: 'execution', ratings: [{ key: 'shooting', weight: 1 }], difficulty: 20 },
    capabilities: { rules: [kind === 'firearm' ? 'authorized_response' : kind], required: [kind === 'firearm' ? 'authorized_response' : kind], safetyFactIds: ['f_safety'], subjectFactIds: ['f_person'] },
  });
  return { ...base, id: ID, version: 7, people: [],
    pressure: { start: 0, perMinute: 0, threshold: 100, civilianPerMinute: 0 },
    civilianOutcomes: [{ id: 'sam', label: 'Sam Test', factId: 'f_person', safeFlag: 'sam_safe', injuredFlag: 'sam_injured', careFlag: 'sam_care' }],
    facts: ['f_person', 'f_safety'].map(id => ({ ...base.facts[0], id, label: id, spaceId: 'front_yard', initial: 'confirmed', truth: true, person: id === 'f_person' ? { label: 'Sam Test', at } : undefined })),
    story: { archetypeId: 'test', episodeId: 'test', seed: 1, version: 7, bindings: { rooms: {}, exterior: {}, routes: {}, props: {},
      people: { sam: { id: 'sam', label: 'Sam Test', locationFactId: 'f_person', initial: { spaceId: 'front_yard', at }, transitions: [] } } } },
    externalServices: [{ id: 'ambulance', label: 'Ambulance crew', kind: 'medical', description: 'Accept injured people for care', arrivalMinutes: 2, available: true }],
    stages: {
      assess: { id: 'assess', label: 'Incident', prompt: 'Task success and human harm are separate.', actions: [
        force('firearm'), force('less_lethal_device'), force('less_lethal_impact'),
        action('contact', { setFlags: ['contact_done'], stage: 'assess' }, { storyTargetPersonId: 'sam', check: { kind: 'contact', ratings: [{ key: 'communication', weight: 1 }], difficulty: 20 } }),
        action('another_person', { stage: 'assess' }),
        action('exposure', { officerHarm: { severity: 'serious', label: 'Recorded incident injury' }, stage: 'assess' }, { check: { kind: 'execution', ratings: [{ key: 'shooting', weight: 1 }], difficulty: 20 }, capabilities: { rules: ['authorized_response'] } }),
        action('request', { requestSupport: ['ambulance'], stage: 'assess' }, { commandOnly: true }),
        action('stabilize', { stage: 'assess' }, { storyTargetPersonId: 'sam', personCare: { personId: 'sam', kind: 'stabilize' }, requires: { certs: ['advanced_first_aid'], allTags: ['medkit'] }, consumes: [{ tag: 'medkit', qty: 1 }], check: { kind: 'medical', ratings: [{ key: 'medical', weight: 1 }], difficulty: 20 } }),
        action('officer_stabilize', { officerCare: 'stabilize', stage: 'assess' }, { requires: { certs: ['advanced_first_aid'], allTags: ['medkit'] }, consumes: [{ tag: 'medkit', qty: 1 }], check: { kind: 'medical', ratings: [{ key: 'medical', weight: 1 }], difficulty: 20 } }),
        action('wait', { stage: 'assess' }, { commandOnly: true, awaitSupport: 'ambulance' }),
        action('accept', { acceptSupport: ['ambulance'], stage: 'assess' }, { commandOnly: true, personCare: { personId: 'sam', kind: 'accept', serviceId: 'ambulance' }, requires: { externalSupport: [{ serviceId: 'ambulance', status: 'available', reason: 'Wait for the ambulance' }] } }),
        action('accept_all', { acceptSupport: ['ambulance'], officerCare: 'evacuate', stage: 'assess' }, { commandOnly: true, personCare: { personId: 'sam', kind: 'accept', serviceId: 'ambulance' }, requires: { externalSupport: [{ serviceId: 'ambulance', status: 'available', reason: 'Wait for the ambulance' }] } }),
        action('finish', { setFlags: ['done'], ending: 'resolved' }, { commandOnly: true }),
      ] },
      adapt: { id: 'adapt', label: 'Adapt', prompt: 'Adapt', actions: [action('adapt_end', { ending: 'handed_over' }, { stage: 'adapt', commandOnly: true })] },
      resolve: { id: 'resolve', label: 'Resolve', prompt: 'Resolve', actions: [action('resolve_end', { ending: 'handed_over' }, { stage: 'resolve', commandOnly: true })] },
    },
    endings: {
      resolved: { id: 'resolved', title: 'Responsibilities complete', summary: 'Care responsibilities completed.', trustAdjust: 0, strain: 0, disposition: 'resolved', completion: { flags: ['done'] } },
      handed_over: { id: 'handed_over', title: 'Unresolved duties', summary: 'Remaining duties were recorded.', trustAdjust: 0, strain: 0, disposition: 'unresolved', remainingTasks: ['Complete the remaining responsibility'] },
    },
  };
}
function started(loadout: Record<string, number>): GameState {
  const state = createInitialState(NOW, 99);
  state.department.unlockedNodes = Object.keys(DEV_NODES);
  state.department.developmentTiers = Object.fromEntries(Object.keys(DEV_NODES).map(id => [id, 1]));
  for (const officer of Object.values(state.officers)) officer.certs = [...new Set([...officer.certs, 'entry_team', 'less_lethal', 'advanced_less_lethal', 'advanced_first_aid'] as const)];
  for (const [itemId, qty] of Object.entries(loadout)) for (let i = 1; i <= qty; i++) { const unit = makeUnit(itemId, 900 + i); state.units[unit.id] = unit; }
  return startRun(state, ID, ['A'], { loadouts: { A: loadout } });
}
function choose(state: GameState, actionId: string): GameState {
  const result = apply(state, { type: 'decide', actionId, actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result).toEqual({ ok: true }); return result.state;
}
function evaluation(state: GameState, id: string) {
  const run = state.activeRun!; const scenario = SCENARIOS[ID];
  return evaluateAction({ state, run, scenario, action: scenario.stages.assess.actions.find(action => action.id === id)!, built: getBuilt(run.locationFamilyId, run.locationSeed), acting: ['A'], support: [] });
}
function seedFor(low: number, high: number, favorable = false): number {
  for (let seed = 0; seed < 1_000_000; seed++) { const first = next(seed), second = next(first.state); if (second.value >= low && second.value < high && (!favorable || first.value > 0.97)) return seed; }
  throw new Error('No matching deterministic seed');
}
beforeAll(() => { SCENARIOS[ID] = definition(); });
afterAll(() => { delete SCENARIOS[ID]; });

describe('bounded independent V7 force severity', () => {
  it('validates authored metadata and maintains lower but strictly nonzero less-lethal tails', () => {
    expect(validateScenario(SCENARIOS[ID], getBuilt(SCENARIOS[ID].locationFamilyId, SCENARIOS[ID].locationSeed))).toEqual([]);
    const rank = { fatal: 3, serious: 2, wounded: 1, none: 0 };
    for (const profile of Object.keys(FORCE_RISK_V1) as ForceRiskPreview['profile'][]) {
      const thresholds = FORCE_RISK_V1[profile];
      expect(thresholds.fatal).toBeGreaterThan(0); expect(thresholds.fatal).toBeLessThan(thresholds.serious); expect(thresholds.serious).toBeLessThan(thresholds.wounded); expect(thresholds.wounded).toBeLessThan(1);
      for (let i = 0; i < 10000; i++) {
        const sample = i / 10000;
        if (i) expect(rank[forceSeverity(profile, sample)]).toBeLessThanOrEqual(rank[forceSeverity(profile, (i - 1) / 10000)]);
        if (profile !== 'firearm') expect(rank[forceSeverity(profile, sample)]).toBeLessThanOrEqual(rank[forceSeverity('firearm', sample)]);
      }
    }
    expect(FORCE_RISK_V1.less_lethal_device.fatal).toBeLessThan(FORCE_RISK_V1.firearm.fatal / 10);
    expect(FORCE_RISK_V1.less_lethal_impact.fatal).toBeLessThan(FORCE_RISK_V1.firearm.fatal / 10);
  });
  it('commits success and a fatality independently, saving one exact causal unit and a second deterministic sample', () => {
    const before = started({ service_sidearm: 1 }); before.activeRun!.rngState = seedFor(0, 0.22, true);
    const initial = before.activeRun!.rngState; const preview = evaluation(before, 'firearm').forceRisk;
    const after = choose(before, 'firearm'); const run = after.activeRun!, decision = run.history[0];
    expect(decision.band).toBe('favorable'); expect(run.flags).toContain('task_done');
    expect(decision.committed?.forceOutcome).toMatchObject({ ...preview, sample: next(next(initial).state).value, severity: 'fatal' });
    expect(run.rngState).toBe(next(next(initial).state).state);
    expect(decision.unitsUsed).toContain(preview!.unitId);
    expect(run.personCasualties?.sam).toMatchObject({ personRole: 'subject', severity: 'fatal', care: 'deceased' });
    expect(run.civilianSafety).toBe(40); expect(civilianOutcomeViews(SCENARIOS[ID], run)[0].status).toBe('deceased');
    expect(deserialize(serialize(after, NOW))?.activeRun).toEqual(run);
    expect(choose(before, 'firearm').activeRun).toEqual(run);
    expect(evaluation(after, 'contact').eligible).toBe(false); expect(evaluation(after, 'stabilize').eligible).toBe(false);
    expect(evaluation(after, 'another_person').eligible).toBe(true);
    const ended = choose(after, 'finish');
    expect(computeDebrief(ended, ended.activeRun!)!).toMatchObject({ completionAchieved: false, disposition: 'unresolved' });
    expect(ended.activeRun!.endingId).toBe('handed_over');
    expect(computeDebrief(ended, ended.activeRun!)!.civilianSafety.label).toBe('Fatality recorded');
  });
  it.each([['less_lethal_device', 'conducted_energy_device', 'energy_cartridge'], ['less_lethal_impact', 'impact_launcher', 'impact_supply']] as const)('retains fatal risk for %s and consumes exactly one matching physical supply', (profile, itemId, supplyId) => {
    const before = started({ [itemId]: 1, [supplyId]: 1 }); before.activeRun!.rngState = seedFor(0, FORCE_RISK_V1[profile].fatal);
    const after = choose(before, profile); const decision = after.activeRun!.history[0];
    expect(decision.committed?.forceOutcome?.severity).toBe('fatal');
    expect(decision.itemsConsumed.find(use => use.itemId === supplyId)).toEqual({ itemId: supplyId, qty: 1 });
    expect(decision.unitsUsed.filter(id => before.units[id]?.itemId === supplyId)).toHaveLength(1);
    expect(deserialize(serialize(after, NOW))?.activeRun).toEqual(after.activeRun);
  });
  it('never rolls harm for carried weapons, legacy actions, invalid use or repeated previews', () => {
    const before = started({ service_sidearm: 1, conducted_energy_device: 1 }); const seed = before.activeRun!.rngState;
    expect(evaluation(before, 'contact').forceRisk).toBeUndefined();
    expect(evaluation(before, 'less_lethal_device').eligible).toBe(false);
    expect(evaluation(before, 'firearm')).toEqual(evaluation(before, 'firearm')); expect(before.activeRun!.rngState).toBe(seed);
    const refused = apply(before, { type: 'decide', actionId: 'less_lethal_device', actingSquadIds: ['A'], supportSquadIds: [] });
    expect(refused.result.ok).toBe(false); expect(refused.state).toEqual(before);
    const contact = choose(before, 'contact'); expect(contact.activeRun!.rngState).toBe(next(seed).state); expect(contact.activeRun!.history[0].committed?.forceOutcome).toBeUndefined();
    const legacy = { ...SCENARIOS[ID], version: 6 }; const a = SCENARIOS[ID].stages.assess.actions[0];
    expect(selectedForceRisk(legacy, a, [{ itemId: 'service_sidearm', unitId: 'held', squadId: 'A', qty: 1, consumable: false }])).toBeUndefined();
  });
  it('needs a qualified acting operator, a serviceable actual item and complete unexpired stock', () => {
    const before = started({ conducted_energy_device: 1, energy_cartridge: 1, service_sidearm: 1 });
    expect(evaluation(before, 'less_lethal_device').eligible).toBe(true);
    for (const change of [
      (state: GameState) => { for (const officer of Object.values(state.officers)) officer.certs = officer.certs.filter(cert => cert !== 'less_lethal'); },
      (state: GameState) => { Object.values(state.units).find(unit => unit.itemId === 'conducted_energy_device')!.condition = 0; },
      (state: GameState) => { Object.values(state.units).find(unit => unit.itemId === 'energy_cartridge')!.expiresAt = NOW; },
    ]) { const copy = structuredClone(before); change(copy); expect(evaluation(copy, 'less_lethal_device').eligible).toBe(false); }
    expect(evaluation(before, 'less_lethal_device').uses.some(use => use.itemId === 'service_sidearm')).toBe(false);
    const hidden = structuredClone(SCENARIOS[ID]); hidden.facts.forEach(fact => { fact.truth = !fact.truth; });
    const run = before.activeRun!;
    const view = evaluateAction({ state: before, run, scenario: hidden, action: hidden.stages.assess.actions[1], built: getBuilt(run.locationFamilyId, run.locationSeed), acting: ['A'], support: [] });
    expect(view.forceRisk).toEqual(evaluation(before, 'less_lethal_device').forceRisk);
  });
  it('never substitutes armor for a firearm requirement or an absent certificate holder for the actual operator', () => {
    const force = SCENARIOS[ID].stages.assess.actions[0];
    const groups = actionEquipmentRequirements(force).groups;
    expect(groups.some(group => group.itemIds.includes('service_sidearm'))).toBe(true);
    expect(groups.every(group => !group.itemIds.includes('light_protection'))).toBe(true);
    const state = started({ conducted_energy_device: 1, energy_cartridge: 1 });
    for (const officer of Object.values(state.officers)) officer.certs = officer.certs.filter(cert => cert !== 'less_lethal');
    state.officers.off_ortiz.certs.push('less_lethal'); state.officers.off_ortiz.ratings.shooting = 1;
    const action = { ...SCENARIOS[ID].stages.assess.actions[1], maxParticipants: 1 };
    const run = state.activeRun!;
    const result = evaluateAction({ state, run, scenario: SCENARIOS[ID], action, built: getBuilt(run.locationFamilyId, run.locationSeed), acting: ['A'], support: [] });
    expect(result.participantIds).not.toContain('off_ortiz'); expect(result.eligible).toBe(false); expect(result.forceRisk).toBeUndefined();
  });
  it('uses protection to reduce a real officer injury without changing target harm or eliminating aftermath', () => {
    const naked = choose(started({}), 'exposure'); const protectedState = choose(started({ light_protection: 1 }), 'exposure');
    expect(Object.values(naked.activeRun!.officerCasualties!)[0].severity).toBe('serious');
    const casualty = Object.values(protectedState.activeRun!.officerCasualties!)[0];
    expect(casualty.severity).toBe('wounded'); expect(protectedState.officers[casualty.officerId].injury).toBeTruthy();
    expect(deserialize(serialize(protectedState, NOW))?.activeRun).toEqual(protectedState.activeRun);
    expect(protectedState.activeRun!.history[0].committed?.forceOutcome).toBeUndefined();
  });
  it('rejects edited causal items, supply deletion, sample/severity changes, false recovery and negative counts', () => {
    const before = started({ conducted_energy_device: 1, energy_cartridge: 1 }); before.activeRun!.rngState = seedFor(0.1, 0.2);
    const after = choose(before, 'less_lethal_device'); expect(validPersonConsequences(after.activeRun!, SCENARIOS[ID], after)).toBe(true);
    for (const change of [
      (state: GameState) => { state.activeRun!.history[0].committed!.forceOutcome!.unitId = 'invented'; },
      (state: GameState) => { state.activeRun!.history[0].committed!.forceOutcome!.sample = 0.8; },
      (state: GameState) => { state.activeRun!.history[0].committed!.forceOutcome!.severity = 'none'; },
      (state: GameState) => { state.activeRun!.history[0].itemsConsumed[0].qty = -1; },
      (state: GameState) => { state.activeRun!.history[0].unitsUsed = state.activeRun!.history[0].unitsUsed.filter(id => state.units[id].itemId !== 'energy_cartridge'); },
      (state: GameState) => { state.activeRun!.personCasualties!.sam.care = 'accepted'; },
      (state: GameState) => { delete state.activeRun!.history[0].committed!.forceOutcome; },
    ]) { const copy = structuredClone(after); change(copy); expect(deserialize(serialize(copy, NOW))).toBeNull(); }
  });
  it('field care spends a kit and keeps injuries recorded until an actual medical crew accepts', () => {
    const before = started({ conducted_energy_device: 1, energy_cartridge: 1, trauma_kit: 1 }); before.activeRun!.rngState = seedFor(0.1, 0.2);
    let after = choose(before, 'less_lethal_device');
    // Choose the initial seed so the continuing care effort avoids the fixed setback tail.
    if (next(after.activeRun!.rngState).value < 0.04) throw new Error('Fixture care seed needs adjustment');
    after = choose(after, 'stabilize');
    expect(after.activeRun!.personCasualties!.sam.care).toBe('stabilized');
    expect(after.activeRun!.history[1].itemsConsumed).toContainEqual({ itemId: 'trauma_kit', qty: 1 });
    expect(deserialize(serialize(after, NOW))?.activeRun).toEqual(after.activeRun);
    after = choose(after, 'request'); after = choose(after, 'wait'); after = choose(after, 'accept');
    expect(after.activeRun!.personCasualties!.sam).toMatchObject({ severity: 'wounded', care: 'accepted' });
    expect(civilianOutcomeViews(SCENARIOS[ID], after.activeRun!)[0].status).toBe('care_accepted');
    expect(deserialize(serialize(after, NOW))?.activeRun).toEqual(after.activeRun);
    after = choose(after, 'finish'); expect(computeDebrief(after, after.activeRun!)!.completionAchieved).toBe(true);
    expect(computeDebrief(after, after.activeRun!)!.civilianSafety.label).toBe('Injuries recorded');
  });
  it('records the owned supply a force decision uses', () => {
    const before = started({ conducted_energy_device: 1, energy_cartridge: 1 }); before.activeRun!.rngState = seedFor(0, 0.004);
    const after = choose(before, 'less_lethal_device');
    const cartridge = before.reservations.find(reservation => reservation.itemId === 'energy_cartridge')!.unitId;
    expect(after.activeRun!.history[0].unitsUsed).toContain(cartridge);
    expect(deserialize(serialize(after, NOW))?.activeRun).toEqual(after.activeRun);
  });
  it('preserves a mixed protection, force and care history through every reload and the closed debrief', () => {
    let state = started({ light_protection: 1, conducted_energy_device: 1, energy_cartridge: 1, trauma_kit: 2 });
    for (let seed = 0; seed < 10000; seed++) {
      const draws: number[] = []; let value = seed;
      for (let i = 0; i < 5; i++) { const draw = next(value); draws.push(draw.value); value = draw.state; }
      if (draws[3] > 0.1 && draws[3] < 0.2 && draws[4] > 0.8) { state.activeRun!.rngState = seed; break; }
    }
    for (const id of ['exposure', 'officer_stabilize', 'less_lethal_device', 'stabilize', 'request', 'wait', 'accept_all', 'finish']) {
      state = choose(state, id);
      const restored = deserialize(serialize(state, NOW));
      expect(restored?.activeRun, `reload after ${id}`).toEqual(state.activeRun); state = restored!;
    }
    expect(state.activeRun!.personCasualties!.sam).toMatchObject({ severity: 'wounded', care: 'accepted' });
    expect(Object.values(state.activeRun!.officerCasualties!)[0]).toMatchObject({ severity: 'wounded', care: 'evacuated' });
    const closed = apply(state, { type: 'closeDebrief' }); expect(closed.result.ok).toBe(true);
    expect(closed.state.debriefs[0].completionAchieved).toBe(true);
    expect(closed.state.debriefs[0].personCasualties?.[0].care).toBe('accepted');
    expect(deserialize(serialize(closed.state, NOW))?.debriefs).toEqual(closed.state.debriefs);
  });
});
