// What the department is short of for a call on the board, before any squad commits.
//
// Built only from what the player can already see or owns: the kind of call (its authored tree,
// every choice in every situation), the building as drawn, and the department's own officers and
// stock. The call's seed, which draws its hidden situation, cast, weapons and fact truth, is never
// read: `callShortages` takes the call type and building, not the scenario.
import type { CertId, GameState, Id, SquadId } from './types';
import type { ActionDefinition, IncidentType } from './scenario-types';
import { callTreeAt } from '../content/call-trees';
import { ITEMS } from '../content/items';
import { getScenario } from './scenario-registry';
import { actionEquipmentRequirements } from './equipment-requirements';
import { recoveryInfo } from './department-selectors';
import { squadDeployed } from './squads';
import { autoEquipReadyUnits } from './auto-equip';

export type BoardShortage =
  | { kind: 'cert'; id: CertId; /** Officers holding it who could deploy now: always 0 for a shortage. */ have: number }
  | { kind: 'gear'; /** Item name, or the alternatives joined with "or". */ label: string; itemIds: Id[]; need: number; have: number };

/** Standard kit: one radio per officer is packed on every call. */
const STANDARD_KIT = new Set<Id>(['radio_kit']);

/** Officers holding `cert` in a squad that is home, who could deploy now (not injured, recovering, training or out). */
function deployableHolders(state: GameState, cert: CertId, now: number): number {
  const at = Math.max(now, state.department.clockHighWater);
  const home = new Set<SquadId>(state.squads.filter((sq) => !squadDeployed(state, sq.id)).map((sq) => sq.id));
  return Object.values(state.officers).filter((o) => o.squadId && home.has(o.squadId) && o.certs.includes(cert) && recoveryInfo(state, o.id, at).blocker === null).length;
}

/**
 * What one squad must bring for some choice this kind of call can offer: each required
 * qualification, and each required item group or consumable with the count one squad needs.
 * Reads only the authored tree, so it is the same for every call of the type.
 */
export function callNeeds(type: IncidentType): { certs: CertId[]; gear: { itemIds: Id[]; label: string; need: number }[] } {
  const tree = callTreeAt(type);
  const certs: CertId[] = [];
  const gear = new Map<string, { itemIds: Id[]; label: string; need: number }>();
  const add = (itemIds: Id[], label: string, need: number) => {
    const ids = itemIds.filter((id) => !STANDARD_KIT.has(id));
    if (!ids.length) return;
    const key = [...ids].sort().join('|');
    const prev = gear.get(key);
    gear.set(key, { itemIds: ids, label, need: Math.max(need, prev?.need ?? 0) });
  };
  for (const node of tree?.nodes ?? []) for (const choice of node.choices) {
    // The choice's own requirement fields, read the way the engine reads an action's; nothing placed.
    const action = { requires: choice.requires ?? {}, capabilities: choice.capabilities, equipment: choice.equipment } as ActionDefinition;
    const req = actionEquipmentRequirements(action);
    for (const cert of req.certs) if (!certs.includes(cert)) certs.push(cert);
    for (const group of req.groups) add(group.itemIds, group.label, 1);
    for (const use of req.consumes) add(Object.values(ITEMS).filter((i) => i.tags.includes(use.tag)).map((i) => i.id), Object.values(ITEMS).find((i) => i.tags.includes(use.tag))?.name ?? use.tag, use.qty);
  }
  return { certs, gear: [...gear.values()] };
}

/**
 * Shortages for the call `scenarioId` on the board: qualifications no officer who could deploy now
 * holds, then required gear with fewer units ready than one squad needs, each in the order the call
 * lists it. Empty when the department can bring everything.
 */
export function boardShortages(state: GameState, scenarioId: Id, now: number): BoardShortage[] {
  const type = getScenario(scenarioId)?.incident?.type;
  if (!type) return [];
  const needs = callNeeds(type);
  const certs = needs.certs.map((id) => ({ kind: 'cert' as const, id, have: deployableHolders(state, id, now) })).filter((c) => c.have === 0);
  const gear = needs.gear.map((g) => ({ kind: 'gear' as const, ...g, have: g.itemIds.reduce((n, id) => n + autoEquipReadyUnits(state, id, now).length, 0) })).filter((g) => g.have < g.need);
  return [...certs, ...gear];
}
