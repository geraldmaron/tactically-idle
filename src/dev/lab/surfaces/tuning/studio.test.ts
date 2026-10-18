// The Tuning studio's model: layers, the diff and what Save writes, units, the instant tier and the
// band curve on the real engine, the group previews, the quick tier's paired summary, and the
// post-save notice.
import { describe, expect, it } from 'vitest';
import '../../../../sim/tuning-tables';
import { NOW } from '../../../../gen/incident/gates/engine-driver';
import { tuningLayers } from '../../../../sim/tuning';
import type { TuningPatch } from '../../../../sim/tuning';
import { TUNING_META } from '../../../../sim/tuning-meta';
import { emptyTally } from '../../jobs/tally';
import type { ReachTally } from '../../jobs/tally';
import { dialById, getPath } from '../../model/macros';
import { currentFrame, openSession } from '../../model/session';
import { parseLabUrl } from '../../url';
import {
  cascadeGrid, changedByGroup, meterEvents, curvePoints, diffOf, displayUnit, exposurePreview, forcePreview, formatValue, groupFields, GROUPS, instantTier, isEditable,
  normalizePatch, overridesFor, pinnedTests, quickSummary, readSavedNotice, resetToDefaults, savedNoticeFor, studioLayers, tuningFileText, unsavedFieldCount, writeSavedNotice,
} from './studio';

const { defaults } = tuningLayers();
const layersFor = (saved: TuningPatch, patch: TuningPatch) => studioLayers({ defaults, saved, patch });
const meta = (path: string) => TUNING_META.find(entry => entry.path === path)!;
const HARDER: TuningPatch = { RESOLUTION_TUNING: { favorableAt: 10, adverseAt: -10 } };

describe('layers, diff and save', () => {
  it('counts only real changes and saves a sparse file', () => {
    const layers = layersFor({}, HARDER);
    const diff = diffOf(layers);
    expect(diff.unsaved.map(state => state.meta.path).sort()).toEqual(['RESOLUTION_TUNING.adverseAt', 'RESOLUTION_TUNING.favorableAt']);
    expect(diff.overrides).toEqual([]);
    expect(overridesFor(layers)).toEqual(HARDER);
    expect(tuningFileText(overridesFor(layers))).toBe('{\n  "RESOLUTION_TUNING": {\n    "adverseAt": -10,\n    "favorableAt": 10\n  }\n}\n');
    expect(changedByGroup(layers)).toEqual({ odds: 2 });
  });

  it('drops patch leaves that equal the saved value', () => {
    const saved = layersFor(HARDER, {}).saved;
    expect(normalizePatch({ RESOLUTION_TUNING: { favorableAt: 10, span: 70 } }, saved)).toEqual({ RESOLUTION_TUNING: { span: 70 } });
    expect(normalizePatch({ RESOLUTION_TUNING: { seats: [1, 0.35, 0.2, 0.1, 0.1] } }, saved)).toEqual({});
  });

  it('Reset to defaults stages the defaults over every saved override, and saving it writes {}', () => {
    const layers = layersFor(HARDER, {});
    expect(diffOf(layers).overrides).toHaveLength(2);
    const reset = resetToDefaults(layers);
    expect(reset).toEqual({ RESOLUTION_TUNING: { favorableAt: 8, adverseAt: -12 } });
    expect(overridesFor(layersFor(HARDER, reset))).toEqual({});
    expect(tuningFileText({})).toBe('{}\n');
  });

  it('lists the tests that pin the changed tables', () => {
    const files = pinnedTests(['RESOLUTION_TUNING.favorableAt']);
    expect(files).toContain('src/sim/resolution.test.ts');
    expect(files).toContain('src/gen/incident/trees-v13/call-tree-balance.test.ts');
    expect(files).toContain('src/sim/tuning-tables.test.ts');
  });

  it('remembers what was saved for the checklist after the reload', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } };
    const notice = savedNoticeFor(layersFor({}, HARDER), 1);
    expect(notice.fields.map(field => `${field.label}: ${field.before} → ${field.after}`)).toEqual(['Goes well at: 8.0 points → 10.0 points', 'Goes badly below: −12.0 points → −10.0 points']);
    writeSavedNotice(notice, storage);
    expect(readSavedNotice(storage)).toEqual(notice);
    expect(readSavedNotice(null)).toBeNull();
  });
});

describe('the shell banner count', () => {
  it('counts only fields that differ from what the game runs on now', () => {
    expect(unsavedFieldCount(HARDER, { defaults, saved: {} })).toBe(2);
    // A leaf equal to tuning.json, or to the source default when tuning.json leaves it out, is no change.
    expect(unsavedFieldCount(HARDER, { defaults, saved: { RESOLUTION_TUNING: { favorableAt: 10 } } })).toBe(1);
    expect(unsavedFieldCount({ RESOLUTION_TUNING: { favorableAt: getPath(defaults, 'RESOLUTION_TUNING.favorableAt') as number } }, { defaults, saved: {} })).toBe(0);
    expect(unsavedFieldCount({}, { defaults, saved: HARDER })).toBe(0);
  });
});

describe('groups and units', () => {
  it('puts every field in one group, read-only fields also under Can\'t tune here, unused ones behind Show unused', () => {
    const shown = GROUPS.filter(group => group.id !== 'fixed').flatMap(group => groupFields(group.id).shown);
    const unused = GROUPS.flatMap(group => groupFields(group.id).unused);
    expect(shown.length + unused.length).toBe(TUNING_META.length);
    expect(groupFields('fixed').shown.map(entry => entry.mode).every(mode => mode === 'generation' || mode === 'structural')).toBe(true);
    expect(groupFields('fixed').shown.some(entry => entry.path === 'FORCE_RISK_V1.hands.fatal')).toBe(true);
  });

  it('gives every editable number a range and a step, so its slider and box work', () => {
    const { current } = layersFor({}, {});
    const missing = TUNING_META.filter(m => isEditable(m) && (typeof getPath(current, m.path) === 'number' || Array.isArray(getPath(current, m.path)))
      && (m.min === undefined || m.max === undefined || m.step === undefined)).map(m => m.path);
    expect(missing).toEqual([]);
  });

  it('shows chances as percents, milliseconds as minutes or hours, multiples with ×', () => {
    expect(formatValue(4, meta('ROSTER_TUNING.maxSquads'))).toBe('4');
    expect(formatValue(0.04, meta('RESOLUTION_TUNING.setbackChance'))).toBe('4.0%');
    expect(formatValue(1.2, meta('RESOLUTION_TUNING.bandTime.mixed'))).toBe('×1.20');
    expect(formatValue(1_800_000, meta('INCIDENT_TUNING.minIntervalMs'))).toBe('30 min');
    expect(formatValue(86_400_000, meta('ECONOMY_TUNING.capMs'))).toBe('24 h');
    expect(formatValue([1, 0.35, 0.2, 0.1, 0.1], meta('RESOLUTION_TUNING.seats'))).toBe('1st 100%, 2nd 35%, 3rd 20%, 4th 10%, 5th 10%');
    expect(displayUnit(meta('RESOLUTION_TUNING.span')).suffix).toBe(' points');
  });
});

describe('previews on the engine', () => {
  const opened = openSession(parseLabUrl('?type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1').url, null);
  if (!('frames' in opened)) throw new Error(opened.message);
  const state = currentFrame(opened).state;

  it('the instant tier reads this moment\'s choices before and after the patch', () => {
    const same = instantTier(state, 'A', NOW, {});
    expect(same.length).toBeGreaterThan(0);
    expect(same.every(row => !row.moved)).toBe(true);
    const harder = instantTier(state, 'A', NOW, HARDER);
    const eligible = harder.filter(row => row.eligible && row.after.margin !== null);
    expect(eligible.length).toBeGreaterThan(0);
    for (const row of eligible) {
      expect(row.after.likelihood.favorable).toBeLessThanOrEqual(row.before.likelihood.favorable + 1e-12);
      expect(row.after.likelihood.adverse).toBeGreaterThanOrEqual(row.before.likelihood.adverse - 1e-12);
      // Thresholds don't move margins.
      expect(row.after.margin).toBeCloseTo(row.before.margin!, 9);
    }
    expect(eligible.some(row => row.moved)).toBe(true);
    // The page's own tables are untouched afterwards.
    expect(instantTier(state, 'A', NOW, {}).every(row => !row.moved)).toBe(true);
  });

  it('the band curve sums to one and moves about 3.1 points at margin 0 for Difficulty +2', () => {
    const saved = curvePoints({}), harder = curvePoints(HARDER);
    expect(saved).toHaveLength(81);
    for (const point of saved) expect(point.favorable + point.mixed + point.adverse).toBeCloseTo(1, 9);
    const at0 = (points: typeof saved) => points.find(point => point.margin === 0)!;
    expect((at0(saved).favorable - at0(harder).favorable) * 100).toBeCloseTo(3.1, 1);
  });

  it('force, exposure and cascade previews follow the dials', () => {
    const base = { defaults, current: layersFor({}, {}).current };
    const force = forcePreview(dialById('lethality')!.write(2, base));
    const firearm = force.find(row => row.profile === 'firearm')!;
    expect(firearm.saved.fatal).toBeCloseTo(0.22, 9);
    expect(firearm.now.fatal).toBeCloseTo(0.44, 9);
    expect(force.find(row => row.profile === 'hands')!.now.fatal).toBe(0);
    const exposure = exposurePreview(dialById('exposure')!.write(1.2, base));
    expect(exposure.rows.find(row => row.weapon === 'handgun')).toMatchObject({ saved: 0.5, now: 0.6 });
    const events = meterEvents(layersFor({}, { METERS_V1: { events: { heard: { rapport: 14 } } } }));
    expect(events.find(row => row.event === 'heard')).toMatchObject({ label: 'Heard out', agitation: { saved: -6, now: -6 }, rapport: { saved: 10, now: 14 } });
    const cascade = cascadeGrid({ CASCADE_V1: { base: 0.35 } });
    expect(cascade.now[2][2] - cascade.saved[2][2]).toBeCloseTo(0.1, 9);
  });
});

describe('quick tier', () => {
  const tally = (classes: number[]): ReachTally => {
    const t = emptyTally();
    t.runs = classes.length;
    t.runWeights = classes;
    for (const index of classes) t.weights[(['death', 'hurt', 'unresolved', 'costly', 'clean'] as const)[index]]++;
    return t;
  };
  it('pairs runs by index and says when a delta is within noise', () => {
    // 40 runs: 10 clean runs turn costly under the patch.
    const before = tally([...Array(20).fill(4), ...Array(20).fill(3)]);
    const after = tally([...Array(10).fill(4), ...Array(30).fill(3)]);
    const summary = quickSummary(before, after);
    expect(summary.runs).toBe(40);
    const clean = summary.rows.find(row => row.weight === 'clean')!;
    expect(clean.saved.p).toBe(0.5);
    expect(clean.patch.p).toBe(0.25);
    expect(clean.delta.mean).toBeCloseTo(-0.25, 9);
    expect(clean.delta.withinNoise).toBe(false);
    expect(summary.rows.find(row => row.weight === 'death')!.delta.withinNoise).toBe(true);
    expect(summary.rows.map(row => row.weight)).toEqual(['clean', 'costly', 'unresolved', 'hurt', 'death']);
  });
});
