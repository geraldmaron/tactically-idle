// What a closed call says about its officers, read once from the run, the scenario and the debrief. Every
// field here already exists on those records; nothing is invented. The people layer's facts, imprints and
// bonds all read this one summary.
//
// The engine has no explicit "rear cover" or "entry" scope on a decision (swat-officer-stories, R13), so
// those two are read from the action's own fields: an entry is an action with `entry` set or an urgent
// execution check; rear cover is a perimeter action, a window approach that is not a contact, or an action
// whose title or task names the rear, the back door, the side yard or the perimeter. Both are heuristics
// over authored data and are named as such in the report.
import type { CompletionDisposition, DebriefResult, DecisionResolution, GameState, Id, OperationRun } from '../types';
import { decisionsOf } from '../types';
import type { ActionDefinition, ScenarioDefinition } from '../scenario-types';
import { getScenario } from '../scenario-registry';
import { buildLocation } from '../location';
import { RANK_IDS } from '../../content/ranks';
import { PEOPLE_TUNING } from './tuning';

export interface CallRead {
  runId: Id;
  at: number;
  /** The building's name or address, never a civilian's name. */
  place: string;
  verdict: 'favorable' | 'adverse' | null;
  /** Officers on the call, in the debrief's order, who are still on the roster. */
  participants: Id[];
  stressAfter: Record<Id, number>;
  /** Officers promoted by this debrief, with the rank they reached. */
  promoted: Record<Id, string>;
  civilianHarm: boolean;
  everyoneSafe: boolean;
  forceUsed: boolean;
  shots: boolean;
  /** Everyone safe and no force: the squad held, waited or talked. This never moves anyone toward a strain. */
  restraintSafe: boolean;
  pressurePeak: number;
  minutes: number;
  steps: number;
  ending: string;
  disposition?: CompletionDisposition;
  subjectId?: string;
  personLost: boolean;
  /** An authored scenario with people at risk ended with every one of them safe or in care. */
  rescued: boolean;
  hurt: Record<Id, { label: string; days: number }>;
  /** Officers on at least one decision, and on one of each kind of step by band. */
  onStep: Set<Id>;
  rearAdverse: Set<Id>;
  contactAdverse: Set<Id>;
  contactFavorable: Set<Id>;
  contact: Set<Id>;
  entryAdverse: Set<Id>;
  /** Lowercase words that name a person on the call; a fact detail never carries one. */
  nameTokens: Set<string>;
}

const REAR_WORDS = /\b(rear|back door|out the back|side yard|perimeter)\b/i;

export const isEntryStep = (a: ActionDefinition): boolean => !!a.entry || (a.check.kind === 'execution' && a.tempo === 'urgent');
export const isRearStep = (a: ActionDefinition): boolean => !!a.perimeter || (a.approach === 'window' && a.check.kind !== 'contact') || REAR_WORDS.test(`${a.title} ${a.task}`);
export const isContactStep = (a: ActionDefinition): boolean => a.check.kind === 'contact';

const placeCache = new Map<string, string>();
function placeOf(run: OperationRun, scenario: ScenarioDefinition | null): string {
  const key = `${run.locationFamilyId}:${run.locationSeed}`;
  const hit = placeCache.get(key);
  if (hit) return hit;
  let name: string | null = null;
  try { name = buildLocation(run.locationFamilyId, run.locationSeed).location.name; } catch { name = null; }
  const place = name || scenario?.title || 'the call';
  placeCache.set(key, place);
  return place;
}

const tokens = (text: string | undefined): string[] => (text ?? '').toLowerCase().split(/[^a-zÀ-ɏ']+/).filter((w) => w.length >= 3);

function namesOn(scenario: ScenarioDefinition | null): Set<string> {
  const out = new Set<string>();
  if (!scenario) return out;
  for (const c of scenario.civilianOutcomes ?? []) tokens(c.label).forEach((t) => out.add(t));
  for (const p of scenario.briefing?.people ?? []) tokens(p.name).forEach((t) => out.add(t));
  for (const p of scenario.incidentPeople ?? []) tokens(p.label).forEach((t) => out.add(t));
  return out;
}

function pressurePeakOf(run: OperationRun, decisions: DecisionResolution[]): number {
  let p = run.pressure;
  let peak = Math.max(p, run.fillPeak ?? 0);
  for (let i = decisions.length - 1; i >= 0; i--) {
    p -= decisions[i].committed?.pressureDelta ?? 0;
    peak = Math.max(peak, p);
  }
  return peak;
}

export function readCall(d: GameState, run: OperationRun, result: DebriefResult, verdict: 'favorable' | 'adverse' | null): CallRead {
  const scenario = getScenario(run.scenarioId);
  const decisions = decisionsOf(run.history);
  const actions = new Map<Id, ActionDefinition>();
  for (const stage of Object.values(scenario?.stages ?? {})) for (const a of stage.actions ?? []) actions.set(a.id, a);

  const participants = result.officerCondition.map((c) => c.officerId).filter((id) => !!d.officers[id]);
  const stressAfter: Record<Id, number> = {};
  const promoted: Record<Id, string> = {};
  for (const c of result.officerCondition) {
    stressAfter[c.officerId] = c.stressAfter;
    const top = c.promotions?.[c.promotions.length - 1];
    if (top) promoted[c.officerId] = top.rank;
  }

  const outcomes = result.civilianOutcomes ?? [];
  const casualties = result.personCasualties ?? [];
  const civilianHarm = outcomes.some((o) => o.status === 'injured_needs_care' || o.status === 'deceased') || casualties.some((c) => c.personRole === 'civilian');
  const safeStatus = (s: string) => s === 'safe' || s === 'care_accepted' || s === 'accounted_elsewhere';
  const everyoneSafe = outcomes.every((o) => safeStatus(o.status)) && casualties.length === 0 && !(result.officerCasualties?.length);
  const forceUsed = !!result.forceLines?.length || decisions.some((x) => !!x.committed?.forceOutcome || !!x.committed?.drawn?.some((e) => e.model === 'team_force'));
  const shots = forceUsed || decisions.some((x) => !!x.committed?.drawn?.some((e) => e.model === 'incoming_fire'));
  const personLost = casualties.some((c) => c.severity === 'fatal' || c.care === 'deceased') || outcomes.some((o) => o.status === 'deceased');
  const atRisk = (scenario?.incidentPeople ?? []).some((p) => p.kind === 'hostage' || p.kind === 'victim' || p.kind === 'trapped');
  const rescued = atRisk && outcomes.length > 0 && outcomes.every((o) => safeStatus(o.status)) && casualties.every((c) => c.personRole === 'subject');

  const hurt: CallRead['hurt'] = {};
  for (const c of result.officerCasualties ?? []) hurt[c.officerId] = { label: c.label, days: Math.max(1, Math.round((c.recoveryUntil - d.department.clockHighWater) / 3_600_000)) };

  const onStep = new Set<Id>(), rearAdverse = new Set<Id>(), contactAdverse = new Set<Id>(), contactFavorable = new Set<Id>(), contact = new Set<Id>(), entryAdverse = new Set<Id>();
  for (const x of decisions) {
    const action = actions.get(x.actionId);
    for (const id of x.officerIds) {
      onStep.add(id);
      if (!action) continue;
      if (isRearStep(action) && x.band === 'adverse') rearAdverse.add(id);
      if (isEntryStep(action) && x.band === 'adverse') entryAdverse.add(id);
      if (isContactStep(action)) {
        contact.add(id);
        if (x.band === 'adverse') contactAdverse.add(id);
        if (x.band === 'favorable') contactFavorable.add(id);
      }
    }
  }

  const place = placeOf(run, scenario);
  // A name on the call that is also part of the place's own name is allowed in the place, so it is not banned.
  const nameTokens = namesOn(scenario);
  for (const t of tokens(place)) nameTokens.delete(t);

  return {
    runId: run.id, at: d.department.clockHighWater, place, verdict, participants, stressAfter, promoted,
    civilianHarm, everyoneSafe, forceUsed, shots, restraintSafe: everyoneSafe && !forceUsed,
    pressurePeak: pressurePeakOf(run, decisions), minutes: Math.max(1, Math.round(run.clock)), steps: decisions.length,
    ending: result.endingTitle, disposition: result.disposition,
    ...(run.world?.subjectId ? { subjectId: run.world.subjectId } : {}),
    personLost, rescued, hurt, onStep, rearAdverse, contactAdverse, contactFavorable, contact, entryAdverse, nameTokens,
  };
}

/** The ladder position of a rank id, for "promoted over". Unknown ranks sort first. */
export const rankPosition = (rank: string): number => RANK_IDS.indexOf(rank as (typeof RANK_IDS)[number]);

export const isHighPressure = (read: Pick<CallRead, 'pressurePeak'>): boolean => read.pressurePeak >= PEOPLE_TUNING.highPressure;
