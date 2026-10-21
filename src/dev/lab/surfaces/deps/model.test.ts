// Dependencies in words: keys grouped by kind, sites as crumbs, lint labels for the shipped trees'
// known findings (spec J6), and Why targets that round-trip through the URL selection.
import { describe, expect, it } from 'vitest';
import { INCIDENT_TEMPLATES } from '../../../../content/incidents';
import type { IncidentTemplate } from '../../../../content/incidents/types';
import { dependencyIndex, lintTree } from '../../../../gen/incident/trees-v13/dependencies';
import type { ReqTarget } from '../../../../gen/incident/trees-v13/dependencies';
import { CALL_TREES } from '../../../../content/call-trees';
import { ARMED_TEMPLATE } from '../../../../gen/incident/trees-v13/armed-fixture';
import { armedWithoutHitMark, HIT_FIXTURE } from '../../../../gen/incident/trees-v13/never-offered-fixture';
import { CLOCK_FIXTURE_IDS, clockFixtureTemplate } from '../../../../gen/incident/gates/clock-fixture';
import { certFixtureTemplate } from '../../../../gen/incident/gates/fixture-call';
import { mutedFindings, muteNote } from '../../model/notes';
import {
  engineReaders, groupKeys, humanizeCondition, humanizeFinding, KIND_ORDER, kindOf, LINT_LABEL, LINT_MEANING, plainNames, selectionTarget, siteGoal, siteWords, sortFindings, targetSelection,
  treeReaders, whyOptions,
} from './model';

const T = (type: keyof typeof INCIDENT_TEMPLATES) => INCIDENT_TEMPLATES[type] as IncidentTemplate;
const names = (template: IncidentTemplate) => ({ ...plainNames(template.tree), clock: (id: string) => id.replace(/_/g, ' ') });

describe('lint in words (J6)', () => {
  it('hostage: turned is read only by command approval, and nothing is a dead write', () => {
    const lint = lintTree(T('hostage_crisis'));
    const turned = lint.find(f => f.key === 'mark:turned')!;
    expect(turned.code).toBe('threat_only');
    expect(LINT_LABEL[turned.code]).toBe('Read only by command approval');
    expect(lint.some(f => f.code === 'dead_write')).toBe(false);
  });

  it('a mark only a clock writes, read later, is a clock writer and never dead (owned fixture)', () => {
    const lint = lintTree(clockFixtureTemplate()).filter(f => f.key === `mark:${CLOCK_FIXTURE_IDS.outMark}`);
    expect(lint.map(f => f.code)).toEqual(['clock_writer']);
    expect(LINT_LABEL.clock_writer).toBeTruthy();
  });

  it('armed fixture: officer_down is set only by a drawn result', () => {
    // Going Live sets no mark from a drawn result, so the frozen armed fixture carries the case.
    const lint = lintTree(ARMED_TEMPLATE);
    expect(lint.find(f => f.key === 'mark:officer_down')?.code).toBe('drawn_only');
    expect(LINT_LABEL.drawn_only).toBe('Set only by a drawn result');
  });

  it('reads raw ids in lint messages as names', () => {
    // A clock writer from an owned fixture, and the armed call with nothing setting officer_down,
    // so its medic choice is never offered.
    const fixture = clockFixtureTemplate(), armed = armedWithoutHitMark();
    const clock = lintTree(fixture).find(f => f.code === 'clock_writer')!;
    expect(clock.message).toContain(CLOCK_FIXTURE_IDS.clock);
    const text = humanizeFinding(clock, names(fixture), dependencyIndex(fixture));
    expect(text).not.toContain(CLOCK_FIXTURE_IDS.clock);
    expect(text).toBe('Courier bolts is also set when courier nerve runs out.');
    const never = lintTree(armed).find(f => f.code === 'never_offered')!;
    const read = humanizeFinding(never, names(armed), dependencyIndex(armed));
    expect(read).not.toMatch(/treat_ours|officer_down/);
    expect(read.startsWith(`${names(armed).node(HIT_FIXTURE.node)} › `)).toBe(true);
    expect(read).toMatch(/^.+ › .+ is never offered: officer down can never be set in this call/);
  });

  it('names and explains every code', () => {
    for (const code of Object.keys(LINT_LABEL) as (keyof typeof LINT_LABEL)[]) {
      expect(LINT_LABEL[code].length).toBeGreaterThan(3);
      expect(LINT_MEANING[code]).toMatch(/\.$/);
    }
  });

  it('sets muted findings apart, keeping the rest in severity order', () => {
    // An error (officer_down read, never written) and a warning (the medic choice never offered).
    const template = armedWithoutHitMark();
    const lint = lintTree(template);
    const muted = mutedFindings({ v: 1, type: template.type, verdict: null, notes: [muteNote(lint.find(f => f.code === 'read_never_written')!, 'Kept', { type: template.type, url: '', draw: { situation: 0, call: 1 } })] });
    const sorted = sortFindings(lint, new Set(muted.keys()));
    expect(sorted.muted.map(f => f.code)).toEqual(['read_never_written']);
    expect(sorted.open.length + sorted.muted.length).toBe(lint.length);
    expect(sorted.open[0].severity).toBe('warn');
  });
});

describe('keys', () => {
  // The curated calls: the Lab opens only calls the board can draw.
  for (const type of Object.keys(CALL_TREES) as (keyof typeof INCIDENT_TEMPLATES)[]) it(`${type}: every key once, grouped by kind in order`, () => {
    const index = dependencyIndex(T(type));
    const groups = groupKeys(index);
    expect(groups.flatMap(group => group.keys.map(entry => entry.key))).toEqual([...index.keys.keys()]);
    expect(groups.map(group => KIND_ORDER.indexOf(group.kind))).toEqual([...groups.map(group => KIND_ORDER.indexOf(group.kind))].sort((a, b) => a - b));
    for (const group of groups) for (const entry of group.keys) expect(kindOf(entry.key)).toBe(group.kind);
  });

  it('filters by label or raw key, ignoring case and accents', () => {
    const index = dependencyIndex(T('hostage_crisis'));
    const turned = groupKeys(index, 'TURNED').flatMap(group => group.keys.map(entry => entry.key));
    expect(turned).toContain('mark:turned');
    expect(turned.every(key => key.includes('turned'))).toBe(true);
    expect(groupKeys(index, 'mark:turn').flatMap(group => group.keys.map(entry => entry.key))).toContain('mark:turned');
    expect(groupKeys(index, 'zzz')).toEqual([]);
  });

  it('keeps the engine’s own reads apart from the tree’s', () => {
    const entry = dependencyIndex(T('hostage_crisis')).keys.get('safe:clerk')!;
    expect(engineReaders(entry).length).toBe(1);
    expect(treeReaders(entry).every(site => site.field !== 'engine')).toBe(true);
  });
});

describe('sites in words', () => {
  const template = T('hostage_crisis');
  const index = dependencyIndex(template);

  it('reads a clock writer by its clock and situation (owned fixture)', () => {
    const fixture = clockFixtureTemplate();
    const site = dependencyIndex(fixture).keys.get(`mark:${CLOCK_FIXTURE_IDS.outMark}`)!.writers.find(entry => entry.field === 'clock.onOut.mark')!;
    const words = siteWords(site, fixture.tree, 'writers', names(fixture));
    expect(words.where).toMatch(/situation \d/);
    expect(words.does).toBe('sets it when the clock runs out');
    expect(words.playable).toBe(false);
    expect(siteGoal(site, fixture.tree)).toBeNull();
  });

  it('reads an outcome writer as node › choice · band, with its condition', () => {
    const site = index.keys.get('mark:turned')!.writers[0];
    const words = siteWords(site, template.tree, 'writers', names(template));
    expect(words.where).toContain(' › ');
    expect(words.where).toMatch(/· (goes well|complications|goes badly), line \d/);
    expect(words.does).toBe('sets it');
    expect(words.playable).toBe(true);
    const goal = siteGoal(site, template.tree)!;
    expect('req' in goal || 'eligible' in goal).toBe(true);
  });

  it('says when a reader needs the key not set', () => {
    const entry = [...index.keys.values()].find(e => e.readers.some(site => site.negated && site.field === 'onlyIf'));
    if (!entry) return;
    const site = entry.readers.find(s => s.negated && s.field === 'onlyIf')!;
    expect(siteWords(site, template.tree, 'readers', names(template)).does).toBe('offers the choice only while it is not set');
    expect(siteGoal(site, template.tree)).toEqual({ offered: `t13_hostage_crisis_${site.node}_${site.choice}` });
  });
});

describe('conditions in words', () => {
  it('reads facts, clocks, marks, roles and meters by name, and keeps numbers', () => {
    const template = T('hostage_crisis');
    const index = dependencyIndex(template);
    const read = (text: string) => humanizeCondition(text, template.tree, index, t => t.replace(/\{(\w+)\.first\}/g, (_m, id: string) => id.toUpperCase()), () => 'The stream’s count');
    expect(read('rider_clear = true and stream out')).toBe('Who took the bag: true and the stream’s count has run out');
    expect(read('raised = false and rider breaking')).toBe('The view of the counter: false and the delivery rider is breaking');
    // A mark by name, read from an owned fixture so a content change can't remove it.
    const fixture = clockFixtureTemplate();
    expect(humanizeCondition(`no mark ${CLOCK_FIXTURE_IDS.outMark}`, fixture.tree, dependencyIndex(fixture), t => t, () => '')).toBe('not: courier bolts');
    expect(read('clerk not safe')).toMatch(/^the .+ not yet out safe$/);
    expect(read('odds +8')).toBe('odds +8');
    expect(read('at 55')).toBe('at 55');
  });
});

describe('Why targets', () => {
  // Every shipped call, and the certification fixture, so no one call's choice labels are pinned.
  const trees = [...(Object.values(INCIDENT_TEMPLATES) as IncidentTemplate[]).map(template => template.tree), certFixtureTemplate().tree];
  for (const tree of trees) it(`${tree === trees.at(-1) ? 'fixture' : tree.type}: lists every choice once under its node, and every ending`, () => {
    const names = plainNames(tree), options = whyOptions(tree, names);
    for (const node of tree.nodes) for (const choice of node.choices) {
      const listed = options.filter(option => 'choice' in option.target && option.target.choice[0] === node.id && option.target.choice[1] === choice.id);
      expect(listed, `${node.id}.${choice.id}`).toHaveLength(1);
      expect(listed[0]).toMatchObject({ label: names.choice(node.id, choice.id), group: names.node(node.id) });
    }
    expect(options.filter(option => option.group === 'Endings')).toHaveLength(Object.keys(tree.endings).length);
  });

  it('round-trips every target through a URL selection', () => {
    const hostage = T('hostage_crisis').tree;
    const targets: ReqTarget[] = [
      { choice: ['going_live', hostage.nodes[0].choices[0].id] }, { ending: 'manager_killed' }, { node: 'on_air' },
      { prompt: ['on_air', 0] }, { outcome: ['going_live', hostage.nodes[0].choices[0].id, 'adverse', 0] },
    ];
    for (const target of targets) expect(selectionTarget(targetSelection(target), hostage)).toEqual(target);
    expect(selectionTarget({ kind: 'band', node: 'going_live', choice: hostage.nodes[0].choices[0].id, band: 'mixed' }, hostage)).toEqual({ choice: ['going_live', hostage.nodes[0].choices[0].id] });
    expect(selectionTarget({ kind: 'string', row: 'briefing.known[0]' }, hostage)).toBeNull();
    expect(selectionTarget({ kind: 'choice', node: 'going_live', choice: 'nope' }, hostage)).toBeNull();
  });
});
