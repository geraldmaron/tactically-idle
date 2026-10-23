import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import { RATING_META, STATUS_META, ratingTone } from './labels';
import type { RatingKey } from '../../sim/types';
import type { StatusKey } from './labels';
import { ChoiceRail } from './ChoiceRail';
import { StressDisplay } from './StressDisplay';

// Small shared primitives, one definition each (docs/ui-ux-audit.md, "Patterns in use"). Styling
// lives in app.css under "primitives", from the tokens in theme.css. Empty, loading and error states
// are in states.tsx and come through here so a screen has one import.
export { EmptyState, ErrorState, LoadingState } from './states';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Primary is the player's move, one per screen and the only amber. Quiet is everything else
   * (`secondary` is its older name; `ghost` drops the outline). Danger removes or undoes. */
  variant?: 'primary' | 'quiet' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  icon?: IconName;
  block?: boolean;
  /** A toggle that is on: the raised slate state, announced through aria-pressed. */
  selected?: boolean;
}

export function Button({ variant = 'secondary', size = 'md', icon, block, selected, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size}${block ? ' btn-block' : ''}${selected ? ' btn-selected' : ''}${className ? ` ${className}` : ''}`}
      {...rest}
      aria-pressed={rest['aria-pressed'] ?? selected}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 'sm' : 'md'} />}
      {children}
    </button>
  );
}

export function Chip({
  children,
  tone = 'neutral',
  icon,
  title,
  selected,
  disabled,
}: {
  children: ReactNode;
  /** Neutral, good and harm, plus warn for strain and wear. `mint` and `danger` are the older
   * names of good and harm; `amber` and `blue` read as neutral. */
  tone?: 'neutral' | 'good' | 'harm' | 'warn' | 'amber' | 'mint' | 'danger' | 'blue';
  icon?: IconName;
  title?: string;
  /** The chip is the chosen one of a set: raised slate fill. */
  selected?: boolean;
  /** The chip names something unavailable: dimmed. */
  disabled?: boolean;
}) {
  return (
    <span className={`chip chip-${tone}${selected ? ' chip-selected' : ''}${disabled ? ' chip-disabled' : ''}`} title={title} aria-disabled={disabled || undefined}>
      {icon && <Icon name={icon} size="sm" />}
      {children}
    </span>
  );
}

/** A compact status mark set on a card or beside a title: "Not hired", "+40 XP", "New". Short text only;
 * a label that can wrap belongs in a Chip. */
export function Badge({ children, tone = 'neutral', icon }: {
  children: ReactNode;
  tone?: 'neutral' | 'good' | 'harm' | 'warn';
  icon?: IconName;
}) {
  return (
    <span className={`stamp stamp-${tone}`}>
      {icon && <Icon name={icon} size="sm" />}
      {children}
    </span>
  );
}

export type TextKind = 'section' | 'row' | 'meta' | 'price' | 'decision';

/** The named type styles (app.css, "Semantic type"): the section heading, a row's title, metadata, a
 * price and decision text. Meta is the only 12px; the rest read at 14px or more. */
export function Text({ kind, as: Tag = 'span', className, children }: {
  kind: TextKind;
  as?: 'span' | 'p' | 'div' | 'strong';
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={`t-${kind}${className ? ` ${className}` : ''}`}>{children}</Tag>;
}

/** A titled block. The heading is 14px in sentence case, with a quiet count or a link at the right.
 * The `icon` is required, as a Row's `lead` is (docs/visual-kit.md). */
export function Section({
  title,
  action,
  count,
  children,
  id,
  hint,
  icon,
}: {
  title: string;
  action?: ReactNode;
  count?: ReactNode;
  children: ReactNode;
  id?: string;
  hint?: ReactNode;
  /** Required: the picture its peers carry. */
  icon: IconName;
}) {
  return (
    <section className="section" aria-labelledby={id} data-lead={icon ? undefined : 'none'}>
      <div className="section-head">
        <h2 id={id} className="section-title">
          {icon && <Icon name={icon} size="md" />}
          {title}
        </h2>
        {count !== undefined && <span className="section-count">{count}</span>}
        {action}
      </div>
      {hint && <p className="section-hint">{hint}</p>}
      {children}
    </section>
  );
}

/** A thing you open: a flat panel with one hairline. Lists use Row instead. `amber` marks the one
 * card that needs the player now; `good` and `harm` carry a result. With `onClick` the whole card is
 * the button. */
export function Card({ children, className, tone, selected, disabled, onClick, label }: {
  children: ReactNode;
  className?: string;
  tone?: 'amber' | 'mint' | 'good' | 'harm';
  /** The card is the chosen one of a set. */
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  /** The accessible name when the card is a button and its text alone would be unclear. */
  label?: string;
}) {
  const classes = `card${tone ? ` card-${tone}` : ''}${onClick ? ' card-link' : ''}${selected ? ' card-selected' : ''}${disabled ? ' card-disabled' : ''}${className ? ` ${className}` : ''}`;
  return onClick
    ? <button type="button" className={classes} onClick={onClick} disabled={disabled} aria-pressed={selected} aria-label={label}>{children}</button>
    : <div className={classes} aria-disabled={disabled || undefined}>{children}</div>;
}

/** A list row with a hairline: a lead (face, art or a kit mark), a title and a line, and a trailing
 * value or chevron. With onClick the whole row is the button. Every row leads with a picture
 * (docs/visual-kit.md); a falsy lead still renders `data-lead="none"`, which the visual gates count.
 * `selected` and `disabled` are the shared states. */
export function Row({ lead, title, detail, trail, onClick, className, label, selected, disabled }: {
  /** Required: a face, art or a kit mark. Registered art is a node like any other. */
  lead: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  trail?: ReactNode;
  onClick?: () => void;
  className?: string;
  /** The accessible name when the row is a button and its text alone would be unclear. */
  label?: string;
  selected?: boolean;
  disabled?: boolean;
}) {
  const body = (
    <>
      {lead && <span className="ui-row-lead">{lead}</span>}
      <span className="ui-row-main">
        <span className="ui-row-title">{title}</span>
        {detail && <span className="ui-row-detail">{detail}</span>}
      </span>
      {trail && <span className="ui-row-trail">{trail}</span>}
    </>
  );
  const classes = `ui-row${selected ? ' ui-row-selected' : ''}${disabled ? ' ui-row-disabled' : ''}${className ? ` ${className}` : ''}`;
  const leadMark = lead ? undefined : 'none';
  return onClick
    ? <button type="button" className={classes} onClick={onClick} disabled={disabled} aria-pressed={selected} aria-label={label} data-lead={leadMark}>{body}</button>
    : <div className={classes} aria-disabled={disabled || undefined} data-lead={leadMark}>{body}</div>;
}

type ActionBarButton = Omit<ButtonProps, 'variant' | 'children' | 'block'> & { label: ReactNode };

/** The foot of a flow: an optional summary line, one primary, at most one quiet button. */
export function ActionBar({ summary, primary, quiet, className }: {
  summary?: ReactNode;
  primary: ActionBarButton;
  quiet?: ActionBarButton;
  className?: string;
}) {
  const { label: primaryLabel, ...primaryProps } = primary;
  return (
    <div className={`action-bar${className ? ` ${className}` : ''}`}>
      {summary && <p className="action-bar-summary">{summary}</p>}
      <div className="action-bar-buttons">
        {quiet && (() => { const { label, ...props } = quiet; return <Button variant="quiet" {...props}>{label}</Button>; })()}
        <Button variant="primary" data-primary {...primaryProps}>{primaryLabel}</Button>
      </div>
    </div>
  );
}

export function KV({ k, v, tone, strong, icon }: { k: ReactNode; v: ReactNode; tone?: 'mint' | 'danger' | 'amber'; strong?: boolean; icon?: IconName }) {
  return (
    <div className={`kv${strong ? ' kv-strong' : ''}`}>
      <span className="kv-k">
        {icon && <Icon name={icon} size="sm" />}
        {k}
      </span>
      <span className={`kv-v${tone ? ` tone-${tone}` : ''}`}>{v}</span>
    </div>
  );
}

/** The one ring: a value from 0 to 100 drawn as a filled arc around its content (an icon, a number or a
 * face). `tone` colors the arc; `score` picks good, amber or harm by the value (80 and 50, as results
 * read). Decorative: the value's words belong to the element that holds it. */
export type RingTone = 'score' | 'act' | 'good' | 'warn' | 'harm' | 'trust' | 'level';
const RING_COLOR: Record<Exclude<RingTone, 'score'>, string> = { act: 'var(--act)', good: 'var(--good)', warn: 'var(--warn)', harm: 'var(--harm)', trust: 'var(--good)', level: 'var(--act)' };
export const ringColor = (tone: RingTone, value: number) => tone === 'score' ? (value >= 80 ? 'var(--mint)' : value >= 50 ? 'var(--warn)' : 'var(--danger)') : RING_COLOR[tone];
export function Ring({ value, size = 34, tone = 'score', className, children }: { value: number; size?: number; tone?: RingTone; className?: string; children?: ReactNode }) {
  const v = Math.max(0, Math.min(100, value));
  return <span className={`ring${className ? ` ${className}` : ''}`} aria-hidden="true" style={{ width: size, height: size, '--ring-fill': v, '--ring-color': ringColor(tone, v) } as CSSProperties}>
    <span className="ring-core">{children}</span>
  </span>;
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
              <Icon name={meta.icon} size="sm" />
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
        <Icon name="minus" size="sm" />
      </button>
      <output className="stepper-val" aria-live="polite">
        {value}
      </output>
      <button type="button" className="stepper-btn" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${label}`}>
        <Icon name="plus" size="sm" />
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
      <Icon name={icon} size="sm" />
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
