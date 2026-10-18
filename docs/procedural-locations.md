# Procedural locations

**Status:** generated buildings and placements are part of the current v13 content pipeline. Work still to do lives only in [docs/backlog.md](backlog.md).

## Why

The Phase 3 owner intent is that buildings and placements vary between games ("Buildings vary… People sit in different rooms, and their placements shift between runs"). Measured over 200 seeds, the six authored families produced one or two room topologies each, with fixed room counts and entrances. Procedural generation supplies varied topologies and placements in the current game. The table records the original comparison with authored families.

| Measure (200 seeds per type) | Authored families | Generated types (historical sample) |
| --- | --- | --- |
| Distinct room topologies | 1–2 | 47–189 |
| Rooms | fixed | variable (e.g. 10–17 in two-story houses) |
| Entrances | fixed | 1–3 |
| Floors | 1 | 1 or 2 |
| Plans with an interior loop (6+ rooms) | 37–62% (where present) | 46–59% |

## What shipped

1. **Nine generated building types**, `src/gen/building/procedural/`: bungalow, two-story house, duplex, apartment, corner store with apartment, small office, bar or restaurant, warehouse and motel row. Public IDs carry a generation suffix (`bungalow_g2`). Pipeline: footprint → partition → one indoor spanning tree per floor plus loops → yards, windows and exterior → furnishing → plausibility and validation, with a bounded retry and a known-good fallback.
2. **One furnishing solver.** `furnishLocationG1` (`src/gen/building/furnishing-g1.ts`) runs the shared furnishing solver with a catalog for every generated room kind: racking rows, bar tables and stools, office desks, motel units, toilets without tubs in WCs. Current furnishing data lives in `src/gen/building/furnishing-definitions.ts`.
3. **Current catalog.** `src/content/scenario-types.ts` lists the supported building types for current calls.
4. **Instance placement.** `src/gen/incident/instance.ts` draws people and delegates role placement to `src/gen/incident/trees-v13/compile.ts`; templates live in `src/content/incidents/`.
5. **Building requirements.** Current call trees declare the geometry and routes their scene needs; building claims must hold on every accepted layout.
6. **UI.** The library picks a building (fixed or generated) and a situation. Cards show floor counts, briefings name upper-floor rooms, and floor tabs work at 320 px.
7. **Tooling.** `npm run capture:locations` renders contact sheets of any family with the real blueprint component (`locations.html`).

## Controls

- **One current content version.** Buildings and calls change together. Compiled fingerprints are regression tripwires, deliberately recaptured when current content changes. Old versions are not frozen or migrated.
- **Seeded geometry.** Generation and furnishing share stable seeds, bounded retries and a known-valid fallback.
- **Engine-independent generator math.** `src/gen/building/procedural-math.test.ts` rejects approximated math functions in the generator.
- **Playability gates.** `src/gen/building/procedural-connectivity.test.ts` checks furnished-map reachability using the game's router. Structural validation and furnishing rules check connectivity, openings and usable rooms.

## Residual risks

- The shared engine (`src/sim/location.ts`, `furniture-path.ts`, `location-validate.ts`, `furnishing-v7.ts`) still uses `Math.hypot`, which engines may approximate differently. This also affects authored content; fingerprints detect changes to current definitions.
- Yard walkability is guaranteed by structural rules and by the tested seeds, not by routing every draw.
- Plausibility review is by inspection of contact sheets, not by players.

## Work tracking

Small-screen rooms and long footprints are tracked in the [backlog](backlog.md#player-experience). Remaining work is listed only there.

Furniture stays inside usable room polygons, clears openings and other furniture, preserves required interior routes and derives variation from stable seeds rather than rendering randomness.

Generate and validate seeded data before rendering it, use bounded retries and a known-valid fallback, and keep threat effects abstract, grounded and non-graphic.
