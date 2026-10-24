// The world's entry points (docs/world-build-plan.md, "The contract"). Wave 0 lands these as stubs so the
// economy, operations and saves call them from day one; the world-engine lane fills them in behind the same
// signatures. Settlement calls `settleWorld` once per interval of the existing walk in economy.settle, so
// there is one clock and one accrual window.
import type { DebriefResult, GameState, HandlerMap, HandlerResult, Id, OperationRun, ShiftReportWorld, WorldCommandType } from '../types';
import type { DistrictId, DistrictState, WorldState } from './types';
import { DISTRICT_IDS } from './types';

/** What one settlement accumulates for the shift report. */
export interface WorldAcc {
  contacts: number;
  casesOpened: number;
  casesClosed: number;
  awards: number;
  leads: Id[];
  crimeBefore: Partial<Record<DistrictId, number>>;
}

const fail = (reason: string): HandlerResult => ({ ok: false, reason });

/** A new city: Pike Street open, the rest closed. The world-engine lane seeds crews and subjects. */
export function createWorld(seed: number, now: number): WorldState {
  const districts = {} as Record<DistrictId, DistrictState>;
  for (const id of DISTRICT_IDS) districts[id] = { id, open: id === 'pike', crime: id === 'pike' ? 62 : 50, patrolUnits: 0, openedAt: id === 'pike' ? now : null };
  return { seed: seed >>> 0, districts, crews: [], subjects: {}, cases: [], leads: [], shifts: [], events: [], rolledThroughHour: Math.floor(now / 3_600_000), nextId: 1, firstContactDone: false };
}

export function newWorldAcc(d: GameState): WorldAcc {
  const crimeBefore: WorldAcc['crimeBefore'] = {};
  for (const id of DISTRICT_IDS) if (d.world.districts[id].open) crimeBefore[id] = d.world.districts[id].crime;
  return { contacts: 0, casesOpened: 0, casesClosed: 0, awards: 0, leads: [], crimeBefore };
}

/** The next time strictly after t when something in the world is due (a case closes, a shift ends). */
export function nextWorldEventTime(_d: GameState, _t: number): number | null {
  return null;
}

/** Advance the world over [from, to). Hourly rolls run only for hours that end before `accrueUntil`
 * (the same 72-hour window as funding); due cases and shifts settle at their own times regardless. */
export function settleWorld(_d: GameState, _from: number, _to: number, _accrueUntil: number, _acc: WorldAcc): void {}

export function worldReport(d: GameState, acc: WorldAcc): ShiftReportWorld | undefined {
  const crime: ShiftReportWorld['crime'] = {};
  for (const [id, before] of Object.entries(acc.crimeBefore) as [DistrictId, number][]) crime[id] = [before, d.world.districts[id].crime];
  const any = acc.contacts || acc.casesOpened || acc.casesClosed || acc.leads.length;
  return any ? { contacts: acc.contacts, casesOpened: acc.casesOpened, casesClosed: acc.casesClosed, awards: acc.awards, leads: acc.leads, crime } : undefined;
}

/** Called by operation.closeDebrief after the career loop: serve the lead, open the call's case. */
export function applyWorldDebrief(_d: GameState, _run: OperationRun, _result: DebriefResult): void {}

export const WORLD_HANDLERS: HandlerMap<WorldCommandType> = {
  setDistrictCoverage: () => fail('Not built yet'),
  openDistrict: () => fail('Not built yet'),
  startProactiveShift: () => fail('Not built yet'),
  recallProactiveShift: () => fail('Not built yet'),
  openWarrant: () => fail('Not built yet'),
  respondToContact: () => fail('Not built yet'),
  syncEntitlements: (d, c) => {
    d.department.entitlements = { charter: !!c.entitlements.charter, nightWatch: !!c.entitlements.nightWatch };
    return { ok: true };
  },
};
