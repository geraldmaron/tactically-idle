# Handoff

Live state of the parallel sessions. Only the lead edits this file, and it overwrites stale
entries instead of keeping history. Rules are in `COORDINATION.md`; work to do is in
`docs/backlog.md`.

## Lead

The coordinating session, on `main`. Merged so far: #36 (coordination rules), #37 (`e2e-script`),
#38 (`small-screen-map`), #39 (barricade design sheet), #40 (`gear-by-action`).

## Lanes

| Lane | Branch | In flight | Declared touches |
|---|---|---|---|
| engine | `claude/engine-intel-odds` | `intel-odds` (with R-B5): approved, in progress. Adds `TreeState.armed` (interface file, approved with a compile-time reveal check and a Codex review). Then `clock-runout-routing`, `barricade-engine-requests`, `second-squad` | `src/sim/threat.ts`, `src/sim/incident-factors.ts`, `trees-v13/compile.ts`, `src/gen/incident/instance.ts`, `src/content/call-trees/types.ts`, `src/architecture/wiring.ts`, tests |
| calls | `claude/calls-rescue-model-first` | `rescue-model-first` design sheet. Queued: the armed-gated hostage line after intel-odds merges. Barricade tree data waits on its engine Needs | `docs/calls/rescue-design.md`; later `hostage-signature.ts` |
| tooling | `claude/lab-compare` | `lab-compare`: approved, in progress | `src/dev/lab/model/compare.ts` and test, `src/dev/lab/surfaces/play/CompareRail.tsx`, `XrayRail.tsx`, `play.css`, `src/dev/lab/types.ts`, `url.ts` and test |
| interface | `feat/hq-tiles` | `hq-tiles`: approved, in progress | `src/ui/screens/HQ.tsx`, `hq-overview.css`, new `hq-tiles.test.ts`; `src/sim/incidents.ts` under the lock below |

## Locks outside normal ownership

- `src/sim/incidents.ts` (engine-owned): interface lane, for the `hq-tiles` PR only, limited to adding `max` to `BoardSummary`.

## Open questions for the owner

See "Owner decisions" in `docs/backlog.md`.
