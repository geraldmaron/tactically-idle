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

The scenario depth program (owner, 2026-10-19) comes first in this section: the calls are correct
but forgettable, and no gate can fail a call for that. Order: `depth-bible` and `call-surfaces`
with `deception-commitments`, then `hostage-depth-pilot`, then an owner read before any other call
is rewritten. Plan of record: `docs/scenario-depth.md`.

### mark-plan-reads-when: The mark planner ignores an outcome's own condition
Tags: job=command; journeys=choices-branch; probes=none (compile-time pruning, not an odds input); lane=engine
Needs: start=none; integrate=none; ship=none

`prunePlan` (src/gen/incident/trees-v13/compile.ts) counts a mark as settable when any outcome of
a reachable choice sets it, even when that outcome's own `when` can never hold in the call. The
compile then drops the outcome, and `validateStoryBindings` fails a prompt that reads the mark as
undeclared. Found with the hostage pilot's `lie_found` (set only behind `lied_sign`, which group
calls can't set), worked around with a count condition. Done: settable marks respect the
outcome's `when`, and a fixture test shows a prompt variant pruned in the call that can't set it.

### depth-bible: Depth rules a call can fail with zero defects
Tags: job=command; journeys=choices-branch; probes=none (writing rules and review gates); lane=calls
Needs: start=none; integrate=none; ship=none

Technique lenses, a psychology reference, the temptation pattern and escalation palette, a darker
tier in the ethics rules, a keep, relax or drop verdict on every house style rule, and depth gates
D1 to D9 in the review rubric, all inside the four `swat-*` skills. Done: the skills carry them,
the string checker and prose lint match the verdicts, and AGENTS.md's player-facing writing rules
say the same.

### call-surfaces: Radio transcript, ending epilogue and a 3-line board hook
Tags: job=command; journeys=answer-a-call; probes=none (text surfaces, not odds inputs); lane=engine
Needs: start=none; integrate=none; ship=none

`TreeNode.exchange` and `TreeOutcome.exchange` (two to four spoken lines with a speaker), and
`TreeEnding.epilogue`, compiled with name binding, budgeted in the string checker and rendered in
the live call and the debrief. The Ops board hook clamps at 3 lines (owner decision B5, 2026-10-19).
Done: a call that authors them shows them at 390x844, and the checker fails an over-budget line.

### deception-commitments: Lies and unapproved promises the player can make
Tags: job=command; journeys=choices-branch; probes=none (commitment state, not a favorable-chance input); lane=engine
Needs: start=none; integrate=none; ship=none

A choice can make a commitment command never approved. It breaks when the promised thing is still
undelivered where the tree says it must be, moves the person's meters (`promise_broken`) and counts
in the score. Later choices can read whether it was kept or broken. Done: a gate fails a deception
whose break has no visible cue, and a test shows a lie that helps now and costs later.

### hostage-depth-pilot: Rebuild One Last Signature to the depth rules
Tags: job=command; journeys=answer-a-call, choices-branch; probes=none (a rewrite of an existing call, whose probes keep their floors); lane=calls
Needs: start=depth-bible; integrate=call-surfaces, deception-commitments; ship=none (waits on the owner read)

Open after the separate review: a temptation in group calls (F5, a promise can't be made to a group today). A redesign, not a polish: situations that reframe the taker, a temptation, an escalation palette,
voices for the owner, courier and negotiator, and an epilogue on every ending. Done: the gates and
the crossed coverage walk pass, a separate reader records D1 to D9, fingerprints are recaptured
deliberately, and the owner has read three paths aloud and approved the bible as calibrated.


### barricade-model-first: Write the barricade call model-first
Tags: job=command; journeys=answer-a-call, choices-branch; probes=blueprint-building, blueprint-locked; lane=calls
Needs: start=hostage-depth-pilot (the owner read); integrate=barricade-tooling-fixes; ship=none

Under `depth-bible`: template, design sheet in `docs/calls/` (the parked sheet reworked to the depth rules), tree, separate review including D1 to D9. The old
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
Needs: start=hostage-depth-pilot (the owner read); integrate=offsite-fire, rescue-engine-requests; ship=none

Same pipeline as the barricade, under `depth-bible`; the design sheet is `docs/calls/rescue-design.md` and is reworked to it. Done: it passes D1 to D9, rescue gunfire comes from the drawn incoming-fire result,
not harm authored per branch; `npm run check:strings` passes on it; it passes coverage, balance
and review; and the old `rescue-chair` tree is retired.

### armed-model-first: Write the armed-incident call model-first
Tags: job=command; journeys=answer-a-call, choices-branch; probes=subject-armament; lane=calls
Needs: start=barricade-model-first; integrate=none; ship=none

Same pipeline, under `depth-bible`. Done: `npm run check:strings` passes on it, it passes D1 to D9, it passes coverage, balance and review,
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

### crisis-content-note: Content note and 988 line
Tags: job=command; journeys=answer-a-call; probes=none (text); lane=deferred
Needs: start=content-descriptors; integrate=none; ship=none

Shown for the hostage and barricade calls. The wording is drafted for the owner's approval, and
nothing ships before the owner approves it (see decisions).
Where it appears is set in `docs/content-rating.md` (Warnings and support): a topic-only warning on
the call card, on by default, which also says leaving a call costs nothing; the E4.7 support line in
the debrief of every situation with `suicide_self_harm`, whatever the setting; and a Support entry
in Settings, always available.

### content-descriptors: Each situation says what it contains
Tags: job=command; journeys=answer-a-call; probes=none (metadata, not a chance input); lane=engine
Needs: start=none; integrate=none; ship=none

Design in `docs/content-rating.md`. Done: a closed descriptor type on each situation of a
`CallTree`; derived descriptors (`death`, `injury`, `police_gunfire`) computed from the compiled
tree; a gate in `src/gen/incident/gates/` that fails when a declared list leaves out a derived
descriptor, or when an adult subject with `noFatal` force outcomes has neither `suicide_self_harm`
nor a recorded reason; the four existing trees tagged (calls lane writes the declared ones); the
Scenario Lab's Calls surface shows each situation's descriptors.

### content-filter-draw: Players keep avoided themes off the board
Tags: job=command; journeys=answer-a-call, new:board-respects-filters; probes=none (selection, not a chance input); lane=interface
Needs: start=content-descriptors; integrate=none; ship=none

Design in `docs/content-rating.md`. Done: the avoided themes (`suicide_self_harm`,
`child_at_risk`, `domestic_violence`), the warning setting and the timer persisted outside the save
(extending `src/ui/people/prefs.ts`); a first-launch advisory and a Settings screen with a Support
entry; `drawCard` skips situations carrying an avoided theme and drops a kind with none left;
changing the list clears cards that no longer fit while a call in progress finishes; a test asserts
every combination leaves at least two kinds drawable; fingerprints stay pinned with nothing avoided.

### calls-per-kind: More than one call for each kind
Tags: job=command; journeys=answer-a-call, choices-branch; probes=none (each call joins the existing probes); lane=engine
Needs: start=barricade-model-first; integrate=none; ship=none

`CALL_TREES` maps each kind to one tree (`src/content/call-trees/index.ts`), so every hostage call
is the same call, and a content filter that rules out its situations removes the kind. Done: a kind
holds several trees, the draw picks among those the filters allow, and the content version,
fingerprints and Lab handle a list. Distinct from `new-call-types`, which adds kinds.

### dither-minutes: Stalling on a decision costs game minutes
Tags: job=command; journeys=new:stalling-costs-minutes; probes=none (time, not a favorable-chance input); lane=engine
Needs: start=none; integrate=none; ship=none

Design in `docs/call-pressure.md`. Done: real time on an open decision with a threat or running
clock accrues dither minutes at the timer setting's rate after its reading floor; the dither is
recorded with the decision and added to its minutes on commit, capped at the open threat's minutes;
replay reads it from the record; time away survives a close and resume once, and a backward
device clock never reduces or repeats it; previews and `threatTag` read it live; rates in
`src/sim/tuning.json`; a Lab slider; outcome-score calibration runs at zero dither and a separate
test records the shift at each setting.

### threat-drain-bar: The threat pill drains
Tags: job=command; journeys=new:stalling-costs-minutes; probes=none (display); lane=interface
Needs: start=dither-minutes; integrate=none; ship=none

Design in `docs/call-pressure.md`. Done: `ThreatPill` shows a bar of the threat's minutes left after
dither, matching its minute text; choices turn "Too slow" as it drains; the Off, Relaxed and
Standard timer setting sits in Settings beside the content filters; checked at 390x844 in the
running app.

### threat-agitation-lines: The subject reacts when the team stalls
Tags: job=command; journeys=new:stalling-costs-minutes; probes=none (text); lane=calls
Needs: start=dither-minutes; integrate=none; ship=none

Design in `docs/call-pressure.md`. Done: a threat can carry per-speaker lines that fire once as a cue
when dither crosses a threshold, written under `swat-call-prose` and reviewed under
`swat-writing-review`; no global line pool; not suppressed by situation (owner, 2026-10-20); the
hostage threats carry lines (drafted in `docs/calls/notes/content-warnings-draft.md`, section 4).

### fill-gauge-ui: A gauge that fills shows on the live call
Tags: job=command; journeys=new:audience-raises-stakes; probes=none (display); lane=interface
Needs: start=none; integrate=none; ship=none

Design in `docs/call-pressure.md` ("Gauges that fill"). Done: a fill clock renders beside
`ThreatPill` as a pill with its label, a bar that fills, the effect it has now named, and a marker at
each cue; a choice that stops or slows a fill says so in its preview; the debrief shows the audience
factor on trust and the camera strain; reduced motion respected; checked at 390x844 and 320x568 in
the running app.

### hostage-livestream: The crowd and the taker go live on the hostage call
Tags: job=command; journeys=new:audience-raises-stakes, choices-branch; probes=none (text and clocks, the fill effects are tuning); lane=calls
Needs: start=none; integrate=fill-gauge-ui (the player sees the gauge before the lines ship); ship=none

Design in `docs/calls/notes/hostage-livestream-design.md`. Authored on `claude/content-warnings-draft`:
two fills in all three situations (the regulars' phones at the tape; the taker's stream on the owner's
phone, with `watched` moves) and two choices at `talking` that slow or stop them at the price of the
bargaining. Done: the owner approves the lines; a separate `swat-writing-review` read; the Lab shows
both gauges filling under dither and a stop choice freezing one.

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
Tags: job=command; journeys=chance-not-script; probes=metric-pressure; lane=calls
Needs: start=none; integrate=none; ship=none

The engine side shipped: time moves agitation (`METERS_V1.drift` in `src/sim/meters.ts`, run from
`advanceTime`; a subject the team hasn't reached winds up, one who talks to the team settles, and a
drift never counts as an event). Left, in content: write the `shots` event into the outcomes where
shots fire (`moves: [{ personId, event: 'shots' }]`), and let the escalation branches read the
drifted stances. The drift rates are first-pass (0.06 and 0.04 a minute): 0.15 and 0.10 moved the
outcome-score calibration past its 0.75 trust bound, so any rise needs the calibration rows rechecked.

## Gates and tooling

### e2e-in-ci: The browser end-to-end script runs in CI
Tags: job=command; journeys=answer-a-call; probes=none (tooling); lane=tooling
Needs: start=none; integrate=none; ship=none

`.github/workflows/e2e.yml` runs `npm run test:e2e` on pull requests against the dev server (the
script reads `window.__ti`, which a built preview doesn't expose) with the runner's Chrome. It passes
locally at 390x844 and 320x568 (2026-10-19) but hasn't run on a runner yet. Done: the first pull
request run is green, or the failure is fixed.

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

Shipped in #80: the graph test reads `callCounts`, and `flow-layout.test.ts` checks the endings
column at Fit's legibility floor (900x596). Left: confirm every ending row is reachable at 390 and
430 with the new barricade loaded.

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

### patrol-work: Routine patrol returns as idle work under the Watch Commander
Tags: job=return; journeys=offline-settles; probes=none (idle economy); lane=engine
Needs: start=none; integrate=none; ship=none

Owner decision 2026-10-19: restore routine patrol work, which was deleted. Squads still have a
`patrol` duty that earns routine funding (`src/sim/types.ts` `SquadDuty`); what went was the
standing patrol assignments on the board (removed before 2026-10-18, see git history around
721536c and 4e908ac). Done: a short design note first (what patrol work is, how it pays, how the
Watch Commander runs it, how it shows on the board without crowding tactical calls), approved by the
lead, then the engine loop and its UI. The note is `docs/patrol-work.md` (proposed 2026-10-19); it
waits on owner answers 2 and 3 listed there (1 is answered: patrol pay stays flat).

### squad-preset-editor: One place to edit loadout presets
Tags: job=build; journeys=hire-and-equip; probes=none (layout); lane=interface
Needs: start=none; integrate=none; ship=none

The Squad screen and the Armory both edit `squad.loadoutPreset` (`src/ui/screens/Squad.tsx`).
Keep one.

### worn-kit: Each officer wears their own kit, and it protects the officer who wears it
Tags: job=build; journeys=hire-and-equip, team-moves-odds; probes=items-none; lane=engine
Needs: start=none (owner approves this proposal); integrate=none; ship=none

Proposed 2026-10-19, not yet approved. Every item is a pooled `ItemUnit`. Protection counts once
per action, best unit of its group (`src/sim/resolution.ts` best-of-group,
`src/sim/force-risk.ts` `selectedProtection`), and only on actions that declare
`authorized_response` or `medical_exposure` (`src/sim/equipment-requirements.ts`). No v13 call
tree declares either, so in shipped calls the light protective kit every officer now gets
(`src/content/issue-kit.ts`) does nothing, and eight kits would score the same as one where it did.
Radios already show the right pattern: `src/sim/standard-kit.ts` gives one per deploying officer,
outside the loadout, and `src/gen/incident/action-gear.ts` gives them no score bonus because a bonus
everyone has raises every call alike.

Recommendation:
1. **Worn kit is a class of item.** Radio headset, light protective kit and service sidearm are
   worn. Everything else (shields, ram, binoculars, drone, less-lethal, consumables) stays pooled.
2. **Each worn unit belongs to one officer.** It is issued on hire, goes where they go, and comes
   back to the pool when they leave. Deploy reserves it with the officer. Generalize
   `standard-kit.ts` from radios to all worn kit, rather than adding a second mechanism. Loadouts
   and `squad.loadoutPreset` hold pooled gear only, which makes `squad-preset-editor` smaller.
3. **Protection acts on the officer, not the score.** Light protection loses its +4 on
   `authorized_response`. Instead, where harm lands on a named officer
   (`applyIncidentConsequences` in `src/sim/incident-consequences.ts`, which covers authored
   `officerHarm` and the drawn incoming-fire result), that officer's own serviceable kit turns a
   serious injury into a wound, as `protectedOfficerEffects` does today for one kit per action.
   Light kit converts handgun, edged, blunt and improvised hits only, never a long gun, so a
   heavier vest has room to be a purchase later.
4. **Wear is per officer.** A worn unit takes `perUse` wear on each deployment and `perDay` as
   now. The Gear tab and officer profile show whose kit is near failing. A failed vest protects
   nothing, and its officer still deploys, flagged on the roster.
5. **Sidearms follow the shooter.** The firearm draw takes the acting officer's own sidearm
   instead of the first qualified unit in the squad (`qualifiedForceUnit`).

What it moves:
- **Odds:** choice chances barely move, since no v13 choice reads `authorized_response`. Officer
  harm severity does move on every call with incoming fire.
- **Compiled fingerprints:** none expected, because protection is read when the call is played,
  not compiled. If an implementation adds a compiled gear rule, the fingerprints move and the lead
  recaptures them on purpose.
- **Outcome score:** the ranking gate in `src/sim/outcome-score.test.ts` holds.
- **`items-none`:** the probe strips pooled gear only, since worn kit is not a loadout choice.
  Re-measure. Floors never fall.

Strongest objection: if every officer always wears working protection, serious injury from
handgun fire mostly disappears, and with it a band of consequence the calls write lines for. The
vest also becomes an upkeep tax rather than a decision. Controls: worn kit wears and fails per
officer, so neglected kit shows up in harm. Long-gun hits stay serious. The writing review checks
that the "badly hurt" lines still occur at a rate players notice.

Done: worn units carry their officer and the deploy and save paths keep them together. Protection
converts harm only for the officer wearing the kit, with tests for a worn-out vest and a long-gun
hit. The Gear tab shows worn kit by officer. The trust error and `items-none` are re-measured and
recorded in the PR. `npm run verify` passes.

### progression-pacing: Measure rank and milestone pacing, and read the promotion lines
Tags: job=build; journeys=officer-promotes, milestone-grants; probes=none (pacing, not a chance input); lane=engine
Needs: start=none; integrate=none; ship=none

Shipped 2026-10-20 with proposed numbers: development prices are the old funding price plus $800
per old development point, milestones by department level, calls resolved or trust
(`src/content/dev-tree.ts`), and ranks at 150, 450, 1,000 and 2,000 XP (`src/content/ranks.ts`).
None of it was measured over a long campaign. Done: a headless campaign of about 100 calls records
when each rank and each grant lands, whether buying ever beats waiting for the milestone, and
whether a lieutenant arrives before the 25-year retirement window; the numbers change only from
that run. The promotion lines in the shift report and debrief and the trait origin line on the
profile get a `swat-writing-review` read.

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

### real-purchases: Decide what real in-app purchases sell
Tags: job=build; journeys=hire-and-equip; probes=none (commerce); lane=deferred
Needs: start=store-wrap (and an owner decision on what is sold); integrate=none; ship=none

Owner decision 2026-10-19: free to play with purchases. Owner decision 2026-10-20 removed
development points, the point packs they sold and the simulated store are gone, so
nothing is for sale now. Open owner decision: what a purchase sells (for example cosmetic portraits
or a funding pack), weighed against milestones granting developments free. Done: that decision,
then purchases through App Store and Play Store billing that restore across reinstalls.

### offline-shell: The game opens with no network
Tags: job=keep; journeys=save-round-trip; probes=none (packaging); lane=interface
Needs: start=none; integrate=none; ship=none

The web app manifest shipped 2026-10-19 (`public/manifest.webmanifest`); there is no service worker,
so a cold open offline shows a blank page. Risk to design out first: a cached old shell after a
deploy would reject a newer save as "a different game version". Done: network-first navigation with
a cached fallback, the new build taking over on the next open, checked on a real phone. May be
folded into `store-wrap` if the native wrapper makes it moot.

### reputation-review: A separate read of the reputation labels and their effect
Tags: job=command; journeys=chance-not-script; probes=reputation-lean; lane=calls
Needs: start=none; integrate=none; ship=none

Department reputation shipped 2026-10-19 (`src/sim/reputation.ts`): four contributor labels in the
odds breakdown and a board tilt toward armed and barricade calls for a hard name, hostage and rescue
calls for a patient one. The labels passed `game_string_checks.py` but have had no separate
`swat-writing-review` read. Done: that read, a playtest of whether players notice the line, and a
decision on whether the lean needs a player-facing explanation (the HQ or the debrief).

### audio-haptics: Audio and haptics
Tags: job=command; journeys=none (optional polish); probes=none (polish); lane=deferred
Needs: start=none; integrate=none; ship=none

Optional.

## Owner decisions

- **Death endings:** a human read of `owner_killed`, `worker_killed`, the armed `subject_killed`,
  `resident_killed` and `tank_ran_out`.
- **Content note and 988 line wording** for the hostage and barricade calls: a session drafts it
  (`crisis-content-note`) and the owner approves it before anything ships.
- **E12:** whether a team holding outside an active shooter fits the game.
- **Barricade building family:** keep apartments (`apartment_unit_g2`) or not.
- **"Goes to review" ending line** (E2.1) in the barricade call.
- **Hostage review calls:** O4 custody wording, O1 armed-lane words, N19 time charge on all-night
  holds, the 6-decision stage-3 chain, and the E3 count read.
- **Domain-model defaults D1 to D5** stand unless changed: no explosives, a fled subject's follow-up
  call, groups above 8 as a later mode, 24h review after a shooting, concessions within policy.
- **Barricade on apartments:** with the child in a bedroom, `apartment_unit_g2` hosts the barricade
  on 22 of 30 seeds (the rest are rejected because the first room off the bedroom is the living
  room). This bears on the existing barricade building-family decision above.
- **Later scope:** districts, career stories, simultaneous tactical incidents.
- **What purchases sell** now that development points and point packs are gone (`real-purchases`).

Decided 2026-10-19: scenario work is paused (the barricade is parked on its branch); a squad can
deploy short of injured officers (`short-squad-deploys`); sidearms from day one
(`sidearms-day-one`, shipped: two sidearms are issued at the start and `entry_team` stays the force certification, which both starting squads hold); every officer is issued a light protective kit, at the start and on hire, and the Protective response program now unlocks only the carbine and shotgun; keep the compiled fingerprints and the cross-engine check; a call resolved
with harm counts as resolved (already so in `dispositionOf`); an entry breaks every open commitment
(already so in `src/sim/commitments.ts`); build the Peer Support Lead, the Recruiter and patrol work;
the crisis cap stays report-only until playtests.

Decided 2026-10-19 (scenario depth): scenario work resumes as the depth program above; the board
hook clamps at 3 lines; text gets new surfaces (transcript, epilogue) rather than larger budgets
everywhere; the player may lie or promise without approval, at a real cost; the tone goes darker,
with the self-harm safe-messaging rules, E2 and E3 kept (`docs/scenario-depth.md`).
Also decided 2026-10-19: ship by wrapping the web app for iOS and Android; free to play with
purchases (what is sold is open again since point packs were removed on 2026-10-20, see
`real-purchases`); target a Mature rating (ESRB M,
PEGI 16); no release date or budget yet.
Decided 2026-10-20 (progression): development points are removed and every development costs cash
or is granted free at a milestone (`src/sim/grants.ts`); officers hold real US police ranks from
Probationary Officer to Lieutenant, XP stops at Lieutenant, and the experience band is read from the
rank (`src/content/ranks.ts`, `src/sim/ranks.ts`).
Decided 2026-10-20 (content rating): the six descriptors in `docs/content-rating.md` stand as
written; the call-card warning defaults to on; the timer keeps Off, Relaxed and Standard; the
warning and 988 line wording is drafted for the owner's review, and nothing ships before approval.
Later that day, after research against Xbox Accessibility Guideline 123, the owner dropped the
content tiers and the death, injury and gunfire toggles: those three are warnings only, and players
avoid themes (self-harm, child at risk, domestic violence) instead, so the board never empties.
