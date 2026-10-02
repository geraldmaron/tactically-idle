// Deterministic illustrated head-and-shoulders portraits, drawn as layered, gradient-shaded SVG.
// portraitSpec(seed) is pure: the same seed always gives the same fictional person.
import type { ReactNode } from 'react';
import { seeded } from '../blueprint/geometry';

type Shape = 'oval' | 'round' | 'square' | 'long' | 'heart';
export type HairStyle = 'short' | 'buzz' | 'bald' | 'bun' | 'ponytail' | 'curly' | 'afro' | 'side' | 'long';
export type Facial = 'none' | 'stubble' | 'mustache' | 'goatee' | 'beard';

interface Skin {
  base: string;
  shade: string;
  light: string;
  lip: string;
}
interface Hair {
  base: string;
  light: string;
  dark: string;
}

export interface PortraitSpec {
  presentation: 'f' | 'm';
  skin: Skin;
  shape: Shape;
  fw: number;
  jw: number;
  cw: number;
  chin: number;
  hairStyle: HairStyle;
  hair: Hair;
  facial: Facial;
  glasses: boolean;
  glassTone: string;
  iris: string;
  eyeW: number;
  eyeH: number;
  eyeTilt: number;
  eyeGap: number;
  browThick: number;
  browAngle: number;
  browArch: number;
  noseW: number;
  noseLen: number;
  mouthW: number;
  smile: number;
  fullLips: number;
  neck: number;
  tilt: number;
  patch: string;
  backdropHue: number;
}

const SKINS: Skin[] = [
  { base: '#f3d3bd', shade: '#c99a82', light: '#fbe6d6', lip: '#c9807a' },
  { base: '#ecc3a0', shade: '#bf8f6c', light: '#f7d9bf', lip: '#c27668' },
  { base: '#e2b088', shade: '#b27b55', light: '#f0c9a4', lip: '#b96c5c' },
  { base: '#d29a6c', shade: '#a06a42', light: '#e4b387', lip: '#a95f50' },
  { base: '#bd8157', shade: '#8c5836', light: '#d19b72', lip: '#964f40' },
  { base: '#a56b44', shade: '#764428', light: '#bb8460', lip: '#85413a' },
  { base: '#8b5636', shade: '#5d331c', light: '#a46e4c', lip: '#74352f' },
  { base: '#6e3f26', shade: '#43230f', light: '#885338', lip: '#5e2b27' },
  { base: '#59311d', shade: '#34190b', light: '#734630', lip: '#4d2423' },
  { base: '#e8bd9a', shade: '#b98863', light: '#f5d6bb', lip: '#bf7569' },
  { base: '#cf9a79', shade: '#9d6b4c', light: '#e2b392', lip: '#a76457' },
  { base: '#f7dcc6', shade: '#d0a58d', light: '#fff0e3', lip: '#d08a85' },
];

const HAIRS: Hair[] = [
  { base: '#17120f', light: '#3a2f29', dark: '#0a0706' },
  { base: '#2a1c13', light: '#54392a', dark: '#150d08' },
  { base: '#4b3021', light: '#7a5640', dark: '#2a1a10' },
  { base: '#6b4429', light: '#9a6b47', dark: '#3d2616' },
  { base: '#7b3a20', light: '#b0603a', dark: '#4a2010' },
  { base: '#b88c4f', light: '#e3bf80', dark: '#7e5a2c' },
  { base: '#8e6c40', light: '#bf9a66', dark: '#5a4022' },
  { base: '#8a8c92', light: '#c3c5ca', dark: '#55575e' },
  { base: '#232227', light: '#4a4852', dark: '#0e0d10' },
  { base: '#a0502a', light: '#d27d4c', dark: '#612c14' },
];

const IRISES = ['#3b2418', '#5a3a22', '#2d2a26', '#4b6a52', '#58708a', '#7a6030', '#1e1c1a'];
const PATCHES = ['#d9b45a', '#c7ccd6', '#d96b52', '#6fb7d9'];

const SHAPES: Record<Shape, { fw: number; jw: number; cw: number; chin: number }> = {
  oval: { fw: 20.5, jw: 14, cw: 6, chin: 68 },
  round: { fw: 22.5, jw: 17, cw: 9.5, chin: 66 },
  square: { fw: 22, jw: 19.5, cw: 11, chin: 67 },
  long: { fw: 19, jw: 13, cw: 5.5, chin: 72 },
  heart: { fw: 22, jw: 11, cw: 4.5, chin: 69 },
};

export function portraitSpec(seed: string): PortraitSpec {
  const r = seeded(`portrait:${seed}`);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(r() * arr.length)];
  const range = (a: number, b: number) => a + (b - a) * r();

  const presentation: 'f' | 'm' = r() < 0.45 ? 'f' : 'm';
  const skinIdx = Math.floor(r() * SKINS.length);
  const skin = SKINS[skinIdx];
  const dark = skinIdx >= 5 && skinIdx <= 8;
  const shape = pick<Shape>(presentation === 'f' ? ['oval', 'round', 'heart', 'oval', 'long'] : ['oval', 'square', 'round', 'long', 'square']);
  const sh = SHAPES[shape];
  const hairStyle = pick<HairStyle>(
    presentation === 'f' ? ['bun', 'ponytail', 'long', 'curly', 'short', 'side', 'afro', 'ponytail'] : ['short', 'buzz', 'bald', 'curly', 'side', 'short', 'afro', 'buzz', 'bald'],
  );
  let hair = pick(HAIRS);
  if (dark && r() < 0.8) hair = pick([HAIRS[0], HAIRS[8], HAIRS[1]]);
  const facialRoll = r();
  const facial: Facial = presentation === 'f' ? 'none' : facialRoll < 0.34 ? 'none' : facialRoll < 0.5 ? 'stubble' : facialRoll < 0.64 ? 'mustache' : facialRoll < 0.8 ? 'goatee' : 'beard';
  return {
    presentation,
    skin,
    shape,
    fw: sh.fw + range(-0.8, 0.8),
    jw: sh.jw + range(-0.8, 0.8) - (presentation === 'f' ? 1 : 0),
    cw: sh.cw + range(-0.5, 0.5),
    chin: sh.chin + range(-1, 1),
    hairStyle,
    hair,
    facial,
    glasses: r() < 0.25,
    glassTone: pick(['#1b1b22', '#3b2b20', '#a58a3c', '#2c3d5e']),
    iris: pick(IRISES),
    eyeW: range(0.92, 1.12),
    eyeH: range(0.85, 1.15),
    eyeTilt: range(-4, 5),
    eyeGap: range(0.4, 0.47),
    browThick: presentation === 'f' ? range(1.5, 2.2) : range(2.1, 3.2),
    browAngle: range(-3, 7),
    browArch: range(0.4, 1.6),
    noseW: range(0.85, 1.2),
    noseLen: range(0.8, 1.2),
    mouthW: range(0.85, 1.15),
    smile: range(-0.3, 1.1),
    fullLips: presentation === 'f' ? range(0.9, 1.3) : range(0.7, 1.1),
    neck: range(0.92, 1.12),
    tilt: range(-2.4, 2.4),
    patch: pick(PATCHES),
    backdropHue: range(-6, 8),
  };
}

const n2 = (n: number) => Math.round(n * 100) / 100;
const CX = 50;

function facePath(s: PortraitSpec, top: number): string {
  const R = s.fw;
  const J = s.jw;
  const C = s.cw;
  const cheekY = 43;
  const jawY = s.chin - 12;
  const sq = s.shape === 'square' ? 0.2 : 0.55;
  const side = (m: 1 | -1) =>
    `C${n2(CX + m * R * 0.58)} ${top} ${n2(CX + m * R)} ${top + 9} ${n2(CX + m * R)} ${cheekY} ` +
    `C${n2(CX + m * R)} ${n2(cheekY + (jawY - cheekY) * 0.62)} ${n2(CX + m * (J + (R - J) * sq))} ${n2(jawY - 1)} ${n2(CX + m * J)} ${n2(jawY)} ` +
    `C${n2(CX + m * J * 0.96)} ${n2(jawY + (s.chin - jawY) * 0.6)} ${n2(CX + m * (C + (J - C) * 0.3))} ${n2(s.chin)} ${n2(CX + m * C)} ${n2(s.chin)}`;
  // right side top-down, then chin across, then left side bottom-up (reverse of a mirrored curve)
  const right = side(1);
  const lx = (m: number) => n2(CX - m);
  // build the left side by explicit reversed control points
  const left =
    `L${lx(C)} ${n2(s.chin)} ` +
    `C${lx(C + (J - C) * 0.3)} ${n2(s.chin)} ${lx(J * 0.96)} ${n2(jawY + (s.chin - jawY) * 0.6)} ${lx(J)} ${n2(jawY)} ` +
    `C${lx(J + (R - J) * sq)} ${n2(jawY - 1)} ${lx(R)} ${n2(cheekY + (jawY - cheekY) * 0.62)} ${lx(R)} ${cheekY} ` +
    `C${lx(R)} ${top + 9} ${lx(R * 0.58)} ${top} ${CX} ${top} Z`;
  return `M${CX} ${top} ${right} ${left}`;
}

function capPath(s: PortraitSpec, top: number, extra: number, lift: number, hl: number, temple: number): string {
  const R = s.fw;
  const t = top - lift;
  return (
    `M${n2(CX - R - extra)} ${temple + 5} ` +
    `C${n2(CX - R - extra - 0.6)} ${n2(top - lift * 0.1)} ${n2(CX - R * 0.62)} ${t} ${CX} ${t} ` +
    `C${n2(CX + R * 0.62)} ${t} ${n2(CX + R + extra + 0.6)} ${n2(top - lift * 0.1)} ${n2(CX + R + extra)} ${temple + 5} ` +
    `L${n2(CX + R + extra - 1.6)} ${temple + 13} L${n2(CX + R - 2.4)} ${temple + 4} ` +
    `C${n2(CX + R * 0.6)} ${hl - 3} ${n2(CX + R * 0.25)} ${hl + 1} ${CX} ${hl} ` +
    `C${n2(CX - R * 0.25)} ${hl + 1} ${n2(CX - R * 0.6)} ${hl - 3} ${n2(CX - R + 2.4)} ${temple + 4} ` +
    `L${n2(CX - R - extra + 1.6)} ${temple + 13} Z`
  );
}

function strands(s: PortraitSpec, top: number, count: number, key: string): ReactNode {
  const r = seeded(`${key}:strands`);
  const out: ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const x0 = CX - s.fw + t * 2 * s.fw;
    const bend = (r() - 0.5) * 8;
    out.push(<path key={i} d={`M${n2(x0)} ${n2(top + 11 + r() * 2)} Q${n2(x0 + bend)} ${n2(top + 4)} ${n2(CX + (x0 - CX) * 0.55 + bend * 0.4)} ${n2(top - 1.5 + r() * 2)}`} stroke={s.hair.light} strokeOpacity="0.34" strokeWidth="0.55" fill="none" strokeLinecap="round" />);
  }
  return <g>{out}</g>;
}

interface Ids {
  [k: string]: string;
}

function curls(s: PortraitSpec, big: boolean, key: string): ReactNode {
  const r = seeded(`${key}:curls`);
  const rx = s.fw + (big ? 8 : 3.2);
  const ry = big ? 29 : 21;
  const cy = big ? 34 : 35;
  const rad = big ? 8.6 : 6.6;
  const out: ReactNode[] = [];
  const N = big ? 22 : 17;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const a = Math.PI + t * Math.PI;
    const jitter = 0.85 + r() * 0.3;
    out.push(<circle key={`o${i}`} cx={n2(CX + Math.cos(a) * rx)} cy={n2(cy + Math.sin(a) * ry)} r={n2(rad * jitter)} fill={s.hair.base} />);
  }
  // lower side curls reaching toward the ears
  if (big) {
    for (const m of [-1, 1]) for (let k = 0; k < 3; k++) out.push(<circle key={`s${m}${k}`} cx={n2(CX + m * (rx - 0.5 - k * 0.4))} cy={n2(cy + 4 + k * 6)} r={n2(rad * 0.85)} fill={s.hair.base} />);
  } else {
    for (const m of [-1, 1]) for (let k = 0; k < 2; k++) out.push(<circle key={`s${m}${k}`} cx={n2(CX + m * (rx - 0.2))} cy={n2(cy + 5 + k * 5)} r={n2(rad * 0.7)} fill={s.hair.base} />);
  }
  const hi: ReactNode[] = [];
  for (let i = 0; i < N; i += 2) {
    const t = i / (N - 1);
    const a = Math.PI + t * Math.PI;
    hi.push(<circle key={`h${i}`} cx={n2(CX + Math.cos(a) * (rx - 1))} cy={n2(cy + Math.sin(a) * (ry - 1.5))} r={n2(rad * 0.45)} fill={s.hair.light} fillOpacity="0.28" />);
  }
  return (
    <g>
      {out}
      {hi}
    </g>
  );
}

export function ProceduralFace({ seed, uid }: { seed: string; uid: string }) {
  const s = portraitSpec(seed);
  const id = (name: string) => `${uid}-${name}`;
  const ids: Ids = {
    bg: id('bg'),
    vig: id('vig'),
    face: id('face'),
    faceShade: id('fshade'),
    neck: id('neck'),
    uni: id('uni'),
    hair: id('hair'),
    clip: id('clip'),
    iris: id('iris'),
    blush: id('blush'),
    glow: id('glow'),
    fore: id('fore'),
  };

  const top = 17;
  const eyeY = top + (s.chin - top) * 0.47;
  const mouthY = s.chin - (s.chin - top) * 0.2;
  const noseY = eyeY + (mouthY - eyeY) * 0.58;
  const temple = 33;
  const hlBase = top + 10;
  const face = facePath(s, top);
  const eyeDx = s.fw * s.eyeGap + 1.2;
  const neckHalf = Math.max(8.5, s.jw * 0.74) * s.neck;

  const eye = (m: 1 | -1) => {
    const ex = CX + m * eyeDx;
    const w = 4.9 * s.eyeW;
    const h = 2.6 * s.eyeH;
    const tilt = m * -s.eyeTilt * 0.5;
    return (
      <g key={`eye${m}`} transform={`rotate(${n2(tilt)} ${n2(ex)} ${n2(eyeY)})`}>
        <ellipse cx={n2(ex)} cy={n2(eyeY)} rx={n2(w)} ry={n2(h)} fill="#eceaea" />
        <ellipse cx={n2(ex)} cy={n2(eyeY - h * 0.35)} rx={n2(w)} ry={n2(h * 0.6)} fill="#000" fillOpacity="0.06" />
        <circle cx={n2(ex)} cy={n2(eyeY + 0.1)} r={n2(Math.min(h, 2.7) * 0.98)} fill={`url(#${ids.iris})`} />
        <circle cx={n2(ex)} cy={n2(eyeY + 0.1)} r={n2(Math.min(h, 2.7) * 0.98)} fill="none" stroke="#0b0706" strokeOpacity="0.55" strokeWidth="0.5" />
        <circle cx={n2(ex)} cy={n2(eyeY + 0.1)} r={n2(Math.min(h, 2.7) * 0.46)} fill="#07060a" />
        <circle cx={n2(ex - m * 0.7 - 0.4)} cy={n2(eyeY - 0.7)} r="0.55" fill="#fff" fillOpacity="0.9" />
        <path d={`M${n2(ex - w)} ${n2(eyeY + 0.2)} Q${n2(ex)} ${n2(eyeY - h * 1.55)} ${n2(ex + w)} ${n2(eyeY + 0.2)}`} fill="none" stroke="#1f1410" strokeWidth="1.15" strokeLinecap="round" />
        <path d={`M${n2(ex - w * 0.8)} ${n2(eyeY - h * 1.9)} Q${n2(ex)} ${n2(eyeY - h * 2.6)} ${n2(ex + w * 0.8)} ${n2(eyeY - h * 1.8)}`} fill="none" stroke={s.skin.shade} strokeOpacity="0.55" strokeWidth="0.7" strokeLinecap="round" />
        <path d={`M${n2(ex - w * 0.85)} ${n2(eyeY + h * 0.6)} Q${n2(ex)} ${n2(eyeY + h * 1.35)} ${n2(ex + w * 0.85)} ${n2(eyeY + h * 0.6)}`} fill="none" stroke={s.skin.shade} strokeOpacity="0.4" strokeWidth="0.55" strokeLinecap="round" />
      </g>
    );
  };

  const brow = (m: 1 | -1) => {
    const inner = CX + m * (eyeDx - 5.2);
    const outer = CX + m * (eyeDx + 5.6);
    const by = eyeY - 6.6 - s.browArch * 0.4;
    const iy = by + 0.6 - s.browAngle * 0.1;
    const oy = by + 1.2 + s.browAngle * 0.25;
    return (
      <path
        key={`brow${m}`}
        d={`M${n2(inner)} ${n2(iy)} Q${n2((inner + outer) / 2)} ${n2(by - s.browArch)} ${n2(outer)} ${n2(oy)}`}
        fill="none"
        stroke={s.hair.dark}
        strokeOpacity="0.92"
        strokeWidth={n2(s.browThick)}
        strokeLinecap="round"
      />
    );
  };

  const nw = 3.6 * s.noseW;
  const nl = (mouthY - eyeY) * 0.46 * s.noseLen;
  const nose = (
    <g>
      <path d={`M${n2(CX + 1.2)} ${n2(eyeY + 2)} C${n2(CX + 2.6)} ${n2(eyeY + nl * 0.4)} ${n2(CX + nw * 0.9)} ${n2(noseY - 1)} ${n2(CX + nw)} ${n2(noseY + 0.2)}`} fill="none" stroke={s.skin.shade} strokeOpacity="0.55" strokeWidth="1.2" strokeLinecap="round" />
      <path d={`M${n2(CX - nw)} ${n2(noseY + 0.6)} Q${n2(CX - nw * 0.55)} ${n2(noseY + 2.1)} ${n2(CX)} ${n2(noseY + 1.6)} Q${n2(CX + nw * 0.55)} ${n2(noseY + 2.1)} ${n2(CX + nw)} ${n2(noseY + 0.6)}`} fill="none" stroke={s.skin.shade} strokeOpacity="0.85" strokeWidth="0.95" strokeLinecap="round" />
      <ellipse cx={n2(CX - nw * 0.52)} cy={n2(noseY + 1.35)} rx="0.85" ry="0.5" fill="#1c0f0b" fillOpacity="0.45" />
      <ellipse cx={n2(CX + nw * 0.52)} cy={n2(noseY + 1.35)} rx="0.85" ry="0.5" fill="#1c0f0b" fillOpacity="0.45" />
      <ellipse cx={n2(CX - 0.6)} cy={n2(noseY - 0.4)} rx="1.1" ry="1.4" fill={s.skin.light} fillOpacity="0.38" />
    </g>
  );

  const mw = 7.2 * s.mouthW;
  const lipH = 1.5 * s.fullLips;
  const sm = s.smile;
  const mouth = (
    <g>
      <path
        d={`M${n2(CX - mw)} ${n2(mouthY - sm * 0.5)} C${n2(CX - mw * 0.5)} ${n2(mouthY - lipH * 0.8)} ${n2(CX - 1.4)} ${n2(mouthY - lipH * 1.7)} ${CX} ${n2(mouthY - lipH * 1.1)} C${n2(CX + 1.4)} ${n2(mouthY - lipH * 1.7)} ${n2(CX + mw * 0.5)} ${n2(mouthY - lipH * 0.8)} ${n2(CX + mw)} ${n2(mouthY - sm * 0.5)} C${n2(CX + mw * 0.45)} ${n2(mouthY + 0.2)} ${n2(CX - mw * 0.45)} ${n2(mouthY + 0.2)} ${n2(CX - mw)} ${n2(mouthY - sm * 0.5)} Z`}
        fill={s.skin.lip}
        fillOpacity="0.95"
      />
      <path d={`M${n2(CX - mw)} ${n2(mouthY - sm * 0.5)} C${n2(CX - mw * 0.45)} ${n2(mouthY + lipH * 2.3)} ${n2(CX + mw * 0.45)} ${n2(mouthY + lipH * 2.3)} ${n2(CX + mw)} ${n2(mouthY - sm * 0.5)} C${n2(CX + mw * 0.45)} ${n2(mouthY + 0.2)} ${n2(CX - mw * 0.45)} ${n2(mouthY + 0.2)} ${n2(CX - mw)} ${n2(mouthY - sm * 0.5)} Z`} fill={s.skin.lip} fillOpacity="0.8" />
      <ellipse cx={CX} cy={n2(mouthY + lipH * 1.2)} rx={n2(mw * 0.3)} ry="0.5" fill="#fff" fillOpacity="0.2" />
      <path d={`M${n2(CX - mw)} ${n2(mouthY - sm * 0.5)} C${n2(CX - mw * 0.4)} ${n2(mouthY + 0.35)} ${n2(CX + mw * 0.4)} ${n2(mouthY + 0.35)} ${n2(CX + mw)} ${n2(mouthY - sm * 0.5)}`} fill="none" stroke="#2a1210" strokeOpacity="0.75" strokeWidth="0.7" strokeLinecap="round" />
      <path d={`M${n2(CX - 2)} ${n2(mouthY + lipH * 3.4)} Q${CX} ${n2(mouthY + lipH * 3.9)} ${n2(CX + 2)} ${n2(mouthY + lipH * 3.4)}`} fill="none" stroke={s.skin.shade} strokeOpacity="0.4" strokeWidth="0.8" strokeLinecap="round" />
    </g>
  );

  // ----- facial hair
  const hc = s.hair.base;
  let facialHair: ReactNode = null;
  if (s.facial === 'stubble') {
    facialHair = (
      <g clipPath={`url(#${ids.clip})`}>
        <path d={`M${CX - s.fw} ${eyeY + 6} C${CX - s.fw} ${s.chin} ${CX + s.fw} ${s.chin} ${CX + s.fw} ${eyeY + 6} L${CX + s.fw} ${s.chin + 4} L${CX - s.fw} ${s.chin + 4} Z`} fill={hc} fillOpacity="0.3" />
        <path d={`M${CX - 8} ${mouthY - 4} Q${CX} ${mouthY - 7} ${CX + 8} ${mouthY - 4} L${CX + 8} ${mouthY - 1} L${CX - 8} ${mouthY - 1} Z`} fill={hc} fillOpacity="0.25" />
      </g>
    );
  } else if (s.facial === 'mustache') {
    facialHair = (
      <path d={`M${CX} ${mouthY - lipH * 2.2} C${CX - 3} ${mouthY - lipH * 3.6} ${CX - mw - 1.4} ${mouthY - lipH * 2.6} ${CX - mw - 2} ${mouthY + 0.8} C${CX - mw * 0.6} ${mouthY - lipH * 1.2} ${CX - 2} ${mouthY - lipH * 1.5} ${CX} ${mouthY - lipH * 1.2} C${CX + 2} ${mouthY - lipH * 1.5} ${CX + mw * 0.6} ${mouthY - lipH * 1.2} ${CX + mw + 2} ${mouthY + 0.8} C${CX + mw + 1.4} ${mouthY - lipH * 2.6} ${CX + 3} ${mouthY - lipH * 3.6} ${CX} ${mouthY - lipH * 2.2} Z`} fill={hc} fillOpacity="0.95" />
    );
  } else if (s.facial === 'goatee') {
    facialHair = (
      <g>
        <path d={`M${CX - 5.6} ${mouthY + 2.2} Q${CX - 6.2} ${s.chin + 1.5} ${CX} ${s.chin + 1.5} Q${CX + 6.2} ${s.chin + 1.5} ${CX + 5.6} ${mouthY + 2.2} Q${CX} ${mouthY + 4.6} ${CX - 5.6} ${mouthY + 2.2} Z`} fill={hc} fillOpacity="0.95" />
        <path d={`M${CX} ${mouthY - lipH * 2.2} C${CX - 3} ${mouthY - lipH * 3.4} ${CX - mw - 1} ${mouthY - lipH * 2.4} ${CX - mw - 1.4} ${mouthY + 0.6} C${CX - mw * 0.6} ${mouthY - lipH * 1.2} ${CX - 2} ${mouthY - lipH * 1.5} ${CX} ${mouthY - lipH * 1.2} C${CX + 2} ${mouthY - lipH * 1.5} ${CX + mw * 0.6} ${mouthY - lipH * 1.2} ${CX + mw + 1.4} ${mouthY + 0.6} C${CX + mw + 1} ${mouthY - lipH * 2.4} ${CX + 3} ${mouthY - lipH * 3.4} ${CX} ${mouthY - lipH * 2.2} Z`} fill={hc} fillOpacity="0.95" />
      </g>
    );
  } else if (s.facial === 'beard') {
    facialHair = (
      <g clipPath={`url(#${ids.clip})`}>
        <path
          d={`M${CX - s.fw - 1} ${eyeY - 1} L${CX - s.fw + 2.5} ${eyeY + 2} C${CX - s.fw + 4} ${mouthY - 4} ${CX - mw - 3} ${mouthY - 3.5} ${CX - mw - 1} ${mouthY - 2} C${CX - mw * 0.5} ${mouthY - lipH * 3.2} ${CX - 2} ${mouthY - lipH * 2.4} ${CX} ${mouthY - lipH * 2.3} C${CX + 2} ${mouthY - lipH * 2.4} ${CX + mw * 0.5} ${mouthY - lipH * 3.2} ${CX + mw + 1} ${mouthY - 2} C${CX + mw + 3} ${mouthY - 3.5} ${CX + s.fw - 4} ${mouthY - 4} ${CX + s.fw - 2.5} ${eyeY + 2} L${CX + s.fw + 1} ${eyeY - 1} L${CX + s.fw + 1} ${s.chin + 5} L${CX - s.fw - 1} ${s.chin + 5} Z`}
          fill={hc}
          fillOpacity="0.96"
        />
        <path d={`M${CX - mw} ${mouthY + 1.4} Q${CX} ${mouthY + 3.2} ${CX + mw} ${mouthY + 1.4}`} fill="none" stroke={s.skin.lip} strokeWidth="1" strokeOpacity="0" />
      </g>
    );
  }
  const beardLayersOverMouth = s.facial === 'beard';

  // ----- hair
  const hairFill = `url(#${ids.hair})`;
  const style = s.hairStyle;
  let hairBack: ReactNode = null;
  let hairFront: ReactNode = null;
  if (style === 'buzz') {
    hairFront = <path d={capPath(s, top, 0.3, 0.8, hlBase - 0.5, temple)} fill={hairFill} fillOpacity="0.7" />;
  } else if (style === 'short') {
    hairFront = (
      <g>
        <path d={capPath(s, top, 1.1, 3, hlBase, temple)} fill={hairFill} />
        {strands(s, top, 7, seed)}
      </g>
    );
  } else if (style === 'side') {
    hairFront = (
      <g>
        <path d={capPath(s, top, 1.4, 4.2, hlBase + 1, temple)} fill={hairFill} />
        <path d={`M${CX - 9} ${top - 2.5} C${CX + 6} ${top - 1} ${CX + s.fw} ${top + 6} ${CX + s.fw + 1} ${temple + 9} L${CX + s.fw - 4} ${temple + 3} C${CX + s.fw * 0.5} ${top + 12} ${CX - 2} ${top + 9} ${CX - 9} ${hlBase + 2} Z`} fill={s.hair.light} fillOpacity="0.4" />
        <path d={`M${CX - 9} ${top - 2.5} C${CX - 7} ${top + 3} ${CX - 8} ${top + 7} ${CX - 9} ${hlBase + 2}`} stroke={s.hair.dark} strokeOpacity="0.6" strokeWidth="0.8" fill="none" />
        {strands(s, top, 6, seed)}
      </g>
    );
  } else if (style === 'bun') {
    hairBack = (
      <g>
        <circle cx={CX} cy={top - 6.5} r="8.4" fill={hairFill} />
        <circle cx={n2(CX - 2.5)} cy={n2(top - 9)} r="3.4" fill={s.hair.light} fillOpacity="0.28" />
        <path d={`M${CX - 7} ${top - 1.5} Q${CX} ${top + 1} ${CX + 7} ${top - 1.5}`} stroke={s.hair.dark} strokeWidth="1.1" fill="none" strokeOpacity="0.7" />
      </g>
    );
    hairFront = (
      <g>
        <path d={capPath(s, top, 0.9, 1.6, hlBase - 0.5, temple)} fill={hairFill} />
        <path d={`M${CX} ${top - 1} L${CX + 0.4} ${hlBase - 0.4}`} stroke={s.hair.dark} strokeOpacity="0.55" strokeWidth="0.7" />
        {strands(s, top, 6, seed)}
      </g>
    );
  } else if (style === 'ponytail') {
    const m = s.tilt > 0 ? -1 : 1;
    hairBack = (
      <path
        d={`M${CX + m * (s.fw - 3)} ${temple - 4} C${CX + m * (s.fw + 12)} ${temple - 2} ${CX + m * (s.fw + 14)} 66 ${CX + m * (s.fw + 7)} 94 C${CX + m * (s.fw + 4)} 98 ${CX + m * (s.fw + 1)} 90 ${CX + m * (s.fw - 1)} 78 Z`}
        fill={hairFill}
      />
    );
    hairFront = (
      <g>
        <path d={capPath(s, top, 0.9, 1.8, hlBase - 0.8, temple)} fill={hairFill} />
        <path d={`M${CX - 0.5} ${top - 1.2} Q${CX + 2} ${top + 6} ${CX - 2} ${hlBase - 0.6}`} stroke={s.hair.dark} strokeOpacity="0.5" strokeWidth="0.7" fill="none" />
        {strands(s, top, 6, seed)}
      </g>
    );
  } else if (style === 'long') {
    const R = s.fw;
    hairBack = (
      <path
        d={`M${CX - R - 2} ${top + 8} C${CX - R - 15} ${top + 20} ${CX - R - 13} 68 ${CX - R - 11} 100 L${CX + R + 11} 100 C${CX + R + 13} 68 ${CX + R + 15} ${top + 20} ${CX + R + 2} ${top + 8} Z`}
        fill={hairFill}
      />
    );
    hairFront = (
      <g>
        <path d={capPath(s, top, 1.5, 3.4, hlBase + 1, temple)} fill={hairFill} />
        <path d={`M${CX + 7} ${top - 2.2} C${CX + R} ${top + 2} ${CX + R + 2} ${temple + 4} ${CX + R + 1.5} ${s.chin - 4} L${CX + R - 4.5} ${s.chin - 14} C${CX + R - 4} ${temple + 6} ${CX + R * 0.4} ${hlBase - 2} ${CX + 7} ${top - 2.2} Z`} fill={hairFill} />
        <path d={`M${CX - 7} ${top - 2.2} C${CX - R} ${top + 2} ${CX - R - 2} ${temple + 4} ${CX - R - 1.5} ${s.chin - 4} L${CX - R + 4.5} ${s.chin - 14} C${CX - R + 4} ${temple + 6} ${CX - R * 0.4} ${hlBase - 2} ${CX - 7} ${top - 2.2} Z`} fill={hairFill} />
        {strands(s, top, 8, seed)}
      </g>
    );
  } else if (style === 'curly' || style === 'afro') {
    hairBack = curls(s, style === 'afro', seed);
    hairFront = <path d={capPath(s, top, style === 'afro' ? 4 : 2, style === 'afro' ? 6 : 4, hlBase - 0.5, temple)} fill={hairFill} />;
  } else if (style === 'bald') {
    hairFront = (
      <g>
        <path d={`M${CX - s.fw - 0.3} ${temple + 3} Q${CX - s.fw - 0.6} ${temple + 12} ${CX - s.fw + 1.5} ${temple + 18} L${CX - s.fw + 3} ${temple + 8} Z`} fill={s.hair.base} fillOpacity="0.55" />
        <path d={`M${CX + s.fw + 0.3} ${temple + 3} Q${CX + s.fw + 0.6} ${temple + 12} ${CX + s.fw - 1.5} ${temple + 18} L${CX + s.fw - 3} ${temple + 8} Z`} fill={s.hair.base} fillOpacity="0.55" />
        <ellipse cx={n2(CX - 6)} cy={n2(top + 5)} rx="7" ry="3.2" fill="#fff" fillOpacity="0.2" transform={`rotate(-14 ${CX - 6} ${top + 5})`} />
      </g>
    );
  }

  if (style !== 'bald' && style !== 'buzz') {
    const lift = style === 'afro' ? 6 : style === 'curly' ? 4 : style === 'side' ? 4 : 2.5;
    hairFront = (
      <g>
        {hairFront}
        <path d={`M${n2(CX - s.fw * 0.72)} ${n2(top + 5 - lift * 0.2)} Q${n2(CX - s.fw * 0.25)} ${n2(top - lift - 1.6)} ${n2(CX + s.fw * 0.4)} ${n2(top - lift - 0.8)}`} stroke="#fff" strokeOpacity="0.17" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    );
  }

  // ----- glasses
  const gx = eyeDx;
  const glasses = s.glasses ? (
    <g>
      {[-1, 1].map((m) => (
        <g key={m}>
          <rect x={n2(CX + m * gx - 6.6)} y={n2(eyeY - 4.4)} width="13.2" height="9" rx="3.6" fill="#bcd6ff" fillOpacity="0.12" stroke={s.glassTone} strokeWidth="1.1" />
          <path d={`M${n2(CX + m * gx - 4.4)} ${n2(eyeY - 3.2)} L${n2(CX + m * gx - 1.8)} ${n2(eyeY - 3.2)} L${n2(CX + m * gx - 3.6)} ${n2(eyeY + 3)}`} stroke="#fff" strokeOpacity="0.22" strokeWidth="0.8" fill="none" />
        </g>
      ))}
      <path d={`M${n2(CX - gx + 6.6)} ${n2(eyeY - 1)} Q${CX} ${n2(eyeY - 2.8)} ${n2(CX + gx - 6.6)} ${n2(eyeY - 1)}`} stroke={s.glassTone} strokeWidth="1" fill="none" />
      <path d={`M${n2(CX - gx - 6.6)} ${n2(eyeY - 1)} L${n2(CX - s.fw - 1)} ${n2(eyeY - 1.4)} M${n2(CX + gx + 6.6)} ${n2(eyeY - 1)} L${n2(CX + s.fw + 1)} ${n2(eyeY - 1.4)}`} stroke={s.glassTone} strokeWidth="1" fill="none" />
    </g>
  ) : null;

  // ----- ears
  const earY = eyeY + 3.4;
  const ears = (
    <g>
      {[-1, 1].map((m) => (
        <g key={m}>
          <ellipse cx={n2(CX + m * (s.fw + 0.4))} cy={n2(earY)} rx="3" ry="5.2" fill={s.skin.base} />
          <ellipse cx={n2(CX + m * (s.fw + 0.9))} cy={n2(earY + 0.4)} rx="1.3" ry="3" fill={s.skin.shade} fillOpacity="0.55" />
        </g>
      ))}
    </g>
  );

  const uniformPatch = s.patch;
  const tf = `translate(0 5) rotate(${n2(s.tilt)} ${CX} 78)`;

  return (
    <svg viewBox="5 3 90 93.6" width="100%" height="100%" role="img" aria-label="Portrait" preserveAspectRatio="xMidYMid slice" style={{ display: 'block' }}>
      <defs>
        <radialGradient id={ids.bg} cx="0.4" cy="0.3" r="0.95">
          <stop offset="0" stopColor={`hsl(${216 + s.backdropHue} 38% 27%)`} />
          <stop offset="0.6" stopColor={`hsl(${218 + s.backdropHue} 42% 15%)`} />
          <stop offset="1" stopColor={`hsl(${220 + s.backdropHue} 48% 8%)`} />
        </radialGradient>
        <radialGradient id={ids.glow} cx="0.66" cy="0.34" r="0.55">
          <stop offset="0" stopColor="#7fa6e6" stopOpacity="0.22" />
          <stop offset="1" stopColor="#7fa6e6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ids.fore} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#12060a" stopOpacity="0.5" />
          <stop offset="1" stopColor="#12060a" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={ids.vig} cx="0.5" cy="0.45" r="0.75">
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#02050c" stopOpacity="0.6" />
        </radialGradient>
        <linearGradient id={ids.face} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={s.skin.light} />
          <stop offset="0.45" stopColor={s.skin.base} />
          <stop offset="1" stopColor={s.skin.shade} />
        </linearGradient>
        <radialGradient id={ids.faceShade} cx="0.36" cy="0.34" r="0.78">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.42" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.8" stopColor="#1a0c06" stopOpacity="0.22" />
          <stop offset="1" stopColor="#1a0c06" stopOpacity="0.45" />
        </radialGradient>
        <linearGradient id={ids.neck} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.skin.shade} stopOpacity="0.95" />
          <stop offset="0.45" stopColor={s.skin.base} />
          <stop offset="1" stopColor={s.skin.shade} />
        </linearGradient>
        <linearGradient id={ids.uni} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#233a63" />
          <stop offset="0.55" stopColor="#15233f" />
          <stop offset="1" stopColor="#0c1528" />
        </linearGradient>
        <linearGradient id={ids.hair} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor={s.hair.light} />
          <stop offset="0.5" stopColor={s.hair.base} />
          <stop offset="1" stopColor={s.hair.dark} />
        </linearGradient>
        <radialGradient id={ids.iris} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.3" stopColor={s.iris} />
          <stop offset="1" stopColor="#000" stopOpacity="0.4" />
        </radialGradient>
        <radialGradient id={ids.blush} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={s.skin.lip} stopOpacity="0.32" />
          <stop offset="1" stopColor={s.skin.lip} stopOpacity="0" />
        </radialGradient>
        <clipPath id={ids.clip}>
          <path d={face} />
        </clipPath>
      </defs>

      <rect x="0" y="0" width="100" height="104" fill={`url(#${ids.bg})`} />
      <rect x="0" y="0" width="100" height="104" fill={`url(#${ids.glow})`} />

      <g transform={tf}>{hairBack}</g>

      {/* uniform: base, vest panels and straps */}
      <g transform="translate(0 -6)">
      <path d="M-2 104 L-2 95 C2 86 16 81 31 78 C37 76.5 40 75 41 73 L59 73 C60 75 63 76.5 69 78 C84 81 98 86 102 95 L102 104 Z" fill={`url(#${ids.uni})`} />
      <path d="M17 86 L33 79.5 L38 104 L4 104 L6 93 Z" fill="#09111f" fillOpacity="0.85" />
      <path d="M83 86 L67 79.5 L62 104 L96 104 L94 93 Z" fill="#09111f" fillOpacity="0.85" />
      <path d="M24 84 L31 81.5 M22 90 L33 86 M20 96 L35 91 M76 84 L69 81.5 M78 90 L67 86 M80 96 L65 91" stroke="#5f7aa8" strokeOpacity="0.28" strokeWidth="0.5" strokeDasharray="1.4 1.1" />
      <path d="M40.5 73 L50 92 L59.5 73 Z" fill="#0a1220" />
      </g>

      {/* neck sits over the undershirt, under the collar flaps */}
      <g transform={tf}>
        <path d={`M${n2(CX - neckHalf)} ${s.chin - 12} L${n2(CX - neckHalf)} 76 Q${CX} 81 ${n2(CX + neckHalf)} 76 L${n2(CX + neckHalf)} ${s.chin - 12} Z`} fill={`url(#${ids.neck})`} />
        <path d={`M${n2(CX - neckHalf)} ${s.chin - 4} Q${CX} ${s.chin + 9} ${n2(CX + neckHalf)} ${s.chin - 4} L${n2(CX + neckHalf)} ${s.chin - 12} L${n2(CX - neckHalf)} ${s.chin - 12} Z`} fill="#1a0c06" fillOpacity="0.32" />
      </g>

      <g transform="translate(0 -6)">
      <path d="M38 73.5 L50 93 L40.5 95 L28.5 84.5 Z" fill="#20375f" stroke="#3d5a8c" strokeOpacity="0.7" strokeWidth="0.6" />
      <path d="M62 73.5 L50 93 L59.5 95 L71.5 84.5 Z" fill="#1b2f52" stroke="#3d5a8c" strokeOpacity="0.7" strokeWidth="0.6" />
      <path d="M38 73.5 L50 93" stroke="#000" strokeOpacity="0.35" strokeWidth="0.8" />
      <g transform="translate(15 95) rotate(-18)">
        <path d="M-5.2 -4.6 H5.2 V2.2 Q5.2 6.2 0 7.8 Q-5.2 6.2 -5.2 2.2 Z" fill="#0f1f3c" stroke={uniformPatch} strokeWidth="0.9" />
        <path d="M0 -2.4 L1 0.4 L3.8 0.4 L1.5 2.2 L2.3 4.8 L0 3.2 L-2.3 4.8 L-1.5 2.2 L-3.8 0.4 L-1 0.4 Z" fill={uniformPatch} fillOpacity="0.9" />
      </g>
      <g transform="translate(68 97)">
        <path d="M-4.2 -3.4 H4.2 V1.8 Q4.2 4.8 0 6 Q-4.2 4.8 -4.2 1.8 Z" fill={uniformPatch} fillOpacity="0.85" stroke="#07101f" strokeWidth="0.5" />
        <circle cx="0" cy="0.9" r="1.4" fill="#0f1f3c" fillOpacity="0.7" />
      </g>
      <rect x="77" y="86" width="6.5" height="9" rx="1.4" fill="#0a0f1a" stroke="#2d3b57" strokeWidth="0.5" />
      <path d="M81 86 L81.4 80" stroke="#0a0f1a" strokeWidth="1" strokeLinecap="round" />
      </g>

      <g transform={tf}>
        {ears}
        {/* face */}
        <path d={face} fill={`url(#${ids.face})`} />
        <path d={face} fill={`url(#${ids.faceShade})`} />
        <g clipPath={`url(#${ids.clip})`}>
          <ellipse cx={n2(CX - eyeDx - 2)} cy={n2(noseY + 1)} rx="6" ry="4.4" fill={`url(#${ids.blush})`} />
          <ellipse cx={n2(CX + eyeDx + 2)} cy={n2(noseY + 1)} rx="6" ry="4.4" fill={`url(#${ids.blush})`} />
          <ellipse cx={CX} cy={n2(top + 9)} rx="12" ry="5" fill={s.skin.light} fillOpacity="0.22" />
          {style !== 'bald' && <rect x={CX - s.fw - 2} y={hlBase - 1} width={s.fw * 2 + 4} height="11" fill={`url(#${ids.fore})`} />}
          {[-1, 1].map((m) => (
            <g key={m}>
              <ellipse cx={n2(CX + m * eyeDx)} cy={n2(eyeY - 0.6)} rx="7.4" ry="4.8" fill={s.skin.shade} fillOpacity="0.2" />
              <ellipse cx={n2(CX + m * (eyeDx + 3.2))} cy={n2(noseY - 2.4)} rx="4.4" ry="2.6" fill={s.skin.light} fillOpacity={m < 0 ? 0.3 : 0.14} transform={`rotate(${m * -18} ${n2(CX + m * (eyeDx + 3.2))} ${n2(noseY - 2.4)})`} />
            </g>
          ))}
          <ellipse cx={CX} cy={n2(mouthY + lipH * 4.4)} rx="6" ry="2" fill={s.skin.shade} fillOpacity="0.25" />
          <path d={`M${CX + s.fw - 4} ${eyeY} Q${CX + s.fw - 1} ${n2(mouthY)} ${CX + s.jw - 2} ${s.chin - 8}`} stroke="#1a0c06" strokeOpacity="0.14" strokeWidth="4" fill="none" />
        </g>
        {nose}
        {eye(-1)}
        {eye(1)}
        {brow(-1)}
        {brow(1)}
        {!beardLayersOverMouth && mouth}
        {facialHair}
        {beardLayersOverMouth && mouth}
        {glasses}
        {hairFront}
      </g>
      <rect x="0" y="0" width="100" height="104" fill={`url(#${ids.vig})`} />
    </svg>
  );
}
