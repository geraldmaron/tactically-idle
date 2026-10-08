# Call design sheet: One Last Signature (hostage_crisis, M2 slice 5 pilot)

Written through swat-call-design 0.3.0 for the call-tree lane. Every sample line here is a
placeholder for swat-call-prose; the shipped strings live in `src/content/call-trees/hostage-signature.ts`.
Private logic and the closing fact are marked NEVER PRINTED.

## A. Lane and version

- Lane: call tree (v13). Writer owns the whole `CallTree` and the `IncidentTemplate`
  (`src/content/incidents/hostage.ts`); the compiler owns node flags, routing, pruning per call and
  group size, binding, placement, the cascade lines, the force and fire lines, command lines and
  rewards by tier.
- Version: `INCIDENT_CONTENT_VERSION` 13, `CALL_TREE_CONTENT_VERSION` 13, read 2026-10-07. No
  `issued-v13` suite exists; the v13 trees are uncommitted. Owner direction on file (auto memory, "No
  legacy constraints"): in development, no freezes or back-compat. `compiled-fingerprints.test.ts` is
  the lead's to re-capture.
- Type id `hostage_crisis`; building types `market_row`, `corner_store_flat_g2`, `bar_restaurant_g2`;
  scene room `retail` (a counter, a till, regulars).

## B. Premise

```
Call type borrowed:  a workplace grievance that turns into a hostage-taking at a small shop
Person:              the taker (drawn name, adult), six years behind that counter, fired after the
                     till came up short; wants it in writing that they took nothing
Wrong note:          the one on the 911 call is a courier who only needed a signature
Worse if they wait:  the owner sits behind the counter with the person who blames them; in one
                     situation the owner's chest is giving out, and every long hold costs them
Why a tactical team: armed "Patrol says {taker} is holding a handgun on the people inside" (fact
                     claim); threat "Patrol says {taker.he} ... threatened the people inside"
                     (dispatch); advantage, the counter faces the only street door, and the people
                     inside are between it and the taker (stage 1 prompt and the map); refusal
                     "won’t let them go" (dispatch), "won’t let anyone leave" (hook)
Self-harm risk:      present for the taker: fired and called a thief in front of the regulars, a
                     grievance against a known person, a handgun, no demand that ends well. E4
                     applies (row M). The others: weapon access for some, hours cut over the same
                     till; screened in conservatively (noDeathOnCard on the whole slot)
Private logic:       six years at that counter, and the word "thief" said where the regulars could
                     hear. The taker can't go home with that word on them. The handgun was to make
                     the owner listen. In the third situation only the owner's own name under the
                     page takes the word back. NEVER PRINTED as an explanation
Iceberg tip:         "from the first customer to the till count", the taker's last day told their
                     way, in talking.last_day favorable, reached only through the six-years turn
                     (out_six_years.ask_courier) and then last_day
Closing fact:        whether anyone took the money is never settled on the call. NEVER PRINTED
```

**The others (slice 5 group), and why they are there.** The till came up short on a shift the taker
worked with one or two coworkers. The owner named the taker in front of the regulars and fired
them that afternoon; the others kept their jobs with their hours cut. This morning the taker asked
them to come back and say, in front of the owner, what they saw on that shift. They came to back a
story, not to hold anyone: the handgun came out of the taker's jacket after they were inside. Now
they stand between the till and the door, nearest the team. Private logic (NEVER PRINTED): walking
out now makes them the ones who left the taker to it, in front of the owner who still signs their
pay. That is a reason that comes from this premise, never a stock accomplice: they are witnesses
who stayed.

## C. Person cards

| Person | Wants, in their words | Fears | Behavioral reads | Memory anchor | How they know | Pronouns |
|---|---|---|---|---|---|---|
| taker (subject, leader, `{taker}`) | "Write down that I took nothing." | walking out past the street with "thief" still on them | calls back to ask after the courier; keeps checking the back door; keeps starting the story of the last day | the counter phone the 911 call came from | lived it | drawn, tokens only |
| courier (hostage, incidental hold, `{courier}`) | "I only needed one signature." | being the one left inside | sits on the boxes by the door; told the dispatcher the line above | the delivery slip nobody signed | was inside for all of it | drawn |
| owner (victim, expressive hold, `{owner}`) | won't sign what they don't believe | the handgun; in s2 their own chest | asks for reading glasses; refuses to sign on the line; in s2 sits down on the tiles | the stool behind the till | is the target | drawn |
| others (subjects, counted group `{others}`, 0 to 2) | to be out of it without being the ones who turned on the taker | being the ones who ran; losing the job | stand nearest the door; one holds the door for the courier; one locks the front when told; nod along to the taker's story | none of their own (text cannot vary per member, R-G2) | were on the last shift | drawn per member |

Hook person in stage 3: the courier opens the hook and is the stake through stage 2 (`walks`
choices) and in stage 3 prompts while still inside (`talking`, `standoff`, `threat` promptIf) and
every ending's first sentence; the slip is the courier's line in `everyone_out`.

Geography. Advantage line, quoted once: the counter faces the shop's only street door, and anyone
inside stands between the taker and that door. Roles against it:

| Role | Position | In the taker's line of sight? | Cost in text |
|---|---|---|---|
| negotiator ({lead}) | on the counter phone, from cover outside | no | none |
| team at the glass (`team_glass`, `talk_down`) | front windows | yes | "in plain sight of {taker}" on the summary |
| team at the alley door (`team_alley`, `alley_talk`) | rear exit | only through the gap at the door | "Boots on gravel carry inside"; "Only the door frame" |
| medic | at the curb until carried forward (`owner_down`) | no | none |
| patrol | outer perimeter, courier behind the car | no | none |

## D. Hook

Text: "{courier.first} should have left ten minutes ago. Now a fired worker with a handgun won’t let
anyone go." (review B5). The budget that binds is the Ops board card, which clamps the hook to 2
lines at 13.5px (`src/ui/screens/ops-visual.css:28`), about 103 to 106 characters at 390px, not
the live panel's 3 lines. The first wording (full name plus `{place}`, 127 to 132 characters bound)
was cut at "won’t let…" and, at long names, at "A fired employee with a…". The new line is 98
characters with the longest first name in the pools (Agnieszka); "handgun" ends at character 77.
Measured 2026-10-08 in a replica of the board card's CSS (Barlow 13.5px, line-height 1.35, card
padding 10px 11px, page gutter 16px) at 390px: 2 lines, not clamped, for eight names from 4 to 9
letters; the old line clamped at 3 lines for all eight. Not measured on the live board (the only
campaign loaded is the user's own). Tests 1 to 8: name at word 1; sentence 1 the wrong note;
sentence 2 the danger and the refusal; one gap (will the owner get out); no disclaimer; plain
danger words. One proper name: the board card already shows the building, so `{place}` was the
cheapest words to cut. In a group call the hook stays true: the taker is the one with the handgun.

## E. The ninety seconds

- Card: title, hook, pressure label "{owner.first} at the till".
- Briefing, counted as the player reads it (review F12): dispatch (2 sentences), 4 known lines, 1
  unknown, 2 team responsibilities, and in half the calls the compiler's deliberate-answers line
  (engine-owned, F11, the lead's): 8 lines, 9 with the pacing line. The first sheet counted only
  "4 known + 1 unknown" and so understated it. Changed for F12: the old known[0] ("came in with a
  delivery") is gone, since the courier's quote carries it; the three responsibilities fold to two;
  the freed known slot holds the advantage line (N17): "The only street door faces the counter,
  where {taker.first} keeps {owner.first} close."
- Taps, read from the routing (scratch `taps.ts`, a static walk of stage 3 edges): stages 1 and 2
  are one decision each. Stage 3 on the common path is one decision when the account or the talk
  at the glass ends with the handgun set down (F13: those favorable releases now go straight to the
  surrender and the cascade), otherwise two (`talking`, then `last_one`). The longest stage 3 chain
  is six: talking > standoff > threat > fired_on > last_one > stayed_behind. The first sheet's
  "1/1/1, longest 1/1/2" was false (the review found 2 common and 5 longest, from standoff). F13
  shortens the common path only; the escalation chain is unchanged and is an open design question
  (owner question 9).

## F. Stage table

Group size is drawn per call (template slot `subjects`, 1 to 3 people, weights 55/30/15, argued in
row L). Choices marked [group] exist only when the call has others; [lone] only when it has none,
so every menu stays at two to four options.

| Stage | Node | New fact on arrival | Options (what each protects / costs) | Waiting costs | Lever |
|---|---|---|---|---|---|
| 1 approach | `offer` | the taker offers the courier, keeps the owner; [group] the others stand between the till and the door | walk the courier out (one person out now / the owner left with the one person who blames them) · ask for the owner too (both covered / the offer can lapse) · hear the taker first (the story / the courier waits at the door) | the offer can lapse | `walks`, truth `lets_go`, meters |
| 2 turn | `out_back_door` · `out_keys` · `out_six_years` (drawn) | what the courier saw inside | per turn, a move against a question (team to the alley vs ask about the door; landlord's key vs ask to unlock; ask the courier vs call now) | the owner alone with the taker | turn group, marks |
| 2 turn | `both_inside` | the offer is gone | hold silent · ask again for the courier · [lone] move up to the glass · [group] give the others a way out | owner and courier stay in | truth `raised`, `others_out` |
| 2 turn | `his_side` | the taker wants it in writing | courier first · write it down (statement concession) · hear from the owner | courier at the door | authority statement, `owner_faint` |
| 2 turn | `one_door` | signature or nothing | [lone] take the courier now · [group] let the others walk the courier out · rule out the signature · offer a written account | the courier's door | `others_out`, authority |
| 3 commit | `talking` | the taker is on the line | take the account (favorable where the taker trades: the handgun goes down and the taker walks out with the owner, into the cascade) · [lone, hidden once the front is unbolted] ask for the owner · [group] let the others walk the owner out · turn payoffs (quiet exit, alley deal, alley talk, last day, the unlocked door) · let the taker set the pace (hours) | the owner's clock (s2), victim-class waiting | meters, clock forks, promises, cascade |
| 3 commit | `standoff` | bargaining stopped | into the night (all night) · read the account back · pull back | the owner's clock | clock forks |
| 3 commit | `threat` | handgun on the owner | talk down from the glass (favorable: the handgun goes down and the taker follows the owner out, into the cascade) · send the team in (entry) · pull everyone back | the owner in reach | authority entry, force, fire, cascade |
| 3 commit | `fired_on` | a shot at the glass | go in (harder) · hold and call | the owner in reach | authority entry, fire |
| 3 commit | `last_one` | civilians out | out the front · out the back (promise kept) · hold the perimeter | the taker, and [group] the others | **cascade** |
| 3 commit | `stayed_behind` [group] | some followed the taker out | call the rest out · wait for the rest | the stayers inside | meters (cascade earlier) |
| 3 commit | `nobody_followed` [group] | nobody followed | call them out by name · give them the night | the others inside | |
| 3 commit | `owner_down` (s2) | the owner collapsed and the taker is shouting for help | bring the medic to the door (talk) · go in for the owner (entry, the clock authorizes) | the owner on the floor | clock `onOut`, authority, force |

Dominance grid (four rules from dilemma-patterns.md), the stages where a tie was likeliest:

| Stage, option | Odds | Minutes | Unlocks | Who pays on adverse | Charged by | Cost the player sees | Value | Payoff only it produces |
|---|---|---|---|---|---|---|---|---|
| 1 walk the courier out | best (MOVE −6) | 2 | the courier's report (turn) | courier stays, two steps short | `offer.take_courier.adverse` → `both_inside` | "{owner.first} stays with the one person in there who blames {owner.him}" | one life out now | the turn's information |
| 1 ask for the owner too | mid | 4 | `terms` or the signature demand | the courier sits back down | `offer.ask_both.adverse` | "the offer may not last" | both covered | `his_side` with `terms` (+8 on writing it down) |
| 1 hear the taker | mid | 5 | `his_side`, or `silent` | both inside, line open and silent | `offer.hear_him.adverse` | "{courier.first} lingers by the door, bag on {courier.his} shoulder" | the taker heard (meters) | the taker's own story; `heard` lowers agitation |
| 2 [group] give the others a way out | mid | 4 | `others_out` | the owner (handgun may come up), the taker more worked up | `both_inside.free_others.adverse` (escalation) | "{taker.first} hears you pulling {taker.his} people away" | the others' lives and a lone taker | no cascade risk later |
| 3 [group] let the others walk the owner out | mid | 3 | `others_out` or a split group | the owner (escalation) | `talking.others_walk_owner.adverse` | "A no tells {taker.first} you are after {taker.his} people too" | the taker never hands the owner over | the owner out without a concession |
| 3 take the account | mid | 6 | `account`, or the surrender on favorable where the taker trades | the owner (escalation) | `talking.take_account.adverse` | "The account settles nothing about the till, and {taker.he} will hear that" | the concession, a commitment | kept commitment when the taker comes out, in the same decision on favorable |
| 3 [lone] ask for the owner | mid (TALK +6) | 2 | — | the owner (escalation) | `talking.ask_owner.adverse` | "{taker.first} may hear it as an order" | one minute saved | none where the front is unbolted, so it is hidden there (review N10: the unlocked door beat it by 12 points for one minute) |
| 3 let the taker set the pace | best (HOLD −10) | Hours | — | the owner's heart in s2 | clock fork `owner_condition` | "{owner.first} spends every hour of it behind the counter" | no push, no provocation | lowest provocation; the long night |

Minutes rule (E2): entries take 2 minutes against 30 to 40 for the long holds, so every entry costs
more in trust, strain and completion wherever it is reachable: `OUTCOME_SCORE_V1.force.entry`
(−2 trust, +3 strain), firearm review lines, and the entry endings name who was hurt.

Force and entry gates (E12.5). Every entry choice declares `authority: 'entry'`; the engine locks it
until a threat is believed:

| Action | Situation | Visible when | Threat that authorizes | Command line |
|---|---|---|---|---|
| `threat.go_in`, `fired_on.go_in` | all | at `threat` / `fired_on` only | fact `raised` confirmed ("{taker.first} pointed the handgun at {owner.first}") or mark `turned` ("{taker.first} turned the handgun on {owner.first}") | generated |
| `owner_down.go_in` | s2 | at `owner_down` only | urgent clock `owner_condition` low ("{owner.first} is down on the tiles behind the counter and can’t wait") | generated |

No summary or prompt says "Command approves"; the old `threat` promptIf that did is gone.

## G. Turn

Planted in known[1] ("{courier.first} told the dispatcher, “I only needed one signature.”": the
courier walked in for a signature and was inside for all of it; the old known[0] that said the same
went for F12) and in `offer.take_courier` (the cheapest first move). Revealed in the
drawn turn node's prompt (the back door, the keys, six years at that counter). Reprices stage 1:
walking the courier out first buys the information the stage 3 payoffs need (`wants_back`,
`spare_key`, `door_open`, `knows_story`).

## H. Consequences

Escalation, the model the brief asked for. Adverse results that refuse or provoke the taker are
"the truth decides, or a taker past breaking point does it anyway":

```
{ if: raised true }                                  -> threat (reveal raised)
{ if: [raised false, taker stance breaking] }        -> threat (mark turned, the threat mark)
{ if: [raised false, taker stance not breaking] }    -> standoff (reveal raised)
```

Meter branches read the taker at the start of the decision. Before stage 3 the taker can have been
provoked at most once, so no stage 2 decision can start at breaking (agitation 80 from a start of
60); stage 2 forks on the truth alone and stage 3 on truth and meters. In s1 the taker is drawn
steady or shifting, so two provocations (shifting) or four (steady) make a taker who would never
turn on the owner do it anyway; in s2 and s3 `raised` is true and the meters change the odds, not the
branch.

Mood is written as `moves`: heard (hear_him, ask_door), contact (pick-ups), provoked (pushes,
refusals, the owner refusing on the line), team_seen (team at the glass or the alley, also on the
others), released (the taker lets someone go), and kept or broken promises from the engine. The
only mood mark left is `hung_up`, a thing the team heard happen, read by the turn prompts.

Hostage against victim, made legible:

- The courier is the offer. The taker opens by giving the courier away; every courier release is a
  bargain over someone the taker never cared to hold (`walks: 'courier'`, `released` moves).
- The owner is what the grievance is about. Escalation is only ever toward the owner; summaries
  price that ("the one person who blames {owner.him}"); the engine adds the victim-incident weights
  on every hold ("Waiting while {owner} is the one {taker} blames") and scales the taker's agitation
  contributor x1.5.
- Releasing the owner always costs the taker something they came for: the account, the alley, the
  last day, or [group] letting their own people walk the owner out so they never hand the owner over.

Group consequences:

- `free_others` (both_inside) and `others_courier` (one_door) separate the group before the end;
  `others_walk_owner` (talking) uses it as a face-saving release. Favorable takes the others out
  (`out: ['others']`, mark `others_out`); mixed keeps them in but `heard` raises their rapport, which
  raises their chance to follow later; adverse escalates and provokes the others too.
- The taker's surrender at `last_one` carries `cascade: { leader: 'taker', group: 'others' }`:
  all → the surrender ending (everyone out; a lone call routes here directly); some →
  `stayed_behind`; none → `nobody_followed`. Each member follows with 0.25 + 0.5 x influence +
  rapport − agitation terms (CASCADE_V1).
- Influence per situation (template): s1 0.55 to 0.9 (they came for the taker and go where the
  taker goes), s2 0.4 to 0.8, s3 0.1 to 0.45 (the taker stopped listening to them; they freeze when
  the taker walks).

The owner's clock (s2 only), rate 1.2 a minute from 60 (±25% per call): first cue at 55, about four
minutes in ("Through the glass, the team sees {owner.first} get down from the stool and sit on the
tiles", mark `owner_unwell`); runs out about 40 to 67 minutes in. It authorizes entry once low. The
long choices (`spare_key`, `his_pace`, `into_night`) fork on it and narrate the collapse; anywhere
else `onOut: { harm: 'serious', mark: 'owner_down' }` records it, and the prompts of the nodes a
collapse can lead into read `owner_down`.

Mixed bands (review B7). The sheet claimed every mixed band differs from favorable by who is talking,
where a person is or a mark. Three did not: they only added time. Now `talking.his_pace` mixed (the
taker would trade, the owner fine) sets `still_armed`, which `last_one` reads in its prompt and as a
−8 on both walk-outs, and its line says the handgun stays in the taker's lap; `stayed_behind.wait_rest`
and `nobody_followed.give_night` favorable route to `group_out` (out before morning) and keep mixed
on `group_out_dawn`, so `group_out_dawn` is reached only at first light.

Held endings (review F8). Every hold that ends with the owner inside routes four ways on two facts,
the courier still inside and the `owner_down` mark the clock's `onOut` sets: `held_inside`,
`held_both`, `owner_left_down`, and the new `held_both_down` (the owner collapsed and the courier
still inside), with the courier line and the collapse line added as separate addenda. Before, a
collapse with the courier inside reported `held_both` and "Get {owner.first} off that stool".

Flags set and their readers are listed in the prose record (the gate "reads every mark it sets"
enforces it).

## I. Endings

| Ending | Disposition | Each person's state | remainingTasks |
|---|---|---|---|
| `everyone_out` | resolved | courier and owner out; taker (and every other who followed) with the team | — |
| `out_the_back` | resolved | as above, out the alley; the back-door promise kept | — |
| `out_by_dawn` | resolved | as above, after the night | — |
| `group_out` [group] | resolved | the stayers talked out, or out before morning after a wait | — |
| `group_out_dawn` [group] | resolved | the stayers out at first light (the mixed waits only) | — |
| `entry_clean` | resolved | everyone out unhurt; the entry is scored and reviewed in the debrief | — |
| `entry_hurt` | resolved | owner hurt in the entry; taker taken unhurt | — |
| `went_in_for_owner` (s2) | resolved | owner carried out after collapsing; taker taken unhurt | — |
| `went_in_taker_hurt` (s2) | resolved | owner carried out; taker hurt by the team's force, medic working | — |
| `owner_killed` | relief_partial | owner died at the counter; taker taken unhurt | — |
| `owner_killed_taker_hurt` | relief_partial | owner died; taker hurt by the team's force, medic working (E4.5) | — |
| `owner_collapsed` | relief_partial | owner carried out to the medic; taker still inside | bring everyone left out |
| `owner_left_down` (s2) | relief_partial | owner down inside; taker won't open | get the owner out; bring everyone out |
| `owner_beaten` | relief_partial | owner hurt and made to sign; taker inside with the page | bring everyone left out |
| `taker_held` | relief_partial | civilians out; the taker still inside | bring everyone left out |
| `stayers_held` [group] | relief_partial | the taker out; someone who came with them still inside | bring the rest out |
| `held_inside` | relief_partial | owner inside, courier out | get the owner out; bring everyone out |
| `held_both` | relief_partial | both inside, the owner on the stool | get both out; bring everyone out |
| `held_both_down` (s2) | relief_partial | both inside, the owner collapsed (F8) | a medic to the owner; the courier out; the handgun set aside |
| `handed_over` | unresolved | as last seen | everyone |

Endings carry title, summary and disposition only. Trust, strain and the review line come from
`OUTCOME_SCORE_V1` in the debrief, so no ending says "goes to review" (the E2.1 versus prose-skill
question the M1 findings left open is settled here in favor of the debrief line).

## J. Open loop

The courier's slip is still unsigned in every ending that names it; the owner won't go back behind
the counter tonight; [group] the coworkers still work there.

## K. Levers

Clock (`owner_condition`, s2) with forks and `onOut`; meters and meter branches; authority (entry,
statement, surrender terms); promises (`back_door` to the taker; the statement concessions are
commitments by rule); the cascade; drawn fire and force. Pressure block unchanged (start 20,
0.25 a minute, threshold 85: minute 260, beyond any path; it never stands in for a deadline).

## L. Variant plan

| Axis | s1 | s2 | s3 |
|---|---|---|---|
| `lets_go` (trades the owner for an account) | true | true | false |
| `raised` (turns on the owner when refused) | false | true | true |
| `owner_faint` (owner's heart) | false | true, clock | false |
| taker volatility | steady or shifting (drawn) | volatile | volatile, hostile |
| demand | statement (concedable) | statement | the owner's signature (never) |
| others' influence | 0.55 to 0.9 | 0.4 to 0.8 | 0.1 to 0.45 |
| turn (drawn per call) | back door / keys / six years | same | same |
| group size (drawn per call) | 1, 2, 3 people at 55/30/15 | same | same |

Group size weights argued: a personal grievance is a lone act at heart and should stay the common
case (55%); a pair (30%) is the premise's natural group, one coworker from the same shift; three
(15%) is the most the shop floor and the story carry (the stress-test cap for a corner store is the
template maximum, and the scale class "small group" starts at three). At 45% the player meets a
group call often enough to learn that the others can be reached, without the lone call becoming
the exception.

Members draw their own weapon: nothing (60%) or something heavy from behind the counter (blunt,
40%), never a handgun of their own: they came to back a story, and only the taker brought one.
Text never names a member's weapon (R-G1); the odds and the people panel show it.

Correlated hidden axes: `lets_go` and `raised` together set the situation; `owner_faint` only in
s2. Cheapest reveals: `lets_go` by `ask_both` (4 minutes, TALK), `write_now`, `take_account`,
`ask_owner` and every release; `raised` only on an adverse result. Intensity: heavy.

## M. Ethics screen

- E1 clear: decisions and costs only; no entry method or munition named (the force lines are the
  engine's standard lines).
- E2 clear: entries score worst on trust and strain (row F minutes rule); the best endings are
  walk-outs; no civilian gesture defuses a drawn weapon.
- E3: pending batch tally. Identity is drawn per person from one distribution; no mechanic reads it.
- E4 applies to the taker (row B). E4.5 checked against E2.1: no path shows the taker's death
  (`noDeathOnCard`, force `noFatal`); the worst is "badly hurt ... the medic is working". The
  negotiator asks the direct question off the card. Drafts, pending O2 and R5: content note "This
  call involves a person with a handgun who may be at risk of harming themselves." Debrief support
  line "If this call brought something up for you, in the US you can call or text 988. Elsewhere,
  contact local emergency or crisis services."
- E5 n/a. E6: every entry says who can be hurt in its summary. E7 clear. E8 clear (composite).
- E9 clear: every ending states the taker's state; the others' states are in the cascade lines and
  the group endings.
- E10 clear. E11: allegations carry "says"; the money question is never settled. Custody is not
  clean yet (review F5, open for the owner under O4): `everyone_out` says "with the team now", but
  `out_the_back` and `stayers_held` say "in custody", `stayed_behind.prompt` says "are in custody",
  and `last_one.out_front.mixed` has "Two officers walk {taker.him} to the car". The first sheet
  said surrender was "with the team now" throughout, which was false. Left as written until the
  owner rules on O4; the review's neutral replacements are in its F5 row.
- E12.1 quoted in row B; the advantage is now a player line too (known[3], review N17). E12.2:
  positions in row C. E12.3: nobody at the tape carries a message;
  the others are asked to walk out themselves, never to carry the team's words to the taker.
  E12.4: the clock never creates the threat; entry on the clock is for the owner's collapse (care),
  E6.1. E12.5: row F.
- Concessions: `write_now`, `offer_record`, `take_account` (statement: the team writes the taker's
  words down to pass on; command's line is generated); `back_deal` (surrender terms: the alley door,
  promised to the taker). No held person is asked to sign or bargain; `owner_voice` lets the owner
  speak for themselves only if they choose.

## N. Officer slots

None reserved; `{lead}` does the risky part in every stage's summaries.

## O. Engineering requests

None blocks this call; each is a shape the data could not hold, worked around in content as noted.

```
Engineering request R-G1
Need:            a group member's own weapon in text and in belief (the team learns who holds what)
Current limit:   TreeState has no condition on a member's drawn weapon; incidentPeopleFor gives a
                 member no armamentFactId, so the odds read a member's real armament as known
Build links:     content/call-trees/types.ts TreeState; gen/incident/instance.ts incidentPeopleFor
Proposed field:  TreeState.armed?: { role, min? } (count of members holding something), and a
                 per-member weapon fact; default absent, issued output byte-identical
Content version: v13 (open)
Blocks:          row C (others' reads), row L (members' weapons are never named in text)
Extends:         new
```

```
Engineering request R-G2
Need:            the drawn group role (follower, lookout) to change something the player meets
Current limit:   GroupRole.role is drawn and shown in the lab only (WIRED group: influence only);
                 GroupSpec draws influence independently of role
Build links:     content/incidents/types.ts GroupSpec; sim/drawn-effects.ts CASCADE_V1
Proposed field:  GroupSpec.influenceByRole?: Record<'follower' | 'lookout', {min, max}>, and a
                 TreeState role condition on the first member; default absent
Content version: v13
Blocks:          row C (the lookout reads nowhere in text)
Extends:         new
```

```
Engineering request R-G3
Need:            briefing lines that name the group in a group call
Current limit:   CallTree.briefing lines take no count condition, so the card and briefing can't
                 say "two came in with {taker}"; the group is introduced by the stage 1 promptIf
Build links:     content/call-trees/types.ts CallTree.briefing; compile.ts treeForCounts
Proposed field:  briefing.known entries as string | { when: TreeState; text }; default string
Content version: v13
Blocks:          row E (briefing)
Extends:         R1 (per-call compiler strings) in spirit
```

```
Engineering request R-G4
Need:            a clock that runs out where no fork reads it to move the call to a node
Current limit:   ClockDef.onOut records harm and sets a mark only; the tree must fork every long
                 choice on the clock to reach `owner_down`, and short choices that run it out
                 leave the call where it was (5 threat and 26 fired_on states in the first forced walk; 6 and 6
                 in the 2026-10-08 forced walk of 32 starts, plus 103 states at last_one,
                 stayed_behind and nobody_followed where the clock ran out in the decision that
                 released the owner)
Build links:     sim/clocks.ts clockOutEffects; content/incidents/types.ts Clock.onOut
Proposed field:  onOut.next?: TreeNext, applied when the owner is still inside and the decision's
                 own outcome did not end the call; default absent
Content version: v13
Blocks:          row H (the collapse anywhere)
Extends:         new
```

```
Engineering request R-E1 (applied by the lead before the review; kept for the record)
Need:            the debrief to tell a civilian hurt while still inside from one hurt and out
Current limit:   sim/outcome-score.ts endStates maps every injured_needs_care civilian to 'hurt'
                 and CIVILIAN_TEXT.hurt prints "<name> is out, hurt." even when the clock's onOut
                 hurt the owner inside (owner_left_down, a held ending after a collapse)
Build links:     sim/outcome-score.ts endStates, CIVILIAN_TEXT
Proposed field:  EndState 'hurt_inside' with its own text and weight; scored output changes only
                 for calls where onOut harms someone who stays inside
Content version: engine, OUTCOME_SCORE_V1 -> V2
Blocks:          row I (owner_left_down's debrief line)
Extends:         new
```

R-E1 is applied (by the lead, before the review): `sim/outcome-score.ts` has `hurtInside`, which
prints "<name> is still inside, hurt." (or "badly hurt") for a civilian hurt where they were and
never brought out. The first sheet still called it a request (stale, review N5).

```
Engineering request R9 (filed for review F11; the lead is handling it)
Need:            the compiler's deliberate-answers briefing line, which narrates a mechanic about the
                 subject ("takes a long time to answer ... two extra minutes"), to be opted out of
                 or authored per tree, since the taker is screened under E4
Current limit:   src/gen/incident/trees-v13/compile.ts appends the line in half of all calls
Proposed field:  a per-tree pacing opt-out or a tree-authored pacing line; the review drafts
                 "{taker.first} goes quiet for a long time before each answer, dispatch says."
Blocks:          row E (briefing), row M (E4)
```

The review also filed requests outside this sheet's lane, listed so they are not lost: N6 (the
coverage gate's starts should cross group size; the crossed walk below does), N7 (check-strings
should bind distinct names, he and she), N9 (prose-lint on dashes, colons, stock phrases), N15 and
N16 (R-G3 extended to count-conditioned briefing lines and ending addenda, so "anyone with him" and
the coworkers' end state can depend on the group), N21 (a shift sampler for crisis frequency).

Tooling, applied by the lead (the first sheet said "described rather than applied", stale, review N5):

- T1, checker artifact. `game_string_checks.py` now keys repeats by field, so one field's rows for
  two situations no longer count as a repeat, and path-echo skips the same field's row for another
  situation.
- T2, place name. `scripts/check-strings.ts` now passes "Fox" and "Pheasant" to `--cast` with the
  person names.

The first sheet's claim that every check-strings finding was T1 or T2 was false: the committed
checker also named three 4-word runs shared by two different fields, and the patched checker still
found four when the call is bound with distinct names and he or she (review F2). All four are
rewritten; see the prose record.

## P. Call design record

```
Call design record
- Lane and version (row A): answered | call tree, content v13, suites read call-trees, coverage,
  groups, instance, outcome-score, commitments, call-tree-balance; no issued-v13 suite; owner
  direction on file (no freezes in development)
- Contract read (row A): answered | CallTree and TreeOutcome types, compile.ts (groups, count,
  cascade, force, fire, routing), clocks.ts (forks, onOut), meters.ts (stances), authorization.ts,
  commitments.ts, outcome-score.ts, incident-factors.ts (INCIDENT_CLASS_V1), drawn-effects.ts
  (CASCADE_V1), read 2026-10-07
- Person and hook (rows B to D): taker wants it on paper that they took nothing; hook
  "{courier.first} should have left ten minutes ago. Now a fired worker with a handgun won’t let
  anyone go." 98 chars bound with the longest first name, 2 lines on a replica of the board card
  at 390px (the first hook, 127 to 132 chars, clamped and could lose the handgun: review B5);
  first sentence 7 words; tests 1 to 8 pass; names 1; gap whether the owner gets out
- Hook person in stage 3 (row C): yes, the courier is the stake in stage 3 prompts while inside
  and leaves with the owner in every release (courierToo)
- Memory anchor (rows C, I): the courier's slip; callbacks 2 of 20 endings (everyone_out,
  owner_killed), in 2 results (take_courier, ask_again); anchor closers 2; same subject+verb closers max 2
- Call-out earned (row B): armed "Patrol says {taker} is holding a handgun on the people
  inside"; threat "threatened the people inside"; advantage, the counter facing the only street
  door with people between; refusal "won’t let them go"
- Self-harm risk (row B): present for the taker (fired, called a thief in front of the regulars,
  grievance against a known person, handgun); E4 applied, noDeathOnCard and force noFatal
- Iceberg tip (row B): "from the first customer to the till count" in talking.last_day,
  reached only through out_six_years.ask_courier then last_day
- People binding (row C): 3 roles plus 0 to 2 members, placed by placeCast, story-bound,
  incidentPeople with group role and influence; enums by the template; civilian outcomes by the
  compiler
- Geography (row C): advantage line in row C; roles placed 5; in line of sight 2 (glass, alley),
  each priced in its summary
- Briefing and taps (row E): dispatch 2 sentences, 4 known (one is the advantage line), 1
  unknown, 2 responsibilities, plus the engine's pacing line in half the calls: 8 lines, 9 with it;
  stage 3 taps 1 on the common path when the handgun goes down (F13), else 2; longest stage 3
  chain 6 (talking > standoff > threat > fired_on > last_one > stayed_behind, static walk). The
  first record's "4 known + 1 unknown" and "1/1/1, longest 1/1/2" were false
- Dilemma per stage (row F): 1 one life out now vs the deal for both; 2 information or reach vs
  provoking the taker over the owner, and [group] separating the others vs leaving the taker
  alone with the owner; 3 concession vs pressure vs time, [group] a face-saving release vs
  showing the taker you are working on their people; checklist, after the review: line 3 true
  for a returning player in s2 (B9, open, owner), line 9 true where a collapse prints under a
  favorable band (B6, the lead's), lines 5 and 10 fixed (B7), the rest clear. The first record's
  "1 to 10 clean by read" was false
- Dominance grid (row F): grid in row F; phantom costs 0 (every cost is charged by a routed
  outcome); minutes rule passes (entries 2 minutes, scored worst on trust and strain); payoff
  column filled
- Action rows (row F): 46 choices, 15 nodes; structural helpers reused (escalate, heldEnd,
  courierToo, surrender); no layer reversed
- Force and entry gates (row F): 3 entry choices; visible only at threat, fired_on, owner_down;
  authorized by fact raised, mark turned, or the urgent clock; offered-but-never-authorized 0
  (call-trees gate)
- Stage exits and context prompts (row F): every band routes once in every reachable state
  (coverage gate 0 gaps; crossed walk 0 gaps over 54 starts, every situation x group size x turn x
  pacing, 195,226 states, 2026-10-08); promptIf ordered most specific first. `fired_on` is also
  reached from the alley shot, so its prompts no longer say the glass
- Turn (row G): planted in known[1] (the courier's quote), revealed in the drawn turn node's prompt, reprices
  take_courier
- Consequence matrix (row H): 327 outcomes across 46 choices (held endings split four ways);
  mixed bands differ from favorable by who is talking, where a person is, a mark read later, or
  the ending. The first record said so before it was true: three mixed bands only added time
  (B7), fixed in row H
- Flags set, readers (row H): marks 18 (hung_up, counting, silent, terms, sign_demand,
  team_close, wants_back, spare_key, door_open, knows_story, owner_heard, owner_unwell,
  owner_down, account, still_armed, back_promised, turned, others_out); dead 0 (call-trees
  gate "reads every mark it sets")
- Objective (rows H, I): objective deltas kept per band; the two releases that now end in the
  surrender carry the walk-out's share too (take_account 80, talk_down 75); endings 20
- Effects (row H): TreeOutcome keys only; OR scan 0 (conditions are ANDed or split)
- Services (rows H, I): none (the medic is the squad's own; no external service)
- Ending reachability and triggers (row I): 20 endings, 19 reached in the crossed walk (handed_over
  is the fallback); summaries read against the paths the review named (F8, F9, F10, N11, N13) and
  rewritten; clock times 0
- Endings and loop (rows I, J): best: everyone walks out and the courier still has the slip;
  partial: who is still inside named in remainingTasks; loop: the slip, the coworkers' jobs
- Lever and minutes (row K): clock (rate 1.2, ±25%, out at about 40 to 67 minutes), meters,
  authority, promises, cascade, drawn fire and force; pressure threshold at minute 260, unused
- Variants (row L): axes lets_go, raised, owner_faint, taker volatility, demand, others'
  influence, turn, group size; correlated: lets_go and raised fixed per situation
- Distinctness gate: covered by call-trees "gives the choices at a node different futures" (pass)
- Ethics screen (row M): E1 clear, E2 clear, E3 pending (F14, the lead's, then a human read), E4
  applies (the pacing line is F11, the lead's), E5 n/a, E6 clear, E7 clear, E8 clear, E9 clear,
  E10 clear, E11 open on custody wording (F5, O4), E12.1 to E12.5 clear
- E3 tally (row M): pending batch tally
- Crisis checks (row M): E4.5 vs E2.1 checked; content note and support line drafted in row M;
  pending O2, R5
- Concessions (row M): write_now, offer_record, take_account (statement), back_deal (surrender
  terms, promise back_door); no held person a party
- Officer slots (row N): none reserved; {lead} in 29 summaries across all stages (26 in a lone
  call), never twice in one string (review B1: the engine replaced only the first, so a second
  printed raw; the engine fix is the lead's)
- Requests and owner decisions (row O): R-G1 to R-G4 open; R9 filed (F11, the lead's); R-E1, T1
  and T2 applied by the lead; owner questions in the prose record
- Tells on hook and premise: swat-call-prose checker run on every string (prose record)
- Handoff: this file, then swat-call-prose (record below), then swat-writing-review (done by a
  separate reader, `docs/calls/hostage-signature-review.md`, verdict edit); the response to each
  finding is in the review response section at the end
```

## Prose record (swat-call-prose 0.3.0)

Contact device: the counter phone, a landline at the till. It rings out, goes face down, is
unplugged; the team never hangs up a cord-free phone. One result tense: present (endings may close
in past). Clock form: no clock times; time is "after dark", "near midnight", "at first light".

```
Call prose record (revised 2026-10-08 after the writing review; first written 2026-10-07)
- Input: answered | design sheet above (rows A to P), and docs/calls/hostage-signature-review.md
- Coverage: answered | every TreeChoice title, summary, three previews and every outcome written;
  every node prompt and promptIf; every ending title, summary and task; facts, clock label and cue;
  engine default: command lines, cascade, fire and force lines | placeholders 0 in the data. The
  first record said "placeholders 0" while two summaries held a second {lead}, which the engine
  left raw (review B1); no string now holds {lead} twice, and the engine fix is the lead's.
  Routing-only outcomes carry text '' by design (the addendum beside them is the line)
- Bands: answered | 46 choices, every band routed with text in every reachable state (coverage
  gate 0 gaps; crossed walk over every situation x group size x turn x pacing, 54 starts, 195,226
  states, 142,224 endings, 0 gaps, 2026-10-08); adverse previews 46/46
- Preview vs result: answered | 45 truth-branched bands read against each situation's result
  (scratch previews.ts, two others, distinct names). The first record's "false 0" was false: three
  previews were false in a situation (review B2 his_door favorable in s3, B3 others_walk_owner
  mixed in s3, B4 fired_on.go_in adverse in s1 and s2). All three rewritten; false 0 on the
  re-read. fired_on's prompts and a hold line said "the glass" though the alley shot also leads
  there; rewritten to the shot itself
- Budgets: answered | 701 strings at two others (684 at one, 642 lone); over-limit 0; over-target 0
  (distinct names, 12 bindings); hook 98 chars bound with the longest first name, 2 lines on the
  board card's 2-line clamp (row D). The first record measured the hook against the live panel's
  3 lines, which is not the surface that clamps hardest
- Punctuation: answered | dashes 0, colons 0, semicolons 0, clock times 0
- Sourced once: answered | the taker's account carries "says" (known[0]); the courier's quote is
  quoted; the money is never settled; truth differences across situations only in truth branches
- Option cost and swap: answered | 46 options; every summary names a cost a person pays; the
  two summaries that named the officer twice now name the officer's exposure without a second
  {lead} ("Only the door frame shields the officer from the handgun"; "in plain view and in line
  with the handgun")
- Variants: answered | 4-word runs 0, path echoes 0, repeated sentences 0 through the repo
  checker, bound with distinct names per role at 0, 1 and 2 others with mixed, he, she and they
  pronouns (scratch strings2.ts, 12 bindings, every one exit 0), and `bun scripts/check-strings.ts
  hostage_crisis` exit 0. The first record's "4-word runs 0" held only for the repo script's one
  shared name; with distinct names there were four (review F2), now rewritten
- Syntax: answered | inversions 0, fronted 0, tense mixes 0, results present 184 / past 17 (the
  past rows are reported speech and "-ed" adjectives, read). Name openers (review F1): about one
  taker-opened sentence in three now opens on an object or another person, never inverted (82 of
  248 in the source); the checker's taker share fell from 27% to 19% and names and pronouns from
  56% to 48% (distinct names, two others). Still above the 35% house figure; reported, not chased
  further, because the next cuts start to read as dodges
- Group text: answered | agreement scan 0 slips at 0, 1 and 2 others for every role as he, she and
  they; no member pronoun after `{others.first}` unless it means the group (review B8 fixed); no
  group name repeated back to back (review F3 fixed); the inversion in one_door (F4) fixed
- Objects and roles: answered | every "it" read alone (34 to 36 rows by binding), referent inside
  the string; threat pronouns 0; the handgun named in every threat line; role-position 0
- Tells: answered | feelings 0, policy voice 0, stock 0, stock spoken 0, narrator hedges 0,
  address mix 0; surrender pose "hands up" gone (F6), "in seconds" gone (F7)
- String checks: answered | repo check-strings exit 0 (repeat 0, ngram 0, path-echo 0); the
  first record's line that every finding was a T1 or T2 artifact was false (row O) | cadence 0.41
  FLAT and path-repeat (580 on the repo binding) reported, as before | written-voice not installed
- {lead} uses: answered | 29 strings at two others (26 lone), in every stage, one per string
- Lint policy collisions (owner decision, not blocker): unchanged; "handgun", "armed", "hurt",
  "die" as before (O1)
- Ethics line: answered | E1, E2, E4 and E4.5, E6, E7, E9, E12.3, E12.5 as before; E11.1 is not
  clean yet: four custody lines wait on O4 (F5), and the first record's "neutral custody lines"
  was false; E12.1 advantage now a known line (N17)
- Gates: answered | npx tsc -b --noEmit exit 0; vitest call-trees, coverage, groups, instance,
  outcome-score, commitments: 6 files, 129 tests, exit 0; call-tree-balance: 7 tests, exit 0;
  check-strings exit 0; crossed walk 0 gaps (all 2026-10-08) | compiled-fingerprints not run (the
  lead re-captures) | outcome-score.test.ts gained the held_both_down row (held_both with the owner
  hurt: −4 trust, +6 strain)
- Punch-up: answered | every changed string read in path order at two others with distinct
  names, he, she and they (scratch read.ts export, before against after)
- Version: answered | strings land in v13 (open); no issued text touched
- Handoff: back to swat-writing-review for the passes these fixes touched
```

Measured on 2026-10-08, tier 2 (`measure`, `trees-v13/balance.ts`). 60 calls per style:

| Style | Clean | Costly | Unresolved | Hurt | Died | Officer hurt | Mean minutes |
|---|---|---|---|---|---|---|---|
| random | 23.3% | 43.3% | 25.0% | 5.0% | 3.3% | 3.3% | 57 |
| best odds | 0% | 66.7% | 30.0% | 3.3% | 0% | 0% | 64 |
| patient | 0% | 90.0% | 5.0% | 5.0% | 0% | 0% | 90 |
| fast | 28.3% | 1.7% | 56.7% | 5.0% | 8.3% | 3.3% | 15 |

At 60 calls the death rates are a handful of calls, so the same two styles were run at 300 calls
on the tree before and after this pass (the file swapped in place and restored):

| Style, 300 calls | Clean | Costly | Unresolved | Hurt | Died |
|---|---|---|---|---|---|
| random, before | 17.3% | 48.3% | 28.3% | 4.7% | 1.3% |
| random, after | 21.7% | 45.0% | 27.3% | 4.7% | 1.3% |
| fast, before | 28.7% | 2.3% | 60.0% | 6.0% | 3.0% |
| fast, after | 29.0% | 2.3% | 59.7% | 6.0% | 3.0% |

More clean outcomes come from F13 (a taker who sets the handgun down walks out in the same
decision); harm and deaths are unchanged. The 2026-10-07 table (random 16.7% clean, fast 5.0%
died at 60 calls) is superseded.

Owner questions:

1. Endings no longer say "goes to review"; the debrief's score line does (the open E2.1 versus
   prose-skill question from M1). Confirm.
2. O1: the call keeps "handgun" (a compound the typed lint misses) and uses "armed", "hurt",
   "die" in entry previews. Confirm the armed-lane word policy.
3. E2.2 human read of each death and the beating: `owner_killed`, `owner_killed_taker_hurt`,
   `owner_beaten`, and `threat.step_back.adverse` in s3.
4. E4.7, O2 and R5: the content note and 988 debrief line (row M) still have no surface.
5. The group: coworkers from the last shift, 1 to 3 people at 55/30/15, never a handgun of
   their own. Confirm the premise and the weights.
6. The owner's clock runs out at about 40 to 67 minutes: collapses come from the long holds, which
   fork on it. Where it runs out inside the decision that releases the owner (103 states in the
   32-start forced walk of 2026-10-08), the ending's text does not know; the debrief's hurt line does (R-E1). R-G4 would
   close it.
7. Test fixtures changed with the call: `instance.test.ts` borrows the barricade as its group-less
   template, and `outcome-score.test.ts` lists the nine new endings (now with `held_both_down`) by
   the closest retired ending's numbers (labelled there).
8. The lets-go entry struggle (`go_in` adverse when the taker would trade) stays hand-written:
   the force model would pick the firearm (a believed gun in hand) where the text has the taker
   let go. Keep, or route it through `force`?
9. Stage 3 can still run six decisions (talking > standoff > threat > fired_on > last_one >
   stayed_behind). F13 shortened the common path only. Accept the long escalation chain, or have
   design fold a step (for example `fired_on.hold_corner` favorable straight into the surrender)?
10. B9, open: the owner's condition exists only in s2, the one situation where the taker both
    trades and turns on a refusal, so the clock cue ("sit on the tiles", 3 to 6 minutes in) tells a
    returning player the truth for free; taker volatility is also volatile only where `raised` is
    true. The review's fix is an engineering request (the owner's condition drawn per call,
    independent of the situation) plus drawing the taker's volatility from the same pick in every
    situation. Whether a replay leak counts as "truth leaks through structure" (reject) is yours.
11. F5 and O4, open: the custody wording in four lines (row M). The review's neutral lines are
    ready to apply once you rule.
12. F14, open: the subject slot's surname draw is not uniform (the lead is fixing the draw); the
    counts then go to a human read (E3).
13. N19, open: the debrief charges the all-night hold that kept everyone alive a time line ("The
    team was on scene for 83 minutes.", −1 trust). Restraint still outscores force. Acceptable?
14. B5: fixed in data (98 characters, 2 lines). You may still want the board to clamp hooks at 3
    lines like the live panel; that is engineering.
15. N4: the group titles ("Give {others.first} a way out", "Let {others.first} take
    {courier.first} out", "Let {others.first} see {owner.first} out") name one member while every
    member goes. "Open the front to {others}" binds to about 39 characters and 7 words with two
    long names, past the 5-word title target and the 30 characters the review asked for, so the
    titles stay as they are.
16. N8 and N20 are fixes to the skills' own reference files (the board clamp in
    `swat-call-prose/references/surface-budgets.md`; fake-choice lines 9 and 10 in
    `swat-writing-review/SKILL.md`). Outside this call's files, so not applied here.

## Review response (2026-10-08)

Every finding in `docs/calls/hostage-signature-review.md`, and what this pass did. "Lead" means the
lead is handling the engineering; "owner" means it waits on a ruling.

| ID | Response |
|---|---|
| B1 | Data side fixed: no string holds a second {lead} (alley_talk and talk_down summaries). Engine fix (replace every {lead}): lead |
| B2 | `talking.his_door.preview.favorable` now "You get a straight answer, and the front stays unbolted.", true in all three situations |
| B3 | `talking.others_walk_owner.preview.mixed` now "{others} end up at the till beside {taker.first}, who keeps the handgun."; the s1 and s2 result now sends them to the till |
| B4 | `fired_on.go_in.preview.adverse` now "{taker.first} meets you at the till, armed. {owner.first} may not survive the entry, and {taker.first} may be hurt too.", true for the drag, the second shot and the s3 shot |
| B5 | Hook rewritten, 98 characters at the longest name, 2 lines on the board card replica (row D) |
| B6 | Lead (result labels); the three strings were left as they are |
| B7 | his_pace mixed sets `still_armed` with its own line; wait_rest and give_night favorable route to `group_out` |
| B8 | `one_door.others_courier.adverse[0]` now "{taker.first} beats {others.first} to the door and puts a hand on the bolt." |
| B9 | Open, owner (question 10) |
| F1 | 82 of 248 taker-opened sentences now open on an object or another person; checker taker share 27% to 19%, names and pronouns 56% to 48% |
| F2 | All four runs rewritten (courier_first adverse, ask_door mixed, ask_again mixed, owner_down.go_in summary); 0 at 12 distinct-name bindings |
| F3 | free_others favorable, others_walk_owner favorable (both rows), give_night summary, call_others mixed rewritten so no group name repeats back to back |
| F4 | one_door.promptIf[1] now "{others} stand nearest the exit, and {courier.first} is right behind them." |
| F5 | Open, owner (O4; question 11) |
| F6 | "hands up" and "raise their hands" gone (call_others favorable, fired_on.go_in favorable) |
| F7 | "in seconds" gone; the owner-down entry now has officers over the counter while the taker looks the other way |
| F8 | New ending `held_both_down`; every held end and `owner_down.medic_door` adverse route there when the owner has collapsed with the courier inside |
| F9 | `entry_hurt` no longer says "without a fight" or "getting checked"; "getting care at the curb, hurt in the entry" covers both severities |
| F10 | `owner_killed_taker_hurt` now "{courier.first} is safe in a patrol car now." |
| F11 | Lead (pacing line); R9 filed in row O |
| F12 | known[0] dropped, responsibilities folded to two; the count recorded honestly in row E |
| F13 | take_account and talk_down favorable releases go straight into the surrender and the cascade; longest chain recorded (question 9) |
| F14 | Lead (draw), then owner (question 12) |
| N1 | None needed |
| N2, N3 | talking.promptIf[0] no longer restates the cue or claims breathlessness; his_side.prompt and threat.prompt no longer restate the result above them |
| N4 | Kept, reason recorded (question 15) |
| N5 | Rows O and P corrected: T1, T2 and R-E1 applied by the lead |
| N6, N7, N9, N15, N16, N21 | Engineering, listed in row O; this pass ran the crossed walk (54 starts) and the distinct-name check in scratch |
| N8, N20 | Skill files, not applied (question 16) |
| N10 | `ask_owner` hidden once the front is unbolted |
| N11 | out_by_dawn "have been outside for hours" |
| N12 | group_out no longer narrates the coworkers' reason |
| N13 | group_out_dawn "left hours ago"; it is now reached only at first light |
| N14 | medic_door favorable leaves the handgun on the counter behind the taker, matching "still armed" |
| N17 | Advantage line added as known[3] |
| N18 | "is still in there with", "is left in there with" and "is still sitting by the door" varied |
| N19 | Open, owner (question 13) |
