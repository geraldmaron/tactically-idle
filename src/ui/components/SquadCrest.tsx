import type { SquadId } from '../../sim/types';

/** A squad's mark: its callsign letter on a squared badge. Squads never wear animal crests (owner,
 * 2026-10-23), so the painted crests in public/art/crests are not drawn. Decorative: the squad's name
 * sits beside it. */
export function SquadCrest({ id, size = 48 }: { id: SquadId; size?: 40 | 48 | 64 }) {
  return <span className={`squad-crest squad-crest-${size} squad-crest-badge`} data-squad={id} aria-hidden="true">
    <span className="squad-crest-letter">{id}</span>
  </span>;
}
