import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import { EXPERIENCE_META, RATING_META, STATUS_META, ratingTone } from './labels';
import type { RatingKey } from '../../sim/types';
import type { StatusKey } from './labels';
import type { ExperienceBand } from '../../sim/calendar';
import { EXPERIENCE_LABEL } from '../../sim/calendar';
import { ChoiceRail } from './ChoiceRail';
import { StressDisplay } from './StressDisplay';

// Small shared primitives. Styling lives in app.css.

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  icon?: IconName;
  block?: boolean;
}

export function Button({ variant = 'secondary', size = 'md', icon, block, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size}${block ? ' btn-block' : ''}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
    </button>
  );
}

export function Chip({
  children,
  tone = 'neutral',
  icon,
  title,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'amber' | 'mint' | 'danger' | 'warn' | 'blue';
  icon?: IconName;
  title?: string;
}) {
  return (
    <span className={`chip chip-${tone}`} title={title}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

export function Section({
  title,
  action,
  children,
  id,
  hint,
  icon,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
  hint?: ReactNode;
  icon?: IconName;
}) {
  return (
    <section className="section" aria-labelledby={id}>
      <div className="section-head">
        <h2 id={id} className="section-title">
          {icon && <Icon name={icon} size={18} />}
          {title}
        </h2>
        {action}
      </div>
      {hint && <p className="section-hint">{hint}</p>}
      {children}
    </section>
  );
}

export function Card({ children, className, tone }: { children: ReactNode; className?: string; tone?: 'amber' | 'mint' }) {
  return <div className={`card${tone ? ` card-${tone}` : ''}${className ? ` ${className}` : ''}`}>{children}</div>;
}

export function EmptyState({ icon = 'info', title, children }: { icon?: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={26} />
      <strong>{title}</strong>
      {children && <span>{children}</span>}
    </div>
  );
}

export function KV({ k, v, tone, strong, icon }: { k: ReactNode; v: ReactNode; tone?: 'mint' | 'danger' | 'amber'; strong?: boolean; icon?: IconName }) {
  return (
    <div className={`kv${strong ? ' kv-strong' : ''}`}>
      <span className="kv-k">
        {icon && <Icon name={icon} size={15} />}
        {k}
      </span>
      <span className={`kv-v${tone ? ` tone-${tone}` : ''}`}>{v}</span>
    </div>
  );
}

/** Horizontal meter with a text label so condition is never colour alone. */
export function Meter({
  value,
  tone,
  label,
  valueText,
  after,
}: {
  value: number;
  tone?: 'hi' | 'mid' | 'lo';
  label?: string;
  valueText?: string;
  /** A projected value above `value`, drawn as a lighter extension of the bar (for example a course gain). */
  after?: number;
}) {
  const v = Math.max(0, Math.min(100, value));
  const a = after === undefined ? v : Math.max(v, Math.min(100, after));
  return (
    <div className="meter" role="img" aria-label={`${label ?? 'Value'} ${valueText ?? `${Math.round(v)} of 100${a > v ? `, ${Math.round(a)} after` : ''}`}`}>
      <div className={`meter-fill meter-${tone ?? 'hi'}`} style={{ width: `${v}%` }} />
      {a > v && <div className="meter-gain" style={{ left: `${v}%`, width: `${a - v}%` }} />}
    </div>
  );
}

/** Ratings as labelled bars. `gains` overlays a projected after-value; `only` limits the skills shown. */
export function RatingBars({ ratings, only, gains, dense = false, label = 'Ratings' }: {
  ratings: Record<RatingKey, number>;
  only?: RatingKey[];
  gains?: Partial<Record<RatingKey, number>>;
  /** Short labels and thinner bars for cards; the sheet uses full labels. */
  dense?: boolean;
  label?: string;
}) {
  const metas = only ? only.map((key) => RATING_META.find((meta) => meta.key === key)!) : RATING_META;
  return (
    <ul className={`rating-bars${dense ? ' rating-bars-dense' : ''}`} aria-label={label}>
      {metas.map((meta) => {
        const value = Math.round(ratings[meta.key]);
        const after = gains?.[meta.key];
        const rising = after !== undefined && after > value;
        return (
          <li key={meta.key} className="rating-bar">
            <span className="rating-bar-label" title={meta.label}>
              <Icon name={meta.icon} size={dense ? 12 : 14} />
              <span>{dense ? meta.short : meta.label}</span>
            </span>
            <span className={`rating-bar-value${rising ? ' tone-mint' : ''}`}>
              {value}
              {rising && <><span aria-hidden="true">→</span><span className="sr-only"> to </span>{Math.round(after)}</>}
            </span>
            <Meter value={value} after={after} tone={ratingTone(value)} label={meta.label} />
          </li>
        );
      })}
    </ul>
  );
}

/** Compact stress reading; overall availability is shown separately. */
export function ReadinessBar({ stress, withText }: { stress: number; withText?: boolean }) {
  return <StressDisplay value={stress} compact={!withText} />;
}

export function Stepper({
  value,
  min = 0,
  max,
  onChange,
  label,
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (n: number) => void;
  label: string;
}) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="stepper-btn" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${label}`}>
        <Icon name="minus" size={16} />
      </button>
      <output className="stepper-val" aria-live="polite">
        {value}
      </output>
      <button type="button" className="stepper-btn" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${label}`}>
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode; disabled?: boolean }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return <ChoiceRail value={value} options={options} onChange={onChange} label={label} grow />;
}

/** Sub-section heading with a leading icon. */
export function SubHead({ icon, children, tone }: { icon: IconName; children: ReactNode; tone?: 'mint' | 'amber' | 'neutral' }) {
  return (
    <h3 className={`sub-h${tone ? ` tone-${tone}` : ''}`}>
      <Icon name={icon} size={16} />
      {children}
    </h3>
  );
}

/** Officer status chip (ready, strained, overloaded, recovery, injured, training, deployed, retiring). */
export function OfficerStatusChip({ status, children }: { status: StatusKey; children?: ReactNode }) {
  const m = STATUS_META[status];
  return (
    <Chip tone={m.tone} icon={m.icon}>
      {children ?? m.label}
    </Chip>
  );
}

export function ExperienceChip({ band }: { band: ExperienceBand }) {
  const m = EXPERIENCE_META[band];
  return (
    <Chip tone={m.tone} icon={m.icon}>
      {EXPERIENCE_LABEL[band]}
    </Chip>
  );
}

/** Condition bar for an equipment unit. Colour follows state, and the state is also written out. */
export function UnitBar({ value, tone, label }: { value: number; tone: 'good' | 'worn' | 'bad' | 'neutral'; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <span className="ubar" role="img" aria-label={`Condition ${Math.round(v)} percent, ${label}`}>
      <span className={`ubar-fill ubar-${tone}`} style={{ width: `${Math.max(3, v)}%` }} />
    </span>
  );
}

/** Small before -> after bar pair for wear and condition changes. */
export function BeforeAfter({ before, after }: { before: number; after: number }) {
  const b = Math.max(0, Math.min(100, before));
  const a = Math.max(0, Math.min(100, after));
  const tone = a >= 70 ? 'good' : a >= 40 ? 'worn' : 'bad';
  return (
    <span className="ba" role="img" aria-label={`Condition ${Math.round(b)} to ${Math.round(a)} percent`}>
      <span className="ba-track">
        <span className="ba-before" style={{ width: `${b}%` }} />
        <span className={`ba-after ubar-${tone}`} style={{ width: `${a}%` }} />
      </span>
    </span>
  );
}
