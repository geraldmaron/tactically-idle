// The game has one motion signal (docs/call-presentation.md): a slow amber ring on the Ops nav
// button meaning "a call is waiting on you, somewhere you aren't looking". Nothing else pulses,
// blinks or loops. This reads every stylesheet under src/ui and fails on any other repeating
// animation, so a new pulse has to argue its way into the doc first.
import { describe, expect, it } from 'vitest';
import { stylesheetsUnder } from '../dev/lab/css-rules';

const SHEETS = stylesheetsUnder('src/ui');

/** Every `selector { ... animation: ... infinite ... }`, as "file: selector". */
function loops(): string[] {
  const found: string[] = [];
  for (const [file, raw] of Object.entries(SHEETS)) {
    const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (/animation(-iteration-count)?\s*:[^;]*\binfinite\b/.test(rule[2])) found.push(`${file}: ${rule[1].trim()}`);
    }
  }
  return found;
}

describe('one motion signal', () => {
  it('loops only the waiting-on-you ring on the Ops nav button', () => {
    expect(loops()).toEqual(['app.css: .live-dot']);
  });

  it('keeps the ring still under reduced motion', () => {
    const css = SHEETS['app.css'];
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.live-dot \{\s*animation: none !important;/);
  });
});
