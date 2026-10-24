// SWAT proactive shifts. A shift takes a whole squad off standby into one district for 2, 4 or 8 real hours.
// It pays a grant per hour, rolls contacts at every hour boundary it covers, and adds strain to each member
// (economy.recoveryRate turns negative on the 'proactive' assignment). It stops at its end, on recall, or
// when anyone would reach 60.
import { HOUR, SHIFT, STOPPED_SHIFTS_KEPT } from '../../content/city/tuning';
import { DISTRICTS } from '../../content/city/districts';
import { ECONOMY_TUNING } from '../economy';
import { deployability } from '../officer';
import { recordShiftFact } from '../people';
import { squadDeployed } from '../squads';
import type { GameState, HandlerResult, Officer, SquadId } from '../types';
import { SQUAD_IDS } from '../types';
import { fundingScale, newId, pushEvent } from './core';
import type { DistrictId, ProactiveShift, WorldState } from './types';

const fail = (reason: string): HandlerResult => ({ ok: false, reason });
const idNum = (id: string): number => Number(id.slice(1));

export const isActiveShift = (s: ProactiveShift): boolean => s.stoppedAt === undefined;

export function activeShifts(w: WorldState): ProactiveShift[] {
  return w.shifts.filter(isActiveShift).sort((a, b) => idNum(a.id) - idNum(b.id));
}

export const shiftOfSquad = (w: WorldState, squadId: SquadId): ProactiveShift | undefined => w.shifts.find((s) => s.squadId === squadId && isActiveShift(s));

/** A shift is on the clock at time t: started, not stopped, not past its end. */
export const shiftRunningAt = (s: ProactiveShift, t: number): boolean => s.stoppedAt === undefined && s.startedAt <= t && t < s.endsAt;

/** Shifts that count at an hour boundary: started before it and still on, or stopped exactly at it. */
export function shiftCoversBoundary(s: ProactiveShift, b: number): boolean {
  if (s.startedAt >= b) return false;
  return s.stoppedAt === undefined ? s.endsAt >= b : s.stoppedAt >= b;
}

/** Officers currently on this shift (their assignment names it). */
export function shiftMembers(d: GameState, shift: ProactiveShift): Officer[] {
  return Object.values(d.officers).filter((o) => o.assignment?.kind === 'proactive' && o.assignment.shiftId === shift.id);
}

/** Mean of awareness and communication over a squad, 0..100: how many contacts open casework. */
export function squadSkill(d: Pick<GameState, 'squads' | 'officers'>, squadId: SquadId): number {
  const squad = d.squads.find((s) => s.id === squadId);
  const people = (squad?.officerIds ?? []).map((id) => d.officers[id]).filter((o): o is Officer => !!o);
  if (!people.length) return 50;
  return people.reduce((sum, o) => sum + (o.ratings.awareness + o.ratings.communication) / 2, 0) / people.length;
}

/** Hours the squad has worked in the 24 hours before `now`, counting what each shift actually ran. */
export function hoursWorkedInDay(w: WorldState, squadId: SquadId, now: number): number {
  let ms = 0;
  for (const s of w.shifts) {
    if (s.squadId !== squadId) continue;
    const from = Math.max(s.startedAt, now - 24 * HOUR);
    const to = Math.min(s.stoppedAt ?? s.endsAt, now);
    if (to > from) ms += to - from;
  }
  return ms / HOUR;
}

/** Why a shift cannot start now, or null. Shared by the command and the preview. */
export function shiftRefusal(d: GameState, squadId: SquadId, districtId: DistrictId, hours: number, now: number): string | null {
  const w = d.world;
  if (w.onboarding.stage !== 'done') return 'Proactive shifts open after your first return';
  if (!SHIFT.hours.includes(hours)) return 'A shift is 2, 4 or 8 hours';
  const squad = d.squads.find((s) => s.id === squadId);
  if (!squad || !SQUAD_IDS.includes(squadId)) return 'No such squad';
  if (!w.districts[districtId]?.open) return `${DISTRICTS[districtId]?.name ?? 'That district'} is not open yet`;
  const members = squad.officerIds.map((id) => d.officers[id]).filter((o): o is Officer => !!o);
  if (!members.length) return 'That squad has no officers';
  if (shiftOfSquad(w, squadId)) return `${squad.name} is already on a shift`;
  if (squadDeployed(d, squadId)) return `${squad.name} is on a call`;
  for (const o of members) {
    const ready = deployability(o, now);
    if (!ready.ok) return ready.reason;
    if (o.stress >= SHIFT.startBelow) return `${o.surname} is too strained for a shift`;
  }
  const used = hoursWorkedInDay(w, squadId, now);
  if (used + hours > SHIFT.maxHoursPerDay + 1e-9) {
    const left = Math.max(0, SHIFT.maxHoursPerDay - used);
    return `${squad.name} can work ${SHIFT.maxHoursPerDay} shift hours a day and has ${Math.floor(left * 10) / 10} left`;
  }
  return null;
}

export function startShift(d: GameState, squadId: SquadId, districtId: DistrictId, hours: number): HandlerResult {
  const now = d.department.clockHighWater;
  const why = shiftRefusal(d, squadId, districtId, hours, now);
  if (why) return fail(why);
  const w = d.world;
  const shift: ProactiveShift = { id: newId(w, 'p'), squadId, districtId, startedAt: now, endsAt: now + hours * HOUR, contacts: 0, caseIds: [], leadIds: [] };
  w.shifts.push(shift);
  const squad = d.squads.find((s) => s.id === squadId)!;
  for (const id of squad.officerIds) {
    const o = d.officers[id];
    if (o) o.assignment = { kind: 'proactive', shiftId: shift.id, startedAt: shift.startedAt, endsAt: shift.endsAt };
  }
  pushEvent(w, { at: now, kind: 'shift_started', districtId, squadId });
  return { ok: true };
}

/** Funding the squad's grant brings per hour. */
export const shiftGrantPerHour = (level: number): number => SHIFT.grantPerHour * fundingScale(level);

export function stopShift(d: GameState, shift: ProactiveShift, at: number, reason: NonNullable<ProactiveShift['stopReason']>): void {
  const w = d.world;
  if (shift.stoppedAt !== undefined) return;
  shift.stoppedAt = at;
  shift.stopReason = reason;
  for (const o of shiftMembers(d, shift)) o.assignment = null;
  pushEvent(w, { at, kind: 'shift_ended', districtId: shift.districtId, squadId: shift.squadId, amount: shift.contacts });
  recordShiftFact(d, shift.id);
  pruneShifts(w, at);
}

/** Keep the active shifts, the last few stopped ones, and anything from the last day (the daily cap reads it). */
export function pruneShifts(w: WorldState, at: number): void {
  const stopped = w.shifts.filter((s) => !isActiveShift(s)).sort((a, b) => (b.stoppedAt ?? 0) - (a.stoppedAt ?? 0) || idNum(b.id) - idNum(a.id));
  const keep = new Set(stopped.filter((s, i) => i < STOPPED_SHIFTS_KEPT || (s.stoppedAt ?? 0) > at - 24 * HOUR).map((s) => s.id));
  w.shifts = w.shifts.filter((s) => isActiveShift(s) || keep.has(s.id));
}

export function recallShift(d: GameState, squadId: SquadId): HandlerResult {
  const shift = shiftOfSquad(d.world, squadId);
  if (!shift) return fail('That squad is not on a shift');
  stopShift(d, shift, d.department.clockHighWater, 'recalled');
  return { ok: true };
}

/** A member has reached the line where one more hour of shift would take them to 60. */
export function strained(d: GameState, shift: ProactiveShift): boolean {
  return shiftMembers(d, shift).some((o) => o.stress >= SHIFT.stopAt - 1e-4);
}

/** When the strain stop will land if nothing else changes, on the minute grid so every way of settling the
 * same span agrees on it. null when the shift adds no strain. */
export function strainStopAt(d: GameState, shift: ProactiveShift, t: number): number | null {
  const members = shiftMembers(d, shift);
  const rate = ECONOMY_TUNING.proactiveStrainPerHour;
  if (!members.length || rate <= 0) return null;
  const worst = Math.max(...members.map((o) => o.stress));
  const crossing = t + ((SHIFT.stopAt - worst) / rate) * HOUR;
  let at = Math.ceil((crossing - 1) / SHIFT.strainGridMs) * SHIFT.strainGridMs;
  if (at <= t) at = (Math.floor(t / SHIFT.strainGridMs) + 1) * SHIFT.strainGridMs;
  return at;
}
