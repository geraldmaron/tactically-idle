# Going Live: the run-out moments

Owner decision, 2026-10-21: when a decision point's threat runs out with no choice made, the call
moves on to an authored next moment, logged as indecision. This sheet designs the nine moments
Going Live needs, one per decision point with a threat (`TreeTimeout`, `src/content/call-trees/
hostage-live.ts`, section "run-out moments"). The engine side is in `docs/call-pressure.md`, "When
the time runs out". The structure of the call is unchanged: these moments sit beside its nodes and
rejoin them.

## Rules for every moment

- **Continued inaction made concrete.** Each moment is the scene the threat started, gone on without
  the team. The prompt opens on what changed while nobody chose, never on the threat again.
- **It never freezes.** Each moment has its own threat and timeout, at least 7 game minutes past its
  fastest choice (the drain a Relaxed reader gets elsewhere in the call). Stage 1 and 2 moments run
  out into the next stage; stage 3 moments run out into a held ending chosen by who is still inside
  (`holdTheNight`: `held_both`, `held_counter`, then `rider_held`).
- **Two real choices, different futures.** Each moment sets a talk that keeps the scene calm against a
  move that gets someone out sooner or changes who is watching. Every choice routes somewhere its
  sibling doesn't (the call-tree gate checks it).
- **Adverse results trace to a cue on screen** and reuse the call's escalation: on the raised truth
  the handgun comes up (`threat`), a rider past breaking point does it anyway in stage 3, and
  otherwise the scene settles somewhere worse.
- **No new force or entry.** No moment offers entry or force; the only shots are the rider's, into
  the front window toward the van light, which route to `fired_on` as the call's other shots do.
- **The timeout line names the inaction.** "Nobody calls the register back." The result beat shows
  it after the threat's own line and before the new prompt.

## The moments

| Source (stage) | Threat that ran out | Moment | Choice A, who pays | Choice B, who pays | Runs out to |
|---|---|---|---|---|---|
| `going_live` (1) | Address posted | `address_out`: cars at the corner, the rider reading to them | Call back late: the rider asks why it rang out | Shut the stream down now: the rider loses the stream before a word from you | `on_air` |
| `on_air` (2) | The comments turn | `chat_turned`: the rider reads the worst to the manager | Say one true thing on the stream: a police voice on the rider's channel | Ask the rider to free the manager now: the rider gives up the witness | `way_out` |
| `off_air` (2) | Rider stands over the manager | `same_question`: the manager whispers an answer | Answer the question yourself: the rider hears nobody can clear the name | Squad to the front door: the rider could turn and find helmets | `way_out` |
| `clerk_talks` (2) | The clerk's phone lights up | `phone_rings`: the manager's number calls again | Let the clerk answer: the clerk, nineteen, unprotected | Answer it yourself: the rider learns the police have the clerk | `way_out` |
| `way_out` (3) | The van parks | `van_light`: the light on the door, the rider wants the reporter | Move the van back: the rider watches the one real camera leave | Let the rider call the reporter: the late news carries the handgun | held |
| `cornered` (3) | The count keeps climbing | `clip_going`: the clip spreads, the rider stops reading | Stay on the line: the manager waits in reach of the handgun | Get the manager out while the rider watches: caught halfway if the rider looks | held |
| `threat` (3) | The van goes live | `on_the_news`: the handgun on the manager, on the broadcast | Talk only to the manager: the rider hears the police talk past them | Freeze every officer: nobody near the manager if it goes off | held |
| `fired_on` (3) | A call from home | `home_again`: the call rings again after the shot | Ask the rider to answer: home, with the handgun still in reach | Pull every helmet out of sight: no officer near the door, and the rider stays in | held |
| `last_word` (3) | The rider sits down | `ceiling`: out of sight, the phone filming the ceiling | Keep saying the name: nobody sees behind the counter | Squad to the back door: the rider could hear boots | held |

Futures, per moment (the gate's "different futures"): `address_out` {`on_air`, `threat`} against
{`off_air`, `on_air`, `threat`}; `chat_turned` {`way_out`, `threat`} against {`last_word`, `way_out`,
`threat`}; `same_question` and `phone_rings` likewise, one choice reaching `last_word` with the
manager out; `van_light` {`last_word`, `threat`} against {`out_on_camera`, `last_word`, `threat`};
`clip_going` {`last_word`, `threat`} against {`last_word`, `rider_held`, `threat`}; `on_the_news`
{`last_word`, `fired_on`} against {`last_word`, held, `fired_on`}; `home_again` {`out_on_camera`,
`last_word`, held} against {`last_word`, held}; `ceiling` {`out_quiet`, held} against {`out_quiet`,
`out_on_camera`, held}.

Entry states checked: the manager is inside at every moment except possibly `ceiling` (its prompt
and results split on `safe`/`notSafe` manager); the clerk is inside at `address_out` and
`chat_turned` and may be either elsewhere, so every release carries `clerkToo` and every held result
carries the clerk line. Text that would be false with the stream cut (`cut`, reachable before
`way_out`, `threat` and `fired_on`) doesn't mention the stream in those moments.

## Design record

- Lane and version: call tree, content edited in place; compiled fingerprints recaptured on purpose
  (every compiled Going Live changes: nine nodes, nine timeouts, threat ids).
- Contract read: `TreeThreat`, `TreeTimeout`, `TreeNext`, the compiler's `routing` and
  `timeoutFor`, `escalate`, `heldEnd`, `clerkToo`. Answered.
- Dilemma per moment: as the table; checklist lines 1 to 10 read by eye per moment; options exclusive.
- Dominance: each choice's cost is quoted in its `cost` string; no choice beats its sibling on odds,
  minutes and who pays together (the faster or surer one leaves someone in reach of the handgun).
- Force and entry gates: none added. The two new shots carry `shot_inside`, a threat-to-life mark
  set by an outcome, never by a threat or timeout.
- Stage exits: every stage 3 band ends the call or routes to a stage 3 node (the compiler adds
  `stage: 'resolve'`). Run-out chains end in at most nine lapses (the call-tree gate walks them).
- Flags: no new marks. Every mark set (`terms`, `performing`, `cut`, `still_armed`, `team_close`,
  `shot_inside`) already has readers.
- Ethics: E4 applies to the rider (`clip_going`, `ceiling` carry risk signs, no method, no death on
  card); E7 no gore; E9 the rider's life counts in every held ending; E10 command and the negotiator
  are never the obstacle; E12.3 the friend at the tape carries no messages.
- Gates: `npx vitest run src/gen/incident/trees-v13` passes.

## Prose record

- Input: this sheet. Coverage: every field of the nine nodes written; every choice has three
  previews and every band text in both situations it reaches.
- String checks: `npm run check:strings -- hostage_crisis` exits 1 on `main` already (66 n-gram and
  47 path-echo blocking rows in the existing text). After this change: no new blocking row
  (n-gram 65, path-echo 45); threat lines, beats and timeout lines are now string rows too.
  Advisory rows left: over-target titles of six or seven words, sentences up to 25 words, and one
  "flat voice" false positive in the existing `off_air` threat.
- Punctuation: no dashes, no colons. One address: prompts, summaries and previews say you; results
  name the team, the negotiator or officers. Present tense throughout.
- `{lead}` does the risky part in one summary per moment.
- Writing review: a separate `swat-writing-review` read, recorded below, with its fixes applied.

## Writing review

A separate reader ran `swat-writing-review` on 2026-10-21 (record in the session notes,
`after-landing-writing-review.md`): 5 block, 16 fix before ship, 11 note; verdicts edit 5, reject 4
(`phone_rings`, `van_light`, `home_again`, `ceiling`, each for a dominated choice). Applied:

- Dominance. `phone_rings.clerk_answers` favorable now opens the turn by truth (`knows_truth`, the
  receipt in s1, the store camera clip in s2). `van_light.reporter_call` is harder (TALK +6), command
  okays it in the summary, and its mixed band keeps the manager inside. `home_again.pick_up`
  favorable is the walk-out and `pull_back` gets the manager out and keeps the rider in.
  `ceiling.back_step` is harder (MOVE +6).
- Honesty. The `address_out` adverse preview, the callback logic, the second apron phone, the
  `ceiling` picture lines and `home_again` lines that were false with the stream cut, the
  `ceiling` timeout that read as a death, and four ending summaries that said the stream was still
  live (`rider_held`, `held_both`, `out_quiet`, `out_on_camera`; also `held_counter`'s line).
- Repetition and continuity: prompts no longer restate their threat, the nine moments' timeouts no
  longer open on "Nobody", `way_out` reads `turned_chat`, the manager is signaled through the glass
  instead of over the rider's speaker, and the barricade result goes back behind the counter.

Not applied, and why:

- `ceiling.back_step` adverse routing to `threat` with the handgun on the manager. It would put
  entry back in reach after a run-out; the difficulty change fixes the dominance without it. An
  owner call if wanted.
- The `threat` and `fired_on` landing lines that mention the stream (existing text, false on a cut
  path). They need a cut-safe line or a state variant on threats, which the data can't hold yet.
