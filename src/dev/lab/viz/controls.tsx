// Lab controls (spec 4.5): 32 px controls, 36 px primary buttons, a 2 px amber focus ring on every
// interactive element. Each one is a plain wrapper over a native element, so keyboard and screen
// readers behave as they do everywhere else.
import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Glyph } from './glyphs';
import { cx } from './marks';

export interface SegmentOption<T> { value: T; label: ReactNode; title?: string; disabled?: boolean }

/** One choice out of a few, as a row of segments (a radio group: arrow keys move the choice). */
export function SegmentedControl<T extends string | number>({ label, value, options, onChange, size = 'normal' }: {
  label: string; value: T; options: readonly SegmentOption<T>[]; onChange: (value: T) => void; size?: 'normal' | 'small';
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (event: KeyboardEvent, from: number) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    for (let i = 1; i <= options.length; i++) {
      const next = (from + step * i + options.length) % options.length;
      if (!options[next].disabled) { onChange(options[next].value); refs.current[next]?.focus(); return; }
    }
  };
  return (
    <span className={cx('lab-segmented', size === 'small' && 'lab-segmented-small')} role="radiogroup" aria-label={label}>
      {options.map((option, i) => {
        const on = option.value === value;
        // With nothing chosen, the first segment takes the tab stop so the group stays reachable.
        const stop = on || (i === 0 && !options.some(other => other.value === value));
        return (
          <button key={String(option.value)} ref={el => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on}
            tabIndex={stop ? 0 : -1} disabled={option.disabled} title={option.title} className="lab-segment"
            onClick={() => onChange(option.value)} onKeyDown={event => move(event, i)}>
            {option.label}
          </button>
        );
      })}
    </span>
  );
}

/** A slider with a number box and ticks (default and saved, for tuning dials). */
export function Dial({ label, value, min, max, step, onChange, ticks = [], format = (v: number) => String(v), help, disabled }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void;
  ticks?: readonly { value: number; label: string }[]; format?: (v: number) => string; help?: string; disabled?: boolean;
}) {
  const id = useId();
  const clampStep = (v: number) => Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));
  const at = (v: number) => `${((v - min) / (max - min || 1)) * 100}%`;
  return (
    <div className="lab-dial">
      <label className="lab-dial-label" htmlFor={id}>{label}</label>
      <span className="lab-dial-range">{format(min)}</span>
      <span className="lab-dial-slider">
        <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled}
          aria-describedby={help ? `${id}-help` : undefined} onChange={event => onChange(Number(event.target.value))} />
        {ticks.map(tick => <i key={tick.label} className="lab-dial-tick" style={{ left: at(tick.value) }} title={`${tick.label}: ${format(tick.value)}`} />)}
      </span>
      <span className="lab-dial-range">{format(max)}</span>
      <input className="lab-dial-number" type="number" aria-label={`${label}, exact value`} min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={event => { const n = Number(event.target.value); if (event.target.value !== '' && Number.isFinite(n)) onChange(clampStep(n)); }} />
      {help && <p className="lab-dial-help" id={`${id}-help`}>{help}</p>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="lab-kbd">{children}</kbd>;
}

/** A grey block where content will be; `lines` stacks several. */
export function Skeleton({ width = '100%', height = 12, lines = 1 }: { width?: number | string; height?: number; lines?: number }) {
  return (
    <span className="lab-skeleton" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => <i key={i} style={{ width: i === lines - 1 && lines > 1 ? '60%' : width, height }} />)}
    </span>
  );
}

/** A thin progress line with its words, drawn in the pending style until it completes. */
export function ProgressLine({ done, total, label }: { done: number; total: number; label: string }) {
  const share = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <span className="lab-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={label}>
      <span className="lab-progress-track"><i style={{ width: `${share * 100}%` }} /></span>
      <span className="lab-progress-label">{label}</span>
    </span>
  );
}

/** A short confirmation that leaves on its own ("Copied", "Saved"). Lab only; never the game's toast. */
export function Toast({ children, onClose, timeout = 4000 }: { children: ReactNode; onClose: () => void; timeout?: number }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => { const timer = window.setTimeout(() => close.current(), timeout); return () => window.clearTimeout(timer); }, [timeout]);
  return (
    <div className="lab-toast" role="status">
      <span>{children}</span>
      <button type="button" className="lab-icon-button" onClick={onClose} aria-label="Dismiss"><Glyph name="close" size={12} /></button>
    </div>
  );
}
