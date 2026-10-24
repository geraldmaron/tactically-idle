// Investigations, leads and intel. A case is one investigation of one person: it opens from a contact (a
// clock starts at once for tiers 1 and 2) or waits as `open` for a warrant (tiers 3 and 4). It pays its
// award exactly once, when it closes, whatever lawful resolution ends it.
import { ARCHETYPES } from '../../content/city/archetypes';
import { DISTRICTS } from '../../content/city/districts';
import { BACK_AFTER_MS, CASE_AWARD, CONTACT, CRIME, REPEAT_SHARE, RESOLUTION_WEIGHTS, REVIEW_CLOCK_MS } from '../../content/city/tuning';
import type { GameState } from '../types';
import { postFunding } from '../ledger';
import { recordCaseFact } from '../people';
import { clamp, draw, fundingScale, hourOf, newId, pushEvent, round1, weighted, type WorldAcc } from './core';
import { addHistory, collapseCrew, membersOf, refreshStrength } from './population';
import type { CaseResolution, CaseSource, Crew, Lead, LeadSource, Subject, Tier, WorldCase, WorldState } from './types';

const RESOLUTIONS: readonly Exclude<CaseResolution, never>[] = ['charged', 'diverted', 'care', 'released', 'cleared'];

/** The award a new investigation of this person will pay, at the funding scale of the moment it opens. */
export function awardFor(w: WorldState, d: Pick<GameState, 'department'>, subject: Subject, crew: Crew | null, tier: Tier): { award: number; repeat: boolean } {
  const repeat = w.cases.some((c) => c.subjectId === subject.id && c.status === 'closed');
  const factor = crew ? ARCHETYPES[crew.archetype].awardFactor : 1;
  const full = CASE_AWARD[tier] * factor * fundingScale(d.department.level);
  return { award: Math.round(repeat ? full * REPEAT_SHARE : full), repeat };
}

export interface OpenCaseInput {
  subject: Subject;
  tier: Tier;
  source: CaseSource;
  at: number;
  /** `review` starts the clock now (tiers 1 and 2); `open` waits on a warrant (tiers 3 and 4). */
  status: 'review' | 'open';
  officerIds?: string[];
  unit?: number;
  squadId?: 'A' | 'B' | 'C' | 'D';
}

export function openCase(d: GameState, w: WorldState, input: OpenCaseInput, acc?: WorldAcc): WorldCase {
  const { subject, tier, at } = input;
  const crew = subject.crewId ? w.crews.find((c) => c.id === subject.crewId) ?? null : null;
  const id = newId(w, 'c');
  const { award, repeat } = awardFor(w, d, subject, crew, tier);
  const resolution = RESOLUTIONS[weighted(draw(w.seed, 'res', hourOf(at), id, 0), RESOLUTIONS.map((r) => RESOLUTION_WEIGHTS[tier][r]))];
  const c: WorldCase = {
    id,
    subjectId: subject.id,
    crewId: crew?.id ?? null,
    archetype: crew?.archetype ?? null,
    tier,
    districtId: subject.districtId,
    source: input.source,
    openedAt: at,
    status: input.status,
    closesAt: input.status === 'review' ? at + REVIEW_CLOCK_MS[tier] : null,
    repeat,
    resolution,
    award,
    officerIds: input.officerIds ? [...input.officerIds] : [],
  };
  w.cases.push(c);
  subject.reservedBy = id;
  subject.known = true;
  if (input.status === 'review') subject.status = 'held';
  addHistory(subject, { at, kind: 'case_opened', caseId: id });
  pushEvent(w, { at, kind: 'case_opened', districtId: c.districtId, subjectId: subject.id, caseId: id, crewId: c.crewId ?? undefined, tier, unit: input.unit, squadId: input.squadId });
  if (acc) acc.casesOpened++;
  return c;
}

/** The investigation of this person that is waiting on a warrant, if any. */
export const openInvestigation = (w: WorldState, subjectId: string): WorldCase | undefined => w.cases.find((c) => c.subjectId === subjectId && c.status === 'open');

/** The lead still alive on a case (not yet served), if any. */
export const liveLead = (w: WorldState, caseId: string): Lead | undefined => w.leads.find((l) => l.caseId === caseId && l.status !== 'served');

/** A lead on an investigation. Leads never expire; one case holds one live lead at a time. */
export function addLead(w: WorldState, c: WorldCase, source: LeadSource, at: number, acc?: WorldAcc, squadId?: 'A' | 'B' | 'C' | 'D'): Lead {
  const existing = liveLead(w, c.id);
  if (existing) {
    // The same investigation met again armed: the lead can be answered live now.
    if (source === 'armed_contact' && existing.status === 'open' && existing.source !== 'armed_contact') {
      existing.source = 'armed_contact';
      existing.liveUntil = at + CONTACT.liveWindowMs;
    }
    return existing;
  }
  const lead: Lead = {
    id: newId(w, 'l'),
    caseId: c.id,
    subjectId: c.subjectId,
    crewId: c.crewId,
    districtId: c.districtId,
    tier: c.tier,
    foundAt: at,
    source,
    status: 'open',
    ...(source === 'armed_contact' ? { liveUntil: at + CONTACT.liveWindowMs } : {}),
  };
  w.leads.push(lead);
  const subject = w.subjects[c.subjectId];
  if (subject) {
    subject.known = true;
    addHistory(subject, { at, kind: 'lead', leadId: lead.id, caseId: c.id });
  }
  pushEvent(w, { at, kind: 'lead', districtId: c.districtId, subjectId: c.subjectId, caseId: c.id, leadId: lead.id, crewId: c.crewId ?? undefined, tier: c.tier, squadId });
  acc?.leads.push(lead.id);
  return lead;
}

/** Add intel toward one rung of a crew. At the archetype's need a lead opens on that member. */
export function addIntel(d: GameState, w: WorldState, crew: Crew, rung: 3 | 4, amount: number, at: number, acc?: WorldAcc): void {
  const need = ARCHETYPES[crew.archetype].intelNeeded[rung];
  const candidates = membersOf(w, crew, rung).filter((s) => {
    if (s.status !== 'free') return false;
    if (s.reservedBy !== null && w.cases.find((c) => c.id === s.reservedBy)?.status !== 'open') return false;
    return (crew.intel[s.id] ?? 0) < need;
  });
  if (!candidates.length) return;
  // The member the crew's trail already points at, then the lowest id.
  candidates.sort((a, b) => (crew.intel[b.id] ?? 0) - (crew.intel[a.id] ?? 0));
  const target = candidates[0];
  const total = Math.min(need, (crew.intel[target.id] ?? 0) + amount);
  crew.intel[target.id] = total;
  if (total < need) return;
  const c = openInvestigation(w, target.id) ?? openCase(d, w, { subject: target, tier: rung, source: 'patrol', at, status: 'open' }, acc);
  addLead(w, c, 'intel', at, acc);
}

/** Close a case that has reached its clock: pay its award once, update the person, crew and district. */
export function closeCase(d: GameState, w: WorldState, c: WorldCase, acc?: WorldAcc): void {
  if (c.status !== 'review' || c.paidEventId !== undefined || c.closesAt === null) return;
  const at = c.closesAt;
  const subject = w.subjects[c.subjectId];
  const crew = c.crewId ? w.crews.find((k) => k.id === c.crewId) : undefined;
  postFunding(d.department, c.award, 'payout', `Case award, ${DISTRICTS[c.districtId].name}`, at);
  const event = pushEvent(w, { at, kind: 'case_closed', districtId: c.districtId, subjectId: c.subjectId, caseId: c.id, crewId: c.crewId ?? undefined, tier: c.tier, amount: c.award });
  c.status = 'closed';
  c.paidAt = at;
  c.paidEventId = event.id;
  if (acc) {
    acc.casesClosed++;
    acc.awardsPaid++;
    acc.awardFunding += c.award;
  }
  if (subject) {
    subject.reservedBy = null;
    addHistory(subject, { at, kind: 'case_closed', caseId: c.id });
    if (c.resolution === 'charged') {
      subject.status = 'resolved';
      subject.crewId = null;
    } else {
      subject.status = crew?.status === 'collapsed' ? 'gone' : 'free';
      subject.backAt = at + BACK_AFTER_MS[c.resolution];
      addHistory(subject, { at, kind: 'released', caseId: c.id });
    }
  }
  const district = w.districts[c.districtId];
  district.crime = round1(clamp(district.crime - CRIME.stepDown[c.tier], 0, 100));
  if (crew && crew.status === 'active') {
    if (c.resolution === 'charged') refreshStrength(w, crew);
    if (c.resolution === 'charged' && c.tier === 4) collapseCrew(w, crew, at);
    // A repeat investigation of someone already worked teaches the team nothing new about the crew, so the
    // ladder climbs with new people, not the same corner hand met again (lead tuning, 2026-10-24).
    else if (c.tier <= 2 && !c.repeat) addIntel(d, w, crew, 3, ARCHETYPES[crew.archetype].intelPerCase[c.tier as 1 | 2], at, acc);
    else if (c.tier === 3) addIntel(d, w, crew, 4, ARCHETYPES[crew.archetype].intelPerCase[3], at, acc);
  }
  if (w.onboarding.stage === 'first_shift' && w.onboarding.firstCaseId === c.id) w.onboarding.stage = 'first_return';
  if (c.officerIds.length) recordCaseFact(d, c.id);
}
