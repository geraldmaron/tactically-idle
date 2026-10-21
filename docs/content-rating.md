# Content warnings and filters

How a call says what it contains, how the game warns before a hard call, and how a player keeps the
themes they don't want off the board. Work items are `content-descriptors`, `content-filter-draw`,
`calls-per-kind` and `crisis-content-note` in `docs/backlog.md`.

Owner decisions, 2026-10-20: the six descriptors below stand as written, and the call-card warning
defaults to on. Later the same day the owner replaced the Core and Mature tiers and the per-topic
toggles with three avoidable themes, after the descriptor work showed the Core tier, or turning off
`injury`, left no call on the board (104 of 128 combinations were empty). Later still the owner made
filtering the main control with fewer barriers: every descriptor can be filtered, a switch is
disabled only when turning it on would leave no call drawable, the advisory has no checkbox, and
push-back lines are not suppressed by situation (2026-10-20).

## Why there is no tier

The store rating covers the app. The owner targets a Mature rating (ESRB M, PEGI 16; backlog,
decisions of 2026-10-19). IARC, which most digital storefronts use, rates from a questionnaire the
developer completes ([IARC, how it works](https://globalratings.com/how-iarc-works/)). Inference,
not stated on that page: a player's setting does not lower the store rating, because the content
still ships in the app.

An in-game tier would answer the age question a second time, and a tier only works when enough calls
fit it. Death, injury and police gunfire are mechanics most current calls reach, so a tier that
removes them removes the game. Each filter switch guards against that on its own: it is disabled
when turning it on would leave no call. A tier can return later as a preset over the filters, once
`calls-per-kind` adds calls written for it.

## What standard practice asks for

Checked 2026-10-20 against [Xbox Accessibility Guideline 123](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/123)
(mental health), which cites the shipped examples below. Its tools are warnings before content, a way
to skip or bypass it without blocking progress, customization that removes or alters an element while
keeping play intact (Grounded's arachnophobia mode, Assassin's Creed Valhalla's sensitive content
toggles), and support resources reachable from the menu at any time. It says it does not ask
developers to remove content.

| Tool | This game |
|---|---|
| Launch advisory (Psychonauts 2, Hellblade) | First launch names the game's themes plainly, with the filters beside them |
| Per-event warning, on by default (Ikenfell) | A one-line warning on each call card naming its topics |
| Skip without blocking progress | Ignoring a call costs nothing: board calls expire silently, never penalised (`src/sim/incidents.ts`) |
| Remove an element, keep play | Filtered descriptors leave those situations off the board |
| Support resources any time | A Support entry in Settings, plus the debrief line after crisis calls |

## Descriptors

A closed list in `src/content/content-descriptors.ts`. Adding one means editing this table and that
file, never a free-text tag.

| Descriptor | Means | Player can filter | Source | Nearest ESRB descriptor |
|---|---|---|---|---|
| `death` | Someone can die in a reachable ending or force draw | yes | derived | Violence or Intense Violence |
| `injury` | Someone can be hurt, officer or civilian | yes | derived | Violence |
| `police_gunfire` | The team can fire | yes | derived | Violence |
| `suicide_self_harm` | A subject at risk of harming themselves (ethics row B, E4) | yes | declared, cross-checked | none; ESRB has no such descriptor |
| `child_at_risk` | A child is inside or in danger | yes | declared | none |
| `domestic_violence` | Harm between partners or family drives the call | yes | declared | Violent References |

ESRB names checked against its [ratings guide](https://www.esrb.org/ratings-guide/) on
2026-10-20. The mapping is there to answer the store questionnaire from data, not to rate calls.

Every descriptor can be filtered in Settings. A switch is disabled, with a line saying why, only when
turning it on would leave no call drawable given the switches already on; `drawableKinds`
(`src/sim/incidents.ts`) answers that question for the screen. With today's four calls, filtering
`injury` alone empties the board, so its switch stays disabled until `calls-per-kind` adds a call
without it. A test walks every combination and records what stays drawable.

## Unit of rating: the situation

Each call has situations, its variants (`CallTree.situations`,
`src/content/call-trees/types.ts`). Descriptors attach to the **situation**. A call's descriptors are
the union of its situations'. No text is swapped mid-call: a situation is drawn whole or not at all.

## Derived and declared

- **Derived** descriptors come from the compiled tree, so they can't drift from it. `death` is set
  by any reachable outcome with `harm: { <id>: 'fatal' }`, or a `force` outcome that carries a
  `fatal` branch without `noFatal`. `injury` is set by any reachable harm. `police_gunfire` is set by
  any reachable `force` outcome.
- **Declared** descriptors are themes the data can't see, written on the situation by the call's
  designer as part of the `swat-call-design` ethics screen. `suicide_self_harm` is declared, because
  `noFatal` also covers subjects who aren't at risk. The gate cross-checks it: an adult subject whose
  force outcomes carry `noFatal` needs either `suicide_self_harm` or a recorded reason on the
  situation.
- A gate in `src/gen/incident/gates/` fails when a situation's declared list leaves out a descriptor
  it derives. Declaring more than the gate derives is allowed.

## Filtering the board

`drawCard` (`src/sim/incidents.ts`) is the one place a call reaches the board. It leaves out
situations carrying a filtered descriptor, and a kind with no situation left leaves the draw.

- Changing the filters removes cards already on the board that no longer fit. A call in progress
  finishes.
- Filters change the draw stream for that player. The compiled fingerprints stay pinned with
  nothing filtered, and each combination has its own draw test.
- More trees per kind (`calls-per-kind`) widens what stays drawable, and is the variety the owner
  asked for: several hostage, barricade, armed and rescue calls, not one each.

## Warnings and support

This settles open decision O2 in
`.agents/skills/swat-call-design/references/ethics-and-authenticity.md` on placement. The wording is
drafted for the owner's approval, and none of it ships until the owner approves it.

- **On the call card**, before the player accepts: a one-line warning naming topics, never plot
  ("This call involves a person at risk of suicide"). Naming what happens would spoil a planted turn.
  The card also says that leaving a call costs nothing.
- **Setting:** warnings on or off. The default is on.
- **In the debrief** of any situation with `suicide_self_harm`, the support line from E4.7 always
  shows, whatever the setting.
- **In Settings**, a Support entry is always available with the same line.
- **Push-back lines** (`docs/call-pressure.md`) are not suppressed by situation. Any speaker may have
  one, the subject included. A player who doesn't want a call's themes filters them (owner,
  2026-10-20).

Owner decisions on the wording, 2026-10-20: the word "suicide" is allowed on the card warning, the
launch advisory, Settings and the debrief support line, and nowhere else in player text (the prose
lint still bans it in call text). The card warns with the whole call's descriptors, the union of
its situations, never the drawn situation's, so it can't give away the hidden truth. The wording
in `docs/calls/notes/content-warnings-draft.md` sections 1 to 3 is approved as drafted.

## First launch and Settings

At first launch an advisory names the game's themes plainly, says the settings are the player's
preference and not an age check, and continues with one button: no checkbox. It sets the filters,
the warning setting and the call timer (`docs/call-pressure.md`). The same controls live in
Settings.

Preferences persist in localStorage outside the versioned save, extending the pattern in
`src/ui/people/prefs.ts`, so they survive a save being rejected on a version bump.
