// Why can or can't this happen (spec 6.4): a requirement tree (trees-v13/dependencies requirementTree)
// checked clause by clause at the current frame, per situation and per draw, with the writers of each
// state clause and the fixes that would make it hold. Every clause is read through the engine or the
// compiler, never through a lab copy of their rules: marks and safe flags through the compiler's
// stateCondition and the engine's conditionHolds, group sizes through countHolds, clocks through
// clockConditionsHold (at this moment), meters through meterConditionsHold, command approval through
// authorize, facts from the compiled call's hidden truth. Dice (a band, a drawn result) are never
// known in advance: those clauses read "unknown".
import type { CallTree, TreeState } from '../../../content/call-trees/types';
import { templateAt } from '../../../content/incidents';
import { instanceOf } from '../../../gen/incident/instance';
import { choiceActionId, countHolds, memberCounts, stateCondition, treeFactId } from '../../../gen/incident/trees-v13/compile';
import { requirementTree, roleNoun, sentenceCase } from '../../../gen/incident/trees-v13/dependencies';
import type { DependencyIndex, ReqLeaf, ReqNode, ReqTarget, Site, StateKey } from '../../../gen/incident/trees-v13/dependencies';
import { authorize } from '../../../sim/authorization';
import { clockConditionsHold } from '../../../sim/clocks';
import { buildLocation } from '../../../sim/location';
import { meterConditionsHold } from '../../../sim/meters';
import { conditionHolds } from '../../../sim/conditions';
import { getScenario } from '../../../sim/scenario-registry';
import type { ConcessionKind, ScenarioDefinition } from '../../../sim/scenario-types';
import type { ActionView, GameState, OutcomeBand } from '../../../sim/types';
import type { Goal } from '../jobs/protocol';
import type { DrawWant } from './seek';
import type { Frame, Session } from './session';
import { nodeAt } from './session';
import { certWords, focusSquad } from './squads';

export type Verdict = 'pass' | 'fail' | 'unknown';
/** One clause or group. `now`: at the frame. `bySituation`: in each of the tree's three situations
 * (null when the clause doesn't depend on the hidden truth). `draw`: what the call's draw needs
 * ("needs others ≥ 1; this call has 0"), null when the draw doesn't decide it. `writers`: the sites
 * that set the state key a clause reads. */
export interface EvaluatedReq { node: ReqNode; label: string; now: Verdict; bySituation: [Verdict, Verdict, Verdict] | null;
  draw: string | null; writers: Site[]; children: EvaluatedReq[] }
export type Fix = { kind: 'grant-cert'; cert: string } | { kind: 'seek-squad'; cert: string } | { kind: 'find-path'; goal: Goal } | { kind: 'seek-draw'; want: DrawWant };

/** What a clause is read against: the call (tree, compiled scenario, draw) and its group members. */
export interface ReqContext { scenario: ScenarioDefinition; tree: CallTree; counts: Record<string, number>; turnDrawn: Record<string, string>;
  situation: 0 | 1 | 2; groups: Record<string, readonly string[]> }

export function sessionContext(s: Session): ReqContext {
  return { scenario: s.scenario, tree: s.tree, counts: s.counts, turnDrawn: s.turnDrawn, situation: s.situation, groups: s.instance.placed.groups };
}

const CONTEXTS = new Map<string, ReqContext | null>();
/** The same context for a bare engine state (a worker's explore job has no session), from the call it
 * runs: its compiled scenario and drawn instance. Null for a call that isn't a call tree. */
export function stateContext(state: GameState): ReqContext | null {
  const id = state.activeRun?.scenarioId;
  if (!id) return null;
  if (CONTEXTS.has(id)) return CONTEXTS.get(id)!;
  const scenario = getScenario(id);
  const template = scenario?.incident ? templateAt(scenario.incident.type) : undefined;
  const instance = scenario && template ? instanceOf(scenario, buildLocation(scenario.locationFamilyId, scenario.locationSeed)) : null;
  const context = scenario && template && instance ? { scenario, tree: template.tree, counts: memberCounts(instance.placed), turnDrawn: { ...instance.turns },
    situation: (instance.situation === 1 || instance.situation === 2 ? instance.situation : 0) as 0 | 1 | 2, groups: instance.placed.groups } : null;
  if (CONTEXTS.size > 32) CONTEXTS.clear();
  CONTEXTS.set(id, context);
  return context;
}

// ---------------------------------------------------------------- labels

const BAND_TEXT: Record<OutcomeBand, string> = { favorable: 'goes well', mixed: 'has complications', adverse: 'goes badly' };

function keyLabel(deps: DependencyIndex | null, key: StateKey, fallback: string): string {
  return deps?.keys.get(key)?.label ?? fallback;
}

function countText(leaf: Extract<ReqLeaf, { kind: 'count' }>): string {
  const { group, min, max } = leaf;
  return min !== undefined && max !== undefined ? min === max ? `${group} = ${min}` : `${group} ${min} to ${max}` : min !== undefined ? `${group} ≥ ${min}` : `${group} ≤ ${max}`;
}

function truthOf(tree: CallTree, fact: string, situation: number): boolean | undefined {
  return tree.facts[fact]?.truth ?? tree.situations[situation]?.truth[fact];
}

/** A clause in plain words: "Needs certification: vehicle operations". */
export function leafLabel(leaf: ReqLeaf, tree: CallTree, deps: DependencyIndex | null): string {
  switch (leaf.kind) {
    case 'at': return `At ${sentenceCase(leaf.node)}`;
    case 'mark': return `${leaf.want ? 'Mark set' : 'Mark not set'}: ${keyLabel(deps, `mark:${leaf.mark}`, sentenceCase(leaf.mark))}`;
    case 'safe': return `${leaf.want ? 'Brought out safe' : 'Not yet out safe'}: ${roleNoun(tree, leaf.role)}`;
    case 'count': return `Group size: ${countText(leaf)}`;
    case 'cert': return `Needs certification: ${certWords(leaf.cert)}`;
    case 'tags': return `Needs gear: ${leaf.tags.map(certWords).join(leaf.all ? ' and ' : ' or ')}`;
    case 'minSquads': return `Needs ${leaf.n} squads`;
    case 'fact': return `Hidden truth: ${keyLabel(deps, `fact:${leaf.fact}`, sentenceCase(leaf.fact))} is ${leaf.is ? 'true' : 'false'}`;
    case 'clock': {
      const label = keyLabel(deps, `clock:${leaf.clock}`, sentenceCase(leaf.clock));
      return leaf.when === 'low' ? `${label} ${leaf.is ? 'is low' : 'is not low yet'}` : `${label} ${leaf.is ? 'has run out' : 'has not run out'}`;
    }
    case 'meter': {
      const parts = [...leaf.stance?.length ? [leaf.stance.join(' or ')] : [], ...leaf.agitationAtLeast !== undefined ? [`agitation ${leaf.agitationAtLeast} or more`] : []];
      return `${sentenceCase(roleNoun(tree, leaf.role))} is ${leaf.is === false ? 'not ' : ''}${parts.join(' with ')}`;
    }
    case 'band': return `The result ${BAND_TEXT[leaf.band]}`;
    case 'turn': return `Turn drawn: ${sentenceCase(leaf.node)}`;
    case 'drawn': return `Drawn result: ${leaf.result.replace(':', ' ')}`;
    case 'authority': return leaf.detail === 'entry' ? 'Command approves an entry' : `Command approves the concession (${leaf.detail.replace(/^concede /, '').replace(/_/g, ' ')})`;
    case 'noEarlierPrompt': return 'No earlier prompt variant matches';
  }
}

// ---------------------------------------------------------------- clauses

const verdict = (holds: boolean): Verdict => holds ? 'pass' : 'fail';
const stateHolds = (state: TreeState, ctx: ReqContext, run: NonNullable<GameState['activeRun']>) =>
  countHolds(state, ctx.counts) && conditionHolds(stateCondition(state, ctx.groups), run);

/** One clause at this state. `view`: the target choice's engine view, when there is one (gear). */
export function leafNow(leaf: ReqLeaf, state: GameState, ctx: ReqContext, view?: ActionView): Verdict {
  const run = state.activeRun;
  if (!run) return 'unknown';
  switch (leaf.kind) {
    case 'at': return verdict(nodeAt(state, ctx.tree) === leaf.node);
    case 'mark': return verdict(stateHolds(leaf.want ? { marks: [leaf.mark] } : { notMarks: [leaf.mark] }, ctx, run));
    case 'safe': return verdict(stateHolds(leaf.want ? { safe: [leaf.role] } : { notSafe: [leaf.role] }, ctx, run));
    case 'count': return verdict(countHolds({ count: { role: leaf.group, ...leaf.min !== undefined ? { min: leaf.min } : {}, ...leaf.max !== undefined ? { max: leaf.max } : {} } }, ctx.counts));
    case 'cert': {
      const squad = state.squads.find(entry => entry.id === focusSquad(state));
      return verdict(!!squad?.officerIds.some(id => (state.officers[id]?.certs as readonly string[] | undefined)?.includes(leaf.cert)));
    }
    case 'tags':
      // Gear is the engine's to judge (loadouts, operators): read its verdict on the choice.
      if (!view) return 'unknown';
      return view.eligible ? 'pass' : view.reason?.includes('loadout') ? 'fail' : 'unknown';
    case 'minSquads': return verdict(run.squadIds.length >= leaf.n);
    case 'fact': {
      const truth = ctx.scenario.facts.find(fact => fact.id === treeFactId(leaf.fact))?.truth ?? truthOf(ctx.tree, leaf.fact, ctx.situation);
      return truth === undefined ? 'unknown' : verdict(truth === leaf.is);
    }
    // At this moment; an outcome reads its clocks at the end of its own minutes.
    case 'clock': return verdict(clockConditionsHold([{ clockId: leaf.clock, state: leaf.when, is: leaf.is }], ctx.scenario, run, 0));
    case 'meter': return verdict(meterConditionsHold([{ personId: leaf.role, ...leaf.stance ? { stance: leaf.stance } : {}, ...leaf.agitationAtLeast !== undefined ? { agitationAtLeast: leaf.agitationAtLeast } : {}, is: leaf.is ?? true }], run));
    case 'turn': return verdict(ctx.turnDrawn[leaf.group] === leaf.node);
    case 'authority': {
      const item = leaf.detail.replace(/^concede /, '');
      const result = authorize(ctx.scenario, run, leaf.detail === 'entry' ? { kind: 'entry' } : { kind: 'concession', item: item as ConcessionKind });
      return verdict(result.allowed);
    }
    case 'noEarlierPrompt': {
      const node = ctx.tree.nodes.find(entry => entry.id === leaf.node);
      const earlier = (node?.promptIf ?? []).slice(0, leaf.index);
      return verdict(!earlier.some(entry => stateHolds(entry.when, ctx, run)));
    }
    case 'band': case 'drawn': return 'unknown';
  }
}

function leafBySituation(leaf: ReqLeaf, tree: CallTree): [Verdict, Verdict, Verdict] | null {
  if (leaf.kind !== 'fact') return null;
  return [0, 1, 2].map(i => { const truth = truthOf(tree, leaf.fact, i); return truth === undefined ? 'unknown' : verdict(truth === leaf.is); }) as [Verdict, Verdict, Verdict];
}

function leafDraw(leaf: ReqLeaf, ctx: ReqContext, now: Verdict): string | null {
  if (leaf.kind === 'count') return `needs ${countText(leaf)}${now === 'fail' ? `; this call has ${ctx.counts[leaf.group] ?? 0}` : ''}`;
  if (leaf.kind === 'turn') {
    const drawn = ctx.turnDrawn[leaf.group];
    return `needs turn ${sentenceCase(leaf.node).toLowerCase()}${now === 'fail' && drawn ? `; this call drew ${sentenceCase(drawn).toLowerCase()}` : ''}`;
  }
  if (leaf.kind === 'drawn') return `needs the drawn result ${leaf.result.replace(':', ' ')}`;
  return null;
}

const LEAF_KEY: Partial<Record<ReqLeaf['kind'], (leaf: never) => StateKey>> = {
  mark: (leaf: { mark: string }) => `mark:${leaf.mark}`,
  safe: (leaf: { role: string }) => `safe:${leaf.role}`,
  count: (leaf: { group: string }) => `count:${leaf.group}`,
  fact: () => 'situation',
  clock: (leaf: { clock: string }) => `clock:${leaf.clock}`,
  meter: (leaf: { role: string }) => `meter:${leaf.role}`,
  turn: (leaf: { group: string }) => `turn:${leaf.group}`,
};
/** The state key a clause reads, when it reads one. */
export const leafKey = (leaf: ReqLeaf): StateKey | null => (LEAF_KEY[leaf.kind] as ((leaf: ReqLeaf) => StateKey) | undefined)?.(leaf) ?? null;

// ---------------------------------------------------------------- groups

function combine(kind: 'all' | 'any', verdicts: readonly Verdict[]): Verdict {
  if (kind === 'all') return verdicts.includes('fail') ? 'fail' : verdicts.includes('unknown') ? 'unknown' : 'pass';
  return verdicts.includes('pass') ? 'pass' : verdicts.includes('unknown') ? 'unknown' : 'fail';
}

function evaluate(node: ReqNode, state: GameState, ctx: ReqContext, deps: DependencyIndex | null, view: ActionView | undefined): EvaluatedReq {
  if ('leaf' in node) {
    const now = leafNow(node.leaf, state, ctx, view);
    const key = leafKey(node.leaf);
    return { node, label: leafLabel(node.leaf, ctx.tree, deps), now, bySituation: leafBySituation(node.leaf, ctx.tree), draw: leafDraw(node.leaf, ctx, now),
      writers: key ? [...deps?.keys.get(key)?.writers ?? []] : [], children: [] };
  }
  const kind = 'all' in node ? 'all' : 'any';
  const children = ('all' in node ? node.all : node.any).map(child => evaluate(child, state, ctx, deps, view));
  const now = combine(kind, children.map(child => child.now));
  const bySituation = children.some(child => child.bySituation)
    ? [0, 1, 2].map(i => combine(kind, children.map(child => child.bySituation?.[i] ?? child.now))) as [Verdict, Verdict, Verdict] : null;
  const label = kind === 'all' ? (children.length ? 'All of these' : 'Always') : children.length ? 'Any one of these' : 'Reached only when no choice is left';
  // The exhausted-choices fallback (`handed_over`) has no authored edge: it is never known ahead.
  return { node, label, now: kind === 'any' && !children.length ? 'unknown' : now, bySituation, draw: null, writers: [], children };
}

/** The flags a state goal can look for: the positive `at`, mark and safe clauses. */
function flagGoal(node: ReqNode, groups: Record<string, readonly string[]>): string[] {
  if ('leaf' in node) {
    const leaf = node.leaf;
    if (leaf.kind === 'at') return [`at:${leaf.node}`];
    if (leaf.kind === 'mark' && leaf.want) return [`mark:${leaf.mark}`];
    if (leaf.kind === 'safe' && leaf.want) return (groups[leaf.role] ?? [leaf.role]).map(role => `safe:${role}`);
    return [];
  }
  return 'all' in node ? node.all.flatMap(child => flagGoal(child, groups)) : [];
}

/** The goal an explore job looks for to make a target happen. */
export function goalFor(tree: CallTree, req: ReqNode, target: ReqTarget): Goal {
  if ('choice' in target) return { eligible: choiceActionId(tree.type, target.choice[0], target.choice[1]) };
  if ('ending' in target) return { ending: target.ending };
  if ('node' in target) return { node: target.node };
  return { req, target };
}

const STATE_KINDS = new Set<ReqLeaf['kind']>(['at', 'mark', 'safe', 'clock', 'meter', 'noEarlierPrompt', 'authority']);

function fixesOf(e: EvaluatedReq, ctx: ReqContext): Fix[] {
  if (e.now === 'pass') return [];
  if ('leaf' in e.node) {
    const leaf = e.node.leaf;
    if (e.now !== 'fail') return [];
    if (leaf.kind === 'cert') return [{ kind: 'grant-cert', cert: leaf.cert }, { kind: 'seek-squad', cert: leaf.cert }];
    if (leaf.kind === 'count') return [{ kind: 'seek-draw', want: { counts: { [leaf.group]: leaf.min ?? leaf.max ?? 0 } } }];
    if (leaf.kind === 'turn') return [{ kind: 'seek-draw', want: { turns: { [leaf.group]: leaf.node } } }];
    if (leaf.kind === 'fact') {
      const at = e.bySituation?.findIndex(entry => entry === 'pass') ?? -1;
      return at >= 0 ? [{ kind: 'seek-draw', want: { variant: at as 0 | 1 | 2 } }] : [];
    }
    return [];
  }
  const children = e.children.filter(child => child.now !== 'pass');
  if ('any' in e.node) {
    // The branch closest to holding: fewest failing clauses.
    const failing = (x: EvaluatedReq): number => 'leaf' in x.node ? (x.now === 'fail' ? 1 : 0) : x.children.reduce((sum, child) => sum + failing(child), 0);
    const best = [...e.children].sort((a, b) => failing(a) - failing(b))[0];
    return best ? fixesOf(best, ctx) : [];
  }
  return children.flatMap(child => fixesOf(child, ctx));
}

const hasFailingState = (e: EvaluatedReq): boolean => 'leaf' in e.node ? e.now === 'fail' && STATE_KINDS.has(e.node.leaf.kind) : e.children.some(hasFailingState);

/** The requirement checked at a frame, with fixes: grant or find a cert, find a draw (a group size,
 * a turn, a situation), or find a path to where it holds. `target` (what the tree was built for)
 * names the goal of that path; without it the goal is the clauses' flags. */
export function evaluateReq(req: ReqNode, s: Session, frame: Frame, deps: DependencyIndex | null, target?: ReqTarget): { root: EvaluatedReq; fixes: Fix[] } {
  const ctx = sessionContext(s);
  const view = target && 'choice' in target ? frame.views.find(entry => entry.id === choiceActionId(s.tree.type, target.choice[0], target.choice[1])) : undefined;
  const root = evaluate(req, frame.state, ctx, deps, view);
  const fixes = fixesOf(root, ctx);
  if (root.now !== 'pass' && hasFailingState(root)) {
    const goal: Goal | null = target ? goalFor(s.tree, req, target) : (flags => flags.length ? { flags } : null)(flagGoal(req, ctx.groups));
    if (goal) fixes.push({ kind: 'find-path', goal });
  }
  const seen = new Set<string>();
  return { root, fixes: fixes.filter(fix => { const key = JSON.stringify(fix); return !seen.has(key) && !!seen.add(key); }) };
}

/** Whether the requirement can hold at this state: no clause fails (dice clauses count as possible). */
export function holdsAt(req: ReqNode, state: GameState, s: Session): boolean {
  return evaluate(req, state, sessionContext(s), null, undefined).now !== 'fail';
}

/** holdsAt for a bare engine state (explore jobs in a worker). */
export function holdsIn(req: ReqNode, state: GameState, ctx: ReqContext, view?: ActionView): boolean {
  return evaluate(req, state, ctx, null, view).now !== 'fail';
}

// ---------------------------------------------------------------- what rules a goal out

/** Clauses a call can't change by playing: its hidden truth, the squad's certs, its group sizes and
 * the turns it drew. */
const STATIC_KINDS = new Set<ReqLeaf['kind']>(['fact', 'cert', 'count', 'turn']);

/** One failing clause in words: what it needs, then what this call has instead. */
function blockerWords(leaf: ReqLeaf, ctx: ReqContext, deps: DependencyIndex | null, squad: string): string {
  switch (leaf.kind) {
    case 'fact': {
      const label = keyLabel(deps, `fact:${leaf.fact}`, sentenceCase(leaf.fact));
      return `the hidden truth “${label}” to be ${leaf.is ? 'true' : 'false'}, and situation ${ctx.situation + 1} has it ${leaf.is ? 'false' : 'true'}`;
    }
    case 'cert': return `certification in ${certWords(leaf.cert)}, and ${squad} has none`;
    case 'count': return `${countText(leaf)}, and this call has ${ctx.counts[leaf.group] ?? 0}`;
    case 'turn': return `the turn ${sentenceCase(leaf.node).toLowerCase()}, and this call drew ${sentenceCase(ctx.turnDrawn[leaf.group] ?? 'none').toLowerCase()}`;
    default: return leafLabel(leaf, ctx.tree, deps);
  }
}

/** The target an explore goal is for, when it names one. */
function targetOf(tree: CallTree, goal: Goal): ReqTarget | null {
  if ('node' in goal) return { node: goal.node };
  if ('ending' in goal) return { ending: goal.ending };
  if ('target' in goal) return goal.target;
  const actionId = 'offered' in goal ? goal.offered : 'eligible' in goal ? goal.eligible : null;
  const parts = actionId ? tree.nodes.flatMap(node => node.choices.map(choice => ({ node: node.id, choice: choice.id }))).find(entry => choiceActionId(tree.type, entry.node, entry.choice) === actionId) : undefined;
  return parts ? { choice: [parts.node, parts.choice] } : null;
}

/** Why no path can reach a goal in this call, when its own draw or squad rules it out: every route
 * there needs a hidden truth this situation doesn't hold, a cert the squad lacks, a group size or a
 * turn the call didn't draw. A sentence ("Every route there needs …"), or null when nothing fixed
 * rules it out (then the dice, command approval or a clock decide it). */
export function blockedBecause(s: Session, goal: Goal, deps: DependencyIndex | null, squad = 'squad A'): string | null {
  const target = targetOf(s.tree, goal);
  if (!target) return null;
  let req: ReqNode;
  try { req = 'req' in goal ? goal.req : requirementTree(s.tree, target); } catch { return null; }
  const ctx = sessionContext(s);
  const start = s.frames[0].state;
  const failing = (node: ReqNode): ReqLeaf[] => 'leaf' in node
    ? STATIC_KINDS.has(node.leaf.kind) && leafNow(node.leaf, start, ctx) === 'fail' ? [node.leaf] : []
    : 'all' in node ? node.all.flatMap(failing) : [];
  const routes = 'any' in req ? req.any : [req];
  if (!routes.length) return null;
  const blocked = routes.map(failing);
  if (blocked.some(leaves => !leaves.length)) return null;
  const texts = [...new Set(blocked.flatMap(leaves => leaves.map(leaf => blockerWords(leaf, ctx, deps, squad))))];
  // One clause every route fails reads best alone.
  const shared = texts.find(text => blocked.every(leaves => leaves.some(leaf => blockerWords(leaf, ctx, deps, squad) === text)));
  const lead = 'any' in req ? 'Every route there needs' : 'It needs';
  if (shared) return `${lead} ${shared}.`;
  return `Each route there needs something this call lacks: ${texts.slice(0, 3).join('; ')}.`;
}
