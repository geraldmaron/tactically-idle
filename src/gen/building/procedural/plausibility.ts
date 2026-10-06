import type { LocationDefinition, Opening, PlacedObject, Room } from '../../../sim/types';
import { type Rect, R, overlapArea, polyArea, polyBBox } from './geom';
import { swingBox } from './openings';

export interface PlausibilityReport {
  /** 0..100, higher is more plausible. */
  score: number;
  pass: boolean;
  /** Named measurements behind the score. */
  metrics: Record<string, number>;
  /** Plain-language reasons the plan lost points; hard failures start with 'FAIL'. */
  notes: string[];
}

export const PASS_SCORE = 80;

/** Smallest acceptable shorter side by room id stem, feet. */
const MIN_W: Record<string, number> = { wc: 4, hall: 3.5, landing: 3.5, stair: 3.5, corridor: 3.5, storage: 4, closet: 3.5, utility: 5.5, pantry: 4, cold_store: 5, server: 4.5, backoffice: 6, ensuite: 6 };
const NO_ASPECT = new Set(['hall', 'landing', 'stair', 'corridor', 'foyer', 'vestibule']);
/** Rooms entered and left by one door. */
const LEAF = new Set(['bedroom', 'bath', 'wc', 'storage', 'utility', 'meeting', 'closet', 'pantry', 'unit', 'manager', 'server', 'break_room']);
const CIRC = new Set(['hall', 'landing', 'stair', 'corridor', 'foyer', 'vestibule', 'passage']);
/** Area range (sq ft) by stem. */
const AREA: Record<string, [number, number]> = {
  bedroom: [80, 260],
  bath: [30, 100],
  wc: [15, 70],
  living: [120, 380],
  dining: [70, 220],
  kitchen: [70, 280],
  utility: [24, 100],
  storage: [18, 120],
  office: [60, 200],
  hall: [12, 200],
  landing: [12, 90],
};

/** Habitable or customer rooms that must have a window. */
const NEEDS_WINDOW = new Set(['bedroom', 'living', 'dining', 'kitchen']);

/** Required room stems and minimum counts per family. */
const PROGRAMME: Record<string, Record<string, number>> = {
  bungalow: { bedroom: 2, bath: 1, kitchen: 1, living: 1, hall: 1 },
  two_storey_house: { bedroom: 2, bath: 1, kitchen: 1, living: 1, stair: 2, hall: 1, landing: 1 },
  semi_detached: { bedroom: 2, bath: 1, kitchen: 1, living: 1, stair: 2, hall: 1, landing: 1 },
  apartment_unit: { bedroom: 1, bath: 1, kitchen: 1, living: 1 },
  corner_store_flat: { shop: 1, stockroom: 1, stair: 2, bedroom: 1, bath: 1, kitchen: 1, living: 1 },
  small_office: { reception: 1, wc: 1 },
  bar_restaurant: { kitchen: 1 },
  warehouse: { floor: 1, wc: 1 },
  motel_row: { unit: 2 },
};

export const stem = (id: string) => id.replace(/_\d+$/, '').replace(/^stair$/, 'stair');

const rectOf = (o: PlacedObject): Rect => {
  const sw = o.rotation === 90 || o.rotation === 270;
  const w = sw ? o.h : o.w;
  const h = sw ? o.w : o.h;
  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;
  return R(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
};

/** Room adjacency from door-like openings (windows excluded), stairs included. */
function roomGraph(loc: LocationDefinition): Map<string, Set<string>> {
  const rooms = new Set(loc.rooms.map((r) => r.id));
  const g = new Map<string, Set<string>>();
  for (const id of rooms) g.set(id, new Set());
  for (const o of loc.openings) {
    if (o.type === 'window' || !rooms.has(o.a) || !rooms.has(o.b)) continue;
    g.get(o.a)?.add(o.b);
    g.get(o.b)?.add(o.a);
  }
  return g;
}

/** Zones joined to an entry zone by walkable paths. */
function openZones(loc: LocationDefinition): Set<string> {
  const zones = new Set(loc.zones.map((z) => z.id));
  const reach = new Set(loc.entries.filter((e) => zones.has(e)));
  let grew = true;
  while (grew) {
    grew = false;
    for (const o of loc.openings) {
      if (o.type !== 'doorway' || !zones.has(o.a) || !zones.has(o.b)) continue;
      if (reach.has(o.a) !== reach.has(o.b)) {
        reach.add(o.a);
        reach.add(o.b);
        grew = true;
      }
    }
  }
  return reach;
}

export function plausibilityReport(loc: LocationDefinition): PlausibilityReport {
  const notes: string[] = [];
  const metrics: Record<string, number> = {};
  let score = 100;
  const fail = (msg: string) => {
    notes.push(`FAIL ${msg}`);
    score -= 100;
  };
  const dock = (msg: string, pts: number) => {
    notes.push(msg);
    score -= pts;
  };
  const byId = new Map(loc.rooms.map((r) => [r.id, r]));
  const roomIds = new Set(byId.keys());
  const res = loc.setting === 'residential' || loc.setting === 'apartment';

  // Room sizes.
  let total = 0;
  let circ = 0;
  for (const r of loc.rooms) {
    const bb = polyBBox(r.polygon);
    const w = Math.min(bb.x1 - bb.x0, bb.y1 - bb.y0);
    const l = Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0);
    const k = stem(r.id);
    const need = r.tags.includes('ensuite') ? MIN_W.ensuite : (MIN_W[k] ?? 6);
    if (w < need - 1e-9) fail(`${r.id} is ${w} ft wide (needs ${need})`);
    if (!NO_ASPECT.has(k) && l / w > 3 + 1e-9) fail(`${r.id} aspect ${(l / w).toFixed(2)} exceeds 3`);
    const a = polyArea(r.polygon);
    const range = AREA[k];
    if (range && (a < range[0] - 1e-9 || a > range[1] + 1e-9)) dock(`${r.id} area ${a} outside ${range[0]}-${range[1]}`, 4);
    if (CIRC.has(k) && (k === 'hall' || k === 'landing') && w > 5.01 && loc.setting !== 'business') dock(`${r.id} is ${w} ft wide for a hall`, 6);
    if (CIRC.has(k) && l > (loc.setting === 'business' ? 56 : loc.setting === 'apartment' ? 52 : 28)) dock(`${r.id} corridor is ${l} ft long`, 5);
    total += a;
    if (CIRC.has(k) && k !== 'stair') circ += a;
  }
  metrics.floorArea = Math.round(total);
  metrics.circulation = total > 0 ? Math.round((circ / total) * 100) / 100 : 0;
  if (loc.setting !== 'business' && metrics.circulation > 0.2) dock(`circulation takes ${Math.round(metrics.circulation * 100)}% of the floor area`, 8);
  if (metrics.circulation > 0.34) fail('circulation exceeds a third of the floor area');

  // Programme.
  const counts: Record<string, number> = {};
  for (const r of loc.rooms) counts[stem(r.id)] = (counts[stem(r.id)] ?? 0) + 1;
  for (const [k, n] of Object.entries(PROGRAMME[loc.familyId] ?? {})) if ((counts[k] ?? 0) < n) fail(`needs ${n} x ${k}, has ${counts[k] ?? 0}`);

  // Windows.
  const wins = new Map<string, Opening[]>();
  for (const o of loc.openings) if (o.type === 'window') (wins.get(o.a) ?? wins.set(o.a, []).get(o.a)!).push(o);
  for (const r of loc.rooms) {
    const k = stem(r.id);
    const has = (wins.get(r.id) ?? []).length > 0;
    if (NEEDS_WINDOW.has(k) && !has && loc.setting === 'residential') fail(`${r.id} has no window`);
    if ((k === 'bedroom' || k === 'living') && !has) fail(`${r.id} has no window`);
  }

  // Doors and openings.
  const roomOpenings = new Map<string, Opening[]>();
  for (const o of loc.openings) {
    if (o.type === 'window') continue;
    for (const id of [o.a, o.b]) if (roomIds.has(id)) (roomOpenings.get(id) ?? roomOpenings.set(id, []).get(id)!).push(o);
  }
  for (const r of loc.rooms) if ((roomOpenings.get(r.id) ?? []).length === 0) fail(`${r.id} has no way in`);
  const ext = loc.openings.filter((o) => (o.type === 'door' || o.type === 'sliding') && (roomIds.has(o.a) !== roomIds.has(o.b)));
  metrics.exteriorDoors = ext.length;
  const maxExt = loc.familyId === 'motel_row' ? 9 : loc.familyId === 'warehouse' ? 6 : 3;
  if (ext.length < 1 || ext.length > maxExt) fail(`${ext.length} exterior doors`);
  if (loc.entries.length < 1 || loc.entries.length > 3) fail(`${loc.entries.length} entry zones`);
  for (const o of loc.openings) {
    if (o.type === 'door' || o.type === 'doorway' || o.type === 'sliding') {
      const width = Math.hypot(o.to.x - o.from.x, o.to.y - o.from.y);
      const exterior = roomIds.has(o.a) !== roomIds.has(o.b);
      if (o.type === 'door' && width < (exterior ? 3 : 2.5) - 1e-9) fail(`${o.id} is ${width} ft wide`);
      if (o.type === 'doorway' && roomIds.has(o.a) && roomIds.has(o.b) && width < 3 - 1e-9) fail(`${o.id} is ${width} ft wide`);
      const rs = [o.a, o.b].map((id) => byId.get(id)).filter((r): r is Room => Boolean(r));
      for (const r of rs) {
        const near = Math.min(...r.polygon.map((p) => Math.min(Math.hypot(p.x - o.from.x, p.y - o.from.y), Math.hypot(p.x - o.to.x, p.y - o.to.y))));
        if (near < 0.45) fail(`${o.id} sits in a corner of ${r.id}`);
      }
    }
  }
  const floorOf = (o: Opening) => byId.get(o.a)?.floor ?? byId.get(o.b)?.floor ?? 0;
  // Windows must not overlap doors or each other on one wall.
  const wall = loc.openings.filter((o) => o.type !== 'stair' && (roomIds.has(o.a) || roomIds.has(o.b)));
  for (let i = 0; i < wall.length; i++)
    for (let j = i + 1; j < wall.length; j++) {
      const p = wall[i];
      const q = wall[j];
      if (p.type === 'doorway' && !roomIds.has(p.a)) continue;
      if (!(p.a === q.a || p.a === q.b || p.b === q.a || p.b === q.b)) continue;
      if (floorOf(p) !== floorOf(q)) continue;
      if (segOverlap(p, q) > 0.2) fail(`${p.id} overlaps ${q.id}`);
    }

  // Door swings must not collide with one another or with furniture.
  const boxes: { id: string; room: string; box: Rect }[] = [];
  for (const o of loc.openings) {
    if (o.type !== 'door' || !o.swing) continue;
    const room = byId.get(o.swing.into);
    if (!room) continue;
    boxes.push({ id: o.id, room: room.id, box: swingBox(o.from, o.to, o.swing.hinge, room.polygon) });
  }
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++)
      if (boxes[i].room === boxes[j].room && overlapArea(boxes[i].box, boxes[j].box) > 0.1) fail(`${boxes[i].id} and ${boxes[j].id} swing into each other`);
  const objsBySpace = new Map<string, PlacedObject[]>();
  for (const o of loc.objects) (objsBySpace.get(o.in) ?? objsBySpace.set(o.in, []).get(o.in)!).push(o);
  for (const b of boxes) for (const o of objsBySpace.get(b.room) ?? []) if (o.type !== 'rug' && overlapArea(b.box, rectOf(o)) > 0.05) fail(`${o.id} sits in the swing of ${b.id}`);
  for (const [space, list] of objsBySpace)
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        if (list[i].type === 'rug' || list[j].type === 'rug' || (list[i].type === 'fence' && list[j].type === 'fence')) continue;
        if (overlapArea(rectOf(list[i]), rectOf(list[j])) > 0.05) fail(`${list[i].id} overlaps ${list[j].id} in ${space}`);
      }

  // Connectivity without passing through bedrooms or bathrooms.
  const graph = roomGraph(loc);
  const open = openZones(loc);
  const roots = loc.openings.filter((o) => o.type !== 'window' && o.type !== 'stair' && roomIds.has(o.a) !== roomIds.has(o.b) && open.has(roomIds.has(o.a) ? o.b : o.a)).map((o) => (roomIds.has(o.a) ? o.a : o.b));
  const seen = new Set(roots);
  const stack = [...roots];
  while (stack.length) {
    const id = stack.pop() as string;
    const k = stem(id);
    for (const n of graph.get(id) ?? []) {
      const ens = (byId.get(n)?.tags ?? []).includes('ensuite') && (k === 'bedroom' || k === 'unit');
      if (LEAF.has(k) && !ens) continue;
      if (!seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  for (const r of loc.rooms) if (!seen.has(r.id)) fail(`${r.id} is reachable only through a leaf room`);

  // Wet rooms and bedrooms open off sensible neighbours.
  for (const r of loc.rooms) {
    const k = stem(r.id);
    const nb = [...(graph.get(r.id) ?? [])].map(stem);
    if (k === 'bath' || k === 'wc') {
      if (r.tags.includes('ensuite')) continue;
      if (nb.some((n) => n === 'kitchen' || n === 'dining' || (res && n === 'living'))) fail(`${r.id} opens off ${nb.join('/')}`);
    }
    if (k === 'bedroom' && nb.some((n) => n === 'kitchen' || n === 'dining')) fail(`${r.id} opens off the kitchen or dining room`);
    if (k === 'kitchen' && nb.some((n) => n === 'bedroom' || n === 'bath')) fail(`${r.id} opens off a bedroom or bath`);
  }

  // Stairs line up between floors.
  const floors = loc.floors ?? 1;
  metrics.floors = floors;
  if (floors === 2) {
    const lo = loc.rooms.find((r) => r.id === 'stair_0');
    const hi = loc.rooms.find((r) => r.id === 'stair_1');
    if (!lo || !hi) fail('missing stair rooms');
    else {
      const a = polyArea(lo.polygon);
      const bbA = polyBBox(lo.polygon);
      const bbB = polyBBox(hi.polygon);
      const ov = overlapArea(R(bbA.x0, bbA.y0, bbA.x1, bbA.y1), R(bbB.x0, bbB.y0, bbB.x1, bbB.y1));
      if (ov < a * 0.9) fail('stair rooms are not aligned');
      if (!loc.openings.some((o) => o.type === 'stair')) fail('no stair opening');
    }
  }

  // Furniture essentials.
  for (const r of loc.rooms) {
    const k = stem(r.id);
    const kinds = new Set((objsBySpace.get(r.id) ?? []).map((o) => o.type));
    if (k === 'bedroom' && !kinds.has('bed')) fail(`${r.id} has no bed`);
    if ((k === 'bath' || k === 'wc') && !kinds.has('toilet')) fail(`${r.id} has no toilet`);
    if (k === 'kitchen' && loc.familyId !== 'bar_restaurant' && !(kinds.has('stove') && kinds.has('sink') && kinds.has('fridge'))) fail(`${r.id} lacks an appliance`);
    if (k === 'living' && !kinds.has('sofa')) dock(`${r.id} has no sofa`, 6);
  }
  // Free floor: how much of each furnished room stays walkable.
  let worst = 1;
  for (const r of loc.rooms) {
    const list = (objsBySpace.get(r.id) ?? []).filter((o) => o.type !== 'rug' && o.type !== 'plant');
    if (list.length === 0) continue;
    const bb = polyBBox(r.polygon);
    let cells = 0;
    let freeCells = 0;
    for (let x = bb.x0 + 0.25; x < bb.x1; x += 0.5)
      for (let y = bb.y0 + 0.25; y < bb.y1; y += 0.5) {
        if (!inside({ x, y }, r.polygon)) continue;
        cells++;
        if (list.every((o) => !hit(rectOf(o), x, y))) freeCells++;
      }
    const frac = cells ? freeCells / cells : 1;
    worst = Math.min(worst, frac);
    if (frac < 0.3) dock(`${r.id} has only ${Math.round(frac * 100)}% free floor`, 6);
  }
  metrics.worstFreeFloor = Math.round(worst * 100) / 100;
  return { score: Math.max(0, score), pass: score >= PASS_SCORE && !notes.some((n) => n.startsWith('FAIL')), metrics, notes };
}

function hit(r: Rect, x: number, y: number, pad = 0.6): boolean {
  return x > r.x0 - pad && x < r.x1 + pad && y > r.y0 - pad && y < r.y1 + pad;
}

function inside(p: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** Length of wall two openings share, when they lie on one line. */
function segOverlap(p: Opening, q: Opening): number {
  const dx = p.to.x - p.from.x;
  const dy = p.to.y - p.from.y;
  const L = Math.hypot(dx, dy);
  if (L < 1e-9) return 0;
  const ux = dx / L;
  const uy = dy / L;
  const off = (v: { x: number; y: number }) => Math.abs((v.x - p.from.x) * -uy + (v.y - p.from.y) * ux);
  if (off(q.from) > 0.05 || off(q.to) > 0.05) return 0;
  const t = (v: { x: number; y: number }) => (v.x - p.from.x) * ux + (v.y - p.from.y) * uy;
  const lo = Math.max(0, Math.min(t(q.from), t(q.to)));
  const hi = Math.min(L, Math.max(t(q.from), t(q.to)));
  return Math.max(0, hi - lo);
}

/**
 * Plan signature for distinctness: sorted room stems, the stem-level adjacency graph, and
 * rounded room dimensions.
 */
export function planSignature(loc: LocationDefinition): string {
  const g = roomGraph(loc);
  const edges: string[] = [];
  for (const [a, ns] of g) for (const b of ns) if (a < b) edges.push([stem(a), stem(b)].sort().join('-'));
  const dims = loc.rooms.map((r) => {
    const bb = polyBBox(r.polygon);
    return `${stem(r.id)}${Math.round(bb.x1 - bb.x0)}x${Math.round(bb.y1 - bb.y0)}`;
  });
  return [loc.rooms.map((r) => stem(r.id)).sort().join(','), edges.sort().join(','), dims.sort().join(','), loc.footprint.length].join('|');
}
