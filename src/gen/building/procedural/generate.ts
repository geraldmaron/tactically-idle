import type { LocationDefinition } from '../../../sim/types';
import { deriveLocation } from '../../../sim/location';
import { validateLocation } from '../../../sim/location-validate';
import { furnishLocationV7, validateFurnishingsV7 } from '../furnishing-v7';
import { buildAttempt } from './build';
import { FAMILIES } from './families';
import { plausibilityReport } from './plausibility';
import { Rand } from './rand';
import type { FamilySpec } from './types';

/** Attempts per draw stream before falling back to the family's known-good seed. */
export const MAX_ATTEMPTS = 40;
/** The fallback stream is reached rarely, so it may search longer: its furnishing depends on the reported seed. */
export const FALLBACK_ATTEMPTS = 120;
/** Generator generation. Part of every public building type id (`bungalow_g1`); see README.md before changing output. */
export const GENERATION = 'g1';
export const publicFamilyId = (specId: string): string => `${specId}_${GENERATION}`;

export interface AttemptStats {
  attempts: number;
  /** Rejections by stage. */
  reasons: Record<string, number>;
}

/** An accepted building: the plan the game stores and the same plan after furnishLocationV7. */
export interface GeneratedBuilding {
  plain: LocationDefinition;
  furnished: LocationDefinition;
}

/** Room tags that follow from what the furniture is (a register holds valuables, a sofa gives cover). */
const FURNITURE_TAGS = ['valuables', 'hazard', 'concealment', 'cover'];

/**
 * Furnish a candidate with the game's own solver and accept it only when the furnished result is
 * as clean as the plan: plausible with its furniture, no furnishing diagnostics, and no
 * validator issue (warnings included) on either form. Null names nothing; `bump` records why.
 */
function accept(plain: LocationDefinition, bump: (reason: string) => void): GeneratedBuilding | null {
  // The structural checks need no furniture, so a cheap pass rejects most bad draws before the solve.
  const pre = plausibilityReport(plain, false);
  if (!pre.pass) return reject(pre.notes, bump);
  const furnished = furnishLocationV7(plain);
  // furnishLocationV7 does not read room tags, so adding these to both forms keeps furnished
  // equal to furnishLocationV7(plain); the family suite (suite.ts) checks that.
  for (const [i, room] of furnished.rooms.entries()) {
    const extra = FURNITURE_TAGS.filter((t) => !room.tags.includes(t) && furnished.objects.some((o) => o.in === room.id && o.tags.includes(t)));
    room.tags.push(...extra);
    plain.rooms[i].tags.push(...extra);
  }
  const rep = plausibilityReport(furnished);
  if (!rep.pass) return reject(rep.notes, bump);
  const diag = validateFurnishingsV7(furnished)[0];
  if (diag) {
    bump(`furnishing ${diag.replace(/^[^:]*: /, '')}`);
    return null;
  }
  for (const loc of [plain, furnished]) {
    const err = validateLocation(loc, deriveLocation(loc))[0];
    if (err) {
      bump(`validator ${err.code}`);
      return null;
    }
  }
  return { plain, furnished };
}

function reject(notes: string[], bump: (reason: string) => void): null {
  const first = notes.find((n) => n.startsWith('FAIL')) ?? notes[0] ?? 'score';
  bump(`plaus: ${first.replace(/[a-z_]+_\d+/g, (m) => m.replace(/_\d+$/, '')).replace(/[\d.]+/g, '#')}`);
  return null;
}

function search(spec: FamilySpec, geoSeed: number, reportSeed: number, attempts: number, stats?: AttemptStats): GeneratedBuilding | null {
  const rng = new Rand(`${spec.id}:${geoSeed}`);
  const familyId = publicFamilyId(spec.id);
  const bump = (r: string) => {
    if (stats) stats.reasons[r] = (stats.reasons[r] ?? 0) + 1;
  };
  for (let k = 0; k < attempts; k++) {
    if (stats) stats.attempts++;
    // An unexpected exception in one draw must not take the game down; the draw is simply rejected.
    try {
      const loc = buildAttempt(spec, familyId, reportSeed, rng, stats ? bump : undefined);
      if (!loc) continue;
      const done = accept(loc, bump);
      if (done) return done;
    } catch {
      bump('exception');
    }
  }
  return null;
}

const specOf = (familyId: string): FamilySpec | undefined => FAMILIES.find((f) => f.id === familyId || publicFamilyId(f.id) === familyId);

/**
 * Deterministic: the draw stream is seeded from hashSeed(`${specId}:${seed}`). `familyId` is a
 * spec id (`bungalow`) or its public id (`bungalow_g1`); the result always carries the public id.
 */
export function generatePair(familyId: string, seed: number, stats?: AttemptStats): GeneratedBuilding {
  const spec = specOf(familyId);
  if (!spec) throw new Error(`No generator for ${familyId} (seed ${seed})`);
  const found = search(spec, seed, seed, MAX_ATTEMPTS, stats);
  if (found) return found;
  if (stats) stats.reasons.FALLBACK = (stats.reasons.FALLBACK ?? 0) + 1;
  const fallback = search(spec, spec.fallbackSeed, seed, FALLBACK_ATTEMPTS, stats);
  if (fallback) return fallback;
  throw new Error(`No valid ${familyId} building for seed ${seed}`);
}

export function generate(familyId: string, seed: number, stats?: AttemptStats): LocationDefinition {
  return generatePair(familyId, seed, stats).plain;
}

/** The family's known-good layout stream, reported as `seed`. Exposed so tests can prove the fallback valid. */
export function generateFallback(familyId: string, seed: number): GeneratedBuilding {
  const spec = specOf(familyId);
  if (!spec) throw new Error(`No generator for ${familyId}`);
  const found = search(spec, spec.fallbackSeed, seed, FALLBACK_ATTEMPTS);
  if (!found) throw new Error(`Fallback for ${familyId} is not valid`);
  return found;
}
