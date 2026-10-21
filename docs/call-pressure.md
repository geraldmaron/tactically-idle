# Call pressure in real time

How a call pushes on a player who is deciding: the scene keeps moving, the people watching are
counted, and the odds the cards show are the odds the commit uses. Built on 2026-10-21. Open work
is `after-landing`, `lab-live-window` and `profile-surface` in `docs/backlog.md`.

Owner decisions:

- Idle time becomes game minutes, at the timer setting's rate (2026-10-20).
- The timer setting is Off, Relaxed or Standard, and the default is Relaxed (2026-10-20).
- A stage's threat lands after 60 to 90 real seconds at Relaxed (2026-10-21).
- Nothing counts while the app is hidden (2026-10-21, reversing "time away counts").
- The screen changes while the player decides, not only at a commit (2026-10-21).
- A crowd or a stream shows as a live count beside the drain, with reactions floating past
  (2026-10-21). Every source shows, not one pressure at a time.
- Sound and vibration are on by default, with a mute in Settings (2026-10-21).

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
3. **The cap.** Dither on one decision stops at the open threat's minutes. Since the sources' sim
   values stop there too, the open question is `after-landing`.
4. **Pause.** `pauseDecision` and `resumeDecision` (`src/sim/operation.ts`) stop the stall while the
   app is hidden and move the decision's start on by the time away (`OperationRun.decisionPausedAt`).
5. **A stall raises pressure**, `CLOCK_RULES_V1.stallPressurePerMinute` a game minute on top of the
   call's own rate and its sources'.

| Setting | Rate | A 6-minute threat lands after |
|---|---|---|
| Off | none | never |
| Relaxed (default) | 5 game minutes a real minute | 72 seconds |
| Standard | 10 game minutes a real minute | 36 seconds |

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
- **Reactions.** Pools by cue, and a spike pool, float up out of the source on the strip. They are
  presentation only. They are written per call under `swat-call-prose`: viewers are people, so no gore
  and no cheering force.

The older fill effects still apply from a source's first cue: strain on officers at a commit, call
pressure a minute, and the debrief's audience factor on trust (`CLOCK_RULES_V1.fill`).

## The strip and the sensory layer

- The threat's drain, then every source as a ticker: the label, a count that eases toward the sim's
  value and wobbles about 3% either way, a bar with a tick at each cue, and the odds pull.
- A comms log above the choices, newest first, each new line keyed by a radio squelch.
- The frame glows red at the top in the threat's warn half and all round in its last quarter.
- Sound (`src/ui/audio/live-audio.ts`): squelch, a phone tick when a source jumps, a crowd murmur at
  the crowd's level, and a heartbeat in the last quarter. All synthesized, so there are no clips to
  license. Vibration on jumps and beats, where the phone has it.
- The count's wobble is the call's one looping signal (`src/ui/motion.test.ts`).
