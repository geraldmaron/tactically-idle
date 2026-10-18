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
| engine | `claude/engine-clock-runout-routing` | `clock-runout-routing`: built, rebasing onto main to open its PR. Then the armed leaf (`{ kind: 'armed'; role; min? }`) for `lab-armed-counts`, `barricade-engine-requests`, `second-squad` | as in its PR |
| calls | `claude/calls-hostage-armed-line` | The hostage armed line, as a design change (team_glass opened to group calls), with design gates first. Merges after `lab-armed-counts`. Then `manager-names-disjoint` | `hostage-signature.ts`, `docs/calls/hostage-signature-design.md` |
| tooling | `claude/lab-armed-counts` | `lab-armed-counts`: approved. Then `clock-edges-in-tooling` after the engine clock PR merges, then `hostage-gate-requests` | `src/dev/lab/model/session.ts`, `why.ts`, `script.ts`, maybe `surfaces/script/index.tsx`, new `armed-counts.test.ts` |
| interface | `feat/manager-art` | `manager-art`: approved; emblems first, portraits after the briefs; at most 45 image generations | `public/art/managers/`, `public/art/emblems/`, `scripts/validate-art.mjs`, `src/ui/screens/Develop.tsx`, `development.css`; `docs/art/manager-emblem-expansion/` under the lock below |

## Locks outside normal ownership

- `docs/art/manager-emblem-expansion/` (lead-owned): interface lane, for the `manager-art` PR only.

## Open questions for the owner

See "Owner decisions" in `docs/backlog.md`.
