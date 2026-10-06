# Procedural locations (content v10)

**Status:** 2026-10-06. Delivers the building and placement half of [phase3-generation.md](phase3-generation.md), which `main` had only shipped as six authored layouts with small parametric variation.

## Why

The Phase 3 owner intent is that buildings and placements vary between games ("Buildings vary… People sit in different rooms, and their placements shift between runs"). Measured over 200 seeds, the six authored families produced one or two room topologies each, with fixed room counts and entrances. The procedural generator written for Phase 3 was never committed; this release revives it.

| Measure (200 seeds per type) | Authored families | Generated `_g1` types |
| --- | --- | --- |
| Distinct room topologies | 1–2 | 47–189 |
| Rooms | fixed | variable (e.g. 10–17 in two-story houses) |
| Entrances | fixed | 1–3 |
| Floors | 1 | 1 or 2 |
| Plans with an interior loop (6+ rooms) | 37–62% (where present) | 46–59% |

## What shipped

1. **Nine generated building types**, `src/gen/building/procedural/`: bungalow, two-story house, duplex, apartment, corner store with apartment, small office, bar or restaurant, warehouse and motel row. Public IDs carry a generation suffix (`bungalow_g1`). Pipeline: footprint → partition → one indoor spanning tree per floor plus loops → yards, windows and exterior → furnishing → plausibility and validation, with a bounded retry and a known-good fallback.
2. **One furnishing solver.** `furnishLocationG1` (`src/gen/building/furnishing-g1.ts`) runs the v7 solver with a catalog for every generated room kind: racking rows, bar tables and stools, office desks, motel units, toilets without tubs in WCs. The v7 catalog and every authored output are unchanged.
3. **Content v10.** `INCIDENT_CONTENT_VERSION = 10`. `src/content/scenario-types-v10.ts` lists which generated types each framework can use. The situation (variant and pacing) depends on the call seed only. A call drawn to a generated building is resolved lazily when its definition is first needed: further seeds of that type from a hash stream, then the framework's authored buildings. The incident ID stays as drawn, so board draws and saves are unchanged, and maps read `locationFamilyId`/`locationSeed`.
4. **Role-based placement** (`src/gen/incident/placement-v10.ts`). The eight compiled frameworks choose start rooms by room use across all floors, with a squad route required. Some first reports name a plausible wrong room, which the check corrects.
5. **Authored stories on generated buildings** (`src/gen/incident/stories-v6/hosts-v10.ts`). Family-identity checks became requirements on the real building: a register for the armed story, a ground-floor chair route for the rescue, an arrival entry that can hold people. Building names in prose come from the location.
6. **UI.** The library picks a building (fixed or generated) and a situation. Cards show floor counts, briefings name upper-floor rooms, and floor tabs work at 320 px.
7. **Tooling.** `npm run capture:locations` renders contact sheets of any family with the real blueprint component (`locations.html`). The review is in [procedural-locations-review.md](procedural-locations-review.md).

## Controls

- **Frozen issued content.** v9 is now fingerprinted (`issued-v9.test.ts`, 200 definitions), alongside the v4, v6–v8 and legacy suites. v10 changes are gated on `contentVersion >= 10`.
- **Generated buildings are content too.** `procedural-g1-fingerprints.json` pins 108 plain and furnished buildings. Any change to `_g1` output ships as `_g2` types; never re-baseline `_g1` after release.
- **Engine-independent math.** The generator uses arithmetic and the correctly rounded `Math.sqrt` only; a test bans the approximated functions there. JavaScriptCore reproduced all V8 fingerprints.
- **Playability gates.** Every room of every generated type is reachable by squads from every entry on the furnished map, and every story person's start room is reachable, judged by the game's own router (`v10-locations.test.ts`). Indoor connectivity is a plausibility failure. Furnishing must meet per-room kit minimums.
- **Real journeys.** `npm run test:e2e` plays 56 browser journeys, 28 of them on all nine generated types (12 with an upper floor), at 320 and 390 px.

## Residual risks

- The shared engine (`src/sim/location.ts`, `furniture-path.ts`, `location-validate.ts`, `furnishing-v7.ts`) still uses `Math.hypot`, which engines may approximate differently. This predates v10 and affects authored content too; changing it would alter shipped definitions.
- Yard walkability is guaranteed by structural rules and by the tested seeds, not by routing every draw.
- Plausibility review is by inspection of contact sheets, not by players.

## Follow-ups

- The armed-incident story needs text for offices, warehouses and motels (it is written around counting tills).
- Wheelchair rescue in generated apartments needs floor level and lift access modelled.
- Time of day is fixed per framework, so night-weighted placement rarely applies.
- Bar restrooms are sometimes reached through the kitchen corridor. The corner store's separate apartment door is often missing.
- Medical-care fallback starts the receiving crew from the first entry rather than the story's arrival.
- Long footprints (motels, warehouses) render small at 320 px until zoomed.
