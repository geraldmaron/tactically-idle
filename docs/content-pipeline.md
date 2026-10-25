# Content pipeline: current call trees

Content has one current version, v13. Old saves are rejected, and fixes edit current data directly.

## How a package becomes a call

An author prepares a design sheet, writes typed call data, runs automated gates and submits it for Scenario Lab review. Approved changes deliberately recapture the current compiled fingerprints.

Agents write data. A new decision shape unsupported by the current types needs engineering before prose is drafted.

| Part | Owner |
| --- | --- |
| Call graph, roles, facts, situations, choices and endings | `src/content/call-trees/` |
| Incident templates and drawn person attributes | `src/content/incidents/` |
| Instance generation, cast and placement | `src/gen/incident/instance.ts` |
| Compiler and role binding | `src/gen/incident/trees-v13/compile.ts` |
| Catalog | `src/content/scenario-types.ts` |

## Agent brief template

Before drafting, read the matching writing skills in `.agents/skills/` in the order described by `.agents/skills/README.md`: design for structure, prose for call strings, officer stories for personnel text and writing review for the separate reader.

The brief names the call's purpose, decision verbs, disputed facts, supported buildings, people, three situations and consequential choices. Use a current call tree as the structural exemplar.

Prose requirements remain:

- American English and curly apostrophes.
- Stay in the world and say what happened and what remains to do.
- No spoilers before a check; keep public strings equivalent across hidden situations.
- Honest outcomes, with no invented arrest, recovery, diagnosis, eviction or completed handover.
- Source allegations until checked; keep injury detail and real medical, tactical and legal procedure out.
- Titles under 34 characters, action titles under 60, briefing lines under 260 and sentences under 34 words; apply the writing skills' stricter surface budgets where required.
- Name the person in the opening and check, and keep pronouns consistent.
- Every stage has at least two takeable, meaningful choices, each with a distinct visible cost and consequence.

## Automated gates

Run from the repository root:

```sh
npm run check:strings
npx vitest run src/gen/incident/trees-v13 src/gen/incident/instance.test.ts src/gen/incident/generation.test.ts
npm run verify
```

`npm run check:strings` uses `scripts/check-strings.ts`. The tree tests cover current compilation, coverage, dependencies, graph shape and compiled regression fingerprints. A green gate never substitutes for the human read.

Read every reachable band and situation, test binding and route reachability, and verify real-engine journeys with save and reload. Names or setting changes alone do not make decisions distinct. Preview text must hold for its worst reachable result.

## Editorial pass (control E1)

Every new or newly generated call gets the line edit a published piece gets, by a cheaper model, before the
separate writing review and the owner's read. The design below is v1, written after a Codex (sol) attack on
the first draft (2026-10-24: "needs validation", because mechanical acceptance cannot show that a cleaner
sentence is still true). It is a pilot until the blind comparison under "Proving it" has been run on Going Live.

**What it is.** A reviewer model proposes patches to presentation text. It never applies them. The owning lane
applies the approved patches, the gates run, and a second reader checks every changed passage before write-back.

**Unit of editing.** A scene or a shared beat, not a string. A repeated discovery across exits that cannot both
happen is one beat with exit-specific clauses and is edited as one. A choice edit carries its whole menu; a
preview edit carries every reachable matching result and generated consequence. The string is the patch address.

**Representation.** The editable source is the tokenized text in `src/content/call-trees/*.ts`. The reviewer reads a
bound render beside the tokenized original and proposes patches against the tokenized literal: file, the
expected old text, the new text, the control it serves. Names are never reverse-bound into tokens. A patch whose
old text no longer matches, or whose expansion changes another field, is rejected. (The strings file the checker
builds is lossy: it drops the speaker, most branch conditions and the source property, so it is for reading, not
for write-back. A source map is engineering work, backlog `editorial-source-map`.)

**Cold read first.** Reviewer one sees only what the player knows, in path order. A separate continuity reviewer
gets the hidden situations, the engine contracts (marks, promises, `foundOut`, `clerkToo`, facts) and the
previews, and checks that no change moves a fact or a promise. "Do not reveal" in a prompt is an instruction,
not protection against hindsight, so the first reviewer never holds the answers.

**What the reviewer may touch.** An evidenced defect in an existing passage: speech that is written not spoken
(Q6), a reference no earlier surface set up (Q5), idiom and possessives (Q7), a flat threat or heavy moment (Q4),
a narrator tell, a voice break. **What it may not touch:** speakers, role ownership, tokens, chronology, object
properties, threat severity, discoveries, promises, relationships, future facts, or the availability and cost of
a choice. Those findings are routed to the author. It may return no findings, and must say why for each change.

**Voice and restraint.** Per-person speech signatures approved by the owner, a locked set of exemplar lines and a
keep list of passages that work. A trial cap of ten edited fields per round, one beat per patch. Exceeding it goes
to the author, not to more automatic rewriting. No speech-count or cadence quota is a reason to rewrite a line that
works.

**Deterministic checks (author lane, after the patch).** Only approved presentation literals changed; every engine
field and id identical; tokens valid and owning the right person; the candidate compiles and re-exports from a
scratch copy; `npm run check:strings -- <call>` exits 0, **and** no new `stock`, `feeling`, `policy-voice`,
`tense-mix`, `opener-share` or `cadence-flat` finding (the checker reports these and does not fail on them, so
the pass adds its own acceptance rule); `npm run policy:brief` controls hold; public text stays equal across
hidden situations at equal public states; the approved source diff matches the compiled text diff.

**Independent review before write-back.** A second model, not the first model's rationale, reads every changed
passage in its paths. The owner then reads the affected scenes in the Lab at 390 px and approves the concrete diff.
The fingerprint file belongs to the lead: settle one approved diff, inspect the compiled differences, recapture
once. Never recapture after each pass.

**Repeatable.** Pin model, prompt, rules, source hashes and export order; store accepted and rejected findings
with reasons in `docs/calls/notes/<call>-editorial.md`; re-running on the reviewed artifact returns no changes;
replaying the approved patch twice is a no-op. Stop after two rounds. Unresolved disagreements stay findings.

**Never automated:** developmental restructuring, new facts, ethics, who owns the final voice, fingerprint approval.

**Cost, for choosing a model.** One round on a call of about 11,000 words is an estimated 25,000 to 35,000 input
tokens and 3,000 to 8,000 output tokens. Public API prices read from the vendors' pages on 2026-10-24 (per million
input and output tokens): Claude Haiku 5.5 $0.10 and $0.50, Claude Sonnet 5.5 $2 and $10, GPT-6 Luna $0.10 and
$0.50, which is an estimated $0.004 to $0.0075 per round on Haiku or Luna and $0.08 to $0.15 on Sonnet. Estimates
only; excludes retries, reasoning tokens and the second reader, and is not a quote for a Codex sub-session.
Reviewer cost is small next to the owner's reading time, which is what the checks above protect.

**Proving it.** Freeze the baseline (source, rules, fingerprints, draws). Produce one candidate per reviewer from the
same source, never one reviewer polishing another's. Run blind A/B reads on identical casts and paths with fresh
readers per path, score voice distinction, emotional effect, rhythm and unnecessary explanation, and test
comprehension (who wants what, what is known, what a choice risks, what happened). Audit each changed preview,
discovery and ending across every reachable situation, and read long passages under she/she and they/they draws.
Acceptance needs an independently observed improvement, no semantic regression and an owner-approved diff, then
the accepted workflow re-run unchanged shows zero new changes and no fingerprint churn.

The brief the reviewer reads is generated from the controls: `npm run policy:brief -- <surface>`.

## Human review: the Scenario Lab

The human read happens in the Scenario Lab, a dev-only page on the real game and engine. The full guide is [scenario-lab.md](scenario-lab.md).

```bash
npm run lab    # opens http://localhost:5173/lab
```

```
/lab?type=<type>                       the call's default draw, on Play
/lab?type=<type>&variant=2             situation 3 of 3 (variant counts from 0)
/lab?type=<type>&tab=script            every line in player order, every variant
/lab?type=<type>&tab=script&notes=1    the same, with the review drawer open
```

The lab covers the current v13 call trees. See [call-trees-v13.md](call-trees-v13.md) for the data contract.

Read in this order:

1. **Play.** The game's own card, briefing, live screen and debrief at 390 px, stepped with your own picks on the engine. Set building, situation, turn, group size and pacing in the Director. The X-ray rail beside the frame shows the hidden truth, each choice's odds and where each result goes, and "Player reads after" for every band. Play each situation to at least one ending; force a result with `W`, `C` or `B` to read it without replaying.
2. **Script.** Every player-visible line in player order. Step the variant bar (12 casts plus the longest names, pronouns, group size, situation, turn) and use "Changed in this variant" to read only what moved. **Run checks** sends the lines to the swat-call-prose checker (needs python3), and the matcher audit should read "0 missed · 0 false matches".
3. **Dependencies and Outcomes.** The wiring check should show no errors or warnings that aren't muted with a reason. Outcomes lists every ending with its share, shortest path and the CI gate for the call.

Notes go in the **review drawer** (`\`, or `N` on a selected choice, band, line or ending):

- Each note carries a severity (block, fix before release, note), who owns the fix (prose, design, officers, engineering, owner), an optional rule id, what the player reads, and the fix as data.
- Notes and the call verdict save to `docs/calls/notes/<type>.json`, next to the call review docs, where the next reader and the review skills can read them.
- **Export findings** gives the verdict line and one row per note in the swat-writing-review shape, ready for the pull request.

Reviewer checklist:
1. Read situation 1 as a player on Play. Is each decision real, and is every choice a reasonable move? "This moment" flags beaten and flat choices.
2. Compare situations (the Director's situation cards, or Compare situations on the path rail): does anything before the truth comes out give it away?
3. Are the people, rooms and building plausible together? Step Script's cast carousel and read at least two building families.
4. Are the endings honest about what the team did, and silent about what it didn't?
5. Does it keep wound anatomy and method off the card (E16), and allegations apart from facts?
6. Does it pass the depth gates D1 to D9 (`docs/scenario-depth.md`)?

Record **approve**, **edit** (as a data change to the package, then rerun the gates) or **reject** as the drawer's call verdict and in the pull request. Edits go back as data, never as compiler special cases.

## Current fingerprint policy

The compiled fingerprints in `src/gen/incident/trees-v13/compiled-fingerprints.json` are regression tripwires. Investigate a changed fingerprint, then deliberately recapture it when the intended content changes. Do not add frozen content layers or preserve old generator implementations.

Names, settings and seeds do not prove distinct decisions; each additional person needs an explicit purpose, knowledge, location and effect on completion.

A setting change must keep every building claim true for all accepted layouts, and a changed decision requires an authored branch rather than a prose substitution.
