# Phase 2: spatial, material, equipment and career simulation

**Status:** Implementation brief, 2026-10-02. Extends [operation-model.md](operation-model.md). All numbers are proposed tuning values, kept in named constants.

## Why

Owner feedback on the first playable:

1. A kitchen marker reading "NEIGHBOUR?" named the report's source, not its claim. The room sheet then said nothing could be done.
2. Placement of people and things inside rooms should matter, along with distance from doors and windows, materials, and equipment range.
3. Equipment should wear per unit, at different rates.
4. Officers need ages and experience, and those should drive retirement.
5. The app needs more icons.

## Rules every module follows

- **One source of truth.** Geometry, materials and positions come from `LocationDefinition` plus scenario content. The renderer, eligibility and resolution all read the same records.
- **Every variable that matters shows up as a `Contributor`.** It needs a player-language label and, where spatial, a `MapOverlay`. A variable with no contributor has no effect. Decorative data stays decorative.
- **Vary one input, change one output.** Changing a single input (door material, staging point, occupant position, unit condition, officer age) must change a named contributor in the expected direction and leave unrelated contributors alone. Each gets a test.
- **Abstract, not tactical instruction.** Effects are game abstractions: audibility, observation quality, time, coordination, strain. There is no ballistic model and no real-world procedure.

## 1. Facts, claims and markers (bug fix)

- A reported fact's map marker states the **claim** in one or two words ("MOVEMENT?", "PATIENT?"). The **source** goes in `marker.subtext` ("per neighbour").
- The room sheet lists `SpaceView.facts`, each with:
  - the claim sentence;
  - the source;
  - a note on why it matters;
  - `verifyActions`, including actions in later stages, with `availableNow` and their stage.
- Never say "nothing you can do" when a fact in the room can be verified later. Say which action settles it and when.
- People appear on the map (`SpaceView.people`) only at the knowledge level the engine holds: reported means an approximate marker with a "?", confirmed means a position. Never draw hidden truth.

## 2. Placement inside rooms

Scenario content places occupants and points of interest at exact `Vec` positions inside rooms. Squads hold `StagingPoint`s, which are derived per opening: just outside or inside a door, doorway or window. Positions feed:

| Variable | Effect (contributor) |
| --- | --- |
| Distance from staging point to target person or point | Air falloff on sound/visual/thermal; throw-phone and hailer **range** checks; travel time |
| Path through openings | Which doors or windows a signal crosses (`bestSignal` with `via`) |
| Blocking objects between them (tags `blocks_sight`, `concealment`) | Visual and thermal blocked, so observation quality drops |
| Distance from the target to the nearest door of its room | Time and exposure for entry-type actions; contact clarity when the person is far from the door |
| Window adjacency (an exterior window on the target room within range) | Enables observation and contact options from outside; covering (blinds, curtains) cuts visual |

## 3. Materials

`src/content/materials.ts` gives each wall material, door leaf, glazing and window covering a transmission value for sound, thermal, radio and visual. Doors also get force-entry minutes, with and without a tool. Effects:

- **Contact:** audibility through the layers between the speaker's staging point and the person. A hollow-core door beats solid-core; a brick wall is poor.
- **Thermal:** reads only along near-clear paths. Glass and masonry block it, and an open door or doorway works best. The imager needs line of sight within its range.
- **Visual:** glazing transmission multiplied by covering.
- **Radio between squads:** attenuation by walls over their separation. Below a threshold, support coordination degrades. That's a contributor, not a hard failure.
- **Entry time:** a locked door costs `forceMinutes` by material, or `forceMinutesWithTool` with a door ram.

## 4. Equipment units and wear

- Every physical item is an `ItemUnit` with:
  - condition from 0 to 100;
  - its own `wearRate` (between 0.8 and 1.25);
  - an age, a use count, a status, and an expiry for consumables.
- **Per use:** `perUse × wearRate`, applied at debrief only to units the decision actually used.
- **Per game day while owned:** `perDay × wearRate`. Battery packs fade fastest. Shields and rams barely age.
- **Consumables** expire after `shelfLifeDays`.
- **Condition sets effectiveness** (`unitEffectiveness`):
  - at or above `unreliableBelow`: full effect;
  - between `failAt` and `unreliableBelow`: a reduced contributor, plus a malfunction risk that is a separate contributor in the same saved sample (no extra roll);
  - at or below `failAt`: cannot deploy until serviced.
- **Servicing** costs `serviceCost` and takes `serviceHours`. It restores condition up to `restoreTo`, never above. Scrapping removes the unit.
- **Forecasting:** the shift report lists units that became unreliable, failed, expired or finished servicing, and the Gear screen shows days until each unit turns unreliable. Nothing degrades mid-operation.

## 5. Game calendar, ages and careers

- `src/sim/calendar.ts`: 1 real hour = 1 game day. It's tunable, and it's what makes careers visible inside an idle game.
- **Officer fields:** `bornDay`, `serviceStartDay`, `career` (operations, favorable, adverse), and an announced `retirement`.
- **Experience bands** (`experienceBand`) shape operations:
  - rookie: a small penalty under pressure, and faster learning from XP;
  - developing: neutral;
  - seasoned: a pressure-resistance bonus;
  - veteran: a larger composure-under-pressure bonus and a mentoring bonus, but slower learning and slightly slower stress recovery past age 50.
- **Age:** recovery rate declines gently after 45.
- **Retirement**, all announced 30 game days ahead and reported:
  - **age:** mandatory at 60;
  - **service:** eligible at 25 years, where the officer decides with a deterministic draw and can be retained once for a raise via `offerRetention`;
  - **burnout:** sustained stress above 70 for 20+ game days, or 3+ adverse operations in their last 5, can trigger early retirement.
- **Anniversaries:** each year of service adds a small wage step. It's reported, and the budget preview includes it.
- **Recruits** have ages and prior service. Experienced recruits cost more and learn slower.

## 6. Icons

Every navigation item, section header, stat, rating, trait, certification, item, development branch, debrief row, status chip, room type and material gets a consistent line icon from `src/ui/icons.tsx`. Pair the icon with text; never use colour alone.
