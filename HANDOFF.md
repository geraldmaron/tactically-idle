# Handoff

Live state of the parallel sessions. Only the lead edits this file, and it overwrites stale
entries instead of keeping history. Rules are in `COORDINATION.md`; work to do is in
`docs/backlog.md`.

## Lead

The coordinating session, on `main`. Merged so far: #36 (coordination rules), #37 (`e2e-script`),
#38 (`small-screen-map`), #39 (barricade design sheet), #40 (`gear-by-action`), #41 (rescue design sheet), #42 (`hq-tiles`), #43 (`lab-compare`), #44 (hostage review leftovers, all but B9), #45 (`intel-odds` engine work), #46 (`clock-runout-routing` engine work), #49 (`lab-armed-counts` with the armed leaf), #50 (`manager-names-disjoint`), #47 (`manager-art`), #48 (hostage armed line; `intel-odds` complete), #53 (`board-risk-card`).

## Lanes

| Lane | Branch | In flight | Declared touches |
|---|---|---|---|
| engine | `claude/engine-rb1-upstairs` | `barricade-engine-requests`: R-B1 (upstairs), then R-B2 (`walksVia`), R-B3 (TreePlace). Queued: `armed-max`, `second-squad` | `types.ts` (interface, approved), `compile.ts`, `story-bindings.ts`, tests |
| calls | none | Next: the hostage clock's `onOut.next` once `clock-edges-in-tooling` merges. Barricade and rescue tree data wait on their engine Needs | none |
| tooling | to be cut from main | `clock-edges-in-tooling` next, then `hostage-gate-requests`; the e2e flake is recorded in `e2e-in-ci` | to be declared |
| interface | closed | Session closed after `board-risk-card`. Start a fresh interface session for the next interface item | none |

## Locks outside normal ownership


## Open questions for the owner

See "Owner decisions" in `docs/backlog.md`.
