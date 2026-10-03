// Shared public requirements for planning, preparation, delivery and live gates.
// No inventory mutations, hidden fact truth, people positions or RNG are read.
import { ITEMS } from '../content/items';
import type { ActionDefinition, ScenarioDefinition } from './scenario-types';
import type { BuiltLocation, CapabilityId, GameState, Id, ItemDefinition, ItemUnit, KnowledgeStatus, Officer, SquadId } from './types';
import { highRiskAllowed } from './officer';
import { observationDifficulty } from './environment';
import { centroidOf, standingCandidates } from './spatial-factors';
import { signalBetween } from './spatial';

export const isIntegratedPowerTag = (tag: string) => tag === 'battery';
export const effectiveTags = (tags: string[] = []) => tags.filter((tag) => !isIntegratedPowerTag(tag));
export const effectiveSupplies = (item: ItemDefinition) => (item.supplies ?? []).filter((need) => need.itemId !== 'battery_pack');
export function normalizedActionConsumption(action: ActionDefinition): { tag: string; qty: number }[] {
  const counts = new Map<string, number>();
  for (const c of action.consumes ?? []) if (!isIntegratedPowerTag(c.tag)) counts.set(c.tag, (counts.get(c.tag) ?? 0) + c.qty);
  return [...counts].map(([tag, qty]) => ({ tag, qty }));
}
export interface EquipmentRequirementGroup { itemIds: Id[]; tags: string[]; capability?: CapabilityId; label: string }
export function actionEquipmentRequirements(action: ActionDefinition) {
  const group = (tags: string[]): EquipmentRequirementGroup => ({ tags, itemIds: Object.values(ITEMS).filter((i) => !i.supportOnly && i.tags.some((t) => tags.includes(t))).map((i) => i.id), label: tags.map((tag) => Object.values(ITEMS).find((i) => i.tags.includes(tag))?.name ?? tag).join(' or ') });
  const groups = effectiveTags(action.requires.allTags).map((tag) => group([tag]));
  const any = effectiveTags(action.requires.anyTags);
  // A retired power alternative was automatically supplied by its parent device.
  if (any.length && !action.requires.anyTags?.some(isIntegratedPowerTag)) groups.push(group(any));
  for (const capability of action.capabilities?.required ?? []) groups.push({ capability, tags: [], itemIds: Object.values(ITEMS).filter((i) => !i.supportOnly && i.capabilities?.includes(capability) && (capability !== 'permitted_door_access' || (action.capabilities?.accessMethod === 'charge' ? i.id === 'door_charge' : i.id !== 'door_charge'))).map((i) => i.id), label: capability.replaceAll('_', ' ') });
  return { groups, consumes: normalizedActionConsumption(action), certs: action.requires.certs ?? [], minSquads: Math.max(action.requires.minSquads?.count ?? 1, (action.capabilities?.required ?? []).some((cap) => ['specialist_support', 'weak_radio_link', 'scene_coordination'].includes(cap)) ? 2 : 1) };
}
export function qualifiedOfficers(state: GameState, squads: SquadId[], action: ActionDefinition): Officer[] {
  return [...new Set(squads.flatMap((sid) => state.squads.find((s) => s.id === sid)?.officerIds ?? []))].map((id) => state.officers[id]).filter((o): o is Officer => !!o
    && !(state.activeRun?.scenarioVersion && state.activeRun.scenarioVersion >= 4 && (state.activeRun.officerCasualties?.[o.id] || o.injury && o.injury.until > state.department.clockHighWater))
    && (action.check.kind !== 'execution' || highRiskAllowed(o)));
}
export function operatorQualified(state: GameState, squadId: SquadId, action: ActionDefinition, item: ItemDefinition): boolean {
  return qualifiedOfficers(state, [squadId], action).some((o) => (item.requiresCerts ?? []).every((cert) => o.certs.includes(cert)));
}
export function participantAptitude(officer: Officer, action: ActionDefinition): number {
  const weights = action.check.ratings.filter((r) => r.weight > 0 && (r.key !== 'shooting' || action.check.kind === 'execution'));
  const total = weights.reduce((sum, r) => sum + r.weight, 0) || 1;
  const stress = Math.max(0, Math.min(0.55, ((officer.stress - 15) / 85) * 0.55));
  return weights.reduce((sum, r) => sum + officer.ratings[r.key] * r.weight / total, 0) * (1 - stress);
}
/** Identical cert-holder-first seat ordering for resolution and recommendations. */
export function orderActionParticipants(officers: Officer[], action: ActionDefinition): Officer[] {
  const isCert = (o: Officer) => (action.requires.certs ?? []).some((c) => o.certs.includes(c));
  return [...officers].sort((a, b) => Number(isCert(b)) - Number(isCert(a)) || participantAptitude(b, action) - participantAptitude(a, action) || a.id.localeCompare(b.id));
}

export interface PublicEquipmentContext {
  action: ActionDefinition; scenario: ScenarioDefinition; built: BuiltLocation;
  knowledge?: Record<Id, KnowledgeStatus>; sight?: number; squadCount: number; supportCount: number;
  exteriorStaging?: boolean; radioDeficit?: number; supportAccessible?: boolean;
  /** Future knowledge/door-opening can be a stated prerequisite, never a fabricated fact. */
  planning?: boolean;
}
export function planningEquipmentContext(scenario: ScenarioDefinition, action: ActionDefinition, built: BuiltLocation, squadCount: number): PublicEquipmentContext {
  const subject = centroidOf(built, action.targetId);
  const stands = action.approach === 'none'
    ? built.location.entries.map((id) => ({ at: centroidOf(built, id), spaceId: id }))
    : standingCandidates(built, action.targetId, action.approach === 'window' ? 'outside' : 'inside', action.spatial?.openingId);
  const sight = Math.max(0, ...stands.map((s) => signalBetween(built, s.at, subject, 'visual').transmission));
  return { action, scenario, built, planning: true, sight, squadCount,
    supportCount: action.support ? Math.min(action.support.maxSquads, Math.max(0, squadCount - 1)) : 0,
    exteriorStaging: action.approach !== 'path' || built.location.zones.some((z) => z.id === action.targetId),
    knowledge: Object.fromEntries(scenario.facts.map((f) => [f.id, f.initial])),
  };
}

export interface CapabilityEffect { value: number; minutes: number; group: string; reason: string | null; prerequisites: string[] }
export function capabilityRuleEffect(item: ItemDefinition, cap: CapabilityId, input: PublicEquipmentContext): CapabilityEffect {
  const { action, built, scenario } = input;
  const context = action.capabilities!;
  const out: CapabilityEffect = { value: 0, minutes: 0, group: cap, reason: null, prerequisites: [] };
  const sight = input.sight ?? 1;
  const dark = observationDifficulty(scenario.environment ?? null, false)?.value ?? 0;
  const opening = built.location.openings.find((o) => o.id === context.openingId);
  const ordinary = !!opening && ['door', 'sliding'].includes(opening.type) && ['hollow_core', 'solid_core'].includes(opening.material ?? 'solid_core');
  const usableDoor = !!opening && [opening.a, opening.b].includes(action.targetId) && opening.type === 'door' && opening.material !== 'glass' && !['blocked', 'open'].includes(opening.state);
  const factGate = (ids: Id[] | undefined, label: string, requireList = true) => {
    if (ids?.some((id) => input.knowledge?.[id] === 'disproved')) return `The verified ${label} does not permit this intervention`;
    if ((requireList && !ids?.length) || ids?.some((id) => !['confirmed', 'disproved'].includes(input.knowledge?.[id] ?? 'unknown'))) {
      const message = `${label} must be confirmed`;
      if (input.planning && ids?.length) { out.prerequisites.push(message); return null; }
      return message;
    }
    return null;
  };
  switch (cap) {
    case 'visible_exterior':
      out.group = 'observation_aid'; out.value = 4;
      if (sight < 0.6) out.reason = 'A clear visual path is needed; opaque surfaces block observation';
      else if (dark > 0) out.reason = 'Darkness removes the binocular observation benefit';
      else if (input.exteriorStaging === false) out.reason = 'Binocular observation needs exterior staging';
      break;
    case 'dark_visible_scene':
      out.group = 'scene_lighting'; out.value = Math.min(5, dark);
      if (sight < 0.6) out.reason = 'A scene light cannot illuminate through an opaque barrier';
      else if (dark <= 0) out.reason = 'The scene is already bright; lighting adds no benefit';
      break;
    case 'opening_inspection':
      out.group = 'observation_aid'; out.value = 6;
      if (!opening || !['door', 'doorway', 'sliding'].includes(opening.type) || opening.state === 'blocked') out.reason = 'Inspection needs a declared accessible open doorway; sealed or blocked surfaces cannot be inspected';
      else if (opening.state !== 'open') {
        if (input.planning) out.prerequisites.push('Open the declared accessible doorway first');
        else out.reason = 'Inspection needs a declared accessible open doorway';
      } else if (sight < 0.3) out.reason = 'The accessible opening does not provide a usable view from this position';
      break;
    case 'weak_radio_link':
      out.group = 'radio_recovery'; out.value = Math.min(5, input.radioDeficit ?? (input.planning && input.squadCount >= 2 && input.supportCount > 0 ? 5 : 0));
      if (out.value <= 0) out.reason = 'No weak working radio link to recover; headsets are still required';
      else if (input.planning) out.prerequisites.push('Only helps if participating squads have a weak working radio link');
      break;
    case 'medical_exposure':
      out.group = 'personal_protection'; out.value = 5; out.minutes = context.responseContext === 'constrained' ? 1 : 0;
      if (action.check.kind !== 'medical') out.reason = 'Rescue protection is limited to an exposed medical action';
      break;
    case 'authorized_response':
      out.group = item.category === 'protection' ? 'personal_protection' : 'response_class';
      out.value = item.id === 'light_protection' ? 4 : item.id === 'service_sidearm' ? 3 : item.id === 'compact_carbine' ? 6 : context.responseContext === 'constrained' ? 5 : 2;
      out.minutes = ['compact_carbine', 'response_shotgun'].includes(item.id) ? 1 : 0;
      if (action.check.kind !== 'execution') out.reason = 'Response equipment only contributes to declared protective-response actions';
      break;
    case 'specialist_support':
      out.group = 'response_class'; out.value = 7; out.minutes = 2;
      if (!input.supportCount) out.reason = 'Specialist support needs a separate supporting squad';
      else if (sight < 0.6) out.reason = 'Specialist support needs a clear visual path';
      else out.reason = factGate(context.safetyFactIds, 'adjacent-area check', false) ?? factGate(context.subjectFactIds, 'subject context');
      break;
    case 'less_lethal_device': case 'less_lethal_impact':
      out.group = 'less_lethal_option'; out.value = cap === 'less_lethal_device' ? 4 : 5; out.minutes = cap === 'less_lethal_impact' ? 1 : 0;
      out.reason = factGate(context.safetyFactIds, 'safety of adjacent area') ?? factGate(context.subjectFactIds, 'subject context');
      if (!out.reason && sight < 0.6) out.reason = 'A clear observed scene is required for this authored intervention';
      break;
    case 'permitted_door_access':
      out.group = 'access_option'; out.value = 5;
      if (item.id === 'door_charge') {
        out.minutes = -1;
        if (context.accessMethod !== 'charge') out.reason = 'This action uses a mechanical access tool';
        else if (!usableDoor || !ordinary) out.reason = 'This access token only supports a declared ordinary door; no reinforced, blocked, glazed or wall bypass';
        else out.reason = factGate(context.safetyFactIds, 'safety of adjacent area');
      } else {
        out.minutes = 2;
        if (context.accessMethod !== 'mechanical') out.reason = 'This action requires a single-use fictional access token';
        else if (!usableDoor) out.reason = 'Mechanical access needs a declared closed ordinary or steel door; no blocked-route, glazing or wall bypass';
      }
      break;
    case 'vehicle_exterior': case 'scene_coordination':
      out.group = 'vehicle_support'; out.value = cap === 'vehicle_exterior' ? 8 : 5; out.minutes = cap === 'vehicle_exterior' ? 3 : 2;
      if (!built.location.zones.some((z) => z.id === action.targetId) || context.vehicleAccessible !== true || input.supportAccessible === false) out.reason = 'Vehicle support needs accessible exterior staging; no interior or upper-floor coverage';
      else if (cap === 'scene_coordination' && input.squadCount < 2) out.reason = 'Mobile command support needs at least two participating squads';
      break;
  }
  return out;
}

export interface EquipmentPick { squadId: SquadId; unit: ItemUnit }
/** Reserve a whole required bundle atomically. A tag gate and its consumed unit overlap;
 * different consumption entries/devices claim distinct physical units. */
export function requiredEquipmentBundle(args: {
  action: ActionDefinition; held: EquipmentPick[]; stock: EquipmentPick[]; acting: SquadId[];
  allowed?: (pick: EquipmentPick) => boolean; compare?: (a: EquipmentPick, b: EquipmentPick) => number;
  /** Live callers may reject a completed bundle on public spatial/context gates. */
  accept?: (additions: EquipmentPick[]) => string | null;
}): { additions: EquipmentPick[]; missing: string[] } {
  const req = actionEquipmentRequirements(args.action);
  const allowed = args.allowed ?? (() => true);
  const held = args.held.filter(allowed);
  const stock = args.stock.filter(allowed).sort(args.compare ?? ((a, b) => b.unit.condition - a.unit.condition || a.unit.id.localeCompare(b.unit.id)));
  const attempt = (index: number, additions: EquipmentPick[]): { additions: EquipmentPick[]; missing: string[] } => {
    const all = [...held, ...additions];
    if (index < req.groups.length) {
      const group = req.groups[index];
      let failed: { additions: EquipmentPick[]; missing: string[] } | undefined;
      if (all.some((p) => args.acting.includes(p.squadId) && group.itemIds.includes(p.unit.itemId))) {
        const heldResult = attempt(index + 1, additions);
        if (!heldResult.missing.length) return heldResult;
        failed = heldResult;
      }
      const candidates = stock.filter((p) => args.acting.includes(p.squadId) && group.itemIds.includes(p.unit.itemId) && !all.some((a) => a.unit.id === p.unit.id));
      for (const pick of candidates) { const next = attempt(index + 1, [...additions, pick]); if (!next.missing.length) return next; failed ??= next; }
      return failed ?? { additions: [], missing: [group.label] };
    }
    const demand = [...req.consumes];
    const supplied = new Map<Id, number>();
    // Only tools needed by this action participate in its required supply bundle.
    const requiredTools = new Set<Id>();
    for (const group of req.groups) {
      const pick = all.find((p) => args.acting.includes(p.squadId) && group.itemIds.includes(p.unit.itemId));
      if (pick) requiredTools.add(pick.unit.id);
    }
    for (const pick of all.filter((p) => requiredTools.has(p.unit.id))) for (const need of effectiveSupplies(ITEMS[pick.unit.itemId])) supplied.set(need.itemId, (supplied.get(need.itemId) ?? 0) + need.qty);
    for (const [id, qty] of supplied) {
      const tag = ITEMS[id]?.tags[0];
      if (!tag) continue;
      const existing = demand.find((d) => d.tag === tag);
      if (existing) existing.qty = Math.max(existing.qty, qty); else demand.push({ tag, qty });
    }
    const result = [...additions];
    const claimed = new Set<Id>();
    for (const use of demand) {
      let remaining = use.qty;
      for (const pick of [...held, ...result]) if (remaining > 0 && !claimed.has(pick.unit.id) && ITEMS[pick.unit.itemId]?.tags.includes(use.tag)) { claimed.add(pick.unit.id); remaining--; }
      for (const pick of stock) if (remaining > 0 && !claimed.has(pick.unit.id) && ![...held, ...result].some((p) => p.unit.id === pick.unit.id) && ITEMS[pick.unit.itemId]?.tags.includes(use.tag)) { result.push(pick); claimed.add(pick.unit.id); remaining--; }
      if (remaining > 0) return { additions: [], missing: [`${use.qty} ${Object.values(ITEMS).find((i) => i.tags.includes(use.tag))?.name ?? use.tag}`] };
    }
    const refusal = args.accept?.(result);
    return refusal ? { additions: [], missing: [refusal] } : { additions: result, missing: [] };
  };
  return attempt(0, []);
}

/** Nonterminal actions can happen sequentially even within one stage. Only an
 * unconditional departure/ending, or a shared one-shot flag, makes alternatives. */
export function missionConsumptionBudget(entries: { action: ActionDefinition; consumes: { tag: string; qty: number }[] }[]): { tag: string; qty: number }[] {
  const totals = new Map<string, number>();
  const terminal = new Map<string, number>();
  for (const { action, consumes } of entries) {
    const exits = Object.values(action.outcomes).every((band) => band.some((e) => !e.when && (!!e.ending || (!!e.stage && e.stage !== action.stage))));
    const sharedFlag = (action.requires.notFlags ?? []).find(({ flag }) => Object.values(action.outcomes).every((band) => band.some((e) => !e.when && e.setFlags?.includes(flag))))?.flag;
    for (const c of consumes) {
      const group = exits ? `terminal:${action.stage}:${c.tag}` : sharedFlag ? `flag:${action.stage}:${sharedFlag}:${c.tag}` : null;
      if (group) terminal.set(group, Math.max(terminal.get(group) ?? 0, c.qty));
      else totals.set(c.tag, (totals.get(c.tag) ?? 0) + c.qty);
    }
  }
  for (const [key, qty] of terminal) { const tag = key.split(':').at(-1)!; totals.set(tag, (totals.get(tag) ?? 0) + qty); }
  return [...totals].map(([tag, qty]) => ({ tag, qty }));
}

/** Includes true supplies and directly consumed capability items. The authored
 * consume declaration and the same tool's supply declaration describe one use. */
export function actionConsumptionForItems(action: ActionDefinition, itemIds: Id[]): { tag: string; qty: number }[] {
  const demand = new Map(normalizedActionConsumption(action).map((c) => [c.tag, c.qty]));
  const tools = [...new Set(itemIds)].map((id) => ITEMS[id]).filter(Boolean);
  const supplied = new Map<string, number>();
  for (const item of tools) {
    for (const need of effectiveSupplies(item)) {
      const tag = ITEMS[need.itemId]?.tags[0];
      if (tag) supplied.set(tag, (supplied.get(tag) ?? 0) + need.qty);
    }
    if (item.kind === 'consumable') supplied.set(item.tags[0], Math.max(supplied.get(item.tags[0]) ?? 0, 1));
  }
  for (const [tag, qty] of supplied) demand.set(tag, Math.max(demand.get(tag) ?? 0, qty));
  return [...demand].map(([tag, qty]) => ({ tag, qty }));
}
