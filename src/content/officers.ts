import { STARTER_PERSONAS } from './personas';
import { hashSeed, next } from '../sim/rng';
import type { CertId, Id, Officer, Ratings, Role, Squad, SquadId, TraitId } from '../sim/types';

const DAY = 86_400_000;

interface Seed {
  id: Id;
  firstName: string;
  surname: string;
  role: Role;
  portrait: string;
  ratings: Ratings;
  certs: CertId[];
  traits: TraitId[];
  wage: number;
  xp: number;
  stress: number;
  squadId: SquadId;
  /** Days on the department before the start of the game. */
  tenureDays: number;
  /** Age and service in years at game day 0 (1 Jan 2026). */
  age: number;
  service: number;
  /** Operations already on record (feeds the experience band and burnout history). */
  operations: number;
}

/** Career fields for officers present at game start; also the migration lookup for v1 saves. */
export interface CareerSeed {
  age: number;
  service: number;
  operations: number;
}

const r = (shooting: number, composure: number, communication: number, awareness: number, medical: number, coordination: number): Ratings => ({
  shooting,
  composure,
  communication,
  awareness,
  medical,
  coordination,
});

// Wages sum to $380/h. Each profile is deliberately uneven: nobody leads every rating.
const SEEDS: Seed[] = [
  { id: 'off_chen', firstName: 'Mei', surname: 'Chen', role: 'comms', portrait: 'chen', ratings: r(45, 70, 82, 62, 40, 68), certs: ['crisis_negotiation'], traits: ['calm_voice'], wage: 48, xp: 220, stress: 12, squadId: 'A', tenureDays: 640, age: 33.4, service: 9.2, operations: 30 },
  { id: 'off_brooks', firstName: 'Marcus', surname: 'Brooks', role: 'breach', portrait: 'brooks', ratings: r(78, 66, 48, 55, 38, 60), certs: ['entry_team'], traits: ['steady'], wage: 52, xp: 310, stress: 18, squadId: 'A', tenureDays: 900, age: 41.1, service: 12.4, operations: 40 },
  { id: 'off_ortiz', firstName: 'Ana', surname: 'Ortiz', role: 'medic', portrait: 'ortiz', ratings: r(42, 64, 58, 60, 84, 55), certs: ['advanced_first_aid'], traits: [], wage: 46, xp: 180, stress: 8, squadId: 'A', tenureDays: 420, age: 29.8, service: 6.3, operations: 20 },
  { id: 'off_vale', firstName: 'Daniel', surname: 'Vale', role: 'recon', portrait: 'vale', ratings: r(52, 58, 46, 83, 35, 62), certs: ['surveillance'], traits: ['observant'], wage: 44, xp: 150, stress: 22, squadId: 'A', tenureDays: 380, age: 36.5, service: 11.7, operations: 30 },
  { id: 'off_okafor', firstName: 'Naomi', surname: 'Okafor', role: 'lead', portrait: 'proc:4821', ratings: r(70, 76, 68, 64, 45, 80), certs: ['entry_team'], traits: ['mentor'], wage: 55, xp: 400, stress: 15, squadId: 'B', tenureDays: 1200, age: 57.2, service: 31.4, operations: 240 },
  { id: 'off_lindqvist', firstName: 'Sofia', surname: 'Lindqvist', role: 'recon', portrait: 'proc:9177', ratings: r(48, 60, 52, 76, 40, 66), certs: ['drone_operator'], traits: [], wage: 47, xp: 140, stress: 5, squadId: 'B', tenureDays: 300, age: 31.9, service: 7.1, operations: 12 },
  { id: 'off_reyes', firstName: 'Tomas', surname: 'Reyes', role: 'comms', portrait: 'proc:2306', ratings: r(50, 52, 70, 54, 36, 58), certs: [], traits: ['impatient'], wage: 44, xp: 90, stress: 45, squadId: 'B', tenureDays: 210, age: 27.3, service: 3.6, operations: 14 },
  { id: 'off_park', firstName: 'Hana', surname: 'Park', role: 'medic', portrait: 'proc:6659', ratings: r(40, 48, 54, 52, 66, 50), certs: ['advanced_first_aid'], traits: ['rookie'], wage: 44, xp: 40, stress: 25, squadId: 'B', tenureDays: 60, age: 24.2, service: 0.5, operations: 2 },
];

export const CAREER_SEEDS: Record<Id, CareerSeed> = Object.fromEntries(
  SEEDS.map((s) => [s.id, { age: s.age, service: s.service, operations: s.operations }]),
);

const YEAR = 365;

/**
 * Starting roster. Game day 0 is `now` (createInitialState sets calendarEpoch = now),
 * so birth and service-start days are simply negative year counts. Ages are spread
 * 24..57 with matching service: Park is a rookie, Okafor a veteran nearing 60.
 */
export function startingOfficers(now: number, campaignSeed = 12345): Record<Id, Officer> {
  const out: Record<Id, Officer> = {};
  for (const s of SEEDS) {
    const person = STARTER_PERSONAS.find((p) => p.legacyOfficerId === s.id)!;
    let roll = hashSeed(`${campaignSeed}:starter:${person.id}`);
    const ratings = { ...s.ratings };
    for (const key of Object.keys(ratings) as (keyof Ratings)[]) {
      const draw = next(roll); roll = draw.state;
      ratings[key] = Math.max(15, Math.min(95, ratings[key] + Math.round(draw.value * 8) - 4));
    }
    const officer: Officer & { xpBanked: number } = {
      id: s.id,
      identityId: person.id,
      firstName: s.firstName,
      surname: s.surname,
      role: s.role,
      portrait: person.portrait,
      ratings,
      certs: [...s.certs],
      traits: [...s.traits],
      wage: s.wage,
      xp: s.xp,
      stress: s.stress,
      injury: null,
      squadId: s.squadId,
      assignment: null,
      hiredAt: now - s.tenureDays * DAY,
      bornDay: -Math.round(s.age * YEAR),
      serviceStartDay: -Math.round(s.service * YEAR),
      career: { operations: s.operations, favorable: Math.round(s.operations * 0.55), adverse: Math.round(s.operations * 0.12) },
      retirement: null,
      // Hidden bookkeeping (see sim/career.ts OfficerExt): starting xp is already banked, so
      // nobody's ratings jump on the first tick.
      xpBanked: s.xp,
    };
    out[s.id] = officer;
  }
  return out;
}

export function startingSquads(): Squad[] {
  return [
    { id: 'A', name: 'Alpha', officerIds: ['off_chen', 'off_brooks', 'off_ortiz', 'off_vale'], leaderId: 'off_brooks', duty: 'patrol', loadoutPreset: {} },
    { id: 'B', name: 'Bravo', officerIds: ['off_okafor', 'off_lindqvist', 'off_reyes', 'off_park'], leaderId: 'off_okafor', duty: 'standby', loadoutPreset: {} },
  ];
}
