// A proactive shift stopped (the world lane calls recordShiftFact): the officers who rode it get a `shift`
// fact, and their bonds drift together when it went well or apart when it stopped for strain. Both scale with
// the time actually served: a shift recalled at once leaves no memory and moves no bond.
import type { GameState, Id } from '../types';
import { DISTRICT_PLACE } from '../../content/people/facts';
import { applyShiftBonds } from './bonds';
import { employed } from './core';
import { recordFact } from './memory';
import { HOUR_MS, PEOPLE_TUNING } from './tuning';

export function recordShiftFact(d: GameState, shiftId: Id): void {
  const shift = d.world.shifts.find((s) => s.id === shiftId);
  if (!shift) return;
  // Once per shift: a second call changes nothing.
  if (d.people.facts.some((f) => f.runId === shiftId && f.kind === 'shift')) return;
  // The people who rode it, as recorded when it started: not whoever is in the squad now.
  const roster = shift.officerIds ?? d.squads.find((s) => s.id === shift.squadId)?.officerIds ?? [];
  const ids = roster.filter((id) => employed(d, id)).sort();
  if (!ids.length) return;
  const at = shift.stoppedAt ?? shift.endsAt;
  const served = Math.max(0, at - shift.startedAt);
  // Near-zero service leaves nothing behind. Past that the hours are what was worked, rounded down, with one
  // hour the least a real shift reads.
  if (served < PEOPLE_TUNING.shiftMinServedMs) return;
  const hours = Math.max(1, Math.floor(served / HOUR_MS));
  const place = DISTRICT_PLACE[shift.districtId];
  for (const id of ids) {
    const others = ids.filter((o) => o !== id);
    recordFact(d, { officerId: id, kind: 'shift', at, place, with: others, runId: shiftId, slots: { hours, colleague: others[0] ? d.officers[others[0]]?.surname : undefined } });
  }
  applyShiftBonds(d, ids, shift.stopReason, place, at, undefined, Math.min(1, served / PEOPLE_TUNING.shiftFullServedMs));
}
