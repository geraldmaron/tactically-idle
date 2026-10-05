# Campaign variety and deliberate player choices

## New departments and recruitment

A new campaign samples eight identities without replacement from the full 100-person catalog. Its small three-person recruit pool samples the remaining cast. The initial market no longer favors the 16 additional people with ready portraits. Existing photo availability remains explicit; a person without a portrait uses their own personnel-file card.

The seed reproduces identities and builds within a campaign. Saved officers, careers, hired/departed identity history and other campaign slots retain their existing people. Opening role, qualification and wage balance remains in eight gameplay seats, independent of names, culture or appearance. Those opaque seat IDs are not a person's identity; `identityId` owns that link. Ages and service histories follow the selected person, and service cannot start before adulthood.

A 512-seed full-start sample produced 512 different starting sets and 512 different opening recruit pools. All 100 identities appeared in both categories. Average pairwise overlap was 0.6402 of eight starters and 0.09171 of three recruits. These are deterministic sample measurements, not a guarantee that any two campaigns share nobody.

## Auto-equip

Auto-equip handles inventory for the selected squad, or the explicitly labeled all-squads action. It preserves manual quantities, explicit zeroes, serial selections and non-target squads. It buys nothing and cannot select or commit a story decision. The live screen starts with no chosen decision or supporting squad; the player chooses those explicitly. Field inventory changes still use the existing staged-outside delivery rules, actual stock and delivery time.

Inventory explanations describe public equipment capabilities and shortages. They do not quote future action titles or private story requirements. Undo restores the prior loadout selection, with no story or campaign rollback.

## Existing calls

Already-issued versions 1–5 and all old exercise IDs keep their authored definitions and committed history. Three reviewed legacy menu actions now appear separately as “Continue to response choices.” Future use advances the stage without a roll, elapsed operation time, stress, supplies, score or rewards. It explicitly warns that remaining preparation options are left behind. This forward-only legacy behavior is distinct from committing a tactical choice. Historical uses retain their original recorded costs and samples.

The legacy assistance briefing remains a decision because its existing outcomes affect preparation and pressure; its label now says what the player actually orders. Presentation-only labels use public locations and make no new factual claim.

## New episode architecture

Future calls use content version 6. The compiler selects a compatible episode plan, binds it to actual rooms/routes/people, applies the selected circumstance modules, then binds one coherent cast throughout the resulting definition. The same definition supplies briefing facts, choices, outcomes, map people, property holders and service clocks.

This is a typed selector and a bounded set of adapters over preserved story templates. It is not a general-purpose story generator or proof of unlimited replay value. Existing v5 functions remain the frozen base for compatibility; v6 owns its changed facts, options and consequences in three isolated module files. New modules must be validated as complete definitions, with their alternative policies tested. Changes must not rely on finding a vaguely similar sentence or silently importing an incompatible object or route.

The circumstances change decisions:

- A repeated alert and a later independent sighting need different report handling. Contact first can start requested care sooner; the independent current safety check still matters. A settled visit can finish in that check instead of requiring a separate rolled closure click
- Medical receivers have distinct places and arrival clocks. The person retains the keys; an already-accepted assessment does not demand the same consent conversation again
- Privacy may already be arranged, or the player may choose an observed camera stop versus actual separation. The person's agreement remains their own
- Releasing someone changes contact differently when only their mobile is available, when the other person has an independent phone, or when contact relies on a slower relay
- Different actual outside destinations change the available transport and follow-through. A vehicle does not create an accessible indoor route
- Requesting a known available receiver earlier starts its real response clock, but never constitutes accepted care

Some fields are intentional premise constraints. A story about two calls during one evening stays at night. Compatible scenes can vary daylight, with real equipment implications. Weather, diagnoses or furniture are not randomly invented as decoration. Reported room specificity is explicitly attributed and remains unverified until observation; true exact positions do not become public knowledge automatically.

Recent completed incident types are avoided when alternatives exist, after protecting active/board variety. The fallback remains finite and deterministic. Briefings lead with relevant scene conditions; routine absences remain available under “Other reported conditions.”

## Design references

[Choice of Games on intentional choices](https://www.choiceofgames.com/2016/12/how-to-write-intentional-choices/) supports stating what the player means to do and letting outcomes respect that intention. A failed conversation can meet resistance or misunderstanding; it cannot secretly make the player promise the opposite of the selected option.

[Emily Short's narrative-system model](https://emshort.blog/2022/04/09/what-does-your-narrative-system-need-to-do/) distinguishes content selection, available options, resolution and presentation. Here, those layers share one episode state, and the tests compare their outputs. New options and changed commitments matter more than a synonym count.

[Inkle's official tutorial](https://www.inklestudios.com/ink/web-tutorial/) demonstrates conditional, once-only choices and invisible joins between sections. This informs removal of scored navigation and repeated confirmation beats. We retain the current engine rather than adding a second narrative runtime.

## Validation limits

See the release verification record for final test counts, adversarial exploration bounds and any remaining browser checks. Forced-band diagnostics deliberately exercise rare outcomes; natural-stream save tests separately establish reproducibility. A finite set of seeded runs does not prove every possible campaign or every future combination.
