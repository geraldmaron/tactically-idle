# Department storefront

Open **Gear → Store**. The existing **Inventory** surface still contains owned-unit readiness, service/scrap, the equipment manager, presets and explicit restock rules. Vehicles stay out of hand-carried squad presets. Store sections are Equipment, Training, Development and Test DP; switching between them keeps equipment filters and course selection in memory.

## Equipment

All 28 catalog items remain discoverable, including locked items and items with no owned units. Search matches name, aliases (including BearCat), category, capability explanations, effects, counters and qualifications. Search words and the category, availability, affordability and ownership filters combine with AND. Each facet count retains all other active filters. Clear all resets the filters and sort; an empty result explains how to recover.

Availability distinguishes Buy now (the actual one-unit purchase check) from Locked (a missing program unlock). Affordability is independently based on the unit price. Owned and ready stock remain distinct. Needs replenishment means ready stock is below an explicit restock target, or an owned item has no ready units. Certified-officer counts do not claim that those officers are available for the selected operation.

Available first is the default sort. Funding ascending/descending, name and recently unlocked are also supported, with deterministic name/ID ties. Recently unlocked uses the saved unlock order, not an invented date.

Every card has an ordinary Details & buy button, with no overlay intercepting controls. Details show positive uses, counters, unlocks, required certifications, consumed supplies and upkeep. The shared capability preview explicitly reports that no action has been selected; the store does not guess compatibility or inspect scenario truth. Training and development links retain the equipment query on return.

Purchases show a labeled integer quantity and the exact full funding total. Quantities are 1–99; vehicles are one per command. The real command rechecks the price and eligibility. No browsing or filter change purchases stock. Success and refusal feedback stays beside the purchase control.

The detail body scrolls within the sheet while Close and the purchase footer remain reachable. Keyboard Tab stays in the detail dialog. Close/Escape and browser Back restore focus to the original card button, or to search if the card disappeared; Forward can reopen the same detail. Repeated open/close requests cannot stack history entries or race a pending Back.

## Training and development

Training uses the existing course selector and startCourse command, including program, prior-certification, staffing, income, funding, slot and rating-ceiling checks. Courses explain their actual hours, funding cost and completion grant. Buying a program never certifies an officer.

Both Development surfaces and Hire manager use the same asynchronous unlockDevelopment path. They preview the separate earned/test budget without saving test DP in GameState, show a busy state, disable unaffordable unlocks, and surface failure reasons. Earned DP is spent first. Manager maintenance remains opt-in.

Test DP renders the separate mock-commerce interface. It labels Apple and Google as simulations, uses no real payment provider and charges no money. Credits and receipts stay in the commerce ledger, outside copyable campaign progress.

## Layout and verification

Phone layouts use one column and collapsible filters. The grid has a two-column rule when its game container reaches 620px. The app intentionally retains its existing maximum 430px portrait frame on larger screens, so the normal 768px/desktop layout remains one column.

Automated coverage: 10 catalog-query tests cover discoverability, aliases, AND filters, independent purchase/qualification/stock states, facet counts, sort ties and unlock ordering, replenishment, clearing, exact multi-buy affordability and vehicle/integer limits. Four navigation tests cover Back/Forward, focus-return signaling, repeated Close/open races, leaving for training/development and cleanup of only owned history state. TypeScript and production build pass.

Browser verification is separate from these logic tests. The hosted disposable harness must check 320/390/768 widths, visible bounds and touch targets, keyboard focus/Tab/Escape, Back/Forward, filters retained after detail and training/development navigation, zero-owned details, exact quantity totals, invalid/insufficient-funding refusals, course enrolment and earned/test unlocks. Run only in the storage-isolated preview; do not reset or mutate a user's normal saves. Actual DOM focus, layout and touch-hardware behavior are not established by the unit tests.
