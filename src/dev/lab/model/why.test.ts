// Why can or can't this happen: requirement trees checked clause by clause at a frame through the
// engine and the compiler, per situation and per draw, with writers and fixes.
import { describe, expect, it } from 'vitest';
import type { TreeIf } from '../../../content/call-trees/types';
import { dependencyIndex, requirementTree } from '../../../gen/incident/trees-v13/dependencies';
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
  it('rescue vehicle: the cert clause fails for squad A; fixes are a lab grant and a squad search', () => {
    const s = open('type=protected_rescue&tier=2');
    const deps = dependencyIndex(s.template);
    const target = { choice: ['wont_leave', 'vehicle'] as [string, string] };
    const req = requirementTree(s.tree, target);
    const { root, fixes } = evaluateReq(req, s, currentFrame(s), deps, target);
    const [cert] = leafOf(root, 'cert');
    expect(cert).toMatchObject({ label: 'Needs certification: vehicle operations', now: 'fail' });
    expect(leafOf(root, 'at')[0].now).toBe('pass');
    expect(root.now).toBe('fail');
    expect(fixes).toEqual(expect.arrayContaining([{ kind: 'grant-cert', cert: 'vehicle_operations' }, { kind: 'seek-squad', cert: 'vehicle_operations' }]));
    expect(fixes.some(fix => fix.kind === 'find-path')).toBe(false);
    // With the grant the clause and the choice hold, as the engine says.
    const granted = open('type=protected_rescue&tier=2&certs=vehicle_operations');
    const again = evaluateReq(req, granted, currentFrame(granted), deps, target);
    expect(leafOf(again.root, 'cert')[0].now).toBe('pass');
    expect(again.root.now).toBe('pass');
    expect(again.fixes).toEqual([]);
    expect(currentFrame(granted).views.find(view => view.id.endsWith('_wont_leave_vehicle'))!.eligible).toBe(true);
  });

  it('a notMarks clause lists the sites that write the mark, and fails once it is set', () => {
    const s = open(REFERENCE);
    const deps = dependencyIndex(s.template);
    const target = { choice: ['talking', 'take_account'] as [string, string] };
    const req = requirementTree(s.tree, target);
    const at = evaluateReq(req, s, currentFrame(s), deps, target);
    const [account] = leafOf(at.root, 'mark');
    expect(account.node).toEqual({ leaf: { kind: 'mark', mark: 'account', want: false } });
    expect(account.label).toMatch(/^Mark not set: /);
    expect(account.writers.length).toBeGreaterThan(0);
    expect(account.writers).toEqual(deps.keys.get('mark:account')!.writers);
    expect(account.now).toBe('pass');
    // Not at the node yet: a state clause fails, so the fix is a path to where it is eligible.
    expect(leafOf(at.root, 'at')[0].now).toBe('fail');
    expect(at.fixes).toContainEqual({ kind: 'find-path', goal: { eligible: 't13_hostage_crisis_talking_take_account' } });
    // Where the account is taken, the clause fails.
    const taken = explore(s.frames[0].state, { flags: ['mark:account', 'at:talking'] });
    expect(taken.path).not.toBeNull();
    const there = currentFrame(replayTokens(s, taken.path!));
    const after = evaluateReq(req, s, there, deps, target);
    expect(leafOf(after.root, 'mark')[0].now).toBe('fail');
    expect(leafOf(after.root, 'at')[0].now).toBe('pass');
    expect(there.views.find(view => view.id === 't13_hostage_crisis_talking_take_account')).toBeUndefined();
  }, 30000);

  it('reads a fact `if` per situation from the hidden truth', () => {
    const s = open(REFERENCE);
    const deps = dependencyIndex(s.template);
    const found = s.tree.nodes.flatMap(node => node.choices.flatMap(choice => (['favorable', 'mixed', 'adverse'] as const).flatMap(band =>
      choice.outcomes[band].flatMap((outcome, index) => ([] as TreeIf[]).concat(outcome.if ?? []).some(entry => 'fact' in entry && entry.fact === 'owner_faint' && entry.is)
        ? [{ outcome: [node.id, choice.id, band, index] as [string, string, typeof band, number] }] : [])))) [0];
    expect(found).toBeDefined();
    const { root } = evaluateReq(requirementTree(s.tree, found), s, currentFrame(s), deps, found);
    const [fact] = leafOf(root, 'fact');
    const truth = s.tree.situations.map(situation => situation.truth.owner_faint);
    expect(fact.bySituation).toEqual(truth.map(t => (t ? 'pass' : 'fail')));
    expect(fact.now).toBe(truth[s.situation] ? 'pass' : 'fail');
    expect(fact.writers).toEqual(deps.keys.get('situation')!.writers);
    expect(root.bySituation).not.toBeNull();
    expect(leafOf(root, 'band')[0].now).toBe('unknown');
  });

  it('says what the draw needs, and offers a draw that has it', () => {
    const s = open(REFERENCE);
    const deps = dependencyIndex(s.template);
    // A node reached only through a turn this call did not draw.
    const [group, members] = Object.entries(s.tree.turns!)[0];
    const other = members.find(node => node !== s.turnDrawn[group])!;
    const { root, fixes } = evaluateReq(requirementTree(s.tree, { node: other }), s, currentFrame(s), deps, { node: other });
    const turns = leafOf(root, 'turn');
    expect(turns.length).toBeGreaterThan(0);
    expect(turns[0]).toMatchObject({ now: 'fail', draw: expect.stringMatching(/^needs turn .+; this call drew /) });
    expect(fixes).toContainEqual({ kind: 'seek-draw', want: { turns: { [group]: other } } });
  });

  it('marks the exhausted-choices fallback as never known ahead', () => {
    const s = open(REFERENCE);
    const req: ReqNode = requirementTree(s.tree, { ending: 'handed_over' });
    const { root } = evaluateReq(req, s, currentFrame(s), dependencyIndex(s.template), { ending: 'handed_over' });
    expect(root).toMatchObject({ now: 'unknown', label: 'Reached only when no choice is left', children: [] });
  });
});

describe('holdsAt', () => {
  it('holds where no clause fails (dice count as possible), and agrees with the context from a bare state', () => {
    const s = open(REFERENCE);
    const req = requirementTree(s.tree, { choice: [s.tree.root, s.tree.nodes[0].choices[0].id] });
    const start = s.frames[0].state;
    expect(holdsAt(req, start, s)).toBe(true);
    expect(holdsAt(requirementTree(s.tree, { choice: ['talking', 'take_account'] }), start, s)).toBe(false);
    const ctx = stateContext(start)!;
    expect(ctx.tree).toBe(s.tree);
    expect(ctx.counts).toEqual(s.counts);
    expect(ctx.turnDrawn).toEqual(s.turnDrawn);
    expect(ctx.situation).toBe(s.situation);
  });
});

describe('blockedBecause', () => {
  it('names the hidden truth that rules an ending out of this situation', () => {
    // Every route into owner_killed needs lets_go false; situation 2 of the reference call has it true.
    const s = open(REFERENCE);
    const deps = dependencyIndex(s.template);
    const text = blockedBecause(s, { ending: 'owner_killed' }, deps);
    expect(text).toMatch(/^Every route there needs the hidden truth “.+” to be false, and situation 2 has it true\.$/);
    // The same ending in situation 3 is reachable: nothing fixed rules it out.
    expect(blockedBecause(open('type=hostage_crisis&family=market_row&seed=7&tier=2&variant=2'), { ending: 'owner_killed' }, deps)).toBeNull();
  });

  it('names the missing cert for a locked choice, and nothing once it is granted', () => {
    const s = open('type=protected_rescue&tier=2');
    const goal = { eligible: 't13_protected_rescue_wont_leave_vehicle' };
    expect(blockedBecause(s, goal, dependencyIndex(s.template), 'squad A (719)')).toBe('It needs certification in vehicle operations, and squad A (719) has none.');
    expect(blockedBecause(open('type=protected_rescue&tier=2&certs=vehicle_operations'), goal, null)).toBeNull();
  });

  it('says nothing for goals the play itself decides', () => {
    const s = open(REFERENCE);
    expect(blockedBecause(s, { node: 'talking' }, null)).toBeNull();
    expect(blockedBecause(s, { flags: ['mark:account'] }, null)).toBeNull();
  });
});
