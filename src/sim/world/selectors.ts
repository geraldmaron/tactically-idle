// Read-only views of the city for the screens: the map and its list, a district sheet, a crew ladder, a
// dossier, the radio, the shift preview. Nothing here changes state. Names come from the content files and the
// subjects; no prose is made here beyond what a screen would otherwise rebuild from the same fields.
import { ARCHETYPES } from '../../content/city/archetypes';
import { DISTRICTS } from '../../content/city/districts';
import { CASE_AWARD, CONTACT, DISTRICT_ORDER } from '../../content/city/tuning';
import { ECONOMY_TUNING } from '../economy';
import type { GameState, SquadId } from '../types';
import { allocationFactor, allocationRate, cityCrime, draw, fundingScale, openDistrictIds, weighted } from './core';
import { coverageAt, crimeTarget, productiveUnits, swatCaseChance } from './contacts';
import { activeCrews, membersOf, subjectName } from './population';
import { liveLead } from './cases';
import { activeShifts, shiftGrantPerHour, shiftRefusal, squadSkill } from './shifts';
import type { Crew, DistrictId, Lead, ProactiveShift, Tier, WorldCase, WorldEvent } from './types';

export { fundingScale } from './core';
export { coverageRefusal } from './commands';

export interface CrewBrief {
  id: string;
  name: string;
  archetype: string;
  label: string;
  strength: number;
  status: Crew['status'];
  headcount: number;
}

export interface DistrictView {
  id: DistrictId;
  name: string;
  blurb: string;
  residents: readonly string[];
  open: boolean;
  openAtLevel: number;
  /** The department is high enough to open it and it is not open yet. */
  canOpen: boolean;
  crime: number;
  /** Where crime is heading with the crews and coverage as they stand. */
  equilibrium: number;
  trend: 'rising' | 'falling' | 'steady';
  /** Productive patrol units on its streets now. */
  units: number;
  /** Staff assigned here, training or not. */
  assigned: number;
  coverage: number;
  crews: CrewBrief[];
  shift: ProactiveShift | null;
  openCases: number;
  reviewCases: number;
  leads: number;
  /** Cases closed among the last 24 events on the radio. */
  recentClosed: number;
}

export interface AllocationNow {
  crime: number;
  factor: number;
  openDistricts: number;
  /** Funding per hour the city grants now. */
  perHour: number;
  /** What it would be at the floor, the figure commitments are checked against. */
  floorPerHour: number;
}

export function allocationNow(state: GameState): AllocationNow {
  const w = state.world;
  const crime = cityCrime(w);
  return {
    crime,
    factor: allocationFactor(crime),
    openDistricts: openDistrictIds(w).length,
    perHour: allocationRate(w, ECONOMY_TUNING.baseAllocation, false),
    floorPerHour: allocationRate(w, ECONOMY_TUNING.baseAllocation, true),
  };
}

function crewBrief(state: GameState, crew: Crew): CrewBrief {
  return { id: crew.id, name: crew.name, archetype: crew.archetype, label: ARCHETYPES[crew.archetype].label, strength: crew.strength, status: crew.status, headcount: membersOf(state.world, crew).length };
}

export function districtView(state: GameState, id: DistrictId): DistrictView {
  const w = state.world;
  const def = DISTRICTS[id];
  const district = w.districts[id];
  const at = state.department.clockHighWater;
  const coverage = district.open ? coverageAt(state, id, at) : 0;
  const equilibrium = district.open ? Math.round(crimeTarget(w, id, coverage) * 10) / 10 : district.crime;
  const gap = equilibrium - district.crime;
  const recent = w.events.slice(-24);
  return {
    id,
    name: def.name,
    blurb: def.blurb,
    residents: def.residents,
    open: district.open,
    openAtLevel: def.openAtLevel,
    canOpen: !district.open && state.department.level >= def.openAtLevel,
    crime: district.crime,
    equilibrium,
    trend: Math.abs(gap) < 1 ? 'steady' : gap > 0 ? 'rising' : 'falling',
    units: district.open ? productiveUnits(state, id).length : 0,
    assigned: district.patrolUnits,
    coverage,
    crews: w.crews.filter((c) => c.districtId === id).map((c) => crewBrief(state, c)),
    shift: activeShifts(w).find((s) => s.districtId === id) ?? null,
    openCases: w.cases.filter((c) => c.districtId === id && c.status === 'open').length,
    reviewCases: w.cases.filter((c) => c.districtId === id && c.status === 'review').length,
    leads: w.leads.filter((l) => l.districtId === id && l.status !== 'served').length,
    recentClosed: recent.filter((e) => e.kind === 'case_closed' && e.districtId === id).length,
  };
}

export interface CityView {
  districts: DistrictView[];
  allocation: AllocationNow;
  fundingScale: number;
  stage: GameState['world']['onboarding']['stage'];
  shifts: ProactiveShift[];
  openLeads: Lead[];
}

export function cityView(state: GameState): CityView {
  const w = state.world;
  return {
    districts: DISTRICT_ORDER.map((id) => districtView(state, id)),
    allocation: allocationNow(state),
    fundingScale: fundingScale(state.department.level),
    stage: w.onboarding.stage,
    shifts: activeShifts(w),
    openLeads: w.leads.filter((l) => l.status === 'open'),
  };
}

export interface LadderMember {
  id: string;
  /** null until the player has met them. */
  name: string | null;
  known: boolean;
  status: 'free' | 'held' | 'resolved' | 'gone';
  held: boolean;
  intel: number;
  intelNeed: number | null;
  lead: Lead | null;
  caseId: string | null;
}

export interface LadderTier {
  tier: Tier;
  name: string;
  /** People at this tier when the crew is whole. */
  full: number;
  present: number;
  /** Charged and out of the crew. */
  taken: number;
  members: LadderMember[];
}

export interface CrewLadder {
  crew: CrewBrief;
  tiers: LadderTier[];
}

export function crewLadder(state: GameState, crewId: string): CrewLadder | null {
  const w = state.world;
  const crew = w.crews.find((c) => c.id === crewId);
  if (!crew) return null;
  const arch = ARCHETYPES[crew.archetype];
  const tiers = ([1, 2, 3, 4] as const).map((tier): LadderTier => {
    const members = membersOf(w, crew, tier).map((s): LadderMember => {
      const c = s.reservedBy ? w.cases.find((k) => k.id === s.reservedBy) : undefined;
      return {
        id: s.id,
        name: s.known ? subjectName(s) : null,
        known: s.known,
        status: s.status,
        held: s.status === 'held',
        intel: crew.intel[s.id] ?? 0,
        intelNeed: tier === 3 || tier === 4 ? arch.intelNeeded[tier] : null,
        lead: c ? liveLead(w, c.id) ?? null : null,
        caseId: c?.id ?? null,
      };
    });
    return {
      tier,
      name: arch.tierNames[tier - 1],
      full: arch.members[tier - 1],
      present: members.length,
      taken: w.cases.filter((c) => c.crewId === crew.id && c.tier === tier && c.status === 'closed' && c.resolution === 'charged').length,
      members,
    };
  });
  return { crew: crewBrief(state, crew), tiers };
}

export interface DossierCase {
  id: string;
  tier: Tier;
  status: WorldCase['status'];
  source: WorldCase['source'];
  openedAt: number;
  closesAt: number | null;
  repeat: boolean;
  /** Only once the case has closed. */
  resolution: WorldCase['resolution'] | null;
  award: number;
  paid: boolean;
}

export interface Dossier {
  id: string;
  name: string;
  pronouns: string;
  tier: Tier;
  tierName: string | null;
  crewName: string | null;
  districtName: string;
  status: 'free' | 'held' | 'resolved' | 'gone';
  traits: string[];
  facts: { at: number; kind: string; caseId?: string; leadId?: string }[];
  cases: DossierCase[];
  leads: Lead[];
  /** Ties an officer has on the record. A hidden tie is not shown here. */
  ties: { id: string; officerId: string; officerName: string; kind: string }[];
}

export function subjectDossier(state: GameState, subjectId: string): Dossier | null {
  const w = state.world;
  const s = w.subjects[subjectId];
  if (!s || !s.known) return null;
  const crew = w.crews.find((c) => c.id === s.crewId) ?? w.cases.map((c) => (c.subjectId === s.id && c.crewId ? w.crews.find((k) => k.id === c.crewId) : undefined)).find(Boolean);
  const cases = w.cases.filter((c) => c.subjectId === s.id).map((c): DossierCase => ({
    id: c.id, tier: c.tier, status: c.status, source: c.source, openedAt: c.openedAt, closesAt: c.closesAt, repeat: c.repeat,
    resolution: c.status === 'closed' ? c.resolution : null, award: c.award, paid: c.paidEventId !== undefined,
  }));
  const ties = (state.people?.ties ?? []).filter((t) => t.subjectId === s.id && t.onRecord).map((t) => {
    const o = state.officers[t.officerId];
    return { id: t.id, officerId: t.officerId, officerName: o ? `${o.firstName} ${o.surname}` : t.officerId, kind: t.kind };
  });
  return {
    id: s.id,
    name: subjectName(s),
    pronouns: s.pronouns,
    tier: s.tier,
    tierName: crew ? ARCHETYPES[crew.archetype].tierNames[s.tier - 1] : null,
    crewName: crew?.name ?? null,
    districtName: DISTRICTS[s.districtId].name,
    status: s.status,
    traits: cases.some((c) => c.status === 'closed') ? [...s.traits] : [],
    facts: s.history.map((h) => ({ ...h })),
    cases,
    leads: w.leads.filter((l) => l.subjectId === s.id),
    ties,
  };
}

export interface RadioLine {
  event: WorldEvent;
  districtName: string | null;
  /** Only for a person the player has met. */
  subjectName: string | null;
  crewName: string | null;
  tierName: string | null;
}

/** The radio log, newest first, as data. The screen words each line from its fields. */
export function radioLines(state: GameState, n: number): RadioLine[] {
  const w = state.world;
  return w.events.slice(-Math.max(0, n)).reverse().map((event): RadioLine => {
    const s = event.subjectId ? w.subjects[event.subjectId] : undefined;
    const crew = event.crewId ? w.crews.find((c) => c.id === event.crewId) : undefined;
    return {
      event,
      districtName: event.districtId ? DISTRICTS[event.districtId].name : null,
      subjectName: s?.known ? subjectName(s) : null,
      crewName: crew?.name ?? null,
      tierName: crew && event.tier ? ARCHETYPES[crew.archetype].tierNames[event.tier - 1] : null,
    };
  });
}

export interface ShiftPreview {
  ok: boolean;
  /** Why it cannot start now, or null. The numbers below still describe what it would do. */
  reason: string | null;
  requestedHours: number;
  /** Hours before the strain stop, at most the requested ones. */
  hours: number;
  stopsEarly: boolean;
  /** The grant for the hours it would run. */
  grant: number;
  /** Case awards over the shift, from a seeded simulation of its draws: the low end, the middle and the high end. */
  awardP10: number;
  awardP50: number;
  awardP90: number;
  /** Chance the shift finds at least one lead. */
  leadChance: number;
  stress: { officerId: string; name: string; start: number; end: number }[];
}

const PREVIEW_TRIALS = 400;

/** What a shift would do with the real squad, as ranges and not averages. */
export function shiftPreview(state: GameState, squadId: SquadId, districtId: DistrictId, hours: number): ShiftPreview {
  const w = state.world;
  const now = state.department.clockHighWater;
  const squad = state.squads.find((s) => s.id === squadId);
  const members = (squad?.officerIds ?? []).map((id) => state.officers[id]).filter((o) => !!o);
  const rate = ECONOMY_TUNING.proactiveStrainPerHour;
  const worst = members.length ? Math.max(...members.map((o) => o.stress)) : 0;
  const room = rate > 0 ? Math.max(0, (58 - worst) / rate) : hours;
  const effective = Math.min(hours, room);
  const rolls = Math.floor(effective + 1e-9);
  const scale = fundingScale(state.department.level);
  const crews = activeCrews(w, districtId);
  const weights = crews.map((c) => ARCHETYPES[c.archetype].contactWeight);
  const chance = swatCaseChance(squadSkill(state, squadId));

  const totals: number[] = [];
  let withLead = 0;
  for (let t = 0; t < PREVIEW_TRIALS; t++) {
    const key = `${squadId}:${districtId}:${hours}:${t}`;
    let total = 0;
    let lead = false;
    for (let h = 0; h < rolls; h++) {
      if (draw(w.seed, 'pc', h, key, 0) >= CONTACT.swatPerHour) continue;
      const tier = (weighted(draw(w.seed, 'pt', h, key, 0), CONTACT.swatTierWeights) + 1) as Tier;
      if (tier >= 3) { lead = true; continue; }
      if (draw(w.seed, 'po', h, key, 0) >= chance) continue;
      const factor = crews.length ? ARCHETYPES[crews[weighted(draw(w.seed, 'pk', h, key, 0), weights)].archetype].awardFactor : 1;
      total += Math.round(CASE_AWARD[tier] * factor * scale);
    }
    totals.push(total);
    if (lead) withLead++;
  }
  totals.sort((a, b) => a - b);
  const at = (p: number) => totals[Math.min(totals.length - 1, Math.floor(p * totals.length))];
  return {
    ok: shiftRefusal(state, squadId, districtId, hours, now) === null,
    reason: shiftRefusal(state, squadId, districtId, hours, now),
    requestedHours: hours,
    hours: effective,
    stopsEarly: effective < hours,
    grant: Math.round(shiftGrantPerHour(state.department.level) * effective),
    awardP10: at(0.1),
    awardP50: at(0.5),
    awardP90: at(0.9),
    leadChance: Math.round((withLead / PREVIEW_TRIALS) * 1000) / 1000,
    stress: members.map((o) => ({ officerId: o.id, name: `${o.firstName} ${o.surname}`, start: o.stress, end: Math.min(100, Math.round((o.stress + rate * effective) * 10) / 10) })),
  };
}
