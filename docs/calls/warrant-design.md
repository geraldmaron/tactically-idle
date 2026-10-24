DRAFT (the separate swat-writing-review read, the Scenario Lab read, the E3 batch tally and the owner's read are not done)

# The Room Next Door: design sheet

The warrant call (world redesign, wave 1, calls lane). Strings ship in
`src/content/call-trees/warrant.ts` with `warrant-parts.ts`, `warrant-approach.ts` and
`warrant-resolve.ts` beside it, and the template in `src/content/incidents/warrant.ts`. Lines in this
sheet are placeholders where they differ from the data.

## A. Lane and version

- Lane: call tree, content v13 (`CALL_TREE_CONTENT_VERSION`). Compiled fingerprints need a recapture:
  yes, because this is a new compiled call (the lead recaptures at the end of the build).
- Type `barricaded`, template `worldOnly: true`: the board never draws it; the world-calls lane sends
  it from a warrant card and casts the lead's subject into the one subject role, `lt`, through
  `IncidentSpec.cast`. Every subject string is tokens only.
- Buildings: `two_storey_house_g2`, `semi_detached_g2` (a house let by the room) and
  `corner_store_flat_g2` (rooms over a corner store). Setting `residential` or `business`. Scene room,
  ground floor, by preference: hall, living, kitchen, retail (the squad stages at the foot of the stairs).
- Placement: `lt` in an upstairs bedroom or living room; `parent` in another upstairs bedroom or
  living room; `kid` in a third upstairs room (bedroom, living, office or storage); `landlord` outside
  with patrol. A building without three upstairs rooms can't host the call and hosting moves on
  (60 of 60 direct specs hosted).
- Contract read: answered. `CallTree`, `TreeEnding.world` (merged from 4690e1e), `IncidentTemplate`
  (`worldOnly`), `compile.ts` placeCast, the offsite rule (`validateScenario`: "authored harm needs a
  v13 bound person"), force variants and `noDeathOnCard`, `outcome-score.ts` lines (time.longAt 45).

### Where this departs from the canvas, and why

The canvas drew "214 Ninth Street": an upstairs flat over a laundromat, a family asleep next door.
No building family generates a laundromat, and a role placed `offsite` (a family in the next building)
is never a bound engine person: it can't be marked safe, harmed or counted in the debrief. So the
family is next door in the engine's sense: the rooms beside his, off the same landing, in a house let
by the room or over a corner store. The prose never names the business downstairs. Request O1 below
asks for a laundromat family if the owner wants the canvas literal.

## B. Premise

```
Call type borrowed:  barricade on a warrant service, before dawn
Person:              {lt}, a crew lieutenant (age drawn adult, pronouns cast from the world), wants
                     one thing the door can buy: time, the child spared the sight, or witnesses
Wrong note:          "Not tonight" through the door, then the light under it goes out
Worse if they wait:  the parent's alarm at 5:15 puts the family on the landing; the street wakes up
Why a tactical team: armed "The warrant says {lt.first} carries a handgun, seen on {lt.him} last week."
                     crime "Command has a warrant for {lt} ..."; advantage: an upstairs room with the
                     only stairs below it and a family off the same landing; refusal "won’t come out"
Self-harm risk:      screened. No loss event, goodbye or withdrawal; in every situation he asks about
                     tomorrow (his grandmother, the bus, who will see). Recorded per situation in
                     `selfHarmScreened`. Force on him is spared anyway (noFatal, noDeathOnCard): the
                     city sends this call more than any other, and a subject's death stays off it.
Private logic:       s1 he is leaving by the ladder he stood under the family's window; s2 he won't
                     be taken where the child he walks to the bus can see; s3 a cousin was hurt in a
                     raid in the dark, so he comes out only in daylight with the street watching
Lenses:              L7 reframe (primary), L2 the obvious read is wrong (secondary)
Reframe:             s1 "Not tonight" and the ten minutes for his grandmother were him lacing boots;
                     s2 "Are they still asleep next door?" was care, not a threat; s3 the quiet dark the
                     team chose for the family's sake is what keeps him in
Temptation:          tell him he'll sleep at home tonight (`home_tonight`); cue: the cuffs named in its
                     summary and on the officer's belt (way_out promptIf); breaks at the foot of the
                     stairs on every walk-out (`foundOut`), or when the team owns it (`own_lie`)
Iceberg tip:         the heavy bag with duct tape round its middle, via `name_at_door` favorable
Closing fact:        why he won't open the door. NEVER PRINTED as a narrator fact
```

## C. People

- **{lt}**, crew lieutenant, the subject. Wants, in his words: "Not tonight." Fears being taken where
  the wrong person sees (s2) or where nobody sees (s3), or being caught at all (s1). Reads: dressed and
  pacing (s1), sitting on the bed facing the family's wall (s2), standing at the door with a camera
  propped on the dresser (s3). Memory anchor: the boxing gym and its taped heavy bag, called back in the
  tie choices and one epilogue. Voice: short, repeats "not tonight", asks one question twice. Breaking
  point: the lost-control mechanism (a flashlight at his window, the landing filling, the ladder taken).
- **{parent}**, neighbor next door, civilian. Works the early shift, alarm at 5:15. Knows what he asked
  last night (the turn's source). Voice: tired, practical ("I’ve got work").
- **{kid}**, the parent's child, 8 to 12, civilian. Knocks on the wall at night to say goodnight to
  whoever is on the other side. The person whose sight decides s2, and the person in the doorway when
  an entry goes wrong.
- **{landlord}**, outside with patrol, bystander. Gave the key and the sleeping arrangements; a source
  that can be wrong, never on the line.
- Geography. Advantage line: the stairs are the only way down, and the family's door is on the same
  landing. Patrol holds front and back from the start (containment is the default). Officers placed on
  the landing (`name_at_door`, `hold_landing`, `talk_down`, `walk_beside`, `sit_on_stairs`) are in his
  line of sight, and each says so in its cost.
- Civilian outcomes compile from roles: `parent` and `kid`, safe flags set together by `familyOut()`.

## D. Hook

"{lt} won’t open the door. A child sleeps in the next room, and {lt.first} may be armed." 86
characters authored, 105 bound with the longest pool names. The name is the first token; sentence one is the refusal; sentence two is who gets hurt if the
team waits and the danger in plain words. One gap (why he won't come out). One proper name.

## E. The ninety seconds

- Briefing: dispatch reason, two known lines (the family beside him off the same landing, known[0], is
  the fact the turn depends on; the 5:15 alarm, known[1]), the public handgun fact appended, one
  unknown ("Why {lt.first} won’t open the door"). Four known in all.
- Taps: stage 1 one tap; stage 2 one tap (two on the family_up detour); stage 3 one tap on the common
  path, three on the longest (way_out, last_door or threat, fired_on).

## F. Stages and choices

| Stage | Node | Choices (kind) | Stance |
|---|---|---|---|
| 1 | `the_knock` | `wake_family` (coordination, escort), `watch_back` (observation, vantage), `name_at_door` (contact, tie) | move the family first, look first, or talk first |
| 2 | `through_door` | `ask_terms` (contact), `gym_talk` (contact, tie), `home_tonight` (contact, lie), `bring_family_now` (coordination, only with the family in) | ask the price, earn him, lie, or empty the landing |
| 2 | `family_out` | `ask_parent` (observation), `hold_landing` (coordination), `call_gym` (contact, tie) | learn, hold the landing, or talk as a friend |
| 2 | `family_up` | `back_inside` (contact), `bring_down` (coordination, escort), `hold_him_talk` (contact) | lock them in, run them past his door, or hold his attention |
| 3 | `way_out` | `come_down_now`, `wait_light` (40 min), `walk_beside` (tie, needs `talking`), `cover_back` (needs `ladder_seen`), `own_lie` (needs `lied_home`) | dark and quick, daylight and witnessed, a friend beside him, shut the back, take back the lie |
| 3 | `last_door` | `step_down`, `sit_on_stairs` (tie) | talk him down in front of the street, or sit with him |
| 3 | `back_roof` | `call_down` (contact), `hold_ladder` (coordination), `let_go` (contact hold) | voice, grab, or let him go safely |
| 3 | `threat` | `talk_down`, `go_in` (entry), `pull_back` | stand in front of the handgun, go up, or give him room |
| 3 | `fired_on` | `go_in_now` (entry), `hold_call` | go up after a shot, or take him at his word |

Every node has a threat (the alarm, the street waking, the bus, the kid on the landing, the street
filling, full daylight, the bottom of the ladder, daylight on the stairs, calls from the block); none
names harm, and each times out forward. Every stage offers contact, observation or coordination, and
execution or a hold; every stage has a certificate (crisis_negotiation, surveillance, deescalation).

### The tie choices (world-calls lane)

`WARRANT_TIE_CHOICES` in `warrant-parts.ts`: `the_knock.name_at_door`, `through_door.gym_talk`,
`family_out.call_gym`, `way_out.walk_beside`, `last_door.sit_on_stairs` (action ids
`t13_barricaded_<node>_<choice>`). Each is written for any officer and says what someone who knows him
can do (the name only his family uses, the gym), never that a bonus exists. `name_at_door` carries
+10 difficulty because a stranger using that name is a real risk; the tie contributor (capped, visible)
is what makes it the knowing officer's move.

### Dominance (abridged; costs quoted from summaries and costs)

- **Stage 1.** `wake_family` empties the landing (the only option that gets the family out first, +30
  objective) but "{lt.first} learns exactly where your officers are standing" (`heard_landing`, -4 on
  later talk and moves), and its adverse leaves the family awake on the landing. `watch_back` is the only
  stage 1 look at the handgun and the ladder, but "The family stays asleep next to {lt.first} while you
  look", and its adverse wakes them. `name_at_door` opens `talking` (and so `walk_beside`) and puts an
  officer at his door (`team_close`, +8 on entry) at the hardest odds, and "From a stranger, that name can
  shut the door for good" (`name_burned`, -6 on `gym_talk`). It does not cover the escape: with the
  family asleep next door he can still go for their room. None beats another on every column.
- **Stage 2.** `ask_terms` is the plain reveal of his want (s2, s3) or a stall (s1); `gym_talk` buys
  rapport and `talking`, never a reveal; `home_tonight` is the best favorable now (+15, pressure -5) and
  is a lie with a cued break; `bring_family_now` empties the landing at the cost of his attention.
  `ask_parent` is the only route to the s1 window story without a look out back, and costs the child's
  hearing (`kid_watching`, which s2 punishes). `hold_landing` is the only stage 2 way to cover the escape.
- **Stage 3.** `come_down_now` is right in s2 and when covered in s1, wrong in s3 (he balks in the dark)
  and dangerous in s1 uncovered with the family in. `wait_light` is right in s3, wrong in s1 uncovered
  (his time), and costs a long call in every situation (40 minutes, the score's long-call line).
  `walk_beside` is the warm exit and the most exposed officer. `cover_back` shuts s1 and is visible only
  after the ladder is known.

### Force and entry (E12.5)

| Action | Visible when | Threat line that sets the mark |
|---|---|---|
| `threat.go_in` | at `threat`, reached only on `at_family`, `gun_up` | "...steps out with a handgun in one hand, heading for the family’s room" (s1); "...the handgun up between {lt.him} and the officer" (s1, s3) |
| `fired_on.go_in_now` | after `shot_inside` | "{lt.first} fires down the stairs..." |

`authority: 'entry'` locks both until a threat mark is seen. s2 never reaches either (unarmed, no
`at_family` branch, no `gun_up` branch). Force (`noFatal`) sits only on the entry adverse with the
family out; with the family in, the adverse is the parent hurt shielding the child (`family_hurt`).

## G. Turn

Planted in the briefing (known[0], the family beside him off the same landing) and his line "Are they
still asleep next door?" (through_door exchange). Revealed by `ask_terms`, `ask_parent` or `watch_back`.
Reprices stage 1: waking the family was right in s2 and opened the ladder's way in s1; leaving them
asleep was right for a quick s2 walk-out and put them in his path in s1.

## H. Marks and readers

All marks are read (call-tree gate). Load-bearing ones: `heard_landing` (modifiers), `ladder_seen`
(`cover_back`, prompts), `talking` (`walk_beside`, `talk_down` +6), `team_close` (`go_in` +8), `covered`
(the s1 branch), `for_kid_known` and `wants_seen` (prompts, modifiers, epilogues), `kid_watching` (s2
branch, modifiers), `lied_home` / `owned_lie` (the lie), `at_family` / `gun_up` / `shot_inside`
(threat marks), `street_up` (-3 on the quiet walk, +3 on waiting), `officer_down` (epilogues).

Every adverse result costs something (conflict gate, run on a scratch copy because the gate exempts the
`barricaded` type by name). Escalation palette: lost control (flashlight, landing, ladder), the crowd
(street waking), a deadline passing (the alarm, daylight), bargaining collapse (the lie found out),
the call from home (the grandmother he wants on the line), withdrawal is not used (E4 screen).

## I. Endings and the investigation (`TreeEnding.world`)

| Ending | Disposition | world.resolution | Who is where |
|---|---|---|---|
| `walked_out` | resolved | charged | he came down hands open (negotiated walk-out); family unhurt |
| `custody_clean` | resolved | charged | taken at the door, the ladder or an entry, nobody hurt |
| `custody_hurt` | resolved | charged | taken after he was hurt (a fall from the ladder, an entry, force) |
| `family_hurt` | resolved | charged | the parent hurt shielding the child in an entry or a second shot |
| `escaped` | relief_partial | escaped | out through the back; family safe; the lead stays open |
| `held_in` | relief_partial | escaped | still behind his door; family out |
| `held_with_family` | relief_partial | escaped | still behind his door; family still upstairs |
| `in_with_family` | relief_partial | escaped | shut in the family's room with them (family put at risk) |
| `handed_over` | unresolved | escaped | no step left |

`escaped` means the lead stays open, which is also the truth of every held ending: the warrant is not
served. Every closing ending pays the same award (lead's rule). Epilogues per ending, with `epilogueIf`
for the lie, the officer hit, what he waited for and the gym. Open loop: the backpack found two streets
over, the bus the child takes tomorrow.

## K. Levers

Pressure: start 14, +0.18 a minute, threshold 85 (about minute 394, never reached by pressure alone;
the threats push it). Clocks: none (the alarm and the street are node threats). Difficulty: base 48,
+4 a tier, set from the balance runs below.

## L. Variants

| Axis | s1 Leaving | s2 The kid | s3 Witnesses |
|---|---|---|---|
| handgun | true | false | true |
| leaving | true | false | false |
| for_kid | false | true | false |
| witnesses | false | false | true |
| volatility | steady/shifting | steady | shifting/volatile |

Cheapest reveal per truth: `watch_back` (LOOK +3, 4 min, family stays asleep) settles handgun and
leaving; `ask_terms` (TALK +5, 4 min) settles for_kid or witnesses and only stalls in s1; `ask_parent`
(ASK -2, 4 min, needs the family out first) settles any of the three. No prompt or option differs by
situation before its fact is settled (the s1-only `cover_back` needs `ladder_seen`, a reveal).

## M. Ethics screen

- E1 no method: decisions and costs only. E2 force never the reward: entry endings cost trust and go to
  review; the best grade is a walk-out. E3: pending batch tally (the subject is cast from the world).
- E4 screened per situation (`selfHarmScreened`); the negotiator never needs the direct question, and no
  path is self-directed. E5 n/a. E6 the entry names who pays (the family a wall away). E7 no wound
  detail. E8 composite. E9 his life counts: force is noFatal. E10 command and the negotiator are never
  the obstacle. E11.1 every custody line is "the team has {lt.him}" or the approved neutral sentence.
- E12.1 quoted in B. E12.2 the family on the landing is the stated cost of every move past his door.
  E12.3 no family on the line ("no family goes on the line"); the landlord is a source only. E12.4 no
  threat sets a threat mark. E12.5 entry only behind `at_family`, `gun_up` or `shot_inside`.
- Descriptors: s1 and s3 `injury`, `police_gunfire`, `child_at_risk`; s2 none (no harm reachable).

## O. Engineering requests and owner decisions

- O1 (owner): the canvas's laundromat. Needs a building family or a name variant; until then the call
  sits in a rooming house or over a corner store.
- R-world-1 (tooling): `drawIncidentSpec` never picks a `worldOnly` call, so every gate that draws by
  type plays another call against this tree: call-trees "generates, binds and validates", graph "matches
  the compiled call", `balance.ts` drawCalls (so `call-tree-balance` for barricaded), instance.test's
  three per-template checks, generation "distinct types", shift-sampler "opens every type". Each needs
  specs built directly for world-only templates; this lane ran scratch copies that do that (recorded below).
- R-world-2 (tooling): `conflict-gates.test.ts` exempts the `barricaded` type as legacy by name; the
  warrant tree passes the gates and should not be exempt.

## Balance (scratch measure on 60 direct specs per style, 40 for best odds, tier 2)

| Style | Clean | Costly | Unresolved | Hurt | Died | Escaped | Gate |
|---|---|---|---|---|---|---|---|
| random | 26.7% | 45.0% | 20.0% | 8.3% | 0% | 3.3% | clean 15 to 60, bad 15 to 65, harm 1 to 30, death 0 to 8: pass |
| best_odds | 62.5% | 30.0% | 5.0% | 2.5% | 0% | 0% | clean at most 75: pass |
| patient | 0% | 73.3% | 23.3% | 3.3% | 0% | 8.3% | no band |
| fast | 11.7% | 73.3% | 8.3% | 6.7% | 0% | 0% | no band |

Changes the runs forced: difficulty base 36 to 48; `name_at_door` +4 to +10 and no longer marks the
escape covered (it was a dominant line in s1); `ask_terms` +5, `come_down_now` +7, `wait_light` HOLD +3
and 40 minutes (dawn from 4:50 is most of an hour, and the score's long-call line now charges it),
`walk_beside` +5, `step_down` +4, `sit_on_stairs` +5, `watch_back` LOOK +3.

## Call design record

- Lane and version (row A): answered | call tree, content v13, compiled fingerprints recapture needed yes, a new compiled call
- Contract read (row A): answered
- Person and hook (rows B to D): {lt} wants time, the child spared, or witnesses; hook "{lt} won’t open the door. A child sleeps in the next room, and {lt.first} may be armed." 86 chars authored, 105 bound; tests 1 to 8 pass; names 1; gap why he won't come out
- Hook person in stage 3 (row C): yes, as stake in every stage 3 prompt
- Memory anchor (rows C, I): the gym and its taped bag; callbacks 1 of 9 endings (walked_out epilogueIf); anchor closers 1; same subject+verb closers max 2; motif max per path 3 (tie choices)
- Call-out earned (row B): quoted in B for armed, crime, advantage, refusal
- Self-harm risk (row B): screened, per situation in `selfHarmScreened`
- Iceberg tip (row B): the taped heavy bag, in `name_at_door` favorable, reached only through that choice
- People binding (row C): 4 people, threat enums checked (agitated or distressed, barricade or escape, aware, carried), civilian outcome lines 2
- Geography (row C): advantage line "the only stairs below his room, the family's door on the same landing"; roles placed 4; in line of sight 5 choices, each with its cost
- Briefing and taps (row E): 4 known incl. the public fact, turn fact in known[0]; taps s1 1/1, s2 1/2, s3 1/3
- Dilemma per stage (row F): 1 the family's safety against surprise and information; 2 the truth against rapport against the lie; 3 the quiet exit against the witnessed one; checklist 1 to 10 clean by read; options exclusive
- Dominance grid (row F): none beaten; phantom costs 0; minutes rule pass (entries are 2 minutes and cost trust, review and the family's risk); payoff column filled
- Action rows (row F): 28 choices across 9 nodes, incomplete 0; helpers searched (hostage-live-parts turnsOn, heldEnd, holdTheNight, foundOut) and reused in shape
- Force and entry gates (row F): 2 entry actions; visible only behind threat marks; s2 force visible 0
- Stage exits and context prompts (row F): every node times out forward; promptIf orders walked, first match wins
- Turn (row G): planted in known[0] and the through_door exchange, revealed by ask_terms, ask_parent, watch_back, reprices wake_family and the stage 1 hold
- Consequence matrix (row H): every truth-branched action has a routed outcome per situation and state (coverage gate)
- Flags set, readers (row H): all read, dead 0 (call-tree gate)
- Objective (rows H, I): walk-outs 55 to 70, custody 40 to 60, hurt 20 to 35, holds 10 to 25
- Effects (row H): keys from `TreeOutcome` only; OR scan 0 (the `covered` mark is the derived either-or)
- Services (rows H, I): none
- Ending reachability and triggers (row I): 9 endings, all reached in the balance runs except handed_over (engine fallback)
- Endings and loop (rows I, J): best walk-out leaves the child asking who walks them to the bus; partial endings list remainingTasks; loop the backpack and the bus
- Lever and minutes (row K): node threats, pressure 14 + 0.18/min
- Variants (row L): 4 axes, one truth per situation; correlated none; visibility reveals paired
- Call-tree gates: `npx vitest run src/gen/incident/trees-v13/call-trees.test.ts -t barricaded` 16 of 17 pass, the 17th is R-world-1; coverage `-t barricaded` exit 0; scratch copies of the draw-based gates pass
- Depth plan: lenses L7, L2; reframes in B; palette lost control, crowd, deadline, bargaining collapse, call from home (max 2 per path); temptation home_tonight, cue the cuffs, break foundOut and own_lie; voices lt, parent, kid, landlord, negotiator, radio; epilogues 9 of 9 endings
- Ethics screen (row M): clear per M
- E3 tally (row M): pending batch tally
- Crisis checks (row M): E4.1 method 0; E4.2 release 0; screened per situation
- Concessions (row M): none (the porch light in s3 is a command act in the result, not a concession to a held person)
- Officer slots (row N): none reserved; no branch depends on an officer; the tie is engine-read
- Requests and owner decisions (row O): O1, R-world-1, R-world-2
- Tells on hook and premise: swat-call-prose checker, see the prose record
- Handoff: this sheet, next swat-writing-review

## Call prose record

- Input: answered | this design sheet
- Coverage: answered | every writer field written; engine default for the standard fire and force lines; placeholders 0
- Bands: answered | 28 actions, every band in every situation it reaches (coverage gate), adverse previews 28/28
- Preview vs result: answered | read per situation; previews describe execution where the truth decides (come_down_now, wait_light)
- Budgets: answered | 556 bound strings; over limit 0; locked clamp 0; over target 36 (long results, mostly stage 3 truth branches), sentence over 22 words 24 (hostage 32)
- Punctuation: answered | dashes 0, colons 0 outside clock times, clock form digits (4:50, 5:15, 5:30)
- Sourced once: answered | the handgun and the corner trade sourced to the warrant, the family's rooms and alarm to the landlord
- Option cost and swap: answered | cost collisions 0 by read, swap read per node
- Variants: answered | checker ngram 28 runs of 6 or more words (hostage 48), most are the house's geography ("the foot of the stairs"); the approved custody sentence repeats on purpose (E11.1)
- Syntax: answered | inversions 0, fronted 0, fragments 0, result tense present (7 past, reported speech), name openers 26% (subject's first name)
- Objects and roles: answered | the handgun named in every threat line, threat-it 0, role-position 0, device cell phone throughout
- Tells: answered | feelings 0, policy voice 0, stock spoken 0, narrator hedges 0, address mix 0 (script and read)
- String checks: answered | `game_string_checks.py` on the three bound casts (longest names they, distinct he, distinct she) exit 1, blocking families left ngram 27 to 28 and path-echo 3 (hostage on the same procedure: ngram 48, path-echo 18, exit 1); sheet-term 11 in the he run only, the checker misreading bound "her" (hostage shows 20 there); cadence 0.51 FLAT, opener share subject 26%; written-voice not run in this harness
- {lead} uses: answered | 22 across all three stages
- Lint policy collisions: none
- Ethics line: answered | E1 to E12 from the design rulebook
- Gates: answered | see the design record
- Punch-up: answered | seven passes done, endings written last
- Version: answered | strings land in v13; fingerprints recapture needed yes (new call)
- Handoff: ready for swat-writing-review | structural notes none open
