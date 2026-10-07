# Scenario scale plan: hundreds of operations, and how players meet them

**Status:** Approved 2026-10-06 with the owner decisions below. Phases A–C and the first content drop shipped in content v11 (see "Delivered"). Builds on [procedural-locations.md](procedural-locations.md) (content v10) and [scenario-generation-v9.md](scenario-generation-v9.md).

## Brief

Grow from about 100 playable recipes to several hundred, and later thousands, without losing what makes a call worth playing: a coherent situation, a real decision and an honest ending. Buildings, placement and cast are already generated. The bottleneck is authored meaning: frameworks, situations and setting-specific prose. That is the part agents can draft at scale, behind gates strong enough that volume can't buy incoherence.

The plan also settles how operations reach the player over time: what arrives on the board, what unlocks, how players find, track and replay what they've seen, and how it fits a 320 px idle game. It closes the four gaps left by v10.

**Constraints:**
- Issued content is immutable. IDs regenerate their content, so changes ship as new versions.
- Prose is authored offline and frozen. The game never calls a model at runtime.
- Calls must be honest, non-graphic and free of fake procedure.
- Small screens, an idle cadence, and nothing lost when a call is ignored.

## 1. What counts as a scenario

A **scenario recipe** is the authored unit we count. It's a framework × situation × setting module, and it's only counted when it changes a decision or an ending. Everything else is a variation and is never counted as a new scenario.

| Layer | Example | Authored or generated | Counts as new? |
| --- | --- | --- | --- |
| Framework | Missing-person search, Armed incident | Authored (data plus compiler) | Yes |
| Situation | "Old sighting mistaken for current location" | Authored; fixes the truth | Yes |
| Setting module | Retail till-count, office late worker, motel night clerk | Authored per building class | Yes, if it changes a decision |
| Building | `two_storey_house_g1`, seed 4817 | Generated | No |
| Placement and reports | Upstairs bedroom, reported as kitchen | Generated from affinities | No |
| Cast | Names, pronouns, relationships | Generated from pools | No |
| Conditions | Night, power out, deliberate pacing | Drawn, from a supported list | Only if it changes a decision |

**Scale arithmetic:**
- Today there are 14 frameworks, about 3 situations each and 1 setting module, which gives the 100 recipes.
- The target is 40–60 frameworks × 3–5 situations × 1–4 setting modules, which gives roughly 300–900 recipes.
- Each recipe then varies without limit through buildings, placement, cast and conditions.
- "Thousands" is reachable, but we only claim recipes that pass the distinctness gate in §4.

## 2. Closing the v10 gaps

### 2.1 Armed incident on offices, warehouses and motels: setting modules

The armed-incident story is written around one setting: a worker counting tills. Rather than fork the story, add **setting modules** as a framework-level concept:

```
SettingModule {
  id, framework, settings: ['office' | 'warehouse' | 'motel' | 'retail' | 'home' ...],
  requires: { roomUses?, objects?, tags?, floors?, access? },   // selectors on the built location
  roles: { [roleId]: { label, roomAffinity } },                 // who is there and where they'd be
  prose: { opening, briefing[], stagePrompts{}, actionText{}, endings{} } // bound by role and room labels
}
```

- **Armed incident:**
  - Office: a late worker locks themselves in a meeting room.
  - Warehouse: a night-shift picker sheltering among the racking, which provides cover and blocks sightlines.
  - Motel: a night clerk in the back office, with guests in units.
- **Mechanics:** each module reuses the framework's decision structure and declares only what it needs.
- **Unblocks:** armed incidents on 3 more building types, and gives every business framework the same pattern.
- **Ships as:** content v11. v10 keeps its current list.

### 2.2 Wheelchair rescue in generated apartments: access metadata

The rescue story needs a step-free route from the person to the pickup. Generated apartments don't say which floor the unit is on or whether there's a lift.

- **Generator:**
  - Add `access` metadata in a `_g2` generation: the unit's level (ground or upper), lift present, and step-free common route.
  - Draw it from the seed and draw it visibly: a lift symbol in the stairwell zone, and "3rd-floor unit" in the location note.
- **Rule:** the rescue story requires `access.stepFree`. When there's a lift, the route uses it, with a time cost and a failure state if the power is off.
- **Bonus:** "lift out of service" becomes a real condition other stories can use.
- **Ships as:** `_g2` building types. `_g1` stays frozen.

### 2.3 Engine-approximated distance math: versioned exact geometry

Measured on V8: `Math.hypot` differs from the correctly rounded `Math.sqrt(x*x + y*y)` by one unit in the last place in 36% of quarter-foot grid pairs. Other engines may round differently. It only matters when a comparison lands exactly on a threshold, but it touches every location.

- **Fix:**
  - Add a geometry math version to locations.
  - New location versions (`_g2` generated types and any new authored family version) use the exact `dist` in `location.ts`, `furniture-path.ts`, `location-validate.ts` and the furnishing solvers.
  - Existing versions keep `hypot`, so issued v1–v10 stay byte-identical.
- **Cross-engine CI:** a job that recomputes the fingerprint suites under JavaScriptCore (Bun) and in a headless WebKit page, failing on any mismatch. This turns "probably identical" into a checked claim for old content too.
- **Bundle:** with `_g2` (§2.2), so one new building generation carries both changes.

### 2.4 Developer guides

Done. `~/Developer/Guides/Workflows.md` now has the procedural-locations workflow, the content-freeze rules, the squad-reachability gate and the parallel-agent merge pattern.

## 3. Agent-authored content pipeline

Agents write **data, not code paths**. One content package per framework, validated by machines, sampled by a human, then frozen.

1. **Schema.** Frameworks, situations and setting modules are typed data (extending `IncidentFramework` in `incident-frameworks-v9.ts`).
   - New mechanics need engineering. New meaning doesn't.
   - The compiler (`frameworks-v9.ts` plus placement plus setting modules) turns data into ordinary engine actions.
2. **Agent brief template.**
   - **Inputs:** the framework's purpose, its decision verbs, the setting's room uses, the prose rules (American English, in-world honesty, no meta-disclaimers, no spoilers in labels, no invented arrests, recoveries or procedures), and two exemplar packages.
   - **Output:** one package and its self-check.
   - **Isolation:** one agent per framework, each in its own worktree.
3. **Automated gates.** All must pass before a human sees the package.
   - **Schema and binding:** every role, room and object resolves on 100 generated buildings per allowed type.
   - **Playability:** squad-reachability for every role, and real dispatch journeys through every situation to an ending and through the failed-response path, with save and reload after every step.
   - **Distinctness:** the package's decision graph and outcomes differ from every existing recipe (see §4).
   - **Prose lint:**
     - American spelling and banned phrasing (the existing in-world test, extended).
     - Labels must not reveal the situation's truth.
     - Reading level, length budgets for 320 px, name-binding coverage, and pronoun agreement.
   - **Safety:** non-graphic language, no real procedures or weapons detail, and allegations kept distinct from facts.
4. **Human review: a story sheet.** A `locations.html`-style page shows each recipe's briefing, choices and endings bound to 6 sampled buildings. The reviewer approves, edits or rejects; edits go back as data.
5. **Freeze.** Approved packages join the next content version with fingerprints. The library and casebook pick them up automatically.

**Throughput:** one agent run drafts a framework package with 3–5 situations and 1–4 setting modules. With gates, 10–20 frameworks per release cycle is realistic, which is 100–300 recipes per release.

## 4. Distinctness and quality controls

- **Distinctness metric.** For each recipe, simulate all reachable choice paths and fingerprint the sequence of (stage, choice family, outcome class, ending).
  - A new recipe must differ from every existing one in at least one decision or ending.
  - Prose-only differences don't count.
  - This is the guard against "hundreds" meaning samey reskins.
- **Variety budget on the board.** Recency avoidance across framework, situation, setting and building type, extending today's family and type avoidance.
- **Telemetry stays local.** Per campaign, track which recipes were seen, completed, failed and replayed. It feeds the casebook (§5) and on-device variety. No network needed.
- **Frozen versions.** Every release adds a content version. Old IDs regenerate exactly; fingerprint suites per version (already in place for v4, v6–v9 and `_g1`).

## 5. How operations reach the player

Today: a board of 5 cards, arrivals every 45–90 minutes, cards lasting 6–12 hours, tiers capped by level and trust, and a library that lists every recipe up front.

| Surface | Purpose | Change |
| --- | --- | --- |
| **Incident board** (live calls) | The idle loop | Keep it small, 3–5 cards with expiry. Draws weight unseen recipes, then recency. A card may show a **New kind of call** badge the first time a framework appears. |
| **Unlock by capability** | Progression that makes sense | Framework families unlock by department capability, not just tier. For example, armed incidents need an entry-team certification and level 4; protected rescue needs a vehicle-operations officer; hostage crises need crisis negotiation. Locked families show as "Not yet dispatched to your department" with the requirement, never the content. |
| **Casebook** (replaces the flat library) | Discovery, mastery, replay | One row per discovered recipe: framework, setting, situations seen (1 of 3), best outcome, and buildings visited. Undiscovered recipes appear as counts ("2 more situations to find") without spoilers. Practice replays from here on fresh buildings. Filters: framework, setting, status. Compact rows at 320 px. |
| **Decision practice** | Onboarding | Keep the curated six exercises; promote one new framework's exercise when its family unlocks. |
| **Featured operation** | A reason to return | A date-seeded call with a fixed building and situation, the same for everyone that day, with an optional local best result. No network. |
| **Content drops** | New releases | New content versions add frameworks to future draws (existing pattern). A one-time "New calls in service" notice lists the new frameworks by name only. |

**Order of discovery:**
1. Levels 1–2: ordinary calls on homes and shops.
2. Levels 3–4: business settings and the first protective response.
3. Level 5 and above, with certifications: armed, hostage and rescue.
4. Upper floors and two-floor buildings ramp in with tier.

This turns the catalog into a long arc rather than a menu.

## 6. Phases

| Phase | Scope | Acceptance |
| --- | --- | --- |
| **A. Foundations (v11 + `_g2`)** | Setting-module schema and compiler; armed incident with office, warehouse and motel modules; `_g2` with access metadata and exact geometry; cross-engine CI | Armed incident hosts on 3 new types at ≥ 30% per seed; rescue on step-free apartments; JSC and WebKit fingerprints match; v1–v10 and `_g1` fingerprints unchanged |
| **B. Player arc** | Capability unlocks, casebook, New-kind badge, unseen-first draws | Real-browser journeys for unlock, discovery and casebook replay at 320 and 390 px; no spoilers in locked or undiscovered rows (tested) |
| **C. Content pipeline** | Agent brief template, gates (§3), story-sheet review page, distinctness metric | One pilot framework package goes from agent draft to frozen with all gates passing; distinctness rejects a known reskin |
| **D. Scale out** | 10–20 new frameworks per release, mostly ordinary calls (welfare variants, traffic and roadside help, noise, lost property, elderly falls, mental-health support, utility hazards, school or campus, festival crowd) | Recipe count grows by 100–300 per release; board variety metrics hold; review time per framework is tracked |

## 7. Adversarial check

*Self-review, sharing the author's context.*

**VERDICT: Accepted with controls.**

1. **Hundreds of samey calls** [serious]. A count is easy to inflate with prose swaps. *Control:* the distinctness metric in §4 gates every recipe on decisions or endings, not text.
2. **Agent prose drifts in tone, honesty or safety** [serious]. *Control:* automated prose and safety lint, a human story-sheet sign-off, and frozen versions. Agents only fill typed data that the compiler validates.
3. **Unlocks hide content players never reach** [minor]. *Control:* progression is level- and capability-based on a curve tested with simulated campaigns. Practice in the casebook stays available for anything discovered.
4. **Best alternative: fewer, deeper hand-authored stories.** These have higher quality per call, but they can't meet the stated scale or the replay value of generated places. The plan keeps hand-authored depth for the high-risk frameworks and uses the pipeline for ordinary calls.

## Owner decisions (2026-10-06)

1. **Unlocks gate by capability:** department certifications, equipment and level, as proposed in §5.
2. **The casebook replaces the library** outright.
3. **Featured operation: yes.** A date-seeded call that is the same for every player that day, with an optional local best result.
4. **Smaller, more frequent drops:** about 3–5 new frameworks per content version, not 10–20. Phase D acceptance scales accordingly.

## Delivered in content v11 (2026-10-06)

- **Setting modules** (`docs/setting-modules.md`): the armed incident plays an office late worker, a warehouse night picker and a motel night clerk, as well as the original till count.
- **`_g2` buildings:** exact geometry (`geometry: 'exact'`), apartment access metadata (128 of 200 units step-free), and the wheelchair rescue in step-free apartments. v11 draws use `_g2`; `_g1` stays frozen for v10. A cross-engine CI job recomputes 917 fingerprints under JavaScriptCore; all match V8.
- **Player arc:** capability unlocks (`src/content/unlocks.ts`), the casebook replacing the library, "New kind of call" badges, unseen-first draws, and a date-seeded featured operation (save version 6).
- **Content pipeline** (`docs/content-pipeline.md`): prose, safety and spoiler lint, the distinctness metric, playability gates, and the story sheet (`/story.html?type=<framework>`).
- **First drop:** `fall_at_home`, `water_leak` and `lost_child`.
- **v10 frozen:** 210 definitions.

**Findings to act on** (four of five addressed in content v12 and save v7, below):
- ~~Department level never rises today, so unlocks rely on certifications and equipment, and nothing asks for more than level 3. Level progression is a separate design gap.~~
- ~~The distinctness metric shows the 24 v9 compiled-framework recipes collapse to 6 decision fingerprints. They are recorded as known debt; new recipes must be distinct.~~
- ~~Protected rescue is rare even when unlocked (about 4 in 600 draws).~~
- ~~Practice results don't update casebook best results; only live calls do.~~
- The shared placement sentence can read awkwardly with some room names ("in the shop floor"). That fix needs a version gate.

## Delivered in content v12 and save v7 (2026-10-06)

- **v11 frozen:** 258 definitions (`issued-v11-fingerprints.json`, also in the cross-engine suite).
- **Department level progression** (`src/sim/department-level.ts`). Each closed live call earns service: 2 + tier for completing the agreed step, 1 + half the tier otherwise, 1 for a failed response, none for practice. Level L needs 5 × L × (L − 1) service in total (10, 30, 60, 100, ...), up to level 10. New campaigns start at level 1. The unlock curve follows §5: shops and medical calls at 2, business and the first protective response at 3, armed incidents and protected rescue at 4 (with certification), hostage crises at 5. Save v7 keeps each older campaign's level and lifts it to the level of any framework it had met or could already be sent to, so the update takes no kind of call away. The top-bar level sheet shows service toward the next level and what it opens; debriefs show service earned and any level reached.
- **Decision depth for every typed framework** (`src/content/framework-depth-v12.ts`, see the content pipeline). Calls can act on the first report instead of checking it, a real gamble on the hidden truth. Every call can close slowly but surely beside the step that fits. All 33 typed recipes are distinct (the v9 eight were 24 recipes in 6 shapes), and a new choices gate holds every stage of every typed recipe, on every building type, to at least two choices the player can take.
- **Framework-first board draws.** A framework's odds no longer depend on how many building types it fits. An unlocked specialist framework has three slots to an everyday call's four: protected rescue rose from 1.3% to about 4.4% of draws with everything unlocked (`draw-v12.test.ts`).
- **Practice counts toward casebook best results** on situations already met live, marked "(practice)". Practice never discovers a recipe, and a building type met only in practice isn't listed as visited. Results fold when each debrief closes.
- **Update 2026-10-06: practice removed.** Every operation is now a live call. Practice runs, decision exercises, casebook replay and the featured operation are gone; the casebook is the record of calls taken, and the Ops board fills open places with the two standing assignments. Save v8 ends a saved practice run as cancelled, drops practice debriefs and practice-only casebook entries, and unmarks practice best results.
- **Fixed in passing:** before v12, `false_intruder` situation 2 on some `_g2` houses reached resolve with no step the player could take, because furniture blocked the walk out. v12 refuses such buildings at hosting.
- **Hand-authored stories get second choices too** (`decisions-v8/choices-v12.ts`). Every stage of the six stories now opens with at least two choices the player can take, on the gated building types. Two furnished-layout routing faults that stranded players with no usable step (a squad at a window staging point; a crew meeting point outside a wrapped front lot) are fixed in the engine.

**Still open:**
- The shared placement sentence can read awkwardly with some room names ("in the shop floor"). That fix needs a version gate.
