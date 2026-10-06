import { ADDITIONAL_FRAMEWORK_BY_TYPE } from '../../content/incident-frameworks-v9';
import type { IncidentFramework } from '../../content/incident-frameworks-v9';
import { scenarioRecipe } from '../../content/scenario-recipes';
import type { ActionDefinition, FactDefinition, ScenarioDefinition, StageDefinition } from '../../sim/scenario-types';
import type { BuiltLocation, StageId } from '../../sim/types';
import { findStoryRoute, selectStoryRoom, storyPoint, validateStoryBindings } from '../../sim/story-bindings';
import { hashSeed } from '../../sim/rng';
import { placeFrameworkPerson, roomPhrase } from './placement-v10';

/** Compile coherent reports into ordinary engine actions, facts, geometry and endings.
 * No special completion or UI bypass: the real dispatcher owns every outcome.
 */
export function withAdditionalFramework(input: ScenarioDefinition, built: BuiltLocation, override?: IncidentFramework): ScenarioDefinition {
  // `override` lets authoring gates compile a draft package (or a deliberate reskin) for the
  // spec's framework slot without registering it; the game always uses the registry.
  const spec = input.incident!, framework = override ?? ADDITIONAL_FRAMEWORK_BY_TYPE[spec.type];
  if (!framework) throw new Error(`No framework for ${spec.type}`);
  const recipe = scenarioRecipe(spec), variant = recipe.variant;
  const s = structuredClone(input), prefix = `v9_${spec.type}_`;
  const name = framework.name.split(' ')[0], personId = framework.personId;
  const outside = built.location.entries[0];
  const timeOfDay = spec.type === 'person_in_crisis' || spec.type === 'burglary' ? 'night' : 'day';
  // v10 places the person by role-to-room affinity over the whole building, upstairs
  // included, and some first reports name a plausible wrong room. v1-v9 keep their
  // original ground-floor selection exactly, so issued calls regenerate unchanged.
  const placed = spec.contentVersion >= 10 ? placeFrameworkPerson(built, { type: spec.type, variant, seed: spec.seed, buildingSeed: spec.buildingSeed, timeOfDay, arrivalId: outside }) : null;
  if (spec.contentVersion >= 10 && !placed) throw new Error(`No compatible room for ${recipe.id}`);
  const room = placed?.room ?? selectStoryRoom(built, { floor: 0, types: built.location.setting === 'business' ? ['office', 'storage'] : ['living', 'bedroom'], reachableFromSpaceId: outside }, hashSeed(`${spec.seed}:scene-v9`));
  if (!room) throw new Error(`No compatible room for ${recipe.id}`);
  // Generated street frontages are often too tight for the 1 ft room clearance. Outside,
  // v10 accepts half a foot rather than discarding an otherwise playable building.
  const at = placed?.at ?? storyPoint(built, room.id, spec.seed), exitAt = storyPoint(built, outside, spec.seed) ?? (placed ? storyPoint(built, outside, spec.seed, [], .5) : null);
  const route = placed?.route ?? findStoryRoute(built, room.id, outside, 'walking');
  if (!at || !exitAt || !route) throw new Error(`No physical route for ${recipe.id}`);
  // Everything public (briefing, claim, map marker, where actions aim) uses the reported
  // room; only checking the person in person reveals the actual one (story-people.ts).
  const reportedRoom = placed?.reported.room ?? room, reportedAt = placed?.reported.at ?? built.derived.spaces[room.id].centroid;
  const here = placed ? roomPhrase(built, reportedRoom) : `the ${room.label.toLowerCase()}`;
  const personFact = prefix + 'person', evidence = prefix + 'evidence', accounted = prefix + 'accounted', prepared = prefix + 'prepared', heard = prefix + 'heard', completed = prefix + 'completed';
  // Each situation fixes the answer to the disputed point, so its label would spoil
  // the check. Cards show the framework title; the ending explains what was found.
  s.version = 9; s.title = framework.title; s.variantLabel = framework.title; s.summary = framework.opening;
  s.briefing = { dispatchReason: framework.dispatch, known: [framework.opening, `Dispatch places ${name} in ${here} at ${built.location.name}.`], unknown: [framework.question],
    teamResponsibilities: ['Check the disputed point before acting on it.', 'Act only on what the people involved agree to.'] };
  s.pressure = { start: 5, perMinute: .1, threshold: 95, civilianPerMinute: 0 }; s.pressureLabel = 'Time to check accounts';
  s.environment = { timeOfDay, weather: 'clear', power: 'on', clutter: 0, hazards: [], communication: 'normal', crowd: 0, keyholder: spec.type === 'burglary', plansOnFile: false, alarm: spec.type === 'burglary' ? 'triggered' : 'none', cctv: false };
  const fact = (id: string, label: string, claim: string, truth: boolean, initial: FactDefinition['initial'], spaceId = room.id): FactDefinition => ({
    id, label, claim, truth, initial, spaceId, showWhenUnknown: false, markers: { reported: 'REPORTED', confirmed: 'CHECKED', disproved: 'CORRECTED' },
    source: initial === 'reported' ? 'Dispatch report' : null, note: 'Check the account before choosing a response.', uncertainty: framework.question,
  });
  s.facts = [
    { ...fact(personFact, framework.name, `${name} is reported in ${here}.`, true, 'reported', reportedRoom.id), storyPersonId: personId,
      // A wrong-room report has no exact point inside the reported room; the binding's
      // initial anchor holds the actual position until the person is checked.
      person: placed?.misreported ? { label: framework.name, reportedAt } : { label: framework.name, at, reportedAt }, resolved: { confirmed: `${name} is accounted for.`, disproved: 'The location report needs correction.' } },
    { ...fact(evidence, framework.factLabel, framework.claim, framework.truth[variant], 'unknown'), resolved: { confirmed: framework.confirmed, disproved: framework.disproved } },
  ];
  s.objectives = [{ id: accounted, label: 'Hear the first account' }, { id: evidence, label: 'Check the disputed point' }, { id: completed, label: 'Carry out the agreed next step' }];
  s.civilianOutcomes = [{ id: personId, label: framework.name, factId: personFact, safeFlag: completed, injuredFlag: prefix + 'injured', careFlag: prefix + 'care' }];
  s.externalServices = [];
  s.story = { archetypeId: spec.type, version: 3, episodeId: `${recipe.id}:${spec.seed}`, seed: spec.seed,
    episode: { variantId: `${spec.type}:${variant}`, modules: [spec.type, `report_variant_${variant}`], publicContext: [] },
    bindings: { rooms: { scene: { spaceId: room.id } }, exterior: { arrival: { spaceId: outside } }, routes: { exit: { fromSpaceId: room.id, toSpaceId: outside, openingIds: route, profile: 'walking' } },
      people: { [personId]: { id: personId, label: framework.name, publicKind: 'civilian', locationFactId: personFact, initial: { spaceId: room.id, at }, reported: { spaceId: reportedRoom.id, at: reportedAt }, transitions: [] } }, props: {} } };
  const make = (key: string, stage: StageId, title: string, kind: ActionDefinition['check']['kind']): ActionDefinition => ({
    id: prefix + key, stage, title, summary: title, task: title, icon: kind === 'observation' ? 'search' : 'radio', targetId: reportedRoom.id,
    requires: { notFlags: [{ flag: `used:${prefix + key}`, reason: 'This step is already recorded' }] }, check: { kind, ratings: [{ key: kind === 'observation' ? 'awareness' : kind === 'coordination' ? 'coordination' : 'communication', weight: 1 }], difficulty: 28 + spec.tier * 3 },
    approach: 'none', observes: [], workload: { base: 3, perSqFt: 0 }, stressBase: 1,
    outcomes: { favorable: [], mixed: [], adverse: [] }, consequenceLevel: 'low',
  });
  const first = make('hear_person', 'assess', framework.approaches[0], 'contact');
  const second = make('check_source', 'assess', framework.approaches[1], 'observation');
  for (const [index, action] of [first, second].entries()) for (const band of ['favorable', 'mixed', 'adverse'] as const) action.outcomes[band] = [{ setFlags: [accounted, index === 1 ? prepared : heard], objective: 10,
    stage: 'adapt', text: framework.approachResults[index] + (band === 'adverse' ? ' It takes longer than expected, and the main question is still open.' : ''), ...(band === 'adverse' ? { extraMinutes: 2 } : {}) }];
  // A real trade-off: the first account helps the final agreed step, while the
  // independent source helps the disputed-point check and costs a minute more.
  first.summary = 'Start with the people involved. Knowing what they want makes the agreed next step more likely to go smoothly.';
  second.summary = 'Start with an independent source. It makes the later check more reliable but takes one extra minute.'; second.workload.base = 4;
  const verify = make('verify', 'adapt', framework.verify, 'contact');
  verify.summary = 'Check the disputed point in person. The answer decides which next step you can offer.';
  const observes = placed?.misreported ? [reportedRoom.id, room.id] : [room.id];
  verify.approach = 'path'; verify.observes = observes; verify.storyTargetPersonId = personId;
  verify.requires.flags = [{ flag: accounted, reason: 'Hear an account before checking the disputed point' }];
  verify.modifiers = [{ label: 'Independent source checked', when: { flags: [prepared] }, source: 'preparation', value: 6 }];
  const reached = placed?.misreported ? `${name} is not in ${here}. The team finds ${name} in ${roomPhrase(built, room)} and checks the disputed point.` : `The team reaches ${name} and checks the disputed point.`;
  for (const band of ['favorable', 'mixed'] as const) verify.outcomes[band] = [{ reveal: [personFact, evidence], objective: 25, stage: 'resolve', text: reached }];
  verify.outcomes.adverse = [{ extraMinutes: 2, text: 'The first check is inconclusive. Arrange a second check.' }];
  const retry = make('second_check', 'adapt', `Arrange a second check with ${name}`, 'contact');
  retry.requires.flags = [{ flag: `used:${verify.id}`, reason: 'First try the direct evidence check' }];
  retry.summary = 'Take longer to bring everyone together. If this check is also inconclusive, the question stays open.';
  retry.approach = 'path'; retry.observes = [...observes]; retry.workload.base = 6;
  retry.modifiers = structuredClone(verify.modifiers);
  retry.outcomes = structuredClone(verify.outcomes);
  retry.outcomes.adverse = [{ extraMinutes: 2, text: 'The second check is also inconclusive. The question stays open.' }];
  const resolutions = (['confirmed', 'disproved'] as const).map((status, index) => {
    const action = make(`resolve_${status}`, 'resolve', framework.resolutions[index], 'coordination');
    action.summary = framework.results[index]; action.storyTargetPersonId = personId;
    action.requires.facts = [{ factId: evidence, in: [status], reason: 'First check the disputed point' }];
    action.modifiers = [{ label: 'Heard the people involved first', when: { flags: [heard] }, source: 'preparation', value: 6 }];
    action.visibleWhen = { facts: [{ factId: evidence, in: [status] }] };
    const moving = framework.moveOn === status;
    if (moving) {
      action.storyRoute = 'exit'; action.storyRouteActor = 'person'; action.approach = 'path'; action.targetId = outside;
      s.story!.bindings.people[personId].transitions.push({ when: { flags: [completed] }, observed: true, to: { spaceId: outside, at: exitAt }, label: 'At the agreed outside destination' });
    }
    for (const band of ['favorable', 'mixed'] as const) action.outcomes[band] = [{ setFlags: [completed], objective: 65, ending: `resolved_${status}`, text: framework.results[index], ...(band === 'mixed' ? { extraMinutes: 2 } : {}) }];
    action.outcomes.adverse = [{ stage: 'resolve', text: 'The agreed step falls through for now. What you checked stays on record, but the step is not done.', extraMinutes: 2 }];
    action.outcomePreview = { favorable: framework.results[index], mixed: 'The same agreed step, done with a delay.', adverse: 'The step falls through and stays unfinished.' };
    return action;
  });
  const stage = (id: StageId, prompt: string, actions: ActionDefinition[]): StageDefinition => ({ id, label: id, prompt, actions });
  s.stages = { assess: stage('assess', framework.question, [first, second]), adapt: stage('adapt', 'Check the disputed point in person.', [verify, retry]), resolve: stage('resolve', 'Act on what you checked and what the people involved agreed to.', resolutions) };
  s.endings = Object.fromEntries(['confirmed', 'disproved'].map((status, index) => [`resolved_${status}`, { id: `resolved_${status}`, title: framework.resolutions[index], summary: framework.results[index], trustAdjust: 1, strain: -1, disposition: 'followup_agreed' as const, completion: { flags: [completed] } }]));
  s.endings.handed_over = { id: 'handed_over', title: 'Response unfinished', summary: 'The team could not carry out an agreed next step. The call stays open for follow-up.', trustAdjust: -2, strain: 2, disposition: 'unresolved', remainingTasks: [framework.question] };
  if (variant === 2) {
    // An incomplete first report needs independent corroboration. A direct-first
    // approach remains playable, but adds a real follow-up before verification.
    verify.requires.flags!.push({ flag: prepared, reason: 'This incomplete report needs the independent source checked' });
    const followup = structuredClone(second);
    followup.id = prefix + 'source_followup'; followup.stage = 'adapt';
    followup.requires = { notFlags: [{ flag: prepared, reason: 'The independent source is already checked' }] };
    followup.visibleWhen = { notFlags: [prepared] };
    followup.summary = 'The first report left something out. Check an independent source before the disputed point.';
    for (const effects of Object.values(followup.outcomes)) for (const effect of effects) delete effect.stage;
    s.stages.adapt.actions.unshift(followup);
    s.briefing.known.push('The first report left something out. Check an independent source before deciding the disputed point.');
  }
  applyDecisionExtensions(s, framework, { prefix, personId, evidence, heard, prepared, completed, first, second, resolutions, tier: spec.tier });
  for (const action of Object.values(s.stages).flatMap(stage => stage.actions)) for (const effects of Object.values(action.outcomes)) effects.push({ setFlags: [`used:${action.id}`] });
  const errors = validateStoryBindings(s, built); if (errors.length) throw new Error(errors.join('\n'));
  return s;
}

/** Optional v11+ decision structure from typed framework data. Each extension adds real
 * engine actions with their own costs; a framework without them is left untouched, so the
 * eight issued v9 frameworks compile byte for byte as before. */
function applyDecisionExtensions(s: ScenarioDefinition, framework: IncidentFramework, ids: {
  prefix: string; personId: string; evidence: string; heard: string; prepared: string; completed: string;
  first: ActionDefinition; second: ActionDefinition; resolutions: ActionDefinition[]; tier: number;
}): void {
  const { prefix, personId, evidence, heard, prepared, completed } = ids;
  // The resolve stage holds this same array; extensions add to the stage, so keep a copy
  // of the two resolutions in [confirmed, disproved] order before anything is inserted.
  const resolutions = [...ids.resolutions];
  const statusIndex = (status: 'confirmed' | 'disproved') => status === 'confirmed' ? 0 : 1;
  const base = (id: string, stage: StageId, title: string, summary: string): ActionDefinition => ({
    id: prefix + id, stage, title, summary, task: title, icon: 'perimeter', targetId: ids.first.targetId,
    requires: { notFlags: [{ flag: `used:${prefix + id}`, reason: 'This step is already recorded' }] },
    check: { kind: 'coordination', ratings: [{ key: 'coordination', weight: 1 }], difficulty: 28 + ids.tier * 3 },
    approach: 'none', observes: [], workload: { base: 3, perSqFt: 0 }, stressBase: 1, outcomes: { favorable: [], mixed: [], adverse: [] }, consequenceLevel: 'low',
  });
  if (framework.precaution) {
    // Act early under uncertainty, or check first and risk a slower late step.
    const p = framework.precaution, secured = prefix + 'secured', needed = resolutions[statusIndex(p.requiredFor)];
    const early = base('precaution', 'assess', p.title, p.summary);
    early.requires.notFlags!.push({ flag: secured, reason: 'This is already done' });
    for (const band of ['favorable', 'mixed', 'adverse'] as const) early.outcomes[band] = [{ setFlags: [secured], objective: 5, text: p.result + (band === 'adverse' ? ' It takes longer than expected.' : ''), ...(band === 'adverse' ? { extraMinutes: 2 } : {}) }];
    early.outcomePreview = { favorable: p.result, mixed: p.result, adverse: 'The same step, done with a delay.' };
    s.stages.assess.actions.push(early);
    needed.requires.flags = [...(needed.requires.flags ?? []), { flag: secured, reason: p.lateTitle }];
    const late = base('late_precaution', 'resolve', p.lateTitle, p.lateSummary);
    late.workload.base = 6; late.requires.notFlags!.push({ flag: secured, reason: 'This is already done' });
    late.visibleWhen = { facts: [{ factId: evidence, in: [p.requiredFor] }], notFlags: [secured] };
    // Resolve-stage steps must say they stay in resolve (the engine's scenario validator).
    for (const band of ['favorable', 'mixed'] as const) late.outcomes[band] = [{ stage: 'resolve', setFlags: [secured], objective: 5, extraMinutes: band === 'mixed' ? 3 : 2, text: p.result }];
    late.outcomes.adverse = [{ stage: 'resolve', extraMinutes: 2, text: 'It does not work this time. The step it was needed for cannot go ahead.' }];
    late.outcomePreview = { favorable: p.result, mixed: 'The same step, done with a longer delay.', adverse: 'It does not work, and the step that needed it cannot go ahead.' };
    s.stages.resolve.actions.unshift(late);
  }
  if (framework.corroborate) {
    // Both accounts before this resolution: a missed one becomes a follow-up here.
    const c = framework.corroborate, needed = resolutions[statusIndex(c.for)];
    needed.requires.flags = [...(needed.requires.flags ?? []), { flag: heard, reason: 'First hear the people involved' }, { flag: prepared, reason: 'First check the independent source' }];
    for (const [flag, template, key] of [[heard, ids.first, 'corroborate_person'], [prepared, ids.second, 'corroborate_source']] as const) {
      const follow = structuredClone(template);
      follow.id = prefix + key; follow.stage = 'resolve'; follow.summary = c.summary;
      follow.requires = { notFlags: [{ flag: `used:${follow.id}`, reason: 'This step is already recorded' }, { flag, reason: 'Already heard' }] };
      follow.visibleWhen = { facts: [{ factId: evidence, in: [c.for] }], notFlags: [flag] };
      for (const effects of Object.values(follow.outcomes)) for (const effect of effects) effect.stage = 'resolve';
      s.stages.resolve.actions.unshift(follow);
    }
  }
  if (framework.waitFor) {
    // A dependable but slow close that does not rely on the checked answer.
    const w = framework.waitFor, wait = base('wait', 'resolve', w.title, w.summary);
    wait.icon = 'wait'; wait.storyTargetPersonId = personId; wait.workload.base = 9; wait.check.difficulty = 15 + ids.tier * 2;
    wait.requires.facts = [{ factId: evidence, in: ['confirmed', 'disproved'], reason: 'First check the disputed point' }];
    for (const band of ['favorable', 'mixed', 'adverse'] as const) wait.outcomes[band] = [{ setFlags: [completed], objective: 45, ending: 'resolved_waited', text: w.result, ...(band === 'favorable' ? {} : { extraMinutes: band === 'mixed' ? 2 : 4 }) }];
    wait.outcomePreview = { favorable: w.result, mixed: 'The same, after a longer wait.', adverse: 'The same, after a much longer wait.' };
    s.stages.resolve.actions.push(wait);
    s.endings.resolved_waited = { id: 'resolved_waited', title: w.title, summary: w.result, trustAdjust: 0, strain: 0, disposition: 'followup_agreed', completion: { flags: [completed] } };
  }
}
