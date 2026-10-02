import type { ReactNode } from 'react';
import type { Officer } from '../../sim/types';
import { Portrait } from '../portraits/Portrait';
import { Icon } from '../icons';
import { useWidth } from './hooks';
import { ROLE_META, bandOf, BAND_SHORT, STATUS_META } from './labels';
import type { StatusKey } from './labels';
import { ReadinessBar } from './ui';

export interface OfficerCardProps {
  officer: Officer;
  now: number;
  variant?: 'strip' | 'roster';
  selected?: boolean;
  onClick?: () => void;
  /** Top-left overlay, e.g. a "+12 COMMS" capability chip. */
  chip?: ReactNode;
  /** Extra lines under the role row (roster variant). */
  footer?: ReactNode;
  /** Mark a squad leader. */
  leader?: boolean;
  /** Dims the card and adds a text status (e.g. 'Not deployed'). */
  note?: string;
}

/** Portrait card from the approved reference: portrait, SURNAME, role icon + label, readiness bar. */
export function OfficerCard({ officer, now, variant = 'strip', selected, onClick, chip, footer, leader, note }: OfficerCardProps) {
  const [ref, w] = useWidth<HTMLSpanElement>(80);
  const band = bandOf(officer);
  const injured = !!officer.injury && officer.injury.until > now;
  const trainingOrDeployed: StatusKey | null =
    variant === 'roster' && !injured ? (officer.assignment?.kind === 'training' ? 'training' : officer.assignment?.kind === 'operation' ? 'deployed' : null) : null;
  const statusKey: StatusKey | null = injured ? 'injured' : trainingOrDeployed ? trainingOrDeployed : band === 'ready' ? null : band;
  const status = statusKey ? STATUS_META[statusKey] : null;
  const role = ROLE_META[officer.role];
  const size = Math.max(40, w);
  const crop = variant === 'roster' ? Math.min(Math.round(size * 1.04), 124) : Math.round(size * 1.04);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`ocard ocard-${variant}${selected ? ' ocard-on' : ''}${note ? ' ocard-dim' : ''}`}
      onClick={onClick}
      aria-pressed={onClick && selected !== undefined ? selected : undefined}
      aria-label={`${officer.firstName} ${officer.surname}, ${role.label}, ${injured ? 'injured' : BAND_SHORT[band]}`}
    >
      <span className="ocard-art" ref={ref} style={{ height: crop }}>
        <Portrait officer={officer} size={size} />
        {chip && <span className="ocard-chip">{chip}</span>}
        {status && statusKey && (
          <span className={`ocard-status band-${injured ? 'recovery' : statusKey === 'training' || statusKey === 'deployed' ? 'strained' : statusKey}`}>
            <Icon name={status.icon} size={11} />
            {status.label}
          </span>
        )}
        {leader && (
          <span className="ocard-leader" title="Squad leader">
            <Icon name="star" size={11} />
          </span>
        )}
        <span className="ocard-name">{officer.surname}</span>
      </span>
      <span className="ocard-row">
        <span className="ocard-role">
          <Icon name={role.icon} size={14} />
          <span>{role.label}</span>
        </span>
        <ReadinessBar stress={officer.stress} />
      </span>
      {note && <span className="ocard-note">{note}</span>}
      {footer}
    </Tag>
  );
}
