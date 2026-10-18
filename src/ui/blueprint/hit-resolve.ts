// Tap tolerance for rooms drawn smaller than a finger. A room under 44px on screen is hard to hit
// on a 320px map, so a tap on one asks which nearby room was meant. A tap inside a room big enough
// to hit is always that room: tolerance never takes a tap away from a room the finger is inside.
import type { Id, Vec } from '../../sim/types';
import { bboxOf, distToPolygonEdges, pointInPolygon } from './geometry';

/** Smallest comfortable touch target, px. */
export const MIN_TARGET_PX = 44;
/** Half a target: rooms whose outline is this close to the tap are candidates. */
export const TAP_RADIUS_PX = MIN_TARGET_PX / 2;
const MAX_CHOICES = 5;

export interface HitSpace {
  id: Id;
  poly: Vec[];
  zone: boolean;
}

export type TapResult = { kind: 'select'; id: Id } | { kind: 'choose'; ids: Id[] };

/** Short side of the space's bounding box as drawn, px. */
export function shortSidePx(poly: Vec[], pxPerUnit: number): number {
  const b = bboxOf(poly);
  return Math.min(b.w, b.h) * pxPerUnit;
}

/**
 * What a tap on `tappedId` at world point `at` means. Exterior zones and rooms drawn at least
 * MIN_TARGET_PX on their short side select directly. A smaller room offers itself and every other
 * room within TAP_RADIUS_PX of the tap, the tapped room first, then nearest first.
 */
export function resolveTap(tappedId: Id, at: Vec, spaces: HitSpace[], pxPerUnit: number): TapResult {
  const tapped = spaces.find((s) => s.id === tappedId);
  if (!tapped || tapped.zone || !(pxPerUnit > 0) || shortSidePx(tapped.poly, pxPerUnit) >= MIN_TARGET_PX) return { kind: 'select', id: tappedId };
  const radius = TAP_RADIUS_PX / pxPerUnit;
  const near = spaces
    .filter((s) => !s.zone && s.id !== tappedId)
    .map((s) => ({ id: s.id, d: pointInPolygon(at, s.poly) ? 0 : distToPolygonEdges(at, s.poly) }))
    .filter((s) => s.d <= radius)
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_CHOICES - 1)
    .map((s) => s.id);
  return near.length ? { kind: 'choose', ids: [tappedId, ...near] } : { kind: 'select', id: tappedId };
}
