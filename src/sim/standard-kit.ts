// Standard deployment kit is derived from the selected roster, never a manual
// quantity or a purchase. Saved active runs keep their existing reservations.
import type { GameState, Id, SquadId } from './types';
import { readyUnits } from './inventory';

export type SquadLoadouts = Partial<Record<SquadId, Record<Id, number>>>;
export type SquadUnitPicks = Partial<Record<SquadId, Id[]>>;
export const STANDARD_RADIO = 'radio_kit';

export function radioRequirement(state: GameState, sid: SquadId): number {
  return new Set(state.squads.find((s) => s.id === sid)?.officerIds.filter((id) => state.officers[id]) ?? []).size;
}

/** Select distinct best-condition owned radios for every actual officer. */
export function standardRadioPlan(state: GameState, squadIds: SquadId[], now: number) {
  const stock = readyUnits(state, STANDARD_RADIO, now);
  const loadouts: SquadLoadouts = {};
  const units: SquadUnitPicks = {};
  let required = 0;
  for (const sid of [...new Set(squadIds)].sort()) {
    const quantity = radioRequirement(state, sid);
    loadouts[sid] = { [STANDARD_RADIO]: quantity };
    units[sid] = stock.slice(required, required + quantity).map((unit) => unit.id);
    required += quantity;
  }
  const shortage = Math.max(0, required - stock.length);
  return {
    loadouts, units, required, available: stock.length, shortage,
    issue: shortage > 0
      ? `Standard radios: ${required} officers need ${required} Radio headsets; only ${stock.length} usable (${shortage} short). Buy or service radios on the Gear tab, or deploy fewer officers.`
      : null,
  };
}

/** Radios always follow the roster; every other manual quantity and pick survives. */
export function withStandardRadios(state: GameState, squadIds: SquadId[], loadouts: SquadLoadouts, units: SquadUnitPicks | undefined, now: number) {
  const plan = standardRadioPlan(state, squadIds, now);
  const nextLoadouts = { ...loadouts };
  const nextUnits = { ...units };
  for (const sid of new Set(squadIds)) {
    nextLoadouts[sid] = { ...loadouts[sid], ...plan.loadouts[sid] };
    nextUnits[sid] = [
      ...(units?.[sid] ?? []).filter((id) => state.units[id]?.itemId !== STANDARD_RADIO),
      ...plan.units[sid] ?? [],
    ];
  }
  return { loadouts: nextLoadouts, units: nextUnits, issue: plan.issue };
}
