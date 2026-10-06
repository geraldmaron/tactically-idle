// Spatial factors for operation resolution: where people stand, what signal reaches
// them, which equipment is in range, how far a route runs and how exposed an entry is.
// Every function is pure and returns player-language labels plus map overlays, so a
// contributor and the overlay that explains it always come from the same numbers.
// Game abstractions, not tactical instruction.
import type { BuiltLocation, Id, KnowledgeStatus, ItemDefinition, MapOverlay, Opening, Room, StagingPoint, Vec } from './types';
import type { FactDefinition, ScenarioDefinition } from './scenario-types';
import { bestSignal, nearestOpening, stagingPointById, type Channel } from './spatial';
import { LOCATION_TUNING, pointInPolygon } from './location';
import { DOORS, STAIR_MINUTES } from '../content/materials';
import { findRoomPath, roomPointClear, roomSegmentClear } from './furniture-path';
import { distanceFor, type Distance } from './geometry';

export const SPATIAL_TUNING = {
  /** Transmission at which a signal reads as fully clear (quality 1). */
  clearFull: 0.6,
  /** Overlay tone cut-offs on raw transmission. */
  toneClear: 0.6,
  tonePartial: 0.25,
  /** Share of an item's value left at its maximum range (linear from 1 at effective range). */
  rangeFloor: 0.2,
  /** Score points lost per foot the subject stands from the nearest door of their room. */
  entryScorePerFt: 0.25,
  /** Extra strain share per foot, capped. */
  entryStrainPerFt: 0.015,
  entryStrainCap: 0.4,
  /** Voice carries between squads without radios only this far, feet. */
  voiceLinkFt: 30,
};

const round1 = (n: number) => Math.round(n * 10) / 10;
/** The location's point distance (geometry.ts): Math.hypot for locations issued before `_g2`. */
const distOf = (built: BuiltLocation): Distance => distanceFor(built.location.geometry);
const mid = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// ---------------------------------------------------------------- tone and wording

export type Tone = 'clear' | 'partial' | 'blocked';

export function toneFor(transmission: number): Tone {
  return transmission >= SPATIAL_TUNING.toneClear ? 'clear' : transmission >= SPATIAL_TUNING.tonePartial ? 'partial' : 'blocked';
}

/** 0..1 usefulness of a signal: full at clearFull and above, linear below. */
export function signalQuality(transmission: number): number {
  return Math.max(0, Math.min(1, transmission / SPATIAL_TUNING.clearFull));
}

const WORDS: Record<string, [string, string, string, string]> = {
  sound: ['clear', 'muffled', 'faint', 'barely audible'],
  visual: ['clear', 'obscured', 'dim', 'barely visible'],
  thermal: ['clear', 'weak', 'faint', 'barely readable'],
  radio: ['strong', 'reduced', 'weak', 'barely there'],
};

export function signalWord(channel: Channel, transmission: number): string {
  const w = WORDS[channel] ?? WORDS.sound;
  return transmission >= 0.6 ? w[0] : transmission >= 0.25 ? w[1] : transmission >= 0.1 ? w[2] : w[3];
}

// ---------------------------------------------------------------- subjects

export interface Subject {
  at: Vec;
  spaceId: Id;
  /** exact = position confirmed; reported = a report's approximate point; estimate = room centre. */
  basis: 'exact' | 'reported' | 'estimate';
  label: string;
  /** Uncertainty note when the position is not known. */
  note: string | null;
}

export function spaceLabel(built: BuiltLocation, id: Id): string {
  return built.location.rooms.find((r) => r.id === id)?.label ?? built.location.zones.find((z) => z.id === id)?.label ?? id;
}

export function centroidOf(built: BuiltLocation, id: Id): Vec {
  return built.derived.spaces[id]?.centroid ?? { x: 0, y: 0 };
}

/** The approximate point a report places a person at. Never the true position unless the author says so. */
export function approxPoint(built: BuiltLocation, fact: FactDefinition): Vec {
  return fact.person?.reportedAt ?? centroidOf(built, fact.spaceId);
}

/**
 * Where a signal is aimed: the known position of the fact's person, the report's
 * approximate point, or the room centre when nothing is known. The engine never uses
 * a position the player has not been given.
 */
export function resolveSubject(
  scenario: ScenarioDefinition,
  built: BuiltLocation,
  knowledge: Record<Id, KnowledgeStatus>,
  targetId: Id,
  factId?: Id,
): Subject {
  const fact = factId ? scenario.facts.find((f) => f.id === factId) : undefined;
  if (!fact) {
    return { at: centroidOf(built, targetId), spaceId: targetId, basis: 'estimate', label: spaceLabel(built, targetId), note: null };
  }
  const status = knowledge[fact.id] ?? fact.initial;
  const room = spaceLabel(built, fact.spaceId).toLowerCase();
  const label = fact.person?.label ?? fact.label;
  if (status === 'confirmed' && fact.person?.at) return { at: fact.person.at, spaceId: fact.spaceId, basis: 'exact', label, note: null };
  if (status === 'reported') return { at: approxPoint(built, fact), spaceId: fact.spaceId, basis: 'reported', label, note: `Only a report places them in the ${room}; the exact spot is a guess` };
  return { at: centroidOf(built, fact.spaceId), spaceId: fact.spaceId, basis: 'estimate', label, note: `Nobody knows where in the ${room} they are; aiming at the middle` };
}

// ---------------------------------------------------------------- standing points

export interface Standing {
  stagingId: Id | null;
  at: Vec;
  spaceId: Id;
  openingId: Id | null;
  kind: StagingPoint['kind'] | 'ground';
}

export function standingOf(built: BuiltLocation, task: { positionId: Id; stagingId: Id | null; at: Vec | null }): Standing {
  const sp = task.stagingId ? stagingPointById(built, task.stagingId) : undefined;
  if (sp) return { stagingId: sp.id, at: sp.at, spaceId: sp.spaceId, openingId: sp.openingId, kind: sp.kind };
  return { stagingId: null, at: task.at ?? centroidOf(built, task.positionId), spaceId: task.positionId, openingId: null, kind: 'ground' };
}

export function standingFromPoint(sp: StagingPoint): Standing {
  return { stagingId: sp.id, at: sp.at, spaceId: sp.spaceId, openingId: sp.openingId, kind: sp.kind };
}

/** Staging points from which a squad can act on `targetId`: outside (zones) or inside (rooms). */
export function standingCandidates(built: BuiltLocation, targetId: Id, mode: 'outside' | 'inside', openingId?: Id): StagingPoint[] {
  const zones = new Set(built.location.zones.map((z) => z.id));
  return built.derived.stagingPoints.filter(
    (s) => s.facesId === targetId && (mode === 'outside' ? zones.has(s.spaceId) : !zones.has(s.spaceId)) && (!openingId || s.openingId === openingId),
  );
}

/** Default staging for a starting position: nearest door point, else nearest of any kind, else null. */
export function defaultStagingFor(built: BuiltLocation, spaceId: Id): StagingPoint | null {
  const here = built.derived.stagingPoints.filter((s) => s.spaceId === spaceId);
  if (here.length === 0) return null;
  const c = centroidOf(built, spaceId), dist = distOf(built);
  const byDist = (a: StagingPoint, b: StagingPoint) => dist(a.at, c) - dist(b.at, c) || a.id.localeCompare(b.id);
  const doors = here.filter((s) => s.kind === 'door' || s.kind === 'doorway').sort(byDist);
  return doors[0] ?? [...here].sort(byDist)[0];
}

/** Staging point in `spaceId` that faces `towardId`, else the default for that space. */
export function stagingFacing(built: BuiltLocation, spaceId: Id, towardId: Id | null, openingId?: Id): StagingPoint | null {
  const here = built.derived.stagingPoints.filter((s) => s.spaceId === spaceId);
  const pick = (list: StagingPoint[]) => [...list].sort((a, b) => a.id.localeCompare(b.id))[0] ?? null;
  if (openingId) {
    const hit = pick(here.filter((s) => s.openingId === openingId));
    if (hit) return hit;
  }
  if (towardId) {
    const hit = pick(here.filter((s) => s.facesId === towardId));
    if (hit) return hit;
  }
  return defaultStagingFor(built, spaceId);
}

/** True when `to` can be reached from `from` over open ground (zones only). */
export function reachableOverGround(built: BuiltLocation, from: Id, to: Id): boolean {
  const zones = new Set(built.location.zones.map((z) => z.id));
  if (!zones.has(from) || !zones.has(to)) return from === to;
  const seen = new Set<Id>([from]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === to) return true;
    for (const e of built.derived.adjacency[cur] ?? []) {
      if (!zones.has(e.to) || seen.has(e.to)) continue;
      seen.add(e.to);
      queue.push(e.to);
    }
  }
  return false;
}

// ---------------------------------------------------------------- signals

export interface SignalAssessment {
  transmission: number;
  quality: number;
  distance: number;
  tone: Tone;
  /** 'Voice through hollow-core door (closed), 18 ft: muffled' */
  label: string;
  overlay: MapOverlay;
  via: Id | null;
}

export function assessSignal(built: BuiltLocation, from: Vec, to: Vec, channel: Channel, noun: string): SignalAssessment {
  const r = bestSignal(built, from, to, channel);
  const first = r.blockers[0];
  const extra = r.blockers.length - 1;
  const through = first ? `through ${lower(first.label)}${extra > 0 ? ` and ${extra} more layer${extra === 1 ? '' : 's'}` : ''}` : 'in the open';
  const tone = toneFor(r.transmission);
  return {
    transmission: r.transmission,
    quality: signalQuality(r.transmission),
    distance: r.distance,
    tone,
    label: `${noun} ${through}, ${Math.round(r.distance)} ft: ${signalWord(channel, r.transmission)}`,
    overlay: { kind: 'line', from, to, tone, label: `${noun} ${r.transmission.toFixed(2)}` },
    via: r.via,
  };
}

// ---------------------------------------------------------------- equipment range

export interface RangeResult {
  ok: boolean;
  /** 1 within effective range, falling linearly to rangeFloor at max. */
  factor: number;
  reason: string | null;
  label: string;
  overlays: MapOverlay[];
}

function scaleFor(d: number, eff: number, max: number): number {
  if (d <= eff) return 1;
  if (max <= eff) return SPATIAL_TUNING.rangeFloor;
  return 1 - (1 - SPATIAL_TUNING.rangeFloor) * ((d - eff) / (max - eff));
}

function rings(item: ItemDefinition, at: Vec): MapOverlay[] {
  if (!item.range) return [];
  return [
    { kind: 'range', at, radius: item.range.effective, tone: 'effective', label: `${item.name} ${item.range.effective} ft` },
    { kind: 'range', at, radius: item.range.max, tone: 'max', label: `max ${item.range.max} ft` },
  ];
}

/** Range of an item against a point (hailer, imager, drone). No location here: always the legacy Math.hypot. */
export function rangeToPoint(item: ItemDefinition, from: Vec, target: Vec): RangeResult {
  if (!item.range) return { ok: true, factor: 1, reason: null, label: '', overlays: [] };
  const d = distanceFor(undefined)(from, target);
  const { effective, max } = item.range;
  const overlays = rings(item, from);
  if (d > max) {
    return { ok: false, factor: 0, reason: `${item.name}: target ${Math.round(d)} ft away, max ${max} ft`, label: `${item.name}: ${Math.round(d)} ft, beyond ${max} ft`, overlays };
  }
  const factor = scaleFor(d, effective, max);
  const within = d <= effective ? `within ${effective} ft` : `past ${effective} ft, reach fading to ${max} ft`;
  return { ok: true, factor, reason: null, label: `${item.name}: ${Math.round(d)} ft (${within})`, overlays };
}

const OPENING_WORD: Record<Opening['type'], string> = { door: 'door', doorway: 'doorway', window: 'window', sliding: 'sliding door', stair: 'stairs' };

/** Range of an item that must pass through an opening of the target space (throw phone). */
export function rangeThroughOpening(built: BuiltLocation, item: ItemDefinition, from: Vec, targetSpace: Id): RangeResult {
  if (!item.range) return { ok: true, factor: 1, reason: null, label: '', overlays: [] };
  const { effective, max } = item.range;
  const overlays = rings(item, from), dist = distOf(built);
  let best: { o: Opening; d: number } | null = null;
  for (const o of built.location.openings) {
    if (o.a !== targetSpace && o.b !== targetSpace) continue;
    if (o.state === 'blocked') continue;
    const d = dist(from, mid(o.from, o.to));
    if (!best || d < best.d) best = { o, d };
  }
  if (!best) {
    const room = spaceLabel(built, targetSpace).toLowerCase();
    return { ok: false, factor: 0, reason: `${item.name}: no usable opening into the ${room}`, label: `${item.name}: no opening`, overlays };
  }
  const d = Math.round(best.d);
  const word = OPENING_WORD[best.o.type];
  if (best.d > max) {
    return { ok: false, factor: 0, reason: `${item.name}: nearest ${word} ${d} ft away, max ${max} ft`, label: `${item.name}: ${word} ${d} ft, beyond ${max} ft`, overlays };
  }
  const path: MapOverlay = { kind: 'path', points: [from, mid(best.o.from, best.o.to)], label: `to the ${word}` };
  const factor = scaleFor(best.d, effective, max);
  const within = best.d <= effective ? `within ${effective} ft` : `past ${effective} ft, reach fading to ${max} ft`;
  return { ok: true, factor, reason: null, label: `${item.name}: ${word} ${d} ft away (${within})`, overlays: [...overlays, path] };
}

// ---------------------------------------------------------------- routes

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

function forceFor(o: Opening, tool: { effectiveness: number } | null, keyed = false): ForcedDoor {
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
export function routeBetween(built: BuiltLocation, fromSpace: Id, fromAt: Vec, toSpace: Id, toAt: Vec, tool: { effectiveness: number } | null, keyed = false): Route {
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
export function routeAlongOpenings(built: BuiltLocation, fromAt: Vec, toAt: Vec, chain: Id[], tool: { effectiveness: number } | null, keyed = false, clearance = 1): Route {
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
    minutes += T.openingMinutes;
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

function furnishedCrossing(built: BuiltLocation, opening: Opening, fromSpace: Id, tool: { effectiveness: number } | null, keyed: boolean, clearance = 1): FurnishedCrossing | null {
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

function furnishedRouteBetween(built: BuiltLocation, fromSpace: Id, fromAt: Vec, toSpace: Id, toAt: Vec, tool: { effectiveness: number } | null, keyed: boolean): Route {
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

function furnishedSearch(built: BuiltLocation, fromSpace: Id, fromAt: Vec, toSpace: Id, toAt: Vec, tool: { effectiveness: number } | null, keyed: boolean): Route {
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

function furnishedRouteAlongOpenings(built: BuiltLocation, fromAt: Vec, toAt: Vec, chain: Id[], tool: { effectiveness: number } | null, keyed: boolean, clearance: number): Route {
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

// ---------------------------------------------------------------- entry exposure

export interface EntryExposure {
  distance: number;
  /** Door label, e.g. 'hollow-core door'. */
  doorLabel: string;
  openingId: Id | null;
  minutes: number;
  score: number;
  strainMult: number;
  label: string;
}

/** Distance from the subject to the nearest door of their room: time, exposure and strain. */
export function entryExposure(built: BuiltLocation, subject: Subject): EntryExposure {
  const near = nearestOpening(built, subject.spaceId, subject.at, ['door', 'doorway', 'sliding']);
  if (!near) return { distance: 0, doorLabel: 'door', openingId: null, minutes: 0, score: 0, strainMult: 1, label: '' };
  const d = near.distance;
  const o = near.opening;
  const doorLabel = o.type === 'doorway' ? 'doorway' : lower((o.type === 'sliding' ? DOORS.glass : DOORS[o.material ?? 'hollow_core']).label);
  const minutes = round1(d / LOCATION_TUNING.feetPerMinute);
  const score = -round1(d * SPATIAL_TUNING.entryScorePerFt);
  const strainMult = 1 + Math.min(SPATIAL_TUNING.entryStrainCap, d * SPATIAL_TUNING.entryStrainPerFt);
  const who = subject.basis === 'exact' ? subject.label : `Where ${lower(subject.label)} is thought to be`;
  return {
    distance: d,
    doorLabel,
    openingId: o.id,
    minutes,
    score,
    strainMult,
    label: `${who}: ${Math.round(d)} ft from the nearest ${doorLabel}, +${minutes} min and more exposure`,
  };
}
