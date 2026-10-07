# Call design sheet

The literal sheet, what each row feeds, how it fills the agent brief, and two worked sheets.
Copy the template, fill it top to bottom, and keep DRAFT in the first line until the record at
the bottom is complete. Every sample line on a sheet is a placeholder that swat-call-prose
replaces. Both worked sheets are illustrative. Never copy a sentence from them into data,
because copied examples repeat across hundreds of variants.

## 1. The template

```
DRAFT | UNVERIFIED (delete each word when it stops being true)
Call design sheet: <working title>

A. Lane and version
   Lane: <typed package | hand-authored story | setting module | version-gated override>
   Target content version: v<N>; newest issued suite: v<M>; owner asked if v<N> is open: <answer>
   Type id: <snake_case>; building types: <ids>; rooms by use: <uses>

B. Premise
   Call type borrowed:  <...>
   Person:              <name, age, role> wants <...>
   Wrong note:          <...>
   Worse if they wait:  <...>
   Why a tactical team: "<quoted briefing line>" for each of armed, threat, advantage, refusal
                        (empty fails the record; typed welfare calls write "not a call-out")
   Self-harm risk:      <none | present, because <signs>>  (every armed or weapon-reaching person)
   Private logic:       <...>  never printed as an explanation
   Iceberg tip:         <one detail> in <field>, reached only through <choice>
   Closing fact:        <...>  NEVER PRINTED

C. Person cards (one per person on scene; callers get role and how they know)
   Memory anchor, one object or habit shown on the most common path by stage 2. Called back
   in at most half the endings, each callback changing its state or who holds it (the key
   comes back, the leash is on the wrong hook). It closes no more than two endings, at least
   one callback lands through the subject's own act and one through absence, and no
   secondary character carries more than two. Any one callback motif appears at most twice
   on a single path.
   People binding (hand-authored), one line per person per situation, enum spellings from
   engine-map.md section 2:
   | Person id | Situation | role | mobility | spaceId | threat {armament, readiness, disposition, intent, awareness} | reported | factIds |
   Transitions, one per move: | Person id | when | to (anchor or offscene label) | observed |
   Civilian outcomes: | id | factId | safeFlag | injuredFlag | careFlag | effects that set each |
   Geography. Advantage line, quoted once: "<...>"
   | Role (negotiator, medic, evacuees, observers, staged team) | Position | In the subject's line of sight? | Cover in text, or stated cost on option <id> |
   Hook person in stage 3: <yes, as <stake | payoff> in <field> | no, so the hook is rewritten>

D. Hook
   Text: "<...>"  (<n> characters)
   Tests 1 to 8: <pass | failed lines>; proper names <n> (at most 2, second with a role);
   danger words "<...>"; gap: <the one fact>; worse if they wait (tied to a person): <...>

E. The ninety seconds (filled copy of the SKILL.md section 2 table, one line per beat)
   Briefing lines, in order, at most 4 known and 1 unknown, counting any deliberate_answers
   line the recipe appends (engine-map.md section 5):
   | Slot | Text | Seconds |   total <= 10; the turn fact sits in known[0] or known[1]
   Taps per stage: | Stage | Most common path | Longest path |   each <= 3 on the common path

F. Stage table
   | Stage | New fact on arrival | A protects / costs | B protects / costs | Waiting costs | Lever | Earlier choice named by |
   Action rows, one per ActionDefinition id (engine-map.md, minimum action row). Incomplete: <n>
   Dominance grid per stage and per variant module (dilemma-patterns.md, the four rules):
   | Option | Odds (to calibrate) | Minutes | Unlocks | Who pays on adverse | Charged by (field) | Cost the player sees ("<string>") | Value it protects | Payoff only this option produces |
   Force and entry gates (E12.5), one row per force or entry action per situation:
   | Action id | Situation | visibleWhen | Threat flag and the quoted line that sets it | Command's reason line | Visible? |
   Context prompts, in array order (first match wins):
   | Stage | Index | Exact Condition {flags, notFlags, facts, pressure} | Prompt key | Entry states that show it |
   Stage exit table:
   | Stage | Action | Band | Exact effect {stage or ending, when} |
   Orders walked: <list>, dead ends 0

G. Turn
   Planted in: <field> ("<text>"); revealed in: <field>; reprices: <stage 1 choice>

H. Consequence map
   | Choice | Favorable | Mixed | Mixed changes (not minutes) | Adverse | Cue shown before (field) | Who or what changes | Civilian flags set | Objective delta per band |
   Flags set, and their readers (a flag with no reader is dead):
   | Flag | Set by (action, band, truth) | Read by (Condition and where) |
   Full matrix for every truth-branched action:
   | <action id> | favorable | mixed | adverse |
   | s1 | <line or "same as <cell>, because"> | ... | ... |
   | s2 | ... | ... | ... |
   | s3 | ... | ... | ... |
   Each per-situation string marked variant-module or truth-branch(factId, is).

I. Endings
   | Ending | Disposition | Each person's state, and who is responsible | remainingTasks | Trust and strain | Objective, fastest and slowest path |
   Closing sentences: | Ending | Final sentence | Subject + verb template |   three or more
   endings on one subject plus verb fails
   Wording. A motif callback in an ending is plain and under 12 words, and never resolves the
   call's theme as a joke or a bow. The best-case ending leaves one thing unfinished for a
   named person. A hurt person's ending names what the medic did or found, never a grade.
   Reachability, one row per path to each ending:
   | Ending | Path (action ids) | Elapsed minutes | Pressure | Each service's state |
   Triggers, one row per closing action:
   | Action id | Band | Exact Condition (flags, notFlags, facts, pressure) | Ending id |

J. Open loop: <the thread a player can resume>

K. Levers: <list, each with its lane>; requests: <R numbers>
   Pressure: start <n>, perMinute <n>, threshold <n> = minute <n>; expected pressure at each
   stage entry, fastest and slowest path. Every number states its unit and field.

L. Variant plan
   | Axis | Situation 1 | Situation 2 | Situation 3 |
   Correlated hidden axes: <list | none>; cheapest reveal per truth <action, difficulty, minutes, cost>
   Visibility reveals. Any flag set inside a truth branch that gates a visibleWhen or a context
   prompt is a reveal. Pair it with a knowledge effect (reported or confirmed) on the fact it
   implies, and list it here with its cost. An option set that differs by situation before the
   fact is settled is a leak, the same class as a false preview.
   Intensity: <light | medium | heavy>

M. Ethics screen: E1 <clear | finding> ... E10 <...>; E4 <applies | screened, reason>;
   E3 <clear, tally <seeds, subject-role distribution> | pending batch tally>;
   E4.5 vs E2.1 checked <yes>; crisis drafts (E4.7) content note "<...>", support line "<...>",
   pending O2 and R5;
   E12.1 <quoted lines>; E12.2 to E12.4 <clear | finding>; E12.5 <force gate rows in F>;
   Concessions <option id, who approves, what the team delivers, no held person a party>;
   Owner decisions (O1) <exact strings with field paths>

N. Officer slots (reserved, never written here): briefing <yes | no>; debrief <yes | no>

O. Engineering requests (full shape from SKILL.md section 11)

P. Call design record (SKILL.md closing section)
```

## 2. What each row feeds, and what checks it

| Row | Feeds (typed lane) | Feeds (hand-authored) | Checked by |
|---|---|---|---|
| A | catalog entry, type id, placement | archetype recipe | Record "Lane and version", issued suites |
| B, C | `name`, `role`, cast slot pronouns, `variants` | facts, `people` (`PersonDefinition`), cast | Record "Person and hook", "Call-out earned", "People binding", ethics E3, E4, E8, E9, E12.1 |
| D | `opening` | `summary` | Hook test, record "Person and hook" |
| E | every field, by beat | every field, by beat | Review's cold read |
| F | `approaches`, `precaution`, `verify`, `actOnReport`, `resolutions`, `waitFor`, `corroborate` | stages, actions, requirements | Choices gate, `validateScenario`, checklist, record "Dilemma per stage", "Dominance grid", "Stage exits walked" |
| G | `approachResults`, `claim`, `confirmed`, `disproved`, `actOnReport.wrong` | `contextPrompts`, `truth`, `reveal` | Record "Turn" |
| H | `results`, previews (compiler-owned in part) | outcomes, `outcomePreview` | Record "Cue trace", spoiler lint |
| I, J | `results`, `waitFor.result` | `endings`, `completion`, `remainingTasks`, `civilianOutcomes` | Record "Ending reachability", "Ending triggers", "Endings and loop", E11 |
| K | extension fields | pressure, services, tempo | Record "Lever" |
| L | `truth`, `variants`, `moveOn` | episode variants | Distinctness gate, record "Variants" |
| M | all text | all text | Record "Ethics screen", review pass five |
| N | none yet (R4) | none yet (R4) | swat-officer-stories |

## 3. Filling the agent brief

The brief template is in `docs/content-pipeline.md` (search "Agent brief template"). Fill each
bracket from the sheet, and paste the sheet beneath the brief.

| Bracket in the brief | Sheet row |
|---|---|
| content version [N] | A, target version |
| [purpose in one sentence] | B, person and want plus worse if they wait |
| [verbs] | F, every choice title as a verb |
| [the claim that each situation fixes] | G, the claim, and L, truth per situation |
| Building types [ids] and rooms [uses] | A |
| truth pattern [pattern] and [extensions] | L truth row, K levers |
| Prose rules | Keep the brief's list, and add the two hard rules (no dashes, colons only in fixed formats) |
| Output and self-check | Keep the brief's steps, then attach the design record |

## 4. Rejected premises and a hook repair

| Rejected premise | Why it fails | Fix |
|---|---|---|
| "A tense break-in at a hardware store." | A genre label. No person, no want | Name who called and what they want from the team |
| "An alarm on its own doesn't mean someone broke in, took anything or is still inside." (repo, burglary `opening`) | A disclaimer. It tells the player what not to think | Put the doubt in a person, "Casey wants it logged as a fault so she can lock up" |
| "The whole street's trust in the department hangs on this call." | Community-scale stakes nobody can picture | One named person and one near consequence |
| "Lucia shouted that she has her late husband's weapon. She won't let the medics in." | No stated threat, so no call-out (E12.1). This is patrol, a crisis-trained officer and EMS | Add a sourced threat line, or keep the call and change its type |

The hook repair for the burglary call is in section 6, row D.

A hook repair for a hostage call (from a proof run, illustrative).

| Version | Text | Fails |
|---|---|---|
| Before | "Ben Flores should have left the print shop ten minutes ago. Lewis wants Mara Holt's signature before the appeal office closes." | Test 7, no danger to a person, and the deadline belongs to an office. Test 8, three names and no roles. A board scan reads a clerical errand |
| After | "Ben Flores, a courier, should have left ten minutes ago. Lewis has a weapon and won't let his old boss go until she signs." | Passes. The danger is plain, Mara is held back for the briefing, and Ben stays in the call as the person waiting at the door in stage 3 |

The hook person rule. Ben opens the hook, so he still matters in stage 3, as the stake or the
payoff. If he leaves in stage 1, his line ("I only needed one signature") is saved for the
ending, and the subject or the person at risk takes the second sentence.

## 5. Worked sheet A, a new welfare call (illustrative)

Read against the v12 compiler on 2026-10-06. Not built, so nothing here has passed a gate. Its
record predates version 0.3.0 of the skill. The lines added since (flags and readers, force
gates, context prompts, services, geography, objective) do not apply to a typed welfare call
with no force, flags or services, and a real sheet still writes each one as not applicable.

```
DRAFT (illustrative)
Call design sheet: The Same Song

A. Lane: typed package. Target: next open version (owner to confirm). Type id: song_on_repeat.
   Building types: apartment_unit_g1, semi_detached_g1 (the caller hears through a shared wall).
   Rooms by use: living, kitchen. No room is ever named in writer fields; the placement line owns it.

B. Call type borrowed:  welfare check
   Person:              Iris Mendel, 81, lives alone; wants to be left to her evening
   Wrong note:          one song on the radio since 4 p.m., starting over every few minutes
   Worse if they wait:  if she is down, she has been down all evening
   Private logic:       she changed her lock after a stranger tried her door in spring, and
                        a broken door frightens her more than a night on the floor. NEVER PRINTED
   Closing fact:        on the floor, or asleep in her chair with her hearing aids out. NEVER PRINTED

C. Iris Mendel, 81, retired, pronouns she/her. Wants, in her words: "Don’t you break my door."
   Fears: strangers in her hall. Reads: answers the letterbox, not the door; asks who is
   there twice; names her niece. Knows: her own evening.
   Neighbor (unnamed, typed lane): heard the song through the wall since she got home at 4,
   no movement. Niece (unnamed): calls every night at 9, has the only spare key.
   The plan's flat number (4B) stays off the card; it would contradict the placement line.

D. Hook: "Iris Mendel’s radio has played one song since 4 p.m., and her niece can’t reach her.
   If Iris is down, she’s been down all evening." (130 characters)
   Name: word 1. Gap: floor or asleep. Worse if they wait: sentence 2.

F. | 1 | Neighbor or niece first | Neighbor: her account first, compiler cost | Niece: the key and the lock, one minute | Nothing yet | precaution: ask for a crew now | n/a |
   | 2 | Iris may answer the letterbox | Talk to her: her say, slower | Force the door on the neighbor’s word: minutes, risks her lock and dignity | She waits | actOnReport assume confirmed | compiler contributor line |
   | 3 | On the floor and asking for her door (s1), or fine (s2, s3) | Force the door: reach her now, lose her lock and her wish | Wait for the niece’s key: her door whole, 20 cold minutes | Trust 0 instead of 1 | waitFor; corroborate on the disproved side | R8 to name the crew call |

G. Planted in dispatch ("she has the only spare key") and the niece result ("Iris changed her lock
   in spring"). Revealed in confirmed ("she asks the team not to break her door").
   Reprices the stage 2 gamble and the stage 1 crew call.

H. | Act on report, wrong | n/a | n/a | wakes in her chair to the team in her hall | niece result "hearing aids out after tea", neighbor "starts over every few minutes" | trust, Iris's lock |
   | Late crew call fails | ... | ... | the force step cannot go ahead | precaution summary "a crew needs to be on its way" | the force step is gone; only the wait for the key remains |
   | Check inconclusive | ... | ... | compiler text | none writer-owned (R1) | time |

I. | Force the door | followup_agreed | Iris on the floor with the team, crew coming if called, angry about her door | none | +1, strain -1 |
   | Leave Iris to her evening | followup_agreed | in her chair, radio off, will answer at 9 tomorrow | none | +1, -1 |
   | Wait for the niece’s key | followup_agreed | the niece sits with her; nothing broken | none | 0, 0 |
   | Gamble right (acted_on_report) | followup_agreed | as Force the door; same title, so R1 | none | 0, -1 |
   | Response unfinished | unresolved | as last checked | the question | -2, +2 |

J. Open loop: the 9 o’clock call tomorrow, or the forced lock.

K. precaution (requiredFor confirmed), actOnReport (assume confirmed), corroborate (for disproved),
   waitFor. No clock (typed). Requests: none required; R8 would name the crew call at stage 3.

L. | Truth | true | false | false |
   | Time | down since teatime | asleep since 8 | asleep since 8; hall phone off the hook since 3 |
   | Her words | "Don’t you break my door." | "I was asleep, for heaven’s sake." | same post-check text as 2 |
   | Who called | neighbor through the wall | same | same; first report missed the phone |
   truth[2] is false, against the 9 of 11 typed frameworks where it is true.
   Intensity: medium. Never in the same shift as fall_at_home.
   Distinctness, argued: closest are water_leak (same precaution side, gamble side and truth;
   differs by corroborate) and disturbance (same gamble and corroborate; differs by precaution).
   Theme overlaps fall_at_home (an older woman on the floor at home). Gate: not run, not built.

M. E1 clear. E2 clear (waiting is never worse for Iris by design; it costs time and trust).
   E3 clear (age is context, never danger). E4 screened, no weapon access and no refusal of
   care. E5 n/a. E12.1 not a call-out (typed welfare call; patrol and a crew). E12.2 to E12.4
   clear. E6 finding handled: forcing the
   door costs her lock and her wish, and the ending says so. E7 clear. E8 clear. E9 n/a.
   E10 clear.

N. Briefing slot: yes (who on the squad has knelt at a letterbox before). Debrief: no.

O. Engineering requests: none required. R1 would let stage 3 previews show the adverse picture,
   and R8 would let stage 3 name the crew call.

P. Call design record (illustrative; stays DRAFT because nothing was built or run)
- Lane and version (row A): answered | typed package, next version, suites read issued-v9 to v11, owner asked about open version no, illustrative sheet
- Contract read (row A): answered | IncidentFramework, withAdditionalFramework, frameworkAt, LENGTH_BUDGETS, read 2026-10-06
- Person and hook (rows B to D): answered | Iris Mendel, 81, lives alone, wants her evening; hook "Iris Mendel’s radio has played one song..." 130 chars; gap floor or asleep
- Dilemma per stage (row F): answered | 1 readiness vs a crew another call needs, 2 speed vs her say over her door, 3 care now vs her stated wish; checklist, swap, tone clean
- Turn (row G): answered | planted in dispatch ("she has the only spare key") and the niece result ("changed her lock in spring"), revealed in confirmed, reprices the stage 2 gamble
- Cue trace (row H): answered | 2 writer-owned adverse outcomes traced; the compiler's check failure has no writer cue (R1); pre-check text identical across situations
- Endings and loop (rows I, J): answered | best Iris safe with her say kept; partial the question; loop the 9 o’clock call
- Lever (row K): answered | precaution, actOnReport, corroborate, waitFor
- Variants and distinctness (row L): answered | axes truth, time, her words, who called | not run: not built
- Call-out earned (row B): not a call-out; typed welfare call
- Self-harm risk (row B): none; no weapon access
- Iceberg tip (row B): "Iris changed her lock in spring" in the niece result, via "Call Iris's niece back"
- People binding (row C): typed lane
- Briefing and taps (row E): writer lines 3 (dispatch, opening, question), about 9 s, turn fact in dispatch; the compiler adds the placement line and two responsibilities, over budget, R1; taps common/longest s1 1/2, s2 1/2, s3 1/2
- Dominance grid (row F): stage 1 none, stage 2 none, stage 3 none
- Inexpressible gates (row F): none
- Stage exits walked (row F): typed lane, compiler owns exits
- Consequence matrix (row H): typed lane; writer-owned cells filled, compiler cells listed under R1; placeholders 0
- Ending reachability (row I): 5 endings; waitFor.result true on both truths; clock times 0
- Ethics screen (row M): answered | E1 clear, E2 clear, E3 clear, E4 screened (no weapon access), E5 n/a, E6 finding handled, E7 clear, E8 clear, E9 n/a, E10 clear, E12.1 not a call-out, E12.2 to E12.4 clear
- Officer slots (row N): answered | reserved in briefing; no branch depends on one
- Engineering requests (row O): none required; R1, R8 would help
- Tells on hook and premise: checker run, 0 tells, 0 dashes, names allowed
- Handoff: sheet in this file, next swat-call-prose
```

Draft package fields, all within `LENGTH_BUDGETS` and the lane word lists (checked with a copy
of the lint patterns on 2026-10-06, not the gate itself).

| Field | Placeholder text |
|---|---|
| `title` | The Same Song |
| `dispatch` | A neighbor reports one song playing next door since 4 p.m. Iris’s niece can’t get an answer, and she has the only spare key. Find out whether Iris needs help before anyone opens her door. |
| `opening` | Iris Mendel’s radio has played one song since 4 p.m., and her niece can’t reach her. If Iris is down, she’s been down all evening. |
| `question` | Is Iris inside and unable to reach the door, or just not hearing it? |
| `approaches` | Hear the neighbor who called / Call Iris’s niece back |
| `approachResults` | The neighbor says the song starts over every few minutes. She hasn’t heard Iris moving since she got home at 4. / The niece says Iris takes her hearing aids out after tea. Iris changed her lock in spring, and the niece has the only spare. |
| `verify`, `claim` | Talk to Iris through the letterbox / Iris is inside and can’t get to the door. |
| `confirmed` | Iris answers from the floor. She can’t get up, and she asks the team not to break her door. Her niece has the key. |
| `disproved` | Iris opens the door in her dressing gown. Her hearing aids were out, and she fell asleep in her chair with the song on repeat. |
| `resolutions` | Force the door and go in to Iris / Leave Iris to her evening |
| `results` | The team is through the door and with Iris on the floor. She wanted her door left whole, and she says so. / Iris is in her chair with the radio off. Her niece will ring at 9 tomorrow, and Iris has said she will answer. |
| `precaution` | Ask for an ambulance crew now. If Iris is down, a crew needs to be on its way. Calling now holds a crew another call may need, even if she is only asleep. |
| `actOnReport.wrong` | Iris wakes in her chair to the team in her hall. Her hearing aids were out. The team apologizes, steps back to the landing and stays until her lock is secured. |
| `waitFor` | Wait for the niece’s key. Talk to Iris through the letterbox until her niece arrives with the key, about 20 minutes. Slow, and nothing gets broken. |

Three engine facts this sheet had to respect, each found by reading the compiler.

1. `waitFor.result` shows on both sides of the truth, so it says nothing about the floor.
2. `actOnReport` does not inherit the precaution its resolution needs, so `results[0]` cannot
   assume a crew was called.
3. The placement line names the room, so no writer field does.

## 6. Worked sheet B, the shipped burglary call at v12

Built from the compiled call on 2026-10-06. `generateIncident` output for `burglary` at content
v12, situations 1 to 3 on `market_row`, the same output the story sheet renders. Read
`/story.html?type=burglary` before relying on this. Names were bound (Riya Liu, Balpreet
Williams and Nour Beaulieu), so the authored name Casey is used below.

What the player sees, quoted.

| Beat | Observed text (v12) | Finding | Owner |
|---|---|---|---|
| Card | "An alarm went off after closing, and Casey Bell, the keyholder, has arrived. An alarm on its own doesn’t mean someone broke in, took anything or is still inside." | Disclaimer hook, name at word 8, no want | `opening`, issued, so R2 |
| Stage 1 | "Start with the people involved. Knowing what they want makes the agreed next step more likely to go smoothly." | Nobody here wants anything | compiler, R1 |
| Stage 2 | "Check the disputed point in person." | Process narration | compiler, R1 |
| Stage 2 gamble | "Casey thinks it’s a sensor fault. Logging it now spares the squad a check. If someone did get in, the call has to be reopened, and marks at the door may be disturbed." | A real dilemma with a named cost. Keep | depth layer |
| Stage 1 precaution | "If someone did force a way in, any marks need to stay untouched. Keeping everyone back slows the check by a few minutes, even if it turns out to be a fault." | Real cost. Keep | depth layer |
| Stage 3 wait | "It takes much longer, but it does not depend on the next step going right." | The same sentence 11 times in the content files | depth layer; v12 if open, else R2 |
| Endings | "Log the sensor fault with Casey" titles both the checked ending and the acted-on-report ending | The player cannot tell from the title whether they checked | compiler, R1 |
| Briefing, situation 3 | "The first report left something out. Check an independent source before deciding the disputed point." | Shown only in situation 3, where the claim holds, as it does in 9 of 11 typed frameworks | truth is issued; balance it in new frameworks |
| Pressure | "Time to check accounts" | No clock exists, and none is promised. Fine | compiler |

The redesign, for a v13 layer (illustrative).

```
B. Person: Casey Bell, 58, the keyholder who opens up every morning; wants the alarm logged
   as a fault so she can lock up and go home.
   Wrong note: the third alarm this month, and she will not walk round to the back.
   Private logic: she has known since spring that the back lock sticks and never reported
   it, and a break-in means questions she does not want. NEVER PRINTED. The sticking lock
   may surface as a fact after the check; her fear of the questions never prints.
   Closing fact: fresh split frame at the back door, or a sensor hanging by one screw.

D. Hook (opening, R2): "Casey Bell wants the alarm logged as a fault, the third this month.
   Her cleaners are already back inside, walking past the back door." (133 characters)

G. Planted in approachResults (R2):
   Casey: "Casey says the back sensor has tripped on its own twice this month. She hasn’t
   opened the back door since spring."
   Patrol: "Patrol saw scuffs on the back step but can’t say how old they are. The alarm log
   shows the back door tripped first."
   Revealed (R2): confirmed "The back door’s frame is split at the lock. Nobody is inside,
   and nothing shows who did it. Casey says the lock has stuck since spring."
   disproved "The back door is sound and locked. The sensor above it hangs by one screw.
   Casey says she has asked the landlord twice."
   Reprices: the gamble "Log a sensor fault on Casey’s word" and the precaution.

I. results (R2): "The split frame is recorded and left for investigators. Casey stays with the
   building until a locksmith comes." / "The alarm company logs the loose sensor. Casey locks
   up and goes home, with an engineer booked for the morning."
J. Open loop: the locksmith at 7, or the engineer in the morning.
F. Stage 2 prompt (R1): "Casey is at the front with her keys out. Patrol is waiting at the back step."
M. E11 checked: no line says who did it, and the split frame is damage, never a break-in, until
   someone checks. E3 clear. E6 n/a (nobody forces anything).
```

The split, as the record would carry it.

- Writer-owned package fields that need R2 because burglary is issued. `opening`,
  `approachResults`, `confirmed`, `disproved`, `results`.
- Depth-layer fields that change in place only if the owner says v12 is still open, otherwise
  R2. The `waitFor` summary.
- Compiler strings, R1. Stage 2 and 3 prompts, the approach summaries, the acted-on-report
  ending title.
- Left alone. The truth pattern (issued), the precaution and the gamble (already real).
