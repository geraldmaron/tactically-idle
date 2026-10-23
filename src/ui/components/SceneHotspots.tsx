// SceneHotspots: tappable places over a painted plate (station rebuild, "a place"). Each hotspot is a real
// button placed by percent of the plate, at least 44px to hit, named for assistive technology with its
// state. Lit and dark are drawn as a glow or a shade over the painting, so the scene works before any
// per-room art exists; a hotspot's own `image` drops in over its area when that art is commissioned,
// and a missing or failed file leaves the glow or shade as it was.
//
// DOM order is tab order: list the hotspots top to bottom, left to right. The plate is decorative; the
// buttons carry the meaning. The ready pulse runs twice and stops, and not at all under reduced motion.
import { useState } from 'react';
import { PlateArt, plateUrl } from '../art/Plates';
import { assetUrl } from '../art/assetUrl';
import './scene-hotspots.css';

/** lit: in use. dark: not yet (locked, unbuilt). ready: can be taken now. */
export type HotspotState = 'lit' | 'dark' | 'ready';

export interface Hotspot {
  id: string;
  /** The place, as a screen reader says it: 'Training academy'. */
  label: string;
  state: HotspotState;
  /** Where the place sits on the plate, in percent of its width and height from the top left. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** The state in words when the default does not fit ('Locked until level 3'); read aloud with the label. */
  status?: string;
  /** Commissioned art for the place, a path under public/. Painted over the glow or shade when it loads. */
  image?: string | null;
  onSelect: () => void;
}

export const HOTSPOT_STATUS: Record<HotspotState, string> = { lit: 'open', dark: 'not built', ready: 'ready to build' };

/** What a hotspot is called aloud. */
export const hotspotName = (spot: Pick<Hotspot, 'label' | 'state' | 'status'>): string => `${spot.label}, ${spot.status ?? HOTSPOT_STATUS[spot.state]}`;

const pct = (n: number) => `${Math.max(0, Math.min(100, n))}%`;

function SpotImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <img className="scene-spot-img" src={assetUrl(src)} alt="" aria-hidden="true" decoding="async" draggable={false} onError={() => setFailed(true)} />;
}

export function SceneHotspots({ plate, hotspots, label, aspect = '16 / 9', names = true }: {
  /** A plate id from public/art/plates/manifest.json ('hub_hq'). A plate that is not ready leaves the flat tone. */
  plate: string;
  hotspots: readonly Hotspot[];
  /** Names the group: 'Station'. */
  label: string;
  /** CSS aspect-ratio of the plate. */
  aspect?: string;
  /** Draw each place's name on it. Off, the names stay in the accessible labels only. */
  names?: boolean;
}) {
  return <div className="scene" style={{ aspectRatio: aspect }}>
    <PlateArt src={plateUrl(plate)} />
    <ul className="scene-spots" aria-label={label}>
      {hotspots.map((spot) => <li key={spot.id} className="scene-spot-box" style={{ left: pct(spot.x), top: pct(spot.y), width: pct(spot.w), height: pct(spot.h) }}>
        <button type="button" className={`scene-spot scene-spot-${spot.state}`} aria-label={hotspotName(spot)} onClick={spot.onSelect}>
          <span className="scene-spot-fill" aria-hidden="true" />
          {spot.image && <SpotImage src={spot.image} />}
          {names && <span className="scene-spot-name" aria-hidden="true">{spot.label}</span>}
        </button>
      </li>)}
    </ul>
  </div>;
}
