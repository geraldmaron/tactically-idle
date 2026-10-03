# Responsive layout verification

The game keeps its portrait frame on larger screens. On smaller viewports the frame uses the available width. Screen content scrolls vertically; the map and officer strip retain their intentional pan/inspection behavior.

## Reproduce with a real viewport

The production build now includes `harness.html`. Open `harness.html?only=app&w=320&h=568` on a host that permits the app's module assets to load in a sandboxed frame. The width controls cover:

| Viewport | Purpose |
| --- | --- |
| 320 × 568 | Small phone and narrow controls |
| 375 × 667 | Typical compact phone |
| 390 × 844 | Original design target |
| 430 × 932 | Large phone |
| 768 × 1024 | Tablet, centered portrait frame |
| 1280 × 800 | Desktop, centered portrait frame |

This is an iframe running the actual app, so viewport units and media queries use its dimensions. Changing its size retains its temporary session. The outer inspection area deliberately scrolls if a tablet or desktop test frame is wider than the browser.

The iframe uses `sandbox="allow-scripts allow-forms"` without `allow-same-origin` and a dedicated `ti-responsive-preview=1` query. Forms are allowed so React's local submit handlers run; same-origin, popup and top-navigation privileges remain absent. Both being framed and that exact flag are required to choose a private in-memory `SaveStorage`; a top-level game with the flag still uses normal production behavior. The preview never accesses real localStorage or Web Locks. It uses the same `CampaignSlots` implementation, with the ordinary local promise queue serializing its operations. Its initial populated slot, copies, renames and new games stay testable without touching existing campaigns. The campaign bar and save dialog explicitly label all slots as temporary; the entire library is lost when the frame reloads.

A blank frame is a harness failure, commonly module CORS on a host that rejects the opaque `null` origin. Check console/network errors before using it. Do not remove the storage sandbox to make a test appear to pass.

## Manual coverage

At each size, inspect both the pixels and element bounds. A document-level `scrollWidth` check alone is insufficient because the app frame clips some overflow.

- HQ: budget rows, report values, duty controls, long squad names
- Squad: all four tabs, create and rename forms, long officer names, recruitment, hire confirmation, officer sheet, condition bars, course buttons, dismissal confirmation
- Ops: incident board, preparation, briefing and loadout cards, stepper buttons, long action labels, action details and footer, field resupply, room sheet and Rooms list, debrief
- Develop: long upgrade names, prerequisites, cost chips and unlock controls
- Gear: long item names, counts, maintenance manager, restock/preset controls, unit sheet and service/scrap confirmations
- Saves: ten slot rows, 36-character unbroken names, New/Copy/Rename/Load/Import forms and long warning/confirmation labels; exercise these only inside the isolated test campaign
- Map: floor tabs, zoom in/out/reset, Materials and Rooms controls; at 320/375px zoom controls occupy a separate row from Materials/Rooms
- Accessibility: touch controls at least 44px, visible keyboard focus, 200% text/browser zoom, short landscape/keyboard-height viewport, safe-area bottom inset, repeated Close/Back and reopening sheets

Check that every action is reachable, labels wrap, controls do not overlap, and scrolling a screen or sheet does not create horizontal page movement. For dialogs, test at the top and bottom of the body and verify the close button and footer remain reachable.

## Hosted results, 2026-10-03

The source audit and the user's phone screenshot informed the fixes. The hosted build at commit `05da89a33441e5e9e2b68b70d255c6fadfeb99c8` was then inspected in the cloud browser through real iframe viewports. The sandbox loaded the module assets successfully, displayed `TEST` and `Temporary test saves`, and kept its own initial populated slot. No normal browser save was reset or edited.

| Viewport | Primary screens | Officer / Gear / room / action sheets | Save library and edit-form layout | Debrief |
| --- | --- | --- | --- | --- |
| 320 × 568 | No horizontal overflow | No horizontal overflow | No horizontal overflow | No horizontal overflow |
| 375 × 667 | No horizontal overflow | No horizontal overflow | No horizontal overflow | No horizontal overflow |
| 390 × 844 | No horizontal overflow; header issue below | No horizontal overflow | No horizontal overflow | No horizontal overflow |
| 430 × 932 | No horizontal overflow | No horizontal overflow | No horizontal overflow | No horizontal overflow |
| 768 × 1024 | No horizontal overflow | No horizontal overflow | No horizontal overflow | No horizontal overflow |
| 1280 × 800 | No horizontal overflow | No horizontal overflow | No horizontal overflow | No horizontal overflow |

These checks used screenshots and child-element bounds against the app frame, including content below each scroller's current position. The SVG drawing, deliberately scrollable portrait strip and screen-reader-only content were excluded from the offscreen-element scan. Observed HTML buttons measured at least 44 × 44px; small SVG room shapes remain available through the full-size Rooms-list alternative. Tablet and desktop retain the centered 430px portrait layout.

Additional observed coverage:

- All five primary tabs at each width, Equipment Manager before/after hire and with active budget controls, 20-character squad-name edit fields, officer condition/rating content, Gear unit controls, populated save library, 36-character save-name fields and copy forms
- Automatic radio shortage, exact purchase button, and blocked Deploy at 320/375/390px; buying two test radios cleared the shortage and allowed a two-squad deployment
- Long `Call at the bedroom door` title, wrapped decision buttons, exact-unit resupply preview and pinned confirm footer at every width; inline resupply enabled Confirm in the temporary campaign
- Separate map zoom and Materials/Rooms rows at 320px: zoom buttons measured 44 × 44px with an 8px vertical gap before the 44px Materials/Rooms controls
- Rooms and room facts at each width, followed by a complete temporary operation and debrief at each width

Two defects from the hosted sweep are corrected in source and require the small follow-up deployment:

1. At 390px with four-digit funding such as `$9,920`, the level badge wrapped onto its own header row. The top bar now keeps a single flex row so its shrinkable wordmark yields space; the status group can still wrap unusually long values.
2. The first hosted harness used only `allow-scripts`, which prevented form submit handlers. Squad Save and save-rename/copy submissions were therefore **not** successful in that build. The harness now also allows forms while keeping same-origin and other privileges absent. Its query/frame gate and in-memory storage isolation are covered by focused tests. Recheck saved long names, copy, rename and New Game after this harness correction is deployed.

The production app/harness bundles compile for both `/` and `/tactically-idle/`. Local preview navigation was denied earlier and no alternate local route was attempted. Physical iOS/Android touch, real safe-area insets, software-keyboard behavior and 200% browser/text zoom remain unverified here; a sized browser frame is not hardware emulation.
