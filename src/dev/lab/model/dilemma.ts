// The choices at one moment side by side on the columns the engine measures (spec 3.2 "This moment",
// 9.3 dilemma rules): odds of going well and badly, expected minutes, what each unlocks, who pays on a
// bad result and where it leads, what it closes; flagged when another choice beats it on every
// column, when the odds are flat, and when a forceful choice saves too much time over a patient one.
// The call-design dominance grid counts only visible costs, so a beaten flag carries both choices'
// summaries and bad-result previews: the visible cost decides whether the beaten choice stays.
import { WEIGHTS } from '../../../gen/incident/trees-v13/balance';
import { siteKey } from '../../../gen/incident/trees-v13/dependencies';
import type { DependencyIndex, Site, StateKey } from '../../../gen/incident/trees-v13/dependencies';
import type { OperationRun } from '../../../sim/types';
import { flatness } from './call';
import type { ChoiceXray, RouteTarget } from './xray';

export type DilemmaFlag = { kind: 'beaten'; by: string; columns: string[] } | { kind: 'flat'; with: string[] } | { kind: 'all-high' }
  | { kind: 'e2'; restraint: string; ratio: number };
export interface DilemmaRow { actionId: string; favorable: number; adverse: number; minutes: number; writes: StateKey[]; closes: Site[];
  adverseHarm: string[]; adverseTo: RouteTarget | null; costSeen: { summary: string; adversePreview: string }; flags: DilemmaFlag[] }

/** Keys a choice can unlock for later text: marks, people brought out, facts settled, promises. Harm,
 * meters and the score scalars are costs or mixed, never an unlock. */
const UNLOCKS = /^(mark|safe|out|fact|promise):/;
const CLOSES = new Set<Site['field']>(['onlyIf', 'promptIf.when']);
const EPS = 1e-9;
/** A forceful choice that saves more than this share of a patient one's minutes is flagged (E2). */
export const E2_RATIO = 0.5;

/** Run class order, worst first (trees-v13/balance.ts WEIGHTS): a higher index is a better ending. */
const rank = (to: RouteTarget | null): number | null => to?.kind === 'ending' && to.weight ? WEIGHTS.indexOf(to.weight) : null;
const sameTarget = (a: RouteTarget | null, b: RouteTarget | null) =>
  !a || !b ? a === b : a.kind === 'node' ? b.kind === 'node' && a.node === b.node : b.kind === 'ending' && a.ending === b.ending;

/** Compare where two bad results lead: 1 when `a` is better, 0 when no worse and no better, -1 when
 * worse, null when the engine gives no way to rank them (a node against an ending, or endings whose
 * run class isn't known yet). */
export function compareRoutes(a: RouteTarget | null, b: RouteTarget | null): 1 | 0 | -1 | null {
  if (sameTarget(a, b)) return 0;
  if (a?.kind === 'node' && b?.kind === 'node') return 0;
  const ra = rank(a), rb = rank(b);
  if (ra === null || rb === null) return null;
  return ra > rb ? 1 : ra < rb ? -1 : 0;
}

const subset = <T>(a: readonly T[], b: readonly T[]) => a.every(entry => b.includes(entry));

function columnsBeating(by: DilemmaRow, row: DilemmaRow): string[] | null {
  if (by.favorable < row.favorable - EPS || by.adverse > row.adverse + EPS || by.minutes > row.minutes) return null;
  if (!subset(row.writes, by.writes) || !subset(by.adverseHarm, row.adverseHarm)) return null;
  const route = compareRoutes(by.adverseTo, row.adverseTo);
  if (route === null || route < 0) return null;
  const strict: string[] = [];
  if (by.favorable > row.favorable + EPS) strict.push('odds of going well');
  if (by.adverse < row.adverse - EPS) strict.push('odds of going badly');
  if (by.minutes < row.minutes) strict.push('minutes');
  if (by.writes.length > row.writes.length) strict.push('what it unlocks');
  if (by.adverseHarm.length < row.adverseHarm.length) strict.push('who pays on a bad result');
  if (route > 0) strict.push('where a bad result leads');
  return strict.length ? strict : null;
}

/** The dilemma rows for the X-ray rows of one moment, in the same order, with their flags. Locked
 * choices get their columns but are never compared: the player can't take them here. */
export function dilemma(rows: readonly ChoiceXray[], deps: DependencyIndex | null, run: OperationRun): DilemmaRow[] {
  const openPromise = Object.values(run.commitments ?? {}).some(entry => entry.status === 'open');
  const out: DilemmaRow[] = rows.map(x => {
    const written = [...new Set((['favorable', 'mixed', 'adverse'] as const).flatMap(band => x.bands[band].writes))];
    // What it closes: later choices and prompt lines that need a key this choice sets to stay unset.
    // (Outcome `when` reads are left out: almost every later addendum reads "not yet out", which says
    // nothing about the choice.)
    const seen = new Set<string>();
    const closes: Site[] = deps ? written.flatMap(key => deps.keys.get(key)?.readers.filter(site => site.negated && CLOSES.has(site.field)
      && !seen.has(siteKey(site)) && !!seen.add(siteKey(site))) ?? []) : [];
    if (x.entry && openPromise) closes.push({ field: 'engine', conditional: 'breaks open promises' });
    const adverse = x.bands.adverse;
    // A drawn result that decides a bad result's route: the worst of them counts.
    const adverseTo = adverse.to ?? worstResult(adverse.drawn.flatMap(entry => entry.results.map(result => result.to)));
    return {
      actionId: x.actionId, favorable: x.view.likelihood.favorable, adverse: x.view.likelihood.adverse, minutes: x.view.timeCost,
      writes: written.filter(key => UNLOCKS.test(key)).sort(), closes, adverseHarm: [...new Set(adverse.harm)].sort(), adverseTo,
      costSeen: { summary: x.view.summary, adversePreview: x.view.outcomePreview.adverse }, flags: [],
    };
  });
  const eligible = rows.flatMap((x, i) => x.view.eligible ? [i] : []);

  for (const i of eligible) for (const j of eligible) {
    if (i === j || out[i].flags.some(flag => flag.kind === 'beaten')) continue;
    const columns = columnsBeating(out[j], out[i]);
    if (columns) out[i].flags.push({ kind: 'beaten', by: out[j].actionId, columns });
  }

  const flat = flatness(eligible.map(i => rows[i].view));
  for (const i of eligible) {
    const id = rows[i].actionId;
    const partners = flat.pairs.flatMap(pair => pair.a === id ? [pair.b] : pair.b === id ? [pair.a] : []);
    if (partners.length) out[i].flags.push({ kind: 'flat', with: partners });
    if (flat.allHigh) out[i].flags.push({ kind: 'all-high' });
  }

  for (const i of eligible) {
    if (!rows[i].entry && !rows[i].force) continue;
    let best: { restraint: string; ratio: number } | null = null;
    for (const j of eligible) {
      if (rows[j].entry || rows[j].force || out[j].minutes <= 0) continue;
      const ratio = out[i].minutes / out[j].minutes;
      if (ratio < E2_RATIO && (!best || ratio < best.ratio)) best = { restraint: rows[j].actionId, ratio: Math.round(ratio * 100) / 100 };
    }
    if (best) out[i].flags.push({ kind: 'e2', ...best });
  }
  return out;
}

function worstResult(targets: readonly (RouteTarget | null)[]): RouteTarget | null {
  const known = targets.filter((to): to is RouteTarget => !!to);
  if (!known.length) return null;
  return [...known].sort((a, b) => (rank(a) ?? WEIGHTS.length) - (rank(b) ?? WEIGHTS.length))[0];
}
