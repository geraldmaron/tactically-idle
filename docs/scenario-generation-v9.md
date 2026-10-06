# Scenario generation v9: implementation and review

## Optimized brief

Deliver 100 distinct, playable scenario recipes using the existing incident engine. Broaden the story framework set, bind people and scene details coherently to seeded layouts, and make future content additions straightforward. Preserve issued scenarios and saved decisions. Give players a readable library and an explicit fresh-variation control. Use American English in new scenario prose and current interface copy, preserving proper names. Prove the result through geometry validation, real dispatch/save journeys, and the rendered interface.

A recipe is a reviewed combination of framework, situation variant, compatible building family, and supported conversation constraint. A different name alone is not another recipe. Additional scenarios belong in a later version, as requested.

## Baseline and scope

Reviewed [PR #27](https://github.com/geraldmaron/tactically-idle/pull/27) at `f1d2740`, on `improve/concrete-scene-commitments`. The untouched PR passed `npm run verify` with 1,865 tests. Its description's older failure report did not match that checkout. Work is isolated from the original checkout's preexisting staged changes; the implementation is committed locally on a dedicated branch; nothing has been pushed or merged.

The PR already has substantial geometry, furnishings, scene commitments, decision history, care obligations, and compatibility handling. It had six current story frameworks and a small set of fixed cast alternatives. Search covered this repository, sibling project sources, the persona catalog, episode binding, the geometry registry, and installed browser tooling. The existing persona vocabulary, building generator, story routes, dispatcher, and Playwright scripts were reused. There is no second simulation engine or new persistence format.

Blast radius: incident parsing and drawing, v9 content compilation, optional story metadata, practice discovery, display binding, preparation-to-debrief navigation, and browser validation. Existing engine requirements, outcome resolution, inventory, rewards, save serialization, and geometric validators remain authoritative. The new optional fields are `story.recipeId`, `story.characteristics`, and `story.cast`.

## Delivered catalog

| Framework | Recipes |
| --- | ---: |
| Conflicting reports | 10 |
| Protective response | 10 |
| Medical assistance | 6 |
| Active armed incident | 6 |
| Hostage crisis | 6 |
| Protected rescue | 10 |
| Missing-person search | 7 |
| Voluntary crisis support | 7 |
| Household separation | 7 |
| Neighbor mediation | 7 |
| Alarm and keyholder response | 6 |
| Mistaken-intruder report | 6 |
| Occupancy dispute | 6 |
| Robbery witness reconciliation | 6 |
| **Total** | **100** |

The eight additions cover ordinary uncertainty, consent, competing accounts, evidence preservation, and practical agreements. Their prose distinguishes allegations from observations and does not invent medical recovery, arrests, authority to evict, or completed handovers. Every ending requires the recorded work supporting it. These eight frameworks share a shorter evidence-and-agreement structure; they do not yet have the branching depth of the existing armed, hostage, and rescue stories.

Board generation weights ordinary calls more heavily than armed incidents, hostage crises, and protected rescues. This is a gameplay distribution, not a claim about real dispatch frequencies.

## Generation and templating

1. Select a v9 recipe from the frozen catalog. Each framework declares compatible location families; invalid type/family combinations are rejected.
2. Build the existing seeded geometry and furnished scene. Rooms, entrances, routes, physical placement, and props use the existing family and story-binding contracts.
3. Select one of three coherent situation variants. New frameworks declare their disputed claim, evidence, two investigative approaches, competing resolutions, and explicit movement permission. Variant three requires independent source corroboration, with a follow-up action when the player starts elsewhere.
4. Apply a supported public characteristic. `deliberate_answers` adds two operation minutes to the selected participant's supported contact actions; the briefing explains it. It never derives danger or cooperation from identity. `ordinary` retains the baseline.
5. Draw a cast from frozen first-name and surname pools using a separate cosmetic hash stream. Pronouns match authored prose, first names are distinct within a scene, and explicit family relationships can share a surname.
6. Bind display fields explicitly. IDs, flags, truth values, requirements, routes, and selectors are excluded. American spelling is applied before names. Cast labels agree in the briefing, choices, map facts, person inspector, and endings.
7. Run the ordinary dispatcher and save logic. Failed checks cannot claim completed movement or agreement; exhausted responses can close honestly as unfinished.

The typed `IncidentFramework` data and `ScenarioRecipe` registry are the authoring interface. The display binder supports reviewed replacement maps, not an unrestricted text-template language. Cast slot IDs and story bindings are the integration points for a future template editor. Arbitrary runtime prose generation is unnecessary for this release.

Strongest failure mode: independently shuffling people, motives, objects, and outcomes can produce contradictory or physically impossible scenes. The alternative is a wholly bespoke scenario for every entry, which is safer to author but harder to extend. Decision: **accepted with controls**. Use coherent narrative modules, compatible family lists, explicit movement routes, version isolation, binding validation, and real journeys.

## How many combinations are real?

| Layer | Verified count or limit |
| --- | --- |
| Playable catalog | 100 distinct selected recipes |
| Story breadth | 14 frameworks × 3 authored situation slots = 42 variants |
| Compatible recipe candidates | 48 framework/family pairings × 3 variants × 2 characteristics = 288; only 100 are in v9 |
| Location families | Six base families, with existing seeded layout/furnishing behavior |
| Name vocabulary | 98 first names and 100 surnames; 9,800 possible name pairs across the vocabulary |
| A single neutral-pronoun cast slot | 13 first names × 100 surnames = 1,300 vocabulary pairs |
| Seeds and layouts | Many additional instances; exact unique reachable gameplay states have not been enumerated |
| Variable suspect or cast counts | Not implemented; each framework has fixed role slots |

These counts must not be multiplied indiscriminately. The 100 recipes already include family, variant, and characteristic selection. Names change presentation; multiple seeds can produce equivalent physical or mechanical states. The same hash inputs couple some outputs, so even a theoretical cast-product total would not prove every combination is reachable.

The library's **New variation** changes the building seed and finds a seed for the same recipe, producing fresh cast and scene details. It does not guarantee every furnishing or room changes on every click. Replaying an issued scenario keeps its original identity and seed. It does not secretly add suspects or reroll a saved operation.

## UI findings and changes

- Added a framework selector and one selected recipe card instead of rendering 100 large cards.
- Added previous/next navigation, a live count, and a fresh-variation control. Compact spacing and an explicit navigation grid prevent cramped controls at phone widths.
- Kept guided decision exercises and historical practice available through the existing registry.
- Fixed closing a debrief returning to stale preparation; it now returns to the board/library.
- Removed an obsolete swallowed-error fallback and arbitrary three-batch cap around marking calls seen.
- Current labels describe an alarm response without prematurely asserting a burglary. Current interface spelling includes practice, canceled, labeled, license, and story.
- Historical versioned scenario definitions and recorded decision text retain their original wording for replay integrity. Proper names remain unchanged.

Rendered inspection covered the populated library, native framework selector, disabled previous control, keyboard focus on next, live blueprint, long action titles, confirmation sheet, and debrief at 320×568 and 390×844. No horizontal overflow was observed. The confirmation sheet deliberately remains a nonmodal region so the map can remain interactive; its footer stays accessible while its body scrolls. At 320px the map and choices require vertical scrolling. Only the existing dark theme is available. The guarded missing-scenario branch was inspected in source but was not forced in the browser; all catalog entries generated successfully.

## Extension plan

Completed now: v9 registry, 100 recipes, eight additional frameworks, cast pools, display-only binding, meaningful conversation pacing, library variations, version protection, and browser journeys.

Next: deepen branching within the eight short frameworks before treating recipe count as a proxy for gameplay depth. Add reviewed per-role constraints and alternate evidence chains. Playtest clarity, challenge, and call distribution.

Later: variable cast and suspect counts. First define each additional person's purpose, knowledge, location, obligations, relationship constraints, and effect on completion. Model corroborating witnesses separately from suspects; adding a body to the map is not a complete scenario variable. Validate placement and access for every count, then test success, failure, and save/reload paths. Broader location families and richer object interactions can follow the same binding contract.

For future additions, create a new content version rather than editing frozen v9 catalog ordering or name pools. Register compatible recipes, cast slots, verified claims, outcomes, and routes. Expand catalog coverage and browser representatives. Preserve older ID lookup and fingerprint coverage. Do not count cosmetic differences as new authored scenarios.

## Validation design and dependency

The catalog suite checks all 100 recipes on two building seeds, deterministic generation, geometric and story binding validity, cast relationships, American spelling, fresh variations, and 3,000 board draws. One hundred dispatcher journeys serialize and restore after every decision, reach a bounded ending or honest exhausted response, close exactly once, and preserve practice inventory/rewards. This is not an exhaustive winning-path search.

The browser driver uses real UI interactions and isolated contexts, without injected state or mocked fetches. It covers all 14 frameworks at both phone widths, one/two squads, fresh variation, action confirmation, continuation, debrief, and return to the library. Wall time is fixed during each journey to exclude unrelated idle equipment aging; operation decision time still advances. The representative active-armed journeys ended as honest unfinished responses; the other representatives completed.

`playwright-core` was already imported by both browser scripts but was undeclared. It is now a development dependency and both entry points share the existing driver. Package metadata identifies Microsoft, Apache-2.0 licensing, and Node >=20; installation reported zero vulnerabilities. No new browser framework or production dependency was introduced. The alternative, an undocumented external installation, was the reproducibility defect being removed.

Compatibility fingerprints cover 144 issued v6–v8 definitions. A diagnostic mismatch came from different property insertion order in the test input before JSON hashing; comparison with the untouched PR confirmed identical content. The test now reconstructs the original input order. No compatibility workaround was added to production generation.

## Verification results

Results below are completed local checks; browser inspection supplements, rather than replaces, the project checks. CI uses Node 24; these local commands use Node 22.

```text
Check:    Full project verification
Command:  PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run verify
Result:   pass
Observed: 2,072 tests in 121 files; type checking, artwork validation, and production build completed.
```

```text
Check:    GitHub Pages deployment-base build
Command:  PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run build -- --base=/tactically-idle/
Result:   pass
Observed: Production output built for the repository subpath; existing large-chunk warning remains.
```

```text
Check:    Real browser journeys
Command:  TI_CAPTURE_DIR=/tmp/ti-v9-captures TI_E2E_REPORT=/tmp/ti-e2e.json PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run test:e2e
Result:   pass
Observed: 28 journeys across 14 frameworks, two phone widths, and one/two squads; no uncaught page errors or horizontal overflow.
```

```text
Check:    Diff whitespace and accidental patch damage
Command:  git diff --check
Result:   pass
Observed: No findings.
```

```text
Outcome:  A player can select a scenario from a 100-recipe library, generate another variation, practice it through a real ending, and return to the board without inventory or reward changes.
Surface:  Local development app in Google Chrome, Ops library, preparation, live map, confirmation sheet, and debrief.
Data:     Real generated v9 content and normal starting campaigns, with every framework represented at 320×568 and 390×844.
Observed: All 28 browser journeys reached debrief and returned to the library; fresh variation, virtual equipment, and zero practice rewards were checked. Library navigation remained readable after spacing corrections.
Verdict:  proven for the exercised representatives; all 100 recipes additionally have dispatcher/save journey coverage.
```

Manual surface record: library selector and navigation inspected at both sizes; disabled previous button skipped in keyboard order and next button showed visible focus; live map showed rooms, furnishings, and a reported person; long confirmation titles wrapped with a reachable pinned confirmation button; missing-person debrief showed the same full name and an agreed reunion. The screenshots and browser JSON report are temporary local evidence under `/tmp/ti-v9-captures` and `/tmp/ti-e2e.json`; the documented command recreates them. The small-screen UI scrolls vertically by design. No light theme or native touch-device check was attempted.

Full tracked diff and new source files were reviewed against the brief, including frozen ID compatibility, display-only replacement, movement/completion guards, catalog coverage, UI transitions, and dependency lockfile. Temporary diagnostic tests and the screenshot accidentally written into the original checkout were removed. The original checkout's preexisting staged changes were preserved.

Residual risks: exact unique seed-space coverage is unmeasured; cast sizes remain fixed; eight new frameworks share a shorter mechanical structure; a civilian identity can coincide with a department roster identity; challenge and realism need human playtesting; no native phone hardware was tested. Broader variant-path browser coverage, per-person cast obligations, role-disambiguation playtests, and physical-device sessions would settle those gaps. The existing roughly 1.22 MB blueprint/content chunk warning remains and calls for separate bundle work. No security or accessibility specialist review was performed.

Verification record
- Project inspected: answered: see “Baseline and scope” ("The PR already has substantial geometry, furnishings, scene commitments").
- Reuse checked: answered: see “Baseline and scope” ("The existing persona vocabulary, building generator, story routes, dispatcher, and Playwright scripts were reused").
- Validation path run: answered: see “Verification results” ("2,072 tests in 121 files").
- Outcome observed: answered: see the outcome block ("All 28 browser journeys reached debrief and returned to the library").
- Surface inspected: answered: see the manual surface record ("library selector and navigation inspected at both sizes").
- Diff reviewed: answered: see the diff review paragraph ("Full tracked diff and new source files were reviewed against the brief").
- Residual risk: listed in the residual-risk paragraph, with the checks or work that would resolve each gap.
- Commit-and-PR: full staged diff reviewed as one scenario-library release; no credentials or real user data found; dedicated branch `codex/scenario-templates-v9`; imperative subject and rationale body; local commit explicitly requested by the user; no push or new pull request requested.
