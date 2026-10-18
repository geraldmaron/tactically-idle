// Small charts the surfaces share (spec 4.5): stacked mixes, gate bullets, the four-style spread, the
// band curve over margin and the contributor waterfall. Numbers as shapes, with the numbers one hover
// away and always in the accessible name. Pure presentation: callers pass values, never engine state.
import type { Policy, Weight } from '../../../gen/incident/trees-v13/balance';
import { percent, styleLabel } from '../model/label';
import { Glyph } from './glyphs';
import { cx } from './marks';

export type Tone = Weight | 'well' | 'mixed' | 'badly' | 'event' | 'muted';
export interface StackPart { key: string; value: number; tone: Tone; label: string }

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const pos = (v: number, [lo, hi]: [number, number]) => `${clamp01((v - lo) / (hi - lo || 1)) * 100}%`;
const fmtShare = (v: number) => percent(v);

function shares(parts: readonly StackPart[]) {
  const total = parts.reduce((sum, part) => sum + Math.max(0, part.value), 0);
  return parts.map(part => ({ ...part, share: total > 0 ? Math.max(0, part.value) / total : 0 }));
}

/** A horizontal stack (run-class mix, band triplet). An optional baseline draws as a thin ghost
 * underneath so a before/after reads at a glance. */
export function StackBar({ parts, baseline, label, height = 10 }: { parts: readonly StackPart[]; baseline?: readonly StackPart[] | null; label: string; height?: number }) {
  const now = shares(parts);
  const name = `${label}: ${now.filter(p => p.share > 0).map(p => `${p.label} ${fmtShare(p.share)}`).join(', ') || 'no runs'}`;
  return (
    <span className="lab-stack" role="img" aria-label={name} title={name}>
      <span className="lab-stack-bar" style={{ height }}>
        {now.map(part => part.share > 0 && <i key={part.key} className={`lab-fill-${part.tone}`} style={{ flexGrow: part.share }} />)}
      </span>
      {baseline && (
        <span className="lab-stack-bar lab-stack-ghost" style={{ height: Math.max(3, Math.round(height / 3)) }}>
          {shares(baseline).map(part => part.share > 0 && <i key={part.key} className={`lab-fill-${part.tone}`} style={{ flexGrow: part.share }} />)}
        </span>
      )}
    </span>
  );
}

/** One gate check: the allowed band shaded, the saved value as a hollow tick, the patched value as a
 * solid marker, and pass or fail. Domain 0..1 unless given. */
export function Bullet({ label, min, max, saved, patch, pass, domain = [0, 1], format = fmtShare }: {
  label: string; min?: number; max?: number; saved?: number | null; patch?: number | null; pass?: boolean | null;
  domain?: [number, number]; format?: (v: number) => string;
}) {
  const lo = min ?? domain[0], hi = max ?? domain[1];
  const shown = patch ?? saved;
  const allowed = `${min === undefined ? `up to ${format(hi)}` : max === undefined ? `${format(lo)} or more` : `${format(lo)} to ${format(hi)}`}`;
  const name = `${label}: ${saved != null ? `saved ${format(saved)}` : 'not run'}${patch != null ? `, unsaved ${format(patch)}` : ''}; the gate allows ${allowed}${pass == null ? '' : pass ? '; passes' : '; fails'}`;
  return (
    <span className="lab-bullet" role="img" aria-label={name} title={name}>
      <span className="lab-bullet-track">
        <i className="lab-bullet-band" style={{ left: pos(lo, domain), right: `calc(100% - ${pos(hi, domain)})` }} />
        {saved != null && <i className="lab-bullet-saved" style={{ left: pos(saved, domain) }} />}
        {patch != null && <i className="lab-bullet-patch" style={{ left: pos(patch, domain) }} />}
      </span>
      {shown != null && <span className="lab-bullet-value">{saved != null && patch != null ? `${format(saved)} → ${format(patch)}` : format(shown)}</span>}
      {pass != null && <span className={pass ? 'lab-pass' : 'lab-fail'}><Glyph name={pass ? 'clean' : 'close'} size={12} /></span>}
    </span>
  );
}

const STYLE_MARK: Record<Policy, string> = { random: 'disc', best_odds: 'square', patient: 'triangle', fast: 'diamond' };
const STYLE_ORDER: readonly Policy[] = ['random', 'best_odds', 'patient', 'fast'];

/** The four play styles on one axis (clean share by default), with the best-odds cap drawn as a line. */
export function StyleSpread({ label, values, cap, domain = [0, 1], format = fmtShare }: {
  label: string; values: Partial<Record<Policy, number>>; cap?: number | null; domain?: [number, number]; format?: (v: number) => string;
}) {
  const present = STYLE_ORDER.filter(style => values[style] !== undefined);
  const name = `${label}: ${present.map(style => `${styleLabel(style)} ${format(values[style]!)}`).join(', ') || 'not run'}${cap != null ? `; cap ${format(cap)}` : ''}`;
  return (
    <span className="lab-spread" role="img" aria-label={name} title={name}>
      <span className="lab-spread-axis">
        {cap != null && <i className="lab-spread-cap" style={{ left: pos(cap, domain) }} />}
        {present.map(style => <i key={style} className={`lab-spread-mark lab-spread-${STYLE_MARK[style]}`} style={{ left: pos(values[style]!, domain) }} />)}
      </span>
      <span className="lab-spread-key">
        {present.map(style => <span key={style}><i className={`lab-spread-swatch lab-spread-${STYLE_MARK[style]}`} />{styleLabel(style)}</span>)}
      </span>
    </span>
  );
}

export interface CurvePoint { margin: number; favorable: number; mixed: number; adverse: number }
export interface CurveMarker { id: string; label: string; margin: number }

/** Band chances over margin, stacked: goes badly at the bottom, complications, goes well on top. A saved
 * curve draws dashed on top of the current one; markers sit at their choices' margins. */
export function BandCurve({ points, saved, markers = [], width = 420, height = 120, label = 'Band chances by margin' }: {
  points: readonly CurvePoint[]; saved?: readonly CurvePoint[] | null; markers?: readonly CurveMarker[]; width?: number; height?: number; label?: string;
}) {
  if (points.length < 2) return null;
  const pad = { l: 30, r: 6, t: 6, b: 18 };
  const lo = points[0].margin, hi = points[points.length - 1].margin;
  const x = (m: number) => pad.l + ((m - lo) / (hi - lo || 1)) * (width - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - clamp01(v)) * (height - pad.t - pad.b);
  const line = (pts: readonly CurvePoint[], value: (p: CurvePoint) => number) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.margin).toFixed(1)},${y(value(p)).toFixed(1)}`).join('');
  const area = (top: (p: CurvePoint) => number, bottom: (p: CurvePoint) => number) =>
    `${line(points, top)}${[...points].reverse().map(p => `L${x(p.margin).toFixed(1)},${y(bottom(p)).toFixed(1)}`).join('')}Z`;
  const badly = (p: CurvePoint) => p.adverse, upToMixed = (p: CurvePoint) => p.adverse + p.mixed;
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  return (
    <svg className="lab-curve" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <title>{label}</title>
      <path className="lab-curve-badly" d={area(badly, () => 0)} />
      <path className="lab-curve-mixed" d={area(upToMixed, badly)} />
      <path className="lab-curve-well" d={area(() => 1, upToMixed)} />
      {saved && saved.length > 1 && <>
        <path className="lab-curve-saved" d={line(saved, badly)} />
        <path className="lab-curve-saved" d={line(saved, upToMixed)} />
      </>}
      <path className="lab-curve-axis" d={`M${pad.l},${pad.t}V${height - pad.b}H${width - pad.r}`} />
      <text className="lab-curve-tick" x={pad.l - 4} y={y(1) + 4} textAnchor="end">100%</text>
      <text className="lab-curve-tick" x={pad.l - 4} y={y(0)} textAnchor="end">0%</text>
      {ticks.map(m => <text key={m} className="lab-curve-tick" x={x(m)} y={height - 4} textAnchor="middle">{m > 0 ? `+${m}` : m}</text>)}
      {markers.map(marker => (
        <g key={marker.id} className="lab-curve-marker">
          <path d={`M${x(marker.margin)},${pad.t}V${height - pad.b}`} />
          <text x={x(marker.margin)} y={pad.t + 10} textAnchor="middle">{marker.label}</text>
        </g>
      ))}
    </svg>
  );
}

export interface WaterfallItem { id: string; label: string; value: number }

/** Contributors stepping from zero to the margin: each bar starts where the last one ended, so the
 * final row is the sum (score − difficulty). */
export function Waterfall({ items, totalLabel = 'Margin', format = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 10) / 10)}` }: {
  items: readonly WaterfallItem[]; totalLabel?: string; format?: (v: number) => string;
}) {
  let run = 0;
  const steps = items.map(item => { const from = run; run += item.value; return { ...item, from, to: run }; });
  const total = run;
  const ends = [0, ...steps.map(step => step.to)];
  const domain: [number, number] = [Math.min(...ends), Math.max(...ends)];
  if (domain[0] === domain[1]) domain[1] = domain[0] + 1;
  const bar = (a: number, b: number) => ({ left: pos(Math.min(a, b), domain), width: `${(Math.abs(b - a) / (domain[1] - domain[0])) * 100}%` });
  return (
    <div className="lab-waterfall" role="table" aria-label={`${totalLabel} ${format(total)} from ${items.length} contributors`}>
      {steps.map(step => (
        <div key={step.id} className="lab-waterfall-row" role="row">
          <span className="lab-waterfall-label" role="cell">{step.label}</span>
          <span className="lab-waterfall-value" role="cell">{format(step.value)}</span>
          <span className="lab-waterfall-track" role="cell"><i className={cx(step.value >= 0 ? 'lab-waterfall-up' : 'lab-waterfall-down')} style={bar(step.from, step.to)} /></span>
        </div>
      ))}
      <div className="lab-waterfall-row lab-waterfall-total" role="row">
        <span className="lab-waterfall-label" role="cell">{totalLabel}</span>
        <span className="lab-waterfall-value" role="cell">{format(total)}</span>
        <span className="lab-waterfall-track" role="cell"><i className="lab-waterfall-sum" style={bar(0, total)} /><i className="lab-waterfall-zero" style={{ left: pos(0, domain) }} /></span>
      </div>
    </div>
  );
}
