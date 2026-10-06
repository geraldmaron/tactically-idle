import type { LocationDefinition, Opening, PlacedObject, Polygon, Room, Vec } from '../../sim/types';
import { hashSeed } from '../../sim/rng';
import { findRoomPath, footprintRect } from '../../sim/furniture-path';
import { FURNITURE_V7, type FurnishingTypeV7, type ObjectDefinition } from './furnishing-definitions-v7';

type Side = NonNullable<PlacedObject['placement']>['back'];
interface Rect { x: number; y: number; w: number; h: number }
interface Wall { from: Vec; to: Vec; back: Side; inset: number }
interface Candidate { object: PlacedObject; access: Rect | null }
const ROT = { N: 0, E: 90, S: 180, W: 270 } as const;
const FRONT: Record<Side, Vec> = { N: { x: 0, y: 1 }, E: { x: -1, y: 0 }, S: { x: 0, y: -1 }, W: { x: 1, y: 0 } };
const OPPOSITE: Record<Side, Side> = { N: 'S', S: 'N', E: 'W', W: 'E' };
export const FURNISHING_V7_SUFFIX = '__furnished_v7';
export const furnishedFamilyIdV7 = (familyId: string): string => familyId.endsWith(FURNISHING_V7_SUFFIX) ? familyId : `${familyId}${FURNISHING_V7_SUFFIX}`;
export const baseFamilyIdV7 = (familyId: string): string => familyId.endsWith(FURNISHING_V7_SUFFIX) ? familyId.slice(0, -FURNISHING_V7_SUFFIX.length) : familyId;

const round = (x: number) => Math.round(x * 1000) / 1000;
const centre = (r: Rect): Vec => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const box = (points: readonly Vec[]): Rect => {
  const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
  return { x, y, w: Math.max(...points.map(p => p.x)) - x, h: Math.max(...points.map(p => p.y)) - y };
};
const corners = (r: Rect): Vec[] => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
const inflate = (r: Rect, n: number): Rect => ({ x: r.x - n, y: r.y - n, w: r.w + n * 2, h: r.h + n * 2 });
export function furnitureOverlaps(a: Rect, b: Rect, margin = 0): boolean {
  return a.x < b.x + b.w + margin - 1e-6 && a.x + a.w > b.x - margin + 1e-6
    && a.y < b.y + b.h + margin - 1e-6 && a.y + a.h > b.y - margin + 1e-6;
}
function inside(p: Vec, polygon: Polygon): boolean {
  let yes = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) yes = !yes;
  }
  return yes;
}
/** Whole-rectangle containment, including concave notches between the corners.
 * The v7 catalog uses orthogonal walls; crossing any wall through its interior
 * rejects the rectangle, rather than accepting four apparently inside corners. */
export function furnitureInsideRoom(rect: Rect, room: Room): boolean {
  if (!corners(rect).every(p => inside(p, room.polygon))) return false;
  for (let i = 0; i < room.polygon.length; i++) {
    const a = room.polygon[i], b = room.polygon[(i + 1) % room.polygon.length];
    if (a.x === b.x && a.x > rect.x && a.x < rect.x + rect.w
      && Math.max(a.y, b.y) > rect.y && Math.min(a.y, b.y) < rect.y + rect.h) return false;
    if (a.y === b.y && a.y > rect.y && a.y < rect.y + rect.h
      && Math.max(a.x, b.x) > rect.x && Math.min(a.x, b.x) < rect.x + rect.w) return false;
  }
  return true;
}
function walls(loc: LocationDefinition, room: Room): Wall[] {
  return room.polygon.flatMap((from, i) => {
    const to = room.polygon[(i + 1) % room.polygon.length];
    if (from.x !== to.x && from.y !== to.y) return [];
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const horizontal = from.y === to.y;
    const back: Side = horizontal ? (inside({ x: mid.x, y: mid.y + 0.1 }, room.polygon) ? 'N' : 'S')
      : (inside({ x: mid.x + 0.1, y: mid.y }, room.polygon) ? 'W' : 'E');
    // Conservatively use the thicker wall where a partition meets the exterior.
    return [{ from, to, back, inset: Math.max(loc.wallThickness.exterior, loc.wallThickness.interior) / 2 + 0.12 }];
  });
}
function objectAt(type: FurnishingTypeV7, room: Room, at: Vec, back: Side, anchor: 'wall' | 'group', group?: string, width?: number): PlacedObject {
  const d = FURNITURE_V7[type];
  const w = width ?? d.width;
  return { id: '', type, in: room.id, x: round(at.x - w / 2), y: round(at.y - d.depth / 2), w, h: d.depth,
    rotation: ROT[back], placement: { back, anchor, ...(group ? { group } : {}) }, mechanical: true, tags: [...d.tags] };
}
export function furnitureAccessRect(object: PlacedObject): Rect | null {
  const definition: ObjectDefinition | undefined = FURNITURE_V7[object.type as FurnishingTypeV7];
  if (!definition?.access || !object.placement) return null;
  const r = footprintRect(object), depth = definition.access, back = object.placement.back;
  if (back === 'N') return { x: r.x, y: r.y + r.h, w: r.w, h: depth };
  if (back === 'S') return { x: r.x, y: r.y - depth, w: r.w, h: depth };
  if (back === 'W') return { x: r.x + r.w, y: r.y, w: depth, h: r.h };
  return { x: r.x - depth, y: r.y, w: depth, h: r.h };
}
function candidate(object: PlacedObject): Candidate { return { object, access: furnitureAccessRect(object) }; }
function inward(room: Room, o: Opening): Vec {
  const m = { x: (o.from.x + o.to.x) / 2, y: (o.from.y + o.to.y) / 2 };
  const n = o.from.x === o.to.x ? { x: 1, y: 0 } : { x: 0, y: 1 };
  return inside({ x: m.x + n.x * 0.1, y: m.y + n.y * 0.1 }, room.polygon) ? n : { x: -n.x, y: -n.y };
}
export function furnishingDoorApproaches(loc: LocationDefinition, room: Room): Vec[] {
  return loc.openings.filter(o => (o.a === room.id || o.b === room.id) && o.type !== 'window').map(o => {
    if (o.type === 'stair') return o.a === room.id ? o.from : o.to;
    const n = inward(room, o);
    return { x: (o.from.x + o.to.x) / 2 + n.x * 1.5, y: (o.from.y + o.to.y) / 2 + n.y * 1.5 };
  });
}
export function furnishingOpeningClearances(loc: LocationDefinition, room: Room): Rect[] {
  return loc.openings.filter(o => o.a === room.id || o.b === room.id).map(o => {
    if (o.type === 'stair') { const p = o.a === room.id ? o.from : o.to; return { x: p.x - 1.5, y: p.y - 1.5, w: 3, h: 3 }; }
    const n = inward(room, o), width = Math.hypot(o.from.x - o.to.x, o.from.y - o.to.y);
    const depth = o.type === 'window' ? 0.65 : Math.max(3, o.swing?.into === room.id ? width : 0);
    const b = box([o.from, o.to, { x: o.from.x + n.x * depth, y: o.from.y + n.y * depth }, { x: o.to.x + n.x * depth, y: o.to.y + n.y * depth }]);
    return inflate(b, o.type === 'window' ? 0.05 : 0.3);
  });
}
function centroid(room: Room): Vec {
  let area = 0, x = 0, y = 0;
  for (let i = 0; i < room.polygon.length; i++) {
    const a = room.polygon[i], b = room.polygon[(i + 1) % room.polygon.length], cross = a.x * b.y - b.x * a.y;
    area += cross; x += (a.x + b.x) * cross; y += (a.y + b.y) * cross;
  }
  return { x: x / (3 * area), y: y / (3 * area) };
}
class RoomPlan {
  readonly placed: Candidate[] = [];
  readonly keepClear: Rect[];
  readonly wallList: Wall[];
  readonly routeClearance: number;
  constructor(readonly loc: LocationDefinition, readonly room: Room) {
    // Rescue stories originate in living rooms. Preserve a three-foot interior
    // envelope there; narrow door leaves still reject a chair at route time.
    this.routeClearance = room.type === 'living' ? 1.5 : 1;
    this.keepClear = furnishingOpeningClearances(loc, room);
    const c = centroid(room);
    const radius = this.routeClearance + 0.02;
    if (inside(c, room.polygon)) this.keepClear.push({ x: c.x - radius, y: c.y - radius, w: radius * 2, h: radius * 2 });
    this.wallList = walls(loc, room);
  }
  valid(items: Candidate[]): boolean {
    const all = [...this.placed, ...items];
    return items.every(item => {
      const r = footprintRect(item.object);
      return furnitureInsideRoom(inflate(r, 0.08), this.room)
        && !this.keepClear.some(clear => furnitureOverlaps(r, clear))
        && (!item.access || furnitureInsideRoom(item.access, this.room))
        && all.every(other => item === other || (!furnitureOverlaps(r, footprintRect(other.object), 0.15)
          && (!other.access || !furnitureOverlaps(r, other.access))
          && (!item.access || !furnitureOverlaps(item.access, footprintRect(other.object)))));
    });
  }
  accept(items: Candidate[]): boolean {
    if (!this.valid(items)) return false;
    const objects = [...this.placed, ...items].map(c => c.object);
    const anchors = furnishingDoorApproaches(this.loc, this.room);
    const c = centroid(this.room);
    if (inside(c, this.room.polygon)) anchors.push(c);
    if (anchors.length > 1 && anchors.slice(1).some(to => !findRoomPath(this.room, objects, anchors[0], to, this.routeClearance))) return false;
    for (const item of items) {
      item.object.id = `v7_${this.room.id}_${item.object.type}_${this.placed.filter(p => p.object.type === item.object.type).length + 1}`;
      this.placed.push(item);
    }
    return true;
  }
  wallCandidates(type: FurnishingTypeV7, group?: string, width?: number): Candidate[] {
    const d = FURNITURE_V7[type], list: Candidate[] = [];
    const objectWidth = width ?? d.width;
    for (const wall of this.wallList) {
      const horizontal = wall.from.y === wall.to.y;
      const min = Math.min(horizontal ? wall.from.x : wall.from.y, horizontal ? wall.to.x : wall.to.y) + 0.5 + objectWidth / 2;
      const max = Math.max(horizontal ? wall.from.x : wall.from.y, horizontal ? wall.to.x : wall.to.y) - 0.5 - objectWidth / 2;
      const offsets: number[] = [];
      for (let offset = min; offset <= max + 1e-6; offset += 0.5) offsets.push(offset);
      // Always try both ends. A fractional fixture width can otherwise miss a
      // perfectly usable corner by less than the half-foot candidate interval.
      if (max >= min && !offsets.some(offset => Math.abs(offset - max) < 1e-6)) offsets.push(max);
      // Door/window approaches need not lie on the sampling grid. Their actual
      // ends (and the ends of placed bodies/service fronts) are useful exact
      // anchors, especially for a full bath in a compact eight-foot room.
      const limits = [...this.keepClear, ...this.placed.flatMap(p => [inflate(footprintRect(p.object), 0.15), ...(p.access ? [p.access] : [])])];
      for (const limit of limits) {
        const start = horizontal ? limit.x : limit.y, length = horizontal ? limit.w : limit.h;
        for (const offset of [start - objectWidth / 2, start + length + objectWidth / 2])
          if (offset >= min - 1e-6 && offset <= max + 1e-6 && !offsets.some(n => Math.abs(n - offset) < 1e-6)) offsets.push(offset);
      }
      for (const offset of offsets) {
        const n = FRONT[wall.back], distance = wall.inset + d.depth / 2;
        const p = horizontal ? { x: offset, y: wall.from.y + n.y * distance } : { x: wall.from.x + n.x * distance, y: offset };
        const c = candidate(objectAt(type, this.room, p, wall.back, 'wall', group, objectWidth));
        if (this.valid([c])) list.push(c);
      }
    }
    // A separate stable hash per room/object keeps variation independent of
    // iteration in the incident RNG and of React render timing.
    return list.sort((a, b) => this.rank(a.object) - this.rank(b.object));
  }
  rank(o: PlacedObject): number { return hashSeed(`furnishing:7:${this.loc.familyId}:${this.loc.seed}:${o.in}:${o.type}:${o.x}:${o.y}:${o.rotation}`); }
  addWall(type: FurnishingTypeV7): boolean {
    for (const width of type === 'bed' ? [5.5, 4, 3.5] : [undefined]) {
      if (this.wallCandidates(type, undefined, width).some(c => this.accept([c]))) return true;
    }
    return false;
  }
  living(): void {
    const group = `${this.room.id}_seating`;
    const sofas = this.wallCandidates('sofa', group);
    for (const withTV of [true, false]) for (const sofa of sofas) {
      const at = centre(footprintRect(sofa.object)), back = sofa.object.placement!.back, n = FRONT[back];
      const coffeeAt = { x: at.x + n.x * 4, y: at.y + n.y * 4 }; // 1.5 ft knee/leg gap.
      const table = candidate(objectAt('coffee_table', this.room, coffeeAt, back, 'group', group));
      if (!this.valid([sofa, table])) continue;
      if (!withTV) { if (this.accept([sofa, table])) return; continue; }
      const televisions = this.wallCandidates('tv', group).filter(tv => {
        const t = centre(footprintRect(tv.object)), dx = t.x - at.x, dy = t.y - at.y;
        return tv.object.placement!.back === OPPOSITE[back] && Math.abs(n.x ? dy : dx) < 0.26
          && dx * n.x + dy * n.y >= 7;
      });
      for (const tv of televisions) if (this.accept([sofa, table, tv])) return;
    }
    // A small living room can still have a useful sofa without forcing a table
    // or screen across its access route.
    this.addWall('sofa');
  }
  dining(): void {
    const bounds = box(this.room.polygon), group = `${this.room.id}_dining`;
    const candidates: Candidate[][] = [];
    for (const back of ['N', 'E'] as const) for (let x = bounds.x + 4; x < bounds.x + bounds.w - 3; x += 1)
      for (let y = bounds.y + 4; y < bounds.y + bounds.h - 3; y += 1) {
        const table = candidate(objectAt('dining_table', this.room, { x, y }, back, 'group', group));
        const n = FRONT[back], offset = FURNITURE_V7.dining_table.depth / 2 + 0.4 + FURNITURE_V7.chair.depth / 2;
        const chairs = [-1, 1].map(sign => candidate(objectAt('chair', this.room, { x: x + n.x * offset * sign, y: y + n.y * offset * sign }, sign < 0 ? back : OPPOSITE[back], 'group', group)));
        // In addition to the tucked-in chair gap, reserve 2 ft behind each chair.
        for (const chair of chairs) {
          const r = footprintRect(chair.object), b = chair.object.placement!.back;
          chair.access = b === 'N' ? { x: r.x, y: r.y - 2, w: r.w, h: 2 } : b === 'S' ? { x: r.x, y: r.y + r.h, w: r.w, h: 2 }
            : b === 'W' ? { x: r.x - 2, y: r.y, w: 2, h: r.h } : { x: r.x + r.w, y: r.y, w: 2, h: r.h };
        }
        if (this.valid([table, ...chairs])) candidates.push([table, ...chairs]);
      }
    candidates.sort((a, b) => this.rank(a[0].object) - this.rank(b[0].object)).some(group => this.accept(group));
  }
  bathroom(): void {
    // These authored homes have a full bathroom, not a half-bath. Solve the
    // major bathing fixture first; a convenient basin must not silently remove
    // the home's only bath. Backtracking is bounded by real wall candidates.
    const start = this.placed.length;
    for (const tub of this.wallCandidates('tub')) {
      if (!this.accept([tub])) continue;
      for (const toilet of this.wallCandidates('toilet')) {
        if (!this.accept([toilet])) continue;
        if (this.addWall('vanity')) return;
        this.placed.length = start + 1;
      }
      this.placed.length = start;
    }
    // An unsupported custom room still fails safely without overlapping bodies.
    this.addWall('toilet'); this.addWall('vanity');
  }
  furnish(): PlacedObject[] {
    switch (this.room.type) {
      case 'living': this.living(); if (/dining/i.test(this.room.label)) this.dining(); this.addWall('shelf'); break;
      case 'bedroom': this.addWall('bed'); this.addWall('wardrobe'); if (this.loc.seed % 3 === 0) this.addWall('dresser'); break;
      case 'bathroom': this.bathroom(); break;
      case 'kitchen': this.addWall('sink'); this.addWall('stove'); this.addWall('fridge'); this.addWall('counter'); this.dining(); break;
      case 'office': this.addWall('desk'); this.addWall('shelf'); break;
      case 'retail': this.addWall('register'); this.addWall('counter'); this.addWall('shelf'); this.addWall('shelf'); break;
      case 'storage': this.addWall('shelf'); this.addWall('shelf'); this.addWall('shelf'); break;
      case 'utility': this.addWall('sink'); this.addWall('shelf'); break;
      // Halls and stairs are circulation, not spare furniture slots.
      default: break;
    }
    return this.placed.map(c => c.object);
  }
}

/** Apply only after seeded architectural variations, under a new saved family
 * key. Original families, objects, seed choices and incident history are intact. */
export function furnishLocationV7(base: LocationDefinition): LocationDefinition {
  const loc = structuredClone(base);
  loc.id = furnishedFamilyIdV7(base.id); loc.version = 7;
  const roomIds = new Set(loc.rooms.map(room => room.id));
  loc.objects = [...loc.objects.filter(object => !roomIds.has(object.in)), ...loc.rooms.flatMap(room => new RoomPlan(loc, room).furnish())];
  return loc;
}

/** A diagnostic validator for the physical plan, stronger than the legacy
 * location validator: no overlaps, solid-wall clearance, opening approaches,
 * service fronts and real obstacle-aware connections within every room. */
export function validateFurnishingsV7(loc: LocationDefinition): string[] {
  const errors: string[] = [];
  for (const room of loc.rooms) {
    const objects = loc.objects.filter(o => o.in === room.id), clearances = furnishingOpeningClearances(loc, room);
    for (const [i, object] of objects.entries()) {
      const rect = footprintRect(object);
      if (!furnitureInsideRoom(inflate(rect, 0.08), room)) errors.push(`${object.id}: outside usable room`);
      if (clearances.some(c => furnitureOverlaps(rect, c))) errors.push(`${object.id}: opening approach obstructed`);
      if (!object.placement) errors.push(`${object.id}: missing placement`);
      if (object.placement && object.rotation !== ROT[object.placement.back]) errors.push(`${object.id}: symbol orientation differs from footprint`);
      if (object.placement?.anchor === 'wall') {
        const back = object.placement.back;
        const anchored = walls(loc, room).some(wall => {
          if (wall.back !== back) return false;
          const horizontal = back === 'N' || back === 'S';
          const rear = back === 'N' ? rect.y : back === 'S' ? rect.y + rect.h : back === 'W' ? rect.x : rect.x + rect.w;
          const line = horizontal ? wall.from.y : wall.from.x;
          const start = horizontal ? rect.x : rect.y, end = start + (horizontal ? rect.w : rect.h);
          const lo = Math.min(horizontal ? wall.from.x : wall.from.y, horizontal ? wall.to.x : wall.to.y);
          const hi = Math.max(horizontal ? wall.from.x : wall.from.y, horizontal ? wall.to.x : wall.to.y);
          return Math.abs(Math.abs(rear - line) - wall.inset) < 0.002 && start >= lo && end <= hi;
        });
        if (!anchored) errors.push(`${object.id}: back is not anchored to its real wall`);
      }
      const access = furnitureAccessRect(object);
      if (access && (!furnitureInsideRoom(access, room) || objects.some(o => o !== object && furnitureOverlaps(access, footprintRect(o))))) errors.push(`${object.id}: access blocked`);
      for (const other of objects.slice(i + 1)) if (furnitureOverlaps(rect, footprintRect(other), 0.14)) errors.push(`${object.id}: overlaps ${other.id}`);
    }
    const approaches = furnishingDoorApproaches(loc, room);
    const c = centroid(room); if (inside(c, room.polygon)) approaches.push(c);
    for (const target of approaches.slice(1)) if (!findRoomPath(room, objects, approaches[0], target, room.type === 'living' ? 1.5 : 1)) errors.push(`${room.id}: no clear interior route`);
  }
  return errors;
}
