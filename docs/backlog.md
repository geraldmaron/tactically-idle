# Backlog

The one list of work still to do. Everything here was checked against the code on 2026-10-18;
done and retired items were removed rather than kept as history. Add new work here, delete an
item when it ships, and don't keep a second "next" list in any other doc. Each item names what
done looks like.

Each item has a stable id and two tag lines: the player job and journeys it serves, the odds
probes it moves, its lane, and what must ship before it can start, integrate or ship.
`COORDINATION.md` defines the format, and `src/architecture/references.test.ts` checks that every
id it names exists.

The core goal orders the list: generated blueprints with people and objects placed on them, and
every decision a chance of a branch shaped by officer and item ratings. `src/architecture/`
measures the odds wiring; its floors rise as these items land.

## Now: the odds and the blueprint

### offsite-fire: Gunfire from outside the building uses the incoming-fire model
Tags: job=command; journeys=chance-not-script; probes=none (adds a drawn harm result, not a favorable-chance input); lane=engine
Needs: start=none (the rescue design sheet states the request); integrate=none; ship=none

The rescue shooter is offsite (`src/content/call-trees/rescue-chair.ts`), instance compilation
leaves offsite people out of the incident (`src/gen/incident/instance.ts`), and incoming fire needs
an incident person with a threat profile (`src/sim/operation.ts`). The rescue design sheet
(`docs/calls/rescue-design.md`, section O) splits this into R-R1 (the shooter as an incident person
on the plan), R-R2 (one exposure that draws fire at each person in it) and R-R3 (fire odds from where
each target really is and for how long, a new incoming-fire version). Done: a threat outside the
building can fire on the team and on civilians through the drawn incoming-fire result, with its
sightline from the generated building, and R-R1 to R-R3 work in the rescue call.

### second-squad: A second squad can act
Tags: job=build; journeys=new:joint-operation; probes=none (squad count is not a probe input yet); lane=engine
Needs: start=none; integrate=none; ship=barricade-model-first (a call authors the choices)

Every v13 choice puts one squad to work (`squadsPutToWork`), and evaluation always supplies one
acting squad (`src/sim/operation.ts`) though the engine has `maxActing`, `support` and
`minSquads`. Done: a call authors support or second-squad choices, `squadRange` reaches 2 or more
on at least one call, and a journey test plays it. Decided 2026-10-18 from the barricade design
sheet: a second squad supports (barricade request R-B4, `support: { at, label, max }` compiled into
the existing `SupportRule`) rather than two squads acting at once. Controls: the support point is on
the map, the summary names the second squad's task, and every support choice also works with one
squad.

### camera-drone: A call that uses the camera drone
Tags: job=build; journeys=team-moves-odds; probes=none (covered by intel-confirmed once it exists); lane=engine
Needs: start=none; integrate=none; ship=none (a calls-lane tree authors the choice)

It's in the catalog (`src/content/items.ts`) and no call uses it. Done: a choice watches a room
through it, using the sightings step, and what it sees moves the odds through the intel rules
(`intel-confirmed` probe).

### armed-max: Text can say a look found empty hands
Tags: job=command; journeys=chance-not-script; probes=none (text condition); lane=engine
Needs: start=none; integrate=none; ship=none

From the hostage armed line's writing review: `TreeState.armed` takes `min` only, so after a look
into the room an unarmed group gets no line at all, which the review flags as a fake-choice risk
(the look pays nothing visible). Done: `TreeState.armed` takes `max` (including `max: 0`), under the
same compile-time reveal rule, with a test, so the hostage call can say the hands were empty. In
the same item: `armedRevealErrors` also checks variants the compiler prunes, which forced the
hostage call to set `saw_inside` on the lone-only `team_glass` as a workaround (#48). Check only
the variants that can occur, and tell the calls lane so it can drop the workaround.

### clock-runout-routing: A clock that runs out moves the call
Tags: job=command; journeys=choices-branch; probes=none (routing, not odds); lane=engine
Needs: start=none; integrate=none; ship=clock-edges-in-tooling

Hostage request R-G4, which the barricade call needs before any tree data: `onOut` records harm and
sets a mark but can't move the call (`src/sim/clocks.ts`), so a short choice can run a clock out and
leave choices on screen that the text has made false. Done: `onOut.next` routes the call when the
person is still inside and the decision's own outcome didn't end it, shown in the hostage call.

Engine side merged in #46: `onOut.next` compiles to a route, clock
targets are visible to the graph, the requirement tree and `check:strings`, and a permanent test
audits every onOut mark reader. Still to ship: `clock-edges-in-tooling`, and the calls lane adding
`onOut.next` to the hostage owner-condition clock.

### barricade-engine-requests: People placed and moving on the building
Tags: job=command; journeys=choices-branch; probes=blueprint-building; lane=engine
Needs: start=none; integrate=none; ship=none

Requests R-B1 to R-B3 in `docs/calls/barricade-design.md`. R-B1: a role can start on an upper
floor (every role is placed on floor 0 today, `src/gen/incident/trees-v13/compile.ts`). R-B2: a
person can leave by their own ground-floor window where the building has one (`usableOpening`
rejects every window, `src/gen/incident/story-bindings.ts`). R-B3: an outcome or a clock cue can
move a person, and the team can watch or enter a place on a route (the hall), not only a role's
room. Done: each works in the barricade call on the building families its sheet names, with the
conditions that keep text true where the building doesn't allow it. Decided 2026-10-18: one PR per
request in order R-B1, R-B2, R-B3. R-B2's exit field is `walksVia` and is designed for rescue's
R-R5 too. A place given as a step along a route declares what it must be, so text never names a
room the building doesn't have there. R-B3 lands before `offsite-fire`, which builds on its
positions. When a building fact first gates a required
need, `src/sim/board-suggestions.ts` must start reading it (public building facts only), with a test
that a different building changes the board's list.

### rescue-engine-requests: Outcomes that change the scene
Tags: job=command; journeys=choices-branch; probes=blueprint-building; lane=engine
Needs: start=none; integrate=none; ship=none

Requests R-R4 to R-R8 in `docs/calls/rescue-design.md`: R-R4 an outcome places cover (the rescue
vehicle between the shooter and the porch), R-R5 an escort by the front or the back door, R-R6 an
outcome changes a clock's rate, R-R7 an outcome sets a named exterior door's state, R-R8 the light
at an outdoor place counts. R-R5 overlaps the barricade's window exit (R-B2): design one exit-route
field for both. Each adds a field to an interface file, so each needs the lead's approval and a
Codex review; prefer one general outcome shape over five call-specific ones where the review
supports it. Done: each works in the rescue call, and R-R6 is checked against `src/sim/clocks.ts`,
which the sheet did not re-read.

## Next: calls and the incident model

### barricade-model-first: Write the barricade call model-first
Tags: job=command; journeys=answer-a-call, choices-branch; probes=blueprint-building, blueprint-locked; lane=calls
Needs: start=none; integrate=clock-runout-routing, barricade-engine-requests; ship=none

As the hostage call was: template, design sheet in `docs/calls/`, tree, separate review. The old
tree has 2 `team` moves out of about 37 choices (armed 13, hostage 8, rescue 8), and a different
building changes 6 of 33 opening choices (`blueprint-building`, floor 0.18). Done: the new call
makes physical moves through the building, both blueprint floors rise, `npm run check:strings`
passes on it, it passes coverage, balance and the separate review, and the old
`barricade-order` tree is retired. The design sheet (`docs/calls/barricade-design.md`, "Everything
Goes Back") lists its engine requests; tree data waits on them. The `items-none` share at openings
grows here too, since most of today's openings are phone calls that carry no gear.

### rescue-model-first: Write the rescue call model-first
Tags: job=command; journeys=answer-a-call, choices-branch; probes=blueprint-building; lane=calls
Needs: start=none; integrate=offsite-fire, clock-runout-routing, rescue-engine-requests; ship=none

Same pipeline as the barricade; the design sheet is `docs/calls/rescue-design.md`. Done: rescue gunfire comes from the drawn incoming-fire result,
not harm authored per branch; `npm run check:strings` passes on it; it passes coverage, balance
and review; and the old `rescue-chair` tree is retired.

### armed-model-first: Write the armed-incident call model-first
Tags: job=command; journeys=answer-a-call, choices-branch; probes=subject-armament; lane=calls
Needs: start=barricade-model-first; integrate=none; ship=none

Same pipeline. Done: `npm run check:strings` passes on it, it passes coverage, balance and review,
and the old `armed-noise` tree is retired.

### complications: Complication modules
Tags: job=command; journeys=choices-branch; probes=none (modules change situations, not a probe input); lane=calls
Needs: start=barricade-model-first; integrate=none; ship=none

Child, dog, second subject, medical bystander, crowd, power out, reinforced door, intoxication.
Every template has `complications: []` today. Each module that needs a new person or state goes to
the engine lane as a request first.

### hostage-engine-requests: Hostage engine requests
Tags: job=command; journeys=answer-a-call; probes=none (text, not odds); lane=engine
Needs: start=none; integrate=none; ship=none

Filed in `docs/calls/hostage-signature-design.md`: R-G2 a group role the player meets, and R-G3 with
N15 and N16 count-conditioned briefing lines and ending addenda. R-G1 shipped with `intel-odds` (#45, #48), R-G4 is in
`clock-runout-routing`; N6, N7, N9 and N21 are in `hostage-gate-requests`. Done: each request works in
the hostage call and the call's fingerprints are recaptured deliberately.

### hostage-review-leftovers: Hostage review leftover B9
Tags: job=command; journeys=answer-a-call; probes=none (prose); lane=deferred
Needs: start=none (waits on the owner's ruling, design question 10); integrate=none; ship=none

The B9 owner-condition replay leak: the stage 2 cue still identifies the situation. NF3 to NF8 and
the N8 and N20 skill fixes shipped in #44.

### crisis-content-note: Content note and 988 line
Tags: job=command; journeys=answer-a-call; probes=none (text); lane=deferred
Needs: start=none (waits on the owner's wording); integrate=none; ship=none

Shown for the hostage and barricade calls once the owner settles the wording (see decisions).

### aftermath: Casualty, care and aftermath
Tags: job=command; journeys=new:aftermath-follows; probes=none (consequences after the call); lane=deferred
Needs: start=none (waits for the engine lane to free `src/sim/operation.ts`); integrate=none; ship=none

An officer who fires is off duty for 24 game hours (D4); a fled subject creates a follow-up
warrant call (D2), which also needs content and dispatch work.

### new-call-types: New call types
Tags: job=command; journeys=answer-a-call; probes=none (each call joins the existing probes); lane=deferred
Needs: start=barricade-model-first; integrate=none; ship=none

High-risk warrant, robbery in progress, crisis barricade, vehicle standoff, built model-first. The
standoff needs a roadside building family.

### meters-drift: Meters move with time
Tags: job=command; journeys=chance-not-script; probes=metric-pressure; lane=engine
Needs: start=none; integrate=none; ship=none

Time moves the meters, the `shots` event is written into content, and escalation comes by drift.

### less-lethal-cartridges: Less-lethal use spends cartridges
Tags: job=build; journeys=hire-and-equip; probes=none (inventory, not odds); lane=engine
Needs: start=none; integrate=none; ship=none

## Gates and tooling

### e2e-in-ci: The browser end-to-end script runs in CI
Tags: job=command; journeys=answer-a-call; probes=none (tooling); lane=tooling
Needs: start=none; integrate=none; ship=none

`npm run test:e2e` plays the board through the real UI at 390x844 and 320x568, but neither `npm
run verify` nor CI runs it, which is how it went stale. Done: pull-request CI runs it against a
built preview, with its runtime and Chrome setup stated, or the backlog records why not. First fix a
flake seen 2026-10-18 (1 of 5 runs on main at 4d81419's parent): after a barricade call ends
`entry_subject_hurt`, the next call's Deploy button is disabled and the script asserts "the chosen
squads can deploy". The script picks squads without checking that they're ready after an injury.
Find whether that's the script's assumption or a game state the player can't see a reason for.

### fire-follows-building: Incoming fire follows the building
Tags: job=command; journeys=chance-not-script; probes=none (a drawn-harm check, not a favorable-chance probe); lane=tooling
Needs: start=none; integrate=offsite-fire; ship=none

Rescue request R-R9: `measureWiring` compares eligibility and favorable odds only, so nothing checks
that the drawn incoming-fire distribution changes with the building. Done: a paired-building check
over every fire-carrying choice shows the hit share differs where the sightline does, as a
trees-v13 test.

### clock-edges-in-tooling: The lab and the tree tests follow clock routes
Tags: job=understand; journeys=choices-branch; probes=none (tooling); lane=tooling
Needs: start=none (#46 merged); integrate=none; ship=none

`clock-runout-routing` adds optional clock-target parameters to `callGraph`, `callStringRows` and
`requirementTree`. Done: `scripts/check-strings.ts`, the call-tree traversals in
`src/gen/incident/trees-v13/call-trees.test.ts`, and the lab's graph, string-row and requirement
call sites (the full list is in the engine PR body) pass them, so a node reachable only through a
clock shows in Flow, Script and Why and its text is checked.

### hostage-gate-requests: Gate requests from the hostage review
Tags: job=command; journeys=answer-a-call; probes=none (tooling); lane=tooling
Needs: start=none; integrate=none; ship=none

N6 coverage starts that cross group size (`src/gen/incident/trees-v13/coverage.test.ts`), N7
`check:strings` binding distinct names and pronouns, N9 prose lint on dashes, colons and stock
phrases (`src/gen/incident/gates/prose-lint.ts`), and N21 a shift sampler for crisis frequency.
Stricter checks may add findings to calls in progress; tell the calls lane before merging.

### scale-gates: Scale gates (M6)
Tags: job=command; journeys=answer-a-call, choices-branch; probes=none (gates); lane=tooling
Needs: start=none; integrate=none; ship=barricade-model-first, rescue-model-first, armed-model-first

Every signature class over K seeds (generate, bind, validate, agree, walk, coverage, writing),
balance per template and incident class, the domain model's invariants as code, its stress-test
cases as tests, and published counts. The harness can start now; final counts wait for the
replacement calls.

### strings-gate: `npm run check:strings` joins verify and CI
Tags: job=command; journeys=answer-a-call; probes=none (tooling); lane=tooling
Needs: start=none; integrate=barricade-model-first, rescue-model-first, armed-model-first; ship=none

It exits 1 today only on the barricade, armed and rescue trees, which the model-first calls
replace. Done: `npm run verify` and pull-request CI run it, and it passes.

## Player experience

### manager-pronouns: Managers carry their pronouns as data
Tags: job=build; journeys=none (no manager text uses a pronoun yet); probes=none (data); lane=engine
Needs: start=none; integrate=none; ship=none

The manager portraits fix how each manager looks (she, he, they in the art briefs), but
`ManagerProfile` has no pronoun field. Done: `pronouns` on `ManagerProfile`, set from the briefs,
before any shift report or log line refers to a manager by pronoun.

### onboarding: A first call that teaches the loop
Tags: job=command; journeys=answer-a-call; probes=none (teaching flow); lane=deferred
Needs: start=barricade-model-first (needs validation: choosing and guaranteeing a teaching call may need generation work); integrate=none; ship=none

### familiarity-priorities: Team familiarity and a change-priorities action
Tags: job=build; journeys=none (no call uses either yet); probes=none (not wired); lane=deferred
Needs: start=none; integrate=none; ship=none

Neither is used by any call.

### playtests: Playtests and real-device checks
Tags: job=command; journeys=answer-a-call, save-round-trip; probes=none (testing); lane=deferred
Needs: start=barricade-model-first; integrate=none; ship=none

First-time players, and a real iOS and Android phone, including keyboard and text zoom. Includes
the rendered save-slot rejection message, never seen.

### audio-haptics: Audio and haptics
Tags: job=command; journeys=none (optional polish); probes=none (polish); lane=deferred
Needs: start=none; integrate=none; ship=none

Optional.

## Owner decisions

- **Mobile engine and device targets; business model and price; content rating; budget and
  release date.** The store and ledger are simulated until then.
- **Death endings:** a human read of `owner_killed`, `worker_killed`, the armed `subject_killed`,
  `resident_killed` and `tank_ran_out`.
- **Content note and 988 line wording** for the hostage and barricade calls.
- **E12:** whether a team holding outside an active shooter fits the game.
- **Barricade building family:** keep apartments (`apartment_unit_g2`) or not.
- **"Goes to review" ending line** (E2.1) in the barricade call.
- **Scoring:** whether "resolved with harm" counts as complete (+10% service), and whether an entry
  breaks every open commitment, including those to civilians.
- **Hostage review calls:** O4 custody wording, O1 armed-lane words, N19 time charge on all-night
  holds, the 3-line board hook clamp, the 6-decision stage-3 chain, the E3 count read, and B9.
- **Sidearms:** a new department can't fire until it unlocks `field_response_program` and trains
  `entry_team`. Keep that, or issue sidearms from day one.
- **Command Staff scope:** build the Peer Support Lead and Recruiter, and decide whether routine
  patrol work gets an idle home under the Watch Commander or stays deleted.
- **Fingerprints under the no-freeze rule:** keep the compiled-fingerprint test and cross-engine
  CI as regression tripwires, or drop them.
- **Domain-model defaults D1 to D5** stand unless changed: no explosives, a fled subject's follow-up
  call, groups above 8 as a later mode, 24h review after a shooting, concessions within policy.
- **Later scope:** districts, career stories, simultaneous tactical incidents.
