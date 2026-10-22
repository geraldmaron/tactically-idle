// One badge per call type: its own shape, colour and mark, so the type reads at a glance and still
// reads without colour (circle, square, diamond, shield). The label comes from incidentMeta, so the
// badge and every other surface name a type the same way.
import type { ReactNode } from 'react';
import { iconPaths } from '../icons';
import type { IconName } from '../icons';
import { incidentMeta } from '../components/incident';
import { CALL_TYPE_ICON } from './kit';
import { MedallionImage, useMedallion } from '../art/Medallions';
import type { IncidentType } from '../../sim/scenario-types';
import './kit.css';

type Shape = 'circle' | 'square' | 'diamond' | 'shield';

const KIND: Record<IncidentType, { kind: string; shape: Shape }> = {
  hostage_crisis: { kind: 'hostage', shape: 'circle' },
  barricaded: { kind: 'barricade', shape: 'square' },
  active_armed_incident: { kind: 'armed', shape: 'diamond' },
  protected_rescue: { kind: 'rescue', shape: 'shield' },
};

/** Outline in a 32 grid, and where the 24-grid mark sits inside it. */
const SHAPES: Record<Shape, { outline: ReactNode; mark: { x: number; y: number; s: number } }> = {
  circle: { outline: <circle cx="16" cy="16" r="15" />, mark: { x: 6, y: 6, s: 20 } },
  square: { outline: <rect x="1.5" y="1.5" width="29" height="29" rx="7" />, mark: { x: 5.5, y: 5.5, s: 21 } },
  diamond: { outline: <path d="M16 2.5L29.5 16 16 29.5 2.5 16z" strokeWidth="3" strokeLinejoin="round" />, mark: { x: 7.5, y: 7.5, s: 17 } },
  shield: { outline: <path d="M16 1.5l13 4.5v9.5c0 7.5-5.5 13-13 15.5C8.5 28.5 3 23 3 15.5V6z" />, mark: { x: 7, y: 6, s: 18 } },
};

export function callTypeKind(type: string | null | undefined): { kind: string; shape: Shape; icon: IconName } {
  const k = type && type in KIND ? KIND[type as IncidentType] : null;
  if (!k) return { kind: 'unknown', shape: 'circle', icon: 'pin' };
  return { ...k, icon: CALL_TYPE_ICON[type as IncidentType] };
}

export interface CallTypeBadgeProps {
  type: string | null | undefined;
  /** Badge edge in px. 20 in a chip, 24 to 28 on a card, 40 or more as a hero. */
  size?: number;
  /** Show the type's name beside the badge (true), a custom name (string), or the badge alone. */
  label?: boolean | string;
  className?: string;
  /** Use the painted medallion (docs/art/medallions/README.md) when the type has one and `size` is
   * at least MEDALLION_MIN. Its ring carries the type's hue; the SVG badge below that size, or
   * when the file is missing or fails, keeps the shape guarantee. */
  medallion?: boolean;
}

export function CallTypeBadge({ type, size = 24, label = false, className, medallion = false }: CallTypeBadgeProps) {
  const { kind, shape, icon } = callTypeKind(type);
  const name = typeof label === 'string' ? label : incidentMeta(type).label;
  const { outline, mark } = SHAPES[shape];
  const painted = useMedallion(type, size, medallion);
  if (painted.src) return (
    <span className={['ct-badge', 'ct-badge--medallion', `ct-badge--${kind}`, className].filter(Boolean).join(' ')} role={label ? undefined : 'img'} aria-label={label ? undefined : name}>
      <MedallionImage src={painted.src} size={size} onFail={painted.fail} />
      {label ? <span className="ct-badge-label">{name}</span> : null}
    </span>
  );
  return (
    <span className={['ct-badge', `ct-badge--${kind}`, className].filter(Boolean).join(' ')}>
      <svg
        className="ct-badge-shape"
        width={size}
        height={size}
        viewBox="0 0 32 32"
        role={label ? undefined : 'img'}
        aria-label={label ? undefined : name}
        aria-hidden={label ? true : undefined}
        focusable="false"
      >
        <g className="ct-badge-fill">{outline}</g>
        <svg x={mark.x} y={mark.y} width={mark.s} height={mark.s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="ct-badge-mark">
          {iconPaths(icon)}
        </svg>
      </svg>
      {label ? <span className="ct-badge-label">{name}</span> : null}
    </span>
  );
}
