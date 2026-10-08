# Incident domain model: standardize what a scenario is, then generate, resolve, narrate and review from it

**Status:** approved 2026-10-07. Milestone 1 done 2026-10-07. Milestone 2 done 2026-10-08 (slices 1 to 5, with the hostage pilot). Next: M3 to M5 under the model-first plan change below; start each in a fresh session. Defaults D1 to D5 stand unless the owner changes them.

**Correction found in M2 (2026-10-07):** `src/sim/threat.ts` (`threatFx`, `subjectsFor` and the rest) is not wired into resolution; nothing imports it. The plan assumed it ran. M2 reuses its pure scoring rules (`threatFx`, `relevantSubjects`) fed from the incident instance, and does not revive its parallel person system (`run.people`, `movePeople`), which would run a second person model beside the story bindings.

**M2 slice 1, people and place in the odds (done):**
- **Instance to engine.** The compiled scenario carries `incidentPeople` (`IncidentPersonDef`, scenario-types.ts), emitted by `incidentPeopleFor` (instance.ts). `validateScenario` requires each person to be story-bound, standing where the story puts them, and reading real facts.
- **`sim/incident-factors.ts` in `evaluateAction`**, after authored modifiers, so every factor is a labelled contributor on the card and in the debrief:
  - armament and readiness by kind of work (an entry feels a handgun at about 13 points, talk about 5);
  - temper, once a fact reveals it;
  - awareness, for entries and observation;
  - what waiting does by intent (helps against a barricade, costs against someone seeking a victim);
  - cover: furniture between an armed person and the door into their room (`coverOnLine`, spatial-factors.ts; hard cover 6, concealment 3).
- **What counts.** Every subject inside counts, with the nearest first; someone out with the team no longer counts. The odds use what the team knows: a weapon is reported or an unknown risk, and a temper counts only when revealed. Hidden truth still decides which authored result happens.
- **Re-tuned with the simulator.** Hostage base 40, barricade 40, armed 32, and the armed call's talk-through at +14. All bands hold at tier 2.
- **Gates.** `sim/incident-factors.test.ts` checks the same action with one thing changed: cover vs none, weapon known vs unknown, temper hidden vs revealed, subject inside vs out, waiting on a barricade vs on someone seeking a victim.

**M2 slice 2, incoming fire and team force (done):**
- **Drawn consequences** (`sim/drawn-effects.ts`). An outcome effect can carry `drawn` and `variants`. At commit the engine draws once per drawn effect, from its own saved sample, picks a variant, and applies it as if authored. Versions without drawn effects keep their one-draw sequence. Save validators, `validateScenario`, the story-binding check and the text binder all see variants.
- **Incoming fire** (`INCOMING_FIRE_V1`). Whether an officer is missed, wounded or seriously hurt depends on:
  - the subject's weapon, real or replica;
  - their accuracy, drawn per call from the template;
  - their distance to the door the team comes through;
  - cover.

  The shield rule still applies after. Officers are never killed.
- **Team force** (`TEAM_FORCE_V1`).
  - Firearm against a gun in hand.
  - Otherwise less-lethal when the acting squads carry it with a trained officer, the person is in range of the door (device 15 ft, launcher 60 ft), no hard cover blocks the line, and no held person or child is within 6 ft.
  - Severity comes from `FORCE_RISK_V1`, unchanged. A minor, or a subject the self-harm screen covers (`noDeathOnCard`: the hostage taker and the barricade subject), is never killed.
  - The ending follows the severity: killed, hurt, or taken unhurt on a miss.
- **Content.** Tree outcomes write `fire: { from }` or `force: { on, next }`; their own text sets up the moment, and a standard line (`content/incidents/lines.ts`, under the identity gates) says what happened.
  - The hostage, barricade and armed calls were converted.
  - Previews now say an officer "may be hit".
  - The armed call's "get the officer to the medic" choice needs an officer actually down, and a "regroup" choice covers a miss.
  - The force endings no longer say "shot".
- **Tuning.** Armed base 34, giving 38% clean, 9% with a death, and officers hurt in 36% of fast-style calls.
- **Tests.** `sim/drawn-effects.test.ts` covers the model rules, plus real armed and barricade calls played fast with every save validated after every decision.
- **Not yet:**
  - The rescue's shooter is offsite and has no position, so its gunfire stays authored until sightlines exist.
  - Less-lethal use doesn't spend cartridges yet.
  - The debrief doesn't say which force was used or why. The reason is computed (`teamForceProfile`) but not shown.

**M2 slice 3, clocks and meters (done 2026-10-07):**
- **Clocks** (`sim/clocks.ts`, `CLOCK_RULES_V1`). The instance's clocks reach the engine as `scenario.clocks` (`clocksFor`, instance.ts), with each call's rate drawn within the template's `rateSpread`. The run keeps each clock's value and how many cues have fired (`run.clocks`). Operation minutes run them in `advanceTime`, resupply included. A clock stops once its owner is out.
- **Cues.** Each cue fires once, after the decision's own outcome: a result line, an optional mark, and an optional settling of the clock's fact. A cue stays silent when its mark is already set or its fact already settled, so it never repeats what the outcome just said.
- **No outcome without a warning (§13).** A clock can't run out before the team heard one of its cues in an earlier decision. One long wait from a silent start stops it just short and fires the cue; the next decision can run it out.
- **Forks.** Tree outcomes read `if: { clock, out }` or `if: { clock, low }`, evaluated at the end of the choice's own minutes for its band plus the outcome's minutes. Rates stay facts (asking about the door tells you which door you have); events are forks.
  - **Armed.** `doorFork` reads the door. A splitting frame gives about 20 minutes in (±25%), and the worker says so on the line about 6 minutes in (cue, `door_weak`, settles `door_holds`). A holding door outlasts any call. The holds branch no longer reveals the fact or sets `door_strong`, which had claimed the bolt held in the splitting situation.
  - **Rescue.** Waits read the tank gauge (`gauge`, `low`), the all-night wait reads it empty (`empty`, `out`); asking stays a fact (`breath`). A short tank lasts about 40 minutes (±20%). Cues: the needle in the red (`running_low`), then the hiss stopping (`tank_empty`, read by two new prompts).
  - **Hostage.** The long holds read the owner's condition. An unwell owner shows the first sign through the glass within a few minutes (`owner_unwell`) and the clock runs out about half an hour in (±25%), because the holds narrate hours in 30 to 40 engine minutes.
  - **Barricade.** The phone battery stays a story clock (`story: true`): the tree's own outcomes still run it down.
- **Meters** (`sim/meters.ts`, `METERS_V1`). Subjects reach the engine with agitation, rapport and volatility. The run keeps them (`run.meters`) and what each kind of event moved. Outcomes write `moves: { role: event }` (heard, contact, honest, provoked, team_seen, shots, released), scaled by volatility (steady 0.6, shifting 1, volatile 1.5) and clamped 0 to 100.
  - Every contact check with the subject (`action.talksTo`, or every subject inside when the check talks to nobody) shows what moved since the call began as two contributors: "is talking to you more or less" and "is more worked up now" or "is steadier now".
  - The mood modifiers (`stung`, `heard`, `talking`, `told_no`, `limit_told`) were replaced by events on 38 outcomes. Marks stay where prompts or choices read them as facts (`stung` in the hostage "hung up" prompts, `talking`).
- **Player view.** "People at this call" shows a subject's stance once the team has heard from them, and a clock once one of its cues has fired, so it never shows what the team can't know.
- **Lab.** The instance panel shows each clock's drawn rate, when it runs out, each cue's minute, mark and reveal, and subject meters. The step-through shows live clocks and meters. Coverage counts both sides of a clock fork where the situation's clock can reach it.
- **Gates.** `sim/clocks.test.ts` (model rules, the same choice before and after the cue, a holding door never giving, the cue said once, saves). `sim/meters.test.ts` (volatility, clamping, contributors, odds after heard vs provoked, other people's conversations untouched). Call-tree gates for clock forks, reveal cues and cue marks; the path walk tells clock states apart. Clock labels and cues join the string gates and `check:strings` rows.
- **Balance (tier 2, random style):** hostage 32% clean, harm 5%, deaths 1.7%; barricade 30% clean, harm 12%; armed 38% clean, harm 35%, deaths 10%; rescue 47% clean, harm 32%, deaths 5%. Waiting out an unwell owner now costs them in 12% of patient calls.
- **Not yet:**
  - A clock that runs out where no fork reads it changes nothing on the record (the tank emptying during a crossing records no harm). The casualty model (M4) and the coverage gate (slice 5) close this.
  - Time doesn't move meters, and meters don't drive escalation yet (slice 5). `shots` and `released` are defined but not yet written into content.
  - Promises as commitments are slice 4.

**M2 slice 4, authorization and scoring (done 2026-10-07):**
- **Authorization** (`sim/authorization.ts`, `AUTHORIZATION_V1`), from what the team believes:
  - An entry is authorized on a seen threat to life: a threat fact the team believes (`TreeFact.threat`) or a threat mark (`CallTree.threatMarks`). It is also authorized once an `urgent` clock is low.
  - Concessions are allowed (food, water, phone, statement, message, third party, surrender terms) or never (weapon, transport, officer swap, family).
  - Choices declare `authority`. Unauthorized, a choice is locked with the generated reason. Authorized, the card carries the generated command line ("Command approves it because …"), so summaries no longer say it.
- **Deadly force** (`teamForceProfile`): the firearm only on a gun in hand the team believes in, or a weapon within reach of someone. Otherwise less-lethal, and when neither applies a new `hands` profile (never fatal, `FORCE_RISK_V1.hands`). Every force use records its rule and a plain reason.
- **Scoring** (`sim/outcome-score.ts`, `OUTCOME_SCORE_V1`). One function sets a v13 debrief's disposition, trust, closing strain and rewards factor from people's end states in priority-of-life order (held, trapped, bystanders, officers, subjects), force used, entries, commitments, time and the objective. The debrief lists the lines and the force used, with who and why. Calibrated on 2,400 played calls against the retired hand-set numbers: trust within 0.5 on average, disposition agreeing on every call. Ending trust and strain are gone from the trees.
- **Commitments** (`sim/commitments.ts`). Made by a `promise` outcome or a granted concession. Broken by an entry or team force while open, kept when the person comes out. Kept and broken move the person's meters and the score.
- **Content.** All four calls tag entries, threat evidence, concessions and the hostage back-door promise. The authored command sentences are gone from summaries and threat prompts.
- **Fixes on the way.** Saves with a v13 run that had gunfire or force failed to load (slice 2): the saved-sample replay now counts drawn draws, applies drawn variants and reads clock forks. The career verdict reads the scored factor.
- **Gates.** `authorization.test.ts`, `outcome-score.test.ts` (calibration fixture, disposition agreement over played calls), `commitments.test.ts` (rule on every played call, every save loads), the path walk (an offered authority choice is authorized somewhere it is offered), and content gates (entries tagged, no never-concession, phrases pass the string checks).
- **Balance (tier 2, random style):** hostage 18% clean, harm 5%; barricade 28% clean, harm 12%; armed 17% clean, harm 35%, deaths 10%; rescue 42% clean, harm 32%. A long night or an entry now scores as costly rather than clean.
- **Owner calls:**
  - Some endings still say "goes to review", which the debrief now says. This is the open E2.1 vs prose-skill question from M1.
  - Resolved-with-harm now counts as complete, which raises department service about 10%.
  - An entry breaks every open commitment, including one made to a civilian.

**M2 slice 5 engine (done 2026-10-07; the pilot is below when it lands):**
- **Groups.** A template slot with a count range: its first person is the key role and leader; the rest are a counted tree role (`CallTree.groups`), numbered nearest the door first (`others_1…`). Each member is a full engine person: placed by `placeCast`, story-bound with a location fact and `out:` transition, in `incidentPeople` with threat, weapon (drawn per person), meters, volatility, `group` (role, influence) and `hold`. `compileIncident` (instance.ts) is the one emit path.
- **Count-aware text.** `{others}`, `{others.first}`, `{others.n}`, pronoun forms (plural for two or more), `{others#…|…}` after names, `{others~…|…}` after pronouns. `TreeState.count` is settled by the compiler (`treeForCounts`), so a lone call carries no group text. Gates bind every string at every size with every pronoun; a never-dispatched fixture call (`trees-v13/group-fixture.ts`) exercises them.
- **Cascade** (`CASCADE_V1`, drawn). Where the leader gives up, each member follows with 0.25 + 0.5 × influence + rapport − agitation terms (0.05 to 0.95), from one saved sample; followers come out, a standard line names them, and all/some/none route.
- **Escalation.** `TreeIf` meter branches (`stance`, `agitationAtLeast`, `is`), read at the start of the decision and replayed by `traceRun` and the save check.
- **Incident class** (`INCIDENT_CLASS_V1`). A victim incident (an expressive hold inside) costs 3 on waiting and scales the holder's "more worked up" contributor ×1.5; the current hostage call is one.
- **Clocks running out** (`onOut`). Harm to an owner still inside and a mark, unless the outcome already hurt them. The rescue tank uses it (serious, `tank_empty`); a hurt but living civilian can still be walked out.
- **Coverage gate** (`trees-v13/coverage.test.ts`). Walks every situation, pacing, turn, band, clock and meter bucket and drawn result through the engine: a commit that routes nowhere or twice, or carries no text, fails, as does a live state with no choice. 0 gaps on all four calls after fixing 12 armed and 7 rescue gaps.
- **Fixes on the way.** The turn draw now uses the hash's high bits (the low bit tied the armed turn to pacing). Marks a clock sets count as settable. Saves replay cascades.
- **Tuning note.** An entry now goes to review and costs trust, so a clean armed call means talking the shooter out; armed random-play clean sits at the 15% floor.

**M2 slice 5 pilot (2026-10-08):** "One Last Signature" rewritten model-first as a 1 to 3 subject call.
- **Sources.** Design sheet, prose record and review response in `docs/calls/hostage-signature-design.md`; the separate review in `docs/calls/hostage-signature-review.md`.
- **The group.** One or two coworkers from the taker's last shift came back to back the taker's story. They draw no weapon (60%) or something heavy from behind the counter. They are a follower or a lookout, with an influence that depends on the situation. Group sizes are 55/30/15.
- **Group choices.** Separating them, them walking the courier out, and a face-saving release of the owner, each offered only when there is a group. The taker's surrender carries a cascade whose all, some and none results lead to different nodes and endings.
- **Hostage vs victim.** The courier is the taker's opening offer, released as a bargain. Escalation only turns toward the owner. Releasing the owner always costs the taker something they came for. The engine prices waiting and provocation as a victim incident.
- **Models.** Stage 3 escalation reads the taker's meters. The owner's clock has `onOut`, so a collapse is recorded wherever it happens. Entries and concessions declare authority, the alley deal is a promise, and endings are scored.
- **Size.** 15 nodes, 46 choices, 327 outcomes, 20 endings, 3 situations, 3 turns. Coverage is 0 gaps, including a crossed walk over every situation, group size, turn and pacing (195,226 states).
- **Balance (tier 2, random):** 23% clean, harm 5%, deaths 1.7%; all four calls hold their bands. `check:strings` exits 0 for the call.
- **Review.** The separate read gave edit. On re-check 33 of 44 findings are closed, and its two new fix-before-freeze lines (NF1, NF2) are applied. The 11 left open are owner, engineering or skill-file items, plus notes NF3 to NF8. `npm run verify` passes (2,972 tests).
- **Not done from the review:** the skill-file budget fixes (N8 in `surface-budgets.md`, N20 in `swat-writing-review/SKILL.md`), the engineering notes N6, N7, N9, N15, N16 and N21, and notes NF3 to NF8 (passives, briefing sources, preview openers, a duplicate held-ending title).
- **Engine fixes from the review.**
  - Every `{lead}` is replaced.
  - A decision where someone is hurt or killed names it on the result chip, never "Went well".
  - Name, recipe, turn and age draws read the hash's high bits (`hashIndex`), so only about half the surnames were reachable before.
  - The slow-answer pacing line never applies to a subject (E4, R9).
  - The checker no longer counts a field as repeating itself.
- **Open for the owner:**
  - B9: the owner's condition exists only in one situation, so its cue tells a returning player the situation. Fixing it needs facts drawn per call.
  - O4 custody wording.
  - Human reads of the deaths, the beating and the surname spread.
  - O1 armed-lane words.
  - O2/R5: the content note and 988 line have no surface.
  - The time charge on all-night holds.
  - Whether the board clamps hooks at 3 lines.
  - Whether to accept the 6-decision stage 3 chain.
  - R-G1 to R-G4: a member's own weapon as a belief; role effects; count-conditioned briefing lines; `onOut.next`, so a collapse can route in the same decision.

**M2 slices as planned (all done):** 5. **Resolve then narrate, and the pilot.** Models settle state and text is chosen for it, with a coverage gate. The hostage call becomes a 1 to 3 subject call with group roles and a cascade.

**M2 slice 5 design (2026-10-07, before the work):**
- **Groups.** A template slot with a count range binds its first person to the key role (`taker`, the leader) and the rest to a counted tree role (`CallTree.groups`, for example `others`). Each counted person is a full engine person: placed on the map, story-bound with a location fact, an `incidentPeople` entry with threat, meters, volatility and a drawn group role (`leader`, `follower`, `lookout`) with influence. `out: ['others']` and `safe: ['others']` expand to every member.
- **Count-aware text.** `{others}` binds the members' names ("Sol" or "Sol and Ines"), `{others.n}` the count in words, `{others.they}` and the other pronoun forms the one member's pronoun or plural they, `{others~is|are}` singular for one member drawn he or she and plural otherwise. Text that names the group sits behind a count condition (`TreeState.count: { role, min?, max? }`) so a lone call never reads "and the others". Gates bind every string at each count the slot allows.
- **Cascade** (`sim/drawn-effects.ts`, `CASCADE_V1`). An outcome writes `cascade: { leader, group, next: { all, some, none } }` where the leader gives up. Each member follows with a chance from influence, rapport and agitation, drawn from its own saved sample; followers get `out:` flags; a standard line says who followed.
- **Escalation from meters.** `TreeIf` gains `{ meter: role, stance | agitationAtLeast }`, read at the start of the decision. A tree writes the escalation it means: the hidden truth decides, or a subject past breaking point does it anyway.
- **Incident class weights.** A victim incident (expressive hold) gets less from waiting and more from provocation than a hostage incident (instrumental hold), through one table in `sim/incident-factors.ts`.
- **Clocks that run out where no fork reads them.** `ClockDef.onOut` records harm to the owner while inside and sets a mark the tree's prompts read, so the record and the text agree.
- **Coverage gate.** A walk over every reachable state (situations, turns, bands, clock and stance buckets, drawn results) fails a decision that matches no routed outcome, two routed outcomes, or no text.
- **Pilot.** The hostage call becomes a 1 to 3 subject call through the writing skills (design sheet, prose, a separate review): the taker leads; a second or third person is a follower or lookout with a group role and their own weapon or none; choices can work on the group (talk to the follower, separate them); the courier is an incidental hostage and the owner the victim of the grievance, and the odds and the text treat them differently.

**M1 as delivered:**
- **Model and templates.** `src/content/incidents/` (types, one template per dispatched call). The templates describe only what each call's text establishes; nothing is invented to fill a field.
- **Generator.** `src/gen/incident/instance.ts`: `drawInstance`, `aggregates`, `signature`, `countTemplate`, `instanceOf`. Generation runs through instances, and `placeCast` (`trees-v13/compile.ts`) is the one place people are put on the building. The refactor was proven byte-identical on 92 compiled calls before any content changed (`compiled-fingerprints.test.ts`). The guard was then re-captured for the deliberate identity change below.
- **Identity.** Pronouns and ages are drawn per person (`IDENTITY_DEFAULT`). All four calls' prose was converted to pronoun, agreement and gendered-noun tokens. Gates fail any literal gendered word in calls or templates, bind every string with each role as he, she and they, and require identical mechanics whoever is drawn.
- **Scenario Lab** (`/story.html`, rebuilt). It has a catalog with counts, a draw bar, the instance (people with truth beside what the team knows, aggregates, clocks, conditions, and which fields the engine reads yet), the map, the story graph, real choice cards at any decision, a step-through on the engine, writing, balance in a worker, and review notes exported as markdown.
- **String checks.** The swat-call-prose Python checker stays the one implementation: it is written to work inside the skill on any harness, so porting it would make a second copy. `npm run check:strings` and the lab's Writing tab (through a dev-server endpoint in `vite.config.ts`) both send it rows from `trees-v13/strings.ts`, bound with real casts. The Writing tab can bind everyone as he, she or they to find sentences that turn ambiguous when two people share pronouns.

**M1 findings carried into M2 and the writing pass:**
- **String checker backlog.** The checker reports blocking findings on all four calls, mostly repeated 4-word runs and path echoes, plus a few unsafe-detail hits. It also flags the "goes to review" ending line that the call-design ethics rule (E2.1) requires; the two skills disagree, which needs an owner call. Its path-echo rule splits accented names.
- **Shared pronouns.** 389 sentences carry a pronoun and two or more people. They are grammatical in every draw (gated), and most read fine because one person is named, but some turn ambiguous when two people share pronouns. They need a read in the lab with "read everyone as".

**Changes during M1 (owner direction, 2026-10-07):**
- **Identity is drawn per person, never by role.** Pronouns (he, she, they) come from one distribution for every kind of person (`IDENTITY_DEFAULT`), so a subject is as likely to be a woman as a hostage is. Age comes from the template where the story supports it, and minors can be subjects. No mechanic reads pronouns or names. Prose uses pronoun, agreement and gendered-noun tokens, and a gate forbids literal gendered words in call text.
- **Who the subject is can be unknown.** `kind` is a belief like any other (§4). Several people can be inside with the subject unidentified and possibly armed; force is never authorized on an unidentified person, and mistaking a held person for the subject is a possible result once milestone 2 resolves it.
- **Minors are never killed**, whatever their kind, subjects included.
- **Paths.** The model lives in `src/content/incidents/` (`src/content/scenarios/` already holds two legacy hand-authored scenarios). The writing checks extend the existing TypeScript linter in `src/gen/incident/gates/` instead of adding a new module.

## Context

The owner wants:
- a dev review interface that isn't rough;
- crafted scenarios with alternate decision points, outcomes and depth, written through the writing skills;
- thousands of genuinely different scenarios.

They want every part of an incident standardized and defined in the data model and the application logic. That covers how many subjects, armed or not, weapons, violence, accuracy, warrants, roles in a group, variance, hostages (what makes someone one), children and pets, and location: cover, engagement, lethal vs non-lethal. A scenario should happen in many locations, each adding its own variation. Bad outcomes are part of the job.

This plan replaces the earlier drafts. Those drafts bolted attributes onto today's fixed call trees, so the data model followed the story. Here the story follows the data model.

### Where we are (measured 2026-10-07)

| Measure | Now |
| --- | --- |
| Dispatched call types | 4 call trees: hostage, barricade, armed incident, protected rescue |
| Distinct setups (hidden-truth situation × mid-call turn) | 33 (66 with the answer-pacing variant) |
| Decision points / choices / endings | 39 / 109 / 37 |
| Choice-and-dice sequences | about 200,000 |
| Cast per call | Fixed 2 or 3 named roles, exactly one subject, one weapon |
| Location effect on odds | None for tree calls |

**The engine has more than tree calls use:**
- `PersonDefinition` and `ThreatProfile` (`src/sim/scenario-types.ts`), with roles including `held_person`, `child`, `dog`, `dangerous_dog`, and reported-vs-true values.
- `threatFx` (`src/sim/threat.ts`), with multi-subject seat weights.
- `EnvironmentDefinition`.
- Spatial contributors in `src/sim/resolution.ts`.
- `FORCE_RISK_V1` (`src/sim/force-risk.ts`).
- External services with arrival times.
- Officer stress, injury recovery, certs, traits and roles (`src/sim/types.ts`).

`withCallTree` (`src/gen/incident/trees-v13/compile.ts`) deletes `s.people`, neutralizes the environment, and compiles choices with none of the spatial, entry or force inputs.

### Owner decisions so far
- Children can be hurt, never killed.
- Pets can be hurt or killed, rarely.
- The lab comes first.
- New call types: high-risk warrant, robbery in progress, vehicle standoff, crisis barricade.
- Standing rules: E4.5, non-graphic text, force only on a visible threat, preserving life is the value.

## Challenge: what the previous drafts got wrong or left out

Each finding is written from the player's seat, followed by the model's answer.

1. **"Hostage" was never defined. The current hostage call mixes two different incidents.**
   - The owner is the target of the taker's grievance. The courier is incidental.
   - The standard negotiation distinction applies (inference from doctrine, not a cited source):
     - A **hostage** is held as leverage for demands made to police.
     - A **victim** is held by someone with an emotional motive and no substantive demand. Time helps in the first and helps much less in the second.
   - The player can't learn that pattern if the game doesn't model it.
   - → A people taxonomy with hold types (§1). The incident class is computed from the cast, not labelled per tree.
2. **Counts without meaning are noise.** "7 armed" only matters if the player can see it, plan for it, and feel it in the outcome. Hidden variables that only shift dice read as randomness.
   - → Every attribute has a knowledge state and a way to learn it (§4). Every model input surfaces as a labeled contributor, with the top three shown in play and the full list in the lab.
3. **"20 subjects" breaks a three-decision call and a corner store.**
   - → Counts are bounded by the template, the location's capacity, and the scale class:

     | Scale class | Subjects | Where |
     | --- | --- | --- |
     | Lone | 1 | anywhere |
     | Pair | 2 | anywhere |
     | Small group | 3 to 4 | anywhere it fits |
     | Group | 5 to 8 | large locations, two or more squads, up to 5 decisions |

   - Larger operations (compounds, multi-building) are a separate future mode (decision D3).
4. **Variance was one word for two things.**
   - Spread in what is drawn is distributions (§1).
   - Volatility during the call is state that moves.
   - Today state is ad-hoc marks such as `stung` and `heard`, invented per tree.
   - → Standard per-person meters and commitments (§2).
5. **Many hidden facts are really clocks:** the door splitting, the oxygen tank, the owner's chest, the son's battery, falling darkness, a demand deadline.
   - Authored as yes/no truths, they can't vary in rate, and the player can't watch them run down.
   - → Standard clocks with cues (§3).
6. **Text and model can contradict each other.** The second-reader review found "safe" endings for people the engine listed as hurt, and harm on outcomes that didn't end the call. Adding models (incoming fire, escalation, cascade) multiplies that risk.
   - → Resolve, then narrate: models settle what happened, then authored text is selected for the resolved state. A coverage gate fails any reachable state with no text (§8).
7. **"Command approves" is ad-hoc prose.** Each author decides when entry or force is authorized, so the rules of engagement drift between calls.
   - → An authorization policy evaluated from state. The command line in each summary is generated from the rule that fired (§7).
8. **Endings are hand-scored.** Trust −6 here and −4 there were chosen by feel, and the player can't learn what the department values.
   - → One scoring function over people's end states, in priority-of-life order. Authors write titles and text, not numbers (§9).
9. **Location was a modifier list.** Cover, exits, glass and neighbours are properties of the place. The team's own positioning (staging, which already exists) decides containment and escape.
   - → Location semantics plus containment (§5).
10. **The department game was disconnected.** Gear, certs and support assets should be what the scenario asks for: a dog needs less-lethal or K9, a held person needs a negotiator, trained shooters need shields and armour, darkness needs thermal.
    - → Requirements emerge from attributes. The call card shows the assessed risk and the suggested capabilities, so choosing which call to take and whom to send becomes the management game (§11).
11. **Aftermath was missing.**
    - Officer-involved shootings, critical-incident stress, a subject who flees, an unresolved call handed over: none of these carry forward today, except injury hours.
    - → Aftermath model (§10).
12. **"Thousands" was counted as raw combinations.** A 2% odds shift isn't a different scenario to a player.
    - → Distinctness is defined by what changes for the player: available choices, branching, or the outcome distribution beyond a threshold. Report those counts honestly (§12).
13. **Fairness and ethics were left to authors.**
    - With drawn attributes, a call can become unwinnable by accident.
    - Identity can leak into odds through name pools.
    - → Invariants enforced in code and gates (§13). No instance where best play has no favorable path unless it is flagged and telegraphed on the card.
14. **Medical was static.** Harm is a final label. A serious wound has no deterioration and no care decision, though "treat our officer first" is already a dilemma in the armed call.
    - → Casualty and care model (§6).
15. **Weapons were one enum per person.** The model has no replica or unknown weapon, no weapon in another room, no count, and no reach. A reported gun that turns out to be a replica is a classic real-world ambiguity.
    - → Weapon objects with truth and report (§1).
16. **Call length was fixed at three stages.** More complex incidents need room.
    - → Two to five decisions, scaled by complexity, keeping idle pacing (§8).

## The domain model (standardized)

### §1 People, holds, weapons, animals

Every person has a `kind`, which is what they are to the incident:

| `kind` | Definition |
| --- | --- |
| `subject` | Their actions are why the team was called. Has a threat profile, meters, demands and a group role. |
| `hostage` | Held against their will as leverage for demands made to police or a third party (`hold.kind: 'instrumental'`). |
| `victim` | Held or threatened by a subject whose grievance or emotion targets them, with no substantive demand (`hold.kind: 'expressive'`). Highest risk; time is not a reliable ally. |
| `trapped` | Inside but not held: hiding, unaware, or unable to leave (the son, the worker, the resident). `subjectAware` may be false. |
| `bystander` | Nearby, not held: customers, neighbours, the crowd. |
| `reporting_party` | Caller, family member or witness. An information source that may be wrong, and never on the line with the subject. |
| `animal` | Pet or working animal. |

```ts
interface Person {
  id: Id; kind: PersonKind; label: string;
  age: 'infant' | 'child' | 'teen' | 'adult' | 'elderly';
  mobility: 'normal' | 'limited' | 'chair' | 'immobile';
  needs: ('oxygen' | 'medication' | 'cardiac' | 'hearing' | 'language')[];
  position: { spaceId: Id; at: Vec; placement: Placement };   // placement computed from geometry (§5)
  hold?: { by: Id; kind: 'instrumental' | 'expressive' | 'incidental'; restraint: 'free' | 'watched' | 'restrained' | 'shielded'; relationship: Relationship };
  threat?: ThreatProfile;                                      // existing: armament, readiness, disposition, intent, awareness
  weapons: Weapon[];
  proficiency?: 'untrained' | 'some' | 'trained';              // accuracy under stress
  record?: { warrant: 'none' | 'minor' | 'violent_felony'; priorViolence: boolean };
  group?: { id: Id; role: 'leader' | 'follower' | 'lookout' | 'lone'; influence: number };
  demands?: Demand[];
  meters: Meters; knowledge: Knowledge<Person>;                // §2, §4
  animal?: { size: 'small' | 'large'; temperament: 'friendly' | 'protective' | 'aggressive'; owner?: Id; contained: boolean };
}
interface Weapon { kind: 'handgun' | 'long_gun' | 'shotgun' | 'edged' | 'blunt' | 'improvised';
  real: 'real' | 'replica' | 'unknown'; where: 'in_hand' | 'within_reach' | Id; visible: boolean; rangeFt: number }
interface Demand { kind: 'expressive' | 'statement' | 'person' | 'transport' | 'item' | 'none';
  deadline?: ClockRef; concedable: boolean /* from policy §7 */ }
```

**Incident class** is derived, never labelled:
- any `instrumental` hold with demands → hostage incident;
- any `expressive` hold → victim incident;
- a subject who is not holding anyone → barricade (with or without `trapped` people);
- a subject actively harming or seeking people → active threat;
- civilians at risk from an outside threat → rescue.

The class selects the doctrine weights, for example how much time and rapport help.

### §2 State that moves: meters and commitments

**Per subject** (0 to 100): `agitation`, `rapport` (with the team), `fatigue`, `intoxication`, `resolve`.
- The stance is derived from the meters: calm, tense, volatile, breaking or yielding.
- Volatility is how far events move the meters.

**Per held or trapped person:** `condition` (health) and `composure`. Low composure risks bolting or intervening.

**Standard events move the meters:**
- team seen;
- demand refused or met;
- a promise kept or broken;
- time passing;
- a shot fired;
- a person released.

**Commitments** replace one-off marks for promises such as `back_promised`. Command made them, and breaking one costs rapport and trust.

**Marks remain** only for discrete facts the team has learned.

### §3 Clocks

```ts
interface Clock { id: Id; subject: Id; kind: 'medical' | 'structural' | 'battery' | 'supply' | 'deadline' | 'light' | 'crowd' | 'intoxication';
  startsAt: number; ratePerMin: number /* hidden or known */; cues: { at: number; text: string }[]; onExpire: Effect[] }
```

Examples:
- `door_holds` becomes a structural clock with a hidden rate;
- `oxygen_low` becomes a supply clock;
- `owner_faint` becomes a medical clock.

The player watches cues. Situations set rates, not booleans.

### §4 Knowledge

Every attribute is `{ truth, belief: { value, status: 'confirmed' | 'reported' | 'assumed' | 'unknown', source, at } }`.

- **Sources:** dispatch, reporting party, talking, observation through openings, records check, drone, thermal, CCTV.
- **Dispatch error rate** is a template parameter. For example, "alone" when there is a child, or "gun" when it is a replica.
- **The briefing and call card** are generated from beliefs.
- **The engine** already resolves on truth and displays belief (`threat.ts` header). This extends that pattern to every attribute.

### §5 Location semantics and containment

- **Furniture.** Gains `cover: 'hard' | 'soft' | 'none'` (counter, appliance, bed).
- **Openings.** Have `glazing`, `material`, `lockable`.
- **Spaces.** Have floor, exits and tags.
- **Exterior.** Setback, street, parked cars and occupied neighbours (collateral).
- **Derived per person:**
  - `placement` (behind cover, doorway, window, deep, upstairs, shielded by a held person);
  - sightlines;
  - exposed approach in feet;
  - exits from their room;
  - nearest vulnerable person;
  - backstop (what is behind them on the team's line of fire).
- **Containment.**
  - Exits are covered or uncovered by the team's staging, which already exists in pre-op positions.
  - An uncovered exit plus an escape intent means the subject can flee.
- **Variation.** A template runs in many location families. Each family yields seeded layouts, and placement is computed per layout, so the same template plays differently in a corner store, a bar and a motel lobby.

### §6 Force, incoming fire, casualties and care

- **Team force** keeps the `FORCE_RISK_V1` severity tables, free of story truth.
  - Geometry and people decide eligibility:
    - less-lethal needs range and line of sight;
    - it is contraindicated with a child or held person within N ft, an elevated position, or a shielded hold;
    - the backstop is checked.
  - Ineligible less-lethal leaves only firearm or no-force options.
- **Incoming fire** is a new model (`src/sim/incoming-risk.ts`, mirroring `force-risk.ts`). When an outcome resolves to an exchange of fire, the model draws officer and bystander harm from:
  - proficiency;
  - weapon kind and range;
  - distance and cover;
  - shield and armour (`selectedProtection` exists).
- **Casualty scale:** minor, wounded, serious, critical, fatal.
  - Serious and critical start a medical clock.
  - Care actions (team medic, EMS arrival) stop or slow the clock.
  - Ethics clamps:
    - children cap at serious;
    - E4.5 subjects cap at critical, and are never shown dying;
    - pet deaths are rare and cost trust.

### §7 Authorization (rules of engagement and policy)

One rule table, evaluated from beliefs:
- **Entry** is authorized on a visible imminent threat to life, or when a clock will expire before talking can work.
- **Deadly force** only on an imminent threat to life seen by an officer.
- **Concessions:**
  - allowed: food, water, a phone, a written statement, a non-family third party;
  - never: weapons, transport out, officer swaps, family on the line.
- **Choice summaries** carry the generated reason ("Command approves it because …").
- **Choices with no authorization** show as locked, with the reason.

### §8 Choices and resolution

**Standard verbs:**
- contact;
- negotiate (offer or concede within policy);
- observe;
- records check;
- contain (cover an exit);
- evacuate or extract a person;
- move closer;
- deploy less-lethal;
- entry (deliberate or dynamic);
- treat a casualty;
- request support (K9, EMS, negotiator, armoured vehicle, precision support);
- hold;
- withdraw.

Each verb has a standard engine mapping, a standard set of inputs it reads (§1 to §6), a risk class and an authorization rule. A template chooses verbs, sets parameters and writes text. This replaces per-tree `check`, `difficulty` and `consequenceLevel` guesses.

**Resolution, in order:**
1. The check settles the band.
2. The models run: escalation from meters and volatility, incoming fire, force risk, group cascade, clocks, movement and flight.
3. The resolved state is final.
4. The text variant whose conditions match the resolved state is selected (band × truths × aggregates × model results).
5. The coverage gate fails any reachable resolved state without text.

**Call length:** two to five decisions, from assess, adapt and resolve plus optional nodes, scaled by the scale class.

### §9 Outcomes and scoring

- **Each person ends in a state:**
  - safe;
  - hurt (by severity);
  - killed;
  - still inside;
  - in the team's hands;
  - fled;
  - released.
- **One scoring function** sets disposition, trust, strain and rewards from:
  - those end states, weighted in priority-of-life order (hostages, victims and trapped civilians, then bystanders, then officers, then subjects; every life costs);
  - the force used;
  - commitments kept or broken;
  - elapsed time;
  - objectives.
- **Weights** live in one table (`src/sim/outcome-score.ts`).
- **Endings** are authored titles and text, selected by end-state conditions.

### §10 Aftermath

- **Officer-involved shooting.** A review with an outcome that affects trust. The officer goes on administrative duty (unavailable N game hours, decision D4), and critical-incident stress rises.
- **Officer injury** keeps the existing recovery hours, plus stress.
- **A fled subject** creates a follow-up warrant call later (D2).
- **An unresolved or handed-over call** affects trust and the board.
- **Each aftermath event** writes a ledger fact for `swat-officer-stories`.

### §11 Board, risk assessment, department fit

- **The call card** shows the assessed risk from beliefs: subjects, armed, held, children, clocks, and the dispatch confidence.
- **Suggested capabilities** (negotiator, less-lethal, shield, thermal, K9, medic) are derived from attributes.
- **Tier** is computed from the instance, and rewards scale with assessed risk.
- **Command Staff auto-runs** (idle play) use the same verbs and policies as the balance simulator's player styles.

### §12 Templates, instances and the count

- `ScenarioTemplate` per call type (data in `src/content/scenarios/<type>.ts`) holds:
  - location rules (families, scene room types, capacity);
  - cast slots (kind, count range by scale class, attribute distributions);
  - condition distributions;
  - situations (as clock rates and truths);
  - allowed complications;
  - the story graph (nodes written against key roles and cast aggregates);
  - endings keyed to end states.
- **Key roles bind by rule.** For example, `taker` is the leader, or the lone subject. Prose names key roles. Everyone else is a counted group with count-aware tokens and plural agreement: `{subjects.n}`, `{others}`, `{armed.phrase}`.
- `drawInstance(template, seed)` produces an explicit, reviewable instance, which compiles to `ScenarioDefinition`.
- **Signature:** template, incident class, situation, turn, scale class, key placements, the hold mix, complications, and the clock-rate band.
- **Reported counts:**
  - distinct signatures;
  - *behaviourally distinct* signatures, where the best choice or the outcome distribution differs beyond a threshold.

  Building seed and names are counted separately as surface variety.

### §13 Invariants (code and gates, not author discipline)

- No identity or demographic input reaches any model. Pronoun draws use one distribution for every kind of person, enforced by a gate.
- Attribute draws are independent of name pools, with an E3 tally gate.
- No child death is reachable.
- E4.5 holds.
- Force is only authorized by §7.
- Family is never on the line.
- Held people never bargain.
- Non-graphic text, enforced by the writing checks.
- Every instance has a favorable path under best play, or is flagged no-win and telegraphed on the card.
- `scenario.people` and the story bindings come from one emitter and agree.

## Stress tests the model must pass (become gate cases)

| Case | Expected behaviour |
| --- | --- |
| 20 subjects drawn for a corner store | Impossible: capacity and scale class cap the draw at the template's maximum |
| The held person is the subject's own child | Victim incident (expressive hold), a child clamp, family-relationship text; less-lethal contraindicated nearby |
| Reported handgun is a replica | Belief shows a handgun and the odds use it; force on a replica still goes to review; the debrief explains |
| Leader surrenders in a 3-person group | The cascade draws whether followers follow, by influence; the text covers both |
| Leader is shot, followers remain | Meters spike for the followers; authorization re-evaluates; the story continues without the key role (role rebinding rule) |
| The dog belongs to the subject and is hurt | Subject agitation jumps; trust cost; text keyed to ownership |
| Every subject hostile and trained, at night, no thermal | High assessed risk on the card; best play still has a favorable path, or the call is flagged no-win |
| No subject armed | Force options are not authorized; weight comes from clocks, held people and time |
| Subject flees through an uncovered exit | "Fled" end state, follow-up call created, scoring cost; containment is shown before the call as a way to prevent it |
| Hostage panics and bolts | Composure meter fires a movement event; incoming-fire model if a subject fires; text covers it |
| An officer is down and only one squad is left | Verbs needing more squads lock with a reason; care-vs-continue dilemma via the medical clock |
| Medical clock on a hostage vs slow negotiation | Time helps rapport and hurts condition; the card shows both cues; no outcome comes without a cue |
| Crowd filming at night | Crowd clock grows; trust weighting of force rises; text keys to the crowd |
| Two subjects disagree about surrender | Group role and influence diverge; an outcome splits them; a verb opens to separate them (onlyIf on aggregates) |
| Vehicle standoff with a child passenger | Roadside family; cover is parked cars; child clamp; less-lethal range checked against the vehicle |
| Three adults inside, one fired, nobody knows which | Every `kind` belief is unknown; observe and contact identify; force is not authorized on an unidentified person; a held person can be mistaken for the subject on an adverse result |
| The subject is a 14-year-old with a parent's handgun | Minor clamp: never killed; less-lethal and talk are favoured by authorization; the text uses the drawn age and pronouns |
| Same call drawn twice | The subject is a man in one, a woman or nonbinary person in the other; odds, choices and outcomes are identical |

## Milestones

Each ends with `npm run verify` passing. Start each in a fresh session with this plan as the brief.

**M1. Domain model, generator, and the Scenario Lab (no engine behaviour change)**
- Types for §1 to §5, §11 and §12 in `src/content/scenarios/types.ts`.
- The generator in `src/gen/incident/instance.ts` (`drawInstance`, `aggregates`, `signature`, `countInstances`).
- The four current calls expressed as templates that reproduce today's casts, with a snapshot test so the compiled scenarios are unchanged.
- The lab rebuilt on instances (`src/dev/scenario-lab/`, same `/story.html` entry):
  - catalog with honest counts;
  - instance inspector (people table with truth vs belief, aggregates, clocks, meters);
  - map (`src/ui/blueprint/Blueprint.tsx`);
  - story graph;
  - real choice cards (`actionViews`, `OddsBar`, `OutcomeForecast`);
  - step-through on the real engine;
  - writing panel;
  - balance worker;
  - review notes.
- The writing checks move to `src/dev/writing-checks.ts` with `npm run check:strings`, and a parity test against `.agents/skills/swat-call-prose/scripts/game_string_checks.py` before the Python is retired.

**M2. Resolution pipeline**
- Emit `people` and the environment.
- The verb mapping.
- The spatial factors: cover, exposure, exits, backstop and range, in `src/sim/spatial-factors.ts`, using `roomSegmentClear` from `src/sim/furniture-path.ts`.
- Meters and clocks in the engine.
- The authorization table.
- The incoming-fire model.
- The cascade.
- Resolve-then-narrate with the coverage gate.
- The scoring function.
- Pilot on the hostage template, rewritten through the skills as a 1 to 3 subject call, with the hostage/victim distinction made real.

**M3. Lab scene panels**
- Sightlines, exposure, cover, range rings, containment.
- A compare view: per-choice odds deltas with causes, for the same call under two instances.

**Plan change (owner, 2026-10-07): calls are written model-first, not converted.** Once the hostage pilot landed, converting the remaining v13 trees stopped. Barricade, armed and rescue are each written fresh, the way the pilot was:
- a new template;
- a design sheet (`docs/calls/<call>-design.md`) through swat-call-design;
- the tree through swat-call-prose;
- a separate swat-writing-review read.

A premise is kept only where it earns its place. The old tree is retired once its replacement passes coverage, balance and review. Some call types are thinner while replacements are written.

**M4. Rollout and the department game**
- Complication modules (child, dog, second subject, medical bystander, crowd, power out, reinforced door, intoxication).
- The casualty and care model and the aftermath model.
- The board risk card and suggested capabilities.
- Barricade, armed and rescue written fresh, model-first (replacing "templates converted"), each retiring its old tree.
- Skill updates:
  - design: taxonomy, verbs, clocks, meters, invariants;
  - prose: count-aware grammar and fragments keyed to resolved state;
  - review: combination audit in the lab;
  - the engine map reference.

**M5. New call types** (model-first, like M4's rewrites)
- High-risk warrant.
- Robbery in progress.
- Crisis barricade.
- Vehicle standoff (needs the new `roadside_g2` family in `src/gen/building/procedural/families/`).

**M6. Gates and the count**
- The combinatorial gate (every signature class × K seeds: generate, bind, validate, agree, walk, coverage, writing).
- Balance per template, incident class and scale class.
- The §13 invariant gates.
- The stress-test cases above as tests.
- Counts published in the lab and in `docs/scenarios.md`.

## Verification

- **M1.** Snapshot equality for the four calls.
  - `/story.html` in the browser pane (`preview_start` "tactically-idle"): every template steps to an ending.
  - The catalog count equals the CLI count.
  - The balance worker equals `measure` (`src/gen/incident/trees-v13/balance.ts`).
  - No console errors.
  - `check:strings` parity.
- **M2.** `npx vitest run src/gen/incident/trees-v13` plus the new pipeline gates: coverage, agreement, authorization, sensitivity (cover vs no cover, 1 vs 3 subjects, trained vs untrained) and balance. In the lab, the same building shows labeled odds deltas.
- **M3 to M6.** Every stress-test case passes as a test. The combinatorial and invariant gates are green. The published count matches the lab.

## Decisions to confirm (recommended default in bold)

- **D1. Explosives or claimed devices.** **Excluded.** Too far from the game's grounded tone for now.
- **D2. A fled subject.** **Creates a follow-up warrant call** with a trust cost.
- **D3. Groups above 8.** **A future multi-building "operation" mode**, not in these calls.
- **D4. Officer-involved shooting.** **The officer is unavailable for 24 game hours pending review**, and the review result moves trust.
- **D5. Conceding demands.** **Allowed within the §7 policy list**, and every concession is a commitment.
