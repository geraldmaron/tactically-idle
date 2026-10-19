// short-squad-ui: the squad card and Prepare say who stays home, and Prepare's radio plan counts
// only the officers who go (deployRoster), the same crew Deploy reserves radios for.
import { describe, expect, it } from 'vitest';
import { squadReadiness } from '../../sim/department-selectors';
import { departmentUpkeep } from '../../sim/equipment-manager-policy';
import { deployRoster } from '../../sim/squads';
import { standardRadioPlan } from '../../sim/standard-kit';
import { makeState, NOW } from '../../sim/test-fixtures';
import { staysHomeLine } from './helpers';

function shortA() {
  const s = makeState();
  s.officers.off_vale.injury = { label: 'Sprained wrist', until: NOW + 24 * 3600_000 };
  return s;
}

describe('a squad deploying short', () => {
  it('names the officer who stays home', () => {
    const s = shortA();
    const card = squadReadiness(s, 'A', NOW);
    expect(card.deployable).toBe(true);
    expect(staysHomeLine(s, card.staysHome)).toBe('Deploys without Vale');
    expect(card.staysHome).toHaveLength(1);
  });

  it('says nothing for a squad where everyone goes', () => {
    expect(squadReadiness(makeState(), 'A', NOW).staysHome).toEqual([]);
  });

  it('plans one radio per officer who goes, not per squad member', () => {
    const s = shortA();
    const everyone = standardRadioPlan(s, ['A'], NOW, departmentUpkeep(s));
    const crew = standardRadioPlan(s, ['A'], NOW, departmentUpkeep(s), sid => deployRoster(s, sid, NOW).goes);
    expect(Object.values(everyone.loadouts.A)[0]).toBe(4);
    expect(Object.values(crew.loadouts.A)[0]).toBe(3);
  });
});
