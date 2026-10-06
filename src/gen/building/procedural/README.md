# Procedural building generator

`generatePair(familyId, seed)` returns a validated `LocationDefinition` (`plain`) and the same plan
after the generated-building furniture solver, `furnishLocationG1` (`furnished`, `../furnishing-g1.ts`); `generateBuilding` returns the
plain one. Same `(familyId, seed)` gives a deep-equal building. Randomness is `src/sim/rng.ts` only,
seeded from `hashSeed(`${familyId}:${seed}`)`; each draw that fails a stage is dropped and the next one
is taken from the same stream (40 draws), then the family's known-good `fallbackSeed` stream (120 draws,
since its furnishing hashes the reported seed). A draw is accepted only when the plan passes the
structural `plausibilityReport`, `furnishLocationG1(plan)` passes the full report (a bed in every
bedroom, a toilet in every bath, free floor), `validateFurnishingsG1` (v7's clearance, anchoring and
route checks, plus every door, doorway and stair approach clear and joined, so furniture never cuts a
squad route) and `furnishingShortfallsG1` (each room kind's essentials: no tub in a half bath, seats at
the bar, racking on a warehouse floor), and both forms have zero `validateLocation` issues, warnings
included. The plan itself holds no room furniture: one furniture system, `furnishLocationG1`,
furnishes every building the player sees. It runs v7's solver (`RoomPlan` in `../furnishing-v7.ts`)
with its own catalog (`../furnishing-definitions-g1.ts`); authored buildings keep `furnishLocationV7`.

The game reaches these generators as public building types `<family>_<generation>` and their
furnished forms `<family>_<generation>__furnished_v7`: nine `_g1` types (`PROCEDURAL_FAMILIES` in
`../index.ts`) and nine `_g2` types (`PROCEDURAL_FAMILIES_G2`). `generatePair` reads the generation
from the id (`generation.ts`; a bare spec id means `_g1`).

## Generations

| | `_g1` | `_g2` |
| --- | --- | --- |
| Draw stream | ``hashSeed(`${family}:${seed}`)`` | the same stream |
| Distance math in the shared helpers | `Math.hypot` (no `geometry` field) | `geometry: 'exact'`: `Math.sqrt(dx*dx + dy*dy)` (`src/sim/geometry.ts`) |
| Location `version` (plain form) | 1 | 2 |
| `access` | none | `apartment_unit_g2`: unit floor, elevator, step-free route, note |
| Fingerprints | `../procedural-g1-fingerprints.json` | `../procedural-g2-fingerprints.json` |

`_g2` sets `geometry: 'exact'` on the drawn plan before acceptance (`generate.ts` `finishPlan`), so
`deriveLocation`, `validateLocation`, `furnishLocationG1` (v7's `RoomPlan`), `validateFurnishingsG1`
and the furnished squad router all measure that building with exact arithmetic, and the furnished form
inherits the field. Furnishing choices hash the public id, so a `_g2` seed often accepts a different
draw from the stream than `_g1` did; treat `_g2` as its own content, not a re-measured `_g1`.

**Access (`access.ts`).** A family with `unitLevel` (only `apartment_unit`; it is the one type with a
shared stair and corridor) gets `access` from `_g2` on. The unit's floor comes from its name ('Unit 3B'
is on the third floor, level 2). One draw from its own stream, ``Rand(`${family}:access:${seed}`)``,
decides the elevator (35/40/55/75% by level 0-3). Ground-floor units are step-free; upper units only
with an elevator. Players see `access.note` ('Third-floor unit; the building has an elevator') as map
note `n_access` on the common corridor, and an elevator relabels the stairwell zone 'Stairs and
elevator' and tags it `lift`.

## Frozen output: a released generation never changes

Issued incidents and saves rebuild a building from `(familyId, seed)` alone, so the output of a
released generation is part of the save format. `../procedural-g1-fingerprints.json` and
`../procedural-g2-fingerprints.json` hold SHA-256 fingerprints of `generateBuilding` for each type,
plain and furnished (seeds 0, 1, 7, 42, 1000, 4294967295), and the matching `.test.ts` files check
them. Any change that alters these outputs, in this directory, in `furnishing-g1.ts`,
`furnishing-definitions-g1.ts`, `furnishing-v7.ts`, or in the validators and geometry they call,
must ship as a new generation alongside the old ones. Never re-baseline a released generation.

**The `_g3` rule.** To change generated output:
1. Add `'g3'` to `Generation` and `GENERATIONS` in `generation.ts`, and its `PLAN_VERSION` in `generate.ts`.
2. Gate every behavior change on the generation (`finishPlan`, a `FamilySpec` hook, or a field on the
   location such as `geometry`), so `_g1` and `_g2` take exactly today's code path. A shared helper
   in `src/sim` changes only behind a location field that older locations do not carry.
3. Export `PROCEDURAL_FAMILIES_G3` from `../index.ts`, add it to `ALL_BUILDING_FAMILIES`, and add
   `../procedural-g3-fingerprints.json` with its test (same seeds), captured under Node.
4. Run the `_g1` and `_g2` fingerprint tests, the issued-incident suites and
   `bun scripts/cross-engine-fingerprints.ts`; add the new JSON to that script.
5. Only a new content version may draw the new types; issued versions keep their lists.

## Engine-independent arithmetic

The same `(familyId, seed)` must give the same building on every browser. ECMAScript lets engines
approximate `Math.exp`, `log`, `pow`, `hypot`, the trig functions and `**` (ECMA-262 §21.3.2), so the
generator uses none of them; `Math.sqrt` is correctly rounded (§21.3.2.33) and is used through
`geom.ts` `norm`. Annealing in `fill.ts` uses a rational stand-in for `exp`, and no sort comparator
draws random numbers (engines compare in different orders). `../procedural-math.test.ts` greps this
directory and fails on any approximated call outside comments.

The shared helpers the generator calls (`src/sim/location.ts`, `furniture-path.ts`,
`location-validate.ts`, `spatial-factors.ts` routing, `../furnishing-v7.ts`) still use `Math.hypot`
for `_g1` and authored locations, whose outputs are frozen; `_g2` locations take the exact path.
`../exact-geometry.test.ts` spies on every approximated `Math` function while a `_g2` building of each
type is generated, validated, furnished and routed, and requires zero calls.
`scripts/cross-engine-fingerprints.ts` recomputes the building and incident fingerprint suites under
Bun (JavaScriptCore) and compares them with the JSON captured under Node (CI: `cross-engine.yml`).

Families: `bungalow`, `two_storey_house`, `semi_detached`, `apartment_unit`, `corner_store_flat`,
`small_office`, `bar_restaurant`, `warehouse`, `motel_row` (see `families/*.ts`, one `FamilySpec` each).

## Pipeline

`footprint.ts` (shapes) → `strips.ts` / `partition.ts` / `fill.ts` (hall strip, pieces, room assignment and
slicing; `families/twofloor.ts` adds the aligned stair) → `assemble.ts` (ids, outlines, chamfer) →
`openings.ts` (exterior doors, one spanning tree per floor + loops, interior doors; `units.ts` separate units) → `zones.ts` + `windows.ts` + `exterior.ts` (yards,
paths, fences, yard objects, notes, entries) → `generate.ts` (`furnishLocationG1`, `plausibility.ts`,
`validateFurnishingsG1`, `furnishingShortfallsG1`, `validateLocation`; retry, fall back). `programme.ts` holds the room seeds, `types.ts` the family contract.

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
`st_stair_0_stair_1`, `w_<room>_<n>` windows, `p_<zoneA>_<zoneB>` yard paths. Yard objects: `o_fence_<n>`, `o_shrub<n>`, `o_tree<n>`, `o_steps`, `o_patio_table<n>`, `o_planter<n>`; room furniture is `furnishLocationG1`'s (`g1_<room>_<catalog key>_<n>`, e.g. `g1_floor_pallet_rack_2`; the prefix names the catalog, so `_g2` buildings use it too). Notes: `n_access` (`_g2` apartments).
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
| Derived from furniture (`furnishLocationG1`'s pieces, added to both forms) | `valuables` `hazard` `concealment` `cover` |

`upstairs` is on every floor-1 room (and `ground` on floor-0 rooms of two-floor buildings). `lockable` rooms
have doors that can hold a barricade. `junction` is a hall with three or more openings; `open` a room
joined by a cased opening; `interior` a room with no outside wall.

Zone tags: `street` `exposed` `cover` `fence` `alley` `vehicles` `neighbor` `party_wall` `no_entry` `corridor`
`common` `stairwell` `balcony` `loading_bay` `walkway` `patio`, and from `_g2` `lift` (a stairwell with an elevator).
Object tags: `blocks_space` `blocks_sight` `concealment` `cover` `valuables` `hazard` `storage` `appliance`
`boiler` `safe` `server` `shower` `bar` `equipment`. Objects whose tags are non-empty are `mechanical`.
No `car`, `bin` or `gate` object type exists in `ObjectType`, so cars and bins appear as map notes
(`Parked cars`, `Trash cans`, `Side gate`) and as `cover` / `vehicles` zone tags.

## Rules the generator keeps

- Every room is reachable from an entry without passing through a bedroom or bathroom (an ensuite is reached
  from its bedroom); baths and WCs never open off a kitchen or dining room; bedrooms and living rooms have a window.
- Indoors first: on each floor every room is reachable from the front-door room (behind `d_front`; upstairs,
  the stair head) through interior openings alone. The outside is never a route. `openings.ts` grows one
  spanning tree per floor from that root; back and side doors open into rooms the tree already reaches.
  The only exception is a separate unit with its own street door, declared per family in `units.ts`
  (motel guest rooms; the corner store's upstairs apartment with its street-door hall). `plausibility.ts`
  `indoorOrphans` FAILs any draw that breaks this, and `../procedural-connectivity.test.ts` checks it
  independently over 200 seeds per type, together with the game's router from every entry zone.
- Loops: after the tree, `loopsMin`..`loops` extra doors between rooms people walk through (never stairs,
  ensuites, two halls, or two leaf rooms); leaf rooms take a second door only when the family lists them in
  `throughOk` (a utility between kitchen and hall, a meeting room off corridor and open office, a break
  room onto the warehouse floor). A loop door that does not fit is dropped. Plans with 6+ rooms have a loop
  in 46-59% of draws (authored families 37-62%); the connectivity test holds every type to 40-75%.
- Exterior zones are walkable for the furnished squad router, which keeps 1 ft off zone edges and objects:
  fences sit on the lot line, yard objects are islands 3 ft clear of zone edges and of each other, a porch,
  step or loading bay leaves 3 ft of yard beyond and beside it or takes the strip, a 1 ft sliver beside a
  stepped wing joins the side yard, the apron in front of parking is 5 ft deep, a chamfer leg is at least
  4.5 ft, and an entry zone always faces the building through a door or window (it needs a staging point).
  `../procedural-routing.test.ts` routes every entry zone to every room on the furnished form, 50 seeds.
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
# per public type (g1 and g2): validity, topologies, loop share, average and p95 ms per building, and
# squad reachability on the furnished form (BUILDING_QUALITY_REACH=0 skips the routing)
BUILDING_QUALITY=200 npx vitest run src/gen/building/procedural-quality.dev.test.ts --silent=false
# fingerprint suites on JavaScriptCore against the JSON captured under V8
bun scripts/cross-engine-fingerprints.ts
```

