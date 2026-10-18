# Call design sheet: Not Fireworks (protected_rescue, model-first)

Written through swat-call-design for the calls lane, 2026-10-18, before any tree data exists. It
replaces `src/content/call-trees/rescue-chair.ts` ("My Chair Comes Too") as a fresh call, not a
conversion. Sample lines are placeholders for swat-call-prose. Private logic, hidden truth and the
closing fact are marked NEVER PRINTED. Rows the tree has to prove are marked "not run: no tree
yet". The barricade sheet's Codex review taught four lessons this sheet applies from the start:
every turn option has a charged cost and an exclusive payoff, clock expiry routing is a blocking
dependency, threat and authority marks are set only by text that shows them, and nothing public
differs by situation.

## A. Lane and version

- Lane: call tree (v13). The calls lane owns the new `CallTree`
  (`src/content/call-trees/rescue-fireworks.ts`, name to confirm) and the rewritten
  `IncidentTemplate` (`src/content/incidents/rescue.ts`). `call-trees/types.ts`,
  `incidents/types.ts`, `src/gen/` and `src/sim/` are engine files, so every new field is a request.
- Version: `CALL_TREE_CONTENT_VERSION` 13, read 2026-10-18. Fingerprints are the lead's to
  recapture when the old tree retires.
- Type id `protected_rescue`. Families: the seven houses the old tree uses (`cedar_close`,
  `willow_terrace_v1`, `ash_grove_v1`, `juniper_court_v1`, `bungalow_g2`, `two_storey_house_g2`,
  `semi_detached_g2`); the crossing needs a porch, a yard and a street.
- Contract read from source this pass: `call-trees/types.ts`, `incidents/types.ts` (Clock,
  template, `timeOfDay`), `content/incidents/rescue.ts`, `rescue-chair.ts`, `trees-v13/compile.ts`
  (placement, `movement()`, the `fire` compile at 653 to 663), `gen/incident/instance.ts`
  (`incidentPeopleFor`, offsite positions), `sim/drawn-effects.ts` (`incomingFireOdds`, `drawPlan`),
  `sim/sightlines.ts` (`sightFromStreet`, `StreetVantage`), `story-bindings.ts` (`findStoryRoute`).
  Not re-read: `sim/clocks.ts`, `sim/authorization.ts`, `sim/outcome-score.ts`.

## B. Premise

```
Call type borrowed:  a protected rescue: people pinned in a house by gunfire from across the street
Person:              the father (drawn name, elderly), who sits at his front window every evening
                     and wants to watch "the fireworks"
Wrong note:          the 911 caller is his adult child, whispering from the kitchen, who says he
                     keeps opening the curtains to see the fireworks
Worse if they wait:  the father keeps going back to the front window and the front door to look
                     (a clock the team hears through the phone); the shooter's window faces it
Why a tactical team: armed "Patrol heard shots from the upstairs window of the house across the
                     street" (fact claim); threat "A parked car on this side was hit twice"
                     (dispatch, sourced to patrol); advantage "The front door and the father's
                     window both face that house" (known line, and the map); refusal: the
                     father "won't leave without his walker, and it is out on the porch"
                     (the turn, not the call-out: the shooter's refusal is another unit's, below)
Self-harm risk:      none for anyone the team deals with. The shooter is another unit's; the team
                     never talks to or acts on them (E4 screened, reason in row M)
Private logic:       the father fixed the porch light on this street for forty years and watches
                     the street every evening because his wife used to come home along it. Leaving
                     by the back is leaving the way you leave a house for good. NEVER PRINTED as
                     an explanation
Iceberg tip:         "she always came home from that end of the street", said by the father in
                     crossing.carer_leads favorable, reached only through the walker turn
Closing fact:        why the person across the street is firing is never settled. NEVER PRINTED
```

Why this premise. The old call made the danger a fixed truth per situation (whether the shooter
can see the front door) and the harm authored per branch (20 authored `harm` effects, 0 `fire`).
This one makes the shooter's window and the house's doors the whole problem: which way out the
building has, what the shooter's window sees of it, and how long a frail man is in the open on
each route. With `offsite-fire` the gunfire is the drawn incoming-fire result from that window,
not a sentence per branch.

## C. Person cards

| Person | Wants, in their words | Fears | Behavioral reads | Memory anchor | How they know | Pronouns |
|---|---|---|---|---|---|---|
| father (`{father}`, civilian, elderly, trapped, front room) | "Let me see them go up." | being moved out of his own house by strangers | goes to the front window when he hears a shot; puts his hand on the front door; answers to his child's voice, not to a stranger's; won't walk without the walker | the porch light he fixed (on or off is a choice) | lived there forty years | drawn |
| carer (`{carer}`, civilian, the father's adult child, kitchen) | "Tell me how to get him out without him seeing." | the father walking out the front door | whispers on the phone; can go out the back alone and won't; knows which door sticks | the father's walker, left on the porch this afternoon | lives there; called 911 | drawn |
| shooter (`{shooter}`, subject, offsite) | never met | never met | fires from an upstairs window across the street when something moves in its view | none | another unit's, contained by patrol | drawn, rarely named |

The carer is a civilian inside, not a bystander, so they can be brought out and they can be hurt.
They are the team's voice into the house: the team never talks to the shooter, and no family
member at the tape carries anything (E12.3: there is no family at the tape).

Hook person in stage 3: the father opens the hook and is the stake in every stage 3 node; the
carer is the second life in every ending's first sentence.

Geography. Advantage line, quoted once: the front door and the father's window both face the
house across the street. Roles against it:

| Role | Position | In the shooter's view? | Cost in text |
|---|---|---|---|
| negotiator ({lead}) | the carer's phone, from the cars | no | none |
| team at the back door (`back_way`) | vantage on the kitchen, through the side yard | depends on the building: the gap between houses (R-R3) | "the side yard is open to the street for a few steps" |
| team at the front (`front_screen`, `porch_run`) | the porch | yes when the sightline holds | "on the porch, in full view of that window" |
| rescue vehicle (`front_screen`) | the curb, between the window and the door | it is the cover | "the vehicle draws {shooter.his} eye while it parks" |
| medic | behind the cars | no | none |
| patrol and the other unit | the shooter's house | n/a | none |

## D. Hook

Placeholder: "{father.first} thinks the shots are fireworks. Every time one goes off, he goes back
to the front window to watch."

About 100 characters bound with a 9-letter first name; the prose lane measures the 2-line board
clamp. Tests by read: name at word 1; sentence 1 the wrong note; sentence 2 what gets worse; one gap
(will he go before he opens that door?); no disclaimer; "shots" is a plain danger word; one name.
Pronoun tokens, never "he", in the shipped line.

## E. The ninety seconds

- Card: title "Not Fireworks", hook, pressure label "{father.first} at the window".
- Briefing: dispatch 2 sentences, known 3, unknown 1, responsibilities 2. Over the skill's
  4-plus-1 figure the same way the hostage and barricade calls are; recorded.
  - known[0] the turn fact: "{carer.first} says {father.first} won’t take a step without the
    walker." (the walker is on the porch: the turn reveals where)
  - known[1] the shots, sourced to patrol.
  - known[2] the advantage line.
  - unknown: whether the shooter's window sees the front door.
- Taps, designed: stage 1 one, stage 2 one, stage 3 one on the common path (a favorable
  crossing), two when the porch clock or a shot intervenes. Longest designed stage 3 chain:
  crossing > porch > pinned > crossing (4). Walked at tree time.

## F. Stage table

| Stage | Node | New fact on arrival | Options (what each protects / costs) | Waiting costs | Lever |
|---|---|---|---|---|---|
| 1 approach | `front_window` | shots from across the street; the father at the window | call the carer and get the father away from the window (phone; the carer crosses the front room) · send the team round to the back door (vantage on the kitchen through the side yard; leaves the front unwatched) · park the rescue vehicle at the curb (screen between the window and the door; draws the shooter's eye while it moves) | porch clock | phone, team vantage, vehicle cover (R-R4), drawn fire (R-R1) |
| 2 turn | `turn_walker` · `turn_gate` · `turn_light` (drawn) | the walker on the porch · the back gate chained · the porch light on | per turn, a move against a question (below) | porch clock | turn group, marks |
| 3 commit | `crossing` | everyone ready, as far as they will be | out the front behind the vehicle (escort, front route, only once screened) · out the back (escort, back route, R-R5; offered only where the house has a second door) · let the carer lead the father out (the father walks with his child; both in the open longer) · hold until the other unit has the shooter (All night) | porch clock; the carer's nerve | escort routes, fire, clock fork |
| 3 | `porch` | the clock ran out: the father is on the porch | talk him back in through the carer (phone) · run to him with a shield (team to the porch) · bring the vehicle up to the steps (cover) | the father in the open | fire on a civilian (R-R2), cover |
| 3 | `pinned` | shots at the team on the route | hold where you are in cover and wait · pull everyone back inside · push on to the cars | the people in the open | fire, cover |

No force and no entry choices exist: the shooter is another unit's, and nobody the team meets is a
threat to them (E12.5 trivially; row M).

Stage 2 turns, each a move against a question, with charged costs and exclusive payoffs:

| Turn | Prompt fact | Move option (payoff / cost) | Question option (payoff / cost) | What it reprices |
|---|---|---|---|---|
| `turn_walker` | the walker is on the porch, in view of the window | fetch the walker (team to the porch vantage): `walker_in`, the father walks on his own / 2 minutes on the porch in view; drawn fire where the sightline holds | ask the carer to get him to lean on them (phone): `leaning`, no one on the porch / the father walks slower and the carer is beside him in the open (−6 on every crossing, both in the fire's reach) | the crossing's time in the open and who is in it |
| `turn_gate` | the back gate is chained; the side yard is the only way round | cut the chain (team to the gate; the entry tool or force time, the `blueprint-locked` door): `gate_open` / noise; on adverse the shooter hears and fires at the side yard if it is in view | ask the carer for the key (phone): `gate_key` on favorable, quiet / mixed and adverse cost minutes while the carer searches the kitchen, and the porch clock runs | the back route's time and noise |
| `turn_light` | the porch light is on; the porch is lit and the street is dark | have the carer switch it off (phone): `light_off`, the porch harder to see / the switch is by the front door, so the carer stands in view of that window for a moment; the father goes to the window when the light changes | leave it on and use the dark yard (no move): `light_on`, the shooter's eye stays on the lit porch, not the side yard / the front route stays lit (−8 on out_front) | front against back |

Dominance grid, stages 1 to 3 (designed directions; balance measures them):

| Option | Odds | Minutes | Who pays on adverse | Charged by | Cost the player sees | Payoff only it produces |
|---|---|---|---|---|---|---|
| 1 call the carer | mid (TALK) | 3 | the carer (crosses the front room) | `front_window.call.adverse` drawn fire at the carer (R-R2) | "{carer.first} has to cross the front room to reach {father.first}" | the father away from the window, which slows the porch clock |
| 1 team to the back door | mid (MOVE) | 5 | the team (the side yard, where it is in view) | `front_window.back_way.adverse` drawn fire (R-R1, R-R3) | "the side yard is open to the street for a few steps" | the back route scouted; the squad already at the back |
| 1 park the vehicle | mid (DRIVE, cert) | 4 | the driver | `front_window.screen.adverse` drawn fire at the vehicle | "the vehicle draws {shooter.his} eye while it parks" | `screened`, the front route's cover |
| 2 fetch the walker | mid | 2 | the team on the porch | drawn fire | "on the porch, in full view of that window" | the father walking on his own |
| 2 lean on the carer | best | 1 | the carer, beside him | −6 on crossings, both in the open | "{carer.first} has to walk out beside {father.first}" | nobody on the porch now |
| 2 cut the chain | mid | 3 | the team (noise) | drawn fire at the side yard | "the chain is loud in a quiet yard" | the gate open whatever the carer finds |
| 2 ask for the key | mid | 4 | the father (the clock runs) | `minutes` on mixed and adverse | "{carer.first} has to search the kitchen drawers" | a quiet back route |
| 2 switch the light off | mid | 2 | the carer (by the front door) | drawn fire at the carer | "the switch is by the front door" | the front route darker |
| 2 leave it on | best | 0 | the front route | −8 on out_front | "the porch stays lit" | the shooter's eye kept off the side yard |
| 3 out the front, screened | mid to good | 3 | everyone crossing | drawn fire at the father, the carer and the team, with the vehicle as cover | "a few steps of open porch before the vehicle" | the shortest time in the open; the father leaves his way |
| 3 out the back | mid | 6 | everyone in the side yard | drawn fire where the gap is in view (R-R3) | "the long way round, and the father hates it" | no exposure on buildings where the gap is hidden |
| 3 the carer leads | mid | 5 | the carer and the father together | drawn fire at both | "both of them in the open, walking at his pace" | the father goes without being held (the iceberg tip) |
| 3 hold all night | best (HOLD) | All night | the father, if the porch clock runs out | clock fork | "{father.first} spends every hour of it near that window" | no one in the open tonight |

Minutes rule (E2) has nothing to price here: no force or entry exists. The fast options (cross now)
are priced by drawn fire, which is what `offsite-fire` makes real.

## G. Turn

Planted in known[0] (the walker) and in `front_window.call` (the carer as the team's voice).
Revealed in the drawn turn node's prompt. Reprices stage 1: the back-door scout is wasted if the
gate is chained and no tool is carried; the vehicle is wasted if the walker turn sends the father
round the back anyway.

## H. Consequences

Gunfire, model-first (the point of `offsite-fire`). An outcome that puts someone in the
shooter's view carries `fire: { from: 'shooter', at: <role or 'team'> }` (R-R1, R-R2). The engine
draws whether anyone is hit from the shooter's weapon and proficiency, the distance from the
window to where the target stands, the sightline from the window to that place on the generated
building, and any cover on the line (R-R3, R-R4). Text never narrates a hit; the standard line
does. Authored `harm` on this call: 0 by design. A hit routes by `fire.next`
(R-R2: `{ none, wounded, serious }`, the same shape as `force.next`): a civilian hit in the open
goes to a hurt ending; a hit on the team goes to `pinned`.

The porch clock (owner `father`, kind `deadline`, start 60, rate 1.2 a minute, spread 0.3, rate
unknown). Cue at 40, about 17 minutes in: "{carer.first} whispers that {father.first} has the front
door unlocked." (mark `door_unlocked`). Runs out at about 38 to 72 minutes. `call` favorable moves him away from the
window (mark `away_from_window`) and should slow the clock; that needs R-R6, and without it the
effect is cut rather than narrated.

Clock routing: `clock-runout-routing` (R-G4) is blocking for this tree, as for the barricade. With
it, `onOut: { mark: 'on_porch', next: { node: 'porch' } }`. Precedence: an outcome that ends the
call stands; an outcome that made the father safe stopped the clock; otherwise the call moves to
`porch` after the outcome's text.

Marks and readers:

| Mark | Set by | Read by |
|---|---|---|
| `door_unlocked` | clock cue | `crossing.promptIf` |
| `away_from_window` | `call` favorable | clock rate (R-R6), `crossing.promptIf` |
| `screened` | `screen` favorable and mixed | `out_front` onlyIf, `porch.vehicle` onlyIf |
| `walker_in` | `turn_walker.fetch` | crossing modifiers (+6), `carer_leads` text |
| `leaning` | `turn_walker.lean` | crossing modifiers (−6) |
| `gate_open`, `gate_key` | `turn_gate` | `out_back` onlyIf (either), modifier (+4 key, quiet) |
| `light_off`, `light_on` | `turn_light` | `out_front` modifier (+6 / −8) |
| `on_porch` | clock onOut | `porch.prompt`, held endings |
| `back_scouted` | `back_way` favorable | `out_back` travel (the squad is already there), modifier (+4) |

Situation leaks: none public by design. Every situation shows the same card, briefing, clock label
and demand. Building truths (what the window sees) differ by building, not by situation.

## I. Endings

| Ending | Disposition | Each person's state | remainingTasks |
|---|---|---|---|
| `both_out_front` | resolved | father and carer out the front, unhurt | none |
| `both_out_back` | resolved | out the back way, unhurt | none |
| `walked_out_together` | resolved | the father walked out with his child, unhurt | none |
| `out_by_morning` | resolved | out after the other unit ended it | none |
| `out_hurt` | resolved | out; the person the fire hit with the medic (father or carer, from the drawn result) | none |
| `officer_hurt_out` | resolved | both out; an officer hit, with the medic | none |
| `carer_out_father_in` | relief_partial | carer out; father inside | bring {father.first} out |
| `both_inside` | relief_partial | both inside, away from the window | bring both out |
| `hurt_on_porch` | relief_partial | the father hit on the porch and brought in, the medic waiting | get {father.first} to the medic |
| `handed_over` | unresolved | as last seen | everyone |

No death endings: incoming fire draws none, wounded or serious, and this call authors no `harm`.
The drawn-severity cap is a property of the incoming-fire model; if `offsite-fire` adds a fatal
severity for civilians, this table gains one ending and an E2.2 human read.

## J. Open loop

The walker stays on the porch, or comes in with them; the porch light is on or off as the team
left it; nobody on the call learns why the shots started.

## K. Levers

Drawn incoming fire from an offsite window (R-R1 to R-R3); a placed cover (R-R4); two exits per
building where they exist (R-R5); the porch clock with its rate (R-R6) and `onOut.next`
(`clock-runout-routing`); marks and modifiers. Pressure: start 24, 0.3 a minute, threshold 85
(minute 203), past every designed path but the all-night hold, which the debrief already charges;
it never stands in for the clock.

## L. Variant plan

| Axis | s1 | s2 | s3 |
|---|---|---|---|
| `goes_with_team` (the father walks with strangers leading) | true | false | false |
| porch clock rate | 1.2 ± 30% | same | 1.6 ± 30% (he keeps going back) |
| shooter's window along the street (`StreetVantage.alongFt`) | drawn per call: 0, 15 or 30 ft | same | same |
| shooter proficiency (drawn) | untrained 50, some 35, trained 15 | same | same |
| turn | walker / gate / light | same | same |

s3's faster clock is a situation difference the player can feel only through the cue's timing,
after the call starts; it reads like an ordinary spread at 30%, and the review checks it.

Building axes (independent of situation; what the `blueprint-building` probe should see):

| Axis | Today | With the request |
|---|---|---|
| whether the shooter's window sees the front door | yes: `TreeFact.sightline` settles it per building (`sightFromStreet`, `sightlines.ts:68`) | the same line also sets fire odds at that door (R-R3) |
| whether the side yard gap is in view | no: sightlines are computed to an opening only | R-R3 |
| whether a back door exists | the building has it or not (seed 1: `bungalow_g2` has one exterior door; `cedar_close`, `willow_terrace_v1`, `ash_grove_v1`, `juniper_court_v1`, `two_storey_house_g2`, `semi_detached_g2` have two), but every role gets one route, the shortest | R-R5 |
| the gate (a locked opening on the back route) | whatever the building generates; `blueprint-locked` locks it | same |

Probe plan, to measure at tree time: of `front_window`'s three choices, `back_way` (a vantage move
through the side yard) and `screen` (the vehicle's place at the curb) should respond to another
building; `call` should not. `blueprint-locked` should move the escorts and `turn_gate.cut`.

## M. Ethics screen

- E1 clear: no tactic named; "shots" and "firing" only, never a weapon noun (O1).
- E2 clear: no force exists; the best endings are both walking out unhurt; no civilian gesture
  defuses the shooter.
- E3 pending batch tally. Age (elderly) is a need, not a threat; no mechanic reads identity.
- E4 screened: nobody the team deals with shows weapon access plus a loss plus a refusal. The
  shooter's risk is real but they are another unit's; the call never shows their state beyond
  "patrol and the other unit hold that house", and no ending invents an outcome for them (E9 holds
  by silence; flagged for the reviewer).
- E5 n/a. E6 n/a (no entry). E7: hits go through the standard fire lines and the medic. E8
  composite. E10: the other unit is never an obstacle. E11: the shots are sourced to patrol; no
  ending says what happened across the street.
- E12.1: armed, threat and advantage quoted in row B. The fourth condition (refusal) is the
  shooter's, held by another unit; this team is called for the rescue, which is the protected
  rescue lane's premise. The open owner question E12 ("whether a team holding outside an active
  shooter fits the game") applies to this call too.
- E12.2 row C. E12.3: no family at the tape. E12.4: the clock never authorizes anything. E12.5: no
  force or entry options.
- Concessions: none.

## N. Officer slots

None reserved.

## O. Engineering requests

Blocking before tree data: `offsite-fire` (R-R1 to R-R3 below are its parts), and
`clock-runout-routing`. Needed for the building axes: R-R4, R-R5. Needed for the call's first
choice to do what its text says: R-R6. Each "current limit" was verified against the code on
2026-10-18.

```
Engineering request R-R1 (offsite-fire, the shooter on the plan)
Need:            the offsite shooter to be an incident person the incoming-fire model can draw from,
                 standing at their street vantage
Current limit:   incidentPeopleFor skips every person whose position is not inside
                 (gen/incident/instance.ts:239), so the shooter is not in scenario.incidentPeople;
                 drawPlan then finds no person and draws hit 0, serious 0
                 (sim/drawn-effects.ts:240-241). The vantage itself is already computed
                 (instance.ts:167, streetVantage)
Build links:     gen/incident/instance.ts incidentPeopleFor; sim/drawn-effects.ts drawPlan;
                 sim/incident-factors.ts (an offsite person should not seat on indoor work)
Proposed field:  IncidentPersonDef.offsite?: { at: Vec } (the vantage), with threat and weapon, kept
                 out of indoor threat seating; no tree field
Content version: v13
Blocks:          rows F, H (all gunfire)
Extends:         backlog offsite-fire
```

```
Engineering request R-R2 (offsite-fire, who the fire is at)
Need:            drawn fire at a civilian as well as at the team, and the call routed by what the
                 draw gives
Current limit:   compile.ts compiles `fire` into incoming_fire variants that carry officerHarm only
                 (compile.ts:659-663); a civilian can be hurt only by authored `harm`
                 (rescue-chair.ts has 20 harm effects and 0 fire). `fire` has no `next` by result
Build links:     content/call-trees/types.ts TreeOutcome.fire; compile.ts; sim/drawn-effects.ts;
                 content/incidents/lines.ts FIRE_LINES (a civilian line)
Proposed field:  fire: { from; at?: role | 'team' (default 'team'); mark?; next?: { none; wounded;
                 serious } } where `at` a role records personCasualties for that role on a hit and
                 uses a standard civilian line; default as today
Content version: v13
Blocks:          rows F, H, I (out_hurt, hurt_on_porch)
Extends:         backlog offsite-fire
```

```
Engineering request R-R3 (offsite-fire, the sightline sets the odds)
Need:            fire odds from the line between the shooter's window and where the target stands
                 on this building: the front door, the porch, the side yard gap, the curb
Current limit:   incomingFireOdds reads only the shooter's weapon, proficiency, their distance to
                 their own room's door and their cover (drawn-effects.ts:46-54), all indoor
                 quantities; sightFromStreet answers only whether a vantage sees one opening
                 (sightlines.ts:68), and only a TreeFact.sightline reads it
Build links:     sim/drawn-effects.ts incomingFireOdds; sim/sightlines.ts; the target's place
                 (the route leg or the vantage the choice uses, compile.ts movement)
Proposed field:  incoming fire from an offsite person: hit 0 when the line from the vantage to the
                 target's place is blocked (walls, neighbouring houses, outdoor blocks_sight),
                 scaled by range and by cover on the line; the target's place is the choice's
                 vantage, or for an escort the most exposed outdoor point on its route; no tree field
Content version: engine, a new INCOMING_FIRE version
Blocks:          rows F, L (building axes), the blueprint-building share
Extends:         backlog offsite-fire
```

```
Engineering request R-R4
Need:            the rescue vehicle as cover the team places: parked at the curb between the
                 shooter's window and the front door, it blocks or reduces fire on that line
Current limit:   TreeOutcome cannot place an object; cover comes only from generated furniture
                 between an indoor person and their door (instance.ts coverOnLine); the old tree's
                 vehicle choices change nothing physical (requires a cert, authored text only)
Build links:     content/call-trees/types.ts TreeOutcome; sim/operation.ts commit; R-R3's line test
Proposed field:  TreeOutcome.cover?: { between: role (offsite), and: role | 'scene', label } placing a
                 vehicle-sized blocks_sight object on that line at the curb; default absent
Content version: v13
Blocks:          row F (`screen`, `out_front`, `porch.vehicle`)
Extends:         new
```

```
Engineering request R-R5
Need:            an escort out a second door (the back) where the building has one, with the
                 choice offered only there
Current limit:   compile.ts builds one walking route per role, the shortest, through
                 findStoryRoute (compile.ts:386-397, story-bindings.ts:138); no choice can name a
                 different way out and no TreeState condition says a second exterior door exists.
                 Seed 1: bungalow_g2 has one exterior door, the other six families two
Build links:     content/call-trees/types.ts TreeChoice.walks and TreeState; compile.ts routes;
                 story-bindings.ts findStoryRoute
Proposed field:  TreeChoice.walksVia?: 'front' | 'back' (the exterior door nearest or farthest from
                 the arrival side), and TreeState.exits?: { role, min: number }; a walksVia 'back'
                 choice must carry onlyIf exits min 2; default absent
Content version: v13
Blocks:          row F (`out_back`), row L
Extends:         new; close to R-B2 (barricade window exit), and the two could share a field
```

```
Engineering request R-R6
Need:            an outcome that changes a clock's rate (the father moved away from the window
                 slows the porch clock)
Current limit:   Clock.ratePerMin is drawn once per call (incidents/types.ts Clock, rateSpread); no
                 TreeOutcome field reads or changes a clock
Build links:     content/call-trees/types.ts TreeOutcome; sim/clocks.ts
Proposed field:  TreeOutcome.clock?: { id; rate?: number (multiplier); add?: number }; default absent
Content version: v13
Blocks:          row F (`call`), row H
Extends:         new; not verified against sim/clocks.ts this pass (not re-read)
```

Reused: `clock-runout-routing` (blocking); O1 (weapon words: this call names no weapon); E12
(owner question on teams outside an active shooter).

## P. Call design record

```
Call design record
- Lane and version (row A): answered | call tree, v13, fingerprints recapture needed yes (the lead's)
- Contract read (row A): partial, clocks.ts, authorization.ts, outcome-score.ts not re-read
- Person and hook (rows B to D): the father wants to watch the fireworks; hook placeholder about
  100 chars; tests 1 to 8 by read; names 1; gap whether he goes before he opens the door
- Hook person in stage 3 (row C): yes, the father is the stake in every stage 3 node
- Memory anchor (rows C, I): the porch light; callbacks planned in 2 of 10 endings
- Call-out earned (row B): armed, threat and advantage quoted; refusal is the shooter's, held by
  another unit (E12 owner question)
- Self-harm risk (row B): none for the people the team deals with; E4 screened (row M)
- Iceberg tip (row B): "she always came home from that end of the street", crossing.carer_leads,
  through turn_walker
- People binding (row C): 3 roles (2 civilians inside, 1 offsite subject), no group
- Geography (row C): advantage line in row C; roles placed 6; in the shooter's view 3, each priced
- Briefing and taps (row E): 8 lines; turn fact in known[0]; taps 1/1/1 common, longest stage 3
  chain 4; not walked: no tree yet
- Dilemma per stage (row F): 1 voice vs scouting vs cover; 2 a move against a question per turn,
  each with a charged cost; 3 the short exposed route vs the long hidden one vs dignity vs time
- Dominance grid (row F): stages 1, 2 and 3 filled; phantom costs 0 by design (every cost is a
  drawn fire or a modifier on a named outcome); payoff column filled
- Action rows (row F): 5 nodes plus 3 turns, about 22 choices designed
- Force and entry gates (row F): 0 force or entry choices; E12.5 trivially clear
- Stage exits and context prompts (row F): not walked: no tree yet
- Turn (row G): planted in known[0], revealed in the drawn turn prompt, reprices stage 1
- Consequence matrix (row H): gunfire drawn, harm authored 0; per-cell matrix at prose time
- Flags set, readers (row H): 12 marks, 12 with a reader, dead 0 by design
- Objective (rows H, I): not set: no tree yet
- Effects (row H): TreeOutcome keys plus R-R2 fire.at and fire.next, R-R4 cover, R-R6 clock
- Services (rows H, I): none
- Ending reachability (row I): 10 endings designed; not walked
- Endings and loop (rows I, J): best: both walk out unhurt and the walker comes too; partial: who
  is inside named; loop: the walker, the porch light
- Lever and minutes (row K): porch clock out at about 38 to 72 minutes; pressure at minute 203
- Variants (row L): goes_with_team, clock rate, the window's place along the street, proficiency,
  turn; nothing public differs by situation
- Call-tree gates: not run: no tree yet
- Ethics screen (row M): E1, E2, E5 to E12 clear or n/a; E3 pending; E4 screened; E9 by silence
  flagged; E12 owner question applies
- Officer slots (row N): none
- Requests and owner decisions (row O): offsite-fire as R-R1 to R-R3; new R-R4, R-R5, R-R6;
  clock-runout-routing blocking
- Tells on hook and premise: checked by eye for dashes and colons; checker not run on placeholders
- Handoff: this sheet, then Codex adversarial review, then the lead, then swat-call-prose once the
  engine work lands
```
