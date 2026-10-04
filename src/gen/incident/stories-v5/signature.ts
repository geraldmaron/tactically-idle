import type { ActionDefinition, FactDefinition, OutcomeEffect, ScenarioDefinition } from '../../../sim/scenario-types';
import type { BuiltLocation, StageId } from '../../../sim/types';
import { hashSeed } from '../../../sim/rng';
import { withHighRiskVersionFourChoices } from '../high-risk-v4';
import { actionHR, civilianCareHR, enterCareHR, factHR, finalizeHR, HR_BANDS, injuryHR, officerCareHR, partialHR, previewHR, reqFact, reqFlag, sameHR, visibleHR, type HighRiskContext } from '../high-risk-common-v4';

// Bundles describe one coherent episode. They are not independent shuffled motives.
const EPISODES = [
  { id: 'willing_to_be_heard', leavesPhone: true, medicalNeed: false, urgentWithoutContact: false },
  { id: 'long_afternoon', leavesPhone: true, medicalNeed: true, urgentWithoutContact: false },
  { id: 'running_out_of_patience', leavesPhone: false, medicalNeed: true, urgentWithoutContact: true },
] as const;
const contactCheck = (difficulty: number): ActionDefinition['check'] => ({ kind: 'contact', ratings: [{ key: 'communication', weight: 0.75 }, { key: 'composure', weight: 0.25 }], difficulty });
const V = (flags: string[] = [], notFlags: string[] = []) => visibleHR(flags, notFlags);

/** Accepts a generated hostage baseline; owns the entire v5 business episode. */
export function withSignatureStory(input: ScenarioDefinition, built: BuiltLocation): ScenarioDefinition {
  if (input.incident?.type !== 'hostage_crisis' || built.location.setting !== 'business') throw new Error('One Last Signature needs a business hostage incident');
  const s = withHighRiskVersionFourChoices(structuredClone(input), built);
  const episode = EPISODES[hashSeed(`${input.incident.seed}:signature-v5`) % EPISODES.length];
  const ctx: HighRiskContext = { scenario: s, built, targetId: s.facts[0].spaceId, exteriorId: built.location.entries[0], difficulty: 31 + input.incident.tier * 3 };
  const make = (id: string, stage: StageId, title: string, summary: string, preview: string | ActionDefinition['outcomePreview'], extra: Partial<ActionDefinition> = {}) =>
    actionHR(ctx, id, stage, title, summary, 'radio', typeof preview === 'string' ? previewHR(preview) : preview!, { check: contactCheck(ctx.difficulty), capabilities: { rules: [], deescalation: true }, ...extra });
  const fact = (id: string, label: string, truth: boolean, claim: string, confirmed: string, disproved: string, hidden = false): FactDefinition => ({
    ...factHR(ctx, id, label, truth, claim, { confirmed, disproved }, hidden ? 'unknown' : 'reported'),
    // Hidden story beats must not become map markers or unresolved briefing spoilers.
    showWhenUnknown: !hidden, ...(hidden ? { source: null, note: null, uncertainty: 'Further details depend on the next conversation.' } : {}),
  });
  s.version = 5;
  s.title = 'One Last Signature';
  s.variantLabel = 'One Last Signature';
  s.summary = 'Ben Flores should have left the print shop ten minutes ago. He and owner Mara Holt are being held by former employee Lewis, who wants a signed statement clearing him of alleged theft. Ben still has his unsigned delivery slip.';
  s.pressureLabel = 'Two people held at the print shop';
  s.briefing = {
    known: [
      'Adult courier Ben Flores and print-shop owner Mara Holt are inside with former employee Lewis.',
      'Responding patrol saw Lewis with a handgun and heard him threaten the people inside.',
      'Lewis says Mara accused him of taking missing shop money. He demands a statement clearing him; the allegation has not been established.',
      'Ben told the dispatcher: “I only needed one signature.”',
    ],
    unknown: ['Whether Lewis will allow either person to leave', 'Whether a reliable conversation can continue after a release'],
    dispatchReason: 'SWAT was requested after patrol corroborated a handgun and threats against two people being held in the print shop.',
    teamResponsibilities: ['Get Ben and Mara to safety', 'Keep promises limited to what the team can do', 'Arrange care for anyone who needs it'],
  };
  s.facts = [
    fact('f_ben', 'Ben Flores, courier', true, 'Ben is being held in the print shop.', 'Ben is accounted for inside.', 'Ben is not inside.'),
    fact('f_mara', 'Mara Holt, shop owner', true, 'Mara is being held in her shop.', 'Mara is accounted for inside.', 'Mara is not inside.'),
    { ...fact('f_reported_weapon', 'Patrol’s handgun and threat report', true, 'Patrol saw Lewis with a handgun and heard a threat.', 'Patrol corroborates the handgun and the initial threat.', 'The report was not corroborated.'), source: 'Responding patrol' },
    fact('f_phone_consent', 'Lewis permits the changed release', episode.leavesPhone, 'Lewis has not agreed to Ben leaving his phone with Mara.', 'Ben agrees to lend Mara his phone if he can call his dispatcher outside; Lewis permits the change.', 'Ben is willing to lend his phone if he can call outside, but Lewis refuses the changed release.', true),
    fact('f_mara_refusal', 'Mara will not sign the statement', true, 'Mara has not yet given her own account.', 'Mara says, “I won’t sign something I don’t believe.” She asks whether she can leave without signing.', 'Mara’s position is still unknown.', true),
    fact('f_lost_line_threat', 'Patrol’s current danger update', episode.urgentWithoutContact, 'Patrol has not yet supplied a fresh update.', 'Patrol hears Lewis threaten to shoot Mara now and sees him raise the handgun toward her.', 'Patrol reports no new threat or visible attack. The original danger remains unresolved.', true),
    fact('f_care_needed', 'Current care needs', episode.medicalNeed, 'Their needs can be checked once they are safe.', 'Mara reports dizziness and asks for a medical assessment.', 'Neither Ben nor Mara reports a current medical need. Any recorded injury still needs care.', true),
  ];
  s.civilianOutcomes = [
    { id: 'ben', label: 'Ben Flores', factId: 'f_ben', safeFlag: 'sig_ben_safe', injuredFlag: 'sig_ben_injured', careFlag: 'sig_ben_care' },
    { id: 'mara', label: 'Mara Holt', factId: 'f_mara', safeFlag: 'sig_mara_safe', injuredFlag: 'sig_mara_injured', careFlag: 'sig_mara_care' },
  ];
  s.objectives = [{ id: 'ben', label: 'Get Ben out safely' }, { id: 'mara', label: 'Get Mara out safely' }, { id: 'care', label: 'Complete any needed care' }];
  s.stages = {
    assess: { id: 'assess', label: 'The unsigned slip', prompt: 'Ben and Mara are still inside. Start with a current account.', actions: [] },
    adapt: { id: 'adapt', label: 'One person can leave', prompt: 'Ben’s release is possible. Consider what happens to the only phone.', actions: [] },
    resolve: { id: 'resolve', label: 'Mara’s way out', prompt: 'A promise about a statement is not a promise you can make for Mara.', actions: [] },
  };
  s.stages.adapt.contextPrompts = [
    { when: { flags: ['sig_ben_safe', 'sig_contact'] }, prompt: 'Ben is safe outside. There is two-way contact with Mara; hear what she needs before making another promise.' },
    { when: { flags: ['sig_ben_safe', 'sig_contact_lost'] }, prompt: 'Ben is outside with his phone. Mara is still inside; rebuild contact or get a fresh report from patrol.' },
    { when: { flags: ['sig_phone_refused'], notFlags: ['sig_ben_safe'] }, prompt: 'Lewis refused the changed release. Ben can still leave now with his phone.' },
    { when: { flags: ['sig_independent_line'], notFlags: ['sig_ben_safe'] }, prompt: 'The negotiation phone is connected. Ben can leave with his mobile without cutting off Mara.' },
  ];
  s.stages.resolve.contextPrompts = [
    { when: { flags: ['hr_injury_pause'] }, prompt: 'An officer is hurt and cannot take part. Decide their care before continuing with the remaining team.' },
    { when: { flags: ['hr_care_mode', 'hr_care_required'] }, prompt: 'Ben and Mara are outside. Mara needs assessment; the medical crew has not yet accepted her care.' },
    { when: { flags: ['hr_care_mode'], notFlags: ['hr_care_required'] }, prompt: 'Both people are outside and report no current medical need. Agree what happens next without asking either to sign.' },
    { when: { flags: ['sig_threat_stopped'], notFlags: ['sig_mara_safe'] }, prompt: 'The immediate threat has stopped. Mara has been reached, but she still needs to get outside.' },
    { when: { flags: ['sig_mara_release_agreed'], notFlags: ['sig_mara_safe'] }, prompt: 'Lewis’s account is recorded, and he has agreed Mara can leave unsigned. She is still inside.' },
    { when: { flags: ['sig_recovery_failed'] }, prompt: 'The clarification got no reply. Mara remains inside under a specific threat; no agreement was reached.' },
    { when: { flags: ['sig_exchange_closed'] }, prompt: 'Lewis mistook hearing him for agreeing with him. He has made a current threat; one clarification is still possible.' },
    { when: { flags: ['sig_current_danger'], notFlags: ['sig_mara_heard'] }, prompt: 'Patrol reports an immediate threat to Mara. The team can try to reopen contact or use a suitable urgent response.' },
    { when: { flags: ['sig_mara_heard'] }, prompt: 'Mara will not sign. Lewis wants his account heard; preserve his words without promising her agreement.' },
  ];
  const checked: OutcomeEffect = { reveal: ['f_ben', 'f_mara', 'f_reported_weapon'], setFlags: ['sig_accounted', 'sig_ben_release_offered'], stage: 'adapt' };
  const hearBen = sameHR(make('hear_ben', 'assess', 'Hear Ben and check with patrol', 'Keep Ben on the line while patrol checks who is inside and the weapon report.', 'Learn who is inside and whether anyone can leave. Ben’s account does not settle the allegation.', { workload: { base: 4, perSqFt: 0 } }), [checked, { text: 'Ben says his mobile is the only working phone in the shop. “I only needed one signature.” Patrol confirms both people and the handgun. Lewis comes on the line: Ben can go, but Mara stays.' }]);
  const checkPatrol = sameHR(make('check_patrol', 'assess', 'Check the dispatcher and patrol accounts', 'Compare Ben’s dispatch call with patrol’s current report.', 'Establish the people, the release offer and the known contact route.', { icon: 'intel', workload: { base: 3, perSqFt: 0 }, check: { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.65 }, { key: 'coordination', weight: 0.35 }], difficulty: ctx.difficulty } }), [checked, { text: 'The dispatcher reports that Ben called from the shop’s only working phone. Patrol confirms Ben and Mara are held inside, corroborates the handgun and relays Lewis’s offer: Ben can leave; Mara stays.' }]);
  s.stages.assess.actions = [hearBen, checkPatrol, partialHR(ctx, 'assess')];

  const doors = built.location.openings.filter(o => (o.a === ctx.targetId || o.b === ctx.targetId) && ['door', 'doorway', 'sliding'].includes(o.type)).slice(0, 1).map(o => ({ openingId: o.id, blockedReason: 'The route out is blocked. This release cannot be completed.', lockedNote: 'Opening the locked route takes additional time.' }));
  const benSafe: OutcomeEffect = { setFlags: ['sig_ben_safe'], pressure: -4, text: 'Ben reaches patrol outside, still holding the unsigned delivery slip. He is safe; Mara remains inside.' };
  const releaseNow = sameHR(make('release_ben', 'adapt', 'Let Ben leave with his phone', 'Accept the offered release now. Ben takes his mobile; another working line is needed to speak with Mara.', 'Ben reaches safety immediately. Without an independent phone, the conversation inside ends.', { visibleWhen: V(['sig_accounted'], ['sig_ben_safe']), requires: { facts: [reqFact('f_ben', 'Account for Ben first')], openings: doors }, workload: { base: 2, perSqFt: 0 } }), [
    benSafe,
    { when: { notFlags: ['sig_independent_line'] }, clearFlags: ['sig_contact'], setFlags: ['sig_contact_lost'], text: 'Ben takes his phone. There is no longer a working line to Mara.' },
    { when: { flags: ['sig_independent_line'] }, text: 'The assigned negotiation phone keeps the line inside open as Ben leaves.' },
    { when: { flags: ['sig_ben_call_promised'] }, setFlags: ['sig_ben_call_made'], text: 'Outside, Ben makes the call to his delivery dispatcher that the team promised to arrange.' },
  ]);
  const askPhone = make('ask_phone', 'adapt', 'Ask Ben to leave his phone with Mara', 'Ask before changing the release. Promise Ben a call to his delivery dispatcher once he is outside.', {
    favorable: 'If Lewis agrees, Ben leaves safely and Mara keeps the line. A refusal leaves the immediate release open.',
    mixed: 'The request takes longer. If accepted, Ben leaves safely; a refusal still leaves the immediate release open.',
    adverse: 'Lewis refuses the change. Ben can still leave immediately with his phone.',
  }, { visibleWhen: V(['sig_accounted'], ['sig_ben_safe', 'sig_independent_line']), requires: { facts: [reqFact('f_ben', 'Account for Ben first')], openings: doors }, workload: { base: 5, perSqFt: 0 } });
  const asked: OutcomeEffect = { reveal: ['f_phone_consent'], setFlags: ['sig_ben_call_promised'] };
  const accepted: OutcomeEffect[] = [
    { truth: [{ factId: 'f_phone_consent', is: true }], ...benSafe },
    { truth: [{ factId: 'f_phone_consent', is: true }], setFlags: ['sig_contact', 'sig_phone_left', 'sig_ben_call_made'], text: 'Ben agrees to lend Mara his phone, provided he can call his dispatcher outside. Lewis permits it. Once outside, Ben makes the promised call using patrol’s phone.' },
    { truth: [{ factId: 'f_phone_consent', is: false }], setFlags: ['sig_phone_refused'], text: 'Lewis refuses the change: “He goes with what he came in with.” Ben’s immediate release is still available.' },
  ];
  askPhone.outcomes = { favorable: [asked, ...accepted], mixed: [asked, ...accepted, { extraMinutes: 3, text: 'Lewis makes the team repeat the request before giving his answer. The request kept Ben inside for three extra minutes before Lewis gave his answer.' }], adverse: [{ setFlags: ['sig_ben_call_promised', 'sig_phone_refused'], text: 'Lewis refuses the request. Ben can still leave now with his phone, and the promise of an outside call still stands.' }] };
  const phone = sameHR(make('independent_phone', 'adapt', 'Connect the negotiation phone', 'A trained negotiator uses the assigned working phone to establish a separate line inside.', 'A real two-way line lets Ben leave with his mobile without cutting off Mara.', { visibleWhen: V(['sig_accounted'], ['sig_contact', 'sig_mara_heard']), requires: { allTags: ['throw_phone'], certs: ['crisis_negotiation'] }, equipment: [{ tag: 'throw_phone', value: 7, range: 'opening', label: 'Assigned negotiation phone' }], workload: { base: 4, perSqFt: 0 } }), [{ setFlags: ['sig_contact', 'sig_independent_line'], clearFlags: ['sig_contact_lost'], text: 'The trained negotiator establishes a working two-way line on the assigned phone. Ben’s mobile is no longer the only route to the people inside.' }]);
  const relay = make('relay_contact', 'adapt', 'Ask patrol to relay an exchange', 'Ask patrol to pass on an invitation to talk and wait for an answer. A relayed conversation is slower than a phone.', {
    favorable: 'Lewis answers through patrol. A slower two-way conversation is possible without a phone.',
    mixed: 'Lewis answers after a longer wait. The relayed conversation can continue.',
    adverse: 'No answer comes back. The people inside cannot be understood through a one-way invitation alone.',
  }, { visibleWhen: V(['sig_ben_safe', 'sig_contact_lost'], ['sig_contact', 'sig_relay_attempted']), workload: { base: 8, perSqFt: 0 } });
  const relayed: OutcomeEffect = { setFlags: ['sig_relay_attempted', 'sig_contact', 'sig_relay_contact'], clearFlags: ['sig_contact_lost'], text: 'Patrol relays Lewis’s answer and checks that replies can pass both ways. It is slower, but Mara can now be heard without Ben’s phone.' };
  relay.outcomes = { favorable: [relayed], mixed: [relayed, { extraMinutes: 4, text: 'The team waits through a long gap before Lewis answers patrol.' }], adverse: [{ setFlags: ['sig_relay_attempted'], text: 'The invitation gets no reply. No contact or agreement is claimed; a phone or a fresh patrol report remains possible.' }] };
  const hearMara = sameHR(make('hear_mara', 'adapt', 'Ask Mara what is keeping her inside', 'With Ben safe and two-way contact established, give Mara room to speak for herself.', 'Hear Mara’s position in her own words. No one can promise her signature for her.', { visibleWhen: V(['sig_ben_safe', 'sig_contact'], ['sig_mara_heard']), requires: { flags: [reqFlag('sig_contact', 'Two-way contact with Mara is needed'), reqFlag('sig_ben_safe', 'Complete Ben’s release first')] }, workload: { base: 4, perSqFt: 0 } }), [{ reveal: ['f_mara_refusal'], setFlags: ['sig_mara_heard'], stage: 'resolve', text: 'Mara says, “I won’t sign something I don’t believe.” Lewis answers that nobody listened when the shop money went missing. His accusation remains disputed. Mara asks if she can leave without signing.' }]);
  const update = sameHR(make('lost_line_update', 'adapt', 'Get patrol’s current update', 'With the phone gone, ask patrol what they can actually see and hear now.', 'A fresh report may establish immediate danger. Silence alone cannot establish it.', { visibleWhen: V(['sig_ben_safe', 'sig_contact_lost'], ['sig_contact']), icon: 'intel', workload: { base: 2, perSqFt: 0 } }), [
    { reveal: ['f_lost_line_threat'], setFlags: ['sig_patrol_updated'], text: 'Patrol checks the present situation. Ben remains safe outside.' },
    { truth: [{ factId: 'f_lost_line_threat', is: true }], setFlags: ['sig_current_danger'], stage: 'resolve', text: 'Patrol hears Lewis threaten to shoot Mara now and sees him raise the handgun toward her. This is a new, specific danger report.' },
    { truth: [{ factId: 'f_lost_line_threat', is: false }], text: 'Patrol reports no new threat or visible attack. A reliable conversation is still needed; no emergency response is authorized by silence.' },
  ]);
  s.stages.adapt.actions = [releaseNow, askPhone, phone, relay, hearMara, update, partialHR(ctx, 'adapt')];

  const agreement: OutcomeEffect = { setFlags: ['sig_account_recorded', 'sig_mara_release_agreed'], clearFlags: ['sig_current_danger', 'sig_exchange_closed'], pressure: -5, text: 'Lewis gives his account for the dispatch recording. The team makes no finding about the money and promises no signature. He agrees to let Mara leave without signing.' };
  const offer = make('record_account', 'resolve', 'Offer to record Lewis’s account', 'Offer a recorded account of what Lewis says happened to the money. Make clear that Mara does not have to sign or agree.', {
    favorable: 'Lewis accepts the limited offer and agrees to Mara leaving unsigned.',
    mixed: 'Lewis accepts after a longer discussion. Mara’s release remains a separate step.',
    adverse: 'Lewis mistakes recording his account for endorsing it. The exchange breaks down; one clarification remains possible.',
  }, { visibleWhen: V(['sig_mara_heard'], ['sig_mara_release_agreed', 'sig_exchange_closed']), requires: { flags: [reqFlag('sig_contact', 'Keep two-way contact'), reqFlag('sig_mara_heard', 'Hear Mara’s position first')] }, workload: { base: 6, perSqFt: 0 } });
  offer.outcomes = { favorable: [agreement], mixed: [agreement, { extraMinutes: 5, text: 'Lewis repeats parts of his account before accepting the limit. Mara waits through the longer discussion.' }], adverse: [
    { setFlags: ['sig_exchange_closed', 'sig_current_danger'], pressure: 8, text: 'Lewis says, “So you agree she lied?” When corrected, he stops answering the team. One clarification of what recording means remains possible.' },
    { when: { flags: ['sig_relay_contact'] }, text: 'Patrol hears Lewis threaten to shoot Mara now and immediately relays his words. The danger cue is current and specific.' },
    { when: { notFlags: ['sig_relay_contact'] }, text: 'The connected phone carries Lewis’s immediate threat to shoot Mara. The danger cue is current and specific.' },
  ] };
  const clarify = make('clarify_recording', 'resolve', 'Clarify what the recording can promise', 'State once that his words can be preserved, but nobody is promising to clear the allegation or make Mara sign.', {
    favorable: 'Lewis answers, accepts the limit and agrees to let Mara leave.',
    mixed: 'Lewis answers after a delay and accepts the same limited agreement.',
    adverse: 'Lewis does not answer. The exchange stays closed and Mara remains inside.',
  }, { visibleWhen: V(['sig_exchange_closed'], ['sig_mara_release_agreed']), requires: { flags: [reqFlag('sig_contact', 'The established contact route must remain available')] }, workload: { base: 6, perSqFt: 0 } });
  clarify.outcomes = { favorable: [agreement, { setFlags: ['sig_exchange_recovered'], text: 'The clarification separates hearing Lewis from agreeing with him. He continues the exchange.' }], mixed: [agreement, { setFlags: ['sig_exchange_recovered'], extraMinutes: 4, text: 'After a long silence, Lewis answers the clarification. The narrower promise holds.' }], adverse: [{ setFlags: ['sig_recovery_failed'], pressure: 5, text: 'Lewis does not answer the clarification. No agreement or recording is claimed; Mara is still inside.' }] };
  const emergency = make('urgent_protection', 'resolve', 'Authorize urgent protection for Mara', 'Commit the qualified, equipped team to the current specific threat. Mara’s move to safety and any injuries still need attention.', {
    favorable: 'The team stops the immediate threat. Mara can then be brought to safety.',
    mixed: 'The threat is stopped, but an officer is wounded. The plan pauses for that casualty.',
    adverse: 'The attempt fails. An officer and Mara are injured; the threat and care needs remain unresolved.',
  }, { icon: 'shield', visibleWhen: V(['sig_ben_safe', 'sig_current_danger'], ['sig_mara_release_agreed', 'sig_threat_stopped']), requires: { flags: [reqFlag('sig_current_danger', 'A current specific threat to Mara is required')], certs: ['entry_team'], anyTags: ['response_sidearm', 'response_carbine', 'response_shotgun'], openings: doors }, check: { kind: 'execution', ratings: [{ key: 'shooting', weight: 0.45 }, { key: 'composure', weight: 0.3 }, { key: 'coordination', weight: 0.25 }], difficulty: ctx.difficulty + 11 }, capabilities: { rules: ['authorized_response'], required: ['authorized_response'], responseContext: 'constrained' }, consequenceLevel: 'high', tempo: 'urgent', workload: { base: 4, perSqFt: 0 } });
  const stopped: OutcomeEffect = { setFlags: ['sig_threat_stopped', 'sig_mara_release_agreed', 'sig_urgent_used'], clearFlags: ['sig_current_danger', 'sig_exchange_closed'], pressure: -8, text: 'The qualified team stops the immediate threat. Mara is reached but still needs to be brought outside. No agreement about the missing money was made.' };
  emergency.outcomes = { favorable: [stopped], mixed: [stopped, injuryHR('wounded', 'Wounded during urgent protection at the print shop')], adverse: [{ setFlags: ['sig_urgent_used', 'sig_mara_injured', 'hr_care_required'], civilian: -10, text: 'Urgent protection fails to stop the threat. Mara is injured and remains inside. Ben remains safe outside.' }, injuryHR('serious', 'Seriously injured during urgent protection at the print shop')] };
  const maraOut = sameHR(make('bring_mara_out', 'resolve', 'Bring Mara to safety', 'Complete the agreed release or the interrupted protection step. Meet Mara outside and ask about immediate care needs.', 'Mara reaches safety. Check her needs separately from whether Lewis accepted a conversation.', { icon: 'shield', visibleWhen: V(['sig_ben_safe', 'sig_mara_release_agreed'], ['sig_mara_safe']), requires: { flags: [reqFlag('sig_mara_release_agreed', 'Mara needs an agreed release or the immediate threat stopped')], facts: [reqFact('f_mara', 'Account for Mara first')], openings: doors }, workload: { base: 4, perSqFt: 0 } }), [
    { setFlags: ['sig_mara_safe', 'hr_people_safe', 'hr_primary_complete', 'hr_care_checked'], reveal: ['f_care_needed'], clearFlags: ['sig_current_danger'], text: 'Mara reaches patrol outside. Both held people are safe. Ben folds the unsigned delivery slip into his pocket; Mara has signed no statement.' },
    { truth: [{ factId: 'f_care_needed', is: true }], setFlags: ['hr_care_required'], text: 'Asked about her immediate needs, Mara reports dizziness and asks for medical assessment.' },
    { truth: [{ factId: 'f_care_needed', is: false }], text: 'Ben and Mara report no current medical need. Any separately recorded injury still requires care.' },
    ...enterCareHR(),
  ]);
  // A fresh threat changes the choice, but does not arbitrarily remove ways to talk.
  const phoneLater = { ...structuredClone(phone), id: 'hr_independent_phone_later', stage: 'resolve' as const };
  const relayLater = { ...structuredClone(relay), id: 'hr_relay_contact_later', stage: 'resolve' as const };
  const hearLater = { ...structuredClone(hearMara), id: 'hr_hear_mara_later', stage: 'resolve' as const };
  const ambulance = s.externalServices!.find(service => service.id === 'civilian_ambulance')!;
  const civilianCare = civilianCareHR(ctx, ['sig_mara_care']);
  const careCopy: Record<string, { title: string; summary: string; effect: string }> = {
    hr_civilian_request: { title: 'Request Mara’s ambulance', summary: ambulance.available ? `The crew can reach Mara in ${ambulance.arrivalMinutes} operation minutes. She stays with the team until they receive her.` : 'No crew can attend in this response window. Mara’s need for assessment remains open.', effect: ambulance.available ? 'An ambulance is on its way for Mara. Ben waits safely outside; Mara stays with the team until the crew receives her.' : 'Dispatch cannot provide a receiving ambulance in this window. Mara’s medical assessment is still needed.' },
    hr_civilian_wait: { title: 'Wait with Mara for the crew', summary: 'Stay with Mara through the crew’s remaining response time.', effect: 'The ambulance’s remaining response time passes while the team stays with Mara. The crew still needs to receive her.' },
    hr_civilian_agreement: { title: 'Discuss assessment with Mara', summary: 'Explain the available medical assessment and ask Mara whether she agrees.', effect: 'Mara agrees to the medical assessment. Ben remains safe outside; he is not recorded as a patient.' },
    hr_civilian_aid: { title: 'Give Mara first aid while waiting', summary: 'A qualified participating medic uses one assigned trauma kit for Mara’s immediate need.', effect: 'The medic gives Mara first aid using one trauma kit. She still needs the medical crew’s assessment.' },
    hr_civilian_transfer: { title: 'Transfer Mara to the medical crew', summary: 'The arrived crew receives Mara and accepts her care. Any injured officer needs a separate receiver.', effect: 'The ambulance crew receives Mara and accepts her care. Ben remains safe with patrol. Any injured officer has already reached a separate medical receiver.' },
    hr_civilian_next_step: { title: 'Agree Ben and Mara’s next steps', summary: 'Both are safe and report no current medical need. Ask what they need next without requiring a signature.', effect: 'Ben leaves with his unsigned delivery slip. Mara chooses to speak with the follow-up officer after a break. Neither is asked to sign a statement clearing the allegation.' },
  };
  for (const action of civilianCare) {
    const copy = careCopy[action.id];
    if (!copy) continue;
    action.title = copy.title; action.task = copy.title; action.summary = copy.summary;
    action.outcomePreview = previewHR(copy.summary);
    for (const effects of Object.values(action.outcomes)) for (const effect of effects) if (effect.text) effect.text = copy.effect;
  }
  ambulance.label = 'Mara’s receiving ambulance';
  ambulance.description = 'The crew can receive Mara after she reaches safety and agrees to medical assessment. Ben is already safe outside.';
  s.stages.resolve.actions = [offer, clarify, emergency, maraOut, phoneLater, relayLater, hearLater, partialHR(ctx, 'resolve'), ...officerCareHR(ctx, 'resolve'), ...civilianCare];

  // Specific epilogues lead with committed human outcomes. Partial endings have
  // separate summaries so the final screen also reflects who actually got out.
  const partials = [
    { id: 'v5_sig_partial_inside', when: { notFlags: ['sig_ben_safe'] }, title: 'Both are still inside', text: 'Ben and Mara are still inside. Ben’s delivery slip is still waiting for its signature; neither release is complete.' },
    { id: 'v5_sig_partial_ben', when: { flags: ['sig_ben_safe'], notFlags: ['sig_mara_safe'] }, title: 'Ben is out; Mara is still inside', text: 'Ben is outside with his unsigned slip. Mara is still inside; her safety remains unresolved.' },
    { id: 'v5_sig_partial_care', when: { flags: ['sig_ben_safe', 'sig_mara_safe', 'hr_care_required'] }, title: 'Both are out; Mara’s care is pending', text: 'Ben and Mara are outside. Ben is safe with patrol, but no medical crew has accepted Mara’s care.' },
    { id: 'v5_sig_partial_next', when: { flags: ['sig_ben_safe', 'sig_mara_safe'], notFlags: ['hr_care_required'] }, title: 'Both are out; the next step is open', text: 'Ben and Mara are outside and report no current medical need. Their next steps, and any recorded officer care, are not yet complete.' },
  ];
  for (const partial of partials) s.endings[partial.id] = { ...structuredClone(s.endings.partial), id: partial.id, title: partial.title, summary: partial.text };
  for (const stage of Object.values(s.stages)) for (const action of stage.actions) for (const band of HR_BANDS) {
    const effects = action.outcomes[band];
    if (!effects.some(effect => effect.ending)) continue;
    if (effects.some(effect => effect.ending === 'partial')) {
      for (const effect of effects) if (effect.ending === 'partial') { delete effect.ending; delete effect.text; delete effect.objective; }
      effects.unshift(...partials.map(partial => ({ when: partial.when, ending: partial.id, objective: 20, text: partial.text })));
      action.title = 'End with the progress made';
      action.summary = 'Keep the actual releases, injuries and open care needs in the record.';
      action.task = action.title;
    }
    effects.push(
      { when: { flags: ['sig_account_recorded'] }, text: 'Lewis’s account is preserved on the dispatch recording. The missing-money allegation remains disputed; Mara was not made to sign.' },
      { when: { flags: ['sig_ben_call_made'] }, text: 'Ben reached his delivery dispatcher, as promised.' },
      { when: { flags: ['sig_ben_call_promised'], notFlags: ['sig_ben_call_made'] }, text: 'The promised call for Ben has not happened.' },
      { when: { flags: ['sig_urgent_used'] }, text: 'The record includes the urgent response and any recorded injuries, separate from the allegation about the money.' },
    );
  }
  s.endings.protection_complete.title = 'Outside, with nothing signed';
  s.endings.protection_complete.summary = 'Ben leaves safely with his unsigned delivery slip. Mara chooses to speak with the follow-up officer after a break. Neither reports a current medical need, and any injured officer has reached a medical crew. No statement clearing the allegation was signed.';
  s.endings.care_accepted.title = 'Outside, with care accepted';
  s.endings.care_accepted.summary = 'Ben is safe with patrol and the receiving crew has accepted Mara’s care. Any injured officer has also reached a medical receiver. The unsigned delivery slip is still with Ben; the missing-money allegation is unresolved.';
  s.endings.partial.title = 'The shop is not finished';
  s.endings.partial.summary = 'The record preserves who got outside, any injuries and care still needed. The team has not completed both people’s protection and care.';
  s.endings.partial.remainingTasks = ['Complete any unfinished protection for Ben or Mara', 'Complete any outstanding civilian or officer care'];
  finalizeHR(s);
  // Reusing stable care semantics does not reuse live v4 action IDs or flags.
  return JSON.parse(JSON.stringify(s).replace(/hr_/g, 'v5_sig_').replace(/\bf_(ben|mara|reported_weapon|phone_consent|mara_refusal|lost_line_threat|care_needed)\b/g, 'v5_sig_$1')) as ScenarioDefinition;
}
