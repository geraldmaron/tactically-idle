# Subway Surfers' rules engine and what Tactically Idle takes from it

**Checked:** October 21, 2026, America/New_York. **Input:** a 60-second TikTok by @ayoships that the owner
shared (`v15044gf0000dbaetonog65mom1d3afg.MP4`). It was transcribed locally with whisper.cpp `small.en`,
and frames were read every 2 s. The transcript is in the appendix. **Stance (owner, 2026-10-21):** the
video was treated as a claim to falsify, and the draft was given to Codex (`gpt-6.1-sol`) in two rounds
with orders to break it. The first draft did not survive round one. This version is what survived both
rounds, and the challenge record says what changed and why.

## Main finding

The video is not about hooks, streaks or juice. It argues that one capability explains Subway Surfers'
money: a **server-driven rules engine** with a vocabulary of player-profile conditions, config files keyed
to A/B variants, and ad revenue logged against those variants.

1. **The video shows the machinery, not the motive.** On screen: a vocabulary of up to 158 profile
   conditions (spend among them), config snippets keyed to variants, one price variant (300 to 1000
   coins), one speed comparison and one logged ad event. It doesn't show any rule that reads spend, how
   players are assigned to a variant, or how many variants are live. "Priced by how much you've spent" is
   the video's inference.
2. **Whether the engine explains the money is unknowable from public data.** SYBO ApS revenue was nearly
   flat from 2023 to 2025, and EBIT rose (S1). That neither supports nor refutes the causal claim.
3. **What transfers to Tactically Idle is a question, not a mechanism: which version works better for
   real people?** The game answers that only with bots today. `balance.ts` finds broken odds and dead
   branches. It says nothing about whether people understand, enjoy or quit. PLAN.md already plans the
   human answer (validation criteria 12 and 14, and the `playtests` item). This research adds one
   requirement to it, below, and no new tooling.
4. **The game is building its own small version of the engine, and that's the live risk.** The player
   profile on `claude/angry-edison-cae68b` (merged into the tap-earn and UI branches, not into `main`)
   reads how the player runs the department and changes which calls come and where pressure starts. One
   reader raises the starting pressure of future calls for a player whose decisions have run long. On
   the same branch the Relaxed reading floor is gone (`src/sim/clocks.ts`, both floors 0), the profile is
   not shown to the player, and nothing in `src/ui/` renders the `eased` mark that comeback pacing saves.
   Whether hesitation should ever raise future pressure is an owner decision, and it should be made
   before that reader merges.

## What the video claims, and how each claim holds up

| # | Claim (transcript time) | Status | Evidence and limits |
| --- | --- | --- | --- |
| C1 | "Even 13 years later the game still makes over 60 million dollars a year" (0:00) | **Company figure matches; the game's share is unknown** | SYBO ApS net revenue for 2025 was DKK 457,565k, about USD 69M at the video's rate (S1, an aggregator of the filed accounts; the filing itself wasn't opened). That's the company, not the game alone. |
| C2 | "Because the game itself changes depending on how you can make them money" (0:04) | **Causal claim with no evidence either way** | Revenue was DKK 725.9M (2022), 457.6M (2023), 422.0M (2024) and 457.6M (2025). EBIT was 186.7M, 197.2M, 172.6M and 198.1M (S1). Nothing here isolates the engine's effect. The one SYBO experiment result this pass found is ad mediation: ARPDAU up 57% (Sept to Dec 2020) and 67% (Q3 2021 against Q3 2020), as two separate comparisons (S5). |
| C3 | The engine checks "up to 158 different things" (0:10) | **Consistent with the screen** | The `UserStatKind` enum runs to 157, and `Unused_001` is among the values. "Up to" fits a vocabulary. How many rules read it is unknown. |
| C4 | Conditions include spend, IAP tier, hours since the last ad, and other installed games (0:14) | **Shown as vocabulary only** | `TotalIAPs`, `TotalIAPCurrencySpent`, `LastIAPTier`, `HoursSinceLastAdWatch` and `IsAppInstalled` are enum members. The only rule bodies shown read `HoursSinceLastAdWatch >= 168` (an ad offer) and `FeatureUnlocked` (a magnet spawn). No rule on screen reads spend. |
| C5 | Rules decide prices, ads, power-ups and max run speed (0:21) | **Config shown; assignment and the cause of the speed gap not shown** | Config names (`promotions`, `adplacements`, `spawnchances`, `runconfiguration` with `ab_speedtest_a`) are visible. The overlay shows 164.1 against 204.0 units/s at run times of 88.0 s and 87.5 s, but it's the creator's own instrumentation, with mode, build and start state unstated. |
| C6 | JSON rules from a server that "they can rewrite for anyone at any time" (0:26) | **A config archive is shown; targeting isn't** | A `curl` of a SYBO config archive is on screen. Firebase Remote Config shows such per-user targeting is ordinary tooling (S4). That doesn't show how SYBO targets. |
| C7 | "112 different versions being tested" (0:32) | **Unverified** | No count appears on screen. |
| C8 | Each ad is logged with its revenue and test version (0:35) | **One event shown** | One queued `ad_impression` with an `ab_list`, `placement: RewardDoubler`, `ad_network: Unity` and `revenue: 0.105…`. LevelPlay's impression data has an `ab` field and a `revenue` that is "either estimated or exact, according to the precision" (S7). The tag may come from the vendor, and the revenue may be an estimate. One event doesn't show that every ad is logged. |
| C9 | The same power-up can cost "up to 3 times" as many coins "without any option to watch an ad" (0:42) | **Prices shown (3.3x); losing the ad option depends on merge rules not shown** | `hoverboard_single` costs 300 coins with an `alternativeCost` in Ads by default, and 1000 coins in `ab_coin_price_consumables_D`, whose snippet has no `alternativeCost`. Replace or merge semantics decide whether the ad option survives. Who gets D is unknown. |
| C10 | "It's not the game you grew up with anymore" (0:46) | **Opinion** | Not testable. |

## The capability in parts, with a verdict for Tactically Idle

Each repo reference names its branch. The branches in flight moved during this research, so every
reference is a snapshot.

| Part | Verdict | Why, for this game |
| --- | --- | --- |
| **Variants judged by real people** | **Fold into `playtests`, add no tooling** | The Scenario Lab already has pacing and tuning controls (`main:docs/scenario-lab.md`) and keys a session by its tuning hash (`main:src/dev/lab/model/session.ts`). A playtest can run two settings that way. The requirement below makes sure each note can be traced to the rules that produced it. |
| **Bot sweeps (`balance.ts`)** | **Keep, as a machine check only** | `main:src/gen/incident/trees-v13/balance.ts` plays calls under `random`, `best_odds`, `patient` and `fast`. It isn't evidence about people, and this doc doesn't treat it as such. |
| **A profile that changes play** | **Owner decision before the stall reader merges** | See main finding point 4. The comeback reader eases the next call, and its card mark isn't rendered yet. The stall reader turns hesitation into future pressure, with no reading floor, no surface, and no input from the timer setting (`angry-edison:src/sim/player-profile.ts`, `sourceStarts`). A surface explaining it would disclose the effect, but disclosure doesn't settle whether slow reading should cost anything. |
| **Spend as an input to play** | **Rule exists; its test is narrower than the rule** | The profile doc says "funding and spend never reach the odds". Its `funding-balance` probe adds ten million in funding and checks only for favorable moves in odds (`angry-edison:src/architecture/wiring.ts`). It doesn't test spend history or purchase status. For now, review holds the rule, not a test. |
| **Prices that vary by person** | **Out of scope until `real-purchases`** | Point packs were removed on 2026-10-20 (`angry-edison:docs/backlog.md`), so nothing is sold. If personal prices ever ship, EU law requires disclosure "that the price was personalised on the basis of automated decision-making" (S2). That's a duty, not a ban. Whether to do it at all is an owner call. |
| **Rules delivered from a server** | **Not now** | There's no server in scope. If one ever exists, it delivers only versions that passed the content pipeline and carry fingerprints (`main:docs/content-pipeline.md`). |
| **Ads and ad history** | **Owner decision, not answered here** | PLAN.md excludes forced ads. Optional rewarded ads aren't excluded, and this research didn't test whether they would help or would invite padding to sell. Ad history as an input works as a cap on solicitation as easily as a push. |
| **Installed-app check** | **Reject, low stakes** | There's no second game. Using familiarity for onboarding is a fair idea, but asking the player is the obvious first try. That's untested, and the stakes are small either way. |
| **Hidden difficulty by cohort** | **Reject hidden** | Pressure is a player setting, Off, Relaxed or Standard, with Relaxed as the default. Adaptation by observed behavior is the profile row. |

## For the tap-earn lane

Asked by the **Tap to earn with multipliers** session (`claude/tap-earn-04b5ba` at `69ffda6`), and sent
to it on 2026-10-21. Later corrections:

1. **Stacking is decided.** The owner set it on 2026-10-21: bonuses of one kind add, and kinds multiply
   (`department-taps.ts` header). No source found here argues against it. Costs, not caps, keep
   production in check in the reference model (S8). Prestige softening (S9) doesn't apply.
2. **Same power-up twice:** extend (owner 2026-10-21). Nothing found argues against it.
3. **Showing the rate cap:** no authority applies. The CPC principles exclude currency "solely obtained
   through gameplay" (S3, footnote 2). It's a UI judgment.
4. **Open question: the ratio of tapping to idle income.** At `base: 1` and `maxPerSecond: 20`, capped
   tapping credits up to $72,000 an hour of tapping. The start-of-game idle net is $620 an hour
   (`main:src/sim/economy.test.ts`, start budget). Both are funding. A one-minute burst worth about two
   idle hours could suit short visits, or could make players feel they must keep tapping. Only play will
   tell, so this goes to `playtests` (pacing review, PLAN.md criterion 14: "repetitive manual tasks").
5. **Real-money income multipliers:** with point packs gone, this is a fresh owner decision under
   `real-purchases`, not an extension of something already sold.

## Backlog input (for the lead to place)

- **Owner decision, before the stall reader merges:** should a habit of slow decisions raise the starting
  pressure of later calls at all? If yes, should it apply at Off and Relaxed, with no reading floor?
  Sources: `angry-edison:docs/player-profile.md` (source starts),
  `angry-edison:src/sim/clocks.ts` (floors at 0).
- **Add to `playtests`:** every session note records the content fingerprint, the tuning hash, the timer
  setting and any profile readers in effect. Variants compared in a round differ in one setting and run
  through the Lab's existing controls. Observations follow PLAN.md criteria 12 and 14. A variant is
  dropped when testers can't explain an effect it introduced, or when it produces a material issue
  under criterion 14.
- **Add to `profile-surface`:** render the `eased` mark on the call card (comeback pacing saves it today,
  and nothing shows it).
- **Owner decisions, unchanged:** optional rewarded ads, and real-money income multipliers under
  `real-purchases`.

Withdrawn during the challenge: `spend-blind-rules` (round one), and `playtest-variants`, `playtest-log`
and `economy-sweep` (round two). They specified tooling before the evidence it would collect, and round
two showed each could meet its own done criteria and still miss the question that matters.

## Disconfirmation and coverage limits

- **One video, one creator, internals unverified.** This pass didn't decompile the client or fetch
  SYBO's config archive. C3 to C9 rest on what the video shows.
- **Company revenue isn't game revenue**, and the figures come from an aggregator.
- **No player evidence.** Every verdict about Tactically Idle is design reasoning until playtests run.
- **Branches in flight.** The profile and tap-earn findings describe unmerged branches as of
  2026-10-21 and may change.

## Challenge record

Codex `gpt-6.1-sol`, read-only, default model. The briefs told it to assume the doc was wrong and list no
agreements. The full output is kept outside the repo (session scratchpad, `sol-round1-out.md` and
`sol-round2-out.md`).

### Round one: 35 objections against the first draft

| Objections | Gist | Answer | What changed |
| --- | --- | --- | --- |
| 1 (fatal), closing paragraph | Bot runs measure programmed outcomes, not people. Calling them an equivalent of A/B tests rejects the experiments that could prove the design wrong. | **Accepted** | Main finding rewritten. `playtest-variants` added. Bot sweeps demoted to a machine check. |
| 2, 3 | A revenue fall doesn't disconfirm the engine (no counterfactual), and 2022 against 2025 was a chosen pair. Revenue was flat 2023 to 2025 and EBIT rose. | **Accepted** (checked S1: EBIT 186.7M in 2022, 198.1M in 2025) | "Disconfirming case" removed. C2 now reads: no evidence either way. |
| 4, 5, 6 | C1 conflated company and game. The CEO quote (S6) doesn't rebut personalization. The S5 periods were presented as a range, and "the only result" was a universal claim. | **Accepted** | C1, C2 and S5 rewritten. S6 dropped as evidence. |
| 7, 8, 9, 10 | C3 was a strawman. No shown rule ties spend to a price. The speed overlay isn't controlled. Firebase docs say nothing about SYBO. | **Accepted** | C3 to C6 restated. Main finding point 1 now says spend pricing is the video's inference. |
| 11, 12, 13 | LevelPlay does carry an `ab` field, and revenue may be estimated. One event isn't all ads. C9 depends on merge semantics. | **Accepted** (checked the S7 SDK field list) | C8 and C9 rewritten. |
| 14 | The doc mixed repo states: `docs/call-pressure.md` isn't on `main`, and the tap branch differs. | **Accepted** | Every repo reference now names its branch. |
| 15, 19, 20, 21 | "Already have rules as data" pointed at QA gates. A timer default isn't a choice. The profile branch already raises pressure from stall history with no player-facing surface. Cohorts can be reproducible when their state is saved. | **Accepted**. This was the largest miss. | Profile row added and made the main risk. The reproducibility argument was removed. |
| 16, 17, 18 | Remote delivery doesn't itself bypass review. Disclosure law isn't a ban. Ad history can protect players. | **Accepted** | Verdicts softened to "not now" or "moot" with reasons. Legal framing corrected. |
| 22 | Calling rewarded ads a business call dodges the design question. | **Accepted with controls** (round two showed there was no control; see there) | Kept as an owner decision. |
| 23 | The installed-app signal could serve onboarding. | **Rejected** | Asking the player is cheaper and reads nothing from the device. |
| 24 | An opt-in export loses the players who quit. | **Accepted** | `playtest-log` export moved to the facilitator in moderated sessions. |
| 25 to 30 | Tap answers: costs, not prestige, bound production. The branch already caps the product. Income entitlements aren't distinct from point packs. Extend, not refresh, is what's built (owner). CPC excludes gameplay-only currency. | **Accepted** (checked `department-taps.ts` and CPC footnote 2) | The tap answers were withdrawn and replaced. |
| 31 | Capped tapping is $72,000/h against a $620/h idle net. | **Accepted, needs validation** | Raised to the tap lane as a new finding. |
| 32, 33 | `economy-sweep` styles were undefined, and affordability isn't purchase or benefit. Milestone grants were ignored. | **Accepted** | Styles defined. The gate measures purchase and effect, and checks dominance. |
| 34 | An import allowlist can't enforce information flow. | **Accepted** | `spend-blind-rules` withdrawn in favor of the existing `funding-balance` probe. |
| 35 | `playtest-log` fields were too thin, and visible-time capture is interface work. | **Accepted** | Fields and lanes expanded. |

### Round two: 20 objections against the rewrite

| Objections | Gist | Answer | What changed |
| --- | --- | --- | --- |
| 1, 2 | The Relaxed-floor question mixed an older pressure design with a profile branch that removed the floor. The `eased` mark is saved, not shown. | **Accepted** (checked: both floors 0 in `angry-edison:src/sim/clocks.ts`; no `eased` in `src/ui/`) | The profile risk was restated with the current branch. The `eased` render was routed to `profile-surface`. |
| 3, 4 | The `funding-balance` probe tests cash balance against favorable odds only, not spend history, and it skips eligibility flips. | **Accepted** | The row now says review holds the rule, not a test. |
| 5 | The game's rule is about odds, not prices. | **Accepted** | Personal prices are out of scope until `real-purchases`. |
| 6 | A surface would disclose the stall penalty without settling whether it's acceptable, and the reader ignores the timer setting. | **Accepted** | The merge gate became an owner decision. |
| 7 | The headline still claimed per-player selection and many live variants. | **Accepted** | Main finding point 1 rewritten. |
| 8 | Stacking is an owner decision already built. | **Accepted.** Round one's answer over-corrected. | Recorded as decided. |
| 9 | Point packs were removed on the branch, so they can't normalize income entitlements. | **Accepted** | Recorded as a fresh owner decision. |
| 10 | The tap ratio's meaning is behavioral, not about units, and "inverts" overreached. | **Accepted** | Reframed as a playtest question. |
| 11 to 18 | `economy-sweep`, `playtest-variants` and `playtest-log` were underspecified, confounded, mis-laned, or depended on items that don't exist or come later. The Lab already has variant controls and a tuning hash. | **Accepted** | All three withdrawn. One requirement was added to `playtests` instead. |
| 19 | "Accepted with controls" on rewarded ads had no control. | **Accepted** | Now plainly an unanswered owner decision. |
| 20 | Rejecting the installed-app check rested on an unmeasured "cheaper". | **Accepted in part** | Verdict kept as "low stakes, untested". |
| Closing paragraph | The rewrite turned a source audit into a tooling program whose gates could all pass while missing whether slow readers are harmed or whether anyone wants the loop. | **Accepted** | The doc now ends in two owner decisions and three small additions to existing items. |

A third round wasn't run. Round two's objections were all about scope and accuracy, and every one was
answered by cutting or correcting, not by new claims a third round would need to test.

## Source register

All links were opened this session on October 21, 2026.

- **S1:** Proff, [SYBO ApS regnskab](https://www.proff.dk/regnskab/sybo-aps/kc3b8benhavn-k/data-og-tv-spil/H0LLYUI025T). Net revenue, EBIT and net result, 2021 to 2025, DKK thousands. An aggregator of filed Danish accounts.
- **S2:** EUR-Lex, [Directive 2011/83/EU consolidated to 28 May 2022](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02011L0083-20220528), Art. 6(1)(ea). Primary law.
- **S3:** European Commission and CPC Network, [Key principles on in-game virtual currencies](https://commission.europa.eu/document/8af13e88-6540-436c-b137-9853e7fe866a_en), 21 March 2025. Non-binding guidance, read in full from the PDF.
- **S4:** Google, [Firebase Remote Config condition reference](https://firebase.google.com/docs/remote-config/condition-reference). Vendor documentation.
- **S5:** Unity, [How SYBO increased Subway Surfers' ARPDAU by 67%](https://unity.com/resources/sybo-subway-surfers), November 17, 2021. Vendor case study, self-reported.
- **S6:** PocketGamer.biz, [SYBO talks evergreen Subway Surfers success](https://www.pocketgamer.biz/news/81200/sybo-talks-evergreen-subway-surfers-success/), March 30, 2023. Kept for context only: the CEO credits street culture and visuals, which doesn't bear on personalization.
- **S7:** Unity, [LevelPlay impression-level revenue SDK API](https://docs.unity.com/en-us/grow/levelplay/platform/fundamentals/impression-level-revenue-sdk-api). Vendor documentation, field list.
- **S8:** Anthony Pecorella, [The Math of Idle Games, Part I](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i). Practitioner write-up.
- **S9:** Anthony Pecorella, [The Math of Idle Games, Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii). Practitioner write-up.
- **V1:** @ayoships, TikTok video, owner-supplied file. Primary for what the video claims.

## Verification record

- Transcript: whisper.cpp `small.en`. The caption fragments burned into the 30 sampled frames ("OVER $60 MILLION", "158 DIFFERENT THINGS", "THERE ARE 112", "CAN COST UP TO") match it.
- Sources: each was opened, and claims sol disputed were re-checked against the source (S1 EBIT, S7 fields, S3 footnote 2).
- Repo claims: read at the named branch. `main` is `aec328d`, `claude/department-ux-pass` is `9bed520` and `claude/tap-earn-04b5ba` is `69ffda6`. The profile is on `claude/angry-edison-cae68b`, which moved from `c901d0e` to `623658a` during the review. The floor and `eased` checks were made at `623658a`.

## Appendix: transcript (V1)

Captions on screen match the audio. Times are from whisper.

```
00:00  I reverse engineered Subway Surfers to figure out how, even 13 years later, the game still
00:04  makes over 60 million dollars a year, and it's because the game itself changes depending
00:08  on how you can make them money.
00:09  I discovered the game runs a rules engine that checks the player profile for up to 158 different
00:14  things, including whether you've ever paid, how much you've spent, how many hours since
00:18  your last ad, and even whether you have any of their other games installed.
00:21  And that's what decides the shop prices, every ad, which powerups show up and when,
00:25  and even the max speeds for your runs.
00:26  And these rules ship as JSON files the game gets from the server, and they can rewrite
00:30  it for anyone at any time.
00:32  Right now, there are 112 different versions being tested on players, and every ad you
00:35  watch gets logged with exactly how much it made them and which test version you were
00:39  on.
00:40  So for instance, depending on which version you get, the same powerups in the shop can
00:42  cost up to 3 times as many coins without any option to watch an ad for them.
00:46  So it's not the game you grew up with anymore, it's been tuned for years across millions
00:49  of players over 100 versions at a time, to figure out exactly how much it can get out
00:53  of you.
00:54  Let us know in the comments what app you'd like to see next.
```

On-screen material not spoken: a SYBO annual-report notice (May 26, 2026); the `UserStatKind` enum;
`promotions.json` (`adOffer_keys_promo` when `HoursSinceLastAdWatch >= 168`); `adplacements.json`;
`spawnchances.json` (Magnet gated on `FeatureUnlocked`); `runconfiguration.json` (`ab_speedtest_a`); a
`curl` of `gamedata.tower.sybo.net/v2.0/subway/…/archive.zip` listing eleven JSON files; the
`ad_impression` event; and the `products.json` against `ab_coin_price_consumables_D` hoverboard price.
