// Basic kit (owner decision 2026-10-21): every officer carries a radio headset, a service sidearm,
// a carbine and light body armor. It belongs to the officer, not the armory: no certification, no
// unlock, no stock, no wear, no shortage and no score bonus, since a bonus everyone has raises every
// call alike. Bonuses and progression live on advanced gear (content/dev-tree.ts).
//
// Rules that ask what a squad carries (the radio link in resolution.ts, a force tool in
// force-risk.ts) see one built-in unit of each per squad. Best-of-group means one unit is all any
// rule reads. Built-in units have no reservation, so they are never worn, settled or recorded as
// used (operation.ts keeps them out of `unitsUsed`).
import type { GameState, Id, ItemUnit, SquadId } from './types';

export const BASIC_KIT: readonly Id[] = ['radio_kit', 'service_sidearm', 'compact_carbine', 'light_protection'];

/** What the team step and the Armory say about it. */
export const BASIC_KIT_LINE = 'Every officer carries a radio headset, a sidearm, a carbine and light body armor.';

export const isBasicKit = (itemId: Id): boolean => BASIC_KIT.includes(itemId);

const PREFIX = 'basic:';

/** A built-in unit's id: never a key in `state.units`. */
export const isBasicUnit = (unitId: Id): boolean => unitId.startsWith(PREFIX);

/** The basic kit a squad carries, as units the rules can read. */
export function basicUnits(squadId: SquadId): ItemUnit[] {
  return BASIC_KIT.map((itemId) => ({
    id: `${PREFIX}${squadId}:${itemId}`, itemId, serial: 'Issued', condition: 100, acquiredAt: 0, uses: 0,
    status: 'reserved', serviceUntil: null, wearRate: 1, expiresAt: null, lastWearAt: 0,
  }));
}

/** A deploy command's loadouts and unit picks with any basic kit taken out: it is never packed. */
export function withoutBasicKit(state: GameState, loadouts: Partial<Record<SquadId, Record<Id, number>>>, units?: Partial<Record<SquadId, Id[]>>) {
  const nextLoadouts: Partial<Record<SquadId, Record<Id, number>>> = {};
  for (const [sid, loadout] of Object.entries(loadouts) as [SquadId, Record<Id, number>][]) nextLoadouts[sid] = Object.fromEntries(Object.entries(loadout ?? {}).filter(([itemId]) => !isBasicKit(itemId)));
  const nextUnits = units && Object.fromEntries((Object.entries(units) as [SquadId, Id[]][]).map(([sid, ids]) => [sid, (ids ?? []).filter((id) => !isBasicKit(state.units[id]?.itemId ?? ''))])) as Partial<Record<SquadId, Id[]>>;
  return { loadouts: nextLoadouts, units: nextUnits };
}
