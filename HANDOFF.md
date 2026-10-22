# Handoff

Live state of the parallel sessions. Only the lead edits this file, and it overwrites stale
entries instead of keeping history. Rules are in `COORDINATION.md`; work to do is in
`docs/backlog.md`.

## Merged to main before the redesign

Merged so far: #36 (coordination rules), #37 (`e2e-script`),
#38 (`small-screen-map`), #39 (barricade design sheet), #40 (`gear-by-action`), #41 (rescue design sheet), #42 (`hq-tiles`), #43 (`lab-compare`), #44 (hostage review leftovers, all but B9), #45 (`intel-odds` engine work), #46 (`clock-runout-routing` engine work), #49 (`lab-armed-counts` with the armed leaf), #50 (`manager-names-disjoint`), #47 (`manager-art`), #48 (hostage armed line; `intel-odds` complete), #53 (`board-risk-card`), #54 (callCounts test pins), #51 (R-B1), #55 (last-seen lines), #52 (`clock-edges-in-tooling`), #57 (stable string checker), #58 (lab clock lookup), #56 (hostage clock route; `clock-runout-routing` complete), #59 (R-B2), #60 (clock tests on fixtures), #61 (R-B3; `barricade-engine-requests` complete), #63 (`second-squad` engine side, `joint-operation` journey), #65 (`clock-forks-read-travel`), #66 (`exit-via-reachable`), #68 (`moves-skip-pruned`), #67 (owner_down test fixtures), #62 (`hostage-owner-down-cleanup`). #70 closed as a duplicate of #68. #71 (hostage repro test), #69 (barricade and squad pins), #64 (`hostage-gate-requests`), #72 (`deploy-disabled-after-injury`), #73 (engine tests off barricade-order), #74 (`xray-band-minutes`), #75 (house fixture guard), #78 (`short-squad-deploys` engine side).

## Lead (from 2026-10-22)

The session "Project coordination handoff" leads, on `claude/angry-edison-cae68b` in
`.claude/worktrees/angry-edison-cae68b` (local, unpushed: owner keeps everything local until one
final verified push). It plans and merges; Sonnet and Haiku sessions build; Codex (default model)
challenges, tests and generates art. Earlier leads ("UI/UX audit and mobile-first plan", "Project
patterns review and antipatterns") stand down.

The branch holds everything: the Desk and Street redesign, paid details (save version 17), the
Standard-only stall lift, the hook-pattern research and every earlier branch (reconciled
2026-10-22; nothing local or on GitHub is missing from it). `npm run verify` passed at 70ae94b;
the e2e was not rerun there (no dev server was up). Lead dev port 5182; 5173 holds the owner's own
older save.

## Wave 1 (2026-10-22)

| Session | Model | Items | Branch | Writes only |
|---|---|---|---|---|
| visual | Sonnet | `visual-story`; the storefront and dead-CSS parts of `ui-leftovers`; plate and serif captures for `owner-visual-picks` | its own, cut from 7956eca+ | `src/ui/` except the files below, `public/art/`, `docs/art/medallions/`, `docs/visual-kit.md`, `scripts/validate-art.mjs` with `src/ui/art/validate-art.test.ts`, `src/ui/design-floors.test.ts` (back to the lead at READY) |
| engine | Sonnet | `roster-save-rule` | its own | `src/sim/` (save, campaign slots, roster), `src/ui/store.ts`, their tests |
| tooling | Haiku | baseline captures first, then the capture tool, the Lab `GameFrame.tsx` and First Run parts of `ui-leftovers` | its own | `docs/captures/`, `src/dev/`, `src/ui/settings/`, `scripts/play-loop.mjs` |
| design | Sonnet | `monetization-design` | its own | `docs/monetization.md` |

Wave 2 after the merge: `squad-names` (needs `visual-story`), `owner-visual-picks` once the owner
picks, then `rewarded-ads` and `real-purchases` from the design note.

Sessions and worktrees (2026-10-22): 11 idle sessions whose work is merged were archived and their
worktrees and branches removed. Still standing: "UI/UX audit" (owns this lead worktree), its
parent "Threat run-out" (`claude/eager-elgamal-f0ef34`) and grandparent "Content descriptors"
(`claude/content-warnings-draft`), kept because archiving a parent also archives its idle
children; and the pinned "Project patterns review" in the main checkout
(`claude/department-ux-pass`). All four are merged. The lead branch is backed up at
`refs/lead-backup/angry-edison`.

Sol's challenge of this split (2026-10-22, accepted with controls): the stall freeze must leave the
visible call running while the stored snapshot is paused, proved both ways; squad naming waits
for wave 2 because it crosses sim, the Blueprint props and live call screens; baselines are
captured before any change from a fixed seed; `.optile*` selectors still have consumers; the
kit-adoption ratchet counts named obligations per screen, not a global icon count.

## Ordering on shared files

- `src/gen/incident/second-squad.test.ts`: the engine lane's fixture PR (#73) has merged, so the calls lane may switch the `joint-operation` journey there in the barricade PR (one-PR lock), along with the barricade rows in `src/sim/outcome-score.test.ts`.

## Locks outside normal ownership

None.


## Open questions for the owner

See "Owner decisions" in `docs/backlog.md`.
