import { actionEquipmentRequirements, capabilityRuleEffect, effectiveSupplies, normalizedActionConsumption, operatorQualified, planningEquipmentContext } from './equipment-requirements';
// Operation selectors consumed by the UI. Everything here is derived from game
// state and content; nothing mutates. Export names and signatures are a contract.
import type {
  ActionView,
  BuiltLocation,
  Command,
  DebriefResult,
  DecisionResolution,
  DecisionView,
  FactView,
  GameState,
  Id,
  KnowledgeStatus,
  OperationRun,
  PersonMark,
  SpaceView,
  SquadId,
  StageId,
} from './types';
import type { ActionDefinition, FactDefinition, ScenarioDefinition } from './scenario-types';
import { scenarioActions } from './scenario-types';
import { SCENARIO_ORDER } from '../content/scenarios';
import { getScenario } from './scenario-registry';
import { ITEMS } from '../content/items';
import { deployability } from './officer';
import { builtFor, CERT_LABEL, conditionHolds, evaluateAction, getBuilt, squadLabel, spaceName, tagNames, type Evaluation } from './resolution';
import { checkStart, computeDebrief, defaultSupport, evaluateDefault, decisionViewsFor } from './operation';
import { approxPoint } from './spatial-factors';

export interface ScenarioCard {
  id: Id;
  /** e.g. 'OP 0141' */
  code: string;
  title: string;
  setting: 'residential' | 'business' | 'apartment';
  summary: string;
  /** e.g. 'Uncertain occupancy' / 'Time pressure' */
  variantLabel: string;
  squadRange: { min: number; max: number };
  /** e.g. 'Low time pressure' */
  pressureLabel: string;
  eligibleSquadIds: SquadId[];
  /** Why the scenario cannot be deployed for real right now (practice may still be possible). */
  issues: string[];
}

export interface Briefing {
  scenarioId: Id;
  known: string[];
  unknown: string[];
  objectives: string[];
  /** Entry zones squads may start from, with labels. */
  entries: { id: Id; label: string }[];
  /** Equipment tags this scenario's actions can use, for the loadout screen. */
  usefulItemIds: Id[];
}

export interface StageProgress {
  prompt: string;
  stage: StageId | 'debrief';
  index: number;
  stages: { id: StageId; label: string; state: 'done' | 'current' | 'todo' }[];
}

export interface PrepCheck {
  ok: boolean;
  issues: string[];
  /** Non-blocking notes, e.g. 'Squad B has no comms kit: contact options limited'. */
  warnings: string[];
}

export type StartOperationCommand = Extract<Command, { type: 'startOperation' }>;

const STAGE_ORDER: StageId[] = ['assess', 'adapt', 'resolve'];

// ---------------------------------------------------------------- scenario list and briefing

export function scenarioCards(state: GameState, now: number): ScenarioCard[] {
  const clock = Math.max(now, state.department.clockHighWater);
  const ids = [...new Set([...(state.incidents ?? []).filter((c) => c.expiresAt > clock).map((c) => c.id), ...SCENARIO_ORDER])];
  return ids.map(getScenario).filter((s): s is ScenarioDefinition => s !== null).map((s) => {
    const issues: string[] = [];
    const eligible: SquadId[] = [];
    const why: string[] = [];
    for (const squad of state.squads) {
      if (squad.officerIds.length === 0) {
        why.push(`${squadLabel(squad.id)} has no officers`);
        continue;
      }
      let blocker: string | null = null;
      for (const oid of squad.officerIds) {
        const o = state.officers[oid];
        if (!o) continue;
        const d = deployability(o, now);
        if (!d.ok) {
          blocker = d.reason;
          break;
        }
      }
      if (blocker) why.push(`${squadLabel(squad.id)}: ${blocker}`);
      else eligible.push(squad.id);
    }
    if (state.activeRun) issues.push('An operation is already in progress');
    if (eligible.length < s.squadRange.min) {
      issues.push(eligible.length === 0 ? 'No squad is ready to deploy' : `Needs ${s.squadRange.min} ready squads`);
      issues.push(...why);
    }
    try {
      const b = getBuilt(s.locationFamilyId, s.locationSeed);
      const e = b.issues.find((i) => i.severity === 'error');
      if (e) issues.push(`Location unavailable: ${e.message}`);
    } catch {
      issues.push('Location unavailable');
    }
    return {
      id: s.id,
      code: s.code,
      title: s.title,
      setting: s.setting,
      summary: s.summary,
      variantLabel: s.variantLabel,
      squadRange: s.squadRange,
      pressureLabel: s.pressureLabel,
      eligibleSquadIds: eligible,
      issues,
    };
  });
}

export function briefing(scenarioId: Id, state?: GameState, squadIds?: SquadId[]): Briefing {
  const s = getScenario(scenarioId);
  if (!s) return { scenarioId, known: [], unknown: [], objectives: [], entries: [], usefulItemIds: [] };
  const built = getBuilt(s.locationFamilyId, s.locationSeed);
  const known = [...s.briefing.known, ...s.facts.filter((f) => f.initial === 'reported' && f.reportedText).map((f) => f.reportedText as string)];
  const unknown = [...s.briefing.unknown];
  const useful = new Set<Id>();
  const chosen = squadIds?.length ? squadIds : state?.squads.filter((s) => s.officerIds.length).map((s) => s.id);
  const squadCount = chosen?.length ?? s.squadRange.max;
  for (const action of scenarioActions(s)) {
    const requirements = actionEquipmentRequirements(action);
    if (requirements.minSquads > squadCount) continue;
    const context = planningEquipmentContext(s, action, built, squadCount);
    const requiredIds = new Set(requirements.groups.flatMap((g) => g.itemIds));
    const requiredTags = new Set(requirements.consumes.map((c) => c.tag));
    for (const item of Object.values(ITEMS)) {
      if (state && chosen?.length && !chosen.some((sid) => operatorQualified(state, sid, action, item))) continue;
      const requiredCapabilities = (action.capabilities?.required ?? []).filter((cap) => item.capabilities?.includes(cap));
      if (requiredCapabilities.length && !requiredCapabilities.some((cap) => !capabilityRuleEffect(item, cap, context).reason)) continue;
      const optionalCapability = item.capabilities?.some((cap) => action.capabilities?.rules.includes(cap) && !capabilityRuleEffect(item, cap, context).reason);
      const optionalTag = (action.equipment ?? []).some((e) => item.tags.includes(e.tag) && Math.max(e.value, e.narrowValue ?? 0) > 0);
      const routeTool = item.tags.includes('entry_tool') && action.approach === 'path' && built.location.openings.some((o) => o.state === 'locked');
      if (requiredIds.has(item.id) || item.tags.some((tag) => requiredTags.has(tag)) || optionalCapability || optionalTag || routeTool || item.id === 'radio_kit') useful.add(item.id);
    }
  }
  for (const itemId of useful) for (const supply of effectiveSupplies(ITEMS[itemId])) useful.add(supply.itemId);
  const usefulItemIds = [...useful];
  return {
    scenarioId,
    known,
    unknown,
    objectives: s.objectives.map((o) => o.label),
    entries: built.location.entries.map((id) => ({ id, label: spaceName(built, id) })),
    usefulItemIds,
  };
}

export function builtForScenario(scenarioId: Id): BuiltLocation {
  const s = getScenario(scenarioId);
  return s ? getBuilt(s.locationFamilyId, s.locationSeed) : getBuilt('maple_street', 0);
}

/** The active run's location including opening states changed during play. */
export function currentBuilt(state: GameState): BuiltLocation | null {
  const run = state.activeRun;
  return run ? builtFor(run.locationFamilyId, run.locationSeed, run.flags) : null;
}

// ---------------------------------------------------------------- map

interface MarkerSource {
  status: KnowledgeStatus;
  fact: FactDefinition;
}

const PRIORITY: Record<KnowledgeStatus, number> = { confirmed: 3, disproved: 3, reported: 2, unknown: 1 };

function markerFor(sources: MarkerSource[]): Pick<SpaceView, 'status' | 'marker'> {
  const shown = sources.filter((s) => s.status !== 'unknown' || s.fact.showWhenUnknown);
  if (shown.length === 0) return { status: 'none', marker: null };
  shown.sort((a, b) => PRIORITY[b.status] - PRIORITY[a.status]);
  const { status, fact } = shown[0];
  const text = fact.markers[status];
  if (!text) return { status, marker: null };
  // The marker names the claim; the source rides underneath while the claim is only reported.
  const subtext = status === 'reported' ? fact.markerSource : undefined;
  return { status, marker: { text, tone: status === 'confirmed' || status === 'disproved' ? 'mint' : 'amber', ...(subtext ? { subtext } : {}) } };
}

/** Actions in any stage that could settle a fact (their outcomes confirm or rule it out). */
function verifyActionsFor(s: ScenarioDefinition, factId: Id, run: OperationRun | null, state: GameState | null, built: BuiltLocation): FactView['verifyActions'] {
  const out: FactView['verifyActions'] = [];
  for (const a of scenarioActions(s)) {
    if (!conditionHolds(a.visibleWhen, run ?? { knowledge: Object.fromEntries(s.facts.map((f) => [f.id, f.initial])), flags: [], pressure: s.pressure.start })) continue;
    const settles = (['favorable', 'mixed', 'adverse'] as const).some((band) =>
      a.outcomes[band].some((e) => e.reveal?.includes(factId) || (e.knowledge ?? []).some((k) => k.factId === factId && (k.status === 'confirmed' || k.status === 'disproved'))),
    );
    if (!settles) continue;
    let availableNow = false;
    if (run && state && run.status === 'active' && run.stage === a.stage && !run.history.some((h) => h.stage === a.stage && h.actionId === a.id)) {
      availableNow = run.squadIds.some((sq) => evaluateAction({ state, run, scenario: s, action: a, built, acting: [sq], support: defaultSupport(run, a, [sq]) }).eligible);
    }
    out.push({ actionId: a.id, title: a.title, stage: a.stage, availableNow });
  }
  return out;
}

function factViewsFor(s: ScenarioDefinition, spaceId: Id, built: BuiltLocation, knowledge: Record<Id, KnowledgeStatus>, run: OperationRun | null, state: GameState | null): FactView[] {
  const out: FactView[] = [];
  for (const f of s.facts.filter((x) => x.spaceId === spaceId)) {
    const status = knowledge[f.id] ?? f.initial;
    // A fact the player has no knowledge of stays hidden unless the scenario draws its amber unknown.
    if (status === 'unknown' && !f.showWhenUnknown) continue;
    const resolvedNote = status === 'confirmed' ? f.resolved?.confirmed : status === 'disproved' ? f.resolved?.disproved : undefined;
    out.push({
      id: f.id,
      label: f.label,
      status,
      claim: f.claim,
      source: f.source,
      note: resolvedNote ?? f.note,
      verifyActions: verifyActionsFor(s, f.id, run, state, built),
    });
  }
  return out;
}

/** People drawn on the map only at the knowledge level held: reported = approximate with '?', confirmed = exact. */
function peopleFor(s: ScenarioDefinition, spaceId: Id, built: BuiltLocation, knowledge: Record<Id, KnowledgeStatus>): PersonMark[] {
  const out: PersonMark[] = [];
  for (const f of s.facts.filter((x) => x.spaceId === spaceId && x.person)) {
    const status = knowledge[f.id] ?? f.initial;
    const person = f.person!;
    if (status === 'reported') out.push({ id: `person_${f.id}`, at: approxPoint(built, f), label: `${person.label}?`, status });
    else if (status === 'confirmed' && person.at) out.push({ id: `person_${f.id}`, at: person.at, label: person.label, status });
  }
  return out;
}

function buildSpaceViews(s: ScenarioDefinition, built: BuiltLocation, knowledge: Record<Id, KnowledgeStatus>, run: OperationRun | null, state: GameState | null): SpaceView[] {
  const ids = [...built.location.rooms.map((r) => r.id), ...built.location.zones.map((z) => z.id)];
  const actions = run && state ? visibleTargets(state, run, s, built) : new Map<Id, Id[]>();
  return ids.map((id) => {
    const sources = s.facts.filter((f) => f.spaceId === id).map((fact) => ({ fact, status: knowledge[fact.id] ?? fact.initial }));
    const { status, marker } = markerFor(sources);
    return {
      id,
      label: spaceName(built, id),
      status,
      marker,
      squadsHere: run ? run.squadTasks.filter((t) => t.positionId === id).map((t) => t.squadId) : [],
      facts: factViewsFor(s, id, built, knowledge, run, state),
      people: peopleFor(s, id, built, knowledge),
      actionIds: actions.get(id) ?? [],
    };
  });
}

/** Unresolved current-stage actions grouped by target. Actions gated on unknown facts stay hidden. */
function visibleTargets(state: GameState, run: OperationRun, s: ScenarioDefinition, _built: BuiltLocation): Map<Id, Id[]> {
  const out = new Map<Id, Id[]>();
  if (run.status !== 'active' || run.stage === 'debrief') return out;
  for (const a of s.stages[run.stage].actions) {
    if (run.history.some((h) => h.stage === run.stage && h.actionId === a.id)) continue;
    if (isTargetHidden(a, run)) continue;
    const list = out.get(a.targetId) ?? [];
    list.push(a.id);
    out.set(a.targetId, list);
  }
  void state;
  return out;
}

function isTargetHidden(a: ActionDefinition, run: OperationRun): boolean {
  return !conditionHolds(a.visibleWhen, run) || (a.requires.facts ?? []).some((f) => !f.in.includes(run.knowledge[f.factId] ?? 'unknown'));
}

export function spaceViewsForScenario(scenarioId: Id): SpaceView[] {
  const s = getScenario(scenarioId);
  if (!s) return [];
  const built = getBuilt(s.locationFamilyId, s.locationSeed);
  const knowledge: Record<Id, KnowledgeStatus> = {};
  for (const f of s.facts) knowledge[f.id] = f.initial;
  return buildSpaceViews(s, built, knowledge, null, null);
}

export function spaceViews(state: GameState): SpaceView[] {
  const run = state.activeRun;
  if (!run) return [];
  const s = getScenario(run.scenarioId);
  if (!s) return [];
  return buildSpaceViews(s, builtFor(run.locationFamilyId, run.locationSeed, run.flags), run.knowledge, run, state);
}

export function stageProgress(state: GameState): StageProgress {
  const run = state.activeRun;
  const s = run ? getScenario(run.scenarioId) : null;
  const stage: StageId | 'debrief' = run?.stage ?? 'assess';
  const cur = stage === 'debrief' ? 3 : STAGE_ORDER.indexOf(stage);
  return {
    stage,
    prompt: stage === 'debrief' ? (s?.endings[run?.endingId ?? '']?.summary ?? 'Review the operation result.') : (s?.stages[stage].prompt ?? ''),
    index: cur,
    stages: STAGE_ORDER.map((id, i) => ({
      id,
      label: s?.stages[id].label ?? id,
      state: i < cur ? 'done' : i === cur ? 'current' : 'todo',
    })),
  };
}

// ---------------------------------------------------------------- actions

function requirementLine(a: ActionDefinition): string {
  const parts: string[] = [];
  for (const c of a.requires.certs ?? []) parts.push(CERT_LABEL[c] ?? c);
  const equipment = actionEquipmentRequirements(a);
  for (const group of equipment.groups) parts.push(group.label.toLowerCase());
  for (const consume of equipment.consumes) parts.push(`uses ${consume.qty} ${tagNames([consume.tag])}`);
  if (equipment.minSquads > 1) parts.push(`${equipment.minSquads} squads`);
  if (parts.length === 0) return 'No special requirements';
  const line = parts.join(' + ');
  return line.charAt(0).toUpperCase() + line.slice(1);
}

function summaryFor(a: ActionDefinition, ev: Evaluation, state: GameState): string {
  if (!ev.eligible) return (ev.reason ?? 'Unavailable').split(' — ')[0];
  const lead = ev.leadId ? state.officers[ev.leadId]?.surname : undefined;
  return a.summary.replace(/Uses a battery pack/gi, 'Uses integrated equipment power').replace('{lead}', lead ?? 'Squad');
}

function expectedSupplies(action: ActionDefinition, ev: Evaluation): ActionView['suppliesRequired'] {
  const used = new Map<string, number>();
  for (const use of ev.uses) if (use.consumable && use.itemId !== 'battery_pack') used.set(ITEMS[use.itemId]?.name ?? use.itemId, (used.get(ITEMS[use.itemId]?.name ?? use.itemId) ?? 0) + use.qty);
  // A missing supply can make the plan incomplete; still show the complete declared cost.
  for (const use of normalizedActionConsumption(action)) {
    const candidates = Object.values(ITEMS).filter((item) => item.kind === 'consumable' && item.tags.includes(use.tag));
    const label = candidates.length === 1 ? candidates[0].name : tagNames([use.tag]);
    const matching = [...used].filter(([name]) => Object.values(ITEMS).some((item) => item.name === name && item.tags.includes(use.tag)));
    if (!matching.length) used.set(label, Math.max(used.get(label) ?? 0, use.qty));
  }
  // Required devices may bring their own supplies even without an explicit consumes
  // row. Show requirements shared by every permitted alternative, never batteries.
  for (const group of actionEquipmentRequirements(action).groups) {
    const candidates = group.itemIds.map((id) => ITEMS[id]).filter(Boolean);
    for (const need of candidates[0] ? effectiveSupplies(candidates[0]) : []) {
      if (!candidates.every((item) => effectiveSupplies(item).some((other) => other.itemId === need.itemId))) continue;
      const qty = Math.min(...candidates.map((item) => effectiveSupplies(item).find((other) => other.itemId === need.itemId)!.qty));
      const label = ITEMS[need.itemId]?.name ?? need.itemId;
      used.set(label, Math.max(used.get(label) ?? 0, qty));
    }
  }
  return [...used].map(([label, qty]) => ({ label, qty }));
}

/** Never select a hidden truth branch for a preview; include its possible delay in the bounds. */
function durationRange(action: ActionDefinition, ev: Evaluation, run: OperationRun): ActionView['timeRange'] {
  if (run.scenarioVersion >= 4 && action.awaitSupport) return { min: ev.timeBase, max: ev.timeBase };
  const limits = (['favorable', 'mixed', 'adverse'] as const).flatMap((band) => {
    const base = ev.timeBase * ({ favorable: 1, mixed: 1.2, adverse: 1.5 } as const)[band];
    let min = base;
    let max = base;
    for (const effect of action.outcomes[band]) {
      if (!conditionHolds(effect.when, run)) continue;
      const extra = effect.extraMinutes ?? 0;
      if (effect.truth?.length) { min += Math.min(0, extra); max += Math.max(0, extra); }
      else { min += extra; max += extra; }
    }
    return [min, max];
  });
  const round = (n: number) => Math.round(Math.max(0.5, n) * 10) / 10;
  return { min: round(Math.min(...limits)), max: round(Math.max(...limits)) };
}

/** Legacy authored content has no hidden outcome branches; include possibilities without testing truth. */
function legacyOutcomePreview(_action: ActionDefinition): ActionView['outcomePreview'] {
  return {
    favorable: 'The intended step can advance the operation. The result will record any newly verified facts and costs.',
    mixed: 'The step may only partly work, take longer, or leave gaps for the next decision.',
    adverse: 'The intended result may not be achieved. Time, strain, and the situation can worsen; read the committed result before continuing.',
  };
}

function legacyConsequenceLevel(action: ActionDefinition): ActionView['consequenceLevel'] {
  const safetyLoss = Math.max(0, ...Object.values(action.outcomes).flat().map((effect) => -(effect.civilian ?? 0)));
  return safetyLoss >= 18 ? 'severe' : safetyLoss >= 10 ? 'high' : safetyLoss > 0 || action.stressBase >= 5 ? 'moderate' : 'low';
}

function toView(state: GameState, run: OperationRun, a: ActionDefinition, ev: Evaluation, alternates: SquadId[]): ActionView {
  const hidden = isTargetHidden(a, run);
  let reason = ev.reason;
  if (reason && alternates.length > 0) reason = `${reason}. ${alternates.map(squadLabel).join(' and ')} can.`;
  return {
    id: a.id,
    stage: a.stage,
    title: a.title,
    icon: a.icon,
    summary: reason ? summaryFor(a, { ...ev, reason }, state) : summaryFor(a, ev, state),
    requirementLine: requirementLine(a),
    actingSquadIds: ev.acting,
    supportSquadIds: ev.support,
    officerIds: ev.participantIds,
    targetId: hidden ? null : a.targetId,
    eligible: ev.eligible,
    reason,
    risk: ev.risk,
    likelihood: { favorable: ev.pFavorable, mixed: Math.max(0, 1 - ev.pFavorable - ev.pAdverse), adverse: ev.pAdverse },
    consequenceLevel: a.consequenceLevel ?? legacyConsequenceLevel(a),
    outcomePreview: { ...(a.outcomePreview ?? legacyOutcomePreview(a)) },
    suppliesRequired: expectedSupplies(a, ev),
    timeRange: durationRange(a, ev, run),
    timeCost: Math.max(1, Math.round(ev.timeExpected)),
    contributors: ev.contributors,
    uncertainty: ev.uncertainty,
    details: ev.details,
    overlays: ev.overlays,
  };
}

/** Actions for the current stage. focusSquadId sets the default acting squad. */
export function actionViews(state: GameState, _now: number, focusSquadId: SquadId | null): ActionView[] {
  const run = state.activeRun;
  if (!run || run.status !== 'active' || run.stage === 'debrief') return [];
  const s = getScenario(run.scenarioId);
  if (!s) return [];
  const built = builtFor(run.locationFamilyId, run.locationSeed, run.flags);
  return s.stages[run.stage].actions.filter((a) => conditionHolds(a.visibleWhen, run)).map((a) => {
    const { ev, alternates } = evaluateDefault(state, run, s, built, a, focusSquadId);
    return toView(state, run, a, ev, alternates);
  });
}

/** Recompute one action for an explicit acting/supporting squad choice. */
export function previewAction(
  state: GameState,
  _now: number,
  actionId: Id,
  actingSquadIds: SquadId[],
  supportSquadIds: SquadId[],
): ActionView | null {
  const run = state.activeRun;
  if (!run || run.status !== 'active' || run.stage === 'debrief') return null;
  const s = getScenario(run.scenarioId);
  const a = s?.stages[run.stage].actions.find((x) => x.id === actionId);
  if (!s || !a || !conditionHolds(a.visibleWhen, run)) return null;
  const built = builtFor(run.locationFamilyId, run.locationSeed, run.flags);
  const ev = evaluateAction({ state, run, scenario: s, action: a, built, acting: actingSquadIds, support: supportSquadIds });
  return toView(state, run, a, ev, []);
}

// ---------------------------------------------------------------- prep and debrief

export function prepCheck(state: GameState, now: number, cmd: StartOperationCommand): PrepCheck {
  const c = checkStart(state, now, cmd);
  return { ok: c.issues.length === 0, issues: c.issues, warnings: c.warnings };
}

/** Debrief for the active run in 'debrief' status, computed without mutating state. */
export function pendingDebrief(state: GameState): DebriefResult | null {
  const run = state.activeRun;
  if (!run || run.status !== 'debrief') return null;
  return computeDebrief(state, run);
}

/** Last committed decision, for the result toast and map animation. */
export function lastResolution(state: GameState): DecisionResolution | null {
  return state.activeRun?.history.at(-1) ?? null;
}

/** Developer trace of a resolution's inputs, for tuning views. */
export function resolutionTrace(res: DecisionResolution): string[] {
  return res.inputs.map((c) => `${c.label}: ${c.value}`);
}

/** Complete durable decision log. Uses committed deltas; legacy saves replay their versioned content. */
export function decisionViews(state: GameState): DecisionView[] {
  const run = state.activeRun;
  const scenario = run ? getScenario(run.scenarioId) : null;
  if (!run || !scenario) return [];
  return decisionViewsFor(state, run, scenario);
}

export function lastDecisionView(state: GameState): DecisionView | null {
  return decisionViews(state).at(-1) ?? null;
}
