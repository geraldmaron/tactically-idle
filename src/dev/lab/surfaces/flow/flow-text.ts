// Words for what Flow draws (spec 3.3): edge conditions as short chips ("if the handgun is real: no ✕"),
// public-state conditions, drawn results and turns, and the lint and note pins each box carries.
// Pure, so the chips read the same in the canvas, the inspector and the tests. Labels never show a
// role token: names come from the bound text elsewhere; here roles read as nouns.
import type { CallTree, TreeState } from '../../../../content/call-trees/types';
import type { IncidentTemplate } from '../../../../content/incidents/types';
import { plainTokens, roleNoun, sentenceCase } from '../../../../gen/incident/trees-v13/dependencies';
import type { DependencyIndex, LintFinding } from '../../../../gen/incident/trees-v13/dependencies';
import type { EdgeCondition, GraphEdge } from '../../../../gen/incident/trees-v13/graph';
import type { NotesFile } from '../../types';

export interface TextContext { tree: CallTree; template: IncidentTemplate; deps: DependencyIndex | null }
/** One condition as a chip: its words, and for a fact whether it holds in this call's situation. */
export interface ConditionChip { text: string; kind: 'fact' | 'clock' | 'meter' | 'state' | 'count'; holds?: boolean }

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

export function markLabel(ctx: TextContext, mark: string): string {
  return ctx.deps?.keys.get(`mark:${mark}`)?.label ?? sentenceCase(mark);
}

export function clockLabel(ctx: TextContext, id: string): string {
  for (const situation of ctx.template.situations) for (const clock of situation.clocks ?? []) if (clock.id === id) return plainTokens(clock.label, ctx.tree);
  return sentenceCase(id);
}

export function factLabel(ctx: TextContext, fact: string): string {
  const def = ctx.tree.facts[fact];
  return def ? plainTokens(def.label, ctx.tree) : sentenceCase(fact);
}

/** Who a role or group is, as a noun phrase ("the shop owner", "the others"). */
export function roleWords(ctx: TextContext, role: string): string {
  if (ctx.tree.groups?.[role]) return `the ${role.replace(/_/g, ' ')}`;
  return `the ${roleNoun(ctx.tree, role)}`;
}

/** Public state (onlyIf, an outcome's `when`, a prompt variant's `when`) as chips. */
export function stateChips(ctx: TextContext, state: TreeState | undefined): ConditionChip[] {
  if (!state) return [];
  return [
    ...(state.marks ?? []).map(mark => ({ text: markLabel(ctx, mark), kind: 'state' as const })),
    ...(state.notMarks ?? []).map(mark => ({ text: `not yet: ${lower(markLabel(ctx, mark))}`, kind: 'state' as const })),
    ...(state.safe ?? []).map(role => ({ text: `${sentenceCase(roleWords(ctx, role))} out safe`, kind: 'state' as const })),
    ...(state.notSafe ?? []).map(role => ({ text: `${sentenceCase(roleWords(ctx, role))} still inside`, kind: 'state' as const })),
    ...(state.count ? [{ text: countText(state.count), kind: 'count' as const }] : []),
  ];
}

function countText(count: NonNullable<TreeState['count']>): string {
  const who = count.role.replace(/_/g, ' ');
  if (count.min !== undefined && count.max !== undefined) return count.min === count.max ? `${who} = ${count.min}` : `${who} ${count.min} to ${count.max}`;
  if (count.min !== undefined) return `${who} ≥ ${count.min}`;
  return `${who} ≤ ${count.max ?? 0}`;
}

const STANCE: Record<string, string> = { unheard: 'unheard', calm: 'calm', tense: 'tense', volatile: 'volatile', breaking: 'breaking', yielding: 'yielding' };

/** One edge condition as a chip. A fact reads the hidden truth: `holds` says whether it is true in
 * this call's situation (absent when the population spans every situation). */
export function conditionChip(ctx: TextContext, c: EdgeCondition): ConditionChip[] {
  if (c.kind === 'fact') return [{ text: `if ${lower(factLabel(ctx, c.fact))}: ${c.is ? 'yes' : 'no'}`, kind: 'fact', ...(c.holds !== undefined ? { holds: c.holds } : {}) }];
  if (c.kind === 'clock') {
    const label = lower(clockLabel(ctx, c.clock));
    const state = c.when === 'out' ? (c.is ? 'runs out' : 'has not run out') : (c.is ? 'is running low' : 'is not low yet');
    return [{ text: `if ${label} ${state}`, kind: 'clock' }];
  }
  if (c.kind === 'meter') {
    const who = roleWords(ctx, c.role);
    const parts = [c.stance?.length ? c.stance.map(s => STANCE[s] ?? s).join(' or ') : '', c.agitationAtLeast !== undefined ? `agitation ${c.agitationAtLeast} or more` : ''].filter(Boolean).join(', ');
    return [{ text: `${c.is === false ? 'unless' : 'if'} ${who} is ${parts}`, kind: 'meter' }];
  }
  return stateChips(ctx, c.state);
}

export const DRAWN_WORDS: Record<NonNullable<GraphEdge['drawn']>, string> = {
  fatal: 'force: someone killed', hurt: 'force: someone hurt', none: 'force: nobody hurt', all: 'everyone follows', some: 'some follow',
};
/** A drawn result in words; a cascade's `none` reads as nobody following, not as force. */
export function drawnWords(edge: Pick<GraphEdge, 'via' | 'drawn'>): string {
  if (!edge.drawn) return '';
  if (edge.via === 'cascade' && edge.drawn === 'none') return 'nobody follows';
  return DRAWN_WORDS[edge.drawn];
}

// ---------------------------------------------------------------- pins

export interface Pins { lint: LintFinding[]; notes: number }

/** The box ids a finding belongs to: its node or ending, and each choice its sites name. */
export function findingBoxes(f: LintFinding): string[] {
  const ids = new Set<string>();
  if (f.node) ids.add(`node:${f.node}`);
  if (f.ending) ids.add(`ending:${f.ending}`);
  for (const site of f.sites) {
    if (site.node) ids.add(`node:${site.node}`);
    if (site.node && site.choice) ids.add(`choice:${site.node}/${site.choice}`);
  }
  return [...ids];
}

/** The box ids a review note's anchor points at. */
export function noteBoxes(anchor: string): string[] {
  const at = anchor.indexOf(':');
  const kind = anchor.slice(0, at), rest = anchor.slice(at + 1);
  const parts = rest.split('/');
  if (kind === 'node') return [`node:${rest}`];
  if (kind === 'ending') return [`ending:${rest}`];
  if ((kind === 'choice' || kind === 'band') && parts.length >= 2) return [`node:${parts[0]}`, `choice:${parts[0]}/${parts[1]}`];
  return [];
}

/** Lint findings and open notes per box. A finding muted by an accepted note (`finding:<id>`) is
 * left out of every count (spec 6.3, Mute with reason). */
export function pinsByBox(findings: readonly LintFinding[], notes: NotesFile | null): Map<string, Pins> {
  const muted = new Set((notes?.notes ?? []).filter(n => n.anchor.startsWith('finding:')).map(n => n.anchor.slice(8)));
  const out = new Map<string, Pins>();
  const at = (id: string) => out.get(id) ?? out.set(id, { lint: [], notes: 0 }).get(id)!;
  for (const f of findings) if (!muted.has(f.id)) for (const id of findingBoxes(f)) at(id).lint.push(f);
  for (const note of notes?.notes ?? []) if (note.severity !== 'accepted') for (const id of noteBoxes(note.anchor)) at(id).notes++;
  return out;
}

const SEVERITY = { error: 0, warn: 1, info: 2 } as const;
/** The worst severity among findings, for the pin's glyph. */
export function worstSeverity(findings: readonly LintFinding[]): LintFinding['severity'] | null {
  return findings.reduce<LintFinding['severity'] | null>((worst, f) => (worst === null || SEVERITY[f.severity] < SEVERITY[worst] ? f.severity : worst), null);
}
