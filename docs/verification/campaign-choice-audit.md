# Tactically Idle adversarial route audit

## Result

No reproducible engine blocker remains in the bounded audit. Final V6 exploration used an immutable source export of **bf65313d286d44d25edbd942ff18638150e46273**. All **149 distinct action IDs**, all **398 authored action-by-episode-variant occurrences**, and all three outcome bands for each occurrence were executed through the real engine. Thirty-two story-specific endpoint types were observed, covering accepted care, completed chosen next steps, and honest partial outcomes.

This is bounded, coverage-accounted exploration, not an exhaustive proof over arbitrary seeds, gear permutations, action orderings, or every possible numeric state. This branch has not yet received browser/mobile verification. That final check needs an authorized hosted preview or release.

## Findings and fixes

The audit found authored routes that could never become player choices. The implementer removed them only from V6; published V1–V5 content remained untouched:

- Welfare `correct_and_close`: the no-care current check already completes the chosen conclusion
- Hostage `check_civilian_needs`: the completed exit already checks needs
- The two prearranged protective episodes retained `phone_mina_adapt` and `relay_mina_adapt`, but every remaining opening had already heard Mina
- The independent-phone hostage episode retained `lost_line_update`, `relay_contact`, `relay_contact_later`, and `hear_mara_later`, even though its opening preserves contact and its adaptation has already heard Mara

These were dormant authoring leftovers, not player-visible deadlocks. They were not counted as meaningful additional choices. The frozen final rerun reaches every remaining action-by-variant occurrence.

No additional defect was established in resource consumption, accepted care, player-visible eligibility versus command execution, replay prevention, state reload, or settlement.

## Final V6 bounds and coverage

The selection census covered all six scenario types and all sixteen supported scenario/building-family combinations, incident seeds 0–99, building seed 7, tier 2. It retained 267 representative cases distinguished by scenario/building family, episode variant, the complete hidden-truth vector, external-service availability, and day/night environment.

For each representative:

- Ten seeded policies were run for each of three capability profiles: current starter roster without certificates/optional gear; current starter roster with one trauma kit; fully qualified, fully stocked, rating-85 fixture
- Ten additional policies used stocked, certified rating-35 officers to test mixed bands that were impossible at the sampled expert margins
- Each path was bounded at 45 decisions; no path hit the bound
- Policies favored continued substantive work while still sampling partial exits
- The first policy per profile used the untouched natural RNG stream and checked save/reload after every decision
- At each newly reached action/profile/scenario, all attainable favorable, mixed and adverse bands were independently committed using a sampled seed that actually produces that band at the current margin

Final frozen-source counts:

- 10,680 complete policy paths
- 68,974 ordinary path decisions
- 57,969 additional explicit outcome-band forks
- 126,943 total real decision transitions across these two passes
- 7,992 natural-stream save/reload checks
- 42,170 rejected attempts to repeat an already committed action
- Zero handler/selector disagreements, newly deadlocked successors, premature receivers, duplicate consumable uses, invalid natural reloads, or decision-depth overruns

Forced-band forks are diagnostics, not claims that a naturally continued stream would draw every selected outcome. Natural-stream save checks are counted separately. Forced histories were not used to claim save compatibility.

### Coverage by story

| Story family | Supported building families | Episode graphs | Distinct action IDs exercised | Specific endpoint types observed |
|---|---:|---:|---:|---:|
| Welfare check | 5 | 2 | 13/13 | 3 |
| Medical assistance | 1 | 3 | 17/17 | 3 |
| Protective response | 5 | 3 | 26/26 | 7 |
| Active armed incident | 1 | 3 | 28/28 | 6 |
| Hostage crisis | 1 | 3 | 32/32 | 6 |
| Protected rescue | 3 | 3 | 33/33 | 7 |

Welfare recipe indices 1 and 2 select the same independent-later-sighting graph; the two welfare graphs are reported honestly rather than counted as three. All 398 action/graph combinations have favorable, mixed and adverse execution coverage when the low-rating qualified diagnostic is included.

Generic template endings and the exhausted-options fallback are not counted as additional story routes. The ordinary explored states always retained an authored continuation or honest partial endpoint, so the fallback itself was not reached by the V6 policy corpus.

## Geometry, movement and settlement

A separate pass covered all sixteen supported combinations with incident/building seeds 0–5, ordinary and fully equipped profiles, eight policies each:

- 96 configurations, 1,536 completed operations and 9,534 decisions
- 560 single-edge route cuts: 550 alternate-route checks and 10 disconnected-route checks
- 445 complete destination-sealing checks
- 442 sealed destinations correctly blocked the required traversal
- Three permitted sealed-room actions were legitimate: urgent protection had already moved the squad inside that same room, and the subsequent reach action required only within-room movement. A targeted reproduction confirmed the actual squad position and empty traversal requirement
- 1,536 settlements checked consumed items were removed rather than returned
- No stale blocked opening was reused, no disconnected movement was allowed, and no full completion retained an unmet civilian-care status

This covered actual route hydration and action eligibility, not merely authored opening lists. The family tests additionally exercise per-edge alternate routes, receiver movement, chair/vehicle pickup placement, injury recovery, and matching person/prop positions.

## Legacy and multi-squad compatibility

The V1–V5 route pass covered every supported type/family combination for each version, incident seeds 0 and 7, building seed 7, tier 2, ordinary and fully stocked profiles, six natural policies each:

- 288 configurations
- 3,456 completed natural paths
- 15,615 decisions
- 16,632 save/reload checks, including free legacy stage continuations
- 6,809 repeat-action rejections
- No unexplained start failure, deadlock, changed active run on reload, or settlement/reward duplication

A separate two-squad pass covered 143 V6/V4 configurations, 1,430 paths, 7,559 decisions and 802 natural reloads without an engine issue. Historical content and migration checks also passed against genuine prior-version fixtures, including frozen issued-call navigation and preserved V5 fingerprints.

The legacy sweep and geometry pass were run against c7d243a-era engine code. The subsequent bf65313 product diff removes only the unreachable V6 actions/conditions listed above; it does not change legacy engines, geometry, inventory, or save semantics. The broad final V6/band passes used frozen bf65313 directly.

## New-game and Auto checks

A frozen-bf65313 check across 100 campaign seeds verified:

- No duplicate starter identities
- All 300 initial calls deploy with one starter squad and expose an eligible first story choice
- 600 Auto operations are pure and repeatable; they do not mutate campaign state, advance RNG, buy gear or perform story actions
- All 300 two-squad attempts correctly report the existing starting-stock constraint: eight officers require eight radios, while the starting inventory owns six
- The shortage is also reported by Auto; it is a legitimate unavailable deployment, not an unexplained failure or a new-game deadlock

Existing UI-handler tests cover manual zero quantities, exact unit selections, another squad’s selections, positions, support choices and undo behavior. Auto is inventory-only.

## Regression checks run directly

- V6 module/navigation/campaign focused suite: 79 tests passed
- Geometry, squad routes, bindings, resupply, consequences, external support, support vehicles, legacy settlement, rollout and saves: 116 tests passed
- Genuine release migrations, content migrations, legacy generation, published V4 compatibility, historical exercises and navigation: 91 tests passed

These groups overlap; they should not be summed as a unique test count or substituted for the implementer’s final full verification.

## Remaining verification limits

- Actual browser/mobile rendering of this branch remains a separate release check
- Runtime exploration fixes tier 2 and specified building/incident seeds; the generation/integration suite separately validates a broader static tuple set
- Representative selection covers observed hidden-truth/service-availability combinations from a bounded census, not all uint32 seeds or all service-delay values
- Not every action order, roster rating, stress value, unit condition, loadout combination or injected physical change was exhaustively enumerated
- Arbitrary malformed save payloads were not fuzzed; legitimate histories and existing corruption/migration regressions were checked

## Reproduction artifacts

The full source backup includes the diagnostic scripts and raw accounting in its audit-evidence folder:

- `audit.mjs`: bounded natural/forced policy exploration and band forks
- `geometry.mjs`: route-edge cuts, sealed destinations and settlement checks
- `newgame.mjs`: starting-campaign and inventory-only Auto checks
- `bands-report.json`, `bandslow-report.json`: final immutable-bf65313 coverage and endpoint traces
- `geometry-report.json`, `legacy-report.json`, `teamwork-report.json`, `newgame-report.json`: focused accounting
- `snapshot-bf65313/SOURCE_REVISION`: exact immutable source revision

To reproduce the diagnostic corpus, use the source snapshot and installed project dependencies described in the backup. The scripts execute the engine directly; they do not operate a browser or listen for network connections.
