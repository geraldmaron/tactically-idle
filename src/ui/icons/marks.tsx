// Small filled marks for readiness and result grades. Each has its own silhouette and a knocked-out
// glyph, and the label sits beside it by default, so a mark never depends on colour alone.
import type { ReactNode } from 'react';
import { STATUS_META } from '../components/labels';
import type { StatusKey } from '../components/labels';
import type { OutcomeBand } from '../../sim/types';
import './kit.css';

/** A 16-grid silhouette (filled with the tone) and the glyph cut out of it (drawn in the page ink). */
interface MarkArt {
  shape: ReactNode;
  cut: ReactNode;
}

// Ready circle, strained triangle, overloaded octagon, recovery half-filled ring, injured square,
// training pentagon, detail landscape card, deployed tag, resting crescent, retiring hourglass.
const STATUS_ART: Record<MarkStatus, MarkArt> = {
  ready: { shape: <circle cx="8" cy="8" r="7" />, cut: <path d="M4.8 8.3l2.2 2.2 4.2-4.6" /> },
  strained: { shape: <path d="M8 1.2l7 12.6H1z" strokeLinejoin="round" strokeWidth="1.6" />, cut: <path d="M8 6v3.6M8 11.6v.01" /> },
  overloaded: {
    shape: <path d="M5.1 1h5.8L15 5.1v5.8L10.9 15H5.1L1 10.9V5.1z" />,
    cut: <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" />,
  },
  recovery: {
    shape: (
      <>
        <circle cx="8" cy="8" r="6.2" fill="none" strokeWidth="1.6" />
        <path d="M8 1.8a6.2 6.2 0 0 0 0 12.4z" />
      </>
    ),
    cut: null,
  },
  injured: { shape: <rect x="1" y="1" width="14" height="14" rx="2.5" />, cut: <path d="M8 4.5v7M4.5 8h7" /> },
  training: { shape: <path d="M8 1l7 5-2.7 9H3.7L1 6z" strokeLinejoin="round" strokeWidth="1" />, cut: <path d="M5.2 10l2.8-2.8 2.8 2.8" /> },
  detail: { shape: <rect x="1" y="3" width="14" height="10" rx="2" />, cut: <path d="M4 6.5h8M4 9.5h5" /> },
  deployed: { shape: <path d="M1 3h9.5L15 8l-4.5 5H1z" strokeLinejoin="round" strokeWidth="1" />, cut: null },
  resting: { shape: <path d="M7.2 1A7 7 0 1 0 15 8.8 5.5 5.5 0 0 1 7.2 1z" />, cut: null },
  retiring: { shape: <path d="M3 1h10L8 8l5 7H3l5-7z" strokeLinejoin="round" strokeWidth="1.2" />, cut: null },
};

// Went well circle, complications diamond, went badly square.
const OUTCOME_ART: Record<OutcomeBand, MarkArt> = {
  favorable: { shape: <circle cx="8" cy="8" r="7" />, cut: <path d="M4.8 8.3l2.2 2.2 4.2-4.6" /> },
  mixed: { shape: <path d="M8 .8L15.2 8 8 15.2.8 8z" strokeLinejoin="round" strokeWidth="1.2" />, cut: <path d="M5 8.3c1-1.1 2-1.1 3 0s2 1.1 3 0" /> },
  adverse: { shape: <rect x="1" y="1" width="14" height="14" rx="2.5" />, cut: <path d="M5.4 5.4l5.2 5.2M10.6 5.4l-5.2 5.2" /> },
};

/** Officer status keys from labels.ts, plus resting (a squad on the Rest duty). */
export type MarkStatus = StatusKey | 'resting';

const STATUS_LABEL: Record<MarkStatus, string> = {
  ...Object.fromEntries(Object.entries(STATUS_META).map(([k, v]) => [k, v.label])),
  resting: 'Resting',
} as Record<MarkStatus, string>;

function Mark({ art, tone, label, showLabel, size, className }: { art: MarkArt; tone: string; label: string; showLabel: boolean; size: number; className?: string }) {
  return (
    <span className={['kit-mark', `kit-mark--${tone}`, className].filter(Boolean).join(' ')}>
      <svg
        className="kit-mark-art"
        width={size}
        height={size}
        viewBox="0 0 16 16"
        role={showLabel ? undefined : 'img'}
        aria-label={showLabel ? undefined : label}
        aria-hidden={showLabel ? true : undefined}
        focusable="false"
      >
        <g className="kit-mark-shape">{art.shape}</g>
        {art.cut ? <g className="kit-mark-cut">{art.cut}</g> : null}
      </svg>
      {showLabel ? <span className="kit-mark-label">{label}</span> : null}
    </span>
  );
}

export interface StatusMarkProps {
  status: MarkStatus;
  /** Defaults to the status's name in labels.ts. */
  label?: string;
  /** The mark alone (the label moves to aria-label). Use only where the label is already visible nearby. */
  showLabel?: boolean;
  size?: number;
  className?: string;
}

export function StatusMark({ status, label, showLabel = true, size = 16, className }: StatusMarkProps) {
  return <Mark art={STATUS_ART[status]} tone={status} label={label ?? STATUS_LABEL[status]} showLabel={showLabel} size={size} className={className} />;
}

export interface OutcomeMarkProps {
  band: OutcomeBand;
  /** The screen's own wording: RESULT_LABEL after a call, FORECAST_LABEL on a preview (screens/OperationFeedback.tsx). */
  label: string;
  showLabel?: boolean;
  size?: number;
  className?: string;
}

export function OutcomeMark({ band, label, showLabel = true, size = 16, className }: OutcomeMarkProps) {
  return <Mark art={OUTCOME_ART[band]} tone={band} label={label} showLabel={showLabel} size={size} className={className} />;
}

export const MARK_STATUSES = Object.keys(STATUS_ART) as MarkStatus[];
export const OUTCOME_BANDS = Object.keys(OUTCOME_ART) as OutcomeBand[];
