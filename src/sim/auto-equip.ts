import type { GameState, Id, ItemUnit, Officer, SquadId } from './types';
import type { ActionDefinition } from './scenario-types';
import { ITEMS } from '../content/items';
import { readyUnits } from './inventory';
import { radioRequirement, standardRadioPlan, STANDARD_RADIO } from './standard-kit';
import { deployability } from './officer';
import { EXPERIENCE_TUNING, getBuilt } from './resolution';
import { projectedCondition } from './equipment';
import { unitEffectiveness } from './inventory';
import { centroidOf, standingCandidates, rangeToPoint, rangeThroughOpening } from './spatial-factors';
import { actionConsumptionForItems, actionEquipmentRequirements, capabilityRuleEffect, missionConsumptionBudget, operatorQualified, orderActionParticipants, participantAptitude, planningEquipmentContext, qualifiedOfficers, requiredEquipmentBundle, type EquipmentPick, type PublicEquipmentContext } from './equipment-requirements';
import { scenarioActions } from './scenario-types';
import { getScenario } from './scenario-registry';

export interface AutoLoadout {
  loadouts: Partial<Record<SquadId, Record<Id, number>>>;
  /** Exact unit picks, so the prepare screen reserves the units shown. */
  units: Partial<Record<SquadId, Id[]>>;
  rationale: Partial<Record<SquadId, string[]>>;
  warnings: string[];
  /** Newly picked physical units, excluding the supplied exact picks. */
  added: number;
}

export interface AutoLoadoutOptions {
  /** Every supplied optional item key is a player choice, including zero; radios follow the roster. */
  loadouts?: Partial<Record<SquadId, Record<Id, number>>>;
  units?: Partial<Record<SquadId, Id[]>>;
  /** Only these chosen squads are changed; all chosen squads reserve their current picks. */
  targets?: SquadId[];
}

/** Current usable stock, shared with preparation previews; never settles or buys. */
export function autoEquipReadyUnits(state: GameState, itemId: Id, now: number): ItemUnit[] {
  return readyUnits(state, itemId, now);
}

/**
 * Pure preparation helper: uses owned stock, never buys, settles time, or advances RNG.
 * There is no carry-capacity mechanic. Pack at most one of each reusable item per
 * squad, plus one standard radio per officer; consumables cover feasible sequential uses; only actual exclusive/terminal
 * alternatives share an allowance. Manual quantities are never capped.
 * Only public action requirements/bonuses are inspected, never fact truth or people.
 */
export function autoLoadout(state: GameState, scenarioId: Id, squadIds: SquadId[], now: number, options: AutoLoadoutOptions = {}): AutoLoadout {
  const result: AutoLoadout = { loadouts: {}, units: {}, rationale: {}, warnings: [], added: 0 };
  const chosen = [...new Set(squadIds)].sort();
  const targets = new Set((options.targets ?? chosen).filter((sid) => chosen.includes(sid)));
  const time = Math.max(now, state.department.clockHighWater);
  const taken = new Set<Id>(state.reservations.map((r) => r.unitId));
  const counts: Partial<Record<SquadId, Record<Id, number>>> = {};
  const picks: Partial<Record<SquadId, ItemUnit[]>> = {};
  const officers: Partial<Record<SquadId, Officer[]>> = {};
  const warnings = new Map<string, string>();
  const label = (sid: SquadId) => state.squads.find((s) => s.id === sid)?.name ?? `Squad ${sid}`;
  const warn = (key: string, message: string) => warnings.set(key, message);
  const locked = (sid: SquadId, itemId: Id) => itemId === STANDARD_RADIO || Object.hasOwn(options.loadouts?.[sid] ?? {}, itemId);
  const pool = Object.keys(ITEMS).filter((id) => !ITEMS[id].supportOnly).flatMap((id) => autoEquipReadyUnits(state, id, time)).map((u) => ({ ...u, condition: projectedCondition(state, u, time) }));
  const usableIds = new Set(pool.map((u) => u.id));

  for (const sid of chosen) {
    counts[sid] = { ...Object.fromEntries(Object.entries(options.loadouts?.[sid] ?? {}).filter(([id]) => id !== 'battery_pack')), [STANDARD_RADIO]: radioRequirement(state, sid) };
    picks[sid] = [];
    if (targets.has(sid)) {
      result.loadouts[sid] = counts[sid];
      result.units[sid] = [];
      result.rationale[sid] = [];
    }
    const squad = state.squads.find((s) => s.id === sid);
    const roster = squad?.officerIds.map((id) => state.officers[id]);
    const blocker = roster?.find((o) => !o || !deployability(o, time).ok);
    const valid = !!roster?.length && roster.every((o) => o && deployability(o, time).ok);
    if (valid) officers[sid] = roster as Officer[];
    else if (targets.has(sid)) {
      const reason = blocker ? deployability(blocker, time) : null;
      warn(`squad:${sid}`, `${label(sid)}: no equipment added (${reason && !reason.ok ? reason.reason : !squad ? 'squad does not exist' : !roster?.length ? 'no officers' : 'an officer is unavailable'}).`);
    }
  }

  // Standard radios are automatic even when only one squad's optional gear is
  // targeted. They take distinct best-condition stock before optional choices.
  const radioPlan = standardRadioPlan(state, chosen.filter((sid) => officers[sid]), time);
  if (radioPlan.issue) warn('standard-radios', radioPlan.issue);
  for (const sid of chosen) {
    for (const id of radioPlan.units[sid] ?? []) {
      taken.add(id);
      picks[sid]!.push(state.units[id]);
      if (targets.has(sid) && !options.units?.[sid]?.includes(id)) result.added += 1;
    }
    if (targets.has(sid) && officers[sid]) {
      result.rationale[sid]!.push(`${radioPlan.units[sid]?.length ?? 0}/${radioRequirement(state, sid)} standard radios ready: one per officer, assigned automatically.`);
    }
  }

  // Exact optional picks across ALL squads take precedence over quantity fill.
  for (const sid of [...chosen].sort((a, b) => Number(targets.has(a)) - Number(targets.has(b)))) {
    for (const id of options.units?.[sid] ?? []) {
      const unit = state.units[id];
      if (unit?.itemId === STANDARD_RADIO) continue;
      if (unit && ITEMS[unit.itemId]?.supportOnly) { warn(`support:${id}`, 'Vehicles require an explicit exterior support slot and are never packed automatically.'); continue; }
      const quantity = unit && locked(sid, unit.itemId) ? counts[sid]![unit.itemId] : undefined;
      const quantityFull = quantity !== undefined && (!Number.isInteger(quantity) || quantity < 0 || picks[sid]!.filter((u) => u.itemId === unit.itemId).length >= quantity);
      if (!unit || !usableIds.has(id) || taken.has(id) || quantityFull) {
        warn(`pick:${sid}:${id}`, `${label(sid)}: ${unit?.serial ?? id} could not be kept (${taken.has(id) ? 'already assigned' : quantityFull ? 'manual quantity already filled or invalid' : 'no longer usable'}).`);
        continue;
      }
      taken.add(id);
      picks[sid]!.push({ ...unit, condition: projectedCondition(state, unit, time) });
    }
    for (const unit of picks[sid]!) {
      if (!locked(sid, unit.itemId)) counts[sid]![unit.itemId] = picks[sid]!.filter((u) => u.itemId === unit.itemId).length;
    }
  }

  const add = (sid: SquadId, unit: ItemUnit) => {
    taken.add(unit.id);
    picks[sid]!.push(unit);
    if (targets.has(sid)) result.added += 1;
    if (!locked(sid, unit.itemId)) counts[sid]![unit.itemId] = picks[sid]!.filter((u) => u.itemId === unit.itemId).length;
  };

  // Honor manually requested quantities first, without inventing missing units.
  for (const sid of [...chosen].sort((a, b) => Number(targets.has(a)) - Number(targets.has(b)))) {
    for (const [itemId, qty] of Object.entries(counts[sid]!)) {
      if (itemId === STANDARD_RADIO) continue;
      if (ITEMS[itemId]?.supportOnly) { delete counts[sid]![itemId]; warn(`support:${itemId}`, 'Vehicles require an explicit exterior support slot and are never packed automatically.'); continue; }
      if (!Number.isInteger(qty) || qty < 0 || !ITEMS[itemId]) {
        warn(`quantity:${sid}:${itemId}`, `${label(sid)}: invalid quantity or unknown item ${ITEMS[itemId]?.name ?? itemId}; check the manual loadout.`);
        continue;
      }
      let have = picks[sid]!.filter((u) => u.itemId === itemId).length;
      if (officers[sid]) {
        for (const unit of pool) {
          if (have >= qty) break;
          if (unit.itemId !== itemId || taken.has(unit.id)) continue;
          add(sid, unit);
          have += 1;
        }
      }
      if (have < qty) warn(`manual:${sid}:${itemId}`, `${label(sid)}: requested ${qty} ${ITEMS[itemId].name}; only ${have} usable unit${have === 1 ? '' : 's'} available. Manual quantity kept.`);
    }
  }

  const scenario = getScenario(scenarioId);
  if (!scenario) warn('scenario', 'Unknown operation: automatic equipment suggestions are unavailable.');
  const eligible = chosen.filter((sid) => officers[sid]);
  const built = scenario ? getBuilt(scenario.locationFamilyId, scenario.locationSeed) : null;
  type Candidate = { sid: SquadId; action: ActionDefinition; lead: Officer; score: number; context: PublicEquipmentContext };
  const candidates: Candidate[] = [];
  if (scenario && built) for (const action of scenarioActions(scenario)) {
    const requirements = actionEquipmentRequirements(action);
    if (requirements.minSquads > eligible.length) continue;
    if (action.requires.openings?.some((o) => built.location.openings.find((p) => p.id === o.openingId)?.state === 'blocked')) continue;
    if (action.requires.env?.some((need) => need === 'cctv' ? !scenario.environment?.cctv || scenario.environment.power === 'off' : !scenario.environment?.keyholder)) continue;
    const context = planningEquipmentContext(scenario, action, built, eligible.length);
    for (const sid of eligible.filter((id) => targets.has(id))) {
      const roster = qualifiedOfficers(state, [sid], action);
      if (!roster.length || requirements.certs.some((cert) => !roster.some((o) => o.certs.includes(cert)))) continue;
      const lead = orderActionParticipants(roster, action)[0];
      candidates.push({ sid, action, lead, score: participantAptitude(lead, action), context });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.sid.localeCompare(b.sid) || a.action.id.localeCompare(b.action.id));
  type Effect = { value: number; minutes: number; group: string; prerequisites: string[] };
  const effects = (candidate: Candidate, unit: ItemUnit): Effect[] => {
    const { action, context, sid } = candidate;
    const def = ITEMS[unit.itemId];
    if (!def || !operatorQualified(state, sid, action, def)) return [];
    const effectiveness = unitEffectiveness(unit, def);
    const cap = Math.min(action.maxParticipants ?? 99, ...(action.capacityBound ?? []).map((id) => context.built.derived.spaces[id]?.capacity ?? 99));
    const out: Effect[] = [];
    for (const eq of action.equipment ?? []) if (def.tags.includes(eq.tag)) {
      let factor = 1;
      if (eq.range) {
        const stands = standingCandidates(context.built, action.targetId, action.approach === 'window' ? 'outside' : 'inside', action.spatial?.openingId);
        const origin = stands.length ? stands.map((s) => s.at) : context.built.location.entries.map((id) => centroidOf(context.built, id));
        factor = Math.max(0, ...origin.map((at) => (eq.range === 'target' ? rangeToPoint(def, at, centroidOf(context.built, action.targetId)) : rangeThroughOpening(context.built, def, at, action.targetId)).factor));
      }
      const full = cap <= 1 ? eq.narrowValue ?? eq.value : eq.value;
      const value = Math.round(full * effectiveness * factor * 10) / 10 - Math.round(EXPERIENCE_TUNING.malfunctionShare * full * (1 - effectiveness) * 10) / 10;
      if (value > 0) out.push({ value, minutes: 0, group: eq.group ?? eq.tag, prerequisites: [] });
    }
    for (const capability of def.capabilities ?? []) if (action.capabilities?.rules.includes(capability)) {
      const effect = capabilityRuleEffect(def, capability, context);
      if (!effect.reason && effect.value > 0) out.push({ ...effect, value: Math.round(effect.value * effectiveness * 10) / 10 });
    }
    // Route tools have a time benefit only on a publicly locked usable route.
    if (def.tags.includes('entry_tool') && action.approach === 'path' && context.built.location.openings.some((o) => o.state === 'locked')) out.push({ value: 0, minutes: -2 * effectiveness, group: 'entry_tool', prerequisites: [] });
    return out;
  };
  const itemAllowed = (candidate: Candidate, unit: ItemUnit) => {
    const def = ITEMS[unit.itemId];
    if (!def || !operatorQualified(state, candidate.sid, candidate.action, def)) return false;
    const requiredCaps = (candidate.action.capabilities?.required ?? []).filter((cap) => def.capabilities?.includes(cap));
    return !requiredCaps.length || requiredCaps.some((cap) => !capabilityRuleEffect(def, cap, candidate.context).reason);
  };
  const bestEffect = (candidate: Candidate, unit: ItemUnit) => effects(candidate, unit).sort((a, b) => b.value - a.value || a.minutes - b.minutes)[0] ?? { value: 0, minutes: 0, group: '', prerequisites: [] };
  const compare = (candidate: Candidate) => (a: EquipmentPick, b: EquipmentPick) => {
    const av = bestEffect(candidate, a.unit), bv = bestEffect(candidate, b.unit);
    return bv.value - av.value || av.minutes - bv.minutes || b.unit.condition - a.unit.condition || a.unit.id.localeCompare(b.unit.id);
  };
  const demands = new Map<SquadId, Map<Id, { action: ActionDefinition; consumes: { tag: string; qty: number }[]; itemIds: Id[] }>>();
  const supported: Candidate[] = [];
  const budgetFor = (candidate: Candidate, itemIds: Id[]) => {
    const current = new Map(demands.get(candidate.sid) ?? []);
    current.set(candidate.action.id, { action: candidate.action, itemIds, consumes: actionConsumptionForItems(candidate.action, itemIds) });
    return { current, consumes: missionConsumptionBudget([...current.values()]) };
  };
  const bundleFor = (candidate: Candidate, itemIds: Id[], extra: ItemUnit[] = []) => {
    const { consumes } = budgetFor(candidate, itemIds);
    return requiredEquipmentBundle({ action: { ...candidate.action, consumes }, acting: [candidate.sid],
      held: [...picks[candidate.sid]!, ...extra].map((unit) => ({ squadId: candidate.sid, unit })),
      stock: pool.filter((u) => !taken.has(u.id) && !extra.some((e) => e.id === u.id) && !locked(candidate.sid, u.itemId)).map((unit) => ({ squadId: candidate.sid, unit })),
      allowed: ({ unit }) => itemAllowed(candidate, unit), compare: compare(candidate),
    });
  };
  // Allocate complete required bundles for every feasible action before bonus gear.
  for (const candidate of candidates) {
    const { sid, action, lead } = candidate;
    const req = actionEquipmentRequirements(action);
    const preliminary = bundleFor(candidate, []);
    if (preliminary.missing.length) { warn(`stock:${sid}:${action.id}`, `${label(sid)}: no additional usable ${preliminary.missing.join(' / ')} for ${action.title.toLowerCase()}.`); continue; }
    const all = [...picks[sid]!, ...preliminary.additions.map((p) => p.unit)];
    const itemIds = req.groups.map((g) => all.find((u) => g.itemIds.includes(u.itemId))?.itemId).filter((id): id is Id => !!id);
    const bundle = bundleFor(candidate, itemIds);
    if (bundle.missing.length) { warn(`stock:${sid}:${action.id}`, `${label(sid)}: no additional usable ${bundle.missing.join(' / ')} for ${action.title.toLowerCase()}.`); continue; }
    for (const { unit } of bundle.additions) { add(sid, unit); result.rationale[sid]!.push(`${ITEMS[unit.itemId].name} → ${label(sid)}: supports ${lead.surname} for ${action.title.toLowerCase()}.`); }
    demands.set(sid, budgetFor(candidate, itemIds).current);
    supported.push(candidate);
    const prerequisites = [...(action.requires.facts ?? []).map((f) => f.reason), ...(action.requires.flags ?? []).map((f) => f.reason)];
    for (const itemId of itemIds) for (const cap of ITEMS[itemId].capabilities ?? []) if (action.capabilities?.rules.includes(cap)) prerequisites.push(...capabilityRuleEffect(ITEMS[itemId], cap, candidate.context).prerequisites);
    if (prerequisites.length) result.rationale[sid]!.push(`${action.title}: ${[...new Set(prerequisites)].join('; ')}.`);
  }
  for (const candidate of supported) {
    const { sid, action, lead } = candidate;
    const groups = new Set(pool.flatMap((u) => effects(candidate, u).map((e) => e.group)));
    for (const group of groups) {
      const compareGroup = (a: EquipmentPick, b: EquipmentPick) => {
        const av = effects(candidate, a.unit).find((effect) => effect.group === group)!;
        const bv = effects(candidate, b.unit).find((effect) => effect.group === group)!;
        return bv.value - av.value || av.minutes - bv.minutes || b.unit.condition - a.unit.condition || a.unit.id.localeCompare(b.unit.id);
      };
      const matching = pool.filter((u) => effects(candidate, u).some((e) => e.group === group))
        .map((unit) => ({ squadId: sid, unit })).sort(compareGroup);
      const existing = picks[sid]!.filter((u) => effects(candidate, u).some((e) => e.group === group)).map((unit) => ({ squadId: sid, unit })).sort(compareGroup)[0];
      if (existing) {
        const itemIds = [...(demands.get(sid)?.get(action.id)?.itemIds ?? []), existing.unit.itemId];
        const bundle = bundleFor(candidate, itemIds);
        if (!bundle.missing.length) {
          for (const pick of bundle.additions) add(sid, pick.unit);
          demands.set(sid, budgetFor(candidate, itemIds).current);
        } else warn(`optional-supply:${sid}:${action.id}:${group}`, `${label(sid)}: ${bundle.missing.join(' / ')} shortage for another ${action.title.toLowerCase()} use.`);
        continue;
      }
      for (const { unit } of matching) {
        if (taken.has(unit.id) || locked(sid, unit.itemId) || picks[sid]!.some((u) => u.itemId === unit.itemId)) continue;
        const itemIds = [...(demands.get(sid)?.get(action.id)?.itemIds ?? []), unit.itemId];
        const bundle = bundleFor(candidate, itemIds, [unit]);
        if (bundle.missing.length) continue;
        add(sid, unit);
        for (const pick of bundle.additions) add(sid, pick.unit);
        demands.set(sid, budgetFor(candidate, itemIds).current);
        const effect = effects(candidate, unit).find((e) => e.group === group)!;
        result.rationale[sid]!.push(`${ITEMS[unit.itemId].name} → ${label(sid)}: supports ${lead.surname} for ${action.title.toLowerCase()} (${effect.value > 0 ? `+${Math.round(effect.value * 10) / 10} points` : 'route aid'}${effect.minutes ? `, ${effect.minutes > 0 ? '+' : ''}${effect.minutes} game min` : ''}).${effect.prerequisites.length ? ` ${effect.prerequisites.join('; ')}.` : ''}`);
        break;
      }
    }
  }

  for (const sid of targets) result.units[sid] = picks[sid]!.map((u) => u.id);
  result.warnings = [...warnings.values()];
  return result;
}
