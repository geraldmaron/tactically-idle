# Handoff

Live state of the parallel sessions. Only the lead edits this file, and it overwrites stale
entries instead of keeping history. Rules are in `COORDINATION.md`; work to do is in
`docs/backlog.md`.

## Lead

The coordinating session, on `main`. Merged so far: #36 (coordination rules), #37 (`e2e-script`),
#38 (`small-screen-map`), #39 (barricade design sheet), #40 (`gear-by-action`), #41 (rescue design sheet), #42 (`hq-tiles`), #43 (`lab-compare`), #44 (hostage review leftovers, all but B9), #45 (`intel-odds` engine work), #46 (`clock-runout-routing` engine work), #49 (`lab-armed-counts` with the armed leaf), #50 (`manager-names-disjoint`), #47 (`manager-art`), #48 (hostage armed line; `intel-odds` complete), #53 (`board-risk-card`), #54 (callCounts test pins), #51 (R-B1), #55 (last-seen lines), #52 (`clock-edges-in-tooling`), #57 (stable string checker), #58 (lab clock lookup), #56 (hostage clock route; `clock-runout-routing` complete), #59 (R-B2), #60 (clock tests on fixtures), #61 (R-B3; `barricade-engine-requests` complete).

## Lanes

| Lane | Branch | In flight | Declared touches |
|---|---|---|---|
| engine | `claude/engine-rb4-second-squad` (stacked on #61) | `second-squad` (R-B4): approved, with a one-PR lock on `src/architecture/journeys.ts` for the `joint-operation` entry. Then `offsite-fire`, `armed-max`, `rescue-engine-requests` | `types.ts` (interface, approved), `compile.ts`, maybe `resolution.ts` and `operation.ts`, new `second-squad.test.ts`, `journeys.ts` under the lock |
| calls | `claude/calls-hostage-owner-down-cleanup` | Dropping the dead owner_down mark (merges after the engine and tooling fixture PRs). Barricade tree parts covered by R-B1 and R-B2 can start | `hostage-signature.ts`, `hostage.ts`, design doc |
| tooling | `claude/hostage-gate-requests` | `hostage-gate-requests` (coverage key B, A behind a flag). Then a fixture PR moving lab and tree tests off the hostage mark and groups.test.ts:63 | as declared |
| interface | closed | Session closed after `board-risk-card`. Start a fresh interface session for the next interface item | none |

## Locks outside normal ownership

- `src/architecture/journeys.ts` (lead-owned): engine lane, for the `second-squad` PR only, to add the `joint-operation` journey.

## Open questions for the owner

See "Owner decisions" in `docs/backlog.md`.
