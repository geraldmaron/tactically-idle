// clock-only-marks: a mark whose only setter is a clock running out is declared, so a choice may
// read it. Runs on the clock fixture (gates/clock-fixture.ts), with a reader added at the root.
import { describe, expect, it } from 'vitest';
import type { IncidentTemplate } from '../../content/incidents/types';
import { buildLocation } from '../../sim/location';
import { validateScenario } from '../../sim/operation';
import { CLOCK_FIXTURE_IDS, clockFixtureTemplate } from './gates/clock-fixture';
import { generateIncident } from './index';
import { memberCounts } from './trees-v13/compile';
import { compileIncident, drawInstance, hostedSpec } from './instance';

function withRootReader(mark: string): IncidentTemplate {
  const t = clockFixtureTemplate();
  const root = t.tree.nodes[0];
  root.choices.push({ ...structuredClone(root.choices[0]), id: 'reads_mark', onlyIf: { marks: [mark] } });
  return t;
}

function validate(t: IncidentTemplate): string[] {
  for (let seed = 1; seed < 600; seed++) {
    const { clocks: _c, incidentPeople: _p, threats: _t, ...base } = generateIncident({ type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: 13 });
    const spec = hostedSpec(base), built = buildLocation(base.locationFamilyId, base.locationSeed);
    try {
      if ((memberCounts(drawInstance(t, built, spec).placed).others ?? 0) !== 0) continue;
      return validateScenario(compileIncident({ ...base, id: `clock-only-${seed}`, incident: spec }, built, t), built);
    } catch { continue; }
  }
  throw new Error('No seed draws a lone taker');
}

describe('a mark only a clock’s run-out sets (clock-only-marks)', () => {
  it('lets a choice read the clock’s run-out mark', () => {
    expect(validate(withRootReader(CLOCK_FIXTURE_IDS.outMark))).toEqual([]);
  });

  it('validates the fixture whose only reader is the node the clock routes to', () => {
    expect(validate(clockFixtureTemplate())).toEqual([]);
  });
});
