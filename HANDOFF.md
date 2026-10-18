# Handoff

Live state of the parallel sessions. Only the lead edits this file, and it overwrites stale
entries instead of keeping history. Rules are in `COORDINATION.md`; work to do is in
`docs/backlog.md`.

## Lead

The coordinating session, on `main`. Merged so far: #36 (coordination rules), #37 (`e2e-script`),
#38 (`small-screen-map`), #39 (barricade design sheet), #40 (`gear-by-action`), #41 (rescue design sheet), #42 (`hq-tiles`), #43 (`lab-compare`), #44 (hostage review leftovers, all but B9), #45 (`intel-odds` engine work), #46 (`clock-runout-routing` engine work), #49 (`lab-armed-counts` with the armed leaf), #50 (`manager-names-disjoint`), #47 (`manager-art`).

## Lanes

| Lane | Branch | In flight | Declared touches |
|---|---|---|---|
| engine | `claude/engine-rb1-upstairs` | `barricade-engine-requests`: R-B1 (upstairs), then R-B2 (`walksVia`), R-B3 (TreePlace). Queued: `armed-max`, `second-squad` | `types.ts` (interface, approved), `compile.ts`, `story-bindings.ts`, tests |
| calls | `claude/calls-hostage-armed-line` (#48) | The hostage armed line: sent back for the lone-only reason, the dominance grid, an engine-agreement test, balance numbers and a Codex review | `hostage-signature.ts`, `docs/calls/hostage-signature-design.md` |
| tooling | to be cut from main | `clock-edges-in-tooling` next, then `hostage-gate-requests`; the e2e flake is recorded in `e2e-in-ci` | to be declared |
| interface | to be cut from main | `board-risk-card`: file list due; any new producer goes to the engine lane as a request | to be declared |

## Locks outside normal ownership

None.

## Open questions for the owner

See "Owner decisions" in `docs/backlog.md`.
