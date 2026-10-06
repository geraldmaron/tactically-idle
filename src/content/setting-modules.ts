import type { IncidentType } from '../sim/scenario-types';
import type { BuiltLocation, LocationDefinition, ObjectType, Room, RoomType } from '../sim/types';
import { hashSeed } from '../sim/rng';
import { queryStoryRooms, selectStoryRoom, type StoryRoomSelector } from '../sim/story-bindings';

/** Setting modules (content v11+). A framework's decision graph is authored once; a
 * setting module says who is where, doing what, in one class of building, and supplies
 * the prose that changes with it. Modules are typed data so new ones (including
 * agent-drafted ones) never add code paths: the framework's compiler reads `roles` to
 * place its people and `prose` to rebind display text. See docs/setting-modules.md. */

/** Building classes a module can declare. Derived from the built location's rooms, never
 * from the family ID, so a new building type joins a module by having the right rooms. */
export type SettingKind = 'retail' | 'office' | 'warehouse' | 'motel' | 'home';

/** A room requirement on the real building. Every listed field must match. */
export interface SettingRoomSelector {
  /** Room uses (the generator's room types). */
  types?: readonly RoomType[];
  /** Every tag must be on the room. */
  tags?: readonly string[];
  /** Every object requirement must match a real object in the room. */
  objects?: readonly { type?: ObjectType; tags?: readonly string[] }[];
  /** Allowed floors (0 = ground). Omitted means any floor. */
  floors?: readonly number[];
}

/** One person the framework places. `rooms` is an ordered affinity list (all matches are
 * candidates; the seed picks among them) or `scene`, meaning the same room as the
 * module's scene role. Rooms are always reachable from the story's arrival. */
export interface SettingRole {
  /** The framework's stable story person ID (never a prose name). */
  personId: string;
  /** Short public description of who this person is here. */
  label: string;
  rooms: readonly SettingRoomSelector[] | 'scene';
}

export interface SettingModule<Prose = unknown> {
  id: string;
  framework: IncidentType;
  /** Building classes this module is written for. */
  settings: readonly SettingKind[];
  /** Location-level needs beyond the role rooms. */
  requires: { setting?: LocationDefinition['setting']; rooms?: readonly SettingRoomSelector[]; minFloors?: number };
  /** The role whose room is the story's scene room (its routes and reach actions). */
  scene: string;
  roles: Readonly<Record<string, SettingRole>>;
  /** Framework-shaped prose. Templates may use {place}, {room} (scene room) and
   * {<role>Room} for any other role; names stay as the framework's authored cast names
   * so the v9 cast binder renames them afterwards. */
  prose: Prose;
}

export interface SettingSelection<Prose = unknown> {
  module: SettingModule<Prose>;
  /** Role ID → the real room chosen for it. */
  rooms: Record<string, Room>;
}

/** Building classes present in a built location, from room uses and tags. */
export function locationSettings(location: LocationDefinition): SettingKind[] {
  const kinds: SettingKind[] = [];
  const has = (test: (room: Room) => boolean) => location.rooms.some(test);
  if (location.setting !== 'business') kinds.push('home');
  if (has(room => room.type === 'retail')) kinds.push('retail');
  if (has(room => room.tags.includes('meeting'))) kinds.push('office');
  if (has(room => room.tags.includes('warehouse'))) kinds.push('warehouse');
  if (has(room => room.tags.includes('guest'))) kinds.push('motel');
  return kinds;
}

const storySelector = (selector: SettingRoomSelector, arrival: string): StoryRoomSelector => ({
  types: selector.types, tags: selector.tags, requiredObjects: selector.objects, reachableFromSpaceId: arrival,
  ...(selector.floors?.length === 1 ? { floor: selector.floors[0] } : {}),
});
function candidates(built: BuiltLocation, selectors: readonly SettingRoomSelector[], arrival: string, exclude: readonly string[]): Room[] {
  const found = new Map<string, Room>();
  for (const selector of selectors) for (const room of queryStoryRooms(built, storySelector(selector, arrival)))
    if (!exclude.includes(room.id) && (!selector.floors || selector.floors.includes(room.floor))) found.set(room.id, room);
  return [...found.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Resolves every role of one module on the building, or null when any role has no room.
 * A single-selector scene role uses the shared story selector (so a module that restates
 * an older story's selector picks exactly the room that story picked); other roles draw
 * from their sorted candidates with a role-keyed seed, and never share a room unless
 * declared `scene`. */
export function resolveSettingModule<P>(module: SettingModule<P>, built: BuiltLocation, arrival: string, seed: number): SettingSelection<P> | null {
  const { location } = built;
  if (module.requires.setting && location.setting !== module.requires.setting) return null;
  if (module.requires.minFloors && new Set(location.rooms.map(room => room.floor)).size < module.requires.minFloors) return null;
  for (const selector of module.requires.rooms ?? []) if (!candidates(built, [selector], arrival, []).length) return null;
  const sceneRole = module.roles[module.scene];
  if (!sceneRole || sceneRole.rooms === 'scene') throw new Error(`Setting module ${module.id} needs a scene role with rooms`);
  const scenes = candidates(built, sceneRole.rooms, arrival, []);
  const first = sceneRole.rooms.length === 1 ? selectStoryRoom(built, storySelector(sceneRole.rooms[0], arrival), seed) : pickRoom(scenes, seed, module.scene);
  if (!first) return null;
  // The seeded room first, then the rest in ID order from there: a scene room whose other
  // roles have nowhere to stand (a motel office with no second public room) yields to the next.
  const start = Math.max(0, scenes.findIndex(room => room.id === first.id));
  for (let k = 0; k < scenes.length; k++) {
    const scene = scenes[(start + k) % scenes.length];
    const rooms: Record<string, Room> = { [module.scene]: scene };
    for (const [roleId, role] of Object.entries(module.roles)) {
      if (roleId === module.scene) continue;
      const room = role.rooms === 'scene' ? scene : pickRoom(candidates(built, role.rooms, arrival, Object.values(rooms).map(r => r.id)), seed, roleId);
      if (!room) break;
      rooms[roleId] = room;
    }
    if (Object.keys(rooms).length === Object.keys(module.roles).length) return { module, rooms };
  }
  return null;
}
const pickRoom = (rooms: Room[], seed: number, role: string) => rooms.length ? rooms[hashSeed(`${seed}:${role}:setting-room`) % rooms.length] : null;

/** The module that fits the built location: those whose settings the building has and
 * whose requirements and roles resolve; a seeded, ID-ordered tie-break when several fit. */
export function selectSettingModule<P>(modules: readonly SettingModule<P>[], built: BuiltLocation, arrival: string, seed: number): SettingSelection<P> | null {
  const kinds = locationSettings(built.location);
  const fits = [...modules].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    .filter(module => module.settings.some(kind => kinds.includes(kind)))
    .map(module => resolveSettingModule(module, built, arrival, seed))
    .filter((selection): selection is SettingSelection<P> => selection !== null);
  return fits.length ? fits[hashSeed(`${seed}:setting-module`) % fits.length] : null;
}

/** Fills {place}, {room} and {<role>Room} tokens. Room names are the real labels in
 * sentence case ("meeting room", "warehouse floor"); an unknown token is an authoring
 * error, not a blank. */
export function bindSettingTemplate(text: string, tokens: Readonly<Record<string, string>>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (!(key in tokens)) throw new Error(`Unknown setting-module token {${key}}`);
    return tokens[key];
  });
}
