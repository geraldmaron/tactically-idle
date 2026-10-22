import { describe, expect, it } from 'vitest';
import type { ActionView, GameState } from './types';
import { actionViews, lastResolution, prepCheck } from './operation-selectors';
import { joinSquadNames, squadName, squadNamesOf } from './squad-names';
import { apply, makeState, NOW, startCmd, startRun } from './test-fixtures';

const A = 'Night Owls';
const B = 'Harbor Unit';
const renamed = (s: GameState): GameState => {
  const c = structuredClone(s);
  c.squads.find((squad) => squad.id === 'A')!.name = A;
  c.squads.find((squad) => squad.id === 'B')!.name = B;
  return c;
};
/** Every string a squad label can reach on a call view: reasons, contributor labels, overlay labels. */
const texts = (v: ActionView): string[] => [v.reason ?? '', v.summary, ...v.contributors.map((c) => c.label), ...v.overlays.map((o) => o.label ?? '')];
const STALE = /\bSquad [A-D]\b/;

describe('the squad name source', () => {
  const squads = [{ id: 'A' as const, name: 'Night Owls' }, { id: 'B' as const, name: 'Harbor Unit' }];
  it('names a squad as the player named it, and falls back for an id nobody holds', () => {
    expect(squadName(squads, 'A')).toBe('Night Owls');
    expect(squadName(squads, 'C')).toBe('Squad C');
    expect(squadNamesOf(squads, ['B', 'A'])).toEqual(['Harbor Unit', 'Night Owls']);
  });
  it('joins one, two and three names', () => {
    expect(joinSquadNames(['Alpha'])).toBe('Alpha');
    expect(joinSquadNames(['Alpha', 'Bravo'])).toBe('Alpha and Bravo');
    expect(joinSquadNames(['Alpha', 'Bravo', 'Charlie'])).toBe('Alpha, Bravo and Charlie');
  });
});

describe('a renamed squad shows its name on every sim producer', () => {
  it('prep checks and start refusals name the squads', () => {
    const s = renamed(makeState());
    expect(prepCheck(s, NOW, startCmd('ms_occupancy', ['A', 'A'])).issues.join('|')).toContain('A squad cannot be deployed twice');
    const unknown = prepCheck(s, NOW, startCmd('ms_occupancy', ['D']));
    expect(unknown.issues.join('|')).toContain('Squad D does not exist');
    const tired = structuredClone(s);
    for (const id of tired.squads.find((squad) => squad.id === 'A')!.officerIds) tired.officers[id].stress = 85;
    const refused = apply(tired, startCmd('ms_occupancy', ['A']));
    expect(refused.result.ok).toBe(false);
    if (!refused.result.ok) expect(refused.result.reason).toMatch(new RegExp(`^${A}: nobody is ready`));
  });

  it('action reasons, contributors and overlays name the squads, with no "Squad A" left', () => {
    const s = startRun(renamed(makeState()), 'ms_occupancy', ['A', 'B']);
    const all = ['A', 'B'].flatMap((focus) => actionViews(s, NOW, focus as 'A' | 'B').flatMap(texts));
    expect(all.filter((text) => STALE.test(text))).toEqual([]);
    expect(all.some((text) => text.includes(A) || text.includes(B))).toBe(true);
    const contact = actionViews(s, NOW, 'B').find((v) => v.id === 'ms_contact')!;
    if (!contact.eligible) expect(contact.reason).toContain(`${B} has none`);
  });

  it('a committed decision explains itself with the squad name', () => {
    const s = startRun(renamed(makeState()), 'ms_occupancy', ['A']);
    const action = actionViews(s, NOW, 'A').find((v) => v.eligible)!;
    const done = apply(s, { type: 'decide', actionId: action.id, actingSquadIds: ['A'], supportSquadIds: [] });
    expect(done.result.ok).toBe(true);
    const explanation = lastResolution(done.state)?.explanation ?? [];
    expect(explanation.join(' ')).toContain(`(${A})`);
    expect(explanation.join(' ')).not.toMatch(STALE);
  });
});
