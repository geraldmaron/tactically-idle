# The player profile

How the way a player runs the department comes back into play. Built 2026-10-21. Open work is
`spend-mix-readers` and `profile-surface` in `docs/backlog.md`.

## The rule

Officers, kit and choices decide outcomes. History changes which calls come and how the scene opens.
It never moves a roll in secret. Every reader is visible, capped and probed. Funding and spend never
reach the odds; what money buys does, through the kit and the people.

`src/architecture/wiring.ts` holds that last line as a gap probe (`funding-balance`): ten million
more in the bank moves no favorable chance anywhere, and the test fails the day it does.

## What the research said

Checked against primary sources on 2026-10-21:

- EA's dynamic difficulty work tunes win rates against a churn model and reports "up to 9%
  improvement in player engagement with a neutral impact on monetization". Its inputs are wins and
  losses, not spend (Xue et al., WWW 2017).
- King's published work rates a level's difficulty with bots trained on players, before it ships
  (Gudmundsson et al., 2018). Our equivalent is the Lab's style bots (`lab-live-window`).
- Clash of Clans keeps its catch-up rules visible: Town Hall ranges, shields, revenge and loot
  bonuses for attacking up (Supercell, 2017 and 2025).
- Tinder said in 2019 that Elo is "outdated" and recent activity matters most.
- Activision's patent US 9,789,406 matches players to sell items, and Activision says it was never
  used. Belgium's 2018 loot box report calls odds bent by "wallet… payments" staged chance. The FTC's
  2022 Epic settlement ($245M) was over dark patterns.

So we take visible comeback rules, recent behavior over lifetime totals, offline calibration, and
history that returns as story. We refuse spend as an input, hidden ratings and optimizing for
engagement over fairness.

## The profile

`playerProfile` (`src/sim/player-profile.ts`) is a pure function of saved state:

| Signal | From | Weighting |
|---|---|---|
| Posture | `Department.reputation` (sim/reputation.ts) | moving average, about the last 20 choices |
| Stall habit | `Department.habits`, recorded at each commit as dither over the decision's window | moving average, about the last 12 decisions, silent for the first 6 |
| Spend mix | the last 30 spending entries in the ledger, by kit, people, training and facilities | shares |
| Form | bad results in a row, newest first | count |
| Depth | officers, units and mean strain | current |

## What reads it

| Reader | Effect | Cap | Where |
|---|---|---|---|
| Comeback pacing | after 3 bad results in a row, the next call is drawn a tier lower and its card is marked `eased` | one tier | `comebackTier`, `src/sim/incidents.ts` |
| Source starts | a hard name and a stalling habit start each pressure source higher: people have heard of the team, and know these stand-offs run long | below the source's first cue | `sourceStarts`, saved as `OperationRun.sourceStart` so replays agree |
| Reputation | the named contributor on contact, pressure and execution checks, and the board tilt | ±6 points, ±50% weight | `src/sim/reputation.ts` |
| Officer history | calls of this type each officer has worked (`career.byType`) | 4 points at the first seat | `TYPE_HISTORY`, `src/content/traits.ts` |

Not yet read: the spend mix and depth (`spend-mix-readers`), and nothing shows the profile to the
player yet (`profile-surface`).
