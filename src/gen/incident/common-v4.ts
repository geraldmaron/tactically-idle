import type { ActionDefinition, Condition, OutcomeEffect, ScenarioDefinition } from '../../sim/scenario-types';
import type { BuiltLocation, OutcomeBand, StageId } from '../../sim/types';
import { hashSeed } from '../../sim/rng';
import type { V4Premise } from './premises-v4';

export interface V4Context {
  scenario: ScenarioDefinition;
  built: BuiltLocation;
  premise: V4Premise;
  targetId: string;
  targetName: string;
  entryId: string;
  openingId?: string;
  difficulty: number;
  careServiceId: string;
}
export const BANDS: OutcomeBand[] = ['favorable', 'mixed', 'adverse'];
export const known = ['confirmed', 'disproved'] as const;
export const defaultMode: Condition = { notFlags: ['v4_care_mode'] };
export function actionV4(ctx: V4Context, id: string, stage: StageId, title: string, summary: string, icon: ActionDefinition['icon'], preview: Record<OutcomeBand, string>, over: Partial<ActionDefinition> = {}): ActionDefinition {
  return {
    id: `v4_${id}`, stage, title, icon, summary, task: title, targetId: ctx.targetId,
    requires: {}, check: { kind: 'coordination', ratings: [{ key: 'coordination', weight: 0.55 }, { key: 'composure', weight: 0.45 }], difficulty: ctx.difficulty },
    approach: 'none', observes: [], workload: { base: 3, perSqFt: 0 }, stressBase: 3,
    outcomePreview: preview, consequenceLevel: 'moderate', outcomes: { favorable: [], mixed: [], adverse: [] }, ...over,
  };
}
export function sameOutcomes(a: ActionDefinition, effects: OutcomeEffect[]): ActionDefinition {
  for (const band of BANDS) a.outcomes[band] = structuredClone(effects);
  return a;
}
export function fixedPreview(text: string): Record<OutcomeBand, string> { return { favorable: text, mixed: text, adverse: text }; }
export function finalizeV4(s: ScenarioDefinition): void {
  for (const stage of Object.values(s.stages)) for (const a of stage.actions) {
    const flag = `used:${a.id}`;
    a.visibleWhen = { ...a.visibleWhen, notFlags: [...a.visibleWhen?.notFlags ?? [], flag] };
    a.requires.notFlags = [...a.requires.notFlags ?? [], { flag, reason: 'This step has already been attempted' }];
    for (const band of BANDS) a.outcomes[band].unshift({ setFlags: [flag], ...(a.stage === 'resolve' ? { stage: 'resolve' as const } : {}) });
  }
}
export function hiddenTruthV4(ctx: V4Context, claim: string, likelihood: number): boolean {
  return hashSeed(`${ctx.scenario.incident!.seed}:v4:hidden:${claim}`) / 0x100000000 < likelihood;
}
export function publicSampleV4(ctx: V4Context, purpose: string): number {
  return hashSeed(`${ctx.scenario.incident!.seed}:v4:public:${purpose}`) / 0x100000000;
}
export function checkedEffects(extra: OutcomeEffect = {}): OutcomeEffect[] {
  return [
    { reveal: ['f_person', 'f_care_needed', 'f_immediate_danger', 'f_adjacent_safety'], setFlags: ['v4_report_checked'], ...extra },
    { truth: [{ factId: 'f_immediate_danger', is: false }], setFlags: ['v4_care_safe'], text: 'The current check found no immediate threat to people. Exit suitability remains a separate question.' },
  ];
}
export function addFactsV4(ctx: V4Context): void {
  const s = ctx.scenario;
  const family = ctx.premise.family;
  const knownPresent = ctx.premise.aftermath || ctx.premise.id === 'welfare_after_threat';
  const present = knownPresent || hiddenTruthV4(ctx, 'person_present', family === 'welfare' ? 0.72 : 0.94);
  const medical = present && hiddenTruthV4(ctx, 'medical_assessment_needed', family === 'assistance' ? 0.83 : 0.38);
  const danger = !ctx.premise.aftermath && present && hiddenTruthV4(ctx, 'immediate_danger', family === 'protective' ? 0.62 : 0.28);
  const person = s.facts[0];
  person.truth = present;
  person.label = `Reported person in the ${ctx.targetName}`;
  person.initial = knownPresent ? 'confirmed' : 'reported';
  person.markers = { reported: 'PERSON?', confirmed: 'PERSON LOCATED', disproved: 'REPORT RULED OUT' };
  person.resolved = { confirmed: `The person has been located in the ${ctx.targetName}.`, disproved: 'Independent checks found that the reported person was not at this location.' };
  if (person.person) { person.person.label = 'Person at the scene'; if (!present) delete person.person.at; }
  const fact = (id: string, label: string, truth: boolean, claim: string, confirmed: string, disproved: string) => ({
    id, label, spaceId: ctx.targetId, truth, initial: 'reported' as const, showWhenUnknown: true,
    markers: { reported: 'CHECK NEEDED', confirmed: 'CONFIRMED', disproved: 'RULED OUT' },
    claim, source: 'Dispatch and caller reports (not yet checked)', note: 'Check this claim independently; another claim being true does not settle it.',
    resolved: { confirmed, disproved }, uncertainty: `Whether ${label.toLowerCase()}`,
  });
  s.facts = [person,
    fact('f_care_needed', 'A current medical concern needs paramedic assessment', medical,
      'A medical concern may need assessment; the report is not a diagnosis.',
      'The checked report and the person’s account identify a current medical concern needing paramedic assessment.',
      'The checked account identifies no current medical complaint; the team has not made a medical diagnosis.'),
    { ...fact('f_immediate_danger', 'People face an immediate threat at the scene', danger,
      'The original call described an immediate threat of serious harm. Its current accuracy is unconfirmed.',
      'Current observations support the reported immediate threat. A protective plan must address it before medical access.',
      'Current checks do not support an immediate threat. The team can reassess the original high-risk response.'),
      ...(ctx.premise.aftermath ? { initial: 'disproved' as const } : {}) },
    fact('f_adjacent_safety', 'The proposed exit is usable', hiddenTruthV4(ctx, 'proposed_exit_usable', 0.68),
      'The suggested exit has not been checked for this person’s agreed move.',
      'The proposed exit is usable. This finding does not by itself settle immediate danger.',
      'The proposed exit is unsuitable. Another access arrangement or an unresolved record is needed.'),
  ];
}
export function endingsV4(ctx: V4Context): ScenarioDefinition['endings'] {
  return {
    report_disproved: { id: 'report_disproved', title: 'Mistaken report closed', summary: 'The original report was checked against independent information and corrected. The high-risk response is closed.', trustAdjust: 2, strain: -3, disposition: 'resolved', completion: { flags: ['v4_report_closed', 'v4_report_checked'], facts: [{ factId: 'f_person', in: ['disproved'] }, { factId: 'f_immediate_danger', in: ['disproved'] }] } },
    voluntary_followup: { id: 'voluntary_followup', title: 'Voluntary next step confirmed', summary: 'The person’s chosen next step was confirmed and the immediate concern was closed.', trustAdjust: 2, strain: -3, disposition: 'followup_agreed', completion: { flags: ['v4_followup_confirmed', 'v4_agreement', 'v4_report_checked'], facts: [{ factId: 'f_person', in: ['confirmed'] }, { factId: 'f_care_needed', in: ['disproved'] }, { factId: 'f_immediate_danger', in: ['disproved'] }] } },
    protective_completed: { id: 'protective_completed', title: 'Protective task completed', summary: 'The team completed its protective plan and checked the person’s immediate needs. Any original criminal investigation remains a separate task.', trustAdjust: 1, strain: -2, disposition: 'resolved', completion: { flags: ['v4_scene_completed', 'v4_response_prepared'], facts: [{ factId: 'f_person', in: ['confirmed'] }, { factId: 'f_care_needed', in: ['disproved'] }] } },
    care_accepted: { id: 'care_accepted', title: 'Paramedics accepted care', summary: 'The named paramedic crew reached the person, received the checked details and accepted medical responsibility. The team completed its immediate safety and access duties.', trustAdjust: 2, strain: -2, disposition: 'care_accepted', completion: { acceptedServiceId: ctx.careServiceId, flags: ['v4_care_transferred', 'v4_care_access', 'v4_care_agreement', 'v4_care_safe'], facts: [{ factId: 'f_person', in: ['confirmed'] }, { factId: 'f_care_needed', in: ['confirmed'] }] } },
    care_pending: { id: 'care_pending', title: 'Care remains pending', summary: 'The team recorded the person’s needs and what still blocks care. A receiving crew has yet to take responsibility.', trustAdjust: 0, strain: 1, disposition: 'relief_partial', remainingTasks: ['Confirm safe access, agreement and an available paramedic receiver', 'Complete and record accepted medical care'] },
    unresolved: { id: 'unresolved', title: 'Incident remains unresolved', summary: 'The team recorded what it checked and which duties remain unfinished.', trustAdjust: -1, strain: 2, disposition: 'unresolved', remainingTasks: ['Resolve the original concern or verify that the report was mistaken', 'Confirm any remaining safety and care responsibilities'] },
    handed_over: { id: 'handed_over', title: 'No further available choices', summary: 'The available attempts are exhausted and the remaining duties are recorded.', trustAdjust: 0, strain: 1, disposition: 'unresolved', remainingTasks: ['Reassess the unfinished incident and arrange an actual receiver if required'] },
  };
}

export function assessmentActions(ctx: V4Context): ActionDefinition[] {
  const contact = actionV4(ctx, 'contact', 'assess', 'Open a conversation', 'Ask what happened, what the person needs and how they prefer to communicate.', 'radio', {
    favorable: 'Locate the person and establish a usable conversation; the other claims still need checking.', mixed: 'Locate the person through a brief exchange; agreement remains unsettled.', adverse: 'No clear exchange. An independent check and a revised conversation remain available.',
  }, { check: { kind: 'contact', ratings: [{ key: 'communication', weight: 0.7 }, { key: 'composure', weight: 0.3 }], difficulty: ctx.difficulty + ctx.premise.communicationDifficulty }, capabilities: { rules: [], deescalation: true }, equipment: [{ tag: 'hailer', value: 4, group: 'contact_link', label: 'audible invitation to talk' }, { tag: 'throw_phone', value: 7, group: 'contact_link', range: 'opening', label: 'two-way conversation' }], consequenceLevel: 'low' });
  contact.outcomes = { favorable: [{ stage: 'adapt', reveal: ['f_person'], setFlags: ['v4_contact', ...(ctx.premise.id === 'protective_movement' ? ['v4_agreement'] : [])], pressure: -4, text: 'A direct exchange checked the reported location and established how to continue the conversation.' }], mixed: [{ stage: 'adapt', reveal: ['f_person'], setFlags: ['v4_contact_fragile'], text: 'A brief exchange checked the location but did not establish an agreed next step.' }], adverse: [{ stage: 'adapt', setFlags: ['v4_contact_interrupted'], pressure: 3, text: 'Contact was interrupted. Silence was not treated as proof of danger or as agreement.' }] };
  const observe = actionV4(ctx, 'observe', 'assess', 'Check the reported scene', 'Check the person’s location and the current threat as separate claims.', 'intel', {
    favorable: 'Settle location and immediate danger; medical need and exit suitability still need checking.', mixed: 'Settle location after extra time; the threat remains uncertain.', adverse: 'The view is inconclusive. Preserve that uncertainty and check another source.',
  }, { check: { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.7 }, { key: 'coordination', weight: 0.3 }], difficulty: ctx.difficulty }, capabilities: { rules: ['visible_exterior', 'dark_visible_scene'] }, consequenceLevel: 'low' });
  observe.outcomes = { favorable: [{ stage: 'adapt', reveal: ['f_person', 'f_immediate_danger'], setFlags: ['v4_scene_observed'], text: 'Current observations checked the reported location and immediate danger separately.' }, { truth: [{ factId: 'f_immediate_danger', is: false }], setFlags: ['v4_care_safe'] }], mixed: [{ stage: 'adapt', reveal: ['f_person'], extraMinutes: 2, text: 'The person’s location was checked, but an obstructed view left the threat uncertain.' }], adverse: [{ stage: 'adapt', pressure: 3, text: 'The scene check was inconclusive; no unobserved claim was confirmed.' }] };
  const source = actionV4(ctx, 'source', 'assess', 'Check the dispatch account', 'Ask which details were directly observed and when the reported event occurred.', 'intel', {
    favorable: 'Clarify the original account and improve the next independent check.', mixed: 'Identify conflicting details that the next check must settle.', adverse: 'The account remains inconsistent; use a direct or independent check.',
  }, { consequenceLevel: 'low' });
  source.outcomes = { favorable: [{ stage: 'adapt', setFlags: ['v4_source_checked'], pressure: -2, text: 'The team separated direct observations from assumptions and recorded the event timing.' }], mixed: [{ stage: 'adapt', setFlags: ['v4_source_checked'], extraMinutes: 2, text: 'The report still has gaps, but their sources and timing are now identified.' }], adverse: [{ stage: 'adapt', text: 'The source could not clarify the account. The team must still check it independently.' }] };
  const support = requestCareAction(ctx, 'assess_request_care', 'assess');
  return [contact, observe, source, support];
}

export function verificationAction(ctx: V4Context, stage: StageId = 'adapt', id = 'verify'): ActionDefinition {
  const a = actionV4(ctx, id, stage, 'Check the remaining claims', 'Compare the current scene with an independent account. Presence, medical need, danger and exit suitability are separate checks.', 'intel', {
    favorable: 'Settle the four claims and record what the next plan must address.', mixed: 'Settle the claims after extra checking costs time.', adverse: 'Only the reported location is settled. A later reassessment remains available.',
  }, { visibleWhen: stage === 'resolve' ? { notFlags: ['v4_care_mode', 'v4_report_checked'] } : undefined, check: { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.6 }, { key: 'communication', weight: 0.4 }], difficulty: ctx.difficulty - 5 }, modifiers: [{ label: 'Sources and timing checked', when: { flags: ['v4_source_checked'] }, source: 'preparation', value: 7 }], consequenceLevel: 'low' });
  a.outcomes = { favorable: checkedEffects({ text: 'The four claims were checked independently. The team can now choose a response that matches the findings.' }), mixed: checkedEffects({ extraMinutes: 3, text: 'Additional checks settled the claims. The extra time is recorded.' }), adverse: [{ reveal: ['f_person'], setFlags: ['v4_check_incomplete'], pressure: 3, text: 'The location check was reliable, but the other claims remain unsettled. Do not infer safety or a diagnosis.' }] };
  return a;
}
export function preparationAction(ctx: V4Context): ActionDefinition {
  const p = ctx.premise.preparation;
  const a = actionV4(ctx, 'prepare', 'adapt', p.title, p.summary, ctx.premise.aidFirst ? 'medic' : 'intel', {
    favorable: `${p.success} This preparation carries forward if the first plan fails.`, mixed: `Complete the preparation after extra time. It remains available after a setback.`, adverse: 'The preparation is incomplete. Reassess the failed plan before making one revised attempt.',
  }, { modifiers: [{ label: 'Original account checked', when: { flags: ['v4_source_checked'] }, source: 'preparation', value: 4 }] });
  if (ctx.premise.aidFirst) {
    a.requires = { certs: ['advanced_first_aid'], allTags: ['medkit'], facts: [{ factId: 'f_person', in: ['confirmed'], reason: 'Locate the person before providing first aid' }, { factId: 'f_care_needed', in: ['confirmed'], reason: 'Check the reported medical concern before providing aid' }], flags: [{ flag: 'v4_care_safe', reason: 'Check immediate safety before first aid' }] };
    a.consumes = [{ tag: 'medkit', qty: 1 }];
    a.check = { kind: 'medical', ratings: [{ key: 'medical', weight: 0.75 }, { key: 'coordination', weight: 0.25 }], difficulty: ctx.difficulty - 3 };
  }
  if (ctx.premise.id === 'barricade_dialogue') a.certBonus = { cert: 'crisis_negotiation', value: 7, label: 'Own-team crisis negotiation training' };
  if (ctx.premise.id === 'protective_movement') a.requires = { facts: [{ factId: 'f_adjacent_safety', in: ['confirmed'], reason: 'Check that the proposed exit is usable, or prepare a revised route after reassessment' }], openings: ctx.openingId ? [{ openingId: ctx.openingId, blockedReason: 'The physical way is blocked; reassess and try another access arrangement', lockedNote: 'Arranging the locked way takes extra time' }] : [] };
  a.outcomes = { favorable: [{ setFlags: [p.flag, 'v4_response_prepared'], pressure: ctx.premise.aidFirst ? -12 : -3, text: p.success }], mixed: [{ setFlags: [p.flag, 'v4_response_prepared'], extraMinutes: 3, pressure: ctx.premise.aidFirst ? -6 : 0, text: p.success }], adverse: [{ setFlags: ['v4_preparation_gap'], pressure: 3, text: 'The preparation is not complete. Existing information and other preparations were retained.' }] };
  if (['conflicting_intruder', 'alarm_call_recheck', 'threat_account_changes'].includes(ctx.premise.id)) {
    a.outcomes.favorable.push(...checkedEffects({ text: 'The independent account also settled the outstanding scene claims.' }));
    a.outcomes.mixed.push({ reveal: ['f_person', 'f_immediate_danger'] });
  }
  return a;
}
export function agreementAction(ctx: V4Context): ActionDefinition {
  const a = actionV4(ctx, 'agreement', 'adapt', 'Agree on the person’s next step', 'Explain the checked options and ask what the person accepts. Agreement still needs follow-through.', 'radio', {
    favorable: 'Agree on a next step, including paramedic assessment if a medical concern is confirmed.', mixed: 'Reach an agreement after a longer exchange.', adverse: 'No agreement. Preserve the person’s stated concerns for a revised conversation.',
  }, { requires: { facts: [{ factId: 'f_person', in: ['confirmed'], reason: 'Locate the person before claiming agreement' }] }, check: { kind: 'contact', ratings: [{ key: 'communication', weight: 0.75 }, { key: 'composure', weight: 0.25 }], difficulty: ctx.difficulty + ctx.premise.communicationDifficulty }, capabilities: { rules: [], deescalation: true }, modifiers: [{ label: 'A usable conversation is established', when: { flags: ['v4_contact'] }, source: 'preparation', value: 5 }, { label: 'Premise-specific preparation completed', when: { flags: [ctx.premise.preparation.flag] }, source: 'preparation', value: 7 }], consequenceLevel: 'low' });
  a.outcomes = { favorable: [{ setFlags: ['v4_agreement', 'v4_care_agreement'], pressure: -5, text: 'The person agreed to the discussed next step, including assessment if it is needed. The team still owns the incident.' }], mixed: [{ setFlags: ['v4_agreement', 'v4_care_agreement'], extraMinutes: 3, text: 'A longer conversation led to agreement. No care has yet been transferred and no protective plan completed.' }], adverse: [{ setFlags: ['v4_agreement_gap'], text: 'The person did not agree. Their concern is recorded; refusal alone was not treated as danger.' }] };
  return a;
}
export function requestCareAction(ctx: V4Context, id: string, stage: StageId): ActionDefinition {
  const service = ctx.scenario.externalServices!.find(s => s.id === ctx.careServiceId)!;
  return sameOutcomes(actionV4(ctx, id, stage, `Request ${service.label.toLowerCase()}`, `${service.description} Your team keeps the scene until care is accepted.`, 'medic', fixedPreview(service.available ? `Request the crew; arrival is estimated in ${service.arrivalMinutes} operation minutes. Care is not yet accepted.` : 'Record the request, but no crew is available in this response window. The care duty remains open.'), { visibleWhen: { notFlags: ['v4_care_requested'] }, targetId: ctx.entryId, consequenceLevel: 'low', workload: { base: 1, perSqFt: 0 } }), [{ requestSupport: [ctx.careServiceId], setFlags: ['v4_care_requested'], ...(stage === 'assess' ? { stage: 'adapt' as const } : {}), text: service.available ? 'The paramedic crew was requested. The team retains the scene and all unfinished care duties.' : 'The request was recorded, but the named crew cannot attend during this response window. No handover occurred.' }]);
}
export function proceedAction(ctx: V4Context): ActionDefinition {
  return sameOutcomes(actionV4(ctx, 'proceed', 'adapt', 'Choose the next response', 'Review what is known and move to the response choices.', 'handover', fixedPreview('Keep all preparation and move to response choices. Moving stages does not complete an objective.'), { consequenceLevel: 'low', workload: { base: 1, perSqFt: 0 }, stressBase: 0 }), [{ stage: 'resolve', text: 'The team reviewed the remaining safety, agreement and care duties before choosing the next response.' }]);
}
export function finishActions(ctx: V4Context): ActionDefinition[] {
  const close = actionV4(ctx, 'close_report', 'resolve', 'Close the mistaken report', 'Confirm the independent correction and explain why the original report was wrong.', 'handover', fixedPreview('Close the checked, disproved report. No medical or police handover is invented.'), { visibleWhen: { ...defaultMode, facts: [{ factId: 'f_person', in: ['disproved'] }] }, requires: { flags: [{ flag: 'v4_report_checked', reason: 'Finish checking the original report' }], facts: [{ factId: 'f_immediate_danger', in: ['disproved'], reason: 'Check that the original immediate threat is disproved' }] }, consequenceLevel: 'low' });
  sameOutcomes(close, [{ ending: 'report_disproved', setFlags: ['v4_report_closed'], objective: 100, text: 'The independent checks disproved the reported person and immediate threat. The caller received the correction and the response was closed.' }]);
  const followup = actionV4(ctx, 'followup', 'resolve', 'Confirm the voluntary next step', 'Confirm the person’s chosen contact or arrangement actually exists and is accepted.', 'radio', {
    favorable: 'Confirm the chosen next step and close the immediate task.', mixed: 'Confirm the chosen next step after a delay.', adverse: 'The arrangement could not be confirmed. Reassess or record the unresolved duty.',
  }, { visibleWhen: { notFlags: ['v4_care_mode', 'v4_scene_completed'], facts: [{ factId: 'f_person', in: ['confirmed'] }, { factId: 'f_care_needed', in: ['disproved'] }, { factId: 'f_immediate_danger', in: ['disproved'] }] }, requires: { flags: [{ flag: 'v4_agreement', reason: 'Agree the next step with the person first' }, { flag: 'v4_report_checked', reason: 'Check the original report before closing the task' }] }, capabilities: { rules: [], deescalation: true }, consequenceLevel: 'low' });
  followup.outcomes = { favorable: [{ ending: 'voluntary_followup', objective: 100, setFlags: ['v4_followup_confirmed'], text: 'The person’s chosen arrangement was confirmed and accepted. The immediate task is complete.' }], mixed: [{ ending: 'voluntary_followup', objective: 100, setFlags: ['v4_followup_confirmed'], extraMinutes: 3, text: 'The chosen arrangement was confirmed after a delay. This completes the immediate task.' }], adverse: [{ setFlags: ['v4_setback', 'v4_response_review'], text: 'The proposed arrangement could not be confirmed. The team retains the unresolved task.' }] };
  const withdraw = sameOutcomes(actionV4(ctx, 'record_unresolved', 'resolve', 'Record the unfinished incident', 'End this attempt with a clear record of what remains unresolved.', 'handover', fixedPreview('Record the unfinished task and its partial progress.'), { visibleWhen: defaultMode, stressBase: 0, consequenceLevel: 'low' }), [{ ending: 'unresolved', objective: 24, text: 'The team recorded the checked facts and unfinished duties.' }]);
  return [close, followup, withdraw];
}
