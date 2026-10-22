# Monetization: rewarded ads and paid income multipliers

**Status:** design note, no code. **Written:** October 22, 2026, America/New_York. **Backlog:**
`monetization-design`. It settles what `rewarded-ads`, `real-purchases` and `tap-multiplier-content` build.
**Owner decisions it rests on (2026-10-22):** watching an ad is rewarded; the ad-watch rate is measured and
used the way `docs/research/mobile-hook-patterns.md` describes; real-money income multipliers are sold in the
store. Development points and point packs stay removed (2026-10-20). Forced ads stay excluded (PLAN.md
non-goals).

**Read this first.** The review (section 14) found that the tap economy as built cannot carry a sold
multiplier: resting officers recover six times faster than patrolling ones, duty changes are free, and so any
stack above about x1.5 to x3 makes "rest, then tap" earn more than "patrol and tap". Section 3 shows the
arithmetic and names one engine precondition (D9). Until the owner approves it, `real-purchases` and the ad
reward do not ship.

## The decisions

| # | Question | Decision | Reason |
| --- | --- | --- | --- |
| D1 | What an ad pays | One timed power-up on the shared grant path: `ad-overtime`, source `powerup`, factor 1.5, 10 minutes of game time. No funding. | It rides the loop the player already runs, and the strain room caps its worth. A funding payout has no natural cap. |
| D2 | How the ad is sized | By tap pay, not the hourly net. It adds half of the entitlement and upgrade stack to each tap, and tap pay is capped by officer recovery (section 3). | At the start roster the most an unpaid player can add per day is about 3% of idle net. An ad is a small gift, never the best move. |
| D3 | When an offer exists | Only on the Desk, as an inline row, when the department has room for at least 300 taps, no ad power-up is running, three calls are resolved, no call has gone badly in the last six game hours, and the pace and daily cap allow it. | An offer for a reward the player cannot use, or made after a loss, is solicitation without value. |
| D4 | Where offers never appear | During a live call, on any call screen, on Board cards, on open, in the Store, in a notification, or as a modal. | PLAN.md excludes forced ads and notifications that pull a player into a call. |
| D5 | Ad reader | Offers shown, watched to the end, declined, over the last 10 offers or 14 days. Output: a watch rate and a gap step that a watch never shortens. | Ad history can cap solicitation as easily as push it. This reader only caps. |
| D6 | Cadence | Standard: one offer per 30 minutes, 4 per rolling 24 hours. The reader only lengthens the gap; the gap falls back one step per quiet day. No history takes it above standard. | The owner's rule: never above the standard rate or the hard daily cap. |
| D7 | Ad event log | Every event carries content fingerprint, tuning hash, timer setting and the profile readers in effect, in a local log outside the save. | `playtests` needs each note traceable to the rules that produced it. |
| D8 | What is sold | Two one-time entitlements: Overtime Budget (+0.5, so x1.5) and Overtime Budget Plus (+1, so x2). Both: x2.5. About $2.99 and $4.99. | One kind, additive, so it matches the owner's stacking rule and fits the ceiling in D9. |
| D9 | Stack ceiling and precondition | The reachable stack is at most x7, and that holds only if an engine change lands first: strain from paid details drains at the patrol rate on any duty, with no rest bonus. Without the change, no sold multiplier is safe. | Section 3: with the change, rotation gains nothing, and x7 keeps tap pay under an officer's patrol income at the top recovery upgrade (break-even x7.5). |
| D10 | Receipts | A purchase is granted only from a verified entitlement id that the billing adapter produced. Launch re-verifies and revokes what the store no longer shows. Needs validation: refund notifications must be configured and tested first. | The save is editable, so it can never be the authority. |
| D11 | Restore | Account-level. A Restore button, plus an automatic check at launch. | Apple requires a restore mechanism (M6, 3.1.1). |
| D12 | Consent | Ads are non-personalized by default. No personalised option in v1. Consent information is refreshed each launch, and the consent form opens when the player first taps Watch, never on open. | Lowest-risk default, and no modal on open. |
| D13 | Prices | One price per storefront for every player there. No per-player or cohort prices. The displayed amount always comes from the store product. | The EU personalised-price duty (S2) never triggers. |
| D14 | The blind rule | Ad history, purchase status and multipliers never reach call odds, call draws or pressure **directly**. Two probes, a draw test and an import test hold it. The strain route is named and put to the owner (section 7). | The profile doc's rule: money changes outcomes only through what it buys. |
| D15 | Ad network and billing | AdMob through `@capacitor-community/admob`; RevenueCat through `@revenuecat/purchases-capacitor`, behind an adapter. Both unverified in places (section 10). | Fits a Capacitor wrapper with no server of ours. |

## 1. The numbers this rests on

Each was read in the repo on this branch. Anything marked derived is arithmetic on those.

| Fact | Value | Where |
| --- | --- | --- |
| Pay per tap before multipliers | $1 | `TAP_TUNING.base`, `src/sim/department-taps.ts` |
| Strain per tap, split across free patrol officers | 0.1 | `TAP_TUNING.stressPerDollar` times base |
| Strain line, where taps stop paying | 30 | `DETAIL_STRAIN_LINE` = `STRESS_BANDS.strained`, `src/sim/officer.ts` |
| Tap rate cap and burst | 20 a second, 1 second | `TAP_TUNING` |
| Stress recovery by duty, per hour | rest 6, standby 3, patrol 1 | `ECONOMY_TUNING.recoveryPerHour`, `src/sim/economy.ts:46` |
| Recovery upgrade | multiplier up to 2 at the top tier | `src/content/dev-tree.ts:205-209` (tiers 1.5, 1.75, 2) |
| Changing a squad's duty | free, no cooldown | `setSquadDuty`, `src/sim/roster.ts:329` |
| Start idle net | $620 an hour (gross 1,200, wages 380, operating 120, supplies 80) | `src/sim/economy.test.ts`, "start budget" |
| Patrol income per officer | $150 an hour | the same test (`2 * 150`) |
| Rating lost to strain | 0 below stress 15, then linear to 55% at 100 | `STRESS_TUNING`, `conditionFraction` |
| Stacking | one kind adds, kinds multiply, the same power-up twice extends | `combinedFactor`, `grantMultiplier` |
| Code overflow guards | 1,000 per multiplier, 100,000 combined, 64 held | `MAX_*` constants |

Derived: the start roster has 4 free patrol officers (600 patrol income at 150 each). Their zero-stress capacity is
4 x 30 / 0.1 = 1,200 taps, but they start with stress already (12, 18, 8, 22 on patrol), and a run of `detailRoom` on a
new department returned 600 taps. One stress point is 10 taps.

A multiplier raises pay per tap and never strain per tap (header of `department-taps.ts`). It therefore
lowers the strain a player takes for the same money. Section 7 states what that does to odds.

## 2. What an ad pays (D1, D2)

**The reward.** `ad-overtime` joins `TAP_MULTIPLIERS` as `{ source: 'powerup', factor: 1.5, durationMs: 600_000 }`
and is granted through `grantMultiplier`. Offers are hidden while it runs, so watches never stack back to back.

**Within a kind, bonuses add (review finding 3 and 4).** If an earned power-up is also running, the ad adds
+0.5 to the power-up kind, not x1.5 on top of it. So the number the offer shows is never a formula: it is
`combinedFactor(held + ad) - combinedFactor(held)`, computed from the real holdings.

**Why not funding.** A flat funding payout ignores the strain room, so it either rounds to nothing late or
buys hours of income early, and each ad would need its own curve across roster sizes. A power-up scales with the
player's own room and expires. Funding stays a candidate only if playtests show offers feel empty (open
question 6).

**Why 1.5 for 10 minutes.** Tap pay is bounded by strain room, not time. At 20 taps a second a 10 minute window
could carry 12,000 taps and the largest room is 4,800 (16 officers x 300), so the window never limits the
reward. Ten minutes is long enough to use a room (1,200 taps is 4 minutes at 5 a second) and short enough that
an ad is not a standing buff.

**What a watch is worth (derived).** Extra pay = taps made inside the window x $1 x the factor difference above.
With nothing else running, the ad adds 0.5 x E x U, where E is the entitlement kind and U the upgrade kind.

| Entitlement E, upgrade U | Tap pay a day at the start roster (960 taps, after the section 3 change) | Share of idle net (14,880 a day) | Most an ad adds that day |
| --- | --- | --- | --- |
| x1, x1 | $960 | 6.5% | $480 (3.2%) |
| x1.5, x1 | $1,440 | 9.7% | $720 (4.8%) |
| x2.5, x1 | $2,400 | 16.1% | $1,200 (8.1%) |
| x2.5, x1.4 | $3,360 | 22.6% | $1,680 (11.3%) |

The daily 960 is 24 hours x 1 stress x 10 taps x 4 officers, at the unupgraded patrol rate. A new department's
room is a one-time stock of 600 taps beyond it (1,200 at zero stress), so a first watch can add up to $300 at x1
once. Offers wait for three resolved calls so the first minutes are not shaped by an ad.

The offer states what it delivers: the smaller of the room in taps and 12,000, times the factor difference
integrated over the 10 minutes with every held power-up's real expiry, rounded down (round two, finding 7). If an
earned power-up in the "before" stack ends sooner, the multiplier steps down when it does, and the offer says "up
to". A player with no room never sees an offer. **No ad, power-up or purchase may lower stress, raise
the strain line, raise the tap rate cap or the burst, or touch a call.** A test grants every registry entry and
asserts those values unchanged.

**An ad fails safe.** The reward is granted only on the plugin's `Rewarded` event, never on dismissal (M1). A
failed load grants nothing and is not counted against the player in the reader (it is `unavailable`, not
`declined`). AdMob's server-side verification needs a callback server (M1, M3); there is none, so a client can
fake a watch. That grants itself the power-up in a single player game under a cap, and every grant is logged.
Accepted.

**Game time.** `expiresAt` counts game time, and settlement drops it when the clock passes. A player who watches
and closes the app loses the window. The offer says "10 minutes" and the running line shows the end time.
Whether a live call pauses desk time is not verified here; `rewarded-ads` must check before it ships.

## 3. What keeps the stack in proportion (D9)

The first draft of this note bounded tap pay by patrol recovery (1 stress an hour). The review showed that is
the slowest recovery route. Resting squads recover 6 an hour, the recovery upgrade doubles it, and a squad can
change duty for free. A player can rest a squad, tap its officers up to the line, rest them again, and repeat.
Strain is paid back by resting, and resting costs only the patrol income the squad would have earned.

**The break-even, against the right comparison.** Officers recover while patrolling too, so the fair question is
whether "rest, then tap" beats "patrol and tap" for the same officer. One stress point is 10 taps, so an officer-hour
at recovery rate ρ funds 10·ρ·S dollars of taps at stack S. Patrol-and-tap earns $150 + 10·ρp·S an hour; resting
and tapping earns 10·ρr·S. Rotation wins when 10·S·(ρr − ρp) > 150, so when S > 15/(ρr − ρp).

| Recovery rates (stress an hour) | ρr − ρp | Rotation break-even S* |
| --- | --- | --- |
| Rest 6, patrol 1, no recovery upgrade | 5 | x3 |
| Rest 12, patrol 2, top recovery upgrade | 10 | x1.5 |
| Rest 6 x 1.25 with the watch commander bonus, top upgrade | about 13 | about x1.15 (reviewer's bonus figure; the commander lever is in `staff-pool.ts:65`, not re-read here) |

The unmultiplied game already sits near the line: at x1 with the top upgrade, resting funds $120 an hour of taps
against $150 of patrol. Any sold stack above x1.5 then moves a department with the upgrade from "patrol and tap"
to "rest and tap". The owner's rules (multipliers raise pay but not strain; free duty changes; fast rest) are each
reasonable. Together they make every sold multiplier a decision to move the economy from patrol to tapping.

A second comparison matters under any option: tap pay against the officer's idle patrol income. At the top upgrade
and patrol-rate recovery (ρ = 2) tap pay is 20·S an hour, which meets the $150 patrol income at S = 7.5. That is
the source of the ceiling below, not a rotation threshold.

**Options for the owner (open question 1), with a recommendation.**

| Option | What it is | Consequence |
| --- | --- | --- |
| **B (recommended)** | An engine change before any multiplier ships: strain from paid details drains at one rate on every duty, so rotation gains nothing. | Rotation break-even disappears (equal rates). The tap-versus-idle limit is x7.5 at the top upgrade (x15 without it). Ceiling x7 below. Needs a new engine item and a save change. |
| A | Keep the engine. Cap the reachable stack at the lowest rotation break-even, x1.5. | The ad alone (x1.5) sits on the edge, and a sold multiplier is worth almost nothing. Not worth shipping. |
| C | Raise strain per tap with the multiplier. | Removes the strain advantage too (finding 1), but a multiplier then saves only taps, so it sells nothing the rate cap does not already give. Reverses the owner's 2026-10-21 rule. |

**The rule option B must state (round two, finding 2).** Detail strain drains at
`recoveryPerHour.patrol x recoveryMultiplier x ageRecoveryFactor`, on every duty. It excludes the watch commander's
rest bonus and the rest and standby rates. It follows the officer through squad transfers and applies to
unassigned officers, since the engine gives them rest recovery today (`squads.ts:14`, `roster.ts:256`). Age lowers
recovery (factor 1 down to 0.8, `career.ts:102`), so it never loosens the bound. The data design (a per-officer
balance inside `stress`, or a separate pool) belongs to the engine item; this note fixes the rule and the tests.
At the top upgrade the rate is 2 an hour, so x7 pays 140 an hour against 150.

**Ceiling under B: x7.** Kinds multiply, so the budgets multiply:

| Kind | Reserved ceiling | Owner |
| --- | --- | --- |
| Entitlement (paid) | x2.5 | this note |
| Power-up (earned bonuses and the ad add) | x2 | `tap-multiplier-content`; the ad is +0.5 |
| Upgrade (development tree) | x1.4 | `tap-multiplier-content` |
| Product | x7 | test |

A test builds the largest simultaneously reachable holdings (every entitlement, every earned power-up the registry
allows at once, the ad, the top upgrades) and checks `combinedFactor` of that holding is at most 7. It does not
multiply per-kind maximums by hand (finding 3). A second test runs rest-and-tap, standby-and-tap, patrol-and-tap and a transfer between squads through the engine
at the top recovery upgrade, with and without the commander bonus, and asserts tap income per officer-hour is the
same on every route and at most the patrol income of $150. The code guards (1,000 and 100,000) stay overflow guards.

## 4. Where offers appear and never appear (D3, D4)

**Appears:** one inline row under "Work paid details" on the Desk. Not a modal, no countdown, no badge on the
tab.

**Admit and retain are different tests (round two, finding 5).** Conditions 1 to 7 below admit a new offer, and
admitting one is what spends the pace gap and one place in the daily cap. Once shown, the offer is retained
while conditions 1 and 2 hold (no run, and room with no ad running), until the player taps Watch or Not now. If it
leaves because a call starts or the room closes, it is logged `unavailable`, not `declined`. Showing it again is a
new offer and needs conditions 1 to 7 again, so it counts against the gap and cap again.

**All must hold to show an offer:**

1. No active call, decision or run (`activeRun` absent).
2. Room for at least 300 taps now (`detailRoom().taps`), and no `ad-overtime` running (while it runs, the row's
   slot shows its status line, which is not an offer).
3. At least three calls resolved in this save.
4. No adverse result in the last six game hours: the clock restarts at every adverse call, and the streak does not
   matter after that (finding 6, round two finding 4). A test plays adverse call A, then adverse call B, and
   expects no offer until six game hours after B.
5. At least two minutes since the app opened or came to the foreground.
6. The pace gap (section 5) and the daily cap allow it.
7. Either an ad is loaded, or consent is still to be gathered (section 9): the consent state is reachable
   without a loaded ad (finding 7).

**Never, in any state:**

- During a live decision, on the brief, review, result or debrief screens, or on a Board card.
- As a modal, interstitial, banner or on open.
- Paired with a bad result, injury or loss (no "watch to undo", "revive" or "double the reward of this call").
- Behind a progress gate: nothing the player needs to continue is locked behind an ad.
- With a timer, scarcity text or "last chance" wording, or by push or any notification.
- In the Store, next to a price, or with a store upsell triggered by watching.
- Re-shown inside the pace gap after Not now.

## 5. The ad reader (D5, D6)

A pure function of saved state, like `playerProfile`, in its own module (`src/sim/ad-reader.ts`), not a field
of `PlayerProfile` (section 8).

**Input:** the last 10 offer outcomes inside 14 days, each `watched` (rewarded event fired), `declined`
(Not now, dismissed, expired in view unwatched, closed early after starting) or `unavailable` (load failure or
consent form closed: not counted either way), with a timestamp.

**Output:** `watchRate` = watched / (watched + declined), silent until 3 outcomes are in the window, and a
`gapStep`.

| Window result | Target step | Gap between offers |
| --- | --- | --- |
| Watch rate 0.5 or more, or still warming up | 0 | 30 minutes |
| 0.25 to under 0.5 | 1 | 1 hour |
| Above 0 and under 0.25, or none watched in fewer than 5 outcomes | 2 | 2 hours |
| None watched in 5 or more outcomes | 3 | 4 hours |

**The step rule (finding 5, narrowed in round two).** The step rises to the target at once. It falls only with
time: one step for each rolling 24 hours with no new decline. **A watch never lowers the step in force.** What
this does and does not promise:

- No history ever takes the pace above standard (one per 30 minutes, 4 a day).
- A watch does not shorten a gap already set.
- It does not promise that a watcher is never offered more than a decliner: a watcher stays at standard while a
  decliner's gap grows. The reviewer showed that watches kept in the window can also keep a later decline from
  raising the step as far, so the claim "engagement cannot make offers more frequent" is withdrawn.
- Declines age out after 14 days, so a player who has refused for two weeks is offered at the standard pace again.

Then the daily cap: at most 4 offers shown in a rolling 24 hours at every step. The cap is checked last, so no
step beats it.

**What reads it:** only the offer scheduler. Purchase status is not an input; a buyer sees the same pace. The
Store never reads it; a heavy watcher gets no bundle. This one-way rule is tested (section 8).

**Tuning:** `AD_TUNING` through `tunable()` (`src/sim/tuning.ts`), so `tuningHash` changes when any of
`rewardFactor`, `rewardMs`, `minRoomTaps`, `standardGapMs`, `dailyCap`, `minResolvedCalls`, `quietMs`,
`windowOffers`, `windowDays`, `warmup`, `stepDecayMs` or the step table moves. A variant is a tuning change, and
the Lab's existing controls run it.

**Clock edits** can shorten a gap or reset the cap. The cost is the player's own and the effect is bounded by
the strain room. The cap uses the highest wall-clock seen, so a backward clock cannot lower the count.

## 6. The log (D7)

A ring buffer of the last 500 events in local storage **outside the versioned save**, the pattern
`docs/content-rating.md` uses for preferences (so it never touches determinism or the fingerprints). The game
transmits nothing and holds no analytics SDK. A facilitator reads it in a moderated session; `playtests`
exports it. The ad SDK reports to its own network as its terms say (section 9). Settings, Privacy has "Delete
ad and purchase log", which clears the buffer; uninstalling removes it.

Every event, ad and store, carries:

| Field | Meaning |
| --- | --- |
| `event`, `at` (wall ms), `gameAt` | `offer_shown`, `offer_declined`, `offer_unavailable`, `watch_started`, `watch_completed`, `watch_aborted`, `reward_granted`, `reward_failed`, `store_opened`, `purchase_started`, `purchase_verified`, `purchase_failed`, `restore`, `entitlement_granted`, `entitlement_revoked` |
| `contentFingerprint` | the compiled content fingerprint (the Lab names it `contentKey`; `rewarded-ads` must expose a runtime read: not verified to exist outside the Lab) |
| `tuningHash` | `tuningHash()` in `src/sim/tuning.ts` |
| `timerSetting` | `off`, `relaxed` or `standard` |
| `readers` | the profile readers in effect and their inputs: posture, stall (counted only on Standard), adverse streak, and the ad reader's window counts, watch rate and gap step |
| `offer` | placement, reward id, factor, duration, the worth shown, taps of room at the time, stack before and after |
| `install` | a random id made at first launch, never a device or advertising id |
| `build`, `adNetwork`, `adUnit` | for tracing a run to a release |

No advertising id, email, name or location in the log. Network-reported ad revenue is not in v1: whether this
plugin exposes it is not verified.

## 7. Paid multipliers (D8 to D11)

| Entitlement id | Name | Factor | Adds | Price point | Why |
| --- | --- | --- | --- | --- | --- |
| `desk-overtime` | Overtime Budget | 1.5 | +0.5 | about $2.99 | The first step, cheap enough to try. |
| `desk-overtime-plus` | Overtime Budget Plus | 2 | +1 | about $4.99 | Twice the bonus at a bit under twice the price. |

Non-consumable. Both owned: bonuses add within the kind, +0.5 and +1, so x2.5. Price points are U.S. dollars
the owner sets in each store console; the exact store tier grids were not opened. Within a storefront the price is the same for every player and device (D13). The store builds each
country's price from the price point (Apple's pricing page, not opened here), so the amount shown always comes from the
store product and is never hard-coded. Nothing is randomized, so the odds disclosure Apple requires for random items (M6,
3.1.1) does not apply.

**Stacking with the ad (derived, nothing else held; kinds multiply):**

| Held | Without ad | With ad (+0.5 power-up kind) |
| --- | --- | --- |
| nothing | x1 | x1.5 |
| Overtime Budget | x1.5 | x2.25 |
| Overtime Budget Plus | x2 | x3 |
| both | x2.5 | x3.75 |

**The honest value.** Pay scales with roster size, since room is 300 taps per free patrol officer. At the start
roster, after the section 3 change, both entitlements lift daily tap pay from $960 to $2,400, 16% of idle net.
That is modest on purpose. Pricing is a playtest read (`playtests`, tap-to-idle ratio), not a settled figure.

**Receipts (D10).** The billing adapter is the only thing that can produce a `VerifiedEntitlements` value (a
branded type: registry ids plus store transaction ids). A new command takes only that type and calls
`grantEntitlement(taps, id, at)` for each. `grantEntitlement` already refuses any id that is not an
`entitlement` entry in the registry. Steps:

1. Player taps Buy. The adapter runs the store flow and asks the store (or the billing service) to verify.
2. Only a verified, completed purchase yields the id. A pending purchase grants nothing (M8).
3. The command grants and records the transaction id with the multiplier in the save.
4. At every launch with a network, the adapter re-verifies. Any held entitlement the store does not show is
   revoked. A refund removes the multiplier, and the refund itself is the store's process, not ours.
5. Offline, the cached entitlement stays until the next successful check.

**Needs validation before D10 is accepted (finding 10).** RevenueCat's page says refunds for one-time purchases
reach it only if Platform Server Notifications are configured (M12). A re-check against a service that was never
told about the refund keeps reporting ownership. Done means: notifications configured on both stores, and a
refunded test purchase on a real device loses its multiplier.

A hand-edited save can add a multiplier. The step 4 check removes it the next time the device is online, and
the grant path refuses anything the registry does not list. The first grant after install always comes from
step 2.

**Restore across reinstall (D11).** Entitlements belong to the store account, not to a save slot: on a new
install or a new department, the adapter's verified list grants through the same path. A Restore purchases
button sits in the Store and in Settings. The Apple restore is player-triggered because it can open a store
sign-in (M11); the launch check uses the quiet sync call. Android re-reads owned purchases when the billing
connection opens (M8). The factor granted is the registry's current factor, and a registry test asserts a sold
entitlement's factor never drops across versions.

**The strain route (finding 1).** A purchase never changes odds directly. It lowers the strain needed for a
given income, so a payer who taps to the same pay as a free player carries fewer stress points. In a controlled
comparison the review ran with identical calls and equipment, stress 30 against 7.5 moved one eligible choice
from 69.0% to 78.8% favorable (reviewer's measurement; not reproduced here). Funding already buys kit and
people that move odds, so this is the same class of route, but it is a route, and the Store wording does not
deny it. Held as designed pending open question 2. Validated by a playtest journey that compares an equal-income
paid and unpaid department, and by the probes' honest scope in section 8.

## 8. The blind rule and its probes (D14)

**Rule:** ad history, purchase status and held multipliers never reach call odds, call draws or pressure
directly. Ad history never reaches the Store, and purchase status never reaches the ad reader. The condition
route through strain (section 7) is outside what these probes hold, and they say so.

Today: `funding-balance` in `src/architecture/wiring.ts` adds ten million to funding and must stay a gap at
zero; the profile readers (`comebackTier`, `sourceStarts`, reputation, officer history) take their own fields,
not the whole profile.

| Probe or test | Where | What it proves |
| --- | --- | --- |
| `new:ad-history-blind` | a gap probe in `wiring.ts` | Perturbs the ad window to its extremes (all watched, all declined, cap reached) and measures every sampled choice. Moved: 0. Flips: 0. Must stay a gap. |
| `funding-balance`, extended | `wiring.ts` | The perturbation adds ten million funding **and** holds both entitlements, a running `ad-overtime` and a purchase record, with officer stress held fixed. Moved: 0. Today it checks funding only. |
| Draw-blind test | `src/sim`, next to the draw code | The same save seed with ad history, entitlements and a running power-up differing: `drawCard` returns the same call (type, tier, id) over 200 seeds, `comebackTier` and `sourceStarts` return the same values for every timer setting. |
| Import test | `src/architecture/`, using `src/dev/import-graph.ts` | No module that draws calls, resolves a check or sets pressure can reach `ad-reader` or the entitlement module by imports. Not verified: the import-graph helper was not read. |
| Ceiling and rotation tests | `src/sim` | Section 3's two tests, plus: no registry entry lowers stress, the line, the rate cap or the burst. |

The wiring probes sample odds only. Draws and pressure need the draw-blind test; this is why both exist.

## 9. Consent and disclosure (D12, D13)

| Duty | Decision | Source |
| --- | --- | --- |
| Non-personalized ads | `npa: true` on every request. No personalised toggle in v1. Non-personalized ads still use cookies or mobile identifiers for frequency capping and aggregated reporting, so this does not mean no identifier. | M1, M14 |
| EU, UK, Switzerland consent | Google's UMP flow. Consent information is refreshed at every launch (M4). The Desk row shows in a consent-pending state with no ad loaded; the first Watch tap opens the consent form, and the ad loads only after `canRequestAds` is true. Settings, Privacy shows the privacy options entry when the SDK reports it required. | M1, M4 |
| iOS App Tracking Transparency | Apple defines tracking as linking app data with other companies' data for targeted advertising or measurement, and requires the prompt before tracking or reading the advertising identifier (M5). Whether the AdMob SDK in non-personalized mode needs the prompt or changes the privacy label is **not verified**; Apple counts an SDK that combines data with others as tracking "even if you don't use it for those purposes" (M5). `store-wrap` resolves it before submission. If the prompt is needed, it opens after the first Watch tap with a purpose string, and **declining it leaves the reward, the offers and every other feature unchanged** (M6, 5.1.2). | M5, M6, M14 |
| Google Play Families policy | Not applicable. It applies "if one of the target audiences for your app is children" (M7). The target is the Mature rating (ESRB M, PEGI 16, backlog 2026-10-19). Risk: Google may review the target audience by imagery and terms (M7), so the store art and listing must read as adult. Declare the target audience as adults only; set child-directed treatment off. | M7 |
| Rewarded ads, Apple | Incentivizing an in-app action such as watching an ad is allowed (M6, 3.2.2(x)); ads must be age-appropriate, and apps with ads must let users report inappropriate ads (M6, 2.5.18, read through a summarizer: recheck the text). The note does not assume the SDK's overlay provides the report control: release requirement R3 below keeps one in Settings. | M6 |
| Rewarded ads, Google | Google's rewarded-ad policy page (support.google.com/admanager/answer/7496282) returned no content to the fetch tool, so the reward-disclosure and opt-in rules are **not read**. The offer's design already describes the reward exactly and asks first, and `store-wrap` reads the policy before submission. | not read |
| EU personalised prices | Prices never vary by person or cohort, so the Directive 2011/83/EU Art. 6(1)(ea) disclosure (S2) never applies. A price variant is a new decision with a visible disclosure first. | S2 (opened by the research session) |
| In-game currency guidance | Nothing virtual is sold: no coins, no gems, no packs. The entitlements are permanent and priced in real currency. | S3 (opened by the research session) |
| U.S. state privacy | AdMob supports restricted data processing and Global Privacy Platform signals through UMP (M15, a legacy SDK page that recommends the Next-Gen SDK). Default for U.S. users is restricted data processing on until the owner decides. The page does not say which states or when; `store-wrap` settles that with counsel. | M15 |

**Release requirements (each has a named check, finding 9):**

| # | Requirement | Verified by |
| --- | --- | --- |
| R1 | Privacy policy link in Settings, Privacy, and on both store listings | A device walk-through on iOS and Android |
| R2 | App Privacy answers and Play Data safety form listing the ad SDK's and billing service's data | Listing drafts reviewed against each vendor's disclosure pages |
| R3 | A way to report an inappropriate ad that survives the reward and the offer's ineligibility: a "Report an ad" entry in Settings, Privacy at all times, and a link on the running status line | A device test with a live ad, then a check after the offer row has gone; the SDK's own overlay control is a bonus, not the plan |
| R4 | The local log can be deleted by the player, and uninstall removes it | Settings, Privacy, "Delete ad and purchase log" tested on device |
| R5 | UMP consent form and privacy options entry work in a consent region | The UMP debug geography setting on a test device (M4) |
| R6 | Refund test: a refunded purchase loses its multiplier | Section 7 |

## 10. Ad network SDK and billing plugin (D15)

All pages read 2026-10-22 through a fetch tool that summarizes the page; quoted wording is the tool's report, so
recheck exact text at `store-wrap`. The Capacitor version comes from the wrapper `store-wrap` chooses.

**Ad network: AdMob through `@capacitor-community/admob`.** Recommended.

- M1 (GitHub README): rewarded video and rewarded interstitial; `prepareRewardVideoAd`, `showRewardVideoAd`;
  grant on the `Rewarded` event, not `Dismissed`; consent through `requestConsentInfo`, `showConsentForm`,
  `showPrivacyOptionsForm`, with `canRequestAds`; ATT through `requestTrackingAuthorization`; `npa` option;
  MIT; v8 needs Capacitor 8.5 or later, v7 plugin for Capacitor 7; iOS 15+, Android API 24+.
- M2: Capacitor's own ads guide recommends this plugin.
- M3: the Google rewarded page: the reward callback fires before dismissal; use test ad unit ids in
  development, or "Google can suspend your account".
- Failure mode: one network, no mediation, so fill and rates depend on AdMob alone. Alternative: a mediation
  layer later. A search for AppLovin MAX and Unity LevelPlay Capacitor plugins found none; that was a search
  listing, not an opened page, so treat it as unverified.
- Not verified: the latest release and date (the Releases section came back empty), and whether the plugin
  exposes impression revenue.

**Billing: RevenueCat through `@revenuecat/purchases-capacitor`.** Recommended, behind a `BillingProvider`
adapter so the sim sees only registry ids.

- M10: wraps StoreKit and Google Play Billing; Android launch mode must be `standard` or `singleTop`.
- M11: restore from the same store account; `restorePurchases` only on user action; `syncPurchases` for
  programmatic sync, with an aliasing caveat.
- M12: non-consumables supported; Android needs SDK 7.11.0 or later or the purchase is consumed; one-time
  refunds need Platform Server Notifications.
- **Not verified:** how RevenueCat validates receipts, and its pricing. None of the pages explained validation.
  Resolve both before `real-purchases` commits to it.
- Alternative: `capacitor-plugin-cdv-purchase` (M13, MIT), which validates with your own server or Iaptic and
  lists no explicit maintenance status. The store rules are the same primary documents: acknowledge within three
  days or Google refunds the purchase (M8, M9), grant only in the `PURCHASED` state, and never use `orderId` as
  a key (M9).
- Failure mode: a third-party service becomes the authority on what a player owns. Control: the adapter
  interface, the launch re-check, and the registry as the only source of factors.

## 11. Player wording draft

Follows `.agents/skills/swat-call-prose/SKILL.md`: no em or en dashes, colons only in clock times and stat
rows. Not final: the owner and the interface lane approve it. Numbers in braces come from the real holdings.

**Offer row (Desk).** The multipliers shown are the actual before and after, never a promised percent:

> **Extra pay on details**
> Watch an ad and details pay x{after} instead of x{before} for up to 10 minutes. Your officers have room for
> about {room} more taps, so this is worth up to ${worth}.
> [Watch] [Not now]

A new department reads: "details pay x1.5 instead of x1 for up to 10 minutes ... room for about 600 more taps,
so this is worth up to $300."

Running (the slot's status line, with a "Report the ad" link): "Details pay x{after} until 4:40."
Load failure: "The ad did not load. Nothing was used."
Footer: "Ads are not personalised. Watching is your choice. It raises your pay and does not change which calls come."

**Profile line (`profile-surface`):**

> Ad offers: one every 30 minutes at most, four a day. You skip most of them, so you see one every 2 hours.
> This changes only how often an offer shows. It does not change which calls come.

At the standard pace: "Ad offers: one every 30 minutes at most, four a day."

**Store card:**

> **Overtime Budget**
> Details pay x1.5, for good. {price from the store}. The same price for every player in your country.
> It raises your pay. It does not change which calls come.
> [Buy] [Restore purchases]

The decline label stays neutral ("Not now"). No wording shames a decline, and no wording says money cannot help
you in a call.

## 12. Changes recommended to the backlog items (the lead edits)

- **New engine item, precondition (D9):** strain from paid details drains at the patrol rate on any duty, with no
  rest bonus and following the officer across squads (the rule in section 3), with the rotation test. Blocks `tap-multiplier-content` (beyond the base), `rewarded-ads` and `real-purchases`
  until the owner picks B.
- `rewarded-ads`: reward is `ad-overtime` +0.5 for 10 minutes; offer gates in section 4; reader in
  `src/sim/ad-reader.ts` with `AD_TUNING`; local log outside the save; probe `new:ad-history-blind` plus the
  draw-blind test; confirm whether a live call pauses desk time; expose a runtime content fingerprint; consent
  entry state; the offer shows the real before and after.
- `real-purchases`: two entitlements with the ids and factors in section 7; the `VerifiedEntitlements` branded
  type; Restore in Store and Settings; probe `funding-balance` extended as section 8 says; resolve the
  RevenueCat validation and refund-notification questions first.
- `tap-multiplier-content`: stay inside the section 3 budgets (upgrades up to x1.4, earned power-ups up to x2
  including the ad's +0.5) and add both tests.
- `profile-surface`: the ad line, with its one change, plus the existing stall and eased lines.
- `playtests`: add ad cadence, the offer worth shown against the tap pay earned, an equal-income paid and
  unpaid journey, a rest-and-tap rotation check, and whether testers understand that an ad and a purchase change
  pay only.
- `store-wrap`: resolve R1 to R6, the ATT and privacy-label question, the U.S. state path and Google's rewarded
  policy.

## 13. Open owner questions

1. **The economy precondition.** Approve option B in section 3 (an engine change so detail strain drains at the
   patrol rate on any duty, with no rest bonus), or choose A or C? Without B, no sold multiplier ships.
2. **The strain route.** A multiplier lowers the strain needed for the same pay, and strain below the line costs
   up to 9.7% of rating contribution. Accept this indirect route, or choose C?
3. **Entitlements per account or per slot.** This note says account.
4. **Is the ad too small?** At x1 it adds about 3% of idle net a day. Playtest or decide now.
5. **First-room stock.** The fresh room is worth $1,200 at x1, and multipliers scale it. Exempt the first day,
   or accept?
6. **A funding fallback** for players at the line, so an offer is never empty. This note removes the offer
   instead.
7. **Server analytics.** The watch rate is local only. Confirm there is no server, so facilitators export logs.
8. **A mediation network** later for fill, at the cost of a second SDK.
9. **Price points** of about $2.99 and $4.99, and the x2.5 entitlement kind.
10. **Personalised ads, ever?** v1 ships non-personalized only, which pays less. A later opt-in needs ATT and UMP
    work.

## 14. Challenge record

Codex, read-only, default model, run 2026-10-22 with the brief to find dark patterns, solicitation that rises
with engagement, pay-to-win leaks into odds, store and consent gaps, and numbers that break the economy. It ran
two small engine checks in memory and cited file and line. Round one verdict: **needs validation**, 10 findings, all
serious. The full output is kept outside the repo in the shared notes folder (`monetization-codex-round1.md`).

| # | Finding (note line in the first draft) | Verdict | What changed |
| --- | --- | --- | --- |
| 1 | The Store card promised "never changes how calls go" while a purchase lowers strain, and the probes hold condition fixed. Reviewer measured 69.0% to 78.8% at stress 30 against 7.5. | **Accepted** | The promise is removed from the wording. Section 7 names the route, section 8 limits what the probes claim, `funding-balance` holds stress fixed, and open question 2 asks the owner. An equal-income journey goes to `playtests`. |
| 2 | The bound used patrol recovery (1 an hour). Resting recovers 6, the upgrade doubles it, and duty changes are free, so rest-and-tap beats patrol. | **Accepted, the largest miss.** Checked at `economy.ts:46`, `dev-tree.ts:205-209`, `roster.ts:329`. | Section 3 rebuilt on the break-even S* = 15/ρ. The x12 ceiling is withdrawn; ceiling x7 under a new engine precondition (option B), with a rotation test. SKUs repriced and shrunk. |
| 3 | The ceiling test multiplied per-kind maximums, but code adds within a kind: x9 reported, x15 real. | **Accepted** | The test now takes the real `combinedFactor` of the largest simultaneously reachable holdings. |
| 4 | The ad would promise "50% more" but, with an earned power-up running, deliver less. | **Accepted** | Reward is +0.5 on the power-up kind. The offer shows the actual before and after from `combinedFactor`, never a percent. |
| 5 | A watch shortened the gap, so solicitation rose with engagement. Zero-watch windows of 3 and 4 were undefined. | **Accepted** | Watches never lower the gap step; only a quiet day does, one step each. The table now covers zero watched. The 14-day expiry is stated as a return to standard, not above. |
| 6 | "No offer after harm" had no gate. | **Accepted** | Condition 4 in section 4, with a test on `adverseStreak`. |
| 7 | The consent form opened only after Watch, but Watch appeared only with a loaded ad, which a consent-region user could not get. | **Accepted** | A consent-pending row state needs no loaded ad. Load failure and a closed form count as `unavailable`, not `declined`. Consent info refreshes each launch. |
| 8 | "Read no identifier by design" is wrong for non-personalized ads; ATT denial must not change rewards. | **Accepted** (read M14) | Claim removed. ATT stays an open `store-wrap` item. Declining leaves the reward and offers unchanged. |
| 9 | Missing in-app policy, log retention and deletion, ad reporting, U.S. state path. | **Accepted** (read M15) | Release requirements R1 to R6 with named checks and a U.S. state row. |
| 10 | Launch re-checks do not prove refund revocation unless notifications are configured. | **Accepted** (matches M12) | D10 is marked needs validation, with the on-device refund test as its done condition. |

**Reviewer's strongest case, kept in view:** a paying, engaged player earns faster, keeps better officer
condition, sees offers as often as anyone, and is told none of it touches calls. The note now says the first part
is true, limits the third by construction, and leaves the second to the owner.

### Round two: 9 findings against the rewrite

Same reviewer and settings, told not to repeat round one unless a fix failed. Verdict: **needs validation**; 8
serious, 1 minor. It confirmed the stacking arithmetic (x2.5 both, x3.75 with the ad, x7 at the reserved
ceilings). Output kept in the shared notes folder (`monetization-codex-round2.md`).

| # | Finding | Verdict | What changed |
| --- | --- | --- | --- |
| 1 | The break-even ignored that officers also recover while patrolling, so it overstated rotation's gain. The fair test is 10·S·(ρr − ρp) > 150: x3 without the upgrade and x1.5 with it. Under option B equal rates remove rotation's gain, and x7.5 is a threshold against idle income. | **Accepted** (arithmetic checked) | Section 3 names both comparisons. The table, option A's ceiling (x1.5), the header and the rotation test now use the right one. |
| 2 | "Patrol rate" in option B left out the recovery upgrade, the watch commander bonus, unassigned officers and transfers. | **Accepted** | Section 3 states the rule: patrol base x upgrade x age, no rest bonus, on every duty, following the officer. The data design stays with the engine item. Age checked as a brake (factor 1 to 0.8). |
| 3 | Watches in the window can keep a later decline from raising the step, so "engagement cannot make offers more frequent" is false. | **Accepted, promise narrowed** | The claim is withdrawn. What holds: nothing exceeds standard, and a watch does not shorten a gap in force. A watcher stays at standard while a decliner's gap grows. |
| 4 | "Another call resolved" released the adverse block after a second adverse call. | **Accepted** | The block is six game hours from the latest adverse result. A test plays two adverse calls in a row. |
| 5 | Showing an offer spends the gap and cap that its visibility depended on, so it would vanish at once. | **Accepted** | Admit and retain are separate tests. Leaving because a call starts is `unavailable`, and reappearing is a new offer. |
| 6 | The ad footer still said it never changes calls. | **Accepted** | Footer, profile line and Store card now say it raises pay and does not change which calls come. |
| 7 | The instantaneous stack is not the stack for ten minutes when an earned power-up expires sooner. The new-department example used 1,200 taps, but the real room is 600. | **Accepted** (reproduced: `detailRoom` on a new state returned 600 taps; starting stress 12, 18, 8, 22) | The worth is integrated over real expiries and the wording says "up to". The example is $300 for 600 taps. |
| 8 | The Report fallback sat in the offer row, which hides while the ad runs. | **Accepted** | R3 keeps a Report entry in Settings, Privacy at all times, plus a link on the running status line. |
| 9 | "Identical for every player and device" overreached: stores generate per-country prices. | **Accepted** | D13 and section 7 say one price per storefront, shown from the store product. |

A third round was not run. Round two's findings were all answered by correcting or narrowing a claim, and the one
open design question (the engine precondition) is the owner's to decide before anything is built.

## Sources and verification record

Opened 2026-10-22 through a page fetch that returns a summary (M1 to M15); the research note's S2 and S3 were
opened by the session that wrote it on 2026-10-21 and are not reopened here.

- **M1:** [capacitor-community/admob](https://github.com/capacitor-community/admob). Vendor repository.
- **M2:** [Capacitor, Advertisements guide](https://capacitorjs.com/docs/guides/ads).
- **M3:** [Google AdMob, rewarded ads (Android)](https://developers.google.com/admob/android/rewarded).
- **M4:** [Google AdMob, privacy and UMP (Android)](https://developers.google.com/admob/android/privacy).
- **M5:** [Apple, User privacy and data use](https://developer.apple.com/app-store/user-privacy-and-data-use/).
  Apple's `AppTrackingTransparency` documentation page did not render for the fetch tool and was not used.
- **M6:** [Apple, App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/). First
  100,000 of 114,428 characters read.
- **M7:** [Google Play Families policy](https://support.google.com/googleplay/android-developer/answer/9893335).
- **M8:** [Google Play Billing, integrate](https://developer.android.com/google/play/billing/integrate).
- **M9:** [Google Play Billing, security](https://developer.android.com/google/play/billing/security).
- **M10:** [RevenueCat, Capacitor installation](https://www.revenuecat.com/docs/getting-started/installation/capacitor).
- **M11:** [RevenueCat, restoring purchases](https://www.revenuecat.com/docs/getting-started/restoring-purchases).
- **M12:** [RevenueCat, non-subscription purchases](https://www.revenuecat.com/docs/platform-resources/non-subscriptions).
- **M13:** [j3k0/cordova-plugin-purchase](https://github.com/j3k0/cordova-plugin-purchase).
- **M14:** [Google AdMob, ad serving modes (iOS)](https://developers.google.com/admob/ios/privacy/ad-serving-modes).
- **M15:** [Google AdMob, U.S. state regulations (Android)](https://developers.google.com/admob/android/privacy/us-states).
- **Pages that did not answer:** AdMob help pages 6201362 and 7356431 (interstitial rules and ad unit ids), and
  the Google rewarded-ad policy page 7496282 (empty), so the rewarded-ad program policy is **not read**.
- **Repo facts** read on `claude/monetization-design-8fed11` at `025b5f3`: `src/sim/department-taps.ts`,
  `src/sim/player-profile.ts`, `src/sim/officer.ts`, `src/sim/economy.ts`, `src/sim/economy.test.ts`,
  `src/sim/roster.ts` (the duty handler), `src/content/dev-tree.ts` (the recovery tiers),
  `src/architecture/wiring.ts` and `manifest.ts` (the lines quoted), `src/sim/types.ts` (multiplier types).
- **Arithmetic** in sections 1 to 3 and 7 is derived from those constants; no code was run for this note. The
  reviewer's 69.0% to 78.8% resolver figure is its own measurement.
