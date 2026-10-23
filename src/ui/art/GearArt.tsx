import { useState } from 'react';
import manifest from '../../../public/art/gear/manifest.json';
import { Icon, itemIcon } from '../icons';
import { assetUrl } from './assetUrl';
import './art.css';

/** Artwork supplements the existing equipment label and semantic icon; it does not alter map rules.
 * Without a painting the kit icon stands in, on the same round enamel as the emblems, so a list of
 * gear never shows bare line art beside photographs. */
export function GearArt({ itemId, size = 56 }: { itemId: string; size?: number }) {
  const [failedId, setFailedId] = useState<string | null>(null);
  if (!(manifest.readyIds as string[]).includes(itemId) || failedId === itemId) {
    const name = itemIcon(itemId);
    return <span className="art-fallback" aria-hidden="true" style={{ width: size, height: size }}>{size >= 56 ? <Icon name={name} size="lg" /> : size >= 32 ? <Icon name={name} size="md" /> : <Icon name={name} size="sm" />}</span>;
  }
  return <img src={assetUrl(`art/gear/${itemId}.webp`)} alt="" width={size} height={size} draggable={false} onError={() => setFailedId(itemId)} style={{ display: 'block', width: size, height: size, objectFit: 'contain' }} />;
}

/** Inventory and procurement show the same blueprint frame at every artwork size. */
export function GearArtFrame({ itemId, size = 56 }: { itemId: string; size?: number }) {
  return <span className="gear-art-frame" aria-hidden="true" style={{ width: size + 12, height: size + 12 }}><GearArt itemId={itemId} size={size} /></span>;
}
