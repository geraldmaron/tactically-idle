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
  /** Total items in the complete target loadouts, including retained choices. */
  total: number;
}

/**
 * Adapt the engine's complete, inventory-checked plan to prepare-screen state.
 * Allocation belongs to autoLoadout so this layer never silently reduces a manual
 * quantity, discards a deliberate zero, or reallocates a unit to another squad.
 */
export function planAuto(args: {
  res: AutoLoadout;
  targets: SquadId[];
  /** Which item a unit belongs to (undefined when the unit no longer exists). */
  itemOf: (unitId: Id) => Id | undefined;
}): AutoPlan {
  const { res, targets, itemOf } = args;
  const out: AutoPlan = { loadouts: {}, explicit: {}, notes: {}, total: 0 };
  for (const sid of new Set(targets)) {
    if (!res.loadouts[sid]) continue;
    const lo = { ...res.loadouts[sid] };
    const ex: Record<Id, Id[]> = {};
    for (const id of res.units[sid] ?? []) {
      const itemId = itemOf(id);
      if (!itemId) continue;
      (ex[itemId] ??= []).push(id);
    }
    out.loadouts[sid] = lo;
    out.explicit[sid] = ex;
    out.notes[sid] = { lines: [...(res.rationale[sid] ?? [])], edited: false };
    out.total += Object.values(lo).reduce((a, b) => a + b, 0);
  }
  return out;
}
