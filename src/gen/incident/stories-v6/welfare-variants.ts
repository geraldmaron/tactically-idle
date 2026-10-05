import type { OutcomeEffect, ScenarioDefinition } from '../../../sim/scenario-types';
import { scenarioActions } from '../../../sim/scenario-types';
import type { AppliedEpisodeModule } from './episode-plan';

const P = 'v5_welfare_';
const action = (s: ScenarioDefinition, suffix: string) => {
  const a = scenarioActions(s).find(a => a.id === P + suffix);
  if (!a) throw new Error(`Missing welfare beat ${suffix}`);
  return a;
};
const eachText = (s: ScenarioDefinition, update: (text: string) => string) => {
  for (const a of scenarioActions(s)) for (const effects of Object.values(a.outcomes)) for (const e of effects) if (e.text) e.text = update(e.text);
};

/** The later call can be independent; a duplicate report is no longer the only answer. */
export function applyWelfareVariation(s: ScenarioDefinition, variant: number): AppliedEpisodeModule {
  const independent = variant !== 0;
  const check = action(s, 'check_ada_now');
  check.title = 'Check on Ada and settle the report';
  check.summary = 'Ask about her safety now while patrol checks the scene. If she is safe and wants no further help, finish the visit; a care request stays open.';
  check.outcomePreview = {
    favorable: 'Establish current safety. Finish the visit if Ada wants no further help, or follow through on the care she requests.',
    mixed: 'Complete the same check after a longer pause; any care request still needs a receiver.',
    adverse: 'Ada is not ready to continue talking. Present safety remains uncertain; offer a shorter exchange or leave the concern open.',
  };
  check.outcomes.adverse = [{ setFlags: [P + 'ada_declined', 'used:' + check.id], pressure: 3,
    text: 'Ada says she cannot face another exchange yet and stops answering. The team keeps to the present-safety question; her silence leaves the check unfinished.' }];
  const narrow = action(s, 'offer_one_question');
  narrow.title = 'Give Ada a pause, then ask one safety question';
  narrow.summary = 'Respect her pause. Ask whether she will answer only about her safety now and any help she wants.';
  for (const band of ['favorable', 'mixed'] as const) narrow.outcomes[band].forEach(e => {
    if (e.text?.includes('single present-focused') || e.text?.includes('one-question limit')) e.text = 'After a pause, Ada accepts one brief question about her present safety. The team keeps to that limit.';
  });

  if (independent) {
    s.title = s.variantLabel = 'A Later Sighting';
    s.summary = 'Ada Reyes had just ended a frightening evening when neighbor Len Moss called again. This time he says he saw the visitor himself after patrol left. Ada is at home, and nobody has checked whether the later visit is over. Start with Len’s timing, or reach Ada while any help can still be arranged early.';
    s.briefing.known = ['Earlier officers corroborated a threat against Ada and recorded the visitor leaving.', 'Len Moss now says he personally saw the visitor return after those officers left.', 'Ada has not spoken to this team. The later report does not establish what is happening now.'];
    s.briefing.unknown = ['Whether Len’s account is independent and when the later sighting ended', 'Ada’s current safety and what help she wants'];
    s.briefing.teamResponsibilities = ['Establish the later sighting’s actual timing', 'Check Ada’s present safety independently', 'Finish the visit or provide the help she requests'];
    s.pressureLabel = 'A later sighting needs checking';
    const source = s.facts.find(f => f.id === P + 'same_source')!;
    source.truth = false;
    source.label = 'Whether the later account repeats the earlier call';
    source.claim = 'Len says he saw the visitor himself after patrol left.';
    source.resolved = { confirmed: 'The later account traces to the earlier call.', disproved: 'Len’s firsthand timing and the dispatch record establish a separate later visit. It ended before this team arrived.' };
    const threat = s.facts.find(f => f.id === P + 'current_threat')!;
    threat.claim = 'A separate later visit was reported; present danger has not been checked.';
    threat.resolved = { confirmed: 'A current threat remains.', disproved: 'Ada’s current account and patrol’s separate check establish that the later visitor has left and no immediate threat remains.' };
    s.stages.assess.prompt = 'Len claims a later firsthand sighting. Check that account first, or contact Ada now so any care request can start sooner.';
    s.stages.adapt.label = 'What is happening now';
    s.stages.adapt.prompt = 'A later visit and a present threat are different questions. Establish the timing, then check Ada’s safety now.';
    s.stages.adapt.contextPrompts = [
      { when: { flags: [P + 'ada_declined'] }, prompt: 'Ada paused the conversation. The team can offer one short present-safety check; silence is not proof that the visitor is still there.' },
      { when: { flags: [P + 'same_source_checked', P + 'contact_ready'] }, prompt: 'The later visit was real and has ended according to Len. Check Ada’s account and the present scene before closing the concern.' },
      { when: { flags: [P + 'asked_again'], notFlags: [P + 'same_source_checked'] }, prompt: 'Ada has answered about immediate needs. Len’s independent timing still needs checking; an early crew request can proceed in parallel if she wants one.' },
    ];
    s.stages.resolve.prompt = 'Ada is safe now. The later visit remains recorded; complete the help she actually requested.';
    for (const stage of ['assess', 'adapt'] as const) {
      const a = action(s, `trace_sources_${stage}`);
      a.title = 'Pin down Len’s later sighting';
      a.summary = 'Ask exactly when Len saw the visitor, and compare that timing with patrol’s departure. This does not establish Ada’s safety now.';
      for (const effects of Object.values(a.outcomes)) for (const e of effects) {
        if (e.reveal?.includes(source.id)) e.text = 'Len gives the time of a firsthand sighting after patrol left. Dispatch confirms a separate later visit, which Len says has now ended. The team still needs Ada’s account and a current scene check.';
        else if (e.when?.notFlags?.includes(P + 'asked_again')) e.text = 'Ada has not yet been asked about this later visit. The team can check her present safety without treating an old account as a new one.';
        else if (e.when?.flags?.includes(P + 'asked_again')) { e.setFlags = [...e.setFlags ?? [], P + 'contact_ready']; e.text = 'Ada has already answered about immediate help. The checked timing now lets the team finish the separate present-safety check.'; }
      }
    }
    const direct = action(s, 'ask_about_return');
    direct.title = 'Reach Ada before tracing the call';
    direct.summary = 'Ask about the reported return and what she needs right now. This can start requested care sooner; Len’s timing still needs a separate check.';
    for (const effects of Object.values(direct.outcomes)) for (const e of effects) {
      if (e.setFlags?.includes(P + 'asked_again')) {
        e.setFlags.push(P + 'contact_ready'); delete e.pressure;
        e.text = 'Ada answers from home. She says the visitor did return, but has left again. She can describe any immediate care need now; patrol and Len still need to check the timing and present scene independently.';
      }
      if (e.truth?.some(t => t.factId === P + 'care_needed' && t.is)) e.text = 'Ada asks for an assessment of a persistent headache. The receiving crew can be requested while the independent account and current safety are checked.';
      if (e.truth?.some(t => t.factId === P + 'care_needed' && !t.is)) e.text = 'Ada reports no current medical complaint and wants to remain at home once this later visit is checked.';
    }
    s.stages.adapt.actions = s.stages.adapt.actions.filter(a => a.id !== P + 'acknowledge_repeat');
    for (const a of scenarioActions(s)) for (const band of ['favorable', 'mixed', 'adverse'] as const) a.outcomes[band] = a.outcomes[band].filter(e => !e.when?.flags?.includes(P + 'repair_made'));
    eachText(s, text => text
      .replace('while the duplicated accounts are checked', 'while the later account is checked')
      .replace('while the duplicated accounts and present safety still need checking', 'while the later account and present safety still need checking')
      .replace('during the source checks. Dispatch now corrects the renewed-threat entry while retaining the earlier incident', 'during the source checks. Dispatch records the later visit and the checked absence of a current threat')
      .replace('Ada says the visitor has not returned. Patrol independently checks the present scene and finds no renewed threat. Ada is safe at home; the earlier threatening visit remains a separate, real report.', 'Ada says the later visitor has left. Patrol independently checks the present scene and confirms no immediate threat remains. Both the earlier threat and later visit stay recorded.')
      .replace('Keeping the question to the present honors the limit Ada accepted after the repeated questioning.', 'The team keeps the question to Ada’s safety now.')
      .replace('the duplicated source', 'the later account’s source')
      .replace('the duplicate report', 'the present-safety report')
      .replace('corrects the renewed-threat entry and retains the original threatening visit', 'records the later visit and its checked end without erasing the earlier threat')
      .replace('without repeating the whole evening again', 'without an unresolved present-safety question'));
    for (const e of Object.values(s.endings)) e.summary = e.summary.replace(/duplicate(?:d)? report/g, 'later report').replace(/corrected renewed-threat entry/g, 'checked later visit');
    s.endings[P + 'home'].summary = 'Ada is safe at home and has chosen to stay. Dispatch retains both the earlier threat and later visit, with the team’s current check confirming neither remains an immediate threat.';
    for (const stage of Object.values(s.stages)) for (const prompt of stage.contextPrompts ?? []) prompt.prompt = prompt.prompt.replace('Correcting the duplicate report', 'Checking the later report');
    narrow.outcomes.adverse = [{ setFlags: [P + 'exchange_ended', 'used:' + narrow.id], text: 'Ada declines further contact. The independent later sighting is established, but her present safety remains unchecked. This cannot be closed as a completed visit.' }];
    const request = action(s, 'offer_assessment');
    request.outcomePreview = { favorable: 'Ada can remain home while the crew responds; the checked later visit stays in the record.', mixed: 'Ada can remain home while the crew responds; the checked later visit stays in the record.', adverse: 'Ada can remain home while the crew responds; the checked later visit stays in the record.' };
    for (const effects of Object.values(request.outcomes)) for (const e of effects) if (e.requestSupport) e.text = 'Ada agrees to assessment at home. The community ambulance is requested. Dispatch retains the later visit and the current safety check; the team keeps contact while care is pending.';
    const receive = action(s, 'receive_ada');
    receive.requires.flags = receive.requires.flags?.map(f => ({ ...f, reason: f.flag === P + 'report_corrected' ? 'Record the checked later visit and present safety' : f.reason }));
    receive.outcomePreview = { favorable: 'The arrived crew accepts Ada’s requested assessment at home. Both visits and the current check remain recorded.', mixed: 'The arrived crew accepts Ada’s requested assessment at home. Both visits and the current check remain recorded.', adverse: 'The arrived crew accepts Ada’s requested assessment at home. Both visits and the current check remain recorded.' };
    for (const effects of Object.values(receive.outcomes)) for (const e of effects) if (e.acceptSupport) e.text = 'The community ambulance crew reaches Ada at home and accepts her care. Both visits stay recorded, together with the team’s present-safety check. Ada receives the assessment she requested.';
    s.endings[P + 'care'].summary = 'Ada is safe at home and the community ambulance crew has accepted her requested assessment. Both visits and the current safety check remain in the record.';
    const close = action(s, 'correct_and_close');
    close.title = 'Close the checked present-safety concern';
    close.summary = 'Record the later visit and its end, with Ada safe at home by her own choice.';
    close.task = close.title;
    close.requires.flags = close.requires.flags?.map(f => ({ ...f, reason: f.flag === P + 'same_source_checked' ? 'Check the source and timing of the later visit' : f.reason }));
    close.outcomePreview = { favorable: 'Ada hears what was checked and stays home as she chose.', mixed: 'Ada hears what was checked and stays home as she chose.', adverse: 'Ada hears what was checked and stays home as she chose.' };
    eachText(s, text => text.replace('source correction', 'source check'));
    for (const a of scenarioActions(s)) if (a.outcomePreview) for (const band of ['favorable', 'mixed', 'adverse'] as const) a.outcomePreview[band] = a.outcomePreview[band].replace('source correction', 'source check');
  }

  // Choosing the current check already authorizes a settled, no-care conclusion.
  // Do not make the player spend another rolled minute repeating that conclusion.
  const finish: OutcomeEffect = { truth: [{ factId: P + 'care_needed', is: false }], when: { notFlags: ['casualty:untreated', 'casualty:awaiting_transport'] },
    setFlags: [P + 'report_corrected', P + 'ada_choice_completed'], ending: P + 'home', objective: 100,
    text: independent ? 'Ada confirms she wants to stay home and needs no further help. Dispatch records the later visit and the completed present-safety check; this visit ends as she chose.' : 'Ada confirms she wants to stay home and needs no further help. Dispatch corrects the duplicate alert while keeping the original threat report. This visit ends without another retelling.' };
  for (const a of [check, narrow]) for (const band of ['favorable', 'mixed'] as const) a.outcomes[band].push(structuredClone(finish));
  return { variantId: independent ? 'independent_later_sighting' : 'duplicated_alert', modules: ['source_provenance', 'early_care_request', 'settled_visit_closure'], publicContext: [independent ? 'The later caller claims a firsthand sighting after patrol left.' : 'Two dispatch accounts may describe the same earlier incident.'] };
}
