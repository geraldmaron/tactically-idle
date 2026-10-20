// The open shift report, for events outside a settlement (a grant or promotion when a debrief
// closes). Settlement folds its own window into the same report (economy.settle).
import type { GameState, ShiftReport } from './types';

/** The report the player has not acknowledged yet, opened empty at `at` when there is none. */
export function openReport(d: GameState, at: number): ShiftReport {
  d.report ??= { from: at, to: at, accruedHours: 0, gross: 0, wages: 0, operating: 0, restockSpend: 0, net: 0,
    completedCourses: [], recovered: [], shortages: [], capped: false, equipment: [], personnel: [] };
  return d.report;
}
