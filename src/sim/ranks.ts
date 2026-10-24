// Officer ranks (save v12). Experience points place an officer on a ladder of real US police
// ranks, and the rank is the one source of the experience band (rookie, developing, seasoned,
// veteran) that resolution, crew flags and the learning rate read. XP stops at the top rank.
//
// Every XP award goes through creditXp: calls (closeDebrief), finished courses (economy) and
// instructor details (detail.ts). A rank-up raises the role's main rating, adds composure at the
// supervisory ranks, steps the wage and grants the rank's trait, each with the promotion as its
// named cause. Starting officers and recruits are placed by their service years and keep the
// traits they were built with; only a promotion the player sees changes them.
import type { Id, Officer, RatingKey, Role, TraitId } from './types';
import { RANKS, RANK_IDS, RANK_TUNING, rankForXp, rankIndex, rankXp, xpCap, type RankId } from '../content/ranks';

export type { RankId };

export type ExperienceBand = 'rookie' | 'developing' | 'seasoned' | 'veteran';

export const EXPERIENCE_LABEL: Record<ExperienceBand, string> = {
  rookie: 'Rookie',
  developing: 'Developing',
  seasoned: 'Seasoned',
  veteran: 'Veteran',
};

/** The rating an officer's promotions improve, by role. */
export const ROLE_MAIN_RATING: Record<Role, RatingKey> = {
  comms: 'communication',
  breach: 'shooting',
  medic: 'medical',
  recon: 'awareness',
  lead: 'coordination',
};

export const rankOf = (o: Pick<Officer, 'xp'>): RankId => rankForXp(o.xp);
export const rankTitle = (o: Pick<Officer, 'xp'>): string => RANKS[rankOf(o)].title;
/** The experience band, read from the rank. */
export const experienceBand = (o: Pick<Officer, 'xp'>): ExperienceBand => RANKS[rankOf(o)].band;

/** The rank above, or null at the top. */
export function nextRank(rank: RankId): RankId | null {
  return RANK_IDS[rankIndex(rank) + 1] ?? null;
}

/** Where an officer stands: the rank, the next one, and the XP toward it (0..1). */
export function rankProgress(o: Pick<Officer, 'xp'>): { rank: RankId; next: RankId | null; floor: number; need: number | null; progress: number } {
  const rank = rankOf(o);
  const next = nextRank(rank);
  const floor = rankXp(rank);
  const need = next ? rankXp(next) : null;
  return { rank, next, floor, need, progress: need === null ? 1 : Math.max(0, Math.min(1, (o.xp - floor) / (need - floor))) };
}

/** What a promotion to `rank` does to this officer, before it is applied. */
export interface PromotionEffects {
  rank: RankId;
  ratings: Partial<Record<RatingKey, number>>;
  wage: number;
  trait: TraitId | null;
  drops: TraitId | null;
}

export function promotionEffects(o: Pick<Officer, 'role' | 'ratings' | 'traits'>, rank: RankId): PromotionEffects {
  const i = rankIndex(rank);
  const def = RANKS[rank];
  const ratings: Partial<Record<RatingKey, number>> = {};
  const raise = (key: RatingKey, by: number) => {
    const from = (o.ratings[key] ?? 0) + (ratings[key] ?? 0);
    const gain = Math.max(0, Math.min(by, RANK_TUNING.ratingCeiling - from));
    if (gain > 0) ratings[key] = (ratings[key] ?? 0) + gain;
  };
  raise(ROLE_MAIN_RATING[o.role], RANK_TUNING.mainBoost[i]);
  raise('composure', RANK_TUNING.composureBoost[i]);
  const drops = def.drops && o.traits.includes(def.drops) ? def.drops : null;
  const kept = o.traits.length - (drops ? 1 : 0);
  const trait = def.trait && !o.traits.includes(def.trait) && kept < RANK_TUNING.traitCap ? def.trait : null;
  return { rank, ratings, wage: RANK_TUNING.wageStep[i], trait, drops };
}

/** Why the XP came: the call by place, or the course or detail by name. */
export interface XpCause { label: string; day: number }

export interface Promotion extends PromotionEffects {
  officerId: Id;
  from: RankId;
  cause: string;
  day: number;
}

/** XP an award adds once the cap is reached: never past the top rank's threshold. */
export function cappedXp(o: Pick<Officer, 'xp'>, amount: number): number {
  return Math.max(0, Math.min(Math.round(amount), xpCap() - o.xp));
}

/** The promotions crediting `amount` XP would bring, without changing the officer. */
export function promotionsFor(o: Pick<Officer, 'xp' | 'role' | 'ratings' | 'traits'>, amount: number): RankId[] {
  const from = rankIndex(rankOf(o));
  const to = rankIndex(rankForXp(o.xp + cappedXp(o, amount)));
  return RANK_IDS.slice(from + 1, to + 1);
}

/**
 * The one writer of officer XP. Adds the award up to the cap, then applies each rank reached in
 * order and records it on the officer. Returns the promotions, for the debrief and shift report.
 */
export function creditXp(o: Officer, amount: number, cause: XpCause): Promotion[] {
  const gained = cappedXp(o, amount);
  if (gained <= 0) return [];
  const ranks = promotionsFor(o, gained);
  o.xp += gained;
  const out: Promotion[] = [];
  let from = ranks.length ? RANK_IDS[rankIndex(ranks[0]) - 1] : rankOf(o);
  for (const rank of ranks) {
    const fx = promotionEffects(o, rank);
    for (const [key, by] of Object.entries(fx.ratings) as [RatingKey, number][]) o.ratings[key] += by;
    o.wage += fx.wage;
    if (fx.drops) o.traits = o.traits.filter((trait) => trait !== fx.drops);
    if (fx.trait) o.traits = [...o.traits, fx.trait];
    o.promotions = [...(o.promotions ?? []), { rank, day: cause.day, cause: cause.label }];
    out.push({ ...fx, officerId: o.id, from, cause: cause.label, day: cause.day });
    from = rank;
  }
  return out;
}

/** One plain line for a promotion: what changed, for the shift report and the debrief. */
export function promotionLine(p: Pick<Promotion, 'ratings' | 'wage' | 'trait' | 'drops'>, ratingLabel: (key: RatingKey) => string, traitLabel: (trait: TraitId) => string): string {
  const parts = (Object.entries(p.ratings) as [RatingKey, number][]).map(([key, by]) => `${ratingLabel(key)} +${by}`);
  if (p.trait) parts.push(`earns ${traitLabel(p.trait)}`);
  if (p.drops) parts.push(`no longer ${traitLabel(p.drops)}`);
  if (p.wage > 0) parts.push(`wage +${p.wage} funding an hour`);
  return parts.join(', ');
}

/** Officers whose saved promotions are well formed (save validation). */
export function validPromotions(v: unknown): boolean {
  return v === undefined || (Array.isArray(v) && v.every((entry) => typeof entry === 'object' && entry !== null
    && RANK_IDS.includes((entry as { rank: RankId }).rank) && Number.isFinite((entry as { day: number }).day)
    && typeof (entry as { cause: string }).cause === 'string'));
}
