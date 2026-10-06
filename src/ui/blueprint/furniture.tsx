// Architectural plan symbols for placed objects, drawn in white ink. Pure SVG, no bitmaps.
// Each symbol is authored in a local frame (origin top-left, size lw x lh) with the "back" (wall /
// headboard / seat back) along y = 0. orientObject() chooses the frame from the object footprint,
// its rotation and the nearest wall, so furniture sits against walls the way the layout implies.
import type { ReactNode } from 'react';
import type { LocationDefinition, ObjectType, PlacedObject, Polygon, Vec } from '../../sim/types';
import { distToPolygonEdges, hash32, r2, type Rect } from './geometry';

type Side = 'N' | 'E' | 'S' | 'W';
const ROT: Record<Side, number> = { N: 0, E: 90, S: 180, W: 270 };

/** Which footprint side carries the back. 'facing' types look toward a target instead of a wall. */
const BACKED: Partial<Record<ObjectType, 'long' | 'short' | 'any' | 'facing'>> = {
  bed: 'short',
  nightstand: 'any',
  dresser: 'long',
  wardrobe: 'long',
  desk: 'long',
  sofa: 'long',
  tv: 'long',
  counter: 'long',
  sink: 'long',
  stove: 'long',
  fridge: 'long',
  toilet: 'short',
  vanity: 'long',
  shelf: 'long',
  register: 'long',
  armchair: 'facing',
  chair: 'facing',
};

const WALL_SNAP = 2.2;

/** Axis-aligned footprint after rotation about the centre. */
export function objectRect(o: PlacedObject): Rect {
  if (o.rotation === 90 || o.rotation === 270) {
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    return { x: cx - o.h / 2, y: cy - o.w / 2, w: o.h, h: o.w };
  }
  return { x: o.x, y: o.y, w: o.w, h: o.h };
}

function spacePoly(loc: LocationDefinition, id: string): Polygon | null {
  return loc.rooms.find((r) => r.id === id)?.polygon ?? loc.zones.find((z) => z.id === id)?.polygon ?? null;
}

const sideMid = (r: Rect, s: Side): Vec =>
  s === 'N' ? { x: r.x + r.w / 2, y: r.y } : s === 'S' ? { x: r.x + r.w / 2, y: r.y + r.h } : s === 'W' ? { x: r.x, y: r.y + r.h / 2 } : { x: r.x + r.w, y: r.y + r.h / 2 };

const opposite = (s: Side): Side => (s === 'N' ? 'S' : s === 'S' ? 'N' : s === 'E' ? 'W' : 'E');

function facingSide(from: Rect, to: Rect): Side {
  const dx = to.x + to.w / 2 - (from.x + from.w / 2);
  const dy = to.y + to.h / 2 - (from.y + from.h / 2);
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : dy > 0 ? 'S' : 'N';
}

export interface Oriented {
  back: Side;
  rect: Rect;
  /** Local frame size (back along lw). */
  lw: number;
  lh: number;
  rot: number;
}

export function orientObject(o: PlacedObject, loc: LocationDefinition): Oriented {
  const rect = objectRect(o);
  // New layouts solve orientation and clearance together. Do not reverse their
  // seat backs afterward using a nearest-wall guess; legacy symbols keep it.
  if (o.placement) {
    const back = o.placement.back;
    return { back, rect, lw: back === 'N' || back === 'S' ? rect.w : rect.h,
      lh: back === 'N' || back === 'S' ? rect.h : rect.w, rot: ROT[back] };
  }
  const kind = BACKED[o.type];
  if (!kind) return { back: 'N', rect, lw: rect.w, lh: rect.h, rot: 0 };

  let candidates: Side[];
  const square = Math.abs(rect.w - rect.h) / Math.max(rect.w, rect.h) < 0.18;
  if (square || kind === 'any' || kind === 'facing') candidates = ['N', 'E', 'S', 'W'];
  else {
    const wide = rect.w >= rect.h;
    const longSides: Side[] = wide ? ['N', 'S'] : ['E', 'W'];
    const shortSides: Side[] = wide ? ['E', 'W'] : ['N', 'S'];
    candidates = kind === 'long' ? longSides : shortSides;
  }

  const defaultSide = (['N', 'E', 'S', 'W'] as Side[])[Math.round(o.rotation / 90) % 4];
  let back: Side = candidates.includes(defaultSide) ? defaultSide : candidates[0];

  if (kind === 'facing') {
    const target = loc.objects.find((t) => t.in === o.in && t.id !== o.id && (o.type === 'chair' ? t.type === 'dining_table' : t.type === 'coffee_table' || t.type === 'tv'));
    const poly = spacePoly(loc, o.in);
    if (target) back = opposite(facingSide(rect, objectRect(target)));
    else if (poly) {
      const best = candidates.map((s) => ({ s, d: distToPolygonEdges(sideMid(rect, s), poly) })).sort((a, b) => a.d - b.d)[0];
      back = best.s;
    }
  } else {
    const poly = spacePoly(loc, o.in);
    if (poly) {
      const ranked = candidates.map((s) => ({ s, d: distToPolygonEdges(sideMid(rect, s), poly) })).sort((a, b) => a.d - b.d);
      if (ranked[0].d <= WALL_SNAP) back = ranked[0].s;
    }
  }

  const lw = back === 'N' || back === 'S' ? rect.w : rect.h;
  const lh = back === 'N' || back === 'S' ? rect.h : rect.w;
  return { back, rect, lw, lh, rot: ROT[back] };
}

// ------------------------------------------------------------------ symbol helpers

const rr = (x: number, y: number, w: number, h: number, rx: number, cls?: string): ReactNode => (
  <rect key={`r${r2(x)},${r2(y)},${r2(w)},${r2(h)}`} x={r2(x)} y={r2(y)} width={r2(Math.max(0, w))} height={r2(Math.max(0, h))} rx={rx} className={cls} />
);
const ln = (x1: number, y1: number, x2: number, y2: number, cls?: string): ReactNode => (
  <line key={`l${r2(x1)},${r2(y1)},${r2(x2)},${r2(y2)}`} x1={r2(x1)} y1={r2(y1)} x2={r2(x2)} y2={r2(y2)} className={cls} />
);
const circ = (cx: number, cy: number, r: number, cls?: string): ReactNode => <circle key={`c${r2(cx)},${r2(cy)},${r2(r)}`} cx={r2(cx)} cy={r2(cy)} r={r2(r)} className={cls} />;

/** Closed scalloped circle: n outward bumps. */
function scallop(cx: number, cy: number, R: number, n: number, phase = 0): string {
  const pts: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R });
  }
  const chord = 2 * R * Math.sin(Math.PI / n);
  const ar = chord * 0.62;
  let d = `M${r2(pts[0].x)} ${r2(pts[0].y)}`;
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n];
    d += ` A${r2(ar)} ${r2(ar)} 0 0 1 ${r2(p.x)} ${r2(p.y)}`;
  }
  return d + ' Z';
}

function flower(cx: number, cy: number, R: number, n: number, phase: number): ReactNode {
  const petals: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    const deg = (a * 180) / Math.PI;
    petals.push(<ellipse key={i} cx={r2(cx + Math.cos(a) * R * 0.52)} cy={r2(cy + Math.sin(a) * R * 0.52)} rx={r2(R * 0.5)} ry={r2(R * 0.22)} transform={`rotate(${r2(deg)} ${r2(cx + Math.cos(a) * R * 0.52)} ${r2(cy + Math.sin(a) * R * 0.52)})`} className="bp-solid" />);
  }
  return (
    <g>
      {petals}
      {circ(cx, cy, R * 0.16, 'bp-solid')}
    </g>
  );
}

// ------------------------------------------------------------------ local-frame symbols

type Sym = (lw: number, lh: number, id: string, uid: string) => ReactNode;

const bed: Sym = (lw, lh) => {
  const pillowCount = lw > 5 ? 2 : 1;
  const gap = 0.3;
  const pw = (lw - gap * (pillowCount + 1)) / pillowCount;
  const ph = Math.min(1.8, lh * 0.22);
  const by = lh * 0.38;
  return (
    <g>
      {rr(0, 0, lw, lh, 0.25, 'bp-solid bp-ink2')}
      {rr(0.18, 0.18, lw - 0.36, lh - 0.36, 0.15, 'bp-faint')}
      {rr(0, 0, lw, 0.42, 0.2, 'bp-chalkfill')}
      {Array.from({ length: pillowCount }, (_, i) => (
        <g key={i}>
          {rr(gap + i * (pw + gap), 0.7, pw, ph, 0.45, 'bp-soft')}
          {ln(gap + i * (pw + gap) + pw * 0.2, 0.7 + ph * 0.5, gap + i * (pw + gap) + pw * 0.8, 0.7 + ph * 0.5, 'bp-faint')}
        </g>
      ))}
      <path d={`M0.18 ${r2(by)} L${r2(lw - 0.18)} ${r2(by)} L${r2(lw - 0.18)} ${r2(lh - 0.18)} L0.18 ${r2(lh - 0.18)} Z`} className="bp-soft" />
      {/* turned-down sheet */}
      <path d={`M0.18 ${r2(by)} L${r2(lw - 0.18)} ${r2(by)} L${r2(lw - 0.18)} ${r2(by + 0.85)} L${r2(lw / 2)} ${r2(by + 1.15)} L0.18 ${r2(by + 0.85)} Z`} className="bp-soft" />
      {ln(lw * 0.34, by + 1.5, lw * 0.34, lh - 0.4, 'bp-faint')}
      {ln(lw * 0.66, by + 1.5, lw * 0.66, lh - 0.4, 'bp-faint')}
      {ln(0.5, lh * 0.72, lw - 0.5, lh * 0.72, 'bp-faint')}
    </g>
  );
};

const nightstand: Sym = (lw, lh) => (
  <g>
    {rr(0, 0, lw, lh, 0.12, 'bp-solid bp-ink2')}
    {rr(0.22, 0.22, lw - 0.44, lh - 0.44, 0.08, 'bp-faint')}
    {circ(lw / 2, lh / 2, Math.min(lw, lh) * 0.2)}
    {circ(lw / 2, lh / 2, Math.min(lw, lh) * 0.07, 'bp-chalkfill')}
  </g>
);

const dresser: Sym = (lw, lh) => (
  <g>
    {rr(0, 0, lw, lh, 0.1, 'bp-solid bp-ink2')}
    {rr(0.2, 0.2, lw - 0.4, lh - 0.4, 0.06, 'bp-faint')}
    {[1, 2].map((i) => ln((lw * i) / 3, 0.35, (lw * i) / 3, lh - 0.35, 'bp-faint'))}
    {[1, 3, 5].map((i) => circ((lw * i) / 6, lh - 0.55, 0.1, 'bp-chalkfill'))}
  </g>
);

const wardrobe: Sym = (lw, lh) => {
  const ticks: ReactNode[] = [];
  for (let x = 0.6; x < lw - 0.4; x += 0.55) ticks.push(ln(x, lh * 0.32, x + 0.12, lh * 0.7, 'bp-faint'));
  return (
    <g>
      {rr(0, 0, lw, lh, 0.08, 'bp-solid bp-ink2')}
      {ln(0.2, 0.55, lw - 0.2, 0.55, 'bp-faint')}
      {ln(0.2, lh * 0.5, lw - 0.2, lh * 0.5)}
      {ticks}
      {ln(lw / 2, lh - 0.5, lw / 2, lh, 'bp-ink')}
    </g>
  );
};

const desk: Sym = (lw, lh) => (
  <g>
    {rr(0, 0, lw, lh, 0.08, 'bp-solid bp-ink2')}
    {rr(lw - lw * 0.28, 0.12, lw * 0.28 - 0.12, lh - 0.24, 0.05, 'bp-faint')}
    {ln(lw - lw * 0.28, lh / 2, lw - 0.12, lh / 2, 'bp-faint')}
    {rr(lw * 0.18, lh * 0.3, lw * 0.22, lh * 0.4, 0.05, 'bp-faint')}
  </g>
);

const sofa: Sym = (lw, lh) => {
  const arm = Math.min(0.85, lw * 0.1);
  const back = Math.min(0.9, lh * 0.32);
  const n = Math.max(2, Math.round((lw - 2 * arm) / 2.3));
  const cw = (lw - 2 * arm) / n;
  return (
    <g>
      {rr(0, 0, lw, lh, 0.3, 'bp-solid bp-ink2')}
      {rr(arm, 0, lw - 2 * arm, back, 0.2, 'bp-soft')}
      {rr(0, 0.1, arm, lh - 0.1, 0.25, 'bp-soft')}
      {rr(lw - arm, 0.1, arm, lh - 0.1, 0.25, 'bp-soft')}
      {Array.from({ length: n }, (_, i) => rr(arm + i * cw + 0.07, back + 0.05, cw - 0.14, lh - back - 0.2, 0.2, 'bp-soft'))}
      {Array.from({ length: n }, (_, i) => circ(arm + i * cw + cw / 2, back + (lh - back) * 0.5, 0.07, 'bp-chalkfill'))}
    </g>
  );
};

const armchair: Sym = (lw, lh) => {
  const arm = Math.min(0.7, lw * 0.22);
  const back = Math.min(0.85, lh * 0.3);
  return (
    <g>
      {rr(0, 0, lw, lh, 0.4, 'bp-solid bp-ink2')}
      {rr(0.05, 0.05, lw - 0.1, back, 0.3, 'bp-soft')}
      {rr(0.05, back * 0.6, arm, lh - back * 0.6 - 0.1, 0.25, 'bp-soft')}
      {rr(lw - arm - 0.05, back * 0.6, arm, lh - back * 0.6 - 0.1, 0.25, 'bp-soft')}
      {rr(arm + 0.12, back + 0.05, lw - 2 * arm - 0.24, lh - back - 0.25, 0.3, 'bp-soft')}
      {circ(lw / 2, back + (lh - back) / 2, 0.08, 'bp-chalkfill')}
    </g>
  );
};

const tv: Sym = (lw, lh) => (
  <g>
    {rr(0, 0, lw, Math.min(lh, 0.5), 0.05, 'bp-solid bp-ink2')}
    {rr(lw * 0.3, Math.min(lh, 0.5), lw * 0.4, Math.max(0.1, lh - 0.5), 0.05, 'bp-faint')}
  </g>
);

const coffeeTable: Sym = (lw, lh) => (
  <g>
    {rr(0, 0, lw, lh, Math.min(lw, lh) * 0.5, 'bp-solid bp-ink2')}
    {rr(0.28, 0.28, lw - 0.56, lh - 0.56, Math.min(lw, lh) * 0.35, 'bp-faint')}
    {circ(lw / 2, lh / 2, Math.min(lw, lh) * 0.16)}
    {flower(lw / 2, lh / 2, Math.min(lw, lh) * 0.2, 5, 0.3)}
  </g>
);

const rug: Sym = (lw, lh, id, uid) => {
  const pid = `${uid}-rug-${id}`;
  return (
    <g>
      <defs>
        <pattern id={pid} width="0.9" height="0.9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0.45H0.9M0.45 0V0.9" className="bp-rugline" />
        </pattern>
      </defs>
      {rr(0, 0, lw, lh, 0.15, 'bp-rugfill')}
      <rect x="0.5" y="0.5" width={r2(lw - 1)} height={r2(lh - 1)} fill={`url(#${pid})`} stroke="none" />
      {rr(0.18, 0.18, lw - 0.36, lh - 0.36, 0.1, 'bp-faint')}
      {rr(0.5, 0.5, lw - 1, lh - 1, 0.06, 'bp-faint')}
      {Array.from({ length: Math.floor(lw / 0.6) }, (_, i) => ln(0.4 + i * 0.6, -0.28, 0.4 + i * 0.6, 0, 'bp-faint'))}
      {Array.from({ length: Math.floor(lw / 0.6) }, (_, i) => ln(0.4 + i * 0.6, lh, 0.4 + i * 0.6, lh + 0.28, 'bp-faint'))}
    </g>
  );
};

const diningTable: Sym = (lw, lh) => (
  <g>
    {rr(0, 0, lw, lh, 0.3, 'bp-solid bp-ink2')}
    {rr(0.26, 0.26, lw - 0.52, lh - 0.52, 0.2, 'bp-faint')}
    {rr(lw / 2 - 0.9, lh / 2 - 0.28, 1.8, 0.56, 0.28)}
    {[0.22, 0.78].flatMap((fx) => [0.18, 0.82].map((fy) => circ(lw * fx, lh * fy, 0.26, 'bp-faint')))}
  </g>
);

const chair: Sym = (lw, lh) => (
  <g>
    {rr(0, 0, lw, lh, 0.3, 'bp-solid bp-ink2')}
    {rr(0.05, 0, lw - 0.1, Math.min(0.45, lh * 0.32), 0.2, 'bp-chalkfill')}
    {rr(lw * 0.2, lh * 0.45, lw * 0.6, lh * 0.42, 0.2, 'bp-faint')}
  </g>
);

const counter: Sym = (lw, lh) => {
  const n = Math.max(2, Math.round(lw / 2));
  return (
    <g>
      {rr(0, 0, lw, lh, 0.06, 'bp-solid bp-ink2')}
      {rr(0.18, 0.18, lw - 0.36, lh - 0.36, 0.04, 'bp-faint')}
      {Array.from({ length: n - 1 }, (_, i) => ln(((i + 1) * lw) / n, lh * 0.5, ((i + 1) * lw) / n, lh, 'bp-faint'))}
      {Array.from({ length: n }, (_, i) => circ(((i + 0.5) * lw) / n, lh - 0.32, 0.08, 'bp-chalkfill'))}
    </g>
  );
};

const stove: Sym = (lw, lh) => {
  const r = Math.min(lw * 0.17, lh * 0.2);
  const cxs = [lw * 0.27, lw * 0.73];
  const cys = [lh * 0.32, lh * 0.72];
  return (
    <g>
      {rr(0, 0, lw, lh, 0.08, 'bp-solid bp-ink2')}
      {cxs.flatMap((cx) =>
        cys.map((cy) => (
          <g key={`${cx}-${cy}`}>
            {circ(cx, cy, r)}
            {circ(cx, cy, r * 0.5)}
          </g>
        )),
      )}
      {[0.2, 0.4, 0.6, 0.8].map((f) => circ(lw * f, lh - 0.14, 0.07, 'bp-chalkfill'))}
    </g>
  );
};

const sink: Sym = (lw, lh) => {
  const two = lw > 2.8;
  const bw = two ? (lw - 0.9) / 2 : lw - 0.7;
  return (
    <g>
      {rr(0, 0, lw, lh, 0.08, 'bp-solid bp-ink2')}
      {Array.from({ length: two ? 2 : 1 }, (_, i) => rr(0.3 + i * (bw + 0.3), 0.55, bw, lh - 0.85, 0.3, 'bp-soft'))}
      {Array.from({ length: two ? 2 : 1 }, (_, i) => circ(0.3 + i * (bw + 0.3) + bw / 2, 0.55 + (lh - 0.85) / 2, 0.1))}
      {circ(lw / 2, 0.27, 0.13)}
      {ln(lw / 2, 0.27, lw / 2, 0.55)}
    </g>
  );
};

const fridge: Sym = (lw, lh) => (
  <g>
    {rr(0, 0, lw, lh, 0.08, 'bp-solid bp-ink2')}
    {rr(0.12, 0.12, lw - 0.24, lh - 0.24, 0.05, 'bp-faint')}
    {ln(lw - 0.3, lh * 0.2, lw - 0.3, lh * 0.45)}
  </g>
);

const toilet: Sym = (lw, lh) => {
  const tank = Math.min(0.85, lh * 0.3);
  return (
    <g>
      {rr(0.05, 0, lw - 0.1, tank, 0.12, 'bp-solid bp-ink2')}
      <ellipse cx={r2(lw / 2)} cy={r2(tank + (lh - tank) / 2 - 0.02)} rx={r2(lw * 0.44)} ry={r2((lh - tank) / 2)} className="bp-solid bp-ink2" />
      <ellipse cx={r2(lw / 2)} cy={r2(tank + (lh - tank) / 2 + 0.05)} rx={r2(lw * 0.3)} ry={r2((lh - tank) * 0.34)} className="bp-faint" />
      {circ(lw / 2, tank / 2, 0.1, 'bp-chalkfill')}
    </g>
  );
};

/** Tub is drawn in the world frame (long axis follows the footprint). */
const tub: Sym = (lw, lh) => {
  const tall = lh > lw;
  const m = 0.34;
  return (
    <g>
      {rr(0, 0, lw, lh, 0.3, 'bp-solid bp-ink2')}
      {rr(m, m, lw - 2 * m, lh - 2 * m, Math.min(lw, lh) * 0.35, 'bp-soft')}
      {tall ? circ(lw / 2, lh - m - 0.5, 0.14) : circ(m + 0.5, lh / 2, 0.14)}
      {tall ? circ(lw / 2, m + 0.34, 0.1, 'bp-chalkfill') : circ(lw - m - 0.34, lh / 2, 0.1, 'bp-chalkfill')}
    </g>
  );
};

const vanity: Sym = (lw, lh) => (
  <g>
    {rr(0, 0, lw, lh, 0.08, 'bp-solid bp-ink2')}
    <ellipse cx={r2(lw / 2)} cy={r2(lh * 0.58)} rx={r2(Math.min(lw * 0.36, 0.95))} ry={r2(lh * 0.28)} className="bp-soft" />
    {circ(lw / 2, 0.3, 0.1)}
    {circ(lw / 2, lh * 0.58, 0.08, 'bp-chalkfill')}
  </g>
);

const shelf: Sym = (lw, lh) => (
  <g>
    {rr(0, 0, lw, lh, 0.04, 'bp-solid bp-ink2')}
    {ln(0, 0, lw, lh, 'bp-faint')}
    {ln(lw, 0, 0, lh, 'bp-faint')}
  </g>
);

const register: Sym = (lw, lh) => (
  <g>
    {rr(0, 0, lw, lh, 0.06, 'bp-solid bp-ink2')}
    {rr(lw * 0.15, 0.15, lw * 0.4, lh * 0.45, 0.04, 'bp-soft')}
    {rr(lw * 0.62, 0.15, lw * 0.23, lh * 0.5, 0.04, 'bp-faint')}
  </g>
);

const steps: Sym = (lw, lh) => {
  // treads run across x; direction of descent is +y
  const n = Math.max(3, Math.round(lh / 0.85));
  return (
    <g>
      {rr(0, 0, lw, lh, 0.04, 'bp-solid bp-ink2')}
      {Array.from({ length: n - 1 }, (_, i) => ln(0, ((i + 1) * lh) / n, lw, ((i + 1) * lh) / n))}
      {ln(0.35, 0, 0.35, lh, 'bp-faint')}
      {ln(lw - 0.35, 0, lw - 0.35, lh, 'bp-faint')}
    </g>
  );
};

const fence: Sym = (lw, lh) => {
  const horizontal = lw > lh;
  const L = horizontal ? lw : lh;
  const n = Math.max(2, Math.round(L / 4));
  const posts: ReactNode[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * L;
    posts.push(horizontal ? rr(t - 0.3, lh / 2 - 0.3, 0.6, 0.6, 0.05, 'bp-solid bp-ink') : rr(lw / 2 - 0.3, t - 0.3, 0.6, 0.6, 0.05, 'bp-solid bp-ink'));
  }
  const off = 0.18;
  return (
    <g>
      {horizontal ? (
        <g>
          {ln(0, lh / 2 - off, lw, lh / 2 - off)}
          {ln(0, lh / 2 + off, lw, lh / 2 + off)}
        </g>
      ) : (
        <g>
          {ln(lw / 2 - off, 0, lw / 2 - off, lh)}
          {ln(lw / 2 + off, 0, lw / 2 + off, lh)}
        </g>
      )}
      {posts}
    </g>
  );
};

const shrub: Sym = (lw, lh, id) => {
  const R = Math.min(lw, lh) / 2;
  const h = hash32(id);
  const n = 8 + (h % 3);
  const cx = lw / 2;
  const cy = lh / 2;
  const leaves: ReactNode[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + (h % 100) / 40;
    leaves.push(ln(cx + Math.cos(a) * R * 0.2, cy + Math.sin(a) * R * 0.2, cx + Math.cos(a) * R * 0.62, cy + Math.sin(a) * R * 0.62, 'bp-faint'));
  }
  return (
    <g>
      <path d={scallop(cx, cy, R * 0.86, n, (h % 360) * 0.0174)} className="bp-solid bp-ink2" />
      <path d={scallop(cx, cy, R * 0.5, 6, 0.4)} className="bp-soft bp-ink" />
      {leaves}
      {circ(cx, cy, R * 0.07, 'bp-chalkfill')}
    </g>
  );
};

const tree: Sym = (lw, lh, id) => {
  const R = Math.min(lw, lh) / 2;
  const h = hash32(id);
  const cx = lw / 2;
  const cy = lh / 2;
  const branches: ReactNode[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + (h % 90) / 30;
    branches.push(ln(cx, cy, cx + Math.cos(a) * R * 0.78, cy + Math.sin(a) * R * 0.78, 'bp-faint'));
  }
  return (
    <g>
      <path d={scallop(cx, cy, R * 0.9, 14, 0.2)} className="bp-solid bp-ink2" />
      <path d={scallop(cx, cy, R * 0.62, 10, 0.5)} className="bp-ink" />
      {branches}
      {circ(cx, cy, R * 0.11, 'bp-chalkfill')}
      {circ(cx, cy, R * 0.2)}
    </g>
  );
};

const plant: Sym = (lw, lh, id) => {
  const R = Math.min(lw, lh) / 2;
  const h = hash32(id);
  return (
    <g>
      {circ(lw / 2, lh / 2, R, 'bp-faint')}
      {flower(lw / 2, lh / 2, R * 0.95, 6 + (h % 3), (h % 60) / 30)}
    </g>
  );
};

const SYMBOLS: Record<ObjectType, Sym> = {
  bed,
  nightstand,
  dresser,
  wardrobe,
  desk,
  sofa,
  armchair,
  coffee_table: coffeeTable,
  rug,
  tv,
  dining_table: diningTable,
  chair,
  counter,
  sink,
  stove,
  fridge,
  toilet,
  tub,
  vanity,
  shelf,
  register,
  plant,
  shrub,
  tree,
  steps,
  fence,
};

/** Objects drawn on the floor beneath everything else. */
const FLOOR_LAYER = new Set<ObjectType>(['rug']);
export const isFloorLayer = (t: ObjectType): boolean => FLOOR_LAYER.has(t);

export function ObjectSymbol({ o, loc, uid }: { o: PlacedObject; loc: LocationDefinition; uid: string }) {
  const ori = orientObject(o, loc);
  const { rect, lw, lh, rot } = ori;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const transform = `translate(${r2(cx)} ${r2(cy)}) rotate(${rot}) translate(${r2(-lw / 2)} ${r2(-lh / 2)})`;
  const hasBack = o.placement !== undefined || BACKED[o.type] !== undefined;
  const w = hasBack ? lw : rect.w;
  const h = hasBack ? lh : rect.h;
  const tf = hasBack ? transform : `translate(${r2(rect.x)} ${r2(rect.y)})`;
  return (
    <g className={`bp-obj bp-obj-${o.type}`} transform={tf} data-object={o.id}>
      {SYMBOLS[o.type](w, h, o.id, uid)}
    </g>
  );
}

/** Fridge label is drawn in the world frame so it always reads horizontally. */
export function ObjectLabels({ objects }: { objects: PlacedObject[] }) {
  return (
    <g className="bp-objlabels">
      {objects
        .filter((o) => o.type === 'fridge')
        .map((o) => {
          const r = objectRect(o);
          return (
            <text key={o.id} x={r2(r.x + r.w / 2)} y={r2(r.y + r.h / 2 + 0.38)} textAnchor="middle" className="bp-reflabel">
              REF
            </text>
          );
        })}
    </g>
  );
}
