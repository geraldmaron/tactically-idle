# Visual kit

One icon set and one visual kit for the Desk and Street direction ([ui-ux-audit.md](ui-ux-audit.md)).
Screens pick a name; nobody draws. See it all at `/harness.html?only=icons` (dev server), or in the
contact sheets [visual-kit-390.jpg](captures/visual-kit/visual-kit-390.jpg) and
[visual-kit-320.jpg](captures/visual-kit/visual-kit-320.jpg).

| Piece | Where | Use |
| --- | --- | --- |
| Icons | `src/ui/icons.tsx` | `<Icon name size title? />`, 168 line glyphs |
| Name tables | `src/ui/icons/kit.ts` | `TAB_ICON`, `RESOURCE_ICON`, `SKILL_ICON`, `OFFICER_STATUS_ICON`, `OUTCOME_ICON`, `GEAR_CATEGORY_ICON`, `GEAR_SOURCE_ICON`, `BRANCH_ICON`, `CALL_TYPE_ICON`, keyed by the sim's own ids |
| Call-type badges | `src/ui/icons/CallTypeBadge.tsx` | `<CallTypeBadge type size label? />` |
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

## Adopting the kit (wave 2)

- `components/labels.ts` still maps skills, branches and statuses to the older glyphs (`bullseye`,
  `nodes`, `compass` and so on). Switch `RATING_META`, `ROLE_META`, `BRANCH_META` and
  `STATUS_META` icons to `SKILL_ICON`, `BRANCH_ICON` and `OFFICER_STATUS_ICON` when those screens
  are restyled, then drop any old glyph nothing uses.
- `CallTile`, `Casebook` and `OpsPrepare` already read `incidentMeta(type).icon`, so they show the new
  call-type marks now; swapping their badge markup for `CallTypeBadge` is the screen work.
- The four call-type hues are the only colours `kit.css` defines. Move them into `theme.css` as
  tokens when the ui-system tokens land.

## Deferred

Painted call-type medallions to match the scene plates. The SVG badges read at every size from 20px
up, and no image generator was available for a pack that would pass `docs/art/ART-DELIVERY.md`,
so no raster files were added.
