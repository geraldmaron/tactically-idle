// Empty-state spot illustrations in the night-shift style: a dark station at night, chalk line work,
// blueprint blue through the glass and one warm light. Amber appears only where the empty state
// is the player's move (the open squad slot). Decorative: the screen supplies the words.
import type { ReactNode } from 'react';
import './kit.css';

export type SpotName = 'noCalls' | 'noDebriefs' | 'noCandidates' | 'nothingInStock' | 'openSlot';

const FLOOR = <rect className="sp-floor" x="8" y="94" width="144" height="2" rx="1" />;

const SPOTS: Record<SpotName, ReactNode> = {
  // A quiet dispatch desk: the radio on standby with a flat trace, coffee, the moon in the window.
  noCalls: (
    <>
      <rect className="sp-window" x="100" y="12" width="44" height="36" rx="3" />
      <path className="sp-line" d="M122 12v36M100 30h44" />
      <path className="sp-moon" d="M137.5 17.5a6 6 0 1 0 4.5 9.5 5 5 0 0 1-4.5-9.5z" />
      <rect className="sp-desk" x="16" y="84" width="128" height="8" rx="2" />
      <ellipse className="sp-glow" cx="42" cy="78" rx="16" ry="9" />
      <path className="sp-ink" d="M38 56V40" />
      <circle className="sp-ink" cx="38" cy="38.5" r="1.5" />
      <rect className="sp-panel" x="28" y="56" width="56" height="28" rx="4" />
      <rect className="sp-screen" x="34" y="62" width="28" height="12" rx="2" />
      <path className="sp-ink" d="M37 68h22" />
      <circle className="sp-ink" cx="73" cy="66" r="3" />
      <circle className="sp-ink" cx="73" cy="76" r="3" />
      <circle className="sp-led" cx="40" cy="79" r="1.8" />
      <path className="sp-panel" d="M98 66h14v14a4 4 0 0 1-4 4h-6a4 4 0 0 1-4-4z" />
      <path className="sp-ink" d="M112 70h2a3 3 0 0 1 0 6h-2" />
      <path className="sp-ink sp-thin" d="M102 58c-1.5 2 1.5 3 0 5M108 55c-1.5 2 1.5 3 0 5" />
      {FLOOR}
    </>
  ),
  // An empty in-tray under the desk lamp, one dashed card where the first debrief will sit.
  noDebriefs: (
    <>
      <path className="sp-glow" d="M58 42l-10 46h84z" />
      <rect className="sp-desk" x="16" y="88" width="128" height="6" rx="2" />
      <rect className="sp-panel" x="20" y="82" width="22" height="6" rx="2" />
      <path className="sp-ink" d="M31 82V52l20-16" />
      <path className="sp-panel" d="M46 30l18 3-5 11z" />
      <rect className="sp-dash" x="78" y="56" width="44" height="18" rx="2" />
      <path className="sp-panel" d="M64 70h72l-6 18H70z" />
      <path className="sp-line" d="M69 75h62" />
      {FLOOR}
    </>
  ),
  // The interview room: an empty chair, a blank clipboard, light under the door.
  noCandidates: (
    <>
      <rect className="sp-panel" x="18" y="20" width="34" height="72" rx="2" />
      <circle className="sp-ink" cx="46" cy="58" r="2" />
      <ellipse className="sp-glow" cx="35" cy="94" rx="20" ry="3" />
      <rect className="sp-panel" x="78" y="40" width="30" height="28" rx="4" />
      <rect className="sp-panel" x="74" y="66" width="38" height="8" rx="3" />
      <path className="sp-ink" d="M80 74v20M106 74v20" />
      <path className="sp-ink" d="M118 70h30M122 70v24M144 70v24" />
      <rect className="sp-paper" x="124" y="48" width="18" height="22" rx="2" />
      <rect className="sp-ink-fill" x="129" y="46" width="8" height="4" rx="1" />
      <path className="sp-dash-thin" d="M128 56h10M128 60h10M128 64h6" />
      {FLOOR}
    </>
  ),
  // Armory shelving with dashed outlines where the kit used to sit, and an open, empty crate.
  nothingInStock: (
    <>
      <path className="sp-line" d="M24 16v78M136 16v78" />
      <rect className="sp-panel" x="24" y="40" width="112" height="4" rx="1" />
      <rect className="sp-panel" x="24" y="66" width="112" height="4" rx="1" />
      <rect className="sp-dash" x="34" y="22" width="22" height="18" rx="2" />
      <rect className="sp-dash" x="64" y="27" width="30" height="13" rx="2" />
      <rect className="sp-dash" x="104" y="20" width="12" height="20" rx="2" />
      <rect className="sp-dash" x="38" y="49" width="26" height="17" rx="2" />
      <circle className="sp-dash" cx="84" cy="57" r="8" />
      <path className="sp-panel" d="M96 78h40v16H96z" />
      <path className="sp-panel" d="M96 78l-6-8h40l6 8" />
      <path className="sp-line" d="M100 86h32" />
      {FLOOR}
    </>
  ),
  // Two filled places on the squad board and one open, dashed, with the amber add.
  openSlot: (
    <>
      <rect className="sp-panel" x="14" y="22" width="40" height="54" rx="6" />
      <circle className="sp-fig" cx="34" cy="42" r="8" />
      <path className="sp-fig" d="M20 76c0-9 6-15 14-15s14 6 14 15z" />
      <rect className="sp-panel" x="60" y="22" width="40" height="54" rx="6" />
      <circle className="sp-fig" cx="80" cy="42" r="8" />
      <path className="sp-fig" d="M66 76c0-9 6-15 14-15s14 6 14 15z" />
      <rect className="sp-dash-act" x="106" y="22" width="40" height="54" rx="6" />
      <circle className="sp-act" cx="126" cy="49" r="10" />
      <path className="sp-cut" d="M126 44v10M121 49h10" />
      <rect className="sp-line-fill" x="14" y="82" width="40" height="6" rx="2" />
      <rect className="sp-line-fill" x="60" y="82" width="40" height="6" rx="2" />
      <rect className="sp-dash" x="106" y="82" width="40" height="6" rx="2" />
    </>
  ),
};

export const SPOT_NAMES = Object.keys(SPOTS) as SpotName[];

export interface SpotProps {
  name: SpotName;
  /** Width in px; height follows the 160 by 112 frame. Spots also shrink to their container. */
  width?: number;
  className?: string;
}

export function Spot({ name, width = 160, className }: SpotProps) {
  return (
    <svg
      className={['kit-spot', className].filter(Boolean).join(' ')}
      width={width}
      height={Math.round((width * 112) / 160)}
      viewBox="0 0 160 112"
      aria-hidden="true"
      focusable="false"
    >
      {SPOTS[name]}
    </svg>
  );
}
