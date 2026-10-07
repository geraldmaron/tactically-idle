# Catalog and contextual equipment, content v2

The physical catalog has 27 active items: eight retained IDs/prices and 19 additions; separate battery packs were retired with a one-time refund for unused stock. Six development programs unlock equipment and six courses provide officer qualifications; purchasing a program never certifies anyone. Every product has a useful authored scenario or live-action context plus a neutral or blocked counter. All effects are fictional score, time, pressure, supply and safety abstractions.

`content/capabilities.ts` owns public capability descriptions. `sim/capabilities.ts` evaluates opt-in action rules from visible geometry, declared action context, known facts, officer qualifications and exact physical units. Response classes, protection, observation aids and vehicles use best-of groups. Clear radio links get no relay bonus, lighting only cancels existing darkness penalties, and unknown adjacent safety blocks an intervention without exposing hidden truth. A supported door is required for access; glazing, walls, floors and blocked routes cannot be bypassed. Less-lethal interventions retain adverse outcomes and viable communication alternatives.

Every consumed stock unit is traced once. Refusals do not consume stock or RNG; committed adverse outcomes consume their declared supplies. Supplies expire and cannot be serviced. Reusable gear and vehicles use the existing exact-unit wear and equipment-manager servicing lifecycle.

One explicitly selected support vehicle is reserved separately from all hand-carried squad loadouts. Auto-equip never selects vehicles. It remains at accessible exterior staging with a qualified vehicle operator. The support van reduces pre-decision delivery from three to two operation minutes, including pressure and debrief wear. Armored rescue and command vehicles only contribute on their declared exterior tasks and charge setup time; they provide no interior coverage.

Three zero-reward capability fixtures cover signals, protective response, and patient access/rescue. Since practice was removed on 2026-10-06 they are test-only (`src/sim/fixtures/capability-scenarios.ts`) and played as live runs with owned units. The generated v2 pool introduces two specialist archetypes, `barricaded` and `business_robbery`, while weighting each everyday archetype four times. Communication, verified information and handover remain useful routes.

## Version boundary

Existing v1 generation is frozen, including incident IDs, PRNG draw order and scenario fingerprints. An issued incident ID includes its own content version. Loading an older campaign promotes only its top-level `contentVersion` to 2 for future arrivals. It does not rewrite issued queue IDs, active-run scenario/content versions, decisions, units, reservations or RNG. A queue can safely contain both versions; reloads are idempotent. New campaigns begin at version 2.

## Verification

Regression coverage includes catalog referential integrity, old prices, six program/course gates, positive and counter scenes for every new capability, one-operator qualification, non-stacking groups, real material barriers, known-safety refusal, exact supplies, adverse outcomes, old-save migration, support allocation, standard radios, resupply minutes/pressure/wear and the existing equipment manager.
