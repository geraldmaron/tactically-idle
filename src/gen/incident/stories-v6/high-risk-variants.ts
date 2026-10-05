import { scenarioActions, type ActionDefinition, type OutcomeEffect, type ScenarioDefinition } from '../../../sim/scenario-types';
import { findStoryRoute, storyPoint } from '../../../sim/story-bindings';
import type { BuiltLocation, ExteriorZone, OutcomeBand } from '../../../sim/types';

const BANDS: OutcomeBand[] = ['favorable', 'mixed', 'adverse'];
const preview = (text: string) => ({ favorable: text, mixed: text, adverse: text });
const action = (s: ScenarioDefinition, id: string) => {
  const found = scenarioActions(s).find(candidate => candidate.id === id);
  if (!found) throw new Error(`V6 high-risk variation needs ${id}`);
  return found;
};
function copyAction(original: ActionDefinition, id: string): ActionDefinition {
  // A cloned decision owns its own attempt guard, including its outcome flag.
  return JSON.parse(JSON.stringify(original).replaceAll(`used:${original.id}`, `used:${id}`)) as ActionDefinition;
}
function replace(s: ScenarioDefinition, original: ActionDefinition, replacements: ActionDefinition[]): void {
  const stage = s.stages[original.stage];
  stage.actions.splice(stage.actions.indexOf(original), 1, ...replacements);
}
function addEffect(a: ActionDefinition, effect: OutcomeEffect): void {
  for (const band of BANDS) a.outcomes[band].push(structuredClone(effect));
}
function words(a: ActionDefinition, title: string, summary: string): void {
  a.title = a.task = title; a.summary = summary;
}
function requireFlag(a: ActionDefinition, flag: string, reason: string): void {
  a.requires.flags = [...a.requires.flags ?? [], { flag, reason }];
}

/** Starts the existing receiver's real clock; acceptance still needs the original care gates. */
function earlyDispatch(s: ScenarioDefinition, prefix: string, subject: string, knownFlag: string): string | null {
  const original = action(s, `${prefix}civilian_request`);
  const serviceId = Object.values(original.outcomes).flat().flatMap(effect => effect.requestSupport ?? [])[0];
  const service = s.externalServices!.find(candidate => candidate.id === serviceId)!;
  // An already-known unavailable crew cannot offer a meaningful timing choice.
  if (!service.available) return null;
  const early = copyAction(original, `${prefix}request_receiver_early`);
  early.id = `${prefix}request_receiver_early`; early.stage = 'adapt';
  early.workload = { base: 3, perSqFt: 0 };
  early.visibleWhen = { flags: [knownFlag], notFlags: [`${prefix}care_mode`, `${prefix}injury_pause`, `${prefix}civilian_requested`, `used:${early.id}`] };
  early.requires = { flags: [{ flag: knownFlag, reason: `First establish the current account for ${subject}` }], notFlags: [{ flag: `used:${early.id}`, reason: 'This request has already been made' }] };
  const context = `Dispatch can send ${subject}’s existing receiving crew in ${service.arrivalMinutes} operation minutes. Requesting it now takes three minutes while the protection task waits; continuing the task leaves the same request available after the needs check.`;
  words(early, `Request ${subject}’s ambulance before the move`, context);
  early.outcomePreview = preview('Spend time starting the crew’s response clock now. The person still needs protection, an actual needs check and agreement before care can be accepted.');
  for (const band of BANDS) early.outcomes[band] = [
    { setFlags: [`used:${early.id}`, `${prefix}civilian_requested`, `${prefix}receiver_requested_early`], requestSupport: [service.id], text: `The receiving crew is requested early for ${subject}. Its response clock is running while the team continues the unfinished protection task; no medical need or accepted care has been assumed.` },
  ];
  s.stages.adapt.actions.unshift(early);
  for (const a of scenarioActions(s)) if (Object.values(a.outcomes).some(effects => effects.some(effect => effect.ending))) addEffect(a, {
    when: { flags: [`${prefix}receiver_requested_early`] },
    text: 'The receiving crew was requested before the move. Only a separate recorded acceptance completes any medical transfer.',
  });
  return context;
}

function contactVariation(s: ScenarioDefinition, variant: number): string {
  if (variant === 0) return 'Ben’s carried mobile is the only working line inside. His release can remove contact; an assigned negotiation phone or a checked patrol relay is a separate arrangement.';
  const independent = variant === 1;
  const firstIds = ['v5_sig_hear_ben', 'v5_sig_check_patrol'];
  const release = action(s, 'v5_sig_release_ben');
  const removed = new Set(['v5_sig_ask_phone']);
  if (independent) {
    for (const name of ['independent_phone', 'independent_phone_later', 'lost_line_update', 'relay_contact', 'relay_contact_later', 'hear_mara_later']) removed.add(`v5_sig_${name}`);
    s.story!.bindings.props.maras_phone = { id: 'maras_phone', label: 'Mara’s mobile phone', kind: 'carried', holderPersonId: 'mara' };
  }
  // There is no phone-loan branch in these episodes, including its promise/prop transitions.
  delete s.story!.bindings.props.bens_phone.transitions;
  for (const stage of Object.values(s.stages)) {
    stage.actions = stage.actions.filter(candidate => !removed.has(candidate.id));
    stage.contextPrompts = stage.contextPrompts?.filter(prompt => !prompt.when.flags?.includes('sig_phone_refused'));
  }
  for (const a of scenarioActions(s)) for (const band of BANDS) a.outcomes[band] = a.outcomes[band].filter(effect =>
    !effect.when?.flags?.includes('sig_ben_call_promised') && !effect.when?.flags?.includes('sig_ben_call_made'));
  if (independent) for (const a of scenarioActions(s)) for (const band of BANDS) {
    // This episode never establishes a patrol relay. A later threat still comes
    // through Mara's connected phone, preserving the clarification/protection fork.
    a.outcomes[band] = a.outcomes[band].filter(effect => !effect.when?.flags?.includes('sig_relay_contact'));
    for (const effect of a.outcomes[band]) if (effect.when?.notFlags?.includes('sig_relay_contact')) effect.when.notFlags = effect.when.notFlags.filter(flag => flag !== 'sig_relay_contact');
  }
  const context = independent
    ? 'Mara has her own working mobile and agrees that dispatch can keep its two-way line open. Ben can take his phone without breaking contact; neither phone is a mapped shop fixture.'
    : 'Ben’s mobile lost its charge after the first dispatch call. Patrol can relay replies both ways, but each exchange takes longer. An assigned working negotiation phone is another option.';
  s.stages.adapt.prompt = independent ? 'Ben can leave with his phone while Mara’s own line remains open. His actual release is still unfinished.' : 'The mobile call has ended. Ben’s release is open, and a slow two-way relay can be arranged before or after he leaves.';
  s.stages.adapt.contextPrompts = s.stages.adapt.contextPrompts?.map(prompt => ({ ...prompt, prompt: prompt.prompt.replace('The negotiation phone is connected.', 'The independent two-way line is connected.').replace('Ben is outside with his phone.', 'Ben is outside.') }));
  for (const id of firstIds) {
    const a = action(s, id);
    words(a, independent ? (id.endsWith('hear_ben') ? 'Hear Ben while dispatch checks Mara’s line' : 'Check patrol and the two separate calls') : (id.endsWith('hear_ben') ? 'Hear Ben’s last call and get patrol’s answer' : 'Compare the last call with patrol’s current account'), independent ? 'Check the current people, threat and release offer. Dispatch verifies Mara’s separate working mobile without using Ben as her spokesperson.' : 'The saved dispatch account is only the earlier report. Patrol supplies a current account and relays Lewis’s release offer after the mobile loses charge.');
    for (const band of BANDS) {
      a.outcomes[band] = a.outcomes[band].filter(effect => !effect.text);
      a.outcomes[band].push({ ...(independent ? { setFlags: ['sig_contact', 'sig_independent_line'] } : {}), text: `Patrol confirms Ben and Mara are inside with Lewis and corroborates the handgun. Lewis offers Ben’s release while keeping Mara inside. ${context}` });
    }
    if (independent) a.requires.storyProps = [{ propId: 'maras_phone', holderPersonId: 'mara', reason: 'The independent line uses Mara’s actual carried phone' }];
  }
  words(release, independent ? 'Let Ben leave while Mara stays on her line' : 'Let Ben leave with his flat phone', independent ? 'Complete Ben’s offered release with his own mobile. Mara’s independently checked call remains connected.' : 'Complete Ben’s offered release now. The flat mobile cannot carry a conversation; use the slower relay or an assigned negotiation phone.');
  release.outcomePreview = preview(independent ? 'Ben reaches safety and the existing independent call stays open.' : 'Ben reaches safety. Contact inside depends on the relay or an assigned working phone.');
  for (const band of BANDS) for (const effect of release.outcomes[band]) {
    if (effect.when?.flags?.includes('sig_independent_line')) effect.text = independent ? 'Mara’s own mobile keeps the two-way conversation open as Ben leaves with his phone.' : 'The assigned negotiation phone keeps the independent two-way conversation open.';
    if (effect.when?.notFlags?.includes('sig_independent_line')) {
      if (!independent) effect.when.notFlags.push('sig_relay_contact');
      effect.text = 'No independent two-way line is connected. Mara remains inside and contact is still needed.';
    }
  }
  if (!independent) {
    const relay = action(s, 'v5_sig_relay_contact');
    relay.visibleWhen!.flags = ['sig_accounted'];
    relay.requires.flags = [{ flag: 'sig_accounted', reason: 'First verify the current people and release offer' }];
    words(relay, 'Establish the slow patrol relay before release', 'Patrol passes replies in both directions. This costs time with Ben still inside if his release has not yet happened; he may also leave first.');
    for (const a of scenarioActions(s)) if (['v5_sig_hear_mara', 'v5_sig_hear_mara_later', 'v5_sig_record_account', 'v5_sig_clarify_recording'].includes(a.id)) {
      a.summary += ' A patrol relay adds four minutes to this exchange; a connected independent phone avoids that delay.';
      addEffect(a, { when: { flags: ['sig_relay_contact'], notFlags: ['sig_independent_line'] }, extraMinutes: 4, text: 'The checked two-way patrol relay carries the complete exchange, with four extra minutes between replies.' });
    }
    const line = action(s, 'v5_sig_independent_phone');
    line.visibleWhen!.notFlags = line.visibleWhen!.notFlags!.filter(flag => flag !== 'sig_contact');
    line.visibleWhen!.notFlags.push('sig_independent_line');
    words(line, 'Replace the slow relay with the assigned phone', 'A trained negotiator uses the actual assigned working phone. The independent line avoids later relay delays, if it is established before those exchanges.');
  }
  return context;
}

interface DestinationPair { arrival: ExteriorZone; alternate: ExteriorZone; profile: 'walking' | 'chair'; arrivalRole: string; alternateRole: string }
function destinations(s: ScenarioDefinition, built: BuiltLocation, profile: 'walking' | 'chair'): DestinationPair | null {
  const from = s.story!.bindings.rooms.scene.spaceId;
  const arrival = built.location.zones.find(zone => zone.id === s.story!.bindings.exterior.arrival.spaceId)!;
  const candidates = built.location.zones.filter(zone => zone.id !== arrival.id && findStoryRoute(built, from, zone.id, profile) !== null)
    .sort((a, b) => Number(a.tags.includes('street')) - Number(b.tags.includes('street')) || Number(b.tags.includes('cover')) - Number(a.tags.includes('cover')) || a.id.localeCompare(b.id));
  const alternate = candidates.find(zone => storyPoint(built, zone.id, s.story!.seed + 61) !== null);
  if (!alternate) return null;
  const arrivalRole = 'v6_public_exit', alternateRole = 'v6_quiet_exit';
  for (const [role, zone] of [[arrivalRole, arrival], [alternateRole, alternate]] as const) {
    s.story!.bindings.exterior[role] = { spaceId: zone.id };
    s.story!.bindings.routes[role] = { fromSpaceId: from, toSpaceId: zone.id, openingIds: findStoryRoute(built, from, zone.id, profile)!, profile };
  }
  return { arrival, alternate, profile, arrivalRole, alternateRole };
}
function bindArrival(s: ScenarioDefinition, built: BuiltLocation, personId: string, safeFlag: string, choiceFlag: string, zone: ExteriorZone): void {
  const at = storyPoint(built, zone.id, s.story!.seed + 61);
  if (!at) throw new Error(`V6 destination has no usable anchor: ${zone.id}`);
  s.story!.bindings.people[personId].transitions.push({ when: { flags: [safeFlag, choiceFlag] }, to: { spaceId: zone.id, at }, observed: true, label: `With the team at ${zone.label}` });
}

function armedDestinations(s: ScenarioDefinition, built: BuiltLocation): string | null {
  const pair = destinations(s, built, 'walking');
  if (!pair) return null;
  const original = action(s, 'v5_noise_bring_eli_out');
  const p = 'v5_noise_';
  const context = `Patrol reports bystanders waiting at ${pair.arrival.label}. They have agreed to keep ${pair.alternate.label} clear for Eli’s conversation. The second arrangement takes five extra minutes; neither location report establishes that the danger has ended.`;
  const moves = ([false, true] as const).map(quiet => {
    const zone = quiet ? pair.alternate : pair.arrival;
    const flag = `${p}${quiet ? 'quiet' : 'public'}_arrival`;
    const a = copyAction(original, `${p}bring_eli_${quiet ? 'quiet' : 'public'}`);
    a.id = `${p}bring_eli_${quiet ? 'quiet' : 'public'}`;
    a.targetId = zone.id; a.storyRoute = quiet ? pair.alternateRole : pair.arrivalRole;
    words(a, `Accompany Eli to ${zone.label}`, quiet ? `Keep the promised conversation going to the separately arranged ${zone.label}. Take five additional minutes so Eli can arrive away from the waiting bystanders.` : `Keep talking beside Eli on the checked route to ${zone.label}. Use the existing arrival arrangement; a private conversation will need extra time there.`);
    a.outcomePreview = preview(quiet ? 'Complete the selected route with five extra minutes to arrange the separate arrival. Pressure falls once the move is complete.' : 'Complete the selected route using the existing arrival arrangement. The later care or next-step conversation needs time apart from the waiting bystanders.');
    a.workload.base += quiet ? 5 : 0;
    addEffect(a, { setFlags: [flag], ...(quiet ? { pressure: -6 } : {}), text: `Eli reaches ${zone.label} with the team still talking beside him. ${quiet ? 'Patrol has kept the agreed place clear, and the quieter arrival eases the pressure.' : 'The waiting bystanders remain nearby; Eli’s private next conversation still needs to be arranged.'}` });
    bindArrival(s, built, 'eli', `${p}eli_safe`, flag, zone);
    return a;
  });
  replace(s, original, moves);
  for (const name of ['civilian_agreement', 'civilian_next_step']) {
    const a = action(s, p + name);
    a.summary += ` At ${pair.arrival.label}, take four extra minutes to arrange space from the waiting bystanders.`;
    addEffect(a, { when: { flags: [`${p}public_arrival`] }, extraMinutes: 4, text: `At ${pair.arrival.label}, patrol takes four minutes to give Eli space from the waiting bystanders before the agreed conversation.` });
  }
  return context;
}

function rescueDestinations(s: ScenarioDefinition, built: BuiltLocation): string | null {
  const pair = destinations(s, built, 'chair');
  if (!pair) return null;
  const p = 'v5_chair_';
  const context = `Neighbours are waiting at ${pair.arrival.label}. Jun asks for the later care or next-step conversation out of their hearing: patrol can arrange that space in eight minutes after arrival, or spend five extra minutes now preparing ${pair.alternate.label}. Both chair routes need checking. The alternate destination uses assistance and has no vehicle pickup; the original pickup retains the reserved-vehicle check.`;
  const originalCheck = action(s, p + 'check_chair_route');
  s.stages.adapt.contextPrompts = s.stages.adapt.contextPrompts?.filter(prompt => !prompt.when.flags?.includes(p + 'route_rejected')).map(prompt => ({ ...prompt, when: { ...prompt.when, notFlags: prompt.when.notFlags?.filter(flag => flag !== p + 'route_rejected') } }));
  s.stages.adapt.contextPrompts!.unshift({ when: { flags: [p + 'quiet_destination'], notFlags: [p + 'assistance_ready', p + 'at_pickup'] }, prompt: `Jun chose ${pair.alternate.label}, where patrol has prepared space for the later conversation. Agree the chair-preserving assistance plan; the vehicle pickup was arranged elsewhere.` });
  const chairFact = s.facts.find(fact => fact.id === p + 'f_chair_route')!;
  chairFact.resolved!.confirmed = 'Jun and the team checked the actual chair-compatible doors for the chosen exterior destination. A vehicle arrangement is a separate check.';
  const checks = ([false, true] as const).map(quiet => {
    const zone = quiet ? pair.alternate : pair.arrival;
    const flag = `${p}${quiet ? 'quiet' : 'public'}_destination`;
    const a = copyAction(originalCheck, `${p}check_${quiet ? 'quiet' : 'public'}_chair_route`);
    a.id = `${p}check_${quiet ? 'quiet' : 'public'}_chair_route`;
    a.visibleWhen!.notFlags = a.visibleWhen!.notFlags!.filter(flag => flag !== p + 'route_rejected');
    words(a, `Check and choose the chair route to ${zone.label}`, quiet ? `Jun chooses to check the actual chair route and spend five extra minutes preparing the separate place for the later conversation. This selects assistance; no vehicle pickup is arranged there.` : `Check the actual chair route to ${zone.label}. Retain assistance or a reserved-vehicle check, and allow eight extra minutes after arrival to arrange Jun’s requested private conversation.`);
    a.outcomePreview = preview(quiet ? 'Spend five extra minutes now checking the chair route and preparing a separate conversation space. The move uses assistance and is still unfinished.' : 'Keep the original pickup options without the extra preparation. Jun’s requested private care or next-step conversation needs eight extra minutes after arrival.');
    // A route check does not move anyone, but it must evaluate the entire current route.
    a.storyRoute = quiet ? pair.alternateRole : pair.arrivalRole;
    a.approach = 'none'; a.workload.base += quiet ? 5 : 0;
    for (const band of BANDS) {
      const used = a.outcomes[band].find(effect => effect.setFlags?.includes(`used:${a.id}`))!;
      a.outcomes[band] = [used, { reveal: [p + 'f_chair_route'], setFlags: [p + 'route_checked', flag], text: `Jun and the team check the actual connected chair route to ${zone.label}. ${quiet ? 'Jun chooses the place patrol kept clear and accepts the slower assistance arrangement; the vehicle is not a pickup option there.' : 'Jun chooses the original pickup, retaining assistance or a separate check of the reserved vehicle.'} Jun and the chair are still inside.` }];
    }
    return a;
  });
  replace(s, originalCheck, checks);
  const vehicle = action(s, p + 'check_reserved_vehicle');
  vehicle.visibleWhen!.notFlags!.push(p + 'quiet_destination');
  requireFlag(vehicle, p + 'public_destination', 'The reserved vehicle is arranged only at the original pickup');
  for (const method of ['assistance', 'vehicle']) {
    const original = action(s, `${p}reach_pickup_${method}`);
    const moves = (method === 'vehicle' ? [false] : [false, true]).map(quiet => {
      const zone = quiet ? pair.alternate : pair.arrival;
      const flag = `${p}${quiet ? 'quiet' : 'public'}_destination`;
      const a = copyAction(original, `${p}reach_${quiet ? 'quiet' : 'public'}_${method}`);
      a.id = `${p}reach_${quiet ? 'quiet' : 'public'}_${method}`;
      a.storyRoute = quiet ? pair.alternateRole : pair.arrivalRole; a.targetId = zone.id;
      a.visibleWhen!.flags!.push(flag); requireFlag(a, flag, 'Use the chair route Jun actually chose');
      words(a, `Bring Jun and the chair to ${zone.label}`, `Follow Jun’s chosen, currently usable chair route to ${zone.label}. The final protected move remains a separate step.`);
      a.resultLabels = preview(`${zone.label} reached`);
      for (const band of BANDS) for (const effect of a.outcomes[band]) if (effect.setFlags?.includes(p + 'at_pickup')) effect.text = `Jun and the wheelchair reach ${zone.label} through the checked doors. This is the chosen exterior staging point; the final protected move remains unfinished.`;
      return a;
    });
    replace(s, original, moves);
  }
  const assisted = action(s, p + 'assisted_move');
  assisted.summary += ` At ${pair.alternate.label}, the separate conversation space is already prepared; the original pickup still needs that arrangement afterward.`;
  for (const band of BANDS) if (assisted.outcomes[band].some(effect => effect.setFlags?.includes(p + 'jun_safe'))) assisted.outcomes[band].push({ when: { flags: [p + 'quiet_destination'] }, pressure: -6, text: 'The completed move reaches the space patrol kept clear, easing pressure after Jun and the chair arrive together.' });
  for (const name of ['civilian_agreement', 'civilian_next_step']) {
    const a = action(s, p + name);
    a.summary += ` At ${pair.arrival.label}, first take eight extra minutes to arrange the private space Jun requested away from the waiting neighbours.`;
    addEffect(a, { when: { flags: [p + 'public_destination'] }, extraMinutes: 8, text: `At ${pair.arrival.label}, patrol takes eight minutes to arrange Jun’s requested conversation out of the waiting neighbours’ hearing. The team then completes the agreed conversation.` });
  }
  // Keep post-pickup actions and care tied to Jun’s public chosen position.
  for (const name of ['assisted_move', 'prepare_different_assistance', 'vehicle_move']) action(s, p + name).storyTargetPersonId = 'jun';
  bindArrival(s, built, 'jun', p + 'at_pickup', p + 'quiet_destination', pair.alternate);
  bindArrival(s, built, 'jun', p + 'jun_safe', p + 'quiet_destination', pair.alternate);
  return context;
}

function playerFacingIntent(s: ScenarioDefinition): void {
  const copy: Record<string, [string, string]> = {
    v5_noise_urgent_response: ['Send the team to stop Grant’s attack', 'Act on the confirmed gunfire so Eli can be reached. Stopping the attack, checking Grant’s conduct and bringing Eli outside remain separate responsibilities.'],
    v5_noise_check_stand_down: ['Ask patrol whether Grant has put the weapon down', 'Ask what patrol can see Grant doing now. A quiet shop alone does not establish that Eli can be reached safely.'],
    v5_noise_clarify_stand_down: ['Ask Grant to put down the weapon', 'Keep talking about what Grant is doing now and ask patrol to verify any change. Make no promise about his investigation.'],
    v5_sig_urgent_protection: ['Send the team to protect Mara from the threat', 'Act on the current specific threat to Mara. She will still need to be brought outside, and any injuries will need their own care.'],
    v5_chair_assisted_move: ['Accompany Jun and the chair to the receiving team', 'Complete the agreed assistance move with Jun and the wheelchair together. The wider danger remains active, and this longer move can be interrupted.'],
    v5_chair_vehicle_move: ['Bring Jun and the chair to the receiving team by vehicle', 'Use the reserved vehicle with the chair arrangement its driver checked. Stop the move if the final loading check fails; Jun’s chair stays with Jun.'],
  };
  for (const a of scenarioActions(s)) if (copy[a.id]) words(a, ...copy[a.id]);
}

/** Mutates only the isolated, already-bound v6 copy. Legacy generators remain frozen. */
export function applyHighRiskVariation(s: ScenarioDefinition, built: BuiltLocation, variant: number): { variantId: string; modules: string[]; publicContext: string[] } {
  if (!s.story) throw new Error('V6 high-risk variants need bound story entities');
  if (![0, 1, 2].includes(variant)) throw new Error(`Unknown high-risk variation ${variant}`);
  playerFacingIntent(s);
  const modules: string[] = [], publicContext: string[] = [];
  if (s.incident?.type === 'hostage_crisis') {
    modules.push(['single_mobile_release', 'independent_mobile_release', 'slow_relay_release'][variant]);
    publicContext.push(contactVariation(s, variant));
    if (variant === 0) {
      const context = earlyDispatch(s, 'v5_sig_', 'Mara', 'sig_accounted');
      if (context) { modules.push('request_receiver_early'); publicContext.push(context); }
    }
  } else if (s.incident?.type === 'active_armed_incident' || s.incident?.type === 'protected_rescue') {
    const armed = s.incident.type === 'active_armed_incident';
    if (variant !== 1) {
      const context = armed ? armedDestinations(s, built) : rescueDestinations(s, built);
      if (context) { modules.push(armed ? 'public_or_quiet_arrival' : 'pickup_or_quiet_assistance'); publicContext.push(context); }
    }
    if (variant !== 0 || !modules.length) {
      const context = earlyDispatch(s, armed ? 'v5_noise_' : 'v5_chair_', armed ? 'Eli' : 'Jun', armed ? 'v5_noise_accounted' : 'v5_chair_jun_heard');
      if (context) { modules.push('request_receiver_early'); publicContext.push(context); }
      else if (!modules.length) {
        const alternate = armed ? armedDestinations(s, built) : rescueDestinations(s, built);
        if (alternate) { modules.push(armed ? 'public_or_quiet_arrival' : 'pickup_or_quiet_assistance'); publicContext.push(alternate); }
      }
    }
  } else throw new Error(`Not a high-risk story family: ${s.incident?.type}`);
  return { variantId: `${s.incident.type}:${variant}`, modules, publicContext };
}
