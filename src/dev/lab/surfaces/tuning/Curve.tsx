// The band curve (spec 3.7 "Previews"): how a choice's margin turns into goes well, complications
// and goes badly, drawn on night blueprint because it is engine math. The stacked areas are the
// patched curve; the dashed chalk lines are the saved one. Each choice offered at the Play node
// sits on the goes-well edge at its margin: a hollow ring where the saved tuning puts it, a dot
// where the patch does, so a dial that moves odds visibly moves the dots.
import { useMemo } from 'react';
import { percent } from '../../model/label';
import type { CurvePoint } from './studio';

export interface CurveChoice { id: string; n: number; title: string; margin: number; before: number; after: number }

const W = 720, H = 236;
const PAD = { l: 44, r: 14, t: 30, b: 30 };
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫'];
export const circled = (n: number): string => CIRCLED[n - 1] ?? `(${n})`;

export function TuningCurve({ points, saved, choices, label, thresholds }: {
  points: readonly CurvePoint[]; saved: readonly CurvePoint[]; choices: readonly CurveChoice[]; label: string;
  thresholds: { saved: { favorableAt: number; adverseAt: number }; now: { favorableAt: number; adverseAt: number } };
}) {
  const lo = points[0]?.margin ?? -40, hi = points[points.length - 1]?.margin ?? 40;
  const x = (m: number) => PAD.l + ((Math.max(lo, Math.min(hi, m)) - lo) / (hi - lo || 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - Math.max(0, Math.min(1, v))) * (H - PAD.t - PAD.b);
  const line = (pts: readonly CurvePoint[], value: (p: CurvePoint) => number) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.margin).toFixed(1)},${y(value(p)).toFixed(1)}`).join('');
  const area = (top: (p: CurvePoint) => number, bottom: (p: CurvePoint) => number) =>
    `${line(points, top)}${[...points].reverse().map(p => `L${x(p.margin).toFixed(1)},${y(bottom(p)).toFixed(1)}`).join('')}Z`;
  const badly = (p: CurvePoint) => p.adverse, belowWell = (p: CurvePoint) => p.adverse + p.mixed;

  // Number tags above the plot, nudged apart when two choices sit close together.
  const tags = useMemo(() => {
    const placed: { id: string; tx: number; row: number }[] = [];
    for (const choice of [...choices].sort((a, b) => a.margin - b.margin)) {
      const tx = x(choice.margin);
      const row = placed.some(other => other.row === 0 && Math.abs(other.tx - tx) < 16) ? 1 : 0;
      placed.push({ id: choice.id, tx, row });
    }
    return new Map(placed.map(tag => [tag.id, tag]));
  }, [choices, lo, hi]);

  const gridX = [-40, -30, -20, -10, 0, 10, 20, 30, 40].filter(m => m >= lo && m <= hi);
  const num = (n: number) => (n < 0 ? `−${-n}` : `${n}`);
  const { now, saved: was } = thresholds;
  return (
    <figure className="lab-tcurve">
      <svg className="lab-tcurve-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <title>{label}</title>
        <rect className="lab-tcurve-paper" x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} />
        {gridX.map(m => <path key={m} className={m === 0 ? 'lab-tcurve-zero' : 'lab-tcurve-grid'} d={`M${x(m)},${PAD.t}V${H - PAD.b}`} />)}
        {[0.25, 0.5, 0.75].map(v => <path key={v} className="lab-tcurve-grid" d={`M${PAD.l},${y(v)}H${W - PAD.r}`} />)}
        <path className="lab-tcurve-badly" d={area(badly, () => 0)} />
        <path className="lab-tcurve-mixed" d={area(belowWell, badly)} />
        <path className="lab-tcurve-well" d={area(() => 1, belowWell)} />
        <path className="lab-tcurve-edge" d={line(points, belowWell)} />
        <path className="lab-tcurve-edge" d={line(points, badly)} />
        <path className="lab-tcurve-saved" d={line(saved, belowWell)} />
        <path className="lab-tcurve-saved" d={line(saved, badly)} />
        <text className="lab-tcurve-band" x={W - PAD.r - 8} y={PAD.t + 16} textAnchor="end">goes well</text>
        <text className="lab-tcurve-band" x={x(0) + 6} y={y(0.5) + 4}>complications</text>
        <text className="lab-tcurve-band" x={PAD.l + 8} y={H - PAD.b - 8}>goes badly</text>
        {[0, 0.5, 1].map(v => <text key={v} className="lab-tcurve-tick" x={PAD.l - 6} y={y(v) + 4} textAnchor="end">{`${v * 100}%`}</text>)}
        {gridX.filter(m => m % 20 === 0).map(m => <text key={m} className="lab-tcurve-tick" x={x(m)} y={H - PAD.b + 16} textAnchor="middle">{m > 0 ? `+${m}` : m < 0 ? `−${-m}` : '0'}</text>)}
        <text className="lab-tcurve-axis" x={W - PAD.r} y={H - 2} textAnchor="end">margin: what the squad brings minus what the choice asks</text>
        {choices.map(choice => {
          const tag = tags.get(choice.id)!;
          const cx = x(choice.margin), yb = y(1 - choice.before), ya = y(1 - choice.after);
          const changed = Math.abs(choice.after - choice.before) > 1e-9;
          const name = `${circled(choice.n)} ${choice.title}: margin ${choice.margin >= 0 ? '+' : '−'}${Math.abs(choice.margin).toFixed(1)}, goes well ${percent(choice.before)}${changed ? ` → ${percent(choice.after)}` : ''}`;
          return (
            <g key={choice.id} className="lab-tcurve-choice" tabIndex={0} role="img" aria-label={name}>
              <title>{name}</title>
              <path className="lab-tcurve-leader" d={`M${cx},${PAD.t - 6 + tag.row * 12}V${H - PAD.b}`} />
              {changed && <path className="lab-tcurve-move" d={`M${cx},${yb}V${ya}`} />}
              <circle className="lab-tcurve-ring" cx={cx} cy={yb} r={5} />
              <circle className={changed ? 'lab-tcurve-dot lab-tcurve-dot-moved' : 'lab-tcurve-dot'} cx={cx} cy={ya} r={3.4} />
              <text className="lab-tcurve-tag" x={cx} y={PAD.t - 10 + tag.row * 12} textAnchor="middle">{circled(choice.n)}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="lab-tcurve-key">
        <span><i className="lab-tcurve-swatch lab-fill-well" />Goes well at {num(now.favorableAt)}{now.favorableAt !== was.favorableAt ? ` (saved ${num(was.favorableAt)})` : ''}</span>
        <span><i className="lab-tcurve-swatch lab-fill-mixed" />Complications between</span>
        <span><i className="lab-tcurve-swatch lab-fill-badly" />Goes badly below {num(now.adverseAt)}{now.adverseAt !== was.adverseAt ? ` (saved ${num(was.adverseAt)})` : ''}</span>
        <span><i className="lab-tcurve-dash" />Saved tuning</span>
        {choices.length > 0 && <span><i className="lab-tcurve-ringkey" />This moment's choices: ring saved, dot now</span>}
      </figcaption>
    </figure>
  );
}
