import type { Officer } from '../../sim/types';
import { ageYears, experienceBand, formatGameDate, gameDay, serviceYears } from '../../sim/calendar';
import type { ExperienceBand } from '../../sim/calendar';
import { useGame } from '../store';
import { Icon } from '../icons';
import { gameDays, yearsText } from '../format';
import { Chip, ExperienceChip } from './ui';

export interface CareerSnapshot {
  age: number;
  service: number;
  band: ExperienceBand;
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
    band: experienceBand(o, day),
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

/** Compact age / service / experience block for roster cards and candidate cards. */
export function CareerMini({ officer, prior }: { officer: Officer; prior?: boolean }) {
  const c = useCareerSnapshot(officer);
  return (
    <span className="career-mini">
      <span className="career-line">
        <span className="career-fact" title="Age">
          <Icon name="cake" size={13} />
          Age {c.age}
        </span>
        <span className="career-fact" title={prior ? 'Prior service' : 'Years of service'}>
          <Icon name="medal" size={13} />
          {yearsText(c.service)}
          {prior ? ' prior service' : ' service'}
        </span>
      </span>
      <span className="career-chips">
        <ExperienceChip band={c.band} />
        {c.retirement && <RetirementChip date={c.retirement.date} inDays={c.retirement.inDays} compact />}
      </span>
    </span>
  );
}
