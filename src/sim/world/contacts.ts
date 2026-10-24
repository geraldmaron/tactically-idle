// The hourly roll. At each hour boundary B the world rolls hour h = B / 1h - 1 once: patrol contacts for each
// productive unit, SWAT contacts for each shift on the clock, recruitment, successor crews, then crime drift.
// Every draw is keyed `${seed}:${kind}:${h}:${unitOrShiftId}:${index}` (core.draw), so online play, offline
// settlement and any tick partition produce the same city.
import { ARCHETYPES } from '../../content/city/archetypes';
import { CONTACT, CRIME, DISTRICT_ORDER, HOUR, SUCCESSOR_DELAY_MS } from '../../content/city/tuning';
import { employedPatrol } from '../patrol';
import { seedTiesForSubject } from '../people';
import type { GameState, PatrolEmployee } from '../types';
import { addLead, openCase, openInvestigation } from './cases';
import { clamp, draw, patrolDistrict, pushEvent, round1, weighted, type WorldAcc } from './core';
import {
  activeCrews, addHistory, formSuccessor, idNumber, makeSubject, membersOf, reachable, recruitHour, refreshStrength, successorDue,
} from './population';
import { shiftCoversBoundary, shiftMembers, squadSkill } from './shifts';
import type { Crew, DistrictId, ProactiveShift, Subject, Tier, WorldState } from './types';

const patrolNumber = (id: string): number => Number(id.replace(/\D/g, '')) || 0;

/** Productive patrol employees on a district's streets. Unassigned staff cover the home district. */
export function productiveUnits(d: Pick<GameState, 'patrol' | 'world'>, districtId: DistrictId): PatrolEmployee[] {
  return employedPatrol(d)
    .filter((p) => !p.training && patrolDistrict(d.world, p) === districtId)
    .sort((a, b) => patrolNumber(a.id) - patrolNumber(b.id));
}

/** Units on the street plus what a squad on shift counts for. */
export function coverageAt(d: GameState, districtId: DistrictId, b: number): number {
  const shifts = d.world.shifts.filter((s) => s.districtId === districtId && shiftCoversBoundary(s, b)).length;
  return productiveUnits(d, districtId).length + shifts * CRIME.shiftCoverage;
}

/** Where a district's crime is heading: crews push it up, coverage pushes it down. */
export function crimeTarget(w: WorldState, districtId: DistrictId, coverage: number): number {
  const pressure = activeCrews(w, districtId).reduce((sum, c) => sum + c.strength * ARCHETYPES[c.archetype].crimePressure, 0);
  return clamp(CRIME.base + pressure * CRIME.perStrength - coverage * CRIME.perUnit, CRIME.min, CRIME.max);
}

/** The chance a tier 1 or 2 shift contact opens a case: a sharper squad turns more contacts into casework. */
export function swatCaseChance(skill: number): number {
  return clamp(CONTACT.swatCaseChance * (0.8 + (0.4 * skill) / 100), 0, 0.9);
}

interface ContactCtx {
  b: number;
  h: number;
  districtId: DistrictId;
  /** The employee id or shift id that keys the draws. */
  key: string;
  shift?: ProactiveShift;
  unit?: number;
}

/** Someone to meet at this tier: a free, unreserved member of a crew in the district, a new recruit if the
 * crew is short (tiers 1 and 2), or for tiers 3 and 4 a member whose investigation is waiting on a warrant. */
function pickSubject(d: GameState, ctx: ContactCtx, tier: Tier): Subject | null {
  const w = d.world;
  const eligible = (s: Subject): boolean => {
    if (tier <= 2) return reachable(s, ctx.b);
    if (s.status !== 'free' || (s.backAt !== undefined && s.backAt > ctx.b)) return false;
    return s.reservedBy === null || w.cases.find((c) => c.id === s.reservedBy)?.status === 'open';
  };
  const options = activeCrews(w, ctx.districtId).map((crew) => {
    const list = membersOf(w, crew, tier).filter(eligible);
    const short = tier <= 2 && membersOf(w, crew, tier).length < ARCHETYPES[crew.archetype].members[tier - 1];
    return { crew, list, short };
  }).filter((o) => o.list.length > 0 || o.short);
  if (!options.length) return null;
  const pick = options[weighted(draw(w.seed, 'k', ctx.h, ctx.key, 0), options.map((o) => ARCHETYPES[o.crew.archetype].contactWeight))];
  const slots = pick.list.length + (pick.short ? 1 : 0);
  const i = Math.min(slots - 1, Math.floor(draw(w.seed, 's', ctx.h, ctx.key, 0) * slots));
  if (i < pick.list.length) return pick.list[i];
  const recruit = makeSubject(w, pick.crew, ctx.districtId, tier, ctx.b);
  refreshStrength(w, pick.crew);
  seedTiesForSubject(d, recruit.id);
  return recruit;
}

function contact(d: GameState, ctx: ContactCtx, acc: WorldAcc): void {
  const w = d.world;
  const swat = !!ctx.shift;
  const rate = swat ? CONTACT.swatPerHour : CONTACT.npcPerUnitHour;
  if (draw(w.seed, 'c', ctx.h, ctx.key, 0) >= rate) return;
  const tier = (weighted(draw(w.seed, 't', ctx.h, ctx.key, 0), swat ? CONTACT.swatTierWeights : CONTACT.npcTierWeights) + 1) as Tier;
  const subject = pickSubject(d, ctx, tier);
  if (!subject) return;
  const squadId = ctx.shift?.squadId;
  const officerIds = ctx.shift ? shiftMembers(d, ctx.shift).map((o) => o.id) : [];
  acc.contacts++;
  if (ctx.shift) ctx.shift.contacts++;
  subject.known = true;
  addHistory(subject, { at: ctx.b, kind: tier >= 3 && !swat ? 'sighted' : 'stopped' });
  const crew = subject.crewId ? w.crews.find((c) => c.id === subject.crewId) : undefined;
  pushContact(w, ctx, subject, tier, crew);

  if (tier <= 2) {
    const chance = swat ? swatCaseChance(squadSkill(d, squadId!, ctx.shift!.officerIds)) : CONTACT.npcCaseChance;
    if (draw(w.seed, 'o', ctx.h, ctx.key, 0) >= chance) return;
    const c = openCase(d, w, { subject, tier, source: swat ? 'proactive' : 'patrol', at: ctx.b, status: 'review', officerIds, unit: ctx.unit, squadId }, acc);
    ctx.shift?.caseIds.push(c.id);
    return;
  }

  const c = openInvestigation(w, subject.id) ?? openCase(d, w, { subject, tier, source: swat ? 'proactive' : 'patrol', at: ctx.b, status: 'open', officerIds, unit: ctx.unit, squadId }, acc);
  for (const id of officerIds) if (!c.officerIds.includes(id)) c.officerIds.push(id);
  const armed = swat && crew ? draw(w.seed, 'e', ctx.h, ctx.key, 0) < ARCHETYPES[crew.archetype].escalation[tier as 3 | 4] : false;
  const lead = addLead(w, c, !swat ? 'sighting' : armed ? 'armed_contact' : 'proactive', ctx.b, acc, squadId);
  if (ctx.shift && !ctx.shift.leadIds.includes(lead.id)) ctx.shift.leadIds.push(lead.id);
}

function pushContact(w: WorldState, ctx: ContactCtx, subject: Subject, tier: Tier, crew: Crew | undefined): void {
  pushEvent(w, { at: ctx.b, kind: 'contact', districtId: ctx.districtId, subjectId: subject.id, crewId: crew?.id, tier, unit: ctx.unit, squadId: ctx.shift?.squadId });
}

/** Roll the hour that ends at boundary b. */
export function rollHour(d: GameState, b: number, acc: WorldAcc): void {
  const w = d.world;
  const h = Math.round(b / HOUR) - 1;
  const shifts = w.shifts.filter((s) => shiftCoversBoundary(s, b)).sort((x, y) => idNumber(x.id) - idNumber(y.id));
  for (const districtId of DISTRICT_ORDER) {
    if (!w.districts[districtId].open) continue;
    for (const p of productiveUnits(d, districtId)) contact(d, { b, h, districtId, key: p.id, unit: patrolNumber(p.id) }, acc);
    for (const shift of shifts.filter((s) => s.districtId === districtId)) contact(d, { b, h, districtId, key: shift.id, shift }, acc);
  }
  for (const districtId of DISTRICT_ORDER) {
    if (!w.districts[districtId].open) continue;
    for (const crew of activeCrews(w, districtId)) for (const s of recruitHour(w, crew, h, b)) seedTiesForSubject(d, s.id);
    for (const crew of w.crews.filter((c) => c.districtId === districtId && c.status === 'collapsed')) formSuccessorIfDue(d, crew, b);
  }
  for (const districtId of DISTRICT_ORDER) {
    const district = w.districts[districtId];
    if (!district.open) continue;
    const target = crimeTarget(w, districtId, coverageAt(d, districtId, b));
    district.crime = round1(clamp(district.crime + (target - district.crime) * CRIME.driftPerHour, 0, 100));
    district.patrolUnits = employedPatrol(d).filter((p) => patrolDistrict(w, p) === districtId).length;
  }
}

function formSuccessorIfDue(d: GameState, crew: Crew, b: number): boolean {
  const w = d.world;
  if (!successorDue(w, crew, b, SUCCESSOR_DELAY_MS)) return false;
  const before = w.nextId;
  formSuccessor(w, crew, b);
  for (const id of Object.keys(w.subjects)) if (idNumber(id) >= before) seedTiesForSubject(d, id);
  return true;
}
