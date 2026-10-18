// Review notes (spec 3.8): a finding pinned to a node, choice, band, ending, string, state key,
// tuning field or lint finding, routed to the skill that owns the fix, and exported in the review
// skill's row shape (.agents/skills/swat-writing-review/SKILL.md, section 11). A note keeps a hash
// of the authored text it was written against, so the lab can say when that text has changed since
// (or is gone). Pure: the Review drawer, Script and Dependencies wire it.
import type { CallTree } from '../../../content/call-trees/types';
import type { IncidentTemplate } from '../../../content/incidents/types';
import { dependencyIndex, lintTree } from '../../../gen/incident/trees-v13/dependencies';
import type { DependencyIndex, LintCode, LintFinding, StateKey } from '../../../gen/incident/trees-v13/dependencies';
import { callStringRows } from '../../../gen/incident/trees-v13/strings';
import type { IncidentType } from '../../../sim/scenario-types';
import type { NotesFile, ReviewNote, Selection } from '../types';
import { parseSelection, selectionText } from '../url';
import { stringRowKey } from './snapshots';

export type Severity = ReviewNote['severity'];
export type Route = ReviewNote['route'];
export type NoteStatus = 'current' | 'changed' | 'orphaned';

/** The review skill's severity words (block, fix before freeze, note), plus accepted for muted lint. */
export const SEVERITY_WORDS: Record<Severity, string> = { block: 'block', fix: 'fix before freeze', note: 'note', accepted: 'accepted' };
export const SEVERITY_LABEL: Record<Severity, string> = { block: 'Block', fix: 'Fix before freeze', note: 'Note', accepted: 'Accepted' };
export const SEVERITY_HELP: Record<Severity, string> = {
  block: 'Shipping would mislead, harm or break.',
  fix: 'The player would feel it.',
  note: 'Polish, or a pattern to watch.',
  accepted: 'A lint finding kept on purpose.',
};
/** Who owns the fix (the review skill's routing): structure, lines, officer text, the engine, policy. */
export const ROUTES: readonly { value: Route; label: string; help: string }[] = [
  { value: 'swat-call-prose', label: 'Prose', help: 'A line reads wrong: swat-call-prose' },
  { value: 'swat-call-design', label: 'Design', help: 'The structure or a choice is wrong: swat-call-design' },
  { value: 'swat-officer-stories', label: 'Officers', help: 'Officer text: swat-officer-stories' },
  { value: 'engineering', label: 'Engineering', help: 'A compiler, gate or schema change, as a written request' },
  { value: 'owner', label: 'Owner', help: 'A policy decision for the owner' },
];
/** Rule ids the review skill uses, offered as suggestions (the field stays free text). */
export const RULE_SUGGESTIONS: readonly string[] = [
  ...Array.from({ length: 8 }, (_, i) => `fake-choice ${i + 1}`),
  'cold read', 'restatement', 'cue trace', 'cost lands', 'static walk',
  'table claims', 'table dominance', 'table pairs', 'table time-band', 'table taps', 'table coverage',
  ...Array.from({ length: 11 }, (_, i) => `H${i + 1}`),
  'budget prompt', 'budget preview', 'budget result', 'batch repeats',
];
export const VERDICT_HELP = {
  approve: 'Zero block and zero fix before freeze notes remain, and the reader was separate.',
  edit: 'Every block and fix before freeze note has a fix as data or a filed request.',
  reject: 'A stage’s decision is not real, a red line is crossed or a blocker has no fix as data.',
} as const;

// ---------------------------------------------------------------- anchors

/** The anchor a note on this selection carries: the selection as it reads in the URL
 * (`choice:offer/take_courier`, `string:talking.offer.preview.mixed`, `finding:threat_only:mark:turned`). */
export function anchorFor(sel: Selection): string {
  return selectionText(sel);
}

/** A whole-call note (no selection). */
export const CALL_ANCHOR = 'call';

/** FNV-1a over the text, base 36: what a note remembers of the text it was written against. */
export function contentHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `${(h >>> 0).toString(36)}${text.length.toString(36)}`;
}

/** What an anchor's text is read from: the call's template, plus resolvers for what lives outside
 * the tree (tuning values; lint findings beyond the static ones). */
export interface AnchorContext {
  template: IncidentTemplate;
  /** A tuning field's current saved value as text, or null when the path is gone. Without it a
   * field anchor is always current. */
  field?: (path: string) => string | null;
  /** Findings beyond static lint (simulation, matcher audit) that exist right now. */
  findings?: readonly LintFinding[];
}

const STATIC_CODES = new Set<LintCode>(['read_never_written', 'dead_write', 'threat_only', 'drawn_only', 'clock_writer', 'unreachable_node', 'unreachable_ending', 'never_offered', 'never_matched']);
const BANDS = ['favorable', 'mixed', 'adverse'] as const;

const rawRows = new WeakMap<CallTree, Map<string, string>>();
/** The tree's authored strings by row key, unbound (memoized per tree object). */
function authoredRows(tree: CallTree): Map<string, string> {
  let rows = rawRows.get(tree);
  if (!rows) {
    rows = new Map();
    for (const row of callStringRows(tree, text => text)) {
      rows.set(stringRowKey(row), row.text);
      if (!rows.has(row.where)) rows.set(row.where, row.text);
    }
    rawRows.set(tree, rows);
  }
  return rows;
}
const indexes = new WeakMap<IncidentTemplate, { deps: DependencyIndex; lint: LintFinding[] }>();
function analysisOf(template: IncidentTemplate) {
  let found = indexes.get(template);
  if (!found) { const deps = dependencyIndex(template); found = { deps, lint: lintTree(template, deps) }; indexes.set(template, found); }
  return found;
}

/** The authored text behind an anchor (unbound, so a different draw never reads as a change), or
 * null when the anchor no longer exists. */
export function anchorText(anchor: string, ctx: AnchorContext): string | null {
  const tree = ctx.template.tree;
  if (anchor === CALL_ANCHOR) return [tree.title, tree.summary].join('\n');
  const sel = parseSelection(anchor);
  if (!sel) return null;
  const node = (id: string) => tree.nodes.find(entry => entry.id === id);
  const choice = (n: string, c: string) => node(n)?.choices.find(entry => entry.id === c);
  switch (sel.kind) {
    case 'node': {
      const found = node(sel.node);
      return found ? [found.prompt, ...(found.promptIf ?? []).map(entry => entry.prompt)].join('\n') : null;
    }
    case 'choice': {
      const found = choice(sel.node, sel.choice);
      return found ? [found.title, found.summary, ...BANDS.map(band => found.preview[band]), ...BANDS.flatMap(band => found.outcomes[band].map(outcome => outcome.text))].join('\n') : null;
    }
    case 'band': {
      const found = choice(sel.node, sel.choice);
      return found ? [found.preview[sel.band], ...found.outcomes[sel.band].map(outcome => outcome.text)].join('\n') : null;
    }
    case 'ending': {
      const found = tree.endings[sel.ending];
      return found ? [found.title, found.summary, ...(found.remainingTasks ?? [])].join('\n') : null;
    }
    case 'string': return authoredRows(tree).get(sel.row) ?? null;
    case 'key': {
      const entry = analysisOf(ctx.template).deps.keys.get(sel.key as StateKey);
      return entry ? entry.label : null;
    }
    case 'field': return ctx.field ? ctx.field(sel.path) : sel.path;
    case 'finding': {
      const found = analysisOf(ctx.template).lint.find(finding => finding.id === sel.id) ?? ctx.findings?.find(finding => finding.id === sel.id);
      if (found) return found.message;
      // A static finding that lint no longer reports has been fixed; one from runs may just not be run yet.
      const code = sel.id.split(':')[0] as LintCode;
      return STATIC_CODES.has(code) ? null : sel.id;
    }
  }
}

/** Current, changed since the note (the anchored text's hash differs), or orphaned (the anchor is
 * gone). A note without a hash (left by the old lab) is current while its anchor exists. */
export function noteStatus(n: ReviewNote, current: (anchor: string) => string | null): NoteStatus {
  const text = current(n.anchor);
  if (text === null) return 'orphaned';
  if (!n.contentHash) return 'current';
  return contentHash(text) === n.contentHash ? 'current' : 'changed';
}

export const STATUS_LABEL: Record<NoteStatus, string> = { current: 'Current', changed: 'Changed since this note', orphaned: 'Anchor gone' };

// ---------------------------------------------------------------- where a note shows

/** The string row a note's pin sits on in Script, by row `where`: a node's prompt, a choice's title,
 * a band's preview, an ending's title, or the string itself. Null for anchors with no row. */
export function pinRow(anchor: string): string | null {
  const sel = parseSelection(anchor);
  if (!sel) return anchor === CALL_ANCHOR ? 'card.title' : null;
  switch (sel.kind) {
    case 'node': return `${sel.node}.prompt`;
    case 'choice': return `${sel.node}.${sel.choice}.title`;
    case 'band': return `${sel.node}.${sel.choice}.preview.${sel.band}`;
    case 'ending': return `ending.${sel.ending}.title`;
    case 'string': return sel.row.replace(/@s\d$/, '');
    default: return null;
  }
}

/** Whether a note's anchor covers a string row (`where`): the row itself, or the node, choice, band
 * or ending it belongs to. */
export function anchorCovers(anchor: string, where: string): boolean {
  const sel = parseSelection(anchor);
  if (!sel) return anchor === CALL_ANCHOR && where.startsWith('card.');
  switch (sel.kind) {
    case 'node': return where.startsWith(`${sel.node}.`);
    case 'choice': return where.startsWith(`${sel.node}.${sel.choice}.`);
    case 'band': return where === `${sel.node}.${sel.choice}.preview.${sel.band}` || where.startsWith(`${sel.node}.${sel.choice}.${sel.band}[`);
    case 'ending': return where.startsWith(`ending.${sel.ending}.`);
    case 'string': return sel.row.replace(/@s\d$/, '') === where;
    default: return false;
  }
}

/** The node a note belongs to (for pins on Flow nodes and X-ray rows), when it has one. */
export function anchorNode(anchor: string): string | null {
  const sel = parseSelection(anchor);
  if (!sel) return null;
  if (sel.kind === 'node' || sel.kind === 'choice' || sel.kind === 'band') return sel.node;
  if (sel.kind === 'string') { const head = sel.row.split('.')[0]; return /^(card|briefing|stage|objective|fact|ending|clock)$/.test(head) ? null : head; }
  return null;
}

/** Finding ids muted by an accepted note: they leave every count. */
export function mutedFindings(file: NotesFile): Map<string, ReviewNote> {
  return new Map(file.notes.filter(note => note.severity === 'accepted' && note.anchor.startsWith('finding:')).map(note => [note.anchor.slice('finding:'.length), note]));
}

// ---------------------------------------------------------------- making notes

let seq = 0;
/** A fresh note id: time, then a counter, so two notes saved in one millisecond never collide. */
export function noteId(at = Date.now()): string {
  seq = (seq + 1) % 1296;
  return `n${at.toString(36)}${seq.toString(36).padStart(2, '0')}`;
}

/** An accepted note that mutes a lint finding, with the reason it stays. */
export function muteNote(f: LintFinding, reason: string, ctx: { type: IncidentType; url: string; draw: ReviewNote['draw'] }): ReviewNote {
  const at = Date.now();
  return {
    id: noteId(at), type: ctx.type, anchor: `finding:${f.id}`, severity: 'accepted', rule: `lint ${f.code}`, route: 'owner',
    sees: f.message, fix: '', text: reason.trim(), at, draw: ctx.draw, url: ctx.url, contentHash: contentHash(f.message),
  };
}

/** Notes kept in this browser (`kept`, from readLocalNotes: the old lab's list, or a file saved here
 * while the dev server was down) that the notes file lacks, matched on id or on anchor and text, so
 * the drawer can offer them instead of hiding them once the server answers again. */
export function browserOnlyNotes(file: NotesFile, kept: NotesFile): ReviewNote[] {
  const ids = new Set(file.notes.map(note => note.id));
  return kept.notes.filter(note => !ids.has(note.id) && !file.notes.some(entry => entry.anchor === note.anchor && entry.text === note.text));
}

/** The file with a note added, or replaced when one with the same id exists. */
export function withNote(file: NotesFile, note: ReviewNote): NotesFile {
  const at = file.notes.findIndex(entry => entry.id === note.id);
  return { ...file, notes: at < 0 ? [...file.notes, note] : file.notes.map((entry, i) => i === at ? note : entry) };
}
export function withoutNote(file: NotesFile, id: string): NotesFile {
  return { ...file, notes: file.notes.filter(entry => entry.id !== id) };
}

/** Three-way merge after the notes file changed on disk (a 409): `base` is the file this page last
 * read, `mine` is base plus this page's edits, `disk` is the file now. Notes this page added or
 * changed win, notes it removed go, everything else is the disk's; the verdict is this page's only
 * when it changed it. */
export function mergeNotes(base: NotesFile, mine: NotesFile, disk: NotesFile): NotesFile {
  const before = new Map(base.notes.map(note => [note.id, JSON.stringify(note)]));
  const kept = new Set(mine.notes.map(note => note.id));
  let merged: NotesFile = { ...disk, notes: disk.notes.filter(note => kept.has(note.id) || !before.has(note.id)) };
  for (const note of mine.notes) if (before.get(note.id) !== JSON.stringify(note)) merged = withNote(merged, note);
  const verdictChanged = JSON.stringify(base.verdict) !== JSON.stringify(mine.verdict);
  return verdictChanged ? { ...merged, verdict: mine.verdict } : merged;
}

// ---------------------------------------------------------------- export

/** The field path a finding row names for an anchor. */
export function fieldPath(anchor: string): string {
  const sel = parseSelection(anchor);
  if (!sel) return anchor === CALL_ANCHOR ? 'card' : anchor;
  switch (sel.kind) {
    case 'node': return `${sel.node}.prompt`;
    case 'choice': return `${sel.node}.${sel.choice}`;
    case 'band': return `${sel.node}.${sel.choice}.${sel.band}`;
    case 'ending': return `ending.${sel.ending}`;
    case 'string': return sel.row;
    case 'key': return `state ${sel.key}`;
    case 'field': return sel.path;
    case 'finding': return `lint ${sel.id}`;
  }
}

/** One line, safe inside a row: no newlines, no column bars. */
const cell = (text: string) => text.replace(/\s*\n+\s*/g, ' / ').replace(/\|/g, '/').trim();

/** "hostage_crisis, s2, market_row seed 7 call 2": the call, situation and seed of a note's draw. */
export function drawText(n: ReviewNote): string {
  let family = '', seed = '';
  try {
    const query = new URLSearchParams(n.url.includes('?') ? n.url.slice(n.url.indexOf('?') + 1) : '');
    family = query.get('family') ?? '';
    seed = query.get('seed') ?? '';
    const id = query.get('id');
    if (id && !family) return `${n.type}, s${n.draw.situation + 1}, ${id}`;
  } catch { /* a malformed link: the call and situation still say enough */ }
  const building = family ? `, ${family}${seed ? ` seed ${seed}` : ''}` : '';
  return `${n.type}, s${n.draw.situation + 1}${building} call ${n.draw.call}`;
}

/** One finding in the review skill's row shape:
 * `[severity] <call, situation, seed> | <field path> | sees '<…>' | rule <id> | fix as data '<…>' | route <…>`. */
export function findingRow(n: ReviewNote): string {
  return `[${SEVERITY_WORDS[n.severity]}] ${drawText(n)} | ${fieldPath(n.anchor)} | sees '${cell(n.sees)}' | rule ${cell(n.rule) || 'none'} | fix as data '${cell(n.fix)}' | route ${n.route}`;
}

const SEVERITY_ORDER: Record<Severity, number> = { block: 0, fix: 1, note: 2, accepted: 3 };

/** The review findings for one call as Markdown: the verdict line, one row per note (blockers
 * first), each note's text and deep link, then the lint kept on purpose. `version` is the call's
 * content version for the verdict line. */
export function findingsMarkdown(file: NotesFile, callTitle: string, link: (n: ReviewNote) => string, version = 13): string {
  const open = file.notes.filter(note => note.severity !== 'accepted').sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.at - b.at);
  const accepted = file.notes.filter(note => note.severity === 'accepted');
  const count = (severity: Severity) => open.filter(note => note.severity === severity).length;
  const verdict = file.verdict?.value ?? 'edit';
  const lines = [
    `# Review findings: ${callTitle} (${file.type})`,
    '',
    '```',
    `Verdict ${file.type} v${version} | ${verdict}${file.verdict ? '' : ' (not set in the lab)'} | block ${count('block')} | fix before freeze ${count('fix')} | note ${count('note')} | ships in ?`,
    '```',
    '',
  ];
  if (!open.length) lines.push('No open findings.', '');
  else {
    lines.push('```', ...open.map(findingRow), '```', '');
    lines.push('## Notes and links', '');
    for (const note of open) lines.push(`- [${SEVERITY_WORDS[note.severity]}] ${fieldPath(note.anchor)}: ${cell(note.text) || '(no note text)'} ${link(note)}`);
    lines.push('');
  }
  if (accepted.length) {
    lines.push('## Lint kept on purpose', '');
    for (const note of accepted) lines.push(`- ${fieldPath(note.anchor)}: ${cell(note.text) || '(no reason given)'}`);
    lines.push('');
  }
  return lines.join('\n');
}
