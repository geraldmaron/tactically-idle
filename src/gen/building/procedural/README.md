# Procedural building generator

`generatePair(familyId, seed)` returns a validated `LocationDefinition` (`plain`) and the same plan
after the game's furniture solver, `furnishLocationV7` (`furnished`); `generateBuilding` returns the
plain one. Same `(familyId, seed)` gives a deep-equal building. Randomness is `src/sim/rng.ts` only,
seeded from `hashSeed(`${familyId}:${seed}`)`; each draw that fails a stage is dropped and the next one
is taken from the same stream (40 draws), then the family's known-good `fallbackSeed` stream (120 draws,
since its furnishing hashes the reported seed). A draw is accepted only when the plan passes the
structural `plausibilityReport`, `furnishLocationV7(plan)` passes the full report (a bed in every
bedroom, a toilet in every bath, free floor) and `validateFurnishingsV7`, and both forms have zero
`validateLocation` issues, warnings included. The plan itself holds no room furniture: one furniture
system, `furnishLocationV7`, furnishes every building the player sees.

The game reaches these generators as nine public building types, `<family>_g1`
(`PROCEDURAL_FAMILIES` in `../index.ts`), and their furnished forms `<family>_g1__furnished_v7`.

## Frozen output: `_g1` never changes after release

Issued incidents and saves rebuild a building from `(familyId, seed)` alone, so the output of a
released generation is part of the save format. `../procedural-g1-fingerprints.json` holds SHA-256
fingerprints of `generateBuilding` for each `_g1` type, plain and furnished, and
`../procedural-g1-fingerprints.test.ts` checks them. Any change that alters these outputs, in this
directory, in `furnishing-v7.ts`, or in the validators and geometry they call, must ship as new `_g2`
types alongside `_g1` (bump `GENERATION` for the new types and keep the old code path for `_g1`).
Never re-baseline the `_g1` fingerprints after release.

## Engine-independent arithmetic

The same `(familyId, seed)` must give the same building on every browser. ECMAScript lets engines
approximate `Math.exp`, `log`, `pow`, `hypot`, the trig functions and `**` (ECMA-262 §21.3.2), so the
generator uses none of them; `Math.sqrt` is correctly rounded (§21.3.2.33) and is used through
`geom.ts` `norm`. Annealing in `fill.ts` uses a rational stand-in for `exp`, and no sort comparator
draws random numbers (engines compare in different orders). `../procedural-math.test.ts` greps this
directory and fails on any approximated call outside comments.

Families: `bungalow`, `two_storey_house`, `semi_detached`, `apartment_unit`, `corner_store_flat`,
`small_office`, `bar_restaurant`, `warehouse`, `motel_row` (see `families/*.ts`, one `FamilySpec` each).

## Pipeline

`footprint.ts` (shapes) → `strips.ts` / `partition.ts` / `fill.ts` (hall strip, pieces, room assignment and
slicing; `families/twofloor.ts` adds the aligned stair) → `assemble.ts` (ids, outlines, chamfer) →
`openings.ts` (spanning tree + loops, doors, exterior doors) → `zones.ts` + `windows.ts` + `exterior.ts` (yards,
paths, fences, yard objects, notes, entries) → `generate.ts` (`furnishLocationV7`, `plausibility.ts`,
`validateFurnishingsV7`, `validateLocation`; retry, fall back). `programme.ts` holds the room seeds, `types.ts` the family contract.

Conventions match Maple Street: feet, y down, street at the south, lot `bounds`, wall-centerline room
polygons (clockwise), zones that tile the lot around the building, zone-to-zone `doorway` paths, doors with
`swing` and `material`, windows with `glazing` and `covering`. Floor-1 openings carry `floor: 1`; a `stair`
opening joins `stair_0` (foot) to `stair_1` (head) with `floor: 0`.

## Ids

Rooms are `<key>` or `<key>_<n>` (largest first): `living`, `kitchen`, `hall`, `landing`, `stair_0`, `stair_1`,
`bedroom_1..`, `bath_1..` (an ensuite is a `bath_n` tagged `ensuite`), `wc_1..`, `storage_1..`, `office_1..`
(home study), `utility`, `dining`, `shop`, `stockroom`, `backoffice`, `reception`, `open_office`, `meeting_1..`,
`manager_1..`, `kitchenette`, `server`, `corridor`, `bar`, `cold_store`, `break_room`, `locker_room`, `floor`
(warehouse), `mezz_office_1..`, `unit_1..` (motel rooms). Openings: `d_<a>_<b>` door, `dw_<a>_<b>` cased
opening, `d_front` / `d_back` / `d_side` / `d_flat` / `d_dock` / `d_balcony` / `d_<unit>` exterior doors,
`st_stair_0_stair_1`, `w_<room>_<n>` windows, `p_<zoneA>_<zoneB>` yard paths. Yard objects: `o_fence_<n>`, `o_shrub<n>`, `o_tree<n>`, `o_steps`, `o_patio_table<n>`, `o_planter<n>`; room furniture is `furnishLocationV7`'s (`v7_<room>_<type>_<n>`).
Zones: `front_yard`, `back_yard`, `side_yard_w/e`, `porch`, `back_step`, `driveway`, `street`, `side_street`,
`alley`, `forecourt`, `parking`, `patio`, `walkway`, `loading_bay`, `corridor`, `stairwell`, `balcony`,
`neighbor_w/e` (a party-wall neighbor; no path, no entry).

## Tag vocabulary (`tags.ts`; a test holds every emitted tag to it)

Room tags, by what they say:

| Kind | Tags |
| --- | --- |
| Use | `sleeping` `living` `dining` `cooking` `water` `wc` `work` `office` `meeting` `reception` `shop` `bar` `storage` `stock` `utility` `laundry` `server` `cold` `guest` `ensuite` `warehouse` `stairs` `circulation` |
| Privacy | `public` `private` `service` `staff` `customer` `residential` `lockable` |
| Position | `narrow` `junction` `open` `interior` `windowless` `street_facing` `rear_facing` `chamfer` `ground` `upstairs` `exterior_door` `high_capacity` |
| Derived from furniture (`furnishLocationV7`'s pieces, added to both forms) | `valuables` `hazard` `concealment` `cover` |

`upstairs` is on every floor-1 room (and `ground` on floor-0 rooms of two-floor buildings). `lockable` rooms
have doors that can hold a barricade. `junction` is a hall with three or more openings; `open` a room
joined by a cased opening; `interior` a room with no outside wall.

Zone tags: `street` `exposed` `cover` `fence` `alley` `vehicles` `neighbor` `party_wall` `no_entry` `corridor`
`common` `stairwell` `balcony` `loading_bay` `walkway` `patio`.
Object tags: `blocks_space` `blocks_sight` `concealment` `cover` `valuables` `hazard` `storage` `appliance`
`boiler` `safe` `server` `shower` `bar` `equipment`. Objects whose tags are non-empty are `mechanical`.
No `car`, `bin` or `gate` object type exists in `ObjectType`, so cars and bins appear as map notes
(`Parked cars`, `Trash cans`, `Side gate`) and as `cover` / `vehicles` zone tags.

## Rules the generator keeps

- Every room is reachable from an entry without passing through a bedroom or bathroom (an ensuite is reached
  from its bedroom); baths and WCs never open off a kitchen or dining room; bedrooms and living rooms have a window.
- Rooms: shorter side at least 6 ft (WC 4.5, hall and landing 3.5), aspect at most 3 (halls, stairs and
  corridors exempt), halls 3.5 to 5 ft wide in homes. Doors 2.5 ft inside, 3 ft outside, away from corners,
  swings clear of each other and of furniture.
- Player-visible text (labels, names, notes, blurbs) is American English; `../procedural-american.test.ts`
  checks 50 seeds of every type. 1 to 3 exterior doors (docks and motel rooms add more).
- No more than 2 floors; floor 1 is inside the ground footprint; stair rooms share one rectangle.

## Developer tools (skipped unless their environment variable is set)

```sh
# contact sheet, then rsvg-convert it to a PNG
BUILDING_SVG=/tmp/sheets BUILDING_FAMILY=corner_store_flat BUILDING_SEEDS=0-5 BUILDING_COLS=3 \
  npx vitest run src/gen/building/procedural/render.dev.test.ts -u
# acceptance rates and rejection reasons per family
BUILDING_STATS=bungalow BUILDING_N=200 npx vitest run src/gen/building/procedural/stats.dev.test.ts --silent=false
# distinctness, floors, shapes, plausibility scores
BUILDING_SUMMARY=all BUILDING_N=500 npx vitest run src/gen/building/procedural/summary.dev.test.ts --silent=false
# per public type: validity, distinct room topologies, average and p95 ms per building
BUILDING_QUALITY=200 npx vitest run src/gen/building/procedural-quality.dev.test.ts --silent=false
```

