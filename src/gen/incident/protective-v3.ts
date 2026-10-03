import type { ActionDefinition, OutcomeEffect } from '../../sim/scenario-types';
import { action, incidentTruth, type V3Context } from './common-v3';

/** Fictional protective incident. Flags model plans and safety margins, not individual tactics or movement. */
export function buildProtectiveV3(ctx: V3Context): void {
  const { scenario: s, targetId, targetName, entryId, openingId } = ctx;
  s.facts[0].truth = true;
  s.facts.push({
    id: 'f_adjacent_safety', label: 'The reported exit area is clear', spaceId: targetId, truth: incidentTruth(ctx, 'exit_suitable'),
    initial: 'reported', showWhenUnknown: true, markers: { reported: 'EXIT CLEAR?', confirmed: 'EXIT CHECKED', disproved: 'EXIT UNSUITABLE' },
    claim: 'The caller believes the immediate exit area is clear; the team has not checked it.', source: 'Caller (unverified)',
    note: 'Check the area before choosing a protected transfer or a qualified intervention.', uncertainty: 'Whether the reported exit is suitable or an alternative route is needed',
    resolved: { confirmed: 'The adjacent area was checked and is suitable for the declared protective options.', disproved: 'The reported exit is unsuitable. A separately prepared route is needed; intervention through this area is not permitted.' },
  });
  s.briefing.unknown = ['The reported situation and person’s location require confirmation.', 'An apparently clear exit may be unsuitable.', 'A conversation, a protected exit, and an informed specialist handover are different ways to resolve the immediate concern.'];
  s.objectives = [{ id: 'o_contact', label: 'Understand the person’s account' }, { id: 'o_protect', label: 'Agree a safe resolution or protect a verified transfer' }];
  s.pressure = { start: 26 + s.incident!.tier * 2, perMinute: 0.9, threshold: 70, civilianPerMinute: 1.1 };
  s.pressureLabel = 'Growing pressure; preparation takes time';
  const contact = action(ctx, 'v3_protect_contact', 'assess', 'Open a calm conversation', 'radio', {
    favorable: 'Confirm the person’s location and establish a basis for voluntary resolution.',
    mixed: 'Establish a fragile line of contact; listening again can turn it into a workable agreement.',
    adverse: 'The first exchange breaks down. Another contact attempt or a protected route remains available.',
  }, { check: { kind: 'contact', ratings: [{ key: 'communication', weight: 0.7 }, { key: 'composure', weight: 0.3 }], difficulty: ctx.difficulty }, capabilities: { rules: [], deescalation: true }, equipment: [{ tag: 'hailer', value: 4, group: 'contact_link', label: 'a clear invitation to talk' }, { tag: 'throw_phone', value: 8, group: 'contact_link', range: 'opening', label: 'private two-way contact' }], consequenceLevel: 'low' });
  contact.outcomes = {
    favorable: [{ stage: 'adapt', reveal: ['f_person'], setFlags: ['protect_contact'], pressure: -7, text: 'The person answered and their location was verified. A direct conversation is available for a voluntary resolution.' }],
    mixed: [{ stage: 'adapt', reveal: ['f_person'], setFlags: ['protect_fragile_contact'], pressure: -2, text: 'A short answer confirmed location, but the exchange is fragile. Listening again can establish a workable agreement.' }],
    adverse: [{ stage: 'adapt', setFlags: ['protect_contact_failed'], pressure: 6, text: 'The exchange broke down. The first report remains unverified; communication can be rebuilt or the team can prepare a different route.' }],
  };
  const check = action(ctx, 'v3_protect_initial_check', 'assess', 'Check the report and exit area', 'search', {
    favorable: 'Verify the reported location and whether the exit area is suitable.',
    mixed: 'Verify location and exit suitability after a second, slower check.',
    adverse: 'A blocked view leaves the area unresolved; recheck before any context-gated intervention.',
  }, { check: { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.7 }, { key: 'coordination', weight: 0.3 }], difficulty: ctx.difficulty }, approach: 'path', workload: { base: 4, perSqFt: 0.01 }, capabilities: { rules: ['visible_exterior', 'dark_visible_scene'] } });
  check.outcomes = {
    favorable: [{ stage: 'adapt', reveal: ['f_person', 'f_adjacent_safety'], setFlags: ['protect_context_checked'], text: 'The person’s location and exit area were checked separately. The team recorded whether the reported route is suitable.' }],
    mixed: [{ stage: 'adapt', reveal: ['f_person', 'f_adjacent_safety'], setFlags: ['protect_context_checked'], extraMinutes: 3, text: 'A second check resolved the obstructed view and established whether the reported exit is suitable.' }],
    adverse: [{ stage: 'adapt', setFlags: ['protect_view_gap'], pressure: 4, text: 'The view did not establish a safe context. A later check is still needed; equipment alone cannot fill that gap.' }],
  };
  const listen = action(ctx, 'v3_protect_caller', 'assess', 'Separate the caller’s facts from guesses', 'intel', {
    favorable: 'Prepare a clearer account for a renewed conversation and specialist handover.',
    mixed: 'Identify contradictions worth putting to the person; no location is treated as verified yet.',
    adverse: 'The caller cannot clarify. Keep the original account explicitly unverified.',
  }, { consequenceLevel: 'low' });
  listen.outcomes = { favorable: [{ stage: 'adapt', setFlags: ['protect_account'], pressure: -3, text: 'The caller separated direct observations from assumptions. This will make the next conversation and handover more precise.' }], mixed: [{ stage: 'adapt', setFlags: ['protect_account'], extraMinutes: 2, text: 'The caller identified a contradiction and its source. It can now be raised during direct contact.' }], adverse: [{ stage: 'adapt', setFlags: ['protect_conflicting_report'], text: 'The caller could not clarify the account. Its gaps were recorded rather than converted into facts.' }] };
  const coordinate = action(ctx, 'v3_protect_coordinate', 'assess', 'Prepare receiving support', 'perimeter', {
    favorable: 'Agree an exterior receiving point; later transfer avoids an uncoordinated handover delay.',
    mixed: 'Receiving support is ready after delay; the team still needs to check the route.',
    adverse: 'The receiving point is not agreed. A later transfer will need extra coordination.',
  }, { targetId: entryId, capabilities: { rules: ['weak_radio_link', 'scene_coordination'], vehicleAccessible: true }, support: { max: 7, maxSquads: 2, coverSpaceId: entryId, reachMinutes: 15, label: 'preparing the receiving point', task: 'Receiving support' } });
  coordinate.outcomes = { favorable: [{ stage: 'adapt', setFlags: ['protect_receiver_ready'], text: 'A receiving point and support contact are agreed. A later transfer can hand responsibility over without the uncoordinated delay.' }], mixed: [{ stage: 'adapt', setFlags: ['protect_receiver_ready'], extraMinutes: 3, text: 'Receiving support is ready after delayed coordination. Route suitability remains a separate question.' }], adverse: [{ stage: 'adapt', pressure: 4, text: 'No receiving point was agreed. A transfer will need additional time to establish one.' }] };

  const talk = action(ctx, 'v3_protect_listen', 'adapt', 'Listen and agree an exit', 'radio', {
    favorable: 'Verify location and agree a voluntary way out; this unlocks the conversation-led completion route.',
    mixed: 'Agree a slower voluntary plan after clarification; the route remains usable.',
    adverse: 'No agreement is reached; prepare a protected transfer or a specialist handover.',
  }, { check: { kind: 'contact', ratings: [{ key: 'communication', weight: 0.7 }, { key: 'composure', weight: 0.3 }], difficulty: ctx.difficulty }, capabilities: { rules: [], deescalation: true }, modifiers: [{ label: 'Direct conversation already open', when: { flags: ['protect_contact'] }, source: 'preparation', value: 7 }, { label: 'Caller assumptions clarified', when: { flags: ['protect_account'] }, source: 'preparation', value: 4 }, { label: 'A fragile line needs patient clarification', when: { flags: ['protect_fragile_contact'] }, source: 'preparation', value: 3 }], consequenceLevel: 'low' });
  talk.outcomes = { favorable: [{ reveal: ['f_person'], setFlags: ['protect_agreement'], pressure: -9, text: 'The person agreed a voluntary exit and confirmed their location. The team can now complete that agreement.' }], mixed: [{ reveal: ['f_person'], setFlags: ['protect_agreement'], extraMinutes: 3, pressure: -3, text: 'A slower conversation produced an explicit voluntary plan. Its completion remains a separate decision.' }], adverse: [{ setFlags: ['protect_no_agreement'], pressure: 7, text: 'No voluntary plan was agreed. The team must choose another route without representing the exchange as consent.' }] };
  const recheck = action(ctx, 'v3_protect_check', 'adapt', 'Verify the person and adjacent area', 'search', {
    favorable: 'Resolve the location and exit checks; only a confirmed suitable area permits a qualified intervention.',
    mixed: 'Resolve both checks after extra observation time.',
    adverse: 'The context remains uncertain. Conversation, preparing another route, and handover stay available.',
  }, { approach: 'path', check: { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.7 }, { key: 'coordination', weight: 0.3 }], difficulty: ctx.difficulty - 5 }, capabilities: { rules: ['visible_exterior', 'dark_visible_scene'] } });
  recheck.visibleWhen = { notFlags: ['protect_context_checked'] };
  recheck.outcomes = { favorable: [{ reveal: ['f_person', 'f_adjacent_safety'], setFlags: ['protect_context_checked'], text: 'A direct check settled location and exit suitability. The results now govern which protective options are permitted.' }], mixed: [{ reveal: ['f_person', 'f_adjacent_safety'], setFlags: ['protect_context_checked'], extraMinutes: 3, text: 'Extra observation time settled both context checks. An unsuitable exit must be replaced with a prepared alternative.' }], adverse: [{ setFlags: ['protect_view_gap'], pressure: 5, text: 'The context check remained incomplete. The team cannot substitute equipment for the missing verification.' }] };
  const contain = action(ctx, 'v3_protect_cover', 'adapt', 'Establish protective cover', 'shield', {
    favorable: 'Prepare a safety margin for the later transfer; it reduces transfer setback losses.',
    mixed: 'Establish cover slowly. It still limits later transfer safety losses.',
    adverse: 'Cover is incomplete and pressure rises; an unprotected transfer carries larger losses if it stalls.',
  }, { check: { kind: 'execution', ratings: [{ key: 'coordination', weight: 0.65 }, { key: 'composure', weight: 0.35 }], difficulty: ctx.difficulty }, capabilities: { rules: ['authorized_response'], responseContext: ctx.built.derived.spaces[targetId].capacity <= 2 ? 'constrained' : 'open' }, equipment: [{ tag: 'shield', value: 5, group: 'personal_protection', label: 'protective cover' }], stressBase: 5, consequenceLevel: 'high' });
  contain.outcomes = { favorable: [{ setFlags: ['protect_cover_ready'], pressure: -4, text: 'Protective cover is prepared. It will reduce safety loss if the later transfer is delayed or stalls.' }], mixed: [{ setFlags: ['protect_cover_ready'], extraMinutes: 3, text: 'Cover took longer to establish, but the transfer now has the prepared safety margin.' }], adverse: [{ setFlags: ['protect_cover_gap'], pressure: 8, civilian: -3, text: 'Protective cover was incomplete. The team lost time and three safety points without gaining the transfer safeguard.' }] };
  const route = action(ctx, 'v3_protect_route', 'adapt', 'Prepare a checked transfer route', 'door', {
    favorable: 'Verify location and prepare access; an unsuitable reported exit is replaced by a checked alternative.',
    mixed: 'Prepare the alternative route after delay; protected transfer becomes available.',
    adverse: 'No route is ready. Conversation or an information-led handover remains viable.',
  }, { approach: 'path', workload: { base: 5, perSqFt: 0.01 }, capabilities: { rules: ['weak_radio_link'] } });
  const open: Pick<OutcomeEffect, 'openings'> = openingId ? { openings: [{ openingId, state: 'open' }] } : {};
  route.visibleWhen = { notFlags: ['protect_route_ready'] };
  route.outcomes = { favorable: [{ reveal: ['f_person'], setFlags: ['protect_route_ready', 'protect_route_reached', 'protect_opening_ready'], ...open, text: 'The team physically reached the person along a usable route and checked their location. A protected transfer can now use the prepared route even if the originally reported exit was unsuitable.' }], mixed: [{ reveal: ['f_person'], setFlags: ['protect_route_ready', 'protect_route_reached', 'protect_opening_ready'], ...open, extraMinutes: 4, text: 'A suitable alternative took extra time to arrange. Access is ready for the protected-transfer option.' }], adverse: [{ setFlags: ['protect_route_gap'], pressure: 6, text: 'No suitable transfer route was prepared. A voluntary agreement or specialist handover remains available.' }] };
  const equipmentPreparation = accessAndInspection(ctx);
  const proceed = action(ctx, 'v3_protect_proceed', 'adapt', 'Commit to the resolution plan', 'handover', { favorable: 'Choose a voluntary agreement, prepared transfer, qualified option, or handover.', mixed: 'Choose a final route with the verified limits visible.', adverse: 'Move to a final route without treating unresolved context as safe.' }, { workload: { base: 1, perSqFt: 0 }, stressBase: 0, consequenceLevel: 'low' });
  for (const band of ['favorable', 'mixed', 'adverse'] as const) proceed.outcomes[band] = [{ stage: 'resolve', text: 'The team reviewed the prepared routes and the unresolved context before committing to a resolution.' }];

  const voluntary = action(ctx, 'v3_protect_voluntary', 'resolve', 'Complete the voluntary agreement', 'radio', {
    favorable: 'Confirm the agreed next step and close the immediate concern without an intervention.',
    mixed: 'Complete the voluntary agreement after delay, with a small safety cost from the prolonged incident.',
    adverse: 'The agreement breaks down. Regroup, use a prepared transfer, or pass the checked account onward.',
  }, { requires: { flags: [{ flag: 'protect_agreement', reason: 'Reach a voluntary agreement first' }] }, capabilities: { rules: [], deescalation: true }, check: { kind: 'contact', ratings: [{ key: 'communication', weight: 0.7 }, { key: 'composure', weight: 0.3 }], difficulty: ctx.difficulty - 5 }, consequenceLevel: 'moderate' });
  voluntary.outcomes = { favorable: [{ ending: 'voluntary_resolution', objective: 100, pressure: -12, text: 'The person completed the agreed next step. The team confirmed continuing support and closed the immediate concern.' }], mixed: [{ ending: 'voluntary_resolution', objective: 84, civilian: -3, extraMinutes: 3, text: 'The voluntary agreement was completed after a delay. The prolonged incident cost three safety points.' }], adverse: [{ stage: 'resolve', setFlags: ['protect_setback'], clearFlags: ['protect_agreement'], pressure: 9, civilian: -5, text: 'The agreement broke down before completion. The team can regroup or use another prepared route; the concern remains open.' }] };
  const transfer = action(ctx, 'v3_protect_transfer', 'resolve', 'Complete a protected transfer', 'shield', {
    favorable: 'Use the checked route to bring the person to receiving support; prepared cover and receiving coordination avoid extra costs.',
    mixed: 'Complete transfer after delay. Prepared cover limits safety loss from six points to two.',
    adverse: 'Transfer stalls. Prepared cover limits safety loss from twelve points to five; regroup or hand over next.',
  }, { targetId: entryId, approach: 'path', requires: { flags: [{ flag: 'protect_route_ready', reason: 'Prepare a checked transfer route first' }, { flag: 'protect_route_reached', reason: 'Reach the person along the checked physical route before exterior transfer' }], facts: [{ factId: 'f_person', in: ['confirmed'], reason: 'Verify the person’s location first' }] }, capabilities: { rules: ['vehicle_exterior', 'scene_coordination'], vehicleAccessible: !ctx.built.location.zones.find((zone) => zone.id === entryId)?.tags.some((tag) => tag === 'narrow' || tag === 'vehicle_inaccessible') }, support: { max: 8, maxSquads: 2, coverSpaceId: entryId, reachMinutes: 15, label: 'receiving the protected transfer', task: 'Receive' }, workload: { base: 5, perSqFt: 0 }, stressBase: 5, consequenceLevel: 'high' });
  const receiving: OutcomeEffect = { when: { notFlags: ['protect_receiver_ready'] }, extraMinutes: 4, text: 'A receiving point had not been agreed: completing the handover added four minutes.' };
  transfer.outcomes = {
    favorable: [{ ending: 'protected_transfer', objective: 100, text: 'The checked route allowed a completed transfer to continuing support.' }, receiving],
    mixed: [{ ending: 'protected_transfer', objective: 82, extraMinutes: 3, text: 'The protected transfer was completed after delay.' }, receiving, { when: { flags: ['protect_cover_ready'] }, civilian: -2, text: 'Prepared cover limited the delay’s safety loss to two points.' }, { when: { notFlags: ['protect_cover_ready'] }, civilian: -6, text: 'Without prepared cover the delayed transfer cost six safety points.' }],
    adverse: [{ stage: 'resolve', setFlags: ['protect_setback'], pressure: 9, text: 'The transfer stalled before it could be completed. Regrouping or an informed specialist handover remains possible.' }, { when: { flags: ['protect_cover_ready'] }, civilian: -5, text: 'Prepared cover limited the stalled transfer’s safety loss to five points.' }, { when: { notFlags: ['protect_cover_ready'] }, civilian: -12, text: 'No protective cover had been prepared, so the stalled transfer cost twelve safety points.' }],
  };
  const intervention = qualifiedOption(ctx);
  const recover = action(ctx, 'v3_protect_regroup', 'resolve', 'Regroup around the checked account', 'radio', {
    favorable: 'Re-establish a verified location and receiving contact; specialists can take over a defined unresolved concern.',
    mixed: 'Preserve the checked account and pass the incomplete follow-through to support.',
    adverse: 'Step back with the remaining uncertainty recorded; do not claim the person was transferred.',
  }, { visibleWhen: { flags: ['protect_setback'] }, check: { kind: 'coordination', ratings: [{ key: 'coordination', weight: 0.6 }, { key: 'communication', weight: 0.4 }], difficulty: ctx.difficulty - 10 }, workload: { base: 4, perSqFt: 0 }, consequenceLevel: 'moderate' });
  recover.outcomes = { favorable: [{ ending: 'informed_handover', reveal: ['f_person'], objective: 80, pressure: -6, text: 'The team re-established the person’s location and receiving contact. Specialists accepted a defined unresolved concern with the attempted routes documented.' }], mixed: [{ ending: 'partial_followthrough', objective: 57, text: 'The attempted routes and checked facts were preserved. Completing the immediate plan remains the receiving team’s task.' }], adverse: [{ ending: 'withdrawal_with_info', objective: 30, text: 'The team stepped back with the gaps explicitly recorded. Neither transfer nor voluntary resolution was claimed.' }] };
  const handover = action(ctx, 'v3_protect_handover', 'resolve', 'Give specialists a structured handover', 'handover', {
    favorable: 'With verified location and checked context, complete an informed handover; missing checks leave partial follow-through.',
    mixed: 'Transfer the checked account and outstanding tasks with a smaller completion reward.',
    adverse: 'Transfer the unresolved concern and record what still needs checking.',
  }, { targetId: entryId, consequenceLevel: 'low', capabilities: { rules: ['weak_radio_link', 'scene_coordination'], vehicleAccessible: true }, support: { max: 6, maxSquads: 2, coverSpaceId: entryId, reachMinutes: 15, label: 'briefing the receiving team', task: 'Brief' }, modifiers: [{ label: 'Caller observations separated from assumptions', when: { flags: ['protect_account'] }, source: 'preparation', value: 5 }] });
  handover.outcomes = { favorable: [
    { stage: 'resolve' },
    { when: { facts: [{ factId: 'f_person', in: ['confirmed'] }, { factId: 'f_adjacent_safety', in: ['confirmed', 'disproved'] }] }, ending: 'informed_handover', objective: 100, text: 'Location and exit suitability were both checked. Specialists accepted responsibility with the full context.' },
    { when: { facts: [{ factId: 'f_person', in: ['unknown', 'reported', 'disproved'] }] }, ending: 'partial_followthrough', objective: 50, text: 'The receiving team accepted the unresolved location report and the outstanding checks.' },
    { when: { facts: [{ factId: 'f_person', in: ['confirmed'] }, { factId: 'f_adjacent_safety', in: ['unknown', 'reported'] }] }, ending: 'partial_followthrough', objective: 60, text: 'The receiving team has the checked location. Exit suitability remains their outstanding task.' },
  ], mixed: [{ ending: 'partial_followthrough', objective: 53, text: 'The checked account was transferred with follow-through still outstanding.' }], adverse: [{ ending: 'withdrawal_with_info', objective: 30, text: 'The concern was transferred, with missing checks stated explicitly.' }] };
  const withdraw = action(ctx, 'v3_protect_withdraw', 'resolve', 'Step back and preserve the information', 'handover', { favorable: 'End the team’s involvement with the unresolved concern clearly passed onward.', mixed: 'Preserve the information and outstanding responsibility.', adverse: 'Preserve the known limits; the original concern remains open.' }, { stressBase: 0, consequenceLevel: 'low' });
  for (const band of ['favorable', 'mixed', 'adverse'] as const) withdraw.outcomes[band] = [{ ending: 'withdrawal_with_info', objective: 24, text: 'The team stepped back and passed on its checked facts and remaining uncertainty. The concern has not been declared resolved.' }];
  s.stages = {
    assess: { id: 'assess', label: 'Understand the report', prompt: `The report from the ${targetName} is unverified. Open contact, check context, or prepare the receiving team.`, actions: [contact, check, listen, coordinate] },
    adapt: { id: 'adapt', label: 'Prepare a safe choice', prompt: 'A voluntary agreement, checked transfer route, and protective cover enable different endings. Each preparation costs time.', actions: [talk, recheck, contain, route, ...equipmentPreparation, proceed] },
    resolve: { id: 'resolve', label: 'Complete or transfer responsibility', prompt: 'Use an agreed or prepared route. If it stalls, regroup with the checked information instead of declaring success.', actions: [voluntary, transfer, intervention, recover, handover, withdraw] },
  };
}

function qualifiedOption(ctx: V3Context): ActionDefinition {
  const specialist = ctx.scenario.incident!.seed % 3 === 2;
  const impact = !specialist && ctx.scenario.incident!.seed % 2 === 0;
  const rule = specialist ? 'specialist_support' : impact ? 'less_lethal_impact' : 'less_lethal_device';
  const a = action(ctx, 'v3_protect_qualified', 'resolve', specialist ? 'Coordinate qualified specialist support' : impact ? 'Use the qualified protective option' : 'Use the qualified device option', 'shield', {
    favorable: 'In a verified permitted context, complete the abstract protective response and safety handover; one supply is used.',
    mixed: 'Complete the response and handover after delay, at a six-point safety cost; one supply is used.',
    adverse: 'The response does not resolve the concern. One supply and twelve safety points are lost; regroup or hand over next.',
  }, { visibleWhen: { notFlags: ['protect_setback'] }, requires: { allTags: [impact ? 'impact_launcher' : 'energy_device'], certs: [impact ? 'advanced_less_lethal' : 'less_lethal'] }, consumes: [{ tag: impact ? 'impact_supply' : 'energy_cartridge', qty: 1 }], check: { kind: 'execution', ratings: [{ key: 'composure', weight: 0.6 }, { key: 'coordination', weight: 0.4 }], difficulty: ctx.difficulty + 5 }, capabilities: { rules: [rule], required: [rule], subjectFactIds: ['f_person'], safetyFactIds: ['f_adjacent_safety'] }, spatial: { channel: 'visual', subjectFactId: 'f_person', weight: 10, noun: 'Checked scene view' }, approach: 'path', stressBase: 7, consequenceLevel: 'high' });
  a.outcomes = { favorable: [{ ending: 'protective_resolution', objective: 100, civilian: -2, text: 'The qualified response completed the verified protective objective and its receiving handover. One declared supply was used and the intervention cost two safety points.' }], mixed: [{ ending: 'protective_resolution', objective: 84, civilian: -6, extraMinutes: 3, text: 'The qualified response and handover were completed after delay, costing six safety points and the declared supply.' }], adverse: [{ stage: 'resolve', setFlags: ['protect_setback'], civilian: -12, pressure: 10, text: 'The qualified response did not resolve the concern. The declared supply was used and twelve safety points were lost; regrouping and specialist handover remain available.' }] };
  if (specialist) {
    a.requires = { allTags: ['precision_support'], certs: ['precision_support'], minSquads: { count: 2, reason: 'Specialist support needs a separate supporting squad' } };
    a.consumes = undefined;
    a.support = { max: 7, maxSquads: 1, coverSpaceId: ctx.targetId, reachMinutes: 15, label: 'qualified protective support', task: 'Specialist support' };
    a.outcomePreview = {
      favorable: 'Qualified support completes the verified protective objective and receiving handover. A prepared inspection reduces the safety cost.',
      mixed: 'The supported response completes after delay, costing six safety points, or four after an inspection.',
      adverse: 'The supported response stalls, costing twelve safety points, or nine after an inspection. Regroup or hand over next.',
    };
    for (const [band, effect] of Object.entries(a.outcomes)) for (const entry of effect) if (entry.text) entry.text = band === 'favorable' ? 'Qualified specialist support completed the verified protective objective and receiving handover, with a two-point safety cost.' : band === 'mixed' ? 'The supported response and receiving handover completed after delay, with a six-point safety cost.' : 'The supported response did not complete the concern. Twelve safety points were lost; regrouping and handover remain possible.';
  } else {
    a.outcomePreview!.favorable += ' A prepared inspection reduces the safety cost by one point.';
    a.outcomePreview!.mixed += ' A prepared inspection reduces that loss to four.';
    a.outcomePreview!.adverse += ' A prepared inspection reduces that loss to nine.';
  }
  for (const [band, gain] of [['favorable', 1], ['mixed', 2], ['adverse', 3]] as const) a.outcomes[band].push({ when: { flags: ['protect_inspected'] }, civilian: gain, text: `The earlier opening inspection recovered ${gain} safety ${gain === 1 ? 'point' : 'points'} by resolving the view limitation before this response.` });
  return a;
}

function accessAndInspection(ctx: V3Context): ActionDefinition[] {
  const door = ctx.built.location.openings.find((opening) => opening.id === ctx.openingId);
  if (!door) return [];
  const charge = ctx.scenario.incident!.seed % 2 === 1 && ['hollow_core', 'solid_core'].includes(door.material ?? 'solid_core');
  const access = action(ctx, 'v3_protect_access', 'adapt', charge ? 'Use qualified single-use access' : 'Prepare qualified mechanical access', 'door', {
    favorable: 'Open the declared door so the team can check the remaining physical route. The single-use alternative also costs one supply and safety.',
    mixed: 'Open the declared door after delay; the opening enables inspection and a physical route check.',
    adverse: 'Access fails to establish a route. Supplies already committed are used; the ordinary route arrangement remains available.',
  }, {
    visibleWhen: { flags: ['protect_context_checked'], notFlags: ['protect_opening_ready'] },
    targetId: door.a === ctx.targetId ? door.b : door.a, approach: 'path',
    requires: { allTags: [charge ? 'door_charge' : 'rescue_tool'], certs: ['controlled_access'] },
    ...(charge ? { consumes: [{ tag: 'door_charge', qty: 1 }] } : {}),
    capabilities: { rules: ['permitted_door_access'], required: ['permitted_door_access'], openingId: door.id, accessMethod: charge ? 'charge' : 'mechanical', safetyFactIds: ['f_adjacent_safety'] },
    consequenceLevel: charge ? 'high' : 'moderate',
  });
  access.outcomes = {
    favorable: [{ setFlags: ['protect_opening_ready'], openings: [{ openingId: door.id, state: 'open' }], civilian: charge ? -2 : 0, pressure: charge ? 6 : 1, text: charge ? 'The fictional single-use access option opened the declared door for a subsequent route check, at a two-point safety cost.' : 'Qualified mechanical access opened the declared door for a subsequent physical route check.' }],
    mixed: [{ setFlags: ['protect_opening_ready'], openings: [{ openingId: door.id, state: 'open' }], extraMinutes: 3, civilian: charge ? -6 : -1, pressure: charge ? 8 : 2, text: 'The declared opening became accessible after delay. The opening now permits inspection; the team must still check the physical transfer route.' }],
    adverse: [{ pressure: 8, civilian: charge ? -12 : -3, text: 'The access attempt failed to prepare a route. The team can still arrange the ordinary transfer route or choose communication and handover.' }],
  };
  const inspect = action(ctx, 'v3_protect_inspect', 'adapt', 'Inspect the accessible opening', 'intel', {
    favorable: 'Check the open doorway with a qualified camera operator; a later qualified response has smaller safety losses.',
    mixed: 'Complete the inspection after extra time; the safety benefit still applies.',
    adverse: 'The inspection is inconclusive; the camera takes normal wear without establishing a safety benefit.',
  }, { visibleWhen: { flags: ['protect_opening_ready'] }, requires: { allTags: ['inspection_camera'], certs: ['drone_operator'] }, approach: 'path', check: { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.7 }, { key: 'coordination', weight: 0.3 }], difficulty: ctx.difficulty - 4 }, capabilities: { rules: ['opening_inspection'], required: ['opening_inspection'], openingId: door.id }, consequenceLevel: 'low' });
  inspect.outcomes = { favorable: [{ reveal: ['f_person', 'f_adjacent_safety'], setFlags: ['protect_inspected', 'protect_context_checked'], text: 'The accessible opening was checked and its limitations recorded. Any later qualified protective response will incur a smaller safety cost.' }], mixed: [{ reveal: ['f_person', 'f_adjacent_safety'], setFlags: ['protect_inspected', 'protect_context_checked'], extraMinutes: 3, text: 'Extra inspection time established the open-door context. Its safety benefit applies to a later qualified response.' }], adverse: [{ pressure: 4, text: 'The camera inspection was inconclusive. The camera took normal wear, but no later safety benefit was claimed.' }] };
  return [access, inspect];
}

