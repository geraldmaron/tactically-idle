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

### gear-by-action: Gear moves the odds on most choices
Tags: job=build; journeys=team-moves-odds; probes=items-none; lane=engine
Needs: start=none; integrate=none; ship=none

Today carried gear moves 3 of 30 sampled opening choices (`items-none` probe, floor 0.1), because
bonuses apply only where a choice declares them. Done: equipment applies by what the choice
physically does, read from the fields a choice already has (`team`, `walks`, `talksTo`, `check`,
`equipment`, `capabilities`) rather than a second vocabulary, and the floor rises.

### intel-odds: What the team learns changes the odds
Tags: job=command; journeys=chance-not-script, team-moves-odds; probes=subject-armament, new:intel-confirmed; lane=engine
Needs: start=none; integrate=none; ship=none

Team moves settle what the squad sees (`src/sim/sightings.ts`), but knowing barely matters: a
weapon counts the same reported or confirmed, so confirming one changes only the wording, and a
confirmed location moves no odds. A group member has no armament fact at all, so the odds read
their real weapon as known (hostage request R-G1, `src/sim/incident-factors.ts`,
`src/gen/incident/instance.ts`). Done: confirmed intel moves the favorable chance on the choices
it bears on, group members' weapons are beliefs like the subject's, call text can name a member's
weapon through a condition on it (R-G1's `TreeState.armed`, shown working in the hostage call), a
wiring probe measures it, and gathering intel is a real choice with a cost in time or exposure.

### offsite-fire: Gunfire from outside the building uses the incoming-fire model
Tags: job=command; journeys=chance-not-script; probes=none (adds a drawn harm result, not a favorable-chance input); lane=engine
Needs: start=none (the rescue design sheet states the request); integrate=none; ship=none

The rescue shooter is offsite (`src/content/call-trees/rescue-chair.ts`), instance compilation
leaves offsite people out of the incident (`src/gen/incident/instance.ts`), and incoming fire needs
an incident person with a threat profile (`src/sim/operation.ts`). Done: a threat outside the
building can fire on the team and on civilians through the drawn incoming-fire result, with its
sightline from the generated building.

### second-squad: A second squad can act
Tags: job=build; journeys=new:joint-operation; probes=none (squad count is not a probe input yet); lane=engine
Needs: start=barricade-model-first (its design sheet settles support choices or two acting squads); integrate=none; ship=barricade-model-first (a call authors the choices)

Every v13 choice puts one squad to work (`squadsPutToWork`), and evaluation always supplies one
acting squad (`src/sim/operation.ts`) though the engine has `maxActing`, `support` and
`minSquads`. Done: a call authors support or second-squad choices, `squadRange` reaches 2 or more
on at least one call, and a journey test plays it.

### camera-drone: A call that uses the camera drone
Tags: job=build; journeys=team-moves-odds; probes=none (covered by intel-confirmed once it exists); lane=engine
Needs: start=intel-odds; integrate=none; ship=none (a calls-lane tree authors the choice)

It's in the catalog (`src/content/items.ts`) and no call uses it. Done: a choice watches a room
through it, using the sightings step, and what it sees moves the odds through `intel-odds`.

## Next: calls and the incident model

### barricade-model-first: Write the barricade call model-first
Tags: job=command; journeys=answer-a-call, choices-branch; probes=blueprint-building, blueprint-locked; lane=calls
Needs: start=none; integrate=gear-by-action, intel-odds; ship=none

As the hostage call was: template, design sheet in `docs/calls/`, tree, separate review. The old
tree has 2 `team` moves out of about 37 choices (armed 13, hostage 8, rescue 8), and a different
building changes 6 of 33 opening choices (`blueprint-building`, floor 0.18). Done: the new call
makes physical moves through the building, both blueprint floors rise, `npm run check:strings`
passes on it, it passes coverage, balance and the separate review, and the old
`barricade-order` tree is retired. The design sheet lists its engine requests before any tree
data is written.

### rescue-model-first: Write the rescue call model-first
Tags: job=command; journeys=answer-a-call, choices-branch; probes=blueprint-building; lane=calls
Needs: start=none; integrate=offsite-fire; ship=none

Same pipeline as the barricade. Done: rescue gunfire comes from the drawn incoming-fire result,
not harm authored per branch; `npm run check:strings` passes on it; it passes coverage, balance
and review; and the old `rescue-chair` tree is retired.

### armed-model-first: Write the armed-incident call model-first
Tags: job=command; journeys=answer-a-call, choices-branch; probes=subject-armament; lane=calls
Needs: start=barricade-model-first; integrate=gear-by-action, intel-odds; ship=none

Same pipeline. Done: `npm run check:strings` passes on it, it passes coverage, balance and review,
and the old `armed-noise` tree is retired.

### complications: Complication modules
Tags: job=command; journeys=choices-branch; probes=none (modules change situations, not a probe input); lane=calls
Needs: start=barricade-model-first; integrate=none; ship=none

Child, dog, second subject, medical bystander, crowd, power out, reinforced door, intoxication.
Every template has `complications: []` today. Each module that needs a new person or state goes to
the engine lane as a request first.

### hostage-engine-requests: Hostage engine requests
Tags: job=command; journeys=answer-a-call; probes=none (text and routing, not odds); lane=engine
Needs: start=none; integrate=none; ship=none

Filed in `docs/calls/hostage-signature-design.md`: R-G2 a group role the player meets, R-G3 with
N15 and N16 count-conditioned briefing lines and ending addenda, and R-G4 `onOut.next`. R-G1 is
in `intel-odds`; N6, N7, N9 and N21 are in `hostage-gate-requests`. Done: each request works in
the hostage call and the call's fingerprints are recaptured deliberately.

### hostage-review-leftovers: Hostage review leftovers
Tags: job=command; journeys=answer-a-call; probes=none (prose and skill text); lane=calls
Needs: start=none; integrate=none; ship=none

The B9 owner-condition replay leak (waits on the owner's ruling), the NF3 to NF8 prose notes, and
the N8 and N20 skill budget fixes.

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

### board-risk-card: Board risk card
Tags: job=command; journeys=answer-a-call; probes=none (shows odds inputs, doesn't change them); lane=deferred
Needs: start=gear-by-action; integrate=none; ship=none

Suggested capabilities on the board before the player commits a squad. Needs a producer for risk
and recommendations; `src/sim/operation-selectors.ts` already derives briefing recommendations
from action equipment.

### meters-drift: Meters move with time
Tags: job=command; journeys=chance-not-script; probes=metric-pressure; lane=engine
Needs: start=none; integrate=none; ship=none

Time moves the meters, the `shots` event is written into content, and escalation comes by drift.

### less-lethal-cartridges: Less-lethal use spends cartridges
Tags: job=build; journeys=hire-and-equip; probes=none (inventory, not odds); lane=engine
Needs: start=gear-by-action; integrate=none; ship=none

## Gates and tooling

### e2e-script: Browser end-to-end script works again
Tags: job=command; journeys=answer-a-call; probes=none (tooling); lane=tooling
Needs: start=none; integrate=none; ship=none

`scripts/play-loop.mjs` (`npm run test:e2e`) still expects standing assignments and a two-squad
deployment, which no longer exist. Done: it plays one tactical call through the real UI at
390x844 and 320x568.

### lab-compare: Lab compare view
Tags: job=understand; journeys=team-moves-odds; probes=none (tooling); lane=tooling
Needs: start=none; integrate=none; ship=none

Per-choice odds deltas for the same call under two instances.

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

### small-screen-map: Small-screen map
Tags: job=command; journeys=answer-a-call; probes=none (layout); lane=interface
Needs: start=none; integrate=none; ship=none

Rooms under 44px on the 320px map, and long footprints that render small.

### hq-tiles: HQ stat tiles
Tags: job=return; journeys=none (HQ display, no journey covers it); probes=none (display); lane=interface
Needs: start=none; integrate=none; ship=none

Icon tiles with mini bars.

### manager-art: Manager portraits and emblems
Tags: job=build; journeys=none (art); probes=none (art); lane=interface
Needs: start=none; integrate=none; ship=none

Watch Commander, Quartermaster and Training Sergeant portraits, and course and branch emblems,
passing `npm run check:art`.

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
