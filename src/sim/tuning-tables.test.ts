import { describe, expect, it } from 'vitest';
import { TUNED_TABLES } from './tuning-tables';
import { registeredTables, tuningLayers, validatePatch, type TuningPatch } from './tuning';
import savedJson from './tuning.json';
import { RESOLUTION_TUNING } from './resolution';
import { EXPERIENCE_TUNING, STRESS_TUNING } from './officer';
import { SPATIAL_TUNING } from './spatial-factors';
import { ROSTER_TUNING } from './roster';
import { INCIDENT_TUNING } from './incidents';
import { CLOCK_RULES_V1 } from './clocks';
import { FORCE_RISK_V1 } from './force-risk';
import { CAREER_TUNING, LEARNING_MULTIPLIER } from './career';
import { DEVELOP_TUNING } from './develop';
import { THREAT_TUNING } from './threat';
import { ENV_TUNING } from './environment';
import { OUTCOME_SCORE_V1 } from './outcome-score';
import { AUTHORIZATION_V1 } from './authorization';
import { INCIDENT_CLASS_V1 } from './incident-factors';
import { CASCADE_V1, INCOMING_FIRE_V1, TEAM_FORCE_V1 } from './drawn-effects';
import { METERS_V1 } from './meters';
import { ECONOMY_TUNING } from './economy';
import { EQUIPMENT_TUNING } from './equipment';
import { RECRUIT_TUNING } from '../content/recruits';

// The tuning registry over the real tables (spec 7.1, 7.4): every table is registered, the committed
// tuning.json validates and is what the tables hold, read-only fields refuse a patch with their
// reason, and each guard refuses values the engine can't use. CI fails here if tuning.json has any
// problem.

const LIVE: Record<string, object> = {
  RESOLUTION_TUNING, EXPERIENCE_TUNING, STRESS_TUNING, SPATIAL_TUNING, ROSTER_TUNING, INCIDENT_TUNING, CLOCK_RULES_V1, FORCE_RISK_V1, CAREER_TUNING,
  LEARNING_MULTIPLIER, DEVELOP_TUNING, THREAT_TUNING, ENV_TUNING, OUTCOME_SCORE_V1, AUTHORIZATION_V1, INCIDENT_CLASS_V1, INCOMING_FIRE_V1,
  TEAM_FORCE_V1, CASCADE_V1, METERS_V1, ECONOMY_TUNING, EQUIPMENT_TUNING, RECRUIT_TUNING,
};

/** Every leaf under `value` as [path, value]; a list is one leaf. */
function leaves(value: unknown, path: string): [string, unknown][] {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.entries(value).flatMap(([key, item]) => leaves(item, `${path}.${key}`)) : [[path, value]];
}
const at = (table: object, path: string) => path.split('.').slice(1).reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], table);

describe('the registry', () => {
  it('registers every table spec 7.4 wraps, and nothing else', () => {
    expect(TUNED_TABLES).toHaveLength(23);
    expect(registeredTables()).toEqual([...TUNED_TABLES].sort());
    expect(Object.keys(LIVE).sort()).toEqual([...TUNED_TABLES].sort());
  });

  it('starts every table from its source values plus the committed tuning.json', () => {
    const { defaults, saved } = tuningLayers();
    expect(saved).toEqual(savedJson);
    for (const name of TUNED_TABLES) for (const [path, value] of leaves(defaults[name], name)) {
      const committed = leaves((savedJson as TuningPatch)[name] ?? {}, name).find(([leaf]) => leaf === path)?.[1];
      expect(at(LIVE[name], path), path).toEqual(committed ?? value);
    }
  });
});

describe('the committed tuning.json', () => {
  it('validates against the tables', () => {
    expect(validatePatch(savedJson as TuningPatch)).toEqual([]);
  });

  it('names only tuned tables, with number, boolean, string or number-list values (what the save endpoint accepts)', () => {
    for (const [name, table] of Object.entries(savedJson as TuningPatch)) {
      expect(TUNED_TABLES).toContain(name);
      for (const [path, value] of leaves(table, name))
        expect(['number', 'boolean', 'string'].includes(typeof value) || (Array.isArray(value) && value.every(item => typeof item === 'number')), path).toBe(true);
    }
  });
});

describe('read-only fields', () => {
  it.each([
    ['ROSTER_TUNING.maxSquads', { ROSTER_TUNING: { maxSquads: 5 } }, 'structural'],
    ['AUTHORIZATION_V1.believed', { AUTHORIZATION_V1: { believed: ['confirmed', 'confirmed'] } }, 'structural'],
    ['AUTHORIZATION_V1.concessions.allowed', { AUTHORIZATION_V1: { concessions: { allowed: ['food', 'water', 'phone', 'statement', 'message', 'third_party', 'weapons'] } } }, 'structural'],
    ['AUTHORIZATION_V1.deadlyForce.guns', { AUTHORIZATION_V1: { deadlyForce: { guns: ['handgun', 'edged'] } } }, 'structural'],
    ['AUTHORIZATION_V1.deadlyForce.inReach', { AUTHORIZATION_V1: { deadlyForce: { inReach: ['edged', 'none'] } } }, 'structural'],
  ] as const)('%s refuses a patch, saying why', (path, patch, kind) => {
    const problems = validatePatch(patch as unknown as TuningPatch);
    expect(problems).toHaveLength(1);
    expect(problems[0].path.startsWith(path) || path.startsWith(problems[0].path)).toBe(true);
    expect(problems[0].reason).toMatch(new RegExp(`^Read-only \\(${kind}\\): `));
  });

  it('keeps generation-time tables out of the registry entirely', () => {
    for (const name of ['TIER_REWARD_MULTIPLIERS', 'IDENTITY_DEFAULT', 'LOCATION_TUNING', 'STRESS_BANDS', 'COMMAND_STAFF', 'EQUIPMENT_MANAGER'])
      expect(validatePatch({ [name]: {} }).map(problem => problem.path)).toEqual([name]);
  });

  it('lets the tunable neighbours of a read-only field through', () => {
    expect(validatePatch({ SPATIAL_TUNING: { coverHard: 7 }, ROSTER_TUNING: { squadSize: 5 }, AUTHORIZATION_V1: { deadlyForce: { reachFt: 12 } } })).toEqual([]);
  });
});

describe('guards', () => {
  const refused = (patch: TuningPatch) => validatePatch(patch).some(problem => problem.path === Object.keys(patch)[0]);
  it('keeps the band tails, the span and the band thresholds usable (RESOLUTION_TUNING)', () => {
    expect(refused({ RESOLUTION_TUNING: { setbackChance: 0.004 } })).toBe(true);
    expect(refused({ RESOLUTION_TUNING: { luckChance: 0 } })).toBe(true);
    expect(refused({ RESOLUTION_TUNING: { setbackChance: 0.005, luckChance: 0.005 } })).toBe(false);
    expect(refused({ RESOLUTION_TUNING: { setbackChance: 0.6, luckChance: 0.5 } })).toBe(true);
    expect(refused({ RESOLUTION_TUNING: { span: 0 } })).toBe(true);
    expect(refused({ RESOLUTION_TUNING: { favorableAt: RESOLUTION_TUNING.adverseAt } })).toBe(true);
    expect(refused({ RESOLUTION_TUNING: { favorableAt: -11, adverseAt: -12 } })).toBe(false);
    expect(refused({ RESOLUTION_TUNING: { riskBands: { moderateAt: RESOLUTION_TUNING.riskBands.lowAt + 0.01 } } })).toBe(true);
  });

  it('keeps floors under ceilings and ranges in order', () => {
    expect(refused({ CASCADE_V1: { floor: CASCADE_V1.ceiling + 0.01 } })).toBe(true);
    expect(refused({ CASCADE_V1: { ceiling: 1.1 } })).toBe(true);
    expect(refused({ INCOMING_FIRE_V1: { floor: INCOMING_FIRE_V1.ceiling + 0.01 } })).toBe(true);
    expect(refused({ INCOMING_FIRE_V1: { serious: { handgun: 1.2 } } })).toBe(true);
    expect(refused({ INCIDENT_TUNING: { minIntervalMs: INCIDENT_TUNING.maxIntervalMs + 1 } })).toBe(true);
    expect(refused({ INCIDENT_TUNING: { minLifetimeMs: 0 } })).toBe(true);
    expect(refused({ EQUIPMENT_TUNING: { wearRateMin: EQUIPMENT_TUNING.wearRateMax + 0.05 } })).toBe(true);
    expect(refused({ CAREER_TUNING: { favorableAt: CAREER_TUNING.adverseBelow - 0.05 } })).toBe(true);
    expect(refused({ CASCADE_V1: { floor: 0.1, ceiling: 0.9 }, INCOMING_FIRE_V1: { ceiling: 0.95 } })).toBe(false);
  });
});
