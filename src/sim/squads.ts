// Squad state every system reads: whether a squad is out on a call, and the duty an officer recovers on.
import type { GameState, Officer, SquadDuty, SquadId } from './types';

/** Is any member of the squad deployed (assignment or active run)? */
export function squadDeployed(state: GameState, squadId: SquadId): boolean {
  const run = state.activeRun;
  if (run && run.status !== 'closed' && run.squadIds.includes(squadId)) return true;
  const squad = state.squads.find((s) => s.id === squadId);
  if (!squad) return false;
  return squad.officerIds.some((id) => state.officers[id]?.assignment?.kind === 'operation');
}

export function recoveryDuty(state: GameState, o: Officer): SquadDuty {
  const squad = o.squadId ? state.squads.find((s) => s.id === o.squadId) : undefined;
  return squad ? squad.duty : 'rest';
}
