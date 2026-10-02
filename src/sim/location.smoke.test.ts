import { describe, expect, it } from 'vitest';
import { buildLocation } from './location';

describe('maple street derive (smoke)', () => {
  it('computes areas, capacities and a connected graph', () => {
    const { derived } = buildLocation('maple_street', 0);
    const s = derived.spaces;
    expect(s.bedroom_e.area).toBe(221);
    expect(s.living.area).toBe(273);
    expect(s.kitchen.area).toBe(281);
    expect(s.hall.capacity).toBe(1);
    expect(Number.isFinite(derived.distance.front_yard.bedroom_e)).toBe(true);
  });
});
