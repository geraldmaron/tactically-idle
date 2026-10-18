# Handoff

Live state of the parallel sessions. Only the lead edits this file, and it overwrites stale
entries instead of keeping history. Rules are in `COORDINATION.md`; work to do is in
`docs/backlog.md`.

## Lead

The coordinating session, on `main`. Merged so far: #36 (coordination rules), #37 (`e2e-script`),
#38 (`small-screen-map`), #39 (barricade design sheet), #40 (`gear-by-action`), #41 (rescue design sheet), #42 (`hq-tiles`), #43 (`lab-compare`), #44 (hostage review leftovers, all but B9), #45 (`intel-odds` engine work), #46 (`clock-runout-routing` engine work), #49 (`lab-armed-counts` with the armed leaf), #50 (`manager-names-disjoint`), #47 (`manager-art`), #48 (hostage armed line; `intel-odds` complete), #53 (`board-risk-card`), #54 (callCounts test pins), #51 (R-B1), #55 (last-seen lines), #52 (`clock-edges-in-tooling`), #57 (stable string checker), #58 (lab clock lookup), #56 (hostage clock route; `clock-runout-routing` complete).

## Lanes

| Lane | Branch | In flight | Declared touches |
|---|---|---|---|
| engine | `claude/engine-rb2-walks-via`, then `claude/engine-rb3-moves` | R-B2 (`walksVia`, `exitOpeningId`): rebasing onto main to open its PR. R-B3 (TreePlace, moves, last seen) in progress. Queued: `armed-max`, `second-squad` | as in each PR |
| calls | to be cut from main | `hostage-owner-down-cleanup` now. Barricade tree parts once R-B2 (#59) merges | to be declared |
| tooling | to be cut from main | `hostage-gate-requests` next, then `scale-gates` (harness), `fire-follows-building` after `offsite-fire` | to be declared |
| interface | closed | Session closed after `board-risk-card`. Start a fresh interface session for the next interface item | none |

## Locks outside normal ownership


## Open questions for the owner

See "Owner decisions" in `docs/backlog.md`.
