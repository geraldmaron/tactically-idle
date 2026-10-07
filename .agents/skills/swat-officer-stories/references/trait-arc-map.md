# Trait arc map

What each trait does today, how it shows in a line, and how story events could move an officer
toward or away from it. Effects were read on 2026-10-06 from `TRAIT_INFO` in
src/ui/components/labels.ts, the officer contribution block and `strainFor` in
src/sim/resolution.ts (search "Traits apply only when their documented condition is present"), and
the role profiles in src/content/recruits.ts (search `PROFILES`). Re-read before trusting a
number. When this file and the code disagree, the code wins and this file is stale.

Everything under "toward", "away", "leaning" and "proposed" is design only. Today no code adds or
removes a trait after hire.

## 1. Reading the effects

Contributor values scale by seat weight, the officer's position among the participants on a step.
The figures below are at full weight. A show line describes how the trait looks on a call and is
displayed only beside an officer who has the trait, so unlike an identity line it may name the
quality. Show lines use the surname as subject, which needs no pronoun agreement.

## 2. The six traits as read

### Steady

- Condition, "Less strain when uncertainty escalates."
- Effect as read. Strain is multiplied by 0.75 while any fact is unresolved. No contributor line
  names it, so the player never sees steady act.
- Roles that can draw it at recruitment are comms, breach, medic and lead.
- Show lines. "{Surname} gives the same count the second time as the first." "{Surname} keeps the
  same pace when the plan changes."
- Toward it (proposed). A favorable call at pressure 50 or more after a strain leaning, where the
  officer held a position, waited or covered a contact step and every person was safe. A
  negotiated end held through a long silence also counts. Never a force or entry step alone.
- Away from it. Never from a single call. A scoped strain trait may sit beside it.
- Leaning line. "{Surname} called the room once and didn't repeat it."
- Voice change. Repetition stops, and the count is given once.
- Proposed contributor, to close the legibility gap,
  `{Surname}: steady, less strain while facts are open`.

### Observant

- Condition, "Better at spotting inconsistent information."
- Effect as read. Plus 6 on observation checks while any fact is still only reported. Contributor
  `{Surname}: observant, spots inconsistent reports`.
- Roles at recruitment, recon only. Starter seats are set separately.
- Show lines. "{Surname} reads the report twice and asks about the part that doesn't fit."
  "{Surname} checks what changed since the last call at this address."
- Toward it (proposed). An observation step that disproved a report, changed the plan and ended
  favorable.
- Away from it. Never.
- Leaning line. "{Surname} asked which neighbor made the second call."
- Voice change. The noticed thing shifts to the mismatch. "Caller said two. I see one."

### Mentor

- Condition, "Supports a trainee on the same task."
- Effect as read. In a squad with a mentor-trait officer, a rookie-trait officer's contributor
  reads "rookie, steadied by a mentor" at minus 1 instead of "rookie, still learning" at minus 4,
  and that rookie's strain is multiplied by 0.85. The mentor is not named in the line. Separately,
  a Veteran-band squadmate shows `{Mentor}: mentoring {Rookie} +2` beside a Rookie-band officer
  under the experience rules, with or without the trait.
- Roles at recruitment, breach and lead.
- Show line. "{Surname} walks the newest officer through the plan before the plan is needed."
- Toward it (proposed). A set number of shared operations as the named mentor of a Rookie-band
  officer who then leaves the band.
- Leaning line. "{Surname} let {Rookie} make the call on the rear door."
- Voice change. Radio names the trainee. "Park, your door."
- Proposed contributor, `{Rookie}: rookie, steadied by {Mentor}`, so the mentor gets credit.

### Impatient

- Condition, "Better under urgent conditions; worse during long waits."
- Effect as read. Minus 5 on waiting-tempo steps, and otherwise plus 4 when pressure is 50 or
  more. Contributors `{Surname}: impatient, poor at waiting` and
  `{Surname}: impatient, sharper under pressure`.
- Roles at recruitment, comms, breach and recon.
- Show lines. "{Surname} is at the door before the briefing ends." "{Surname} asks how long,
  twice."
- Toward it. Never from a call. Waiting is the behavior the game values, so no event pushes an
  officer toward impatience.
- Away from it (proposed). A waiting step the officer held to the end, with every person safe,
  can start a leaning away. The player chooses whether to accept it, since impatient also helps
  under pressure.
- Leaning line. "{Surname} waited the full ten minutes and said nothing about it."
- Voice change. A waiting line runs its full length instead of asking for time.

### Calm voice

- Condition, "Helps contact and negotiation tasks."
- Effect as read. Plus 6 on contact checks. Contributor `{Surname}: calm voice on the line`.
- Roles at recruitment, comms, medic and lead.
- Show lines. "{Surname} talks at the speed of the person on the other end." "{Surname} lets a
  silence run."
- Toward it (proposed). A negotiated end with the officer on the contact step, favorable, with
  every person safe or in accepted care.
- Away from it. Never. A person lost on a call never removes it.
- Leaning line. "{Surname} kept the line open through two long silences."
- Voice change. Pauses are written in, and the radio report gets shorter, not softer. "Phone, front
  room. She's thinking. Giving her the minute." Never a stock reassurance such as "I'm not going
  anywhere" or "take your time", which any negotiator in any show would say.

### Rookie

- Condition, "Less experienced; grows faster with experience."
- Effect as read. Minus 4 on every check ("rookie, still learning"), or minus 1 with a
  mentor-trait squadmate ("rookie, steadied by a mentor"). Ratings are lowered at hire and the
  wage is 5 lower. Faster growth comes from the experience band's learning multiplier (1.3 at
  Rookie), which a rookie-trait recruit usually starts in.
- Roles at recruitment, all five. A persona over 50 can still draw it, so no rookie line may
  mention age or years.
- Show line. "{Surname} asks the question everyone else stopped asking."
- Away from it (proposed). Leaving the Rookie experience band starts a leaning to drop the trait.
  This is the cheapest first arc, because it needs no new trait id.
- Leaning line. "{Surname} made the rear-door call without checking first, and it was right."
- Voice change. The habit appears for the first time.

## 3. Engine predicates for scoped traits

A scoped trait names a step type, and the step type must be an engine fact, never a writer's
reading of the prose. As read on 2026-10-06.

| Scope | Predicate | Where |
|---|---|---|
| entry step | a committed action whose definition has `entry` set, or `check.kind` 'execution' with `tempo` 'urgent' (the rushed entry) | `ScenarioAction.entry`, `CheckKind`, `Tempo` in src/sim/scenario-types.ts |
| barricade call | the scenario's incident type is 'barricaded', looked up from the debrief's `scenarioId` | `IncidentType` in src/sim/scenario-types.ts |
| contact step | `check.kind` 'contact' | `CheckKind` |
| waiting step | `tempo` 'waiting' | `Tempo` |

`DecisionView` does not carry the action's kind, tempo or entry today, so every arc scoped this way
needs request R13 in officer-data-proposal.md. That request copies the existing action fields into
the decision record at commit and never invents a parallel flag.

Count before you key. Before an arc hangs on a predicate, count the reachable actions that match it
across the catalog (frameworks plus hand-authored stories) and write the count on the sheet. If no
one has counted, write "count not run" and say the arc may never fire. A predicate that matches
almost nothing is the wrong trigger, and comms or medic seats may never reach an entry step at all.

## 4. Proposed earned traits

Each needs a new trait id, which touches the save trait list, the save version, `TRAIT_INFO` and
the contributors. Build the arcs on existing ids first.

| Id | Chip label | Condition | Cause | Paired positive | Recovery |
|---|---|---|---|---|---|
| barricade_strain | Barricade strain | More strain on barricade calls. | Two adverse barricade calls in the officer's last five calls, with the civilian precondition below | steady, earned on a favorable call of any type where the officer held a position, waited or covered a contact step and every person was safe | time and squad Rest duty clear it. A favorable barricade call with everyone safe also counts, but one is never required |
| entry_strain | Entry strain | More strain on entry steps. | Two adverse entry steps in the officer's last five calls, with the civilian precondition below | steady, earned the same way as above | time and squad Rest duty clear it. A favorable entry step with everyone safe also counts, but one is never required |

Civilian precondition. Every call a strain cause cites shows no `civilianOutcomes` status of
injured_needs_care or deceased, and no civilian record in `personCasualties`. If any cited call
hurt a civilian, the strain row does not fire. Use the person lost row instead, which means a
weight line, rest offered and no leaning. A civilian's injury never becomes material for an
officer's growth.

Force and entry never pay. The positive path and the recovery are never earned only through a force
or entry step. If the only road back runs through the thing that caused the strain, rewrite it.
"Get back through the door" is a trope that sells force as therapy.

The chip names the condition only, never the place. The origin sits on the history line, and a
strain origin reads "Since {place}, {date}." or "Carried from {place}." Positive traits read
"Earned at {place}, {date}." Strain origins never use earned, won or gained.

A person lost never creates a trait. It earns a weight line in the debrief, an offer of rest and
nothing that reads as the officer's fault.

## 5. Officer strain portrayal

1. Strain is a normal response to hard calls. It is never a weakness, a punchline or a verdict on
   the officer's nerve.
2. Every fork includes a support option framed as routine, with a stated cost. "Talk it through
   with the peer support officer. One shift off calls." It is a house option, and no real program
   is named.
3. A strain debrief line shows the behavior in its own sentence, never beside the adverse result as
   its cause. "Mensah gave the count twice on the stairs." stands alone. Use it only when the
   decision log records no other cause for the result.
4. The chip names the condition, never the place it came from, so the sheet does not read as a
   scar list.

## 6. Arc shapes

Name the shape on the sheet. No two officers in one batch share both a shape and a fork pair, and
no arc copies the beat order of the worked example in SKILL.md.

| Shape | Beats in order | Fork |
|---|---|---|
| strain then recovery | two adverse in scope, leaning shown, fork, rest clears it, steady earned beside it on a calm call | Rest duty, peer support or a squad move |
| positive then cost | a favorable run earns steady, then the officer is over-asked and stress climbs | keep them on the hard calls or rotate them to standby |
| refused fork | leaning shown, the player declines every offer, the trait locks, and the sheet says the player chose | the lock is the consequence and recovery stays open |
| slow arc to retirement | a ledger fact repeats across many calls and pays off in the exit line | a retention offer on the service reason only |
| graduation | leaves the Rookie band, the rookie trait drops, the habit appears in the radio for the first time | accept now or hold one more call with the mentor |
| pair arc | shared calls build a bond, a pair beat lands, one of the pair is injured, and the other's line changes | keep the pair together or split them |

swat-writing-review counts shapes in its batch audit.

## 7. Event rows

Each row names the recorded fact, the beat, the leaning line shown as behavior, progress, the fork
and the way back. Leaning, progress, fork and lock are proposals. Every progress step on a scoped
leaning cites a step inside its scope, and so does every clear or flip that happens on a call.
Outside a call, only time and Rest duty clear. Entry strain clears through rest, or on an entry step
that went well, never on a contact call. Steady earned on a contact call is a separate positive
that sits beside the strain. It does not clear it, and the debrief never says it did.

| Event | Recorded today | Beat | Leaning | Fork | Recovery |
|---|---|---|---|---|---|
| Crosses Strained, 30 | stress band | habit drops from radio | none | none | time, Rest duty |
| Crosses Overloaded, 60 | band, sits out high-risk work | debrief names the call that crossed it | starts if the call repeats a recent adverse type | Rest duty, peer support, or mentor pairing | Rest duty |
| Two adverse of last five | debrief band | leaning shown before burnout | toward a scoped strain trait, never from restraint | Rest duty, peer support, pairing or a squad move | time and choice |
| Third adverse of five, or stress over 70 for 20 game days | burnout retirement | exit line citing the record | none, the engine has decided | none, a raise is refused | none |
| Injury, wounded or serious | label, casualty record | return line on recovery | only if the same predicate hurts again | none | time to recovery |
| Favorable at pressure 50 or more | derivable | paired positive, nickname offer | toward steady | accept, rename or decline the nickname | none |
| Negotiated end, officer on contact | derivable from the decision log | ledger entry | toward calm voice | none | none |
| Person lost, or a civilian injured | casualty record, civilian outcomes | debrief weight line, never blame | none, ever | rest offered | time and choice |
| Leaves the Rookie band | experience band, needs a hook | graduation line | toward dropping rookie | accept now or hold one call | none |
| Anniversary, birthday at 50, 55, 60 | personnel event | one ledger fact beside the stat | none | none | none |
| Retirement announced or retired | personnel event | exit line citing the record | none | retention, service reason only | none |

Progress lines for every row with a leaning.

```
Leaning progress
- Two adverse of last five
  progress 1: the second adverse call in five matching the scope predicate, civilian precondition met
  progress 2: the next matching step ending mixed or adverse, with no fork option chosen
  burnout: an adverse ending that is also the third adverse in five locks the trait and announces burnout in the same shift report
- Crosses Overloaded
  progress 1: crossing 60 on a call whose predicate matches a recent adverse call
  progress 2: the next matching step ending mixed or adverse while still Overloaded
  burnout: stress over 70 for 20 game days overrides, and the exit line cites the record
- Injury
  progress 1: injured on a step matching the predicate
  progress 2: injured again on a matching step within a game week of returning
  burnout: none, injury alone never counts toward burnout here
- Favorable at pressure 50 or more (toward steady)
  progress 1: favorable at pressure 50 or more with the officer holding, waiting or on contact, everyone safe
  progress 2: a second such call
  burnout: none
- Negotiated end (toward calm voice)
  progress 1: negotiated end with this officer on the contact step
  progress 2: a second one
  burnout: none
- Leaves the Rookie band (drop rookie)
  progress 1: the band change
  progress 2: the next favorable call
  burnout: none
```

**First call with this department.** The officer's first debrief here, which needs the ledger
because debriefs keep only 10. A first_call ledger entry and the start of the Layer 2 counter.

**Leaves the Rookie band.** The anniversary detail says "Now Developing" only when the year itself
crosses the line, and a crossing earned through operations raises no event, so this beat needs an
engineering hook.

## 8. Pacing proposals, to tune in play

These are starting values, not findings. Tune them in owner playtests.

1. One leaning per officer at a time.
2. A leaning stays visible until the player has opened a shift report or the officer sheet that
   shows it, and at least one operation has passed, before anything locks. A game day is one real
   hour, so an idle player checking in twice a day would otherwise miss the whole telegraph. The
   seen flag is request R12.
3. Three traits per officer at most, and one earned negative per officer per game week.
4. The Rest fork means the player sets the officer's squad to Rest duty (`SquadDuty` 'rest', set by
   the `setSquadDuty` action in src/sim/types.ts). It is squad-wide and has no timer, and nothing
   ends it on its own. Write the effect as "Put {Squad} on rest. The strain note clears after 7
   game days on rest." A timed or per-officer stand-down is design only and needs request R11.
5. A locked scoped strain trait clears through time on Rest duty. A favorable step inside its scope
   with everyone safe also counts, but the player is never required to send the officer back
   through the thing that caused it.
6. Every earned negative has a positive path of the same size.

Fork options each carry a stated cost and a stated risk, and neither wins on every axis. Rest is
certain and costs the whole squad's availability. Peer support costs one shift. Pairing keeps the
officer deployable, costs the mentor's slot, and if the paired step ends adverse the leaning locks
at once. If a reader can name the right option in one second, rewrite the fork.

The shape borrows from games that do this well. XCOM 2's War of the Chosen ties a soldier's new
negative trait to the enemy that caused it and lets the player treat it. Darkest Dungeon caps
quirks and locks untreated ones over time. Crusader Kings III lets the player pick how a character
copes at a stress break. The sources and their limits are in sources.md.
