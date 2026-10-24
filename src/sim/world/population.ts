// The people of the city: subjects and the crews they belong to. Pure functions over WorldState; the rules
// that move them (contacts, cases) live beside this file.
import { ARCHETYPES } from '../../content/city/archetypes';
import { DISTRICTS } from '../../content/city/districts';
import { HISTORY_CAP, SUCCESSOR_START_SHARE, TIER_WEIGHT } from '../../content/city/tuning';
import type { CrewSeed } from '../../content/city/types';
import { CIVILIAN_FIRST_NAMES, CIVILIAN_SURNAMES } from '../../content/call-trees/civilian-names';
import { clamp, draw, hourOf, newId, pushEvent, round1 } from './core';
import type { Crew, DistrictId, Pronouns, Subject, SubjectEvent, SubjectTrait, Tier, WorldState } from './types';

const TIERS: readonly Tier[] = [1, 2, 3, 4];
const TRAITS: readonly SubjectTrait[] = ['talks', 'loyal', 'volatile', 'careful'];

export const subjectName = (s: Pick<Subject, 'firstName' | 'surname'>): string => `${s.firstName} ${s.surname}`;

export function addHistory(s: Subject, e: SubjectEvent): void {
  s.history.push(e);
  if (s.history.length > HISTORY_CAP) s.history.splice(0, s.history.length - HISTORY_CAP);
}

/** A new person. Identity comes from the civilian name pools by draw, so no name is tied to a role. */
export function makeSubject(w: WorldState, crew: Crew | null, districtId: DistrictId, tier: Tier, at: number): Subject {
  const id = newId(w, 's');
  const h = hourOf(at);
  const r = draw(w.seed, 'sx', h, id, 0);
  const pronouns: Pronouns = r < 0.49 ? 'she' : r < 0.98 ? 'he' : 'they';
  const firsts = CIVILIAN_FIRST_NAMES[pronouns];
  const taken = new Set(Object.values(w.subjects).map((s) => `${s.nameKey.first}:${pronouns}:${s.nameKey.last}`));
  let first = 0;
  let last = 0;
  for (let k = 0; k < 12; k++) {
    first = Math.min(firsts.length - 1, Math.floor(draw(w.seed, 'sf', h, id, k) * firsts.length));
    last = Math.min(CIVILIAN_SURNAMES.length - 1, Math.floor(draw(w.seed, 'sl', h, id, k) * CIVILIAN_SURNAMES.length));
    if (!taken.has(`${first}:${pronouns}:${last}`)) break;
  }
  const traits: SubjectTrait[] = [TRAITS[Math.floor(draw(w.seed, 'st', h, id, 0) * TRAITS.length)]];
  if (draw(w.seed, 'st', h, id, 1) < 0.35) {
    const second = TRAITS[Math.floor(draw(w.seed, 'st', h, id, 2) * TRAITS.length)];
    if (!traits.includes(second)) traits.push(second);
  }
  const subject: Subject = {
    id,
    firstName: firsts[first],
    surname: CIVILIAN_SURNAMES[last],
    pronouns,
    nameKey: { first, last },
    crewId: crew?.id ?? null,
    tier,
    districtId,
    status: 'free',
    traits,
    known: false,
    reservedBy: null,
    history: [],
  };
  w.subjects[id] = subject;
  return subject;
}

/** The crew's current members: everyone still on its books and at tier. */
export function membersOf(w: WorldState, crew: Crew, tier?: Tier): Subject[] {
  return Object.values(w.subjects)
    .filter((s) => s.crewId === crew.id && s.status !== 'gone' && s.status !== 'resolved' && (tier === undefined || s.tier === tier))
    .sort((a, b) => idNumber(a.id) - idNumber(b.id));
}

export const idNumber = (id: string): number => Number(id.slice(1));

/** 0..100, one decimal: the weighted share of the whole roster still working. */
export function crewStrength(w: WorldState, crew: Crew): number {
  if (crew.status === 'collapsed') return 0;
  const arch = ARCHETYPES[crew.archetype];
  let have = 0;
  let full = 0;
  for (const tier of TIERS) {
    const want = arch.members[tier - 1];
    full += want * TIER_WEIGHT[tier];
    have += Math.min(want, membersOf(w, crew, tier).length) * TIER_WEIGHT[tier];
  }
  return round1(full > 0 ? (100 * have) / full : 0);
}

export function refreshStrength(w: WorldState, crew: Crew): void {
  crew.strength = crewStrength(w, crew);
}

export function activeCrews(w: WorldState, districtId: DistrictId): Crew[] {
  return w.crews.filter((c) => c.districtId === districtId && c.status === 'active');
}

/** Found a crew with its people. `share` below 1 starts a successor smaller than a whole roster. */
export function seedCrew(w: WorldState, seed: CrewSeed, districtId: DistrictId, at: number, share = 1): Crew {
  const arch = ARCHETYPES[seed.archetype];
  const crew: Crew = { id: newId(w, 'k'), archetype: seed.archetype, name: seed.name, districtId, strength: 0, status: 'active', formedAt: at, intel: {} };
  w.crews.push(crew);
  for (const tier of TIERS) {
    const count = share >= 1 ? arch.members[tier - 1] : tier === 4 ? 1 : Math.max(1, Math.round(arch.members[tier - 1] * share));
    for (let i = 0; i < count; i++) makeSubject(w, crew, districtId, tier, at);
  }
  refreshStrength(w, crew);
  return crew;
}

/** Everything a district starts with. */
export function seedDistrictCrews(w: WorldState, districtId: DistrictId, at: number): Crew[] {
  return DISTRICTS[districtId].crews.map((seed) => seedCrew(w, seed, districtId, at));
}

/** The tier 4 was taken: the crew is over, its crime drops, and loose members fade unless a case still holds
 * them. */
export function collapseCrew(w: WorldState, crew: Crew, at: number): void {
  crew.status = 'collapsed';
  crew.collapsedAt = at;
  crew.strength = 0;
  for (const s of Object.values(w.subjects)) {
    if (s.crewId === crew.id && s.status === 'free' && s.reservedBy === null) s.status = 'gone';
  }
  const district = w.districts[crew.districtId];
  district.crime = round1(clamp(district.crime - 10, 0, 100));
  pushEvent(w, { at, kind: 'crew_collapsed', districtId: crew.districtId, crewId: crew.id });
}

function successorName(w: WorldState, crew: Crew): string {
  const names = ARCHETYPES[crew.archetype].successorNames;
  const used = new Set(w.crews.map((c) => c.name));
  const free = names.filter((n) => !used.has(n));
  if (free.length) return free[Math.floor(draw(w.seed, 'sn', hourOf(crew.collapsedAt ?? 0), crew.id, 0) * free.length)];
  let n = 2;
  while (used.has(`${names[0]} ${n}`)) n++;
  return `${names[0]} ${n}`;
}

/** A successor forms once a collapsed crew's delay has passed, once. */
export function successorDue(w: WorldState, crew: Crew, at: number, delayMs: number): boolean {
  if (crew.status !== 'collapsed' || crew.collapsedAt === undefined || at < crew.collapsedAt + delayMs) return false;
  const collapsedAt = crew.collapsedAt;
  return !w.crews.some((c) => c.districtId === crew.districtId && c.archetype === crew.archetype && c.formedAt > collapsedAt);
}

export function formSuccessor(w: WorldState, crew: Crew, at: number): Crew {
  const next = seedCrew(w, { archetype: crew.archetype, name: successorName(w, crew) }, crew.districtId, at, SUCCESSOR_START_SHARE);
  pushEvent(w, { at, kind: 'crew_formed', districtId: crew.districtId, crewId: next.id });
  return next;
}

/** New members for crews below their roster, tier 1 to 3, at the daily rate scaled by crew strength. Returns
 * the people it added. */
export function recruitHour(w: WorldState, crew: Crew, h: number, at: number): Subject[] {
  const arch = ARCHETYPES[crew.archetype];
  const added: Subject[] = [];
  for (const tier of [1, 2, 3] as const) {
    if (membersOf(w, crew, tier).length >= arch.members[tier - 1]) continue;
    const p = (arch.recruitPerDay[tier] / 24) * (0.5 + crew.strength / 100);
    if (draw(w.seed, 'rc', h, crew.id, tier) < p) added.push(makeSubject(w, crew, crew.districtId, tier, at));
  }
  if (added.length) refreshStrength(w, crew);
  return added;
}

/** Whether a member can be met now: at large, not reserved by another contact, back from any release. */
export function reachable(s: Subject, at: number): boolean {
  return s.status === 'free' && s.reservedBy === null && (s.backAt === undefined || s.backAt <= at);
}
