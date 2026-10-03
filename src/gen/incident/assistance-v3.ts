import type { OutcomeEffect } from '../../sim/scenario-types';
import { action, incidentTruth, type V3Context } from './common-v3';

/** Abstract assistance decisions: assess, make a care plan, then own its follow-through. */
export function buildAssistanceV3(ctx: V3Context): void {
  const { scenario: s, built, targetId, targetName, entryId, difficulty } = ctx;
  const spec = s.incident!;
  const transferFact = 'f_assist_transfer_possible';
  const accessFact = 'f_assist_access_delay';
  s.facts[0].truth = true;
  s.facts[0].label = `Person needing assistance in the ${targetName}`;
  s.facts[0].markers = { reported: 'NEEDS HELP?', confirmed: 'PERSON LOCATED' };
  s.facts[0].resolved = { confirmed: `The person needing assistance has been located in the ${targetName}.` };
  s.facts.push({
    id: transferFact, label: 'Suitability of a supported transfer', spaceId: targetId,
    truth: incidentTruth(ctx, 'transfer_suitability'), initial: 'unknown', showWhenUnknown: false,
    markers: { confirmed: 'TRANSFER POSSIBLE', disproved: 'CARE IN PLACE' },
    claim: 'The person can use a prepared transfer route with assistance.', source: null,
    note: 'Check the person’s needs before relying on a transfer. Protection does not establish suitability.',
    resolved: { confirmed: 'A supported transfer is possible once the route and receiving care are ready.', disproved: 'The person needs care in place or a specialist handover; a routine transfer is unsuitable.' },
    uncertainty: 'Whether a supported transfer would meet this person’s needs',
  }, {
    id: accessFact, label: 'Delay on the assistance route', spaceId: targetId,
    truth: incidentTruth(ctx, 'access_delay', 0.5), initial: 'unknown', showWhenUnknown: false,
    markers: { confirmed: 'ACCESS DELAY', disproved: 'ROUTE CLEAR' },
    claim: 'The assistance route needs additional preparation.', source: null,
    note: 'The caller’s account or a route check can establish the access delay.',
    resolved: { confirmed: 'Additional route preparation is needed and will take time.', disproved: 'No additional route preparation delay was found.' },
    uncertainty: 'Whether the assistance route will need additional preparation',
  });
  s.objectives = [
    { id: 'o_assistance', label: 'Complete suitable assistance or an informed care handover' },
    { id: 'o_needs', label: 'Locate the person and establish the next care responsibility' },
  ];
  s.pressure = { start: 24 + spec.tier * 2, perMinute: 1.35, threshold: 62, civilianPerMinute: 1.2 };
  s.pressureLabel = 'Time before assistance becomes harder';
  s.briefing.known.push('Preparation takes time. Locate the person, arrange receiving care, and choose qualified assistance, a suitable transfer, or a verified handover.');
  s.briefing.unknown = ['The person’s exact circumstances and whether a supported transfer is suitable.', 'Whether the route needs extra preparation.'];

  const contact = action(ctx, 'assist_contact', 'assess', 'Establish a line of contact', 'radio', {
    favorable: 'Locate the person by contact and improve the next needs check',
    mixed: 'Open a weak line; the location still needs checking',
    adverse: 'No clear answer; use another way to locate the person',
  }, {
    check: { kind: 'contact', ratings: [{ key: 'communication', weight: .7 }, { key: 'composure', weight: .3 }], difficulty },
    spatial: { channel: 'sound', subjectFactId: 'f_person', weight: 12, noun: 'Voice' },
    equipment: [{ tag: 'hailer', value: 4, group: 'contact_link', label: 'one-way contact aid' }, { tag: 'throw_phone', value: 7, group: 'contact_link', range: 'opening', label: 'a two-way line' }],
    consequenceLevel: 'low',
    outcomes: {
      favorable: [{ stage: 'adapt', objective: 0, reveal: ['f_person'], setFlags: ['assist_contact_open'], pressure: -3, text: 'A clear answer located the person and established a line for the care plan.' }],
      mixed: [{ stage: 'adapt', objective: 0, setFlags: ['assist_contact_open'], extraMinutes: 1, text: 'A faint answer opened a line, but did not verify the person’s location.' }],
      adverse: [{ stage: 'adapt', objective: 0, pressure: 4, setFlags: ['assist_needs_followthrough'], text: 'There was no clear answer. The team needs to locate the person another way.' }],
    },
  });
  const urgentLocate = action(ctx, 'assist_locate_urgent', 'assess', 'Go directly to the reported person', 'search', {
    favorable: 'Locate the person quickly, before arranging the care plan',
    mixed: 'Find the person with delay and a reduced safety margin',
    adverse: 'The approach stalls; access and location still need checking',
  }, {
    approach: 'path', tempo: 'urgent', workload: { base: 2, perSqFt: .012 },
    check: { kind: 'observation', ratings: [{ key: 'awareness', weight: .65 }, { key: 'coordination', weight: .35 }], difficulty: difficulty + 3 },
    consequenceLevel: 'high',
    outcomes: {
      favorable: [{ stage: 'adapt', objective: 0, reveal: ['f_person'], setFlags: ['assist_person_reached'], text: 'The team reached the reported room and located the person; care is still to be arranged.' }],
      mixed: [{ stage: 'adapt', objective: 0, reveal: ['f_person'], civilian: -3, extraMinutes: 2, setFlags: ['assist_person_reached'], text: 'The person was found, but the unprepared approach cost time and safety.' }],
      adverse: [{ stage: 'adapt', objective: 0, pressure: 6, civilian: -4, setFlags: ['assist_needs_followthrough'], text: 'The hurried approach stalled. The team has not yet verified the person’s location.' }],
    },
  });
  const reviewReport = action(ctx, 'assist_review_report', 'assess', 'Check the caller’s access account', 'intel', {
    favorable: 'Check the access concern and prepare a useful case summary',
    mixed: 'Clarify the route, while leaving gaps in the case summary',
    adverse: 'The caller cannot settle the access concern; time is lost',
  }, {
    workload: { base: 2, perSqFt: 0 }, consequenceLevel: 'low',
    outcomes: {
      favorable: [{ stage: 'adapt', objective: 0, reveal: [accessFact], setFlags: ['assist_case_briefed'], text: 'The caller clarified the route and gave a usable summary for receiving care.' }],
      mixed: [{ stage: 'adapt', objective: 0, reveal: [accessFact], text: 'The access account was checked, but the case summary still needs work.' }],
      adverse: [{ stage: 'adapt', objective: 0, pressure: 3, extraMinutes: 1, text: 'The caller could not clarify the route. Direct verification remains necessary.' }],
    },
  });
  const alertCare = action(ctx, 'assist_alert_care', 'assess', 'Arrange receiving care first', 'handover', {
    favorable: 'Agree who will receive the person or the verified case',
    mixed: 'Receiving care is ready, but the case details remain incomplete',
    adverse: 'The receiving arrangement is incomplete; rebuild it during preparation',
  }, {
    targetId: entryId, consequenceLevel: 'low',
    outcomes: {
      favorable: [{ stage: 'adapt', objective: 0, setFlags: ['assist_care_ready'], pressure: -3, text: 'Receiving care accepted responsibility for the next step once the person and needs are verified.' }],
      mixed: [{ stage: 'adapt', objective: 0, setFlags: ['assist_care_ready'], extraMinutes: 2, text: 'A receiving arrangement was secured after delay; the team still needs to verify the case.' }],
      adverse: [{ stage: 'adapt', objective: 0, pressure: 4, setFlags: ['assist_needs_followthrough'], text: 'The receiving arrangement did not hold. Care readiness still needs to be established.' }],
    },
  });

  const locate = action(ctx, 'assist_locate_person', 'adapt', 'Verify the person’s location', 'search', {
    favorable: 'Locate the person and check whether a transfer could be suitable',
    mixed: 'Locate the person after delay; transfer suitability remains uncertain',
    adverse: 'The location check stalls; carry that uncertainty into the next plan',
  }, {
    visibleWhen: { facts: [{ factId: 'f_person', in: ['unknown', 'reported'] }] },
    approach: 'path', workload: { base: 3, perSqFt: .012 },
    check: { kind: 'observation', ratings: [{ key: 'awareness', weight: .6 }, { key: 'coordination', weight: .4 }], difficulty: difficulty - 5 },
    modifiers: [{ label: 'An open line guides the location check', when: { flags: ['assist_contact_open'] }, source: 'preparation', value: 6 }],
    outcomes: {
      favorable: [{ stage: 'adapt', objective: 0, reveal: ['f_person', transferFact], setFlags: ['assist_person_reached'], text: 'The person was located and their suitability for an assisted transfer was checked.' }],
      mixed: [{ stage: 'adapt', objective: 0, reveal: ['f_person'], setFlags: ['assist_person_reached'], extraMinutes: 2, text: 'The person was located after delay. Their transfer needs remain unverified.' }],
      adverse: [{ stage: 'adapt', objective: 0, pressure: 5, setFlags: ['assist_needs_followthrough'], text: 'The location check did not settle the report. A revised plan or an explicit uncertain handover is needed.' }],
    },
  });
  const routeOpen = ctx.openingId ? [{ openingId: ctx.openingId, state: 'open' as const }] : [];
  const accessDelay: OutcomeEffect = { truth: [{ factId: accessFact, is: true }], extraMinutes: 3, text: 'The route needed additional preparation before it could be used.' };
  const access = action(ctx, 'assist_prepare_access', 'adapt', 'Prepare an assistance route', 'door', {
    favorable: 'Make the route usable; any real access problem adds preparation time',
    mixed: 'Prepare a usable route slowly, reducing time left for care',
    adverse: 'The route stays unready; transfer remains unavailable',
  }, {
    targetId, approach: 'path', visibleWhen: { notFlags: ['assist_access_ready'] },
    workload: { base: 4, perSqFt: 0 },
    outcomes: {
      favorable: [{ stage: 'adapt', objective: 0, reveal: [accessFact], setFlags: ['assist_access_ready', 'assist_route_reached'], openings: routeOpen, text: 'The team reached the reported room along the checked assistance route. It can now support a transfer and reduce later care delays.' }, accessDelay],
      mixed: [{ stage: 'adapt', objective: 0, reveal: [accessFact], setFlags: ['assist_access_ready', 'assist_route_reached'], openings: routeOpen, extraMinutes: 2, pressure: 2, text: 'The route became usable, but slow preparation reduced the remaining time margin.' }, accessDelay],
      adverse: [{ stage: 'adapt', objective: 0, reveal: [accessFact], setFlags: ['assist_needs_followthrough'], pressure: 5, text: 'The route could not be prepared. Transfer needs a rebuilt plan or a different response.' }],
    },
  });
  const care = action(ctx, 'assist_prepare_care', 'adapt', 'Confirm the receiving care plan', 'medic', {
    favorable: 'Make qualified assistance and a care handover ready',
    mixed: 'Secure receiving care with extra coordination time',
    adverse: 'Care remains unready; a revised plan will be needed',
  }, {
    targetId: entryId, visibleWhen: { notFlags: ['assist_care_ready'] }, consequenceLevel: 'low',
    outcomes: {
      favorable: [{ stage: 'adapt', objective: 0, setFlags: ['assist_care_ready'], pressure: -4, text: 'Receiving care confirmed the plan, opening qualified assistance and a fully informed care handover.' }],
      mixed: [{ stage: 'adapt', objective: 0, setFlags: ['assist_care_ready'], extraMinutes: 2, text: 'Receiving care confirmed after extra coordination. The plan is ready, with less time in hand.' }],
      adverse: [{ stage: 'adapt', objective: 0, setFlags: ['assist_needs_followthrough'], pressure: 4, text: 'The care arrangement remained incomplete. It will need rebuilding before a planned response.' }],
    },
  });
  const needs = action(ctx, 'assist_check_needs', 'adapt', 'Check needs and brief receiving care', 'intel', {
    favorable: 'Settle transfer suitability and prepare a verified case summary',
    mixed: 'Check the needs and summary, at an additional time cost',
    adverse: 'The person’s needs remain uncertain; equipment cannot settle them',
  }, {
    requires: { facts: [{ factId: 'f_person', in: ['confirmed'], reason: 'Locate the person before checking their needs' }] },
    check: { kind: 'contact', ratings: [{ key: 'communication', weight: .6 }, { key: 'medical', weight: .4 }], difficulty: difficulty - 4 },
    modifiers: [{ label: 'A stable contact line', when: { flags: ['assist_contact_open'] }, source: 'preparation', value: 5 }],
    consequenceLevel: 'low',
    outcomes: {
      favorable: [{ stage: 'adapt', objective: 0, reveal: [transferFact], setFlags: ['assist_case_briefed'], text: 'The team checked the person’s transfer needs and recorded a usable case summary for receiving care.' }],
      mixed: [{ stage: 'adapt', objective: 0, reveal: [transferFact], setFlags: ['assist_case_briefed'], extraMinutes: 2, text: 'The person’s needs were checked and briefed, but the exchange took longer than expected.' }],
      adverse: [{ stage: 'adapt', objective: 0, pressure: 3, setFlags: ['assist_needs_followthrough'], text: 'The exchange did not settle the person’s needs. A transfer still carries that uncertainty.' }],
    },
  });
  const commit = action(ctx, 'assist_commit_plan', 'adapt', 'Move to assistance and follow-through', 'handover', {
    favorable: 'Choose a response using the information and readiness already established',
    mixed: 'Begin follow-through with a small coordination delay',
    adverse: 'Proceed with unresolved gaps; rebuilding the plan remains available',
  }, {
    workload: { base: 1, perSqFt: 0 }, consequenceLevel: 'low',
    outcomes: {
      favorable: [{ stage: 'resolve', objective: 0, text: 'The team moved to the response decision with its current information and preparation.' }],
      mixed: [{ stage: 'resolve', objective: 0, extraMinutes: 1, text: 'The response briefing took extra time. Existing preparation remains available.' }],
      adverse: [{ stage: 'resolve', objective: 0, pressure: 3, setFlags: ['assist_needs_followthrough'], text: 'The response briefing exposed gaps. The team can rebuild the plan before acting.' }],
    },
  });

  const medical = action(ctx, 'assist_qualified_aid', 'resolve', 'Provide qualified assistance', 'medic', {
    favorable: 'Complete care and its handover using one trauma kit',
    mixed: 'Use the kit for partial assistance; transfer or handover is still needed',
    adverse: 'Use the kit without resolving the need; safety worsens and recovery remains possible',
  }, {
    requires: { certs: ['advanced_first_aid'], allTags: ['medkit'], facts: [{ factId: 'f_person', in: ['confirmed'], reason: 'Locate the person before providing care' }], flags: [{ flag: 'assist_care_ready', reason: 'Arrange receiving care before qualified assistance' }] },
    consumes: [{ tag: 'medkit', qty: 1 }], approach: 'path', tempo: 'urgent',
    workload: { base: 5, perSqFt: .01 },
    check: { kind: 'medical', ratings: [{ key: 'medical', weight: .8 }, { key: 'coordination', weight: .2 }], difficulty: difficulty + 2 },
    equipment: [{ tag: 'medkit', value: 7, label: 'medical supplies ready' }],
    capabilities: { rules: ['medical_exposure'], responseContext: built.location.rooms.find((r) => r.id === targetId)?.type === 'bathroom' ? 'constrained' : 'open' },
    modifiers: [{ label: 'Prepared route to the person', when: { flags: ['assist_access_ready'] }, source: 'preparation', value: 5 }, { label: 'The case was briefed to receiving care', when: { flags: ['assist_case_briefed'] }, source: 'preparation', value: 4 }],
    consequenceLevel: 'high',
    outcomes: {
      favorable: [{ ending: 'aid_completed', objective: 100, pressure: -8, text: 'Qualified assistance met the immediate need. Receiving care accepted the completed care handover.' }, { when: { flags: ['assist_access_ready'] }, extraMinutes: -2, text: 'The prepared route saved time in reaching care.' }],
      mixed: [{ stage: 'resolve', objective: 0, setFlags: ['assist_aid_partial', 'assist_needs_followthrough'], civilian: -4, pressure: 3, text: 'The kit supported partial assistance, but the person still needs a completed transfer or specialist handover.' }, { when: { flags: ['assist_access_ready'] }, civilian: 2, extraMinutes: -2, text: 'The prepared route reduced delay and protected part of the safety margin.' }],
      adverse: [{ stage: 'resolve', objective: 0, setFlags: ['assist_aid_setback', 'assist_needs_followthrough'], civilian: -10, pressure: 7, text: 'The kit was used, but the immediate need remains unresolved. A rebuilt plan or specialist handover is required.' }, { when: { flags: ['assist_access_ready'] }, civilian: 3, extraMinutes: -2, text: 'Prepared access limited the delay and the loss of safety.' }],
    },
  });
  const transfer = action(ctx, 'assist_protected_transfer', 'resolve', 'Complete a supported exterior transfer', 'shield', {
    favorable: 'Complete a suitable transfer; an unsuitable transfer pauses for care in place',
    mixed: 'A suitable transfer can finish slowly; unresolved needs require another plan',
    adverse: 'Transfer stalls and safety worsens; qualified aid or handover remains',
  }, {
    targetId: entryId, approach: 'path', tempo: 'urgent', workload: { base: 5, perSqFt: 0 },
    requires: { facts: [{ factId: 'f_person', in: ['confirmed'], reason: 'Locate the person before a transfer' }, { factId: transferFact, in: ['unknown', 'reported', 'confirmed'], reason: 'The checked needs rule out routine transfer; arrange care in place or specialist handover' }], flags: [{ flag: 'assist_access_ready', reason: 'Prepare the assistance route before transferring the person' }, { flag: 'assist_route_reached', reason: 'Reach the person along the checked physical route before exterior transfer' }, { flag: 'assist_care_ready', reason: 'Agree the receiving care before a transfer' }] },
    check: { kind: 'medical', ratings: [{ key: 'medical', weight: .45 }, { key: 'coordination', weight: .55 }], difficulty: difficulty + 5 },
    capabilities: { rules: ['medical_exposure', 'vehicle_exterior'], vehicleAccessible: !built.location.zones.find((z) => z.id === entryId)?.tags.some((tag) => tag === 'narrow' || tag === 'vehicle_inaccessible') },
    modifiers: [{ label: 'Transfer needs have been checked', when: { facts: [{ factId: transferFact, in: ['confirmed'] }] }, source: 'preparation', value: 7 }, { label: 'Receiving care has the case summary', when: { flags: ['assist_case_briefed'] }, source: 'preparation', value: 4 }],
    consequenceLevel: 'high',
    outcomes: {
      favorable: [{ stage: 'resolve', objective: 0, reveal: [transferFact] }, { truth: [{ factId: transferFact, is: true }], ending: 'protected_transfer', objective: 100, pressure: -8, text: 'The suitable transfer was completed along the prepared route. Receiving care accepted responsibility at the meeting point.' }, { truth: [{ factId: transferFact, is: false }], setFlags: ['assist_needs_followthrough'], extraMinutes: 2, pressure: 4, text: 'The person’s needs ruled out routine transfer. The team paused safely and must arrange care in place or specialist handover.' }],
      mixed: [{ stage: 'resolve', objective: 0, reveal: [transferFact] }, { truth: [{ factId: transferFact, is: true }], ending: 'protected_transfer', objective: 86, civilian: -4, extraMinutes: 2, text: 'The suitable transfer reached receiving care after delays, with a smaller safety margin.' }, { truth: [{ factId: transferFact, is: false }], setFlags: ['assist_needs_followthrough'], civilian: -4, extraMinutes: 2, pressure: 6, text: 'The transfer plan did not fit the person’s needs. It was stopped; care in place or specialist handover remains.' }],
      adverse: [{ stage: 'resolve', objective: 0, reveal: [transferFact], setFlags: ['assist_needs_followthrough'], civilian: -9, pressure: 8, text: 'The transfer stalled and the person remains in need of help. The team can rebuild the care plan or make an explicit handover.' }],
    },
  });
  const handover = action(ctx, 'assist_informed_handover', 'resolve', 'Hand responsibility to receiving specialists', 'handover', {
    favorable: 'A located person, case summary and ready care complete an informed handover; gaps produce partial follow-through',
    mixed: 'Prepared information supports a delayed handover; remaining gaps stay explicit',
    adverse: 'Transfer the outstanding concern with reduced confidence; further work remains',
  }, {
    targetId: entryId, check: { kind: 'coordination', ratings: [{ key: 'communication', weight: .6 }, { key: 'coordination', weight: .4 }], difficulty: difficulty - 9 },
    workload: { base: 3, perSqFt: 0 }, consequenceLevel: 'moderate',
    modifiers: [{ label: 'Receiving care is ready', when: { flags: ['assist_care_ready'] }, source: 'preparation', value: 5 }, { label: 'The case summary is complete', when: { flags: ['assist_case_briefed'] }, source: 'preparation', value: 5 }],
    outcomes: { favorable: [], mixed: [], adverse: [{ ending: 'partial_followthrough', objective: 45, pressure: 3, text: 'Specialists accepted the outstanding concern, but communication gaps left the care follow-through incomplete.' }] },
  });
  // Mutually exclusive public-state branches. Equipment alone cannot turn gaps
  // in location, receiving responsibility, or the case summary into completion.
  for (const band of ['favorable', 'mixed'] as const) {
    handover.outcomes[band] = [
      { stage: 'resolve', objective: 0 },
      { when: { facts: [{ factId: 'f_person', in: ['confirmed'] }], flags: ['assist_care_ready', 'assist_case_briefed'] }, ending: 'informed_handover', objective: band === 'favorable' ? 100 : 86, ...(band === 'mixed' ? { extraMinutes: 2, civilian: -2 } : {}), text: band === 'favorable' ? 'Specialists received the verified location, checked case summary and agreed care responsibility. The informed handover completed the team’s assistance.' : 'The verified case and care responsibility reached specialists after delay. The informed handover was completed.' },
      { when: { facts: [{ factId: 'f_person', in: ['unknown', 'reported', 'disproved'] }] }, ending: 'partial_followthrough', objective: band === 'favorable' ? 35 : 25, text: 'The location remained unverified. Specialists accepted the report and the explicit need to locate the person.' },
      { when: { facts: [{ factId: 'f_person', in: ['confirmed'] }], notFlags: ['assist_care_ready'] }, ending: 'partial_followthrough', objective: band === 'favorable' ? 55 : 40, text: 'The person’s location was passed on, but the receiving care plan remained incomplete.' },
      { when: { facts: [{ factId: 'f_person', in: ['confirmed'] }], flags: ['assist_care_ready'], notFlags: ['assist_case_briefed'] }, ending: 'partial_followthrough', objective: band === 'favorable' ? 65 : 50, text: 'Receiving care accepted the located person with gaps in the case summary still to resolve.' },
    ];
  }
  const rebuild = action(ctx, 'assist_rebuild_plan', 'resolve', 'Rebuild the assistance plan', 'perimeter', {
    favorable: 'Recheck the person and needs, restore access and receiving care, then choose another response',
    mixed: 'Restore a workable care plan with extra delay and a smaller safety margin',
    adverse: 'Verify the available case information; care readiness may still be missing',
  }, {
    visibleWhen: { flags: ['assist_needs_followthrough'] }, approach: 'path', workload: { base: 5, perSqFt: .008 },
    check: { kind: 'coordination', ratings: [{ key: 'coordination', weight: .6 }, { key: 'medical', weight: .4 }], difficulty: difficulty - 4 },
    outcomes: {
      favorable: [{ stage: 'resolve', objective: 0, reveal: ['f_person', transferFact, accessFact], setFlags: ['assist_care_ready', 'assist_access_ready', 'assist_route_reached', 'assist_case_briefed'], clearFlags: ['assist_needs_followthrough'], openings: routeOpen, pressure: -5, text: 'The person and needs were rechecked. Access, receiving care and the case summary are ready for another response.' }],
      mixed: [{ stage: 'resolve', objective: 0, reveal: ['f_person', transferFact, accessFact], setFlags: ['assist_care_ready', 'assist_access_ready', 'assist_route_reached', 'assist_case_briefed'], clearFlags: ['assist_needs_followthrough'], openings: routeOpen, extraMinutes: 2, civilian: -3, text: 'A workable care plan was restored after delay. The remaining response must account for a reduced safety margin.' }],
      adverse: [{ stage: 'resolve', objective: 0, reveal: ['f_person', transferFact], setFlags: ['assist_case_briefed'], pressure: 5, text: 'The team verified the person and recorded the outstanding needs, but could not restore all care arrangements. An explicit handover remains available.' }],
    },
  });
  const withdraw = action(ctx, 'assist_withdraw', 'resolve', 'Withdraw with the unresolved concern recorded', 'wait', {
    favorable: 'Preserve checked information while leaving assistance unfinished',
    mixed: 'Withdraw with a partial account and an open care concern',
    adverse: 'Withdraw after delay; the person’s need remains unresolved',
  }, {
    targetId: entryId, workload: { base: 2, perSqFt: 0 }, consequenceLevel: 'high',
    outcomes: {
      favorable: [{ ending: 'withdrawal_with_info', objective: 25, text: 'The team withdrew and recorded what it knew. Assistance remains an open responsibility for the receiving service.' }],
      mixed: [{ ending: 'withdrawal_with_info', objective: 15, civilian: -3, text: 'The team withdrew with a partial account. The person’s outstanding need was recorded for further response.' }],
      adverse: [{ ending: 'withdrawal_with_info', objective: 10, civilian: -6, extraMinutes: 2, text: 'Withdrawal took additional time. The team preserved the report, but the immediate care concern remains unresolved.' }],
    },
  });
  s.stages = {
    assess: { id: 'assess', label: 'Locate and assess', prompt: 'Choose what to establish first: contact, location, access information or receiving care.', actions: [contact, urgentLocate, reviewReport, alertCare] },
    adapt: { id: 'adapt', label: 'Prepare a care plan', prompt: 'Preparation opens specific responses and costs time. Move on when the chosen plan is ready.', actions: [locate, access, care, needs, commit] },
    resolve: { id: 'resolve', label: 'Assist and follow through', prompt: 'Choose suitable assistance, complete a verified handover, or recover from a stalled plan.', actions: [medical, transfer, handover, rebuild, withdraw] },
  };
}
