// Rank insignia drawn in SVG (officer-ranks): chevrons pointing up for Officer, Corporal and
// Sergeant, one gold bar for Lieutenant, and an empty dashed chevron for a probationary officer,
// so every rank has a mark and the ladder reads at a glance even at 14px.
import { RANKS, type RankId } from '../../content/ranks';
import './rank-insignia.css';

/** Chevron height and the step between stacked chevrons, in viewBox units: flat enough that three
 * stay three at 16px. */
const CHEVRON_H = 4.5;
const CHEVRON_GAP = 5;

export function RankInsignia({ rank, size = 18, className = '' }: { rank: RankId; size?: number; className?: string }) {
  const { insignia } = RANKS[rank];
  const count = insignia.kind === 'chevrons' ? insignia.count : 1;
  const top = 12 - ((count - 1) * CHEVRON_GAP + CHEVRON_H) / 2;
  return <svg className={`rank-insignia rank-insignia-${rank}${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {insignia.kind === 'bar' ? <rect className="rank-bar" x="3" y="8.5" width="18" height="7" rx="1.5" />
      : Array.from({ length: count }, (_, index) => {
        const y = top + index * CHEVRON_GAP;
        return <path key={index} className={insignia.kind === 'none' ? 'rank-chevron rank-chevron-empty' : 'rank-chevron'} d={`M4.5 ${y + CHEVRON_H} L12 ${y} L19.5 ${y + CHEVRON_H}`} />;
      })}
  </svg>;
}

/** The rank as a chip: insignia and title, for the profile and candidate cards. */
export function RankChip({ rank, compact = false }: { rank: RankId; compact?: boolean }) {
  return <span className={`chip rank-chip rank-chip-${rank}`} title={RANKS[rank].title}>
    <RankInsignia rank={rank} size={16} />
    {compact ? RANKS[rank].abbr : RANKS[rank].title}
  </span>;
}
