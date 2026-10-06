import type { ScenarioDefinition } from '../../../sim/scenario-types';
import type { BuiltLocation } from '../../../sim/types';
import { hashSeed } from '../../../sim/rng';
import { selectStoryRoom, validateStoryBindings } from '../../../sim/story-bindings';
import { attachStoryBindings, STORY_ARCHETYPES } from '../stories-v5/archetypes';
import { withWelfareStory } from '../stories-v5/welfare';
import { withAssistanceStory } from '../stories-v5/assistance';
import { withProtectiveStory } from '../stories-v5/protective';
import { withArmedStory } from '../stories-v5/armed';
import { withSignatureStory } from '../stories-v5/signature';
import { withRescueStory } from '../stories-v5/rescue';
import { bindEpisodeCast, planEpisode, type AppliedEpisodeModule } from './episode-plan';
import { applyWelfareVariation } from './welfare-variants';
import { applyHighRiskVariation } from './high-risk-variants';
import { applyCarePrivacyVariation } from './care-privacy-variants';
import { hostsByLocation, storyArrivalsV10, storyRoomV10, withStoryArrival } from './hosts-v10';
import { placeSettingRolesV11, selectSettingV11, settingModulesFor, SETTING_MODULE_MARK } from './setting-modules-v11';

/** Compatible role/room selection precedes prose and mechanics. V1–V5 stay frozen. */
export function withVersionSixStory(input: ScenarioDefinition, built: BuiltLocation): ScenarioDefinition {
  if (!hostsByLocation(input)) return episodeAt(input, built);
  // v10 binds the episode to whichever entry of the actual building can hold it, in
  // entry order; the location's first entry still wins whenever it can.
  let failure: unknown = new Error('No exterior arrival can host this episode');
  for (const arrival of storyArrivalsV10(built, input.incident!.type)) {
    try { return episodeAt(input, withStoryArrival(built, arrival)); } catch (error) { failure = error; }
  }
  throw failure;
}

function episodeAt(input: ScenarioDefinition, built: BuiltLocation): ScenarioDefinition {
  const spec = input.incident!;
  const plan = planEpisode(spec, built);
  const recipe = STORY_ARCHETYPES[spec.type];
  if (!recipe) throw new Error('No episode binding recipe');
  const personRoom = spec.type === 'welfare_check' || spec.type === 'barricaded';
  const roomSeed = hashSeed(`${spec.seed}:${spec.buildingSeed}:${recipe.id}`);
  // v11 frameworks with setting modules take their rooms from the module that fits the
  // building (the retail module restates v10's register selector, so retail picks the same room).
  const setting = settingModulesFor(spec) ? selectSettingV11(spec, built, built.location.entries[0], roomSeed) : null;
  if (settingModulesFor(spec) && !setting) throw new Error('No setting module fits this building');
  // v10 replaces the authored room identity (requiredRoomId) with requirements on the real rooms.
  const room = setting ? setting.rooms[setting.module.scene] : hostsByLocation(input) ? storyRoomV10(built, spec.type, recipe.room, roomSeed)
    : selectStoryRoom(built, { ...recipe.room, ...(personRoom ? { types: ['living', 'bedroom'] as const } : {}), reachableFromSpaceId: built.location.entries[0] }, roomSeed);
  if (!room || !hostsByLocation(input) && recipe.requiredRoomId && room.id !== recipe.requiredRoomId) throw new Error('No compatible room for this episode');
  const shell = structuredClone(input);
  shell.facts[0].spaceId = room.id;
  delete shell.facts[0].person;
  const author = spec.type === 'welfare_check' ? withWelfareStory : spec.type === 'medical_complication' ? withAssistanceStory : spec.type === 'barricaded' ? withProtectiveStory : spec.type === 'active_armed_incident' ? withArmedStory : spec.type === 'hostage_crisis' ? withSignatureStory : withRescueStory;
  let s = attachStoryBindings(author(shell, built), built);
  // Before variants and reported-location text, so every later layer sees the module's rooms.
  if (setting) placeSettingRolesV11(s, built, setting);
  s.version = 6;
  s.environment = plan.environment;
  const module: AppliedEpisodeModule = spec.type === 'welfare_check' ? applyWelfareVariation(s, plan.variant)
    : spec.type === 'medical_complication' || spec.type === 'barricaded' ? applyCarePrivacyVariation(s, built, plan.variant)
      : applyHighRiskVariation(s, built, plan.variant);
  if (setting) module.modules.push(`${SETTING_MODULE_MARK}${setting.module.id}`);
  // These old confirm-again beats have no reachable state after the v6 follow-through.
  const spent = new Set(['v5_welfare_correct_and_close', 'v5_sig_check_civilian_needs']);
  for (const stage of Object.values(s.stages)) stage.actions = stage.actions.filter(action => !spent.has(action.id));
  s.story!.version = 2;
  s.story!.episodeId = plan.id;
  s.story!.episode = module;
  s.briefing.known = [...new Set([...s.briefing.known, ...module.publicContext])];
  // A reported room is supplied by the caller, not inferred from an invisible
  // true anchor. Exact positions remain uncertain until observed by the team.
  for (const person of Object.values(s.story!.bindings.people)) {
    const fact = s.facts.find(f => f.id === person.locationFactId)!;
    if (fact.initial !== 'reported') continue;
    const place = built.location.rooms.find(r => r.id === fact.spaceId)?.label ?? built.location.zones.find(z => z.id === fact.spaceId)?.label;
    if (place) {
      fact.claim = `${fact.claim} The report places ${person.label} in the ${place.toLowerCase()}; that location is not yet checked.`;
      fact.reportedText = fact.claim;
      fact.uncertainty = `Whether ${person.label} is in the reported ${place.toLowerCase()}`;
    }
  }
  s = bindEpisodeCast(s, plan.cast);
  s.briefing.known = [...new Set(s.briefing.known)];
  s.briefing.unknown = [...new Set(s.briefing.unknown)];
  if (s.briefing.teamResponsibilities) s.briefing.teamResponsibilities = [...new Set(s.briefing.teamResponsibilities)];
  const errors = validateStoryBindings(s, built);
  if (errors.length) throw new Error(errors.join('\n'));
  return s;
}
