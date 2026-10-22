# Visual kit

One icon set and one visual kit for the Desk and Street direction ([ui-ux-audit.md](ui-ux-audit.md)).
Screens pick a name; nobody draws. See it all at `/harness.html?only=icons` (dev server), or in the
contact sheets [visual-kit-390.jpg](captures/visual-kit/visual-kit-390.jpg) and
[visual-kit-320.jpg](captures/visual-kit/visual-kit-320.jpg).

| Piece | Where | Use |
| --- | --- | --- |
| Icons | `src/ui/icons.tsx` | `<Icon name size title? />`, 168 line glyphs |
| Name tables | `src/ui/icons/kit.ts` | `TAB_ICON`, `RESOURCE_ICON`, `SKILL_ICON`, `OFFICER_STATUS_ICON`, `OUTCOME_ICON`, `GEAR_CATEGORY_ICON`, `GEAR_SOURCE_ICON`, `BRANCH_ICON`, `CALL_TYPE_ICON`, keyed by the sim's own ids |
| Call-type badges | `src/ui/icons/CallTypeBadge.tsx` | `<CallTypeBadge type size label? medallion? />` |
| Call-type medallions | `src/ui/art/Medallions.tsx`, `public/art/medallions/` | painted discs, used by `CallTypeBadge` at 40px and up ([medallions README](art/medallions/README.md)) |
| Tab-root plate | `src/ui/art/TabPlate.tsx`, `src/ui/art/tab-plates.ts` | `<TabPlate tab title meta? />`: the room's banner at `--plate-h`, the tab icon and name, no kicker or paragraph |
| Status and outcome marks | `src/ui/icons/marks.tsx` | `<StatusMark status />`, `<OutcomeMark band label />` |
| Empty-state spots | `src/ui/icons/spots.tsx` | `<Spot name width? />` |
| Kit styles | `src/ui/icons/kit.css` | imported by the components; class-scoped |

`src/ui/icons/icons.test.ts` fails if a name written anywhere in `src` doesn't resolve, if a glyph
draws nothing, if a kit table points at a missing name, or if two call types share a shape, hue or mark.

## Icon rules

- 24px grid, stroke 1.75, round caps and joins, `currentColor`, no fills except the `more` dots.
- Sizes: 16 inline with 12 to 14px text, 20 in rows and chips, 24 in tabs and the resource bar.
- Decorative by default (`aria-hidden`). Pass `title` when the icon is the only label.
- Never add a second drawing for a meaning that has one. Add the meaning to a table in `kit.ts`.

## New icons

### Tabs and resource bar

| Name | Use |
| --- | --- |
| `hq` | HQ tab: the station with its flag |
| `calls` | Calls tab: the beacon (carries the count and the live ring) |
| `officers` | Officers tab: an officer in a peaked cap |
| `build` | Build tab: hammer and wrench crossed |
| `funds` | Funds in the bar: a coin stack |
| `rate` | Income per hour: a clock with a rising arrow |
| `trust` | Public trust: a shield with a check |
| `level` | Department level: three rank chevrons |
| `menu` | The bar's Menu sheet |

### Skills

| Name | Skill |
| --- | --- |
| `shooting` | Shooting proficiency (a sight picture, not a weapon) |
| `communication` | Communication (headset) |
| `medical` | Medical response (first aid kit; also the medical gear category) |
| `composure` | Composure (spirit level) |
| `awareness` | Awareness (radar sweep) |
| `coordination` | Coordination (linked) |
| `leadership` | Leadership (an officer under a star) |
| `observation` | Observation (an eye in a viewfinder) |

### Officer status, as line icons

One figure plus a modifier, so they read as a family: `ready` (check), `strained` (!), `injured`
(bandage), `training` (rising arrow), `deployed` (arrow out), `resting` (moon). Use these inside
text and rows; use `StatusMark` where status is the point of the element.

### Outcomes

`wentWell` (circle, check), `complications` (diamond, wave), `wentBadly` (square, cross). The same
three silhouettes as `OutcomeMark`, so a line icon and a filled mark agree. `wentWell` is the same
drawing as `checkcircle`, named for its meaning.

### Call types

`hostage` (one person held behind another), `barricade` (a door boarded across), `activeArmed`
(an alert with radiating lines), `rescue` (a life ring). These are the marks inside the badges, and
`incidentMeta` now returns them; the hostage type no longer shows the padlock.

### Gear categories (`GEAR_CATEGORY_ICON`)

| Category | Name |
| --- | --- |
| comms | `walkie` |
| intel (Observation) | `binoculars` (existing) |
| protection | `vest` |
| access | `ram` |
| medical | `medical` |
| response | `hardcase` (a closed case: the game shows no weapon as an icon) |
| less_lethal | `lessLethal` |
| vehicles | `van` |
| supplies | `crate` |

### Gear source (`GEAR_SOURCE_ICON`)

`basicKit` (a vest with a check) marks the basic kit every officer carries: radio headset, sidearm,
carbine and light armor (`sim/basic-kit.ts`). It is never stock, so put it beside those items
wherever they appear with pooled gear (the team step, the Armory, the hire contract). Pooled armory
stock keeps `box`.

### Upgrade branches (`BRANCH_ICON`)

personnel (Staff) `idcard`, field (Field skills) `route`, intel (Information) `dossier`, logistics
(Equipment support) `pallet`, wellbeing `mug`.

### Navigation and actions

`stepOut` (leave the live call without cancelling it), `map` (Map in the brief head), `tap`
(tap-to-earn and tap hints), `more` (overflow, where Dismiss moves), `filter` and `sort` (Roster),
`play` (resume), `arrowLeft`, `arrowUp`, `arrowDown`, `chevronsUp` (promotion, level up). The
existing `chevronLeft`, `chevronRight`, `chevronUp`, `chevronDown` and `arrowRight` complete the set.

The 114 earlier icons are unchanged; the gallery's "Every icon" grid shows them all by name.

## Call-type badges

Each type has its own shape, hue and mark, so it reads without colour too.

| Type | Shape | Hue | Mark |
| --- | --- | --- | --- |
| Hostage crisis | circle | violet `#b99cff` | `hostage` |
| Barricade | rounded square | cyan `#4fc3d9` | `barricade` |
| Active armed incident | diamond | rose `#ff7a8a` | `activeArmed` |
| Protected rescue | shield | sky `#6ea8ff` | `rescue` |
| Unknown type | circle | slate | `pin` |

`size` 20 in a chip, 24 to 28 on a call card, 40 or more as a hero. `label` shows the name from
`incidentMeta`, so the badge never names a type differently from the rest of the game. Without a
visible label the badge carries the name as `aria-label`. On a scene plate, sit it on a dark chip
(the gallery's "On the scene plates" row shows the treatment).

## Status and outcome marks

Small filled silhouettes with the glyph cut out, and the label beside them by default. Shape
carries the meaning; colour only reinforces it (checked in the gallery's greyscale rows).

| Mark | Shape | Tone |
| --- | --- | --- |
| `ready` | circle, check | good |
| `strained` | triangle, ! | warn |
| `overloaded` | octagon, cross | warn |
| `recovery` | half-filled ring | harm |
| `injured` | square, cross | harm |
| `training` | pentagon, chevron | officer blue |
| `detail` | card, lines | officer blue |
| `deployed` | tag | officer blue |
| `resting` | crescent | slate |
| `retiring` | hourglass | warn |
| `favorable` | circle, check | good |
| `mixed` | diamond, wave | warn |
| `adverse` | square, cross | harm |

Status labels come from `STATUS_META` in `components/labels.ts` (plus "Resting"). Outcome marks
take the screen's wording (`RESULT_LABEL` after a call, `FORECAST_LABEL` on a preview). Pass
`showLabel={false}` only where the same words are already visible next to the mark.

## Empty-state spots

160 by 112, chalk line work on the night panel, blueprint blue through the glass, one warm light.
Amber appears only where the empty state is the player's move.

| Name | Screen | Scene |
| --- | --- | --- |
| `noCalls` | Calls, nothing on the board | the dispatch radio on standby, coffee, the moon |
| `noDebriefs` | Casebook, no debriefs yet | an empty in-tray under the lamp |
| `noCandidates` | Officers, Hire, nobody to interview | an empty chair, a blank clipboard |
| `nothingInStock` | Build, Armory, empty stock | dashed outlines on bare shelves, an open crate |
| `openSlot` | Squads, an open place | two filled places and one dashed, with the amber add |

The spot is decorative; the screen writes the line under it (follow the player-facing writing
rules in `AGENTS.md`).

## Where the kit is used

`src/ui/visual-floors.test.ts` lists each obligation by name, with its production screen and fixture
state, and fails when a screen loses a picture it is owed. The list only grows.

- **Tab roots.** HQ, Calls, Officers and Build each open on a `TabPlate`. The height is one token,
  `--plate-h` in `theme.css` (96px; the owner's candidates are 72, 96 and 128), and which tabs carry
  one is `TAB_PLATES` in `art/tab-plates.ts`. A tab that drops its plate drops its obligation with it.
- **Tabs and bar.** The four tabs draw `TAB_ICON`; funds, rate, trust and level draw `RESOURCE_ICON`.
- **Rows.** Every officer row leads with a face and ends in a `StatusMark`. Training courses lead
  with their emblem, upgrades with gear or emblem art, Armory tiles with gear art, call cards with
  their scene and type badge, Casebook rows and result tiles with the type badge or medallion.
  Skill, role and branch icons come from `SKILL_ICON` and `BRANCH_ICON` through `components/labels.ts`.
- **Headed steps.** The brief leads with the call-type badge, deploy and the debrief with a kit icon;
  "Your orders", "Who goes", "carries", "Going in" and "Review the operation" each start with an icon.
  The debrief hero carries the call's medallion.
- **Empty states.** `EmptyState` takes `spot`; every empty state in the player screens passes one.

Still open: `HQ` duty rows lead with a squad letter, not a picture.

## Medallions

Painted call-type discs matching the scene plates, delivered 2026-10-22: see
[art/medallions/README.md](art/medallions/README.md). The SVG badges remain the small-size and
fallback form.

## UI gates

Code-level checks for visual antipatterns on every surface, at 320, 390 and 430 wide (backlog `ui-gates`,
rules R1 to R18 from the 2026-10-22 audit). Two halves share one baseline.

**Debt is a ratchet.** `src/ui/ui-debt.json` holds every rule's count, by file for source rules and by
`state@width` for rendered rules. A gate fails when a count **rises** (new debt) and when it **falls**
without the file being regenerated (debt paid stays paid). Every rule is flagged `target: 0`; a rule with
no entry is already at zero. Nobody edits the file: `npm run ui:baseline` writes it from today's source and
UI, and the lead reads the diff at each merge. A change that pays debt runs `npm run ui:baseline` and commits
the new file with it.

| Half | Run | What it does |
| --- | --- | --- |
| Static | `npm test` (`src/ui/ui-gates-static.test.ts`) or `npx vitest run src/ui/ui-gates-static.test.ts` | Reads `src/ui` CSS and TSX (`scripts/ui-gates/`), counts each rule, compares with the baseline. Each detector also has a negative control in the test: a fixture that must trip it and one that must not. |
| Rendered | `npm run check:ui` (starts a dev server on 5174 if none is up) or `npm run check:ui -- http://localhost:5174/` | Runs the 40 rendered controls (a page per rule that must fail it), then walks every registered state at each width (`--widths 390` for one), probes each scroll segment, and compares with the baseline. Needs Chrome (`CHROME_PATH` overrides the Mac default). |
| Baseline | `npm run ui:baseline` | Rewrites `src/ui/ui-debt.json` (static and rendered). `--widths 390` rewrites only that width's rendered entries. |

The probe (`scripts/ui-gates/probe.mjs`) measures the active surface only: the open sheet, else the screen
with its chrome, so text behind a sheet is not counted. It follows ancestor clipping, gives each element a
stable id, and hit-tests targets. `docs/captures/ui-ux-audit/tools/capture.mjs` is the same walk with
screenshots (`node capture.mjs <repo> <outDir> <baseURL> [widths]`). The thresholds and the list of
states are in `scripts/ui-gates/manifest.mjs`: that is where the owner tunes the first-choice budget (R16)
and where a new surface or state is registered (R17).

| Rule | Where | What it counts |
| --- | --- | --- |
| R1 | static | `padding`, `margin` and `gap` declarations with a raw px or rem length instead of an `--sp` token; inline style spacing in TSX (`R1.tsx`) |
| R2 | rendered | content blocks that miss the surface gutter (`R2.gutter`); content flush against the border of its card (`R2.flush`) |
| R3 | static | `gap` declarations off the 4/8/12/16/24/32 scale (a subset of R1). The rendered sibling-gap check is not built |
| R4 | static, rendered | headings that do not open with a picture, `<Section>` without `icon`, shared `<Row>` without `lead`, rules that hide a glyph (`R4.*`); headings in the DOM (`R4.rendered`) |
| R5 | static | "Basic kit" without the basicKit glyph, officer status or outcome drawn by hand instead of `StatusMark` and `OutcomeMark` |
| R6 | rendered | targets whose effective hit region, found by `elementFromPoint` including labels, is under 44px either way |
| R7 | static, rendered | CSS text under 14px (`R7.sub14`), under 12px (`R7.floor`), inline `fontSize` formulas (`R7.dynamic`); rendered text under 12px, and under 14px inside a control |
| R8 | static | literal colors (hex, color functions, names) in CSS and TS outside `theme.css`; `R8.mask` counts the alpha-only mask exception |
| R9 | static, rendered | `<Icon>` sizes outside 16/20/24, stroke other than 1.75, dynamic sizes, CSS that sizes an icon off the grid; rendered icons off the grid |
| R10 | static | rules outside `app.css` that set a shared family's look, badge-shaped rules outside the chip family, switches built by hand |
| R11 | static | bespoke "No ..." empty states and hand-built error messages outside `EmptyState` |
| R12 | rendered | sideways page or surface overflow, text or controls cut off sideways, essential copy cut by a clamp, ellipsis or clip |
| R13 | rendered | content inside the safe-area insets, under a bottom fixture (47 top, 34 bottom) and a side fixture (44 each side), set with `Emulation.setSafeAreaInsetsOverride`. Scrolling content may pass under the top and bottom insets; it has to clear them where the scroll starts and ends |
| R14 | rendered | text under 4.5:1 (3:1 large text and icon-only controls), composited through ancestor fills and opacity. `R14.painted` counts text with art behind it that already fails on its base fill; the pixels behind it are not gated (`UI_GATES_SAMPLE_ART=1` prints a sampled report, `R14.sampled`, for a human to read) |
| R15 | rendered | chips with under 4px between their text and border, top or bottom |
| R16 | rendered | live stages whose first choice title is not in the first viewport (320 may show a `data-choices-below` affordance instead) |
| R17 | rendered | registered states the walk did not capture, never scrolled to the end of, or that raised a probe or page error; failed walk steps |
| R18 | rendered | visible images and CSS background images that did not decode |

Gaps, stated plainly: R3's rendered sibling-gap check is not built; R5's forecast rows are not yet checked in
the DOM; R14 does not gate the pixels behind art; R4 and R11 judge source and headings, not every row and
every state; the walk reaches the states listed in the manifest and nothing else (no loading state exists
to capture).
