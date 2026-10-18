// What the player can't see under each choice at one engine state (spec 3.2 X-ray rail, 9.3 Stream
// P): the margin and its contributors, the route each band takes under this call's hidden truth,
// what each band writes and which later text reads it, and the drawn results with their odds. Every
// number and route comes from the engine: the odds and contributors from evaluateAction (the same
// call liveDecisions makes for the player's cards), the routes from matchedOutcomeIndices (the
// filter the engine's decide applies at commit), the drawn odds from drawnDistributionAt (the plans
// resolveDrawn samples). Nothing here evaluates a condition itself.
import { sampleFor } from '../../../gen/incident/gates/engine-driver';
import { weigh } from '../../../gen/incident/trees-v13/balance';
import type { Weight } from '../../../gen/incident/trees-v13/balance';
import { requirementTree } from '../../../gen/incident/trees-v13/dependencies';
import type { DependencyIndex, ReqNode, Site, StateKey } from '../../../gen/incident/trees-v13/dependencies';
import { choiceIndex, humanizeNode } from '../../../gen/incident/trees-v13/graph';
import { clockViews, forkMinutes, stepClock } from '../../../sim/clocks';
import type { DrawnResult } from '../../../sim/drawn-effects';
import { matchedOutcomeIndices } from '../../../sim/operation';
import { drawnDistributionAt, pendingDebrief, stageProgress } from '../../../sim/operation-selectors';
import { bandProbabilities, builtFor, evaluateAction, RESOLUTION_TUNING } from '../../../sim/resolution';
import type { Evaluation } from '../../../sim/resolution';
import { getScenario } from '../../../sim/scenario-registry';
import type { ActionDefinition, IncidentPersonDef, OutcomeEffect, ScenarioDefinition } from '../../../sim/scenario-types';
import type { ActionView, Contributor, GameState, OperationRun, OutcomeBand } from '../../../sim/types';
import { CONTRIBUTOR_GROUPS } from '../../../ui/screens/contributor-groups';
import { visibleDecisions } from '../../../ui/screens/liveModels';
import type { Frame, Session } from './session';
import { nodeAt } from './session';
import { focusSquad } from './squads';

export const BANDS: readonly OutcomeBand[] = ['favorable', 'mixed', 'adverse'];

export type RouteTarget = { kind: 'node'; node: string; title: string } | { kind: 'ending'; ending: string; title: string; weight?: Weight };
/** One hidden input that decided an outcome: the situation's truth, a clock, a subject's stance, or
 * public state (marks and safe flags). `title` is the long form for a tooltip. */
export interface Because { text: string; kind: 'truth' | 'clock' | 'meter' | 'state'; title?: string }
/** A drawn result with where it sends the call and whether it harms someone. */
export type RoutedResult = DrawnResult & { to: RouteTarget | null; harms: boolean };
/** One band of a choice at this state. `possible`: the engine can produce it here (the choice is
 * eligible and the band can be aimed at). `effects`: the band's outcomes the engine applies under this
 * call's truth and state, `index` into the compiled band list. `to`: where it sends the call, null
 * when a drawn result decides (then each result has its own `to`). Extra fields: `writes` (every key
 * the band sets, concessions included), `harm` (deterministic harm, in words), `mayHarm` (someone can
 * be harmed, by the band, a drawn result or a clock that runs out over the band's minutes; a clock
 * that surely runs out on its owner is in `harm`, one that only can is in `maybeHarm`). */
export interface BandRoute { band: OutcomeBand; p: number; possible: boolean;
  effects: { index: number; routed: boolean; text: string; writes: StateKey[]; because: string[]; why: Because[] }[];
  to: RouteTarget | null; drawn: { effect: number; model: 'incoming_fire' | 'team_force' | 'cascade'; on: string | null; results: RoutedResult[] }[];
  harm: string[]; maybeHarm: string[]; writes: StateKey[]; mayHarm: boolean }
/** One choice offered at this state. `shown`: on the player's screen without "Show all", or behind
 * it. Extra fields: `title` (bound), `entry` (asks command for an entry), `force` (a band can draw
 * team force). */
export interface ChoiceXray { actionId: string; node: string; choice: string; view: ActionView; shown: 'shown' | 'behind-show-all' | 'not-offered';
  score: number; difficulty: number; margin: number; groups: { id: string; label: string; total: number; items: Contributor[] }[];
  bands: Record<OutcomeBand, BandRoute>; readers: Site[]; req: ReqNode | null; title: string; entry: boolean; force: boolean }

/** Band chances by margin, -40 to 40, under the tables in force now: the page's tables carry the
 * unsaved tuning patch, so a caller recomputes this when the tuning hash changes (the full note's
 * curve sits under a margin marker and odds read from the same tables). */
export function bandCurve(step = 2): { margin: number; favorable: number; mixed: number; adverse: number }[] {
  return Array.from({ length: Math.floor(80 / step) + 1 }, (_, i) => { const margin = -40 + i * step; return { margin, ...bandProbabilities(margin) }; });
}

// ---------------------------------------------------------------- routes

const ROUND = (v: number) => Math.round(v * 10) / 10;

/** Titles for nodes and endings, bound to this call. */
export function targetFor(s: Session, ref: { node: string } | { ending: string }): RouteTarget {
  if ('ending' in ref) return { kind: 'ending', ending: ref.ending, title: s.scenario.endings?.[ref.ending]?.title ?? s.tree.endings[ref.ending]?.title ?? ref.ending };
  const node = s.tree.nodes.find(entry => entry.id === ref.node);
  return { kind: 'node', node: ref.node, title: node ? humanizeNode(node).title : ref.node };
}

/** Where a list of applied effects sends the call: an ending anywhere wins (the call is over), else
 * the last node flag set. Null when nothing routes (the call stays where it is). */
export function routeOf(effects: readonly OutcomeEffect[]): { node: string } | { ending: string } | null {
  let node: string | null = null, ending: string | null = null;
  for (const effect of effects) {
    if (effect.ending) ending = effect.ending;
    const flag = [...effect.setFlags ?? []].reverse().find(entry => entry.startsWith('at:'));
    if (flag) node = flag.slice(3);
  }
  return ending ? { ending } : node ? { node } : null;
}

/** Where the call is in a state: its node, its ending, or null mid-transition. */
export function whereIs(s: Session, state: GameState): RouteTarget | null {
  const run = state.activeRun;
  if (run?.endingId) return targetFor(s, { ending: run.endingId });
  const node = nodeAt(state, s.tree);
  return node ? targetFor(s, { node }) : null;
}

// ---------------------------------------------------------------- writes and reasons

/** Member ids (`others_1`) back to their group (`others`), as the dependency index keys them. */
function roleOf(s: Session, id: string): string {
  for (const [group, members] of Object.entries(s.instance.placed.groups ?? {})) if (members.includes(id)) return group;
  return id;
}

/** The state keys one compiled effect writes, in the dependency index's terms. Clock minutes are left
 * out: every choice writes every running clock. */
export function writesOf(s: Session, effect: OutcomeEffect): StateKey[] {
  const keys: StateKey[] = [];
  for (const flag of effect.setFlags ?? []) {
    if (flag.startsWith('mark:')) keys.push(flag as StateKey);
    else if (flag.startsWith('safe:')) keys.push(`safe:${roleOf(s, flag.slice(5))}`);
    else if (flag.startsWith('out:')) keys.push(`out:${roleOf(s, flag.slice(4))}`);
  }
  for (const fact of effect.reveal ?? []) if (fact.startsWith('f_')) keys.push(`fact:${fact.slice(2)}`);
  for (const move of effect.moves ?? []) keys.push(`meter:${roleOf(s, move.personId)}`);
  if (effect.promise) keys.push(`promise:${effect.promise.id}`);
  for (const harm of effect.personHarm ?? []) keys.push(`harm:${roleOf(s, harm.personId)}`);
  if (effect.officerHarm) keys.push('harm:officer');
  if (effect.objective) keys.push('scalar:objective');
  if (effect.civilian) keys.push('scalar:civilian');
  if (effect.pressure) keys.push('scalar:pressure');
  return [...new Set(keys)];
}

const firstName = (scenario: ScenarioDefinition, id: string): string =>
  scenario.story?.cast?.[id]?.firstName ?? id.replace(/_\d+$/, '').replace(/_/g, ' ');
const HARM_WORD = { wounded: 'hurt', serious: 'badly hurt', fatal: 'killed' } as const;

/** Deterministic harm one effect does, in words: "Ruth badly hurt", "An officer hurt". */
export function harmOf(scenario: ScenarioDefinition, effect: OutcomeEffect): string[] {
  return [
    ...(effect.personHarm ?? []).map(harm => `${firstName(scenario, harm.personId)} ${HARM_WORD[harm.severity]}`),
    ...effect.officerHarm ? [effect.officerHarm.severity === 'serious' ? 'An officer badly hurt' : 'An officer hurt'] : [],
  ];
}

/** The hidden inputs and public state that decide whether an effect applies. */
function reasonsOf(scenario: ScenarioDefinition, action: ActionDefinition, band: OutcomeBand, effect: OutcomeEffect, deps: DependencyIndex | null): Because[] {
  const out: Because[] = [];
  for (const entry of effect.truth ?? []) {
    const fact = scenario.facts.find(f => f.id === entry.factId);
    const label = fact?.label ?? entry.factId;
    const said = fact?.resolved?.[entry.is ? 'confirmed' : 'disproved'];
    out.push({ kind: 'truth', text: `${label}: ${entry.is ? 'yes' : 'no'}`, title: `Hidden truth in this situation. ${fact?.claim ?? ''} ${said ? `(${said})` : ''}`.trim() });
  }
  if (effect.clocks?.length) {
    const minutes = Math.round(forkMinutes(action, band, effect));
    for (const entry of effect.clocks) {
      const clock = scenario.clocks?.find(c => c.id === entry.clockId);
      const label = clock?.label ?? entry.clockId;
      out.push({ kind: 'clock', text: `${label} ${entry.is ? '' : 'not '}${entry.state === 'out' ? 'out' : 'low'} by ${minutes} min`,
        title: `Read at the end of this choice's minutes (${minutes} min for this band).` });
    }
  }
  for (const entry of effect.meters ?? []) {
    const parts = [...entry.stance?.length ? [entry.stance.join(' or ')] : [], ...entry.agitationAtLeast !== undefined ? [`agitation ${entry.agitationAtLeast}+`] : []];
    out.push({ kind: 'meter', text: `${firstName(scenario, entry.personId)} ${entry.is === false ? 'not ' : ''}${parts.join(', ')}`, title: 'Read as the subject stands at the start of the decision.' });
  }
  const label = (key: StateKey, fallback: string) => deps?.keys.get(key)?.label ?? fallback;
  for (const flag of effect.when?.flags ?? []) {
    if (flag.startsWith('mark:')) out.push({ kind: 'state', text: `after ${label(flag as StateKey, flag.slice(5)).toLowerCase()}` });
    else if (flag.startsWith('safe:')) out.push({ kind: 'state', text: `${firstName(scenario, flag.slice(5))} out safe` });
  }
  for (const flag of effect.when?.notFlags ?? []) {
    if (flag.startsWith('mark:')) out.push({ kind: 'state', text: `unless ${label(flag as StateKey, flag.slice(5)).toLowerCase()}` });
    else if (flag.startsWith('safe:')) out.push({ kind: 'state', text: `${firstName(scenario, flag.slice(5))} not yet out` });
  }
  return out;
}

const HARMFUL_FIRE = new Set(['wounded', 'serious']);
const harmsResult = (model: string, key: string) => model === 'incoming_fire' ? HARMFUL_FIRE.has(key) : model === 'team_force' ? !key.endsWith(':none') : false;

// ---------------------------------------------------------------- clocks that run out

const round1 = (n: number) => Math.round(n * 10) / 10;
const extraOf = (effects: readonly OutcomeEffect[]) => effects.reduce((sum, effect) => sum + (effect.extraMinutes ?? 0), 0);

/** The least and most minutes this band can take at the commit (sim/operation.ts decide): the
 * choice's base minutes for the band, less the route's movement when the person doesn't move along
 * it (which the commit settles from the outcome), plus the outcome's extra minutes and the least or
 * most a drawn result's variant adds. */
export function bandMinutes(_scenario: ScenarioDefinition, action: ActionDefinition, ev: Pick<Evaluation, 'timeBase' | 'storyMovementMinutes'>, band: OutcomeBand,
  applied: readonly OutcomeEffect[], variantExtra: readonly [least: number, most: number]): [least: number, most: number] {
  if (action.awaitSupport) return [ev.timeBase, ev.timeBase];
  const time = (movement: number, extra: number) => {
    const proposed = (ev.timeBase - movement) * RESOLUTION_TUNING.bandTime[band] + extra;
    return round1(Math.max(0.5, proposed));
  };
  const extra = extraOf(applied);
  return [time(ev.storyMovementMinutes ?? 0, extra + variantExtra[0]), time(0, extra + variantExtra[1])];
}

const ownerTaken = (owner: string, effects: readonly OutcomeEffect[]) =>
  effects.some(effect => effect.personHarm?.some(harm => harm.personId === owner) || effect.setFlags?.some(flag => flag === `safe:${owner}` || flag === `out:${owner}`));

/** Harm a clock running out during this band does to its owner (ClockDef.onOut), as the commit
 * applies it after the band's own outcome (clockOutEffects): the clock passes zero over the band's
 * minutes, its owner is still inside after the outcome, and the outcome doesn't already hurt them.
 * `sure`: whatever the minutes come to and whatever is drawn; `maybe`: only for some. */
export function clockOutHarm(scenario: ScenarioDefinition, run: OperationRun, minutes: readonly [number, number], applied: readonly OutcomeEffect[],
  variants: readonly (readonly { p: number; effects: readonly OutcomeEffect[] }[])[]): { sure: string[]; maybe: string[] } {
  const sure: string[] = [], maybe: string[] = [];
  if (!run.clocks || !scenario.clocks?.length) return { sure, maybe };
  for (const def of scenario.clocks) {
    const owner = def.owner, severity = def.onOut?.harm, before = run.clocks[def.id];
    if (!owner || !severity || !before || before.value <= 0) continue;
    const outAfter = (t: number) => stepClock(def, before, t, run.flags).value <= 0;
    if (!outAfter(minutes[1])) continue;
    // Flags after the outcome: an outcome that gets the owner out stops the harm; one that hurts
    // them owns it.
    const flags = new Set(run.flags);
    for (const effect of applied) { for (const f of effect.setFlags ?? []) flags.add(f); for (const f of effect.clearFlags ?? []) flags.delete(f); }
    if (flags.has(`safe:${owner}`) || flags.has(`out:${owner}`) || ownerTaken(owner, applied)) continue;
    const possible = variants.filter(results => results.length > 0);
    if (!possible.every(results => results.some(result => result.p > 0 && !ownerTaken(owner, result.effects)))) continue;
    const words = `${firstName(scenario, owner)} ${HARM_WORD[severity]}`;
    const always = outAfter(minutes[0]) && possible.every(results => results.every(result => result.p <= 0 || !ownerTaken(owner, result.effects)));
    (always ? sure : maybe).push(words);
  }
  return { sure, maybe };
}

// ---------------------------------------------------------------- one band

function bandRoute(s: Session, state: GameState, run: OperationRun, scenario: ScenarioDefinition, action: ActionDefinition, view: ActionView, band: OutcomeBand,
  ev: Pick<Evaluation, 'timeBase' | 'storyMovementMinutes'>, deps: DependencyIndex | null): BandRoute {
  const p = view.likelihood[band];
  const possible = view.eligible && p > 1e-9 && sampleFor(view, band) !== null;
  const indices = matchedOutcomeIndices(action, band, run, scenario);
  const list = action.outcomes[band];
  const applied = indices.map(index => list[index]);
  const effects = indices.map(index => {
    const effect = list[index];
    const why = reasonsOf(scenario, action, band, effect, deps);
    return { index, routed: !!routeOf([effect]) || !!effect.drawn, text: effect.text ?? '', writes: writesOf(s, effect), because: why.map(entry => entry.text), why };
  });
  const base = routeOf(applied);
  const dists = drawnDistributionAt(state, view.id, band, [focusSquad(state)]);
  const drawn = dists.map(dist => {
    const effect = list[dist.effect];
    const on = !effect?.drawn ? null : effect.drawn.model === 'incoming_fire' ? effect.drawn.from : effect.drawn.on;
    return {
      effect: dist.effect, model: dist.model, on: on ? firstName(scenario, on) : null,
      results: dist.results.map(result => {
        // The drawn effect's own lines plus the chosen variant's, in place of the effect alone.
        const variant = effect?.variants?.[result.key] ?? [];
        const routed = routeOf(applied.flatMap(entry => entry === effect ? [entry, ...variant] : [entry]));
        return { ...result, to: routed ? targetFor(s, routed) : null, harms: harmsResult(dist.model, result.key) || variant.some(entry => harmOf(scenario, entry).length > 0) };
      }),
    };
  });
  // A clock that runs out over the band's minutes hurts its owner after the outcome (clockOutEffects).
  const variantsOf = dists.map(dist => dist.results.map(result => ({ p: result.p, effects: list[dist.effect]?.variants?.[result.key] ?? [] })));
  const variantExtra = variantsOf.reduce<[number, number]>(([least, most], results) => {
    const extras = results.filter(result => result.p > 0).map(result => extraOf(result.effects));
    return extras.length ? [least + Math.min(...extras), most + Math.max(...extras)] : [least, most];
  }, [0, 0]);
  const clockHarm = clockOutHarm(scenario, run, bandMinutes(scenario, action, ev, band, applied, variantExtra), applied, variantsOf);
  const harm = [...applied.flatMap(effect => harmOf(scenario, effect)), ...clockHarm.sure];
  const writes = new Set(effects.flatMap(effect => effect.writes));
  // A concession command agrees to on a good or mixed result is a promise the engine tracks.
  if (action.authority?.kind === 'concession' && band !== 'adverse') {
    const key = `promise:concession:${action.id}` as StateKey;
    if (!deps || deps.keys.has(key)) writes.add(key);
  }
  return {
    band, p, possible, effects, to: base ? targetFor(s, base) : null, drawn, harm, maybeHarm: clockHarm.maybe, writes: [...writes],
    mayHarm: harm.length > 0 || clockHarm.maybe.length > 0 || drawn.some(entry => entry.results.some(result => result.harms && result.p > 0)),
  };
}

// ---------------------------------------------------------------- choices

const XRAYS = new WeakMap<Frame, { deps: DependencyIndex | null; rows: ChoiceXray[] }>();

/** Every choice offered at this frame, in the player's order (eligible first, then locked; the first
 * five on the screen, the rest behind "Show all"), with what the engine knows about each. Memoized
 * per frame. Empty when the call has ended. */
export function xrayChoices(s: Session, frame: Frame, deps: DependencyIndex | null): ChoiceXray[] {
  const cached = XRAYS.get(frame);
  if (cached && cached.deps === deps) return cached.rows;
  const rows = computeXray(s, frame, deps);
  XRAYS.set(frame, { deps, rows });
  return rows;
}

function computeXray(s: Session, frame: Frame, deps: DependencyIndex | null): ChoiceXray[] {
  const state = frame.state, run = state.activeRun;
  if (!run || run.status !== 'active' || run.stage === 'debrief') return [];
  const scenario = getScenario(run.scenarioId) ?? s.scenario;
  const built = builtFor(run.locationFamilyId, run.locationSeed, run.flags);
  const focus = focusSquad(state);
  const index = choiceIndex(s.tree);
  const ordered = visibleDecisions(frame.views, null, true);
  const shown = new Set(visibleDecisions(frame.views, null, false).map(view => view.id));
  const actions = scenario.stages[run.stage].actions;
  return ordered.flatMap(view => {
    const action = actions.find(entry => entry.id === view.id);
    if (!action) return [];
    const parts = index.get(view.id) ?? { node: nodeAt(state, s.tree) ?? '', choice: view.id };
    // The same evaluation the player's card shows (liveDecisions: previewAction for the focus squad alone).
    const ev = evaluateAction({ state, run, scenario, action, built, acting: [focus], support: [] });
    const groups = CONTRIBUTOR_GROUPS.map(group => {
      const items = ev.contributors.filter(entry => group.sources.includes(entry.source));
      return { id: group.id, label: group.label, total: ROUND(items.reduce((sum, entry) => sum + entry.value, 0)), items };
    }).filter(group => group.items.length > 0);
    const known = new Set(CONTRIBUTOR_GROUPS.flatMap(group => group.sources));
    const other = ev.contributors.filter(entry => !known.has(entry.source));
    if (other.length) groups.push({ id: 'other', label: 'Other', total: ROUND(other.reduce((sum, entry) => sum + entry.value, 0)), items: other });
    const bands = Object.fromEntries(BANDS.map(band => [band, bandRoute(s, state, run, scenario, action, view, band, ev, deps)])) as Record<OutcomeBand, BandRoute>;
    const written = new Set(BANDS.flatMap(band => bands[band].writes));
    const readers = deps ? [...written].flatMap(key => deps.keys.get(key)?.readers.filter(site => site.field !== 'engine') ?? []) : [];
    let req: ReqNode | null = null;
    if (!view.eligible) { try { req = requirementTree(s.tree, { choice: [parts.node, parts.choice] }); } catch { req = null; } }
    return [{
      actionId: view.id, node: parts.node, choice: parts.choice, view, shown: shown.has(view.id) ? 'shown' as const : 'behind-show-all' as const,
      score: ev.score, difficulty: ev.difficulty, margin: ev.margin, groups, bands, readers, req,
      title: view.title, entry: action.authority?.kind === 'entry', force: BANDS.some(band => bands[band].drawn.some(entry => entry.model === 'team_force')),
    }];
  });
}

/** Choices authored at this node that the engine doesn't offer at this state (their `onlyIf` fails
 * here: a mark not set yet, someone not out). Choices this call drops entirely are left out. */
export function notOfferedHere(s: Session, frame: Frame): { actionId: string; node: string; choice: string; title: string }[] {
  const state = frame.state, run = state.activeRun;
  const node = nodeAt(state, s.tree);
  if (!run || !node || run.stage === 'debrief') return [];
  const scenario = getScenario(run.scenarioId) ?? s.scenario;
  const offered = new Set(frame.views.map(view => view.id));
  const index = choiceIndex(s.tree);
  return scenario.stages[run.stage].actions.flatMap(action => {
    const parts = index.get(action.id);
    return parts && parts.node === node && !offered.has(action.id) ? [{ actionId: action.id, node: parts.node, choice: parts.choice, title: action.title }] : [];
  });
}

// ---------------------------------------------------------------- truth and the path

/** The situation's hidden truth, fact by fact, beside what the team knows of it now. */
export function truthStrip(scenario: ScenarioDefinition, run: OperationRun): { fact: string; label: string; truth: boolean; team: 'unknown' | 'reported' | 'confirmed' | 'disproved' }[] {
  return scenario.facts.filter(fact => fact.id.startsWith('f_')).map(fact => ({
    fact: fact.id.slice(2), label: fact.label, truth: fact.truth, team: run.knowledge[fact.id] ?? fact.initial,
  }));
}

/** The natural chance of the drawn results a move settled (`${model}:${key}` entries), read at the
 * state before it. 1 when nothing was drawn. */
export function drawnChance(before: GameState, actionId: string, band: OutcomeBand, drawn: readonly string[]): number {
  if (!drawn.length) return 1;
  const dists = drawnDistributionAt(before, actionId, band, [focusSquad(before)]);
  let p = 1;
  for (const entry of drawn) {
    const at = entry.indexOf(':');
    const model = entry.slice(0, at), key = entry.slice(at + 1);
    const result = dists.find(dist => dist.model === model && dist.results.some(r => r.key === key))?.results.find(r => r.key === key);
    p *= result ? result.p : 0;
  }
  return p;
}

/** The exact chance of the results these picks came out with: the product over steps of the band's
 * natural chance (also for a forced band) and each drawn result's natural chance. Continuations and
 * the failed-response report have no dice. */
export function pathChance(s: Session): { p: number; steps: { pBand: number; pDrawn: number; forced: boolean }[] } {
  const steps = s.frames.slice(1).map((frame, i) => {
    const before = s.frames[i];
    if (!frame.move || frame.band === null || frame.pBand === null) return { pBand: 1, pDrawn: 1, forced: false };
    // The session records the drawn results' natural chance when it knows it; else read it here.
    const recorded = (frame as Frame & { pDrawn?: number | null }).pDrawn;
    const pDrawn = typeof recorded === 'number' ? recorded : drawnChance(before.state, frame.move.actionId, frame.band, frame.drawn);
    return { pBand: frame.pBand, pDrawn, forced: frame.forced };
  });
  return { p: steps.reduce((product, step) => product * step.pBand * step.pDrawn, 1), steps };
}

// ---------------------------------------------------------------- people

const HELD: Record<string, string> = { instrumental: 'held, leverage', expressive: 'held, grievance', incidental: 'held' };
const WEAPON: Record<string, string> = { handgun: 'handgun', long_gun: 'long gun', shotgun: 'shotgun', edged: 'blade', blunt: 'club', improvised: 'improvised weapon', unknown: 'weapon' };

/** The hidden truth about one person, as a short tape tag ("held", "real handgun", "replica shotgun"):
 * their template kind, their weapon, how they are held. Never shown inside the game frame. */
export function personTruth(person: IncidentPersonDef): string {
  if (person.kind === 'subject') {
    if (!person.weapon) return 'unarmed';
    const what = WEAPON[person.weapon.kind] ?? 'weapon';
    return person.weapon.real === 'replica' ? `replica ${what}` : person.weapon.real === 'real' ? `real ${what}` : what;
  }
  if (person.hold) return HELD[person.hold.kind] ?? 'held';
  return ({ hostage: 'held', victim: 'victim', trapped: 'trapped', bystander: 'bystander', reporting_party: 'caller', animal: 'animal' } as Record<string, string>)[person.kind] ?? person.kind;
}

// ---------------------------------------------------------------- the path rail

/** One step of the shown path (and the steps a rewind stepped back over, `ahead`): where it was
 * taken, which choice, how it came out, what was drawn, and the prompt the player read there. */
export interface PathStep { index: number; node: string | null; nodeTitle: string; choiceTitle: string; kind: 'decide' | 'roll' | 'continue' | 'fail';
  band: OutcomeBand | null; drawn: string[]; forced: boolean; prompt: string; ahead: boolean }

export function pathSteps(s: Session): PathStep[] {
  const line = [...s.frames, ...s.ahead];
  return line.slice(1).map((frame, i) => {
    const before = line[i].state;
    const node = nodeAt(before, s.tree);
    const tree = node ? s.tree.nodes.find(entry => entry.id === node) : undefined;
    const actionId = frame.move?.actionId ?? '';
    const action = s.scenario.stages.assess.actions.concat(s.scenario.stages.adapt.actions, s.scenario.stages.resolve.actions).find(entry => entry.id === actionId);
    return {
      index: i + 1, node, nodeTitle: tree ? humanizeNode(tree).title : 'Next stage', kind: frame.move?.kind ?? 'decide',
      choiceTitle: action?.title ?? (frame.move?.kind === 'fail' ? 'Failed response' : actionId),
      band: frame.band, drawn: frame.drawn, forced: frame.forced, prompt: stageProgress(before).prompt, ahead: i + 1 >= s.frames.length,
    };
  });
}

// ---------------------------------------------------------------- ended calls and the state panel

/** How an ended call came out: its ending, run class, the debrief's scored disposition beside the
 * authored one (they differ when people's end states say so), and the score lines. */
export function endedSummary(s: Session, state: GameState): { ending: RouteTarget; weight: Weight; disposition: string | null; authored: string | null;
  lines: { text: string; trust: number }[] } | null {
  const run = state.activeRun;
  if (!run?.endingId) return null;
  const debrief = pendingDebrief(state);
  return {
    ending: targetFor(s, { ending: run.endingId }), weight: weigh(s.tree, state).weight,
    disposition: debrief?.disposition ?? null, authored: s.tree.endings[run.endingId]?.disposition ?? null,
    lines: (debrief?.scoreLines ?? []).map(line => ({ text: line.text, trust: line.trust })),
  };
}

/** The keys set so far at a state (marks, people out safe or out of the building), each with how
 * many later lines read it. */
export function keysSet(s: Session, state: GameState, deps: DependencyIndex | null): { key: StateKey; label: string; readers: number }[] {
  const flags = state.activeRun?.flags ?? [];
  const keys = new Set<StateKey>();
  for (const flag of flags) {
    if (flag.startsWith('mark:')) keys.add(flag as StateKey);
    else if (flag.startsWith('safe:')) keys.add(`safe:${roleOf(s, flag.slice(5))}`);
    else if (flag.startsWith('out:') && !flags.includes(`safe:${flag.slice(4)}`)) keys.add(`out:${roleOf(s, flag.slice(4))}`);
  }
  return [...keys].map(key => {
    const entry = deps?.keys.get(key);
    return { key, label: entry?.label ?? key.slice(key.indexOf(':') + 1).replace(/_/g, ' '), readers: entry?.readers.filter(site => site.field !== 'engine').length ?? 0 };
  });
}

/** Each running clock as the engine reads it: value, low and out, the true minutes left at its rate
 * (the team may not know the rate), and the last cue heard. */
export function clockRows(scenario: ScenarioDefinition, run: OperationRun): { id: string; label: string; value: number; low: boolean; out: boolean; stopped: boolean;
  minutesLeft: number | null; rateKnown: boolean; latest: string | null }[] {
  return clockViews(scenario, run).map(view => {
    const def = scenario.clocks?.find(entry => entry.id === view.id);
    const rate = def?.ratePerMin ?? 0;
    return { id: view.id, label: view.label, value: view.value, low: view.low, out: view.out, stopped: view.stopped,
      minutesLeft: rate > 0 ? Math.max(0, Math.round(view.value / rate)) : null, rateKnown: !!def?.rateKnown, latest: view.latest };
  });
}

/** The X-ray rows with the run class of each ending a band or drawn result reaches, once known
 * (`weights`: `${actionId}|${band}` for a band, `${actionId}|${band}|${key}` for a drawn result; the
 * Play surface fills it from forced steps at idle time). Rows without a known class come back as is. */
export function withWeights(rows: readonly ChoiceXray[], weights: ReadonlyMap<string, Weight>): ChoiceXray[] {
  if (!weights.size) return [...rows];
  const weighed = (to: RouteTarget | null, key: string): RouteTarget | null => to?.kind === 'ending' && weights.has(key) ? { ...to, weight: weights.get(key)! } : to;
  return rows.map(x => ({
    ...x,
    bands: Object.fromEntries(BANDS.map(band => {
      const route = x.bands[band];
      const drawn = route.drawn.map(entry => ({ ...entry, results: entry.results.map(result => ({ ...result, to: weighed(result.to, `${x.actionId}|${band}|${result.key}`) })) }));
      // A band that draws has the run class of its drawn results: one class only when every result
      // that can come out ends here with that class, else none (the results carry theirs).
      let to = weighed(route.to, `${x.actionId}|${band}`);
      if (to?.kind === 'ending' && drawn.length === 1) {
        const ending = to.ending;
        const classes = new Set(drawn[0].results.filter(result => result.p > 0).map(result => result.to?.kind === 'ending' && result.to.ending === ending ? result.to.weight : undefined));
        const [only] = classes;
        if (classes.size === 1 && only) to = { ...to, weight: only };
      }
      return [band, { ...route, to, drawn }];
    })) as Record<OutcomeBand, BandRoute>,
  }));
}

/** What still needs a forced step to learn its run class: each band of an eligible choice that ends
 * the call and draws nothing, and each drawn result that ends it, as the keys withWeights reads. A
 * band that draws is never weighed as a whole: one forced step settles one drawn result, whose class
 * the band's other results needn't share. */
export function weightsWanted(rows: readonly ChoiceXray[], aiming: boolean): { key: string; actionId: string; band: OutcomeBand; drawn: string[] | null }[] {
  return rows.flatMap(x => !x.view.eligible ? [] : BANDS.flatMap(band => {
    const route = x.bands[band];
    if (!route.possible) return [];
    const own = route.to?.kind === 'ending' && route.drawn.length === 0
      ? [{ key: `${x.actionId}|${band}`, actionId: x.actionId, band, drawn: null }] : [];
    const drawn = aiming && route.drawn.length === 1 ? route.drawn[0].results.filter(result => result.to?.kind === 'ending' && result.p > 0)
      .map(result => ({ key: `${x.actionId}|${band}|${result.key}`, actionId: x.actionId, band, drawn: [result.key] })) : [];
    return [...own, ...drawn];
  }));
}

/** The steps taken in the player's game before a handed-over session's first frame, titled. */
export function priorSteps(s: Session): { nodeTitle: string; choiceTitle: string; band: OutcomeBand; drawn: string[] }[] {
  const actions = s.scenario.stages.assess.actions.concat(s.scenario.stages.adapt.actions, s.scenario.stages.resolve.actions);
  return s.prior.map(step => {
    const node = s.tree.nodes.find(entry => entry.id === step.node);
    return { nodeTitle: node ? humanizeNode(node).title : step.node, choiceTitle: actions.find(entry => entry.id === step.actionId)?.title ?? step.choice, band: step.band, drawn: step.drawn };
  });
}
