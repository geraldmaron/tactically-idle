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
| interface | `feat/hq-tiles` | `hq-tiles`: file list under review | to be approved |

## Locks outside normal ownership

None. The tooling lane's lock on `README.md` lines 65 to 67 ended when #37 merged.

## Open questions for the owner

See "Owner decisions" in `docs/backlog.md`.
