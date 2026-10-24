import { describe, expect, it } from 'vitest';
import { createInitialState } from '../department';
import { dispatch } from '../game';
import { HOUR_MS } from '../economy';
import type { Command, DebriefResult, GameState, OperationRun } from '../types';
import { addLead, openCase } from './cases';
import { applyWorldDebrief, validWorldState } from './index';
import { cityView, crewLadder, radioLines, shiftPreview, subjectDossier } from './selectors';

const T0 = 1_800_000_000_000 + 20 * 60_000;
const H = HOUR_MS;

const run = (state: GameState, cmd: Command, now: number): GameState => {
  const out = dispatch(state, cmd, { now });
  if (!out.result.ok) throw new Error(`${cmd.type} refused: ${out.result.reason}`);
  return out.state;
};
const refused = (state: GameState, cmd: Command, now: number): string => {
  const out = dispatch(state, cmd, { now });
  return out.result.ok ? '' : out.result.reason;
};
const tick = (state: GameState, now: number): GameState => run(state, { type: 'tick' }, now);

function open(seed = 7): GameState {
  let s = createInitialState(T0, seed);
  s.world.onboarding.stage = 'founding';
  s = run(s, { type: 'foundDepartment', name: 'Westhaven SWAT', districtId: 'pike' }, T0);
  s.world.onboarding.stage = 'done';
  return s;
}

describe('founding rules', () => {
  it('waits for the first call, names the unit, and runs once', () => {
    const fresh = createInitialState(T0, 4);
    expect(refused(fresh, { type: 'foundDepartment', name: 'Unit', districtId: 'pike' }, T0)).toMatch(/first call/);
    const ready = structuredClone(fresh);
    ready.world.onboarding.stage = 'founding';
    expect(refused(ready, { type: 'foundDepartment', name: 'x', districtId: 'pike' }, T0)).toMatch(/2 to 40/);
    const founded = run(ready, { type: 'foundDepartment', name: '  Westhaven   SWAT ', districtId: 'pike' }, T0);
    expect(founded.department.name).toBe('Westhaven SWAT');
    expect(refused(founded, { type: 'foundDepartment', name: 'Again', districtId: 'pike' }, T0)).toMatch(/already founded/);
    expect(validWorldState(founded.world, T0)).toBe(true);
  });

  it('moves the journey on when the first call debrief closes', () => {
    const s = createInitialState(T0, 4);
    applyWorldDebrief(s, { id: 'r1', scenarioId: 'none' } as unknown as OperationRun, { endingId: 'x' } as DebriefResult);
    expect(s.world.onboarding.stage).toBe('founding');
  });
});

describe('districts and coverage', () => {
  it('opens a district only at its level, with its crew', () => {
    const s = open();
    expect(refused(s, { type: 'openDistrict', districtId: 'larkin' }, T0)).toMatch(/level 2/);
    s.department.level = 2;
    const next = run(s, { type: 'openDistrict', districtId: 'larkin' }, T0);
    expect(next.world.districts.larkin.open).toBe(true);
    expect(next.world.crews.some((c) => c.districtId === 'larkin' && c.archetype === 'theft_ring')).toBe(true);
    expect(next.world.districts.larkin.crime).toBe(58);
    expect(validWorldState(next.world, T0)).toBe(true);
  });

  it('moves named staff and keeps the total', () => {
    let s = open();
    s.department.level = 2;
    s = run(s, { type: 'openDistrict', districtId: 'larkin' }, T0);
    const total = s.patrol.personnel.length;
    s = run(s, { type: 'setDistrictCoverage', districtId: 'larkin', units: 2 }, T0);
    expect(s.patrol.personnel.filter((p) => p.districtId === 'larkin').length).toBe(2);
    expect(s.world.districts.larkin.patrolUnits).toBe(2);
    expect(s.world.districts.pike.patrolUnits).toBe(total - 2);
    expect(refused(s, { type: 'setDistrictCoverage', districtId: 'larkin', units: total + 1 }, T0)).toMatch(/employed/);
    expect(refused(s, { type: 'setDistrictCoverage', districtId: 'pike', units: 1 }, T0)).toMatch(/instead/);
    s = run(s, { type: 'setDistrictCoverage', districtId: 'larkin', units: 0 }, T0);
    expect(s.patrol.personnel.every((p) => p.districtId === undefined)).toBe(true);
    // Staff on Larkin Heights meet people there.
    s = run(s, { type: 'setDistrictCoverage', districtId: 'larkin', units: 4 }, T0);
    s = tick(s, T0 + 40 * H);
    expect(s.world.events.some((e) => e.kind === 'contact' && e.districtId === 'larkin')).toBe(true);
    expect(s.world.events.some((e) => e.kind === 'contact' && e.districtId === 'pike' && e.at > T0 + H)).toBe(false);
  });
});

describe('warrants and armed contacts', () => {
  function withLead(source: 'proactive' | 'armed_contact', at = T0) {
    const s = open();
    const w = s.world;
    const crew = w.crews[0];
    const subject = Object.values(w.subjects).find((x) => x.crewId === crew.id && x.tier === 3)!;
    const c = openCase(s, w, { subject, tier: 3, source: 'proactive', at, status: 'open' });
    const lead = addLead(w, c, source, at);
    return { s, c, lead, subject };
  }
  const run1 = (c: { id: string }, leadId: string, subjectId: string) => ({ id: 'r1', scenarioId: 'none', squadIds: [], world: { kind: 'warrant', caseId: c.id, leadId, subjectId, caseTier: 3, districtId: 'pike' } }) as unknown as OperationRun;

  it('refuses a warrant until a call is written, and keeps the lead', () => {
    const { s, lead } = withLead('proactive');
    expect(refused(s, { type: 'openWarrant', leadId: lead.id }, T0)).toMatch(/No warrant call is written yet/);
    expect(s.world.leads.find((l) => l.id === lead.id)!.status).toBe('open');
  });

  it('answers an armed contact only inside its live window', () => {
    const { s, lead } = withLead('armed_contact');
    expect(lead.liveUntil).toBe(T0 + 10 * 60_000);
    expect(refused(s, { type: 'respondToContact', leadId: lead.id }, T0 + 5 * 60_000)).toMatch(/No warrant call is written yet/);
    expect(refused(s, { type: 'respondToContact', leadId: lead.id }, T0 + 11 * 60_000)).toMatch(/passed/);
    expect(refused(s, { type: 'respondToContact', leadId: lead.id }, T0)).not.toBe('');
  });

  it('settles a lawful resolution through the review clock and pays once', () => {
    const { s, c, lead, subject } = withLead('proactive');
    lead.status = 'warrant';
    lead.cardId = 'gen:test';
    s.department.clockHighWater = T0 + 60_000;
    applyWorldDebrief(s, run1(c, lead.id, subject.id), { endingId: 'x', completionAchieved: true } as DebriefResult);
    const kase = s.world.cases.find((k) => k.id === c.id)!;
    expect(kase.status).toBe('review');
    expect(kase.source).toBe('warrant');
    expect(kase.closesAt).toBe(T0 + 60_000 + 6 * H);
    expect(s.world.leads.find((l) => l.id === lead.id)!.status).toBe('served');
    expect(validWorldState(s.world, T0 + 60_000)).toBe(true);
    const before = s.department.funding;
    const closed = tick(s, T0 + 8 * H);
    const paid = closed.world.cases.find((k) => k.id === c.id)!;
    expect(paid.status).toBe('closed');
    expect(closed.department.funding - before).toBeGreaterThanOrEqual(paid.award);
    const again = tick(closed, T0 + 9 * H);
    expect(again.world.cases.filter((k) => k.paidEventId === paid.paidEventId).length).toBe(1);
  });

  it('returns the lead to open when the suspect gets away', () => {
    const { s, c, lead, subject } = withLead('proactive');
    lead.status = 'warrant';
    lead.cardId = 'gen:test';
    applyWorldDebrief(s, run1(c, lead.id, subject.id), { endingId: 'x', completionAchieved: false } as DebriefResult);
    expect(s.world.leads.find((l) => l.id === lead.id)!.status).toBe('open');
    expect(s.world.cases.find((k) => k.id === c.id)!.status).toBe('open');
  });

  it('puts a lead back when its card leaves the board without a call', () => {
    const { s, lead } = withLead('proactive');
    const live = s.world.leads.find((l) => l.id === lead.id)!;
    live.status = 'warrant';
    live.cardId = 'gen:gone';
    const next = tick(s, T0 + 2 * H);
    expect(next.world.leads.find((l) => l.id === lead.id)!.status).toBe('open');
  });
});

describe('selectors', () => {
  it('shows the city, a ladder that hides strangers, and a dossier only for people met', () => {
    const s = tick(open(), T0 + 30 * H);
    const city = cityView(s);
    expect(city.districts).toHaveLength(5);
    expect(city.districts[0].open).toBe(true);
    expect(city.districts[1].open).toBe(false);
    const crew = s.world.crews[0];
    const ladder = crewLadder(s, crew.id)!;
    expect(ladder.tiers.map((t) => t.name)).toEqual(['Corner hand', 'Runner', 'Crew lieutenant', 'Crew head']);
    const members = ladder.tiers.flatMap((t) => t.members);
    expect(members.some((m) => m.name === null)).toBe(true);
    for (const m of members) expect(m.name !== null).toBe(m.known);
    const met = Object.values(s.world.subjects).find((x) => x.known)!;
    expect(subjectDossier(s, met.id)!.name).toBe(`${met.firstName} ${met.surname}`);
    const stranger = Object.values(s.world.subjects).find((x) => !x.known)!;
    expect(subjectDossier(s, stranger.id)).toBeNull();
    const lines = radioLines(s, 5);
    expect(lines.length).toBe(5);
    expect(lines[0].event.at).toBeGreaterThanOrEqual(lines[4].event.at);
  });

  it('previews a shift as a seeded range and shortens it for a strained squad', () => {
    const s = open();
    for (const id of s.squads[0].officerIds) s.officers[id].stress = 10;
    const a = shiftPreview(s, 'A', 'pike', 8);
    const b = shiftPreview(s, 'A', 'pike', 8);
    expect(a).toEqual(b);
    expect(a.awardP10).toBeLessThanOrEqual(a.awardP50);
    expect(a.awardP50).toBeLessThanOrEqual(a.awardP90);
    expect(a.grant).toBe(1600);
    expect(a.stress[0].end).toBe(26);
    for (const id of s.squads[0].officerIds) s.officers[id].stress = 50;
    const strained = shiftPreview(s, 'A', 'pike', 8);
    expect(strained.stopsEarly).toBe(true);
    expect(strained.hours).toBe(4);
    expect(strained.ok).toBe(true);
  });
});

describe('crews', () => {
  it('turns closed street cases into intel and then a lead on a lieutenant', () => {
    let s = open();
    const w = s.world;
    const crew = w.crews[0];
    const hands = Object.values(w.subjects).filter((x) => x.crewId === crew.id && x.tier === 1).slice(0, 6);
    for (const hand of hands) openCase(s, w, { subject: hand, tier: 1, source: 'patrol', at: T0, status: 'review' });
    s = tick(s, T0 + 2 * H);
    const lieutenants = Object.values(s.world.subjects).filter((x) => x.crewId === crew.id && x.tier === 3);
    const intel = lieutenants.map((l) => s.world.crews[0].intel[l.id] ?? 0);
    expect(Math.max(...intel)).toBeGreaterThanOrEqual(6);
    const lead = s.world.leads.find((l) => l.source === 'intel');
    expect(lead).toBeDefined();
    expect(s.world.cases.find((c) => c.id === lead!.caseId)!.status).toBe('open');
    expect(lead!.tier).toBe(3);
    expect(validWorldState(s.world, s.department.clockHighWater)).toBe(true);
  });

  it('collapses when the head is charged, drops crime, and forms a successor after 7 days', () => {
    let s = open();
    const w = s.world;
    const crew = w.crews[0];
    const head = Object.values(w.subjects).find((x) => x.crewId === crew.id && x.tier === 4)!;
    const c = openCase(s, w, { subject: head, tier: 4, source: 'warrant', at: T0, status: 'review' });
    c.resolution = 'charged';
    w.districts.pike.crime = 70;
    s = tick(s, T0 + 13 * H);
    const collapsed = s.world.crews.find((k) => k.id === crew.id)!;
    expect(collapsed.status).toBe('collapsed');
    expect(s.world.subjects[head.id].status).toBe('resolved');
    expect(s.world.districts.pike.crime).toBeLessThan(70 - 22 + 6);
    expect(s.world.events.some((e) => e.kind === 'crew_collapsed')).toBe(true);
    let now = T0 + 13 * H;
    for (let day = 0; day < 9; day++) {
      now += 24 * H;
      s = run(tick(s, now), { type: 'markIncidentsSeen' }, now);
    }
    const successors = s.world.crews.filter((k) => k.status === 'active' && k.formedAt > collapsed.collapsedAt!);
    expect(successors).toHaveLength(1);
    expect(successors[0].formedAt).toBeGreaterThanOrEqual(collapsed.collapsedAt! + 7 * 24 * H);
    expect(s.world.events.filter((e) => e.kind === 'crew_formed')).toHaveLength(1);
    expect(validWorldState(s.world, s.department.clockHighWater)).toBe(true);
  });
});
