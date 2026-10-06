import type { ActionDefinition, Condition, OutcomeEffect, ScenarioDefinition } from '../../sim/scenario-types';
import { scenarioActions } from '../../sim/scenario-types';
import type { BuiltLocation, OutcomeBand } from '../../sim/types';
import { publicPropBinding } from '../../sim/story-prop-knowledge';

const bands: OutcomeBand[] = ['favorable', 'mixed', 'adverse'];
const preview = (text: string) => ({ favorable: text, mixed: text, adverse: text });

/** The scene still uses the reviewed episode graph. V7 binds visible possessions,
 * current furnishings and explicit force/medical consequences to that same world. */
export function withVersionSevenScene(s: ScenarioDefinition, built: BuiltLocation): ScenarioDefinition {
  s.version = 7;
  s.story!.version = 3;
  for (const person of Object.values(s.story!.bindings.people)) person.publicKind = s.civilianOutcomes?.some(p => p.id === person.id) ? 'civilian' : 'subject';
  for (const [key, prop] of Object.entries(s.story!.bindings.props)) {
    const known = publicPropBinding(s, prop);
    if (known) s.story!.bindings.props[key] = known;
  }
  const type = s.incident!.type;
  if (type === 'active_armed_incident') bindForceScene(s, built, 'grant', 'v5_noise_urgent_response', 'v5_noise');
  if (type === 'hostage_crisis') bindForceScene(s, built, 'lewis', 'v5_sig_urgent_protection', 'sig');
  return s;
}

function bindForceScene(s: ScenarioDefinition, built: BuiltLocation, personId: string, actionId: string, prefix: string) {
  const person = s.story!.bindings.people[personId];
  const force = scenarioActions(s).find(a => a.id === actionId)!;
  force.forceProfile = { kind: 'firearm', personId, personRole: 'subject', officerExposure: true };
  force.storyTargetPersonId = personId;
  force.summary += ` Firearm use can seriously injure or kill ${person.label}, even if the protection task succeeds.`;
  force.outcomePreview = { favorable: 'Complete this immediate protection step, then check the changed scene. The separate harm result can still injure or kill.',
    mixed: 'Complete the protection step with an officer injury and delay. The separate harm result still applies to the subject.',
    adverse: 'The protection task is unfinished and other people can be injured. The separate harm result may also injure or kill the subject; reassess before continuing.' };
  const forceFlag = `v7_force_${personId}`, checked = `v7_access_${personId}`, pending = `v7_scene_pending_${personId}`;
  for (const effects of Object.values(force.outcomes)) {
    effects.push({ setFlags: [forceFlag, pending] });
    // The separate harm result may incapacitate the subject even on a failed task.
    // Describe the protection task without inventing their later conduct.
    for (const effect of effects) if (effect.text && /gunfire continues|does not stop the gunfire/i.test(effect.text)) effect.text = 'The response does not complete the protection task. The team must check the changed scene, account for injuries and continue helping the person still inside.';
  }
  const weaponFact = s.facts.find(f => f.id.endsWith('reported_weapon') || f.id.endsWith('f_gunfire'));
  if (weaponFact) s.story!.bindings.props[`${personId}_weapon`] = {
    id: `${personId}_weapon`, label: 'Firearm', kind: 'carried', holderPersonId: personId, glyph: 'weapon',
    knownWhen: { facts: [{ factId: weaponFact.id, in: ['reported', 'confirmed'] }] },
    confirmedWhen: { facts: [{ factId: weaponFact.id, in: ['confirmed'] }] },
    transitions: [{ when: { flags: [prefix === 'sig' ? 'sig_threat_stopped' : 'v5_noise_danger_ended'] }, observed: true }],
  };
  const make = (id: string, title: string, summary: string, visibleWhen: Condition, effects: OutcomeEffect[]): ActionDefinition => ({
    id, stage: 'resolve', title, summary, task: title, icon: 'medic', targetId: person.initial.spaceId,
    requires: {}, visibleWhen, check: { kind: 'coordination', ratings: [{ key: 'coordination', weight: .6 }, { key: 'composure', weight: .4 }], difficulty: 32 },
    approach: 'none', workload: { base: 3, perSqFt: 0 }, stressBase: 2, consequenceLevel: 'moderate', outcomePreview: preview(summary),
    outcomes: { favorable: structuredClone(effects), mixed: structuredClone(effects), adverse: structuredClone(effects) },
  });
  const activeCare = { flags: [checked, 'casualty:person_needs_care'], notFlags: [`person_harm:${personId}:fatal`, `person_care:${personId}:accepted`] };
  const injuryPause = prefix === 'sig' ? 'v5_sig_injury_pause' : 'v5_noise_injury_pause';
  const scene = make(`v7_check_${personId}`, `Check the changed scene around ${person.label}`, 'Give the remaining team time to establish safe medical access and check the person still waiting inside. Any recorded injury or death remains.',
    { flags: [forceFlag], notFlags: [checked, injuryPause] }, [{ setFlags: [checked, ...(prefix === 'sig' ? ['sig_threat_stopped', 'sig_mara_release_agreed'] : ['v5_noise_silent', 'v5_noise_danger_ended'])],
      clearFlags: [pending, ...(prefix === 'sig' ? ['sig_current_danger'] : ['v5_noise_response_failed'])],
      text: `The remaining team checks the changed scene and establishes medical access. ${person.label}’s recorded condition is unchanged. The civilian still inside needs the separate checked move outside.` }]);
  scene.icon = 'search'; scene.workload.base = 10; scene.approach = 'path'; scene.storyRoute = 'entry'; scene.storyRouteActor = 'squad';
  const serviceId = `v7_medical_${personId}`;
  const reference = s.externalServices?.find(service => service.kind === 'medical');
  s.externalServices!.push({ id: serviceId, label: `Medical crew for ${person.label}`, kind: 'medical', available: reference?.available ?? true,
    arrivalMinutes: reference?.arrivalMinutes ?? 8, description: `A separate crew must arrive and accept ${person.label}’s recorded injury. It does not take over the police operation.` });
  const request = make(`v7_request_${personId}`, `Request medical care for ${person.label}`, 'Ask for a receiving crew. Your team keeps responsibility until that crew arrives and accepts care.', activeCare, [{ requestSupport: [serviceId], text: `The team requests a separate medical crew for ${person.label}. Care is not yet accepted.` }]);
  const wait = make(`v7_wait_${personId}`, `Stay with ${person.label} while the crew responds`, 'Remain through the rest of this crew’s response time.', activeCare, [{ text: `The response time passes with ${person.label} still awaiting medical acceptance.` }]);
  wait.awaitSupport = serviceId; wait.workload.base = 0; wait.stressBase = 1;
  const receive = make(`v7_receive_${personId}`, `Bring the medical crew to ${person.label}`, 'The arrived crew follows the usable route and accepts the injured person. Other people’s protection and care remain separate.', activeCare, [{ acceptSupport: [serviceId], text: `The medical crew reaches ${person.label} and accepts responsibility for the recorded injury.` }]);
  receive.requires.externalSupport = [{ serviceId, status: 'available', reason: 'The receiving medical crew must arrive first' }];
  receive.personCare = { personId, kind: 'accept', serviceId }; receive.storyTargetPersonId = personId;
  receive.approach = 'path'; receive.storyRoute = 'entry'; receive.storyRouteActor = 'external_support';
  const aid = make(`v7_aid_${personId}`, `Give ${person.label} first aid`, 'A qualified participating medic uses one trauma kit for the recorded injury. Professional assessment is still required.', activeCare, [{ text: 'The medic uses a trauma kit. The care record states whether field care helped; the receiving crew is still needed.' }]);
  aid.requires.certs = ['advanced_first_aid']; aid.requires.allTags = ['medkit']; aid.consumes = [{ tag: 'medkit', qty: 1 }]; aid.personCare = { personId, kind: 'stabilize' }; aid.storyTargetPersonId = personId;
  aid.check = { kind: 'medical', ratings: [{ key: 'medical', weight: .7 }, { key: 'composure', weight: .3 }], difficulty: 40 }; aid.approach = 'path';
  aid.outcomePreview = { favorable: 'Give field care; medical acceptance is still needed.', mixed: 'Field care helps after difficulty; medical acceptance is still needed.', adverse: 'The attempt uses the kit without stabilizing the injury. The medical crew is still needed.' };
  s.stages.resolve.actions.push(scene, request, wait, aid, receive);
  if (personId === 'grant') {
    for (const action of scenarioActions(s)) for (const effects of Object.values(action.outcomes)) for (const effect of effects) {
      if (effect.when?.flags?.includes('v5_noise_danger_ended') && effect.text?.includes('stand-down was verified')) effect.text = `${person.label}’s current danger was checked. The record retains their actual condition; the criminal case is not resolved here.`;
    }
    for (const ending of Object.values(s.endings)) ending.summary = ending.summary.replace(/Grant’s stand-down is verified/g, `${person.label}’s current danger is checked`);
    const reach = scenarioActions(s).find(a => a.id === 'v5_noise_reach_eli')!;
    reach.summary = reach.summary.replace('after the stand-down', 'after the current danger check');
    for (const requirement of reach.requires.flags ?? []) if (requirement.flag === 'v5_noise_danger_ended') requirement.reason = 'Check that the immediate danger has ended';
    s.stages.resolve.contextPrompts!.unshift({ when: { flags: [checked, 'v5_noise_danger_ended'], notFlags: ['v5_noise_eli_reached'] }, prompt: 'The changed scene and medical access are checked. The civilian is still inside; follow the usable route to reach them.' });
  }
  s.stages.resolve.contextPrompts ??= [];
  s.stages.resolve.contextPrompts.unshift({ when: { flags: ['casualty:person_fatality'] }, prompt: 'A person has died. Protect anyone still in danger and keep the death in the outcome; medical care cannot reverse it.' },
    { when: { flags: ['casualty:person_needs_care'] }, prompt: `${person.label} is injured. Establish medical access and an accepting crew while continuing the unfinished civilian protection.` });
  // No injured/deceased subject is made to act out the original healthy-person script.
  const subjectActions = personId === 'grant' ? ['v5_noise_agreed_pause', 'v5_noise_return_to_pause', 'v5_noise_check_stand_down', 'v5_noise_clarify_stand_down']
    : ['v5_sig_record_account', 'v5_sig_clarify_recording'];
  for (const action of scenarioActions(s)) {
    if (subjectActions.includes(action.id)) action.storyTargetPersonId = personId;
    if (!action.id.startsWith('v7_') && action.stage === 'resolve' && !action.id.includes('officer_') && !Object.values(action.outcomes).flat().some(e => e.ending)) {
      action.visibleWhen = { ...action.visibleWhen, notFlags: [...action.visibleWhen?.notFlags ?? [], pending] };
    }
  }
  if (personId === 'grant') addCheckedLessLethal(s, built, personId, make);
  for (const action of s.stages.resolve.actions.filter(a => a.id.startsWith('v7_'))) for (const band of bands) action.outcomes[band].unshift({ setFlags: [`used:${action.id}`], stage: 'resolve' });
}

function addCheckedLessLethal(s: ScenarioDefinition, built: BuiltLocation, personId: string, make: (id: string, title: string, summary: string, visible: Condition, effects: OutcomeEffect[]) => ActionDefinition) {
  const person = s.story!.bindings.people[personId];
  const factId = 'v7_checked_response_context';
  const reference = s.facts.find(f => f.id === person.locationFactId)!;
  s.facts.push({ ...structuredClone(reference), id: factId, person: undefined, storyPersonId: personId, truth: (built.derived.spaces[person.initial.spaceId]?.capacity ?? 0) >= 2,
    initial: 'unknown', showWhenUnknown: false, label: 'Whether the current scene permits a less-lethal option', source: null, claim: 'The current person and nearby area must be checked separately from the weapon report.', note: null,
    resolved: { confirmed: 'The current check permits the qualified less-lethal options shown. Serious harm is still possible.', disproved: 'The current scene does not permit this option. Continue the conversation or record the unfinished protection.' } });
  const check = scenarioActions(s).find(a => a.id === 'v5_noise_check_stand_down')!;
  for (const effects of Object.values(check.outcomes)) effects.push({ reveal: [factId] });
  for (const [kind, label, cert, tag, supply] of [
    ['less_lethal_device', 'electrical device', 'less_lethal', 'energy_device', 'energy_cartridge'],
    ['less_lethal_impact', 'less-lethal launcher', 'advanced_less_lethal', 'impact_launcher', 'impact_supply'],
  ] as const) {
    const id = `v7_${kind}`;
    const a = make(id, `Use the checked ${label} option`, `Attempt the checked response with the assigned ${label} and one compatible supply. Injury and death remain possible; helping the civilian is still separate.`,
      { flags: ['v5_noise_silent', 'v5_noise_stand_down_missing'], notFlags: ['v5_noise_danger_ended'] }, []);
    a.icon = 'shield'; a.approach = 'path'; a.storyRoute = 'entry'; a.storyRouteActor = 'squad'; a.storyTargetPersonId = personId;
    a.requires = { certs: [cert], allTags: [tag], facts: [{ factId, in: ['confirmed'], reason: 'The present person and nearby area must permit this response' }] };
    a.consumes = [{ tag: supply, qty: 1 }]; a.capabilities = { rules: [kind], required: [kind], subjectFactIds: [person.locationFactId], safetyFactIds: [factId] };
    a.forceProfile = { kind, personId, personRole: 'subject' }; a.check = { kind: 'execution', ratings: [{ key: 'composure', weight: .6 }, { key: 'coordination', weight: .4 }], difficulty: 42 };
    const ended = { setFlags: ['v5_noise_danger_ended', 'v7_force_grant', 'v7_scene_pending_grant'], text: 'The immediate threat is stopped. The separate harm record states what happened to the subject; the civilian still needs help outside.' };
    a.outcomes = { favorable: [ended], mixed: [ended, { extraMinutes: 3, text: 'The response takes longer. Any injury and the unfinished protection still need attention.' }], adverse: [{ setFlags: ['v7_force_grant', 'v7_scene_pending_grant'], pressure: 4, text: 'The response does not complete the protection task. Reassess the changed scene and recorded injuries before another decision.' }] };
    a.outcomePreview = { favorable: 'Stop the immediate threat; harm is resolved separately.', mixed: 'Stop the threat after delay; harm is resolved separately.', adverse: 'The protection task remains unfinished. A separate harm result can still injure or kill.' };
    s.stages.resolve.actions.push(a);
  }
}
