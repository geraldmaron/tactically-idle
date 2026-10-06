import type { LocationDefinition } from '../../../sim/types';
import { applyAccess, drawUnitAccess } from './access';
import { GENERATION, GENERATIONS, publicFamilyId, type Generation } from './generation';
import { deriveLocation } from '../../../sim/location';
import { validateLocation } from '../../../sim/location-validate';
import { routeBetween } from '../../../sim/spatial-factors';
import { furnishingShortfallsG1, furnishLocationG1, validateFurnishingsG1 } from '../furnishing-g1';
import { buildAttempt } from './build';
import { FAMILIES } from './families';
import { plausibilityReport } from './plausibility';
import { Rand } from './rand';
import { GEN_VERSION, type FamilySpec } from './types';

/** Attempts per draw stream before falling back to the family's known-good seed. */
export const MAX_ATTEMPTS = 80;
/** The fallback stream is reached rarely, so it may search longer: its furnishing depends on the reported seed. */
export const FALLBACK_ATTEMPTS = 120;
export { GENERATION, GENERATIONS, LATEST_GENERATION, publicFamilyId, type Generation } from './generation';
/** Location `version` per generation (the furnished form is always 7). */
const PLAN_VERSION: Record<Generation, number> = { g1: GEN_VERSION, g2: 2 };

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

/** What a generation adds to a drawn plan before acceptance, so validation and furnishing see it.
 * g1 returns the plan untouched. The access draw has its own stream, keyed by the reported seed. */
function finishPlan(spec: FamilySpec, generation: Generation, loc: LocationDefinition, reportSeed: number): LocationDefinition {
  if (generation === 'g1') return loc;
  loc.version = PLAN_VERSION[generation];
  loc.geometry = 'exact';
  if (spec.unitLevel) applyAccess(loc, drawUnitAccess(spec.unitLevel(loc), new Rand(`${spec.id}:access:${reportSeed}`)));
  return loc;
}

function search(spec: FamilySpec, generation: Generation, geoSeed: number, reportSeed: number, attempts: number, stats?: AttemptStats): GeneratedBuilding | null {
  // Every generation walks the family's one draw stream; later generations differ in how a draw is measured and finished.
  const rng = new Rand(`${spec.id}:${geoSeed}`);
  const familyId = publicFamilyId(spec.id, generation);
  const bump = (r: string) => {
    if (stats) stats.reasons[r] = (stats.reasons[r] ?? 0) + 1;
  };
  for (let k = 0; k < attempts; k++) {
    if (stats) stats.attempts++;
    // An unexpected exception in one draw must not take the game down; the draw is simply rejected.
    try {
      const loc = buildAttempt(spec, familyId, reportSeed, rng, stats ? bump : undefined);
      if (!loc) continue;
      const done = accept(finishPlan(spec, generation, loc, reportSeed), bump);
      if (done) return done;
    } catch {
      bump('exception');
    }
  }
  return null;
}

/** The family and generation a spec id (`bungalow`, generation g1) or public id (`bungalow_g2`) names. */
export function resolveFamily(familyId: string): { spec: FamilySpec; generation: Generation } | undefined {
  for (const spec of FAMILIES) {
    if (spec.id === familyId) return { spec, generation: GENERATION };
    const generation = GENERATIONS.find((g) => publicFamilyId(spec.id, g) === familyId);
    if (generation) return { spec, generation };
  }
  return undefined;
}

/**
 * Deterministic: the draw stream is seeded from hashSeed(`${specId}:${seed}`). `familyId` is a
 * spec id (`bungalow`, meaning `bungalow_g1`) or a public id (`bungalow_g1`, `bungalow_g2`), which
 * selects the generation; the result always carries the public id.
 */
export function generatePair(familyId: string, seed: number, stats?: AttemptStats): GeneratedBuilding {
  const resolved = resolveFamily(familyId);
  if (!resolved) throw new Error(`No generator for ${familyId} (seed ${seed})`);
  const { spec, generation } = resolved;
  const found = search(spec, generation, seed, seed, MAX_ATTEMPTS, stats);
  if (found) return found;
  if (stats) stats.reasons.FALLBACK = (stats.reasons.FALLBACK ?? 0) + 1;
  const fallback = search(spec, generation, spec.fallbackSeed, seed, FALLBACK_ATTEMPTS, stats);
  if (fallback) return fallback;
  throw new Error(`No valid ${familyId} building for seed ${seed}`);
}

export function generate(familyId: string, seed: number, stats?: AttemptStats): LocationDefinition {
  return generatePair(familyId, seed, stats).plain;
}

/** The family's known-good layout stream, reported as `seed`. Exposed so tests can prove the fallback valid. */
export function generateFallback(familyId: string, seed: number): GeneratedBuilding {
  const resolved = resolveFamily(familyId);
  if (!resolved) throw new Error(`No generator for ${familyId}`);
  const found = search(resolved.spec, resolved.generation, resolved.spec.fallbackSeed, seed, FALLBACK_ATTEMPTS);
  if (!found) throw new Error(`Fallback for ${familyId} is not valid`);
  return found;
}
