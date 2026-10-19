# Handoff

Live state of the parallel sessions. Only the lead edits this file, and it overwrites stale
entries instead of keeping history. Rules are in `COORDINATION.md`; work to do is in
`docs/backlog.md`.

## Lead

The coordinating session, on `main`. Merged so far: #36 (coordination rules), #37 (`e2e-script`),
#38 (`small-screen-map`), #39 (barricade design sheet), #40 (`gear-by-action`), #41 (rescue design sheet), #42 (`hq-tiles`), #43 (`lab-compare`), #44 (hostage review leftovers, all but B9), #45 (`intel-odds` engine work), #46 (`clock-runout-routing` engine work), #49 (`lab-armed-counts` with the armed leaf), #50 (`manager-names-disjoint`), #47 (`manager-art`), #48 (hostage armed line; `intel-odds` complete), #53 (`board-risk-card`), #54 (callCounts test pins), #51 (R-B1), #55 (last-seen lines), #52 (`clock-edges-in-tooling`), #57 (stable string checker), #58 (lab clock lookup), #56 (hostage clock route; `clock-runout-routing` complete), #59 (R-B2), #60 (clock tests on fixtures), #61 (R-B3; `barricade-engine-requests` complete), #63 (`second-squad` engine side, `joint-operation` journey), #65 (`clock-forks-read-travel`), #66 (`exit-via-reachable`), #68 (`moves-skip-pruned`), #67 (owner_down test fixtures), #62 (`hostage-owner-down-cleanup`). #70 closed as a duplicate of #68. #71 (hostage repro test), #69 (barricade and squad pins), #64 (`hostage-gate-requests`), #72 (`deploy-disabled-after-injury`), #73 (engine tests off barricade-order), #74 (`xray-band-minutes`), #75 (house fixture guard), #78 (`short-squad-deploys` engine side).

## Checkpoint (owner, 2026-10-19)

Reached 2026-10-19: every lane is stopped and every finished item is merged. Calls and tooling stopped with hand-over briefs (calls-lane-handover.md, tooling-handover.md in the lead's side-session notes); engine lane 2 stopped after #78. Parked, not merged: the barricade (`claude/calls-barricade-tree` 9b2847e), its engine fixes (`claude/engine-barricade-blockers` 965859b), tooling drafts #76 and #77.

When work resumes, calls and tooling restart as fresh sessions from their hand-over briefs (owner, 2026-10-19); the current calls and tooling sessions retire.

## Lanes

| Lane | Branch | In flight | Declared touches |
|---|---|---|---|
| engine | `claude/engine-resume`, PR #79 (open); parked `claude/engine-barricade-blockers` at 965859b | Resumed 2026-10-19: shipped `clock-only-marks`, `manager-pronouns`, `sidearms-day-one`, `less-lethal-cartridges`, `short-squad-ui`, the engine side of `peer-support-lead`, `recruiter` and `meters-drift`, the `e2e-in-ci` workflow, owner UI feedback (HQ money and status row, tabs, briefing focus, live officer strip) and the Command Staff hiring pool (`docs/staff-hiring.md`, save version 10). Waiting on owner answers: `patrol-work` (`docs/patrol-work.md`). Scenario items stay paused | none |
| calls | `claude/calls-barricade-tree` at 9b2847e (parked, stopped) | Stopped at the checkpoint. Parked: the new tree after the first writing review and the prose pass (check:strings exits 0), calibration rows for the new endings (trust floor unchanged), and the joint-operation journey switched to the barricade. Not done: the Codex retirement review and the reviewer's re-read (stopped before their verdicts), deleting barricade-order.ts, the turn_hall.watch change, the intel-floor list, civilian-hit lines and design-doc records | none |
| tooling | parked as draft PRs #76 (rescue pins) and #77 (barricade blockers) | Stopped at the checkpoint before `e2e-in-ci`: context too heavy. Hand-over brief written for a fresh tooling session | none |
| interface | closed | The Command Staff cards and candidate compare shipped on `claude/engine-resume` (owner request) | none |

## Branches and worktrees (reconciled 2026-10-19)

Every merged or patch-equivalent branch is deleted, locally and on GitHub, and every extra worktree
is removed. What remains: `main`, `claude/engine-resume` (PR #79) and the four parked branches named
in the table (`claude/calls-barricade-tree`, `claude/engine-barricade-blockers`, and the draft PRs
#76 and #77). Fresh lane sessions start new worktrees from `main`.

## Ordering on shared files

- `src/gen/incident/second-squad.test.ts`: the engine lane's fixture PR (#73) has merged, so the calls lane may switch the `joint-operation` journey there in the barricade PR (one-PR lock), along with the barricade rows in `src/sim/outcome-score.test.ts`.

## Locks outside normal ownership

None.


## Open questions for the owner

See "Owner decisions" in `docs/backlog.md`.
