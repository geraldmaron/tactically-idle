# Call design sheet: Everything Goes Back (barricaded, model-first)

Written through swat-call-design for the calls lane, 2026-10-18, before any tree data exists. It
replaces `src/content/call-trees/barricade-order.ts` ("Behind the Bathroom Door") as a fresh call,
not a conversion. Every sample line here is a placeholder for swat-call-prose. Private logic, the
hidden truth and the closing fact are marked NEVER PRINTED. Rows the tree has to prove (gates,
balance, string checks) are marked "not run: no tree yet" in the record, which is why the sheet
is complete as a design and still waits on engine work (row O) before tree data is written.

## A. Lane and version

- Lane: call tree (v13). The calls lane owns the new `CallTree`
  (`src/content/call-trees/barricade-boxes.ts`, name to confirm) and the rewritten
  `IncidentTemplate` (`src/content/incidents/barricade.ts`). The compiler owns node flags,
  routing, binding, placement, cascade, force and fire lines, command lines and rewards by tier.
  `src/content/call-trees/types.ts` and `src/content/incidents/types.ts` are engine files
  (`COORDINATION.md`), so every new field below is a request, not an edit.
- Version: `CALL_TREE_CONTENT_VERSION` 13, read 2026-10-18. Owner direction on file: no
  freezes or back-compat in development. The fingerprints are the lead's to recapture when the
  old tree retires.
- Type id `barricaded`. Families: the nine the old tree lists (`cedar_close`, `harbour_court`,
  `willow_terrace_v1`, `ash_grove_v1`, `juniper_court_v1`, `bungalow_g2`, `two_storey_house_g2`,
  `semi_detached_g2`, `apartment_unit_g2`). Apartments stay pending the open owner decision
  ("Barricade building family"); the premise holds for a sold flat too.
- Contract read from source this pass: `call-trees/types.ts` (whole), `incidents/types.ts`
  (Clock, template), `trees-v13/compile.ts` (placement 360 to 445, `movement()` 760 to 790,
  `actionFor` 795 to 842), `story-bindings.ts` (`findStoryRoute`, `usableOpening`),
  `sim/incident-factors.ts` (`incidentSubjects`), `sim/threat.ts` (difficulty contributors),
  `sim/resolution.ts` (acting, support, equipment), `sim/operation.ts` (`defaultSupport`,
  `evaluateDefault`), `sim/scenario-types.ts` (`SupportRule`, `squadsPutToWork`,
  `PersonDefinition.moves`), `architecture/wiring.ts` (the probes). Not re-read this pass:
  `sim/clocks.ts`, `sim/authorization.ts`, `sim/outcome-score.ts`; the hostage sheet read them on
  2026-10-07 and nothing here depends on a behavior they changed since, but that is unverified.

## B. Premise

```
Call type borrowed:  a barricade in a family home on moving day
Person:              the subject (drawn name, adult), the late owner's child, who came home to find
                     the house sold by a sibling and a moving crew loading the truck; wants nothing
                     else carried out of the house
Wrong note:          one mover went back in for the last bedroom's boxes and never came out
Worse if they wait:  the subject is carrying boxes back in, room by room, down the hall toward the
                     back bedroom where the mover is hiding (a clock the team watches)
Why a tactical team: armed "Patrol saw {subject.first} at the front window holding a long weapon
                     from the hall closet" (fact claim); threat "The crew's driver says {subject.first}
                     told them the next person through the door would regret it" (dispatch, sourced);
                     advantage "Every way out of the back bedroom runs through the hall
                     {subject.first} keeps walking" (known line, and the map); refusal
                     "{subject.He} won't come out, and {subject.he} won't say who is inside" (dispatch)
Self-harm risk:      present. A parent's death this year, the family home sold without them, a
                     weapon that was the parent's, and a refusal. E4 applies (row M): noDeathOnCard
                     on the subject slot, force noFatal on every force outcome
Private logic:       the back bedroom was the subject's own room. The pencil marks on its doorframe
                     are theirs, the last at fourteen. Putting the boxes back is putting the house
                     back the way it was before anyone decided without them. The weapon came out of
                     the hall closet because it was the parent's, and the crew was about to carry
                     the closet out too. NEVER PRINTED as an explanation
Iceberg tip:         "the pencil marks on that doorframe, the last one at fourteen", spoken by the
                     subject in talking.let_talk favorable, reached only through the list turn
                     (turn_list) and then let_talk
Closing fact:        whether the sibling had the right to sell is never settled on the call.
                     NEVER PRINTED
```

Why this premise and not the old one. The old call put the danger in a relationship (an
ex-partner under a protective order) and the trapped person in one fixed room. This one puts the
danger in the house itself: the subject's movements through the rooms are the clock, the trapped
person's room decides the route out, and the building decides which rooms exist on the way. That
is what "physical moves through the building" asks for, and it gives a different building a
different call (row L).

## C. Person cards

| Person | Wants, in their words | Fears | Behavioral reads | Memory anchor | How they know | Pronouns |
|---|---|---|---|---|---|---|
| subject (`{subject}`, the late owner's child) | "Nothing else leaves this house." | the house emptied and gone with nobody asking them | carries boxes back in and sets them in the rooms they came from; stops at the back bedroom door each pass; answers the house phone only when it rings out and rings again | the pencil height marks on the back bedroom doorframe | lived there to eighteen; came home this morning to the truck | drawn, tokens only |
| mover (`{mover}`, civilian, trapped) | "Tell me when it's safe to open this door." | being found by someone with a weapon who doesn't know they are there | texts the crew's driver in short bursts; went silent once when footsteps stopped outside; is in the closet of the back bedroom | the roll of packing tape still on their wrist | was inside, packing that room, when the shouting started | drawn |
| sibling (`{sibling}`, bystander at the tape) | for the team to get the crew out and the house back | that the subject hurts themselves in that house | wants to go to the door; keeps reading the sale papers in the patrol car; says the weapon has not been used in years (sourced claim, never settled by them) | the sale papers in a folder | sold the house; was outside with the truck | drawn |

The 911 caller is the crew's driver, unnamed (callers stay unnamed in call trees). The sibling is a
bystander and never goes on the line or carries a message (E12.3).

Hook person in stage 3: the mover opens the hook and is the stake in every stage. In stage 3 the
mover is still inside on every path that reaches `talking`, `threat` and `found`, and every
ending's first sentence states the mover's state.

Geography. Advantage line, quoted once: every way out of the back bedroom runs through the hall
the subject keeps walking. Roles against it:

| Role | Position | In the subject's line of sight? | Cost in text |
|---|---|---|---|
| negotiator ({lead}) | house phone, from the cars | no | none |
| team at the front window (`glass`) | vantage on the scene room | yes | "in plain sight of {subject.first} and the weapon" on the summary |
| team at the back bedroom window (`back_step`) | vantage on the mover's room | no, unless the subject is in that room | "the side path is gravel and the hall is quiet" on the summary |
| team in the hall (`walk_out`, escort) | inside, on the mover's route | yes, whenever the subject is in the hall | "the hall is the one place {subject.first} keeps coming back to" |
| second squad, support (`walk_out`, `go_in`) | holds a vantage the choice names | no | named on the summary as the squad's task |
| medic | at the curb | no | none |
| patrol | outer perimeter, sibling in the car | no | none |

## D. Hook

Placeholder: "{mover.first} went back in for the last box. Now the late owner's
{subject^son|daughter|child} is armed inside and says nothing else leaves."

Budget: the Ops board card clamps the hook at 2 lines (about 103 to 106 characters at 390px,
measured for the hostage hook on 2026-10-08). The placeholder binds to about 105 characters with a
9-letter first name, so prose must cut it; "armed" has to land before character 80. Tests 1 to 8 by
read: name at word 1; sentence 1 the wrong note; sentence 2 the danger and the refusal; one gap
(does the subject know the mover is in there?); no disclaimer; plain danger word "armed"; one
proper name, the second person carried by a role. Measurement on the board card is the prose
lane's.

## E. The ninety seconds

- Card: title "Everything Goes Back", hook, pressure label "{mover.first} in the back bedroom".
- Briefing: dispatch (2 sentences), known 3, unknown 1, responsibilities 2, plus the engine's
  deliberate-answers line in half the calls (request R9 is the lead's; this call screens under
  E4 too). That is 8 lines, 9 with the pacing line, over the skill's 4-known-plus-1 target the
  same way the hostage call is; recorded, not hidden.
  - known[0] the turn fact: "{mover.first} texted the crew, “In the back bedroom closet. Someone
    keeps walking past.”"
  - known[1] the weapon report, sourced to patrol.
  - known[2] the advantage line.
  - unknown: whether {subject.first} knows {mover.first} is in the house.
- Taps, designed (not walked; no tree yet): stage 1 one decision; stage 2 one; stage 3 one on the
  common path where the mover walks out on a favorable result and the subject trades for the
  list, two otherwise. Longest designed stage 3 chain: talking > threat > fired_on > mover_out
  (4). The walk is a gate on the tree (row P).

## F. Stage table

| Stage | Node | New fact on arrival | Options (what each protects / costs) | Waiting costs | Lever |
|---|---|---|---|---|---|
| 1 approach | `porch` | the subject shut the door on the crew; boxes going back in; the mover's text | call the house phone (contact, no move / his attention stays out front) · put the team at the front window (sight of the room and the weapon / in his line of sight) · send the team round to the back bedroom window (reach the mover / leaves the front unwatched, boots on the side path) | the boxes clock runs | team vantage, `observes`, `fire`, clock |
| 2 turn | `turn_list` · `turn_hall` · `turn_text` (drawn) | the list on the box flap · the hall the mover's route runs through · the mover's battery and nerve | per turn: a move against a question (see below) | the subject nearer the back bedroom | turn group, marks, clock |
| 2 | `on_the_line` | the subject is talking | tell them the sale stands · ask who else is in the house · let them talk about the house | boxes clock | meters, truth `knows_mover` |
| 2 | `seen` | the subject saw the team at the glass | pull back from the glass · hold the glass and call | boxes clock | `team_seen`, fire |
| 3 commit | `talking` | the subject on the line | take down the list (statement concession) · walk the mover out with an escort (escort move, support) · ask the subject to let the mover leave · hold past dark (Hours) | boxes clock; the mover in the closet | concession, escort, support, clock fork |
| 3 | `mover_out` | the mover is out | talk the subject out the front · take down the list · hold the perimeter all night | the subject alone with the weapon | concession, span |
| 3 | `threat` | the subject at the back bedroom door with the weapon | call them back to the front from the glass (vantage, voice) · send the team in (entry, support) · pull the team out of sight | the mover behind that door | authority entry, force, fire |
| 3 | `fired_on` | a shot at the team | go in harder (entry) · hold at the cars and call | the mover in reach | authority entry, fire |
| 3 | `found` | the clock ran out: the subject opened the back bedroom door | talk to both through the window (vantage, voice) · go in (entry, only if threat believed) · give them the room (hold) | the mover in the room with the subject | clock `onOut`, truth `comes_out` |

Stage 2 turns, each a move against a question:

| Turn | Prompt fact | Move option | Question option | What it reprices |
|---|---|---|---|---|
| `turn_list` | the sibling says the subject wrote a list on a box flap, the parent's things they want kept | send the team to the porch for the flap the subject threw out (vantage scene) | ask the subject on the phone what is on the list | the list concession in stage 3 (mark `has_list`, +8 on take_list) |
| `turn_hall` | through the side window the team sees the hall: the subject stops at the back bedroom door each pass | put the team at the side window to watch the hall (vantage, visual, observes the hall) | time a call to pull the subject to the front | the escort in stage 3 (mark `hall_timed`, +6 on walk_out) |
| `turn_text` | the mover texts that their battery is going and they want to run for it | text the mover to stay in the closet (no move) | send the team to the back bedroom window to talk the mover through it (vantage, voice) | whether the mover runs on their own (clock on the mover's nerve, mark `mover_steady`) |

Dominance grid (four rules from dilemma-patterns.md), the stages where a tie is likeliest. Odds
are designed directions, not measured; balance measures them.

| Stage, option | Odds | Minutes | Unlocks | Who pays on adverse | Charged by | Cost the player sees | Value | Payoff only it produces |
|---|---|---|---|---|---|---|---|---|
| 1 call the house phone | mid (TALK) | 3 | `on_the_line` | the subject leaves the front room, unseen | `porch.call.adverse` → turn | "{subject.His} attention stays out front, and so does the shouting" | contact | the conversation, and the subject held at the front |
| 1 front window | best on intel (visual, observes) | 4 | location and weapon confirmed | an officer (fire) or the subject's trust | `porch.glass.adverse` → `seen` or `fired_on` | "in plain sight of {subject.first} and the weapon" | knowing where the subject is | the only stage 1 option that confirms the weapon and the room (intel-odds) |
| 1 back bedroom window | mid (QUIET) | 4 | reach the mover (`mover_steady`) | the mover, if the subject hears the path | `porch.back_step.adverse` (truth `knows_mover`) | "the side path is gravel, and nobody watches the front while you are there" | the trapped person first | the mover's trust; the escort later starts from the back |
| 3 take down the list | mid | 8 | `has_list`, the surrender on favorable where `comes_out` | the mover waits longer | `talking.take_list.adverse` | "The list settles nothing about the sale, and {subject.he} will hear that" | the concession, a commitment | a kept commitment when the subject walks out |
| 3 walk the mover out (escort, support) | mid to good with a second squad | 5 | `mover_out` | the mover and the escort, in the hall | `talking.walk_out.adverse` (truth `knows_mover`, clock low) | "the hall is the one place {subject.first} keeps coming back to" | the mover out now | the only stage 3 option that moves the trapped person on a favorable band |
| 3 hold past dark | best (HOLD) | Hours | none | the mover, if the clock runs out | clock fork `boxes` | "{mover.first} spends every hour of it in that closet" | no push | lowest provocation; the long night |
| 3 send the team in | entry (2 min) | 2 | entry endings | anyone in the hall, the mover included | force, fire | "Anyone in that hall can be badly hurt, {mover.first} included" | speed | none on trust or strain (minutes rule) |

Minutes rule (E2): entries take 2 minutes against 8 to 45 for the holds, so they cost more in
trust, strain and completion everywhere they are reachable, by `OUTCOME_SCORE_V1.force.entry`
and the entry endings naming who was hurt.

Force and entry gates (E12.5). Every entry declares `authority: 'entry'`.

| Action | Situation | Visible when | Threat that authorizes | Command line |
|---|---|---|---|---|
| `threat.go_in`, `fired_on.go_in` | all | at `threat` / `fired_on` only | mark `at_the_door` ("{subject.first} took the weapon to the door {mover.first} is behind") | generated |
| `found.go_in` | s3 | at `found` only, and only once `at_the_door` is set | same | generated |

The weapon at the front window is why the team is here, not a reason to go in: it is not a
threat mark. The clock never authorizes entry here (E12.4): its running out moves the call to
`found`, where entry still needs the threat mark.

Second squad. Two choices carry a support rule (request R-B4): `talking.walk_out` (the second
squad holds the front window to keep the subject's attention while the first escorts the mover
down the hall) and `threat.go_in` (the second squad holds the back step so the hall has two ends
covered). Both work with one squad and are better with two; neither requires two. That puts
`squadRange` at 2 on this call.

## G. Turn

Planted in known[0] ("Someone keeps walking past") and in `porch.back_step` (the cheapest move
toward the mover). Revealed in the drawn turn node's prompt: the list on the box flap, the hall
the subject keeps walking, or the mover's failing nerve. Reprices stage 1: going to the back
first buys the mover's trust that the escort needs; watching the front first buys the timing;
the phone first buys the list.

## H. Consequences

Escalation, the shape the hostage call uses:

```
{ if: knows_mover true }                                    -> threat (reveal knows_mover, mark at_the_door)
{ if: [knows_mover false, subject stance breaking] }        -> threat (mark at_the_door: the subject goes to that room anyway, and finds the closet)
{ if: [knows_mover false, subject stance not breaking] }    -> stays in play (reveal knows_mover)
```

The boxes clock (owner `mover`, so it stops once the mover is out). Kind `deadline`, start 60,
rate 1.0 a minute, spread 0.3, rate unknown. Cue at 45, about 15 minutes in: "Through the side
window, the team sees {subject.first} set a box down outside the back bedroom door." (mark
`in_hall`). Runs out at about 46 to 86 minutes. The long choices (`let_talk`, `past_dark`,
`all_night`) fork on it: out and `comes_out` true goes to `found` with the subject walking the
mover to the back door themselves; out and `comes_out` false goes to `threat`. Everywhere else
`onOut: { mark: 'found_mover' }` records it and the prompts of the nodes it can lead into read the
mark. The short choices that can run it out leave the call where it was until R-G4
(`onOut.next`) lands; that gap is counted in the walk, as the hostage call counts it.

Mood is written as `moves`: heard (let_talk, the list), contact (pick-ups), provoked (the sale
stands, the team at the glass when seen, the entry), team_seen (glass, hall window), released
(the subject lets the mover go). Marks: `in_hall`, `found_mover`, `has_list`, `hall_timed`,
`mover_steady`, `at_the_door`, `list_promised`, `seen_glass`. Each has a reader:

| Mark | Set by | Read by |
|---|---|---|
| `in_hall` | clock cue | `talking.promptIf`, `walk_out` modifier (−6) |
| `found_mover` | clock onOut | `talking`, `mover_out`, `threat` promptIf |
| `has_list` | `turn_list` choices | `take_list` modifier (+8), `talking.promptIf` |
| `hall_timed` | `turn_hall.time_call` | `walk_out` modifier (+6) |
| `mover_steady` | `back_step`, `turn_text.stay_put` | `walk_out` modifier (+4), `found.promptIf` |
| `at_the_door` | escalation | threat mark; `go_in` visibility |
| `list_promised` | `take_list` favorable (promise) | `mover_out.talk_out`, endings |
| `seen_glass` | `glass` adverse | `seen.promptIf`, `talking.promptIf` |

Full truth-by-band matrix: designed per choice at prose time, written into the tree, and walked by
the coverage gate; not filled on this sheet because the tree's strings do not exist yet (row P
says so).

## I. Endings

| Ending | Disposition | Each person's state | remainingTasks |
|---|---|---|---|
| `everyone_out` | resolved | mover out; subject walked out to the team; the list taken | none |
| `out_after_dark` | resolved | as above, after hours | none |
| `walked_them_out` | resolved | the subject walked the mover to the back door, then came out (clock out, `comes_out`) | none |
| `mover_out_held` | relief_partial | mover safe; subject inside with the weapon | bring {subject.first} out |
| `held_with_mover` | relief_partial | both inside, the mover still in the closet | get {mover.first} out; bring {subject.first} out |
| `held_found` | relief_partial | both inside, the subject knows the mover is there | get {mover.first} out; bring {subject.first} out |
| `entry_clean` | resolved | everyone out unhurt; the entry scored in the debrief | none |
| `entry_subject_hurt` | resolved | subject hurt taking the weapon, with the medic; mover safe | none |
| `entry_mover_hurt` | resolved | mover hurt in the entry, with the medic; subject with the team | none |
| `subject_hurt_force` | resolved | subject hurt by the team's force, the medic working (E4.5) | none |
| `handed_over` | unresolved | as last seen | everyone |

Endings carry title, summary and disposition only; the debrief's score lines say what goes to
review, as in the hostage call. No ending says "goes to review" (old check-strings finding,
`ending-status`).

## J. Open loop

The boxes stay where the subject set them down; the sale papers are still in the patrol car; the
pencil marks are on the doorframe, and the crew comes back for that room tomorrow.

## K. Levers

Clock `boxes` with forks and `onOut`; meters and meter branches; authority (entry, statement
concession); one promise (`list`, to the subject); team moves (vantages, escort, entry); support
squads (R-B4); drawn fire and force. Pressure: start 20, 0.25 a minute, threshold 85, minute 260,
beyond any path; it never stands in for the clock.

## L. Variant plan

| Axis | s1 | s2 | s3 |
|---|---|---|---|
| `knows_mover` | false | true | true |
| `comes_out` (walks out for the list) | true | true | false |
| subject volatility | steady | shifting | volatile, hostile |
| demand | the list (statement, concedable) | same | nothing left to give (person: the house; never concedable) |
| turn (drawn per call) | list / hall / text | same | same |
| boxes clock rate | 0.7 to 1.3 a minute | same | same |
| proficiency (drawn) | untrained 30, some 50, trained 20 | same | same |

Building axes (drawn by the board, independent of situation). These are what make the
`blueprint-building` probe move, and each needs the request named:

| Axis | Today | With the request |
|---|---|---|
| route from the mover's room: through the scene room or around it | yes, `findStoryRoute` already picks it per building; `incidentFactors` weights subjects on the route's rooms | same |
| the mover's room on the upper floor (two-floor families) | no, placement is ground floor only | R-B1 |
| a way out through the mover's room window | no, routes never use windows | R-B2 |
| distance from the subject to the mover's door | no, the subject never leaves the scene room in the engine | R-B3 |

Correlated hidden axes: `knows_mover` and `comes_out` set the situation together. Cheapest reveals:
`knows_mover` by `who_else` (3 minutes, TALK, provokes on adverse) and by any adverse result that
escalates; `comes_out` by `take_list` and every release. The front window confirms where the
subject is and what they hold (intel), never what they know.

Situation leaks to watch at review (the hostage review's B9): volatility is volatile only in s3,
where `comes_out` is false. The design draws volatility per situation on purpose here, since a
returning player who reads "volatile" still has to find `knows_mover`; the reviewer decides.

## M. Ethics screen

- E1 clear: decisions and costs; no entry method or munition named; the weapon is "a long
  weapon" or "the weapon", never a make.
- E2 clear: entries score worst; the best endings are walk-outs; the sibling never defuses
  anything.
- E3 pending batch tally (identity drawn per person; no mechanic reads it).
- E4 applies to the subject (row B). E4.5 checked against E2.1: no death card, force `noFatal`,
  worst shown is "hurt, the medic working". Content note draft, pending O2 and R5: "This call
  involves a person with a weapon who may be at risk of harming themselves." Debrief support line
  draft: "If this call brought something up for you, in the US you can call or text 988.
  Elsewhere, contact local emergency or crisis services."
- E5 n/a (no domestic abuse pattern; a family sale dispute). E6: every entry says who can be hurt.
  E7 clear. E8 composite. E9: every ending states the subject's state. E10 clear. E11: the sale
  and the threat to the crew carry "says"; custody wording waits on O4 as in the hostage call
  ("with the team now").
- E12.1 quoted in row B. E12.2 in row C. E12.3: the sibling never carries a message; the list goes
  from the subject to the team, and command passes it on (generated line). E12.4: the clock never
  authorizes entry. E12.5: row F.
- Concessions: `take_list` (statement: the team writes down what the subject wants kept and passes
  it on). No held person is a party.

## N. Officer slots

None reserved; `{lead}` once per string where used.

## O. Engineering requests

Two backlog items must work end to end before tree data is written, per the calls brief:

- `gear-by-action`: the call's moves need gear to count by what the choice does. The window
  vantages (visual: binoculars or optics on `observes`), the escort down the hall (shield,
  light), the entry (shield, breaching tool on a locked door). Today only `equipment` declared on
  the choice or an opt-in `capabilities` does anything (`compile.ts:810`, `resolution.ts:1195`).
- `intel-odds`: the front window and hall window choices exist to learn where the subject is and
  what they hold. Today a confirmed weapon changes only its label (`threat.ts:360-369`, the add
  is the same reported or confirmed) and the odds read the subject's starting room, not where the
  team saw them (`incident-factors.ts:56-70`).

New requests from this call, verified against the code on 2026-10-18:

```
Engineering request R-B1
Need:            a person placed upstairs when the building has an upper floor (the mover's bedroom
                 on two-floor families), with the route out taking the stairs
Current limit:   compile.ts placeCast calls selectStoryRoom with floor: 0 for the scene (line 371)
                 and for every role room (line 382), so two_storey_house_g2 and semi_detached_g2
                 never use their upper rooms; findStoryRoute already walks stairs for 'walking'
                 (story-bindings.ts usableOpening, line 130)
Build links:     content/call-trees/types.ts TreeRole.place; gen/incident/trees-v13/compile.ts
                 placeCast; the floor reaches text through a token or a TreeState condition
Proposed field:  TreeRole.place { rooms, floor?: 'any' | 'upper' | 'ground' } (default 'ground',
                 today's behavior), and TreeState.upstairs?: string[] (roles whose room is on an
                 upper floor) so text can say "upstairs" only where it is true; existing calls
                 unchanged
Content version: v13
Blocks:          rows C, L (building axes); the blueprint-building floor
Extends:         new
```

```
Engineering request R-B2
Need:            a walk-out through a ground-floor window of the person's own room, offered only
                 on buildings where that room has one (ash_grove_v1, juniper_court_v1, bungalow_g2,
                 two_storey_house_g2 and semi_detached_g2 bathrooms do; cedar_close, harbour_court,
                 willow_terrace_v1 and apartment_unit_g2 do not, seed 1)
Current limit:   story-bindings.ts usableOpening returns false for every window (line 127), so
                 findStoryRoute never leaves by one, and no TreeState condition reads the building
Build links:     content/call-trees/types.ts TreeChoice.walks and TreeState; story-bindings.ts
                 findStoryRoute; compile.ts routes per role
Proposed field:  TreeChoice.walksBy?: 'window' (route from the walker's room out its own exterior
                 window, ground floor only, with a time and strain cost by window size), and
                 TreeState.window?: string[] (the role's room has an exterior window); a choice
                 with walksBy 'window' must carry onlyIf window; default absent, existing calls
                 unchanged
Content version: v13
Blocks:          rows F (a back-window option in talking), L
Extends:         new
```

```
Engineering request R-B3
Need:            an outcome that moves a subject to another role's room (the subject reaching the
                 back bedroom door), so the map, the routes and the odds agree with the text
Current limit:   TreeOutcome has no field that moves a person; PersonDefinition.moves exists but is
                 truth-only and keyed by stage, and v13 never authors it; incidentSubjects reads
                 person.spaceId, the starting room (incident-factors.ts:63)
Build links:     content/call-trees/types.ts TreeOutcome; sim/operation.ts commit; the location
                 half of intel-odds (odds read where the team last saw the person)
Proposed field:  TreeOutcome.moveTo?: Record<string, 'scene' | { room: string }> (role to room),
                 applied to truth on commit; the team learns it only by a sighting or the
                 outcome's text; default absent
Content version: v13
Blocks:          rows F (`threat`, `found`), H (escalation), L (distance axis)
Extends:         new; pairs with intel-odds
```

```
Engineering request R-B4 (second-squad)
Need:            a call choice where a second deployed squad supports the acting one from a place
                 the choice names (holding the front window while the first escorts the mover
                 down the hall; holding the back step on the entry)
Current limit:   TreeChoice has no support or maxActing field (types.ts; only requires.minSquads
                 is picked from ActionRequirements), so compile.ts:842 gives every v13 call
                 squadRange max 1. The engine side exists: SupportRule {max, coverSpaceId,
                 reachMinutes, maxSquads, label, task, openingId} (scenario-types.ts:159),
                 defaultSupport (operation.ts:609), the support checks in resolution.ts:585
Build links:     content/call-trees/types.ts TreeChoice; compile.ts actionFor and squadRange
Proposed field:  TreeChoice.support?: { at: { vantage: 'scene' | string } | 'exit'; label: string;
                 max?: number } compiled to SupportRule (coverSpaceId and openingId from the
                 vantage, maxSquads 1); default absent, existing calls unchanged
Content version: v13
Blocks:          row F (second squad), backlog second-squad
Extends:         new
```

Second-squad meaning, settled for the lead's decision: support choices, not two squads acting at
once. The strongest case against: a barricade's best real play is exactly two squads doing two
things at the same moment (one talking at the front, one bringing the mover out the back), and a
support rule turns the second squad into score points on the first squad's check, which a player
may read as a number rather than a move. Why support still: the engine already has a physical
support model (a cover space, an opening to stage at, reach by travel minutes), the call tree
tracks one squad's position per decision, the acting-squad picker and `evaluateDefault` evaluate
one acting squad, and two acting squads would double the coverage walk's states for every choice
that allows it. Controls: R-B4's `at` places the supporting squad on the map at a named vantage
so the move is visible; the summary names the second squad's task; the choice works with one
squad. Verdict: accepted with controls, pending the lead.

Reused, not new:

- R-G4 (`onOut.next`, hostage sheet): the boxes clock running out in a short choice should move
  the call to `found`. Without it, the tree forks only the long choices.
- R9 (pacing line, the lead's): the call screens under E4 like the hostage.
- R7 (prose-lint compound loophole): see O1 below.

## Owner decisions this call adds

- O1, weapon words. `UNSAFE_DETAIL` (`src/gen/incident/gates/prose-lint.ts:2`) bans rifle, gun,
  firearm, shotgun and pistol; the old tree's 62 `unsafe` findings are mostly "rifle". "Handgun"
  passes only because the lint misses compounds (R7). This call does not depend on the loophole:
  it names the threat object as "a long weapon", "the weapon" and "armed", and the template's
  weapon stays `long_gun`. If the owner wants the specific noun ("hunting rifle") in player text,
  that is a lint policy change, not this call's.
- Apartments: the existing "Barricade building family" question stands.

## P. Call design record

```
Call design record
- Lane and version (row A): answered | call tree, content v13, fingerprints recapture needed yes
  (a new barricade tree replaces barricade-order; the lead's)
- Contract read (row A): partial, clocks.ts, authorization.ts, outcome-score.ts not re-read this pass
- Person and hook (rows B to D): the subject wants nothing else carried out; hook placeholder
  "{mover.first} went back in for the last box. Now the late owner's {subject^son|daughter|child}
  is armed inside and says nothing else leaves." about 105 chars bound, over the 2-line board
  clamp, prose cuts it; tests 1 to 8 by read; names 1; gap whether the subject knows the mover is
  inside
- Hook person in stage 3 (row C): yes, the mover as the stake in talking, threat, found and every
  ending's first sentence
- Memory anchor (rows C, I): pencil marks on the doorframe; callbacks planned in 2 of 11 endings
  (everyone_out, walked_them_out); counts at prose time
- Call-out earned (row B): armed "Patrol saw {subject.first} at the front window holding a long
  weapon"; threat "told them the next person through the door would regret it" (sourced);
  advantage "Every way out of the back bedroom runs through the hall"; refusal "won't come out"
- Self-harm risk (row B): present, E4 applied
- Iceberg tip (row B): the pencil marks, in talking.let_talk favorable, through turn_list
- People binding (row C): 3 roles, no group; threat enums from the template; civilian outcomes by
  the compiler
- Geography (row C): advantage line in row C; roles placed 7; in line of sight 2 (front window,
  hall), each priced on its summary
- Briefing and taps (row E): 8 lines, 9 with the pacing line; turn fact in known[0]; taps designed
  1/1/1 common, longest stage 3 chain 4; not walked: no tree yet
- Dilemma per stage (row F): 1 contact vs sight vs reaching the trapped person; 2 a move against a
  question per turn; 3 concession vs moving the mover vs time vs entry; checklist by read clean on
  the design, lines 2, 8, 9 and 10 need strings and are the prose and review lanes'
- Dominance grid (row F): filled for stages 1 and 3; phantom costs 0 by design (each cost has a
  charging outcome named); minutes rule pass; payoff column filled
- Action rows (row F): 9 nodes plus 3 turns, about 30 choices designed; helpers to reuse from the
  hostage tree (escalate, heldEnd); no layer reversed
- Force and entry gates (row F): 3 entry choices, visible at threat, fired_on, found; authorized by
  mark at_the_door; the clock never authorizes
- Stage exits and context prompts (row F): not walked: no tree yet; coverage gate at tree time
- Turn (row G): planted in known[0], revealed in the drawn turn prompt, reprices stage 1
- Consequence matrix (row H): escalation shape and clock forks designed; per-cell matrix at prose
  time, walked by the coverage gate
- Flags set, readers (row H): 8 marks, 8 with a reader, dead 0 by design
- Objective (rows H, I): not set: no tree yet
- Effects (row H): TreeOutcome keys only, plus R-B3 moveTo if it lands; OR scan 0
- Services (rows H, I): none (the medic is the squad's own)
- Ending reachability and triggers (row I): 11 endings designed; reachability not walked: no tree yet
- Endings and loop (rows I, J): best: everyone walks out and the boxes stay where they were set;
  partial: who is inside named in remainingTasks; loop: the pencil marks, the crew tomorrow
- Lever and minutes (row K): boxes clock out at about 46 to 86 minutes; pressure threshold at
  minute 260, unused
- Variants (row L): situation axes knows_mover, comes_out, volatility, demand; building axes need
  R-B1, R-B2, R-B3; correlated reveals listed; leak noted for review
- Call-tree gates: not run: no tree yet
- Ethics screen (row M): E1, E2, E6 to E10, E12 clear by design; E3 pending; E4 applies; E11 custody
  waits on O4
- E3 tally (row M): pending batch tally
- Crisis checks (row M): E4.5 vs E2.1 checked; content note and support line drafted; pending O2, R5
- Concessions (row M): take_list (statement), no held person a party
- Officer slots (row N): none reserved
- Requests and owner decisions (row O): needs gear-by-action, intel-odds; new R-B1 to R-B4; reuses
  R-G4, R9, R7; O1 weapon words, apartments
- Tells on hook and premise: written-voice checker not run on the placeholders (they are not ship
  text); checked by eye for dashes and colons
- Handoff: this sheet, then Codex adversarial review, then the lead, then swat-call-prose once the
  engine work lands
```
