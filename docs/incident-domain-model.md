# Incident domain model: standardize what a scenario is, then generate, resolve, narrate and review from it

**Status:** M1 completed on 2026-10-07 and M2 completed on 2026-10-08, including the model-first hostage pilot. The domain rules below remain the contract; remaining implementation and review work lives only in [docs/backlog.md](backlog.md).

The resolution pipeline uses `threatFx` and `relevantSubjects` from `src/sim/threat.ts` through `src/sim/incident-factors.ts`, fed by the incident instance. Story bindings remain the person-position source; the parallel legacy person model is not revived.

M1 delivered incident templates, seeded instances, per-person identity binding and the Scenario Lab. M2 connected people and place to the odds, incoming fire and team force, clocks and meters, authorization, commitments, scoring, counted groups, cascades and resolve-then-narrate coverage. The hostage pilot, "One Last Signature", was written model-first with one to three subjects. Its design and review history are in [hostage-signature-design.md](calls/hostage-signature-design.md) and [hostage-signature-review.md](calls/hostage-signature-review.md). The Lab now lives at `/lab`; `npm run check:strings` and the Lab use the skill's existing Python string checker.

Identity is drawn per person, never by role. Names and pronouns do not affect mechanics, and minors are never killed. Current force requires a carried firearm and a qualified officer; rescue sightlines use building geometry in `src/sim/sightlines.ts`.

## Context

The owner wants:
- a dev review interface that isn't rough;
- crafted scenarios with alternate decision points, outcomes and depth, written through the writing skills;
- thousands of genuinely different scenarios.

They want every part of an incident standardized and defined in the data model and the application logic. That covers how many subjects, armed or not, weapons, violence, accuracy, warrants, roles in a group, variance, hostages (what makes someone one), children and pets, and location: cover, engagement, lethal vs non-lethal. A scenario should happen in many locations, each adding its own variation. Bad outcomes are part of the job.

This plan replaces the earlier drafts. Those drafts bolted attributes onto today's fixed call trees, so the data model followed the story. Here the story follows the data model.

### Current implementation

The four dispatched v13 call trees are barricade, armed incident, hostage and protected rescue. Templates live in `src/content/incidents/`; `src/gen/incident/instance.ts` draws instances and `src/gen/incident/trees-v13/compile.ts` binds their people and choices to the building. Call choices carry physical moves and the incident factors contribute to resolution.

The model describes both implemented rules and the broader contract. Implementation gaps are tracked only in [docs/backlog.md](backlog.md).

### Owner decisions so far
- Children can be hurt, never killed.
- Pets can be hurt or killed, rarely.
- The lab comes first.
- Call-type expansion is tracked in [docs/backlog.md](backlog.md).
- Standing rules: E4.5, no wound anatomy or method (E16), force only on a visible threat, preserving life is the value.

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
- **Incoming fire** is a new model (`src/sim/drawn-effects.ts`, mirroring `force-risk.ts`). When an outcome resolves to an exchange of fire, the model draws officer and bystander harm from:
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

- `ScenarioTemplate` per call type (data in `src/content/incidents/`) holds:
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

**M1 done:** domain types, templates, generator, identity binding and the Scenario Lab.

**M2 done:** the resolution pipeline and model-first hostage pilot, including clocks, meters, authorization, incoming fire, force, groups, cascades, commitments, scoring and coverage.

Remaining M3 to M6 scope is tracked in the [backlog](backlog.md), under calls and the incident model, and gates and tooling. Calls are written model-first through a template, design sheet, prose and separate review; a replacement retires its old tree after coverage, balance and review.

## Verification contract

Generation, binding, resolution, coverage, authorization and balance are checked through the project's validation gates. The Lab provides engine step-through, counts, writing checks and review surfaces; see [scenario-lab.md](scenario-lab.md). The model's invariants and stress tests above define expected behavior rather than a claim that all gates are implemented. Outstanding gate work is tracked in [docs/backlog.md](backlog.md), item 16.

## Owner decisions

Defaults D1 to D5 and any changes to them are tracked only in the [backlog owner decisions](backlog.md#owner-decisions).
