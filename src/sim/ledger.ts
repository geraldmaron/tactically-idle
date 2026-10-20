// The department's books, event by event. Every discrete change to funding (a payout, a signing, a
// purchase, a fee) goes through postFunding so the player can watch money move and see why.
// Hourly accrual is not an event: settle() applies it as a rate, and the shift report and the
// top bar's rate show it. src/sim/ledger.test.ts fails on any other write to funding.
import type { Department, LedgerEntry, LedgerKind } from './types';

export const LEDGER_TUNING = { keep: 60, hourMs: 3_600_000 } as const;

/** Change funding by `amount` and record it. A repeat of the same kind and label in the same clock
 * hour folds into the previous entry only when nothing else moved the balance in between, so every
 * entry's before + amount = after; `latest` keeps the newest posting so a viewer announces only it. */
export function postFunding(dep: Department, amount: number, kind: LedgerKind, label: string, at: number): void {
  if (!Number.isFinite(amount) || amount === 0) return;
  const before = dep.funding;
  dep.funding = before + amount;
  const ledger = (dep.ledger ??= []);
  const last = ledger.at(-1);
  if (last && last.kind === kind && last.label === label && last.after === before && Math.floor(last.at / LEDGER_TUNING.hourMs) === Math.floor(at / LEDGER_TUNING.hourMs)) {
    last.amount += amount;
    last.latest = amount;
    last.after = dep.funding;
    last.at = Math.max(last.at, at);
    // Re-sequence so a viewer diffing by seq sees the folded entry as new.
    last.seq = nextSeq(ledger);
    return;
  }
  ledger.push({ seq: nextSeq(ledger), at, amount, before, after: dep.funding, kind, label });
  if (ledger.length > LEDGER_TUNING.keep) ledger.splice(0, ledger.length - LEDGER_TUNING.keep);
}

function nextSeq(ledger: LedgerEntry[]): number {
  return ledger.reduce((max, e) => Math.max(max, e.seq), 0) + 1;
}
