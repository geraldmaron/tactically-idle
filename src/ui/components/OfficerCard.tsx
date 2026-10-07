import type { ReactNode } from 'react';
import type { Officer, SquadId } from '../../sim/types';
import { Portrait } from '../portraits/Portrait';
import { useGame } from '../store';
import { agePortraitProps } from '../screens/helpers';
import { Icon } from '../icons';
import { useWidth } from './hooks';
import { CERT_ICON, CERT_LABEL, ROLE_META, bandOf, BAND_SHORT, STATUS_META } from './labels';
import type { StatusKey } from './labels';
import { ReadinessBar } from './ui';

export interface OfficerCardProps {
  officer: Officer;
  now: number;
  /** `tile` is the dense roster grid: portrait, role icon, stress and qualification pips. */
  variant?: 'strip' | 'roster' | 'tile';
  /** Tile only: show the officer's squad letter (null shows nothing). */
  squadId?: SquadId | null;
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
  /** The injury recorded for this officer in the current operation. */
  incidentInjury?: string;
}

/** Portrait card from the approved reference: portrait, SURNAME, role icon + label, readiness bar. */
export function OfficerCard({ officer, now, variant = 'strip', selected, onClick, chip, footer, leader, note, incidentInjury, squadId }: OfficerCardProps) {
  const g = useGame();
  const [ref, w] = useWidth<HTMLSpanElement>(80);
  const band = bandOf(officer);
  const injured = !!incidentInjury || (!!officer.injury && officer.injury.until > now);
  const trainingOrDeployed: StatusKey | null =
    variant !== 'strip' && !injured ? (officer.assignment?.kind === 'training' ? 'training' : officer.assignment?.kind === 'operation' ? 'deployed' : null) : null;
  const statusKey: StatusKey | null = injured ? 'injured' : trainingOrDeployed ? trainingOrDeployed : band === 'ready' ? null : band;
  const status = statusKey ? STATUS_META[statusKey] : null;
  const role = ROLE_META[officer.role];
  const size = Math.max(40, w);
  const Tag = onClick ? 'button' : 'div';
  if (variant === 'tile') {
    const statusText = incidentInjury ? `injured: ${incidentInjury}` : status ? status.label.toLowerCase() : BAND_SHORT[band].toLowerCase();
    const certs = officer.certs.slice(0, 3);
    return (
      <Tag
        type={onClick ? 'button' : undefined}
        className={`ocard ocard-tile${selected ? ' ocard-on' : ''}${statusKey ? ` ocard-tile-${statusKey}` : ''}`}
        onClick={onClick}
        aria-pressed={onClick && selected !== undefined ? selected : undefined}
        aria-label={`${officer.firstName} ${officer.surname}, ${role.label}, ${statusText}, stress ${Math.floor(officer.stress + 1e-9)}${squadId ? `, squad ${squadId}` : ''}${leader ? ', squad leader' : ''}${officer.certs.length ? `, ${officer.certs.map((cert) => CERT_LABEL[cert]).join(', ')}` : ''}`}
      >
        <span className="ocard-art" ref={ref} style={{ aspectRatio: '1 / 1.04' }}>
          <Portrait officer={officer} size={size} {...agePortraitProps(g, officer, now)} />
          {squadId && <span className="ocard-squad" aria-hidden="true">{squadId}</span>}
          {status && statusKey && (
            <span className={`ocard-state ocard-state-${status.tone}`} aria-hidden="true" title={status.label}>
              <Icon name={status.icon} size={11} />
            </span>
          )}
          {leader && <span className="ocard-leader" aria-hidden="true"><Icon name="star" size={11} /></span>}
          <span className="ocard-name">{officer.surname}</span>
        </span>
        <span className="ocard-row" aria-hidden="true">
          <span className="ocard-role" title={role.label}><Icon name={role.icon} size={13} /></span>
          {certs.length > 0 && <span className="ocard-certs">{certs.map((cert) => <Icon key={cert} name={CERT_ICON[cert]} size={11} />)}{officer.certs.length > certs.length && <b>+{officer.certs.length - certs.length}</b>}</span>}
          <ReadinessBar stress={officer.stress} />
        </span>
        {footer}
      </Tag>
    );
  }
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`ocard ocard-${variant}${selected ? ' ocard-on' : ''}${incidentInjury ? ' ocard-casualty' : note ? ' ocard-dim' : ''}`}
      onClick={onClick}
      aria-pressed={onClick && selected !== undefined ? selected : undefined}
      aria-label={`${officer.firstName} ${officer.surname}, ${role.label}, ${incidentInjury ? `injured: ${incidentInjury}, out of action` : injured ? 'injured' : BAND_SHORT[band]}`}
    >
      <span className="ocard-art" ref={ref} style={variant === 'roster' ? { aspectRatio: '1 / 1.04', maxHeight: 124 } : { height: Math.round(size * 1.04) }}>
        <Portrait officer={officer} size={size} {...agePortraitProps(g, officer, now)} />
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
          <span>{variant === 'strip' ? role.short : role.label}</span>
        </span>
        <ReadinessBar stress={officer.stress} />
      </span>
      {note && <span className="ocard-note">{note}</span>}
      {footer}
    </Tag>
  );
}
