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
4. **The previews stay honest.** As dither grows, `threatTag` and the odds read the dither minutes,
   so the player watches choices turn "Too slow" before committing. No change is hidden.

## The bar

`ThreatPill` gets a bar that drains with the threat's minutes left after dither. The bar and the
"5 min" text show the same number, so the player sees one clock. When the bar is empty, the threat
lands on any choice the player commits.

## Settings

| Setting | Reading floor before dither starts | Rate |
|---|---|---|
| Off | none, no dither ever | 0 |
| Relaxed (default) | scales with the length of the stage text | slow |
| Standard | short | full |

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

## Interruptions and nudges

- Backgrounding the app pauses nothing at Relaxed or Standard; only Off stops dither. The cap is
  what bounds the cost of an interruption.
- The open decision's start time is saved with the operation, so a close and resume counts time
  away once. A device clock moved backward never reduces dither or counts the same time twice.
- There are no push notifications that pull a player back into a call. A countdown notification is
  a time-pressure nudge, and this design rules it out.

## Scenario Lab

The play surface gets a dither slider. A designer can watch which choices turn "Too slow" at each
setting, and check that no stage becomes a guaranteed threat at Relaxed.

## Balance risk

Dither adds minutes to every clock, not just to threats. Any rate above zero moves the
outcome-score calibration (`src/sim/outcome-score.test.ts`). The score test runs with dither at
zero. A separate test records the outcome shift at each setting, so the rates are chosen against
measured numbers.
