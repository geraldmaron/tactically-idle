import { describe, expect, it } from 'vitest';
import { generateIncident } from './index';
import { COURSES } from '../../content/courses';
import { ITEMS } from '../../content/items';
import { buildLocation } from '../../sim/location';
import { computeDebrief } from '../../sim/operation';
import { next } from '../../sim/rng';
import { apply, makeState, NOW, setRun, startCmd } from '../../sim/test-fixtures';
import type { IncidentSpec } from '../../sim/scenario-types';

const branches = [
  ['medical_complication', 'gen_medical_aid', 'trauma_kit', 'medical'],
  ['barricaded', 'gen_protected_evacuation', null, 'evacuation'],
  ['business_robbery', 'gen_device_option', 'energy_cartridge', 'Device-class'],
  ['business_robbery', 'gen_impact_option', 'impact_supply', 'Impact-class'],
] as const;
const spec = (type: IncidentSpec['type']): IncidentSpec => ({ type, familyId: type === 'barricaded' ? 'cedar_close' : 'market_row', buildingSeed: 7, seed: 7, tier: 2, contentVersion: 2 });
const sampleSeed = (favorable: boolean) => {
  for (let seed = 1; seed < 100000; seed++) if (favorable ? next(seed).value > .995 : next(seed).value < .005) return seed;
  throw new Error('No test sample');
};
function terminal(type: IncidentSpec['type'], actionId: string, favorable = true) {
  const scenario = generateIncident(spec(type));
  const initial = makeState({ inventory: Object.fromEntries(Object.keys(ITEMS).filter((id) => !ITEMS[id].supportOnly).map((id) => [id, id === 'radio_kit' ? 8 : 2])) });
  for (const o of Object.values(initial.officers)) o.certs = [...new Set(Object.values(COURSES).flatMap((c) => c.grants.cert ? [c.grants.cert] : []))];
  initial.incidents.push({ id: scenario.id, familyId: scenario.locationFamilyId, type, tier: 2, arrivedAt: NOW, expiresAt: NOW + 3600000, seen: false });
  const entry = buildLocation(scenario.locationFamilyId, scenario.locationSeed).location.entries[0];
  const loadout = Object.fromEntries(Object.keys(ITEMS).filter((id) => !ITEMS[id].supportOnly && id !== 'radio_kit').map((id) => [id, 1]));
  const started = apply(initial, startCmd(scenario.id, ['A'], { positions: { A: entry }, loadouts: { A: loadout } }));
  expect(started.result).toEqual({ ok: true });
  const action = scenario.stages.resolve.actions.find((a) => a.id === actionId)!;
  const state = setRun(started.state, { stage: 'resolve', pressure: 0, positions: { A: action.targetId }, knowledge: Object.fromEntries(scenario.facts.map((f) => [f.id, 'confirmed' as const])) });
  // Same verified pre-terminal progress and civilian safety for each alternative.
  state.activeRun!.objective = 42; state.activeRun!.civilianSafety = 100; state.activeRun!.rngState = sampleSeed(favorable);
  const result = apply(state, { type: 'decide', actionId, actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result).toEqual({ ok: true });
  return { state: result.state, resolution: result.state.activeRun!.history[0], debrief: computeDebrief(result.state, result.state.activeRun!)! };
}

describe('terminal capability outcome parity', () => {
  it.each(branches)('%s / %s: favorable completion matches generic resolution reward while retaining declared stock costs', (type, id, supply, copy) => {
    const baseline = terminal(type, 'gen_resolve');
    const specialized = terminal(type, id);
    expect(baseline.resolution.band).toBe('favorable');
    expect(specialized.resolution.band).toBe('favorable');
    expect(specialized.debrief.objective.score).toBe(100);
    expect(specialized.debrief.objective).toEqual(baseline.debrief.objective);
    expect(specialized.debrief.fundingReward).toBe(baseline.debrief.fundingReward);
    expect(specialized.debrief.trustDelta).toBe(baseline.debrief.trustDelta);
    expect(specialized.state.activeRun!.endingId).toBe('resolved');
    expect(specialized.resolution.explanation.join(' ')).toContain(copy);
    if (supply) expect(specialized.resolution.itemsConsumed).toContainEqual({ itemId: supply, qty: 1 });
  });
  it.each(branches)('%s / %s: an adverse committed branch still fails safely to specialist handover and spends its supply', (type, id, supply) => {
    const result = terminal(type, id, false);
    expect(result.resolution.band).toBe('adverse');
    expect(result.state.activeRun!.endingId).toBe('handed_over');
    expect(result.debrief.objective.score).toBe(62);
    expect(result.debrief.civilianSafety.score).toBe(id === 'gen_device_option' || id === 'gen_impact_option' ? 80 : 88);
    if (supply) expect(result.resolution.itemsConsumed).toContainEqual({ itemId: supply, qty: 1 });
    const replay = apply(result.state, { type: 'decide', actionId: id, actingSquadIds: ['A'], supportSquadIds: [] });
    expect(replay.result.ok).toBe(false); expect(replay.state).toBe(result.state);
  });
  it('terminal mixed progress is coherent and nonterminal support retains modest gains', () => {
    for (const [type, id] of branches) {
      const scenario = generateIncident(spec(type));
      const branch = scenario.stages.resolve.actions.find((a) => a.id === id)!;
      expect(branch.outcomes.mixed[0]).toMatchObject({ objective: 38, ending: 'resolved_late', civilian: -4 });
      expect(branch.outcomes.adverse[0].text).not.toBe(branch.outcomes.favorable[0].text);
      for (const action of scenario.stages.adapt.actions.filter((a) => ['gen_protective_containment', 'gen_specialist_support', 'gen_access_mechanical', 'gen_access_charge', 'gen_inspect_opening'].includes(a.id))) {
        expect(action.outcomes.favorable[0].objective).toBe(14);
        expect(action.outcomes.favorable[0].ending).toBeUndefined();
      }
    }
  });
});
