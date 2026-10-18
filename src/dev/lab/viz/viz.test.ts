// The shared drawing kit renders and names what it shows (spec 4.5). Static markup only: these are
// presentation, so the checks are about the words and marks a reader or a screen reader gets.
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { wilson } from '../model/stats';
import { BandCurve, BandGlyph, Bullet, EffectChip, FlagGlyph, KeyChip, LintGlyph, PeopleGlyph, ProbValue, RouteChip, SegmentedControl, StackBar, StyleSpread, Tag, Waterfall, WeightGlyph } from './index';
import { trapTarget } from './layers';
import LAYERS from './layers.tsx?raw';

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe('glyphs', () => {
  it('never carry a meaning by color alone', () => {
    expect(html(h(BandGlyph, { band: 'favorable' }))).toContain('aria-label="Goes well"');
    expect(html(h(BandGlyph, { band: 'adverse', words: true }))).toContain('Goes badly');
    expect(html(h(WeightGlyph, { weight: 'unresolved' }))).toContain('Run class: unresolved');
    expect(html(h(PeopleGlyph, { kind: 'withheld' }))).toContain('Named; role not confirmed');
    expect(html(h(LintGlyph, { severity: 'warn' }))).toContain('aria-label="Warning"');
    expect(html(h(FlagGlyph, { flag: 'beaten' }))).toContain('Beaten on every column');
  });
});

describe('ProbValue', () => {
  it('shows the value and a pill of the same facts as the plain form', () => {
    const out = html(h(ProbValue, { p: 0.41, prov: { face: 'sim', scope: 'this call', style: 'random', runs: 400 }, ci: wilson(164, 400), k: 164 }));
    expect(out).toContain('≈ 41% ±5');
    expect(out).toContain('title="≈ 41% ±5 · this call · random style · 400 runs"');
    expect(out.match(/lab-pill-seg/g)).toHaveLength(3);
    expect(out).not.toContain('lab-prob-muted');
  });
  it('is muted with few runs and outlined when pending', () => {
    const out = html(h(ProbValue, { p: 0.375, prov: { face: 'sim', scope: 'this call', runs: 40, pending: true }, ci: wilson(15, 40), k: 15 }));
    expect(out).toContain('lab-prob-muted');
    expect(out).toContain('lab-pending-mark');
    expect(out).toContain('unsaved tuning');
  });
});

describe('charts', () => {
  it('StackBar names every part with its share', () => {
    const out = html(h(StackBar, { label: 'Run classes', parts: [
      { key: 'clean', value: 34, tone: 'clean', label: 'clean' }, { key: 'hurt', value: 10, tone: 'hurt', label: 'hurt' }, { key: 'death', value: 0, tone: 'death', label: 'death' },
    ] }));
    expect(out).toContain('aria-label="Run classes: clean 77%, hurt 23%"');
    expect(out).not.toContain('lab-fill-death');
  });
  it('Bullet says the allowed band, both values and the verdict', () => {
    const out = html(h(Bullet, { label: 'Clean', min: 0.15, max: 0.6, saved: 0.34, patch: 0.31, pass: true }));
    expect(out).toContain('Clean: saved 34%, unsaved 31%; the gate allows 15% to 60%; passes');
    expect(out).toContain('34% → 31%');
    expect(html(h(Bullet, { label: 'Best odds clean', max: 0.75, saved: 0.78, pass: false }))).toContain('up to 75%; fails');
  });
  it('StyleSpread lists the styles it has', () => {
    expect(html(h(StyleSpread, { label: 'Clean by style', values: { random: 0.34, best_odds: 0.61 }, cap: 0.75 })))
      .toContain('Clean by style: random style 34%, best odds 61%; cap 75%');
  });
  it('BandCurve draws three bands and the saved curve', () => {
    const points = [-40, 0, 40].map(margin => ({ margin, favorable: margin > 0 ? 0.8 : 0.1, mixed: 0.1, adverse: margin > 0 ? 0.1 : 0.8 }));
    const out = html(h(BandCurve, { points, saved: points, markers: [{ id: 'a', label: '①', margin: 5 }] }));
    for (const part of ['lab-curve-badly', 'lab-curve-mixed', 'lab-curve-well', 'lab-curve-saved', '①']) expect(out).toContain(part);
  });
  it('Waterfall ends on the sum of its items', () => {
    const out = html(h(Waterfall, { items: [{ id: 's', label: 'Singh', value: 14.1 }, { id: 'p', label: 'Pressure', value: -3.2 }, { id: 'd', label: 'Difficulty', value: -5.9 }] }));
    expect(out).toContain('Margin +5 from 3 contributors');
    expect(out).toContain('−3.2');
  });
});

describe('chips and controls', () => {
  it('RouteChip names the target, the drawn ways and harm', () => {
    expect(html(h(RouteChip, { band: 'favorable', to: { kind: 'ending', title: 'One door', weight: 'clean' } }))).toContain('One door');
    expect(html(h(RouteChip, { band: 'adverse', to: null, drawnWays: 3, harm: true }))).toContain('3 ways');
  });
  it('EffectChip and KeyChip link when they have somewhere to go', () => {
    expect(html(h(EffectChip, { label: 'Ruth’s terms known', kind: 'writes', onClick: () => {} }))).toMatch(/^<button/);
    expect(html(h(KeyChip, { label: 'Ruth’s terms known', raw: 'mark:terms' }))).toContain('<code class="lab-raw">mark:terms</code>');
  });
  it('Tag uses the material it is given', () => {
    expect(html(h(Tag, { variant: 'tape', children: 'truth: held' }))).toContain('lab-tag-tape');
  });
  it('SegmentedControl is a radio group with one tab stop', () => {
    const out = html(h(SegmentedControl<number>, { label: 'Tier', value: 2, options: [1, 2, 3].map(value => ({ value, label: String(value) })), onChange: () => {} }));
    expect(out).toContain('role="radiogroup"');
    expect(out.match(/tabindex="0"/g)).toHaveLength(1);
    expect(out).toContain('aria-checked="true"');
  });
});

describe('modal layers keep Tab inside (review finding modal-focus-escapes)', () => {
  const [a, b, c] = ['a', 'b', 'c'];
  it('wraps from the last control to the first and back, and pulls focus in from outside', () => {
    expect(trapTarget([a, b, c], c, true, false)).toBe(a);
    expect(trapTarget([a, b, c], a, true, true)).toBe(c);
    // Within the modal the browser steps on its own.
    expect(trapTarget([a, b, c], a, true, false)).toBeNull();
    expect(trapTarget([a, b, c], b, true, true)).toBeNull();
    // From the top bar behind the scrim, from the page body, or from the panel itself.
    expect(trapTarget([a, b, c], 'top-bar', false, false)).toBe(a);
    expect(trapTarget([a, b, c], null, false, true)).toBe(c);
    expect(trapTarget([a, b, c], 'panel', true, false)).toBe(a);
    expect(trapTarget([], null, false, false)).toBeNull();
  });
  it('is on for every modal layer: the shortcut sheet, the palette and confirm sheets', () => {
    for (const name of ['export function ConfirmSheet', 'export function Modal']) {
      const body = LAYERS.slice(LAYERS.indexOf(name));
      expect(body.slice(0, body.indexOf('return ('))).toContain('useTrapTab(open, panel)');
    }
  });
});
