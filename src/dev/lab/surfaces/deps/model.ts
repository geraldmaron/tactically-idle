// Dependencies in words (spec 3.5, 6): state keys grouped by kind with plain names, each writer and
// reader site as a crumb a reader can follow ("Offer › Ask for Ruth too · goes well") plus what the
// site does with the key, lint codes as plain explanations, and the targets the Why tracer can
// explain. Pure; the surface wires it. Every fact here comes from the shared dependency index and
// requirement trees (trees-v13/dependencies.ts); nothing evaluates a condition.
import type { CallTree } from '../../../../content/call-trees/types';
import { choiceActionId } from '../../../../gen/incident/trees-v13/compile';
import { plainTokens, requirementTree, roleNoun, sentenceCase, siteKey } from '../../../../gen/incident/trees-v13/dependencies';
import type { DependencyIndex, KeyEntry, LintFinding, ReqTarget, Site, StateKey } from '../../../../gen/incident/trees-v13/dependencies';
import type { OutcomeBand } from '../../../../sim/types';
import type { Goal } from '../../jobs/protocol';
import { goalFor } from '../../model/why';
import type { Selection } from '../../types';
import type { GlyphName } from '../../viz';

export type KeyKind = 'mark' | 'safe' | 'out' | 'fact' | 'clock' | 'meter' | 'promise' | 'harm' | 'scalar' | 'count' | 'turn' | 'situation';
export const KIND_INFO: Record<KeyKind, { label: string; glyph: GlyphName; help: string }> = {
  mark: { label: 'Marks', glyph: 'key', help: 'Flags choices set, which prompts, choices and lines read later' },
  safe: { label: 'Out safe', glyph: 'officer', help: 'People brought out safe' },
  out: { label: 'Out of the building', glyph: 'ending', help: 'People who left the building, safe or not' },
  fact: { label: 'What the team knows', glyph: 'reads', help: 'Claims the team has heard or settled' },
  clock: { label: 'Clocks', glyph: 'clock', help: 'Time running out for someone or something' },
  meter: { label: 'Subject meters', glyph: 'meter', help: 'Agitation and rapport' },
  promise: { label: 'Promises', glyph: 'note', help: 'Promises the team made' },
  harm: { label: 'Harm', glyph: 'hurt', help: 'Who gets hurt' },
  scalar: { label: 'Score', glyph: 'field', help: 'Objective, civilian safety and pressure' },
  count: { label: 'Group sizes', glyph: 'group', help: 'How many people each call draws' },
  turn: { label: 'Turns', glyph: 'turn', help: 'Which node a turn group draws' },
  situation: { label: 'Situation', glyph: 'situation', help: 'The hidden truth drawn per call' },
};
export const KIND_ORDER = Object.keys(KIND_INFO) as KeyKind[];
export const kindOf = (key: string): KeyKind => key.split(':')[0] as KeyKind;

/** Plain names for the lint codes (spec 6.3). */
export const LINT_LABEL: Record<LintFinding['code'], string> = {
  read_never_written: 'Read but never set',
  dead_write: 'Set but never read',
  threat_only: 'Read only by command approval',
  drawn_only: 'Set only by a drawn result',
  clock_writer: 'Also set by a clock',
  unreachable_node: 'Node can’t be reached',
  unreachable_ending: 'Ending can’t be reached',
  never_offered: 'Choice never offered',
  never_matched: 'Line never applies',
  not_in_this_draw: 'Not in this draw',
  never_reached: 'Never reached in runs',
  locked_for_squad: 'Locked for this squad',
  flat_odds: 'Flat odds',
  stuck_runs: 'Runs that stall',
  name_matcher: 'Name colors disagree',
};
/** What each code means for the call, in one plain sentence. */
export const LINT_MEANING: Record<LintFinding['code'], string> = {
  read_never_written: 'The compiler silently drops everything that needs it.',
  dead_write: 'Nothing changes because of it. Read it somewhere or stop setting it.',
  threat_only: 'No prompt or choice reads it; it only lets command approve force. Fine when that is the point.',
  drawn_only: 'Only the dice set it, so no choice guarantees it. Play can’t force that result.',
  clock_writer: 'Time can set it too, without any choice. Expected for a clock that runs out.',
  unreachable_node: 'No route reaches this node under any turn or group size.',
  unreachable_ending: 'No route reaches this ending under any turn or group size.',
  never_offered: 'Its condition can never hold, so no call ever offers it.',
  never_matched: 'Its condition can never hold, so the line never shows.',
  not_in_this_draw: 'This call’s draw leaves it out.',
  never_reached: 'Reachable, but no run in the tally got there.',
  locked_for_squad: 'Offered, but this squad never meets its requirement.',
  flat_odds: 'The choices here are too close to tell apart by odds.',
  stuck_runs: 'Some runs stopped without an ending.',
  name_matcher: 'The game would color a name differently from who the line means.',
};
export const SEVERITY_ORDER: Record<LintFinding['severity'], number> = { error: 0, warn: 1, info: 2 };

export interface KeyGroup { kind: KeyKind; label: string; glyph: GlyphName; keys: KeyEntry[] }

/** Keys grouped by kind in the index's order, filtered by label or raw key (case and accents folded). */
export function groupKeys(index: DependencyIndex, filter = ''): KeyGroup[] {
  const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const want = fold(filter.trim());
  const groups = new Map<KeyKind, KeyEntry[]>();
  for (const entry of index.keys.values()) {
    if (want && !fold(`${entry.label} ${entry.key}`).includes(want)) continue;
    const kind = kindOf(entry.key);
    groups.set(kind, [...groups.get(kind) ?? [], entry]);
  }
  return KIND_ORDER.filter(kind => groups.has(kind)).map(kind => ({ kind, ...KIND_INFO[kind], keys: groups.get(kind)! }));
}

/** Readers a reader can act on (the engine's own reads are listed apart). */
export const treeReaders = (entry: KeyEntry) => entry.readers.filter(site => site.field !== 'engine');
export const engineReaders = (entry: KeyEntry) => entry.readers.filter(site => site.field === 'engine');

const BAND_WORDS: Record<OutcomeBand, string> = { favorable: 'goes well', mixed: 'complications', adverse: 'goes badly' };

/** A site in words: where it is (a crumb), what it does with the key, and the condition it holds
 * under. `bind` names choices and nodes (bound titles); `clockLabel` names clocks. */
export interface SiteWords { id: string; where: string; does: string; note: string | null; band?: OutcomeBand; drawn: boolean; negated: boolean; playable: boolean }

export function siteWords(site: Site, _tree: CallTree, side: 'writers' | 'readers', names: { choice(node: string, choice: string): string; node(node: string): string; clock(id: string): string;
  cond?(text: string): string }): SiteWords {
  const parts: string[] = [];
  if (site.node) parts.push(names.node(site.node));
  if (site.node && site.choice) parts.push(names.choice(site.node, site.choice));
  let where = parts.join(' › ');
  if (site.band) where += ` · ${BAND_WORDS[site.band]}`;
  if (site.outcome !== undefined && site.band) where += `, line ${site.outcome + 1}`;
  if (site.clock && !site.node) where = `${names.clock(site.clock)}${site.situation !== undefined ? ` · situation ${site.situation + 1}` : ''}`;
  if (!where) where = site.field === 'draw' ? 'The call’s draw' : site.field === 'engine' ? 'The engine' : site.field === 'threatMarks' || site.field === 'fact.threat' ? 'Command approval' : site.field === 'fact.public' ? 'The call card' : site.field === 'carries.knownFrom' ? 'The map' : 'The call';
  const when = site.negated ? 'while it is not set' : 'when it is set';
  const cond = site.conditional ? (names.cond ? names.cond(site.conditional) : site.conditional) : null;
  const at = cond?.replace(/^at /, '');
  const DOES: Partial<Record<Site['field'], string>> = side === 'writers' ? {
    'outcome.mark': 'sets it', 'fire.mark': 'sets it when an officer is hit', 'clock.cue.mark': `sets it when the clock falls to ${at}`, 'clock.onOut.mark': 'sets it when the clock runs out',
    'outcome.safe': 'brings them out safe', 'outcome.out': 'brings them out', 'force.out': 'force brings them out (drawn)', 'cascade.out': 'followers come out (drawn)',
    'outcome.reveal': 'settles it', 'clock.cue.reveal': `settles it when the clock falls to ${at}`, 'fact.public': 'on the card from the start', 'outcome.moves': 'moves their meters',
    'outcome.promise': 'makes the promise', 'authority.concede': 'command concession', 'outcome.harm': 'harms them', 'outcome.officer': 'an officer is hurt',
    'fire.harm': 'an officer may be hit (drawn)', 'force.harm': 'force may hurt them (drawn)', 'clock.onOut.harm': 'harms them when the clock runs out',
    'outcome.objective': 'moves the objective', 'outcome.civilian': 'moves civilian safety', 'outcome.pressure': 'adds pressure', 'choice.minutes': `spends time (${cond ?? 'minutes'})`, draw: 'drawn per call',
  } : {
    'promptIf.when': `shows prompt variant ${(site.promptIf ?? 0) + 1} ${when}`, onlyIf: `offers the choice only ${when}`, 'outcome.when': `uses this line only ${when}`,
    'outcome.if': `routes on it (${cond})`, modifier: `changes the odds (${cond})`, threatMarks: 'lets command approve force', 'carries.knownFrom': 'shows a carried item on the map',
    'fact.threat': 'lets command approve force once believed', 'clock.urgent': 'makes the clock urgent', 'clock.onOut.mark': 'runs out at zero', 'clock.onOut.harm': 'runs out at zero',
    'next.turn': 'routes to the drawn turn', engine: cond ?? 'read by the engine',
  };
  const does = DOES[site.field] ?? site.field;
  const shownCond = side === 'writers' && cond && !['choice.minutes', 'clock.cue.mark', 'clock.cue.reveal', 'authority.concede'].includes(site.field) ? `if ${cond}` : null;
  return { id: siteKey(site), where, does, note: shownCond, ...site.band ? { band: site.band } : {}, drawn: !!site.drawn, negated: !!site.negated, playable: !!site.node };
}

/** Where Play here goes for a site: to the state where it can happen (the choice offered, the
 * prompt variant shown, the line applying), as an explore goal. Null for sites with no node
 * (clocks, the draw, the engine). */
export function siteGoal(site: Site, tree: CallTree): Goal | null {
  if (!site.node) return null;
  let target: ReqTarget;
  if (site.promptIf !== undefined) target = { prompt: [site.node, site.promptIf] };
  else if (site.choice && site.band && site.outcome !== undefined) target = { outcome: [site.node, site.choice, site.band, site.outcome] };
  else if (site.choice) return { offered: choiceActionId(tree.type, site.node, site.choice) };
  else return { node: site.node };
  try { return goalFor(tree, requirementTree(tree, target), target); } catch { return { node: site.node }; }
}

// ---------------------------------------------------------------- Why targets

export interface WhyOption { value: string; label: string; group: string; target: ReqTarget }

/** The URL selection for a Why target, so a target can be linked and noted. Prompt variants and
 * lines are string rows (`string:talking.promptIf[1]`, `string:offer.go_in.adverse[0]`). */
export function targetSelection(target: ReqTarget): Selection {
  if ('choice' in target) return { kind: 'choice', node: target.choice[0], choice: target.choice[1] };
  if ('ending' in target) return { kind: 'ending', ending: target.ending };
  if ('node' in target) return { kind: 'node', node: target.node };
  if ('prompt' in target) return { kind: 'string', row: `${target.prompt[0]}.promptIf[${target.prompt[1]}]` };
  const [node, choice, band, index] = target.outcome;
  return { kind: 'string', row: `${node}.${choice}.${band}[${index}]` };
}

/** The Why target a selection names, when it names one. */
export function selectionTarget(sel: Selection | null, tree: CallTree): ReqTarget | null {
  if (!sel) return null;
  const has = (node: string, choice?: string) => tree.nodes.some(entry => entry.id === node && (!choice || entry.choices.some(c => c.id === choice)));
  switch (sel.kind) {
    case 'choice': case 'band': return has(sel.node, sel.choice) ? { choice: [sel.node, sel.choice] } : null;
    case 'ending': return tree.endings[sel.ending] ? { ending: sel.ending } : null;
    case 'node': return has(sel.node) ? { node: sel.node } : null;
    case 'string': {
      const where = sel.row.replace(/@s\d$/, '');
      const prompt = /^([a-z0-9_]+)\.promptIf\[(\d+)\]$/.exec(where);
      if (prompt && has(prompt[1])) return { prompt: [prompt[1], Number(prompt[2])] };
      const line = /^([a-z0-9_]+)\.([a-z0-9_]+)\.(favorable|mixed|adverse)\[(\d+)\]$/.exec(where);
      if (line && has(line[1], line[2])) return { outcome: [line[1], line[2], line[3] as OutcomeBand, Number(line[4])] };
      const choice = /^([a-z0-9_]+)\.([a-z0-9_]+)\.(title|summary|preview\.[a-z]+)$/.exec(where);
      if (choice && has(choice[1], choice[2])) return { choice: [choice[1], choice[2]] };
      const ending = /^ending\.([a-z0-9_]+)\./.exec(where);
      if (ending && tree.endings[ending[1]]) return { ending: ending[1] };
      return null;
    }
    default: return null;
  }
}

export const targetValue = (target: ReqTarget): string => JSON.stringify(target);

/** Everything the Why tracer can explain, grouped: choices by node, prompt variants, result lines
 * that hang on a condition, and endings. */
export function whyOptions(tree: CallTree, names: { choice(node: string, choice: string): string; node(node: string): string; ending(id: string): string }): WhyOption[] {
  const out: WhyOption[] = [];
  for (const node of tree.nodes) {
    const group = names.node(node.id);
    for (const choice of node.choices) {
      const target: ReqTarget = { choice: [node.id, choice.id] };
      out.push({ value: targetValue(target), label: names.choice(node.id, choice.id), group, target });
    }
    (node.promptIf ?? []).forEach((_, i) => {
      const target: ReqTarget = { prompt: [node.id, i] };
      out.push({ value: targetValue(target), label: `Prompt variant ${i + 1}`, group, target });
    });
    for (const choice of node.choices) for (const band of ['favorable', 'mixed', 'adverse'] as const) choice.outcomes[band].forEach((outcome, i) => {
      if (!outcome.when && !outcome.if) return;
      const target: ReqTarget = { outcome: [node.id, choice.id, band, i] };
      out.push({ value: targetValue(target), label: `${names.choice(node.id, choice.id)} · ${BAND_WORDS[band]}, line ${i + 1}`, group, target });
    });
  }
  for (const id of Object.keys(tree.endings)) {
    const target: ReqTarget = { ending: id };
    out.push({ value: targetValue(target), label: names.ending(id), group: 'Endings', target });
  }
  return out;
}

/** Plain names for a tree without a drawn cast (role nouns for tokens): the fallback when a bound
 * title can't be read. */
export function plainNames(tree: CallTree) {
  return {
    node: (id: string) => sentenceCase(id),
    choice: (node: string, choice: string) => {
      const found = tree.nodes.find(entry => entry.id === node)?.choices.find(entry => entry.id === choice);
      return found ? plainTokens(found.title, tree) : sentenceCase(choice);
    },
    ending: (id: string) => tree.endings[id] ? plainTokens(tree.endings[id].title, tree) : sentenceCase(id),
  };
}

/** Lint findings sorted by severity, then code, then id, with the ones muted by an accepted note set apart. */
export function sortFindings(findings: readonly LintFinding[], muted: ReadonlySet<string>): { open: LintFinding[]; muted: LintFinding[] } {
  const order = [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.code.localeCompare(b.code) || a.id.localeCompare(b.id));
  return { open: order.filter(f => !muted.has(f.id)), muted: order.filter(f => muted.has(f.id)) };
}

/** The keys a finding is about, so a lint row can select its key. */
export const findingKey = (f: LintFinding): StateKey | null => f.key ?? null;

/** A lint message with its raw ids read as names: choices by their bound title, clocks and endings
 * by their labels, marks by their key labels. The code and the ids stay one hover away. */
export function humanizeFinding(f: LintFinding, names: { node(id: string): string; choice(node: string, choice: string): string; ending(id: string): string; clock(id: string): string },
  deps: DependencyIndex | null): string {
  let text = f.message;
  const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const site of f.sites) {
    if (site.node && site.choice) text = text.replace(`${sentenceCase(site.node)} › ${site.choice}`, `${names.node(site.node)} › ${names.choice(site.node, site.choice)}`);
    if (site.node && site.choice && site.band) text = text.replace(` · ${site.band} line`, ` · ${BAND_WORDS[site.band]}, line`);
    if (site.clock) text = text.replace(new RegExp(`\\b${escape(site.clock)}\\b`, 'g'), lower(names.clock(site.clock)));
  }
  if (f.ending) text = text.replace(`The ending ${f.ending}`, `The ending “${names.ending(f.ending)}”`);
  for (const entry of deps?.keys.values() ?? []) {
    if (!entry.key.startsWith('mark:')) continue;
    const id = entry.key.slice(5);
    text = text.replace(new RegExp(`(^|[\\s:(])${escape(id)}(?= can never be set)`, 'g'), (_m, lead: string) => `${lead}${lower(entry.label)}`);
  }
  return text;
}

/** A site's condition text (dependencies.ts writes ids: `lets_go = true and owner_condition out`)
 * in the call's own words: facts by their label, clocks by their label, roles by their noun, marks by
 * their key label. Odds, cue points and minutes stay as numbers. */
export function humanizeCondition(text: string, tree: CallTree, deps: DependencyIndex | null, bind: (text: string) => string = t => t,
  clockLabel: (id: string) => string = id => id.replace(/_/g, ' ')): string {
  const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
  const role = (id: string) => tree.roles.some(entry => entry.id === id) || tree.groups?.[id] ? `the ${roleNoun(tree, id)}` : id.replace(/_/g, ' ');
  const markLabel = (id: string) => lower(deps?.keys.get(`mark:${id}` as StateKey)?.label ?? id.replace(/_/g, ' '));
  const clocks = new Set([...deps?.keys.keys() ?? []].filter(key => key.startsWith('clock:')).map(key => key.slice(6)));
  return text.split(' and ').map(part => {
    let m = /^([a-z0-9_]+) = (true|false)$/.exec(part);
    if (m && tree.facts[m[1]]) return `${bind(tree.facts[m[1]].label)}: ${m[2]}`;
    m = /^([a-z0-9_]+) (not low|low|not out|out)$/.exec(part);
    if (m && clocks.has(m[1])) return `${lower(clockLabel(m[1]))} ${m[2] === 'out' ? 'has run out' : m[2] === 'not out' ? 'has not run out' : m[2] === 'low' ? 'is low' : 'is not low'}`;
    m = /^(no )?mark ([a-z0-9_]+)$/.exec(part);
    if (m) return m[1] ? `not: ${markLabel(m[2])}` : markLabel(m[2]);
    m = /^([a-z0-9_]+) (not safe|safe)$/.exec(part);
    if (m) return `${role(m[1])} ${m[2] === 'safe' ? 'out safe' : 'not yet out safe'}`;
    m = /^([a-z0-9_]+) carries (.+)$/.exec(part);
    if (m) return `${role(m[1])} carries ${lower(m[2])}`;
    m = /^([a-z0-9_]+) (not )?((?:calm|tense|volatile|breaking|yielding)(?: or (?:calm|tense|volatile|breaking|yielding))*)(.*)$/.exec(part);
    if (m && tree.roles.some(entry => entry.id === m![1])) return `${role(m[1])} is ${m[2] ?? ''}${m[3]}${m[4]}`;
    return part;
  }).join(' and ');
}
