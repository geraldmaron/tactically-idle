import { it, expect } from 'vitest';
import { createInitialState } from '../department';
import { dispatch } from '../game';
import { serialize, deserialize } from '../save';
it('a campaign founded in each starting district saves and loads', () => {
  for (const districtId of ['pike', 'larkin', 'harbor'] as const) {
    const now = Date.UTC(2026, 9, 24);
    const s = createInitialState(now, 4242);
    s.world.onboarding.stage = 'founding';
    const out = dispatch(s, { type: 'foundDepartment', name: 'Night Unit', districtId }, { now });
    expect(out.result.ok, districtId).toBe(true);
    expect(deserialize(serialize(out.state, now)), districtId).not.toBeNull();
  }
});
