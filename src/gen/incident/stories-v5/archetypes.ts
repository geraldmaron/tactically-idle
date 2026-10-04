import type { FactDefinition, IncidentType, ScenarioDefinition, StoryAnchor, StoryInstance, StoryPersonBinding } from '../../../sim/scenario-types';
import { scenarioActions } from '../../../sim/scenario-types';
import type { BuiltLocation } from '../../../sim/types';
import { hashSeed } from '../../../sim/rng';
import { findStoryObject, findStoryRoute, selectStoryRoom, storyPoint, validateStoryBindings, type StoryRoomSelector } from '../../../sim/story-bindings';

/** A recipe describes required world affordances; the generated layout supplies the actual IDs. */
export interface StoryArchetypeRecipe {
  id: string;
  version: number;
  room: StoryRoomSelector;
  requiredRoomId?: string;
}
export const STORY_ARCHETYPES: Partial<Record<IncidentType, StoryArchetypeRecipe>> = {
  welfare_check: { id: 'repeated_report', version: 1, room: { floor: 0, adjacentToExterior: true } },
  medical_complication: { id: 'care_and_personal_responsibility', version: 1, room: { setting: 'business', floor: 0 } },
  barricaded: { id: 'private_agreement', version: 1, room: { floor: 0, adjacentToExterior: true } },
  active_armed_incident: { id: 'danger_then_assistance', version: 1, room: { setting: 'business', requiredObjects: [{ type: 'register' }] } },
  hostage_crisis: { id: 'release_changes_communication', version: 1, room: { setting: 'business', types: ['office', 'storage'] } },
  protected_rescue: { id: 'accessible_move', version: 1, room: { floor: 0, types: ['living'] }, requiredRoomId: 'living' },
};

/** Select before authoring, so every action and sentence receives the same real target. */
export function prepareStoryShell(input: ScenarioDefinition, built: BuiltLocation): ScenarioDefinition {
  const spec = input.incident;
  const recipe = spec && STORY_ARCHETYPES[spec.type];
  if (!spec || !recipe) throw new Error('No compatible story archetype');
  const room = selectStoryRoom(built, { ...recipe.room, reachableFromSpaceId: built.location.entries[0] }, hashSeed(`${spec.seed}:${spec.buildingSeed}:${recipe.id}`));
  if (!room || (recipe.requiredRoomId && room.id !== recipe.requiredRoomId)) throw new Error(`Unsupported story layout: ${recipe.id}`);
  const s = structuredClone(input);
  s.facts[0].spaceId = room.id;
  delete s.facts[0].person;
  return s;
}

/** Bind a reviewed beat graph to world entities. Flags remain the only mutable story state. */
export function attachStoryBindings(s: ScenarioDefinition, built: BuiltLocation): ScenarioDefinition {
  const spec = s.incident!;
  const recipe = STORY_ARCHETYPES[spec.type]!;
  const target = s.facts[0].spaceId;
  const outside = built.location.entries[0];
  const seed = hashSeed(`${spec.seed}:${spec.buildingSeed}:${recipe.id}`);
  const story: StoryInstance = { archetypeId: recipe.id, version: recipe.version, episodeId: `${recipe.id}:${spec.seed}`, seed,
    bindings: { rooms: { scene: { spaceId: target } }, exterior: { arrival: { spaceId: outside } }, routes: {}, people: {}, props: {} } };
  const used: StoryAnchor[] = [];
  const point = (spaceId: string): StoryAnchor => {
    const at = storyPoint(built, spaceId, seed + used.length, used);
    if (!at) throw new Error(`No valid person anchor in ${spaceId}`);
    const anchor = { spaceId, at }; used.push(anchor); return anchor;
  };
  const route = (role: string, fromSpaceId: string, toSpaceId: string, profile: 'walking' | 'chair' = 'walking') => {
    const openingIds = findStoryRoute(built, fromSpaceId, toSpaceId, profile);
    if (!openingIds) throw new Error(`No compatible ${role} route for ${recipe.id}`);
    story.bindings.routes[role] = { fromSpaceId, toSpaceId, openingIds, profile };
  };
  route('entry', outside, target); route('exit', target, outside);
  if (spec.type === 'protected_rescue') route('chair_exit', target, outside, 'chair');
  const add = (id: string, label: string, factId: string, spaceId = target): StoryPersonBinding => {
    const initial = point(spaceId);
    const person: StoryPersonBinding = { id, label, locationFactId: factId, initial, reported: initial, transitions: [] };
    story.bindings.people[id] = person;
    const fact = s.facts.find(f => f.id === factId)!;
    fact.spaceId = spaceId;
    fact.person = { label, at: initial.at, reportedAt: initial.at };
    return person;
  };
  for (const civilian of s.civilianOutcomes ?? []) add(civilian.id, civilian.label, civilian.factId);
  const extra = (id: string, label: string, spaceId: string, claim: string, initial: FactDefinition['initial'] = 'reported') => {
    const base = structuredClone(s.facts[0]);
    const factId = `story_${id}_location`;
    s.facts.push({ ...base, id: factId, label, truth: true, initial, spaceId, showWhenUnknown: true, claim, source: 'Responding patrol', note: 'A location report is separate from any allegation.', resolved: { confirmed: `${label} is accounted for in the reported location.`, disproved: `${label} is not in the reported location.` }, uncertainty: claim, person: undefined });
    return add(id, label, factId, spaceId);
  };
  const move = (id: string, flag: string, spaceId = outside, label?: string) => story.bindings.people[id].transitions.push({ when: { flags: [flag] }, to: point(spaceId), observed: true, label: label ?? `Outside: ${built.location.zones.find(z => z.id === spaceId)?.label ?? spaceId}` });
  const carried = (id: string, label: string, holderPersonId: string) => { story.bindings.props[id] = { id, label, kind: 'carried', holderPersonId }; };
  const actions = scenarioActions(s);
  const choose = (ids: string[]) => actions.filter(a => ids.includes(a.id));
  const bindRoute = (ids: string[], role: string, destination = false) => {
    for (const action of choose(ids)) {
      action.storyRoute = role;
      // A complete current route replaces the old first-door proxy. It can choose a valid alternate path.
      delete action.requires.openings;
      if (destination) action.targetId = story.bindings.routes[role].toSpaceId;
    }
  };
  const personTarget = (ids: string[], id: string) => { for (const action of choose(ids)) action.storyTargetPersonId = id; };
  const propGate = (ids: string[], propId: string, holderPersonId: string, reason: string) => {
    for (const action of choose(ids)) action.requires.storyProps = [...action.requires.storyProps ?? [], { propId, holderPersonId, reason }];
  };
  const p = spec.type === 'hostage_crisis' ? 'v5_sig_' : spec.type === 'active_armed_incident' ? 'v5_noise_' : spec.type === 'protected_rescue' ? 'v5_chair_' : spec.type === 'welfare_check' ? 'v5_welfare_' : spec.type === 'medical_complication' ? 'v5_assistance_' : 'v5_protective_';
  const ids = (...names: string[]) => names.map(name => p + name);
  if (spec.type === 'hostage_crisis') {
    extra('lewis', 'Lewis', target, 'Patrol reports Lewis inside the print shop with Ben and Mara.');
    for (const action of actions) for (const effects of Object.values(action.outcomes)) for (const effect of effects) if (effect.reveal?.includes('v5_sig_ben')) effect.reveal.push('story_lewis_location');
    move('ben', 'sig_ben_safe'); move('mara', 'sig_mara_safe');
    carried('bens_phone', 'Ben’s mobile phone', 'ben'); carried('delivery_slip', 'Unsigned delivery slip', 'ben');
    story.bindings.props.bens_phone.transitions = [{ when: { flags: ['sig_phone_left'] }, holderPersonId: 'mara' }];
    bindRoute(ids('release_ben', 'ask_phone', 'bring_mara_out'), 'exit', true);
    propGate(ids('release_ben', 'ask_phone'), 'bens_phone', 'ben', 'Ben must still have his own phone for this release choice');
    personTarget(ids('civilian_aid', 'civilian_transfer'), 'mara');
  } else if (spec.type === 'active_armed_incident') {
    extra('grant', 'Grant', target, 'Patrol reports Grant inside the shop with Eli.');
    for (const action of actions) for (const effects of Object.values(action.outcomes)) for (const effect of effects) if (effect.reveal?.includes('v5_noise_f_eli')) effect.reveal.push('story_grant_location');
    move('eli', p + 'eli_safe');
    const register = findStoryObject(built, { spaceId: target, type: 'register' }, seed);
    if (!register) throw new Error('Eli’s shop scene requires an actual register');
    story.bindings.props.register = { id: 'register', label: 'Shop register', kind: 'mapped', objectId: register.id };
    bindRoute(ids('reach_eli'), 'entry'); bindRoute(ids('bring_eli_out'), 'exit', true);
    personTarget(ids('reach_eli', 'civilian_aid', 'civilian_transfer'), 'eli');
  } else if (spec.type === 'protected_rescue') {
    move('jun', p + 'at_pickup', outside, 'At the outside pickup');
    move('jun', p + 'jun_safe', outside, 'With the receiving team outside');
    carried('wheelchair', 'Jun’s wheelchair', 'jun');
    bindRoute(ids('reach_and_hear', 'reach_jun'), 'entry');
    bindRoute(ids('reach_pickup_assistance', 'reach_pickup_vehicle'), 'chair_exit', true);
    // The route-check beat can honestly report an access limitation. Movement must recheck it at commit.
    for (const action of choose(ids('check_chair_route'))) delete action.requires.openings;
    personTarget(ids('reach_and_hear', 'reach_jun', 'civilian_aid', 'civilian_transfer'), 'jun');
    propGate(ids('reach_pickup_assistance', 'reach_pickup_vehicle', 'vehicle_move', 'assisted_move'), 'wheelchair', 'jun', 'Jun’s wheelchair must remain with Jun for this move');
  } else if (spec.type === 'medical_complication') {
    move('rosa', p + 'outside');
    carried('shop_keys', 'Rosa’s shop keys', 'rosa'); carried('rosas_phone', 'Rosa’s mobile phone', 'rosa'); carried('cleaning_bucket', 'Rosa’s cleaning bucket', 'rosa');
    bindRoute(ids('lock_and_step_out'), 'exit', true); bindRoute(ids('receive_here'), 'entry');
    personTarget(ids('receive_here', 'receive_outside', 'aid_rosa_adapt', 'aid_rosa_resolve', 'aid_rosa_resolve_outside'), 'rosa');
    propGate(ids('lock_and_step_out', 'receive_here', 'receive_outside'), 'shop_keys', 'rosa', 'Rosa keeps her own keys throughout this arrangement');
    propGate(ids('call_supervisor'), 'rosas_phone', 'rosa', 'This call uses Rosa’s own phone');
    const exitDoor = [...story.bindings.routes.exit.openingIds].reverse().map(id => built.location.openings.find(o => o.id === id)!).find(o => o.a === outside || o.b === outside)!;
    for (const action of choose(ids('lock_and_step_out'))) for (const effects of Object.values(action.outcomes)) for (const effect of effects) if (effect.setFlags?.includes(p + 'shop_locked')) effect.openings = [...effect.openings ?? [], { openingId: exitDoor.id, state: 'locked' }];
  } else if (spec.type === 'barricaded') {
    extra('cal', 'Cal Voss', outside, 'Patrol sees Cal outside with his phone raised.', 'confirmed');
    move('mina', p + 'mina_outside');
    story.bindings.people.cal.transitions.push({ when: { flags: [p + 'cal_waits_apart'] }, to: { kind: 'offscene', label: 'With patrol away from Mina’s doorway' }, observed: true, label: 'With patrol away from Mina’s doorway' });
    carried('cals_phone', 'Cal’s mobile phone', 'cal');
    bindRoute(ids('meet_mina_outside', 'meet_at_clear_doorway'), 'exit', true);
    personTarget(ids('receive_mina', 'private_conversation'), 'mina');
  } else {
    bindRoute(ids('receive_ada'), 'entry');
    personTarget(ids('receive_ada'), 'ada');
  }
  s.story = story;
  const errors = validateStoryBindings(s, built);
  if (errors.length) throw new Error(errors.join('\n'));
  return s;
}
