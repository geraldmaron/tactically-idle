// Routes through a building: the cheapest sequence of spaces between two points, walked along
// the real openings, with the time a locked door costs to get through. World layer: everything
// here is building geometry plus door materials (content/materials.ts). The policy a caller
// brings, which entry tool it carries and whether a keyholder opens the door, comes in as
// arguments, so generation (procedural reachability, call compilation) and the engine share
// one route model without either reaching into the other.
import type { BuiltLocation, Id, Opening, Room, Vec } from './types';
import { LOCATION_TUNING, pointInPolygon } from './location';
import { DOORS, STAIR_MINUTES } from '../content/materials';
import { findRoomPath, roomPointClear, roomSegmentClear } from './furniture-path';
import { distanceFor, type Distance } from './geometry';

const round1 = (n: number) => Math.round(n * 10) / 10;
/** The location's point distance (geometry.ts): Math.hypot for locations issued before `_g2`. */
const distOf = (built: BuiltLocation): Distance => distanceFor(built.location.geometry);
const mid = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** The entry tool a squad brings to a locked door: its effectiveness 0..1, or null for bare hands. */
export type EntryTool = { effectiveness: number } | null;

export interface ForcedDoor {
  openingId: Id;
  label: string;
  minutes: number;
  withTool: boolean;
  /** Opened by a keyholder: no force time. */
  keyed?: boolean;
}

export interface Route {
  /** Total abstract minutes including forcing locked doors. */
  minutes: number;
  /** Minutes spent forcing locks (included in `minutes`). */
  forceMinutes: number;
  forced: ForcedDoor[];
  points: Vec[];
  /** Last opening crossed, if any. */
  lastOpeningId: Id | null;
  reachable: boolean;
}

const UNREACHABLE: Route = { minutes: Infinity, forceMinutes: 0, forced: [], points: [], lastOpeningId: null, reachable: false };

function forceFor(o: Opening, tool: EntryTool, keyed = false): ForcedDoor {
  const mat = o.type === 'sliding' || o.material === 'glass' ? DOORS.glass : DOORS[o.material ?? 'hollow_core'];
  const full = mat.forceMinutes;
  const quick = mat.forceMinutesWithTool;
  if (keyed) return { openingId: o.id, label: mat.label, minutes: 0, withTool: false, keyed: true };
  const minutes = tool ? quick + (full - quick) * (1 - Math.max(0, Math.min(1, tool.effectiveness))) : full;
  return { openingId: o.id, label: mat.label, minutes: round1(minutes * 100) / 100, withTool: Boolean(tool) };
}

/**
 * Route between two points. The space sequence is the cheapest through the derived
 * graph, with a locked door costing its material's force time (less with an entry
 * tool) in place of the flat default. Minutes are then measured along the actual
 * points: start, each opening midpoint, end.
 */
export function routeBetween(built: BuiltLocation, fromSpace: Id, fromAt: Vec, toSpace: Id, toAt: Vec, tool: EntryTool, keyed = false): Route {
  if (built.location.id.endsWith('__furnished_v7')) return furnishedRouteBetween(built, fromSpace, fromAt, toSpace, toAt, tool, keyed);
  const T = LOCATION_TUNING, dist = distOf(built);
  const openings = new Map(built.location.openings.map((o) => [o.id, o]));
  const edgeCost = (e: { cost: number; openingId: Id }) => {
    const o = openings.get(e.openingId);
    if (o?.state === 'locked') return e.cost - T.lockedMinutes + forceFor(o, tool, keyed).minutes;
    return e.cost;
  };
  if (fromSpace === toSpace) {
    return { minutes: round1(dist(fromAt, toAt) / T.feetPerMinute), forceMinutes: 0, forced: [], points: [fromAt, toAt], lastOpeningId: null, reachable: true };
  }
  const best = new Map<Id, number>([[fromSpace, 0]]);
  const prev = new Map<Id, { from: Id; openingId: Id }>();
  const open = new Set<Id>([fromSpace]);
  while (open.size) {
    let cur: Id | null = null;
    for (const id of open) if (cur === null || best.get(id)! < best.get(cur)! || (best.get(id) === best.get(cur) && id < cur)) cur = id;
    open.delete(cur!);
    for (const e of built.derived.adjacency[cur!] ?? []) {
      const c = best.get(cur!)! + edgeCost(e);
      if (c < (best.get(e.to) ?? Infinity) - 1e-9) {
        best.set(e.to, c);
        prev.set(e.to, { from: cur!, openingId: e.openingId });
        open.add(e.to);
      }
    }
  }
  if (!prev.has(toSpace)) return UNREACHABLE;
  const chain: string[] = [];
  let at = toSpace;
  while (at !== fromSpace) {
    const p = prev.get(at)!;
    chain.unshift(p.openingId);
    at = p.from;
  }
  return routeAlongOpenings(built, fromAt, toAt, chain, tool, keyed);
}

/** Price a connected route with the ordinary traversal/material rules. Furnished
 * v7 also validates physical clearance (1 ft walking, 1.5 ft for chair transport);
 * older location versions retain their exact original route geometry and cost. */
/** Minutes to climb out through a window (R-B2): LOCATION_TUNING.windowMinutes at an easy width,
 * longer in proportion as it narrows. Zero for any other opening. */
export function windowClimbMinutes(opening: Opening): number {
  if (opening.type !== 'window') return 0;
  const T = LOCATION_TUNING, width = Math.hypot(opening.to.x - opening.from.x, opening.to.y - opening.from.y);
  return T.windowMinutes * Math.max(1, T.windowEasyWidth / Math.max(width, 1e-6));
}

export function routeAlongOpenings(built: BuiltLocation, fromAt: Vec, toAt: Vec, chain: Id[], tool: EntryTool, keyed = false, clearance = 1): Route {
  if (built.location.id.endsWith('__furnished_v7')) return furnishedRouteAlongOpenings(built, fromAt, toAt, chain, tool, keyed, Math.max(0, clearance));
  const T = LOCATION_TUNING, dist = distOf(built);
  const openings = new Map(built.location.openings.map(opening => [opening.id, opening]));
  const points: Vec[] = [fromAt];
  let minutes = 0;
  let forceMinutes = 0;
  const forced: ForcedDoor[] = [];
  for (const oid of chain) {
    const o = openings.get(oid);
    if (!o || o.state === 'blocked') return UNREACHABLE;
    points.push(mid(o.from, o.to));
    minutes += T.openingMinutes + windowClimbMinutes(o);
    if (o.state === 'locked') {
      const f = forceFor(o, tool, keyed);
      forced.push(f);
      forceMinutes += f.minutes;
    }
  }
  points.push(toAt);
  for (let i = 1; i < points.length; i++) minutes += dist(points[i - 1], points[i]) / T.feetPerMinute;
  minutes += forceMinutes;
  return { minutes: round1(minutes), forceMinutes: round1(forceMinutes), forced, points, lastOpeningId: chain[chain.length - 1] ?? null, reachable: true };
}

// Furnished v7 uses opening-side states, since two routes into one room may have
// different walk costs (or be separated by furniture). Older saved families keep
// their original room graph, exact points, and rounding above.
const pathFeet = (dist: Distance, points: readonly Vec[]) => points.slice(1).reduce((total, point, i) => total + dist(points[i], point), 0);
const joinPoints = (dist: Distance, first: Vec[], next: Vec[]) => [...first, ...next.filter((point, i) => i > 0 || !first.length || dist(first[first.length - 1], point) > 1e-8)];

function furnishedNavigationSpace(built: BuiltLocation, spaceId: Id): Room | null {
  const room = built.location.rooms.find(candidate => candidate.id === spaceId);
  if (room) return room;
  const zone = built.location.zones.find(candidate => candidate.id === spaceId);
  return zone ? { ...zone, type: 'hall', floor: 0 } : null;
}

function furnishedLocalPath(built: BuiltLocation, spaceId: Id, from: Vec, to: Vec, clearance = 1): Vec[] | null {
  const space = furnishedNavigationSpace(built, spaceId);
  return space ? findRoomPath(space, built.location.objects, from, to, clearance, built.location.geometry) : null;
}

/** The point itself when clear, else the first clear point on growing square rings of up to
 * 2.5 ft, in a fixed order. No trigonometry, so every engine agrees. */
function nearestClearPoint(built: BuiltLocation, spaceId: Id, point: Vec, clearance = 1): Vec | null {
  const space = furnishedNavigationSpace(built, spaceId);
  if (!space) return null;
  const objects = built.location.objects, geometry = built.location.geometry;
  if (roomPointClear(space, objects, point, clearance, geometry)) return point;
  const steps = Math.ceil((clearance + 1.5) / 0.25);
  for (let k = 1; k <= steps; k++) {
    const r = k * 0.25;
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, -1], [-1, 1]] as const) {
      const candidate = { x: point.x + dx * r, y: point.y + dy * r };
      if (roomPointClear(space, objects, candidate, clearance, geometry)) return candidate;
    }
  }
  return null;
}

interface FurnishedCrossing { into: Id; from: Vec; to: Vec; points: Vec[]; minutes: number; forced: ForcedDoor | null }

function furnishedCrossing(built: BuiltLocation, opening: Opening, fromSpace: Id, tool: EntryTool, keyed: boolean, clearance = 1): FurnishedCrossing | null {
  if (opening.state === 'blocked' || (opening.a !== fromSpace && opening.b !== fromSpace)) return null;
  const into = opening.a === fromSpace ? opening.b : opening.a;
  const midpoint = mid(opening.from, opening.to), dist = distOf(built), geometry = built.location.geometry;
  const approach = (spaceId: Id): Vec | null => {
    if (opening.type === 'stair') return spaceId === opening.a ? opening.from : opening.to;
    const staging = built.derived.stagingPoints.find(point => point.openingId === opening.id && point.spaceId === spaceId);
    if (staging) return staging.at;
    // Open-ground links have no saved staging point. Give each zone its own
    // inward approach, so neither local path starts on the polygon boundary.
    const space = furnishedNavigationSpace(built, spaceId);
    const width = dist(opening.from, opening.to);
    if (!space || width < 1e-8) return null;
    const normal = { x: -(opening.to.y - opening.from.y) / width, y: (opening.to.x - opening.from.x) / width };
    for (const offset of [Math.max(1.5, clearance), clearance]) for (const sign of [1, -1]) {
      const point = { x: midpoint.x + normal.x * offset * sign, y: midpoint.y + normal.y * offset * sign };
      if (roomPointClear(space, built.location.objects, point, clearance, geometry)) return point;
    }
    return null;
  };
  const from = approach(fromSpace), to = approach(into);
  if (!from || !to) return null;
  if (opening.type !== 'stair') {
    // A doorway is the sole permitted wall crossing. Its short normal approach
    // keeps the whole interior route clear without pretending the wall is absent.
    if (dist(opening.from, opening.to) < clearance * 2 - 1e-7) return null;
    for (const [spaceId, at] of [[fromSpace, from], [into, to]] as const) {
      const space = furnishedNavigationSpace(built, spaceId);
      if (!space || !roomSegmentClear(space, built.location.objects, at, midpoint, clearance, 0, geometry)) return null;
    }
  }
  const points = opening.type === 'stair' ? [from, to] : [from, midpoint, to];
  const forced = opening.state === 'locked' ? forceFor(opening, tool, keyed) : null;
  return { into, from, to, points, forced, minutes: pathFeet(dist, points) / LOCATION_TUNING.feetPerMinute + (opening.type === 'stair' ? STAIR_MINUTES : LOCATION_TUNING.openingMinutes) + (forced?.minutes ?? 0) };
}

interface FurnishedState { spaceId: Id; at: Vec; minutes: number; forceMinutes: number; forced: ForcedDoor[]; points: Vec[]; lastOpeningId: Id | null }

function furnishedFinish(dist: Distance, state: FurnishedState, tail: Vec[]): Route {
  return { reachable: true, minutes: round1(state.minutes + pathFeet(dist, tail) / LOCATION_TUNING.feetPerMinute), forceMinutes: round1(state.forceMinutes), forced: state.forced, points: joinPoints(dist, state.points, tail), lastOpeningId: state.lastOpeningId };
}

function furnishedAdvance(dist: Distance, state: FurnishedState, path: Vec[], crossing: FurnishedCrossing, openingId: Id): FurnishedState {
  return {
    spaceId: crossing.into, at: crossing.to,
    minutes: state.minutes + pathFeet(dist, path) / LOCATION_TUNING.feetPerMinute + crossing.minutes,
    forceMinutes: state.forceMinutes + (crossing.forced?.minutes ?? 0),
    forced: crossing.forced ? [...state.forced, crossing.forced] : state.forced,
    points: joinPoints(dist, joinPoints(dist, state.points, path), crossing.points), lastOpeningId: openingId,
  };
}

function furnishedRouteBetween(built: BuiltLocation, fromSpace: Id, fromAt: Vec, toSpace: Id, toAt: Vec, tool: EntryTool, keyed: boolean): Route {
  const direct = furnishedSearch(built, fromSpace, fromAt, toSpace, toAt, tool, keyed);
  if (direct.reachable) return direct;
  // A squad holding a window or door staging point, or aiming at one, can stand within a step
  // of the clearance a route needs; furnished `_g2` layouts stranded squads this way. Squad
  // routes start and end at the nearest clear point a step away instead. Person and chair moves
  // (routeAlongOpenings) keep the strict check, and routes that work already are unchanged.
  const start = nearestClearPoint(built, fromSpace, fromAt), end = nearestClearPoint(built, toSpace, toAt);
  if (!start || !end || (start === fromAt && end === toAt)) return direct;
  const route = furnishedSearch(built, fromSpace, start, toSpace, end, tool, keyed);
  return route.reachable ? { ...route, points: [...(start === fromAt ? [] : [fromAt]), ...route.points, ...(end === toAt ? [] : [toAt])] } : direct;
}

function furnishedSearch(built: BuiltLocation, fromSpace: Id, fromAt: Vec, toSpace: Id, toAt: Vec, tool: EntryTool, keyed: boolean): Route {
  const states = new Map<string, FurnishedState>([['start', { spaceId: fromSpace, at: fromAt, minutes: 0, forceMinutes: 0, forced: [], points: [fromAt], lastOpeningId: null }]]);
  const open = new Set(['start']), dist = distOf(built);
  const openings = new Map(built.location.openings.map(opening => [opening.id, opening]));
  let best: { state: FurnishedState; tail: Vec[]; minutes: number } | null = null;
  while (open.size) {
    const key = [...open].sort((a, b) => states.get(a)!.minutes - states.get(b)!.minutes || a.localeCompare(b))[0];
    open.delete(key);
    const state = states.get(key)!;
    if (best && state.minutes >= best.minutes) continue;
    if (state.spaceId === toSpace) {
      const tail = furnishedLocalPath(built, toSpace, state.at, toAt);
      if (tail) {
        const minutes = state.minutes + pathFeet(dist, tail) / LOCATION_TUNING.feetPerMinute;
        if (!best || minutes < best.minutes) best = { state, tail, minutes };
      }
    }
    for (const edge of built.derived.adjacency[state.spaceId] ?? []) {
      const opening = openings.get(edge.openingId);
      if (!opening) continue;
      const crossing = furnishedCrossing(built, opening, state.spaceId, tool, keyed);
      if (!crossing) continue;
      const path = furnishedLocalPath(built, state.spaceId, state.at, crossing.from);
      if (!path) continue;
      const next = furnishedAdvance(dist, state, path, crossing, opening.id);
      const nextKey = JSON.stringify([crossing.into, opening.id]);
      if (next.minutes < (states.get(nextKey)?.minutes ?? Infinity) - 1e-9) {
        states.set(nextKey, next);
        open.add(nextKey);
      }
    }
  }
  return best ? furnishedFinish(dist, best.state, best.tail) : UNREACHABLE;
}

function furnishedRouteAlongOpenings(built: BuiltLocation, fromAt: Vec, toAt: Vec, chain: Id[], tool: EntryTool, keyed: boolean, clearance: number): Route {
  const openings = new Map(built.location.openings.map(opening => [opening.id, opening])), dist = distOf(built);
  const spaces = [...built.location.rooms, ...built.location.zones];
  const first = chain.length ? openings.get(chain[0]) : undefined;
  const starts = spaces.filter(space => (!first || space.id === first.a || space.id === first.b) && pointInPolygon(fromAt, space.polygon));
  let best = UNREACHABLE;
  for (const start of starts) {
    let state: FurnishedState = { spaceId: start.id, at: fromAt, minutes: 0, forceMinutes: 0, forced: [], points: [fromAt], lastOpeningId: null };
    let valid = true;
    for (const openingId of chain) {
      const opening = openings.get(openingId);
      const crossing = opening && furnishedCrossing(built, opening, state.spaceId, tool, keyed, clearance);
      const path = crossing && furnishedLocalPath(built, state.spaceId, state.at, crossing.from, clearance);
      if (!crossing || !path) { valid = false; break; }
      state = furnishedAdvance(dist, state, path, crossing, openingId);
      if (opening.type === 'window') state = { ...state, minutes: state.minutes + windowClimbMinutes(opening) };
    }
    const endSpace = spaces.find(space => space.id === state.spaceId);
    if (!valid || !endSpace || !pointInPolygon(toAt, endSpace.polygon)) continue;
    const tail = furnishedLocalPath(built, state.spaceId, state.at, toAt, clearance);
    if (!tail) continue;
    const route = furnishedFinish(dist, state, tail);
    if (route.minutes < best.minutes) best = route;
  }
  return best;
}
