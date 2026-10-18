// One call opened on the real engine (spec 2.3, 3.2): the call the URL draws (or the exact game state
// "Open in lab" handed over), started for the reference squad or the game's own, and every frame
// since: the engine state after each move, the choices the player sees there (liveDecisions, the
// game's own chain), and the band, its natural chance and the drawn results of the move that led
// there. Stepping, rewinding and replaying a path all go through the content gates' driver, so a
// forced band is applied only when the engine produces it and nothing here simulates a result.
//
// A session is immutable: every call returns a new one. `frames` is the path being shown (frames[0]
// is the start, each later frame one move); `ahead` keeps the frames a rewind stepped back over, so
// stepping forward again (or replaying a longer link) reuses them without recomputing.
import { callTreeAt } from '../../../content/call-trees';
import type { CallTree } from '../../../content/call-trees/types';
import { INCIDENT_TEMPLATES, templateAt } from '../../../content/incidents';
import type { IncidentTemplate } from '../../../content/incidents/types';
import { parseIncidentId } from '../../../gen/incident';
import { applyMove, applyNaturalMove, drawnAt, drawnChance, NOW, sampleFor } from '../../../gen/incident/gates/engine-driver';
import { instanceOf } from '../../../gen/incident/instance';
import type { IncidentInstance } from '../../../gen/incident/instance';
import { memberCounts, textBinder, TREE_STARTED } from '../../../gen/incident/trees-v13/compile';
import { choiceIndex } from '../../../gen/incident/trees-v13/graph';
import type { DrawnDistribution } from '../../../sim/drawn-effects';
import { buildLocation } from '../../../sim/location';
import { getScenario } from '../../../sim/scenario-registry';
import type { ScenarioDefinition } from '../../../sim/scenario-types';
import { tuningHash } from '../../../sim/tuning';
import type { ActionView, BuiltLocation, DecisionResolution, GameState, OutcomeBand, SquadId } from '../../../sim/types';
import type { LabHandoff } from '../../../ui/lab-handoff';
import { liveDecisions } from '../../../ui/screens/live-model';
import type { LabUrl } from '../types';
import { callKey, noTreeNotice } from '../url';
import { contentKey, decodePath, encodePath, resolveScenario } from './call';
import type { LabMove, Resolved } from './call';
import { actionTitle } from './describe';
import { percent } from './label';
import { focusSquad, squadOf, startCall } from './squads';

export type SquadSource = { kind: 'reference'; seed: number; certs: string[] } | { kind: 'game'; at: number };
/** One moment of the call. `views`: liveDecisions for the focus squad (the cards the player sees).
 * For the move that led here: `band` and its natural chance `pBand` at the state before (a forced
 * band keeps its natural chance), the drawn results as `${model}:${key}` (`team_force:firearm:none`,
 * `incoming_fire:wounded`, `cascade:follows+stays`; trees-v13/graph drawnRoute reads them) and
 * `pDrawn`, the natural chance of those results together at the state before (1 when the decision
 * drew nothing; aimed or not, it is the chance the dice give them), and whether the band was
 * forced (`move.drawn` says whether the drawn results were asked for too). The chance of this step
 * is pBand × pDrawn. Continuations and the failed-response report have neither (null). */
export interface Frame { state: GameState; move: LabMove | null; views: ActionView[]; band: OutcomeBand | null;
  pBand: number | null; drawn: string[]; pDrawn: number | null; forced: boolean }
/** A decision taken before the session's first frame: in the player's game (handoff), or replayed
 * from the link's `hist` when the snapshot is gone. */
export interface PriorStep { actionId: string; node: string; choice: string; band: OutcomeBand; drawn: string[] }
/** `key`: callKey plus the tuning hash the call was opened under (a patch change reopens it).
 * `stopped`: the last replay's first refused step (1-based), its token and the engine's reason.
 * Extra fields (spec 9.3 lets owners add them): `ahead` (frames a rewind stepped back over, next
 * first), `focus` (the squad the choices are offered to) and `note` (a plain notice for the shell,
 * e.g. a handoff whose snapshot expired). */
export interface Session { key: string; resolved: Resolved; scenario: ScenarioDefinition; tree: CallTree; template: IncidentTemplate;
  instance: IncidentInstance; counts: Record<string, number>; turnDrawn: Record<string, string>; situation: 0 | 1 | 2;
  contentKey: string; squad: SquadSource; frames: Frame[]; prior: PriorStep[]; stopped: { step: number; token: string; why: string } | null;
  ahead: Frame[]; focus: SquadId; note: string | null }
export type OpenError = { kind: 'generate' | 'old-version' | 'not-call-tree' | 'host-moved'; message: string; movedTo?: number };

const BAND_WORD: Record<OutcomeBand, string> = { favorable: 'well', mixed: 'mixed', adverse: 'badly' };

/** A path token for one move: `actionId~band|roll|continue|fail`, an aimed decision's drawn results
 * after its band (`actionId~adverse/firearm:none/wounded`; model/call.ts encodePath). */
export const moveToken = (move: LabMove): string => encodePath([move]);
const decodeToken = (token: string): LabMove | null => decodePath(token)[0] ?? null;
const sameMove = (a: LabMove | null, b: LabMove): boolean => !!a && moveToken(a) === moveToken(b);

/** The drawn results a committed decision settled, as `${model}:${key}`. */
export const drawnOf = (h: DecisionResolution | undefined): string[] => h?.committed?.drawn?.map(d => `${d.model}:${d.key}`) ?? [];

const situationOf = (index: number): 0 | 1 | 2 => (index === 1 || index === 2 ? index : 0);

/** The `at:` flag's node, the root before `tree:started`, null at an ending. */
export function nodeAt(state: GameState, tree: CallTree): string | null {
  const run = state.activeRun;
  if (!run || run.endingId || run.status !== 'active' || run.stage === 'debrief') return null;
  if (!run.flags.includes(TREE_STARTED)) return tree.root;
  // The newest `at:` flag (an outcome clears the node it leaves, so there is one).
  const flag = [...run.flags].reverse().find(entry => entry.startsWith('at:'));
  const node = flag?.slice(3);
  return node && tree.nodes.some(entry => entry.id === node) ? node : null;
}

function frameOf(state: GameState, move: LabMove | null, before: Frame | null): Frame {
  const views = liveDecisions(state, NOW, focusSquad(state));
  if (!move || !before) return { state, move: null, views, band: null, pBand: null, drawn: [], pDrawn: null, forced: false };
  const decided = move.kind === 'decide' || move.kind === 'roll';
  const h = decided ? state.activeRun?.history.at(-1) : undefined;
  const band = h?.band ?? null;
  const offered = before.views.find(view => view.id === move.actionId);
  const keys = h?.committed?.drawn?.map(record => record.key) ?? [];
  // The drawn results' natural chance, read before the commit as the engine would have drawn them.
  const pDrawn = !band || !offered ? null : keys.length ? drawnChance(drawnAt(before.state, offered, band), keys) : 1;
  return { state, move, views, band, pBand: band && offered ? offered.likelihood[band] : null, drawn: drawnOf(h), pDrawn, forced: move.kind === 'decide' };
}

/** The natural chance of the step that led to this frame (pBand × pDrawn), null for a continuation,
 * the failed-response report or the start. Path chance is the product over frames. */
export const stepChance = (frame: Frame): number | null => frame.pBand === null ? null : frame.pBand * (frame.pDrawn ?? 1);

/** Why the drawn results asked for can't follow this band here, or null when they can (each key a
 * result its effect can settle on with some chance, one key per drawn effect). */
function drawnRefusal(title: string, band: OutcomeBand, dists: readonly DrawnDistribution[], keys: readonly string[]): string | null {
  const word = BAND_WORD[band];
  if (!dists.length) return `${title} draws nothing when it comes out ${word}, so there is no result to choose.`;
  if (dists.length !== keys.length)
    return `${title} draws ${dists.length === 1 ? 'one result' : `${dists.length} results`} when it comes out ${word}; the path names ${keys.length}.`;
  for (const [i, dist] of dists.entries()) if (!dist.results.some(result => result.key === keys[i] && result.p > 0))
    return `${title} can't come out ${word} with "${keys[i]}" here. Possible: ${dist.results.map(result => result.label).join(', ')}.`;
  return null;
}

/** One move from a frame through the engine, or the reason the engine (or the dice) refuses it. */
function advance(scenario: ScenarioDefinition, from: Frame, move: LabMove): Frame | { refused: string } {
  const run = from.state.activeRun;
  if (!run || run.status !== 'active' || run.stage === 'debrief') return { refused: 'The call has ended. Rewind to take another step.' };
  const title = actionTitle(scenario, move.actionId);
  if (move.kind === 'decide' || move.kind === 'roll') {
    const view = from.views.find(entry => entry.id === move.actionId);
    if (!view) return { refused: `${title} isn't offered here.` };
    if (!view.eligible) return { refused: `${title} is locked here: ${view.reason ?? 'the engine refuses it'}` };
    if (move.kind === 'roll') {
      const after = applyNaturalMove(from.state, { kind: 'decide', actionId: view.id }, from.views);
      return after ? frameOf(after, move, from) : { refused: `The engine refused ${title}.` };
    }
    if (!move.band) return { refused: `${title} needs a band to force.` };
    // A band the dice allow in a window too narrow to aim at (sampleFor) can only come by rolling.
    if (sampleFor(view, move.band) === null) return { refused: view.likelihood[move.band] > 1e-9
      ? `${title} comes out ${BAND_WORD[move.band]} only ${percent(view.likelihood[move.band])} of the time at this margin, a window too narrow to force. Roll to take it with the dice.`
      : `${title} can't come out ${BAND_WORD[move.band]} at this margin.` };
    const aimed = move.drawn?.length ? move.drawn : null;
    if (aimed) {
      const refused = drawnRefusal(title, move.band, drawnAt(from.state, view, move.band), aimed);
      if (refused) return { refused };
    }
    const after = applyMove(from.state, { kind: 'decide', actionId: view.id, band: move.band, ...aimed ? { drawn: aimed } : {} }, from.views);
    return after ? frameOf(after, move, from)
      : { refused: `The engine didn't produce ${BAND_WORD[move.band]}${aimed ? ` with ${aimed.join(', ')}` : ''} for ${title}.` };
  }
  const after = applyMove(from.state, { kind: move.kind, actionId: move.actionId });
  return after ? frameOf(after, move, from) : { refused: move.kind === 'fail' ? "The failed-response report isn't available here." : `${title} isn't available here.` };
}

/** Plays tokens from a frame, stopping at the first refused one. */
function playTokens(scenario: ScenarioDefinition, start: Frame[], tokens: readonly string[], offset: number):
  { frames: Frame[]; stopped: Session['stopped'] } {
  const frames = [...start];
  for (let i = 0; i < tokens.length; i++) {
    const move = decodeToken(tokens[i]);
    if (!move) return { frames, stopped: { step: offset + i + 1, token: tokens[i], why: `"${tokens[i]}" isn't a move.` } };
    const next = advance(scenario, frames[frames.length - 1], move);
    if ('refused' in next) return { frames, stopped: { step: offset + i + 1, token: tokens[i], why: next.refused } };
    frames.push(next);
  }
  return { frames, stopped: null };
}

const tokensOf = (text: string): string[] => text.split(',').map(token => token.trim()).filter(Boolean);

/** The game's moves (Open in lab's `hist`) replayed on the reference squad: each decision forced to
 * the game's band and aimed at the game's drawn results. When this squad can't produce one of those
 * results (other gear, another team-force profile), the band alone is forced and the dice settle the
 * rest; `unmatched` counts those steps. */
function replayHistory(scenario: ScenarioDefinition, start: Frame, tokens: readonly string[]): { frames: Frame[]; stopped: Session['stopped']; unmatched: number } {
  const frames = [start];
  let unmatched = 0;
  for (let i = 0; i < tokens.length; i++) {
    const move = decodeToken(tokens[i]);
    if (!move) return { frames, stopped: { step: i + 1, token: tokens[i], why: `"${tokens[i]}" isn't a move.` }, unmatched };
    let next = advance(scenario, frames[frames.length - 1], move);
    if ('refused' in next && move.drawn?.length) {
      const { drawn: _drawn, ...bandOnly } = move;
      next = advance(scenario, frames[frames.length - 1], bandOnly);
      if (!('refused' in next)) unmatched++;
    }
    if ('refused' in next) return { frames, stopped: { step: i + 1, token: tokens[i], why: next.refused }, unmatched };
    frames.push(next);
  }
  return { frames, stopped: null, unmatched };
}

/** A path played on a bare engine state, for a worker that has no session (a reach or explore job
 * that starts "from this step"): the frames, the first being `start`, and the first refused step. */
export function playPath(start: GameState, tokens: string): { frames: Frame[]; stopped: Session['stopped'] } {
  const scenario = start.activeRun ? getScenario(start.activeRun.scenarioId) : null;
  const first = frameOf(start, null, null);
  if (!scenario) return { frames: [first], stopped: tokens ? { step: 1, token: tokensOf(tokens)[0] ?? '', why: 'No call is running in this state.' } : null };
  return playTokens(scenario, [first], tokensOf(tokens), 0);
}

function priorOf(tree: CallTree, history: readonly DecisionResolution[]): PriorStep[] {
  const index = choiceIndex(tree);
  return history.map(h => {
    const parts = index.get(h.actionId);
    return { actionId: h.actionId, node: parts?.node ?? '', choice: parts?.choice ?? h.actionId, band: h.band, drawn: drawnOf(h) };
  });
}

/** Opens the call in focus: the URL's draw (or `id`), or the handed-over game state. Without a
 * snapshot but with the game's `hist`, the game's moves are replayed on the reference squad with
 * their bands and drawn results forced, and become prior steps (the session's `note` says so). The URL `path` is not
 * played here: the shell replays it with replayTokens. */
export function openSession(u: LabUrl, handoff: LabHandoff | null): Session | OpenError {
  if (!u.call) return { kind: 'generate', message: 'No call is in focus.' };
  const draw = handoff ? { ...u.call, id: handoff.scenarioId } : u.call;
  if (draw.id) {
    const spec = parseIncidentId(draw.id);
    if (spec && !callTreeAt(spec.type)) return { kind: 'not-call-tree', message: noTreeNotice(spec.type) };
  } else if (!INCIDENT_TEMPLATES[draw.type]) return { kind: 'not-call-tree', message: noTreeNotice(draw.type) };

  const resolved = resolveScenario({ ...draw, path: '' });
  const { scenario, spec } = resolved;
  if (resolved.error || !scenario || !spec) return { kind: 'generate', message: resolved.error ?? 'The generator returned no call.' };
  const template = templateAt(spec.type);
  if (!template) return { kind: 'not-call-tree', message: noTreeNotice(spec.type) };
  // A drawn building that can't host the call moves it (generateIncident). A link to an issued ID
  // keeps it as the game does; a draw from params says so, because its building seed would mislead.
  const family = scenario.locationFamilyId.split('__')[0];
  if (!draw.id && (family !== spec.familyId || scenario.locationSeed !== spec.buildingSeed)) {
    const sameFamily = family === spec.familyId;
    return { kind: 'host-moved', ...sameFamily ? { movedTo: scenario.locationSeed } : {},
      message: sameFamily ? `This building can't host the call; the generator moved it to seed ${scenario.locationSeed}.`
        : `This building type can't host the call; the generator moved it to ${family} seed ${scenario.locationSeed}.` };
  }
  const built = buildLocation(scenario.locationFamilyId, scenario.locationSeed);
  const instance = instanceOf(scenario, built);
  if (!instance) return { kind: 'not-call-tree', message: noTreeNotice(spec.type) };
  const tree = template.tree;

  let start: GameState, squad: SquadSource, prior: PriorStep[] = [], note: string | null = null;
  if (handoff) {
    start = handoff.state;
    squad = { kind: 'game', at: handoff.at };
    prior = priorOf(tree, handoff.state.activeRun?.history ?? []);
  } else {
    const reference = squadOf(u);
    start = startCall(scenario.id, draw.kit, reference);
    squad = { kind: 'reference', seed: reference.seed, certs: reference.certs };
    if (u.handoff || u.hist) {
      const opening = u.handoff ? 'The game snapshot for this link has expired.' : 'This link carries no game snapshot.';
      const hist = tokensOf(u.hist);
      if (hist.length) {
        const played = replayHistory(scenario, frameOf(start, null, null), hist);
        const index = choiceIndex(tree);
        start = played.frames[played.frames.length - 1].state;
        prior = played.frames.slice(1).flatMap(frame => {
          if (!frame.move || !frame.band) return [];
          const parts = index.get(frame.move.actionId);
          return [{ actionId: frame.move.actionId, node: parts?.node ?? '', choice: parts?.choice ?? frame.move.actionId, band: frame.band, drawn: frame.drawn }];
        });
        const drawnNote = played.unmatched ? ` ${played.unmatched === 1 ? 'One drawn result' : `${played.unmatched} drawn results`} couldn't be matched on this squad and came out as the dice fell.` : '';
        note = `${opening} Replayed your moves on reference squad ${reference.seed} with the same bands and drawn results; odds can differ from your game.${drawnNote}`
          + (played.stopped ? ` Your step ${played.stopped.step} (${actionTitle(scenario, decodeToken(played.stopped.token)?.actionId ?? played.stopped.token)}) isn't offered here, so the replay stops after step ${played.stopped.step - 1}.` : '');
      } else if (u.handoff) note = `${opening} Opened the call on reference squad ${reference.seed}.`;
    }
  }

  return {
    key: `${callKey(u)}|${tuningHash('current')}`, resolved, scenario, tree, template, instance,
    counts: memberCounts(instance.placed), turnDrawn: { ...instance.turns }, situation: situationOf(instance.situation),
    contentKey: contentKey(spec.type), squad, frames: [frameOf(start, null, null)], prior, stopped: null,
    ahead: [], focus: focusSquad(start), note,
  };
}

/** One move. A move equal to the next frame ahead (after a rewind) reuses it; any other move drops
 * what was ahead. Refused with the engine's reason when the choice is not offered, locked, can't
 * produce the forced band, or the call has ended. */
export function stepSession(s: Session, move: LabMove): Session | { refused: string } {
  if (s.ahead.length && sameMove(s.ahead[0].move, move)) return { ...s, frames: [...s.frames, s.ahead[0]], ahead: s.ahead.slice(1), stopped: null };
  const next = advance(s.scenario, currentFrame(s), move);
  if ('refused' in next) return next;
  return { ...s, frames: [...s.frames, next], ahead: [], stopped: null };
}

/** Show frame `to` (0 is the start) without recomputing: earlier frames move to `ahead`, and a `to`
 * past the current frame steps forward through `ahead`. */
export function rewindSession(s: Session, to: number): Session {
  const line = [...s.frames, ...s.ahead];
  const at = Math.max(0, Math.min(line.length - 1, Math.floor(to)));
  return { ...s, frames: line.slice(0, at + 1), ahead: line.slice(at + 1), stopped: null };
}

/** A path token as encodePath writes it: a drawn key typed with `+` or a space reads back with `.`.
 * A token that isn't a move stays as typed, for the refusal to quote. */
const canonicalToken = (token: string): string => { const move = decodeToken(token); return move ? moveToken(move) : token; };

/** Replay a path from the session's start. Tokens are read in canonical form (a trailing comma, a
 * space or a `+` in a drawn key name the same path as sessionTokens writes). Frames already computed
 * for the same leading tokens are reused, and when the session already shows exactly this path it
 * comes back unchanged (the same object), so a caller comparing sessions settles. The first refused
 * token stops the replay, keeping the valid prefix, and is reported in `stopped` with the engine's
 * reason. */
export function replayTokens(s: Session, tokens: string): Session {
  const wanted = tokensOf(tokens).map(canonicalToken);
  const line = [...s.frames.slice(1), ...s.ahead];
  let same = 0;
  while (same < wanted.length && same < line.length && moveToken(line[same].move!) === wanted[same]) same++;
  if (same === wanted.length && same === s.frames.length - 1 && !s.stopped) return s;
  const kept = [s.frames[0], ...line.slice(0, same)];
  if (same === wanted.length) return { ...s, frames: kept, ahead: line.slice(same), stopped: null };
  const played = playTokens(s.scenario, kept, wanted.slice(same), same);
  return { ...s, frames: played.frames, ahead: [], stopped: played.stopped };
}

/** The path shown, as URL tokens. */
export function sessionTokens(s: Session): string {
  return s.frames.slice(1).map(frame => moveToken(frame.move!)).join(',');
}

export function currentFrame(s: Session): Frame {
  return s.frames[s.frames.length - 1];
}

const BUILT = new WeakMap<Session['instance'], BuiltLocation>();
const BINDERS = new WeakMap<Session['instance'], (text: string) => string>();
/** The building the call runs in (memoized per session). */
export function sessionBuilt(s: Session): BuiltLocation {
  let built = BUILT.get(s.instance);
  if (!built) { built = buildLocation(s.scenario.locationFamilyId, s.scenario.locationSeed); BUILT.set(s.instance, built); }
  return built;
}
/** Tree text bound with this call's cast, rooms and place (compile.ts textBinder; memoized per session). */
export function sessionBinder(s: Session): (text: string) => string {
  let bind = BINDERS.get(s.instance);
  if (!bind) { bind = textBinder(s.tree, sessionBuilt(s), s.instance.placed); BINDERS.set(s.instance, bind); }
  return bind;
}
