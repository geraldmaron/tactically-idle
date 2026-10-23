import type { Officer, SquadId } from '../../sim/types';
import { CERT_NAME } from '../../content/certs';
import { RANKS } from '../../content/ranks';
import { Face } from './Face';
import type { FaceStatus } from './face-status';
import { Ring } from './ui';
import { RankInsignia } from './RankInsignia';
import { officerStatus } from '../screens/squad-model';
import { Icon } from '../icons';
import { CERT_ICON, ROLE_META, STATUS_META } from './labels';
import { officerGrowth } from './OfficerProgress';
import { StatusMark } from '../icons/marks';
import './officer-row.css';

/** "Cpl. Jordan Ellis". */
export const rankedName = (officer: Officer) => `${RANKS[officerGrowth(officer).rank].abbr} ${officer.firstName} ${officer.surname}`;

/** One officer as a row (docs/ui-ux-audit.md, "Officers"): a 40px face, the name by rank with the
 * leader's star, role and stress, the qualifications and the progress to the next rank, and one
 * status at the end. It carries what the portrait tiles carried, in type that holds at 320. */
export function OfficerRow({ officer, now, leader, squadId, faceStatus, onClick }: { officer: Officer; now: number; leader?: boolean; squadId?: SquadId | null; faceStatus?: FaceStatus | null; onClick?: () => void }) {
  const status = officerStatus(officer, now);
  const meta = STATUS_META[status];
  const role = ROLE_META[officer.role];
  const growth = officerGrowth(officer);
  const stress = Math.floor(officer.stress + 1e-9);
  const pct = growth.capped ? 100 : Math.floor(Math.max(0, Math.min(100, growth.progress)));
  const progress = growth.capped ? 'Top rank' : pct > 0 ? `${pct}% to ${RANKS[growth.next!].abbr}` : '';
  const injury = status === 'injured' && officer.injury ? `, ${officer.injury.label}` : '';
  const label = `${rankedName(officer)}, ${role.label}, ${meta.label.toLowerCase()}${injury}, stress ${stress}, ${RANKS[growth.rank].title}${growth.capped ? '' : `, ${Math.floor(growth.progress)}% to ${RANKS[growth.next!].title}`}${squadId ? `, squad ${squadId}` : ''}${leader ? ', squad leader' : ''}${officer.certs.length ? `, ${officer.certs.map((cert) => CERT_NAME[cert]).join(', ')}` : ''}`;
  const Tag = onClick ? 'button' : 'div';
  return <Tag type={onClick ? 'button' : undefined} className={`ui-row officer-row officer-row-${status}`} onClick={onClick} aria-label={label}>
    <span className="ui-row-lead officer-row-face" aria-hidden="true">
      <Face size="sm" kind="officer" officer={officer} status={faceStatus} />
      {squadId && <span className="officer-row-squad">{squadId}</span>}
    </span>
    <span className="ui-row-main" aria-hidden="true">
      <span className="ui-row-title officer-row-name"><Ring value={pct} size={20} tone="level"><RankInsignia rank={growth.rank} size={12} /></Ring><span className="officer-row-surname">{officer.surname}</span>{leader && <Icon name="star" size={14} />}</span>
      <span className="ui-row-detail officer-row-role"><Icon name={role.icon} size={14} />{role.short}{progress ? ` · ${progress}` : ''}</span>
    </span>
    <span className="ui-row-trail officer-row-trail" aria-hidden="true">{officer.certs.length > 0 && <span className="officer-row-certs">{officer.certs.map((cert) => <Icon key={cert} name={CERT_ICON[cert]} size={16} />)}</span>}<StatusMark status={status} /></span>
  </Tag>;
}
