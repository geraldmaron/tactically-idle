---
name: swat-officer-stories
description: >-
  Use when writing or designing text that tells the player who a Tactically
  Idle officer is or how the job has changed them, including recruit card and
  sheet profiles, pressure lines, voice markers and radio samples, trait
  condition and origin lines, arc beats keyed to stress bands, injury,
  mentoring, adverse runs and retirement, trait changes caused by story
  events, ledger facts and callbacks, pair beats, earned nicknames and shift
  report personnel entries. Mandatory gates are schema honesty with design-
  only work labeled, seat neutrality and role plausibility, the calendar
  check, culture and appearance never setting traits, a named cause, a seen
  telegraph and an undominated fork before any trait locks, restraint never
  punished, a recorded fact behind every callback, and a spread, repeat and
  collision audit. Produces officer story sheets, an arc table and an officer
  record. Not for spoken lines inside a call, trait balance numbers, or
  portrait art.
license: Proprietary
metadata:
  version: 0.2.0
---

# SWAT officer stories

A call lasts about ninety seconds. The officer on the stack comes back tomorrow. This skill writes
officers so a player attaches to one in the three seconds a recruit card gets, and so the calls
they work leave marks the player can see later. One vivid specific, then let the player's
imagination do the rest. Traits act on calls. Officers are capable and fallible, and the job
changes them through causes the player watched.

The floor this replaces is the persona note as it stands. Of the 100 notes in the persona catalog,
27 open with "enjoys", and none touches play ("He enjoys repairing mechanical clocks."). The bar
is a line a call can test. "He repairs old clocks. In a quiet room he hears the one thing still
running."

The owner's prose rules hold in every line, drafts included. No em dashes, en dashes or spaced
hyphens as dashes. Colons only in engine-built strings (stat rows like `Chen: calm voice on the
line`, the decision log) and clock times. Speech is attributed with "says". The house voice and its
tell checker belong to written-voice, which this file builds on and never restates. Every gate
below is mandatory, and officer text is a draft until the closing record is filled.

## When not to use

- Spoken lines inside a call, including a spoken briefing callback. This skill writes the ledger
  fact and the callback intent. swat-call-prose writes the spoken line from that fact in the
  officer's markers, and its surface tests apply to it.
- Trait balance numbers, rating formulas, stress math, schema, save migration or resolution code.
  File the request in [officer-data-proposal.md](references/officer-data-proposal.md) and stop.
- Portrait art and persona identity fields (name, pronouns, culture, appearance, age). The roster
  pipeline owns them, per the "Identity contract" heading in docs/art/roster-integration.md.
- Civilian casts in calls, which swat-call-design owns. The collision check in §9 still applies.
- Deciding whether officer text ships. Use swat-writing-review.
- An officer's death, in any form, backstory included. The game does not model one.
- A one-word typo or pronoun fix in a persona note. Fix it, say in one sentence that the method
  was not applied, and run the persona tests.

If a sibling skill named here is missing, say so, apply this file's minimum, and record the gap.

## 1. What the engine has today and what is design only

Every line maps to a field the game reads, or it is labeled design only. Never write text that
implies a feature exists. Paths were read on 2026-10-06. If one moved, search for the symbol in
brackets. If you cannot read them, say so, mark every field on your sheet unverified, and claim no
line is wired.

| Surface | Field or source | Status | Where the player sees it |
|---|---|---|---|
| Persona note | `personalNote`, src/content/personas.json | exists, one sentence | recruit card, officer sheet |
| Role | comms, breach, medic, recon, lead | exists, drawn per campaign | chips on card and sheet |
| Traits | steady, observant, mentor, impatient, calm_voice, rookie | exists, set at hire only | chips |
| Trait condition | `TRAIT_INFO`, src/ui/components/labels.ts | exists | chip tooltip, sheet |
| Contributor lines | resolution module [`calm voice on the line`] | exists | score breakdown |
| Stress bands | Ready, Strained 30, Overloaded 60, Mandatory recovery 80 | exists | status chip |
| Injury | `injury.label`, severity wounded or serious | exists | sheet status, deploy reason |
| Squad duty | `SquadDuty` patrol, standby or rest, set by `setSquadDuty` [src/sim/types.ts] | exists, squad-wide, no timer | squad panel |
| Calendar | `bornDay`, `serviceStartDay`, experience band [`interface Officer`] | exists | career panel |
| Personnel events | retirement_announced, retired, anniversary, birthday [`CAREER_TUNING`] | exists | shift report |
| Story fields, ledger, leaning, seen flag, bonds, nicknames, speaker chip | none | design only | nowhere yet |

Observed facts that change what you may write.

1. No code adds or removes a trait after hire. Every arc that changes a trait is design only.
2. The word rookie names the trait and the experience band. Mentoring has two paths too, the
   mentor trait and a Veteran-band squadmate's `Brooks: mentoring Park +2`. Name which you mean.
3. Steady has no contributor line, so the player never sees it act. File it as a legibility gap.
4. Debriefs keep the newest 10 only, so any callback older than that needs the proposed ledger.
5. Rest is squad-wide with no timer. A per-officer or timed stand-down is design only (R11).
6. `DecisionView` does not carry an action's `check.kind`, `tempo` or `entry`. An arc scoped to a
   step type needs R13, which copies those existing fields at commit and never invents a flag.

Count before you key. Name the engine predicate ([trait-arc-map.md](references/trait-arc-map.md)
§3), count the reachable actions that match it, and write the count on the sheet. Near zero means
pick another trigger. If you cannot run the count, write "count not run" and say it may never fire.

## 2. The persona contract and the seat shuffle

Personas are shuffled into gameplay seats each campaign. Role, ratings, certs, trait and prior
service come from the campaign seed and the persona id, never from culture, appearance or
pronouns. The same person can be a 50-year-old rookie medic in one campaign and a veteran on entry
in the next. Every identity line must read true in all of them.

1. **Role-neutral.** Read the line beside each of the 5 roles. "She clears rooms fast" fails on a
   medic. A line that needs a role gets one variant per role, or it goes.
2. **Role-plausible.** For an arc or callback, ask per role whether this officer would really be on
   that step. Crisis negotiation is its own trained part on real teams, so a breach seat does not
   become the talker. Its callback names what it did in its own role.
3. **Trait-neutral.** Read the line beside each of the 6 traits and beside none. A habit in one
   domain is fine. A general quality a trait names is banned (steady, calm, patient, observant).
4. **Service-neutral.** Never state years on the job, rank, a past posting or a first call in an
   identity line. The career panel computes time.
5. **Pronoun-safe.** The catalog has 44 she, 43 he and 13 they. Test every template in all three
   sets. Keep reflexive pronouns out of templates.
6. **Names as authored.** Ten personas carry diacritics, such as Étienne Laurent. Never strip them.

## 3. The profile

A recruit card gives a line about three seconds. It has to tell the player one thing this person
does that a call could test. Keep the hobby the catalog already has and make it bear weight.

```
Officer story sheet: DRAFT until the officer record is filled
- Identity: <persona id>, <name as authored>, <she | he | they>
- Lands in: personalNote rewrite | design only (officer story file)
- Pressure line (18 words max, opens with She, He or They): <hobby, then the call moment it turns to>
- Contradiction (12 words max): <one, light> | pattern <row name from profile-patterns.md §4>
- Voice markers: length <short | medium>, notices first <one thing>, habit <one verbal habit>
- Markers grow from: <the pressure line words behind each> | copied from an example set because <reason>
- Radio sample (10 words max, position, status, need): <line> | markers shown <where each appears>
- Under strain (Overloaded form): <need dropped, or status repeated once>
- Layer 2 (after <n> shared operations, design only): <one object or act, no because clause>
- Layer 3 (after a <ledger kind> event, design only): <line with a ledger slot>
- Hooks: <tags such as checks_gear or knows_doors, never culture tags>
- Seat read: 5 roles <pass | variants written>, plausible on <steps>, 6 traits and none <pass>
```

Pressure line rules, each checkable.

1. Opens with She, He or They. A persona test fails otherwise.
2. Keeps the catalog hobby, then adds what it does on a call.
3. Names one thing a player can picture, such as a handset, a lock or a kettle.
4. Carries no virtue word (brave, dedicated, by the book, heroic, selfless, tireless, loyal).
5. Carries no trauma, loss or family tragedy. Weight is earned on the sheet later, if at all.
6. Runs 18 words at most. Aim for 12 to 16.
7. Turns from the hobby to a call moment the player can picture (a room, a voice, a door). Read it
   aloud and ask what this officer will notice on the next call. If the answer is vague, rewrite.
   Before, "He plays cooperative board games with neighbors and always asks who hasn't had a turn
   yet." After, "He plays cooperative board games. In a crowded room he finds the one who hasn't
   spoken."

Worked profiles, one in the they set, each contradiction from a different pattern.

| Part | Marcus Brooks, he | Dara Vann, they |
|---|---|---|
| Catalog note | He restores old radios on quiet weekends. | They keep a notebook of amusing overheard phrases. |
| Pressure line | He restores old radios and trusts nothing he hasn't opened up himself. He checks every handset twice. | They write down what strangers say, word for word, and can repeat a caller back exactly. |
| Contradiction | Fixes every radio in the building. Lets his own phone ring out. (fixes for others) | Quotes strangers all day. Tells nobody what's in the notebook. (open about others) |
| Markers | medium, notices gear, reports gear before people | medium, notices exact words, repeats the last thing said |
| Radio sample | Rear door. Both handsets good. Two of us. Your word. | Kitchen's clear. Back door locked, like the caller said. Holding. |
| Overloaded | Rear door. Handsets good. | Kitchen clear. Locked. |

Brooks fits every role. Beside impatient he reads fussy and beside steady careful. Rejected,
"Twenty years on the job and the best shot on the team, Marcus is the rock his squad leans on." It
states service, assumes a role, uses a virtue word and narrates feelings. More in profile-patterns.md.

## 4. Voice markers

This skill owns the voice-marker spec, and swat-call-prose applies it to every line an officer
speaks inside a call. Three markers per officer, picked from the persona's own pressure line. A
marker copied from an example set needs a stated reason on the sheet.

| Marker | Values | Example |
|---|---|---|
| Length | short (2 to 5 words a call) or medium (6 to 10) | "Back's locked." against "Back door's locked, chain on the inside." |
| Notices first | exits, hands, sound, time, gear, words, faces, light, count | time, "Kitchen clear at 2:14." |
| Habit | one verbal habit | names the person, ends on a question, reports gear before people |

Radio grammar is position, then status, then need. A stranger hearing only the line can say where
the officer is and what they see. Reserve "clear" for an empty or secured space, never followed by
occupants. "Counting two" is a coinage, not a status. At Ready all three markers show. At Strained
the habit drops first. At Overloaded the need drops or the status repeats once. Mandatory recovery
has no lines, because the officer cannot deploy.

When a trait changes, the voice changes with it, shown and never narrated, so "Reyes sounds
shaken" fails. Team humor stays inside the team and never lands on a caller, a subject or a victim.
Two officers may disagree by giving command different facts, never by questioning nerve. No stock
cop-show line ("I'm not going anywhere", "let me do the talking"). Regional voice lives in word
choice, never phonetic spelling. With no markers on file, in-call lines stay neutral.

Plain word order everywhere. Repeat the name rather than twist the sentence, so "Out comes Hale"
and "Unhurt, Reyes is outside" fail. Every "it" points to a noun in the same string, and a weapon
or door is named where the player acts on it (profile-patterns.md section 2).

## 5. Traits, conditions and origins

The `TRAIT_INFO` condition is one sentence under about 60 characters that names when the trait
applies and what changes. Steady's reads "Less strain when uncertainty escalates." A contributor
line follows the engine's stat-row shape, as in `Reyes: impatient, poor at waiting`.

Origin rules.

1. Starting traits belong to the seat and get no personal origin. "She learned calm from her
   mother" is banned. Text about one says how it shows on a call and fits any persona.
2. An earned positive trait cites the call by place and game date. "Steady. Earned at Wren Court,
   12 May 2027."
3. A strain trait never uses earned, won or gained. Its history line reads "Since Calder Street,
   3 May 2027." or "Carried from Calder Street." Its chip names the condition only, never the place.
4. A rookie line never mentions years on the job.
5. Prefer earned changes that reuse the six existing ids. A new id is an engineering request.
   Per-trait detail is in [references/trait-arc-map.md](references/trait-arc-map.md).

## 6. Arcs keyed to engine events

An arc beat hangs on an event the engine already records. Leaning, seen flag, fork and lock are
proposals until engineering builds them. The event rows, progress lines, predicates, arc shapes
and strain portrayal rules are in [references/trait-arc-map.md](references/trait-arc-map.md).

Twelve change rules.

1. **Name the cause.** Every gained or lost trait cites one call by place and game date.
2. **Telegraph and wait to be seen.** A leaning stays visible until the player has opened a shift
   report or the officer sheet that shows it, and at least one operation has passed. A game day is
   one real hour, so a count of operations alone lets an idle player miss it. Needs R12.
3. **Scope it.** "More strain on barricade calls" beats "less brave".
4. **Scope both ways.** A scoped leaning advances, clears or flips on a call only through a step
   inside its scope. Outside a call, only time and Rest duty clear it. Entry strain never clears on
   a contact call, and a steady earned there sits beside the strain without clearing it.
5. **Offer the fork.** Each option names what it costs and what it risks in the same sentence, and
   neither is better on every axis. Rest is certain and costs the squad's availability. Peer
   support costs a shift. Pairing keeps the officer deployable and costs the mentor's slot. If the
   paired step ends adverse, the leaning locks at once. If a reader can name the right option in one
   second, rewrite it.
6. **Write rest as the engine has it.** "Put {Squad} on rest. The strain note clears after 7 game
   days on rest." Never a per-officer week off unless R11 ships.
7. **Pair it.** Every earned negative has a positive earned the same way. The positive and the
   recovery are never earned only through a force or entry step. If the only road back runs
   through the thing that caused the strain, rewrite it.
8. **Recover through time and choice.** The engine already refuses to buy off burnout with a raise.
9. **Cap it** (proposal). Three traits per officer, one earned negative per officer per game week.
10. **Never punish restraint.** A call where the squad waited, talked or held fire and every person
    was safe or in accepted care adds no progress toward any negative trait, line or framing.
11. **Keep civilian harm out of officer growth.** A civilian death or injury never becomes an
    officer's flaw or the start of an arc. A strain leaning cites only calls whose
    `civilianOutcomes` show no injured_needs_care or deceased status and whose `personCasualties`
    hold no civilian record. Otherwise use the person lost row, a weight line and rest offered.
12. **Name the arc shape.** Pick one from the arc shapes table. No two officers in one batch share
    a shape and a fork pair, and no arc reuses the beat order of §10.

Strain is a normal response to hard calls. A strain line shows the behavior in its own sentence,
never as the cause of the adverse result, and every fork carries a routine support option.

## 7. Ledger, callbacks, pairs and earned names

A ledger entry is a recorded fact, never an invented memory. Kinds are first_call, rescue,
injured, person_lost, negotiated, mentored and favorable_under_pressure, all design only today. A
detail names one specific of that call, such as an object, a time, a room or what was said. "Kept
the stair light working at Wren Court with the clock high."

```
Ledger entry
- Kind: <ledger kind>
- Source: <debrief field it derives from, such as officerCasualties or disposition>
- Day: <game day, shown as a date>
- Place: <the call by its place, never the civilian's bound name>
- Specific: <object | time | room or position | what was said>
- Detail (80 characters max, past tense, frozen at debrief): <line>
```

Ledger and callback rules.

1. Stock closers such as "everyone walked out" appear at most once per officer and once per shift
   report. Two entries for one officer never share a sentence frame, and no three-word phrase
   repeats across one officer's surfaces.
2. One callback per operation, in the briefing callback component or the debrief, never in a
   choice label. It renders at display time and never enters `ScenarioDefinition` fields (R15).
3. No branch depends on a callback existing.
4. A callback that claims a contact or negotiation part shows only when the officer's role is comms
   or lead or the decision log put them on the contact step.
5. Civilians are named by role ("the man on the landing"), because the civilian name pool is the
   roster's own names.
6. Write a callback intent (entry, surface, edge, role on that step), and hand any spoken line to
   swat-call-prose. Shapes and templates are in
   [ledger-and-callbacks.md](references/ledger-and-callbacks.md).

A pair beat is two debrief lines between officers after shared operations (proposal, 8 shared),
each in its speaker's markers and on the work. The speaker sits in its own column on the sheet,
never before a colon, until the officer chip (R14) exists.

A nickname is offered from a ledger event, and the player accepts, renames or declines it. Every
word of the offer appears in, or points straight to, a ledger detail, debrief line or radio sample
the player saw, printed beside the offer as its Traces to line. A player must say where it came
from in one second. Reject idioms ("Back Room" suggests a back-room deal), and never draw on body,
age, accent, faith, culture, family, war vocabulary or a death.

## 8. Injury, strain and exits

Strain is a recoverable job injury, supported and written with dignity. Never write "cracked",
"broke", "lost their nerve" or "couldn't hack it".

An injury label names the event and the place, plain, with no body detail. Shape, "<what happened>
<during | while> <the task or place>", with the civilian named by role ("Fall at the doorway while
meeting the resident"). The prose lint bans "wound" and weapon nouns, so write the event instead.

A shift report entry runs 15 words at most. The UI prints the name first, so the detail must not
repeat it. A leaning entry opens with the behavior the player saw, then the choice. Progress
counters live on the sheet chip only, never in prose.

- leaning, "Gave the count twice on the Fennel Street stairs. Rest, peer support, or pair up."
- anniversary, "Ten years of service. Now Seasoned. First call here was the Calder Street flood."
- retirement_announced, "Leaves 2 Apr from strain. Three hard calls in five, the last at Calder
  Street."
- retired, "Retired after 26 years. Kept the stair light working at Wren Court."

Exit lines cite the ledger and name what the officer did. Career strings are built in code, so
these are proposals for engineering, not data edits.

## 9. Representation, spread and collisions

Culture is texture and art direction, never temperament, skill, trait odds or backstory. Faith,
family, disability and sexuality may be specifics an officer owns, never a punchline or a cause of
weakness. No phonetic accents anywhere.

Ethics minimum, so this file stands alone. Rule names follow the ethics rulebook in
swat-call-design. Cite by name if its numbering differs.

1. Force is never the reward (E2), and neither recovery nor a positive trait runs only through it.
2. Identity never signals danger or temperament (E3), for officers or for anyone else.
3. No gore (E7). Injury is plain and seen through care.
4. Composites only (E8). No real officer, incident or department.
5. Oversight can be right (E10). A complaint or review is never an obstacle to a good officer.
6. No officer death, and civilian harm never becomes an officer's flaw (rule 11 above).
7. Nothing credits an entry the ethics screen flags (E12 talk to entry without a visible threat
   and approval, E4 entry on a self-directed subject). Cite the screen line on the sheet.

Tally loss, fear, injury and strain lines per officer and per culture field, and flag any officer
above twice the median. Check every civilian cast against the deployed squads. Lines that touch
culture, faith, disability or sexuality go to a human reviewer. Spell-check persona notes by hand.
Scripts are in [references/representation-checks.md](references/representation-checks.md).

## 10. Worked arc, one shape of several

Illustrative only. This is the strain then recovery shape. Never reuse its beat order for another
officer in the batch, and no sentence here ships.

Morgan Hale, they, 46 at start, recon this campaign with the observant trait, 12 years of prior
service. Mandatory retirement comes at 60. Barricade predicate count recorded on the sheet.

1. Profile. "They walk a different footpath every Sunday and know three ways out of any block."
   Markers are medium, notices exits, names the street. Radio, "Rear's clear to Dace Street. Two
   ways out. Holding."
2. Calder Street and Ashby Road barricades, both adverse, every civilian safe. Stress crosses 60.
   The sheet chip shows the leaning. The shift entry shows behavior. "Called the rear clear twice
   at Ashby Road. Rest, peer support, or pair up."
3. Fork. "Put Squad 2 on rest. Certain, and the squad takes no calls for 7 game days." "Peer
   support for one shift. Hale stays on the board, and the note stays open." "Pair with Okafor on
   the next barricade. Squad stays deployable but spends Okafor's slot. An adverse ending locks
   the strain." The player picks rest. The note clears on the seventh day.
4. Weeks later Hale holds a position for forty minutes at Wren Court, and everyone inside is safe.
   "Steady. Earned at Wren Court, 12 May 2027." The strained repeat leaves the radio.
5. Exit at 60. "Retires at 60 on 2 Jun. Held the Wren Court side yard until the door opened."

## 11. Checks to run

Export every officer string to a plain text file exactly as it renders, prefixes included, under a
`# person_id` heading per officer. Never feed a checker a source file. Then run these.

1. The game string checker kept in ../swat-call-prose/references/string-checks.md, with
   `--lint-source src/gen/incident/gates/prose-lint.ts`, on every string that can render on a call
   surface. It lives inside the skills folder, so any harness can run it. List every prose lint
   hit as an owner decision, never a silent rewrite.
2. The dash, colon, phrase repeat and word order scripts and the contradiction diff in
   [references/representation-checks.md](references/representation-checks.md).
3. written-voice's checker, from wherever that skill is installed, with its allow list joined to
   ../swat-call-prose/references/game-allow-words.txt and every persona name.
4. `npx vitest run personnel` and `npm test`.

Paste each count verbatim from the script output, and use the same number in the record and any
checks table. If python3, a checker or the tests cannot run here, say so and check by eye. Record
"not run" with the reason.

## What enforces this file

Nothing in this file is machine-enforced by this file. The repo enforces a small part of it. Save
validation rejects unknown trait ids. A persona test checks that every note opens with She, He or
They, that ages run from 21 to under 60, and that builds ignore culture, appearance and pronouns.
Everything else is enforced only by the record below and by swat-writing-review, until engineering
ships the lint in [references/officer-data-proposal.md](references/officer-data-proposal.md).

## Closing gates and officer record

1. **Schema honesty.** Every line maps to a field or is labeled design only, request filed (§1).
2. **Seat.** Identity lines read against 5 roles and 6 traits plus none, arcs plausible per role.
3. **Calendar.** Ages and service agree with the calendar fields, or time is left out (§2).
4. **Identity separation.** Culture, appearance and pronouns set nothing about the officer (§9).
5. **Profile shape.** The Ready radio sample shows all three markers, each pointed to on the
   sheet, and a stranger can tell where the officer is and what is counted or noticed (§3, §4).
6. **Origins.** Starting traits get no origin, earned ones cite the call, strain never "earned".
7. **Change rules.** Cause, seen leaning, fork, paired positive, recovery and caps are present.
   Every clear or flip cites a step in the same scope (§6).
8. **Fork.** Both options carry a stated cost and risk, dominance 0 (§6).
9. **Restraint and harm.** Restraint costs no character, and no arc cites a call that hurt a civilian.
10. **Ledger.** Every callback, pair beat, nickname and exit resolves to a recorded fact (§7).
11. **Spread and repeats.** Tally done, stock closer repeats per officer 0, collisions checked.
12. **Lines and record.** Zero dashes, colons only in engine stat rows, inverted, fronted or
    dangling openers 0, orphan "it" 0, counts pasted from output.

```
Officer story record: DRAFT until every line is filled
- Scope: answered | <personas, arcs or events>, <n> lines
- Schema: answered | fields used <list> | design only <list> | requests <ids>
- Predicate counts: answered | <predicate> matches <n> reachable actions | count not run <reason>
- Seat: answered | <n> identity lines vs 5 roles and 6 traits plus none, role variants <n>, implausible role beats 0
- Calendar: answered | checked against ageAtStart, bornDay, serviceStartDay, time claims 0
- Identity separation: answered | temperament, skill, trait or backstory from identity 0
- Profiles: answered | <n>, markers shown in Ready sample <n of n>, copied markers <n with reasons>, contradiction patterns <list>
- Origins and changes: answered | <n> changes, each cites <call and date>, out-of-scope clears 0
- Arc shape: answered | <shape> | batch shape and fork pair repeats 0
- Fork: answered | options <list>, each with cost and risk, dominance 0
- Restraint: answered | costs for waiting, talking or holding fire when all lived 0
- Civilian outcomes on cited calls: answered | checked <n calls>, injured <n>, deceased <n>
- Ledger: answered | <n> callbacks, each maps to <ledger kind>, branches on a callback 0
- Nicknames: answered | <offer> traces to <line> | idioms rejected <n>
- Repeats: answered | stock closer repeats per officer 0, three-word repeats per officer <n kept, why>
- Spread and collisions: answered | tally at <where>, pronoun sets passed, roster surnames in casts <n>, routed to human <n>
- Lines: answered | dashes <n>, colons <n> all in engine stat rows, word order hits <n> fixed <n> kept <n>, over budget <n>, pasted from <script>
- Prose lint: answered | hits <n>, each listed as an owner decision | not run <reason>
- Tells checked: answered | voice-check ran with joined allow list | not run <reason>
- Tests: answered | <command> exit <code> | not run <reason>
- Handoff: swat-writing-review | requests <ids> | callback intents passed to swat-call-prose <n>
```

A slot that was not done says `not done | <reason>`. It is never deleted.

## References

- [profile-patterns.md](references/profile-patterns.md). Marker spec, radio grammar, conversions,
  contradiction patterns, marker sets, layered reveals and rejected profiles.
- [trait-arc-map.md](references/trait-arc-map.md). Traits as read, engine predicates, earned traits,
  strain portrayal, arc shapes, event rows with progress lines and pacing.
- [ledger-and-callbacks.md](references/ledger-and-callbacks.md). Detail shapes, callback intents,
  templates, pair beats, nicknames and exit lines.
- [officer-data-proposal.md](references/officer-data-proposal.md). Fields, lint and requests R1 to
  R15. Open it before filing any request.
- [representation-checks.md](references/representation-checks.md). Tally, pronoun, diacritic,
  repeat, contradiction, collision and spelling checks.
- [sources.md](references/sources.md). Every source and its limits.

Siblings by relative path. Budgets in ../swat-call-prose/references/surface-budgets.md (recruit
card 18 words, bio 40, shift entry 15, radio 10). Ethics in ../swat-call-design/references/
ethics-and-authenticity.md. If either moved, use this file's numbers and rules and say so.
