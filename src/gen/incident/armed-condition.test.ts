// TreeState.armed (R-G1): text that names what a group's members hold, kept per call by the drawn
// cast like `count`, and only behind a mark that a favorable look into their room sets, so it never
// shows what the team hasn't seen. Exercised on the group fixture compiled on a real building.
import { describe, expect, it } from 'vitest';
import type { CallTree, TreeChoice } from '../../content/call-trees/types';
import type { IncidentTemplate } from '../../content/incidents/types';
import { buildLocation } from '../../sim/location';
import { generateIncident } from './index';
import { compileIncident, drawInstance, hostedSpec } from './instance';
import { armedKey, countHolds, memberCounts, treeForCounts } from './trees-v13/compile';
import { callStringRows } from './trees-v13/strings';
import { requirementTree } from './trees-v13/dependencies';
import { GROUP_TEMPLATE, GROUP_TREE } from './trees-v13/group-fixture';

const ARMED_LINE = 'Through the glass the team sees what {others.first} has in {others.his} hand.';

/** The fixture with its glass watch turned into a look into the counter room that sets `seen` on a
 * favorable result, an extra mark-setter where a test needs one, and an `armed` line in `talk`. */
function variant(opts: { marks?: string[]; alsoSetBy?: 'call' | 'watch_mixed'; fallBack?: 'setter' | 'other' } = {}): IncidentTemplate {
  const tree: CallTree = structuredClone(GROUP_TREE);
  const open = tree.nodes.find(node => node.id === 'open')!;
  const watch = open.choices.find(choice => choice.id === 'watch')!;
  watch.team = { to: { vantage: 'taker' }, signal: { channel: 'visual', to: 'taker' } };
  watch.outcomes.favorable[0].mark = ['seen'];
  if (opts.alsoSetBy === 'call') open.choices.find(choice => choice.id === 'call')!.outcomes.favorable[0].mark = ['seen'];
  if (opts.alsoSetBy === 'watch_mixed') watch.outcomes.mixed[0].mark = ['seen'];
  if (opts.fallBack === 'setter') watch.outcomes.favorable[0].back = true;
  if (opts.fallBack === 'other') watch.outcomes.favorable.push({ when: { count: { role: 'others', min: 1 } }, text: 'The blinds come down as the team settles in.', back: true });
  const talk = tree.nodes.find(node => node.id === 'talk')!;
  const hold: TreeChoice = talk.choices.find(choice => choice.id === 'hold')!;
  hold.outcomes.favorable.push({ when: { armed: { role: 'others' }, ...(opts.marks ? { marks: opts.marks } : {}) }, text: ARMED_LINE });
  return { ...GROUP_TEMPLATE, tree };
}

/** The first call seed whose draw gives `members` others, compiled with `template`. */
function compiled(template: IncidentTemplate, members: number) {
  for (let seed = 1; seed < 600; seed++) {
    const { clocks: _c, incidentPeople: _p, threats: _t, ...base } = generateIncident({ type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: 13 });
    const spec = hostedSpec(base), built = buildLocation(base.locationFamilyId, base.locationSeed);
    let instance;
    try { instance = drawInstance(template, built, spec); } catch { continue; }
    if ((memberCounts(instance.placed).others ?? 0) !== members) continue;
    return { instance, compile: () => compileIncident({ ...base, id: `armed-${members}-${seed}`, incident: spec }, built, template) };
  }
  throw new Error(`No seed draws ${members} others`);
}

describe('TreeState.armed is settled per call from the drawn cast', () => {
  it('holds when at least `min` members hold a weapon a look would see', () => {
    expect(countHolds({ armed: { role: 'others' } }, { [armedKey('others')]: 1 })).toBe(true);
    expect(countHolds({ armed: { role: 'others', min: 2 } }, { [armedKey('others')]: 1 })).toBe(false);
    expect(countHolds({ armed: { role: 'others' } }, { [armedKey('others')]: 0 })).toBe(false);
    // Counts with no armed entry (the lab, the string checks) don't know, so the line stays in view.
    expect(countHolds({ armed: { role: 'others' } }, { others: 3 })).toBe(true);
  });

  it('counts the members the fixture arms, and none when there are none', () => {
    expect(compiled(variant({ marks: ['seen'] }), 2).instance.placed.armed).toEqual({ others: 2 });
    expect(compiled(variant({ marks: ['seen'] }), 0).instance.placed.armed).toEqual({ others: 0 });
  });

  it('strips the condition once settled and drops what fails', () => {
    const tree = variant({ marks: ['seen'] }).tree;
    const line = (t: CallTree) => t.nodes.find(node => node.id === 'talk')!.choices.find(choice => choice.id === 'hold')!.outcomes.favorable.find(outcome => outcome.text === ARMED_LINE);
    expect(line(treeForCounts(tree, { others: 2, [armedKey('others')]: 2 }))?.when).toEqual({ marks: ['seen'] });
    expect(line(treeForCounts(tree, { others: 2, [armedKey('others')]: 0 }))).toBeUndefined();
  });
});

describe('the string checks see text behind TreeState.armed', () => {
  it('keeps an armed-only line when only group sizes are known, and drops it only on a known zero', () => {
    const tree = variant({ marks: ['seen'] }).tree;
    const has = (counts: Record<string, number>) => callStringRows(tree, text => text, counts).some(row => row.text === ARMED_LINE);
    expect(has({ others: 2 })).toBe(true);
    expect(has({ others: 2, [armedKey('others')]: 0 })).toBe(false);
  });
});

describe('text behind TreeState.armed waits for a look into the group’s room', () => {
  it('compiles when only a favorable look into their room sets the mark, and keeps the line', () => {
    const s = compiled(variant({ marks: ['seen'] }), 2).compile();
    expect(JSON.stringify(s)).toContain('Through the glass the team sees what');
  });

  it('drops the line in a call where no member is armed', () => {
    expect(JSON.stringify(compiled(variant({ marks: ['seen'] }), 0).compile())).not.toContain('Through the glass the team sees what');
  });

  it('rejects the condition with no mark at all', () => {
    expect(() => compiled(variant(), 2).compile()).toThrow(/reads what others hold before the team has seen it/);
  });

  it('rejects a mark a phone call also sets', () => {
    expect(() => compiled(variant({ marks: ['seen'], alsoSetBy: 'call' }), 2).compile()).toThrow(/reads what others hold/);
  });

  it('rejects a look that sends the team back, on the setting outcome or beside it, since sightings settle nothing then', () => {
    expect(() => compiled(variant({ marks: ['seen'], fallBack: 'setter' }), 2).compile()).toThrow(/reads what others hold/);
    expect(() => compiled(variant({ marks: ['seen'], fallBack: 'other' }), 2).compile()).toThrow(/reads what others hold/);
  });

  it('rejects a mark the look also sets on a mixed result, when sightings settle nothing', () => {
    expect(() => compiled(variant({ marks: ['seen'], alsoSetBy: 'watch_mixed' }), 2).compile()).toThrow(/reads what others hold/);
  });
});

describe('the requirement tree names an armed condition (the lab’s Why panel)', () => {
  const tree = variant({ marks: ['seen'] }).tree;
  const index = tree.nodes.find(node => node.id === 'talk')!.choices.find(choice => choice.id === 'hold')!.outcomes.favorable.findIndex(outcome => outcome.text === ARMED_LINE);

  it('an outcome behind TreeState.armed requires the armed leaf, beside its reveal mark', () => {
    const req = requirementTree(tree, { outcome: ['talk', 'hold', 'favorable', index] });
    expect(req).toMatchObject({ all: expect.arrayContaining([{ leaf: { kind: 'armed', role: 'others' } }, { leaf: { kind: 'mark', mark: 'seen', want: true } }]) });
  });

  it('carries min when the condition sets one', () => {
    const two = structuredClone(tree);
    two.nodes.find(node => node.id === 'talk')!.choices.find(choice => choice.id === 'hold')!.outcomes.favorable[index].when!.armed!.min = 2;
    expect(requirementTree(two, { outcome: ['talk', 'hold', 'favorable', index] })).toMatchObject({ all: expect.arrayContaining([{ leaf: { kind: 'armed', role: 'others', min: 2 } }]) });
  });
});
