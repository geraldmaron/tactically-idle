import { supportVehicle } from './capabilities';
// Contextual field resupply: physical stock may reach a squad only while it is
// still staged outside, before its first tactical decision. Preview and command
// share the same planner; the command never trusts a stale UI allocation.
import { ITEMS } from '../content/items';
import type { GameState, HandlerMap, Id, ItemUnit, SquadId } from './types';
import { projectedCondition } from './equipment';
import { readyUnits, reserveLoadouts, unitEffectiveness } from './inventory';
import { advanceTime } from './operation';
import { availableUnits, builtFor, evaluateAction, tagNames } from './resolution';
import { getScenario } from './scenario-registry';

export const RESUPPLY_MINUTES = 3;

export interface ResupplyAllocation {
  squadId: SquadId;
  unitIds: Id[];
}

export interface ActionResupplyPlan {
  /** Whether this action is missing a required item or consumable. */
  needed: boolean;
  ok: boolean;
  reason: string | null;
  minutes: number;
  allocations: ResupplyAllocation[];
  /** Exact item/serial summaries, in the same order as the reserved units. */
  items: { squadId: SquadId; itemId: Id; unitId: Id; name: string; serial: string }[];
}

type Pick = { squadId: SquadId; unit: ItemUnit };

export function planActionResupply(
  state: GameState,
  now: number,
  actionId: Id,
  acting: SquadId[],
  support: SquadId[],
): ActionResupplyPlan {
  const run = state.activeRun;
  const vehicle = run ? supportVehicle(state, run) : null;
  const minutes = vehicle?.itemId === 'support_van' ? 2 : RESUPPLY_MINUTES;
  const result = (needed: boolean, reason: string | null): ActionResupplyPlan => ({ needed, ok: false, reason, minutes, allocations: [], items: [] });
  if (!run || run.status !== 'active' || run.stage === 'debrief') return result(false, 'No active operation to equip');
  if (run.practice) return result(false, 'Practice already provides its available equipment');
  const scenario = getScenario(run.scenarioId);
  const action = scenario?.stages[run.stage].actions.find((a) => a.id === actionId);
  if (!scenario || !action) return result(false, 'That option is not available at this stage');
  const participants = [...acting, ...support];
  if (!acting.length || new Set(participants).size !== participants.length || participants.some((id) => !run.squadIds.includes(id))) {
    return result(false, 'Choose distinct deployed acting and support squads');
  }

  const built = builtFor(run.locationFamilyId, run.locationSeed, run.flags);
  const time = Math.max(now, state.department.clockHighWater);
  const usable = (u: ItemUnit) => {
    const def = ITEMS[u.itemId];
    return !!def && unitEffectiveness(u, def) > 0;
  };
  const units = Object.fromEntries(participants.map((sq) => [sq, availableUnits(state, run, sq)
    .map((u) => ({ ...u, condition: projectedCondition(state, u, time) })).filter(usable)])) as Record<SquadId, ItemUnit[]>;
  const carrying = (picks: Pick[], squads: SquadId[]) => squads.flatMap((sq) => [...units[sq], ...picks.filter((p) => p.squadId === sq).map((p) => p.unit)]);
  const hasTag = (list: ItemUnit[], tag: string) => list.some((u) => ITEMS[u.itemId]?.tags.includes(tag));
  const requiredGroups = [...(action.requires.anyTags?.length ? [action.requires.anyTags] : []), ...(action.requires.allTags ?? []).map((tag) => [tag])];
  const missingGear = requiredGroups.some((tags) => !tags.some((tag) => hasTag(carrying([], acting), tag)));
  const consumableTaken = new Set<Id>();
  const missingConsumables = (action.consumes ?? []).some((c) => {
    const pool = carrying([], participants).filter((u) => !consumableTaken.has(u.id) && ITEMS[u.itemId]?.tags.includes(c.tag));
    pool.slice(0, c.qty).forEach((u) => consumableTaken.add(u.id));
    return pool.length < c.qty;
  });
  if (!missingGear && !missingConsumables) return result(false, 'Required equipment is already equipped');
  if (run.history.length > 0) return result(true, 'Stores delivery is only available before the first decision. Use equipped squads or another action.');

  const receivers = acting.filter((sq) => {
    const task = run.squadTasks.find((t) => t.squadId === sq);
    return task?.task === 'Staging' && built.location.zones.some((z) => z.id === task.positionId);
  });
  if (!receivers.length) return result(true, 'The acting squad must still be staged outside to receive equipment.');

  const shortages = new Set<string>();
  const choices = (tags: string[], picks: Pick[]): ItemUnit[] => {
    const taken = new Set(picks.map((p) => p.unit.id));
    // One best unit per compatible item makes alternatives deterministic. A
    // later requirement sees the next unit, never the same physical unit twice.
    return tags.flatMap((tag) => Object.values(ITEMS).filter((def) => !def.supportOnly && def.tags.includes(tag)))
      .filter((def, index, all) => all.findIndex((d) => d.id === def.id) === index)
      .flatMap((def) => readyUnits(state, def.id, time).filter((u) => !taken.has(u.id)).slice(0, 1))
      .map((u) => ({ ...u, condition: projectedCondition(state, u, time) }));
  };
  const shortage = (tags: string[]) => {
    const matching = Object.values(state.units).filter((u) => ITEMS[u.itemId]?.tags.some((tag) => tags.includes(tag)) && u.status !== 'scrapped');
    const reasons: string[] = [];
    const reserved = matching.filter((u) => u.status === 'reserved' || state.reservations.some((r) => r.unitId === u.id)).length;
    const service = matching.filter((u) => u.status === 'service').length;
    const unusable = matching.filter((u) => u.status === 'expired' || (u.expiresAt !== null && u.expiresAt <= time)
      || projectedCondition(state, u, time) <= ITEMS[u.itemId].wear.failAt).length;
    if (reserved) reasons.push(`${reserved} already allocated`);
    if (service) reasons.push(`${service} in service`);
    if (unusable) reasons.push(`${unusable} expired or failed`);
    shortages.add(`No usable unassigned ${tagNames(tags)} in stores${reasons.length ? ` (${reasons.join(', ')})` : ''}.`);
  };

  let variants: Pick[][] = [[]];
  for (const tags of requiredGroups) {
    variants = variants.flatMap((picks) => {
      if (tags.some((tag) => hasTag(carrying(picks, acting), tag))) return [picks];
      const pool = choices(tags, picks);
      if (!pool.length) shortage(tags);
      return pool.flatMap((unit) => receivers.map((squadId) => [...picks, { squadId, unit }]));
    });
  }

  // Bundle every consumed unit required by the selected action. Consumable
  // quantity is counted across acting and supporting squads, as in resolution.
  variants = variants.flatMap((initial) => {
    let picks = [...initial];
    const taken = new Set<Id>();
    for (const c of action.consumes ?? []) {
      let need = c.qty;
      for (const u of carrying(picks, participants)) {
        if (need <= 0) break;
        if (taken.has(u.id) || !ITEMS[u.itemId]?.tags.includes(c.tag)) continue;
        taken.add(u.id);
        need -= 1;
      }
      while (need > 0) {
        const unit = choices([c.tag], picks)[0];
        if (!unit) { shortage([c.tag]); return []; }
        picks = [...picks, { squadId: receivers[0], unit }];
        taken.add(unit.id);
        need -= 1;
      }
    }
    return [picks];
  });
  if (!variants.length) return result(true, [...shortages].join(' ') || 'Required equipment is unavailable');

  const afterDelivery = { ...run };
  advanceTime(afterDelivery, scenario, minutes);
  let remainingReason: string | null = null;
  for (const picks of variants) {
    const unitOverride = Object.fromEntries(participants.map((sq) => [sq, carrying(picks, [sq])])) as Record<SquadId, ItemUnit[]>;
    const ev = evaluateAction({ state, run: afterDelivery, scenario, action, built, acting, support, unitOverride });
    if (!ev.eligible) { remainingReason ??= ev.reason; continue; }
    const allocations = receivers.map((squadId) => ({ squadId, unitIds: picks.filter((p) => p.squadId === squadId).map((p) => p.unit.id) })).filter((p) => p.unitIds.length > 0);
    if (!allocations.length) return result(false, 'Required equipment is already equipped');
    return {
      needed: true, ok: true, reason: null, minutes, allocations,
      items: picks.map(({ squadId, unit }) => ({ squadId, itemId: unit.itemId, unitId: unit.id, name: ITEMS[unit.itemId].name, serial: unit.serial })),
    };
  }
  return result(true, `Equipment alone will not unlock this action. ${remainingReason ?? 'Another requirement is unmet.'}`);
}

export const RESUPPLY_HANDLERS: HandlerMap<'resupplyAction'> = {
  resupplyAction(draft, cmd, ctx) {
    const plan = planActionResupply(draft, ctx.now, cmd.actionId, cmd.actingSquadIds, cmd.supportSquadIds);
    if (!plan.ok) return { ok: false, reason: plan.reason ?? 'Cannot equip this action' };
    const run = draft.activeRun!;
    const explicit = Object.fromEntries(plan.allocations.map((a) => [a.squadId, a.unitIds]));
    const before = draft.reservations.length;
    const reserved = reserveLoadouts(draft, run.id, {}, explicit, ctx.now);
    if (!reserved.ok) return reserved;
    run.reservationIds.push(...draft.reservations.slice(before).map((r) => r.id));
    advanceTime(run, getScenario(run.scenarioId)!, plan.minutes);
    const vehicle = supportVehicle(draft, run);
    (run.resupplies ??= []).push({ minutes: plan.minutes, allocations: plan.allocations, ...(vehicle?.itemId === 'support_van' ? { supportUnitId: vehicle.id } : {}) });
    run.revision += 1;
    return { ok: true };
  },
};
