// Turns an auto-equip result into prepare-screen state. Pure so it can be tested without the UI.
import type { Id, SquadId } from '../../sim/types';
import type { AutoLoadout } from '../../sim/auto-equip';

export type Loadouts = Partial<Record<SquadId, Record<Id, number>>>;
/** Explicit unit picks per squad and item. Editing an item's quantity drops that item's picks. */
export type Explicit = Partial<Record<SquadId, Record<Id, Id[]>>>;
export interface AutoNote {
  lines: string[];
  /** The player changed this squad's loadout after auto-equip filled it. */
  edited: boolean;
}

export interface AutoPlan {
  loadouts: Loadouts;
  explicit: Explicit;
  notes: Partial<Record<SquadId, AutoNote>>;
  /** Total items placed across the targets. */
  total: number;
}

/**
 * `targets` are the squads being changed (all chosen squads, or one). Squads outside `targets` keep what the
 * player set: their quantities reduce what is free, and their unit picks are never reused.
 */
export function planAuto(args: {
  res: AutoLoadout;
  targets: SquadId[];
  chosen: SquadId[];
  /** Current quantities per chosen squad. */
  loadouts: Loadouts;
  /** Unit ids each chosen squad currently takes (flattened). */
  takenBy: Partial<Record<SquadId, Id[]>>;
  /** Which item a unit belongs to (undefined when the unit no longer exists). */
  itemOf: (unitId: Id) => Id | undefined;
  /** Ready units available for an item across the department. */
  ready: (itemId: Id) => number;
}): AutoPlan {
  const { res, targets, chosen, loadouts, takenBy, itemOf, ready } = args;
  const others = chosen.filter((s) => !targets.includes(s));
  const takenElsewhere = new Set<Id>(others.flatMap((s) => takenBy[s] ?? []));
  const heldElsewhere = (itemId: Id) => others.reduce((n, s) => n + (loadouts[s]?.[itemId] ?? 0), 0);

  const out: AutoPlan = { loadouts: {}, explicit: {}, notes: {}, total: 0 };
  // Items handed out so far to targets, so two squads never exceed what is ready.
  const handed = new Map<Id, number>();
  for (const sid of targets) {
    const lo: Record<Id, number> = {};
    for (const [itemId, q] of Object.entries(res.loadouts[sid] ?? {})) {
      const free = Math.max(0, ready(itemId) - heldElsewhere(itemId) - (handed.get(itemId) ?? 0));
      const n = Math.min(q, free);
      if (n > 0) {
        lo[itemId] = n;
        handed.set(itemId, (handed.get(itemId) ?? 0) + n);
      }
    }
    const ex: Record<Id, Id[]> = {};
    for (const id of res.units[sid] ?? []) {
      const itemId = itemOf(id);
      if (!itemId || takenElsewhere.has(id) || !lo[itemId]) continue;
      (ex[itemId] ??= []).push(id);
    }
    for (const itemId of Object.keys(ex)) ex[itemId] = ex[itemId].slice(0, lo[itemId]);
    out.loadouts[sid] = lo;
    out.explicit[sid] = ex;
    out.notes[sid] = { lines: res.rationale[sid] ?? [], edited: false };
    out.total += Object.values(lo).reduce((a, b) => a + b, 0);
  }
  return out;
}
