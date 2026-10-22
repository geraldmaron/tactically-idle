// The icon set and visual kit (docs/visual-kit.md): every name the game uses resolves to a drawn glyph,
// every kit table points at a real name, and each call type gets its own badge rather than the padlock.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Icon, ICON_NAMES } from '../icons';
import type { IconName } from '../icons';
import { incidentMeta } from '../components/incident';
import { CallTypeBadge, callTypeKind } from './CallTypeBadge';
import { MARK_STATUSES, OUTCOME_BANDS, OutcomeMark, StatusMark } from './marks';
import { Spot, SPOT_NAMES } from './spots';
import * as KIT from './kit';

const NAMES = new Set<string>(ICON_NAMES);

const SOURCES = import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/**/*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Icon names written as literals anywhere in src: <Icon name="x">, icon="x", icon: 'x', 'x' as IconName. */
function namesInUse(): Map<string, string> {
  const used = new Map<string, string>();
  const patterns = [/<Icon\b[^>]*?\bname="([A-Za-z]+)"/g, /\bicon(?:=|:\s*)['"]([A-Za-z]+)['"]/g, /['"]([A-Za-z]+)['"] as IconName/g];
  for (const [file, text] of Object.entries(SOURCES)) {
    for (const re of patterns) for (const m of text.matchAll(re)) if (!used.has(m[1])) used.set(m[1], file);
  }
  return used;
}

const render = (name: IconName) => renderToStaticMarkup(createElement(Icon, { name }));

describe('icon set', () => {
  it('finds the names the game already uses', () => {
    // A floor, not a pin: the scan must keep seeing the existing call sites.
    expect(namesInUse().size).toBeGreaterThanOrEqual(51);
  });

  it('resolves every icon name written in the source', () => {
    const missing = [...namesInUse()].filter(([n]) => !NAMES.has(n)).map(([n, f]) => `${n} (${f})`);
    expect(missing).toEqual([]);
  });

  it('draws something for every name, on the shared 24 grid', () => {
    for (const name of ICON_NAMES) {
      const svg = render(name);
      expect(svg, name).toContain('viewBox="0 0 24 24"');
      expect(svg, name).toMatch(/<(path|circle|rect|ellipse|g)\b/);
    }
  });

  it('points every kit table at a real icon', () => {
    for (const [table, map] of Object.entries(KIT)) {
      if (typeof map !== 'object') continue;
      for (const [key, name] of Object.entries(map as Record<string, string>)) expect(NAMES.has(name), `${table}.${key} -> ${name}`).toBe(true);
    }
  });
});

describe('call-type badges', () => {
  const types = Object.keys(KIT.CALL_TYPE_ICON);

  it('no longer marks a hostage crisis with a padlock', () => {
    expect(incidentMeta('hostage_crisis').icon).not.toBe('lock');
    expect(incidentMeta('hostage_crisis').icon).toBe('hostage');
  });

  it('gives each call type its own shape, hue and mark', () => {
    const kinds = types.map((t) => callTypeKind(t));
    expect(new Set(kinds.map((k) => k.shape)).size).toBe(types.length);
    expect(new Set(kinds.map((k) => k.kind)).size).toBe(types.length);
    expect(new Set(kinds.map((k) => k.icon)).size).toBe(types.length);
    for (const t of types) expect(incidentMeta(t).icon).toBe(KIT.CALL_TYPE_ICON[t as keyof typeof KIT.CALL_TYPE_ICON]);
  });

  it('names the type for assistive tech whether or not the label shows', () => {
    const bare = renderToStaticMarkup(createElement(CallTypeBadge, { type: 'protected_rescue' }));
    expect(bare).toContain(`aria-label="${incidentMeta('protected_rescue').label}"`);
    const labelled = renderToStaticMarkup(createElement(CallTypeBadge, { type: 'protected_rescue', label: true }));
    expect(labelled).toContain(`>${incidentMeta('protected_rescue').label}</span>`);
    expect(renderToStaticMarkup(createElement(CallTypeBadge, { type: 'not_a_type' }))).toContain('ct-badge--unknown');
  });
});

describe('status and outcome marks', () => {
  it('pairs every mark with a visible label by default', () => {
    for (const status of MARK_STATUSES) {
      const html = renderToStaticMarkup(createElement(StatusMark, { status }));
      expect(html, status).toMatch(/class="kit-mark-label">[A-Z][^<]+</);
    }
    for (const band of OUTCOME_BANDS) {
      const html = renderToStaticMarkup(createElement(OutcomeMark, { band, label: 'Went well' }));
      expect(html, band).toContain('class="kit-mark-label">Went well<');
    }
  });

  it('moves the label to aria-label when the mark stands alone', () => {
    expect(renderToStaticMarkup(createElement(StatusMark, { status: 'injured', showLabel: false }))).toContain('aria-label="Injured"');
  });
});

describe('empty-state spots', () => {
  it('draws every spot, decorative and in the 160 by 112 frame', () => {
    for (const name of SPOT_NAMES) {
      const svg = renderToStaticMarkup(createElement(Spot, { name }));
      expect(svg, name).toContain('viewBox="0 0 160 112"');
      expect(svg, name).toContain('aria-hidden="true"');
    }
  });
});
