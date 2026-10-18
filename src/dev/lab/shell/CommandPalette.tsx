// The command palette (⌘K, spec 3.0): one index over surfaces, calls, nodes, choices, endings, state
// keys, script rows and tuning fields. Enter goes there; ⌘Enter plays to it. The index and the fuzzy
// match are the run model's (model/palette.ts); if building the index fails the palette still
// searches what the shell knows on its own: the surfaces and the four calls.
import { useEffect, useId, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { callStringRows } from '../../../gen/incident/trees-v13/strings';
import { TUNING_META } from '../../../sim/tuning-meta';
import { useLab } from '../context';
import { paletteItems, searchPalette } from '../model/palette';
import type { PaletteItem } from '../model/palette';
import { sessionBinder } from '../model/session';
import { SURFACE_META } from '../surfaces/meta';
import type { Surface } from '../types';
import { defaultCall } from '../url';
import { cx, Glyph, Kbd, Modal } from '../viz';
import type { GlyphName } from '../viz';
import { CALL_TEMPLATES } from './CallSwitcher';
import { isMac } from './keys';

const KIND_GLYPH: Record<PaletteItem['kind'], GlyphName> = {
  node: 'node', choice: 'choice', ending: 'ending', key: 'key', row: 'row', field: 'field', surface: 'grid', call: 'plan',
};
const LIMIT = 30;

/** What the shell can offer before the run model's index exists. */
export function shellItems(): PaletteItem[] {
  const surfaces = (Object.keys(SURFACE_META) as Surface[]).map((tab): PaletteItem => ({ kind: 'surface', id: tab, title: SURFACE_META[tab].label, crumb: 'Surface', go: { tab } }));
  const calls = CALL_TEMPLATES.map((template): PaletteItem => ({
    kind: 'call', id: template.type, title: template.tree.title, crumb: template.label,
    go: { call: defaultCall(template.type), path: '', node: null, sel: null, handoff: null, hist: '', tab: 'play' },
  }));
  return [...calls, ...surfaces];
}

const fold = (text: string) => text.toLowerCase().replace(/[’‘]/g, "'");

/** Every word of the query in the title, id or crumb; title prefixes first. */
export function shellSearch(items: readonly PaletteItem[], query: string, limit = LIMIT): PaletteItem[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return items.slice(0, limit);
  const q = fold(query.trim());
  return items
    .map(item => ({ item, title: fold(item.title), hay: fold(`${item.title} ${item.id} ${item.crumb}`) }))
    .filter(entry => words.every(word => entry.hay.includes(word)))
    .map(entry => ({ ...entry, score: entry.title.startsWith(q) ? 0 : entry.title.includes(q) ? 1 : 2 }))
    .sort((a, b) => a.score - b.score || a.title.localeCompare(b.title))
    .slice(0, limit)
    .map(entry => entry.item);
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { url, navigate, playHere, call, deps } = useLab();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const id = useId();
  const session = call.status === 'ready' ? call.session : null;

  const source = useMemo(() => {
    if (!open) return null;
    try {
      // Script's lines, bound as the call in focus: the same rows Script lists and pins its baseline with.
      let rows: ReturnType<typeof callStringRows> | null = null;
      if (session) try { rows = callStringRows(session.tree, sessionBinder(session), session.counts); } catch { rows = null; }
      const items = paletteItems({ session, deps, rows, fields: TUNING_META });
      return { full: true, search: (q: string) => searchPalette(items, q, LIMIT) };
    } catch (error) {
      console.error('Scenario Lab: palette index failed', error);
      const items = shellItems();
      return { full: false, search: (q: string) => shellSearch(items, q) };
    }
  }, [open, session, deps]);

  const results = useMemo(() => {
    if (!source) return [];
    try { return source.search(query); } catch (error) {
      console.error('Scenario Lab: palette search failed', error);
      return shellSearch(shellItems(), query);
    }
  }, [source, query]);

  useEffect(() => { if (open) { setQuery(''); setActive(0); } }, [open]);
  useEffect(() => setActive(0), [query]);

  const go = (item: PaletteItem, play: boolean) => {
    onClose();
    if (play && item.play) playHere(item.play);
    // A surface that needs a call keeps the one in focus; anything else carries its own focus.
    else navigate(item.kind === 'surface' && !url.call && SURFACE_META[item.id as Surface].needsCall ? { tab: 'calls' } : item.go);
  };

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(i => Math.min(results.length - 1, i + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    else if (event.key === 'Enter' && results[active]) { event.preventDefault(); go(results[active], event.metaKey || event.ctrlKey); }
  };

  return (
    <Modal open={open} onClose={onClose} label="Go to" className="lab-palette">
      <div className="lab-palette-input">
        <Glyph name="search" size={16} />
        <input data-autofocus className="lab-palette-field" placeholder={source?.full ? 'Go to a node, choice, ending, key, line or field' : 'Go to a call or surface'}
          role="combobox" aria-expanded="true" aria-controls={`${id}-list`} aria-activedescendant={results[active] ? `${id}-${active}` : undefined}
          aria-autocomplete="list" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={onKey} spellCheck={false} />
      </div>
      <ul className="lab-palette-list" id={`${id}-list`} role="listbox" aria-label="Results">
        {results.map((item, i) => (
          <li key={`${item.kind}:${item.id}`} id={`${id}-${i}`} role="option" aria-selected={i === active}
            className={cx('lab-palette-item', i === active && 'lab-palette-active')}
            onPointerMove={() => setActive(i)} onClick={event => go(item, event.metaKey || event.ctrlKey)}>
            <Glyph name={KIND_GLYPH[item.kind]} />
            <span className="lab-palette-title">{item.title}</span>
            <span className="lab-palette-crumb">{item.crumb}</span>
            {item.play && i === active && <span className="lab-palette-hint"><Kbd>{isMac() ? '⌘' : 'Ctrl'} Enter</Kbd> plays to it</span>}
          </li>
        ))}
        {results.length === 0 && <li className="lab-palette-empty">Nothing matches “{query}”.</li>}
      </ul>
      {source && !source.full && <p className="lab-palette-foot">Searching calls and surfaces only: the call’s own index failed to build (see the console).</p>}
    </Modal>
  );
}
