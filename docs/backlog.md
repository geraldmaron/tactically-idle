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

### worn-kit: Light body armor protects the officer who wears it
Tags: job=build; journeys=team-moves-odds; probes=none (changes harm severity, not a chance input); lane=engine
Needs: start=none (owner approves this proposal); integrate=none; ship=none

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

### ops-experience-now: Put the right thing first on the board, Prepare, review and result
Tags: job=command; journeys=answer-a-call; probes=none (layout); lane=interface
Needs: start=none; integrate=none; ship=none

From `docs/ops-experience.md` (accepted with controls). Done: the result beat opens on the result
under the strip, tells each thing once and folds the scene below it. Open: the review
sheet reads cost and the three previews before the map, keeping every control; the brief opens on
the orders and the threat with the cold open whole and a Map chip in the header; Team & gear shows
each squad's kit as an inspectable summary over today's workspace; the board card drops to about
290px with the hook, warning, fitness, pay and expiry kept, and a type mark that isn't a padlock.
Done when the captures in the doc are retaken from the game at 390x844 and 320x568, with 200% text,
two squads and a Lab check of the shared screens.

### ops-experience-compare: The owner judges the reading serif
Tags: job=command; journeys=answer-a-call; probes=none (layout); lane=interface
Needs: start=none; integrate=none; ship=none

The decide-beat layout is settled (4B, refined, 2026-10-21). The serif is still behind the dev
switch (`src/ui/settings/candidates.ts`). The owner compares it as `docs/ops-experience.md` says
("The reading face: still open"). Then ship the winner, delete the loser's rule from
`candidates.css` and remove the switch.

### ui-system: One visual system under every screen
Tags: job=command; journeys=answer-a-call, hire-and-equip; probes=none (layout and type); lane=interface
Needs: start=none; integrate=none; ship=none

Tokens for type (12/14/16/18/22/28), space (4 to 32) and colour roles, one primitive set (Button,
Chip, Card, Row, Sheet, ActionBar), the duplicate definitions in app.css and skin.css removed,
hex moved to tokens, and the Desk and Street skin applied through them, story text staying in
Barlow until ops-experience-compare is settled (docs/ui-ux-audit.md). Done: tests fail on new
decision text under 14px, interactive elements under 44px and hex outside the theme; captures
retaken at 390, 320 and 430 with the audit's tool, compared with its probe numbers.

### chrome-contract: One chrome contract for desk screens, flows and the live call
Tags: job=command; journeys=answer-a-call, save-round-trip; probes=none (layout); lane=interface
Needs: start=ui-system; integrate=none; ship=none

A 44px resource bar in words and per-hour rates; no banner on tab roots; flows with a head, back
and one action bar and no tabs; one Menu sheet for the campaign, settings and support. Every row
of the audit's exit table holds: the Prepare draft survives Back and detours, the debrief settles
before it is left. Step out comes last, with a pause owned by navigation and not by page
visibility. Done: no primary button is covered at any width; the review body at 320x568 is at
least 248px; background, reload and a long wait while stepped out resume the same beat with
elapsed time kept.

### calls-say-once: Each fact once on every step of a call
Tags: job=command; journeys=answer-a-call, debrief-explains; probes=none (layout); lane=interface
Needs: start=chrome-contract; integrate=none; ship=none

The say-it-once ledger by field and the verb ladder in docs/ui-ux-audit.md applied to the board,
brief, deploy, decide, review, result and debrief, with the squad named one way, designed against
today's pooled equipment. Folds in ops-experience-now, which is deleted when this ships. Done: for
every ledger field the keeping field is present and the repeats are gone, and the distinct fields
(time range, per-choice exposure, completion, projected income) are present, in the game and the
Lab, with two squads on a call.

### four-tabs: HQ, Calls, Officers and Build
Tags: job=build; journeys=hire-and-equip, officer-promotes; probes=none (navigation); lane=interface
Needs: start=chrome-contract (after basic kit reaches main and the owner validates the merge); integrate=none; ship=squad-preset-editor

Officers holds Squads, Roster, Hire and Training; Build holds Upgrades and the Armory; HQ's
cutaway shows state and stops repeating the tabs, keeping the Watch Commander opt-out on each duty
row and the shift report reopenable; assignment has one path; badges open the segment they are
about. Done: the e2e script reaches every former screen; hire-and-equip passes; the nav round
trips return; captures at three widths.

### tap-multiplier-content: Upgrades, power-ups and purchases that raise desk tap pay
Tags: job=build; journeys=hire-and-equip; probes=none (department income, not call odds); lane=deferred
Needs: start=real-purchases (for entitlements only); integrate=none; ship=none

Tap to earn shipped 2026-10-21 with the base multiplier only (`TAP_MULTIPLIERS` in
`src/sim/department-taps.ts`): upgrades, timed power-ups and entitlements share one grant path,
kinds multiply and bonuses of one kind add. Add development-tree desk upgrades granted on
purchase, timed power-ups with a way to earn them, and store entitlements through
`grantEntitlement` once `real-purchases` decides what is sold. Entitlements need receipt checks
before granting, since the local save can be edited. Show the combined multiplier and any running
power-up near the desk, and decide whether owned upgrades pick up a later rebalance. Done: each
kind has at least one entry, a test proves it raises tap pay, and the player can see what is active.

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
- **What purchases sell** now that development points and point packs are gone (`real-purchases`).

Decided 2026-10-19: scenario work is paused (the barricade is parked on its branch); a squad can
deploy short of injured officers (`short-squad-deploys`); sidearms from day one
(`sidearms-day-one`, shipped, then superseded on 2026-10-21 by basic kit: see below); keep the compiled fingerprints and the cross-engine check; a call resolved
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
Decided 2026-10-21 (basic kit): every officer carries a radio headset, a service sidearm, a carbine
and light body armor as part of the officer (`src/sim/basic-kit.ts`): no certification, no unlock,
no stock, no wear, no shortage and no score bonus. Bonuses and progression sit on advanced gear: the
Protective response program unlocks the response shotgun only (+6 in tight spaces, +3 in the open),
the precision rifle and less-lethal tiers stand, and `entry_team` gates entry training, not carrying
a weapon. Deploys never wait on radios. The department's starting dice and ids are unchanged.
Less-lethal first: when a trained officer carries a less-lethal tool with its supply, the person is
in range and nothing rules it out, the team uses it even on a deadly threat, and the firearm is the
fallback (`teamForceProfile` in `src/sim/drawn-effects.ts`).
