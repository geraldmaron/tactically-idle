# Handoff

Live state of the parallel sessions. Only the lead edits this file, and it overwrites stale
entries instead of keeping history. Rules are in `COORDINATION.md`; work to do is in
`docs/backlog.md`.

## Lead

The coordinating session, on `main`. Merged so far: #36 (coordination rules), #37 (`e2e-script`),
#38 (`small-screen-map`), #39 (barricade design sheet), #40 (`gear-by-action`), #41 (rescue design sheet), #42 (`hq-tiles`), #43 (`lab-compare`), #44 (hostage review leftovers, all but B9), #45 (`intel-odds` engine work), #46 (`clock-runout-routing` engine work).

## Lanes

| Lane | Branch | In flight | Declared touches |
|---|---|---|---|
| engine | `claude/engine-armed-req-leaf` (rebasing), then `claude/engine-rb1-upstairs` | The armed ReqLeaf (merges with tooling's `lab-armed-counts`), then `barricade-engine-requests` as R-B1, R-B2 (`walksVia`), R-B3 (TreePlace with a declared room kind) | `types.ts` (interface, approved per request), `compile.ts`, `story-bindings.ts`, `instance.ts`, `incident-factors.ts`, `sightings.ts`, `threat.ts`, `drawn-effects.ts`, `clocks.ts`, tests |
| calls | `claude/calls-hostage-armed-line` | The hostage armed line, as a design change (team_glass opened to group calls), with design gates first. Merges after `lab-armed-counts`. Then `manager-names-disjoint` | `hostage-signature.ts`, `docs/calls/hostage-signature-design.md` |
| tooling | `claude/lab-armed-counts`, stacked on the engine's armed leaf | `lab-armed-counts` (merges with the engine leaf), then `clock-edges-in-tooling`, then `hostage-gate-requests` | `src/dev/lab/model/session.ts`, `why.ts`, `script.ts`, new `armed-counts.test.ts` |
| interface | `feat/manager-art` | `manager-art`: approved; emblems first, portraits after the briefs; at most 45 image generations | `public/art/managers/`, `public/art/emblems/`, `scripts/validate-art.mjs`, `src/ui/screens/Develop.tsx`, `development.css`; `docs/art/manager-emblem-expansion/` under the lock below |

## Locks outside normal ownership

- `docs/art/manager-emblem-expansion/` (lead-owned): interface lane, for the `manager-art` PR only.

## Open questions for the owner

See "Owner decisions" in `docs/backlog.md`.
