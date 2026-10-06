import { describe, it, expect } from 'vitest';
import { SCENARIO_RECIPES_V9, specForRecipe } from '../../content/scenario-recipes';
import { generateIncident, incidentId } from './index';
import fingerprints from './issued-v9-fingerprints.json';

/** v9 shipped on 2026-10-06. Its issued definitions must regenerate byte for byte;
 * later content belongs to a new content version. Never re-baseline an issued
 * version; add a new content version instead. */
const digest = async (value: unknown) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))].map(n => n.toString(16).padStart(2, '0')).join('');
export const ISSUED_V9_SPECS = SCENARIO_RECIPES_V9.flatMap(recipe => [7, 19].map(buildingSeed => specForRecipe(recipe, buildingSeed)));

describe('issued v9 scenarios', () => {
  it('regenerate every captured definition byte for byte', async () => {
    const actual: Record<string, string> = {};
    for (const spec of ISSUED_V9_SPECS) actual[incidentId(spec)] = await digest(generateIncident(spec));
    expect(Object.keys(fingerprints)).toHaveLength(200);
    expect(actual).toEqual(fingerprints);
  }, 120000);
});
