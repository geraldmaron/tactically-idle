// The game has two motion signals (docs/call-presentation.md): a slow amber ring on the Ops nav
// button meaning "a call is waiting on you, somewhere you aren't looking", and the light bar on a
// hot call (owner, 2026-10-20), which since 2026-10-21 also sweeps as a wash across the strip. Nothing else pulses, blinks or loops. This reads every stylesheet under src/ui and fails on any other repeating
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
  it('loops only the waiting-on-you ring and a hot call\u2019s light bar', () => {
    expect(loops()).toEqual(['app.css: .live-dot', 'screens/live-call.css: .live-lightbar i:first-child', 'screens/live-call.css: .live-lightbar i:last-child',
      'screens/live-call.css: .live-wash i:first-child', 'screens/live-call.css: .live-wash i:last-child']);
  });

  it('holds the light bar steady under reduced motion', () => {
    expect(SHEETS['screens/live-call.css']).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.live-lightbar i \{ animation: none !important; \}/);
  });

  // The light wash sweeps a broad band, so it must stay under three flashes a second (WCAG 2.3.1):
  // each cycle is one red and one blue pass, and the fastest cycle is 1.6s, 1.25 flashes a second.
  it('keeps the light wash under three flashes a second and still under reduced motion', () => {
    const css = SHEETS['screens/live-call.css'];
    const cycles = [...css.matchAll(/--wash-cycle: ([\d.]+)s/g)].map(m => Number(m[1]));
    expect(cycles.length).toBeGreaterThan(0);
    for (const cycle of cycles) expect(2 / cycle).toBeLessThan(3);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.live-wash i \{ animation: none !important;/);
  });

  it('keeps the ring still under reduced motion', () => {
    const css = SHEETS['app.css'];
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.live-dot \{\s*animation: none !important;/);
  });
});
