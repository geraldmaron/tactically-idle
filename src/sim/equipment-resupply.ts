import { supportVehicle } from './capabilities';
// Contextual field resupply: physical stock may reach a squad only while it is
// still staged outside, before its first tactical decision. Preview and command
// share the same planner; the command never trusts a stale UI allocation.
import { ITEMS } from '../content/items';
import type { GameState, HandlerMap, Id, ItemUnit, SquadId } from './types';
import { projectedCondition } from './equipment';
import { readyUnits, reserveLoadouts, unitEffectiveness } from './inventory';
import { advanceTime } from './operation';
import { availableUnits, builtFor, CERT_LABEL, evaluateAction } from './resolution';
import { actionEquipmentRequirements, operatorQualified, qualifiedOfficers, requiredEquipmentBundle } from './equipment-requirements';
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
  const held = participants.flatMap((squadId) => units[squadId].map((unit) => ({ squadId, unit })));
  const requirements = actionEquipmentRequirements(action);
  const existing = requiredEquipmentBundle({ action, acting, held, stock: [], allowed: ({ squadId, unit }) => operatorQualified(state, squadId, action, ITEMS[unit.itemId]) });
  if (!existing.missing.length) {
    const current = evaluateAction({ state, run, scenario, action, built, acting, support, unitOverride: units });
    return current.eligible ? result(false, 'Required equipment is already equipped')
      : result(false, `Equipment alone will not unlock this action. ${current.reason ?? 'Another requirement is unmet.'}`);
  }
  if (run.history.length > 0) return result(true, 'Stores delivery is only available before the first decision. Use equipped squads or another action.');

  const receivers = acting.filter((sq) => {
    const task = run.squadTasks.find((t) => t.squadId === sq);
    return task?.task === 'Staging' && built.location.zones.some((z) => z.id === task.positionId);
  });
  if (!receivers.length) return result(true, 'The acting squad must still be staged outside to receive equipment.');
  if (participants.length < requirements.minSquads) return result(true, `Equipment alone will not unlock this action. ${action.requires.minSquads?.reason ?? 'This capability needs at least two participating squads'}`);
  const officers = qualifiedOfficers(state, acting, action);
  const missingCerts = requirements.certs.filter((cert) => !officers.some((officer) => officer.certs.includes(cert)));
  if (!officers.length) return result(true, 'Equipment alone will not unlock this action. No acting officer can take part.');
  if (missingCerts.length) return result(true, `Equipment alone will not unlock this action. Needs a ${missingCerts.map((cert) => CERT_LABEL[cert] ?? cert).join(' and a ')} in the acting squads.`);
  for (const group of requirements.groups) {
    const items = group.itemIds.map((id) => ITEMS[id]);
    if (items.length && !items.some((item) => acting.some((squadId) => operatorQualified(state, squadId, action, item)))) {
      const certs = [...new Set(items.flatMap((item) => item.requiresCerts ?? []))];
      return result(true, `Equipment alone will not unlock this action. ${group.label} needs a qualified operator: ${certs.map((cert) => CERT_LABEL[cert] ?? cert).join(' or ')}.`);
    }
  }

  const stock = Object.values(ITEMS).filter((item) => !item.supportOnly)
    .flatMap((item) => readyUnits(state, item.id, time))
    .flatMap((unit) => receivers.map((squadId) => ({ squadId, unit: { ...unit, condition: projectedCondition(state, unit, time) } })));
  // Choose the best current physical condition; a tie retains an authored OR preference.
  const preference = (unit: ItemUnit) => {
    const index = (action.requires.anyTags ?? []).findIndex((tag) => ITEMS[unit.itemId]?.tags.includes(tag));
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  const afterDelivery = { ...run };
  advanceTime(afterDelivery, scenario, minutes);
  let remainingReason: string | null = null;
  const bundle = requiredEquipmentBundle({
    action, acting, held, stock,
    allowed: ({ squadId, unit }) => operatorQualified(state, squadId, action, ITEMS[unit.itemId]),
    compare: (a, b) => b.unit.condition - a.unit.condition || preference(a.unit) - preference(b.unit)
      || a.unit.id.localeCompare(b.unit.id) || receivers.indexOf(a.squadId) - receivers.indexOf(b.squadId),
    accept: (picks) => {
      const unitOverride = Object.fromEntries(participants.map((sq) => [sq, carrying(picks, [sq])])) as Record<SquadId, ItemUnit[]>;
      const evaluation = evaluateAction({ state, run: afterDelivery, scenario, action, built, acting, support, unitOverride });
      if (evaluation.eligible) return null;
      remainingReason = evaluation.reason ?? 'Another requirement is unmet.';
      return remainingReason;
    },
  });
  if (bundle.missing.length) {
    if (remainingReason) return result(true, `Equipment alone will not unlock this action. ${remainingReason}`);
    const requiredItems = new Set(requirements.groups.flatMap((group) => group.itemIds));
    for (const itemId of [...requiredItems]) for (const supply of ITEMS[itemId].supplies ?? []) requiredItems.add(supply.itemId);
    for (const use of requirements.consumes) for (const item of Object.values(ITEMS)) if (item.tags.includes(use.tag)) requiredItems.add(item.id);
    const matching = Object.values(state.units).filter((unit) => requiredItems.has(unit.itemId) && unit.status !== 'scrapped');
    const reasons: string[] = [];
    const reserved = matching.filter((unit) => unit.status === 'reserved' || state.reservations.some((reservation) => reservation.unitId === unit.id)).length;
    const service = matching.filter((unit) => unit.status === 'service').length;
    const unusable = matching.filter((unit) => unit.status === 'expired' || (unit.expiresAt !== null && unit.expiresAt <= time)
      || projectedCondition(state, unit, time) <= ITEMS[unit.itemId].wear.failAt).length;
    if (reserved) reasons.push(`${reserved} already allocated`);
    if (service) reasons.push(`${service} in service`);
    if (unusable) reasons.push(`${unusable} expired or failed`);
    return result(true, `No usable unassigned ${bundle.missing.join(' / ').toLowerCase()} in stores${reasons.length ? ` (${reasons.join(', ')})` : ''}.`);
  }

  const picks = bundle.additions;
  const unitOverride = Object.fromEntries(participants.map((sq) => [sq, carrying(picks, [sq])])) as Record<SquadId, ItemUnit[]>;
  const evaluation = evaluateAction({ state, run: afterDelivery, scenario, action, built, acting, support, unitOverride });
  if (!evaluation.eligible) return result(true, `Equipment alone will not unlock this action. ${evaluation.reason ?? 'Another requirement is unmet.'}`);
  const allocations = receivers.map((squadId) => ({ squadId, unitIds: picks.filter((pick) => pick.squadId === squadId).map((pick) => pick.unit.id) })).filter((allocation) => allocation.unitIds.length > 0);
  if (!allocations.length) return result(false, 'Required equipment is already equipped');
  return {
    needed: true, ok: true, reason: null, minutes, allocations,
    items: picks.map(({ squadId, unit }) => ({ squadId, itemId: unit.itemId, unitId: unit.id, name: ITEMS[unit.itemId].name, serial: unit.serial })),
  };
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
