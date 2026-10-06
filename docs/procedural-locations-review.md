# Procedural locations review (content v10, `_g1` families)

Review date: 2026-10-06. Branch `procgen/contact-sheet`, based on `feat/procedural-locations` at `4eed8de`.
Scope: the nine generated families, seeds 1-24, both floors where present, furnished as the game builds them
(`<family>__furnished_v7`, see `src/gen/incident/index.ts:140`). The six authored families plus Maple Street
were captured the same way for comparison.

## Verdict summary

| Family | Verdict | Main reason |
| --- | --- | --- |
| `bungalow_g1` | hold | 10/24 seeds have a room you can only reach by going outside (kitchen in 8); 9 seeds have a bedroom with no bed |
| `two_storey_house_g1` | hold | 12/24 seeds with outside-only rooms; 30 bedrooms in 18 seeds have no bed (seed 5: all four) |
| `semi_detached_g1` | hold | 10/24 seeds with outside-only rooms (living room sealed in 3); bedless bedrooms in 11 seeds |
| `apartment_unit_g1` | ship with fixes | 6/24 outside-only rooms, 5 bedless seeds; otherwise believable flats |
| `corner_store_flat_g1` | ship with fixes | shop separate from the flat is fine, but the shop's back office/WC often sit on the flat side; shop is nearly empty |
| `small_office_g1` | hold | 10/24 seeds where the open office or reception is outside-only; 6 seeds with WCs and no toilet; open-plan offices hold one desk |
| `bar_restaurant_g1` | hold | 19/24 seeds with outside-only rooms (customer WCs, kitchen, or the bar itself); bar room furnished with 4 objects, no tables; bathtubs in customer WCs |
| `warehouse_g1` | hold | 24/24 seeds: the front office or the warehouse floor is reachable only from outside; the floor is empty (3 shelves) |
| `motel_row_g1` | ship with fixes | separate units are correct for a motel; labels unreadable on the widest rows at map size |
| authored (Maple Street, Cedar Close, Harbour Court, Market Row, Willow Terrace, Ash Grove, Juniper Court) | ship | reference quality; no defects beyond notes below |

Two root causes account for most of the holds. Fixing them is likely to move every residential family to
"ship with fixes"; re-run the capture to confirm.

1. **Rooms joined only through the outside (generator).** `src/gen/building/procedural/build.ts:41` seeds the
   ground-floor spanning tree with every room that has an exterior door (`roots = extDoors.map(d => d.room)`).
   `connectRooms` then grows a forest, so the front-door room and the back-door room are never joined indoors.
   Neither `plausibilityReport` (only checks each room has *an* opening) nor `validateLocation` (checks
   reachability from entry zones, which the outside satisfies) catches it. Bare and furnished plans share
   the defect; furnishing does not touch openings.
2. **v7 furnishing replaces the generator's furniture (furnishing).** `furnishLocationV7` drops every room
   object and re-solves with the solver written for authored homes. `addWall('bed')` fails silently in
   narrow or door-heavy bedrooms, while the wardrobe still lands; the bathroom solver places a tub first in
   every `bathroom`-type room, including WCs; there is no case for bar seating, warehouse racking or
   open-office desks. Measured over seeds 1-24, bare vs furnished:

   | Room | Bare avg objects | Furnished avg objects | Lost |
   | --- | --- | --- | --- |
   | `bar_restaurant_g1` bar and dining | 21.5 (tables, chairs, sofas) | 4.0 (register, counter, 2 shelves) | every table and chair |
   | `warehouse_g1` floor | 14.4 (291 shelves total) | 3.0 | racking |
   | `corner_store_flat_g1` shop | 9.3 | 3.9 | aisle shelving, fridges |
   | `small_office_g1` open office | 8.9 (114 desks total) | 2.3 (28 desks) | desks |
   | `bungalow_g1` living | 6.1 | 3.1 | armchairs, rug |

   The generator guarantees its own plausibility pass, but the furnished output the game uses fails
   `plausibilityReport` hard in 10/24 bungalows, 20/24 two-storey houses and 17/24 semis.

## Method

- Contact sheet: `/locations.html?family=<id>&seeds=1-24&floor=0|1` renders the real `Blueprint` at 360 px
  per plan (about the phone map width) with captions for floors, rooms, entries, exterior doors, interior
  loops, rooms reachable only via outside, validation issues and (generated only) `plausibilityReport`.
- `npm run capture:locations` saved full-page sheets per family and floor, 2x per-cell PNGs, and
  `summary.json`. I read every family's sheets and roughly a third of the cells at 2x, ground and upper side
  by side. Counts in this document come from `summary.json` and a structural audit run in the page
  (stair bounding boxes, window-to-neighbour-zone openings, bed/toilet presence, room proportions).
- Checked and clean across all 384 builds: 0 build exceptions, 0 validation issues, 0 page errors, 0 rooms
  unreachable from an entry zone, 0 stair pairs whose ground and upper polygons differ, 0 windows onto a
  neighbour / party-wall zone.
- Not checked: in-game behaviour of squads in these plans; seeds outside 1-24; unfurnished plans beyond the
  object counts above (`&furnished=0` shows them).

Severity: **critical** breaks the building as a place (front door to a sealed room, staff cannot reach their
own workplace); **high** clearly wrong to any player (bedroom without a bed, bathtub in a bar WC, empty bar);
**medium** odd but playable; **low** cosmetic.

## Per-family defects

### `bungalow_g1` — hold

| Seed | Floor | What is wrong | Severity |
| --- | --- | --- | --- |
| 14 | 0 | Front door opens into a living room with no other door; the rest of the house is entered by the kitchen door on the front yard | critical |
| 3, 4, 6, 8, 10, 15, 19, 21 | 0 | Kitchen has only its exterior door; no internal door to hall, dining or living | critical |
| 7 | 0 | Utility reachable only from outside (plausible as an outdoor laundry, but unintended) | low |
| 3, 7, 10, 12, 16, 20, 21, 22, 23 | 0 | A bedroom has a wardrobe/dresser but no bed (seed 3 `bedroom_2`, seed 7 `bedroom_2`, seed 10 `bedroom_3`) | high |
| 17 | 0 | Kitchen has no stove or sink | high |
| 5 | 0 | Two 305 sq ft bedrooms beside an 8 ft 6 in deep living strip that also carries the front door | medium |
| 1, 2, 9, 12, 16, 22, 24 | 0 | Only one exterior door: no back door on a detached bungalow, one approach for squads | medium |
| all | 0 | Interior loops in 3/24 seeds (authored Ash Grove 15/24, Cedar Close 9/24) | medium |

### `two_storey_house_g1` — hold

| Seed | Floor | What is wrong | Severity |
| --- | --- | --- | --- |
| 3, 18 | 0 | Kitchen reachable only from outside | critical |
| 6 | 0 | Kitchen and dining form a rear wing reached only by the back step; no door from hall or living | critical |
| 16, 23 | 0 | Living room (with dining in 16) reachable only from outside | critical |
| 4, 9, 10, 11, 24 | 0 | Dining (and utility in 4) reachable only from outside | critical |
| 14, 21 | 0 | Utility reachable only from outside | medium |
| 5 | 1 | Four bedrooms, none with a bed; bedrooms 1, 3, 4 are 8-8.5 ft strips | high |
| 1, 2, 3, 4, 6, 10, 11, 12, 13, 15, 16, 17, 19, 20, 22, 23, 24 | 1 | At least one bedroom without a bed (30 bedrooms in total) | high |
| 2, 6, 8, 10, 11, 17, 18, 24 | 0 | Ground-floor WC holds a full bathtub (WC area 72-90 sq ft) | high |
| 14, 22, 23 | 0 | WC without a toilet | high |
| 2 | 1 | Bedroom 1 is 391 sq ft (the full 27 ft width) while bedroom 3 cannot fit a bed | medium |
| 3, 5, 7 | 1 | Corridor-shaped bedrooms (9 x 23.5, 8.5 x 22.5, 11 x 29 ft) | medium |
| 2 | 0 | "Fence line ~40'" note runs through the porch and front-door swing | low |
| 1, 5 | 0 | Single exterior door on a two-storey house | medium |

### `semi_detached_g1` — hold

| Seed | Floor | What is wrong | Severity |
| --- | --- | --- | --- |
| 2, 10, 15 | 0 | Front door opens into a living room sealed from the hall; everything else is reached by the side/back door | critical |
| 4 | 0 | Kitchen and dining reachable only from outside | critical |
| 11, 24 | 0 | Kitchen reachable only from outside | critical |
| 1, 6, 17, 22 | 0 | Utility reachable only from outside | medium |
| 2, 5, 13, 14, 17, 18, 20, 21, 22, 23, 24 | 1 | Bedroom(s) without a bed (28 bedrooms) | high |
| 1, 2, 5, 7, 9, 10, 14, 15, 17, 21, 23 | 0 | WC with a bathtub | high |
| 9, 22 | 1 | Bedroom 7 ft wide | medium |
| 4, 8 | 0 | Living room 8-8.5 ft wide and 21-22.5 ft long | medium |
| 1, 2 | 1 | Bedroom 1 takes the whole rear half (398-410 sq ft) | medium |

Party wall handled correctly: no windows or doors on the neighbour side in any seed.

### `apartment_unit_g1` — ship with fixes

| Seed | Floor | What is wrong | Severity |
| --- | --- | --- | --- |
| 4, 6, 8 | 0 | Living room reachable only from outside | critical |
| 19, 22 | 0 | Bedroom and living reachable only from outside | critical |
| 24 | 0 | Kitchen reachable only from outside | critical |
| 8, 9, 10, 13, 22 | 0/1 | Bedroom without a bed | high |
| 7, 17 | 0 | Kitchen without stove or sink | high |
| 2, 7, 15 | 0 | WC with a bathtub | high |
| 2 | 1 | Bathroom 157 sq ft (about 10 x 17 ft), far above the 30-100 band | medium |
| 7, 11 | 0 | Kitchen 7 ft wide by 17-18.5 ft | low |
| 2, 3 | 0 | FRONT marker sits on the REAR YARD label; the unit is entered from the common corridor on the north side, so "front" and "rear yard" read as contradictory | low |

Tactical note: one door in 10/24 seeds is right for a flat, but it makes these plans single-approach.

### `corner_store_flat_g1` — ship with fixes

| Seed | Floor | What is wrong | Severity |
| --- | --- | --- | --- |
| 16 | 0 | Stockroom and back office reachable only from outside | high |
| 1, 8, 9, 11, 15, 17, 19 | 0 | Shop and stockroom are a separate unit from the hall, back office and WC; the shopkeeper's office and toilet are on the flat side | medium |
| 21 | 0 | Back office and shop separated from the rest | medium |
| all | 0 | Shop holds about 4 objects (register, counter, two wall shelves): an empty box with no aisles to break sightlines | high |
| 3, 16 | 1 | Bedroom without a bed | high |
| 8 | 0 | WC without a toilet | high |
| 1, 2 | 1 | Landing 144-171 sq ft, a full-depth 7 ft corridor | low |

A separate street door for the flat is realistic; only the split of the shop's own rooms is wrong.

### `small_office_g1` — hold

| Seed | Floor | What is wrong | Severity |
| --- | --- | --- | --- |
| 7, 10, 11, 14, 21 | 0 | Open office (with meeting room or manager office) reachable only from outside | critical |
| 4, 15, 17, 23 | 0 | Reception reachable only from outside | critical |
| 19 | 0 | Reception, open office and manager office cut off from the rest | critical |
| 3, 4, 6, 15, 16, 17 | 0/1 | WC without a toilet | high |
| all | 0/1 | Open-plan offices (about 400 sq ft in seed 5) furnished with one desk and one shelf | high |
| 5 | 0/1 | Two-storey office with a single exterior door | medium |
| 6 | 0 | Reception at the rear, the front door enters the open office | medium |

### `bar_restaurant_g1` — hold

| Seed | Floor | What is wrong | Severity |
| --- | --- | --- | --- |
| 9 | 0 | The bar room itself is cut off from the kitchen and back of house | critical |
| 12, 21 | 0 | Kitchen (and cold store, break room in 21) not connected to the bar | critical |
| 2, 4, 8, 13, 24 | 0 | Customer WCs only reachable via the back corridor from the alley | critical |
| 1, 5, 7, 10, 11, 14, 15, 16, 18, 19, 20 | 0 | Back office reachable only from the alley | medium |
| all | 0 | Bar and dining room holds 4 objects; no tables, chairs or booths | high |
| 1, 2, 3, 4, 5, 6, 8, 10, 13, 19, 20 (17 WCs) | 0 | Customer WCs with bathtubs | high |
| 1 | 0 | Domestic dining table and chairs in the commercial kitchen | low |
| 2 | 0 | FRONT tag covers the STREET label | low |

### `warehouse_g1` — hold

| Seed | Floor | What is wrong | Severity |
| --- | --- | --- | --- |
| 1, 2, 4, 5, 7, 8, 10-24 | 0 | Front office reachable only from outside; staff walk round to reach the corridor | critical |
| 3, 6, 9 | 0 | Warehouse floor not connected to the office block | critical |
| all | 0 | Warehouse floor (about 1,900-3,000 sq ft) holds about 3 shelves: no racking, no cover | high |
| 1, 5, 8, 10, 16 | 0 | WC without a toilet | high |
| all | 0 | Office-block labels (BREAK ROOM, WC, CORRIDOR) render about 5 px tall at 360 px because the 55-60 ft footprint sets the scale | medium |
| 1, 3, 4 | 0 | STREET label overlapped by dimension text | low |

Interior loops: 0 in all 24 seeds.

### `motel_row_g1` — ship with fixes

| Seed | Floor | What is wrong | Severity |
| --- | --- | --- | --- |
| 6 | 0 | Bedroom without a bed | high |
| 3 | 0 | 82.5 ft row: unit and ensuite labels about 5 px tall at map size | medium |
| 2 | 0 | ENSUITE labels drawn over the tubs | low |
| 2, 11, 13 | 0 | Ensuites 104 sq ft, larger than needed | low |

Units only reachable from the walkway is correct for a motel; the "only reachable via outside" caption is
expected noise for this family.

### Authored families — ship

No validation issues, every room furnished as labelled, interior loops in 9-15/24 seeds for Maple Street,
Cedar Close, Market Row and Ash Grove. Notes: Harbour Court's living room is 10 x 36 ft in every seed; Maple Street's `bedroom_e` has doors to both
the hall and the bath in 11 seeds.

## Cross-family issues

| Issue | Where | Severity |
| --- | --- | --- |
| Ground-floor spanning tree is a forest when several rooms hold exterior doors (`build.ts:41`); no check catches it | all generated except motel | critical |
| Furnished output fails the generator's own plausibility gate; the game ships the furnished form | all generated | high |
| Bathroom solver puts a tub in WCs before the toilet (`furnishing-v7.ts` `bathroom()`) | houses, apartment, bar, warehouse | high |
| Commercial rooms lose almost all furniture, so business plans have no sightline breakers | bar, warehouse, shop, office | high |
| Generated plans are trees: interior loops in 0-7/24 seeds per family vs 9-15/24 for four authored families | all generated | medium |
| Floor tabs strip covers the top dimension on every two-floor plan in the sheet at 360 px (for example `32'-0"` clipped); not checked in the live screens | two-floor seeds | low |
| Each floor is framed separately, so the building changes scale when switching tabs; stairs coincide in coordinates (audit: 0 mismatches) but do not line up visually across tabs | two-floor seeds | medium |
| Large footprints (warehouse, wide motels) shrink labels below legibility at phone map width | warehouse, motel | medium |
| `plausibilityReport` keys its exterior-door limits on `motel_row` / `warehouse`, but built locations carry `_g1`; re-scoring built motels fails 22/24 seeds. The sheet strips the suffix before scoring | tooling | low |

Authored vs generated look: the same renderer gives matching line weights, wall hatching and furniture
symbols. Generated plans add more exterior notes (Bins, Fence line, Car in drive, Good cover.) and shrubs
on larger lots, so the building sits smaller in the frame and labels shrink; authored plans name zones
"Front garden" / "Rear lane" where generated ones say "Front yard" / "Back yard". Not a defect on its own,
but generated incidents will read busier.

## Reproduce

```bash
git switch procgen/contact-sheet
npx vite --port 5191 --strictPort &          # any port; note it listens on localhost
TI_BASE_URL=http://localhost:5191 TI_CAPTURE_CELLS=1 npm run capture:locations
# PNGs and summary.json go to $TI_CAPTURE_DIR (default: <os tmp>/ti-location-captures)
# one family:  TI_FAMILIES=bungalow_g1 npm run capture:locations
# browse:      http://localhost:5191/locations.html?family=warehouse_g1&seeds=1-24&floor=0
# bare plan:   ...&furnished=0     keep map hint/zoom buttons: ...&chrome=1
kill %1
```

`summary.json` per family: seeds, floors histogram, room-count, entries, exterior-door, loop and
plausibility ranges, issue count, rooms reachable only via outside, and a per-seed row. Re-run after any
generator or furnishing change; a fixed build should show `detached` empty for every non-motel family and
no `FAIL` entries under `plausibilityFails`.
