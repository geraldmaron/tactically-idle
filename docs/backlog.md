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
Needs: start=none; integrate=none; ship=none

A shooter outside the building (the retired rescue call had one) can't fire: instance compilation
leaves offsite people out of the incident (`src/gen/incident/instance.ts`), and incoming fire needs
an incident person with a threat profile (`src/sim/operation.ts`). The work splits into the shooter
as an incident person on the plan, one exposure that draws fire at each person in it, and fire odds
from where each target really is and for how long. Done: a threat outside the building can fire on
the team and on civilians through the drawn incoming-fire result, with its sightline from the
generated building, used by the curated rescue call (`next-curated-calls`).

### second-squad: A second squad can act
Tags: job=build; journeys=joint-operation; probes=none (squad count is not a probe input yet); lane=engine
Needs: start=none; integrate=none; ship=none

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

## Next: calls and the incident model

The calls were rebuilt from zero on 2026-10-21 (owner): every old call is deleted, and the board
carries curated calls only, starting with Going Live (`going-live-review`), then
`next-curated-calls`. The depth rules (`depth-bible`, `call-surfaces`, `deception-commitments`,
`docs/scenario-depth.md`) apply to each one.

### mark-plan-reads-when: The mark planner ignores an outcome's own condition
Tags: job=command; journeys=choices-branch; probes=none (compile-time pruning, not an odds input); lane=engine
Needs: start=none; integrate=none; ship=none

`prunePlan` (src/gen/incident/trees-v13/compile.ts) counts a mark as settable when any outcome of
a reachable choice sets it, even when that outcome's own `when` can never hold in the call. The
compile then drops the outcome, and `validateStoryBindings` fails a prompt that reads the mark as
undeclared. Found with the hostage pilot's `lie_found` (set only behind `lied_sign`, which group
calls can't set), worked around with a count condition. Done: settable marks respect the
outcome's `when`, and a fixture test shows a prompt variant pruned in the call that can't set it.

### authored-harm-minors: Authored harm can record a minor as killed
Tags: job=command; journeys=none (an ethics invariant on recorded harm, not a journey); probes=none (a clamp on recorded harm, not a chance input); lane=engine
Needs: start=none; integrate=none; ship=none

Owner rule since 2026-10-07: children can be hurt, never killed. The clamp holds only on drawn force:
`instance.ts` sets `noFatal` on a minor or a person the self-harm screen covers, and only the force path reads it
(`src/sim/drawn-effects.ts`, `src/gen/incident/gates/engine-driver.ts`). An outcome's authored `harm`
compiles straight to `personHarm` (`src/gen/incident/trees-v13/compile.ts`) and `authoredHarm`
(`src/sim/incident-consequences.ts`) records it with no check, so a tree that writes `fatal` for a role the
template can draw as a minor records a death. sol confirmed it in memory on 2026-10-23 with an injected fixture
(`minor: true`, `noFatal: true`, recorded `fatal`); no shipped call reaches it. Done: a fixture test that fails
on today's code: an authored `fatal` on a minor, and on a self-harm-screened subject, records `fatal`; after
the fix the same fixture records no death (capped at `serious`, the domain model's §6 clamp) and a gate fails
any tree whose reachable outcome authors `fatal` on a role its template can draw as a minor or with
`noDeathOnCard`. The gate in `src/gen/incident/gates/` is a tooling request. This is the first case of the
invariant inventory proposed in `docs/scenario-framework.md` section 9, step 1.

### depth-bible: Depth rules a call can fail with zero defects
Tags: job=command; journeys=choices-branch; probes=none (writing rules and review gates); lane=calls
Needs: start=none; integrate=none; ship=none

Technique lenses, a psychology reference, the temptation pattern and escalation palette, a darker
tier in the ethics rules, a keep, relax or drop verdict on every house style rule, and depth gates
D1 to D9 in the review rubric, all inside the four `swat-*` skills. Done: the skills carry them,
the string checker and prose lint match the verdicts, and AGENTS.md's player-facing writing rules
say the same.

### call-surfaces: Radio transcript, ending epilogue and a board hook
Tags: job=command; journeys=answer-a-call; probes=none (text surfaces, not odds inputs); lane=engine
Needs: start=none; integrate=none; ship=none

`TreeNode.exchange` and `TreeOutcome.exchange` (two to four spoken lines with a speaker), and
`TreeEnding.epilogue`, compiled with name binding, budgeted in the string checker and rendered in
the live call and the debrief. The Ops board hook shows in full (owner, 2026-10-22, replacing the 3-line clamp of decision B5).
Done: a call that authors them shows them at 390x844, and the checker fails an over-budget line.

### live-chat-build: Finish the read of Going Live's chat
Tags: job=command; journeys=none (text and presentation); probes=none (text and presentation); lane=calls
Needs: start=none; integrate=restraint-never-charged; ship=going-live-review (the same read)

The chat shipped 2026-10-22 (merge ad0d329): each threat's chat follows its drain in thirds, the stream's
stopped, slowed, surged and dropped pools play at onset, gates in `src/content/incidents/chat.test.ts`
and a playback test in `src/ui/screens/live-chat.test.ts`; the rule is in `docs/call-pressure.md` and
`.agents/skills/swat-call-prose/references/live-chat.md`. Left: the separate reader's third pass on the
final text (its second read left 7 fixes, which were applied but not re-read); handles that read as one
person twice in a thread (`priya1990` then `priya1989`, `vinnie1990` then `vinnie1989`, seen in the lead's
play), so the generator avoids a shared stem in one call; a copied save loaded in the same page inherits
lines already shown (chat memory is keyed by run id; presentation only, owner question below). Done:
the third read approves, and no two handles in one call share a stem.

### live-chat-tooling: The string checker and the Lab see the chat
Tags: job=command; journeys=none (tooling); probes=none (tooling); lane=tooling
Needs: start=live-chat-build; integrate=none; ship=none

`check:strings` never sees chat lines (`scripts/check-strings.ts` has no reactions input): add a `--chat`
mode to `game_string_checks.py` that runs only the dash, colon, gendered, length and banned-word checks.
The Lab's Stall scrubber names the chat phase and the next three thread lines, and Script lists each
threat's threads in order. A stream cue's text never playing after the stream has stopped is part of
`threat-after-close`. Done: a chat line with a dash fails `check:strings`, and the
Lab shows the phase at three stall points.

### live-chat-memory: The chat remembers the player's last choice
Tags: job=command; journeys=none (text and presentation); probes=none (text and presentation); lane=engine
Needs: start=live-chat-build; integrate=none; ship=none

`TreeThreat.chatIf`: extra early lines when an earlier choice's mark is set, with the same `when` shape
as `promptIf`, so the chat remembers the door it saw or the lie it caught. Only worth building once the
base chat is read and approved. A `{street}` token for the front street's name belongs here too, so a
viewer can guess a street that is on the map; until it exists the chat names no street.

### deception-commitments: Lies and unapproved promises the player can make
Tags: job=command; journeys=choices-branch; probes=none (commitment state, not a favorable-chance input); lane=engine
Needs: start=none; integrate=none; ship=none

A choice can make a commitment command never approved. It breaks when the promised thing is still
undelivered where the tree says it must be, moves the person's meters (`promise_broken`) and counts
in the score. Later choices can read whether it was kept or broken. Done: a gate fails a deception
whose break has no visible cue, and a test shows a lie that helps now and costs later.

### civilian-hit-lines: Lines for a civilian hit by fire
Tags: job=command; journeys=chance-not-script; probes=none (text); lane=calls
Needs: start=none; integrate=none; ship=none

`offsite-fire`'s second PR draws fire at each person in an exposure, and needs per-target lines for
a civilian wounded or seriously hurt, in `src/content/incidents/lines.ts`. Done: the lines exist
through the prose skill and a separate review, before that PR merges.

### complications: Complication modules
Tags: job=command; journeys=choices-branch; probes=none (modules change situations, not a probe input); lane=calls
Needs: start=none; integrate=none; ship=none

Child, dog, second subject, medical bystander, crowd, power out, reinforced door, intoxication.
Every template has `complications: []` today. Each module that needs a new person or state goes to
the engine lane as a request first.

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
Needs: start=none; integrate=none; ship=none

`CALL_TREES` maps each kind to one tree (`src/content/call-trees/index.ts`), so every hostage call
is the same call, and a content filter that rules out its situations removes the kind. Done: a kind
holds several trees, the draw picks among those the filters allow, and the content version,
fingerprints and Lab handle a list. Distinct from `new-call-types`, which adds kinds.

### going-live-spine: Going Live rebuilt structure first
Tags: job=command; journeys=choices-branch, chance-not-script; probes=none (content structure); lane=calls
Needs: start=none; integrate=none; ship=going-live-review

The 2026-10-22 teardown (`docs/calls/notes/going-live-teardown.md`) and Codex's separate read rejected the
call back to `swat-call-design`. The structural passes are done on branch `claude/going-live-spine-25ad3c`
(tip 123efc8, not merged: every string is a placeholder sketch), following `docs/calls/depth-mesh-method.md`:
one hidden fact (`rider_clear`), one exit decision, the lie charged in both situations, eight escalation
mechanisms, stage 3 threats as external events. `npm run check:paths -- hostage_crisis`, re-run by the lead:
`rider_clear` settled for random 78%, best_odds 95%, patient 93%, fast 96% (owner target 50% in every
style, 2026-10-22), dominance flags 10 to 0, cross-stage echo on played paths 60 to 85% down to 0 to 1%.
Codex's second read rejected 123efc8; structure pass 2 (`claude/spine-pass2-363cdf`, tip 44f5470, 2026-10-22)
fixed it as data: the front release, s2 evidence of non-delivery and retention, the lie broken on the
`way_out` run-out (`held_found_out`), one rider temper in both situations (pre-turn agitation 69.6 against
69.4), the repost cue true whoever is inside, a reachable `clip_out` beat, the wall prompt, honest ending
summaries, and the door and window probe back to 12 of 24. `check:paths` holds (turn reach 78/95/93/96).
Codex's third read (`side-session-notes/local_0ef35909-1f92-43ed-b124-d0236bd4f320/going-live-spine-codex-round3.md`):
9 of 10 hold, three medium findings, no block; all three fixed as data at 8d8a0fc (2026-10-22): `walk_live`
adverse is now the shame event its tag names (crowd x3 routes 165 to 0 on the dither-aware walk), and the
minute-3 beat is a suspension warning, not a cut, with the rate flag gone (the stream reads live throughout).
The lead re-ran `check:paths` on 8d8a0fc: turn reach 78/95/93/96, uniform 56/57, nothing beaten. Owner, 2026-10-22: `go_in` keeps its +8 on
`clip_out`. The prose is written (scene, menu, consequence, integration edit; `claude/hopeful-pike-69bdac`,
6e4d34f, `check:strings` clean). Left, in order:
1. The writing review (2026-10-22, `docs/calls/notes/going-live-review.md` on `claude/friendly-leakey-bd79fb`,
   e66d2fb): verdict edit, block B1, fixes F1 to F13, 17 notes. Owner decisions the same day: no long-call
   charge for waiting (`restraint-never-charged`); no custody images (officers take hold on the step, no car
   or station); epilogues speak only for people on scene; the manager is offered the phone and decides (F11);
   D7, the line a player repeats, is "your hands are shaking. There's water in the cooler by me." A fix pass
   applies F1 to F13 as data with those decisions, then `check:strings` and `check:paths`.
   Still open, not blocking: `way_out`'s run-out text cannot differ by `nextIf` route (spine sheet row O).
2. The tests that pin the old call's ids, fingerprints and snapshots (10 failures in `trees-v13` on
   6e4d34f, plus any outside it), recaptured or rewritten on purpose, and the `wiring` probe "door and window states" for the
   hostage call, now 12 of 24 on the pass 2 branch against its 0.27 floor; confirm with `wiring.test.ts`.
Done: the teardown's blocks closed as data with the `npm run check:paths` report attached, `npm run verify`
green, and a separate review.

### beat-marks-before-clocks: A beat that changes a clock applies at its own minute
Tags: job=command; journeys=chance-not-script; probes=none (clock ordering, not odds); lane=engine
Needs: start=none; integrate=none; ship=none

Found by Codex's third read of the Going Live spine (2026-10-22): the engine advances clocks over the whole
stall before it applies beat marks, so a beat at minute 3 that cuts the stream still lets the stream clock
climb to minute 9.5 (25.7 to 32.9 on one route) and fire cues after the cut, in projection and commit alike.
Done: clock-changing beats apply at their timestamps in `stalledRun` and the commit, the remaining minutes
advance under the changed state, and a fixture test shows no clock bump or cue after a cutting beat.

### restraint-never-charged: Waiting it out never costs the team in the debrief
Tags: job=understand; journeys=debrief-explains; probes=none (scoring of time, not odds); lane=engine
Needs: start=none; integrate=none; ship=none

Owner, 2026-10-22, from the Going Live writing review's block B1: on the `hold` path the debrief adds
'The team was on scene for 68 minutes.' at -1 trust and +3 strain (`time:long` in `src/sim/outcome-score.ts`,
`longAt: 45`), which punishes restraint. Rule: no `time:long` charge when the call's long minutes come from a
hold or talk choice whose card states its span (`span`, such as "All night"); other long calls keep the charge.
Done: a test on fixtures where a long hold scores no `time:long` and a long call of another kind still does,
the outcome-score ranking gate holding, and Going Live's `hold` debrief read without the line.

### threat-after-close: A threat never lands after the result that ended its scene
Tags: job=command; journeys=answer-a-call; probes=none (ordering, not odds); lane=engine
Needs: start=none; integrate=none; ship=none

Seen in the lead's play and the teardown: after `cut_feed` the result has viewers "turn" on a stream that
just ended, and after `wait_night` the rider "watches the light from behind the counter" after walking out.
Done: a threat or clock cue whose text describes a scene the committed result ended does not commit after
it, shown by a test on Going Live's `wait_night` and `cut_feed` paths. The stream's repost cue in
`src/content/incidents/hostage.ts` also reads the rider after a walk-out on a hold. Folds in the cue-after-stop rule
listed under `live-chat-tooling`.

### mesh-trial: Compare the depth mesh with one author under the same gates
Tags: job=command; journeys=choices-branch; probes=none (process); lane=lead
Needs: start=none; integrate=none; ship=none

`docs/calls/depth-mesh-method.md` stands at "needs validation" after Codex's 19 findings: its gates are
hypotheses until each has a bad fixture, and the single-author rival is untested. Done: one call built
twice to the same brief and budget, once by the mesh and once by one author in several passes, both
held to `npm run check:paths`; the owner reads three paths of each blind, and the record keeps tokens, lead
time and amendment rounds.

### going-live-review: A separate read of Going Live before it ships
Tags: job=command; journeys=choices-branch, chance-not-script; probes=none (text); lane=calls
Needs: start=none; integrate=none; ship=none

`src/content/call-trees/hostage-live.ts`, sheet `docs/calls/going-live-design.md`. Done: a
`swat-writing-review` verdict from a separate reader on the bound text at 390px in the Lab (Play and
Script), a Codex cold read, `npm run check:strings` clean, the reactions pools in
`src/content/incidents/hostage.ts` read for tone (viewers are people too: no cheering force), and
the owner's read of the two situations and the manager's death endings.

### next-curated-calls: Barricade, armed and rescue as curated calls
Tags: job=command; journeys=choices-branch, chance-not-script; probes=officer-traits, source-pull; lane=calls
Needs: start=going-live-review (the first call sets the bar); integrate=none; ship=none

Each written fresh on the live-decision model, one at a time: pressure sources with a count the scene
would show, beats on every threat, a trait the call favors, and physical acts that read the building
and the kit. A type returns to the board only with its call (`CALL_TREES`). Done per call: the same
gates and review as Going Live.

### one-card-board: The board with one curated kind
Tags: job=command; journeys=answer-a-call; probes=none (board pacing); lane=engine
Needs: start=none; integrate=none; ship=none

The board keeps one live call per kind (`drawCard`, `src/sim/incidents.ts`), so with one curated kind
it never shows more than one card. Decide whether one kind may hold two cards (different buildings
and situations) until more calls exist.

### spend-mix-readers: What the department spends on shapes who applies and who funds it
Tags: job=command; journeys=none (department loop); probes=funding-balance (stays a gap); lane=engine
Needs: start=none; integrate=none; ship=none

`playerProfile` (`src/sim/player-profile.ts`) derives the spend mix from the ledger. Done: the recruit
pool leans toward it (training spend draws candidates who want to learn) and grants lean toward the
department's posture, each a small named multiplier with a cap and a test; the funding probe stays at
zero.

### city-canon-per-save: Each save draws its own city's names
Tags: job=command; journeys=none (text); probes=none (text); lane=calls
Needs: start=none; integrate=none; ship=none

`src/content/world.ts` binds one fixed canon (Hotbag, Loopcast, Metro 6 News) on every call, so the
names stay the same across calls. When a second curated call uses them, draw the canon once per save
from the pools, store it in the save, and pass it to the binder through `IncidentSpec`. Done when two
saves can name different apps, and every call in one save names the same ones.

### profile-surface: The player sees how the city reads the department
Tags: job=command; journeys=none (department loop); probes=none (display); lane=interface
Needs: start=none; integrate=none; ship=none

A short HQ panel names the department's name (posture), its habit on the clock (stall), its spend mix
and its form, each with the one thing it changes (`docs/player-profile.md`). An eased card says
"a quieter call while the team recovers" (`IncidentCard.eased`).
The stall line says it raises starting pressure only on the Standard timer, and shows nothing
extra on Off or Relaxed. The eased mark renders on the call card (comebackTier saves it today and
nothing in `src/ui/` shows it). Once `rewarded-ads` ships, the ad line says offers come less often when the
player skips them, and nothing else.

### lab-flow-timeouts: The Lab's Flow draws where a threat runs out to
Tags: job=command; journeys=none (tooling); probes=none (tooling); lane=tooling
Needs: start=none; integrate=none; ship=none

`callGraph` (`src/gen/incident/trees-v13/graph.ts`) lists each threat's run-out route as
`timeoutRoutes`, and `truthReach` follows them, but the Flow layout draws only choice edges, so the
nine Going Live run-out moments show as nodes with nothing leading in. Draw each route as its own
dashed edge from the node whose threat runs out, labeled with the threat.

### lab-live-window: The Scenario Lab plays the live decision
Tags: job=command; journeys=none (tooling); probes=none (tooling); lane=tooling
Needs: start=none; integrate=none; ship=none

The Play surface's dither slider shows beats in a comms column and each source's count; style bots
(talker, breacher, staller) report pass rates per style for each curated call.

### aftermath: Casualty, care and aftermath
Tags: job=command; journeys=new:aftermath-follows; probes=none (consequences after the call); lane=deferred
Needs: start=none (waits for the engine lane to free `src/sim/operation.ts`); integrate=none; ship=none

An officer who fires is off duty for 24 game hours (D4); a fled subject creates a follow-up
warrant call (D2), which also needs content and dispatch work.

### new-call-types: New call types
Tags: job=command; journeys=answer-a-call; probes=none (each call joins the existing probes); lane=deferred
Needs: start=none; integrate=none; ship=none

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

### scale-gates: Scale gates (M6)
Tags: job=command; journeys=answer-a-call, choices-branch; probes=none (gates); lane=tooling
Needs: start=none; integrate=none; ship=none

Every signature class over K seeds (generate, bind, validate, agree, walk, coverage, writing),
balance per template and incident class, the domain model's invariants as code, its stress-test
cases as tests, and published counts. The harness can start now; final counts wait for the
replacement calls.

### strings-gate: `npm run check:strings` joins verify and CI
Tags: job=command; journeys=answer-a-call; probes=none (tooling); lane=tooling
Needs: start=none; integrate=none; ship=none

It exits 1 today only on the barricade, armed and rescue trees, which the model-first calls
replace. Its output isn't deterministic either: two runs on the same commit (main, 2026-10-18) list
the same findings by kind, scope and field path, but in a different order and quoting a different
repeated phrase. Done: the output is byte-identical across runs (stable order, a deterministic choice
of quoted phrase), `npm run verify` and pull-request CI run it, and it passes. The checker is
deterministic since #57, and the `check:strings` wrapper since #64 (byte-identical across runs).

## Department and staff

Current owner revision, 2026-10-22: NPC patrol replaces tapping; SWAT costs remain. The prior tap,
detail-strain and four-tab/banner decisions are superseded where they conflict with `docs/patrol-work.md`
and the blue-hour visual direction. The running overhaul is still a draft, not the new economy.

### patrol-work: NPC patrol personnel replace tapping and SWAT patrol income
Tags: job=return; journeys=offline-settles, hire-and-equip, save-round-trip; probes=none (idle economy); lane=engine
Needs: start=none; integrate=none; ship=none

Owner revision 2026-10-22: remove tapping, broaden the department with autonomous patrol personnel,
retain SWAT signing costs/wages, and reconsider routine SWAT patrol. The revised design and adversarial
controls are in `docs/patrol-work.md`. Retire SWAT revenue patrol; preserve standby/rest and explicit
specialist assignments. Reuse settlement, projections, ledger and reports. Add separate patrol records,
service-time grades, hiring/payroll/operating costs, training and hard position ceilings per department
level. Bump the save version deliberately; never silently reset an incompatible campaign.

Done: HQ shows a staffed patrol scene and automatic income, Team separates SWAT/Patrol/Command, a real
hire shows its costs and unboosted net change, and no tap control/command or legacy SWAT patrol income
remains. Online/offline tests cover every rate boundary, cap, clock rollback, training, saves, empty roster
and sustainable recovery. Simulate first-session, 24-hour and multi-day pacing before treating proposed
prices or rates as balanced. Update duties, Watch Commander, optimizer, finance and affected journeys.
Physical-device validation remains in `playtests`.

### worn-kit: Light body armor protects the officer who wears it
Tags: job=build; journeys=team-moves-odds; probes=none (changes harm severity, not a chance input); lane=engine
Needs: start=none; integrate=none; ship=none

Basic kit is part of every officer since 2026-10-21 (`src/sim/basic-kit.ts`), so the stock and
wear half of the old proposal is done. What is left: light body armor does nothing on a call. It
adds no score, by decision, and it never reaches `selectedProtection` (`src/sim/force-risk.ts`)
because built-in units are kept out of a decision's uses.

Recommendation: where harm lands on a named officer (`applyIncidentConsequences` in
`src/sim/incident-consequences.ts`, authored `officerHarm` and the drawn incoming-fire result),
the officer's armor turns a serious handgun, edged, blunt or improvised hit into a wound. It never
converts a long-gun hit. Shields and rescue shields keep their own protection on their actions.

Strongest objection: if every officer always has working armor, serious injury from handgun fire
mostly disappears, and with it a band of consequence the calls write lines for. Control: long-gun
hits stay serious, and the writing review checks that "badly hurt" lines still occur at a rate
players notice.

Done: armor converts harm only for the officer hit, with tests for a handgun and a long-gun hit;
the outcome-score ranking gate holds; `npm run verify` passes.

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

### feel-slice: One path from HQ to debrief that feels like one game
Tags: job=command; journeys=answer-a-call, debrief-explains; probes=none (layout, density and taps, not odds); lane=interface
Needs: start=none; integrate=none; ship=none

The owner (2026-10-23, after Codex's df9a3e9): the app feels flat, oversized and half baked, and not one
end-to-end experience. The specs and primitives exist (`docs/ui-ux-audit.md`, ui-primitives); adoption
stopped about a third of the way, and the gates count declarations instead of size, priority and taps. So
no new system: one vertical slice on existing primitives, measured, which the owner plays before
`ui-surfaces` continues. Plan: `/Users/geralddagher/.claude/plans/df9a3e9-is-the-correct-vectorized-pearl.md`.
Codex rejected the first draft for reversing owner decisions; these stay: the live call is one screen in
the 4B order, board cards keep the full hook and the warning line (owner re-confirmed 2026-10-23), the
cold open stays whole, twin Going Live cards stay while only hostage is registered, first run keeps its
controls, Store stays the rightmost tab with its deep links, officer tiles stay 2-up.

Interface (one builder): a single-row 44px resource bar; HQ with Your move first, squads as face rows
with `ChoiceRail` duty, patrol as one income row, the repeated chips gone; board cards with the art strip
at `--plate-h` and one footer row; brief with the scene plate and role-silhouette faces; deploy
preselecting the one best-fit ready squad; live with a one-row head, no duplicate threat footer, a
two-line reserved comms box and the first choice reachable; debrief with one settlement beat (no
celebration after a death) and Next call, which closes through `closeDebrief` and opens the board. Adds
only `Face` and a toast queue; deletes the bespoke variants it replaces.

Tooling (one builder) extends `scripts/ui-gates/`: reachable primary (fully visible, unobscured,
enabled), essential content retained (hook, warning, odds, harm unclamped), chrome at most 108px plus
safe area, density only when items exist (2 board cards, 2 squad rows; skipped at 200% text), plate
placeholder on first frame with zero layout shift, and tap budgets in `play-loop.mjs` (board to first
live decision at most 3, debrief to board 1). Matrix: 320, 390 and 430 wide, 640 tall, 200% text, long
names, empty board, blocked deploy, timer Off, Relaxed and Standard with Step out and re-entry. Each
check first fails on df9a3e9 and switches on with the slice change that passes it.

Done: `npm run verify`, `npm run check:ui` with the new checks and `npm run test:e2e` pass; the lead plays
one Going Live call from HQ back to the board at 390x844 and 320x568; a before and after contact sheet;
Codex reviews the merged diff; the owner plays the slice. Nothing in `ui-surfaces` starts before that.

### ui-surfaces: Every screen passes the gates
Tags: job=command; journeys=answer-a-call, hire-and-equip, debrief-explains; probes=none (layout and art); lane=interface
Needs: start=feel-slice; integrate=none; ship=none

Each package follows the `feel-slice` rules and the component contract in `docs/game-ux-direction.md` (owner, 2026-10-23: variable counts as grouped lists, uniform pills and rows on one grid), and passes its checks: existing primitives, the variants it
replaces deleted, alias tokens migrated (the aliases go after the last package). `feel-slice` covers P6,
P7 and the HQ part of P2. P3 collapses Team's second tab level only if Hire and Training stay one tap
away. P4 removes "All upgrades" only after prerequisite discovery, cross-track comparison and
return-to-item are proven through the rooms, and P8 gives each art set one style (Build mixes line art
and photoreal props). Idle-game acceptance for every package: every badge maps to an action available
now and acting clears it; no badge that only a purchase clears; an upgrade's effect is stated before
purchase; unpaid multi-session pacing, recovery and automation hold (`docs/research/reddit-idle-games.md`).

Astra's packages P2 to P8, one builder each, no shared files: P2 HQ, finance and command staff; P3 squads,
officer sheet, hire, arrange and training; P4 Build, upgrades and Armory (essential-copy clamps, hidden
glyphs, actionable locked states that name Build, Upgrades); P5 first run, settings and saves (one theme
switch, leads on the Menu's switch rows to match its link rows, shared save cards, and tighten Saves and
Training, which grew taller when 13px prose went to 14px); P6 board, brief and deploy (the hook shown in full with no clamp, owner 2026-10-22; Map and basic-kit visuals);
P7 live call, review, result and debrief (compact strip and empty radio, keeping the agreed order in
`docs/ops-experience.md`, a reachable first choice, outcome and resource marks); P8 portraits, art and the
blueprint (literal colors, art sizing, fallback floors). The shared tokens, variants, `LoadingState`,
`ErrorState`, semantic type classes, `ICON_SIZE` and required `Row.lead` and `Section.icon` landed with
ui-primitives (2026-10-22). The gates (`ui-gates`, 2026-10-22) hold every rule's debt in `src/ui/ui-debt.json` (`npm run check:ui`,
`npm run ui:baseline`, `docs/visual-kit.md` "UI gates"); each package brings its files and states to zero.
Briefs: `side-session-notes/local_0ef35909-1f92-43ed-b124-d0236bd4f320/ui-audit/ui-surfaces-brief.md`. File lists per package are in `side-session-notes/local_0ef35909-1f92-43ed-b124-d0236bd4f320/ui-audit/astra-findings.md`. Done: each
package's surfaces pass every gate at 320, 390 and 430, a fixed-seed sweep compared with the 2026-10-22
captures, and a closing Astra read of the after set.

### owner-visual-picks: The owner picks the tab plate and the reading serif from one compare page
Tags: job=command; journeys=answer-a-call, hire-and-equip; probes=none (layout and type); lane=interface
Needs: start=none; integrate=none; ship=none

Two open owner decisions are visual, so the owner judges them side by side, not from prose. One
private compare page (an Artifact) shows, at 390 and 320 and from one fixed-seed campaign:

1. The tab-root plate at no plate, 72px, 96px and 128px on each of HQ, Calls, Officers and Build,
   so the owner also decides whether every tab gets one. The plate height is one token
   (`--plate-h` in `theme.css`, tabs in `TAB_PLATES`), so any pick is a one-line change.
2. The decide beat and a debrief in the current face and in the candidate serif behind the dev
   switch (`src/ui/settings/candidates.ts`, `docs/ops-experience.md` "The reading face: still open").

Owner's picks (2026-10-22): the plate stays 96px on all four tabs (already `--plate-h` and `TAB_PLATES`), and
the reading face stays the sans. Done: the serif rule deleted from `candidates.css`, the dev switch removed,
and the compare captures retired.

### patrol-boosts: Bounded boosts apply to NPC patrol funding
Tags: job=build; journeys=hire-and-equip, offline-settles; probes=none (funding, not call odds); lane=engine
Needs: start=patrol-work; integrate=none; ship=none

Replace tap multipliers and the obsolete separate detail-strain-drain proposal with the rules in
`docs/patrol-work.md`. Boost eligible NPC gross only, with a bounded additive bonus and explicit expiry;
show the actual net dollar change. Neither revenue nor boosts grant service XP or department levels.
Permanent commitments use sustainable unboosted projections. Reuse/extract the sound grant validation
from the existing multiplier path without keeping tap state as the patrol model.

Done: expiry and training boundaries give equal online/offline results; replay does not duplicate a grant;
zero eligible income cannot consume a worthless boost; maximum grade/capacity/boost combinations pass
multi-day pacing and recovery simulations. The old tap products and ceiling in `docs/monetization.md`
do not determine new paid value.

### store-destination: A persistent Store with clear purchase states
Tags: job=build; journeys=hire-and-equip; probes=none (navigation and purchases); lane=interface
Needs: start=none; integrate=patrol-work; ship=none

Owner request 2026-10-22: an easily accessible modern game Store. Use management navigation HQ, Calls,
Team, Build, Store; keep live calls focused. Move existing EquipmentStore into Store rather than
building a second catalog. Equipment requirements preserve their return context. Team owns staffing
and training; Build owns facilities. Boosts/real offers appear only when usable content and a working
provider exist. Clearly distinguish funding and real-money prices, owned/locked/unaffordable/offline,
pending/canceled/failed purchase and Restore states. Confirm successful acquisitions beside the object.

Done: one-press Store entry from management screens; correct context return; 320/390/430px keyboard,
150% text, safe-area and touch-target checks; persistent labels fit without clipping; resource bar also
remains readable with enlarged text. These enlargement defects were observed during the blue-hour
review and must be fixed with the navigation revision. No fake countdowns or unearned badges. No offer
or solicitation during a call or after an adverse result, and no badge that only a purchase clears.

### rewarded-ads: Watching an ad is rewarded, and the watch rate is measured
Tags: job=build; journeys=hire-and-equip; probes=new:ad-history-blind; lane=engine
Needs: start=patrol-boosts; integrate=store-destination; ship=store-wrap (the ad network SDK)

The player chooses a rewarded ad that grants a useful timed patrol funding boost under
`docs/patrol-work.md`. Determine its value from the new idle economy; the old tap-based x1.5/10-minute
worth estimate and eligibility are superseded. Offers remain optional and outside call/adverse-result
surfaces. The reader lives in a new ad reader module under `src/sim/` with `AD_TUNING`;
the log is a local ring buffer of 500 outside the save, which the player can delete.
The player profile (`src/sim/player-profile.ts`, `docs/player-profile.md`) gains an ad reader:
offers shown, ads watched to the end, offers declined, over a rolling window, read as a watch rate.
As the research found, ad history can cap solicitation as easily as push it, so the reader only
lowers how often offers appear for a player who declines them (last 10 offers over 14 days, gap steps of
30 minutes to 4 hours, a watch never shortens a gap) and never raises the cadence above the standard rate or
the cap of 4 in a rolling 24 hours. Every offer and watch is logged with the content fingerprint,
the tuning hash and the timer setting, so `playtests` can compare variants on real people.
`profile-surface` shows the ad line with the one thing it changes. A dev ad provider stands in for
AdMob (`@capacitor-community/admob`, non-personalized by default, the UMP consent form on the first Watch
tap) until `store-wrap`. Also: confirm whether a live call pauses desk time, expose a runtime content
fingerprint, give the offer row a consent-pending state, and show the real before and after. Done: the reader and its effect tested, the `ad-history-blind` probe
proving ad history never moves odds, draws or pressure, the offer surface at 390 and 320, and the
log fields present on every event.

### onboarding: A first call that teaches the loop
Tags: job=command; journeys=answer-a-call; probes=none (teaching flow); lane=deferred
Needs: start=none; integrate=none; ship=none

### familiarity-priorities: Team familiarity and a change-priorities action
Tags: job=build; journeys=none (no call uses either yet); probes=none (not wired); lane=deferred
Needs: start=none; integrate=none; ship=none

Neither is used by any call.

### playtests: Playtests and real-device checks
Tags: job=command; journeys=answer-a-call, save-round-trip; probes=none (testing); lane=deferred
Needs: start=none; integrate=none; ship=none

First-time players, and a real iOS and Android phone, including keyboard and text zoom. Includes
the rendered save-slot rejection message, never seen. From the hook-pattern research
(`docs/research/mobile-hook-patterns.md`): every session note records the content fingerprint, the
tuning hash, the timer setting and the profile readers in effect; variants compared in a round
differ in one setting and run through the Lab's existing controls; observations follow PLAN.md
criteria 12 and 14; a variant is dropped when testers can't explain an effect it introduced or it
produces a material issue under criterion 14. The revised patrol economy is read here too, alongside ad cadence and the offer's
shown worth against actual patrol funding, paid and unpaid progression with identical service hours,
finite staffing capacity, sustainable payroll, and whether testers understand that boosts affect gross
patrol income rather than multiplying department net. The tap-to-idle metric is superseded.

### store-wrap: Package the game for the App Store and Play Store
Tags: job=keep; journeys=save-round-trip; probes=none (packaging); lane=deferred
Needs: start=none; integrate=none; ship=none

Owner decision 2026-10-19: wrap the web app for iOS and Android. Done: a wrapper chosen with
evidence (e.g. Capacitor), the build running on a real iPhone and Android phone with saves surviving
an app restart, and the safe-area, keyboard and text-zoom checks from `playtests` passing on device.
Also the release requirements R1 to R6 in `docs/monetization.md`, the App Tracking Transparency and privacy
label question, the U.S. state privacy path, and Google's rewarded ads policy (not yet read).

### real-purchases: The store sells real-money income multipliers
Tags: job=build; journeys=hire-and-equip; probes=funding-balance; lane=engine
Needs: start=patrol-boosts; integrate=store-destination; ship=store-wrap (App Store and Play Store billing)

Owner decisions: free to play with purchases; no development-point packs; sell income multipliers.
The 2026-10-22 NPC patrol revision supersedes the tap products and their value/stack assumptions.
Set product benefits against the tested patrol economy, preserving account-level entitlements and
store-provided prices. The persistent Store shows affected income, actual net delta, ownership and expiry;
billing goes through RevenueCat (`@revenuecat/purchases-capacitor`) behind an adapter whose only output is a
`VerifiedEntitlements` branded type, with Restore in the Store and in Settings. Resolve RevenueCat's receipt
validation and refund notifications before building. A purchase grants an entitlement
through the verified shared patrol boost grant path, only after
a receipt check, since the local save can be edited. Prices are the same for every player. The
`funding-balance` probe today checks only added funding (`src/architecture/wiring.ts`); it extends
to purchase status, so owning a multiplier never moves call odds. A dev store stands in for billing
until `store-wrap`. Done: each multiplier sold, granted, shown in HQ/Store and restored across a
reinstall on a real phone, with the probe extended, and entitlements reconciled from the account after
every save migration, import, restore and slot switch, never read from a save as proof of purchase (save
policy, owner 2026-10-23).

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

## Saves and live content

The owner's save policy of 2026-10-23 (Owner decisions below; `docs/scenario-framework.md` section 7a):
a growing catalog with frozen runs, promised from the store launch or the first real-money release.
Saves stay disposable until then, so none of these items holds up scenario work.

### frozen-runs: A started call finishes under the content and rules it started with
Tags: job=keep; journeys=save-round-trip, new:release-upgrade; probes=none (saves, not a chance input); lane=engine
Needs: start=none; integrate=none; ship=none

A run in progress is stored as an incident id and regenerated from current content, buildings and compiler at
load (`getScenario`, `src/sim/scenario-registry.ts`), and its debrief re-derives every committed decision with
current logic (`traceRun`, `src/sim/operation.ts`), so a release can change a call underneath a save. Done: on
dispatch the save keeps the compiled scenario, the map and an execution-contract version; committed effects are
stored as authoritative records and settlement reads them; a journey test saves a run mid-call, changes the
call's content and tuning in a fixture build, and the loaded run continues and settles exactly as it would have
unchanged, covering open decisions, dither minutes, the result screen and a completed but unsettled run.

### stable-content-ids: Everything a save names keeps a stable id
Tags: job=keep; journeys=save-round-trip; probes=none (saves, not a chance input); lane=engine
Needs: start=none; integrate=none; ship=none

Saves name items, courses, development nodes, building families, calls and situations, and validation rejects
a save whose references no longer resolve (`src/sim/save.ts`); the casebook keys a situation by its numeric
variant (`recipeKey`, `src/sim/casebook.ts`), so reordering situations would reinterpret history. Done: calls
and situations carry stable ids, the casebook and every history record use them, and a test lists every content
reference a save can hold and fails a content change that removes one without keeping it, mapping it to a
replacement or tombstoning it with defined behavior.

### save-migrations: The whole slot library migrates forward
Tags: job=keep; journeys=save-round-trip; probes=none (saves, not a chance input); lane=engine
Needs: start=none; integrate=frozen-runs, stable-content-ids; ship=none

Today a save loads only on the exact save and content version (`deserialize`, `src/sim/save.ts`). Done: one
forward-only pure migration per schema bump over the whole library (`src/sim/campaign-slots.ts`), dormant
slots, the deleted slot and imports included; golden libraries captured from every shipped build from the
switch point on; tests for skipped upgrades, an interrupted write and continuing a frozen run after migration.
The capture script is a tooling request.

### save-generations: Saves are written crash-safe and recover from a good generation
Tags: job=keep; journeys=save-round-trip; probes=none (saves, not a chance input); lane=engine
Needs: start=none; integrate=save-migrations; ship=none

One library entry holds all ten slots, and a recovery copy exists only on the older session path
(`src/sim/session.ts`). Done: each write lands as a new generation, is verified to load, then advances the
pointer; the last three good generations are kept past the first autosave; a quota failure keeps the old
generation and tells the player; restoring a generation runs the migrations; tests cover an interrupted write,
full storage and a semantically broken migration recovered from an older generation. The writer in
`src/ui/store.ts` is an interface request.

### no-downgrade-overwrite: An older build never overwrites a newer save
Tags: job=keep; journeys=save-round-trip; probes=none (saves, not a chance input); lane=engine
Needs: start=none; integrate=none; ship=none

The stale-shell risk `offline-shell` names, on every writer: the slot library, the session recovery path and
the UI store. Done: a test where each writer meets a library from a newer build leaves its bytes untouched,
and the player sees one line saying to update.

### withdrawn-content: Content pulled for safety settles honestly
Tags: job=keep; journeys=save-round-trip; probes=none (saves, not a chance input); lane=engine
Needs: start=none; integrate=frozen-runs; ship=none

Frozen runs finish on the content they started with, except a revision withdrawn for safety. Done: a withdrawn
revision gets a targeted migration or an interruption settlement that accounts for committed harm, consumed
items, reservations, rewards and thread facts, never a fabricated ending; a fixture test withdraws a revision
under a saved run and checks each.

### durable-save-storage: Saves survive the device's own storage cleanup
Tags: job=keep; journeys=save-round-trip; probes=none (packaging); lane=deferred
Needs: start=none; integrate=none; ship=store-wrap

The UI keeps the library in browser `localStorage` (`src/ui/store.ts`), and a second copy there dies with the
first if the WebView's storage is cleared. Done: durable native storage chosen with evidence alongside the
wrapper choice in `store-wrap`, a recovery path outside the WebView's storage, and both validated on a real
iPhone and Android phone through an app upgrade, storage pressure and a reinstall.

### save-policy-rehearsal: The save promise is rehearsed before it is made
Tags: job=keep; journeys=save-round-trip; probes=none (release process); lane=lead
Needs: start=save-migrations; integrate=none; ship=save-generations, no-downgrade-overwrite, durable-save-storage

The promise starts at the earliest of the store launch or the first real-money release. Done: from the first
build after `save-migrations` ships, each prelaunch build upgrades the previous build's golden library on the
chosen wrapper, and an upgrade and a recovery shown on a real phone are recorded as a launch gate before
`store-wrap` or `real-purchases` ships. External playtests are told saves may reset.

## Owner decisions

- **Death endings:** a human read of Going Live's `manager_killed` and `manager_killed_rider_hurt`.
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
- **The older call-content questions above** (death endings, the 988 note, E12, the barricade family, the
  review line, the hostage review calls) predate the Going Live rebuild: the lead re-triages them after
  Going Live's prose lands, drops what the rebuild made moot, and brings the rest with drafts to read
  (owner, 2026-10-22).

Decided 2026-10-23 (live-content save policy, `docs/scenario-framework.md` section 7a): a campaign's
catalog grows with each release (new calls and chapters reach existing campaigns between calls), and a
started run is frozen: the save keeps its compiled call, map, execution-contract version and committed
effects, and it finishes under the contract it started with. Every content reference a save can name gets a
stable id, kept, mapped or tombstoned; content withdrawn for safety gets a targeted migration or an explicit
interruption settlement; the whole slot library migrates forward with golden saves, generational crash-safe
writes and no downgrade overwrites; durable native storage comes with `store-wrap`; purchases reconcile from
the account, never from a save. The promise starts at the earliest of the store launch or the first
real-money release, rehearsed on prelaunch builds first, with a demonstrated upgrade and recovery as a launch
gate. Until then saves stay disposable.

Decided 2026-10-22 (Going Live review): waiting it out is never charged in the debrief; endings show no
custody (no car, cell or station); epilogues speak only for people on scene, never an institution off screen;
a held person is offered the phone and decides, never asked to perform a concession; Going Live's line a player
repeats is the manager's "your hands are shaking. There's water in the cooler by me." These settle the custody
(O4) and E12 concession questions for every call.

Superseded by the NPC patrol revision in `docs/patrol-work.md` (historical owner answers, 2026-10-22): option B for paid-detail strain; a multiplier
gives no strain advantage, so each tap's strain scales with the combined multiplier and pay per strain is
constant (the multiplier saves taps); entitlements per account; the ad's x1.5 for 10 minutes ships and
playtests judge its size; the first room scales with multipliers; an offer that would pay nothing is not
shown; no server analytics; AdMob alone and non-personalized at launch, personalized ads later as an opt-in
with ATT and UMP work; prices $2.99 and $4.99; the tab plate stays 96px on all four tabs and the reading
face stays the sans (`owner-visual-picks`); the live strip keeps 2 chat lines; the board hook shows in full, no 3-line clamp; `worn-kit` approved;
Going Live's prose passes start.

Decided 2026-10-22 (Going Live): the rebuild (`going-live-spine`) must let every balance style reach
the turn in at least 50% of drawn calls.

Decided 2026-10-22 (monetization): watching an ad is rewarded, and the ad-watch rate is measured
and used as `docs/research/mobile-hook-patterns.md` describes (`rewarded-ads`); real-money income
multipliers are sold in the store (`real-purchases`). The design note is `docs/monetization.md`.

Decided 2026-10-19: scenario work is paused (the barricade is parked on its branch); a squad can
deploy short of injured officers (`short-squad-deploys`); sidearms from day one
(`sidearms-day-one`, shipped, then superseded on 2026-10-21 by basic kit: see below); keep the compiled fingerprints and the cross-engine check; a call resolved
with harm counts as resolved (already so in `dispositionOf`); an entry breaks every open commitment
(already so in `src/sim/commitments.ts`); build the Peer Support Lead, the Recruiter and patrol work;
the crisis cap stays report-only until playtests.

Decided 2026-10-19 (scenario depth): scenario work resumes as the depth program above; the board
hook clamps at 3 lines (replaced 2026-10-22: the hook shows in full); text gets new surfaces (transcript, epilogue) rather than larger budgets
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
Decided 2026-10-21 (UI and taps): build the Desk and Street redesign (`docs/ui-ux-audit.md`) in
phases by parallel sessions, kept local; taps pay $1 each as paid details that strain only free
officers of a squad on patrol, stopping at stress 30, labeled "Work paid details", with
multipliers designed in and empty; the stall habit lifts the starting pressure of later calls only
on the Standard timer, never on Off or Relaxed.
Decided 2026-10-20 (content rating): the six descriptors in `docs/content-rating.md` stand as
written; the call-card warning defaults to on; the timer keeps Off, Relaxed and Standard; the
warning and 988 line wording is drafted for the owner's review, and nothing ships before approval.
Later that day, after research against Xbox Accessibility Guideline 123, the owner dropped the
content tiers and the death, injury and gunfire toggles: those three are warnings only, and players
avoid themes (self-harm, child at risk, domestic violence) instead, so the board never empties.
Decided 2026-10-21 (basic kit): every officer carries a radio headset, a service sidearm, a carbine
and light body armor as part of the officer (`src/sim/basic-kit.ts`): no certification, no unlock,
no stock, no wear, no shortage and no score bonus. Bonuses and progression sit on advanced gear: the
Protective response program unlocks the response shotgun only (+6 in tight spaces, +3 in the open),
the precision rifle and less-lethal tiers stand, and `entry_team` gates entry training, not carrying
a weapon. Deploys never wait on radios. The department's starting dice and ids are unchanged.
Less-lethal first: when a trained officer carries a less-lethal tool with its supply, the person is
in range and nothing rules it out, the team uses it even on a deadly threat, and the firearm is the
fallback (`teamForceProfile` in `src/sim/drawn-effects.ts`).
