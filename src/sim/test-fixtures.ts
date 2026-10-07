// Test GameState builder for operation tests. Independent of department.ts so the
// operation engine can be exercised without the department simulation.
import type { CertId, Command, DebriefResult, GameState, HandlerResult, Id, ItemUnit, Officer, Ratings, Role, SquadId, StageId, TraitId } from './types';
import { OPERATION_HANDLERS } from './operation';
import { actionViews, pendingDebrief, stageContinuations } from './operation-selectors';
import { CALENDAR } from './calendar';
import { getBuilt } from './resolution';
import { getScenario } from './scenario-registry';
import type { IncidentSpec } from './scenario-types';
import { incidentId } from '../gen/incident';
import { defaultStagingFor, centroidOf } from './spatial-factors';
import { ITEMS } from '../content/items';

export const NOW = 1_800_000_000_000;
/** Game day of NOW in fixtures (about 32.9 years after game day 0). */
export const DAY0 = 12_000;
const YEAR = CALENDAR.daysPerYear;

const rate = (shooting: number, composure: number, communication: number, awareness: number, medical: number, coordination: number): Ratings => ({
  shooting,
  composure,
  communication,
  awareness,
  medical,
  coordination,
});

export interface CareerSpec {
  /** Age in years at NOW. */
  age: number;
  /** Years of service at NOW. */
  service: number;
  /** Operations already run. */
  ops?: number;
}

export function makeOfficer(
  id: Id,
  firstName: string,
  surname: string,
  role: Role,
  portrait: string,
  ratings: Ratings,
  certs: CertId[],
  traits: TraitId[],
  squadId: SquadId | null,
  career: CareerSpec = { age: 34, service: 5 },
): Officer {
  return {
    id,
    firstName,
    surname,
    role,
    portrait,
    ratings,
    certs,
    traits,
    wage: 20,
    xp: 0,
    stress: 0,
    injury: null,
    squadId,
    assignment: null,
    hiredAt: NOW - 86_400_000,
    bornDay: DAY0 - career.age * YEAR,
    serviceStartDay: DAY0 - career.service * YEAR,
    career: { operations: career.ops ?? 0, favorable: 0, adverse: 0 },
    retirement: null,
  };
}

/** Set an officer's age and service (years at NOW) on an existing state. */
export function setCareer(state: GameState, officerId: Id, career: CareerSpec): GameState {
  const s = structuredClone(state);
  const o = s.officers[officerId];
  o.bornDay = DAY0 - career.age * YEAR;
  o.serviceStartDay = DAY0 - career.service * YEAR;
  o.career = { operations: career.ops ?? 0, favorable: 0, adverse: 0 };
  return s;
}

export function rosterOfficers(): Officer[] {
  return [
    makeOfficer('off_chen', 'Mara', 'Chen', 'comms', 'chen', rate(52, 70, 82, 62, 45, 66), ['crisis_negotiation'], ['calm_voice'], 'A', { age: 38, service: 12 }),
    makeOfficer('off_brooks', 'Dale', 'Brooks', 'breach', 'brooks', rate(78, 64, 50, 58, 40, 70), ['entry_team'], ['steady'], 'A', { age: 41, service: 16 }),
    makeOfficer('off_ortiz', 'Ines', 'Ortiz', 'medic', 'ortiz', rate(48, 68, 60, 60, 84, 62), ['advanced_first_aid'], [], 'A', { age: 35, service: 7 }),
    makeOfficer('off_vale', 'Noor', 'Vale', 'recon', 'vale', rate(60, 58, 55, 82, 40, 60), ['surveillance'], ['observant'], 'A', { age: 33, service: 6 }),
    makeOfficer('off_okafor', 'Tobi', 'Okafor', 'lead', 'okafor', rate(72, 70, 62, 60, 45, 76), ['entry_team'], ['mentor'], 'B', { age: 47, service: 20 }),
    makeOfficer('off_lindqvist', 'Eli', 'Lindqvist', 'recon', 'lindqvist', rate(58, 55, 50, 74, 40, 58), ['drone_operator'], [], 'B', { age: 30, service: 4 }),
    makeOfficer('off_reyes', 'Sam', 'Reyes', 'comms', 'reyes', rate(62, 48, 68, 55, 35, 55), [], ['impatient'], 'B', { age: 28, service: 3 }),
    makeOfficer('off_park', 'Jun', 'Park', 'medic', 'park', rate(50, 52, 52, 52, 70, 50), ['advanced_first_aid'], ['rookie'], 'B', { age: 24, service: 1 }),
  ];
}

export function squadCOfficers(): Officer[] {
  return [
    makeOfficer('off_holt', 'Rae', 'Holt', 'breach', 'holt', rate(70, 62, 52, 56, 42, 64), ['entry_team'], [], 'C', { age: 36, service: 9 }),
    makeOfficer('off_dray', 'Kit', 'Dray', 'comms', 'dray', rate(50, 60, 66, 58, 45, 60), [], [], 'C', { age: 31, service: 5 }),
    makeOfficer('off_ng', 'Wen', 'Ng', 'recon', 'ng', rate(55, 60, 54, 70, 40, 58), [], [], 'C', { age: 29, service: 4 }),
    makeOfficer('off_ibarra', 'Lou', 'Ibarra', 'medic', 'ibarra', rate(46, 62, 56, 54, 74, 56), ['advanced_first_aid'], [], 'C', { age: 33, service: 6 }),
  ];
}

const SERIAL: Record<string, string> = {
  radio_kit: 'RH',
  loud_hailer: 'LH',
  throw_phone: 'TP',
  thermal_imager: 'TI',
  camera_drone: 'CD',
  ballistic_shield: 'BS',
  door_ram: 'DR',
  trauma_kit: 'TK',
};

/** One physical unit. Ids are `u_<item>_<n>` so tests can address them. */
export function makeUnit(itemId: Id, n: number, over: Partial<ItemUnit> = {}): ItemUnit {
  const def = ITEMS[itemId];
  const shelf = def?.wear.shelfLifeDays;
  return {
    id: `u_${itemId}_${n}`,
    itemId,
    serial: `${SERIAL[itemId] ?? 'XX'}-${String(n).padStart(4, '0')}`,
    condition: 100,
    acquiredAt: NOW - 3_600_000,
    uses: 0,
    status: 'ready',
    serviceUntil: null,
    wearRate: 1,
    expiresAt: shelf ? NOW + shelf * CALENDAR.gameDayMs : null,
    lastWearAt: NOW,
    ...over,
  };
}

export const unitId = (itemId: Id, n = 1) => `u_${itemId}_${n}`;

/** Set one unit's condition on an existing state. */
export function setUnitCondition(state: GameState, id: Id, condition: number): GameState {
  const s = structuredClone(state);
  s.units[id].condition = condition;
  return s;
}

export interface FixtureOptions {
  squadC?: boolean;
  rngState?: number;
  unlockedNodes?: Id[];
  /** Units to own per item (defaults below). */
  inventory?: Record<Id, number>;
}

export function makeState(opts: FixtureOptions = {}): GameState {
  const officers: Record<Id, Officer> = {};
  const list = [...rosterOfficers(), ...(opts.squadC ? squadCOfficers() : [])];
  for (const o of list) officers[o.id] = o;
  const inv: Record<Id, number> = {
    // Operation fixtures are fully stocked; real new-game stock remains six.
    radio_kit: opts.squadC ? 12 : 8,
    loud_hailer: 2,
    throw_phone: 1,
    ballistic_shield: 2,
    door_ram: 1,
    trauma_kit: 6,
    thermal_imager: 0,
    camera_drone: 0,
    ...(opts.inventory ?? {}),
  };
  const units: Record<Id, ItemUnit> = {};
  for (const [id, n] of Object.entries(inv)) for (let i = 1; i <= n; i++) units[`u_${id}_${i}`] = makeUnit(id, i);
  const squads: GameState['squads'] = [
    { id: 'A', name: 'Alpha', officerIds: ['off_chen', 'off_brooks', 'off_ortiz', 'off_vale'], leaderId: 'off_chen', duty: 'standby', loadoutPreset: {} },
    { id: 'B', name: 'Bravo', officerIds: ['off_okafor', 'off_lindqvist', 'off_reyes', 'off_park'], leaderId: 'off_okafor', duty: 'standby', loadoutPreset: {} },
  ];
  if (opts.squadC) squads.push({ id: 'C', name: 'Charlie', officerIds: ['off_holt', 'off_dray', 'off_ng', 'off_ibarra'], leaderId: 'off_holt', duty: 'standby', loadoutPreset: {} });
  return {
    saveVersion: 1,
    contentVersion: 1,
    department: {
      name: 'Westhaven Department',
      funding: 12400,
      devPoints: 3,
      trust: 78,
      level: 3,
      rosterCap: 12,
      trainingSlots: 1,
      unlockedNodes: opts.unlockedNodes ?? [],
      developmentTiers: Object.fromEntries((opts.unlockedNodes ?? []).map((id) => [id, 1])),
      restockRules: [],
      lastSettledAt: NOW,
      lastInteractionAt: NOW,
      clockHighWater: NOW,
      calendarEpoch: NOW - DAY0 * CALENDAR.gameDayMs,
    },
    officers,
    squads,
    candidates: [],
    units,
    reservations: [],
    activeRun: null,
    incidents: [],
    debriefs: [],
    report: null,
    nextId: 1,
    rngState: opts.rngState ?? 12345,
  };
}

export const DEFAULT_LOADOUTS: Record<SquadId, Record<Id, number>> = {
  A: { radio_kit: 1, throw_phone: 1, ballistic_shield: 1, trauma_kit: 2 },
  B: { radio_kit: 1, loud_hailer: 1, door_ram: 1, ballistic_shield: 1, trauma_kit: 2 },
  C: { radio_kit: 1, loud_hailer: 1, trauma_kit: 1 },
  D: { radio_kit: 1, trauma_kit: 1 },
};

export const DEFAULT_POSITIONS: Record<SquadId, Id> = { A: 'front_yard', B: 'side_yard_e', C: 'front_yard', D: 'front_yard' };

export function startCmd(
  scenarioId: Id,
  squadIds: SquadId[],
  over: {
    loadouts?: Partial<Record<SquadId, Record<Id, number>>>;
    positions?: Partial<Record<SquadId, Id>>;
    staging?: Partial<Record<SquadId, Id>>;
    units?: Partial<Record<SquadId, Id[]>>;
  } = {},
): Extract<Command, { type: 'startOperation' }> {
  const loadouts: Partial<Record<SquadId, Record<Id, number>>> = {};
  const positions: Partial<Record<SquadId, Id>> = {};
  for (const s of squadIds) {
    loadouts[s] = over.loadouts?.[s] ?? { ...DEFAULT_LOADOUTS[s] };
    positions[s] = over.positions?.[s] ?? DEFAULT_POSITIONS[s];
  }
  return { type: 'startOperation', scenarioId, squadIds, positions, loadouts, ...(over.units ? { units: over.units } : {}), ...(over.staging ? { staging: over.staging } : {}) };
}

/** Fixed generated calls the tests reuse as examples of each content version. */
export const TEST_CALLS = {
  welfareV3: { type: 'welfare_check', familyId: 'cedar_close', buildingSeed: 0, seed: 11, tier: 1, contentVersion: 3 },
  welfareV4: { type: 'welfare_check', familyId: 'cedar_close', buildingSeed: 0, seed: 11, tier: 1, contentVersion: 4 },
  activeArmedV4: { type: 'active_armed_incident', familyId: 'cedar_close', buildingSeed: 7, seed: 7, tier: 2, contentVersion: 4 },
  hostageV4: { type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed: 7, tier: 2, contentVersion: 4 },
  protectedRescueV4: { type: 'protected_rescue', familyId: 'cedar_close', buildingSeed: 7, seed: 0, tier: 2, contentVersion: 4 },
} satisfies Record<string, IncidentSpec>;
export const testCallId = (name: keyof typeof TEST_CALLS): Id => incidentId(TEST_CALLS[name]);

/** Put a generated call on the board so a live start can take it. Authored scenarios and
 * calls already on the board are left as they are. */
export function withCallOnBoard(state: GameState, scenarioId: Id, now = NOW): GameState {
  const incident = getScenario(scenarioId)?.incident;
  if (!incident || state.incidents.some((card) => card.id === scenarioId)) return state;
  const s = structuredClone(state);
  s.incidents = [...s.incidents, { id: scenarioId, type: incident.type, familyId: incident.familyId, tier: incident.tier, arrivedAt: now, expiresAt: now + 3_600_000, seen: false }];
  return s;
}

/** Every item the department can field: owned or unlocked, apart from exterior vehicles. */
export function fieldableItems(state: GameState): Id[] {
  return Object.keys(ITEMS).filter((id) => {
    const def = ITEMS[id];
    if (def.supportOnly) return false;
    const owned = Object.values(state.units).some((u) => u.itemId === id && u.status !== 'scrapped');
    return owned || !def.requiresNode || state.department.unlockedNodes.includes(def.requiresNode);
  });
}

/**
 * Give each squad one fresh, owned unit of every listed item (ids `kit_<squad>_<item>`),
 * picked into its loadout. Units are built directly, never through createUnit, so the
 * department random stream, and with it every run's dice, is unchanged.
 */
export function stockKit(state: GameState, squadIds: SquadId[], itemIds: Id[] = fieldableItems(state), now = NOW): {
  state: GameState; loadouts: Partial<Record<SquadId, Record<Id, number>>>; units: Partial<Record<SquadId, Id[]>>;
} {
  const s = structuredClone(state);
  const loadouts: Partial<Record<SquadId, Record<Id, number>>> = {};
  const units: Partial<Record<SquadId, Id[]>> = {};
  for (const sid of squadIds) {
    loadouts[sid] = {};
    units[sid] = [];
    for (const itemId of itemIds) {
      const shelf = ITEMS[itemId]?.wear.shelfLifeDays;
      const id = `kit_${sid}_${itemId}`;
      s.units[id] = { id, itemId, serial: `KIT-${sid}-${itemId}`, condition: 100, acquiredAt: now, uses: 0, status: 'ready', serviceUntil: null, wearRate: 1, expiresAt: shelf != null ? now + shelf * CALENDAR.gameDayMs : null, lastWearAt: now };
      loadouts[sid]![itemId] = 1;
      units[sid]!.push(id);
    }
  }
  return { state: s, loadouts, units };
}

/** Start a live run carrying `stockKit` equipment, with the call put on the board first. */
export function startWithKit(state: GameState, scenarioId: Id, squadIds: SquadId[], over: Omit<Parameters<typeof startCmd>[2], 'loadouts' | 'units'> = {}, itemIds?: Id[]): GameState {
  const kit = stockKit(withCallOnBoard(state, scenarioId), squadIds, itemIds ?? fieldableItems(state));
  return startRun(kit.state, scenarioId, squadIds, { ...over, loadouts: kit.loadouts, units: kit.units });
}

/** Run one operation handler as a transaction (like dispatch, without the department tick). */
export function apply(state: GameState, cmd: Command, now = NOW): { state: GameState; result: HandlerResult } {
  const draft = structuredClone(state);
  const handler = (OPERATION_HANDLERS as unknown as Record<string, (d: GameState, c: Command, x: { now: number }) => HandlerResult>)[cmd.type];
  const result = handler(draft, cmd, { now });
  return result.ok ? { state: draft, result } : { state, result };
}

export function startRun(state: GameState, scenarioId: Id, squadIds: SquadId[], over: Parameters<typeof startCmd>[2] = {}): GameState {
  const r = apply(state, startCmd(scenarioId, squadIds, over));
  if (!r.result.ok) throw new Error(`startOperation refused: ${r.result.reason}`);
  return r.state;
}

/** Model a pre-standard-kit active save; never used by the deployment path. */
export function withLegacyRadios(state: GameState, quantities: Partial<Record<SquadId, number>>): GameState {
  const legacy = structuredClone(state);
  const retained: Partial<Record<SquadId, number>> = {};
  legacy.reservations = legacy.reservations.filter((reservation) => {
    const limit = quantities[reservation.squadId];
    if (reservation.itemId !== 'radio_kit' || limit === undefined) return true;
    const count = retained[reservation.squadId] ?? 0;
    retained[reservation.squadId] = count + 1;
    if (count < limit) return true;
    legacy.units[reservation.unitId].status = 'ready';
    return false;
  });
  if (legacy.activeRun) legacy.activeRun.reservationIds = legacy.reservations.map((r) => r.id);
  return legacy;
}

type Status = 'unknown' | 'reported' | 'confirmed' | 'disproved';

/** Put an active run at a stage with knowledge/flags set (fixture shortcut; not a game path). */
export function setRun(
  state: GameState,
  patch: { stage?: StageId; flags?: string[]; knowledge?: Record<Id, Status>; pressure?: number; positions?: Partial<Record<SquadId, Id>>; staging?: Partial<Record<SquadId, Id | null>> },
): GameState {
  const s = structuredClone(state);
  const run = s.activeRun!;
  if (patch.stage) run.stage = patch.stage;
  if (patch.flags) run.flags = [...run.flags, ...patch.flags];
  if (patch.knowledge) run.knowledge = { ...run.knowledge, ...patch.knowledge };
  if (patch.pressure !== undefined) run.pressure = patch.pressure;
  const built = getBuilt(run.locationFamilyId, run.locationSeed);
  for (const [sq, pos] of Object.entries(patch.positions ?? {})) {
    const t = run.squadTasks.find((x) => x.squadId === sq);
    if (!t) continue;
    t.positionId = pos as Id;
    const sp = defaultStagingFor(built, pos as Id);
    t.stagingId = sp?.id ?? null;
    t.at = sp?.at ?? centroidOf(built, pos as Id);
  }
  for (const [sq, stId] of Object.entries(patch.staging ?? {})) {
    const t = run.squadTasks.find((x) => x.squadId === sq);
    if (!t) continue;
    const sp = built.derived.stagingPoints.find((p) => p.id === stId);
    t.stagingId = sp?.id ?? null;
    if (sp) {
      t.positionId = sp.spaceId;
      t.at = sp.at;
    }
  }
  return s;
}

export type Policy = Partial<Record<StageId, Id[]>>;

/**
 * Play a run with a scripted preference list per stage through the real selectors
 * and handlers, then close the debrief. Returns the final state and debrief.
 */
export function playPolicy(state: GameState, policy: Policy, focus: SquadId | null = 'A'): { state: GameState; debrief: DebriefResult; steps: Id[] } {
  let s = state;
  const steps: Id[] = [];
  for (let guard = 0; guard < 20; guard++) {
    const run = s.activeRun;
    if (!run || run.status !== 'active') break;
    const views = actionViews(s, NOW, focus);
    const prefs = policy[run.stage as StageId] ?? [];
    const continuations = stageContinuations(s);
    const requestedContinuation = continuations.find(entry => prefs[0] === entry.actionId);
    let pick = prefs.map((id) => views.find((v) => v.id === id)).find((v) => v && v.eligible);
    if (!pick) pick = views.find((v) => v.eligible);
    const continuation = requestedContinuation ?? (!pick ? continuations[0] : undefined);
    if (continuation) {
      const result = apply(s, { type: 'continueStage', actionId: continuation.actionId, revision: continuation.revision });
      if (!result.result.ok) throw new Error(`continue ${continuation.actionId} refused: ${result.result.reason}`);
      steps.push(continuation.actionId);
      s = result.state;
      continue;
    }
    if (!pick) throw new Error(`no eligible action at ${run.stage}`);
    const r = apply(s, { type: 'decide', actionId: pick.id, actingSquadIds: pick.actingSquadIds, supportSquadIds: pick.supportSquadIds });
    if (!r.result.ok) throw new Error(`decide ${pick.id} refused: ${r.result.reason}`);
    steps.push(pick.id);
    s = r.state;
  }
  const debrief = pendingDebrief(s);
  if (!debrief) throw new Error('run did not reach debrief');
  const closed = apply(s, { type: 'closeDebrief' });
  if (!closed.result.ok) throw new Error(`closeDebrief refused: ${closed.result.reason}`);
  return { state: closed.state, debrief, steps };
}
