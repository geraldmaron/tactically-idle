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
Tags: job=build; journeys=joint-operation; probes=none (squad count is not a probe input yet); lane=engine
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

### harbour-court-window: harbour_court's bedroom window can never be reached
Tags: job=command; journeys=choices-branch; probes=blueprint-building; lane=engine
Needs: start=none; integrate=none; ship=none

From the engine lane's sweep of the new barricade (2026-10-18): on `harbour_court`, an authored
layout, the mover's ground-floor bedroom has an exterior window and a route out through it
(w_bedroom to p_garden_e to p_walk_e), but the walk from the mover's starting spot is never clear,
so the window exit is pruned on all 90 sampled calls. The pruning is correct; a window no one can
reach is likely a layout defect. Done: find what blocks it, and either fix the layout (if a person
should be able to reach that window) or record why it's blocked by design.

### barricade-engine-fixes: Engine fixes the new barricade needs
Tags: job=command; journeys=choices-branch; probes=none (compile correctness); lane=engine
Needs: start=none; integrate=none; ship=none

From the calls lane's full run of the new barricade (2026-10-18). A move into a small room finds no
free point and generation throws instead of hosting elsewhere (ash_grove_v1). The rule for a team
move that is both an `entry` and `{ doorOf }` is undefined (the test expects an entry to observe its
target, the content observes the hall). `src/sim/drawn-effects.test.ts` samples live barricade plays
for incoming fire. Done: the move falls back to a free point inside the room's doorway or the
building can't host, the entry-plus-doorOf rule is decided and enforced, and the fire test runs on
an owned fixture.

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
Needs: start=none; integrate=barricade-engine-fixes, barricade-tooling-fixes; ship=none

As the hostage call was: template, design sheet in `docs/calls/`, tree, separate review. The old
tree has 2 `team` moves out of about 37 choices (armed 13, hostage 8, rescue 8), and a different
building changes 6 of 33 opening choices (`blueprint-building`, floor 0.18). Done: the new call
makes physical moves through the building, both blueprint floors rise, `npm run check:strings`
passes on it, it passes coverage, balance and the separate review, and the old
`barricade-order` tree is retired. It authors the support choices from `second-squad` (R-B4), so
the barricade reaches `squadRange` 2, and the `joint-operation` journey test switches from its
fixture to this call. The old barricade's outcome-score calibration row retires with it, so
this call adds a calibration row for its own endings (`src/sim/outcome-score.test.ts`). If a building fact (R-B1 upstairs, R-B2 window) first gates a required
need here, `src/sim/board-suggestions.ts` reads it (public building facts only), with a test that a
different building changes the board's list. R-B1 to R-B3 shipped in #51, #59 and #61. The design sheet (`docs/calls/barricade-design.md`, "Everything
Goes Back") lists its engine requests; tree data waits on them. The `items-none` share at openings
grows here too, since most of today's openings are phone calls that carry no gear.

### rescue-model-first: Write the rescue call model-first
Tags: job=command; journeys=answer-a-call, choices-branch; probes=blueprint-building; lane=calls
Needs: start=none; integrate=offsite-fire, rescue-engine-requests, lab-tests-off-live-content; ship=none

Same pipeline as the barricade; the design sheet is `docs/calls/rescue-design.md`. Done: rescue gunfire comes from the drawn incoming-fire result,
not harm authored per branch; `npm run check:strings` passes on it; it passes coverage, balance
and review; and the old `rescue-chair` tree is retired.

### armed-model-first: Write the armed-incident call model-first
Tags: job=command; journeys=answer-a-call, choices-branch; probes=subject-armament; lane=calls
Needs: start=barricade-model-first; integrate=none; ship=none

Same pipeline. Done: `npm run check:strings` passes on it, it passes coverage, balance and review,
and the old `armed-noise` tree is retired.

### civilian-hit-lines: Lines for a civilian hit by fire
Tags: job=command; journeys=chance-not-script; probes=none (text); lane=calls
Needs: start=none; integrate=none; ship=none

`offsite-fire`'s second PR draws fire at each person in an exposure, and needs per-target lines for
a civilian wounded or seriously hurt, in `src/content/incidents/lines.ts`. Done: the lines exist
through the prose skill and a separate review, before that PR merges.

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
N15 and N16 count-conditioned briefing lines and ending addenda. R-G1 shipped with `intel-odds` (#45, #48), R-G4 shipped with `clock-runout-routing` (#46, #56); N6, N7, N9 and N21 shipped in #64. Done: each request works in
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

### short-squad-ui: The squad card and Prepare say who stays home
Tags: job=build; journeys=short-squad; probes=none (display); lane=interface
Needs: start=none; integrate=none; ship=none

The engine side shipped in #78: a squad deploys with its ready officers, and the rest stay home
(`deployRoster` and `runRoster` in `src/sim/squads.ts`, `SquadReadiness.staysHome`). Left: the squad
card and Prepare render `staysHome` (who stays home and why), and `OpsPrepare.tsx` passes Deploy's
crew to `standardRadioPlan`; until then its radio count and "buy radios" prompt count every squad
member while Deploy reserves one radio per officer who goes. The e2e script's all-ready rule
(`scripts/play-loop.mjs`) relaxes to one ready officer (tooling).

### e2e-in-ci: The browser end-to-end script runs in CI
Tags: job=command; journeys=answer-a-call; probes=none (tooling); lane=tooling
Needs: start=none; integrate=none; ship=none

`npm run test:e2e` plays the board through the real UI at 390x844 and 320x568, but neither `npm
run verify` nor CI runs it, which is how it went stale. Done: pull-request CI runs it against a
built preview, with its runtime and Chrome setup stated, or the backlog records why not.

### fire-follows-building: Incoming fire follows the building
Tags: job=command; journeys=chance-not-script; probes=none (a drawn-harm check, not a favorable-chance probe); lane=tooling
Needs: start=none; integrate=offsite-fire; ship=none

Rescue request R-R9: `measureWiring` compares eligibility and favorable odds only, so nothing checks
that the drawn incoming-fire distribution changes with the building. Done: a paired-building check
over every fire-carrying choice shows the hit share differs where the sightline does, as a
trees-v13 test.

### barricade-tooling-fixes: Tooling fixes the new barricade needs
Tags: job=understand; journeys=choices-branch; probes=none (tooling); lane=tooling
Needs: start=none; integrate=none; ship=none

From the same run: `src/gen/incident/trees-v13/graph.test.ts` passes `memberCounts` where it needs
`callCounts`, so upstairs facts never settle; and the lab's Flow endings column overflows with the
new barricade's 11 endings (`src/dev/lab/model/flow-layout.test.ts`). Done: the graph test reads
compile-time facts, and the lab shows every ending at 390 and 430.

### lab-tests-off-live-content: Lab tests stop pinning live call content
Tags: job=understand; journeys=none (lab tooling); probes=none (tooling); lane=tooling
Needs: start=none; integrate=none; ship=none

Per the "Tests across lanes" rule in `COORDINATION.md`. About 12 lab test files use today's hostage
and rescue content as their subject (node ids, ending sets, crossing counts, choice labels, a gate's
check count), and `src/dev/lab/model/explore.test.ts` has a negative control that assumes the rescue
call never reaches a narrow-window state. The rescue rows break when `rescue-model-first` retires the
old tree. Done: those tests use owned fixtures, or derive ids from the tree under test; the rescue
rows first, before `rescue-model-first` integrates. The full table is in PR #58.

Slices shipped: the hostage owner_down pins (#67) and the barricade-swap and squad-count pins (#69).
Left: the rescue rows (`explore`, `why`, `squads`, `deps/model` lab tests).

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
replace. Its output isn't deterministic either: two runs on the same commit (main, 2026-10-18) list
the same findings by kind, scope and field path, but in a different order and quoting a different
repeated phrase. Done: the output is byte-identical across runs (stable order, a deterministic choice
of quoted phrase), `npm run verify` and pull-request CI run it, and it passes. The checker is
deterministic since #57, and the `check:strings` wrapper since #64 (byte-identical across runs).

## Department and staff

### peer-support-lead: Command Staff gains a Peer Support Lead
Tags: job=build; journeys=hire-and-equip; probes=officer-stress; lane=engine
Needs: start=none; integrate=none; ship=none

Owner decision 2026-10-19. A fourth manager who runs officer stress and recovery as a department
loop, hired in Develop like the others (`src/sim/command-staff.ts`). Done: the manager's loop, hire
cost and log lines in the engine; a Command Staff card and portrait (interface lane, the existing
art pipeline); an identity brief and pronouns (calls lane, the officer-stories rules). The engine
defines the loop first.

### recruiter: Command Staff gains a Recruiter
Tags: job=build; journeys=hire-and-equip; probes=none (hiring, not odds); lane=engine
Needs: start=none; integrate=none; ship=none

Owner decision 2026-10-19. A fifth manager who runs hiring as a department loop. Same shape and
split as `peer-support-lead`. Done: loop, hire cost, log lines, card, portrait and brief.

### patrol-work: Routine patrol returns as idle work under the Watch Commander
Tags: job=return; journeys=offline-settles; probes=none (idle economy); lane=engine
Needs: start=none; integrate=none; ship=none

Owner decision 2026-10-19: restore routine patrol work, which was deleted. Squads still have a
`patrol` duty that earns routine funding (`src/sim/types.ts` `SquadDuty`); what went was the
standing patrol assignments on the board (removed before 2026-10-18, see git history around
721536c and 4e908ac). Done: a short design note first (what patrol work is, how it pays, how the
Watch Commander runs it, how it shows on the board without crowding tactical calls), approved by the
lead, then the engine loop and its UI.

## Player experience

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

### store-wrap: Package the game for the App Store and Play Store
Tags: job=keep; journeys=save-round-trip; probes=none (packaging); lane=deferred
Needs: start=none; integrate=none; ship=none

Owner decision 2026-10-19: wrap the web app for iOS and Android. Done: a wrapper chosen with
evidence (e.g. Capacitor), the build running on a real iPhone and Android phone with saves surviving
an app restart, and the safe-area, keyboard and text-zoom checks from `playtests` passing on device.

### real-purchases: Point packs become real in-app purchases
Tags: job=build; journeys=hire-and-equip; probes=none (commerce); lane=deferred
Needs: start=store-wrap; integrate=none; ship=none

Owner decision 2026-10-19: free to play with purchases. The store and ledger are simulated today
(`src/commerce/`). Done: the point packs sell through the App Store and Play Store billing, purchases
restore across reinstalls, and the ledger records real receipts. Needs the store-wrap first.

### audio-haptics: Audio and haptics
Tags: job=command; journeys=none (optional polish); probes=none (polish); lane=deferred
Needs: start=none; integrate=none; ship=none

Optional.

## Owner decisions

- **Death endings:** a human read of `owner_killed`, `worker_killed`, the armed `subject_killed`,
  `resident_killed` and `tank_ran_out`.
- **Content note and 988 line wording** for the hostage and barricade calls.
- **E12:** whether a team holding outside an active shooter fits the game.
- **Barricade building family:** keep apartments (`apartment_unit_g2`) or not.
- **"Goes to review" ending line** (E2.1) in the barricade call.
- **Hostage review calls:** O4 custody wording, O1 armed-lane words, N19 time charge on all-night
  holds, the 3-line board hook clamp, the 6-decision stage-3 chain, the E3 count read, and B9.
- **Domain-model defaults D1 to D5** stand unless changed: no explosives, a fled subject's follow-up
  call, groups above 8 as a later mode, 24h review after a shooting, concessions within policy.
- **Barricade on apartments:** with the child in a bedroom, `apartment_unit_g2` hosts the barricade
  on 22 of 30 seeds (the rest are rejected because the first room off the bedroom is the living
  room). This bears on the existing barricade building-family decision above.
- **Later scope:** districts, career stories, simultaneous tactical incidents.

Decided 2026-10-19: scenario work is paused (the barricade is parked on its branch); a squad can
deploy short of injured officers (`short-squad-deploys`); sidearms from day one
(`sidearms-day-one`, shipped: two sidearms are issued at the start and `entry_team` stays the force certification, which both starting squads hold); keep the compiled fingerprints and the cross-engine check; a call resolved
with harm counts as resolved (already so in `dispositionOf`); an entry breaks every open commitment
(already so in `src/sim/commitments.ts`); build the Peer Support Lead, the Recruiter and patrol work;
the crisis cap stays report-only until playtests.
Also decided 2026-10-19: ship by wrapping the web app for iOS and Android; free to play with
purchases, so the simulated point packs become real purchases; target a Mature rating (ESRB M,
PEGI 16); no release date or budget yet.
