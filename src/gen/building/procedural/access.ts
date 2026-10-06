import type { LocationAccess, LocationDefinition } from '../../../sim/types';
import { pointInPoly, polyBBox, snap, vec } from './geom';
import type { Rand } from './rand';

// Access metadata for a unit inside a larger building (`_g2` and later). A wheelchair route from
// the unit to the street needs the unit on the ground floor or an elevator; stories read
// `location.access`, and players see the same facts as a map note and on the stairwell label.

/** American floor names by level (level 0 is the ground floor). */
const FLOOR_NAME = ['Ground', 'Second', 'Third', 'Fourth'] as const;
/** Chance the building has an elevator, by the unit's level: low-rise walk-ups are common, and
 * a building with a fourth-floor unit usually has one. */
const ELEVATOR_CHANCE = [0.35, 0.4, 0.55, 0.75] as const;

/** One draw: whether the building has an elevator. Ground-floor units are step-free; upper ones only with an elevator. */
export function drawUnitAccess(unitLevel: 0 | 1 | 2 | 3, rng: Rand): LocationAccess {
  const lift = rng.chance(ELEVATOR_CHANCE[unitLevel]);
  const stepFree = unitLevel === 0 || lift;
  const where = `${FLOOR_NAME[unitLevel]}-floor unit`;
  const note = unitLevel === 0 ? `${where}; step-free from the street` : lift ? `${where}; the building has an elevator` : `${where}; stairs only, no elevator`;
  return { unitLevel, lift, stepFree, note };
}

/** Attach `access`, mark the elevator on the stairwell zone (label and `lift` tag), and carry the
 * note on the common corridor (or the stairwell when the corridor has no clear spot). */
export function applyAccess(loc: LocationDefinition, access: LocationAccess): void {
  loc.access = access;
  const stair = loc.zones.find((z) => z.tags.includes('stairwell'));
  if (stair && access.lift) {
    stair.label = 'Stairs and elevator';
    stair.tags.push('lift');
  }
  for (const zone of [loc.zones.find((z) => z.tags.includes('corridor')), stair]) {
    if (!zone) continue;
    const bb = polyBBox(zone.polygon);
    const at = vec(snap((bb.x0 + bb.x1) / 2), snap((bb.y0 + bb.y1) / 2));
    if (!pointInPoly(at, zone.polygon)) continue;
    loc.notes.push({ id: 'n_access', text: access.note, at, decorative: true });
    return;
  }
}
