import { describe, expect, it } from 'vitest';
import { INCIDENT_CONTENT_VERSION, incidentId } from '../gen/incident';
import { emptyTestWallet } from '../commerce/ledger';
import { CampaignSlots, SLOTS_KEY } from './campaign-slots';
import { createInitialState } from './department';
import { buildLocation } from './location';
import { computeDebrief } from './operation';
import { bandFor, builtFor, evaluateAction } from './resolution';
import { next } from './rng';
import { deserialize, serialize } from './save';
import { getScenario } from './scenario-registry';
import { scenarioActions } from './scenario-types';
import { apply, NOW, startRun } from './test-fixtures';
import type { GameState, OutcomeBand } from './types';

function issued(version: number): GameState {
  const state = createInitialState(NOW, 812);
  state.contentVersion = version;
  const id = incidentId({ type: 'welfare_check', familyId: 'cedar_close', buildingSeed: 7, seed: 7, tier: 2, contentVersion: version });
  const scenario = getScenario(id)!;
  state.incidents = [{ id, type: 'welfare_check', familyId: 'cedar_close', tier: 2, arrivedAt: NOW, expiresAt: NOW + 3_600_000, seen: false }];
  const entry = buildLocation(scenario.locationFamilyId, scenario.locationSeed).location.entries[0];
  return startRun(state, id, ['A'], { positions: { A: entry }, loadouts: { A: {} } });
}

function choose(state: GameState, id: string, band: OutcomeBand): GameState {
  const prior = structuredClone(state);
  const run = prior.activeRun!;
  const scenario = getScenario(run.scenarioId)!;
  const action = scenarioActions(scenario).find(candidate => candidate.id === id)!;
  const ev = evaluateAction({ state: prior, run, scenario, action, built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting: ['A'], support: [] });
  expect(ev.eligible, `${id}: ${ev.reason}`).toBe(true);
  let found = false;
  for (let seed = 1; seed < 100_000; seed++) {
    if (bandFor(ev.margin, next(seed).value) === band) { run.rngState = seed; found = true; break; }
  }
  expect(found).toBe(true);
  const result = apply(prior, { type: 'decide', actionId: id, actingSquadIds: ['A'], supportSquadIds: [] });
  expect(result.result).toEqual({ ok: true });
  expect(result.state.activeRun!.history.at(-1)!.band).toBe(band);
  return result.state;
}

function pending(version: number): GameState {
  let state = issued(version);
  const ids = version === 3
    ? ['v3_welfare_contact', 'v3_welfare_reconcile', 'v3_welfare_proceed', 'v3_welfare_handover']
    : ['gen_contact', 'gen_coordinate', 'gen_handover'];
  for (const [index, id] of ids.entries()) state = choose(state, id, index === ids.length - 1 ? 'mixed' : 'favorable');
  expect(state.activeRun!.status).toBe('debrief');
  return state;
}

describe('v4 release preserves issued legacy responsibilities and rewards', () => {
  it.each([1, 2, 3])('v%s active and pending runs retain exact state through repeated reloads', version => {
    for (const old of [issued(version), pending(version)]) {
      const before = structuredClone(old);
      const debrief = old.activeRun!.status === 'debrief' ? computeDebrief(old, old.activeRun!) : null;
      const first = deserialize(serialize(old, NOW))!;
      expect(first).not.toBeNull();
      expect(first.contentVersion).toBe(INCIDENT_CONTENT_VERSION);
      expect(first.activeRun).toEqual(before.activeRun);
      expect(first.rngState).toBe(before.rngState);
      expect(first.incidents).toEqual(before.incidents);
      expect(first.officers).toEqual(before.officers);
      expect(first.units).toEqual(before.units);
      expect(first.reservations).toEqual(before.reservations);
      expect(deserialize(serialize(first, NOW))).toEqual(first);
      if (debrief) {
        // Rewards and responsibilities are unchanged; at the current content version the call
        // also earns department service (save v7).
        const { serviceEarned, levelReached, ...loaded } = computeDebrief(first, first.activeRun!)!;
        expect(loaded).toEqual(debrief);
        expect(serviceEarned).toBeGreaterThan(0);
        void levelReached;
      }
    }
  });

  it.each([1, 2, 3])('v%s keeps its original partial-handover settlement, charged exactly once', version => {
    const state = pending(version);
    const run = state.activeRun!;
    const scenario = getScenario(run.scenarioId)!;
    const report = computeDebrief(state, run)!;
    const factor = (0.55 * run.objective + 0.45 * run.civilianSafety) / 100;
    expect(run.objective).toBe(version === 3 ? 48 : 59);
    expect(report.fundingReward).toBe(Math.round(scenario.rewards.funding * (0.4 + 0.6 * factor)));
    expect(report.devPointReward).toBe(scenario.rewards.devPoints);
    expect(report.disposition).toBeUndefined();
    const loaded = deserialize(serialize(state, NOW))!;
    const result = apply(loaded, { type: 'closeDebrief' });
    expect(result.result).toEqual({ ok: true });
    expect(result.state.department.funding - loaded.department.funding).toBe(report.fundingReward);
    expect(result.state.department.devPoints - loaded.department.devPoints).toBe(report.devPointReward);
    // Loading lifts the campaign to the current content version, so the closed call also earns
    // department service (save v7); the debrief saved is the one the loaded campaign shows.
    expect(result.state.debriefs[0]).toEqual(computeDebrief(loaded, loaded.activeRun!));
    expect(result.state.debriefs[0]).toEqual({ ...report, serviceEarned: result.state.debriefs[0].serviceEarned });
    const again = apply(result.state, { type: 'closeDebrief' });
    expect(again.result.ok).toBe(false);
    expect(again.state).toBe(result.state);
  });

  it('loads all ten mixed-version slots without losing pending calls, balances or wallet data', () => {
    const legacy = [pending(1), pending(2), pending(3)];
    const wallet = emptyTestWallet();
    const slots = Array.from({ length: 10 }, (_, index) => ({ campaignId: `legacy_${index}`, name: `Saved ${index + 1}`, createdAt: NOW, savedAt: NOW, data: serialize(legacy[index % 3], NOW) }));
    const entries = new Map([[SLOTS_KEY, JSON.stringify({ version: 2, commerce: wallet, activeSlotId: 1, slots })]]);
    const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
    const saves = new CampaignSlots(storage, NOW, () => 991);
    for (let id = 1; id <= 10; id++) {
      expect(saves.load(id, NOW).ok).toBe(true);
      const snap = saves.getSnapshot();
      expect(snap.activeSlotId).toBe(id);
      expect(snap.state.activeRun).toEqual(legacy[(id - 1) % 3].activeRun);
      expect(snap.state.department.funding).toBe(legacy[(id - 1) % 3].department.funding);
      expect(snap.state.rngState).toBe(legacy[(id - 1) % 3].rngState);
      expect(snap.commerce).toEqual(wallet);
      expect(snap.slots.filter(slot => slot?.valid)).toHaveLength(10);
    }
  });
});
