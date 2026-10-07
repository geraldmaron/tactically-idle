# Engine dry-run

Run this before the verdict on any call that is designed but not built, and on a built call whose
tests did not load it. A design can read well and still be impossible to build, or built so the
engine grades it backwards. The proof round on 2026-10-07 passed a design with missing objective
deltas, actions the validator would reject, prompts with no written condition and person values
outside the engine's types. The self-review's record said "every effect uses listed fields,
exceptions none". Listing the field names is not a dry-run. Applying the rules is.

The engine facts below were read in the repo on 2026-10-07. Re-read the source before relying on
a number, and search the symbol named in each step if a file moved. The field list writers own
is in ../swat-call-design/references/engine-map.md section 2. This file does not copy it.

Every failed rule here is a block routed to swat-call-design, or to engineering when the shape
the call needs does not exist. None of them is a note.

## 1. Validation rules against every action row

Open `validateScenario` in src/sim/operation.ts and walk its rules one by one against each action
row of the sheet. Record each rule that applies.

```
| Action | Rule, quoted from the validator | Row value | Passes |
| wait_out | acceptance requires its available receiving service | acceptSupport [ems], requires none | no |
```

Rules the proof rounds broke, to check first.

1. An outcome with `acceptSupport` needs `requires.externalSupport` naming that service with
   status `available` and a reason. "Requires none" on such an action fails.
2. One action cannot both request and accept the same service.
3. Every service id in `requestSupport`, `acceptSupport`, `awaitSupport` and `personCare` is one
   id declared in `externalServices`, spelled the same everywhere on the sheet. Two spellings of
   one service (`ems` against `v13_leash_ems`) is a failed rule.
4. Force needs an execution check, a bound person and a matching required capability.
5. Person values match the types in src/sim/scenario-types.ts (search `export type Armament`).
   On 2026-10-07 they were these.

```
Armament         none | blunt | edged | handgun | long_gun | unknown
Readiness        concealed | carried | brandished
Disposition      cooperative | distressed | intoxicated | agitated | hostile | in_crisis
Intent           unaware | escape | barricade | harm_self | harm_others
PoliceAwareness  unaware | suspicious | aware
```

A value outside its type is a block. So is a sheet that leaves armament unchosen ("armed").
Armament decides what the map shows and must agree with any force option's kind, and it is the
one value engineering cannot guess.

## 2. The score on the fastest and slowest path

A run starts at objective 0 and civilian safety 100. `outcomeFactor` in src/sim/operation.ts
scores it as 0.55 times objective plus 0.45 times civilian safety, over 100. Shipped stories set
`objective: 100` on the completing effect (see src/gen/incident/stories-v5 for the pattern).

1. For each ending, take the fastest and slowest path from the static walk.
2. Sum every objective and civilian safety delta on that path, including pressure losses after
   the threshold, and state the score.
3. Compare. The ending the design calls best must score at least as well as every worse one.

```
| Ending | Path | Minutes | Objective | Civilian safety | Score | Design calls it |
| opens_door | fastest | 57 | 0 | 100 | 45 | best |
```

No effect that sets objective means every ending caps at 45, and the design's grade claims rest on
nothing the engine computes. A force or entry ending that is fastest by a wide margin is also an
ethics finding under E2, because in an idle game minutes are the real currency.

## 3. Context prompts, in the order the engine reads them

`currentStoryPrompt` in src/sim/story-context.ts shows the first entry in a stage's
`contextPrompts` whose `when` holds, then falls back to the stage prompt.

1. For each stage, list the prompts in order with their exact `when` objects. A prompt named
   without a written `when` is a block, since nobody can build it unambiguously.
2. For each way into the stage from the static walk, name the prompt that shows.
3. A prompt that never shows because an earlier one always matches first is shadowed, and a
   block. Observed in a proof draft. A "called again" prompt sat after "silent" while the silent
   flag stayed set, so it could never appear.

```
| Stage | Entry state | Prompts in order, with when | Shows | Shadowed |
```

## 4. Objectives and completion against the paths

Read `objectives[].label`, `remainingTasks` and `civilianOutcomes` labels beside the effects that
complete them. A task that completes on a path where its precondition never happened (neighbors
"kept clear" when they never moved) is the honesty fault in path-and-honesty-checks.md section 11,
found here from the data side. Record it once, in that section's table.

## Record line

```
- Engine dry-run: rules <applied n, failed n> | enums <checked n, invalid n, armament <value | unchosen>> | score <best ending n%, worst ending n%, best outscores worse <yes | no>> | prompts <n, unwritten when n, shadowed n> | not applicable, built and loaded by tests
```

If you cannot read the engine source, say so in the record. The verdict cannot then be approve
for an unbuilt call.
