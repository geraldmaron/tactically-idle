// Command Staff posts and the people who fill them. A Develop purchase opens a post; the post then
// offers three candidates, one of each archetype, drawn from the authored persona pool (or, for the
// managers with painted portraits, the authored manager first). Each candidate trades price
// against two levers that change how that manager's loop runs. Archetype ranges never overlap in a
// way that lets one candidate match or beat another on both levers, and price rises with the levers,
// so no candidate in a pool is dominated (tested in staff-pool.test.ts).
//
// Pure state helpers only: develop.ts, economy.ts and equipment-manager-policy.ts read levers from
// here, so this module must not import command-staff.ts or those modules.
import type { GameState } from './types';
import { PERSONAS, PERSONA_BY_ID, shuffledPersonas } from '../content/personas';
import { hashSeed, next } from './rng';

export type StaffPostId = 'watch_commander' | 'training_sergeant' | 'quartermaster' | 'peer_support_lead' | 'recruiter';
export type StaffArchetype = 'seasoned' | 'specialist' | 'steady';

export interface StaffPerson {
  /** A persona id, or `manager:<post>` for the five authored managers. */
  identityId: string;
  firstName: string;
  surname: string;
  pronouns: 'she' | 'he' | 'they';
  /** Asset path for the painted portrait. */
  portrait: string;
  note: string | null;
}

export interface StaffCandidate {
  id: string;
  person: StaffPerson;
  archetype: StaffArchetype;
  /** Lever values in the units of STAFF_LEVERS[post][i]. */
  levers: [number, number];
  salaryPerHour: number;
  signingCost: number;
}

export interface StaffHolder extends StaffCandidate {
  hiredAt: number;
}

export interface StaffPost {
  holder: StaffHolder | null;
  /** Candidates on offer while the post is open and vacant. */
  pool: StaffCandidate[];
  /** Draw counter, so each refresh is a new deterministic draw. */
  round: number;
  /** Department clock time of the last draw, for the refresh cooldown. */
  drawnAt: number;
}

export interface LeverDef {
  key: string;
  /** Short label for the compare rows. */
  label: string;
  low: number;
  high: number;
  /** Whole numbers (sessions, stress) or a share shown as a percentage. */
  kind: 'count' | 'share' | 'stress' | 'rating';
}

/** Two levers per post, each tied to a hook in that manager's loop. Higher is always better for the department. */
export const STAFF_LEVERS: Record<StaffPostId, [LeverDef, LeverDef]> = {
  watch_commander: [
    { key: 'restRecovery', label: 'Faster recovery on rest', low: 0, high: 0.25, kind: 'share' },
    { key: 'returnBelow', label: 'Returns squads to duty below', low: 25, high: 35, kind: 'stress' },
  ],
  training_sergeant: [
    { key: 'feeDiscount', label: 'Course fee discount', low: 0, high: 0.2, kind: 'share' },
    { key: 'xpBonus', label: 'Extra course XP', low: 0, high: 0.2, kind: 'share' },
  ],
  quartermaster: [
    { key: 'repairDiscount', label: 'Cheaper servicing', low: 0, high: 0.15, kind: 'share' },
    { key: 'wearReduction', label: 'Less wear', low: 0, high: 0.15, kind: 'share' },
  ],
  peer_support_lead: [
    { key: 'sessionsPerHour', label: 'Sessions an hour', low: 1, high: 3, kind: 'count' },
    { key: 'relief', label: 'Stress off per session', low: 5, high: 11, kind: 'count' },
  ],
  recruiter: [
    { key: 'signingDiscount', label: 'Signing fee negotiated down', low: 0, high: 0.15, kind: 'share' },
    { key: 'qualityFloor', label: 'Skips recruits rated below', low: 40, high: 55, kind: 'rating' },
  ],
};

export const STAFF_POOL = {
  size: 3,
  minAge: 35,
  refreshCooldownMs: 4 * 3_600_000,
  /** Severance on replacing someone: this many hours of their salary. */
  severanceHours: 24,
  /** Lever positions (0..1) per archetype. Specialist is strong on one lever and weak on the other. */
  positions: {
    seasoned: [0.7, 1] as [number, number],
    specialistStrong: [0.85, 1] as [number, number],
    specialistWeak: [0, 0.25] as [number, number],
    steady: [0.2, 0.35] as [number, number],
  },
  /** Salary = base + perPosition x mean lever position; the Quartermaster has no salary. */
  salaryBase: 28,
  salaryPerPosition: 44,
  /** Signing = this many hours of salary; the Quartermaster's is priced from its own range. */
  signingHours: 30,
  quartermasterSigning: [1000, 3000] as [number, number],
} as const;

const ARCHETYPES: StaffArchetype[] = ['seasoned', 'specialist', 'steady'];

/** The managers with painted art, offered first for their posts. */
export const AUTHORED_STAFF: Partial<Record<StaffPostId, StaffPerson>> = {
  watch_commander: { identityId: 'manager:watch_commander', firstName: 'Sam', surname: 'Navarro', pronouns: 'she', portrait: 'art/managers/watch_commander.webp', note: null },
  training_sergeant: { identityId: 'manager:training_sergeant', firstName: 'Jordan', surname: 'Pike', pronouns: 'he', portrait: 'art/managers/training_sergeant.webp', note: null },
  quartermaster: { identityId: 'manager:quartermaster', firstName: 'Robin', surname: 'Kessler', pronouns: 'they', portrait: 'art/managers/quartermaster.webp', note: null },
  recruiter: { identityId: 'manager:recruiter', firstName: 'Helena', surname: 'Teixeira', pronouns: 'she', portrait: 'art/managers/recruiter.webp', note: null },
  peer_support_lead: { identityId: 'manager:peer_support_lead', firstName: 'Lennart', surname: 'Lindahl', pronouns: 'he', portrait: 'art/managers/peer_support_lead.webp', note: null },
};

export function emptyPost(): StaffPost {
  return { holder: null, pool: [], round: 0, drawnAt: 0 };
}

/** The post record if the state has one. Read-only. */
export function staffPostOf(state: GameState, id: StaffPostId): StaffPost {
  return (state.commandStaff?.[id] as { post?: StaffPost } | undefined)?.post ?? emptyPost();
}

/** Whether the person in a post is working: the Quartermaster works while in post, the rest while switched on. */
function working(state: GameState, id: StaffPostId): boolean {
  const record = state.commandStaff?.[id] as { enabled?: boolean; post?: StaffPost } | undefined;
  if (!record?.post?.holder) return false;
  return id === 'quartermaster' ? true : record.enabled === true;
}

/** A lever of the person in post, or null when the post is vacant or the manager is off. */
export function staffLever(state: GameState, id: StaffPostId, index: 0 | 1): number | null {
  return working(state, id) ? staffPostOf(state, id).holder!.levers[index] : null;
}

/** A course fee after the Training Sergeant's discount. */
export function courseFee(state: GameState, cost: number): number {
  const discount = staffLever(state, 'training_sergeant', 0) ?? 0;
  return Math.round(cost * (1 - discount));
}

/** Identity ids no new staff draw may use: people on the roster, in the officer pool, ever employed, or already in or offered a post. */
function takenIdentities(state: GameState): Set<string> {
  const taken = new Set<string>(state.personnel?.employedIdentityIds ?? []);
  for (const person of state.patrol?.personnel ?? []) taken.add(person.profileId);
  for (const officer of Object.values(state.officers)) if (officer.identityId) taken.add(officer.identityId);
  for (const candidate of state.candidates) if (candidate.officer.identityId) taken.add(candidate.officer.identityId);
  for (const record of Object.values(state.commandStaff ?? {})) {
    const post = (record as { post?: StaffPost }).post;
    if (!post) continue;
    if (post.holder) taken.add(post.holder.person.identityId);
    for (const candidate of post.pool) taken.add(candidate.person.identityId);
  }
  return taken;
}

function personFromPersona(id: string): StaffPerson {
  const p = PERSONA_BY_ID[id];
  return { identityId: p.id, firstName: p.firstName, surname: p.surname, pronouns: p.pronouns, portrait: p.portrait.replace(/^\/+/, ''), note: p.personalNote };
}

/** Lever value from a 0..1 position. Count, stress and rating levers are whole numbers. */
export function leverValue(def: LeverDef, position: number): number {
  const raw = def.low + position * (def.high - def.low);
  return def.kind === 'share' ? Math.round(raw * 1000) / 1000 : Math.round(raw);
}

/** Position (0..1) a lever value sits at, for bars and pricing. */
export function leverPosition(def: LeverDef, value: number): number {
  return def.high === def.low ? 0 : (value - def.low) / (def.high - def.low);
}

export function priceFor(id: StaffPostId, positions: [number, number]): { salaryPerHour: number; signingCost: number } {
  const mean = (positions[0] + positions[1]) / 2;
  if (id === 'quartermaster') {
    const [lo, hi] = STAFF_POOL.quartermasterSigning;
    return { salaryPerHour: 0, signingCost: Math.round((lo + mean * (hi - lo)) / 10) * 10 };
  }
  const salaryPerHour = Math.round(STAFF_POOL.salaryBase + mean * STAFF_POOL.salaryPerPosition);
  return { salaryPerHour, signingCost: Math.round((salaryPerHour * STAFF_POOL.signingHours) / 10) * 10 };
}

/**
 * Draw a fresh pool for a post, one candidate per archetype in a seeded order. Deterministic in the
 * campaign seed, the post and the draw round, and in who is already taken at draw time.
 */
export function drawStaffPool(state: GameState, id: StaffPostId, round: number, exclude: readonly string[] = []): StaffCandidate[] {
  const seed = state.personnel?.campaignSeed ?? 12345;
  let rng = hashSeed(`${seed >>> 0}:staff:${id}:${round}`);
  const roll = () => { const r = next(rng); rng = r.state; return r.value; };
  const within = ([lo, hi]: readonly [number, number]) => lo + roll() * (hi - lo);
  const taken = takenIdentities(state);
  for (const identityId of exclude) taken.add(identityId);
  const people: StaffPerson[] = [];
  const authored = round === 0 ? AUTHORED_STAFF[id] : undefined;
  if (authored && !taken.has(authored.identityId)) people.push(authored);
  for (const persona of shuffledPersonas(seed, 'recruitment').reverse()) {
    if (people.length >= STAFF_POOL.size) break;
    if (taken.has(persona.id) || persona.ageAtStart < STAFF_POOL.minAge) continue;
    people.push(personFromPersona(persona.id));
  }
  // Shuffle archetypes so the authored manager is not always the same kind.
  const order = [...ARCHETYPES];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(roll() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const defs = STAFF_LEVERS[id];
  const { positions } = STAFF_POOL;
  return people.map((person, index) => {
    const archetype = order[index % order.length];
    let pos: [number, number];
    if (archetype === 'seasoned') pos = [within(positions.seasoned), within(positions.seasoned)];
    else if (archetype === 'steady') pos = [within(positions.steady), within(positions.steady)];
    else {
      const strongFirst = roll() < 0.5;
      const strong = within(positions.specialistStrong), weak = within(positions.specialistWeak);
      pos = strongFirst ? [strong, weak] : [weak, strong];
    }
    const levers: [number, number] = [leverValue(defs[0], pos[0]), leverValue(defs[1], pos[1])];
    // Price from the rounded lever values, so what the player sees is what they pay for.
    const priced = priceFor(id, [leverPosition(defs[0], levers[0]), leverPosition(defs[1], levers[1])]);
    return { id: `staff_${id}_${round}_${index}`, person, archetype, levers, ...priced };
  });
}

/** Is candidate a at least as good as b on both levers and no more expensive? */
export function dominates(a: Pick<StaffCandidate, 'levers' | 'salaryPerHour' | 'signingCost'>, b: Pick<StaffCandidate, 'levers' | 'salaryPerHour' | 'signingCost'>): boolean {
  return a.levers[0] >= b.levers[0] && a.levers[1] >= b.levers[1] && a.salaryPerHour <= b.salaryPerHour && a.signingCost <= b.signingCost;
}

/** Every persona the staff pools could ever use, for coverage checks. */
export const STAFF_ELIGIBLE_PERSONAS = PERSONAS.filter((p) => p.ageAtStart >= STAFF_POOL.minAge);
