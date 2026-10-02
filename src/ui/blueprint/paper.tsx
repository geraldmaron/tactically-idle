// Blueprint paper: saturated blue sheet, 1 ft / 5 ft grid, grain, creases, vignette, masking tape.
import type { ReactNode } from 'react';
import type { Rect } from './geometry';
import { r2 } from './geometry';

export const ids = (uid: string) => ({
  grain: `${uid}-grain`,
  mottle: `${uid}-mottle`,
  vignette: `${uid}-vignette`,
  paper: `${uid}-paper`,
  hatch: `${uid}-hatch`,
  hatchLight: `${uid}-hatch-light`,
  tile: `${uid}-tile`,
  tileBig: `${uid}-tile-big`,
  planks: `${uid}-planks`,
  creaseV: `${uid}-crease-v`,
  creaseH: `${uid}-crease-h`,
  tapeShadow: `${uid}-tape-shadow`,
  glow: `${uid}-glow`,
  wallMask: `${uid}-wallmask`,
  rough: `${uid}-rough`,
  clip: `${uid}-clip`,
});

export function PaperDefs({ uid, vb }: { uid: string; vb: Rect }) {
  const id = ids(uid);
  return (
    <defs>
      <linearGradient id={id.paper} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="var(--paper)" />
        <stop offset="1" stopColor="var(--paper-deep)" />
      </linearGradient>
      <radialGradient id={id.vignette} cx="0.5" cy="0.5" r="0.78">
        <stop offset="0.55" stopColor="#031a52" stopOpacity="0" />
        <stop offset="1" stopColor="#031a52" stopOpacity="0.5" />
      </radialGradient>
      <filter id={id.grain} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="1.9" numOctaves="2" seed="11" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 2.6 -1.25" />
      </filter>
      <filter id={id.mottle} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="4" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.02  0 0 0 0 0.1  0 0 0 0 0.32  0 0 0 1.5 -0.55" />
      </filter>
      <filter id={id.tapeShadow} x="-20%" y="-40%" width="140%" height="180%">
        <feDropShadow dx="0.1" dy="0.18" stdDeviation="0.14" floodColor="#020d33" floodOpacity="0.45" />
      </filter>
      <filter id={id.glow} x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur stdDeviation="0.5" />
      </filter>
      {/* slightly rough edges for highlighter / marker shapes */}
      <filter id={id.rough} x="-5%" y="-30%" width="110%" height="160%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="t" />
        <feDisplacementMap in="SourceGraphic" in2="t" scale="0.35" />
      </filter>
      <pattern id={id.hatch} width="0.5" height="0.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M0 0.25H0.5" stroke="var(--chalk)" strokeWidth="0.1" strokeOpacity="0.92" />
      </pattern>
      <pattern id={id.hatchLight} width="0.5" height="0.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M0 0.25H0.5" stroke="var(--chalk)" strokeWidth="0.08" strokeOpacity="0.8" />
      </pattern>
      <pattern id={id.tile} width="0.9" height="0.9" patternUnits="userSpaceOnUse">
        <path d="M0 0H0.9M0 0V0.9" stroke="var(--chalk)" strokeWidth="0.05" strokeOpacity="0.32" fill="none" />
      </pattern>
      <pattern id={id.tileBig} width="1.5" height="1.5" patternUnits="userSpaceOnUse">
        <path d="M0 0H1.5M0 0V1.5" stroke="var(--chalk)" strokeWidth="0.04" strokeOpacity="0.2" fill="none" />
      </pattern>
      <pattern id={id.planks} width="1" height="1" patternUnits="userSpaceOnUse">
        <path d="M0 0.5H1" stroke="var(--chalk)" strokeWidth="0.05" strokeOpacity="0.4" fill="none" />
      </pattern>
      <linearGradient id={id.creaseV} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#031a52" stopOpacity="0" />
        <stop offset="0.45" stopColor="#031a52" stopOpacity="0.34" />
        <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.16" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={id.creaseH} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#031a52" stopOpacity="0" />
        <stop offset="0.45" stopColor="#031a52" stopOpacity="0.34" />
        <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.16" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <clipPath id={id.clip}>
        <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} />
      </clipPath>
    </defs>
  );
}

function gridPaths(vb: Rect): { fine: string; major: string } {
  const x0 = Math.floor(vb.x);
  const x1 = Math.ceil(vb.x + vb.w);
  const y0 = Math.floor(vb.y);
  const y1 = Math.ceil(vb.y + vb.h);
  let fine = '';
  let major = '';
  for (let x = x0; x <= x1; x++) {
    const seg = `M${x} ${y0}V${y1}`;
    if (x % 5 === 0) major += seg;
    else fine += seg;
  }
  for (let y = y0; y <= y1; y++) {
    const seg = `M${x0} ${y}H${x1}`;
    if (y % 5 === 0) major += seg;
    else fine += seg;
  }
  return { fine, major };
}

/** Everything behind the drawing: paper, grid, grain, creases. */
export function PaperBack({ uid, vb }: { uid: string; vb: Rect }) {
  const id = ids(uid);
  const g = gridPaths(vb);
  const cx = vb.x + vb.w * 0.37;
  const cy = vb.y + vb.h * 0.56;
  return (
    <g className="bp-paper" aria-hidden="true">
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill={`url(#${id.paper})`} />
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} filter={`url(#${id.mottle})`} opacity="0.16" />
      <path d={g.fine} className="bp-grid-fine" />
      <path d={g.major} className="bp-grid-major" />
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} filter={`url(#${id.grain})`} opacity="0.13" />
      {/* folds */}
      <polygon points={`${r2(cx - 0.35)},${vb.y} ${r2(cx + 0.55)},${vb.y} ${r2(cx + 0.95)},${vb.y + vb.h} ${r2(cx + 0.05)},${vb.y + vb.h}`} fill={`url(#${id.creaseV})`} />
      <polygon points={`${vb.x},${r2(cy - 0.3)} ${vb.x + vb.w},${r2(cy - 0.7)} ${vb.x + vb.w},${r2(cy + 0.45)} ${vb.x},${r2(cy + 0.85)}`} fill={`url(#${id.creaseH})`} />
    </g>
  );
}

function Tape({ cx, cy, angle, shadow }: { cx: number; cy: number; angle: number; shadow: string }): ReactNode {
  const L = 12;
  const W = 3.7;
  const z = 0.32;
  // zig-zag torn ends
  const left: string[] = [];
  const right: string[] = [];
  const steps = 7;
  for (let i = 0; i <= steps; i++) {
    const y = -W / 2 + (W * i) / steps;
    left.push(`${r2(-L / 2 + (i % 2 ? z : 0))},${r2(y)}`);
    right.push(`${r2(L / 2 - (i % 2 ? 0 : z))},${r2(y)}`);
  }
  const pts = [...left, ...right.reverse()].join(' ');
  return (
    <g transform={`translate(${r2(cx)} ${r2(cy)}) rotate(${angle})`} filter={`url(#${shadow})`}>
      <polygon points={pts} fill="var(--tape)" />
      <polygon points={pts} fill="#fff" opacity="0.1" />
      {[-0.9, -0.3, 0.35, 0.95].map((y, i) => (
        <line key={i} x1={-L / 2 + 0.6} x2={L / 2 - 0.6} y1={y} y2={y + (i % 2 ? 0.05 : -0.04)} stroke="#6b5a34" strokeOpacity="0.16" strokeWidth="0.06" />
      ))}
    </g>
  );
}

/** Everything over the drawing that must not intercept pointers: vignette and tape. */
export function PaperFront({ uid, vb }: { uid: string; vb: Rect }) {
  const id = ids(uid);
  return (
    <g className="bp-paper-front" aria-hidden="true" pointerEvents="none">
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill={`url(#${id.vignette})`} />
      <Tape cx={vb.x + 2.4} cy={vb.y + 2.2} angle={-42} shadow={id.tapeShadow} />
      <Tape cx={vb.x + vb.w - 2.4} cy={vb.y + vb.h - 2.2} angle={-42} shadow={id.tapeShadow} />
    </g>
  );
}
