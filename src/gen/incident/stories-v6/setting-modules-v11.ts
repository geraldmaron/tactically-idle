import type { IncidentSpec, IncidentType, ScenarioDefinition } from '../../../sim/scenario-types';
import type { BuiltLocation } from '../../../sim/types';
import { hashSeed } from '../../../sim/rng';
import { storyPoint } from '../../../sim/story-bindings';
import { bindSettingTemplate, selectSettingModule, type SettingModule, type SettingSelection } from '../../../content/setting-modules';
import { ARMED_RETAIL, ARMED_SETTING_MODULES } from '../../../content/setting-modules-armed';
import { mapScenarioText } from './episode-plan';
import { roomPhraseV10 } from './hosts-v10';

/** Content v11 compiles setting modules into the authored stories: the module picks the
 * real rooms its roles stand in (v6 episode binding), and its prose replaces the setting
 * lines of the source module (last authored layer, before the v10 location rebinding and
 * the v9 cast). v10 and earlier never reach this file's effects. */
export const SETTING_MODULES_V11 = 11;
/** Per framework: the source module (the story as authored, whose prose is the text the
 * framework's layers actually emit) and every module the selector may choose. */
const FRAMEWORKS: Partial<Record<IncidentType, { source: SettingModule; modules: readonly SettingModule[] }>> = {
  active_armed_incident: { source: ARMED_RETAIL, modules: ARMED_SETTING_MODULES },
};
/** Marker recorded in story.episode.modules so later layers and the casebook read the
 * chosen module from the definition instead of re-deriving it. */
export const SETTING_MODULE_MARK = 'setting:';

/** The framework's modules when this incident compiles them; null keeps the v10 path. */
export function settingModulesFor(spec: Pick<IncidentSpec, 'type' | 'contentVersion'>): readonly SettingModule[] | null {
  return spec.contentVersion >= SETTING_MODULES_V11 ? FRAMEWORKS[spec.type]?.modules ?? null : null;
}

export function selectSettingV11(spec: IncidentSpec, built: BuiltLocation, arrival: string, seed: number): SettingSelection | null {
  const modules = settingModulesFor(spec);
  return modules ? selectSettingModule(modules, built, arrival, seed) : null;
}

/** Moves each non-scene role's person to the room the module chose. The story binder put
 * everyone in the scene room; only the anchor, report and location fact change, so routes,
 * flags and the decision graph are untouched. A role room without a free anchor fails the
 * seed (the board then tries another building seed), never a fake point. */
export function placeSettingRolesV11(s: ScenarioDefinition, built: BuiltLocation, selection: SettingSelection): void {
  const { module, rooms } = selection;
  const people = s.story!.bindings.people;
  for (const [roleId, role] of Object.entries(module.roles)) {
    if (roleId === module.scene || role.rooms === 'scene') continue;
    const person = people[role.personId], room = rooms[roleId];
    if (!person) throw new Error(`Setting module ${module.id} names unknown person ${role.personId}`);
    if (person.initial.spaceId === room.id) continue;
    const others = Object.values(people).filter(other => other !== person).map(other => other.initial);
    const at = storyPoint(built, room.id, hashSeed(`${s.story!.seed}:${roleId}:setting-anchor`), others);
    if (!at) throw new Error(`No valid ${roleId} anchor in ${room.id}`);
    person.initial = { spaceId: room.id, at: { ...at } };
    person.reported = { spaceId: room.id, at: { ...at } };
    const fact = s.facts.find(f => f.id === person.locationFactId)!;
    fact.spaceId = room.id;
    if (fact.person) fact.person = { ...fact.person, at: { ...at }, reportedAt: { ...at } };
  }
}

export function settingModuleOf(s: ScenarioDefinition): SettingModule | null {
  const modules = s.incident ? settingModulesFor(s.incident) : null;
  const id = s.story?.episode?.modules.find(name => name.startsWith(SETTING_MODULE_MARK))?.slice(SETTING_MODULE_MARK.length);
  return modules?.find(module => module.id === id) ?? null;
}

/** Pairs every string slot of the source module with the same slot of the target module.
 * Arrays (briefing details) are added, not substituted, so they are skipped here. */
export function proseReplacements(source: unknown, target: unknown, tokens: Readonly<Record<string, string>>, out: Record<string, string> = {}): Record<string, string> {
  if (typeof source === 'string' && typeof target === 'string') {
    const bound = bindSettingTemplate(target, tokens);
    if (bound !== source) out[source] = bound;
  } else if (source && target && typeof source === 'object' && typeof target === 'object' && !Array.isArray(source)) {
    for (const key of Object.keys(source)) proseReplacements((source as Record<string, unknown>)[key], (target as Record<string, unknown>)[key], tokens, out);
  }
  return out;
}

/** Template tokens from the built location and the module's bound rooms. */
export function settingTokens(s: ScenarioDefinition, built: BuiltLocation, module: SettingModule): Record<string, string> {
  const people = s.story!.bindings.people;
  const room = (id: string) => built.location.rooms.find(r => r.id === id)!;
  const tokens: Record<string, string> = { place: built.location.name, room: roomPhraseV10(room(s.story!.bindings.rooms.scene.spaceId)) };
  for (const [roleId, role] of Object.entries(module.roles)) if (roleId !== module.scene && people[role.personId])
    tokens[`${roleId}Room`] = roomPhraseV10(room(people[role.personId].initial.spaceId));
  return tokens;
}

/** Rebinds the source module's setting lines to the chosen module's, and adds its
 * briefing details. Exact substrings, not words: slots are whole authored sentences that
 * end in punctuation. A source-module story is returned unchanged. */
export function withSettingTextV11(input: ScenarioDefinition, built: BuiltLocation): ScenarioDefinition {
  const module = settingModuleOf(input);
  const source = input.incident && FRAMEWORKS[input.incident.type]?.source;
  if (!module || !source || module === source) return input;
  const tokens = settingTokens(input, built, module);
  const replacements = proseReplacements(source.prose, module.prose, tokens);
  const keys = Object.keys(replacements).sort((a, b) => b.length - a.length);
  const pattern = new RegExp(keys.map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  const s = keys.length ? mapScenarioText(input, text => text.replace(pattern, match => replacements[match])) : structuredClone(input);
  const details = (module.prose as { briefing?: { details?: readonly string[] } }).briefing?.details ?? [];
  s.briefing.known = [...new Set([...s.briefing.known, ...details.map(line => bindSettingTemplate(line, tokens))])];
  return s;
}
