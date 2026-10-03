# Equipment, training and development

Gear has two sections: Inventory and Equipment. Inventory opens on owned stock, with maintenance, presets and restock rules below it. Equipment is the only physical catalog. Squad owns individual Training; Develop owns department programs and service tiers.

All 27 active equipment items are discoverable, including items with no owned stock and purchase-locked items. Search matches names, aliases (including BearCat), categories, capabilities and qualifications. Category, availability, affordability and ownership filters combine. Details describe both useful contexts and limits. Buying a license never grants an officer certification.

Restock opens the same item detail and quantity confirmation as the catalog. Existing usable stock is separate from purchase eligibility: “Purchase locked” does not mean owned equipment is unusable. Item prerequisite links open the canonical Training or Develop screen, keeping a Back to item route with the original filter and quantity draft.

The equipment manager is hired and upgraded in Develop. Gear shows the current maintenance benefits, budget and pause controls. Automatic service begins paused and preserves the treasury reserve and usable radios; it never buys stock. Restock rules are separate, opt-in hourly purchases.

## Free development-point packs

Develop → Get Points offers 3, 8 or 20 DP. Choose a pack, confirm the named active campaign, wait for the actual save promise, then return to Develop. All packs are free during testing. No monetary prices, real payment connection or provider-selection/debug controls appear in the player flow.

Confirmation stores a stable request ID and destination campaign before granting. Close/reload resumes a confirmed request; repeated completion cannot grant twice. A replaced destination leaves credited points available for an explicit later collection. Existing unused test balances remain recoverable. Credits allocated to a deleted campaign remain protected while Undo is available; permanently orphaned allocations return to the local wallet.

The ledger stays outside copyable campaign progress. Copy/import gets a fresh campaign UUID and no duplicated pack allocation. Development spending atomically applies the upgrade and debits earned DP first, then integer milli-DP from the campaign allocation. Sub-milli earned progress is retained. Quota failure and stale cross-tab writes preserve the earlier bank.

This is local test commerce. Clearing browser storage removes local progress and test rewards. Production billing needs a trusted transaction service and native platform adapters; this release does not connect to Apple or Google billing.
