import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../content/items';
import { SCENARIOS } from '../content/scenarios';
import { autoLoadout } from './auto-equip';
import { makeState, NOW, unitId, apply, startCmd, makeUnit } from './test-fixtures';
import { getScenario } from './scenario-registry';
import { evaluateAction, getBuilt } from './resolution';
import { actionEquipmentRequirements, requiredEquipmentBundle, missionConsumptionBudget } from './equipment-requirements';
import type { ActionDefinition } from './scenario-types';
const testId = 'requirements-regression';
afterEach(() => { delete SCENARIOS[testId]; });
function scenarioWith(actions: ActionDefinition[]) {
  const scenario = structuredClone(SCENARIOS.ms_occupancy); scenario.id = testId;
  for (const stage of Object.values(scenario.stages)) stage.actions = actions.filter((a) => a.stage === stage.id);
  SCENARIOS[testId] = scenario; return testId;
}
const stock = () => makeState({ inventory: Object.fromEntries(Object.values(ITEMS).filter((i) => !i.supportOnly).map((i) => [i.id, i.id === 'radio_kit' ? 8 : 4])) });

describe('shared mission equipment requirements', () => {
  it('changes daylight and night kits and rejects a useless solo radio relay', () => {
    const state = stock();
    const day = autoLoadout(state, 'gen:welfare_check:cedar_close:0:1:1:2', ['A'], NOW);
    const night = autoLoadout(state, 'gen:welfare_check:cedar_close:0:3:1:2', ['A'], NOW);
    expect(day.loadouts.A?.portable_light).toBeUndefined();
    expect(night.loadouts.A?.observation_binoculars).toBeUndefined();
    expect(day.loadouts.A?.radio_relay).toBeUndefined();
    expect(night.loadouts.A?.radio_relay).toBeUndefined();
    const clear = structuredClone(getScenario('gen:welfare_check:cedar_close:0:1:1:2')!.stages.assess.actions.find((a) => a.id === 'gen_observe')!);
    clear.targetId = 'front_yard'; clear.approach = 'none';
    const id = scenarioWith([clear]);
    SCENARIOS[id].environment = structuredClone(getScenario('gen:welfare_check:cedar_close:0:1:1:2')!.environment!);
    SCENARIOS[id].environment!.timeOfDay = 'day'; SCENARIOS[id].environment!.power = 'on';
    expect(autoLoadout(state, id, ['A'], NOW).loadouts.A?.observation_binoculars).toBe(1);
    SCENARIOS[id].environment!.timeOfDay = 'night';
    expect(autoLoadout(state, id, ['A'], NOW).loadouts.A?.portable_light).toBe(1);
  });
  it('ranks actual condition contribution before nominal catalog strength', () => {
    const state = stock();
    const source = getScenario('gen:barricaded:cedar_close:0:1:1:2')!;
    const action = structuredClone(source.stages.adapt.actions.find((a) => a.id === 'gen_protective_containment')!);
    action.targetId = 'front_yard';
    for (const [id, unit] of Object.entries(state.units)) if (unit.itemId === 'response_shotgun') delete state.units[id];
    for (let i = 1; i <= 4; i++) state.units[unitId('compact_carbine', i)].condition = 11;
    const plan = autoLoadout(state, scenarioWith([action]), ['A'], NOW);
    expect(plan.loadouts.A?.service_sidearm).toBe(1);
    expect(plan.loadouts.A?.compact_carbine).toBeUndefined();
    expect(plan.rationale.A?.join(' ')).toMatch(/\+3 points/);
  });
  it('uses setup time as the tie-break for equal condition-adjusted points', () => {
    const state = stock();
    const source = getScenario('gen:barricaded:cedar_close:0:1:1:2')!;
    const action = structuredClone(source.stages.adapt.actions.find((a) => a.id === 'gen_protective_containment')!);
    action.targetId = 'front_yard';
    for (const [id, unit] of Object.entries(state.units)) {
      if (unit.itemId === 'response_shotgun') delete state.units[id];
      if (unit.itemId === 'compact_carbine') unit.condition = 15;
    }
    const plan = autoLoadout(state, scenarioWith([action]), ['A'], NOW);
    expect(plan.loadouts.A?.service_sidearm).toBe(1);
    expect(plan.loadouts.A?.compact_carbine).toBeUndefined();
  });
  it('does not read hidden truth or hidden people positions when recommending stock', () => {
    const state = stock();
    const source = getScenario('gen:welfare_check:cedar_close:0:1:1:2')!;
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
    const state = stock(); const scenario = getScenario('gen:welfare_check:cedar_close:0:1:1:2')!;
    const built = getBuilt(scenario.locationFamilyId, scenario.locationSeed);
    const started = apply(state, startCmd(scenario.id, ['B'], { practice: true, positions: { B: built.location.entries[0] }, loadouts: { B: {} } }));
    expect(started.result.ok).toBe(true);
    const ev = evaluateAction({ state: started.state, run: started.state.activeRun!, scenario, built, action: scenario.stages.assess.actions.find((a) => a.id === 'gen_contact')!, acting: ['B'], support: [], unitOverride: { B: [state.units[unitId('throw_phone')]] } as any });
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
