// Turns an auto-equip result into prepare-screen state. Pure so it can be tested without the UI.
import type { GameState, Id, ItemUnit, SquadId } from '../../sim/types';
import type { AutoLoadout } from '../../sim/auto-equip';
import type { ActionDefinition } from '../../sim/scenario-types';
import { ITEMS } from '../../content/items';
import { readyUnits } from '../../sim/inventory';
import { projectedCondition } from '../../sim/equipment';
import { actionEquipmentRequirements, operatorQualified, qualifiedOfficers, requiredEquipmentBundle } from '../../sim/equipment-requirements';
import { CERT_LABEL } from '../../sim/resolution';

export type Loadouts = Partial<Record<SquadId, Record<Id, number>>>;
/** Explicit unit picks per squad and item. Editing an item's quantity drops that item's picks. */
export type Explicit = Partial<Record<SquadId, Record<Id, Id[]>>>;
export interface AutoNote {
  lines: string[];
  /** The player changed this squad's loadout after auto-equip filled it. */
  edited: boolean;
}

export interface AutoPlan {
  loadouts: Loadouts;
  explicit: Explicit;
  notes: Partial<Record<SquadId, AutoNote>>;
  /** Total items in the complete target loadouts, including retained choices. */
  total: number;
}

/**
 * Adapt the engine's complete, inventory-checked plan to prepare-screen state.
 * Allocation belongs to autoLoadout so this layer never silently reduces a manual
 * quantity, discards a deliberate zero, or reallocates a unit to another squad.
 */
export function planAuto(args: {
  res: AutoLoadout;
  targets: SquadId[];
  /** Which item a unit belongs to (undefined when the unit no longer exists). */
  itemOf: (unitId: Id) => Id | undefined;
}): AutoPlan {
  const { res, targets, itemOf } = args;
  const out: AutoPlan = { loadouts: {}, explicit: {}, notes: {}, total: 0 };
  for (const sid of new Set(targets)) {
    if (!res.loadouts[sid]) continue;
    const lo = { ...res.loadouts[sid] };
    const ex: Record<Id, Id[]> = {};
    for (const id of res.units[sid] ?? []) {
      const itemId = itemOf(id);
      if (!itemId) continue;
      (ex[itemId] ??= []).push(id);
    }
    out.loadouts[sid] = lo;
    out.explicit[sid] = ex;
    out.notes[sid] = { lines: [...(res.rationale[sid] ?? [])], edited: false };
    out.total += Object.values(lo).reduce((a, b) => a + b, 0);
  }
  return out;
}

/** Public conditions that cannot be assumed before a scenario is deployed. */
function actionPrerequisites(action: ActionDefinition): string[] {
  const prerequisites = [
    ...(action.requires.facts ?? []).map((fact) => fact.reason),
    ...(action.requires.flags ?? []).map((flag) => flag.reason),
    ...(action.requires.openings?.length ? ['The declared opening must provide a usable route'] : []),
    ...(action.requires.env ?? []).map((need) => need === 'cctv' ? 'Working scene cameras and power are required' : 'A keyholder must be available'),
  ];
  const context = action.capabilities;
  if (context?.required?.length) {
    if (context.subjectFactIds?.length) prerequisites.push('Confirm the subject context before using this action');
    if (context.safetyFactIds?.length) prerequisites.push('Confirm the safety of the adjacent area before using this action');
    if (context.required.includes('opening_inspection')) prerequisites.push('Open the declared accessible doorway and establish a usable view first');
    if (context.required.includes('weak_radio_link')) prerequisites.push('Participating squads need a weak working radio link');
    if (context.required.includes('specialist_support')) prerequisites.push('Use a separate supporting squad with a clear visual path');
    if (context.required.includes('permitted_door_access')) prerequisites.push('The declared closed door must support this access method');
  }
  return [...new Set(prerequisites)];
}

/** A deliberate one-click repair of a specific action's missing gear. */
export function planPreparationEquipment(args: {
  state: GameState;
  now: number;
  action: ActionDefinition;
  squadId: SquadId;
  chosen: SquadId[];
  loadouts: Loadouts;
  picks: Partial<Record<SquadId, Record<Id, ItemUnit[]>>>;
}): { loadout: Record<Id, number>; explicit: Record<Id, Id[]>; added: number; label: string; issue: string | null; prerequisites: string[] } {
  const { state, now, action, squadId, chosen, loadouts, picks } = args;
  const time = Math.max(now, state.department.clockHighWater);
  const held = [...new Map(Object.values(picks[squadId] ?? {}).flat().map((unit) => [unit.id, unit])).values()];
  const taken = new Set(chosen.flatMap((sid) => Object.values(picks[sid] ?? {}).flat().map((unit) => unit.id)));
  const prerequisites = actionPrerequisites(action);
  const finish = (added: ItemUnit[], issue: string | null) => {
    const loadout = { ...loadouts[squadId] };
    const explicit: Record<Id, Id[]> = {};
    for (const unit of [...held, ...added]) (explicit[unit.itemId] ??= []).push(unit.id);
    // Only the explicitly requested repair may increase a missing item's quantity.
    // An unsuccessful repair returns the existing choices exactly as supplied.
    if (!issue) for (const [itemId, ids] of Object.entries(explicit)) loadout[itemId] = Math.max(loadout[itemId] ?? 0, ids.length);
    return { loadout, explicit, added: added.length, label: [...new Set(added.map((unit) => ITEMS[unit.itemId].name))].join(' + '), issue, prerequisites };
  };
  if (!chosen.includes(squadId)) return finish([], 'Choose this squad for deployment before equipping it');
  const requirements = actionEquipmentRequirements(action);
  if (new Set(chosen).size < requirements.minSquads) return finish([], action.requires.minSquads?.reason ?? 'This capability needs at least two participating squads');
  const operators = qualifiedOfficers(state, [squadId], action);
  if (!operators.length) return finish([], `No officer in Squad ${squadId} can take part in this action`);
  const missingCerts = requirements.certs.filter((cert) => !operators.some((officer) => officer.certs.includes(cert)));
  if (missingCerts.length) return finish([], `Needs a ${missingCerts.map((cert) => CERT_LABEL[cert] ?? cert).join(' and a ')} in Squad ${squadId}`);
  for (const group of requirements.groups) {
    const items = group.itemIds.map((id) => ITEMS[id]);
    if (items.length && !items.some((item) => operatorQualified(state, squadId, action, item))) {
      const certs = [...new Set(items.flatMap((item) => item.requiresCerts ?? []))];
      return finish([], `Needs a qualified operator for ${group.label}: ${certs.map((cert) => CERT_LABEL[cert] ?? cert).join(' or ')}`);
    }
  }
  const ready = Object.values(ITEMS).filter((item) => !item.supportOnly).flatMap((item) => readyUnits(state, item.id, time));
  const usable = new Set(ready.map((unit) => unit.id));
  const unavailable = held.filter((unit) => !usable.has(unit.id));
  if (unavailable.length) return finish([], `Selected equipment is no longer usable: ${unavailable.map((unit) => unit.serial).join(', ')}. Update those selections first.`);
  const prepared = (unit: ItemUnit) => ({ squadId, unit: { ...unit, condition: projectedCondition(state, unit, time) } });
  const bundle = requiredEquipmentBundle({
    action, acting: [squadId], held: held.map(prepared), stock: ready.filter((unit) => !taken.has(unit.id)).map(prepared),
    allowed: ({ unit }) => usable.has(unit.id) && operatorQualified(state, squadId, action, ITEMS[unit.itemId]),
  });
  if (bundle.missing.length) return finish([], `No unassigned usable ${bundle.missing.join(' / ')} in stock. Buy or service it on the Gear tab.`);
  return finish(bundle.additions.map(({ unit }) => unit), null);
}

/** Match a preparation warning to its action, then inspect physical requirements.
 * Warning prose never decides which equipment requirements exist. */
export function preparationEquipmentFix(args: {
  warning: string;
  actions: ActionDefinition[];
  state: GameState;
  now: number;
  chosen: SquadId[];
  loadouts: Loadouts;
  picks: Partial<Record<SquadId, Record<Id, ItemUnit[]>>>;
}): { sid: SquadId; plan: ReturnType<typeof planPreparationEquipment> } | null {
  const { warning, actions, state, now, loadouts, picks } = args;
  const action = actions.find((candidate) => warning.startsWith(`${candidate.title}:`));
  const chosen = [...new Set(args.chosen)];
  if (!action || !chosen.length) return null;
  const requirements = actionEquipmentRequirements(action);
  if (!requirements.groups.length && !requirements.consumes.length) return null;
  const time = Math.max(now, state.department.clockHighWater);
  const ready = new Set(Object.keys(ITEMS).flatMap((id) => readyUnits(state, id, time).map((unit) => unit.id)));
  // A fully carried physical bundle means this warning is about context or people.
  // Equipment repair must not turn that into a redundant packing suggestion.
  if (chosen.some((sid) => !requiredEquipmentBundle({ action, acting: [sid], stock: [],
    held: Object.values(picks[sid] ?? {}).flat().filter((unit) => ready.has(unit.id)).map((unit) => ({ squadId: sid, unit })),
  }).missing.length)) return null;

  const choices = chosen.map((sid) => ({ sid, plan: planPreparationEquipment({ state, now, action, squadId: sid, chosen, loadouts, picks }) }));
  const complete = choices.find(({ plan }) => !plan.issue && plan.added > 0);
  if (complete) return complete;
  // Prefer a stock shortage on a usable squad to an unrelated qualification
  // blocker on the first squad in the UI. Both remain reviewable, without edits.
  const qualified = (sid: SquadId) => {
    const officers = qualifiedOfficers(state, [sid], action);
    return officers.length > 0 && requirements.certs.every((cert) => officers.some((officer) => officer.certs.includes(cert)))
      && requirements.groups.every((group) => group.itemIds.some((id) => operatorQualified(state, sid, action, ITEMS[id])));
  };
  return choices.find(({ sid, plan }) => plan.issue && qualified(sid))
    ?? choices.find(({ plan }) => plan.issue) ?? null;
}
