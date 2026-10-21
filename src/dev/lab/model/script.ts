// Script (spec 3.6): every player-visible string of a call, bound for one variant of its draw
// (pronouns, group sizes, situation, turn and a cast), in the order the player meets them; what
// changed between two variants, word by word; and the people-name audit, which holds the game's
// matcher (ui/people/lexicon.ts segmentPeople) against the binder's own role segments
// (compile.ts bindRoleSegments). Binding goes through the compiler's binder and the string rows
// through strings.ts callStringRows, the same rows the CLI string checks read. Pure.
import { CIVILIAN_FIRST_NAMES, CIVILIAN_SURNAMES } from '../../../content/call-trees/civilian-names';
import type { CallTree, TreeNext } from '../../../content/call-trees/types';
import type { IncidentTemplate } from '../../../content/incidents/types';
import { armedKey, bindRoleSegments, memberId, reachableWithin, treeForCounts } from '../../../gen/incident/trees-v13/compile';
import type { BoundPart, CastIdentity } from '../../../gen/incident/trees-v13/compile';
import { countCombos, sentenceCase } from '../../../gen/incident/trees-v13/dependencies';
import { callStringRows, longestNamesCast } from '../../../gen/incident/trees-v13/strings';
import type { StringRow } from '../../../gen/incident/trees-v13/strings';
import { buildLexicon, segmentPeople } from '../../../ui/people/lexicon';
import type { Lexicon } from '../../../ui/people/lexicon';
import type { StageId } from '../../../sim/types';
import type { CastSample } from '../jobs/protocol';
import { treeSituationClockNexts } from './clocks';
import { changedWords, stringRowKey } from './snapshots';

export interface Variant { pronouns: 'drawn' | 'he' | 'she' | 'they'; counts: Record<string, number>; situation: 0 | 1 | 2; turns: Record<string, string>; cast: number /* -1 longest names */ }
/** One string as the player reads it in this variant. `key` is snapshots.ts stringRowKey (baselines,
 * `sel=string:` anchors and palette rows use the same key). `row` keeps the authored text (tokens
 * unbound); `text` is the bound text and `parts` the binder's pieces, names tagged with the role that
 * produced them. `error` is set when the line can't bind in this variant (an authoring error). */
export interface ScriptRow { key: string; row: StringRow; text: string; parts: BoundPart[]; error?: string }
export interface AuditHit { key: string; text: string; span: [number, number]; expected?: string; got?: string }

export const PRONOUN_SETS: readonly Variant['pronouns'][] = ['drawn', 'he', 'she', 'they'];
const STAGE_ORDER: readonly StageId[] = ['assess', 'adapt', 'resolve'];

// ---------------------------------------------------------------- the variant space

/** Each group's sizes, smallest first, from the template's cast slot (as the compiler draws them). */
export function groupSizes(template: IncidentTemplate): Record<string, number[]> {
  const out: Record<string, Set<number>> = {};
  for (const combo of countCombos(template)) for (const [group, n] of Object.entries(combo)) (out[group] ??= new Set()).add(n);
  return Object.fromEntries(Object.entries(out).map(([group, sizes]) => [group, [...sizes].sort((a, b) => a - b)]));
}

/** Every combination a sweep steps through: pronoun sets × group sizes × situations × turn members,
 * turns outermost and pronouns innermost (the axis that changes the fewest lines steps fastest).
 * `cast` is the cast every combination binds with (the carousel's position): names stay put while
 * a sweep runs, so "changed in this variant" shows only what the draw changed. */
export function variantSpace(tree: CallTree, template: IncidentTemplate, casts: number): Variant[] {
  let turns: Record<string, string>[] = [{}];
  for (const [group, members] of Object.entries(tree.turns ?? {})) turns = turns.flatMap(t => members.map(member => ({ ...t, [group]: member })));
  const counts = countCombos(template);
  const out: Variant[] = [];
  for (const t of turns) for (const situation of template.tree.situations.map((_, i) => i as 0 | 1 | 2)) for (const c of counts) for (const pronouns of PRONOUN_SETS)
    out.push({ pronouns, counts: { ...c }, situation, turns: { ...t }, cast: casts });
  return out;
}

const sorted = (record: Record<string, string | number>) => Object.keys(record).sort().map(key => `${key}=${record[key]}`).join(',');
const isArmedKey = (key: string) => key.endsWith(':armed');
/** A variant's identity without its cast: what the "variants read" counter counts and where "Next
 * variant" steps from. The armed counts the call's own variant carries aren't an axis the sweep
 * steps, so they're left out and the call's variant matches its sweep entry. */
export function variantKey(v: Variant): string {
  const sizes = Object.fromEntries(Object.entries(v.counts).filter(([key]) => !isArmedKey(key)));
  return `${v.pronouns}|${sorted(sizes)}|s${v.situation + 1}|${sorted(v.turns)}`;
}

/** The variant's identity for what its rows read, armed counts included: two variants with the same
 * key show the same lines (string-check results are kept per this key). */
export function variantRowsKey(v: Variant): string {
  const armed = Object.fromEntries(Object.entries(v.counts).filter(([key]) => isArmedKey(key)));
  return `${variantKey(v)}|${sorted(armed)}`;
}

// ---------------------------------------------------------------- casts

/** The longest-names cast (strings.ts, the one `npm run check:strings` binds) as a cast sample. */
export function longestSample(template: IncidentTemplate): CastSample {
  const { cast, groups, rooms, place } = longestNamesCast(template);
  return { call: -1, cast, groups, place, rooms };
}

/** A small deterministic hash for picking stand-in names. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export interface BoundCast { cast: Record<string, CastIdentity>; groups: Record<string, string[]>; rooms: Record<string, string>; place: string; counts: Record<string, number>;
  /** Members this variant needed that the sampled call didn't have: named here, never by the game. */
  standIns: string[] }

/** A cast sample made to fit a variant: each group cut or grown to the variant's size (grown
 * members get distinct stand-in names from the civilian pools, never one the call already uses), and
 * everyone's pronouns set when the variant names a pronoun set. Names otherwise stay the sample's. */
export function castFor(tree: CallTree, sample: CastSample, v: Pick<Variant, 'pronouns' | 'counts'>): BoundCast {
  const cast: Record<string, CastIdentity> = {};
  const rooms = { ...sample.rooms };
  const groups: Record<string, string[]> = {};
  const counts: Record<string, number> = {};
  const standIns: string[] = [];
  const memberIds = new Set(Object.values(sample.groups).flat());
  for (const [id, who] of Object.entries(sample.cast)) if (!memberIds.has(id)) cast[id] = { ...who };
  const usedFirst = new Set(Object.values(sample.cast).map(who => who.firstName)), usedSurname = new Set(Object.values(sample.cast).map(who => who.surname));
  for (const [group, def] of Object.entries(tree.groups ?? {})) {
    const have = [...(sample.groups[group] ?? [])];
    const n = Math.max(0, v.counts[group] ?? have.length);
    const ids = Array.from({ length: n }, (_, i) => memberId(group, i + 1));
    const home = rooms[group] ?? rooms[def.leader] ?? rooms.scene ?? 'room';
    rooms[group] ??= home;
    for (const id of ids) {
      if (sample.cast[id]) { cast[id] = { ...sample.cast[id] }; continue; }
      const pronouns = v.pronouns === 'drawn' ? 'they' : v.pronouns;
      const pick = (pool: readonly string[], used: Set<string>, salt: string) => {
        for (let i = 0, at = hash(`${sample.call}:${id}:${salt}`); i < pool.length; i++) {
          const name = pool[(at + i) % pool.length];
          if (!used.has(name)) { used.add(name); return name; }
        }
        return pool[0];
      };
      cast[id] = { firstName: pick(CIVILIAN_FIRST_NAMES[pronouns], usedFirst, 'first'), surname: pick(CIVILIAN_SURNAMES, usedSurname, 'surname'), pronouns };
      rooms[id] ??= home;
      standIns.push(id);
    }
    groups[group] = ids;
    counts[group] = n;
  }
  if (v.pronouns !== 'drawn') for (const who of Object.values(cast)) who.pronouns = v.pronouns;
  return { cast, groups, rooms, place: sample.place, counts, standIns };
}

/** Public kind per person, as the compiler writes the story bindings (bystanders are people at the
 * scene, members take their leader's kind; someone offsite has no binding, so no kind). */
function publicKinds(tree: CallTree, bound: BoundCast): Record<string, string | undefined> {
  const kinds: Record<string, string | undefined> = {};
  for (const role of tree.roles) if (role.place !== 'offsite') kinds[role.id] = role.kind === 'bystander' ? 'person' : role.kind;
  for (const [group, ids] of Object.entries(bound.groups)) {
    const leader = tree.roles.find(role => role.id === tree.groups?.[group]?.leader);
    for (const id of ids) kinds[id] = leader ? (leader.kind === 'bystander' ? 'person' : leader.kind) : undefined;
  }
  return kinds;
}

/** The people lexicon the game would build for this cast: everyone on site located (v13 starts
 * every on-site role reported or confirmed), group members named but their kind withheld, the
 * place and room names masked. Call text never names an officer, so no officers. */
export function lexiconForCast(tree: CallTree, bound: BoundCast): Lexicon {
  const publicKind = publicKinds(tree, bound);
  const located = new Set(Object.keys(publicKind).filter(id => publicKind[id]));
  const withheld = new Set(Object.values(bound.groups).flat());
  const places = [bound.place, ...Object.values(bound.rooms)];
  return buildLexicon({ cast: bound.cast, publicKind, withheld, located, officers: [], places });
}

/** The `--cast` words the string checker treats as names: each person's first name and surname,
 * and the place's own words. */
export function castWords(bound: BoundCast): string[] {
  const words = new Set<string>();
  for (const who of Object.values(bound.cast)) { words.add(who.firstName); words.add(who.surname); }
  for (const word of bound.place.split(/\s+/)) if (/^[A-Z]/.test(word) && word !== 'The') words.add(word);
  return [...words].filter(Boolean);
}

// ---------------------------------------------------------------- rows

/** Nodes and endings a call with these group sizes and these turns can reach (every member of a
 * turn group the variant doesn't name), from the root and from where a clock that runs out sends it
 * (`clockNexts`). */
export function turnReach(tree: CallTree, counts: Record<string, number>, turns: Record<string, string>, clockNexts: readonly TreeNext[] = []): { nodes: Set<string>; endings: Set<string> } {
  const fixed: CallTree = { ...tree, ...tree.turns ? { turns: Object.fromEntries(Object.entries(tree.turns).map(([group, members]) => [group, turns[group] && members.includes(turns[group]) ? [turns[group]] : members])) } : {} };
  const hasGroups = Object.keys(tree.groups ?? {}).length > 0;
  return reachableWithin(hasGroups ? treeForCounts(fixed, counts) : fixed, counts, clockNexts);
}

/** The counts a variant's conditions read: each group's size, and, where the variant carries it (the
 * call's own draw, callCounts), how many of its members are armed, never more than the size the
 * variant shows. A sweep variant carries no armed count, so armed lines show, as in check:strings. */
export function variantCounts(tree: CallTree, v: Pick<Variant, 'counts'>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const group of Object.keys(tree.groups ?? {})) {
    const n = counts[group] = v.counts[group] ?? 0;
    const armed = v.counts[armedKey(group)];
    if (armed !== undefined) counts[armedKey(group)] = Math.min(armed, n);
  }
  return counts;
}

/** The authored rows a variant shows: count and armed conditions settled, this situation's lines
 * only, and nothing from a turn this variant didn't draw; what this situation's clocks reach when
 * they run out counts as reached (`clockNexts`, by default the registered template's). Text unbound. */
export function variantRows(tree: CallTree, v: Pick<Variant, 'counts' | 'situation' | 'turns'>, clockNexts: readonly TreeNext[] = treeSituationClockNexts(tree, v.situation)): StringRow[] {
  const hasGroups = Object.keys(tree.groups ?? {}).length > 0;
  const counts = variantCounts(tree, v);
  const all = callStringRows(tree, text => text, hasGroups ? counts : undefined, clockNexts);
  const reach = turnReach(tree, counts, v.turns, clockNexts);
  const tag = `s${v.situation + 1}`;
  return all.filter(row => {
    if (row.situation !== 'all' && row.situation !== tag) return false;
    if (row.path) return reach.nodes.has(row.path);
    const ending = /^ending\.([^.]+)\./.exec(row.where);
    return ending ? reach.endings.has(ending[1]) : true;
  });
}

/** Rows bound with one cast. */
export function bindRows(rows: readonly StringRow[], bound: BoundCast): ScriptRow[] {
  return rows.map(row => {
    try {
      const parts = bindRoleSegments(row.text, bound.cast, bound.place, bound.rooms, bound.groups);
      return { key: stringRowKey(row), row, text: parts.map(part => part.text).join(''), parts };
    } catch (error) {
      return { key: stringRowKey(row), row, text: row.text, parts: [{ text: row.text }], error: error instanceof Error ? error.message : String(error) };
    }
  });
}

/** The sample a variant binds with: cast `-1` is the longest names, else that cast (the first when
 * out of range). */
export function sampleFor(v: Pick<Variant, 'cast'>, casts: readonly CastSample[], longest: CastSample): CastSample {
  return v.cast < 0 ? longest : casts[v.cast] ?? casts[0] ?? longest;
}

/** Every string the player can read in this variant, bound, in player order. */
export function rowsFor(tree: CallTree, v: Variant, casts: readonly CastSample[], longest: CastSample): ScriptRow[] {
  const bound = castFor(tree, sampleFor(v, casts, longest), v);
  return bindRows(variantRows(tree, v), bound);
}

/** What changed from one variant to the next, keyed by the next variant's row key: the changed
 * word ranges of rows whose text differs, and the whole text of rows that weren't there before.
 * Rows are matched by where they sit in the tree, so a line read in another situation is the same
 * line. Rows that are gone have nowhere to be highlighted: see goneRows. */
export function changedRows(prev: readonly ScriptRow[], next: readonly ScriptRow[]): Map<string, [start: number, end: number][]> {
  const before = new Map(prev.map(row => [row.row.where, row.text]));
  const out = new Map<string, [number, number][]>();
  for (const row of next) {
    const was = before.get(row.row.where);
    if (was === row.text) continue;
    out.set(row.key, was === undefined ? (row.text ? [[0, row.text.length]] : []) : changedWords(was, row.text));
  }
  return out;
}

/** Rows the previous variant showed that this one doesn't. */
export function goneRows(prev: readonly ScriptRow[], next: readonly ScriptRow[]): ScriptRow[] {
  const now = new Set(next.map(row => row.row.where));
  return prev.filter(row => !now.has(row.row.where));
}

// ---------------------------------------------------------------- the audit

/** Holds the game's matcher to the binder: a name the binder wrote for a person the lexicon colors
 * must be colored as that person (else a miss), and nothing else may be colored (else a false
 * match). Names nobody can be colored for (a shared surname, someone offsite) are neither. */
export function matcherAudit(rows: readonly ScriptRow[], lexiconFor: (row: ScriptRow) => Lexicon): { missed: AuditHit[]; falseMatches: AuditHit[] } {
  const missed: AuditHit[] = [], falseMatches: AuditHit[] = [];
  for (const row of rows) {
    if (row.error) continue;
    const lex = lexiconFor(row);
    const expected: { start: number; end: number; id: string }[] = [];
    let at = 0;
    for (const part of row.parts) {
      if (part.role) expected.push({ start: at, end: at + part.text.length, id: part.role });
      at += part.text.length;
    }
    const got: { start: number; end: number; id: string }[] = [];
    at = 0;
    for (const part of segmentPeople(row.text, lex)) {
      if (part.person) got.push({ start: at, end: at + part.text.length, id: part.person.id });
      at += part.text.length;
    }
    for (const span of got) if (!expected.some(e => e.start === span.start && e.end === span.end && e.id === span.id)) {
      const owner = expected.find(e => e.start <= span.start && e.end >= span.end);
      falseMatches.push({ key: row.key, text: row.text.slice(span.start, span.end), span: [span.start, span.end], expected: owner?.id, got: span.id });
    }
    for (const span of expected) {
      const form = row.text.slice(span.start, span.end);
      const colorable = lex.entries.some(entry => entry.id === span.id && entry.forms.includes(form));
      if (!colorable) continue;
      if (!got.some(g => g.start === span.start && g.end === span.end && g.id === span.id)) {
        const other = got.find(g => g.start < span.end && g.end > span.start);
        missed.push({ key: row.key, text: form, span: [span.start, span.end], expected: span.id, got: other?.id });
      }
    }
  }
  return { missed, falseMatches };
}

// ---------------------------------------------------------------- player order

export interface ScriptChoice { choice: string; title: ScriptRow | null; summary: ScriptRow | null; modifiers: ScriptRow[];
  bands: { band: 'favorable' | 'mixed' | 'adverse'; preview: ScriptRow | null; outcomes: ScriptRow[] }[] }
export interface ScriptSection { id: string; kind: 'card' | 'node' | 'endings' | 'facts'; title: string; stage?: StageId; rows: ScriptRow[];
  prompts: ScriptRow[]; choices: ScriptChoice[] }

/** Nodes in the order a player meets them: by stage, then by distance from the root, then as written. */
export function playerOrder(tree: CallTree): string[] {
  const depth = new Map<string, number>([[tree.root, 0]]);
  const byId = new Map(tree.nodes.map(node => [node.id, node]));
  for (const queue = [tree.root]; queue.length;) {
    const id = queue.shift()!;
    for (const choice of byId.get(id)?.choices ?? []) for (const band of ['favorable', 'mixed', 'adverse'] as const) for (const outcome of choice.outcomes[band]) {
      const nexts = outcome.next ? [outcome.next] : outcome.force ? Object.values(outcome.force.next) : outcome.cascade ? Object.values(outcome.cascade.next) : [];
      for (const next of nexts) for (const to of !next ? [] : 'node' in next ? [next.node] : 'turn' in next ? tree.turns?.[next.turn] ?? [] : [])
        if (!depth.has(to)) { depth.set(to, depth.get(id)! + 1); queue.push(to); }
    }
  }
  const written = new Map(tree.nodes.map((node, i) => [node.id, i]));
  return [...tree.nodes].sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage)
    || (depth.get(a.id) ?? 99) - (depth.get(b.id) ?? 99) || written.get(a.id)! - written.get(b.id)!).map(node => node.id);
}

/** The rows grouped as the player meets them: the card and briefing, each node (its prompt and
 * prompt variants, then each choice with its summary and, per band, the preview and the result
 * lines), the endings, then fact lines and clock cues. `nodeTitle` names a node. */
export function scriptSections(tree: CallTree, rows: readonly ScriptRow[], nodeTitle: (id: string) => string = sentenceCase): ScriptSection[] {
  const section = (id: string, kind: ScriptSection['kind'], title: string, stage?: StageId): ScriptSection => ({ id, kind, title, ...stage ? { stage } : {}, rows: [], prompts: [], choices: [] });
  const card = section('card', 'card', 'Card and briefing'), endings = section('endings', 'endings', 'Endings'), facts = section('facts', 'facts', 'Facts and clocks');
  const nodes = new Map(playerOrder(tree).map(id => [id, section(id, 'node', nodeTitle(id), tree.nodes.find(node => node.id === id)?.stage)]));
  for (const row of rows) {
    const where = row.row.where;
    const node = row.row.path ? nodes.get(row.row.path) : undefined;
    if (node) {
      node.rows.push(row);
      if (where === `${node.id}.prompt` || where.startsWith(`${node.id}.promptIf[`) || where.startsWith(`${node.id}.exchange[`)) { node.prompts.push(row); continue; }
      const choiceId = row.row.action ?? where.slice(node.id.length + 1).split('.')[0];
      let choice = node.choices.find(entry => entry.choice === choiceId);
      if (!choice) node.choices.push(choice = { choice: choiceId, title: null, summary: null, modifiers: [],
        bands: (['favorable', 'mixed', 'adverse'] as const).map(band => ({ band, preview: null, outcomes: [] })) });
      const rest = where.slice(`${node.id}.${choiceId}.`.length);
      if (rest === 'title') choice.title = row;
      else if (rest === 'summary') choice.summary = row;
      else if (rest.startsWith('modifier[')) choice.modifiers.push(row);
      else if (rest.startsWith('preview.')) { const band = choice.bands.find(entry => entry.band === rest.slice('preview.'.length)); if (band) band.preview = row; }
      else { const band = choice.bands.find(entry => rest.startsWith(`${entry.band}[`)); band?.outcomes.push(row); }
      continue;
    }
    if (where.startsWith('ending.')) endings.rows.push(row);
    else if (where.startsWith('fact.') || where.startsWith('clock.')) facts.rows.push(row);
    else card.rows.push(row);
  }
  return [card, ...[...nodes.values()].filter(entry => entry.rows.length), endings, facts].filter(entry => entry.rows.length);
}

/** The string checker's result in words: "3 findings on 2 lines", "1 finding on 1 line", "No findings". */
export function checkSummary(findings: number, lines: number): string {
  if (findings === 0) return 'No findings';
  return `${findings} ${findings === 1 ? 'finding' : 'findings'} on ${lines} ${lines === 1 ? 'line' : 'lines'}`;
}
