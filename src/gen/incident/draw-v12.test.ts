import { describe, it, expect } from 'vitest';
import { drawIncidentSpec, DECISION_DEPTH_CONTENT_VERSION } from './index';
import { SCENARIO_TYPES_V11 } from '../../content/scenario-types-v11';
import type { IncidentType } from '../../sim/scenario-types';

const TYPES = SCENARIO_TYPES_V11.map(info => info.type);
const SPECIALIST: IncidentType[] = ['active_armed_incident', 'hostage_crisis', 'protected_rescue'];

function rates(contentVersion: number, avoidFamilies: string[] = [], n = 6000): Record<string, number> {
  const counts: Record<string, number> = {};
  let state = 12345;
  for (let i = 0; i < n; i++) {
    const drawn = drawIncidentSpec(state, { level: 10, trust: 80, contentVersion, avoidFamilies, unlockedTypes: TYPES, typeWeights: Object.fromEntries(TYPES.map(type => [type, 1])) });
    state = drawn.state;
    counts[drawn.spec.type] = (counts[drawn.spec.type] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).map(([type, count]) => [type, count / n]));
}

describe('v12 board draws: framework first', () => {
  it('meets an unlocked specialist call about once in 23 draws, not once in 75', () => {
    const v11 = rates(11), v12 = rates(DECISION_DEPTH_CONTENT_VERSION);
    expect(v11.protected_rescue).toBeLessThan(0.02);
    for (const type of SPECIALIST) {
      expect(v12[type], type).toBeGreaterThan(0.035);
      expect(v12[type], type).toBeLessThan(0.06);
    }
    // Everyday calls stay the bulk of the board, each about equally likely.
    const everyday = TYPES.filter(type => !SPECIALIST.includes(type)).map(type => v12[type]);
    expect(Math.min(...everyday)).toBeGreaterThan(0.05);
    expect(Math.max(...everyday) / Math.min(...everyday)).toBeLessThan(1.35);
  });

  it('a framework with few building types is not crowded out by the buildings on the board', () => {
    // Every rescue building is already on the board: the draw picks a repeat building
    // rather than dropping the framework.
    const rescueFamilies = SCENARIO_TYPES_V11.find(info => info.type === 'protected_rescue')!.families;
    expect(rates(DECISION_DEPTH_CONTENT_VERSION, rescueFamilies).protected_rescue).toBeGreaterThan(0.035);
  });

  it('draws only buildings the framework lists, preferring ones not on the board', () => {
    let state = 99;
    for (let i = 0; i < 400; i++) {
      const avoid = ['market_row', 'harbour_court'];
      const drawn = drawIncidentSpec(state, { level: 10, trust: 80, contentVersion: DECISION_DEPTH_CONTENT_VERSION, avoidFamilies: avoid, unlockedTypes: TYPES });
      state = drawn.state;
      const families = SCENARIO_TYPES_V11.find(info => info.type === drawn.spec.type)!.families;
      expect(families).toContain(drawn.spec.familyId);
      if (families.some(id => !avoid.includes(id))) expect(avoid).not.toContain(drawn.spec.familyId);
    }
  });
});
