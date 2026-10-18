# Engine test fixtures

The Maple Street calls and building are registered only by `setup.ts` through Vitest. They exercise isolated map, equipment and decision rules and are absent from production dispatch and scenario cards. Their metadata follows the current ending and physical-care contracts.

`capability-scenarios.ts` holds small test scenarios for equipment rules. Tests register them explicitly with `registerCapabilityFixtures()`.

There are no historical save captures or migration oracles. Save tests build current campaigns and alter version stamps only when testing rejection.
