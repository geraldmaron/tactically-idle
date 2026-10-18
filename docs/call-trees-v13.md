# Call trees (content v13)

**Status:** shipped in the working tree on 2026-10-07. All four dispatched tactical calls are call trees: the hostage crisis (One Last Signature), the barricade (Behind the Bathroom Door), the active armed incident (After the Noise) and the protected rescue (My Chair Comes Too). Each is held to a measured balance band (see "Balance").

## Why

Playing the game surfaced three faults that prose could not fix.

1. **SWAT was sent to patrol calls.** A lost child at a shop, a fall at home and a till dispute all reached the board. None of the eleven typed frameworks earned a tactical team in its own text.
2. **People were named in the engine.** Person ids were `ben`, `mara`, `theo`, and prose was bound by find-and-replace on those authored names. The Scenario Lab showed `ben = Tenzin Dubois`.
3. **Choices did not branch.** Measured on v12 by walking every path through the engine:
   - Hand-authored tactical stories left the other options on screen after 64 to 87% of picks.
   - Typed frameworks removed them, but 55 to 86% of choice points led to the same next menu.

## What changed

| Area | Before | Now |
| --- | --- | --- |
| Dispatch | 13 frameworks, 9 of them patrol, welfare or medical calls, plus two always-on standing assignments | Only `barricaded`, `active_armed_incident`, `hostage_crisis`, `protected_rescue` (`TACTICAL_FRAMEWORKS` in `content/unlocks.ts`). No standing assignments. One live call per kind on the board. |
| People | Ids named after characters; regex binding on authored names | Roles (`taker`, `courier`, `owner`). Prose writes `{courier}`, `{courier.first}`, `{courier.last}`, `{place}`. Names come from a civilian pool disjoint from the officer catalog. |
| Decisions | Action pools gated by flags, or a fixed three-step funnel | Nodes. Taking a choice leaves its node. Each outcome band and hidden truth names where the call goes next. Turn groups draw one of several nodes per call. |

## The model

A `CallTree` (`src/content/call-trees/types.ts`) is typed data.

- **Roles.** Each has a role id, a label, pronouns, a kind (`civilian`, `subject`, `bystander`) and a place (the scene room, another room by type, or outside with patrol).
- **Facts and situations.** Public facts are reported from the start; hidden facts are settled per call by one of three situations (the recipe variant). A `sightline` fact is settled by the building instead: whether an offsite role's window (the template's `vantage`) sees the door a role's way out uses (`sightFromStreet`, `src/sim/spatial-factors.ts`). The template's drawn conditions (time of day, power, weather, crowd) are the engine's environment.
- **Nodes.** Each has a stage, a prompt, optional `promptIf` variants keyed on public state, and two or more choices.
- **Choices.** Title, summary, per-band preview, a check, minutes, optional `onlyIf` state, requirements, modifiers keyed on earlier marks, `talksTo` and `walks`.
- **Team moves** (2026-10-18). A choice's `team` says where the squad physically goes on the generated building: into the scene or a role's room (`to: 'scene'`, `{ room }`), to a spot outside with an opening onto a room (`{ vantage }`), or in and back out with someone who walks (`'escort'`). It compiles into a real approach, so the route crosses every door on the way (a locked one costs force time or the entry tool), clearing the room takes longer the bigger it is, `entry` adds the named person's distance from the door as time, strain and risk, and `signal` (voice or sight to a role) reads how well it carries through the building, the light and the weather. The squad ends where the move took it; an outcome with `back: true` leaves it where it started (the team driven back from the doorway). Someone who `walks` without an escort comes out alone and the squad stays put.
- **Outcomes.** Per band, a list. One routed outcome applies on each band, truth (`if`) and state (`when`); addenda without `next` add text and effects beside it. Outcomes can `mark` state, `reveal` facts, and set people `safe`, `out`, `hurt` or in `care`.
- **Authority, scoring, groups** (M2 slices 4 and 5). Entries and concessions declare `authority` and the card carries the generated command line; endings carry no trust or strain (scored from end states); a counted group role (`groups`) binds count-aware tokens and `TreeState.count` conditions, and `cascade` resolves who follows the leader out. The authoring rules are in `.agents/skills/swat-call-design/references/engine-map.md`.
- **Clocks and meters** (docs/incident-domain-model.md, M2 slice 3). `if` can read a template clock at the end of the choice's minutes (`{ clock: 'door', out: true }`, `{ clock: 'oxygen', low: true }`), and `moves: { taker: 'provoked' }` moves a subject's agitation and rapport. Mood belongs in `moves`, never in a modifier; modifiers are for facts the team learned.
- **Turns.** `turns: { group: [nodeA, nodeB, nodeC] }` and `next: { turn: 'group' }`. One node per group per call, drawn from the call seed.
- **Endings.** Dispositions as elsewhere; `handed_over` is required.

`withCallTree` (`src/gen/incident/trees-v13/compile.ts`) compiles a tree onto the generated building:

- Each node becomes a flag (`at:<node>`); its choices are visible and allowed only while it is set.
- Each routed outcome clears the node and sets the next one, or ends the call.
- Unreachable turn nodes, the conditions that depend on them, and endings this call can't reach are pruned per call. A choice that needs a mark this call can never set is dropped, and so are the marks only it could set (repeated until nothing more drops).
- A call whose scene room, other rooms, routes or walk-outs don't fit the building throws, and hosting moves it to another seed.
- Rooms are tried in the tree's order of fit, and the board only draws a tree to the building types it lists (`SCENARIO_TYPES_V13`).
- The squad range is derived, never authored: a call deploys at most as many squads as one of its choices can put to work (`squadsPutToWork`, scenario-types.ts: acting squads plus supporters, or the count a choice requires). Tree choices compile one acting squad and no support rule, so every v13 call takes one squad (2026-10-18). A second squad would stand by the whole call, taking strain and earning nothing. Multi-squad calls come back when a tree authors choices a second squad can act in.

## Authoring rules the gates enforce

`src/gen/incident/trees-v13/call-trees.test.ts` runs on every tree:

- Only tactical frameworks are dispatched, and every tree is one of them.
- Unique ids, a root in stage 1, a `handed_over` ending, and situations that settle every hidden fact.
- Two or more choices at every node, at least one with no requirement and no condition.
- Every band routes forward to a real node or ending, never back to its own node or an earlier stage, and every node is reachable.
- Every mark set is read somewhere, and every mark read is set somewhere.
- The choices at a node have different futures: another node, another ending, or an option only they open.
- Only known role tokens, `{place}`, and `{lead}` in summaries. No dashes, and colons only in clock times.
- Every call generates on 60 drawn seeds: roles as engine keys, no unbound token, the scene in a listed building and room type, and every turn drawn.
- Every path through the engine: a pick never leaves its siblings, no dead ends, one node at a time.
- Civilian names share nothing with the officer catalog.

The existing content gates (playability, two choices per stage, distinctness, validation) also run on trees.

## Measured on v13

| Call | Siblings left after a pick | Same next menu | Stage-3 menus | Dead ends |
| --- | --- | --- | --- | --- |
| Hostage crisis (v12 story) | 84% | 25% | 16 | 0 |
| Hostage crisis (tree) | 0% | 10% | 10 | 0 |
| Barricade (v12 story) | 87% | 13% | 51 | 0 |
| Barricade (tree) | 0% | 0% | 5 | 0 |

Armed incident and protected rescue were converted the same day and pass the same gates (no leftover siblings, no dead ends, one node at a time).

Fewer stage-3 menus is intended: the old count was flag combinations in one large pool, and the tree's are distinct nodes and branch-specific options.

## Harm and weight

Calls are meant to feel heavy. People can be hurt or die when choices or dice go wrong; nothing is graphic, and preserving life is what the game rewards.

- **Officer injury** (`officer: 'wounded' | 'serious'` on an outcome): an officer taking part is out of action for the rest of the call and for hours after it (2 or 8). The roster feels it.
- **Civilian and subject harm** (`harm: { role: 'wounded' | 'serious' | 'fatal' }`): recorded as a person casualty through the engine's `personHarm` effect (v13), the same record the force path makes. The debrief shows the person injured or dead, and civilian safety drops. The save validator accepts a record only if the action's band can produce it. The engine refuses ordinary choices involving a person once they are hurt, so harm sits on outcomes that end the call or move to a node that doesn't involve them; the engine walk in the gates proves there is no dead end.
- **Harm costs completion.** An ending reached with anyone hurt, killed or awaiting transport is partial, not complete (`completionEvidence`, v13): the debrief lists who still needs care, and completion rewards are withheld. Before v13 the engine held such calls open waiting for care steps; a tree call now ends where it says it ends.
- **Situations punish the wrong instinct.** Each call has a situation where waiting is right, one where acting is right, and one where neither is free (the door that won't hold, the oxygen that runs out, the owner who collapses, the man who won't relent). The cue is always reachable first: asking about the door, hearing from the owner, asking the resident what they need.
- **Deaths** are possible only where the premise carries them: the worker when he gets through her door, the armed man when he raises the handgun at close range, the resident crossing open ground under fire or when their oxygen runs out in the hallway, the owner when an entry meets a man who won't let her go. Each is one plain sentence, the person's state first, and team force goes to review (ethics E2.1, E2.2).
- **No death on the card where the self-harm screen applies** (E4.5). The barricade subject and the hostage taker both screen in (a breakup under a protective order and a lost apartment; a firing and a public accusation). The barricade's worst force outcome is the subject shot and taken by the crew with the medic still working (`subject_shot`); no path kills the taker.
- **Firing at the team is a decision point, not an ending.** When the taker or the barricade subject shoots an officer, the call moves to `fired_on`: go in at a harder check, or hold and call him, with the officer out of action either way.
- **Previews name the worst result their band can produce** in any situation ("The team reaches her late. She can be badly hurt or killed."), and no preview promises something a hidden truth can take away.
- **Long holds say how long they take.** A hold the results measure in hours carries `span` ('Hours' or 'All night'); the card shows that instead of minutes. The clock still advances by the choice's minutes so pressure and civilian safety stay fair to the wait.

## Balance

`src/gen/incident/trees-v13/balance.ts` plays calls through the real engine with real dice and a different day-one squad each time, under four player styles: random (a stand-in for the average player), best odds, patient (the longest choice as written) and fast (the shortest as written). Patient and fast read the minutes a choice is written to take, not the operation time the card shows, which includes the walk through the building (2026-10-18). `call-tree-balance.test.ts` holds each call to its band at tier 2; the seeds are fixed, so the numbers are exact for the content as written.

Target per call for the average player: about a third clean, a third resolved at a cost, the rest unresolved, hurt or dead; deaths in a few percent of calls, most of them armed incidents. Measured on 2026-10-07 (random style, 120 calls):

| Call | Tier | Clean | Costly | Unresolved | Hurt | Died | Officer hurt |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Hostage | 1 / 3 | 34% / 28% | 35% / 27% | 23% / 32% | 8% / 13% | 0% / 0% | 1% / 1% |
| Barricade | 1 / 3 | 33% / 27% | 38% / 33% | 24% / 32% | 5% / 9% | 0% / 0% | 1% / 3% |
| Armed incident | 1 / 3 | 46% / 34% | 23% / 20% | 3% / 5% | 22% / 28% | 7% / 13% | 21% / 25% |
| Protected rescue | 1 / 3 | 43% / 39% | 25% / 20% | 3% / 1% | 27% / 38% | 3% / 3% | 5% / 10% |

Re-measured after the second-reader pass (same day). The day-one calls (hostage, barricade) mostly fail as stalemates, someone still inside; the barricade no longer kills anyone, and its weight is the son left behind the door, the son hurt in an entry, and the officer shot on the step. The calls a department unlocks later carry more harm. Rushing an armed man hurts officers in about half of calls (fast style: 45 to 56%); waiting him out when her door is splitting is what kills her. Each tree sets its own `difficulty` from these runs, never by feel.

To re-measure after a content change, run the simulator from a script (see `measure` in `balance.ts`), the gate, or Outcomes in the Scenario Lab.

## Second-reader pass

A separate reader walked every path of all four trees through the engine, for every situation and turn draw, and bound the text on 120 to 200 generated calls per type (20 blockers, 64 should-fix, 5 polish). All were applied on 2026-10-07. The ones that changed structure:

- Hostage: `held_both` when the courier is still inside at a held ending; `fired_on` after he shoots at the glass; `back_promised` closes the front-door exit once command has promised the alley; his account is marked on every branch that writes it, so reading it back opens.
- Barricade: `subject_shot` replaces `subject_killed` (E4.5); `fired_on` after he shoots the officer on the step; the written message goes in the report, not to her.
- Armed incident: drawn only to shops, bars and the motel front desk (offices and warehouses have no drawer to rob), with the man placed at the counter; harm moved off an outcome that didn't end the call.
- Protected rescue: `tank_ran_out` for the hallway oxygen death; houses only (the crossing is a porch, a step and a lawn); every gunfire preview holds when he can't see the door.

Still owed (owner calls): a human read of each death (`owner_killed`, `worker_killed`, armed `subject_killed`, `resident_killed`, `tank_ran_out`); the E4.7 content note and 988 debrief line for hostage and barricade; whether a team holding outside an active shooter fits E12; and whether the barricade keeps its apartment family.

## Tools

- **Scenario Lab** (`npm run lab`, `/lab?type=<type>`, Lab link in the campaign bar and Open in lab on a live call in dev; guide in [scenario-lab.md](scenario-lab.md)): rebuilt on 2026-10-09 around the real game screens. Play steps any call on the engine with the hidden truth, odds and routes beside the frame; Flow draws every node by stage with this call's turn draws and how often runs take each route; Outcomes gives ending shares by play style and the CI gate; Dependencies lints the marks; Script reads every line in every variant; Tuning changes the game's numbers. Old `/story.html` links redirect to `/lab` in dev.
- The engine walk used for the table above is the gate test's last block. In the lab, Outcomes with population "This type" and 60 calls equals `measure` for the same style, and Play here finds the shortest path to any node or ending.

## Next

1. More tactical frameworks, each a tree, so the board has more than four kinds of call. Department levels no longer open new kinds of call; new frameworks can carry level gates again.
2. Give the retired patrol frameworks a home under the Watch Commander as idle patrol work (`docs/game-ux-direction.md`, Command Staff), or delete them.
3. Force in trees: a `forceProfile` choice needs the v7 harm and person-care chain. Trees today keep the team staged and gate entry on a visible threat, with its cost in trust, strain and who gets hurt.
