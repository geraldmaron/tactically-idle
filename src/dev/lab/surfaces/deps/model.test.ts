// Dependencies in words: keys grouped by kind, sites as crumbs, lint labels for the shipped trees'
// known findings (spec J6), and Why targets that round-trip through the URL selection.
import { describe, expect, it } from 'vitest';
import { INCIDENT_TEMPLATES } from '../../../../content/incidents';
import type { IncidentTemplate } from '../../../../content/incidents/types';
import { dependencyIndex, lintTree } from '../../../../gen/incident/trees-v13/dependencies';
import type { ReqTarget } from '../../../../gen/incident/trees-v13/dependencies';
import { armedWithoutHitMark } from '../../../../gen/incident/trees-v13/never-offered-fixture';
import { CLOCK_FIXTURE_IDS, clockFixtureTemplate } from '../../../../gen/incident/gates/clock-fixture';
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

  it('armed: officer_down is set only by a drawn result', () => {
    const lint = lintTree(T('active_armed_incident'));
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
    expect(read).toMatch(/^Pinned › .+ is never offered: officer down can never be set in this call/);
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
  for (const type of ['hostage_crisis', 'barricaded', 'active_armed_incident', 'protected_rescue'] as const) it(`${type}: every key once, grouped by kind in order`, () => {
    const index = dependencyIndex(T(type));
    const groups = groupKeys(index);
    expect(groups.flatMap(group => group.keys.map(entry => entry.key))).toEqual([...index.keys.keys()]);
    expect(groups.map(group => KIND_ORDER.indexOf(group.kind))).toEqual([...groups.map(group => KIND_ORDER.indexOf(group.kind))].sort((a, b) => a - b));
    for (const group of groups) for (const entry of group.keys) expect(kindOf(entry.key)).toBe(group.kind);
  });

  it('filters by label or raw key, ignoring case and accents', () => {
    const index = dependencyIndex(T('hostage_crisis'));
    expect(groupKeys(index, 'TURNED').flatMap(group => group.keys.map(entry => entry.key))).toEqual(['mark:turned']);
    expect(groupKeys(index, 'mark:turn').flatMap(group => group.keys.map(entry => entry.key))).toContain('mark:turned');
    expect(groupKeys(index, 'zzz')).toEqual([]);
  });

  it('keeps the engine’s own reads apart from the tree’s', () => {
    const entry = dependencyIndex(T('hostage_crisis')).keys.get('safe:courier')!;
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
    const read = (text: string) => humanizeCondition(text, template.tree, index, t => t.replace(/\{(\w+)\.first\}/g, (_m, id: string) => id.toUpperCase()), () => 'The shop owner’s condition');
    expect(read('lets_go = true and owner_condition out')).toBe('TAKER’s terms for OWNER: true and the shop owner’s condition has run out');
    expect(read('raised = false and taker breaking')).toBe('The view of the counter: false and the former employee is breaking');
    // A mark by name, read from an owned fixture so a content change can't remove it.
    const fixture = clockFixtureTemplate();
    expect(humanizeCondition(`no mark ${CLOCK_FIXTURE_IDS.outMark}`, fixture.tree, dependencyIndex(fixture), t => t, () => '')).toBe('not: courier bolts');
    expect(read('courier not safe')).toMatch(/^the .+ not yet out safe$/);
    expect(read('odds +8')).toBe('odds +8');
    expect(read('at 55')).toBe('at 55');
  });
});

describe('Why targets', () => {
  const rescue = T('protected_rescue');

  it('lists the rescue vehicle choice and every ending', () => {
    const options = whyOptions(rescue.tree, plainNames(rescue.tree));
    expect(options.some(option => option.label === 'Screen the door with the rescue vehicle' && option.group === 'Wont leave')).toBe(true);
    expect(options.filter(option => option.group === 'Endings')).toHaveLength(Object.keys(rescue.tree.endings).length);
  });

  it('round-trips every target through a URL selection', () => {
    const hostage = T('hostage_crisis').tree;
    const targets: ReqTarget[] = [
      { choice: ['offer', hostage.nodes[0].choices[0].id] }, { ending: 'owner_killed' }, { node: 'talking' },
      { prompt: ['talking', 0] }, { outcome: ['offer', hostage.nodes[0].choices[0].id, 'adverse', 0] },
    ];
    for (const target of targets) expect(selectionTarget(targetSelection(target), hostage)).toEqual(target);
    expect(selectionTarget({ kind: 'band', node: 'offer', choice: hostage.nodes[0].choices[0].id, band: 'mixed' }, hostage)).toEqual({ choice: ['offer', hostage.nodes[0].choices[0].id] });
    expect(selectionTarget({ kind: 'string', row: 'briefing.known[0]' }, hostage)).toBeNull();
    expect(selectionTarget({ kind: 'choice', node: 'offer', choice: 'nope' }, hostage)).toBeNull();
  });
});
