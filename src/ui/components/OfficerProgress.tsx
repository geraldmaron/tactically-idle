import type { Officer } from '../../sim/types';
import { RANKS, RANK_IDS, RANK_TUNING, rankIndex, rankXp, type RankId } from '../../content/ranks';
import { ROLE_MAIN_RATING, promotionEffects, rankProgress } from '../../sim/ranks';
import { promotionText } from '../../sim/career';
import { formatGameDate } from '../../sim/calendar';
import { RATING_META } from './labels';
import { RankInsignia } from './RankInsignia';
import './officer-progress.css';

/** Where an officer stands on the rank ladder: the same thresholds creditXp promotes by. */
export function officerGrowth(o: Officer) {
  const { rank, next, floor, need, progress } = rankProgress(o);
  return { rank, next, floor, need, progress: progress * 100, toGo: need === null ? 0 : Math.max(0, need - o.xp), capped: next === null };
}

const number = (value: number) => Math.round(value).toLocaleString('en-US');

/** The rank, the XP toward the next one, and what that promotion gives this officer. */
export function OfficerProgress({ officer }: { officer: Officer }) {
  const growth = officerGrowth(officer);
  const { rank, next, floor, need, toGo, capped } = growth;
  const gives = next ? promotionText(promotionEffects(officer, next)) : '';
  const ringLabel = next && need !== null ? `${number(officer.xp - floor)} of ${number(need - floor)} XP toward ${RANKS[next].title}; ${number(toGo)} XP to go` : '';
  return <section className={`officer-progress${capped ? ' officer-progress-capped' : ''}`} aria-label="Rank">
    <span className="xp-ring" style={{ ['--xp' as string]: `${capped ? 100 : Math.max(0, Math.min(100, growth.progress))}%` }} {...(capped ? { 'aria-hidden': true } : { role: 'img', 'aria-label': ringLabel })}>
      <span className="xp-ring-core"><RankInsignia rank={rank} size={22} /></span>
    </span>
    <div className="officer-progress-body">
      <div className="officer-progress-heading">
        <strong>{RANKS[rank].title}</strong>
        <span className="officer-progress-rating">{number(officer.xp)} XP</span>
      </div>
      {next && need !== null ? <>
        <div className="officer-progress-count"><strong>{number(toGo)} XP to {RANKS[next].title}</strong><span>{number(officer.xp - floor)} / {number(need - floor)}</span></div>
        {gives && <p className="officer-progress-note">{RANKS[next].title} brings {gives[0].toLowerCase()}{gives.slice(1)}</p>}
      </> : <p className="officer-progress-next">Top rank. XP no longer rises.</p>}
    </div>
  </section>;
}

/** What each rank gives this officer's role in general, for ranks past the next one. */
function nominalGives(o: Officer, rank: RankId): string {
  const i = rankIndex(rank);
  const key = ROLE_MAIN_RATING[o.role];
  const label = RATING_META.find((r) => r.key === key)?.label ?? key;
  const def = RANKS[rank];
  const parts = [
    RANK_TUNING.mainBoost[i] ? `${label} +${RANK_TUNING.mainBoost[i]}` : '',
    RANK_TUNING.composureBoost[i] ? `composure +${RANK_TUNING.composureBoost[i]}` : '',
    def.trait ? `earns ${def.trait.replace('_', ' ')}` : '',
    def.drops ? `no longer ${def.drops}` : '',
    RANK_TUNING.wageStep[i] ? `wage +${RANK_TUNING.wageStep[i]} funding an hour` : '',
  ].filter(Boolean);
  return parts.join(', ');
}

/** The profile's rank ladder (Career tab): every rank, when this officer reached it and why, and
 * what the ranks ahead give. The next rank's line is exact for this officer. */
export function RankLadder({ officer }: { officer: Officer }) {
  const current = rankIndex(rankProgress(officer).rank);
  return <section aria-label="Rank ladder" className="rank-ladder-wrap">
    <h3 className="profile-head">Rank ladder</h3>
    <ol className="rank-ladder">
      {RANK_IDS.map((rank, i) => {
        const state = i < current ? 'reached' : i === current ? 'current' : i === current + 1 ? 'next' : 'later';
        const reached = officer.promotions?.find((p) => p.rank === rank);
        const note = state === 'reached' || state === 'current'
          ? reached ? `Made ${formatGameDate(reached.day)}, ${reached.cause}` : 'Held on joining the department'
          : state === 'next' ? promotionText(promotionEffects(officer, rank)) : nominalGives(officer, rank);
        return <li key={rank} data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
          <span className="rank-ladder-mark"><RankInsignia rank={rank} size={20} /></span>
          <span className="rank-ladder-main">
            <strong>{RANKS[rank].title}</strong>
            <span className="rank-ladder-note">{note}</span>
          </span>
          <span className="rank-ladder-xp">{state === 'current' ? 'Now' : `${number(rankXp(rank))} XP`}</span>
        </li>;
      })}
    </ol>
  </section>;
}
