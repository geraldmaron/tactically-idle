// Lab CSS never reaches the game frame (spec 9.1, rule 5): every selector in a lab stylesheet starts
// with a lab- class, so the game's screens rendered inside the lab keep exactly their own styles.
import { describe, expect, it } from 'vitest';
import { classesOf, firstCompound, readCss, stylesheetsUnder } from './css-rules';

const SHEETS = stylesheetsUnder('src/dev/lab');

describe('lab CSS is scoped to lab- classes', () => {
  it('finds the lab stylesheets', () => {
    expect(Object.keys(SHEETS)).toEqual(expect.arrayContaining(['lab.css', 'surfaces/play/play.css']));
  });
  for (const [file, css] of Object.entries(SHEETS)) {
    it(file, () => {
      const { selectors, nested } = readCss(css);
      expect(selectors.length).toBeGreaterThan(0);
      expect(nested, 'nested style rules are not checked by this guard; write them flat').toEqual([]);
      const unscoped = selectors.filter(entry => !classesOf(firstCompound(entry.selector)).some(name => name.startsWith('lab-')))
        .map(entry => `line ${entry.line}: ${entry.selector}`);
      expect(unscoped, 'each selector must start with a .lab- class').toEqual([]);
    });
  }
});

// Two stylesheets that both lead a selector with the same lab- class style one thing twice, and the
// one that loads last wins on every surface (Wave B2 hit this three times: notes, Why and the
// shortcut keys). A surface restyles a shared piece in its own context instead (`.lab-flow .lab-button`).
describe('each lab- class is defined in one stylesheet', () => {
  it('no two stylesheets lead a selector with the same class', () => {
    const owners = new Map<string, Set<string>>();
    for (const [file, css] of Object.entries(SHEETS)) for (const entry of readCss(css).selectors) {
      const lead = classesOf(firstCompound(entry.selector))[0];
      if (lead) owners.set(lead, (owners.get(lead) ?? new Set()).add(file));
    }
    const shared = [...owners].filter(([, files]) => files.size > 1).map(([name, files]) => `.${name}: ${[...files].sort().join(', ')}`);
    expect(owners.size).toBeGreaterThan(100);
    expect(shared, 'define each class in one stylesheet, or scope the other use under its own surface class').toEqual([]);
  });
});
