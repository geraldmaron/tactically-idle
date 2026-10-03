import type { Officer } from '../../sim/types';
import { CAREER_TUNING, ROLE_MAIN_RATING, learningMultiplier, xpProgress } from '../../sim/career';
import { RATING_META } from './labels';
import { Meter } from './ui';
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

/** XP improves a real role rating; officers do not have a separate level. */
export function OfficerProgress({ officer, day }: { officer: Officer; day: number }) {
  const growth = officerGrowth(officer, day);
  if (!growth) return null;
  const { rating, threshold, current, capped, earned, remaining, progress } = growth;
  return <section className={`officer-progress${capped ? ' officer-progress-capped' : ''}`} aria-label="Experience growth">
    <div className="officer-progress-heading">
      <div><Icon name={rating.icon} size={18} /><strong>{rating.label}</strong></div>
      <span className="officer-progress-rating">{number(current)}{!capped && <><span aria-hidden="true"> → </span><span className="sr-only"> to </span>{number(current + 1)}</>}</span>
    </div>
    {capped ? <>
      <p className="officer-progress-next">XP growth cap reached</p>
      <p className="officer-progress-note">XP increases this rating only while it is below {CAREER_TUNING.xpRatingCeiling}.</p>
    </> : <>
      <Meter value={progress} tone="hi" label={`XP toward the next ${rating.label.toLowerCase()} point`} valueText={`${number(Math.min(earned, threshold))} of ${threshold} XP; ${number(remaining)} XP remaining`} />
      <div className="officer-progress-count"><strong>{number(Math.min(earned, threshold))} / {threshold} XP</strong><span>{remaining > 0 ? `${number(remaining)} XP to +1` : 'Rating point ready'}</span></div>
      <p className="officer-progress-note">Toward the next {rating.label.toLowerCase()} point</p>
    </>}
    <span className="officer-progress-total">{number(officer.xp)} total XP</span>
  </section>;
}
