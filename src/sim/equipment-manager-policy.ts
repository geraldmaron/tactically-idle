import type { GameState, ItemDefinition } from './types';

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
  return state.department.unlockedNodes.includes(EQUIPMENT_MANAGER.nodeId);
}

/** A single bounded benefit; duplicate unlock IDs can never stack it. */
export function equipmentWearMultiplier(state: GameState, item: ItemDefinition): number {
  return item.kind === 'equipment' && hasEquipmentManager(state) ? EQUIPMENT_MANAGER.wearMultiplier : 1;
}

export function equipmentServiceCost(state: GameState, item: ItemDefinition): number {
  const base = item.wear.serviceCost;
  return base > 0 ? Math.max(1, Math.ceil(base * (hasEquipmentManager(state) ? EQUIPMENT_MANAGER.repairMultiplier : 1))) : 0;
}

/** Missing settings in old saves always mean automatic spending is paused. */
export function maintenanceBudget(state: GameState): number {
  const budget = state.department.maintenanceBudgetPerHour ?? 0;
  return hasEquipmentManager(state) && Number.isInteger(budget) && budget >= 0 && budget <= EQUIPMENT_MANAGER.maxHourlyBudget ? budget : 0;
}
