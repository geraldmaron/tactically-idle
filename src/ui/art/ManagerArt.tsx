import { useState } from 'react';
import type { StaffPerson } from '../../sim/staff-pool';
import { Icon } from '../icons';
import { assetUrl } from './assetUrl';

/** The person in (or offered) a Command Staff post. A vacant post has nobody, so it shows an empty
 * silhouette with a lock, never a face. A person whose portrait fails to load shows their initials. */
export function ManagerPortrait({ person, size = 72 }: { person: StaffPerson | null; size?: number }) {
  const [failed, setFailed] = useState<string | null>(null);
  const height = Math.round(size * 1.04 * 100) / 100;
  const painted = !!person && failed !== person.portrait;
  const initials = person ? `${person.firstName[0] ?? ''}${person.surname[0] ?? ''}` : '';
  return <span className={`manager-portrait${person ? '' : ' manager-portrait-locked'}`} style={{ width: size, height }} data-portrait={painted ? 'painted' : 'unavailable'}>
    {painted
      ? <img src={assetUrl(person.portrait)} alt="" width={size} height={height} draggable={false} onError={() => setFailed(person.portrait)} />
      : <span className="manager-portrait-fallback" aria-hidden="true">
        <svg viewBox="0 0 64 66" className="manager-silhouette"><circle cx="32" cy="24" r="12" /><path d="M8 66c1-15 11-23 24-23s23 8 24 23z" /></svg>
        {person ? <span className="manager-initials" style={{ fontSize: Math.max(11, size * 0.22) }}>{initials}</span> : <Icon name="lock" size={Math.max(14, size * 0.22)} />}
      </span>}
  </span>;
}
