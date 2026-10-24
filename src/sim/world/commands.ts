// The player's commands on the world: founding the department, moving patrol coverage, opening a district.
// Shifts and warrants have their own modules.
import { DISTRICTS } from '../../content/city/districts';
import { employedPatrol } from '../patrol';
import { seedTiesForSubject } from '../people';
import type { GameState, HandlerResult } from '../types';
import { openCase } from './cases';
import { draw, hourOf, pushEvent } from './core';
import { activeCrews, idNumber, membersOf, reachable, seedDistrictCrews } from './population';
import type { DistrictId } from './types';

const fail = (reason: string): HandlerResult => ({ ok: false, reason });
const unitNumber = (id: string): number => Number(id.replace(/\D/g, '')) || 0;

/** The count each district's `patrolUnits` shows: employed staff assigned there (absent means Pike). */
export function syncPatrolUnits(d: GameState): void {
  const staff = employedPatrol(d);
  for (const district of Object.values(d.world.districts)) {
    district.patrolUnits = staff.filter((p) => (p.districtId ?? 'pike') === district.id).length;
  }
}

function openDistrictState(d: GameState, districtId: DistrictId, at: number): void {
  const w = d.world;
  const state = w.districts[districtId];
  const before = w.nextId;
  if (!state.open) {
    state.open = true;
    state.openedAt = at;
    state.crime = DISTRICTS[districtId].startCrime;
    pushEvent(w, { at, kind: 'district_opened', districtId });
  }
  if (!w.crews.some((c) => c.districtId === districtId)) seedDistrictCrews(w, districtId, at);
  for (const id of Object.keys(w.subjects)) if (idNumber(id) >= before) seedTiesForSubject(d, id);
}

export function openDistrict(d: GameState, districtId: DistrictId): HandlerResult {
  const def = DISTRICTS[districtId];
  if (!def) return fail('No such district');
  if (d.world.districts[districtId].open) return fail(`${def.name} is already open`);
  if (d.department.level < def.openAtLevel) return fail(`${def.name} opens at department level ${def.openAtLevel}`);
  openDistrictState(d, districtId, d.department.clockHighWater);
  syncPatrolUnits(d);
  return { ok: true };
}

/** Name the unit, pick the starting district, and put the first investigation on its real review clock. */
export function foundDepartment(d: GameState, name: string, districtId: DistrictId): HandlerResult {
  const w = d.world;
  if (w.onboarding.stage === 'cold_open') return fail('Finish your first call first');
  if (w.onboarding.stage !== 'founding') return fail('The department is already founded');
  const clean = name.trim().replace(/\s+/g, ' ');
  if (clean.length < 2 || clean.length > 40) return fail('A department name is 2 to 40 characters');
  const def = DISTRICTS[districtId];
  if (!def) return fail('No such district');
  if (d.department.level < def.openAtLevel) return fail(`${def.name} opens at department level ${def.openAtLevel}`);
  const now = d.department.clockHighWater;
  d.department.name = clean;
  openDistrictState(d, districtId, now);
  // Everyone the city started with can now be known by an officer from their streets.
  for (const id of Object.keys(w.subjects)) seedTiesForSubject(d, id);
  syncPatrolUnits(d);

  // The scripted first contact: a corner hand stopped by the first patrol unit, opened as an ordinary case on
  // its ordinary one-hour clock. It is the real system, not a faster one.
  const crew = activeCrews(w, districtId)[0];
  const pool = crew ? membersOf(w, crew, 1).filter((s) => reachable(s, now)) : [];
  const subject = pool.length ? pool[Math.min(pool.length - 1, Math.floor(draw(w.seed, 'first', hourOf(now), 'founding', 0) * pool.length))] : undefined;
  w.rolledThroughHour = hourOf(now);
  if (!subject) {
    w.onboarding = { stage: 'first_return', firstShiftAt: now };
    return { ok: true };
  }
  const unit = employedPatrol(d).filter((p) => (p.districtId ?? 'pike') === districtId).map((p) => unitNumber(p.id)).sort((a, b) => a - b)[0];
  subject.known = true;
  subject.history.push({ at: now, kind: 'stopped' });
  pushEvent(w, { at: now, kind: 'contact', districtId, subjectId: subject.id, crewId: crew.id, tier: 1, unit });
  const c = openCase(d, w, { subject, tier: 1, source: 'patrol', at: now, status: 'review', unit });
  w.onboarding = { stage: 'first_shift', firstCaseId: c.id, firstShiftAt: now };
  return { ok: true };
}

/** Move named patrol staff between districts. The total never changes: people leave the home district or come
 * back to it, and the lowest ids move first. */
export function setDistrictCoverage(d: GameState, districtId: DistrictId, units: number): HandlerResult {
  const w = d.world;
  if (!DISTRICTS[districtId]) return fail('No such district');
  if (!w.districts[districtId].open) return fail(`${DISTRICTS[districtId].name} is not open yet`);
  const staff = employedPatrol(d).sort((a, b) => unitNumber(a.id) - unitNumber(b.id));
  if (!Number.isInteger(units) || units < 0) return fail('Units are a whole number');
  if (units > staff.length) return fail(`Only ${staff.length} patrol staff are employed`);
  const here = staff.filter((p) => (p.districtId ?? 'pike') === districtId);
  const delta = units - here.length;
  const place = (p: (typeof staff)[number], to: DistrictId) => {
    if (to === 'pike') delete p.districtId;
    else p.districtId = to;
  };
  if (delta > 0) {
    // Home staff first, then whoever works the district with the most units.
    const others = staff.filter((p) => (p.districtId ?? 'pike') !== districtId);
    const rank = (p: (typeof staff)[number]) => ((p.districtId ?? 'pike') === 'pike' ? 0 : 1);
    others.sort((a, b) => (districtId === 'pike' ? rank(b) - rank(a) : rank(a) - rank(b)));
    for (const p of others.slice(0, delta)) place(p, districtId);
  } else if (delta < 0) {
    if (districtId === 'pike') return fail('Assign them to the district that needs them instead');
    for (const p of [...here].reverse().slice(0, -delta)) place(p, 'pike');
  }
  syncPatrolUnits(d);
  return { ok: true };
}
