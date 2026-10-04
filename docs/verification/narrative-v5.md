# Narrative and blueprint release verification

The former generic planning results are replaced for new calls by six branching stories with named people, concrete wants, staged discoveries and state-specific endings. The stories share typed world bindings rather than inventing a new layout for every episode. Existing issued calls and exercises retain their original version.

## Automated checks

- `npm run verify` plus the final frozen test rerun: 1,475 tests in 94 files; typecheck, artwork validation and production build passed
- 144 generated tuples cover all 16 supported story/layout combinations, multiple building and episode seeds, deterministic regeneration and binding validity
- Whole journeys save and reload after every committed beat; repeated decisions and rewards are refused
- A real Ben/Mara release journey verifies separate current map locations and unchanged prior history
- Full route cuts, valid alternate exits, property holders, hidden-location isolation, care-fact relocation and current person targets are covered
- Exact regressions cover Rosa’s alternate exit without reopening the blocked front door, and a medical crew’s travel when officers are already inside
- Published v4 definitions, old exercise IDs and historical RNG/results remain fingerprinted
- Campaign migration enables future v5 draws without resetting the board, active operations, resources or local save slots

## Release status

Source verification passed. Hosted 320px and 390px story, result and blueprint interaction checks follow publication; this document does not claim those checks have happened yet.

The build retains the existing large lazy blueprint/content chunk warning. The warning does not fail the build; actual mobile loading and interactions still need the hosted check.
