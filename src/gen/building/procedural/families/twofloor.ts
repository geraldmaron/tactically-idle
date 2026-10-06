import type { Rect } from '../geom';
import { R, rh, rw } from '../geom';
import { type Piece, planStrip } from '../strips';
import { RoomMaker, extentAlong, layoutPieces, stepEdges } from '../partition';
import type { Rand } from '../rand';
import { CLOSET, seed } from '../programme';
import type { PRoom, RoomSeed } from '../types';

export const STAIR = seed('stair', 'stair', { area: 70, min: 40, max: 130, minW: 6, aspect: 2.6, cls: 'circ', tags: ['stairs', 'circulation'], windows: 'none', kit: 'stair', label: 'Stairs' });
export const LANDING = seed('landing', 'hall', { area: 40, min: 12, max: 160, minW: 3.5, aspect: 99, cls: 'circ', tags: ['circulation', 'narrow'], windows: 'small', kit: 'landing', label: 'Landing' });
export const FOYER = seed('hall', 'hall', { area: 40, min: 12, max: 160, minW: 3.5, aspect: 99, cls: 'circ', tags: ['circulation', 'narrow'], windows: 'none', kit: 'hall', label: 'Hall' });

export interface TwoFloorOpts {
  /** Ground and upper floor rectangles (lot coordinates); the upper floor lies inside the ground floor. */
  rects0: Rect[];
  rects1: Rect[];
  ground: RoomSeed[];
  upper: RoomSeed[];
  hw: [number, number];
  /** Smallest side-piece thickness and cap thickness. */
  minSide: number;
  minCap: number;
  noWindow?: ('n' | 's' | 'e' | 'w')[];
  /** Chance a floor's hall stops short of the end wall, leaving a cap room across the width. */
  capChance: number;
  /** Ground hall and upper landing keys. */
  keys?: { hall: RoomSeed; landing: RoomSeed };
  /** Stair block flush with the front end, hall strips reaching the front (a shop's flat). */
  stairFront?: boolean;
  /** Which side of the strip the stair block sits (default random). */
  stairLo?: boolean;
  /** Room maker to share with the caller so temporary ids stay unique. */
  maker?: RoomMaker;
}

const rectAlong = (axis: 'v' | 'h', cross: [number, number], a0: number, a1: number): Rect => (axis === 'v' ? R(cross[0], a0, cross[1], a1) : R(a0, cross[0], a1, cross[1]));

/** Margin test: a block may touch an extent end or keep at least 8 ft from it. */
const marginOk = (e: [number, number], a0: number, a1: number, m = 8) => (a0 - e[0] < 1e-9 || a0 - e[0] >= m - 1e-9) && (e[1] - a1 < 1e-9 || e[1] - a1 >= m - 1e-9);

/**
 * Rooms for a two-floor dwelling around one stair. One hall strip keeps the same cross range
 * on both floors and the stair room (a 7 to 9.5 ft wide switchback block) sits beside it,
 * the same rectangle on both floors, so the ground hall and the upstairs landing both run
 * along its long edge. Each floor's hall may stop short of an end wall, leaving a cap room.
 */
export function planTwoFloors(rng: Rand, o: TwoFloorOpts, why?: (reason: string) => void): PRoom[] | null {
  const all = [...o.rects0, ...o.rects1];
  const bx0 = Math.min(...all.map((r) => r.x0));
  const bx1 = Math.max(...all.map((r) => r.x1));
  const by0 = Math.min(...all.map((r) => r.y0));
  const by1 = Math.max(...all.map((r) => r.y1));
  const keys = o.keys ?? { hall: FOYER, landing: LANDING };
  for (let tries = 0; tries < 40; tries++) {
    const axis: 'v' | 'h' = by1 - by0 >= bx1 - bx0 + 4 && rng.chance(0.85) ? 'v' : bx1 - bx0 >= by1 - by0 + 6 && rng.chance(0.6) ? 'h' : 'v';
    const hw = rng.snapped(o.hw[0], o.hw[1]);
    const q0 = axis === 'v' ? bx0 : by0;
    const q1 = axis === 'v' ? bx1 : by1;
    const tsMax = Math.min(9.5, q1 - q0 - hw - o.minSide);
    if (tsMax < 7) {
      why?.('tf_cross');
      continue;
    }
    const ts = rng.snapped(7, tsMax);
    const stairLo = o.stairLo ?? rng.chance(0.5);
    // Stair block and strip are adjacent; the other side piece takes the rest.
    const stairCross: [number, number] = stairLo ? [q0, q0 + ts] : [q1 - ts, q1];
    const cross: [number, number] = stairLo ? [q0 + ts, q0 + ts + hw] : [q1 - ts - hw, q1 - ts];
    const span: [number, number] = [Math.min(stairCross[0], cross[0]), Math.max(stairCross[1], cross[1])];
    const e0 = extentAlong(o.rects0, axis, span[0], span[1]);
    const e1 = extentAlong(o.rects1, axis, span[0], span[1]);
    if (!e0 || !e1) {
      why?.('tf_extent');
      continue;
    }
    const sl = rng.snapped(9, 10.5);
    const lo = Math.max(e0[0], e1[0]);
    const hi = Math.min(e0[1], e1[1]) - sl;
    if (hi < lo) {
      why?.('tf_stair_fit');
      continue;
    }
    const spots: number[] = [];
    for (let y = Math.ceil(lo / 0.5) * 0.5; y <= hi + 1e-9; y += 0.5) {
      if (o.stairFront && Math.abs(y + sl - Math.min(e0[1], e1[1])) > 1e-9) continue;
      if (marginOk(e0, y, y + sl) && marginOk(e1, y, y + sl)) spots.push(y);
    }
    if (spots.length === 0) {
      why?.('tf_stair_margin');
      continue;
    }
    const sy0 = rng.pick(spots);
    const sy1 = sy0 + sl;
    const S = rectAlong(axis, stairCross, sy0, sy1);
    const alongFor = (e: [number, number], rects: Rect[]): [number, number] | null => {
      let a0 = e[0];
      let a1 = e[1];
      const steps = stepEdges(rects, axis, e[0], e[1]);
      // Where the outline steps (a narrower wing), the hall stops and the wing becomes a cap room.
      const hiSteps = steps.filter((v) => v >= sy1 && e[1] - v >= o.minCap);
      const loSteps = steps.filter((v) => v <= sy0 && v - e[0] >= o.minCap);
      if (o.stairFront) a1 = e[1];
      else if (hiSteps.length && rng.chance(0.75)) a1 = rng.pick(hiSteps);
      else if (rng.chance(o.capChance) && e[1] - sy1 >= o.minCap) a1 = rng.snapped(Math.max(sy1, e[0] + 12), e[1] - o.minCap);
      if (loSteps.length && rng.chance(0.75)) a0 = rng.pick(loSteps);
      else if (rng.chance(o.capChance) && sy0 - e[0] >= o.minCap) a0 = rng.snapped(e[0] + o.minCap, Math.min(sy0, e[1] - 12));
      // No sliver of side piece between the stair block and a cap.
      if (a0 < sy0 && sy0 - a0 < 8) a0 = sy0 - e[0] >= o.minCap ? sy0 : e[0];
      if (a1 > sy1 && a1 - sy1 < 8) a1 = e[1] - sy1 >= o.minCap ? sy1 : e[1];
      if (a0 > sy0 || a1 < sy1 || a1 - a0 < 12) return null;
      return [a0, a1];
    };
    const g = alongFor(e0, o.rects0);
    const u = alongFor(e1, o.rects1);
    if (!g || !u) {
      why?.('tf_along');
      continue;
    }
    const minPiece = Math.min(o.minSide, o.minCap) - 0.01;
    const ground = planStrip(o.rects0, { axis, cross, along: g }, minPiece, { noWindow: o.noWindow, reserved: [S] });
    const upper = planStrip(o.rects1, { axis, cross, along: u }, minPiece, { exposure: o.rects0, noWindow: o.noWindow, reserved: [S] });
    if (!ground || !upper) {
      why?.(ground ? 'tf_upper_strip' : 'tf_ground_strip');
      continue;
    }
    if (!pieceSizesOk(ground.pieces, o) || !pieceSizesOk(upper.pieces, o)) {
      why?.('tf_pieces');
      continue;
    }
    const maker = o.maker ?? new RoomMaker();
    const gr = layoutPieces(rng, maker, ground, o.ground, 0, [], CLOSET);
    if (!gr) {
      why?.('tf_ground_rooms');
      continue;
    }
    const ur = layoutPieces(rng, maker, upper, o.upper, 1, [], CLOSET);
    if (!ur) {
      why?.('tf_upper_rooms');
      continue;
    }
    return [...gr, ...ur, maker.make(STAIR, S, 0), maker.make(keys.hall, ground.strip, 0), maker.make(STAIR, S, 1), maker.make(keys.landing, upper.strip, 1)];
  }
  return null;
}

function pieceSizesOk(pieces: Piece[], o: TwoFloorOpts): boolean {
  if (pieces.length > 7) return false;
  return pieces.every((p) => Math.min(rw(p.rect), rh(p.rect)) >= (p.kind === 'cap' ? o.minCap : o.minSide) - 1e-9 || p.kind === 'iso');
}
