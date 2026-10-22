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

Current lead: local_57697767-1f17-4edc-9de5-edbdf721af55, from the 2026-10-22 rotation (took over
from local_0ef35909, which is archived once the owner agrees). Every idle lane has been told this id;
until the old lead is archived the title matches two sessions, so lanes message the id.

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

Also running (owner requests, 2026-10-22):

| Session | Model | Work | Writes only |
|---|---|---|---|
| going-live-teardown | Opus | hostile teardown of Going Live and a multi-pass depth method | `docs/calls/notes/going-live-teardown.md`, `docs/calls/depth-mesh-method.md`, `docs/calls/notes/pilot/` |
| live-chat-immersion | Sonnet | chat keyed to each pressure source's drain, reading like a real live | `docs/call-pressure.md`, `.agents/skills/swat-call-prose/` references, chat and pressure lines in `src/content/call-trees/hostage-live.ts`; after visual merges, `src/ui/screens/LiveFeed.tsx`, `live-chat.ts` and their tests |

Wave 1 is merged and checked (2026-10-22): engine (702fc5c), the design note (500bc16), tooling
(9497b63), visual (97b0ba3). On the merged tip `npm run verify` passed (2,966 tests), the e2e passed
6 calls at 390 and 320, the lead played First Run to a live call at 390 and 320, and Codex's
adversarial review of the integrated diff approved with no findings. The owner's plate and serif
compare page: https://claude.ai/artifact/9ZsHsUNZGRo3KFpqvaAxs6. Wave 1 session branches are merged;
their sessions wait for the owner's go-ahead to archive.

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

The Going Live teardown merged (docs only, 6806a26, backlog 30b4a77): verdict reject, back to call
design; the depth-mesh method stands at "needs validation". All six sessions started this round are idle
with their work merged.

## Wave 3 (2026-10-22)

| Session | Model | Item | Writes only |
|---|---|---|---|
| path-measures (local_6131d480) | Sonnet | `path-measures` | `scripts/`, measure and test files in `src/gen/incident/trees-v13/` (not compile.ts or content), `src/dev/` exports, `package.json` scripts |
| going-live-spine (local_adf5bbed) | Opus, structure passes only | `going-live-spine` | `src/content/call-trees/hostage-live.ts`, `docs/calls/going-live-design.md`, `docs/calls/notes/going-live-spine.md` |

The spine gates on `check:paths` once it lands (the lead tells it), and stops before prose; Sonnet prose
passes follow from its briefs. Owner target: every balance style reaches the turn in at least 50% of
drawn calls. Lead context 46% on 2026-10-22: the lead rotates at the next quiet point (COORDINATION.md
"Context rotation").

Wave 3 result (2026-10-22): path-measures merged (8576e09, verify 3,010 tests). The spine is done with
its structural passes on `claude/going-live-spine-25ad3c` (123efc8, not merged, placeholder text); the
lead re-ran `check:paths` there and every style clears the 50% target. Next steps are in backlog
`going-live-spine`. The lead hands over at this quiet point; the note is
`side-session-notes/local_0ef35909-1f92-43ed-b124-d0236bd4f320/coordinator-handover.md`.

## Wave 4 (2026-10-22, owner go)

| Session | Model | Item | Writes only |
|---|---|---|---|
| timeout-commitment (local_b934b3d8) | Sonnet | `timeout-breaks-commitment` | `src/content/call-trees/types.ts` (`TreeTimeout.breaks`, lead-approved, Codex review owed), `src/sim/`, `src/gen/` except gates, existing trees-v13 tests and `balance.ts`; never `hostage-live.ts` |
| Codex (lead's background run) | default model | `going-live-spine` step 1, second read of 123efc8 | read-only; output `side-session-notes/local_0ef35909-1f92-43ed-b124-d0236bd4f320/going-live-spine-codex-round2.md` |

timeout-commitment merged (4cdd1b5, architecture re-render 2ad8f70): `npm run verify` 3,016 tests and art,
build and no-lab green on the merged tip; the e2e passed 6 live calls at 390 and 320 on 5182. No live call
names a timeout `breaks` yet, so the lapse that breaks a promise is proved on the lane's fixture tests only.
Its session waits for the owner's go to archive.

Codex's second read finished: rejected (10 findings, 5 block; three of the blocks are the known requests
outside the call's files). Backlog `going-live-spine` step 1 is now a second structure pass, then a third
read. Owner's go (2026-10-22, started at once rather than after the weekly reset): one fresh Opus session runs
that pass, which also owns `src/content/incidents/hostage.ts` for the s2 volatility draw and
the repost cue, ending in a third Codex read. Brief:
`side-session-notes/local_0ef35909-1f92-43ed-b124-d0236bd4f320/going-live-spine/pass2-brief.md`. The
prose passes wait for that read.

Started together on 2026-10-22 (owner's go), briefs in the same notes folder:

| Session | Model | Item | Writes only |
|---|---|---|---|
| spine-pass2 (local_485b9343) | Opus | `going-live-spine` structure pass 2 | `src/content/call-trees/hostage-live.ts`, `src/content/incidents/hostage.ts`, `docs/calls/going-live-design.md`, `docs/calls/notes/going-live-spine.md` |
| ui-leftovers (local_ce760bcd) | Haiku | `ui-leftovers` | `src/ui/screens/HQ.tsx` and the navigation Open needs (asks first if that is `store.ts` or `App.tsx`); port 5175 |
| squad-names (local_29da4a0d) | Sonnet | `squad-names` | locks: `src/sim/resolution.ts`, `operation.ts`, `operation-selectors.ts`, `src/ui/people/`, `src/ui/blueprint/` (props need lead approval and Codex review), `src/ui/screens/operation-squads.ts` and the live call screens, the Lab squad files, `src/gen/incident/gates/engine-driver.ts`; never `HQ.tsx` or `src/content/`; port 5183 |

spine-pass2 READY (2026-10-22): `claude/spine-pass2-363cdf` at 44f5470, not merged (placeholder strings).
All 10 second-read findings fixed as data, `check:paths` holds; Codex's third read: 9 of 10 hold, three
medium findings, no block, recorded in backlog `going-live-spine` step 1. Stopped per its brief. Owner's go: the three
round 3 findings fixed as data at 8d8a0fc; the lead re-ran `check:paths` there (turn reach 78/95/93/96,
nothing beaten). Not run on the branch: full verify (the old call's pinned tests fail by design until step 3).
Owner's go for prose (2026-10-22): layers run one at a time, each cut from
the previous tip. P4a scene: prose-scene (local_31193569, Sonnet), from 8d8a0fc, writes only strings in
`hostage-live.ts` and `hostage.ts` plus its record; brief `going-live-spine/prose-p4a-brief.md`. P4a READY at
4a5242f on `claude/prose-scene-6a2c7c` (worktree folder `frosty-goldwasser-fee639`): strings only, no data
moved, check:strings clean in its fields. P4b menu is proposed as a card for the owner to start (brief
`going-live-spine/prose-p4b-brief.md`, cut from 4a5242f). Then
P4c consequences (P3 folded in), P5 chat variants, one integration edit, `swat-writing-review` by a separate
reader, the old call's tests, then merge.

Archived 2026-10-22 (owner's go): the three wave 4 and 5 lanes and six wave 1 to 3 lanes, merged branches
deleted. Kept: the old lead, going-live-spine, spine-pass2, and going-live-teardown (it had live work when
archived; retry later). Raw git-ignored capture frames (visual-story before, owner-visual-picks) copied to
`side-session-notes/local_0ef35909-1f92-43ed-b124-d0236bd4f320/raw-captures/`.

squad-names merged (cde797c; manifest files `src/sim/squad-names.ts` under kernel and re-render, bea1144):
`npm run verify` 3,025 tests, art, build and no-lab green on the merged tip; the e2e passed 6 live calls at 390
and 320 on 5182; Codex approved the branch and, separately, the manifest line, with no findings. The lane
checked a renamed squad on every call surface at 390x844; the lead did not repeat the rename by hand. Not
handled: log lines written before a mid-call rename keep the old name. `src/sim/operation.ts` is free again.

ui-leftovers merged (92cdf72, re-render cead5e2): `npm run verify` 3,018 tests, art, build and no-lab green on
the merged tip; the lead played HQ's oldest-call Open at 390x844 on 5182 (fresh context) and it lands on
Going Live's brief. Its session waits for the owner's go to archive.

## UI polish (2026-10-22, owner request)

Astra (owner's request) audited 261 fixed-seed frames at 320, 390 and 430: findings, rules R1 to R18 and an
eight-package plan in `side-session-notes/local_0ef35909-1f92-43ed-b124-d0236bd4f320/ui-audit/astra-findings.md`.
Backlog `ui-gates`, `ui-primitives`, `ui-surfaces`. Wave A, proposed as cards: ui-gates (Sonnet, test files,
`capture.mjs`, `scripts/check-ui.mjs`, `package.json` scripts, generated `src/ui/ui-debt.json`, port 5174) and
ui-primitives (Sonnet, `theme.css`, `app.css`, `skin.css`, `player-navigation.css`, `components/ui.tsx`,
`Sheet.tsx`, `sheet-viewport.css`, `icons.tsx`, `icons/kit.*`, port 5175). Wave B (packages P2 to P8) starts
once both merge. The lead regenerates `ui-debt.json` at every merge.

## Locks outside normal ownership

None. live-chat-immersion merged (ad0d329, `npm run verify` 2,992 tests on the merged tip, lead played a
lapse and a stream cut at 390x844), so its locks are released.

## Open questions for the owner

See "Owner decisions" in `docs/backlog.md`.
