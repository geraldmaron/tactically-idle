import { describe, expect, it } from 'vitest';
import { hashSeed } from '../../sim/rng';
import { scenarioActions, type IncidentSpec } from '../../sim/scenario-types';
import { generateIncident, INCIDENT_TYPES_V2 } from './index';

// Public copy may change without changing an issued incident's mechanics.
const copyFields = new Set(['title', 'summary', 'label', 'task', 'prompt', 'claim', 'note', 'uncertainty', 'markers', 'resolved', 'reportedText', 'markerSource', 'briefing', 'pressureLabel', 'text', 'reason', 'blockedReason', 'lockedNote', 'noun', 'outcomePreview']);
function mechanics(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(mechanics);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !copyFields.has(key)).map(([key, child]) => [key, mechanics(child)]));
  return value;
}

const incident = (type: IncidentSpec['type'], seed = 7) => generateIncident({ type, familyId: 'cedar_close', seed, buildingSeed: 7, tier: 2, contentVersion: 3 });
const choice = (type: IncidentSpec['type'], id: string, seed = 7) => scenarioActions(incident(type, seed)).find(action => action.id === id)!;

describe('plain-language incident choices', () => {
  it('describes every attempted action separately from its best-case forecast', () => {
    for (const type of ['welfare_check', 'medical_complication', 'barricaded'] as const) for (const seed of [0, 1, 2, 3, 4, 5]) {
      const scenario = incident(type, seed);
      for (const action of scenarioActions(scenario)) {
        expect(action.summary, action.id).not.toBe(action.outcomePreview!.favorable);
        expect(action.summary, action.id).not.toMatch(/\b(?:qualified|accompanied|verified|context-gated)\b|checked account|follow-through/i);
        expect(action.title, action.id).not.toMatch(/checked account|accompanied|follow-through|qualified|resolution plan/i);
      }
      for (const stage of Object.values(scenario.stages)) expect(stage.prompt).not.toMatch(/context|verified|explicitly|follow-through/i);
    }
  });

  it('warns about the unprepared visit cost without revealing who is there or needs help', () => {
    const visit = choice('welfare_check', 'v3_welfare_visit');
    expect(visit.summary).toContain('Without a visit arranged');
    expect(visit.summary).toContain('adds 4 minutes and costs 3 safety points');
    expect(visit.summary).toContain('whether anyone is there and needs help');
    for (const effects of Object.values(visit.outcomes)) expect(effects).toContainEqual(expect.objectContaining({ when: { notFlags: ['welfare_visit_ready'] }, extraMinutes: 4, civilian: -3 }));
  });

  it('keeps a good result conditional when moving the person might be unsuitable', () => {
    const transfer = choice('medical_complication', 'assist_protected_transfer');
    expect(transfer.outcomePreview!.favorable).toContain('If moving is suitable');
    expect(transfer.outcomePreview!.favorable).toContain('Otherwise, stop');
    expect(transfer.summary).toMatch(/^Try to move/);
  });

  it('keeps missing checks and care arrangements visible in handover forecasts', () => {
    const care = choice('medical_complication', 'assist_informed_handover').outcomePreview!;
    for (const band of ['favorable', 'mixed'] as const) {
      expect(care[band]).toMatch(/location|located/);
      expect(care[band]).toMatch(/care (?:team is )?ready|care team is ready/);
      expect(care[band]).toContain('briefed');
      expect(care[band]).toMatch(/Missing|otherwise/);
    }
    expect(choice('welfare_check', 'v3_welfare_handover').outcomePreview!.favorable).toContain('Otherwise, they still have checks to finish');
    expect(choice('barricaded', 'v3_protect_handover').outcomePreview!.favorable).toContain('Otherwise, they still have checks to finish');
  });

  it('names real supplies for equipment options and never invents one for specialist support', () => {
    const variants = new Set<string>();
    for (const seed of [0, 1, 2, 3, 4, 5]) {
      const response = choice('barricaded', 'v3_protect_qualified', seed);
      const rule = response.capabilities!.required![0];
      variants.add(rule);
      if (rule === 'specialist_support') {
        expect(response.consumes).toBeUndefined();
        expect(response.summary).toContain('separate supporting squad');
        expect([response.summary, ...Object.values(response.outcomePreview!)].join(' ')).not.toMatch(/supply|cartridge|kit/i);
      } else {
        expect(response.consumes).toHaveLength(1);
        expect(response.summary).toMatch(/one (launcher supply|cartridge)/);
      }
      expect(response.outcomePreview!.favorable).toContain('2 safety points, or 1 after a camera check');
      expect(response.outcomePreview!.mixed).toContain('6 safety points, or 4 after a camera check');
      expect(response.outcomePreview!.adverse).toContain('12 safety points, or 9 after a camera check');
    }
    expect(variants).toEqual(new Set(['less_lethal_impact', 'less_lethal_device', 'specialist_support']));
  });

  it('distinguishes a door charge from a reusable rescue tool in every forecast', () => {
    const variants = new Set<string>();
    for (const seed of [0, 1, 2, 3, 4, 5]) {
      const access = choice('barricaded', 'v3_protect_access', seed);
      const method = access.capabilities!.accessMethod!;
      variants.add(method);
      for (const forecast of Object.values(access.outcomePreview!)) {
        if (method === 'charge') expect(forecast).toContain('one charge');
        else expect(forecast).not.toMatch(/supply|charge/);
      }
      expect(access.outcomePreview!.favorable).toContain('route still needs checking');
    }
    expect(variants).toEqual(new Set(['mechanical', 'charge']));
  });

  it('does not suggest different results for withdrawal when all three outcomes are identical', () => {
    for (const [type, id] of [['welfare_check', 'v3_welfare_withdraw'], ['barricaded', 'v3_protect_withdraw']] as const) {
      const preview = choice(type, id).outcomePreview!;
      expect(new Set(Object.values(preview)).size).toBe(1);
      expect(preview.favorable).toContain('unresolved');
    }
  });

  it('keeps the same version-three mechanics across all incident families and equipment variants', () => {
    const fingerprints = Object.fromEntries(INCIDENT_TYPES_V2.map(kind => [kind.type, hashSeed(JSON.stringify(kind.families.flatMap(familyId => [0, 1, 2, 3, 4, 5, 7, 42, 4294967295].map(seed => mechanics(generateIncident({ type: kind.type, familyId, seed, buildingSeed: seed, tier: 1 + seed % 5, contentVersion: 3 }))))))]));
    expect(fingerprints).toEqual({ welfare_check: 3904548254, disturbance: 3985187938, medical_complication: 2342278039, burglary: 2389055677, false_intruder: 3314437100, barricaded: 3835457545, business_robbery: 2346930896 });
  });
});
