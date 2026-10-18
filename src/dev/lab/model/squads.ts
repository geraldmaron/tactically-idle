// The lab's squads (spec 3.2, Director "Squad"): the reference squad is day-one squad A of a campaign
// seed (719 by default: Singh, Aung, Vann, Moretti), with lab cert grants to its first officer, so a
// choice behind a cert no day-one squad holds (rescue's vehicle operations) can be played. A call
// opened from the game keeps the game's own squads instead. Every start goes through the content
// gates' driver, so the run is the engine's own.
import { startGateRun } from '../../../gen/incident/gates/engine-driver';
import type { GameState, SquadId } from '../../../sim/types';
import type { SquadSpec } from '../jobs/protocol';
import type { Kit, LabUrl } from '../types';
import { KIT_ITEMS_FULL } from './call';
import type { SquadSource } from './session';
import { isCertId } from '../../../content/certs';

/** "vehicle_operations" → "vehicle operations", as the call strip writes grants. */
export const certWords = (cert: string): string => cert.replace(/_/g, ' ');

/** The reference squad the URL asks for: campaign seed and lab grants (known certs only, once each). */
export function squadOf(u: LabUrl): SquadSpec {
  return { seed: u.squad, certs: [...new Set(u.certs.filter(isCertId))] };
}

/** A fresh run of the call for this squad and kit: startGateRun(id, seed, { items, certs }). 'day1'
 * stocks what a new department can field; 'full' every non-support item; 'none' nothing. */
export function startCall(scenarioId: string, kit: Kit, squad: SquadSpec): GameState {
  const certs = squad.certs.filter(isCertId);
  return startGateRun(scenarioId, squad.seed, { ...(kit === 'full' ? { items: KIT_ITEMS_FULL } : kit === 'none' ? { items: [] } : {}), ...(certs.length ? { certs } : {}) });
}

/** The squad a run's choices are offered to: the first deployed squad in roster order, as the
 * game's live screen picks it when the player has not chosen one (ui/screens/live-model.ts). */
export function focusSquad(state: GameState): SquadId {
  const run = state.activeRun;
  return (run && state.squads.find(squad => run.squadIds.includes(squad.id))?.id) ?? 'A';
}

/** What the Director's squad section shows: "Squad A (719) + vehicle operations (lab grant)" or
 * "Your squad (from game)", each officer with the certs they hold, and the lab grants that took. */
export function squadLine(state: GameState, source: SquadSource): { label: string; officers: { id: string; name: string; certs: string[] }[]; grants: string[] } {
  const deployed = source.kind === 'game' && state.activeRun ? state.activeRun.squadIds : ['A'];
  const squads = state.squads.filter(squad => deployed.includes(squad.id));
  const officers = squads.flatMap(squad => squad.officerIds.flatMap(id => {
    const officer = state.officers[id];
    return officer ? [{ id, name: `${officer.firstName} ${officer.surname}`, certs: [...officer.certs] }] : [];
  }));
  if (source.kind === 'game') return { label: 'Your squad (from game)', officers, grants: [] };
  const grants = [...new Set(source.certs.filter(isCertId))];
  const label = `Squad A (${source.seed})${grants.length ? ` + ${grants.map(certWords).join(', ')} (lab grant)` : ''}`;
  return { label, officers, grants };
}
