// Floors for the Desk and Street system (docs/ui-ux-audit.md, "Skin"): colour comes from tokens,
// nothing reads under 12px, small text only shrinks, and buttons stay thumb-sized. Like the floors
// in src/architecture/, each moves in one direction only: when a pass removes small text, lower
// SMALL_TEXT_CEILING to the new count in the same commit, and the test says so when it can.
import { describe, expect, it } from 'vitest';

// Vitest stubs every CSS import, raw ones included, so the stylesheets are read from disk. The src
// tsconfig carries only Vite's client types, so the two fs calls are typed here.
interface NodeFs {
  readdirSync(path: string, options: { recursive: true; encoding: 'utf8' }): string[];
  readFileSync(path: string, encoding: 'utf8'): string;
}
declare const process: { cwd(): string; getBuiltinModule(id: 'node:fs'): NodeFs };
const fs = process.getBuiltinModule('node:fs');
const UI = `${process.cwd()}/src/ui`;
const CSS: Record<string, string> = Object.fromEntries(
  fs.readdirSync(UI, { recursive: true, encoding: 'utf8' }).filter(file => file.endsWith('.css'))
    .map(file => [`/src/ui/${file.replaceAll('\\', '/')}`, fs.readFileSync(`${UI}/${file}`, 'utf8')]),
);

/** The only files that may spell a colour. The blueprint's palette lives here too, as tokens. */
const THEME_FILES = ['/src/ui/theme.css'];
/** The blueprint's SVG text is sized in viewBox units that scale with the map, so a size under this
 * in blueprint.css is not a screen pixel. Its HTML parts (room list, key, chooser) still count. */
const SVG_UNITS = { file: '/src/ui/blueprint/blueprint.css', under: 6 };
const FLOOR_PX = 12;
const SMALL_PX = 14;
/** Declarations under 14px, counted 2026-10-22 after the visual-story pass (347 before it; 309 before the filter rail). Only falls. */
const SMALL_TEXT_CEILING = 242;
const TOUCH_PX = 44;
const BUTTON_CLASS = /\.(btn|pill|icon-btn|stepper-btn|navbtn|hud-btn|linkbtn|live-cancel)(?![\w-])/;

interface Rule { file: string; selector: string; body: string }

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
/** Innermost blocks are declaration blocks; the text before each brace is its selector. */
const rules = (file: string): Rule[] =>
  [...stripComments(CSS[file]).matchAll(/([^{}]*)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ file, selector: selector.trim().replace(/\s+/g, ' '), body }));
const allRules = () => Object.keys(CSS).flatMap(rules);
const where = (rule: Rule, text: string) => `${rule.file.replace('/src/ui/', '')}: ${rule.selector.slice(0, 80)} { ${text.trim()} }`;

const fontDeclarations = (rule: Rule) => [...rule.body.matchAll(/(?<![\w-])(font-size|font)\s*:\s*([^;]+)/g)];

/** Every font size a declaration sets, in px or as a size token (--s12 is 12px), from font-size and
 * the font shorthand. */
function fontSizes(rule: Rule): { px: number; text: string }[] {
  const found: { px: number; text: string }[] = [];
  for (const [text, prop, value] of fontDeclarations(rule)) {
    const size = prop === 'font-size' ? /^(?:([\d.]+)px|var\(--s(\d+)\))/.exec(value.trim()) : /(?:^|\s)(?:([\d.]+)px|var\(--s(\d+)\))/.exec(value);
    if (!size) continue;
    const px = Number(size[1] ?? size[2]);
    if (rule.file === SVG_UNITS.file && px < SVG_UNITS.under) continue;
    found.push({ px, text });
  }
  return found;
}

describe('design floors', () => {
  it('reads the stylesheets', () => {
    expect(Object.keys(CSS).length).toBeGreaterThan(30);
    expect(Object.keys(CSS)).toEqual(expect.arrayContaining([...THEME_FILES, SVG_UNITS.file, '/src/ui/app.css']));
  });

  it('spells colours only in the theme, as tokens everywhere else', () => {
    const hex = allRules().filter(rule => !THEME_FILES.includes(rule.file))
      .flatMap(rule => [...rule.body.matchAll(/#[0-9a-fA-F]{3,8}(?![\w-])/g)].map(([value]) => where(rule, value)));
    expect(hex, 'name the colour as a token in src/ui/theme.css and use var(--token)').toEqual([]);
  });

  it(`sets no text under ${FLOOR_PX}px`, () => {
    const tiny = allRules().flatMap(rule => fontSizes(rule).filter(size => size.px < FLOOR_PX).map(size => where(rule, size.text)));
    expect(tiny, `${FLOOR_PX}px is the smallest size in the scale (meta only)`).toEqual([]);
  });

  it('sets no size that can scale under the floor', () => {
    // Container and viewport units shrink with the box (officer tile names once fell to 6.7px at
    // 320); em below 1 shrinks with its parent. A max() or clamp() with a px floor is fine.
    const fluid = allRules().flatMap(rule => fontDeclarations(rule)
      .filter(([, , value]) => (/\d(cq[iwhb]?|vw|vh|vmin)\b/.test(value) && !/^(max|clamp)\(\s*1[2-9]px/.test(value.trim()))
        || /(?:^|\s)0?\.\d+em\b/.test(value))
      .map(([text]) => where(rule, text)));
    expect(fluid, `give the size a ${FLOOR_PX}px floor`).toEqual([]);
  });

  it(`keeps text under ${SMALL_PX}px from growing`, () => {
    const small = allRules().flatMap(rule => fontSizes(rule).filter(size => size.px < SMALL_PX)).length;
    expect(small, `new text under ${SMALL_PX}px: decisions read at 14px or more (docs/ui-ux-audit.md, "Scale")`).toBeLessThanOrEqual(SMALL_TEXT_CEILING);
    expect(small, `small text fell to ${small}: lower SMALL_TEXT_CEILING to it`).toBe(SMALL_TEXT_CEILING);
  });

  it(`keeps the touch target at ${TOUCH_PX}px`, () => {
    const touch = rules('/src/ui/theme.css').flatMap(rule => [...rule.body.matchAll(/--touch\s*:\s*([^;]+)/g)].map(([, value]) => value.trim()));
    expect(touch).toEqual([`${TOUCH_PX}px`]);
    const base = rules('/src/ui/app.css').find(rule => rule.selector === '.btn');
    expect(base?.body).toMatch(/min-height\s*:\s*var\(--touch\)/);
  });

  it(`never shrinks a button class under ${TOUCH_PX}px`, () => {
    const short = allRules().filter(rule => BUTTON_CLASS.test(rule.selector)).flatMap(rule =>
      [...rule.body.matchAll(/(?<![\w-])(min-height|height|max-height)\s*:\s*([\d.]+)px/g)]
        .filter(([, , px]) => Number(px) < TOUCH_PX).map(([text]) => where(rule, text)));
    const redefined = allRules().filter(rule => !THEME_FILES.includes(rule.file) && /--touch\s*:/.test(rule.body)).map(rule => where(rule, '--touch'));
    expect([...short, ...redefined], 'a button is at least 44px tall (docs/mobile-interactions.md)').toEqual([]);
  });
});
