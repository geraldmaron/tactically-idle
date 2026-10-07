# Content pipeline: agent-authored framework packages

**Status:** In use from content v11 (2026-10-06). Implements Phase C of [scenario-scale-plan.md](scenario-scale-plan.md) (§3 pipeline, §4 distinctness). The first drop through it is three ordinary calls: a fall at home, a water leak and a lost child.

## How a package becomes a call

```
agent brief ──► typed package ──► automated gates ──► story sheet review ──► freeze in the next content version
 (this doc)     (data only)       (tests, all must     (human: approve,       (registered in a new
                                    pass)               edit or reject)         version, fingerprinted)
```

Agents write **data, not code paths**. A package is one `IncidentFramework` entry. The compiler in `src/gen/incident/frameworks-v9.ts` turns it into ordinary engine actions, facts and endings. A new decision shape needs engineering first, as a new optional field on `IncidentFramework` that leaves existing packages' output unchanged. New meaning only needs a package.

## What a package contains

| Part | Where it goes | Notes |
| --- | --- | --- |
| Framework data | Append to `ADDITIONAL_FRAMEWORKS` in `src/content/incident-frameworks-v9.ts` | Never edit an issued entry |
| Type ID | `IncidentType` union in `src/sim/scenario-types.ts` | Lowercase snake case |
| Cast slot | `SCENARIO_CAST` in `src/gen/incident/cast-v9.ts` | `id` = `personId`, `authoredName` = `name`; pronouns must match the prose |
| Placement | `PLACEMENT_AFFINITIES_V10` in `src/gen/incident/placement-v10.ts` | Room-use weights; no bedrooms or private flats for public roles |
| Catalog entry | `NEW_FRAMEWORKS_V11` (or the next version's list) in `src/content/scenario-types-v11.ts` | Label, building types, squad range |

A framework holds: title, dispatch reason, opening, question, fact label, two approaches (first account and independent source) with results, the check, the claim with what confirming or disproving it shows, two competing resolutions with results, which result moves the person outside (`moveOn`), and three situations with their truth.

### Decision structures

Each recipe must differ from every other in a decision or an ending (see "Distinctness" below). Prose and setting can't do that. These are the structures the compiler offers:

- **Truth pattern** `truth: [s1, s2, s3]`. Situations 1 and 2 must differ, or they play identically. Situation 3 always has an incomplete first report that needs the independent source before the check. The eight v9 frameworks all use `[true, false, true]`.
- **`moveOn`**: which answer ends with the person walking out along the exit route (`confirmed`, `disproved` or `neither`).
- **`precaution`** (v11): an early step in the first stage, such as turning off the water or putting staff on the doors. The resolution for `requiredFor` needs it. Taking it early always costs time. Leaving it costs a slower late step that can fail and leave the call unfinished.
- **`waitFor`** (v11): a third, slower close that works whatever the check found, such as waiting with the person until a relative arrives. It cannot fall through, but it takes longer and earns no trust.
- **`corroborate`** (v11): the resolution for one answer needs both accounts heard first, such as before handing a child to an adult. A missed account becomes a follow-up step.
- **`actOnReport`** (v12): skip the check and carry out the step that fits the first report (`assume`). The outcome is decided by the hidden truth only when the step commits. If the report was right, the call closes a step early: less squad strain, and one less trust (`acted_on_report` ending). If it was wrong, the team backs out (`wrong` text, read only afterwards), the call loses ground and pressure rises, and the step that fits the truth is still to do. Keep it on the side that does **not** walk the person out: the engine can't escort someone whose location the team hasn't confirmed, so a moving act is refused whenever the first report names the wrong room.

Extensions only touch the paths they apply to. `corroborate` alone affects one answer, so the other answer still needs something distinct. A recipe's decisions differ on each side of the truth, so make each framework differ from every other on **both** sides: `precaution` changes both, `corroborate` and `moveOn` change one, and `actOnReport.assume` changes which side is the gamble's good one. Run the gate rather than reasoning about it.

### Decision depth (content v12)

Issued packages are never edited in place, so v12 adds structure in `src/content/framework-depth-v12.ts`, applied by `frameworkAt(type, contentVersion)` from v12 on. Calls before v12 compile exactly as issued (`issued-v11.test.ts` and earlier). Every typed framework gets `actOnReport` and, where it lacks one, `waitFor`. The eight v9 frameworks also get the combination of `precaution` and `corroborate` that makes them distinct:

| Framework | Act on report | Precaution | Corroborate | Walks out |
| --- | --- | --- | --- | --- |
| missing_vulnerable | disproved | disproved | disproved | confirmed |
| person_in_crisis | disproved | confirmed | disproved | confirmed |
| domestic | disproved | none | disproved | confirmed |
| burglary | disproved | confirmed | none | none |
| business_robbery | confirmed | none | confirmed | none |
| vacant_occupancy | disproved | disproved | confirmed | none |
| disturbance | confirmed | none | disproved | none |
| false_intruder | confirmed | disproved | none | disproved |
| fall_at_home | disproved | none | none | none |
| water_leak | confirmed | (v11) confirmed | none | none |
| lost_child | confirmed | (v11) disproved | (v11) confirmed | confirmed |

From v12 the compiler also refuses a building where a call that walks the person out finds that walk blocked by furniture, as the engine checks it. Lazy hosting moves the call to another seed. Before v12, `false_intruder` situation 2 on some `_g2` houses had no step the player could take at resolve.

## Agent brief template

One agent per framework, each in its own worktree. Fill the brackets and hand over this whole section.

Before drafting, the agent reads the writing skills in `.agents/skills/` (order and scope in `.agents/skills/README.md`): `swat-call-design` for the call's shape, `swat-call-prose` for every player-visible string, `swat-officer-stories` for officer text. The story sheet review below uses `swat-writing-review` as its second reader, extending the reviewer checklist.

> **Task.** Write one framework package for Tactically Idle content version [N]: [purpose in one sentence, for example "an older adult has fallen at home and a relative is worried"].
>
> **Decision verbs.** The team can [verbs, for example: hear the relative, check the alarm log, ask the person, wait for family]. The disputed point is [the claim that each situation fixes as true or false].
>
> **Settings.** Building types: [authored and generated IDs]. The person is in rooms used as [room uses from `PlacementKind`, for example hall, kitchen, bathroom]. Never bedrooms, guest rooms or private flats for a public role.
>
> **Structure.** Use truth pattern [pattern] and [none, or precaution / waitFor / corroborate with its purpose]. Situations 1 and 2 must have different answers.
>
> **Prose rules.**
> - American English. Curly apostrophes (’) as in the exemplars.
> - Stay in the world. Say what happened and what is left to do. Never describe what the story declines to claim ("no arrest is claimed", "this scenario").
> - No spoilers. The title, dispatch reason, opening, question, fact label, approaches, check and precaution read the same in all three situations. Situation notes are for authors only.
> - Honest outcomes. No invented arrests, recoveries, diagnoses, evictions or completed handovers that the step didn't do. Allegations carry who says so until checked.
> - Non-graphic. No injury detail, weapon specifics or real medical, tactical or legal procedure.
> - Short. Titles under 34 characters, action titles under 60, briefing lines under 260, sentences under 34 words.
> - Name the person in the opening and in the check. Use one pronoun set for them throughout.
>
> **Exemplars.** `false_intruder` (the v9 shape, `moveOn: 'disproved'`) and `water_leak` (v11, with `precaution`), both in `src/content/incident-frameworks-v9.ts`.
>
> **Output.** One package: the framework entry, the `IncidentType` member, the cast slot, the placement affinity and the catalog entry. Then a self-check:
> 1. `npx tsc -b --noEmit`
> 2. `npx vitest run src/gen/incident/content-gates.test.ts src/gen/incident/content-playability.test.ts`
> 3. `npx vitest run src/gen/incident/issued-v9.test.ts src/gen/incident/issued-v10.test.ts src/gen/incident/catalog-v9.test.ts` (issued content unchanged)
> 4. Open `/story.html?type=<type>` and read all three situations.
> 5. Report anything the gates allowed that a reader might still question.

## Gates

All gates run on every typed framework, existing and new, at the current content version. A package must pass all of them before a human sees it.

| Gate | Code | Test |
| --- | --- | --- |
| Prose lint | `src/gen/incident/gates/prose-lint.ts` | `content-gates.test.ts` |
| Distinctness | `src/gen/incident/gates/distinctness.ts` | `content-gates.test.ts` |
| Binding, reach, hosting, journeys | `src/gen/incident/gates/playability.ts` | `content-playability.test.ts` |
| Choices | `src/gen/incident/gates/choices.ts` | `content-gates.test.ts` |

```sh
npx vitest run src/gen/incident/content-gates.test.ts src/gen/incident/content-playability.test.ts
```

### Prose lint

It runs on the package data, using the longest drawable names, and on every compiled call for every building type, situation and pacing:

- **American:** every `AMERICAN_ENGLISH` key plus a few British usages it doesn't list (mum, whilst, queue).
- **Meta:** the v9 in-world test, extended ("this scenario", "is claimed", "has been assumed").
- **Spoiler:** no situation note, confirmed or disproved text, result or ending, nor any sentence of four or more words from them, is readable before the check.
- **Length:** the 320 px budgets in `LENGTH_BUDGETS`, checked with the longest names in the pools.
- **Names:**
  - No authored name survives binding.
  - No name from the pools appears unless it belongs to the cast.
  - No `{placeholder}` remains.
  - The person is named in the opening and in a conversation, so pacing has something to apply to.
- **Pronouns:** in a sentence that names only the person, a pronoun from the other set is an error. The exception is when the sentence also names a gendered relative it can refer to ("Theo calls the man their uncle, and he agrees").
- **Safety:**
  - No graphic injury, weapon specifics or procedure terms.
  - An accusation before the check needs a source, a hedge or a negation.
  - Arrests, charges or guilt may only appear negated.

The lint is a net, not a reader. It doesn't judge tone or plausibility, which is what the story sheet is for.

### Distinctness

A recipe is a framework × situation. Pacing changes time, not decisions, so it isn't counted. The gate plays every reachable path through the real dispatcher with one squad and aims each decision at each outcome band it can reach. It writes each path without prose:

```
stage : action family : outcome class  >  …  >  end:<ending>/<disposition>
```

- **Action family:** the check kind, whether the team walks to it, and whether it moves the person.
- **Outcome class:**
  - the run-state change the engine applied: stage change, facts revealed and to what, story flags set, or the ending;
  - with the framework prefix stripped from IDs.

The fingerprint is the sorted set of paths. Two recipes collide when their sets are equal. Every recipe added in v11 or later must collide with nothing, including the six hand-authored stories. The test proves the gate rejects a deliberate reskin: the alarm framework rewritten as a gym story collides with `burglary/0`. Adding a precaution that copies Water Through the Ceiling's structure collides with `water_leak/0`. Only a precaution needed when the claim is wrong is new.

**Findings in the issued catalog.** Through v11 the eight v9 frameworks shared one compiled structure, and their 24 recipes produced 6 distinct fingerprints (below). v12 decision depth makes all 33 typed recipes distinct. The gate now records only `welfare_check/1 = welfare_check/2`, a hand-authored story.

| Plays identically | Shape |
| --- | --- |
| burglary, business_robbery, disturbance, false_intruder, vacant_occupancy (situation 1) | claim holds, nobody moves |
| burglary, business_robbery, disturbance, domestic, missing_vulnerable, person_in_crisis, vacant_occupancy (situation 2) | claim wrong, nobody moves |
| burglary, business_robbery, disturbance, false_intruder, vacant_occupancy (situation 3) | claim holds after the independent source |
| domestic, missing_vulnerable, person_in_crisis (situation 1) | claim holds, person walks out |
| domestic, missing_vulnerable, person_in_crisis (situation 3) | the same, after the independent source |
| welfare_check situations 2 and 3 | hand-authored story; identical with one squad and the standard loadout |

Only `false_intruder` situation 2 was unique among the 24. The issued v9–v11 calls are frozen and still play this way. New draws use v12.

**Limits.**
- Exploration uses one squad with the standard loadout. Two- and three-squad actions in the hand-authored stories aren't explored, so their fingerprints understate them.
- The distinctness test fingerprints on one building per framework. A second test confirms the new frameworks' fingerprints don't change with the building, cast or placement.

### Choices

A stage that opens with one button the player can press is not a decision. The gate plays every reachable path through the real engine, as distinctness does, and fails when the run starts, or enters a stage, with fewer than two choices the player can take. Steps the player can see but can't take yet don't count. It runs on every listed building type for every situation.

- Before v12, every typed recipe had such stages: pick one of two approaches, then press the only button, then press the only button. The test proves the gate catches this on issued v11 calls.
- The six hand-authored stories had them too; the issued v11 hostage crisis opened with one. From v12, `src/gen/incident/decisions-v8/choices-v12.ts` gives each such stage a second choice built from the story's own flags, facts and services. Each one changes time, risk, what is recorded or how the call ends, following v8's rule against relabelled duplicates. A preparation step only counts if it changes the odds of a step whose outcome depends on the roll; a bonus on a step that always succeeds is not a choice. The gate checks these stories on one authored and one generated building type each, because their decision graphs are larger.

| Story | Thin stage in v11 | Second choice from v12 |
| --- | --- | --- |
| Hostage crisis | Opening; Ben's release; the final exchange; a lost line under threat | Let Lewis state his demand first; ask for Mara's release with Ben's; ask for Mara before any recording; have patrol retry the relay |
| Armed incident | Before the pause; after it | Talk Eli down out of sight first (eases the urgent response and an unannounced approach); go in on the silence without the stand-down check (decided by hidden truth) |
| Protected rescue | After hearing Jun; after reaching Jun; the final move | Wait with Jun for a quiet spell first (patrol learns the gunfire's pattern); wait at staging for one |
| Medical | Before the conversation; waiting for or meeting the crew | Send the medic first; ask Rosa how the dizziness is (eases pressure that otherwise costs her safety) |
| Welfare check | Before the current check; after asking again | Leave Ada in peace with a card (a partial ending); have dispatch match the timestamps |
| Barricade | Agreeing the exit; meeting her; repairing the agreement; route unchecked; care after talking at home | Offer the private conversation where Mina is; check the doorway yourselves; agree she sees her own doctor |

Two routing faults on furnished `_g2` layouts left some of these calls with no usable step at all, before v12 too. Both are fixed in the engine, only where the old code failed: a squad holding a window or door staging point within the 1 ft clearance now paths from the nearest clear point a step away (`furnishedLocalPath`), and a crew meeting point whose zone centroid falls outside a wrapped zone uses the zone's first staging point (`physical-care.ts`).

The explorers evaluate each state's action views once and reuse them for every move and outcome band, which cut the largest barricade exploration from 37 minutes to under a minute.

### Playability

- **Binding and reach.** The gate generates 50 buildings per listed generated type at the current version. Each call must generate, pass `validateStoryBindings`, and have the person's start and reported spots reachable by squads from the entry staging points (`routeBetween`, as in `v10-locations.test.ts`).
- **Hosting.** A generated type is listed only where at least 30% of building seeds host the call at the drawn seed. Calls on other seeds move to another seed of the same type.
- **Journeys.** For each situation, one run must complete the agreed step and one must close through the failed-response report. From v12 every typed call has a close that can't fall through, so a failed response needs both in-person checks to come back inconclusive. The failed-response journeys therefore run on the first listed building, where each candidate run is cheap, and search up to 20,000 campaign seeds. Runs use the engine's own dice, from campaign seeds tried in order. The run found is replayed with `serialize`/`deserialize` after every step, and the restored run must match exactly. Gate runs are live calls (practice was removed on 2026-10-06): `startGateRun` gives squad A one fresh, owned unit of every item the department can field, so no choice closes for want of gear, and strain, injuries and supplies apply as they would for a player.

The distinctness explorer chooses the dice before each decision. Such runs are never saved, because the save validator rightly rejects a sample stream that has been tampered with. Journeys never choose dice, which is why they search campaign seeds instead.

## Human review: the story sheet

Run `npm run dev`, then open `/story.html` (dev-only; a build input but not linked from the game).

```
/story.html?type=water_leak                one framework (default: the newest)
/story.html?type=water_leak&pacing=deliberate_answers
/story.html?type=water_leak&seed=12        six different buildings
/story.html?type=water_leak&journeys=1     also play the dispatch journeys in the page
```

For each situation the page shows six calls bound to sampled buildings, spread over the listed building types. Each call is shown at a 320 px reading width, with the card and briefing, every choice by stage, what the check finds, and the endings. A call is outlined in red if it fails a gate. The top of the page shows the package lint, distinctness against every typed framework, and optionally the journeys.

Reviewer checklist:
1. Read situation 1 as a player. Is the decision real, and is either approach a reasonable first move?
2. Compare situations: does anything before the check give the answer away?
3. Are the people, rooms and building plausible together in all six samples?
4. Are the endings honest about what the team did, and silent about what it didn't?
5. Is it non-graphic, and does it keep allegations apart from facts?

Record **approve**, **edit** (as a data change to the package, then rerun the gates) or **reject** in the pull request. Edits go back as data, never as compiler special cases.

## Freeze rule

- A package ships by joining the next content version's catalog (`NEW_FRAMEWORKS_V11` for v11). Older versions' lists never change, so issued v1–v10 IDs regenerate byte for byte (`issued-v9.test.ts`, `issued-v10.test.ts`, `catalog-v9.test.ts`).
- A new framework type is valid only from the version that introduces it. `parseIncidentId` rejects it in older IDs.
- Once a version is issued, capture its fingerprints as v10 and v11 did (`issued-v10-fingerprints.json`, `issued-v11-fingerprints.json`). After that, a package is never edited in place. Fixes ship as a new framework or a new optional structure in the next version (v12 decision depth is the worked example).
- Compiler extensions must be output-neutral for every existing package. The issued fingerprint suites check this.

## First drop (content v11)

| Framework | Type | Structure | Truth | Building types |
| --- | --- | --- | --- | --- |
| A Fall at Home | `fall_at_home` | `waitFor` (wait for the daughter) | false, true, true | five authored homes, `bungalow_g1`, `two_storey_house_g1`, `semi_detached_g1`, `apartment_unit_g1` |
| Water Through the Ceiling | `water_leak` | `precaution` needed when the leak is real | true, false, false | `harbour_court`, `market_row`, `apartment_unit_g1`, `corner_store_flat_g1`, `small_office_g1`, `bar_restaurant_g1`, `motel_row_g1` |
| Lost and Found | `lost_child` | `precaution` needed when the man isn't family, `corroborate` before handing the child over, child walks out to family | false, true, false | `market_row`, `corner_store_flat_g1`, `bar_restaurant_g1`, `motel_row_g1` |

All three are ordinary calls with squads 1–2. Every listed generated type hosted all 50 sampled building seeds at the drawn seed (50/50). The three are distinct from each other, from the eight v9 frameworks and from the six hand-authored stories.

Two generic changes were needed outside the framework files, both output-neutral for issued content:
- `scenarioRecipe` gives a framework added after v9 all three situations with both pacings.
- `parseIncidentId` accepts a v11 type only from content version 11.

## Open issues

- The v10 placement line can read awkwardly with some room labels ("in the shop floor", "in the living / dining"). It is shared, issued compiler output, so a fix ships with a version gate in a later drop.

- The scenario library (`ScenarioLibrary.tsx`) still lists the v10 catalog. The v11 frameworks reach players through board draws until the casebook replaces the library (scale plan §5).
