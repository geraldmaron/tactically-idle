# Current content prune report

The incident generator now has one current implementation: v13 call trees. Old save/content versions are rejected; no save migration or historical incident regeneration remains. No commits, stashes, resets or checkouts were performed.

## Scope and accounting

Deleted **112 files**, containing **19,504 lines**. Renames and fixture moves are excluded from those deletion totals. Counts use the working-tree snapshot taken before this task, preserving the distinction from pre-existing uncommitted changes. The two historical `.test.ts.txt` capture scripts were outside that snapshot; their counts use the committed source (86 and 23 lines).

The tables below list every deleted file, including deleted test files. Across the snapshotted source/scripts/docs, the comparison removes 23,100 lines and adds 1,258, a net reduction of 21,842 lines. That comparison pairs the eight moves, excludes this report and root configuration changes, and includes the two capture scripts using their committed source counts. Vite additionally gained the test-fixture setup registration. The independently edited architecture files and import-graph are excluded from this accounting.

## Deleted files

| File | Lines |
| --- | ---: |
| `src/content/framework-depth-v12.ts` | 149 |
| `src/content/incident-frameworks-v9.ts` | 195 |
| `src/content/scenario-names.ts` | 211 |
| `src/content/scenario-types-v10.ts` | 43 |
| `src/content/scenario-types-v11.ts` | 34 |
| `src/content/scenario-types-v13.ts` | 9 |
| `src/content/setting-modules-armed.ts` | 202 |
| `src/content/setting-modules.ts` | 136 |
| `src/gen/building/procedural-g1-fingerprints.json` | 110 |
| `src/gen/building/procedural-g1-fingerprints.test.ts` | 19 |
| `src/gen/incident/assistance-v3.ts` | 251 |
| `src/gen/incident/capability-v2.test.ts` | 287 |
| `src/gen/incident/cast-v9.ts` | 78 |
| `src/gen/incident/catalog-v9.test.ts` | 185 |
| `src/gen/incident/characteristics-v9.ts` | 34 |
| `src/gen/incident/choices-v3.ts` | 25 |
| `src/gen/incident/choices-v4.ts` | 53 |
| `src/gen/incident/common-v3.ts` | 56 |
| `src/gen/incident/common-v4.ts` | 167 |
| `src/gen/incident/content-gates.test.ts` | 166 |
| `src/gen/incident/content-playability.test.ts` | 30 |
| `src/gen/incident/decisions-v8/choices-v12.ts` | 324 |
| `src/gen/incident/decisions-v8/commitments.test.ts` | 347 |
| `src/gen/incident/decisions-v8/commitments.ts` | 252 |
| `src/gen/incident/decisions-v8/index.ts` | 23 |
| `src/gen/incident/draw-v12.test.ts` | 52 |
| `src/gen/incident/family-content-v3.test.ts` | 282 |
| `src/gen/incident/family-content-v4.test.ts` | 272 |
| `src/gen/incident/frameworks-v9.ts` | 224 |
| `src/gen/incident/gates/choices.ts` | 45 |
| `src/gen/incident/gates/distinctness.ts` | 113 |
| `src/gen/incident/gates/playability.ts` | 113 |
| `src/gen/incident/high-risk-common-v4.ts` | 113 |
| `src/gen/incident/high-risk-v4.test.ts` | 355 |
| `src/gen/incident/high-risk-v4.ts` | 177 |
| `src/gen/incident/issued-v10-fingerprints.json` | 212 |
| `src/gen/incident/issued-v10.test.ts` | 21 |
| `src/gen/incident/issued-v11-fingerprints.json` | 260 |
| `src/gen/incident/issued-v11.test.ts` | 21 |
| `src/gen/incident/issued-v6-v8-fingerprints.json` | 146 |
| `src/gen/incident/issued-v9-fingerprints.json` | 202 |
| `src/gen/incident/issued-v9.test.ts` | 19 |
| `src/gen/incident/legacy-compat.test.ts` | 23 |
| `src/gen/incident/legacy-stories-v10.test.ts` | 109 |
| `src/gen/incident/physical-access-v4.test.ts` | 111 |
| `src/gen/incident/placement-v10.stats.dev.test.ts` | 42 |
| `src/gen/incident/placement-v10.test.ts` | 177 |
| `src/gen/incident/placement-v10.ts` | 176 |
| `src/gen/incident/plain-language-v3.test.ts` | 105 |
| `src/gen/incident/premises-v4.ts` | 115 |
| `src/gen/incident/protective-v3.ts` | 189 |
| `src/gen/incident/responses-v4.ts` | 34 |
| `src/gen/incident/scenes-v7-journeys.test.ts` | 351 |
| `src/gen/incident/scenes-v7.test.ts` | 41 |
| `src/gen/incident/scenes-v7.ts` | 172 |
| `src/gen/incident/setting-modules-v11.test.ts` | 182 |
| `src/gen/incident/stories-v5/archetypes.ts` | 155 |
| `src/gen/incident/stories-v5/armed.ts` | 181 |
| `src/gen/incident/stories-v5/assistance.ts` | 89 |
| `src/gen/incident/stories-v5/index.ts` | 21 |
| `src/gen/incident/stories-v5/personal-protection.test.ts` | 288 |
| `src/gen/incident/stories-v5/protective.ts` | 130 |
| `src/gen/incident/stories-v5/rescue.ts` | 134 |
| `src/gen/incident/stories-v5/response-story-common.ts` | 60 |
| `src/gen/incident/stories-v5/responses.test.ts` | 298 |
| `src/gen/incident/stories-v5/signature.test.ts` | 448 |
| `src/gen/incident/stories-v5/signature.ts` | 233 |
| `src/gen/incident/stories-v5/story-route-authoring.test.ts` | 76 |
| `src/gen/incident/stories-v5/welfare.ts` | 85 |
| `src/gen/incident/stories-v6/care-privacy-variants.test.ts` | 233 |
| `src/gen/incident/stories-v6/care-privacy-variants.ts` | 289 |
| `src/gen/incident/stories-v6/episode-plan.ts` | 113 |
| `src/gen/incident/stories-v6/high-risk-variants.test.ts` | 316 |
| `src/gen/incident/stories-v6/high-risk-variants.ts` | 272 |
| `src/gen/incident/stories-v6/hosts-v10.ts` | 124 |
| `src/gen/incident/stories-v6/index.ts` | 85 |
| `src/gen/incident/stories-v6/setting-modules-v11.ts` | 100 |
| `src/gen/incident/stories-v6/welfare-variants.ts` | 121 |
| `src/gen/incident/support-v4.ts` | 43 |
| `src/gen/incident/terminal-capability-outcomes.test.ts` | 76 |
| `src/gen/incident/v10-locations.test.ts` | 81 |
| `src/gen/incident/v11-locations.test.ts` | 40 |
| `src/gen/incident/v4-published-fingerprints.json` | 191 |
| `src/gen/incident/v4-story-compatibility.test.ts` | 21 |
| `src/gen/incident/welfare-v3.ts` | 181 |
| `src/sim/compatibility/legacy-choices.ts` | 94 |
| `src/sim/compatibility/legacy-scenarios.ts` | 14 |
| `src/sim/compatibility/retirement.ts` | 62 |
| `src/sim/content-v2-migration.test.ts` | 50 |
| `src/sim/decision-legacy-compatibility.test.ts` | 74 |
| `src/sim/fixtures/capture-legacy-navigation.test.ts.txt` | 23 |
| `src/sim/fixtures/capture-release-fixtures.test.ts.txt` | 86 |
| `src/sim/fixtures/legacy-navigation-runs.json` | 661 |
| `src/sim/fixtures/published-v5-scenario-hashes.json` | 50 |
| `src/sim/fixtures/release-v1-expected-v4.json` | 1,000 |
| `src/sim/fixtures/release-v1-stacks.json` | 436 |
| `src/sim/fixtures/release-v4-active.json` | 1,365 |
| `src/sim/fixtures/release-v4-wallet.json` | 1 |
| `src/sim/fixtures/v6-scene-baseline.json` | 1,154 |
| `src/sim/legacy-choice-navigation.test.ts` | 199 |
| `src/sim/protected-rescue-paths.test.ts` | 60 |
| `src/sim/release-migration.test.ts` | 267 |
| `src/sim/story-movement-v7.test.ts` | 156 |
| `src/sim/story-person-bindings.integration.test.ts` | 92 |
| `src/sim/story-prop-knowledge.ts` | 24 |
| `src/sim/v4-legacy-settlement.test.ts` | 122 |
| `src/sim/v5-rollout.test.ts` | 108 |
| `src/sim/v5-story-journeys.test.ts` | 105 |
| `src/sim/v6-episode-integration.test.ts` | 138 |
| `src/ui/blueprint/environment.tsx` | 122 |
| `src/ui/portraits/procedural.tsx` | 617 |
| `src/ui/storefront/TestStore.tsx` | 100 |

## Renamed or moved modules

| Before | After | Original lines |
| --- | --- | ---: |
| `src/content/locations/maple-street.ts` | `src/sim/fixtures/maple-street.ts` | 220 |
| `src/content/locations/residential-v1.ts` | `src/content/locations/residential.ts` | 224 |
| `src/content/scenarios/ms-occupancy.ts` | `src/sim/fixtures/ms-occupancy.ts` | 483 |
| `src/content/scenarios/ms-urgent.ts` | `src/sim/fixtures/ms-urgent.ts` | 450 |
| `src/gen/building/furnishing-definitions-v7.ts` | `src/gen/building/furnishing-definitions.ts` | 40 |
| `src/gen/building/furnishing-v7.test.ts` | `src/gen/building/furnishing.test.ts` | 113 |
| `src/gen/building/furnishing-v7.ts` | `src/gen/building/furnishing.ts` | 334 |
| `src/sim/story-movement-v7.ts` | `src/sim/story-movement.ts` | 62 |

The v10/v11/v13 scenario-type layers were consolidated into `src/content/scenario-types.ts`. The current situation/pacing catalog remains in `src/content/scenario-recipes.ts`; obsolete framework recipes were removed. `mapScenarioText` was extracted from the deleted episode planner into `src/gen/incident/scenario-text.ts`. The compiler changed only its import of that helper.

## Retained code and reasons

- Maple Street authored scenarios and map remain under `src/sim/fixtures/`. Vitest setup registers them only for isolated engine/UI tests. They have no production dispatch or generation path. The visual QA pages use current buildings.
- `src/gen/building/furnishing-g1.ts`, its catalog and tests remain because current g2 generation imports and uses this furnishing solver. The g1 building generation and fingerprint suite were removed.
- Current authored furnishing and residential modules remain under unversioned names. Existing furniture IDs, family suffixes and hash salts still identify current output; they do not select historical implementations.
- The current g2 and v13 compiled fingerprint files remain unchanged. Both are regression tripwires that can be deliberately recaptured.
- `src/gen/incident/gates/prose-lint.ts` retains only regex definitions used by the string checker through a file path. The gate catalog and engine driver remain in use by current calls and the Scenario Lab.
- Scenario/run version metadata remains where current IDs, save validation or draft fixtures need it. Version-based behavior selection is removed. Save/content stamps remain 9/13.
- Generic authored-scenario engine support remains for draft content, lab utilities and isolated fixtures; it does not regenerate historical issued content.

## Tests deleted versus ported

**43 test files deleted**: all listed in the deletion table. They cover retired content generators, historical fingerprints, g1 buildings, migration fixtures and compatibility navigation. Two additional deleted `.test.ts.txt` files were dormant historical capture scripts.

**78 retained test files updated**, listed below. Some remove legacy-only cases while retaining current assertions; others port fixtures and behavior checks to current calls/maps. The furnishing test rename is listed separately above.

The substantive ports retain checks for current generated geometry and bindings; saving/resuming decisions; cancellation; civilian and officer movement, care and handover; route blocking; resupply history; commerce isolation/atomicity; blueprint routing; personnel identity; current UI decisions and lab replay. Save-rejection tests exercise CampaignSlots and assert that incompatible saves keep their original bytes. A current resupply test exposed a validator bug: revision includes both delivered resupplies and decisions; the validator now uses that actual engine rule.

| Retained test file |
| --- |
| `src/commerce/campaign-commerce.test.ts` |
| `src/commerce/player-packs.test.ts` |
| `src/commerce/review-regressions.test.ts` |
| `src/commerce/tier-wallet-regression.test.ts` |
| `src/dev/lab/model/call.test.ts` |
| `src/dev/lab/model/session.test.ts` |
| `src/gen/building/exact-geometry.test.ts` |
| `src/gen/building/furnishing-g1.test.ts` |
| `src/gen/building/procedural-access.test.ts` |
| `src/gen/building/procedural-american.test.ts` |
| `src/gen/building/procedural-connectivity.test.ts` |
| `src/gen/building/procedural-g2-fingerprints.test.ts` |
| `src/gen/building/procedural-math.test.ts` |
| `src/gen/building/procedural-quality.dev.test.ts` |
| `src/gen/building/procedural-routing.test.ts` |
| `src/gen/incident/generation.test.ts` |
| `src/gen/incident/instance.test.ts` |
| `src/gen/incident/residential.test.ts` |
| `src/gen/incident/trees-v13/call-trees.test.ts` |
| `src/gen/incident/trees-v13/coverage.test.ts` |
| `src/gen/incident/trees-v13/graph.test.ts` |
| `src/gen/incident/trees-v13/path-key.test.ts` |
| `src/sim/action-result.test.ts` |
| `src/sim/authorization.test.ts` |
| `src/sim/band-time.test.ts` |
| `src/sim/campaign-slots.test.ts` |
| `src/sim/casebook.test.ts` |
| `src/sim/catalog-capabilities.test.ts` |
| `src/sim/command-staff.test.ts` |
| `src/sim/commitments.test.ts` |
| `src/sim/consolidation.test.ts` |
| `src/sim/decision-outcomes.test.ts` |
| `src/sim/decision-stress-snapshots.test.ts` |
| `src/sim/department-level.test.ts` |
| `src/sim/development-tiers.test.ts` |
| `src/sim/drawn-distribution.test.ts` |
| `src/sim/drawn-effects.test.ts` |
| `src/sim/equipment-manager.test.ts` |
| `src/sim/equipment-requirements.test.ts` |
| `src/sim/external-support.test.ts` |
| `src/sim/force-risk.test.ts` |
| `src/sim/furniture-path.test.ts` |
| `src/sim/incident-consequences.test.ts` |
| `src/sim/incident-factors.test.ts` |
| `src/sim/incidents.test.ts` |
| `src/sim/location.test.ts` |
| `src/sim/meters.test.ts` |
| `src/sim/operation.test.ts` |
| `src/sim/pending-completion.test.ts` |
| `src/sim/personnel.test.ts` |
| `src/sim/physical-care.test.ts` |
| `src/sim/resolution.test.ts` |
| `src/sim/response-failure.test.ts` |
| `src/sim/save.test.ts` |
| `src/sim/spatial-factors.test.ts` |
| `src/sim/spatial.test.ts` |
| `src/sim/story-bindings.test.ts` |
| `src/sim/story-context.test.ts` |
| `src/sim/story-people.test.ts` |
| `src/sim/story-route-outcomes.test.ts` |
| `src/sim/story-squad-routes.test.ts` |
| `src/sim/support-vehicles.test.ts` |
| `src/sim/tuning.test.ts` |
| `src/ui/blueprint/blueprint.test.ts` |
| `src/ui/components/CampaignOfficerIdentity.test.ts` |
| `src/ui/components/IncidentPeople.test.ts` |
| `src/ui/player-navigation.test.ts` |
| `src/ui/portraits/Portrait.test.ts` |
| `src/ui/screens/OperationFeedback.test.ts` |
| `src/ui/screens/OpsMultiSquad.test.ts` |
| `src/ui/screens/SupportFlow.test.ts` |
| `src/ui/screens/briefing-intel.test.ts` |
| `src/ui/screens/casebook-model.test.ts` |
| `src/ui/screens/live-model.test.ts` |
| `src/ui/screens/preparation-options.test.ts` |
| `src/ui/storefront/TrainingStore.test.ts` |
| `src/ui/storefront/store-query.test.ts` |
| `src/ui/storefront/training-officers.test.ts` |

Legacy-only cases removed from mixed suites include save migration, old campaign adoption, personnel backfill, old portrait identity inference, old content stress snapshots, old story projections/context, old care reconstruction, retired casebook history, and free stage navigation. The legacy development-tier entitlement fallback and its test were also removed; current fixtures now record explicit purchased tiers. Current v13 behavior tests were retained; compiled fingerprints were not recaptured.

## Verification

`npm run verify` exited 1 solely because of the separately owned architecture documentation snapshot. Its typecheck passed, and its full test results were:

```text
  Snapshots  1 failed
 Test Files  1 failed | 189 passed | 4 skipped (194)
      Tests  1 failed | 2434 passed | 4 skipped (2439)
```

The only failure was `src/architecture/architecture.test.ts > architecture > keeps docs/architecture.md rendered from the manifest`. All other tests passed. The four skipped developer sweeps remain opt-in. As requested, the architecture failure was left for its owning session.

The remaining verify stages were run independently because the test failure stops the chained command:

```text
Check:    Current TypeScript
Command:  npm run typecheck
Result:   pass
Observed: tsc -b --noEmit completed without errors.

Check:    Full verification chain
Command:  npm run verify
Result:   fail
Observed: Architecture snapshot only; 189 passed files, 2434 passed tests, 4 skipped tests.

Check:    Latest simulation, UI, lab and commerce behavior
Command:  npm test -- src/sim src/ui src/dev src/commerce
Result:   pass
Observed: Test Files 152 passed (152); Tests 1991 passed (1991).

Check:    Final tuning, development, radio-shortage and resolution edits
Command:  npm test -- src/sim/tuning.test.ts src/sim/tuning-meta.test.ts src/sim/development-tiers.test.ts src/sim/spatial-factors.test.ts src/sim/resolution.test.ts
Result:   pass
Observed: Test Files 5 passed (5); Tests 99 passed (99).

Check:    Required art assets
Command:  npm run check:art
Result:   pass
Observed: 100 portraits ready, 27 gear assets, 6 materials, required brand assets present.

Check:    Production TypeScript and bundling
Command:  npm run build
Result:   pass
Observed: 297 modules transformed; production build completed. Chunk-size warnings remain.

Check:    Production excludes Scenario Lab
Command:  node scripts/check-no-lab.mjs
Result:   pass
Observed: {"filesScanned":196,"labMarker":"absent"}

Check:    Cross-engine current regression fingerprints
Command:  bun scripts/cross-engine-fingerprints.ts
Result:   pass
Observed: 108/108 current buildings and 92/92 compiled calls match; all 200 fingerprints match on Bun 1.3.14.
```

The full-suite test run covered the final behavioral changes. Subsequent tuning-policy wording and whitespace cleanup also passed the focused tests, typecheck and production build. No current fingerprint data was changed.

## Surface verification and remaining limits

The intended visible outcome is that fresh calls use current call trees and incompatible campaigns show a readable rejection. Current generation, replay, saves and campaign-slot rejection are covered through the real engine and public CampaignSlots API. Rendered browser verification is **not proven**: Playwright launch failed in the sandbox and Chrome access to localhost was rejected by browser security policy. No workaround was attempted. The campaign-slot error layout and visual QA pages remain visually uninspected.

Project inspection covered generator dispatch/imports, simulation gates, save/slot loading, current catalogs, building generation, test fixtures, HTML entries, Vite configuration and scripts. Existing registry, validation, engine-driver and furnishing utilities were reused. Deleted modules were searched for importers before removal; the final relative-import audit found no unresolved source imports outside literal import-parser test samples.

The strongest failure mode was removing a helper still needed by v13 or current save validation. The alternative was retaining the old dependency graph. The prune was accepted with controls: extract the shared text traversal, retain current validators and furnishing, run current fingerprints and engine tests.

Architecture exception: another session owns `src/architecture/**` and `src/dev/import-graph.ts`. No further edits were made there after the user clarified ownership. Before that clarification, one unused `System` type import was removed from `src/architecture/render.ts` and disclosed. Architecture failures are reported without repairs.

## Verification record

- Project inspected: answered above, "generator dispatch/imports, simulation gates, save/slot loading". The blast radius includes generated IDs, saves, campaign slots, lab replay and current building maps.
- Reuse checked: answered above, "Existing registry, validation, engine-driver and furnishing utilities were reused". Shared v13 text traversal was extracted rather than retaining the old story planner.
- Validation path run: answered under Verification, "Architecture snapshot only"; independent art, build, no-lab and cross-engine checks passed.
- Outcome observed: not proven on the rendered UI. Current engine generation and public CampaignSlots save rejection passed automated checks.
- Surface inspected: not done because browser security policy blocked localhost access. The error-state layout and QA map pages remain uninspected.
- Diff reviewed: compiler import-only change and unchanged authored call content/current fingerprints were checked against the starting snapshot. Source imports were audited; task-path `git diff --check` passed.
- Residual risk: architecture snapshot still needs its owner's update; rendered UI checks still need an approved browser session. No non-architecture automated failures remain.

## Markdown cleanup follow-up

The initial `npx vitest run src/architecture/references.test.ts` run failed with 76 broken references. Targeted searches of headings, contracts and rule language preceded removal of these retired documents.

- Deleted `accountable-response-v4.md`; retained its applicable rule in `docs/operation-model.md`.
- Deleted `decision-commitments-v8.md`; retained its applicable rule in `docs/operation-model.md`.
- Deleted `equipment-harm-v7.md`; retained its applicable rule in `docs/operation-model.md`.
- Deleted `furnished-rooms-v7.md`; retained its applicable rule in `docs/procedural-locations.md`.
- Deleted `incident-content-v4.md`; retained its applicable rule in `docs/operation-model.md`.
- Deleted `scenario-generation-v9.md`; retained its applicable rule in `docs/content-pipeline.md`.
- Deleted `scene-coherence-v7.md`; retained its applicable rule in `docs/operation-model.md`.
- Deleted `story-archetypes.md`; retained its applicable rule in `docs/operation-model.md`.
- Deleted `setting-modules.md`; retained its applicable rule in `docs/content-pipeline.md`.
- Deleted `phase2-simulation.md`; retained its applicable rule in `docs/operation-model.md`.
- Deleted `phase3-generation.md`; retained its applicable rule in `docs/procedural-locations.md`.

The current content pipeline documents v13 call trees, templates, instance generation, compilation, string checks and deliberate recapture of current fingerprints. The architecture convention was added to AGENTS.md. Skill edits are blocked: filesystem writes under `.agents/skills/` are denied, and the patch tool also rejects that directory under this session’s approval settings. No source file or generated architecture document was edited.

### Retained rule locations

- `docs/operation-model.md`: responsibility through accepted care, pending completion while care remains, explicit eligible force, separate harm and success, first aid versus professional transfer, casualty evidence, injury-aware dialogue, public-position targeting, explicit routes and one source of truth with named contributors.
- `docs/procedural-locations.md`: seeded furniture clearance and route preservation, validation before rendering, bounded retries and a valid fallback.
- `docs/content-pipeline.md`: decision variety beyond names and settings, explicit purposes for added people, and building claims true on every accepted layout.

### Reference test status

Command: `npx vitest run src/architecture/references.test.ts`.

After the writable documentation cleanup, 50 broken references remain, all under the read-only `.agents/skills/` directory. Final result: `Tests  1 failed (1)`. The four skills' frozen-version instructions and their links to retired docs remain unmodified because both filesystem and patch writes were denied. This cleanup is partial; the references goal has not passed.
