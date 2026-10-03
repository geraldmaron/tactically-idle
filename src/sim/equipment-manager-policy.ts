import type { GameState, ItemDefinition } from './types';
import { DEV_NODES } from '../content/dev-tree';
import { developmentTier, developmentTierDefinition } from './development-tiers';

export const EQUIPMENT_MANAGER = {
  nodeId: 'logistics_equipment_manager',
  repairMultiplier: 0.75,
  wearMultiplier: 0.8,
  serviceBelow: 75,
  maxHourlyBudget: 500,
  fundingReserve: 1000,
  maxConcurrentServices: 2,
} as const;

export function hasEquipmentManager(state: GameState): boolean {
  return developmentTier(state, EQUIPMENT_MANAGER.nodeId) > 0;
}

export function equipmentManagerBenefits(state: GameState) {
  const tier = developmentTier(state, EQUIPMENT_MANAGER.nodeId);
  const effect = developmentTierDefinition(DEV_NODES[EQUIPMENT_MANAGER.nodeId], tier)?.effects
    .find((entry) => entry.kind === 'equipmentManager');
  return {
    tier,
    repairMultiplier: effect?.repairMultiplier ?? 1,
    wearMultiplier: effect?.wearMultiplier ?? 1,
    maxConcurrentServices: effect?.maxConcurrentServices ?? 0,
  };
}

/** A single bounded benefit; duplicate unlock IDs can never stack it. */
export function equipmentWearMultiplier(state: GameState, item: ItemDefinition): number {
  return item.kind === 'equipment' ? equipmentManagerBenefits(state).wearMultiplier : 1;
}

export function equipmentServiceCost(state: GameState, item: ItemDefinition): number {
  const base = item.wear.serviceCost;
  // Integer percentages avoid charging $56 for a $100 repair at 45% off
  // because binary floating point represents 100 * 0.55 just above 55.
  const percent = Math.round(equipmentManagerBenefits(state).repairMultiplier * 100);
  return base > 0 ? Math.max(1, Math.ceil(base * percent / 100)) : 0;
}

/** Missing settings in old saves always mean automatic spending is paused. */
export function maintenanceBudget(state: GameState): number {
  const budget = state.department.maintenanceBudgetPerHour ?? 0;
  return hasEquipmentManager(state) && Number.isInteger(budget) && budget >= 0 && budget <= EQUIPMENT_MANAGER.maxHourlyBudget ? budget : 0;
}
