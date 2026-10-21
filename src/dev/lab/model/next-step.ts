// What happens next under a choice (spec 3.2 full note): one forced step per band, read from the
// engine's own commit ("Player reads after": the result lines and the `Next:` prompt the frame shows),
// and the exact mix of where the choice sends the call, from band odds times drawn-result odds.
// A forced band also fixes the drawn result that follows (engine-odds.md "Forced band"); the preview
// says so and gives each drawn result's natural odds.
import { sampleFor } from '../../../gen/incident/gates/engine-driver';
import { weigh } from '../../../gen/incident/trees-v13/balance';
import type { Weight } from '../../../gen/incident/trees-v13/balance';
import type { DrawnResult } from '../../../sim/drawn-effects';
import { drawnDistributionAt, lastDecisionView } from '../../../sim/operation-selectors';
import type { OutcomeBand } from '../../../sim/types';
import { encodePath } from './call';
import type { LabMove } from './call';
import type { LabUrl } from '../types';
import { seekCallSeed } from './seek';
import { currentFrame, openSession, replayTokens, sessionTokens, stepSession } from './session';
import type { Frame, Session } from './session';
import { focusSquad } from './squads';
import { BANDS, whereIs } from './xray';
import type { ChoiceXray, RouteTarget } from './xray';

/** One band forced at a frame. `reads`: the lines the player reads after it (the decision's recorded
 * consequences, ending with the `Next:` prompt). `weight`: the run class when it ends the call.
 * `drawnFixed`: the drawn result the forced step settled on, with every result's natural odds. Extra
 * fields: `frame` (the state after), `ended`, `drawn` (every drawn result settled). */
export interface BandPreview { band: OutcomeBand; pBand: number; to: RouteTarget | null; reads: string[]; weight: Weight | null;
  drawnFixed: { key: string; label: string; natural: DrawnResult[] } | null; frame: Frame; ended: boolean; drawn: string[] }

/** The session cut at `frame`, so a step goes from there (any frame of the path, or a lone frame). */
export function sessionAt(s: Session, frame: Frame): Session {
  const at = s.frames.indexOf(frame);
  return { ...s, frames: at >= 0 ? s.frames.slice(0, at + 1) : [frame], ahead: [], stopped: null };
}

/** Whether the session aims drawn results (a forced move can carry `drawn` variant keys and the path
 * token keeps them). Read from the token format, so a session without it never sees a drawn button. */
export function aimsDrawn(): boolean {
  const probe = { kind: 'decide', actionId: 'probe', band: 'adverse', drawn: ['none'] } as LabMove & { drawn: string[] };
  try { return encodePath([probe]) !== 'probe~adverse'; } catch { return false; }
}

const PREVIEWS = new WeakMap<Frame, Map<string, BandPreview | null>>();

/** The state after one move from `frame`, read as the player would read it. Null when the engine
 * refuses the move (the choice isn't offered or eligible, or the band can't come out here). */
export function previewMove(s: Session, frame: Frame, move: LabMove): BandPreview | null {
  const key = encodePath([move]);
  let cache = PREVIEWS.get(frame);
  if (!cache) { cache = new Map(); PREVIEWS.set(frame, cache); }
  if (cache.has(key)) return cache.get(key)!;
  const result = computePreview(s, frame, move);
  cache.set(key, result);
  return result;
}

function computePreview(s: Session, frame: Frame, move: LabMove): BandPreview | null {
  const view = frame.views.find(entry => entry.id === move.actionId);
  if (move.kind === 'decide' && (!view?.eligible || !move.band || sampleFor(view, move.band) === null)) return null;
  const next = stepSession(sessionAt(s, frame), move);
  if ('refused' in next) return null;
  const after = currentFrame(next);
  const band = after.band ?? move.band ?? 'favorable';
  const run = after.state.activeRun;
  const ended = !!run && (run.status !== 'active' || run.stage === 'debrief');
  const reads = lastDecisionView(after.state)?.consequences ?? [];
  let drawnFixed: BandPreview['drawnFixed'] = null;
  if (after.drawn.length && move.kind === 'decide') {
    const [first] = after.drawn;
    const at = first.indexOf(':');
    const model = first.slice(0, at), key = first.slice(at + 1);
    const natural = drawnDistributionAt(frame.state, move.actionId, band, [focusSquad(frame.state)]).find(dist => dist.model === model)?.results ?? [];
    drawnFixed = { key, label: natural.find(result => result.key === key)?.label ?? key, natural };
  }
  return {
    band, pBand: view?.likelihood[band] ?? after.pBand ?? 0, to: whereIs(s, after.state), reads,
    weight: ended ? weigh(s.tree, after.state).weight : null, drawnFixed, frame: after, ended, drawn: after.drawn,
  };
}

/** One forced band at a frame. */
export function previewBand(s: Session, frame: Frame, actionId: string, band: OutcomeBand): BandPreview | null {
  return previewMove(s, frame, { kind: 'decide', actionId, band });
}

/** One forced band with its drawn results aimed too (`drawn`: compiled variant keys in effect order),
 * when the session aims drawn results; null otherwise or when the engine refuses it. */
export function previewDrawn(s: Session, frame: Frame, actionId: string, band: OutcomeBand, drawn: string[]): BandPreview | null {
  if (!aimsDrawn()) return null;
  const preview = previewMove(s, frame, { kind: 'decide', actionId, band, drawn } as LabMove);
  // A session that ignores the aim would settle on the band's fixed result: only an exact landing counts.
  return preview && drawn.every(key => preview.drawn.some(entry => entry.endsWith(`:${key}`))) ? preview : null;
}

const targetKey = (to: RouteTarget) => to.kind === 'node' ? `node:${to.node}` : `ending:${to.ending}`;

/** Where the choice sends the call next, exactly: each band's natural chance times each drawn result's
 * chance, summed per target and run class, so each entry carries one true class (an ending's `weight`
 * when it is known). A band that draws is split by its results: by the one that decides the route
 * (team force, cascade), else by its only drawn effect, whose results can end the same way with
 * different classes (nobody hit, an officer hurt). `harm`: some of the entry's mass can harm someone.
 * A band that doesn't move the call counts as staying here (`here`). */
export function nextStep(x: ChoiceXray, here?: RouteTarget | null): { to: RouteTarget; p: number; harm: boolean }[] {
  const stay: RouteTarget = here ?? { kind: 'node', node: x.node, title: 'Stays here' };
  const sums = new Map<string, { to: RouteTarget; p: number; harm: boolean }>();
  const add = (to: RouteTarget | null, p: number, harm: boolean) => {
    if (p <= 0) return;
    const target = to ?? stay;
    const key = `${targetKey(target)}|${target.kind === 'ending' ? target.weight ?? '' : ''}`;
    const entry = sums.get(key);
    if (entry) { entry.p += p; entry.harm ||= harm; } else sums.set(key, { to: target, p, harm });
  };
  for (const band of BANDS) {
    const route = x.bands[band];
    const routing = route.drawn.filter(entry => entry.results.some(result => result.to && (!route.to || targetKey(result.to) !== targetKey(route.to))));
    const split = routing[0] ?? (route.drawn.length === 1 ? route.drawn[0] : null);
    if (!split) { add(route.to, route.p, route.mayHarm); continue; }
    // Harm that doesn't depend on the split's result: the band's own, a clock that can run out, and
    // any other drawn effect's.
    const besides = route.harm.length > 0 || route.maybeHarm.length > 0 || route.drawn.some(entry => entry !== split && entry.results.some(result => result.harms && result.p > 0));
    for (const result of split.results) add(result.to ?? route.to, route.p * result.p, besides || result.harms);
  }
  return [...sums.values()].sort((a, b) => b.p - a.p);
}

// ---------------------------------------------------------------- compare situations

/** The same picks replayed under another situation (spec 0, "Compare situations"): the nearest call
 * seed with that situation and this call's turns and group sizes, the steps that land in the same
 * place, and where the path ends there (or the step that stops there, and why). */
export interface SituationRun { situation: 0 | 1 | 2; call: number | null; changed: string[]; sameUntil: number; steps: number;
  end: RouteTarget | null; stopped: { step: number; why: string } | null; error: string | null }

const placeKey = (to: RouteTarget | null) => !to ? 'none' : to.kind === 'node' ? `node:${to.node}` : `ending:${to.ending}`;

/** Replays this session's path under each other situation. A call opened from the game has no
 * reference draw to vary, so it gets an error row per situation. */
export function compareSituations(s: Session, u: LabUrl): SituationRun[] {
  const others = s.tree.situations.map((_, i) => i as 0 | 1 | 2).filter(v => v !== s.situation);
  const tokens = sessionTokens(s);
  const steps = s.frames.length - 1;
  const here = s.frames.map(frame => placeKey(whereIs(s, frame.state)));
  return others.map((situation): SituationRun => {
    const blank = { situation, call: null, changed: [], sameUntil: 0, steps, end: null, stopped: null };
    if (s.squad.kind === 'game' || !u.call || !s.resolved.spec) return { ...blank, error: 'A call from the game keeps its own draw; compare runs on reference calls.' };
    const found = seekCallSeed(s.tree.type, { family: u.call.family, seed: u.call.seed, tier: u.call.tier, call: s.resolved.spec.seed }, { variant: situation });
    if (!found) return { ...blank, error: `No call seed on this building draws situation ${situation + 1} with the same turns and group sizes.` };
    const opened = openSession({ ...u, call: { ...u.call, call: found.call, id: null }, path: '', handoff: null, hist: '' }, null);
    if (!('frames' in opened)) return { ...blank, call: found.call, error: opened.message };
    const replay = replayTokens(opened, tokens);
    let sameUntil = 0;
    for (let i = 1; i < replay.frames.length && placeKey(whereIs(replay, replay.frames[i].state)) === here[i]; i++) sameUntil = i;
    return { situation, call: found.call, changed: found.changed, sameUntil, steps, end: whereIs(replay, currentFrame(replay).state),
      stopped: replay.stopped ? { step: replay.stopped.step, why: replay.stopped.why } : null, error: null };
  });
}
