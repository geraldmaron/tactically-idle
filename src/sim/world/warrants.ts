// Calls the world makes: a warrant served on a lead, and an armed contact the player answers live. The world
// puts a card on the board that names the investigation, lead and subject; which call tree it plays, and the
// final card id, belong to the world-calls lane. Until a tree for it is written both commands refuse, which
// leaves the lead waiting (leads never expire).
import { ARCHETYPES } from '../../content/city/archetypes';
import { REVIEW_CLOCK_MS } from '../../content/city/tuning';
import { SCENARIO_TYPES } from '../../content/scenario-types';
import { templateAt } from '../../content/incidents';
import { INCIDENT_CONTENT_VERSION, incidentId } from '../../gen/incident';
import { hashSeed } from '../rng';
import { getScenario } from '../scenario-registry';
import type { IncidentSpec } from '../scenario-types';
import { runRoster } from '../squads';
import type { DebriefResult, GameState, HandlerResult, IncidentCard, IncidentWorldRef, OperationRun } from '../types';
import { addHistory } from './population';
import type { Lead, WorldCase } from './types';

const fail = (reason: string): HandlerResult => ({ ok: false, reason });
const NO_CALL = 'No warrant call is written yet';
/** World cards never lapse. */
const NEVER = Number.MAX_SAFE_INTEGER;

/** The kind of call a world card plays: a call only the world sends if one is written, else a barricade. */
function warrantType() {
  const only = SCENARIO_TYPES.find((info) => templateAt(info.type)?.worldOnly);
  if (only) return only;
  return SCENARIO_TYPES.find((info) => info.type === 'barricaded' && templateAt(info.type));
}

function buildCard(d: GameState, lead: Lead, kind: IncidentWorldRef['kind']): { card: IncidentCard } | { reason: string } {
  const w = d.world;
  const info = warrantType();
  if (!info) return { reason: NO_CALL };
  const subject = w.subjects[lead.subjectId];
  const c = w.cases.find((k) => k.id === lead.caseId);
  if (!subject || !c) return { reason: 'That lead has no investigation behind it' };
  if (subject.status === 'gone') return { reason: `${subject.firstName} ${subject.surname} has left the city` };
  const pick = (kindOf: string, n: number) => hashSeed(`${w.seed}:${lead.id}:${kindOf}`) % n;
  const spec: IncidentSpec = {
    type: info.type,
    familyId: info.families[pick('family', info.families.length)],
    buildingSeed: hashSeed(`${w.seed}:${lead.id}:building`),
    seed: hashSeed(`${w.seed}:${lead.id}:seed`),
    tier: Math.min(5, Math.max(1, lead.tier)),
    contentVersion: INCIDENT_CONTENT_VERSION,
    cast: { first: subject.nameKey.first, last: subject.nameKey.last, pronouns: subject.pronouns },
  };
  const now = d.department.clockHighWater;
  const card: IncidentCard = {
    id: incidentId(spec),
    type: spec.type,
    familyId: spec.familyId,
    tier: spec.tier,
    arrivedAt: now,
    expiresAt: NEVER,
    seen: false,
    world: { kind, caseId: c.id, leadId: lead.id, subjectId: subject.id, caseTier: lead.tier, districtId: lead.districtId },
  };
  return { card };
}

function putOnBoard(d: GameState, lead: Lead, card: IncidentCard): void {
  if (!d.incidents.some((c) => c.id === card.id)) d.incidents.unshift(card);
  lead.status = 'warrant';
  lead.cardId = card.id;
}

export function openWarrant(d: GameState, leadId: string): HandlerResult {
  const w = d.world;
  const lead = w.leads.find((l) => l.id === leadId);
  if (!lead) return fail('No such lead');
  if (lead.status === 'served') return fail('That warrant was already served');
  if (lead.status === 'warrant') return lead.cardId && d.incidents.some((c) => c.id === lead.cardId) ? { ok: true } : fail('That warrant is already being served');
  if (lead.source === 'intel') {
    const crew = lead.crewId ? w.crews.find((k) => k.id === lead.crewId) : undefined;
    const need = crew ? ARCHETYPES[crew.archetype].intelNeeded[lead.tier === 4 ? 4 : 3] : 0;
    if (crew && (crew.intel[lead.subjectId] ?? 0) < need) return fail('More intel is needed first');
  }
  const built = buildCard(d, lead, 'warrant');
  if ('reason' in built) return fail(built.reason);
  putOnBoard(d, lead, built.card);
  return { ok: true };
}

export function respondToContact(d: GameState, leadId: string): HandlerResult {
  const w = d.world;
  const lead = w.leads.find((l) => l.id === leadId);
  if (!lead) return fail('No such lead');
  if (lead.source !== 'armed_contact') return fail('That was not an armed contact');
  if (lead.status === 'warrant') return lead.cardId && d.incidents.some((c) => c.id === lead.cardId) ? { ok: true } : fail('That call is already running');
  if (lead.status === 'served') return fail('That contact was already resolved');
  if (lead.liveUntil === undefined || d.department.clockHighWater > lead.liveUntil) return fail('That moment has passed. It waits as a lead you can open a warrant on');
  const built = buildCard(d, lead, 'armed_contact');
  if ('reason' in built) return fail(built.reason);
  putOnBoard(d, lead, built.card);
  return { ok: true };
}

/** A lead whose card left the board without a call running returns to open. Called each settlement. */
export function reconcileLeads(d: GameState): void {
  const run = d.activeRun;
  for (const lead of d.world.leads) {
    if (lead.status !== 'warrant') continue;
    const onBoard = lead.cardId !== undefined && d.incidents.some((c) => c.id === lead.cardId);
    const running = !!run && run.status !== 'closed' && (run.world?.leadId === lead.id || (lead.cardId !== undefined && run.scenarioId === lead.cardId));
    if (!onBoard && !running) {
      lead.status = 'open';
      delete lead.cardId;
    }
  }
}

/** How a world call's ending settles its investigation. An ending that names no resolution counts as a lawful
 * one when the call was completed and as an escape when it was not. */
function resolutionOf(run: OperationRun, result: DebriefResult): WorldCase['resolution'] | 'escaped' {
  const ending = getScenario(run.scenarioId)?.endings[result.endingId];
  return ending?.world?.resolution ?? (result.completionAchieved ? 'charged' : 'escaped');
}

/** Called by operation.closeDebrief after the career loop. The first call's debrief moves the first-session
 * journey on; a world call settles its lead and investigation. The award itself is paid by the world when the
 * review clock ends, never here. */
export function applyWorldDebrief(d: GameState, run: OperationRun, result: DebriefResult): void {
  const w = d.world;
  if (w.onboarding.stage === 'cold_open') w.onboarding.stage = 'founding';
  const ref = run.world;
  if (!ref) return;
  const lead = w.leads.find((l) => l.id === ref.leadId);
  const c = w.cases.find((k) => k.id === ref.caseId);
  const subject = w.subjects[ref.subjectId];
  if (!lead || !c || lead.status === 'served') return;
  const now = d.department.clockHighWater;
  const resolution = resolutionOf(run, result);
  if (resolution === 'escaped') {
    lead.status = 'open';
    delete lead.cardId;
    if (subject) addHistory(subject, { at: now, kind: 'sighted', leadId: lead.id, caseId: c.id });
    return;
  }
  const officerIds = run.squadIds.flatMap((squadId) => runRoster(d, run, squadId));
  lead.status = 'served';
  delete lead.cardId;
  if (c.status === 'open') {
    c.status = 'review';
    c.closesAt = now + REVIEW_CLOCK_MS[c.tier];
    c.resolution = resolution;
    c.source = ref.kind === 'warrant' ? 'warrant' : 'call';
    for (const id of officerIds) if (!c.officerIds.includes(id)) c.officerIds.push(id);
    if (subject) {
      subject.status = 'held';
      addHistory(subject, { at: now, kind: 'warrant_served', leadId: lead.id, caseId: c.id });
    }
  }
}
