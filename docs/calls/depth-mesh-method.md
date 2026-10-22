# Depth mesh: a multi-pass, multi-model way to build a call

DRAFT, 2026-10-22. A proposal, not a rule: nothing here is enforced yet, and the skills, the backlog
and `docs/content-pipeline.md` are unchanged. It answers the owner's ask that calls gain depth across
several passes and sessions, with no single agent or model carrying a whole call. The evidence it
starts from is [notes/going-live-teardown.md](notes/going-live-teardown.md).

## Recommendation first

Build a call **structure first, and gate the structure on the engine before any prose exists**.
Split the work into typed passes that hand data forward (a cast bible, a stage spine, a consequence
graph, then three prose layers, variants, one integration edit and a cross-family review), with the
strongest model on the few passes where an error compounds and cheaper models on the volume. The
load-bearing part is not the number of agents. It is four engine-measured gates that rewording alone
can't satisfy (structure can still game them; section 5 says how each is guarded): escalation beats per path counted from routes and tags, whether the
best-odds player reaches the turn, dominance under the balance styles, and repetition across stages
on played paths.

Verdict after sol's challenge (section 11): **needs validation**, for the whole method. The
structure-first order is the part most likely to hold; every gate below is a hypothesis until it
fails a deliberately bad fixture, and the multi-model split is unproven against its strongest rival,
one author working in several passes under the same gates. The one-stage pilot (section 10) was an
exploratory node repair, not a run of the method: it moved the measures it targeted, failed an
existing token gate, and introduced continuity faults of its own.

## 1. Why the current loop produced Going Live

Going Live already had a multi-pass, multi-model history: Claude wrote it, a separate review
returned 32 findings, Codex catalogued sixteen AI-writing tells, Claude rewrote against them, Codex
read it again (`bada273`, `badd2b0`, `ee50c51`, `bab5dea`). Every pass after the first worked on
lines, because every gate it answered to reads lines: the prose lint, the string checker's n-grams
inside one node, the eye. The structure the owner is reacting to (one escalation used 34 times, a
turn the best-odds player never reaches, the exit asked twice) was visible to none of them. More
agents on that loop add polish. The method below changes what the passes are allowed to touch and
what the gates can see.

## 2. The components, as typed data

Each component is a file in a per-call working folder (`docs/calls/mesh/<type>/`), written once by
its owning pass and frozen when its gate passes. Downstream passes reference upstream ids and never
invent a person, fact, mark or route; they file an amendment instead (section 6). Shapes below are
sketches in the repo's own vocabulary (`src/content/call-trees/types.ts`); a pass that needs a field
the engine cannot hold files an engineering request (`swat-call-design` section 11).

```ts
// pass 1: bible.json
interface Bible {
  premise: { borrowed: string; person: string; wrongNote: string; worseIfWait: string; whyTactical: string };
  people: PersonCard[];                 // swat-call-design section 3, every key person, not only the subject
  facts: { id: string; derivedFrom?: { fact: string; rule: string; reveals: string[] } }[];
  situations: { id: string; truth: Record<string, boolean>;
    reframe: { scene: string /* node or field id the player has already read */; before: string; after: string } }[];
  temptation: { choice: string; cue: string; breaksIn: string[] /* situation ids, must be all */ };
  closingFact: string;                  // NEVER PRINTED
}
interface PersonCard { role: string; want: string; fear: string; wound: string; selfLie: string; need: string;
  breakingPoint: Mechanism; voice: { markers: string[]; lines: [string, string] }; anchor: string; howTheyKnow: string }

// pass 2: spine.json
type Mechanism = 'shame' | 'crowd' | 'partner' | 'lost_control' | 'deadline' | 'call_from_home' | 'bargain_collapse' | 'withdrawal';
type VerbFamily = string;               // named per call, e.g. 'talk_on_stream', 'take_audience', 'close_distance', 'wait'
interface SpineNode { id: string; stage: 'assess' | 'adapt' | 'resolve';
  ladder: { reach: string; audience: string; known: string; time: string };   // must rise stage on stage
  dilemma: { goods: [string, string]; argument: string };                       // D5, written as two players
  options: SpineOption[] }
interface SpineOption { id: string; verbFamily: VerbFamily; protects: string; costs: string;
  chargedBy: string[] /* node.choice.band paths that charge the cost */; turn?: { reveals: string };
  difficulty: number; minutes: number; adverse: Mechanism; routes: Partial<Record<'favorable' | 'mixed' | 'adverse', string[]>> }

// pass 3: consequences.json, one cell per node.choice.band.situation
interface Cell { mechanism?: Mechanism; change: 'who_talks' | 'what_known' | 'where_person' | 'later_cost' | 'ending';
  marks: string[]; readers: string[] /* every mark has one */; cue: string /* field path the player saw first */;
  next: string; sketch: string /* one plain clause, not shipped */ }
```

Pass 4 onward writes the real `CallTree` in `src/content/call-trees/`, field for field, with each
choice and outcome traceable to a spine id and a cell (a comment or a lookup table in the working
folder; no new runtime field is needed).

## 3. The passes

| Pass | Takes in | Hands off | Tier | Gate that stops it |
|---|---|---|---|---|
| P0 brief | owner's idea, the agent brief template (`docs/content-pipeline.md`) | `brief.json`: type, lane, premise, ethics flags, budget | lead (Opus 5.5) | lead reads it; nothing else |
| P1 bible | brief | `bible.json` | Opus 5.5 | **G1**: facts independent unless `derivedFrom` names the rule and prices every reveal; three situations or a written reason; each situation's `reframe.scene` exists; blind voice (Haiku 5.5, five runs: attribute each person's two lines, at least 80% right); sol hostile read on D1, D2 and the ethics screen |
| P2 spine | bible | `spine.json` plus a skeleton `CallTree` in native types (checks with kind and ratings, certs, traits, modifiers, team moves, every effect and route; only the strings are `[spine:<id>]`) | Opus 5.5 | **G2**: spine lint (below) on the skeleton, run through the engine walker and the balance styles; sol reads the fake-choice checklist and the visible-cost grid against the numbers, not the prose. No prose pass starts while G2 or an amendment is open |
| P3 consequences | bible, spine | `consequences.json` | Sonnet 5.5 fills, Opus 5.5 accepts | **G3**: `lintTree` (`trees-v13/dependencies.ts`) has no dead write or unread mark; every adverse cell has a cue that precedes it on every path; no derived fact revealed before its turn; recompile and rerun G2's numbers |
| P4a scene layer | the three above, spent-phrase ledger, "already read" list per node | cold open, briefing, prompts, `promptIf`, exchanges, threat text, beats, timeouts | Sonnet 5.5, one writer for the whole call | **G4** (below), run after each layer |
| P4b menu layer | the above plus P4a | titles, summaries, pull, cost, previews | Sonnet 5.5, a second writer | G4, plus swap and tone tests (Haiku 5.5, majority of five) and preview against the worst result in every situation (reader) |
| P4c consequence layer | the above plus P4b | results, endings, epilogues | Sonnet 5.5, a third writer | G4 |
| P5 variants | bible, P4 | fact variants, viewer chat pools | Haiku 5.5 drafts, Sonnet 5.5 picks | the distinctness gate (`trees-v13` tests), `reactions.test.ts` |
| P6 integration edit | every played path in order (engine transcripts) | prose edits only | Opus 5.5, one editor | may not change data; G4 rerun; diff reviewed by the lead |
| P7 review | the built call | verdict | sol runs `swat-writing-review` hostile; the owner reads three paths aloud | the skill's verdict rules; the owner's D7 pick |

**Why each tier.** The design metadata in section 2 sits beside the skeleton and never replaces it: odds depend on
the whole check, so a spine with only a difficulty number can't be measured (the pilot's guess at
`camera_wall` proved it). Two independent binary truths need four situations and a tree holds three
(`types.ts`), so `derivedFrom` is design metadata the lint checks, not something the engine infers.

The bible and the spine are a few thousand tokens and decide everything after
them; an error there is paid for in every later pass, so they get the strongest model and the lead.
Prose is most of the volume and is the easiest work to bound with a contract, so it goes to a cheaper
writer per layer. A layer, not a stage, per writer: one voice then runs the length of the call, which
is how the call stops reading as five stages by five hands. Judges that only need a yes or a no (blind
voice, swap, tone, mechanism tagging) run many times on the cheapest model and vote. sol reviews
because it is a different model family with different blind spots; Claude reviewing Claude is the
rubber-stamp risk (section 9).

## 4. G2: the spine lint and skeleton compile

Run before a single player-visible word exists, where a structural change costs minutes. Reuse the
repo's own machinery: the call graph (`trees-v13/graph.ts`), path keys (`trees-v13/path-key.ts`),
the move driver (`gates/engine-driver.ts` `availableMoves`), dependency lint
(`trees-v13/dependencies.ts`) and the Lab's dominance rows (`src/dev/lab/model/dilemma.ts`); the
teardown's scratch walker only stitched these together. Every rule ships with a bad fixture that
passes the naive version and must fail the real one (sol's escape routes in section 11 are the first
fixtures).

1. **Escalation palette (D3), from data.** Every adverse option names one `Mechanism`. Over every
   root-to-ending path of the spine graph: at least four mechanisms in the call, no mechanism more
   than twice on a path. Going Live today: one mechanism, up to five times on a path.
2. **Verb families.** No verb family appears in more than two stages on one path, and a repeat must
   change its object or its price. Going Live today: talk-on-the-stream, take-the-audience and
   move-close each appear at every stage.
3. **Costs charged.** Every `costs` has at least one `chargedBy` path that the skeleton walk reaches.
   Going Live today fails at `on_air.camera_wall`.
4. **Turn reach, and what it means.** A fact flag alone is gameable (put the reveal on the easiest
   option, which is what the pilot did), so the gate also needs, per situation, the quoted earlier
   scene the truth reframes, its changed meaning, and a reachable consequence of knowing it. Under the four balance styles on the skeleton (300 drawn calls each, real dice,
   `trees-v13/balance.ts`), the share of calls that reveal the briefing's unknown. Floor: above zero
   for every style; the owner sets the target before authoring. Going Live today: random 23%, best_odds 0%, patient
   55%, fast 37%.
5. **Dominance.** At the first engine arrival at each node, and at its median arrival, no option is
   matched or beaten on odds, minutes, objective and harm together, and the dominance grid's visible
   costs and payoff column (`swat-call-design` section 6) give a credible reason to pick each losing
   option; a one-point objective edge is not one. Going Live today fails at
   `going_live`, `on_air`, `clerk_talks` (s1) and `last_word`.
6. **No coin with two tails.** No node where every option is under 10% favorable at its median
   arrival. Going Live today: `fired_on` and `home_again` at first arrival.
7. **Truth independence.** No hidden fact revealed by any option before the turn when it settles the
   turn's fact. Going Live today: every stage 1 adverse.

## 5. G4: repetition and drift, measured where the player meets it

Words are easy to rotate, so the gates count what rewording can't change, and use words only for the
residue.

| Measure | How | Target (house, set from the teardown) | Going Live today |
|---|---|---|---|
| M1 beats per path | adverse outcomes by spine mechanism, and adverse routes to the call's hostage-at-gunpoint node, per engine path | each mechanism at most twice per path | handgun-on-manager up to 5 per path (uniform walk) |
| M2 turn reach | as G2.4, on the built call | as G2.4 | best_odds 0% |
| M3 dominance | as G2.5, on the built call | 0 | 4 nodes |
| M4 cross-stage echo | share of engine paths with a 4-word run in two different strings, excluding names and fixed nouns | half of the baseline, then the new floor | 58 to 60% of uniform paths |
| M5 retold facts | each bible anchor (a time, an object) counted per path | at most twice, the second with a change | the 11:40 story up to 5 |
| M6 spent-ledger hits | 3-word runs a new node shares with the rest of the call | down, every pass | 28 at `on_air` |
| M7 voice drift | the blind-voice judge (G1) rerun on each person's shipped lines after P4 and P6 | no drop below G1's score | not measured |

M1 to M3 read data and the engine, so rewording alone can't move them, but they can still be gamed
by structure: four labeled causes for one physical threat (M1), a reveal with no reframe (M2), a token
edge that breaks strict dominance (M3). M1 needs one classification rubric applied to old and new
text alike, and a fixture where four causes end in the same threat must fail. M4 to M6 read words; a
thesaurus beats them and deliberate echoes are sometimes right, so they are backstops paired with a
semantic repeat read, never targets. M5 counts every repeated proposition and image, not only the
anchors the author chose to list. M6 uses the whole corpus a path can read, not the common runs (the
pilot copied two rare 6-word runs past a ledger of common ones). M7 uses the existing cross-call D4
test with held-out lines, not attribution of occupation words. The string checker already catches
6-word runs across the whole call; what it can't see is a 4- or 5-word echo, or a repeated beat,
between stages on a played path.

## 6. One call, not a committee

- **One owner for the spine.** The lead writes P1 and P2 and accepts P3. Nobody downstream edits them.
- **Amendments, not edits.** A later pass that finds a spine defect files it in the working folder's
  `amendments.md` with the measure that proves it. The lead accepts (the spine changes, G2 reruns,
  every later layer reruns its gate) or rejects with a reason. A prose writer never fixes structure
  with words, which is how `escalate()` got 26 rewordings.
- **Layers, not stages.** Each prose writer owns one layer across the whole call, so the scene voice,
  the menu voice and the consequence voice are each one hand.
- **One editor last.** P6 reads every path in player order and edits prose for one voice. It cannot
  change data, so it cannot reopen the structure.
- **The owner's ear.** The owner reads three paths aloud and picks the quotable line (D7). Without
  that anchor, models writing and models reviewing agree on competent prose
  (`docs/scenario-depth.md`, "How depth is held").
- **A budget, not a string count.** Each call records tokens, elapsed lead time, rereads and amendment
  rounds against a budget set at P0. An earlier draft proposed reverting any pass that changed over
  50 strings without moving a measure; sol showed it is gamed by small batches and punishes a correct
  voice edit, so it is withdrawn.

## 7. Cost and time

Per call, as planned: two lead sessions (P1 and P2, P6), three Sonnet sessions (P3, P4 a to c, P5
picks), three sol runs (G1, G2, P7), a few dozen Haiku judge calls, and the scripts. That is more
than one author's single pass, and the fair comparison is one author's several passes under the same
gates, which nobody has costed. It is less than Going Live has already spent: four full writing passes,
two Codex reads and a separate review, all on lines. Not measured; the pilot ran one stage only.

## 8. Breaking the method: the single author

**The steelman.** One strong author, holding the whole call, with the skills and the same engine
gates, would do better:

- Subtext lives in one head. The private logic that makes a manager glance at a door is compressed
  into a JSON field on the way to a prose writer who never met her, and what arrives is a
  contract-filling sentence.
- About 850 strings fit in one context. Splitting them buys parallelism a single call doesn't need.
- Handoffs cost. Seven passes, three gates and an amendment log is overhead on a 90-second call.
- The good narrative games the presentation doc cites were written by small teams with one editor.
- Going Live is already the multi-model experiment, and it failed.

**What survives it.** The last point is the strongest. My first answer was that Going Live's passes
failed because each was graded on lines by gates blind to structure; sol showed that is only half
established, because the structural rules already existed and the design sheet self-certified them
("None dominated"). Blind gates and rubber-stamped records are competing causes, and the method has to
answer both. A single author held to G2 and G4 would get most of this method's value.
So the honest claim is narrower than the owner's framing: **the gates and the structure-first order
are the method; the multi-model split is a cost and capacity choice to be proven.** Where the split
earns its keep is review: a cross-family reader catches what a same-family author can't see in their
own work (the AI-tells catalog came from Codex, not from the Claude that wrote the lines).

## 9. Its strongest failure mode, and the controls

**Gates that pass slop, compounding.** Writers optimize what is counted; reviewers from the same
family agree with writers; a weak spine propagates because downstream passes may only file
amendments, and amendments get dropped under time. This repo has the proof in small: the Codex tells
pass removed "Nobody" openers from nine timeouts, the regex count fell, and the beat (nobody answers)
stayed in every one of them (teardown finding 13).

| Risk | Control | Residual |
|---|---|---|
| Metric gaming by rewording | M1 to M3 read routes, marks and odds, which wording can't move; mechanism tags assigned by a blind Haiku classifier and compared with the spine's | M4 to M6 stay gameable; they are backstops only |
| Rubber-stamp review | sol (a different family) at G1, G2 and P7; reviewer findings must name a field path and a falsifying row, or they don't count | sol and Claude can share blind spots on taste; only the owner's read covers that |
| Compounding drift | Spine frozen at G2; skeleton compile before prose; amendments rerun every later gate | An amendment late in P4 costs a rewrite of two layers |
| Voice flattening | Layer writers, one editor, M7 | Contract-filling prose is likely in P4; P6 is the only cure and it is one model's taste |
| Cost blowup | The stop rule; fixed pass list; Haiku for judges | Not measured beyond the pilot |

**Evidence that would show it works**, in order of strength: (1) on a full rebuild, M1 to M3 reach
target where four prose passes didn't; (2) the owner prefers the mesh text in a blind A/B on three
paths read aloud; (3) the share of P7 findings routed to `swat-call-design` falls against Going Live's
history, meaning structure is caught upstream; (4) the second mesh call takes less lead time than the
first. If (1) holds and (2) doesn't, keep the gates and drop the split.

## 10. Pilot: one stage, `on_air`

**What ran.** Stage 2's hub node, the one 1,017 of 1,500 uniform s1 paths and 293 of 297 best-odds
calls pass through. Scratch only, in [notes/pilot/](notes/pilot/); the shipped call is untouched.

1. P1 and P2 by the lead (Opus 5.5): a cast slice and a stage spine,
   [on-air-spine.json](notes/pilot/on-air-spine.json). It keeps every mark later nodes read, gives
   each option a verb family, a charged cost, a turn effect and a distinct adverse mechanism, puts
   the turn on `camera_wall` too (told to the team off camera), and raises `camera_wall` from TALK +2
   to +6 to close its lead.
2. P4 by a Sonnet 5.5 subagent that never saw this conversation: the node as data,
   [on-air-node.json](notes/pilot/on-air-node.json), from the spine, the skills and a spent-phrase
   ledger ([spent-ledger.json](notes/pilot/spent-ledger.json), the 160 commonest 3-word runs in the
   rest of the call).
3. The gate: the node spliced into Going Live in memory and run through the same measures as the
   teardown. Raw output in [on-air-gate-output.md](notes/pilot/on-air-gate-output.md).

P3 was folded into P2 (one node is too small to split), P5 and P6 did not run, and sol's review of
the pilot is in section 11.

| Measure | Current `on_air` | Pilot | Read |
|---|---|---|---|
| Turn reach, best_odds (300 calls) | 0% | 78% | fixed, by moving the turn onto the option players pick |
| Turn reach, random / fast / patient | 23% / 37% / 55% | 39% / 72% / 55% | up (patient never visits `on_air`) |
| Adverse routes to `threat` from this node | 4 | 1 | M1 met here |
| "handgun" in the node's strings | 13 | 4 | |
| Distinct adverse mechanisms | 1 (handgun on the manager) | 4 written (shame and the handgun, crowd, withdrawal, lost control); the writer added a second withdrawal on `manager_speaks` calm | drift from the spine, which a mechanism tag would have caught |
| Odds at first arrival, s1 / s2 | `camera_wall` 85 / 89 against `manager_speaks` 65 | `camera_wall` 79 / 82 against 65 | **not fixed**: the spine's +6 was a guess; best_odds still picks it 293 of 297 |
| Spent-ledger hits (3-word runs shared with the rest of the call) | 28 | 2 (both allowed fixed nouns) | met |
| 11:40 / red light / timestamp retold | 3 | 0 | met |
| Count restated in prose | 4 | 1 | |
| Checker on the node's 61 / 73 strings | exit 0; cadence 0.46 FLAT; rider name opens 38% | exit 1 (one path-echo, "the register camera" twice in one result); cadence 0.58 OK; rider name opens 15%; a vague-preview row, a tense-mix row, 11 "it" reads | worse on blocks, better on rhythm |
| Whole-call 6-word runs shared across strings (scratch harness; the production-equivalent run sol made reads 0 to 2) | 2 | 4 (`team_glass` mixed and adverse copy "spots a helmet at the corner" and "sees two helmets in the" from `going_live` and `off_air`) | the ledger listed common runs only, so one-off runs elsewhere slipped through |

**Read as the player.** Better: the prompt opens on a new act ("{rider.first} carries the phone to
the drinks cooler and holds the lens on {manager.first}’s face"), the manager gets a voice ("Six
years on this shift, {rider.first}. I don’t talk to cameras."), the rider's chant lands ("Who
believes me? Type it. Who believes me?"), and the s1 withdrawal line is the first thing in the call
that sounds like a person giving up ("It doesn’t matter now whose hands the bag was in. Nobody’s
watching."). Worse: contract-filling sentences the current text doesn't have ("{lead} requests that
{rider.first} point the phone at the plaster", "{manager.His} gaze stays on the stockroom door", "to
the height of {manager.first}’s face", "wheels it round", which is also British and a bare "it"), and
the stockroom glance now pays off in three options in one node, a new refrain. The `camera_wall`
favorable line "Now tell them too." sets up a demand that `way_out` has no `promptIf` for, so it is
dropped on the next screen: an amendment the method would have to file against `way_out`.

**Defects sol found in the pilot** (section 11, findings 13 to 17): five `{lead}` tokens in previews
and results, which `call-trees.test.ts` allows only in summary, pull and cost; the "private" answer
in `camera_wall` is not private, because the phone faces the wall with the sound on; "Now tell them
too." and the `cut_feed` withdrawal both reset at the next node (`way_out`, `off_air`) instead of
being answered; `team_glass` adverse kills the lights in prose with no mark that keeps them off; and
the manager's new line "I don’t talk to cameras" announces biography where the current "Not with that
in your hand." shows fear. Read whole, the pilot does not ship.

**What the pilot shows.** It was an exploratory node repair (the spine was written, then the prose,
then measured; no skeleton gate ran first), and the structure-first order paid where it was applied:
turn reach for the best-odds player (0% to 78%), adverse routes to the gunpoint node (4 to 1) and
shared runs (28 to 2) moved in one pass, where four prose passes moved none of them. It also showed the method's weak joints in miniature: the spine's own difficulty guess
was wrong and only the engine caught it (so G2's skeleton compile is not optional), the writer
drifted from its mechanism contract, the spent ledger needs every run a path can read, not the
common ones, and a cheaper writer working from a contract writes stiffer lines, which is exactly the
voice-flattening risk P6 exists for. It cannot show whether the owner prefers it; that needs the
blind read in section 9, and a comparison with one author doing the same repair.

## 11. sol's attack on this method

sol (Codex, configured default model, `codex-companion.mjs task --fresh --effort high`, read-only,
2026-10-22) read this doc, the teardown, the pilot files and the current node, replayed the pilot
splice in memory (best-odds fact reach 0/300 against 235/300, matching section 10), and ran the
production-equivalent checker. **Its verdict: needs validation.** I accept that verdict; it replaces
my first one ("accepted with controls" for the gates).

| sol # | Claim attacked | Severity | My verdict | What changed |
|---|---|---|---|---|
| 1 | M1 counts labels; four causes can dress one threat | fix before ship | accepted | Section 5: one rubric for old and new, a failing fixture |
| 2 | M2 measures a flag, not a turn | block | accepted | Section 4.4 requires the reframed scene, its new meaning and a consequence; target set before authoring |
| 3 | M3 strict dominance escapes with a token edge | fix before ship | accepted | Section 4.5 adds the visible-cost and payoff grid |
| 4 | M4 rewards a thesaurus, punishes deliberate echoes | fix before ship | accepted | Backstop only, paired with a semantic read |
| 5 | M5 hides repetition outside the chosen anchors | fix before ship | accepted | Counts every repeated proposition and image |
| 6 | M6 already gamed in the pilot | fix before ship | accepted | Whole-corpus ledger; a falling count is not evidence of better prose |
| 7 | M7 attributes occupations, not voices | fix before ship | accepted | Uses the existing cross-call D4 test |
| 8 | Verb families, charged costs, the 10% floor and truth independence all have escape routes | fix before ship | accepted | Every rule ships with a bad fixture |
| 9 | The skeleton sketch can't produce trustworthy odds; four situations would be needed for two free truths | block | accepted | Section 3: skeleton in native types; metadata beside it; the three-situation limit stated |
| 10 | Much of the infrastructure exists; the checker does catch 6-word runs call-wide | note | accepted | Section 4 names what to reuse; section 5 and the teardown corrected |
| 11 | The pilot didn't run the process it credits | block | accepted | Section 10 calls it an exploratory node repair |
| 12 | The samples support the paired splice, not player-experience claims | fix before ship | accepted | The policies are mechanical rules and the BFS key drops pressure; numbers stay labeled by sampler |
| 13 | The scratch checker hid real failures, including five illegal `{lead}` tokens | block | accepted | Section 10 lists them; production-equivalent ngram is 0 to 2, not 2 to 4 |
| 14 | The private answer isn't private | block | accepted | Pilot defect listed |
| 15 | Kept mark names don't keep continuity | block | accepted | Pilot defects listed; amendments to `way_out` and `off_air` needed |
| 16 | Lights out in prose, no state | fix before ship | accepted | Pilot defect listed |
| 17 | "Better as the player reads it" is unearned | fix before ship | accepted | Section 10: the pilot does not ship read whole |
| 18 | Freeze, voting and the stop rule compound defects and hide cost | fix before ship | accepted | Stop rule withdrawn; budget recorded; no prose while an amendment is open |
| 19 | The single-author steelman is fair but untested; the "blind gates" cause isn't established | block | accepted | Sections 7 and 8 rewritten; the trial compares the two arrangements |

The three changes sol insisted on, all accepted: make the gates executable and falsifiable with
native shapes and bad fixtures; repair and fully integrate the pilot before claiming anything for it;
run a budgeted comparison against one author doing several passes under the same gates, read blind.

## 12. Proposed backlog items

Proposed to the lead, not added (`docs/backlog.md` is the lead's file), in `COORDINATION.md` format.

```
### going-live-spine: Going Live rebuilt structure first
Tags: job=command; journeys=choices-branch, chance-not-script; probes=none (content structure); lane=calls
Needs: start=none (owner sets the turn-reach target); integrate=path-measures; ship=going-live-review
```
Done: the teardown's blocks closed as data (escalations from four or more mechanisms, no more than two
per path; truths decoupled or the coupling priced; one exit decision; the lie charged in both
situations; the turn reachable by every balance style; previews true in every situation), with the
`path-measures` report attached and a separate review.

```
### path-measures: Path-level measures for a call
Tags: job=command; journeys=choices-branch, chance-not-script; probes=none (report, not an odds input); lane=tooling
Needs: start=none; integrate=none; ship=none
```
Done: `npm run check:paths -- <type>` reuses `graph.ts`, `path-key.ts`, `engine-driver.ts`,
`balance.ts` and the Lab's `dilemma.ts`, and reports per call: adverse routes to a named node per
path, fact reach per balance style, dominance with the payoff grid at first and median arrival, and
4-word cross-stage echoes on played paths; each measure has a bad fixture that must fail. Report-only
until the owner sets thresholds.

```
### threat-after-close: A threat never lands after the result that ended its scene
Tags: job=command; journeys=answer-a-call; probes=none (ordering, not odds); lane=engine
Needs: start=none; integrate=none; ship=none
```
Done: a threat or clock cue whose text describes a scene the committed result ended (the rider
already out, the stream already cut) does not commit after it, shown by a test on Going Live's
`wait_night` and `cut_feed` paths.

```
### mesh-trial: Compare the depth mesh with one author under the same gates
Tags: job=command; journeys=choices-branch; probes=none (process); lane=lead
Needs: start=path-measures; integrate=none; ship=none
```
Done: one call built twice to the same brief and budget, once by the mesh and once by one author in
several passes, both held to `path-measures`; the owner reads three paths of each blind and the record
keeps tokens, lead time and amendment rounds.
