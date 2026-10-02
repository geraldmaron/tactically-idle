// Spatial explanation of the selected action, drawn by hand-marker strokes above the rooms and below the labels:
//   line  - staging point to target, mint (clear), amber dashed (partial), orange dashed with a cross at the first blocker
//   range - effective range ring (almost solid) and maximum range ring (faint dashed)
//   path  - dotted travel path with an arrowhead
// Pure placement (feet) is separate from rendering so label positions can dodge the rest of the drawing.
import type { BuiltLocation, MapOverlay, Vec } from '../../sim/types';
import { add, areaOutside, distToSegment, len, perp, r2, rectsOverlapArea, scale, seeded, segIntersectT, smoothPath, sub, unit, type Rect } from './geometry';
import { FONT } from './layout';
import { arrowShape } from './markers';
import { objectRect } from './furniture';

const W_MARKER = 0.52;

export interface OverlayLabel {
  text: string;
  x: number;
  y: number;
}

export type OverlayItem =
  | { key: string; kind: 'line'; tone: 'clear' | 'blocked' | 'partial'; d: string; head: string; from: Vec; blockAt: Vec | null; label: OverlayLabel | null }
  | { key: string; kind: 'range'; tone: 'effective' | 'max'; d: string; at: Vec; r: number; label: OverlayLabel | null }
  | { key: string; kind: 'path'; d: string; head: string; label: OverlayLabel | null };

/** First wall, closed door/window, or sight-blocking object the straight line meets, in feet; null when it meets none. */
export function firstBlocker(built: BuiltLocation, from: Vec, to: Vec): Vec | null {
  const loc = built.location;
  const hits: number[] = [];
  const passable = (p: Vec) =>
    loc.openings.some((o) => (o.type === 'doorway' || (o.type === 'door' && o.state === 'open')) && distToSegment(p, o.from, o.to) < 0.4);
  const lerp = (t: number): Vec => add(from, scale(sub(to, from), t));
  const seen = new Set<string>();
  for (const r of loc.rooms) {
    for (let i = 0; i < r.polygon.length; i++) {
      const a = r.polygon[i];
      const b = r.polygon[(i + 1) % r.polygon.length];
      const t = segIntersectT(from, to, a, b);
      if (t === null || t < 0.02) continue;
      const k = t.toFixed(3);
      if (seen.has(k)) continue;
      seen.add(k);
      if (!passable(lerp(t))) hits.push(t);
    }
  }
  for (const o of loc.objects) {
    if (!o.tags.includes('blocks_sight') && !o.tags.includes('concealment')) continue;
    const rc = objectRect(o);
    const corners: Vec[] = [
      { x: rc.x, y: rc.y },
      { x: rc.x + rc.w, y: rc.y },
      { x: rc.x + rc.w, y: rc.y + rc.h },
      { x: rc.x, y: rc.y + rc.h },
    ];
    for (let i = 0; i < 4; i++) {
      const t = segIntersectT(from, to, corners[i], corners[(i + 1) % 4]);
      if (t !== null && t >= 0.02) hits.push(t);
    }
  }
  if (!hits.length) return null;
  return lerp(Math.min(...hits));
}

function handLine(from: Vec, to: Vec, key: string): string {
  const L = len(sub(to, from));
  const n = perp(unit(sub(to, from)));
  const rnd = seeded(key);
  const amp = Math.min(0.2, L * 0.012);
  const steps = Math.max(2, Math.min(7, Math.round(L / 4)));
  const pts: Vec[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const wob = i === 0 || i === steps ? 0 : (rnd() - 0.5) * 2 * amp;
    pts.push(add(add(from, scale(sub(to, from), t)), scale(n, wob)));
  }
  return smoothPath(pts);
}

interface Placer {
  obstacles: Rect[];
  frame: Rect;
}

function labelBox(text: string, size: number): { w: number; h: number } {
  return { w: text.length * W_MARKER * size * 0.95 + 0.6, h: size * 1.2 };
}

/** Picks the first-best centre among candidates: inside the frame, off furniture and earlier text. */
function placeLabel(text: string, cands: Vec[], pl: Placer): OverlayLabel {
  const size = FONT.overlay;
  const { w, h } = labelBox(text, size);
  let best: { c: Vec; score: number } | null = null;
  cands.forEach((c, i) => {
    const rect: Rect = { x: c.x - w / 2, y: c.y - h / 2, w, h };
    let ov = 0;
    for (const o of pl.obstacles) ov += rectsOverlapArea(rect, o);
    const score = ov * 20 + areaOutside(rect, pl.frame) * 90 + i * 0.25;
    if (!best || score < best.score) best = { c, score };
  });
  const c = best!.c;
  pl.obstacles.push({ x: c.x - w / 2, y: c.y - h / 2, w, h });
  return { text, x: c.x, y: c.y + size * 0.34 };
}

function ringPath(at: Vec, r: number): string {
  return `M${r2(at.x - r)} ${r2(at.y)} A${r2(r)} ${r2(r)} 0 1 1 ${r2(at.x + r)} ${r2(at.y)} A${r2(r)} ${r2(r)} 0 1 1 ${r2(at.x - r)} ${r2(at.y)}`;
}

export function placeOverlays(built: BuiltLocation, overlays: MapOverlay[], frame: Rect, obstacles: Rect[]): OverlayItem[] {
  const pl: Placer = { obstacles: [...obstacles], frame };
  const out: OverlayItem[] = [];
  overlays.forEach((ov, i) => {
    const key = `${i}:${ov.kind}`;
    if (ov.kind === 'line') {
      const d = handLine(ov.from, ov.to, `${key}:${ov.from.x},${ov.from.y}:${ov.to.x},${ov.to.y}`);
      const dir = unit(sub(ov.to, ov.from));
      const L = len(sub(ov.to, ov.from));
      const head = L > 1.2 ? arrowShape(sub(ov.to, scale(dir, 1.2)), ov.to, 0, 0.95).head : '';
      let label: OverlayLabel | null = null;
      if (ov.label) {
        const n = perp(dir);
        const { h } = labelBox(ov.label, FONT.overlay);
        const cands: Vec[] = [];
        for (const t of [0.5, 0.38, 0.62, 0.27, 0.73]) for (const side of [1, -1]) cands.push(add(add(ov.from, scale(sub(ov.to, ov.from), t)), scale(n, side * (h / 2 + 0.7))));
        label = placeLabel(ov.label, cands, pl);
      }
      const blockAt = ov.tone === 'blocked' ? (ov.blockedAt ?? firstBlocker(built, ov.from, ov.to)) : null;
      out.push({ key, kind: 'line', tone: ov.tone, d, head, from: ov.from, blockAt, label });
    } else if (ov.kind === 'range') {
      let label: OverlayLabel | null = null;
      if (ov.label) {
        const { w, h } = labelBox(ov.label, FONT.overlay);
        const cands: Vec[] = [];
        for (let k = 0; k < 16; k++) {
          const th = -Math.PI / 4 + (k / 16) * Math.PI * 2;
          const ux = Math.cos(th);
          const uy = Math.sin(th);
          cands.push({ x: ov.at.x + ux * (ov.radius + 0.4 + (w / 2) * Math.abs(ux)), y: ov.at.y + uy * (ov.radius + 0.4 + (h / 2) * Math.abs(uy)) + (uy > 0 ? 0 : 0) });
        }
        label = placeLabel(ov.label, cands, pl);
      }
      out.push({ key, kind: 'range', tone: ov.tone, d: ringPath(ov.at, ov.radius), at: ov.at, r: ov.radius, label });
    } else {
      if (ov.points.length < 2) return;
      // Travel follows the supplied route vertices. Smoothing can cut a corner through a wall.
      const d = ov.points.map((p, j) => `${j ? 'L' : 'M'}${r2(p.x)} ${r2(p.y)}`).join(' ');
      const last = ov.points[ov.points.length - 1];
      const prev = ov.points[ov.points.length - 2];
      const head = arrowShape(prev, last, 0, 1.0).head;
      let label: OverlayLabel | null = null;
      if (ov.label) {
        const m = ov.points[Math.floor((ov.points.length - 1) / 2)];
        const { h } = labelBox(ov.label, FONT.overlay);
        const cands = [0, 1, 2, 3].flatMap((k) => [
          { x: m.x, y: m.y - (h / 2 + 0.9 + k * 0.6) },
          { x: m.x, y: m.y + (h / 2 + 0.9 + k * 0.6) },
        ]);
        label = placeLabel(ov.label, cands, pl);
      }
      out.push({ key, kind: 'path', d, head, label });
    }
  });
  return out;
}

function Label({ l, cls }: { l: OverlayLabel; cls: string }) {
  return (
    <text x={r2(l.x)} y={r2(l.y)} textAnchor="middle" className={`bp-ov-label bp-ov-fade ${cls}`}>
      {l.text}
    </text>
  );
}

export function OverlayLayer({ items, uid, frame }: { items: OverlayItem[]; uid: string; frame: Rect }) {
  if (!items.length) return null;
  const clip = `${uid}-ovclip`;
  const region = { x: frame.x - 2, y: frame.y - 2, width: frame.w + 4, height: frame.h + 4 };
  return (
    <g className="bp-overlays" pointerEvents="none" aria-hidden="true">
      <clipPath id={clip}>
        <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        {items.map((it) => {
          const mid = `${uid}-ovm-${it.key.replace(':', '-')}`;
          const tone = it.kind === 'line' ? it.tone : it.kind === 'range' ? it.tone : 'path';
          return (
            <g key={it.key} className={`bp-ov bp-ov-${it.kind} bp-ov-${tone}`} data-overlay={it.kind} data-tone={tone}>
              <mask id={mid} maskUnits="userSpaceOnUse" {...region}>
                <path d={it.d} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" pathLength={1} className="bp-ov-draw" />
              </mask>
              <g mask={`url(#${mid})`}>
                <path d={it.d} className="bp-ov-halo" />
                <path d={it.d} className="bp-ov-stroke" />
                {it.kind !== 'range' && it.head && (
                  <>
                    <path d={it.head} className="bp-ov-halo bp-ov-headhalo" />
                    <path d={it.head} className="bp-ov-stroke bp-ov-head" />
                  </>
                )}
              </g>
              {it.kind === 'line' && (
                <g className="bp-ov-fade">
                  <circle cx={r2(it.from.x)} cy={r2(it.from.y)} r="0.42" className="bp-ov-dot" />
                  {it.blockAt && (
                    <g transform={`translate(${r2(it.blockAt.x)} ${r2(it.blockAt.y)})`}>
                      <path d="M-0.7 -0.7L0.7 0.7M0.7 -0.7L-0.7 0.7" className="bp-ov-x-halo" />
                      <path d="M-0.7 -0.7L0.7 0.7M0.7 -0.7L-0.7 0.7" className="bp-ov-x" />
                    </g>
                  )}
                </g>
              )}
              {it.label && <Label l={it.label} cls={`bp-ov-label-${tone}`} />}
            </g>
          );
        })}
      </g>
    </g>
  );
}
