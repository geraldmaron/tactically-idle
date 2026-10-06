import type { Opening, DoorMaterial, WallMaterial } from '../../../sim/types';
import type { Pair, Run } from './assemble';
import { type Rect, type Seg, type Vec, EPS, R, lerp, pointInPoly, segLen, snap, vec } from './geom';
import type { Rand } from './rand';
import type { PRoom, Policy } from './types';

// ------------------------------------------------------------------ door geometry

interface Placed {
  from: Vec;
  to: Vec;
  hinge: 'from' | 'to';
  box: Rect;
}

/** Axis-aligned bounding box of the quarter circle a door leaf sweeps (conservative square). */
export function swingBox(from: Vec, to: Vec, hinge: 'from' | 'to', into: Vec[]): Rect {
  const H = hinge === 'from' ? from : to;
  const F = hinge === 'from' ? to : from;
  const w = segLen({ a: from, b: to });
  const ux = (F.x - H.x) / w;
  const uy = (F.y - H.y) / w;
  let nx = -uy;
  let ny = ux;
  const m = lerp(from, to, 0.5);
  if (!pointInPoly(vec(m.x + nx * 0.3, m.y + ny * 0.3), into)) {
    nx = -nx;
    ny = -ny;
  }
  const xs = [H.x, F.x, H.x + nx * w, F.x + nx * w];
  const ys = [H.y, F.y, H.y + ny * w, F.y + ny * w];
  return R(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
}

const boxesOverlap = (a: Rect, b: Rect) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.05 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0.05;

/** Where on a wall a door of `width` can go: candidate offsets from the segment start. */
function offsets(len: number, width: number, margin: number, rng: Rand): number[] {
  const slack = len - width - 2 * margin;
  if (slack < -EPS) return [];
  const mid = margin + slack / 2;
  const out = [mid];
  for (let i = 0; i < 7; i++) out.push(margin + rng.float() * slack);
  return out;
}

function onSeg(seg: Seg, t: number, width: number, axisAligned: boolean): { from: Vec; to: Vec } {
  const len = segLen(seg);
  const t0 = axisAligned ? snap(t) : t;
  return { from: lerp(seg.a, seg.b, t0 / len), to: lerp(seg.a, seg.b, (t0 + width) / len) };
}

const isAxis = (s: Seg) => Math.abs(s.a.x - s.b.x) < EPS || Math.abs(s.a.y - s.b.y) < EPS;

/** Find a door position on `seg` whose swing into `intoPoly` clears `taken`. Null when none fits. */
export function placeDoor(seg: Seg, width: number, margin: number, intoPoly: Vec[], taken: Rect[], rng: Rand, swing: boolean, at?: number): Placed | null {
  const len = segLen(seg);
  const axis = isAxis(seg);
  for (const t of at !== undefined ? [at] : offsets(len, width, margin, rng)) {
    const p = onSeg(seg, t, width, axis);
    if (!swing) return { ...p, hinge: 'from', box: R(0, 0, 0, 0) };
    for (const hinge of rng.shuffle(['from', 'to'] as const)) {
      const box = swingBox(p.from, p.to, hinge, intoPoly);
      if (!taken.some((b) => boxesOverlap(b, box))) return { ...p, hinge, box };
    }
  }
  return null;
}

// ------------------------------------------------------------------ interior connectivity

export interface Edge {
  a: PRoom;
  b: PRoom;
  pair: Pair;
}

const pairKey = (a: PRoom, b: PRoom) => [a.seed.key, b.seed.key].sort().join('|');

function edgeWeight(a: PRoom, b: PRoom, policy: Policy): number | null {
  if (b.ensuiteOf === a.id || a.ensuiteOf === b.id) return 0.05;
  if (a.ensuiteOf || b.ensuiteOf) return null;
  const ca = a.seed.cls;
  const cb = b.seed.cls;
  const stair = a.seed.key === 'stair' || b.seed.key === 'stair';
  if (stair) return ca === 'circ' && cb === 'circ' ? 0.05 : null;
  const custom = policy.pairWeights?.[pairKey(a, b)];
  if (custom !== undefined) return custom;
  if (ca === 'leaf' && cb === 'leaf') return null;
  if (ca === 'circ' && cb === 'circ') return 0.3;
  if (ca === 'circ' || cb === 'circ') return ca === 'leaf' || cb === 'leaf' ? 1 : 1.5;
  if (ca === 'pub' && cb === 'pub') return 1.8;
  return 3.5;
}

/**
 * Spanning tree over room adjacency that never routes through a leaf room (except a bedroom
 * to its own ensuite), plus up to `loops` extra doors between through rooms. Null when some
 * room cannot be reached.
 */
export function connectRooms(rooms: PRoom[], pairs: Pair[], roots: string[], policy: Policy, rng: Rand, why?: (reason: string) => void): Edge[] | null {
  const byId = new Map(rooms.map((r) => [r.id, r]));
  const cands: (Edge & { w: number })[] = [];
  for (const p of pairs) {
    const a = byId.get(p.a);
    const b = byId.get(p.b);
    if (!a || !b || p.len < 3) continue;
    const w = edgeWeight(a, b, policy);
    if (w === null) continue;
    if (!p.segs.some((s) => segLen(s) >= 3.5)) continue;
    cands.push({ a, b, pair: p, w: w + rng.range(0, 0.4) });
  }
  const seen = new Set(roots.filter((r) => byId.has(r)));
  if (seen.size === 0) return null;
  const tree: Edge[] = [];
  const used = new Set<(typeof cands)[number]>();
  const relay = (from: PRoom, to: PRoom) => from.seed.cls !== 'leaf' || to.ensuiteOf === from.id;
  while (seen.size < rooms.length) {
    let best: (typeof cands)[number] | null = null;
    let toRoom: PRoom | null = null;
    for (const c of cands) {
      const aIn = seen.has(c.a.id);
      const bIn = seen.has(c.b.id);
      if (aIn === bIn) continue;
      const from = aIn ? c.a : c.b;
      const to = aIn ? c.b : c.a;
      if (!relay(from, to)) continue;
      if (!best || c.w < best.w) {
        best = c;
        toRoom = to;
      }
    }
    if (!best || !toRoom) {
      why?.(`unreached ${rooms.filter((r) => !seen.has(r.id)).map((r) => r.id).join(',')}`);
      return null;
    }
    seen.add(toRoom.id);
    used.add(best);
    tree.push({ a: best.a, b: best.b, pair: best.pair });
  }
  let extra = rng.int(0, policy.loops);
  for (const c of rng.shuffle(cands)) {
    if (extra <= 0) break;
    if (used.has(c)) continue;
    const ca = c.a.seed.cls;
    const cb = c.b.seed.cls;
    if (ca === 'leaf' || cb === 'leaf' || c.a.seed.key === 'stair' || c.b.seed.key === 'stair') continue;
    if (ca === 'circ' && cb === 'circ') continue;
    used.add(c);
    tree.push({ a: c.a, b: c.b, pair: c.pair });
    extra--;
  }
  return tree;
}

// ------------------------------------------------------------------ interior doors

const widthFor = (a: PRoom, b: PRoom, policy: Policy, rng: Rand): number => {
  const leafKey = [a, b].find((r) => r.seed.cls === 'leaf')?.seed.key ?? '';
  if (leafKey === 'bath' || leafKey === 'wc' || leafKey === 'storage' || leafKey === 'closet') return 2.5;
  return rng.snapped(policy.intDoor.width[0], policy.intDoor.width[1]);
};

export interface InteriorResult {
  openings: Opening[];
  /** Swing boxes by room id (for furniture clearance). */
  swings: Map<string, Rect[]>;
  overrides: { a: string; b: string; material: WallMaterial }[];
}

/** Turn tree edges into doors and cased openings on the longest shared stretch of wall. */
export function makeInteriorOpenings(edges: Edge[], policy: Policy, rng: Rand, floor: number, into: InteriorResult, why?: (reason: string) => void): boolean {
  for (const e of edges) {
    const rank = (r: PRoom) => (r.seed.cls === 'circ' ? 0 : r.seed.cls === 'pub' ? 1 : 2);
    const swap = rank(e.a) > rank(e.b) || (rank(e.a) === rank(e.b) && e.a.ensuiteOf !== undefined);
    const [a, b] = swap ? [e.b, e.a] : [e.a, e.b];
    const stairPair = a.seed.key === 'stair' || b.seed.key === 'stair';
    const openChance = policy.openPairs.find(([ka, kb]) => (ka === a.seed.key && kb === b.seed.key) || (ka === b.seed.key && kb === a.seed.key))?.[2] ?? 0;
    const wantDoorway = stairPair || (a.seed.cls !== 'leaf' && b.seed.cls !== 'leaf' && rng.chance(openChance));
    const baseWidth = stairPair ? 0 : widthFor(a, b, policy, rng);
    const segs = e.pair.segs.slice().sort((p, q) => segLen(q) - segLen(p));
    const into2 = b; // swing into the second room (leaf or the less central one)
    let placed: Placed | null = null;
    let usedWidth = baseWidth;
    let doorway = wantDoorway;
    // A cased opening needs 3 ft clear; where the shared wall is too short it becomes a door.
    for (const mode of wantDoorway && !stairPair ? [true, false] : [wantDoorway]) {
      doorway = mode;
      for (const seg of segs) {
        const len = segLen(seg);
        if (doorway) {
          usedWidth = stairPair ? Math.max(3, Math.min(len - 1, 4)) : snap(Math.min(len - 1, rng.snapped(3, 6)));
          if (usedWidth < 3 || len < usedWidth + 1) continue;
        } else {
          usedWidth = Math.min(baseWidth, snap(len - 1));
          if (usedWidth < 2.5) continue;
        }
        const taken = into.swings.get(into2.id) ?? [];
        // A stair opens at its foot from the ground hall and at its head onto the landing.
        let at: number | undefined;
        if (stairPair) {
          const bHigh = seg.b.x + seg.b.y > seg.a.x + seg.a.y;
          const wantHigh = floor === 0;
          at = bHigh === wantHigh ? len - usedWidth - 0.5 : 0.5;
        }
        placed = placeDoor(seg, usedWidth, 0.5, into2.poly, taken, rng, !doorway, at);
        if (placed) break;
      }
      if (placed) break;
    }
    if (!placed) {
      why?.(`door_fail ${a.seed.key}-${b.seed.key} len ${segs.map((q) => segLen(q)).join('/')} w ${usedWidth}`);
      return false;
    }
    const glass = policy.glass?.some((k) => k === a.seed.key || k === b.seed.key) && a.seed.cls === 'pub';
    const steel = policy.steelDoors?.some((k) => k === a.seed.key || k === b.seed.key);
    const material: DoorMaterial = glass ? 'glass' : steel ? 'steel' : policy.intDoor.material;
    const id = `${doorway ? 'dw' : 'd'}_${a.id}_${b.id}`;
    const o: Opening = {
      id,
      type: doorway ? 'doorway' : 'door',
      a: a.id,
      b: b.id,
      from: placed.from,
      to: placed.to,
      state: doorway ? 'open' : a.seed.cls === 'pub' && b.seed.cls === 'pub' && rng.chance(0.25) ? 'open' : 'closed',
      ...(doorway ? {} : { swing: { hinge: placed.hinge, into: into2.id }, material }),
      ...(floor > 0 ? { floor } : {}),
    };
    into.openings.push(o);
    if (!doorway) into.swings.set(into2.id, [...(into.swings.get(into2.id) ?? []), placed.box]);
    if (glass && b.seed.cls === 'leaf') into.overrides.push({ a: a.id, b: b.id, material: 'glass_partition' });
  }
  return true;
}

// ------------------------------------------------------------------ exterior doors

export interface PendingExterior {
  id: string;
  room: string;
  from: Vec;
  to: Vec;
  hinge: 'from' | 'to';
  normal: Vec;
  type: 'door' | 'sliding';
  material: DoorMaterial;
  state: 'closed' | 'locked';
  kind: string;
  floor: number;
}

function pickMaterial(rng: Rand, table: [DoorMaterial, number][]): DoorMaterial {
  return rng.weighted(table);
}

/** Choose 1 to 3 exterior doors on rooms the family allows, front first. */
export function chooseExterior(
  rooms: PRoom[],
  runs: Run[],
  policy: Policy,
  rng: Rand,
  swings: Map<string, Rect[]>,
  frontSides: ('s' | 'd' | 'e' | 'w' | 'n')[],
  backSides: Run['side'][] = ['n', 'e', 'w'],
): PendingExterior[] | null {
  const byId = new Map(rooms.map((r) => [r.id, r]));
  const out: PendingExterior[] = [];
  const keyOf = (id: string) => byId.get(id)?.seed.key ?? '';
  const weightOf = (table: [string, number][], id: string) => table.find(([k]) => k === keyOf(id))?.[1] ?? 0;
  const make = (kind: string, table: [string, number][], sides: Run['side'][], dp: Policy['frontDoor'] | Policy['backDoor'], exclude: Set<string>, spare = 0): boolean => {
    const cands = runs.filter((r) => r.floor === 0 && sides.includes(r.side) && weightOf(table, r.room) > 0 && !exclude.has(r.room) && r.len >= dp.width[0] + 1.5 + spare + (kind === 'balcony' ? 6 : 0));
    if (cands.length === 0) return false;
    for (let attempt = 0; attempt < 6; attempt++) {
      const run = rng.weighted(cands.map((c) => [c, weightOf(table, c.room) * c.len] as const));
      const room = byId.get(run.room) as PRoom;
      const sliding = 'sliding' in dp && dp.sliding === true;
      const width = rng.snapped(dp.width[0], dp.width[1]);
      if (run.len < width + 1.5 + spare) continue;
      const taken = swings.get(room.id) ?? [];
      // A balcony door hugs one end of the wall so the room keeps a window.
      const at = kind === 'balcony' ? (rng.chance(0.5) ? 0.75 : run.len - width - 0.75) : undefined;
      const placed = placeDoor(run.seg, width, 0.75, room.poly, taken, rng, !sliding, at);
      if (!placed) continue;
      // Keep clear of doors already cut into the same room's wall.
      const pm = lerp(placed.from, placed.to, 0.5);
      if (out.some((o) => o.room === room.id && Math.hypot(lerp(o.from, o.to, 0.5).x - pm.x, lerp(o.from, o.to, 0.5).y - pm.y) < (Math.hypot(o.to.x - o.from.x, o.to.y - o.from.y) + width) / 2 + 1.5)) continue;
      const material = pickMaterial(rng, dp.material);
      out.push({
        id: kind === 'front' ? 'd_front' : `d_${kind}`,
        room: room.id,
        from: placed.from,
        to: placed.to,
        hinge: placed.hinge,
        normal: run.normal,
        type: sliding ? 'sliding' : 'door',
        material,
        state: 'state' in dp && dp.state ? dp.state : 'closed',
        kind,
        floor: 0,
      });
      if (!sliding) swings.set(room.id, [...taken, placed.box]);
      return true;
    }
    return false;
  };
  if (!make('front', policy.frontRooms, frontSides, policy.frontDoor, new Set())) return null;
  if (rng.chance(policy.backChance)) make('back', policy.backRooms, backSides, policy.backDoor, new Set([out[0].room]));
  for (const pr of policy.perRoom ?? []) {
    for (const room of rooms.filter((r) => r.seed.key === pr.key)) {
      const cands = runs.filter((r) => r.room === room.id && r.floor === 0 && pr.sides.includes(r.side as 'n' | 's' | 'e' | 'w') && r.len >= pr.door.width[0] + 3);
      if (cands.length === 0) return null;
      const run = rng.weighted(cands.map((c) => [c, c.len] as const));
      const width = rng.snapped(pr.door.width[0], pr.door.width[1]);
      const taken = swings.get(room.id) ?? [];
      // The door sits toward one end of the wall so the room keeps room for a window beside it.
      const placed = placeDoor(run.seg, width, 1, room.poly, taken, rng, true, rng.chance(0.5) ? 1 : run.len - width - 1);
      if (!placed) return null;
      out.push({ id: `d_${room.id}`, room: room.id, from: placed.from, to: placed.to, hinge: placed.hinge, normal: run.normal, type: 'door', material: pickMaterial(rng, pr.door.material), state: 'closed', kind: `unit_${room.id}`, floor: 0 });
      swings.set(room.id, [...taken, placed.box]);
    }
  }
  if (policy.balcony && rng.chance(policy.balcony.chance)) make('balcony', policy.balcony.rooms, ['s'], { material: [['glass', 1]], width: policy.balcony.width, sliding: true }, new Set());
  for (const x of policy.extraDoors ?? []) if (rng.chance(x.chance)) make(x.kind, x.rooms, x.sides, x.door, new Set(), x.spare ?? 0);
  if (policy.sideChance > 0 && rng.chance(policy.sideChance)) make('side', policy.backRooms, backSides, policy.backDoor, new Set(out.map((o) => o.room)));
  return out;
}
