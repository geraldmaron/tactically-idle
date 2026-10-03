import { ITEMS } from '../../content/items';
import type { GameState, Id, ItemDefinition } from '../types';

/** Historical definition only. Old stack migrations must still draw and age each unit. */
export const LEGACY_BATTERY_DEFINITION: ItemDefinition = {
  id: 'battery_pack',
  helpsWith: ['One exact unit powers a declared thermal, camera or relay action.'],
  counters: ['No passive score bonus. Expired batteries cannot be used or serviced.'],
  category: 'supplies',
  name: 'Battery pack',
  kind: 'consumable',
  cost: 40,
  tags: ['battery'],
  description: 'Consumed by thermal and drone use.',
  wear: { perUse: 100, perDay: 0.4, unreliableBelow: 50, failAt: 20, serviceHours: 0, serviceCost: 0, restoreTo: 0, shelfLifeDays: 365 },
};

/** Definitions accepted while converting old stock, including retired equipment. */
export function legacyItemDefinition(id: Id): ItemDefinition | undefined {
  return id === LEGACY_BATTERY_DEFINITION.id ? LEGACY_BATTERY_DEFINITION : ITEMS[id];
}

/**
 * Retire separate power stock in place without changing the recorded operation.
 * Removing the units makes the refund idempotent, including when a save is loaded again.
 */
export function retireLegacyBatteries(state: GameState): { refunded: number; removed: number } {
  const batteryId = LEGACY_BATTERY_DEFINITION.id;
  const consumed = new Set(state.activeRun?.history.flatMap((decision) => decision.unitsUsed) ?? []);
  const unitIds = new Set<Id>();
  let refunded = 0;
  let removed = 0;
  for (const [id, unit] of Object.entries(state.units)) {
    if (unit.itemId !== batteryId) continue;
    unitIds.add(id);
    if (unit.status !== 'scrapped' && !consumed.has(id)) refunded += LEGACY_BATTERY_DEFINITION.cost;
    delete state.units[id];
    removed++;
  }

  const reservationIds = new Set<Id>();
  state.reservations = state.reservations.filter((reservation) => {
    if (reservation.itemId !== batteryId && !unitIds.has(reservation.unitId)) return true;
    unitIds.add(reservation.unitId);
    reservationIds.add(reservation.id);
    return false;
  });
  if (state.activeRun) {
    state.activeRun.reservationIds = state.activeRun.reservationIds.filter((id) => !reservationIds.has(id));
    for (const delivery of state.activeRun.resupplies ?? []) {
      // Preserve elapsed delivery time even when its only supplies have retired.
      delivery.allocations = delivery.allocations
        .map((allocation) => ({ ...allocation, unitIds: allocation.unitIds.filter((id) => !unitIds.has(id)) }))
        .filter((allocation) => allocation.unitIds.length > 0);
    }
  }
  for (const squad of state.squads) delete squad.loadoutPreset[batteryId];
  state.department.restockRules = state.department.restockRules.filter((rule) => rule.itemId !== batteryId);
  if (state.report) state.report.equipment = state.report.equipment.filter((event) => !unitIds.has(event.unitId));
  state.department.funding += refunded;
  return { refunded, removed };
}
