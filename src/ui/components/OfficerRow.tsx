import { useContext } from 'react';
import type { Officer, SquadId } from '../../sim/types';
import { CERT_NAME } from '../../content/certs';
import { RANKS } from '../../content/ranks';
import { Portrait } from '../portraits/Portrait';
import { agePortraitProps } from '../screens/helpers';
import { officerStatus } from '../screens/squad-model';
import { DepartmentContext } from './department-context';
import { Icon } from '../icons';
import { CERT_ICON, ROLE_META, STATUS_META } from './labels';
import { officerGrowth } from './OfficerProgress';
import { Chip } from './ui';
import './officer-row.css';

/** "Cpl. Ellis": the short form rows use. The sheet uses the full name by rank. */
export const rankedSurname = (officer: Officer) => `${RANKS[officerGrowth(officer).rank].abbr} ${officer.surname}`;
/** "Cpl. Jordan Ellis". */
export const rankedName = (officer: Officer) => `${RANKS[officerGrowth(officer).rank].abbr} ${officer.firstName} ${officer.surname}`;

/** One officer as a row (docs/ui-ux-audit.md, "Officers"): a 40px face, the name by rank with the
 * leader's star, role and stress, the qualifications and the progress to the next rank, and one
 * status at the end. It carries what the portrait tiles carried, in type that holds at 320. */
export function OfficerRow({ officer, now, leader, squadId, onClick }: { officer: Officer; now: number; leader?: boolean; squadId?: SquadId | null; onClick?: () => void }) {
  const department = useContext(DepartmentContext);
  const age = department ? agePortraitProps({ department }, officer, now) : {};
  const status = officerStatus(officer, now);
  const meta = STATUS_META[status];
  const role = ROLE_META[officer.role];
  const growth = officerGrowth(officer);
  const stress = Math.floor(officer.stress + 1e-9);
  const progress = growth.capped ? 'Top rank' : `${Math.floor(Math.max(0, Math.min(100, growth.progress)))}% to ${RANKS[growth.next!].abbr}`;
  const injury = status === 'injured' && officer.injury ? `, ${officer.injury.label}` : '';
  const label = `${rankedName(officer)}, ${role.label}, ${meta.label.toLowerCase()}${injury}, stress ${stress}, ${RANKS[growth.rank].title}${growth.capped ? '' : `, ${Math.floor(growth.progress)}% to ${RANKS[growth.next!].title}`}${squadId ? `, squad ${squadId}` : ''}${leader ? ', squad leader' : ''}${officer.certs.length ? `, ${officer.certs.map((cert) => CERT_NAME[cert]).join(', ')}` : ''}`;
  const Tag = onClick ? 'button' : 'div';
  return <Tag type={onClick ? 'button' : undefined} className={`ui-row officer-row officer-row-${status}`} onClick={onClick} aria-label={label}>
    <span className="ui-row-lead officer-row-face" aria-hidden="true">
      <Portrait officer={officer} size={40} {...age} />
      {squadId && <span className="officer-row-squad">{squadId}</span>}
    </span>
    <span className="ui-row-main" aria-hidden="true">
      <span className="ui-row-title officer-row-name">{rankedSurname(officer)}{leader && <Icon name="star" size={14} />}</span>
      <span className="ui-row-detail">{role.label} · stress {stress}</span>
      <span className="officer-row-meta">
        {officer.certs.length > 0 && <span className="officer-row-certs">{officer.certs.map((cert) => <Icon key={cert} name={CERT_ICON[cert]} size={16} />)}</span>}
        <span>{progress}</span>
      </span>
    </span>
    <span className="ui-row-trail" aria-hidden="true"><Chip tone={status === 'strained' ? 'warn' : meta.tone}>{meta.label}</Chip></span>
  </Tag>;
}
