import { useState } from 'react';
import manifest from '../../../public/art/emblems/manifest.json';
import { Icon, type IconName } from '../icons';
import { assetUrl } from './assetUrl';

/** Emblem ids: a course id, or branch_<id> for a development branch (checked by scripts/validate-art.mjs). */
export const branchEmblemId = (branch: string): string => `branch_${branch}`;

/** Painted course or branch emblem when the art set lists it as ready; otherwise the given icon. */
export function EmblemArt({ id, icon, size = 40, iconSize = Math.round(size * 0.55) }: { id: string; icon: IconName; size?: number; iconSize?: number }) {
  const [failedId, setFailedId] = useState<string | null>(null);
  if (!(manifest.readyIds as string[]).includes(id) || failedId === id) return <Icon name={icon} size={iconSize} />;
  return <img src={assetUrl(`art/emblems/${id}.webp`)} alt="" width={size} height={size} draggable={false} onError={() => setFailedId(id)} style={{ display: 'block', width: size, height: size, objectFit: 'contain' }} />;
}
