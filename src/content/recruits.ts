import type { Candidate, CertId, Id, Officer, RatingKey, Ratings, Role, TraitId } from '../sim/types';
import { next } from '../sim/rng';

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
  /** Rookies: age and years of prior service. */
  rookieAge: [21, 27] as [number, number],
  rookieService: [0, 1.2] as [number, number],
  /** Everyone else: age, and the age they joined (service = age - joined). */
  recruitAge: [26, 50] as [number, number],
  joinedAge: [21, 29] as [number, number],
  /** Experience adds this much wage per 3 years of prior service (capped), and this much signing fee per year. */
  wagePerThreeYears: 1,
  wageExperienceCap: 6,
  signingPerServiceYear: 25,
};

export const ROLES: Role[] = ['comms', 'breach', 'medic', 'recon', 'lead'];

export const FIRST_NAMES = [
  'Priya', 'Jonas', 'Leila', 'Declan', 'Maren', 'Theo', 'Imani', 'Callum', 'Yuki', 'Rafael',
  'Greta', 'Osei', 'Noor', 'Felix', 'Ingrid', 'Mateo', 'Zara', 'Henrik', 'Dara', 'Luca',
  'Amara', 'Silas', 'Kavya', 'Bram', 'Elena', 'Nico', 'Tamsin', 'Idris', 'Wren', 'Anselm',
];

export const SURNAMES = [
  'Adeyemi', 'Halloran', 'Voss', 'Nakamura', 'Delacroix', 'Whitlock', 'Ferreira', 'Kowalski', 'Mbeki', 'Ashworth',
  'Petrov', 'Castellan', 'Doyle', 'Haddad', 'Lindgren', 'Moreau', 'Osei', 'Pryce', 'Quill', 'Rahman',
  'Sandoval', 'Thackeray', 'Umber', 'Varga', 'Winslow', 'Yamada', 'Zielinski', 'Bellamy', 'Corrigan', 'Dunmore',
];

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

/**
 * `day` is the current game-calendar day (calendar.gameDay), so ages and service
 * dates line up with the department's calendar. Experienced recruits earn and cost
 * more; they also learn slower (see career.LEARNING_MULTIPLIER).
 */
export function generateCandidate(gen: RecruitGen, now: number, role: Role, takenNames: Set<string>, day = 0): Candidate {
  const profile = PROFILES[role];

  let first = FIRST_NAMES[rollInt(gen, FIRST_NAMES.length)];
  let last = SURNAMES[rollInt(gen, SURNAMES.length)];
  for (let i = 0; i < 40 && takenNames.has(fullNameKey(first, last)); i++) {
    first = FIRST_NAMES[rollInt(gen, FIRST_NAMES.length)];
    last = SURNAMES[rollInt(gen, SURNAMES.length)];
  }
  takenNames.add(fullNameKey(first, last));

  // Zero or one trait; a rookie is weaker on paper and cheaper to sign.
  const trait = roll(gen) < 0.7 ? profile.traits[rollInt(gen, profile.traits.length)] : null;
  const traits: TraitId[] = trait ? [trait] : [];
  const rookie = traits.includes('rookie');

  const ratings = {} as Ratings;
  for (const key of Object.keys(profile.ratings) as RatingKey[]) {
    const [lo, hi] = profile.ratings[key];
    const v = Math.round(lo + roll(gen) * (hi - lo)) - (rookie ? RECRUIT_TUNING.rookiePenalty : 0);
    ratings[key] = Math.max(15, Math.min(95, v));
  }

  const certs: CertId[] = [];
  for (const [cert, chance] of profile.certs) {
    if (roll(gen) < (rookie ? chance / 2 : chance)) certs.push(cert);
  }

  const portraitSeed = Math.floor(roll(gen) * 90_000) + 1000;

  // Age and prior service. Rookies are young with next to no service; the rest joined in their twenties.
  const span = (r: [number, number]) => r[0] + roll(gen) * (r[1] - r[0]);
  const age = rookie ? span(RECRUIT_TUNING.rookieAge) : span(RECRUIT_TUNING.recruitAge);
  const service = rookie ? span(RECRUIT_TUNING.rookieService) : Math.max(0.5, age - span(RECRUIT_TUNING.joinedAge));
  const operations = Math.floor(service * 5 * roll(gen));
  const wage = wageFor(ratings, certs, traits, service);
  const candId: Id = `cand_${gen.nextId++}`;
  const offId: Id = `off_${gen.nextId++}`;

  const officer: Officer = {
    id: offId,
    firstName: first,
    surname: last,
    role,
    portrait: `proc:${portraitSeed}`,
    ratings,
    certs,
    traits,
    wage,
    xp: rookie ? 0 : rollInt(gen, 200),
    stress: rollInt(gen, 20),
    injury: null,
    squadId: null,
    assignment: null,
    hiredAt: 0,
    bornDay: day - Math.round(age * 365),
    serviceStartDay: day - Math.round(service * 365),
    career: { operations, favorable: Math.round(operations * 0.55), adverse: Math.round(operations * 0.12) },
    retirement: null,
  };
  // Hidden bookkeeping (career.OfficerExt): the recruit's starting xp is already banked.
  (officer as Officer & { xpBanked?: number }).xpBanked = officer.xp;
  return {
    id: candId,
    officer,
    signingCost: Math.round((wage * RECRUIT_TUNING.signingHours + service * RECRUIT_TUNING.signingPerServiceYear) / 10) * 10,
    shortlisted: false,
    expiresAt: now + RECRUIT_TUNING.lifetimeMs,
  };
}

/**
 * Generate `count` candidates. Slot roles avoid repeating a role already in the
 * batch (or in `existingRoles`) while an unused role remains. With `targetRole`,
 * the first slot is that role and later slots take it with a modest chance.
 */
export function generateBatch(
  gen: RecruitGen,
  now: number,
  count: number,
  existingRoles: Role[],
  takenNames: Set<string>,
  targetRole?: Role,
  day = 0,
): Candidate[] {
  const out: Candidate[] = [];
  const used: Role[] = [...existingRoles];
  for (let i = 0; i < count; i++) {
    let role: Role;
    if (targetRole && (i === 0 || roll(gen) < RECRUIT_TUNING.targetBiasChance)) {
      role = targetRole;
    } else {
      const unused = ROLES.filter((x) => !used.includes(x));
      const pool = unused.length > 0 ? unused : ROLES;
      role = pool[rollInt(gen, pool.length)];
    }
    used.push(role);
    out.push(generateCandidate(gen, now, role, takenNames, day));
  }
  return out;
}
