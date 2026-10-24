import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../sim/department';
import { charterGainPerHour, fundingWindowHours } from './store-model';
import { ratesAt } from '../../sim/economy';
import { simNow } from '../../sim/calendar';

describe('store model', () => {
  it('prices the Charter as the extra quarter on patrol grants, equal to the rate change it makes', () => {
    const state = createInitialState(Date.UTC(2026, 0, 1), 7);
    const gain = charterGainPerHour(state);
    expect(gain).toBeGreaterThan(0);
    const withCharter = structuredClone(state);
    withCharter.department.entitlements = { charter: true, nightWatch: false };
    const diff = ratesAt(withCharter, simNow(withCharter), false).net - ratesAt(state, simNow(state), false).net;
    expect(Math.abs(diff - gain)).toBeLessThanOrEqual(1);
    // Owned or not, the Store shows the same figure.
    expect(charterGainPerHour(withCharter)).toBe(gain);
  });

  it('names the two funding windows', () => {
    expect(fundingWindowHours()).toEqual({ free: 72, watch: 168 });
  });
});
