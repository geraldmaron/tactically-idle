import { useContext } from 'react';
import type { ReactNode } from 'react';
import type { Officer, SquadId } from '../../sim/types';
import { Portrait } from '../portraits/Portrait';
import { agePortraitProps } from '../screens/helpers';
import { DepartmentContext } from './department-context';
import { Icon } from '../icons';
import { useWidth } from './hooks';
import { CERT_ICON, ROLE_META, bandOf, BAND_SHORT, STATUS_META } from './labels';
import type { StatusKey } from './labels';
import { ReadinessBar } from './ui';
import { CERT_NAME } from '../../content/certs';
import { officerGrowth } from './OfficerProgress';
import { RankInsignia } from './RankInsignia';
import { Face } from './Face';
import { officerFaceStatus } from './face-status';
import { Ring } from './ui';
import { useGame } from '../store';
import { RANKS } from '../../content/ranks';
import { StatusMark } from '../icons/marks';

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
  // The department dates the portrait's age; without one (outside the game) the portrait is unaged.
  const department = useContext(DepartmentContext);
  const age = department ? agePortraitProps({ department }, officer, now) : {};
  const [ref, w] = useWidth<HTMLSpanElement>(80);
  const g = useGame();
  const faceStatus = officerFaceStatus(g, officer.id, now);
  const band = bandOf(officer);
  const injured = !!incidentInjury || (!!officer.injury && officer.injury.until > now);
  const trainingOrDeployed: StatusKey | null =
    variant !== 'strip' && !injured ? (officer.assignment?.kind === 'training' ? 'training' : officer.assignment?.kind === 'detail' ? 'detail' : officer.assignment?.kind === 'operation' ? 'deployed' : null) : null;
  const statusKey: StatusKey | null = injured ? 'injured' : trainingOrDeployed ? trainingOrDeployed : band === 'ready' ? null : band;
  const status = statusKey ? STATUS_META[statusKey] : null;
  const role = ROLE_META[officer.role];
  const size = Math.max(40, w);
  const Tag = onClick ? 'button' : 'div';
  if (variant === 'tile') {
    const statusText = incidentInjury ? `injured: ${incidentInjury}` : status ? status.label.toLowerCase() : BAND_SHORT[band].toLowerCase();
    const certs = officer.certs.slice(0, 3);
    // The character-card badge (squad-cards, officer-ranks): the rank insignia, its ring the XP
    // toward the next rank, the same numbers as the profile. The name carries the rank's short form.
    const growth = officerGrowth(officer);
    const xp = growth.capped ? 100 : Math.max(0, Math.min(100, growth.progress));
    const growthText = `, ${RANKS[growth.rank].title}${growth.capped ? '' : `, ${Math.floor(xp)}% to ${RANKS[growth.next!].title}`}`;
    return (
      <Tag
        type={onClick ? 'button' : undefined}
        className={`ocard ocard-tile${selected ? ' ocard-on' : ''}${statusKey ? ` ocard-tile-${statusKey}` : ''}`}
        onClick={onClick}
        aria-pressed={onClick && selected !== undefined ? selected : undefined}
        aria-label={`${officer.firstName} ${officer.surname}, ${role.label}, ${statusText}, stress ${Math.floor(officer.stress + 1e-9)}${growthText}${squadId ? `, squad ${squadId}` : ''}${leader ? ', squad leader' : ''}${officer.certs.length ? `, ${officer.certs.map((cert) => CERT_NAME[cert]).join(', ')}` : ''}`}
      >
        <span className="ocard-face" aria-hidden="true"><Face size="sm" kind="officer" officer={officer} status={faceStatus} />{leader && <span className="ocard-star"><Icon name="star" size={12} /></span>}</span>
        <span className="ocard-body" aria-hidden="true">
          <span className="ocard-title"><Ring value={xp} size={20} tone="level"><RankInsignia rank={growth.rank} size={12} /></Ring><span className="ocard-surname">{officer.surname}</span>{squadId && <span className="ocard-squad">{squadId}</span>}</span>
          <span className="ocard-role"><Icon name={role.icon} size={14} />{role.short}</span>
          <span className="ocard-condition"><StatusMark status={statusKey ?? 'ready'} />{certs.length > 0 && <span className="ocard-certs">{certs.map((cert) => <Icon key={cert} name={CERT_ICON[cert]} size={12} />)}</span>}</span>
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
        <Portrait officer={officer} size={size} {...age} />
        {chip && <span className="ocard-chip">{chip}</span>}
        {status && statusKey && (
          <span className={`ocard-status band-${injured ? 'recovery' : statusKey === 'training' || statusKey === 'detail' || statusKey === 'deployed' ? 'strained' : statusKey}`}>
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
