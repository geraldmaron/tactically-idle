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

The iframe uses `sandbox="allow-scripts"` without `allow-same-origin` and a dedicated `ti-responsive-preview=1` query. Both being framed and that exact flag are required to choose a private in-memory `SaveStorage`; a top-level game with the flag still uses normal production behavior. The preview never accesses real localStorage or Web Locks. It uses the same `CampaignSlots` implementation, with the ordinary local promise queue serializing its operations. Its initial populated slot, copies, renames and new games stay testable without touching existing campaigns. The campaign bar and save dialog explicitly label all slots as temporary; the entire library is lost when the frame reloads.

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

## Evidence for this change

- Source audit completed across every screen and sheet. Fixes use minimum-size constraints, flexible grid tracks and wrapping; no new page-level horizontal clipping was added.
- The user's phone screenshot was inspected, including the long live action title, decision switcher, blocked-equipment reason and confirmation footer.
- The existing hosted build was inspected in a cloud browser at 1180 × 757, which produced a 430px game frame. HQ, Gear, the save dialog and the Squad rename form had no elements outside the frame in those states. These observations concern the pre-change hosted build.
- The new app/harness production bundles compile at both `/` and `/tactically-idle/`, and `dist/harness.html` is emitted with the appropriate base path.
- Updated pixels at 320/375/390/430/tablet/desktop widths, sandbox module loading, and phone safe areas have **not** been verified in this environment. Local preview navigation was denied earlier; no alternate preview route was used. The cloud browser has no documented viewport-resize API, and the updated harness has not been deployed.

Treat the viewport list as required follow-up coverage, not as a passing results table. Once the updated build is available through an authorized preview or deployment, verify the sandbox frame loads first, then record the results of the matrix above.
