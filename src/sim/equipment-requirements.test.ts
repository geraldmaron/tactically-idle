import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../content/items';
import { SCENARIOS } from '../content/scenarios';
import { autoLoadout } from './auto-equip';
import { makeState, NOW, unitId, apply, startCmd, makeUnit, withCallOnBoard } from './test-fixtures';

import { evaluateAction, getBuilt } from './resolution';
import { actionEquipmentRequirements, requiredEquipmentBundle, missionConsumptionBudget } from './equipment-requirements';
import { isBasicKit } from './basic-kit';
import type { ActionDefinition } from './scenario-types';
const testId = 'requirements-regression';
afterEach(() => { delete SCENARIOS[testId]; });
function scenarioWith(actions: ActionDefinition[]) {
  const scenario = structuredClone(SCENARIOS.ms_occupancy); scenario.id = testId;
  for (const stage of Object.values(scenario.stages)) stage.actions = actions.filter((a) => a.stage === stage.id);
  SCENARIOS[testId] = scenario; return testId;
}
const stock = () => makeState({ inventory: Object.fromEntries(Object.values(ITEMS).filter((i) => !i.supportOnly && !isBasicKit(i.id)).map((i) => [i.id, 4])) });
/** A less-lethal option for Alpha: the device (+4) and the launcher (+5, +1 min) share one group.
 * Basic kit adds nothing (basic-kit.ts), so the shotgun is the only packable response weapon. */
function lessLethalOption() {
  const state = stock();
  for (const id of state.squads[0].officerIds) state.officers[id].certs.push('less_lethal', 'advanced_less_lethal');
  const action = structuredClone(SCENARIOS.ms_occupancy.stages.resolve.actions.find((a) => a.id === 'ms_controlled_entry')!);
  action.targetId = 'front_yard'; action.approach = 'none'; action.requires = {}; action.entry = undefined; action.equipment = [];
  // Unconfirmed facts are a planning prerequisite, not a bar to packing.
  const fact = SCENARIOS.ms_occupancy.facts.find((f) => f.initial !== 'disproved')!.id;
  action.capabilities = { rules: ['less_lethal_device', 'less_lethal_impact'], safetyFactIds: [fact], subjectFactIds: [fact] };
  return { state, action };
}

describe('shared mission equipment requirements', () => {
  it('changes daylight and night kits and rejects a useless solo radio relay', () => {
    const state = stock();
    const day = autoLoadout(state, 'ms_occupancy', ['A'], NOW);
    const night = autoLoadout(state, 'ms_urgent', ['A'], NOW);
    expect(day.loadouts.A?.portable_light).toBeUndefined();
    expect(night.loadouts.A?.observation_binoculars).toBeUndefined();
    expect(day.loadouts.A?.radio_relay).toBeUndefined();
    expect(night.loadouts.A?.radio_relay).toBeUndefined();
    const clear = structuredClone(SCENARIOS.ms_occupancy.stages.assess.actions.find((a) => a.id === 'ms_gather')!);
    clear.targetId = 'front_yard'; clear.approach = 'none'; clear.spatial = undefined; clear.capabilities = { rules: ['visible_exterior', 'dark_visible_scene'] };
    const id = scenarioWith([clear]);
    SCENARIOS[id].environment = { timeOfDay: 'day', weather: 'clear', power: 'on', clutter: 0, hazards: [], communication: 'normal', crowd: 0, keyholder: false, plansOnFile: false, alarm: 'none', cctv: false };
    SCENARIOS[id].environment!.timeOfDay = 'day'; SCENARIOS[id].environment!.power = 'on';
    expect(autoLoadout(state, id, ['A'], NOW).loadouts.A?.observation_binoculars).toBe(1);
    SCENARIOS[id].environment!.timeOfDay = 'night';
    expect(autoLoadout(state, id, ['A'], NOW).loadouts.A?.portable_light).toBe(1);
  });
  it('ranks actual condition contribution before nominal catalog strength', () => {
    const { state, action } = lessLethalOption();
    for (let i = 1; i <= 4; i++) state.units[unitId('impact_launcher', i)].condition = 11;
    const plan = autoLoadout(state, scenarioWith([action]), ['A'], NOW);
    expect(plan.loadouts.A?.conducted_energy_device).toBe(1);
    expect(plan.loadouts.A?.impact_launcher).toBeUndefined();
    expect(plan.rationale.A?.join(' ')).toMatch(/\+4 points/);
  });
  it('uses setup time as the tie-break for equal condition-adjusted points', () => {
    const { state, action } = lessLethalOption();
    for (const unit of Object.values(state.units)) if (unit.itemId === 'impact_launcher') unit.condition = 30; // 5 x 0.8 = the device's 4
    const plan = autoLoadout(state, scenarioWith([action]), ['A'], NOW);
    expect(plan.loadouts.A?.conducted_energy_device).toBe(1);
    expect(plan.loadouts.A?.impact_launcher).toBeUndefined();
  });
  it('packs the stronger launcher when both are in good condition, so the cases above turn on condition', () => {
    const { state, action } = lessLethalOption();
    const plan = autoLoadout(state, scenarioWith([action]), ['A'], NOW);
    expect(plan.loadouts.A?.impact_launcher).toBe(1);
    expect(plan.loadouts.A?.conducted_energy_device).toBeUndefined();
  });
  it('never packs basic kit for a response action: it adds nothing, and the shotgun is the upgrade', () => {
    const state = makeState({ inventory: { response_shotgun: 1 } });
    for (const id of state.squads[0].officerIds) if (!state.officers[id].certs.includes('entry_team')) state.officers[id].certs.push('entry_team');
    const action = structuredClone(SCENARIOS.ms_occupancy.stages.resolve.actions.find((a) => a.id === 'ms_controlled_entry')!);
    action.targetId = 'front_yard'; action.approach = 'none'; action.requires = {}; action.entry = undefined; action.capabilities = { rules: ['authorized_response'], responseContext: 'constrained' }; action.equipment = [];
    const plan = autoLoadout(state, scenarioWith([action]), ['A'], NOW);
    expect(plan.loadouts.A?.response_shotgun).toBe(1);
    expect(plan.rationale.A?.join(' ')).toMatch(/Response shotgun.*\+6 points, \+1 game min/);
    for (const id of ['radio_kit', 'service_sidearm', 'compact_carbine', 'light_protection']) expect(plan.loadouts.A?.[id], id).toBeUndefined();
  });
  it('does not read hidden truth or hidden people positions when recommending stock', () => {
    const state = stock();
    const source = SCENARIOS.ms_occupancy;
    const id = scenarioWith(Object.values(source.stages).flatMap((stage) => stage.actions));
    const before = autoLoadout(state, id, ['A', 'B'], NOW);
    for (const fact of SCENARIOS[id].facts) { fact.truth = !fact.truth; if (fact.person) fact.person.at = { x: 9999, y: -9999 }; }
    expect(autoLoadout(state, id, ['A', 'B'], NOW)).toEqual(before);
  });
  it('ranks scarce medical stock by the qualified engine lead rather than an unqualified rating', () => {
    const state = makeState({ inventory: { trauma_kit: 1 } });
    for (const officer of Object.values(state.officers)) for (const key of Object.keys(officer.ratings) as (keyof typeof officer.ratings)[]) officer.ratings[key] = officer.squadId === 'A' ? 100 : 60;
    for (const key of Object.keys(state.officers.off_ortiz.ratings) as (keyof typeof state.officers.off_ortiz.ratings)[]) state.officers.off_ortiz.ratings[key] = 5;
    const action = structuredClone(SCENARIOS.ms_urgent.stages.resolve.actions.find((a) => a.consumes?.some((c) => c.tag === 'medkit'))!);
    const plan = autoLoadout(state, scenarioWith([action]), ['A', 'B'], NOW);
    expect(plan.loadouts.B?.trauma_kit).toBe(1);
    expect(plan.loadouts.A?.trauma_kit).toBeUndefined();
  });
  it('gives unqualified manual throw phones no score or wear use', () => {
    const state = stock(); const scenario = SCENARIOS.ms_occupancy;
    const built = getBuilt(scenario.locationFamilyId, scenario.locationSeed);
    const started = apply(withCallOnBoard(state, scenario.id), startCmd(scenario.id, ['B'], { positions: { B: built.location.entries[0] }, loadouts: { B: {} } }));
    expect(started.result.ok).toBe(true);
    const ev = evaluateAction({ state: started.state, run: started.state.activeRun!, scenario, built, action: scenario.stages.assess.actions.find((a) => a.id === 'ms_contact_hall')!, acting: ['B'], support: [], unitOverride: { B: [state.units[unitId('throw_phone')]] } as any });
    expect(ev.contributors.filter((c) => c.ref === 'throw_phone')).toEqual([]);
    expect(ev.uses.filter((u) => u.itemId === 'throw_phone')).toEqual([]);
  });
  it('treats AND, OR, exact counts and required capabilities as one physical bundle', () => {
    const action = structuredClone(SCENARIOS.ms_occupancy.stages.assess.actions.find((a) => a.id === 'ms_contact')!);
    action.requires = { allTags: ['medkit'], anyTags: ['hailer', 'throw_phone'] };
    action.consumes = [{ tag: 'medkit', qty: 2 }, { tag: 'battery', qty: 4 }];
    action.capabilities = { rules: ['specialist_support'], required: ['specialist_support'] };
    expect(actionEquipmentRequirements(action).groups).toHaveLength(3);
    const units = ['trauma_kit', 'loud_hailer', 'precision_rifle'].filter((id) => ITEMS[id]).map((id) => makeUnit(id, 1));
    const specialist = Object.values(ITEMS).find((i) => i.capabilities?.includes('specialist_support'))!;
    const bundle = requiredEquipmentBundle({ action, acting: ['A'], held: [], stock: [...units, makeUnit('trauma_kit', 2), makeUnit(specialist.id, 1)].map((unit) => ({ squadId: 'A', unit })) });
    expect(bundle.missing).toEqual([]);
    expect(bundle.additions.filter((p) => p.unit.itemId === 'trauma_kit')).toHaveLength(2);
    expect(new Set(bundle.additions.map((p) => p.unit.id)).size).toBe(bundle.additions.length);
  });
  it('tries another complete owned alternative when a public context gate rejects the first', () => {
    const action = structuredClone(SCENARIOS.ms_occupancy.stages.assess.actions.find((a) => a.id === 'ms_contact')!);
    action.requires = { anyTags: ['throw_phone', 'hailer'] };
    const phone = makeUnit('throw_phone', 1, { condition: 100 });
    const hailer = makeUnit('loud_hailer', 1, { condition: 90 });
    const tried: string[] = [];
    const plan = requiredEquipmentBundle({ action, acting: ['A'], held: [], stock: [phone, hailer].map((unit) => ({ squadId: 'A', unit })), accept: (additions) => {
      tried.push(additions[0].unit.itemId);
      return additions.some((pick) => pick.unit.itemId === 'loud_hailer') ? null : 'Outside the usable connection path';
    } });
    expect(tried).toEqual(['throw_phone', 'loud_hailer']);
    expect(plan.missing).toEqual([]);
    expect(plan.additions.map((pick) => pick.unit.itemId)).toEqual(['loud_hailer']);
  });
  it('never lets two separately supplied devices share a single consumable', () => {
    const action = structuredClone(SCENARIOS.ms_occupancy.stages.assess.actions[0]);
    const devices = Object.values(ITEMS).filter((i) => i.supplies?.length);
    const first = devices[0], second = devices[1];
    const old = second.supplies; second.supplies = structuredClone(first.supplies);
    try {
      action.requires = { allTags: [first.tags[0], second.tags[0]] }; action.consumes = undefined;
      const supply = first.supplies![0].itemId;
      const make = (n: number) => [makeUnit(first.id, 1), makeUnit(second.id, 1), ...Array.from({ length: n }, (_, i) => makeUnit(supply, i + 1))].map((unit) => ({ squadId: 'A' as const, unit }));
      expect(requiredEquipmentBundle({ action, acting: ['A'], held: [], stock: make(1) }).missing.length).toBeGreaterThan(0);
      expect(requiredEquipmentBundle({ action, acting: ['A'], held: [], stock: make(2) }).missing).toEqual([]);
    } finally { second.supplies = old; }
  });
  it('adds across stages while grouping terminal alternatives only within their stage', () => {
    const action = structuredClone(SCENARIOS.ms_urgent.stages.resolve.actions.find((a) => a.consumes?.some((c) => c.tag === 'medkit'))!);
    const use = [{ tag: 'medkit', qty: 1 }];
    expect(missionConsumptionBudget([{ action, consumes: use }, { action: { ...action, id: 'other' }, consumes: use }, { action: { ...action, id: 'earlier', stage: 'adapt' }, consumes: use }])).toEqual([{ tag: 'medkit', qty: 2 }]);
  });
});
