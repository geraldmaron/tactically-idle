import { useState } from 'react';
import manifest from '../../../public/art/gear/manifest.json';
import { Icon, itemIcon } from '../icons';
import { assetUrl } from './assetUrl';

/** Artwork supplements the existing equipment label and semantic icon; it does not alter map rules. */
export function GearArt({ itemId, size = 56 }: { itemId: string; size?: number }) {
  const [failedId, setFailedId] = useState<string | null>(null);
  if (!(manifest.readyIds as string[]).includes(itemId) || failedId === itemId) return <Icon name={itemIcon(itemId)} size={size * .72} strokeWidth={1.5} />;
  return <img src={assetUrl(`art/gear/${itemId}.webp`)} alt="" width={size} height={size} draggable={false} onError={() => setFailedId(itemId)} style={{ display: 'block', width: size, height: size, objectFit: 'contain' }} />;
}
