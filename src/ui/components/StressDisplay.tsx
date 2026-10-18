import { STRESS_BANDS, stressBand, type StressBand } from '../../sim/officer';
import { signed } from '../format';
import './stress-display.css';

export const STRESS_LABEL: Record<StressBand, string> = {
  ready: 'Low stress', strained: 'Under strain', overloaded: 'Overloaded', recovery: 'Needs rest',
};
const number = (value: number) => Number(value.toFixed(1)).toLocaleString('en-US');
/** On screen a reading is a whole number. Flooring keeps it consistent with the band
 * thresholds (29.9 shows 29, "Low stress"); the accessible summary keeps the exact value. */
export const whole = (value: number) => Math.floor(value + 1e-9);
const bounded = (value: number) => Math.max(0, Math.min(100, value));

/** The visible change is the difference between the shown readings. A real change too small to
 * move the whole number reads as "slightly", never as a fake +1 or a false "no change". */
export function changeText(start: number, after: number): { text: string; direction: number } {
  const shown = whole(after) - whole(start);
  if (shown !== 0) return { text: `${signed(shown)} stress`, direction: shown };
  if (Math.abs(after - start) < 0.05) return { text: 'No change', direction: 0 };
  return after > start ? { text: 'Slightly up', direction: 1 } : { text: 'Slightly down', direction: -1 };
}

/** A condition reading, never an overall deployability or success percentage. */
export function StressDisplay({ value, before, label = 'Stress', compact = false }: { value: number; before?: number; label?: string; compact?: boolean }) {
  const after = bounded(value), start = before === undefined ? undefined : bounded(before);
  const band = stressBand(after), previousBand = start === undefined ? band : stressBand(start);
  const delta = start === undefined ? undefined : Number((after - start).toFixed(1));
  const summary = `${label} ${number(after)} of 100; ${STRESS_LABEL[band]}${start === undefined ? '' : `; before ${number(start)}, change ${signed(delta!, 1)}`}`;
  if (compact) return <span className={`stress-mini stress-${band}`} aria-label={summary}><span>Stress</span><strong>{whole(after)}</strong></span>;
  return <div className={`stress-display stress-${band}`}>
    <div className="stress-reading"><span className="stress-reading-label">{label}</span><span className="stress-band-label">{STRESS_LABEL[band]}</span><strong className="stress-value">{whole(after)}<small>/100</small></strong></div>
    <div className="stress-scale" role="img" aria-label={summary}>
      <span className="stress-zones" aria-hidden="true"><i /><i /><i /><i /></span>
      {start !== undefined && start !== after && <span aria-hidden="true" className="stress-pin stress-pin-before" style={{ left: `${start}%` }} />}
      <span aria-hidden="true" className="stress-pin" style={{ left: `${after}%` }} />
    </div>
    {start !== undefined && (() => {
      const change = changeText(start, after);
      return <div className="stress-change"><span>{whole(start)} <span aria-hidden="true">→</span> {whole(after)}</span><strong className={change.direction > 0 ? 'tone-warn' : change.direction < 0 ? 'tone-mint' : ''}>{change.text}</strong></div>;
    })()}
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
