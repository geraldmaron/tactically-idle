# Patrol workforce and Store redesign

Status: revised design, 2026-10-22. Requested by the owner during the blue-hour overhaul.
This replaces the paid-detail tapping plan and the earlier proposal to give SWAT patrol duties
hourly story beats. It is a design specification, not a claim that the running preview implements it.
Implementation work and delivery order live in [backlog.md](backlog.md).

## Decisions and recommendation

The owner requests removal of tapping, a broader department roster with NPCs generating patrol
revenue, appropriate costs, income boosts and possible leveling, and a prominent Store destination.
The owner clarified that SWAT officers are available between calls, not free of financial cost:
keep SWAT signing costs and wages. Call writing and branching outcomes remain outside this redesign.

Recommendation: make a separately staffed Patrol division the department's idle business. Keep SWAT
as the team the player prepares and commands. Remove routine revenue patrol from SWAT duties.
Use the blue-hour visual system already being developed, replacing the work control with a living
patrol scene, a readable net funding rate, and the next useful management action.

The player loop becomes: return to credited funding, inspect staffing and readiness, hire or improve
patrol capacity, prepare SWAT, play a call, then invest. There is no repeated input or collection tax.

## What exists and what changes

Inspected in this worktree: `src/sim/economy.ts` currently pays a $600/hour allocation and $150/hour
for each available SWAT officer on patrol, then deducts officer wages, enabled Command Staff salaries,
$120/hour facilities and $80/hour supplies. Income and recurring costs share a 24-hour accrual cap.
The initial net is $620/hour. SWAT duty also sets stress recovery: patrol 1/hour, standby 3/hour,
rest 6/hour. The Watch Commander changes tired squads' duties. Certified instructor details are
separate timed assignments. Existing save version 17 rejects incompatible versions rather than migrating.

| System | Revised contract |
| --- | --- |
| Paid details | Remove the control, burst tally, tap command, strain capacity and tap-specific multiplier state. No replacement clicker or claim button. |
| Patrol income | Earned by distinct employed patrol personnel. A SWAT record cannot also count as patrol headcount. |
| SWAT duties | Standby and rest remain; calls, courses and instructor details retain their existing assignment rules. Routine patrol and its income are retired. |
| SWAT finances | Signing costs, wages, training and equipment remain. Deploying SWAT no longer removes patrol funding. |
| Watch Commander | Retain recovery automation and opt-outs; return recovered squads to standby. Remove remembered patrol-duty targets. Do not invent a second manager for the same job. |
| Calls | Keep authored prose, branching outcomes and tactical personnel requirements. NPC patrol does not modify call draws, pressure or odds directly. |
| Finance and saves | Extend the existing settlement, ledger, projections, shift report and campaign system. No second balance or independent offline clock. |

Keeping SWAT patrol would preserve one duty tradeoff, but it leaves two workforces doing the same
income job and financially penalizes sending the interesting characters to a call. An optional SWAT
patrol income bonus would preserve that problem. Retiring it is the recommended first-release boundary.
Instructor details remain a deliberate, timed specialist commitment rather than automatic patrol income.

## The broader roster

Use a persistent Team destination with SWAT, Patrol and Command sections. SWAT retains its full character
profiles. Patrol has named, illustrated staff with an identity, service grade, output, payroll and current
status. Start with one readable patrol role; additional specialist roles require a mechanical difference,
not a rarity color. NPCs do not enter tactical squads, take tactical equipment, or receive call choices.

Players hire, fund training and expand authorized positions. Shift scheduling is automatic. The rate is
average funded coverage from a staffed position, not a claim that one person works continuously all day.
There is no individual route drawing, shift timer to restart, fatigue rotation puzzle or routine injury lottery.
Each profile can be inspected, but a large roster remains scannable through compact cards and a division summary.

A patrol record needs its own ID, profile reference, grade, eligible service time, employment state and
any training completion time. It must not masquerade as a partially populated SWAT Officer record.
Reuse portrait components, currency formatting and recruitment/confirmation surfaces where their contracts fit.
Authoring names or biographies later follows the existing officer-writing skills.

Staffing capacity is a hard ceiling per department level. Funding can fill authorized positions and buy
a facility within that ceiling; it cannot buy past it. Initial staffing, capacity and expansion prices
are tunable. The slice starts with a staffed division and at least one reachable hire or upgrade, so the
first session exposes a decision rather than an empty business waiting for its first paycheck.

Proposed simulation defaults: four employed staff and a ceiling of six positions at department level 1;
eight positions at level 3; twelve at level 6. Facility purchases activate positions within those ceilings.
These bounded inputs allow early hiring without permitting idle cash to expand headcount indefinitely.
Do not present the same named person as both a patrol employee and a SWAT officer.

## Funding and costs

Patrol produces service funding for coverage, not rewards for arrests, tickets, force or harm.
The authoritative model is:

`net/hour = allocation + development income + patrol gross × active patrol boost − SWAT payroll − patrol payroll − patrol operating costs − Command Staff − fixed costs`

Boosts affect only eligible patrol gross. They do not multiply the allocation, existing development income,
call rewards, instructor fees or costs. Finance separates these rows and shows both gross and net.

A proposed starting calibration preserves the inspected $620/hour baseline:

| Line | Proposed amount per hour |
| --- | ---: |
| Allocation | +$600 |
| Four patrol staff at $210 gross each | +$840 |
| Patrol payroll at $45 each | −$180 |
| Patrol operations at $15 each | −$60 |
| Existing initial SWAT payroll | −$380 |
| Existing facilities and supplies | −$200 |
| Net, with no Command Staff enabled | **+$620** |

These are simulation inputs, not approved balance or claims about real departmental finances.
They preserve the starting net while making the patrol workforce's expenses visible. Removing the old
$600/hour SWAT patrol line is essential: keeping both would silently add $600/hour.

Hiring charges a one-time onboarding cost plus recurring wages and operations. Every quote shows cost now,
permanent hourly cost, unboosted net change, and estimated payback. For example, a provisional $900 hire
adding $150/hour unboosted net has a six-hour payback while productive. This example is not a final price.
The same projection powers the button, affordability check and purchase receipt.

Permanent commitments are checked against sustainable income without temporary or revocable paid boosts.
Costs during training are included; initial patrol training has one slot, so the player cannot accidentally
stop the whole division to train everyone at once. Promotions and new capacity preview their recurring
costs. Dismissal has a visible severance quote and preserves identity/history against hire-dismiss exploits.

Retain a positive recovery route with zero optional staff and no paid boosts. No mandatory purchase, ad,
call victory or timer restart is needed to resume funding. Test this at later payroll/capacity tiers too;
a positive starting budget alone does not prove the recovery route.

## Progression and boosts

Patrol service experience advances through eligible funded work hours, using the same capped accrual
window as income. It does not scale with cash generated, cash held, boosts, app-open time or receipt animations.
Training and inactive intervals do not generate service experience. Accrual cannot bank an unlimited chain
of instant promotions: the next grade requires its service threshold, a quoted training commitment and
its department-level requirement. Completing training changes the rate at its actual completion time.

For the first release, retain call-earned department service and level. Patrol grades improve patrol
output; department levels authorize additional staffing and facilities. Do not also award department XP
for funding, because a paid multiplier would then purchase capacity and progression twice. This keeps
one global progression curve. Whether long-term idle players need an additional service-based route to
department levels is a playtest question, not an extra unbalanced loop in the initial implementation.

Separate permanent progression improvements from temporary funding boosts. The boost rule uses a bounded,
explicit additive bonus over eligible patrol gross; repeated grants of the same timed boost extend its
remaining duration rather than stacking its rate. A proposed initial aggregate boost ceiling is ×2,
subject to campaign simulation. This replaces the old tap system's ×7 model. Grade improvements remain
part of base gross and must also be tested at the maximum grade and capacity.

A displayed “×1.5 patrol funding” does not mean ×1.5 department net. In the proposed starting budget it
adds $420/hour, changing net from $620 to $1,040. Show that dollar change, the affected source and expiry.
A timed boost continues in the background; integrate each expiry boundary exactly, with no retrospective
bonus to earlier income. A boost that cannot currently affect eligible income is unavailable with a reason.

The owner has previously requested paid income multipliers and rewarded ads. Their general intent remains;
the old tap products, sizes, strain controls and worth estimates are superseded. Reprice/rebalance the new
benefit before enabling a product. Do not sell progression XP, automatic promotions or changes to call odds.
Use the existing billing/entitlement design for verified grants and Restore when native billing is available.

## Store and navigation

Use five persistent, labeled destinations on management screens:

| Destination | Contains |
| --- | --- |
| HQ | Station, patrol activity and net rate, next action, SWAT readiness, return report |
| Calls | Board, briefing, squad selection, live call and debrief |
| Team | SWAT roster/recruitment/training, Patrol roster/hiring/training, Command Staff |
| Build | Facilities, department developments and capacity expansions |
| Store | Equipment, usable boosts, and real purchase offers when billing exists |

Store sits at the right end of the bottom navigation with a recognizable shop symbol and an explicit
label. It is one press away from each management screen, with the same selected and pressed treatment as
other tabs. At 320px the five targets each retain at least 44px; labels, text enlargement and safe areas
are verified rather than squeezed to fit a fixed-height rail. Live calls retain focused navigation;
commercial offers do not intrude into decisions or adverse results.

Move the existing EquipmentStore into this destination and reuse it. Build no longer duplicates an Armory
catalog. Preparation and equipment requirements deep-link to the relevant Store item and restore the
player's context afterward. Patrol hiring stays in Team, not in a premium character store.

Store categories distinguish ordinary funding purchases from real currency. Every offer shows what it
changes, duration or permanence, eligibility, ownership and its actual price. The acquired object displays
confirmation from a successful command. Real products also have pending, canceled, offline, unavailable,
owned and restore states; no simulated checkout masquerades as a real purchase. Omit empty categories
until they have usable content. Do not add fake sale timers, unearned notification badges or forced offers.

## HQ scene and money feedback

Replace the tap panel with patrol activity: staff portraits, a small dispatch/vehicle scene, gross and
cost breakdown on demand, net/hour, and one concrete action such as hiring into an open position or
training an eligible employee. At 390×844, that action and the next department decision remain visible.
On short phones the scene contracts before controls or body type shrink.

Funding is credited automatically through settlement. No collection button, reservoir or unclaimed
cash appears. Periodic cash movement can travel from the patrol scene to the resource capsule, but it
only presents a coalesced, authoritative ledger delta. It never grants money. Keep the illustrated currency,
curved travel, arrival pulse, maximum 24 sprites and reduced-motion direct update from the visual direction.
Do not animate every settlement tick or draw flows over call decisions. Group routine income into a
low-frequency visual event while HQ is visible; arrival amounts sum to the actual eligible ledger deltas.

On return, show one settled summary. Backgrounding, navigation, overlapping spending, canceled effects
and campaign changes reconcile the displayed balance. A burst tally and tap strain meter have no place
in this model and are removed rather than retained as decorative progression.

## Implementation boundary and acceptance

This changes persisted state. The previous “no save-shape change” constraint no longer applies. Use a
deliberate save-version bump and the project's existing explicit incompatible-save/recovery-export path;
never reinterpret an old SWAT roster as NPC patrol staff or silently reset a campaign. Planning does not
reset or alter any saved campaign. The code change must name all affected consumers: settlement, wages,
projections, duties, recovery managers, optimizer, grants, ledger, reports, saves, initial state, fixtures,
art registry, navigation and architecture journeys.

The playable slice is HQ + a patrol roster + one paid hire + automatic funding + one Store equipment
purchase. Its assertions are economic outcomes, not animation events. Then cover all roster, promotion,
boost, navigation and secondary states before calling the overhaul complete.

Required proof includes:

- The initial budget reconciliation above and zero legacy SWAT patrol/tap income.
- Equal online/offline balances and service XP across hires, training completion, boost expiry,
  cap boundaries, clock rollback, large absences and campaign switching.
- No doubled credit through reload, repeated events, overlapping purchases or interrupted animations.
- Hiring/promotions/capacity use unboosted projections; running out of boost cannot strand mandatory costs.
- Finite staffing ceilings at every department level; no NPC income or paid multiplier grants global XP.
- Headless first-session, 24-hour and multi-day campaigns with earned boosts, maximum paid holdings,
  empty staffing, maximum payroll and recovery. Inspect purchase timing and marginal return, not just net.
- Real UI flows at 320, 390 and 430px for Store, all three Team sections, empty/locked/poor/owned/training
  states, error/pending purchases, saves, settings and onboarding. Keyboard, enlarged text and reduced motion.
- `npm run verify`, `npm run check:ui`, `npm run test:e2e`, Pages-base build and Bun fingerprint check
  on the integrated implementation, followed by motion recording and sustained interaction profiling.
- Physical iOS/Android validation before device performance is claimed. Browser emulation is insufficient.

## Adversarial verdict

**VERDICT: Accepted with controls.** This is a design review with shared implementation context;
its economic values and player engagement remain unvalidated hypotheses.

Steelman: a separate patrol workforce gives the department visible scale and repeatable idle investment.
It lets SWAT characters serve the tactical game without sacrificing the player's primary revenue whenever
they deploy. A persistent Store makes spending discoverable without interrupting calls.

| Challenge | Finding and required control |
| --- | --- |
| Strongest failure mode | Positive staff profit funds unlimited staffing. Higher prices alone merely slow compounding. Hard department-level position ceilings prevent cash from buying past the authorized capacity. |
| Best alternative | Keep SWAT patrol and add a division-wide supervisor bonus. It reuses more code and preserves a duty tradeoff, but still pays players to withhold tactical staff and makes the broader roster largely cosmetic. Reject for the first release. |
| Load-bearing claims | $620/hour preservation is arithmetic, not pacing validation. ×1.5 gross is a 67.7% increase in starting net. Simulate the full cost/grade/boost stack before treating a multiplier or price as balanced. |
| Assumption inversion | If passive income also grants level XP, paid funding accelerates capacity and compounds twice. Service-time patrol XP and call-earned global progress keep those paths separate. If playtests require idle global progression, redesign that path before adding it. |
| Who bears the cost | Players could inherit payroll traps and repetitive upgrade chores; maintainers could inherit a second economy engine. Sustainable commitment previews, a recovery route, automatic schedules and one settlement path are required. |
| Hostile expert | Separate staff can become identical income cards, and removing tapping can leave the first minute empty. The slice must expose a reachable staffing/training purchase and visibly different readiness versus funding decisions. Inspect real play before expanding roles or art. |

Serious findings are the compounding loop, boost/net misrepresentation and duplicated progression.
The controls above are implementation requirements, not already-passing tests. The old tap acceptance
results do not validate this replacement economy.

The strongest simpler data model is an aggregate patrol headcount plus a training tier. It would reduce
save and roster complexity. Named NPCs are retained because the requested broader department needs
visible people; their records stay limited to workforce needs rather than inheriting SWAT simulation.
Settle the current interval before every hire, dismissal, promotion, training or boost mutation, so a new
rate never applies retroactively. Quote payback in eligible productive hours, including training downtime.

Review record: all six challenges answered; one serious capacity finding from the independent Sol
subagent incorporated as a hard ceiling; shared context disclosed. Proposed arithmetic was checked,
but campaign pacing, purchase value and player engagement need implementation and playtest evidence.
