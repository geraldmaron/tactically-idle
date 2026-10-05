import { describe, expect, it } from 'vitest';
import type { EnvironmentDefinition } from '../../sim/scenario-types';
import { relevantEnvironmentChips } from './incident';
const ordinary: EnvironmentDefinition = { timeOfDay: 'night', weather: 'clear', power: 'on', clutter: 0, hazards: [], communication: 'normal', crowd: 0, keyholder: false, plansOnFile: false, alarm: 'none', cctv: false };
describe('briefing scene conditions', () => {
  it('does not turn routine absence boilerplate into a wall of planning chips', () => expect(relevantEnvironmentChips(ordinary).map(c => c.label)).toEqual(['Night']));
  it('keeps real aids and constraints discoverable before commitment', () => {
    const keys = relevantEnvironmentChips({ ...ordinary, power: 'off', keyholder: true, crowd: 2, cctv: true }).map(c => c.key);
    expect(keys).toEqual(['time', 'power', 'crowd', 'key', 'cctv']);
  });
});
