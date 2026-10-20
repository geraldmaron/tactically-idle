# Content rating and topic filters

How a call says what it contains, how a player keeps what they don't want off the board, and how
the game warns before a hard call. Design only: nothing here is built yet. Work items are
`content-descriptors`, `content-filter-draw`, `calls-per-kind` and `crisis-content-note` in
`docs/backlog.md`. Owner decisions behind it, 2026-10-20: filter by situation, a "no deaths" topic
in place of "no one harmed", docs before code.

## What a tier is, and what it is not

The store rating covers the app. The owner targets a Mature rating (ESRB M, PEGI 16; backlog,
decisions of 2026-10-19). IARC, which most digital storefronts use, rates from a questionnaire the
developer completes ([IARC, how it works](https://globalratings.com/how-iarc-works/)). The game
answers it for everything the app can show. Inference, not stated on that page: a player's filter
does not lower the store rating, because the content still ships in the app.

So the in-game tier is a **player preference**, not a rating. It never uses ESRB or PEGI letters or
names, which would read as a certification the call does not have.

| Setting | What it does |
|---|---|
| Tier: Standard | Leaves off situations carrying any descriptor marked *mature only* below |
| Tier: Mature (default for an M-rated app) | Everything the app contains |
| Topic toggles | Each descriptor can be switched off on its own, in either tier |

## Descriptors

A closed list. Adding one means editing this table and the type, never a free-text tag.

| Descriptor | Means | Mature only | Source | Nearest ESRB descriptor |
|---|---|---|---|---|
| `death` | Someone can die in a reachable ending or force draw | yes | derived | Violence or Intense Violence |
| `suicide_self_harm` | A subject at risk of harming themselves (ethics row B, E4) | yes | declared, cross-checked | none; ESRB has no such descriptor |
| `injury` | Someone can be hurt, officer or civilian | no | derived | Violence |
| `police_gunfire` | The team can fire | no | derived | Violence |
| `child_at_risk` | A child is inside or in danger | yes | declared | none |
| `domestic_violence` | Harm between partners or family drives the call | yes | declared | Violent References |

ESRB names checked against its [ratings guide](https://www.esrb.org/ratings-guide/) on
2026-10-20. ESRB has no self-harm descriptor. The mapping is there to answer the store
questionnaire from data, not to rate calls.

"No one harmed" is not on the list. Injury and harm are mechanics (owner clocks, officer injuries,
force draws), so a filter can't remove them without changing the sim. `injury` exists so a player
can see it, and turning it off is allowed only if `content-filter-draw` shows the board can still
fill. The "no deaths" filter is `death` off.

## Unit of rating: the situation

Each call has situations, its variants (`CallTree.situations`,
`src/content/call-trees/types.ts`). Descriptors attach to the **situation**. A call's descriptors are
the union of its situations'. No text is swapped mid-call to soften a call: a situation is drawn
whole or not at all.

## Derived and declared

- **Derived** descriptors come from the compiled tree, so they can't drift from it. `death` is set
  by any reachable outcome with `harm: { <id>: 'fatal' }`, or a `force` outcome that carries a
  `fatal` branch without `noFatal` (`src/content/call-trees/types.ts`, the `force` field). `injury`
  is set by any reachable harm. `police_gunfire` is set by any reachable `force` outcome.
- **Declared** descriptors are themes the data can't see, written on the situation by the call's
  designer as part of the `swat-call-design` ethics screen. `suicide_self_harm` is declared, because
  `noFatal` also covers subjects who aren't at risk. The gate cross-checks it: an adult subject whose
  force outcomes carry `noFatal` needs either `suicide_self_harm` or a recorded reason on the
  situation.
- A gate in `src/gen/incident/gates/` fails when a situation's declared list leaves out a descriptor
  it derives. Declaring more than the gate derives is allowed.

## Filtering the board

`drawCard` (`src/sim/incidents.ts`) is the one place a call reaches the board. It leaves out
situations whose descriptors the player has turned off, and a kind with no situation left leaves the
draw.

- Changing a setting removes cards already on the board that no longer fit. A call in progress
  finishes.
- Filters change the draw stream for that player. The compiled fingerprints stay pinned with
  nothing filtered, and each filter gets its own draw test.

**Starvation.** With one tree per kind today (`CALL_TREES`, `src/content/call-trees/index.ts`), a
filter can remove a whole kind. A test walks every filter combination and records how many
situations stay drawable. The Settings screen warns when a combination leaves fewer than one kind.
More trees per kind (`calls-per-kind`) is what fixes this, and it is also the variety the owner
asked for: several hostage, barricade, armed and rescue calls, not one each.

## Content notes

This settles where the note appears (open decision O2 in
`.agents/skills/swat-call-design/references/ethics-and-authenticity.md`). The wording is still the
owner's.

- **On the call card**, before the player accepts: a one-line note naming topics, never plot ("This
  call involves a person at risk of suicide"). Naming what happens would spoil a planted turn.
- **Setting:** notes for every topic, only for topics I flagged, or none. The default is every topic.
- **In the debrief** of any situation with `suicide_self_harm`, the support line from E4.7 always
  shows, whatever the setting.

## First run and settings

The game has no settings screen or first-run flow today. One screen at first launch asks for the
tier and shows the topic toggles. The same controls live in a Settings screen afterward. It is
self-declared, not age verification, and the screen doesn't claim otherwise.

Preferences persist in localStorage outside the versioned save, extending the pattern in
`src/ui/people/prefs.ts`, so they survive a save being rejected on a version bump.
