// Test helpers: an engine fixture (house-fixture.ts, armed-fixture.ts, rescue-fixture.ts) hosted on
// generated buildings and registered under its own ids, so engine tests can start, play and save it
// like any call without reading the shipping calls. Tests only.
import { SCENARIOS } from '../../../content/scenarios';
import type { IncidentTemplate } from '../../../content/incidents/types';
import type { IncidentSpec, ScenarioDefinition } from '../../../sim/scenario-types';
import { next } from '../../../sim/rng';
import { generateIncident, INCIDENT_CONTENT_VERSION } from '../index';
import { HOUSE_TEMPLATE } from './house-fixture';

/** `n` calls of `template` drawn from `seed`, each hosted the way the board hosts a shipping call,
 * and registered as `<prefix>:<generated id>`. Drawn from the fixture's own families, so its type
 * needn't be on the board. `tier` fixes the tier; otherwise it is drawn. */
export function fixtureCalls(template: IncidentTemplate, n: number, seed: number, prefix: string, tier?: number): ScenarioDefinition[] {
  const out: ScenarioDefinition[] = [];
  let state = seed;
  for (let tries = 0; out.length < n && tries < 50 * n; tries++) {
    const family = next(state), building = next(family.state), callSeed = next(building.state), drawnTier = next(callSeed.state);
    state = drawnTier.state;
    const families = template.tree.families;
    const spec: IncidentSpec = { type: template.type, familyId: families[Math.floor(family.value * families.length)],
      buildingSeed: Math.floor(building.value * 0x100000000), seed: Math.floor(callSeed.value * 0x100000000), tier: tier ?? 1 + Math.floor(drawnTier.value * 5), contentVersion: INCIDENT_CONTENT_VERSION };
    let call;
    try { call = generateIncident(spec, template); } catch { continue; }
    const id = `${prefix}:${call.id}`;
    SCENARIOS[id] ??= { ...call, id };
    out.push(SCENARIOS[id]);
  }
  if (out.length < n) throw new Error(`Only ${out.length} of ${n} ${prefix} calls hosted from seed ${seed}`);
  return out;
}

/** `n` house calls drawn from `seed`, registered. */
export function houseCalls(n: number, seed = 5150): ScenarioDefinition[] {
  return fixtureCalls(HOUSE_TEMPLATE, n, seed, 'house');
}
