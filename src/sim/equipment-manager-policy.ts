import type { GameState, ItemDefinition } from './types';
import { DEV_NODES } from '../content/dev-tree';
import { developmentTier, developmentTierDefinition } from './development-tiers';
import { serviceCost, wearFactor, type Upkeep } from './equipment';
import { staffLever, staffPostOf } from './staff-pool';

export const EQUIPMENT_MANAGER = {
  nodeId: 'logistics_equipment_manager',
  repairMultiplier: 0.75,
  wearMultiplier: 0.8,
  serviceBelow: 75,
  maxHourlyBudget: 500,
  fundingReserve: 1000,
  maxConcurrentServices: 2,
} as const;

/** The post is open and a Quartermaster holds it. */
export function hasEquipmentManager(state: GameState): boolean {
  return developmentTier(state, EQUIPMENT_MANAGER.nodeId) > 0 && staffPostOf(state, 'quartermaster').holder !== null;
}

export function equipmentManagerBenefits(state: GameState) {
  const tier = developmentTier(state, EQUIPMENT_MANAGER.nodeId);
  const effect = developmentTierDefinition(DEV_NODES[EQUIPMENT_MANAGER.nodeId], tier)?.effects
    .find((entry) => entry.kind === 'equipmentManager');
  // The Quartermaster's own levers take a further share off the tier's servicing cost and wear.
  const repairDiscount = staffLever(state, 'quartermaster', 0) ?? 0;
  const wearReduction = staffLever(state, 'quartermaster', 1) ?? 0;
  const held = staffPostOf(state, 'quartermaster').holder !== null;
  return {
    tier,
    repairMultiplier: held ? (effect?.repairMultiplier ?? 1) * (1 - repairDiscount) : 1,
    wearMultiplier: held ? (effect?.wearMultiplier ?? 1) * (1 - wearReduction) : 1,
    maxConcurrentServices: held ? effect?.maxConcurrentServices ?? 0 : 0,
  };
}

/** The upkeep the department hands equipment wear and servicing. A single bounded benefit; duplicate unlock IDs can never stack it. */
export function departmentUpkeep(state: GameState): Upkeep {
  const { wearMultiplier, repairMultiplier } = equipmentManagerBenefits(state);
  return { wearMultiplier, repairMultiplier };
}

export function equipmentWearMultiplier(state: GameState, item: ItemDefinition): number {
  return wearFactor(item, departmentUpkeep(state));
}

export function equipmentServiceCost(state: GameState, item: ItemDefinition): number {
  return serviceCost(item, departmentUpkeep(state));
}

/** Missing settings in old saves always mean automatic spending is paused. */
export function maintenanceBudget(state: GameState): number {
  const budget = state.department.maintenanceBudgetPerHour ?? 0;
  return hasEquipmentManager(state) && Number.isInteger(budget) && budget >= 0 && budget <= EQUIPMENT_MANAGER.maxHourlyBudget ? budget : 0;
}
