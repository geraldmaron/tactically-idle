// The dilemma rules (spec 9.3) on fixtures: beaten needs every engine column no worse and one better,
// flat and all-high follow the lab's flatness rule, E2 flags a forceful choice that saves more than
// half the minutes of a patient one, closes lists the readers a write negates. Then the same rows on
// a real call, which must match the X-ray row for row.
import { describe, expect, it } from 'vitest';
import type { Weight } from '../../../gen/incident/trees-v13/balance';
import { dependencyIndex } from '../../../gen/incident/trees-v13/dependencies';
import type { DependencyIndex, Site, StateKey } from '../../../gen/incident/trees-v13/dependencies';
import type { ActionView, OperationRun, OutcomeBand } from '../../../sim/types';
import { parseLabUrl } from '../url';
import { compareRoutes, dilemma } from './dilemma';
import { currentFrame, openSession } from './session';
import { xrayChoices } from './xray';
import type { BandRoute, ChoiceXray, RouteTarget } from './xray';

const node = (id: string): RouteTarget => ({ kind: 'node', node: id, title: id });
const ending = (id: string, weight?: Weight): RouteTarget => ({ kind: 'ending', ending: id, title: id, ...(weight ? { weight } : {}) });

interface Spec { id: string; fav: number; adv: number; minutes: number; writes?: StateKey[]; adverseHarm?: string[]; adverseTo?: RouteTarget | null;
  eligible?: boolean; entry?: boolean; force?: boolean }

function band(b: OutcomeBand, p: number, extra: Partial<BandRoute> = {}): BandRoute {
  return { band: b, p, possible: true, effects: [], to: node('next'), drawn: [], harm: [], maybeHarm: [], writes: [], mayHarm: false, ...extra };
}

function row(spec: Spec): ChoiceXray {
  const mixed = Math.max(0, 1 - spec.fav - spec.adv);
  const view = { id: spec.id, title: spec.id, summary: `${spec.id} summary`, eligible: spec.eligible ?? true, reason: spec.eligible === false ? 'Locked' : null,
    likelihood: { favorable: spec.fav, mixed, adverse: spec.adv }, timeCost: spec.minutes,
    outcomePreview: { favorable: 'well', mixed: 'mixed', adverse: `${spec.id} bad preview` } } as unknown as ActionView;
  return {
    actionId: spec.id, node: 'n', choice: spec.id, view, shown: 'shown', score: 0, difficulty: 0, margin: 0, groups: [], readers: [], req: null,
    title: spec.id, entry: spec.entry ?? false, force: spec.force ?? false,
    bands: {
      favorable: band('favorable', spec.fav, { writes: spec.writes ?? [] }),
      mixed: band('mixed', mixed),
      adverse: band('adverse', spec.adv, { harm: spec.adverseHarm ?? [], to: spec.adverseTo === undefined ? node('next') : spec.adverseTo }),
    },
  };
}

const RUN = { commitments: {} } as unknown as OperationRun;
const flagsOf = (rows: ReturnType<typeof dilemma>, id: string) => rows.find(r => r.actionId === id)!.flags;

describe('beaten', () => {
  it('flags a choice another beats on every column, naming the strict ones', () => {
    const rows = dilemma([
      row({ id: 'a', fav: 0.6, adv: 0.1, minutes: 5, writes: ['mark:x', 'mark:y'] }),
      row({ id: 'b', fav: 0.5, adv: 0.1, minutes: 8, writes: ['mark:x'] }),
    ], null, RUN);
    expect(flagsOf(rows, 'a')).toEqual([]);
    expect(flagsOf(rows, 'b')).toEqual([{ kind: 'beaten', by: 'a', columns: ['odds of going well', 'minutes', 'what it unlocks'] }]);
  });

  it('does not flag when any one column is worse, or when nothing is strictly better', () => {
    const slower = dilemma([row({ id: 'a', fav: 0.6, adv: 0.1, minutes: 9 }), row({ id: 'b', fav: 0.5, adv: 0.1, minutes: 8 })], null, RUN);
    expect(flagsOf(slower, 'b').some(f => f.kind === 'beaten')).toBe(false);
    const harmier = dilemma([row({ id: 'a', fav: 0.6, adv: 0.1, minutes: 5, adverseHarm: ['Ruth hurt'] }), row({ id: 'b', fav: 0.5, adv: 0.1, minutes: 8 })], null, RUN);
    expect(flagsOf(harmier, 'b').some(f => f.kind === 'beaten')).toBe(false);
    const twins = dilemma([row({ id: 'a', fav: 0.5, adv: 0.1, minutes: 8 }), row({ id: 'b', fav: 0.5, adv: 0.1, minutes: 8 })], null, RUN);
    expect(twins.every(r => !r.flags.some(f => f.kind === 'beaten'))).toBe(true);
  });

  it('ranks bad-result endings by run class, and never compares a node with an ending', () => {
    expect(compareRoutes(ending('e1', 'clean'), ending('e2', 'death'))).toBe(1);
    expect(compareRoutes(ending('e1', 'hurt'), ending('e2', 'costly'))).toBe(-1);
    expect(compareRoutes(node('a'), node('b'))).toBe(0);
    expect(compareRoutes(node('a'), ending('e'))).toBeNull();
    expect(compareRoutes(ending('e1'), ending('e2', 'clean'))).toBeNull();
    const worseRoute = dilemma([
      row({ id: 'a', fav: 0.6, adv: 0.1, minutes: 5, adverseTo: ending('dead', 'death') }),
      row({ id: 'b', fav: 0.5, adv: 0.1, minutes: 8, adverseTo: ending('fine', 'clean') }),
    ], null, RUN);
    expect(flagsOf(worseRoute, 'b').some(f => f.kind === 'beaten')).toBe(false);
  });

  it('never compares a locked choice', () => {
    const rows = dilemma([row({ id: 'a', fav: 0.9, adv: 0.04, minutes: 1, writes: ['mark:x'] }), row({ id: 'b', fav: 0.5, adv: 0.1, minutes: 8, eligible: false })], null, RUN);
    expect(flagsOf(rows, 'b')).toEqual([]);
  });

  it('keeps the visible cost of both choices for the reader', () => {
    const rows = dilemma([row({ id: 'a', fav: 0.6, adv: 0.1, minutes: 5 })], null, RUN);
    expect(rows[0].costSeen).toEqual({ summary: 'a summary', adversePreview: 'a bad preview' });
  });
});

describe('flat and all-high', () => {
  it('flags pairs within 5 points of each other', () => {
    const rows = dilemma([row({ id: 'a', fav: 0.61, adv: 0.1, minutes: 5 }), row({ id: 'b', fav: 0.58, adv: 0.12, minutes: 9 }), row({ id: 'c', fav: 0.3, adv: 0.3, minutes: 4 })], null, RUN);
    expect(flagsOf(rows, 'a')).toContainEqual({ kind: 'flat', with: ['b'] });
    expect(flagsOf(rows, 'b')).toContainEqual({ kind: 'flat', with: ['a'] });
    expect(flagsOf(rows, 'c').some(f => f.kind === 'flat')).toBe(false);
  });

  it('flags every choice when all are at 90% or more', () => {
    const rows = dilemma([row({ id: 'a', fav: 0.95, adv: 0.04, minutes: 5 }), row({ id: 'b', fav: 0.91, adv: 0.04, minutes: 3 })], null, RUN);
    expect(rows.every(r => r.flags.some(f => f.kind === 'all-high'))).toBe(true);
  });
});

describe('E2', () => {
  it('flags an entry or force choice that takes under half a patient choice\'s minutes', () => {
    const rows = dilemma([
      row({ id: 'entry', fav: 0.5, adv: 0.2, minutes: 4, entry: true }),
      row({ id: 'talk', fav: 0.4, adv: 0.1, minutes: 12 }),
      row({ id: 'wait', fav: 0.3, adv: 0.1, minutes: 6 }),
    ], null, RUN);
    expect(flagsOf(rows, 'entry')).toContainEqual({ kind: 'e2', restraint: 'talk', ratio: 0.33 });
    expect(flagsOf(rows, 'talk').some(f => f.kind === 'e2')).toBe(false);
  });

  it('leaves a forceful choice that is not that much faster alone', () => {
    const rows = dilemma([row({ id: 'force', fav: 0.5, adv: 0.2, minutes: 7, force: true }), row({ id: 'talk', fav: 0.4, adv: 0.1, minutes: 12 })], null, RUN);
    expect(flagsOf(rows, 'force').some(f => f.kind === 'e2')).toBe(false);
  });
});

describe('closes', () => {
  const site = (field: Site['field'], negated: boolean, choice: string): Site => ({ node: 'later', choice, field, negated });
  const deps = { keys: new Map([['mark:x', { key: 'mark:x', label: 'X', writers: [], readers: [site('onlyIf', true, 'closed'), site('onlyIf', false, 'opened'), site('promptIf.when', true, 'p')] }]]) } as unknown as DependencyIndex;

  it('lists the later choices and prompt lines a write closes, never the ones it opens', () => {
    const rows = dilemma([row({ id: 'a', fav: 0.5, adv: 0.1, minutes: 5, writes: ['mark:x'] })], deps, RUN);
    expect(rows[0].closes.map(s => s.choice)).toEqual(['closed', 'p']);
  });

  it('says an entry breaks the promises command made', () => {
    const run = { commitments: { p1: { personId: 'taker', kind: 'promise', madeAt: 0, revision: 1, status: 'open' } } } as unknown as OperationRun;
    const rows = dilemma([row({ id: 'a', fav: 0.5, adv: 0.1, minutes: 5, entry: true })], null, run);
    expect(rows[0].closes).toContainEqual({ field: 'engine', conditional: 'breaks open promises' });
  });
});

describe('dilemma on a real call', () => {
  it('gives one row per X-ray row at hostage offer, in the same order, with engine numbers', () => {
    const opened = openSession(parseLabUrl('?type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1').url, null);
    if (!('frames' in opened)) throw new Error(opened.message);
    const frame = currentFrame(opened);
    const deps = dependencyIndex(opened.template);
    const xrays = xrayChoices(opened, frame, deps);
    const rows = dilemma(xrays, deps, frame.state.activeRun!);
    expect(rows.map(r => r.actionId)).toEqual(xrays.map(x => x.actionId));
    rows.forEach((r, i) => {
      expect(r.favorable).toBe(xrays[i].view.likelihood.favorable);
      expect(r.minutes).toBe(xrays[i].view.timeCost);
      expect(r.writes.every(key => /^(mark|safe|out|fact|promise):/.test(key))).toBe(true);
    });
  });
});
