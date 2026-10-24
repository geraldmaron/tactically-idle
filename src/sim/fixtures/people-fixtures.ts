// Fixtures for the people-layer tests: a fresh department, and a closed call built from the pieces the
// people layer reads (a real generated scenario for its actions and names; the run and the debrief are
// assembled by hand so a test can choose the verdict, the step bands and who was hurt).
import type { CivilianOutcomeView, DebriefResult, DecisionResolution, GameState, Id, OperationRun, OutcomeBand } from '../types';
import { createInitialState } from '../department';
import { INCIDENT_TYPES, generateIncident, incidentId } from '../../gen/incident';
import type { ActionDefinition, IncidentSpec, ScenarioDefinition } from '../scenario-types';
import { HOUR_MS } from '../people/tuning';

export const NOW = 1_800_000_000_000;

export function freshState(seed = 12345): GameState {
  return createInitialState(NOW, seed);
}

/** Move the department clock forward by hours (no settlement: tests that settle call economy.settle). */
export function advance(d: GameState, hours: number): number {
  d.department.clockHighWater += hours * HOUR_MS;
  return d.department.clockHighWater;
}

let cached: { spec: IncidentSpec; scenario: ScenarioDefinition } | null = null;
export function scenarioFixture(): { spec: IncidentSpec; scenario: ScenarioDefinition; id: Id } {
  if (!cached) {
    const type = INCIDENT_TYPES[0];
    const spec: IncidentSpec = { type: type.type, familyId: type.families[0], buildingSeed: 3, seed: 3, tier: 2, contentVersion: 13 };
    cached = { spec, scenario: generateIncident(spec) };
  }
  return { ...cached, id: incidentId(cached.spec) };
}

/** The first action in the fixture scenario that satisfies a predicate. */
export function actionWhere(pred: (a: ActionDefinition) => boolean): ActionDefinition {
  const { scenario } = scenarioFixture();
  for (const stage of Object.values(scenario.stages)) for (const a of stage.actions) if (pred(a)) return a;
  throw new Error('No such action in the fixture scenario');
}

export const REAR_ACTION = () => actionWhere((a) => /out the back|move your squad up/i.test(a.title));
export const CONTACT_ACTION = () => actionWhere((a) => a.check.kind === 'contact' && !/out the back/i.test(a.title));
export const ENTRY_ACTION = () => actionWhere((a) => !!a.entry);

export interface StepSpec { actionId: Id; band: OutcomeBand; officers: Id[]; pressureDelta?: number; shots?: boolean }

export interface CallSpec {
  officers: Id[];
  verdict: 'favorable' | 'adverse' | null;
  steps: StepSpec[];
  /** Civilian end states; default: one civilian, safe. */
  civilians?: CivilianOutcomeView['status'][];
  force?: boolean;
  stressAfter?: Record<Id, number>;
  hurt?: Id[];
  disposition?: DebriefResult['disposition'];
  world?: boolean;
  runId?: Id;
  pressure?: number;
  promoted?: Record<Id, 'officer' | 'corporal' | 'sergeant' | 'lieutenant'>;
}

export function buildCall(d: GameState, spec: CallSpec): { run: OperationRun; result: DebriefResult } {
  const fixture = scenarioFixture();
  const runId = spec.runId ?? `run_${d.nextId++}`;
  const history = spec.steps.map((s, i) => ({
    revision: i, stage: 'assess', actionId: s.actionId, actingSquadIds: [], supportSquadIds: [], officerIds: s.officers, targetId: null,
    inputs: [], score: 0, difficulty: 0, sample: 0.5, band: s.band, timeCost: 1,
    committed: {
      objectiveDelta: 0, civilianSafetyDelta: 0, pressureDelta: s.pressureDelta ?? 0, consequences: [], endingTitle: null,
      ...(s.shots ? { drawn: [{ model: 'incoming_fire' as const, personId: 'x', key: 'miss' }] } : {}),
    },
  })) as unknown as DecisionResolution[];
  const run = {
    id: runId, scenarioId: fixture.id, scenarioVersion: 1, locationFamilyId: 'cedar_close', locationSeed: 1, contentVersion: 13, rngState: 1,
    squadIds: ['A'], squadTasks: [], reservationIds: [], stage: 'debrief', knowledge: {}, flags: [], clock: 24, pressure: spec.pressure ?? 20,
    objective: 50, civilianSafety: 50, history, revision: spec.steps.length, status: 'debrief', endingId: 'e', settled: false, startedAt: NOW, decisionOpenedAt: NOW,
    ...(spec.world ? { world: { kind: 'warrant' as const, caseId: 'c1', leadId: 'l1', subjectId: 's1', caseTier: 2 as const, districtId: 'pike' as const } } : {}),
  } as unknown as OperationRun;
  const statuses = spec.civilians ?? ['safe'];
  const result = {
    runId, scenarioId: fixture.id, endingId: 'e', endingTitle: 'Out with the team', disposition: spec.disposition ?? 'resolved', completionAchieved: spec.verdict === 'favorable',
    officerCasualties: (spec.hurt ?? []).map((officerId) => ({ officerId, severity: 'wounded', label: 'Fall at the doorway while meeting the resident', at: 5, care: 'stabilized', recoveryUntil: d.department.clockHighWater + 3 * HOUR_MS })),
    civilianOutcomes: statuses.map((status, i) => ({ id: `civ${i}`, label: 'Resident', status })),
    personCasualties: [],
    ...(spec.force ? { forceLines: [{ text: 'Force was used' }] } : {}),
    objective: { score: 50, label: 'Resolved' }, civilianSafety: { score: 50, label: 'Safe' },
    officerCondition: spec.officers.map((officerId) => ({
      officerId, stressBefore: 10, stressAfter: spec.stressAfter?.[officerId] ?? 20, xpGained: 5,
      ...(spec.promoted?.[officerId] ? { promotions: [{ rank: spec.promoted[officerId], line: 'Promoted' }] } : {}),
    })),
    informationPreserved: [], resources: [], unitWear: [], trustDelta: 0, fundingReward: 0, causes: [],
  } as unknown as DebriefResult;
  return { run, result };
}
