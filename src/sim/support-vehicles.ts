import { ITEMS } from '../content/items';
import type { Command, GameState, Id, ItemUnit, OperationRun } from './types';
import { readyUnits } from './inventory';
import { getScenario } from './scenario-registry';
import { buildLocation } from './location';

export function practiceSupportUnit(itemId: Id): ItemUnit | null {
  if (!ITEMS[itemId]?.supportOnly) return null;
  return { id: `practice_${itemId}`, itemId, serial: 'PRACTICE', condition: 100, acquiredAt: 0, uses: 0, status: 'reserved', serviceUntil: null, wearRate: 1, expiresAt: null, lastWearAt: 0 };
}
export function supportStartCheck(state: GameState, now: number, cmd: Extract<Command, { type: 'startOperation' }>): string[] {
  const ids = cmd.supportUnitIds ?? [];
  if (ids.length > 1) return ['Choose at most one exterior support vehicle'];
  if (!ids.length) return [];
  const scenario = getScenario(cmd.scenarioId);
  const unit = cmd.practice && ids[0].startsWith('practice_') ? practiceSupportUnit(ids[0].slice('practice_'.length)) : state.units[ids[0]];
  if (!unit || !ITEMS[unit.itemId]?.supportOnly) return ['Choose a valid support vehicle unit'];
  const item = ITEMS[unit.itemId];
  if (cmd.practice) {
    if (!scenario?.practiceOnly && item.requiresNode && !state.department.unlockedNodes.includes(item.requiresNode) && !Object.values(state.units).some((u) => u.itemId === item.id && u.status !== 'scrapped')) return [`Requires ${item.requiresNode.replaceAll('_', ' ')}`];
  } else if (!readyUnits(state, item.id, now).some((u) => u.id === unit.id)) return [`${unit.serial}: support vehicle is reserved, in service, expired or unusable`];
  if (!cmd.squadIds.some((sid) => state.squads.find((s) => s.id === sid)?.officerIds.some((oid) => ['vehicle_operations', ...item.requiresCerts ?? []].every((cert) => (state.officers[oid]?.certs as string[] | undefined)?.includes(cert))))) return ['Support vehicle needs a deployed officer with vehicle operations qualification'];
  if (scenario) {
    const location = buildLocation(scenario.locationFamilyId, scenario.locationSeed);
    const zone = location.location.zones.find((z) => z.id === cmd.positions[cmd.squadIds[0]]);
    if (!zone || zone.tags.includes('vehicle_inaccessible')) return ['Support vehicle needs accessible exterior staging with the lead squad'];
  }
  if (Object.values(cmd.units ?? {}).some((u) => u?.includes(unit.id))) return ['A support vehicle cannot also be carried in a squad loadout'];
  return [];
}

export function reserveSupportVehicle(state: GameState, run: OperationRun): void {
  if (run.practice || !run.supportUnitIds?.length) return;
  const unit = state.units[run.supportUnitIds[0]];
  unit.status = 'reserved';
  const id = `res_${state.nextId++}`;
  state.reservations.push({ id, runId: run.id, squadId: run.squadIds[0], itemId: unit.itemId, unitId: unit.id });
  run.reservationIds.push(id);
}
