// Every input the manifest says reaches the roll must move the odds the right way, and every known
// gap must still be a gap: wiring one fails this test until its entry in wiring.ts is promoted.
import { describe, expect, it } from 'vitest';
import { measureWiring, samplePoints, taskWeightViolations, WIRING } from './wiring';

const points = samplePoints();
const results = measureWiring(WIRING, points);

describe('what moves the odds', () => {
  it('samples decision points past the opening on every tree', () => {
    const types = new Set(points.map(point => point.type));
    for (const type of types) expect(points.filter(point => point.type === type && !point.opening).length, type).toBeGreaterThan(0);
  });

  for (const result of results) {
    const { probe } = result;
    const where = Object.entries(result.byTree).map(([type, t]) => `${type} ${t.moved}/${t.choices}`).join(', ');
    if (probe.status === 'live') {
      it(`${probe.system}: ${probe.input} moves at least ${Math.round(probe.minShare * 100)}% of sampled choices, the ${probe.direction === 'any' ? 'either' : probe.direction} way`, () => {
        expect(result.choices).toBeGreaterThan(0);
        expect(result.share, where).toBeGreaterThanOrEqual(probe.minShare);
        expect(result.wrong, 'moved the wrong way').toEqual([]);
        if (probe.everyTree) for (const [type, t] of Object.entries(result.byTree)) expect(t.moved, `${type} has no responsive choice`).toBeGreaterThan(0);
      });
    } else {
      it(`${probe.system}: ${probe.input} is still a known gap`, () => {
        expect(result.moved, `wired now (${where}): promote "${probe.id}" to live in src/architecture/wiring.ts`).toBe(0);
      });
    }
  }

  it('officer: each choice reads the ratings its task weights, and only those', () => {
    const { checked, violations } = taskWeightViolations(points);
    expect(checked).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  });
});
