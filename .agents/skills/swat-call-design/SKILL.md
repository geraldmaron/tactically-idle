---
name: swat-call-design
description: >-
  Use when designing a new Tactically Idle call or reshaping the structure of
  an existing one before final wording exists, whether a typed package, hand-
  authored story, setting module or version-gated override. Covers the lane
  and freeze check, the named person and private logic, the two-line hook,
  three stages as approach, turn and commit with a real dilemma at each, the
  consequence and ending map, pressure levers the data can carry, the ethics
  screen and a variant plan that differs by fact. Mandatory gates are lane and
  freeze status, the eight hook tests, the fake-choice checklist and a
  dominance grid on every stage, no dead flags, a band by situation
  consequence matrix, ending reachability, one planted turn, every adverse
  result traced to a visible cue, force gated on a visible threat to life, the
  ethics screen, and engineering requests for shapes the data cannot hold.
  Produces a call design sheet and a design record. Not for wording, officer
  bios or arcs, or judging finished content.
license: Proprietary
metadata:
  version: 0.3.0
---

# SWAT call design

This skill turns a call idea into a design sheet the engine can carry, before any final line is
written. It exists because of a line every typed call shows today. After the player picks an
approach, stage two says "Check the disputed point in person." Nobody in that sentence wants
anything, nothing gets worse if the team waits, and no rewrite rescues it. Those are structural
faults, and prose cannot repair them later.

The player gives a call seconds, and the writing is the main reason they come back. So every
beat they meet in about ninety seconds has to sit in a named field, pulled by a lever the data
supports. This skill decides that shape. The lines belong to swat-call-prose and the verdict to
swat-writing-review. Officers belong to swat-officer-stories.

Two prose rules hold even for placeholder lines on the sheet. Game text uses no em dashes, en
dashes or spaced hyphens. Colons appear only in stat rows and the speaker format the UI defines.

## When not to use

Stand down, and say so in one sentence with the reason, when the request is one of these.

- A wording change that keeps who is in the call, what happens and which choices exist. Use
  swat-call-prose.
- Officer bios, traits, arcs, callbacks or personnel lines. Use swat-officer-stories.
- Deciding whether finished content ships. Use swat-writing-review.
- Engine, compiler or gate code. Write the engineering request in section 11 and stop.
- Balance numbers with no story change, docs and anything players never see, or a one-line
  fix the lint names exactly. Fix it and skip the method.

The tie-breaker. A change to who is in the call, what happens or which choices exist is design,
and it starts here. A change to wording only is prose. When both change, design goes first. If a
sibling skill named here is not installed, say so in the record and use the inline rules in
this file. No gate in this file depends on a skill outside this folder.

## 1. Before you design, name the lane, version and contract

| Lane | Writer owns | Compiler or engine owns | Where (search symbol) |
|---|---|---|---|
| Typed framework package | The `IncidentFramework` fields, through the three situations and the v11 and v12 extensions | Stage labels, stage two and three prompts, responsibilities, approach and check summaries, adverse texts, the placement line, the situation 3 line, the unfinished ending, pressure | `src/content/incident-frameworks-v9.ts` (`ADDITIONAL_FRAMEWORKS`), compiled by `withAdditionalFramework` |
| Hand-authored story | The whole `ScenarioDefinition`, people, facts, actions, pressure, services and endings | The build chain in engine-map.md section 1, name binding and spelling. The prose lint does not run here | `STORY_ARCHETYPES`, `planEpisode`, variant modules, `withSecondChoicesV12` |
| Setting module | Per-setting prose for an existing story | Every action, flag and ending | `SettingModule`, `ArmedIncidentProse` |
| Version-gated override | New optional structure or text from a new content version | Every issued version, frozen byte for byte | `src/content/framework-depth-v12.ts` (`frameworkAt`) |

The freeze check. Read `INCIDENT_CONTENT_VERSION` in `src/gen/incident/index.ts` (12 on
2026-10-06; read it again). A version with an `issued-v*.test.ts` suite beside that file is
frozen and ships changes in a new layer. If the target has no suite, ask the owner whether it is
open and record the answer. `frameworkAt` adds only missing fields, so replacing an issued field
needs request R2. Details are in engine-map.md section 4.

Then read the contract for your lane from the source. [references/engine-map.md](references/engine-map.md)
lists it as read, including what a requirement can test, every `OutcomeEffect` field, the threat
enums, the `validateScenario` rules, the score and the build chain. If a path moved, search for
`ScenarioDefinition`, `IncidentFramework` or `INCIDENT_CONTENT_VERSION`. If you cannot read the
source, say so, put UNVERIFIED in the sheet's first line, and work from engine-map.md. Any
contract item you did not check makes the contract-read line partial, never answered.

Before adding a structural action (withdraw, care, handover), search the high-risk helpers
(`partialHR`) and the v6 to v12 layers for a helper or a deliberate removal. Reuse it, or name
the layer you reverse and why.

The compiler reuses writer fields. `opening` is the card summary and the first briefing line.
`question` is the stage one prompt, the briefing unknown and an unfinished call's remaining
task. `results[i]` is the choice summary, the favorable preview and the ending summary.

## 2. The player's ninety seconds, in seconds and taps

Times are house estimates to tune in playtest, not measurements.

| Beat | Time | What the player is doing | Typed lane fields | Hand-authored fields |
|---|---|---|---|---|
| Card | about 3 s | Feels a curiosity gap. Who, and what is wrong? | `title`, `opening` | `title`, `summary`, `pressureLabel` |
| Briefing | 10 s or less | Sorts sourced knowns from one live unknown | `dispatch`, `opening`, `question` | `briefing`, facts |
| Stage 1, approach | about 15 s | Trades information against speed. The turn is planted here | `approaches`, `approachResults`, `precaution` | `stages.assess`, `contextPrompts` |
| Stage 2, turn | about 15 s | Meets one discovery that reprices stage 1 | `verify`, `claim`, `confirmed`, `disproved`, `actOnReport` | `stages.adapt`, `truth`, `reveal` |
| Stage 3, commit | about 20 s | Makes the hardest trade, on a menu earlier choices shaped | `resolutions`, `results`, `corroborate`, `waitFor` | `stages.resolve`, requirements |
| Ending | about 8 s | Remembers the peak and the end. A person's state | `results`, `waitFor.result` | `endings` |
| Debrief | about 10 s | Reads the record, then one open loop | fact texts | `remainingTasks`, `civilianOutcomes` |

- Briefing. At most 4 known lines and 1 unknown, counting dispatch reason, responsibilities and
  any line the recipe appends (the `deliberate_answers` line, engine-map.md section 5). The fact
  the turn depends on goes in `known[0]` or `known[1]`. Row E totals 10 seconds or less.
- Taps. A stage shows two or three dilemma options at once and takes no more than three taps on
  its most common path. A step with no dilemma (calling a crew, waiting for it, a handover) is
  never its own tap. Fold it into the result that caused it or into the ending, or file a
  request. Row E records the tap count of the most common and the longest path per stage.

## 3. Premise and person

Write the premise block first. If a line will not fill, the call is not ready.

```
Premise
Call type borrowed:  <the familiar call this starts from>
Person:              <name, age, role> wants <the want, in plain words>
Wrong note:          <the one ordinary detail that does not fit>
Worse if they wait:  <what changes, for whom, if the team holds>
Why a tactical team: "<one quoted line from the briefing that shows it>"
Self-harm risk:      <none | present, because <signs>> (every armed or weapon-reaching person)
Private logic:       <why the person acts this way; never printed as an explanation>
Iceberg tip:         <one concrete detail from the private logic> in <field>, via <choice>
Closing fact:        <the one fact that answers the gap; NEVER PRINTED>
```

Then one card per person on scene.

```
Person card
Name, age, role:       <full name, age, role; defined once, here>
Wants, in their words: "<a line they would say>"
Fears:                 <one concrete fear>
Behavioral reads:      <2 or 3 things the team can observe that change which choice is wise>
Memory anchor:         <one object or habit, shown on the common path by stage 2; callbacks per row C>
How they know:         <what they saw, heard or were told, and from whom>
Private logic:         <never explained in text; their behavior obeys it>
Pronouns:              <one set, the same in every field>
```

The rules.

- Borrow the call type and invent every particular. Never retell a real incident (E8).
- Threat comes only from behavior, such as a weapon, a threat or a history with this victim.
  Never from identity, accent, diagnosis or address (E3).
- The subject's life always counts, even when they are why everyone is there (E9).
- Callers and bystanders get a role and how they know. In the typed lane they stay unnamed.
- Everyone believes they are justified. The private logic is never printed as an explanation.
  One earned detail may surface as the favorable result of a hold or in the best ending. That
  is the iceberg tip, and only a choice reaches it.
- The memory anchor is a detail, never a closing formula. Called back in at most half the
  endings, each callback changes its state or who holds it, and it closes two endings at most
  (row C). A proof run that called it back in every ending closed six of eight on one shape.
- The person named first in the hook still matters in stage 3, as the stake or the payoff. If a
  wrong-note bystander opens the hook, the subject or the person at risk takes sentence two,
  and the bystander's best line is saved for the ending, never spent in the first result.
- The tactical team must be earned in player text (E12.1). If the briefing cannot quote a line
  for each activation condition, this is a patrol, crisis officer or EMS call.
- Self-harm risk is judged from risk signs, never only from words said (E4). When present,
  E4.2 to E4.5, E4.7 and E12.5 apply. Row C places every role against the advantage line and
  writes threat values in the engine's enum spelling (engine-map.md section 2, E12.2).

## 4. The hook

The hook is the start of the card summary (`opening` or `summary`). The live panel clamps it to
three lines at 14 px, so text past about 130 characters may never be read (an estimate from the
CSS, never measured). It passes when all eight hold.

1. The person's name is within the first five words.
2. Sentence one carries the want or the wrong note.
3. Sentence two carries what gets worse if the team waits.
4. Both sentences fit in about 130 characters.
5. Exactly one gap is open, and a single fact would close it.
6. No disclaimer, no genre word and no stacked hedge.
7. It names the danger to a person in plain words the lane allows ("has a weapon", "won't let
   her leave", "stopped answering"). A deadline counts for test 3 only when the hook ties it to
   a person's safety, never to an office or a form.
8. At most two proper names, and every name after the first carries a role on first mention
   ("his old boss, Mara Holt").

The repo's best opener, "Ben Flores should have left the print shop ten minutes ago.", is
followed by a sentence that fails tests 7 and 8. design-sheet.md section 4 shows that repair.

Check the hook and premise lines for tells. If the written-voice skill and its checker are
installed, run the checker on them. If not, say "sibling skill absent" in the record and check
by eye against this file's two prose rules and the stock phrases you can name.

## 5. Three stages, one escalating dilemma

- Stage 1, approach. Who, what they want and what waiting costs. Plant the fact that will turn.
- Stage 2, turn. One discovery, planted earlier, that reprices the stage 1 choice. Spend
  surprise here and nowhere else.
- Stage 3, commit. The hardest trade, on a menu the earlier choices shaped. Every stage 3
  option can end the call, or move a person's state toward an ending, on its favorable band.
- One stage per call is a hold, where the question is whether to act yet.
- Every stage opens mid-problem. Cut the hallway.
- Branches rejoin at shared stages, and tracked state carries the difference. In the typed lane
  that needs R8, and the turn lives in writer fields such as `approachResults` and `confirmed`.

Stage exits (hand-authored). List every action and band that sets `stage` or `ending` in row F.
Walk the orders where the player takes the transition action first and the gating action last,
on the adverse band. Any order with no visible exit blocks the design. Write each context prompt
as an exact `Condition` in array order, because the first match wins, and walk which one each
entry state shows (engine-map.md section 7). A `Condition` ANDs its keys, so scan every cell for
the word "or" and rewrite it (engine-map.md section 2). In resolve, every band of every action
needs one effect with `ending` or `stage: 'resolve'` and no `when` or `truth`. A stage with no
options left ends in `handed_over`.

## 6. Real dilemmas

A real dilemma sets two goods from different values against each other (care against autonomy,
loyalty against fairness). Write each option as what it puts at risk and who pays. Price any
sure option honestly, or it wins every time.

- Options in a stage exclude each other. Taking one closes or reprices the others. If two can
  both be taken, the stage is an ordering. Treat it as one choice and find the real trade.
- An option whose payoff is information costs something the player can see and will miss.
  Pressure alone is not enough, and its summary never says it reveals the answer.
- The player is the incident commander's will. Titles are the act ("Send the shield to her
  door"), never a request for permission. Oversight goes in the cost line only when it can
  refuse or delay, and then the refusal is priced.
- The squad builds the menu through what a requirement can test (engine-map.md section 2).
  There is no role requirement and no OR.
- Band risk and truth risk are separate. `outcomePreview` is per band and reads true on every
  truth. The favorable band's text never contains a truth result the player would call a
  failure. Give that result its own `resultLabels`, or move it out of favorable.
- Containment, including a staged emergency team, is the default and never a choice. Dilemmas
  sit on how close, how visible and when to use it (E12).

The fake-choice checklist. Reject a choice when any line is true.

1. Every option forecasts near-certain success, or all forecasts and costs are nearly identical.
2. Swapping the labels leaves the outcome text still fitting. The options differ only in wording.
3. One option is better on every axis, or one is an obvious trap.
4. The player can't say why they'd pick an option. Blind choices breed regret and frustration.
5. Nothing the player can see changes afterward, in evidence, a relationship, a person's safety, resources or the ending.
6. Waiting or opting out costs nothing. Opting out of the adventure makes a boring story.
7. A later stage forgets the choice.
8. Tone gives away the answer, with one option written warmly and the others as straw men.
9. A band label contradicts its text on some truth.
10. The mixed band is the favorable band plus time. A mixed result must change who is talking, what is known, where a person is, or what a later option costs.

Line 1 is read per visible option set, not per stage. If two favorable previews visible together
name the same act by the same person, rewrite one to say what makes it different.

Line 3 is never judged by eye. Fill the dominance grid in design-sheet.md row F for every stage
and every variant module that changes the summaries. Four rules decide what a cell may hold,
worked in [references/dilemma-patterns.md](references/dilemma-patterns.md).

1. Visible costs only. Quote the summary or preview string that carries each cost. A cost
   that lives only in a modifier, a flag or the grid does not count.
2. No phantom costs. A "Who pays" cell counts only if a reachable path charges it, named in
   "Charged by". An empty cell means remove the option or make the cost real.
3. Minutes are the idle player's main currency. A force or entry option that saves more than
   twice the restraint option's minutes costs more on trust, strain and completion, all three,
   wherever it is reachable, or the stage fails E2.
4. Values pay back. A value option that loses on odds and minutes wins in a column the player
   feels afterward, named in the payoff column.

If any option still equals or beats another in every column, cut it or give the loser something
only it protects. Swap two titles, and if each outcome still fits, rewrite. Read both aloud, and
if one sounds kinder, rewrite the other. When waiting preserves life, it is never the losing
choice by design (E2).

## 7. Consequences, endings and the open loop

- Foreseeable, not predictable. Every mixed and adverse outcome traces to a cue shown before the
  choice, in a field you can name.
- A setback changes the situation, never only a number. Every flag a band sets is read by at
  least one later `Condition`, listed with its reader in row H. A flag with no reader is
  decoration, and the band is judged on its other effects alone for checklist line 10.
- Full matrix. Every truth-branched action gets rows s1 to s3 by favorable, mixed and adverse,
  each cell a distinct line or "same as <cell>" with a reason. Empty cells and notes fail.
- Score. Every completing effect carries an `objective` value, and row H lists the objective
  delta per action per band. The run score weighs objective and civilian safety only
  (engine-map.md, Score row), so a grade claim needs those numbers, not trust alone.
- Ending reachability and triggers. List every path to each ending with elapsed minutes,
  pressure, objective and each service's state, and state only what is true on every row. One
  trigger row per closing action, with band, exact `Condition` and ending id. A completion a
  casualty could make untrue carries `notFlags` `casualty:untreated` and
  `casualty:awaiting_transport`. Services meet the `validateScenario` rules in engine-map.md.
- Endings use the engine's dispositions. `resolved`, `care_accepted` and `followup_agreed` are
  full completions. `relief_partial` and `unresolved` list `remainingTasks`.
- Honest endings name each person's state, and who is still responsible for each person at risk
  (E11). A surrender is a directed walk-out, and no ending implies release after an alleged
  crime (E11.1). When the team's force hurts anyone, the summary states that person's state
  first and the debrief says the force goes to review (E2). Any death is human-reviewed.
- When a reveal confirms harm, the medic's window is a context prompt, and a path that waits
  past it says what the delay cost in its ending (E4.4a).
- Ending wording. A motif callback is plain and under 12 words and never ties a bow. The best
  ending leaves one thing unfinished for a named person. Three or more endings closing on the
  same subject plus verb fails row I.
- The mystery comes first and the moral cost after it, in stage 3 or the debrief. Officer harm
  carries into the roster, and swat-officer-stories decides what it does to the officer.
- Leave one open loop the player can pick up (a forced lock, the niece's call tomorrow).

## 8. Pressure the data can carry

Typed frameworks hard-code pressure (start 5, 0.1 a minute, threshold 95), so no typed call has
a clock, and no line may promise one. Pick a lever the lane supports, or file R3. The levers and
their mechanics are in engine-map.md section 7.

- A clock needs a reason nobody can stop, stated in the call. It speeds a decision and never
  excuses abuse (E10).
- A named deadline needs a visible distance at least once per stage, as a person doing
  something ("Mara says it is twenty to six"). A deadline line never becomes false while its
  prompt can still show. An effect's `pressureAtLeast` reads pressure before the action's
  minutes, so give a deadline as a range of commits.
- Pressure drains civilian safety past the threshold even after everyone is safe, so meet the
  three conditions in engine-map.md section 7. It never creates the threat (E12.4, E12.5).
- Convert every threshold to minutes and print it. Every number on the sheet states its unit
  and field.

## 9. Variants and distinctness

Variants differ by fact, never by wording. Plan them as fact axes in design-sheet.md row L.

- Hidden axes are independent draws unless the sheet says otherwise. When one hidden fact is
  derived from another, list every action that reveals either, with difficulty, minutes and
  cost. A cheaper reveal of the derived fact settles the turn too, and fails checklist line 3.
- A flag set inside a truth branch that gates a `visibleWhen` or a context prompt is a reveal.
  Pair it with a knowledge effect on the fact it implies and price it in row L. An option set
  that differs by situation before the fact is settled is a leak.
- Mark each per-situation string as `variant-module` or `truth-branch(factId, is)`. Two
  situations with the same truth cannot get different text from a truth branch.
- Prose-only variants collide in the distinctness gate. Differ on both sides of the truth.

The gate, from the repo root. `npx vitest run content-gates content-playability` (checked with
`vitest list` on 2026-10-06). If you cannot run it, record "not run" with the reason.

## 10. Ethics screen

Mark each line one by one. The full rules are in
[references/ethics-and-authenticity.md](references/ethics-and-authenticity.md). If that file is
missing, say so and apply this list as written.

1. E1 No manual. Decisions and costs, never a method, entry sequence or munition.
2. E2 Force is never the reward, in trust, score or minutes (section 6, rule 3). The best ending
   is everyone walking out. No civilian or medic gesture defuses a drawn weapon.
3. E3 Identity never signals danger. "Clear" needs a batch tally of the subject role across
   seeds. Until then the slot reads "pending batch tally".
4. E4 Crisis rules, whenever weapon access meets a loss event and a refusal. Not applicable
   needs a person-card reason. E4.5 overrides E2.1, so no death card. The sheet holds a drafted
   content note and support line (E4.7), or the record is incomplete.
5. E5 Domestic abuse is a pattern of control, with a named victim who has a life.
6. E6 Forced entry costs someone, and the sheet says who. Entry against any refusal, of care or
   of entry, carries command's reason line, and so does a re-entry.
7. E7 No gore. Injury is brief and plain, seen through the medic.
8. E8 Composites only. No real incident, victim or agency.
9. E9 The subject's life always counts.
10. E10 Oversight can be right. Negotiators, medics and reviewers are never the obstacle.
11. E12.1 Call-out earned. Quote the player-facing line for each of the four conditions.
12. E12.2 to E12.4 Real flow. Every role placed against the advantage line. Family at the tape
    never carries messages. Concessions name command's approval and offer only what the team
    can do, and no held person bargains. A clock alone never creates the threat.
13. E12.5 No force or entry without a visible threat to life. An impasse alone never opens it.
    Row F lists each force and entry action's `visibleWhen` per situation with the quoted
    threat line. A self-directed crisis situation shows no force option.

## 11. Engineering requests

Any shape the data cannot hold becomes a request, never a prose workaround.

```
Engineering request
Need:            <what the call must do that the data cannot express>
Current limit:   <symbol, and the observed behavior>
Build links:     <which of the chain in engine-map.md section 1 it touches>
Proposed field:  <optional field on <type>>, default <value>, issued output byte-identical
Content version: v<N>
Blocks:          <sheet rows>
Extends:         <R1 to R10 | new>
```

Reuse a known request first (engine-map.md section 8). An owner decision lists the exact
strings with their field paths, never only the words.

## 12. Handoff and officer slots

The sheet goes to swat-call-prose with the private logic, the truth and the closing fact marked
NEVER PRINTED. Its sample lines are placeholders, and none may ship as written. Officer slots
are reserved in the briefing or debrief only, never a choice label, and no branch depends on
one. The sheet also fills the agent brief in `docs/content-pipeline.md` (search "Agent brief
template"), as mapped in design-sheet.md.

## What enforces this file

Nothing in this file is machine-enforced by this file. The repo gates enforce path
distinctness, two takeable choices per stage, playability, `validateScenario`, and the prose
lint on typed packages only. Hook quality, dominance, phantom costs, dead flags, the objective
map, tap counts, the full matrix, ending reachability, the force gates and the ethics screen
are enforced only by the record below and by swat-writing-review reading it. A record with a
slot left blank is a draft.

## Closing gates and design record

Each line below is a gate, and the description's mandatory gates map onto them. The sheet says
DRAFT in its first line until every slot is answered or marked not done with a reason. Rows are
the lettered rows in design-sheet.md.

```
Call design record
- Lane and version (row A): answered | <lane>, content v<N>, suites read <files>, owner asked <yes, answer | no, why>
- Contract read (row A): answered | partial, <items not checked> | not done: <reason>, sheet UNVERIFIED
- Person and hook (rows B to D): <name> wants <want>; hook "<text>" <n> chars; tests 1 to 8 pass; names <n>; gap <fact>
- Hook person in stage 3 (row C): yes, as <stake | payoff> in <field> | no, hook rewritten
- Memory anchor (rows C, I): callbacks <n> of <m> endings; anchor closers <n>; same subject+verb closers max <n>; motif max per path <n>
- Call-out earned (row B): "<quoted briefing line>" for armed, threat, advantage, refusal | changed to <call type>
- Self-harm risk (row B): none | present, <signs>, E4 applied
- Iceberg tip (row B): <detail> in <field>, reached only through <choice>
- People binding (row C): <n> people, threat enums checked, transitions <n>, civilian outcome lines <n> | typed lane
- Geography (row C): advantage line "<text>"; roles placed <n>; in line of sight <n, each with cost on <option>>
- Briefing and taps (row E): <n> lines incl. appended, <s> s; turn fact in known[<0|1>]; taps common/longest s1 <a/b>, s2 <a/b>, s3 <a/b>
- Dilemma per stage (row F): 1 <good vs good>, 2 <...>, 3 <...>; checklist 1 to 10 clean; options exclusive
- Dominance grid (row F): per stage and variant <none beaten>; phantom costs 0; costs quoted <n>; minutes rule <pass>; payoff column filled
- Action rows (row F): <n> rows, incomplete 0; helpers searched <symbols>; layers reversed <none | which, why>
- Force and entry gates (row F): <n> actions; visibleWhen per situation listed; threat lines quoted; self-directed situations with force visible 0
- Stage exits and context prompts (row F): <n> orders, dead ends 0; <n> prompts with exact Conditions, shadowed 0 | typed lane
- Turn (row G): planted in <field> ("<fragment>"), revealed in <field>, reprices <choice>
- Consequence matrix (row H): <n> actions, <n> cells, empty 0, mixed-equals-favorable-plus-time 0, cues traced
- Flags set, readers (row H): <n> flags, <n> with a reader, dead 0
- Objective (rows H, I): delta per band listed; each ending's objective fastest/slowest <list>
- Effects (row H): keys diffed against OutcomeEffect; extra keys 0 | <key, RQ>; OR scan 0
- Services (rows H, I): <id, requested by, accepted by ending | no remaining task confirmed>; acceptances carry externalSupport available
- Ending reachability and triggers (row I): <n> endings, <n> paths, all summaries true; clock times 0; <n> trigger rows, casualty notFlags on <ids>
- Endings and loop (rows I, J): best <who walks out, what stays unfinished>; partial <remainingTasks>; loop <thread>
- Lever and minutes (row K): <levers>; threshold reached between commits <a> and <b> | request <R> filed
- Variants (row L): axes <list>; correlated <cheapest reveal | none>; visibility reveals <n, each paired>; strings marked
- Distinctness gate: <command> exit <code> | not run: <reason>
- Ethics screen (row M): E1 to E10, E12.1 to E12.5 <clear | finding, per line>; E4 <applies | screened, reason>
- E3 tally (row M): clear, <seeds, subject-role distribution> | pending batch tally
- Crisis checks (row M): E4.5 vs E2.1 checked; content note "<draft>"; support line "<draft>"; pending O2, R5 | E4 screened
- Concessions (row M): <option, approved by, what the team delivers, held person not a party> | none
- Officer slots (row N): reserved in <briefing | debrief | none>; no branch depends on one; placeholders in player strings 0
- Requests and owner decisions (row O): <none | R numbers, with build links>; <O number, exact strings with field paths | none>
- Tells on hook and premise: <checker counts> | sibling skill absent, checked by eye
- Handoff: sheet at <where>, next swat-call-prose
```

## References

- [references/engine-map.md](references/engine-map.md). Fields, enums, score, effects, gates.
- [references/design-sheet.md](references/design-sheet.md). The template, tables, two sheets.
- [references/dilemma-patterns.md](references/dilemma-patterns.md). Checklist, grid rules, patterns.
- [references/technique-library.md](references/technique-library.md). Craft mapped to fields.
- [references/ethics-and-authenticity.md](references/ethics-and-authenticity.md). The rulebook.
- [references/sources.md](references/sources.md). Every source and its limits.
