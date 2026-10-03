import type { GameState, HandlerResult, Id } from './types';
import { ITEMS } from '../content/items';
import { beginService, serviceCheck } from './equipment';
import { EQUIPMENT_MANAGER, hasEquipmentManager, maintenanceBudget } from './equipment-manager-policy';

export function setMaintenanceBudget(state: GameState, perHour: number): HandlerResult {
  if (!hasEquipmentManager(state)) return { ok: false, reason: 'Hire the equipment manager first.' };
  if (!Number.isInteger(perHour) || perHour < 0 || perHour > EQUIPMENT_MANAGER.maxHourlyBudget) {
    return { ok: false, reason: `Choose an hourly service ceiling from $0 to $${EQUIPMENT_MANAGER.maxHourlyBudget}.` };
  }
  state.department.maintenanceBudgetPerHour = perHour;
  return { ok: true };
}

/** Called once at each absolute clock-hour boundary by the shared settlement loop. */
export function runEquipmentMaintenance(state: GameState, now: number): { spent: number; started: Id[] } {
  const budget = maintenanceBudget(state);
  const result = { spent: 0, started: [] as Id[] };
  if (!budget) return result;
  const units = Object.values(state.units);
  // Quantize decisions, not continuous simulation values. Tiny tick-size drift
  // must not change which job starts or whether the treasury floor is met.
  const decisionValue = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
  const reserved = new Set(state.reservations.map((r) => r.unitId));
  let serviceSlots = Math.max(0, EQUIPMENT_MANAGER.maxConcurrentServices - units.filter((u) => u.status === 'service').length);
  const officersNeedingRadios = new Set(state.squads.flatMap((s) => s.officerIds)
    .filter((id) => state.officers[id] && state.officers[id].assignment?.kind !== 'operation')).size;
  let readyRadios = units.filter((u) => u.itemId === 'radio_kit' && u.status === 'ready' && !reserved.has(u.id)
    && decisionValue(u.condition) > ITEMS.radio_kit.wear.failAt && (u.expiresAt === null || u.expiresAt > now)).length;
  const queue = units.filter((u) => u.status === 'ready' && !reserved.has(u.id)
    && ITEMS[u.itemId]?.kind === 'equipment' && decisionValue(u.condition) < EQUIPMENT_MANAGER.serviceBelow)
    .sort((a, b) => decisionValue(a.condition) - decisionValue(b.condition) || a.id.localeCompare(b.id));
  for (const unit of queue) {
    if (serviceSlots <= 0) break;
    const quote = serviceCheck(state, unit.id, now);
    if (!quote.ok || result.spent + quote.cost > budget || decisionValue(state.department.funding - quote.cost) < EQUIPMENT_MANAGER.fundingReserve) continue;
    const takesWorkingRadio = unit.itemId === 'radio_kit' && decisionValue(unit.condition) > ITEMS.radio_kit.wear.failAt;
    // Automatic maintenance must not create a new standard-kit shortage.
    if (takesWorkingRadio && readyRadios - 1 < officersNeedingRadios) continue;
    const started = beginService(state, unit.id, now);
    if (!started.ok) continue;
    // Eliminate only the sub-micro-unit residue accepted at the floor above.
    if (state.department.funding < EQUIPMENT_MANAGER.fundingReserve) state.department.funding = EQUIPMENT_MANAGER.fundingReserve;
    if (takesWorkingRadio) readyRadios--;
    result.spent += quote.cost;
    result.started.push(unit.id);
    serviceSlots--;
  }
  return result;
}
