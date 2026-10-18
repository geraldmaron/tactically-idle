# Handoff

Live state of the parallel sessions. Only the lead edits this file, and it overwrites stale
entries instead of keeping history. Rules are in `COORDINATION.md`; work to do is in
`docs/backlog.md`.

## Lead

The coordinating session, on `main`. Merged so far: #36 (coordination rules), #37 (`e2e-script`),
#38 (`small-screen-map`), #39 (barricade design sheet), #40 (`gear-by-action`), #41 (rescue design sheet), #42 (`hq-tiles`), #44 (hostage review leftovers, all but B9).

## Lanes

| Lane | Branch | In flight | Declared touches |
|---|---|---|---|
| engine | `claude/engine-intel-odds` | `intel-odds` (with R-B5): approved, in progress. Adds `TreeState.armed` (interface file, approved with a compile-time reveal check and a Codex review). Then `clock-runout-routing`, `barricade-engine-requests`, `second-squad` | `src/sim/threat.ts`, `src/sim/incident-factors.ts`, `trees-v13/compile.ts`, `src/gen/incident/instance.ts`, `src/content/call-trees/types.ts`, `src/architecture/wiring.ts`, tests |
| calls | none | Idle until an engine item lands: the armed-gated hostage line after `intel-odds`; barricade and rescue tree data after their engine Needs | none |
| tooling | `claude/lab-compare` (#43) | `lab-compare`: held for an empty-kit check that the tool detects gear | `src/dev/lab/model/compare.ts` and test, `src/dev/lab/surfaces/play/CompareRail.tsx`, `XrayRail.tsx`, `play.css`, `src/dev/lab/types.ts`, `url.ts` and test |
| interface | to be cut from main | `manager-art`: file list due | to be declared |

## Locks outside normal ownership

None.

## Open questions for the owner

See "Owner decisions" in `docs/backlog.md`.
