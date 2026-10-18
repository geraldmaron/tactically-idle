import { afterEach, describe, expect, it } from 'vitest';
import { drawnKeys } from './drawn-effects';
import { FORCE_RISK_V1, forceRiskProblem, forceSeverity } from './force-risk';
import type { ScenarioDefinition } from './scenario-types';
import { applyTuningPatch, validatePatch, withTuning } from './tuning';

// FORCE_RISK_V1's guard (spec 7.1): a profile that can kill keeps fatal above 0 and one that can't
// keeps it at 0, since the call trees carry a `<profile>:fatal` result exactly for those (drawnKeys);
// and every profile keeps 0 ≤ fatal < serious < wounded ≤ 1.

afterEach(() => { applyTuningPatch({}); });

const refused = (patch: Record<string, unknown>) => validatePatch({ FORCE_RISK_V1: patch }).some(problem => problem.path === 'FORCE_RISK_V1');

describe('FORCE_RISK_V1 guard', () => {
  it('passes the defaults', () => {
    expect(forceRiskProblem(FORCE_RISK_V1)).toBeNull();
    expect(validatePatch({ FORCE_RISK_V1: {} })).toEqual([]);
  });

  it('never lets fatal cross 0, either way', () => {
    expect(refused({ hands: { fatal: 0.01 } })).toBe(true);
    for (const profile of ['firearm', 'less_lethal_device', 'less_lethal_impact'] as const) expect(refused({ [profile]: { fatal: 0 } }), profile).toBe(true);
    expect(refused({ firearm: { fatal: 0.1 }, less_lethal_device: { fatal: 0.001 } })).toBe(false);
  });

  it('keeps fatal < serious < wounded ≤ 1', () => {
    const { firearm, less_lethal_impact: impact } = FORCE_RISK_V1;
    expect(refused({ firearm: { fatal: firearm.serious } })).toBe(true);
    expect(refused({ firearm: { serious: firearm.wounded } })).toBe(true);
    expect(refused({ less_lethal_impact: { serious: impact.fatal / 2 } })).toBe(true);
    expect(refused({ hands: { serious: 0 } })).toBe(true);
    expect(refused({ hands: { wounded: 1.2 } })).toBe(true);
    expect(refused({ firearm: { fatal: -0.1 } })).toBe(true);
    expect(refused({ firearm: { fatal: 0.3, serious: 0.5, wounded: 1 } })).toBe(false);
  });

  it('refuses a new profile key: the profiles are structure', () => {
    expect(validatePatch({ FORCE_RISK_V1: { taser: { fatal: 0.01 } } }).map(problem => problem.path)).toEqual(['FORCE_RISK_V1.taser']);
  });

  it('leaves the table as it was when a patch is refused, and applies one that passes', () => {
    const before = structuredClone(FORCE_RISK_V1);
    const lower = before.firearm.fatal / 2, sample = before.firearm.fatal * 0.75;
    applyTuningPatch({ FORCE_RISK_V1: { hands: { fatal: 0.05 }, firearm: { fatal: lower } } });
    expect(FORCE_RISK_V1).toEqual(before);
    withTuning({ FORCE_RISK_V1: { firearm: { fatal: lower } } }, () => {
      expect(FORCE_RISK_V1.firearm.fatal).toBe(lower);
      expect(forceSeverity('firearm', sample)).toBe('serious');
    });
    expect(forceSeverity('firearm', sample)).toBe('fatal');
  });

  it('matches what the call trees carry: a fatal result exactly where fatal > 0', () => {
    const keys = drawnKeys({ drawn: { model: 'team_force', on: 'p' } }, { incidentPeople: [] } as unknown as ScenarioDefinition);
    for (const [profile, risk] of Object.entries(FORCE_RISK_V1)) expect(keys.includes(`${profile}:fatal`), profile).toBe(risk.fatal > 0);
  });
});
