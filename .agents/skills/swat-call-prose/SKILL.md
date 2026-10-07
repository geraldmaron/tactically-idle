---
name: swat-call-prose
description: >-
  Use when writing or rewriting any player-visible string attached to a
  Tactically Idle call, from the board card, briefing, facts and map markers
  through stage prompts, choices, outcome previews, results, endings, debrief
  lines, radio and dialogue. Adds game rules on top of the written-voice
  skill, which keeps the general house voice. Mandatory gates are a named
  input, every engine field written or marked default, text for every band in
  every situation an action reaches, no preview softer than its worst result,
  every string inside its budget after binding, zero em dashes with colons
  only in fixed formats, a named and distinct cost in every option, the threat
  object always named, one address for the player, no 4-word run repeated
  across variants, the punch-up passes, and the game string checks and content
  gates run. Produces filled fields and a prose record. Not for deciding what
  happens in a call, officer text, or judging a batch. Stand down for docs and
  code comments.
license: Proprietary
metadata:
  version: 0.3.0
---

# SWAT call prose

This skill writes every line a player reads during a Tactically Idle call. The
player gives each screen a few seconds, and the owner counts the writing as the
game's main draw, so every string has to land on first read at phone width.

The bar already ships in the hand-authored armed story. "The gunfire stops. Eli
does not come out." A sound, an absence and a named person, in eight words
(its weapon word is legal only in the unlinted lane, see section 7). The floor
this skill replaces is the compiler's shared adapt prompt, "Check the disputed
point in person." It names no person, no place and no cost.

One test sits under every rule below. Each line names something a person on
scene could see, hear, touch or do.

## When not to use

Stand down and route the work when any of these holds.

1. The structure is new or undecided (lane, hidden truth, stages, choices,
   levers, endings). Run swat-call-design first.
2. The text belongs to an officer or persona (bios, trait lines, ledger
   details, shift-report personnel entries). Use swat-officer-stories.
3. Someone wants a verdict on finished text, including your own. Use
   swat-writing-review.
4. The text is a doc, code comment, commit message or plan. Use written-voice
   alone.
5. The string is UI chrome a component owns ("Still needed"), unless the owner
   asks.
6. The string sits in an issued content version. Write its replacement for a
   new version layer instead (section 2).

Tie-breaker. If the change alters who is in the call, what happens, which
choices exist or how it ends, it is design. A dominated option, a filler
option, a time-only mixed band or an ending no fixed text can hold is a note
for swat-call-design, never a wording fix.

## 1. What this adds to written-voice

The written-voice skill owns the house voice and the claims discipline, and
this file restates none of it. For game strings only, it overrides three
points. Em dashes are zero, en dashes and spaced hyphens included. Colons
appear only in clock times (2:10), stat rows the code builds and speaker
formats the UI prints. Paragraph targets do not apply to a one to three
sentence string. The game tell checks ship here as
scripts/game_string_checks.py, so the skill works without written-voice.

## 2. Start from the sheet

The input is a design sheet from swat-call-design, or one sentence saying the
structure is unchanged and why. With a new structure and no sheet, stop.

Ship the tip. Private logic, hidden truths, closing facts and the sheet's
working words ("her say", consent, rapport) are never printed. Show the act,
"She held the door for the medic herself."

| Lane | You write | The engine writes |
|---|---|---|
| Typed framework package | the IncidentFramework fields and v11 or later depth fields | adapt and resolve prompts, team responsibilities, approach summaries, markers, the placement line, the unfinished ending, mixed and adverse previews on resolutions |
| Hand-authored story | the whole ScenarioDefinition | binding, spelling bridge, pacing lines |
| Setting module | per-setting opening, briefing, prompts, action text, endings | everything outside the module |
| Version-gated override | replacement text for one later version only | the issued text, which never changes |

Search INCIDENT_CONTENT_VERSION for the current version (12 on 2026-10-06),
and ask the owner before touching the newest version's text. Never edit an
issued entry, because the fingerprint suites hash whole calls. Draft the
replacement for a version-gated layer (the framework-depth-v12.ts pattern),
tag it "needs version layer" and send the field request to design.

## 3. The surface map and coverage

Every string gets a surface tag and an engine field path before it gets
words, and a row with no engine field is cut. Lint ceilings come from
LENGTH_BUDGETS in src/gen/incident/gates/prose-lint.ts (search it if moved),
and the code wins. The full table, clamps, typed-lane reuse and tense rules
are in [references/surface-budgets.md](references/surface-budgets.md).

| Surface | Field | Hard limit | House target | Shape |
|---|---|---|---|---|
| Card title | title | 34 chars | 1 to 3 words | a place, object or person |
| Card hook | summary (typed opening) | none | 130 chars bound, first sentence 14 words | person and want in five words, then the danger |
| Pressure label | pressureLabel | none | 2 to 4 words | whose safety, then what runs out |
| Dispatch reason | dispatchReason | 240 | 2 sentences | who called, what they want the team for |
| Known, unknown | known[], unknown[] | 260 | 12 words | source, claim, how they know |
| Map marker | markers | 10 chars | 1 word | the claim, uppercase, ? while reported |
| Map task | action task | 12 chars, counted | 1 to 3 words | where the team goes |
| Stage prompt | prompt | 120 | 18 words | the new fact, then the pressure |
| Choice title | action title | 60 | 30 chars | verb, object, qualifier |
| Choice summary | action summary | 230, locked 80 | 20 words | the act, then its cost |
| Outcome preview | outcomePreview per band | none | 20 words | how well the team does it |
| Result line | outcome effect text | 240 | 30 words | who did what, what changed, one tense |
| Ending | title, summary | 60, 240 | 35 words | who is safe, who is not, one detail |
| Modifier, support, cert, gear | modifiers[].label, support.label, support.task, certBonus.label, equipment[].label | none | 6 words | the reason, in the world |

Coverage. Every writer-owned field of every action, fact, ending, objective,
service and modifier is written or marked "engine default". A required field
without text is a fix before handoff, never a gap in the record.

## 4. Line rules

Lines marked (repo) were read on 2026-10-06. After lines are never data.

1. **Concrete over mood.** Before (repo) "There was no answer and the attempt
   raised tension." After "The TV inside goes off mid-ring."
2. **Source once, then speak plainly.** Before (repo) "Having a key doesn’t
   prove the visit is welcome." After "A neighbor watched Taylor Brooks use a
   key on the side door."
3. **Never narrate a feeling, an inference, a decision or the good
   outcome.** No feeling verbs (feels, calms), adjectives in any position,
   fronted ones included ("Angry to be called"), or feeling nouns (anger,
   relief), in results, previews, fact results and endings. Give the cue and
   stop. Cut the "so he is" clause. No narrator attitude (apparently, of
   course, somehow). Report fact or a named person's words. A summary never
   states the favorable outcome. Before "The radio keeps changing stations, so
   he is up and about." After "The radio keeps changing stations."
4. **Leave out what the screen shows.** Timers, ratings and costs have UI.
   Never "off the board", "costs time", "takes longer" or "extra minutes".
   Say who waits or what doesn't happen. Before (repo) "Each conversation with
   Ruth takes two extra minutes." After "Ruth takes her time answering."
5. **Stakes are a named person and a near consequence.** Before "This will
   shape the trust of the whole street." After "His mother is on the lawn."
6. **Every option costs something the player values.** Time, safety, trust,
   evidence or strain. Before "Proceed with caution". After "Wait for the
   shield".
7. **Variants differ by fact.** Before (repo, ten frameworks) "It takes much
   longer, but it does not depend on the next step going right." After "Sit
   with Ruth until her daughter gets here."
8. **Harm is plain, brief and inside the lane lists.** Before "Blood on the
   kitchen floor." After "He can’t put weight on the left leg."
9. **Punctuation.** Periods do a dash's work. Before "The door’s locked [em
   dash] and someone’s moving inside." After "The door’s locked. Someone is
   moving inside."
10. **American words, digits and curly apostrophes.** Yard not garden, mail
    slot not letterbox. One clock form in narration, named in the record.
    Before "Her mum rang at half eleven." After "Her mom called at 11:30."
11. **Short sentences, plain order.** Average 8 to 14 words, none over 22.
    Vary length by merging or splitting real sentences. Vary openers by
    changing what the sentence is about (the door, the phone, a sound), never
    by reordering it. Player strings never use verb-first inversion ("Out
    comes Ben", "Down goes Lewis"), a fronted adjective or participle
    ("Unhurt, Lewis", "Folded in his pocket, Lewis") and a fragment made to
    dodge a name ("Out."). Force, harm and surrender lines always run subject
    then verb. Two-word lines are seasoning. At most two strings per call are
    only fragments, "Nothing." never stands alone, and a result's first
    sentence has a subject and a verb. With three or fewer people, names may
    open up to 35% of sentences. Before "Out comes Ben, clutching the slip."
    After "Ben comes out clutching the slip."
12. **One address.** Prompts, summaries and previews call the player's squad
    "you". Results and endings name the team or the acting role. Near-duplicate
    strings match word for word.
13. **Never defer.** A preview or summary never points to "the record", "the
    report" or "later". If a band can include harm to a person, the summary
    or preview says so plainly.
14. **Name the object, never a bare "it".** Each string is read alone. When
    the lint blocks the noun, give the object a lane-safe name the civilian
    would use ("their dad’s old hunting piece", "the long case from the
    closet") and repeat it. A pronoun needs its noun in the same string, and a
    threat line never uses one. The object has one location per situation,
    and every result matches it. Rules in vocabulary-and-lint.md.

More pairs, tagged by tell and fix lane, are in
[references/before-after-rewrites.md](references/before-after-rewrites.md).

## 5. Field shapes

Literal shapes, each with one illustrative line from one invented call (a
baker finds her storeroom latched from inside). Never copy them into data.

```
hook           <Person> <wants X>. <The wrong note>, and <who could be hurt if the team waits>.   (a weapon or a held person is named in lane-safe words)
               Lena Sorensen wants her bakery open by 5. The storeroom is latched from inside, and she has the spare key out.
known line     <Source> <saw | heard | says> <claim>, <how they know>.
               Lena found the latch down at 4:10. It only locks from inside.
stage prompt   <The new fact>. <The pressure, as a person doing something>.   (stage 1 never restates the hook)
               The latch lifts an inch, then drops. Lena is reaching past you for the handle.
choice title   <Verb> <object> <optional qualifier>
               Talk through the door first
summary A      <{lead} does the risky part>. <The cost, as a concrete event>.
               {lead} talks through the door. Lena’s ovens stay cold the whole time.
summary B      <The cost first>, <so | because> <the act>.
               Lena goes back to the counter, so you can open the door without her.
summary C      <The act> <until | unless> <a named person does something>.
               Wait at the storeroom until the voice inside answers you.
previews       favorable <how well you do it>. mixed <the good case + one thing now worse>. adverse <how it goes wrong, who pays>.
               mixed    The boy answers, but he heard Lena call him a thief.
truth-branched If the truth decides what you find, every band describes your execution, never the find.
               summary  If the boy has the dough cutter from the bench, you meet him holding it at the door.
               adverse  The door sticks halfway and Lena is still behind you.
result         <Who did what>. <What changed>.   (one tense for every result in the call, never two in one string)
               A boy’s voice says he will come out if the lady goes upstairs.
pressure label <Whose safety> <what runs out>, 2 to 4 words
               Lena’s hand on the key
ending         <Who is safe>. <Who is not, or what is open>. <One lasting detail on a named person present>.
               Lena opened at 5:20. The boy left with patrol and a bag of yesterday’s rolls.
still needed   <Verb> <task> <person>
               Call the boy’s mother back tomorrow
marker         <THE CLAIM>? while reported, <THE CHECKED FACT> after
               VOICE?   later VOICE or NO ONE
map task       <PLACE OR ACT>, 12 characters or fewer
               BACK DOOR
radio          <Position>. <Status>. <Need>.
               Back door. Latched. Need Lena out front.
```

Summary rules. Rotate shapes A, B and C within a stage. No two summaries on
one menu name the same cost holder and harm, unless the degree clearly
differs (14 minutes against one refusal). Each sentence has a person doing a
visible act, never a slogan, chiasmus or "no X, just Y". A bare speed word
opens a cost clause once per call, and "may" appears once per stage. With a
requirement, the cost lands in the first 80 characters. A cost is stated
once, and the adverse preview shows its consequence without restating it.

Preview rules. A preview false in any situation fails, so read every band
against every situation's result row. A preview also matches the worst
situation's severity. If any result in that band puts a person at the point
of harm, a weapon in hand or a near miss, the preview names that tier ("he
still has the hunting piece in reach when you get to him"). Every band names
a person and a visible act or position. "Something", "somewhere else", "the
talk breaks" and "little or nothing" fail. If no finding holds in every
situation, preview the act instead ("Mara gets out. Lewis keeps the phone.").
A mixed line that only adds delay fails.

Ending rules. Fixed ending text must hold on every path that reaches it, so
it carries no arrival, clock time or presence some path lacks. The final
sentence is a lasting human detail, never a process status ("goes to review")
and never "finally". Review belongs in the debrief or one fixed engine string,
word for word. When a band includes serious harm, and the design sheet allows
it on the card, the detail is the weight on a named person present (his
sister on the curb), never the act. An unresolved ending names who stays with
the person. An ending that cannot meet these is a note for swat-call-design.

Marker rules. A marker names the claim or the checked fact in neutral words,
never a person's name and never a motive (NO JOB, not GRUDGE).

## 6. Dialogue, radio and officers

Callers talk in fragments and landmarks, repeat the one thing they fear and
say how they know. Subjects have one need, said plainly, with no monologue or
explained motive. Radio gives position, status and need in under ten words.
Negotiators paraphrase, mirror, label, pause and ask, and never promise what
command has not approved or relay one person's claim about another.

A spoken line carries a fact only this call has (a name, an object, a time,
something the person said). Genre stock lines are banned in any spoken text
("Let me do the talking", "I’m not going anywhere"). "Weapon" is a radio and
briefing word that civilians never say. Reported speech is tagged (", Lewis
says") at most once per stage per speaker, and the line that matters is a
direct quote. Contact runs through a phone, a throw phone or a voice from
cover. From stage 1, patrol holds the outer perimeter and never watches,
listens or calls the name. The team observes, the negotiator talks from
cover, and nobody escorts or carries for the subject but the team. The
contact device keeps the properties the sheet gave it (a cell has no cord).
The lists, positions and paired examples are in
[references/dialogue-and-radio.md](references/dialogue-and-radio.md).

Officers. The player hired these people, so at least one summary per stage
names {lead} doing the risky part ("{lead} keeps her talking while she lies
on the tile."), and it still reads with "Squad" in its place. Hand-authored
calls carry three or more. Apply the voice markers swat-officer-stories
publishes in ../swat-officer-stories/references/profile-patterns.md, neutral
when none are on file. {lead} is the only officer token today, so
marker-driven lines are design only. Fill callback slots only from that
skill's ledger-backed templates, in slots swat-call-design reserved.

## 7. Tension inside the lint, and the ethics line

The typed lane's lint bans graphic injury, weapon specifics and procedure
(UNSAFE_DETAIL), unchecked accusations, settled guilt and meta phrasing. Read
the live lists in prose-lint.ts. A word that slips past a pattern is a gap,
never a license, and hand-authored text gets the lists by hand.

Report regex results verbatim, with the lane enforcing now, the lane that
would enforce if the lint were extended, and a lint-safe fallback, as
vocabulary-and-lint.md shows. Affirmative weapon mentions and subject death
lines go on the Lint policy collisions line even when the regex passes them.

Ethics rules constrain what happens. They are never narrated. Write no line
whose only job is to show the team complied ("Nobody promises him anything",
"as his words, not a finding"). Show it through behavior. The negotiator says
no, or Lewis asks and gets silence.

The full rulebook is
[../swat-call-design/references/ethics-and-authenticity.md](../swat-call-design/references/ethics-and-authenticity.md),
owned by swat-call-design. Cite it by E number. If it is missing, say so and
apply the E1 to E10 minimum at the end of
[references/vocabulary-and-lint.md](references/vocabulary-and-lint.md), which
also holds the words to use, avoid and swap.

## 8. Binding and variants

The binder replaces the authored full and first name as whole, case-sensitive
words (search bindScenarioText), so never open a sentence with a word equal to
a cast first name. Measure budgets after binding with the longest pool names.
Other hazards are in vocabulary-and-lint.md under Binding hazards.

A template carries structure, never a fixed flavor sentence (search "It takes
much longer" in framework-depth-v12.ts for the case to avoid). Variants differ by fact (the room, the
prop, the time, the person's own words), and situation variants change the
punchline clause, not just the opening. No run of four or more words repeats
across variants or across one call's outcomes, except a name, a fixed compiler
line or a motif kept on purpose (two uses at most).

An effect text belongs to one action. One escalation rule on several actions
gets one text per host action, under its own field path.

## 9. The punch-up passes

Run all seven, in order, on the whole call after the draft is complete.

1. **Cut.** Remove the hallway, the restated timer, any line the screen
   shows and any cost said twice. The stage 1 prompt opens on the first new
   fact, never the hook again. Before "The team heads upstairs to the landing
   outside 4B." After "4B’s door is open an inch."
2. **Specific.** Swap every mood word and every sheet term for a noun or an
   act. "Tension" becomes "the TV goes off". "Her say" becomes what she did.
3. **Verb.** Labels become actions. "Contact attempt" becomes "Knock and call
   his name".
4. **Voice.** Put the person's own words in, and the officer's markers where
   they exist. Give {lead} the risky part. Results are fact or attributed
   speech ("Nate said Moose sleeps on his boots"), never narrator attitude.
5. **Swap.** Exchange each pair of choice titles. If summaries and previews
   still fit, or one option beats another on every axis, the fault goes to
   swat-call-design. If one reads warmer, rewrite the other.
6. **Ending.** Write it last. Name each person's state and one lasting
   detail. No lesson. Before "Patience saved a life today." After "Forty
   minutes on the porch. He came out carrying the dog."
7. **Read aloud at speed.** Read every prompt, preview, result and ending in
   path order, each in one breath. Rewrite any sentence you would not say out
   loud, any maxim with an abstract object ("no more waiting on silence"),
   any stock aftermath beat ("sat in the truck a long time") and any clause
   with no subject.

## 10. Checks

1. Draft the strings in a tab-separated file in reading order with the
   columns in string-checks.md. Never feed a .ts file to a checker.
2. Run scripts/game_string_checks.py from this folder with the lint source,
   the cast names, the call's own nouns, kept motifs and --bind with the
   longest pool names. It needs only python3.
3. Fix every blocking hit. Opener share and cadence are reported, never
   chased. Fix them only by changing a sentence's subject or merging
   sentences, and otherwise explain them in the record.
4. Make the ten by-eye checks in string-checks.md section 5, including
   severity, antecedents, continuity, cost collision, images and the read
   aloud. Script zeros for feelings, policy voice and stock lines are not
   proof until the read confirms them.
5. Run written-voice's checker on the text file the script wrote when that
   skill is installed, and say so when it is not.
6. Run `npx vitest run content-gates content-playability issued catalog-v9`,
   then `npm run verify` before a pull request.
7. Open `/story.html?type=<type>` from `npm run dev` at phone width
   (docs/content-pipeline.md, search "story.html").

If you cannot run python3, the tests or the dev server, say so, use the perl
fallback or check by eye, and record each gap. Never claim an unrun pass.

## What enforces this file

Nothing in this file is machine-enforced by this file. The repo's prose-lint
enforces lengths, spelling, meta phrasing, names and the unsafe, accusation
and settled lists, on typed packages only. The content gates enforce
structure, not wording. The vendored script enforces nothing until someone
runs it, and its syntax, pronoun and tense checks are heuristics that miss
cases. Severity, antecedents, continuity, cost collisions, tone and the
hand-authored lane are enforced only by the record and swat-writing-review.

## Closing gates and prose record

Close each gate before handing off, with observed counts on each line.

1. Input named, a design sheet or a reason the structure is unchanged.
2. Coverage. Every writer-owned engine field written or marked engine default.
   Every action has favorable, mixed and adverse text in every situation it
   reaches, plus an adverse preview. No placeholder stands in for player text.
3. Strings inside their counted limits after binding with the longest pool
   names, over-target strings named with reasons.
4. Zero dashes. Colons only in clock times, stat rows and UI formats.
5. Pre-check claims sourced once, then plain. The truth stays hidden.
6. Each option has a named cost no other option on its menu shares, the swap
   test passes and no option dominates. Previews are never false and never
   softer than the worst situation's result.
7. No 4-word run across variants, no 3-word echo on a path, no image spent
   twice on a path without a change of state.
8. One address, one result tense, no sheet terms, policy voice, feelings,
   narrator attitude, inversions or bare threat pronouns. Roles in position,
   the contact device consistent.
9. {lead} doing the risky part in each stage, 3 or more hand-authored.
10. Script, read aloud, gates and issued suites run, or each recorded as not
    run. Each tell family's 0 names its method.
11. Seven punch-up passes done, ending written last. Until every line below
    is filled, the first line reads DRAFT.

```
Call prose record
- Input: answered | design sheet at <where> | structure unchanged because <why>
- Coverage: answered | written/required per surface <surface n/n, ...> | engine default <fields | none> | placeholders 0
- Bands: answered | actions <n>, cells <written>/<required>, adverse previews <n>/<n>
- Preview vs result: answered | false 0, severity mismatches 0, vague 0, across <n> bands and <n> situations
- Budgets: answered | <n> strings; over limit 0; locked clamp 0; hook authored <n>, worst bound <n>; over target <fields, reason | none>
- Punctuation: answered | dashes 0, colons <n> in <clock times | stat rows | none>, clock form <6 | six o’clock>
- Sourced once: answered | <n> pre-check claims, stacked hedges 0, truth differences across situations <none | list>
- Option cost and swap: answered | <n> options, cost collisions 0, swap failures 0, dominated 0, tone tilts 0
- Variants: answered | repeated sentences 0, 4-word runs 0, path echoes 0, images reused without change 0, motifs <phrase xN | none>
- Syntax: answered | inversions 0, fronted <0 or 1>, fragment-only strings <n of 2>, result tense <present | past>, tense mixes 0, name openers <n%>
- Objects and roles: answered | bare it without referent 0, threat pronouns 0, object locations checked <n>, device <cell | landline | throw phone> contradictions 0, role-position hits 0
- Tells: answered | feelings 0 <script and read>, policy voice 0 <script and read>, stock spoken 0 <script and read>, narrator hedges 0, address mix 0 | script only, not read <families | none>
- String checks: answered | <command> exit <code> | opener share <word n%>, cadence <cv, OK | FLAT because> | written-voice <ran | not installed>
- {lead} uses: answered | <n> across stages <list>
- Lint policy collisions (owner decision, not blocker): <string, word, regex result verbatim, lane enforcing now, lane that would enforce, lint-safe fallback | none>
- Ethics line: answered | rules applied <E numbers> from <sibling rulebook | inline minimum>
- Gates: answered | <command> exit <code> | not run <reason>
- Punch-up: answered | seven passes done, ending written last
- Version: answered | strings land in v<N>, issued text untouched, needs version layer <fields | none>
- Handoff: ready for swat-writing-review | structural notes sent to swat-call-design <list | none>
```

## References

- [references/surface-budgets.md](references/surface-budgets.md) for every budget, call and officer, owned here for all four skills.
- [references/before-after-rewrites.md](references/before-after-rewrites.md) when a line reads flat, generic or machine-made.
- [references/dialogue-and-radio.md](references/dialogue-and-radio.md) before anything a person says aloud, and for who stands where.
- [references/vocabulary-and-lint.md](references/vocabulary-and-lint.md) for lint words, object names, US usage and the ethics minimum.
- [references/string-checks.md](references/string-checks.md), [scripts/game_string_checks.py](scripts/game_string_checks.py) and [references/game-allow-words.txt](references/game-allow-words.txt) at step 10 and for batch review.
- [references/sources.md](references/sources.md) for where each rule comes from.
