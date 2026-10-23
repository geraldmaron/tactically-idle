import { useState } from 'react';
import type { SquadId } from '../../sim/types';
import { assetUrl } from '../art/assetUrl';
import { squadCrest } from '../screens/team-model';

/** A squad's enamel crest (public/art/crests). A missing or failed file falls back to the squad's letter
 * in the same round frame, so the callsign never loses its mark. Decorative: the squad's name sits beside it. */
export function SquadCrest({ id, size = 48 }: { id: SquadId; size?: 40 | 48 | 64 }) {
  const [failed, setFailed] = useState(false);
  return <span className={`squad-crest squad-crest-${size}`} aria-hidden="true">
    {failed
      ? <span className="squad-crest-letter">{id}</span>
      : <img src={assetUrl(squadCrest(id))} alt="" width={size} height={size} draggable={false} onError={() => setFailed(true)} />}
  </span>;
}
