import { describe, expect, it } from 'vitest';
import { BUILDING_FAMILIES, isGeneratedFamily } from './index';
describe('registry', () => {
  it('lists the nine families with their floors and settings', () => {
    expect(BUILDING_FAMILIES.map((f) => f.id)).toEqual(['bungalow', 'two_storey_house', 'semi_detached', 'apartment_unit', 'corner_store_flat', 'small_office', 'bar_restaurant', 'warehouse', 'motel_row']);
    for (const f of BUILDING_FAMILIES) {
      expect(isGeneratedFamily(f.id)).toBe(true);
      expect(f.label.length).toBeGreaterThan(2);
      expect(f.blurb.length).toBeGreaterThan(2);
      expect(f.floors[1]).toBeLessThanOrEqual(2);
    }
    expect(isGeneratedFamily('maple_street')).toBe(false);
  });
});

