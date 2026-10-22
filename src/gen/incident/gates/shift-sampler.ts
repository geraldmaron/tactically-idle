// Shift sampler (hostage review N21): how many crisis calls a player meets per shift, counted on the
// board's own schedule (sim/incidents.ts applyIncidentsDue), so the writing review's crisis-frequency
// target ("at most one per shift, never two") can be measured instead of guessed.
//
// A shift is one game day (CALENDAR.gameDayMs, one real hour). The game has no fixed shift: a shift
// report covers one settlement, at least 15 minutes. One game day stands in as a proxy for a sitting.
//
// What a player meets depends on what they take: the board holds one card per kind of call, and a
// card lives 6 to 12 game days, so a call nobody takes blocks the next of its kind, and the draw
// avoids kinds already on the board. Three dispatch policies are reported: take every call as it
// arrives, take only the crisis calls (the other cards stay and push later draws toward crises,
// which brought the most crisis calls of the three in the measured runs), and take nothing. None is proven a bound on
// what a selective player can meet. Debriefs are never written, so the draw's "recently played"
// weighting is out of play. Report only: nothing here fails a build.
import { createInitialState } from '../../../sim/department';
import { CALENDAR } from '../../../sim/calendar';
import { applyIncidentsDue, nextIncidentAt, takeIncident } from '../../../sim/incidents';
import type { IncidentType } from '../../../sim/scenario-types';
import type { GameState } from '../../../sim/types';

/** Crisis calls: a person may harm themselves. No field marks one, so this is a list of call types,
 * the ones that carry the content note and 988 line (backlog crisis-content-note). */
export const CRISIS_TYPES: ReadonlySet<IncidentType> = new Set<IncidentType>(['hostage_crisis', 'barricaded']);
/** The writing review's house target: at most this many crisis calls in one shift. */
export const CRISIS_CAP = 1;

export type Player = 'takes-every-call' | 'takes-crisis-calls' | 'takes-nothing';
/** A new department dispatches only what its starting roster can answer; `every-type` grants the
 * certs and the firearm that open the rest (content/unlocks.ts). */
export type Department = 'new' | 'every-type';

export interface ShiftSample {
  shifts: number; player: Player; department: Department;
  /** Calls that arrived on the board in each shift, by type. */
  calls: Record<IncidentType, number>[];
  /** Crisis calls per shift. */
  crisis: number[];
  /** How many shifts brought 0, 1, 2 … crisis calls. */
  histogram: Record<number, number>;
  /** Shifts over CRISIS_CAP. */
  overCap: number;
}

function department(seed: number, start: number, kind: Department): GameState {
  let state = createInitialState(start, seed);
  if (kind === 'every-type') {
    const first = state.squads.find(squad => squad.id === 'A')?.officerIds[0];
    if (first !== undefined) state.officers[first].certs = [...new Set([...state.officers[first].certs, 'vehicle_operations', 'entry_team'] as const)];
  }
  return state;
}

/** Plays `shifts` game days of the board from a new campaign and counts the calls each one brings. */
export function sampleShifts(opts: { shifts: number; seed?: number; player?: Player; department?: Department; isCrisis?: (type: IncidentType) => boolean }): ShiftSample {
  const { shifts, seed = 719, player = 'takes-every-call', department: kind = 'new', isCrisis = (type: IncidentType) => CRISIS_TYPES.has(type) } = opts;
  const start = Date.UTC(2026, 0, 1);
  const state = department(seed, start, kind);
  // The opening board is what the player finds, not what a shift brings: clear it.
  for (const card of [...state.incidents]) takeIncident(state, card.id);
  const calls: Record<IncidentType, number>[] = [];
  let t = start;
  for (let shift = 0; shift < shifts; shift++) {
    const end = t + CALENDAR.gameDayMs;
    const counted: Partial<Record<IncidentType, number>> = {};
    const seen = new Set(state.incidents.map(card => card.id));
    for (let at = nextIncidentAt(state); at !== null && at <= end; at = nextIncidentAt(state)) {
      applyIncidentsDue(state, t, at);
      t = at;
      for (const card of state.incidents) if (!seen.has(card.id)) { seen.add(card.id); const type = card.type as IncidentType; counted[type] = (counted[type] ?? 0) + 1; }
      if (player !== 'takes-nothing') for (const card of [...state.incidents]) if (player === 'takes-every-call' || isCrisis(card.type as IncidentType)) takeIncident(state, card.id);
    }
    applyIncidentsDue(state, t, end);
    t = end;
    calls.push(counted as Record<IncidentType, number>);
  }
  const crisis = calls.map(byType => Object.entries(byType).reduce((n, [type, k]) => n + (isCrisis(type as IncidentType) ? k : 0), 0));
  const histogram: Record<number, number> = {};
  for (const n of crisis) histogram[n] = (histogram[n] ?? 0) + 1;
  return { shifts, player, department: kind, calls, crisis, histogram, overCap: crisis.filter(n => n > CRISIS_CAP).length };
}

/** One line per sample: "takes every call, new department: 0 crisis in 12 shifts, 1 in 40 … (over cap 8 of 100)". */
export function shiftReport(sample: ShiftSample): string {
  const rows = Object.entries(sample.histogram).sort(([a], [b]) => Number(a) - Number(b)).map(([n, shifts]) => `${n} crisis in ${shifts}`);
  const total = sample.calls.reduce((n, byType) => n + Object.values(byType).reduce((a, b) => a + b, 0), 0);
  return `${sample.player.replace(/-/g, ' ')}, ${sample.department === 'new' ? 'new department' : 'every type unlocked'}: ${rows.join(', ')} `
    + `(over the cap of ${CRISIS_CAP} in ${sample.overCap} of ${sample.shifts} shifts; ${(total / sample.shifts).toFixed(2)} calls a shift)`;
}
