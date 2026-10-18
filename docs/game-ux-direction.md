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
