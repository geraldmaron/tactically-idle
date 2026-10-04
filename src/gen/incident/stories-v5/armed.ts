import type { ActionDefinition, Condition, FactDefinition, OutcomeEffect, ScenarioDefinition } from '../../../sim/scenario-types';
import type { BuiltLocation, StageId } from '../../../sim/types';
import { hashSeed } from '../../../sim/rng';
import { withHighRiskVersionFourChoices } from '../high-risk-v4';
import { actionHR, civilianCareHR, enterCareHR, factHR, finalizeHR, HR_BANDS, injuryHR, officerCareHR, partialHR, previewHR, reqFact, reqFlag, sameHR, visibleHR, type HighRiskContext } from '../high-risk-common-v4';

/** A route made entirely of existing doors; no new opening is invented by prose. */
export function storyDoorRoute(built: BuiltLocation, from: string, to: string, chair = false): string[] | null {
  const ground = new Set([...built.location.zones.map(z => z.id), ...built.location.rooms.filter(r => (r.floor ?? 0) === 0).map(r => r.id)]);
  const queue: { at: string; route: string[] }[] = [{ at: from, route: [] }];
  const seen = new Set([from]);
  while (queue.length) {
    const step = queue.shift()!;
    if (step.at === to) return step.route;
    for (const opening of built.location.openings) {
      if (!['door', 'doorway', 'sliding'].includes(opening.type)) continue;
      if (chair && (!ground.has(opening.a) || !ground.has(opening.b) || Math.hypot(opening.to.x - opening.from.x, opening.to.y - opening.from.y) < 3)) continue;
      const at = opening.a === step.at ? opening.b : opening.b === step.at ? opening.a : null;
      if (at && !seen.has(at)) { seen.add(at); queue.push({ at, route: [...step.route, opening.id] }); }
    }
  }
  return null;
}
export function storyOpenings(ids: string[]) {
  return ids.map(openingId => ({ openingId, blockedReason: 'This checked route is physically blocked. The person cannot complete this move.', lockedNote: 'The locked door adds time before this route can be used.' }));
}
export function personalFact(ctx: HighRiskContext, id: string, label: string, truth: boolean, claim: string, confirmed: string, disproved: string, hidden = true): FactDefinition {
  return { ...factHR(ctx, id, label, truth, claim, { confirmed, disproved }, hidden ? 'unknown' : 'reported'), showWhenUnknown: !hidden, uncertainty: claim,
    ...(hidden ? { source: null, note: null, uncertainty: 'This needs a current conversation or observation.' } : {}) };
}
/** Shared medical mechanics receive character-specific narration before namespace isolation. */
export function personalCare(ctx: HighRiskContext, name: string, safeFlag: string, careFlag: string, next: string): ActionDefinition[] {
  const actions = civilianCareHR(ctx, [careFlag]).filter(a => a.id !== 'hr_check_civilian_needs');
  const ambulance = ctx.scenario.externalServices!.find(s => s.id === 'civilian_ambulance')!;
  ambulance.label = `${name}’s receiving ambulance`;
  ambulance.description = `This crew can accept ${name}'s care after the completed move and agreement to assessment.`;
  const copy: Record<string, [string, string, string]> = {
    hr_civilian_request: [`Request an ambulance for ${name}`, ambulance.available ? `The crew can attend in ${ambulance.arrivalMinutes} operation minutes. Stay with ${name} until they receive them.` : 'Dispatch has no receiving ambulance available in this response window.', ambulance.available ? `The ambulance is responding for ${name}. Care stays with the team until the crew receives them.` : `Dispatch cannot provide an ambulance in this window. ${name}'s assessment is still pending.`],
    hr_civilian_wait: [`Wait with ${name} for the crew`, 'Stay through the remaining response time.', `The response time passes with ${name} still accompanied. The crew must receive them before care is accepted.`],
    hr_civilian_agreement: [`Ask ${name} about assessment`, 'Explain the available assessment and hear their decision.', `${name} agrees to medical assessment. The receiving crew still needs to accept care.`],
    hr_civilian_aid: [`Give ${name} first aid`, 'A qualified participating medic uses one assigned trauma kit for the recorded need.', `The medic gives ${name} first aid with one trauma kit. Professional assessment is still needed.`],
    hr_civilian_transfer: [`Transfer ${name} to the crew`, `The arrived crew receives ${name}. Any injured officer needs their own accepted receiver first.`, `The arrived ambulance crew receives ${name} and accepts care.`],
    hr_civilian_next_step: [`Agree ${name}’s next step`, 'Confirm the chosen next step after the completed move and current needs check.', next],
  };
  for (const action of actions) {
    const words = copy[action.id];
    if (!words) continue;
    [action.title, action.summary] = words; action.task = action.title; action.outcomePreview = previewHR(action.summary);
    for (const effects of Object.values(action.outcomes)) for (const effect of effects) if (effect.text) effect.text = words[2];
    if (action.id === 'hr_civilian_transfer') action.visibleWhen!.flags!.push('hr_care_agreed');
    if (action.id === 'hr_civilian_agreement') action.requires.flags = [reqFlag(safeFlag, `${name} must first complete the move to safety`)];
  }
  return actions;
}
export function personalOfficerCare(ctx: HighRiskContext): ActionDefinition[] {
  const actions = officerCareHR(ctx, 'resolve');
  const name = ctx.scenario.civilianOutcomes?.[0]?.label ?? 'the person';
  for (const action of actions) {
    if (action.id === 'hr_resolve_officer_continue') {
      action.summary = `Keep the hurt officer out of the team. Continue helping ${name} with the remaining officers; the medical transfer stays open.`;
      for (const effects of Object.values(action.outcomes)) for (const e of effects) if (e.text) e.text = `The injured officer stays out of action. The remaining officers resume helping ${name}; the officer still needs a receiving crew.`;
    }
    if (action.id === 'hr_resolve_officer_request') for (const effects of Object.values(action.outcomes)) for (const e of effects) if (e.text) e.text = ctx.scenario.externalServices!.find(s => s.id === 'officer_ambulance')!.available ? 'A separate ambulance is responding for the injured officer.' : 'Dispatch has no officer ambulance in this response window. The injured officer still needs care.';
  }
  return actions;
}
export function finishPersonalStory(s: ScenarioDefinition, prefix: string, partials: { id: string; when: Condition; title: string; text: string; remainingTasks: string[] }[], epilogue: OutcomeEffect[]): ScenarioDefinition {
  for (const partial of partials) s.endings[partial.id] = { ...structuredClone(s.endings.partial), id: partial.id, title: partial.title, summary: partial.text, remainingTasks: [...partial.remainingTasks] };
  for (const stage of Object.values(s.stages)) for (const action of stage.actions) for (const band of HR_BANDS) {
    const effects = action.outcomes[band];
    if (!effects.some(e => e.ending)) continue;
    if (effects.some(e => e.ending === 'partial')) {
      for (const e of effects) if (e.ending === 'partial') { delete e.ending; delete e.text; delete e.objective; }
      effects.unshift(...partials.map(p => ({ when: p.when, ending: p.id, objective: 20, text: p.text })));
      action.title = 'End with the progress made'; action.task = action.title;
      action.summary = 'Keep the actual location, injuries and outstanding care in the outcome.';
    }
    effects.push(...structuredClone(epilogue),
      { when: { flags: ['casualty:awaiting_transport'] }, text: 'The injured officer still needs an accepted medical transfer and remains out of action.' },
      { when: { flags: ['casualty:evacuated'] }, text: 'The separate medical crew has accepted the injured officer. That officer did not return to the team.' });
  }
  const fixedLabels: Record<string, string> = {
    hr_hear_eli: 'Accounts checked', hr_check_patrol: 'Accounts checked', hr_agreed_pause: 'Gunfire paused', hr_return_to_pause: 'Gunfire paused', hr_check_stand_down: 'Current conduct checked', hr_reach_eli: 'Eli reached', hr_bring_eli_out: 'Eli reached safety',
    hr_hear_jun: 'Jun heard', hr_reach_and_hear: 'Jun reached', hr_reach_jun: 'Jun reached', hr_check_chair_route: 'Chair route checked', hr_prepare_assistance: 'Assistance agreed', hr_check_reserved_vehicle: 'Vehicle checked', hr_reach_pickup_assistance: 'Pickup reached', hr_reach_pickup_vehicle: 'Pickup reached', hr_prepare_different_assistance: 'Different assistance agreed',
    hr_civilian_request: 'Dispatch answered', hr_civilian_wait: 'Wait completed', hr_civilian_agreement: 'Assessment agreed', hr_civilian_aid: 'First aid given', hr_civilian_transfer: 'Care accepted', hr_civilian_next_step: 'Next step agreed',
  };
  for (const stage of Object.values(s.stages)) for (const action of stage.actions) if (fixedLabels[action.id]) action.resultLabels = previewHR(fixedLabels[action.id]);
  finalizeHR(s);
  const text = JSON.stringify(s).replace(/hr_/g, `${prefix}_`).replace(/\bf_/g, `${prefix}_f_`)
    .replace(/\bcivilian_ambulance\b/g, `${prefix}_civilian_ambulance`).replace(/\bofficer_ambulance\b/g, `${prefix}_officer_ambulance`);
  return JSON.parse(text) as ScenarioDefinition;
}

const EPISODES = [
  { pause: true, standsDown: true, care: false },
  { pause: true, standsDown: false, care: true },
  { pause: false, standsDown: true, care: true },
] as const;

export function withArmedStory(input: ScenarioDefinition, built: BuiltLocation): ScenarioDefinition {
  if (input.incident?.type !== 'active_armed_incident' || built.location.familyId !== 'market_row') throw new Error('After the Noise needs the Market Row shop');
  const s = withHighRiskVersionFourChoices(structuredClone(input), built);
  const episode = EPISODES[hashSeed(`${input.incident.seed}:noise-v5`) % EPISODES.length];
  const ctx: HighRiskContext = { scenario: s, built, targetId: input.facts[0].spaceId, exteriorId: built.location.entries[0], difficulty: 31 + input.incident.tier * 3 };
  const route = storyDoorRoute(built, ctx.targetId, ctx.exteriorId);
  const requirements = storyOpenings(route ?? []);
  const make = (id: string, stage: StageId, title: string, summary: string, preview: string | ActionDefinition['outcomePreview'], extra: Partial<ActionDefinition> = {}) => actionHR(ctx, id, stage, title, summary, 'radio', typeof preview === 'string' ? previewHR(preview) : preview!, extra);
  s.version = 5; s.title = s.variantLabel = 'After the Noise';
  s.summary = 'Shop worker Eli Tran is trapped at Market Row during corroborated gunfire. The dispatcher last heard him counting the tills as if closing for the night. Grant is armed inside. Can the team stop the danger and get Eli out?';
  s.pressureLabel = 'Eli is still inside';
  s.briefing = {
    known: ['Eli Tran called from the shop and said he could not leave. The dispatcher last heard him counting the tills.', 'Patrol and Eli independently report current gunfire. Patrol identifies the armed person as Grant.', 'Grant’s reason for being there is unknown.'],
    unknown: ['Whether Grant will agree to stop shooting', 'What Eli needs in order to leave'],
    dispatchReason: 'Corroborated current gunfire puts an identified shop worker at immediate risk.',
    teamResponsibilities: ['Stop and verify the end of immediate danger', 'Reach Eli and help him outside', 'Arrange accepted care for actual injuries and current needs'],
  };
  s.facts = [
    personalFact(ctx, 'f_eli', 'Eli Tran, shop worker', true, 'Eli says he is trapped in the shop.', 'Eli is accounted for inside the shop.', 'Eli is elsewhere.', false),
    personalFact(ctx, 'f_gunfire', 'Gunfire at the first check', true, 'Patrol and Eli report current gunfire.', 'Patrol confirmed gunfire and Grant’s identity at the first check.', 'The gunfire report is unconfirmed.', false),
    personalFact(ctx, 'f_pause', 'Grant’s answer about a pause', episode.pause, 'Grant has not yet answered a request to stop.', 'Grant says he can stop shooting if the team keeps talking. He has not yet done so.', 'Grant gives no answer to the request to stop. Gunfire continues.'),
    personalFact(ctx, 'f_stand_down', 'First stand-down check after the pause', episode.standsDown, 'The silence has not yet been checked.', 'At the first check after the pause, patrol confirmed Grant had put the weapon down and moved away from it.', 'At the first check after the pause, Grant was still holding the weapon and had not answered the stand-down request.'),
    personalFact(ctx, 'f_route', 'The route to Eli', route !== null, 'The route to Eli needs a physical check.', 'The team has checked the existing doors between Eli and the outside.', 'No suitable connected doorway route to Eli is established.'),
    personalFact(ctx, 'f_care_needed', 'Eli’s additional reported symptom', episode.care, 'Ask Eli about his needs once he is outside.', 'Eli reports ringing ears and asks for assessment.', 'Eli reported no additional symptom. Any recorded injury still needs assessment.'),
  ];
  s.civilianOutcomes = [{ id: 'eli', label: 'Eli Tran', factId: 'f_eli', safeFlag: 'hr_eli_safe', injuredFlag: 'hr_eli_injured', careFlag: 'hr_eli_care' }];
  s.objectives = [{ id: 'danger', label: 'Verify the danger has ended' }, { id: 'eli', label: 'Help Eli outside' }, { id: 'care', label: 'Complete needed care' }];
  s.stages = {
    assess: { id: 'assess', label: 'Still counting', prompt: 'Eli is counting the tills. Patrol reports gunfire. Check the current accounts and whether Grant will answer.', actions: [] },
    adapt: { id: 'adapt', label: 'Stop the noise', prompt: 'Eli is still trapped. A checked pause takes longer; an urgent response needs qualified, equipped officers.', actions: [] },
    resolve: { id: 'resolve', label: 'The silence afterward', prompt: 'The gunfire stopped, but Eli has not come out. Check Grant’s present conduct before reaching Eli.', actions: [], contextPrompts: [
      { when: { flags: ['hr_injury_pause'] }, prompt: 'An officer is hurt and out of action. Their care interrupts the work still needed for Eli.' },
      { when: { flags: ['hr_care_mode', 'hr_care_required'] }, prompt: 'Eli is outside, but his medical care has not been accepted. Stay with him and arrange the receiving crew.' },
      { when: { flags: ['hr_care_mode'], notFlags: ['hr_care_required'] }, prompt: 'Eli is outside and reports no current medical need. Hear where he wants to wait next.' },
      { when: { flags: ['hr_eli_reached'], notFlags: ['hr_eli_safe'] }, prompt: 'Eli has stopped counting. He asks the team to keep talking to him until he is outside.' },
      { when: { flags: ['hr_danger_ended'], notFlags: ['hr_eli_reached'] }, prompt: 'Grant’s stand-down is verified. Eli is still inside; use an actually connected route to reach him.' },
      { when: { flags: ['hr_stand_down_missing'], notFlags: ['hr_danger_ended'] }, prompt: 'Grant still holds the weapon and has not answered. The silence does not establish a stand-down.' },
      { when: { flags: ['hr_response_failed'], notFlags: ['hr_silent'] }, prompt: 'Gunfire continues after the failed urgent response. Eli is injured; a previously offered pause may still be pursued.' },
    ] },
  };
  const checked: OutcomeEffect[] = [{ reveal: ['f_eli', 'f_gunfire', 'f_pause'], setFlags: ['hr_accounted'], stage: 'adapt' },
    { truth: [{ factId: 'f_pause', is: true }], text: 'Patrol confirms Eli and Grant are inside and gunfire is continuing. Grant answers the relayed request: he can stop if the team keeps talking. This is an offer, not a completed pause.' },
    { truth: [{ factId: 'f_pause', is: false }], text: 'Patrol confirms Eli and Grant are inside and gunfire is continuing. Grant does not answer the request for a pause. Eli is still counting the tills over the phone.' }];
  const hear = sameHR(make('hear_eli', 'assess', 'Stay on Eli’s call and check with patrol', 'Keep Eli’s connection open while patrol checks Grant’s current conduct and relays a request to stop.', 'Account for Eli, confirm the current gunfire and learn whether Grant will discuss a pause.', { workload: { base: 4, perSqFt: 0 } }), [...checked, { text: 'Eli counts one drawer twice. The dispatcher keeps listening without telling him the danger is over.' }]);
  const patrol = sameHR(make('check_patrol', 'assess', 'Compare dispatch and patrol’s accounts', 'Use the dispatcher’s call and patrol’s current observations; ask patrol to relay a pause request.', 'Check Eli’s reported location and whether Grant answers the pause request.', { icon: 'intel', workload: { base: 3, perSqFt: 0 } }), checked);
  s.stages.assess.actions = [hear, patrol, partialHR(ctx, 'assess')];
  const silence: OutcomeEffect = { setFlags: ['hr_silent'], stage: 'resolve', pressure: -8, text: 'The gunfire stops. Eli does not come out. On the still-open call, he begins counting the tills again.' };
  const pause = sameHR(make('agreed_pause', 'adapt', 'Stay with the offered pause', 'Give the checked exchange time. Grant must actually stop; his stand-down and Eli’s release remain separate.', 'The longer exchange stops the gunfire. Check Grant’s current conduct before reaching Eli.', { requires: { facts: [reqFact('f_pause', 'Grant must have offered to discuss a pause')] }, workload: { base: 10, perSqFt: 0 }, capabilities: { rules: [], deescalation: true }, tempo: 'waiting' }), [silence, { setFlags: ['hr_pause_kept'], text: 'The team keeps talking through the extended pause Grant offered. His motive remains unknown.' }]);
  const urgent = make('urgent_response', 'adapt', 'Commit the qualified urgent response', 'Use the deployed qualified team and its assigned serviceable equipment against the verified immediate danger.', { favorable: 'Stop the gunfire, then check Grant’s stand-down and reach Eli.', mixed: 'Stop the gunfire, but an officer is wounded. Eli remains inside while the team handles that casualty.', adverse: 'Gunfire continues. Eli and an officer are injured; the remaining team needs a different response.' }, {
    icon: 'shield', requires: { facts: [reqFact('f_gunfire', 'Confirm the current danger')], certs: ['entry_team'], anyTags: ['response_sidearm', 'response_carbine', 'response_shotgun'] },
    capabilities: { rules: ['authorized_response'], required: ['authorized_response'], responseContext: 'constrained' }, check: { kind: 'execution', ratings: [{ key: 'shooting', weight: 0.45 }, { key: 'composure', weight: 0.3 }, { key: 'coordination', weight: 0.25 }], difficulty: ctx.difficulty + 10 }, consequenceLevel: 'high', tempo: 'urgent', workload: { base: 4, perSqFt: 0 },
  });
  urgent.outcomes = { favorable: [silence, { setFlags: ['hr_urgent_used'] }], mixed: [silence, { setFlags: ['hr_urgent_used'] }, injuryHR('wounded', 'Wounded during the urgent response at Market Row')], adverse: [{ stage: 'resolve', setFlags: ['hr_urgent_used', 'hr_response_failed', 'hr_eli_injured', 'hr_care_required'], civilian: -10, text: 'The urgent response does not stop the gunfire. Eli is injured inside. The response cannot be repeated as if nothing changed.' }, injuryHR('serious', 'Seriously wounded during the failed Market Row response')] };
  s.stages.adapt.actions = [pause, urgent, partialHR(ctx, 'adapt')];
  const revised = sameHR(make('return_to_pause', 'resolve', 'Return to Grant’s offered conversation', 'With the injured officer out, use the longer pause Grant previously offered. The team keeps listening instead of repeating the failed response.', 'Follow the checked communication opportunity. Existing injuries remain and silence still needs verification.', { visibleWhen: visibleHR(['hr_response_failed'], ['hr_silent']), requires: { facts: [reqFact('f_pause', 'Grant must have offered a pause in the checked exchange')] }, workload: { base: 12, perSqFt: 0 }, tempo: 'waiting', capabilities: { rules: [], deescalation: true } }), [silence, { setFlags: ['hr_pause_kept'], text: 'The remaining team returns to the conversation Grant offered. The longer exchange stops the gunfire; neither injury is erased.' }]);
  const verify = sameHR(make('check_stand_down', 'resolve', 'Check Grant’s stand-down now', 'Ask patrol for Grant’s current conduct. A quiet shop does not prove the weapon is no longer a danger.', 'Establish either a verified stand-down or the specific reason it remains incomplete.', { visibleWhen: visibleHR(['hr_silent'], ['hr_stand_down_checked']), icon: 'intel' }), [
    { reveal: ['f_stand_down'], setFlags: ['hr_stand_down_checked'] },
    { truth: [{ factId: 'f_stand_down', is: true }], setFlags: ['hr_danger_ended'], text: 'Patrol confirms Grant has put the weapon down and moved away from it. The immediate danger has ended. Eli is still inside.' },
    { truth: [{ factId: 'f_stand_down', is: false }], setFlags: ['hr_stand_down_missing'], text: 'Patrol reports Grant still holding the weapon. He has not answered the stand-down request. Silence alone has not made it safe to reach Eli.' },
  ]);
  const clarify = make('clarify_stand_down', 'resolve', 'Ask Grant to complete the stand-down', 'Keep the exchange focused on the weapon and his present conduct. Do not make a promise about the investigation.', { favorable: 'Grant puts the weapon down and patrol verifies the stand-down.', mixed: 'Grant completes the verified stand-down after a longer exchange.', adverse: 'Grant keeps holding the weapon and stops answering. Eli cannot yet be reached safely.' }, { visibleWhen: visibleHR(['hr_stand_down_missing'], ['hr_danger_ended']), workload: { base: 8, perSqFt: 0 }, capabilities: { rules: [], deescalation: true } });
  const down: OutcomeEffect = { setFlags: ['hr_danger_ended'], pressure: -5, text: 'Grant puts the weapon down and moves away; patrol verifies the change. The team makes no promise about his case. Eli still has not left.' };
  clarify.outcomes = { favorable: [down], mixed: [down, { extraMinutes: 4, text: 'Grant answers only after a long gap. Eli remains on the open call throughout the wait.' }], adverse: [{ setFlags: ['hr_stand_down_failed'], text: 'Grant keeps the weapon and stops answering. No stand-down is claimed. Eli remains inside.' }] };
  const reach = sameHR(make('reach_eli', 'resolve', 'Reach Eli and hear what he needs', 'Use the real doorway route after the stand-down. Let Eli hear that help has actually reached him.', 'Reach Eli and agree the immediate help he asks for. He is not yet outside.', { icon: 'search', visibleWhen: visibleHR(['hr_danger_ended'], ['hr_eli_reached']), requires: { flags: [reqFlag('hr_danger_ended', 'Verify the current stand-down')], openings: requirements }, approach: 'path', workload: { base: 5, perSqFt: 0.01 } }), [
    { reveal: ['f_route'] }, { truth: [{ factId: 'f_route', is: true }], setFlags: ['hr_eli_reached', 'hr_voice_promised'], text: 'The team reaches Eli through the checked doors. He stops counting. “You’re really here. Please keep talking until we’re outside.” The team agrees to stay beside him and keep speaking.' },
  ]);
  const out = sameHR(make('bring_eli_out', 'resolve', 'Stay beside Eli on the way out', 'Keep the agreed conversation going over the checked route. Ask about immediate care needs when Eli reaches patrol.', 'Eli reaches safety with the promised company. His current needs are checked at arrival.', { icon: 'shield', visibleWhen: visibleHR(['hr_eli_reached'], ['hr_eli_safe']), requires: { flags: [reqFlag('hr_danger_ended', 'The immediate danger must have ended'), reqFlag('hr_eli_reached', 'Physically reach Eli first')], facts: [reqFact('f_route', 'Check an actual usable route')], openings: requirements }, targetId: ctx.exteriorId, approach: 'path', workload: { base: 5, perSqFt: 0.01 } }), [
    { setFlags: ['hr_eli_safe', 'hr_people_safe', 'hr_primary_complete', 'hr_voice_kept', 'hr_care_checked'], reveal: ['f_care_needed'], text: 'Eli reaches patrol outside. The team stays beside him and keeps talking all the way, as promised. He is no longer counting.' },
    { truth: [{ factId: 'f_care_needed', is: true }], setFlags: ['hr_care_required'], text: 'Eli says his ears are ringing and asks for medical assessment.' },
    { truth: [{ factId: 'f_care_needed', is: false }], when: { notFlags: ['hr_eli_injured'] }, text: 'Eli reports no current medical need.' },
    { when: { flags: ['hr_eli_injured'] }, text: 'Eli’s recorded injury still needs medical assessment; reaching the outside has not completed his care.' }, ...enterCareHR(),
  ]);
  s.stages.resolve.actions = [revised, verify, clarify, reach, out, partialHR(ctx, 'resolve'), ...personalOfficerCare(ctx), ...personalCare(ctx, 'Eli', 'hr_eli_safe', 'hr_eli_care', 'Eli chooses to sit with patrol before speaking to the shop manager. He does not return to the tills.')];
  s.endings.protection_complete.title = 'Eli leaves the tills';
  s.endings.protection_complete.summary = 'Eli Tran is safely outside and chooses to sit with patrol before speaking to the shop manager. He reports no current medical need. Any injured officer has reached a medical receiver. Grant’s investigation remains open.';
  s.endings.care_accepted.title = 'Eli’s care is accepted';
  s.endings.care_accepted.summary = 'Eli Tran is outside and the receiving ambulance has accepted his care. Any injured officer has reached a separate medical receiver. Grant’s stand-down is verified; his investigation remains open.';
  s.endings.partial.remainingTasks = ['Complete Eli’s unfinished move and current danger checks', 'Complete any needed civilian or officer care'];
  return finishPersonalStory(s, 'v5_noise', [
    { id: 'eli_inside', when: { notFlags: ['hr_eli_reached', 'hr_eli_safe'] }, title: 'Eli is still inside', text: 'Eli Tran remains inside the shop and has not been reached. His protection is unfinished.', remainingTasks: ['Reach Eli and complete his move outside', 'Complete any outstanding danger checks', 'Complete any needed civilian care', 'Complete any outstanding officer care'] },
    { id: 'eli_reached', when: { flags: ['hr_eli_reached'], notFlags: ['hr_eli_safe'] }, title: 'Eli is reached, but still inside', text: 'The team reached Eli Tran and heard what he needs, but his move outside is unfinished.', remainingTasks: ['Complete Eli’s move outside', 'Complete any needed civilian care', 'Complete any outstanding officer care'] },
    { id: 'eli_care_pending', when: { flags: ['hr_eli_safe', 'hr_care_required'] }, title: 'Eli is outside; care is pending', text: 'Eli Tran is outside. His medical care has not been accepted by a receiving crew.', remainingTasks: ['Arrange accepted medical care for Eli', 'Complete any outstanding officer care'] },
    { id: 'eli_next_pending', when: { flags: ['hr_eli_safe'], notFlags: ['hr_care_required'] }, title: 'Eli is outside; next steps are open', text: 'Eli Tran is outside and reports no current medical need. His next step or recorded officer care remains unfinished.', remainingTasks: ['Agree Eli’s next step', 'Complete any outstanding officer care'] },
  ], [
    { when: { flags: ['hr_eli_injured'], notFlags: ['hr_eli_care'] }, text: 'Eli’s recorded injury still needs accepted care.' },
    { when: { flags: ['hr_voice_kept'] }, text: 'The team kept talking beside Eli until he was outside, as he asked.' },
    { when: { flags: ['hr_danger_ended'] }, text: 'Grant’s immediate stand-down was verified. Nothing here resolves his criminal case.' },
    { when: { notFlags: ['hr_danger_ended'] }, text: 'Grant’s stand-down has not been verified.' },
  ]);
}
