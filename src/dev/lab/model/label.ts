// Every number in the lab says what it is (spec section 5). probText turns a probability and its
// provenance into the visible value, the provenance pill and the plain-text form used in tooltips,
// copies and exports: `<value> · <scope> · <who> · <style> · <method>`, for example
// `≈ 41% ±5 · this call · random style · 400 runs` or `61% · now · squad A (719) · engine`.
import type { GateMetric, Policy, Weight } from '../../../gen/incident/trees-v13/balance';
import { COUNT_BELOW, WIDE_INTERVAL } from './stats';

/** Engine: one exact engine state. Exact: closed form from engine values (`=`). Sim: worker runs (`≈`). */
export type Face = 'engine' | 'exact' | 'sim';
export interface Provenance {
  face: Face;
  scope: 'now' | 'at entry' | `at step ${number}` | 'this path' | 'this call' | 'from this step' | 'this type' | 'CI gate';
  /** Whose odds or picks: "squad A (719)", "your squad (from game)", "your picks", "day-one squads vary per call". */
  who?: string;
  style?: Policy;
  runs?: number;
  /** Computed under an unsaved tuning patch. */
  pending?: boolean;
}

const STYLE_LABEL: Record<Policy, string> = { random: 'random style', best_odds: 'best odds', patient: 'patient', fast: 'fast' };
/** What each style picks (trees-v13/balance.ts `pick`), for tooltips. Styles are never "the player". */
export const STYLE_HELP: Record<Policy, string> = {
  random: 'an even pick among eligible choices',
  best_odds: 'always the eligible choice most likely to go well',
  patient: 'always the slowest eligible choice',
  fast: 'always the quickest eligible choice',
};
const WEIGHT_LABEL: Record<Weight, string> = { clean: 'clean', costly: 'costly', unresolved: 'unresolved', hurt: 'hurt', death: 'death' };
const METRIC_LABEL: Record<GateMetric, string> = { clean: 'clean', bad: 'unresolved, hurt or dead', harm: 'hurt or dead', death: 'death', officerHurt: 'officer hurt' };

export const styleLabel = (p: Policy): string => STYLE_LABEL[p];
export const weightLabel = (w: Weight): string => WEIGHT_LABEL[w];
export const metricLabel = (m: GateMetric): string => METRIC_LABEL[m];

/** A whole percent that never rounds a possible result to 0% or a possible failure to 100%. */
export function percent(p: number): string {
  if (p > 0 && p < 0.005) return '<1%';
  if (p < 1 && p > 0.995) return '>99%';
  return `${Math.round(p * 100)}%`;
}

/** "1 in 6" for an exact chance, the way the path rail reads it. */
export function oneIn(p: number): string {
  if (p <= 0) return 'never';
  if (p >= 1) return 'always';
  return `1 in ${Math.round(1 / p)}`;
}

/**
 * The value, its provenance pill and the plain form of a probability.
 * `ci` is the interval for simulated shares; `k` the count behind it, shown instead of a percentage
 * below COUNT_BELOW runs. A simulated number with an interval wider than WIDE_INTERVAL is muted.
 */
export function probText(p: number, prov: Provenance, ci?: [number, number], k?: number): { value: string; pill: string[]; plain: string; muted: boolean } {
  const wide = !!ci && ci[1] - ci[0] > WIDE_INTERVAL;
  const counted = prov.face === 'sim' && k !== undefined && prov.runs !== undefined && prov.runs < COUNT_BELOW;
  let value: string;
  if (counted) value = `${k} of ${prov.runs} runs`;
  else if (prov.face === 'engine') value = percent(p);
  else if (prov.face === 'exact') value = `= ${percent(p)}`;
  else value = `≈ ${percent(p)}${ci ? ` ±${Math.max(1, Math.round(((ci[1] - ci[0]) / 2) * 100))}` : ''}`;
  const pill: string[] = [prov.scope];
  if (prov.who) pill.push(prov.who);
  if (prov.style) pill.push(styleLabel(prov.style));
  if (prov.face === 'sim') { if (prov.runs !== undefined && !counted) pill.push(`${prov.runs.toLocaleString('en-US')} runs`); }
  else pill.push(prov.face);
  if (wide) pill.push('few runs');
  if (prov.pending) pill.push('unsaved tuning');
  return { value, pill, plain: [value, ...pill].join(' · '), muted: wide };
}
