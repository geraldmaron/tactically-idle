# Handoff

Live state of the parallel sessions. Only the lead edits this file, and it overwrites stale
entries instead of keeping history. Rules are in `COORDINATION.md`; work to do is in
`docs/backlog.md`.

## Lead

The coordinating session, on `main`. Merged so far: #36 (coordination rules), #37 (`e2e-script`),
#38 (`small-screen-map`), #39 (barricade design sheet), #40 (`gear-by-action`), #41 (rescue design sheet), #42 (`hq-tiles`), #43 (`lab-compare`), #44 (hostage review leftovers, all but B9).

## Lanes

| Lane | Branch | In flight | Declared touches |
|---|---|---|---|
| engine | `claude/engine-intel-odds` (#45) | `intel-odds`: ready; the lead integrates it with tooling's explore.test.ts fix. Next `clock-runout-routing`, `barricade-engine-requests`, `second-squad` | as declared in #45 |
| calls | none | Manager briefs delivered. Next, once `intel-odds` merges: the armed-gated hostage line, then `manager-names-disjoint` | none |
| tooling | `claude/tooling-explore-intel-odds` (from #45's head) | Fixing explore.test.ts for #45. Then `hostage-gate-requests` | `src/dev/lab/model/explore.test.ts`; maybe `session.ts`, `why.ts` |
| interface | `feat/manager-art` | `manager-art`: approved; emblems first, portraits after the briefs; at most 45 image generations | `public/art/managers/`, `public/art/emblems/`, `scripts/validate-art.mjs`, `src/ui/screens/Develop.tsx`, `development.css`; `docs/art/manager-emblem-expansion/` under the lock below |

## Locks outside normal ownership

- `docs/art/manager-emblem-expansion/` (lead-owned): interface lane, for the `manager-art` PR only.

## Open questions for the owner

See "Owner decisions" in `docs/backlog.md`.
