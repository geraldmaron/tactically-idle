import type { Officer } from '../../sim/types';
import { ageYears, formatGameDate, gameDay, serviceYears } from '../../sim/calendar';
import { experienceBand, rankOf, type ExperienceBand, type RankId } from '../../sim/ranks';
import { useGame } from '../store';
import { gameDays } from '../format';
import { Chip } from './ui';

export interface CareerSnapshot {
  age: number;
  service: number;
  band: ExperienceBand;
  rank: RankId;
  retirement: { date: string; inDays: number; reason: string } | null;
}

const REASON: Record<string, string> = { age: 'age', service: 'service', burnout: 'burnout' };

/** Calendar-derived career facts. Used where the careerInfo selector is not worth a full call (cards, lists). */
export function useCareerSnapshot(o: Officer): CareerSnapshot {
  const g = useGame();
  const day = gameDay(g, Date.now());
  return {
    age: Math.floor(ageYears(o, day)),
    service: serviceYears(o, day),
    band: experienceBand(o),
    rank: rankOf(o),
    retirement: o.retirement
      ? { date: formatGameDate(o.retirement.day), inDays: Math.max(0, Math.ceil(o.retirement.day - day)), reason: REASON[o.retirement.reason] ?? o.retirement.reason }
      : null,
  };
}

export function RetirementChip({ date, inDays, compact }: { date: string; inDays: number; compact?: boolean }) {
  return (
    <Chip tone="warn" icon="retire" title={`Retires ${date}`}>
      {compact ? `Retiring · ${gameDays(inDays)}` : `Retires ${date} · ${gameDays(inDays)} left`}
    </Chip>
  );
}
