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

## Hosted journeys on the initial release

PR #21 deployed commit `efa1fbe706d2bb700eaf624ebec7cacbb6a12028`; its exact Pages build and deploy jobs passed. The cloud browser used the published sandboxed harness with temporary save slots, at 320×568 and 390×844. Normal browser campaigns were untouched.

- Ada: direct early question, duplicate-source check, repaired conversation, current safety check and chosen stay-at-home ending. Five logged decisions; no medical complaint in this episode.
- Rosa: supervisor did not answer; she chose assessment inside while retaining her keys. The crew remained unavailable until the actual response elapsed, then accepted care. A separate early ending remained unresolved with requested care unaccepted.
- Mina: private terms, observed camera stop, withdrawn group proposal, actual move outside, separate conversation and chosen follow-up. Seven decisions; marker moved from the living room to the front garden. Zoom, drag, fit and room selection aligned.
- Signature: Ben left with his phone; the negotiation phone restored contact. The first offer naturally failed, clarification succeeded, and Mara left separately. Both people were safe; nobody signed or established the disputed allegation. Eight accurate decisions.
- Jun: a seven-decision slower-assistance practice kept the chair with Jun through pickup and receiving. A separate normal call used owned AR-0247, its actual qualified operator and stock. Care completed at 61.3 minutes. One trauma kit was consumed, vehicle condition fell to 94%, and the returned unit was unreserved in inventory.
- Eli: a normal armed call used actual auto-equipped stock. Urgent response stopped gunfire, a separate stand-down check failed, then a longer exchange obtained stand-down. Eli moved outside, received first aid and consented to assessment, but an unavailable ambulance kept care pending. Ten decisions; one real kit consumed and equipment wear persisted.

Close/reopen details did not commit decisions. Late decision logs remained usable. No officer casualty occurred in these natural browser runs; casualty branches remain covered by engine journey tests.

The journeys identified presentation fixes included in the follow-up: nonwrapping stage labels, unsupported support controls, complete uncertainty sentences, state-specific next prompts and remaining tasks, duplicate debrief highlights, and an entry-route preview that still started outside after the squad had entered. These fixes are tested separately and receive a hosted recheck after their deployment.

The browser's supported import picker did not open inside the isolated harness. The synthetic legacy-v4 import was therefore not completed in the browser; migration, ten-slot preservation and new-story discovery remain covered by source tests. No user save was reset or changed to perform QA.

The frozen follow-up passes `npm run verify`: 1,497 tests in 96 files, typecheck, artwork validation and production build. The explicit `/tactically-idle/` Pages build also passes.

The review follow-up also removes the duplicate authoring route finder. Access facts, bindings and live movement now use the same blocked-opening, alternate-path and walking/chair rules.
