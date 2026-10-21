// What the Calls landing shows (spec 3.1), as pure data: each call's gate checks and how they stand,
// how the call usually ends (random style, 60 calls, from cache), each ending's run classes for the
// shape thumbnail, and the findings feed across the four calls. Nothing here runs a simulation: the
// numbers come from results the pool already holds.
import { WEIGHTS, GATE_SUITE, gatePasses } from '../../../../gen/incident/trees-v13/balance';
import type { CallResult, GateCheck, GateJob, Weight } from '../../../../gen/incident/trees-v13/balance';
import { plainTokens, sentenceCase } from '../../../../gen/incident/trees-v13/dependencies';
import type { DependencyIndex, LintFinding } from '../../../../gen/incident/trees-v13/dependencies';
import type { IncidentTemplate } from '../../../../content/incidents/types';
import { AVOIDABLE_THEMES, CONTENT_DESCRIPTORS, type ContentDescriptor } from '../../../../content/content-descriptors';
import { derivedDescriptors } from '../../../../gen/incident/gates/content-descriptors';
import type { IncidentType } from '../../../../sim/scenario-types';
import type { ReachTally } from '../../jobs/tally';
import type { GateRun, GateVerdict } from '../../model/gate-view';
import { styleLabel } from '../../model/label';
import type { NotesFile } from '../../types';

/** The gate checks of one call type, in the suite's order. */
export const checksFor = (type: IncidentType, suite: readonly GateCheck[] = GATE_SUITE): GateCheck[] => suite.filter(check => check.type === type);

/** A check's row label: the metric, and the style when it isn't the random style. */
export const checkLabel = (check: GateCheck): string => (check.style === 'random' ? check.label : `${check.label} · ${styleLabel(check.style)}`);

export interface GateTally { pass: number; fail: number; notRun: number; total: number }
export function gateTally(verdicts: readonly GateVerdict[]): GateTally {
  const pass = verdicts.filter(v => v.pass === true).length, fail = verdicts.filter(v => v.pass === false).length;
  return { pass, fail, notRun: verdicts.length - pass - fail, total: verdicts.length };
}

/** "24 of 24 pass", "23 of 24 pass, 1 fails", "12 of 24 run". */
export function gateLine(t: GateTally): string {
  if (t.notRun === t.total) return `Not run (${t.total} checks)`;
  if (t.notRun) return `${t.pass + t.fail} of ${t.total} run: ${t.pass} pass${t.fail ? `, ${t.fail} ${t.fail === 1 ? 'fails' : 'fail'}` : ''}`;
  return `${t.pass} of ${t.total} pass${t.fail ? `, ${t.fail} ${t.fail === 1 ? 'fails' : 'fail'}` : ''}`;
}

/** The gate's standing for the tuning in force, in words, and whether it reads as a pass or a fail
 * (null: neither, as when only the saved side has run under a pending patch). Without a patch:
 * "Saved tuning: 24 of 24 pass". With one, the patched side's verdicts ("Unsaved tuning: 23 of 24
 * pass, 1 fails"), and until that side runs the saved side's, named as such ("Saved: 22 of 24 pass,
 * 2 fail · not run for this change yet"). `prefix` false drops the "Saved tuning:" / "Unsaved
 * tuning:" lead where the panel already says which; `scope` ("for this call") follows the count. */
export function gateHeadline(verdicts: readonly GateVerdict[], pending: boolean, prefix = true, scope = ''): { text: string; tone: 'pass' | 'fail' | null } {
  const tally = gateTally(verdicts);
  const tone = (t: GateTally) => (t.fail > 0 ? 'fail' : t.pass > 0 ? 'pass' : null);
  const ran = verdicts.filter(v => v.saved !== null);
  if (pending && tally.notRun === tally.total && ran.length) {
    const saved = ran.filter(v => gatePasses(v.check, v.saved!)).length;
    const savedTally = { pass: saved, fail: ran.length - saved, notRun: verdicts.length - ran.length, total: verdicts.length };
    return { text: `Saved: ${gateLine(savedTally)}${scope ? ` ${scope}` : ''} · not run for this change yet`, tone: null };
  }
  return { text: `${prefix ? (pending ? 'Unsaved tuning: ' : 'Saved tuning: ') : ''}${gateLine(tally)}${scope ? ` ${scope}` : ''}`, tone: tone(tally) };
}

/** "from cache, 4 min ago", "just now", "2 h ago". */
export function ageText(at: number, now: number, fromCache: boolean): string {
  const minutes = Math.max(0, Math.round((now - at) / 60000));
  const age = minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;
  return fromCache ? `from cache, ${age}` : age;
}

/** How a set of runs ended, by run class: counts and the number of runs. */
export interface Usually { counts: Record<Weight, number>; n: number; source: 'reach' | 'gate' }

const zero = (): Record<Weight, number> => ({ death: 0, hurt: 0, unresolved: 0, costly: 0, clean: 0 });

/** How a type usually ends, random style, 60 calls (the CI population): from a cached this-type tally,
 * or else from the gate's random-style results for that type (the same calls, so the same numbers). */
export function usuallyOf(type: IncidentType, tally: ReachTally | null, runs: readonly GateRun[]): Usually | null {
  if (tally && tally.runs > 0) return { counts: { ...zero(), ...tally.weights }, n: tally.runs, source: 'reach' };
  const gate = runs.find(run => run.side === 'saved' && run.job.type === type && run.job.style === 'random' && run.job.calls === 60);
  if (!gate || !gate.results.length) return null;
  const counts = zero();
  for (const r of gate.results) counts[r.weight]++;
  return { counts, n: gate.results.length, source: 'gate' };
}

/** The run classes of the runs that ended at each ending. */
export function endingWeights(tally: ReachTally | null, results: readonly CallResult[] | null): Record<string, Record<Weight, number>> {
  if (tally) return Object.fromEntries(Object.entries(tally.endings).map(([id, e]) => [id, { ...e.weights }]));
  const out: Record<string, Record<Weight, number>> = {};
  for (const r of results ?? []) (out[r.ending] ??= zero())[r.weight]++;
  return out;
}

/** The gate's random-style 60-call results for a type, when they ran. */
export const randomResults = (type: IncidentType, runs: readonly GateRun[]): readonly CallResult[] | null =>
  runs.find(run => run.side === 'saved' && run.job.type === type && run.job.style === 'random' && run.job.calls === 60)?.results ?? null;

/** Run classes, best first, as the strips draw them. */
export const WEIGHTS_BEST_FIRST: readonly Weight[] = [...WEIGHTS].reverse();

/** Run-class counts scaled to `n` glyphs by largest remainder, best class first: the call strip's
 * "usually" row. A class with any runs that rounds to nothing still gets no glyph; the title says it. */
export function glyphRun(counts: Record<Weight, number>, n = 8): Weight[] {
  const total = WEIGHTS_BEST_FIRST.reduce((sum, w) => sum + counts[w], 0);
  if (!total) return [];
  const parts = WEIGHTS_BEST_FIRST.map(w => { const exact = (counts[w] / total) * n; return { w, exact, k: Math.floor(exact) }; });
  let left = n - parts.reduce((sum, part) => sum + part.k, 0);
  for (const part of [...parts].sort((a, b) => (b.exact - b.k) - (a.exact - a.k))) { if (left <= 0) break; part.k++; left--; }
  return parts.flatMap(part => Array.from({ length: part.k }, () => part.w));
}

// ---------------------------------------------------------------- findings

export interface FeedRow { finding: LintFinding; type: IncidentType; muted: string | null }

const SEVERITY = { error: 0, warn: 1, info: 2 } as const;

/** Static and simulated findings for every call, worst first; findings muted by an accepted note
 * (`finding:<id>`) go last with the note's reason. */
export function findingsFeed(byType: readonly { type: IncidentType; findings: readonly LintFinding[]; notes: NotesFile | null }[]): FeedRow[] {
  const rows: FeedRow[] = [];
  for (const { type, findings, notes } of byType) {
    const muted = new Map((notes?.notes ?? []).filter(n => n.anchor.startsWith('finding:')).map(n => [n.anchor.slice(8), n.text || n.fix || 'Accepted']));
    for (const finding of findings) rows.push({ finding, type, muted: muted.get(finding.id) ?? null });
  }
  return rows.sort((a, b) => Number(!!a.muted) - Number(!!b.muted) || SEVERITY[a.finding.severity] - SEVERITY[b.finding.severity]);
}

export function severityCounts(rows: readonly FeedRow[]): Record<LintFinding['severity'], number> {
  const out = { error: 0, warn: 0, info: 0 };
  for (const row of rows) if (!row.muted) out[row.finding.severity]++;
  return out;
}

/** Where a finding lives, as a lab destination: a node or ending on Flow, a state key on
 * Dependencies, else Dependencies' lint list. */
export function findingSite(f: LintFinding): { tab: 'flow' | 'deps'; sel: { kind: 'node'; node: string } | { kind: 'ending'; ending: string } | { kind: 'key'; key: string } | { kind: 'finding'; id: string } } {
  if (f.key) return { tab: 'deps', sel: { kind: 'key', key: f.key } };
  if (f.node) return { tab: 'flow', sel: { kind: 'node', node: f.node } };
  if (f.ending) return { tab: 'flow', sel: { kind: 'ending', ending: f.ending } };
  return { tab: 'deps', sel: { kind: 'finding', id: f.id } };
}

/** The job behind a check, for progress. */
export const jobOf = (check: GateCheck): GateJob => ({ type: check.type, style: check.style, calls: check.calls, tier: check.tier });

// ---------------------------------------------------------------- findings in words

/** A lint finding for the feed: where it lives in words ("Pinned › Get the officer to the medic
 * first") and its message with raw ids (marks, clocks, choices) read as their labels. The finding's
 * own text stays the source; this only swaps ids for names. */
export function humanizeFinding(f: LintFinding, template: IncidentTemplate, deps: DependencyIndex | null): { where: string | null; message: string } {
  const tree = template.tree;
  const site = f.sites.find(entry => entry.node);
  const node = f.node ?? site?.node;
  const choice = site?.node && site.choice ? tree.nodes.find(n => n.id === site.node)?.choices.find(c => c.id === site.choice) : undefined;
  const choiceTitle = choice ? plainTokens(choice.title, tree) : null;
  const where = node && choiceTitle ? `${sentenceCase(node)} › ${choiceTitle}`
    : node ? sentenceCase(node) : f.ending && tree.endings[f.ending] ? plainTokens(tree.endings[f.ending].title, tree) : f.key ? deps?.keys.get(f.key)?.label ?? null : null;
  let message = f.message;
  if (node && choice) message = message.replace(`${sentenceCase(node)} › ${choice.id}`, `“${choiceTitle}” at ${sentenceCase(node)}`);
  return { where, message: readIds(message, template, deps) };
}

/** Raw ids in a sentence (marks, clocks, nodes: `officer_down`, `owner_condition`) read as their
 * labels; anything else stays as written. For lint messages and the compiler's prune reasons. */
export function readIds(text: string, template: IncidentTemplate, deps: DependencyIndex | null): string {
  const tree = template.tree;
  const clocks = new Map(template.situations.flatMap(s => (s.clocks ?? []).map(c => [c.id, plainTokens(c.label, tree)] as const)));
  const quoted = (label: string) => `“${label.charAt(0).toLowerCase()}${label.slice(1)}”`;
  return text.replace(/\b[a-z]+(?:_[a-z0-9]+)+\b/g, word => {
    const mark = deps?.keys.get(`mark:${word}`)?.label;
    if (mark) return quoted(mark);
    const clock = clocks.get(word);
    if (clock) return quoted(clock);
    if (tree.nodes.some(n => n.id === word)) return sentenceCase(word);
    return word;
  });
}

// ---------------------------------------------------------------- content descriptors

/** One situation's content descriptors (docs/content-rating.md), for the card's Content row: each
 * descriptor it declares, whether the tree derives it and whether a player can avoid it, any
 * the tree derives that the list leaves out (the content gate fails on those), and the E4 screen
 * reason when there is one. `note` is the authoring note in role nouns. */
export interface SituationContent { index: 0 | 1 | 2; note: string; tags: { descriptor: ContentDescriptor; derived: boolean; avoidable: boolean }[]; missing: ContentDescriptor[]; screened: string | null }

export function situationContent(template: IncidentTemplate): SituationContent[] {
  return ([0, 1, 2] as const).map(index => {
    const situation = template.tree.situations[index];
    let derived: ContentDescriptor[] = [];
    try { derived = derivedDescriptors(template, index); } catch { derived = []; }
    const declared = new Set(situation.descriptors ?? []);
    return {
      index, note: plainTokens(situation.note, template.tree),
      tags: CONTENT_DESCRIPTORS.filter(d => declared.has(d)).map(descriptor => ({ descriptor, derived: derived.includes(descriptor), avoidable: (AVOIDABLE_THEMES as readonly ContentDescriptor[]).includes(descriptor) })),
      missing: derived.filter(d => !declared.has(d)), screened: situation.selfHarmScreened ?? null,
    };
  });
}

/** A descriptor in words: "police gunfire", "suicide or self-harm". */
export const descriptorLabel = (descriptor: ContentDescriptor): string => descriptor === 'suicide_self_harm' ? 'suicide or self-harm' : descriptor.replace(/_/g, ' ');
