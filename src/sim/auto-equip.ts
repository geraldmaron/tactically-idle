// STUB (owned by the engine agent). Export names and signatures are fixed.
import type { GameState, Id, SquadId } from './types';

export interface AutoLoadout {
  loadouts: Partial<Record<SquadId, Record<Id, number>>>;
  /** Exact unit picks, so the prepare screen shows and reserves the same units. */
  units: Partial<Record<SquadId, Id[]>>;
  /** Player-language reasons per squad ('Throw phone → Alpha: Chen is the negotiator'). */
  rationale: Partial<Record<SquadId, string[]>>;
  /** Shortages worth knowing ('Only 1 thermal imager: Bravo goes without'). */
  warnings: string[];
}

export function autoLoadout(_state: GameState, _scenarioId: Id, _squadIds: SquadId[], _now: number): AutoLoadout {
  return { loadouts: {}, units: {}, rationale: {}, warnings: ['Auto-equip not implemented yet'] };
}
