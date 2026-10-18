// Cover between a person and a point: which furniture shields someone from the door a team comes
// through. World layer: pure geometry over the placed furniture. Generation reads it
// (gen/incident/instance.ts) and bakes the result into issued calls; the engine only prices the
// grade it finds (incident-factors.ts, SPATIAL_TUNING.coverHard and coverConcealment).
import type { BuiltLocation, Id, PlacedObject, Vec } from './types';
import { footprintRect } from './furniture-path';

/** Cover counts only near the person: within this share of the line from them to the door. A
 * generation-time constant, kept out of the tuning registry like LOCATION_TUNING: changing it
 * changes the content, so change it here and recapture the call fingerprints. */
export const COVER_REACH = 0.6;

/** What a piece of furniture does for someone behind it. Game abstraction: hard cover stops the
 * team reaching them cleanly, concealment only hides them. Unlisted furniture does neither. */
const COVER_GRADE: Partial<Record<PlacedObject['type'], 'hard' | 'concealment'>> = {
  counter: 'hard', fridge: 'hard', stove: 'hard', tub: 'hard', dresser: 'hard', wardrobe: 'hard',
  sofa: 'concealment', bed: 'concealment', desk: 'concealment', shelf: 'concealment', dining_table: 'concealment', armchair: 'concealment', vanity: 'concealment', register: 'concealment',
};

/** The best furniture between a person and a point (the door the team enters by), in their own
 * room and near them: hard cover first, then concealment, nearest first. */
export function coverOnLine(built: BuiltLocation, spaceId: Id, from: Vec, to: Vec): { object: PlacedObject; grade: 'hard' | 'concealment' } | null {
  let best: { object: PlacedObject; grade: 'hard' | 'concealment'; t: number } | null = null;
  for (const object of built.location.objects) {
    const grade = COVER_GRADE[object.type];
    if (!grade || object.in !== spaceId) continue;
    const t = segmentEntersRect(from, to, footprintRect(object));
    if (t === null || t > COVER_REACH) continue;
    if (!best || (grade === 'hard' && best.grade !== 'hard') || (grade === best.grade && t < best.t)) best = { object, grade, t };
  }
  return best && { object: best.object, grade: best.grade };
}

/** Where along a segment (0 at `a`, 1 at `b`) it first enters an axis-aligned rectangle, or null. */
export function segmentEntersRect(a: Vec, b: Vec, r: { x: number; y: number; w: number; h: number }): number | null {
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  for (const [p, q] of [[-dx, a.x - r.x], [dx, r.x + r.w - a.x], [-dy, a.y - r.y], [dy, r.y + r.h - a.y]] as const) {
    if (p === 0) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return t0;
}
