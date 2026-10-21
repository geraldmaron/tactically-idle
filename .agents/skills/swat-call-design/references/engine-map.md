# Engine map for call designers

The writer's contract with the engine. Sections 1 to 3 and 5 to 7 were revised on 2026-10-18
for the single current version, the v13 call trees. Code moves. Before trusting any line here, re-read the symbol it names. When this file and the code
disagree, the code wins and this file is stale. Every path below comes with a symbol to search
for if the file has moved.

## 1. The lanes

| Lane | Files (search symbol) | What a writer adds |
|---|---|---|
| Call tree (content v13; every tactical call) | `src/content/call-trees/` (`CallTree`, `CALL_TREES`), compiled by `src/gen/incident/trees-v13/compile.ts` (`withCallTree`); gates in `trees-v13/call-trees.test.ts` | One `CallTree`: roles with `{role}` tokens, facts, three situations, nodes and choices with per-band routes, turn groups, endings, and the building types its scene fits. See `docs/call-trees-v13.md` |

Every tactical call is a call tree. The older lanes (typed packages, hand-authored stories,
setting modules, per-version override layers) were deleted on 2026-10-17 with the content versions
they served. Do not design for them.

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
- **Team moves** (`TreeTeam` in `src/content/call-trees/types.ts`, compiled by `movement` in
  `compile.ts`, read 2026-10-18). Every choice that puts officers somewhere declares it:
  `team: { to: 'scene' | { room: role } }` for an entry or a move inside, `{ vantage: 'scene' |
  role }` for the front glass or the back step, `'escort'` with `walks` when officers go in and come
  out with the person. `entry: role` charges that person's distance from the door; `signal:
  { channel: 'voice' | 'visual', to: role }` reads the building, light and weather between the squad
  and that person. The squad's committed position follows the move, so a choice that narrates the
  team inside must declare it, and an outcome that sends the team back writes `back: true`. A phone
  call, a wait or a word from the cars declares nothing (or only a `signal` from where it stands).
  Sheet rows name the room, vantage or escort per choice, never "approach: none" for a choice whose
  text moves the team.
- **What being there teaches** (`src/sim/sightings.ts`, read 2026-10-18). An entry (`to: 'scene' |
  { room }`) observes the room it goes into; a vantage with a `visual` signal observes the room it
  watches. A voice-only vantage, a signal from where the squad stands and an escort observe
  nothing. On a favorable band that doesn't write `back`, everyone still inside an observed room is
  seen: their location fact (`p_<role>`) is confirmed, and the template's weapon fact
  (`knowledge.weapons.learnedBy`) settles to its own truth unless their `readiness` is
  `concealed`. Temper (`knowledge.disposition.learnedBy`) is never settled by sight. So a hidden
  fact a call means to reveal by conversation must not be anyone's `weapons.learnedBy`, and a weapon
  fact must be true in every situation where the person really holds the weapon.
- **Sightline facts.** `TreeFact.sightline: { from, to }` lets the building settle a hidden truth:
  whether an offsite role's window (template `vantage`, `StreetVantage`) sees the door `to`'s way
  out uses. Situations leave the fact out and place the window instead; its `disproved` line must be
  true whatever is in the way (the window frame, a tree, the house's own wall).
- **Conditions.** The template's drawn `conditions` are the compiled call's `environment`: dusk,
  night and the power out dim every sightline, and rain, wind or fog muffle a voice from outside.
- **Incident class.** An expressive hold makes a victim incident: waiting costs and provoking the
  holder costs more (`INCIDENT_CLASS_V1` in `src/sim/incident-factors.ts`).

### Build chain

A call tree passes through `withCallTree` and `bindRoleTokens` in
`src/gen/incident/trees-v13/compile.ts`, then `drawInstance` in `src/gen/incident/instance.ts`
(cast draw, placement). An engineering request names the links it touches. Search each symbol if
the file moved.

## 2. Writer-owned fields

### Call tree fields

The writer-owned shape is `CallTree` in `src/content/call-trees/types.ts`, and `docs/call-trees-v13.md`
explains it. The table below is what the compiler turns it into.

### Compiled `ScenarioDefinition`

| Area | Fields | Contract |
|---|---|---|
| Card | `title`, `summary`, `variantLabel`, `pressureLabel` | `summary` is the hook on the board and the live panel |
| Briefing | `known[]`, `unknown[]`, `dispatchReason`, `teamResponsibilities[]` | Reported facts with `reportedText` join the known lines |
| People | `PersonDefinition` per person. `role` (subject, resident, child, elderly, staff, customer, held_person, patient, dog, dangerous_dog), `label`, `mobility`, `spaceId`, `at`, `threat` {armament, readiness, disposition, intent, awareness} per situation, `reported` for what the briefing claims, `factIds` | Every fact about a person is listed in that person's `factIds`. Sheet row C carries one binding line per person per situation, in the enum spellings below |
| Facts | Required on `FactDefinition`. `id`, `label`, `spaceId`, `truth`, `initial`, `showWhenUnknown`, `claim`, `source`, `note`, `uncertainty`, `markers`. Optional `resolved`, `markerSource`, `storyPersonId` | Markers name the claim, never its source. Prefixes below. An off-map person's fact (a caller, a family next door) still needs a real `spaceId`. Bind it to the corridor or entry it concerns and say which |
| Stages | `label`, `prompt`, `contextPrompts[]` | Exactly three. Context prompts read public state only |
| Actions | `title`, `summary` (`{lead}` becomes the lead officer's surname), `task`, `outcomePreview`, `resultLabels`, `hazardReason`, requirement `reason` strings | Previews describe public doubt and never reveal truth. A summary equal to the favorable preview is hidden |
| Outcomes | `OutcomeEffect`, listed in full below | Truth branches resolve at commit and are never previewed |
| Pressure | `start`, `perMinute`, `threshold`, `civilianPerMinute` | From `CallTree.pressure`. Outcomes add `pressure` deltas |
| Endings | `title`, `summary`, `disposition`, `completion`, `remainingTasks[]`, `trustAdjust`, `strain` | Completion comes from authored conditions, never from a score alone |
| Other | `civilianOutcomes[]` {id, label, factId, safeFlag, injuredFlag, careFlag}, `externalServices[]` with `arrivalMinutes` and `acceptWhen`, `objectives[].label` | One sheet line per civilian outcome, `id | factId | safeFlag | injuredFlag | careFlag | effects that set each`. An ending where a person is hurt sets `injuredFlag` and `careFlag`, never `safeFlag` alone. One `acceptWhen` per service. If two people need different acceptance conditions, define two services, each with its own `requestSupport` effect. For every requested service, name the ending that accepts it, or confirm in `operation.ts` that an unaccepted request leaves no remaining task. A request is not a completion |
| Score | `run.objective`, `run.civilianSafety` | Run score is `0.55 * objective + 0.45 * civilianSafety`, divided by 100 (`operation.ts`, near line 619, read 2026-10-07). Objective starts at 0 and moves only through `objective` deltas. Check how an existing call tree moves `objective` before you rely on a number. A grade claim ("best grade on the walk-out") is backed only when row H lists the objective delta per action per band and row I states the objective each ending reaches on its fastest and slowest path. Trust and strain are roster effects, not the score |

Fact prefixes (`FACT_PREFIX` in `src/sim/scenario-types.ts`).

- `loc:` position, or whether a person is present. Settled by observing the space. v13 compiles
  this as `p_<role>` (sim/sightings.ts).
- `arm:` armament and readiness. Settled only when a favorable action `observes` the room the
  person is in, so it must agree with that person's `threat.armament` in every situation. v13
  points at it with the template's `weapons.learnedBy` tree fact. When
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

Minimum action row. Every action on the sheet is one row per `ActionDefinition`
id, never two actions merged in one column. A merged column is for discussion only.

```
id | stage | title | icon | summary | targetId | task | requires | visibleWhen
check {kind, ratings with weights summing to 1, difficulty} | tempo | workload {base, perSqFt}
approach | observes | stressBase | consequenceLevel
outcomes per band (each effect's fields, including the objective delta)
```

This row is a gate. A row with any blank required column, "as above" or "engine" is incomplete,
and the record counts incomplete rows. Before adding a structural action (withdraw, care,
handover), search `src/gen/incident/trees-v13/compile.ts` and the existing call trees for the
shape it already has, and reuse it.

A cell may say "copy <call tree> <choice id>". It may not say "bound door". Name the opening or
story route. Anchor difficulty to a named reference. The compiler sets a check's difficulty to
`CallTree.difficulty` (default base 31 plus 3 per tier, read in `compile.ts`) plus the choice's
own `check.difficulty`. Label any percentage target "to calibrate", because the engine takes
difficulty and weighted ratings, not odds. A call tree calibrates in the Scenario Lab (`/lab`,
Play's odds and Outcomes) and the balance gate.

## 3. Compiler-owned strings

The compiler adds a few standard lines a writer cannot change in tree data, such as the
generated command line on an entry or concession choice and the consequence lines in
`src/content/incidents/lines.ts` (a drawn hit, who followed a leader who gave up). Read that file
before writing a summary that would repeat one. Changing one is request R1.

What the player can take at each stage is whatever the node offers in the current public state:
two or more exclusive choices, one always takeable (the choices gate in `call-trees.test.ts`).

## 4. Versions

- There is one current content version, the call trees (`CALL_TREE_CONTENT_VERSION` in
  `src/content/call-trees/index.ts`). No content layer is locked. Edit a call in place; old saves are
  rejected, not migrated.
- The only tripwire is `src/gen/incident/trees-v13/compiled-fingerprints.json`, checked by
  `compiled-fingerprints.test.ts`. When a compiled call changes on purpose, recapture it and say why
  in the design record.

## 5. Binding

- Call trees bind role tokens, never names: `{role}` (full name), `{role.first}`, `{role.last}`,
  `{place}` (the building name), and `{lead}` left for the engine in choice summaries. Names come
  from `content/call-trees/civilian-names.ts`, disjoint from the officer catalog. The cast draw is
  `drawInstance` in `src/gen/incident/instance.ts`.
- Pronouns are drawn per person, so write text that reads right as he, she and they (the agreement
  gate in `call-trees.test.ts`).
- A recipe's pacing is `ordinary` or `deliberate_answers`, and every situation is drawn in both.
  For the second, `compile.ts` appends this briefing known line: "Dispatch says
  {role.first} takes a long time to answer. Every conversation with {role.first} takes two extra
  minutes." Conversations with the choice's `talksTo` role then take two extra minutes.
- Row E counts that known line in the 10 second briefing budget, and row M screens it against
  the call's tone. It narrates a mechanic and can misframe a person in crisis. For a crisis call
  (E4), file R9 rather than ship the line.

## 6. Gates

| Gate (where) | Enforces | Does not enforce |
|---|---|---|
| Call-tree gates (`trees-v13/call-trees.test.ts`) | Unique ids, a root and a fallback ending, two or more exclusive choices per node with one always takeable, every band routed forward, every node reachable, marks set and read, entry and concession authority, distinct futures per choice, role tokens and no dashes or stray colons, no gendered word, pronoun agreement, clocks, generation and validation on every hosting building | Whether the choices are real dilemmas, tone, whether the call is worth playing |
| Coverage, dependencies, graph, groups (`trees-v13/*.test.ts`) | Every reachable state resolves and narrates, the dependency index and call graph build, group members are full engine people and lone calls carry no group text | Prose |
| Balance (`call-tree-balance.test.ts`, `balance.test.ts`) | The balance gate's checks played over a sample of calls at tier 2 with day-one squads | Prose |
| Compiled fingerprints (`compiled-fingerprints.test.ts`) | A tripwire: a compiled call changed | That the change was good. Recapture only on purpose |
| Prose lint (`src/gen/incident/gates/prose-lint.ts`, run by `npm run check:strings`) | American spelling, meta phrasing, unsafe detail, unsourced accusation, settled guilt, plus the swat-call-prose checker's house rules on every bound call string | Tone, whether a line names something a person could see |

Run from the repo root.

- `npx vitest run src/gen/incident/trees-v13` runs the call-tree gates.
- `npm run check:strings` binds every template and runs the string checker on it.
- `npm run verify` runs typecheck, tests, the art check and the build before a pull request.
- The human read is the Scenario Lab, `/lab?type=<type>`, under `npm run lab`
  (docs/scenario-lab.md).

Lint lists that collide with tactical writing.

- `UNSAFE_DETAIL` bans words such as gun, firearm, knife, blood, wound, shoot, stab and ammunition
  in lint-checked prose. It can miss compounds such as handgun and gunfire. That is a gap, never
  a license.
- Accusation words (theft, intruder, suspect, assault, threaten, abuse) need a source, a hedge
  or a negation before the check. Arrest, charged, convicted and guilty appear only negated.

## 7. Levers, with the numbers

| Lever | Mechanics |
|---|---|
| Pressure | `CallTree.pressure` {start, perMinute, threshold, civilianPerMinute} and `pressureLabel`. Time only raises it (`advanceTime`, `operation.ts`). Outcomes add `pressure` deltas, and negative ones lower it. Above the threshold `civilianSafety` falls every minute, including after every civilian is safe. A `Condition`'s `pressureAtLeast` reads pressure before that action's minutes, so give any deadline as a range of actions |
| Clocks, meters, authority, groups | Section 1 above. Prefer a clock with a cue as the warning to a bare pressure number |
| `promptIf` | A node's `promptIf` replaces the prompt in a public state, first match wins. Walk each entry state of each node and name the prompt that shows |
| `onlyIf` | Offers a choice only in a public state. A choice never offered anywhere is a dead branch |
| `modifiers` | Earlier choices that make a later check more or less likely, by mark. Name the mark and the value on the sheet |
| Truth on outcomes | `if: { fact, is }` outcomes resolve at commit and are never previewed |
| `deliberate_answers` | Set by the recipe: the briefing line and two extra minutes in section 5. Budget and screen them |
| `officer`, `fire` | `officer: 'wounded' \| 'serious'` for injuries nobody fires; `fire` draws a hit from the subject's weapon, hand, distance and cover. Officer death is not modeled |
| Check `tempo` | `urgent`, `normal` or `waiting` |
| Traits on checks | Resolved per seat in `resolution.ts`. `calm_voice` helps contact checks, `observant` helps observation checks while a report is unresolved, `impatient` is penalized on waiting tempo. Re-read the numbers there before quoting them |

## 8. Known engineering requests

File against these before writing a new one. R2, R3 and R8 belonged to the retired typed
lane and are withdrawn. The worked sheets in design-sheet.md still cite them (and the old R1)
as history.

- R1. Per-call compiler strings (the standard consequence lines), each optional and defaulting
  to today's text.
- R4. Officer story fields (ledger, trait history, leaning, voice markers). Owned by
  swat-officer-stories, whose officer-data-proposal.md numbers its own requests separately.
- R5. A crisis support-line surface in the debrief. Owner decision first (ethics O2).
- R6. A strings export, so prose checks and batch audits read every bound string.
  `callStringRows` in `trees-v13/strings.ts` already feeds `npm run check:strings`; extend it
  rather than adding another.
- R7. A prose-lint extension for dashes, colons, stock phrases, repeated sentences across
  calls and the compound-word loophole.
- R9. A per-type characteristic opt-out, so a crisis call draws only `ordinary` pacing.
- R10. Retired 2026-10-20 with E4.5. A fatal force draw on a crisis subject may reach a death
  ending like any other; `noFatal` stays available when a call's design wants it.
