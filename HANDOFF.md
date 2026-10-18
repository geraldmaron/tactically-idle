# Handoff

Live state of the parallel sessions. Only the lead edits this file, and it overwrites stale
entries instead of keeping history. Rules are in `COORDINATION.md`; work to do is in
`docs/backlog.md`.

## Lead

The coordinating session, on `main`. Merged so far: #36 (coordination rules), #37 (`e2e-script`),
#38 (`small-screen-map`), #40 (`gear-by-action`).

## Lanes

| Lane | Branch | In flight | Declared touches |
|---|---|---|---|
| engine | to be cut from main | `intel-odds` (with R-B5): reading, file list due. Then `clock-runout-routing`, `barricade-engine-requests`, `second-squad` | to be declared |
| calls | `claude/calls-barricade-model-first-b60068` (#39) | `barricade-model-first`: design sheet in #39, sent back to fix one path citation. Tree data waits on the engine items in its Needs. Rescue design sheet started | `docs/calls/barricade-design.md`, `docs/calls/rescue-design.md` |
| tooling | `claude/lab-compare` | `lab-compare`: approved, in progress | `src/dev/lab/model/compare.ts` and test, `src/dev/lab/surfaces/play/CompareRail.tsx`, `XrayRail.tsx`, `play.css`, `src/dev/lab/types.ts`, `url.ts` and test |
| interface | `feat/hq-tiles` | `hq-tiles`: approved, in progress | `src/ui/screens/HQ.tsx`, `hq-overview.css`, new `hq-tiles.test.ts`; `src/sim/incidents.ts` under the lock below |

## Locks outside normal ownership

- `src/sim/incidents.ts` (engine-owned): interface lane, for the `hq-tiles` PR only, limited to adding `max` to `BoardSummary`.

## Open questions for the owner

See "Owner decisions" in `docs/backlog.md`.
