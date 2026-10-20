// Officer ranks, mapped to real US police ranks (save v12): the ladder, the XP that reaches each
// rank, what a promotion gives and where service years place a new officer. The rules that
// promote an officer live in sim/ranks.ts.
import type { ExperienceBand } from '../sim/ranks';
import type { TraitId } from '../sim/types';
import { tunable } from '../sim/tuning';

export type RankId = 'probationary' | 'officer' | 'corporal' | 'sergeant' | 'lieutenant';
export const RANK_IDS: readonly RankId[] = ['probationary', 'officer', 'corporal', 'sergeant', 'lieutenant'];

export interface RankDef {
  id: RankId;
  title: string;
  /** Before a surname on a card: 'Sgt. Brooks'. */
  abbr: string;
  /** Experience band this rank reads as. */
  band: ExperienceBand;
  /** Insignia drawn on cards: chevrons for the enlisted ranks, a bar for lieutenant. */
  insignia: { kind: 'none' | 'chevrons' | 'bar'; count: number };
  /** Trait granted on promotion to this rank, when the officer has room for it. */
  trait?: TraitId;
  /** Trait the promotion retires. */
  drops?: TraitId;
}

export const RANKS: Record<RankId, RankDef> = {
  probationary: { id: 'probationary', abbr: 'PO', title: 'Probationary Officer', band: 'rookie', insignia: { kind: 'none', count: 0 } },
  officer: { id: 'officer', abbr: 'Ofc.', title: 'Officer', band: 'developing', insignia: { kind: 'chevrons', count: 1 }, drops: 'rookie' },
  corporal: { id: 'corporal', abbr: 'Cpl.', title: 'Corporal', band: 'developing', insignia: { kind: 'chevrons', count: 2 }, trait: 'steady' },
  sergeant: { id: 'sergeant', abbr: 'Sgt.', title: 'Sergeant', band: 'seasoned', insignia: { kind: 'chevrons', count: 3 }, trait: 'mentor' },
  lieutenant: { id: 'lieutenant', abbr: 'Lt.', title: 'Lieutenant', band: 'veteran', insignia: { kind: 'bar', count: 1 }, trait: 'observant' },
};

/** Tunable (sim/tuning.ts). Lists run in RANK_IDS order. */
export const RANK_TUNING = tunable('RANK_TUNING', {
  /** Total XP that reaches each rank; the last is the XP cap. */
  xp: [0, 150, 450, 1000, 2000],
  /** Service years that place a starting officer or recruit at each rank. */
  serviceYears: [0, 2, 5, 8, 15],
  /** Added to the role's main rating on promotion to each rank. */
  mainBoost: [0, 2, 3, 3, 3],
  /** Added to composure on promotion to each rank (the supervisory ranks). */
  composureBoost: [0, 0, 0, 2, 3],
  /** Hourly wage raise on promotion to each rank. */
  wageStep: [0, 2, 2, 3, 3],
  /** Promotion boosts stop here; courses can still go higher. */
  ratingCeiling: 95,
  /** An officer holds at most this many traits; a promotion past it grants none. */
  traitCap: 3,
}, { guard: next => next.xp.some((value, index) => index > 0 && value <= next.xp[index - 1]) ? 'Rank XP thresholds rise with each rank.' : null });

export const rankIndex = (rank: RankId) => RANK_IDS.indexOf(rank);
export const xpCap = (): number => RANK_TUNING.xp[RANK_TUNING.xp.length - 1];
export const rankXp = (rank: RankId): number => RANK_TUNING.xp[rankIndex(rank)];

export function rankForXp(xp: number): RankId {
  let at = 0;
  for (let i = 1; i < RANK_IDS.length; i++) if (xp >= RANK_TUNING.xp[i]) at = i;
  return RANK_IDS[at];
}

/** The rank a starting officer or recruit with this much service holds. */
export function rankForService(years: number): RankId {
  let at = 0;
  for (let i = 1; i < RANK_IDS.length; i++) if (years >= RANK_TUNING.serviceYears[i]) at = i;
  return RANK_IDS[at];
}
/** Starting XP for an officer with this much service: the threshold of the rank it places them at. */
export const xpForService = (years: number): number => rankXp(rankForService(years));

/** Cumulative hourly wage the ranks below and at `rank` add over a probationary officer. */
export function rankPay(rank: RankId): number {
  return RANK_TUNING.wageStep.slice(0, rankIndex(rank) + 1).reduce((sum, step) => sum + step, 0);
}
