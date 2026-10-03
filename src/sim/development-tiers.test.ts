import { describe, expect, it } from 'vitest';
import { DEV_NODES } from '../content/dev-tree';
import { ITEMS } from '../content/items';
import { createInitialState } from './department';
import { DEVELOP_HANDLERS } from './develop';
import { nodeOptions } from './department-selectors';
import { developmentTier, developmentTierDefinition, effectiveDevelopmentEffects, maxDevelopmentTier, quoteDevelopment } from './development-tiers';
import { HOUR_MS, ratesAt, recoveryMultiplier, unlockedEffects } from './economy';
import { createUnit, serviceCheck } from './equipment';
import { equipmentManagerBenefits, equipmentServiceCost, equipmentWearMultiplier, maintenanceBudget } from './equipment-manager-policy';
import { runEquipmentMaintenance } from './equipment-manager';
import { dispatch } from './game';
import type { Command, GameState } from './types';

const NOW = Date.UTC(2026, 9, 3, 12);
const prices = {
  personnel_academy: [[3, 2500], [4, 4000], [6, 6500]],
  intel_records: [[1, 1000], [3, 3000], [5, 6000]],
  wellbeing_peer_support: [[2, 1000], [4, 2800], [6, 5000]],
  logistics_equipment_manager: [[3, 2500], [5, 4500], [7, 7500]],
} as const;
const serviceIds = Object.keys(prices) as (keyof typeof prices)[];
function funded() {
  const state = createInitialState(NOW, 71);
  state.department.devPoints = 100;
  state.department.funding = 100_000;
  return state;
}
function apply(state: GameState, command: Command, now = NOW) {
  const result = dispatch(state, command, { now });
  expect(result.result).toEqual({ ok: true });
  return result.state;
}
function buyThrough(state: GameState, nodeId: string, tier: number) {
  for (let target = 1; target <= tier; target++) state = apply(state, { type: 'unlockNode', nodeId, expectedTier: target });
  return state;
}
function workshop(tier: number) {
  const state = buyThrough(funded(), 'logistics_equipment_manager', tier);
  state.units = {};
  for (let i = 0; i < 8; i++) createUnit(state, 'ballistic_shield', NOW, { condition: 20 + i, ageDays: 0 });
  state.department.maintenanceBudgetPerHour = 500;
  return state;
}

describe('development tiers', () => {
  it.each(serviceIds)('quotes and charges each incremental price exactly once for %s', (nodeId) => {
    let state = funded();
    state.department.level = 0; // These upgrades do not depend on nonexistent level progression.
    expect(maxDevelopmentTier(DEV_NODES[nodeId])).toBe(3);
    for (let tier = 1; tier <= 3; tier++) {
      const [dp, funding] = prices[nodeId][tier - 1];
      const before = structuredClone(state);
      const quote = quoteDevelopment(state, nodeId, tier);
      expect(quote).toMatchObject({ ok: true, currentTier: tier - 1, targetTier: tier, maxTier: 3, cost: { dp, funding } });
      expect(quote.effects).toEqual(developmentTierDefinition(DEV_NODES[nodeId], tier)!.effects);
      state = apply(state, { type: 'unlockNode', nodeId, expectedTier: tier });
      expect(state.department.devPoints).toBe(before.department.devPoints - dp);
      expect(state.department.funding).toBe(before.department.funding - funding);
      expect(state.department.developmentTiers[nodeId]).toBe(tier);
      expect(state.department.unlockedNodes.filter((id) => id === nodeId)).toHaveLength(1);
      const repeated = dispatch(state, { type: 'unlockNode', nodeId, expectedTier: tier }, { now: NOW });
      expect(repeated.result.ok).toBe(false);
      expect(repeated.state).toBe(state);
      expect(state.officers).toEqual(before.officers);
      expect(state.rngState).toBe(before.rngState);
    }
    expect(quoteDevelopment(state, nodeId)).toMatchObject({ ok: false, targetTier: null, cost: null, currentTier: 3 });
    expect(nodeOptions(state).find((option) => option.node.id === nodeId)?.status).toBe('unlocked');
  });

  it('applies academy capacity differences and preserves expanded barracks identity', () => {
    let state = funded();
    state = apply(state, { type: 'unlockNode', nodeId: 'personnel_academy' });
    expect(state.department.trainingSlots).toBe(2);
    state = apply(state, { type: 'unlockNode', nodeId: 'personnel_academy', expectedTier: 2 });
    expect(state.department.trainingSlots).toBe(3);
    state = apply(state, { type: 'unlockNode', nodeId: 'personnel_academy', expectedTier: 3 });
    expect(state.department.trainingSlots).toBe(4);
    expect(DEV_NODES.personnel_fourth_squad.name).toBe('Expanded barracks');
    expect(DEV_NODES.personnel_fourth_squad.effects).toEqual([{ kind: 'rosterCap', delta: 4 }]);
    expect(state.department.rosterCap).toBe(12);
  });

  it('reads legacy capacity entitlements without replaying tier I on upgrade', () => {
    let state = funded();
    state.department.unlockedNodes = ['personnel_academy', 'personnel_academy'];
    state.department.trainingSlots = 2;
    expect(developmentTier(state, 'personnel_academy')).toBe(1);
    state = apply(state, { type: 'unlockNode', nodeId: 'personnel_academy', expectedTier: 2 });
    expect(state.department.trainingSlots).toBe(3);
    expect(effectiveDevelopmentEffects(state).filter((effect) => effect.kind === 'trainingSlots')).toEqual([{ kind: 'trainingSlots', delta: 2 }]);
  });

  it('replaces income and recovery totals without multiplying or duplicating prior tiers', () => {
    let state = funded();
    for (let tier = 1; tier <= 3; tier++) {
      state = apply(state, { type: 'unlockNode', nodeId: 'intel_records', expectedTier: tier });
      state = apply(state, { type: 'unlockNode', nodeId: 'wellbeing_peer_support', expectedTier: tier });
      state.department.unlockedNodes.push('intel_records', 'wellbeing_peer_support');
      expect(ratesAt(state, NOW).nodeIncome).toBe([60, 120, 200][tier - 1]);
      expect(recoveryMultiplier(state)).toBe([1.5, 1.75, 2][tier - 1]);
      expect(unlockedEffects(state).filter((effect) => effect.kind === 'income')).toHaveLength(1);
      expect(unlockedEffects(state).filter((effect) => effect.kind === 'recoveryRate')).toHaveLength(1);
    }
  });

  it('refuses unknown, prerequisite, insufficient, skipped, stale, duplicate and max-tier purchases without mutation', () => {
    const state = funded();
    const reject = (candidate: GameState, nodeId: string, expectedTier?: number) => {
      const before = structuredClone(candidate);
      const result = DEVELOP_HANDLERS.unlockNode(candidate, nodeId, expectedTier);
      expect(result.ok).toBe(false);
      expect(candidate).toEqual(before);
      return result.ok ? '' : result.reason;
    };
    expect(reject(state, 'missing')).toMatch(/Unknown/);
    expect(reject(state, 'toString')).toMatch(/Unknown/);
    expect(reject(state, 'intel_drone')).toMatch(/Requires Thermal/);
    expect(reject(state, 'personnel_academy', 2)).toMatch(/review tier I/);
    for (const tier of [0, -1, 1.5, NaN, Infinity]) expect(reject(state, 'intel_records', tier)).toMatch(/review/);
    const tierOne = buyThrough(state, 'personnel_academy', 1);
    expect(reject(tierOne, 'personnel_academy')).toMatch(/review tier II/);
    expect(reject(tierOne, 'personnel_academy', 1)).toMatch(/review tier II/);
    tierOne.department.devPoints = 3;
    expect(reject(tierOne, 'personnel_academy', 2)).toMatch(/Needs 4 development points/);
    tierOne.department.devPoints = 4;
    tierOne.department.funding = 3999;
    expect(reject(tierOne, 'personnel_academy', 2)).toMatch(/Needs \$4,000/);
    const maxed = buyThrough(funded(), 'personnel_academy', 3);
    expect(reject(maxed, 'personnel_academy', 4)).toMatch(/maximum tier/);
  });

  it('keeps programs and licenses one-time and their prerequisites satisfied by any owned tier', () => {
    let state = buyThrough(funded(), 'wellbeing_peer_support', 3);
    expect(quoteDevelopment(state, 'wellbeing_first_aid', 1).ok).toBe(true);
    state = apply(state, { type: 'unlockNode', nodeId: 'wellbeing_first_aid' });
    expect(quoteDevelopment(state, 'wellbeing_first_aid')).toMatchObject({ currentTier: 1, maxTier: 1, targetTier: null });
    expect(DEVELOP_HANDLERS.unlockNode(state, 'wellbeing_first_aid', 2)).toMatchObject({ ok: false, reason: expect.stringMatching(/already unlocked/) });
    expect(Object.values(state.officers).every((officer) => officer.assignment === null)).toBe(true);
    for (const node of Object.values(DEV_NODES).filter((node) => !serviceIds.includes(node.id as keyof typeof prices))) expect(maxDevelopmentTier(node)).toBe(1);
  });

  it.each([1, 2, 3])('uses only equipment-manager tier %i discounts and service capacity', (tier) => {
    const state = workshop(tier);
    const repairMultiplier = [0.75, 0.65, 0.55][tier - 1];
    const wearMultiplier = [0.8, 0.7, 0.6][tier - 1];
    state.department.unlockedNodes.push('logistics_equipment_manager');
    expect(equipmentManagerBenefits(state)).toEqual({ tier, repairMultiplier, wearMultiplier, maxConcurrentServices: tier + 1 });
    expect(equipmentWearMultiplier(state, ITEMS.radio_kit)).toBe(wearMultiplier);
    expect(equipmentWearMultiplier(state, ITEMS.trauma_kit)).toBe(1);
    expect(equipmentServiceCost(state, ITEMS.ballistic_shield)).toBe(Math.ceil(80 * repairMultiplier));
    for (const base of [1, 3, 100, 200]) {
      const item = { ...ITEMS.radio_kit, wear: { ...ITEMS.radio_kit.wear, serviceCost: base } };
      expect(equipmentServiceCost(state, item)).toBe(Math.ceil(base * [75, 65, 55][tier - 1] / 100));
    }
    const first = Object.values(state.units)[0];
    expect(serviceCheck(state, first.id, NOW).cost).toBe(Math.ceil(80 * repairMultiplier));
    const repair = runEquipmentMaintenance(state, NOW);
    expect(repair.started).toHaveLength(tier + 1);
    expect(repair.spent).toBe(Math.ceil(80 * repairMultiplier) * (tier + 1));
  });

  it('preserves the chosen ceiling and paused setting through every manager upgrade', () => {
    for (const budget of [0, 50, 200, 500]) {
      let state = buyThrough(funded(), 'logistics_equipment_manager', 1);
      state.department.maintenanceBudgetPerHour = budget;
      for (let tier = 2; tier <= 3; tier++) {
        state = apply(state, { type: 'unlockNode', nodeId: 'logistics_equipment_manager', expectedTier: tier });
        expect(state.department.maintenanceBudgetPerHour).toBe(budget);
        expect(maintenanceBudget(state)).toBe(budget);
      }
    }
  });

  it.each([1, 2, 3])('preserves reserve, budget, reservations, working radios and manual jobs at tier %i', (tier) => {
    for (const funding of [999, 1000]) {
      const state = workshop(tier);
      state.department.funding = funding;
      expect(runEquipmentMaintenance(state, NOW)).toEqual({ spent: 0, started: [] });
      expect(state.department.funding).toBe(funding);
    }
    const lowBudget = workshop(tier);
    lowBudget.department.maintenanceBudgetPerHour = equipmentServiceCost(lowBudget, ITEMS.ballistic_shield) - 1;
    expect(runEquipmentMaintenance(lowBudget, NOW).spent).toBe(0);
    const state = buyThrough(funded(), 'logistics_equipment_manager', tier);
    state.department.maintenanceBudgetPerHour = 500;
    for (const unit of Object.values(state.units)) unit.condition = unit.itemId === 'radio_kit' ? 50 : 100;
    const reserved = Object.values(state.units).find((unit) => unit.itemId === 'ballistic_shield')!;
    reserved.condition = 20;
    state.reservations.push({ id: 'reservation', runId: 'active', squadId: 'A', itemId: reserved.itemId, unitId: reserved.id });
    expect(runEquipmentMaintenance(state, NOW)).toEqual({ spent: 0, started: [] });
    const occupied = workshop(tier);
    Object.values(occupied.units).slice(0, tier + 1).forEach((unit) => { unit.status = 'service'; unit.serviceUntil = NOW + HOUR_MS; });
    expect(runEquipmentMaintenance(occupied, NOW)).toEqual({ spent: 0, started: [] });
    const exactReserve = workshop(tier);
    const price = equipmentServiceCost(exactReserve, ITEMS.ballistic_shield);
    exactReserve.department.funding = 1000 + price;
    expect(runEquipmentMaintenance(exactReserve, NOW).started).toHaveLength(1);
    expect(exactReserve.department.funding).toBe(1000);
  });

  it.each([1, 2, 3])('matches online and offline income, recovery and repairs at tier %i', (tier) => {
    let start = workshop(tier);
    start = buyThrough(start, 'intel_records', tier);
    start = buyThrough(start, 'wellbeing_peer_support', tier);
    for (const officer of Object.values(start.officers)) officer.stress = 90;
    let online = start;
    for (let time = NOW + 10 * 60_000; time <= NOW + 30 * HOUR_MS; time += 10 * 60_000) online = apply(online, { type: 'tick' }, time);
    const offline = apply(start, { type: 'tick' }, NOW + 30 * HOUR_MS);
    expect(online.department.funding).toBeCloseTo(offline.department.funding, 6);
    expect(online.department.devPoints).toBeCloseTo(offline.department.devPoints, 6);
    expect(online.report?.maintenanceSpend).toBe(offline.report?.maintenanceSpend);
    expect(online.rngState).toBe(offline.rngState);
    for (const id of Object.keys(online.officers)) expect(online.officers[id].stress).toBeCloseTo(offline.officers[id].stress, 6);
    for (const id of Object.keys(online.units)) {
      expect(online.units[id].condition).toBeCloseTo(offline.units[id].condition, 6);
      expect(online.units[id].status).toBe(offline.units[id].status);
      expect(online.units[id].serviceUntil).toBe(offline.units[id].serviceUntil);
    }
    const capped = apply(start, { type: 'tick' }, NOW + 24 * HOUR_MS);
    expect(offline.report?.maintenanceSpend).toBe(capped.report?.maintenanceSpend);
  });
});
