import { describe, expect, it } from 'vitest';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import type { IncidentTemplate } from '../../../content/incidents/types';
import type { IncidentType } from '../../../sim/scenario-types';
import { countCombos, dependencyIndex, lintTree, plainTokens, requirementTree, roleNoun, siteKey, type ReqNode, type StateKey } from './dependencies';
import { GROUP_TEMPLATE } from './group-fixture';
import { armedWithoutHitMark, hitMarkFixture, HIT_FIXTURE } from './never-offered-fixture';
import { CLOCK_FIXTURE_IDS, clockFixtureTemplate } from '../gates/clock-fixture';
import { LINT_FIXTURE_MARKS, lintFixtureTemplate } from '../gates/lint-fixture';

const TEMPLATES = Object.values(INCIDENT_TEMPLATES) as IncidentTemplate[];
const template = (type: IncidentType) => INCIDENT_TEMPLATES[type]!;
const entry = (type: IncidentType, key: StateKey) => dependencyIndex(template(type)).keys.get(key);
const leaves = (req: ReqNode): unknown[] => 'leaf' in req ? [req.leaf] : ('all' in req ? req.all : req.any).flatMap(leaves);

describe('dependency index', () => {
  it('counts a clock running out as a writer of its mark and of harm to its owner', () => {
    // An owned fixture (gates/clock-fixture.ts), so a content change to a live clock can't move it.
    const index = dependencyIndex(clockFixtureTemplate()), { clock, owner, cueMark, outMark } = CLOCK_FIXTURE_IDS;
    const key = (k: StateKey) => index.keys.get(k)!;
    expect(key(`mark:${outMark}`).writers.filter(site => site.field === 'clock.onOut.mark').map(site => [site.clock, site.situation])).toEqual([[clock, 0], [clock, 1], [clock, 2]]);
    expect(key(`harm:${owner}`).writers.some(site => site.field === 'clock.onOut.harm' && site.clock === clock)).toBe(true);
    // A cue's mark writes too, and running out reads the clock.
    expect(key(`mark:${cueMark}`).writers.some(site => site.field === 'clock.cue.mark' && site.clock === clock)).toBe(true);
    expect(key(`clock:${clock}`).readers.some(site => site.field === 'clock.onOut.mark')).toBe(true);
  });

  it('labels a concession by the choice the player picks, never by its action id', () => {
    for (const t of TEMPLATES) for (const [key, value] of dependencyIndex(t).keys) if (key.startsWith('promise:concession:')) expect(value.label, key).not.toMatch(/t13_/);
  });

  it('writes a drawn hit’s mark as drawn, and force and cascade results as drawn releases', () => {
    expect(dependencyIndex(hitMarkFixture(true)).keys.get(`mark:${HIT_FIXTURE.mark}`)!.writers.every(site => site.field === 'fire.mark' && site.drawn)).toBe(true);
    expect(entry('hostage_crisis', 'out:rider')!.writers.some(site => site.field === 'force.out' && site.drawn)).toBe(true);
    expect(dependencyIndex(GROUP_TEMPLATE).keys.get('out:others')!.writers.some(site => site.field === 'cascade.out' && site.drawn)).toBe(true);
    // Safe is out too.
    expect(entry('hostage_crisis', 'out:clerk')!.writers.some(site => site.field === 'outcome.safe')).toBe(true);
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
    expect(dependencyIndex(GROUP_TEMPLATE).keys.get('count:others')!.readers.length).toBeGreaterThan(0);
    expect(entry('hostage_crisis', 'meter:rider')!.readers.filter(site => site.field === 'outcome.if').length).toBeGreaterThan(0);
    // A fact branch reads the situation's truth, not what the team knows.
    expect(entry('hostage_crisis', 'situation')!.readers.length).toBeGreaterThan(0);
    // A clock an outcome forks on is read there (an owned fixture).
    expect(dependencyIndex(clockFixtureTemplate()).keys.get(`clock:${CLOCK_FIXTURE_IDS.clock}`)!.readers.length).toBeGreaterThan(0);
  });

  it('labels every key in plain words, with no role token left', () => {
    for (const t of TEMPLATES) for (const { key, label } of dependencyIndex(t).keys.values()) {
      expect(label, key).not.toMatch(/[{}]/);
      expect(label, key).toMatch(/^[A-Z]/);
    }
    expect(entry('hostage_crisis', 'mark:turned')!.label).toBe('The delivery courier turned the handgun on the night manager');
    expect(roleNoun(template('hostage_crisis').tree, 'clerk')).toBe('night clerk');
    expect(plainTokens('{rider.He} {rider~keeps|keep} {manager.first} in the {scene}', template('hostage_crisis').tree)).toBe('They keep the night manager in the scene');
  });

  it('gives every site a stable key, and the same index on every walk', () => {
    expect(siteKey({ node: 'talking', choice: 'offer', band: 'mixed', outcome: 2, field: 'outcome.when', negated: true })).toBe('n.talking/c.offer/b.mixed/o.2/f.outcome.when/not');
    expect(siteKey({ clock: 'oxygen', situation: 0, field: 'clock.onOut.mark' })).toBe('k.oxygen/s.0/f.clock.onOut.mark');
    for (const t of TEMPLATES) expect(JSON.stringify([...dependencyIndex(t).keys.values()])).toBe(JSON.stringify([...dependencyIndex(t).keys.values()]));
  });
});

describe('static lint', () => {
  it('finds threat-only, drawn-only and clock-writer marks (owned fixtures)', () => {
    // A mark only a clock writes, read later: noted, never a dead write (an owned fixture).
    expect(lintTree(clockFixtureTemplate()).filter(finding => finding.key === `mark:${CLOCK_FIXTURE_IDS.outMark}`).map(finding => finding.code)).toEqual(['clock_writer']);
    // A mark read only by command approval, and one set only by a drawn result (owned fixture).
    const lint = lintTree(lintFixtureTemplate()), at = (key: string) => lint.filter(finding => finding.key === `mark:${key}`).map(finding => finding.code);
    expect(at(LINT_FIXTURE_MARKS.threatOnly)).toEqual(['threat_only']);
    expect(at(LINT_FIXTURE_MARKS.drawnOnly)).toContain('drawn_only');
  });

  it('finds no unread mark, unset read, or unreachable node or ending in any shipped tree', () => {
    for (const t of TEMPLATES) expect(lintTree(t).filter(finding => ['read_never_written', 'dead_write', 'unreachable_node', 'unreachable_ending'].includes(finding.code)), t.type).toEqual([]);
  });

  it('counts a mark only a drawn hit sets as settable: the medic choice is offered', () => {
    // compile.ts counts `fire.mark` with outcome and clock marks, so the fixture's "Get the hit
    // officer to the medic first" (onlyIf officer_down) compiles and lint finds nothing to drop.
    const lint = lintTree(hitMarkFixture(true));
    expect(lint.filter(finding => finding.code === 'never_offered' || finding.code === 'never_matched')).toEqual([]);
    expect(lint.map(finding => `${finding.code}:${finding.key ?? finding.node ?? finding.ending}`)).toContain(`drawn_only:mark:${HIT_FIXTURE.mark}`);
  });

  it('flags a choice the compiler drops in every call when nothing can set the mark it needs', () => {
    // The same choice with its mark's only writer (the hit) removed.
    const found = lintTree(armedWithoutHitMark()).filter(finding => finding.code === 'never_offered');
    expect(found.map(finding => finding.id)).toEqual([`never_offered:n.${HIT_FIXTURE.node}/c.${HIT_FIXTURE.choice}/f.onlyIf`]);
    expect(found[0].message).toContain(`${HIT_FIXTURE.mark} can never be set in this call`);
  });

  it('keeps finding ids stable and unique across runs', () => {
    for (const t of [...TEMPLATES, GROUP_TEMPLATE]) {
      const ids = lintTree(t).map(finding => finding.id);
      expect(new Set(ids).size, t.type).toBe(ids.length);
      expect(lintTree(t).map(finding => finding.id)).toEqual(ids);
    }
  });

  it('reports a read nobody writes, a write nobody reads, and an unreachable node', () => {
    const base = template('hostage_crisis');
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
    expect(countCombos(GROUP_TEMPLATE)).toEqual([{ others: 0 }, { others: 1 }, { others: 2 }, { others: 3 }]);
    expect(countCombos(template('hostage_crisis'))).toEqual([{}]);
  });
});

describe('requirement trees', () => {
  it('names the cert an entry choice needs', () => {
    expect(leaves(requirementTree(template('hostage_crisis').tree, { choice: ['threat', 'go_in'] }))).toContainEqual({ kind: 'cert', cert: 'entry_team' });
  });

  it('reads a choice’s state, a prompt variant’s order, and an outcome’s band and hidden conditions', () => {
    const tree = template('hostage_crisis').tree;
    const node = tree.nodes.find(entry => (entry.promptIf?.length ?? 0) > 1)!;
    const prompt = leaves(requirementTree(tree, { prompt: [node.id, 1] }));
    expect(prompt).toContainEqual({ kind: 'at', node: node.id });
    expect(prompt).toContainEqual({ kind: 'noEarlierPrompt', node: node.id, index: 1 });
    const withIf = tree.nodes.flatMap(n => n.choices.flatMap(c => (['favorable', 'mixed', 'adverse'] as const).flatMap(band => c.outcomes[band].map((o, i) => ({ n, c, band, o, i })))))
      .find(entry => ([] as unknown[]).concat(entry.o.if ?? []).some(c => typeof c === 'object' && c !== null && 'fact' in c))!;
    const outcome = leaves(requirementTree(tree, { outcome: [withIf.n.id, withIf.c.id, withIf.band, withIf.i] }));
    expect(outcome).toContainEqual({ kind: 'band', band: withIf.band });
    const fact = ([] as unknown[]).concat(withIf.o.if ?? []).find((c): c is { fact: string } => typeof c === 'object' && c !== null && 'fact' in c)!.fact;
    expect(JSON.stringify(outcome)).toContain(fact);
  });

  it('reaches a turn node only through its turn, and an ending through a drawn result where one routes there', () => {
    const tree = template('hostage_crisis').tree;
    const [turnGroup, members] = Object.entries(tree.turns!)[0];
    expect(leaves(requirementTree(tree, { node: members[0] }))).toContainEqual({ kind: 'turn', group: turnGroup, node: members[0] });
    expect(requirementTree(tree, { node: tree.root })).toEqual({ all: [] });
    const group = GROUP_TEMPLATE.tree;
    const some = group.nodes.flatMap(n => n.choices.flatMap(c => (['favorable', 'mixed', 'adverse'] as const).flatMap(b => c.outcomes[b])))
      .find(o => o.cascade && !('turn' in o.cascade.next.some))!.cascade!.next.some as { ending: string } | { node: string };
    const req = leaves(requirementTree(group, 'ending' in some ? { ending: some.ending } : { node: some.node }));
    expect(req).toContainEqual({ kind: 'drawn', result: 'cascade:some' });
    expect(req).toContainEqual({ kind: 'count', group: 'others', min: 2 });
  });

  it('throws on a target the tree does not have', () => {
    expect(() => requirementTree(template('hostage_crisis').tree, { node: 'nowhere' })).toThrow(/no node nowhere/);
  });
});
