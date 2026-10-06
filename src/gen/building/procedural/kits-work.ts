import { type Rect, R, rcx, rcy, rh, rw } from './geom';
import { RoomCtx, type Side, type WallSpot } from './ctx';
import type { Kit } from './kits-home';

const mid = (r: Rect) => ({ x: rcx(r), y: rcy(r) });
const sideOf = (rot: number): Side => (rot === 0 ? 'n' : rot === 90 ? 'e' : rot === 180 ? 's' : 'w');
const lastBack = (c: RoomCtx): Side => sideOf(c.objects[c.objects.length - 1].rotation);

/**
 * Parallel rows of shelving or tables: rows run along the room's longer side, `aisle` apart,
 * made of pieces `len` long. Pieces that do not fit are skipped.
 */
function rows(c: RoomCtx, type: 'shelf' | 'dining_table' | 'desk', len: number, depth: number, aisle: number, maxRows: number, opts: { tags?: string[]; blocks?: boolean; tall?: boolean; margin?: number } = {}): number {
  const margin = opts.margin ?? 3;
  const horizontal = rw(c.bb) >= rh(c.bb);
  const span = horizontal ? rw(c.bb) : rh(c.bb);
  const across = horizontal ? rh(c.bb) : rw(c.bb);
  const pitch = depth + aisle;
  const nRows = Math.min(maxRows, Math.max(0, Math.floor((across - 2 * margin + aisle) / pitch)));
  if (nRows <= 0) return 0;
  const used = nRows * pitch - aisle;
  const start = (across - used) / 2 + (horizontal ? c.bb.y0 : c.bb.x0);
  let placed = 0;
  for (let k = 0; k < nRows; k++) {
    const off = Math.round((start + k * pitch) / 0.5) * 0.5;
    for (let a = margin; a + len <= span - margin + 1e-9; a += len) {
      const x = (horizontal ? c.bb.x0 : c.bb.x0) + (horizontal ? a : off - c.bb.x0);
      const y = horizontal ? off : c.bb.y0 + a;
      const r = horizontal ? R(x, y, x + len, y + depth) : R(off, y, off + depth, y + len);
      if (c.ok(r, { gap: 0.1, tall: opts.tall })) {
        c.put(type, r, { back: horizontal ? 'n' : 'w', blocks: opts.blocks ?? true, tags: opts.tags ?? [], gap: 0.1 });
        placed++;
      }
    }
  }
  return placed;
}

const nearEntry = (c: RoomCtx) => (s: WallSpot) => -c.entryDist(mid(s.rect)) * 0.4 + s.edgeLen * 0.02;

/** Shop floor: counter and register by the door, gondola rows, wall shelving, coolers. */
export const shop: Kit = (c) => {
  const r = c.rng;
  const counterLen = r.pick([6, 8, 8, 10]);
  const counter = c.wall('counter', counterLen, 2.5, { blocks: true, tags: ['cover'], gap: 1.2, score: nearEntry(c) });
  if (counter) {
    const mc = mid(counter);
    c.wall('register', 1.8, 1.6, { tags: ['valuables', 'cover'], gap: 0.2, score: (s) => -Math.hypot(mid(s.rect).x - mc.x, mid(s.rect).y - mc.y) });
  }
  const gondolas = rows(c, 'shelf', 8, 1.8, 3.6, c.area > 260 ? 3 : 2, { tags: ['cover', 'blocks_sight'], margin: 3.5 });
  if (gondolas === 0) c.wall('shelf', 6, 1.6, { blocks: true, tags: ['cover', 'blocks_sight'] });
  const wallShelves = r.int(2, 4);
  for (let k = 0; k < wallShelves; k++) c.wall('shelf', r.pick([6, 8]), 1.4, { tall: true, tags: ['blocks_sight'], gap: 0.2 });
  const coolers = r.int(1, 3);
  for (let k = 0; k < coolers; k++) c.wall('fridge', 2.5, 2.6, { blocks: true, tall: true, tags: ['blocks_sight'], gap: 0.1 });
  if (!c.lean && r.chance(0.4)) c.wall('plant', 1.6, 1.6);
  if (!c.lean && r.chance(0.35)) c.center('dining_table', 3, 3, { margin: 3, tags: ['cover'] });
};

export const stockroom: Kit = (c) => {
  const r = c.rng;
  c.wall('shelf', 6, 1.8, { tall: true, blocks: true, tags: ['storage', 'blocks_sight', 'cover'], gap: 0.2 });
  const n = r.int(3, 6);
  for (let k = 0; k < n; k++) c.wall('shelf', r.pick([4, 6, 8]), 1.8, { tall: true, blocks: true, tags: ['storage', 'blocks_sight', 'cover'], gap: 0.2 });
  if (c.area > 120) rows(c, 'shelf', 8, 1.8, 3.5, 2, { tags: ['storage', 'blocks_sight', 'cover'], margin: 3 });
  if (!c.lean && r.chance(0.3)) c.wall('desk', 4, 2.2, { tags: ['cover'] });
};

export const backoffice: Kit = (c) => {
  const r = c.rng;
  const desk = c.wall('desk', r.pick([5, 5.5, 6]), 2.6, { blocks: true, tags: ['cover', 'valuables'], gap: 1.2 });
  if (desk) {
    const side = lastBack(c);
    const seat = side === 'n' ? R(rcx(desk) - 0.8, desk.y1 + 0.1, rcx(desk) + 0.8, desk.y1 + 1.7) : side === 's' ? R(rcx(desk) - 0.8, desk.y0 - 1.7, rcx(desk) + 0.8, desk.y0 - 0.1) : side === 'w' ? R(desk.x1 + 0.1, rcy(desk) - 0.8, desk.x1 + 1.7, rcy(desk) + 0.8) : R(desk.x0 - 1.7, rcy(desk) - 0.8, desk.x0 - 0.1, rcy(desk) + 0.8);
    if (c.fits(seat) && c.free(seat, 0)) c.put('chair', seat, { gap: 0 });
  }
  c.wall('shelf', 2.2, 2.2, { blocks: true, tall: true, tags: ['valuables', 'safe', 'blocks_sight'], gap: 0.2 });
  c.wall('shelf', r.pick([4, 5]), 1.4, { tall: true, tags: ['blocks_sight', 'storage'], gap: 0.2 });
  if (!c.lean && r.chance(0.5)) c.wall('shelf', 3, 1.4, { tall: true, tags: ['blocks_sight', 'storage'] });
  if (!c.lean && r.chance(0.3)) c.wall('plant', 1.4, 1.4);
};

/** Reception: a front desk facing the door with a couple of chairs. */
export const reception: Kit = (c) => {
  const r = c.rng;
  c.wall('counter', r.pick([6, 8]), 2.5, { blocks: true, tags: ['cover'], gap: 1.4, score: (s) => -Math.abs(c.entryDist(mid(s.rect)) - 7) });
  const n = r.int(2, 4);
  for (let k = 0; k < n; k++) c.wall('chair', 1.6, 1.6, { gap: 0.3 });
  if (!c.lean && r.chance(0.6)) c.wall('sofa', 5.5, 2.8, { blocks: true, gap: 0.8 });
  if (!c.lean && r.chance(0.5)) c.wall('plant', 1.5, 1.5);
  if (!c.lean && r.chance(0.4)) c.wall('shelf', 3, 1.2, { tall: true, tags: ['blocks_sight'] });
};

/** Open office: banks of desks, filing along the walls. */
export const openOffice: Kit = (c) => {
  const r = c.rng;
  const placed = rows(c, 'desk', 5, 2.6, 3.2, 3, { tags: ['cover'], blocks: true, margin: 2.5 });
  if (placed === 0) c.center('desk', 5, 2.6, { blocks: true, tags: ['cover'], margin: 2.5 });
  for (const o of c.objects.filter((q) => q.type === 'desk')) {
    const rect = R(o.x, o.y, o.x + o.w, o.y + o.h);
    const seat = R(rect.x0 + 1.7, rect.y1 + 0.1, rect.x0 + 3.3, rect.y1 + 1.7);
    if (c.fits(seat) && c.free(seat, 0)) c.put('chair', seat, { gap: 0 });
  }
  const files = r.int(1, 3);
  for (let k = 0; k < files; k++) c.wall('shelf', r.pick([3, 4]), 1.6, { tall: true, tags: ['blocks_sight', 'storage'], gap: 0.3 });
  if (!c.lean && r.chance(0.5)) c.wall('plant', 1.5, 1.5);
};

export const meeting: Kit = (c) => {
  const r = c.rng;
  const long = r.pick([8, 10]);
  const horizontal = rw(c.bb) >= rh(c.bb);
  const t = c.center('dining_table', horizontal ? long : 3.5, horizontal ? 3.5 : long, { blocks: true, tags: ['cover'], margin: 3, gap: 2 });
  if (t) {
    const per = Math.floor(long / 2.2);
    for (let i = 0; i < per; i++) {
      const o = 0.4 + i * 2.2;
      const a = horizontal ? R(t.x0 + o, t.y0 - 1.5, t.x0 + o + 1.4, t.y0 - 0.1) : R(t.x0 - 1.5, t.y0 + o, t.x0 - 0.1, t.y0 + o + 1.4);
      const b = horizontal ? R(t.x0 + o, t.y1 + 0.1, t.x0 + o + 1.4, t.y1 + 1.5) : R(t.x1 + 0.1, t.y0 + o, t.x1 + 1.5, t.y0 + o + 1.4);
      for (const q of [a, b]) if (c.fits(q) && c.free(q, 0, false, t)) c.put('chair', q, { gap: 0 });
    }
  }
  if (!c.lean && r.chance(0.5)) c.wall('shelf', 4, 1.3, { tall: true, tags: ['blocks_sight'] });
};

export const manager: Kit = (c) => {
  backoffice(c);
  if (!c.lean && c.rng.chance(0.5)) c.wall('armchair', 3, 3);
};

export const kitchenette: Kit = (c) => {
  const r = c.rng;
  c.wall('counter', 5, 2, { blocks: true, tags: ['cover'], gap: 0.1 });
  c.wall('sink', 3, 2, { gap: 0.1 });
  c.wall('fridge', 2.5, 2.6, { blocks: true, tall: true, tags: ['blocks_sight'], gap: 0.1 });
  if (c.area > 80 && r.chance(0.6)) c.center('dining_table', 3, 5, { blocks: true, margin: 2.5 });
};

export const server: Kit = (c) => {
  const n = c.rng.int(2, 4);
  for (let k = 0; k < n; k++) c.wall('shelf', 2.5, 3, { blocks: true, tall: true, tags: ['valuables', 'server', 'blocks_sight', 'hazard'], gap: 0.4 });
};

/** Commercial kitchen: a cooking line, prep tables, sinks and the walk-in door. */
export const commercialKitchen: Kit = (c) => {
  const r = c.rng;
  for (const t of ['stove', 'stove', 'sink', 'fridge'] as const) {
    const [l, d] = t === 'sink' ? [4, 2.2] : t === 'fridge' ? [3, 2.8] : [4, 2.8];
    c.wall(t, l, d, { blocks: t === 'fridge', tall: t === 'fridge', tags: t === 'stove' ? ['hazard', 'cover'] : t === 'fridge' ? ['blocks_sight'] : [], gap: 0.2 });
  }
  const tables = rows(c, 'desk', 6, 2.5, 3.4, 2, { tags: ['cover'], blocks: true, margin: 3 });
  if (tables === 0) c.center('counter', 6, 2.5, { blocks: true, tags: ['cover'], margin: 3 });
  c.wall('counter', 6, 2.2, { blocks: true, tags: ['cover'], gap: 0.2 });
  if (!c.lean && r.chance(0.6)) c.wall('shelf', 5, 1.6, { tall: true, tags: ['blocks_sight', 'storage'] });
  const stoveOk = c.objects.some((o) => o.type === 'stove');
  const sinkOk = c.objects.some((o) => o.type === 'sink');
  if (!stoveOk || !sinkOk) c.fail = true;
};

export const coldStore: Kit = (c) => {
  const n = c.rng.int(2, 4);
  for (let k = 0; k < n; k++) c.wall('shelf', c.rng.pick([4, 5]), 1.8, { tall: true, blocks: true, tags: ['storage', 'blocks_sight'], gap: 0.2 });
};

/**
 * Bar and dining floor: a back-bar shelf on one wall with the bar counter an aisle in front of
 * it, stools along the customer side, booths on the walls, tables and chairs in the rest.
 */
export const barFloor: Kit = (c) => {
  const r = c.rng;
  const barLen = Math.min(r.pick([10, 12, 14, 16]), Math.max(8, Math.floor(Math.max(rw(c.bb), rh(c.bb)) * 0.45)));
  const shelf = c.wall('shelf', barLen, 1.3, { tall: true, tags: ['valuables', 'blocks_sight'], gap: 0.3, score: (s) => s.edgeLen * 0.1 + c.entryDist(mid(s.rect)) * 0.1 });
  let bar: Rect | null = null;
  let towards: Side = 's';
  if (shelf) {
    const back = lastBackOf(c, 'shelf');
    towards = back === 'n' ? 's' : back === 's' ? 'n' : back === 'w' ? 'e' : 'w';
    const d = 1.3 + 3.2;
    const rect = back === 'n' ? R(shelf.x0, shelf.y0 + d, shelf.x1, shelf.y0 + d + 2.6) : back === 's' ? R(shelf.x0, shelf.y1 - d - 2.6, shelf.x1, shelf.y1 - d) : back === 'w' ? R(shelf.x0 + d, shelf.y0, shelf.x0 + d + 2.6, shelf.y1) : R(shelf.x1 - d - 2.6, shelf.y0, shelf.x1 - d, shelf.y1);
    if (c.ok(rect, { gap: 0.3 })) bar = c.put('counter', rect, { back: back === 'n' ? 's' : back === 's' ? 'n' : back === 'w' ? 'e' : 'w', blocks: true, tags: ['cover', 'bar'], gap: 0.3 });
  }
  if (!bar) {
    bar = c.wall('counter', barLen, 2.6, { blocks: true, tags: ['cover', 'bar'], gap: 0.3, score: (s) => s.edgeLen * 0.1 + c.entryDist(mid(s.rect)) * 0.1 });
    if (bar) towards = lastBackOf(c, 'counter') === 'n' ? 's' : lastBackOf(c, 'counter') === 's' ? 'n' : lastBackOf(c, 'counter') === 'w' ? 'e' : 'w';
  }
  if (bar) {
    const mb = mid(bar);
    c.wall('register', 1.8, 1.6, { tags: ['valuables', 'cover'], gap: 0.2, score: (s) => -Math.hypot(mid(s.rect).x - mb.x, mid(s.rect).y - mb.y) });
    const horizontal = towards === 's' || towards === 'n';
    const len = horizontal ? rw(bar) : rh(bar);
    const stools = Math.floor(len / 2.2) - 1;
    for (let i = 0; i < stools; i++) {
      const o = 0.9 + i * 2.2;
      // Stools sit on the customer side, away from the staff aisle.
      const rect = horizontal
        ? towards === 's'
          ? R(bar.x0 + o, bar.y1 + 0.2, bar.x0 + o + 1.4, bar.y1 + 1.6)
          : R(bar.x0 + o, bar.y0 - 1.6, bar.x0 + o + 1.4, bar.y0 - 0.2)
        : towards === 'e'
          ? R(bar.x1 + 0.2, bar.y0 + o, bar.x1 + 1.6, bar.y0 + o + 1.4)
          : R(bar.x0 - 1.6, bar.y0 + o, bar.x0 - 0.2, bar.y0 + o + 1.4);
      if (c.fits(rect) && c.free(rect, 0, false, bar)) c.put('chair', rect, { gap: 0 });
    }
    c.reserve(horizontal ? (towards === 's' ? R(bar.x0, bar.y1, bar.x1, bar.y1 + 1.6) : R(bar.x0, bar.y0 - 1.6, bar.x1, bar.y0)) : towards === 'e' ? R(bar.x1, bar.y0, bar.x1 + 1.6, bar.y1) : R(bar.x0 - 1.6, bar.y0, bar.x0, bar.y1), 1.4);
  }
  // Booths on the walls, then loose tables.
  const booths = r.int(1, 4);
  for (let k = 0; k < booths; k++) c.wall('sofa', 6, 2.6, { blocks: true, gap: 3, tags: ['cover'] });
  const tableCount = Math.max(2, Math.min(9, Math.floor(c.area / 70)));
  for (let k = 0; k < tableCount; k++) {
    const t = c.center('dining_table', 3, 3, { blocks: true, tags: ['cover'], margin: 2.5, gap: 3.2, around: { x: r.range(c.bb.x0, c.bb.x1), y: r.range(c.bb.y0, c.bb.y1) } });
    if (!t) break;
    for (const [dx, dy] of [[0.8, -1.5], [0.8, 3.1]] as const) {
      const q = R(t.x0 + dx, t.y0 + dy, t.x0 + dx + 1.4, t.y0 + dy + 1.4);
      if (c.fits(q) && c.free(q, 0, false, t)) c.put('chair', q, { gap: 0 });
    }
  }
  if (!c.lean && r.chance(0.5)) c.wall('plant', 1.5, 1.5);
};

function lastBackOf(c: RoomCtx, type: string): Side {
  const o = [...c.objects].reverse().find((q) => q.type === type);
  return o ? sideOf(o.rotation) : 'n';
}

/** Warehouse floor: pallet racking in aisles, a staging area by the doors. */
export const warehouseFloor: Kit = (c) => {
  const r = c.rng;
  const racks = rows(c, 'shelf', 10, 3, 6, 4, { tags: ['storage', 'cover', 'blocks_sight'], margin: 4 });
  if (racks === 0) rows(c, 'shelf', 8, 3, 6, 2, { tags: ['storage', 'cover', 'blocks_sight'], margin: 3 });
  const wall = r.int(2, 5);
  for (let k = 0; k < wall; k++) c.wall('shelf', r.pick([8, 10]), 2.4, { tall: true, blocks: true, tags: ['storage', 'cover', 'blocks_sight'], gap: 0.4 });
  if (!c.lean && r.chance(0.6)) c.wall('desk', 5, 2.5, { tags: ['cover'] });
  if (!c.lean && r.chance(0.5)) c.wall('counter', 4, 2, { tags: ['hazard', 'equipment'] });
  const high = r.int(0, 2);
  for (let k = 0; k < high; k++) c.center('counter', 4, 4, { blocks: true, tags: ['cover', 'valuables'], margin: 4 });
};

/** A motel unit's bed room: one or two beds, a desk and a TV, an armchair. */
export const motelUnit: Kit = (c) => {
  const r = c.rng;
  const beds = c.area > 150 && r.chance(0.55) ? 2 : 1;
  for (let k = 0; k < beds; k++) {
    const bed = c.wall('bed', beds === 2 ? 4.5 : 5, 6.5, { blocks: true, gap: 1.6 });
    if (!bed) break;
  }
  c.wall('nightstand', 1.6, 1.6, { gap: 0.2 });
  c.wall('dresser', 4, 1.8, { gap: 0.4 });
  c.wall('tv', 3.2, 1.4, { tags: ['valuables'] });
  c.wall('desk', 4, 2, { tags: ['cover'] });
  if (!c.lean && r.chance(0.5)) c.wall('armchair', 3, 3);
};

export const motelOffice: Kit = (c) => {
  c.wall('counter', 8, 2.5, { blocks: true, tags: ['cover'], gap: 1.4, score: (s) => -Math.abs(c.entryDist(mid(s.rect)) - 7) });
  c.wall('register', 1.8, 1.6, { tags: ['valuables', 'cover'], gap: 0.2 });
  c.wall('shelf', 4, 1.3, { tall: true, tags: ['valuables', 'blocks_sight'] });
  c.wall('chair', 1.6, 1.6);
  if (!c.lean && c.rng.chance(0.5)) c.wall('plant', 1.5, 1.5);
};

export const WORK_KITS: Record<string, Kit> = {
  shop,
  stockroom,
  backoffice,
  reception,
  open_office: openOffice,
  meeting,
  manager,
  kitchenette,
  server,
  commercial_kitchen: commercialKitchen,
  cold_store: coldStore,
  bar_floor: barFloor,
  warehouse_floor: warehouseFloor,
  motel_unit: motelUnit,
  motel_office: motelOffice,
};

