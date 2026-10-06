import type { LocationDefinition, PlacedObject, Room, StagingPoint, Vec } from '../../sim/types';
import { hashSeed } from '../../sim/rng';
import { deriveStagingPoints } from '../../sim/location';
import { findRoomPath, footprintRect, roomSegmentClear } from '../../sim/furniture-path';
import {
  accessRectAt, box, centroid, centre, FRONT, furnishedFamilyIdV7, furnishingDoorApproaches, furnitureInsideRoom, inflate, inside, OPPOSITE,
  RoomPlan, validateFurnishings, type Candidate, type FurnishingCatalog, type Rect, type Side,
} from './furnishing-v7';
import { FURNITURE_G1, type FurnishingKeyG1 } from './furnishing-definitions-g1';

/** Furnishing for generated `_g1` buildings: v7's solver (wall anchoring, service fronts,
 * opening and swing clearances, obstacle-aware routes between every approach) with a catalog and
 * kits for every room the generator makes. Its output is part of the `_g1` content identity, so
 * the same rules as procedural/README.md apply: change it only as a new generation. */
export const CATALOG_G1: FurnishingCatalog = { defs: FURNITURE_G1, idPrefix: 'g1', rankSalt: 'furnishing:g1' };

export type RoomKindG1 =
  | 'bedroom' | 'guest_unit' | 'bath' | 'ensuite' | 'wc' | 'living' | 'dining' | 'breakfast' | 'kitchen' | 'commercial_kitchen'
  | 'kitchenette' | 'staff' | 'utility' | 'laundry' | 'storage' | 'stockroom' | 'cold_store' | 'server' | 'warehouse_floor'
  | 'shop' | 'bar' | 'reception' | 'motel_office' | 'back_office' | 'open_office' | 'meeting' | 'study' | 'circulation';

const stem = (id: string) => id.replace(/_\d+$/, '');

/** What a generated room is for, from its id stem (the generator's seed key), type and tags. */
export function roomKindG1(loc: LocationDefinition, room: Room): RoomKindG1 {
  const k = stem(room.id), has = (t: string) => room.tags.includes(t), motel = loc.familyId.startsWith('motel_row');
  switch (room.type) {
    case 'hall': case 'stair': return 'circulation';
    case 'bedroom': return k === 'unit' ? 'guest_unit' : 'bedroom';
    case 'bathroom': return has('wc') ? 'wc' : has('ensuite') ? 'ensuite' : 'bath';
    case 'living': return k === 'dining' || has('dining') ? (has('customer') ? 'breakfast' : 'dining') : 'living';
    case 'kitchen': return k === 'kitchenette' || k === 'break_room' ? 'kitchenette' : has('hazard') && has('staff') ? 'commercial_kitchen' : 'kitchen';
    case 'utility': return k === 'break_room' || k === 'locker_room' ? 'staff' : has('laundry') ? 'laundry' : 'utility';
    case 'retail': return has('bar') ? 'bar' : 'shop';
    case 'storage': return k === 'floor' || has('warehouse') ? 'warehouse_floor' : k === 'cold_store' || has('cold') ? 'cold_store'
      : k === 'server' || has('server') ? 'server' : k === 'stockroom' || has('stock') ? 'stockroom' : 'storage';
    case 'office':
      if (k === 'reception') return motel ? 'motel_office' : 'reception';
      if (k === 'open_office') return 'open_office';
      if (k === 'meeting') return 'meeting';
      if (k === 'backoffice' || k === 'manager') return 'back_office';
      return 'study';
  }
}

interface Span { x0: number; y0: number; x1: number; y1: number }
const span = (room: Room): Span => {
  const b = box(room.polygon);
  return { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h };
};
const sideOf = (horizontalRows: boolean, front: 1 | -1): Side => horizontalRows ? (front > 0 ? 'N' : 'S') : (front > 0 ? 'W' : 'E');
/** The strip `depth` feet deep behind a placed object's back (room to pull a chair out). */
function behind(object: PlacedObject, depth: number): Rect {
  const r = footprintRect(object), back = object.placement!.back;
  if (back === 'N') return { x: r.x, y: r.y - depth, w: r.w, h: depth };
  if (back === 'S') return { x: r.x, y: r.y + r.h, w: r.w, h: depth };
  if (back === 'W') return { x: r.x - depth, y: r.y, w: depth, h: r.h };
  return { x: r.x + r.w, y: r.y, w: depth, h: r.h };
}
const area = (room: Room): number => {
  let a = 0;
  for (let i = 0; i < room.polygon.length; i++) { const p = room.polygon[i], q = room.polygon[(i + 1) % room.polygon.length]; a += p.x * q.y - q.x * p.y; }
  return Math.abs(a) / 2;
};
const dist2 = (a: Vec, b: Vec) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);

/** Staging points derived from the plan; a squad stands on them, so they stay clear and connected. */
type Approaches = Map<string, StagingPoint[]>;
function approachesOf(loc: LocationDefinition): Approaches {
  const map: Approaches = new Map();
  for (const point of deriveStagingPoints(loc)) (map.get(point.spaceId) ?? map.set(point.spaceId, []).get(point.spaceId)!).push(point);
  return map;
}
/** Staging points in a room beyond the usual door approaches (stair ends sit in unfurnished stair rooms). */
function extraApproaches(approaches: Approaches, room: Room, doors: readonly Vec[], windows: boolean): StagingPoint[] {
  return (approaches.get(room.id) ?? []).filter(p => p.kind !== 'stair' && (windows || p.kind !== 'window') && !doors.some(d => dist2(d, p.at) < 1e-6));
}

class G1Plan extends RoomPlan {
  readonly kind: RoomKindG1;
  readonly size: number;
  readonly anchors: Vec[];
  /** Last proven route from anchors[0] to each other anchor; new pieces only add obstacles, so a
   * route that misses every new piece is still a route and needs no new search. */
  private readonly routes = new Map<number, Vec[]>();
  /** Half the thickest wall: freestanding pieces stop at the wall face, not its centerline. */
  readonly half: number;
  constructor(loc: LocationDefinition, room: Room, approaches: Approaches, windows: boolean) {
    super(loc, room, CATALOG_G1);
    this.kind = roomKindG1(loc, room);
    this.size = area(room);
    this.half = Math.max(loc.wallThickness.exterior, loc.wallThickness.interior) / 2;
    const doors = furnishingDoorApproaches(loc, room);
    // Every staging point a squad can be sent to inside the room (door points that a narrow room
    // pulled closer than the usual approach, and window points when the room's kit still fits)
    // stays clear and joined to the doors.
    for (const point of extraApproaches(approaches, room, doors, windows)) {
      const r = this.routeClearance + 0.02;
      this.keepClear.push({ x: point.at.x - r, y: point.at.y - r, w: r * 2, h: r * 2 });
      this.extraAnchors.push(point.at);
    }
    const c = centroid(room);
    this.anchors = [...doors, ...(inside(c, room.polygon) ? [c] : []), ...this.extraAnchors];
  }
  override valid(items: Candidate[]): boolean {
    return super.valid(items) && items.every(item => item.object.placement?.anchor !== 'group'
      || (furnitureInsideRoom(inflate(footprintRect(item.object), this.half + 0.08), this.room)
        && (!item.access || furnitureInsideRoom(inflate(item.access, this.half), this.room))));
  }
  override accept(items: Candidate[]): boolean {
    if (!this.valid(items)) return false;
    const objects = [...this.placed, ...items].map(c => c.object), fresh = items.map(c => c.object), found = new Map<number, Vec[]>();
    for (let i = 1; i < this.anchors.length; i++) {
      const known = this.routes.get(i);
      if (known && known.slice(1).every((p, j) => roomSegmentClear(this.room, fresh, known[j], p, this.routeClearance))) continue;
      const path = findRoomPath(this.room, objects, this.anchors[0], this.anchors[i], this.routeClearance);
      if (!path) return false;
      found.set(i, path);
    }
    for (const [i, path] of found) this.routes.set(i, path);
    for (const item of items) {
      item.object.id = `${this.catalog.idPrefix}_${this.room.id}_${item.key}_${this.placed.filter(p => p.key === item.key).length + 1}`;
      this.placed.push(item);
    }
    return true;
  }
  /** Deterministic per-room choice in [0, n). */
  pick(n: number, salt: string): number { return hashSeed(`${this.catalog.rankSalt}:${this.loc.familyId}:${this.loc.seed}:${this.room.id}:${salt}`) % n; }
  count(key: FurnishingKeyG1): number { return this.placed.filter(p => p.key === key).length; }
  /** Wall pieces, `n` of them, each a fresh solve. */
  walls(key: FurnishingKeyG1, n: number, widths?: readonly (number | undefined)[]): number {
    let placed = 0;
    for (let i = 0; i < n && this.addWall(key, widths); i++) placed++;
    return placed;
  }
  /** Wall candidates for `key`, nearest `to` first (hash order breaks ties). */
  near(key: FurnishingKeyG1, to: Vec, width?: number): Candidate[] {
    return this.wallCandidates(key, undefined, width).map(c => ({ c, d: dist2(centre(footprintRect(c.object)), to) })).sort((a, b) => a.d - b.d).map(x => x.c);
  }
  exteriorDoor(): Vec | null {
    const zones = new Set(this.loc.zones.map(z => z.id));
    const o = this.loc.openings.find(q => q.type !== 'window' && (q.a === this.room.id || q.b === this.room.id) && (zones.has(q.a) || zones.has(q.b)));
    return o ? { x: (o.from.x + o.to.x) / 2, y: (o.from.y + o.to.y) / 2 } : null;
  }
  /** A chair `gap` in front of `object`, facing it, with room behind it to pull it out. */
  seatBefore(object: PlacedObject, key: FurnishingKeyG1 = 'chair', offset = 0, gap = 0.3, pullOut = 1.5): Candidate {
    const r = footprintRect(object), back = object.placement!.back, n = FRONT[back], d = this.def(key);
    const depth = (back === 'N' || back === 'S' ? r.h : r.w) / 2 + gap + d.depth / 2, along = back === 'N' || back === 'S' ? { x: 1, y: 0 } : { x: 0, y: 1 };
    const c = centre(r), at = { x: c.x + n.x * depth + along.x * offset, y: c.y + n.y * depth + along.y * offset };
    const seat = this.candidate(key, at, OPPOSITE[back], 'group', object.placement!.group);
    if (pullOut) seat.access = behind(seat.object, pullOut);
    return seat;
  }
  /** A desk against a wall with its chair. */
  deskGroup(key: FurnishingKeyG1): boolean {
    const group = `${this.room.id}_desk_${this.count(key) + 1}`;
    return this.wallCandidates(key, group).some(desk => { const chair = this.seatBefore(desk.object); return this.accept([desk, chair]); });
  }
  /** A table with chairs on its long sides (`perSide` each) and optionally the ends, anywhere in
   * the room; each chair keeps `pull` feet behind it to be pulled out. */
  tableGroup(key: FurnishingKeyG1, perSide: number, ends: boolean, width?: number, depth?: number, pull = 1.5, max = 1): number {
    const d = this.def(key), w = width ?? d.width, h = depth ?? d.depth, s = span(this.room), lists: Candidate[][] = [];
    for (const back of ['N', 'E'] as const) {
      const wide = back === 'N', rx = (wide ? w : h) / 2 + 0.5, ry = (wide ? h : w) / 2 + 0.5;
      for (let x = s.x0 + rx; x <= s.x1 - rx + 1e-6; x += 1) for (let y = s.y0 + ry; y <= s.y1 - ry + 1e-6; y += 1) {
        const group = `${this.room.id}_table_${this.count(key) + 1}`;
        const table = this.candidate(key, { x, y }, back, 'group', group, w, h);
        const seats: Candidate[] = [];
        for (let i = 0; i < perSide; i++) {
          const offset = (i - (perSide - 1) / 2) * (w / perSide);
          seats.push(this.seatBefore(table.object, 'chair', offset, 0.3, pull));
          seats.push(this.seatBefore({ ...table.object, placement: { ...table.object.placement!, back: OPPOSITE[back] } }, 'chair', offset, 0.3, pull));
        }
        if (ends) for (const side of wide ? ['W', 'E'] as const : ['N', 'S'] as const) {
          const n = FRONT[side], o = w / 2 + 0.3 + 0.75;
          const seat = this.candidate('chair', { x: x - n.x * o, y: y - n.y * o }, side, 'group', group);
          if (pull) seat.access = behind(seat.object, pull);
          seats.push(seat);
        }
        const all = [table, ...seats];
        if (this.valid(all)) lists.push(all);
      }
    }
    lists.sort((a, b) => this.rank(a[0].object, a[0].key) - this.rank(b[0].object, b[0].key));
    let placed = 0;
    for (const list of lists) {
      if (placed >= max) break;
      // Ids and groups were drawn before earlier tables landed; renumber the group.
      const group = `${this.room.id}_table_${this.count(key) + 1}`;
      for (const c of list) c.object.placement = { ...c.object.placement!, group };
      if (this.accept(list)) placed++;
    }
    return placed;
  }
  /**
   * Parallel runs of `key` along the room's long axis, `aisle` apart, `margin` from the ends.
   * Each run is one object (one obstacle for routing) cut wherever a door approach, a service
   * front or a reserved point is in the way, and at most `maxRun` long with a cross aisle between.
   */
  rows(key: FurnishingKeyG1, opts: { aisle: number; margin: number; edge: number; maxRows: number; maxRun: number; minRun: number }): number {
    const d = this.def(key), s = span(this.room), horizontal = s.x1 - s.x0 >= s.y1 - s.y0;
    const along0 = (horizontal ? s.x0 : s.y0) + opts.margin, along1 = (horizontal ? s.x1 : s.y1) - opts.margin;
    const across0 = (horizontal ? s.y0 : s.x0) + opts.edge, across1 = (horizontal ? s.y1 : s.x1) - opts.edge;
    const pitch = d.depth + opts.aisle, n = Math.min(opts.maxRows, Math.floor((across1 - across0 + opts.aisle) / pitch));
    if (n <= 0 || along1 - along0 < opts.minRun) return 0;
    const start = across0 + (across1 - across0 - (n * pitch - opts.aisle)) / 2;
    const cell = 1;
    let placed = 0;
    for (let row = 0; row < n; row++) {
      const mid = Math.round((start + row * pitch + d.depth / 2) * 2) / 2;
      const back = sideOf(horizontal, row % 2 === 0 ? 1 : -1);
      const at = (t: number, len: number): Vec => horizontal ? { x: t + len / 2, y: mid } : { x: mid, y: t + len / 2 };
      // Free cells, then maximal runs of them.
      const free: boolean[] = [];
      for (let t = along0; t + cell <= along1 + 1e-6; t += cell) free.push(this.valid([this.candidate(key, at(t, cell), back, 'group', undefined, cell)]));
      const runs: [number, number][] = [];
      for (let i = 0; i < free.length; i++) {
        if (!free[i]) continue;
        let j = i;
        while (j + 1 < free.length && free[j + 1]) j++;
        // Long runs split with a four-foot cross aisle.
        for (let a = i; a <= j; a += opts.maxRun + 4) runs.push([a, Math.min(j, a + opts.maxRun - 1)]);
        i = j;
      }
      for (const [a, b] of runs) {
        const queue: [number, number][] = [[a, b]];
        for (let guard = 0; queue.length && guard < 6; guard++) {
          const [p, q] = queue.shift()!, len = (q - p + 1) * cell;
          if (len < opts.minRun) continue;
          const c = this.candidate(key, at(along0 + p * cell, len), back, 'group', `${this.room.id}_rows`, len);
          if (this.accept([c])) { placed++; continue; }
          // Blocked a route: try the two halves with a gap between them.
          const m = Math.floor((p + q) / 2);
          queue.push([p, m - 2], [m + 2, q]);
        }
      }
    }
    return placed;
  }
  /** Freestanding groups on a lattice (bar tables, pallets, desk pods), nearest the room centre first. */
  lattice(make: (at: Vec, back: Side) => Candidate[], pitch: { along: number; across: number }, reach: { along: number; across: number }, max: number): number {
    const s = span(this.room), horizontal = s.x1 - s.x0 >= s.y1 - s.y0, back: Side = horizontal ? 'N' : 'E';
    const [pa, pc] = [pitch.along, pitch.across];
    const a0 = (horizontal ? s.x0 : s.y0) + reach.along, a1 = (horizontal ? s.x1 : s.y1) - reach.along;
    const c0 = (horizontal ? s.y0 : s.x0) + reach.across, c1 = (horizontal ? s.y1 : s.x1) - reach.across;
    if (a1 < a0 || c1 < c0) return 0;
    const na = Math.floor((a1 - a0) / pa), nc = Math.floor((c1 - c0) / pc);
    const oa = a0 + ((a1 - a0) - na * pa) / 2, oc = c0 + ((c1 - c0) - nc * pc) / 2;
    const spots: Vec[] = [];
    for (let i = 0; i <= na; i++) for (let j = 0; j <= nc; j++) {
      const a = Math.round((oa + i * pa) * 2) / 2, c = Math.round((oc + j * pc) * 2) / 2;
      if (a > a1 + 1e-6 || c > c1 + 1e-6) continue;
      spots.push(horizontal ? { x: a, y: c } : { x: c, y: a });
    }
    const mid = { x: (s.x0 + s.x1) / 2, y: (s.y0 + s.y1) / 2 };
    spots.sort((p, q) => dist2(p, mid) - dist2(q, mid) || p.x - q.x || p.y - q.y);
    let placed = 0;
    for (const p of spots) {
      if (placed >= max) break;
      if (this.accept(make(p, back))) placed++;
    }
    return placed;
  }
  /** A small table and two chairs facing across it. */
  cafe(at: Vec, back: Side): Candidate[] {
    const group = `${this.room.id}_cafe_${this.count('cafe_table') + 1}`;
    const table = this.candidate('cafe_table', at, back, 'group', group);
    const flip = { ...table.object, placement: { ...table.object.placement!, back: OPPOSITE[back] } };
    return [table, this.seatBefore(table.object, 'chair', 0, 0.3, 1), this.seatBefore(flip, 'chair', 0, 0.3, 1)];
  }
  /** Main bath: bathing fixture first (as v7), then toilet, then basin; bounded backtracking. */
  bath(order: readonly FurnishingKeyG1[]): void {
    const start = this.placed.length;
    for (const fixture of order) {
      for (const tub of this.wallCandidates(fixture)) {
        if (!this.accept([tub])) continue;
        for (const toilet of this.wallCandidates('toilet')) {
          if (!this.accept([toilet])) continue;
          if (this.addWall('vanity') || this.addWall('basin')) return;
          this.placed.length = start + 1;
        }
        this.placed.length = start;
      }
    }
    // Too tight for a bathing fixture: it still has a toilet and a basin.
    this.wc();
  }
  wc(): void {
    this.addWall('toilet');
    if (this.size < 30 || !this.addWall('vanity')) this.addWall('basin');
  }
  bed(): boolean {
    return this.addWall('bed', [5.5, 5, 4.5]) || this.addWall('twin_bed');
  }
  nightstands(): void {
    const bed = this.placed.find(p => p.key === 'bed' || p.key === 'twin_bed');
    if (!bed) return;
    const r = footprintRect(bed.object), back = bed.object.placement!.back, horizontal = back === 'N' || back === 'S', d = this.def('nightstand');
    const rear = back === 'N' ? r.y : back === 'S' ? r.y + r.h : back === 'W' ? r.x : r.x + r.w, n = FRONT[back];
    const half = (horizontal ? r.w : r.h) / 2 + 0.2 + d.width / 2, c = centre(r);
    for (const sign of [-1, 1]) {
      const at = horizontal ? { x: c.x + sign * half, y: rear + n.y * d.depth / 2 } : { x: rear + n.x * d.depth / 2, y: c.y + sign * half };
      this.accept([this.candidate('nightstand', at, back, 'wall')]);
    }
  }
  bar(): void {
    const group = `${this.room.id}_bar`, door = this.exteriorDoor();
    const shelfDepth = this.def('back_bar').depth, counterDepth = this.def('bar_counter').depth, aisle = 3;
    // Back bar on a wall away from the street door, the counter an aisle in front of it, stools on
    // the customer side. The counter stops three feet short of one end: the staff gap.
    for (const width of [16, 14, 12, 10, 8]) {
      let shelves = this.wallCandidates('back_bar', group, width);
      if (door) shelves = shelves.map(c => ({ c, d: -dist2(centre(footprintRect(c.object)), door) })).sort((a, b) => a.d - b.d).map(x => x.c);
      for (const shelf of shelves) {
        const r = footprintRect(shelf.object), back = shelf.object.placement!.back, n = FRONT[back], c = centre(r);
        const horizontal = back === 'N' || back === 'S', len = width - 3;
        for (const end of [1, -1]) {
          const shift = end * 1.5, out = shelfDepth / 2 + aisle + counterDepth / 2;
          const at = horizontal ? { x: c.x + shift, y: c.y + n.y * out } : { x: c.x + n.x * out, y: c.y + shift };
          const counter = this.candidate('bar_counter', at, back, 'group', group, len);
          counter.access = null;
          const stools: Candidate[] = [];
          const count = Math.floor(len / 2.25);
          // Customers stand behind the stools: each keeps two feet behind it.
          for (let i = 0; i < count; i++) stools.push(this.seatBefore(counter.object, 'stool', (i - (count - 1) / 2) * 2.25, 0.25, 2));
          if (this.accept([shelf, counter, ...stools])) return;
        }
      }
    }
    this.addWall('bar_counter', [10, 8, 6]);
  }
  booths(n: number): number {
    let placed = 0;
    for (let k = 0; k < n; k++) {
      const group = `${this.room.id}_booth_${this.count('booth') + 1}`;
      const ok = this.wallCandidates('booth', group).some(bench => {
        // The table sits against the bench seat; two chairs face it from the room side.
        const at = this.seatBefore(bench.object, 'cafe_table', 0, 0.2, 0);
        const table = this.candidate('dining_table', centre(footprintRect(at.object)), bench.object.placement!.back, 'group', group, 4, 2.5);
        const chairs = [-1, 1].map(s => this.seatBefore(table.object, 'chair', s, 0.3, 1.5));
        return this.accept([bench, table, ...chairs]);
      });
      if (!ok) break;
      placed++;
    }
    return placed;
  }
  furnish(): PlacedObject[] {
    const big = this.size;
    switch (this.kind) {
      case 'circulation': break;
      case 'bedroom':
        this.bed(); this.nightstands(); this.addWall('wardrobe');
        this.addWall(stem(this.room.id) === 'bedroom' && this.room.id.endsWith('_1') ? 'jewelry_dresser' : 'dresser');
        if (big >= 140 && this.pick(3, 'desk') === 0) this.deskGroup('desk');
        if (big >= 120 && this.pick(2, 'chair')) this.addWall('armchair');
        break;
      case 'guest_unit':
        this.bed(); if (big >= 150 && this.pick(2, 'beds')) this.bed();
        this.nightstands(); this.addWall('dresser'); this.addWall('tv'); this.deskGroup('desk'); this.addWall('armchair');
        break;
      case 'bath': this.bath(['tub', 'shower']); break;
      case 'ensuite': this.bath(['shower', 'tub']); break;
      case 'wc': this.wc(); break;
      case 'living':
        this.living(); this.addWall('armchair'); this.addWall('bookcase');
        if (big >= 220) this.addWall('armchair');
        break;
      case 'dining':
        // Six seats, four, then a two-seat table with the chairs tucked in.
        if (!this.tableGroup('dining_table', 3, false, 6, 3) && !this.tableGroup('dining_table', 2, false, 4.5, 3) && !this.tableGroup('dining_table', 1, false))
          this.tableGroup('dining_table', 1, false, 4, 2.5, 0);
        this.addWall('bookcase');
        break;
      case 'breakfast':
        if (!this.lattice((at, back) => this.cafe(at, back), { along: 7, across: 7 }, { along: 2.5, across: 3 }, 8)) this.tableGroup('cafe_table', 1, false, undefined, undefined, 0, 3);
        this.addWall('counter'); this.addWall('fridge');
        break;
      case 'kitchen':
        this.addWall('sink'); this.addWall('stove'); this.addWall('fridge'); this.walls('counter', 2);
        if (big >= 110 && !this.tableGroup('dining_table', 2, false, 4, 2.5)) this.tableGroup('dining_table', 1, false);
        break;
      case 'commercial_kitchen':
        this.walls('range', big >= 260 ? 2 : 1); this.addWall('prep_sink'); this.walls('reach_in', big >= 200 ? 2 : 1); this.addWall('prep_counter');
        this.rows('prep_table', { aisle: 3.5, margin: 3.5, edge: 5, maxRows: 2, maxRun: 8, minRun: 4 });
        this.addWall('cold_shelf');
        break;
      case 'kitchenette':
        this.addWall('sink'); this.addWall('fridge'); this.addWall('counter'); this.addWall('stove');
        if (!this.tableGroup('dining_table', 2, false, 4, 2.5)) this.tableGroup('cafe_table', 1, false);
        break;
      case 'staff':
        this.walls('lockers', big >= 90 ? 2 : 1);
        if (!this.tableGroup('dining_table', 2, false, 4, 2.5) && !this.tableGroup('cafe_table', 1, false)) this.tableGroup('cafe_table', 1, false, undefined, undefined, 0);
        this.addWall('loveseat');
        break;
      case 'laundry': this.walls('washer', 2); this.walls('dryer', 2); this.addWall('utility_sink'); this.addWall('storage_shelf'); break;
      case 'utility': this.addWall('washer'); this.addWall('dryer'); this.addWall('water_heater'); this.addWall('utility_sink'); this.addWall('storage_shelf'); break;
      case 'storage':
        if (/tool/i.test(this.room.label)) { this.addWall('workbench'); this.addWall('safe'); }
        this.walls('storage_shelf', big >= 60 ? 4 : big >= 35 ? 3 : 2);
        break;
      case 'stockroom':
        this.walls('wall_shelf', 4);
        this.rows('gondola', { aisle: 3.5, margin: 3, edge: 4.5, maxRows: 3, maxRun: 12, minRun: 4 });
        this.walls('wall_shelf', 2);
        break;
      case 'cold_store': this.walls('cold_shelf', 4); break;
      case 'server': this.walls('server_rack', 4); this.addWall('filing'); break;
      case 'warehouse_floor':
        this.addWall('workbench'); this.walls('wall_rack', 6);
        this.rows('pallet_rack', { aisle: 7, margin: 5, edge: 5, maxRows: 6, maxRun: 20, minRun: 6 });
        this.lattice(at => [this.candidate('pallet', at, 'N', 'group', `${this.room.id}_staging`)], { along: 7, across: 7 }, { along: 5, across: 5 }, 4);
        break;
      case 'shop': {
        const door = this.exteriorDoor() ?? centroid(this.room);
        const checkout = this.near('checkout', door).find(c => this.accept([c]));
        if (checkout) this.near('register', centre(footprintRect(checkout.object))).some(c => this.accept([c]));
        else this.addWall('register');
        this.walls('cooler', 2);
        this.rows('gondola', { aisle: 4, margin: 3.5, edge: 5, maxRows: 4, maxRun: 12, minRun: 4 });
        this.walls('wall_shelf', 4);
        break;
      }
      case 'bar': {
        this.bar();
        const counter = this.placed.find(p => p.key === 'bar_counter');
        this.near('register', counter ? centre(footprintRect(counter.object)) : centroid(this.room)).some(c => this.accept([c]));
        this.booths(big >= 500 ? 4 : 2);
        this.lattice((at, back) => this.cafe(at, back), { along: 7, across: 6.5 }, { along: 3, across: 3.5 }, 12);
        break;
      }
      case 'reception':
        this.deskGroup('reception_desk'); this.walls('chair', 3); this.addWall('loveseat'); this.addWall('filing');
        break;
      case 'motel_office':
        this.deskGroup('reception_desk');
        { const desk = this.placed.find(p => p.key === 'reception_desk'); this.near('register', desk ? centre(footprintRect(desk.object)) : centroid(this.room)).some(c => this.accept([c])); }
        this.addWall('key_cabinet'); this.addWall('loveseat'); this.walls('chair', 2);
        break;
      case 'back_office':
        if (!this.deskGroup('exec_desk') && !this.deskGroup('desk')) this.addWall('desk');
        this.addWall('safe'); this.walls('filing', 2);
        if (stem(this.room.id) === 'manager') this.addWall('armchair');
        break;
      case 'open_office':
        this.lattice((at, back) => {
          const group = `${this.room.id}_desk_${this.count('workstation') + 1}`;
          const desk = this.candidate('workstation', at, back, 'group', group);
          return [desk, this.seatBefore(desk.object)];
        }, { along: 6, across: 7.5 }, { along: 3.5, across: 4 }, 12);
        // Narrow or door-heavy floors take the rest of their desks against the walls.
        while (this.count('workstation') < Math.min(6, Math.floor(big / 60)) && this.deskGroup('workstation'));
        this.walls('filing', 3);
        break;
      case 'meeting':
        if (!this.tableGroup('meeting_table', 4, true, 10, 3.5) && !this.tableGroup('meeting_table', 3, false, 8, 3.5) && !this.tableGroup('meeting_table', 2, false, 6, 3))
          this.tableGroup('meeting_table', 2, false, 5, 3, 0);
        this.addWall('filing');
        break;
      case 'study':
        if (!this.deskGroup('desk')) this.addWall('desk');
        if (stem(this.room.id) === 'mezz_office') { this.deskGroup('workstation'); this.walls('filing', 2); }
        this.addWall('bookcase'); if (this.pick(2, 'chair')) this.addWall('armchair');
        break;
    }
    return this.placed.map(c => c.object);
  }
}

/** Furnish a generated plan. Like v7 it replaces room objects and keeps yard objects, under the
 * same `__furnished_v7` family key (the furnished-route rules key on it). */
export function furnishLocationG1(base: LocationDefinition): LocationDefinition {
  const loc = structuredClone(base);
  loc.id = furnishedFamilyIdV7(base.id); loc.version = 7;
  const roomIds = new Set(loc.rooms.map(room => room.id)), approaches = approachesOf(loc);
  loc.objects = [...loc.objects.filter(object => !roomIds.has(object.in)), ...loc.rooms.flatMap(room => {
    // Window staging points are kept clear when the room's essentials still fit; a half bath with
    // its window over the only toilet wall keeps the toilet. Door and stair approaches never yield.
    const objects = new G1Plan(loc, room, approaches, true).furnish();
    if (!roomShortfalls(loc, room, objects).length) return objects;
    const fallback = new G1Plan(loc, room, approaches, false).furnish();
    return roomShortfalls(loc, room, fallback).length < roomShortfalls(loc, room, objects).length ? fallback : objects;
  })];
  return loc;
}

/** The catalog entry a `_g1` piece came from: its id is `g1_<room>_<key>_<n>`. */
export function furnishingKeyG1(object: PlacedObject): FurnishingKeyG1 | null {
  const prefix = `g1_${object.in}_`;
  if (!object.id.startsWith(prefix)) return null;
  const key = object.id.slice(prefix.length).replace(/_\d+$/, '');
  return key in FURNITURE_G1 ? key as FurnishingKeyG1 : null;
}

/** validateFurnishingsV7's checks with the g1 catalog's service fronts, and every door and
 * doorway staging point in a room clear of furniture and joined to the room's other approaches.
 * Window staging points are best effort (see furnishLocationG1) and are counted by the tests. */
export function validateFurnishingsG1(loc: LocationDefinition): string[] {
  const approaches = approachesOf(loc);
  return validateFurnishings(loc, object => { const key = furnishingKeyG1(object); return key ? accessRectAt(object, FURNITURE_G1[key].access) : null; }, room => {
    const extra = extraApproaches(approaches, room, furnishingDoorApproaches(loc, room), false);
    // The validator's clearance boxes are exact: the solver's are 0.02 ft wider.
    const r = room.type === 'living' ? 1.5 : 1;
    return { clear: extra.map(p => ({ x: p.at.x - r, y: p.at.y - r, w: r * 2, h: r * 2 })), anchors: extra.map(p => p.at) };
  });
}

/** What a room of each kind must hold. Acceptance rejects a furnished draw that misses one
 * (procedural/generate.ts): a bedroom with no bed, a restroom with a bathtub, an empty bar. */
export function furnishingShortfallsG1(loc: LocationDefinition): string[] {
  return loc.rooms.flatMap(room => roomShortfalls(loc, room, loc.objects));
}
function roomShortfalls(loc: LocationDefinition, room: Room, objects: readonly PlacedObject[]): string[] {
  const out: string[] = [];
  const keys = new Map<string, number>();
  let tubs = 0, shelves = 0;
  for (const o of objects) if (o.in === room.id) {
    const key = furnishingKeyG1(o) ?? o.type;
    keys.set(key, (keys.get(key) ?? 0) + 1);
    if (o.type === 'tub') tubs++;
    if (o.type === 'shelf') shelves++;
  }
  const n = (...ks: string[]) => ks.reduce((s, k) => s + (keys.get(k) ?? 0), 0);
  const need = (ok: boolean, what: string) => { if (!ok) out.push(`${room.id}: ${what}`); };
  const size = area(room);
  switch (roomKindG1(loc, room)) {
    case 'bedroom': case 'guest_unit': need(n('bed', 'twin_bed') > 0, 'no bed'); break;
    case 'wc': need(n('toilet') > 0, 'no toilet'); need(tubs === 0, 'bathing fixture in a half bath'); break;
    case 'bath': case 'ensuite': need(n('toilet') > 0, 'no toilet'); need(n('vanity', 'basin') > 0, 'no basin'); break;
    case 'kitchen': need(n('stove') > 0 && n('sink') > 0 && n('fridge') > 0, 'missing an appliance'); break;
    case 'commercial_kitchen': need(n('range') > 0 && n('prep_sink') > 0, 'no range or sink'); break;
    case 'kitchenette': need(n('sink') > 0, 'no sink'); break;
    case 'dining': need(n('dining_table') > 0 && n('chair') >= 2, 'no table and chairs'); break;
    case 'bar': need(n('bar_counter') > 0, 'no bar counter'); need(n('stool', 'chair', 'booth') >= BAR_SEATS(size), 'too few seats'); break;
    case 'shop': need(n('register') > 0, 'no register'); need(n('gondola', 'wall_shelf') >= 3, 'too little shelving'); break;
    case 'warehouse_floor': need(n('pallet_rack') > 0 && n('pallet_rack', 'wall_rack') >= 4, 'too little racking'); break;
    case 'open_office': need(n('workstation') >= Math.min(4, Math.floor(size / 90)), 'too few desks'); break;
    case 'meeting': need(n('meeting_table') > 0 && n('chair') >= 4, 'no meeting table'); break;
    case 'reception': case 'motel_office': need(n('reception_desk') > 0, 'no desk'); break;
    case 'back_office': case 'study': need(n('exec_desk', 'desk') > 0, 'no desk'); break;
    case 'server': need(n('server_rack') > 0, 'no rack'); break;
    case 'cold_store': need(n('cold_shelf') > 0, 'no shelving'); break;
    case 'storage': case 'stockroom': need(shelves > 0, 'no shelving'); break;
    default: break;
  }
  return out;
}
/** Seats a bar room of `size` sq ft must offer: about one per 45 sq ft, at most twelve. */
const BAR_SEATS = (size: number) => Math.min(12, Math.floor(size / 45));

