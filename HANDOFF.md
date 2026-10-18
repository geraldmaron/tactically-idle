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
| calls | `claude/calls-hostage-armed-line` (#48) | The hostage armed line: controls met (glass_group as its own choice). Moving its test into the call-trees folder and bumping one pinned count, then the lead merges | `hostage-signature.ts`, `docs/calls/hostage-signature-design.md`, new `src/content/call-trees/hostage-glass.test.ts`; one line of `dependencies.test.ts` under the lock below |
| tooling | to be cut from main | `clock-edges-in-tooling` next, then `hostage-gate-requests`; the e2e flake is recorded in `e2e-in-ci` | to be declared |
| interface | `feat/board-risk-card` | `board-risk-card`: approved; writes its own selector under the lock below. This session closes when the item merges | `src/ui/screens/OpsBoard.tsx`, `CallTile.tsx`, `ops-visual.css`, new `board-suggestions.test.ts`; new `src/sim/board-suggestions.ts` under the lock |

## Locks outside normal ownership

- `src/sim/board-suggestions.ts` and its test (new, engine layer): interface lane, for `board-risk-card`; plus at most one no-behavior-change extraction in `src/sim/operation-selectors.ts`.
- `src/gen/incident/trees-v13/dependencies.test.ts` line 52 (tooling-owned): calls lane, for #48 only, the hostage situation reader count 134 to 136.

## Open questions for the owner

See "Owner decisions" in `docs/backlog.md`.
