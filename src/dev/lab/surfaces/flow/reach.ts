// The population every simulated number on Flow and Outcomes uses (spec 3.3, 3.4, section 5 rule 11):
// one scope, one style and one run count from the URL, the reach job that plays it, and the words
// that say what it is. Pure: the React hook in use-reach.ts runs the job.
import type { Policy } from '../../../../gen/incident/trees-v13/balance';
import type { LabJob, StartRef } from '../../jobs/protocol';
import { RUN_DEFAULTS } from '../../jobs/budgets';
import { contentKey } from '../../model/call';
import { styleLabel } from '../../model/label';
import type { Provenance } from '../../model/label';
import { currentFrame, sessionTokens } from '../../model/session';
import type { Session } from '../../model/session';
import { squadLine } from '../../model/squads';
import type { LabUrl, Scope } from '../../types';

/** Runs offered per scope: this call and from this step play one call many times (cheap: about a
 * millisecond a run on the pool); this type plays drawn calls (about 60 ms each), so it counts calls. */
export const RUN_CHOICES: Record<'call' | 'type', readonly number[]> = { call: [400, 1000, 2000, 5000], type: [60, 200, 600] };
/** The CI gate's population size, and this type's default. */
export const TYPE_CALLS = 60;

export interface Population { scope: Scope; style: Policy; runs: number }

/** The population the URL asks for. A run count outside the scope's range (1 to 2,000 calls; 50 to
 * 20,000 runs) falls back to the scope's default. */
export function populationOf(u: LabUrl): Population {
  const type = u.scope === 'type';
  const fits = u.runs !== null && Number.isInteger(u.runs) && (type ? u.runs >= 1 && u.runs <= 2000 : u.runs >= 50 && u.runs <= 20000);
  return { scope: u.scope, style: u.style, runs: fits ? u.runs! : type ? TYPE_CALLS : RUN_DEFAULTS.call };
}

export const SCOPE_WORDS: Record<Scope, Provenance['scope']> = { call: 'this call', step: 'from this step', type: 'this type' };

/** Who plays: the squad the call runs with, named (spec 5 rule 10), or the drawn day-one squads. */
export function whoOf(s: Session, scope: Scope): string {
  if (scope === 'type') return 'day-one squads vary per call';
  return squadLine(s.frames[0].state, s.squad).label;
}

/** The population in words: the provenance a simulated number carries, its plain form
 * ("this call · random style · 2,000 runs") and the header line, which also names the squad. */
export function populationText(pop: Population, who: string, tier: number): { prov: Omit<Provenance, 'face'> & { face: 'sim' }; plain: string; header: string } {
  const scope = SCOPE_WORDS[pop.scope];
  const count = pop.scope === 'type' ? `${pop.runs.toLocaleString('en-US')} calls` : `${pop.runs.toLocaleString('en-US')} runs`;
  const plain = `${scope} · ${styleLabel(pop.style)} · ${count}`;
  const header = pop.scope === 'type' ? `${plain} · tier ${tier} · ${who}` : `${plain} · ${who}`;
  return { prov: { face: 'sim', scope, style: pop.style, runs: pop.runs }, plain, header };
}

/** The population's words with the provenance a share carries set to the runs actually counted:
 * while runs stream in, or after Stop, a tally holds fewer runs than were asked for, and a share must
 * say so (and read "3 of 20 runs" below the count threshold). The plain form and the header keep the
 * request, which the population bar shows with its progress. */
export function countedText(text: ReturnType<typeof populationText>, tally: { runs: number } | null): ReturnType<typeof populationText> {
  return tally && tally.runs !== text.prov.runs ? { ...text, prov: { ...text.prov, runs: tally.runs } } : text;
}

/** Where this call's runs start: a fresh start of the call for the reference squad (replaying `path`
 * for "from this step"), or the exact state when the call came from the game or its history. */
export function startOf(s: Session, u: LabUrl, path: string): StartRef {
  if (s.squad.kind === 'game' || s.prior.length > 0) return { kind: 'state', state: path ? currentFrame(s).state : s.frames[0].state };
  return { kind: 'fresh', scenarioId: s.scenario.id, kit: u.call?.kit ?? 'day1', squad: { seed: u.squad, certs: [...u.certs] }, ...(path ? { path } : {}) };
}

/** Who and what a population plays, without the tuning or the content it runs under: the call (its
 * scenario and kit), the squad with its grants, a game handoff or replayed game moves, the step
 * path for "from this step", the style and the run count; for this type, the type, tier, style and
 * calls. Two tallies with the same key play the same starts with the same dice run by run, so a
 * baseline pairs with now only under the same key (spec 5 rule 6). Engine states aren't hashed: a
 * state start is named by where it came from, so a tuning patch that moves an aimed replay's dice
 * still pairs with the baseline it was pinned against. */
export function populationKey(u: LabUrl, s: Session, pop: Population): string {
  if (pop.scope === 'type') return JSON.stringify(['type', s.tree.type, u.call?.tier ?? 2, pop.style, pop.runs]);
  return JSON.stringify([pop.scope, s.scenario.id, u.call?.kit ?? 'day1', u.squad, [...u.certs].sort(), u.handoff, u.hist,
    pop.scope === 'step' ? sessionTokens(s) : '', pop.style, pop.runs]);
}

export type ReachPlan = { job: LabJob; contentKey: string } | { reason: string };

/** The reach job for this population on this call. "From this step" needs a step that isn't the end. */
export function reachPlan(u: LabUrl, s: Session, pop: Population = populationOf(u)): ReachPlan {
  if (pop.scope === 'type') return { job: { kind: 'reach-type', type: s.tree.type, tier: u.call?.tier ?? 2, style: pop.style, calls: pop.runs }, contentKey: contentKey(s.tree.type) };
  const path = pop.scope === 'step' ? sessionTokens(s) : '';
  if (pop.scope === 'step') {
    const run = currentFrame(s).state.activeRun;
    if (!run || run.status !== 'active' || run.stage === 'debrief') return { reason: 'The call has ended at this step, so there is nothing to play from here. Rewind in Play, or pick This call.' };
  }
  return { job: { kind: 'reach-call', start: startOf(s, u, path), style: pop.style, runs: [0, pop.runs] }, contentKey: s.contentKey };
}
