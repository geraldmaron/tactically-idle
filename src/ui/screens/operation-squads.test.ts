import { describe, expect, it } from 'vitest';
import { bestFitSquad } from './operation-squads';

describe('the one-squad preselection', () => {
  it('picks the deployable squad with the most officers fit to go', () => {
    expect(bestFitSquad([{ id: 'A', deployable: true, ready: 3 }, { id: 'B', deployable: true, ready: 4 }])).toBe('B');
  });
  it('keeps the first listed squad on a tie', () => {
    expect(bestFitSquad([{ id: 'A', deployable: true, ready: 4 }, { id: 'B', deployable: true, ready: 4 }])).toBe('A');
  });
  it('skips a squad that cannot deploy, however many are ready', () => {
    expect(bestFitSquad([{ id: 'A', deployable: false, ready: 4 }, { id: 'B', deployable: true, ready: 1 }])).toBe('B');
  });
  it('picks nobody when no squad can deploy', () => {
    expect(bestFitSquad([{ id: 'A', deployable: false, ready: 0 }])).toBeNull();
    expect(bestFitSquad([])).toBeNull();
  });
});
