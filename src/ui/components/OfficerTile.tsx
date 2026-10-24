import type { Officer, SquadId } from '../../sim/types';
import { CERT_NAME } from '../../content/certs';
import { RANKS } from '../../content/ranks';
import { Icon } from '../icons';
import { StatusMark } from '../icons/marks';
import { Portrait } from '../portraits/Portrait';
import { agePortraitProps } from '../screens/helpers';
import { tileStatus } from '../screens/team-model';
import { turnedLine } from '../people/story-line';
import { useStoryClock } from '../people/story-clock';
import { useContext } from 'react';
import { DepartmentContext } from './department-context';
import { CERT_ICON, ROLE_META, STATUS_META } from './labels';
import { officerGrowth } from './OfficerProgress';
import { RankInsignia } from './RankInsignia';
import { Ring } from './ui';
import { useWidth } from './hooks';
import type { FaceStatus } from './face-status';
import './officer-tile.css';

/** One officer as a person first (station rebuild, compacted on the canvas pass 2026-10-24): a portrait big
 * enough to read, the rank ring, surname and role over its foot, the stress bar, and a status flag only when
 * they are not simply ready. Tiles stay two to a row. The whole tile opens the officer's sheet, which keeps
 * the personal lines. */
export function OfficerTile({ officer, now, faceStatus, leader, squadId, onClick }: {
  officer: Officer; now: number; faceStatus?: FaceStatus | null; leader?: boolean; squadId?: SquadId | null; onClick?: () => void;
}) {
  const department = useContext(DepartmentContext);
  const age = department ? agePortraitProps({ department }, officer, now) : {};
  const [ref, width] = useWidth<HTMLSpanElement>(160);
  const clock = useStoryClock();
  const status = tileStatus(officer, now);
  const growth = officerGrowth(officer);
  const role = ROLE_META[officer.role];
  const stress = Math.floor(officer.stress + 1e-9);
  // The rank badge (officer-ranks): the insignia, its ring the XP toward the next rank, the same numbers as the profile.
  const xp = growth.capped ? 100 : Math.max(0, Math.min(100, growth.progress));
  const growthText = `${RANKS[growth.rank].title}${growth.capped ? '' : `, ${Math.floor(xp)}% to ${RANKS[growth.next!].title}`}`;
  const person = { kind: 'officer', officer, status: faceStatus ?? null } as const;
  // The tile is compact (canvas Team): the personal line is spoken in the label and shown in the sheet,
  // not drawn on the tile. The highest-priority line is fixed so it never changes under a screen reader's cursor.
  const spoken = turnedLine(person, clock.now, true);
  const certs = officer.certs.slice(0, 3);
  const Tag = onClick ? 'button' : 'div';
  const label = `${officer.firstName} ${officer.surname}, ${role.label}, ${status ? STATUS_META[status].label.toLowerCase() : 'ready'}, stress ${stress}, ${growthText}${squadId ? `, squad ${squadId}` : ''}${leader ? ', squad leader' : ''}${officer.certs.length ? `, ${officer.certs.map((cert) => CERT_NAME[cert]).join(', ')}` : ''}${spoken ? `. ${spoken.text}` : ''}`;
  return <Tag type={onClick ? 'button' : undefined} className={`ocard ocard-tile otile${status ? ` otile-${status}` : ''}`} onClick={onClick} aria-label={label} data-officer-tile={officer.id}>
    <span className="otile-art" ref={ref} aria-hidden="true">
      <Portrait officer={officer} size={Math.max(96, width)} {...age} />
      {leader && <span className="otile-lead"><Icon name="star" size={16} />Lead</span>}
      {status && <span className="otile-flag"><StatusMark status={status} /></span>}
      {squadId && <span className="otile-squad">{squadId}</span>}
      <span className="otile-stress" data-band={faceStatus?.band ?? 'ready'} style={{ ['--stress' as string]: Math.max(0, Math.min(100, officer.stress)) }} />
      <span className="otile-name"><span className="otile-title"><Ring value={xp} size={20} tone="level"><RankInsignia rank={growth.rank} size={12} /></Ring><span className="otile-surname">{officer.surname}</span></span><span className="otile-role"><Icon name={role.icon} size={16} />{role.short}{certs.map((cert) => <Icon key={cert} name={CERT_ICON[cert]} size={16} />)}</span></span>
    </span>
  </Tag>;
}
