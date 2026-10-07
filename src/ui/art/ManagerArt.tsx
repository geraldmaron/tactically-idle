import { useState } from 'react';
import manifest from '../../../public/art/managers/manifest.json';
import type { ManagerId } from '../../sim/command-staff';
import { MANAGERS } from '../../sim/command-staff';
import { Icon } from '../icons';
import { assetUrl } from './assetUrl';

/** Painted portrait when the art set lists it as ready; otherwise initials (hired) or a locked silhouette. */
export function ManagerPortrait({ id, size = 72, hired }: { id: ManagerId; size?: number; hired: boolean }) {
  const [failedId, setFailedId] = useState<ManagerId | null>(null);
  const profile = MANAGERS[id];
  const height = Math.round(size * (manifest.height / manifest.width) * 100) / 100;
  const painted = (manifest.readyIds as string[]).includes(id) && failedId !== id;
  const initials = profile.name.split(' ').map((part) => part[0]).join('').slice(0, 2);
  return <span className={`manager-portrait${hired ? '' : ' manager-portrait-locked'}`} style={{ width: size, height }} data-portrait={painted ? 'painted' : 'unavailable'}>
    {painted
      ? <img src={assetUrl(`art/managers/${id}.webp`)} alt="" width={size} height={height} draggable={false} onError={() => setFailedId(id)} />
      : <span className="manager-portrait-fallback" aria-hidden="true">
        <svg viewBox="0 0 64 66" className="manager-silhouette"><circle cx="32" cy="24" r="12" /><path d="M8 66c1-15 11-23 24-23s23 8 24 23z" /></svg>
        {hired ? <span className="manager-initials" style={{ fontSize: Math.max(11, size * 0.22) }}>{initials}</span> : <Icon name="lock" size={Math.max(14, size * 0.22)} />}
      </span>}
  </span>;
}
