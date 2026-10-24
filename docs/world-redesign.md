# World, crime and officers redesign

Status: design of record after two Codex challenges, 2026-10-24. Not built. Requested by the owner:
"take full creative control and redesign the application on an artboard before touching the code."
Canvas: https://claude.ai/artifact/6kwXCJp2vknqx7xfrrEKoz (world loop, lifecycle, economy, characters,
and 20 phone screens). Work items land in [backlog.md](backlog.md) only after the owner reads the canvas.

## What the owner asked for

1. A new design, UI and UX that does not recycle existing surfaces, built from the jobs, journeys and
   surfaces mobile players expect on iOS and Android across the whole lifecycle.
2. Persistent officers with rich backstories and profiles. Calls and the rest of the game read and
   write that character system. Events change traits; some changes stick.
3. A city with a crime rate. Patrol meets gang members, organized crime and other people, ranked by
   crew type and tier with funding attached. SWAT on patrol raises the odds of reaching higher-value
   targets at a cost such as stress. Earnings on calls and on patrol are designed together.
4. Officers may know a suspect or anyone in a call. Officers form relationships and bonds with each
   other, romance included.
5. Extensible, repeatable, modular patterns.
6. Monetization through one-time and lifetime purchases: decide what is free, and earn without being
   money hungry.
7. Challenge with Codex: astra (the configured default) to break the plan, sol (`gpt-6.1-sol`) to plan
   and challenge. Both ran on the first draft; the record is at the end.

## The thesis

Tactically Idle becomes a city that keeps living while the player is away, told through the people who
police it. Patrol coverage pays the bills. Calls and warrants move the department. Officers remember.

One sentence a player should be able to say after a week: "We took the Pike Street Kings apart, Reyes
held the landing at 214 Ninth, and Vale still won't take a rear without Haddad."

## Lifecycle: jobs, journeys and surfaces

### Jobs to be done

| When I... | I want to... | So that... |
| --- | --- | --- |
| have 30 seconds | see the city is holding and make one good move | I feel progress without a chore |
| come back after hours | learn what happened to my people and my city | returning feels like news, not a tax |
| have five minutes | play a tense call where my officers' history matters | choices cost something real |
| see a name come up again | follow it up the crew | the city feels like a place with people in it |
| watch an officer get hurt or shaken | take care of them and see it matter | the team feels like mine |
| need to decide something | remember enough without studying the campaign | I can act, not research |
| regret a result | understand it and recover | a bad night is a story, not a dead end |
| want to stop | finish a session cleanly | leaving never endangers anyone |
| want long goals | close a district chapter and open the next | I have a reason to come back next month |
| choose to pay | buy something lasting and fair | I don't feel milked or behind |

### Journeys across the lifecycle

| Stage | Journey | Surface |
| --- | --- | --- |
| Store listing | Shows the real blueprint, the officers and the idle city; names the mature themes and that the app works offline. | listing |
| First open | Content advisory, then a call within 90 seconds. Timer Off during onboarding. No account wall, no menus, no store. | A1 |
| First session | Name the unit, pick a starting district, watch a scripted first contact close (the real system on an already-open case, never a secretly faster clock), end on one staffing decision and a visible goal. | A2, A3 |
| First exit | Show what keeps running, what pauses, and when something will be ready. | A3, B1 |
| Notifications | Asked when the player starts something they want to hear about (the first shift). Categories, one daily digest by default, quiet hours. Never purchases or officer distress. Declining changes nothing. | A3, F2 |
| Short return | Glance, one suggested move, leave. Funding is credited, never collected. | B1 |
| D1 return | At most three developments, people first, funding already credited, one suggested action. | B3 |
| D7 return | The first investigation pays off; a remembered incident comes back; one new management decision. | C1, D2 |
| D30 return | A district chapter closes visibly: residents, officers and the district changed; the player picks the next focus. | B1, C1 |
| Lapsed return | Story so far in three lines. Leads and pending officer decisions are kept; nothing expired for absence. | B4 |
| Everything unavailable | Department work, a reserve assignment or a safe handover, with recovery estimates and no purchase offer. | B1, E1 |
| Live call | Alert, open, three stages, debrief. Hidden app pauses the call (existing owner rule). Back from a call returns to management with a Resume entry. | D1, D2 |
| Proactive shift | Started by the player, timed, visible on the lock screen (iOS Live Activity, Android Live Update). | B2, D3 |
| Officer moment | Aftercare fork, a bond changing state, a romance surfacing, a promotion, a retirement. | E1 to E4 |
| Purchase | Preview, buy, pending approval, cancel, restore, refund; an interrupted purchase never needs buying again. Prices only in the Store. | F1 |
| Settings and account | Timer, theme filters, personal-lives switch, notifications, text size, motion, haptics, cloud backup, purchases off, reset, delete. | F2 |
| Campaign end | A career summary and officer histories; an optional new city; purchases and archives kept. | later |
| Leave | Export, reset campaign, delete local data, delete cloud backup, each separate. A deleted campaign never returns through sync. | F2 |

Platform rules: safe areas and Dynamic Type on iOS; VoiceOver and TalkBack with a full text version of
blueprint facts and actions; Android predictive back steps out of a call to management with Resume,
never abandons it; haptics optional; reading speed never decides an outcome. Cloud backup uses a
cross-platform save service (iCloud key-value storage is 1 MB and iOS-only). Store review prompts use
the native API after several sessions at a neutral moment, never after a loss, never gated by a "do you
like it" question. A support route and an optional diagnostic export are always reachable. Widgets come
later and are never needed to collect anything.

### Information architecture

| Tab | Owns | Primary action |
| --- | --- | --- |
| City | Living map with a text list beside it, districts, patrol coverage, the radio, funding | Decide where the department needs attention |
| Operations | Now (live calls, warrants ready), Investigations (crew ladders, dossiers, leads), Archive | Play or advance an operation |
| Team | SWAT, Patrol, Command; jackets, bonds, alumni | Prepare and look after people |
| HQ | Facilities, training, gear and loadouts, department policy | Build capability |
| Store | Lifetime purchases, cosmetics, ownership, restore | Buy something lasting |

An active call is a focused mode with one Resume entry in management. Badges mean an action is waiting;
the Store never gets a badge. Each tab keeps its position.

## The world model

### City and districts

Five districts open over a career, one at the start. Each has:

- **Crime rate** 0 to 100, drifting toward an equilibrium of crew strength minus patrol coverage, and
  stepping down when an investigation closes against a crew's people.
- **Crews** working it, each an instance of an archetype.
- **Coverage:** patrol units and any SWAT proactive shift.
- **Residents:** named businesses and neighbors who appear in the radio, calls and shift reports for
  reasons other than crime (the night baker, the laundromat family). Crisis and safeguarding calls stay
  independent of crews.

City allocation rewards calm, so neglect never pays:

`allocation = base × clamp(1 + (50 − city crime) / 100, 0.8, 1.25)`, city crime being a fixed weighting of
unlocked districts so moving coverage cannot game the average.

### Crews: archetypes, tiers and subjects

| Archetype | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
| --- | --- | --- | --- | --- |
| Street crew | corner hand | runner | crew lieutenant | crew head |
| Syndicate | associate | soldier | captain | boss |
| Theft ring | lookout | booster | fence | ring boss |
| Supply network | courier | stash keeper | distributor | supplier |
| Wanted | single fugitives with their own case tier | | | |

An archetype is a content file: tier names, the case award per tier, contact weights, escalation odds,
intel per resolved case, crime pressure, recruitment per tier, signature call templates and the lines its
people use. A new kind of crew is data, not code.

Subjects are persistent people (civilian name pool, disjoint from officers) with a tier, a district,
traits, ties and a status: free, held, resolved (charged, diverted, released, cleared), or gone.
Released people come back; a name stopped three times is a story.

Tier 3 and 4 people are never taken on patrol. A patrol or proactive contact with one produces a
**lead**. Leads and enough intel open a **warrant**, an authored operation with legal and operational
prerequisites. Taking a crew's tier 4 by warrant closes the crew's chapter: crime drops, the scattered
members either fade or seed a successor crew later.

### Patrol contacts

- 0.15 contacts per NPC patrol unit-hour, flat. Crime never raises the contact rate.
- NPC tier weights 85% / 14% / 1%; the 1% is a sighting that becomes a lead.
- Every draw has its own identity (save, district, unit, hour, draw index), and a subject is reserved
  by one contact at a time, so offline and online settle the same way and reloads never reroll.

### SWAT proactive shift

| Rule | Value (tuning input) |
| --- | --- |
| Availability | after the first return |
| Length | 2, 4 or 8 real hours; at most 8 hours per squad per rolling day |
| Exclusive | a squad on shift is not on standby; recall any time, arrival elsewhere still takes travel |
| Grant | 200 × funding scale per squad-hour |
| Contacts | 0.3 per hour, tiers 50% / 35% / 13% / 2%; tiers 3 and 4 are leads |
| Who is on it matters | the squad's awareness and communication change how many contacts open casework; the preview uses the real squad |
| Stress | +2 per officer per hour; the shift stops before anyone reaches Overloaded |
| Armed contact, online | the player chooses: respond now as a live call, or keep it as a lead |
| Armed contact, away | always a lead; an absent player's crisis is never resolved for them |
| Bonds | shared shifts move bonds; a bad night can strain them |
| Paid | nothing sold adds shift capacity, cuts stress or changes contact weights |

Previews show ranges, not means. An 8-hour shift's case awards land between 0 and about 1,950 at week-2
values, usually near 900, and about one shift in four produces a lieutenant lead.

## Earnings

### Funding follows the case, not the cuffs

A **case award** is paid once per unique investigation when it reaches any lawful resolution: a charge,
a diversion, a handover into care, a justified release or a cleared allegation. The amount is set by the
crew archetype and tier (the investigation's complexity), times the funding scale. A person's condition
never changes it. Force goes to review, and review, trust, oversight and the officers carry the cost.
Reopening an investigation never pays twice.

| Tier | Case award | Review clock | Call fee |
| ---: | ---: | --- | ---: |
| 1 | 100 | 1 h | 800 |
| 2 | 600 | 3 h | 1,600 |
| 3 | 2,400 | 6 h | 3,200 |
| 4 | 8,000 | 12 h | 6,400 |

Archetypes scale these (a syndicate's tiers pay more than a street crew's). The **funding scale** (×1,
×2, ×3) is earned through service milestones, never bought, and multiplies awards and fees so calls stay
meaningful as patrol grows. Supplies used on a call are reimbursed at cost, never at a profit.

### Hourly income by stage

Computed in a stationary model (crime 50, 80% of casework reaching a lawful resolution, three calls a
day, proactive 0, 4 and 8 hours a day). The model reproduces sol's table; it is a design input, not a
forecast, and needs the campaign simulation before tuning is accepted.

| Per hour | Day 1 | Week 2 | Month 2 |
| --- | ---: | ---: | ---: |
| City allocation | 600 | 1,800 | 3,000 |
| Patrol service grant (4 × grade 1, 10 × grade 2, 12 × grade 3) | 840 | 2,500 | 3,600 |
| Patrol case awards | 81 | 406 | 730 |
| Proactive grant and casework | 0 | 87 | 262 |
| Calls and warrants, fees and awards | 110 | 592 | 2,194 |
| Gross | 1,631 | 5,385 | 9,787 |
| Recurring costs | −820 | −2,100 | −3,824 |
| **Net** | **811** | **3,285** | **5,963** |
| Played share of net | 14% | 21% | 41% |
| Net with no calls and no shifts | 701 | 2,606 | 3,506 |

Week-2 net at crime 25, 50, 75 and 100: 3,735, 3,285, 2,925, 2,925. Lower crime always pays more.

Permanent commitments (hires, promotions, facilities) are checked against the 0.8 allocation floor,
unboosted patrol income and training downtime, never against expected case awards.

### Funding and the odds

Funding, purchases and boosts never enter call draws, pressure, eligibility or resolution. Tactical
capability (certifications, issue gear, the equipment needed to run a call) comes from service
milestones and earned experience, with sustainable free resupply. Funding buys economic growth: patrol
staff, facilities, quantities and comfort. This narrows the money route the player profile already
allows (cash, then gear and training, then readiness). Owner decision: how far to move tactical unlocks
from funding to service.

## Officers

### Persistence

1. **One canonical person record** through every employment change: hire, dismissal, rehire, retirement.
   It carries condition, stress, injury timers, qualifications, traits, retirement state and history.
   Rehire is allowed after a cooldown, at the person's current condition, never from a first-seen build.
2. **Alumni stay in the city.** Retired, departed and dismissed officers can appear in calls, be
   consulted, or return as command staff.
3. **Across saves (later):** an alumni hall and one alumnus brought to a new city. Owner decision.

Persistent attachment needs saves that survive updates. Before launch the no-legacy rule stands; from
launch, in-flight calls are version-pinned and campaign data migrates with a recoverable backup
(`frozen-runs`, `save-migrations` in the backlog).

### Time

The calendar runs one game day per real hour. Officer surfaces show real durations ("stands down for
12 hours"), and lasting transitions (a trait settling, a retirement) wait for the player to have seen the
telegraph, per the officer-stories skill.

### The service jacket

Authored per persona under `swat-officer-stories`, revealed in layers as the player serves with them:

| Page | Opens | Holds |
| --- | --- | --- |
| 1 | at hire | pressure line, one light contradiction, three voice markers, radio sample |
| 2 | after shared operations | a habit or object, a place in the city they come from |
| 3 | after a ledger event of a set kind | a line keyed to that event |

Structured facts beside the prose: home district and ties (never derived from culture or appearance),
family facts, and whether and with whom the officer is open to a relationship (authored, never inferred).
No trauma or service history in an identity line; weight is earned in play.

### Memory, imprints and settled traits

- **Memory:** a ledger of facts (day, kind, people, place, call, one specific). Seven kinds, four short
  presentation variants each. A callback needs a recorded fact; no branch depends on one.
- **Imprint:** a temporary condition with a named cause and a real duration. Imprints carry no number;
  stress stays the only number on rolls, so nothing is charged twice. An imprint changes lines, which
  forks appear and what can settle.
- **Telegraph:** the jacket and shift report show the behavior the player saw ("Called the rear clear
  twice on the laundromat stairs").
- **Aftercare fork:** rest (certain, costs availability), peer support (costs a colleague's shift, note
  stays open), or pairing (keeps the officer deployable, costs the partner's slot, an adverse ending
  settles it). Each costs something, none dominates, and basic care always prevents avoidable
  deterioration.
- **Settled trait:** scoped ("slower on rear cover"), shown with its cause and date, paired with a
  positive that can be earned the same way. Caps: three traits per officer, one settled negative per
  officer per game week. Restraint where everyone was safe never moves anyone toward a negative.
  Civilian harm never becomes an officer's flaw.
- Eight imprint packs at launch, including positive adaptations.

### Bonds

Bonds have readable states, not visible scores: **acquainted, trusted, close** and **tense, strained**,
plus **mentor**. About two significant active bonds per officer; older ones stay in history.

| State | Comes from | Effect |
| --- | --- | --- |
| Trusted, close | calls and shifts that went well together | coordination on shared actions, a small stress buffer |
| Mentor | rank gap, time, the mentor trait | trainee learns faster |
| Tense, strained | a recorded cause: a rear left open, a promotion, a breakup | slower shared actions; transfer requests at strained |

**Romance** has the same mechanics as a close bond, nothing more. Officers initiate and consent; the
player never forces, buys or engineers one, and supporting or splitting a pair is never a lever. Never
between a supervisor and someone they supervise or mentor. If one partner is hurt, the other gets the
same imprint a close friend would. A setting turns officers' personal lives off screen with no effect on
play. Non-explicit always; lines touching sexuality go to a human reviewer.

Launch content: twelve bond scenes (forming, developing, strain, repair) and eight romance scenes
(interest, acknowledgment, boundaries, ordinary life, separation), cast by rules onto eligible pairs.

### Officers know people

Ties come from jacket facts and from play. When a call or contact involves someone an officer knows,
the call says so and the knowledge stays useful (a name only family uses). Ties are always on the
record: the knowing officer can talk, and someone else makes the arrest and handles evidence. There is
no "keep it quiet" option for the player. A tie the player did not know about can surface later as a
story event, never as an odds boost. Repeated contact can produce mistrust or recusal, tied to recorded
facts. Twelve tie scenes at launch.

### Representation

Audit generated distributions across names, portraits, home districts, civilian roles, crew membership,
violence and officer ties so no identity is steadily associated with crime. Residents have visible lives
and good outcomes beyond police contact.

## How calls plug in

Four read hooks and one write, all data on the scenario and checked by content gates:

1. **Cast from the world:** a suspect can be a known subject with history.
2. **Ties:** a cast person may be known to an officer on the squad.
3. **Pair beats:** two bonded officers on one call can get an authored beat.
4. **Imprints and settled traits:** an option or line can read them.
5. **Write-back:** every debrief writes memory facts, imprints, bond state changes and subject status.

Hook precedence is fixed (tie, then pair beat, then imprint line), at most one callback per operation,
and a call with no hooks plays unchanged.

## Modular patterns

Definitions are content, instances are save state, rules are pure functions over both, and every change
is one event in one log.

| Module | Definition | Instance | Rules |
| --- | --- | --- | --- |
| Crews | `CrewArchetype` | `Crew`, `Subject` | `drawContact`, `openCase`, `resolveCase`, `regrow` |
| Districts | `DistrictDef` | `District` | `driftCrime`, `allocationFactor` |
| Cases | `CaseAwardTable` | `Case` (unique id, one payment) | `reviewClock`, `award` |
| Leads | `LeadKind` | `Lead` (no expiry) | `openWarrant` |
| Jackets | `StoryAtom`, persona | `OfficerJacket` | `revealPage` |
| Memory | `FactKind` | `MemoryFact` | `recordFact`, `callbackFor` |
| Imprints | `ImprintPack` | `Imprint`, `SettledTrait` | `telegraph`, `resolveFork` |
| Bonds | `BondScene`, `BondRule` | `Bond` (state) | `driftBond`, `castScene` |
| Hooks | scenario hook data | run flags | `castFromWorld`, `tieOption` |

`WorldEvent` entries (contact, case opened, resolved, lead, imprint, bond state, fact) carry unique ids
and are read by the shift report, jackets, radio and debrief. Settlement extends the existing economy
settlement path (`src/sim/economy.ts`), with explicit behavior at the offline cap per system: income,
crime drift, recruitment and shift contacts stop at the cap; recovery and training continue as today;
leads and pending officer decisions never expire. Cloud conflicts keep both copies and explain the
difference by progress and date.

## Monetization

### Principles

1. Every call, district, officer, bond, ending, update, accessibility feature, backup and recovery route
   is free.
2. Money buys funding pace and looks. Nothing sold enters a roll, creates leads, moves bonds or
   shortens recovery. Funding buys economic growth; tactical capability comes from service.
3. Ad-free at launch. No loot boxes, energy, streaks, countdown offers or daily claims.
4. A finite catalog: a player who buys everything has bought everything, about 22 in total.
5. Real prices only in the Store, from StoreKit or Play Billing. In-game funding is a coin glyph and a
   number.
6. No offer is targeted by losses, officer condition or inferred vulnerability. Purchases can be turned
   off in Settings; platform approval flows are respected.

### Catalog (proposed US prices; the owner sets them)

| Item | Kind | What it does | Price |
| --- | --- | --- | ---: |
| Department Charter | lifetime | +25% patrol service grant (adds about 26%, 19%, 15% to net at day 1, week 2, month 2) | 6.99 |
| Night Watch Office | lifetime | offline funding window from 72 hours to 7 days; costs use the same window | 4.99 |
| Founder's Bundle | lifetime | both, plus one precinct theme; an upgrade SKU for owners of either | 11.99 |
| Precinct themes (3) | cosmetic | department look, previewable | 2.99 each |
| Squad patch set | cosmetic | one complete set | 1.99 |
| Squad coffee | one-time tip | a coffee urn in the squad room and a thank-you line | 1.99 |

Free players get a 72-hour offline window (up from 24), basic automation and normal training queues.
Entitlements deduplicate at the feature level. The bundle is offered after several sessions, with its
real effect on the player's own department.

### Why no ads

Rewarded ads monetize non-payers, but the illustrative arithmetic (25% participation, 10 days, 2 a day,
15 eCPM) is about 0.075 per install, which 0.6 points of payer conversion matches. Against that: consent
work, SDK upkeep, purchase substitution and the tone of a story game. Reconsider only with measured
incremental lifetime value.

### Planning assumptions, not forecasts

| 90-day case | Install to payer | Spend per payer | Gross per install |
| --- | ---: | ---: | ---: |
| Conservative | 2% | 10 | 0.20 |
| Planning | 4% | 12 | 0.48 |
| Strong | 6% | 14 | 0.84 |

The content budget follows measured conversion and production cost on the first slice.

### Never sold

Officers, recruits, rerolls, success, call outcomes, recovery, intel, leads, warrants, story,
relationships, squads, shift capacity, Double Shift boosts, case processing speed.

## Changes to the current plan

| Current | Becomes |
| --- | --- |
| Patrol funding is coverage only, "not rewards for arrests" (patrol-work.md) | Coverage grant plus case awards per unique investigation on any lawful resolution, set by crew archetype and tier |
| HQ, Calls, Team, Build, Store | City, Operations, Team, HQ, Store; calls are a focused mode |
| Non-goal: complex interpersonal drama | Bonds, romance at parity with friendship, and ties are core, with the controls above |
| Officers carry ratings, traits, career counts | Plus a canonical record, jacket pages, memory, imprints, settled traits, bond states, ties |
| A served officer can never be hired again | Rehire after a cooldown on the canonical record |
| 24-hour offline cap | 72 hours free; 7 days with Night Watch Office |
| Rewarded ads and real-money income multipliers (monetization.md) | Ad-free; a finite lifetime catalog |
| One department area | Five districts with crime rates and crews |

Unchanged: generated blueprints, three-stage calls, odds and wiring rules, stress bands, hidden app
pauses a call, no paid success, non-graphic writing, content filters, no officer death.

## Delivery: one district chapter first

Prove the promise small before widening: one district (Pike Street), one street crew with a full ladder,
one squad of four with authored jackets and two arc packs, one complete investigation ending in a warrant,
and a first return that shows a witnessed memory coming back. In order:

1. **Save continuity and interruption** for the new records (canonical person, subjects, cases, leads,
   events), with cloud backup.
2. **World spine:** district, crime drift, allocation factor, one crew archetype, subjects, NPC contacts,
   cases, review clocks, the radio. City tab with its list.
3. **Jackets and memory** for the starting squad; debrief write-back.
4. **Operations tab and the investigation:** ladder, dossier, lead, warrant call with cast-from-world and
   a tie.
5. **Proactive shift** with leads, stress stop and the Live Activity.
6. **Imprints and the aftercare fork.**
7. **Bonds and pair beats** for the starting eight.
8. **Lifecycle surfaces:** cold open, scripted first contact, return reports, welcome back, settings.
9. **Store catalog** with the lifetime items.

Measure on the slice: comprehension of a returned memory, 30-second return time at phone width, call
preparation without crossing more than two tabs, authoring and review hours per finished scene, and
conversion before commissioning 100 jackets and four more districts.

## Owner decisions

- Move tactical unlocks from funding to service milestones, fully or in part.
- Romance in the game at all, given the controls; and the default of the personal-lives setting.
- The alumni hall across saves.
- Prices, and whether ad-free holds after the slice's conversion data.
- Officer death stays excluded.

## Challenge record

Unedited outputs and the economy model are in [world-redesign-challenge.md](world-redesign-challenge.md). Both runs read this document's first draft, PLAN.md, patrol-work.md and the simulation code, read-only.
Neither ran the game or a campaign simulation.

**Astra (configured default), verdict reject on world/crime, patrol earnings, proactive shift, romance
and monetization; accept with controls on persistence and ties; needs validation on imprints and IA.**
Findings accepted and how they changed the design:

| Finding | Change |
| --- | --- |
| Crime farming pays: contacts scaled with crime and beat the trust penalty | Flat contact rate; allocation rewards calm; net falls as crime rises |
| Per-person payouts are an arrest bounty; "force cuts value" preserves the bounty | One award per investigation, any lawful resolution pays, condition never changes it |
| Logging off was the strongest tactic (offline tails, online live calls) | The same lead in both states; online the player opts in; leads never expire |
| The income split was impossible as written; grade formula wrong | Recomputed from the existing grade table in a model; percentage targets removed |
| The 8-hour shift pitch used means | Previews show ranges and lead odds |
| Records Clerk sold working capital; case identity undefined | Removed; unique case ids, one payment, no re-award on reopen |
| Random tier-4 custody skipped the ladder | Tiers 3 and 4 only by warrant; patrol produces leads |
| Proactive shifts recreated readiness versus income | Exclusivity, recall rules, qualification-aware previews, stress stop |
| Store sold opportunities and bonds indirectly | Second-shift queue removed; promise narrowed and stated honestly |
| Boosts amplified net far beyond their label | +25% Charter, net effect shown; no consumable boosts |
| Trust-driven allocation could break hiring | Commitments checked against the allocation floor and unboosted income |
| Rehire exploits; current code blocks rehire | Canonical person record with cooldown and current condition |
| Imprints double-charge and time units undefined | Imprints carry no number; real durations shown |
| Romance became a staffing buff | Parity with close bonds; no levers; no supervisory romance; off switch |
| Concealing a tie was a buyable odds boost | Ties always on the record; hidden ties surface only as story |
| Seeded hourly events do not make a coherent world | Draw identities, subject reservations, cap behavior per system |
| Content bill hidden | One-district slice first; scene counts and a word budget |
| Culture can leak through district and crew assignment | Distribution audit; residents with lives; crisis calls independent of crews |
| Store compliance not established | SKU classes, restore, upgrade SKUs, jurisdiction review before launch |
| The loop was becoming admin work | Return capped at three items, list beside the map, automation, scripted first contact |
| Revenue claim did not fund the content | Planning cases stated as assumptions; budget follows slice data |

Rejected or deferred from astra: its strongest alternative drops tier-priced funding and SWAT patrol
yield entirely. The owner asked for both, so they stay, bounded: tiers price investigations rather than
people, and proactive shifts pay a modest grant and leads rather than bounties.

**Sol (`gpt-6.1-sol`), verdict revise before implementation; keep the persistent city and officers.**
Adopted: the lifecycle gaps (store listing, first exit, D1/D7/D30, campaign end, permissions declined,
cloud save, deletion journeys, parental controls, review prompts, purchase interruption, updates,
support); City, Operations, Team, HQ, Store; the funding scale; the case award and call fee tables; the
flat contact rate; the proactive grant; jackets, memory, imprint, bond, romance and tie content minimums
and the 25,000 to 35,000 word budget; readable bond states; the smaller lifetime catalog and ad-free
launch; deferring call Live Activities (moved to the proactive shift, which is user-initiated and timed).
Its income table was reproduced independently in a model before adoption.
