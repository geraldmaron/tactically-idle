// What the shared stylesheets promise the screens: muted text reads on every surface, a wrapped chip
// keeps its inset, and the action bar sits on the content gutter. The floors in design-floors.test.ts
// count debt; these pin the shared fixes so a screen package cannot quietly undo them.
import { describe, expect, it } from 'vitest';

interface NodeFs { readFileSync(path: string, encoding: 'utf8'): string }
declare const process: { cwd(): string; getBuiltinModule(id: 'node:fs'): NodeFs };
const fs = process.getBuiltinModule('node:fs');
const read = (file: string) => fs.readFileSync(`${process.cwd()}/src/ui/${file}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const THEME = read('theme.css');
const APP = read('app.css');
/** app.css was split into styles/*.css on 2026-10-24; the shared rules live in app.css and app-tail.css. */
const SHARED = `${APP}\n${read('styles/app-tail.css')}`;

/** A token's hex, following var(--other) aliases (--act is an alias of --live in the night-city theme). */
const token = (name: string): string => {
  const match = new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{6}|var\\(--[\\w-]+\\))`).exec(THEME);
  if (!match) throw new Error(`--${name} is not a hex token or an alias of one in theme.css`);
  const alias = /^var\(--([\w-]+)\)$/.exec(match[1]);
  return alias ? token(alias[1]) : match[1];
};
const linear = (channel: number) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((at) => linear(parseInt(hex.slice(at, at + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const rule = (css: string, selector: string) => {
  const found = [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)].find(([, sel]) => sel.trim().replace(/\s+/g, ' ') === selector);
  if (!found) throw new Error(`no rule ${selector}`);
  return found[2];
};

/** The surfaces a card, row, sheet or the page paints; text on any of them clears 4.5:1. */
const SURFACES = ['ink-0', 'ink-1', 'ink-2', 'ink-3'];
/** Every token used as the colour of text on those surfaces (--t-plate sits on painted art, not a surface). */
const TEXT = ['t1', 't2', 't3', 'act', 'act-text', 'good', 'good-text', 'harm', 'harm-text', 'warn', 'warn-text', 'info', 'deployed'];

describe('contrast tokens', () => {
  for (const text of TEXT) {
    it(`${text} reads at 4.5:1 on every surface`, () => {
      const low = SURFACES.map((surface) => ({ surface, ratio: contrast(token(text), token(surface)) })).filter(({ ratio }) => ratio < 4.5);
      expect(low, `--${text} on a surface under 4.5:1`).toEqual([]);
    });
  }
});

describe('shared geometry', () => {
  it('keeps a wrapped chip off its border by at least 4px', () => {
    const body = rule(APP, '.chip');
    expect(body).toMatch(/padding\s*:\s*var\(--sp1\)\s+var\(--sp\d\)/);
    expect(body).not.toMatch(/padding\s*:\s*0\b/);
  });

  it('puts the action bar on the content gutter, so it follows the 12px gutter at 320', () => {
    expect(rule(APP, '.action-bar')).toMatch(/padding\s*:\s*var\(--sp3\)\s+var\(--gutter\)/);
  });

  it('shrinks the gutter at 320 through the token, not a one-off', () => {
    const small = /@media \(max-width: 360px\)\s*\{\s*:root\s*\{([^{}]*)\}/.exec(SHARED);
    expect(small?.[1]).toMatch(/--gutter\s*:\s*var\(--sp3\)/);
  });
});
