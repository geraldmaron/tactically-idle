// Unit-level inventory: every physical item is an ItemUnit with its own
// condition, age and use count. Reservations hold specific units, so two squads
// can never carry the same radio and wear lands on the unit that was used.
import type { GameState, HandlerResult, Id, ItemDefinition, ItemUnit, SquadId } from './types';
import { ITEMS } from '../content/items';
import { projectedCondition, wearFactor, type Upkeep } from './equipment';
import { basicUnits } from './basic-kit';

/** Ready, above failAt, not expired. Best condition first. */
export function readyUnits(state: GameState, itemId: Id, upkeep: Upkeep, now = state.department.clockHighWater): ItemUnit[] {
  const def = ITEMS[itemId];
  if (!def || def.kind === 'infrastructure') return [];
  const time = Math.max(now, state.department.clockHighWater);
  const reserved = new Set(state.reservations.map((r) => r.unitId));
  return Object.values(state.units)
    .filter((u) => u.itemId === itemId && u.status === 'ready' && !reserved.has(u.id)
      && (u.expiresAt === null || u.expiresAt > time) && projectedCondition(state, u, time, upkeep) > def.wear.failAt)
    .sort((a, b) => projectedCondition(state, b, time, upkeep) - projectedCondition(state, a, time, upkeep) || a.id.localeCompare(b.id));
}

export function readyCount(state: GameState, itemId: Id, upkeep: Upkeep, now = state.department.clockHighWater): number {
  return readyUnits(state, itemId, upkeep, now).length;
}

/**
 * 0..1 effectiveness from condition: 1 at/above unreliableBelow, falling to 0.4
 * just above failAt, 0 when failed, expired or scrapped.
 */
export function unitEffectiveness(unit: ItemUnit, def: ItemDefinition): number {
  if (unit.status === 'expired' || unit.status === 'scrapped' || unit.status === 'service') return 0;
  const { failAt, unreliableBelow } = def.wear;
  if (unit.condition <= failAt) return 0;
  if (unit.condition >= unreliableBelow) return 1;
  return 0.4 + (0.6 * (unit.condition - failAt)) / Math.max(1, unreliableBelow - failAt);
}

/** Reserve units for every squad of a run, or nothing. Explicit picks first, then best ready units. */
export function reserveLoadouts(
  draft: GameState,
  runId: Id,
  loadouts: Partial<Record<SquadId, Record<Id, number>>>,
  explicit: Partial<Record<SquadId, Id[]>> | undefined,
  now: number,
  upkeep: Upkeep,
): HandlerResult {
  const taken = new Set<Id>();
  const picks: { squadId: SquadId; unit: ItemUnit }[] = [];

  for (const [squadId, ids] of Object.entries(explicit ?? {}) as [SquadId, Id[]][]) {
    for (const id of ids ?? []) {
      const u = draft.units[id];
      if (!u) return { ok: false, reason: `Unknown unit ${id}` };
      const def = ITEMS[u.itemId];
      if (def?.supportOnly) return { ok: false, reason: `${def.name} belongs in the exterior support slot, not a carried loadout` };
      if (taken.has(id)) return { ok: false, reason: `${u.serial} is assigned to two squads` };
      if (u.status !== 'ready') return { ok: false, reason: `${u.serial} is ${u.status === 'service' ? 'in service' : u.status}` };
      if (def && projectedCondition(draft, u, Math.max(now, draft.department.clockHighWater), upkeep) <= def.wear.failAt) return { ok: false, reason: `${u.serial} has failed and needs service` };
      if (!readyUnits(draft, u.itemId, upkeep, now).some((ready) => ready.id === id)) return { ok: false, reason: `${u.serial} is expired or already reserved` };
      taken.add(id);
      picks.push({ squadId, unit: u });
    }
  }

  for (const [squadId, items] of Object.entries(loadouts) as [SquadId, Record<Id, number>][]) {
    for (const [itemId, qty] of Object.entries(items ?? {})) {
      const def = ITEMS[itemId];
      if (!def) return { ok: false, reason: `Unknown item ${itemId}` };
      if (def.supportOnly && qty > 0) return { ok: false, reason: `${def.name} belongs in the exterior support slot, not a carried loadout` };
      if (!Number.isInteger(qty) || qty < 0) return { ok: false, reason: `Invalid quantity for ${def.name}` };
      const already = picks.filter((p) => p.squadId === squadId && p.unit.itemId === itemId).length;
      const need = qty - already;
      if (need <= 0) continue;
      const pool = readyUnits(draft, itemId, upkeep, now).filter((u) => !taken.has(u.id));
      if (pool.length < need) {
        const usable = readyCount(draft, itemId, upkeep, now);
        return { ok: false, reason: `Only ${usable} usable ${def.name} (requested ${qty + countOther(picks, squadId, itemId)})` };
      }
      for (const u of pool.slice(0, need)) {
        taken.add(u.id);
        picks.push({ squadId, unit: u });
      }
    }
  }

  for (const { squadId, unit } of picks) {
    unit.status = 'reserved';
    draft.reservations.push({ id: `res_${draft.nextId++}`, runId, squadId, itemId: unit.itemId, unitId: unit.id });
  }
  return { ok: true };
}

function countOther(picks: { squadId: SquadId; unit: ItemUnit }[], squadId: SquadId, itemId: Id): number {
  return picks.filter((p) => p.squadId !== squadId && p.unit.itemId === itemId).length;
}

/** Cancel: release a run's units untouched. */
export function releaseRun(draft: GameState, runId: Id): void {
  for (const r of draft.reservations.filter((x) => x.runId === runId)) {
    const u = draft.units[r.unitId];
    if (u && u.status === 'reserved') u.status = 'ready';
  }
  draft.reservations = draft.reservations.filter((x) => x.runId !== runId);
}

/**
 * Debrief: used equipment takes per-use wear scaled by its own wearRate; used
 * consumables leave inventory; everything returns ready. Idempotent: a second
 * call finds no reservations.
 */
export function settleRun(
  draft: GameState,
  runId: Id,
  unitsUsed: Id[],
  upkeep: Upkeep,
): {
  resources: { itemId: Id; used: number; returned: number }[];
  unitWear: { unitId: Id; itemId: Id; serial: string; before: number; after: number }[];
} {
  const used = new Set(unitsUsed);
  const byItem: Record<Id, { used: number; returned: number }> = {};
  const unitWear: { unitId: Id; itemId: Id; serial: string; before: number; after: number }[] = [];

  for (const r of draft.reservations.filter((x) => x.runId === runId)) {
    const u = draft.units[r.unitId];
    const def = ITEMS[r.itemId];
    if (!u || !def) continue;
    const row = (byItem[r.itemId] ??= { used: 0, returned: 0 });
    const wasUsed = used.has(u.id);
    if (wasUsed) row.used += 1;
    if (def.kind === 'consumable' && wasUsed) {
      delete draft.units[u.id];
      continue;
    }
    if (wasUsed) {
      const before = u.condition;
      u.condition = Math.max(0, Math.round((u.condition - def.wear.perUse * u.wearRate * wearFactor(def, upkeep)) * 10) / 10);
      u.uses += 1;
      unitWear.push({ unitId: u.id, itemId: u.itemId, serial: u.serial, before, after: u.condition });
    }
    u.status = 'ready';
    row.returned += 1;
  }
  draft.reservations = draft.reservations.filter((x) => x.runId !== runId);
  return { resources: Object.entries(byItem).map(([itemId, v]) => ({ itemId, ...v })), unitWear };
}

/** Units one squad carries in a run: its reservations, plus the basic kit every officer carries. */
export function squadUnits(state: GameState, runId: Id, squadId: SquadId): ItemUnit[] {
  const ids = state.reservations.filter((r) => r.runId === runId && r.squadId === squadId).map((r) => r.unitId);
  return [...ids.map((id) => state.units[id]).filter((u): u is ItemUnit => Boolean(u) && !ITEMS[u.itemId]?.supportOnly), ...basicUnits(squadId)];
}
