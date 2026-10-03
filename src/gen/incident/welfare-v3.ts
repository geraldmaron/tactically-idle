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
  s.facts[0].resolved = { confirmed: `The reported person has been located in the ${targetName}.`, disproved: 'The reported presence was checked and ruled out; the original account was mistaken.' };
  s.facts.push({
    id: 'f_context', label: 'The reported person needs on-scene assistance', spaceId: targetId,
    truth: needsHelp, initial: 'reported', showWhenUnknown: true,
    markers: { reported: 'CONCERN?', confirmed: 'HELP NEEDED', disproved: 'NO IMMEDIATE NEED' },
    claim: 'The call suggests a person may need help; neither identity nor circumstances have been checked.',
    source: 'Dispatch summary (unverified)', note: 'Check the timeline and hear the person’s account before choosing assistance or closure.',
    uncertainty: 'Whether the concern reflects a present need, a harmless misunderstanding, or an outdated report',
    resolved: { confirmed: 'The verified account identifies a present assistance need.', disproved: 'The checked account does not establish an immediate assistance need.' },
  });
  s.briefing.unknown = ['The reported presence may be mistaken.', 'A person being present does not establish that assistance is needed.', 'Contact, a checked timeline, and a visit can lead to different resolutions.'];
  s.objectives = [{ id: 'o_verify', label: 'Establish what actually happened' }, { id: 'o_outcome', label: 'Agree help or close a disproved report with evidence' }];
  s.pressure = { start: 12, perMinute: 0.45, threshold: 76, civilianPerMinute: 0.7 };
  s.pressureLabel = 'Time to investigate; repeated delays still matter';
  const contact = action(ctx, 'v3_welfare_contact', 'assess', 'Ask for the person’s account', 'radio', {
    favorable: 'Establish contact and check the reported presence; an agreed next step becomes easier.',
    mixed: 'A short exchange checks presence and leaves a fragile line for clarifying circumstances.',
    adverse: 'No usable exchange; keep the report open and try a caller check or accompanied visit.',
  }, { check: { kind: 'contact', ratings: [{ key: 'communication', weight: 0.7 }, { key: 'composure', weight: 0.3 }], difficulty: ctx.difficulty }, capabilities: { rules: [], deescalation: true }, equipment: [{ tag: 'hailer', value: 4, group: 'contact_link', label: 'audible invitation to talk' }, { tag: 'throw_phone', value: 7, group: 'contact_link', range: 'opening', label: 'a two-way conversation' }], consequenceLevel: 'low' });
  contact.outcomes = {
    favorable: [{ stage: 'adapt', reveal: ['f_person'], pressure: -4 }, { truth: [{ factId: 'f_person', is: true }], setFlags: ['welfare_contact'], text: 'The person answered. Their presence is verified, and there is now a direct line for agreeing help.' }, { truth: [{ factId: 'f_person', is: false }], text: 'A returned call established that the reported person is elsewhere. The original room report was ruled out.' }],
    mixed: [{ stage: 'adapt', reveal: ['f_person'], setFlags: ['welfare_contact', 'welfare_contact_fragile'], text: 'A brief exchange settled the reported location, but conflicting accounts still need checking.' }],
    adverse: [{ stage: 'adapt', setFlags: ['welfare_contact_problem'], pressure: 4, text: 'No clear exchange was possible. Lack of an answer does not confirm the report; a different source is needed.' }],
  };
  const observe = action(ctx, 'v3_welfare_observe', 'assess', 'Check the reported room', 'intel', {
    favorable: 'Verify presence through a careful scene check without assuming why the person is there.',
    mixed: 'Check presence, but spend extra time resolving an obstructed view.',
    adverse: 'An incomplete view leaves the report uncertain; a supported visit remains available.',
  }, { approach: 'path', check: { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.7 }, { key: 'coordination', weight: 0.3 }], difficulty: ctx.difficulty }, capabilities: { rules: ['visible_exterior', 'dark_visible_scene'] }, workload: { base: 3, perSqFt: 0.01 } });
  observe.outcomes = {
    favorable: [{ stage: 'adapt', reveal: ['f_person'], setFlags: ['welfare_scene_checked'], text: 'The team checked the reported room and recorded whether the person was present. Their circumstances still need explaining.' }],
    mixed: [{ stage: 'adapt', reveal: ['f_person'], extraMinutes: 2, setFlags: ['welfare_scene_checked'], text: 'An obstructed first view cost time. A second check settled presence without settling the reason for the call.' }],
    adverse: [{ stage: 'adapt', pressure: 3, setFlags: ['welfare_access_problem'], text: 'The room could not be checked reliably. The team recorded that limitation instead of treating it as proof.' }],
  };
  const timeline = action(ctx, 'v3_welfare_timeline', 'assess', 'Reconcile the caller’s timeline', 'intel', {
    favorable: 'Check whether the concern is current; a corroborated account improves a later agreement.',
    mixed: 'Find a useful discrepancy, but leave the actual need unresolved.',
    adverse: 'The caller’s account conflicts with dispatch; use an independent source next.',
  }, { consequenceLevel: 'low', workload: { base: 4, perSqFt: 0 } });
  timeline.outcomes = {
    favorable: [{ stage: 'adapt', reveal: ['f_context'], setFlags: ['welfare_timeline'], text: 'Dispatch and the caller reconciled the timing. The team now knows whether the reported assistance need is current.' }],
    mixed: [{ stage: 'adapt', setFlags: ['welfare_timeline'], text: 'The timeline exposed a discrepancy. It gives the next conversation a useful question, but does not yet settle the concern.' }],
    adverse: [{ stage: 'adapt', setFlags: ['welfare_conflicting_reports'], pressure: 2, text: 'The accounts disagreed on timing. An independent check is needed before closure.' }],
  };
  const intermediary = action(ctx, 'v3_welfare_intermediary', 'assess', 'Arrange a trusted contact', 'radio', {
    favorable: 'Prepare a familiar person to join the conversation; this unlocks a supported agreement attempt.',
    mixed: 'Arrange a delayed introduction; it still supports an agreement, at a time cost.',
    adverse: 'No trusted contact is available; ordinary contact and direct checking remain possible.',
  }, { consequenceLevel: 'low' });
  intermediary.outcomes = {
    favorable: [{ stage: 'adapt', setFlags: ['welfare_contact'], pressure: -2, text: 'A trusted contact is ready to join the next conversation, making a voluntary arrangement possible.' }],
    mixed: [{ stage: 'adapt', setFlags: ['welfare_contact'], extraMinutes: 3, text: 'The introduction is arranged after a delay. The team can now work toward a voluntary next step.' }],
    adverse: [{ stage: 'adapt', text: 'The requested contact could not attend. No agreement has been implied or recorded.' }],
  };

  const reconcile = action(ctx, 'v3_welfare_reconcile', 'adapt', 'Check the conflicting accounts', 'intel', {
    favorable: 'Settle both the presence report and the assistance need; an incorrect report can then be closed.',
    mixed: 'Settle both claims after extra checking, leaving less time for follow-through.',
    adverse: 'Preserve the discrepancy; an accompanied visit or explicitly incomplete handover is still possible.',
  }, { consequenceLevel: 'low', modifiers: [{ label: 'Checked timeline', when: { flags: ['welfare_timeline'] }, source: 'preparation', value: 7 }] });
  reconcile.outcomes = {
    favorable: [{ reveal: ['f_person', 'f_context'], clearFlags: ['welfare_conflicting_reports'], setFlags: ['welfare_accounts_checked'], text: 'Independent accounts were reconciled. Both presence and the need for assistance now have a checked answer.' }],
    mixed: [{ reveal: ['f_person', 'f_context'], extraMinutes: 3, setFlags: ['welfare_accounts_checked'], text: 'A second round of checks settled both claims. The correction is reliable, but the delay used up time.' }],
    adverse: [{ setFlags: ['welfare_conflicting_reports'], pressure: 4, text: 'The accounts still conflict. Closure is not justified; a direct visit or an incomplete handover remains.' }],
  };
  const verify = action(ctx, 'v3_welfare_verify', 'adapt', 'Make a quiet doorstep check', 'search', {
    favorable: 'Check presence and circumstances directly, and open a line for a voluntary arrangement.',
    mixed: 'Verify who is there; the reason for the call still needs a conversation.',
    adverse: 'The check stalls. Prepare access before making another visit.',
  }, { approach: 'path', check: { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.6 }, { key: 'communication', weight: 0.4 }], difficulty: ctx.difficulty - 3 }, workload: { base: 3, perSqFt: 0.01 } });
  verify.outcomes = {
    favorable: [{ reveal: ['f_person', 'f_context'], setFlags: ['welfare_contact'], text: 'The doorstep check settled who was present and what help, if any, was needed. A direct conversation is available.' }],
    mixed: [{ reveal: ['f_person'], extraMinutes: 2, text: 'The team verified presence but could not finish the conversation about the original concern.' }],
    adverse: [{ setFlags: ['welfare_access_problem'], pressure: 5, text: 'The check stalled at access. A planned accompanied visit can address the problem.' }],
  };
  const agreement = action(ctx, 'v3_welfare_agreement', 'adapt', 'Agree a voluntary next step', 'radio', {
    favorable: 'Agree who will help and when; this enables a voluntary close or supported assistance.',
    mixed: 'An agreement is reached after clarification; record the remaining practical arrangements.',
    adverse: 'The proposal is not accepted. Direct assistance or specialist follow-through stays available.',
  }, { visibleWhen: { facts: [{ factId: 'f_person', in: ['confirmed'] }] }, requires: { facts: [{ factId: 'f_person', in: ['confirmed'], reason: 'Verify that the person is present before agreeing their next step' }], flags: [{ flag: 'welfare_contact', reason: 'Establish a usable conversation or trusted contact first' }] }, check: { kind: 'contact', ratings: [{ key: 'communication', weight: 0.7 }, { key: 'composure', weight: 0.3 }], difficulty: ctx.difficulty }, capabilities: { rules: [], deescalation: true }, modifiers: [{ label: 'The first exchange needs careful clarification', when: { flags: ['welfare_contact_fragile'] }, source: 'difficulty', value: 3 }] });
  agreement.outcomes = {
    favorable: [{ reveal: ['f_context'], setFlags: ['welfare_agreement'], pressure: -6, text: 'An explicit next step and a responsible contact were agreed. This can support voluntary closure or assistance.' }],
    mixed: [{ reveal: ['f_context'], setFlags: ['welfare_agreement'], extraMinutes: 2, text: 'Clarification produced an agreement. Practical follow-through still needs to be completed.' }],
    adverse: [{ setFlags: ['welfare_agreement_failed'], pressure: 5, text: 'No agreement was reached. The team recorded the refusal without representing it as consent.' }],
  };
  const prepare = action(ctx, 'v3_welfare_prepare', 'adapt', 'Prepare an accompanied visit', 'door', {
    favorable: 'Arrange access and a support contact; avoid an unprepared visit’s delay and safety cost.',
    mixed: 'Prepare the same route after a delay; a supported assistance option becomes available.',
    adverse: 'Access remains uncertain. An unprepared visit has an explicit extra cost, or the team can hand over.',
  }, { requires: { openings: openingId ? [{ openingId, blockedReason: 'The declared access is physically blocked; check another source or hand over', lockedNote: 'Arranging the declared access takes additional time' }] : [] } });
  const opening: Pick<OutcomeEffect, 'openings'> = openingId ? { openings: [{ openingId, state: 'open' }] } : {};
  prepare.outcomes = {
    favorable: [{ setFlags: ['welfare_visit_ready'], clearFlags: ['welfare_access_problem'], ...opening, text: 'An access arrangement and accompanying contact are ready. A visit can proceed without the unprepared-route penalty.' }],
    mixed: [{ setFlags: ['welfare_visit_ready'], ...opening, extraMinutes: 3, text: 'Arranging access took longer, but the accompanied route is now ready.' }],
    adverse: [{ setFlags: ['welfare_access_problem'], pressure: 3, text: 'Access could not be arranged. The visit will take extra time and carry a smaller safety margin.' }],
  };
  const proceed = action(ctx, 'v3_welfare_proceed', 'adapt', 'Choose how to finish the call', 'handover', {
    favorable: 'Move to closure, assistance, or a handover with the information already checked.',
    mixed: 'Move to a final decision while keeping any unresolved claims visible.',
    adverse: 'Move to a final decision; no unverified claim becomes fact.',
  }, { workload: { base: 1, perSqFt: 0 }, stressBase: 0, consequenceLevel: 'low' });
  for (const band of ['favorable', 'mixed', 'adverse'] as const) proceed.outcomes[band] = [{ stage: 'resolve', text: 'The team reviewed the checked facts and remaining gaps before choosing how to finish.' }];

  const visit = action(ctx, 'v3_welfare_visit', 'resolve', 'Complete the accompanied check', 'search', {
    favorable: 'Check the facts on scene and either complete assistance, agree a resolution, or disprove the report.',
    mixed: 'Locate the person or rule out the report, but leave practical follow-through unfinished; recover or hand over next.',
    adverse: 'The visit stalls and costs safety. Regroup for a checked handover or withdraw with the facts preserved.',
  }, { approach: 'path', workload: { base: 4, perSqFt: 0.01 }, consequenceLevel: 'moderate', modifiers: [{ label: 'Accompanied access prepared', when: { flags: ['welfare_visit_ready'] }, source: 'preparation', value: 8 }] });
  const unprepared: OutcomeEffect = { when: { notFlags: ['welfare_visit_ready'] }, extraMinutes: 4, civilian: -3, text: 'No accompanied access had been prepared: finding a route cost four additional minutes and three safety points.' };
  visit.outcomes = {
    favorable: [{ stage: 'resolve', reveal: ['f_person', 'f_context'] }, unprepared, { truth: [{ factId: 'f_person', is: false }], ending: 'report_disproved', objective: 100, text: 'The complete check disproved the presence report. The caller received a documented correction.' }, { truth: [{ factId: 'f_person', is: true }, { factId: 'f_context', is: false }], ending: 'voluntary_resolution', objective: 100, text: 'The person was safe. A direct conversation settled the misunderstanding and confirmed their chosen next step.' }, { truth: [{ factId: 'f_context', is: true }], ending: 'aid_completed', objective: 100, text: 'The located person received the agreed practical assistance, and continuing support received the checked account.' }],
    mixed: [{ stage: 'resolve', reveal: ['f_person', 'f_context'], setFlags: ['welfare_followthrough'], civilian: -2, text: 'The facts are checked, but practical arrangements are unfinished. The team can now finish follow-through or give an informed handover.' }, unprepared],
    adverse: [{ stage: 'resolve', setFlags: ['welfare_followthrough'], civilian: -6, pressure: 7, text: 'The visit stalled before completion. The concern remains open; the team must regroup or preserve the gaps in its handover.' }, unprepared],
  };
  const close = action(ctx, 'v3_welfare_close', 'resolve', 'Close the disproved report', 'intel', {
    favorable: 'Record the checked correction and close the call without unnecessary intervention.',
    mixed: 'Clarify the correction with the caller, then close the disproved report.',
    adverse: 'The report remains disproved, but briefing the caller takes longer; closure is still evidence-based.',
  }, { visibleWhen: { facts: [{ factId: 'f_person', in: ['disproved'] }, { factId: 'f_context', in: ['disproved'] }] }, requires: { facts: [{ factId: 'f_person', in: ['disproved'], reason: 'Rule out the reported presence first' }, { factId: 'f_context', in: ['disproved'], reason: 'Check that no assistance need remains' }] }, consequenceLevel: 'low', stressBase: 1 });
  close.outcomes = { favorable: [{ ending: 'report_disproved', objective: 100, text: 'The caller received the checked correction. The disproved report is closed.' }], mixed: [{ ending: 'report_disproved', objective: 90, extraMinutes: 2, text: 'The caller needed clarification, but the correction and closure were recorded.' }], adverse: [{ ending: 'report_disproved', objective: 84, extraMinutes: 4, text: 'Explaining the correction took longer. The evidence still disproves the report, so closure did not become an intervention.' }] };
  const voluntary = action(ctx, 'v3_welfare_voluntary', 'resolve', 'Confirm the voluntary arrangement', 'radio', {
    favorable: 'Confirm the agreed contact and next step, then close the immediate concern.',
    mixed: 'Complete the agreement after extra clarification.',
    adverse: 'The arrangement falls through; a follow-through check or handover remains available.',
  }, { visibleWhen: { facts: [{ factId: 'f_person', in: ['confirmed'] }, { factId: 'f_context', in: ['disproved'] }] }, requires: { flags: [{ flag: 'welfare_agreement', reason: 'Agree a voluntary next step first' }] }, consequenceLevel: 'low', capabilities: { rules: [], deescalation: true } });
  voluntary.outcomes = { favorable: [{ ending: 'voluntary_resolution', objective: 100, pressure: -8, text: 'The named contact and voluntary arrangement were confirmed. The immediate concern is resolved.' }], mixed: [{ ending: 'voluntary_resolution', objective: 86, extraMinutes: 3, text: 'Extra clarification confirmed the arrangement and who would follow through.' }], adverse: [{ stage: 'resolve', setFlags: ['welfare_followthrough'], pressure: 6, text: 'The arrangement could not be confirmed. The call stays open for a practical check or informed handover.' }] };
  const assist = action(ctx, 'v3_welfare_assist', 'resolve', 'Complete the planned assistance', 'medic', {
    favorable: 'Use the prepared visit to complete the verified practical assistance need.',
    mixed: 'Complete immediate help but hand remaining follow-through onward.',
    adverse: 'The assistance plan stalls; checked information is retained for recovery or handover.',
  }, { visibleWhen: { facts: [{ factId: 'f_person', in: ['confirmed'] }, { factId: 'f_context', in: ['confirmed'] }] }, requires: { flags: [{ flag: 'welfare_visit_ready', reason: 'Prepare an accompanied visit first' }] }, approach: 'path' });
  assist.outcomes = { favorable: [{ ending: 'aid_completed', objective: 100, text: 'The prepared route let the team complete the specific assistance need and confirm the support contact.' }], mixed: [{ ending: 'partial_followthrough', objective: 70, text: 'Immediate practical help was completed. The remaining arrangement was explicitly passed to the support contact.' }], adverse: [{ stage: 'resolve', setFlags: ['welfare_followthrough'], civilian: -5, text: 'The assistance plan could not be completed. The verified need and available access are retained for a receiving team.' }] };
  const recover = action(ctx, 'v3_welfare_recover', 'resolve', 'Check the unfinished follow-through', 'search', {
    favorable: 'Recheck the gaps and complete practical follow-through, or confirm that the report was wrong.',
    mixed: 'Settle the facts and pass the unfinished arrangement on explicitly.',
    adverse: 'Keep the concern open and transfer the checked information; do not claim completion.',
  }, { visibleWhen: { flags: ['welfare_followthrough'] }, approach: 'path', workload: { base: 5, perSqFt: 0 }, check: { kind: 'coordination', ratings: [{ key: 'coordination', weight: 0.6 }, { key: 'communication', weight: 0.4 }], difficulty: ctx.difficulty - 8 } });
  recover.outcomes = { favorable: [{ stage: 'resolve', reveal: ['f_person', 'f_context'] }, { truth: [{ factId: 'f_person', is: false }], ending: 'report_disproved', objective: 88, text: 'The follow-through check ruled out the report and completed the documented correction.' }, { truth: [{ factId: 'f_person', is: true }, { factId: 'f_context', is: false }], ending: 'voluntary_resolution', objective: 88, text: 'The slower check established that the person was safe and confirmed their voluntary next step.' }, { truth: [{ factId: 'f_person', is: true }, { factId: 'f_context', is: true }], ending: 'aid_completed', objective: 88, text: 'A slower follow-through check completed the outstanding practical assistance with the person.' }], mixed: [{ ending: 'partial_followthrough', reveal: ['f_person', 'f_context'], objective: 62, text: 'The remaining facts were checked, but a support contact must complete the practical arrangement.' }], adverse: [{ ending: 'withdrawal_with_info', objective: 32, text: 'Follow-through could not be secured. The concern and the limits of the team’s information were passed on.' }] };
  const handover = welfareHandover(ctx);
  const withdraw = action(ctx, 'v3_welfare_withdraw', 'resolve', 'Withdraw with the record', 'handover', { favorable: 'Preserve checked facts and unresolved claims; the original concern remains open.', mixed: 'Preserve the record with a slower transfer of responsibility.', adverse: 'Record the remaining gaps and leave them explicitly unresolved.' }, { consequenceLevel: 'low', stressBase: 0 });
  for (const band of ['favorable', 'mixed', 'adverse'] as const) withdraw.outcomes[band] = [{ ending: 'withdrawal_with_info', objective: 25, text: 'The team withdrew and passed on the record. Unverified claims remain unverified; the original concern has not been declared resolved.' }];
  s.stages = {
    assess: { id: 'assess', label: 'Check the account', prompt: 'The report is a claim. Choose which source to check first; presence and need are separate questions.', actions: [contact, observe, timeline, intermediary] },
    adapt: { id: 'adapt', label: 'Build a workable plan', prompt: 'Reconcile the account, agree a next step, or prepare access. Preparation uses time and enables specific ways to finish.', actions: [reconcile, verify, agreement, prepare, proceed] },
    resolve: { id: 'resolve', label: 'Follow through', prompt: 'Close only what the evidence supports. Complete help, confirm an agreement, or transfer the remaining concern explicitly.', actions: [close, voluntary, assist, visit, recover, handover, withdraw] },
  };
}

function welfareHandover(ctx: V3Context): ActionDefinition {
  const a = action(ctx, 'v3_welfare_handover', 'resolve', 'Hand over the checked account', 'handover', {
    favorable: 'With both claims checked, give specialists a complete handover; otherwise transfer an explicitly partial account.',
    mixed: 'Preserve the verified facts and outstanding practical work in a partial handover.',
    adverse: 'Transfer responsibility with the gaps clearly stated; the original concern remains open.',
  }, { consequenceLevel: 'low', modifiers: [{ label: 'Accounts reconciled', when: { flags: ['welfare_accounts_checked'] }, source: 'preparation', value: 6 }] });
  a.outcomes = {
    favorable: [
      { stage: 'resolve' },
      { when: { facts: [{ factId: 'f_person', in: ['confirmed', 'disproved'] }, { factId: 'f_context', in: ['confirmed', 'disproved'] }] }, ending: 'informed_handover', objective: 100, text: 'Both claims had been checked. Specialists accepted the verified account and responsibility for the explicit next step.' },
      { when: { facts: [{ factId: 'f_person', in: ['unknown', 'reported'] }] }, ending: 'partial_followthrough', objective: 52, text: 'The reported location still needs checking. The receiving team accepted that outstanding task with the available account.' },
      { when: { facts: [{ factId: 'f_person', in: ['confirmed', 'disproved'] }, { factId: 'f_context', in: ['unknown', 'reported'] }] }, ending: 'partial_followthrough', objective: 62, text: 'Presence was checked, but the assistance need remains unresolved. The receiving team accepted that gap explicitly.' },
    ],
    mixed: [{ ending: 'partial_followthrough', objective: 48, text: 'The team passed on the facts it had checked and identified follow-through still owed.' }],
    adverse: [{ ending: 'withdrawal_with_info', objective: 28, text: 'The receiving team was told which questions remain unanswered. Completion was not claimed.' }],
  };
  return a;
}
