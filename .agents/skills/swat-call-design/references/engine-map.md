# Engine map for call designers

The writer's contract with the engine, read from the source on 2026-10-06 at content v12. Code
moves. Before trusting any line here, re-read the symbol it names. When this file and the code
disagree, the code wins and this file is stale. Every path below comes with a symbol to search
for if the file has moved.

## 1. The lanes

| Lane | Files (search symbol) | What a writer adds |
|---|---|---|
| Call tree (content v13; every tactical call) | `src/content/call-trees/` (`CallTree`, `CALL_TREES`), compiled by `src/gen/incident/trees-v13/compile.ts` (`withCallTree`); gates in `trees-v13/call-trees.test.ts` | One `CallTree`: roles with `{role}` tokens, facts, three situations, nodes and choices with per-band routes, turn groups, endings, and the building types its scene fits. See `docs/call-trees-v13.md` |
| Typed framework package | `src/content/incident-frameworks-v9.ts` (`ADDITIONAL_FRAMEWORKS`, `IncidentFramework`), compiled by `src/gen/incident/frameworks-v9.ts` (`withAdditionalFramework`) | One appended `IncidentFramework` entry, plus the type id, cast slot, placement affinity and catalog entry listed in `docs/content-pipeline.md` |
| Hand-authored story | `src/gen/incident/stories-v5/` (`withVersionFiveStory`, `STORY_ARCHETYPES`), variants in `stories-v6/`, second choices in `decisions-v8/choices-v12.ts` (`withSecondChoicesV12`) | A full `ScenarioDefinition` graph (`src/sim/scenario-types.ts`) |
| Setting module | `src/content/setting-modules.ts` (`SettingModule`), `src/content/setting-modules-armed.ts` (`ArmedIncidentProse`), compiler `stories-v6/setting-modules-v11.ts` (`SETTING_MODULES_V11`) | Per-setting prose and room roles for an existing story. Never actions, flags or endings |
| Version-gated override | `src/content/framework-depth-v12.ts` (`FRAMEWORK_DEPTH_V12`, `frameworkAt`) | Structure or text that applies only from a new content version |

Today the setting-module lane is used only by the armed incident ("After the Noise"), in
retail, office, warehouse and motel buildings.

### Call tree state the engine runs (v13, read 2026-10-07)

Search the symbol if the file moved. The design brief is `docs/incident-domain-model.md`.

- **Clocks** (`Clock` in `src/content/incidents/types.ts`, engine `src/sim/clocks.ts`). A
  template situation sets a clock's start and rate (drawn per call within `rateSpread`). The
  operation's minutes run it. Each cue, highest first, fires once as it passes: a result line,
  an optional `mark` and an optional `reveal` of the clock's fact. A cue whose mark is already
  set, or whose fact is already settled, stays silent. A clock stops once its `owner` is out.
- **Clock forks.** A tree outcome writes `if: { clock: 'door', out: true }` (it has run out)
  or `if: { clock: 'oxygen', low: true }` (its first cue has fired), read at the end of the
  choice's own minutes for its band plus the outcome's `minutes`. A clock never runs out before
  the team heard one of its cues in an earlier decision; design the cue as the warning. A clock
  the situation doesn't have is never low or out. Gates: both sides of a fork in each band, a
  reveal cue's text equals the fact's line for the situation's truth, cue marks are read.
- **Rate facts vs events.** Keep "will the door hold" as a fact (asking reveals the rate) and
  write "the door gives" as a clock fork. A `story: true` clock (the barricade battery) is
  modelled for the lab and left to the tree's own outcomes.
- **Meters** (`src/sim/meters.ts`, `METERS_V1`). Subjects carry agitation and rapport. A tree
  outcome writes `moves: { taker: 'provoked' }` (events: heard, contact, honest, provoked,
  team_seen, shots, released), scaled by the subject's drawn volatility. Every later contact
  check with that subject shows what moved since the call began as two contributors. Do not
  add mood modifiers ("He hung up on you"); write the event. Marks stay for facts the team
  learned and for prompts that need them.
- **Authority** (`src/sim/authorization.ts`, slice 4). An entry or concession choice declares
  `authority: 'entry' | { concede }`. The engine locks it until a threat to life is seen
  (`TreeFact.threat`, `CallTree.threatMarks`) or an `urgent` clock is low, and the card shows the
  generated command line. Never write "Command approves it because" in a summary or prompt.
  Concessions never offered: weapon, transport, officer swap, family. A `promise` on an outcome is
  a commitment: an entry or force while it is open breaks it.
- **Scoring** (`src/sim/outcome-score.ts`). Endings carry title, summary and disposition only;
  trust and strain are scored from people's end states. Review belongs in the debrief.
- **Groups** (slice 5). A template slot with a count range binds its first person to the key role
  (the leader) and the rest to a counted tree role (`CallTree.groups`, e.g. `others`). Tokens:
  `{others}` (names), `{others.first}` (the member nearest the team), `{others.n}`, pronoun forms
  (plural when two or more), `{others#stands|stand}` after the names, `{others~stands|stand}`
  after a pronoun, `{others^…}` only under `count: { max: 1 }`. Put group lines behind
  `TreeState.count: { role, min?, max? }`; the compiler drops what a call's size can't reach, and
  everything without a count must read right in a lone call. `out`/`safe`/`harm`/`moves` on a
  group mean every member; `fire`/`force`/`talksTo` on a group mean the member nearest the door.
- **Cascade.** `cascade: { leader, group, next: { all, some, none } }` where the leader gives up:
  each member follows by influence, rapport and agitation, and a standard line names who did.
- **Meter branches.** `if: { meter: 'taker', stance: 'breaking' }` (or `agitationAtLeast`, and
  `is: false` to negate), read at the start of the decision. "The truth decides, or a subject past
  breaking point does it anyway" is three outcomes: truth true; truth false and breaking; truth
  false and not breaking. Every truth × meter × clock combination needs exactly one routed
  outcome per band (the coverage gate, `trees-v13/coverage.test.ts`).
- **Clocks running out.** `Clock.onOut: { harm, mark }` records harm to the owner still inside when
  the clock runs out where no fork reads it, and sets the mark for prompts. Both sides of a clock
  fork must carry the same `minutes`.
- **Incident class.** An expressive hold makes a victim incident: waiting costs and provoking the
  holder costs more (`INCIDENT_CLASS_V1` in `src/sim/incident-factors.ts`).

### The hand-authored build chain

A hand-authored call passes through every link below. An engineering request names the links
it touches. Search each symbol if the file moved.

1. `STORY_ARCHETYPES` (`stories-v5/`). The type needs an entry.
2. `planEpisode` (`stories-v6/episode-plan.ts`). Its `CAST` map throws "No compatible episode
   recipe" for an unlisted type. It also builds the environment, and on 2026-10-06 set
   `keyholder` true only for `medical_complication`. A `keyholder` action or an `env:
   ['keyholder']` requirement needs that rule changed for the new type, which is a request.
3. Variant modules applied at build per `EpisodePlan.variant` (0, 1, 2), for example
   `applyHighRiskVariation` in `stories-v6/high-risk-variants.ts`, with `welfare-variants.ts`
   and `care-privacy-variants.ts` beside it. Text that differs between situations with the same
   truth lives here, never in a truth branch.
4. `withSecondChoicesV12` (`decisions-v8/choices-v12.ts`) from content v12.
5. `withVersionNineCast` (`cast-v9`) binds names from content v9.

## 2. Writer-owned fields

### Typed lane, `IncidentFramework`

The compiler reuses several fields. Design each one for every place it lands.

| Field | Where the player meets it | Contract |
|---|---|---|
| `title` | Card title and variant label | 34 characters at most |
| `name` | Person fact label, civilian outcome, binding source | The authored full name, replaced at binding |
| `role` | Author and cast metadata. The compiler did not print it as read | One plain phrase |
| `dispatch` | "Why your team was sent" | 240 characters at most |
| `opening` | Card summary (the hook) and briefing known line 1 | Name in the first five words; hook in about 130 characters |
| `question` | Stage 1 prompt, briefing unknown, fact uncertainty, the unfinished call's remaining task | 120 characters at most, because it is a stage prompt |
| `factLabel` | Label of the disputed point on the map and people panel | 40 characters at most |
| `approaches[0..1]` | Stage 1 choice titles (first account, independent source) | The lint wants the person's first name in `approaches[0]` or `verify`, so pacing has a conversation to land on |
| `approachResults[0..1]` | Result text after each approach, all bands | The turn is usually planted here. Same in every situation |
| `verify` | Stage 2 check title | A contact step. Naming the person here satisfies the pacing rule |
| `claim` | The disputed point's text in the fact panel | Sourced, never settled before the check |
| `confirmed`, `disproved` | Revealed by the check | Post-check only. Never echoed before it |
| `resolutions[0..1]` | Stage 3 titles, and the ending titles | Only the one matching the checked answer is shown |
| `results[0..1]` | Choice summary, favorable preview, result text and ending summary | Must read as a plan before and as an ending after |
| `moveOn` | Which answer walks the person out | `confirmed`, `disproved` or `neither` |
| `variants[0..2]` | Author notes, shown only on the story sheet | Never printed in game |
| `truth[0..2]` | Whether the claim holds in each situation | Situations 1 and 2 must differ |
| `precaution` | Stage 1 early step, and a slower late step in stage 3 | Early always costs time; late can fail |
| `waitFor` | Stage 3 slow close | Its result must read true on both sides of the truth |
| `corroborate` | Stage 3 follow-ups before one resolution | Its summary is shown on both follow-ups |
| `actOnReport` | Stage 2 gamble, with `wrong` read after a wrong guess | Keep `assume` on the side that does not walk the person out |

### Hand-authored lane, `ScenarioDefinition`

| Area | Fields | Contract |
|---|---|---|
| Card | `title`, `summary`, `variantLabel`, `pressureLabel` | `summary` is the hook on the board and the live panel |
| Briefing | `known[]`, `unknown[]`, `dispatchReason`, `teamResponsibilities[]` | Reported facts with `reportedText` join the known lines |
| People | `PersonDefinition` per person. `role` (subject, resident, child, elderly, staff, customer, held_person, patient, dog, dangerous_dog), `label`, `mobility`, `spaceId`, `at`, `threat` {armament, readiness, disposition, intent, awareness} per situation, `reported` for what the briefing claims, `factIds` | Every fact about a person is listed in that person's `factIds`. Sheet row C carries one binding line per person per situation, in the enum spellings below |
| Facts | Required on `FactDefinition`. `id`, `label`, `spaceId`, `truth`, `initial`, `showWhenUnknown`, `claim`, `source`, `note`, `uncertainty`, `markers`. Optional `resolved`, `markerSource`, `storyPersonId` | Markers name the claim, never its source. Prefixes below. An off-map person's fact (a caller, a family next door) still needs a real `spaceId`. Bind it to the corridor or entry it concerns and say which |
| Stages | `label`, `prompt`, `contextPrompts[]` | Exactly three. Context prompts read public state only |
| Actions | `title`, `summary` (`{lead}` becomes the lead officer's surname), `task`, `outcomePreview`, `resultLabels`, `hazardReason`, requirement `reason` strings | Previews describe public doubt and never reveal truth. A summary equal to the favorable preview is hidden |
| Outcomes | `OutcomeEffect`, listed in full below | Truth branches resolve at commit and are never previewed |
| Pressure | `start`, `perMinute`, `threshold`, `civilianPerMinute` | A real clock lives only here |
| Endings | `title`, `summary`, `disposition`, `completion`, `remainingTasks[]`, `trustAdjust`, `strain` | Completion comes from authored conditions, never from a score alone |
| Other | `civilianOutcomes[]` {id, label, factId, safeFlag, injuredFlag, careFlag}, `externalServices[]` with `arrivalMinutes` and `acceptWhen`, `objectives[].label` | One sheet line per civilian outcome, `id | factId | safeFlag | injuredFlag | careFlag | effects that set each`. An ending where a person is hurt sets `injuredFlag` and `careFlag`, never `safeFlag` alone. One `acceptWhen` per service. If two people need different acceptance conditions, define two services, each with its own `requestSupport` effect. For every requested service, name the ending that accepts it, or confirm in `operation.ts` that an unaccepted request leaves no remaining task. A request is not a completion |
| Score | `run.objective`, `run.civilianSafety` | Run score is `0.55 * objective + 0.45 * civilianSafety`, divided by 100 (`operation.ts`, near line 619, read 2026-10-07). Objective starts at 0 and moves only through `objective` deltas. Existing stories put `objective: 100` on the completing care effect (search `objective: 100` in `stories-v5/`). A grade claim ("best grade on the walk-out") is backed only when row H lists the objective delta per action per band and row I states the objective each ending reaches on its fastest and slowest path. Trust and strain are roster effects, not the score |

Fact prefixes (`FACT_PREFIX` in `src/sim/scenario-types.ts`).

- `loc:` position, or whether a person is present. Settled by observing the space.
- `arm:` armament and readiness. Settled only when a favorable action `observes` the room the
  person is in, so it must agree with that person's `threat.armament` in every situation. When
  they disagree, nobody has decided which wins, so never let them. Any other effect whose text
  settles armament ("his hands were empty", "he was holding it") carries an explicit
  `knowledge` entry for that fact, or the map marker stays open after the text has answered it.
- `cond:` disposition, intent and awareness only. Injury, fear and motive are not `cond:` facts.
  Model them as flags, a story fact without an engine prefix, or `civilianOutcomes`.
- `use:` what a room is used for.

Threat enums, quoted from `src/sim/scenario-types.ts` (search `export type Armament`). Row C
uses only these spellings.

- Armament `none | blunt | edged | handgun | long_gun | unknown`
- Readiness `concealed | carried | brandished`
- Disposition `cooperative | distressed | intoxicated | agitated | hostile | in_crisis`
- Intent `unaware | escape | barricade | harm_self | harm_others`
- Awareness (`PoliceAwareness`) `unaware | suspicious | aware`

Armament is a concrete value even when the prose keeps the weapon vague, and it agrees with the
`arm:` fact and with any `forceProfile.kind`. A contract item marked "not checked" makes the
record's contract-read line partial, never answered.

People who move. Every ending or result that moves a person (walks out, carried down, leaves
with family) names its `StoryPersonBinding` transition on row C as `{when, to, observed}`, where
`to` is a story anchor or `{kind: 'offscene', label}`.

What a requirement can test (`ActionRequirements`), and nothing else.

- `certs` (all required, each held by a participating officer), `anyTags`, `allTags`
- `minSquads`, `facts`, `flags`, `notFlags`, `openings`
- `env` (`cctv`, `keyholder`), `externalSupport`, `storyProps`, `responsivePeople`

There is no role requirement, and role does not enter resolution. Condition keys are ANDed,
with no OR. For either-or, set one derived flag in every outcome that satisfies either branch
and test that flag. For an either-or cert, use `certBonus` or file a request.

The OR scan. No cell may contain the word "or" inside a `when`, `visibleWhen` or `requires`.
Rewrite it as one condition on a derived flag, or as complementary `notFlags` so at most one
effect matches. Worked case from a proof run. "{when ben_offer_closed or ben_held} sets
sig_ben_safe" split into two effects fires twice, because the flag that closes the offer is set
only while `ben_held` is still set, and the text prints twice. The repair is one effect with
`{flags: ['sig13_ben_held'], notFlags: ['sig_ben_safe']}`.

`Condition` has `facts`, `flags`, `notFlags`, `pressureAtLeast` and `pressureBelow`, all ANDed.

`OutcomeEffect` fields in full. `officerHarm`, `officerCare`, `requestSupport`,
`acceptSupport`, `truth`, `reveal`, `when`, `knowledge`, `setFlags`, `clearFlags`,
`objective`, `civilian`, `pressure`, `extraMinutes`, `openings`, `storyExitState`, `stage`,
`ending`, `text`. Strain and trust exist only on endings (`EndingDefinition.strain`,
`trustAdjust`). A per-step strain needs its own ending or a request.

- There is no epilogue field. An epilogue line is `{ when: {flags: [...]}, text }` appended to
  the band.
- `forceProfile`, `awaitSupport`, `visibleWhen`, `modifiers`, `commandOnly` and `personCare`
  are action fields, never effect fields.
- When `when` is read. Every `when` in a band is tested against the state before the band
  applies (`matchedEffects`, `operation.ts`, called before `advanceTime` near line 841 on
  2026-10-07). A flag set in the same band never satisfies a later `when` in that band, and a
  `pressureAtLeast` inside an effect reads pressure before this action's minutes are added.
  `visibleWhen` and context prompts read the state after the last commit.
- Dead flags. Every flag a band sets is read by at least one later `Condition` (`visibleWhen`,
  `modifiers.when`, `contextPrompts.when`, an effect `when`, a requirement or ending
  completion). A flag with no reader is decoration.

### `validateScenario` rules a design must meet

Quoted from `validateScenario` in `src/sim/operation.ts` on 2026-10-07. Re-read before relying
on them.

1. Any action whose outcomes `acceptSupport` X carries `requires.externalSupport` with
   `{serviceId: X, status: 'available', reason}` ("acceptance requires its available receiving
   service"). That also locks the action until X has arrived.
2. A request and an acceptance never sit on the same action.
3. An action whose outcomes request support never sets `ending` or `objective` in that band.
4. In resolve, every band has one effect with `ending` or `stage: 'resolve'` and no `when` or
   `truth`.
5. A `care_accepted` ending carries `completion.acceptedServiceId`, and a full-completion
   disposition carries authored completion conditions.
6. The fallback ending `handed_over` exists and is `unresolved`.
7. Force needs an `execution` check, a V7 bound person and a matching equipment capability.
8. Service ids are written exactly as in `externalServices`, never as shorthand ("ems" against
   "v13_leash_ems" fails).

Minimum action row. Every hand-authored action on the sheet is one row per `ActionDefinition`
id, never two actions merged in one column. A merged column is for discussion only.

```
id | stage | title | icon | summary | targetId | task | requires | visibleWhen
check {kind, ratings with weights summing to 1, difficulty} | tempo | workload {base, perSqFt}
approach | observes | stressBase | consequenceLevel
outcomes per band (each effect's fields, including the objective delta)
```

This row is a gate. A row with any blank required column, "as above" or "engine" is incomplete,
and the record counts incomplete rows. Before adding a structural action (withdraw, care,
handover), search `src/gen/incident/high-risk-common-v4.ts` (`partialHR`) and the v6 to v12
layers for a helper or a deliberate removal. The v6 layer hides the high-risk exit card on
purpose (search "hiding the current exit card" in `high-risk-variants.test.ts`). Reuse the
helper, or name the layer you reverse and why.

A cell may say "copy v5 <action id>". It may not say "bound door". Name the opening or story
route. Anchor difficulty to a named reference. On 2026-10-06 high-risk calls used
`31 + tier * 3` (`high-risk-v4.ts`) and typed framework checks `28 + tier * 3`
(`frameworks-v9.ts`). Label any percentage target "to calibrate on /story.html", because the
engine takes difficulty and weighted ratings, not odds.

## 3. Compiler-owned strings on typed calls

Quoted from `withAdditionalFramework` and checked in the compiled v12 burglary call. A writer
cannot change these in package data. Changing them is request R1.

| String | Where it shows |
|---|---|
| Stage labels "assess", "adapt", "resolve" | The stage step label |
| "Check the disputed point in person." | Stage 2 prompt, and the check's summary opening |
| "Act on what you checked and what the people involved agreed to." | Stage 3 prompt |
| "Check the disputed point before acting on it." and "Act only on what the people involved agree to." | Team responsibilities |
| "Start with the people involved. Knowing what they want makes the agreed next step more likely to go smoothly." | First-account summary |
| "Start with an independent source. It makes the later check more reliable but takes one extra minute." | Independent-source summary |
| "Dispatch places {name} in {room} at {building}." | Briefing known line 2 |
| "The first report left something out. Check an independent source before deciding the disputed point." | Briefing, situation 3 only |
| "The first check is inconclusive. Arrange a second check." | Check, adverse |
| "The agreed step falls through for now. What you checked stays on record, but the step is not done." | Resolution, adverse |
| "The same agreed step, done with a delay." and "The step falls through and stays unfinished." | Resolution previews, mixed and adverse |
| "Response unfinished" with "The team could not carry out an agreed next step. The call stays open for follow-up." | The failed-response ending |
| "Time to check accounts" | Pressure label |
| "Check the account before choosing a response." | Fact note |
| "REPORTED", "CHECKED", "CORRECTED" | Map markers |
| "Hear the first account", "Check the disputed point", "Carry out the agreed next step" | Objectives |

Two consequences for design.

- The stage 1 costs are compiler text. A writer sets the approach titles and results, so a
  stage 1 dilemma needs `precaution` or R1.
- The situation 3 line appears only in situation 3. All eight v9 frameworks use truth
  `[true, false, true]`, and `fall_at_home` also has `truth[2]` true, so on 2026-10-06 that
  line meant "the claim holds" in 9 of 11 typed frameworks. A returning player can learn it.
  Set a new framework's `truth[2]` against that majority and record the count.

What the player can take at each typed stage (v12, observed in the burglary call).

| Stage | Choices on screen |
|---|---|
| 1 | Both approaches, plus `precaution` if present |
| 2 | The check, a second check after a first failure, plus `actOnReport` before the check starts |
| 3 | The resolution matching the answer, plus `waitFor`, a late precaution if needed, and corroborate follow-ups |

## 4. Version freezing

- `INCIDENT_CONTENT_VERSION` in `src/gen/incident/index.ts` was 12 on 2026-10-06.
- Issued fingerprint suites on that date were `issued-v9.test.ts`, `issued-v10.test.ts` and
  `issued-v11.test.ts`, with their JSON files, plus older v4 and v6 to v8 fingerprint files. No
  v12 suite existed. Whether v12 prose can still change is the owner's call.
- Issued output is hashed whole, prose included. Change one character of an issued entry and
  the suite fails.
- `frameworkAt(type, contentVersion)` applies the v12 depth layer from v12 on, and adds only
  fields the package does not define. Replacing a defined field needs R2.
- A new framework type is valid only from the version that introduces it.

## 5. Binding

- Call trees (v13) bind role tokens, never names: `{role}` (full name), `{role.first}`, `{role.last}`,
  `{place}` (the building name), and `{lead}` left for the engine in choice summaries. Names come
  from `content/call-trees/civilian-names.ts`, disjoint from the officer catalog. The rest of this
  section covers the older lanes.

- `withVersionNineCast` draws names by pronoun set and replaces the authored full name and
  first name as whole words, case-sensitive. Use the authored name verbatim.
- A cast first name that is also a capitalized word gets renamed. A slot named Grant renames a
  sentence that opens with the verb "Grant".
- No name from the pools may appear outside the cast, so callers, dispatchers and patrol stay
  unnamed in typed calls.
- The v9 eight frameworks use singular they. New frameworks set pronouns in the cast slot, and
  every field must agree.
- A recipe's pacing is `ordinary` or `deliberate_answers`, and every situation is drawn in
  both. For the second, `applyRecipeCharacteristic` (`characteristics-v9.ts`) does three
  things. It appends this briefing known line, verbatim. "Dispatch says {name} likes to think
  before answering. Each conversation with {name} takes two extra minutes." It adds two
  minutes to each contact check that names the person, matched on the title for typed
  frameworks and on the title or summary for every other type. It appends " Allow extra time
  for {name} to answer." to those summaries.
- Row E counts that known line in the 10 second briefing budget, and row M screens it against
  the call's tone. It narrates a mechanic and can misframe a person in crisis. For a crisis call
  (E4), file R9 rather than ship the line.
- The American spelling bridge runs before names bind.

## 6. Gates (`src/gen/incident/gates/`)

| Gate (symbol) | Enforces | Does not enforce |
|---|---|---|
| Prose lint (`lintFrameworkData`, `lintScenario`, `LENGTH_BUDGETS`, `UNSAFE_DETAIL`) | American spelling, meta phrasing, four-word spoilers, lengths, names, pronouns, unsafe detail, unsourced accusation, settled guilt | Dashes, colons, stock phrases, tone, cross-framework repetition. It runs on typed packages only |
| Distinctness (`fingerprintById`, `collisions`) | Every v11 or later recipe differs from all others in a decision or ending | Prose. Two calls with different words and the same paths collide |
| Choices (`thinStages`) | Two or more takeable choices at every stage entry | Whether the choices are real dilemmas |
| Playability (`hostingReport`, `frameworkJourneys`) | Binding, squad reach, 30 percent hosting, journeys to completion and failure with save and reload | Whether the call is worth playing |
| Catalog and engine driver (`gateFrameworks`, `startGateRun`) | Which frameworks the gates see, and live runs | Anything about writing |

Run from the repo root.

- `npx vitest run content-gates content-playability` runs the two gate files.
- `npx vitest run issued-` runs the issued suites. Both filters were checked with
  `vitest list` on 2026-10-06.
- `npm run verify` runs typecheck, tests, the art check and the build before a pull request.
- The human read is the story sheet, `/story.html?type=<type>`, under `npm run dev`.

Lint lists that collide with tactical writing, as read on 2026-10-06.

- `UNSAFE_DETAIL` bans words such as gun, firearm, knife, blood, wound, shoot, kill, suicide,
  overdose, restrain, handcuff, baton, unconscious and "not breathing" in typed prose. Its
  pattern misses compounds such as handgun and gunfire. That is a gap, never a license.
- Accusation words (theft, intruder, suspect, assault, threaten, abuse) need a source, a hedge
  or a negation before the check. Arrest, charged, convicted and guilty appear only negated.

## 7. Levers, with the numbers

| Lever | Lane | Mechanics as read |
|---|---|---|
| `precaution` | typed, v11 on | Example "Have the crew stage at the corner before the check" (civilians never move closer to an unresolved weapon, E12.2). Early step in stage 1. The resolution for `requiredFor` needs it. Late version in stage 3 has more workload and can fail, blocking that resolution |
| `waitFor` | typed, v11 on | Stage 3 close that completes on every band, with more workload, longer on worse bands, and trust 0 instead of 1 |
| `corroborate` | typed, v11 on | The resolution for `for` needs both accounts. Missed ones become stage 3 follow-ups |
| `actOnReport` | typed, v12 on | Stage 2, before the check. Right, the call closes a step early with trust 0. Wrong, objective falls 10, pressure rises 12, three minutes pass and `wrong` is shown. It does not inherit the matching resolution's precaution |
| Pressure | typed | Fixed at start 5, 0.1 a minute, threshold 95. No clock |
| Pressure block | hand-authored | Time only raises it (`advanceTime`, `operation.ts`). Only effect deltas lower it. Above the threshold `civilianSafety` falls every minute, including after every civilian is safe, and the debrief prints "Time pressure passed <threshold> during <title>". An effect's `pressureAtLeast` reads pressure before that action's minutes, so give any deadline as a range of action commits, never one minute, and confirm it on `/story.html`. If pressure stands in for a story deadline, (a) every `pressureAtLeast` prompt or option carries `notFlags` for the deadline-passed flag, (b) any action that can add more than (threshold minus expected pressure) divided by perMinute minutes after the people are safe carries a pressure drop or ends the call first, and (c) the sheet states expected pressure at each stage entry on the fastest and slowest paths |
| `contextPrompts` | hand-authored | The engine shows the FIRST entry whose `when` holds, else the stage prompt (`story-context.ts`, `contextPrompts?.find`). The sheet gives one line per prompt as `index | exact Condition {flags, notFlags, facts, pressure} | prompt key`, in array order. List the most specific state first, then walk each entry state of each stage and name the prompt that shows. A prompt no state reaches is shadowed |
| `truth` on effects | hand-authored | Branches resolved at commit, never previewed |
| `externalServices` | hand-authored | A service with public `arrivalMinutes`, accepted only when `acceptWhen` holds. One `acceptWhen` per service. Track its state (not requested, en route, arrived, accepted) on every path to every ending. Build notes never change the service list |
| `deliberate_answers` | both, set by the recipe | The briefing line, two extra minutes and the summary sentence in section 5. Budget and screen them |
| `officerHarm`, `officerCare` | hand-authored | `wounded` or `serious`, with a label. Officer death is not modeled |
| Check `tempo` | hand-authored | `urgent`, `normal` or `waiting` |
| Traits on checks | hand-authored | Quoted from `resolution.ts` near line 756, per seat. `calm_voice` +6 on contact checks. `observant` +6 on observation checks while a report is unresolved. `impatient` -5 on waiting tempo, and +4 on any other tempo when `run.pressure` is 50 or more, so the pressure block decides when impatient turns positive |

## 8. Known engineering requests

File against these before writing a new one. None existed as a field on 2026-10-06.

- R1. Per-framework compiler strings. Stage 2 and 3 prompts, responsibilities, approach and
  check summaries, adverse and preview texts, the unfinished ending and the acted-on-report
  ending title, each optional and defaulting to today's text.
- R2. Field replacement from a new version. `frameworkAt` adds only missing fields, so a
  rewritten issued `opening` or `results` cannot ship until a layer may replace a field.
- R3. A clock for typed calls. An optional pressure override with a stated reason.
- R4. Officer story fields (ledger, trait history, leaning, voice markers). Owned by
  swat-officer-stories, whose officer-data-proposal.md numbers its own requests separately.
- R5. A crisis support-line surface in the debrief. Owner decision first (ethics O2).
- R6. A strings export, so prose checks and batch audits read every bound string.
- R7. A prose-lint extension for dashes, colons, stock phrases, repeated sentences across
  frameworks, the compound-word loophole and the hand-authored lane.
- R8. Context prompts for typed calls, so a rejoined stage can name the earlier choice.
- R9. A per-type characteristic opt-out, so a crisis call draws only `ordinary` pacing.
- R10. A force outcome map for crisis calls, so a fatal force draw resolves to the
  transported-with-the-medic-working ending (E4.5) and never to a death card.
