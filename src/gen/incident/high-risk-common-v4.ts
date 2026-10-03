import type { ActionDefinition, Condition, FactDefinition, OutcomeEffect, ScenarioDefinition } from '../../sim/scenario-types';
import type { BuiltLocation, OutcomeBand, StageId } from '../../sim/types';
import { hashSeed } from '../../sim/rng';

/** Fictional command decisions, deliberately without weapon or assault procedures. */
export interface HighRiskContext {
  scenario: ScenarioDefinition;
  built: BuiltLocation;
  targetId: string;
  exteriorId: string;
  difficulty: number;
}
export const HR_BANDS: OutcomeBand[] = ['favorable', 'mixed', 'adverse'];
export const HR_NORMAL: Condition = { notFlags: ['hr_care_mode', 'hr_injury_pause'] };
export const HR_NO_CASUALTIES = ['casualty:untreated', 'casualty:awaiting_transport'];
export function sampleHR(ctx: HighRiskContext, key: string): number {
  return hashSeed(`${ctx.scenario.incident!.seed}:high-risk-v4:${key}`) / 0x100000000;
}
export function factHR(ctx: HighRiskContext, id: string, label: string, truth: boolean, claim: string, resolved: { confirmed: string; disproved: string }, initial: FactDefinition['initial'] = 'reported'): FactDefinition {
  return { id, label, spaceId: ctx.targetId, truth, initial, showWhenUnknown: true,
    markers: { reported: 'CHECK NEEDED', confirmed: 'CONFIRMED', disproved: 'RULED OUT' },
    claim, source: 'Dispatch account, not independently checked', note: 'Check this separately before relying on it.', resolved,
    uncertainty: `Whether ${label.toLowerCase()}` };
}
export function previewHR(text: string): Record<OutcomeBand, string> { return { favorable: text, mixed: text, adverse: text }; }
export function actionHR(ctx: HighRiskContext, id: string, stage: StageId, title: string, summary: string, icon: ActionDefinition['icon'], preview: Record<OutcomeBand, string>, extra: Partial<ActionDefinition> = {}): ActionDefinition {
  return { id: `hr_${id}`, stage, title, summary, icon, targetId: ctx.targetId, task: title,
    requires: {}, check: { kind: 'coordination', ratings: [{ key: 'coordination', weight: 0.6 }, { key: 'composure', weight: 0.4 }], difficulty: ctx.difficulty },
    approach: 'none', observes: [], workload: { base: 3, perSqFt: 0 }, stressBase: 4,
    consequenceLevel: 'moderate', outcomePreview: preview, visibleWhen: structuredClone(HR_NORMAL),
    outcomes: { favorable: [], mixed: [], adverse: [] }, ...extra };
}
export function sameHR(action: ActionDefinition, effects: OutcomeEffect[]): ActionDefinition {
  for (const band of HR_BANDS) action.outcomes[band] = structuredClone(effects);
  return action;
}
export function visibleHR(flags: string[] = [], notFlags: string[] = []): Condition {
  return { flags, notFlags: [...HR_NORMAL.notFlags!, ...notFlags] };
}
export function reqFlag(flag: string, reason: string) { return { flag, reason }; }
export function reqFact(factId: string, reason: string) { return { factId, in: ['confirmed' as const], reason }; }
export function injuryHR(severity: 'wounded' | 'serious', label: string): OutcomeEffect {
  return { officerHarm: { severity, label }, setFlags: ['hr_injury_pause'], text: 'A participating officer was injured and is out of action. The plan pauses for a care, evacuation or reduced-team decision.' };
}
/** Reopen an outstanding officer duty before attempting a full civilian handover. */
export function enterCareHR(): OutcomeEffect[] {
  return [{ setFlags: ['hr_care_mode'], stage: 'resolve' },
    { when: { flags: ['casualty:awaiting_transport'] }, setFlags: ['hr_injury_pause'], text: 'The rescue step is complete, but the injured officer still needs an accepted medical transfer.' }];
}
export function partialHR(ctx: HighRiskContext, stage: StageId, extra: Partial<ActionDefinition> = {}): ActionDefinition {
  return sameHR(actionHR(ctx, `${stage}_withdraw`, stage, 'Withdraw and record unfinished duties', 'Record protected people, injuries and unresolved responsibilities. Record who still needs help and care.', 'handover', previewHR('Record the progress made and who still needs protection or care.'), { stressBase: 0, commandOnly: true, ...extra }), [
    { ending: 'partial', objective: 20, text: 'The team withdrew with its actual progress and unfinished responsibilities recorded. This was not a completed resolution or an accepted handover.' },
  ]);
}
export function finalizeHR(scenario: ScenarioDefinition): void {
  for (const stage of Object.values(scenario.stages)) for (const action of stage.actions) {
    const flag = `used:${action.id}`;
    action.visibleWhen = { ...action.visibleWhen, notFlags: [...action.visibleWhen?.notFlags ?? [], flag] };
    action.requires.notFlags = [...action.requires.notFlags ?? [], reqFlag(flag, 'This decision has already been attempted')];
    for (const band of HR_BANDS) action.outcomes[band].unshift({ setFlags: [flag], ...(action.stage === 'resolve' ? { stage: 'resolve' as const } : {}) });
  }
}

export function servicesHR(ctx: HighRiskContext): ScenarioDefinition['externalServices'] {
  return [
    { id: 'civilian_ambulance', label: 'Civilian receiving ambulance', kind: 'medical', description: 'A named ambulance crew accepts care only after people are safe, accounted for and agree to the assessment.', arrivalMinutes: 6 + Math.floor(sampleHR(ctx, 'civilian_arrival') * 7), available: sampleHR(ctx, 'civilian_available') >= 0.12,
      acceptWhen: { flags: ['hr_people_safe', 'hr_primary_complete', 'hr_care_agreed'] } },
    { id: 'officer_ambulance', label: 'Officer receiving ambulance', kind: 'medical', description: 'A separate crew can receive the injured officer. The civilian crew cannot be double-booked as this receiver.', arrivalMinutes: 5 + Math.floor(sampleHR(ctx, 'officer_arrival') * 7), available: sampleHR(ctx, 'officer_available') >= 0.1 },
  ];
}

export function endingsHR(): ScenarioDefinition['endings'] {
  return {
    protection_complete: { id: 'protection_complete', title: 'Protection complete; next step agreed', summary: 'Everyone identified reached safety, no current medical need remains in the checked account, and an agreed next step is recorded. Any injured officers have reached an accepted receiver.', trustAdjust: 2, strain: -3, disposition: 'followup_agreed', completion: { flags: ['hr_people_safe', 'hr_primary_complete', 'hr_care_checked', 'hr_followup_agreed'], facts: [{ factId: 'f_care_needed', in: ['disproved'] }], notFlags: [...HR_NO_CASUALTIES, 'hr_care_required'] } },
    care_accepted: { id: 'care_accepted', title: 'Protection complete; care accepted', summary: 'Every identified civilian reached safety and the named ambulance accepted their care. Any injured officers also reached an accepted medical receiver.', trustAdjust: 2, strain: -2, disposition: 'care_accepted', completion: { acceptedServiceId: 'civilian_ambulance', flags: ['hr_people_safe', 'hr_primary_complete', 'hr_care_agreed', 'hr_care_transferred'], notFlags: HR_NO_CASUALTIES } },
    partial: { id: 'partial', title: 'Partial protection; duties remain', summary: 'The record distinguishes people protected from people still needing help. Unresolved danger and unaccepted medical care remain open.', trustAdjust: -1, strain: 3, disposition: 'relief_partial', remainingTasks: ['Finish the identified protection and danger responsibilities', 'Complete any outstanding civilian and officer medical transfers'] },
    handed_over: { id: 'handed_over', title: 'Incident remains unresolved', summary: 'Available decisions were exhausted. Protection or care remains unfinished.', trustAdjust: -1, strain: 3, disposition: 'unresolved', remainingTasks: ['Reassess the unfinished protection duty and outstanding medical care'] },
  };
}

/** The casualty interruption replaces normal choices instead of adding a large menu. */
export function officerCareHR(ctx: HighRiskContext, stage: StageId): ActionDefinition[] {
  const mode: Condition = { flags: ['hr_injury_pause'] };
  const ambulance = ctx.scenario.externalServices!.find(s => s.id === 'officer_ambulance')!;
  const aid = sameHR(actionHR(ctx, `${stage}_officer_aid`, stage, 'Stabilize the injured officer', 'A qualified participating medic uses one assigned trauma kit. The officer remains unavailable and still needs medical transfer.', 'medic', previewHR('Provide field stabilization using one trauma kit; the officer does not return to the operation.'), {
    visibleWhen: { flags: ['hr_injury_pause', 'casualty:untreated'] }, requires: { certs: ['advanced_first_aid'], allTags: ['medkit'], flags: [reqFlag('casualty:untreated', 'There must be an untreated injured officer')] }, consumes: [{ tag: 'medkit', qty: 1 }],
    check: { kind: 'medical', ratings: [{ key: 'medical', weight: 0.8 }, { key: 'coordination', weight: 0.2 }], difficulty: ctx.difficulty - 5 }, capabilities: { rules: ['medical_exposure'], responseContext: 'open' }, workload: { base: 2, perSqFt: 0 }, consequenceLevel: 'low',
  }), [{ officerCare: 'stabilize', pressure: -8, text: 'The medic stabilized the recorded casualty with one trauma kit. Professional care and recovery are still required.' }]);
  const request = sameHR(actionHR(ctx, `${stage}_officer_request`, stage, 'Request the officer ambulance', `${ambulance.available ? `Its estimated response is ${ambulance.arrivalMinutes} operation minutes.` : 'No officer ambulance is available in this response window.'} Your team retains all scene duties.`, 'radio', previewHR('Request a separate medical receiver; this does not evacuate anyone or end the incident.'), { commandOnly: true, visibleWhen: { ...mode, notFlags: ['hr_officer_requested'] }, targetId: ctx.exteriorId, workload: { base: 1, perSqFt: 0 } }), [{ requestSupport: ['officer_ambulance'], setFlags: ['hr_officer_requested'], text: 'The separate officer ambulance was requested. No medical responsibility has yet been accepted.' }]);
  const wait = sameHR(actionHR(ctx, `${stage}_officer_wait`, stage, 'Wait for the officer ambulance', 'Wait for the crew’s remaining arrival time. Civilian danger continues during the wait.', 'wait', previewHR('Advance the remaining response time once, while care stays with your team.'), { commandOnly: true, visibleWhen: { ...mode, flags: ['hr_injury_pause', 'hr_officer_requested'], notFlags: ['hr_officer_waited'] }, requires: { externalSupport: [{ serviceId: 'officer_ambulance', status: 'requested', reason: 'The requested officer ambulance must still be responding' }] }, awaitSupport: 'officer_ambulance', tempo: 'waiting', workload: { base: 0, perSqFt: 0 } }), [{ setFlags: ['hr_officer_waited'], text: 'The remaining officer-ambulance response time elapsed. The incident and civilian duties stayed with the team.' }]);
  const evacuate = sameHR(actionHR(ctx, `${stage}_officer_evacuate`, stage, 'Transfer the injured officer', 'The available crew receives the injured officer and takes responsibility for their care. Resume with the remaining team.', 'medic', previewHR('Transfer the injured officer to the crew and reopen the interrupted plan with fewer available officers.'), { commandOnly: true, visibleWhen: mode, targetId: ctx.exteriorId, requires: { flags: [reqFlag('casualty:awaiting_transport', 'A recorded injured officer must still need transport')], externalSupport: [{ serviceId: 'officer_ambulance', status: 'available', reason: 'The separate officer ambulance must actually have arrived' }] }, workload: { base: 2, perSqFt: 0 }, consequenceLevel: 'low' }), [{ acceptSupport: ['officer_ambulance'], officerCare: 'evacuate', clearFlags: ['hr_injury_pause'], text: 'The ambulance crew accepted the injured officer. The remaining team retained command and resumed the unfinished incident.' }]);
  const continuePlan = sameHR(actionHR(ctx, `${stage}_officer_continue`, stage, 'Continue with the reduced team', 'Keep the officer out of participation and continue the civilian protection duty. The outstanding medical transfer still blocks full completion.', 'perimeter', previewHR('Resume with the remaining team. The injured officer still needs care.'), { commandOnly: true, visibleWhen: { ...mode, notFlags: ['hr_care_mode'] }, workload: { base: 1, perSqFt: 0 }, consequenceLevel: 'high' }), [{ clearFlags: ['hr_injury_pause'], setFlags: ['hr_officer_transfer_pending'], text: 'The remaining officers continued the protection duty. The injured officer did not return, and unaccepted officer care remains an open responsibility.' }]);
  const withdraw = partialHR(ctx, stage, { id: `hr_${stage}_officer_withdraw`, visibleWhen: mode });
  return [aid, request, wait, evacuate, continuePlan, withdraw];
}

/** Actual access is achieved by each family's rescue step before this shared care phase. */
export function civilianCareHR(ctx: HighRiskContext, civilianCareFlags: string[]): ActionDefinition[] {
  const mode: Condition = { flags: ['hr_care_mode'], notFlags: ['hr_injury_pause'] };
  const service = ctx.scenario.externalServices!.find(s => s.id === 'civilian_ambulance')!;
  const request = sameHR(actionHR(ctx, 'civilian_request', 'resolve', 'Request the civilian ambulance', service.available ? `The crew responds in ${service.arrivalMinutes} operation minutes; protection and care responsibility remain with the team.` : 'The crew cannot attend in this response window. Record the actual availability barrier; care remains with your team.', 'radio', previewHR('Start the named crew’s response clock. The operation remains active.'), { commandOnly: true, visibleWhen: { ...mode, flags: ['hr_care_mode', 'hr_care_required'], notFlags: ['hr_injury_pause', 'hr_civilian_requested'] }, workload: { base: 1, perSqFt: 0 }, consequenceLevel: 'low' }), [{ requestSupport: ['civilian_ambulance'], setFlags: ['hr_civilian_requested'], text: 'The civilian ambulance was requested; its request is not an accepted care transfer.' }]);
  const wait = sameHR(actionHR(ctx, 'civilian_wait', 'resolve', 'Wait for the civilian ambulance', 'Wait for the crew’s remaining arrival time.', 'wait', previewHR('The remaining response time passes. The crew still needs to receive the people and accept their care.'), { commandOnly: true, visibleWhen: { ...mode, flags: ['hr_care_mode', 'hr_care_required', 'hr_civilian_requested'], notFlags: ['hr_injury_pause', 'hr_civilian_waited'] }, requires: { externalSupport: [{ serviceId: 'civilian_ambulance', status: 'requested', reason: 'The civilian crew must have been requested and still be responding' }] }, awaitSupport: 'civilian_ambulance', tempo: 'waiting', workload: { base: 0, perSqFt: 0 } }), [{ setFlags: ['hr_civilian_waited'], text: 'The remaining civilian-ambulance response time elapsed. No one has yet accepted care.' }]);
  const agree = sameHR(actionHR(ctx, 'civilian_agreement', 'resolve', 'Discuss care with everyone rescued', 'Explain the available clinical assessment, check each person’s needs and record their agreement individually.', 'radio', previewHR('Confirm the rescued people’s agreement after a checked conversation. The ambulance still needs to receive them.'), { visibleWhen: { ...mode, flags: ['hr_care_mode', 'hr_care_required'], notFlags: ['hr_injury_pause', 'hr_care_agreed'] }, requires: { flags: [reqFlag('hr_people_safe', 'Every identified person must have reached safety')] }, check: { kind: 'contact', ratings: [{ key: 'communication', weight: 0.75 }, { key: 'composure', weight: 0.25 }], difficulty: ctx.difficulty }, workload: { base: 4, perSqFt: 0 }, capabilities: { rules: [], deescalation: true }, consequenceLevel: 'low' }), [{ setFlags: ['hr_care_agreed'], text: 'Each rescued person accepted the explained medical assessment. No medical diagnosis or completed care transfer was implied.' }]);
  const aid = sameHR(actionHR(ctx, 'civilian_aid', 'resolve', 'Provide first aid while waiting', 'A participating qualified medic uses one assigned trauma kit for the recorded immediate care need.', 'medic', previewHR('Use one real kit for immediate assistance; professional assessment remains required.'), { visibleWhen: { ...mode, flags: ['hr_care_mode', 'hr_care_required'], notFlags: ['hr_injury_pause', 'hr_civilian_aid'] }, requires: { certs: ['advanced_first_aid'], allTags: ['medkit'], flags: [reqFlag('hr_people_safe', 'People must first be reached and protected')] }, consumes: [{ tag: 'medkit', qty: 1 }], check: { kind: 'medical', ratings: [{ key: 'medical', weight: 0.8 }, { key: 'coordination', weight: 0.2 }], difficulty: ctx.difficulty - 4 }, capabilities: { rules: ['medical_exposure'], responseContext: 'open' }, consequenceLevel: 'low' }), [{ setFlags: ['hr_civilian_aid'], civilian: 3, pressure: -8, text: 'Qualified first aid addressed the immediate need using one trauma kit. The named ambulance still has to accept care.' }]);
  const transfer = sameHR(actionHR(ctx, 'civilian_transfer', 'resolve', 'Transfer everyone rescued to the crew', 'Check the people count, protection outcome and receiving crew’s acceptance. Unfinished officer care also prevents full closure.', 'medic', previewHR('Complete the named clinical transfer and the verified protection task, earning full completion credit.'), { commandOnly: true, visibleWhen: { ...mode, flags: ['hr_care_mode', 'hr_care_checked', 'hr_care_required'] }, targetId: ctx.exteriorId, requires: { flags: [reqFlag('hr_people_safe', 'Every identified civilian must be safe'), reqFlag('hr_primary_complete', 'Finish this incident’s protection responsibility'), reqFlag('hr_care_agreed', 'Confirm each rescued person’s agreement to assessment')], notFlags: HR_NO_CASUALTIES.map(flag => reqFlag(flag, 'The injured officer still needs an accepted medical transfer')), externalSupport: [{ serviceId: 'civilian_ambulance', status: 'available', reason: 'The named civilian ambulance must actually have arrived' }] }, workload: { base: 2, perSqFt: 0 }, consequenceLevel: 'low' }), [{ acceptSupport: ['civilian_ambulance'], setFlags: ['hr_care_transferred', ...civilianCareFlags], objective: 100, ending: 'care_accepted', text: 'The named ambulance received every identified civilian and explicitly accepted their care. The checked protection and officer-care responsibilities are complete.' }]);
  const partial = partialHR(ctx, 'resolve', { id: 'hr_civilian_partial', title: 'Record care as pending', visibleWhen: mode });
  const needs = sameHR(actionHR(ctx, 'check_civilian_needs', 'resolve', 'Check everyone’s immediate needs', 'Ask each rescued person about current needs. A recorded injury still needs assessment even if the original account reported no complaint.', 'intel', previewHR('Separate people needing clinical assessment from those who can agree a safe next step without an ambulance.'), { visibleWhen: { ...mode, notFlags: ['hr_injury_pause', 'hr_care_checked'] }, check: { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.45 }, { key: 'communication', weight: 0.55 }], difficulty: ctx.difficulty }, workload: { base: 2, perSqFt: 0 }, consequenceLevel: 'low' }), [
    { reveal: ['f_care_needed'], setFlags: ['hr_care_checked'], text: 'The team checked each rescued person’s current needs. This was an account of needs, not a medical diagnosis.' },
    { truth: [{ factId: 'f_care_needed', is: true }], setFlags: ['hr_care_required'], text: 'The checked account identifies a current medical need. Arrange an accepted clinical assessment.' },
  ]);
  const nextStep = sameHR(actionHR(ctx, 'civilian_next_step', 'resolve', 'Agree the next step and close', 'Confirm everyone’s safety and their chosen next step. With no current need or recorded injury, an ambulance assessment is optional.', 'handover', previewHR('Close the completed protection task with the person’s agreed next step. Nobody is forced into nonessential medical care.'), { visibleWhen: { ...mode, flags: ['hr_care_mode', 'hr_care_checked'], notFlags: ['hr_injury_pause', 'hr_care_required'], facts: [{ factId: 'f_care_needed', in: ['disproved'] }] }, requires: { flags: [reqFlag('hr_people_safe', 'Protect every identified person'), reqFlag('hr_primary_complete', 'Finish the protection task')], notFlags: [...HR_NO_CASUALTIES, 'hr_care_required'].map(flag => reqFlag(flag, 'A recorded injury or current medical need still requires accepted care')) }, workload: { base: 2, perSqFt: 0 }, consequenceLevel: 'low' }), [{ setFlags: ['hr_followup_agreed'], objective: 100, ending: 'protection_complete', text: 'Everyone identified was safe and chose an agreed next step. The checked account had no current medical need or recorded civilian injury, and any officer care was already accepted.' }]);
  return [needs, nextStep, request, wait, agree, aid, transfer, partial];
}
