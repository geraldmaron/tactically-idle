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
                     window both face that house" (known line, and the map); refusal "Patrol
                     says {shooter.first} won't answer the door or the phone" (briefing, sourced;
                     E12.1 is pending, row M)
Self-harm risk:      unknown for the shooter, whom the team never contacts; E4 applied
                     conservatively (noDeathOnCard, no state shown; row M)
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
| 2 turn | `turn_walker` · `turn_door` · `turn_light` (drawn) | the walker on the porch · the back door deadlocked · the porch light on | per turn, a move against a question (below) | porch clock | turn group, marks |
| 3 commit | `crossing` | everyone ready, as far as they will be | out the front behind the vehicle (escort, front route, only once screened) · out the back (escort, back route, R-R5; offered only where the house has a second door) · let the carer lead the father out (the father walks with his child; both in the open longer) · hold until the other unit has the shooter (All night) | porch clock; the carer's nerve | escort routes, fire, clock fork |
| 3 | `porch` | the clock ran out: the father is on the porch | talk him back in through the carer (phone) · run to him with a shield (team to the porch) · bring the vehicle up to the steps (cover) | the father in the open | fire on a civilian (R-R2), cover |
| 3 | `pinned` | shots at the team on the route | hold where you are in cover and wait · pull everyone back inside · push on to the cars | the people in the open | fire, cover |

No force and no entry choices exist: the shooter is another unit's, and nobody the team meets is a
threat to them (E12.5 trivially; row M).

Stage 2 turns, each a move against a question, with charged costs and exclusive payoffs:

| Turn | Prompt fact | Move option (payoff / cost) | Question option (payoff / cost) | What it reprices |
|---|---|---|---|---|
| `turn_walker` | the walker is on the porch, in view of the window | fetch the walker (team to the porch vantage): `walker_in`, the father walks on his own pace / the squad stands on the porch, a drawn fire target there (R-R3 exposure at the vantage) | ask the carer to let him lean on them (phone): `leaning`, no one on the porch now / the carer walks beside him on every crossing, so the carer becomes a second fire target on each (R-R2 multi-target), and his pace is the slow profile (R-R3 duration) | who is in the open on the crossing, and for how long |
| `turn_door` | the back door is deadlocked and the key is on the father's ring (the turn's arrival sets that door locked, R-R7) | force the back door from outside (team to the back step vantage, then the route forces it: force time or the entry tool, read from the real door state) / the noise; on adverse the father goes to the front window to see what the bang was (clock +, R-R6) | ask the carer to get the key off his ring (phone): `door_key`, the door unlocked quietly (R-R7) / the carer has to cross the front room to reach him, a drawn fire target there on mixed and adverse | the back route's time and noise |
| `turn_light` | the porch light is on; the porch is lit and the street is dark | have the carer switch it off (phone): `light_off`, the porch and door dark for the exposure line (R-R8) / the switch is by the front door, so the carer is a fire target at the door for that moment | leave it on (no move, 0 minutes): the shooter's attention stays on the lit porch, and the side yard reads darker by contrast (R-R8) / the front route stays lit | front against back |

Dominance grid, stages 1 to 3 (designed directions; balance measures them):

| Option | Odds | Minutes | Who pays on adverse | Charged by | Cost the player sees | Payoff only it produces |
|---|---|---|---|---|---|---|
| 1 call the carer | mid (TALK) | 3 | the carer (crosses the front room) | `front_window.call.adverse` drawn fire at the carer (R-R2) | "{carer.first} has to cross the front room to reach {father.first}" | the father away from the window, which slows the porch clock |
| 1 team to the back door | mid (MOVE) | 5 | the team (the side yard, where it is in view) | `front_window.back_way.adverse` drawn fire (R-R1, R-R3) | "the side yard is open to the street for a few steps" | the back route scouted; the squad already at the back |
| 1 park the vehicle | mid (DRIVE, cert) | 4 | the driver | `front_window.screen.adverse` drawn fire at the vehicle | "the vehicle draws {shooter.his} eye while it parks" | `screened`, the front route's cover |
| 2 fetch the walker | mid | 2 | the team on the porch | drawn fire | "on the porch, in full view of that window" | the father walking on his own |
| 2 lean on the carer | best | 1 | the carer, on every crossing | the crossing's fire draws at the carer too, at the slow pace | "{carer.first} has to walk out beside {father.first}" | nobody on the porch now |
| 2 force the back door | mid | 3 | the father (the bang draws him to the window) | `turn_door.force.adverse` clock rate (R-R6) | "a forced door is loud in a quiet yard" | the door open whatever the carer can do |
| 2 ask for the key | mid | 4 | the carer (the front room) | `turn_door.key.mixed/adverse` fire at the carer | "{carer.first} has to cross the front room to reach him" | a quiet back route |
| 2 switch the light off | mid | 2 | the carer (by the front door) | fire at the carer | "the switch is by the front door" | the front route darker |
| 2 leave it on | best | 0 | the front route | the lit porch on the exposure line (R-R8) | "the porch stays lit" | the side yard darker by contrast |
| 3 out the front, screened | mid to good | 3 | everyone crossing | drawn fire at the father, the carer and the team, with the vehicle as cover | "a few steps of open porch before the vehicle" | the shortest time in the open; the father leaves his way |
| 3 out the back | mid | 6 | everyone in the side yard | drawn fire where the gap is in view (R-R3) | "the long way round, and the father hates it" | no exposure on buildings where the gap is hidden |
| 3 the carer leads | mid | 5 | the carer and the father together | drawn fire at both | "both of them in the open, walking at his pace" | the father goes without being held (the iceberg tip) |
| 3 hold all night | best (HOLD) | All night | the father, if the porch clock runs out | clock fork | "{father.first} spends every hour of it near that window" | no one in the open tonight |

Minutes rule (E2) has nothing to price here: no force or entry exists. The fast options (cross now)
are priced by drawn fire, which is what `offsite-fire` makes real.

## G. Turn

Planted in known[0] (the walker) and in `front_window.call` (the carer as the team's voice).
Revealed in the drawn turn node's prompt. Reprices stage 1: the back-door scout is wasted if the
back door is deadlocked and no tool is carried; the vehicle is wasted if the walker turn sends the father
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
| `walker_in` | `turn_walker.fetch` | `carer_leads` text, the father's pace (R-R3) |
| `leaning` | `turn_walker.lean` | crossings add the carer as a fire target and the slow pace |
| `door_key` | `turn_door.key` favorable | `crossing.promptIf` (the opening state itself is R-R7's) |
| `light_off` | `turn_light.switch` | `crossing.promptIf` (the lighting itself is R-R8's) |
| `on_porch` | clock onOut | `porch.prompt`, held endings |
| `back_scouted` | `back_way` favorable | `out_back` travel (the squad is already there), modifier (+4) |

Situation leaks: every situation shows the same card, briefing, clock label and clock rate. Building
truths (what the window sees) differ by building, not by situation. Row L has the audit.

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

No death endings, a deliberate choice: civilians in this call can be hurt, never killed. Incoming
fire draws none, wounded or serious today, a cap designed for officers; this call asks R-R2 to keep
the same cap for civilian targets on purpose, so the father and the carer are never killed. If the
owner wants a fatal civilian draw, that is a new severity, an ending and an E2.2 human read.

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
| `carer_crosses` (the carer will cross the front room when asked) | true | true | false |
| porch clock rate | 1.2 ± 30% | same | same |
| shooter's window along the street (`StreetVantage.alongFt`) | drawn per call: 0, 15 or 30 ft | same | same |
| shooter proficiency (drawn) | untrained 50, some 35, trained 15 | same | same |
| turn | walker / gate / light | same | same |

Revised after the Codex review (finding 6): the first sheet gave s3 a faster clock and claimed it
read like spread. It did not: s1 and s2 spanned 0.84 to 1.56 a minute and s3 1.12 to 2.08, so a cue
before about 12.8 minutes identified s3. The rate is now the same in every situation, and s3
differs by a behavioral truth instead (`carer_crosses` false: asked to cross the front room, the
carer freezes), revealed only by asking. Public differences by situation: none by design; the
reviewer audits the compiled cards and the cue timing across situations.

Building axes (independent of situation; what the `blueprint-building` probe should see):

| Axis | Today | With the request |
|---|---|---|
| whether the shooter's window sees the front door | yes: `TreeFact.sightline` settles it per building (`sightFromStreet`, `sightlines.ts:68`) | the same line also sets fire odds at that door (R-R3) |
| whether the side yard gap is in view | no: sightlines are computed to an opening only | R-R3 |
| whether a back door exists | the building has it or not (seed 1: `bungalow_g2` has one exterior door; `cedar_close`, `willow_terrace_v1`, `ash_grove_v1`, `juniper_court_v1`, `two_storey_house_g2`, `semi_detached_g2` have two), but every role gets one route, the shortest | R-R5 |
| the back door's state | whatever the building generates (yard-to-yard openings are always-open doorways on all seven families, seed 1, so there is no gate to lock); `blueprint-locked` locks the house doors | `turn_door` sets it (R-R7) |

Probe plan, revised after the Codex review (finding 5). `measureWiring` compares only eligibility
and the favorable chance (`wiring.ts`), and incoming fire is a separate draw, so the favorable
probes cannot prove `offsite-fire` works. Two kinds of check, kept apart:

- Favorable and travel (existing probes): `back_way` is a vantage move whose travel and signal come
  from the building, so it should move `blueprint-building` and `buildingTravelChanges`; `call`
  should not; `screen` has no movement intent today and is not expected to move them.
  `blueprint-locked` should move the escorts and `turn_door.force`.
- Drawn harm (a new check, R-R9 to the tooling lane through the lead): for each fire-carrying
  choice, the incoming-fire distribution on paired buildings must differ where the line differs,
  be zero where the line is blocked, fall with range, respect the window's field of view, and drop
  with the placed vehicle on the line.

## M. Ethics screen

- E1 clear: no tactic named; "shots" and "firing" only, never a weapon noun (O1).
- E2 clear: no force exists; the best endings are both walking out unhurt; no civilian gesture
  defuses the shooter.
- E3 pending batch tally. Age (elderly) is a need, not a threat; no mechanic reads identity.
- E4 pending, applied conservatively (revised after the Codex review, finding 7). The team has no
  contact with the shooter and cannot screen them; "another unit's" is not a screening result.
  The template sets `noDeathOnCard` on the shooter slot, no choice acts on them, the direct
  question is the other unit's negotiator's and never on the card, and no ending shows or invents
  their state beyond "the other unit still holds that house" (E9 by silence, flagged for review).
- E5 n/a. E6 n/a (no entry). E7: hits go through the standard fire lines and the medic. E8
  composite. E10: the other unit is never an obstacle. E11: the shots are sourced to patrol; no
  ending says what happened across the street.
- E12.1 pending. Armed, threat and advantage are quoted in row B; the refusal line is now drafted
  for the briefing, sourced: "Patrol says {shooter.first} won’t answer the door or the phone." Whether
  a protected rescue needs the fourth condition at all, or takes an exception because this team is
  called for the people and not the shooter, is the owner's: it joins owner question E12 ("whether
  a team holding outside an active shooter fits the game"). Both are dependencies, not cleared.
- E12.2 row C. E12.3: no family at the tape. E12.4: the clock never authorizes anything. E12.5: no
  force or entry options.
- Concessions: none.

## N. Officer slots

None reserved.

## O. Engineering requests

Blocking before tree data: `offsite-fire` (R-R1 to R-R3 below are its parts, and R-R3 now carries
the exposure contract the Codex review asked for), and `clock-runout-routing`. Needed for the
building axes: R-R4, R-R5. Needed for the stage 2 costs to be physical rather than check
modifiers: R-R6, R-R7, R-R8, and the person moves from the barricade's R-B3. A verification
request for the tooling lane: R-R9. Each "current limit" was verified against the code on
2026-10-18.

```
Engineering request R-R1 (offsite-fire, the shooter on the plan)
Need:            the offsite shooter to be an incident person the incoming-fire model can draw from,
                 at their street vantage, with the window's field of view kept
Current limit:   incidentPeopleFor skips every person whose position is not inside
                 (gen/incident/instance.ts:239), so the shooter is not in scenario.incidentPeople;
                 drawPlan then finds no person and draws hit 0, serious 0
                 (sim/drawn-effects.ts:240-241). The vantage point is computed (instance.ts:167,
                 streetVantage) but only as a Vec; sightFromStreet needs the StreetVantage with
                 fieldDeg (sightlines.ts:47, :80)
Build links:     gen/incident/instance.ts incidentPeopleFor; sim/drawn-effects.ts drawPlan;
                 sim/incident-factors.ts (an offsite person must not seat on indoor work)
Proposed field:  IncidentPersonDef.offsite?: { vantage: StreetVantage; at: Vec }, with threat, weapon
                 and proficiency, excluded from indoor threat seating; no tree field
Content version: v13
Blocks:          rows F, H (all gunfire)
Extends:         backlog offsite-fire
```

```
Engineering request R-R2 (offsite-fire, several targets, one route)
Need:            one exposure that draws fire at each person in it (the father, the carer, the
                 squad on a crossing), records every hit, and routes the call once
Current limit:   compile.ts compiles `fire` into one incoming_fire draw whose variants carry
                 officerHarm only (compile.ts:653-663); a civilian can be hurt only by authored
                 `harm` (rescue-chair.ts: 20 harm effects, 0 fire). `fire` has no `next` by result,
                 and two draws in one decision have no aggregation
Build links:     content/call-trees/types.ts TreeOutcome.fire; compile.ts; sim/drawn-effects.ts;
                 sim/operation.ts commit (personCasualties); content/incidents/lines.ts FIRE_LINES
Proposed field:  fire: { from; at: (role | 'team')[] (default ['team']); mark?; next?: { none;
                 civilian_hurt; officer_hurt } }. One independent draw per target, each hit recorded
                 (personCasualties for a role, officerHarm for the team) with a standard line per
                 hit; one route by precedence civilian serious > civilian wounded > officer serious >
                 officer wounded > none; civilian severity capped at serious on purpose (row I).
                 Acceptance case: the father seriously hurt and an officer wounded in one crossing
                 records both and routes civilian_hurt
Content version: v13
Blocks:          rows F, H, I (out_hurt, hurt_on_porch)
Extends:         backlog offsite-fire
```

```
Engineering request R-R3 (offsite-fire, the exposure contract)
Need:            fire odds from where each target really is during the decision, how long they are
                 in the window's view, and what is on the line
Current limit:   incomingFireOdds reads only the shooter's weapon, proficiency, distance to their
                 own room's door and their cover (drawn-effects.ts:46-54), all indoor quantities.
                 drawPlan's DrawnContext carries no action, no built location and no movement
                 (drawn-effects.ts:226-229). sightFromStreet answers only whether a vantage sees one
                 opening (sightlines.ts:68). compile.ts generates only each person's
                 starting-room-to-outside transition, so a phone choice that sends the carer across
                 the front room, or a clock that puts the father on the porch, moves nobody
Build links:     sim/drawn-effects.ts drawPlan, incomingFireOdds; sim/resolution.ts movement paths;
                 sim/sightlines.ts; the barricade's R-B3 (TreePlace, moveTo) for person places
Proposed field:  exposure, computed by the engine per target:
                 - the squad at a vantage: the vantage point, for the decision's minutes
                 - an escort or a walking person: the resolved route, sampled every 2 ft on its
                   outdoor legs and its legs past exterior openings, time in view = feet in view /
                   pace (a `slow` pace for a person marked as leaning or with limited mobility)
                 - a person moved by an outcome (R-B3 moveTo, e.g. the carer to the front room,
                   the father to the porch): that place, for the decision's minutes
                 hit chance from the share of samples in view (field of view, walls, neighbouring
                 houses, outdoor blocks_sight, placed cover), range from the vantage, time in view
                 and the light at the place (R-R8); DrawnContext gains the action and its resolved
                 movement; no new tree field beyond R-B3
Content version: engine, a new INCOMING_FIRE version
Blocks:          rows F, H, L, every stage 2 cost
Extends:         backlog offsite-fire; uses R-B3
```

```
Engineering request R-R4
Need:            the rescue vehicle as cover the team places: parked at the curb between the
                 shooter's window and the front door, it blocks or reduces fire on that line
Current limit:   TreeOutcome cannot place an object; cover comes only from generated furniture
                 between an indoor person and their door (instance.ts coverOnLine); the old tree's
                 vehicle choices change nothing physical (a cert requirement and authored text)
Build links:     content/call-trees/types.ts TreeOutcome; sim/operation.ts commit; R-R3's line test
Proposed field:  TreeOutcome.cover?: { between: role (offsite); and: role | 'scene'; label } placing a
                 vehicle-sized blocks_sight object at the curb on that line; default absent
Content version: v13
Blocks:          row F (`screen`, `out_front`, `porch.vehicle`)
Extends:         new
```

```
Engineering request R-R5
Need:            an escort out the back door where this person's room has a usable route to it,
                 kept through the whole decision
Current limit:   compile.ts builds one walking route per role, the shortest
                 (compile.ts:386-397, story-bindings.ts:138); at resolution currentStoryRoute
                 recomputes the shortest path from the binding's two spaces and ignores its
                 openingIds (story-bindings.ts:158-161, resolution.ts:508), so a stored back route
                 would still walk out the front. No TreeState condition reads the building
Build links:     content/call-trees/types.ts TreeChoice.walks and TreeState; compile.ts routes;
                 story-bindings.ts findStoryRoute and currentStoryRoute; sim/resolution.ts
Proposed field:  TreeChoice.walksVia?: 'front' | 'back' (the exterior door nearest or farthest from
                 the arrival side), compiled to a route that must leave by that exterior opening,
                 and recomputed at resolution with that opening as a constraint (blocked: the choice
                 is refused, not rerouted). TreeState.exitVia?: { role; via: 'back' } holds only
                 when such a route exists from that role's room; a walksVia 'back' choice must carry
                 it. Default absent
Content version: v13
Blocks:          row F (`out_back`), row L
Extends:         new; close to R-B2 (barricade window exit); one field could serve both
```

```
Engineering request R-R6
Need:            an outcome that changes a clock's rate (the father moved away from the window
                 slows the porch clock; a bang draws him back and speeds it)
Current limit:   Clock.ratePerMin is drawn once per call within rateSpread (incidents/types.ts
                 Clock); no TreeOutcome field reads or changes a clock
Build links:     content/call-trees/types.ts TreeOutcome; sim/clocks.ts
Proposed field:  TreeOutcome.clock?: { id; rate?: number (a multiplier); add?: number }; default absent
Content version: v13
Blocks:          rows F (`call`, `turn_door.force`), H
Extends:         new; sim/clocks.ts not re-read this pass
```

```
Engineering request R-R7
Need:            an outcome that sets the state of a named exterior door (the turn's arrival makes
                 the back door locked; the key opens it)
Current limit:   door state comes from generation, and the run already stores overrides as flags
                 (`openingFlag(id, state)`, resolution.ts:182; the blueprint-locked probe writes
                 them), but no TreeOutcome field can write one, and a tree cannot name an opening
Build links:     content/call-trees/types.ts TreeOutcome; compile.ts (resolve the door from the
                 role's route); sim/resolution.ts openingFlag
Proposed field:  TreeOutcome.door?: { of: role; via: 'front' | 'back'; state: 'locked' | 'open' };
                 default absent
Content version: v13
Blocks:          row F (`turn_door`)
Extends:         new
```

```
Engineering request R-R8
Need:            the light at an outdoor place (a lit porch, a dark side yard) to count in what the
                 shooter's window can see, and an outcome to switch a porch light
Current limit:   light is one environment value for the whole call (template conditions
                 timeOfDay, power), read by signalCarry for sightlines from outside; nothing is lit
                 per place, and no outcome can change it
Build links:     content/incidents/types.ts conditions; sim/spatial-factors.ts signalCarry; R-R3
Proposed field:  TreeOutcome.light?: { at: 'porch'; on: boolean }, read by R-R3 as a lit zone; a
                 lit porch raises the in-view weight of samples on it and lowers it for dark zones
                 beside it; default absent
Content version: v13
Blocks:          row F (`turn_light`)
Extends:         new
```

```
Engineering request R-R9 (tooling lane, through the lead)
Need:            a check that the incoming-fire distribution follows the building, since the
                 favorable probes cannot see it
Current limit:   measureWiring compares eligibility and likelihood.favorable only
                 (architecture/wiring.ts); incoming fire is a separate draw, and the backlog lists
                 offsite-fire as "probes=none"
Build links:     architecture/wiring.ts or a trees-v13 test; sim/drawn-effects.ts drawnDistribution
Proposed field:  a paired-building check over every fire-carrying choice: the hit share differs
                 where the line differs, is 0 where the line is blocked, falls with range, respects
                 the field of view, and drops with the placed vehicle on the line
Content version: tooling
Blocks:          ship of offsite-fire and of this call
Extends:         new
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
- Self-harm risk (row B): unknown for the shooter (no contact); E4 applied conservatively (row M)
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
- Flags set, readers (row H): 9 marks, 9 with a reader, dead 0 by design
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
- Ethics screen (row M): E1, E2, E5 to E11 clear or n/a; E3 pending; E4 pending, applied
  conservatively; E9 by silence flagged; E12.1 pending the owner (E12)
- Officer slots (row N): none
- Requests and owner decisions (row O): offsite-fire as R-R1 to R-R3 (R-R3 the exposure contract);
  new R-R4 to R-R8, R-R9 for tooling; uses R-B3; clock-runout-routing blocking; owner E12 and E12.1
- Tells on hook and premise: checked by eye for dashes and colons; checker not run on placeholders
- Handoff: this sheet, then Codex adversarial review, then the lead, then swat-call-prose once the
  engine work lands
```

## Codex adversarial review (2026-10-18)

Reviewed commit 66a607c, scope `docs/calls/rescue-design.md` only, Codex default model, static
review. Verdict: needs-attention. Each finding, its verdict and what this revision did:

| # | Finding | Verdict | Control |
|---|---|---|---|
| 1 | R-R3 cannot know where a target is: phone choices expose the carer with nobody moved, the porch is a mark, drawPlan has no action or movement, and R-R1 dropped the field of view | accepted | R-R3 rewritten as an exposure contract (vantage, sampled route legs, moved places, time in view, light); DrawnContext gains the action and movement; R-R1 keeps StreetVantage; person places use R-B3 |
| 2 | One `fire.at` and one `next` cannot cover a crossing with three people in the open | accepted | R-R2: a target list, a draw and a record per target, one route by precedence, an acceptance case |
| 3 | Stage 2 costs were check modifiers the fire draw never reads; the gate key changed no door | accepted | turns rewritten so each cost is a fire target, a pace, a clock rate or a door state; R-R6 to R-R8 filed; the gate (which the buildings don't have) replaced by the back door |
| 4 | currentStoryRoute recomputes the shortest path at resolution, so a back route walks out the front | accepted, verified (story-bindings.ts:158-161) | R-R5 now constrains resolution as well as compilation and gates on a usable route from the person's room |
| 5 | The favorable probes cannot verify incoming fire | accepted | probe plan split; R-R9 for a drawn-harm check; `screen` no longer expected to move the favorable probes |
| 6 | s3's faster clock identifies the situation from cue timing | accepted | one clock rate in every situation; s3 differs by `carer_crosses`, a revealed behavior |
| 7 | "Another unit's" is not an E4 screening or an E12.1 refusal | accepted | E4 pending and applied conservatively; refusal line drafted and sourced; E12.1 pending the owner |

Still open: the per-cell matrix and every walk wait for the tree.
