import type { ActionDefinition, ScenarioDefinition } from '../../sim/scenario-types';
import type { BuiltLocation } from '../../sim/types';
import { addFactsV4, agreementAction, assessmentActions, endingsV4, finalizeV4, finishActions, preparationAction, proceedAction, requestCareAction, verificationAction, type V4Context } from './common-v4';
import { premiseForV4 } from './premises-v4';
import { careActionsV4, servicesV4 } from './support-v4';
import { planReviewActionV4, protectiveFinishV4, recoveryActionsV4, responseActionV4 } from './responses-v4';

/** Entirely separate v4 definitions: no issued v1/v2/v3 builder runs here. */
export function withVersionFourChoices(s: ScenarioDefinition, built: BuiltLocation): ScenarioDefinition {
  s.version = 4;
  const spec = s.incident!;
  const premise = premiseForV4(spec);
  const targetId = s.facts[0].spaceId;
  const opening = built.location.openings.find(o => ['door', 'doorway', 'sliding'].includes(o.type) && (o.a === targetId || o.b === targetId));
  const ctx: V4Context = { scenario: s, built, premise, targetId, targetName: built.location.rooms.find(r => r.id === targetId)!.label.toLowerCase(), entryId: built.location.entries[0], openingId: opening?.id, difficulty: 33 + spec.tier * 3, careServiceId: premise.delayedReceiver ? 'district_paramedics' : 'city_paramedics' };
  s.summary = premise.report;
  s.variantLabel = premise.label;
  s.briefing = { dispatchReason: premise.dispatchReason, teamResponsibilities: premise.responsibilities, known: [premise.report, s.briefing.known[1]], unknown: ['Which parts of the original account are still accurate', 'What help the person wants and whether a medical assessment is needed', 'Whether the proposed exit is usable; this is separate from immediate danger'] };
  s.pressure = { ...premise.pressure };
  s.pressureLabel = premise.aidFirst ? 'A reported medical need makes delay costly' : premise.aftermath ? 'Care is still pending after the protective phase' : premise.family === 'protective' ? 'Time to check and complete the protective task' : 'Time to check the original report';
  s.objectives = [{ id: 'o_report', label: 'Check current danger and the person’s actual needs' }, { id: 'o_premise', label: premise.objective }, { id: 'o_finish', label: 'Complete the immediate duty or record what remains unfinished' }];
  s.environment = { timeOfDay: spec.seed % 3 === 0 ? 'night' : 'day', weather: 'clear', power: 'on', clutter: 0, hazards: [], communication: 'normal', crowd: 0, keyholder: Boolean(premise.aftermath), plansOnFile: false, alarm: spec.type === 'burglary' || spec.type === 'business_robbery' ? 'triggered' : 'none', cctv: false };
  addFactsV4(ctx);
  s.externalServices = servicesV4(ctx);
  s.endings = endingsV4(ctx);
  const finish = finishActions(ctx);
  const earlyClose = structuredClone(finish[0]);
  earlyClose.id = 'v4_close_report_early'; earlyClose.stage = 'adapt';
  const agreement = agreementAction(ctx);
  agreement.visibleWhen = { facts: [{ factId: 'f_person', in: ['unknown', 'reported', 'confirmed'] }] };
  const resolve: ActionDefinition[] = [finish[0], finish[1], verificationAction(ctx, 'resolve', 'resolve_check')];
  if (premise.family !== 'assistance') resolve.push(responseActionV4(ctx));
  resolve.push(planReviewActionV4(ctx), ...recoveryActionsV4(ctx));
  // A welfare or medical check that verifies a real threat still belongs to this
  // team. Fresh assessment can open its own protective option, never an unseen
  // superior police team. These choices are mutually exclusive with safe visits.
  if (premise.family !== 'protective') {
    const protectiveContext: V4Context = { ...ctx, premise: { ...premise, family: 'protective' } };
    const response = responseActionV4(protectiveContext, true);
    response.id = 'v4_revised_protective_plan';
    response.title = 'Complete the revised protective plan';
    response.visibleWhen = { flags: ['v4_reassessed'], notFlags: ['v4_care_mode', 'v4_scene_completed'], facts: [{ factId: 'f_person', in: ['confirmed'] }, { factId: 'f_immediate_danger', in: ['confirmed'] }] };
    resolve.push(response);
  }
  resolve.push(protectiveFinishV4(ctx), ...careActionsV4(ctx), finish[2]);
  s.stages = {
    assess: { id: 'assess', label: 'Check the dispatch', prompt: 'Your team is already assigned to a specific higher-risk report. Check what is happening now or request medical help while retaining the scene.', actions: assessmentActions(ctx) },
    adapt: { id: 'adapt', label: 'Prepare the next step', prompt: premise.objective, actions: [verificationAction(ctx), preparationAction(ctx), agreement, earlyClose, requestCareAction(ctx, 'request_care', 'adapt'), proceedAction(ctx)] },
    resolve: { id: 'resolve', label: 'Follow through', prompt: 'Carry out the plan, confirm accepted care or honestly record what remains unfinished. A setback leaves the incident with your team.', actions: resolve },
  };
  finalizeV4(s);
  return s;
}
