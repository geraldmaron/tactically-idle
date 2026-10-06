import { type Rect, R, rcx, rcy, rh, rw } from './geom';
import { RoomCtx, type Side, type WallSpot } from './ctx';

export type Kit = (c: RoomCtx) => void;

const mid = (r: Rect) => ({ x: rcx(r), y: rcy(r) });

/** Rect of `len` x `depth` flush against `rect` on its `side`, aligned to the side's start offset. */
function beside(rect: Rect, side: Side, len: number, depth: number, along = 0): Rect {
  switch (side) {
    case 'n':
      return R(rect.x0 + along, rect.y0 - depth, rect.x0 + along + len, rect.y0);
    case 's':
      return R(rect.x0 + along, rect.y1, rect.x0 + along + len, rect.y1 + depth);
    case 'w':
      return R(rect.x0 - depth, rect.y0 + along, rect.x0, rect.y0 + along + len);
    case 'e':
      return R(rect.x1, rect.y0 + along, rect.x1 + depth, rect.y0 + along + len);
  }
}

const farFromDoors = (c: RoomCtx) => (s: WallSpot) => c.doorDist(mid(s.rect)) * 0.25 + s.edgeLen * 0.05;

export const bedroom: Kit = (c) => {
  const r = c.rng;
  const small = c.area < 105;
  const [bw, bl] = small ? r.pick([[3.5, 6.5], [4.5, 6.3]] as const) : r.pick([[5, 6.7], [5, 6.7], [6, 6.8], [4.5, 6.3]] as const);
  let bed = c.wall('bed', bw, bl, { blocks: true, gap: 0.6, score: (s) => s.edgeLen * 0.12 + c.doorDist(mid(s.rect)) * 0.15 });
  if (!bed) bed = c.wall('bed', 3.5, 6.5, { blocks: true, gap: 0.4 });
  if (!bed) return;
  const back = c.objects[c.objects.length - 1].rotation;
  const side: Side = back === 0 ? 'n' : back === 90 ? 'e' : back === 180 ? 's' : 'w';
  // Nightstands flank the head of the bed.
  const headOnX = side === 'n' || side === 's';
  const stands = r.chance(0.65) ? 2 : 1;
  for (let k = 0; k < stands; k++) {
    const left = k === 0;
    let ns: Rect;
    if (headOnX) {
      const y0 = side === 'n' ? bed.y0 : bed.y1 - 1.6;
      ns = left ? R(bed.x0 - 1.6, y0, bed.x0, y0 + 1.6) : R(bed.x1, y0, bed.x1 + 1.6, y0 + 1.6);
    } else {
      const x0 = side === 'w' ? bed.x0 : bed.x1 - 1.6;
      ns = left ? R(x0, bed.y0 - 1.6, x0 + 1.6, bed.y0) : R(x0, bed.y1, x0 + 1.6, bed.y1 + 1.6);
    }
    if (c.ok(ns, { gap: 0 })) c.put('nightstand', ns, { back: side, gap: 0 });
    else if (k === 0 && stands === 2) continue;
  }
  c.wall('wardrobe', r.pick([4, 5, 6]), 2.3, { blocks: true, tall: true, tags: ['blocks_sight', 'concealment'] });
  if (!c.lean && r.chance(0.7)) c.wall('dresser', r.pick([3.5, 4, 5]), 1.8, { tags: c.room.seed.key === 'bedroom' && r.chance(0.35) ? ['valuables'] : [] });
  if (!c.lean && r.chance(small ? 0.1 : 0.3)) c.wall('desk', 4, 2.2, { tags: ['cover'] });
  if (!c.lean && r.chance(0.18)) c.wall('tv', 3.2, 1.4, { tags: ['valuables'] });
  if (!c.lean && r.chance(0.2)) c.wall('plant', 1.4, 1.4);
  if (!c.lean && !small && r.chance(0.45)) {
    const rug = R(bed.x0 - 1, bed.y0 - 1, bed.x1 + 1, bed.y1 + 1);
    const room = R(Math.max(rug.x0, c.bb.x0 + 0.5), Math.max(rug.y0, c.bb.y0 + 0.5), Math.min(rug.x1, c.bb.x1 - 0.5), Math.min(rug.y1, c.bb.y1 - 0.5));
    if (rw(room) >= 4 && rh(room) >= 5 && c.fitsLoose(room) && c.clear.every((k) => !(k.x1 > room.x0 && k.x0 < room.x1 && k.y1 > room.y0 && k.y0 < room.y1))) c.put('rug', room, { overlay: true });
  }
};

export const bath: Kit = (c) => {
  const r = c.rng;
  const shower = c.room.tags.includes('ensuite') ? r.chance(0.75) : r.chance(0.3);
  if (shower) {
    if (!c.wall('tub', 3, 3, { blocks: true, tags: ['shower'], gap: 0.1, score: (s) => -Math.min(s.t, s.edgeLen - 3 - s.t) })) c.wall('tub', 3, 3, { blocks: true, tags: ['shower'], gap: 0.1 });
  } else if (!c.wall('tub', 5, 2.6, { blocks: true, gap: 0.1, score: (s) => -Math.abs(s.edgeLen - 6) })) c.wall('tub', 5, 2.6, { blocks: true, gap: 0.1 });
  c.wall('toilet', 1.8, 2.6, { gap: 0.2, score: farFromDoors(c) });
  c.wall('vanity', r.pick([2, 2.5, 3]), 1.8, { gap: 0.2 });
};

export const wc: Kit = (c) => {
  c.wall('toilet', 1.8, 2.6, { gap: 0.1, score: farFromDoors(c) });
  if (c.area > 26) c.wall('vanity', 1.6, 1.3, { gap: 0.1 });
};

/** Kitchen: counter runs along one to three walls with the appliances in them. */
export const kitchen: Kit = (c) => {
  const r = c.rng;
  const depth = 2;
  const edges = new Map<number, { t0: number; t1: number; back: Side; edge: number }[]>();
  for (const s of c.wallSpots(0.5, depth)) {
    if (!c.ok(s.rect, { gap: 0.1 })) continue;
    const list = edges.get(s.edge) ?? [];
    const last = list[list.length - 1];
    if (last && Math.abs(last.t1 - s.t) < 0.01) last.t1 = s.t + 0.5;
    else list.push({ t0: s.t, t1: s.t + 0.5, back: s.back, edge: s.edge });
    edges.set(s.edge, list);
  }
  const runs = [...edges.values()]
    .flat()
    .filter((x) => x.t1 - x.t0 >= 3)
    .sort((a, b) => b.t1 - b.t0 - (a.t1 - a.t0) + (r.float() - 0.5) * 3);
  const pending: ('sink' | 'stove' | 'fridge')[] = r.shuffle(['sink', 'stove', 'fridge'] as const);
  const dims: Record<string, [number, number]> = { fridge: [2.5, 2.6], stove: [2.5, 2.2], sink: [3, 2] };
  const want = c.area > 150 ? r.int(2, 3) : r.int(1, 2);
  for (let w = 0; w < runs.length && (w < want || pending.length > 0); w++) {
    const run = runs[w];
    let t = run.t0;
    let len = run.t1 - run.t0;
    const place = (type: 'counter' | 'stove' | 'fridge' | 'sink', l: number, d: number): boolean => {
      const spot = c.wallSpots(l, d).find((s) => s.edge === run.edge && Math.abs(s.t - t) < 0.01);
      if (!spot || !c.ok(spot.rect, { gap: 0.05, tall: type === 'fridge' })) return false;
      const tags = type === 'counter' ? ['cover'] : type === 'fridge' ? ['blocks_sight'] : type === 'stove' ? ['hazard'] : [];
      c.put(type, spot.rect, { back: run.back, blocks: type === 'counter' || type === 'fridge', tags, gap: 0.05 });
      return true;
    };
    let lastWasCounter = r.chance(0.4);
    while (len >= 1.5) {
      const next = pending[0];
      if (next && lastWasCounter && len >= dims[next][0] - 1e-9) {
        if (place(next, dims[next][0], dims[next][1])) {
          pending.shift();
          t += dims[next][0];
          len -= dims[next][0];
          lastWasCounter = false;
          continue;
        }
      }
      let l = Math.min(r.pick([2, 3, 4]), len);
      if (len - l < 1.5) l = len;
      if (!place('counter', Math.min(l, 6), 2)) break;
      t += Math.min(l, 6);
      len -= Math.min(l, 6);
      lastWasCounter = true;
    }
  }
  for (const type of pending) {
    const [l, d] = dims[type];
    if (!c.wall(type, l, d, { blocks: type === 'fridge', tall: type === 'fridge', tags: type === 'fridge' ? ['blocks_sight'] : type === 'stove' ? ['hazard'] : [], gap: 0.05 })) c.fail = true;
  }
  if (!c.lean && c.area >= 150 && r.chance(0.25)) c.center('counter', 2.5, 5, { blocks: true, tags: ['cover'], margin: 3.5 });
  else if (!c.lean && c.area >= 120 && r.chance(0.65)) table(c, r.chance(0.5) ? 4 : 6);
};

/** Dining table with chairs around it, centred in the free floor, with an aisle kept around the group. */
function table(c: RoomCtx, chairs: number): boolean {
  const long = chairs === 6 ? 6.5 : 4.5;
  const horizontal = rw(R(c.bb.x0, c.bb.y0, c.bb.x1, c.bb.y1)) >= rh(R(c.bb.x0, c.bb.y0, c.bb.x1, c.bb.y1));
  const [w, h] = horizontal ? [long, 3] : [3, long];
  const t = c.center('dining_table', w, h, { blocks: true, margin: 3, gap: 2.4 });
  if (!t) return false;
  const per = chairs / 2;
  for (let i = 0; i < per; i++) {
    const off = (long - per * 1.4) / (per + 1) + i * (1.4 + (long - per * 1.4) / (per + 1));
    const a = horizontal ? R(t.x0 + off, t.y0 - 1.5, t.x0 + off + 1.4, t.y0 - 0.1) : R(t.x0 - 1.5, t.y0 + off, t.x0 - 0.1, t.y0 + off + 1.4);
    const b = horizontal ? R(t.x0 + off, t.y1 + 0.1, t.x0 + off + 1.4, t.y1 + 1.5) : R(t.x1 + 0.1, t.y0 + off, t.x1 + 1.5, t.y0 + off + 1.4);
    for (const q of [a, b]) if (c.fits(q) && c.free(q, 0, false, t)) c.put('chair', q, { gap: 0 });
  }
  return true;
}

export const dining: Kit = (c) => {
  const r = c.rng;
  if (!table(c, c.area > 130 && r.chance(0.6) ? 6 : 4)) c.center('dining_table', 3, 4.5, { blocks: true, margin: 2.5 });
  if (!c.lean && r.chance(0.5)) c.wall('shelf', 4, 1.6, { tags: ['blocks_sight'], tall: true });
  if (!c.lean && r.chance(0.25)) c.wall('plant', 1.4, 1.4);
};

export const living: Kit = (c) => {
  const r = c.rng;
  const sofaLen = c.area > 190 ? r.pick([7, 7.5, 8]) : r.pick([6, 6.5, 7]);
  const sofa = c.wall('sofa', sofaLen, 3, { blocks: true, tags: ['cover'], gap: 0.8, score: (s) => s.edgeLen * 0.1 + c.doorDist(mid(s.rect)) * 0.15 });
  if (sofa) {
    const rot = c.objects[c.objects.length - 1].rotation;
    const side: Side = rot === 0 ? 'n' : rot === 90 ? 'e' : rot === 180 ? 's' : 'w';
    const opp: Side = side === 'n' ? 's' : side === 's' ? 'n' : side === 'e' ? 'w' : 'e';
    const horizontal = side === 'n' || side === 's';
    const cx = rcx(sofa);
    const cy = rcy(sofa);
    // Coffee table in front, centred on the sofa.
    const ct = horizontal ? R(cx - 2.25, 0, cx + 2.25, 2.4) : R(0, cy - 2.25, 2.4, cy + 2.25);
    const gap = 1.4;
    let rect: Rect;
    if (horizontal) rect = side === 'n' ? R(ct.x0, sofa.y1 + gap, ct.x1, sofa.y1 + gap + 2.4) : R(ct.x0, sofa.y0 - gap - 2.4, ct.x1, sofa.y0 - gap);
    else rect = side === 'w' ? R(sofa.x1 + gap, ct.y0, sofa.x1 + gap + 2.4, ct.y1) : R(sofa.x0 - gap - 2.4, ct.y0, sofa.x0 - gap, ct.y1);
    if (!c.lean && c.ok(rect, { gap: 0.2 })) {
      c.put('coffee_table', rect, { gap: 0.2 });
      const rug = R(rect.x0 - 1.5, rect.y0 - 1.5, rect.x1 + 1.5, rect.y1 + 1.5);
      if (r.chance(0.5) && c.fitsLoose(rug) && c.fits(rug)) c.put('rug', rug, { overlay: true });
    }
    // TV on the facing wall.
    const tvLen = r.pick([3.2, 4]);
    const wantX = horizontal ? cx : null;
    const wantY = horizontal ? null : cy;
    c.wall('tv', tvLen, 1.4, {
      back: opp,
      tags: ['valuables'],
      score: (s) => -Math.abs((wantX !== null ? rcx(s.rect) - wantX : rcy(s.rect) - (wantY as number))) + 2,
    });
    // Armchairs flank the table.
    for (let k = 0; k < r.int(1, 2); k++) {
      const chair = c.center('armchair', 3, 3, { margin: 1.2, around: { x: rcx(rect), y: rcy(rect) }, gap: 0.6 });
      if (!chair) break;
    }
  } else {
    c.center('sofa', 7, 3, { blocks: true, tags: ['cover'] });
  }
  if (!c.lean && r.chance(0.5)) c.wall('shelf', r.pick([3, 4, 5]), 1.3, { tall: true, tags: ['blocks_sight'] });
  if (!c.lean && r.chance(0.5)) c.wall('plant', 1.5, 1.5);
};

export const study: Kit = (c) => {
  const r = c.rng;
  const desk = c.wall('desk', r.pick([5, 5.5, 6]), 2.6, { blocks: true, tags: ['cover', ...(r.chance(0.5) ? ['valuables'] : [])], gap: 1.2 });
  if (desk) {
    const rot = c.objects[c.objects.length - 1].rotation;
    const side: Side = rot === 0 ? 'n' : rot === 90 ? 'e' : rot === 180 ? 's' : 'w';
    const seat = beside(desk, side === 'n' ? 's' : side === 's' ? 'n' : side === 'e' ? 'w' : 'e', 1.6, 1.6, (side === 'n' || side === 's' ? rw(desk) : rh(desk)) / 2 - 0.8);
    if (c.fits(seat) && c.free(seat, 0)) c.put('chair', seat, { gap: 0 });
  }
  c.wall('shelf', r.pick([4, 5, 6]), 1.3, { tall: true, tags: ['blocks_sight'] });
  if (!c.lean && r.chance(0.4)) c.wall('shelf', 4, 1.3, { tall: true, tags: ['blocks_sight'] });
  if (!c.lean && r.chance(0.3)) c.wall('armchair', 3, 3);
};

export const utility: Kit = (c) => {
  const r = c.rng;
  c.wall('counter', 2.6, 2.6, { blocks: true, tags: ['appliance'] });
  c.wall('counter', 2.6, 2.6, { blocks: true, tags: ['appliance'] });
  c.wall('counter', 2, 2, { tags: ['hazard', 'boiler'] });
  if (!c.lean && r.chance(0.6)) c.wall('shelf', 4, 1.3, { tall: true, tags: ['blocks_sight'] });
  if (!c.lean && r.chance(0.5)) c.wall('sink', 2, 1.8);
};

export const storage: Kit = (c) => {
  const r = c.rng;
  c.wall('shelf', Math.min(6, Math.max(3, Math.floor((Math.max(rw(c.bb), rh(c.bb)) - 2) / 0.5) * 0.5)), 1.5, { tall: true, tags: ['blocks_sight', 'storage'], gap: 0.2 });
  if (r.chance(0.6)) c.wall('shelf', 4, 1.5, { tall: true, tags: ['blocks_sight', 'storage'], gap: 0.2 });
};

export const hall: Kit = (c) => {
  const r = c.rng;
  if (rw(c.bb) < 4 && rh(c.bb) < 4) return;
  if (r.chance(0.3)) c.wall('plant', 1.4, 1.4, { gap: 0.5 });
  if (r.chance(0.2)) c.wall('shelf', 3, 1.1, { gap: 0.8, tags: ['blocks_sight'] });
};

export const stairs: Kit = () => undefined;

export const HOME_KITS: Record<string, Kit> = { bedroom, bath, wc, kitchen, dining, living, study, utility, storage, hall, landing: hall, stair: stairs };
