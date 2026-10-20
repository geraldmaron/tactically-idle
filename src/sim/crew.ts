// The crew on a call (owner 2026-10-19, the officer-driven layer): the traits and experience bands
// of the officers deployed on a run, set as run flags when the run starts, so a call tree can open a
// choice for an observant officer or write a veteran's result differently (TreeState.crew). Read
// once at the start; an officer hurt mid-call keeps their flag, as the call's story already has them.
import { experienceBand } from './ranks';
import { crewFlag, leadFlag } from './crew-flags';
import { runRoster } from './squads';
import type { GameState, OperationRun } from './types';

/** The crew flags of a run's deployed officers, sorted and unique. */
export function crewFlags(state: GameState, run: Pick<OperationRun, 'id' | 'squadIds' | 'startedAt'>): string[] {
  const out = new Set<string>();
  for (const squadId of run.squadIds) for (const id of runRoster(state, run, squadId)) {
    const officer = state.officers[id];
    if (!officer) continue;
    for (const trait of officer.traits) out.add(crewFlag(trait));
    out.add(crewFlag(`band_${experienceBand(officer)}`));
  }
  return [...out].sort();
}

/** The lead flags for the officer leading a decision: their traits and experience band, so a result
 * can be written for who actually did it (TreeState.lead). Empty when nobody leads. */
export function leadFlags(state: GameState, _run: Pick<OperationRun, 'startedAt'>, officerId: string | undefined): string[] {
  const officer = officerId ? state.officers[officerId] : undefined;
  if (!officer) return [];
  return [...officer.traits.map(leadFlag), leadFlag(`band_${experienceBand(officer)}`)].sort();
}
