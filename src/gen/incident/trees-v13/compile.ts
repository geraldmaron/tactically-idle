import type { CallTree, ChatLine, TreeChoice, TreeIf, TreeLine, TreeMove, TreeMoveTo, TreeNext, TreeNode, TreeOutcome, TreePlace, TreeState, TreeTimeout } from '../../../content/call-trees/types';
import { TREE_VOICES } from '../../../content/call-trees/types';
import type { IncidentTemplate } from '../../../content/incidents/types';
import { CIVILIAN_FIRST_NAMES, CIVILIAN_SURNAMES } from '../../../content/call-trees/civilian-names';
import { scenarioRecipe } from '../../../content/scenario-recipes';
import { worldFor } from '../../../content/world';
import { hashIndex, hashSeed } from '../../../sim/rng';
import { tierRewardMultiplier } from '../../../content/incidents/rewards';
import type { ActionDefinition, ChatLineDef, ClockCondition, Condition, FactDefinition, IncidentSpec, MeterCondition, MeterStance, NodeThreat, OutcomeEffect, ScenarioDefinition, SpokenLine, StageDefinition, StoryAnchor, StoryPersonBinding } from '../../../sim/scenario-types';
import { squadsPutToWork } from '../../../sim/scenario-types';
import { findStoryRoute, selectStoryRoom, storyPoint, validateStoryBindings, windowExit } from '../story-bindings';
import { cueMoveKey, movedFlag, seenFlag, stableFlag } from '../../../sim/conditions';
import { routeAlongOpenings } from '../../../sim/routes';
import { sightFromStreet, vantageZones, type StreetVantage } from '../../../sim/sightlines';
import type { BuiltLocation, OutcomeBand, StageId, Vec } from '../../../sim/types';
import { mapScenarioText } from '../scenario-text';
import { CREW_MARKS, crewFlag, leadFlag } from '../../../sim/crew-flags';
import { asRole, CASCADE_LINES, countWord, FIRE_LINES, FORCE_LINES, listOf } from '../../../content/incidents/lines';
import { cascadeCombos, cascadeKey, cascadeResult, withVariants } from '../drawn-model';
import { gearFor } from '../action-gear';

const STAGES: readonly StageId[] = ['assess', 'adapt', 'resolve'];
const BANDS: readonly OutcomeBand[] = ['favorable', 'mixed', 'adverse'];
export const TREE_STARTED = 'tree:started';
const nodeFlag = (node: string) => `at:${node}`;
const markFlag = (mark: string) => `mark:${mark}`;
export const safeFlag = (role: string) => `safe:${role}`;
const outFlag = (role: string) => `out:${role}`;
const hurtFlag = (role: string) => `hurt:${role}`;
const careFlag = (role: string) => `care:${role}`;
const endFlag = (ending: string) => `end:${ending}`;
export const personFactId = (role: string) => `p_${role}`;
export const treeFactId = (key: string) => `f_${key}`;
export const choiceActionId = (type: string, node: string, choice: string) => `t13_${type}_${node}_${choice}`;

/** What a team move (TreeTeam) costs and earns, baked into every compiled call like the default
 * difficulty. `clearPerSqFt`: minutes per square foot to clear a room the team moves into (a
 * 200 sq ft shop floor is a minute). `signalWeight`: score points for a fully clear voice or
 * sightline from where the squad stands, scaled by how well it carries through the building. */
/** Team-move constants the compiler bakes into each action. `supportMax` and `supportReachMinutes`
 * are a support choice's SupportRule defaults (R-B4): the most a second squad adds in score points,
 * and the travel minutes at which what it adds reaches zero. */
export const TEAM_MOVES = { clearPerSqFt: 0.005, signalWeight: { voice: 6, visual: 6 }, supportMax: 10, supportReachMinutes: 10 } as const;

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
/** A piece of bound text. Names carry the role (cast id) that produced them, and `group` when that
 * person is a member of a counted role; everything else (pronouns, verb forms, places, rooms,
 * counts, the text between tokens) is plain. */
export interface BoundPart { text: string; role?: string; group?: string }

/** TOKEN's own scanner, so a caller's `TOKEN.lastIndex` never shifts where binding starts. */
const TOKEN_SCAN = new RegExp(TOKEN.source, TOKEN.flags);

/** One token's bound parts; throws on an unknown token, as binding always has. */
function bindToken(token: RegExpMatchArray, text: string, cast: Record<string, CastIdentity>, place: string, rooms: Record<string, string>, groups: Record<string, readonly string[]>, world: Record<string, string>): BoundPart[] {
  const [match, role, part, singular, plural, heForm, sheForm, theyForm, oneForm, manyForm] = token as unknown as [string, string, ...(string | undefined)[]];
  const bare = !part && singular === undefined && heForm === undefined && oneForm === undefined;
  if (ENGINE_TOKENS.has(role) && bare) return [{ text: match }];
  if (role === 'place' && bare && place) return [{ text: place }];
  if (bare && !cast[role] && world[role] !== undefined) return [{ text: world[role] }];
  if (role === 'scene' && bare && rooms.scene) return [{ text: rooms.scene }];
  if (part === 'room' && rooms[role]) return [{ text: rooms[role] }];
  if (groups[role]) {
    const ids = groups[role];
    const members = ids.map(id => cast[id]);
    if (!members.length || members.some(member => !member)) throw new Error(`No members of ${role} in this call for ${match} in "${text}"`);
    // After the names, the verb agrees with how many: one name is singular, whoever it is.
    if (oneForm !== undefined) return [{ text: members.length === 1 ? oneForm : manyForm! }];
    // After a pronoun, one member reads as that person; two or more as plural they.
    const one = members.length === 1 ? members[0].pronouns : null;
    if (singular !== undefined) return [{ text: one === 'he' || one === 'she' ? singular : plural! }];
    if (heForm !== undefined) {
      if (!one) throw new Error(`A gendered word for ${members.length} members of ${role}: ${match} in "${text}" needs a count condition with max 1`);
      return [{ text: one === 'he' ? heForm : one === 'she' ? sheForm! : theyForm! }];
    }
    if (part === 'n') return [{ text: countWord(members.length) }];
    if (part === 'first') return [{ text: members[0].firstName, role: ids[0], group: role }];
    if (part === 'last') return [{ text: members[0].surname, role: ids[0], group: role }];
    if (part && PRONOUN_FORMS[part.toLowerCase()]) {
      const word = PRONOUN_FORMS[part.toLowerCase()][one ?? 'they'];
      return [{ text: part[0] === part[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word }];
    }
    if (part) throw new Error(`Unknown group token ${match} in "${text}"`);
    // listOf stays the one rule for joining names: it joins numbered markers, and each marker
    // becomes that member's name.
    return listOf(ids.map((_, i) => `\u0000${i}\u0000`)).split(/\u0000(\d+)\u0000/)
      .map((piece, i) => i % 2 ? { text: members[Number(piece)].firstName, role: ids[Number(piece)], group: role } : { text: piece });
  }
  const who = cast[role];
  if (!who || part === 'room' || part === 'n') throw new Error(`Unknown token ${match} in "${text}"`);
  // One person's name is one name: the singular form.
  if (oneForm !== undefined) return [{ text: oneForm }];
  if (singular !== undefined) return [{ text: who.pronouns === 'they' ? plural! : singular }];
  if (heForm !== undefined) return [{ text: who.pronouns === 'he' ? heForm : who.pronouns === 'she' ? sheForm! : theyForm! }];
  if (part === 'age') { if (who.age === undefined) throw new Error(`No age drawn for ${role} in "${text}"`); return [{ text: String(who.age) }]; }
  if (part && PRONOUN_FORMS[part.toLowerCase()]) {
    const word = PRONOUN_FORMS[part.toLowerCase()][who.pronouns];
    return [{ text: part[0] === part[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word }];
  }
  // A member written by id ({others_1.first}, compiler text only) still belongs to their group.
  const group = Object.keys(groups).find(id => groups[id].includes(role));
  const name = part === 'first' ? who.firstName : part === 'last' ? who.surname : `${who.firstName} ${who.surname}`;
  return [group ? { text: name, role, group } : { text: name, role }];
}

/** Bind a string as bindRoleTokens does, keeping which person each name came from: the oracle for
 * the people-name matcher (src/ui/people/lexicon.ts) and the lab's Script. Adjacent plain parts are
 * merged and empty parts dropped, so joining the texts gives exactly bindRoleTokens' output. */
export function bindRoleSegments(text: string, cast: Record<string, CastIdentity>, place = '', rooms: Record<string, string> = {}, groups: Record<string, readonly string[]> = {}, world: Record<string, string> = worldFor(0)): BoundPart[] {
  const parts: BoundPart[] = [];
  const add = (next: BoundPart) => {
    if (!next.text) return;
    const last = parts[parts.length - 1];
    if (last && !last.role && !next.role) last.text += next.text;
    else parts.push({ ...next });
  };
  let at = 0;
  for (const token of text.matchAll(TOKEN_SCAN)) {
    add({ text: text.slice(at, token.index) });
    for (const part of bindToken(token, text, cast, place, rooms, groups, world)) add(part);
    at = token.index! + token[0].length;
  }
  add({ text: text.slice(at) });
  return parts;
}

/** Replace role tokens, `{place}`, `{scene}` and `{role.room}`; an unknown token is an authoring
 * error, never silent text. `groups` maps each counted role to its members' ids, in order: a group
 * token in a call with no members is an error too, because count conditions keep that text out of
 * lone calls. */
export function bindRoleTokens(text: string, cast: Record<string, CastIdentity>, place = '', rooms: Record<string, string> = {}, groups: Record<string, readonly string[]> = {}, world: Record<string, string> = worldFor(0)): string {
  return bindRoleSegments(text, cast, place, rooms, groups, world).map(part => part.text).join('');
}

/** Public state as an engine condition. A group in `safe` means every member is safe, in `notSafe`
 * that none is. A count condition is the compiler's, settled before this (countHolds). */
export function stateCondition(state: TreeState | undefined, groups: Record<string, readonly string[]> = {}): Condition {
  const people = (roles: readonly string[] | undefined) => (roles ?? []).flatMap(role => groups[role] ?? [role]);
  const flags = [...(state?.marks ?? []).map(markFlag), ...people(state?.safe).map(safeFlag), ...(state?.crew ?? []).map(crewFlag), ...(state?.lead ?? []).map(leadFlag)];
  const notFlags = [...(state?.notMarks ?? []).map(markFlag), ...people(state?.notSafe).map(safeFlag), ...(state?.notCrew ?? []).map(crewFlag), ...(state?.notLead ?? []).map(leadFlag)];
  return { ...(flags.length ? { flags } : {}), ...(notFlags.length ? { notFlags } : {}) };
}

/** Where `TreeState.armed` would let text show what the team hasn't seen (R-G1). The condition
 * reads the drawn cast, so each state that carries it must also list in `marks` a mark that only a
 * look sets: every outcome that sets it, in the nodes this call compiles, is a favorable result of
 * a choice that observes the group's room (`lookInto`), the result on which sightings settle what
 * the members hold. A mark a clock sets, a shot sets (`fire.mark`), or nothing in this call sets
 * doesn't count. Returns one message per leaking state. */
export function armedRevealErrors(authored: CallTree, nodes: readonly TreeNode[], lookInto: (node: TreeNode, choice: TreeChoice) => readonly string[],
  groupRoom: (group: string) => string | undefined, clockMarks: readonly string[] = []): string[] {
  // A band where any outcome sends the team back never gets the look (sim/sightings.ts), so a mark
  // it sets is no reveal even when its own outcome stays.
  type Setter = { node: TreeNode; choice: TreeChoice; band: OutcomeBand } | 'other';
  const setters = new Map<string, Setter[]>();
  const add = (mark: string, setter: Setter) => (setters.get(mark) ?? setters.set(mark, []).get(mark)!).push(setter);
  for (const node of nodes) for (const choice of node.choices) for (const band of BANDS) for (const outcome of choice.outcomes[band]) {
    for (const mark of outcome.mark ?? []) add(mark, { node, choice, band });
    if (outcome.fire?.mark) add(outcome.fire.mark, 'other');
  }
  for (const mark of clockMarks) add(mark, 'other');
  const onlyByLook = (mark: string, room: string | undefined) => {
    const list = setters.get(mark) ?? [];
    return list.length > 0 && room !== undefined && list.every(setter => setter !== 'other' && setter.band === 'favorable'
      && !setter.choice.outcomes[setter.band].some(outcome => outcome.back) && lookInto(setter.node, setter.choice).includes(room));
  };
  const errors: string[] = [];
  const check = (where: string, state: TreeState | undefined) => {
    if (!state?.armed) return;
    if (!(state.marks ?? []).some(mark => onlyByLook(mark, groupRoom(state.armed!.role))))
      errors.push(`${authored.type}: ${where} reads what ${state.armed.role} hold before the team has seen it; add a mark only a favorable look into their room sets`);
  };
  for (const node of authored.nodes) {
    for (const [i, entry] of (node.promptIf ?? []).entries()) check(`${node.id} prompt variant ${i + 1}`, entry.when);
    for (const choice of node.choices) {
      check(`${node.id}.${choice.id}`, choice.onlyIf);
      for (const band of BANDS) for (const [i, outcome] of choice.outcomes[band].entries()) check(`${node.id}.${choice.id} ${band} outcome ${i + 1}`, outcome.when);
    }
  }
  return errors;
}

/** Authoring errors in a call's lies (deception-commitments, dilemma pattern 15): a `lie` promise is
 * made only by a choice marked `deceives`, every `deceives` choice makes one, every lie can be found
 * out by an outcome that names it in `breaks` and says so in its text, and `breaks` names only
 * promises the call makes. */
export function deceptionErrors(tree: CallTree): string[] {
  const errors: string[] = [];
  const promises = new Set<string>(), lies = new Set<string>(), broken = new Set<string>();
  for (const node of tree.nodes) for (const choice of node.choices) {
    let made = false;
    for (const band of BANDS) for (const outcome of choice.outcomes[band]) {
      if (outcome.promise) promises.add(outcome.promise.id);
      if (outcome.promise?.kind === 'lie') {
        lies.add(outcome.promise.id); made = true;
        if (!choice.deceives) errors.push(`${tree.type}: ${node.id}.${choice.id} tells a lie (${outcome.promise.id}) but is not marked deceives`);
      }
      for (const id of outcome.breaks ?? []) {
        broken.add(id);
        if (!outcome.text.trim()) errors.push(`${tree.type}: ${node.id}.${choice.id} ${band}: breaking ${id} needs text that says the person found out`);
      }
    }
    if (choice.deceives && !made) errors.push(`${tree.type}: ${node.id}.${choice.id} is marked deceives but makes no lie promise`);
  }
  for (const id of lies) if (!broken.has(id)) errors.push(`${tree.type}: the lie ${id} is never found out; add an outcome that breaks it`);
  for (const id of broken) if (!promises.has(id)) errors.push(`${tree.type}: an outcome breaks ${id}, which no outcome promises`);
  return errors;
}

/** The key in a call's compile-time facts for how many of a group's members hold a weapon a look would see. */
export const armedKey = (group: string) => `${group}:armed`;
/** The key in a call's compile-time facts for whether a role starts above the ground floor (1) or not (0). */
export const upstairsKey = (role: string) => `${role}:upstairs`;
/** The key in a call's compile-time facts for whether a role has that way out of its room (1) or not (0). */
export const exitKey = (role: string, via: 'window' | 'front' | 'back') => `${role}:via:${via}`;
/** The story route a walker takes out by that way (TreeChoice.walksVia). */
export const viaRouteName = (role: string, via: 'window' | 'front' | 'back') => `exit_${role}_${via}`;

/** Whether a state's compile-time conditions hold for this call's compile-time facts (callCounts):
 * its group sizes (`count`), how many members hold something (`armed`, armedKey) and which roles
 * start upstairs (`upstairs`, `notUpstairs`, upstairsKey). A fact with no entry is unknown, and
 * the condition on it holds: only the lab and the string checks sweep without one, so they see every
 * line; a compiled call always passes every entry (callCounts) and keeps only its own. */
export function countHolds(state: TreeState | undefined, counts: Record<string, number>): boolean {
  const armed = state?.armed ? counts[armedKey(state.armed.role)] : undefined;
  if (armed !== undefined && armed < (state!.armed!.min ?? 1)) return false;
  if ((state?.upstairs ?? []).some(role => counts[upstairsKey(role)] === 0)) return false;
  if ((state?.notUpstairs ?? []).some(role => counts[upstairsKey(role)] === 1)) return false;
  if (state?.exitVia && counts[exitKey(state.exitVia.role, state.exitVia.via)] === 0) return false;
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
  for (const state of states) if (state?.armed && !groups[state.armed.role]) throw new Error(`${tree.type}: an armed condition on ${state.armed.role}, which is not a group`);
  for (const state of states) for (const role of [...state?.upstairs ?? [], ...state?.notUpstairs ?? []])
    if (!tree.roles.some(entry => entry.id === role) && !groups[role]) throw new Error(`${tree.type}: an upstairs condition on ${role}, which is not a role or group`);
  for (const state of states) if (state?.exitVia && !tree.roles.some(entry => entry.id === state.exitVia!.role))
    throw new Error(`${tree.type}: a way-out condition on ${state.exitVia.role}, which is not a role`);
  if (!states.some(state => state?.count || state?.armed || state?.upstairs || state?.notUpstairs || state?.exitVia)) return tree;
  const strip = <T extends { count?: unknown; armed?: unknown; upstairs?: unknown; notUpstairs?: unknown; exitVia?: unknown }>(state: T | undefined): T | undefined => {
    if (!state?.count && !state?.armed && !state?.upstairs && !state?.notUpstairs && !state?.exitVia) return state;
    const { count: _count, armed: _armed, upstairs: _upstairs, notUpstairs: _notUpstairs, exitVia: _exitVia, ...rest } = state;
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

/** Where a clock running out sends the call (Clock.onOut.next, R-G4), as the engine applies it
 * (ClockDef.onOut.route): the target node's flag and stage, or the ending, with every other node
 * flag cleared, since the call may be at any node when the clock runs out. A clock sends the call
 * on to the last stage or ends it, never anywhere earlier: a route can't go back a stage from any
 * node, so commit and replay need no stage to agree, and the root (open only before the call
 * starts) is never a target. */
export function clockRoute(tree: CallTree, to: TreeNext, seed: number): Pick<OutcomeEffect, 'setFlags' | 'clearFlags' | 'stage' | 'ending'> {
  const next = resolveNext(tree, to, seed);
  const target = 'node' in next ? tree.nodes.find(node => node.id === next.node) : undefined;
  if ('node' in next && !target) throw new Error(`${tree.type}: a clock runs out to unknown node ${next.node}`);
  if (target && (target.id === tree.root || target.stage !== STAGES[STAGES.length - 1]))
    throw new Error(`${tree.type}: a clock runs out to ${target.id}, which is not a ${STAGES[STAGES.length - 1]} node; a clock moves the call on to the last stage or ends it`);
  if ('ending' in next && !tree.endings[next.ending] && next.ending !== 'handed_over') throw new Error(`${tree.type}: a clock runs out to unknown ending ${next.ending}`);
  const others = tree.nodes.filter(node => node.id !== target?.id).map(node => nodeFlag(node.id));
  return 'node' in next
    ? { setFlags: [TREE_STARTED, nodeFlag(next.node)], clearFlags: others, stage: target!.stage }
    : { setFlags: [TREE_STARTED, endFlag(next.ending)], clearFlags: others, ending: next.ending };
}

/** Where any situation's clocks can send the call when they run out (Clock.onOut.next), once each:
 * what the static checks (strings, lint, the graph) count as reachable from every node. A clock the
 * story runs by itself never routes. */
export function templateClockNexts(template: Pick<IncidentTemplate, 'situations'>): TreeNext[] {
  const all = template.situations.flatMap(situation => (situation.clocks ?? []).filter(clock => !clock.story).flatMap(clock => [...clock.onOut?.next ? [clock.onOut.next] : [], ...clock.onFull?.next ? [clock.onFull.next] : []]));
  return [...new Map(all.map(next => [JSON.stringify(next), next])).values()];
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

/** Where a threat's run-out can send the call (TreeTimeout): every `nextIf` route, then `next`. */
export function timeoutNexts(node: Pick<TreeNode, 'threat'>): TreeNext[] {
  const timeout = node.threat?.timeout;
  return timeout ? [...(timeout.nextIf ?? []).map(entry => entry.next), timeout.next] : [];
}

/** Everywhere a node can send the call: each choice's outcomes on every band, and its threat's
 * run-out routes. */
export function nodeNexts(node: TreeNode, counts?: Record<string, number>): TreeNext[] {
  return [...node.choices.flatMap(choice => BANDS.flatMap(band => choice.outcomes[band].flatMap(outcome => outcomeNexts(outcome, counts)))), ...timeoutNexts(node)];
}

/** What a call with these group sizes can reach from the root, through every turn any call can draw:
 * its nodes and endings (with the exhausted-choices fallback). For strings and gates; a compiled
 * call reaches only its own turns (reachableNodes). */
export function reachableWithin(tree: CallTree, counts: Record<string, number>, clockNexts: readonly TreeNext[] = []): { nodes: Set<string>; endings: Set<string> } {
  const byId = new Map(tree.nodes.map(node => [node.id, node]));
  const nodes = new Set([tree.root]), endings = new Set(['handed_over']);
  const queue = [tree.root];
  for (const next of clockNexts) {
    if ('ending' in next) { endings.add(next.ending); continue; }
    for (const id of 'turn' in next ? tree.turns?.[next.turn] ?? [] : [next.node]) if (!nodes.has(id)) { nodes.add(id); queue.push(id); }
  }
  for (; queue.length;) {
    const node = byId.get(queue.shift()!);
    for (const next of node ? nodeNexts(node, counts) : []) {
      if ('ending' in next) { endings.add(next.ending); continue; }
      for (const id of 'turn' in next ? tree.turns?.[next.turn] ?? [] : [next.node]) if (!nodes.has(id)) { nodes.add(id); queue.push(id); }
    }
  }
  return { nodes, endings };
}

/** Nodes this call can reach from the root, after its turn draws (and its group sizes, when given),
 * and from where its clocks send it when they run out (`clockNexts`, reached from any node). */
export function reachableNodes(tree: CallTree, seed: number, counts?: Record<string, number>, clockNexts: readonly TreeNext[] = []): TreeNode[] {
  const byId = new Map(tree.nodes.map(node => [node.id, node]));
  const fromClocks = clockNexts.map(to => resolveNext(tree, to, seed)).flatMap(next => 'node' in next ? [next.node] : []);
  const seen = new Set<string>([tree.root, ...fromClocks]), queue = [tree.root, ...fromClocks];
  while (queue.length) {
    const node = byId.get(queue.shift()!);
    if (!node) continue;
    for (const to of nodeNexts(node, counts)) {
      const next = resolveNext(tree, to, seed);
      if ('node' in next && !seen.has(next.node)) { seen.add(next.node); queue.push(next.node); }
    }
  }
  return tree.nodes.filter(node => seen.has(node.id));
}

/** Which marks and safe flags a call can set, and so which conditions can ever hold in it: the
 * compiler's own pruning. A choice, outcome or prompt variant whose `marks` or `safe` need one this
 * call can never set is dropped; a `notMarks` or `notSafe` on one is always true. */
export interface PrunePlan {
  settableMarks: ReadonlySet<string>;
  settableSafe: ReadonlySet<string>;
  /** Whether a state can ever hold in this call: its count condition (for an authored state) and
   * every mark and safe flag it needs. */
  possible(state: TreeState | undefined): boolean;
  /** Why it never can, as a plain sentence, or null when it can. `name` gives a mark, role or group
   * its label (ids by default). */
  why(state: TreeState | undefined, name?: (kind: 'mark' | 'role', id: string) => string): string | null;
}

/** The settable-mark fixpoint for a call with these group sizes (`counts`) and these clock marks
 * (cues and running out, which count as settable). With `seed`, over the nodes that call can reach
 * after its turn draws (what withCallTree compiles); without, over every turn any call can draw.
 * An outcome's own marks count, and so does the mark its `fire` sets when an officer is hit: a
 * drawn result, but one the call can produce. Marks set only by choices that need a mark nobody
 * sets don't count either: repeat until nothing more drops out. */
export function prunePlan(tree: CallTree, counts: Record<string, number>, clockMarks: readonly string[] = [], seed?: number, clockNexts: readonly TreeNext[] = []): PrunePlan {
  const counted = treeForCounts(tree, counts);
  const reach = seed === undefined ? reachableWithin(counted, counts, clockNexts).nodes : null;
  const nodes = reach ? counted.nodes.filter(node => reach.has(node.id)) : reachableNodes(counted, seed!, counts, clockNexts);
  const choices = nodes.flatMap(node => node.choices);
  const settableFrom = (live: TreeChoice[]) => {
    const outcomes = live.flatMap(choice => BANDS.flatMap(band => choice.outcomes[band]));
    const marks = outcomes.flatMap(outcome => [...outcome.mark ?? [], ...outcome.fire?.mark ? [outcome.fire.mark] : []]);
    return { marks: new Set([...marks, ...clockMarks]), safe: new Set(outcomes.flatMap(outcome => outcome.safe ?? [])) };
  };
  let settable = settableFrom(choices);
  const holds = (state: TreeState | undefined) => (state?.marks ?? []).every(mark => settable.marks.has(mark)) && (state?.safe ?? []).every(role => settable.safe.has(role));
  for (let live = choices; ;) {
    const next = choices.filter(choice => holds(choice.onlyIf));
    if (next.length === live.length) break;
    live = next;
    settable = settableFrom(live);
  }
  const { marks, safe } = settable;
  const possible = (state: TreeState | undefined) => countHolds(state, counts) && holds(state);
  return {
    settableMarks: marks, settableSafe: safe, possible,
    why(state, name = (_kind, id) => id) {
      if (possible(state)) return null;
      if (state?.armed && !countHolds({ armed: state.armed }, counts)) {
        const { role, min = 1 } = state.armed;
        return `needs ${min} of ${name('role', role)} holding something; this call has ${counts[armedKey(role)]}`;
      }
      const low = (state?.upstairs ?? []).find(role => counts[upstairsKey(role)] === 0);
      if (low !== undefined) return `needs ${name('role', low)} upstairs; this call has them on the ground floor`;
      const high = (state?.notUpstairs ?? []).find(role => counts[upstairsKey(role)] === 1);
      if (high !== undefined) return `needs ${name('role', high)} on the ground floor; this call has them upstairs`;
      if (state?.exitVia && counts[exitKey(state.exitVia.role, state.exitVia.via)] === 0)
        return `needs a way out by the ${state.exitVia.via} for ${name('role', state.exitVia.role)}; this building has none`;
      if (!countHolds(state, counts)) {
        const { role, min, max } = state!.count!, n = counts[role] ?? 0, who = name('role', role);
        const need = min !== undefined && max !== undefined ? min === max ? `${who} = ${min}` : `${who} ${min} to ${max}` : min !== undefined ? `${who} ≥ ${min}` : `${who} ≤ ${max}`;
        return `needs ${need}; this call has ${n}`;
      }
      const mark = state!.marks?.find(id => !marks.has(id));
      if (mark !== undefined) return `${name('mark', mark)} can never be set in this call`;
      const role = state!.safe?.find(id => !safe.has(id));
      return `${name('role', role!)} is never brought out safe in this call`;
    },
  };
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
  routes: Record<string, { fromSpaceId: string; toSpaceId: string; openingIds: string[]; profile: 'walking' | 'chair'; exitOpeningId?: string }>;
  routeName: (role: string) => string;
  anchors: Record<string, { inside: Vec; outside: Vec }>;
  cast: Record<string, CastIdentity>;
  /** Each counted role's members ('others' → ['others_1', 'others_2']), nearest the door first.
   * Every member is in roomOf, anchors and cast like a key role. */
  groups: Record<string, string[]>;
  /** Where each offsite role watches from, when the template places them (instance.ts): what a
   * sightline fact draws its line from. */
  vantages?: Record<string, StreetVantage>;
  /** Per counted role, how many members hold a weapon a look would see (instance.ts), for
   * `TreeState.armed`. Absent: unknown, so armed conditions hold (countHolds). */
  armed?: Record<string, number>;
  /** Per role placed inside, whether its starting room is above the ground floor (placeCast), for
   * `TreeState.upstairs` and `notUpstairs`. */
  upstairs?: Record<string, boolean>;
  /** Per role placed inside, which ways out of its starting room this building gives (placeCast,
   * R-B2), for `TreeState.exitVia`. */
  exits?: Record<string, { window: boolean }>;
  /** The world tokens' text on this call: the city's canon and the drawn commenter (content/world.ts). */
  world?: Record<string, string>;
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
  const recipe = scenarioRecipe(spec, tree.situations.length);
  const situation = tree.situations[recipe.variant];
  if (!situation) throw new Error(`${tree.type} has no situation ${recipe.variant}`);
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
    // R-B1: the ground floor unless the role says otherwise; the route out then walks the stairs.
    const floor = place.floor ?? 'ground';
    const level = floor === 'ground' ? { floor: 0 } : floor === 'upper' ? { minFloor: 1 } : {};
    const own = place.rooms.reduce<ReturnType<typeof selectStoryRoom>>((found, type) => found ?? selectStoryRoom(built,
      { ...level, types: [type], reachableFromSpaceId: outside, excludeSpaceIds: [...usedRooms] }, hashSeed(`${spec.seed}:${role.id}:room-v13`)), null);
    if (!own) throw new Error(`No ${place.rooms.join(' or ')} room${floor === 'upper' ? ' above the ground floor' : ''} for ${role.id} in ${tree.type}`);
    usedRooms.add(own.id); roomOf[role.id] = own.id;
  }
  // A walking route out for every room someone starts in; the scene's is 'exit'.
  const routes: Record<string, { fromSpaceId: string; toSpaceId: string; openingIds: string[]; profile: 'walking' | 'chair'; exitOpeningId?: string }> = {};
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
  // R-B2: which roles placed inside have a window to climb out of, and that way out for every role a
  // choice walks by it (viaRouteName). A chair user never climbs. The window counts only when the
  // walk to it is clear of furniture from where the person starts, as the walk-out check below and
  // the engine read it, so a blocked window prunes the choice instead of refusing the building.
  const exits: Record<string, { window: boolean }> = {};
  const viaWindow = new Set(tree.nodes.flatMap(node => node.choices.flatMap(choice => choice.walks && choice.walksVia === 'window' ? [choice.walks] : [])));
  for (const role of onSite) {
    if (roomOf[role.id] === undefined || roomOf[role.id] === outside) continue;
    const exit = chair(role.id) ? null : windowExit(built, roomOf[role.id]);
    const found = exit ? findStoryRoute(built, roomOf[role.id], outside, 'walking', exit.id) : null;
    const openingIds = found && routeAlongOpenings(built, anchors[role.id].inside, anchors[role.id].outside, found, null, false, 1).reachable ? found : null;
    exits[role.id] = { window: !!openingIds };
    if (openingIds && viaWindow.has(role.id)) routes[viaRouteName(role.id, 'window')] = { fromSpaceId: roomOf[role.id], toSpaceId: outside, openingIds, profile: 'walking', exitOpeningId: exit!.id };
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
  // R-B1: which roles start above the ground floor, for TreeState.upstairs.
  const floorOf = new Map(built.location.rooms.map(entry => [entry.id, entry.floor]));
  const above = (spaceId: string | undefined) => spaceId !== undefined && spaceId !== outside && (floorOf.get(spaceId) ?? 0) > 0;
  const upstairs = Object.fromEntries([
    ...tree.roles.filter(role => roomOf[role.id] !== undefined && roomOf[role.id] !== outside).map(role => [role.id, above(roomOf[role.id])]),
    // A group means its leader's room, where its members start: only when the leader is inside,
    // so a floor condition on a group led from outside or offsite is rejected like the leader's own.
    ...Object.entries(tree.groups ?? {}).filter(([, def]) => roomOf[def.leader] !== undefined && roomOf[def.leader] !== outside)
      .map(([group, def]) => [group, above(roomOf[def.leader])]),
  ]);
  return { recipe, situation, outside, room, roomOf, routes, routeName, anchors, cast, groups, upstairs, exits, world: worldFor(spec.seed) };
}

/** The first opening on a route out that joins a room to the outside: the door it leaves the
 * building by. */
export function doorOut(built: BuiltLocation, openingIds: readonly string[]) {
  const zones = new Set(built.location.zones.map(zone => zone.id));
  return openingIds.map(id => built.location.openings.find(opening => opening.id === id)!).find(opening => zones.has(opening.a) !== zones.has(opening.b));
}

/** A sightline fact on this building (TreeFact.sightline): whether the offsite role's vantage
 * sees the door the target role's way out leaves the building by. */
export function sightlineHolds(tree: CallTree, built: BuiltLocation, placed: PlacedCast, key: string): boolean {
  const { from, to } = tree.facts[key].sightline!;
  const at = placed.vantages?.[from];
  if (!at) throw new Error(`${tree.type}: the sightline ${key} is drawn from ${from}, whom the template gives no vantage`);
  const route = placed.routes[placed.routeName(to)];
  if (!route) throw new Error(`${tree.type}: the sightline ${key} looks at the way out of ${to}, who has none`);
  const door = doorOut(built, route.openingIds);
  if (!door) throw new Error(`${tree.type}: the way out of ${to} never leaves the building`);
  return sightFromStreet(built, placed.outside, at, door.id).clear;
}

/** The engine id of a counted role's nth member (1-based): 'others_1'. */
export const memberId = (group: string, n: number) => `${group}_${n}`;

/** How many members each counted role has in this placement. */
export const memberCounts = (placed: Pick<PlacedCast, 'groups'>): Record<string, number> =>
  Object.fromEntries(Object.entries(placed.groups).map(([group, ids]) => [group, ids.length]));

/** A call's compile-time facts, which every compile-time condition reads (countHolds): its group
 * sizes, per group how many members hold a weapon a look would see (`armedKey`), and per role placed
 * inside whether its room is upstairs (`upstairsKey`, 1 or 0) and whether it has a window to climb
 * out of (`exitKey`, 1 or 0). Named for counts, it holds facts
 * about the building and the drawn cast too. */
export const callCounts = (placed: Pick<PlacedCast, 'groups' | 'armed' | 'upstairs' | 'exits'>): Record<string, number> => ({
  ...memberCounts(placed),
  ...Object.fromEntries(Object.entries(placed.armed ?? {}).map(([group, n]) => [armedKey(group), n])),
  ...Object.fromEntries(Object.entries(placed.upstairs ?? {}).map(([role, up]) => [upstairsKey(role), up ? 1 : 0])),
  ...Object.fromEntries(Object.entries(placed.exits ?? {}).map(([role, ways]) => [exitKey(role, 'window'), ways.window ? 1 : 0])),
});

/** How this call's text binds: the drawn names, pronouns and ages, the building's name for
 * {place}, and room labels for {scene} and {role.room}. The compiler, the Scenario Lab and the
 * string checks all bind through this. */
export function textBinder(tree: CallTree, built: BuiltLocation, placed: PlacedCast): (text: string) => string {
  const { room, roomOf, outside, cast, groups = {} } = placed;
  const roomLabel = (id: string) => (built.location.rooms.find(entry => entry.id === id)?.label ?? 'room').toLowerCase();
  const rooms = { scene: roomLabel(room.id), ...Object.fromEntries(tree.roles.filter(role => role.place !== 'offsite' && roomOf[role.id] !== outside).map(role => [role.id, roomLabel(roomOf[role.id])])),
    ...Object.fromEntries(Object.entries(groups).flatMap(([group, ids]) => ids.length ? [[group, roomLabel(roomOf[ids[0]])], ...ids.map(id => [id, roomLabel(roomOf[id])])] : [])) };
  return text => bindRoleTokens(text, cast, built.location.name, rooms, groups, placed.world);
}

/** `clockNexts`: where this call's clocks send it when they run out (Clock.onOut.next), so a node
 * or ending reached only that way is kept. `clockMarks`: marks this call's clocks can set by themselves (cues, running out), so a prompt or
 * choice that reads one is kept even when no outcome sets it. */
export function withCallTree(input: ScenarioDefinition, built: BuiltLocation, authored: CallTree, placed: PlacedCast = placeCast(authored, built, input.incident!), clockMarks: readonly string[] = [], clockNexts: readonly TreeNext[] = [], clockMoves: readonly { clockId: string; index: number; moveTo: TreeMoveTo }[] = []): ScenarioDefinition {
  const spec = input.incident!;
  const { recipe, situation, outside, room, roomOf, routes, routeName, anchors, cast } = placed;
  // Counted roles (groups): their size is fixed for this call, so count conditions settle here and
  // a group in `out`, `safe`, `harm` or `moves` means every member.
  const groups = placed.groups ?? {};
  for (const [group, def] of Object.entries(authored.groups ?? {})) {
    if (!authored.roles.some(role => role.id === def.leader)) throw new Error(`${authored.type}: group ${group} is led by ${def.leader}, who is not a role`);
    if (!/^[a-z][a-z_]*$/.test(group)) throw new Error(`${authored.type}: group id ${group} must be lower snake case`);
  }
  // A floor condition reads a room inside: one on a role outside or offsite has no floor to read,
  // so it is an authoring error, never a line the missing-fact default would let through.
  for (const node of authored.nodes) for (const state of [...(node.promptIf ?? []).map(entry => entry.when), ...node.choices.flatMap(choice => [choice.onlyIf,
    ...BANDS.flatMap(band => choice.outcomes[band].map(outcome => outcome.when))])])
    for (const role of [...state?.upstairs ?? [], ...state?.notUpstairs ?? []]) if (placed.upstairs?.[role] === undefined)
      throw new Error(`${authored.type}: ${node.id} reads whether ${role} is upstairs, but ${role} starts outside the building`);
  // R-B2: a walk-out by a chosen way is offered only where that way exists (TreeState.exitVia).
  for (const node of authored.nodes) {
    for (const state of [...(node.promptIf ?? []).map(entry => entry.when), ...node.choices.flatMap(choice => [choice.onlyIf, ...BANDS.flatMap(band => choice.outcomes[band].map(outcome => outcome.when))])])
      if (state?.exitVia && state.exitVia.via !== 'window')
        throw new Error(`${authored.type}: ${node.id} reads ${state.exitVia.role}'s way out by the ${state.exitVia.via}, which waits for rescue's R-R5; only 'window' is built`);
      else if (state?.exitVia && placed.exits?.[state.exitVia.role] === undefined)
        throw new Error(`${authored.type}: ${node.id} reads ${state.exitVia.role}'s way out, but ${state.exitVia.role} starts outside the building`);
    for (const choice of node.choices) {
      if (!choice.walksVia) continue;
      const where = `${authored.type}: ${node.id}.${choice.id}`;
      if (!choice.walks) throw new Error(`${where}: walksVia needs someone who walks out`);
      if (choice.walksVia !== 'window') throw new Error(`${where}: walksVia '${choice.walksVia}' waits for rescue's R-R5 (front and back doors); only 'window' is built`);
      if (choice.onlyIf?.exitVia?.role !== choice.walks || choice.onlyIf.exitVia.via !== choice.walksVia)
        throw new Error(`${where}: walksVia '${choice.walksVia}' must carry onlyIf: { exitVia: { role: '${choice.walks}', via: '${choice.walksVia}' } }`);
    }
  }
  // A crew condition names a trait or experience band the engine sets (sim/crew-flags.ts).
  for (const node of authored.nodes) for (const state of [...(node.promptIf ?? []).map(entry => entry.when), ...node.choices.flatMap(choice => [choice.onlyIf, ...BANDS.flatMap(band => choice.outcomes[band].map(outcome => outcome.when))])])
    for (const mark of [...state?.crew ?? [], ...state?.notCrew ?? []]) if (!CREW_MARKS.includes(mark))
      throw new Error(`${authored.type}: ${node.id} reads crew '${mark}', which is no trait or band the engine sets`);
  // A lead condition reads the same names for the officer leading the decision, so it belongs on a result.
  for (const node of authored.nodes) {
    for (const state of [...(node.promptIf ?? []).map(entry => entry.when), ...node.choices.map(choice => choice.onlyIf)])
      if (state?.lead?.length || state?.notLead?.length) throw new Error(`${authored.type}: ${node.id} reads the lead before anyone leads; put it on an outcome's when`);
    // Only an addendum may read the lead: routing that hung on who leads would make one choice's
    // future depend on a swap the player made after reading its preview.
    for (const choice of node.choices) for (const band of BANDS) for (const outcome of choice.outcomes[band])
      if (outcome.next && (outcome.when?.lead?.length || outcome.when?.notLead?.length)) throw new Error(`${authored.type}: ${node.id}.${choice.id} routes on the lead; only an addendum line may read it`);
    for (const state of node.choices.flatMap(choice => BANDS.flatMap(band => choice.outcomes[band].map(outcome => outcome.when))))
      for (const mark of [...state?.lead ?? [], ...state?.notLead ?? []]) if (!CREW_MARKS.includes(mark))
        throw new Error(`${authored.type}: ${node.id} reads lead '${mark}', which is no trait or band the engine sets`);
  }
  const lieErrors = deceptionErrors(authored);
  if (lieErrors.length) throw new Error(lieErrors.join('\n'));
  const tree = treeForCounts(authored, callCounts({ groups, armed: placed.armed, upstairs: placed.upstairs, exits: placed.exits }));
  const everyone = (roles: readonly string[] | undefined) => (roles ?? []).flatMap(role => groups[role] ?? [role]);
  /** A group where one person is meant (who fires, who force is used on, who is talked to): its
   * first member, nearest the door. A call with no members never offers that line. */
  const oneOf = (role: string, what: string) => {
    const ids = groups[role];
    if (!ids) return role;
    if (!ids.length) throw new Error(`${tree.type}: ${what} ${role} in a call with no members of ${role}: put it behind a count condition`);
    return ids[0];
  };
  /** A transcript as the engine shows it (call-surfaces): each speaker by the name token the text
   * binder fills (a group speaks as its first member), or a voice the call always has. */
  const spoken = (lines: readonly TreeLine[] | undefined, where: string): SpokenLine[] => (lines ?? []).map(({ by, line }) => {
    if (!line.trim()) throw new Error(`${tree.type}: ${where} has an empty transcript line`);
    const voice = TREE_VOICES[by as keyof typeof TREE_VOICES];
    if (voice) return { speaker: voice, line };
    if (!tree.roles.some(role => role.id === by) && !groups[by]) throw new Error(`${tree.type}: ${where}: ${by} speaks, but is no role, group or voice`);
    if (groups[by] && !groups[by].length) throw new Error(`${tree.type}: ${where}: ${by} speaks in a call with no members of ${by}: put it behind a count condition`);
    return { speaker: `{${by}.first}`, line };
  });
  // Someone outside the building (the shooter across the street) is in the prose, never on the map.
  const onSite = tree.roles.filter(role => role.place !== 'offsite');
  // Everyone on the map: the roles, then each group's members, who take their leader's kind.
  const present = [...onSite.map(role => ({ id: role.id, label: role.label, kind: role.kind })),
    ...Object.entries(groups).flatMap(([group, ids]) => ids.map(id => ({ id, label: tree.groups![group].label, kind: tree.roles.find(role => role.id === tree.groups![group].leader)!.kind })))];
  const nodes = reachableNodes(tree, spec.seed, callCounts({ groups, armed: placed.armed, upstairs: placed.upstairs, exits: placed.exits }), clockNexts);
  // Anyone a choice in this call walks out needs that walk clear of furniture, as the engine
  // checks it; otherwise hosting moves the call to another building seed (the v12 rule).
  for (const node of nodes) for (const choice of node.choices) if (choice.walks && groups[choice.walks]) throw new Error(`${node.id}.${choice.id}: only a key role walks out, never the group ${choice.walks}`);
  const walkRoute = (choice: TreeChoice) => choice.walksVia ? viaRouteName(choice.walks!, choice.walksVia) : routeName(choice.walks!);
  const walks = new Map(nodes.flatMap(node => node.choices.flatMap(choice => choice.walks ? [[walkRoute(choice), choice.walks] as const] : [])));
  for (const [name, walker] of walks) {
    const route = routes[name];
    if (!route) throw new Error(`No ${name} route for ${walker} in ${tree.type}`);
    if (!routeAlongOpenings(built, anchors[walker].inside, anchors[walker].outside, route.openingIds, null, false, route.profile === 'chair' ? 1.5 : 1).reachable)
      throw new Error(`Walk out blocked for ${walker} in ${tree.type}`);
  }
  // Marks and releases this call can actually set (prunePlan). A condition that needs one it can
  // never set is never true here (drop it); one that needs it absent is always true (strip that
  // part). The tree's count conditions are already settled, so `possible` reads marks and safety.
  // The marks a stalled decision's push-back lines set count as settable: over every node, which
  // only keeps more conditions.
  // So do the marks a threat sets when it lands.
  const beatMarks = tree.nodes.flatMap(node => [...(node.threat?.beats ?? []).flatMap(line => line.mark ?? []), ...node.threat?.mark ?? []]);
  const plan = prunePlan(tree, callCounts({ groups, armed: placed.armed, upstairs: placed.upstairs, exits: placed.exits }), [...clockMarks, ...beatMarks], spec.seed, clockNexts);
  const settable = { marks: plan.settableMarks, safe: plan.settableSafe };
  const possible = plan.possible;
  const trim = (state: TreeState | undefined): TreeState | undefined => state && {
    marks: state.marks, safe: state.safe,
    notMarks: state.notMarks?.filter(mark => settable.marks.has(mark)), notSafe: state.notSafe?.filter(role => settable.safe.has(role)),
    ...(state.crew ? { crew: state.crew } : {}), ...(state.notCrew ? { notCrew: state.notCrew } : {}),
    ...(state.lead ? { lead: state.lead } : {}), ...(state.notLead ? { notLead: state.notLead } : {}),
  };
  const nodeById = new Map(tree.nodes.map(node => [node.id, node]));
  const s = structuredClone(input);
  const difficulty = (tree.difficulty?.base ?? 31) + spec.tier * (tree.difficulty?.perTier ?? 3);
  const truthOf = (key: string): boolean => {
    const fact = tree.facts[key];
    if (fact?.sightline) return sightlineHolds(tree, built, placed, key);
    const value = fact?.truth ?? situation.truth[key];
    if (value === undefined) throw new Error(`Fact ${key} has no truth in situation ${recipe.variant}`);
    return value;
  };

  s.version = 13;
  s.title = s.variantLabel = tree.title;
  s.summary = tree.summary;
  s.pressureLabel = tree.pressureLabel;
  s.pressure = { ...tree.pressure };
  const profiles = tree.roles.filter(role => role.profile?.trim()).map(role => ({ personId: role.id, name: `{${role.id}}`, role: role.label, text: role.profile! }));
  s.briefing = { dispatchReason: tree.briefing.dispatchReason, known: [...tree.briefing.known], unknown: [...tree.briefing.unknown], teamResponsibilities: [...tree.briefing.responsibilities],
    ...(profiles.length ? { people: profiles } : {}) };
  if (tree.coldOpen) s.coldOpen = tree.coldOpen;
  s.objectives = tree.objectives.map(objective => ({ ...objective }));
  s.externalServices = [];
  const multiplier = tierRewardMultiplier(spec.tier);
  s.rewards = { funding: Math.round(tree.rewards.funding * multiplier), trust: Math.round(tree.rewards.trust * multiplier), xp: Math.round(tree.rewards.xp * multiplier) };
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

  // R-B3: people move on the building. Each move compiles into the person's story transitions,
  // hidden until the team sees them there (an observed twin keyed on a seen flag sightings set), or
  // observed at once when the line says where they went. Leaving the building stays the last word.
  /** The space a TreePlace names on this building; a route step of the wrong kind can't be hosted. */
  const spaceOfPlace = (place: TreePlace, where: string): string => {
    if (place === 'scene') return room.id;
    const inside = (role: string) => {
      const id = roomOf[groups[role]?.[0] ?? role];
      if (!id || id === outside) throw new Error(`${tree.type}: ${where} ${role}'s room, but ${role} starts outside the building`);
      return id;
    };
    if ('room' in place) return inside(place.room);
    const from = inside('doorOf' in place ? place.doorOf : place.route);
    const way = routes[routeName('doorOf' in place ? place.doorOf : place.route)]?.openingIds ?? [];
    const steps: string[] = [];
    for (let at = from, i = 0; i < way.length; i++) {
      const opening = built.location.openings.find(entry => entry.id === way[i])!;
      at = opening.a === at ? opening.b : opening.a;
      steps.push(at);
    }
    if ('doorOf' in place) {
      if (!steps[0]) throw new Error(`${tree.type}: ${where} the door of ${place.doorOf}'s room, which has no way out`);
      return steps[0];
    }
    const id = steps[place.step - 1], found = built.location.rooms.find(entry => entry.id === id), kinds = ([] as string[]).concat(place.is);
    // The step's room changes with the building, so its declared kind is checked here: elsewhere the call goes to another building.
    if (!found || !kinds.includes(found.type)) throw new Error(`${tree.type}: ${where} step ${place.step} of ${place.route}'s way out, which is ${found ? `a ${found.type}` : 'not a room'} on this building, not ${kinds.join(' or ')}; this building can't host the call`);
    return id;
  };
  /** Just past the door of `role`'s room on its way out: the staging spot there. */
  const doorStanding = (role: string, spaceId: string): Vec | null => {
    const first = routes[routeName(role)]?.openingIds[0];
    return built.derived.stagingPoints.find(point => point.openingId === first && point.spaceId === spaceId)?.at ?? null;
  };
  const moves = new Map<TreeOutcome, string[]>();
  const transitionsOf = new Map<string, StoryPersonBinding['transitions']>();
  const moveCount = new Map<string, number>();
  // Where people stand, and who stands there: everyone's start, then each new place a move takes
  // someone. A person's moves are one person over time, so their own earlier places never crowd
  // them, and a second move of the same person to the same place reuses that place's point.
  const standing: (StoryAnchor & { role: string; moved?: true })[] = Object.entries(anchors).map(([role, anchor]) => ({ role, spaceId: roomOf[role], at: anchor.inside }));
  const movedTo = new Map<string, Vec>();
  // Each move: a hidden transition keyed on its move flag (where they are), and a twin keyed on its
  // seen flag (where the team last saw them). The engine keeps one of each per person (withFlag), so
  // the latest move wins; a seen move sets both, a sighting sets the seen flag (sightings.ts).
  const addMove = (role: string, entry: TreeMoveTo[string], where: string, key: number | string): string[] => {
    if (groups[role]) throw new Error(`${tree.type}: ${where} moves the group ${role}; moves are for one person`);
    if (roomOf[role] === undefined || roomOf[role] === outside) throw new Error(`${tree.type}: ${where} moves ${role}, who starts outside the building`);
    const place = typeof entry === 'object' && 'to' in entry ? entry.to : entry, seen = typeof entry === 'object' && 'to' in entry && entry.seen;
    const list = transitionsOf.get(role) ?? transitionsOf.set(role, []).get(role)!;
    const spaceId = spaceOfPlace(place, `${where} moves ${role} to`);
    const door = typeof place === 'object' && 'doorOf' in place ? doorStanding(place.doorOf, spaceId) : null;
    const placeKey = `${role}|${spaceId}|${door ? 'door' : 'room'}`;
    const others = standing.filter(anchor => anchor.role !== role || !anchor.moved);
    const at = movedTo.get(placeKey) ?? door ?? storyPoint(built, spaceId, hashSeed(`${spec.seed}:${role}:move-${key}`), others);
    if (!at) throw new Error(`${tree.type}: no room to stand in ${spaceId} for ${role}'s move; this building can't host the call`);
    if (!movedTo.has(placeKey)) { movedTo.set(placeKey, at); standing.push({ role, spaceId, at, moved: true }); }
    const to = { spaceId, at: { ...at } };
    list.push({ when: { flags: [movedFlag(role, key)] }, observed: false, to }, { when: { flags: [seenFlag(role, key)] }, observed: true, to });
    return [movedFlag(role, key), ...seen ? [seenFlag(role, key)] : []];
  };
  // Only the choices and outcomes this call compiles (actionFor's possible() filters): a pruned one's
  // move would be a transition on a flag nothing sets.
  for (const node of nodes) for (const choice of node.choices) if (possible(choice.onlyIf)) for (const band of BANDS) for (const outcome of choice.outcomes[band])
    if (outcome.moveTo && possible(outcome.when)) moves.set(outcome, Object.entries(outcome.moveTo).flatMap(([role, entry]) => {
      const n = (moveCount.get(role) ?? 0) + 1;
      moveCount.set(role, n);
      return addMove(role, entry, `${node.id}.${choice.id}`, n);
    }));
  // A clock cue's moves: its flags ride on the compiled cue (instance.ts), named the same here.
  const cueFlags = clockMoves.flatMap(cue => Object.entries(cue.moveTo).flatMap(([role, entry]) => addMove(role, entry, `clock ${cue.clockId} cue ${cue.index + 1}`, cueMoveKey(cue.clockId, cue.index))));
  // A moved person's start-room facts and way out no longer describe them.
  for (const role of transitionsOf.keys()) {
    for (const node of authored.nodes) for (const state of [...(node.promptIf ?? []).map(entry => entry.when), ...node.choices.flatMap(choice => [choice.onlyIf, ...BANDS.flatMap(band => choice.outcomes[band].map(outcome => outcome.when))])])
      if ([...state?.upstairs ?? [], ...state?.notUpstairs ?? []].includes(role) || state?.exitVia?.role === role)
        throw new Error(`${tree.type}: ${node.id} reads where ${role} started (upstairs or a way out), but ${role} moves in this call`);
    if (nodes.some(node => node.choices.some(choice => choice.walks === role))) throw new Error(`${tree.type}: ${role} moves in this call and also walks out from where they started; a walk-out after a move isn't built`);
  }

  const people: Record<string, StoryPersonBinding> = Object.fromEntries(present.map(role => [role.id, {
    id: role.id, label: `{${role.id}}`, locationFactId: personFactId(role.id), publicKind: role.kind === 'bystander' ? 'person' : role.kind,
    initial: { spaceId: roomOf[role.id], at: anchors[role.id].inside },
    transitions: roomOf[role.id] === outside ? [] : [...transitionsOf.get(role.id) ?? [],
      { when: { flags: [outFlag(role.id)] }, observed: true, to: { spaceId: outside, at: anchors[role.id].outside }, label: role.kind === 'civilian' ? 'Outside with patrol' : 'Outside with the team' }],
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

  const effectsFor = (node: TreeNode, authoredOutcome: TreeOutcome, moveFlags: readonly string[] = []): OutcomeEffect[] => {
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
      ...moveFlags,
      ...(outcome.safe ?? []).map(safeFlag),
      ...out.map(outFlag),
      // A medic holding a person steady stops their clock where it stands (sim/clocks.ts stopped).
      ...(outcome.stabilize ?? []).map(stableFlag),
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
      ...(outcome.breaks?.length ? { breaks: [...outcome.breaks] } : {}),
      ...(outcome.exchange?.length ? { exchange: spoken(outcome.exchange, `${node.id} result`) } : {}),
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
      ...(outcome.bump ? { clockBump: Object.entries(outcome.bump).map(([clockId, by]) => ({ clockId, by })) } : {}),
      ...(outcome.minutes ? { extraMinutes: outcome.minutes } : {}),
      ...(outcome.back ? { fallBack: true as const } : {}),
      ...(next ? 'node' in next ? { stage: nextStage } : { ending: next.ending } : {}),
      ...drawnFor(node, outcome),
      text: outcome.text,
    };
    return [effect];
  };

  /** The room a team move names: the scene, or the room a role starts in (a group: its member
   * nearest the door). */
  const roomFor = (node: TreeNode, choice: TreeChoice, target: string) => {
    if (target === 'scene') return room.id;
    const id = roomOf[oneOf(target, 'a team move to')];
    if (!id || id === outside) throw new Error(`${node.id}.${choice.id}: the team moves to ${target}, who is not inside`);
    return id;
  };
  /** A choice's physical intent as the engine runs it (TreeTeam): the approach, the room it acts on,
   * an entry's exposure, a signal, the room it sees into and where the squad ends. The team sees a
   * room it goes into, and a room it watches by sight from a vantage (sim/sightings.ts). A voice
   * through a wall, a word from the cars and an escort out see no one: the escort meets a person who
   * is already walking out with them. */
  const movement = (node: TreeNode, choice: TreeChoice): Pick<ActionDefinition, 'approach' | 'targetId' | 'workload' | 'entry' | 'spatial' | 'endsAt' | 'observes'> => {
    const team = choice.team, walker = choice.walks;
    const workload = { base: choice.minutes + (deliberate && choice.talksTo === deliberate.id ? 2 : 0), perSqFt: 0 };
    const to = team?.to;
    if (to === 'escort' && !walker) throw new Error(`${node.id}.${choice.id}: an escort needs someone who walks out`);
    if (walker && to !== undefined && to !== 'escort') throw new Error(`${node.id}.${choice.id}: someone who walks out comes out with the team or alone, so the team escorts or stays`);
    const entry = team?.entry ? { entry: { subjectFactId: personFactId(oneOf(team.entry, 'an entry on')) } } : {};
    const signal = team?.signal ? { spatial: { channel: team.signal.channel === 'voice' ? 'sound' as const : 'visual' as const, subjectFactId: personFactId(oneOf(team.signal.to, 'a signal to')),
      weight: TEAM_MOVES.signalWeight[team.signal.channel], noun: team.signal.channel === 'voice' ? 'Voice' : 'Sightline' } } : {};
    if (walker) return to === 'escort'
      ? { approach: 'path', targetId: outside, workload, observes: [], endsAt: { spaceId: outside, at: { ...anchors[walker].outside } } }
      : { approach: 'none', targetId: outside, workload, observes: [] };
    if (to === undefined) return { approach: 'none', targetId: room.id, workload, observes: [], ...entry, ...signal };
    if (typeof to === 'object' && ('vantage' in to || 'watch' in to)) {
      // A room with a window or door onto the outside is watched through it. An inside room (a
      // stockroom, a hallway) is reached through the building from the door its way out uses.
      const watched = 'watch' in to ? spaceOfPlace(to.watch, `${node.id}.${choice.id} watches`) : roomFor(node, choice, to.vantage);
      const observes = team?.signal?.channel === 'visual' ? [watched] : [];
      if (vantageZones(built.location, watched).length) return { approach: 'window', targetId: watched, workload, observes, ...entry, ...signal };
      const way = findStoryRoute(built, watched, outside, 'walking');
      const door = way ? doorOut(built, way) : undefined;
      const front = door && (built.location.zones.some(zone => zone.id === door.a) ? door.b : door.a);
      if (!door || !front) throw new Error(`${node.id}.${choice.id}: no way out of ${watched} to watch it from`);
      return { approach: 'window', targetId: front, workload, observes, ...entry,
        ...(signal.spatial ? { spatial: { ...signal.spatial, openingId: door.id } } : {}) };
    }
    // A door or a room on someone's way out (R-B3) is entered like a role's room.
    const targetId = typeof to === 'object' && ('doorOf' in to || 'route' in to) ? spaceOfPlace(to, `${node.id}.${choice.id} goes to`)
      : roomFor(node, choice, to === 'scene' ? 'scene' : (to as { room: string }).room);
    return { approach: 'path', targetId, workload: { ...workload, perSqFt: TEAM_MOVES.clearPerSqFt }, observes: [targetId], ...entry, ...signal };
  };

  /** Where a support choice's second squad holds (TreeChoice.support, R-B4): the outside space and
   * the opening it stages at. A vantage onto a room with an opening to the outside holds at that
   * opening (a window before a door, then by id); an inside room is held at the door its way out
   * leaves by. 'exit' holds outside the door the scene room's way out leaves the building by. */
  const supportPoint = (node: TreeNode, choice: TreeChoice): { coverSpaceId: string; openingId: string } => {
    const at = choice.support!.at;
    const zones = new Set(built.location.zones.map(zone => zone.id));
    const outsideOf = (opening: { a: string; b: string }) => zones.has(opening.a) ? opening.a : opening.b;
    const doorOutOf = (spaceId: string, what: string) => {
      const way = findStoryRoute(built, spaceId, outside, 'walking');
      const door = way ? doorOut(built, way) : undefined;
      if (!door) throw new Error(`${node.id}.${choice.id}: support at ${what} needs a way out of ${spaceId}`);
      return { coverSpaceId: outsideOf(door), openingId: door.id };
    };
    if (at === 'exit') return doorOutOf(room.id, 'the exit');
    const watched = roomFor(node, choice, at.vantage);
    const onto = built.location.openings.filter(opening => (opening.a === watched && zones.has(opening.b)) || (opening.b === watched && zones.has(opening.a)))
      .sort((a, b) => Number(b.type === 'window') - Number(a.type === 'window') || a.id.localeCompare(b.id));
    return onto.length ? { coverSpaceId: outsideOf(onto[0]), openingId: onto[0].id } : doorOutOf(watched, `the vantage on ${at.vantage}`);
  };
  const supportFor = (node: TreeNode, choice: TreeChoice): Pick<ActionDefinition, 'support'> => {
    if (!choice.support) return {};
    const { label, max = TEAM_MOVES.supportMax } = choice.support;
    if (!label.trim()) throw new Error(`${node.id}.${choice.id}: support needs a label naming the second squad's task`);
    if (choice.requires?.minSquads) throw new Error(`${node.id}.${choice.id}: a support choice works with one squad, so it can't require more`);
    return { support: { max, ...supportPoint(node, choice), reachMinutes: TEAM_MOVES.supportReachMinutes, maxSquads: 1,
      label, task: label[0].toUpperCase() + label.slice(1) } };
  };

  /** A decision point's threat (TreeNode.threat) as the engine runs it: its line and costs, applied
   * when a decision here runs long (sim/operation.ts). It may raise costs, never harm or route. */
  /** A threat's chat (ThreatChat) as the strip plays it: presentation only, so it rides on the shown
   * threat and no effect reads it. A line's speaker is a role of this call or the world's `{handle}`,
   * and `after` is a beat of the same threat, turned into that beat's minute. A threat that names a
   * `{handle}` ends its imminent thread on that commenter's own line. */
  const chatFor = (node: TreeNode): Pick<NodeThreat, 'chat'> => {
    const chat = node.threat?.chat;
    if (chat === undefined) return {};
    if (chat === false) return { chat: false };
    const threat = node.threat!;
    const beatAt = new Map((threat.beats ?? []).map(beat => [beat.id, beat.at]));
    const roleIds = new Set(tree.roles.map(role => role.id));
    const phase = (name: 'early' | 'closing' | 'imminent'): ChatLineDef[] => chat[name].map((entry: ChatLine, index) => {
      const where = `${node.id}: chat ${name}[${index}]`;
      const line = typeof entry === 'string' ? { text: entry } : entry;
      if (!line.text.trim()) throw new Error(`${where} has no text`);
      if (line.by !== undefined) {
        const role = /^\{([a-z_]+)\.first\}$/.exec(line.by)?.[1];
        if (line.by !== '{handle}' && !(role && roleIds.has(role))) throw new Error(`${where} is by "${line.by}", which is neither {handle} nor a role's {role.first}`);
      }
      if (line.after !== undefined && !beatAt.has(line.after)) throw new Error(`${where} waits for beat "${line.after}", which is not a beat of this threat`);
      return { text: line.text, ...(line.by !== undefined ? { by: line.by } : {}), ...(line.after !== undefined ? { afterMin: beatAt.get(line.after)! } : {}) };
    });
    const built = { early: phase('early'), closing: phase('closing'), imminent: phase('imminent') };
    if (`${threat.label} ${threat.text}`.includes('{handle}') && built.imminent.at(-1)?.by !== '{handle}') throw new Error(`${node.id}: the threat names a {handle}, so its last imminent chat line must be by {handle}`);
    return { chat: built };
  };
  const threatFor = (node: TreeNode): Pick<ActionDefinition, 'threat'> => {
    const threat = node.threat;
    if (!threat) return {};
    if (!(threat.minutes > 0)) throw new Error(`${node.id}: a threat needs minutes above zero`);
    const deadly = (threat.mark ?? []).filter(mark => tree.threatMarks?.[mark]);
    if (deadly.length) throw new Error(`${node.id}: a threat may not set the threat-to-life mark ${deadly.join(', ')} (E12.4)`);
    const { label, minutes, text, mark, moves: threatMoves, pressure, civilian, bump } = threat;
    const lines = threat.beats ?? [];
    const seenIds = new Set<string>();
    for (const line of lines) {
      if (!line.id || seenIds.has(line.id)) throw new Error(`${node.id}: a beat needs a unique id`);
      seenIds.add(line.id);
      if (!(line.at > 0 && line.at < minutes)) throw new Error(`${node.id}: beat ${line.id} fires at ${line.at}, which is not above 0 and below the threat's ${minutes} minutes`);
      const toLife = (line.mark ?? []).filter(entry => tree.threatMarks?.[entry]);
      if (toLife.length) throw new Error(`${node.id}: beat ${line.id} may not set the threat-to-life mark ${toLife.join(', ')} (E12.4)`);
    }
    const beats = lines.map(line => ({ id: line.id, at: line.at, effects: effectsFor(node, { text: '', exchange: [{ by: line.by, line: line.line }],
      ...(line.mark ? { mark: line.mark } : {}), ...(line.moves ? { moves: line.moves } : {}), ...(line.bump ? { bump: line.bump } : {}) }) }));
    const timeout = threat.timeout ? timeoutFor(node, threat.timeout) : [];
    return { threat: { id: node.id, label, minutes, effects: effectsFor(node, { text, ...(mark ? { mark } : {}), ...(threatMoves ? { moves: threatMoves } : {}), ...(pressure ? { pressure } : {}), ...(civilian ? { civilian } : {}), ...(bump ? { bump } : {}) }),
      ...(beats.length ? { beats } : {}), ...(timeout.length ? { timeout } : {}) } };
  };
  /** A threat's run-out route (TreeTimeout) as the engine's lapse applies it: one effect per route,
   * `nextIf` first, each with the moment's line, so the first whose state holds moves the call. Like
   * the threat it harms nobody and fires nothing (the type has no field for either), and like a
   * choice it never goes back to its own node, the root or an earlier stage. */
  const timeoutFor = (node: TreeNode, timeout: TreeTimeout): OutcomeEffect[] => {
    if (!timeout.text.trim()) throw new Error(`${node.id}: a threat's timeout needs the line the player reads`);
    const routes = [...(timeout.nextIf ?? []).filter(entry => possible(entry.when)), { next: timeout.next }];
    return routes.map(entry => {
      const target = resolveNext(tree, entry.next, spec.seed);
      if ('node' in target && target.node === tree.root) throw new Error(`${node.id}: a threat's timeout goes back to the root`);
      if ('ending' in target && !tree.endings[target.ending] && target.ending !== 'handed_over') throw new Error(`${node.id}: a threat's timeout ends the call at unknown ending ${target.ending}`);
      const go = routing(node, entry.next);
      const when = 'when' in entry ? stateCondition(trim(entry.when), groups) : undefined;
      return { text: timeout.text, ...go, ...(when && (when.flags || when.notFlags) ? { when } : {}) };
    });
  };

  const actionFor = (node: TreeNode, choice: TreeChoice): ActionDefinition => {
    const visibleWhen = joinConditions(node.id === tree.root ? { notFlags: [TREE_STARTED] } : { flags: [nodeFlag(node.id)] }, stateCondition(trim(choice.onlyIf), groups));
    const modifiers = (choice.modifiers ?? []).filter(m => settable.marks.has(m.mark));
    const walker = choice.walks;
    // Talking to a group is talking to its first member, the one nearest the team.
    const talksTo = choice.talksTo ? oneOf(choice.talksTo, 'a conversation with') : undefined;
    const action: ActionDefinition = {
      id: choiceActionId(tree.type, node.id, choice.id), stage: node.stage, title: choice.title, summary: choice.summary, task: choice.title, icon: choice.icon,
      ...movement(node, choice),
      ...supportFor(node, choice),
      requires: {
        ...(choice.requires ?? {}),
        ...(node.id === tree.root ? { notFlags: [{ flag: TREE_STARTED, reason: 'This decision is behind you' }] } : { flags: [{ flag: nodeFlag(node.id), reason: 'This decision is no longer open' }] }),
      },
      visibleWhen,
      check: { kind: choice.check.kind, ratings: choice.check.ratings.map(rating => ({ ...rating })), difficulty: difficulty + (choice.check.difficulty ?? 0) },
      stressBase: choice.stress ?? 1,
      outcomePreview: { ...choice.preview },
      consequenceLevel: choice.consequenceLevel ?? 'low',
      ...(choice.tempo ? { tempo: choice.tempo } : {}),
      ...(choice.favors?.length ? { favors: choice.favors.map(favor => ({ ...favor })) } : {}),
      ...(choice.span ? { timeLabel: choice.span } : {}),
      ...gearFor(choice),
      ...(modifiers.length ? { modifiers: modifiers.map(m => ({ label: m.label, when: { flags: [markFlag(m.mark)] }, source: m.value < 0 ? 'difficulty' as const : 'preparation' as const, value: Math.abs(m.value) })) } : {}),
      ...(walker ? { storyRoute: walkRoute(choice), storyRouteActor: 'person' as const, storyTargetPersonId: walker } : talksTo ? { storyTargetPersonId: talksTo } : {}),
      ...(talksTo ? { talksTo } : {}),
      ...(choice.deceives ? { deceives: true as const } : {}),
      ...(choice.pull && choice.cost ? { weighing: { pull: choice.pull, cost: choice.cost } } : {}),
      ...threatFor(node),
      ...(choice.certBonus ? { certBonus: { ...choice.certBonus } } : {}),
      ...(choice.authority ? { authority: choice.authority === 'entry' ? { kind: 'entry' as const } : { kind: 'concession' as const, item: choice.authority.concede } } : {}),
      // A resolve-stage step always says it stays in resolve unless it ends the call; the engine
      // reads that before any branch, and a later routed effect still moves the call on.
      outcomes: Object.fromEntries(BANDS.map(band => [band, [...(node.stage === 'resolve' ? [{ stage: 'resolve' as const }] : []),
        ...choice.outcomes[band].filter(outcome => possible(outcome.when)).flatMap(outcome => effectsFor(node, { ...outcome, when: trim(outcome.when) }, moves.get(outcome)))]])) as ActionDefinition['outcomes'],
    };
    if (deliberate && choice.talksTo === deliberate.id) action.summary += ` Allow extra time for {${deliberate.id}.first} to answer.`;
    return action;
  };

  // TreeState.armed reads the drawn cast: text behind it must wait for a look into the group's room.
  const leaks = armedRevealErrors(authored, nodes, (node, choice) => movement(node, choice).observes ?? [],
    group => roomOf[authored.groups?.[group]?.leader ?? ''], [...clockMarks, ...beatMarks]);
  if (leaks.length) throw new Error(leaks.join('\n'));

  s.stages = Object.fromEntries(STAGES.map(stage => {
    const here = nodes.filter(node => node.stage === stage);
    if (!here.length) throw new Error(`${tree.type}: no reachable node in ${stage}`);
    const contextPrompts = here.flatMap(node => {
      const at = node.id === tree.root ? { notFlags: [TREE_STARTED] } : { flags: [nodeFlag(node.id)] };
      const threatShown = node.threat ? { threat: { id: node.id, label: node.threat.label, minutes: node.threat.minutes, ...chatFor(node) } } : {};
      return [
        ...(node.promptIf ?? []).filter(entry => possible(entry.when)).map(entry => {
          const exchange = spoken(entry.exchange ?? node.exchange, `${node.id} prompt variant`);
          return { when: joinConditions(at, stateCondition(trim(entry.when), groups)), prompt: entry.prompt, ...(exchange.length ? { exchange } : {}), ...threatShown };
        }),
        { when: at, prompt: node.prompt, ...(node.exchange?.length ? { exchange: spoken(node.exchange, `${node.id} prompt`) } : {}), ...threatShown },
      ];
    });
    const definition: StageDefinition = { id: stage, label: tree.stageLabels[stage], prompt: here[0].prompt, contextPrompts,
      actions: here.flatMap(node => node.choices.filter(choice => possible(choice.onlyIf)).map(choice => actionFor(node, choice))) };
    return [stage, definition];
  })) as Record<StageId, StageDefinition>;

  // Deploy only as many squads as some choice can put to work: one acting squad, plus one more
  // where a choice authors support (R-B4).
  s.squadRange = { min: 1, max: Math.min(3, Math.max(1, ...Object.values(s.stages).flatMap(stage => stage.actions.map(squadsPutToWork)))) };

  // Only the endings this call's actions can reach, plus the exhausted-choices fallback.
  const reachableEndings = new Set(['handed_over', ...clockNexts.map(to => resolveNext(tree, to, spec.seed)).flatMap(next => 'ending' in next ? [next.ending] : []), ...Object.values(s.stages).flatMap(stage => stage.actions.flatMap(action => withVariants(Object.values(action.outcomes).flat()).flatMap(effect => effect.ending ? [effect.ending] : []))),
    // Where a threat running out with no choice made ends the call.
    ...Object.values(s.stages).flatMap(stage => stage.actions.flatMap(action => (action.threat?.timeout ?? []).flatMap(effect => effect.ending ? [effect.ending] : [])))]);
  s.endings = Object.fromEntries(Object.entries(tree.endings).filter(([id]) => reachableEndings.has(id)).map(([id, ending]) => [id, {
    // A v13 debrief scores trust and strain from people's end states (sim/outcome-score.ts).
    id, title: ending.title, summary: ending.summary, trustAdjust: 0, strain: 0, disposition: ending.disposition,
    ...(['resolved', 'care_accepted', 'followup_agreed'].includes(ending.disposition) ? { completion: { flags: [endFlag(id)] } } : {}),
    ...(ending.remainingTasks ? { remainingTasks: [...ending.remainingTasks] } : {}),
    ...(ending.epilogue ? { epilogue: ending.epilogue } : {}),
    ...(ending.epilogueIf?.length ? { epilogueIf: ending.epilogueIf.filter(entry => possible(entry.when)).map(entry => ({ when: stateCondition(trim(entry.when), groups), epilogue: entry.epilogue })) } : {}),
  }]));

  const bound = mapScenarioText(s, textBinder(tree, built, placed));
  const errors = validateStoryBindings(bound, built, [...clockMarks.map(markFlag), ...beatMarks.map(markFlag), ...cueFlags]);
  if (errors.length) throw new Error(errors.join('\n'));
  return bound;
}
