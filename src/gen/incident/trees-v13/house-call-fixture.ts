// Test helper: the engine's house call (house-fixture.ts) compiled on a generated barricade frame and
// registered under its own id, so engine tests can start, play and save it like any call without
// reading the shipping barricade. Tests only.
import { SCENARIOS } from '../../../content/scenarios';
import { buildLocation } from '../../../sim/location';
import type { ScenarioDefinition } from '../../../sim/scenario-types';
import { drawIncidentSpec, generateIncident } from '../index';
import { compileIncident, hostedSpec } from '../instance';
import { HOUSE_TEMPLATE } from './house-fixture';

/** `n` house calls drawn from `seed` the way the board draws barricades, each compiled from the house
 * fixture and registered (a frame the fixture can't host is skipped for the next draw). */
export function houseCalls(n: number, seed = 5150): ScenarioDefinition[] {
  const out: ScenarioDefinition[] = [];
  let state = seed;
  for (let tries = 0; out.length < n && tries < 50 * n; tries++) {
    const drawn = drawIncidentSpec(state, { level: 10, trust: 90, unlockedTypes: ['barricaded'] });
    state = drawn.state;
    let base;
    try { base = generateIncident(drawn.spec); } catch { continue; }
    const { clocks: _c, incidentPeople: _p, threats: _t, ...frame } = base;
    const id = `house:${frame.id}`;
    if (!SCENARIOS[id]) {
      try { SCENARIOS[id] = compileIncident({ ...frame, id, incident: hostedSpec(frame) }, buildLocation(frame.locationFamilyId, frame.locationSeed), HOUSE_TEMPLATE); } catch { continue; }
    }
    out.push(SCENARIOS[id]);
  }
  if (out.length < n) throw new Error(`Only ${out.length} of ${n} house calls hosted from seed ${seed}`);
  return out;
}
