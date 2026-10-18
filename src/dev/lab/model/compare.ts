// The compare view (backlog lab-compare): the same call and the same picks under a second instance,
// B, that changes one or more draw fields (building, tier, kit, squad, lab grants). Instance B is
// opened like any lab call and the path is replayed on it, as "Compare situations" does; the rows
// then set the engine's numbers for A and B side by side at the step in focus. Nothing here
// computes odds: chances are each frame's ActionView.likelihood (what the player's card shows) and
// margins and contributor groups are xrayChoices (the engine's evaluateAction). compare.test.ts
// fails if this file imports anything that could compute them itself.
import type { DependencyIndex } from '../../../gen/incident/trees-v13/dependencies';
import type { OutcomeBand } from '../../../sim/types';
import type { CompareDraw, LabUrl } from '../types';
import { familyLabel, KIT_WORDS } from './call';
import { currentFrame, openSession, replayTokens, sessionTokens } from './session';
import type { Frame, Session } from './session';
import { whereIs, xrayChoices } from './xray';
import type { ChoiceXray, RouteTarget } from './xray';

const BANDS: readonly OutcomeBand[] = ['favorable', 'mixed', 'adverse'];

/** One instance's reading of a choice. */
export interface CompareSide { eligible: boolean; reason: string | null; likelihood: Record<OutcomeBand, number>; margin: number; groups: Map<string, { label: string; total: number }> }

/** One choice, paired by action id. `a` or `b` is null when only the other instance offers it here.
 * `delta` is B minus A for each band and the margin, both sides eligible; `groups` lists the
 * contributor groups whose totals differ, B minus A. */
export interface CompareRow { actionId: string; title: string; a: CompareSide | null; b: CompareSide | null;
  delta: { likelihood: Record<OutcomeBand, number>; margin: number } | null; groups: { id: string; label: string; a: number; b: number; delta: number }[] }

/** Where B parts from A. `stopped`: B refused a step of A's path (1-based) with the engine's reason;
 * `elsewhere`: B accepted every step but stands somewhere else at the step in focus. */
export type Divergence = { kind: 'stopped'; step: number; why: string } | { kind: 'elsewhere'; step: number; a: RouteTarget | null; b: RouteTarget | null };

export interface Comparison { changed: string[]; rows: CompareRow[]; divergence: Divergence | null; error: string | null }

/** Words for what B changes, in the order the director lists the draw. */
export function drawChanges(u: LabUrl, vs: CompareDraw): string[] {
  const call = u.call;
  if (!call) return [];
  const out: string[] = [];
  if (vs.family !== undefined && vs.family !== call.family) out.push(`building ${familyLabel(vs.family)}`);
  if (vs.seed !== undefined && vs.seed !== call.seed) out.push(`building seed ${vs.seed}`);
  if (vs.tier !== undefined && vs.tier !== call.tier) out.push(`tier ${vs.tier}`);
  if (vs.kit !== undefined && vs.kit !== call.kit) out.push(`kit ${KIT_WORDS[vs.kit]}`);
  if (vs.squad !== undefined && vs.squad !== u.squad) out.push(`squad seed ${vs.squad}`);
  if (vs.certs !== undefined && vs.certs.join() !== u.certs.join()) out.push(vs.certs.length ? `grants ${vs.certs.join(', ').replace(/_/g, ' ')}` : 'no grants');
  return out;
}

/** The URL of instance B: A's link with B's draw fields, no path, no handoff. */
export function instanceUrl(u: LabUrl, vs: CompareDraw): LabUrl {
  if (!u.call) return u;
  return { ...u, call: { ...u.call, ...vs.family !== undefined ? { family: vs.family } : {}, ...vs.seed !== undefined ? { seed: vs.seed } : {},
    ...vs.tier !== undefined ? { tier: vs.tier } : {}, ...vs.kit !== undefined ? { kit: vs.kit } : {} },
    squad: vs.squad ?? u.squad, certs: vs.certs ?? u.certs, path: '', handoff: null, hist: '', vs: null };
}

const sideOf = (x: ChoiceXray): CompareSide => ({ eligible: x.view.eligible, reason: x.view.reason ?? null, likelihood: x.view.likelihood, margin: x.margin,
  groups: new Map(x.groups.map(group => [group.id, { label: group.label, total: group.total }])) });

const ROUND = (n: number) => Math.round(n * 1000) / 1000;
const placeKey = (to: RouteTarget | null) => !to ? 'none' : to.kind === 'node' ? `node:${to.node}` : `ending:${to.ending}`;

/** Pairs two instances' rows by action id: A's order first, then choices only B offers. */
export function pairRows(a: readonly ChoiceXray[], b: readonly ChoiceXray[]): CompareRow[] {
  const inB = new Map(b.map(x => [x.actionId, x]));
  const inA = new Set(a.map(x => x.actionId));
  const rows = a.map(x => rowOf(x.actionId, x.title, x, inB.get(x.actionId) ?? null));
  for (const x of b) if (!inA.has(x.actionId)) rows.push(rowOf(x.actionId, x.title, null, x));
  return rows;
}

function rowOf(actionId: string, title: string, xa: ChoiceXray | null, xb: ChoiceXray | null): CompareRow {
  const a = xa && sideOf(xa), b = xb && sideOf(xb);
  const both = a && b && a.eligible && b.eligible;
  const delta = both ? { likelihood: Object.fromEntries(BANDS.map(band => [band, ROUND(b.likelihood[band] - a.likelihood[band])])) as Record<OutcomeBand, number>, margin: ROUND(b.margin - a.margin) } : null;
  const groups = !both ? [] : [...new Set([...a.groups.keys(), ...b.groups.keys()])].flatMap(id => {
    const ga = a.groups.get(id)?.total ?? 0, gb = b.groups.get(id)?.total ?? 0;
    const d = ROUND(gb - ga);
    return d === 0 ? [] : [{ id, label: (a.groups.get(id) ?? b.groups.get(id))!.label, a: ga, b: gb, delta: d }];
  });
  return { actionId, title, a, b, delta, groups };
}

/** Compares the call at frame `at` of session `s` (A) with the same picks under `vs` (B). A call
 * opened from the game keeps its own draw and gets an error, as Compare situations does. */
export function compareInstances(s: Session, u: LabUrl, vs: CompareDraw, at: number, deps: DependencyIndex | null): Comparison {
  const changed = drawChanges(u, vs);
  const none: Comparison = { changed, rows: [], divergence: null, error: null };
  if (s.squad.kind === 'game' || !u.call) return { ...none, error: 'A call from the game keeps its own draw; compare runs on reference calls.' };
  const frame: Frame = s.frames[Math.max(0, Math.min(at, s.frames.length - 1))];
  const step = s.frames.indexOf(frame);
  const opened = openSession(instanceUrl(u, vs), null);
  if (!('frames' in opened)) return { ...none, error: `Instance B doesn't open: ${opened.message}` };
  const tokens = sessionTokens({ ...s, frames: s.frames.slice(0, step + 1) });
  const b = replayTokens(opened, tokens);
  if (b.stopped) return { ...none, divergence: { kind: 'stopped', step: b.stopped.step, why: b.stopped.why } };
  const frameB = currentFrame(b);
  const whereA = whereIs(s, frame.state), whereB = whereIs(b, frameB.state);
  const divergence: Divergence | null = placeKey(whereA) === placeKey(whereB) ? null : { kind: 'elsewhere', step, a: whereA, b: whereB };
  return { changed, rows: pairRows(xrayChoices(s, frame, deps), xrayChoices(b, frameB, deps)), divergence, error: null };
}
