# Handoff

Live state of the parallel sessions. Only the lead edits this file, and it overwrites stale
entries instead of keeping history. Rules are in `COORDINATION.md`; work to do is in
`docs/backlog.md`.

## Lead

The coordinating session, on `main`. Merged so far: #36 (coordination rules), #37 (`e2e-script`),
#38 (`small-screen-map`).

## Lanes

| Lane | Branch | In flight | Declared touches |
|---|---|---|---|
| engine | `claude/engine-gear-by-action-1f8272` | `gear-by-action`: done on its branch, rebasing onto main to open its PR. Next `intel-odds` (with R-B5), `clock-runout-routing`, `barricade-engine-requests`, `second-squad` | `src/gen/incident/action-gear.ts` and test, `trees-v13/compile.ts`, `src/architecture/wiring.ts` |
| calls | `claude/calls-barricade-model-first-b60068` | `barricade-model-first`: design sheet done (d7a4d50, not pushed). Tree data waits on the engine items in its Needs | `docs/calls/barricade-design.md` |
| tooling | none yet | Next `lab-compare` | to be declared |
| interface | none yet | Next `hq-tiles` | to be declared |

## Locks outside normal ownership

None. The tooling lane's lock on `README.md` lines 65 to 67 ended when #37 merged.

## Open questions for the owner

See "Owner decisions" in `docs/backlog.md`.
