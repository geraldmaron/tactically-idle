// The people layer's saved records (docs/world-redesign.md, "Officers"). Kernel: records only, no rules.
// Authored jacket text is content in src/content/people/; rules are in src/sim/people/. Stress stays the
// only number on a roll: nothing here carries a modifier except the tie contributor, which the call
// engine reads through a capped, visible reader.
//
// Authority (sol challenge, 2026-10-24): while employed, the live Officer in GameState.officers is the
// authority for condition, ratings, certifications, traits, career and assignment. On every departure path
// (dismissal, retirement, any removal) the people layer stores `snapshot` first; a rehire restores the
// snapshot, never PersonnelState.builds. Imprint and aftercare durations are real milliseconds. A fork opens
// only after `seen`; a pending decision never expires or settles while unseen.
import type { Officer } from '../types';

export type PersonStatus = 'employed' | 'dismissed' | 'retired';

/** One canonical record per person for the whole campaign, keyed by officer id. */
export interface PersonRecord {
  officerId: string;
  identityId: string;
  status: PersonStatus;
  hiredAt: number;
  leftAt?: number;
  /** A dismissed officer can be hired again from this time, at their condition when they left. */
  rehireAfter?: number;
  /** Jacket pages the player has opened: 1 at hire, 2 after shared operations, 3 after a set event. */
  pagesOpen: 1 | 2 | 3;
  /** Operations worked beside each colleague, by officer id. */
  shared: Record<string, number>;
  /** Off-screen personal life the officer allows in play (authored per persona, never inferred). */
  openToRelationship: boolean;
  /** The officer as they left (dismissal or retirement): restored on rehire. */
  snapshot?: Officer;
}

export type FactKind =
  | 'first_call' | 'rescue' | 'injured' | 'person_lost' | 'negotiated' | 'mentored'
  | 'favorable_under_pressure' | 'arrest' | 'shift';

export interface MemoryFact {
  id: string;
  officerId: string;
  at: number;
  kind: FactKind;
  /** The call or shift by its place, never a civilian's bound name. */
  place: string;
  runId?: string;
  caseId?: string;
  /** Other officers present. */
  with: string[];
  /** One specific, past tense, 80 characters at most, frozen when recorded. */
  detail: string;
}

export type ImprintPackId =
  | 'rattled_by_fire' | 'doubts_the_rear' | 'carries_the_name' | 'short_with_callers'
  | 'steadied_by_partner' | 'found_the_voice' | 'counts_exits' | 'hard_night';

export type AftercareChoice = 'rest' | 'peer' | 'pair';

export interface Imprint {
  id: string;
  officerId: string;
  pack: ImprintPackId;
  cause: { place: string; at: number; runId?: string };
  startedAt: number;
  /** Real time; an imprint carries no number on rolls. */
  endsAt: number;
  /** The player has seen the telegraph on the jacket or the report (a fork waits for this). */
  seen: boolean;
  fork?: { offeredAt: number; choice?: AftercareChoice; partnerId?: string; decidedAt?: number };
  /** Set when it settles or clears. */
  outcome?: 'cleared' | 'settled_positive' | 'settled_strain';
}

export interface SettledTrait {
  id: string;
  officerId: string;
  /** An existing TraitId for positives where one fits (steady, calm_voice); a scoped strain id otherwise. */
  trait: string;
  polarity: 'positive' | 'strain';
  cause: { place: string; at: number };
  settledAt: number;
}

export type BondState = 'acquainted' | 'trusted' | 'close' | 'mentor' | 'tense' | 'strained';

export interface Bond {
  /** Officer ids, a < b. */
  a: string;
  b: string;
  state: BondState;
  /** Hidden drift toward the next state; never shown. */
  drift: number;
  since: number;
  /** The recorded reason for the current state, worded by the UI from the fields. */
  cause: { kind: 'shared_call' | 'shared_shift' | 'mentoring' | 'rear_left_open' | 'promotion' | 'breakup' | 'repair'; place?: string; at: number };
  /** Romance: same mechanics as close. Started by the officers, never across supervision. */
  romance?: { since: number; ended?: number };
}

export type TieKind = 'gym' | 'neighbor' | 'school' | 'family_friend' | 'church' | 'prior_arrest' | 'old_job';

export interface Tie {
  id: string;
  officerId: string;
  subjectId: string;
  kind: TieKind;
  origin: 'jacket' | 'play';
  /** False until it surfaces; a hidden tie surfaces as story, never as an odds boost. */
  onRecord: boolean;
  since: number;
}

export type PeopleBeatKind = 'telegraph' | 'fork_open' | 'settled' | 'bond_changed' | 'romance' | 'page_opened' | 'tie_surfaced' | 'memory';

/** Something the return report and the team badge show once. */
export interface PeopleBeat {
  id: string;
  at: number;
  kind: PeopleBeatKind;
  officerIds: string[];
  refId?: string;
  acknowledged: boolean;
}

export interface PeopleState {
  records: Record<string, PersonRecord>;
  facts: MemoryFact[];
  imprints: Imprint[];
  settled: SettledTrait[];
  bonds: Bond[];
  ties: Tie[];
  beats: PeopleBeat[];
  nextId: number;
}
