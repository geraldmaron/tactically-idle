# Coordination

How parallel sessions (Claude Code and Codex) share this repo without drifting from the backlog,
the jobs and journeys, or each other. This file holds the rules. `HANDOFF.md` holds live state.
Work to do lives only in `docs/backlog.md`.

## Roles

- **Lead.** One session at a time. It owns `docs/backlog.md`, `HANDOFF.md`, `docs/architecture.md`,
  `src/gen/incident/trees-v13/compiled-fingerprints.json` and this file. It merges branches one at a
  time and verifies the merged result. It approves changes to the interface files listed below.
- **Lane.** A session that works one lane's backlog items on its own branch and worktree. It writes
  only the files its lane owns. It reports to the lead by message and never edits `HANDOFF.md`.

## Lanes and ownership

A file has one writer. The most specific matching path wins, so `src/content/call-trees/types.ts`
belongs to engine even though calls owns the rest of that folder. A path no row matches belongs to
the lead, who assigns it in `HANDOFF.md` before anyone edits it. A lane that needs a change in a
file it doesn't own sends the owner a request that names the backlog id, the file and the behavior
needed.

| Lane | Owns |
|---|---|
| engine | `src/sim/`, `src/gen/`, `src/content/items.ts`, `src/content/capabilities.ts`, `src/content/scenario-types.ts`, `src/content/locations/`, `src/content/materials.ts`, `src/content/call-trees/types.ts`, `src/content/incidents/types.ts`, `src/architecture/wiring.ts` |
| calls | `src/content/` (the rest: call trees, incidents, scenarios, officers, personas, recruits, courses, certs, unlocks, development tree), `docs/calls/`, `.agents/skills/swat-*/` |
| tooling | `src/gen/incident/gates/`, `src/gen/incident/trees-v13/*.test.ts`, `src/gen/incident/trees-v13/balance.ts`, `src/dev/`, `src/lab-entry.ts`, `scripts/`, `.github/workflows/`, `package.json` scripts |
| interface | `src/ui/`, `src/main.tsx`, `src/harness.tsx`, `public/`, `scripts/validate-art.mjs` |
| lead | `src/architecture/`, `docs/` (the rest), `README.md`, `PLAN.md`, `AGENTS.md`, this file, `HANDOFF.md`, and the generated files |

Tests sit with the code they test, except where the tooling row says otherwise.

### Interface files

These shape what other lanes build on. Their owner changes them only with the lead's approval and
an adversarial review (below): `src/content/call-trees/types.ts`, `src/content/incidents/types.ts`,
`src/sim/scenario-types.ts`, `src/sim/types.ts`, the props of `src/ui/blueprint/Blueprint.tsx`,
`JOBS` and `JOURNEYS` in `src/architecture/journeys.ts`, and `src/architecture/manifest.ts`.

## Backlog format

Each item in `docs/backlog.md` has a stable id and two tag lines, checked by
`src/architecture/references.test.ts`:

```
### intel-odds: What the team learns changes the odds
Tags: job=command; journeys=chance-not-script; probes=subject-armament, new:intel-confirmed; lane=engine
Needs: start=none; integrate=none; ship=none
```

- `job`: a key of `JOBS`. `journeys`: ids in `JOURNEYS`. `probes`: ids in `WIRING`. Write
  `new:<id>` for one the item adds, and `none (reason)` when the item doesn't touch any. Don't
  invent a mapping to fill the field.
- `lane`: engine, calls, tooling, interface, lead or deferred.
- `Needs` says what must ship before this item can **start**, **integrate** (merge its work),
  and **ship** (be deleted from the backlog). Each part lists backlog ids, or `none`. A note in
  parentheses can follow an id.
- When an item ships, the lead deletes it and removes its id from every other item's `Needs` in
  the same commit. A `new:` id becomes a plain id once it exists.

The test checks references only, not meaning. The lead checks meaning when an item ships: does the
work serve the job it names, and do the journeys and probes still describe what players get?

## Shipping an item

1. Its done criteria in the backlog hold, shown by the command or screen that proves each one.
2. If it changed what a journey covers or what a probe measures, the journey test or probe changes
   with it, and a floor rises to the newly measured share. Floors never fall. Work that doesn't
   change measured behavior (art, tooling, layout) leaves them alone.
3. Content follows `docs/content-pipeline.md`, including the separate `swat-writing-review` read.
4. A load-bearing change has an adversarial review record (below).

## Tests across lanes

A test must not pin something another lane will change. Three merges in a row broke on this: a lab
test pinning a hostage ending title, a lab test pinning the whole compile-time facts map, and a lab
negative control borrowing the hostage tree.

- Assert the property under test, not a whole value that grows (`toMatchObject` on the keys the
  test is about, not `toEqual` on a map other lanes add to).
- A negative control uses a fixture it owns, never live content another lane edits.
- Before READY, search for tests in other lanes that read what you changed (content ids, map keys,
  counts) and say in the PR which ones you checked.

## Sharing one machine

All lanes run in worktrees of one checkout on one machine. Three things are shared even though
files aren't:

- **The git stash stack** is shared by every worktree. Never run a bare `git stash` or
  `git stash pop`; set work aside with a WIP commit on your own branch.
- **Dev server ports.** Each port has its own local storage, so two lanes on one port share saved
  campaigns. Use your lane's port: engine 5183, calls 5184, tooling 5174, interface 5175, lead 5182.
- **CPU.** Full `npm run verify` runs from several lanes at once slow every test, and tests near
  their timeout fail. While working, run the tests for what you changed; run the full verify once,
  before READY.

## Merging

1. The lead merges one branch at a time. The lane rebases on current main first.
2. Generated files are never hand-merged. After the rebase the lead regenerates them
   (`npx vitest run src/architecture -u`, and the fingerprint recapture in
   `docs/content-pipeline.md`) and reads every changed line first. An unexplained change stops
   the merge.
3. On the merged main the lead runs `npm run verify`, then plays the call journey in the browser
   at 390x844. A green lane branch doesn't stand in for the merged state.
4. When two lanes' merged changes interact (the same call, odds or measurement), the lead reviews
   the integrated diff adversarially again.
5. Branches are deleted once merged.

## Adversarial review

Load-bearing changes get a Codex adversarial review before merge: interface files, odds formulas
and probe floors, manifest layers, edges and `LAYER_DEBT`, `JOBS` and `JOURNEYS`, the save shape,
and retiring a call tree. Run it from the lane's worktree:

```bash
node ~/.claude/plugins/cache/openai-codex/codex/1.0.6/scripts/codex-companion.mjs adversarial-review --wait --base main "<what to attack>"
```

The pull request records: the reviewed commit, the scope, each finding, the verdict (accepted,
accepted with controls, needs validation, rejected) and what happened to each control.

## Codex

- Use Codex's configured default model (`~/.codex/config.toml`). Pass `--model gpt-6-astra` only when the
  owner asks for Astra by name (first used 2026-10-22 for the visual UI audit).
- Depth 1: a Codex run never calls back into Claude, and a lane doesn't start sessions of its own.
- Reviews are read-only. Codex writes code only through `task --write` inside the lane's own files.

## Handoff

The lead keeps `HANDOFF.md` current: each lane's session, branch, items in flight, declared file
touches and any lock on a file outside normal ownership. Before writing, a lane sends the lead its
expected touches, including tests, producers and assets. The lead resolves overlaps before work
starts and again when a lane's scope changes.

## Context rotation

A session is replaced by a fresh one before its context degrades the work. Every turn rereads the
whole context, so a full window costs more per turn, keeps stale facts (old commit ids, superseded
decisions) beside current ones, and loses detail silently when it auto-compacts.

**Measure.** `get_usage` (the app's session tools) reports each session's context as a percent of
its window. A lane checks its own at every item boundary and puts the number in its READY report.
The lead checks a lane's number before handing it more work, and its own at every merge.

**When.** These are starting defaults; the lead tunes them from what the reports show.

| Signal | Action |
|---|---|
| Item done and context at 40% or more | Rotate before the next item |
| Context at 60% or more mid-item | Commit, write the note, rotate now |
| The session has auto-compacted (a summary replaced earlier turns) | Rotate at the next commit |

**How a lane rotates.**

1. Commit everything on its branch. No work stays uncommitted.
2. Write a rotation note in the lead's notes folder (`side-session-notes/<lead session id>/<lane>-rotation-<n>.md`):
   item and backlog id; branch and last commit; done, with the command that proved each part; not
   done; verification not yet run; open findings with their verdicts; file touches; decisions taken
   and why; the next three steps.
3. Message the lead "ROTATE" with the note's path, then stop.
4. The lead starts the successor fresh on the same model, cut from the predecessor's branch tip,
   with the original brief plus "read the rotation note first". It updates `HANDOFF.md`, and
   archives the predecessor once the successor confirms it has the note.

**How the lead rotates.** Only at a quiet point: no lane mid-turn, every READY merged or listed.
A lane's end-of-turn notes go to the session that started it, so a running lane would report to a
lead that's gone.

1. Bring `HANDOFF.md` and the backlog up to date, and commit.
2. Write `side-session-notes/<lead session id>/coordinator-handover.md`: the integration branch and
   tip; each lane's session id, branch, state and context percent; merges pending and their
   checks; open owner questions; and the usage budget (`get_usage` plan limits).
3. Start the successor lead fresh, from the integration branch, titled "Project coordination
   handoff". Lanes address the lead by that title, so the name carries over. Its first step is
   to read this file, `HANDOFF.md` and the handover note.
4. Tell each idle lane the new lead's session id, then archive the old lead. While both exist the
   title matches two sessions, so lanes message the id until the old lead is archived.
