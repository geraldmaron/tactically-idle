// Test helper: the engine's house call (house-fixture.ts), hosted on a generated building and
// registered under its own id, so engine tests can start, play and save it like any call without
// reading the shipping barricade. Tests only.
import { SCENARIOS } from '../../../content/scenarios';
import type { ScenarioDefinition } from '../../../sim/scenario-types';
import { drawIncidentSpec, generateIncident } from '../index';
import { HOUSE_TEMPLATE } from './house-fixture';

/** `n` house calls drawn from `seed` the way the board draws barricades, each hosted by the house
 * fixture as the board hosts the shipping one, and registered. */
export function houseCalls(n: number, seed = 5150): ScenarioDefinition[] {
  const out: ScenarioDefinition[] = [];
  let state = seed;
  for (let tries = 0; out.length < n && tries < 50 * n; tries++) {
    const drawn = drawIncidentSpec(state, { level: 10, trust: 90, unlockedTypes: ['barricaded'] });
    state = drawn.state;
    let call;
    try { call = generateIncident(drawn.spec, HOUSE_TEMPLATE); } catch { continue; }
    const id = `house:${call.id}`;
    SCENARIOS[id] ??= { ...call, id };
    out.push(SCENARIOS[id]);
  }
  if (out.length < n) throw new Error(`Only ${out.length} of ${n} house calls hosted from seed ${seed}`);
  return out;
}
