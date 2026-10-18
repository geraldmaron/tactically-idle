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
5. Is it non-graphic, and does it keep allegations apart from facts?

Record **approve**, **edit** (as a data change to the package, then rerun the gates) or **reject** as the drawer's call verdict and in the pull request. Edits go back as data, never as compiler special cases.

## Current fingerprint policy

The compiled fingerprints in `src/gen/incident/trees-v13/compiled-fingerprints.json` are regression tripwires. Investigate a changed fingerprint, then deliberately recapture it when the intended content changes. Do not add frozen content layers or preserve old generator implementations.

Names, settings and seeds do not prove distinct decisions; each additional person needs an explicit purpose, knowledge, location and effect on completion.

A setting change must keep every building claim true for all accepted layouts, and a changed decision requires an authored branch rather than a prose substitution.
