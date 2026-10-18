// Script: the variant space, rows bound exactly as the compiler binds them, the longest-names cast
// the CLI checks bind, what changes between two variants (word by word), and the people-name audit
// against the binder on all four trees with twelve casts drawn the way calls draw them.
import { describe, expect, it } from 'vitest';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import type { IncidentTemplate } from '../../../content/incidents/types';
import { bindRoleTokens, TOKEN } from '../../../gen/incident/trees-v13/compile';
import { callStringRows, longestNamesCast } from '../../../gen/incident/trees-v13/strings';
import type { CastSample } from '../jobs/protocol';
import { runJob } from '../jobs/runners';
import type { RunnerContext } from '../jobs/runners';
import { castSample } from '../jobs/runners';
import { parseLabUrl } from '../url';
import {
  bindRows, castFor, castWords, changedRows, checkSummary, goneRows, groupSizes, lexiconForCast, longestSample, matcherAudit, playerOrder, PRONOUN_SETS, rowsFor,
  sampleFor, scriptSections, variantKey, variantRows, variantSpace,
} from './script';
import type { Variant } from './script';
import { openSession, sessionBinder } from './session';
import type { Session } from './session';

const TEMPLATES = Object.values(INCIDENT_TEMPLATES).filter((template): template is IncidentTemplate => !!template?.tree);
const hostage = INCIDENT_TEMPLATES.hostage_crisis as IncidentTemplate;
const ctx: RunnerContext = { shouldStop: () => false, progress: () => {}, yieldEvery: 25 };

function open(query: string): Session {
  const opened = openSession(parseLabUrl(`?${query}`).url, null);
  if (!('frames' in opened)) throw new Error(opened.message);
  return opened;
}
/** The call in focus as a cast sample, exactly as the casts job builds one. */
function thisCall(s: Session): CastSample {
  const spec = s.resolved.spec!;
  return castSample(spec.type, spec.familyId, spec.buildingSeed, spec.tier, spec.seed);
}
async function twelveCasts(template: IncidentTemplate, variant: 0 | 1 | 2 = 0): Promise<CastSample[]> {
  const result = await runJob({ kind: 'casts', type: template.type, family: template.tree.families[0], seed: 7, tier: 2, variant, n: 12 }, ctx);
  if (result.kind !== 'casts') throw new Error('not a casts result');
  return result.casts;
}
const product = (values: number[]) => values.reduce((a, b) => a * b, 1);
const TOKEN_TEST = new RegExp(TOKEN.source);

describe('variant space', () => {
  for (const template of TEMPLATES) it(`${template.type}: pronoun sets × group sizes × situations × turn members`, () => {
    const tree = template.tree;
    const space = variantSpace(tree, template, 0);
    const sizes = Object.values(groupSizes(template)).map(list => list.length);
    const turns = Object.values(tree.turns ?? {}).map(members => members.length);
    expect(space).toHaveLength(PRONOUN_SETS.length * product(sizes) * 3 * product(turns));
    expect(new Set(space.map(variantKey)).size).toBe(space.length);
    expect(space.every(v => v.cast === 0)).toBe(true);
  });

  it('reads hostage group sizes from the cast slot', () => {
    expect(groupSizes(hostage)).toEqual({ others: [0, 1, 2] });
    expect(variantSpace(hostage.tree, hostage, 0)).toHaveLength(4 * 3 * 3 * 3);
  });
});

describe('rows', () => {
  const s = open('type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1');
  const own = thisCall(s);
  const drawn: Variant = { pronouns: 'drawn', counts: s.counts, situation: s.situation, turns: s.turnDrawn, cast: 0 };

  it('binds the call in focus exactly as the compiler does', () => {
    const rows = rowsFor(s.tree, drawn, [own], longestSample(hostage));
    const bind = sessionBinder(s);
    expect(rows.length).toBeGreaterThan(100);
    for (const row of rows) {
      expect(row.error).toBeUndefined();
      expect(row.text).toBe(bind(row.row.text));
      expect(row.parts.map(part => part.text).join('')).toBe(row.text);
    }
  });

  it('shows only this situation’s lines and nothing from a turn this call did not draw', () => {
    const rows = variantRows(s.tree, drawn);
    expect(rows.every(row => row.situation === 'all' || row.situation === `s${s.situation + 1}`)).toBe(true);
    const others = Object.values(s.tree.turns ?? {}).flat().filter(node => !Object.values(s.turnDrawn).includes(node));
    expect(rows.some(row => row.path && others.includes(row.path))).toBe(false);
    const drawnTurn = Object.values(s.turnDrawn)[0];
    expect(rows.some(row => row.path === drawnTurn)).toBe(true);
  });

  it('binds the longest names exactly as npm run check:strings does', () => {
    const longest = longestNamesCast(hostage);
    const cli = callStringRows(hostage.tree, text => bindRoleTokens(text, longest.cast, longest.place, longest.rooms, longest.groups), longest.counts, longest.clockNexts);
    for (const situation of [0, 1, 2] as const) {
      const v: Variant = { pronouns: 'drawn', counts: longest.counts, situation, turns: {}, cast: -1 };
      const rows = rowsFor(hostage.tree, v, [], longestSample(hostage));
      const expected = cli.filter(row => row.situation === 'all' || row.situation === `s${situation + 1}`).map(row => row.text);
      expect(rows.map(row => row.text)).toEqual(expected);
    }
    expect(sampleFor({ cast: -1 }, [own], longestSample(hostage)).call).toBe(-1);
    expect(castWords(castFor(hostage.tree, longestSample(hostage), { pronouns: 'drawn', counts: longest.counts }))).toEqual(
      [Object.values(longest.cast)[0].firstName, Object.values(longest.cast)[0].surname, 'Fox', 'Pheasant']);
  });

  it('grows a group with stand-in names the call does not use, and sets everyone’s pronouns', () => {
    const bound = castFor(s.tree, own, { pronouns: 'they', counts: { others: 2 } });
    expect(bound.groups.others).toEqual(['others_1', 'others_2']);
    expect(bound.standIns.length).toBe(2 - (own.groups.others?.length ?? 0));
    const firsts = Object.values(bound.cast).map(who => who.firstName);
    expect(new Set(firsts).size).toBe(firsts.length);
    expect(Object.values(bound.cast).every(who => who.pronouns === 'they')).toBe(true);
    const rows = bindRows(variantRows(s.tree, { counts: { others: 2 }, situation: s.situation, turns: s.turnDrawn }), bound);
    expect(rows.every(row => !row.error)).toBe(true);
  });

  it('orders nodes as a player meets them and groups each choice by band', () => {
    const order = playerOrder(hostage.tree);
    expect(order[0]).toBe(hostage.tree.root);
    const stages = order.map(id => hostage.tree.nodes.find(node => node.id === id)!.stage);
    expect(stages).toEqual([...stages].sort((a, b) => ['assess', 'adapt', 'resolve'].indexOf(a) - ['assess', 'adapt', 'resolve'].indexOf(b)));
    const rows = rowsFor(s.tree, drawn, [own], longestSample(hostage));
    const sections = scriptSections(s.tree, rows);
    expect(sections[0].kind).toBe('card');
    expect(sections[1].id).toBe(hostage.tree.root);
    expect(sections.flatMap(section => section.rows)).toHaveLength(rows.length);
    const first = sections[1].choices[0];
    expect(first.title?.row.where).toBe(`offer.${first.choice}.title`);
    expect(first.bands.map(band => band.band)).toEqual(['favorable', 'mixed', 'adverse']);
    expect(first.bands.every(band => band.preview && band.outcomes.length > 0)).toBe(true);
  });
});

describe('changed in this variant', () => {
  const s = open('type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1');
  const own = thisCall(s);
  const longest = longestSample(hostage);
  const at = (over: Partial<Variant>): Variant => ({ pronouns: 'drawn', counts: { others: 1 }, situation: s.situation, turns: s.turnDrawn, cast: 0, ...over });

  it('marks exactly the words that differ, and nothing for identical rows', () => {
    const prev = rowsFor(s.tree, at({}), [own], longest);
    const next = rowsFor(s.tree, at({ pronouns: 'they' }), [own], longest);
    const changed = changedRows(prev, next);
    expect(changed.size).toBeGreaterThan(0);
    const before = new Map(prev.map(row => [row.row.where, row.text]));
    for (const row of next) {
      const ranges = changed.get(row.key);
      if (before.get(row.row.where) === row.text) { expect(ranges).toBeUndefined(); continue; }
      expect(ranges!.length).toBeGreaterThan(0);
      // Outside the marked ranges the words are the old row's words, in order.
      let rest = '', at2 = 0;
      for (const [start, end] of ranges!) { rest += row.text.slice(at2, start); at2 = end; }
      rest += row.text.slice(at2);
      const kept = rest.split(/\s+/).filter(Boolean);
      const old = before.get(row.row.where)!.split(/\s+/);
      let i = 0;
      for (const word of old) if (word === kept[i]) i++;
      expect(i, `${row.row.where}: ${row.text}`).toBe(kept.length);
    }
  });

  it('others 2 and pronouns they: only rows with a group or pronoun token change (J8)', () => {
    const prev = rowsFor(s.tree, at({ counts: { others: 2 } }), [own], longest);
    const next = rowsFor(s.tree, at({ counts: { others: 2 }, pronouns: 'they' }), [own], longest);
    const changed = changedRows(prev, next);
    expect(changed.size).toBeGreaterThan(0);
    const PRONOUN_OR_GROUP = /\{[a-z_]+(\.([Hh]e|[Hh]im|[Hh]is|[Hh]ers|[Hh]imself)|~|\^|#)|\{others/;
    for (const key of changed.keys()) {
      const row = next.find(entry => entry.key === key)!;
      expect(TOKEN_TEST.test(row.row.text), row.row.where).toBe(true);
      expect(PRONOUN_OR_GROUP.test(row.row.text), `${row.row.where}: ${row.row.text}`).toBe(true);
    }
    expect(goneRows(prev, next)).toHaveLength(0);
  });

  it('a new group size shows the rows it adds and says which rows went', () => {
    const one = rowsFor(s.tree, at({ counts: { others: 1 } }), [own], longest);
    const none = rowsFor(s.tree, at({ counts: { others: 0 } }), [own], longest);
    const added = changedRows(none, one);
    const added0 = [...added.entries()].filter(([key]) => !none.some(row => row.key === key));
    for (const [, ranges] of added0) expect(ranges).toHaveLength(1);
    expect(goneRows(one, none).length).toBeGreaterThan(0);
  });
});

describe('matcher audit', () => {
  for (const template of TEMPLATES) it(`${template.type}: 0 missed and 0 false matches for 12 casts in every situation`, async () => {
    const casts = await twelveCasts(template);
    expect(casts).toHaveLength(12);
    const longest = longestSample(template);
    let names = 0;
    for (const [i, sample] of casts.entries()) for (const situation of [0, 1, 2] as const) for (const pronouns of ['drawn', 'they'] as const) {
      const counts = Object.fromEntries(Object.keys(template.tree.groups ?? {}).map(group => [group, sample.groups[group]?.length ?? 0]));
      const v: Variant = { pronouns, counts, situation, turns: {}, cast: i };
      const bound = castFor(template.tree, sampleFor(v, casts, longest), v);
      const rows = rowsFor(template.tree, v, casts, longest);
      const lex = lexiconForCast(template.tree, bound);
      const audit = matcherAudit(rows, () => lex);
      expect(audit.missed, JSON.stringify(audit.missed.slice(0, 3))).toEqual([]);
      expect(audit.falseMatches, JSON.stringify(audit.falseMatches.slice(0, 3))).toEqual([]);
      names += rows.reduce((n, row) => n + row.parts.filter(part => part.role).length, 0);
    }
    expect(names).toBeGreaterThan(500);
  }, 60_000);

  it('reports a miss and a false match it is shown', () => {
    const s = open('type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1');
    const own = thisCall(s);
    const v: Variant = { pronouns: 'drawn', counts: s.counts, situation: s.situation, turns: s.turnDrawn, cast: 0 };
    const bound = castFor(s.tree, own, v);
    const rows = rowsFor(s.tree, v, [own], longestSample(hostage));
    const lex = lexiconForCast(s.tree, bound);
    // A matcher that finds nothing misses every colorable name; one that names the wrong person is a false match.
    const taker = bound.cast.taker;
    const withName = rows.filter(row => row.parts.some(part => part.role === 'taker' && part.text === taker.firstName));
    expect(withName.length).toBeGreaterThan(0);
    const blind = matcherAudit(withName, () => ({ ...lex, pattern: /(?!)/gu }));
    expect(blind.missed.some(hit => hit.expected === 'taker' && hit.text === taker.firstName)).toBe(true);
    expect(blind.falseMatches).toEqual([]);
    const renamed = { ...lex, entries: lex.entries.map(entry => entry.id === 'taker' ? { ...entry, id: 'owner' } : entry) };
    const wrong = matcherAudit(withName, () => renamed);
    expect(wrong.falseMatches.some(hit => hit.got === 'owner' && hit.expected === 'taker')).toBe(true);
  });
});

describe('check summary', () => {
  it('says how many findings sit on how many lines, in words', () => {
    expect(checkSummary(23, 23)).toBe('23 findings on 23 lines');
    expect(checkSummary(3, 2)).toBe('3 findings on 2 lines');
    expect(checkSummary(1, 1)).toBe('1 finding on 1 line');
    expect(checkSummary(0, 0)).toBe('No findings');
  });
});
