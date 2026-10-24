# World redesign challenge, 2026-10-24

Unedited Codex output on the first draft of [world-redesign.md](world-redesign.md). Astra ran on the configured default (`gpt-6-astra`); sol ran with `-m gpt-6.1-sol`. Both were read-only. What was adopted and rejected is in the challenge record at the end of world-redesign.md. The economy model that reproduced sol's table is below the two outputs.

## Astra: break the plan

**VERDICT: reject.** The plan rewards preserving crime, makes logging out tactically advantageous, and bases progression on an income split its own numbers cannot produce.

The strongest version is compelling: a persistent city gives calls continuity, while officers remember what happened and make roster decisions matter. Coverage funding could support that world without demanding constant attention. The draft instead ties those strengths to arrest revenue, attendance chores, and a large amount of unbudgeted narrative work.

I read the requested documents and simulation code. Calculations below are independently recomputed; the proposed world simulation does not exist, so these are design counterexamples, not reproduced implementation bugs. No files were edited.

1. **Crime farming is profitable under the stated rules. [critical]**

   **Failure:** Keep a district dangerous, concentrate patrol there, leave its crew head free, and harvest lower tiers. Avoid the harder calls or receive their offline tails.

   At crime 50, ten NPC units produce ideal case value of **380.25/hour**. At crime 100, that doubles to **760.50/hour**. The largest possible allocation loss across the entire stated trust range is only `600 × (1.3 − 0.8) = 300/hour`. NPC cases alone can therefore beat the maximum penalty by **80.25/hour**. One eight-hour proactive shift daily adds another **164/hour averaged over the day** to the crime-50-to-100 advantage.

   This assumes the draft’s favorable custody conversion, unchanged tier weights, and replenished subjects. Those are permitted assumptions because the countervailing rules are unspecified. Crew regrowth replenishes the farm.

   **Fix:** Remove the positive connection between crime and net financial return. Fund coverage and prevention; make additional crime consume capacity and create story obligations. A larger neglect penalty would merely move the optimal farming point. ([Draft](../docs/world-redesign.md))

2. **The central reward loop is an arrest bounty. Charging delays do not change that. [critical]**

   **Failure:** A living tier-4 subject is worth 200 tier-1 subjects. Players rationally prioritize lucrative suspects over less profitable people needing help. A lawful release earns nothing; a charge produces money and reduces crime. The system teaches that charging people proves police effectiveness.

   “Force cuts the payout” encourages preserving the bounty. It does not establish proportionality, lawful grounds, or public benefit. A half-value tier-4 custody still pays **15,000**, versus **150** for an unharmed tier-1 custody. The world models crime primarily through crews and their removal, while civilians become sources of intel, danger, or revenue. That is the copaganda failure in the mechanics.

   **Fix:** Pay for funded service and independently defined case milestones, with equal financial treatment for justified release, exoneration, diversion, handover, and arrest. Never attach a department payout to a person’s tier or physical condition. Preserve civilian safety as its own consequence. This deliberately restores the existing [coverage-only funding rule](../docs/patrol-work.md).

3. **Closing the app is the strongest tactical action. [critical]**

   **Failure:** The same armed contact becomes a live call online and a schedulable tail offline. Background the app during proactive work, return with leads, recover and equip officers, then serve warrants. Staying online accepts urgency and potentially the six-minute response penalty.

   Identical random seeds cannot make different resolution rules equivalent. A 24-hour tail also contradicts the promise that a seven-day return loses nothing. If expiry starts when the contact occurs, sleeping consumes its useful life; if it starts on return, logging out preserves opportunities.

   **Fix:** Generate the same persistent lead in both states. Let the player explicitly accept a live operation; pause it on interruption. Remove real-time expiry from earned leads. Preserve the explicit hidden-app protection in [call-pressure.md](../docs/call-pressure.md).

4. **The intended income split is mathematically impossible as written. [critical]**

   **Failure:** The draft budgets allocation at 30% and ten patrol units at 35%. With allocation of 600/hour, total gross would need to be **2,000/hour**. Ten grade-1 patrol units already generate **2,100/hour**, before any other income.

   Even maximum allocation, 780/hour, cannot reconcile that ratio. If the author meant **600 per district**, that must be stated: it is a different economy from the documented city allocation and current implementation.

   The expression `210 × unit × grade` also conflicts with existing grades. Numeric grades 2 and 3 would produce 420 and 630 per employee; the code pays **250 and 300**, respectively. ([Actual grade table](../src/sim/patrol.ts))

   These illustrative snapshots show the direction the numbers actually take:

   | Snapshot | Patrol grant/h | NPC case value/h | SWAT case value/h, averaged¹ | Allocation share² | Net/h³ |
   |---|---:|---:|---:|---:|---:|
   | Early: 4 grade-1 patrol, 1 squad | 840 | 152.10 | 164 | 34.2% | 936.10 |
   | Mid: 10 grade-2 patrol, 2 squads | 2,500 | 380.25 | 164 | 16.5% | 1,954.25 |
   | Late: 12 grade-3 patrol, 4 squads | 3,600 | 456.30 | 164 | 12.4% | 1,996.30 |

   ¹ One eight-hour proactive shift daily.  
   ² Of these four sources; calls and warrants excluded because their frequency and fees are undefined. Adding them reduces allocation’s share further.  
   ³ Crime 50, allocation 600, full-value eligible charges, no boosts/development income/Command Staff/training. Patrol costs use current grades. SWAT payroll is illustratively 380/760/1,520, holding starting average wages constant; fixed costs are 200. These are stationary illustrations, not campaign forecasts.

   **What happens:** Early case income can matter. Mid-game grants dominate. Late-game the single proactive squad contributes a shrinking share, while additional SWAT payroll can absorb much of patrol progression. Calls cannot be declared “where growth happens” without their rewards, cadence, costs, and progression gates.

   **Fix:** Define actual early/mid/late states and balance net cash flow, purchase timing, and department progression together. Delete the percentage targets until the model produces them. ([Claimed split](../docs/world-redesign.md))

5. **The worked averages are correct; the eight-hour sales pitch is misleading. [high]**

   The favorable arithmetic is:

   - NPC contact: `.85×150 + .14×900 = 253.50`. Tier 3 contributes no custody payment.
   - Four NPC units: `.6×253.50 = 152.10/hour`.
   - SWAT contact: `.50×150 + .35×900 + .13×5,000 + .02×30,000 = 1,640`.
   - SWAT shift: `.3×1,640×8 = 3,936`.

   **Failure:** These are eventual gross values assuming eligible contacts become successful charges, with no force discount, failed cases, escalation losses, or subject depletion. The draft never supplies those conversion probabilities.

   Under sixteen independent unit-hour trials, that ideal eight-hour shift has:

   - **Median eventual payout: 1,200**, versus mean 3,936.
   - **69.5%** probability of no tier-3/4 contact.
   - **7.4%** probability of no contact.
   - **4.7%** probability of at least one tier-4 contact.
   - **76.2%** of expected value supplied by tiers 3 and 4.

   Starting with an empty case pipeline, hourly contacts at hours 1–8 produce only **1,020 expected funding credited by hour 8** under the stated case clocks:

   `0.3 × (75×7 + 315×5 + 650×2 + 600×0)`

   Stress is also misstated. Eight hours adds **16 stress per officer**. The claimed **40-point swing** against standby applies only when the officer had at least 24 stress available to recover. Starting at zero, the swing is 16. “A call’s worth” has no demonstrated benchmark.

   **Fix:** Show immediate cash, pending case value, payout distribution, and actual condition changes separately. Balance ordinary shifts around ordinary outcomes.

6. **The case clock either does almost nothing or sells throughput. [high]**

   **Failure:** With unlimited parallel cases, halving clocks advances payment but does not double long-run earnings. Records Clerk sells working capital and earlier purchases. With limited case slots, it can increase throughput, but slots and capacity are absent from the design.

   Other unresolved rules create exploits: release and recharge the same subject; pay through both warrant and ordinary case settlement; improve “intel on file” after custody to retroactively increase value; duplicate a payment through interrupted charging.

   **Fix:** Define cases around unique incidents and evidence, with explicit charge/release/reopen transitions and one payment identity. Specify when quality is measured and whether capacity exists. Remove Records Clerk until its actual marginal benefit is measurable. ([Case rules](../docs/world-redesign.md))

7. **Random tier-4 custody can skip the entire case ladder. [high]**

   **Failure:** Proactive SWAT can take a tier-4 subject directly into custody, collapsing a crew. That bypasses the supposed progression through intel, lieutenants, warrants, and the final operation.

   At crime 50, the ideal boss-contact rate is **0.006 per active hour**, averaging roughly **21 eight-hour shifts** between contacts. Some players skip the arc immediately; others grind weeks. If bosses are unavailable until progression permits them, the advertised SWAT expected value is wrong before that unlock.

   **Fix:** High-tier patrol contacts produce evidence or sightings. Custody requires the case’s authored legal and operational prerequisites. Define what happens to contact weights when a tier has no eligible subjects. ([Crew collapse](../docs/world-redesign.md))

8. **Proactive shifts recreate the readiness-versus-income problem the existing design removed. [high]**

   **Failure:** Keep the best squad available and send a cheap secondary squad to farm cases and bonds, because contact rates and tier weights do not depend on qualifications. If weak squads instead suffer hidden custody penalties, the quoted returns and previews become false.

   Cancellation is another hole. If stopping a shift immediately removes the six-minute response penalty, cancel whenever a call appears. If cancellation is forbidden, an eight-hour assignment becomes a long lockout. Stress boundaries also matter: an officer starting at 64 reaches mandatory recovery after eight hours, before any escalation.

   Six game minutes can consume a substantial part of the existing 10–13-minute threat windows. It cannot be treated as flavor text.

   **Fix:** Specify assignment exclusivity, qualified custody requirements, cancellation settlement, dispatch handover, and automatic stops at readiness thresholds. Prefer deliberate lead work with no SWAT cash yield. [Patrol-work.md already explains this failure](../docs/patrol-work.md).

9. **The monetization promise is broader than the design can honor. [high]**

   **Failure:** Night Watch buys a second shift that generates additional bonds, contact opportunities, and potential warrants. Those affect coordination, stress buffering, options, and future outcomes. Records Clerk accelerates purchases of equipment and training.

   This does **not** prove that bank balance directly modifies a roll. The existing [player-profile contract](../docs/player-profile.md) explicitly permits purchased equipment and personnel to matter. But the new promise that nothing sold changes relationships or outcomes is false, and “intel and warrants never sold” is undermined by selling extra unattended opportunities to generate them.

   **Fix:** Remove paid advantages from relationship development and lead generation. State the narrower funding/odds contract honestly, and audit entitlement effects through assignments, opportunities, information, and roster development, not merely the balance field.

10. **Boosts massively amplify net income, and Double Shift contradicts the finite catalog. [high]**

   **Failure:** At the existing starting budget:

   | Patrol multiplier | Steady department net/h |
   |---|---:|
   | ×1 | 620 |
   | ×2 | 1,460 |
   | ×3 | 2,300 |

   Charter therefore makes steady net income **2.35×**, not 2×. Charter plus Double Shift makes it **3.71×**. At twelve grade-3 patrol employees, each extra multiplier point adds **3,600/hour**.

   Buying Charter and then its bundle must not grant Charter twice. The existing earned ×1.5 community grant also needs an explicit rule when Charter plus Double Shift already reaches the new cap.

   Double Shift has two incompatible readings: repeatable consumable purchases violate “buy everything once”; a once-per-account purchase has weak value when the same benefit arrives free daily. Daily roll call also introduces an attendance chore.

   **Fix:** Use feature-level entitlement deduplication, retain unboosted commitment checks, and reject or preserve purchases whose benefit would be clipped. Choose one truthful catalog model. Prefer removing purchasable Double Shift and automatically accruing any retained free allowance. ([Catalog](../docs/world-redesign.md))

11. **Trust-dependent allocation can break sustainable hiring. [high]**

   **Failure:** Hire against allocation at 780/hour, then lose trust and fall to 480/hour. A commitment that passed yesterday can create a recurring deficit today. Counting expected cases makes this worse because lumpy receipts cannot guarantee payroll.

   The current SWAT dismissal path can refuse dismissal when severance is unaffordable. That makes a trust-driven cash squeeze particularly ugly. ([Dismissal check](../src/sim/roster.ts))

   **Fix:** Evaluate permanent commitments against guaranteed minimum allocation, unboosted coverage income, and training downtime. Exclude speculative case receipts. Prove a funded recovery route at every staffing tier, including affordable exits from optional payroll.

12. **Keeping a jacket does not prevent rehire exploits. [high]**

   **Failure:** Dismiss an expensive injured officer, avoid wages during recovery, then rehire after the condition expires. Or rehire from a preserved first-seen build and erase acquired strain, retirement state, qualifications, or negative traits while retaining only narrative memories.

   Current code blocks anyone who has already served from being hired again; dismissal deletes the active officer. `PersonnelState.builds` preserves first-seen builds, not a complete live alumni career. The redesign therefore removes an existing safeguard and needs a new lifecycle model. ([Personnel shape](../src/sim/types.ts), [hire safeguard](../src/sim/roster.ts))

   A blanket bond penalty toward everybody employed at dismissal also turns ordinary roster correction into collective punishment.

   **Fix:** Keep one canonical person record through employment transitions, including condition, wages, retirement, investigations, and career history. Define rehire terms and off-payroll recovery deliberately. Preserve equipment accounting. Apply relationship consequences only where a recorded relationship and cause justify them.

13. **Imprints risk becoming a trauma optimization loop. [high]**

   **Failure:** If repeated exposure can lock useful traits, players farm exposure. If it mainly locks harmful traits, replacing affected officers can beat aftercare. If a bonded partner is the cheapest treatment, the player repeatedly exposes that partner and can create cascading penalties.

   “None is dominant” is an assertion, not a demonstrated choice. A stressful event can already add stress; also reducing composure and locking another penalty may charge the same condition repeatedly, contrary to [PLAN.md](../PLAN.md).

   Duration is undefined. The current calendar uses **one real hour per game day**. “Five days” could mean five hours or five real days, a 24-fold difference. ([Calendar](../src/sim/calendar.ts))

   **Fix:** Define time units, stacking, recovery, and dismissal interactions first. Ensure basic care reliably prevents avoidable deterioration. Keep lasting character changes contextual rather than superior builds earned through repeated harm. Validate choices in actual roster situations.

14. **Romance becomes a staffing buff managed by an employer. [high]**

   **Failure:** Because romance grants a strong stress buffer and coordination benefit, players engineer compatible pairings and maximize shared shifts. The player need not click “force romance” to control its prerequisites.

   Mentor relationships begin with rank differences, but the design does not prohibit transitions into supervisory romance. Supporting, suppressing, or separating relationships becomes a mechanical employment decision. Punishing partners when one is injured can make avoiding attachment optimal.

   **Fix:** Remove romance-specific tactical advantages and protective actions. Keep professional trust mechanically sufficient. If romance remains, author autonomous consent and withdrawal, prohibit supervisory dependencies, and make declining or disabling romance mechanically neutral. ([Bond rules](../docs/world-redesign.md))

15. **Concealing a conflict is presented as a purchasable performance advantage. [high]**

   **Failure:** Keep quiet for better odds now; accept a possible 40% case-value reduction later. If disclosure probability is `p`, expected monetary loss is only `0.4p × case value`, plus unspecified friction. Once funding is abundant, concealment’s financial cost becomes nearly irrelevant.

   Automatic ties from previous arrests also encourage repeatedly stopping the same people to accumulate access and special options. Familiarity becomes something the department extracts from subjects.

   **Fix:** Disclosure should preserve legitimately useful knowledge while changing who handles custody and evidence. Do not make concealment a generic odds boost. Repeated contact should sometimes produce mistrust or recusal, with consequences tied to recorded facts rather than an arrest counter. ([Tie options](../docs/world-redesign.md))

16. **“Seeded hourly events” does not establish a coherent persistent world. [high]**

   **Failure:** Two patrol units contact the same free subject in the same hour; a paused call holds a suspect whom offline patrol subsequently arrests; a crew collapses while its warrant remains playable; a cloud save reintroduces an already-paid case.

   A seed containing district and hour also needs distinct draw identities. Reusing the same draw across units correlates their outcomes. Giving every newly assigned unit a full hourly trial invites moving units between districts near settlement boundaries.

   Beyond the offline cap, the draft never says whether crime, recruitment, cases, tails, relationships, and stress continue. Letting harm continue while coverage stops punishes absence; freezing everything conflicts with current uncapped recovery and calendar behavior.

   **Fix:** Specify authoritative subject reservations, eligible exposure intervals, unique event identities, transition ordering, and cap behavior per system. Use one settlement path and explicit cloud conflict resolution. The existing [economy settlement](../src/sim/economy.ts) is infrastructure to extend, not proof that these interactions are solved.

17. **The modular pattern hides the content bill. [high]**

   **Failure:** One hundred personas permit **4,950 pairs**. Sixteen deployed-roster officers already permit **120 pairs**. Four independently optional call hooks create up to **16 presence combinations**, before subject histories, bond kinds, imprints, outcomes, and timed beats.

   You need not author every pair individually. But generic atoms risk making everyone sound interchangeable; bespoke exceptions multiply testing and editorial work. “A call with no hooks still plays” proves fallback behavior, not that interacting hooks remain coherent.

   The existing pressure documentation explicitly says automated gates cannot judge tone, revealed knowledge, or dramatic coherence. ([Limits of existing gates](../docs/call-pressure.md))

   **Fix:** Prove one district, four officers, one crew, and a tightly bounded set of relationships first. Limit concurrent mechanically active bonds and hook precedence. Measure authoring and review hours per finished case before commissioning 100 jackets.

18. **Culture can leak through world assignment without ever setting a trait directly. [high]**

   **Failure:** Culture influences a name or hometown; hometown selects a district; district selects crew exposure; crew exposure determines criminal ties, violent scenes, and recurring dialogue. The direct culture-to-trait prohibition passes while the game still repeatedly associates particular identities with criminality.

   Likewise, making most calls crew-driven can recast victims, people in crisis, and ordinary residents as obstacles in an organized-crime progression ladder.

   **Fix:** Audit generated distributions across names, portraits, neighborhoods, civilian roles, crew membership, violence, and officer ties. Give communities visible lives and successful outcomes beyond police contact. Keep crisis and safeguarding calls independent of criminal progression. ([Jacket assumptions](../docs/world-redesign.md))

19. **Store compliance is not established by saying “no loot boxes.” [high]**

   **Failure:** A product ships with ambiguous ownership, clipped benefits, repeatability, restoration, or pricing disclosure. The policy concern is the actual transaction.

   Current primary sources checked **2026-10-24** establish these relevant boundaries:

   - Apple’s **3.1.1** covers digital unlocks, tipping, restoration of restorable purchases, non-expiring purchased currency, and disclosure for purchased randomized items. Its **3.1.2** subscription rules do not turn lifetime unlocks into subscriptions. Regional exceptions require their own treatment. ([Apple guidelines](https://developer.apple.com/app-store/review/guidelines/))
   - Google generally requires Play Billing for digital purchases, subject to applicable exceptions/programs, and requires accurate pricing plus disclosure of purchased randomized-item odds. ([Google Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en))
   - EU CPC principles address currencies purchased with real money and their subsequent spending. An ordinary earned-only resource is not automatically covered as purchased currency. Whether these boosts create a relevant indirect purchase needs assessment; a coin glyph is no exemption. ([CPC principles](https://commission.europa.eu/document/download/8af13e88-6540-436c-b137-9853e7fe866a_en?filename=Key+principles+on+in-game+virtual+currencies.pdf))
   - Paid randomized-item rules and gambling law are separate questions. Great Britain’s regulator emphasizes money or money’s worth; Belgium’s 2018 commission report reached broader conclusions for the examined paid loot boxes. Neither establishes that this draft’s patrol system is automatically illegal. ([UK regulator](https://www.gamblingcommission.gov.uk/news/article/loot-boxes-within-video-games), [Belgian report, translated copy](https://www.skadden.com/-/media/files/publications/2019/08/video-gaming-egaming-law-update/fn12_onderzoeksrapportlootboxenengelspublicatie.pdf))

   **Fix:** Classify each SKU, define restoration/refunds/revocation and bundle ownership, and obtain jurisdiction-specific review of paid access to randomized rewards. A disclosed four-hour boost is not automatically prohibited currency expiry; an unspent purchased credit expiring is a different product.

20. **The minute-to-minute loop is becoming administrative work. [medium]**

   **Failure:** Return, inspect five districts, restart shifts, check tails, inspect pending cases, resolve aftercare, handle relationship changes, rotate squads, claim Double Shift, then finally play a call.

   At crime 50, four independent NPC units have a **52.2% probability of no contact during the first hour**. The promised “first custody” onboarding cannot reliably follow naturally. Meanwhile, charging timers offer waiting without a decision.

   City absorbs the call board, Cases holds warrants, People owns squad condition, and HQ owns preparation resources. A single operation can require crossing four destinations. A map pin does not inherently make urgent work easier to find.

   **Fix:** Keep a persistent text dispatch list alongside the map and one return surface with a bounded set of meaningful decisions. Automate routine schedules and payments. Script the teaching contact explicitly. Validate 30-second returns and interrupted calls at phone size before replacing navigation. ([Lifecycle and tabs](../docs/world-redesign.md))

21. **The revenue claim does not fund the content promise. [medium]**

   **Failure:** A small payer population buys a cheap lifetime bundle while the team maintains 100 jackets, persistent cases, relationship branches, native integrations, and evolving saves.

   “Satisfied players spend 10–15” is neither conversion evidence nor revenue per install. Illustratively, **5% conversion × 10–15 payer spend = 0.50–0.75 gross per install**, before fees, taxes, refunds, acquisition, and support. That is arithmetic, not a forecast.

   **Fix:** Measure conversion and production cost on the bounded slice. Set the content budget from contribution margin and demonstrated production capacity. A finite catalog can be a good commercial choice; it cannot substitute for a business model.

**The single strongest alternative: a coverage-funded department with persistent authored case arcs.**

Keep automatic patrol coverage as the economic foundation. Districts track unresolved needs, safety, and trust; higher trouble creates demands on capacity without producing more money. Patrol supplies persistent evidence and community updates. A crew head becomes reachable through case facts and lawful prerequisites, never a random high-value drop.

SWAT takes deliberate operations from a stable dispatch list. Leads survive absence; live calls pause on interruption. Case funding is bounded and tied to completed work, including justified release or handover. Officers retain career facts, contextual aftercare, and a small number of meaningful professional relationships. Romance, if retained, carries no tactical premium.

Make scheduling and offline protection free. Sell a finite supporter/cosmetic catalog. Validate one district, four officers, and one complete case arc before expanding.

This preserves the draft’s valuable promise—people and places remember—while removing crime farming, suspect jackpots, paid relationship acceleration, and most recurring chores.

Verification record:

- Steelman stated: persistent city continuity and consequential officer history.
- All six challenges answered: failure scenarios, strongest alternative, arithmetic audit, assumption inversions, costs borne by players/represented communities/content staff, and hostile technical review.
- Findings concrete: 21 findings; 4 critical, 15 high, 2 medium.
- Overall verdict: reject.
- Self-review: independent review of the supplied draft.
- Scope: source inspection and arithmetic completed; no implementation tests, rendered-artboard review, or playtests performed.

| Major system | Verdict | Required change or evidence |
|---|---|---|
| World/crime | **reject** | Remove profitable neglect and automatic arrest-driven safety. |
| Patrol earnings | **reject** | Retain coverage grants; remove person-priced case income and rebuild the budget. |
| Proactive shift | **reject** | Eliminate online/offline advantage and resolve assignment, readiness, and ladder bypasses. |
| Officer persistence | **accept with controls** | Canonical lifetime records, explicit employment transitions, and rehire accounting. |
| Imprints | **needs validation** | Demonstrate readable, non-exploitable aftercare without stacked punishment. |
| Bonds/romance | **reject** | Remove romantic optimization and employer-controlled tactical benefits. |
| Ties | **accept with controls** | Preserve useful knowledge through disclosure; remove concealment’s generic advantage. |
| IA/tabs | **needs validation** | Prove short returns and complete call preparation on the actual phone surface. |
| Monetization | **reject** | Reconcile product promises, boost economics, finite ownership, and paid world progression. |

## Sol: plan and challenge

### Recommendation

**Revise the draft before implementation. Keep the persistent city and officers, but make the first playable redesign prove one district, one crew, one memorable squad, and one complete return journey.**

The strongest idea is that tactical decisions leave a history the player recognizes later. The biggest risk is spending the budget on a large relationship and crime simulation whose effects arrive as unreadable reports, expired opportunities, and repetitive character text.

Four issues need resolving first:

- **Persistent attachment conflicts with the current save policy.** [PLAN.md currently rejects older content versions](../PLAN.md).
- **Charging subjects remains financially preferable to releasing them.** Reducing payment after force does not remove the arrest incentive.
- **The earnings percentages do not reconcile with the proposed rates.**
- **Paid funding can indirectly improve tactical outcomes through recruitment, equipment, and training.** The odds promise needs a stricter product boundary.

The following is a proposed design and tuning model, not a validated forecast.

### 1. Lifecycle: the journeys are named, but several contracts are missing

**Recommendation: move lifecycle work into the first delivery slice.** Save continuity, interruption behavior, accessibility, and the first return shape the entire game.

## First session and return journeys

| Journey | Gap in the draft | What the surface should do |
|---|---|---|
| Store listing → first open | No explicit promise connecting acquisition to play | Show the real blueprint, persistent officers, and idle department. Explain the mature themes and offline model before download. |
| FTUE, first 90 seconds | Starting a call is specified; teaching a meaningful decision is not | Present one understandable situation, highlight its relevant room, and show how an officer or item enables an approach. Default the decision timer to Off during onboarding. |
| First five minutes | Four officers, patrol, custody, case values, and naming compete for attention | Introduce two officers through actions. Let the other two become familiar over subsequent calls. Finish with one staffing decision and one visible future goal. |
| First patrol result | The normal contact rate cannot reliably produce custody during onboarding | Include a clearly established handover case already nearing completion. Demonstrate the real system without secretly accelerating its clocks. |
| First voluntary exit | No explicit closure | Show what will progress, what is paused, and approximately when something useful will be ready. Let the player leave with a complete session. |
| D1 return | The shift report has categories, but no attention budget | Show at most three meaningful developments, already credited funding, and one suggested action. A jacket change should be visible without opening several profiles. |
| D7 return | A crew ladder alone may feel like repeating calls | Pay off the first investigation, demonstrate a remembered incident, and reveal one new management decision. The first major story consequence should occur before adding more districts. |
| D30 return | Successor crews risk becoming an endless replacement treadmill | Close a chapter visibly. Preserve improvements to the district, show how residents and officers changed, and let the player choose the next focus. |
| Lapsed return | “Nothing lost” conflicts with expiring tails and advancing careers | Preserve important leads and pending character decisions. Summarize the current squad, current investigation, and one safe restart action. |
| Everything is unavailable | Recovery can still end a session involuntarily | Offer department work, a suitable reserve assignment, or a safe handover. Show recovery estimates without a purchase solicitation. |
| Campaign completion | No satisfying stopping point | Provide a career summary, officer histories, and an optional new city. Preserve purchases and archives. Completion should feel legitimate. |

Three additional jobs belong in the brief:

1. **Help me remember enough to make a decision without studying the whole campaign.**
2. **Help me understand and recover from a result I regret.**
3. **Let me finish a satisfying session without feeling that leaving endangers someone.**

## Mobile platform and service surfaces

| Journey or surface | Recommendation |
|---|---|
| Notifications | Ask after the player schedules something they want to hear about, such as training completion. Offer separate readiness, investigation, and digest categories. Default to one combined notification per day, with quiet hours. No purchase or officer-distress notifications. |
| Permission declined | Continue normally. Keep controls in Settings; avoid repeated permission persuasion. |
| Widgets | Add later. Show squad readiness, the next completion, and one investigation shortcut, with a freshness timestamp. Widgets should never be required to collect funding. |
| iOS Live Activities | Defer. A paused branching call has little useful background progress to display. An explicitly followed timed activity could justify one later. |
| Android ongoing notifications / Live Updates | Do not promise a permanent equivalent for every call. Android specifies ongoing, user-initiated, time-sensitive activities; ordinary idle progress belongs in a widget or completion notification. [Android guidance](https://developer.android.com/develop/ui/views/notifications/live-update) |
| Calls, app switching, screen lock, process death | Save every committed decision. Pause decision pressure when backgrounded by default. Resume at the same stage with the last relevant facts visible. This changes PLAN.md’s proposed elapsed-away pressure behavior. |
| Back navigation | Leaving a saved call should return to management and expose Resume. Reserve consequence confirmation for an explicit handover or abandonment action. |
| Accessibility | Support VoiceOver and TalkBack throughout. Provide a complete text representation of blueprint facts and actions, scalable text, labeled condition states, reduced motion, optional haptics, and controls that work without color or sound. Reading speed must not determine outcomes. |
| Guest → account | Start locally without authentication. Offer free account linking after demonstrated value. Explain backup status and what happens after reinstalling. |
| Cloud save and device changes | Use one portable campaign format and a managed cross-platform save service. Show the last successful backup. Preserve both copies during conflicts and explain differences using progress and dates. |
| Data export and deletion | Separate campaign reset, local-data deletion, cloud/account deletion, and purchase restoration. Prevent a deleted campaign from silently returning through sync. Explain any transaction records retained. |
| Parental controls | Keep the mature audience positioning. Respect platform purchase restrictions and approval flows. Provide a purchase-disable setting. Content filters do not create a child-safe edition. |
| Store review prompt | Use native prompts after several sessions at a neutral management moment. Never reward reviews or ask whether the player likes the game first. [Google explicitly prohibits that preliminary question](https://developer.android.com/guide/playcore/in-app-review); [Apple recommends requests after completed activity](https://developer.apple.com/app-store/ratings-and-reviews/). |
| Purchase interruption | Cover pending approval, cancellation, verification failure, offline ownership, restore, and refunds. An interrupted purchase must not require purchasing again. |
| Update and content version | Preserve campaign history through updates. Version-pin an in-flight call until completion; migrate persistent campaign data with a recoverable backup. Explain meaningful rule changes once. |
| Support and technical failure | Provide an always-available support route and a voluntary diagnostic export. Preserve the campaign after a crash, bad download, or incompatible update. |

Two specific corrections:

- **iCloud key-value storage is too narrow to serve as the complete save strategy.** Apple documents a 1 MB total allowance, and it does not solve Android portability. [Apple documentation](https://developer.apple.com/library/archive/documentation/General/Conceptual/iCloudDesignGuide/Chapters/DesigningForKey-ValueDataIniCloud.html)
- Account creation brings deletion journeys with it. Apple requires in-app initiation; Google requires an in-app route and an external web resource. [Apple](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion), [Google](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)

### 2. Information architecture: keep five tabs, change two

**Recommendation: City · Operations · Team · HQ · Store.**

The draft’s main navigation problem is that **Cases hides immediate play**, while **People does not clearly identify roster management**.

| Tab | Owns | Primary action |
|---|---|---|
| **City** | District conditions, patrol coverage, funding summary, return report | Decide where the department needs attention |
| **Operations** | Available calls, investigations, warrants, completed-operation archive | Play or advance an operation |
| **Team** | Squads, SWAT, Patrol, Command, jackets, relationships, alumni | Prepare and develop people |
| **HQ** | Facilities, training capacity, policies, equipment and loadout management | Improve department capability |
| **Store** | Real-money catalog, previews, ownership, restore | Buy a clearly described lasting benefit |

Within Operations, use **Now, Investigations, Archive**. A ready warrant should appear in Now as well as on its investigation.

Keep these ownership rules:

- The City map links to operations; a readable list remains available.
- Officer selection, condition, and history always resolve to the same Team profile.
- Gear belongs to HQ and preparation. Avoid mixing ordinary equipment procurement with real-money shopping.
- Each tab preserves its position. Cross-links return the player to the originating task.
- An active call becomes a focused mode with one persistent Resume entry in management.
- Navigation badges represent actionable changes. Store gets no fabricated notification badge.

The shipped-game lesson is separation of jobs. **AFK Journey** combines exploration, formation management, and idle progression; **CookieRun: Kingdom** combines a productive home with character teams and battles. Their loops support distinct world, roster, and action destinations. They do not establish that copying a particular tab count improves retention. [AFK Journey](https://apps.apple.com/us/app/afk-journey/id1628970855), [CookieRun: Kingdom](https://apps.apple.com/us/app/cookierun-kingdom/id1509450845)

Keeping Store also respects the existing decision to make purchases discoverable. Improve its usefulness through good previews and ownership handling, rather than commercial interruptions.

### 3. Earnings: fund the department through coverage, reward active casework

**Recommendation: make allocation and patrol sustain the department; make missions provide an increasing growth bonus. Remove the financial incentive to maintain high crime.**

## What breaks in the draft

| Finding | Consequence |
|---|---|
| At ten entry-grade patrol staff, grants already produce 2,100/h against 600/h allocation | Allocation is only 22% of these two sources, before adding cases or calls. The proposed 30% allocation share does not reconcile. |
| The formula says `210 × grade` | Existing grades pay **210, 250, and 300/h**, rather than doubling and tripling. Preserve the explicit table. [Current definitions](../src/sim/patrol.ts) |
| Contact frequency increases with crime | The claim that neglect cannot be farmed is unproven. Higher income is certain; harder calls may be avoided. |
| Case values pay per charged person | Multi-person warrants and repeated arrests can dominate the economy and its incentives. |
| Records Clerk halves case clocks | With unlimited processing capacity, it mostly advances receipts. With constrained capacity, it can become a major paid throughput advantage. Neither behavior is specified. |

## Proposed tuning

Use a free, service-earned **funding scale** of **1 / 2 / 3** at the three progression stages below. Funding cannot purchase this scale.

### Allocation and patrol

| Input | Day 1 | Week 2 | Month 2 |
|---|---:|---:|---:|
| Districts | 1 | 3 | 5 |
| Base city allocation/h | 600 | 1,800 | 3,000 |
| Patrol staff | 4 | 10 | 12 |
| Representative grade | 1 | 2 | 3 |
| Grant per patrol staff/h | 210 | 250 | 300 |
| Funding scale | 1 | 2 | 3 |

Make allocation reward stability:

`allocation = base allocation × clamp(1 + (50 − city crime) / 100, 0.8, 1.25)`

Use a fixed weighting of unlocked districts for city crime, so coverage assignments cannot manipulate the denominator.

**Remove crime scaling from paid contact frequency.** Use **0.15 funded contacts per patrol unit-hour**. Crime can affect escalation pressure and presentation, but it should not increase the funding-tier distribution or funded contact rate. Quiet districts continue producing prevention, follow-up, and service work.

### Case values and call fees

Pay one case award per **unique investigation**, regardless of how many people are detained.

| Complexity tier | Base case award | Review clock | Base call fee |
|---|---:|---:|---:|
| 1 | 100 | 1 hour | 800 |
| 2 | 600 | 3 hours | 1,600 |
| 3 | 2,400 | 6 hours | 3,200 |
| 4 | 8,000 | 12 hours | 6,400 |

Multiply awards and fees by the funding scale.

A lawful release, cleared allegation, accepted-care resolution, or justified charge can complete eligible casework. **Charging someone must not be the condition for getting paid.**

The call fee pays completed service, including a responsible handover. Supplies can be reimbursed at cost, without creating profit from using more equipment. Harm remains visible through condition, trust, oversight, and consequences.

Reopening the same investigation does not pay its award again.

## Proactive shifts

Keep proactive work as a bounded commitment that produces leads and shared history.

| Rule | Proposed tuning |
|---|---|
| Availability | Introduce after the first return |
| Duration | 2, 4, or 8 real hours; maximum 8 hours per squad per rolling day |
| Deployment grant | `200 × funding scale` per deployed squad-hour |
| Contacts | Two equivalent units: 0.30/hour |
| Tier weights | Retain 50% / 35% / 13% / 2% for initial testing |
| Tier 3–4 encounters | Produce persistent leads requiring an active operation |
| Stress | Retain +2/hour initially; show projected end condition and stop before an officer crosses the deployment restriction |
| Offline escalation | Preserve a lead; never resolve an absent player’s tactical crisis |
| Paid interaction | No extra proactive capacity, reduced stress, or stronger contact weights |

The cash supplements patrol; the important additional value is discovering investigations and developing squad history.

## Hourly income by source

**All figures below are proposed funding units, not USD.**

Assumptions:

- Crime 50 and allocation factor 1.
- NPC tier weights remain 85% / 14% / 1%; tier 3 produces sightings.
- Eighty percent of opened casework ultimately qualifies for an award after review. This is a modeling assumption, not a conviction probability.
- Three calls per day on average. Day 1 uses tier 1; week 2 uses nineteen tier 2 and two tier 3 calls per week; month 2 uses nineteen tier 3 and two tier 4 calls.
- Proactive deployment is zero, four, and eight hours/day respectively.
- Event income is normalized over time. It will arrive unevenly, and review clocks delay initial receipts.

| Income or cost per hour | Day 1 | Week 2 | Month 2 |
|---|---:|---:|---:|
| City allocation | 600 | 1,800 | 3,000 |
| NPC patrol grant | 840 | 2,500 | 3,600 |
| NPC-origin case awards | 81 | 406 | 730 |
| Proactive grant and low-tier casework | 0 | 87 | 262 |
| Call fees, including warrant calls | 100 | 438 | 1,314 |
| Mission-origin case awards | 10 | 154 | 880 |
| **Total gross** | **1,631** | **5,385** | **9,787** |
| Recurring costs | −820 | −2,100 | −3,824 |
| **Expected net** | **811** | **3,285** | **5,963** |

*Figures are independently rounded.*

The recurring-cost budgets assume:

| Cost/h | Day 1 | Week 2 | Month 2 |
|---|---:|---:|---:|
| Patrol wages and operations | 240 | 730 | 1,104 |
| SWAT payroll | 380 | 880 | 1,920 |
| Fixed operations and routine supplies | 200 | 300 | 500 |
| Command staff | 0 | 190 | 300 |

Capital purchases and training purchases are additional spending.

This produces the intended progression:

- **Day 1:** the department remains funded without calls; each 800-unit fee makes an immediate purchase feel reachable.
- **Week 2:** patrol remains the financial foundation. Missions add about 592/h averaged across the proposed engagement.
- **Month 2:** missions contribute about 37% of resulting net income. They matter substantially without making unattended patrol worthless.
- Removing proactive shifts and missions still leaves positive net income at every modeled stage.

Retain the current six-hour marginal payback for a 900-unit entry-grade patrol hire. Use staffing authorization and service requirements to bound growth. Larger purchases should consume progressively longer periods of net income, rather than introducing more currencies.

### Keep funding out of odds

Treat this as a literal promise for paid funding:

- Funding, purchase ownership, and boosts never enter call draws, pressure, eligibility, or resolution.
- Tactical capability progression comes from free service milestones and earned experience.
- Free progression provides the required functional equipment and sustainable resupply.
- Premium funding accelerates patrol and HQ economic development.

**The existing cash → better personnel/gear/training → better readiness route needs changing wherever paid funding can accelerate it.** Otherwise the defensible promise is only “no direct odds modifier.”

Before accepting these numbers, simulate low and high crime, maximum staffing, prolonged absence, maximum paid ownership, and intensive call play. Three calls/day is an engagement assumption, not a throughput ceiling.

### 4. Officers: richness comes from recurrence and consequence

**Recommendation: author identity; generate casting and timing; record consequences as facts. Keep the relationship graph sparse.**

**Wildermyth** is the strongest structural reference: generated histories and relationships acquire lasting changes through authored encounters, then persist into a legacy. Its developer documentation explicitly connects events to relationship changes and recorded history. [Developer description](https://wildermyth.itch.io/wildermyth), [event documentation](https://wildermyth.com/wiki/Outcomes)

**Wylde Flowers** demonstrates the value of recognizable routines, distinct voices, and relationships beyond the main plot. It also demonstrates the production cost of extensive bespoke writing: Apple reports a script exceeding 214,000 words. Use it as a quality reference while budgeting a much smaller system. [Apple’s feature](https://apps.apple.com/us/story/id1647057689)

## Minimum content that can feel rich

| System | Proposed launch minimum | Cost control |
|---|---|---|
| Jackets | One compact authored package for every existing persona: pressure line, light contradiction, three voice markers, two later reveals, structured family/openness/tie facts | Reveal progressively. Keep individual bio surfaces within their existing budgets. |
| Memories | Seven fact categories, with four short presentation variants each | Store what happened; select wording from verified facts. Never generate new history to make a callback interesting. |
| Character arcs | Six reusable arc packs with six beats each | Cast by compatible events and current state. Give starting squadmates different arc shapes. |
| Imprints | Eight condition packs, including positive adaptation | Each pack supplies cause, telegraph, support fork, persistence, and recovery behavior. |
| Bonds | Twelve reusable scenes covering formation, development, strain, and repair | Maintain roughly two significant active relationships per officer. Preserve older bonds in history. |
| Romance | Eight scenes spanning mutual interest, acknowledgment, boundaries, ordinary life, and separation | Use eligibility and current facts to cast scenes. Avoid bespoke writing for every possible pair. |
| Civilian ties | Twelve scenes covering established acquaintances, previous contact, disclosure, recusal, and follow-up | A tie has a recorded origin and a limited set of compatible situations. |
| Retirement and alumni | A shared exit structure with personal facts and later acknowledgment | Assemble the history from actual service; add a small amount of authored framing. |

I would initially budget **roughly 25,000–35,000 authored words**, excluding calls and localization. That is a production estimate. Repetition testing should determine whether the reusable scenes sustain the intended campaign length.

## Generator versus authoring

| Authored | Generated or selected by rules |
|---|---|
| Identity facts, contradictions, boundaries, voice | Which eligible event appears next |
| Scene premises, choices, consequences | Casting compatible officers into scene roles |
| Relationship eligibility and consent | References to recorded people, places, and incidents |
| Trait causes and recovery routes | Timing, cooldowns, and repetition suppression |
| Exceptions involving sensitive identity or workplace power | Dates derived from the campaign calendar |

Avoid runtime freeform prose generation. A deterministic scene selector and carefully written slots provide stronger continuity and manageable QA.

Several design changes matter more than adding content:

- **Bonds should have readable states.** A visible −100 to +100 score invites optimization and makes relationships feel numerical.
- **Romance must have mechanical parity with close friendship.** The draft’s stronger buffer and protective options make dating an optimal roster strategy.
- Officers initiate and consent. The player manages workplace boundaries and assignments.
- Family ties, misconduct, breakups, and changes in orientation must never appear merely because a generator needs drama.
- Safe restraint cannot advance a negative character arc.
- Every lasting change requires a named cause, a telegraph the player actually saw, and a meaningful response opportunity.
- A callback is presentation. A tie that opens an action is a separately authored mechanical hook with its own validation.

### Resolve the calendar before writing duration-dependent stories

The [current calendar advances one game day per real hour, including absence](../src/sim/calendar.ts). Consequently, a five-game-day imprint lasts five real hours, while a month-long absence advances years of fictional life.

Keep real durations explicit in management UI. Require acknowledgment before completing important retirement or lasting-trait transitions. Career development should follow eligible service and played events sufficiently closely that the player witnesses the character’s arc.

### 5. Monetization: sell lasting benefits with a bounded advantage

**Recommendation: launch ad-free with two lifetime benefits, a finite cosmetic range, and one clear bundle. Remove paid temporary boosts and paid case processing.**

The draft’s ×2 patrol grant changes the existing starting net from **620/h to 1,460/h** before case income. At ×3 it becomes **2,300/h**. Those are large changes to the pace of the entire department.

A **+25% patrol-grant entitlement** adds approximately **26%, 19%, and 15%** to net income in the proposed stage models. That remains valuable while leaving the free pace credible.

## Proposed catalog

*Proposed U.S. list prices; localized prices must come from billing.*

| Product | USD | Benefit |
|---|---:|---|
| **Department Charter** | **$6.99** | Permanent +25% NPC patrol service grant |
| **Night Watch Office** | **$4.99** | Funding accrual window extends from 72 hours to seven days; matching recurring costs use the same window |
| **Founder’s Bundle** | **$11.99** | Both lifetime benefits plus one precinct theme |
| Precinct themes, three total | $2.99 each | Substantial environment and UI styling; previewable |
| Squad patch collection | $1.99 | A fixed, complete cosmetic set |
| Squad coffee | $1.99 once | Supporter decoration and acknowledgment |

Buying the bundle, remaining themes, patches, and tip totals **$21.95**. Previously owned items need an upgrade path that avoids paying twice for the same benefits.

Remove:

- Records Clerk.
- Repeat-purchase Double Shift.
- Paid proactive queues.
- The free daily boost claim, which adds an attendance task to an automatically credited economy.

## Free entitlement

The free game includes every district, call, officer, relationship, ending, content update, accessibility feature, backup function, and recovery route. Give everyone **72 hours of offline funding**, basic automation, and normal training queues.

The paid offer extends convenience and funds optional economic development. It cannot repair an intentionally unpleasant free experience.

Offer the bundle after the player has completed several sessions. Show its actual effect on their department, including the added funding/hour. Keep previews available without purchase pressure.

## Conversion assumptions and business implications

Use install-based cohorts. The draft’s “10–15 total from a satisfied player” is closer to payer spending than revenue per player.

| Proposed 90-day scenario | Install → payer | Average spend per payer | Gross IAP revenue per install |
|---|---:|---:|---:|
| Conservative | 2% | $10 | $0.20 |
| Planning case | 4% | $12 | $0.48 |
| Strong | 6% | $14 | $0.84 |

These are **planning assumptions**, not observed conversion rates.

At the planning case, **100,000 installs generate $48,000 gross IAP revenue in 90 days**, before fees, refunds, taxes, acquisition, and operating costs. That supports a disciplined product and organic acquisition strategy. It does not establish a sustainable large content operation.

## Challenge to “no ads”

There is a reasonable commercial argument for rewarded ads: they monetize players who will never purchase.

AppsFlyer’s 2026 dataset reports substantial use of advertising and hybrid models in casual games, while midcore remains predominantly IAP-only. That demonstrates multiple viable patterns; it does not establish that ads improve this game’s lifetime value. [AppsFlyer report](https://www.appsflyer.com/resources/reports/app-marketing-monetization-report/)

An illustrative calculation:

`25% participation × 10 active days × 2 impressions/day × $15 eCPM ÷ 1,000 = $0.075 per install`

Those inputs are assumptions, not benchmark claims. At $12 per payer, an additional **0.625 percentage points of payer conversion** produces the same gross revenue per install.

**Keep launch ad-free.** The likely trade involves modest incremental ad revenue against consent complexity, SDK maintenance, possible purchase substitution, and interruption of the game’s tone. Reconsider only using measured incremental lifetime value, including retention and IAP effects.

The ethical line is straightforward: never sell relief from distress, better relationships, favorable results, recovery, or access to a viable squad. Do not target offers using losses, officer condition, or inferred vulnerability.

### 6. Top ten changes, ranked

| Rank | Change | Why it comes first |
|---:|---|---|
| **1** | Replace per-person charging rewards with unique, lawfully resolved casework awards | Removes the central incentive conflict and bounds warrant payouts |
| **2** | Put save continuity, interruption recovery, and version handling in the first slice | Persistent attachment depends on trust that the campaign will survive |
| **3** | Prototype one complete district chapter and its first return | Tests whether the core promise is enjoyable before expanding the simulation |
| **4** | Remove higher financial returns from high crime | Makes district improvement economically coherent |
| **5** | Separate premium funding from tactical capability progression | Makes the odds promise defensible |
| **6** | Change navigation to City, Operations, Team, HQ, Store | Makes immediate play and roster management discoverable |
| **7** | Put a witnessed officer memory and later callback in the first chapter | Proves the differentiating feature early |
| **8** | Make relationship states sparse and give friendship parity with romance | Controls authoring cost and avoids an optimal dating strategy |
| **9** | Replace ×2 funding, paid processing, and consumable boosts with the smaller lifetime catalog | Preserves free pacing and simplifies value communication |
| **10** | Preserve important leads, explicitly govern career time, and defer Live Activities | Removes return pressure while concentrating effort on consequential surfaces |

**Review status:** The requested documents were read, with monetization treated as historical where marked superseded. Economy arithmetic was calculated; campaign simulations, device journeys, and player comprehension were not tested. The officer proposal follows the officer-story skill’s design constraints, but no player strings were authored and no content gates were run. No files were edited.

## The economy model

```python
"""Revised economy after the astra and sol challenges. Stationary hourly averages; a design model, not the sim."""
GRADE = {1: (210, 45, 15), 2: (250, 55, 18), 3: (300, 70, 22)}       # src/sim/patrol.ts
AWARD = {1: 100, 2: 600, 3: 2400, 4: 8000}                            # per unique investigation, x funding scale
FEE = {1: 800, 2: 1600, 3: 3200, 4: 6400}                             # per resolved call, x funding scale
QUALIFY = 0.8                                                          # opened casework that reaches a lawful resolution


def alloc_factor(crime):
    return max(0.8, min(1.25, 1 + (50 - crime) / 100))


def model(name, base_alloc, crime, units, grade, scale, pro_h, calls_wk, costs, charter=0.0, show=True):
    g = GRADE[grade][0]
    alloc = base_alloc * alloc_factor(crime)
    grant = units * g * (1 + charter)
    # NPC: 0.15 contacts/unit-h flat; tiers 85/14/1, tier 3 is a sighting only
    npc_cases = units * 0.15 * QUALIFY * (0.85 * AWARD[1] + 0.14 * AWARD[2]) * scale
    # Proactive: 200 x scale per squad-hour grant, 0.3 contacts/h at 50/35 for tiers 1-2 (13/2 are leads)
    pro = (pro_h / 24) * (200 * scale + 0.3 * QUALIFY * (0.50 * AWARD[1] + 0.35 * AWARD[2]) * scale)
    leads_day = pro_h * 0.3 * 0.15
    # Calls: mix per week (count, tier); fee plus that call's case award
    calls = sum(n * (FEE[t] + AWARD[t] * QUALIFY) * scale for n, t in calls_wk) / (7 * 24)
    gross = alloc + grant + npc_cases + pro + calls
    net = gross - costs
    missions = pro + calls
    if show:
        print(f"{name:10s} alloc {alloc:6,.0f} grant {grant:6,.0f} npc {npc_cases:5,.0f} proactive {pro:5,.0f} "
              f"calls {calls:6,.0f} | gross {gross:6,.0f} costs {costs:6,.0f} net {net:6,.0f} | "
              f"missions {100 * missions / net:4.0f}% of net, leads/day {leads_day:.2f}")
    return net


stages = [
    ('Day 1', 600, 50, 4, 1, 1, 0, [(21, 1)], 820),
    ('Week 2', 1800, 50, 10, 2, 2, 4, [(19, 2), (2, 3)], 2100),
    ('Month 2', 3000, 50, 12, 3, 3, 8, [(19, 3), (2, 4)], 3824),
]
print('Sol tuning, crime 50:')
for s in stages:
    model(*s)

print('\nNo calls and no proactive (idle only):')
for n, b, c, u, gr, sc, ph, cw, co in stages:
    model(n, b, c, u, gr, sc, 0, [], co)

print('\nCrime sensitivity, Week 2 (income should fall as crime rises):')
for c in (25, 50, 75, 100):
    net = model('Week 2', 1800, c, 10, 2, 2, 4, [(19, 2), (2, 3)], 2100, show=False)
    print(f"  crime {c:3d}: net {net:6,.0f}")

print('\nDepartment Charter +25% patrol grant, effect on net:')
for n, b, c, u, gr, sc, ph, cw, co in stages:
    base = model(n, b, c, u, gr, sc, ph, cw, co, show=False)
    paid = model(n, b, c, u, gr, sc, ph, cw, co, charter=0.25, show=False)
    print(f"  {n:8s} {base:6,.0f} -> {paid:6,.0f}  (+{100 * (paid - base) / base:.0f}%)")
```
