// Unit-level inventory: every physical item is an ItemUnit with its own
// condition, age and use count. Reservations hold specific units, so two squads
// can never carry the same radio and wear lands on the unit that was used.
import type { GameState, HandlerResult, Id, ItemDefinition, ItemUnit, SquadId } from './types';
import { ITEMS } from '../content/items';

/** Ready, above failAt, not expired. Best condition first. */
export function readyUnits(state: GameState, itemId: Id): ItemUnit[] {
  const def = ITEMS[itemId];
  return Object.values(state.units)
    .filter((u) => u.itemId === itemId && u.status === 'ready' && (!def || u.condition > def.wear.failAt))
    .sort((a, b) => b.condition - a.condition || a.id.localeCompare(b.id));
}

export function readyCount(state: GameState, itemId: Id): number {
  return readyUnits(state, itemId).length;
}

/**
 * 0..1 effectiveness from condition: 1 at/above unreliableBelow, falling to 0.4
 * just above failAt, 0 when failed, expired or scrapped.
 */
export function unitEffectiveness(unit: ItemUnit, def: ItemDefinition): number {
  if (unit.status === 'expired' || unit.status === 'scrapped') return 0;
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
  _now: number,
): HandlerResult {
  const taken = new Set<Id>();
  const picks: { squadId: SquadId; unit: ItemUnit }[] = [];

  for (const [squadId, ids] of Object.entries(explicit ?? {}) as [SquadId, Id[]][]) {
    for (const id of ids ?? []) {
      const u = draft.units[id];
      if (!u) return { ok: false, reason: `Unknown unit ${id}` };
      const def = ITEMS[u.itemId];
      if (taken.has(id)) return { ok: false, reason: `${u.serial} is assigned to two squads` };
      if (u.status !== 'ready') return { ok: false, reason: `${u.serial} is ${u.status === 'service' ? 'in service' : u.status}` };
      if (def && u.condition <= def.wear.failAt) return { ok: false, reason: `${u.serial} has failed and needs service` };
      taken.add(id);
      picks.push({ squadId, unit: u });
    }
  }

  for (const [squadId, items] of Object.entries(loadouts) as [SquadId, Record<Id, number>][]) {
    for (const [itemId, qty] of Object.entries(items ?? {})) {
      const def = ITEMS[itemId];
      if (!def) return { ok: false, reason: `Unknown item ${itemId}` };
      if (!Number.isInteger(qty) || qty < 0) return { ok: false, reason: `Invalid quantity for ${def.name}` };
      const already = picks.filter((p) => p.squadId === squadId && p.unit.itemId === itemId).length;
      const need = qty - already;
      if (need <= 0) continue;
      const pool = readyUnits(draft, itemId).filter((u) => !taken.has(u.id));
      if (pool.length < need) {
        const usable = readyCount(draft, itemId);
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
  _now: number,
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
    const row = (byItem[r.itemId] ??= { used: 0, returned: 0 });
    if (!u || !def) continue;
    const wasUsed = used.has(u.id);
    if (wasUsed) row.used += 1;
    if (def.kind === 'consumable' && wasUsed) {
      delete draft.units[u.id];
      continue;
    }
    if (wasUsed) {
      const before = u.condition;
      u.condition = Math.max(0, Math.round((u.condition - def.wear.perUse * u.wearRate) * 10) / 10);
      u.uses += 1;
      unitWear.push({ unitId: u.id, itemId: u.itemId, serial: u.serial, before, after: u.condition });
    }
    u.status = 'ready';
    row.returned += 1;
  }
  draft.reservations = draft.reservations.filter((x) => x.runId !== runId);
  return { resources: Object.entries(byItem).map(([itemId, v]) => ({ itemId, ...v })), unitWear };
}

/** Units reserved by one squad in a run. */
export function squadUnits(state: GameState, runId: Id, squadId: SquadId): ItemUnit[] {
  const ids = state.reservations.filter((r) => r.runId === runId && r.squadId === squadId).map((r) => r.unitId);
  return ids.map((id) => state.units[id]).filter((u): u is ItemUnit => Boolean(u));
}

/** Capability tags carried by one squad, counting only units that still work. */
export function squadTags(state: GameState, runId: Id, squadId: SquadId): Set<string> {
  const tags = new Set<string>();
  for (const u of squadUnits(state, runId, squadId)) {
    const def = ITEMS[u.itemId];
    if (def && unitEffectiveness(u, def) > 0) for (const t of def.tags) tags.add(t);
  }
  return tags;
}

/** Best working unit carrying a tag for a squad (highest effectiveness), for contributors and wear. */
export function bestUnitWithTag(state: GameState, runId: Id, squadId: SquadId, tag: string): ItemUnit | null {
  let best: ItemUnit | null = null;
  let bestEff = 0;
  for (const u of squadUnits(state, runId, squadId)) {
    const def = ITEMS[u.itemId];
    if (!def?.tags.includes(tag)) continue;
    const eff = unitEffectiveness(u, def);
    if (eff > bestEff) {
      best = u;
      bestEff = eff;
    }
  }
  return best;
}
