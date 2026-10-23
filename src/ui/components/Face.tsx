import { useState, type CSSProperties } from 'react';
import type { PortraitProps } from '../portraits/Portrait';
import { currentPortraitKey, portraitSource } from '../portraits/Portrait';
import { Silhouette, type SilhouetteKind } from '../portraits/Silhouette';
import { assetUrl } from '../art/assetUrl';
import { Icon } from '../icons';
import { FACE_MARK_ICON, type FaceStatus } from './face-status';
import './face.css';

/** The three face sizes (--face-sm, --face-md, --face-lg in theme.css). */
export type FaceSize = 'sm' | 'md' | 'lg';
const FACE_PX: Record<FaceSize, number> = { sm: 32, md: 48, lg: 72 };
/** Who the face stands for; it picks the silhouette and the ring color when there is no photograph. */
export type FaceKind = SilhouetteKind;

/** A person's face: the file portrait when there is one, otherwise a silhouette for their role.
 * Never initials. Pass an `officer`, or a `src` (a path under public/), or neither. */
export function Face({ size = 'md', kind = 'person', name, officer, src, className, status, seed, role }: {
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
  /** A person's id: with no photograph the silhouette is drawn the same way for them every time. */
  seed?: string;
  /** The role's own words ("night manager"): the silhouette gets the one cue they name, if any. */
  role?: string | null;
}) {
  // The art to paint: an officer's file portrait, else the given path. A failed load is remembered per
  // source, so a new source tries again; a missing or failed one is the role silhouette, never initials.
  const art = officer ? (() => { const key = currentPortraitKey(officer); return key ? portraitSource(key) : null; })() : src ? assetUrl(src) : null;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const px = FACE_PX[size];
  const painted = !!art && failedSrc !== art;
  if (status) return <span className={`face-status face-status-${size} face-band-${status.band}${status.mark ? ` face-mark-${status.mark}` : ''}`}
    style={{ '--stress': Math.max(0, Math.min(100, status.stress)) } as CSSProperties} role="img" aria-label={name ? `${name}: ${status.label}` : status.label}>
    <Face size={size} kind={kind} officer={officer} src={src} className={className} seed={seed} role={role} />
    {status.mark && <span className="face-badge" aria-hidden="true"><Icon name={FACE_MARK_ICON[status.mark]} size={16} /></span>}
  </span>;
  return <span className={`face face-${size} face-${kind}${className ? ` ${className}` : ''}`} data-face={painted ? (officer ? 'portrait' : 'painted') : 'silhouette'}
    role={name ? 'img' : undefined} aria-label={name} aria-hidden={name ? undefined : true}>
    {painted ? <img key={art} src={art} alt="" width={px} height={px} draggable={false} onError={() => setFailedSrc(art)} />
      : <Silhouette kind={kind} className="face-silhouette" seed={seed} role={role} />}
  </span>;
}
