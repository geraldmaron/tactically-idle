// Painted plates for the scene pass: one wide scene per call type and one room per tab. The
// plates are atmosphere, never information. Every one sits on a flat gradient, so a missing or
// failed file leaves the layout and the words exactly as they were. Files are listed in
// public/art/plates/manifest.json (readyIds) and checked by scripts/validate-art.mjs.
import { useState } from 'react';
import type { ReactNode } from 'react';
import manifest from '../../../public/art/plates/manifest.json';
import { assetUrl } from './assetUrl';

const READY = new Set<string>(manifest.readyIds);

export type BannerId = 'hq' | 'squad' | 'ops' | 'develop' | 'gear';

/** The URL of a plate when its file is ready, else null. */
export function plateUrl(id: string): string | null {
  return READY.has(id) ? assetUrl(`art/plates/${id}.webp`) : null;
}

/** The scene plate for a call type ('hostage_crisis'), when one is painted. */
export const sceneFor = (type: string | undefined): string | null => type ? plateUrl(`scene_${type}`) : null;

/** A family id as the art names it: the persistence suffixes (`__furnished_v7`, `_g2`, `_v1`) are not places. */
export const placeKey = (familyId: string): string => familyId.replace(/__furnished_v\d+$/, '').replace(/_(g|v)\d+$/, '');

/** The painted exterior of a building family ('bar_restaurant_g2'), when one is ready. */
export const placeFor = (familyId: string | null | undefined): string | null => familyId ? plateUrl(`place_${placeKey(familyId)}`) : null;

/** The painting behind a plate. Decorative: empty alt, never focusable, gone on error. */
export function PlateArt({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return <img className="plate-art" src={src} alt="" aria-hidden="true" decoding="async" draggable={false} onError={() => setFailed(true)} />;
}

/** The painted room at the top of a tab, with its title and a one-line status. */
export function ScreenBanner({ id, kicker, title, line, children }: { id: BannerId; kicker: string; title: string; line?: ReactNode; children?: ReactNode }) {
  return <header className="plate plate-grain screen-banner">
    <PlateArt src={plateUrl(`banner_${id}`)} />
    <span className="screen-banner-kicker">{kicker}</span>
    <h2 className="screen-banner-title">{title}</h2>
    {line && <p className="screen-banner-line">{line}</p>}
    {children}
  </header>;
}

/** The custom properties the skin reads for its textures, set once on the app frame. */
export function textureVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  const paper = plateUrl('tex_night_paper');
  const manila = plateUrl('tex_manila');
  if (paper) vars['--tex-paper'] = `url("${paper}")`;
  if (manila) vars['--tex-manila'] = `url("${manila}")`;
  return vars;
}
