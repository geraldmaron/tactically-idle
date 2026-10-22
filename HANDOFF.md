# Handoff

Live state of the parallel sessions. Only the lead edits this file, and it overwrites stale
entries instead of keeping history. Rules are in `COORDINATION.md`; work to do is in
`docs/backlog.md`.

## Lead

The coordinating session, on `main`. Merged so far: #36 (coordination rules), #37 (`e2e-script`),
#38 (`small-screen-map`), #39 (barricade design sheet), #40 (`gear-by-action`), #41 (rescue design sheet), #42 (`hq-tiles`), #43 (`lab-compare`), #44 (hostage review leftovers, all but B9), #45 (`intel-odds` engine work), #46 (`clock-runout-routing` engine work), #49 (`lab-armed-counts` with the armed leaf), #50 (`manager-names-disjoint`), #47 (`manager-art`), #48 (hostage armed line; `intel-odds` complete), #53 (`board-risk-card`), #54 (callCounts test pins), #51 (R-B1), #55 (last-seen lines), #52 (`clock-edges-in-tooling`), #57 (stable string checker), #58 (lab clock lookup), #56 (hostage clock route; `clock-runout-routing` complete), #59 (R-B2), #60 (clock tests on fixtures), #61 (R-B3; `barricade-engine-requests` complete), #63 (`second-squad` engine side, `joint-operation` journey), #65 (`clock-forks-read-travel`), #66 (`exit-via-reachable`), #68 (`moves-skip-pruned`), #67 (owner_down test fixtures), #62 (`hostage-owner-down-cleanup`). #70 closed as a duplicate of #68. #71 (hostage repro test), #69 (barricade and squad pins), #64 (`hostage-gate-requests`), #72 (`deploy-disabled-after-injury`), #73 (engine tests off barricade-order), #74 (`xray-band-minutes`), #75 (house fixture guard), #78 (`short-squad-deploys` engine side).

## UI redesign and paid details (2026-10-22, local only)

Branch `claude/angry-edison-cae68b`, never pushed (owner: keep everything local). It holds, in
order: the UI/UX audit and the Desk and Street plan (`docs/ui-ux-audit.md`, challenged by Codex);
`claude/eager-elgamal-f0ef34` up to basic kit (3e000c9); ui-system (tokens, primitives, design
ratchets in `src/ui/design-floors.test.ts`); the icon set and kit (`docs/visual-kit.md`); tap to
earn reworked as paid details (save version 17); the Standard-only stall lift (f94343d); the desk
(chrome contract `src/ui/components/chrome.tsx`, four tabs HQ, Calls, Officers, Build, the menu
sheet); and the calls flow (say it once, `src/ui/screens/call-flow.ts` for the Prepare draft, Step
out with `src/ui/decision-pause.ts`). Merged session branches, kept until the owner merges this
branch: `claude/ui-foundation-579f13`, `claude/ui-icons-1dabc9`, `claude/tap-earn-04b5ba`,
`claude/ui-desk-3faeef`, `claude/ui-calls-2b2638`. Not merged: `claude/research-hook-patterns`
(hook-pattern research, 27991db). Hand-over notes for each session are in the coordinator's notes
folder (`side-session-notes/local_84175eba-883f-4193-9563-55d0b4c16aa9/`). Next: `visual-story`
(the redesign removed art and icons and adopted the kit once), then `ui-leftovers`. The dev server
for this branch runs on port 5181; port 5173 holds the owner's own older save.

## Checkpoint (owner, 2026-10-19)

Reached 2026-10-19: every lane is stopped and every finished item is merged. Calls and tooling stopped with hand-over briefs (calls-lane-handover.md, tooling-handover.md in the lead's side-session notes); engine lane 2 stopped after #78. Parked, not merged: the barricade (`claude/calls-barricade-tree` 9b2847e), its engine fixes (`claude/engine-barricade-blockers` 965859b), tooling drafts #76 and #77.

When work resumes, calls and tooling restart as fresh sessions from their hand-over briefs (owner, 2026-10-19); the current calls and tooling sessions retire.

## Lanes

| Lane | Branch | In flight | Declared touches |
|---|---|---|---|
| engine | none in flight; `claude/engine-barricade-blockers` lands in #80 | #79 merged 2026-10-19 (sidearms, cartridges, Command Staff hiring pool, meter drift, owner UI feedback). Open: `outcome-calibration-drift` (found while reconciling the barricade), `patrol-work` waits on owner answers. Scenario items stay paused | none |
| calls | `claude/calls-barricade-tree` (up to date with `main` and #80, not merged) | Parked. Blocked on `outcome-calibration-drift` (its branch reads trust MAE 0.80 against 0.75) and on its open writing review: the Codex retirement review and the reviewer's re-read. Also not done: deleting barricade-order.ts, the turn_hall.watch change, the intel-floor list, civilian-hit lines and design-doc records | none |
| tooling | draft PRs #76 and #77 land through #80 | Rescue pins and the barricade tree's tooling blockers are reconciled with `main`. Left on `barricade-tooling-fixes`: confirm the Flow endings at 390 and 430 | none |
| interface | `claude/angry-edison-cae68b` (local) | The Desk and Street redesign and paid details, above. Next items: `visual-story`, `ui-leftovers` | none |

## Branches and worktrees (reconciled 2026-10-19)

Merged and patch-equivalent branches are deleted locally and on GitHub, and extra worktrees are
removed. #79 and #80 merged. What stays: `main`; `claude/calls-barricade-tree`, which waits on
`outcome-calibration-drift` and its writing review; and `claude/department-ux-pass` (lead, owner
request 2026-10-19), one branch for the department UX pass across engine and interface files while
no lane runs: squad edits during a call, the funding ledger and live finance view, starter kit,
one Disclosure, the Armory, the hire contract, the Develop track, officer learning and instructor
details, and the officer profile. Save version 11. It touches `src/content/recruits.ts` (calls lane)
for the issue-kit price; the calls lane rebases on it before its next content change.

## Ordering on shared files

- `src/gen/incident/second-squad.test.ts`: the engine lane's fixture PR (#73) has merged, so the calls lane may switch the `joint-operation` journey there in the barricade PR (one-PR lock), along with the barricade rows in `src/sim/outcome-score.test.ts`.

## Locks outside normal ownership

None.


## Open questions for the owner

See "Owner decisions" in `docs/backlog.md`.
