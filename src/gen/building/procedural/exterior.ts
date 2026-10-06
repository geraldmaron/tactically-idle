import type { MapNote, Opening, PlacedObject } from '../../../sim/types';
import { type Rect, R, distToPoly, norm, inflate, lerp, overlapArea, polyBBox, rectInsidePoly, rectsOverlap, vec } from './geom';
import type { PendingExterior } from './openings';
import type { Rand } from './rand';
import type { ExteriorSpec, LotSpec, Plan } from './types';
import type { ZoneSet } from './zones';

function object(id: string, type: PlacedObject['type'], inSpace: string, r: Rect, tags: string[] = [], blocks = false): PlacedObject {
  const t = blocks ? [...tags, 'blocks_space'] : tags;
  return { id, type, in: inSpace, x: r.x0, y: r.y0, w: r.x1 - r.x0, h: r.y1 - r.y0, rotation: 0, mechanical: t.length > 0 && type !== 'fence', tags: t };
}

/**
 * Yard furniture and notes, plus the entry zones squads can start from. Returns the entry
 * zone ids, or null when the lot cannot supply any.
 */
export function exteriorObjects(
  plan: Plan,
  lot: LotSpec,
  ext: ExteriorSpec,
  zs: ZoneSet,
  openings: Opening[],
  doors: PendingExterior[],
  objects: PlacedObject[],
  notes: MapNote[],
  rng: Rand,
): string[] | null {
  const zoneById = new Map(zs.zones.map((z) => [z.id, z]));
  const cls = (id: string) => zs.classOf.get(id) ?? '';
  const taken: Rect[] = [];
  const doorBoxes = openings.filter((o) => o.type === 'door' || o.type === 'sliding').filter((o) => zoneById.has(o.b)).map((o) => ({ o, mid: lerp(o.from, o.to, 0.5) }));
  const clearOfDoors = (r: Rect, d: number) => doorBoxes.every(({ mid }) => mid.x < r.x0 - d || mid.x > r.x1 + d || mid.y < r.y0 - d || mid.y > r.y1 + d);
  const free = (r: Rect, gap = 0.5) => taken.every((t) => !rectsOverlap(inflate(t, gap), r));
  const fpPoly = plan.footprintSq ?? plan.footprint;
  const addObj = (o: PlacedObject) => {
    objects.push(o);
    taken.push(R(o.x, o.y, o.x + o.w, o.y + o.h));
  };

  // Fences along the lot edge, split where the zone changes.
  const fenceOk = new Set(['front', 'back', 'west', 'east']);
  if (ext.fences) {
    const lines: { vertical: boolean; at: number; lo: number; hi: number }[] = [
      { vertical: true, at: 1.5, lo: 0, hi: lot.h },
      { vertical: true, at: lot.w - 1.5, lo: 0, hi: lot.h },
      { vertical: false, at: 1.5, lo: 0, hi: lot.w },
    ];
    if (ext.kind === 'warehouse') lines.push({ vertical: false, at: lot.h - 1.5, lo: 0, hi: lot.w });
    let n = 0;
    for (const ln of lines) {
      let cur: { zone: string; start: number } | null = null;
      const flush = (end: number) => {
        if (cur && end - cur.start >= 3) {
          const r = ln.vertical ? R(ln.at - 0.2, cur.start, ln.at + 0.2, end) : R(cur.start, ln.at - 0.2, end, ln.at + 0.2);
          const z = zoneById.get(cur.zone);
          if (z && rectInsidePoly(r, z.polygon)) addObj(object(`o_fence_${++n}`, 'fence', cur.zone, r));
        }
        cur = null;
      };
      for (let t = ln.lo; t < ln.hi - 1e-9; t += 0.5) {
        const p = ln.vertical ? vec(ln.at, t + 0.25) : vec(t + 0.25, ln.at);
        const zid = zs.at(p);
        const ok = zid !== null && fenceOk.has(cls(zid));
        if (ok && cur && cur.zone === zid) continue;
        flush(t);
        if (ok) cur = { zone: zid as string, start: t };
      }
      flush(ln.hi);
    }
  }

  // Steps at the foot of a porch.
  const porch = zs.zones.find((z) => cls(z.id) === 'porch');
  const frontDoor = doors.find((d) => d.kind === 'front');
  if (porch && frontDoor && Math.abs(frontDoor.normal.y) > 0.9 && frontDoor.normal.y > 0) {
    const pb = polyBBox(porch.polygon);
    const w = Math.min(5, Math.max(3.5, Math.floor((pb.x1 - pb.x0 - 1) / 0.5) * 0.5));
    const cx = (frontDoor.from.x + frontDoor.to.x) / 2;
    const r = R(Math.round((cx - w / 2) / 0.5) * 0.5, pb.y1, Math.round((cx - w / 2) / 0.5) * 0.5 + w, pb.y1 + 3);
    const z = zs.zones.find((q) => zs.at(vec((r.x0 + r.x1) / 2, r.y0 + 0.5)) === q.id);
    if (z && rectInsidePoly(r, z.polygon) && free(r, 0)) addObj(object('o_steps', 'steps', z.id, r));
  }

  // Candidate spots for planting: inside a zone, off the walls, away from doors and each other.
  const spot = (zoneIds: string[], w: number, h: number, wall: number, doorGap: number): { zone: string; rect: Rect } | null => {
    for (let k = 0; k < 40; k++) {
      const zid = rng.pick(zoneIds);
      const z = zoneById.get(zid);
      if (!z) continue;
      const bb = polyBBox(z.polygon);
      if (bb.x1 - bb.x0 < w + 1 || bb.y1 - bb.y0 < h + 1) continue;
      const x = rng.snapped(bb.x0 + 0.5, bb.x1 - w - 0.5);
      const y = rng.snapped(bb.y0 + 0.5, bb.y1 - h - 0.5);
      const r = R(x, y, x + w, y + h);
      if (!rectInsidePoly(r, z.polygon) || !free(r, 0.5) || !clearOfDoors(r, doorGap)) continue;
      const c = vec((x + x + w) / 2, (y + y + h) / 2);
      if (distToPoly(c, fpPoly) < wall + Math.min(w, h) / 2) continue;
      if (zs.at(c) !== zid) continue;
      return { zone: zid, rect: r };
    }
    return null;
  };

  const yards = zs.zones.filter((z) => ['front', 'west', 'east', 'back'].includes(cls(z.id)));
  const frontYards = zs.zones.filter((z) => cls(z.id) === 'front').map((z) => z.id);
  let shrubs = 0;
  const shrubCount = ext.kind === 'house' || ext.kind === 'semi' ? rng.int(2, 6) : ext.kind === 'warehouse' ? 0 : rng.int(0, 3);
  for (let i = 0; i < shrubCount; i++) {
    const pool = rng.chance(0.7) && frontYards.length ? frontYards : yards.map((z) => z.id);
    if (pool.length === 0) break;
    const s = rng.snapped(2.5, 3.5);
    const sp = spot(pool, s, s, 1.5, 4);
    if (sp) {
      addObj(object(`o_shrub${++shrubs}`, 'shrub', sp.zone, sp.rect, ['cover']));
    }
  }
  const treeCount = ext.kind === 'house' || ext.kind === 'semi' ? rng.int(0, 2) : ext.kind === 'office' || ext.kind === 'motel' ? rng.int(0, 2) : 0;
  for (let i = 0; i < treeCount; i++) {
    const sp = spot(yards.map((z) => z.id), 4, 4, 3.5, 5);
    if (sp) addObj(object(`o_tree${i + 1}`, 'tree', sp.zone, sp.rect));
  }
  // Patio tables outside a bar.
  const patio = zs.zones.find((z) => cls(z.id) === 'patio');
  if (patio && ext.kind === 'bar') {
    const tables = rng.int(2, 4);
    for (let i = 0; i < tables; i++) {
      const sp = spot([patio.id], 3, 3, 1.5, 3);
      if (!sp) continue;
      addObj(object(`o_patio_table${i + 1}`, 'dining_table', sp.zone, sp.rect, ['cover']));
    }
  }
  // Planters along a shop front.
  if (ext.kind === 'shop' || ext.kind === 'office') {
    const st = zs.zones.filter((z) => cls(z.id) === 'street' || cls(z.id) === 'front').map((z) => z.id);
    const planters = rng.int(0, 2);
    for (let i = 0; i < planters && st.length; i++) {
      const sp = spot(st, 2.5, 2.5, 0.5, 4);
      if (sp) addObj(object(`o_planter${i + 1}`, 'shrub', sp.zone, sp.rect, ['cover']));
    }
  }

  // Zone tags that follow from what was placed.
  for (const z of zs.zones) {
    if (objects.some((o) => o.in === z.id && o.type === 'shrub') && !z.tags.includes('cover')) z.tags.push('cover');
    if (objects.some((o) => o.in === z.id && o.type === 'fence') && !z.tags.includes('fence')) z.tags.push('fence');
    if (cls(z.id) === 'parking' || cls(z.id) === 'driveway') {
      if (!z.tags.includes('cover')) z.tags.push('cover');
    }
  }

  // Notes in the reference's spirit.
  const putNote = (id: string, text: string, zoneId: string | undefined, prefer: 'low' | 'any') => {
    const z = zoneId ? zoneById.get(zoneId) : undefined;
    if (!z) return;
    const bb = polyBBox(z.polygon);
    for (let k = 0; k < 30; k++) {
      const x = rng.snapped(bb.x0 + 1, Math.max(bb.x0 + 1, bb.x1 - 1));
      const y = prefer === 'low' ? rng.snapped(Math.max(bb.y0 + 1, bb.y1 - 3), Math.max(bb.y0 + 1, bb.y1 - 1)) : rng.snapped(bb.y0 + 1, Math.max(bb.y0 + 1, bb.y1 - 1));
      const p = vec(x, y);
      if (zs.at(p) !== z.id) continue;
      if (taken.some((t) => overlapArea(inflate(t, 1.2), R(x - 2, y - 0.6, x + 2, y + 0.6)) > 0)) continue;
      if (notes.some((n) => norm(n.at.x - x, n.at.y - y) < 4)) continue;
      notes.push({ id, text, at: p, decorative: true });
      return;
    }
  };
  const front = frontYards[0] ?? zs.zones.find((z) => cls(z.id) === 'street')?.id;
  if (shrubs >= 2) putNote('n_cover', 'Good cover.', front, 'low');
  if (ext.fences) putNote('n_fence', `Fence line ~${Math.round((lot.w - 3) / 5) * 5}'`, front ?? yards[0]?.id, 'low');
  const gate = zs.paths.find((p) => ['west', 'east'].includes(cls(p.b)) && cls(p.a) === 'front');
  if (ext.fences && gate && rng.chance(0.7)) putNote('n_gate', 'Side gate', gate.b, 'any');
  const bins = zs.zones.find((z) => cls(z.id) === 'alley') ?? zs.zones.find((z) => cls(z.id) === 'back');
  if (bins && ext.kind !== 'apartment' && rng.chance(0.7)) putNote('n_bins', 'Trash cans', bins.id, 'any');
  const cars = zs.zones.find((z) => cls(z.id) === 'parking' || cls(z.id) === 'driveway');
  if (cars) putNote('n_cars', cls(cars.id) === 'driveway' ? 'Car in driveway' : 'Parked cars', cars.id, 'any');

  // Entries: where the front and any back or side door open out.
  const entries: string[] = [];
  const addEntry = (zid: string) => {
    const z = zoneById.get(zid);
    if (!z) return;
    let target = z;
    if (cls(z.id) === 'porch' || cls(z.id) === 'back_step') {
      const link = zs.paths.find((p) => (p.a === z.id || p.b === z.id) && !['porch', 'back_step'].includes(cls(p.a === z.id ? p.b : p.a)));
      const other = link ? zoneById.get(link.a === z.id ? link.b : link.a) : undefined;
      if (other) target = other;
    }
    if (!entries.includes(target.id)) entries.push(target.id);
  };
  for (const d of doors) {
    if (d.kind.startsWith('unit_')) continue;
    const op = openings.find((o) => o.id === d.id);
    if (op) addEntry(op.b);
  }
  if (ext.kind === 'apartment') {
    const stair = zs.zones.find((z) => cls(z.id) === 'stairwell');
    if (stair && !entries.includes(stair.id)) entries.push(stair.id);
  }
  const street = zs.zones.find((z) => cls(z.id) === 'street');
  if (street && !entries.includes(street.id) && entries.length < 3 && ext.kind !== 'house' && ext.kind !== 'semi') entries.unshift(street.id);
  return entries.length > 0 ? entries.slice(0, 3) : null;
}
