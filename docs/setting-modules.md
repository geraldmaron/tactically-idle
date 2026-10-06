# Setting modules (content v11)

**Status:** 2026-10-06. Implements §2.1 of [scenario-scale-plan.md](scenario-scale-plan.md). First user: the armed-incident story ("After the Noise").

## What a setting module is

A framework's decision graph (stages, actions, facts, endings) is authored once. A **setting module** says, for one class of building, who the people are, which real rooms they're in, what they're doing, and the lines of prose that change with that. It never adds actions, flags or endings. If a setting needs a different decision, that's a new situation or framework, not a module.

Modules are typed data in `src/content/`. The framework's compiler reads them; agents and authors add modules without adding code paths.

```
SettingModule<Prose> {
  id, framework,                 // e.g. 'armed_office_late_worker', 'active_armed_incident'
  settings: SettingKind[],       // 'retail' | 'office' | 'warehouse' | 'motel' | 'home'
  requires: { setting?, rooms?: SettingRoomSelector[], minFloors? },
  scene: roleId,                 // whose room is the story's scene room (routes, reach actions)
  roles: { [roleId]: { personId, label, rooms: SettingRoomSelector[] | 'scene' } },
  prose: Prose,                  // framework-shaped, e.g. ArmedIncidentProse
}
SettingRoomSelector { types?, tags?, objects?: { type?, tags? }[], floors? }
```

Files:

| File | Holds |
| --- | --- |
| `src/content/setting-modules.ts` | Types, `locationSettings`, `resolveSettingModule`, `selectSettingModule`, `bindSettingTemplate` |
| `src/content/setting-modules-armed.ts` | `ArmedIncidentProse` and the four armed modules |
| `src/gen/incident/stories-v6/setting-modules-v11.ts` | The compiler: room placement and prose rebinding, gated on `contentVersion >= 11` |

## How a building gets a module

1. **Settings come from rooms, not family IDs.** `locationSettings` reads the built location: a `retail`-type room makes it retail, a `meeting` room office, a `warehouse` room warehouse, `guest` units motel, a non-business setting home. A new building type joins a module by having the right rooms.
2. **Roles resolve on the real building.** The scene role's affinity list gives candidate rooms reachable from the story's arrival; the seed picks one. Other roles pick from their own lists, excluding rooms already taken, or share the scene room (`'scene'`). If another role has nowhere to stand, the next scene candidate is tried.
3. **One module wins.** Every module whose settings the building has and whose requirements and roles resolve is a candidate; a seeded, ID-ordered tie-break picks one.
4. **No fit, no story here.** The episode throws, and v10 hosting moves to another building seed, then to the framework's authored buildings.

## How the compiler applies it

- **Placement (v6 episode binding).** The scene room replaces the story's room selector. After the story binder runs, each non-scene role's person moves to its room: a fresh anchor, report and location fact. Routes, flags and the decision graph don't change. Actions that follow a person (the firearm and medical actions on Grant) already track that person's real position.
- **Mark.** `setting:<module id>` is added to `story.episode.modules`, so later layers and the casebook read the choice from the definition.
- **Prose (last authored layer, before the v10 location rebinding and the v9 cast).** Each framework names a **source module**: the story as authored, whose prose is the exact text the layers emit. Every string slot of the source is replaced by the same slot of the chosen module, as an exact substring. `briefing.details` lines are added to the known briefing. A source-module story is returned unchanged, which is why v11 retail plays exactly like v10.
- **Tokens.** `{place}` is the location name, `{room}` the scene room's real label in sentence case, and `{<role>Room}` any other role's room. Names stay as the framework's authored cast names (Eli, Grant); the cast binder renames them afterwards. An unknown token throws.

## Armed-incident modules

| Module | Building class | Eli | Grant | What the player weighs |
| --- | --- | --- | --- | --- |
| `armed_retail_till_count` (source) | retail (corner store, bar, Market Row) | Shop worker at the register, counting the tills | Same room | As authored |
| `armed_office_late_worker` | office | Late worker who locked himself in a meeting room or private office | Open office or reception | A locked door he'll open when the team calls his name; Grant in another room |
| `armed_warehouse_night_picker` | warehouse | Night-shift picker among the racking on the warehouse floor | Same floor | Racking gives cover and blocks sightlines between them |
| `armed_motel_night_clerk` | motel | Night clerk in the back office, front office, laundry or linen closet | Front office or breakfast room | Guests stay in their units; Grant in a public room |

Hosting over 50 building seeds at the drawn seed (v11): small office 50/50, warehouse 50/50, motel 50/50, corner store 50/50, bar 50/50.

## Writing a new module

1. **Pick the framework's prose interface** (for example `ArmedIncidentProse`). Fill every field. TypeScript enforces completeness.
2. **Declare roles against real room uses and tags.** Check them against `npm run capture:locations` contact sheets or a quick room dump. Give the scene role a room that holds what the prose claims (racking, a lockable door).
3. **Follow the prose rules.**
   - American English and in-world voice.
   - No real procedures or weapons detail, and nothing graphic.
   - No invented arrests, recoveries or outcomes.
   - No meta-disclaimers ("no X is claimed").
   - Labels never reveal a hidden truth.
   - Claims about the building must hold on every building the module accepts. Don't say "between Eli and the exit" unless the selector guarantees it.
4. **Add the gates** to `setting-modules-v11.test.ts`:
   - Selection per building type.
   - Every bound line present, with no source-setting wording left.
   - Squad reachability of every role from the arrival.
   - A dispatch journey with save and reload to debrief.
   - Hosting at 30% or more before the building type is listed in `GENERATED_FAMILIES_V11`.
5. **Freeze.** Once a content version ships, its modules are issued content. Change a module by adding a new one in the next version, never by editing it.

## Adding modules to another framework

Give the framework a prose interface and a source module whose prose is its authored text verbatim. Register `{ source, modules }` in `FRAMEWORKS` in `setting-modules-v11.ts`. If the story binder hard-requires a setting-specific object (the armed story's register), gate that requirement on `contentVersion < 11`, as `stories-v5/archetypes.ts` does.
