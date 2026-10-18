import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../sim/department';
import type { Officer } from '../../sim/types';
import { filterRoster, officerFree, officerStatus, sortRoster, squadCoverage } from './squad-model';

const NOW = Date.UTC(2026, 9, 5);
const officers = () => Object.values(structuredClone(createInitialState(NOW, 120)).officers);

describe('roster status and coverage shown on squad tiles', () => {
  it('ranks injury over duty over the stress band', () => {
    const [o] = officers();
    o.stress = 10;
    expect(officerStatus(o, NOW)).toBe('ready');
    o.stress = 85;
    expect(officerStatus(o, NOW)).toBe('recovery');
    expect(officerFree(o, NOW)).toBe(false);
    o.assignment = { kind: 'training', courseId: 'composure_workshop', startedAt: NOW, endsAt: NOW + 1000 };
    expect(officerStatus(o, NOW)).toBe('training');
    o.injury = { label: 'Sprain', until: NOW + 1 };
    expect(officerStatus(o, NOW)).toBe('injured');
    expect(officerStatus(o, NOW + 2)).toBe('training');
  });

  it('reports every role and the strongest whole-number rating per skill without blending', () => {
    const team = officers().slice(0, 3);
    team[0].ratings.medical = 41.6;
    team[1].ratings.medical = 77.4;
    team[2].ratings.medical = 12;
    const coverage = squadCoverage(team);
    expect(coverage.roles).toHaveLength(5);
    expect(coverage.roles.reduce((total, entry) => total + entry.count, 0)).toBe(3);
    expect(coverage.best.find((entry) => entry.key === 'medical')).toEqual({ key: 'medical', value: 77, officerId: team[1].id });
    expect(squadCoverage([]).best.every((entry) => entry.value === 0 && entry.officerId === null)).toBe(true);
  });

  it('filters free and busy officers into disjoint sets and sorts deterministically', () => {
    const all = officers();
    all[0].assignment = { kind: 'operation', runId: 'run-1' };
    const free = filterRoster(all, 'free', NOW), busy = filterRoster(all, 'busy', NOW);
    expect(free.length + busy.length).toBe(all.length);
    expect(busy.map((o) => o.id)).toContain(all[0].id);
    const byStress = sortRoster(all, 'stress');
    expect(byStress.every((o, i) => i === 0 || byStress[i - 1].stress <= o.stress)).toBe(true);
    const bySquad = sortRoster(all, 'squad');
    const rank = (o: Officer) => (o.squadId ? o.squadId : '~');
    expect(bySquad.every((o, i) => i === 0 || rank(bySquad[i - 1]) <= rank(o))).toBe(true);
    expect(sortRoster(all, 'name')).toEqual(sortRoster([...all].reverse(), 'name'));
  });
});
