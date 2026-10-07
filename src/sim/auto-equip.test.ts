import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../content/items';
import { SCENARIOS } from '../content/scenarios';
import { autoEquipReadyUnits, autoLoadout, type AutoLoadout } from './auto-equip';
import { CALENDAR } from './calendar';
import { reserveLoadouts } from './inventory';
import { actionViews } from './operation-selectors';
import type { ActionDefinition } from './scenario-types';
import { apply, makeState, makeUnit, NOW, startCmd, unitId } from './test-fixtures';
import type { GameState, ItemUnit, SquadId } from './types';

const TEST_SCENARIO = 'auto_equip_test';
afterEach(() => { delete SCENARIOS[TEST_SCENARIO]; });

function scenarioWith(actions: ActionDefinition[]): string {
  const s = structuredClone(SCENARIOS.ms_occupancy);
  s.id = TEST_SCENARIO;
  for (const stage of Object.values(s.stages)) stage.actions = actions.filter((a) => a.stage === stage.id);
  SCENARIOS[s.id] = s;
  return s.id;
}

function thermal(over: Partial<ActionDefinition> = {}): ActionDefinition {
  const a = Object.values(SCENARIOS.ms_occupancy.stages).flatMap((s) => s.actions).find((x) => x.requires.allTags?.includes('thermal'))!;
  return { ...structuredClone(a), approach: 'none', ...over };
}

function onlyUnits(state: GameState, units: ItemUnit[]): GameState {
  state.units = Object.fromEntries(units.map((u) => [u.id, u]));
  return state;
}

function assertActualUnits(state: GameState, plan: AutoLoadout) {
  const ids = Object.values(plan.units).flat();
  expect(new Set(ids).size).toBe(ids.length);
  for (const [sid, quantities] of Object.entries(plan.loadouts) as [SquadId, Record<string, number>][]) {
    const picked = plan.units[sid] ?? [];
    for (const [itemId, qty] of Object.entries(quantities)) {
      expect(picked.filter((id) => state.units[id]?.itemId === itemId)).toHaveLength(qty);
    }
    for (const id of picked) expect(state.units[id]?.status).toBe('ready');
  }
  const probe = structuredClone(state);
  expect(reserveLoadouts(probe, 'verify', plan.loadouts, plan.units, NOW)).toEqual({ ok: true });
  expect(probe.reservations.map((r) => r.unitId).sort()).toEqual([...ids].sort());
}

describe('auto-equip owned inventory', () => {
  it('reports unavailable stock without buying, settling time, or fabricating units', () => {
    const s = onlyUnits(makeState(), []);
    s.department.restockRules = [{ itemId: 'thermal_imager', target: 2, budgetCeiling: 10000 }];
    const before = structuredClone(s);
    const plan = autoLoadout(s, 'ms_occupancy', ['A', 'B'], NOW + CALENDAR.gameDayMs);
    expect(plan.added).toBe(0);
    expect(plan.loadouts).toEqual({ A: { radio_kit: 4 }, B: { radio_kit: 4 } });
    expect(plan.units).toEqual({ A: [], B: [] });
    expect(plan.warnings.join(' ')).toMatch(/8 officers need 8 Radio headsets; only 0 usable/i);
    expect(plan.warnings.join(' ')).toMatch(/Thermal imager/);
    expect(s).toEqual(before);
  });

  it('does not allocate to empty, missing, or partly unavailable squads', () => {
    const s = makeState({ squadC: true });
    s.squads[0].officerIds = [];
    s.officers.off_reyes.assignment = { kind: 'training', courseId: 'test', startedAt: NOW, endsAt: NOW + 1000 };
    s.officers.off_holt.stress = 80;
    const plan = autoLoadout(s, 'ms_occupancy', ['A', 'B', 'C', 'D'], NOW);
    expect(plan.added).toBe(0);
    expect(Object.values(plan.units).flat()).toEqual([]);
    expect(plan.warnings.join(' ')).toMatch(/no officers/);
    expect(plan.warnings.join(' ')).toMatch(/training/);
    expect(plan.warnings.join(' ')).toMatch(/mandatory recovery/);
    expect(plan.warnings.join(' ')).toMatch(/does not exist/);
  });

  it('packs real distinct useful units and bounds reusable equipment without a slot cap', () => {
    const s = makeState({ inventory: { thermal_imager: 3, camera_drone: 3 } });
    const plan = autoLoadout(s, 'ms_occupancy', ['A', 'B'], NOW);
    expect(plan.added).toBeGreaterThan(4);
    expect(plan.loadouts.A).toMatchObject({ throw_phone: 1, radio_kit: 4, thermal_imager: 1 });
    expect(plan.loadouts.B).toMatchObject({ radio_kit: 4, thermal_imager: 1 });
    for (const quantities of Object.values(plan.loadouts)) {
      for (const [itemId, qty] of Object.entries(quantities)) if (ITEMS[itemId].kind === 'equipment') expect(qty).toBe(itemId === 'radio_kit' ? 4 : 1);
      expect(quantities.camera_drone).toBeUndefined(); // No drone action in this scenario.
      expect(quantities.trauma_kit).toBeUndefined(); // No medical use here.
    }
    assertActualUnits(s, plan);
  });

  it('uses scenario medical requirements and the strongest qualified medic when kits are scarce', () => {
    const s = makeState({ inventory: { trauma_kit: 1 } });
    const plan = autoLoadout(s, 'ms_urgent', ['B', 'A'], NOW);
    expect(plan.loadouts.A?.trauma_kit).toBe(1);
    expect(plan.loadouts.B?.trauma_kit).toBeUndefined();
    expect(plan.loadouts.A?.throw_phone).toBeUndefined();
    expect(plan.rationale.A?.join(' ')).toMatch(/Trauma kit.*Alpha/);
    expect(plan.warnings.join(' ')).toMatch(/Bravo.*Trauma kit/);
    assertActualUnits(s, plan);
  });

  it('prefers the best contact alternative and falls back to owned hailers', () => {
    const contact = SCENARIOS.ms_occupancy.stages.assess.actions.find((a) => a.id === 'ms_contact')!;
    const scenarioId = scenarioWith([contact]);
    const s = makeState();
    const full = autoLoadout(s, scenarioId, ['A'], NOW);
    expect(full.loadouts.A).toEqual({ radio_kit: 4, throw_phone: 1 });
    delete s.units[unitId('throw_phone')];
    const fallback = autoLoadout(s, scenarioId, ['A'], NOW);
    expect(fallback.loadouts.A).toEqual({ radio_kit: 4, loud_hailer: 1 });
    expect(fallback.warnings).toEqual([]);
  });

  it('assigns cert-gated equipment only to a qualified squad and respects specialist ratings', () => {
    const drone = thermal({ id: 'drone', requires: { certs: ['drone_operator'], allTags: ['drone'] }, equipment: [{ tag: 'drone', value: 5, label: 'drone' }], certBonus: undefined });
    const scenarioId = scenarioWith([drone, thermal()]);
    const s = makeState({ inventory: { camera_drone: 1, thermal_imager: 1 } });
    const plan = autoLoadout(s, scenarioId, ['A', 'B'], NOW);
    expect(plan.loadouts.A?.camera_drone).toBeUndefined();
    expect(plan.loadouts.B?.camera_drone).toBe(1);
    expect(plan.rationale.B?.join(' ')).toMatch(/Camera drone.*Bravo/);
    expect(plan.loadouts.A?.thermal_imager).toBe(1);
    expect(plan.loadouts.B?.thermal_imager).toBeUndefined();
    expect(plan.rationale.A?.join(' ')).toMatch(/Thermal imager.*Alpha/);
    assertActualUnits(s, plan);
  });

  it('treats legacy power as integrated without separate consumable picks', () => {
    const scenarioId = scenarioWith([thermal({ consumes: [{ tag: 'battery', qty: 2 }] })]);
    const s = onlyUnits(makeState(), [makeUnit('thermal_imager', 1)]);
    const plan = autoLoadout(s, scenarioId, ['A'], NOW);
    expect(plan.loadouts.A).toEqual({ radio_kit: 4, thermal_imager: 1 });
    expect(plan.warnings.join(' ')).not.toMatch(/battery/i);
    expect(plan.units.A).toEqual([unitId('thermal_imager')]);
  });

  it('budgets sequential same-stage supplies and shares only terminal alternatives', () => {
    const med = structuredClone(SCENARIOS.ms_urgent.stages.resolve.actions.find((a) => a.consumes?.some((c) => c.tag === 'medkit'))!);
    const sequential = { ...med, stage: 'assess' as const, approach: 'none' as const, outcomes: { favorable: [{ objective: 1 }], mixed: [{ objective: 1 }], adverse: [{ objective: 1 }] } };
    const scenarioId = scenarioWith([
      { ...sequential, id: 'first' }, { ...sequential, id: 'second' },
      { ...med, id: 'terminal1' }, { ...med, id: 'terminal2' },
    ]);
    const s = makeState({ inventory: { trauma_kit: 10 } });
    const plan = autoLoadout(s, scenarioId, ['A'], NOW);
    expect(plan.loadouts.A?.trauma_kit).toBe(3);
    assertActualUnits(s, plan);
  });

  it('excludes overloaded certificate holders from execution recommendations', () => {
    const entry = SCENARIOS.ms_occupancy.stages.resolve.actions.find((a) => a.requires.certs?.includes('entry_team'))!;
    const scenarioId = scenarioWith([{ ...entry, approach: 'none' }]);
    const s = makeState();
    s.officers.off_brooks.stress = 65;
    const plan = autoLoadout(s, scenarioId, ['A', 'B'], NOW);
    expect(plan.loadouts.A?.ballistic_shield).toBeUndefined();
    expect(plan.loadouts.B?.ballistic_shield).toBe(1);
  });
});

describe('manual choices, repeat clicks, and current stock', () => {
  it('preserves optional quantities and zeros while assigning standard radios by condition', () => {
    const s = makeState({ inventory: { thermal_imager: 1 } });
    const radio = unitId('radio_kit', 6);
    s.units[radio].condition = 35;
    const plan = autoLoadout(s, 'ms_occupancy', ['A', 'B'], NOW, {
      loadouts: { A: { radio_kit: 2, throw_phone: 0, thermal_imager: 0 } },
      units: { A: [radio] },
    });
    expect(plan.loadouts.A).toMatchObject({ radio_kit: 4, throw_phone: 0, thermal_imager: 0 });
    expect(plan.units.A).not.toContain(radio);
    expect(plan.units.A?.filter((id) => s.units[id].itemId === 'radio_kit')).toHaveLength(4);
    assertActualUnits(s, plan);
  });

  it('preserves unmet manual quantities and reports their exact shortage without fabricated IDs', () => {
    const s = onlyUnits(makeState(), [makeUnit('radio_kit', 1)]);
    const plan = autoLoadout(s, 'ms_occupancy', ['A'], NOW, { loadouts: { A: { radio_kit: 4 } } });
    expect(plan.loadouts.A?.radio_kit).toBe(4);
    expect(plan.units.A).toEqual([unitId('radio_kit')]);
    expect(plan.warnings.join(' ')).toMatch(/4 officers need 4 Radio headsets; only 1 usable/);
    expect(s.department.funding).toBe(12400);
  });

  it('changes only target squads while reserving other squads exact picks and quantities', () => {
    const s = makeState({ inventory: { thermal_imager: 1, radio_kit: 2 } });
    const otherRadio = unitId('radio_kit', 2);
    const otherThermal = unitId('thermal_imager');
    const options = { targets: ['A'] as SquadId[], loadouts: { B: { radio_kit: 2, thermal_imager: 1 } }, units: { B: [otherRadio, otherThermal] } };
    const before = structuredClone(options);
    const plan = autoLoadout(s, 'ms_occupancy', ['A', 'B'], NOW, options);
    expect(Object.keys(plan.loadouts)).toEqual(['A']);
    expect(Object.keys(plan.units)).toEqual(['A']);
    expect(plan.loadouts.A?.radio_kit).toBe(4);
    expect(plan.loadouts.A?.thermal_imager).toBeUndefined();
    expect(plan.units.A).toContain(otherRadio); // Radios are automatic; optional exact picks stay with their squad.
    expect(plan.units.A).not.toContain(otherThermal);
    expect(options).toEqual(before);
  });

  it('does not grow repeated results, reroll, reorder exact picks, or depend on squad input order', () => {
    const s = makeState({ inventory: { thermal_imager: 3 } });
    const first = autoLoadout(s, 'ms_occupancy', ['A', 'B'], NOW);
    const repeat = autoLoadout(s, 'ms_occupancy', ['B', 'A', 'A'], NOW, first);
    expect(repeat.loadouts).toEqual(first.loadouts);
    expect(repeat.units).toEqual(first.units);
    expect(repeat.added).toBe(0);
    expect(autoLoadout(s, 'ms_occupancy', ['B', 'A'], NOW)).toEqual(first);
  });

  it('ignores stale or duplicate exact picks with explicit warnings and never double allocates a unit', () => {
    const s = makeState();
    const id = unitId('loud_hailer');
    const plan = autoLoadout(s, 'ms_occupancy', ['A', 'B'], NOW, { loadouts: { A: { loud_hailer: 1 }, B: { loud_hailer: 1 } }, units: { A: [id, id, 'missing'], B: [id] } });
    const ids = Object.values(plan.units).flat();
    expect(ids.filter((x) => x === id)).toHaveLength(1);
    expect(ids).not.toContain('missing');
    expect(plan.warnings.join(' ')).toMatch(/already assigned/);
    expect(plan.warnings.join(' ')).toMatch(/missing.*no longer usable/);
    assertActualUnits(s, plan);
  });

  it('never keeps more exact units than a manual item quantity requests', () => {
    const s = makeState();
    const first = unitId('loud_hailer', 1);
    const extra = unitId('loud_hailer', 2);
    const plan = autoLoadout(s, 'ms_occupancy', ['A'], NOW, { loadouts: { A: { loud_hailer: 1 } }, units: { A: [first, extra] } });
    expect(plan.loadouts.A?.loud_hailer).toBe(1);
    expect(plan.units.A).toContain(first);
    expect(plan.units.A).not.toContain(extra);
    expect(plan.warnings.join(' ')).toMatch(/manual quantity already filled/);
    assertActualUnits(s, plan);
  });

  it('filters reservations, status, exact expiry and projected failure using the high-water clock', () => {
    const s = onlyUnits(makeState(), [
      makeUnit('radio_kit', 1, { condition: 90 }),
      makeUnit('radio_kit', 2, { status: 'service' }),
      makeUnit('radio_kit', 3, { status: 'reserved' }),
      makeUnit('radio_kit', 4, { status: 'expired' }),
      makeUnit('radio_kit', 5, { status: 'scrapped' }),
      makeUnit('radio_kit', 6, { condition: ITEMS.radio_kit.wear.failAt }),
      makeUnit('radio_kit', 7, { expiresAt: NOW }),
      makeUnit('radio_kit', 8, { condition: 16 }),
      makeUnit('radio_kit', 9, { condition: 30 }),
      makeUnit('radio_kit', 10),
    ]);
    s.reservations.push({ id: 'r', runId: 'existing', squadId: 'B', itemId: 'radio_kit', unitId: unitId('radio_kit', 10) });
    expect(autoEquipReadyUnits(s, 'radio_kit', NOW + 10 * CALENDAR.gameDayMs).map((u) => u.id)).toEqual([unitId('radio_kit', 1), unitId('radio_kit', 9)]);
    expect(autoEquipReadyUnits(s, 'radio_kit', NOW - 1000).map((u) => u.id)).not.toContain(unitId('radio_kit', 7));
    const plan = autoLoadout(s, 'ms_occupancy', ['A', 'B'], NOW + 10 * CALENDAR.gameDayMs);
    expect(Object.values(plan.units).flat().sort()).toEqual([unitId('radio_kit', 1), unitId('radio_kit', 9)].sort());
  });

  it('does not inspect hidden truth when choosing equipment or explaining it', () => {
    const scenarioId = scenarioWith([thermal()]);
    const s = makeState({ inventory: { thermal_imager: 1 } });
    const first = autoLoadout(s, scenarioId, ['A'], NOW);
    for (const fact of SCENARIOS[scenarioId].facts) {
      fact.truth = !fact.truth;
      fact.person = { label: 'Secret target', at: { x: -999, y: -999 } };
    }
    expect(autoLoadout(s, scenarioId, ['A'], NOW)).toEqual(first);
  });

  it('keeps future story titles, private prerequisites and officer recommendations out of inventory explanations', () => {
    const action = thermal({ title: 'Find the hidden witness behind the boiler', requires: {
      allTags: ['thermal'], facts: [{ factId: 'secret_witness', in: ['confirmed'], reason: 'The hidden witness must name the suspect first' }],
    } });
    const scenarioId = scenarioWith([action]);
    const full = autoLoadout(makeState({ inventory: { thermal_imager: 1 } }), scenarioId, ['A'], NOW);
    const empty = autoLoadout(onlyUnits(makeState(), []), scenarioId, ['A'], NOW);
    const text = [...Object.values(full.rationale).flat(), ...full.warnings, ...empty.warnings].join(' ');
    expect(text).toContain('Thermal imager');
    expect(text).toContain('owned stock');
    expect(text).toContain('required checks');
    for (const secret of ['hidden witness', 'boiler', 'suspect', 'Vale', 'Chen', 'Ortiz']) expect(text).not.toContain(secret);
  });

  it('returns an actionable contact loadout that reserves exactly the planned units', () => {
    const s = makeState();
    const plan = autoLoadout(s, 'ms_occupancy', ['A', 'B'], NOW);
    const live = apply(s, startCmd('ms_occupancy', ['A', 'B'], plan));
    expect(live.result).toEqual({ ok: true });
    expect(live.state.reservations.map((r) => r.unitId).sort()).toEqual(Object.values(plan.units).flat().sort());
    expect(actionViews(live.state, NOW, 'A').find((a) => a.id === 'ms_contact')?.eligible).toBe(true);
    expect(live.state.department.funding).toBe(s.department.funding);
  });
});
