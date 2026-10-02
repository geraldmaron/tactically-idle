import { useState } from 'react';
import manifest from '../../../public/art/materials/manifest.json';
import { WALLS } from '../../content/materials';
import type { WallMaterial } from '../../sim/types';
import { assetUrl } from './assetUrl';

/** Optional field-reference art. Blueprint hatches and simulation properties remain authoritative. */
export function MaterialGuide() {
  const [failed, setFailed] = useState<string[]>([]);
  const materials = (manifest.readyIds as string[]).filter((id): id is WallMaterial => id in WALLS && !failed.includes(id));
  if (!materials.length) return null;
  return (
    <details className="material-guide">
      <summary>Construction reference</summary>
      <p className="dim">Field samples for recognizing wall materials. Use the plan’s labelled symbols for tactical information.</p>
      <div className="material-guide-grid">
        {materials.map((id) => (
          <figure key={id}>
            <img src={assetUrl(`art/materials/${id}.webp`)} alt="" width="72" height="72" loading="lazy" onError={() => setFailed((old) => [...old, id])} />
            <figcaption>{WALLS[id].label}</figcaption>
          </figure>
        ))}
      </div>
    </details>
  );
}
