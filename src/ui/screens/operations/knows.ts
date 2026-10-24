// Who on the call knows the person it is about (docs/world-redesign.md, "Officers know people"). Ties on the
// record only: a tie that has not surfaced is never shown, and it never changes odds. Store-free.
import type { GameState, Id } from '../../../sim/types';
import { objectPronoun } from './model';

const NONE: ReadonlyMap<Id, string> = new Map();

/** Officer id to the pronoun the tag uses ("him", "her", "them"), for the run's world subject; empty when the
 * call is not a world call or nobody knows them. */
export function officersWhoKnow(g: Pick<GameState, 'activeRun' | 'people' | 'world'>): ReadonlyMap<Id, string> {
  const ref = g.activeRun?.world;
  if (!ref) return NONE;
  const subject = g.world.subjects[ref.subjectId];
  const ties = g.people.ties.filter((t) => t.subjectId === ref.subjectId && t.onRecord);
  if (!subject || ties.length === 0) return NONE;
  return new Map(ties.map((t) => [t.officerId, objectPronoun(subject.pronouns)]));
}
