// Game CSS stays class-scoped (spec 9.1, rule 5): the lab loads the game's stylesheets to render its
// screens in the frame, so an element-first game rule would restyle the lab's own chrome. Only the
// listed base rules may start without a class, and no game rule may name a lab- class.
import { describe, expect, it } from 'vitest';
import { classesOf, firstCompound, readCss, stylesheetsUnder } from './css-rules';

const SHEETS = stylesheetsUnder('src/ui');

/** `file|selector` pairs allowed to start without a class. */
const ALLOWED = new Set([
  // theme.css: tokens, the box model, page background and type, button font, and the reduced-motion clamp.
  'theme.css|:root', 'theme.css|*', 'theme.css|html', 'theme.css|body', 'theme.css|#root', 'theme.css|button',
  'theme.css|*::before', 'theme.css|*::after',
  // app.css: shell tokens (also redefined under max-width: 360px) and the game's focus ring, which
  // matches the lab's own (2 px amber, 2 px offset).
  'app.css|:root', 'app.css|button:focus-visible', 'app.css|select:focus-visible', 'app.css|input:focus-visible',
  // Found when the guard was written (not in the spec's list): the same focus ring on <summary>.
  'app.css|summary:focus-visible',
  // styles/app-tail.css: the small-screen gutter token, split out of app.css with the rest of that sheet.
  'styles/app-tail.css|:root',
  // screens/store.css: the three precinct looks only remap accent tokens on the root when the game sets
  // data-precinct (the lab never does), so they restyle nothing of the lab's chrome.
  'screens/store.css|:root[data-precinct="harbour"]', 'screens/store.css|:root[data-precinct="records"]', 'screens/store.css|:root[data-precinct="greenline"]',
  // skin.css: the press and focus states of a button that holds the game's .nav-pill; no other element matches.
  'skin.css|button:active > .nav-pill', 'skin.css|button:focus-visible > .nav-pill',
]);

describe('game CSS stays class-scoped', () => {
  const files = Object.keys(SHEETS);
  it('reads every game stylesheet', () => {
    expect(files).toEqual(expect.arrayContaining(['theme.css', 'app.css', 'screens/ops-visual.css']));
  });
  for (const name of files) {
    it(name, () => {
      const { selectors, nested } = readCss(SHEETS[name]);
      // A sheet with rules must yield selectors; an empty read would let the guard pass on nothing.
      if (SHEETS[name].includes('{')) expect(selectors.length).toBeGreaterThan(0);
      expect(nested, 'nested style rules are not checked by this guard; write them flat').toEqual([]);
      const unscoped = selectors.filter(entry => !classesOf(firstCompound(entry.selector)).length && !ALLOWED.has(`${name}|${entry.selector}`))
        .map(entry => `line ${entry.line}: ${entry.selector}`);
      expect(unscoped, 'start the selector with a class, or list it in ALLOWED with the reason').toEqual([]);
      const labClasses = selectors.filter(entry => /\.lab-/.test(entry.selector)).map(entry => `line ${entry.line}: ${entry.selector}`);
      expect(labClasses, 'lab- classes belong to the lab').toEqual([]);
    });
  }
});
