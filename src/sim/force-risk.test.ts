import { describe, expect, it } from 'vitest';
import { forceSeverity, FORCE_RISK_V1, protectedOfficerEffects } from './force-risk';

describe('independent force severity', () => {
  it('keeps protection reducing officer injury without reducing harm to the person', () => {
    const effects = [{ officerHarm: { severity: 'serious' as const, label: 'Recorded injury' }, personHarm: [{ personId: 'subject', severity: 'serious' as const }] }];
    expect(protectedOfficerEffects(effects)).toBe(effects);
    const protectedEffects = protectedOfficerEffects(effects, { itemId: 'ballistic_shield', unitId: 'shield' });
    expect(protectedEffects[0].officerHarm?.severity).toBe('wounded');
    expect(protectedEffects[0].personHarm).toEqual(effects[0].personHarm);
    expect(effects[0].officerHarm.severity).toBe('serious');
  });

  it('keeps severity monotone and less-lethal tails below firearm harm', () => {
    const rank = { fatal: 3, serious: 2, wounded: 1, none: 0 };
    for (const profile of Object.keys(FORCE_RISK_V1) as (keyof typeof FORCE_RISK_V1)[]) {
      const thresholds = FORCE_RISK_V1[profile];
      // Taking a person by hand (v13 drawn force) is the one profile that is never fatal.
      if (profile === 'hands') expect(thresholds.fatal).toBe(0); else expect(thresholds.fatal).toBeGreaterThan(0);
      expect(thresholds.fatal).toBeLessThan(thresholds.serious); expect(thresholds.serious).toBeLessThan(thresholds.wounded); expect(thresholds.wounded).toBeLessThan(1);
      for (let i = 0; i < 10000; i++) {
        const sample = i / 10000;
        if (i) expect(rank[forceSeverity(profile, sample)]).toBeLessThanOrEqual(rank[forceSeverity(profile, (i - 1) / 10000)]);
        if (profile !== 'firearm') expect(rank[forceSeverity(profile, sample)]).toBeLessThanOrEqual(rank[forceSeverity('firearm', sample)]);
      }
    }
    expect(FORCE_RISK_V1.less_lethal_device.fatal).toBeLessThan(FORCE_RISK_V1.firearm.fatal / 10);
    expect(FORCE_RISK_V1.less_lethal_impact.fatal).toBeLessThan(FORCE_RISK_V1.firearm.fatal / 10);
    expect(FORCE_RISK_V1.hands.serious).toBeLessThan(FORCE_RISK_V1.less_lethal_device.serious);
    expect(forceSeverity('hands', 0)).toBe('serious');
  });
});
