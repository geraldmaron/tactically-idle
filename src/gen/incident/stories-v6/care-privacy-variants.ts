import { scenarioActions, type ActionDefinition, type OutcomeEffect, type ScenarioDefinition } from '../../../sim/scenario-types';
import type { BuiltLocation, OutcomeBand } from '../../../sim/types';
import type { AppliedEpisodeModule } from './episode-plan';

const BANDS: OutcomeBand[] = ['favorable', 'mixed', 'adverse'];
const preview = (text: string) => ({ favorable: text, mixed: text, adverse: text });
function action(s: ScenarioDefinition, id: string): ActionDefinition {
  const found = scenarioActions(s).find(a => a.id === id);
  if (!found) throw new Error(`V6 care/privacy variation needs ${id}`);
  return found;
}
function copyAction(source: ActionDefinition, id: string): ActionDefinition {
  const copy = JSON.parse(JSON.stringify(source).replaceAll(`used:${source.id}`, `used:${id}`)) as ActionDefinition;
  copy.id = id;
  return copy;
}
function words(a: ActionDefinition, title: string, summary: string): void { a.title = a.task = title; a.summary = summary; }
function same(a: ActionDefinition, effects: OutcomeEffect[]): void {
  for (const band of BANDS) a.outcomes[band] = [{ setFlags: [`used:${a.id}`], ...(a.stage === 'resolve' ? { stage: 'resolve' as const } : {}) }, ...structuredClone(effects)];
}
function append(a: ActionDefinition, effect: OutcomeEffect): void {
  for (const band of BANDS) a.outcomes[band].push(structuredClone(effect));
}
function remove(s: ScenarioDefinition, ids: string[]): void {
  for (const stage of Object.values(s.stages)) stage.actions = stage.actions.filter(a => !ids.includes(a.id));
}

/** Two actual receivers make the early request a commitment with a real clock. */
function medical(s: ScenarioDefinition, built: BuiltLocation, variant: number): AppliedEpisodeModule {
  const p = 'v5_assistance_';
  const id = (name: string) => p + name;
  const exterior = built.location.zones.find(z => z.id === s.story!.bindings.exterior.arrival.spaceId);
  if (!exterior) throw new Error('Rosa needs an actual exterior receiving place');
  const insideMinutes = variant === 1 ? 6 : variant === 2 ? 20 : 16;
  const outsideMinutes = variant === 1 ? 14 : variant === 2 ? 9 : 6;
  const insideCrew = s.externalServices!.find(service => service.id === id('rosa_crew'))!;
  insideCrew.label = 'Rosa’s mobile team for assessment inside';
  insideCrew.available = true;
  insideCrew.arrivalMinutes = insideMinutes;
  insideCrew.description = `This team can enter the shop to assess Rosa after a ${insideMinutes}-minute response. The actual inside route, her agreement and her own keys still matter.`;
  insideCrew.acceptWhen = { ...insideCrew.acceptWhen, flags: [...insideCrew.acceptWhen!.flags!, id('onsite')] };
  const outsideCrew = { ...structuredClone(insideCrew), id: id('outside_crew'), label: `Rosa’s receiving crew at ${exterior.label}`, arrivalMinutes: outsideMinutes,
    description: `These clinicians staff the incident’s receiving point at ${exterior.label} after a ${outsideMinutes}-minute response and must stay there to receive arrivals. A separate mobile team handles assessments inside; Rosa must agree to and complete the checked move to this receiving point.`,
    acceptWhen: { flags: [id('rosa_safe'), id('assessment_agreed'), id('keys_with_rosa'), id('outside'), id('shop_locked')], facts: [{ factId: id('safe_access'), in: ['confirmed' as const] }] } };
  s.externalServices = [insideCrew, outsideCrew];
  const context = `Dispatch offers a mobile inside assessment team in ${insideMinutes} minutes or clinicians staffing the receiving point at ${exterior.label} in ${outsideMinutes} minutes. Those clinicians must remain at that point to receive arrivals. Rosa keeps her keys with either choice; nobody has accepted her care yet.`;
  const freshAir = variant === 1;
  s.summary = `Rosa Bell, the cleaner, reports dizziness after the immediate threat at the shop ended. She still holds the keys and has not agreed to an assessment. ${freshAir ? 'She told patrol the shop feels oppressive and asked about waiting outside.' : 'She told patrol she can lock the exit herself but is worried about leaving before someone checks her.'} Dispatch has two different receiving arrangements available.`;
  s.briefing.known = [
    'Patrol reports that the immediate threat has ended; current medical access still needs checking.',
    'Rosa Bell, an adult cleaner, reports dizziness. This is a symptom report, not a diagnosis.',
    'Rosa has her own working mobile and the shop keys. She can lock the exit behind her and retain them; no employer permission is needed for medical help.',
    ...(freshAir ? ['Rosa has told patrol she would prefer fresh air, if she accepts the move. An assessment inside can begin sooner.'] : []),
  ];
  s.briefing.unknown = ['Which assessment arrangement Rosa will accept', 'Whether the actual route is currently usable'];
  s.stages.assess.prompt = 'Start one receiving team’s response now, or hear Rosa first before choosing where assessment can begin.';
  s.stages.adapt.prompt = `Rosa can keep the keys and receive assessment inside, or lock up herself and meet the separate crew at ${exterior.label}. Her own agreement decides the place.`;
  s.stages.adapt.contextPrompts = [
    { when: { flags: [id('misunderstood')] }, prompt: 'Rosa is worried that accepting assessment commits her to leaving later. Explain the limit, or ask whether she accepts the outside arrangement instead.' },
    { when: { flags: [id('rosa_heard')] }, prompt: `Rosa wants assessment and can lock the exit herself. Inside care avoids the move; assessment at ${exterior.label} uses the other crew. An earlier request only advances that crew’s own clock.` },
  ];
  s.stages.resolve.contextPrompts = [
    { when: { flags: [id('outside')] }, prompt: `Rosa is at ${exterior.label} with her own keys. Only the crew assigned to that exterior can accept this handover.` },
    { when: { flags: [id('onsite')] }, prompt: 'Rosa accepted assessment inside with her keys retained. The team assigned to enter the shop must arrive and follow the currently usable route.' },
  ];
  // The supervisor is no longer a compulsory branch, nor a hidden source of permission.
  remove(s, [id('call_supervisor')]);
  s.facts = s.facts.filter(f => f.id !== id('supervisor_answers'));
  const concern = s.facts.find(f => f.id === id('keys_concern'))!;
  concern.resolved!.confirmed = 'Rosa wants the dizziness checked and can lock the exit behind her while keeping the keys. She has not yet chosen whether to be assessed inside or outside.';
  for (const stage of ['assess', 'adapt'] as const) {
    const hear = action(s, id(`hear_rosa_${stage}`));
    for (const band of BANDS) for (const effect of hear.outcomes[band]) if (effect.setFlags?.includes(id('rosa_heard'))) {
      effect.setFlags.push(id('lock_plan'));
      effect.text = `Rosa says she wants the dizziness checked. She can lock the exit behind her and keep the keys; she has not accepted either assessment arrangement yet.${freshAir ? ' She says fresh air would help her feel less trapped, but understands the inside team is nearer.' : ''} Patrol confirms no immediate threat on the medical route; physical obstructions still matter.`;
    }
  }
  const earlyOriginal = action(s, id('request_crew_early'));
  const earlyActions = [false, true].map(outside => {
    const service = outside ? outsideCrew : insideCrew;
    const requested = id(outside ? 'outside_crew_requested' : 'inside_crew_requested');
    const early = copyAction(earlyOriginal, id(outside ? 'request_outside_early' : 'request_inside_early'));
    words(early, outside ? `Request the crew at ${exterior.label} first` : 'Request the team that can assess Rosa inside', `Start this ${service.arrivalMinutes}-minute response while patrol checks current safety. ${outside ? 'Rosa must still agree to lock up and reach the actual exterior.' : 'Rosa must still agree to an inside assessment; the team needs an unblocked route.'} Choosing the other arrangement later starts that other crew’s clock then.`);
    early.outcomePreview = preview('Begin this receiver’s actual response without assuming Rosa’s consent or completing a handover.');
    same(early, [{ reveal: [id('rosa'), id('safe_access')], setFlags: [id('rosa_safe'), id('route_checked'), id('early_request'), id('crew_requested'), requested], requestSupport: [service.id], stage: 'adapt', text: `Dispatch starts the ${service.arrivalMinutes}-minute response for ${outside ? `the crew at ${exterior.label}` : 'the team able to enter the shop'}. Rosa remains inside with her keys; her own agreement is still needed. The other receiver has not been requested.` }]);
    return early;
  });
  s.stages.assess.actions.splice(s.stages.assess.actions.indexOf(earlyOriginal), 1, ...earlyActions);
  const here = action(s, id('offer_here'));
  words(here, 'Offer the inside assessment and keep the keys with Rosa', `The ${insideMinutes}-minute team can assess Rosa where she is sitting. She keeps her keys and avoids the move. If it was not requested earlier, its response starts after her agreement.`);
  here.outcomePreview!.favorable = 'Rosa agrees to assessment inside with the keys retained; any later clinical recommendation remains a separate choice.';
  for (const name of ['offer_here', 'clarify_assessment']) {
    const a = action(s, id(name));
    for (const band of BANDS) {
      a.outcomes[band] = a.outcomes[band].filter(effect => !effect.when?.flags?.includes(id('supervisor_called')) && !effect.when?.flags?.includes(id('early_request')));
      for (const effect of a.outcomes[band]) if (effect.requestSupport?.includes(insideCrew.id)) {
        effect.when = { notFlags: [id('inside_crew_requested')] };
        effect.setFlags = [id('inside_crew_requested'), id('crew_requested')];
        effect.text = `The team able to assess Rosa inside is requested now. Its ${insideMinutes}-minute response begins; an earlier exterior request cannot receive her inside.`;
      }
    }
  }
  const clarify = action(s, id('clarify_assessment'));
  clarify.outcomePreview!.adverse = 'Rosa still declines this inside offer. She can consider the outside arrangement, and immediate aid remains possible.';
  clarify.outcomes.adverse.at(-1)!.text = 'Rosa still does not accept the clarified inside offer. No consent or clinical transfer is claimed. The outside arrangement and any immediate assistance remain available for her to consider.';
  for (const a of scenarioActions(s)) if (a.id.startsWith(id('aid_rosa_'))) a.outcomePreview = preview('Use one real kit for immediate aid with Rosa’s agreement. Her receiving assessment remains a separate unfinished need; she keeps the keys.');
  s.endings[id('partial')].summary = 'Rosa’s actual location, agreement and help remain recorded. A receiving crew has not accepted her care; no key transfer or completed clinical assessment is assumed.';
  const outside = action(s, id('lock_and_step_out'));
  words(outside, `Agree the outside assessment and accompany Rosa to ${exterior.label}`, `Ask whether Rosa accepts locking the exit herself, keeping its keys and meeting the ${outsideMinutes}-minute crew at ${exterior.label}. Complete that checked move only with her agreement.${freshAir ? ' She prefers fresh air, though this crew takes longer.' : ''}`);
  outside.outcomePreview = preview('Rosa agrees, locks the exit and reaches the actual exterior with her own keys. That crew must still arrive and accept her care.');
  same(outside, [
    { setFlags: [id('outside'), id('shop_locked'), id('keys_with_rosa'), id('assessment_agreed')], clearFlags: [id('misunderstood')], storyExitState: 'locked', stage: 'resolve', ...(freshAir ? { pressure: -12 } : {}), text: `Rosa accepts the outside assessment, locks the exit behind her and reaches ${exterior.label} with the keys in her pocket.${freshAir ? ' Being outside eases her distress while she waits for the slower crew.' : ''} Nobody takes her keys or decides later treatment for her.` },
    { when: { notFlags: [id('outside_crew_requested')] }, requestSupport: [outsideCrew.id], setFlags: [id('outside_crew_requested'), id('crew_requested')], text: `The separate exterior crew is requested now. Its ${outsideMinutes}-minute response begins; an earlier inside-team request cannot stand in for this handover.` },
  ]);
  const outsideReceive = action(s, id('receive_outside'));
  outsideReceive.requires.externalSupport = [{ serviceId: outsideCrew.id, status: 'available', reason: `The receiving crew assigned to ${exterior.label} must actually arrive` }];
  for (const band of BANDS) for (const effect of outsideReceive.outcomes[band]) if (effect.acceptSupport) effect.acceptSupport = [outsideCrew.id];
  s.endings[id('care_outside')].completion!.acceptedServiceId = outsideCrew.id;
  const waitOriginal = action(s, id('wait_with_rosa'));
  const waits = [false, true].map(outside => {
    const service = outside ? outsideCrew : insideCrew;
    const wait = copyAction(waitOriginal, id(outside ? 'wait_outside_crew' : 'wait_inside_crew'));
    wait.visibleWhen = { flags: [id(outside ? 'outside' : 'onsite')], notFlags: [`used:${wait.id}`] };
    wait.requires.externalSupport = [{ serviceId: service.id, status: 'requested', reason: 'This chosen receiver must actually be responding' }];
    wait.awaitSupport = service.id;
    words(wait, outside ? 'Keep contact at the exterior while its crew responds' : 'Keep contact while the inside team responds', 'Wait through this receiver’s remaining response. A different requested team does not finish this clock or accept Rosa’s care.');
    same(wait, [{ text: `The crew assigned to ${outside ? exterior.label : 'assessment inside the shop'} arrives. Rosa still needs its actual acceptance, with the keys retained.` }]);
    return wait;
  });
  s.stages.resolve.actions.splice(s.stages.resolve.actions.indexOf(waitOriginal), 1, ...waits);
  if (variant === 2) {
    const accepted = 'Patrol has already heard Rosa accept assessment inside the shop with her keys retained. Starting that response can follow her existing choice; using the sooner exterior crew still needs her agreement to that different move.';
    s.summary = 'Rosa Bell, the cleaner, reports dizziness after the immediate threat at the shop ended. She has already told patrol she accepts assessment inside while keeping her keys. That receiving team is delayed. A sooner crew can meet her at the exterior, but Rosa has not agreed to lock up and leave for that alternative.';
    s.briefing.unknown = ['Whether Rosa would prefer the sooner outside assessment instead', 'Whether the actual medical route remains usable'];
    s.stages.assess.prompt = 'Start the delayed inside assessment Rosa has already accepted, or ask her about the sooner crew outside. Her original choice does not need to be negotiated again.';
    s.stages.adapt.prompt = 'Rosa has already accepted assessment inside. Keep that arrangement, or ask whether she chooses the sooner outside crew and complete the move she accepts.';
    s.stages.adapt.contextPrompts = [];
    const need = s.facts.find(f => f.id === id('assessment_needed'))!;
    need.initial = 'confirmed';
    need.resolved!.confirmed = 'Patrol heard Rosa accept assessment inside the shop while retaining her keys. The exterior alternative is not yet agreed.';
    for (const stage of ['assess', 'adapt'] as const) {
      const hear = action(s, id(`hear_rosa_${stage}`));
      words(hear, 'Discuss the sooner outside crew with Rosa', 'Rosa has already accepted assessment inside. Take time to hear whether she would prefer the sooner exterior arrangement and confirm her own plan for retaining the keys.');
      for (const band of BANDS) for (const effect of hear.outcomes[band]) if (effect.setFlags?.includes(id('rosa_heard'))) effect.text = 'Rosa confirms she wants the dizziness checked and still accepts the inside assessment. She can also lock the exit herself and keep the keys, and will consider the outside alternative. Patrol checks present medical safety; physical obstructions still matter.';
    }
    const agreedRequest = action(s, id('request_inside_early'));
    words(agreedRequest, 'Start the inside assessment Rosa already accepted', `Follow Rosa’s stated choice and request the ${insideMinutes}-minute team able to enter the shop. Patrol checks current safety while she waits with the keys; the actual route and receiving acceptance remain open.`);
    agreedRequest.outcomePreview = preview('Start the actual inside response on Rosa’s already-recorded agreement. No repeated consent conversation or completed handover is assumed.');
    append(agreedRequest, { reveal: [id('assessment_needed'), id('keys_concern')], setFlags: [id('rosa_heard'), id('lock_plan'), id('onsite'), id('assessment_agreed'), id('keys_with_rosa')], stage: 'resolve', text: 'The team follows the inside assessment Rosa already accepted through patrol, with the keys kept in her hand. The receiving response is running; the crew must still arrive and reach her before it can accept her care.' });
    for (const band of BANDS) for (const effect of agreedRequest.outcomes[band]) if (effect.requestSupport) effect.text = 'Dispatch starts the delayed inside team’s response while patrol confirms present medical safety. Rosa’s existing agreement is preserved; her care is not yet accepted.';
    words(here, 'Keep Rosa’s accepted inside assessment', `After discussing the alternative, follow Rosa’s existing inside choice and start the ${insideMinutes}-minute response if needed. She keeps the keys and avoids a move.`);
    here.outcomePreview = preview('Follow Rosa’s already-accepted inside assessment. The actual team still needs to arrive and receive her.');
    const agreedHere = structuredClone(here.outcomes.favorable);
    for (const band of BANDS) here.outcomes[band] = structuredClone(agreedHere);
    remove(s, [id('clarify_assessment')]);
    return { variantId: 'inside-assessment-already-accepted', modules: ['receiver-place-commitment', 'existing-care-agreement'], publicContext: [context, accepted] };
  }
  return { variantId: freshAir ? 'nearer-inside-preferred-air' : 'two-receiving-places', modules: ['receiver-place-commitment', 'rosa-keeps-keys'], publicContext: [context, ...(freshAir ? ['Rosa’s stated preference for fresh air can ease pressure after the actual move, but the exterior receiver takes longer.'] : [])] };
}

/** A bad result may change Mina's answer, never the promise the player chose. */
function honestAgreement(s: ScenarioDefinition): void {
  const p = 'v5_protective_';
  for (const name of ['agree_separate_conversation', 'withdraw_group_proposal']) {
    const a = action(s, p + name);
    a.outcomePreview!.adverse = 'Mina is not yet ready to trust the arrangement. No agreement is recorded; a further private explanation remains possible.';
    a.outcomes.adverse = [{ setFlags: [`used:${a.id}`, p + 'agreement_failed'], stage: 'resolve', text: 'Mina says she is still worried Cal will demand her account afterward and declines to leave yet. The team keeps its promise that sharing anything is her choice. The checked arrangements remain useful, but her consent has not been obtained.' }];
  }
  const clarify = action(s, p + 'clarify_no_shared_account');
  words(clarify, 'Give Mina time to reconsider the same private agreement', 'Keep the promise already made: Mina decides whether anything is shared with Cal. Hear her concern and ask whether she now accepts the separate conversation.');
  clarify.outcomePreview = { favorable: 'Mina decides the existing privacy promise is enough and agrees to leave.', mixed: 'Mina accepts the same promise after a longer pause.', adverse: 'Mina still declines. Her answer is respected and the agreed exit remains incomplete.' };
  for (const band of ['favorable', 'mixed'] as const) for (const effect of clarify.outcomes[band]) if (effect.setFlags?.includes(p + 'agreement_repaired')) effect.text = band === 'mixed'
    ? 'Mina takes more time, then accepts the same promise: she controls any later account to Cal. No new disclosure has been offered.'
    : 'Mina accepts the existing promise that she controls any later account to Cal. The team has not changed her chosen privacy boundary.';
  clarify.outcomes.adverse.at(-1)!.text = 'Mina still declines the same private arrangement. She stays inside; the team records the unfinished exit without inventing consent or a promise to her brother.';
  for (const prompt of s.stages.resolve.contextPrompts ?? []) if (prompt.when.flags?.includes(p + 'agreement_failed')) prompt.prompt = 'Mina remains worried about demands from Cal afterward. Keep the same privacy promise and give her another chance to decide.';
}

function finishPrivateConversation(s: ScenarioDefinition): void {
  const p = 'v5_protective_';
  const talk = action(s, p + 'talk_separately');
  // The needs conversation outside has already made this branch public. Keep
  // its medical request distinct from the no-care completion in authored effects.
  const careTalk = copyAction(talk, p + 'talk_before_assessment');
  careTalk.visibleWhen = { ...careTalk.visibleWhen, facts: [{ factId: p + 'care_needed', in: ['confirmed'] }] };
  careTalk.requires.facts = [{ factId: p + 'care_needed', in: ['confirmed'], reason: 'Mina must first have asked for assessment herself' }];
  words(careTalk, 'Hear Mina privately, then ask about her requested assessment', 'Complete the separate conversation Mina chose, then ask whether she accepts the wrist assessment she requested. An agreed request starts her receiving crew’s response; actual acceptance still comes later.');
  for (const band of BANDS) careTalk.outcomes[band] = careTalk.outcomes[band].filter(effect => !effect.truth?.some(truth => truth.factId === p + 'care_needed' && !truth.is));
  s.stages.resolve.actions.splice(s.stages.resolve.actions.indexOf(talk) + 1, 0, careTalk);
  talk.visibleWhen = { ...talk.visibleWhen, facts: [{ factId: p + 'care_needed', in: ['disproved'] }] };
  talk.requires.facts = [{ factId: p + 'care_needed', in: ['disproved'], reason: 'Mina’s requested assessment needs the private care conversation instead' }];
  for (const band of BANDS) talk.outcomes[band] = talk.outcomes[band].filter(effect => !effect.requestSupport);
  talk.summary = 'Listen privately to what Mina chooses to tell the team. If she needs no assessment, honor her choice to stay with the follow-up officer now; requested care still needs a real receiver.';
  talk.outcomePreview = preview('Complete the separate conversation and Mina’s chosen non-medical follow-through. A requested assessment or outstanding officer care remains open.');
  append(talk, { truth: [{ factId: p + 'care_needed', is: false }], setFlags: [p + 'next_step_completed'], text: 'Mina chooses to stay with the follow-up officer separately from Cal, and the officer accepts that arrangement as the conversation ends.' });
  const completed: OutcomeEffect = { truth: [{ factId: p + 'care_needed', is: false }], when: { notFlags: ['casualty:untreated', 'casualty:awaiting_transport'] }, ending: p + 'private', objective: 100, text: 'The private conversation and Mina’s chosen next step are complete. Cal has not been promised her account; no family reconciliation is assumed.' };
  append(talk, completed);
  // If the conversation occurred during a casualty duty, the actual officer transfer closes it.
  append(action(s, p + 'receive_officer'), { ...completed, when: { flags: [p + 'private_conversation', p + 'next_step_completed'] } });
  remove(s, [p + 'honor_next_step']);
  const partial = s.endings[p + 'partial_next_step'];
  partial.title = 'Mina heard; officer care remains';
  partial.summary = 'Mina has spoken privately and remains with the follow-up officer as she chose. She reports no current medical complaint. An injured officer’s accepted care remains unfinished.';
  partial.remainingTasks = ['Complete the outstanding officer care'];
  for (const a of scenarioActions(s)) for (const effects of Object.values(a.outcomes)) for (const effect of effects) if (effect.ending === p + 'partial_next_step') effect.text = partial.summary;
  s.stages.resolve.contextPrompts = s.stages.resolve.contextPrompts?.filter(prompt => !prompt.when.flags?.includes(p + 'chosen_next_step'));
}

function protective(s: ScenarioDefinition, _built: BuiltLocation, variant: number): AppliedEpisodeModule {
  const p = 'v5_protective_';
  honestAgreement(s);
  finishPrivateConversation(s);
  const apart = action(s, p + 'ask_cal_wait_apart');
  if (variant === 0) {
    const calFirst = action(s, p + 'ask_cal_first');
    words(calFirst, 'Offer to put Cal’s joint-conversation request to Mina', 'Hear Cal’s quick account while patrol checks the exit. Tell him you will ask Mina about his proposed joint conversation; she has not agreed, and may need that proposal withdrawn before accepting a separate conversation.');
    // Requesting a camera stop and arranging actual separation are alternative commitments.
    apart.visibleWhen!.flags = [p + 'mina_heard'];
    apart.workload.base = 6;
    apart.summary = 'Take six minutes to ask Cal to wait out of sight with patrol, without first trying a camera-only request. Observe whether he actually moves; Mina still decides whether she accepts.';
    s.stages.adapt.prompt = 'Try the shorter request for an observed camera stop, or spend more time arranging Cal’s physical separation. Mina’s own agreement and the real exit still matter.';
    s.stages.adapt.contextPrompts = s.stages.adapt.contextPrompts?.map(prompt => prompt.when.flags?.includes(p + 'mina_heard') && prompt.when.notFlags?.includes(p + 'privacy_ready')
      ? { ...prompt, prompt: 'Mina wants a separate conversation. Ask Cal to stop recording and observe the response, or ask him directly to wait out of sight with patrol.' } : prompt);
    return { variantId: 'camera-or-physical-separation', modules: ['privacy-arrangement-choice', 'honor-private-followthrough'], publicContext: ['Patrol can witness a shorter request for Cal to stop recording, or spend longer asking him to wait out of sight. Neither request guarantees his response or Mina’s agreement.'] };
  }
  const routeAlreadyChecked = variant === 1;
  const context = `Patrol has already taken Cal to wait apart, out of sight of Mina’s exit and conversation. ${routeAlreadyChecked ? 'Its current check also finds no immediate threat and a usable exit.' : 'Present danger and the exit still need an independent check.'} Mina has not agreed to come outside.`;
  s.summary = `Mina Voss offered to leave her home after officers corroborated an earlier assault and threat, then stepped back inside. Patrol has already taken her brother Cal to wait apart, out of sight of the exit. ${routeAlreadyChecked ? 'Patrol’s current exit check finds no immediate threat and a usable path.' : 'The present exit still needs checking.'} Mina still decides whether to leave and speak privately.`;
  s.briefing.known = [
    'Mina Voss is an adult. Patrol saw her offer to come outside and then step back inside.',
    'Officers corroborated an earlier assault and threat and saw the person making that threat leave. That earlier report remains recorded.',
    context,
  ];
  s.briefing.unknown = ['Whether Mina accepts the offered private conversation', ...(routeAlreadyChecked ? [] : ['Whether the current exit is safe and usable']), 'Mina’s care needs once she is reached'];
  const cal = s.story!.bindings.people.cal;
  cal.transitions = [{ when: {}, to: { kind: 'offscene', label: 'Already waiting apart with patrol, out of sight of Mina' }, observed: true, label: 'Already waiting apart with patrol' }];
  const calFact = s.facts.find(f => f.id === cal.locationFactId)!;
  calFact.claim = 'Patrol has taken Cal to wait apart, out of sight of Mina’s exit and conversation.';
  calFact.resolved!.confirmed = calFact.claim;
  calFact.uncertainty = calFact.claim;
  const cameraFact = s.facts.find(f => f.id === p + 'camera_response')!;
  cameraFact.label = 'Cal’s already-observed separation';
  cameraFact.claim = 'Patrol has already taken Cal to wait apart, out of sight of Mina’s exit and conversation.';
  cameraFact.uncertainty = cameraFact.claim;
  cameraFact.source = 'Responding patrol';
  cameraFact.note = 'Patrol has observed the actual separation; Mina still decides whether to accept the offered conversation.';
  cameraFact.truth = true;
  cameraFact.initial = 'confirmed';
  cameraFact.resolved!.confirmed = 'Cal is already waiting out of sight with patrol. His phone cannot record Mina’s exit or conversation from there.';
  cameraFact.resolved!.disproved = 'Patrol cannot confirm Cal remains apart. A private exit or conversation cannot be promised on that basis.';
  const knownPrivacy: OutcomeEffect = { setFlags: [p + 'privacy_ready', p + 'cal_waits_apart', p + 'camera_checked'], text: 'Patrol confirms Cal is still waiting apart, out of sight. The arrangement is already real; Mina has not been committed to a conversation or a move.' };
  const route: OutcomeEffect = { reveal: [p + 'current_danger', p + 'usable_path'], setFlags: [p + 'route_checked'], text: 'Patrol independently confirms no immediate threat at the present exit and a usable path. The actual route will be checked again when Mina moves.' };
  if (routeAlreadyChecked) for (const [name, status] of [['current_danger', 'disproved'], ['usable_path', 'confirmed']] as const) s.facts.find(f => f.id === p + name)!.initial = status;
  const agreement = action(s, p + 'agree_separate_conversation');
  const direct = copyAction(agreement, p + 'ask_mina_directly');
  direct.stage = 'assess';
  direct.visibleWhen = { notFlags: [`used:${direct.id}`, p + 'agreement'] };
  direct.requires = { notFlags: [{ flag: `used:${direct.id}`, reason: 'This offer has already been attempted' }] };
  direct.workload.base = routeAlreadyChecked ? 3 : 7;
  words(direct, routeAlreadyChecked ? 'Ask Mina about the arrangement already made' : 'Check the exit and ask Mina about the private arrangement', `Hear Mina’s own terms and ask whether she accepts the separate conversation with Cal already apart. ${routeAlreadyChecked ? 'Use patrol’s current exit check.' : 'Patrol independently checks the current exit during this exchange.'} This quicker offer gives her less time to discuss concerns than a private exchange first.`);
  for (const band of BANDS) direct.outcomes[band].unshift(structuredClone(knownPrivacy), structuredClone(route), { reveal: [p + 'mina', p + 'privacy'], setFlags: [p + 'mina_heard'], text: 'Mina speaks for herself: she wants a separate conversation and controls whether anything is later shared with Cal.' });
  // The longer opening conversation has a useful benefit: time to hear her concern before consent.
  for (const a of scenarioActions(s)) if (/_(relay|phone)_mina_assess$/.test(a.id)) {
    append(a, knownPrivacy);
    if (routeAlreadyChecked) append(a, route);
    append(a, { pressure: -5, setFlags: [p + 'heard_at_length'], text: 'The longer private exchange gives Mina time to explain her concern. No offer to share her account is made; she still decides whether to leave.' });
    a.summary += ' Taking this extra time eases pressure and prepares a less difficult agreement conversation.';
    for (const band of BANDS) a.outcomes[band] = a.outcomes[band].filter(effect => !effect.when?.flags?.includes(p + 'cal_first') && !effect.when?.notFlags?.includes(p + 'cal_first'));
  }
  agreement.check.difficulty -= 7;
  agreement.visibleWhen!.notFlags = agreement.visibleWhen!.notFlags!.filter(flag => flag !== p + 'cal_first');
  for (const band of BANDS) for (const effect of action(s, p + 'clarify_no_shared_account').outcomes[band]) if (effect.setFlags) effect.setFlags = effect.setFlags.filter(flag => flag !== p + 'group_proposal_withdrawn');
  // Every remaining opening hears Mina, so a first-contact replay in adapt
  // can never become available in these already-separated episodes.
  remove(s, [p + 'ask_cal_first', p + 'ask_camera_off', p + 'ask_cal_wait_apart', p + 'withdraw_group_proposal', p + 'phone_mina_adapt', p + 'relay_mina_adapt', ...(routeAlreadyChecked ? [p + 'check_route'] : [])]);
  s.stages.assess.actions.unshift(direct);
  s.stages.assess.prompt = 'Cal is already waiting apart. Ask Mina whether she accepts that arrangement now, or spend longer hearing her concerns privately first.';
  s.stages.adapt.prompt = routeAlreadyChecked ? 'The privacy arrangement and current route are checked. Mina can now choose the actual separate conversation.' : 'Mina’s private arrangement is ready. Independently check present danger and the usable exit before asking her to accept the move.';
  s.stages.adapt.contextPrompts = [];
  return { variantId: routeAlreadyChecked ? 'privacy-and-exit-ready' : 'privacy-ready-exit-unchecked', modules: ['prearranged-separation', 'honor-private-followthrough'], publicContext: [context, 'A longer private opening takes more time, eases pressure and makes the later agreement easier. The direct offer still waits for Mina’s own answer.'] };
}

/** Mutates only the already-cloned, bound V6 episode supplied by the caller. */
export function applyCarePrivacyVariation(s: ScenarioDefinition, built: BuiltLocation, variant: number): AppliedEpisodeModule {
  if (!s.story) throw new Error('V6 care/privacy variation requires bound story people and routes');
  if (s.incident?.type === 'medical_complication') return medical(s, built, variant);
  if (s.incident?.type === 'barricaded') return protective(s, built, variant);
  throw new Error('No care/privacy variation for this incident family');
}
