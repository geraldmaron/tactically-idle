import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import './choice-rail.css';

export interface RailOption<T extends string> {
  value: T;
  label: ReactNode;
  accessibleLabel?: string;
  disabled?: boolean;
}

/** Related destinations and filters stay on one line; overflow remains touch-scrollable. */
export function ChoiceRail<T extends string>({ value, options, onChange, label, kind = 'filter', grow = false, panelId }: {
  value: T;
  options: RailOption<T>[];
  onChange: (value: T) => void;
  label: string;
  kind?: 'filter' | 'navigation' | 'tabs';
  grow?: boolean;
  panelId?: string;
}) {
  const buttons = useRef(new Map<T, HTMLButtonElement>());
  const rail = useRef<HTMLDivElement>(null);
  const tabStop = options.some((option) => option.value === value && !option.disabled) ? value : options.find((option) => !option.disabled)?.value;
  useLayoutEffect(() => {
    const node = buttons.current.get(value), strip = rail.current;
    if (!node || !strip) return;
    revealRailSelection(strip, node);
  }, [value]);
  const select = (next: T) => {
    if (next !== value) onChange(next);
  };
  const move = (event: KeyboardEvent<HTMLButtonElement>, current: T) => {
    const next = railKeyboardValue(options, current, event.key);
    if (next === null) return;
    event.preventDefault();
    select(next);
    buttons.current.get(next)?.focus({ preventScroll: true });
  };
  return <div ref={rail} className={`choice-rail${grow ? ' choice-rail-grow' : ''}`} role={kind === 'tabs' ? 'tablist' : kind === 'filter' ? 'radiogroup' : 'navigation'} aria-label={label}>
    {options.map((option) => <button key={option.value} type="button"
      ref={(node) => { if (node) buttons.current.set(option.value, node); else buttons.current.delete(option.value); }}
      className={`choice-rail-item${value === option.value ? ' choice-rail-selected' : ''}`}
      role={kind === 'tabs' ? 'tab' : kind === 'filter' ? 'radio' : undefined}
      id={kind === 'tabs' && panelId ? `${panelId}-tab-${option.value}` : undefined}
      aria-label={option.accessibleLabel}
      aria-selected={kind === 'tabs' ? value === option.value : undefined}
      aria-checked={kind === 'filter' ? value === option.value : undefined}
      aria-current={kind === 'navigation' && value === option.value ? 'page' : undefined}
      aria-controls={kind === 'tabs' ? panelId : undefined}
      tabIndex={kind === 'navigation' ? 0 : tabStop === option.value ? 0 : -1}
      disabled={option.disabled}
      onClick={() => select(option.value)} onKeyDown={(event) => move(event, option.value)}>{option.label}</button>)}
  </div>;
}

/** Reveal only within the horizontal rail; never scroll the page or animate activation. */
export function revealRailSelection(strip: HTMLDivElement, node: HTMLButtonElement): void {
  const box = node.getBoundingClientRect(), viewport = strip.getBoundingClientRect();
  if (box.left < viewport.left + 4) strip.scrollLeft += box.left - viewport.left - 4;
  else if (box.right > viewport.right - 4) strip.scrollLeft += box.right - viewport.right + 4;
}

/** Keyboard order follows visible option order and skips unavailable choices. */
export function railKeyboardValue<T extends string>(options: Pick<RailOption<T>, 'value' | 'disabled'>[], current: T, key: string): T | null {
  const enabled = options.filter((option) => !option.disabled).map((option) => option.value);
  if (!enabled.length) return null;
  if (key === 'Home') return enabled[0];
  if (key === 'End') return enabled[enabled.length - 1];
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return null;
  const index = Math.max(0, enabled.indexOf(current));
  return enabled[(index + (key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length];
}
