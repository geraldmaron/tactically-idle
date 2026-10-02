# Phase 3: generated structures, incidents and threats

**Status:** Implementation brief, 2026-10-02. Builds on [phase2-simulation.md](phase2-simulation.md) and [operation-model.md](operation-model.md). Distributions and weights below are **proposed game tuning**, not sourced statistics; each lives in one named table so it can be retuned or replaced with researched figures.

## Owner intent (restated)

- **Buildings vary.** Structures should not be uniform rectangles. The buildings, their blueprints and their contents should combine in enough ways that players keep guessing from one game to the next.
- **People and threats vary.** People sit in different rooms, and their placements shift between runs. Threat type, armament, number of subjects and difficulty all vary, with realistic distributions.
- **Hard limits:** at most 2 floors per structure, and up to **4 squads** (this replaces the earlier limit of 3).
- **Auto-equip:** fills squad loadouts from what's available.
- **Think beyond the examples.** The examples are a floor, not a ceiling.

## Governing rules (unchanged, now load-bearing)

1. **Generate data, then draw it.** A generated `LocationDefinition` plus a generated `ScenarioDefinition` is the only truth. The blueprint, eligibility and resolution all read it.
2. **Deterministic from seeds.** Same `(familyId, buildingSeed, incidentType, incidentSeed, difficulty, contentVersion)` gives the identical building and incident. A run saves all of these.
3. **Validate before play.** Generated buildings must pass structural validation and plausibility metrics. Generated incidents must have at least one reachable resolution and a handover path. On failure: retry with the next seed (bounded), then fall back to a known-valid authored case. Never show the player an invalid case.
4. **Abstract, grounded, non-graphic.** Threats are game abstractions: category, readiness, disposition, intent. There is no ballistic model, no real-world procedure, and no gore.

**Strongest failure mode:** generated plans look implausible ("a bathroom off the kitchen through a closet") or produce dull, samey incidents. **Best alternative:** a large authored library with parametric variation. **Decision:** accepted with controls. Archetype skeletons are authored (footprint shapes, zoning, room programmes); partition, doors, windows, furniture and occupants are procedural. Plausibility metrics gate every result, and authored families stay as fallbacks.

## 1. Building generation (`src/gen/building/**`)

### Families (at least 8 at launch of this phase)

| Family | Floors | Footprint shapes | Room programme (ranges) |
| --- | --- | --- | --- |
| Bungalow | 1 | rect, L, T, notched rect | living, kitchen (open or closed), 2–3 bed, 1–2 bath, hall, optional utility/porch |
| Two-storey house | 2 | rect, L, rect + rear extension | ground: living, kitchen-diner, WC, hall + stair; upper: 2–4 bed, bath, landing + stair |
| Duplex / semi | 2 | mirrored L pair; one unit playable | as two-storey, narrower; party wall (concrete/brick) |
| Apartment (single floor of a block) | 1 (2 for maisonette variant) | rect with corridor spine | unit interior + common corridor + stairwell/lift lobby as zones |
| Corner store with flat above | 2 | rect, L, chamfered corner | ground: shop floor, counter, stockroom, back office, WC; upper: flat |
| Small office | 1–2 | rect, U, T | reception, open office, meeting, manager office, kitchenette, WC, server/storage |
| Bar / restaurant | 1 | rect, L | dining/bar floor, kitchen, cold store, office, WCs, rear yard |
| Warehouse / workshop | 1 (+ mezzanine as floor 1) | rect, rect + office block | open floor (high capacity, clutter), loading bay, office, WC, mezzanine office |
| Motel row (2–4 rooms of a row) | 1–2 | long rect, L | rooms with ensuites, walkway zone, office |

### Pipeline

1. **Footprint.** Union of 1–3 axis-aligned rectangles from the family's shape list. This gives L, T, U, notched, extended and chamfered shapes. A chamfer is the one allowed diagonal edge: a 45° cut corner on retail and bay windows. Dimensions are drawn from family ranges and snapped to 0.5 ft.
2. **Zoning.** Split the footprint into public, private and service zones by the family's rules: a street-facing public zone, and private rooms toward the rear or upstairs.
3. **Partition.** Recursive split with room-programme targets (area ranges, min width 6 ft, aspect ratio ≤ 3, halls 3.5–5 ft wide). Halls and landings are inserted as spines so every room is reachable without passing through a bathroom or bedroom, except ensuites.
4. **Floors.** Floor 1 shares the stair room's position and footprint (or a sub-footprint) with floor 0. Stairs connect the two floors through a `stair` opening. Floor 1 may be smaller (dormer or partial upper floor).
5. **Openings.**
   - Connectivity comes first: a spanning tree over room adjacency respecting programme rules (kitchen–dining, ensuite only from its bedroom), plus 0–2 extra loops.
   - Doors get materials by family and room: exterior solid-core or glazed; interior hollow-core; offices may have glass partitions; stockrooms and back offices may have steel.
   - Windows go on exterior walls by room type: every bedroom and living space has one; bathrooms have small or frosted ones; storerooms may have none. Coverings are distributed by time of day and room.
   - Entries: 1–3 exterior doors, with front plus back or side typical.
6. **Contents.** Per-room furniture kits by room type and family, placed against walls with clearance from door swings and windows. Tags (`blocks_space`, `blocks_sight`, `concealment`, `cover`, `valuables`, `hazard`) feed rules. Clutter level per incident (hoarding, renovation, party aftermath) multiplies objects and reduces usable space.
7. **Exterior.** Yard and street zones around the footprint, staging points, fences and gates, a driveway or parking area, and alleys for business families.
8. **Validate and score.** Run the existing validator (now floor-aware) plus plausibility metrics: room sizes within programme, no orphan rooms, hall width, window coverage, stair alignment, door clearances. Below threshold: retry.

**Variety target:** across 500 seeds per family, at least 90% of floorplans are distinct (by room-adjacency graph and rounded dimensions), and 100% validate.

## 2. Incident generation (`src/gen/incident/**`)

An incident is generated from: incident type × building × difficulty tier × seed. It produces a `ScenarioDefinition` in the existing schema: facts, stages, actions, endings, squad range, rewards.

### Incident types (at least 10 at launch of this phase)

Welfare check; domestic disturbance; person in crisis (self-harm risk); barricaded subject; burglary in progress; robbery at a business (with bystanders); hostage/holding situation; medical emergency with complication (hazard, aggressive relative, collapse upstairs); intoxicated disturbance or party; missing vulnerable person (search); reported intruder that is actually a resident (a false-alarm class); and suspicious occupancy at a vacant property.

### Subjects and threats

Per subject:

- **Category:** none, blunt, edged, firearm (handgun), firearm (long gun), improvised/unknown.
- **Readiness:** concealed, carried, brandished.
- **Disposition:** cooperative, distressed, intoxicated, agitated, hostile, in crisis.
- **Intent:** escape, barricade, harm self, harm others, unaware.
- **Awareness of police:** unaware, suspicious, aware.

Weighted tables per incident type and difficulty set the subject count and armament. Example starting shapes, to be tuned:

| Incident | Subjects 0/1/2/3/4+ | Unarmed / blunt / edged / handgun / long / unknown |
| --- | --- | --- |
| Welfare check | 35/60/5/0/0 | 85/4/6/2/1/2 |
| Domestic disturbance | 0/80/17/3/0 | 50/14/22/9/3/2 |
| Burglary in progress | 10/55/28/6/1 | 55/18/12/9/2/4 |
| Business robbery | 0/55/32/11/2 | 15/8/22/40/10/5 |
| Barricaded subject | 0/88/10/2/0 | 20/8/22/32/14/4 |

Higher difficulty tiers shift weight toward more subjects, readier armament, hostility and worse information. They never remove the unarmed and cooperative outcomes entirely.

### People and placement

- **People present:** subjects, civilians (residents, children, elderly, staff, customers, a hostage) and animals (a dog, a dangerous dog). They're placed by role-to-room affinities: a barricaded subject in a bedroom or bath with a lockable door; a burglar near `valuables`; a patient in the bath or at the foot of the stairs; children upstairs at night; staff in a back office. Exact points avoid furniture and vary every run.
- **Movement:** between stages, unconstrained subjects may move along the room graph by intent. Escapees head for exits, barricaders stay, people in crisis may go upstairs. The engine moves them; the player's knowledge doesn't update until something observes it.

### Information quality

Each fact has a truth and a report. Reports come from the caller, neighbour, dispatch history, CCTV or a keyholder. Each source has an error profile: a wrong room, a wrong subject count, a missing weapon, or an outdated floor plan. Difficulty raises error rates. Markers show claims; facts show sources.

### Environment

Each incident also draws environmental modifiers. Every one must change a named contributor:

- **Time of day:** lighting affects visual and changes where people are likely to be.
- **Weather:** outside sound and visibility.
- **Power:** whether the lights are on.
- **Doors:** locked state and furniture barricades, which set openings to blocked.
- **Clutter:** reduces usable space and movement speed.
- **Hazards:** gas smell or fire risk restricts some actions and raises strain.
- **Communication:** language barrier or hearing impairment affects contact.
- **Bystanders:** crowd outside means civilian-safety pressure.
- **Access aids:** a keyholder (unlock option), plans on file (better initial map knowledge) or an alarm panel.

### Action templates

Actions are not hand-written per scenario. Templates are bound to the generated geometry and facts:

- contact from a staging point;
- hailer from the street;
- observe a room through a window or doorway;
- thermal sweep from a doorway;
- drone survey;
- clear a route;
- unlock with a keyholder;
- force a door;
- two-point approach (needs at least 2 entries and at least 2 squads);
- a perimeter on each side, which scales usefully to 4 squads;
- evacuate civilians from a room;
- medical stabilisation;
- negotiate;
- contain and wait;
- hand over to a specialist;
- search a floor (two-floor buildings).

Each template declares its geometry requirements, the facts it can change, its contributors and its overlays. The generator picks 2–4 eligible templates per stage, scored for meaningful difference: at least one quick option and one information option, never two near-identical choices.

### Difficulty and rewards

- **Tier 1–5:** gated by department level and trust.
- **Expected difficulty:** computed from subjects, armament, civilians, information error, environment and building complexity. It's shown as a band plus its top three drivers, labelled as conditional on known information.
- **Rewards:** scale with tier, so harder incidents pay more.
- **Variety:** a 4-squad perimeter is only useful when the building has enough sides or entries. Small buildings cap the useful squad count, so 4 squads is never automatically best.

### Incident board

New incidents arrive over time from a seeded schedule (the idle loop) and expire if ignored. Expiry is shown and never punishing. The board shows 3–5 cards with building family, incident type, tier and squad range. Practice can replay any past incident seed.

## 3. Squads: up to 4

`SquadId` becomes `'A' | 'B' | 'C' | 'D'`. Department supports creating up to 4. Scenario squad ranges go up to 4. The live screen's squad selector and the map tokens support 4. The roster cap and tree may need a step to staff a fourth squad.

## 4. Auto-equip

`autoLoadout(state, scenarioId, squadIds, now)` → loadouts plus explicit unit picks plus a rationale per squad:

- Rank items by how many of this incident's likely actions they enable or improve. Weight these by the squad's roles and certifications (a negotiator squad gets the throw phone; a squad with a drone operator gets the drone).
- Pick units by condition. Never pick failed or expired units, and avoid unreliable ones when better units exist.
- Spread scarce items across squads by role, never duplicate a physical unit, and keep a reserve when a rule asks for one.
- Prep shows **Auto-equip** per squad and for all squads. The player can still edit the result.

## 5. Floors (max 2)

- **Data:** `Room.floor`, `ExteriorZone` on floor 0, and openings carry `floor`. Stairs are an opening type joining rooms on different floors.
- **Movement:** derived distances include stair costs.
- **Signals:** spatial signals between floors pass through the floor/ceiling material, which is poor for thermal and visual and fair for sound and radio.
- **Validation:** each floor validates separately, and the stairs must align.
- **Renderer:** floor tabs ("Ground", "Upper") with marker badges on any floor holding unresolved facts, plus a ghosted outline of the other floor's stair.
- **Tasks:** squad tasks name their floor.

## Acceptance (agents must prove with tests and captures)

1. **Building variety:** 500 seeds × each family all validate. At least 90% of floorplans are distinct per family. Footprints include L, T, U and chamfered shapes. 2-floor families render with working floor tabs.
2. **Determinism:** the same seed tuple regenerates an identical building and incident. A save reloads the same run.
3. **Incident variety:** over 1,000 generated incidents, the type, subject-count and armament histograms match their tables within tolerance. Placements differ across seeds for the same building.
4. **Solvability:** every generated incident has at least one reachable non-handover resolution and a handover path, and the generator never emits an action whose geometry requirement isn't met.
5. **Variables matter:** for each environment modifier and threat attribute, a one-variable test changes the expected contributor.
6. **Squads and auto-equip:** 4 squads can be created and deployed where useful; a fifth is refused. Auto-equip never double-assigns or picks failed units, and explains its choices.
7. **Real UI:** the live screen keeps the approved composition with generated buildings at 390×844 and 320×568.
