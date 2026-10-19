// Fixture calls the tooling tests own (COORDINATION.md, "Tests across lanes"): a fixture template
// compiled on a real building, as the engine compiles a call, so a property can always be tested
// on a subject the tooling controls when no shipped call has one. Register the result with
// withDraftScenario (engine-driver.ts) for as long as a test plays it.
import type { CallTree, TreeChoice } from '../../../content/call-trees/types';
import type { IncidentTemplate } from '../../../content/incidents/types';
import type { CertId } from '../../../sim/types';
import { buildLocation } from '../../../sim/location';
import type { ScenarioDefinition } from '../../../sim/scenario-types';
import { generateIncident } from '../index';
import { compileIncident, drawInstance, hostedSpec } from '../instance';
import { memberCounts } from '../trees-v13/compile';
import { GROUP_TEMPLATE, GROUP_TREE } from '../trees-v13/group-fixture';

/** The first hostage call seed on market_row 7 that draws `members` others, compiled with `template`. */
export function compileFixtureCall(template: IncidentTemplate, members = 0): ScenarioDefinition {
  for (let seed = 1; seed < 600; seed++) {
    const { clocks: _c, incidentPeople: _p, threats: _t, ...base } = generateIncident({ type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: 13 });
    const spec = hostedSpec(base), built = buildLocation(base.locationFamilyId, base.locationSeed);
    try {
      if ((memberCounts(drawInstance(template, built, spec).placed).others ?? 0) !== members) continue;
      return compileIncident({ ...base, id: `fixture-${members}-${seed}`, incident: spec }, built, template);
    } catch { continue; }
  }
  throw new Error(`No seed hosts the fixture with ${members} others`);
}

export const CERT_FIXTURE = { cert: 'vehicle_operations' as CertId, choice: 'screen_door' } as const;

/** The group fixture with a root choice that needs a certification the reference squad lacks. */
export function certFixtureTemplate(): IncidentTemplate {
  const tree: CallTree = structuredClone(GROUP_TREE);
  const root = tree.nodes.find(node => node.id === tree.root)!;
  const base = root.choices[0];
  const gated: TreeChoice = { ...structuredClone(base), id: CERT_FIXTURE.choice, title: 'Screen the door with the vehicle', requires: { certs: [CERT_FIXTURE.cert] } };
  root.choices.push(gated);
  return { ...GROUP_TEMPLATE, tree };
}
