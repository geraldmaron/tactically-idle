import { STRESS_BANDS, stressBand, type StressBand } from '../../sim/officer';
import { signed } from '../format';
import './stress-display.css';

export const STRESS_LABEL: Record<StressBand, string> = {
  ready: 'Low stress', strained: 'Under strain', overloaded: 'Overloaded', recovery: 'Needs rest',
};
const number = (value: number) => Number(value.toFixed(1)).toLocaleString('en-US');
const bounded = (value: number) => Math.max(0, Math.min(100, value));

/** A condition reading, never an overall deployability or success percentage. */
export function StressDisplay({ value, before, label = 'Stress', compact = false }: { value: number; before?: number; label?: string; compact?: boolean }) {
  const after = bounded(value), start = before === undefined ? undefined : bounded(before);
  const band = stressBand(after), previousBand = start === undefined ? band : stressBand(start);
  const delta = start === undefined ? undefined : Number((after - start).toFixed(1));
  const summary = `${label} ${number(after)} of 100; ${STRESS_LABEL[band]}${start === undefined ? '' : `; before ${number(start)}, change ${signed(delta!, 1)}`}`;
  if (compact) return <span className={`stress-mini stress-${band}`} aria-label={summary}><span>Stress</span><strong>{number(after)}</strong></span>;
  return <div className={`stress-display stress-${band}`}>
    <div className="stress-reading"><span className="stress-reading-label">{label}</span><span className="stress-band-label">{STRESS_LABEL[band]}</span><strong className="stress-value">{number(after)}<small>/100</small></strong></div>
    <div className="stress-scale" role="img" aria-label={summary}>
      <span className="stress-zones" aria-hidden="true"><i /><i /><i /><i /></span>
      {start !== undefined && start !== after && <span aria-hidden="true" className="stress-pin stress-pin-before" style={{ left: `${start}%` }} />}
      <span aria-hidden="true" className="stress-pin" style={{ left: `${after}%` }} />
    </div>
    {start !== undefined && <div className="stress-change"><span>{number(start)} <span aria-hidden="true">→</span> {number(after)}</span><strong className={delta! > 0 ? 'tone-warn' : delta! < 0 ? 'tone-mint' : ''}>{delta === 0 ? 'No change' : `${signed(delta!, 1)} stress`}</strong></div>}
    {previousBand !== band && <p className="stress-crossing">{STRESS_LABEL[previousBand]} <span aria-hidden="true">→</span> {STRESS_LABEL[band]}</p>}
  </div>;
}

export function StressGuide() {
  return <details className="stress-guide"><summary>How stress affects officers</summary><p>Lower is better. Stress can reduce an officer’s performance. Training, injury and current duties also affect whether they can join an operation.</p><ol>
    <li><strong>Below {STRESS_BANDS.strained} · Low stress</strong><span>No stress restrictions.</span></li>
    <li><strong>{STRESS_BANDS.strained} to under {STRESS_BANDS.overloaded} · Under strain</strong><span>Can still take part, with reduced performance.</span></li>
    <li><strong>{STRESS_BANDS.overloaded} to under {STRESS_BANDS.recovery} · Overloaded</strong><span>Sits out high-risk actions.</span></li>
    <li><strong>{STRESS_BANDS.recovery}–100 · Needs rest</strong><span>Cannot deploy again until stress falls below {STRESS_BANDS.recovery}.</span></li>
  </ol></details>;
}
