// The city's names are invented, and calls use them instead of generic nouns (content/world.ts).
import { describe, expect, it } from 'vitest';
import { INCIDENT_TEMPLATES } from './incidents';
import { DELIVERY_APPS, HANDLES, OUTLETS, REAL_BRANDS, STREAM_APPS, WORLD_TOKENS, worldFor } from './world';

/** Generic nouns a call names instead: "{delivery_app}" first, "the delivery app" after. */
const GENERIC = /\bthe (?:app|news|station|stream site|platform)\b/i;

/** Every string an incident template carries: its tree, its clocks, its sources and their feeds. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

describe('the city canon', () => {
  it('names nothing after a real company', () => {
    const names = [...DELIVERY_APPS, ...STREAM_APPS, ...OUTLETS.flatMap(o => [o.name, o.short]), ...HANDLES].map(n => n.toLowerCase());
    for (const name of names) for (const brand of REAL_BRANDS) expect(name.split(/[^a-z0-9]+/), `${name} / ${brand}`).not.toContain(brand);
  });

  it('binds the same companies on every call, and draws the commenter from the call seed', () => {
    expect(worldFor(1).delivery_app).toBe(worldFor(2).delivery_app);
    expect(worldFor(7)).toEqual(worldFor(7));
    expect(new Set(Array.from({ length: 40 }, (_, i) => worldFor(i).handle)).size).toBeGreaterThan(3);
    expect(WORLD_TOKENS).toEqual(['delivery_app', 'stream_app', 'outlet', 'outlet_short', 'handle']);
  });
});

describe('calls name things', () => {
  it.each(Object.values(INCIDENT_TEMPLATES).map(t => [t!.type, t!] as const))('%s never says "the app" or "the news" bare', (_, template) => {
    expect(strings(template).filter(text => GENERIC.test(text))).toEqual([]);
  });
});
