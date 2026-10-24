import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../sim/department';
import { foundDepartment } from '../../../sim/world';
import { radioLines } from '../../../sim/world/selectors';
import { DISTRICT_IDS, type DistrictId } from '../../../sim/world/types';
import type { GameState, ShiftReport } from '../../../sim/types';
import { awayText, clockStamp } from './clock';
import { crewInitials, crimeBand, crimeLabel, moodLine, projectCrime, sparklinePoints } from './district';
import { firstSentences, firstCard } from './first-call';
import { CITY_LAYOUT, MAP_H, MAP_W, percentX, percentY, polygonPoints, type Point } from './layout';
import { nowItem } from './now';
import { DEFAULT_NOTIFY, parseNotify } from './notify-prefs';
import { radioItem, radioItems } from './radio-lines';
import { fundingRows, LONG_AWAY_MS, reportView, welcomeView } from './report';

const NOW = Date.UTC(2026, 9, 3);

function founded(): GameState {
  const state = createInitialState(NOW, 7);
  state.world.onboarding.stage = 'founding';
  expect(foundDepartment(state, 'Night Unit', 'pike').ok).toBe(true);
  return state;
}

/** Ray casting: is the point inside the polygon. */
function inside([x, y]: Point, poly: readonly Point[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const report = (patch: Partial<ShiftReport> = {}): ShiftReport => ({
  from: NOW - 8 * 3600_000, to: NOW, accruedHours: 8, gross: 11910, wages: 900, operating: 600, restockSpend: 0, net: 11360,
  completedCourses: [], recovered: [], shortages: [], capped: false, equipment: [], personnel: [], ...patch,
});

describe('city clock', () => {
  it('prints the game day and a 12 hour time', () => {
    const state = createInitialState(NOW, 1);
    const epoch = state.department.calendarEpoch;
    expect(clockStamp(state, epoch)).toEqual({ day: 1, time: '12:00 AM' });
    expect(clockStamp(state, epoch + 3600_000 * 1.5)).toEqual({ day: 2, time: '12:00 PM' });
    expect(clockStamp(state, epoch + 3600_000 * (1 + 21.5 / 24))).toEqual({ day: 2, time: '9:30 PM' });
  });

  it('says real durations the way the reports do', () => {
    expect(awayText(45 * 60_000)).toBe('45 m');
    expect(awayText((8 * 60 + 12) * 60_000)).toBe('8 h 12 m');
    expect(awayText((3 * 24 + 4) * 3600_000)).toBe('3 days 4 h');
  });
});

describe('city layout', () => {
  it('draws a polygon for every district and keeps its marks inside it', () => {
    for (const id of DISTRICT_IDS) {
      const shape = CITY_LAYOUT[id];
      expect(shape.points.length).toBeGreaterThanOrEqual(5);
      for (const [x, y] of shape.points) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(MAP_W); expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(MAP_H); }
      for (const dot of shape.dots) expect(inside(dot, shape.points), `${id} dot ${dot}`).toBe(true);
      expect(inside(shape.pin, shape.points), `${id} pin`).toBe(true);
      expect(inside(shape.badge, shape.points), `${id} badge`).toBe(true);
    }
    expect(polygonPoints([[1, 2], [3, 4]])).toBe('1,2 3,4');
    expect(percentX(MAP_W / 2)).toBe('50%');
    expect(percentY(MAP_H)).toBe('100%');
  });
});

describe('district words', () => {
  it('bands crime and labels it with its trend', () => {
    expect([44, 50, 59, 60, 80].map(crimeBand)).toEqual(['low', 'mid', 'mid', 'high', 'high']);
    expect(crimeLabel({ crime: 62.4, trend: 'rising' })).toBe('CRIME 62 ▲');
    expect(crimeLabel({ crime: 44, trend: 'steady' })).toBe('CRIME 44 · QUIET');
    expect(crimeLabel({ crime: 53, trend: 'falling' })).toBe('CRIME 53 ▼');
  });

  it('writes one mood line from the numbers and the crew', () => {
    const crews = [{ id: 'k1', name: 'Pike Street Kings', archetype: 'street_crew', label: 'Street crew', strength: 60, status: 'active' as const, headcount: 20 }];
    expect(moodLine({ crime: 62, trend: 'rising', crews })).toBe('Tense, and rising. The Pike Street Kings work these streets.');
    expect(moodLine({ crime: 44, trend: 'steady', crews: [] })).toBe('Steady. No crew is working these streets.');
    expect(moodLine({ crime: 30, trend: 'falling', crews: [{ ...crews[0], name: 'The Mill Table' }] })).toBe('Quiet, and easing. The Mill Table work these streets.');
  });

  it('projects crime toward its equilibrium and draws it', () => {
    const points = projectCrime({ crime: 62, equilibrium: 50 });
    expect(points).toHaveLength(7);
    expect(points[0]).toBe(62);
    for (let i = 1; i < points.length; i++) expect(points[i]).toBeLessThan(points[i - 1]);
    expect(points[6]).toBeGreaterThan(50);
    expect(projectCrime({ crime: 40, equilibrium: 40 }).every((v) => v === 40)).toBe(true);
    const line = sparklinePoints(points, 88, 28).split(' ');
    expect(line).toHaveLength(7);
    // Falling crime draws downhill: the last point is lower on the screen (larger y).
    expect(Number(line[6].split(',')[1])).toBeGreaterThan(Number(line[0].split(',')[1]));
    // A flat series sits mid height and never divides by zero.
    expect(sparklinePoints([40, 40, 40], 88, 28).split(' ').every((p) => p.endsWith(',14'))).toBe(true);
  });

  it('makes crest letters from a crew name', () => {
    expect(crewInitials('Pike Street Kings')).toBe('PK');
    expect(crewInitials('The Mill Table')).toBe('MT');
    expect(crewInitials('Alley Set')).toBe('AS');
  });
});

describe('the radio', () => {
  it('words each event from its fields, skips the duplicate case line and never uses a dash or a colon', () => {
    const state = founded();
    const lines = radioLines(state, 20);
    expect(lines.length).toBeGreaterThan(0);
    const items = lines.map((line) => radioItem(state, line)).filter((item) => !!item);
    expect(items.some((item) => item!.text.startsWith('stopped '))).toBe(true);
    expect(lines.some((line) => line.event.kind === 'case_opened')).toBe(true);
    expect(lines.map((line) => radioItem(state, line)).filter((item) => item === null)).toHaveLength(lines.filter((line) => line.event.kind === 'case_opened').length);
    for (const item of items) {
      for (const part of [item!.who, item!.place, item!.text]) expect(part).not.toMatch(/[:—–]| - /);
      expect(item!.time).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    }
  });

  it('names a person only once the player has met them, and shows a closed case with its funding', () => {
    const state = founded();
    const event = state.world.events.find((e) => e.kind === 'contact')!;
    const subject = state.world.subjects[event.subjectId!];
    subject.known = false;
    const hidden = radioItem(state, radioLines(state, 20).find((l) => l.event.id === event.id)!);
    expect(hidden!.text).not.toContain(subject.surname);
    expect(hidden!.text).toMatch(/^stopped one/);
    state.world.events.push({ id: 'e_close', at: event.at + 1000, kind: 'case_closed', districtId: 'pike', subjectId: subject.id, tier: 1, amount: 150 });
    subject.known = true;
    const closed = radioItems(state, 1)[0];
    expect(closed).toMatchObject({ who: 'Dispatch', amount: 150 });
    expect(closed.text).toContain(subject.surname);
  });

  it('returns the newest lines first and at most the number asked for', () => {
    const state = founded();
    const items = radioItems(state, 3);
    expect(items.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < items.length; i++) expect(items[i - 1].at).toBeGreaterThanOrEqual(items[i].at);
  });
});

describe('the Now strip', () => {
  it('puts a live call first, then an armed contact, then a warrant, then the next call', () => {
    const state = founded();
    const at = state.department.clockHighWater;
    const subject = Object.values(state.world.subjects).find((s) => s.tier === 3)!;
    subject.known = true;
    const crew = state.world.crews[0];
    expect(nowItem(state, at).kind).toBe('call');
    state.world.leads.push({ id: 'l_w', caseId: 'c_x', subjectId: subject.id, crewId: crew.id, districtId: 'pike', tier: 3, foundAt: at, source: 'proactive', status: 'open' });
    const warrant = nowItem(state, at);
    expect(warrant.kind).toBe('warrant');
    state.world.leads.push({ id: 'l_a', caseId: 'c_y', subjectId: subject.id, crewId: crew.id, districtId: 'pike', tier: 3, foundAt: at, source: 'armed_contact', status: 'open', liveUntil: at + 60_000 });
    const armed = nowItem(state, at);
    expect(armed.kind).toBe('armed');
    expect(armed.kind === 'armed' && armed.title).toContain(subject.surname);
    // Kept as a lead, or past its window, it falls to the warrant.
    expect(nowItem(state, at, new Set(['l_a'])).kind).toBe('warrant');
    expect(nowItem(state, at + 120_000).kind).toBe('warrant');
    state.activeRun = { id: 'r1', scenarioId: state.incidents[0].id, status: 'live', clock: 12 } as unknown as GameState['activeRun'];
    expect(nowItem(state, at)).toMatchObject({ kind: 'live', minute: 12 });
  });

  it('says so plainly when nothing is waiting', () => {
    const state = founded();
    state.incidents = [];
    expect(nowItem(state, state.department.clockHighWater)).toMatchObject({ kind: 'quiet' });
  });
});

describe('the first call', () => {
  it('offers the gentlest card first and trims a hook to two sentences', () => {
    const state = createInitialState(NOW, 3);
    state.incidents[1].tier = 1;
    state.incidents[0].tier = 3;
    state.incidents[2].tier = 2;
    expect(firstCard(state, NOW)?.id).toBe(state.incidents[1].id);
    expect(firstSentences('One. Two! Three? Four.')).toBe('One. Two!');
    expect(firstSentences('A'.repeat(400), 2, 100)).toHaveLength(100);
    expect(firstSentences(undefined)).toBe('');
  });
});

describe('the return report', () => {
  it('keeps funding to the rows the report can stand behind and reconciles to the net', () => {
    const rows = fundingRows(report({ world: { contacts: 5, casesOpened: 3, casesClosed: 2, awardsPaid: 2, awardFunding: 1050, leads: [], crime: {} } }));
    expect(rows.map((r) => r.key)).toEqual(['grants', 'cases', 'other', 'wages', 'upkeep']);
    expect(rows.reduce((sum, r) => sum + r.value, 0)).toBe(11360);
    expect(rows.length).toBeLessThanOrEqual(5);
    const plain = fundingRows(report({ gross: 5000, wages: 1000, operating: 0, net: 4000 }));
    expect(plain.map((r) => r.key)).toEqual(['grants', 'wages']);
    expect(plain.reduce((sum, r) => sum + r.value, 0)).toBe(4000);
  });

  it('puts a decision first, caps people at three and lists the cases', () => {
    const state = founded();
    const [a, b, c, d] = Object.keys(state.officers);
    const at = state.department.clockHighWater;
    state.people.imprints.push({ id: 'im1', officerId: a, pack: 'doubts_the_rear', cause: { place: 'the laundromat stairs', at: at - 1000 }, startedAt: at - 1000, endsAt: at + 9e6, seen: true, fork: { offeredAt: at } });
    state.people.beats.push({ id: 'b1', at, kind: 'bond_changed', officerIds: [b, c], refId: 'x:y:close', acknowledged: false });
    state.people.beats.push({ id: 'b2', at, kind: 'settled', officerIds: [d], refId: 'none', acknowledged: false });
    const view = reportView(state, report({ recovered: [d], people: ['b1', 'b2'], world: { contacts: 4, casesOpened: 3, casesClosed: 2, awardsPaid: 2, awardFunding: 1050, leads: [], crime: { pike: [62, 59] } } }));
    expect(view.people).toHaveLength(3);
    expect(view.people[0]).toMatchObject({ tag: 'DECIDE', tone: 'decide', open: a });
    expect(view.people[0].text).toMatch(/Rest, peer support, or pair up\.$/);
    expect(view.people.find((l) => l.tag === 'CLOSE')).toMatchObject({ tone: 'close', officerIds: [b, c] });
    expect(view.people.map((l) => l.tag).sort()).toEqual(['CLOSE', 'DECIDE', 'SETTLED']);
    expect(view.cases).toMatchObject({ opened: 3, closed: 2, crime: { name: 'Pike Street', before: 62, after: 59 } });
    expect(view.away).toBe('8 H 0 M');
    expect(view.span).toMatch(/^\d{1,2}:\d{2} (AM|PM) TO \d{1,2}:\d{2} (AM|PM)$/);
    expect(view.quiet).toBe(false);
    // Romance never shows when personal lives are off.
    state.people.beats.push({ id: 'b3', at, kind: 'romance', officerIds: [b, c], refId: 'x:y', acknowledged: false });
    const on = reportView(state, report({ people: ['b3'] }), true).people.filter((l) => l.tag === 'TOGETHER');
    const off = reportView(state, report({ people: ['b3'] }), false).people.filter((l) => l.tag === 'TOGETHER');
    expect(on).toHaveLength(1);
    expect(off).toHaveLength(0);
  });

  it('is quiet when nothing happened to people or cases', () => {
    expect(reportView(founded(), report()).quiet).toBe(true);
  });

  it('writes where the player left it for a long absence', () => {
    const state = founded();
    const at = state.department.clockHighWater;
    const lead = { id: 'l1', caseId: 'c1', subjectId: Object.values(state.world.subjects).find((s) => s.tier === 3)!.id, crewId: state.world.crews[0].id, districtId: 'pike' as DistrictId, tier: 3 as const, foundAt: at, source: 'proactive' as const, status: 'open' as const };
    state.world.subjects[lead.subjectId].known = true;
    state.world.leads.push(lead);
    const long = report({ from: at - 9 * 24 * 3600_000, to: at, accruedHours: 72, net: 31800 });
    expect(long.to - long.from).toBeGreaterThanOrEqual(LONG_AWAY_MS);
    const view = welcomeView(state, long);
    expect(view.days).toBe('9 DAYS AWAY');
    expect(view.intro).toContain('72 hours');
    expect(view.lines.map((l) => l.kind)).toEqual(['lead', 'funding']);
    expect(view.lines[1].amount).toBe(31800);
    expect(view.pickUp).toBeNull();
    for (const line of view.lines) expect(`${line.before}${line.bold}${line.after}`).not.toMatch(/[—–]| - /);
  });
});

describe('notification choices', () => {
  it('defaults to the two event categories on, the digest off, and ignores junk', () => {
    expect(parseNotify(null)).toEqual(DEFAULT_NOTIFY);
    expect(parseNotify('not json')).toEqual(DEFAULT_NOTIFY);
    expect(parseNotify(JSON.stringify({ finished: false, calls: 'yes', digest: true, asked: true }))).toEqual({ finished: false, calls: true, digest: true, asked: true });
  });
});
