import { ADDITIONAL_FRAMEWORK_BY_TYPE } from '../../content/incident-frameworks-v9';
import { scenarioRecipe } from '../../content/scenario-recipes';
import type { ActionDefinition, FactDefinition, ScenarioDefinition, StageDefinition } from '../../sim/scenario-types';
import type { BuiltLocation, StageId } from '../../sim/types';
import { findStoryRoute, selectStoryRoom, storyPoint, validateStoryBindings } from '../../sim/story-bindings';
import { hashSeed } from '../../sim/rng';

/** Compile coherent reports into ordinary engine actions, facts, geometry and endings.
 * No special completion or UI bypass: the real dispatcher owns every outcome.
 */
export function withAdditionalFramework(input: ScenarioDefinition, built: BuiltLocation): ScenarioDefinition {
  const spec = input.incident!, framework = ADDITIONAL_FRAMEWORK_BY_TYPE[spec.type];
  if (!framework) throw new Error(`No framework for ${spec.type}`);
  const recipe = scenarioRecipe(spec), variant = recipe.variant;
  const s = structuredClone(input), prefix = `v9_${spec.type}_`;
  const name = framework.name.split(' ')[0], personId = framework.personId;
  const outside = built.location.entries[0];
  const room = selectStoryRoom(built, { floor: 0, types: built.location.setting === 'business' ? ['office', 'storage'] : ['living', 'bedroom'], reachableFromSpaceId: outside }, hashSeed(`${spec.seed}:scene-v9`));
  if (!room) throw new Error(`No compatible room for ${recipe.id}`);
  const at = storyPoint(built, room.id, spec.seed), exitAt = storyPoint(built, outside, spec.seed);
  const route = findStoryRoute(built, room.id, outside, 'walking');
  if (!at || !exitAt || !route) throw new Error(`No physical route for ${recipe.id}`);
  const personFact = prefix + 'person', evidence = prefix + 'evidence', accounted = prefix + 'accounted', prepared = prefix + 'prepared', completed = prefix + 'completed';
  s.version = 9; s.title = framework.title; s.variantLabel = framework.variants[variant]; s.summary = framework.opening;
  s.briefing = { known: [framework.opening, `The report concerns the ${room.label.toLowerCase()} at ${built.location.name}.`], unknown: [framework.question], teamResponsibilities: [framework.question, 'Record only what was observed and agreed.'] };
  s.pressure = { start: 5, perMinute: .1, threshold: 95, civilianPerMinute: 0 }; s.pressureLabel = 'Time to check accounts';
  s.environment = { timeOfDay: spec.type === 'person_in_crisis' || spec.type === 'burglary' ? 'night' : 'day', weather: 'clear', power: 'on', clutter: 0, hazards: [], communication: 'normal', crowd: 0, keyholder: spec.type === 'burglary', plansOnFile: false, alarm: spec.type === 'burglary' ? 'triggered' : 'none', cctv: false };
  const fact = (id: string, label: string, claim: string, truth: boolean, initial: FactDefinition['initial']): FactDefinition => ({
    id, label, claim, truth, initial, spaceId: room.id, showWhenUnknown: false, markers: { reported: 'REPORTED', confirmed: 'CHECKED', disproved: 'CORRECTED' },
    source: initial === 'reported' ? 'Dispatch report' : null, note: 'Check the account before choosing a response.', uncertainty: framework.question,
  });
  s.facts = [
    { ...fact(personFact, framework.name, `${name} is reported in the ${room.label.toLowerCase()}.`, true, 'reported'), storyPersonId: personId, person: { label: framework.name, at, reportedAt: built.derived.spaces[room.id].centroid }, resolved: { confirmed: `${name} is accounted for.`, disproved: 'The location report needs correction.' } },
    { ...fact(evidence, framework.question, framework.claim, framework.truth[variant], 'unknown'), resolved: { confirmed: framework.confirmed, disproved: framework.disproved } },
  ];
  s.objectives = [{ id: accounted, label: `Hear the account involving ${name}` }, { id: evidence, label: framework.question }, { id: completed, label: 'Complete the verified, agreed next step' }];
  s.civilianOutcomes = [{ id: personId, label: framework.name, factId: personFact, safeFlag: completed, injuredFlag: prefix + 'injured', careFlag: prefix + 'care' }];
  s.externalServices = [];
  s.story = { archetypeId: spec.type, version: 3, episodeId: `${recipe.id}:${spec.seed}`, seed: spec.seed,
    episode: { variantId: `${spec.type}:${variant}`, modules: [spec.type, `report_variant_${variant}`], publicContext: [] },
    bindings: { rooms: { scene: { spaceId: room.id } }, exterior: { arrival: { spaceId: outside } }, routes: { exit: { fromSpaceId: room.id, toSpaceId: outside, openingIds: route, profile: 'walking' } },
      people: { [personId]: { id: personId, label: framework.name, publicKind: 'civilian', locationFactId: personFact, initial: { spaceId: room.id, at }, reported: { spaceId: room.id, at: built.derived.spaces[room.id].centroid }, transitions: [] } }, props: {} } };
  const make = (key: string, stage: StageId, title: string, kind: ActionDefinition['check']['kind']): ActionDefinition => ({
    id: prefix + key, stage, title, summary: title, task: title, icon: kind === 'observation' ? 'search' : 'radio', targetId: room.id,
    requires: { notFlags: [{ flag: `used:${prefix + key}`, reason: 'This step is already recorded' }] }, check: { kind, ratings: [{ key: kind === 'observation' ? 'awareness' : kind === 'coordination' ? 'coordination' : 'communication', weight: 1 }], difficulty: 28 + spec.tier * 3 },
    approach: 'none', observes: [], workload: { base: 3, perSqFt: 0 }, stressBase: 1,
    outcomes: { favorable: [], mixed: [], adverse: [] }, consequenceLevel: 'low',
  });
  const first = make('hear_person', 'assess', framework.approaches[0], 'contact');
  const second = make('check_source', 'assess', framework.approaches[1], 'observation');
  for (const [index, action] of [first, second].entries()) for (const band of ['favorable', 'mixed', 'adverse'] as const) action.outcomes[band] = [{ setFlags: [accounted, ...(index === 1 ? [prepared] : [])], objective: 10,
    stage: 'adapt', text: framework.approachResults[index] + (band === 'adverse' ? ' The exchange takes longer; the central question is still unverified.' : ''), ...(band === 'adverse' ? { extraMinutes: 2 } : {}) }];
  first.summary = `${framework.approaches[0]}. ${framework.question}`;
  second.summary = 'Check the independent source first. This prepares the later evidence check but takes one extra minute.'; second.workload.base = 4;
  const verify = make('verify', 'adapt', framework.verify, 'contact');
  verify.summary = `Check the current scene with ${name}. The result determines which next step can honestly be offered.`;
  verify.approach = 'path'; verify.observes = [room.id]; verify.storyTargetPersonId = personId;
  verify.requires.flags = [{ flag: accounted, reason: 'Hear an account before checking the disputed point' }];
  verify.modifiers = [{ label: 'Independent source checked', when: { flags: [prepared] }, source: 'preparation', value: 6 }];
  for (const band of ['favorable', 'mixed'] as const) verify.outcomes[band] = [{ reveal: [personFact, evidence], objective: 25, stage: 'resolve', text: `The team reaches ${name} and checks the disputed point against the current scene.` }];
  verify.outcomes.adverse = [{ extraMinutes: 2, text: 'The first check is inconclusive. The account remains unverified; arrange a second check.' }];
  const retry = make('second_check', 'adapt', `Arrange a second check with ${name}`, 'coordination');
  retry.requires.flags = [{ flag: `used:${verify.id}`, reason: 'First try the direct evidence check' }];
  retry.summary = 'Spend longer bringing the accounts together. An adverse result still leaves the concern unverified.';
  retry.approach = 'path'; retry.observes = [room.id]; retry.workload.base = 6;
  retry.outcomes = structuredClone(verify.outcomes);
  const resolutions = (['confirmed', 'disproved'] as const).map((status, index) => {
    const action = make(`resolve_${status}`, 'resolve', framework.resolutions[index], 'coordination');
    action.summary = framework.results[index]; action.storyTargetPersonId = personId;
    action.requires.facts = [{ factId: evidence, in: [status], reason: 'First establish which account the evidence supports' }];
    action.visibleWhen = { facts: [{ factId: evidence, in: [status] }] };
    const moving = framework.moveOn === status;
    if (moving) {
      action.storyRoute = 'exit'; action.storyRouteActor = 'person'; action.approach = 'path'; action.targetId = outside;
      s.story!.bindings.people[personId].transitions.push({ when: { flags: [completed] }, observed: true, to: { spaceId: outside, at: exitAt }, label: 'At the agreed outside destination' });
    }
    for (const band of ['favorable', 'mixed'] as const) action.outcomes[band] = [{ setFlags: [completed], objective: 65, ending: `resolved_${status}`, text: framework.results[index], ...(band === 'mixed' ? { extraMinutes: 2 } : {}) }];
    action.outcomes.adverse = [{ stage: 'resolve', text: 'The proposed next step was not completed. The verified account is retained; the agreement cannot be recorded as fulfilled.', extraMinutes: 2 }];
    action.outcomePreview = { favorable: framework.results[index], mixed: `Complete the same agreed step with a delay.`, adverse: 'The step remains unfinished; no completion or movement is claimed.' };
    return action;
  });
  const stage = (id: StageId, prompt: string, actions: ActionDefinition[]): StageDefinition => ({ id, label: id, prompt, actions });
  s.stages = { assess: stage('assess', framework.question, [first, second]), adapt: stage('adapt', 'Check the disputed point against the current scene.', [verify, retry]), resolve: stage('resolve', 'Act on the checked account and the person’s actual agreement.', resolutions) };
  s.endings = Object.fromEntries(['confirmed', 'disproved'].map((status, index) => [`resolved_${status}`, { id: `resolved_${status}`, title: framework.resolutions[index], summary: framework.results[index], trustAdjust: 1, strain: -1, disposition: 'followup_agreed' as const, completion: { flags: [completed] } }]));
  s.endings.handed_over = { id: 'handed_over', title: 'Response unfinished', summary: 'The response did not complete the verified next step. No handover, movement or agreement is claimed.', trustAdjust: -2, strain: 2, disposition: 'unresolved', remainingTasks: [framework.question] };
  if (variant === 2) {
    // An incomplete first report needs independent corroboration. A direct-first
    // approach remains playable, but adds a real follow-up before verification.
    verify.requires.flags!.push({ flag: prepared, reason: 'This incomplete report needs the independent source checked' });
    const followup = structuredClone(second);
    followup.id = prefix + 'source_followup'; followup.stage = 'adapt';
    followup.requires = { notFlags: [{ flag: prepared, reason: 'The independent source is already checked' }] };
    followup.visibleWhen = { notFlags: [prepared] };
    for (const effects of Object.values(followup.outcomes)) for (const effect of effects) delete effect.stage;
    s.stages.adapt.actions.unshift(followup);
    s.briefing.known.push('The first report is incomplete. An independent source must be checked before deciding the disputed point.');
  }
  for (const action of Object.values(s.stages).flatMap(stage => stage.actions)) for (const effects of Object.values(action.outcomes)) effects.push({ setFlags: [`used:${action.id}`] });
  const errors = validateStoryBindings(s, built); if (errors.length) throw new Error(errors.join('\n'));
  return s;
}
