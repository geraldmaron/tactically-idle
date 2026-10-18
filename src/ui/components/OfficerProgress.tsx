import type { Officer } from '../../sim/types';
import { CAREER_TUNING, ROLE_MAIN_RATING, learningMultiplier, xpProgress } from '../../sim/career';
import { RATING_META } from './labels';
import { Icon } from '../icons';
import './officer-progress.css';

/** A read-only view of the same bank and threshold used by applyXpGrowth. */
export function officerGrowth(o: Officer, day: number) {
  if (!o.career || !Number.isFinite(o.bornDay) || !Number.isFinite(o.serviceStartDay)) return null;
  const key = ROLE_MAIN_RATING[o.role];
  const rating = RATING_META.find((r) => r.key === key)!;
  const threshold = Math.max(1, Math.round(CAREER_TUNING.xpPerPoint / learningMultiplier(o, day)));
  const current = o.ratings[key];
  const capped = current >= CAREER_TUNING.xpRatingCeiling;
  const earned = Math.max(0, o.xp - (o.xpBanked ?? 0));
  return { rating, threshold, current, capped, earned, remaining: Math.max(0, threshold - earned), progress: xpProgress(o, day) * 100 };
}

const number = (value: number) => Number(value.toFixed(1)).toLocaleString('en-US');

/** XP improves a real role rating; officers do not have a separate level. The ring fills toward
 * the next point of the role's main rating. */
export function OfficerProgress({ officer, day }: { officer: Officer; day: number }) {
  const growth = officerGrowth(officer, day);
  if (!growth) return null;
  const { rating, threshold, current, capped, earned, remaining, progress } = growth;
  const shown = Math.min(earned, threshold);
  const ringLabel = `XP toward the next ${rating.label.toLowerCase()} point ${number(shown)} of ${threshold} XP; ${number(remaining)} XP remaining`;
  return <section className={`officer-progress${capped ? ' officer-progress-capped' : ''}`} aria-label="Experience growth">
    <span className="xp-ring" style={{ ['--xp' as string]: `${capped ? 100 : Math.max(0, Math.min(100, progress))}%` }} {...(capped ? { 'aria-hidden': true } : { role: 'img', 'aria-label': ringLabel })}>
      <span className="xp-ring-core"><Icon name={rating.icon} size={18} /></span>
    </span>
    <div className="officer-progress-body">
      <div className="officer-progress-heading">
        <strong>{rating.label}</strong>
        <span className="officer-progress-rating">{number(current)}{!capped && <><span aria-hidden="true"> → </span><span className="sr-only"> to </span>{number(current + 1)}</>}</span>
      </div>
      {capped ? <>
        <p className="officer-progress-next">Experience can’t raise this skill further</p>
        <p className="officer-progress-note">Experience can raise this skill up to {CAREER_TUNING.xpRatingCeiling}.</p>
      </> : <div className="officer-progress-count"><strong>{number(shown)} / {threshold} XP</strong><span>{remaining > 0 ? `${number(remaining)} XP to +1` : 'Rating point ready'}</span></div>}
      <span className="officer-progress-total">{number(officer.xp)} total XP</span>
    </div>
  </section>;
}
