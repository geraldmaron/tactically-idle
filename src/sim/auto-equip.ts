import type { GameState, Id, ItemUnit, Officer, Role, SquadId, StageId } from './types';
import type { ActionDefinition } from './scenario-types';
import { ITEMS } from '../content/items';
import { readyUnits } from './inventory';
import { radioRequirement, standardRadioPlan, STANDARD_RADIO } from './standard-kit';
import { deployability, highRiskAllowed } from './officer';
import { conditionFraction } from './resolution';
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

const ROLE_FOR_CHECK: Record<ActionDefinition['check']['kind'], Role> = {
  contact: 'comms', observation: 'recon', execution: 'breach', medical: 'medic', coordination: 'lead', pressure: 'lead',
};

/** Recommendation ranking only, never a new gameplay bonus or eligibility rule. */
function aptitude(officer: Officer, action: ActionDefinition): number {
  const weights = action.check.ratings.filter((r) => r.weight > 0 && (r.key !== 'shooting' || action.check.kind === 'execution'));
  const total = weights.reduce((sum, r) => sum + r.weight, 0) || 1;
  const rating = weights.reduce((sum, r) => sum + officer.ratings[r.key] * r.weight / total, 0);
  const cert = (action.requires.certs ?? []).some((c) => officer.certs.includes(c)) ? 12 : 0;
  const bonus = action.certBonus && officer.certs.includes(action.certBonus.cert) ? action.certBonus.value : 0;
  return rating * (1 - conditionFraction(officer.stress)) + cert + bonus + (officer.role === ROLE_FOR_CHECK[action.check.kind] ? 2 : 0);
}

/**
 * Pure preparation helper: uses owned stock, never buys, settles time, or advances RNG.
 * There is no carry-capacity mechanic. Pack at most one of each reusable item per
 * squad, plus one standard radio per officer; consumables cover the largest relevant use in each stage (alternatives
 * within a stage share that allowance). Manual quantities are never capped.
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
  const pool = Object.keys(ITEMS).filter((id) => !ITEMS[id].supportOnly).flatMap((id) => autoEquipReadyUnits(state, id, time));
  const usableIds = new Set(pool.map((u) => u.id));

  for (const sid of chosen) {
    counts[sid] = { ...options.loadouts?.[sid], [STANDARD_RADIO]: radioRequirement(state, sid) };
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
  for (const sid of chosen) {
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
      picks[sid]!.push(unit);
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
  for (const sid of chosen) {
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
  type Candidate = { sid: SquadId; action: ActionDefinition; lead: Officer; score: number };
  const candidates: Candidate[] = [];
  if (scenario) for (const action of scenarioActions(scenario)) {
    if ((action.requires.minSquads?.count ?? 1) > eligible.length) continue;
    for (const sid of eligible.filter((id) => targets.has(id))) {
      const roster = officers[sid]!.filter((o) => action.check.kind !== 'execution' || highRiskAllowed(o));
      if (!roster.length || (action.requires.certs ?? []).some((cert) => !roster.some((o) => o.certs.includes(cert)))) continue;
      const sorted = [...roster].sort((a, b) => aptitude(b, action) - aptitude(a, action) || a.id.localeCompare(b.id));
      candidates.push({ sid, action, lead: sorted[0], score: aptitude(sorted[0], action) });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.sid.localeCompare(b.sid) || a.action.id.localeCompare(b.action.id));

  const needs: Partial<Record<SquadId, Record<string, Partial<Record<StageId, number>>>>> = {};
  const withTag = (units: ItemUnit[], tag: string) => units.filter((u) => ITEMS[u.itemId].tags.includes(tag));
  const tagName = (tag: string) => Object.values(ITEMS).find((i) => i.tags.includes(tag))?.name ?? tag;
  const shortage = (sid: SquadId, tag: string) => warn(`stock:${sid}:${tag}`, `${label(sid)}: no additional usable ${tagName(tag)} available for this loadout.`);

  for (const { sid, action, lead } of candidates) {
    const planned: ItemUnit[] = [];
    const available = () => [...picks[sid]!, ...planned];
    const take = (tag: string, quantity = 1): boolean => {
      let have = withTag(available(), tag).length;
      for (const unit of pool) {
        if (have >= quantity) break;
        const def = ITEMS[unit.itemId];
        if (!officers[sid]!.some((o) => (def.requiresCerts ?? []).every((cert) => o.certs.includes(cert)) && (action.check.kind !== 'execution' || highRiskAllowed(o)))) continue;
        if (!def.tags.includes(tag) || taken.has(unit.id) || planned.some((u) => u.id === unit.id) || locked(sid, unit.itemId)) continue;
        if (def.kind === 'equipment' && available().some((u) => u.itemId === unit.itemId)) continue;
        planned.push(unit);
        have += 1;
      }
      return have >= quantity;
    };
    const effect = (tag: string) => Math.max(0, ...(action.equipment ?? []).filter((eq) => eq.tag === tag).map((eq) => Math.max(eq.value, eq.narrowValue ?? 0)));
    const choose = (tags: string[]): string | null => {
      const ordered = [...new Set(tags)].sort((a, b) => Number(withTag(available(), b).length > 0) - Number(withTag(available(), a).length > 0) || effect(b) - effect(a) || a.localeCompare(b));
      return ordered.find((tag) => take(tag)) ?? null;
    };
    const stageNeeds = { ...needs[sid] };
    let complete = true;
    for (const tag of action.requires.allTags ?? []) {
      if (!take(tag)) { complete = false; shortage(sid, tag); }
    }
    if (action.requires.anyTags?.length && !choose(action.requires.anyTags)) {
      complete = false;
      warn(`stock:${sid}:${[...action.requires.anyTags].sort().join('|')}`, `${label(sid)}: no usable ${action.requires.anyTags.map(tagName).join(' or ')} available for this loadout.`);
    }
    for (const consume of action.consumes ?? []) {
      const stages = { ...stageNeeds[consume.tag], [action.stage]: Math.max(stageNeeds[consume.tag]?.[action.stage] ?? 0, consume.qty) };
      stageNeeds[consume.tag] = stages;
      if (!take(consume.tag, Object.values(stages).reduce((sum, qty) => sum + qty, 0))) { complete = false; shortage(sid, consume.tag); }
    }
    // Never take a tool whose required consumables or companion tools are missing.
    if (!complete) continue;

    const groups = new Map<string, string[]>();
    for (const eq of action.equipment ?? []) {
      if (Math.max(eq.value, eq.narrowValue ?? 0) <= 0) continue;
      const key = eq.group ?? eq.tag;
      groups.set(key, [...groups.get(key) ?? [], eq.tag]);
    }
    for (const item of Object.values(ITEMS)) {
      if (item.supportOnly || !item.capabilities?.some((cap) => action.capabilities?.rules.includes(cap))) continue;
      if (!officers[sid]!.some((o) => (item.requiresCerts ?? []).every((cert) => o.certs.includes(cert)))) continue;
      // Optional powered aids are only packed when their matching supply is available.
      if ((item.supplies ?? []).some((need) => [...available(), ...pool.filter((u) => !taken.has(u.id))].filter((u) => u.itemId === need.itemId).length < need.qty)) continue;
      const group = item.category === 'response' ? 'response_class' : item.category === 'protection' ? 'personal_protection' : item.capabilities[0];
      groups.set(group, [...groups.get(group) ?? [], item.tags[0]]);
    }
    // Entry tools also shorten routes in the engine, independent of equipment bonuses.
    for (const opening of action.requires.openings ?? []) if (opening.lockedTag) groups.set(opening.lockedTag, [opening.lockedTag]);
    if (action.approach === 'path') groups.set('entry_tool', ['entry_tool']);
    for (const tags of groups.values()) {
      if (!choose(tags) && !tags.every((tag) => Object.values(ITEMS).filter((item) => item.tags.includes(tag)).every((item) => locked(sid, item.id)))) {
        shortage(sid, tags[0]);
      }
    }
    for (const unit of [...planned]) {
      for (const supply of ITEMS[unit.itemId].supplies ?? []) {
        const tag = ITEMS[supply.itemId].tags[0];
        const stages = { ...stageNeeds[tag], [action.stage]: Math.max(stageNeeds[tag]?.[action.stage] ?? 0, supply.qty) };
        if (!take(tag, Object.values(stages).reduce((sum, qty) => sum + qty, 0))) {
          const i = planned.findIndex((p) => p.id === unit.id);
          if (i >= 0) planned.splice(i, 1);
        } else stageNeeds[tag] = stages;
      }
    }
    needs[sid] = stageNeeds;
    for (const unit of planned) {
      add(sid, unit);
      result.rationale[sid]!.push(`${ITEMS[unit.itemId].name} → ${label(sid)}: supports ${lead.surname} for ${action.title.toLowerCase()}.`);
    }
  }

  for (const sid of targets) result.units[sid] = picks[sid]!.map((u) => u.id);
  result.warnings = [...warnings.values()];
  return result;
}
