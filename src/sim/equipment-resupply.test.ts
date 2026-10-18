import { afterEach, describe, expect, it } from 'vitest';
import { SCENARIOS } from '../content/scenarios';
import type { ActionDefinition } from './scenario-types';
import { planActionResupply, RESUPPLY_MINUTES } from './equipment-resupply';
import { dispatch } from './game';
import { ITEMS } from '../content/items';
import { actionViews, previewAction } from './operation-selectors';
import { advanceTime, traceRun } from './operation';
import { getScenario } from './scenario-registry';
import { CALENDAR } from './calendar';
import { CampaignSlots, SLOTS_KEY } from './campaign-slots';
import { deserialize, serialize } from './save';
import { apply, makeState, NOW, playPolicy, setRun, startCmd, startRun, unitId } from './test-fixtures';
import type { Command, GameState } from './types';

const request = { type: 'resupplyAction', actionId: 'ms_contact_hall', actingSquadIds: ['A'], supportSquadIds: [] } as const;
const command = () => ({ ...request, actingSquadIds: [...request.actingSquadIds], supportSquadIds: [...request.supportSquadIds] });
const noContactKit = (state = makeState()) => startRun(state, 'ms_occupancy', ['A'], { loadouts: { A: {} } });
const plan = (state: GameState, now = NOW) => planActionResupply(state, now, request.actionId, ['A'], []);
const deliver = (state: GameState) => dispatch(state, command(), { now: NOW });

describe('contextual equipment resupply', () => {
  it('previews the screenshot action without mutating stock, money or the run', () => {
    const state = noContactKit();
    const before = structuredClone(state);
    expect(previewAction(state, NOW, request.actionId, ['A'], [])?.reason).toMatch(/No throw phone or loud hailer/);
    const p = plan(state);
    expect(p).toMatchObject({ ok: true, needed: true, minutes: 3, allocations: [{ squadId: 'A', unitIds: [unitId('throw_phone')] }] });
    expect(p.items[0]).toMatchObject({ name: 'Throw phone', serial: state.units[unitId('throw_phone')].serial });
    expect(state).toEqual(before);
  });

  it('reserves the previewed physical unit, advances normal wait pressure, and unlocks the action', () => {
    const state = noContactKit();
    const expectedTime = { ...state.activeRun! };
    advanceTime(expectedTime, getScenario('ms_occupancy')!, RESUPPLY_MINUTES);
    const { state: next, result } = deliver(state);
    expect(result).toEqual({ ok: true });
    expect(next.activeRun).toMatchObject({ clock: expectedTime.clock, pressure: expectedTime.pressure, civilianSafety: expectedTime.civilianSafety, revision: state.activeRun!.revision + 1, history: [], rngState: state.activeRun!.rngState });
    expect(next.activeRun!.resupplies).toEqual([{ minutes: 3, allocations: [{ squadId: 'A', unitIds: [unitId('throw_phone')] }] }]);
    expect(next.activeRun!.squadTasks).toEqual(state.activeRun!.squadTasks);
    expect(next.activeRun!.knowledge).toEqual(state.activeRun!.knowledge);
    expect(next.units[unitId('throw_phone')].status).toBe('reserved');
    expect(next.reservations.filter((r) => r.unitId === unitId('throw_phone'))).toHaveLength(1);
    expect(next.department.funding).toBe(state.department.funding);
    expect(previewAction(next, NOW, request.actionId, ['A'], [])?.eligible).toBe(true);
  });

  it('refuses duplicate clicks without another reservation, time cost or mutation', () => {
    const state = deliver(noContactKit()).state;
    expect(plan(state)).toMatchObject({ ok: false, needed: false });
    const twice = deliver(state);
    expect(twice.result).toMatchObject({ ok: false, reason: 'Required equipment is already equipped' });
    expect(twice.state).toBe(state);
  });

  it('chooses an available alternative without taking another squad’s allocated phone', () => {
    const state = startRun(makeState(), 'ms_occupancy', ['A', 'B'], { loadouts: { A: {}, B: { throw_phone: 1 } } });
    const p = plan(state);
    expect(p.ok).toBe(true);
    expect(p.items.map((i) => i.itemId)).toEqual(['loud_hailer']);
    const next = deliver(state).state;
    expect(next.reservations.find((r) => r.unitId === unitId('throw_phone'))?.squadId).toBe('B');
    expect(new Set(next.reservations.map((r) => r.unitId)).size).toBe(next.reservations.length);
  });

  it('explains unavailable stock and never purchases or partly allocates it', () => {
    const state = startRun(makeState(), 'ms_occupancy', ['A', 'B'], { loadouts: { A: {}, B: { throw_phone: 1 } } });
    state.units[unitId('loud_hailer')].status = 'service';
    state.units[unitId('loud_hailer', 2)].condition = ITEMS.loud_hailer.wear.failAt;
    expect(plan(state)).toMatchObject({ ok: false, needed: true });
    expect(plan(state).reason).toMatch(/already allocated.*in service.*expired or failed/);
    const attempted = deliver(state);
    expect(attempted.result.ok).toBe(false);
    expect(attempted.state).toBe(state);
  });

  it('rejects expired, failed and stale-preview units using current-time readiness', () => {
    const state = noContactKit(makeState({ inventory: { loud_hailer: 0 } }));
    const phone = state.units[unitId('throw_phone')];
    phone.condition = ITEMS.throw_phone.wear.failAt + 0.01;
    expect(plan(state).ok).toBe(true);
    expect(plan(state, NOW + CALENDAR.gameDayMs).ok).toBe(false);
    phone.status = 'service';
    expect(deliver(state).state).toBe(state);
  });

  it('refuses indoor delivery, later decisions, invalid squads and stale action IDs', () => {
    const staged = noContactKit();
    const inside = setRun(staged, { positions: { A: 'hall' } });
    expect(plan(inside).reason).toMatch(/staged outside/);
    expect(deliver(inside).state).toBe(inside);
    const decided = apply(staged, { type: 'decide', actionId: 'ms_gather', actingSquadIds: ['A'], supportSquadIds: [] }).state;
    expect(planActionResupply(decided, NOW, 'ms_thermal', ['A'], []).reason).toMatch(/before the first decision/);
    for (const cmd of [
      { ...command(), actingSquadIds: ['B'] },
      { ...command(), supportSquadIds: ['A'] },
      { ...command(), actingSquadIds: ['A', 'A'] },
      { ...command(), actionId: 'missing_action' },
    ] satisfies Command[]) {
      expect(dispatch(staged, cmd, { now: NOW }).state).toBe(staged);
    }
    const over = structuredClone(staged);
    over.activeRun!.status = 'debrief';
    over.activeRun!.stage = 'debrief';
    expect(deliver(over).state).toBe(over);
  });

  it('does not offer gear as a false solution to a missing certification', () => {
    const state = noContactKit();
    state.officers.off_chen.certs = [];
    const p = plan(state);
    expect(p).toMatchObject({ ok: false, needed: true, allocations: [] });
    expect(p.reason).toMatch(/Equipment alone.*crisis negotiator/);
    expect(deliver(state).state).toBe(state);
  });

  it('delivers a powered tool alone and refuses an unusable physical tool', () => {
    const equipped = makeState({ inventory: { thermal_imager: 1 } });
    const state = setRun(noContactKit(equipped), { stage: 'adapt' });
    const p = planActionResupply(state, NOW, 'ms_thermal', ['A'], []);
    expect(p.ok).toBe(true);
    expect(p.items.map((i) => i.itemId)).toEqual(['thermal_imager']);
    const next = dispatch(state, { ...command(), actionId: 'ms_thermal' }, { now: NOW });
    expect(next.result.ok).toBe(true);
    expect(previewAction(next.state, NOW, 'ms_thermal', ['A'], [])?.eligible).toBe(true);
    const missing = structuredClone(state);
    for (const unit of Object.values(missing.units)) if (unit.itemId === 'thermal_imager') unit.status = 'service';
    const blocked = planActionResupply(missing, NOW, 'ms_thermal', ['A'], []);
    expect(blocked.reason).toMatch(/No usable unassigned thermal imager/);
    expect(dispatch(missing, { ...command(), actionId: 'ms_thermal' }, { now: NOW }).state).toBe(missing);
  });

  it('charges civilian-safety pressure as ordinary elapsed time and blocks cancellation', () => {
    const state = noContactKit();
    const scenario = getScenario(state.activeRun!.scenarioId)!;
    state.activeRun!.pressure = scenario.pressure.threshold + 1;
    const expected = { ...state.activeRun! };
    advanceTime(expected, scenario, RESUPPLY_MINUTES);
    const next = deliver(state).state;
    expect(next.activeRun!.civilianSafety).toBe(expected.civilianSafety);
    expect(next.activeRun!.civilianSafety).toBeLessThan(state.activeRun!.civilianSafety);
    const cancelled = dispatch(next, { type: 'cancelOperation' }, { now: NOW });
    expect(cancelled.result).toMatchObject({ ok: false });
    expect(cancelled.state).toBe(next);
  });

  it('replays resupply time without counting it as an action, officer participation or equipment use', () => {
    const delivered = deliver(noContactKit()).state;
    const decided = dispatch(delivered, { type: 'decide', actionId: request.actionId, actingSquadIds: ['A'], supportSquadIds: [] }, { now: NOW });
    expect(decided.result.ok).toBe(true);
    const run = decided.state.activeRun!;
    expect(run.history).toHaveLength(1);
    const trace = traceRun(getScenario(run.scenarioId)!, run);
    expect(trace.steps).toHaveLength(1);
    expect(trace.end).toMatchObject({ clock: run.clock, pressure: run.pressure, civilianSafety: run.civilianSafety });
  });

  it('settles delivered units through the normal debrief without losing or duplicating equipment', () => {
    const delivered = deliver(noContactKit()).state;
    const phoneId = unitId('throw_phone');
    const before = delivered.units[phoneId];
    const closed = playPolicy(delivered, { assess: ['ms_contact_hall', 'ms_gather'], adapt: ['ms_preserve_time'], resolve: ['ms_handover'] });
    expect(closed.state.reservations).toEqual([]);
    expect(closed.state.activeRun).toBeNull();
    expect(closed.state.units[phoneId]).toMatchObject({ status: 'ready', uses: before.uses + 1 });
    expect(closed.state.units[phoneId].condition).toBeLessThan(before.condition);
    expect(closed.state.debriefs[0].causes.join(' ')).toMatch(/resupply took 3 min/);
  });

  it('persists a real older staged run in its own slot and reloads the new allocations and delay', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    let seed = 15;
    const saves = new CampaignSlots(storage, NOW, () => seed++);
    expect(saves.newGame(2, 'Inline resupply QA', NOW).ok).toBe(true);
    const otherSlot = JSON.parse(storage.getItem(SLOTS_KEY)!).slots[0];
    expect(saves.send(startCmd('ms_occupancy', ['A'], { loadouts: { A: {} } }), NOW).ok).toBe(true);
    const oldRun = saves.getSnapshot().state;
    expect(oldRun.activeRun!.resupplies).toBeUndefined();
    expect(deserialize(serialize(oldRun, NOW))!.activeRun).toEqual(oldRun.activeRun);
    expect(saves.send(command(), NOW).ok).toBe(true);
    const after = saves.getSnapshot().state;
    const reloaded = new CampaignSlots(storage, NOW, () => 999);
    expect(reloaded.getSnapshot().state.activeRun).toEqual(after.activeRun);
    expect(reloaded.getSnapshot().state.reservations).toEqual(after.reservations);
    expect(JSON.parse(storage.getItem(SLOTS_KEY)!).slots[0]).toEqual(otherSlot);
    expect(actionViews(reloaded.getSnapshot().state, NOW, 'A').find((a) => a.id === request.actionId)?.eligible).toBe(true);
    expect(reloaded.send(command(), NOW).ok).toBe(false);
    expect(reloaded.send({ type: 'cancelOperation' }, NOW).ok).toBe(false);
  });
});


const customIds: string[] = [];
afterEach(() => { for (const id of customIds.splice(0)) delete SCENARIOS[id]; });
function customBundleRun(action: Partial<ActionDefinition>, state = makeState()) {
  const scenario = structuredClone(SCENARIOS.ms_occupancy);
  scenario.id = `resupply_bundle_${customIds.length}`;
  const template = scenario.stages.adapt.actions.find((candidate) => candidate.id === 'ms_thermal')!;
  scenario.stages.assess.actions.unshift({ ...template, id: 'bundle_action', stage: 'assess', targetId: 'front_yard', requires: {}, spatial: undefined, ...action });
  SCENARIOS[scenario.id] = scenario;
  customIds.push(scenario.id);
  return startRun(state, scenario.id, ['A'], { loadouts: { A: {} } });
}
const customBundlePlan = (state: GameState) => planActionResupply(state, NOW, 'bundle_action', ['A'], []);

describe('shared required equipment in live delivery', () => {
  it('delivers required capability equipment without an authored item tag', () => {
    const state = customBundleRun({ capabilities: { rules: ['visible_exterior'], required: ['visible_exterior'] } }, makeState({ inventory: { observation_binoculars: 1 } }));
    const before = structuredClone(state);
    const preview = customBundlePlan(state);
    expect(preview.ok, preview.reason ?? '').toBe(true);
    expect(preview.items.map((item) => item.itemId)).toEqual(['observation_binoculars']);
    expect(state).toEqual(before);
    const delivered = dispatch(state, { type: 'resupplyAction', actionId: 'bundle_action', actingSquadIds: ['A'], supportSquadIds: [] }, { now: NOW });
    expect(delivered.result.ok).toBe(true);
    expect(previewAction(delivered.state, NOW, 'bundle_action', ['A'], [])?.eligible).toBe(true);
  });
  it('includes true companion supplies and refuses the entire bundle if one is missing', () => {
    const initial = makeState({ inventory: { conducted_energy_device: 1, energy_cartridge: 1 } });
    initial.officers.off_chen.certs.push('less_lethal');
    const state = customBundleRun({ requires: { allTags: ['energy_device'] } }, initial);
    expect(customBundlePlan(state).items.map((item) => item.itemId)).toEqual(['conducted_energy_device', 'energy_cartridge']);
    state.units[unitId('energy_cartridge')].status = 'expired';
    const before = structuredClone(state);
    const preview = customBundlePlan(state);
    expect(preview.ok).toBe(false);
    expect(preview.allocations).toEqual([]);
    expect(preview.reason).toMatch(/device cartridge/i);
    expect(state).toEqual(before);
  });
  it('cannot replace unresolved public safety context with equipment delivery', () => {
    const initial = makeState({ inventory: { conducted_energy_device: 1, energy_cartridge: 1 } });
    initial.officers.off_chen.certs.push('less_lethal');
    const state = customBundleRun({ capabilities: { rules: ['less_lethal_device'], required: ['less_lethal_device'], safetyFactIds: ['unconfirmed_safety'], subjectFactIds: ['unconfirmed_subject'] } }, initial);
    const before = structuredClone(state);
    const preview = customBundlePlan(state);
    expect(preview.ok).toBe(false);
    expect(preview.allocations).toEqual([]);
    expect(preview.reason).toMatch(/Equipment alone.*must be confirmed/);
    expect(state).toEqual(before);
  });
  it('reports required capability squad counts before reserving any equipment', () => {
    const initial = makeState({ inventory: { precision_support: 1 } });
    initial.officers.off_chen.certs.push('precision_support');
    const state = customBundleRun({ capabilities: { rules: ['specialist_support'], required: ['specialist_support'] } }, initial);
    expect(customBundlePlan(state)).toMatchObject({ ok: false, allocations: [] });
    expect(customBundlePlan(state).reason).toMatch(/at least two participating squads/);
  });
});
