# Call presentation: audit and redesign

How a call is presented from the board card to the debrief, why it was rebuilt on 2026-10-20, and
the one motion pattern the game keeps. Screens are checked at the 390x844 phone target. Work still
to do lives only in [backlog.md](backlog.md).

## The audit (before)

Played *One Last Signature* (hostage) end to end at 390x844 on `claude/reconcile-main` (31a2aff).

| Stage | What the player saw | Where they lose their place |
| --- | --- | --- |
| Board | A 240px dispatch banner, then one call card per screen: plate, hook (3 lines, owner decision B5), squads, pay, time-left bar, Prepare. | Fine on its own. The only real cost is that the third call sits two screens down. |
| Prepare: briefing | Plate title with a **siren strobe** (2.5 flashes a second, once per mount), two step tabs, the cold open, threat, people, orders, conditions, map, a sticky Choose team footer. | The strobe competes with the cold open, which is the first thing to read. Otherwise the order (story, threat, people, orders, place) is right. |
| Prepare: team | Squads, auto-equip, loadout, warnings, Deploy in a sticky footer. | Toasts land on top of the sticky footer. |
| Live call | One page about five screens long: title with a **pulsing LIVE dot**, stage rail, clock and pressure pills, a briefing summary **clamped with an ellipsis**, "What happened", the stage label with the threat pill and its **ticking hourglass**, the prompt, the transcript, an instruction line, five tall cards, then the map (with **red and blue siren light** washing over it on a hot call), the four officer cards, the people at the call, care and support, and a floating **Next decision** button that exists because the choices kept scrolling away. | 1. **The team is 1,500px from the decision.** Each card names its lead ("Wu · Coord 69"), but the faces those names belong to sit under the map. 2. **After a decision the next prompt is below the fold.** The result card, its stress chips and details take about 500px above the new prompt, and the page scrolls itself to the top. The player reads the result, scrolls, and has to find where the new stage starts. 3. **Three clocks with no relation**: elapsed minutes and a pressure meter in the title, and the threat's minutes in a small pill beside the stage label that scrolls away with it. 4. **The stage name appears twice** (rail and label) and the prompt reads as a third heading. 5. **Reference and action are interleaved.** Briefing, result, prompt, choices, map, team, people and support share one column, so every visit means re-finding the choices. 6. **Truncation.** The briefing summary is cut at two lines. |
| Review sheet | Odds and harm in the header, then lead picker, summary, chips, the three outcomes, requirements, compare, why these odds. | Reads well. The threat isn't in view while weighing time against it. |
| Debrief | Plate hero with a stamp, three commendation marks that **pop in with a glow**, the ending, the epilogue, then scores, people, consequences, officers and the evidence. | The order is right. The pop is a celebration effect on a screen that may record a death. |

### Every pulse, flash and loop found

| Pattern | Where | Meant |
| --- | --- | --- |
| Amber ring pulse, 1.6s, forever | Ops button in the bottom nav (`.live-dot`) | An operation is running |
| Amber dot pulse, 1.8s, forever | Live title (`.live-dot-amber`) | This call is live |
| Hourglass rotating in two steps, 2s, forever | Threat pill | Time is running (it isn't: operation minutes only pass when a choice lands) |
| Red and blue glow across the map, 1.6s, forever | Live map on a hot call (`.siren-lights`) | Lights and sirens |
| Red and blue strobe, 2.5 flashes a second, once | Prepare title plate (`SirenFlash`) | A call is starting |
| Scale pop with glow | Debrief commendation marks (`mark-in`) | Celebration |

Five signals for three ideas, two of them saying the same thing, one implying a real-time clock the
game doesn't have, and none telling the player the one thing motion is good for: *you are needed
somewhere you aren't looking*.

## The redesign

### Principle: one beat per screen

Narrative mobile games (80 Days, Citizen Sleeper, Reigns) show the moment, let the player choose,
show what happened, and only then the next moment. Tactically Idle's writing needs the same rhythm.
The live call now alternates two beats, and the reference material moves out of the reading column.

```
 Board card ──Prepare──▶ Briefing ──Choose team──▶ Team & gear ──Deploy──▶
   ┌──────────────── live call ─────────────────┐
   │  DECIDE beat ──Review──▶ sheet ──Confirm──▶ RESULT beat ──Continue──┐
   │      ▲                                                              │
   │      └──────────────────────── next stage ◀────────────────────────┘
   └── the call ends ──▶ Debrief ──Close──▶ Board
```

### The live call: one screen (owner, 2026-10-20)

The first redesign split the live call into a Call view and a Scene view. The owner rejected the
split the same day, and the reason it was accepted no longer held: the threat now drains in real
time (dither, `docs/call-pressure.md`) and gauges fill, so the pressure, the place and the decision
belong on one screen. The live call is now one column with no view switch, in two beats.

**Head (scrolls away).** The call's name, which opens the briefing sheet; LIVE, the call's type,
Lights and sirens on a hot call, and Cancel; the clock and pressure pills.

**Strip (pinned).** The stage rail, the decision point's threat with its draining bar (decide beat
only), and a slim row for each gauge that fills (both beats, since gauges keep running). Everything
that runs down or builds up is in one place. On a short screen the stage labels hide and the rows
slim down; nothing is dropped.

**Scene.** Where the squad is ("Squad A at High street", and "Map changed" after a result that moved
something), the map in a short window showing the whole building, and the squad's faces once each,
with stress, tapping through to that officer's full card. The map folds to its one-line header
(remembered per browser) and opens itself on a result that changed the scene. Full map lays the
same map over the call, with the key, materials and rooms, so its pan and zoom survive.

**Story, decide beat.** The last decision folded to a row, the stage kicker, the prompt, the
transcript, then the choices. Opening a card to read it previews it on the map. The review sheet
opens with a small map of where the choice happens, because by the time the player reviews, the
scene's map has scrolled away. Care and support follow the choices.

**Story, result beat.** The result at full size with Continue pinned; the strip and the scene stay,
so the player sees on the map what the choice changed.

**Reference, in place.** The briefing (with who has been located) in a sheet from the title, a room
from the map, an officer from their face. The separate people list is gone: the map shows them.

The app's department header hides during a live call to give the call its height back; the save
warning stays.

### Prepare and debrief

Prepare keeps its two steps and its order, which the audit found sound. The siren strobe is removed
from the title plate. The debrief keeps its order; the commendation marks fade in with the rest of
the hero instead of popping with a glow.

## The one motion signal

**A slow amber ring that breathes out from a point, every 2 seconds, means "a call is waiting on
you, somewhere you aren't looking."**

- It appears in one place: the Ops button in the bottom nav, while a call is live or its debrief is
  unread, and only when the player is on another tab. On the Ops tab the player is already there.
- It never appears in the reading area. Prose, prompts, choices and results never move.
- Under reduced motion the ring is a still amber halo with the same meaning and label.

Everything else that blinked is replaced by a still form:

| Was | Now |
| --- | --- |
| Pulsing LIVE dot in the live title | Still amber dot and LIVE |
| Ticking hourglass on the threat | Still hourglass; the threat line's place in the call bar and its danger tone carry the urgency |
| Siren glow over the map | Removed. A hot call says "Lights and sirens" in the call bar's subtitle |
| Siren strobe on Prepare | Removed |
| Commendation pop with glow | Fade in |

Transitions that aren't signals stay: sheets and toasts sliding in, the blueprint drawing in, a
payout chip floating off the balance. They play once, carry no meaning of their own, and honor
reduced motion.

## Names in prose

Owner, 2026-10-20: "The symbols should not appear in prose." A name inside running text (orders, prompts, choices, results, transcripts, epilogues, the debrief, the Lab's script view) shows its role by color plus a non-color cue: the subject in bold, civilians in semibold, others at the scene in medium, officers in the condensed callsign face, and an unconfirmed name in italic. The underline is gone too, because on a phone an underlined word reads as a link. The symbol stays only where a name stands alone as a label: the person tiles and the Lab's people list. Captures at 390x844 (cropped from a smaller browser pane): `12-names-orders.png`, `13-names-prompt.png` and `14-names-result.png`. `src/ui/people/people-text.test.ts` fails if `PeopleText` renders a symbol, or if a new file starts using `PeopleGlyph`.

## Challenged before building

- **Result beat. Strongest failure:** an extra tap on every decision, and a player who wants the
  result while choosing has to open it again. A pacing tool can feel like friction in an idle game.
  **Alternative:** keep the result inline above the prompt, compacted. That is the current design,
  and the audit shows it is what pushes the prompt off the first screen. **Verdict: accepted with
  controls.** The Continue button names the next stage, so it is a reveal rather than a speed bump;
  the last result is one tap away above the prompt on the decide beat; the log keeps every result;
  and a reload lands on the decide beat with nothing lost, because results are saved on the run.
- **Call and Scene split (superseded 2026-10-20 by one screen). Strongest failure:** the map stops
  being seen, and the spatial facts (who is where, what changed) stop informing choices.
  **Alternative:** the single column with the map below the choices. **Verdict then: accepted with
  controls.** The one-screen layout replaced it once the threat drained in real time.
- **One screen. Strongest failure:** the map and squad take about 230px the story text used to
  have, and the writing is the main draw. **Alternative:** story first, map below the choices, which
  the audit found lets the choices scroll away from the map. **Verdict: accepted with controls.**
  The map folds to one line and remembers it; the review sheet carries its own map so the choice is
  seen in place; the head scrolls away so only the strip stays pinned.
- **Threat in the pinned bar. Strongest failure:** a pinned danger-toned line reads as an alarm
  that never stops. **Alternative:** keep the threat beside the stage label in the flow. **Verdict:
  accepted.** It shows only on the decide beat, it is still, and it is the one fact that changes
  what every choice costs, so it earns the pinned space.
- **One motion signal, nav only. Strongest failure:** a player inside a long result misses that a
  threat is near. **Verdict: accepted.** The threat is not a real-time clock. Nothing changes until
  the player chooses, so motion in the call would claim an urgency the game doesn't have.

## Played end to end (2026-10-20)

*One Last Signature* on a fresh campaign at 390x844, squad A, from the board back to the board. Captures in
[captures/call-presentation](captures/call-presentation/):

| Stage | Capture | What it shows |
| --- | --- | --- |
| Board | `1-board.jpg` | Call cards with the 3-line hook, pay and time left |
| Prepare: briefing | `2-prepare-briefing.jpg` | The cold open under a still plate (no strobe) |
| Prepare: team | `3-prepare-team.jpg` | Squad chosen, sticky Deploy footer |
| Decide, stage 1 | `4a-live-decide-top.jpg`, `4b-live-decide-choices.jpg` | Threat pinned under the rail, prompt, transcript, the squad's faces, then the choices with their lead and "Too slow" tags; the bar stays pinned while scrolling |
| Review | `5a-review-lead.jpg`, `5b-review-odds-certs.jpg` | Summary, then who leads with the trait the result reads; the odds breakdown with the certificate bonus under Preparation |
| Result | `6a-result-beat.jpg`, `6b-result-beat-continue.jpg` | The result at full size with its transcript and stress, Continue naming the next stage. `6b` was taken before the result beat stopped repeating the next prompt as a "Next" line |
| Decide, stages 2 and 3 | `7-decide-stage-2.jpg`, `8-decide-stage-3.jpg` | Last decision folded to one row, a new threat with each stage |
| The one signal | `9-nav-waiting-signal.png` | On HQ mid-call, the ring on Ops; the page's only looping animation (checked in the browser) |
| Debrief | `10a-debrief.jpg`, `10b-debrief-scored.jpg` | Ending, epilogue, still marks; scoring and consequences |
| Board again | `11-board-after.jpg` | The call gone from the board |

`src/ui/motion.test.ts` holds the motion rule: it fails on any repeating animation in `src/ui` other than the Ops ring.

## The Scenario Lab

The lab's play frame (`src/dev/lab/surfaces/play/GameFrame.tsx`) uses the same beat state as `OpsLive`. A lab confirm opens the result beat. A step or rewind opens on the decide beat (`beats.test.ts`).
