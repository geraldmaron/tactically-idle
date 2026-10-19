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
| engine | `claude/engine-tests-off-barricade` | Moving its barricade-order tests onto HOUSE_TREE. Then `offsite-fire`, `armed-max`, `rescue-engine-requests` | engine tests, new `house-fixture.ts` |
| calls | `claude/calls-barricade-tree` | `barricade-model-first`: prose pass, then rebase, rerun generation and push. Then the hostage repro test (now unblocked by #62) | as declared |
| tooling | #69, #64 open | #69 (barricade and squad pins) and #64 (`hostage-gate-requests`) are with the lead. Next `deploy-disabled-after-injury`, then `xray-band-minutes` | as declared |
| interface | closed | Session closed after `board-risk-card`. Start a fresh interface session for the next interface item | none |

## Locks outside normal ownership

None.


## Open questions for the owner

See "Owner decisions" in `docs/backlog.md`.
