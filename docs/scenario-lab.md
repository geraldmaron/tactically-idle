# Scenario Lab

**Status:** dev only, rebuilt 2026-10-09. It replaces `/story.html` (the story sheet, its Gate review view and the old lab). It covers the four call trees: `hostage_crisis`, `barricaded`, `active_armed_incident` and `protected_rescue` ([call-trees-v13.md](call-trees-v13.md)).

The lab is the real game running on the real engine in a phone frame. A director on the left sets the call; an X-ray rail on the right shows what the player can't see: hidden truth, odds, where each result goes, what it writes. Around that hub sit a story graph, ending shares by play style, the state wiring, every line of text in every variant, and the game's global tuning.

## What it's for

| Job | Where |
| --- | --- |
| Read a call the way the player reads it, with your own picks | Play |
| Land on any node, choice, ending or line in seconds | `⌘K`, Play here, Open in lab |
| See what's underneath a choice: margin, routes per band, what it writes, what the player reads after | Play, full note |
| Judge the dilemma at one moment, side by side | Play, "This moment" |
| Trace why a choice is locked or an ending never happens | Play (Why), Dependencies |
| Find dead wiring and unreachable content | Dependencies, Flow, Calls |
| Know how a call ends, by play style, and whether CI will pass | Outcomes, Calls |
| Check every variant and every name | Script |
| Tune the whole game and check the change before saving | Tuning |
| See what a content edit changed | Baseline pin in Script and Outcomes |
| Leave review notes on the exact spot | Review drawer |
| See every call's shape, lint and last gate result at once | Calls |

## Open it

```bash
npm run lab          # vite --open /lab
npm run dev          # then http://localhost:5173/lab
npm run build:lab    # static lab build (VITE_LAB=1); open any URL with ?lab
```

- `/lab` with no call opens Calls. `/lab?type=<type>` opens that call's default draw on Play.
- From the game, in dev builds only:
  - the **Lab** link in the campaign bar opens `/lab`;
  - **Open in lab** on a live call and under the debrief hero opens the lab on that exact game state.
- Old `/story.html?…` links get a 302 to `/lab?…` from the dev server, query unchanged, and the lab rewrites the old parameters on load (see "Old links"). A static build has no `story.html`.
- The lab never loads the game's store, so it never opens, ticks or saves a campaign (`src/dev/lab/no-store.test.ts`).
- A plain `npm run build` leaves the lab out. `scripts/check-no-lab.mjs` (part of `npm run verify`) fails if the lab's marker reaches `dist/`.

The hostage reference call used throughout:

```
/lab?type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1
```

### Open in lab

The control writes a snapshot of the game state to the game's `localStorage` (`ti-lab-handoff:<nonce>`, kept 24 hours, newest 5) and opens:

```
/lab?id=<incident id>&handoff=<nonce>&hist=<the game's moves>
```

The lab plays forward from that state. Steps taken in the game show as hatched chips before Start, and the squad reads "Your squad (from game)". If the snapshot is gone, the lab replays `hist` on the reference squad with forced bands and says so; odds and drawn results can then differ from your game.

## The shell

On every surface:

- **Top bar:** call switcher, the surface tabs, `⌘K Go to…`, the X-ray and Names toggles, the notes count, and a status dot. The dot reads "dev" when the dev server answers, "Static build" in a `build:lab` page, and turns amber when the dev server stops answering. Saving tuning, shared notes and string checks need the dev server.
- **Call strip:** one chip per part of the draw (building and seed, situation, pacing, tier, squad, kit, turn, group size), the "Usually" ending mix from cached runs, and the static lint count.
- **Notice bar:** for example "Path kept to step 2. Step 3 (…) isn't offered in this call." with [Why] and [Undo draw change], after a draw change that refused a step.
- **Unsaved-tuning banner:** a dashed amber line while a tuning patch differs from `tuning.json`.

| Key | Does |
| --- | --- |
| `⌘K` / `Ctrl+K` | Go to a call, surface, node, choice, ending, state key, line or tuning field. Matches bound titles and raw ids (`owner_killed`). Enter selects; `⌘Enter` plays to it |
| `G` then `C P F O D S T` | Calls, Play, Flow, Outcomes, Dependencies, Script, Tuning |
| `N` | New note on the selection |
| `\` | Open or close the review drawer |
| `?` | Shortcut sheet, with each surface's own keys |
| `Esc` | Close the topmost panel |

Surface keys are ignored while you type in a field.

## Surfaces

The URL holds the focus: the call (draw, squad, kit), the path (moves played) and the selection. Switching surfaces keeps all three. Every graph item, ending, wiring site and line has **Play here**, which finds the shortest path to it and opens Play there.

### Calls (`tab=calls`)

- One card per call: the hook bound with the default draw, counts (decision points, choices, endings), a shape thumbnail, the "Usually" ending mix, the CI gate checks for that type, lint and note counts.
- **Run gate** plays the 24 CI balance checks in the workers (about 9 s). Nothing runs on load; after a reload the results paint from cache with their age.
- **Findings:** static lint for all four calls, plus what cached runs found. Click one to open where it lives.
- Key: `R` runs the gate.

### Play (`tab=play`, the hub)

- **Director (left).** Building and seed; situation 1 to 3 (each card shows its hidden note on tape); turn per turn group; group size; pacing; tier; squad seed with faces and certs, and **Grant cert** (a lab grant to squad A's first officer, labelled everywhere); kit (Day one or Every item); dice (Roll, or Force: after Confirm you pick the band); screen (Auto, Card, Brief, Live, Debrief); width 390 or 430; zoom Fit or 1:1. Situation, turn and group size are never forced onto a call: the lab finds the nearest call seed with that draw and says what else changed ("Also changed: names …"), one such notice at a time; Back or Undo draw change clears it.
- **Path rail.** One chip per step with the band and any drawn result. Click a chip to rewind, `‹ ›` to step. The exact chance of this path reads like "= 1 in 96 (1%) · this path · your picks · exact". **Compare situations** replays the same picks under the other two situations and marks where they part.
- **Frame (middle).** The game's own components (card, briefing, live screen, action sheet, debrief) rendered from the lab's engine state at 390 × 844 or 430 × 932. Card odds are the game's. Confirm in the game's sheet commits the step with the Director's dice.
- **True device.** Director › Frame › [True device] opens this step in a real iframe at 320, 360, 390 or 430 px, so the game's own width rules apply as on a phone. The iframe loads `?frame=player` with this call and path and replays it on saved tuning; with unsaved tuning the button reads "True device · Uses saved tuning". A Confirm inside it stays there.
- **X-ray rail (right):**
  - **Truth:** each hidden fact in this situation, beside what the team knows. **Tape in frame** (`truth=1`) tags people in the frame with their hidden facts, drawn outside the game's markup.
  - **This moment:** one row per choice offered here, in the player's order. Odds, where each band goes (goes well, complications, goes badly), minutes and flags (beaten, flat, all high). Locked rows show the engine's reason; rows the game hides behind "Show all" say so.
  - **Full note** for the selected row: odds and margin (score minus difficulty), what the odds are made of, the band curve, and per band the route, what it writes ("read later by n"), drawn results with their exact odds and routes, and **Player reads after** (the result text and the `Next:` line). Then the exact next step, and actions: force a band, Roll, **Where this leads** (1,000 runs from here), Note, Flow, Deps. A locked row shows **Why** with fixes.
  - **State, Clocks, People** tabs.
- Keys: `1` to `9` select a row; `W` `C` `B` force goes well, complications, goes badly; `R` or `Enter` roll; `[` `]` step back and forward; `Backspace` rewind one; `X` hide the rail; `T` tape; `P` people colors; `F` `D` `S` this choice in Flow, Dependencies, Script.

### Flow (`tab=flow`)

- The call as a graph on blueprint paper, in lanes: Assess, Adapt, Resolve, Endings.
- **Show:** Reach (ribbon width is the share of runs that took the route), Structure (every authored route, with its conditions), State (writers and readers of one state key).
- **Color by:** result band, or fate (how the runs that took a route ended).
- **Show dropped** (`pruned=1`) ghosts what this call's draw drops, with the compiler's reason ("needs others ≥ 1; this call has 0").
- Turn hubs fan out to the turn's nodes; the undrawn ones are ghosts "not drawn here". Endings no run reached keep their box with "0 of n".
- Click selects into the inspector (prompt variants, choices, per-band targets, reach, Play here, Note). Hovering lights everything upstream and downstream.
- **Fit** (`0`) fits the whole call, endings column included, into the room the inspector leaves. Zoomed out, text keeps a fixed screen size: ending rows keep at least 200 px of width and show one line of title when two don't fit (the whole title on hover), and short node cards grow to hold their title and share.
- Keys: arrows move between boxes; `Enter` shows or folds a node's choices; `P` Play here; `M` next view; `0` fit; `.` center the selection; `+` `−` zoom; `Esc` close the inspector.

### Outcomes (`tab=outcomes`)

- Every ending as a card, grouped by run class (Clean, Costly, Unresolved, Someone hurt, Someone killed, Not in this call): share with interval, share in this type, the mix of run classes among runs ending there, the shortest path, and the authored disposition. Endings this draw can't reach say what draw would, with **Find a draw with it**.
- **Styles:** all four play styles over this type, side by side, with the 75% clean cap.
- **CI gate:** the 24 checks on the CI population only.
- **Pin as baseline** stores this call's shares, so later runs show paired deltas. They compare only on the same population: the same call, squad, grants, kit, game moves, step, style and run count (content and tuning may differ). Pinned elsewhere, the baseline stays muted and says so.
- Two endings with the same title (hostage `held_both`, `held_both_down`) are told apart in Flow, Outcomes and the palette by their first remaining task. The player reads the title alone.

### Dependencies (`tab=deps`)

- **Wiring check:** static lint over every turn and group size (errors, warnings, notes), each with what it means and **Mute with reason** (writes an accepted note; a muted finding leaves every count).
- **State:** every key by kind (marks, who is out safe or out of the building, what the team knows, clocks, subject meters, promises, harm, score, group sizes, turns, the situation) with writer and reader counts.
- **Bow-tie:** for the selected key, every site that sets it and every site that reads it, each with Play here and Flow. Sites that only hold in another situation say which and offer Find a draw.
- **Why can or can't this happen:** any choice, prompt variant, conditioned line or ending, every clause checked at the current step, per situation and per draw, the engine's own reason last. Fixes: grant a cert, find a squad seed (seeds 1 to 500), find a draw, find a path.

Lint codes:

| Code | Severity | Means |
| --- | --- | --- |
| `read_never_written` | error | a condition reads a mark nothing sets |
| `unreachable_node`, `unreachable_ending` | error | no route under any situation, turn or group size |
| `dead_write` | warn | set, never read |
| `never_offered`, `never_matched` | warn | the compiler drops a choice or an outcome in every draw |
| `threat_only` | note | read only by command approval (threat marks) |
| `drawn_only` | note | set only by a drawn result |
| `clock_writer` | note | also set when a clock runs out |
| `never_reached`, `flat_odds`, `stuck_runs` | warn, from runs | in the call but no run got there; choices within 5 points of each other, or all at 90% or more; runs with no ending |
| `locked_for_squad` | note, from runs | offered but never eligible for the squad used |

### Script (`tab=script`)

- Every player-visible line in player order (card and briefing, then node by node, then endings) in a 390 px column with the game's text styles and people colors.
- **Variant bar:** cast (12 casts: this call plus 11 drawn ones, and **Longest names**, the cast `npm run check:strings` uses), pronouns (as drawn, he, she, they), group size, situation, turn, **Next variant**. "Variants read n of m" counts the combinations you have seen this session.
- **Show:** All, Changed in this variant (changed words marked), Changed since baseline, Flagged, Has notes.
- **Pin baseline** stores every line of the call, so after a content edit (Vite reloads the page) "Changed since baseline" shows exactly the lines that moved, words marked.
- **Run checks** (dev server and python3) sends the lines to the swat-call-prose checker and pins findings to lines.
- **Matcher audit:** the game's people matcher against the binder on every line for 12 casts. It should read "0 missed · 0 false matches across 12 casts".
- **Vision:** deuteranopia, protanopia and tritanopia simulation on the column.
- Selecting a line opens its inspector: where it sits, the raw field path, the authored text with its tokens, how it reads in each situation, changes, checks, notes, and Play to where this shows.

### Tuning (`tab=tuning`)

The whole game's numbers. See "Global tuning" below.

### Review drawer (`notes=1`)

- Opens over any surface with `\`; `N` opens it anchored to the selection (a node, choice, band, ending, state key, line, tuning field or lint finding), or to the whole call.
- **Call verdict:** approve, edit or reject.
- A note has a severity (block, fix before freeze, note), who owns the fix (prose, design, officers, engineering, owner: the swat-* skills and the people behind them), an optional rule id, "The player reads" (prefilled with the bound text), fix as data and the note. The draw and the full URL are recorded with it.
- Each note shows "Changed since this note" when the anchored text changes, and "Anchor gone" when it no longer exists. Pins show on Flow nodes, Script lines, ending cards and X-ray rows.
- **Export findings** gives Markdown: the verdict line and one row per note in the swat-writing-review shape, `[severity] <call, situation, seed> | <field path> | sees '<…>' | rule <id> | fix as data '<…>' | route <…>`, with links, and lint kept on purpose listed apart.
- Notes save to `docs/calls/notes/<type>.json` through the dev server. A static build, or a dev server that stops answering, keeps them in this browser (`localStorage` `ti-lab-notes:<type>`) and says so.

## URL parameters

Defaults are left out of the URL. `:` `,` `~` `/` stay readable.

The call and the path:

| Param | Values | Default |
| --- | --- | --- |
| `type` | `hostage_crisis`, `barricaded`, `active_armed_incident`, `protected_rescue` | none (Calls) |
| `family`, `seed` | building family and seed | the tree's first family, `7` |
| `variant` | situation, 0 to 2 | the default draw |
| `pacing` | `ordinary`, `deliberate_answers` | the default draw |
| `tier` | 1 to 5 | `2` |
| `call` | a literal call seed (wins over `variant` and `pacing`) | none |
| `id` | an incident id (wins over everything above) | none |
| `kit` | `day1`, `full` | `day1` |
| `squad` | campaign seed for squad A | `719` |
| `certs` | comma list of cert ids granted to squad A (lab grant) | none |
| `path` | moves, comma-joined `actionId~band`; band is `favorable`, `mixed`, `adverse`, `roll`, `continue` or `fail`. A forced drawn result follows the band: `…~adverse/firearm:none/none` (a cascade's `+` is written `.`) | empty |
| `node` | "take me to this node": the lab finds the shortest path and turns it into `sel=node:<id>` | none |
| `handoff`, `hist` | set by Open in lab | none |

What you see:

| Param | Values | Default |
| --- | --- | --- |
| `tab` | `calls`, `play`, `flow`, `outcomes`, `deps`, `script`, `tuning` | `calls` without a call, else `play` |
| `sel` | `node:<id>`, `choice:<node>/<choice>`, `band:<node>/<choice>/<band>`, `ending:<id>`, `key:<stateKey>`, `string:<line>`, `field:<TABLE.path>`, `finding:<id>` | none |
| `scope` | `call`, `step`, `type` (population for simulated numbers) | `call` |
| `style` | `random`, `best_odds`, `patient`, `fast` | `random` |
| `runs` | number of runs (this call) or calls (this type) | 2,000 runs; 60 calls |
| `x` | `0` hides the X-ray rail | shown |
| `names` | `0` turns people colors off | on |
| `truth` | `1` shows hidden truth on tape beside the frame | off |
| `screen` | `card`, `brief`, `live`, `debrief` | follows the run |
| `dice` | `roll`, `force` | `roll` |
| `w`, `zoom` | `390` or `430`; `fit` or `1` | `390`, `fit` |
| `mode`, `color`, `pruned`, `exp` | Flow: `reach`, `structure`, `state`; `band`, `fate`; `1`; expanded node ids | `reach`, `band` |
| `vision` | `deutan`, `protan`, `tritan` | none |
| `grp`, `adv` | Tuning group; `1` opens advanced fields | `odds` |
| `f` | filter text (Dependencies, Script) | none |
| `notes` | `1` opens the review drawer | closed |
| `frame` | `player` renders only the game for this call and path, full window, on saved tuning (the True device page) | none |
| `lab` | alias that opens the lab on any URL (static builds) | |

### Old links

| Old | Now |
| --- | --- |
| `/story.html?…` | 302 to `/lab?…` (dev server) |
| `view=lab` | dropped |
| `legacy=1` (the old lab) | dropped, with the notice "The old lab was retired. This link opens the same call in the new lab." |
| `view=gates`, or `journeys=1` without `view=lab` (Gate review) | Calls, with a notice. Gate review covered the retired typed frameworks; none of its params carry over |
| `tab=run`, `tab=instance` | `tab=play` |
| `tab=map` | `tab=play&screen=live` |
| `tab=graph` | `tab=flow&mode=structure` |
| `tab=choices&node=N` | `tab=play`, then the path to `N` |
| `tab=writing` | `tab=script` |
| `tab=balance` | `tab=outcomes&scope=type` |
| `tab=notes` | `tab=play&notes=1` |
| a `type` with no call tree (`burglary`) | Calls, with a notice |
| an `id` before content version 13 | an error naming the version |

## How numbers are labelled

Every number says what it is.

- **Engine** (one exact state): plain, with a pill such as `61% · now · squad A (719) · engine`. Card odds, the X-ray odds and margins.
- **Exact** (worked out from engine values): prefixed `=`. Path chance, next step, drawn-result odds, the band curve.
- **Simulated** (worker runs): prefixed `≈`, always with an interval, such as `≈ 41% ±2 · this call · random style · 2,000 runs`.

Populations (`scope`), one control per surface, used by every simulated number on it:

| Population | What varies between runs | What stays fixed |
| --- | --- | --- |
| this call | dice and the style's picks | building, situation, turn, group sizes, names, squad, kit |
| from this step | the same, starting from the Play frame | everything played so far |
| this type | the CI population (`drawCalls`): situation, pacing, group sizes, turn, building, clock rates, subject traits, and a different day-one squad per call | type and tier |

Runs: this call and from this step offer 400, 1,000, 2,000 (default) or 5,000 runs; this type offers 60 (the CI size, default), 200 or 600 calls.

- **Styles are named as styles,** never "the player": random style (an even pick among eligible choices), best odds (always the eligible choice most likely to go well), patient (always the slowest), fast (always the quickest). Where styles matter, all four show side by side.
- **Run classes:** clean, costly, unresolved, hurt, death.
- **Intervals** are Wilson 95%, shown as `±` whole points. Under 30 runs the lab shows the count ("3 of 20 runs"); an interval wider than 20 points is muted with "few runs". A share names the runs it was counted over, so while runs stream in or after Stop it says the partial count, not the count asked for.
- **Deltas are paired:** before and after (tuning patch against saved, baseline against now) use the same calls, dice and style seeds. A delta whose interval holds zero is grey, "within noise".
- **Pass or fail appears only for the CI population:** tier 2, `drawCalls` from 1, day-one squads, 60 calls (40 for best odds). Other populations can show the band, never a verdict. With an unsaved patch, pass or fail is the patched side's only: until that side runs, Calls and Outcomes say "Saved: n of 24 pass · not run for this change yet".
- **Draw shares are design weights:** "≈ 1 in 3 calls (draw weights)", never `=`.
- **Forced bands:** forcing a band also fixes the drawn result after it, unless you forced that too. The note says so and shows the natural odds; path chance always uses natural chances. A band that draws has no single run class: its drawn results carry theirs, and the exact next step splits an ending by class.
- **Harm marks** include a clock that runs out over a band's minutes and hurts its owner, as the commit does.
- **The squad is always named:** "squad A (719)", plus grants ("+ vehicle operations (lab grant)"), or "your squad (from game)". This-type numbers say day-one squads vary per call.
- **Unsaved tuning is named:** any number run under a patch carries the dashed outline and "unsaved tuning".

## Global tuning

### The registry

- Every tunable table is wrapped where it is defined: `export const RESOLUTION_TUNING = tunable('RESOLUTION_TUNING', {...})` (`src/sim/tuning.ts`). The object keeps its identity, so every reader sees a change at once.
- `src/sim/tuning.json` holds the saved overrides, `{}` by default. `tunable()` merges them in when the table registers, so the game, the lab, the workers, vitest and Bun scripts all read the committed values with no extra call.
- An invalid override is skipped with a `console.error`, never thrown, so the game always loads. `src/sim/tuning-tables.test.ts` fails CI if the committed file has any problem.
- Merge rules: objects recurse, a value keeps its type, lists keep their length, keys must already exist.
- Layers: defaults (source) → saved (`tuning.json`) → unsaved patch (lab only, in `localStorage` `ti-lab-tuning-patch`, sent with every worker job).
- Field metadata (label, help, group, range, read mode, why, pinning tests) is `TUNING_META` in `src/sim/tuning-meta.ts`; `src/sim/tuning-tables.ts` imports every table so all of them register.

### Dials and raw fields

- **Groups:** Odds of success, Pressure, Subject behavior, Harm and death, Time, Debrief and trust, Officer strain, Department, Call flow, and **Can't tune here**.
- **Dials** are plain controls that store nothing of their own: each reads its position from the raw fields it writes and shows them as default, saved, now. Multipliers are relative to the defaults (×1 is the default).

| Dial | Writes |
| --- | --- |
| Difficulty, Complications window | `RESOLUTION_TUNING.favorableAt`, `.adverseAt` (moved together, or apart) |
| Skill vs luck | `RESOLUTION_TUNING.span` |
| Setback chance, Lucky-break chance ("Move both together") | `RESOLUTION_TUNING.setbackChance`, `.luckChance`, never below 0.5% |
| Officer quality | `RESOLUTION_TUNING.ratingScale` |
| Scene pressure | `RESOLUTION_TUNING.pressureMax` |
| Armed subjects | `THREAT_TUNING.difficulty.execution`, `.contact` |
| Talk pays | `METERS_V1.odds.rapport`, `.agitation` |
| Groups follow a surrender | `CASCADE_V1.base` |
| Force lethality | `FORCE_RISK_V1.<profile>.fatal`, capped below serious, bare hands stay 0 |
| Officer exposure | `INCOMING_FIRE_V1.hit.<weapon>` |
| Pace | `RESOLUTION_TUNING.bandTime.*` |
| Strain per choice | `RESOLUTION_TUNING.bandStress.*` |
| Reward baseline | `OUTCOME_SCORE_V1.factor.base` |

- When a dial's fields no longer fit its pattern (edited by hand), it shows "custom" and **Make them move together**.
- **Advanced fields** (`adv=1`) list every raw field of the group: label, raw path, help, unit, range, read-mode badge, default, saved, now, revert.

### Read modes and read-only fields

| Badge | Means | In the lab |
| --- | --- | --- |
| Live | read while a call plays | editable; previews and runs use it |
| New only | stored when a card, recruit or unit is made | editable; affects new ones only |
| Department | economy, roster, careers | editable; no call-level preview |
| Labels | display only (risk labels) | editable |
| Generation | read when a call is generated (`SPATIAL_TUNING.coverReach`) | read-only |
| Structure | the game's structure, not its balance (`ROSTER_TUNING.maxSquads`, `AUTHORIZATION_V1.believed`, `.concessions`, `.deadlyForce.guns`, `.inReach`) | read-only |
| Unused | read nowhere | hidden behind "Show unused (n)" with why |

Tables the lab leaves alone (**Can't tune here**, `READONLY_TABLES`), each with its reason:

- `LOCATION_TUNING` is baked into the building cache.
- `STRESS_BANDS`, `COMMAND_STAFF` and `EQUIPMENT_MANAGER` are copied at load time.
- `TIER_REWARD_MULTIPLIERS` and `IDENTITY_DEFAULT` change generated calls and break the frozen fingerprints, so they change by content version instead.

Guards refuse values that would break the engine's assumptions, for example `favorableAt` at or below `adverseAt`, a setback or luck chance under 0.005, or a force profile where fatal isn't below serious. The header names any refused part ("Not applied: …") and Save stays off until it is fixed.

### Checking a change

| Tier | Runs | When |
| --- | --- | --- |
| **Instant** | engine odds at the current Play step, before → after | on every change |
| **Quick check** | this call, random style, 600 runs per side, saved and patch paired | 600 ms after the last change |
| **CI gate** | the 24 CI checks, saved and patch (saved side cached) | on demand, about 9 s |

Previews by group: the band curve with this moment's choices on it, force outcomes, officer hit chance, follow chances, meter events, minutes per choice.

### Saving

- **Save…** shows the diff against `tuning.json`, the last gate result for this patch (or "not run"), and the tests that pin values in the changed tables.
- Confirm posts to `/__lab/tuning` with the file's hash. The server writes `src/sim/tuning.json` with sorted keys, holding only fields that differ from the source defaults. Vite reloads the page, and the lab shows "Saved n values to src/sim/tuning.json. Run npm run verify." with the pinning tests as a checklist.
- If `tuning.json` changed on disk since the page loaded, nothing is written and a sheet asks you to reload; the unsaved patch survives the reload and lays over the new file.
- **Reset to defaults** stages a patch back to the source values; Save then writes `{}`. **Discard** drops the patch; **Undo** (`⌘Z`) steps back one edit.
- In a static build Save is off; **Copy patch JSON** copies the file Save would write.

### Tests that pin numbers

`PINNED_BY` in `src/sim/tuning-meta.ts` lists, per table, the test files whose assertions hard-code its values: `resolution.test.ts`, `meters.test.ts`, `outcome-score.test.ts`, `force-risk.test.ts` and others, plus `src/gen/incident/trees-v13/call-tree-balance.test.ts` (the CI gate) for every table read during a call. `tuning-tables.test.ts` checks each listed file exists. After a save:

```bash
npm run verify
npx vitest run src/gen/incident/trees-v13/call-tree-balance.test.ts   # the gate alone
```

A failure there means a test hard-codes a value you changed, or the change moved a call out of a gate band.

## People colors

Call text colors each named person by what the player has been told they are. The game and the lab use one matcher (`src/ui/people/lexicon.ts`, `PeopleText`).

| Kind | Color | Second cue | Mark | Hover |
| --- | --- | --- | --- | --- |
| Subject | `#b99cff` | weight 600, solid underline | filled diamond | Subject |
| Civilian (also held, trapped or hurt people) | `#ffa6da` | weight 600 | disc | Civilian |
| Person at the scene | `#8d9cb4` | weight 500, dotted underline | ring | Person at the scene |
| Officer | `#9cc4ff` | the callsign face, Barlow Condensed 600 | shield | Squad A |
| Named, kind withheld (group followers) | body text | weight 600 | hollow diamond | Named; role not confirmed |

Color never carries the meaning alone. Every kind passes WCAG AA on every game surface.

**Not colored:** pronouns, role nouns ("the caller"), places, map labels, names inside status chips, toasts, contributor labels. Building and room names are masked first, so "Cedar Park Apartments" never colors officer Park.

**Truth-leak rules:**

1. Color comes only from the call's public kind and the deployed officer list, never from the hidden kind, hold, threat or weapon.
2. A person is colored only once the team has a report of them, the same rule the map uses.
3. Group followers always read "named, kind withheld": knowing where someone is isn't knowing what they are.
4. Hostage, victim and trapped aren't public kinds; they read as civilians.
5. Hidden truth shows only in the lab, on tape, outside the game's markup.

**The switch:** "Color names by role" in the game's Saves sheet, on by default, stored per browser in `localStorage` `ti-pref-people-color` (not in the save). The lab's mirror is the Names toggle, `P` on Play, or `names=0`.

## Where things are saved

| What | Where |
| --- | --- |
| Review notes and the call verdict | `docs/calls/notes/<type>.json` (dev server); `localStorage` `ti-lab-notes:<type>` in a static build |
| Saved tuning | `src/sim/tuning.json` (dev server) |
| Unsaved tuning patch | `localStorage` `ti-lab-tuning-patch` |
| Baseline pin | `localStorage` `ti-lab-baseline:<type>` |
| Gate and this-type results | `sessionStorage` `ti-lab-job:*` (about 2 MB, oldest dropped) |
| Open in lab snapshot | the game's `localStorage` `ti-lab-handoff:<nonce>` |

Dev server endpoints (`vite.config.ts`, dev only; a static build never calls them):

| Endpoint | Does |
| --- | --- |
| `GET /__lab/ping` | `{ ok, python }`: the status dot and whether string checks can run |
| (every route) | answers only the lab's own page: a request from another origin (another localhost port included) or a cross-site fetch gets 403, and a write must be `application/json` |
| `GET`, `POST /__lab/tuning` | read or write `src/sim/tuning.json`; 409 when the file changed since it was read |
| `GET`, `POST /__lab/notes/<type>` | read or write `docs/calls/notes/<type>.json`; 409 the same way |
| `POST /__lab/string-checks` | run the swat-call-prose checker on posted lines (needs python3); cast names that could read as checker options are refused |
| `GET /story.html?…` | 302 to `/lab?…` |

## Limits

- **Reference squad.** Without a handoff, the lab plays squad A of campaign seed 719 (Harjit Singh, May Thiri Aung, Dara Vann, Francesca Moretti) with the day-one kit. No day-one squad A in seeds 1 to 500 holds vehicle operations, so the rescue's vehicle choices stay locked unless you grant the cert.
- **One deployed squad.** The lab deploys squad A only; card odds equal commit odds only then. Runs play squad A, so a handed-over game state that deploys another squad can be stepped but not simulated (the lab says so), and acting or support squads changed in the game's sheet aren't carried into the lab's commit.
- **Forced drawn results** come from a dev-only search of the engine's dice (`aimedDrawnState` in `src/gen/incident/gates/engine-driver.ts`), checked against what the engine recorded. A combination rarer than about 1 in 4 million may not be found, and is then refused.
- **Play here and Find a path** search up to 6,000 states. When nothing is found the lab says whether the walk covered every state; an ending ruled out by this situation's hidden truth, a missing cert or a clock is a fact of the call, not a search limit.
- **Narrow bands.** A band the dice allow in a margin window under 1% (about 0.6 margin points) can't be forced (`sampleFor`), so the lab says "Can't be forced here" with its natural chance, Roll takes it, and the walk skips it: a "no path" then says how many such results it skipped instead of claiming every state.
- **The frame** is faithful at 390 and 430 px only. It has no campaign bar or bottom navigation, and the game's short-screen rules read the lab window, not the frame (a chip warns under 701 px tall). For narrower phones use True device, which runs on saved tuning only.
- **Not modelled:** several deployed squads; department-level previews in Tuning; the read-only tables above; lint for a band with no routed outcome (`missing_route`), which needs evaluation the compiler doesn't expose; side-by-side frames (use the baseline pin and Compare situations).
- **Typed frameworks and hand-authored stories** from before content v13 are no longer dispatched and aren't in the lab.

## Debug handle

In dev, `window.__lab` answers from the console or a Playwright script:

```js
__lab.url(); __lab.session(); __lab.frame()
__lab.visibleIds()     // card ids in the frame, in order
__lab.xray(); __lab.dilemma(); __lab.lint()
await __lab.measure('hostage_crisis', 'random', 60)   // equals measure() in trees-v13/balance.ts
await __lab.run({ kind: 'bench' })
__lab.jobs.active()    // 0 on load: nothing runs until asked
```

## Where the code lives

| Path | What |
| --- | --- |
| `src/lab-entry.ts`, `src/main.tsx` | `/lab` and `?lab` routing; the game and the lab load as separate chunks |
| `src/dev/lab/LabApp.tsx`, `context.tsx`, `url.ts`, `shell/` | shell, focus, URL, palette, notices |
| `src/dev/lab/surfaces/<name>/` | one folder per surface, plus `review/` |
| `src/dev/lab/model/` | sessions, explore and seek, Why, palette, X-ray, dilemma, notes, script, dials (pure, tested) |
| `src/dev/lab/jobs/`, `lab.worker.ts` | worker pool, tallies, runners, run defaults |
| `src/gen/incident/trees-v13/dependencies.ts`, `graph.ts`, `balance.ts` | the dependency index, lint, graph and gate suite the CI tests share |
| `src/sim/tuning.ts`, `tuning-meta.ts`, `tuning-tables.ts`, `tuning.json` | the tuning registry |
| `src/ui/lab-handoff.ts`, `src/ui/components/OpenInLab.tsx` | Open in lab |
| `src/ui/people/` | the people matcher, `PeopleText`, the switch |

Guards: `src/dev/lab/css-scope.test.ts` (every lab selector carries a `lab-` class), `game-css-guard.test.ts` (game CSS stays class-scoped), `no-store.test.ts` and `src/ui/ui-store-free.test.ts` (no store in the lab or the shared screens), `url.test.ts` (old links), `scripts/check-no-lab.mjs` (no lab in a plain build).
