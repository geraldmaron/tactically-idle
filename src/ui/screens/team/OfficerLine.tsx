import { Face } from '../../components/Face';
import { Icon } from '../../icons';
import type { Officer } from '../../../sim/types';
import { BAND_TONE, type OfficerRowView } from './team-view';
import './team-room.css';

/** One officer as a row of the squad room (canvas E1): the portrait, the name with the role in mono, one note, and
 * the stress band with its bar. The band is the one number on a roll, so it is the only number on the row. */
export function OfficerLine({ view, officer, squadId, onOpen, actionLabel }: { view: OfficerRowView; officer: Officer; squadId?: string | null; onOpen?: () => void; actionLabel?: string }) {
  const tone = BAND_TONE[view.band];
  const label = `${view.fullName}, ${view.role.toLowerCase()}${squadId ? `, squad ${squadId}` : ''}${view.leader ? ', leads' : ''}. ${view.note.text}. ${view.bandCaption.toLowerCase()}`;
  const Tag = onOpen ? 'button' : 'div';
  return <Tag type={onOpen ? 'button' : undefined} className={`trow${view.away ? ' trow-away' : ''}`} data-officer={view.id} onClick={onOpen} aria-label={actionLabel ? `${actionLabel}. ${label}` : label}>
    <Face size="md" kind="officer" officer={officer} className="trow-face" />
    <span className="trow-main">
      <span className="trow-name"><b>{view.surname}</b><span className="trow-role">{view.role}{squadId ? ` · ${squadId}` : ''}</span>{view.leader && <Icon name="star" size={14} />}</span>
      <span className={`trow-note trow-note-${view.note.tone}`}>{view.note.text}</span>
    </span>
    <span className="trow-band" data-tone={tone}>
      <span className="trow-band-word">{view.bandCaption}</span>
      <span className="trow-bar" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, view.stress))}%` }} /></span>
    </span>
  </Tag>;
}
