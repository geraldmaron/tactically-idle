# Handoff

Live state of the parallel sessions. Only the lead edits this file, and it overwrites stale
entries instead of keeping history. Rules are in `COORDINATION.md`; work to do is in
`docs/backlog.md`.

## Lead

The coordinating session, on `main`. Merged so far: #36 (coordination rules), #37 (`e2e-script`),
#38 (`small-screen-map`), #39 (barricade design sheet), #40 (`gear-by-action`), #41 (rescue design sheet), #42 (`hq-tiles`), #43 (`lab-compare`), #44 (hostage review leftovers, all but B9), #45 (`intel-odds` engine work).

## Lanes

| Lane | Branch | In flight | Declared touches |
|---|---|---|---|
| engine | `claude/engine-clock-runout-routing` | `clock-runout-routing`: built, threading clock targets through graph.ts, dependencies.ts and strings.ts; rebasing onto main. Then the armed leaf for `lab-armed-counts`, `barricade-engine-requests`, `second-squad` | `src/content/incidents/types.ts`, `src/sim/scenario-types.ts` (interface, approved), `compile.ts`, `instance.ts`, `graph.ts`, `dependencies.ts`, `strings.ts`, `clocks.ts`, `operation.ts`, `external-support.ts`, tests |
| calls | to be cut from main | The armed-gated hostage line (merges after `lab-armed-counts`), then `manager-names-disjoint` | to be declared |
| tooling | to be cut from main | `lab-armed-counts` (the lab parts now, the Why leaf after the engine adds it), then `hostage-gate-requests` | to be declared |
| interface | `feat/manager-art` | `manager-art`: approved; emblems first, portraits after the briefs; at most 45 image generations | `public/art/managers/`, `public/art/emblems/`, `scripts/validate-art.mjs`, `src/ui/screens/Develop.tsx`, `development.css`; `docs/art/manager-emblem-expansion/` under the lock below |

## Locks outside normal ownership

- `docs/art/manager-emblem-expansion/` (lead-owned): interface lane, for the `manager-art` PR only.

## Open questions for the owner

See "Owner decisions" in `docs/backlog.md`.
