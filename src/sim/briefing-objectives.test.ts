import { describe, expect, it, vi } from 'vitest';
import type { ScenarioDefinition } from './scenario-types';

const fixture = vi.hoisted(() => ({ scenario: null as ScenarioDefinition | null }));
vi.mock('./scenario-registry', async (original) => {
  const real = await original<typeof import('./scenario-registry')>();
  return { ...real, getScenario: (id: string) => (id === 'objective_fixture' ? fixture.scenario : real.getScenario(id)) };
});

import { getScenario } from './scenario-registry';
import { briefing, callTier } from './operation-selectors';
import { SCENARIO_TYPES } from '../content/scenario-types';
import { incidentId, INCIDENT_CONTENT_VERSION } from '../gen/incident';

describe('briefing objectives', () => {
  it('carries each objective as an id and label, in authored order', () => {
    const base = structuredClone(getScenario('ms_occupancy')!);
    base.objectives = [{ id: 'second_person', label: 'Get the second person out' }, { id: 'first_person', label: 'Get the first person out' }, { id: 'subject', label: 'Bring the subject out alive' }];
    fixture.scenario = base;
    const brief = briefing('objective_fixture');
    expect(brief.objectiveRefs).toHaveLength(3);
    expect(brief.objectiveRefs[0]).toMatchObject({ id: 'second_person', label: 'Get the second person out' });
    expect(brief.objectiveRefs[1]).toMatchObject({ id: 'first_person' });
    expect(brief.objectiveRefs[2]).toMatchObject({ id: 'subject' });
    expect(brief.objectives).toEqual(brief.objectiveRefs.map((o) => o.label));
  });

  it('is empty for an unknown scenario', () => {
    expect(briefing('no_such_scenario').objectiveRefs).toEqual([]);
  });
});

describe('callTier', () => {
  it('reads the tier from a generated call id and is null for any other id', () => {
    const spec = { type: SCENARIO_TYPES[0].type, familyId: SCENARIO_TYPES[0].families[0], buildingSeed: 12, seed: 34, tier: 3, contentVersion: INCIDENT_CONTENT_VERSION };
    expect(callTier(incidentId(spec))).toBe(3);
    expect(callTier(incidentId({ ...spec, tier: 5 }))).toBe(5);
    expect(callTier('ms_occupancy')).toBeNull();
    expect(callTier(incidentId({ ...spec, tier: 6 }))).toBeNull();
  });
});
