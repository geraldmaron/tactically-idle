// The command palette's index and search: calls and surfaces always, a call's nodes, choices and
// endings once it is open, state keys, lines and tuning fields; bound titles and raw ids both match.
import { describe, expect, it } from 'vitest';
import { dependencyIndex } from '../../../gen/incident/trees-v13/dependencies';
import type { StringRow } from '../../../gen/incident/trees-v13/strings';
import type { FieldMeta } from '../../../sim/tuning-meta';
import { parseLabUrl } from '../url';
import { foldText, paletteItems, searchPalette } from './palette';
import { openSession, sessionBinder } from './session';
import type { Session } from './session';

const REFERENCE = 'type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1';
const FIELD: FieldMeta = { path: 'RESOLUTION_TUNING.favorableAt', label: 'Margin for a good result', help: '', group: 'odds', mode: 'live', pinnedBy: [] };
const ROW: StringRow = { situation: 's2', where: 'talking.prompt', surface: 'prompt', text: 'Zieliński’s phone rings twice.', path: 'talking' };

function open(query: string): Session {
  const opened = openSession(parseLabUrl(`?${query}`).url, null);
  if (!('frames' in opened)) throw new Error(opened.message);
  return opened;
}

describe('paletteItems', () => {
  it('always offers the four calls and every surface', () => {
    const items = paletteItems({ session: null, deps: null, rows: null, fields: [] });
    expect(items.filter(item => item.kind === 'call').map(item => item.id).sort()).toEqual(['active_armed_incident', 'barricaded', 'hostage_crisis', 'protected_rescue']);
    expect(items.filter(item => item.kind === 'surface')).toHaveLength(7);
    expect(items.find(item => item.id === 'hostage_crisis')).toMatchObject({ title: 'One Last Signature', go: { tab: 'play', path: '' } });
  });

  it('indexes a call\'s nodes, choices and endings with bound titles, unique ids, and where to play', () => {
    const s = open(REFERENCE);
    const deps = dependencyIndex(s.template);
    const items = paletteItems({ session: s, deps, rows: [ROW], fields: [FIELD] });
    const ids = new Set<string>();
    for (const item of items) { expect(ids.has(`${item.kind}:${item.id}`), `${item.kind}:${item.id}`).toBe(false); ids.add(`${item.kind}:${item.id}`); }
    const nodes = items.filter(item => item.kind === 'node');
    expect(nodes).toHaveLength(s.tree.nodes.length);
    expect(nodes.find(item => item.id === 'talking')).toMatchObject({ title: 'Talking', go: { tab: 'play', node: 'talking' }, play: { node: 'talking' } });
    expect(items.filter(item => item.kind === 'choice')).toHaveLength(s.tree.nodes.reduce((n, node) => n + node.choices.length, 0));
    const choice = items.find(item => item.id === 'talking/take_account')!;
    expect(choice.title).not.toMatch(/\{/);
    expect(choice.title).toBe(sessionBinder(s)('Take down {taker.his} account'));
    expect(choice.crumb).toBe(`${s.tree.stageLabels[s.tree.nodes.find(node => node.id === 'talking')!.stage]} › Talking`);
    expect(choice.play).toEqual({ offered: 't13_hostage_crisis_talking_take_account' });
    const ending = items.find(item => item.kind === 'ending' && item.id === 'owner_killed')!;
    expect(ending.title).not.toMatch(/\{/);
    expect(ending).toMatchObject({ go: { sel: { kind: 'ending', ending: 'owner_killed' } }, play: { ending: 'owner_killed' } });
    expect(items.filter(item => item.kind === 'key')).toHaveLength(deps.keys.size);
    expect(items.find(item => item.kind === 'key' && item.id === 'mark:turned')).toMatchObject({ crumb: 'State · mark:turned', go: { tab: 'deps' } });
    expect(items.find(item => item.kind === 'row')).toMatchObject({ id: 'talking.prompt@s2', go: { tab: 'script', sel: { kind: 'string', row: 'talking.prompt@s2' } }, play: { node: 'talking' } });
    expect(items.find(item => item.kind === 'field')).toMatchObject({ id: FIELD.path, title: FIELD.label, go: { tab: 'tuning', tuning: { group: 'odds' } } });
  });
});

describe('searchPalette', () => {
  const s = open(REFERENCE);
  const items = paletteItems({ session: s, deps: dependencyIndex(s.template), rows: [ROW], fields: [FIELD] });

  it('matches raw ids as well as bound titles, best first', () => {
    expect(searchPalette(items, 'owner_killed')[0]).toMatchObject({ kind: 'ending', id: 'owner_killed' });
    expect(searchPalette(items, 'owner killed')[0]).toMatchObject({ kind: 'ending', id: 'owner_killed' });
    expect(searchPalette(items, 'talking')[0]).toMatchObject({ kind: 'node', id: 'talking' });
    const title = items.find(item => item.id === 'talking/take_account')!.title;
    expect(searchPalette(items, title)[0].id).toBe('talking/take_account');
    expect(searchPalette(items, 'RESOLUTION_TUNING.favorableAt')[0]).toMatchObject({ kind: 'field' });
    expect(searchPalette(items, 'mark:turned')[0]).toMatchObject({ kind: 'key', id: 'mark:turned' });
  });

  it('folds curly apostrophes, accents and case', () => {
    expect(foldText('Zieliński’s')).toBe("zielinski's");
    expect(searchPalette(items, "zielinski's phone")[0]).toMatchObject({ kind: 'row' });
    expect(searchPalette(items, 'ZIELIŃSKI’S')[0]).toMatchObject({ kind: 'row' });
  });

  it('lists the index in order for an empty query, honours the limit, and finds nothing for nonsense', () => {
    expect(searchPalette(items, '   ', 5)).toEqual(items.slice(0, 5));
    expect(searchPalette(items, 'a', 3)).toHaveLength(3);
    expect(searchPalette(items, 'qqqzzzxx')).toEqual([]);
  });
});
