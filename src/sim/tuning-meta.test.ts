import { describe, expect, it } from 'vitest';
import { TUNED_TABLES } from './tuning-tables';
import { PINNED_BY, READONLY_TABLES, TUNING_META, type FieldMeta } from './tuning-meta';
import { registeredTables, tuningLayers, validatePatch, type TuningPatch } from './tuning';
import { LOCATION_TUNING } from './location';
import { TIER_REWARD_MULTIPLIERS } from '../content/incidents/rewards';

// TUNING_META is what the lab's Tuning surface shows: one entry per leaf of every registered table,
// with a plain label, help, a group, the read mode, a range for anything editable, why for anything
// read-only or unused, and the test files that pin the values.

interface NodeFs { existsSync(path: string): boolean }
const node = (globalThis as unknown as { process: { cwd(): string; getBuiltinModule(id: 'node:fs'): NodeFs } }).process;

const { defaults } = tuningLayers();
function leaves(value: unknown, path: string): [string, unknown][] {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.entries(value).flatMap(([key, item]) => leaves(item, `${path}.${key}`)) : [[path, value]];
}
const LEAVES = new Map(TUNED_TABLES.flatMap(name => leaves(defaults[name], name)));
const META = new Map(TUNING_META.map(meta => [meta.path, meta]));
const EDITABLE: FieldMeta['mode'][] = ['live', 'new-entities', 'department', 'display'];
/** A patch that sets one path to the value it already has. */
function samePatch(path: string): TuningPatch {
  const [table, ...keys] = path.split('.');
  const inner = keys.reduceRight<unknown>((value, key) => ({ [key]: value }), LEAVES.get(path));
  return { [table]: inner as Record<string, unknown> };
}

describe('TUNING_META', () => {
  it('has one entry for every leaf of every registered table, and nothing else', () => {
    expect(TUNING_META).toHaveLength(META.size);
    expect([...META.keys()].sort()).toEqual([...LEAVES.keys()].sort());
  });

  it('labels and explains every field in plain words, once', () => {
    const labels = new Set<string>();
    for (const meta of TUNING_META) {
      expect(meta.label.trim(), meta.path).not.toBe('');
      expect(meta.help.trim(), meta.path).not.toBe('');
      expect(labels.has(meta.label), `label used twice: ${meta.label}`).toBe(false);
      labels.add(meta.label);
      expect(['odds', 'pressure', 'subjects', 'harm', 'time', 'debrief', 'strain', 'economy', 'flow']).toContain(meta.group);
      // Lab text, but kept to the game's prose rules: no dashes standing in for punctuation.
      expect(`${meta.label} ${meta.help} ${meta.why ?? ''}`, meta.path).not.toMatch(/[—–]| - /);
    }
  });

  it('gives every editable number a range its default sits in, and names each value of a list', () => {
    for (const meta of TUNING_META.filter(entry => EDITABLE.includes(entry.mode))) {
      const value = LEAVES.get(meta.path);
      const values = Array.isArray(value) ? value : [value];
      expect(values.every(item => typeof item === 'number'), meta.path).toBe(true);
      expect(meta.min! < meta.max! && meta.step! > 0, meta.path).toBe(true);
      for (const item of values as number[]) expect(item >= meta.min! && item <= meta.max!, `${meta.path} = ${item} in ${meta.min}..${meta.max}`).toBe(true);
      if (Array.isArray(value)) expect(meta.items?.length, meta.path).toBe(value.length);
    }
  });

  it('says why for every field the lab won\'t edit', () => {
    for (const meta of TUNING_META.filter(entry => !EDITABLE.includes(entry.mode))) expect(meta.why?.trim(), meta.path).toBeTruthy();
  });

  it('marks the fields the game never reads as dead (spec 7.4)', () => {
    const dead = TUNING_META.filter(meta => meta.mode === 'dead').map(meta => meta.path);
    for (const path of ['RECRUIT_TUNING.rookieService', 'AUTHORIZATION_V1.entry.rules', 'THREAT_TUNING.harmRate', 'THREAT_TUNING.barricadeRate',
      'THREAT_TUNING.civilian.execution', 'THREAT_TUNING.mixedShare',
      'ENV_TUNING.crowd.outside', 'ENV_TUNING.keyholderScore', 'ENV_TUNING.fire.score'])
      expect(dead, path).toContain(path);
    // The threat rules' strain and time multipliers reach the evaluation (incident-factors.ts).
    for (const path of ['THREAT_TUNING.strainExecution', 'THREAT_TUNING.strainOther', 'THREAT_TUNING.strainCap', 'THREAT_TUNING.barricadeSlow'])
      expect(dead, path).not.toContain(path);
    // Of ENV_TUNING, the light and the weather a signal carries through (environment.ts signalCarry)
    // and the dark's observation difficulty are read.
    expect(TUNING_META.filter(meta => meta.path.startsWith('ENV_TUNING.') && meta.mode !== 'dead').map(meta => meta.path))
      .toEqual(['ENV_TUNING.light.dusk', 'ENV_TUNING.light.night', 'ENV_TUNING.light.powerOff',
        'ENV_TUNING.observationDifficulty.dusk', 'ENV_TUNING.observationDifficulty.night', 'ENV_TUNING.observationDifficulty.powerOff',
        ...['clear', 'rain', 'wind', 'fog', 'snow'].map(weather => `ENV_TUNING.weatherSound.${weather}`), ...['clear', 'rain', 'wind', 'fog', 'snow'].map(weather => `ENV_TUNING.weatherVisual.${weather}`)]);
  });

  it('marks every field the registry refuses as generation or structural, and lists of names as read-only', () => {
    for (const meta of TUNING_META) {
      const refused = validatePatch(samePatch(meta.path)).find(problem => problem.reason.startsWith('Read-only ('));
      if (refused) expect(refused.reason.startsWith(`Read-only (${meta.mode})`), meta.path).toBe(true);
      const value = LEAVES.get(meta.path);
      if (Array.isArray(value) && value.some(item => typeof item !== 'number')) expect(['structural', 'dead'], meta.path).toContain(meta.mode);
    }
    expect(META.get('ROSTER_TUNING.maxSquads')?.mode).toBe('structural');
    expect(META.get('FORCE_RISK_V1.hands.fatal')?.mode).toBe('structural');
    expect(META.get('RESOLUTION_TUNING.riskBands.lowAt')?.mode).toBe('display');
  });

  it('lists test files that exist as the pins for each table, with the balance gate on every table a call reads', () => {
    const fs = node.getBuiltinModule('node:fs');
    expect(Object.keys(PINNED_BY).sort()).toEqual([...TUNED_TABLES].sort());
    for (const file of new Set(Object.values(PINNED_BY).flat())) expect(fs.existsSync(`${node.cwd()}/${file}`), file).toBe(true);
    for (const meta of TUNING_META) expect(meta.pinnedBy).toBe(PINNED_BY[meta.path.split('.')[0]]);
    const callTime = new Set(TUNING_META.filter(meta => meta.mode === 'live').map(meta => meta.path.split('.')[0]));
    for (const table of callTime) expect(PINNED_BY[table], table).toContain('src/gen/incident/trees-v13/call-tree-balance.test.ts');
    expect(PINNED_BY.RESOLUTION_TUNING).toContain('src/sim/resolution.test.ts');
    expect(PINNED_BY.METERS_V1).toContain('src/sim/meters.test.ts');
    expect(PINNED_BY.OUTCOME_SCORE_V1).toContain('src/sim/outcome-score.test.ts');
    expect(PINNED_BY.FORCE_RISK_V1).toContain('src/sim/force-risk.test.ts');
  });
});

describe('READONLY_TABLES', () => {
  it('lists the tables left unwrapped in v1, each with its values and why, none of them registered', () => {
    expect(READONLY_TABLES.map(entry => entry.name)).toEqual(['LOCATION_TUNING', 'STRESS_BANDS', 'COMMAND_STAFF', 'EQUIPMENT_MANAGER', 'TIER_REWARD_MULTIPLIERS', 'IDENTITY_DEFAULT', 'COVER_REACH']);
    for (const entry of READONLY_TABLES) {
      expect(registeredTables()).not.toContain(entry.name);
      expect(entry.why.trim()).not.toBe('');
      expect(entry.values).toBeTruthy();
    }
    expect(READONLY_TABLES[0].values).toBe(LOCATION_TUNING);
    expect(READONLY_TABLES.find(entry => entry.name === 'TIER_REWARD_MULTIPLIERS')).toMatchObject({ values: TIER_REWARD_MULTIPLIERS, mode: 'generation' });
  });
});
