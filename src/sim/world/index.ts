// The world's entry points (docs/world-build-plan.md, "The contract"). Settlement calls `settleWorld` once per
// interval of the existing walk in economy.settle, so there is one clock and one accrual window.
//
// How an interval is settled: everything due inside (from, to] runs in time order at its own time (a shift
// ends, a case closes and pays), and at each whole hour boundary the hour just ended is rolled once, after
// that boundary's other due events. `nextWorldEventTime` offers every one of those times to the walk, so a
// single long settlement, many small ticks and a save in between all produce the same city.
import { DISTRICTS } from '../../content/city/districts';
import { HOUR } from '../../content/city/tuning';
import { ECONOMY_TUNING, ratesAt } from '../economy';
import { simNow } from '../calendar';
import type { DebriefResult, GameState, HandlerMap, OperationRun, ShiftReportWorld, WorldCommandType } from '../types';
import { closeCase } from './cases';
import { foundDepartment, openDistrict, setDistrictCoverage, syncPatrolUnits } from './commands';
import { rollHour } from './contacts';
import { hourOf, type WorldAcc } from './core';
import { seedDistrictCrews } from './population';
import { activeShifts, recallShift, startShift, stopShift } from './shifts';
import type { DistrictId, DistrictState, ProactiveShift, WorldState } from './types';
import { DISTRICT_IDS } from './types';
import { applyWorldDebrief as settleDebrief, openWarrant, reconcileLeads, respondToContact } from './warrants';

export type { WorldAcc } from './core';
export { allocationFactor, allocationRate, cityCrime, fundingScale } from './core';
export { validWorldState } from './validate';

/** A new city: Pike Street open with its crew and their people, the rest closed until the department's level
 * opens them. The first session starts in `cold_open`; nothing rolls until the department is founded. */
export function createWorld(seed: number, now: number): WorldState {
  const districts = {} as Record<DistrictId, DistrictState>;
  for (const id of DISTRICT_IDS) {
    districts[id] = { id, open: id === 'pike', crime: DISTRICTS[id].startCrime, patrolUnits: 0, openedAt: id === 'pike' ? now : null };
  }
  const w: WorldState = {
    seed: seed >>> 0,
    districts,
    crews: [],
    subjects: {},
    cases: [],
    leads: [],
    shifts: [],
    events: [],
    rolledThroughHour: hourOf(now),
    nextId: 1,
    onboarding: { stage: 'cold_open' },
  };
  seedDistrictCrews(w, 'pike', now);
  return w;
}

export function newWorldAcc(d: GameState): WorldAcc {
  const crimeBefore: WorldAcc['crimeBefore'] = {};
  for (const id of DISTRICT_IDS) if (d.world.districts[id].open) crimeBefore[id] = d.world.districts[id].crime;
  return { contacts: 0, casesOpened: 0, casesClosed: 0, awardsPaid: 0, awardFunding: 0, leads: [], crimeBefore };
}

/** The world rolls hours only once the department is founded. */
const rolling = (w: WorldState): boolean => w.onboarding.stage !== 'cold_open' && w.onboarding.stage !== 'founding';

/** Where hourly opportunities (contacts, crime drift, recruitment) stop: the player's last command plus the
 * world window, which no purchase extends. Reviews already open still close and pay beyond it. */
export const opportunityUntil = (d: Pick<GameState, 'department'>): number => d.department.lastInteractionAt + ECONOMY_TUNING.worldCapMs;

/** The next time strictly after t when something in the world is due: the next hour boundary (while hours can
 * still be rolled), a case closing, a shift ending, or a shift reaching the strain line. */
export function nextWorldEventTime(d: GameState, t: number): number | null {
  const w = d.world;
  if (!w) return null;
  let e: number | null = null;
  const consider = (x: number | null) => {
    if (x !== null && x > t && (e === null || x < e)) e = x;
  };
  if (rolling(w)) {
    const boundary = (Math.floor(t / HOUR) + 1) * HOUR;
    if (boundary <= opportunityUntil(d)) consider(boundary);
  }
  for (const c of w.cases) if (c.status === 'review') consider(c.closesAt);
  for (const s of activeShifts(w)) consider(shiftStopAt(s));
  return e;
}

/** When an active shift stops by itself: its stored strain deadline if that comes first or at its end, else its
 * end. One fixed time per shift, however the span is settled. */
const shiftStopAt = (s: ProactiveShift): number => (s.strainAt !== undefined && s.strainAt <= s.endsAt ? s.strainAt : s.endsAt);

/** Everything due at or before `t`, in time order: shift stops, then case closes. */
function settleDue(d: GameState, t: number, acc: WorldAcc): void {
  const w = d.world;
  const due: { at: number; order: number; run: () => void }[] = [];
  for (const s of activeShifts(w)) {
    const at = shiftStopAt(s);
    if (at <= t) due.push({ at, order: 0, run: () => stopShift(d, s, at, at === s.strainAt && s.strainAt <= s.endsAt ? 'strain' : 'ended') });
  }
  for (const c of w.cases) if (c.status === 'review' && c.closesAt !== null && c.closesAt <= t) due.push({ at: c.closesAt, order: 1, run: () => closeCase(d, w, c, acc) });
  due.sort((a, b) => a.at - b.at || a.order - b.order);
  for (const item of due) item.run();
}

/** Advance the world over [from, to]. economy.settle calls this once per walk interval, after the other
 * due events at `to`. Hourly rolls run for each hour boundary in (from, to] that is at or before
 * `opportunityUntil` (lastInteractionAt + worldCapMs, never extended by a purchase); due case closes and
 * shift ends settle at their own times regardless (see the determinism contract in ./types.ts). */
export function settleWorld(d: GameState, from: number, to: number, opportunityLimit: number, acc: WorldAcc): void {
  const w = d.world;
  if (!w || to <= from) return;
  if (rolling(w)) {
    for (let b = (Math.floor(from / HOUR) + 1) * HOUR; b <= to && b <= opportunityLimit; b += HOUR) {
      settleDue(d, b, acc);
      const h = b / HOUR - 1;
      if (h > w.rolledThroughHour) {
        rollHour(d, b, acc);
        w.rolledThroughHour = h;
      }
    }
  }
  settleDue(d, to, acc);
  reconcileLeads(d);
  syncPatrolUnits(d);
}

/** Net per hour a permanent commitment is checked against: allocation at its floor, patrol unboosted, no
 * case awards or fees (docs/world-redesign.md, "Earnings"). Roster and patrol quotes use it. */
export function sustainableNetRate(d: GameState): number {
  return ratesAt(d, simNow(d), false).net;
}

export function worldReport(d: GameState, acc: WorldAcc): ShiftReportWorld | undefined {
  const crime: ShiftReportWorld['crime'] = {};
  for (const [id, before] of Object.entries(acc.crimeBefore) as [DistrictId, number][]) crime[id] = [before, d.world.districts[id].crime];
  const any = acc.contacts || acc.casesOpened || acc.casesClosed || acc.leads.length;
  return any ? { contacts: acc.contacts, casesOpened: acc.casesOpened, casesClosed: acc.casesClosed, awardsPaid: acc.awardsPaid, awardFunding: acc.awardFunding, leads: acc.leads, crime } : undefined;
}

/** After a settlement that made a shift report: the first return is the report the player comes back to once
 * the first investigation has paid. Proactive shifts open from here. */
export function finishFirstReturn(d: GameState, from: number, to: number): void {
  const w = d.world;
  if (w?.onboarding.stage === 'first_return' && to - from >= ECONOMY_TUNING.reportMinMs) w.onboarding = { ...w.onboarding, stage: 'done' };
}

/** Called by operation.closeDebrief after the career loop: serve the lead, settle the investigation. */
export function applyWorldDebrief(d: GameState, run: OperationRun, result: DebriefResult): void {
  settleDebrief(d, run, result);
}

export { foundDepartment, openDistrict, setDistrictCoverage };

export const WORLD_HANDLERS: HandlerMap<WorldCommandType> = {
  foundDepartment: (d, c) => foundDepartment(d, c.name, c.districtId),
  setDistrictCoverage: (d, c) => setDistrictCoverage(d, c.districtId, c.units),
  openDistrict: (d, c) => openDistrict(d, c.districtId),
  startProactiveShift: (d, c) => startShift(d, c.squadId, c.districtId, c.hours),
  recallProactiveShift: (d, c) => recallShift(d, c.squadId),
  openWarrant: (d, c) => openWarrant(d, c.leadId),
  respondToContact: (d, c) => respondToContact(d, c.leadId),
  syncEntitlements: (d, c) => {
    d.department.entitlements = { charter: !!c.entitlements.charter, nightWatch: !!c.entitlements.nightWatch };
    return { ok: true };
  },
};
