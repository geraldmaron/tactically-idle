// All effects below are fictional score/time rules. Only public action context and
// player knowledge are read: compatibility never asks a hidden fact for its truth.
import { CAPABILITIES } from '../content/capabilities';
import { ITEMS } from '../content/items';
import type { ActionDefinition, ScenarioDefinition } from './scenario-types';
import type { BuiltLocation, CapabilityId, Contributor, GameState, Id, ItemUnit, OperationRun, SquadId } from './types';
import type { EvalInput, Use } from './resolution';
import { squadUnits, unitEffectiveness } from './inventory';
import { projectedCondition } from './equipment';
import { observationDifficulty } from './environment';
import { highRiskAllowed } from './officer';
import { resolveSubject, standingOf } from './spatial-factors';
import { practiceSupportUnit } from './support-vehicles';
import { signalBetween } from './spatial';

export interface CapabilityInput {
  state: GameState; run: OperationRun; scenario: ScenarioDefinition; action: ActionDefinition; built: BuiltLocation;
  acting: SquadId[]; support: SquadId[]; units: Partial<Record<SquadId, ItemUnit[]>>;
  existingUses?: Use[];
  /** Best planned public sightline, after moving to the authored vantage. */
  visibility?: number;
  /** Score actually lost from radio links, never a guessed universal buff. */
  radioDeficit?: number;
}
export interface CapabilityResult {
  eligible: boolean; reasons: string[]; contributors: Contributor[]; details: string[];
  uses: Use[]; minutes: number;
  applied: { capabilityId: CapabilityId; itemId: Id; unitId: Id; value: number; group: string; minutes: number }[];
}
interface Candidate { capabilityId: CapabilityId; item: typeof ITEMS[string]; unit: ItemUnit; squadId: SquadId; value: number; group: string; minutes: number; supplies: Use[] }
const round1 = (n: number) => Math.round(n * 10) / 10;
const known = (run: OperationRun, id: Id) => ['confirmed', 'disproved'].includes(run.knowledge[id] ?? 'unknown');

export function capabilityVisibility(input: Pick<CapabilityInput, 'built' | 'run' | 'scenario' | 'action' | 'acting'>): number {
  const subject = resolveSubject(input.scenario, input.built, input.run.knowledge, input.action.targetId, input.action.spatial?.subjectFactId);
  return Math.max(0, ...input.acting.map((sid) => {
    const task = input.run.squadTasks.find((t) => t.squadId === sid);
    if (!task) return 0;
    const at = standingOf(input.built, task).at;
    return signalBetween(input.built, at, subject.at, 'visual').transmission;
  }));
}

/** A qualified driver anywhere in the deployed team may operate the exterior asset. */
export function supportVehicle(state: GameState, run: OperationRun): ItemUnit | null {
  const id = run.supportUnitIds?.[0];
  const unit = id && run.practice && id.startsWith('practice_') ? practiceSupportUnit(id.slice('practice_'.length)) : id ? state.units[id] : undefined;
  if (!unit || !ITEMS[unit.itemId]?.supportOnly || (!run.practice && !state.reservations.some((r) => r.runId === run.id && r.unitId === id))) return null;
  const def = ITEMS[unit.itemId];
  const now = state.department.clockHighWater;
  if ((unit.expiresAt !== null && unit.expiresAt <= now) || unitEffectiveness({ ...unit, condition: projectedCondition(state, unit, now) }, def) <= 0) return null;
  if (!run.squadIds.some((sid) => state.squads.find((s) => s.id === sid)?.officerIds.some((oid) => ['vehicle_operations', ...def.requiresCerts ?? []].every((cert) => (state.officers[oid]?.certs as string[] | undefined)?.includes(cert))))) return null;
  return unit;
}

export function evaluateCapabilities(input: CapabilityInput): CapabilityResult {
  const { state, run, action, built, scenario } = input;
  const context = action.capabilities;
  const out: CapabilityResult = { eligible: true, reasons: [], contributors: [], details: [], uses: [], minutes: 0, applied: [] };
  if (!context) return out;
  const rules = new Set(context.rules);
  const required = new Set(context.required ?? []);
  const candidates: Candidate[] = [];
  const failures = new Map<CapabilityId, string[]>();
  const sight = input.visibility ?? capabilityVisibility(input);
  const dark = observationDifficulty(scenario.environment ?? null, false)?.value ?? 0;
  const exterior = built.location.zones.some((z) => z.id === action.targetId);
  const opening = built.location.openings.find((o) => o.id === context.openingId);
  const ordinaryDoor = !!opening && ['door', 'sliding'].includes(opening.type) && ['hollow_core', 'solid_core'].includes(opening.material ?? 'solid_core');
  const usableDoor = !!opening && [opening.a, opening.b].includes(action.targetId) && opening.type === 'door' && opening.material !== 'glass' && !['blocked', 'open'].includes(opening.state);
  const roster = (squads: SquadId[]) => squads.flatMap((sid) => state.squads.find((s) => s.id === sid)?.officerIds.map((id) => state.officers[id]).filter(Boolean) ?? [])
    .filter((o) => action.check.kind !== 'execution' || highRiskAllowed(o));
  const usedSupplies = new Map<Id, Use>((input.existingUses ?? []).filter((u) => u.consumable).map((u) => [u.unitId, u]));
  const supplyClaimed = new Set<Id>();
  const available = [...new Set([...input.acting, ...input.support])].flatMap((squadId) => (input.units[squadId] ?? []).map((unit) => ({ squadId, unit })));
  // Operation-level support is independent of where the associated lead squad walks.
  const vehicle = supportVehicle(state, run);
  if (vehicle) available.push({ squadId: run.squadIds[0], unit: vehicle });
  const seen = new Set<Id>();
  for (const { squadId, unit } of available) {
    if (seen.has(unit.id)) continue;
    seen.add(unit.id);
    const item = ITEMS[unit.itemId];
    if (!item) continue;
    const effectiveness = unitEffectiveness(unit, item);
    if (effectiveness <= 0 || (unit.expiresAt !== null && unit.expiresAt <= state.department.clockHighWater)) continue;
    if (item.supportOnly && vehicle?.id !== unit.id) continue;
    if (!item.supportOnly && !input.acting.includes(squadId)) continue;
    for (const cap of item.capabilities ?? []) {
      if (!rules.has(cap)) continue;
      const requiredCerts = item.requiresCerts ?? [];
      const qualified = roster(item.supportOnly ? run.squadIds : [squadId]).some((o) => requiredCerts.every((cert) => o.certs.includes(cert)));
      const missing = requiredCerts.length && !qualified ? requiredCerts : [];
      let reason = missing.length ? `Needs qualified operator: ${missing.map((c) => c.replaceAll('_', ' ')).join(', ')}` : null;
      let value = 0, minutes = 0, group = cap as string;
      if (!reason) switch (cap) {
        case 'visible_exterior':
          group = 'observation_aid'; value = 4;
          if (sight < 0.6) reason = 'A clear visual path is needed; opaque surfaces block observation';
          else if (dark > 0) reason = 'Darkness removes the binocular observation benefit';
          else if (!input.acting.some((sid) => built.location.zones.some((z) => z.id === run.squadTasks.find((t) => t.squadId === sid)?.positionId))) reason = 'Binocular observation needs exterior staging';
          break;
        case 'dark_visible_scene':
          group = 'scene_lighting'; value = Math.min(5, dark);
          if (sight < 0.6) reason = 'A scene light cannot illuminate through an opaque barrier';
          else if (dark <= 0) reason = 'The scene is already bright; lighting adds no benefit';
          break;
        case 'opening_inspection':
          group = 'observation_aid'; value = 6;
          if (!opening || !['door', 'doorway', 'sliding'].includes(opening.type) || opening.state !== 'open') reason = 'Inspection needs a declared accessible open doorway; sealed or blocked surfaces cannot be inspected';
          else if (sight < 0.3) reason = 'The accessible opening does not provide a usable view from this position';
          break;
        case 'weak_radio_link':
          group = 'radio_recovery'; value = Math.min(5, input.radioDeficit ?? 0);
          if (value <= 0) reason = 'No weak working radio link to recover; headsets are still required';
          break;
        case 'medical_exposure':
          group = 'personal_protection'; value = 5; minutes = context.responseContext === 'constrained' ? 1 : 0;
          if (action.check.kind !== 'medical') reason = 'Rescue protection is limited to an exposed medical action';
          break;
        case 'authorized_response':
          if (action.check.kind !== 'execution') { reason = 'Response equipment only contributes to declared protective-response actions'; break; }
          group = item.category === 'protection' ? 'personal_protection' : 'response_class';
          value = item.id === 'light_protection' ? 4 : item.id === 'service_sidearm' ? 3 : item.id === 'compact_carbine' ? 6 : context.responseContext === 'constrained' ? 5 : 2;
          minutes = ['compact_carbine', 'response_shotgun'].includes(item.id) ? 1 : 0;
          break;
        case 'specialist_support':
          group = 'response_class'; value = 7; minutes = 2;
          if (!input.support.length) reason = 'Specialist support needs a separate supporting squad';
          else if (sight < 0.6) reason = 'Specialist support needs a clear visual path';
          else if (context.safetyFactIds?.some((id) => run.knowledge[id] === 'disproved')) reason = 'The verified adjacent-area check does not permit this intervention';
          else if (!context.subjectFactIds?.length || context.subjectFactIds.some((id) => !known(run, id))) reason = 'The subject context is unconfirmed';
          else if (context.subjectFactIds.some((id) => run.knowledge[id] !== 'confirmed')) reason = 'The verified subject context does not permit this intervention';
          break;
        case 'less_lethal_device': case 'less_lethal_impact':
          group = 'less_lethal_option'; value = cap === 'less_lethal_device' ? 4 : 5; minutes = cap === 'less_lethal_impact' ? 1 : 0;
          if (!context.safetyFactIds?.length || context.safetyFactIds.some((id) => !known(run, id))) reason = 'Safety of adjacent area is unconfirmed';
          else if (context.safetyFactIds.some((id) => run.knowledge[id] !== 'confirmed')) reason = 'The verified adjacent-area check does not permit this intervention';
          else if (!context.subjectFactIds?.length || context.subjectFactIds.some((id) => !known(run, id))) reason = 'The subject context is unconfirmed';
          else if (context.subjectFactIds.some((id) => run.knowledge[id] !== 'confirmed')) reason = 'The verified subject context does not permit this intervention';
          else if (sight < 0.6) reason = 'A clear observed scene is required for this authored intervention';
          break;
        case 'permitted_door_access':
          group = 'access_option'; value = 5;
          if (item.id === 'door_charge') {
            minutes = -1;
            if (context.accessMethod !== 'charge') reason = 'This action uses a mechanical access tool';
            else if (!usableDoor || !ordinaryDoor) reason = 'This access token only supports a declared ordinary door; no reinforced, blocked, glazed or wall bypass';
            else if (!context.safetyFactIds?.length || context.safetyFactIds.some((id) => !known(run, id))) reason = 'Safety of adjacent area is unconfirmed';
            else if (context.safetyFactIds.some((id) => run.knowledge[id] !== 'confirmed')) reason = 'The verified adjacent-area check does not permit this access';
          } else {
            minutes = 2;
            if (context.accessMethod !== 'mechanical') reason = 'This action requires a single-use fictional access token';
            else if (!usableDoor) reason = 'Mechanical access needs a declared closed ordinary or steel door; no blocked-route, glazing or wall bypass';
          }
          break;
        case 'vehicle_exterior': case 'scene_coordination':
          group = 'vehicle_support'; value = cap === 'vehicle_exterior' ? 8 : 5; minutes = cap === 'vehicle_exterior' ? 3 : 2;
          if (!exterior || context.vehicleAccessible !== true || !run.supportPositionId || !built.location.zones.some((z) => z.id === run.supportPositionId && !z.tags.includes('vehicle_inaccessible'))) reason = 'Vehicle support needs accessible exterior staging; no interior or upper-floor coverage';
          else if (cap === 'scene_coordination' && input.acting.length + input.support.length < 2) reason = 'Mobile command support needs at least two participating squads';
          break;
      }
      const supplies: Use[] = [];
      if (!reason) for (const need of item.supplies ?? []) {
        const sharesDeclaredUse = [...action.requires.allTags ?? [], ...action.requires.anyTags ?? []].some((tag) => item.tags.includes(tag));
        const pool = available.filter(({ unit: u }) => u.itemId === need.itemId && unitEffectiveness(u, ITEMS[u.itemId]) > 0 && (u.expiresAt === null || u.expiresAt > state.department.clockHighWater) && (!usedSupplies.has(u.id) || sharesDeclaredUse) && !supplies.some((p) => p.unitId === u.id));
        if (pool.length < need.qty) { reason = `Needs ${need.qty} ${ITEMS[need.itemId].name.toLowerCase()} for this use`; break; }
        for (const p of pool.slice(0, need.qty)) supplies.push({ itemId: p.unit.itemId, unitId: p.unit.id, squadId: p.squadId, qty: 1, consumable: true });
      }
      if (reason) failures.set(cap, [...failures.get(cap) ?? [], `${item.name}: ${reason}`]);
      else candidates.push({ capabilityId: cap, item, unit, squadId, value: round1(value * effectiveness), group, minutes, supplies });
    }
  }
  const byGroup = new Map<string, Candidate>();
  for (const pick of candidates.sort((a, b) => b.value - a.value || a.minutes - b.minutes || a.unit.id.localeCompare(b.unit.id))) {
    if (byGroup.has(pick.group)) continue;
    // A battery may be shared with the base action describing this SAME tool,
    // but two separate optional powered devices never consume the same serial.
    if (pick.supplies.some((u) => supplyClaimed.has(u.unitId))) continue;
    byGroup.set(pick.group, pick);
    pick.supplies.forEach((u) => supplyClaimed.add(u.unitId));
  }
  for (const pick of byGroup.values()) {
    out.applied.push({ capabilityId: pick.capabilityId, itemId: pick.item.id, unitId: pick.unit.id, value: pick.value, group: pick.group, minutes: pick.minutes });
    out.contributors.push({ label: `${pick.item.name}: ${CAPABILITIES[pick.capabilityId].name}`, value: pick.value, source: 'equipment', ref: pick.item.id });
    out.details.push(`${pick.item.name}: ${pick.value >= 0 ? '+' : ''}${pick.value} contextual points${pick.minutes ? `, ${pick.minutes > 0 ? '+' : ''}${pick.minutes} game min` : ''}.`);
    out.minutes += pick.minutes;
    out.uses.push({ squadId: pick.squadId, unitId: pick.unit.id, itemId: pick.item.id, qty: 1, consumable: pick.item.kind === 'consumable' });
    for (const supply of pick.supplies) if (!usedSupplies.has(supply.unitId)) { out.uses.push(supply); usedSupplies.set(supply.unitId, supply); }
  }
  for (const cap of required) if (!out.applied.some((p) => p.capabilityId === cap)) out.reasons.push(failures.get(cap)?.[0] ?? `Needs usable equipment for ${CAPABILITIES[cap].name.toLowerCase()}`);
  for (const reasons of failures.values()) out.details.push(...reasons);
  if (rules.has('dark_visible_scene') && action.check.kind === 'observation' && dark > 0) out.contributors.unshift({ label: 'Poor light: harder to read the scene', value: -dark, source: 'space' });
  out.eligible = out.reasons.length === 0;
  return out;
}

/** Public storefront compatibility, hypothetical fresh unit; ownership is a separate state. */
export function itemCapabilityPreview(state: GameState, itemId: Id, context?: Omit<EvalInput, 'state' | 'unitOverride'>): { compatible: boolean | null; reasons: string[]; contribution: number; minutes: number } {
  const item = ITEMS[itemId];
  if (!context) return { compatible: null, reasons: ['Select an operation action to check compatibility'], contribution: 0, minutes: 0 };
  if (!item) return { compatible: false, reasons: ['Unknown item'], contribution: 0, minutes: 0 };
  if (!item.capabilities?.length) return { compatible: null, reasons: ['This item follows its declared action requirements or resupply role'], contribution: 0, minutes: 0 };
  const run = { ...context.run };
  const units = Object.fromEntries(run.squadIds.map((sid) => [sid, squadUnits(state, run.id, sid)])) as Partial<Record<SquadId, ItemUnit[]>>;
  const id = `preview:${itemId}`;
  const unit: ItemUnit = { id, itemId, serial: 'PREVIEW', condition: 100, acquiredAt: 0, uses: 0, status: 'reserved', serviceUntil: null, wearRate: 1, expiresAt: null, lastWearAt: 0 };
  const sid = context.acting[0] ?? run.squadIds[0];
  units[sid] = [...units[sid] ?? [], unit];
  let viewState = state;
  if (item.supportOnly) {
    run.supportUnitIds = [id]; run.supportPositionId ??= run.squadTasks.find((t) => t.squadId === sid)?.positionId;
    viewState = { ...state, units: { ...state.units, [id]: unit }, reservations: [...state.reservations, { id, itemId, unitId: id, runId: run.id, squadId: sid }] };
  }
  const result = evaluateCapabilities({ ...context, state: viewState, run, units });
  const applied = result.applied.find((p) => p.itemId === itemId);
  const reasons = result.details.filter((line) => line.startsWith(`${item.name}:`));
  return { compatible: !!applied, reasons: reasons.length ? reasons : ['No declared capability for this action'], contribution: applied?.value ?? 0, minutes: applied?.minutes ?? 0 };
}
