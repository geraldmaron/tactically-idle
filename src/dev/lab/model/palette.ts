// The command palette's one index (spec 3.0): the four calls and the surfaces, and with a call open its
// nodes (humanized id, first sentence of the bound prompt), choices and endings (bound titles), state
// keys (label, raw key), script rows and tuning fields (label, raw path). The search matches bound
// titles and raw ids alike; curly and straight apostrophes, accents and underscores fold together.
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import type { IncidentTemplate } from '../../../content/incidents/types';
import { choiceActionId } from '../../../gen/incident/trees-v13/compile';
import { plainTokens } from '../../../gen/incident/trees-v13/dependencies';
import type { DependencyIndex } from '../../../gen/incident/trees-v13/dependencies';
import { humanizeNode } from '../../../gen/incident/trees-v13/graph';
import type { StringRow } from '../../../gen/incident/trees-v13/strings';
import type { FieldMeta } from '../../../sim/tuning-meta';
import type { Goal } from '../jobs/protocol';
import { SURFACE_META } from '../surfaces/meta';
import type { LabUrl, Surface } from '../types';
import { defaultCall } from '../url';
import { actionTitle, endingTwinCrumb } from './describe';
import type { Session } from './session';
import { sessionBinder } from './session';
import { stringRowKey } from './snapshots';

export interface PaletteItem { kind: 'node' | 'choice' | 'ending' | 'key' | 'row' | 'field' | 'surface' | 'call'; id: string; title: string; crumb: string;
  go: Partial<LabUrl>; play?: Goal }

const KIND_ORDER: readonly PaletteItem['kind'][] = ['call', 'surface', 'node', 'choice', 'ending', 'key', 'row', 'field'];
const ROW_TITLE = 90;

const clip = (text: string, n: number) => text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text;

function callItems(): PaletteItem[] {
  return (Object.values(INCIDENT_TEMPLATES) as IncidentTemplate[]).map(template => ({
    kind: 'call', id: template.type, title: template.tree.title, crumb: template.label,
    go: { call: defaultCall(template.type), path: '', node: null, sel: null, handoff: null, hist: '', tab: 'play' },
  }));
}

function surfaceItems(): PaletteItem[] {
  return (Object.keys(SURFACE_META) as Surface[]).map(tab => ({ kind: 'surface', id: tab, title: SURFACE_META[tab].label, crumb: 'Surface', go: { tab } }));
}

function sessionItems(s: Session): PaletteItem[] {
  const tree = s.tree, strict = sessionBinder(s);
  // A node or choice this call drops can name people it doesn't have (a group with no members): read
  // those with role nouns instead.
  const bind = (text: string) => { try { return strict(text); } catch { return plainTokens(text, tree); } };
  const stage = (id: string) => tree.stageLabels[id as keyof typeof tree.stageLabels] ?? id;
  const out: PaletteItem[] = [];
  const titles = new Map(tree.nodes.map(node => [node.id, humanizeNode(node, bind)]));
  for (const node of tree.nodes) {
    const { title, lead } = titles.get(node.id)!;
    out.push({ kind: 'node', id: node.id, title, crumb: `${stage(node.stage)} › ${clip(lead, 80)}`, go: { tab: 'play', node: node.id }, play: { node: node.id } });
  }
  for (const node of tree.nodes) for (const choice of node.choices) {
    const actionId = choiceActionId(tree.type, node.id, choice.id);
    const compiled = actionTitle(s.scenario, actionId);
    out.push({ kind: 'choice', id: `${node.id}/${choice.id}`, title: compiled === actionId ? bind(choice.title) : compiled,
      crumb: `${stage(node.stage)} › ${titles.get(node.id)!.title}`, go: { tab: 'play', sel: { kind: 'choice', node: node.id, choice: choice.id } }, play: { offered: actionId } });
  }
  for (const [id, ending] of Object.entries(tree.endings)) {
    const twin = endingTwinCrumb(tree, id);
    out.push({ kind: 'ending', id, title: s.scenario.endings[id]?.title ?? bind(ending.title), crumb: twin ? `Ending · ${bind(twin)}` : 'Ending',
      go: { tab: 'play', sel: { kind: 'ending', ending: id } }, play: { ending: id } });
  }
  return out;
}

/** Every item the palette can go to. `rows` and `fields` come from Script and Tuning; `deps` from the
 * call's dependency index. Ids are unique within a kind. */
export function paletteItems(input: { session: Session | null; deps: DependencyIndex | null; rows: readonly StringRow[] | null; fields: readonly FieldMeta[] }): PaletteItem[] {
  const { session, deps, rows, fields } = input;
  const items: PaletteItem[] = [...callItems(), ...surfaceItems()];
  if (session) items.push(...sessionItems(session));
  if (deps) for (const entry of deps.keys.values())
    items.push({ kind: 'key', id: entry.key, title: entry.label, crumb: `State · ${entry.key}`, go: { tab: 'deps', sel: { kind: 'key', key: entry.key } } });
  const seenRows = new Set<string>();
  for (const row of rows ?? []) {
    const key = stringRowKey(row);
    if (seenRows.has(key)) continue;
    seenRows.add(key);
    items.push({ kind: 'row', id: key, title: clip(row.text, ROW_TITLE), crumb: `Line · ${row.where}${row.situation === 'all' ? '' : ` · ${row.situation}`}`,
      go: { tab: 'script', sel: { kind: 'string', row: key } }, ...(row.path ? { play: { node: row.path } } : {}) });
  }
  for (const field of fields)
    items.push({ kind: 'field', id: field.path, title: field.label, crumb: `Tuning · ${field.path}`,
      go: { tab: 'tuning', sel: { kind: 'field', path: field.path }, tuning: { group: field.group, advanced: true } } });
  return items;
}

/** Lower case, accents dropped, curly quotes straightened, underscores read as spaces. */
export function foldText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/_/g, ' ');
}

/** True when every character of `needle` appears in `hay` in order (a loose fuzzy match). */
const subsequence = (needle: string, hay: string): boolean => {
  let at = 0;
  for (const char of hay) if (char === needle[at] && ++at === needle.length) return true;
  return needle.length === 0;
};

/** Best matches first: title equal, title or id starting with the query, a title word starting with
 * it, title or id containing it, every word somewhere (title, id, crumb), then the letters in order
 * in the title. Ties go by kind (calls, surfaces, nodes, choices, endings, keys, lines, fields), then
 * shorter titles. An empty query lists the items in index order. */
export function searchPalette(items: readonly PaletteItem[], query: string, limit = 30): PaletteItem[] {
  const q = foldText(query).trim().replace(/\s+/g, ' ');
  if (!q) return items.slice(0, limit);
  const words = q.split(' ');
  const scored: { item: PaletteItem; score: number; title: string }[] = [];
  for (const item of items) {
    const title = foldText(item.title), id = foldText(item.id), hay = `${title} ${id} ${foldText(item.crumb)}`;
    const score = title === q || id === q ? 0
      : title.startsWith(q) || id.startsWith(q) ? 1
        : title.split(/[\s'"(),.-]+/).some(word => word.startsWith(q)) ? 2
          : title.includes(q) || id.includes(q) ? 3
            : words.every(word => hay.includes(word)) ? 4
              : q.length >= 3 && subsequence(q.replace(/ /g, ''), title.replace(/ /g, '')) ? 5 : -1;
    if (score >= 0) scored.push({ item, score, title });
  }
  return scored.sort((a, b) => a.score - b.score || KIND_ORDER.indexOf(a.item.kind) - KIND_ORDER.indexOf(b.item.kind)
    || a.title.length - b.title.length || a.title.localeCompare(b.title)).slice(0, limit).map(entry => entry.item);
}
