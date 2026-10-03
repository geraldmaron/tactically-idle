import type { GameState } from './types';
import { budget, boardSummary, recoveryInfo, squadReadiness } from './department-selectors';
import { squadDeployed } from './economy';
import { ROSTER_TUNING } from './roster';
import { standardRadioPlan } from './standard-kit';

export function hqOverview(state: GameState, now: number) {
  const at = Math.max(now, state.department.clockHighWater);
  const officers = Object.values(state.officers);
  const isAvailable = (id: string) => recoveryInfo(state, id, at).blocker === null
    && !(state.officers[id]?.squadId && squadDeployed(state, state.officers[id].squadId!));
  const deployable = officers.filter((officer) => isAvailable(officer.id));
  const fresh = deployable.filter((officer) => officer.stress < 30);
  const squads = state.squads.map((squad) => ({
    ...squadReadiness(state, squad.id, at), name: squad.name,
    fresh: squad.officerIds.filter((id) => state.officers[id] && isAvailable(id) && state.officers[id].stress < 30).length,
    deployed: squadDeployed(state, squad.id),
  }));
  const idle = state.squads.filter((squad) => squad.officerIds.length > 0 && !squadDeployed(state, squad.id));
  const radios = standardRadioPlan(state, idle.map((squad) => squad.id), at);
  return {
    totalOfficers: officers.length, deployable: deployable.length, fresh: fresh.length,
    unavailable: officers.length - deployable.length, strained: deployable.length - fresh.length,
    squads, staffedSquads: squads.filter((squad) => squad.total > 0).length,
    training: officers.filter((officer) => officer.assignment?.kind === 'training').length,
    trainingSlots: state.department.trainingSlots,
    emptySeats: idle.reduce((n, squad) => n + Math.max(0, ROSTER_TUNING.squadSize - squad.officerIds.length), 0),
    radios, board: boardSummary(state, at), budget: budget(state),
  };
}
