// Painted call-type medallions to match the scene plates (docs/art/medallions/README.md): one round
// disc per call type, listed in public/art/medallions/manifest.json and checked by
// scripts/validate-art.mjs. They are for hero sizes; CallTypeBadge draws its SVG below MEDALLION_MIN.
import { useState } from 'react';
import manifest from '../../../public/art/medallions/manifest.json';
import { assetUrl } from './assetUrl';

const READY = new Set<string>(manifest.readyIds);

/** The smallest edge, in px, where the painted scene still reads (checked at 40px in the README). */
export const MEDALLION_MIN = 40;

/** The URL of a call type's medallion when its file is ready, else null. */
export const medallionUrl = (type: string | null | undefined): string | null => type && READY.has(type) ? assetUrl(`art/medallions/${type}.webp`) : null;

/** The painting. Decorative: empty alt, gone on error so the caller's fallback shows. */
export function MedallionImage({ src, size, onFail }: { src: string; size: number; onFail: () => void }) {
  return <img className="ct-medallion" src={src} width={size} height={size} alt="" aria-hidden="true" decoding="async" draggable={false} onError={onFail} />;
}

/** Whether a painted medallion should replace the SVG badge at this size. */
export function useMedallion(type: string | null | undefined, size: number, wanted: boolean) {
  const [failed, setFailed] = useState(false);
  const src = wanted && size >= MEDALLION_MIN && !failed ? medallionUrl(type) : null;
  return { src, fail: () => setFailed(true) };
}
