// Shared plumbing for the world's rules: seeded draws, ids, the radio log, the funding scale and the
// allocation factor. No imports from the economy, so every rules module can use it at load time.
import { hashSeed } from '../rng';
import { ALLOCATION, EVENT_CAP, HOUR } from '../../content/city/tuning';
import type { DistrictId, WorldEvent, WorldState } from './types';
import { DISTRICT_IDS } from './types';

/** What one settlement accumulates for the shift report. */
export interface WorldAcc {
  contacts: number;
  casesOpened: number;
  casesClosed: number;
  awardsPaid: number;
  awardFunding: number;
  leads: string[];
  crimeBefore: Partial<Record<DistrictId, number>>;
}

/** A value in [0, 1) for one named draw. The key is the contract in ./types.ts:
 * `${seed}:${kind}:${hour}:${unitOrShiftId}:${index}`. Never the department rng, never Math.random, so
 * online play, offline settlement and any partition of the same time agree. */
export function draw(seed: number, kind: string, hour: number, unitId: string, index = 0): number {
  let x = hashSeed(`${seed}:${kind}:${hour}:${unitId}:${index}`);
  // A final mix so draws for neighbouring keys do not move together.
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Index into weights for a draw r in [0, 1). Zero weights are never picked. */
export function weighted(r: number, weights: readonly number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let acc = 0;
  let last = 0;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] <= 0) continue;
    acc += weights[i];
    last = i;
    if (r * total < acc) return i;
  }
  return last;
}

export type IdPrefix = 's' | 'k' | 'c' | 'l' | 'p' | 'e';
export function newId(w: Pick<WorldState, 'nextId'>, prefix: IdPrefix): string {
  return `${prefix}${w.nextId++}`;
}

export function pushEvent(w: WorldState, e: Omit<WorldEvent, 'id'>): WorldEvent {
  const event: WorldEvent = { id: newId(w, 'e'), ...e };
  w.events.push(event);
  if (w.events.length > EVENT_CAP) w.events.splice(0, w.events.length - EVENT_CAP);
  return event;
}

export const hourOf = (ms: number): number => Math.floor(ms / HOUR);
export const round1 = (x: number): number => Math.round(x * 10) / 10;
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** 1 for levels 1 to 3, 2 for 4 to 6, 3 for 7 and up. Earned through service, never bought. */
export function fundingScale(level: number): number {
  return level >= 7 ? 3 : level >= 4 ? 2 : 1;
}

/** The district the department was founded in: the default for patrol staff with no assignment and where
 * coverage taken off another district returns. Pike Street until the department is founded elsewhere. */
export function homeDistrict(w: Pick<WorldState, 'home'> | undefined): DistrictId {
  return w?.home ?? 'pike';
}

/** The district a patrol employee works: the one they were assigned, else home. */
export function patrolDistrict(w: Pick<WorldState, 'home'> | undefined, p: { districtId?: DistrictId }): DistrictId {
  return p.districtId ?? homeDistrict(w);
}

export function openDistrictIds(w: Pick<WorldState, 'districts'>): DistrictId[] {
  return DISTRICT_IDS.filter((id) => w.districts[id].open);
}

/** The mean crime of the open districts, each weighted equally so moving coverage cannot game the average. */
export function cityCrime(w: Pick<WorldState, 'districts'>): number {
  const open = openDistrictIds(w);
  if (!open.length) return ALLOCATION.centre;
  return open.reduce((sum, id) => sum + w.districts[id].crime, 0) / open.length;
}

/** clamp(1 + (50 - crime) / 100, 0.8, 1.25): calm pays more, neglect never does. */
export function allocationFactor(crime: number): number {
  return clamp(1 + (ALLOCATION.centre - crime) / ALLOCATION.slope, ALLOCATION.floor, ALLOCATION.ceiling);
}

/** Department allocation per hour. `sustainable` pins the factor to its floor, for commitments that must
 * hold when the city turns against the player. */
export function allocationRate(w: Pick<WorldState, 'districts'> | undefined, base: number, sustainable: boolean): number {
  if (!w) return base;
  const open = openDistrictIds(w).length || 1;
  return base * open * (sustainable ? ALLOCATION.floor : allocationFactor(cityCrime(w)));
}
