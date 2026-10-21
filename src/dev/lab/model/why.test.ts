// Why can or can't this happen: requirement trees checked clause by clause at a frame through the
// engine and the compiler, per situation and per draw, with writers and fixes.
import { describe, expect, it } from 'vitest';
import { labRequirementTree, treeClockRoutes } from './clocks';
import { certWords } from './squads';
import { certSubjects } from './test-subjects';
import type { TreeIf } from '../../../content/call-trees/types';
import { dependencyIndex } from '../../../gen/incident/trees-v13/dependencies';
import type { ReqNode } from '../../../gen/incident/trees-v13/dependencies';
import { parseLabUrl } from '../url';
import { explore } from './explore';
import { currentFrame, openSession, replayTokens } from './session';
import type { Session } from './session';
import type { EvaluatedReq } from './why';
import { blockedBecause, evaluateReq, holdsAt, stateContext } from './why';

const REFERENCE = 'type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1';

function open(query: string): Session {
  const opened = openSession(parseLabUrl(`?${query}`).url, null);
  if (!('frames' in opened)) throw new Error(opened.message);
  return opened;
}
const leaves = (e: EvaluatedReq): EvaluatedReq[] => 'leaf' in e.node ? [e] : e.children.flatMap(leaves);
const leafOf = (e: EvaluatedReq, kind: string) => leaves(e).filter(entry => 'leaf' in entry.node && entry.node.leaf.kind === kind);

describe('evaluateReq', () => {
  // A root choice that needs a cert squad A lacks: on a shipped call that has one, and always on the
  // certification fixture (model/test-subjects.ts), so the property never goes untested.
  for (const subject of certSubjects()) it(`${subject.source}: the cert clause fails for squad A; fixes are a lab grant and a squad search`, () => {
    subject.withSessions((s, granted) => {
      const deps = dependencyIndex(s.template);
      const target = { choice: [subject.node, subject.choice] as [string, string] };
      const req = labRequirementTree(s.tree, target, treeClockRoutes(s.tree, s.template));
      const { root, fixes } = evaluateReq(req, s, currentFrame(s), deps, target);
      const [cert] = leafOf(root, 'cert');
      expect(cert).toMatchObject({ label: `Needs certification: ${certWords(subject.cert)}`, now: 'fail' });
      expect(leafOf(root, 'at')[0].now).toBe('pass');
      expect(root.now).toBe('fail');
      expect(fixes).toEqual(expect.arrayContaining([{ kind: 'grant-cert', cert: subject.cert }, { kind: 'seek-squad', cert: subject.cert }]));
      expect(fixes.some(fix => fix.kind === 'find-path')).toBe(false);
      // With the grant the clause and the choice hold, as the engine says.
      const again = evaluateReq(req, granted, currentFrame(granted), deps, target);
      expect(leafOf(again.root, 'cert')[0].now).toBe('pass');
      expect(again.root.now).toBe('pass');
      expect(again.fixes).toEqual([]);
      expect(currentFrame(granted).views.find(view => view.id === subject.actionId)!.eligible).toBe(true);
    });
  });

  it('a notMarks clause lists the sites that write the mark, and fails once it is set', () => {
    const s = open(REFERENCE);
    const deps = dependencyIndex(s.template);
    const target = { choice: ['on_air', 'team_glass'] as [string, string] };
    const req = labRequirementTree(s.tree, target);
    const at = evaluateReq(req, s, currentFrame(s), deps, target);
    const [account] = leafOf(at.root, 'mark');
    expect(account.node).toEqual({ leaf: { kind: 'mark', mark: 'looked', want: false } });
    expect(account.label).toMatch(/^Mark not set: /);
    expect(account.writers.length).toBeGreaterThan(0);
    expect(account.writers).toEqual(deps.keys.get('mark:looked')!.writers);
    expect(account.now).toBe('pass');
    // Not at the node yet: a state clause fails, so the fix is a path to where it is eligible.
    expect(leafOf(at.root, 'at')[0].now).toBe('fail');
    expect(at.fixes).toContainEqual({ kind: 'find-path', goal: { eligible: 't13_hostage_crisis_on_air_team_glass' } });
    // Where the squad already watched from the corner, the clause fails.
    const taken = explore(s.frames[0].state, { flags: ['mark:looked', 'at:on_air'] });
    expect(taken.path).not.toBeNull();
    const there = currentFrame(replayTokens(s, taken.path!));
    const after = evaluateReq(req, s, there, deps, target);
    expect(leafOf(after.root, 'mark')[0].now).toBe('fail');
    expect(leafOf(after.root, 'at')[0].now).toBe('pass');
    expect(there.views.find(view => view.id === 't13_hostage_crisis_on_air_team_glass')).toBeUndefined();
  }, 30000);

  it('reads a fact `if` per situation from the hidden truth', () => {
    const s = open(REFERENCE);
    const deps = dependencyIndex(s.template);
    const found = s.tree.nodes.flatMap(node => node.choices.flatMap(choice => (['favorable', 'mixed', 'adverse'] as const).flatMap(band =>
      choice.outcomes[band].flatMap((outcome, index) => ([] as TreeIf[]).concat(outcome.if ?? []).some(entry => 'fact' in entry && entry.fact === 'rider_clear' && entry.is)
        ? [{ outcome: [node.id, choice.id, band, index] as [string, string, typeof band, number] }] : [])))) [0];
    expect(found).toBeDefined();
    const { root } = evaluateReq(labRequirementTree(s.tree, found), s, currentFrame(s), deps, found);
    const [fact] = leafOf(root, 'fact');
    const truth = s.tree.situations.map(situation => situation.truth.rider_clear);
    expect(fact.bySituation).toEqual(truth.map(t => (t ? 'pass' : 'fail')));
    expect(fact.now).toBe(truth[s.situation] ? 'pass' : 'fail');
    expect(fact.writers).toEqual(deps.keys.get('situation')!.writers);
    expect(root.bySituation).not.toBeNull();
    expect(leafOf(root, 'band')[0].now).toBe('unknown');
    // The draw that has it: the first situation whose truth holds.
    const { fixes } = evaluateReq(labRequirementTree(s.tree, found), s, currentFrame(s), deps, found);
    if (!truth[s.situation]) expect(fixes).toContainEqual({ kind: 'seek-draw', want: { variant: truth.findIndex(Boolean) } });
  });

  // 'says what the draw needs, and offers a draw that has it' is removed: Going Live's one turn has
  // one member, so every call draws it and no node waits on an undrawn turn. The situation draw a
  // fact needs is offered in the fact test above.

  it('marks the exhausted-choices fallback as never known ahead', () => {
    const s = open(REFERENCE);
    const req: ReqNode = labRequirementTree(s.tree, { ending: 'handed_over' });
    const { root } = evaluateReq(req, s, currentFrame(s), dependencyIndex(s.template), { ending: 'handed_over' });
    expect(root).toMatchObject({ now: 'unknown', label: 'Reached only when no choice is left', children: [] });
  });
});

describe('holdsAt', () => {
  it('holds where no clause fails (dice count as possible), and agrees with the context from a bare state', () => {
    const s = open(REFERENCE);
    const req = labRequirementTree(s.tree, { choice: [s.tree.root, s.tree.nodes[0].choices[0].id] });
    const start = s.frames[0].state;
    expect(holdsAt(req, start, s)).toBe(true);
    expect(holdsAt(labRequirementTree(s.tree, { choice: ['on_air', 'team_glass'] }), start, s)).toBe(false);
    const ctx = stateContext(start)!;
    expect(ctx.tree).toBe(s.tree);
    expect(ctx.counts).toEqual(s.counts);
    expect(ctx.turnDrawn).toEqual(s.turnDrawn);
    expect(ctx.situation).toBe(s.situation);
  });
});

describe('blockedBecause', () => {
  it('names the hidden truth that rules an ending out of this situation', () => {
    // Every route into manager_killed needs raised true; situation 1 of the reference call has it false.
    const s = open(REFERENCE.replace('variant=1', 'variant=0'));
    expect(s.tree.situations[s.situation]!.truth.raised).toBe(false);
    const deps = dependencyIndex(s.template);
    const text = blockedBecause(s, { ending: 'manager_killed' }, deps);
    expect(text).toMatch(/^Every route there needs the hidden truth “.+” to be true, and situation 1 has it false\.$/);
    // The same ending in situation 2 is reachable: nothing fixed rules it out.
    expect(blockedBecause(open(REFERENCE), { ending: 'manager_killed' }, deps)).toBeNull();
  });

  for (const subject of certSubjects()) it(`${subject.source}: names the missing cert for a locked choice, and nothing once it is granted`, () => {
    subject.withSessions((s, granted) => {
      const goal = { eligible: subject.actionId };
      expect(blockedBecause(s, goal, dependencyIndex(s.template), 'squad A (719)')).toBe(`It needs certification in ${certWords(subject.cert)}, and squad A (719) has none.`);
      expect(blockedBecause(granted, goal, null)).toBeNull();
    });
  });

  it('says nothing for goals the play itself decides', () => {
    const s = open(REFERENCE);
    expect(blockedBecause(s, { node: 'on_air' }, null)).toBeNull();
    expect(blockedBecause(s, { flags: ['mark:looked'] }, null)).toBeNull();
  });
});
