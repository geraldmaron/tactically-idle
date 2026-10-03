import { actionEquipmentRequirements, effectiveTags, normalizedActionConsumption, operatorQualified, orderActionParticipants } from './equipment-requirements';
import { evaluateCapabilities } from './capabilities';
import { getScenario } from './scenario-registry';
// Operation resolution: eligibility, contributors, score, probability and strain.
// Pure functions of (state, run, scenario, action, squads). No randomness is drawn
// here; the engine draws exactly one saved sample per committed decision and
// calls bandFor() with it.
//
// Formula (see RESOLUTION_TUNING):
//   score      = sum of non-'difficulty' contributors
//   difficulty = base difficulty + 'difficulty' modifiers
//   margin     = score - difficulty
//   outcome    = margin + (sample - 0.5) * SPAN, compared with two thresholds
// Every point of margin is carried by a named Contributor, so the trace is the
// calculation. Officers contribute by seat order (best first) with sharply
// diminishing weight, bounded by the target space's useful capacity.
import type {
  BuiltLocation,
  Contributor,
  GameState,
  Id,
  ItemDefinition,
  ItemUnit,
  LocationDefinition,
  MapOverlay,
  OperationRun,
  Officer,
  OpeningState,
  OutcomeBand,
  RatingKey,
  RiskBand,
  SquadId,
  Vec,
} from './types';
import type { ActionDefinition, CheckKind, Condition, EquipmentEffect, ScenarioDefinition } from './scenario-types';
import { buildLocation, deriveLocation } from './location';
import { highRiskAllowed } from './officer';
import { squadUnits, unitEffectiveness } from './inventory';
import { ageYears, experienceBand, gameDay } from './calendar';
import { signalBetween } from './spatial';
import {
  assessSignal,
  centroidOf,
  entryExposure,
  rangeThroughOpening,
  rangeToPoint,
  resolveSubject,
  routeBetween,
  SPATIAL_TUNING,
  standingCandidates,
  standingFromPoint,
  standingOf,
  stagingFacing,
  type EntryExposure,
  type RangeResult,
  type Route,
  type SignalAssessment,
  type Standing,
  type Subject,
} from './spatial-factors';
import { ITEMS } from '../content/items';
import { projectedCondition } from './equipment';

export const RESOLUTION_TUNING = {
  /** Rating (0..100) to score points for the lead seat. */
  ratingScale: 0.55,
  /** Seat weights: best officer first. Later seats add little. */
  seats: [1, 0.35, 0.2, 0.1, 0.1],
  /** Spread of the saved sample around the expected margin, in score points. */
  span: 60,
  /** Outcome >= this is favorable; < adverseAt is adverse. */
  favorableAt: 8,
  adverseAt: -12,
  /** Fixed tails of the sample: chance of a setback / a lucky break at any margin. */
  setbackChance: 0.04,
  luckChance: 0.03,
  /** Fraction of a rating contribution lost at stress 100 (linear from 15). */
  conditionMax: 0.55,
  conditionFrom: 15,
  /** Pressure penalty for the lead seat at full pressure with zero composure. */
  pressureMax: 22,
  pressureFrom: 25,
  /** Share of the pressure penalty that composure 100 removes. */
  composureShield: 0.8,
  workloadScore: 0.8,
  travelScore: 0.4,
  bandTime: { favorable: 1, mixed: 1.2, adverse: 1.5 } as Record<OutcomeBand, number>,
  bandStress: { favorable: 0.7, mixed: 1, adverse: 1.5 } as Record<OutcomeBand, number>,
  /** How much each check kind is degraded by pressure. */
  pressureSensitivity: {
    contact: 1,
    observation: 0.6,
    execution: 1.2,
    pressure: 1.6,
    medical: 1,
    coordination: 0.8,
  } as Record<CheckKind, number>,
  supportRank: 0.6,
};

/** Officer experience and age (see docs/phase2-simulation.md section 5). Proposed values. */
export const EXPERIENCE_TUNING = {
  /** Situation pressure at or above which experience bands matter (pressure-kind checks always count). */
  pressureOn: 50,
  rookiePenalty: -2,
  rookieStrain: 1.15,
  seasonedBonus: 2,
  veteranBonus: 4,
  mentoring: 2,
  /** Strain share per 5 years of age over this. */
  ageStrainFrom: 50,
  ageStrainPer5: 0.05,
  /** Malfunction risk: share of an unreliable unit's lost effect charged as a separate negative contributor. */
  malfunctionShare: 0.5,
  /** Radio link: share of a support squad's coordination carried by the radio. */
  radioShare: 0.5,
};

export const RATING_LABEL: Record<RatingKey, string> = {
  shooting: 'shooting',
  composure: 'composure',
  communication: 'communication',
  awareness: 'awareness',
  medical: 'medical response',
  coordination: 'coordination',
};

export const CERT_LABEL: Record<string, string> = {
  crisis_negotiation: 'crisis negotiator',
  entry_team: 'entry-trained officer',
  advanced_first_aid: 'advanced first aider',
  surveillance: 'surveillance specialist',
  drone_operator: 'drone operator',
  less_lethal: 'less-lethal qualified officer',
  advanced_less_lethal: 'advanced less-lethal qualified officer',
  deescalation: 'de-escalation qualified officer',
  vehicle_operations: 'qualified vehicle operator',
  precision_support: 'qualified specialist support officer',
  controlled_access: 'controlled-access qualified officer',
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export const squadLabel = (id: SquadId) => `Squad ${id}`;

// ---------------------------------------------------------------- location views

const builtCache = new Map<string, BuiltLocation>();

/** buildLocation, memoized per (family, seed). */
export function getBuilt(familyId: Id, seed: number): BuiltLocation {
  const key = `${familyId}:${seed}`;
  let b = builtCache.get(key);
  if (!b) {
    b = buildLocation(familyId, seed);
    builtCache.set(key, b);
  }
  return b;
}

const OPENING_PREFIX = 'opening:';
export const openingFlag = (openingId: Id, state: OpeningState) => `${OPENING_PREFIX}${openingId}=${state}`;

/** Opening-state overrides committed by decisions are stored as run flags. */
export function openingOverrides(flags: string[]): Record<Id, OpeningState> {
  const out: Record<Id, OpeningState> = {};
  for (const f of flags) {
    if (!f.startsWith(OPENING_PREFIX)) continue;
    const [id, st] = f.slice(OPENING_PREFIX.length).split('=');
    if (id && st) out[id] = st as OpeningState;
  }
  return out;
}

const overrideCache = new Map<string, BuiltLocation>();

/** The location as it stands now: base layout plus opening states changed during the run. */
export function builtFor(familyId: Id, seed: number, flags: string[]): BuiltLocation {
  const base = getBuilt(familyId, seed);
  const ov = openingOverrides(flags);
  const keys = Object.keys(ov).sort();
  if (keys.length === 0) return base;
  const key = `${familyId}:${seed}:${keys.map((k) => `${k}=${ov[k]}`).join(',')}`;
  let b = overrideCache.get(key);
  if (!b) {
    const location: LocationDefinition = structuredClone(base.location);
    for (const o of location.openings) if (ov[o.id]) o.state = ov[o.id];
    b = { location, derived: deriveLocation(location), issues: base.issues };
    overrideCache.set(key, b);
  }
  return b;
}

/** Exterior zones with an opening (window, door) onto the space. */
export function vantageZones(location: LocationDefinition, spaceId: Id): Id[] {
  const zones = new Set(location.zones.map((z) => z.id));
  const out = new Set<Id>();
  for (const o of location.openings) {
    if (o.a === spaceId && zones.has(o.b)) out.add(o.b);
    if (o.b === spaceId && zones.has(o.a)) out.add(o.a);
  }
  return [...out];
}

export function spaceName(built: BuiltLocation, id: Id): string {
  return (
    built.location.rooms.find((r) => r.id === id)?.label ?? built.location.zones.find((z) => z.id === id)?.label ?? id
  );
}

// ---------------------------------------------------------------- conditions and bands

export function conditionHolds(c: Condition | undefined, run: Pick<OperationRun, 'knowledge' | 'flags' | 'pressure'>): boolean {
  if (!c) return true;
  for (const f of c.facts ?? []) if (!f.in.includes(run.knowledge[f.factId] ?? 'unknown')) return false;
  for (const f of c.flags ?? []) if (!run.flags.includes(f)) return false;
  for (const f of c.notFlags ?? []) if (run.flags.includes(f)) return false;
  if (c.pressureAtLeast !== undefined && run.pressure < c.pressureAtLeast) return false;
  if (c.pressureBelow !== undefined && run.pressure >= c.pressureBelow) return false;
  return true;
}

/**
 * Map a saved sample to an outcome band for a given margin (score - difficulty).
 * The extreme ends of the sample are fixed: a small setback chance and a small
 * lucky-break chance exist at any margin, so no amount of skill is a guarantee.
 */
export function bandFor(margin: number, sample: number): OutcomeBand {
  const T = RESOLUTION_TUNING;
  if (sample < T.setbackChance) return 'adverse';
  if (sample >= 1 - T.luckChance) return 'favorable';
  const u = (sample - T.setbackChance) / (1 - T.setbackChance - T.luckChance);
  const e = margin + (u - 0.5) * T.span;
  if (e >= T.favorableAt) return 'favorable';
  if (e < T.adverseAt) return 'adverse';
  return 'mixed';
}

export function bandProbabilities(margin: number): { favorable: number; mixed: number; adverse: number } {
  const T = RESOLUTION_TUNING;
  const core = 1 - T.setbackChance - T.luckChance;
  const rawFav = clamp(0.5 + (margin - T.favorableAt) / T.span, 0, 1);
  const rawAdv = clamp(0.5 + (T.adverseAt - margin) / T.span, 0, 1);
  const favorable = T.luckChance + core * rawFav;
  const adverse = T.setbackChance + core * rawAdv;
  return { favorable, adverse, mixed: Math.max(0, 1 - favorable - adverse) };
}

/** Risk band for display, from the estimated favorable probability. */
export function riskBand(pFavorable: number): RiskBand {
  if (pFavorable >= 0.62) return 'low';
  if (pFavorable >= 0.42) return 'moderate';
  if (pFavorable >= 0.22) return 'high';
  return 'severe';
}

// ---------------------------------------------------------------- units

function itemUnlocked(state: GameState, itemId: Id): boolean {
  const def = ITEMS[itemId];
  if (!def) return false;
  const owned = Object.values(state.units).some((u) => u.itemId === itemId && u.status !== 'scrapped');
  return !def.requiresNode || state.department.unlockedNodes.includes(def.requiresNode) || owned;
}

/** Practice assumes one fresh unit of every item the department owns or has unlocked. Never wears. */
export function practiceUnits(state: GameState, allEquipment = false): ItemUnit[] {
  const out: ItemUnit[] = [];
  for (const id of Object.keys(ITEMS)) {
    const owned = Object.values(state.units).some((u) => u.itemId === id && u.status !== 'scrapped');
    if (!ITEMS[id].supportOnly && (allEquipment || owned || itemUnlocked(state, id)))
      out.push({ id: `practice_${id}`, itemId: id, serial: 'PRACTICE', condition: 100, acquiredAt: 0, uses: 0, status: 'reserved', serviceUntil: null, wearRate: 1, expiresAt: null, lastWearAt: 0 });
  }
  return out;
}

/** Units a squad still holds in a run: its reservations minus consumables already used by committed decisions. */
export function availableUnits(state: GameState, run: OperationRun, sq: SquadId): ItemUnit[] {
  if (run.practice) return practiceUnits(state, getScenario(run.scenarioId)?.practiceOnly === true);
  const spent = new Set(run.history.flatMap((h) => h.unitsUsed));
  return squadUnits(state, run.id, sq).filter((u) => ITEMS[u.itemId] && !(ITEMS[u.itemId].kind === 'consumable' && spent.has(u.id)));
}

const effOf = (u: ItemUnit) => {
  const def = ITEMS[u.itemId];
  return def ? unitEffectiveness(u, def) : 0;
};

/** Working unit with the highest effectiveness carrying a tag. */
function bestOf(units: ItemUnit[], tag: string): ItemUnit | null {
  let best: ItemUnit | null = null;
  let bestEff = 0;
  for (const u of [...units].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!ITEMS[u.itemId]?.tags.includes(tag)) continue;
    const e = effOf(u);
    if (e > bestEff) {
      best = u;
      bestEff = e;
    }
  }
  return best;
}

function tagsOf(units: ItemUnit[]): Set<string> {
  const t = new Set<string>();
  for (const u of units) if (effOf(u) > 0) for (const tag of ITEMS[u.itemId]?.tags ?? []) t.add(tag);
  return t;
}

export interface Use {
  squadId: SquadId;
  itemId: Id;
  /** The specific physical unit. */
  unitId: Id;
  qty: number;
  consumable: boolean;
}

/** Take consumable units from acting squads (then supporters) in order. null when short. */
function planConsumption(state: GameState, action: ActionDefinition, acting: SquadId[], support: SquadId[], units: Record<SquadId, ItemUnit[]>): Use[] | null {
  const uses: Use[] = [];
  const taken = new Set<Id>();
  for (const c of normalizedActionConsumption(action)) {
    let need = c.qty;
    for (const sq of [...acting, ...support]) {
      const pool = (units[sq] ?? [])
        .filter((u) => !taken.has(u.id) && effOf(u) > 0 && ITEMS[u.itemId]?.tags.includes(c.tag) && acting.some((sid) => operatorQualified(state, sid, action, ITEMS[u.itemId])))
        .sort((a, b) => effOf(b) - effOf(a) || a.id.localeCompare(b.id));
      for (const u of pool) {
        if (need <= 0) break;
        taken.add(u.id);
        uses.push({ squadId: sq, itemId: u.itemId, unitId: u.id, qty: 1, consumable: ITEMS[u.itemId]?.kind === 'consumable' });
        need -= 1;
      }
      if (need <= 0) break;
    }
    if (need > 0) return null;
  }
  return uses;
}

// ---------------------------------------------------------------- evaluation

export interface EvalInput {
  state: GameState;
  run: OperationRun;
  scenario: ScenarioDefinition;
  action: ActionDefinition;
  built: BuiltLocation;
  acting: SquadId[];
  support: SquadId[];
  /** Pre-deployment preview: use these units per squad instead of reservations. */
  unitOverride?: Record<SquadId, ItemUnit[]>;
}

export interface Arrival {
  squadId: SquadId;
  spaceId: Id;
  role: 'acting' | 'support';
  stagingId: Id | null;
  at: Vec;
}

export interface Evaluation {
  action: ActionDefinition;
  acting: SquadId[];
  support: SquadId[];
  eligible: boolean;
  reason: string | null;
  /** Officers whose ratings count, in seat order (lead first). */
  participantIds: Id[];
  excluded: { officerId: Id; reason: string }[];
  leadId: Id | null;
  contributors: Contributor[];
  score: number;
  difficulty: number;
  margin: number;
  pFavorable: number;
  pAdverse: number;
  risk: RiskBand;
  /** Operation minutes in the favorable case (workload + travel + entry). */
  timeBase: number;
  /** Probability-weighted minutes including slower mixed/adverse results. */
  timeExpected: number;
  travelMinutes: number;
  workloadMinutes: number;
  /** Where each acting / supporting squad ends up when the action is committed. */
  arrivals: Arrival[];
  /** Specific units used (reusable gear and consumables). Consumables are also what leaves inventory. */
  uses: Use[];
  /** Fact ids this action can change or depends on that are still unresolved. */
  unresolvedFacts: Id[];
  uncertainty: string[];
  details: string[];
  highRisk: boolean;
  /** Map overlays for the spatial factors in `contributors`. */
  overlays: MapOverlay[];
  /** Strain multiplier from distance into the room (entry actions), 1 otherwise. */
  exposureMult: number;
}

function relatedFactIds(a: ActionDefinition): Set<Id> {
  const ids = new Set<Id>();
  const cond = (c?: Condition) => c?.facts?.forEach((f) => ids.add(f.factId));
  for (const f of a.requires.facts ?? []) ids.add(f.factId);
  for (const m of a.modifiers ?? []) cond(m.when);
  for (const band of Object.values(a.outcomes))
    for (const e of band) {
      cond(e.when);
      e.knowledge?.forEach((k) => ids.add(k.factId));
      e.reveal?.forEach((id) => ids.add(id));
    }
  return ids;
}

export function conditionFraction(stress: number): number {
  const T = RESOLUTION_TUNING;
  return clamp(((stress - T.conditionFrom) / (100 - T.conditionFrom)) * T.conditionMax, 0, T.conditionMax);
}

function aptitude(o: Officer, a: ActionDefinition): { value: number; parts: { key: RatingKey; rating: number }[] } {
  const kind = a.check.kind;
  // Shooting proficiency only ever counts toward execution checks.
  const ws = a.check.ratings.filter((r) => r.weight > 0 && (r.key !== 'shooting' || kind === 'execution'));
  const total = ws.reduce((s, r) => s + r.weight, 0) || 1;
  let value = 0;
  const parts: { key: RatingKey; rating: number }[] = [];
  for (const r of ws) {
    value += (r.weight / total) * o.ratings[r.key];
    parts.push({ key: r.key, rating: o.ratings[r.key] });
  }
  return { value, parts };
}

function names(items: string[], joiner = 'or'): string {
  const uniq = [...new Set(items)];
  if (uniq.length <= 1) return uniq[0] ?? '';
  return `${uniq.slice(0, -1).join(', ')} ${joiner} ${uniq[uniq.length - 1]}`;
}

export function tagNames(tags: string[]): string {
  const out: string[] = [];
  for (const t of tags) {
    const item = Object.values(ITEMS).find((i) => i.tags.includes(t));
    out.push(item ? item.name.toLowerCase() : t);
  }
  return names(out);
}

function listSquads(ids: SquadId[]): string {
  if (ids.length === 1) return squadLabel(ids[0]);
  return ids.map(squadLabel).join(' and ');
}

/** Experience pressure applies on pressure-kind checks and whenever the situation is tense. */
function underPressure(run: Pick<OperationRun, 'pressure'>, kind: CheckKind): boolean {
  return kind === 'pressure' || run.pressure >= EXPERIENCE_TUNING.pressureOn;
}

/** Strain multiplier for age over 50: +5% per 5 years. */
export function ageStrainMult(ageYearsNow: number): number {
  const E = EXPERIENCE_TUNING;
  return 1 + (E.ageStrainPer5 * Math.max(0, ageYearsNow - E.ageStrainFrom)) / 5;
}

// ---------------------------------------------------------------- planning one squad's standing

interface EquipPick {
  eq: EquipmentEffect;
  squad: SquadId;
  unit: ItemUnit;
  def: ItemDefinition;
  /** Contribution after unit effectiveness and range. */
  value: number;
  /** Contribution of a healthy unit in range, for the malfunction share. */
  full: number;
  eff: number;
  range: RangeResult | null;
}

interface Plan {
  squad: SquadId;
  stand: Standing;
  /** Vantage zone claimed (window approach). */
  zone: Id | null;
  route: Route | null;
  travel: number;
  signal: SignalAssessment | null;
  picks: EquipPick[];
  /** Range reasons for carried equipment that cannot be used from here. */
  blocked: { tag: Id; reason: string }[];
  toolUnit: ItemUnit | null;
  missingRequired: boolean;
  score: number;
}

export function evaluateAction(input: EvalInput): Evaluation {
  const { state, run, scenario, action, built } = input;
  const T = RESOLUTION_TUNING;
  const E = EXPERIENCE_TUNING;
  const kind = action.check.kind;
  const acting = [...new Set(input.acting)];
  const support = [...new Set(input.support)].filter((s) => !acting.includes(s));
  const location = built.location;
  const derived = built.derived;
  const highRisk = kind === 'execution';
  const reasons: string[] = [];
  const contributors: Contributor[] = [];
  const details: string[] = [];
  const overlays: MapOverlay[] = [];

  const blank = (reason: string): Evaluation => ({
    action,
    acting,
    support,
    eligible: false,
    reason,
    participantIds: [],
    excluded: [],
    leadId: null,
    contributors: [{ label: 'Base difficulty', value: -action.check.difficulty, source: 'difficulty' }],
    score: 0,
    difficulty: action.check.difficulty,
    margin: -action.check.difficulty,
    pFavorable: 0,
    pAdverse: 1,
    risk: 'severe',
    timeBase: 0,
    timeExpected: 0,
    travelMinutes: 0,
    workloadMinutes: 0,
    arrivals: [],
    uses: [],
    unresolvedFacts: [],
    uncertainty: [],
    details: [],
    highRisk,
    overlays: [],
    exposureMult: 1,
  });

  // ---- squad validity
  if (run.history.some((h) => h.stage === action.stage && h.actionId === action.id)) return blank('Already tried this stage');
  if (!conditionHolds(action.visibleWhen, run)) return blank('That option does not fit the current situation');
  if (acting.length === 0) return blank('Choose an acting squad');
  for (const sq of [...acting, ...support]) if (!run.squadIds.includes(sq)) return blank(`${squadLabel(sq)} is not deployed`);
  const maxActing = action.maxActing ?? 1;
  if (acting.length > maxActing) return blank(`Only ${maxActing} squad${maxActing === 1 ? '' : 's'} can act on this`);
  if (support.length > 0 && !action.support) return blank('This option does not use support squads');
  if (action.support && support.length > action.support.maxSquads) return blank(`At most ${action.support.maxSquads} support squad${action.support.maxSquads === 1 ? '' : 's'}`);

  const units: Record<SquadId, ItemUnit[]> = {} as Record<SquadId, ItemUnit[]>;
  for (const sq of [...acting, ...support, ...run.squadIds]) units[sq] ??= input.unitOverride?.[sq] ?? availableUnits(state, run, sq).map((unit) => run.practice ? unit : ({ ...unit, condition: projectedCondition(state, unit, state.department.clockHighWater) }));
  const taskOf = (sq: SquadId) => run.squadTasks.find((t) => t.squadId === sq) ?? { squadId: sq, positionId: '', task: '', stagingId: null, at: null };
  const actingTags = new Set<string>();
  for (const sq of acting) for (const t of tagsOf(units[sq].filter((u) => ITEMS[u.itemId] && operatorQualified(state, sq, action, ITEMS[u.itemId])))) actingTags.add(t);
  const supportHas = (tag: string) => support.some((sq) => tagsOf(units[sq]).has(tag));
  const actingHas = (tag: string) => actingTags.has(tag);

  // ---- requirement gates, in reading order
  const req = { ...action.requires, allTags: effectiveTags(action.requires.allTags), anyTags: action.requires.anyTags?.some((t) => t === 'battery') ? [] : effectiveTags(action.requires.anyTags) };
  if (req.minSquads && acting.length + support.length < req.minSquads.count) reasons.push(req.minSquads.reason);
  for (const f of req.facts ?? []) if (!f.in.includes(run.knowledge[f.factId] ?? 'unknown')) reasons.push(f.reason);
  for (const f of req.flags ?? []) if (!run.flags.includes(f.flag)) reasons.push(f.reason);
  for (const f of req.notFlags ?? []) if (run.flags.includes(f.flag)) reasons.push(f.reason);
  for (const o of req.openings ?? []) {
    const st = location.openings.find((x) => x.id === o.openingId)?.state;
    if (st === 'blocked') reasons.push(o.blockedReason);
  }

  // ---- participants
  const squadOf = new Map<Id, SquadId>();
  const candidates: Officer[] = [];
  for (const sq of acting) {
    const squad = state.squads.find((s) => s.id === sq);
    for (const id of squad?.officerIds ?? []) {
      const o = state.officers[id];
      if (o && !squadOf.has(id)) {
        squadOf.set(id, sq);
        candidates.push(o);
      }
    }
  }
  const excluded: { officerId: Id; reason: string }[] = [];
  const pool: Officer[] = [];
  for (const o of candidates) {
    if (highRisk && !highRiskAllowed(o)) {
      excluded.push({ officerId: o.id, reason: `${o.surname} is overloaded and sits out high-risk work` });
      contributors.push({ label: `${o.surname}: overloaded, sits out high-risk work`, value: 0, source: 'condition', ref: o.id });
    } else pool.push(o);
  }

  const certs = req.certs ?? [];
  for (const cert of certs) {
    if (!pool.some((o) => o.certs.includes(cert))) {
      const sidelined = candidates.find((o) => o.certs.includes(cert) && excluded.some((e) => e.officerId === o.id));
      if (sidelined) reasons.push(`${sidelined.surname} is overloaded and cannot take high-risk work`);
      else {
        const who = acting.length === 1 ? `${squadLabel(acting[0])} has none` : `none of ${listSquads(acting)} has one`;
        reasons.push(`Needs a ${CERT_LABEL[cert] ?? cert} — ${who}`);
      }
    }
  }
  if (req.anyTags.length && !req.anyTags.some(actingHas)) {
    reasons.push(`No ${tagNames(req.anyTags)} in ${listSquads(acting)}'s loadout`);
  }
  for (const t of req.allTags ?? []) if (!actingHas(t)) reasons.push(`No ${tagNames([t])} in ${listSquads(acting)}'s loadout`);

  const consumption = planConsumption(state, action, acting, support, units);
  if (consumption === null) {
    for (const c of normalizedActionConsumption(action)) {
      if (!actingHas(c.tag) && !supportHas(c.tag)) {
        const msg = `No ${tagNames([c.tag])} in ${listSquads(acting)}'s loadout`;
        if (!reasons.includes(msg)) reasons.push(msg);
      } else reasons.push(`Not enough ${tagNames([c.tag])} left (needs ${c.qty})`);
    }
  }

  // ---- capacity
  const capSpaces = action.capacityBound ?? [];
  let cap = action.maxParticipants ?? 99;
  let capSpace: Id | null = null;
  for (const id of capSpaces) {
    const c = derived.spaces[id]?.capacity ?? 99;
    if (c < cap) {
      cap = c;
      capSpace = id;
    }
  }

  // ---- seat order: cert holders lead, then by effective aptitude
  const ordered = orderActionParticipants(pool, action);
  const participants = ordered.slice(0, Math.max(0, cap));
  const benched = ordered.slice(participants.length);
  if (participants.length === 0) {
    const sidelined = excluded[0];
    reasons.push(sidelined ? `No one in ${listSquads(acting)} can take high-risk work (${sidelined.reason.split(' is ')[0]} is overloaded)` : `No officer in ${listSquads(acting)} can take part`);
  }
  if (benched.length > 0 && capSpace) {
    const n = benched.length;
    contributors.push({
      label: `${spaceName(built, capSpace)} fits ${cap}: ${n} officer${n === 1 ? '' : 's'} can't contribute`,
      value: 0,
      source: 'space',
      ref: capSpace,
    });
    details.push(`${spaceName(built, capSpace)} fits ${cap}: only ${cap} officer${cap === 1 ? '' : 's'} can work there at once.`);
  } else if (benched.length > 0) {
    details.push(`At most ${cap} officers take part; the rest stay ready.`);
  }

  // ---- difficulty
  let difficulty = action.check.difficulty;
  const diffContribs: Contributor[] = [{ label: 'Base difficulty', value: -difficulty, source: 'difficulty' }];
  const modContribs: Contributor[] = [];
  for (const m of action.modifiers ?? []) {
    if (!conditionHolds(m.when, run)) continue;
    if (m.source === 'difficulty') {
      difficulty += m.value;
      diffContribs.push({ label: m.label, value: -m.value, source: 'difficulty' });
    } else {
      modContribs.push({ label: m.label, value: m.value, source: m.source });
    }
  }

  // ---- officer contributions
  const day = gameDay(state, run.startedAt);
  const pressured = underPressure(run, kind);
  const pLevel = clamp((run.pressure - T.pressureFrom) / (100 - T.pressureFrom), 0, 1);
  const sens = T.pressureSensitivity[kind];
  const mentorSquads = new Set<SquadId>();
  for (const sq of acting) {
    const squad = state.squads.find((s) => s.id === sq);
    if (squad?.officerIds.some((id) => state.officers[id]?.traits.includes('mentor'))) mentorSquads.add(sq);
  }
  const hasUnresolvedReport = Object.values(run.knowledge).includes('reported');
  const lead = participants[0] ?? null;
  participants.forEach((o, i) => {
    const seat = T.seats[i] ?? T.seats[T.seats.length - 1];
    const { value, parts } = aptitude(o, action);
    const base = value * seat * T.ratingScale;
    contributors.push({
      label: `${o.surname}: ${parts.map((p) => `${RATING_LABEL[p.key]} ${p.rating}`).join(', ')}`,
      value: round1(base),
      source: 'rating',
      ref: o.id,
    });
    const lost = base * conditionFraction(o.stress);
    if (lost >= 0.05) contributors.push({ label: `${o.surname}: strain (${Math.round(o.stress)})`, value: round1(-lost), source: 'condition', ref: o.id });
    const pen = seat * T.pressureMax * pLevel * sens * (1 - T.composureShield * (o.ratings.composure / 100));
    if (pen >= 0.05)
      contributors.push({ label: `${o.surname}: time pressure (composure ${o.ratings.composure} limits it)`, value: round1(-pen), source: 'pressure', ref: o.id });
    // Traits apply only when their documented condition is present.
    if (o.traits.includes('calm_voice') && kind === 'contact') contributors.push({ label: `${o.surname}: calm voice on the line`, value: round1(6 * seat), source: 'trait', ref: o.id });
    if (o.traits.includes('observant') && kind === 'observation' && hasUnresolvedReport)
      contributors.push({ label: `${o.surname}: observant, spots inconsistent reports`, value: round1(6 * seat), source: 'trait', ref: o.id });
    if (o.traits.includes('impatient')) {
      if (action.tempo === 'waiting') contributors.push({ label: `${o.surname}: impatient, poor at waiting`, value: round1(-5 * seat), source: 'trait', ref: o.id });
      else if (run.pressure >= 50) contributors.push({ label: `${o.surname}: impatient, sharper under pressure`, value: round1(4 * seat), source: 'trait', ref: o.id });
    }
    if (o.traits.includes('rookie')) {
      const sq = squadOf.get(o.id);
      const mentored = sq ? mentorSquads.has(sq) : false;
      contributors.push({
        label: mentored ? `${o.surname}: rookie, steadied by a mentor` : `${o.surname}: rookie, still learning`,
        value: round1((mentored ? -1 : -4) * seat),
        source: 'trait',
        ref: o.id,
      });
    }
    // Experience band, from service and operations at the run's game day.
    const band = experienceBand(o, day);
    if (pressured) {
      if (band === 'rookie') contributors.push({ label: `${o.surname}: rookie under pressure ${E.rookiePenalty}`, value: round1(E.rookiePenalty * seat), source: 'familiarity', ref: o.id });
      else if (band === 'seasoned') contributors.push({ label: `${o.surname}: seasoned under pressure +${E.seasonedBonus}`, value: round1(E.seasonedBonus * seat), source: 'familiarity', ref: o.id });
      else if (band === 'veteran') contributors.push({ label: `${o.surname}: veteran under pressure +${E.veteranBonus}`, value: round1(E.veteranBonus * seat), source: 'familiarity', ref: o.id });
    }
    if (band === 'rookie') {
      const sq = squadOf.get(o.id);
      const mentor = (state.squads.find((s) => s.id === sq)?.officerIds ?? []).map((id) => state.officers[id]).find((m) => m && m.id !== o.id && experienceBand(m, day) === 'veteran');
      if (mentor) contributors.push({ label: `${mentor.surname}: mentoring ${o.surname} +${E.mentoring}`, value: round1(E.mentoring * seat), source: 'familiarity', ref: o.id });
    }
    const age = ageYears(o, day);
    if (age > E.ageStrainFrom) {
      const pct = Math.round((ageStrainMult(age) - 1) * 100);
      if (pct >= 1) contributors.push({ label: `${o.surname}: age ${Math.floor(age)}, +${pct}% strain`, value: 0, source: 'condition', ref: o.id });
    }
  });
  if (action.certBonus) {
    const holder = participants.find((o) => o.certs.includes(action.certBonus!.cert));
    if (holder) contributors.push({ label: `${holder.surname}: ${action.certBonus.label}`, value: action.certBonus.value, source: 'preparation', ref: holder.id });
  }

  // ---- where each acting squad stands: spatial signal, equipment range, route
  const spec = action.spatial;
  const narrow = cap <= 1;
  const subject: Subject | null = spec ? resolveSubject(scenario, built, run.knowledge, action.targetId, spec.subjectFactId) : null;
  const requiredAll = actionEquipmentRequirements(action).groups.filter((g) => g.tags.length === 1).flatMap((g) => g.tags);
  const anyTags = req.anyTags ?? [];

  const picksAt = (sq: SquadId, at: Vec): { picks: EquipPick[]; blocked: Plan['blocked'] } => {
    const byGroup = new Map<string, EquipPick>();
    const blocked: Plan['blocked'] = [];
    for (const eq of action.equipment ?? []) {
      const unit = bestOf(units[sq].filter((u) => ITEMS[u.itemId] && operatorQualified(state, sq, action, ITEMS[u.itemId])), eq.tag);
      if (!unit) continue;
      const def = ITEMS[unit.itemId];
      let range: RangeResult | null = null;
      if (eq.range === 'target' && subject) range = rangeToPoint(def, at, subject.at);
      else if (eq.range === 'opening') range = rangeThroughOpening(built, def, at, action.targetId);
      if (range && !range.ok) {
        blocked.push({ tag: eq.tag, reason: range.reason ?? `${def.name} is out of range` });
        continue;
      }
      const full = narrow && eq.narrowValue !== undefined ? eq.narrowValue : eq.value;
      const e = unitEffectiveness(unit, def);
      const value = full * e * (range?.factor ?? 1);
      const g = eq.group ?? eq.tag;
      const cur = byGroup.get(g);
      if (!cur || value > cur.value) byGroup.set(g, { eq, squad: sq, unit, def, value, full, eff: e, range });
    }
    return { picks: [...byGroup.values()], blocked };
  };

  const plans: Plan[] = [];
  const claimed = new Set<Id>();
  const sortedActing = [...acting].sort((a, b) => (derived.distance[taskOf(a).positionId]?.[action.targetId] ?? 99) - (derived.distance[taskOf(b).positionId]?.[action.targetId] ?? 99));
  const vantage = action.approach === 'window' ? vantageZones(location, action.targetId) : [];
  for (const sq of sortedActing) {
    const task = taskOf(sq);
    const start = standingOf(built, task);
    const tool = bestOf(units[sq], 'entry_tool');
    const toolArg = tool ? { effectiveness: effOf(tool) } : null;
    const routeTo = (spaceId: Id, at: Vec) => routeBetween(built, task.positionId, start.at, spaceId, at, toolArg);

    // candidate standing points
    let cands: { stand: Standing; zone: Id | null }[] = [];
    if (action.approach === 'none') cands = [{ stand: start, zone: null }];
    else if (spec) {
      const mode = action.approach === 'window' ? 'outside' : 'inside';
      cands = standingCandidates(built, action.targetId, mode, spec.openingId).map((p) => ({ stand: standingFromPoint(p), zone: action.approach === 'window' ? p.spaceId : null }));
    }
    if (cands.length === 0 && action.approach === 'window' && vantage.length > 0) {
      for (const z of vantage) {
        const p = stagingFacing(built, z, action.targetId);
        cands.push({ stand: p ? standingFromPoint(p) : { stagingId: null, at: centroidOf(built, z), spaceId: z, openingId: null, kind: 'ground' }, zone: z });
      }
    }
    if (cands.length === 0 && action.approach === 'path') {
      const centre = centroidOf(built, action.targetId);
      const first = routeTo(action.targetId, centre);
      const inner = first.lastOpeningId ? derived.stagingPoints.find((p) => p.spaceId === action.targetId && p.openingId === first.lastOpeningId) : undefined;
      cands = [{ stand: inner ? standingFromPoint(inner) : { stagingId: null, at: centre, spaceId: action.targetId, openingId: null, kind: 'ground' }, zone: null }];
    }
    if (cands.length === 0) cands = [{ stand: start, zone: null }];
    const fresh = cands.filter((c) => !c.zone || !claimed.has(c.zone));
    const pickFrom = fresh.length > 0 ? fresh : cands;

    let bestPlan: Plan | null = null;
    for (const c of pickFrom) {
      const moving = action.approach !== 'none';
      const route = moving ? routeTo(c.stand.spaceId, c.stand.at) : null;
      if (route && !route.reachable) continue;
      const signal = spec && subject ? assessSignal(built, c.stand.at, subject.at, spec.channel, spec.noun) : null;
      const { picks, blocked } = picksAt(sq, c.stand.at);
      const pickedTags = new Set(picks.map((p) => p.eq.tag));
      const carriedAny = anyTags.filter((t) => tagsOf(units[sq]).has(t));
      const missingRequired =
        requiredAll.some((t) => blocked.some((b) => b.tag === t) && !pickedTags.has(t)) ||
        (carriedAny.length > 0 && !carriedAny.some((t) => pickedTags.has(t)));
      const travel = route?.minutes ?? 0;
      const score = (signal && spec ? spec.weight * signal.quality : 0) + picks.reduce((t, p) => t + p.value, 0) - T.travelScore * travel - (missingRequired ? 1000 : 0);
      const plan: Plan = { squad: sq, stand: c.stand, zone: c.zone, route, travel, signal, picks, blocked, toolUnit: tool, missingRequired, score };
      if (!bestPlan || plan.score > bestPlan.score + 1e-9 || (Math.abs(plan.score - bestPlan.score) <= 1e-9 && (plan.stand.stagingId ?? '') < (bestPlan.stand.stagingId ?? ''))) bestPlan = plan;
    }
    if (!bestPlan) {
      reasons.push(`${squadLabel(sq)} can't reach the ${spaceName(built, action.targetId).toLowerCase()} from ${spaceName(built, task.positionId)}`);
      bestPlan = { squad: sq, stand: start, zone: null, route: null, travel: 0, signal: null, picks: [], blocked: [], toolUnit: tool, missingRequired: false, score: 0 };
    }
    if (bestPlan.zone) claimed.add(bestPlan.zone);
    plans.push(bestPlan);
  }

  // range gates: carried equipment that no acting squad can use from where it would stand
  const usedTags = new Set(plans.flatMap((p) => p.picks.map((x) => x.eq.tag)));
  const rangeReasons = plans.flatMap((p) => p.blocked);
  for (const t of requiredAll) {
    if (actingHas(t) && !usedTags.has(t)) {
      const why = rangeReasons.find((b) => b.tag === t);
      if (why) reasons.push(why.reason);
    }
  }
  if (anyTags.length > 0 && anyTags.some(actingHas) && !anyTags.some((t) => usedTags.has(t))) {
    const why = rangeReasons.find((b) => anyTags.includes(b.tag));
    if (why) reasons.push(why.reason);
  }

  // signal contributor: the best acting squad's line
  if (spec && subject) {
    const withSignal = plans.filter((p) => p.signal);
    const best = [...withSignal].sort((a, b) => b.signal!.quality - a.signal!.quality)[0];
    if (best?.signal) {
      contributors.push({ label: best.signal.label, value: round1(spec.weight * best.signal.quality), source: 'space', ref: best.stand.openingId ?? action.targetId });
      details.push(`${best.signal.label}.`);
    }
    for (const p of withSignal) if (p.signal) overlays.push(p.signal.overlay);
    if (subject.basis !== 'exact' && subject.note) details.push(`${subject.note}.`);
  }

  // ---- equipment (best of each group), recorded as used
  const bestByGroup = new Map<string, EquipPick>();
  for (const p of plans)
    for (const pick of p.picks) {
      const g = pick.eq.group ?? pick.eq.tag;
      const cur = bestByGroup.get(g);
      if (!cur || pick.value > cur.value) bestByGroup.set(g, pick);
    }
  const equipUses: Use[] = [];
  for (const b of bestByGroup.values()) {
    const worn = b.eff < 1 ? ` (${Math.round(b.eff * 100)}% effective)` : '';
    contributors.push({ label: `${b.def.name}: ${b.eq.label}${worn}`, value: round1(b.value), source: 'equipment', ref: b.def.id });
    if (b.eff < 1 && b.full > 0) {
      contributors.push({
        label: `${b.def.name} ${b.unit.serial}: condition ${Math.round(b.unit.condition)}, malfunction risk`,
        value: -round1(E.malfunctionShare * b.full * (1 - b.eff)),
        source: 'equipment',
        ref: b.unit.id,
      });
    }
    if (b.range) {
      details.push(`${b.range.label}.`);
      overlays.push(...b.range.overlays);
    }
    // Reusable gear is recorded as used (wear). A consumable already counted in `consumption` is not counted twice.
    if (b.def.kind !== 'consumable') equipUses.push({ squadId: b.squad, itemId: b.def.id, unitId: b.unit.id, qty: 1, consumable: false });
  }
  for (const u of consumption ?? []) {
    const def = ITEMS[u.itemId];
    if (def) details.push(`Uses 1 ${def.name.toLowerCase()}.`);
  }

  // ---- travel, locked doors and workload
  const arrivals: Arrival[] = [];
  const toolUses: Use[] = [];
  const targetArea = (action.workload.areaSpaces ?? [action.targetId]).reduce((s, id) => s + (derived.spaces[id]?.area ?? 0), 0);
  const extraMinutes = action.workload.perSqFt * targetArea;
  const workloadMinutes = round1(action.workload.base + extraMinutes);
  let actingTravel = 0;
  for (const p of plans) {
    actingTravel = Math.max(actingTravel, p.travel);
    arrivals.push({ squadId: p.squad, spaceId: p.stand.spaceId, role: 'acting', stagingId: p.stand.stagingId, at: p.stand.at });
    if (p.route && p.route.points.length > 1 && p.travel >= 0.5) overlays.push({ kind: 'path', points: p.route.points, label: `${squadLabel(p.squad)} route, ${round1(p.travel)} min` });
    for (const f of p.route?.forced ?? []) {
      if (f.withTool && p.toolUnit) {
        toolUses.push({ squadId: p.squad, itemId: p.toolUnit.itemId, unitId: p.toolUnit.id, qty: 1, consumable: false });
        contributors.push({ label: `${ITEMS[p.toolUnit.itemId]?.name ?? 'Entry tool'}: opens the ${f.label.toLowerCase()} in ${f.minutes} min`, value: 0, source: 'equipment', ref: p.toolUnit.itemId });
      } else contributors.push({ label: `Locked ${f.label.toLowerCase()}: ${f.minutes} min to force`, value: 0, source: 'space', ref: f.openingId });
    }
  }
  if (claimed.size > 1 && action.coveragePerVantage) {
    const v = action.coveragePerVantage * (claimed.size - 1);
    contributors.push({ label: `Wider cover: ${claimed.size} sides watched`, value: v, source: 'support' });
    details.push(`${claimed.size} vantage points are covered, which widens what can be seen.`);
  }

  // ---- entry exposure
  let exposure: EntryExposure | null = null;
  if (action.entry) {
    const es = resolveSubject(scenario, built, run.knowledge, action.targetId, action.entry.subjectFactId ?? spec?.subjectFactId);
    exposure = entryExposure(built, es);
    if (exposure.openingId && exposure.distance > 1) {
      contributors.push({ label: exposure.label, value: exposure.score, source: 'space', ref: action.targetId });
      details.push(`${exposure.label}.`);
      const lastPlan = plans[0];
      if (lastPlan?.route) overlays.push({ kind: 'path', points: [...lastPlan.route.points, es.at], label: `${Math.round(exposure.distance)} ft to the occupant` });
    } else exposure = null;
  }

  // ---- support
  let supportTravel = 0;
  let radioDeficit = 0;
  const radioUses: Use[] = [];
  const pushRadio = (sq: SquadId, u: ItemUnit | null) => {
    if (u) radioUses.push({ squadId: sq, itemId: u.itemId, unitId: u.id, qty: 1, consumable: false });
  };
  if (action.support && support.length > 0) {
    const rule = action.support;
    const actingTask = taskOf(acting[0]);
    const actingStart = standingOf(built, actingTask);
    support.forEach((sq, i) => {
      const task = taskOf(sq);
      const start = standingOf(built, task);
      const tool = bestOf(units[sq], 'entry_tool');
      const cover = stagingFacing(built, rule.coverSpaceId, action.targetId, rule.openingId);
      const standAt = cover?.at ?? centroidOf(built, rule.coverSpaceId);
      const route = routeBetween(built, task.positionId, start.at, rule.coverSpaceId, standAt, tool ? { effectiveness: effOf(tool) } : null);
      if (!route.reachable) {
        reasons.push(`${squadLabel(sq)} can't reach the ${spaceName(built, rule.coverSpaceId).toLowerCase()}`);
        return;
      }
      const dist = route.minutes;
      for (const f of route.forced) {
        if (f.withTool && tool) {
          toolUses.push({ squadId: sq, itemId: tool.itemId, unitId: tool.id, qty: 1, consumable: false });
          contributors.push({ label: `${ITEMS[tool.itemId]?.name ?? 'Entry tool'} (${squadLabel(sq)}): opens the ${f.label.toLowerCase()} in ${f.minutes} min`, value: 0, source: 'equipment', ref: tool.itemId });
        } else contributors.push({ label: `${squadLabel(sq)}: locked ${f.label.toLowerCase()}, ${f.minutes} min to force`, value: 0, source: 'space', ref: f.openingId });
      }
      supportTravel = Math.max(supportTravel, dist);
      const squad = state.squads.find((s) => s.id === sq);
      const coords = (squad?.officerIds ?? [])
        .map((id) => state.officers[id]?.ratings.coordination ?? 0)
        .sort((a, b) => b - a)
        .slice(0, 2);
      const coord = coords.length ? coords.reduce((a, b) => a + b, 0) / coords.length : 0;
      const reach = clamp(1 - dist / rule.reachMinutes, 0, 1);
      const raw = rule.max * (coord / 100) * reach * Math.pow(T.supportRank, i);
      contributors.push({
        label: `${squadLabel(sq)} ${rule.label}: ${round1(dist)} min away, coordination ${Math.round(coord)}`,
        value: round1(raw * (1 - E.radioShare)),
        source: 'support',
        ref: sq,
      });
      details.push(`${squadLabel(sq)} ${rule.label}: ${round1(dist)} min away.`);

      // radio link between the two squads, from where they stand now
      const radioA = bestOf(units[acting[0]], 'comms_kit');
      const radioB = bestOf(units[sq], 'comms_kit');
      const gap = Math.hypot(actingStart.at.x - start.at.x, actingStart.at.y - start.at.y);
      let link = 0;
      let text = '';
      if (radioA && radioB) {
        const sig = signalBetween(built, actingStart.at, start.at, 'radio');
        link = sig.transmission * effOf(radioA) * effOf(radioB);
        text = `radios linked, signal ${sig.transmission.toFixed(2)}`;
        overlays.push({ kind: 'line', from: actingStart.at, to: start.at, tone: sig.transmission >= 0.6 ? 'clear' : sig.transmission >= 0.25 ? 'partial' : 'blocked', label: `Radio ${sig.transmission.toFixed(2)}` });
        pushRadio(acting[0], radioA);
        pushRadio(sq, radioB);
      } else if (radioA || radioB) {
        const sig = signalBetween(built, actingStart.at, start.at, 'radio');
        link = 0.5 * sig.transmission * effOf((radioA ?? radioB)!);
        text = 'one radio only';
        pushRadio(radioA ? acting[0] : sq, radioA ?? radioB);
      } else if (gap <= SPATIAL_TUNING.voiceLinkFt) {
        link = 0.3;
        text = `no radios, voice carries ${Math.round(gap)} ft`;
      } else text = `no radios, ${Math.round(gap)} ft apart is out of voice range (${SPATIAL_TUNING.voiceLinkFt} ft)`;
      if (radioA && radioB) radioDeficit += raw * E.radioShare * (1 - clamp(link, 0, 1));
      contributors.push({ label: `${squadLabel(sq)} link: ${text}`, value: round1(raw * E.radioShare * clamp(link, 0, 1)), source: 'equipment', ref: radioB?.itemId ?? sq });
      for (const [r, who] of [[radioA, acting[0]], [radioB, sq]] as const) {
        if (r && effOf(r) < 1) {
          const def = ITEMS[r.itemId];
          contributors.push({
            label: `${def.name} ${r.serial} (${squadLabel(who)}): condition ${Math.round(r.condition)}, malfunction risk`,
            value: -round1(E.malfunctionShare * raw * E.radioShare * (1 - effOf(r))),
            source: 'equipment',
            ref: r.id,
          });
        }
      }
      const coverStand = cover ? standingFromPoint(cover) : null;
      arrivals.push({ squadId: sq, spaceId: rule.coverSpaceId, role: 'support', stagingId: coverStand?.stagingId ?? null, at: standAt });
    });
  }
  for (const o of req.openings ?? []) {
    const st = location.openings.find((x) => x.id === o.openingId)?.state;
    if (st === 'locked') {
      const tool = o.lockedTag ? actingHas(o.lockedTag) || supportHas(o.lockedTag) : false;
      details.push(tool ? `${o.lockedNote.split(':')[0]}: a ${tagNames([o.lockedTag!])} opens it quickly.` : o.lockedNote);
    }
  }

  // ---- space contributors
  if (extraMinutes >= 0.5) {
    contributors.push({
      label: `Work area ${Math.round(targetArea)} sq ft: ${round1(extraMinutes)} min of work`,
      value: -round1(extraMinutes * T.workloadScore),
      source: 'space',
      ref: action.targetId,
    });
    const areaName = (action.workload.areaSpaces?.length ?? 0) > 1 ? 'The search area' : spaceName(built, action.targetId);
    details.push(`${areaName} covers ${Math.round(targetArea)} sq ft, about ${round1(extraMinutes)} min of work.`);
  }
  const travel = Math.max(actingTravel, supportTravel);
  if (travel >= 0.5) {
    contributors.push({ label: `Travel: ${round1(travel)} min`, value: -round1(travel * T.travelScore), source: 'space' });
    details.push(action.approach === 'window' ? `${round1(travel)} min to get into position.` : `${round1(travel)} min of movement through the building.`);
  }
  const entryMinutes = exposure?.minutes ?? 0;
  contributors.push(...modContribs);
  for (const m of modContribs) details.push(`${m.label}.`);

  // Contextual catalog rules are opt-in, leaving v1 action behavior unchanged.
  const capability = evaluateCapabilities({ state, run, scenario, action, built, acting, support, units, existingUses: consumption ?? [], radioDeficit,
    visibility: Math.max(0, ...plans.map((p) => {
      const target = resolveSubject(scenario, built, run.knowledge, action.targetId, action.spatial?.subjectFactId);
      return signalBetween(built, p.stand.at, target.at, 'visual').transmission;
    })),
  });
  reasons.push(...capability.reasons);
  // Legacy authored equipment and contextual equipment share best-of groups.
  for (const applied of capability.applied) {
    const previous = bestByGroup.get(applied.group);
    if (previous && previous.value >= applied.value) {
      capability.contributors = capability.contributors.filter((c) => c.ref !== applied.itemId);
      capability.uses = capability.uses.filter((u) => u.unitId !== applied.unitId);
      capability.minutes -= applied.minutes;
      capability.details = capability.details.filter((line) => !line.startsWith(`${ITEMS[applied.itemId].name}:`));
    } else if (previous) {
      const i = equipUses.findIndex((u) => u.unitId === previous.unit.id);
      if (i >= 0) equipUses.splice(i, 1);
      for (let i = contributors.length - 1; i >= 0; i--) if (contributors[i].source === 'equipment' && (contributors[i].ref === previous.def.id || contributors[i].ref === previous.unit.id)) contributors.splice(i, 1);
    }
  }
  contributors.push(...capability.contributors);
  details.push(...capability.details);
  if (action.capabilities?.deescalation && pool.some((o) => o.certs.includes('deescalation'))) {
    const existingTraining = action.certBonus && pool.some((o) => o.certs.includes(action.certBonus!.cert)) ? action.certBonus.value : 0;
    if (existingTraining < 4) contributors.push({ label: 'De-escalation training: distressed contact', value: 4 - existingTraining, source: 'preparation', ref: 'deescalation' });
  }

  // ---- totals
  const score = round1(contributors.filter((c) => c.source !== 'difficulty').reduce((s, c) => s + c.value, 0));
  const all = [...diffContribs, ...contributors];
  const margin = round1(score - difficulty);
  const probs = bandProbabilities(margin);
  const timeBase = round1(Math.max(0.5, workloadMinutes + travel + entryMinutes + capability.minutes));
  const timeExpected = round1(timeBase * (probs.favorable * T.bandTime.favorable + probs.mixed * T.bandTime.mixed + probs.adverse * T.bandTime.adverse));

  // ---- text
  const rated = action.check.ratings.filter((r) => r.weight > 0 && (r.key !== 'shooting' || kind === 'execution'));
  details.unshift(`Relies on ${names(rated.map((r) => RATING_LABEL[r.key]), 'and')}.`);
  if (highRisk) details.push('High-risk work: overloaded officers sit it out.');
  if (action.tempo === 'waiting') details.push('A waiting game: impatient officers struggle.');
  if (pLevel > 0.3) details.push('Time pressure is high; composure limits how much it hurts.');
  const unresolved = [...relatedFactIds(action)].filter((id) => ['unknown', 'reported'].includes(run.knowledge[id] ?? 'unknown'));
  const uncertainty = unresolved.map((id) => scenario.facts.find((f) => f.id === id)?.uncertainty).filter((t): t is string => Boolean(t));
  if (subject && subject.basis !== 'exact' && subject.note) uncertainty.push(subject.note);

  // one entry per unit, however many reasons it was used
  const seenUnits = new Set<Id>();
  const allUses: Use[] = [];
  for (const u of [...(consumption ?? []), ...equipUses, ...toolUses, ...radioUses, ...capability.uses]) {
    if (seenUnits.has(u.unitId)) continue;
    seenUnits.add(u.unitId);
    allUses.push(u);
  }

  const reason = reasons[0] ?? null;
  return {
    action,
    acting,
    support,
    eligible: reason === null,
    reason,
    participantIds: participants.map((o) => o.id),
    excluded,
    leadId: lead?.id ?? null,
    contributors: all,
    score,
    difficulty,
    margin,
    pFavorable: probs.favorable,
    pAdverse: probs.adverse,
    risk: riskBand(probs.favorable),
    timeBase,
    timeExpected,
    travelMinutes: round1(travel),
    workloadMinutes,
    arrivals,
    uses: allUses,
    unresolvedFacts: unresolved,
    uncertainty,
    details,
    highRisk,
    overlays,
    exposureMult: exposure?.strainMult ?? 1,
  };
}

// ---------------------------------------------------------------- strain

/**
 * Per-officer strain for one committed decision. Composure only reduces the
 * pressure-driven extra; stress itself is never folded into ratings twice. Age over
 * 50 adds 5% per 5 years, a rookie adds 15% under pressure, and distance into the
 * room raises strain for the officers taking part in an entry.
 */
export function strainFor(input: EvalInput, ev: Evaluation, band: OutcomeBand): Record<Id, number> {
  const { state, run, action } = input;
  const T = RESOLUTION_TUNING;
  const E = EXPERIENCE_TUNING;
  const out: Record<Id, number> = {};
  const base = action.stressBase * T.bandStress[band];
  const uncertain = ev.unresolvedFacts.length > 0;
  const day = gameDay(state, run.startedAt);
  const pressured = underPressure(run, action.check.kind);
  for (const sq of run.squadIds) {
    const squad = state.squads.find((s) => s.id === sq);
    const mentor = squad?.officerIds.some((id) => state.officers[id]?.traits.includes('mentor')) ?? false;
    for (const id of squad?.officerIds ?? []) {
      const o = state.officers[id];
      if (!o) continue;
      let w = 0.25;
      if (ev.participantIds.includes(id)) w = 1;
      else if (ev.acting.includes(sq)) w = 0.5;
      else if (ev.support.includes(sq)) w = 0.6;
      const extra = 1 + (run.pressure / 100) * (1 - o.ratings.composure / 100) * 1.2;
      let m = 1;
      if (o.traits.includes('steady') && uncertain) m *= 0.75;
      if (o.traits.includes('rookie') && mentor) m *= 0.85;
      if (pressured && experienceBand(o, day) === 'rookie') m *= E.rookieStrain;
      m *= ageStrainMult(ageYears(o, day));
      if (ev.participantIds.includes(id)) m *= ev.exposureMult;
      out[id] = round1(base * w * extra * m);
    }
  }
  return out;
}
