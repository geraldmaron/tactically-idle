// A face's condition (face-status.ts): an injury outranks being on a call, and the words keep the
// stress band apart (overloaded officers cannot take high-risk actions, strained ones can).
import { describe, expect, it } from 'vitest';
import { makeState, NOW } from '../../sim/test-fixtures';
import { STRESS_BANDS } from '../../sim/officer';
import { officerFaceStatus } from './face-status';

describe('officerFaceStatus', () => {
  it('shows an injury even while the officer is assigned to a call', () => {
    const g = makeState();
    const id = Object.keys(g.officers)[0];
    g.officers[id] = { ...g.officers[id], assignment: { kind: 'operation', runId: 'run_1' }, injury: { label: 'Sprained wrist', until: NOW + 3_600_000 } };
    expect(officerFaceStatus(g, id, NOW)?.mark).toBe('injured');
  });

  it('names the band and the number, and draws ring and color from the same stress', () => {
    const g = makeState();
    const id = Object.keys(g.officers)[0];
    g.officers[id] = { ...g.officers[id], stress: STRESS_BANDS.overloaded, assignment: null, injury: null };
    const status = officerFaceStatus(g, id, NOW)!;
    expect(status.stress).toBe(STRESS_BANDS.overloaded);
    expect(status.band).toBe('overloaded');
    expect(status.label).toContain(`overloaded, stress ${STRESS_BANDS.overloaded}`);
  });
});
