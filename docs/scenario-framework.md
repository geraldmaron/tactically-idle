DRAFT, 2026-10-23. A proposal for the owner, not a rule, except section 7a, which the owner adopted
on 2026-10-23 (recorded in `docs/backlog.md`, Owner decisions). Nothing here is built, and the
skills and `docs/content-pipeline.md` are unchanged. Section 11 records sol's three challenges.

# Scenario framework: parameters, policies, officers and a catalog

The owner asked (2026-10-23) whether calls should move to a tagging and policy system: a broad set
of tags (incident class, setting, affiliation, how many subjects, how many armed), policies (what a
call may contain), models building curated scenarios and alternatives from those parameters, a
catalog keyed by title, tags and hashes, packs, and later persistence across calls. Officer traits
still decide outcomes, and the blueprint has to fit. Two follow-ups the same day set the target and
widened the scope: **about a thousand call loops that never feel repetitive and read like one
broader book**, and **how calls integrate with the officer profiles and stories**.

## Recommendation first

**Adopt the experiments, not the system.** sol's verdict on both drafts was "needs validation",
and I agree: the catalog size, the production economics, officer exposure and whether a director
creates continuity are all assumptions until measured. What is settled enough to commit to:

1. **The shipping artifact is a curated call package, however it was authored.** Frozen, compiled,
   gated, with a stable id. Nothing is filled from tags at draw time.
2. **A minimum invariant gate comes first.** Authored harm can record a minor as killed today
   (section 3). No generated candidate is accepted until each house invariant has a failing
   fixture on each effect path.
3. **Then a screening trial of authoring methods**: parameter-led synthesis against premise-led
   authoring, matched briefs, the same format and staffing, every output read blind (section 9).
4. **Then two thin slices that test the "book"**: one officer callback rendered from a recorded
   event, and one persisted follow-up call (the fled subject, D2). Build ledgers, a director, arcs
   and a catalog only as far as those slices and the trial's accepted calls show they pay.
5. **The blueprint stays**, matched by spatial capability.
6. **Officers are the book's recurring cast.** Integrate through one fact stream bound to the
   officers who actually acted, preserving history after an officer leaves (section 6).

**One decision can't wait for the experiments: live content against disposable saves.** The book
assumes monthly content drops over months of play, and today every content version change rejects
the save (`deserialize`, `src/sim/save.ts`). That is right while developing and wrong for live
play, where a release would erase the threads and officer histories the book is made of. Before
launch the owner picks: additive releases that keep saves, or campaigns pinned to a content revision.
Owner, 2026-10-23: a growing catalog with frozen runs (section 7a), promised from the store launch or
the first real-money release.

| Part of the proposal | Verdict |
|---|---|
| Runtime fill of generic trees from tags | rejected |
| Parameter-led synthesis of new call graphs, frozen and gated | needs validation (the trial) |
| A closed tag vocabulary | accepted with controls; built after the trial, sized to what it shows |
| Policies | accepted with controls; enforcement proven per effect path first |
| "Allow children to be killed" as a policy | rejected; keep the invariant |
| Catalog: title, tags, hash | accepted with controls; four separate identity records |
| A director | needs validation; extends today's novelty and reputation weights |
| Officer and story integration | accepted with controls; one callback slice first |
| Sizing: 250 to 300 calls | a hypothesis, not a target |
| Packs | later; filter-aware |
| Persistence | needs validation; the D2 follow-up slice |

## 1. What exists today

| Proposed parameter | Where it lives |
|---|---|
| Dispatch kind | `IncidentType`; Going Live dispatches as `hostage_crisis` |
| Incident class | Derived from holds and activity; Going Live classifies as `victim` |
| Subject and armed counts | `CastSlot.count` draws the declared range; scale class labels the result afterward (`src/gen/incident/instance.ts`) |
| Holds, minors, animals, weapons, conditions | `PersonKind`, `HoldKind`, `AgeBand`, `AnimalTraits`, `Weapon`, `Conditions` |
| Setting | `CallTree.families` (procedural and authored, such as `market_row`) and `scene.setting` |
| Content themes | `ContentDescriptor` per situation: derived requirements plus designer-declared themes |
| Escalation mechanisms | Eight named in `docs/calls/depth-mesh-method.md`, design metadata only |
| Complications | `IncidentTemplate.complications`, empty everywhere |
| What the board favors | Unseen-first and reputation weights (`noveltyWeights`, `src/sim/casebook.ts`; `playerArcContext`, `src/sim/incidents.ts`) |
| Officers in a call | Crew and lead flags from traits and bands (`src/sim/crew.ts`); familiarity from `career.byType` |
| Officer change | Promotions drop `rookie` and grant `steady`, `mentor` and `observant` (`src/content/ranks.ts`, `creditXp` in `src/sim/ranks.ts`); burnout retirement after hard runs (`src/sim/career.ts`) |
| Officer story | One-sentence persona note; ledger, leanings, bonds and nicknames are design only (`swat-officer-stories` R1 to R15) |

Going Live has fixed counts (one rider, clerk, manager and friend) and two situations.

## 2. The case against "parameters build scenarios", and its strongest version

**Failure mode: a thousand calls that are one call with the nouns changed.** A tuple such as
"hostage, school, extremist group, three subjects, two armed" fixes a cast and a place, not the
person, private logic, planted turn or dilemma. The owner rejected both halves of that failure
already: prose rebound by find and replace and a lost child at a shop on the SWAT board
(2026-10-07, `docs/call-trees-v13.md`), and four correct calls judged forgettable (2026-10-19,
`docs/scenario-depth.md`). Going Live, about 850 strings, has had a teardown, two structure passes,
three Codex reads, a prose pass and a writing review, and has not shipped.

**The strongest version (sol).** Parameters can be causal: conflicting wants, concealed
relationships, the evidence that reveals them, deadlines, obligations and spatial requirements. A
model synthesizes a causal graph and a native `CallTree` and `IncidentTemplate` skeleton, and
contradictions, unsupported geometry, policy breaches and empty choices are rejected before prose
exists. The premise is the output, which matches the domain model's "the story follows the data
model".

So premise-led and parameter-led authoring are two routes to the same artifact. Which one yields
memorable calls at a cost the game can afford is an empirical question (section 9). Format is a
separate question: either method can write a short call or a long one.

## 3. Tags, policy and the blueprint

### Levels and evidence

A tag describes one of five levels, kept apart because policy and filtering need the difference:
dispatch kind, incident class, call (union over situations), situation (descriptors and filters
live here), and instance (what one play drew).

Each tag records its evidence, never its provenance alone:

- **Requested**: a parameter the brief asked for. Not proof the output has it.
- **Verified structural**: checked against the compiled call (class, counts, minors, clocks,
  families, the derived descriptor requirements).
- **Reviewed semantic**: motive, affiliation, relationship to the place, declared themes. A gate
  checks only necessary mechanical implications; a reviewer confirms the label against named text;
  "unknown" is allowed. Inventing mechanics to satisfy a label is not: an ideological subject need
  not make a demand, and an organization can send one person.

### Policy

Policy is an intersection over eligible situations: house invariants, then catalog and pack policy,
then player filters. A lower tier only removes. **Each tier must still specify** what happens when
its result is empty and how far a fallback may reach; today the settings screen withholds an
exclusion that would leave no kind drawable, which guarantees neither variety nor two calls per
pack. Owner sign-off lets a sensitive premise be commissioned within house policy, never past it.

**Invariants are not enforced on every path.** sol confirmed in memory that authored harm is
recorded without the minor clamp: a fixture with `minor: true` and `noFatal: true` recorded `fatal`
(`authoredHarm`, `src/sim/incident-consequences.ts`). No shipped call reaches it, but a generated
batch would find it.

**Children and death.** The owner decided on 2026-10-07 that children can be hurt, never killed.
Keep it. Apple's App Review Guidelines 1.1.2 reject "realistic portrayals of people or animals being
killed, maimed, tortured, or abused" (read 2026-10-23); how a non-graphic text game is judged under
it is Apple's call.

**Sensitive combinations** are a product proposal, not a store rule. Guideline 1.1.7 rejects content
that capitalizes on "recent or current events, such as violent conflicts, terrorist attacks" (read
2026-10-23), which bears on an extremist group in a school. For the owner to set: never commissioned
(a school with an active-threat class; an ideological group targeting a named real group), and
sign-off with a design sheet (a minor as subject; a school or place of worship; an organized
ideological group).

### Blueprint

It stays: the spatial probes (door and window states at a 0.27 floor, building odds and travel at
0.18; `src/architecture/wiring.ts`), containment, sightlines and the visual identity. A call is
matched to the spatial capabilities it needs (a counter, an upstairs, a rear exit, a street
vantage), served by procedural families or validated authored layouts. Probes are pooled across
sampled choices; a call declares which inputs apply to it and tests them, rather than adding
movement or gear choices to reproduce aggregate shares.

### Identity and hashing

| Record | What it covers | Used for |
|---|---|---|
| Logical id | A stable slug (`going_live`) | Saves, packs, threads, follow-ups |
| Package digest | The canonical package at one revision | Provenance; "is this the reviewed text" |
| Regression fingerprints | Sampled compiled instances (four seed pairs per family, tier 2) | Tripwires, as now |
| Similarity record | Narrative and mechanical similarity to other calls | Duplicates a hash can't see |

A play is addressed by the full `IncidentSpec` plus logical id and revision: family and seed
requested and actually hosted, call seed and tier (the same seed at tiers 1 and 5 opens at 40 and
56). "Behaviorally distinct" is not measured anywhere today (`countTemplate` reports situations ×
turns); structural, mechanical and narrative counts are reported separately.

## 4. Sizing: a thousand loops that read as one book

Intent, inferred: over a player's lifetime of about a thousand calls, no call feels like a rerun,
and together they read like one book: one city, people who come back, threads that pay off.

### The tag count is not the constraint

Nine kinds, fourteen settings, ten motives, three affiliations, four scale classes, fifteen
complications and ninety condition combinations give about 20.4 million combinations; at 1%
coherent, about 204,000. What runs out is what players remember.

### A first-order estimate, labeled as one

Calls needed ≈ 1000 × (1 − r) / S, with S worthwhile plays per call and r the share of plays that
meet a twist already seen. With S = 3 (the situation maximum) and r between 0.10 and 0.25, that is
250 to 300 calls. **This is inventory arithmetic, not a model of repetition.** It can be wrong both
ways: three situations that share a hook may feel like one play (S near 1), while a call whose
choices, crew branches and buildings change the problem may give more than three. Filters and
players who stop early change consumption too. So S and r are measured, not chosen: the trial
records how novel a second and third play of the same call feel, and a repeated-session playtest
records when players first say "I've seen this".

### What players remember

The units below are the ones to measure. The windows are guesses for playtests to replace.

| Unit | Salience | Guessed window | Today |
|---|---|---|---|
| Twist instance (call × situation) | very high | one late replay at most | 1 call, 2 situations |
| Call (person, private logic, wrong note) | high | 100 plays | 1 |
| Person card | high | 40 | none typed |
| Twist type | medium high | 30 | none typed |
| Dilemma shape | medium | 10 | none typed |
| A spoken sentence, any speaker | high once noticed | 30 exposures | chat pools only |
| Escalation mechanism | medium | twice in a call | 8 named |
| Complication, setting | low to medium | 3 to 8 | 0 built, 9 procedural plus authored |
| Layout, counts, identity, names, conditions | low | none | drawn |

Pool sizes can't come from a window alone. They depend on how often a unit is eligible and drawn,
how demand clusters (a favorite squad, a common kind), and how windows on different axes collide.
The check is a schedule simulation over the catalog, filters and a modeled campaign, counting
repeats per unit and across speakers: a sentence said by a different officer is still a repeat.

### Formats

Two formats are worth testing, independent of how they are authored: a **signature** call (four to
five decisions, about 850 strings) carrying threads, and a **short** call (three decisions, a target
near 200 strings) between them. What a short call may cost is derived from the real budget once the
trial gives an accepted-call cost, counting rejects, repairs, tooling, review and continuity upkeep.

### What makes it a book, and what scheduling can't do

The draw already weights unseen kinds and the department's reputation. A director extends that
selector rather than replacing it:

1. **Soft cooldowns** that relax when the catalog is small (a launch catalog of about seventy calls
   exhausts itself before a hard hundred-play window allows a repeat), under **hard** policy
   exclusions that never relax.
2. **Threads with causal progression.** Canonical sequels (chapter two follows from what happened in
   chapter one) are a different thing from alternate truths of one call, and need the persistence
   contract (section 7). Scheduling alone gives order, not cause or closure; each thread needs an
   authored ending reachable from its likely states.
3. **Recurring city people**, **one city per save** (`city-canon-per-save`), and **the department's
   own thread** (section 6, `docs/player-profile.md`).

This is the storylet pattern (content declares the state it needs; a selector chooses), named as a
known pattern, not a cited source.

### Cadence

No play-rate data exists. A game day is one real hour (`CALENDAR`, `src/sim/calendar.ts`), so a
hundred real days is about 6.6 game years: officers retire and are replaced inside one player's
book. Launch needs enough for the first weeks with no repeats, then regular drops, which is why the
save decision above comes first.

## 5. Where models fit

| Job | Model role | Human role |
|---|---|---|
| Gaps and overuse | Script over the catalog | Owner picks gaps |
| Modules (person cards, twist types, dilemma shapes) | Several models pitch | Owner keeps or kills |
| Calls, premise-led | The mesh or one author (`mesh-trial`) | Owner picks pitches, reads paths |
| Calls, parameter-led | Brief → causal graph → native skeleton → gates → prose | Lead accepts structure; owner reads |
| Variants and pools | Cheap models draft; distinctness tests gate | Separate reader |
| Review | sol cross-family | Owner's read anchors taste |

The owner's review hours are the scarce resource either way, and the denominator of every measure.

## 6. Officers and stories

### The proposal, made as strong as it can be

The department is the book's protagonist. The player meets each call once and the same officers
across many calls. A procedural reads as one story because its detectives carry what happened to
them from case to case. So calls and officers integrate both ways:

- **Calls write officers.** Outcomes emit typed facts: which officer led which step, who was hurt,
  who fired, who talked someone out, and the specific (an object, a room, what was said). Those
  feed the ledger, arcs, bonds and nicknames `swat-officer-stories` designs.
- **Officers write calls.** Crew flags open choices; familiarity shifts odds; a briefing or debrief
  carries one callback to a recorded fact (R15).
- **Selection serves arcs.** A scoped leaning advances or clears only through a step in its scope
  (skill §6, rule 4), so the selector can raise the chance of a call in an open arc's scope.
- **Officer threads**: a subject who fled from one officer returns; an officer's first call back
  after an injury.

### The case against it

1. **Repetition shows first in officers.** Exposure is not even. A department starts with eight
   officers in two squads (`startingSquads`, `src/content/officers.ts`), a roster cap of 12 rising
   to 18, unavailable officers skipped, favorites used heavily, and retirements over the 6.6 game
   years of a hundred-day campaign. A frequent speaker over a 30-deployment window needs about
   thirty distinct lines; one who speaks every fourth deployment needs about eight. Pooled
   personality lines don't scale. **Control:** lines are rendered from the recorded event and the
   persona's voice markers, measured by exposure per officer and across officers.
2. **Losing or misbinding the protagonist.** An arc-serving draw can surface a call for an officer
   who doesn't deploy. Retirement deletes the active record (`src/sim/career.ts`); personnel
   storage keeps first-seen builds, not departure-time history (`src/sim/personnel.ts`); crew flags
   describe the crew collectively and keep an officer hurt mid-call. **Control:** facts bind to the
   officers who actually acted on the step; a bounded history survives departure; every officer
   thread has an outcome for an absent, injured or retired officer; a replacement never inherits
   another officer's experience.
3. **Death spirals.** Adverse runs raise strain, strain earns a negative leaning, the leaning lowers
   odds. Burnout already retires an officer after three adverse operations in five, and retention
   can't defer it (`src/sim/career.ts`). The proposed cap of one earned negative per game week is
   one per seven real hours, and "a favorable path exists" says nothing about how likely or
   reachable it is. **Control:** a longitudinal simulation with arc-weighted selection on, measuring
   whether an officer recovers before burnout; the skill's full rules as engine rules: paired
   positives, recovery through time and choice, the three-trait cap, and no negative progression
   after a call the squad resolved through restraint with everyone safe (rule 10; ordinary strain
   still accrues).
4. **Two trait writers.** Promotions already add and remove traits. **Control:** arcs and
   promotions share one writer with precedence, a cap and a recorded cause for each change.
5. **Callbacks move the validation problem.** Rendered at display time, they stay out of the
   compiled-call coverage gate but still combine persona, event, speaker and context. **Control:** a
   defined renderer (authored templates, event text frozen at debrief, permitted substitutions) with
   its own attribution, continuity, repetition and prose checks.
6. **Selection as railroad.** **Control:** arc weighting raises a chance, never forces a call, never
   overrides cooldowns or filters.
7. **Odds stacking.** **Control:** `career.byType` stays the only familiarity input until a probe
   shows another earns its place.

### On identity

My first rule, "key officer content to events, never identity", was too strict. Within a campaign
an officer keeps their persona (`identityId`), and the skill's data proposal already plans
persona-keyed story files and identity hooks. Revised rule: **persona background and voice may
shape text, under eligibility predicates that read true for the role and service the campaign
drew; mechanics never read demographics; threads hinge on recorded events**, because those are the
only facts guaranteed true in every campaign.

## 7. Persistence across calls

Resume (one run across reloads) already stores knowledge, clocks, commitments and the random state.
Cross-call continuity is separate and needs actor binding (a save-level id for a recurring person
and a rule for binding them into a later call's role), provenance (originating run and event), a
lifecycle (required or optional imports, exactly-once consumption, eligibility windows, expiry with
a debrief line when a follow-up is filtered or never drawn), and bounded state. Build it with the
D2 follow-up call, and only after the save decision above.

## 7a. Live-content save policy

### How saves work today

Up to ten campaign slots share one storage entry with its own version, active pointer and
deleted-slot recovery (`src/sim/campaign-slots.ts`); the UI keeps it in browser `localStorage`
(`src/ui/store.ts`). A slot loads only if its save version (17) and the single global content
version match this build (`deserialize`, `src/sim/save.ts`), and its content references (items,
courses, development nodes, families, casebook recipes) still resolve. An unreadable library is
left untouched, and the older session loader writes a recovery copy before replacing an
unreadable save (`src/sim/session.ts`). A call in progress is stored as an incident id and
regenerated from current content, buildings and compiler at load (`getScenario`,
`src/sim/scenario-registry.ts`), and its debrief re-derives every committed decision's effects
with current logic (`traceRun`, `src/sim/operation.ts`). So any content or engine change can
change a saved call underneath it, which is why the version check rejects.

### Decided (owner, 2026-10-23): a growing catalog with frozen runs

Neither pure option survives sol's third pass. **Pure pinning is rejected**: a campaign that only
sees its starting content can't grow its book. **Pure additive is rejected as drafted**: keeping
call revisions is not enough to keep a run executable, because generation, buildings, the
compiler and the settlement logic all change too. The recommendation is the hybrid sol proposed:

1. **The campaign's catalog grows.** New calls, thread chapters and modules reach existing
   campaigns at safe checkpoints (between calls, never inside one).
2. **A started run is frozen.** On dispatch the save stores the run's whole dependency set: the
   compiled scenario, the map, and an execution-contract version. Committed effects are stored as
   authoritative records, and settlement reads them instead of re-deriving them with current
   logic. A run finishes under the contract it started with, however many releases pass, so there
   is no "keep one old revision" window and no forced unscored close.
3. **Every persisted content reference has a stable identity.** Calls and situations get stable
   ids (not array positions; today a recipe key uses a numeric variant, so reordering situations
   would reinterpret history). Items, courses, development nodes and families that a save can name
   are retained, mapped to a replacement, or tombstoned with defined behavior. A compatibility
   check runs on every content change, not only on schema bumps.
4. **Withdrawn content is the one exception.** A revision withdrawn for safety (the authored-harm
   gap on minors is the example) gets a targeted migration or an explicit interruption settlement
   that accounts for committed harm, consumed resources, reservations, rewards and thread facts.
   Never a fabricated ending.
5. **The whole slot library migrates**, dormant slots, the deleted slot and imports included, by
   forward-only pure functions tested on golden libraries from every shipped build, including
   skipped upgrades, interrupted writes, full storage and continuing a frozen run.
6. **Recovery is a kept generation, not one copy.** Writes are crash-safe (write the new
   generation, verify it loads, then advance the pointer), the last few good generations are kept
   past the first autosave, and a quota failure keeps the old generation and tells the player. A
   restored generation must be loadable by the current build, so recovery runs the migrations too.
7. **No downgrade overwrites,** on every writer: an older build that meets a newer library leaves
   it untouched and says to update (the stale-shell risk in `offline-shell`).
8. **Storage that survives the device's own cleanup.** A second `localStorage` copy dies with the
   first if the WebView's storage is cleared. `store-wrap` chooses durable native storage and a
   recovery path that doesn't share that boundary, validated on real phones through upgrades,
   storage pressure and reinstall.
9. **Purchases are never restored from a campaign.** Entitlements reconcile from the account
   (`real-purchases`) after every migration, import, restore and slot switch; the multiplier
   records inside a save are progress, not proof of purchase.

**Strongest failure mode, from sol:** a save that loads fine under changed rules, silently
reinterprets its committed history, autosaves, and loses its recovery copy. Controls 2, 5 and 6 are
aimed at exactly that, and none is proven until a frozen run is continued across a real upgrade.

**When it turns on.** The dev rule stands until then: saves are disposable (owner, 2026-10-07).
The preservation promise starts at the earliest of the store launch or the first real-money
release. The policy is rehearsed across prelaunch builds on the chosen wrapper before that, and a
demonstrated upgrade and recovery is a launch gate. External playtests are told saves may reset,
but their builds exercise the migration path anyway.

**Work it implies** (backlog items only on the owner's approval): frozen-run snapshots and
authoritative committed effects; stable ids for calls, situations and every persisted content
reference; library-wide migrations with golden saves; generational, crash-safe writes; the
downgrade guard on every writer; durable native storage in `store-wrap`; entitlement
reconciliation. All touch the save shape, an interface change needing the adversarial review in
`COORDINATION.md`.

## 8. Risks and controls

| Risk | Control | Residual |
|---|---|---|
| Synthesized calls are competent and forgettable | Blind reads of every trial output; structure gates before prose | Taste is the owner's |
| Accepted calls cost more than the budget | Accepted-call cost from the trial, including rejects and repair | The thousand-loop goal shrinks |
| Invariants leak | Failing fixture per effect path before any acceptance | New paths need new fixtures |
| Tags mislead | Five levels; requested, verified or reviewed evidence | A reviewer still reads meaning |
| Officers repeat, spiral or vanish | Event-rendered lines; longitudinal sim; history kept after departure | Unmeasured until the callback slice runs |
| Releases erase or reinterpret the book | Growing catalog, frozen runs, generational writes (section 7a) | Unproven until a frozen run survives a real upgrade |
| Store rejection, real-world harm | Sensitive lists; App Review 1.1.2 and 1.1.7 in the ethics screen | Apple's judgment |

## 9. Proposed order

Each step becomes a backlog item only on the owner's approval, and this section is then deleted.

1. **Minimum invariant gate** (engine): each house invariant, its effect paths, a failing fixture
   per path, starting with authored harm on minors. Blocks acceptance of any generated call.
2. **Authoring screening trial** (lead, after `going-live-review` sets the bar). Matched coverage
   briefs, one fixed format (the short call), the same staffing and budget for both arms,
   parameter-led and premise-led. The owner reads **every** output blind in random order, on
   played paths chosen before the reading. Record accepted calls, owner and lead hours, tokens,
   failures and repairs, and the second-play novelty of each accepted call. A screening pilot, not
   proof of scale. `mesh-trial` stays separate: it compares staffing on one brief.
3. **Two thin slices**: one officer callback rendered from a recorded fact through a defined
   renderer (R2, R13, R15), and one persisted follow-up (D2). Each with its own checks.
4. **Held-out production batch** by the winning method, and a repeated-session playtest that
   measures remembered repetition and continuity.
5. Only then: `calls-per-kind`, the smallest catalog and vocabulary the accepted calls justify, the
   director with soft cooldowns, threads, arcs (R3, R12) with the longitudinal sim, packs.

## 10. Owner decisions this needs

1. ~~Save policy for live content~~ **Decided 2026-10-23**: a growing catalog with frozen runs
   (section 7a), promised from the store launch or the first real-money release.
2. Run the invariant gate and the authoring trial before more calls after Going Live.
3. "No child is killed" stays an invariant. Recommended: yes.
4. The sensitive-combination lists.
5. The identity rule in section 6: persona background shapes text under predicates; threads hinge on
   recorded events.
6. Whether the short call format is worth testing at all, or every call stays signature length.

## 11. sol's challenges

All three runs: Codex on its configured default model, `codex-companion.mjs task`, effort high (the third medium),
read-only, 2026-10-23. Each verdict was **needs validation**, and I accept all three.

### First pass, on the first draft

14 findings: 3 block, 10 fix before adopting, 1 note. Two in-memory checks: a minor-death fixture
through authored harm, and tier 1 against tier 5 on one seed.

| # | Claim attacked | Severity | Verdict | What changed |
|---|---|---|---|---|
| 1 | Parameter-led generation rejected without testing its strongest form | block | accepted | Section 2; the trial tests it |
| 2 | Tags are not a generation contract; counts aren't bounded by scale class | fix | accepted | Causal briefs; section 1 corrected |
| 3 | Invariants claimed enforced; authored harm skips the minor clamp | block | accepted | Section 3; step 1 |
| 4 | Play address not unique | block | accepted | Full `IncidentSpec` plus id and revision |
| 5 | Hash conflates logical and artifact identity | fix | accepted | Four identity records |
| 6 | "Behaviorally distinct, measured" isn't measured | fix | accepted | Three separate counts |
| 7 | Premise-wide tags erase situation-level policy | fix | accepted | Five levels |
| 8 | Declared-tag checks invent mechanics | fix | accepted | Necessary implications only |
| 9 | New settings wrongly need a procedural generator | fix | accepted | Spatial capability matching |
| 10 | Wiring floors misread as per call | fix | accepted | Per-call applicable inputs |
| 11 | Empty-set behavior and sign-off undefined | fix | accepted | Section 3; still to specify per tier |
| 12 | Persistence needs binding and a lifecycle | fix | accepted | Section 7 |
| 13 | Infrastructure before the bottleneck test | fix | accepted | Section 9 order |
| 14 | Factual slips | note | accepted | Corrected |

### Second pass, on sizing, officers and the revised draft

14 findings, all fix before adopting.

| # | Claim attacked | Verdict | What changed |
|---|---|---|---|
| 1 | 250 to 300 calls assumes the novelty it needs to prove | accepted | Section 4 labels it inventory arithmetic; S and r measured |
| 2 | Pool = W / c and "eight lines" ignore exposure and clustering | accepted | Schedule simulation; cross-speaker repeats |
| 3 | Hard cooldowns contradict a small launch catalog; scheduling isn't a book | accepted | Soft cooldowns, hard exclusions, causal threads |
| 4 | Format and method conflated; the 1/20 target unsupported | accepted | Format fixed in the trial; cost from the real budget |
| 5 | Monthly releases against save rejection | accepted | Promoted to the first owner decision |
| 6 | "Sixteen officers, 250 calls each" ignores roster, churn, retirement | accepted | Section 6, case 1 |
| 7 | The identity ban is too strict | accepted | Section 6, revised rule |
| 8 | Traits already change at promotion | accepted | One trait writer |
| 9 | Death-spiral controls don't show recovery; restraint rule misstated | accepted | Longitudinal sim; rule 10 restated |
| 10 | Missed failure: losing or misbinding the protagonist | accepted | Facts bound to actors; history after departure |
| 11 | Display-time callbacks move the validation problem | accepted | A defined renderer with its own checks |
| 12 | Five against five, three read each, can't discriminate | accepted | Matched briefs, every output read blind; a screening pilot only; held-out batch and playtest after |
| 13 | The order contradicted its own dependencies | accepted | Invariant gate first; slices before systems |
| 14 | Section 11 overstated the tag fix; provenance isn't proof | accepted | Requested, verified, reviewed evidence |

### Third pass, on the save policy

12 findings: 6 block, 6 fix before adopting. Verdict: needs validation; pure additive viable, but
rejecting a hybrid unsupported. All accepted. Section 7a was rewritten around the hybrid: frozen
runs with stored committed effects (findings 2 to 4), stable ids for every persisted reference
(5, 6), library-wide migrations and generational recovery (7, 8), durable native storage (9),
entitlements from the account (10), a withdrawal exception (11), and a rehearsed policy with the
promise at launch or first real-money release (12). My claim that saves had no backup was wrong:
slots leave unreadable data untouched and the session loader writes a recovery copy.

Not run by any pass: the full test suite, the UI, any production-cost or longitudinal player
experiment.
