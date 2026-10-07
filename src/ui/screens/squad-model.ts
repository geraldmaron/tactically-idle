import type { Officer, RatingKey, Role } from '../../sim/types';
import { stressBand } from '../../sim/officer';
import { RATING_META, ROLE_META, type StatusKey } from '../components/labels';

/** One status per officer for tiles and sheets: injury first, then duties, then the stress band. */
export function officerStatus(officer: Officer, now: number): StatusKey {
  if (officer.injury && officer.injury.until > now) return 'injured';
  if (officer.assignment?.kind === 'training') return 'training';
  if (officer.assignment?.kind === 'operation') return 'deployed';
  return stressBand(officer.stress);
}

/** Free to take a call from this screen's point of view: no injury, no duty, not in mandatory recovery. */
export function officerFree(officer: Officer, now: number): boolean {
  const status = officerStatus(officer, now);
  return status === 'ready' || status === 'strained' || status === 'overloaded';
}

export const ROLE_ORDER = Object.keys(ROLE_META) as Role[];

export interface SquadCoverage {
  /** Every role in display order with how many members hold it. */
  roles: { role: Role; count: number }[];
  /** The strongest member rating per skill, as the whole number shown everywhere else. */
  best: { key: RatingKey; value: number; officerId: string | null }[];
}

/** What a squad brings at a glance. Raw ratings only: no blended score or deployability guess. */
export function squadCoverage(members: Officer[]): SquadCoverage {
  return {
    roles: ROLE_ORDER.map((role) => ({ role, count: members.filter((member) => member.role === role).length })),
    best: RATING_META.map(({ key }) => {
      let top: Officer | null = null;
      for (const member of members) if (!top || member.ratings[key] > top.ratings[key]) top = member;
      return { key, value: top ? Math.round(top.ratings[key]) : 0, officerId: top?.id ?? null };
    }),
  };
}

export type RosterFilter = 'all' | 'free' | 'busy';
export type RosterSort = 'squad' | 'stress' | 'role' | 'name';

export const ROSTER_FILTER_LABEL: Record<RosterFilter, string> = { all: 'All', free: 'Free', busy: 'Busy' };
export const ROSTER_SORT_LABEL: Record<RosterSort, string> = { squad: 'Squad', stress: 'Stress', role: 'Role', name: 'Name' };

export function filterRoster(officers: Officer[], filter: RosterFilter, now: number): Officer[] {
  if (filter === 'all') return officers;
  return officers.filter((officer) => officerFree(officer, now) === (filter === 'free'));
}

const byName = (a: Officer, b: Officer) => a.surname.localeCompare(b.surname) || a.firstName.localeCompare(b.firstName) || a.id.localeCompare(b.id);

export function sortRoster(officers: Officer[], sort: RosterSort): Officer[] {
  const squadRank = (officer: Officer) => (officer.squadId ? officer.squadId.charCodeAt(0) : 999);
  const compare: Record<RosterSort, (a: Officer, b: Officer) => number> = {
    squad: (a, b) => squadRank(a) - squadRank(b) || byName(a, b),
    stress: (a, b) => a.stress - b.stress || byName(a, b),
    role: (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || byName(a, b),
    name: byName,
  };
  return [...officers].sort(compare[sort]);
}
