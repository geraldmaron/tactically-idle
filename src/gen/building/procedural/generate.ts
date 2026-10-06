import type { LocationDefinition } from '../../../sim/types';
import { deriveLocation } from '../../../sim/location';
import { validateLocation } from '../../../sim/location-validate';
import { routeBetween } from '../../../sim/spatial-factors';
import { furnishingShortfallsG1, furnishLocationG1, validateFurnishingsG1 } from '../furnishing-g1';
import { buildAttempt } from './build';
import { FAMILIES } from './families';
import { plausibilityReport } from './plausibility';
import { Rand } from './rand';
import type { FamilySpec } from './types';

/** Attempts per draw stream before falling back to the family's known-good seed. */
export const MAX_ATTEMPTS = 80;
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

/** An accepted building: the plan the game stores and the same plan after furnishLocationG1. */
export interface GeneratedBuilding {
  plain: LocationDefinition;
  furnished: LocationDefinition;
}

/** Room tags that follow from what the furniture is (a register holds valuables, a sofa gives cover). */
const FURNITURE_TAGS = ['valuables', 'hazard', 'concealment', 'cover'];

/**
 * Every room (at its centroid) and every staging point that a squad cannot reach from the centroid
 * of some entry zone, routed as squad moves are (`routeBetween`, physical clearance on the
 * furnished form). `ids` are `room:<id>` and `point:<staging id>`.
 */
export function unreachableFromEntries(loc: LocationDefinition): string[] {
  const derived = deriveLocation(loc), built = { location: loc, derived, issues: [] };
  const targets = [...loc.rooms.map((r) => ({ id: `room:${r.id}`, space: r.id, at: derived.spaces[r.id].centroid })),
    ...derived.stagingPoints.map((p) => ({ id: `point:${p.id}`, space: p.spaceId, at: p.at }))];
  const out = new Set<string>();
  for (const entry of loc.entries) {
    const from = derived.spaces[entry]?.centroid;
    if (!from) continue;
    for (const t of targets) if (!out.has(t.id) && !routeBetween(built, entry, from, t.space, t.at, null).reachable) out.add(t.id);
  }
  return [...out];
}

/** Unreachable targets split by cause: `furniture` ones are reachable on the same plan with its
 * rooms emptied; `plan` ones are not (an entry zone's centre inside a shrub, a two-foot strip of
 * forecourt, a room joined only through the yard), so the generator, not furnishing, owns them. */
export function reachLosses(furnished: LocationDefinition): { furniture: string[]; plan: string[] } {
  const lost = unreachableFromEntries(furnished);
  if (!lost.length) return { furniture: [], plan: [] };
  const rooms = new Set(furnished.rooms.map((r) => r.id));
  const plan = unreachableFromEntries({ ...furnished, objects: furnished.objects.filter((o) => !rooms.has(o.in)) });
  return { furniture: lost.filter((id) => !plan.includes(id)), plan };
}

/**
 * Furnish a candidate with furnishLocationG1 and accept it only when the furnished result is as
 * clean as the plan: plausible with its furniture, every room holding its kit's essentials, no
 * furnishing diagnostics (which include every door approach clear and joined), and no validator
 * issue (warnings included) on either form. Null names nothing; `bump` records why.
 */
function accept(plain: LocationDefinition, bump: (reason: string) => void): GeneratedBuilding | null {
  // The structural checks need no furniture, so a cheap pass rejects most bad draws before the solve.
  const pre = plausibilityReport(plain, false);
  if (!pre.pass) return reject(pre.notes, bump);
  const furnished = furnishLocationG1(plain);
  // furnishLocationG1 does not read room tags, so adding these to both forms keeps furnished
  // equal to furnishLocationG1(plain); the family suite (suite.ts) checks that.
  for (const [i, room] of furnished.rooms.entries()) {
    const extra = FURNITURE_TAGS.filter((t) => !room.tags.includes(t) && furnished.objects.some((o) => o.in === room.id && o.tags.includes(t)));
    room.tags.push(...extra);
    plain.rooms[i].tags.push(...extra);
  }
  const rep = plausibilityReport(furnished);
  if (!rep.pass) return reject(rep.notes, bump);
  // Squad reachability: routeBetween walks furnished rooms between staging points, stair ends
  // and room centroids with one foot of clearance. validateFurnishingsG1 proves each furnished
  // room keeps all of those points (window points aside) clear and joined at that clearance, and
  // every door's approach clear, so furniture cannot cut a route the bare plan had. That local
  // proof costs a few milliseconds; routing every target from every entry costs 50-250 ms per
  // building, so reachLosses is checked by the tests (furnishing-g1.test.ts) instead.
  const diag = validateFurnishingsG1(furnished)[0];
  if (diag) {
    bump(`furnishing ${diag.replace(/^[^:]*: /, '')}`);
    return null;
  }
  const short = furnishingShortfallsG1(furnished)[0];
  if (short) {
    bump(`kit ${short.replace(/[a-z_]+_\d+|^[a-z_]+(?=:)/g, (m) => m.replace(/_\d+$/, ''))}`);
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
