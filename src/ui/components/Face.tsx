import { useState, type CSSProperties } from 'react';
import type { PortraitProps } from '../portraits/Portrait';
import { Portrait } from '../portraits/Portrait';
import { assetUrl } from '../art/assetUrl';
import { Icon } from '../icons';
import { FACE_MARK_ICON, type FaceStatus } from './face-status';
import './face.css';

/** The three face sizes (--face-sm, --face-md, --face-lg in theme.css). */
export type FaceSize = 'sm' | 'md' | 'lg';
const FACE_PX: Record<FaceSize, number> = { sm: 32, md: 48, lg: 72 };
/** Who the face stands for; it picks the silhouette and the ring color when there is no photograph. */
export type FaceKind = 'officer' | 'subject' | 'civilian' | 'person' | 'patrol';

/** A person's face: the file portrait when there is one, otherwise a silhouette for their role.
 * Never initials. Pass an `officer`, or a `src` (a path under public/), or neither. */
export function Face({ size = 'md', kind = 'person', name, officer, src, className, status }: {
  size?: FaceSize;
  kind?: FaceKind;
  /** Read by screen readers only when the face carries meaning; the face is decorative otherwise. */
  name?: string;
  officer?: PortraitProps['officer'];
  src?: string;
  className?: string;
  /** An officer's condition: a stress ring around the face and a corner badge for why they are not
   * simply ready (sim state through face-status.ts). The face then carries meaning, so it is named. */
  status?: FaceStatus | null;
}) {
  const [failed, setFailed] = useState(false);
  const px = FACE_PX[size];
  const painted = !officer && !!src && !failed;
  if (status) return <span className={`face-status face-status-${size} face-band-${status.band}${status.mark ? ` face-mark-${status.mark}` : ''}`}
    style={{ '--stress': Math.max(0, Math.min(100, status.stress)) } as CSSProperties} role="img" aria-label={name ? `${name}: ${status.label}` : status.label}>
    <Face size={size} kind={kind} officer={officer} src={src} className={className} />
    {status.mark && <span className="face-badge" aria-hidden="true"><Icon name={FACE_MARK_ICON[status.mark]} size={16} /></span>}
  </span>;
  return <span className={`face face-${size} face-${kind}${className ? ` ${className}` : ''}`} data-face={officer ? 'portrait' : painted ? 'painted' : 'silhouette'}
    role={name ? 'img' : undefined} aria-label={name} aria-hidden={name ? undefined : true}>
    {officer ? <Portrait officer={officer} size={px} />
      : painted ? <img src={assetUrl(src)} alt="" width={px} height={px} draggable={false} onError={() => setFailed(true)} />
        : <Silhouette kind={kind} />}
  </span>;
}

/** Head and shoulders, with what marks the role: a cap brim for officers, a hood for the subject. */
function Silhouette({ kind }: { kind: FaceKind }) {
  return <svg className="face-silhouette" viewBox="0 0 64 64" aria-hidden="true">
    {kind === 'subject' ? <path d="M32 8c-9 0-15 6-15 15v4h30v-4c0-9-6-15-15-15z" /> : null}
    <circle cx="32" cy="26" r="11" />
    {kind === 'officer' || kind === 'patrol' ? <path d="M19 22c1-9 7-13 13-13s12 4 13 13z M17 22h30v3H17z" /> : null}
    <path d="M8 64c1-14 10-22 24-22s23 8 24 22z" />
  </svg>;
}
