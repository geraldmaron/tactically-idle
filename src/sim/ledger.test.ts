// funding-ledger: discrete funding events are recorded with the balance either side, and nothing
// in the sim changes funding except postFunding and settle()'s hourly accrual.
import { describe, expect, it } from 'vitest';
import { createInitialState } from './department';
import { dispatch } from './game';
import { LEDGER_TUNING, postFunding } from './ledger';
import type { Command, GameState } from './types';

const T0 = Date.UTC(2026, 0, 1, 8);
const SIM_SOURCES = import.meta.glob(['/src/sim/*.ts', '!/src/sim/*.test.ts', '!/src/sim/test-fixtures.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const send = (s: GameState, cmd: Command) => dispatch(s, cmd, { now: T0 });

describe('funding ledger', () => {
  it('records a purchase with the balance before and after', () => {
    const s = createInitialState(T0);
    const funding = s.department.funding;
    const seen = s.department.ledger?.length ?? 0;
    const r = send(s, { type: 'buyItem', itemId: 'trauma_kit', qty: 2 });
    expect(r.result.ok).toBe(true);
    const entry = r.state.department.ledger!.at(-1)!;
    expect(r.state.department.ledger!.length).toBe(seen + 1);
    expect(entry).toMatchObject({ kind: 'purchase', amount: -240, before: funding, after: funding - 240 });
    expect(r.state.department.funding).toBe(funding - 240);
  });

  it('records a hire as a signing', () => {
    const s = createInitialState(T0);
    const cand = s.candidates[0];
    const r = send(s, { type: 'hire', candidateId: cand.id });
    expect(r.result.ok).toBe(true);
    expect(r.state.department.ledger!.at(-1)).toMatchObject({ kind: 'signing', amount: -cand.signingCost });
  });

  it('folds repeats of one kind and label within a clock hour, and keeps a bounded history', () => {
    const dep = createInitialState(T0).department;
    dep.ledger = [];
    postFunding(dep, -10, 'staff', 'Peer support sessions', T0);
    postFunding(dep, -10, 'staff', 'Peer support sessions', T0 + 60_000);
    expect(dep.ledger).toHaveLength(1);
    expect(dep.ledger[0]).toMatchObject({ amount: -20, seq: 2 });
    postFunding(dep, -10, 'staff', 'Peer support sessions', T0 + LEDGER_TUNING.hourMs);
    expect(dep.ledger).toHaveLength(2);
    for (let i = 0; i < LEDGER_TUNING.keep + 5; i++) postFunding(dep, 1, 'salvage', `Unit ${i}`, T0);
    expect(dep.ledger.length).toBe(LEDGER_TUNING.keep);
    expect(dep.ledger.at(-1)!.after).toBe(dep.funding);
  });

  it('ignores zero amounts', () => {
    const dep = createInitialState(T0).department;
    const n = dep.ledger?.length ?? 0;
    postFunding(dep, 0, 'payout', 'Call payout', T0);
    expect(dep.ledger?.length ?? 0).toBe(n);
  });
});

describe('only the ledger and hourly accrual write funding', () => {
  // Each file outside the ledger may write funding only where named here, with the reason.
  const ALLOWED: Record<string, { count: number; reason: string }> = {
    'ledger.ts': { count: 1, reason: 'postFunding itself' },
    'economy.ts': { count: 2, reason: 'settle() applies hourly accrual as a rate and clamps at zero' },
    'equipment-manager.ts': { count: 1, reason: 'clears sub-unit rounding residue at the reserve floor' },
  };
  it('finds no other write', () => {
    const found: Record<string, number> = {};
    for (const [path, source] of Object.entries(SIM_SOURCES)) {
      const n = (source.match(/\.funding\s*(?:[-+*/]?=)(?!=)/g) ?? []).length;
      if (n) found[path.split('/').at(-1)!] = n;
    }
    expect(found).toEqual(Object.fromEntries(Object.entries(ALLOWED).map(([f, a]) => [f, a.count])));
  });
});
