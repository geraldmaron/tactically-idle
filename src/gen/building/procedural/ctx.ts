import type { ObjectType, PlacedObject } from '../../../sim/types';
import { type Rect, type Vec, R, inflate, insideOrOn, lerp, overlapArea, pointInPoly, polyBBox, polyEdges, rectInsidePoly, rh, rw, segLen } from './geom';
import type { Rand } from './rand';
import type { PRoom } from './types';

export type Side = 'n' | 's' | 'e' | 'w';

/** A spot against a wall, found by wallSpots. */
export interface WallSpot {
  rect: Rect;
  back: Side;
  /** Offset of the piece along its wall, from the wall's start. */
  t: number;
  edge: number;
  edgeLen: number;
}

export interface PlaceOpts {
  tags?: string[];
  blocks?: boolean;
  /** Floor-to-ceiling piece that must stay off window strips. */
  tall?: boolean;
  /** Clear space kept around it, feet (default 0.3). */
  gap?: number;
  /** Score a candidate; the best of a few random ones wins. */
  score?: (s: WallSpot) => number;
  back?: Side;
  /** Only edges at least this long. */
  minEdge?: number;
  /** Allow overlap with these (a rug under a bed). */
  overlay?: boolean;
}

const ROT: Record<Side, 0 | 90 | 180 | 270> = { n: 0, e: 90, s: 180, w: 270 };

/** Placement workspace for one room. */
export class RoomCtx {
  readonly poly: Vec[];
  readonly bb: Rect;
  readonly objects: PlacedObject[] = [];
  readonly rects: { rect: Rect; type: ObjectType; gap: number }[] = [];
  private seq = new Map<string, number>();
  /** Door landing, swing and window strips. */
  clear: Rect[] = [];
  windowStrips: Rect[] = [];
  doorMids: Vec[] = [];
  /** Mid-points of doors to the outdoors. */
  entryMids: Vec[] = [];
  lean = false;
  /** Set by a kit that could not place an essential piece. */
  fail = false;

  constructor(
    readonly room: PRoom,
    readonly rng: Rand,
  ) {
    this.poly = room.poly;
    this.bb = polyBBox(room.poly);
  }

  get area(): number {
    return (this.bb.x1 - this.bb.x0) * (this.bb.y1 - this.bb.y0);
  }

  /** Is the rectangle inside the room with half a foot to spare from every wall? */
  fits(r: Rect): boolean {
    return rectInsidePoly(inflate(r, 0.5), this.poly);
  }

  /** Inside the room allowing contact with the wall inset line. */
  fitsLoose(r: Rect): boolean {
    return rectInsidePoly(r, this.poly);
  }

  /** Is the rectangle clear of landings, window strips and other pieces? `except` is a piece it may touch (a table its chair serves). */
  free(r: Rect, gap = 0.3, tall = false, except?: Rect): boolean {
    if (this.clear.some((c) => overlapArea(c, r) > 1e-6)) return false;
    if (tall && this.windowStrips.some((c) => overlapArea(c, r) > 1e-6)) return false;
    return this.rects.every((o) => o.rect === except || overlapArea(inflate(o.rect, Math.max(gap, o.gap) / 2), inflate(r, Math.max(gap, o.gap) / 2)) <= 0.01);
  }

  /** Keep other pieces `margin` feet from this group (aisles around a table and its chairs). */
  reserve(group: Rect, margin: number): void {
    this.rects.push({ rect: inflate(group, margin), type: 'rug', gap: 0 });
  }

  ok(r: Rect, o: PlaceOpts = {}): boolean {
    if (!this.fits(r)) return false;
    if (o.overlay) return true;
    return this.free(r, o.gap ?? 0.3, o.tall);
  }

  private idFor(type: ObjectType): string {
    const n = (this.seq.get(type) ?? 0) + 1;
    this.seq.set(type, n);
    return `o_${this.room.id}_${type}${n > 1 ? n : ''}`;
  }

  /** Record a piece. `back` is the wall the back faces; it sets the rotation hint. */
  put(type: ObjectType, r: Rect, o: PlaceOpts = {}): Rect {
    const back = o.back ?? 'n';
    const tags = [...(o.tags ?? []), ...(o.blocks ? ['blocks_space'] : [])];
    const sw = ROT[back] === 90 || ROT[back] === 270;
    const w = sw ? rh(r) : rw(r);
    const h = sw ? rw(r) : rh(r);
    const cx = (r.x0 + r.x1) / 2;
    const cy = (r.y0 + r.y1) / 2;
    this.objects.push({ id: this.idFor(type), type, in: this.room.id, x: cx - w / 2, y: cy - h / 2, w, h, rotation: ROT[back], mechanical: tags.length > 0, tags });
    if (!o.overlay) this.rects.push({ rect: r, type, gap: o.gap ?? 0.3 });
    return r;
  }

  /** Candidate spots with the back against a wall: `len` along it, `depth` out from it. */
  wallSpots(len: number, depth: number, o: PlaceOpts = {}): WallSpot[] {
    const out: WallSpot[] = [];
    const edges = polyEdges(this.poly);
    edges.forEach((e, i) => {
      const L = segLen(e);
      if (L < len + 1 || L < (o.minEdge ?? 0)) return;
      const dx = (e.b.x - e.a.x) / L;
      const dy = (e.b.y - e.a.y) / L;
      if (Math.abs(dx) > 1e-9 && Math.abs(dy) > 1e-9) return;
      let nx = -dy;
      let ny = dx;
      const m = lerp(e.a, e.b, 0.5);
      if (!pointInPoly({ x: m.x + nx * 0.3, y: m.y + ny * 0.3 }, this.poly)) {
        nx = -nx;
        ny = -ny;
      }
      const back: Side = nx > 0.5 ? 'w' : nx < -0.5 ? 'e' : ny > 0.5 ? 'n' : 's';
      for (let t = 0.5; t <= L - len - 0.5 + 1e-9; t += 0.5) {
        const p0 = lerp(e.a, e.b, t / L);
        const p1 = lerp(e.a, e.b, (t + len) / L);
        const q0 = { x: p0.x + nx * 0.5, y: p0.y + ny * 0.5 };
        const q1 = { x: p1.x + nx * (0.5 + depth), y: p1.y + ny * (0.5 + depth) };
        const rect = R(Math.min(q0.x, q1.x), Math.min(q0.y, q1.y), Math.max(q0.x, q1.x), Math.max(q0.y, q1.y));
        out.push({ rect, back, t, edge: i, edgeLen: L });
      }
    });
    return out;
  }

  /** Place a piece against a random acceptable wall spot (best of a few by score). */
  wall(type: ObjectType, len: number, depth: number, o: PlaceOpts = {}): Rect | null {
    const spots = this.wallSpots(len, depth, o).filter((s) => this.ok(s.rect, o) && (!o.back || s.back === o.back));
    if (spots.length === 0) return null;
    let best: WallSpot | null = null;
    let bestScore = -Infinity;
    const draws = Math.min(spots.length, 6);
    for (let k = 0; k < draws; k++) {
      const s = spots[this.rng.int(0, spots.length - 1)];
      const sc = (o.score ? o.score(s) : 0) + this.rng.float() * 0.5;
      if (sc > bestScore) {
        best = s;
        bestScore = sc;
      }
    }
    if (!best) return null;
    return this.put(type, best.rect, { ...o, back: best.back });
  }

  /** Place a piece at a free spot well away from the walls. */
  center(type: ObjectType, w: number, h: number, o: PlaceOpts & { margin?: number; around?: Vec } = {}): Rect | null {
    const m = o.margin ?? 2;
    const cands: Rect[] = [];
    for (let x = this.bb.x0 + m; x + w <= this.bb.x1 - m + 1e-9; x += 0.5)
      for (let y = this.bb.y0 + m; y + h <= this.bb.y1 - m + 1e-9; y += 0.5) {
        const r = R(x, y, x + w, y + h);
        if (this.ok(r, o)) cands.push(r);
      }
    if (cands.length === 0) return null;
    const c0 = o.around ?? { x: (this.bb.x0 + this.bb.x1) / 2, y: (this.bb.y0 + this.bb.y1) / 2 };
    cands.sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - c0.x, (a.y0 + a.y1) / 2 - c0.y) - Math.hypot((b.x0 + b.x1) / 2 - c0.x, (b.y0 + b.y1) / 2 - c0.y));
    const r = cands[Math.min(cands.length - 1, this.rng.int(0, Math.min(4, cands.length - 1)))];
    return this.put(type, r, o);
  }

  /** Distance from a point to the nearest door landing mid-point. */
  doorDist(p: Vec): number {
    return this.doorMids.length === 0 ? 99 : Math.min(...this.doorMids.map((d) => Math.hypot(d.x - p.x, d.y - p.y)));
  }

  entryDist(p: Vec): number {
    return this.entryMids.length === 0 ? 99 : Math.min(...this.entryMids.map((d) => Math.hypot(d.x - p.x, d.y - p.y)));
  }

  inside(p: Vec): boolean {
    return insideOrOn(p, this.poly);
  }
}
