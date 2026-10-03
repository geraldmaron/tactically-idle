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
    id: transferFact, label: 'Whether the person can be helped outside', spaceId: targetId,
    truth: incidentTruth(ctx, 'transfer_suitability'), initial: 'unknown', showWhenUnknown: false,
    markers: { confirmed: 'TRANSFER POSSIBLE', disproved: 'CARE IN PLACE' },
    claim: 'The person can be helped outside along a prepared route.', source: null,
    note: 'Check the person’s needs before moving them. Preparing protection does not tell you whether they can be moved.',
    resolved: { confirmed: 'The person can be helped outside once the route and care team are ready.', disproved: 'The person needs care where they are or help from specialists. Moving them outside is unsuitable.' },
    uncertainty: 'Whether helping the person outside would meet their needs',
  }, {
    id: accessFact, label: 'Extra work needed to reach the person', spaceId: targetId,
    truth: incidentTruth(ctx, 'access_delay', 0.5), initial: 'unknown', showWhenUnknown: false,
    markers: { confirmed: 'ACCESS DELAY', disproved: 'ROUTE CLEAR' },
    claim: 'The way to the person needs extra work before it can be used.', source: null,
    note: 'Ask the caller or check the route to find out whether it needs extra work.',
    resolved: { confirmed: 'The route needs extra work, which will take time.', disproved: 'The route does not need extra preparation time.' },
    uncertainty: 'Whether the route needs extra work',
  });
  s.objectives = [
    { id: 'o_assistance', label: 'Give the help needed or hand over the checked details to a care team' },
    { id: 'o_needs', label: 'Find the person and arrange who will care for them next' },
  ];
  s.pressure = { start: 24 + spec.tier * 2, perMinute: 1.35, threshold: 62, civilianPerMinute: 1.2 };
  s.pressureLabel = 'Time before helping becomes harder';
  s.briefing.known.push('Preparation takes time. Find the person and arrange a care team. Then give first aid, help them outside if suitable, or ask specialists to take over.');
  s.briefing.unknown = ['What help the person needs and whether they can be helped outside.', 'Whether the route needs extra preparation.'];

  const contact = action(ctx, 'assist_contact', 'assess', 'Try to contact the person', 'Call out or speak to them to find out where they are and what help they need.', 'radio', {
    favorable: 'Find the person through a clear answer and make the next needs check easier.',
    mixed: 'Get a faint answer, but still need to check where the person is.',
    adverse: 'No clear answer. Find the person another way.',
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
  const urgentLocate = action(ctx, 'assist_locate_urgent', 'assess', 'Go straight to the reported room', 'Try to find the person now, before arranging a care plan.', 'search', {
    favorable: 'Find the person quickly. A care plan is still needed.',
    mixed: 'Find the person after a delay and lose safety points.',
    adverse: 'The rushed approach stalls. You still need to find the person, and safety falls.',
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
  const reviewReport = action(ctx, 'assist_review_report', 'assess', 'Ask the caller how to reach them', 'Check the route described by the caller and gather details for the care team.', 'intel', {
    favorable: 'Check the route and gather enough details to brief the care team.',
    mixed: 'Check the route, but leave gaps in the information for the care team.',
    adverse: 'The caller cannot explain the route. The team loses time.',
  }, {
    workload: { base: 2, perSqFt: 0 }, consequenceLevel: 'low',
    outcomes: {
      favorable: [{ stage: 'adapt', objective: 0, reveal: [accessFact], setFlags: ['assist_case_briefed'], text: 'The caller clarified the route and gave a usable summary for receiving care.' }],
      mixed: [{ stage: 'adapt', objective: 0, reveal: [accessFact], text: 'The access account was checked, but the case summary still needs work.' }],
      adverse: [{ stage: 'adapt', objective: 0, pressure: 3, extraMinutes: 1, text: 'The caller could not clarify the route. Direct verification remains necessary.' }],
    },
  });
  const alertCare = action(ctx, 'assist_alert_care', 'assess', 'Arrange a care team first', 'Ask a care team to take over once you have found the person and checked their needs.', 'handover', {
    favorable: 'A care team agrees to take over once you find the person and check their needs.',
    mixed: 'A care team is ready after a delay. You still need to find the person and check their needs.',
    adverse: 'The care arrangement falls through. Try arranging it again during preparation.',
  }, {
    targetId: entryId, consequenceLevel: 'low',
    outcomes: {
      favorable: [{ stage: 'adapt', objective: 0, setFlags: ['assist_care_ready'], pressure: -3, text: 'Receiving care accepted responsibility for the next step once the person and needs are verified.' }],
      mixed: [{ stage: 'adapt', objective: 0, setFlags: ['assist_care_ready'], extraMinutes: 2, text: 'A receiving arrangement was secured after delay; the team still needs to verify the case.' }],
      adverse: [{ stage: 'adapt', objective: 0, pressure: 4, setFlags: ['assist_needs_followthrough'], text: 'The receiving arrangement did not hold. Care readiness still needs to be established.' }],
    },
  });

  const locate = action(ctx, 'assist_locate_person', 'adapt', 'Find the person', 'Check their location and whether they can be helped outside.', 'search', {
    favorable: 'Find the person and check whether they can be helped outside.',
    mixed: 'Find the person after a delay, but still need to check whether moving them is suitable.',
    adverse: 'The check stalls. The person’s location remains unknown.',
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
  const access = action(ctx, 'assist_prepare_access', 'adapt', 'Prepare a way to reach them', 'Make the route usable so officers can reach the person and help them outside if needed.', 'door', {
    favorable: 'Make the route usable. If it needs extra work, preparation takes longer.',
    mixed: 'Make the route usable after a delay, leaving less time for care.',
    adverse: 'The route is not ready. You cannot use it to help the person outside yet.',
  }, {
    targetId, approach: 'path', visibleWhen: { notFlags: ['assist_access_ready'] },
    workload: { base: 4, perSqFt: 0 },
    outcomes: {
      favorable: [{ stage: 'adapt', objective: 0, reveal: [accessFact], setFlags: ['assist_access_ready', 'assist_route_reached'], openings: routeOpen, text: 'The team reached the reported room along the checked assistance route. It can now support a transfer and reduce later care delays.' }, accessDelay],
      mixed: [{ stage: 'adapt', objective: 0, reveal: [accessFact], setFlags: ['assist_access_ready', 'assist_route_reached'], openings: routeOpen, extraMinutes: 2, pressure: 2, text: 'The route became usable, but slow preparation reduced the remaining time margin.' }, accessDelay],
      adverse: [{ stage: 'adapt', objective: 0, reveal: [accessFact], setFlags: ['assist_needs_followthrough'], pressure: 5, text: 'The route could not be prepared. Transfer needs a rebuilt plan or a different response.' }],
    },
  });
  const care = action(ctx, 'assist_prepare_care', 'adapt', 'Confirm who will provide care', 'Make sure a care team is ready to take over.', 'medic', {
    favorable: 'A care team is ready to take over after first aid or a handover.',
    mixed: 'Get the care team ready after a delay.',
    adverse: 'The care team is not ready. Revise the plan before relying on them.',
  }, {
    targetId: entryId, visibleWhen: { notFlags: ['assist_care_ready'] }, consequenceLevel: 'low',
    outcomes: {
      favorable: [{ stage: 'adapt', objective: 0, setFlags: ['assist_care_ready'], pressure: -4, text: 'The care team confirmed the plan. The team can now give first aid or hand over once the other checks are complete.' }],
      mixed: [{ stage: 'adapt', objective: 0, setFlags: ['assist_care_ready'], extraMinutes: 2, text: 'Receiving care confirmed after extra coordination. The plan is ready, with less time in hand.' }],
      adverse: [{ stage: 'adapt', objective: 0, setFlags: ['assist_needs_followthrough'], pressure: 4, text: 'The care team was not ready. Revise the plan before relying on them.' }],
    },
  });
  const needs = action(ctx, 'assist_check_needs', 'adapt', 'Check what help they need', 'Find out whether the person can be moved and pass the details to the care team.', 'intel', {
    favorable: 'Check whether moving the person is suitable and brief the care team.',
    mixed: 'Check the person’s needs and brief the care team after a longer conversation.',
    adverse: 'The person’s needs remain unclear. Moving them may still be unsuitable.',
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
  const commit = action(ctx, 'assist_commit_plan', 'adapt', 'Choose how to help', 'Move to the final choices using the checks and preparations already made.', 'handover', {
    favorable: 'Move to the final choices with the checks and preparations already made.',
    mixed: 'Move to the final choices after a short delay.',
    adverse: 'Move to the final choices with gaps in the plan. You can still revise it.',
  }, {
    workload: { base: 1, perSqFt: 0 }, consequenceLevel: 'low',
    outcomes: {
      favorable: [{ stage: 'resolve', objective: 0, text: 'The team moved to the response decision with its current information and preparation.' }],
      mixed: [{ stage: 'resolve', objective: 0, extraMinutes: 1, text: 'The response briefing took extra time. Existing preparation remains available.' }],
      adverse: [{ stage: 'resolve', objective: 0, pressure: 3, setFlags: ['assist_needs_followthrough'], text: 'The team found gaps in the plan. They can revise it before trying to help.' }],
    },
  });

  const medical = action(ctx, 'assist_qualified_aid', 'resolve', 'Give first aid', 'Use one trauma kit to treat the person. They may still need more help afterward.', 'medic', {
    favorable: 'Use one trauma kit to finish the immediate care and hand over to the care team.',
    mixed: 'Use the kit for some care, but lose safety points. More help or a specialist handover is still needed.',
    adverse: 'Use the kit without finishing the care. Safety falls; revise the plan or ask specialists to take over.',
  }, {
    requires: { certs: ['advanced_first_aid'], allTags: ['medkit'], facts: [{ factId: 'f_person', in: ['confirmed'], reason: 'Locate the person before providing care' }], flags: [{ flag: 'assist_care_ready', reason: 'Arrange a care team before giving first aid' }] },
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
  const transfer = action(ctx, 'assist_protected_transfer', 'resolve', 'Help the person outside', 'Try to move them along the prepared route to the waiting care team.', 'shield', {
    favorable: 'If moving is suitable, reach the care team outside. Otherwise, stop and arrange care where the person is.',
    mixed: 'If moving is suitable, reach the care team after a delay. Otherwise, stop and revise the plan. Either way, safety falls.',
    adverse: 'The move stalls and safety falls. Give first aid, revise the plan, or ask specialists to take over.',
  }, {
    targetId: entryId, approach: 'path', tempo: 'urgent', workload: { base: 5, perSqFt: 0 },
    requires: { facts: [{ factId: 'f_person', in: ['confirmed'], reason: 'Locate the person before a transfer' }, { factId: transferFact, in: ['unknown', 'reported', 'confirmed'], reason: 'Moving the person is unsuitable; arrange care here or ask specialists to take over' }], flags: [{ flag: 'assist_access_ready', reason: 'Prepare a route before helping the person outside' }, { flag: 'assist_route_reached', reason: 'Reach the person along the physical route before helping them outside' }, { flag: 'assist_care_ready', reason: 'Arrange a care team before helping the person outside' }] },
    check: { kind: 'medical', ratings: [{ key: 'medical', weight: .45 }, { key: 'coordination', weight: .55 }], difficulty: difficulty + 5 },
    capabilities: { rules: ['medical_exposure', 'vehicle_exterior'], vehicleAccessible: !built.location.zones.find((z) => z.id === entryId)?.tags.some((tag) => tag === 'narrow' || tag === 'vehicle_inaccessible') },
    modifiers: [{ label: 'Transfer needs have been checked', when: { facts: [{ factId: transferFact, in: ['confirmed'] }] }, source: 'preparation', value: 7 }, { label: 'Receiving care has the case summary', when: { flags: ['assist_case_briefed'] }, source: 'preparation', value: 4 }],
    consequenceLevel: 'high',
    outcomes: {
      favorable: [{ stage: 'resolve', objective: 0, reveal: [transferFact] }, { truth: [{ factId: transferFact, is: true }], ending: 'protected_transfer', objective: 100, pressure: -8, text: 'The suitable transfer was completed along the prepared route. Receiving care accepted responsibility at the meeting point.' }, { truth: [{ factId: transferFact, is: false }], setFlags: ['assist_needs_followthrough'], extraMinutes: 2, pressure: 4, text: 'The person could not be moved outside. The team stopped and must arrange care here or ask specialists to take over.' }],
      mixed: [{ stage: 'resolve', objective: 0, reveal: [transferFact] }, { truth: [{ factId: transferFact, is: true }], ending: 'protected_transfer', objective: 86, civilian: -4, extraMinutes: 2, text: 'The suitable transfer reached receiving care after delays, with a smaller safety margin.' }, { truth: [{ factId: transferFact, is: false }], setFlags: ['assist_needs_followthrough'], civilian: -4, extraMinutes: 2, pressure: 6, text: 'The transfer plan did not fit the person’s needs. It was stopped; care in place or specialist handover remains.' }],
      adverse: [{ stage: 'resolve', objective: 0, reveal: [transferFact], setFlags: ['assist_needs_followthrough'], civilian: -9, pressure: 8, text: 'The transfer stalled and the person remains in need of help. The team can rebuild the care plan or make an explicit handover.' }],
    },
  });
  const handover = action(ctx, 'assist_informed_handover', 'resolve', 'Ask specialists to take over', 'Pass on the person’s location, needs, and any unfinished care arrangements.', 'handover', {
    favorable: 'If the person is located, a care team is ready, and the case has been briefed, specialists take over with the full details. Missing checks or arrangements leave more work to finish.',
    mixed: 'Hand over after a delay. With the location checked, care ready, and case briefed, the handover is complete; otherwise, more work remains.',
    adverse: 'Specialists accept the call, but gaps in communication leave more care to arrange.',
  }, {
    targetId: entryId, check: { kind: 'coordination', ratings: [{ key: 'communication', weight: .6 }, { key: 'coordination', weight: .4 }], difficulty: difficulty - 9 },
    workload: { base: 3, perSqFt: 0 }, consequenceLevel: 'moderate',
    modifiers: [{ label: 'Receiving care is ready', when: { flags: ['assist_care_ready'] }, source: 'preparation', value: 5 }, { label: 'The case summary is complete', when: { flags: ['assist_case_briefed'] }, source: 'preparation', value: 5 }],
    outcomes: { favorable: [], mixed: [], adverse: [{ ending: 'partial_followthrough', objective: 45, pressure: 3, text: 'Specialists accepted the call, but gaps in communication left more care to arrange.' }] },
  });
  // Mutually exclusive public-state branches. Equipment alone cannot turn gaps
  // in location, receiving responsibility, or the case summary into completion.
  for (const band of ['favorable', 'mixed'] as const) {
    handover.outcomes[band] = [
      { stage: 'resolve', objective: 0 },
      { when: { facts: [{ factId: 'f_person', in: ['confirmed'] }], flags: ['assist_care_ready', 'assist_case_briefed'] }, ending: 'informed_handover', objective: band === 'favorable' ? 100 : 86, ...(band === 'mixed' ? { extraMinutes: 2, civilian: -2 } : {}), text: band === 'favorable' ? 'Specialists received the checked location and case notes. They agreed to take over the care, completing the team’s part in the call.' : 'After a delay, specialists received the checked details and took over the care.' },
      { when: { facts: [{ factId: 'f_person', in: ['unknown', 'reported', 'disproved'] }] }, ending: 'partial_followthrough', objective: band === 'favorable' ? 35 : 25, text: 'The location remained unverified. Specialists accepted the report and the explicit need to locate the person.' },
      { when: { facts: [{ factId: 'f_person', in: ['confirmed'] }], notFlags: ['assist_care_ready'] }, ending: 'partial_followthrough', objective: band === 'favorable' ? 55 : 40, text: 'The person’s location was passed on, but the receiving care plan remained incomplete.' },
      { when: { facts: [{ factId: 'f_person', in: ['confirmed'] }], flags: ['assist_care_ready'], notFlags: ['assist_case_briefed'] }, ending: 'partial_followthrough', objective: band === 'favorable' ? 65 : 50, text: 'Receiving care accepted the located person with gaps in the case summary still to resolve.' },
    ];
  }
  const rebuild = action(ctx, 'assist_rebuild_plan', 'resolve', 'Revise the care plan', 'Recheck the person’s needs and try to arrange a usable route and care team.', 'perimeter', {
    favorable: 'Recheck the person and their needs, prepare the route, and get a care team ready for another attempt.',
    mixed: 'Get the plan ready for another attempt, but lose time and safety points.',
    adverse: 'Find the person and check their needs, but leave some care arrangements unfinished.',
  }, {
    visibleWhen: { flags: ['assist_needs_followthrough'] }, approach: 'path', workload: { base: 5, perSqFt: .008 },
    check: { kind: 'coordination', ratings: [{ key: 'coordination', weight: .6 }, { key: 'medical', weight: .4 }], difficulty: difficulty - 4 },
    outcomes: {
      favorable: [{ stage: 'resolve', objective: 0, reveal: ['f_person', transferFact, accessFact], setFlags: ['assist_care_ready', 'assist_access_ready', 'assist_route_reached', 'assist_case_briefed'], clearFlags: ['assist_needs_followthrough'], openings: routeOpen, pressure: -5, text: 'The person and needs were rechecked. Access, receiving care and the case summary are ready for another response.' }],
      mixed: [{ stage: 'resolve', objective: 0, reveal: ['f_person', transferFact, accessFact], setFlags: ['assist_care_ready', 'assist_access_ready', 'assist_route_reached', 'assist_case_briefed'], clearFlags: ['assist_needs_followthrough'], openings: routeOpen, extraMinutes: 2, civilian: -3, text: 'A workable care plan was restored after delay. The remaining response must account for a reduced safety margin.' }],
      adverse: [{ stage: 'resolve', objective: 0, reveal: ['f_person', transferFact], setFlags: ['assist_case_briefed'], pressure: 5, text: 'The team verified the person and recorded the outstanding needs, but could not restore all care arrangements. An explicit handover remains available.' }],
    },
  });
  const withdraw = action(ctx, 'assist_withdraw', 'resolve', 'Leave with help still needed', 'Leave the scene and pass on your notes. The person’s need remains unresolved.', 'wait', {
    favorable: 'Leave and pass on what you know. The person still needs help.',
    mixed: 'Leave with gaps in the notes and care still needed. Safety falls.',
    adverse: 'Leave after a delay. Safety falls, and the person still needs help.',
  }, {
    targetId: entryId, workload: { base: 2, perSqFt: 0 }, consequenceLevel: 'high',
    outcomes: {
      favorable: [{ ending: 'withdrawal_with_info', objective: 25, text: 'The team withdrew and recorded what it knew. Assistance remains an open responsibility for the receiving service.' }],
      mixed: [{ ending: 'withdrawal_with_info', objective: 15, civilian: -3, text: 'The team withdrew with a partial account. The person’s outstanding need was recorded for further response.' }],
      adverse: [{ ending: 'withdrawal_with_info', objective: 10, civilian: -6, extraMinutes: 2, text: 'Withdrawal took additional time. The team preserved the report, but the immediate care concern remains unresolved.' }],
    },
  });
  s.stages = {
    assess: { id: 'assess', label: 'Find out what is wrong', prompt: 'Contact the person, go to the reported room, ask about access, or arrange a care team.', actions: [contact, urgentLocate, reviewReport, alertCare] },
    adapt: { id: 'adapt', label: 'Get ready to help', prompt: 'Find the person, check their needs, and prepare care or a route outside. Each step takes time.', actions: [locate, access, care, needs, commit] },
    resolve: { id: 'resolve', label: 'Help or hand over', prompt: 'Give first aid, help the person outside, or ask specialists to take over. If the plan fails, revise it.', actions: [medical, transfer, handover, rebuild, withdraw] },
  };
}
