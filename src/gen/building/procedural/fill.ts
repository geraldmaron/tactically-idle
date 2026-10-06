import type { Rand } from './rand';
import { R, type Rect, rarea, rh, rw } from './geom';
import { distribute } from './slice';
import type { Piece } from './strips';
import type { RoomSeed } from './types';

export interface Item {
  seed: RoomSeed;
  /** Jittered target area, sq ft. */
  area: number;
}

export interface Assignment {
  piece: Piece;
  items: Item[];
}

export interface PlacedSeed {
  seed: RoomSeed;
  rect: Rect;
  /** Carved ensuite, when the seed has one. */
  ensuite?: { seed: RoomSeed; rect: Rect };
}

const itemArea = (it: Item) => it.area + (it.seed.ensuite?.area ?? 0);

function pieceThickness(p: Piece): { t: number; len: number } {
  return p.rowAxis === 'y' ? { t: rw(p.rect), len: rh(p.rect) } : { t: rh(p.rect), len: rw(p.rect) };
}

function pieceCost(p: Piece, items: Item[], filler = false): number {
  // A small piece may be left to a closet or store; a big one may not.
  if (items.length === 0) return filler && rarea(p.rect) <= 120 ? 5 : 60;
  let cost = 0;
  const A = rarea(p.rect);
  const sum = items.reduce((a, it) => a + itemArea(it), 0);
  const s = A / sum;
  // |s - 1/s| / 2 tracks |ln s| near 1 and is symmetric in s and 1/s, using only exact
  // arithmetic (Math.log is implementation-approximated; see geom.ts norm).
  cost += 2 * Math.abs(s - 1 / s);
  if (s < 0.62) cost += 30 * (0.62 - s) + 4;
  if (s > 1.7) cost += 12 * (s - 1.7) + 3;
  const { t, len } = pieceThickness(p);
  let minLen = 0;
  let hasPub = false;
  let hasLeaf = false;
  for (const it of items) {
    const sd = it.seed;
    const area = s * it.area;
    const w = area / t;
    if (area < sd.minArea * 0.97) cost += 5 + (sd.minArea - area) / 10;
    if (area > sd.maxArea * 1.03) cost += 3 + (area - sd.maxArea) / 20;
    const we = Math.max(w, sd.minW);
    const aspect = Math.max(we, t) / Math.max(0.1, Math.min(we, t));
    if (aspect > sd.maxAspect * 1.02) cost += 6;
    if (aspect > 2.95) cost += 30;
    if (sd.windows !== 'none' && sd.windows !== 'small' && !p.windowable) cost += sd.type === 'bedroom' || sd.type === 'living' ? 100 : 40;
    minLen += Math.max(w, sd.ensuite ? 8 : sd.minW);
    if (sd.ensuite && t < 15) cost += 40;
    if (sd.cls === 'pub') hasPub = true;
    if (sd.cls === 'leaf') hasLeaf = true;
    cost += 1.4 * Math.abs(sd.front - p.frontness) * (it.area / A);
    // A cap touches the hall only at its end: one hall-needing room may fill it, nothing else may.
    const soleRoom = items.length === 1;
    if (p.kind === 'cap' && !sd.capOk && !(sd.needsHall && soleRoom)) cost += 100;
    if (p.kind !== 'side' && sd.needsHall && !(p.kind === 'cap' && soleRoom)) cost += 100;
    if (p.kind === 'iso' && sd.cls === 'leaf' && !sd.capOk) cost += 100;
  }
  if (minLen > len + 1e-9) cost += 30 + (minLen - len) * 3;
  if (hasPub && hasLeaf) cost += 1.5;
  return cost;
}

/**
 * Choose which seeds go in which piece by seeded annealing. Required seeds always get a
 * piece; optional ones may be left out. The cost keeps each piece's rooms near their
 * target areas, in sensible zones for the piece's position, and within the piece's length.
 */
export function assignRooms(pieces: Piece[], seeds: RoomSeed[], rng: Rand, filler?: RoomSeed): Assignment[] | null {
  const n = seeds.length;
  const jitter = seeds.map(() => rng.range(0.92, 1.14));
  const bucketsOf = (w: number[]) => {
    const buckets: Item[][] = pieces.map(() => []);
    w.forEach((pi, i) => {
      if (pi >= 0) buckets[pi].push({ seed: seeds[i], area: seeds[i].area * jitter[i] });
    });
    return buckets;
  };
  const total = (w: number[]) => {
    let c = 0;
    bucketsOf(w).forEach((items, pi) => (c += pieceCost(pieces[pi], items, Boolean(filler))));
    seeds.forEach((sd, i) => {
      if (sd.required) return;
      c += w[i] >= 0 ? (1 - sd.prob) * 1.5 : sd.prob * 2.2;
    });
    // No more baths (ensuites included) than bedrooms: a dwelling fills spare floor with something else.
    let beds = 0;
    let baths = 0;
    seeds.forEach((sd, i) => {
      if (w[i] < 0) return;
      if (sd.key === 'bedroom') beds++;
      if (sd.key === 'bath') baths++;
      if (sd.ensuite) baths++;
    });
    if (beds > 0 && baths > beds) c += 46 * (baths - beds);
    return c;
  };
  /** Cost of the pieces that hold something; empty pieces are not charged yet. */
  const partial = (w: number[]) => {
    let c = 0;
    bucketsOf(w).forEach((items, pi) => {
      if (items.length) c += pieceCost(pieces[pi], items, Boolean(filler));
    });
    return c;
  };
  // Greedy start: biggest rooms first, each into the piece that costs least to add to.
  const greedy = (): number[] => {
    const w = seeds.map(() => -1);
    // Jitter is drawn once per seed, before sorting: a comparator that draws would consume a
    // different number of draws, in a different order, under each engine's sort algorithm.
    const order = seeds
      .map((sd, i) => ({ sd, i }))
      .filter(({ sd }) => sd.required || rng.chance(sd.prob))
      .map((p) => ({ ...p, k: p.sd.area + (rng.float() - 0.5) * 40 }))
      .sort((p, q) => q.k - p.k || p.i - q.i);
    for (const { i } of order) {
      let bestP = 0;
      let bestC = Infinity;
      for (let pi = 0; pi < pieces.length; pi++) {
        w[i] = pi;
        const c = partial(w) + rng.float() * 3;
        if (c < bestC) {
          bestC = c;
          bestP = pi;
        }
      }
      w[i] = bestP;
    }
    return w;
  };
  let best = Infinity;
  let bestWhere: number[] = [];
  const iters = 260 + 30 * n;
  for (let restart = 0; restart < 2 && best > 30; restart++) {
    const where = restart === 0 ? greedy() : seeds.map((sd) => (sd.required || rng.chance(sd.prob) ? rng.int(0, pieces.length - 1) : -1));
    let cur = total(where);
    if (cur < best) {
      best = cur;
      bestWhere = where.slice();
    }
    for (let k = 0; k < iters; k++) {
      const temp = 9 * (1 - k / iters) + 0.05;
      const next = where.slice();
      const move = rng.int(0, 2);
      if (move === 0 || n < 2) {
        const i = rng.int(0, n - 1);
        next[i] = rng.int(0, pieces.length - 1);
      } else if (move === 1) {
        const i = rng.int(0, n - 1);
        const j = rng.int(0, n - 1);
        if ((next[j] < 0 && seeds[i].required) || (next[i] < 0 && seeds[j].required)) continue;
        [next[i], next[j]] = [next[j], next[i]];
      } else {
        const i = rng.int(0, n - 1);
        if (seeds[i].required) continue;
        next[i] = next[i] >= 0 ? -1 : rng.int(0, pieces.length - 1);
      }
      const c = total(next);
      // Metropolis acceptance with exp(-d) replaced by 1 / (1 + d + d²/2 + d³/6): the same
      // shape (1 at d = 0, falling monotonically) from exact arithmetic alone.
      const d = (c - cur) / temp;
      if (c <= cur || rng.float() * (1 + d * (1 + d * (0.5 + d / 6))) < 1) {
        where.splice(0, n, ...next);
        cur = c;
        if (c < best) {
          best = c;
          bestWhere = next.slice();
        }
      }
    }
  }
  if (best > 45) return null;
  const out: Assignment[] = pieces.map((piece) => ({ piece, items: [] }));
  bestWhere.forEach((pi, i) => {
    if (pi >= 0) out[pi].items.push({ seed: seeds[i], area: seeds[i].area * jitter[i] });
  });
  if (filler) for (const a of out) if (a.items.length === 0) a.items.push({ seed: filler, area: rarea(a.piece.rect) });
  return out;
}

/** Lay one piece's rooms out in a row, each spanning the piece's full thickness. */
export function sliceRow(a: Assignment, rng: Rand): PlacedSeed[] | null {
  const { piece, items } = a;
  const { t, len } = pieceThickness(piece);
  const A = rarea(piece.rect);
  const sum = items.reduce((x, it) => x + itemArea(it), 0);
  const s = A / sum;
  const order = items
    .map((it) => ({ it, k: piece.rowAxis === 'y' ? it.seed.front + rng.range(-0.3, 0.3) : rng.float() }))
    .sort((p, q) => p.k - q.k)
    .map((p) => p.it);
  const slots = order.map((it) => {
    const sd = it.seed;
    return { weight: s * itemArea(it), min: Math.max(sd.ensuite ? 8 : sd.minW, (sd.minArea * 0.97) / t) };
  });
  const sizes = distribute(len, slots);
  if (!sizes) return null;
  const out: PlacedSeed[] = [];
  let pos = piece.rowAxis === 'y' ? piece.rect.y0 : piece.rect.x0;
  order.forEach((it, i) => {
    const r = piece.rowAxis === 'y' ? R(piece.rect.x0, pos, piece.rect.x1, pos + sizes[i]) : R(pos, piece.rect.y0, pos + sizes[i], piece.rect.y1);
    pos += sizes[i];
    out.push(carve(it, r, piece));
  });
  return out;
}

function carve(it: Item, r: Rect, piece: Piece): PlacedSeed {
  const ens = it.seed.ensuite;
  if (!ens) return { seed: it.seed, rect: r };
  // Carve the ensuite from the end of the room farthest from the strip.
  const horizontal = piece.stripEdge === 'e' || piece.stripEdge === 'w';
  const span = horizontal ? rw(r) : rh(r);
  const across = horizontal ? rh(r) : rw(r);
  const depth = Math.max(6, Math.min(span - 8, Math.round((ens.area / Math.max(across, 1)) / 0.5) * 0.5));
  if (depth < 6 || across < 6 || span - depth < 8) return { seed: it.seed, rect: r };
  const edge = piece.stripEdge ?? 'e';
  let main: Rect;
  let bath: Rect;
  if (edge === 'e') {
    main = R(r.x0 + depth, r.y0, r.x1, r.y1);
    bath = R(r.x0, r.y0, r.x0 + depth, r.y1);
  } else if (edge === 'w') {
    main = R(r.x0, r.y0, r.x1 - depth, r.y1);
    bath = R(r.x1 - depth, r.y0, r.x1, r.y1);
  } else if (edge === 's') {
    main = R(r.x0, r.y0 + depth, r.x1, r.y1);
    bath = R(r.x0, r.y0, r.x1, r.y0 + depth);
  } else {
    main = R(r.x0, r.y0, r.x1, r.y1 - depth);
    bath = R(r.x0, r.y1 - depth, r.x1, r.y1);
  }
  return { seed: it.seed, rect: main, ensuite: { seed: ens, rect: bath } };
}
