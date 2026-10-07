# Blueprint-bound stories

New calls use six branching story archetypes. Each has a coherent authored cast and episode bundle; room and route bindings come from the generated location. These are replayable stories, not a claim of unlimited unique plots.

## Authoring contract

1. Add a typed `STORY_ARCHETYPES` recipe with actual room, setting and object requirements. `prepareStoryShell` selects a compatible room deterministically from the incident and building seeds. Unsupported layouts fail explicitly.
2. Build the beat graph against that selected room. Keep uncertain reports separate from true state and from checked public knowledge. A current presence fact must be separate from a historical allegation or weapon report.
3. `attachStoryBindings` declares people, carried personal props or real mapped object IDs, complete routes and observed transitions. It does not invent furniture, map zones, inventory, extra officers or vehicles.
4. Use a committed flag to describe a move or transfer of a personal prop. Subject facts such as a care need use `storyPersonId` to follow that person’s public location without creating a second marker. The map, fact panel, person-targeted choices and prop gates project from that same flag and the existing knowledge record. There is no second mutable actor store.
5. Bind physical moves to `storyRoute`, and conversations/aid that follow someone to `storyTargetPersonId`. Recipe action names are checked; a misspelled action fails generation. Public position is used for action targeting, never hidden truth.
6. Whole routes are recomputed against the current opening states. A blocked first path may have a valid alternative; an inaccessible destination cannot be described as reached. Chair routes use existing ground-floor openings of the supported width. Ownership of a vehicle cannot make an unsuitable interior route accessible.
7. Declare personal-prop requirements only where ownership actually matters. Personal phones, keys and wheelchairs are story props; they are not department stock. Department equipment still comes from the assigned, serviceable inventory and existing qualifications.
8. A release that is declined does not move the person, consume the conditional travel time, use a route tool or open doors. Successful traversal uses the existing game's route/material costs. A shared lock is counted once. Explicit authored door changes take priority. A `storyExitState` effect resolves the door actually used by the current route; it must never lock an obsolete route or turn an unused blocked door into a usable one. Receiving crews use the explicit `external_support` route actor, so their arrival still costs travel when the officers are already inside. Resolved opening changes are retained in the decision record for replay.
9. Off-scene destinations must be explicit. Removing a marker does not create a room or imply a journey that did not happen. Jun's chosen community room is a future destination, not a drawn location or completed transfer.
10. Validate with `validateScenario` / `validateStoryBindings`, then replay the story. Generation validation is not evidence that the prose is coherent or the mobile screen is readable.

## Knowledge and presentation

Reported locations remain approximate. Confirmed locations are exact. Unknown truth or an unobserved transition cannot move a public marker or reveal a prop. An observed release moves the existing marker and removes the old room's occupancy claim. A historical decision retains the text and sampled result it committed; current state does not rewrite history.

A fixed story event can use explicit `resultLabels` to avoid describing a completed release as a failure when only effort differed. This metadata does not erase the sampled band, costs or injuries. Different authored outcomes retain their distinct previews and consequences.

Every required committed beat must change evidence, a meaningful commitment, a person's situation, a real resource tradeoff or an available ending. Pure menu navigation belongs in the UI and must not spend a minute or sample an outcome. Optional details retain full numeric explanations; the result lead shows what happened to the people.

## Compatibility and checks

Issued scenario IDs encode their content version. Versions 1–4 remain frozen (the decision exercises built on them were removed with practice on 2026-10-06). Loading a campaign changes only the version used for future draws; it does not replace the board, reset an operation or consume its RNG. New decision exercises offer direct access without a new campaign.

Checks include exact published-v4 fingerprints, complete journeys with save/reload after each beat, repeated-action/reward refusal, real prop and person projections, all-exits-blocked and alternate-route cases, and deterministic generated bindings over every supported layout. Before release, run `npm run verify` and review the actual hosted 320/390px story and blueprint journeys.
