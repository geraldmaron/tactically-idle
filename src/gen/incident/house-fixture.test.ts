// The house call is a test-only copy of the barricade (trees-v13/house-fixture.ts). houseCalls
// registers it in the scenario registry inside the test process only: nothing the game or the lab
// builds imports either file (src/sim/test-fixtures.ts is test support, loaded only by tests), so the game never offers it and getScenario outside tests can't see it.
import { describe, expect, it } from 'vitest';
import { houseCalls } from './trees-v13/house-call-fixture';

const SOURCES = import.meta.glob(['/src/**/*.ts', '/src/**/*.tsx', '!/src/**/*.test.ts', '!/src/**/*.test.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('the house call stays in the tests', () => {
  it('no file outside the tests imports the house fixtures', () => {
    expect(Object.keys(SOURCES).length, 'source files scanned').toBeGreaterThan(100);
    const importers = Object.entries(SOURCES).filter(([path, text]) => !path.includes('/trees-v13/house-') && path !== '/src/sim/test-fixtures.ts' && /from '[^']*house-(call-)?fixture'/.test(text)).map(([path]) => path);
    expect(importers).toEqual([]);
  });

  it('registers under its own ids, never a shipping call’s', () => {
    for (const call of houseCalls(2)) expect(call.id.startsWith('house:')).toBe(true);
  });
});
