// Path-level measures for one call (docs/backlog.md `path-measures`, docs/calls/depth-mesh-method.md
// sections 4 and 5): what the structure and the odds do along the paths a player takes, which no
// string checker and no per-node lint can see. These are the pure parts, plain data in and numbers
// out; path-collect.ts plays the engine to produce the data. Each measure also names its flags, the
// zero floors and at-most-two rules the method states; they are reported, never thresholds. The
// numeric targets stay the owner's to set, so nothing here fails a build.
import type { CallTree } from '../../../content/call-trees/types';
import type { OutcomeBand } from '../../../sim/types';
import { compareRoutes } from './dilemma';
import type { DilemmaRow } from './dilemma';
import { FLAT_POINTS } from './call';

export type StepBand = OutcomeBand | 'lapse';

/** One committed decision on a path. `to`: the node reached or `end:<ending>`. `prompt`: what the
 * player read at the node before choosing. `lines`: the result's consequences, spoken lines and
 * the scene beats it already showed, in order. `revealed`: facts whose status this step changed. */
export interface PathStep { node: string; stage: string; choice: string; band: StepBand; to: string; prompt: string; lines: string[];
  revealed: { fact: string; status: string }[] }
/** One call played to its end (or stopped). `source`: the population (`played:best_odds`, `uniform`).
 * `names`: the cast's first names and surnames, masked out of the echo count. */
export interface PathRecord { source: string; scenarioId: string; steps: PathStep[]; ending: string | null; knowledge: Record<string, string>; names: string[] }

const share = (n: number, of: number) => of ? Math.round(1000 * n / of) / 1000 : 0;
const bySource = (paths: readonly PathRecord[]) => {
  const out = new Map<string, PathRecord[]>();
  for (const path of paths) out.set(path.source, [...out.get(path.source) ?? [], path]);
  return out;
};

// ---------------------------------------------------------------- 1. adverse routes to a named node

/** The method's M1 beat count without the mechanism tag the spine will carry: how often a path's
 * adverse results land in the same node. `authored`: adverse outcomes in the tree that route there
 * (the structural count), `choices`: how many different choices can send a path there on a bad result.
 * `perPath`: counts over every path in the source, so the max and the shares are of all paths, not
 * only those that arrive. */
export interface AdverseRoute { source: string; node: string; authored: number; choices: number; paths: number; max: number; mean: number; atLeast2: number; atLeast3: number; flagged: boolean }

/** Adverse outcomes in the tree that route to each node, by authored outcome rows (next.node), and
 * the distinct choices carrying them. Cascades and forces count by every route they list. */
export function authoredAdverseInto(tree: CallTree): Map<string, { outcomes: number; choices: Set<string> }> {
  const into = new Map<string, { outcomes: number; choices: Set<string> }>();
  const note = (node: string, choice: string) => {
    const entry = into.get(node) ?? { outcomes: 0, choices: new Set<string>() };
    entry.outcomes++; entry.choices.add(choice); into.set(node, entry);
  };
  for (const node of tree.nodes) for (const choice of node.choices) for (const outcome of choice.outcomes.adverse) {
    const nexts = [outcome.next, ...outcome.force ? [outcome.force.next.fatal, outcome.force.next.hurt, outcome.force.next.none] : [],
      ...outcome.cascade ? [outcome.cascade.next.all, outcome.cascade.next.some, outcome.cascade.next.none] : []];
    for (const next of nexts) if (next && 'node' in next) note(next.node, `${node.id}/${choice.id}`);
  }
  return into;
}

/** Per source and per node an adverse result lands in. A node is flagged when one path gets sent
 * there more than twice by bad results (method section 4.1: no mechanism more than twice on a
 * path; a node stands in for the mechanism until the spine tags them). */
export function adverseRoutes(paths: readonly PathRecord[], tree: CallTree, limit = 2): AdverseRoute[] {
  const authored = authoredAdverseInto(tree);
  const rows: AdverseRoute[] = [];
  for (const [source, group] of bySource(paths)) {
    const counts = new Map<string, number[]>();
    group.forEach((path, i) => {
      for (const step of path.steps) if (step.band === 'adverse' && !step.to.startsWith('end:')) {
        const list = counts.get(step.to) ?? new Array<number>(group.length).fill(0);
        list[i]++; counts.set(step.to, list);
      }
    });
    for (const [node, list] of counts) {
      const total = list.reduce((a, b) => a + b, 0), max = Math.max(...list);
      rows.push({ source, node, authored: authored.get(node)?.outcomes ?? 0, choices: authored.get(node)?.choices.size ?? 0,
        paths: list.filter(n => n > 0).length, max, mean: Math.round(100 * total / group.length) / 100,
        atLeast2: share(list.filter(n => n >= 2).length, group.length), atLeast3: share(list.filter(n => n >= 3).length, group.length), flagged: max > limit });
    }
  }
  return rows.sort((a, b) => a.source.localeCompare(b.source) || b.max - a.max || b.mean - a.mean || a.node.localeCompare(b.node));
}

/** The same count by what the result says rather than where it goes: adverse steps whose result lines
 * name `pattern` (the teardown's handgun on the manager), per path. A route is data; the sentence
 * is what the player reads, and a rewording of one route can leave it. */
export interface AdverseNamed { source: string; pattern: string; paths: number; max: number; mean: number; atLeast3: number; flagged: boolean }
export function adverseNamed(paths: readonly PathRecord[], pattern: RegExp, limit = 2): AdverseNamed[] {
  return [...bySource(paths)].map(([source, group]) => {
    const per = group.map(path => path.steps.filter(step => step.band === 'adverse' && step.lines.some(line => pattern.test(line))).length);
    const max = Math.max(0, ...per);
    return { source, pattern: pattern.source, paths: per.filter(n => n > 0).length, max, mean: Math.round(100 * per.reduce((a, b) => a + b, 0) / Math.max(1, group.length)) / 100,
      atLeast3: share(per.filter(n => n >= 3).length, group.length), flagged: max > limit };
  });
}

// ---------------------------------------------------------------- 2. fact reach by balance style

/** The share of a source's paths that settled a fact (confirmed or disproved) by their end, and the
 * choices that settle it (`choice/band`, with how many paths each settled it first). A fact no path
 * of a source settles is flagged: the method's floor is above zero for every style, and the target
 * is the owner's. */
export interface FactReach { fact: string; source: string; paths: number; reached: number; share: number; firstBy: Record<string, number>; flagged: boolean }

const SETTLED = new Set(['confirmed', 'disproved']);

export function factReach(paths: readonly PathRecord[], facts: readonly string[]): FactReach[] {
  const rows: FactReach[] = [];
  for (const fact of facts) for (const [source, group] of bySource(paths)) {
    const firstBy: Record<string, number> = {};
    let reached = 0;
    for (const path of group) {
      if (SETTLED.has(path.knowledge[fact] ?? '')) reached++;
      const first = path.steps.find(step => step.revealed.some(entry => entry.fact === fact && SETTLED.has(entry.status)));
      if (first) { const key = `${first.node}/${first.choice}/${first.band}`; firstBy[key] = (firstBy[key] ?? 0) + 1; }
    }
    rows.push({ fact, source, paths: group.length, reached, share: share(reached, group.length), firstBy, flagged: group.length > 0 && reached === 0 });
  }
  return rows;
}

// ---------------------------------------------------------------- 3. dominance at an arrival

/** The dilemma rows of one node at one arrival, trimmed to what the report prints: the engine
 * columns, the visible cost (summary and the bad-result preview, which the dominance grid's payoff
 * column is judged from), and the flags the Lab's rules raise. */
export interface DominanceNode { situation: number; node: string; at: 'first' | 'median'; arrivals: number; rows: DilemmaRow[]; titles: Record<string, string> }
/** Beaten and flat pairs are the structural findings; the payoff column is a human read of the grid. */
export const beatenRows = (node: DominanceNode): DilemmaRow[] => node.rows.filter(row => row.flags.some(flag => flag.kind === 'beaten'));
export const flatRows = (node: DominanceNode): DilemmaRow[] => node.rows.filter(row => row.flags.some(flag => flag.kind === 'flat'));
/** One option the engine's odds put behind another at this arrival: `winner` is no worse on the odds
 * of going well or badly, better by at least the Lab's flat margin (FLAT_POINTS) on one, and its bad
 * result leads no worse. `loserEdges` is everything the loser still has: minutes saved, what it
 * unlocks, a lighter bad result. Empty means the Lab's strict `beaten`; otherwise the payoff grid
 * decides whether those edges are a reason to pick the loser (method section 4.5: a one-point
 * objective edge is not one), which is a read for a person. */
export interface OddsDominance { winner: string; loser: string; wellGap: number; badGap: number; loserEdges: string[] }
export function oddsDominated(node: DominanceNode, gap = FLAT_POINTS): OddsDominance[] {
  const out: OddsDominance[] = [];
  const EPS = 1e-9;
  for (const a of node.rows) for (const b of node.rows) {
    if (a === b || a.favorable < b.favorable - EPS || a.adverse > b.adverse + EPS) continue;
    const wellGap = a.favorable - b.favorable, badGap = b.adverse - a.adverse;
    if (wellGap < gap && badGap < gap) continue;
    const route = compareRoutes(a.adverseTo, b.adverseTo);
    if (route !== null && route < 0) continue;
    const edges: string[] = [];
    if (b.minutes < a.minutes) edges.push(`${a.minutes - b.minutes} min faster`);
    const unlocks = b.writes.filter(key => !a.writes.includes(key));
    if (unlocks.length) edges.push(`unlocks ${unlocks.map(key => key.replace(/^[a-z]+:/, '')).join(', ')}`);
    if (b.adverseHarm.length < a.adverseHarm.length) edges.push('lighter on a bad result');
    out.push({ winner: a.actionId, loser: b.actionId, wellGap: Math.round(100 * wellGap), badGap: Math.round(100 * badGap), loserEdges: edges });
  }
  return out;
}
/** The share of a node's offered options that are at or below `ceiling` favorable: a coin with two
 * tails is every option under 10% (method section 4.6). */
export function twoTails(node: DominanceNode, ceiling = 0.1): boolean {
  const open = node.rows.filter(row => row.favorable > 0 || row.adverse > 0);
  return open.length > 1 && open.every(row => row.favorable < ceiling);
}

// ---------------------------------------------------------------- 4. cross-stage echoes

/** A run of at least four words shared by two strings of one path, read at two steps. */
export interface Echo { run: string; a: { step: number; stage: string; text: string }; b: { step: number; stage: string; text: string }; crossStage: boolean }
export interface EchoSummary { source: string; paths: number; withEcho: number; withCrossStage: number; shareEcho: number; shareCrossStage: number; mean: number; top: { run: string; paths: number }[]; flagged: boolean }

const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'and', 'in', 'on', 'at', 'is', 'was', 'it', 'its', 'he', 'she', 'they', 'his', 'her', 'their', 'him', 'them', 'for', 'with', 'as', 'by',
  'that', 'this', 'from', 'or', 'but', 'not', 'no', 'be', 'are', 'were', 'has', 'have', 'had', 'you', 'your', 'we', 'our', 'i', 'me', 'my', 'then', 'out', 'up', 'down', 'into', 'still']);
const NAME = '§';
/** Where a sentence stopped: no run crosses it. */
const BREAK = '|';
/** The shortest run that counts. */
const MIN_RUN = 4;

/** Lower-cased words of a string, a `|` where a sentence stops, with proper nouns masked: the cast's names, any capitalized word
 * inside a sentence (a place, an outlet, a unit) and numerals. Apostrophes stay inside words; a
 * possessive of a name masks with it. */
export function words(text: string, names: ReadonlySet<string>): string[] {
  const out: string[] = [];
  let start = true;
  for (const match of text.replace(/[’‘]/g, "'").matchAll(/[\p{L}\p{N}']+|[.!?:;"“”—]/gu)) {
    const raw = match[0];
    if (/^[.!?:;"“”—]$/.test(raw)) { start = /^[.!?:"“]$/.test(raw); if (out.length && out[out.length - 1] !== BREAK) out.push(BREAK); continue; }
    const bare = raw.replace(/^'+|'+$/g, '').replace(/'s$/, '').toLowerCase();
    const proper = /^\p{Lu}/u.test(raw) && !start, numeral = /^\p{N}/u.test(raw);
    out.push(names.has(bare) || proper || numeral ? NAME : bare || raw.toLowerCase());
    start = false;
  }
  return out;
}

/** A run counts when it carries something: at most one masked word, at least two words that aren't
 * function words. */
const counts = (run: readonly string[]): boolean => run.filter(word => word === NAME).length <= 1 && run.filter(word => word !== NAME && !STOP.has(word)).length >= 2;

/** The maximal runs of four or more words two token lists share. Each run is found once, at its
 * longest, so a shared sentence is one echo and not one per word it contains. */
export function sharedRuns(a: readonly string[], b: readonly string[]): string[] {
  const runs = new Set<string>();
  const into = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) into[i][j] = a[i] === b[j] && a[i] !== BREAK ? into[i + 1][j + 1] + 1 : 0;
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    // The start of a maximal run: the words before it differ.
    if (into[i][j] < MIN_RUN || (i > 0 && j > 0 && a[i - 1] === b[j - 1])) continue;
    const run = a.slice(i, i + into[i][j]);
    if (counts(run)) runs.add(run.join(' '));
  }
  return [...runs];
}

/** Every pair of strings on a path, from different steps, that share a run. Strings of one step are
 * the same moment and never echo each other. */
export function pathEchoes(path: PathRecord): Echo[] {
  const names = new Set(path.names.map(name => name.toLowerCase()));
  const strings: { step: number; stage: string; text: string; tokens: string[] }[] = [];
  path.steps.forEach((step, i) => {
    for (const text of [step.prompt, ...step.lines]) if (text.trim()) strings.push({ step: i, stage: step.stage, text, tokens: words(text, names) });
  });
  const out: Echo[] = [];
  for (let i = 0; i < strings.length; i++) for (let j = i + 1; j < strings.length; j++) {
    const [a, b] = [strings[i], strings[j]];
    if (a.step === b.step) continue;
    for (const run of sharedRuns(a.tokens, b.tokens))
      out.push({ run, a: { step: a.step, stage: a.stage, text: a.text }, b: { step: b.step, stage: b.stage, text: b.text }, crossStage: a.stage !== b.stage });
  }
  return out;
}

/** Per source: the share of paths with a four-word echo between two steps, and with one between two
 * stages; `mean` counts distinct runs per path. Flagged when any path has a cross-stage echo. */
export function echoSummary(paths: readonly PathRecord[]): EchoSummary[] {
  return [...bySource(paths)].map(([source, group]) => {
    const per = group.map(pathEchoes);
    const runs = new Map<string, number>();
    for (const echoes of per) for (const run of new Set(echoes.map(echo => echo.run))) runs.set(run, (runs.get(run) ?? 0) + 1);
    const withEcho = per.filter(echoes => echoes.length > 0).length, withCross = per.filter(echoes => echoes.some(echo => echo.crossStage)).length;
    const distinct = per.reduce((sum, echoes) => sum + new Set(echoes.map(echo => echo.run)).size, 0);
    return { source, paths: group.length, withEcho, withCrossStage: withCross, shareEcho: share(withEcho, group.length), shareCrossStage: share(withCross, group.length),
      mean: Math.round(100 * distinct / Math.max(1, group.length)) / 100,
      top: [...runs].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(([run, n]) => ({ run, paths: n })), flagged: withCross > 0 };
  });
}
