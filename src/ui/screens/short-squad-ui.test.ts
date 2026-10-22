// short-squad-ui: the squad card and Prepare say who stays home.
import { describe, expect, it } from 'vitest';
import { squadReadiness } from '../../sim/department-selectors';
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
});
