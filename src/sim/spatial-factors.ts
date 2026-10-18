// Spatial factors for operation resolution: where people stand, what signal reaches
// them, which equipment is in range and how exposed an entry is. Routes (routes.ts) and
// cover (cover.ts) are building geometry and live in the world layer.
// Every function is pure and returns player-language labels plus map overlays, so a
// contributor and the overlay that explains it always come from the same numbers.
// Game abstractions, not tactical instruction.
import type { BuiltLocation, Id, KnowledgeStatus, ItemDefinition, MapOverlay, Opening, StagingPoint, Vec } from './types';
import type { FactDefinition, ScenarioDefinition } from './scenario-types';
import { bestSignal, nearestOpening, stagingPointById, type Channel } from './spatial';
import { LOCATION_TUNING } from './location';
import { DOORS } from '../content/materials';
import { distanceFor, type Distance } from './geometry';
import { tunable } from './tuning';

/** Tunable (sim/tuning.ts). */
export const SPATIAL_TUNING = tunable('SPATIAL_TUNING', {
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
  /** Difficulty an entry gains when an armed person has hard cover (an appliance, a counter) or
   * concealment (a sofa, a desk) between them and the door the team comes through. */
  coverHard: 6,
  coverConcealment: 3,
});

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

function signalWord(channel: Channel, transmission: number): string {
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
