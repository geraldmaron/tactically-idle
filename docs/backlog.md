# Backlog

The one list of work still to do. Everything here was checked against the code on 2026-10-18;
done and retired items were removed rather than kept as history. Add new work here, delete an
item when it ships, and don't keep a second "next" list in any other doc. Each item names what
done looks like.

The core goal orders the list: generated blueprints with people and objects placed on them, and
every decision a chance of a branch shaped by officer and item ratings. `src/architecture/`
measures the odds wiring; its floors rise as these items land.

## Now: the odds and the blueprint

1. **Observe step for `observes`.** In progress on `claude/zealous-mclean-5fccb5`. Choices that
   watch a room settle what the squad knows, built on `scenario.incidentPeople` and
   `run.knowledge`. Done: a wiring probe proves it, and the camera drone has a call that uses it.
2. **Gear moves the odds on most choices.** Today carried gear moves 3 of 30 sampled opening
   choices (`items-none` probe, floor 0.1), because bonuses apply only where a choice declares
   them. Done: equipment applies by what the choice physically does, and the floor rises.
3. **The building moves more choices, barricade first.** A different building changes 6 of 33
   opening choices (`blueprint-building`, floor 0.18). The barricade tree has 2 `team` moves out
   of about 37 choices (armed 13, hostage 8, rescue 8). Done: the barricade makes physical moves,
   and both blueprint floors rise.
4. **A second squad can act.** Every v13 choice puts one squad to work (`squadsPutToWork`), so
   joint operations don't exist. Done: trees author support or second-squad choices, and
   `squadRange` reaches 2 or more on at least one call.
5. **Rescue gunfire through the incoming-fire model.** The shooter's sightline is computed from
   the building, but harm is still authored per branch. Done: rescue fire uses the drawn
   incoming-fire result.

## Next: calls and the incident model

6. **Write barricade, armed and rescue model-first,** as the hostage call was: template, design
   sheet in `docs/calls/`, tree, separate review. Retire each old tree once its replacement passes
   coverage, balance and review.
7. **Complication modules:** child, dog, second subject, medical bystander, crowd, power out,
   reinforced door, intoxication. Every template has `complications: []` today.
8. **Casualty, care and aftermath:** an officer who fires is off duty for 24 game hours (D4); a
   fled subject creates a follow-up warrant call (D2).
9. **New call types:** high-risk warrant, robbery in progress, crisis barricade, vehicle standoff.
   The standoff needs a roadside building family.
10. **Board risk card** with suggested capabilities, before the player commits a squad.
11. **Meters:** time moves them, the `shots` event is written into content, and escalation by drift.
12. **Less-lethal use spends cartridges.**
13. **Hostage engine requests** filed in `docs/calls/hostage-signature-design.md`: R-G1 a group
    member's weapon as a belief, R-G2 a role change the player meets, R-G3 count-conditioned
    briefing lines, R-G4 `onOut.next`, and N6, N7, N9, N15, N16 and N21.
14. **Hostage review leftovers:** the B9 owner-condition replay leak, the NF3 to NF8 prose notes,
    and the N8 and N20 skill budget fixes.
15. **Content note and 988 line** shown for the hostage and barricade calls once the owner settles
    the wording (see decisions).

## Gates and tooling

16. **Scale gates (M6):** every signature class over K seeds (generate, bind, validate, agree,
    walk, coverage, writing), balance per template and incident class, the domain model's
    invariants as code, its stress-test cases as tests, and published counts.
17. **Lab compare view:** per-choice odds deltas for the same call under two instances.
18. **`npm run check:strings` passes.** It exits 1 on existing call-tree prose (repeat and
    path-echo findings).
19. **Browser end-to-end script works again.** `scripts/play-loop.mjs` (`npm run test:e2e`) still
    expects standing assignments and a two-squad deployment, which no longer exist. Done: it plays
    one tactical call through the real UI at 390x844 and 320x568.

## Player experience

20. **Onboarding:** a first call that teaches the loop.
21. **HQ stat tiles** become icon tiles with mini bars.
22. **Art:** manager portraits (Watch Commander, Quartermaster, Training Sergeant) and course and
    branch emblems.
23. **Small-screen map:** rooms under 44px on the 320px map, and long footprints that render small.
24. **Team familiarity** and a change-priorities action, both unused by any call.
25. **Playtests** with first-time players, and a check on a real iOS and Android phone, including
    keyboard and text zoom. Includes the rendered save-slot rejection message, never seen.
26. **Audio and haptics.** Optional.

## Owner decisions

- **Mobile engine and device targets; business model and price; content rating; budget and
  release date.** The store and ledger are simulated until then.
- **Death endings:** a human read of `owner_killed`, `worker_killed`, the armed `subject_killed`,
  `resident_killed` and `tank_ran_out`.
- **Content note and 988 line wording** for the hostage and barricade calls.
- **E12:** whether a team holding outside an active shooter fits the game.
- **Barricade building family:** keep apartments (`apartment_unit_g2`) or not.
- **"Goes to review" ending line** (E2.1) in the barricade call.
- **Scoring:** whether "resolved with harm" counts as complete (+10% service), and whether an entry
  breaks every open commitment, including those to civilians.
- **Hostage review calls:** O4 custody wording, O1 armed-lane words, N19 time charge on all-night
  holds, the 3-line board hook clamp, the 6-decision stage-3 chain, and the E3 count read.
- **Sidearms:** a new department can't fire until it unlocks `field_response_program` and trains
  `entry_team`. Keep that, or issue sidearms from day one.
- **Command Staff scope:** build the Peer Support Lead and Recruiter, and decide whether routine
  patrol work gets an idle home under the Watch Commander or stays deleted.
- **Fingerprints under the no-freeze rule:** keep the compiled-fingerprint test and cross-engine
  CI as regression tripwires, or drop them.
- **Domain-model defaults D1 to D5** stand unless changed: no explosives, a fled subject's follow-up
  call, groups above 8 as a later mode, 24h review after a shooting, concessions within policy.
- **Later scope:** districts, career stories, simultaneous tactical incidents.
