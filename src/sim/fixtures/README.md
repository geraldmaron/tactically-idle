# Frozen release-migration fixtures

These JSON files were captured by running the unmodified published baseline at
local commit `92ab37d7306b3ccedb0ef32c1fe910db92175da2` (recovered published
baseline `b254f1b`), rather than creating modern states and relabeling them v4.
They contain synthetic game state only. They have no user or browser data.

- `release-v4-active.json`: the old engine's v4 initial campaign after purchasing
  academy, recruiting, expanded barracks, records, thermal and logistics unlocks;
  then deploying and committing Gather intel and Thermal check. It contains six
  real old battery units: one consumed but still reserved in the historical run,
  one unconsumed reserved, two ready, one expired, and one scrapped. A battery-only
  three-minute delivery record and duplicate retired reservation reference are
  deliberately included to cover cleanup without deleting elapsed time. Other
  IDs, wear, history samples, operation and department RNG come from the old engine.
- `release-v1-stacks.json`: an explicitly constructed v1 stack-format envelope,
  without unit inventory, personnel identities, calendar, or officer career
  fields. Battery stacks occur between reusable equipment stacks, so skipping
  them would change subsequent unit IDs, wear draws, and aging.
- `release-v1-expected-v4.json`: the actual result of deserializing that v1
  envelope with the old baseline. This is the independent oracle for migration
  ordering, career defaults, unit IDs, wear, service jobs, and RNG state.
- `release-v4-wallet.json`: an old v2 slot library containing two actual v4
  campaigns, a completed 8-DP receipt, allocations of 3300 and 1700 milli-DP,
  and 3000 held milli-DP. Tests read its frozen campaign UUIDs rather than
  substituting fresh identities.

`capture-release-fixtures.test.ts.txt` records the generator. To intentionally
recapture, copy it to `src/sim/capture-release-fixtures.test.ts` in a checkout of
the baseline commit, update its output directory, and run that single Vitest
test. Do not regenerate fixtures against the release implementation under test.
The normal regression suite needs only the checked-in JSON files.
