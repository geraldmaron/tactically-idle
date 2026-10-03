import { describe, expect, it } from 'vitest';
import { createInitialState } from './department';
import { hqOverview } from './hq-selectors';
const NOW = Date.UTC(2026, 9, 3);
describe('truthful department overview', () => {
  it('separates personnel from standard-radio availability', () => {
    const state = createInitialState(NOW, 1); const view = hqOverview(state, NOW);
    expect(view.totalOfficers).toBe(8); expect(view.radios.required).toBe(8);
    expect(view.radios.shortage).toBeGreaterThan(0);
    expect(view.deployable).toBeGreaterThan(view.radios.available);
    expect(view.fresh + view.strained).toBe(view.deployable);
  });
  it('counts real injury, training and mandatory-recovery blockers, not stress alone', () => {
    const state = createInitialState(NOW, 1); const [a,b,c] = Object.values(state.officers);
    a.stress = 0; a.injury = { label:'Recovery', until: NOW + 10000 };
    b.stress = 0; b.assignment = { kind:'training', courseId:'crisis_negotiation', startedAt:NOW, endsAt:NOW + 10000 };
    c.stress = 80;
    const view = hqOverview(state,NOW);
    expect(view.unavailable).toBeGreaterThanOrEqual(3); expect(view.training).toBe(1);
    expect(view.fresh).toBeLessThanOrEqual(5);
  });
  it('a strained officer remains deployable but is never labeled fresh', () => {
    const state = createInitialState(NOW, 1);
    for (const officer of Object.values(state.officers)) { officer.stress = 60; officer.assignment = null; officer.injury = null; }
    const view = hqOverview(state,NOW); expect(view.deployable).toBe(8); expect(view.fresh).toBe(0); expect(view.strained).toBe(8);
  });
});
