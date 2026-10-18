import { describe, expect, it } from 'vitest';
import '../../../sim/tuning-tables';
import { TUNING_META } from '../../../sim/tuning-meta';
import { tuningLayers, validatePatch } from '../../../sim/tuning';
import type { TuningPatch } from '../../../sim/tuning';
import { dialById, getPath, linkedWrite, MACRO_DIALS, mergePatches, overlay, partnerOf, setPath, snap, togetherValue, unsetPath, UPSET_FLOOR } from './macros';
import type { DialLayers, MacroDial } from './macros';

const defaults = tuningLayers().defaults;
const at = (patch: TuningPatch): DialLayers => ({ defaults, current: overlay(defaults, patch) });
const base = at({});
const grid = (dial: MacroDial) => {
  const n = Math.round((dial.range[1] - dial.range[0]) / dial.step);
  return Array.from({ length: n + 1 }, (_, i) => snap(dial.range[0] + i * dial.step, dial.range, dial.step));
};
const dial = (id: string) => dialById(id)!;
const num = (patch: TuningPatch, path: string) => getPath(patch, path) as number;

describe('patch paths', () => {
  it('sets, reads and unsets a dotted path without touching the input', () => {
    const patch: TuningPatch = { A: { x: 1 } };
    const next = setPath(patch, 'A.b.c', 2);
    expect(patch).toEqual({ A: { x: 1 } });
    expect(getPath(next, 'A.b.c')).toBe(2);
    expect(unsetPath(next, 'A.b.c')).toEqual({ A: { x: 1 } });
    expect(unsetPath(unsetPath(next, 'A.b.c'), 'A.x')).toEqual({});
  });
  it('overlays leaf by leaf and replaces lists whole', () => {
    expect(overlay({ A: { x: 1, l: [1, 2], r: { a: 1, b: 2 } } }, { A: { l: [3, 4], r: { b: 5 } } })).toEqual({ A: { x: 1, l: [3, 4], r: { a: 1, b: 5 } } });
    expect(mergePatches({ A: { x: 1 } }, { A: { y: 2 } }, { B: { z: 3 } })).toEqual({ A: { x: 1, y: 2 }, B: { z: 3 } });
  });
});

describe('MACRO_DIALS', () => {
  it('writes only live, tunable fields that TUNING_META knows', () => {
    for (const d of MACRO_DIALS) for (const path of d.writes) {
      const meta = TUNING_META.find(entry => entry.path === path);
      expect(meta, `${d.id} writes ${path}`).toBeDefined();
      expect(meta!.mode, path).toBe('live');
      expect(validatePatch(setPath({}, path, getPath(defaults, path))), path).toEqual([]);
    }
  });

  it('every dial sits at neutral on the defaults, and neutral writes only default values', () => {
    for (const d of MACRO_DIALS) {
      expect(d.read(base), d.id).toBe(d.neutral);
      const written = d.write(d.neutral, base);
      for (const path of d.writes) expect(num(written, path), `${d.id} ${path}`).toBeCloseTo(num(defaults, path), 9);
    }
  });

  it('reads back what it writes, within one step, over its whole range', () => {
    for (const d of MACRO_DIALS) for (const v of grid(d)) {
      const back = d.read(at(d.write(v, base)));
      expect(back, `${d.id} at ${v}`).not.toBe('custom');
      expect(Math.abs((back as number) - v), `${d.id} at ${v} read ${back}`).toBeLessThanOrEqual(d.step + 1e-9);
    }
  });

  it('every written patch passes the registry guards at both ends of the range', () => {
    for (const d of MACRO_DIALS) for (const v of [d.range[0], d.range[1]])
      expect(validatePatch(d.write(v, base)), `${d.id} at ${v}`).toEqual([]);
  });

  it('Difficulty +2 writes favorableAt 8 → 10 and adverseAt −12 → −10 (J9)', () => {
    const written = dial('difficulty').write(2, base);
    expect(written).toEqual({ RESOLUTION_TUNING: { favorableAt: 10, adverseAt: -10 } });
  });

  it('Difficulty and the complications window decompose independently', () => {
    const one = at(dial('difficulty').write(2, base));
    const two = at(mergePatches(dial('difficulty').write(2, base), dial('mixed-window').write(4, one)));
    expect(dial('difficulty').read(two)).toBe(2);
    expect(dial('mixed-window').read(two)).toBe(4);
    expect(num(two.current, 'RESOLUTION_TUNING.favorableAt')).toBe(12);
    expect(num(two.current, 'RESOLUTION_TUNING.adverseAt')).toBe(-12);
    // The other order lands on the same fields.
    const three = at(dial('mixed-window').write(4, base));
    const four = at(mergePatches(dial('mixed-window').write(4, base), dial('difficulty').write(2, three)));
    expect(four.current.RESOLUTION_TUNING).toEqual(two.current.RESOLUTION_TUNING);
    // The window never lets the thresholds cross.
    for (const d of grid(dial('difficulty'))) for (const w of grid(dial('mixed-window'))) {
      const l = at(mergePatches(dial('difficulty').write(d, base), dial('mixed-window').write(w, at(dial('difficulty').write(d, base)))));
      expect(num(l.current, 'RESOLUTION_TUNING.favorableAt')).toBeGreaterThan(num(l.current, 'RESOLUTION_TUNING.adverseAt'));
    }
  });

  it('force lethality keeps fatal above 0 and below serious, and never writes hands', () => {
    const d = dial('lethality');
    expect(d.writes.some(path => path.includes('hands'))).toBe(false);
    for (const k of grid(d)) {
      const l = at(d.write(k, base));
      for (const profile of ['firearm', 'less_lethal_device', 'less_lethal_impact']) {
        const fatal = num(l.current, `FORCE_RISK_V1.${profile}.fatal`);
        expect(fatal, `${profile} ×${k}`).toBeGreaterThan(0);
        expect(fatal, `${profile} ×${k}`).toBeLessThan(num(l.current, `FORCE_RISK_V1.${profile}.serious`));
      }
      expect(num(l.current, 'FORCE_RISK_V1.hands.fatal')).toBe(0);
      expect(validatePatch(d.write(k, base))).toEqual([]);
    }
    // With serious lowered by hand, the dial caps fatal under it instead of crossing.
    const lowered = at({ FORCE_RISK_V1: { firearm: { serious: 0.3 } } });
    expect(num(d.write(2, lowered), 'FORCE_RISK_V1.firearm.fatal')).toBeCloseTo(0.299, 9);
    expect(validatePatch(overlay({ FORCE_RISK_V1: { firearm: { serious: 0.3 } } }, d.write(2, lowered)))).toEqual([]);
  });

  it('upset chances never go under the floor, alone or linked', () => {
    const setback = dial('setback'), luck = dial('luck');
    expect(partnerOf(setback)).toBe(luck);
    expect(num(setback.write(0.001, base), 'RESOLUTION_TUNING.setbackChance')).toBe(UPSET_FLOOR);
    expect(num(luck.write(-1, base), 'RESOLUTION_TUNING.luckChance')).toBe(UPSET_FLOOR);
    // Linked: setback .04 → .005 moves luck .03 by −.035, which stops at the floor.
    const linked = linkedWrite(setback, 0.005, base);
    expect(num(linked, 'RESOLUTION_TUNING.setbackChance')).toBe(0.005);
    expect(num(linked, 'RESOLUTION_TUNING.luckChance')).toBe(UPSET_FLOOR);
    expect(validatePatch(linked)).toEqual([]);
    // Linked up: both move by the same step.
    const up = linkedWrite(setback, 0.06, base);
    expect(num(up, 'RESOLUTION_TUNING.luckChance')).toBeCloseTo(0.05, 9);
  });

  it('a dial whose fields were edited apart reads custom, and Make them move together lands on the grid', () => {
    const d = dial('armed');
    const apart = at({ THREAT_TUNING: { difficulty: { execution: 20 } } });
    expect(d.read(apart)).toBe('custom');
    const together = togetherValue(d, apart);
    expect(together).toBe(snap((20 / 16 + 1) / 2, d.range, d.step));
    expect(d.read(at(d.write(together, apart)))).toBe(together);
  });

  it('officer exposure rounds each weapon to 0.01 and still reads its multiple back', () => {
    const d = dial('exposure');
    const written = d.write(1.05, base);
    for (const path of d.writes) expect(Math.round(num(written, path) * 100) / 100).toBe(num(written, path));
    expect(d.read(at(written))).toBe(1.05);
  });

  it('direct dials start at their field\'s default', () => {
    for (const d of MACRO_DIALS.filter(entry => entry.kind !== 'multiple' && entry.writes.length === 1))
      expect(d.neutral, d.id).toBe(num(defaults, d.writes[0]));
  });
});
