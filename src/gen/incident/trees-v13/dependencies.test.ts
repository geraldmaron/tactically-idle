import { describe, expect, it } from 'vitest';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import type { IncidentTemplate } from '../../../content/incidents/types';
import type { IncidentType } from '../../../sim/scenario-types';
import { countCombos, dependencyIndex, lintTree, plainTokens, requirementTree, roleNoun, siteKey, type ReqNode, type StateKey } from './dependencies';
import { GROUP_TEMPLATE } from './group-fixture';
import { armedWithoutHitMark } from './never-offered-fixture';

const TEMPLATES = Object.values(INCIDENT_TEMPLATES) as IncidentTemplate[];
const template = (type: IncidentType) => INCIDENT_TEMPLATES[type]!;
const entry = (type: IncidentType, key: StateKey) => dependencyIndex(template(type)).keys.get(key);
const codes = (type: IncidentType) => lintTree(template(type)).map(finding => `${finding.code}:${finding.key ?? finding.node ?? finding.ending}`);
const leaves = (req: ReqNode): unknown[] => 'leaf' in req ? [req.leaf] : ('all' in req ? req.all : req.any).flatMap(leaves);

describe('dependency index', () => {
  it('counts a clock running out as a writer of its mark and of harm to its owner', () => {
    const owner = entry('hostage_crisis', 'mark:owner_down')!;
    expect(owner.writers.filter(site => site.field === 'clock.onOut.mark')).toEqual([{ clock: 'owner_condition', situation: 1, field: 'clock.onOut.mark' }]);
    expect(entry('hostage_crisis', 'harm:owner')!.writers.some(site => site.field === 'clock.onOut.harm' && site.clock === 'owner_condition')).toBe(true);
    expect(entry('protected_rescue', 'mark:tank_empty')!.writers.filter(site => site.field === 'clock.onOut.mark').map(site => site.situation)).toEqual([0, 1, 2]);
    // A cue's mark writes too, and running out reads the clock.
    expect(entry('hostage_crisis', 'mark:owner_unwell')!.writers.some(site => site.field === 'clock.cue.mark')).toBe(true);
    expect(entry('hostage_crisis', 'clock:owner_condition')!.readers.some(site => site.field === 'clock.onOut.mark')).toBe(true);
  });

  it('labels a concession by the choice the player picks, never by its action id', () => {
    const concession = entry('hostage_crisis', 'promise:concession:t13_hostage_crisis_one_door_offer_record')!;
    expect(concession.label).toBe('Concession on “Offer a written account instead”');
    for (const t of TEMPLATES) for (const [key, value] of dependencyIndex(t).keys) if (key.startsWith('promise:concession:')) expect(value.label, key).not.toMatch(/t13_/);
  });

  it('writes a drawn hit’s mark as drawn, and force and cascade results as drawn releases', () => {
    expect(entry('active_armed_incident', 'mark:officer_down')!.writers.every(site => site.field === 'fire.mark' && site.drawn)).toBe(true);
    expect(entry('hostage_crisis', 'out:taker')!.writers.some(site => site.field === 'force.out' && site.drawn)).toBe(true);
    expect(entry('hostage_crisis', 'out:others')!.writers.some(site => site.field === 'cascade.out' && site.drawn)).toBe(true);
    // Safe is out too.
    expect(entry('hostage_crisis', 'out:courier')!.writers.some(site => site.field === 'outcome.safe')).toBe(true);
  });

  it('keys harm, scalars, meters, counts, turns and the situation, with the engine as a reader where only it reads', () => {
    for (const t of TEMPLATES) {
      const keys = [...dependencyIndex(t).keys.keys()];
      expect(keys.some(key => key.startsWith('harm:')), t.type).toBe(true);
      expect(keys.filter(key => key.startsWith('scalar:')).length, t.type).toBeGreaterThan(0);
      expect(keys, t.type).toContain('situation');
      for (const group of Object.keys(t.tree.turns ?? {})) expect(keys).toContain(`turn:${group}`);
    }
    expect(entry('hostage_crisis', 'harm:officer')!.readers).toEqual([{ field: 'engine', conditional: 'debrief, score, and refusals of later choices that involve them' }]);
    expect(entry('hostage_crisis', 'count:others')!.readers.length).toBeGreaterThan(0);
    expect(entry('hostage_crisis', 'meter:taker')!.readers.filter(site => site.field === 'outcome.if').length).toBe(25);
    // A fact branch reads the situation's truth, not what the team knows.
    expect(entry('hostage_crisis', 'situation')!.readers.length).toBe(134);
    expect(entry('protected_rescue', 'clock:oxygen')!.readers.filter(site => site.field === 'outcome.if').length).toBe(26);
  });

  it('labels every key in plain words, with no role token left', () => {
    for (const t of TEMPLATES) for (const { key, label } of dependencyIndex(t).keys.values()) {
      expect(label, key).not.toMatch(/[{}]/);
      expect(label, key).toMatch(/^[A-Z]/);
    }
    expect(entry('hostage_crisis', 'mark:turned')!.label).toBe('The former employee turned the handgun on the shop owner');
    expect(roleNoun(template('barricaded').tree, 'child')).toBe('child');
    expect(plainTokens('{taker.He} {taker~keeps|keep} {owner.first} in the {scene}', template('hostage_crisis').tree)).toBe('They keep the shop owner in the scene');
  });

  it('gives every site a stable key, and the same index on every walk', () => {
    expect(siteKey({ node: 'talking', choice: 'offer', band: 'mixed', outcome: 2, field: 'outcome.when', negated: true })).toBe('n.talking/c.offer/b.mixed/o.2/f.outcome.when/not');
    expect(siteKey({ clock: 'oxygen', situation: 0, field: 'clock.onOut.mark' })).toBe('k.oxygen/s.0/f.clock.onOut.mark');
    for (const t of TEMPLATES) expect(JSON.stringify([...dependencyIndex(t).keys.values()])).toBe(JSON.stringify([...dependencyIndex(t).keys.values()]));
  });
});

describe('static lint', () => {
  it('finds what the shipped trees are known to carry', () => {
    expect(codes('hostage_crisis')).toEqual(expect.arrayContaining(['threat_only:mark:turned', 'clock_writer:mark:owner_down']));
    expect(codes('barricaded')).toContain('threat_only:mark:rifle_at_door');
    expect(codes('active_armed_incident')).toContain('drawn_only:mark:officer_down');
    expect(codes('protected_rescue')).toContain('clock_writer:mark:tank_empty');
  });

  it('finds no unread mark, unset read, or unreachable node or ending in any shipped tree', () => {
    for (const t of TEMPLATES) expect(lintTree(t).filter(finding => ['read_never_written', 'dead_write', 'unreachable_node', 'unreachable_ending'].includes(finding.code)), t.type).toEqual([]);
  });

  it('counts a mark only a drawn hit sets as settable: the armed medic choice is offered', () => {
    // compile.ts counts `fire.mark` with outcome and clock marks, so the armed tree's "Get the
    // officer to the medic first" (onlyIf officer_down) compiles and lint finds nothing to drop.
    expect(lintTree(template('active_armed_incident')).filter(finding => finding.code === 'never_offered' || finding.code === 'never_matched')).toEqual([]);
    expect(codes('active_armed_incident')).toContain('drawn_only:mark:officer_down');
  });

  it('flags a choice the compiler drops in every call when nothing can set the mark it needs', () => {
    // The same choice with its mark's only writer (the hit) removed.
    const found = lintTree(armedWithoutHitMark()).filter(finding => finding.code === 'never_offered');
    expect(found.map(finding => finding.id)).toEqual(['never_offered:n.pinned/c.treat_ours/f.onlyIf']);
    expect(found[0].message).toContain('officer_down can never be set in this call');
  });

  it('keeps finding ids stable and unique across runs', () => {
    for (const t of [...TEMPLATES, GROUP_TEMPLATE]) {
      const ids = lintTree(t).map(finding => finding.id);
      expect(new Set(ids).size, t.type).toBe(ids.length);
      expect(lintTree(t).map(finding => finding.id)).toEqual(ids);
    }
  });

  it('reports a read nobody writes, a write nobody reads, and an unreachable node', () => {
    const base = template('barricaded');
    const tree = structuredClone(base.tree);
    tree.nodes[0].choices[0].onlyIf = { marks: ['ghost'] };
    tree.nodes[0].choices[1].outcomes.favorable[0].mark = [...tree.nodes[0].choices[1].outcomes.favorable[0].mark ?? [], 'orphan'];
    tree.nodes.push({ ...structuredClone(tree.nodes[tree.nodes.length - 1]), id: 'island' });
    const found = lintTree({ ...base, tree });
    expect(found.find(finding => finding.code === 'read_never_written')?.key).toBe('mark:ghost');
    expect(found.find(finding => finding.code === 'dead_write')?.key).toBe('mark:orphan');
    expect(found.find(finding => finding.code === 'unreachable_node')?.node).toBe('island');
    expect(found.find(finding => finding.code === 'never_offered')?.message).toContain('ghost can never be set');
  });

  it('covers every group size the template draws', () => {
    expect(countCombos(template('hostage_crisis'))).toEqual([{ others: 0 }, { others: 1 }, { others: 2 }]);
    expect(countCombos(template('barricaded'))).toEqual([{}]);
  });
});

describe('requirement trees', () => {
  it('names the cert a rescue vehicle choice needs', () => {
    expect(leaves(requirementTree(template('protected_rescue').tree, { choice: ['wont_leave', 'vehicle'] }))).toContainEqual({ kind: 'cert', cert: 'vehicle_operations' });
  });

  it('reads a choice’s state, a prompt variant’s order, and an outcome’s band and hidden conditions', () => {
    const tree = template('hostage_crisis').tree;
    const node = tree.nodes.find(entry => (entry.promptIf?.length ?? 0) > 1)!;
    const prompt = leaves(requirementTree(tree, { prompt: [node.id, 1] }));
    expect(prompt).toContainEqual({ kind: 'at', node: node.id });
    expect(prompt).toContainEqual({ kind: 'noEarlierPrompt', node: node.id, index: 1 });
    const withIf = tree.nodes.flatMap(n => n.choices.flatMap(c => (['favorable', 'mixed', 'adverse'] as const).flatMap(band => c.outcomes[band].map((o, i) => ({ n, c, band, o, i })))))
      .find(entry => ([] as unknown[]).concat(entry.o.if ?? []).some(c => typeof c === 'object' && c !== null && 'clock' in c))!;
    const outcome = leaves(requirementTree(tree, { outcome: [withIf.n.id, withIf.c.id, withIf.band, withIf.i] }));
    expect(outcome).toContainEqual({ kind: 'band', band: withIf.band });
    expect(outcome.some(l => (l as { kind: string }).kind === 'clock' && 'is' in (l as object))).toBe(true);
  });

  it('reaches a turn node only through its turn, and an ending through a drawn result where one routes there', () => {
    const tree = template('hostage_crisis').tree;
    const [group, members] = Object.entries(tree.turns!)[0];
    expect(leaves(requirementTree(tree, { node: members[0] }))).toContainEqual({ kind: 'turn', group, node: members[0] });
    expect(requirementTree(tree, { node: tree.root })).toEqual({ all: [] });
    const some = tree.nodes.flatMap(n => n.choices.flatMap(c => (['favorable', 'mixed', 'adverse'] as const).flatMap(b => c.outcomes[b])))
      .find(o => o.cascade && !('turn' in o.cascade.next.some))!.cascade!.next.some as { ending: string } | { node: string };
    const req = leaves(requirementTree(tree, 'ending' in some ? { ending: some.ending } : { node: some.node }));
    expect(req).toContainEqual({ kind: 'drawn', result: 'cascade:some' });
    expect(req).toContainEqual({ kind: 'count', group: 'others', min: 2 });
  });

  it('throws on a target the tree does not have', () => {
    expect(() => requirementTree(template('barricaded').tree, { node: 'nowhere' })).toThrow(/no node nowhere/);
  });
});
