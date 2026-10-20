import { describe, expect, it } from 'vitest';
import type { Department } from './types';
import { REPUTATION_TUNING, effectiveLean, postureOf, recordPosture, reputationContributor, reputationWeights } from './reputation';

const dep = () => ({ reputation: undefined } as Pick<Department, 'reputation'> as Department);
const choice = (over: Partial<Parameters<typeof postureOf>[0]> = {}) => ({ check: { kind: 'observation' as const, ratings: [], difficulty: 0 }, ...over });

describe('posture of a choice', () => {
  it('reads force, talk, assertive and patient from what the choice does', () => {
    expect(postureOf(choice({ authority: { kind: 'entry' } as never }))).toBe('force');
    expect(postureOf(choice({ check: { kind: 'contact', ratings: [], difficulty: 0 } }))).toBe('talk');
    expect(postureOf(choice({ tempo: 'urgent' }))).toBe('assertive');
    expect(postureOf(choice({ tempo: 'waiting' }))).toBe('patient');
    expect(postureOf(choice())).toBeNull();
  });
});

describe('department reputation', () => {
  it('stays silent until the department has a record', () => {
    const d = dep();
    for (let i = 0; i < REPUTATION_TUNING.warmup - 1; i++) recordPosture(d, 'force');
    expect(effectiveLean(d)).toBe(0);
    expect(reputationContributor(d, 'contact')).toBeNull();
  });

  it('a hard name costs talking and helps entries, within the cap', () => {
    const d = dep();
    for (let i = 0; i < 40; i++) recordPosture(d, 'force');
    const talk = reputationContributor(d, 'contact')!;
    const entry = reputationContributor(d, 'execution')!;
    expect(talk.source).toBe('reputation');
    expect(talk.value).toBeLessThan(0);
    expect(entry.value).toBeGreaterThan(0);
    expect(Math.abs(talk.value)).toBeLessThanOrEqual(REPUTATION_TUNING.maxPoints);
    expect(reputationContributor(d, 'medical')).toBeNull();
  });

  it('a patient name helps talking and costs entries', () => {
    const d = dep();
    for (let i = 0; i < 40; i++) recordPosture(d, 'talk');
    expect(reputationContributor(d, 'contact')!.value).toBeGreaterThan(0);
    expect(reputationContributor(d, 'execution')!.value).toBeLessThan(0);
  });

  it('fades back as the department changes how it works', () => {
    const d = dep();
    for (let i = 0; i < 40; i++) recordPosture(d, 'force');
    const hard = d.reputation!.lean;
    for (let i = 0; i < 40; i++) recordPosture(d, 'talk');
    expect(d.reputation!.lean).toBeLessThan(hard);
  });

  it('tilts the board toward the calls the name draws, and leaves it alone without one', () => {
    const base = { active_armed_incident: 1, barricaded: 1, hostage_crisis: 1, protected_rescue: 1 };
    expect(reputationWeights(dep(), base)).toEqual(base);
    const d = dep();
    for (let i = 0; i < 40; i++) recordPosture(d, 'force');
    const w = reputationWeights(d, base);
    expect(w.active_armed_incident!).toBeGreaterThan(1);
    expect(w.hostage_crisis!).toBeLessThan(1);
  });
});
