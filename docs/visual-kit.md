# Visual kit

Current direction, 2026-10-22: **blue hour**. A painted working department, substantial people and
equipment, deep navy surfaces, ivory text, amber actions and mint funding feedback. The icon kit
remains shared. Screens choose a named glyph or an existing art component instead of drawing a second
version. See the glyphs at `/harness.html?only=icons` (dev server). The contact sheets
[visual-kit-390.jpg](captures/visual-kit/visual-kit-390.jpg) and
[visual-kit-320.jpg](captures/visual-kit/visual-kit-320.jpg) document the earlier kit, not the current skin.

**Implementation status:** the running blue-hour slice still has four destinations, SWAT patrol income
and paid-detail tapping. That tap preview is a **superseded draft**. The revised target is
[Patrol workforce and Store redesign](patrol-work.md): automatic income from a separate NPC patrol
workforce, no tapping or SWAT patrol revenue, and five management destinations: HQ, Calls, Team, Build,
Store. SWAT signing costs and wages remain. The visual direction below carries forward; the replacement
economy and navigation are not claimed implemented here.

## Direction and precedence

This revision supersedes the blanket no-banner rule in [ui-ux-audit.md](ui-ux-audit.md), its flat
Desk and Street skin prescription, and any reading of that audit as a reason to remove art. Its
spacing, readable type, touch targets, navigation and truthful state requirements still apply.
Art belongs where it helps the player recognize a place, a person or an object. Every tab does not
need the same decorative banner.

The R4 picture-first mandate and bans on hiding glyphs are also retired design contracts. Headings
and rows may lead with text; a redundant decorative glyph may be hidden. The legacy source checks,
tests and debt entries still need cleanup. They do not require restoring an unwanted picture or icon.

- **A place to return to.** HQ opens on the painted station at blue hour, with the department name,
  date and actual state chips over a dark lower area. The exterior replaces the earlier room cutaway;
  chip positions do not claim that an event occurred in a depicted room. `Hub` keeps the identity and
  state readable when its image fails. The First Run scene, call cards and debrief can carry atmosphere
  without becoming another layer of navigation.
- **People and objects have size.** Officer portraits carry the squad cards. Command staff keeps a
  face, post and duty state together. Armory equipment, training emblems and development medallions
  get enough space to be recognized, with ownership, eligibility, cost or progress beside them.
  Locked and unavailable objects retain readable labels and reasons.
- **Depth has a job.** Raised buttons, edged panels and restrained shadows separate actions and
  objects from the navy ground. Colour, spacing and shared component styling come from the existing
  tokens and owners. The blueprint keeps its own blue paper palette.
- **Live prose stays restrained.** The live call puts the scene prompt, spoken lines, threat and
  choices in reading order. Use plain type and clear spacing for that prose; artwork and expressive
  object framing must not compete with a person's words or the next decision. Amber identifies a
  move; a harm result does not receive a celebratory effect.
- **Currency follows the patrol ledger.** Settlement credits income automatically. A low-frequency
  event on visible HQ may show illustrated cash following a curved path from the patrol scene to the
  resource capsule, with an arrival pulse and no more than 24 sprites. Its coalesced amount must equal
  authoritative eligible ledger deltas. No collection button, unclaimed cash, tap tally or strain
  meter belongs in this target. Reduced motion updates directly; backgrounding, navigation, spending
  and campaign changes reconcile the balance. Animation grants nothing and stays off call decisions.
  Purchases and hiring confirm only after success; training confirms enrolment with benefits pending.

**Target navigation:** HQ contains patrol activity, net rate and the next management action; Team
contains SWAT, Patrol and Command; Build contains development and capacity; Store contains equipment
and usable offers. HQ, Calls, Team, Build and Store stay labeled and one press away on management
screens. The Store uses a recognizable shop symbol. Live calls retain focused navigation without
commercial offers. Hire and upgrade quotes show immediate and recurring costs, the unboosted net
change and payback; a patrol-gross boost must not be presented as the same multiplier on department net.

The current `TAB_PLATES` flags are all false. HQ uses `Hub`; the other department roots use their
screen heading and content. `TabPlate` remains available as a component, not an obligation to restore
four matching banners. Source image names, reconstructed generation intent and export dimensions for
the new station and currency are in [the scene-pass provenance](art/scene-pass/README.md).

| Piece | Where | Use |
| --- | --- | --- |
| Icons | `src/ui/icons.tsx` | `<Icon name size title? />`, the shared line glyphs |
| Name tables | `src/ui/icons/kit.ts` | `TAB_ICON`, `RESOURCE_ICON`, `SKILL_ICON`, `OFFICER_STATUS_ICON`, `OUTCOME_ICON`, `GEAR_CATEGORY_ICON`, `GEAR_SOURCE_ICON`, `BRANCH_ICON`, `CALL_TYPE_ICON`, keyed by the sim's own ids |
| Call-type badges | `src/ui/icons/CallTypeBadge.tsx` | `<CallTypeBadge type size label? medallion? />` |
| Call-type medallions | `src/ui/art/Medallions.tsx`, `public/art/medallions/` | painted discs, used by `CallTypeBadge` at 40px and up ([medallions README](art/medallions/README.md)) |
| HQ scene | `src/ui/components/Hub.tsx`, `public/art/plates/hub_hq.webp` | Painted station exterior with department identity and current state chips |
| Currency object | `public/art/plates/tex_cash.webp`, `src/ui/components/Finance.tsx` | Retained banknote art; target feedback presents automatic patrol-ledger income. Its current `TapEarn.tsx` use belongs to the superseded preview |
| Optional tab-root plate | `src/ui/art/TabPlate.tsx`, `src/ui/art/tab-plates.ts` | `<TabPlate tab title meta? />`; currently disabled for every tab in `TAB_PLATES` |
| Status and outcome marks | `src/ui/icons/marks.tsx` | `<StatusMark status />`, `<OutcomeMark band label />` |
| Empty-state spots | `src/ui/icons/spots.tsx` | `<Spot name width? />` |
| Kit styles | `src/ui/icons/kit.css` | imported by the components; class-scoped |

`src/ui/icons/icons.test.ts` fails if a name written anywhere in `src` doesn't resolve, if a glyph
draws nothing, if a kit table points at a missing name, or if two call types share a shape, hue or mark.

## Icon rules

- 24px grid, stroke 1.75, round caps and joins, `currentColor`, no fills except the `more` dots.
- Sizes: `sm` is 16px, `md` is 20px and `lg` is 24px. Use the semantic names for shared controls;
  numeric sizes remain available for existing callers. Text used to decide or act reads at 14px or more.
- Decorative by default (`aria-hidden`). Pass `title` when the icon is the only label.
- Never add a second drawing for a meaning that has one. Add the meaning to a table in `kit.ts`.

## New icons

### Tabs and resource bar

| Name | Use |
| --- | --- |
| `hq` | HQ tab: the station with its flag |
| `calls` | Calls tab: the beacon (carries the count and the live ring) |
| `officers` | Implemented Officers tab glyph; revised destination is Team |
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

`stepOut` (leave the live call without cancelling it), `map` (Map in the brief head),
`more` (overflow, where Dismiss moves), `filter` and `sort` (Roster),
`play` (resume), `arrowLeft`, `arrowUp`, `arrowDown`, `chevronsUp` (promotion, level up). The
existing `chevronLeft`, `chevronRight`, `chevronUp`, `chevronDown` and `arrowRight` complete the set.
The existing `tap` glyph remains in the kit; it is not a requirement to keep an earning control.

The gallery's "Every icon" grid shows the set by name.

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

## Implemented kit placements

`src/ui/visual-floors.test.ts` records existing picture checks and fixture states. Those checks must be
reconciled with the revised target rather than treated as a mandate to lead every element with art.
The placements below describe the current slice; Team and Store replace its Officers/Build split.

- **Department roots.** HQ uses the station scene. Calls carries its scene art on call cards;
  Officers carries portraits; Build carries development and equipment objects. `TAB_PLATES` records
  whether the optional common banner is active. A disabled plate is not a request to remove the art
  in the screen's content.
- **Tabs and bar.** The five tabs (HQ, Calls, Team, Build, Store) draw `TAB_ICON`. Funding has its painted banknote bundle;
  rate, trust and level use their resource glyphs.
- **Rows.** Officer cards use faces and status. Training courses lead
  with their emblem, upgrades with gear or emblem art, Armory tiles with gear art, call cards with
  their scene and type badge, Casebook rows and result tiles with the type badge or medallion.
  Skill, role and branch icons come from `SKILL_ICON` and `BRANCH_ICON` through `components/labels.ts`.
- **Headed steps.** The current brief, deploy and debrief use kit marks. These are placements, not a
  requirement for every heading to start with an icon. The debrief hero carries the call's medallion.
- **Empty states.** `EmptyState` supports a decorative spot; the explanatory text remains sufficient.

## Medallions

Painted call-type discs matching the scene plates, delivered 2026-10-22: see
[art/medallions/README.md](art/medallions/README.md). The SVG badges remain the small-size and
fallback form.

## UI gates

Code-level checks for visual antipatterns on every surface, at 320, 390 and 430 wide (backlog `ui-gates`,
rules R1 to R18 from the 2026-10-22 audit). Two halves share one baseline.
R4's picture-first and hidden-glyph rules are retired; their source cleanup is pending. A legacy
detector does not override that decision.

**Debt is a ratchet.** `src/ui/ui-debt.json` holds every rule's count, by file for source rules and by
`state@width` for rendered rules. A gate fails when a count **rises** (new debt) and when it **falls**
without the file being regenerated (debt paid stays paid). Every rule is flagged `target: 0`; a rule with
no entry is already at zero. Nobody edits the file: `npm run ui:baseline` writes it from today's source and
UI, and the lead reads the diff at each merge. A change that pays debt runs `npm run ui:baseline` and commits
the new file with it.

| Half | Run | What it does |
| --- | --- | --- |
| Static | `npm test` (`src/ui/ui-gates-static.test.ts`) or `npx vitest run src/ui/ui-gates-static.test.ts` | Reads `src/ui` CSS and TSX (`scripts/ui-gates/`), counts each rule, compares with the baseline. Each detector also has a negative control in the test: a fixture that must trip it and one that must not. |
| Rendered | `npm run check:ui` (starts a dev server on 5174 if none is up) or `npm run check:ui -- http://localhost:5174/` | Runs the rendered controls (a page per rule that must fail it, and one that must pass), then walks every registered state at each width (`--widths 390` for one), probes each scroll segment, and compares with the baseline. Needs Chrome (`CHROME_PATH` overrides the Mac default). |
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
| R4 | retired; source cleanup pending | Legacy picture-first heading, section and row checks, plus hidden-glyph bans. These are no longer design contracts |
| R5 | static | "Basic kit" without the basicKit glyph, officer status or outcome drawn by hand instead of `StatusMark` and `OutcomeMark` |
| R6 | rendered | targets whose effective hit region, found by `elementFromPoint` including labels, is under 44px either way, or that a pinned bar covers at every scroll position |
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
the DOM; R14 does not gate the pixels behind art; legacy R4 remains pending cleanup; R11 judges source, not every row and
every state; the walk reaches the states listed in the manifest and nothing else (no loading state exists
to capture).
