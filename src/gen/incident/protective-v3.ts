import type { ActionDefinition, OutcomeEffect } from '../../sim/scenario-types';
import { action, incidentTruth, type V3Context } from './common-v3';

/** Fictional protective incident. Flags model plans and safety margins, not individual tactics or movement. */
export function buildProtectiveV3(ctx: V3Context): void {
  const { scenario: s, targetId, entryId, openingId } = ctx;
  s.facts[0].truth = true;
  s.facts.push({
    id: 'f_adjacent_safety', label: 'The reported exit area is clear', spaceId: targetId, truth: incidentTruth(ctx, 'exit_suitable'),
    initial: 'reported', showWhenUnknown: true, markers: { reported: 'EXIT CLEAR?', confirmed: 'EXIT CHECKED', disproved: 'EXIT UNSUITABLE' },
    claim: 'The caller thinks the nearby exit is clear. The team has not checked it.', source: 'Caller (unverified)',
    note: 'Check the exit before helping the person outside or choosing a specialist or equipment response.', uncertainty: 'Whether the reported exit can be used or another route is needed',
    resolved: { confirmed: 'The team checked the nearby exit. It can be used for the available responses.', disproved: 'The reported exit cannot be used. Prepare another route; a specialist or equipment response through this area is not allowed.' },
  });
  s.briefing.unknown = ['The team still needs to check what happened and where the person is.', 'An apparently clear exit may be unsuitable.', 'You can try an agreed plan, help the person outside, or ask specialists to take over.'];
  s.objectives = [{ id: 'o_contact', label: 'Hear the person’s side of the story' }, { id: 'o_protect', label: 'Agree on a plan or help the person outside with protection' }];
  s.pressure = { start: 26 + s.incident!.tier * 2, perMinute: 0.9, threshold: 70, civilianPerMinute: 1.1 };
  s.pressureLabel = 'Growing pressure; preparation takes time';
  const contact = action(ctx, 'v3_protect_contact', 'assess', 'Talk to the person', 'Try to reach the person and hear their side of the story.', 'radio', {
    favorable: 'Find out where the person is and start a conversation about a plan they will accept.',
    mixed: 'Find out where the person is, but the conversation is difficult. Try listening again.',
    adverse: 'The conversation breaks down. Try again or prepare a way outside.',
  }, { check: { kind: 'contact', ratings: [{ key: 'communication', weight: 0.7 }, { key: 'composure', weight: 0.3 }], difficulty: ctx.difficulty }, capabilities: { rules: [], deescalation: true }, equipment: [{ tag: 'hailer', value: 4, group: 'contact_link', label: 'a clear invitation to talk' }, { tag: 'throw_phone', value: 8, group: 'contact_link', range: 'opening', label: 'private two-way contact' }], consequenceLevel: 'low' });
  contact.outcomes = {
    favorable: [{ stage: 'adapt', reveal: ['f_person'], setFlags: ['protect_contact'], pressure: -7, text: 'The person answered and confirmed where they were. The team can talk to them about a plan.' }],
    mixed: [{ stage: 'adapt', reveal: ['f_person'], setFlags: ['protect_fragile_contact'], pressure: -2, text: 'A short answer confirmed location, but the exchange is fragile. Listening again can establish a workable agreement.' }],
    adverse: [{ stage: 'adapt', setFlags: ['protect_contact_failed'], pressure: 6, text: 'The conversation broke down. The report is still unchecked; try talking again or prepare a way outside.' }],
  };
  const check = action(ctx, 'v3_protect_initial_check', 'assess', 'Check the room and exit', 'Look for the person and check whether the nearby exit is usable.', 'search', {
    favorable: 'Find out where the person is and whether the nearby exit is usable.',
    mixed: 'Check the person’s location and exit after a second look takes extra time.',
    adverse: 'The view is blocked. Check the person and exit again before using a specialist or equipment response.',
  }, { check: { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.7 }, { key: 'coordination', weight: 0.3 }], difficulty: ctx.difficulty }, approach: 'path', workload: { base: 4, perSqFt: 0.01 }, capabilities: { rules: ['visible_exterior', 'dark_visible_scene'] } });
  check.outcomes = {
    favorable: [{ stage: 'adapt', reveal: ['f_person', 'f_adjacent_safety'], setFlags: ['protect_context_checked'], text: 'The person’s location and exit area were checked separately. The team recorded whether the reported route is suitable.' }],
    mixed: [{ stage: 'adapt', reveal: ['f_person', 'f_adjacent_safety'], setFlags: ['protect_context_checked'], extraMinutes: 3, text: 'A second check resolved the obstructed view and established whether the reported exit is suitable.' }],
    adverse: [{ stage: 'adapt', setFlags: ['protect_view_gap'], pressure: 4, text: 'The team could not check the area clearly. They need another check before choosing a specialist or equipment response.' }],
  };
  const listen = action(ctx, 'v3_protect_caller', 'assess', 'Ask what the caller actually saw', 'Separate what the caller witnessed from what they assumed.', 'intel', {
    favorable: 'Find out what the caller witnessed. This helps with later conversation and a specialist handover.',
    mixed: 'Find a contradiction to ask the person about. Their location is still unconfirmed.',
    adverse: 'The caller cannot explain the report. The team still needs to check it.',
  }, { consequenceLevel: 'low' });
  listen.outcomes = { favorable: [{ stage: 'adapt', setFlags: ['protect_account'], pressure: -3, text: 'The caller separated direct observations from assumptions. This will make the next conversation and handover more precise.' }], mixed: [{ stage: 'adapt', setFlags: ['protect_account'], extraMinutes: 2, text: 'The caller identified a contradiction and its source. It can now be raised during direct contact.' }], adverse: [{ stage: 'adapt', setFlags: ['protect_conflicting_report'], text: 'The caller could not explain the report. The team noted what still needed checking.' }] };
  const coordinate = action(ctx, 'v3_protect_coordinate', 'assess', 'Arrange someone to meet them outside', 'Agree on a meeting point and who will take over there.', 'perimeter', {
    favorable: 'Agree where someone will meet the person outside, avoiding a later handover delay.',
    mixed: 'Arrange someone to meet the person after a delay. The route still needs checking.',
    adverse: 'No meeting point is agreed. A completed move outside will need extra coordination time.',
  }, { targetId: entryId, capabilities: { rules: ['weak_radio_link', 'scene_coordination'], vehicleAccessible: true }, support: { max: 7, maxSquads: 2, coverSpaceId: entryId, reachMinutes: 15, label: 'preparing the receiving point', task: 'Receiving support' } });
  coordinate.outcomes = { favorable: [{ stage: 'adapt', setFlags: ['protect_receiver_ready'], text: 'A receiving point and support contact are agreed. A later transfer can hand responsibility over without the uncoordinated delay.' }], mixed: [{ stage: 'adapt', setFlags: ['protect_receiver_ready'], extraMinutes: 3, text: 'Receiving support is ready after delayed coordination. Route suitability remains a separate question.' }], adverse: [{ stage: 'adapt', pressure: 4, text: 'No receiving point was agreed. A transfer will need additional time to establish one.' }] };

  const talk = action(ctx, 'v3_protect_listen', 'adapt', 'Ask them to come out willingly', 'Listen to the person and try to agree on a way out.', 'radio', {
    favorable: 'Confirm the person’s location and agree on how they will leave willingly. You still need to carry out the plan.',
    mixed: 'Agree on a way out after a longer conversation. You still need to carry out the plan.',
    adverse: 'No agreement is reached. Prepare another way outside or ask specialists to take over.',
  }, { check: { kind: 'contact', ratings: [{ key: 'communication', weight: 0.7 }, { key: 'composure', weight: 0.3 }], difficulty: ctx.difficulty }, capabilities: { rules: [], deescalation: true }, modifiers: [{ label: 'Direct conversation already open', when: { flags: ['protect_contact'] }, source: 'preparation', value: 7 }, { label: 'Caller assumptions clarified', when: { flags: ['protect_account'] }, source: 'preparation', value: 4 }, { label: 'A fragile line needs patient clarification', when: { flags: ['protect_fragile_contact'] }, source: 'preparation', value: 3 }], consequenceLevel: 'low' });
  talk.outcomes = { favorable: [{ reveal: ['f_person'], setFlags: ['protect_agreement'], pressure: -9, text: 'The person agreed a voluntary exit and confirmed their location. The team can now complete that agreement.' }], mixed: [{ reveal: ['f_person'], setFlags: ['protect_agreement'], extraMinutes: 3, pressure: -3, text: 'A slower conversation produced an explicit voluntary plan. Its completion remains a separate decision.' }], adverse: [{ setFlags: ['protect_no_agreement'], pressure: 7, text: 'The person did not agree to a plan. The team must choose another option.' }] };
  const recheck = action(ctx, 'v3_protect_check', 'adapt', 'Check the person’s location and exit', 'Find out where the person is and whether the nearby exit is usable.', 'search', {
    favorable: 'Check the person’s location and exit. The exit must be usable before a specialist or equipment response is allowed.',
    mixed: 'Check both after extra time.',
    adverse: 'The person’s location or exit remains unclear. Try talking, prepare another route, or ask specialists to take over.',
  }, { approach: 'path', check: { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.7 }, { key: 'coordination', weight: 0.3 }], difficulty: ctx.difficulty - 5 }, capabilities: { rules: ['visible_exterior', 'dark_visible_scene'] } });
  recheck.visibleWhen = { notFlags: ['protect_context_checked'] };
  recheck.outcomes = { favorable: [{ reveal: ['f_person', 'f_adjacent_safety'], setFlags: ['protect_context_checked'], text: 'The team checked where the person was and whether the exit could be used. Those results determine the available responses.' }], mixed: [{ reveal: ['f_person', 'f_adjacent_safety'], setFlags: ['protect_context_checked'], extraMinutes: 3, text: 'Extra observation time settled both context checks. An unsuitable exit must be replaced with a prepared alternative.' }], adverse: [{ setFlags: ['protect_view_gap'], pressure: 5, text: 'The team could not finish checking the person and exit. A specialist or equipment response still needs those checks.' }] };
  const contain = action(ctx, 'v3_protect_cover', 'adapt', 'Prepare protection for the move', 'Set up protection to reduce harm if helping the person outside is delayed or goes wrong.', 'shield', {
    favorable: 'Prepare protection that reduces safety losses if the later move is delayed or stalls.',
    mixed: 'Prepare the same protection, but take extra time.',
    adverse: 'Protection is not ready. Pressure rises and safety falls; a difficult move would still carry the full safety cost.',
  }, { check: { kind: 'execution', ratings: [{ key: 'coordination', weight: 0.65 }, { key: 'composure', weight: 0.35 }], difficulty: ctx.difficulty }, capabilities: { rules: ['authorized_response'], responseContext: ctx.built.derived.spaces[targetId].capacity <= 2 ? 'constrained' : 'open' }, equipment: [{ tag: 'shield', value: 5, group: 'personal_protection', label: 'protective cover' }], stressBase: 5, consequenceLevel: 'high' });
  contain.outcomes = { favorable: [{ setFlags: ['protect_cover_ready'], pressure: -4, text: 'Protective cover is prepared. It will reduce safety loss if the later transfer is delayed or stalls.' }], mixed: [{ setFlags: ['protect_cover_ready'], extraMinutes: 3, text: 'Cover took longer to establish, but the transfer now has the prepared safety margin.' }], adverse: [{ setFlags: ['protect_cover_gap'], pressure: 8, civilian: -3, text: 'Protective cover was incomplete. The team lost time and three safety points without gaining the transfer safeguard.' }] };
  const route = action(ctx, 'v3_protect_route', 'adapt', 'Prepare a way outside', 'Reach the person and check a route they can use to leave.', 'door', {
    favorable: 'Reach the person and prepare a usable way outside, choosing another route if the reported exit is unsuitable.',
    mixed: 'Get a usable way outside ready after a delay.',
    adverse: 'No route is ready. Try an agreed plan or ask specialists to take over.',
  }, { approach: 'path', workload: { base: 5, perSqFt: 0.01 }, capabilities: { rules: ['weak_radio_link'] } });
  const open: Pick<OutcomeEffect, 'openings'> = openingId ? { openings: [{ openingId, state: 'open' }] } : {};
  route.visibleWhen = { notFlags: ['protect_route_ready'] };
  route.outcomes = { favorable: [{ reveal: ['f_person'], setFlags: ['protect_route_ready', 'protect_route_reached', 'protect_opening_ready'], ...open, text: 'The team physically reached the person along a usable route and checked their location. A protected transfer can now use the prepared route even if the originally reported exit was unsuitable.' }], mixed: [{ reveal: ['f_person'], setFlags: ['protect_route_ready', 'protect_route_reached', 'protect_opening_ready'], ...open, extraMinutes: 4, text: 'A suitable alternative took extra time to arrange. Access is ready for the protected-transfer option.' }], adverse: [{ setFlags: ['protect_route_gap'], pressure: 6, text: 'No suitable transfer route was prepared. A voluntary agreement or specialist handover remains available.' }] };
  const equipmentPreparation = accessAndInspection(ctx);
  const proceed = action(ctx, 'v3_protect_proceed', 'adapt', 'Choose how to finish', 'Move to the final choices using the checks and preparations already made.', 'handover', {
    favorable: 'Review the checks and preparations, then move to the final choices.',
    mixed: 'Review the checks and preparations, then move to the final choices.',
    adverse: 'Review the checks and preparations, then move to the final choices.',
  }, { workload: { base: 1, perSqFt: 0 }, stressBase: 0, consequenceLevel: 'low' });
  for (const band of ['favorable', 'mixed', 'adverse'] as const) proceed.outcomes[band] = [{ stage: 'resolve', text: 'The team reviewed its preparations and what still needed checking before the final choice.' }];

  const voluntary = action(ctx, 'v3_protect_voluntary', 'resolve', 'Help them carry out the agreed plan', 'Confirm the person’s next step and try to complete it with their agreement.', 'radio', {
    favorable: 'Help the person carry out the agreed plan and confirm who will support them next.',
    mixed: 'Finish the agreed plan after a delay, losing 3 safety points.',
    adverse: 'The plan falls through and safety falls. Recheck the situation, try the prepared route, or ask specialists to take over.',
  }, { requires: { flags: [{ flag: 'protect_agreement', reason: 'Agree on a plan with the person first' }] }, capabilities: { rules: [], deescalation: true }, check: { kind: 'contact', ratings: [{ key: 'communication', weight: 0.7 }, { key: 'composure', weight: 0.3 }], difficulty: ctx.difficulty - 5 }, consequenceLevel: 'moderate' });
  voluntary.outcomes = { favorable: [{ ending: 'voluntary_resolution', objective: 100, pressure: -12, text: 'The person completed the agreed next step. The team confirmed continuing support and closed the immediate concern.' }], mixed: [{ ending: 'voluntary_resolution', objective: 84, civilian: -3, extraMinutes: 3, text: 'The voluntary agreement was completed after a delay. The prolonged incident cost three safety points.' }], adverse: [{ stage: 'resolve', setFlags: ['protect_setback'], clearFlags: ['protect_agreement'], pressure: 9, civilian: -5, text: 'The agreement broke down before completion. The team can regroup or use another prepared route; the concern remains open.' }] };
  const transfer = action(ctx, 'v3_protect_transfer', 'resolve', 'Help the person outside', 'Try to bring them along the prepared route to the team outside.', 'shield', {
    favorable: 'Bring the person to the team outside. If no meeting point was arranged, the handover takes 4 extra minutes.',
    mixed: 'Bring the person outside after a delay. Lose 2 safety points with protection prepared, or 6 without it. If no meeting point was arranged, add 4 minutes.',
    adverse: 'The move stalls. Lose 5 safety points with protection prepared, or 12 without it. Recheck the situation or ask specialists to take over.',
  }, { targetId: entryId, approach: 'path', requires: { flags: [{ flag: 'protect_route_ready', reason: 'Prepare a way outside first' }, { flag: 'protect_route_reached', reason: 'Reach the person along the physical route before helping them outside' }], facts: [{ factId: 'f_person', in: ['confirmed'], reason: 'Check where the person is first' }] }, capabilities: { rules: ['vehicle_exterior', 'scene_coordination'], vehicleAccessible: !ctx.built.location.zones.find((zone) => zone.id === entryId)?.tags.some((tag) => tag === 'narrow' || tag === 'vehicle_inaccessible') }, support: { max: 8, maxSquads: 2, coverSpaceId: entryId, reachMinutes: 15, label: 'receiving the protected transfer', task: 'Receive' }, workload: { base: 5, perSqFt: 0 }, stressBase: 5, consequenceLevel: 'high' });
  const receiving: OutcomeEffect = { when: { notFlags: ['protect_receiver_ready'] }, extraMinutes: 4, text: 'No meeting point was arranged. Handing over to the team outside took 4 extra minutes.' };
  transfer.outcomes = {
    favorable: [{ ending: 'protected_transfer', objective: 100, text: 'The checked route allowed a completed transfer to continuing support.' }, receiving],
    mixed: [{ ending: 'protected_transfer', objective: 82, extraMinutes: 3, text: 'The protected transfer was completed after delay.' }, receiving, { when: { flags: ['protect_cover_ready'] }, civilian: -2, text: 'Prepared cover limited the delay’s safety loss to two points.' }, { when: { notFlags: ['protect_cover_ready'] }, civilian: -6, text: 'Without prepared cover the delayed transfer cost six safety points.' }],
    adverse: [{ stage: 'resolve', setFlags: ['protect_setback'], pressure: 9, text: 'The move outside stalled. The team can recheck the situation or ask specialists to take over.' }, { when: { flags: ['protect_cover_ready'] }, civilian: -5, text: 'Prepared cover limited the stalled transfer’s safety loss to five points.' }, { when: { notFlags: ['protect_cover_ready'] }, civilian: -12, text: 'No protective cover had been prepared, so the stalled transfer cost twelve safety points.' }],
  };
  const intervention = qualifiedOption(ctx);
  const recover = action(ctx, 'v3_protect_regroup', 'resolve', 'Recheck the situation and hand over', 'Try to confirm the person’s location, then ask specialists to take over.', 'radio', {
    favorable: 'Confirm the person’s location and a support contact, then let specialists take over the unfinished call.',
    mixed: 'Pass on the checked facts, with help or arrangements still unfinished.',
    adverse: 'Leave and pass on what you could not check. The call stays unresolved.',
  }, { visibleWhen: { flags: ['protect_setback'] }, check: { kind: 'coordination', ratings: [{ key: 'coordination', weight: 0.6 }, { key: 'communication', weight: 0.4 }], difficulty: ctx.difficulty - 10 }, workload: { base: 4, perSqFt: 0 }, consequenceLevel: 'moderate' });
  recover.outcomes = { favorable: [{ ending: 'informed_handover', reveal: ['f_person'], objective: 80, pressure: -6, text: 'The team confirmed the person’s location and who would help next. Specialists took over the unfinished call, with notes on what the team had tried.' }], mixed: [{ ending: 'partial_followthrough', objective: 57, text: 'The attempted routes and checked facts were preserved. Completing the immediate plan remains the receiving team’s task.' }], adverse: [{ ending: 'withdrawal_with_info', objective: 30, text: 'The team left and passed on what it could not check. The move outside and agreed plan remain unfinished.' }] };
  const handover = action(ctx, 'v3_protect_handover', 'resolve', 'Ask specialists to take over', 'Pass on the location, exit checks, and anything your team could not finish.', 'handover', {
    favorable: 'If the person’s location and exit were checked, specialists take over with the full details. Otherwise, they still have checks to finish.',
    mixed: 'Pass on the checked facts, with help or arrangements still unfinished.',
    adverse: 'Pass on the unanswered questions. The call stays unresolved.',
  }, { targetId: entryId, consequenceLevel: 'low', capabilities: { rules: ['weak_radio_link', 'scene_coordination'], vehicleAccessible: true }, support: { max: 6, maxSquads: 2, coverSpaceId: entryId, reachMinutes: 15, label: 'briefing the receiving team', task: 'Brief' }, modifiers: [{ label: 'Caller observations separated from assumptions', when: { flags: ['protect_account'] }, source: 'preparation', value: 5 }] });
  handover.outcomes = { favorable: [
    { stage: 'resolve' },
    { when: { facts: [{ factId: 'f_person', in: ['confirmed'] }, { factId: 'f_adjacent_safety', in: ['confirmed', 'disproved'] }] }, ending: 'informed_handover', objective: 100, text: 'The team checked the person’s location and exit. Specialists received the details and agreed to take over.' },
    { when: { facts: [{ factId: 'f_person', in: ['unknown', 'reported', 'disproved'] }] }, ending: 'partial_followthrough', objective: 50, text: 'The receiving team accepted the unresolved location report and the outstanding checks.' },
    { when: { facts: [{ factId: 'f_person', in: ['confirmed'] }, { factId: 'f_adjacent_safety', in: ['unknown', 'reported'] }] }, ending: 'partial_followthrough', objective: 60, text: 'The receiving team has the checked location. Exit suitability remains their outstanding task.' },
  ], mixed: [{ ending: 'partial_followthrough', objective: 53, text: 'The checked details were passed on, with help or arrangements still unfinished.' }], adverse: [{ ending: 'withdrawal_with_info', objective: 30, text: 'The call was passed on, with notes on the checks still needed.' }] };
  const withdraw = action(ctx, 'v3_protect_withdraw', 'resolve', 'Leave and pass on your notes', 'End your team’s involvement and pass on what is known. The call remains unresolved.', 'handover', {
    favorable: 'Leave and pass on what you know. The call stays unresolved.',
    mixed: 'Leave and pass on what you know. The call stays unresolved.',
    adverse: 'Leave and pass on what you know. The call stays unresolved.',
  }, { stressBase: 0, consequenceLevel: 'low' });
  for (const band of ['favorable', 'mixed', 'adverse'] as const) withdraw.outcomes[band] = [{ ending: 'withdrawal_with_info', objective: 24, text: 'The team left and passed on what it knew and what it could not check. The call is still unresolved.' }];
  s.stages = {
    assess: { id: 'assess', label: 'Check the report', prompt: 'The report has not been checked. Talk to the person, check the scene, or arrange help outside.', actions: [contact, check, listen, coordinate] },
    adapt: { id: 'adapt', label: 'Prepare the next step', prompt: 'Try to agree on a way out, prepare a route, or add protection. Each step takes time.', actions: [talk, recheck, contain, route, ...equipmentPreparation, proceed] },
    resolve: { id: 'resolve', label: 'Finish or call in specialists', prompt: 'Carry out the agreed plan, help the person outside, or ask specialists to take over. If a plan fails, check what you can try next.', actions: [voluntary, transfer, intervention, recover, handover, withdraw] },
  };
}

function qualifiedOption(ctx: V3Context): ActionDefinition {
  const specialist = ctx.scenario.incident!.seed % 3 === 2;
  const impact = !specialist && ctx.scenario.incident!.seed % 2 === 0;
  const rule = specialist ? 'specialist_support' : impact ? 'less_lethal_impact' : 'less_lethal_device';
  const a = action(ctx, 'v3_protect_qualified', 'resolve', specialist ? 'Use specialist support' : impact ? 'Use the less-lethal launcher' : 'Use the electrical device', specialist ? 'Attempt the response with a trained specialist and a separate supporting squad.' : impact ? 'Attempt the response using one launcher supply. Safety can fall even if it goes well.' : 'Attempt the response using one cartridge. Safety can fall even if it goes well.', 'shield', {
    favorable: 'Complete the response and hand over to support. Use one supply and lose 2 safety points, or 1 after a camera check.',
    mixed: 'Complete the response after a delay. Use one supply and lose 6 safety points, or 4 after a camera check.',
    adverse: 'The response does not finish the call. Use one supply and lose 12 safety points, or 9 after a camera check. Recheck the situation or ask specialists to take over.',
  }, { visibleWhen: { notFlags: ['protect_setback'] }, requires: { allTags: [impact ? 'impact_launcher' : 'energy_device'], certs: [impact ? 'advanced_less_lethal' : 'less_lethal'] }, consumes: [{ tag: impact ? 'impact_supply' : 'energy_cartridge', qty: 1 }], check: { kind: 'execution', ratings: [{ key: 'composure', weight: 0.6 }, { key: 'coordination', weight: 0.4 }], difficulty: ctx.difficulty + 5 }, capabilities: { rules: [rule], required: [rule], subjectFactIds: ['f_person'], safetyFactIds: ['f_adjacent_safety'] }, spatial: { channel: 'visual', subjectFactId: 'f_person', weight: 10, noun: 'Checked scene view' }, approach: 'path', stressBase: 7, consequenceLevel: 'high' });
  a.outcomes = { favorable: [{ ending: 'protective_resolution', objective: 100, civilian: -2, text: 'The response was completed and support took over. It used one supply and cost 2 safety points.' }], mixed: [{ ending: 'protective_resolution', objective: 84, civilian: -6, extraMinutes: 3, text: 'The response and handover were completed after a delay. They used one supply and cost 6 safety points.' }], adverse: [{ stage: 'resolve', setFlags: ['protect_setback'], civilian: -12, pressure: 10, text: 'The response did not finish the call. It used one supply and cost 12 safety points; the team can recheck the situation or ask specialists to take over.' }] };
  if (specialist) {
    a.requires = { allTags: ['precision_support'], certs: ['precision_support'], minSquads: { count: 2, reason: 'Specialist support needs a separate supporting squad' } };
    a.consumes = undefined;
    a.support = { max: 7, maxSquads: 1, coverSpaceId: ctx.targetId, reachMinutes: 15, label: 'trained specialist support', task: 'Specialist support' };
    a.outcomePreview = {
      favorable: 'Complete the response with specialist support and hand over. Lose 2 safety points, or 1 after a camera check.',
      mixed: 'Complete the response with specialist support after a delay. Lose 6 safety points, or 4 after a camera check.',
      adverse: 'The response with specialist support stalls. Lose 12 safety points, or 9 after a camera check. Recheck the situation or hand over.',
    };
    for (const [band, effect] of Object.entries(a.outcomes)) for (const entry of effect) if (entry.text) entry.text = band === 'favorable' ? 'The response with specialist support was completed and support took over. It cost 2 safety points.' : band === 'mixed' ? 'The response with specialist support and the handover were completed after a delay. They cost 6 safety points.' : 'The response with specialist support did not finish the call. It cost 12 safety points; the team can recheck the situation or hand over.';
  }
  for (const [band, gain] of [['favorable', 1], ['mixed', 2], ['adverse', 3]] as const) a.outcomes[band].push({ when: { flags: ['protect_inspected'] }, civilian: gain, text: `The earlier opening inspection recovered ${gain} safety ${gain === 1 ? 'point' : 'points'} by resolving the view limitation before this response.` });
  return a;
}

function accessAndInspection(ctx: V3Context): ActionDefinition[] {
  const door = ctx.built.location.openings.find((opening) => opening.id === ctx.openingId);
  if (!door) return [];
  const charge = ctx.scenario.incident!.seed % 2 === 1 && ['hollow_core', 'solid_core'].includes(door.material ?? 'solid_core');
  const access = action(ctx, 'v3_protect_access', 'adapt', charge ? 'Open the door with a charge' : 'Open the door with a rescue tool', charge ? 'Use one door charge to try to open this door. It raises pressure and can reduce safety.' : 'Try to open this door so the team can inspect it and check the route.', 'door', {
    favorable: charge ? 'Open the door using one charge. Pressure rises and safety falls by 2 points. The route still needs checking.' : 'Open the door with the rescue tool. Pressure rises slightly, and the route still needs checking.',
    mixed: charge ? 'Open the door after a delay using one charge. Pressure rises and safety falls by 6 points. The route still needs checking.' : 'Open the door after a delay. Pressure rises and safety falls by 1 point. The route still needs checking.',
    adverse: charge ? 'The door does not open. Use one charge; pressure rises and safety falls by 12 points. You can still prepare another route.' : 'The door does not open. Pressure rises and safety falls by 3 points. You can still prepare another route.',
  }, {
    visibleWhen: { flags: ['protect_context_checked'], notFlags: ['protect_opening_ready'] },
    targetId: door.a === ctx.targetId ? door.b : door.a, approach: 'path',
    requires: { allTags: [charge ? 'door_charge' : 'rescue_tool'], certs: ['controlled_access'] },
    ...(charge ? { consumes: [{ tag: 'door_charge', qty: 1 }] } : {}),
    capabilities: { rules: ['permitted_door_access'], required: ['permitted_door_access'], openingId: door.id, accessMethod: charge ? 'charge' : 'mechanical', safetyFactIds: ['f_adjacent_safety'] },
    consequenceLevel: charge ? 'high' : 'moderate',
  });
  access.outcomes = {
    favorable: [{ setFlags: ['protect_opening_ready'], openings: [{ openingId: door.id, state: 'open' }], civilian: charge ? -2 : 0, pressure: charge ? 6 : 1, text: charge ? 'The charge opened the door and cost 2 safety points. The team still needs to check the route.' : 'The rescue tool opened the door. The team still needs to check the route.' }],
    mixed: [{ setFlags: ['protect_opening_ready'], openings: [{ openingId: door.id, state: 'open' }], extraMinutes: 3, civilian: charge ? -6 : -1, pressure: charge ? 8 : 2, text: 'The door was opened after a delay. The team can check through it with a camera, but still needs to check the route outside.' }],
    adverse: [{ pressure: 8, civilian: charge ? -12 : -3, text: 'The access attempt failed to prepare a route. The team can still arrange the ordinary transfer route or choose communication and handover.' }],
  };
  const inspect = action(ctx, 'v3_protect_inspect', 'adapt', 'Check through the open doorway', 'Use the inspection camera to check the person and nearby area before a response.', 'intel', {
    favorable: 'Check through the doorway with the camera. A later specialist or equipment response loses fewer safety points.',
    mixed: 'Finish the camera check after extra time. It still reduces later safety losses.',
    adverse: 'The camera check is unclear. The camera takes normal wear, with no later safety benefit.',
  }, { visibleWhen: { flags: ['protect_opening_ready'] }, requires: { allTags: ['inspection_camera'], certs: ['drone_operator'] }, approach: 'path', check: { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.7 }, { key: 'coordination', weight: 0.3 }], difficulty: ctx.difficulty - 4 }, capabilities: { rules: ['opening_inspection'], required: ['opening_inspection'], openingId: door.id }, consequenceLevel: 'low' });
  inspect.outcomes = { favorable: [{ reveal: ['f_person', 'f_adjacent_safety'], setFlags: ['protect_inspected', 'protect_context_checked'], text: 'The camera check confirmed the person’s location and whether the exit was usable. A later specialist or equipment response will lose fewer safety points.' }], mixed: [{ reveal: ['f_person', 'f_adjacent_safety'], setFlags: ['protect_inspected', 'protect_context_checked'], extraMinutes: 3, text: 'The camera check took extra time. A later specialist or equipment response will lose fewer safety points.' }], adverse: [{ pressure: 4, text: 'The camera check was unclear. The camera took normal wear, with no later safety benefit.' }] };
  return [access, inspect];
}

