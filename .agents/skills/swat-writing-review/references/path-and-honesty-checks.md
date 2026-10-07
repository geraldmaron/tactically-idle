# Path and honesty checks

The mechanical checks behind SKILL.md passes one, two, four and five. Each one exists because a
proof round on 2026-10-06 shipped a review that signed off a fault the check would have caught.
The faults are quoted from those proof drafts (round1-hostage, round1-fall and an officer sheet),
which were drafts and never shipped. Every check has a literal record line. A check you could not
run is recorded as "not run | <reason>", never left out.

## 1. Restatement across surfaces (pass one)

The player reads the card, the dispatch line, the known lines and the first stage prompt in that
order, in seconds. A fact said twice spends seconds and teaches the player to skim.

1. Write each surface's facts as a short list, in reading order.
2. For each fact on a later surface, mark it new, changed (the clock moved, a person moved, a
   number changed) or restated.
3. A restated fact is a finding. In the first stage prompt it is fix before freeze. On the
   dispatch line or a known line it is a note unless it repeats the card word for word.

Observed (proof draft, hostage). Card "Lewis wants Mara Holt's signature by 6", dispatch "He says
Mara signs his statement by 6.", stage 1 prompt "Lewis wants Mara's signature by 6." Three
surfaces carry one fact. The stage 1 prompt should carry a change, such as what Lewis did when
patrol knocked.

```
Restatement <call>, s<n> | facts <n> | new <n> | changed <n> | restated <n> | first stage prompt restates <yes | no>
```

## 2. Claims in the deliverable, falsified against the table (pass two)

Every summary claim an author makes ("every band differs", "no option dominates", "every stage
has a real choice", "the set is complete") is a hypothesis. Find the row that would break it.

```
| Claim, quoted | Row that would falsify it | Checked against | Holds |
| 'Every band differs' | any action whose mixed text is its favorable text plus minutes | action table s3.3, 12 talk actions | no |
```

A claim that does not hold is a finding at the severity of the fault it hides, and the record's
claim line counts it. Observed (proof draft, hostage). The summary said "Every band differs" while
twelve talk actions had a mixed band written "as favorable, +N min". The self-review missed it
because it read the summary, not the table.

## 3. Mixed and adverse bands that only cost time (pass two)

For each action, put the favorable, mixed and adverse texts side by side. If the mixed text is
the favorable text with a delay ("Lewis tells you, after a long pause."), the middle outcome,
which players see most, only moves a clock. That is fake-choice 5 for the band. It is fix before
freeze, and a block when the deliverable claims otherwise. A mixed band changes contact, trust,
evidence, a person's position or a resource.

## 4. Options that can be taken together (pass two)

For each stage, list the options and mark every pair a player can take in the same stage, in
either order, before the stage advances. A takeable pair is an ordering, not a dilemma, unless
taking one closes or prices the other. Record it as fake-choice 3 with test wait.

Observed (proof draft, hostage). "Ask what Monday is" and "Let Ben walk out now" could both be
taken in stage 2, since the stage advanced only when both flags were set. A rational player
always asks first. The draft's own checklist rated the row "clear".

## 5. Dominance across options (pass two)

For each stage, build this table from the data, not the summaries.

```
| Option | Odds | Minutes | What it reveals or sets | Adverse result | Beaten on every axis by |
| Call Lucia from the curb | 60 | 4 (+2 slow answer) | on_line | busy line | Call her daughter back |
```

An option beaten on every column by another is fake-choice 3. An option with the lowest odds,
the slowest clock and a best result that settles nothing is filler at that beat and the same
finding. Observed (proof draft, fall). The record reported "swap failures 0" over a dominated
option, because the swap test was run and the dominance table was not.

## 6. Taps and chores per stage (pass two)

Count the longest tap sequence in each stage, and mark taps with only one sensible choice (a
care chore such as "Hand Mara to the crew"). More than three taps in the commit stage, or any
chore tap at the commit beat, is fix before freeze routed to swat-call-design. The commit beat
holds the peak decision, and chores bury it. Observed (proof draft, hostage). Stage 3 ran up to
11 taps, three of them chores.

## 7. The static walk (pass two, when no explorer output exists)

Hand-sketched paths are not a path read. When nothing is built, walk the design statically.

1. For each stage, list every flag state the design can produce on entry.
2. In each state, list the visible actions. Take each action's adverse band last, and confirm
   at least one action still advances the stage. A state with no advancing action is a dead end,
   which is a block.
3. For each hidden fact, list every action whose truth branch, observation or reveal settles it,
   with its cost. Any action that settles the fact more cheaply than the action designed to
   reveal it is an oracle, which is fake-choice 3.
4. For each pressure or clock rule, follow it past the point where the people are safe. A clock
   that keeps costing after safety, or a prompt that can fire after its moment passed, is an
   engine finding.

```
Static walk <call>, s<n> | states <n> | dead ends <n> | cheaper reveals <n> | clocks past safety <n> | exits confirmed <n of n>
```

Observed (proof draft, hostage). Releasing Ben first left "Ask what Monday is" as the only route
on, and its adverse band set no stage, so the call stranded on the engine's fallback ending.
Patrol's look settled the motive at 2 minutes and difficulty D, against 4 minutes and D+6 for
the designed question.

## 8. Result cell coverage and placeholders (pass two)

Every action with a truth branch needs text in every band by situation cell. Build the grid.

```
| Action | s1 fav | s1 mixed | s1 adv | s2 fav | s2 mixed | s2 adv | s3 fav | s3 mixed | s3 adv |
| Entry, key or ram | yes | no | yes | yes | no | no | no | yes | no |
```

Any "no" on a reachable cell is a block. Then search every string for placeholder shapes, which
are text in parentheses or brackets that describes a string instead of being one, words such as
"placeholder", "TBD", "TODO", "replaced by" or "compiler-style", and a string identical to its
field name. A placeholder is a block, and a record that calls the set complete while one exists
is a second finding against that record. Observed (proof draft, fall). "(compiler-style late text
replaced by the summary's cost)" sat in a shipped preview slot under a record line reading
"answered | 120 strings".

## 9. Previews that presume the truth (pass four)

A preview is shown before the check, so it must hold in every situation. For each action with a
truth branch, read each band's preview against each situation's result.

```
| Action | Band | Preview, quoted | s1 result agrees | s2 result agrees | s3 result agrees |
```

A preview that is false in any situation is a leak and a block, whether it tells too much or
tells the wrong thing. A band whose result does not change across a roll in some situation means
the roll changes nothing there, which is fake-choice 1. Observed (proof draft, fall). The adverse
preview "She has it in her hand when the door opens." held only in situation 1. In situations 2
and 3 the result read "Her hands are empty."

## 10. Implied outcomes (pass four, H1 to H5)

Implied counts as stated. These words are findings unless negated in a line the player could
have suspected, or unless the call shows the step that caused them.

| Implies | Words to search |
| --- | --- |
| custody | released, in custody, booked, bail, to the car, in the cruiser, in cuffs, cuffed, taken in, held overnight |
| a charge or verdict | charged, faces charges, will be prosecuted, guilty, convicted |
| recovery | will be fine, recovering, made it, out of danger |
| a completed handover | handed over, in their care, taken by the crew, admitted |

Observed (proof draft, hostage). "Mara asked patrol who will tell her when Lewis is released"
and "Patrol walks him to the car" passed the H1 check, which looked only for "arrest". Route a
call that needs a custody ending to the owner, since the engine has no custody outcome.

## 11. Endings true on every path that reaches them (pass four)

For each ending, list every path that can reach it and the clock or flag state on arrival. Read
every field the ending shows against each path, not only the summary. That means the title, the
summary, each `remainingTasks` line, each `civilianOutcomes` label it sets and each objective it
marks complete. A fixed line that names a time, an arrival, a person's position or an earlier
step must be true on all of them, or it becomes a finding routed to swat-call-design (the ending
needs a condition or a when-variant) or engineering (the field cannot vary).

A still-needed line or a completed objective that presumes an earlier choice (an evacuation, a
key, a call) is false on any path that skipped it. Gate it with a when-variant, or word it so it
holds on every path. Telling a player who kept the family home that the family can go home again
reads as the game not watching, which is the opposite of a felt consequence.

```
| Ending | Paths reaching it | Clock range on arrival | Line, quoted | Still needed, quoted | Objective marked done | False on |
| held_night | s2 call_first a, ask_direct a, go_in a, wait_night | 300 to 521 | 'He came out at first light' | 'Tell the neighbors when they can go home' | neighbors kept clear | every path where the neighbors never left |
```

Also flag any absolute clock time ("at 2:10") in a call with no fixed start time. Observed
(proof draft, fall). Three endings named the daughter's position, and each was false on at
least one path. Observed (proof draft, round 2). A still-needed line about sending neighbors
home sat on an ending reachable without the evacuation.

## 12. Activation, force paths and positions (pass five)

Five authenticity checks the rulebook states and the proof drafts failed.

1. Activation earned in player text. Quote the player-visible lines that show each call-out
   condition in E12 (armed or able to reach a weapon, a crime or threat, a position of
   advantage, refusal of lawful arrest). A condition shown only in the design sheet does not
   count. If the text supports patrol, a crisis-trained officer and EMS instead of a tactical
   team, it is a structure finding routed to swat-call-design. Observed (proof draft, fall). An
   injured 84-year-old who mentioned a weapon and refused care, with no threat in the text.
2. The negotiator passes nothing command has not approved, and never relays a third party's
   unverified allegation to the subject. A favorable result that rewards relaying one, or that
   puts a bystander at risk, is a block under E10 and E11 routed to swat-call-design. Observed
   (proof draft, hostage). The negotiator told an armed subject "Her son says he had the till
   keys the week the money went missing" while the son stood at the tape. E11's "who says so"
   sourcing let it through, because sourcing a claim is not permission to relay it.
3. The fastest force path. In each situation, read the fastest path that ends through entry or
   force. Before the entry option appears, quote the player-visible line that shows a life
   visibly threatened or a real impasse, and the line giving command's reason for approving
   entry. If either is missing in any situation, it is a block routed to swat-call-design under
   E12 and E4.0. A clock or a count of failed talks is not an impasse (E12.4, pattern C9). An
   entry opened against a subject whose threat is only to himself, or who has threatened nobody
   since dispatch, is a block in that situation even when it is earned in another. Then compare
   minutes. An entry ending far faster than every talk ending rewards force in the game's real
   currency, which is an E2 finding even when its grade is low. Observed (proof draft, round 2).
   An unhurt entry on an armed, talking man in crisis ended at 11 minutes against 57 to 521 for
   every other ending, with every ethics mark recorded as "clear". The review had read only the
   longest wait path.
4. Who stands where. After the call-out, list every role the text names with its position
   (patrol, negotiator, medics, the team, family). Patrol inside the perimeter after the team
   arrives, medics forward of the cordon, or family at the tape talking to the subject is a
   finding under E12.2 and E12.3, routed to swat-call-design when structural and swat-call-prose
   when one line misplaces someone.
5. Death on the card. In a call the sheet marks as crisis (E4.0), any ending title, summary or
   result that states a death is a block under E4.5, whatever a rulebook example shows. If an
   example in the rulebook contradicts its own rule, file a consistency finding to
   swat-call-design against the rulebook as well. Never park the contradiction as an owner
   decision when the rule is plain.

## 13. Engine side effects that punish restraint (pass five)

Read the debrief and every generated line for the path that waits or talks longest. A generated
line that charges a cost to the choice that preserved life ("Time pressure passed 75 during
'Wait him out on the line', costing N civilian safety") breaks E14 in spirit and is an
engineering finding, whatever the authored text says. Observed (proof draft, hostage), with the
engine behavior read in src/sim/operation.ts on 2026-10-06 (search `advanceTime` if it moved).

## 14. Physical facts within a situation (pass four)

Players replay situations, and a contradiction inside one breaks the authored feel faster than a
weak line. For each situation, list the subject's fixed physical facts from the truth and the
closing fact of each stage (mobility, where each object is, the state of each door and lock, who
is in which room). Then read every result, preview and ending in that situation against the list,
on every path.

```
| Situation | Fixed fact, quoted | Result, quoted | Field path | Contradicts |
| s1 | 'Nate can't stand. The rifle is across the room.' | 'He slid the chain off and told the medic it was in the closet.' | s1 wait_out favorable | mobility and object position |
```

A result that moves an object, opens a lock or lets a person do something the situation's facts
forbid is a finding, even on a path that never showed the fact. Route it to swat-call-prose when
one line is wrong and to swat-call-design when the facts themselves conflict.

## 15. Named costs that land (pass two)

Each option's summary names a cost. Find at least one path where that cost visibly lands, as a
flag, a civilian outcome, a result line or a changed ending. A cost no path ever charges is not a
cost, so the option without it dominates (fake-choice 1 and 3, a block). Players learn this on
the first replay and stop believing every cost the game states.

```
| Option | Cost as named, quoted | Path where it lands | Field that shows it | Lands |
| Call Nate before anyone moves | the family stays behind his wall | none, every close sets neighbors_safe | civilianOutcomes.neighbors | no |
```

Observed (proof draft, round 2). The author's own cold read picked the option whose cost never
landed, "because the kids are behind the wall either way".

## Record lines these checks feed

```
- Restatement: <n> restated, <n> in the first stage prompt
- Claims checked: <n> claims, <n> falsified
- Choice table: dominated <n>, takeable pairs <n>, time-only mixed bands <n>, commit taps <max>, chores at commit <n>
- Coverage: cells missing <n>, placeholders <n>
- Static walk: <states>, dead ends <n>, cheaper reveals <n> | not needed, explorer ran
- Previews against truth: false in some situation <n>
- Implied outcomes: <n> | Endings against paths: false on some path <n>, still-needed or objective lines false <n>
- Physical facts: contradictions within a situation <n> | Named costs: <n named, n that never land>
- Activation shown in text: <conditions quoted | not shown> | Relayed allegations: <n>
- Fastest force path: <per situation, threat line and command reason quoted | missing in s<n>>, minutes <entry n, talk range n to n> | Positions: <roles placed, misplaced n> | Crisis death on card: <n>
```
