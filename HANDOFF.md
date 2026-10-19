# Handoff

Live state of the parallel sessions. Only the lead edits this file, and it overwrites stale
entries instead of keeping history. Rules are in `COORDINATION.md`; work to do is in
`docs/backlog.md`.

## Lead

The coordinating session, on `main`. Merged so far: #36 (coordination rules), #37 (`e2e-script`),
#38 (`small-screen-map`), #39 (barricade design sheet), #40 (`gear-by-action`), #41 (rescue design sheet), #42 (`hq-tiles`), #43 (`lab-compare`), #44 (hostage review leftovers, all but B9), #45 (`intel-odds` engine work), #46 (`clock-runout-routing` engine work), #49 (`lab-armed-counts` with the armed leaf), #50 (`manager-names-disjoint`), #47 (`manager-art`), #48 (hostage armed line; `intel-odds` complete), #53 (`board-risk-card`), #54 (callCounts test pins), #51 (R-B1), #55 (last-seen lines), #52 (`clock-edges-in-tooling`), #57 (stable string checker), #58 (lab clock lookup), #56 (hostage clock route; `clock-runout-routing` complete), #59 (R-B2), #60 (clock tests on fixtures), #61 (R-B3; `barricade-engine-requests` complete), #63 (`second-squad` engine side, `joint-operation` journey), #65 (`clock-forks-read-travel`), #66 (`exit-via-reachable`), #68 (`moves-skip-pruned`), #67 (owner_down test fixtures), #62 (`hostage-owner-down-cleanup`). #70 closed as a duplicate of #68.

## Lanes

| Lane | Branch | In flight | Declared touches |
|---|---|---|---|
| engine | `claude/engine-tests-off-barricade` | Moving its barricade-order tests onto HOUSE_TREE; also adds an optional template parameter to `generateIncident` (tests only). Then `offsite-fire`, `armed-max`, `rescue-engine-requests` | `src/gen/incident/index.ts`, `house-fixture.ts`, `house-call-fixture.ts`, `instance.test.ts`, `moves.test.ts`, `second-squad.test.ts`, `upstairs.test.ts`, `window-exit.test.ts`, `incident-factors.test.ts`, `meters.test.ts` |
| calls | `claude/calls-barricade-tree` (not pushed) | `barricade-model-first`: prose pass in progress | `barricade-boxes.ts`, `call-trees/index.ts`, `incidents/barricade.ts`; later `second-squad.test.ts` after the engine PR merges |
| tooling | `claude/deploy-disabled-after-injury`; #69 and #64 with the lead | `deploy-disabled-after-injury` (investigating). Then `xray-band-minutes` | `scripts/play-loop.mjs`; #69: `lint-fixture.ts`, `call-trees.test.ts`, `dependencies.test.ts`; #64: `check-strings.ts`, `cross-call.ts`, `shift-sampler.ts`, `coverage.test.ts` |
| interface | closed | Queue finished; worktree idle on merged `feat/board-risk-card` | none |

## Ordering on shared files

- `src/gen/incident/second-squad.test.ts`: the engine lane's barricade-fixture PR merges first; the calls lane switches the `joint-operation` journey there only after it.

## Locks outside normal ownership

None.


## Open questions for the owner

See "Owner decisions" in `docs/backlog.md`.
