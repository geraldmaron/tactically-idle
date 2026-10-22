// The one place a squad gets its display name. The player names a squad ("Alpha"); the letter is only
// its id and badge. Every surface that writes a squad into text (the sim's reasons and explanations,
// the call screens, the Blueprint's text alternative, the Lab) goes through here, so a rename shows
// everywhere and nothing hardcodes "Alpha" or falls back to "Squad A" for a squad that has a name.
import type { SquadId } from './types';

export interface SquadNameRow { id: SquadId; name: string }

/** A squad as the player names it. An id no squad holds reads "Squad A": only reachable when a
 * message names a squad that does not exist. */
export function squadName(squads: readonly SquadNameRow[], id: SquadId): string {
  return squads.find((squad) => squad.id === id)?.name || `Squad ${id}`;
}

export function squadNamesOf(squads: readonly SquadNameRow[], ids: readonly SquadId[]): string[] {
  return ids.map((id) => squadName(squads, id));
}

/** "Alpha", "Alpha and Bravo", "Alpha, Bravo and Charlie". */
export function joinSquadNames(names: readonly string[]): string {
  return names.length < 2 ? names[0] ?? '' : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
