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

### The live call

**Call bar (pinned).** One compact block that never scrolls away: the title, LIVE, the clock and
pressure, the stage rail, and a two-way switch between **Call** and **Scene**. On the decide beat
the decision point's threat sits in the bar as a full-width line ("Indigo edges for the door · 4
min"), so it stays in view while the player reads the choices and while the review sheet is open.
It is the only place the threat is shown; each card's "Too slow" or "Risk" tag points back to it.

**Call view, decide beat**, top to bottom in story order:

1. *Last decision*, folded to one row ("Walk Indigo out now · Went badly"), opening in place to the
   full record. The player has just read it on the result beat.
2. The stage kicker ("Stage 2 of 3") and the prompt as the hero prose, unclamped.
3. The transcript, "On the line".
4. **Who's on it**: the squad's faces with name, stress and the leader, and the squad picker when
   more than one squad is deployed. It sits directly above the choices because every card names
   one of these people as its lead, and the review sheet lets the player swap the lead.
5. The choices, unclamped. No instruction line: the cards say what they do.

**Call view, result beat.** After a confirm the view becomes the result: stage and choice, the
band, the narrative, the transcript of what was said, what changed, stress on the team, and a
pinned **Continue** button naming the next stage ("Continue to The till"). Continue reveals the next
prompt, its threat and its choices together, at the top of the view. When the decision ends the
call, the debrief opens instead, as before.

**Scene view.** Everything the player consults rather than reads: the full briefing (never
clamped), the map with its key, materials and rooms, the full officer cards, the people at the call,
and care and support. The map stays mounted while hidden, so its pan and zoom survive the switch.
The Scene switch carries a static dot when the last decision changed something on the map.

The floating Next decision button is gone: nothing sits between the player and the choices anymore.

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
- **Call and Scene split. Strongest failure:** the map stops being seen, and the spatial facts
  (who is where, what changed) stop informing choices. **Alternative:** the single column with the
  map below the choices. **Verdict: accepted with controls.** Each card already says what it targets
  and the review sheet names the place; the Scene switch shows a dot when the last decision changed
  the map; room taps from Scene still open actions; and the map stays mounted, so returning to it
  costs nothing.
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
