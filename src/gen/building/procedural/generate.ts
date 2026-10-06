import type { LocationDefinition } from '../../../sim/types';
import { deriveLocation } from '../../../sim/location';
import { validateLocation } from '../../../sim/location-validate';
import { buildAttempt } from './build';
import { FAMILIES } from './families';
import { plausibilityReport } from './plausibility';
import { Rand } from './rand';
import type { FamilySpec } from './types';

/** Attempts per draw stream before falling back to the family's known-good seed. */
export const MAX_ATTEMPTS = 40;

export interface AttemptStats {
  attempts: number;
  /** Rejections by stage. */
  reasons: Record<string, number>;
}

function search(spec: FamilySpec, geoSeed: number, reportSeed: number, stats?: AttemptStats): LocationDefinition | null {
  const rng = new Rand(`${spec.id}:${geoSeed}`);
  for (let k = 0; k < MAX_ATTEMPTS; k++) {
    if (stats) stats.attempts++;
    const bump = (r: string) => {
      if (stats) stats.reasons[r] = (stats.reasons[r] ?? 0) + 1;
    };
    // An unexpected exception in one draw must not take the game down; the draw is simply rejected.
    try {
      const loc = buildAttempt(spec, reportSeed, rng, stats ? bump : undefined);
      if (!loc) continue;
      const rep = plausibilityReport(loc);
      if (!rep.pass) {
        const first = rep.notes.find((n) => n.startsWith('FAIL')) ?? rep.notes[0] ?? 'score';
        bump(`plaus: ${first.replace(/[a-z_]+_\d+/g, (m) => m.replace(/_\d+$/, '')).replace(/[\d.]+/g, '#')}`);
        continue;
      }
      // Warnings (a swing blocked by furniture, a window off the wall) reject the draw too.
      const err = validateLocation(loc, deriveLocation(loc))[0];
      if (err) {
        bump(`validator ${err.code}`);
        continue;
      }
      return loc;
    } catch {
      bump('exception');
    }
  }
  return null;
}

/** Deterministic: the draw stream is seeded from hashSeed(`${familyId}:${seed}`). */
export function generate(familyId: string, seed: number, stats?: AttemptStats): LocationDefinition {
  const spec = FAMILIES.find((f) => f.id === familyId);
  if (!spec) throw new Error(`No generator for ${familyId} (seed ${seed})`);
  const loc = search(spec, seed, seed, stats);
  if (loc) return loc;
  if (stats) stats.reasons.FALLBACK = (stats.reasons.FALLBACK ?? 0) + 1;
  const fallback = search(spec, spec.fallbackSeed, seed, stats);
  if (fallback) return fallback;
  throw new Error(`No valid ${familyId} building for seed ${seed}`);
}

/** The family's known-good layout, relabelled with `seed`. Exposed so tests can prove the fallback valid. */
export function generateFallback(familyId: string, seed: number): LocationDefinition {
  const spec = FAMILIES.find((f) => f.id === familyId);
  if (!spec) throw new Error(`No generator for ${familyId}`);
  const loc = search(spec, spec.fallbackSeed, seed);
  if (!loc) throw new Error(`Fallback for ${familyId} is not valid`);
  return loc;
}
