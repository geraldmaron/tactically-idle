# Handoff

Live state of the parallel sessions. Only the lead edits this file, and it overwrites stale
entries instead of keeping history. Rules are in `COORDINATION.md`; work to do is in
`docs/backlog.md`.

## Lead

The coordinating session, on `main`. Merged so far: #36 (coordination rules), #37 (`e2e-script`),
#38 (`small-screen-map`), #39 (barricade design sheet), #40 (`gear-by-action`), #41 (rescue design sheet), #42 (`hq-tiles`), #43 (`lab-compare`), #44 (hostage review leftovers, all but B9), #45 (`intel-odds` engine work), #46 (`clock-runout-routing` engine work), #49 (`lab-armed-counts` with the armed leaf), #50 (`manager-names-disjoint`), #47 (`manager-art`), #48 (hostage armed line; `intel-odds` complete), #53 (`board-risk-card`), #54 (callCounts test pins), #51 (R-B1), #55 (last-seen lines), #52 (`clock-edges-in-tooling`), #57 (stable string checker), #58 (lab clock lookup), #56 (hostage clock route; `clock-runout-routing` complete), #59 (R-B2), #60 (clock tests on fixtures), #61 (R-B3; `barricade-engine-requests` complete), #63 (`second-squad` engine side, `joint-operation` journey), #65 (`clock-forks-read-travel`), #66 (`exit-via-reachable`), #68 (`moves-skip-pruned`), #67 (owner_down test fixtures), #62 (`hostage-owner-down-cleanup`). #70 closed as a duplicate of #68. #71 (hostage repro test), #69 (barricade and squad pins), #64 (`hostage-gate-requests`), #72 (`deploy-disabled-after-injury`), #73 (engine tests off barricade-order), #74 (`xray-band-minutes`), #75 (house fixture guard).

## Checkpoint (owner, 2026-10-19)

Each lane finishes its current item, the lead merges it, and the lane stops for the owner to reassess: engine after `short-squad-deploys`, tooling after `e2e-in-ci`, calls parked. The lead notifies the owner when all three are stopped and merged.

## Lanes

| Lane | Branch | In flight | Declared touches |
|---|---|---|---|
| engine | `engine-lane-2` session | Scenario work paused: parking `barricade-engine-fixes` (WIP, no PR). Queue: `short-squad-deploys`, `sidearms-day-one`, `peer-support-lead`, `recruiter`, `patrol-work` (design note first), `meters-drift`, `less-lethal-cartridges`, `manager-pronouns` | to be declared per item |
| calls | `claude/calls-barricade-tree` at 9b2847e (parked, stopped) | Stopped at the checkpoint. Parked: the new tree after the first writing review and the prose pass (check:strings exits 0), calibration rows for the new endings (trust floor unchanged), and the joint-operation journey switched to the barricade. Not done: the Codex retirement review and the reviewer's re-read (stopped before their verdicts), deleting barricade-order.ts, the turn_hall.watch change, the intel-floor list, civilian-hit lines and design-doc records | none |
| tooling | parked `claude/tooling-rescue-pins` | Scenario work paused: rescue rows and barricade tooling fixes parked as WIP. Queue: `e2e-in-ci`, the `scale-gates` harness | to be declared |
| interface | closed | Start a fresh interface session for the Command Staff cards once the engine defines the new managers | none |

## Ordering on shared files

- `src/gen/incident/second-squad.test.ts`: the engine lane's fixture PR (#73) has merged, so the calls lane may switch the `joint-operation` journey there in the barricade PR (one-PR lock), along with the barricade rows in `src/sim/outcome-score.test.ts`.

## Locks outside normal ownership

None.


## Open questions for the owner

See "Owner decisions" in `docs/backlog.md`.
