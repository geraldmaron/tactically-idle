import type { CallTree, TreeChoice, TreeIf, TreeMove, TreeNext, TreeNode, TreeOutcome, TreeState } from '../../../content/call-trees/types';
import { CIVILIAN_FIRST_NAMES, CIVILIAN_SURNAMES } from '../../../content/call-trees/civilian-names';
import { scenarioRecipe } from '../../../content/scenario-recipes';
import { hashIndex, hashSeed } from '../../../sim/rng';
import { tierRewardMultiplier } from '../../../sim/incidents';
import type { ActionDefinition, ClockCondition, Condition, FactDefinition, IncidentSpec, MeterCondition, MeterStance, OutcomeEffect, ScenarioDefinition, StageDefinition, StoryPersonBinding } from '../../../sim/scenario-types';
import { findStoryRoute, selectStoryRoom, storyPoint, validateStoryBindings } from '../../../sim/story-bindings';
import { routeAlongOpenings } from '../../../sim/spatial-factors';
import type { BuiltLocation, OutcomeBand, StageId, Vec } from '../../../sim/types';
import { mapScenarioText } from '../stories-v6/episode-plan';
import { asRole, CASCADE_LINES, countWord, FIRE_LINES, FORCE_LINES, listOf } from '../../../content/incidents/lines';
import { cascadeCombos, cascadeKey, cascadeResult, withVariants } from '../../../sim/drawn-effects';

const STAGES: readonly StageId[] = ['assess', 'adapt', 'resolve'];
const BANDS: readonly OutcomeBand[] = ['favorable', 'mixed', 'adverse'];
export const TREE_STARTED = 'tree:started';
export const nodeFlag = (node: string) => `at:${node}`;
export const markFlag = (mark: string) => `mark:${mark}`;
export const safeFlag = (role: string) => `safe:${role}`;
export const outFlag = (role: string) => `out:${role}`;
const hurtFlag = (role: string) => `hurt:${role}`;
const careFlag = (role: string) => `care:${role}`;
const endFlag = (ending: string) => `end:${ending}`;
export const personFactId = (role: string) => `p_${role}`;
export const treeFactId = (key: string) => `f_${key}`;
export const choiceActionId = (type: string, node: string, choice: string) => `t13_${type}_${node}_${choice}`;

export interface CastIdentity { firstName: string; surname: string; pronouns: 'he' | 'she' | 'they'; age?: number }
/** Drawn identity per role (instance.ts): pronouns and, where the text names it, age. */
export type CastDraw = Record<string, { pronouns: 'he' | 'she' | 'they'; age?: number }>;

/** One identity per role, then per group member (`members`, in order), from a cosmetic stream keyed
 * by the call: never a mechanics draw. The civilian pool shares no name with the officer catalog, so
 * nobody inside shares a name with the squad. */
export function drawTreeCast(tree: CallTree, spec: IncidentSpec, draws: CastDraw = {}, members: readonly string[] = []): Record<string, CastIdentity> {
  const key = `${spec.type}:${spec.familyId}:${spec.buildingSeed}:${spec.seed}:cast-v13`;
  const usedFirst = new Set<string>(), usedSurname = new Map<string, string>(), taken = new Set<string>();
  const cast: Record<string, CastIdentity> = {};
  // A member has no tree role of their own: their pronouns are always drawn (instance.ts).
  for (const role of [...tree.roles, ...members.map(id => ({ id, pronouns: 'they' as const, surnameGroup: undefined }))]) {
    const pronouns = draws[role.id]?.pronouns ?? role.pronouns;
    const names = CIVILIAN_FIRST_NAMES[pronouns].filter(name => !usedFirst.has(name));
    const firstName = names[hashIndex(hashSeed(`${key}:${role.id}:first`), names.length)];
    usedFirst.add(firstName);
    const group = role.surnameGroup;
    let surname = group ? usedSurname.get(group) : undefined;
    if (!surname) {
      // Unrelated people never share a surname, so nobody reads a family tie that isn't there.
      const free = CIVILIAN_SURNAMES.filter(name => !taken.has(name));
      surname = free[hashIndex(hashSeed(`${key}:${group ?? role.id}:surname`), free.length)];
      taken.add(surname);
      if (group) usedSurname.set(group, surname);
    }
    cast[role.id] = { firstName, surname, pronouns, ...(draws[role.id]?.age !== undefined ? { age: draws[role.id].age } : {}) };
  }
  return cast;
}

// {role}, {role.first|last|room|age}, pronouns {role.he|him|his|hers|himself} (a capital first
// letter capitalizes the word), verb agreement {role~keeps|keep} (he and she take the first form,
// singular they the second), and gendered words {role^man|woman|person}. A counted role (a group)
// also takes {group.n} and number agreement after its names, {group#stands|stand} (one name takes
// the first form); its forms are in content/call-trees/types.ts. Member ids carry a number
// ({others_1.first}), which only the compiler writes.
export const TOKEN = /\{([a-z][a-z0-9_]*)(?:\.(first|last|room|age|n|[Hh]e|[Hh]im|[Hh]is|[Hh]ers|[Hh]imself)|~([^|{}]+)\|([^|{}]+)|\^([^|{}]+)\|([^|{}]+)\|([^|{}]+)|#([^|{}]+)\|([^|{}]+))?\}/g;
const PRONOUN_FORMS: Record<string, Record<'he' | 'she' | 'they', string>> = {
  he: { he: 'he', she: 'she', they: 'they' }, him: { he: 'him', she: 'her', they: 'them' }, his: { he: 'his', she: 'her', they: 'their' },
  hers: { he: 'his', she: 'hers', they: 'theirs' }, himself: { he: 'himself', she: 'herself', they: 'themselves' },
};
/** Engine tokens the binder leaves in place: `{lead}` becomes the lead officer's surname at play time. */
const ENGINE_TOKENS = new Set(['lead']);
/** Replace role tokens, `{place}`, `{scene}` and `{role.room}`; an unknown token is an authoring
 * error, never silent text. `groups` maps each counted role to its members' ids, in order: a group
 * token in a call with no members is an error too, because count conditions keep that text out of
 * lone calls. */
export function bindRoleTokens(text: string, cast: Record<string, CastIdentity>, place = '', rooms: Record<string, string> = {}, groups: Record<string, readonly string[]> = {}): string {
  return text.replace(TOKEN, (match: string, role: string, part?: string, singular?: string, plural?: string, heForm?: string, sheForm?: string, theyForm?: string, oneForm?: string, manyForm?: string) => {
    const bare = !part && singular === undefined && heForm === undefined && oneForm === undefined;
    if (ENGINE_TOKENS.has(role) && bare) return match;
    if (role === 'place' && bare && place) return place;
    if (role === 'scene' && bare && rooms.scene) return rooms.scene;
    if (part === 'room' && rooms[role]) return rooms[role];
    if (groups[role]) {
      const members = groups[role].map(id => cast[id]);
      if (!members.length || members.some(member => !member)) throw new Error(`No members of ${role} in this call for ${match} in "${text}"`);
      // After the names, the verb agrees with how many: one name is singular, whoever it is.
      if (oneForm !== undefined) return members.length === 1 ? oneForm : manyForm!;
      // After a pronoun, one member reads as that person; two or more as plural they.
      const one = members.length === 1 ? members[0].pronouns : null;
      if (singular !== undefined) return one === 'he' || one === 'she' ? singular : plural!;
      if (heForm !== undefined) {
        if (!one) throw new Error(`A gendered word for ${members.length} members of ${role}: ${match} in "${text}" needs a count condition with max 1`);
        return one === 'he' ? heForm : one === 'she' ? sheForm! : theyForm!;
      }
      if (part === 'n') return countWord(members.length);
      if (part === 'first') return members[0].firstName;
      if (part === 'last') return members[0].surname;
      if (part && PRONOUN_FORMS[part.toLowerCase()]) {
        const word = PRONOUN_FORMS[part.toLowerCase()][one ?? 'they'];
        return part[0] === part[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word;
      }
      if (part) throw new Error(`Unknown group token ${match} in "${text}"`);
      return listOf(members.map(member => member.firstName));
    }
    const who = cast[role];
    if (!who || part === 'room' || part === 'n') throw new Error(`Unknown token ${match} in "${text}"`);
    // One person's name is one name: the singular form.
    if (oneForm !== undefined) return oneForm;
    if (singular !== undefined) return who.pronouns === 'they' ? plural! : singular;
    if (heForm !== undefined) return who.pronouns === 'he' ? heForm : who.pronouns === 'she' ? sheForm! : theyForm!;
    if (part === 'age') { if (who.age === undefined) throw new Error(`No age drawn for ${role} in "${text}"`); return String(who.age); }
    if (part && PRONOUN_FORMS[part.toLowerCase()]) {
      const word = PRONOUN_FORMS[part.toLowerCase()][who.pronouns];
      return part[0] === part[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word;
    }
    return part === 'first' ? who.firstName : part === 'last' ? who.surname : `${who.firstName} ${who.surname}`;
  });
}

/** Public state as an engine condition. A group in `safe` means every member is safe, in `notSafe`
 * that none is. A count condition is the compiler's, settled before this (countHolds). */
export function stateCondition(state: TreeState | undefined, groups: Record<string, readonly string[]> = {}): Condition {
  const people = (roles: readonly string[] | undefined) => (roles ?? []).flatMap(role => groups[role] ?? [role]);
  const flags = [...(state?.marks ?? []).map(markFlag), ...people(state?.safe).map(safeFlag)];
  const notFlags = [...(state?.notMarks ?? []).map(markFlag), ...people(state?.notSafe).map(safeFlag)];
  return { ...(flags.length ? { flags } : {}), ...(notFlags.length ? { notFlags } : {}) };
}

/** Whether a state's count condition holds for this call's group sizes. */
export function countHolds(state: TreeState | undefined, counts: Record<string, number>): boolean {
  if (!state?.count) return true;
  const n = counts[state.count.role] ?? 0;
  return n >= (state.count.min ?? 0) && n <= (state.count.max ?? Infinity);
}

/** The tree as this call reads it once its group sizes are known: outcomes, prompt variants and
 * choices whose count condition fails are gone, and the rest no longer carry one. Without count
 * conditions the tree passes through unchanged. */
export function treeForCounts(tree: CallTree, counts: Record<string, number>): CallTree {
  const groups = tree.groups ?? {};
  const states = tree.nodes.flatMap(node => [...(node.promptIf ?? []).map(entry => entry.when), ...node.choices.flatMap(choice => [choice.onlyIf,
    ...BANDS.flatMap(band => choice.outcomes[band].map(outcome => outcome.when))])]);
  for (const state of states) if (state?.count && !groups[state.count.role]) throw new Error(`${tree.type}: a count condition on ${state.count.role}, which is not a group`);
  if (!states.some(state => state?.count)) return tree;
  const strip = <T extends { count?: unknown }>(state: T | undefined): T | undefined => {
    if (!state?.count) return state;
    const { count: _count, ...rest } = state;
    return Object.keys(rest).length ? rest as T : undefined;
  };
  return { ...tree, nodes: tree.nodes.map(node => ({ ...node,
    ...(node.promptIf ? { promptIf: node.promptIf.filter(entry => countHolds(entry.when, counts)).map(entry => ({ ...entry, when: strip(entry.when) ?? {} })) } : {}),
    choices: node.choices.filter(choice => countHolds(choice.onlyIf, counts)).map(choice => {
      const { onlyIf, ...rest } = choice;
      const kept = strip(onlyIf);
      return { ...rest, ...(kept ? { onlyIf: kept } : {}),
        outcomes: Object.fromEntries(BANDS.map(band => [band, choice.outcomes[band].filter(outcome => countHolds(outcome.when, counts)).map(outcome => {
          const { when, ...other } = outcome;
          const keptWhen = strip(when);
          return { ...other, ...(keptWhen ? { when: keptWhen } : {}) };
        })])) as TreeChoice['outcomes'] };
    }) })) };
}
const joinConditions = (a: Condition, b: Condition): Condition => {
  const flags = [...a.flags ?? [], ...b.flags ?? []], notFlags = [...a.notFlags ?? [], ...b.notFlags ?? []];
  return { ...(flags.length ? { flags } : {}), ...(notFlags.length ? { notFlags } : {}) };
};

/** The node one `next` reaches in this call. Turn groups draw once per call, so every path
 * into the same group meets the same turn. */
export function resolveNext(tree: CallTree, next: TreeNext, seed: number): { node: string } | { ending: string } {
  if ('turn' in next) {
    const group = tree.turns?.[next.turn];
    if (!group?.length) throw new Error(`Unknown turn group ${next.turn}`);
    return { node: group[hashIndex(hashSeed(`${seed}:${next.turn}:turn-v13`), group.length)] };
  }
  return next;
}

/** Everywhere an outcome can send the call: its `next`, every severity of a force outcome, and the
 * results a cascade can have with this many members in its group (only `all` with none, never
 * `some` with one; every result when the size is not known). */
export function outcomeNexts(outcome: TreeOutcome, counts?: Record<string, number>): TreeNext[] {
  if (outcome.next) return [outcome.next];
  if (outcome.force) return [outcome.force.next.fatal, outcome.force.next.hurt, outcome.force.next.none].filter((next): next is TreeNext => !!next);
  if (outcome.cascade) {
    const { next, group } = outcome.cascade, n = counts ? counts[group] ?? 0 : Infinity;
    return n === 0 ? [next.all] : n === 1 ? [next.all, next.none] : [next.all, next.some, next.none];
  }
  return [];
}

/** What a call with these group sizes can reach from the root, through every turn any call can draw:
 * its nodes and endings (with the exhausted-choices fallback). For strings and gates; a compiled
 * call reaches only its own turns (reachableNodes). */
export function reachableWithin(tree: CallTree, counts: Record<string, number>): { nodes: Set<string>; endings: Set<string> } {
  const byId = new Map(tree.nodes.map(node => [node.id, node]));
  const nodes = new Set([tree.root]), endings = new Set(['handed_over']);
  for (const queue = [tree.root]; queue.length;) for (const choice of byId.get(queue.shift()!)?.choices ?? []) for (const band of BANDS)
    for (const outcome of choice.outcomes[band]) for (const next of outcomeNexts(outcome, counts)) {
      if ('ending' in next) { endings.add(next.ending); continue; }
      for (const id of 'turn' in next ? tree.turns?.[next.turn] ?? [] : [next.node]) if (!nodes.has(id)) { nodes.add(id); queue.push(id); }
    }
  return { nodes, endings };
}

/** Nodes this call can reach from the root, after its turn draws (and its group sizes, when given). */
export function reachableNodes(tree: CallTree, seed: number, counts?: Record<string, number>): TreeNode[] {
  const byId = new Map(tree.nodes.map(node => [node.id, node]));
  const seen = new Set<string>([tree.root]), queue = [tree.root];
  while (queue.length) {
    const node = byId.get(queue.shift()!);
    if (!node) continue;
    for (const choice of node.choices) for (const band of BANDS) for (const outcome of choice.outcomes[band]) for (const to of outcomeNexts(outcome, counts)) {
      const next = resolveNext(tree, to, seed);
      if ('node' in next && !seen.has(next.node)) { seen.add(next.node); queue.push(next.node); }
    }
  }
  return tree.nodes.filter(node => seen.has(node.id));
}

/** Compile a call tree onto the generated building. Every decision is an ordinary engine action;
 * node flags make the choices of one node exclusive and route each band to its own next node. */
export interface PlacedCast {
  recipe: ReturnType<typeof scenarioRecipe>;
  situation: CallTree['situations'][number];
  /** The arrival space outside and the scene room. */
  outside: string;
  room: NonNullable<ReturnType<typeof selectStoryRoom>>;
  roomOf: Record<string, string>;
  routes: Record<string, { fromSpaceId: string; toSpaceId: string; openingIds: string[]; profile: 'walking' | 'chair' }>;
  routeName: (role: string) => string;
  anchors: Record<string, { inside: Vec; outside: Vec }>;
  cast: Record<string, CastIdentity>;
  /** Each counted role's members ('others' → ['others_1', 'others_2']), nearest the door first.
   * Every member is in roomOf, anchors and cast like a key role. */
  groups: Record<string, string[]>;
}

/** The door the team comes through into a room: the middle of the first opening on its walking
 * route out (the same door incidentPeopleFor measures doorFt to). */
export function doorInto(built: BuiltLocation, spaceId: string, outside: string): Vec | undefined {
  const door = findStoryRoute(built, spaceId, outside, 'walking')?.[0];
  const opening = door ? built.location.openings.find(entry => entry.id === door) : undefined;
  return opening ? { x: (opening.from.x + opening.to.x) / 2, y: (opening.from.y + opening.to.y) / 2 } : undefined;
}

/** Where every role is in this call: the scene room, each role's own room, a walking (or chair)
 * route out of every occupied room, start and outside points, and the drawn names. Throws when the
 * building can't host the call, so hosting moves it to another seed.
 *
 * `members` is how many people each counted role has in this call (the instance draws it from the
 * template). Members start in their leader's room, clear of everyone placed, and are numbered by
 * distance from the door the team comes through, nearest first: `{others.first}`, a `fire` or
 * `force` on the group and a conversation with it all mean the member nearest the team. */
export function placeCast(tree: CallTree, built: BuiltLocation, spec: IncidentSpec, draws: CastDraw = {}, members: Record<string, number> = {}): PlacedCast {
  const settings = ([] as string[]).concat(tree.scene.setting);
  if (!settings.includes(built.location.setting)) throw new Error(`${tree.type} needs a ${settings.join(' or ')} building`);
  const recipe = scenarioRecipe(spec);
  const situation = tree.situations[recipe.variant];
  const outside = built.location.entries[0];
  // Room types are tried in order of fit, so a shop call lands on the shop floor, not a cooler.
  const room = tree.scene.rooms.reduce<ReturnType<typeof selectStoryRoom>>((found, type) =>
    found ?? selectStoryRoom(built, { floor: 0, types: [type], reachableFromSpaceId: outside }, hashSeed(`${spec.seed}:scene-v13`)), null);
  if (!room) throw new Error(`No ${tree.scene.rooms.join(' or ')} room for ${tree.type}`);
  // Each person starts in the scene room, another room of a listed type, or outside with patrol.
  const usedRooms = new Set([room.id]);
  const roomOf: Record<string, string> = {};
  for (const role of tree.roles) {
    const place = role.kind === 'bystander' ? 'outside' : role.place ?? 'scene';
    if (place === 'offsite') continue;
    if (place === 'scene') { roomOf[role.id] = room.id; continue; }
    if (place === 'outside') { roomOf[role.id] = outside; continue; }
    const own = place.rooms.reduce<ReturnType<typeof selectStoryRoom>>((found, type) => found ?? selectStoryRoom(built,
      { floor: 0, types: [type], reachableFromSpaceId: outside, excludeSpaceIds: [...usedRooms] }, hashSeed(`${spec.seed}:${role.id}:room-v13`)), null);
    if (!own) throw new Error(`No ${place.rooms.join(' or ')} room for ${role.id} in ${tree.type}`);
    usedRooms.add(own.id); roomOf[role.id] = own.id;
  }
  // A walking route out for every room someone starts in; the scene's is 'exit'.
  const routes: Record<string, { fromSpaceId: string; toSpaceId: string; openingIds: string[]; profile: 'walking' | 'chair' }> = {};
  const chair = (role: string) => tree.roles.find(entry => entry.id === role)?.mobility === 'chair';
  const routeName = (role: string) => chair(role) ? `exit_${role}` : roomOf[role] === room.id ? 'exit' : `exit_${role}`;
  const onSite = tree.roles.filter(role => role.place !== 'offsite');
  for (const role of onSite) {
    if (roomOf[role.id] === outside || routes[routeName(role.id)]) continue;
    const profile = chair(role.id) ? 'chair' as const : 'walking' as const;
    const openingIds = findStoryRoute(built, roomOf[role.id], outside, profile);
    if (!openingIds) throw new Error(`No ${profile} route out for ${role.id} in ${tree.type}`);
    routes[routeName(role.id)] = { fromSpaceId: roomOf[role.id], toSpaceId: outside, openingIds, profile };
  }
  if (!routes.exit) {
    const openingIds = findStoryRoute(built, room.id, outside, 'walking');
    if (!openingIds) throw new Error(`No walking route out of the scene for ${tree.type}`);
    routes.exit = { fromSpaceId: room.id, toSpaceId: outside, openingIds, profile: 'walking' };
  }
  const occupied: { spaceId: string; at: Vec }[] = [], waiting: { spaceId: string; at: Vec }[] = [];
  const anchors: Record<string, { inside: Vec; outside: Vec }> = {};
  for (const role of onSite) {
    // A wheelchair user starts and ends with the clearance the engine checks for a chair route.
    const clearance = role.mobility === 'chair' ? 1.5 : undefined;
    const out = storyPoint(built, outside, hashSeed(`${spec.seed}:${role.id}:out`), waiting, clearance) ?? storyPoint(built, outside, hashSeed(`${spec.seed}:${role.id}:out`), waiting, clearance ?? 0.5);
    if (!out) throw new Error(`No room outside for ${role.id} in ${tree.type}`);
    waiting.push({ spaceId: outside, at: out });
    const start = roomOf[role.id] === outside ? out : storyPoint(built, roomOf[role.id], hashSeed(`${spec.seed}:${role.id}:in`), occupied, clearance);
    if (!start) throw new Error(`No room for ${role.id} in ${tree.type}`);
    if (roomOf[role.id] !== outside) occupied.push({ spaceId: roomOf[role.id], at: start });
    anchors[role.id] = { inside: start, outside: out };
  }
  const groups: Record<string, string[]> = {};
  for (const [group, def] of Object.entries(tree.groups ?? {})) {
    const count = members[group] ?? 0;
    groups[group] = [];
    if (!count) continue;
    const home = roomOf[def.leader];
    if (!home || home === outside) throw new Error(`${tree.type}: the members of ${group} start with ${def.leader}, who is not inside`);
    const door = doorInto(built, home, outside);
    const spots: { inside: Vec; outside: Vec; feet: number; index: number }[] = [];
    for (let i = 0; i < count; i++) {
      const key = `${spec.seed}:${group}:${i}`;
      const out = storyPoint(built, outside, hashSeed(`${key}:out`), waiting) ?? storyPoint(built, outside, hashSeed(`${key}:out`), waiting, 0.5);
      if (!out) throw new Error(`No room outside for a member of ${group} in ${tree.type}`);
      waiting.push({ spaceId: outside, at: out });
      const start = storyPoint(built, home, hashSeed(`${key}:in`), occupied);
      if (!start) throw new Error(`No room for a member of ${group} in ${tree.type}`);
      occupied.push({ spaceId: home, at: start });
      spots.push({ inside: start, outside: out, feet: door ? Math.hypot(start.x - door.x, start.y - door.y) : 0, index: i });
    }
    spots.sort((a, b) => a.feet - b.feet || a.index - b.index);
    spots.forEach((spot, i) => {
      const id = memberId(group, i + 1);
      if (tree.roles.some(role => role.id === id || role.id === group)) throw new Error(`${tree.type}: group ${group} collides with a role id`);
      groups[group].push(id);
      roomOf[id] = home;
      anchors[id] = { inside: spot.inside, outside: spot.outside };
    });
  }
  const cast = drawTreeCast(tree, spec, draws, Object.values(groups).flat());
  return { recipe, situation, outside, room, roomOf, routes, routeName, anchors, cast, groups };
}

/** The engine id of a counted role's nth member (1-based): 'others_1'. */
export const memberId = (group: string, n: number) => `${group}_${n}`;

/** How many members each counted role has in this placement. */
export const memberCounts = (placed: Pick<PlacedCast, 'groups'>): Record<string, number> =>
  Object.fromEntries(Object.entries(placed.groups).map(([group, ids]) => [group, ids.length]));

/** How this call's text binds: the drawn names, pronouns and ages, the building's name for
 * {place}, and room labels for {scene} and {role.room}. The compiler, the Scenario Lab and the
 * string checks all bind through this. */
export function textBinder(tree: CallTree, built: BuiltLocation, placed: PlacedCast): (text: string) => string {
  const { room, roomOf, outside, cast, groups = {} } = placed;
  const roomLabel = (id: string) => (built.location.rooms.find(entry => entry.id === id)?.label ?? 'room').toLowerCase();
  const rooms = { scene: roomLabel(room.id), ...Object.fromEntries(tree.roles.filter(role => role.place !== 'offsite' && roomOf[role.id] !== outside).map(role => [role.id, roomLabel(roomOf[role.id])])),
    ...Object.fromEntries(Object.entries(groups).flatMap(([group, ids]) => ids.length ? [[group, roomLabel(roomOf[ids[0]])], ...ids.map(id => [id, roomLabel(roomOf[id])])] : [])) };
  return text => bindRoleTokens(text, cast, built.location.name, rooms, groups);
}

/** `clockMarks`: marks this call's clocks can set by themselves (cues, running out), so a prompt or
 * choice that reads one is kept even when no outcome sets it. */
export function withCallTree(input: ScenarioDefinition, built: BuiltLocation, authored: CallTree, placed: PlacedCast = placeCast(authored, built, input.incident!), clockMarks: readonly string[] = []): ScenarioDefinition {
  const spec = input.incident!;
  const { recipe, situation, outside, room, roomOf, routes, routeName, anchors, cast } = placed;
  // Counted roles (groups): their size is fixed for this call, so count conditions settle here and
  // a group in `out`, `safe`, `harm` or `moves` means every member.
  const groups = placed.groups ?? {};
  for (const [group, def] of Object.entries(authored.groups ?? {})) {
    if (!authored.roles.some(role => role.id === def.leader)) throw new Error(`${authored.type}: group ${group} is led by ${def.leader}, who is not a role`);
    if (!/^[a-z][a-z_]*$/.test(group)) throw new Error(`${authored.type}: group id ${group} must be lower snake case`);
  }
  const tree = treeForCounts(authored, memberCounts({ groups }));
  const everyone = (roles: readonly string[] | undefined) => (roles ?? []).flatMap(role => groups[role] ?? [role]);
  /** A group where one person is meant (who fires, who force is used on, who is talked to): its
   * first member, nearest the door. A call with no members never offers that line. */
  const oneOf = (role: string, what: string) => {
    const ids = groups[role];
    if (!ids) return role;
    if (!ids.length) throw new Error(`${tree.type}: ${what} ${role} in a call with no members of ${role}: put it behind a count condition`);
    return ids[0];
  };
  // Someone outside the building (the shooter across the street) is in the prose, never on the map.
  const onSite = tree.roles.filter(role => role.place !== 'offsite');
  // Everyone on the map: the roles, then each group's members, who take their leader's kind.
  const present = [...onSite.map(role => ({ id: role.id, label: role.label, kind: role.kind })),
    ...Object.entries(groups).flatMap(([group, ids]) => ids.map(id => ({ id, label: tree.groups![group].label, kind: tree.roles.find(role => role.id === tree.groups![group].leader)!.kind })))];
  const nodes = reachableNodes(tree, spec.seed, memberCounts({ groups }));
  // Anyone a choice in this call walks out needs that walk clear of furniture, as the engine
  // checks it; otherwise hosting moves the call to another building seed (the v12 rule).
  for (const node of nodes) for (const choice of node.choices) if (choice.walks && groups[choice.walks]) throw new Error(`${node.id}.${choice.id}: only a key role walks out, never the group ${choice.walks}`);
  for (const walker of new Set(nodes.flatMap(node => node.choices.flatMap(choice => choice.walks ? [choice.walks] : [])))) {
    const route = routes[routeName(walker)];
    if (!routeAlongOpenings(built, anchors[walker].inside, anchors[walker].outside, route.openingIds, null, false, route.profile === 'chair' ? 1.5 : 1).reachable)
      throw new Error(`Walk out blocked for ${walker} in ${tree.type}`);
  }
  // Marks and releases this call can actually set. A condition that needs one it can never set
  // is never true here (drop it); one that needs it absent is always true (strip that part).
  // A choice that needs such a mark never shows, so its own marks don't count either: repeat
  // until nothing more drops out.
  const choices = nodes.flatMap(node => node.choices);
  const settableFrom = (live: TreeChoice[]) => {
    const outcomes = live.flatMap(choice => BANDS.flatMap(band => choice.outcomes[band]));
    return { marks: new Set([...outcomes.flatMap(outcome => outcome.mark ?? []), ...clockMarks]), safe: new Set(outcomes.flatMap(outcome => outcome.safe ?? [])) };
  };
  let settable = settableFrom(choices);
  const possible = (state: TreeState | undefined) => (state?.marks ?? []).every(mark => settable.marks.has(mark)) && (state?.safe ?? []).every(role => settable.safe.has(role));
  for (let live = choices; ;) {
    const next = choices.filter(choice => possible(choice.onlyIf));
    if (next.length === live.length) break;
    live = next;
    settable = settableFrom(live);
  }
  const trim = (state: TreeState | undefined): TreeState | undefined => state && {
    marks: state.marks, safe: state.safe,
    notMarks: state.notMarks?.filter(mark => settable.marks.has(mark)), notSafe: state.notSafe?.filter(role => settable.safe.has(role)),
  };
  const nodeById = new Map(tree.nodes.map(node => [node.id, node]));
  const s = structuredClone(input);
  const difficulty = (tree.difficulty?.base ?? 31) + spec.tier * (tree.difficulty?.perTier ?? 3);
  const truthOf = (key: string): boolean => {
    const fact = tree.facts[key];
    const value = fact?.truth ?? situation.truth[key];
    if (value === undefined) throw new Error(`Fact ${key} has no truth in situation ${recipe.variant}`);
    return value;
  };

  s.version = 13;
  s.title = s.variantLabel = tree.title;
  s.summary = tree.summary;
  s.pressureLabel = tree.pressureLabel;
  s.pressure = { ...tree.pressure };
  s.squadRange = { ...tree.squads };
  s.briefing = { dispatchReason: tree.briefing.dispatchReason, known: [...tree.briefing.known], unknown: [...tree.briefing.unknown], teamResponsibilities: [...tree.briefing.responsibilities] };
  s.objectives = tree.objectives.map(objective => ({ ...objective }));
  s.externalServices = [];
  const multiplier = tierRewardMultiplier(spec.tier);
  s.rewards = { funding: Math.round(tree.rewards.funding * multiplier), devPoints: Math.round(tree.rewards.devPoints * multiplier), trust: Math.round(tree.rewards.trust * multiplier), xp: Math.round(tree.rewards.xp * multiplier) };
  s.environment = { timeOfDay: tree.scene.timeOfDay ?? 'day', weather: 'clear', power: 'on', clutter: 0, hazards: [], communication: 'normal',
    crowd: tree.scene.crowd ?? 0, keyholder: false, plansOnFile: false, alarm: 'none', cctv: false };
  delete s.difficulty;
  delete s.people;

  s.facts = [
    ...present.map((role): FactDefinition => {
      const outdoors = roomOf[role.id] === outside;
      const marker = role.kind === 'subject' ? 'SUBJECT' : outdoors ? 'PATROL' : 'INSIDE';
      return {
        id: personFactId(role.id), storyPersonId: role.id, label: `{${role.id}}, ${role.label}`, spaceId: roomOf[role.id], truth: true, initial: outdoors ? 'confirmed' : 'reported', showWhenUnknown: true,
        markers: { reported: marker, confirmed: marker }, markerSource: outdoors ? 'with patrol' : 'per dispatch',
        claim: outdoors ? `{${role.id}.first} is outside with patrol.` : `{${role.id}.first} is inside.`, source: 'Dispatch', note: null, uncertainty: `Where {${role.id}.first} is right now`,
        person: { label: `{${role.id}}`, at: anchors[role.id].inside },
      };
    }),
    ...Object.entries(tree.facts).map(([key, fact]): FactDefinition => ({
      id: treeFactId(key), label: fact.label, spaceId: room.id, truth: truthOf(key), initial: fact.public ? 'reported' : 'unknown', showWhenUnknown: false,
      markers: {}, claim: fact.claim, source: fact.public ? fact.source ?? 'Dispatch' : null, note: null,
      resolved: { confirmed: fact.confirmed, disproved: fact.disproved }, uncertainty: fact.claim,
    })),
  ];
  // What counts as a seen threat to life (sim/authorization.ts): facts the team comes to believe,
  // and marks this call can set.
  const threats = [
    ...Object.entries(tree.facts).flatMap(([key, fact]) => fact.threat ? [{ factId: treeFactId(key), because: fact.threat }] : []),
    ...Object.entries(tree.threatMarks ?? {}).filter(([mark]) => settable.marks.has(mark)).map(([mark, because]) => ({ flag: markFlag(mark), because })),
  ];
  if (threats.length) s.threats = threats;
  s.civilianOutcomes = present.filter(role => role.kind === 'civilian').map(role => ({
    id: role.id, label: `{${role.id}}`, factId: personFactId(role.id), safeFlag: safeFlag(role.id), injuredFlag: hurtFlag(role.id), careFlag: careFlag(role.id),
  }));

  const people: Record<string, StoryPersonBinding> = Object.fromEntries(present.map(role => [role.id, {
    id: role.id, label: `{${role.id}}`, locationFactId: personFactId(role.id), publicKind: role.kind === 'bystander' ? 'person' : role.kind,
    initial: { spaceId: roomOf[role.id], at: anchors[role.id].inside },
    transitions: roomOf[role.id] === outside ? [] : [{ when: { flags: [outFlag(role.id)] }, observed: true, to: { spaceId: outside, at: anchors[role.id].outside }, label: role.kind === 'civilian' ? 'Outside with patrol' : 'Outside with the team' }],
  } satisfies StoryPersonBinding]));
  const props = Object.fromEntries(onSite.filter(role => role.carries).map(role => {
    const carried = role.carries!, id = `${role.id}_${carried.glyph}`, factId = treeFactId(carried.knownFrom);
    return [id, { id, label: carried.label, kind: 'carried' as const, holderPersonId: role.id, reportedHolderPersonId: role.id, glyph: carried.glyph,
      knownWhen: { facts: [{ factId, in: ['reported' as const, 'confirmed' as const] }] }, confirmedWhen: { facts: [{ factId, in: ['confirmed' as const] }] } }];
  }));
  s.story = {
    archetypeId: spec.type, version: 13, episodeId: `${recipe.id}:${spec.seed}`, seed: spec.seed, recipeId: recipe.id, characteristics: [],
    cast, episode: { variantId: `${spec.type}:${recipe.variant}`, modules: ['call-tree', ...nodes.map(node => node.id)], publicContext: [] },
    bindings: { rooms: { scene: { spaceId: room.id } }, exterior: { arrival: { spaceId: outside } },
      routes, people, props },
  };

  // Pacing: one role thinks before answering, so every conversation with them takes longer.
  // Never a subject: a known line that a person in crisis "takes a long time to answer" narrates a
  // mechanic over them (call design, row M and R9). The caller, a civilian or a witness can.
  const deliberate = recipe.characteristic === 'deliberate_answers'
    ? tree.roles.find(role => role.kind !== 'subject' && nodes.some(node => node.choices.some(choice => choice.talksTo === role.id))) : undefined;
  if (deliberate) {
    s.briefing.known.push(`Dispatch says {${deliberate.id}.first} takes a long time to answer. Every conversation with {${deliberate.id}.first} takes two extra minutes.`);
    s.story.characteristics!.push({ id: 'deliberate_answers', personId: deliberate.id, label: 'Takes time to answer', source: 'Dispatch conversation report' });
  }

  /** Where a `next` goes in this call, checked: never back to this node or an earlier stage. */
  const route = (node: TreeNode, to: TreeNext | undefined) => {
    const next = to ? resolveNext(tree, to, spec.seed) : undefined;
    const nextStage = next && 'node' in next ? nodeById.get(next.node)?.stage : undefined;
    if (next && 'node' in next && !nextStage) throw new Error(`${node.id}: unknown next node ${next.node}`);
    if (next && 'node' in next && next.node === node.id) throw new Error(`${node.id}: a choice routes back to its own node`);
    if (nextStage && STAGES.indexOf(nextStage) < STAGES.indexOf(node.stage)) throw new Error(`${node.id}: a choice goes back a stage`);
    return { next, nextStage };
  };
  const routing = (node: TreeNode, to: TreeNext | undefined): Pick<OutcomeEffect, 'setFlags' | 'clearFlags' | 'stage' | 'ending'> => {
    const { next, nextStage } = route(node, to);
    if (!next) return {};
    return { setFlags: [...(node.id === tree.root ? [TREE_STARTED] : []), 'node' in next ? nodeFlag(next.node) : endFlag(next.ending)],
      ...(node.id !== tree.root ? { clearFlags: [nodeFlag(node.id)] } : {}), ...('node' in next ? { stage: nextStage } : { ending: next.ending }) };
  };
  /** An outcome with its groups resolved for this call: a group in `out`, `safe`, `harm` and
   * `moves` is every member, `fire` from and `force` on a group is its first member, and a cascade
   * in a call with no members is simply its `all` route. */
  const groupOutcome = (node: TreeNode, outcome: TreeOutcome): TreeOutcome => {
    if ([outcome.fire, outcome.force, outcome.cascade].filter(Boolean).length > 1) throw new Error(`${node.id}: an outcome can fire, use force or cascade, only one of them`);
    if (outcome.promise && groups[outcome.promise.to]) throw new Error(`${node.id}: a promise is made to one person, never to the group ${outcome.promise.to}`);
    for (const entry of ([] as TreeIf[]).concat(outcome.if ?? [])) if ('meter' in entry && groups[entry.meter])
      throw new Error(`${node.id}: a meter branch reads one person, never the group ${entry.meter}`);
    let { cascade, next } = outcome;
    if (cascade) {
      const def = tree.groups?.[cascade.group];
      if (!def || !groups[cascade.group]) throw new Error(`${node.id}: a cascade on ${cascade.group}, which is not a group`);
      if (def.leader !== cascade.leader) throw new Error(`${node.id}: the cascade on ${cascade.group} follows ${def.leader}, not ${cascade.leader}`);
      if (next) throw new Error(`${node.id}: a cascade routes by who follows, never by next`);
      if (!groups[cascade.group].length) { next = cascade.next.all; cascade = undefined; }
    }
    if (!Object.keys(groups).length) return outcome;
    const byPerson = <T>(entries: Record<string, T> | undefined) => entries && Object.fromEntries(Object.entries(entries).flatMap(([role, value]) => everyone([role]).map(id => [id, value] as const)));
    const harm = byPerson(outcome.harm), moves = byPerson(outcome.moves);
    const { cascade: _cascade, next: _next, harm: _harm, moves: _moves, ...rest } = outcome;
    return { ...rest,
      ...(outcome.safe ? { safe: everyone(outcome.safe) } : {}),
      ...(outcome.out ? { out: everyone(outcome.out) } : {}),
      ...(harm && Object.keys(harm).length ? { harm } : {}),
      ...(moves && Object.keys(moves).length ? { moves } : {}),
      ...(outcome.fire ? { fire: { ...outcome.fire, from: oneOf(outcome.fire.from, 'fire from') } } : {}),
      ...(outcome.force ? { force: { ...outcome.force, on: oneOf(outcome.force.on, 'force on') } } : {}),
      ...(next ? { next } : {}), ...(cascade ? { cascade } : {}) };
  };
  /** Drawn consequences (sim/drawn-effects.ts): a variant per result, each a standard line. */
  const drawnFor = (node: TreeNode, outcome: TreeOutcome): Pick<OutcomeEffect, 'drawn' | 'variants'> => {
    if (outcome.fire) {
      const hit = (severity: 'wounded' | 'serious'): OutcomeEffect => ({ text: FIRE_LINES[severity],
        officerHarm: { severity, label: `${severity === 'serious' ? 'Seriously wounded' : 'Wounded'} by gunfire at {place}` },
        ...(outcome.fire!.mark ? { setFlags: [markFlag(outcome.fire!.mark)] } : {}) });
      return { drawn: { model: 'incoming_fire', from: outcome.fire.from }, variants: { none: [{ text: FIRE_LINES.none }], wounded: [hit('wounded')], serious: [hit('serious')] } };
    }
    if (outcome.force) {
      const { on, next, noFatal } = outcome.force;
      const variants: Record<string, OutcomeEffect[]> = {};
      for (const profile of ['firearm', 'less_lethal_device', 'less_lethal_impact', 'hands'] as const) for (const severity of ['none', 'wounded', 'serious', 'fatal'] as const) {
        // Hands has no fatal line: taking a person by hand never kills them (FORCE_RISK_V1.hands).
        const line = (FORCE_LINES[profile] as Partial<Record<typeof severity, string>>)[severity];
        if (!line || (severity === 'fatal' && noFatal)) continue;
        const go = routing(node, severity === 'fatal' ? next.fatal ?? next.hurt : severity === 'none' ? next.none : next.hurt);
        variants[`${profile}:${severity}`] = [{ ...go, text: asRole(line, on),
          setFlags: [...go.setFlags ?? [], ...(severity === 'fatal' ? [] : [outFlag(on)])],
          ...(severity === 'none' ? {} : { personHarm: [{ personId: on, severity }] }) }];
      }
      return { drawn: { model: 'team_force', on }, variants };
    }
    if (outcome.cascade) {
      // One variant for every combination of what the members do (follow, stay, already out):
      // followers come out, a standard line names who followed and who stayed, and the result
      // (all, some, none of those still inside) routes the call.
      const { leader, group, next } = outcome.cascade;
      const members = groups[group];
      const line = (kind: keyof typeof CASCADE_LINES, ids: string[]) =>
        asRole(CASCADE_LINES[kind][ids.length === 1 ? 'one' : 'many'], leader).replace('{names}', listOf(ids.map(id => `{${id}.first}`)));
      const variants: Record<string, OutcomeEffect[]> = {};
      for (const states of cascadeCombos(members.length)) {
        const go = routing(node, next[cascadeResult(states)]);
        const followed = members.filter((_, i) => states[i] === 'follows'), stayed = members.filter((_, i) => states[i] === 'stays');
        const text = [...followed.length ? [line('follows', followed)] : [], ...stayed.length ? [line('stays', stayed)] : []].join(' ');
        variants[cascadeKey(states)] = [{ ...go, setFlags: [...go.setFlags ?? [], ...followed.map(outFlag)], ...(text ? { text } : {}) }];
      }
      return { drawn: { model: 'cascade', on: leader, members: [...members] }, variants };
    }
    return {};
  };

  const effectsFor = (node: TreeNode, authoredOutcome: TreeOutcome): OutcomeEffect[] => {
    const outcome = groupOutcome(node, authoredOutcome);
    if (outcome.force && outcome.next) throw new Error(`${node.id}: a force outcome routes by severity, never by next`);
    const next = outcome.next ? resolveNext(tree, outcome.next, spec.seed) : undefined;
    const nextStage = next && 'node' in next ? nodeById.get(next.node)?.stage : undefined;
    if (next && 'node' in next && !nextStage) throw new Error(`${node.id}: unknown next node ${next.node}`);
    if (next && 'node' in next && next.node === node.id) throw new Error(`${node.id}: a choice routes back to its own node`);
    if (nextStage && STAGES.indexOf(nextStage) < STAGES.indexOf(node.stage)) throw new Error(`${node.id}: a choice goes back a stage`);
    const out = [...new Set([...outcome.safe ?? [], ...outcome.out ?? []])];
    const when = stateCondition(outcome.when, groups);
    const ifs = ([] as TreeIf[]).concat(outcome.if ?? []);
    const setFlags = [
      ...(next && node.id === tree.root ? [TREE_STARTED] : []),
      ...(next ? 'node' in next ? [nodeFlag(next.node)] : [endFlag(next.ending)] : []),
      ...(outcome.mark ?? []).map(markFlag),
      ...(outcome.safe ?? []).map(safeFlag),
      ...out.map(outFlag),
    ];
    const effect: OutcomeEffect = {
      ...(ifs.some(entry => 'fact' in entry) ? { truth: ifs.flatMap(entry => 'fact' in entry ? [{ factId: treeFactId(entry.fact), is: entry.is }] : []) } : {}),
      ...(ifs.some(entry => 'clock' in entry) ? { clocks: ifs.flatMap((entry): ClockCondition[] => 'low' in entry ? [{ clockId: entry.clock, state: 'low', is: entry.low }] : 'out' in entry ? [{ clockId: entry.clock, state: 'out', is: entry.out }] : []) } : {}),
      // Meter branches read the subject's meters at the start of the decision (sim/meters.ts).
      ...(ifs.some(entry => 'meter' in entry) ? { meters: ifs.flatMap((entry): MeterCondition[] => {
        if (!('meter' in entry)) return [];
        if (entry.stance === undefined && entry.agitationAtLeast === undefined) throw new Error(`${node.id}: a meter branch on ${entry.meter} needs a stance or an agitation`);
        return [{ personId: entry.meter, ...(entry.stance !== undefined ? { stance: ([] as MeterStance[]).concat(entry.stance) } : {}),
          ...(entry.agitationAtLeast !== undefined ? { agitationAtLeast: entry.agitationAtLeast } : {}), is: entry.is ?? true }];
      }) } : {}),
      ...(outcome.promise ? { promise: { id: outcome.promise.id, personId: outcome.promise.to, kind: outcome.promise.kind ?? 'promise' } } : {}),
      ...(outcome.moves ? { moves: Object.entries(outcome.moves).flatMap(([personId, events]) => ([] as TreeMove[]).concat(events).map(event => ({ personId, event }))) } : {}),
      ...(when.flags || when.notFlags ? { when } : {}),
      ...(outcome.reveal?.length ? { reveal: outcome.reveal.map(treeFactId) } : {}),
      ...(setFlags.length ? { setFlags } : {}),
      ...(next && node.id !== tree.root ? { clearFlags: [nodeFlag(node.id)] } : {}),
      ...(outcome.harm ? { personHarm: Object.entries(outcome.harm).map(([personId, severity]) => ({ personId, severity })) } : {}),
      ...(outcome.officer ? { officerHarm: { severity: outcome.officer, label: `${outcome.officer === 'serious' ? 'Seriously wounded' : 'Wounded'} on the call at {place}` } } : {}),
      ...(outcome.objective ? { objective: outcome.objective } : {}),
      ...(outcome.civilian ? { civilian: outcome.civilian } : {}),
      ...(outcome.pressure ? { pressure: outcome.pressure } : {}),
      ...(outcome.minutes ? { extraMinutes: outcome.minutes } : {}),
      ...(next ? 'node' in next ? { stage: nextStage } : { ending: next.ending } : {}),
      ...drawnFor(node, outcome),
      text: outcome.text,
    };
    return [effect];
  };

  const actionFor = (node: TreeNode, choice: TreeChoice): ActionDefinition => {
    const visibleWhen = joinConditions(node.id === tree.root ? { notFlags: [TREE_STARTED] } : { flags: [nodeFlag(node.id)] }, stateCondition(trim(choice.onlyIf), groups));
    const modifiers = (choice.modifiers ?? []).filter(m => settable.marks.has(m.mark));
    const walker = choice.walks;
    // Talking to a group is talking to its first member, the one nearest the team.
    const talksTo = choice.talksTo ? oneOf(choice.talksTo, 'a conversation with') : undefined;
    const action: ActionDefinition = {
      id: choiceActionId(tree.type, node.id, choice.id), stage: node.stage, title: choice.title, summary: choice.summary, task: choice.title, icon: choice.icon,
      targetId: walker ? outside : room.id,
      requires: {
        ...(choice.requires ?? {}),
        ...(node.id === tree.root ? { notFlags: [{ flag: TREE_STARTED, reason: 'This decision is behind you' }] } : { flags: [{ flag: nodeFlag(node.id), reason: 'This decision is no longer open' }] }),
      },
      visibleWhen,
      check: { kind: choice.check.kind, ratings: choice.check.ratings.map(rating => ({ ...rating })), difficulty: difficulty + (choice.check.difficulty ?? 0) },
      workload: { base: choice.minutes + (deliberate && choice.talksTo === deliberate.id ? 2 : 0), perSqFt: 0 },
      approach: walker ? 'path' : 'none', observes: [], stressBase: choice.stress ?? 1,
      outcomePreview: { ...choice.preview },
      consequenceLevel: choice.consequenceLevel ?? 'low',
      ...(choice.tempo ? { tempo: choice.tempo } : {}),
      ...(choice.span ? { timeLabel: choice.span } : {}),
      ...(choice.equipment ? { equipment: structuredClone(choice.equipment) } : {}),
      ...(choice.capabilities ? { capabilities: structuredClone(choice.capabilities) } : {}),
      ...(modifiers.length ? { modifiers: modifiers.map(m => ({ label: m.label, when: { flags: [markFlag(m.mark)] }, source: m.value < 0 ? 'difficulty' as const : 'preparation' as const, value: Math.abs(m.value) })) } : {}),
      ...(walker ? { storyRoute: routeName(walker), storyRouteActor: 'person' as const, storyTargetPersonId: walker } : talksTo ? { storyTargetPersonId: talksTo } : {}),
      ...(talksTo ? { talksTo } : {}),
      ...(choice.authority ? { authority: choice.authority === 'entry' ? { kind: 'entry' as const } : { kind: 'concession' as const, item: choice.authority.concede } } : {}),
      // A resolve-stage step always says it stays in resolve unless it ends the call; the engine
      // reads that before any branch, and a later routed effect still moves the call on.
      outcomes: Object.fromEntries(BANDS.map(band => [band, [...(node.stage === 'resolve' ? [{ stage: 'resolve' as const }] : []),
        ...choice.outcomes[band].filter(outcome => possible(outcome.when)).flatMap(outcome => effectsFor(node, { ...outcome, when: trim(outcome.when) }))]])) as ActionDefinition['outcomes'],
    };
    if (deliberate && choice.talksTo === deliberate.id) action.summary += ` Allow extra time for {${deliberate.id}.first} to answer.`;
    return action;
  };

  s.stages = Object.fromEntries(STAGES.map(stage => {
    const here = nodes.filter(node => node.stage === stage);
    if (!here.length) throw new Error(`${tree.type}: no reachable node in ${stage}`);
    const contextPrompts = here.flatMap(node => {
      const at = node.id === tree.root ? { notFlags: [TREE_STARTED] } : { flags: [nodeFlag(node.id)] };
      return [
        ...(node.promptIf ?? []).filter(entry => possible(entry.when)).map(entry => ({ when: joinConditions(at, stateCondition(trim(entry.when), groups)), prompt: entry.prompt })),
        { when: at, prompt: node.prompt },
      ];
    });
    const definition: StageDefinition = { id: stage, label: tree.stageLabels[stage], prompt: here[0].prompt, contextPrompts,
      actions: here.flatMap(node => node.choices.filter(choice => possible(choice.onlyIf)).map(choice => actionFor(node, choice))) };
    return [stage, definition];
  })) as Record<StageId, StageDefinition>;

  // Only the endings this call's actions can reach, plus the exhausted-choices fallback.
  const reachableEndings = new Set(['handed_over', ...Object.values(s.stages).flatMap(stage => stage.actions.flatMap(action => withVariants(Object.values(action.outcomes).flat()).flatMap(effect => effect.ending ? [effect.ending] : [])))]);
  s.endings = Object.fromEntries(Object.entries(tree.endings).filter(([id]) => reachableEndings.has(id)).map(([id, ending]) => [id, {
    // A v13 debrief scores trust and strain from people's end states (sim/outcome-score.ts).
    id, title: ending.title, summary: ending.summary, trustAdjust: 0, strain: 0, disposition: ending.disposition,
    ...(['resolved', 'care_accepted', 'followup_agreed'].includes(ending.disposition) ? { completion: { flags: [endFlag(id)] } } : {}),
    ...(ending.remainingTasks ? { remainingTasks: [...ending.remainingTasks] } : {}),
  }]));

  const bound = mapScenarioText(s, textBinder(tree, built, placed));
  const errors = validateStoryBindings(bound, built);
  if (errors.length) throw new Error(errors.join('\n'));
  return bound;
}
