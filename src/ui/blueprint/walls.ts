// Wall and opening geometry derived from a LocationDefinition. Pure; no React.
import type { LocationDefinition, Opening, Polygon, Vec, WallMaterial } from '../../sim/types';
import { distToPolygonEdges, distToSegment, len, mid, perp, pointInPolygon, polyPath, pt, r2, scale, sub, add, unit } from './geometry';

/**
 * Walls are drawn a little heavier than the authored thickness so the hatch stays legible on a
 * ~358 px wide phone map. Room polygons are wall centerlines, so thickening is symmetric and cannot
 * move any room, door or object.
 */
export const WALL_VISUAL_SCALE = 1.3;
/** White drafting-ink casing on each wall face, feet. */
export const WALL_INK = 0.16;

export interface OpeningGeom {
  o: Opening;
  from: Vec;
  to: Vec;
  center: Vec;
  /** Unit vector from `from` to `to`. */
  dir: Vec;
  width: number;
  exterior: boolean;
  /** Wall thickness (visual, feet) at this opening. */
  thickness: number;
  /** Unit normal into the swing side (doors only). */
  swingNormal: Vec | null;
  /** Unit normal pointing into the room side of a window / sliding opening, when one side is a room. */
  interiorNormal: Vec | null;
  hinge: Vec | null;
  free: Vec | null;
}

/** A set of wall pieces sharing one material, wall class and direction; drawn with one pattern. */
export interface WallRun {
  material: WallMaterial;
  kind: 'ext' | 'int';
  /** Wall direction in degrees, [0,180), rounded to 5. */
  angle: number;
  /** Visual wall thickness, feet. */
  thickness: number;
  path: string;
}

export interface WallModel {
  extT: number;
  intT: number;
  extPath: string;
  intPath: string;
  /** Wall pieces grouped by material (overrides per shared wall honoured). */
  runs: WallRun[];
  /** Polygons (point lists) that cut the openings out of the wall stack. */
  cuts: string[];
  openings: OpeningGeom[];
}

const EPS = 0.06;

function onFootprint(p: Vec, footprint: Polygon): boolean {
  return distToPolygonEdges(p, footprint) < EPS;
}

/** Interior wall segments: room edges that are not part of the exterior outline, merged where collinear. */
export function interiorSegments(loc: LocationDefinition): [Vec, Vec][] {
  const horizontals = new Map<string, [number, number][]>();
  const verticals = new Map<string, [number, number][]>();
  const others = new Map<string, [Vec, Vec]>();

  for (const room of loc.rooms) {
    const poly = room.polygon;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (len(sub(a, b)) < 1e-6) continue;
      if (onFootprint(a, loc.footprint) && onFootprint(b, loc.footprint) && onFootprint(mid(a, b), loc.footprint)) continue;
      if (Math.abs(a.y - b.y) < 1e-6) {
        const k = r2(a.y).toFixed(2);
        (horizontals.get(k) ?? horizontals.set(k, []).get(k)!).push([Math.min(a.x, b.x), Math.max(a.x, b.x)]);
      } else if (Math.abs(a.x - b.x) < 1e-6) {
        const k = r2(a.x).toFixed(2);
        (verticals.get(k) ?? verticals.set(k, []).get(k)!).push([Math.min(a.y, b.y), Math.max(a.y, b.y)]);
      } else {
        const [p, q] = a.x < b.x || (a.x === b.x && a.y < b.y) ? [a, b] : [b, a];
        others.set(`${pt(p)}|${pt(q)}`, [p, q]);
      }
    }
  }

  const merge = (iv: [number, number][]): [number, number][] => {
    const s = [...iv].sort((p, q) => p[0] - q[0]);
    const out: [number, number][] = [];
    for (const cur of s) {
      const last = out[out.length - 1];
      if (last && cur[0] <= last[1] + 1e-6) last[1] = Math.max(last[1], cur[1]);
      else out.push([cur[0], cur[1]]);
    }
    return out;
  };

  const segs: [Vec, Vec][] = [];
  for (const [k, iv] of horizontals) for (const [s, e] of merge(iv)) segs.push([{ x: s, y: Number(k) }, { x: e, y: Number(k) }]);
  for (const [k, iv] of verticals) for (const [s, e] of merge(iv)) segs.push([{ x: Number(k), y: s }, { x: Number(k), y: e }]);
  for (const s of others.values()) segs.push(s);
  return segs;
}

/** Id -> true when the id names an exterior zone. */
function zoneIds(loc: LocationDefinition): Set<string> {
  return new Set(loc.zones.map((z) => z.id));
}

/** Openings whose both sides are exterior zones are walkable paths, not wall openings. */
export function isPath(o: Opening, zones: Set<string>): boolean {
  return zones.has(o.a) && zones.has(o.b);
}

function spacePolygon(loc: LocationDefinition, id: string): Polygon | null {
  return loc.rooms.find((r) => r.id === id)?.polygon ?? loc.zones.find((z) => z.id === id)?.polygon ?? null;
}

function spaceIdAt(loc: LocationDefinition, p: Vec): string | null {
  for (const r of loc.rooms) if (pointInPolygon(p, r.polygon)) return r.id;
  for (const z of loc.zones) if (pointInPolygon(p, z.polygon)) return z.id;
  return null;
}

/** Splits a segment at every polygon vertex that lies on it, returning the elementary pieces. */
function splitSegment(a: Vec, b: Vec, vertices: Vec[]): [Vec, Vec][] {
  const ab = sub(b, a);
  const l2 = ab.x * ab.x + ab.y * ab.y;
  if (l2 < 1e-9) return [];
  const ts: number[] = [0, 1];
  for (const v of vertices) {
    if (distToSegment(v, a, b) > 0.05) continue;
    const t = ((v.x - a.x) * ab.x + (v.y - a.y) * ab.y) / l2;
    if (t > 0.001 && t < 0.999) ts.push(t);
  }
  ts.sort((p, q) => p - q);
  const out: [Vec, Vec][] = [];
  for (let i = 0; i < ts.length - 1; i++) {
    if (ts[i + 1] - ts[i] < 0.001) continue;
    out.push([add(a, scale(ab, ts[i])), add(a, scale(ab, ts[i + 1]))]);
  }
  return out;
}

/** Material of the wall piece between two spaces: per-pair override first, then the class default. */
function pieceMaterial(loc: LocationDefinition, kind: 'ext' | 'int', a: string | null, b: string | null): WallMaterial {
  if (a && b) {
    const ov = loc.materials.overrides.find((o) => (o.a === a && o.b === b) || (o.a === b && o.b === a));
    if (ov) return ov.material;
  }
  return kind === 'ext' ? loc.materials.exterior : loc.materials.interior;
}

function computeRuns(loc: LocationDefinition, extT: number, intT: number): WallRun[] {
  const vertices: Vec[] = [...loc.footprint, ...loc.rooms.flatMap((r) => r.polygon), ...loc.zones.flatMap((z) => z.polygon)];
  const pieces: { a: Vec; b: Vec; kind: 'ext' | 'int' }[] = [];
  const fp = loc.footprint;
  for (let i = 0; i < fp.length; i++) for (const [a, b] of splitSegment(fp[i], fp[(i + 1) % fp.length], vertices)) pieces.push({ a, b, kind: 'ext' });
  for (const [s, e] of interiorSegments(loc)) for (const [a, b] of splitSegment(s, e, vertices)) pieces.push({ a, b, kind: 'int' });

  const groups = new Map<string, WallRun>();
  for (const pc of pieces) {
    const m = mid(pc.a, pc.b);
    const dir = unit(sub(pc.b, pc.a));
    const n = perp(dir);
    const sa = spaceIdAt(loc, add(m, scale(n, 0.6)));
    const sb = spaceIdAt(loc, add(m, scale(n, -0.6)));
    const material = pieceMaterial(loc, pc.kind, sa, sb);
    let angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
    angle = ((angle % 180) + 180) % 180;
    angle = Math.round(angle / 5) * 5;
    if (angle >= 180) angle = 0;
    const key = `${material}|${pc.kind}|${angle}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { material, kind: pc.kind, angle, thickness: pc.kind === 'ext' ? extT : intT, path: '' }));
    g.path += `${g.path ? ' ' : ''}M${pt(pc.a)} L${pt(pc.b)}`;
  }
  return [...groups.values()];
}

export function computeWalls(loc: LocationDefinition): WallModel {
  const extT = loc.wallThickness.exterior * WALL_VISUAL_SCALE;
  const intT = loc.wallThickness.interior * WALL_VISUAL_SCALE;
  const zones = zoneIds(loc);

  const extPath = polyPath(loc.footprint);
  const intPath = interiorSegments(loc)
    .map(([a, b]) => `M${pt(a)} L${pt(b)}`)
    .join(' ');

  const openings: OpeningGeom[] = [];
  for (const o of loc.openings) {
    if (isPath(o, zones)) continue;
    const m = mid(o.from, o.to);
    const exterior = distToPolygonEdges(m, loc.footprint) < 0.2;
    const width = len(sub(o.to, o.from));
    if (width < 0.1) continue;
    const dir = unit(sub(o.to, o.from));
    let swingNormal: Vec | null = null;
    let interiorNormal: Vec | null = null;
    let hinge: Vec | null = null;
    let free: Vec | null = null;
    if (o.type === 'door' && o.swing) {
      const n0 = perp(dir);
      const poly = spacePolygon(loc, o.swing.into);
      let n = n0;
      if (poly) {
        const probe = add(m, scale(n0, 0.7));
        if (!pointInPolygon(probe, poly)) n = scale(n0, -1);
      }
      swingNormal = n;
      hinge = o.swing.hinge === 'from' ? o.from : o.to;
      free = o.swing.hinge === 'from' ? o.to : o.from;
    }
    if (o.type === 'window' || o.type === 'sliding') {
      const roomPoly = loc.rooms.find((r) => r.id === o.a || r.id === o.b)?.polygon;
      if (roomPoly) {
        const n0 = perp(dir);
        interiorNormal = pointInPolygon(add(m, scale(n0, 0.7)), roomPoly) ? n0 : scale(n0, -1);
      }
    }
    openings.push({
      o,
      from: o.from,
      to: o.to,
      center: m,
      dir,
      width,
      exterior,
      thickness: exterior ? extT : intT,
      swingNormal,
      interiorNormal,
      hinge,
      free,
    });
  }

  const cuts = openings.map((g) => {
    const n = perp(g.dir);
    const h = g.thickness / 2 + WALL_INK + 0.25;
    const a = add(g.from, scale(n, h));
    const b = add(g.to, scale(n, h));
    const c = add(g.to, scale(n, -h));
    const d = add(g.from, scale(n, -h));
    return [a, b, c, d].map(pt).join(' ');
  });

  return { extT, intT, extPath, intPath, runs: computeRuns(loc, extT, intT), cuts, openings };
}
