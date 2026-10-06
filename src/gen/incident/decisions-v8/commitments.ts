import { scenarioActions, type ActionDefinition, type OutcomeEffect, type ScenarioDefinition } from '../../../sim/scenario-types';
import type { BuiltLocation, OutcomeBand } from '../../../sim/types';

const BANDS: OutcomeBand[] = ['favorable', 'mixed', 'adverse'];
const preview = (text: string) => ({ favorable: text, mixed: text, adverse: text });
const find = (s: ScenarioDefinition, id: string) => scenarioActions(s).find(a => a.id === id);
const need = (s: ScenarioDefinition, id: string) => {
  const a = find(s, id);
  if (!a) throw new Error(`V8 commitment needs ${id}`);
  return a;
};
const firstName = (s: ScenarioDefinition, id: string) => s.story!.bindings.people[id].label.split(' ')[0];
const place = (built: BuiltLocation, id: string) => built.location.rooms.find(r => r.id === id)?.label ?? built.location.zones.find(z => z.id === id)?.label ?? id;
function words(a: ActionDefinition, title: string, summary: string): void { a.title = a.task = title; a.summary = summary; }
function append(a: ActionDefinition, effect: OutcomeEffect): void { for (const band of BANDS) a.outcomes[band].push(structuredClone(effect)); }
function copy(a: ActionDefinition, id: string): ActionDefinition {
  const cloned = JSON.parse(JSON.stringify(a).replaceAll(`used:${a.id}`, `used:${id}`)) as ActionDefinition;
  cloned.id = id;
  return cloned;
}
function guard(a: ActionDefinition): void {
  const used = `used:${a.id}`;
  a.visibleWhen = { ...a.visibleWhen, notFlags: [...new Set([...a.visibleWhen?.notFlags ?? [], used])] };
  a.requires.notFlags = [...a.requires.notFlags?.filter(f => f.flag !== used) ?? [], { flag: used, reason: 'This arrangement has already been attempted' }];
  for (const band of BANDS) a.outcomes[band].unshift({ setFlags: [used], ...(a.stage === 'resolve' ? { stage: 'resolve' as const } : {}) });
}
function exclude(a: ActionDefinition, flag: string): void {
  a.visibleWhen = { ...a.visibleWhen, notFlags: [...a.visibleWhen?.notFlags ?? [], flag] };
  a.requires.notFlags = [...a.requires.notFlags ?? [], { flag, reason: 'The alternative arrangement was already attempted' }];
}
function remove(s: ScenarioDefinition, id: string): void {
  for (const stage of Object.values(s.stages)) stage.actions = stage.actions.filter(a => a.id !== id);
}

/** Apply only to the isolated V8 compiler output, after the V7 scene binding.
 * Facts, recipients, routes, equipment and cast remain the episode's own. */
export function withConcreteCommitmentsV8(s: ScenarioDefinition, built: BuiltLocation): ScenarioDefinition {
  switch (s.incident!.type) {
    case 'welfare_check': welfare(s); break;
    case 'medical_complication': medical(s, built); break;
    case 'barricaded': protective(s, built); break;
    case 'active_armed_incident': armed(s, built); break;
    case 'hostage_crisis': hostage(s); break;
    case 'protected_rescue': rescue(s, built); break;
  }
  return s;
}

/** Uncommitted cards for issued stories may expose commitments that already
 * exist. This never changes old definitions, effects, timing or saved history. */
export function legacyCommitmentPresentation(s: ScenarioDefinition, a: ActionDefinition, built: BuiltLocation): Pick<ActionDefinition, 'title' | 'summary' | 'outcomePreview'> | null {
  if (![5, 6, 7].includes(s.version) || !s.story || s.incident?.contentVersion !== s.version) return null;
  if (s.incident.type === 'protected_rescue') {
    const name = firstName(s, 'jun'), room = place(built, s.story.bindings.rooms.scene.spaceId);
    if (a.id === 'v5_chair_hear_jun') return { title: `Call ${name}; keep the squad outside`, summary: `Use the dispatch line without moving the squad. Hear the actual need now; reaching ${room} and checking the chair route remain separate steps.`, outcomePreview: preview(`Hear ${name} while the squad stays at its current position. No physical reach or rescue has happened.`) };
    if (a.id === 'v5_chair_reach_and_hear') return { title: `Reach ${name} in ${room} and stay to help`, summary: `Commit the squad to the real route into ${room}. Travel takes longer now, but this conversation also reaches ${name}; check the chair route next.`, outcomePreview: preview(`Hear and physically reach ${name}. Skip the later reach step; the person and chair are still inside.`) };
  }
  if (s.incident.type === 'medical_complication' && /request_(inside|outside)_early$/.test(a.id)) {
    const serviceId = Object.values(a.outcomes).flat().flatMap(effect => effect.requestSupport ?? [])[0];
    const service = s.externalServices?.find(candidate => candidate.id === serviceId);
    if (service) return { title: a.title, summary: a.summary, outcomePreview: preview(`Start this receiving team’s ${service.arrivalMinutes}-minute response. Its clock and assessment place belong to this request; the other team cannot complete its handover.`) };
  }
  if (s.incident.type === 'hostage_crisis' && a.id === 'v5_sig_release_ben') {
    // The episode already knows whether this is one mobile, two independent
    // mobiles or a flat battery. Preserve that authored distinction verbatim.
    return { title: a.title, summary: `${a.summary} The squad must still follow through on ${firstName(s, 'mara')}’s separate release.`, outcomePreview: a.outcomePreview ? structuredClone(a.outcomePreview) : undefined };
  }
  return null;
}

function welfare(s: ScenarioDefinition): void {
  const p = 'v5_welfare_', name = firstName(s, 'ada');
  const check = need(s, p + 'check_ada_now');
  // Acknowledging the duplicate matters, but it need not be a whole separate
  // deterministic button before the actual current-safety conversation.
  if (find(s, p + 'acknowledge_repeat')) {
    check.visibleWhen!.flags = check.visibleWhen!.flags?.filter(f => f !== p + 'contact_ready');
    check.requires.flags = check.requires.flags?.filter(f => f.flag !== p + 'contact_ready');
    check.summary = `Ask ${name} only about safety now while patrol checks independently. If the team asked about the old report, first spend two minutes acknowledging that repetition. A requested assessment remains open.`;
    append(check, { when: { flags: [p + 'asked_again'], notFlags: [p + 'repair_made'] }, setFlags: [p + 'repair_made', p + 'contact_ready'], extraMinutes: 2,
      text: `The team explains the duplicate dispatch entry and acknowledges the repeated question. It keeps the new exchange limited to ${name}’s safety and needs now, even if she is not ready to answer.` });
    remove(s, p + 'acknowledge_repeat');
    s.stages.adapt.contextPrompts = s.stages.adapt.contextPrompts?.map(prompt => prompt.when.notFlags?.includes(p + 'repair_made')
      ? { ...prompt, prompt: `Both reports trace to the earlier call. Acknowledge the repeated question as part of ${name}’s current-safety check.` } : prompt);
  }
  const early = need(s, p + 'ask_about_return');
  early.summary += ` This leaves the source check open, but makes any assessment ${name} asks for available to request sooner.`;
  const request = need(s, p + 'request_early_assessment');
  request.summary = `Start the actual ambulance response on ${name}’s request while the source check continues. She stays home; acceptance still needs the independent current-safety check.`;
}

function medical(s: ScenarioDefinition, built: BuiltLocation): void {
  const p = 'v5_assistance_', name = firstName(s, 'rosa');
  const outside = need(s, p + 'lock_and_step_out');
  const destination = place(built, outside.targetId);
  const receiver = s.externalServices!.find(service => service.id === p + 'outside_crew')!;
  const change = copy(outside, 'v8_assistance_change_to_outside');
  change.stage = 'resolve';
  change.visibleWhen = { flags: [p + 'onsite'], notFlags: [p + 'outside', p + 'rosa_care'] };
  change.requires.flags = [...change.requires.flags ?? [], { flag: p + 'onsite', reason: 'An inside assessment must be the current agreement' }];
  words(change, `Ask ${name} to switch to assessment at ${destination}`,
    `Ask for a new agreement to leave the shop. If ${name} agrees, accompany her over the usable exit; she locks it and keeps her keys. The separate outside crew takes ${receiver.arrivalMinutes} minutes from its own request.`);
  change.outcomePreview = {
    favorable: `With her new agreement, reach ${destination} and start its crew if needed. The inside crew cannot accept this outside transfer.`,
    mixed: `Give ${name} more time to choose, then complete the same checked move with her keys. The outside crew still has to accept care.`,
    adverse: `${name} prefers the inside assessment. Keep that agreement and both crews’ actual response states; no move or new consent is claimed.`,
  };
  change.resultLabels = { favorable: `${name} chose the outside assessment`, mixed: `${name} chose the outside assessment`, adverse: `${name} keeps the inside assessment` };
  for (const band of ['favorable', 'mixed'] as const) {
    for (const effect of change.outcomes[band]) if (effect.setFlags?.includes(p + 'outside')) {
      effect.clearFlags = [...effect.clearFlags ?? [], p + 'onsite'];
      effect.text = `${name} accepts the changed outside assessment. She reaches ${destination} on the checked route, locks the actual exit and keeps the keys. Her earlier inside agreement is replaced; the outside crew still needs to receive her.`;
    }
  }
  change.outcomes.mixed.push({ extraMinutes: 3, text: `${name} takes three more minutes to consider the changed place before agreeing.` });
  change.outcomes.adverse = [{ setFlags: ['v8_assistance_switch_declined'], text: `${name} does not accept the changed outside plan. She remains inside with her keys and her original assessment agreement; no additional crew is requested by this declined offer.` }];
  guard(change);
  s.stages.resolve.actions.unshift(change);
  s.stages.resolve.contextPrompts!.unshift({ when: { flags: [p + 'onsite'], notFlags: [p + 'outside'] }, prompt: `Keep the agreed inside assessment, or ask ${name} about the separate crew at ${destination}. A changed choice still needs her agreement and a currently usable exit.` });
  // This is a changed receiving arrangement, never an escape from a blocked
  // physical route. The copied full route/prop gates remain authoritative.
}

function armed(s: ScenarioDefinition, built: BuiltLocation): void {
  const p = 'v5_noise_', name = firstName(s, 'eli');
  const kept = 'v8_noise_personal_link';
  const hear = need(s, p + 'hear_eli');
  words(hear, `Explain the planned arrival on ${name}’s call`, `Spend one extra minute explaining the planned help while patrol checks the report. Dispatch keeps this conversation available to whichever squad later reaches ${name}, saving two minutes of introduction. An urgent intervention needs a fresh explanation.`);
  hear.outcomePreview = preview(`Prepare ${name} for the team’s arrival through the existing dispatch call. After danger is checked, either squad can use that shorter introduction; nobody has been reached or moved yet.`);
  append(hear, { setFlags: [kept], text: `${name} hears what help the team intends to offer after the danger check. Dispatch keeps the existing call open and can introduce whichever squad reaches him using that shared explanation. No particular officer or physical arrival has been promised.` });
  const urgent = need(s, p + 'urgent_response');
  append(urgent, { clearFlags: [kept], text: 'The immediate intervention changes the scene. Dispatch retains the call, but the arriving squad must now give a full fresh explanation before helping the person outside.' });
  const reach = need(s, p + 'reach_eli');
  const linked = copy(reach, 'v8_noise_reach_on_kept_call');
  linked.workload.base = Math.max(1, linked.workload.base - 2);
  linked.visibleWhen!.flags = [...linked.visibleWhen!.flags ?? [], kept];
  linked.requires.flags = [...linked.requires.flags ?? [], { flag: kept, reason: 'Dispatch must have prepared this arrival explanation on the existing call' }];
  const room = place(built, s.story!.bindings.rooms.scene.spaceId);
  words(linked, `Reach ${name} in ${room} through the prepared introduction`, `Follow the usable route after the danger check. Dispatch introduces the arriving squad on the existing call, saving two work minutes. That squad agrees to stay beside ${name} for the later move outside.`);
  linked.outcomePreview = preview(`Physically reach ${name} with the arrival explanation already given. Any selected squad still has real travel time; the move outside remains next.`);
  append(linked, { text: `Dispatch introduces the arriving squad using the explanation ${name} already heard. The introduction takes two fewer work minutes; the squad now promises to keep speaking during the way out.` });
  exclude(reach, kept);
  s.stages.resolve.actions.splice(s.stages.resolve.actions.indexOf(reach) + 1, 0, linked);
}

function hostage(s: ScenarioDefinition): void {
  // Both openings settle precisely the same public account. Keep the variant's
  // real phone facts and remove the slower duplicate, rather than invent a perk.
  const hear = need(s, 'v5_sig_hear_ben');
  hear.workload.base = 3;
  remove(s, 'v5_sig_check_patrol');
  const ben = firstName(s, 'ben'), mara = firstName(s, 'mara');
  const ask = find(s, 'v5_sig_ask_phone');
  if (ask) ask.summary = `Keep ${ben} inside longer while asking to leave his own phone with ${mara}. If accepted, complete his release and promised dispatcher call; refusal leaves his original immediate release available.`;
  const phone = find(s, 'v5_sig_independent_phone');
  if (phone) phone.summary += ` Assign the qualified phone operator now; ${ben}’s physical release remains a separate choice.`;
}

function rescue(s: ScenarioDefinition, built: BuiltLocation): void {
  const p = 'v5_chair_', name = firstName(s, 'jun');
  const room = place(built, s.story!.bindings.rooms.scene.spaceId);
  const phone = need(s, p + 'hear_jun'), direct = need(s, p + 'reach_and_hear');
  words(phone, `Call ${name}; keep the squad outside`, `Hear ${name} on the dispatch line while the squad stays at its current position. This is quicker now; reaching ${room} and checking a chair route remain separate work.`);
  phone.outcomePreview = preview(`Learn ${name}’s actual need without moving the squad. Next choose when to reach ${room}; no physical assistance has begun.`);
  words(direct, `Reach ${name} in ${room} and stay to help`, `Commit the squad to the usable route into ${room}. Travel takes longer now, but the squad reaches ${name} during this conversation and can check the chair route next.`);
  direct.outcomePreview = preview(`Hear and physically reach ${name} in the same commitment. Skip the later reach step; the chair and ${name} are still inside.`);
  const quiet = find(s, p + 'check_quiet_chair_route');
  if (quiet) {
    // This choice already explicitly agrees assistance, unlike the public route
    // which still offers a genuine vehicle-versus-assistance decision.
    append(quiet, { setFlags: [p + 'assistance_ready'], text: `${name}’s choice of the separate destination includes the chair-preserving assistance agreement. The team can now make the checked move to staging without repeating that agreement.` });
    quiet.summary += ' Agree the assistance arrangement during this check, then move to staging next.';
    quiet.outcomePreview = preview('Check this real chair route, prepare the separate conversation place and agree assistance together. The next step is the actual move to staging; no vehicle pickup is assumed here.');
    const change = copy(quiet, 'v8_chair_change_to_quiet_route');
    change.visibleWhen = { flags: [p + 'public_destination', p + 'route_checked'], notFlags: [p + 'at_pickup', p + 'quiet_destination'] };
    words(change, `Ask ${name} to change to the separate chair route`, `${name} can reconsider the original pickup before moving. Check the already-mapped alternate chair route and agree its assistance plan, including the extra preparation time. The reserved vehicle is only at the original pickup.`);
    append(change, { clearFlags: [p + 'public_destination', p + 'vehicle_ready'], text: `${name} replaces the original pickup with the checked separate destination and agrees its assistance plan. The original vehicle arrangement is no longer the selected move; nobody has moved yet.` });
    guard(change);
    s.stages.adapt.actions.push(change);
  }
  const assisted = need(s, p + 'assisted_move');
  // Real additional acting officers share the work, strain and possible harm.
  // Their certs and equipment still count only if they can physically take part.
  assisted.maxActing = 2;
  assisted.approach = 'path';
  assisted.capacityBound = [...new Set([assisted.targetId, ...assisted.capacityBound ?? []])];
  assisted.summary += ' One or two acting squads can share this physical assistance; the actual space limits who contributes, and both squads spend the move on this duty.';
  assisted.task = `Accompany ${name} and the chair`;
}

function protective(s: ScenarioDefinition, built: BuiltLocation): void {
  const p = 'v5_protective_', name = firstName(s, 'mina'), cal = firstName(s, 'cal');
  const room = place(built, s.story!.bindings.rooms.scene.spaceId);
  const home = 'v8_protective_private_at_home', safe = 'v8_protective_mina_safe';
  // Safety is no longer synonymous with crossing the doorway. The home branch
  // still requires an independently checked absence of current danger.
  s.civilianOutcomes!.find(person => person.id === 'mina')!.safeFlag = safe;
  for (const a of scenarioActions(s)) for (const band of BANDS) for (const effect of a.outcomes[band]) if (effect.setFlags?.includes(p + 'mina_outside')) effect.setFlags.push(safe);
  const careFact = s.facts.find(f => f.id === p + 'care_needed')!;
  careFact.claim = `${name} has not yet had an immediate-needs conversation.`;
  careFact.resolved!.confirmed = `${name} reports wrist pain from the earlier incident and asks for clinical assessment.`;
  careFact.resolved!.disproved = `${name} reports no current medical complaint and wants a private conversation with the team.`;
  const talk = copy(need(s, p + 'clarify_no_shared_account'), 'v8_protective_offer_private_at_home');
  talk.visibleWhen = { flags: [p + 'exit_declined', p + 'mina_heard', p + 'privacy_ready', p + 'route_checked'], notFlags: [p + 'mina_outside', home] };
  talk.requires = { flags: [p + 'mina_heard', p + 'privacy_ready', p + 'route_checked'].map(flag => ({ flag, reason: 'An existing private exchange and independent current-safety check are needed' })), facts: [{ factId: p + 'current_danger', in: ['disproved'], reason: 'Independently establish there is no immediate threat' }] };
  words(talk, `Offer ${name} the private conversation in ${room}`, `Respect her decision to stay inside. Ask whether she wants to use the existing private exchange from ${room}, with ${cal} kept apart and her account hers to share. Hear current needs only if she agrees.`);
  talk.workload = { base: 6, perSqFt: 0 };
  talk.outcomePreview = { favorable: `${name} accepts the conversation where she is. If she needs no care, honor her choice to stay; any requested assessment stays open.`, mixed: `Give ${name} longer to decide, then keep the same private arrangement and follow through on her actual needs.`, adverse: `${name} declines this different offer too. Respect her boundary; no conversation, safety conclusion or accepted care is invented.` };
  const accepted: OutcomeEffect[] = [
    { reveal: [p + 'care_needed'], setFlags: [home, safe, p + 'private_conversation'], text: `${name} accepts a private conversation while remaining in ${room}. ${cal} stays apart. The team listens to what she chooses to share; the checked absence of immediate danger remains separate from the earlier assault report.` },
    { truth: [{ factId: p + 'care_needed', is: true }], setFlags: [p + 'care_needed'], text: `${name} asks for wrist assessment. Her conversation is complete, but she has not agreed to move outside or been received by a medical crew.` },
    { truth: [{ factId: p + 'care_needed', is: false }], setFlags: ['v8_protective_stay_home_chosen'], text: `${name} reports no current medical complaint and chooses to remain at home after the private conversation. The team honors that choice without promising her account to ${cal}.` },
  ];
  const complete: OutcomeEffect = { truth: [{ factId: p + 'care_needed', is: false }], when: { notFlags: ['casualty:untreated', 'casualty:awaiting_transport'] }, ending: home, objective: 100, text: `${name}’s private conversation and choice to remain home are complete. The earlier assault stays recorded; no shared account or family reconciliation is claimed.` };
  talk.outcomes = { favorable: [...structuredClone(accepted), structuredClone(complete)], mixed: [...structuredClone(accepted), { extraMinutes: 3, text: `${name} takes longer to accept the in-place conversation. The privacy promise is unchanged.` }, structuredClone(complete)], adverse: [{ setFlags: ['v8_protective_home_conversation_declined'], text: `${name} declines the offered conversation at home. The team respects that answer; her earlier exit refusal is not treated as consent to another arrangement.` }] };
  guard(talk);
  s.endings[home] = { id: home, title: `${name} chooses a private conversation at home`, summary: `${name} accepted and completed a private conversation from ${room}, with ${cal} apart. An independent current check found no immediate danger; she reported no medical need and chose to remain home. The earlier assault remains recorded.`, trustAdjust: 2, strain: -2, disposition: 'followup_agreed', completion: { flags: [home, safe, 'v8_protective_stay_home_chosen', p + 'private_conversation', p + 'privacy_ready'], facts: [{ factId: p + 'current_danger', in: ['disproved'] }, { factId: p + 'care_needed', in: ['disproved'] }], notFlags: ['casualty:untreated', 'casualty:awaiting_transport'] } };
  append(need(s, p + 'receive_officer'), { ...structuredClone(complete), when: { flags: [home, 'v8_protective_stay_home_chosen'] } });
  const move = copy(need(s, p + 'agree_separate_conversation'), 'v8_protective_choose_assessment_outside');
  move.stage = 'resolve';
  move.visibleWhen = { flags: [home, p + 'care_needed'], notFlags: [p + 'agreement', p + 'mina_outside'] };
  move.requires.facts = [...move.requires.facts ?? [], { factId: p + 'care_needed', in: ['confirmed'], reason: 'She must have asked for assessment' }];
  const destination = place(built, s.story!.bindings.exterior.arrival.spaceId);
  words(move, `Ask ${name} about assessment at ${destination}`, `The private conversation is complete. Ask separately whether she accepts the checked move to ${destination} and assessment by her existing receiving crew. An agreement starts its response; the actual move still comes next.`);
  move.outcomePreview = { favorable: 'She agrees to the new medical move and the crew is requested. Complete the actual route before any transfer.', mixed: 'She agrees after more time. Her completed private conversation remains private; the move and care still need completion.', adverse: 'She declines the outside assessment arrangement. Keep her actual request and location without claiming consent or a transfer.' };
  const service = p + 'mina_crew';
  for (const band of ['favorable', 'mixed'] as const) {
    for (const effect of move.outcomes[band]) {
      if (effect.setFlags?.includes(p + 'agreement')) effect.text = `${name} accepts the checked move outside for the wrist assessment she requested. Her private conversation has already happened; she is still inside until the actual move.`;
      else if (effect.extraMinutes) effect.text = `${name} takes more time before accepting the separate medical move. Her completed private conversation remains hers to share.`;
    }
    move.outcomes[band].push({ requestSupport: [service], setFlags: [p + 'assessment_agreed', p + 'crew_requested'], text: `${name} agrees to the separate assessment arrangement. Her existing receiving ambulance starts responding; her private conversation has already happened.` });
  }
  move.outcomes.adverse = [{ setFlags: ['v8_protective_assessment_move_declined'], text: `${name} does not agree to the proposed outside assessment. The team keeps her wrist complaint and actual location in the record; no move or care acceptance is claimed.` }];
  guard(move);
  s.stages.resolve.actions.push(talk, move);
  s.stages.resolve.contextPrompts!.unshift({ when: { flags: [p + 'exit_declined'], notFlags: [home] }, prompt: `${name} declined leaving. With present danger checked and the private arrangement real, offer a conversation where she is; she can still decline.` });

  // A deliberately separate card makes this an opt-in two-squad commitment.
  // The lead completes the original move; support travels to the real exterior
  // to maintain the agreed receiving space, with its actual radio/distance cost.
  const solo = need(s, p + 'meet_mina_outside');
  const pair = copy(solo, 'v8_protective_move_with_receiving_squad');
  pair.support = { max: 9, maxSquads: 1, reachMinutes: 12, coverSpaceId: s.story!.bindings.exterior.arrival.spaceId, label: `maintaining the private receiving space at ${destination}`, task: `Keep ${name}’s receiving space private` };
  pair.requires.minSquads = { count: 2, reason: 'Assign a lead squad and a separate receiving squad' };
  pair.workload.base += 2;
  words(pair, `Meet ${name} with a separate receiving squad`, `The lead accompanies ${name} to ${destination}; a second squad maintains the already-agreed private receiving space. Coordination takes two extra work minutes plus actual travel, and ties up both squads.`);
  pair.outcomePreview = { ...solo.outcomePreview! };
  exclude(pair, `used:${solo.id}`); exclude(solo, `used:${pair.id}`);
  append(pair, { text: `The lead and receiving squad keep separate duties at the agreed exit. ${cal} is not included in ${name}’s conversation; any injury or unfinished move remains recorded.` });
  s.stages.resolve.actions.splice(s.stages.resolve.actions.indexOf(solo) + 1, 0, pair);
}
