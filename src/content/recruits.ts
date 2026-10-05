import type { Candidate, CertId, Id, Officer, RatingKey, Ratings, Role, TraitId } from '../sim/types';
import { hashSeed, next } from '../sim/rng';
import { shuffledPersonas, type Persona } from './personas';
import { CAREER_TUNING } from '../sim/career';

export const RECRUIT_TUNING = {
  /** Candidates in the pool before any development node adds more. */
  basePool: 3,
  /** How long an unshortlisted candidate stays available. */
  lifetimeMs: 48 * 3_600_000,
  /** Signing cost = this many hours of the candidate's wage. */
  signingHours: 24,
  /** Free candidate search cooldown. */
  refreshCooldownMs: 4 * 3_600_000,
  rookiePenalty: 8,
  /** Chance that a non-targeted slot also takes the targeted role. */
  targetBiasChance: 0.35,
  /** Newcomers can be any adult age. Prior service is rolled separately. */
  rookieService: [0, 1.2] as [number, number],
  /** Experience adds this much wage per 3 years of prior service (capped), and this much signing fee per year. */
  wagePerThreeYears: 1,
  wageExperienceCap: 6,
  signingPerServiceYear: 25,
};

export const ROLES: Role[] = ['comms', 'breach', 'medic', 'recon', 'lead'];

type Range = [number, number];

interface RoleProfile {
  ratings: Record<RatingKey, Range>;
  certs: [CertId, number][];
  traits: TraitId[];
}

// Role-plausible rating bands; each role is strong in a few ratings and weak elsewhere.
const PROFILES: Record<Role, RoleProfile> = {
  comms: {
    ratings: { shooting: [35, 55], composure: [52, 72], communication: [62, 84], awareness: [48, 66], medical: [30, 50], coordination: [52, 70] },
    certs: [['crisis_negotiation', 0.4]],
    traits: ['calm_voice', 'steady', 'impatient', 'rookie'],
  },
  breach: {
    ratings: { shooting: [62, 84], composure: [55, 72], communication: [38, 55], awareness: [45, 62], medical: [30, 48], coordination: [50, 68] },
    certs: [['entry_team', 0.7]],
    traits: ['steady', 'impatient', 'mentor', 'rookie'],
  },
  medic: {
    ratings: { shooting: [30, 48], composure: [52, 70], communication: [48, 64], awareness: [50, 66], medical: [64, 86], coordination: [45, 62] },
    certs: [['advanced_first_aid', 0.8]],
    traits: ['steady', 'calm_voice', 'rookie'],
  },
  recon: {
    ratings: { shooting: [42, 60], composure: [50, 66], communication: [40, 58], awareness: [64, 86], medical: [30, 46], coordination: [52, 68] },
    certs: [['surveillance', 0.55], ['drone_operator', 0.2]],
    traits: ['observant', 'impatient', 'rookie'],
  },
  lead: {
    ratings: { shooting: [52, 70], composure: [60, 78], communication: [55, 72], awareness: [55, 72], medical: [35, 52], coordination: [64, 84] },
    certs: [['entry_team', 0.3], ['crisis_negotiation', 0.15]],
    traits: ['mentor', 'steady', 'calm_voice', 'rookie'],
  },
};

/** Mutable generation cursor; the caller writes it back to state. */
export interface RecruitGen {
  rng: number;
  nextId: number;
  campaignSeed?: number;
  builds?: Record<Id, Officer>;
  unavailable?: readonly Id[];
}

function roll(gen: RecruitGen): number {
  const r = next(gen.rng);
  gen.rng = r.state;
  return r.value;
}

function rollInt(gen: RecruitGen, n: number): number {
  return Math.floor(roll(gen) * n);
}

export function fullNameKey(first: string, last: string): string {
  return `${first} ${last}`.toLowerCase();
}

function wageFor(ratings: Ratings, certs: CertId[], traits: TraitId[], serviceYears: number): number {
  const avg = Object.values(ratings).reduce((a, b) => a + b, 0) / 6;
  const experience = Math.min(RECRUIT_TUNING.wageExperienceCap, Math.floor(serviceYears / 3) * RECRUIT_TUNING.wagePerThreeYears);
  const w = 34 + avg * 0.22 + certs.length * 2 + experience + (traits.includes('rookie') ? -5 : 0);
  return Math.max(38, Math.min(62, Math.round(w)));
}

/** Role and build seeds never depend on demographic or visual fields. */
export function roleForPersona(seed: number, identityId: string): Role {
  return ROLES[Math.floor(next(hashSeed(`${seed}:role:${identityId}`)).value * ROLES.length)];
}

export function buildPersona(person: Persona, seed: number, role = roleForPersona(seed, person.id), introducedDay = 0): Officer {
  const gen: RecruitGen = { rng: hashSeed(`${seed}:build:${person.id}`), nextId: 0 };
  const profile = PROFILES[role];
  const trait = roll(gen) < 0.7 ? profile.traits[rollInt(gen, profile.traits.length)] : null;
  const traits: TraitId[] = trait ? [trait] : [];
  const rookie = traits.includes('rookie');
  const ratings = {} as Ratings;
  for (const key of Object.keys(profile.ratings) as RatingKey[]) {
    const [lo, hi] = profile.ratings[key];
    ratings[key] = Math.max(15, Math.min(95, Math.round(lo + roll(gen) * (hi - lo)) - (rookie ? RECRUIT_TUNING.rookiePenalty : 0)));
  }
  const certs: CertId[] = [];
  for (const [cert, chance] of profile.certs) {
    if (roll(gen) < (rookie ? chance / 2 : chance)) certs.push(cert);
  }
  // Adult age constrains possible service length; it never forces someone to be a rookie or veteran.
  const maxService = Math.max(0, person.ageAtStart - 21);
  const service = rookie ? roll(gen) * Math.min(1.2, maxService) : roll(gen) * maxService;
  const operations = Math.floor(service * 5 * roll(gen));
  const xp = rookie ? 0 : rollInt(gen, 200);
  return {
    id: `off_${person.id}`, identityId: person.id,
    firstName: person.firstName, surname: person.surname, portrait: person.portrait,
    role, ratings, certs, traits, wage: wageFor(ratings, certs, traits, service), xp, xpBanked: xp,
    stress: rollInt(gen, 20), injury: null, squadId: null, assignment: null, hiredAt: 0,
    // Birth/service dates are fixed at first introduction, never reset on a later refresh.
    bornDay: introducedDay - Math.round(person.ageAtStart * 365), serviceStartDay: introducedDay - Math.round(service * 365),
    career: { operations, favorable: Math.round(operations * 0.55), adverse: Math.round(operations * 0.12) }, retirement: null,
  };
}

function candidateFor(gen: RecruitGen, now: number, person: Persona, day: number): Candidate {
  const seed = gen.campaignSeed ?? 12345;
  const officer = structuredClone(gen.builds?.[person.id] ?? buildPersona(person, seed, undefined, day));
  if (gen.builds) gen.builds[person.id] = structuredClone(officer);
  const service = Math.max(0, (day - officer.serviceStartDay) / 365);
  return {
    id: `cand_${gen.nextId++}`, officer,
    signingCost: Math.round((officer.wage * RECRUIT_TUNING.signingHours + service * RECRUIT_TUNING.signingPerServiceYear) / 10) * 10,
    shortlisted: false, expiresAt: now + RECRUIT_TUNING.lifetimeMs,
  };
}

/** A small hiring window onto the authored cast; build assignment is fixed for the campaign. */
export function generateBatch(
  gen: RecruitGen, now: number, count: number, existingRoles: Role[], takenNames: Set<string>, targetRole?: Role, day = 0,
): Candidate[] {
  const seed = gen.campaignSeed ?? 12345;
  const excluded = new Set(gen.unavailable ?? []);
  const eligible = shuffledPersonas(seed, 'recruitment').filter((p) => !excluded.has(p.id)
    && !takenNames.has(fullNameKey(p.firstName, p.surname))
    && (!gen.builds?.[p.id] || (day - gen.builds[p.id].bornDay) / 365 < CAREER_TUNING.retireAge));
  const introduced = eligible.filter((p) => gen.builds?.[p.id]);
  // Keep a small local recruitment market. New distinct people arrive as hiring and
  // retirement open room, rather than ageing the entire unseen reserve on day zero.
  const reserve = eligible.filter((p) => !gen.builds?.[p.id]);
  // Every remaining authored identity can enter the opening local market, whether
  // its portrait is ready or it was a starter in an older version of the game.
  const available = [...introduced, ...reserve.slice(0, Math.max(0, 12 - introduced.length))];
  const out: Candidate[] = [];
  const used = [...existingRoles];
  const roleOf = (p: Persona) => gen.builds?.[p.id]?.role ?? roleForPersona(seed, p.id);
  // Target the entire eligible reserve, not just the current local cohort. A role
  // search can introduce one new specialist without rerolling an existing person.
  if (targetRole && !available.some((p) => roleOf(p) === targetRole)) {
    const specialist = reserve.find((p) => roleOf(p) === targetRole);
    if (specialist) available.push(specialist);
  }
  while (out.length < count && available.length) {
    const target = targetRole && (out.length === 0 || roll(gen) < RECRUIT_TUNING.targetBiasChance);
    let pool = target ? available.filter((p) => roleOf(p) === targetRole) : available.filter((p) => !used.includes(roleOf(p)));
    if (!pool.length) pool = available;
    const person = pool[rollInt(gen, pool.length)];
    available.splice(available.indexOf(person), 1);
    takenNames.add(fullNameKey(person.firstName, person.surname));
    const candidate = candidateFor(gen, now, person, day);
    used.push(candidate.officer.role);
    out.push(candidate);
  }
  return out;
}
