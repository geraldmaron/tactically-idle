// What the cold open and the founding screen say about the first call, read from the game state. Pure.
import { getScenario } from '../../../sim/scenario-registry';
import { squadReadiness } from '../../../sim/department-selectors';
import { jacketView } from '../../../sim/people/selectors';
import { deployRoster, runRoster } from '../../../sim/squads';
import type { GameState, Id, IncidentCard, Officer } from '../../../sim/types';
import { bestFitSquad } from '../operation-squads';

/** The first call the player is offered: the one running, else the gentlest card on the board (lowest tier,
 * then the one waiting longest). */
export function firstCard(g: GameState, at: number): IncidentCard | null {
  const cards = (g.incidents ?? []).filter((c) => c.expiresAt > at && !c.world);
  return [...cards].sort((a, b) => a.tier - b.tier || a.arrivedAt - b.arrivedAt)[0] ?? null;
}

/** The scenario the cold open is about: the running call, else the first card. */
export function firstScenarioId(g: GameState, at: number): Id | null {
  const run = g.activeRun;
  return run && run.status !== 'closed' ? run.scenarioId : firstCard(g, at)?.id ?? null;
}

/** The officers on the first call: who is on the run, else who the best-fit squad would send. */
export function firstCallOfficers(g: GameState, at: number): Officer[] {
  const run = g.activeRun;
  let ids: Id[] = [];
  if (run && run.status !== 'closed') ids = run.squadIds.flatMap((squadId) => runRoster(g, run, squadId));
  else {
    const best = bestFitSquad(g.squads.map((s) => ({ id: s.id, ...squadReadiness(g, s.id, at) })));
    const squad = g.squads.find((s) => s.id === (best ?? g.squads[0]?.id));
    ids = squad ? deployRoster(g, squad.id, at).goes : [];
  }
  return ids.map((id) => g.officers[id]).filter((o): o is Officer => !!o);
}

/** The first `count` sentences of a text, kept under `max` characters. */
export function firstSentences(text: string | null | undefined, count = 2, max = 240): string {
  if (!text) return '';
  const parts = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/);
  let out = '';
  for (const part of parts.slice(0, count)) {
    if ((out + ' ' + part).trim().length > max && out) break;
    out = `${out} ${part}`.trim();
  }
  return out.length > max ? `${out.slice(0, max - 1).trimEnd()}.` : out;
}

/** The hook for the cold open: the scene before the call, else its summary, in two sentences. */
export function callHook(scenarioId: Id | null): string {
  const def = scenarioId ? getScenario(scenarioId) : undefined;
  return firstSentences(def?.coldOpen ?? def?.summary);
}

/** One radio line from an officer on the call, from their jacket's sample at the radio's ready band. */
export function radioLineFrom(g: GameState, officers: readonly Officer[]): { surname: string; line: string } | null {
  for (const o of officers) {
    const line = jacketView(g, o.id)?.page1.radio?.ready;
    if (line) return { surname: o.surname, line };
  }
  return null;
}
