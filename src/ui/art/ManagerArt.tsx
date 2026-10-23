import { useState } from 'react';
import type { StaffPerson } from '../../sim/staff-pool';
import { Icon, type IconName } from '../icons';
import { Silhouette } from '../portraits/Silhouette';
import { assetUrl } from './assetUrl';
import './art.css';

/** The person in (or offered) a Command Staff post. A vacant post has nobody, so it shows an empty
 * silhouette with a lock, never a face. A person whose portrait fails to load shows the silhouette
 * alone, never initials: the post's own row names them. */
/** `emptyIcon`: an empty seat shows what the post does instead of a lock. */
export function ManagerPortrait({ person, size = 72, emptyIcon }: { person: StaffPerson | null; size?: number; emptyIcon?: IconName }) {
  const [failed, setFailed] = useState<string | null>(null);
  const height = Math.round(size * 1.04 * 100) / 100;
  const painted = !!person && failed !== person.portrait;
  const seat = emptyIcon ?? 'lock';
  return <span className={`manager-portrait${person ? '' : ' manager-portrait-locked'}`} style={{ width: size, height }} data-portrait={painted ? 'painted' : 'unavailable'}>
    {painted
      ? <img src={assetUrl(person.portrait)} alt="" width={size} height={height} draggable={false} onError={() => setFailed(person.portrait)} />
      : <span className="manager-portrait-stand-in" aria-hidden="true">
        <Silhouette kind="person" />
        {person ? null : size >= 80 ? <Icon name={seat} size="lg" /> : size >= 52 ? <Icon name={seat} size="md" /> : <Icon name={seat} size="sm" />}
      </span>}
  </span>;
}
