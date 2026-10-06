// All effects below are fictional score/time rules. Only public action context and
// player knowledge are read: compatibility never asks a hidden fact for its truth.
import { CAPABILITIES } from '../content/capabilities';
import { incidentOfficerUnavailable } from './incident-consequences';
import { ITEMS } from '../content/items';
import type { ActionDefinition, ScenarioDefinition } from './scenario-types';
import type { BuiltLocation, CapabilityId, Contributor, GameState, Id, ItemUnit, OperationRun, SquadId } from './types';
import type { EvalInput, Use } from './resolution';
import { squadUnits, unitEffectiveness } from './inventory';
import { projectedCondition } from './equipment';
import { observationDifficulty } from './environment';
import { capabilityRuleEffect, effectiveSupplies, operatorQualified } from './equipment-requirements';
import { resolveSubject, standingOf } from './spatial-factors';
import { practiceSupportUnit } from './support-vehicles';
import { signalBetween } from './spatial';
import { forceItemMatches } from './force-risk';

export interface CapabilityInput {
  state: GameState; run: OperationRun; scenario: ScenarioDefinition; action: ActionDefinition; built: BuiltLocation;
  acting: SquadId[]; support: SquadId[]; units: Partial<Record<SquadId, ItemUnit[]>>;
  existingUses?: Use[];
  /** V7 actual selected seats, so an absent cert holder cannot operate used gear. */
  participantIds?: Id[];
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
  if (!run.squadIds.some((sid) => state.squads.find((s) => s.id === sid)?.officerIds.some((oid) => !incidentOfficerUnavailable(state, run, oid) && ['vehicle_operations', ...def.requiresCerts ?? []].every((cert) => (state.officers[oid]?.certs as string[] | undefined)?.includes(cert))))) return null;
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
    // An explicit V7 force choice cannot also use an unrelated carried weapon.
    if (scenario.version >= 7 && action.forceProfile && ['response', 'less_lethal'].includes(item.category ?? '') && !forceItemMatches(action.forceProfile.kind, item.id)) continue;
    const effectiveness = unitEffectiveness(unit, item);
    if (effectiveness <= 0 || (unit.expiresAt !== null && unit.expiresAt <= state.department.clockHighWater)) continue;
    if (item.supportOnly && vehicle?.id !== unit.id) continue;
    if (!item.supportOnly && !input.acting.includes(squadId)) continue;
    for (const cap of item.capabilities ?? []) {
      if (!rules.has(cap)) continue;
      const requiredCerts = item.requiresCerts ?? [];
      const qualified = (item.supportOnly ? run.squadIds : [squadId]).some((sid) => operatorQualified(state, sid, action, item)
        && (scenario.version < 7 || item.supportOnly || input.participantIds === undefined || state.squads.find(squad => squad.id === sid)?.officerIds.some(id => input.participantIds!.includes(id)
          && requiredCerts.every(cert => state.officers[id]?.certs.includes(cert)))));
      const missing = requiredCerts.length && !qualified ? requiredCerts : [];
      let reason = missing.length ? `Needs qualified operator: ${missing.map((c) => c.replaceAll('_', ' ')).join(', ')}` : null;
      const effect = capabilityRuleEffect(item, cap, { action, scenario, built, knowledge: run.knowledge, sight,
        squadCount: input.acting.length + input.support.length, supportCount: input.support.length,
        radioDeficit: input.radioDeficit,
        exteriorStaging: input.acting.some((sid) => built.location.zones.some((z) => z.id === run.squadTasks.find((t) => t.squadId === sid)?.positionId)),
        supportAccessible: !!run.supportPositionId && built.location.zones.some((z) => z.id === run.supportPositionId && !z.tags.includes('vehicle_inaccessible')),
      });
      reason ??= effect.reason;
      const { value, minutes, group } = effect;
      const supplies: Use[] = [];
      if (!reason) for (const need of effectiveSupplies(item)) {
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
  for (const pick of candidates.sort((a, b) => Number(required.has(b.capabilityId)) - Number(required.has(a.capabilityId)) || b.value - a.value || a.minutes - b.minutes || a.unit.id.localeCompare(b.unit.id))) {
    if (byGroup.has(pick.group)) continue;
    // The base action may declare the same supply, but distinct devices
    // cannot consume the same physical cartridge or other supply.
    if (pick.supplies.some((u) => supplyClaimed.has(u.unitId))) {
      const replacement: Use[] = [];
      let complete = true;
      for (const need of effectiveSupplies(pick.item)) {
        const pool = available.filter(({ unit }) => unit.itemId === need.itemId && unitEffectiveness(unit, ITEMS[unit.itemId]) > 0
          && (scenario.version < 7 || unit.expiresAt === null || unit.expiresAt > state.department.clockHighWater)
          && !usedSupplies.has(unit.id) && !supplyClaimed.has(unit.id) && !replacement.some((u) => u.unitId === unit.id));
        if (pool.length < need.qty) { complete = false; break; }
        for (const p of pool.slice(0, need.qty)) replacement.push({ itemId: p.unit.itemId, unitId: p.unit.id, squadId: p.squadId, qty: 1, consumable: true });
      }
      if (!complete) continue;
      pick.supplies = replacement;
    }
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
