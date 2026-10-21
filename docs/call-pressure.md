# Call pressure in real time

How a call pushes on a player who is deciding: the scene keeps moving, the people watching are
counted, and the odds the cards show are the odds the commit uses. Built on 2026-10-21. Open work
is `lab-flow-timeouts`, `lab-live-window` and `profile-surface` in `docs/backlog.md`.

Owner decisions:

- Idle time becomes game minutes, at the timer setting's rate (2026-10-20).
- The timer setting is Off, Relaxed or Standard, and the default is Relaxed (2026-10-20).
- A stage's threat lands after 60 to 90 real seconds at Relaxed (2026-10-21).
- Nothing counts while the app is hidden (2026-10-21, reversing "time away counts").
- The screen changes while the player decides, not only at a commit (2026-10-21).
- A crowd or a stream shows as a live count beside the drain, with the watchers' chat under it
  (2026-10-21). Every source shows, not one pressure at a time.
- Sound and vibration are on by default, with a mute in Settings (2026-10-21).
- When a threat's time runs out with no choice made, the call moves on to a moment written for it,
  and the log and debrief record the indecision (2026-10-21). Waiting strains nobody (below).

## Why it works this way

These findings from adversarial passes shaped the design:

- **Leaving the app isn't a choice.** On a phone most players leave because something interrupted
  them, so the stall pauses while the app is hidden.
- **Two clocks in two units can't be read together.** The drain shows game minutes, the same unit as
  the threat.
- **A hidden penalty makes the preview lie.** Every effect of a stall shows in the odds and the strip
  as it accrues.
- **Real time breaks replay** unless it is an input. The stall is recorded with the decision, and
  everything that happens during it is a pure function of the stall.
- **Constant alarm stops being alarm.** Each threat has a few beats, spaced, and the strip goes from
  calm to warn to critical as its window closes.
- **Reading shouldn't cost the player.** Most of a stage's words arrive as beats, so reading the scene
  is playing it. The prompt stays short.
- **Thumbs are not judgment.** A beat changes which choices are open. Nothing asks for a tap inside a
  window.

## Dither minutes

While a decision with a threat or a running clock is open and the app is visible, real time accrues
dither minutes at the setting's rate (`CLOCK_RULES_V1.dither`, `src/sim/clocks.ts`).

1. **The commit** adds the dither to the decision's minutes, so clocks, cues and the threat move
   through one path (`decisionMinutes`, then `advanceTime`).
2. **The record.** The dither is saved with the decision, so a replay, the Scenario Lab and the
   fingerprints read it.
3. **The cap.** Dither on one decision stops at the open threat's minutes. Reaching it is the lapse
   (below): the call doesn't sit at the cap.
4. **Pause.** `pauseDecision` and `resumeDecision` (`src/sim/operation.ts`) stop the stall while the
   app is hidden and move the decision's start on by the time away (`OperationRun.decisionPausedAt`).
5. **A stall raises pressure**, `CLOCK_RULES_V1.stallPressurePerMinute` a game minute on top of the
   call's own rate and its sources'.

Going Live's threats run 10 to 13 game minutes: each stage's fastest choice plus 8, so a player
who reads for 30 seconds at Relaxed still has a choice that lands in time.

| Setting | Rate | A Going Live threat (10 to 13 minutes) lands after |
|---|---|---|
| Off | none | never |
| Relaxed (default) | 5 game minutes a real minute | 2 to 2.6 minutes |
| Standard | 10 game minutes a real minute | 60 to 78 seconds |

The owner's target was a threat that drains in 60 to 90 seconds at Relaxed (2026-10-21). That only
holds at Standard today: shorter threats at Relaxed left a 60-second reader with no choice that
lands in time. Which one gives way is the owner's call.

Accessibility sources, checked 2026-10-20: WCAG 2.2.1 Timing Adjustable is met by letting the player
turn the limit off ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html)), and
the Game Accessibility Guidelines ask that players can move through text at their own pace
([GAG](https://gameaccessibilityguidelines.com/full-list/)). Off meets both. Flashing stays under
three a second (WCAG 2.3.1), and reduced motion stops the reactions and the bar transitions.

## The live decision

`stalledRun` (`src/sim/clocks.ts`) is the call as the stall has left it, and the cards, the strip,
the people panel and the commit's roll all read it:

- **Every clock moves on, and its cues are heard** as they pass: their marks set and their moves on
  the subjects made.
- **Beats fire.** A threat carries beats (`TreeBeat`, `src/content/call-trees/types.ts`): a line from
  a role or a voice (radio, dispatch, the negotiator) at a dither time below the threat's minutes,
  with marks, moves and source bumps. A beat's mark can close a choice (a choice's `onlyIf` that
  excludes it). The cards stop offering it, and the commit refuses it.
- **The threat lands** when the stall reaches its minutes: its pressure, bumps and moves count at once.

`stallFeed` lists the beats and cues the stall has passed, in order, for the comms log
(`src/ui/screens/LiveFeed.tsx`). The commit applies the same effects once: cues through
`advanceTime`, beats and the threat through `matchedEffects`.

## Pressure sources

A clock that fills can carry a `source` (`PressureSource`, `src/sim/scenario-types.ts`). The gauge
stays 0 to 100 in the sim; the source says how the scene reads it.

- **Count.** `from` at 0 to `to` at 100 on a curve, with a unit ("watching", "at the tape").
  `sourceCount` (`src/sim/pressure-sources.ts`) is the one place it is computed.
- **Rates follow the scene.** `rateFlags` slow it (the camera turned to the wall); `surges` speed it
  while a flag is set (the rider playing to the chat). A slowing flag always wins.
- **Bumps.** An outcome, a beat or a threat jumps a source by points (`bump`, compiled to
  `OutcomeEffect.clockBump`): a news van parks, the stream is cut.
- **Odds.** Once its first cue is heard, a source takes up to `atFull` points off the checks it
  weighs on, named on the card with its count ("Lee’s stream: 2,431 watching").
- **Reactions.** Pools by cue, and a spike pool, play as a two-line chat under the source on the strip, each line
  under a generated handle (`commenterHandle`, `src/content/world.ts`). They are presentation only
  (`src/ui/screens/live-chat.ts`). A line shows at most once a run, so each cue's pool holds at least
  16 lines and the spike pool 8; once a pool is spent the chat thins to people joining while the count
  climbs. They are written per call under `swat-call-prose` ("Viewer chat"), and
  `src/content/incidents/reactions.test.ts` checks the pool sizes and wording rules: viewers are
  people, so no gore and no cheering force.

The older fill effects still apply from a source's first cue: strain on officers at a commit, call
pressure a minute, and the debrief's audience factor on trust (`CLOCK_RULES_V1.fill`).

## The strip and the sensory layer

- The threat's drain, then every source as a ticker: the label, a count that refreshes every second
  or two like a stream app's (part of the way to the sim's value each time, a few people joining or
  leaving, never more than 3% from it once caught up), a bar with a tick at each cue, and the odds pull.
- A comms log above the choices, newest at the bottom, each new line keyed by a radio squelch. It
  holds its box before the first line and scrolls inside it, and the threat's landing joins it.
- The frame glows red at the top in the threat's warn half and all round in its last quarter.
- Sound (`src/ui/audio/live-audio.ts`): squelch, a phone tick when a source jumps, a crowd murmur at
  the crowd's level, and a heartbeat in the last quarter. All synthesized, so there are no clips to
  license. Vibration on jumps and beats, where the phone has it.
- The count's refresh is the call's one looping signal (`src/ui/motion.test.ts`).

## When the time runs out

A decision point's threat can carry a `timeout` (`TreeTimeout`, `src/content/call-trees/types.ts`):
the moment the call moves to when the drain empties with no choice made. The engine settles it with
a `lapse` (`OPERATION_HANDLERS.lapse`, `src/sim/operation.ts`).

1. **One rule.** `lapsedThreat` (`src/sim/clocks.ts`) says the time has run out: a live threat with
   a timeout, a timer that isn't Off, and a stall at its minutes. A lapse commits only then, and a
   choice is refused from then on, so a lapse and a late choice never both settle one window. Both
   carry the run revision they were made on (`decide` takes it as `revision`), and a stale one is
   refused. The timer reaches the engine as `Ctx.timer`, which the store passes with every command.
2. **Timer Off never lapses.** With no stall there is nothing to run out, and a slow choice still
   lands an unspent threat by its own minutes, as before.
3. **One path.** The lapse spends the window as a decision spends its stall: the stall's pressure
   once, then the minutes through `advanceTime`, then the route, the landing and every beat
   (`lapseEffects`), the cues, and the clock outs, which can still route or end the call first.
   The stage change goes through `settleStage`, the transition a decision uses.
4. **The record.** History holds a `LapseRecord` (`kind: 'lapse'`): the threat's id and label and
   the minutes, with no action, band, sample, squads or strain. Saves validate it against the
   call's threats; `traceRun`, the save validators and the Lab replay it in order. Its path token
   is `<threat id>~lapse`.
5. **Spent.** The threat's id (`NodeThreat.id`, the node's id) is marked spent (`spentFlag`), and
   every reader (the cap, the landing, the strain, the card warning) skips a spent threat.
6. **The result beat** names it: "No call made: <threat>", the threat's line, what the minutes
   nobody used looked like, and the new moment's prompt. The beat is the saved run's
   (`decisionPending`), so a reload mid-result comes back on the result.
7. **Waiting strains nobody.** A lapse adds no strain and no experience to any deployed officer:
   its cost lands on the call (pressure, the threat's effects, a worse moment), and the next
   commit's strain reads the higher pressure. A call nobody acted in at all (every decision ran
   out) gives no tactical experience. Nothing here is a balance number to tune.
8. **It always moves.** A run-out moment has its own threat and timeout; in stage 3 they end the
   call held (`rider_held`, `held_counter`, `held_both` by who is still inside). The call-tree gates
   fail a curated call with a threat that has nowhere to go, a route back to its node, the root or
   an earlier stage, or a chain of run-outs that never ends. Going Live's nine moments are designed
   in `docs/calls/going-live-lapses.md`.

The store's tick and the live screen both send a due lapse (`dueLapse`, `src/ui/timer.ts`), so the
call moves on whatever screen the player is on. The store also owns the hidden-app pause, so hiding
the app from any screen stops the drain.

A lapse's result waits to be read, like any result: no time counts while it shows, so a player who
walks away comes back to the result, not to a call that ran itself to an ending. Continued inaction
means not choosing at each decision the player sees (Codex review, 2026-10-21, finding 1, kept on
purpose).
