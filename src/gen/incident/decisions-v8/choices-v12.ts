import { scenarioActions, type ActionDefinition, type ActionModifier, type OutcomeEffect, type ScenarioDefinition } from '../../../sim/scenario-types';
import type { BuiltLocation, OutcomeBand } from '../../../sim/types';

// Content v12: a second real choice wherever a hand-authored story opened a stage with only
// one step the player could take (the choices gate, gates/choices.ts). Each addition is built
// from the story's own flags, facts and services and changes time, risk, what is recorded or
// how the call ends. None is a relabelled copy: v8 already removed openings that settled the
// same account, and this module keeps to that rule. Names are authored here and bound later
// by the v9 cast; issued calls before v12 never reach this module.

const BANDS: OutcomeBand[] = ['favorable', 'mixed', 'adverse'];
const preview = (text: string) => ({ favorable: text, mixed: text, adverse: text });
const find = (s: ScenarioDefinition, id: string) => scenarioActions(s).find(a => a.id === id);
const firstName = (s: ScenarioDefinition, id: string) => s.story!.bindings.people[id].label.split(' ')[0];
const place = (built: BuiltLocation, id: string) => built.location.rooms.find(r => r.id === id)?.label ?? built.location.zones.find(z => z.id === id)?.label ?? id;

function words(a: ActionDefinition, title: string, summary: string): void { a.title = a.task = title; a.summary = summary; }
/** A copied decision owns its own attempt guard. */
function copy(a: ActionDefinition, id: string): ActionDefinition {
  const cloned = JSON.parse(JSON.stringify(a).replaceAll(`used:${a.id}`, `used:${id}`)) as ActionDefinition;
  cloned.id = id;
  delete cloned.resultLabels;
  return cloned;
}
/** A new decision on a story's own template: same target and check level, nothing else carried over. */
function fresh(template: ActionDefinition, id: string, stage: ActionDefinition['stage']): ActionDefinition {
  return { id, stage, title: '', summary: '', task: '', icon: 'radio', targetId: template.targetId, requires: {}, check: structuredClone(template.check), approach: 'none', observes: [],
    workload: { base: 3, perSqFt: 0 }, stressBase: template.stressBase, consequenceLevel: 'low', outcomes: { favorable: [], mixed: [], adverse: [] } };
}
function guard(a: ActionDefinition): void {
  const used = `used:${a.id}`;
  a.visibleWhen = { ...a.visibleWhen, notFlags: [...new Set([...a.visibleWhen?.notFlags ?? [], used])] };
  a.requires.notFlags = [...a.requires.notFlags?.filter(f => f.flag !== used) ?? [], { flag: used, reason: 'This step has already been attempted' }];
  for (const band of BANDS) a.outcomes[band].unshift({ setFlags: [used], ...(a.stage === 'resolve' ? { stage: 'resolve' as const } : {}) });
}
function exclude(a: ActionDefinition, flag: string, reason: string): void {
  a.visibleWhen = { ...a.visibleWhen, notFlags: [...a.visibleWhen?.notFlags ?? [], flag] };
  a.requires.notFlags = [...a.requires.notFlags ?? [], { flag, reason }];
}
/** Make later steps easier (or harder, with a negative value) once a flag is set. */
function modify(s: ScenarioDefinition, ids: string[], modifier: ActionModifier): void {
  for (const id of ids) { const a = find(s, id); if (a) a.modifiers = [...a.modifiers ?? [], structuredClone(modifier)]; }
}
/** Effects of a copied action without its own attempt guard (the copy adds its own). */
const withoutGuard = (a: ActionDefinition, band: OutcomeBand) => structuredClone(a.outcomes[band]).filter(effect => !effect.setFlags?.every(flag => flag.startsWith('used:')) || effect.text || effect.reveal || effect.ending);

export function withSecondChoicesV12(s: ScenarioDefinition, built: BuiltLocation): void {
  switch (s.incident!.type) {
    case 'hostage_crisis': hostage(s); break;
    case 'active_armed_incident': armed(s); break;
    case 'protected_rescue': rescue(s); break;
    case 'medical_complication': medical(s); break;
    case 'welfare_check': welfare(s); break;
    case 'barricaded': protective(s, built); break;
  }
}

function hostage(s: ScenarioDefinition): void {
  const ben = firstName(s, 'ben'), mara = firstName(s, 'mara'), heard = 'v12_sig_lewis_heard', eased = 'v12_sig_lewis_eased', pushed = 'v12_sig_asked_too_much';
  const later = ['v5_sig_record_account', 'v5_sig_clarify_recording', 'v12_sig_release_first'];

  // Opening: who speaks first. Hearing Lewis out costs Ben time on the line but makes the
  // later conversation about Mara easier.
  const hearBen = find(s, 'v5_sig_hear_ben');
  if (hearBen) {
    const lewis = copy(hearBen, 'v12_sig_hear_lewis_first');
    words(lewis, 'Let Lewis state his demand first', `Hear Lewis out before anyone else and let him finish. ${ben} waits inside longer, but Lewis may be readier to listen when ${mara}’s turn comes.`);
    lewis.workload = { base: hearBen.workload.base + 3, perSqFt: 0 };
    lewis.outcomePreview = preview(`Establish who is inside and the release offer, after Lewis has had his say. Nothing is promised to him, and ${ben} waits longer.`);
    for (const band of BANDS) lewis.outcomes[band].push({ setFlags: [heard], pressure: 4, text: `Lewis speaks first: he wants a statement clearing him. The team lets him finish and promises nothing. ${ben} waits inside through it.` });
    s.stages.assess.actions.push(lewis);
  }

  // Ben's release: take the sure thing, or ask for more and risk hardening Lewis.
  const release = find(s, 'v5_sig_release_ben');
  if (release) {
    const both = copy(release, 'v12_sig_ask_for_both');
    words(both, `Ask Lewis to let ${mara} go with ${ben}`, `Ask for both releases at once. If Lewis agrees to talk about ${mara}, the later conversation goes easier. If he refuses, ${ben} stays inside longer and Lewis is harder to reach.`);
    both.check = { kind: 'contact', ratings: [{ key: 'communication', weight: 0.75 }, { key: 'composure', weight: 0.25 }], difficulty: release.check.difficulty + 10 };
    both.workload = { base: release.workload.base + 3, perSqFt: 0 };
    both.outcomePreview = { favorable: `${ben} leaves, and Lewis agrees to talk about ${mara} next.`, mixed: `${ben} leaves after a longer exchange. Lewis makes no promise about ${mara}.`, adverse: `Lewis refuses and digs in. ${ben} is still inside; his own release is still on offer.` };
    both.outcomes.favorable.push({ setFlags: [eased], text: `Lewis lets ${ben} go and says he will talk about ${mara} once someone hears him out. Nothing about the statement is promised.` });
    both.outcomes.mixed.push({ extraMinutes: 3, text: `Lewis refuses to discuss ${mara} yet, but lets ${ben} go after a longer exchange.` });
    both.outcomes.adverse = [{ setFlags: [pushed], pressure: 8, extraMinutes: 3, text: `Lewis hears the request as the team trying to empty the shop. He refuses and goes quiet for a while. ${ben} is still inside; his own release can still go ahead.` }];
    // A refusal leaves Ben's own release on offer; once he is out it disappears with him.
    s.stages.adapt.actions.splice(s.stages.adapt.actions.indexOf(release) + 1, 0, both);
  }

  // The last exchange: record Lewis's account, or ask for Mara first and skip it.
  const record = find(s, 'v5_sig_record_account');
  if (record) {
    const first = copy(record, 'v12_sig_release_first');
    words(first, `Ask Lewis to let ${mara} go before any recording`, `Ask for ${mara}’s release now and leave Lewis’s account for later. Quicker, but Lewis is more likely to feel brushed off, and his account goes unrecorded.`);
    first.workload = { base: 3, perSqFt: 0 };
    first.check = { ...structuredClone(record.check), difficulty: record.check.difficulty + 8 };
    first.outcomePreview = { favorable: `Lewis lets ${mara} leave unsigned. His account is not recorded.`, mixed: `Lewis agrees after a longer exchange. His account is not recorded.`, adverse: 'Lewis feels brushed off. The exchange breaks down; one clarification remains possible.' };
    const agreed: OutcomeEffect = { setFlags: ['sig_mara_release_agreed'], clearFlags: ['sig_current_danger', 'sig_exchange_closed'], pressure: -5, text: `Lewis agrees to let ${mara} leave without signing. His account is not recorded, and the team makes no finding about the money.` };
    first.outcomes.favorable = [agreed];
    first.outcomes.mixed = [agreed, { extraMinutes: 4, text: `Lewis argues before agreeing. ${mara} waits through the longer exchange.` }];
    first.outcomes.adverse = [{ setFlags: ['sig_exchange_closed', 'sig_current_danger'], pressure: 8, text: `Lewis says, “So nobody wants to hear it.” He stops answering. One clarification remains possible.` }];
    guard(first);
    exclude(first, `used:${record.id}`, 'The account was already offered');
    exclude(record, `used:${first.id}`, `${mara}’s release was already asked for`);
    s.stages.resolve.actions.splice(s.stages.resolve.actions.indexOf(record) + 1, 0, first);
  }
  modify(s, later, { label: 'Lewis was heard first', when: { flags: [heard] }, source: 'preparation', value: 8 });
  modify(s, later, { label: `Lewis agreed to talk about ${mara}`, when: { flags: [eased] }, source: 'preparation', value: 10 });
  modify(s, later, { label: 'Lewis refused the earlier request', when: { flags: [pushed] }, source: 'difficulty', value: 6 });

  // Lost line under a fresh threat: the phone needs a negotiator and its equipment; patrol can
  // try the slow relay once more instead.
  const relay = find(s, 'v5_sig_relay_contact_later');
  if (relay) {
    const again = copy(relay, 'v12_sig_relay_again');
    words(again, 'Ask patrol to try the relay once more', `The first relay got no answer. Patrol tries again with a plainer message. It is slow and may fail again, but needs no phone or negotiator.`);
    again.visibleWhen = { flags: ['sig_ben_safe', 'sig_contact_lost', 'sig_relay_attempted'], notFlags: ['sig_contact', `used:${again.id}`] };
    again.workload = { base: relay.workload.base + 2, perSqFt: 0 };
    s.stages.resolve.actions.push(again);
  }
}

function armed(s: ScenarioDefinition): void {
  const p = 'v5_noise_', eli = firstName(s, 'eli'), sheltered = 'v12_noise_eli_sheltered';
  const pause = find(s, p + 'agreed_pause');
  if (!pause) return;
  // While the shooting goes on, get Eli out of sight first: it costs time now and makes
  // reaching him later safer.
  const shelter = fresh(pause, 'v12_noise_shelter_eli', 'adapt');
  words(shelter, `Talk ${eli} down out of sight first`, `On the open call, get ${eli} to stop counting and get down out of sight where he is. It costs time before the shooting stops, but reaching him later is safer.`);
  shelter.check = { kind: 'contact', ratings: [{ key: 'communication', weight: 0.7 }, { key: 'composure', weight: 0.3 }], difficulty: pause.check.difficulty };
  shelter.visibleWhen = { flags: [p + 'accounted'], notFlags: [p + 'silent', p + 'eli_reached', sheltered] };
  shelter.outcomePreview = { favorable: `${eli} gets down out of sight and keeps talking.`, mixed: `${eli} moves after a longer exchange.`, adverse: `${eli} won’t stop counting long enough to move.` };
  shelter.outcomes = {
    favorable: [{ setFlags: [sheltered], pressure: -3, text: `The dispatcher talks ${eli} into leaving the tills and getting down out of sight. He keeps talking, quietly. The shooting has not stopped.` }],
    mixed: [{ setFlags: [sheltered], extraMinutes: 3, text: `It takes several tries, but ${eli} leaves the tills and gets down out of sight. The shooting has not stopped.` }],
    adverse: [{ extraMinutes: 2, pressure: 3, text: `${eli} won’t stop counting long enough to move. He stays where he is, and the shooting goes on.` }],
  };
  guard(shelter);
  s.stages.adapt.actions.push(shelter);

  // After the pause: check the stand-down, or go in on the silence and find out on the way.
  const reach = find(s, p + 'reach_eli');
  if (!reach) return;
  const rush = copy(reach, 'v12_noise_reach_on_silence');
  words(rush, `Go in for ${eli} on the silence`, `Don’t wait for patrol to confirm Grant has put the weapon down. If he has, the team reaches ${eli} a step sooner. If he hasn’t, the team has to pull back.`);
  rush.visibleWhen = { flags: [p + 'silent'], notFlags: [p + 'stand_down_checked', p + 'danger_ended', p + 'eli_reached', `used:${rush.id}`] };
  // reach_eli carries v8's exclusion for the prepared introduction; going in unannounced
  // is open whichever way the call was kept.
  rush.requires = { ...rush.requires, flags: (rush.requires.flags ?? []).filter(f => f.flag !== p + 'danger_ended'), notFlags: (rush.requires.notFlags ?? []).filter(f => f.flag !== 'v8_noise_personal_link') };
  rush.consequenceLevel = 'high';
  rush.outcomePreview = { favorable: `If Grant has put the weapon down, reach ${eli} now. If not, pull back.`, mixed: 'The same, with a slower approach.', adverse: 'The approach stalls at the door; what Grant is doing still decides the next step.' };
  const down = { factId: p + 'f_stand_down', is: true }, armedStill = { factId: p + 'f_stand_down', is: false }, routeOk = { factId: p + 'f_route', is: true };
  const reached = reach.outcomes.favorable.find(effect => effect.setFlags?.includes(p + 'eli_reached'));
  const back: OutcomeEffect = { truth: [armedStill], setFlags: [p + 'stand_down_checked', p + 'stand_down_missing'], pressure: 10, text: `Grant is still holding the weapon. The team pulls back before reaching ${eli}. Nobody is hurt, but ${eli} hears the team go.` };
  for (const band of ['favorable', 'mixed'] as const) rush.outcomes[band] = [
    { setFlags: [`used:${rush.id}`], stage: 'resolve' },
    { reveal: [p + 'f_stand_down', p + 'f_route'] },
    { truth: [down], setFlags: [p + 'stand_down_checked', p + 'danger_ended'], text: 'Grant has already put the weapon down; patrol confirms it as the team goes in.' },
    ...(reached ? [{ ...structuredClone(reached), truth: [down, routeOk] }] : []),
    structuredClone(back),
    ...(band === 'mixed' ? [{ extraMinutes: 3, text: 'The approach takes longer than planned.' }] : []),
  ];
  rush.outcomes.adverse = [
    { setFlags: [`used:${rush.id}`], stage: 'resolve' },
    { reveal: [p + 'f_stand_down'] },
    { truth: [down], setFlags: [p + 'stand_down_checked', p + 'danger_ended'], extraMinutes: 3, text: `The approach stalls at the door. Patrol confirms Grant has put the weapon down; ${eli} is still waiting.` },
    { ...structuredClone(back), pressure: 12 },
  ];
  s.stages.resolve.actions.splice(s.stages.resolve.actions.indexOf(reach), 0, rush);
  // Only steps whose outcome depends on the roll: the urgent response, and going in unannounced.
  modify(s, [p + 'urgent_response', 'v12_noise_reach_on_silence'], { label: `${eli} is down out of sight`, when: { flags: [sheltered] }, source: 'preparation', value: 6 });
}

function rescue(s: ScenarioDefinition): void {
  const p = 'v5_chair_', jun = firstName(s, 'jun'), lull = 'v12_chair_lull';
  const assisted = find(s, p + 'assisted_move');
  if (!assisted) return;
  // Make the slow move as soon as it is ready, or first wait for patrol to call a quiet spell:
  // with Jun at home before the route check, or at staging before the final move.
  // A spell called while Jun is at home has passed by the final move, which can wait for its own.
  const earlyLull = 'v12_chair_lull_early';
  const lullWait = (stage: 'adapt' | 'resolve', id: string, flags: string[], notFlags: string[], where: string) => {
    const flag = stage === 'adapt' ? earlyLull : lull;
    const wait = fresh(assisted, id, stage);
    words(wait, stage === 'adapt' ? `Wait with ${jun} for a quiet spell first` : 'Wait at staging for a quiet spell', `Hold ${jun} and the chair ${where} until patrol calls a quiet spell in the area. It takes time, and the spell may not come, but the move in a quiet spell is less likely to be interrupted.`);
    wait.icon = 'wait'; wait.tempo = 'waiting'; wait.workload = { base: 8, perSqFt: 0 };
    wait.check = { kind: 'coordination', ratings: [{ key: 'coordination', weight: 0.6 }, { key: 'composure', weight: 0.4 }], difficulty: assisted.check.difficulty - 6 };
    wait.visibleWhen = { flags, notFlags: [p + 'jun_safe', p + 'assistance_setback', flag, ...notFlags] };
    wait.outcomePreview = { favorable: 'Patrol calls a quiet spell. The move itself is still to make.', mixed: 'The quiet spell comes, after a longer wait.', adverse: `No quiet spell comes. ${jun} waits longer ${where}.` };
    const keep = stage === 'resolve' ? { stage: 'resolve' as const } : {};
    wait.outcomes = {
      favorable: [{ ...keep, setFlags: [flag], text: `Patrol calls a quiet spell in the area. ${jun} and the chair are ready to go in it; the move is still to make.` }],
      mixed: [{ ...keep, setFlags: [flag], extraMinutes: 4, text: `The quiet spell takes longer to come. ${jun} and the chair are ready to go in it.` }],
      adverse: [{ ...keep, extraMinutes: 5, pressure: 5, text: `Patrol can’t call a quiet spell yet. ${jun} waits longer ${where} with the chair; the move is still to make.` }],
    };
    guard(wait);
    return wait;
  };
  s.stages.adapt.actions.push(lullWait('adapt', 'v12_chair_wait_for_lull_early', [p + 'jun_heard'], [p + 'at_pickup'], 'at home'));
  s.stages.resolve.actions.splice(s.stages.resolve.actions.indexOf(assisted) + 1, 0, lullWait('resolve', 'v12_chair_wait_for_lull', [p + 'at_pickup', p + 'assistance_ready'], [], 'at staging'));
  // The earlier spell has passed by the final move, but patrol has learned the pattern of the gunfire.
  modify(s, [assisted.id], { label: 'Patrol has read the pattern of the gunfire', when: { flags: [earlyLull] }, source: 'preparation', value: 6 });
  modify(s, [assisted.id], { label: 'Patrol called a quiet spell', when: { flags: [lull] }, source: 'preparation', value: 12 });
}

function medical(s: ScenarioDefinition): void {
  const p = 'v5_assistance_', rosa = firstName(s, 'rosa'), checked = 'v12_assistance_rosa_checked';
  // Before the conversation: help first, talk second.
  const aid = find(s, p + 'aid_rosa_adapt');
  if (aid) {
    const first = copy(aid, 'v12_assistance_aid_first');
    words(first, `Send the medic to ${rosa} before talking it through`, `A qualified medic uses one assigned trauma kit now, before anyone asks about the keys. ${rosa}’s concern about leaving still needs hearing.`);
    first.visibleWhen = { flags: [p + 'rosa_safe'], notFlags: [p + 'rosa_heard', p + 'first_aid', `used:${first.id}`] };
    first.outcomePreview = preview(`Give ${rosa} immediate aid now, using one kit. Her assessment and the keys question are still open.`);
    exclude(aid, `used:${first.id}`, 'First aid has already been given');
    s.stages.adapt.actions.push(first);
  }
  // While the crew comes, or once it has arrived: check how Rosa is doing.
  const wait = find(s, p + 'wait_with_rosa') ?? find(s, p + 'wait_outside_crew') ?? find(s, p + 'wait_inside_crew');
  if (!wait) return;
  const check = fresh(wait, 'v12_assistance_check_on_rosa', 'resolve');
  words(check, `Ask ${rosa} how the dizziness is now`, `Stay beside ${rosa} and ask how she is doing. A steady conversation can settle her while she waits; it is not an assessment.`);
  check.check = { kind: 'contact', ratings: [{ key: 'communication', weight: 0.7 }, { key: 'composure', weight: 0.3 }], difficulty: 28 + (s.incident!.tier ?? 1) * 3 };
  check.commandOnly = true; check.workload = { base: 2, perSqFt: 0 };
  check.visibleWhen = { flags: [p + 'crew_requested'], notFlags: [p + 'rosa_care', checked] };
  check.outcomePreview = { favorable: `${rosa} settles a little. She still needs the assessment.`, mixed: `${rosa} settles after a while. She still needs the assessment.`, adverse: `${rosa} doesn’t want to talk about it right now.` };
  check.outcomes = {
    favorable: [{ stage: 'resolve', setFlags: [checked], pressure: -8, text: `${rosa} says the dizziness comes and goes. Talking it through settles her while she waits. She still needs the assessment.` }],
    mixed: [{ stage: 'resolve', setFlags: [checked], pressure: -5, extraMinutes: 2, text: `${rosa} takes a while to answer, then settles a little. She still needs the assessment.` }],
    adverse: [{ stage: 'resolve', setFlags: [checked], pressure: -2, text: `${rosa} doesn’t want to talk about it right now. The team stays with her.` }],
  };
  guard(check);
  s.stages.resolve.actions.push(check);
}

function welfare(s: ScenarioDefinition): void {
  // Len is a cast name in the call, not a mapped person; the v9 cast binds the authored name.
  const p = 'v5_welfare_', ada = firstName(s, 'ada'), len = 'Len';
  const trace = find(s, p + 'trace_sources_adapt');
  if (trace) {
    // After asking Ada again: dispatch can try to match the timestamps without calling Len.
    const quick = copy(trace, 'v12_welfare_dispatch_trace');
    words(quick, 'Have dispatch match the timestamps', `Dispatch compares the two entries without calling ${len}. Quicker than the callback, but the times alone may not settle it.`);
    quick.icon = 'intel'; quick.workload = { base: 2, perSqFt: 0 };
    quick.check = { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.7 }, { key: 'coordination', weight: 0.3 }], difficulty: 28 + (s.incident!.tier ?? 1) * 3 };
    quick.outcomePreview = { favorable: 'Establish whether the two entries share one source, without the callback.', mixed: 'The same, after a slower search.', adverse: `The timestamps don’t settle it. Calling ${len} is still possible.` };
    const matched = withoutGuard(trace, 'favorable').map(effect => effect.reveal?.length ? { ...effect, text: `Dispatch matches the timestamps: both entries come from ${ada}’s first call. ${len} has not been called. The original threat remains in the record.` } : effect);
    quick.outcomes = { favorable: matched, mixed: [...structuredClone(matched), { extraMinutes: 3, text: 'The search through the log takes longer than expected.' }], adverse: [{ extraMinutes: 2, text: `Dispatch can’t match the two entries from the timestamps alone. Calling ${len} is still possible.` }] };
    guard(quick);
    exclude(quick, p + 'same_source_checked', 'The source is already established');
    s.stages.adapt.actions.splice(s.stages.adapt.actions.indexOf(trace) + 1, 0, quick);
  }
  // With the source established: check on Ada in person, or leave her be with a card.
  const check = find(s, p + 'check_ada_now');
  if (!check) return;
  const card = fresh(check, 'v12_welfare_leave_card', 'adapt');
  words(card, `Leave ${ada} in peace with a card`, `Have patrol check the street, correct the duplicate entry, and leave a card with the team’s number instead of asking ${ada} again. Nothing can go wrong in the exchange, but nobody checks on ${ada} herself.`);
  // The squad posts the card at Ada's door: a step, not a command-only exit (v8 retires those).
  card.icon = 'handover'; card.workload = { base: 3, perSqFt: 0 };
  card.visibleWhen = { flags: [p + 'same_source_checked'], notFlags: [p + 'current_checked'] };
  card.requires = { flags: [{ flag: p + 'same_source_checked', reason: 'Establish the source of the later account first' }] };
  const left = `Patrol checks the street and finds no renewed threat. Dispatch corrects the renewed-threat entry; the original visit stays recorded. ${ada} isn’t asked again: a card with the team’s number goes through her door.`;
  card.outcomePreview = preview(`End the visit without asking ${ada} again. Her own account of how she is tonight is not taken.`);
  for (const band of BANDS) card.outcomes[band] = [{ reveal: [p + 'current_threat'], setFlags: [p + 'report_corrected', 'v12_welfare_card_left'], ending: 'v12_welfare_card', objective: 55, text: left }];
  guard(card);
  s.stages.adapt.actions.push(card);
  s.endings.v12_welfare_card = { id: 'v12_welfare_card', title: `${ada} is left in peace`, summary: left, trustAdjust: 0, strain: -1, disposition: 'relief_partial', remainingTasks: [`${ada}’s own account of how she is tonight was not taken`] };
}

function protective(s: ScenarioDefinition, built: BuiltLocation): void {
  const p = 'v5_protective_', mina = firstName(s, 'mina'), cal = firstName(s, 'cal'), room = place(built, s.story!.bindings.rooms.scene.spaceId);
  const home = 'v8_protective_private_at_home';
  const talk = find(s, 'v8_protective_offer_private_at_home');
  // Offer the private conversation where Mina is, without her having refused the exit first.
  if (talk) {
    const offer = (stage: 'adapt' | 'resolve', id: string, notFlags: string[]) => {
      const a = copy(talk, id);
      a.stage = stage;
      words(a, `Offer ${mina} the private conversation without coming out`, `${mina} doesn’t have to leave. Talk privately in ${room}, with ${cal} kept apart. It avoids the move past the doorway; if she needs care, a move outside is a separate choice.`);
      a.visibleWhen = { flags: [p + 'mina_heard', p + 'privacy_ready', p + 'route_checked'], notFlags: [p + 'mina_outside', home, `used:${id}`, ...notFlags] };
      a.outcomes.adverse = [{ setFlags: [`used:${id}`, `${id}_declined`], ...(stage === 'resolve' ? { stage: 'resolve' as const } : {}), text: `${mina} would rather come outside than talk where she is. The separate conversation outside is still on offer.` }];
      if (stage === 'adapt') for (const band of ['favorable', 'mixed'] as const) for (const effect of a.outcomes[band]) if (!effect.ending && effect.reveal) effect.stage = 'resolve';
      return a;
    };
    const now = offer('adapt', 'v12_protective_offer_at_home_now', [p + 'agreement', p + 'agreement_failed', p + 'exit_declined']);
    // Entering resolve, the offer is open again even if she declined it earlier: the moment has
    // changed (she has agreed to come out, or the exit agreement has just fallen through).
    const later = offer('resolve', 'v12_protective_offer_at_home', [p + 'exit_declined']);
    // Copies first, exclusions after: neither copy inherits the other's guard.
    for (const a of [now, later]) exclude(talk, `used:${a.id}`, 'The conversation at home was already offered');
    s.stages.adapt.actions.push(now);
    s.stages.resolve.actions.push(later);
  }
  // After a conversation at home, if Mina wants her wrist seen: a crew outside, or her own doctor.
  const assess = find(s, 'v8_protective_choose_assessment_outside');
  if (assess) {
    const doctor = fresh(assess, 'v12_protective_own_doctor', 'resolve');
    const seen = `${mina} chooses to have her wrist seen by her own doctor rather than go outside now. The team notes the request and leaves the follow-up officer’s number. Her private conversation is complete; ${cal} was kept apart.`;
    words(doctor, `Agree ${mina} sees her own doctor about the wrist`, `${mina} can stay home and arrange the check herself. The team records the request and leaves contact details. No crew assesses her tonight.`);
    doctor.icon = 'handover'; doctor.workload = { base: 2, perSqFt: 0 };
    doctor.check = { kind: 'contact', ratings: [{ key: 'communication', weight: 0.7 }, { key: 'composure', weight: 0.3 }], difficulty: assess.check.difficulty };
    doctor.visibleWhen = { flags: [home, p + 'care_needed'], notFlags: [p + 'agreement', p + 'mina_outside', p + 'crew_requested'] };
    doctor.requires = { notFlags: [{ flag: 'casualty:untreated', reason: 'An injured officer still needs care' }, { flag: 'casualty:awaiting_transport', reason: 'An injured officer still needs an accepted receiver' }] };
    doctor.outcomePreview = preview(`End with ${mina}’s own choice of follow-up. No crew assesses her tonight.`);
    for (const band of BANDS) doctor.outcomes[band] = [{ stage: 'resolve', setFlags: ['v12_protective_own_doctor'], ending: 'v12_protective_own_doctor', objective: 80, text: seen }];
    guard(doctor);
    s.stages.resolve.actions.push(doctor);
    s.endings.v12_protective_own_doctor = { id: 'v12_protective_own_doctor', title: `${mina} chooses her own doctor`, summary: seen, trustAdjust: 1, strain: -1, disposition: 'followup_agreed',
      completion: { flags: [home, 'v12_protective_own_doctor', p + 'private_conversation', p + 'privacy_ready'], facts: [{ factId: p + 'current_danger', in: ['disproved'] }], notFlags: ['casualty:untreated', 'casualty:awaiting_transport'] } };
  }
  // Before the route is checked: the squad can look at the doorway itself.
  const route = find(s, p + 'check_route');
  if (route) {
    const look = copy(route, 'v12_protective_check_doorway_ourselves');
    words(look, 'Check the doorway yourselves', `Have the squad look at ${mina}’s doorway and the street outside from where it stands. Quicker than waiting for patrol, but the view may not be enough.`);
    look.workload = { base: 2, perSqFt: 0 };
    look.check = { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.7 }, { key: 'coordination', weight: 0.3 }], difficulty: route.check.difficulty + 4 };
    look.outcomePreview = { favorable: 'Check present danger and access without waiting for patrol.', mixed: 'The same, after a slower look.', adverse: 'The squad can’t see enough from where it stands. Patrol can still check.' };
    for (const band of ['favorable', 'mixed'] as const) for (const effect of look.outcomes[band]) if (effect.reveal) effect.text = `The squad checks the doorway and the street itself: no immediate threat, and the path through the doorway is usable. ${cal}’s relationship to ${mina} did not establish safety.`;
    look.outcomes.mixed.push({ extraMinutes: 2, text: 'The look takes longer than expected.' });
    look.outcomes.adverse = [look.outcomes.adverse.find(effect => effect.setFlags?.some(flag => flag.startsWith('used:')) && !effect.text) ?? { setFlags: [`used:${look.id}`] }, { extraMinutes: 2, text: 'The squad can’t see enough of the doorway from where it stands. Patrol can still check it.' }];
    s.stages.adapt.actions.splice(s.stages.adapt.actions.indexOf(route) + 1, 0, look);
  }
}
