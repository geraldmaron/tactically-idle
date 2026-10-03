import type { ActionDefinition, OutcomeEffect } from '../../sim/scenario-types';
import { action, incidentTruth, type V3Context } from './common-v3';

/** Uncertain report: the report can be wrong, a safe resident can answer, or help is needed. */
export function buildWelfareV3(ctx: V3Context): void {
  const { scenario: s, targetId, targetName, openingId } = ctx;
  const present = incidentTruth(ctx, 'person_present');
  const needsHelp = present && incidentTruth(ctx, 'current_assistance_need', 0.5);
  s.facts[0].truth = present;
  if (!present && s.facts[0].person) delete s.facts[0].person.at;
  s.facts[0].markers.disproved = 'REPORT RULED OUT';
  s.facts[0].resolved = { confirmed: `The reported person has been located in the ${targetName}.`, disproved: 'The team checked the room and found the report was wrong.' };
  s.facts.push({
    id: 'f_context', label: 'The person needs help here', spaceId: targetId,
    truth: needsHelp, initial: 'reported', showWhenUnknown: true,
    markers: { reported: 'CONCERN?', confirmed: 'HELP NEEDED', disproved: 'NO IMMEDIATE NEED' },
    claim: 'The caller thinks someone may need help. The team has not checked who is there or what happened.',
    source: 'Dispatch summary (unverified)', note: 'Check when this happened and hear from the person before deciding how to help or close the call.',
    uncertainty: 'Whether help is still needed, or the report was mistaken or out of date',
    resolved: { confirmed: 'The team checked and found the person needs help now.', disproved: 'The team checked and found no need for help now.' },
  });
  s.briefing.unknown = ['The person may not be there.', 'Someone being there does not mean they need help.', 'Talking, checking the timing, and visiting can each help you decide what to do.'];
  s.objectives = [{ id: 'o_verify', label: 'Find out what happened' }, { id: 'o_outcome', label: 'Agree on help or close the call after checking it was mistaken' }];
  s.pressure = { start: 12, perMinute: 0.45, threshold: 76, civilianPerMinute: 0.7 };
  s.pressureLabel = 'Time to investigate; repeated delays still matter';
  const contact = action(ctx, 'v3_welfare_contact', 'assess', 'Talk to the person', 'Try to reach the person and ask what happened.', 'radio', {
    favorable: 'Check whether the person is there and open a conversation about what to do next.',
    mixed: 'A brief exchange checks whether the person is there, but more questions remain.',
    adverse: 'No clear answer. Ask the caller for more detail or arrange a visit.',
  }, { check: { kind: 'contact', ratings: [{ key: 'communication', weight: 0.7 }, { key: 'composure', weight: 0.3 }], difficulty: ctx.difficulty }, capabilities: { rules: [], deescalation: true }, equipment: [{ tag: 'hailer', value: 4, group: 'contact_link', label: 'audible invitation to talk' }, { tag: 'throw_phone', value: 7, group: 'contact_link', range: 'opening', label: 'a two-way conversation' }], consequenceLevel: 'low' });
  contact.outcomes = {
    favorable: [{ stage: 'adapt', reveal: ['f_person'], pressure: -4 }, { truth: [{ factId: 'f_person', is: true }], setFlags: ['welfare_contact'], text: 'The person answered. The team knows they are there and can ask what help they will accept.' }, { truth: [{ factId: 'f_person', is: false }], text: 'A returned call confirmed the person was somewhere else. The caller’s report was wrong.' }],
    mixed: [{ stage: 'adapt', reveal: ['f_person'], setFlags: ['welfare_contact', 'welfare_contact_fragile'], text: 'A brief exchange checked the reported location, but the team still needs to check the conflicting reports.' }],
    adverse: [{ stage: 'adapt', setFlags: ['welfare_contact_problem'], pressure: 4, text: 'There was no clear answer. The team still needs another way to check the report.' }],
  };
  const observe = action(ctx, 'v3_welfare_observe', 'assess', 'Check the reported room', 'Look for the person in the room named by the caller.', 'intel', {
    favorable: 'Check whether the person is in the reported room. You still need to find out whether they need help.',
    mixed: 'Check whether the person is there after an extra look costs time.',
    adverse: 'The view is unclear. You still need to check whether the person is there.',
  }, { approach: 'path', check: { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.7 }, { key: 'coordination', weight: 0.3 }], difficulty: ctx.difficulty }, capabilities: { rules: ['visible_exterior', 'dark_visible_scene'] }, workload: { base: 3, perSqFt: 0.01 } });
  observe.outcomes = {
    favorable: [{ stage: 'adapt', reveal: ['f_person'], setFlags: ['welfare_scene_checked'], text: 'The team checked the reported room and recorded whether the person was present. Their circumstances still need explaining.' }],
    mixed: [{ stage: 'adapt', reveal: ['f_person'], extraMinutes: 2, setFlags: ['welfare_scene_checked'], text: 'An obstructed first view cost time. A second check settled presence without settling the reason for the call.' }],
    adverse: [{ stage: 'adapt', pressure: 3, setFlags: ['welfare_access_problem'], text: 'The room could not be checked reliably. The team recorded that limitation instead of treating it as proof.' }],
  };
  const timeline = action(ctx, 'v3_welfare_timeline', 'assess', 'Check when the concern began', 'Compare the caller’s timing with dispatch’s report to see whether help is still needed.', 'intel', {
    favorable: 'Find out whether help is still needed. The timing helps with a later check of conflicting reports.',
    mixed: 'Spot a difference in the reports. It helps with later checks, but the need for help is still unknown.',
    adverse: 'The timing still does not add up. Check with another source.',
  }, { consequenceLevel: 'low', workload: { base: 4, perSqFt: 0 } });
  timeline.outcomes = {
    favorable: [{ stage: 'adapt', reveal: ['f_context'], setFlags: ['welfare_timeline'], text: 'Dispatch and the caller compared the timing. The team now knows whether help is still needed.' }],
    mixed: [{ stage: 'adapt', setFlags: ['welfare_timeline'], text: 'The reports gave different times. That helps with the next check, but the need for help is still unclear.' }],
    adverse: [{ stage: 'adapt', setFlags: ['welfare_conflicting_reports'], pressure: 2, text: 'The reports still gave different times. Check with another source before closing the call.' }],
  };
  const intermediary = action(ctx, 'v3_welfare_intermediary', 'assess', 'Ask someone they trust to help', 'Try to bring a familiar person into the conversation.', 'radio', {
    favorable: 'Someone the person trusts is ready to help with the next conversation.',
    mixed: 'Someone the person trusts agrees to help, but arranging it takes longer.',
    adverse: 'No trusted contact is available. Try talking to the person or checking on them directly.',
  }, { consequenceLevel: 'low' });
  intermediary.outcomes = {
    favorable: [{ stage: 'adapt', setFlags: ['welfare_contact'], pressure: -2, text: 'Someone the person trusts is ready to help with the next conversation.' }],
    mixed: [{ stage: 'adapt', setFlags: ['welfare_contact'], extraMinutes: 3, text: 'After a delay, someone the person trusts agreed to join the conversation about what to do next.' }],
    adverse: [{ stage: 'adapt', text: 'The trusted contact could not attend. No plan was agreed.' }],
  };

  const reconcile = action(ctx, 'v3_welfare_reconcile', 'adapt', 'Check the conflicting reports', 'Compare independent reports to find out whether the person is there and needs help.', 'intel', {
    favorable: 'Find out whether the person is there and needs help. If both reports are wrong, you can close the call.',
    mixed: 'Check both reports, but take extra time.',
    adverse: 'The reports still disagree. Visit the person or pass the unanswered questions to specialists.',
  }, { consequenceLevel: 'low', modifiers: [{ label: 'Checked timeline', when: { flags: ['welfare_timeline'] }, source: 'preparation', value: 7 }] });
  reconcile.outcomes = {
    favorable: [{ reveal: ['f_person', 'f_context'], clearFlags: ['welfare_conflicting_reports'], setFlags: ['welfare_accounts_checked'], text: 'The team checked separate reports and found out whether the person was there and needed help.' }],
    mixed: [{ reveal: ['f_person', 'f_context'], extraMinutes: 3, setFlags: ['welfare_accounts_checked'], text: 'A second round of checks settled both claims. The correction is reliable, but the delay used up time.' }],
    adverse: [{ setFlags: ['welfare_conflicting_reports'], pressure: 4, text: 'The reports still disagree. Visit the person or pass the unanswered questions to specialists.' }],
  };
  const verify = action(ctx, 'v3_welfare_verify', 'adapt', 'Knock and check on them', 'Visit the doorway and try to speak to the person.', 'search', {
    favorable: 'Find out whether the person is there and needs help. You can speak to them about the next step.',
    mixed: 'Check whether the person is there, but leave their need for help unanswered.',
    adverse: 'The doorway check stalls. Arrange a way in before the next visit.',
  }, { approach: 'path', check: { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.6 }, { key: 'communication', weight: 0.4 }], difficulty: ctx.difficulty - 3 }, workload: { base: 3, perSqFt: 0.01 } });
  verify.outcomes = {
    favorable: [{ reveal: ['f_person', 'f_context'], setFlags: ['welfare_contact'], text: 'The doorstep check settled who was present and what help, if any, was needed. A direct conversation is available.' }],
    mixed: [{ reveal: ['f_person'], extraMinutes: 2, text: 'The team verified presence but could not finish the conversation about the original concern.' }],
    adverse: [{ setFlags: ['welfare_access_problem'], pressure: 5, text: 'The check stalled at access. A planned accompanied visit can address the problem.' }],
  };
  const agreement = action(ctx, 'v3_welfare_agreement', 'adapt', 'Agree on the next step', 'Ask the person what help they will accept and who should provide it.', 'radio', {
    favorable: 'Agree on the next step and who will help. You still need to carry out or confirm the plan.',
    mixed: 'Agree on the next step after a longer conversation. The plan still needs to be carried out.',
    adverse: 'The person does not agree to the plan. Try planned help or ask specialists to take over.',
  }, { visibleWhen: { facts: [{ factId: 'f_person', in: ['confirmed'] }] }, requires: { facts: [{ factId: 'f_person', in: ['confirmed'], reason: 'Check that the person is there before agreeing on the next step' }], flags: [{ flag: 'welfare_contact', reason: 'Talk to the person or arrange someone they trust first' }] }, check: { kind: 'contact', ratings: [{ key: 'communication', weight: 0.7 }, { key: 'composure', weight: 0.3 }], difficulty: ctx.difficulty }, capabilities: { rules: [], deescalation: true }, modifiers: [{ label: 'The first exchange needs careful clarification', when: { flags: ['welfare_contact_fragile'] }, source: 'difficulty', value: 3 }] });
  agreement.outcomes = {
    favorable: [{ reveal: ['f_context'], setFlags: ['welfare_agreement'], pressure: -6, text: 'The person agreed on the next step and who would help. The team still needs to carry out or confirm the plan.' }],
    mixed: [{ reveal: ['f_context'], setFlags: ['welfare_agreement'], extraMinutes: 2, text: 'A longer conversation led to an agreement. The team still needs to carry out the plan.' }],
    adverse: [{ setFlags: ['welfare_agreement_failed'], pressure: 5, text: 'The person did not agree to the plan. The team must try another option.' }],
  };
  const prepare = action(ctx, 'v3_welfare_prepare', 'adapt', 'Arrange a visit with support', 'Arrange a way in and someone to accompany the visit.', 'door', {
    favorable: 'Arrange a way in and someone to come along. The visit avoids the extra time and safety cost of going unprepared.',
    mixed: 'Get the visit ready after a delay. You can now give the planned help.',
    adverse: 'The visit is not ready. Going without preparation adds 4 minutes and costs 3 safety points.',
  }, { requires: { openings: openingId ? [{ openingId, blockedReason: 'The way in is blocked; check another source or ask specialists to take over', lockedNote: 'Arranging a way in takes extra time' }] : [] } });
  const opening: Pick<OutcomeEffect, 'openings'> = openingId ? { openings: [{ openingId, state: 'open' }] } : {};
  prepare.outcomes = {
    favorable: [{ setFlags: ['welfare_visit_ready'], clearFlags: ['welfare_access_problem'], ...opening, text: 'A way in and someone to accompany the team are ready. The visit avoids the extra 4 minutes and 3 safety points for going unprepared.' }],
    mixed: [{ setFlags: ['welfare_visit_ready'], ...opening, extraMinutes: 3, text: 'Arranging access took longer, but the accompanied route is now ready.' }],
    adverse: [{ setFlags: ['welfare_access_problem'], pressure: 3, text: 'Access could not be arranged. The visit will take extra time and carry a smaller safety margin.' }],
  };
  const proceed = action(ctx, 'v3_welfare_proceed', 'adapt', 'Choose how to finish the call', 'Review what you know and move to the final choices.', 'handover', {
    favorable: 'Review the facts and move to the final choices.',
    mixed: 'Review the facts and move to the final choices.',
    adverse: 'Review the facts and move to the final choices.',
  }, { workload: { base: 1, perSqFt: 0 }, stressBase: 0, consequenceLevel: 'low' });
  for (const band of ['favorable', 'mixed', 'adverse'] as const) proceed.outcomes[band] = [{ stage: 'resolve', text: 'The team reviewed what it knew and what still needed checking before the final choice.' }];

  const visit = action(ctx, 'v3_welfare_visit', 'resolve', 'Visit and check on the person', 'Go to the reported room to check whether anyone is there and needs help. Without a visit arranged, this adds 4 minutes and costs 3 safety points.', 'search', {
    favorable: 'Find out whether the person is there and needs help. Give any needed help, agree a next step, or close a mistaken report.',
    mixed: 'Check whether the person is there and needs help, but leave the help unfinished. Try again or ask specialists to take over.',
    adverse: 'The visit stalls before the checks are finished. Safety falls; try again or ask specialists to take over.',
  }, { approach: 'path', workload: { base: 4, perSqFt: 0.01 }, consequenceLevel: 'moderate', modifiers: [{ label: 'Visit with support arranged', when: { flags: ['welfare_visit_ready'] }, source: 'preparation', value: 8 }] });
  const unprepared: OutcomeEffect = { when: { notFlags: ['welfare_visit_ready'] }, extraMinutes: 4, civilian: -3, text: 'No visit with support was arranged. Finding a way in cost 4 extra minutes and 3 safety points.' };
  visit.outcomes = {
    favorable: [{ stage: 'resolve', reveal: ['f_person', 'f_context'] }, unprepared, { truth: [{ factId: 'f_person', is: false }], ending: 'report_disproved', objective: 100, text: 'The visit confirmed the person was not there. The caller received an explanation of the mistake.' }, { truth: [{ factId: 'f_person', is: true }, { factId: 'f_context', is: false }], ending: 'voluntary_resolution', objective: 100, text: 'The person was safe. A direct conversation settled the misunderstanding and confirmed their chosen next step.' }, { truth: [{ factId: 'f_context', is: true }], ending: 'aid_completed', objective: 100, text: 'The person received the agreed help. The team passed the checked details to their support contact.' }],
    mixed: [{ stage: 'resolve', reveal: ['f_person', 'f_context'], setFlags: ['welfare_followthrough'], civilian: -2, text: 'The team checked the facts, but the help is unfinished. Try to finish it or ask specialists to take over.' }, unprepared],
    adverse: [{ stage: 'resolve', setFlags: ['welfare_followthrough'], civilian: -6, pressure: 7, text: 'The visit stalled. The call stays open; try again or pass the unanswered questions to specialists.' }, unprepared],
  };
  const close = action(ctx, 'v3_welfare_close', 'resolve', 'Close the mistaken report', 'Tell the caller what you checked and explain why the report was wrong.', 'intel', {
    favorable: 'Explain the correction to the caller and close the mistaken report.',
    mixed: 'Close the mistaken report after taking extra time to explain it to the caller.',
    adverse: 'Explaining the mistake takes longer, but the report is still closed.',
  }, { visibleWhen: { facts: [{ factId: 'f_person', in: ['disproved'] }, { factId: 'f_context', in: ['disproved'] }] }, requires: { facts: [{ factId: 'f_person', in: ['disproved'], reason: 'Check that the person is not there first' }, { factId: 'f_context', in: ['disproved'], reason: 'Check that no help is needed' }] }, consequenceLevel: 'low', stressBase: 1 });
  close.outcomes = { favorable: [{ ending: 'report_disproved', objective: 100, text: 'The caller received an explanation of the mistake. The report is closed.' }], mixed: [{ ending: 'report_disproved', objective: 90, extraMinutes: 2, text: 'The caller needed clarification, but the correction and closure were recorded.' }], adverse: [{ ending: 'report_disproved', objective: 84, extraMinutes: 4, text: 'Explaining the mistake took longer. The report was wrong and is now closed.' }] };
  const voluntary = action(ctx, 'v3_welfare_voluntary', 'resolve', 'Confirm the agreed plan', 'Check that the person’s chosen next step and support contact are in place.', 'radio', {
    favorable: 'Confirm the agreed plan and support contact, then close the call.',
    mixed: 'Confirm the plan after a longer conversation.',
    adverse: 'The plan falls through. Try to finish the remaining help or ask specialists to take over.',
  }, { visibleWhen: { facts: [{ factId: 'f_person', in: ['confirmed'] }, { factId: 'f_context', in: ['disproved'] }] }, requires: { flags: [{ flag: 'welfare_agreement', reason: 'Agree on the next step with the person first' }] }, consequenceLevel: 'low', capabilities: { rules: [], deescalation: true } });
  voluntary.outcomes = { favorable: [{ ending: 'voluntary_resolution', objective: 100, pressure: -8, text: 'The team confirmed the person’s agreed plan and support contact. The call is resolved.' }], mixed: [{ ending: 'voluntary_resolution', objective: 86, extraMinutes: 3, text: 'Extra clarification confirmed the arrangement and who would follow through.' }], adverse: [{ stage: 'resolve', setFlags: ['welfare_followthrough'], pressure: 6, text: 'The plan could not be confirmed. The call stays open; try to finish the remaining help or ask specialists to take over.' }] };
  const assist = action(ctx, 'v3_welfare_assist', 'resolve', 'Give the planned help', 'Use the access you prepared to give the person the help they need.', 'medic', {
    favorable: 'Give the planned help using the way in you prepared.',
    mixed: 'Give immediate help, then pass the unfinished arrangements to a support contact.',
    adverse: 'The help cannot be completed. Safety falls; try again or ask specialists to take over.',
  }, { visibleWhen: { facts: [{ factId: 'f_person', in: ['confirmed'] }, { factId: 'f_context', in: ['confirmed'] }] }, requires: { flags: [{ flag: 'welfare_visit_ready', reason: 'Arrange a visit with support first' }] }, approach: 'path' });
  assist.outcomes = { favorable: [{ ending: 'aid_completed', objective: 100, text: 'The prepared route let the team complete the specific assistance need and confirm the support contact.' }], mixed: [{ ending: 'partial_followthrough', objective: 70, text: 'The immediate help was completed. The support contact agreed to finish the remaining arrangements.' }], adverse: [{ stage: 'resolve', setFlags: ['welfare_followthrough'], civilian: -5, text: 'The planned help could not be completed. The next team has notes on the person’s needs and the way in.' }] };
  const recover = action(ctx, 'v3_welfare_recover', 'resolve', 'Try to finish the remaining help', 'Check what is still unresolved and try to complete the help.', 'search', {
    favorable: 'Finish the remaining help, confirm the person’s plan, or close the report if it was wrong.',
    mixed: 'Check the facts, then pass the unfinished help to a support contact.',
    adverse: 'The team cannot finish the help. Leave and pass on the unanswered questions.',
  }, { visibleWhen: { flags: ['welfare_followthrough'] }, approach: 'path', workload: { base: 5, perSqFt: 0 }, check: { kind: 'coordination', ratings: [{ key: 'coordination', weight: 0.6 }, { key: 'communication', weight: 0.4 }], difficulty: ctx.difficulty - 8 } });
  recover.outcomes = { favorable: [{ stage: 'resolve', reveal: ['f_person', 'f_context'] }, { truth: [{ factId: 'f_person', is: false }], ending: 'report_disproved', objective: 88, text: 'The later check found the report was wrong. The correction was recorded.' }, { truth: [{ factId: 'f_person', is: true }, { factId: 'f_context', is: false }], ending: 'voluntary_resolution', objective: 88, text: 'The slower check established that the person was safe and confirmed their voluntary next step.' }, { truth: [{ factId: 'f_person', is: true }, { factId: 'f_context', is: true }], ending: 'aid_completed', objective: 88, text: 'The team took longer but finished giving the person the remaining help.' }], mixed: [{ ending: 'partial_followthrough', reveal: ['f_person', 'f_context'], objective: 62, text: 'The remaining facts were checked, but a support contact must complete the practical arrangement.' }], adverse: [{ ending: 'withdrawal_with_info', objective: 32, text: 'The help could not be completed. The team passed on what it knew and what remained unclear.' }] };
  const handover = welfareHandover(ctx);
  const withdraw = action(ctx, 'v3_welfare_withdraw', 'resolve', 'Leave and pass on your notes', 'Leave the scene with the call unresolved. Pass on what you know.', 'handover', {
    favorable: 'Leave and pass on what you know. The call stays unresolved.',
    mixed: 'Leave and pass on what you know. The call stays unresolved.',
    adverse: 'Leave and pass on what you know. The call stays unresolved.',
  }, { consequenceLevel: 'low', stressBase: 0 });
  for (const band of ['favorable', 'mixed', 'adverse'] as const) withdraw.outcomes[band] = [{ ending: 'withdrawal_with_info', objective: 25, text: 'The team left and passed on its notes, including what it could not check. The call is still unresolved.' }];
  s.stages = {
    assess: { id: 'assess', label: 'Check the report', prompt: 'You do not yet know whether the person is there or needs help. Choose what to check first.', actions: [contact, observe, timeline, intermediary] },
    adapt: { id: 'adapt', label: 'Plan your response', prompt: 'Check the reports, agree on help, or arrange a visit. Each step takes time.', actions: [reconcile, verify, agreement, prepare, proceed] },
    resolve: { id: 'resolve', label: 'Finish the call', prompt: 'Help the person, confirm their plan, ask specialists to take over, or leave the call unresolved.', actions: [close, voluntary, assist, visit, recover, handover, withdraw] },
  };
}

function welfareHandover(ctx: V3Context): ActionDefinition {
  const a = action(ctx, 'v3_welfare_handover', 'resolve', 'Ask specialists to take over', 'Pass on what you checked and what still needs checking.', 'handover', {
    favorable: 'If you checked whether the person is there and needs help, specialists take over with the full details. Otherwise, they still have checks to finish.',
    mixed: 'Pass on what you checked. Specialists still have help or checks to finish.',
    adverse: 'Pass on the unanswered questions and leave the call unresolved.',
  }, { consequenceLevel: 'low', modifiers: [{ label: 'Conflicting reports checked', when: { flags: ['welfare_accounts_checked'] }, source: 'preparation', value: 6 }] });
  a.outcomes = {
    favorable: [
      { stage: 'resolve' },
      { when: { facts: [{ factId: 'f_person', in: ['confirmed', 'disproved'] }, { factId: 'f_context', in: ['confirmed', 'disproved'] }] }, ending: 'informed_handover', objective: 100, text: 'The team checked whether the person was there and needed help. Specialists received the details and agreed to take over.' },
      { when: { facts: [{ factId: 'f_person', in: ['unknown', 'reported'] }] }, ending: 'partial_followthrough', objective: 52, text: 'The reported location still needs checking. The receiving team accepted that outstanding task with the available account.' },
      { when: { facts: [{ factId: 'f_person', in: ['confirmed', 'disproved'] }, { factId: 'f_context', in: ['unknown', 'reported'] }] }, ending: 'partial_followthrough', objective: 62, text: 'The team checked whether the person was there, but not whether they needed help. The receiving team agreed to finish that check.' },
    ],
    mixed: [{ ending: 'partial_followthrough', objective: 48, text: 'The team passed on what it had checked and the help still needed.' }],
    adverse: [{ ending: 'withdrawal_with_info', objective: 28, text: 'The receiving team was told which questions remain unanswered. The call is still unresolved.' }],
  };
  return a;
}
