# Tactically Idle location and operation data contract

**Status:** Proposed implementation contract attached to the [game plan](../PLAN.md). The requirement that locations, ratings, decisions, and up to three squads matter is user-approved; record shapes and formulas remain design proposals. No generator or simulation has been implemented.

## Governing rule

**One location definition drives the blueprint and gameplay.** Author or generate the building, validate it, attach a compatible scenario, and render the blue paper and marker style. Do not generate a pretty image and then guess what rooms and connections it contains.

The complete content package contains a location definition, compatible scenario definition, presentation references, generator/content version, and seed. A running operation adds squads, assignments, player knowledge, resources, and a decision history. Static content and mutable run state are separate.

## Proposed records

| Record | Required information | Used by |
| --- | --- | --- |
| LocationDefinition | Stable ID, setting type, coordinate units, floor boundary, rooms, openings, connections, objects, exterior zones, authored constraints, seed and version. | Renderer, scenario binding, task model, validation. |
| Room | ID, type, floor, boundary polygon, computed area, usable area, task-capacity tags, relevant environmental properties. | Workload, capacity, permitted tasks, depiction. |
| Opening / connection | ID, connected spaces, position, width, type, state, and abstract traversal/communication properties. | Connectivity, access state, task time, depiction. |
| Object | ID, type, footprint, room, interaction tags, and decorative-or-mechanical designation. | Visible furnishings, task requirements, authored facts. |
| ScenarioDefinition | Compatible location predicates, facts, objectives, pressure model, stages, tasks, actions, transitions, endings, squad limits. | Scenario validation and progression. |
| Officer | Identity, base ratings, certifications, traits, current stress/injury, equipment, assignment. | Eligibility, task contribution, consequences. |
| Squad | Stable identity, name, roster, leader, loadout preferences, availability. | Player ownership, deployment, task assignment. |
| KnowledgeState | Fact ID, unknown/reported/confirmed/disproved status, confidence when used, discovery event, visible annotation. | Briefing, marker layer, available information. |
| OperationRun | Location/scenario IDs and versions, seed/random state, deployed squads, tasks, current stage, resource reservations, pressure, knowledge, state revision. | Save/resume and authoritative runtime state. |
| ActionDefinition | Actor requirements, target binding, prerequisites, time/resources, contributing ratings, spatial factors, risk display, outcome branches, knowledge changes. | Button presentation, eligibility, resolution. |
| DecisionResolution | Action and participants, pre-state revision, inputs/modifiers, random sample where applicable, selected branch, state changes, consumed items, explanation tokens. | Atomic persistence, debrief, tuning, reproducibility. |

Coordinates use one consistent unit system. Displayed dimensions and scale marks are derived from those coordinates; do not paint incompatible numbers into the texture. Choose a unit preference for display separately from stored geometry. Areas are calculated from the room polygons, not copied from handwritten annotations.

## Where physical properties matter

Each mechanical spatial property names its consuming rule. An unused field is either decorative or a design gap, not evidence of realism.

| Property | Proposed game effect | Example visible consequence |
| --- | --- | --- |
| Setting / room function | Eligible incident modules, plausible facts, relevant objectives. | A business storage room can require a different assessment from a residential bedroom. |
| Area and usable space | Assessment workload and useful participant capacity. | A larger room takes more task effort; furniture can reduce usable task space. |
| Position and connectivity | Abstract travel/hand-over time and which zones are reachable. | A remote room changes task timing; a disconnected room fails generation validation. |
| Openings and current connection state | Access/communication prerequisites. | An unavailable connection changes the relevant options and is drawn in the matching state. |
| Separation between assigned tasks | Coordination requirements and support availability. | A squad assigned elsewhere cannot contribute instantly to every action. |
| Environment and uncertainty | Which skills/equipment matter and how reliable the current estimate is. | An uncertain room carries an amber marker until the appropriate information is confirmed. |

These are abstract game effects. Exact real-world ballistic behavior, shooting positions, and building-intervention tactics are outside this model. The visual reference provides an art language, not a validated architectural or operational specification.

## Rating and condition model

Expose distinct shooting proficiency and composure ratings alongside communication, awareness, medical response, and coordination. Define an action's relevant ratings explicitly; do not average all officer statistics into a universal power score.

Proposed resolution sequence:

1. Verify that participating squads, officers, certifications, target spaces, and reserved items are eligible.
2. Determine the acting officers and supported tasks. Remove duplicate participants and respect task-capacity limits.
3. Derive task workload and spatial requirements from the location and current scenario state.
4. Calculate relevant effective capabilities from base ratings, current condition, applicable traits, equipment, and actual support.
5. Resolve the action against authored difficulty and uncertainty. Use a saved random sample only when the rule is probabilistic.
6. Apply task progress, time/pressure, knowledge, supplies, and individual condition changes together.
7. Save a concise explanation built from the same inputs and state changes, then update the map and buttons.

Composure affects how pressure degrades effective performance and how much extra strain is accrued. Stress remains a separate state; high composure cannot nullify recovery restrictions. Shooting proficiency contributes only to designated execution checks, never automatically to contact, observation, or medical tasks. Favorable resolution is multidimensional and cannot be reduced to a shooting score.

Balance formulas and coefficients are intentionally unselected until the same scenarios can be simulated with controlled inputs. Required test: vary one relevant rating at a time and inspect the calculation trace. Where uncertainty would make a displayed percentage misleading, show a qualitative risk band plus the known contributors.

## Three persistent squads

The department has at most three Squad records. Proposed default composition is four officers each. Starting staffing, squad-size changes, and progression of staffing capacity remain tuning decisions; the three-squad maximum is fixed by the user.

One officer has one active squad membership and one assignment at a time. One physical item has one reservation at a time. Reassignment cannot reset condition. Deploying several squads creates one shared OperationRun with distinct squad tasks, not separate simulations that award the mission reward several times.

A scenario explicitly declares its supported squad range. The content set must include scenarios supporting one, two, and three squads. A larger deployment can divide work and provide actual support; benefits depend on locations and task capacities. An officer on one task does not contribute their full ratings to all other tasks simultaneously.

Joint decisions declare actors and supporters. Dependent tasks specify what each squad must complete or make available. When one task is delayed, explain the dependency and update affected choices. If a squad is withdrawn or becomes unavailable, validate surviving paths to resolution or controlled handover. Shared mission rewards apply once; individual experience, item usage, and strain follow participation.

## Interface contract

Use the approved image's icon-led decision buttons, short titles, amber active choice, dark secondary choice, blueprint, and illustrated portrait strip. Information attaches to the drawn object and selected action rather than filling the screen with explanation cards.

- Show compact A/B/C selectors for deployed squads. Their names and readiness remain available without relying on color alone.
- The active squad selector changes the portrait strip and relevant map labels; it does not issue an order.
- Selecting a room shows its known identity/status and highlights compatible actions. Keep undiscovered facts hidden.
- Each choice presents an icon, action name, acting squad, known requirement, and a short tradeoff. A selected choice can expand its details before confirmation.
- Detail view names relevant ratings, equipment, space/position effects, uncertainty, and dependencies. Describe proposed effects in player language; keep internal record IDs and coefficients out of the interface.
- Confirmation names the affected squad(s) and target. Ineligible choices show a specific reason rather than a silently disabled button.
- After resolution, animate the corresponding room/annotation/task change and give a concise explanation. Do not move a marker or reveal a fact that the engine did not change.
- During a joint decision, indicate all affected squads even if only one portrait strip is visible.
- Keep map zoom, a room-list alternative, and a readable debrief available. Compact presentation must not conceal the information needed to make a choice.

## Generation and validation pipeline

1. Choose an authored location family and compatible scenario family.
2. Apply permitted geometry variations using a reproducible seed.
3. Compute derived areas, connection distances, usable space, and valid task targets.
4. Validate boundaries, openings, connectivity, room uses, and object placement.
5. Bind scenario facts/objectives to existing IDs. Check required capabilities and possible endings against the supported squads and loadouts.
6. Validate knowledge rules: reports may be uncertain or wrong by authoring intent, but the engine truth and reveal rules cannot contradict themselves.
7. Render geometry, furniture, grid, ink, dimensions, and current knowledge annotations. Apply generated textures only as surface assets that cannot alter topology.
8. Save the exact package version and seed with the run. If validation fails, reject it with an authoring diagnostic or select a known-valid fallback before the player starts.

Initial generation is controlled variation over authored layouts. Broader procedural topology can be introduced only once the same validators and gameplay checks apply to it.

## Required validation fixtures

- Two valid versions of the same room with different areas: rendering and applicable workload change together.
- Two valid connection graphs for the same room set: reachability/time effects match the depiction.
- Identical room and equipment with different shooting proficiency: only designated execution contributors change.
- Identical proficiency with different composure/current stress: the pressure response changes without double-counting the penalty.
- One, two, and three squad runs: responsibilities and actual support change; no duplicate people, gear, or mission rewards appear.
- An overcrowded assignment: useful participant capacity limits contributions and the UI explains it.
- An unsupported role/item requirement: generator rejects the case or provides a valid alternative before deployment.
- A wrong initial report: marker status changes only after the corresponding discovery; the scene does not reveal hidden truth early.
- A interrupted joint action: resuming restores its committed state and all reservations without rerolling or partial duplicate settlement.
- Same seed and content version: identical location and scenario binding. An intentional decision change can branch the run without changing the underlying building unexpectedly.

**Review:** The implementer supplies fixture results and actual-screen captures. The owner reviews decision comprehension and fidelity to the approved image. None of these checks is claimed complete by this specification.
