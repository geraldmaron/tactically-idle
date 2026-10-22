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
import { departmentUpkeep } from './equipment-manager-policy';

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
  expect(reserveLoadouts(probe, 'verify', plan.loadouts, plan.units, NOW, departmentUpkeep(probe))).toEqual({ ok: true });
  expect(probe.reservations.map((r) => r.unitId).sort()).toEqual([...ids].sort());
}

describe('auto-equip owned inventory', () => {
  it('reports unavailable stock without buying, settling time, or fabricating units', () => {
    const s = onlyUnits(makeState(), []);
    s.department.restockRules = [{ itemId: 'thermal_imager', target: 2, budgetCeiling: 10000 }];
    const before = structuredClone(s);
    const plan = autoLoadout(s, 'ms_occupancy', ['A', 'B'], NOW + CALENDAR.gameDayMs);
    expect(plan.added).toBe(0);
    expect(plan.loadouts).toEqual({ A: {}, B: {} });
    expect(plan.units).toEqual({ A: [], B: [] });
    // Basic kit is part of every officer (basic-kit.ts): never packed, never short.
    expect(plan.warnings.join(' ')).not.toMatch(/Radio headset/i);
    expect(plan.warnings.join(' ')).toMatch(/Thermal imager/);
    expect(s).toEqual(before);
  });

  it('does not allocate to empty, missing or wholly unavailable squads, and equips who goes from a short one', () => {
    const s = makeState({ squadC: true });
    s.squads[0].officerIds = [];
    s.officers.off_reyes.assignment = { kind: 'training', courseId: 'test', startedAt: NOW, endsAt: NOW + 1000 };
    for (const id of s.squads[2].officerIds) s.officers[id].stress = 80;
    const plan = autoLoadout(s, 'ms_occupancy', ['A', 'B', 'C', 'D'], NOW);
    expect(plan.units.A ?? []).toEqual([]);
    expect(plan.units.C ?? []).toEqual([]);
    expect(plan.warnings.join(' ')).toMatch(/no officers/);
    expect(plan.warnings.join(' ')).toMatch(/mandatory recovery/);
    expect(plan.warnings.join(' ')).toMatch(/does not exist/);
    // Squad B is short Reyes, who is in training: it is still equipped for the three who go (short-squad-deploys).
    expect(plan.warnings.join(' ')).not.toMatch(/training/);
    expect(plan.units.B?.length).toBeGreaterThan(0);
  });

  it('packs real distinct useful units and bounds reusable equipment without a slot cap', () => {
    const s = makeState({ inventory: { thermal_imager: 3, camera_drone: 3 } });
    const plan = autoLoadout(s, 'ms_occupancy', ['A', 'B'], NOW);
    expect(plan.added).toBeGreaterThan(4);
    expect(plan.loadouts.A).toMatchObject({ throw_phone: 1, thermal_imager: 1 });
    expect(plan.loadouts.B).toMatchObject({ thermal_imager: 1 });
    for (const quantities of Object.values(plan.loadouts)) {
      for (const [itemId, qty] of Object.entries(quantities)) if (ITEMS[itemId].kind === 'equipment') expect(qty).toBe(1);
      expect(quantities.radio_kit).toBeUndefined(); // Basic kit is never packed.
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
    expect(full.loadouts.A).toEqual({ throw_phone: 1 });
    delete s.units[unitId('throw_phone')];
    const fallback = autoLoadout(s, scenarioId, ['A'], NOW);
    expect(fallback.loadouts.A).toEqual({ loud_hailer: 1 });
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
    expect(plan.loadouts.A).toEqual({ thermal_imager: 1 });
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
  it('preserves optional quantities and zeros, and never packs basic kit even when asked', () => {
    const s = makeState({ inventory: { thermal_imager: 1, radio_kit: 1 } });
    const radio = unitId('radio_kit');
    const plan = autoLoadout(s, 'ms_occupancy', ['A', 'B'], NOW, {
      loadouts: { A: { radio_kit: 2, throw_phone: 0, thermal_imager: 0 } },
      units: { A: [radio] },
    });
    expect(plan.loadouts.A).toMatchObject({ throw_phone: 0, thermal_imager: 0 });
    expect(plan.loadouts.A?.radio_kit).toBeUndefined();
    expect(Object.values(plan.units).flat()).not.toContain(radio);
    assertActualUnits(s, plan);
  });

  it('preserves unmet manual quantities and reports their exact shortage without fabricated IDs', () => {
    const s = onlyUnits(makeState(), [makeUnit('loud_hailer', 1)]);
    const plan = autoLoadout(s, 'ms_occupancy', ['A'], NOW, { loadouts: { A: { loud_hailer: 4 } } });
    expect(plan.loadouts.A?.loud_hailer).toBe(4);
    expect(plan.units.A).toEqual([unitId('loud_hailer')]);
    expect(plan.warnings.join(' ')).toMatch(/requested 4 Loud hailer; only 1 usable unit available/i);
    expect(s.department.funding).toBe(12400);
  });

  it('changes only target squads while reserving other squads exact picks and quantities', () => {
    const s = makeState({ inventory: { thermal_imager: 1 } });
    const otherHailer = unitId('loud_hailer', 2);
    const otherThermal = unitId('thermal_imager');
    const options = { targets: ['A'] as SquadId[], loadouts: { B: { loud_hailer: 1, thermal_imager: 1 } }, units: { B: [otherHailer, otherThermal] } };
    const before = structuredClone(options);
    const plan = autoLoadout(s, 'ms_occupancy', ['A', 'B'], NOW, options);
    expect(Object.keys(plan.loadouts)).toEqual(['A']);
    expect(Object.keys(plan.units)).toEqual(['A']);
    expect(plan.loadouts.A?.thermal_imager).toBeUndefined();
    expect(plan.units.A).not.toContain(otherHailer); // Exact picks stay with their squad.
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
      makeUnit('loud_hailer', 1, { condition: 90 }),
      makeUnit('loud_hailer', 2, { status: 'service' }),
      makeUnit('loud_hailer', 3, { status: 'reserved' }),
      makeUnit('loud_hailer', 4, { status: 'expired' }),
      makeUnit('loud_hailer', 5, { status: 'scrapped' }),
      makeUnit('loud_hailer', 6, { condition: ITEMS.loud_hailer.wear.failAt }),
      makeUnit('loud_hailer', 7, { expiresAt: NOW }),
      makeUnit('loud_hailer', 8, { condition: 10.4 }), // fails within the 10 projected days
      makeUnit('loud_hailer', 9, { condition: 30 }),
      makeUnit('loud_hailer', 10),
    ]);
    s.reservations.push({ id: 'r', runId: 'existing', squadId: 'B', itemId: 'loud_hailer', unitId: unitId('loud_hailer', 10) });
    expect(autoEquipReadyUnits(s, 'loud_hailer', NOW + 10 * CALENDAR.gameDayMs).map((u) => u.id)).toEqual([unitId('loud_hailer', 1), unitId('loud_hailer', 9)]);
    expect(autoEquipReadyUnits(s, 'loud_hailer', NOW - 1000).map((u) => u.id)).not.toContain(unitId('loud_hailer', 7));
    const plan = autoLoadout(s, 'ms_occupancy', ['A', 'B'], NOW + 10 * CALENDAR.gameDayMs);
    expect(Object.values(plan.units).flat().sort()).toEqual([unitId('loud_hailer', 1), unitId('loud_hailer', 9)].sort());
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
