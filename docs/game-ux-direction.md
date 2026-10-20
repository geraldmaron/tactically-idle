# Game UX direction: visual-first surfaces and Command Staff

**Status:** visual surfaces and Command Staff v1 are implemented. The three managers are on HQ. Work still to do lives only in [docs/backlog.md](backlog.md).

## The problem

Most surfaces explained themselves in sentences. Develop was a 4,450px column of 20 near-identical text cards ("Unlocks purchase: X · Unlocks purchase: Y"). Gear put a five-column number table and a full-width buy button on every item. Debriefs were a title, a chip and a run-on line ("Objective Follow-Up Agreed · Civilians Everyone Safe"). The game already owns painted portraits and gear art, but most screens didn't use them.

## Patterns we follow

These are the conventions of current mobile management and idle games (collection grids, tech trees, manager rosters, result cards):

1. **Art first, words second.** Each thing has a face: a portrait, gear art, or an emblem. The name is the caption, not the content.
2. **Numbers become shapes.** Use a count badge (×6), a condition strip, a score ring, or tier pips. Exact values live in the detail sheet and in accessible labels.
3. **One tile, one tap.** A tile opens its sheet. Secondary actions (restock, service, scrap) live in that sheet, not on every tile.
4. **Attention is a pip.** An alert dot, a glow on whatever you can buy now, and a dimmed lock on what you can't.
5. **Progress per collection.** Each branch or set shows owned / total as a bar.
6. **Caps and no bleed.** At most five operations on the board. Nothing scrolls sideways or gets cut off at a screen edge.

## Shipped in this slice

| Surface | Before | Now |
| --- | --- | --- |
| Ops board | 15 launchable operations, about 8,500px | Live tactical calls only, with one call per kind and compact fact rows. |
| Live operation | 4 full-size cards with clipped edges, 4 stress gauges, text legend row | 4-up strip that always fits, stress chips, key on the map, slim locked choices |
| People / Care & support | Plain lists | Status tiles with avatars, a located meter, a Request → Arrive → Hand over track |
| Gear inventory | Five-column table and a buy button per item | Art tile grid: ×count, ready count, condition strip, alert pip. Restock and stats move to the sheet. |
| Develop | Text column | Branch rails with progress bars. Each prerequisite sits above its children with connectors. Medallions show gear art, a course or the branch symbol. Unlocks show as art chips. Buy-now nodes glow; locked ones are dimmed with a lock. |
| Squad and Training (2026-10-06) | Two-up portrait cards with age and service text, prose-heavy officer sheet, tall course and candidate cards | Four-up officer tiles (squad letter, leader star, status badge, stress pill, qualification pips), squad coverage strip (roles held, best rating per skill), unassigned bench with one-tap assign, roster grid with Free/Busy filter and sort. Officer sheet: hero header, XP ring, stress gauge, skills as bars. Candidates: rating bars and chips. Training: two-up course tiles with emblem (art from `public/art/emblems/manifest.json` when listed, else an icon), places as pips, comparison rows with the course gain drawn on the bar. |
| Recent debriefs | Title, chip, sentence | Result tile: tone stripe, objective and civilian score rings, team faces, reward icons |
| Gear: Inventory and Equipment (2026-10-07) | Inventory tiles plus a text-heavy maintenance block; a 27-card Equipment list (about 8,700px, a paragraph and two buttons per item); five-stat table and a bordered card per unit; per-item restock cards for every item | One tile for both surfaces. Inventory: ready, busy and attention pills, a Buy equipment tile, a unit sheet with a segmented stock bar and one-line unit rows that expand to facts and Service or Scrap. Equipment: a collection bar, tiles grouped by category with owned / total, glow on buy-now, dashed and dimmed behind a lock when purchase locked, a price caption and a certification pip (about 1,800px). Detail sheet: chips for unlock, price and certified officers, capability chips, upkeep and action fit folded away. Restock rules are set in the item's sheet and listed as rows under Maintenance. The Quartermaster card opens the same Command Staff sheet as HQ, so the service budget lives in one place. |
| Ops flow (2026-10-07) | Board cards about 350px each, a 1,000px briefing, 1,500px of support vehicles, a 4,500px Prepare, decisions below the last result, odds below the fold in the review | Call tiles (type badge with tier pips, two-line summary, time-left bar, Prepare). Prepare: briefing at a glance (Known, Open, People, Threats), squad cards with faces and a ready bar, gear tiles with art and counts, support vehicles in a disclosure, a sticky footer that says what is missing. Live: compact title and stage rail, a last-result line above the decisions, the full record and care and support after them, a Next decision shortcut while the choices are below the screen. Review: odds as a three-part bar and harm as a pill in the sheet header, requirements and supplies as chips. Debrief: tone hero with the ending, score rings, reward chips, officer tiles with XP and a stress change bar. Toasts move to the top while a footed sheet or the debrief is open. Styles in `src/ui/screens/ops-visual.css`. |
| Department pass (2026-10-19) | Gear split into Inventory and Equipment; Develop a grid of small tiles with 10px connector stubs; the hire review three text rows inline; money a number that jumped each tick; officer sheet a long column with expanders; about 35 expanders in five different styles | **Armory**: one catalog list, owned stock (count, condition strip, attention mark) on the same tile that buys more, one filter rail (All, Owned, Attention, Buy now), one item sheet for buying, stock, units and restock; standing tools (restock rules, presets, wall materials, the Quartermaster) open from the header. **Develop**: a Next card, branch tabs, and each branch as a vertical research track with edges drawn from the prerequisite's medal, and each row saying what it does next, its cost and what it needs. **Hire**: a contract sheet with money as bars on one scale (funds now and after, net rate now and after) and the kit the officer brings. **Money**: the balance follows the hourly rate and floats every payout and charge as a signed chip; one Finances view holds the rate, its parts and recent activity. **Officer profile**: hero with wage, learning pace and teaching rate, readiness in view, Overview, Career and Care tabs, actions in the footer. **Disclosure**: see below. |

| Scene pass (2026-10-19) | About 200px of header and save bar on every screen; the live call's prompt two screens down under the full briefing, the map and the officers; a decision's result rendered below the next choices with a toast pointing at it | **Header**: one 56px row, mark instead of lockup, saves behind a bookmark with a dot when unsaved, and a red strip only when saving fails. **Live call as a scene**: a pinned title with the stage rail, clock and pressure; the briefing folded; *What happened* first; the stage prompt as the hero line; the radio transcript; the choices; then the map, the team and the people. After a decision the scene returns to the top, and a polite live region reads the result. **Depth surfaces**: transcripts (`Transcript.tsx`), an amber "Command hasn't approved this" line on a lie, the ending epilogue in the debrief hero, and a 3-line board hook. |

| Night-shift skin and game patterns (2026-10-19) | Flat navy panels; no art on calls or tabs; HQ a scroll of cards; Ops one tab among five; results a title and two rings | **Art**: twelve Codex-generated plates in `public/art/plates` (a scene per call type, a room per tab, the HQ cutaway, two textures), prompts in `docs/art/scene-pass/`. **Skin** (`src/ui/skin.css`): grained ground, panels with depth, case-file tabs and stamps in IBM Plex Mono. **Patterns from management games, each challenged first**: HQ is a hub, a building cutaway whose rooms are labeled buttons with status and alert dots; Ops is the raised center action with action-only badges; call cards preview what a call pays; the result screen grades with three marks from the outcome score, which already ranks talking out above force, and a death empties the marks and mutes the screen. Rejected: rarity frames on officers (people are not loot, E3), daily quests and streaks, and a fake "Collect" for offline earnings that are already applied. |

| Build-tab patterns (2026-10-19) | Shift report only as an HQ card; officer tiles with no growth on them; Develop costs as text pills and a five-branch rail that scrolled and clipped; Armory prices as captions under about 400px of header | **Welcome back**: a *While you were away* sheet on load and after at least 15 minutes hidden, built from the shift report (`WelcomeBack.tsx`): time away and net funding on the HQ painting, then only the lines that changed (points, courses, recoveries, kit and restocks that need a look, the 24-hour cap), the full report folded, and Continue to acknowledge. **Squad**: officer tiles badge the role's main rating with an XP ring toward its next point. **Develop**: rows end in an Unlock or Upgrade button with its price (Save up when short, a lock when gated) that opens the confirm sheet; branches are five fixed tabs. **Armory**: each tile ends in a price tag (gold when it can be bought now, red when funding is short, dashed behind a lock); stock counts moved to the banner. **Grade**: force or a partial close caps the result at two marks, an open call at one. **Small phones**: squad tabs drop names and Armory filters tighten so no rail scrolls at 320px. |

### Build-tab patterns, challenged

Each familiar pattern was argued against before it was built. The verdicts:

- **Welcome-back sheet.** Strongest failure: a modal on every return nags, and one that opens mid-call buries the scene the player came back to. Alternative: keep the report as an HQ card only, which a player landing on Ops never sees. Verdict: accepted with controls. It opens only on load or after the page was hidden for at least the settlement's own 15-minute report threshold, never when a course finishing mid-play adds to the report; one Continue clears it; closing it keeps the HQ card. No Collect button, because the money was applied when the time settled and a button that pretends otherwise is a lie.
- **Level badge on officer cards.** Strongest failure: officers have no level, so a level number would invent a stat and push the roster toward loot. Alternative: no badge, growth only in the profile. Verdict: accepted with controls. The badge shows the role's real main rating and its ring the real XP toward the next point (`officerGrowth`, the same numbers as the profile), and the tile says both aloud. No rarity frames (E3).
- **Upgrade buttons in Develop.** Strongest failure: a one-tap buy on a scrolling list spends scarce, permanent development points on a mis-tap, and nothing undoes it. Alternative: the idle-game buy button that buys on tap. Verdict: accepted with controls. The button looks and reads like the research-lab Upgrade it is, but the tap opens the sheet that confirms the spend, the pattern strategy games use for permanent research.
- **Armory shop grid.** Strongest failure: a gold price on every tile turns the Armory into a store front and hides what the department already holds. Alternative: price only in the sheet. Verdict: accepted. Owned count, condition and attention stay on the same tile, and the tag's colour says whether a buy is possible now, which is the one decision the grid serves.
- **Three-mark grade.** Found in the sweep: the marks came from the safety score, which does not count the team's own force, so a call closed by taking a man by hand with shots fired earned three marks. Verdict: rejected as built and fixed. Force, a partial close or an agreed follow-up caps the grade at two, and an unresolved or incomplete call at one (found by the Codex adversarial review); talking everyone out to a resolved close is the only way to three.

## How the game reveals more

One rule per kind of hidden content (disclosure-taxonomy, 2026-10-19):

- **Always visible:** harm, losses and civilian outcomes. Never behind a control.
- **Disclosure** (`src/ui/components/Disclosure.tsx`): evidence and logs inline, such as why an outcome happened, the decision record, odds factors, the full briefing and extra scene conditions. One summary row with a count and a chevron.
- **Sheet:** reference that is not about this moment (the map key) and anything with its own actions (an item, an officer, a hire, finances).
- **Chip rail:** filters (the Armory, the casebook). Always visible, never folded.
- **Show all:** long lists keep a plain button (HQ results, decision choices).

## HQ presentation

HQ stat tiles are label, number and sentence. Their visual update is tracked in the [backlog](backlog.md#player-experience).

## Command Staff v1

Command Staff is a visible roster on HQ. Hiring is a Develop purchase. Each manager has a card and detail sheet with policy controls and an activity log. Managers never make tactical choices, and automation has an off switch.

The strongest failure mode is automation removing the decisions that make the game interesting. The current scope is accepted with controls: managers automate department routines with visible policies and logs. Peer Support Lead, Recruiter and the scope of routine patrol work belong to the [backlog owner decisions](backlog.md#owner-decisions).

The built roster has three managers. The Watch Commander runs duty rotation.

| Manager | Hire | Salary | Policy | Automation (each clock hour, inside the 24h accrual window) |
| --- | --- | --- | --- | --- |
| Watch Commander (`watch_commander`) | Develop `personnel_watch_commander`, 2 DP + $1,500 | $45/h while on | Rest limit (30-80, default 60), per-squad manual opt-out | Rests an idle squad when any member reaches the limit; returns it to its earlier duty (Patrol if unknown) once everyone is below 30. Uses the setSquadDuty rules, so deployed squads are never touched. |
| Training Sergeant (`training_sergeant`) | Develop `personnel_training_sergeant` (needs Training academy), 2 DP + $1,800 | $45/h while on | Course (unlocked courses only), funding reserve (default $2,500) | Fills free training places with the lowest-stress eligible officer below 30 stress, using the startCourse rules, only if funding after the fee stays at or above the reserve. |
| Quartermaster (`quartermaster`) | The existing equipment manager node | None | Hourly service ceiling | Unchanged equipment-manager servicing; on/off is the service budget. Its log records servicing and restock spend. |

Code: `src/sim/command-staff.ts` (state, commands `setManagerEnabled` / `setManagerPolicy`, settlement hook, save validation), `src/ui/components/CommandStaff.tsx` (HQ roster and sheet), `src/ui/art/ManagerArt.tsx` (portrait with silhouette fallback). Only current-version saves load; old saves are rejected. Balance values are tunable.

## Art contract

Manager portraits and course and branch emblems are tracked in the [backlog](backlog.md#player-experience). Art uses one image per generation call, files under `public/art/<set>/` and that folder's `manifest.json` under `readyIds`. Missing art uses the existing icon or silhouette fallback. Portrait style is defined in `docs/art/portrait-style.txt`.
