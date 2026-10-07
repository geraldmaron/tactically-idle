---
name: swat-writing-review
description: >-
  Use when Tactically Idle call text, a batch of generated variants or a set
  of officer text is written and through its automated gates but not yet
  frozen, and someone must decide whether it ships or asks whether the game
  prose is good enough. Covers a cold read for the seconds test, a path read
  in player order at phone width, a table read of every spoken line, choice,
  consequence and spoiler audits, an ethics and copaganda audit, and a batch
  audit for repetition, name collisions, skew and crisis frequency. Mandatory
  gates are a separate reader, the rendered read or a stated gap, every stage
  judged against the fake-choice checklist, engine gates actually run, an
  engine dry-run for unbuilt calls, every finding tied to a field path with
  its fix as data and an owning skill, and one approve, edit or reject verdict
  per call. Produces routed findings and a review record. Not for drafting or
  rewriting text, code review, or docs. Stand down when nothing player-visible
  changed.
license: Proprietary
metadata:
  version: 0.3.0
---

# SWAT writing review

The repo's gates catch length, banned words, four-word spoilers, identical decision paths and
stages with fewer than two takeable choices. Nothing in the repo catches a boring card, a
choice nobody would make, a sermon ending, a slanted cast or a line no frightened person would
say. This skill is the second reader that catches those. It reads a call the way a player meets
it (on a phone, in seconds, one path at a time), then reads the whole variant set the way no
single player ever will. It extends the reviewer checklist in docs/content-pipeline.md (search
for "Reviewer checklist" if the file moved). It diagnoses and routes. It writes fixes only as
data inside findings and never edits the package.

Hard rules this review checks in every player-visible string, restated so the file works alone.

- No em dashes or en dashes in game text, and no spaced hyphen doing a dash's job.
- Colons only in clock times, stat rows and the UI's speaker format.
- No stock AI tells. The written-voice skill owns the general tell catalog and its checker.
  This review runs that checker and adds game checks on top.
- Preserving life is the best outcome. Force is never the reward.
- Issued content is never edited. Fixes ship in a later content version.
- A summary claim is a hypothesis. Check it against the table that would break it.

## When not to use

Stand down, and say so in one sentence, when any of these holds.

- No drafted text exists yet. Run swat-call-design, then swat-call-prose.
- Someone wants lines rewritten during the read. Write the finding with a proposed
  replacement and route it, and the owning skill makes the edit.
- The change is compiler, gate or UI code. That needs a code review.
- The text is docs, plans, commit messages or PR prose. Use written-voice alone.
- Nothing player-visible changed, such as a balance number or a byte-identical refactor.
- The content is issued and no new version is planned. Record a backlog note, never a verdict.

Scaled use. A single rewritten string gets pass one (cold read) and pass three (table read)
only, and the record marks every other gate "not applicable, single string". Standing down
never skips the cliche runner and the written-voice checker on drafted strings. Routing. "This
choice feels fake" comes here to diagnose, then goes to swat-call-design to fix. "This hook is
weak" goes straight to swat-call-prose unless someone asks whether it ships.

## 1. Scope, inputs and the freeze line

Gate 1 and gate 2. Write this block before reading a single call.

```
Review scope
- Calls: <type ids or story ids>
- Situations and pacings: <1 to 3>, <ordinary | deliberate_answers | both>
- Seeds and buildings: <call seeds>, <building families>
- Officer text: <persona ids or arc ids | none>
- Content version: v<N> from INCIDENT_CONTENT_VERSION
- Issued fingerprint files present: <issued-vN list>
- Reachable paths: <n from the sheet's path explorer | static walk because nothing is built>
- Records received: design <where | none>, prose <where | none>, officer <where | none>
- Reader: <separate | self-read declared, drafted by me, cold read kept cold by <how>>
```

1. Review runs after the automated gates are green and before fingerprints are captured. If a
   gate is red, stop and hand the package back.
2. Read `INCIDENT_CONTENT_VERSION` in src/gen/incident/index.ts and list the
   issued-v*-fingerprints.json files beside it (search the symbol if the file moved). A version
   with a fingerprint file is frozen, and its findings become work for the next version.
3. Whether the newest version is still open is the owner's call. Ask, never assume.
4. The review edits nothing, neither data nor issued text.
5. Read the design, prose and officer records first. A slot marked "not run" is a gap you now
   check by hand. A missing record is a fix before freeze finding, routed to its skill. A record
   line that says "complete" or "answered" is a claim you test, never a fact you inherit.
   A prose record whose Tells checked or cliche runner line says "not run" is a fix before
   freeze finding routed to swat-call-prose, and you run both yourself before reading on.
6. Fresh reader. If one agent drafts and reviews, declare the self-read and follow the limits
   in section 11. The self-read steps are in references/table-read-protocol.md section 4.

## 2. Set up the read

Gate 3. Read the text where the player meets it.

1. Run `npm run dev` and open `/story.html?type=<type>` on the dev server. Use the selectors
   the page in front of you offers, and record the URL of every read.
2. Read every situation, both pacings when the cast has a deliberate_answers member, and at
   least two building families.
3. Run the sheet's path explorer ("Explore every path" on 2026-10-06) and copy its summary
   line into the path log. When nothing is built, run the static walk instead (section 4).
4. Open the running game at a 390px viewport and play one path to an ending. The sheet does
   not show clamps, chips or hidden summaries the way the game does. The list of what each
   surface hides is in references/table-read-protocol.md.
5. Capability honesty. If you cannot start the server, render the page or set a viewport, say
   so in one sentence, export the strings in player order and list the surfaces you could not
   see. An exported read is a stated gap, never a silent substitute.

Budgets come from ../swat-call-prose/references/surface-budgets.md. If that sibling is missing,
use `LENGTH_BUDGETS` in src/gen/incident/gates/prose-lint.ts and say so in the record.

## 3. Pass one, the cold read

Gate 4. Read the card for about 3 seconds and the briefing for about 10. Look away, then write
this, leaving a slot blank rather than guessing.

```
Cold read <call>, situation <n>, seed <s>
- Who: <name and role | blank>
- Wants: <their want in a few words | blank>
- Worse if they wait: <what gets worse | blank>
- At risk: <who could be hurt, and by what | blank>
- Would act on: <the choice I'd reach for, and why | blank>
- Gap that pulls: <the one unknown I want closed | none>
```

A blank in any of the first four slots is a block on a new call and fix before freeze on an
existing one. Route it to swat-call-design when the data holds no person, want or pressure, and
to swat-call-prose when the data has them and the line buries them. Also check these.

1. Person and want sit in the first five words of the hook, and the hook is neither a
   disclaimer nor stacked hedges. On a call with a weapon or a person held, the card names the
   danger. Paperwork stakes on an armed call fail the At risk slot.
2. Restatement. Read card, dispatch, known lines and the first stage prompt in order. Each new
   surface adds a fact or a change (the clock closer, a person moved). A fact restated without a
   change is a finding, and fix before freeze when it sits in the first stage prompt. On typed
   calls the compiler fills the card and the first known line from `opening` (observed
   2026-10-06), so that repeat routes to engineering. Method and an observed case are in
   references/path-and-honesty-checks.md section 1.
3. Exactly one gap remains that a single fact would close. A failing card from a shipped call,
   with its finding row, is in references/review-example.md.

## 4. Pass two, the path and choice read

Gate 5. Read every path the explorer lists through to its ending, whether favorable, mixed,
adverse, partial or failed. Log each one.

```
Path log <call>, situation <n>, seed <s>, pacing <p>
Explorer: <states> states, <k> of <m> endings reached, <d> decision points (<one-option> with one option)
| Path | Choices and bands, in order | Ending id | What the player saw change |
| P1 | assess <title> (favorable) > adapt <title> (adverse) > resolve <title> (favorable) | <id> | <person, evidence, trust, resource> |
```

When no explorer output exists, hand-sketched paths are not a path read. Do the static walk in
references/path-and-honesty-checks.md section 7 (every flag state per stage, every adverse band
taken last, every hidden fact's cheapest reveal) and record "static walk: <states>, dead ends
<n>, cheaper reveals <n>".

For every offered option, write one reason-to-pick line. "A player picks <title> because it
protects <good>, accepting <risk> to <who>." If you cannot write it, line 4 below is true.

Fake-choice checklist, copied word for word from the canonical copy in
../swat-call-design/references/dilemma-patterns.md. If the copies differ, the canonical one
wins and the drift is a consistency finding routed to swat-call-design. Reject a choice when
any line is true.

1. Every option forecasts near-certain success, or all forecasts and costs are nearly identical.
2. Swapping the labels leaves the outcome text still fitting. The options differ only in wording.
3. One option is better on every axis, or one is an obvious trap.
4. The player can't say why they'd pick an option. Blind choices breed regret and frustration.
5. Nothing the player can see changes afterward, in evidence, a relationship, a person's safety, resources or the ending.
6. Waiting or opting out costs nothing. Opting out of the adventure makes a boring story.
7. A later stage forgets the choice.
8. Tone gives away the answer, with one option written warmly and the others as straw men.

Six named tests, cited by name in findings.

- Swap. Exchange two titles. If each outcome text still fits, the options differ only in wording.
- Tone. Read both summaries aloud. A warm, specific option beside a strawman gives the answer.
- Wait. Waiting or talking has an honest price somewhere and is never punished when it preserves life.
- Memory. Where paths rejoin, the later stage names the earlier choice through one concrete detail.
- Roster. At least one option per call is opened, closed or changed by a trait, cert, rating or
  item, and the text says so in-world.
- Odds. Every forecast comes with one sentence on what the adverse case looks like. A flat point
  (two options within 5 points, or every option at 90% or more) is a finding unless the summary
  names where the real risk lives.

The swap and tone tests read wording. The choice table reads the data, and both are required
(references/path-and-honesty-checks.md sections 2 to 8). For every claim in the deliverable's
summary ("every band differs", "no option dominates"), find the row that would falsify it and
record it as checked. Then log dominance (odds, minutes, reveals, adverse result side by side),
options a player can take together in one stage (an ordering finding), mixed bands that only add
minutes (fake-choice 5), taps and chores at the commit beat, and empty band by situation cells
or placeholder strings (each a block). Then find a path where each option's named cost lands. A
cost no path ever charges makes the other option dominant, a block (section 15 of that file).

Cue trace. Every mixed and adverse result traces to a cue the player saw before choosing. An
untraced adverse result is a block on a new call, routed to swat-call-design when no cue exists
and to swat-call-prose when the cue reads as noise.

```
| Choice | Mixed or adverse result, as written | Cue shown before | Field holding the cue | Traced |
| <title> | '<result text>' | '<cue text>' | <field path> | yes | no |
```

## 5. Pass three, the table read

Gate 6. List every speaker. Read each speaker's lines in a row to hear drift, then read the
scene in order at speaking pace. Log every break as a row of speaker, line as written, break and
rule. The per-speaker checks are in references/table-read-protocol.md, in short these.

- Callers speak in fragments and landmarks, say how they know and are sometimes wrong.
- Subjects have one need said plainly, with no monologue and no self-diagnosis.
- Radio gives position, status and need in under ten words.
- Negotiators paraphrase, mirror, label, pause and ask open questions, never promise without
  command, and never relay a third party's unverified allegation to the subject.
- Officers speak with their three voice markers from
  ../swat-officer-stories/references/profile-patterns.md, and stay neutral without them.
- No quips under threat, no humor on a victim, no phonetic spelling, no genre stock lines
  (runner pattern G13 in references/cliche-and-copaganda.md), no melodrama beats (G14), no
  inverted or fronted sentences used to dodge a name opener (G15), and no weapon carried by an
  "it" without its noun in the same string (G16).

Read the ending last and on its own. It names a person's state and one lasting detail. A last
sentence that states a lesson is a sermon.

## 6. Pass four, spoilers and honesty

Gate 7. Put the situations side by side. Every field shown before the check (title, card,
dispatch reason, known and unknown lines, fact label, approaches, the check, precaution,
act-on-report, every preview) reads the same across situations apart from bound names, rooms
and buildings. Diff them as text where you can. Any other difference is a leak and a block.
Then read every band's preview against every situation's result. A preview false in any
situation is a block (references/path-and-honesty-checks.md section 9).

Honesty list. Every result and ending claims only what the step did.

- H1. No arrest, charge, conviction or confession. Implied custody counts as stated custody.
  "Released", "in custody", "booked", "bail", "to the car" and "in the cruiser" are findings
  unless negated, or unless the call shows the step that caused them. Route a call that needs a
  custody ending to the owner. The full word list is in path-and-honesty-checks.md section 10.
- H2. No diagnosis or recovery.
- H3. No returned property.
- H4. No fulfilled promise the team was never able to keep.
- H5. No completed handover, since a request is not a completion.
- H6. No unnamed superior team fixing things off screen.
- H7. The ending's title and summary name what the player did, never a step they skipped.
- H8. A partial ending lists what is still needed in `remainingTasks`, and every still-needed
  line, civilian outcome label and completed objective holds on every path that reaches it.
- H9. Every person in the call has a stated state at the end, and no ending leaves an injured
  person behind while the team hands off.
- H10. Every fixed ending line is true on every path that reaches it, including the clock on
  arrival. No absolute clock time in a call with no fixed start time.
- H11. No result breaks its situation's physical facts (mobility, where an object is, a lock's
  state), on any path. The table is in path-and-honesty-checks.md section 14.

## 7. Pass five, ethics and copaganda

Gate 8. Walk ../swat-call-design/references/ethics-and-authenticity.md rule by rule and
references/cliche-and-copaganda.md pattern by pattern, marking each clear, not applicable or a
finding. A crisis call (a person who may harm themselves) gets the rulebook's full crisis rules.
If the rulebook is missing, say so and use the inline minimum in references/review-rubric.md
section 5, citing "inline <n>". On 2026-10-06 inline <n> and E<n> named the same rule for 1 to 10.

Four checks the proof rounds showed are easy to self-certify, so each needs quoted evidence.

1. Activation. Quote the player-visible lines that meet each E12 call-out condition. A condition
   that lives only in the design sheet does not count.
2. Restraint. Read the debrief and generated lines on the path that waits or talks longest. A
   generated cost charged to the choice that preserved life is an engineering finding.
3. Identity tally before any human routing. When generation can run, draw at least 30 seeds per
   armed, blamed or harmed role and tally against the pool's share with the role-skew snippet in
   references/batch-audit.md section 5. Record the counts in the Ethics line, then send a human
   only the lines and the counts. If you cannot run generation, say so and record why.

4. Fastest force path. In each situation, quote the line showing a life visibly threatened or a
   real impasse, and command's reason, both before the entry option appears. Either missing is a
   block to swat-call-design under E12 and E4.0. Also list who stands where after the call-out,
   and block any death on the card of a crisis call (E4.5).

Details, the positions sweep and observed cases are in path-and-honesty-checks.md sections 12
and 13.

## 8. The batch audit

Gate 9. Required for any framework-level or version-level review. Collection and counters are
in references/batch-audit.md, and the dash, colon, stock phrase and repeat checks are in
../swat-call-prose/references/string-checks.md. Run written-voice's checker on the plain-text
export with the joined allow list that file describes. If written-voice is not installed or
python3 is missing, say so and record the Tells checked line as not run. State the sample size
on every count. Every threshold in that table is a house target, not a research finding. A count over
its target is at least fix before freeze, and section 11 says who may downgrade it.

Fill the batch table in references/batch-audit.md section 9, one row per check with its count,
house target and finding row.

## 9. Reading officer text

When the scope names officer text, read it in context (recruit card, sheet tiers, shift report
entry, debrief callback) and route findings to swat-officer-stories. Run the officer read order,
the four officer-ethics checks and the follow-up checks in references/review-rubric.md section 8,
each as a scored line with a quoted line as evidence. Any "no" blocks approval.

## 10. Engine gates

Gate 10.

1. Run `npm test` for any review, and `npm run verify` before a freeze (on 2026-10-06 it ran
   typecheck, test, `check:art` and build).
2. Record the command, exit code, summary line and every failing test name. Never claim a pass
   without that output in front of you.
3. A failing issued fingerprint test is a block whatever else is true, because issued text changed.
4. If you cannot run the tests, say so and record "not run" with the reason. The verdict cannot
   then be approve.
5. File the standing lint finding once per review until engineering ships the check.
6. Engine dry-run, for every call not yet built. Apply each validateScenario rule to the action
   rows, check person values against the engine's types, score each ending on its fastest and
   slowest path, and name the context prompt each way into a stage shows. Any failed rule is a
   block. The steps are in references/engine-dry-run.md.

```
[note] all typed and hand-authored calls | src/gen/incident/gates/prose-lint.ts | sees no machine check on dashes, colons, stock phrases, cross-framework repeats or hand-authored stories | rule standing lint gap | fix as request 'extend prose-lint with these checks and run it on hand-authored stories' | route engineering
```

## 11. Findings, the notes session and the verdict

Gate 11. Every finding is one row in this shape.

```
[severity] <call, situation, seed> | <field path> | sees '<what the player reads>' | rule <id> | fix as data '<replacement>' | route <skill | engineering | owner>
```

Rule ids are `fake-choice <1-8>`, `test <name>`, `table <claims | dominance | pairs | time-band |
taps | coverage>`, `static walk`, `cold read`, `restatement`, `cue trace`, `cost lands`,
`dry-run <rule>`, `H<1-11>`, `E<n>` or `inline <n>`, `C<n>` or `G<n>` from
references/cliche-and-copaganda.md, `batch <check>`, `budget <surface>`, `officer <check>` and
`gate <test name>`.

- block. Shipping would mislead, harm or break. A fake decision at a stage, an untraced adverse
  result, a leak, a dead end, a missing result cell, a placeholder, a red line, an invented
  outcome, a failing issued fingerprint test.
- fix before freeze. The player would feel it. A blank cold read slot on an existing call, a
  restated fact in the first stage prompt, a mood-label choice, a sermon ending, a repeated
  flavor sentence, a count over a batch threshold, a voice break.
- note. Polish, or a pattern to watch across the next batch.

Self-read limits. A finding that exceeds a numeric threshold in references/batch-audit.md cannot
be downgraded by the author of the strings, whatever the reason given. Only a separate reader
can downgrade it. A self-read also cannot clear the choice pass. Record its block count as
"unverified" and hold the verdict at edit until a second reader or a played build confirms it.

Categories are structure, line, consistency, ethics, engine and owner decision. Structure goes
to swat-call-design, lines to swat-call-prose, officer text to swat-officer-stories, compiler,
gate and schema changes to engineering as a written request, and policy to the owner. Open owner
decisions, to surface and never settle, are listed in references/review-rubric.md. A vague note
("the hook is weak, punch it up") gives nobody anything to act on.

Notes session. Take blockers first, one at a time. The owning skill answers each with a fix as
data or a filed request, and a promise is never an answer. After edits the gates rerun,
you re-read only the passes the fix touched, and each row records its outcome.

Verdict rules.

- approve. Zero block and zero fix before freeze findings remain, and the reader was separate.
- edit. No reject condition holds, and every block and fix before freeze finding has a fix as
  data or a filed request with an owner. A self-read verdict is never better than edit.
- reject. A stage's decision is not real, a red line is crossed, the truth leaks through
  structure, or a blocker has no data fix. It goes back to swat-call-design.

```
Verdict <call or story id> v<N> | <approve | edit | reject> | block <n | unverified, self-read> | fix before freeze <n> | note <n> | ships in <v<N> | next version>
```

Record the verdict in the pull request, as docs/content-pipeline.md asks.

## What enforces this file

Nothing in this file is machine-enforced by this file. The repo gates enforce what their tests
cover, which is length ceilings, the lane word lists, four-word spoilers, distinct decision
paths, two takeable choices per stage, playability and issued fingerprints. The reads, the
audits, the choice table, the routing and the verdict are enforced only by the record below and
by the owner's sign-off. The authoring skills' closing gates are self-checks. This review is the
second reader, and its record is the evidence the reading happened.

## Closing gates and review record

1. Scope and version named, issued text untouched.
2. Separate reader, or a self-read declared with its limits applied.
3. Read surface named, with unseen surfaces listed when the read was exported text.
4. Cold read and restatement check written for every card and briefing.
5. Every path read or statically walked, reason-to-pick lines, checklist, tests and choice
   table done, adverse cues traced, named costs landed, cell coverage checked.
6. Table read done, officers checked against their markers and stock lines.
7. Situations and previews compared side by side, honesty list H1 to H11 checked.
8. Ethics walked with activation and the fastest force path quoted, restraint read and identity
   tallied before routing.
9. Batch audit run with its sample size, or marked not applicable with why.
10. Engine gates run with command and exit code, or recorded as not run, and the engine
    dry-run done for any unbuilt call.
11. Every finding in row shape and routed, one verdict per call.

The record says DRAFT in its first line until every slot is filled. A gate not done says "not
done | <reason>" in its slot and is never deleted.

```
Writing review record (DRAFT until every slot is filled)
- Scope: answered | <calls, types, seeds, pacings>, v<N>, <n> reachable paths
- Reader: answered | separate | self-read declared, <how the cold read was kept cold>, limits applied
- Read surface: answered | story sheet <URLs> and game at 390px | exported text because <why>, unseen <surfaces>
- Cold read: answered | <n> cards, blanks <list | none>, restated facts <n>
- Path and choice read: answered | paths <n> | static walk <states>, dead ends <n>, cheaper reveals <n>
- Choice table: answered | claims <n checked, n falsified>, dominated <n>, takeable pairs <n>, time-only bands <n>, commit taps <max>, cells missing <n>, placeholders <n>, untraced adverse <n>
- Table read: answered | lines voiced <n>, voice breaks <n>, stock lines <n>
- Spoilers and honesty: answered | leaks <n>, previews false in a situation <n>, invented or implied outcomes <n>, endings false on a path <n>, still-needed or objective lines false <n>, physical contradictions <n>
- Ethics: answered | rules triggered <ids | none>, activation <quoted | not shown>, fastest force path <quoted per situation | missing in s<n>>, restraint <clear | n>, tally <role: n seeds, groups over 2x n | not run, reason>, routed to human <n>
- Officer read: answered | phrases repeated <n>, stock lines <n>, swap fails <n>, because fails <n>, ethics checks <4 yes | which no> | not applicable
- Batch audit: answered | sample <n>, repeats <n>, openers over target <n>, collisions <n>, crisis cap <held | broken> | not applicable | <why>
- Engine gates: answered | <command> exit <code>, <summary line> | not run | <reason>
- Engine dry-run: answered | rules failed <n>, invalid values <n>, best ending scores <n%> against worst <n%>, prompts unwritten or shadowed <n> | not applicable, built and loaded by tests
- Tells checked: answered | voice-check ran on exported strings with joined allow list | not run | <reason>
- Findings: <n> block, <n> fix before freeze, <n> note, routed to <skills, engineering, owner>
- Owner decisions surfaced: <list | none>
- Verdicts: approve <n>, edit <n>, reject <n>, recorded at <pull request>
```

The Tells checked line is the one line written-voice contributes under its composition rule.
This review owns the record's shape.

## References

- references/review-rubric.md. Open when you score a call, set a severity or read officer text.
- references/path-and-honesty-checks.md. Open in passes one, two, four and five for the tables.
- references/engine-dry-run.md. Open before the verdict on any call that is not yet built.
- references/table-read-protocol.md. Open when you set up the read or read voices.
- references/batch-audit.md. Open for any framework-level or version-level review.
- references/cliche-and-copaganda.md. Open in pass five and whenever a line feels familiar.
- references/review-example.md. Open before your first review to see every pass on a shipped call.
- references/sources.md. Open when you need the evidence behind a rule.

Sibling files this review reads and never copies. If one is missing, say so in the record and
use the inline minimum. They are ../swat-call-prose/references/string-checks.md and
surface-budgets.md, ../swat-call-design/references/ethics-and-authenticity.md and
dilemma-patterns.md, and ../swat-officer-stories/references/representation-checks.md and
profile-patterns.md.
