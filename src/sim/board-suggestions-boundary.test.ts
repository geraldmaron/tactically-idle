import { describe, expect, it, vi } from 'vitest';
import { CALL_TREES } from '../content/call-trees';
import { INCIDENT_CONTENT_VERSION, incidentId } from '../gen/incident';
import type { IncidentType } from './scenario-types';

// Every scenario the selector looks up comes back as a guard: reading any compiled field other than
// `incident.type` throws, so a change that derives shortages from the compiled call (its seed, its
// pruned actions, its people, facts or cast) fails here even when its output happens to match.
vi.mock('./scenario-registry', async (importOriginal) => {
  const real = await importOriginal<typeof import('./scenario-registry')>();
  const only = <T extends object>(value: T, allowed: string, inner?: (v: unknown) => unknown): T => new Proxy(value, {
    get(target, key) {
      if (key === allowed) return inner ? inner(Reflect.get(target, key)) : Reflect.get(target, key);
      if (typeof key === 'symbol' || key === 'then') return undefined;
      throw new Error(`board shortages read the compiled call field "${String(key)}"`);
    },
  });
  return {
    ...real,
    getScenario: (id: string) => {
      const scenario = real.getScenario(id);
      return scenario && only(scenario, 'incident', (incident) => incident && only(incident as object, 'type'));
    },
  };
});

const { boardShortages } = await import('./board-suggestions');
const { createInitialState } = await import('./department');

describe('board shortages boundary', () => {
  it.each(Object.keys(CALL_TREES) as IncidentType[])('%s: reads only the call type from the compiled call', (type) => {
    const state = createInitialState(1_800_000_000_000, 7);
    for (const o of Object.values(state.officers)) o.certs = [];
    const id = incidentId({ type, familyId: CALL_TREES[type]!.families[0], buildingSeed: 4242, seed: 3, tier: 2, contentVersion: INCIDENT_CONTENT_VERSION });
    expect(() => boardShortages(state, id, 1_800_000_000_000)).not.toThrow();
    expect(boardShortages(state, id, 1_800_000_000_000).length).toBeGreaterThan(0);
  });
});
