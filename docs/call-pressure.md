# Call pressure in real time

How a stage threat such as "A table across the door" (5 min) pushes on a player who stalls,
without a second clock, a hidden penalty or a break in replay. This is design only and nothing
here is built yet. The work items are `dither-minutes`, `threat-drain-bar` and
`threat-agitation-lines` in `docs/backlog.md`.

The owner made these decisions on 2026-10-20:

- Idle time becomes game minutes.
- The timer setting is Off, Relaxed or Standard, and the default is Relaxed.
- The subject's push-back lines are written per subject, not drawn from a global pool.

## Where this starts

Stage threats are on `main`.

- `TreeThreat` (`src/content/call-trees/types.ts`) holds `label`, `minutes`, `text`, and optional
  `mark`, `moves` and `pressure`.
- A threat lands when the committed decision's game minutes reach `threat.minutes`
  (`matchedEffects`, `src/sim/operation.ts`). That runs in one place, so a replay matches the live
  commit.
- `threatTag` (`src/ui/screens/DecisionList.tsx`) marks a choice "Too slow" when the threat lands
  even if the choice goes well. It marks a choice "Risk" when only a worse band lets it land.

No call uses real time today. Clocks advance only when a decision is committed (`decisionMinutes`,
`src/sim/clocks.ts`), and the sim is seeded.

## Why the first idea changed

These are the findings from the adversarial pass that shaped the design:

- **Leaving the app is the wrong trigger.** On a phone, most players leave because something
  interrupted them. Punishing that punishes the way an idle game is played.
- **Two clocks in two units can't be read together.** A drain bar in real seconds next to a
  "5 min" threat in game minutes leaves the player unable to tell which one matters.
- **A hidden penalty on the next choice would make the preview lie.** The design skill says every
  adverse result traces to a cue the player saw. The prose skill says no preview reads softer than
  its worst result. A choice that shows "68% to go well" while carrying a secret debuff breaks both
  rules.
- **Real time in the sim breaks replay** unless it is recorded as an input.

## Dither minutes

While a decision point with a threat or a running clock is open, real time accrues **dither
minutes** at a rate set by the timer setting. Time away from the app accrues at the same rate.

1. **When the player commits,** the dither is added to the decision's game minutes. Clocks, cues and
   threats all move through the existing path (`decisionMinutes`, then `advanceTime`). Nothing new
   is applied on the side.
2. **The dither goes into the decision record** as an input, beside the choice and the band. A
   replay, the Scenario Lab and the fingerprints read it from there, so the sim stays pure. A
   decision recorded with no dither replays exactly as it does today.
3. **The cap.** Dither on one decision stops at the open threat's `minutes`. A long absence can land
   that threat, but never more than one, and never a clock run-out that the threat alone wouldn't
   reach. Without a cap, a night away would end the call.
4. **The previews stay honest.** As dither grows, the odds and each card's minutes read the dither,
   so the player watches choices turn too slow before committing. No change is hidden. The threat
   has one display, the strip's bar; a card's minutes turn red when the threat lands even if the
   choice goes well, amber when only a worse result lets it land (owner, 2026-10-20: no "Too slow"
   tag repeats the bar).
5. **A stall raises pressure, and the odds read it live** (owner, 2026-10-20). Each stalled game
   minute adds `CLOCK_RULES_V1.stallPressurePerMinute` (3) on top of the call's own rate and its
   gauges'. `stalledRun` (`src/sim/clocks.ts`) is the call as the stall has left it: the cards, the
   pressure meter and the commit's roll and strain all read it, so the odds the player watches fall
   are the odds the commit uses. The commit adds the stall's own pressure once; its minutes still
   pass through the decision's time. A 4 to 10 minute stall moves a choice 2 to 10 points.
6. **Zero lands the threat, on the screen and in the metrics** (owner, 2026-10-20). When the stall
   reaches the threat's minutes the threat has happened: the strip shows the line the player reads
   when it happens, and the projection counts its effects at once (`landingEffects`,
   `src/sim/clocks.ts`): its pressure, and its moves on the subjects. A threat that names no moves
   gives every subject who keeps meters `THREAT_LANDING_EVENT` (provoked: agitation up,
   rapport down), so it always reaches the person kept waiting; that agitation feeds the
   conversation odds and the stance branches (`src/sim/meters.ts`). The commit that follows applies
   the same landing once and gives every officer on it `CLOCK_RULES_V1.threat.strain` more strain.
   A slow choice that lands the threat costs exactly the same. The strip names each subject it wound
   up, with their stance and an agitation bar whose rise shows in bright red (`landingSubjects`,
   `src/ui/screens/fill-gauge.ts`), and the briefing's people panel reads the same projection.
7. **The result beat doesn't count.** A commit sets `OperationRun.decisionPending`; while it is set
   no stall accrues. The `openDecision` command clears it when the next decision shows (Continue,
   or a reload that comes back on the decision), once per decision and only forward.

## The bar

`ThreatPill` gets a bar that drains with the threat's minutes left after dither. The bar and the
"5 min" text show the same number, so the player sees one clock. When the bar is empty, the threat
lands on any choice the player commits.

**One pressure at a time** (owner, 2026-10-20). The strip shows a single pressure: the threat or a
gauge that fills, whichever bites soonest in game minutes (`leadingPressure`,
`src/ui/screens/fill-gauge.ts`). A threat bites when its minutes run out, a gauge at its next unheard
cue. A stopped or full gauge shows only when nothing else is open. Gauges move with the stall too.
The pressure reads calm, then warn under half its window, then critical in its last quarter or last
minute: heavier colour, a glow, and a two-beat flash as it tips over. It never loops, since the game
keeps one looping signal (`src/ui/motion.test.ts`).

## Settings

The owner asked for a drain with no start and stop (2026-10-20), so the reading floor is gone: the
bar moves from the moment the decision shows, and Relaxed runs slower instead. Off still adds
nothing, which is what meets WCAG 2.2.1 and the reading-pace guideline below.

| Setting | Reading floor before dither starts | Rate |
|---|---|---|
| Off | none, no dither ever | 0 |
| Relaxed (default) | none | 1 game minute a real minute |
| Standard | none | 2 game minutes a real minute |

The rates and floors go in `src/sim/tuning.json`. The setting persists outside the versioned save,
using the same approach as the content filters in `docs/content-rating.md`.

Accessibility sources, checked 2026-10-20:

- WCAG 2.2.1 Timing Adjustable lists ways to meet the criterion. Two are to let the user turn the
  limit off, or adjust it "over a wide range that is at least ten times the length of the default
  setting" ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html)). Off
  satisfies the first. If a later tuning drops Off, the range between settings has to meet the
  second.
- The Game Accessibility Guidelines include "Allow players to progress through text prompts at
  their own pace" as a basic cognitive item
  ([GAG](https://gameaccessibilityguidelines.com/full-list/)). The Relaxed reading floor and Off are
  how this design meets it.

## Push-back lines

When dither crosses a threshold before the threat lands, someone on scene reacts. The design reuses
the clock-cue shape (`advanceClocks` and `cueEffects`, `src/sim/clocks.ts`): the cue fires once,
carries a line, and can set a mark that later choices read.

- **The lines are written on the threat, per speaker.** Each line is in its speaker's voice and
  names something on the scene. They are written under `swat-call-prose`. There is no global pool
  of lines like "You're ignoring me!!!", because a shared pool repeats across calls, ignores who is
  speaking, and breaks the house rules on stock lines.
- **Optional.** A threat without lines stays silent, and the bar still drains.
- **When it fires.** At half the threat's minutes of dither, rounded down, and never before 2. A
  threat of 2 minutes or less has no line. A line whose threat has already landed when the player
  comes back is dropped, so nobody returns to a complaint and its consequence at once.
- **Any speaker (owner, 2026-10-20).** Lines are not suppressed by situation. The subject may
  speak one, a person at risk of self-harm included; the settings filter is how a player keeps
  those calls off the board (`docs/content-rating.md`). The lines still follow `swat-call-prose`
  and the prose lint as they stand.

## Gauges that fill

Threats drain; some pressures rise instead (owner, 2026-10-20): a crowd filming the scene, or the
subject going live. A fill is a clock with `direction: 'fill'` (`ClockDef`, `src/sim/scenario-types.ts`;
the content side is `Clock` in `src/content/incidents/types.ts`). It runs on the same game minutes as
everything else, so dither moves it too.

- **How it rises.** It starts at `start` and gains `ratePerMin` a minute. Its cues are listed lowest
  first and fire as it reaches them; `onFull` does at 100 what a drain's `onOut` does at 0. Like a
  drain that never runs out before a cue was heard, a fill never fills before one was heard in an
  earlier decision (`src/sim/clocks.ts`).
- **What it does, from its first cue.** Officers on scene take extra strain in proportion to the
  gauge, it adds to call pressure each minute, and the debrief multiplies the call's trust result
  by `1 + peak/100 × 0.5`, so a call handled well on camera earns more trust and one handled badly
  loses more (`CLOCK_RULES_V1.fill`, `src/sim/clocks.ts`). A cue can also move a subject with the
  `watched` meter event.
- **Stopping and slowing.** A choice stops a fill with `stabilize` (the stable flag) or slows it by
  setting a mark named in the clock's `rateFlags` (the slowest matching rate wins). Every such choice
  says what it costs in its summary, and the cost is real on every band.
- **Cued before it bites.** A fill's effects start at its first cue, so the line the player reads is
  the warning. Nothing about a fill is hidden.

The hostage call carries the first two (`docs/calls/notes/hostage-livestream-design.md`): the
regulars' phones at the tape, slowed by moving the tape back, and the taker's stream on the owner's
phone, stopped or slowed by asking the taker to stop streaming.

## Interruptions and nudges

- Backgrounding the app pauses nothing at Relaxed or Standard; only Off stops dither. The cap is
  what bounds the cost of an interruption.
- The open decision's start time is saved with the operation, so a close and resume counts time
  away once. A device clock moved backward never reduces dither or counts the same time twice.
- There are no push notifications that pull a player back into a call. A countdown notification is
  a time-pressure nudge, and this design rules it out.

## Scenario Lab

The play surface gets a dither slider. A designer can watch which choices turn too slow at each
setting, and check that no stage becomes a guaranteed threat at Relaxed.

## Balance risk

Dither adds minutes to every clock, not just to threats. Any rate above zero moves the
outcome-score calibration (`src/sim/outcome-score.test.ts`). The score test runs with dither at
zero. A separate test records the outcome shift at each setting, so the rates are chosen against
measured numbers.
