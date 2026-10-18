// Sightlines and vantage on the plan: which exterior zones look straight into a room, and whether
// someone across the street can see an opening of the building. World layer: pure geometry over
// the location's walls, openings and outdoor objects. Generation settles sightline facts from it
// (gen/incident/instance.ts); the engine prices what it finds.
import type { BuiltLocation, Id, LocationDefinition, Vec } from './types';
import { footprintRect } from './furniture-path';
import { segmentEntersRect } from './cover';

const mid = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** The exterior zones with an opening straight onto a room: where a squad can watch it from outside. */
export function vantageZones(location: LocationDefinition, spaceId: Id): Id[] {
  const zones = new Set(location.zones.map((z) => z.id));
  const out = new Set<Id>();
  for (const o of location.openings) {
    if (o.a === spaceId && zones.has(o.b)) out.add(o.b);
    if (o.b === spaceId && zones.has(o.a)) out.add(o.a);
  }
  return [...out];
}

/** Whether someone off the lot (across the street) can see an opening of the building, in plan:
 * the line from `from` to the opening's middle crosses no outdoor object that blocks sight (a
 * tree, a hedge) and no exterior wall of the ground floor. Heights are not modelled, so a low
 * object blocks like a tall one. `blockedBy` names what is in the way. */
export function sightToOpening(built: BuiltLocation, from: Vec, openingId: Id): { clear: boolean; blockedBy: string | null } {
  const opening = built.location.openings.find(entry => entry.id === openingId);
  if (!opening) throw new Error(`No opening ${openingId}`);
  const to = mid(opening.from, opening.to);
  const zones = new Set(built.location.zones.map(zone => zone.id));
  for (const object of built.location.objects) {
    if (!zones.has(object.in) || !object.tags.includes('blocks_sight')) continue;
    if (segmentEntersRect(from, to, footprintRect(object)) !== null) return { clear: false, blockedBy: object.type.replace(/_/g, ' ') };
  }
  // Stop a foot short of the opening: it sits in the wall the line ends on.
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const end = length > 1 ? { x: to.x - (to.x - from.x) / length, y: to.y - (to.y - from.y) / length } : from;
  const wall = built.location.footprint;
  for (let i = 0; i < wall.length; i++) if (segmentsCross(from, end, wall[i], wall[(i + 1) % wall.length])) return { clear: false, blockedBy: 'the building' };
  return { clear: true, blockedBy: null };
}

/** Where someone across the street watches from: a window `acrossFt` past the front edge of the
 * lot and `alongFt` along the street from the middle of the frontage, facing the lot straight on.
 * Standing back from a window, a person sees out of it only within `fieldDeg` either side of
 * straight ahead. */
export interface StreetVantage { acrossFt: number; alongFt: number; fieldDeg: number }

/** A street vantage on the plan, and the lot's front: the bounds edge nearest the arrival space
 * (`arrival`, where the team pulls up). The street runs along that edge. */
export function streetVantage(built: BuiltLocation, arrival: Id, vantage: StreetVantage): { at: Vec; front: 'N' | 'S' | 'W' | 'E' } {
  const pts = built.location.zones.find(zone => zone.id === arrival)?.polygon ?? built.location.footprint;
  const c = { x: pts.reduce((sum, p) => sum + p.x, 0) / pts.length, y: pts.reduce((sum, p) => sum + p.y, 0) / pts.length };
  const { w, h } = built.location.bounds;
  const { acrossFt: across, alongFt: along } = vantage;
  const edges = [
    { front: 'N' as const, gap: c.y, at: { x: w / 2 + along, y: -across } }, { front: 'S' as const, gap: h - c.y, at: { x: w / 2 + along, y: h + across } },
    { front: 'W' as const, gap: c.x, at: { x: -across, y: h / 2 + along } }, { front: 'E' as const, gap: w - c.x, at: { x: w + across, y: h / 2 + along } },
  ];
  const best = edges.reduce((a, b) => b.gap < a.gap ? b : a);
  return { at: best.at, front: best.front };
}

/** Whether someone across the street sees an opening of the building (sightToOpening), with the
 * street's other houses in the way: the lots either side are built like this one, so a line that
 * leaves the lot sideways at the depth of the house's front wall or deeper runs into the house
 * next door. */
export function sightFromStreet(built: BuiltLocation, arrival: Id, vantage: StreetVantage, openingId: Id): { clear: boolean; blockedBy: string | null } {
  const { at, front } = streetVantage(built, arrival, vantage);
  const opening = built.location.openings.find(entry => entry.id === openingId);
  if (!opening) throw new Error(`No opening ${openingId}`);
  const to = mid(opening.from, opening.to);
  const { w, h } = built.location.bounds;
  // Lot frame: depth in from the front edge, and position along the frontage.
  const frame = (p: Vec) => front === 'S' ? { depth: h - p.y, along: p.x } : front === 'N' ? { depth: p.y, along: p.x } : front === 'W' ? { depth: p.x, along: p.y } : { depth: w - p.x, along: p.y };
  const span = front === 'N' || front === 'S' ? w : h;
  const houseFront = Math.min(...built.location.footprint.map(p => frame(p).depth));
  const a = frame(to), b = frame(at);
  // The window faces the lot straight on: past its field of view the door is in the wall beside it.
  if (Math.atan2(Math.abs(a.along - b.along), a.depth - b.depth) * 180 / Math.PI > vantage.fieldDeg) return { clear: false, blockedBy: 'the window frame' };
  for (const side of [0, span]) {
    if ((a.along - side) * (b.along - side) >= 0) continue;
    const t = (side - a.along) / (b.along - a.along);
    if (a.depth + (b.depth - a.depth) * t >= houseFront) return { clear: false, blockedBy: 'the house next door' };
  }
  return sightToOpening(built, at, openingId);
}

/** Whether segments ab and cd cross (touching at an end counts). */
function segmentsCross(a: Vec, b: Vec, c: Vec, d: Vec): boolean {
  const side = (p: Vec, q: Vec, r: Vec) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b);
}
