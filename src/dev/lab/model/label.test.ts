import { describe, expect, it } from 'vitest';
import { metricLabel, oneIn, percent, probText, styleLabel, weightLabel } from './label';
import { wilson } from './stats';

describe('probText', () => {
  it('engine odds: a plain number, then scope, squad and method', () => {
    const t = probText(0.61, { face: 'engine', scope: 'now', who: 'squad A (719)' });
    expect(t.value).toBe('61%');
    expect(t.pill).toEqual(['now', 'squad A (719)', 'engine']);
    expect(t.plain).toBe('61% · now · squad A (719) · engine');
    expect(t.muted).toBe(false);
  });

  it('exact chances are prefixed with =', () => {
    const t = probText(0.16, { face: 'exact', scope: 'this path', who: 'your picks' });
    expect(t.value).toBe('= 16%');
    expect(t.plain).toBe('= 16% · this path · your picks · exact');
  });

  it('simulated shares are prefixed with ≈ and carry the interval half-width', () => {
    const ci = wilson(164, 400);
    const t = probText(0.41, { face: 'sim', scope: 'this call', style: 'random', runs: 400 }, ci, 164);
    expect(t.value).toBe('≈ 41% ±5');
    expect(t.plain).toBe('≈ 41% ±5 · this call · random style · 400 runs');
    expect(t.muted).toBe(false);
  });

  it('below 30 runs shows the count instead of a percentage', () => {
    const t = probText(3 / 20, { face: 'sim', scope: 'this call', style: 'random', runs: 20 }, wilson(3, 20), 3);
    expect(t.value).toBe('3 of 20 runs');
    expect(t.pill).toEqual(['this call', 'random style', 'few runs']);
    expect(t.muted).toBe(true);
  });

  it('mutes a wide interval and says "few runs"', () => {
    const t = probText(15 / 40, { face: 'sim', scope: 'this type', style: 'best_odds', runs: 40, who: 'day-one squads vary per call' }, wilson(15, 40), 15);
    expect(t.muted).toBe(true);
    expect(t.plain).toBe('≈ 38% ±14 · this type · day-one squads vary per call · best odds · 40 runs · few runs');
  });

  it('names an unsaved tuning patch', () => {
    const t = probText(0.58, { face: 'engine', scope: 'now', who: 'squad A (719)', pending: true });
    expect(t.pill.at(-1)).toBe('unsaved tuning');
  });

  it('CI gate scope and run counts over a thousand', () => {
    const t = probText(0.34, { face: 'sim', scope: 'CI gate', style: 'random', runs: 1200 }, wilson(408, 1200), 408);
    expect(t.plain).toBe('≈ 34% ±3 · CI gate · random style · 1,200 runs');
  });

  it('never shows ±0', () => {
    expect(probText(0, { face: 'sim', scope: 'this call', runs: 400 }, wilson(0, 400), 0).value).toBe('≈ 0% ±1');
  });
});

describe('percent', () => {
  it('rounds to a whole percent but keeps rare and near-certain results honest', () => {
    expect(percent(0)).toBe('0%');
    expect(percent(0.004)).toBe('<1%');
    expect(percent(0.005)).toBe('1%');
    expect(percent(0.415)).toBe('42%');
    expect(percent(0.996)).toBe('>99%');
    expect(percent(1)).toBe('100%');
  });
});

describe('oneIn', () => {
  it('reads an exact chance the way the path rail does', () => {
    expect(oneIn(1 / 6)).toBe('1 in 6');
    expect(oneIn(0.16)).toBe('1 in 6');
    expect(oneIn(0)).toBe('never');
    expect(oneIn(1)).toBe('always');
  });
});

describe('labels', () => {
  it('styles are named as styles, never as the player', () => {
    expect(styleLabel('random')).toBe('random style');
    expect(styleLabel('best_odds')).toBe('best odds');
    expect(styleLabel('patient')).toBe('patient');
    expect(styleLabel('fast')).toBe('fast');
  });
  it('run classes', () => {
    expect(['clean', 'costly', 'unresolved', 'hurt', 'death'].map(w => weightLabel(w as never))).toEqual(['clean', 'costly', 'unresolved', 'hurt', 'death']);
  });
  it('gate metrics', () => {
    expect(metricLabel('bad')).toBe('unresolved, hurt or dead');
    expect(metricLabel('harm')).toBe('hurt or dead');
    expect(metricLabel('officerHurt')).toBe('officer hurt');
  });
});
