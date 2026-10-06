import type { Opening, PlacedObject } from '../../../sim/types';
import { RoomCtx } from './ctx';
import { type Rect, R, lerp, vec } from './geom';
import { swingBox } from './openings';
import type { Rand } from './rand';
import { HOME_KITS, type Kit } from './kits-home';
import { WORK_KITS } from './kits-work';
import type { FamilySpec, PRoom } from './types';

const KITS: Record<string, Kit> = { ...HOME_KITS, ...WORK_KITS };

/** Register extra kits (other families add theirs at import time). */
export function registerKits(kits: Record<string, Kit>): void {
  Object.assign(KITS, kits);
}

/** Box in front of an opening on one side: its width, `d` feet deep into the room. */
function landing(o: Opening, poly: Vec2[], d: number): Rect {
  const w = Math.hypot(o.to.x - o.from.x, o.to.y - o.from.y);
  const ux = (o.to.x - o.from.x) / w;
  const uy = (o.to.y - o.from.y) / w;
  const m = lerp(o.from, o.to, 0.5);
  let nx = -uy;
  let ny = ux;
  if (!inside(vec(m.x + nx * 0.3, m.y + ny * 0.3), poly)) {
    nx = -nx;
    ny = -ny;
  }
  const xs = [o.from.x, o.to.x, o.from.x + nx * d, o.to.x + nx * d];
  const ys = [o.from.y, o.to.y, o.from.y + ny * d, o.to.y + ny * d];
  return R(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
}

type Vec2 = { x: number; y: number };
function inside(p: Vec2, poly: Vec2[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** Free floor must connect every door of the room: no piece may wall a door off. */
function connected(c: RoomCtx, ctxDoorPoints: Vec2[]): boolean {
  if (ctxDoorPoints.length < 2) return true;
  const step = 0.5;
  const x0 = c.bb.x0;
  const y0 = c.bb.y0;
  const nx = Math.ceil((c.bb.x1 - x0) / step);
  const ny = Math.ceil((c.bb.y1 - y0) / step);
  const blocked = c.rects.filter((o) => o.type !== 'rug' && o.type !== 'plant').map((o) => o.rect);
  const cellFree = (i: number, j: number) => {
    const p = { x: x0 + (i + 0.5) * step, y: y0 + (j + 0.5) * step };
    if (!inside(p, c.poly)) return false;
    return blocked.every((r) => p.x < r.x0 - 0.5 || p.x > r.x1 + 0.5 || p.y < r.y0 - 0.5 || p.y > r.y1 + 0.5);
  };
  const cells = ctxDoorPoints.map((p) => [Math.floor((p.x - x0) / step), Math.floor((p.y - y0) / step)]);
  const seen = new Set<number>();
  const [si, sj] = cells[0];
  if (!cellFree(si, sj)) return false;
  const stack = [si * 100000 + sj];
  seen.add(stack[0]);
  while (stack.length) {
    const k = stack.pop() as number;
    const i = Math.floor(k / 100000);
    const j = k % 100000;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
      const kk = ni * 100000 + nj;
      if (!seen.has(kk) && cellFree(ni, nj)) {
        seen.add(kk);
        stack.push(kk);
      }
    }
  }
  return cells.every(([i, j]) => seen.has(i * 100000 + j));
}

/**
 * Furnish every room from its kit. Each room is retried a few times with fresh draws if a
 * door ends up walled off, then retried lean (essentials only).
 */
export function furnish(rooms: PRoom[], openings: Opening[], _swings: Map<string, Rect[]>, out: PlacedObject[], _spec: FamilySpec, rng: Rand): boolean {
  const roomIds = new Set(rooms.map((r) => r.id));
  for (const room of rooms) {
    const kit = KITS[room.seed.kit];
    if (!kit) continue;
    const mine = openings.filter((o) => (o.a === room.id || o.b === room.id) && o.type !== 'stair');
    let done: RoomCtx | null = null;
    for (let attempt = 0; attempt < 8 && !done; attempt++) {
      const c = new RoomCtx(room, rng);
      c.lean = attempt >= 5;
      const doorPts: Vec2[] = [];
      for (const o of mine) {
        const mid = lerp(o.from, o.to, 0.5);
        if (o.type === 'window') {
          c.windowStrips.push(landing(o, room.poly, 1.2));
          continue;
        }
        const w = Math.hypot(o.to.x - o.from.x, o.to.y - o.from.y);
        c.clear.push(landing(o, room.poly, 2.5));
        if (o.type === 'door' && o.swing && o.swing.into === room.id) c.clear.push(swingBox(o.from, o.to, o.swing.hinge, room.poly));
        const box = landing(o, room.poly, 1.5);
        doorPts.push(vec((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2));
        c.doorMids.push(mid);
        if (!roomIds.has(o.a) || !roomIds.has(o.b)) c.entryMids.push(mid);
        void w;
      }
      kit(c);
      if (!c.fail && connected(c, doorPts)) done = c;
    }
    if (!done) return false;
    out.push(...done.objects);
  }
  return true;
}
