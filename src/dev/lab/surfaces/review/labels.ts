// Names a reader recognizes for what a note, a site or a string row is about: bound titles of the
// call in focus (role nouns when a line can't bind in this call), and string rows by where the player
// meets them ("Offer › Walk Ana out first · preview, goes badly"). Shared by Review, Script and
// Dependencies. Pure apart from the session binder it is given.
import type { CallTree } from '../../../../content/call-trees/types';
import type { IncidentTemplate } from '../../../../content/incidents/types';
import { plainTokens, sentenceCase } from '../../../../gen/incident/trees-v13/dependencies';
import type { DependencyIndex, LintFinding, StateKey } from '../../../../gen/incident/trees-v13/dependencies';
import { callStringRows } from '../../../../gen/incident/trees-v13/strings';
import { CALL_ANCHOR } from '../../model/notes';
import { stringRowKey } from '../../model/snapshots';
import { parseSelection } from '../../url';

export interface CallNames {
  /** Tree text bound for the call in focus, or read with role nouns when it can't bind here. */
  bind(text: string): string;
  node(id: string): string;
  choice(node: string, choice: string): string;
  ending(id: string): string;
  clock(id: string): string;
}

/** Names for one call. `binder` is the call in focus's binder (session.ts sessionBinder), or null. */
export function callNames(template: IncidentTemplate, binder: ((text: string) => string) | null): CallNames {
  const tree = template.tree;
  const bind = (text: string) => {
    if (binder) { try { return binder(text); } catch { /* a line this call can't bind: role nouns */ } }
    return plainTokens(text, tree);
  };
  const clocks = new Map(template.situations.flatMap(situation => situation.clocks ?? []).map(clock => [clock.id, clock.label]));
  return {
    bind,
    node: id => sentenceCase(id),
    choice: (node, choice) => {
      const found = tree.nodes.find(entry => entry.id === node)?.choices.find(entry => entry.id === choice);
      return found ? bind(found.title) : sentenceCase(choice);
    },
    ending: id => tree.endings[id] ? bind(tree.endings[id].title) : sentenceCase(id),
    clock: id => clocks.has(id) ? plainTokens(clocks.get(id)!, tree) : sentenceCase(id),
  };
}

const BAND: Record<string, string> = { favorable: 'goes well', mixed: 'complications', adverse: 'goes badly' };
const CARD: Record<string, string> = { title: 'title', summary: 'hook', pressure: 'pressure line' };

/** A string row by where the player meets it. */
export function rowLabel(where: string, names: CallNames, tree: CallTree): string {
  const plain = where.replace(/@s(\d)$/, '');
  const situation = /@s(\d)$/.exec(where)?.[1];
  const tail = situation ? ` (situation ${situation})` : '';
  const index = (text: string) => { const m = /\[(\d+)\]/.exec(text); return m ? Number(m[1]) + 1 : 1; };
  const [head, ...rest] = plain.split('.');
  if (head === 'card') return `Call card · ${CARD[rest[0]] ?? rest.join(' ')}${tail}`;
  if (head === 'briefing') {
    const part = rest[0];
    const what = part.startsWith('known') ? `known ${index(part)}` : part.startsWith('unknown') ? `unknown ${index(part)}` : part.startsWith('team') ? `team job ${index(part)}` : 'dispatch';
    return `Briefing · ${what}${tail}`;
  }
  if (head === 'stage') return `Stage label · ${rest[0]}${tail}`;
  if (head === 'objective') return `Objective · ${sentenceCase(rest[0])}${tail}`;
  if (head === 'fact') return `Fact · ${sentenceCase(rest[0])} · ${rest[1] === 'claim' ? 'claim' : rest[1] === 'label' ? 'label' : rest[1]}${tail}`;
  if (head === 'clock') return `Clock · ${names.clock(rest[0])} · ${rest[1]?.startsWith('cue') ? `cue ${index(rest[1])}` : 'label'}${tail}`;
  if (head === 'ending') return `Ending · ${names.ending(rest[0])} · ${rest[1]?.startsWith('task') ? `still needed ${index(rest[1])}` : rest[1]}${tail}`;
  const node = tree.nodes.find(entry => entry.id === head);
  if (!node) return plain;
  if (rest[0] === 'prompt') return `${names.node(head)} · prompt${tail}`;
  if (rest[0]?.startsWith('promptIf')) return `${names.node(head)} · prompt variant ${index(rest[0])}${tail}`;
  const choice = rest[0];
  const field = rest.slice(1).join('.');
  const crumb = `${names.node(head)} › ${names.choice(head, choice)}`;
  if (field === 'title' || field === 'summary') return `${crumb} · ${field}${tail}`;
  if (field.startsWith('preview.')) return `${crumb} · preview, ${BAND[field.slice(8)] ?? field.slice(8)}${tail}`;
  if (field.startsWith('modifier')) return `${crumb} · odds modifier ${index(field)}${tail}`;
  const band = /^(favorable|mixed|adverse)\[(\d+)\]$/.exec(field);
  if (band) return `${crumb} · ${BAND[band[1]]}, line ${Number(band[2]) + 1}${tail}`;
  return `${crumb} · ${field}${tail}`;
}

/** What a note is about, in words. */
export function anchorLabel(anchor: string, names: CallNames, tree: CallTree, deps: DependencyIndex | null, lint: readonly LintFinding[] = []): string {
  if (anchor === CALL_ANCHOR) return 'The whole call';
  const sel = parseSelection(anchor);
  if (!sel) return anchor;
  switch (sel.kind) {
    case 'node': return names.node(sel.node);
    case 'choice': return `${names.node(sel.node)} › ${names.choice(sel.node, sel.choice)}`;
    case 'band': return `${names.node(sel.node)} › ${names.choice(sel.node, sel.choice)} · ${BAND[sel.band]}`;
    case 'ending': return `Ending · ${names.ending(sel.ending)}`;
    case 'key': return deps?.keys.get(sel.key as StateKey)?.label ?? sel.key;
    case 'string': return rowLabel(sel.row, names, tree);
    case 'field': return sel.path;
    case 'finding': return lint.find(finding => finding.id === sel.id)?.message ?? `Lint ${sel.id}`;
  }
}

const rowsByTree = new WeakMap<CallTree, Map<string, string>>();
function authored(tree: CallTree): Map<string, string> {
  let rows = rowsByTree.get(tree);
  if (!rows) {
    rows = new Map();
    for (const row of callStringRows(tree, text => text)) { rows.set(stringRowKey(row), row.text); if (!rows.has(row.where)) rows.set(row.where, row.text); }
    rowsByTree.set(tree, rows);
  }
  return rows;
}

/** What the player reads at an anchor, bound for the call in focus: the "sees" a note quotes. */
export function anchorSees(anchor: string, names: CallNames, tree: CallTree): string {
  // The engine writes the lead officer's surname at play time; the quote marks the spot.
  return seesText(anchor, names, tree).replace(/\{lead\}/g, '[lead officer]');
}

function seesText(anchor: string, names: CallNames, tree: CallTree): string {
  const sel = parseSelection(anchor);
  if (!sel) return anchor === CALL_ANCHOR ? names.bind(tree.summary) : '';
  const choice = (node: string, id: string) => tree.nodes.find(entry => entry.id === node)?.choices.find(entry => entry.id === id);
  switch (sel.kind) {
    case 'node': { const node = tree.nodes.find(entry => entry.id === sel.node); return node ? names.bind(node.prompt) : ''; }
    case 'choice': { const found = choice(sel.node, sel.choice); return found ? `${names.bind(found.title)} / ${names.bind(found.summary)}` : ''; }
    case 'band': { const found = choice(sel.node, sel.choice); return found ? names.bind(found.preview[sel.band]) : ''; }
    case 'ending': { const found = tree.endings[sel.ending]; return found ? `${names.bind(found.title)} / ${names.bind(found.summary)}` : ''; }
    case 'string': { const text = authored(tree).get(sel.row); return text ? names.bind(text) : ''; }
    default: return '';
  }
}
