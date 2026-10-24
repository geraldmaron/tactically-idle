// Squad state every system reads: whether a squad is out on a call, and the duty an officer recovers on.
import { deployability } from './officer';
import type { GameState, Id, Officer, OperationRun, SquadDuty, SquadId } from './types';

/** Is any member of the squad deployed (assignment or active run)? */
export function squadDeployed(state: GameState, squadId: SquadId): boolean {
  const run = state.activeRun;
  if (run && run.status !== 'closed' && run.squadIds.includes(squadId)) return true;
  const squad = state.squads.find((s) => s.id === squadId);
  if (!squad) return false;
  return squad.officerIds.some((id) => state.officers[id]?.assignment?.kind === 'operation');
}

/** The proactive shift this squad is on, if any (save v19). A squad on shift is busy, not on standby: its
 * officers carry the 'proactive' assignment, so deployability already refuses them with a reason. */
export function squadShift(state: Pick<GameState, 'world'>, squadId: SquadId): { id: Id; districtId: string; endsAt: number } | null {
  const shift = state.world?.shifts.find((s) => s.squadId === squadId && s.stoppedAt === undefined);
  return shift ? { id: shift.id, districtId: shift.districtId, endsAt: shift.endsAt } : null;
}

/** Why a squad cannot take a call or another assignment right now, or null. */
export function squadBusyReason(state: GameState, squadId: SquadId): string | null {
  if (squadDeployed(state, squadId)) return 'on a call';
  if (squadShift(state, squadId)) return 'on a proactive shift';
  return null;
}

export function recoveryDuty(state: GameState, o: Officer): SquadDuty {
  const squad = o.squadId ? state.squads.find((s) => s.id === o.squadId) : undefined;
  return squad ? squad.duty : 'rest';
}

/** The officers of a squad who are on this run: the ones Deploy sent, whose assignment is the run.
 * Officers who weren't ready stayed home (short-squad-deploys): they never act, take strain or count
 * for the run's gear, certs or mentors. Every in-run read of a squad's officers goes through here. */
export function runRoster(state: GameState, run: Pick<OperationRun, 'id'>, squadId: SquadId): Id[] {
  return (state.squads.find((s) => s.id === squadId)?.officerIds ?? [])
    .filter((id) => { const a = state.officers[id]?.assignment; return a?.kind === 'operation' && a.runId === run.id; });
}

/** Who Deploy would send from this squad now, and who stays home and why (deployability). */
export function deployRoster(state: GameState, squadId: SquadId, now: number): { goes: Id[]; staysHome: { officerId: Id; reason: string }[] } {
  const goes: Id[] = [], staysHome: { officerId: Id; reason: string }[] = [];
  const t = Math.max(now, state.department.clockHighWater);
  for (const id of state.squads.find((s) => s.id === squadId)?.officerIds ?? []) {
    const o = state.officers[id];
    if (!o) continue;
    const d = deployability(o, t);
    if (d.ok) goes.push(id); else staysHome.push({ officerId: id, reason: d.reason });
  }
  return { goes, staysHome };
}
