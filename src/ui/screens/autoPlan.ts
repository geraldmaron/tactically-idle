// Turns an auto-equip result into prepare-screen state. Pure so it can be tested without the UI.
import type { GameState, Id, ItemUnit, SquadId } from '../../sim/types';
import type { AutoLoadout } from '../../sim/auto-equip';
import type { ActionDefinition } from '../../sim/scenario-types';
import { ITEMS } from '../../content/items';
import { readyUnits } from '../../sim/inventory';

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

/** A deliberate one-click repair of a specific action's missing gear. */
export function planPreparationEquipment(args: {
  state: GameState;
  now: number;
  action: ActionDefinition;
  squadId: SquadId;
  chosen: SquadId[];
  loadouts: Loadouts;
  picks: Partial<Record<SquadId, Record<Id, ItemUnit[]>>>;
}): { loadout: Record<Id, number>; explicit: Record<Id, Id[]>; added: number; label: string; issue: string | null } {
  const { state, now, action, squadId, chosen, loadouts, picks } = args;
  const held = Object.values(picks[squadId] ?? {}).flat();
  const taken = new Set(chosen.flatMap((sid) => Object.values(picks[sid] ?? {}).flat().map((unit) => unit.id)));
  const added: ItemUnit[] = [];
  const all = () => [...held, ...added];
  const take = (tag: string, quantity: number) => {
    let have = all().filter((unit) => ITEMS[unit.itemId].tags.includes(tag)).length;
    const stock = Object.values(ITEMS).filter((item) => item.tags.includes(tag))
      .flatMap((item) => readyUnits(state, item.id, now)).filter((unit) => !taken.has(unit.id));
    if (stock.length < quantity - have) return false;
    for (const unit of stock) {
      if (have >= quantity) break;
      added.push(unit);
      taken.add(unit.id);
      have += 1;
    }
    return true;
  };
  const required = new Map<string, number>();
  for (const tag of action.requires.allTags ?? []) required.set(tag, 1);
  for (const use of action.consumes ?? []) required.set(use.tag, Math.max(required.get(use.tag) ?? 0, use.qty));
  const missing: string[] = [];
  for (const [tag, quantity] of required) {
    if (!take(tag, quantity)) missing.push(Object.values(ITEMS).find((item) => item.tags.includes(tag))?.name ?? tag);
  }
  if (action.requires.anyTags?.length && !action.requires.anyTags.some((tag) => all().some((unit) => ITEMS[unit.itemId].tags.includes(tag)))
    && !action.requires.anyTags.some((tag) => take(tag, 1))) {
    missing.push(action.requires.anyTags.map((tag) => Object.values(ITEMS).find((item) => item.tags.includes(tag))?.name ?? tag).join(' or '));
  }
  const loadout = { ...loadouts[squadId] };
  const explicit: Record<Id, Id[]> = {};
  for (const unit of all()) (explicit[unit.itemId] ??= []).push(unit.id);
  for (const [itemId, ids] of Object.entries(explicit)) loadout[itemId] = Math.max(loadout[itemId] ?? 0, ids.length);
  return {
    loadout, explicit, added: added.length,
    label: [...new Set(added.map((unit) => ITEMS[unit.itemId].name))].join(' + '),
    issue: missing.length ? `No unassigned usable ${missing.join(' / ')} in stock. Buy or service it on the Gear tab.` : null,
  };
}
