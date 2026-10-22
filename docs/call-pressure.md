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
- The chat builds toward the threat on the gauge, so a threat about viewers shows viewers doing it
  (2026-10-22). It reads like a real live chat, written per subject and never drawn from a global
  pool. Specified below, not yet built.
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
  `src/content/incidents/reactions.test.ts` checks pool sizes, length, banned characters, gendered
  words and three lint patterns. It does not check tone: that viewers are people, with no gore and no
  cheering force, is a read (`swat-writing-review`). Today the chat reads only the source's cue count. The
  rule that ties it to the open threat is below, under "Chat that follows the pressure".

The older fill effects still apply from a source's first cue: strain on officers at a commit, call
pressure a minute, and the debrief's audience factor on trust (`CLOCK_RULES_V1.fill`).

## Chat that follows the pressure

**Status.** Specified 2026-10-22 and not built. What ships today is the cue-keyed chat above. The
data shape, the phase pools and the gates are engine and tooling requests, and the writing rules are
in `swat-call-prose` (`references/live-chat.md`).

**Why.** A gauge that says viewers are closing in on the store's address, with ten minutes left,
promises something the chat has to show. Measured on Going Live 2026-10-22, the chat read the
stream's cue count and nothing else. One minute before "Address posted by itskatlun" landed, the
chat was saying "my order from there was late too", and the named poster never typed a word.

**The rule.** The chat has two keys, and every line the strip shows comes from one of them.

1. **The open threat and how far it has drained.** The drain is the stall over the threat's
   minutes. It has three phases, in thirds: early (under a third), closing (a third up to two
   thirds) and imminent (two thirds to the landing). Each phase has its own ordered thread, written
   for that threat.
   - Early: the thing is noticed. Someone asks the question and one viewer is curious.
   - Closing: what the viewers know gets narrower and more certain, and someone objects.
   - Imminent: it is about to happen. Pile-ons, objections, and the poster's own line.
   The arc depends on the threat. A threat about viewers finding something out (the address, the
   clip) narrows. A threat about the rider (stands over the manager, a call from home) is the chat
   reacting to what the camera shows or stops showing. A threat about the news is the viewers
   noticing it. The reference lists the arcs (`live-chat.md`).
2. **The source's state.** Short pools for the moment the stream is stopped (cut), slowed (the
   camera turned to the wall), surged (the rider playing to the chat) or dropped (the count falls
   by a seventh or more, as when a second phone takes over).

**Timing.** A phase lasts a third of the threat: 20 to 26 seconds at Standard, 40 to 52 at Relaxed
(10 to 13 game minutes). At the strip's pace (one line every 2.2 to 5 seconds, 1.6 at the least) a
phase has about 8 ticks at Standard and 15 at Relaxed. So:

- A thread holds 5 to 7 lines a phase. Three ticks in four play the thread, one plays filler from
  the cue pool. In imminent there is no filler.
- The first line of a phase plays as the drain enters it, not after a gap, and every line stays up
  at least 2.4 seconds.
- Each thread's first line carries the threat (a question, a guess, a name), because a player who
  reads for 20 seconds at Relaxed is still in early. Off-topic lines come after it.
- The last line of imminent is the reserved slot, and the poster's line when the threat names one.
  It plays when the drain passes nine tenths and is never skipped. Earlier lines the drain has
  passed are dropped, so the chat is never behind the gauge.
- A line may carry `after: <beat id>`. It doesn't play until that beat has fired. A line that says
  what a beat reveals carries it, and that is how a viewer's guess stays behind the radio's report.

**Precedence.** One state at a time wins, in this order: stopped, then the state pools (dropped,
slowed, surged) at their onset, then the thread, then filler. A state pool plays in order once at
onset and then the thread resumes. After a stop the chat goes quiet, so a threat on a node that can
only be reached once the stream is stopped has no thread and says so (`chat: false`, which a gate
checks against the call graph). A stop also ends any cue text the comms log would still play from
the dead stream (teardown finding 16).

**Lifecycle.** The chat plays only while the decision is shown. A result hides it, and nothing
is consumed while it is hidden: no line is marked seen, and a state pool waits for the next
decision. The ticker is keyed by decision, so a new node starts a new thread with the visible lines
cleared. A spent chat never freezes on two stale lines. Once the thread and the cue pool are spent,
joins play on a timer, whether or not the count is climbing, and a visible line fades after 12
seconds. The chat is presentation, so a reload or a replay shows a fresh chat, never the same one:
the sim and the Lab reproduce the call, not the chat. Within a run a speaker's handle is kept with
its line, so a remount never gives one handle two lines.

**What a thread may say.**

- **It reaches the threat's own noun and stops one step short.** A thread about an address names
  the corner and the shop next door. It never states the landing. The landing is the threat's text
  and nothing else says it. When a beat already reports an earlier piece of the same event, the beat
  and the landing are reconciled before any chat is written (the teardown's findings 16 and 17 are
  two such). A thread dramatizes a beat in the phase it fires in, behind its `after`.
- **The named poster speaks.** When a threat's label or text names a `{handle}` commenter, that
  commenter's own line is the last line of imminent, under that handle.
- **It knows what a viewer knows.** The picture and sound of the rider's phone, the comments, the
  news, the courier at the tape and the viewers near the scene. It doesn't know radio traffic,
  officers' positions the camera can't see, or any hidden fact. The chat is public and identical in
  every situation. A viewer may repeat a belief the call has already put on the page as the
  audience's belief and may be wrong. A viewer never states a new hidden fact as certain.
- **It stays inside the ethics.** No line glorifies the subject or force, dares or tells anyone to
  hurt anyone, jokes about harm to a named person, names a method or says the rider should hurt
  themselves or anyone else (E2, E4.1, E4.9, E7, E16). No line pressures the hostage to give in to
  the demand, or the rider to carry on, so "make her say it" and "say it louder" are out. Nobody
  tells the others to go to the scene. A line that reports someone going is allowed, and the chat
  answers it. The self-harm rules stand and the 988 line stays in the debrief (E4.7). Emoji are
  judged against the event and the lines beside them, not only the line (the reference lists them).
- **It reads like a live chat.** Short lines, handles, joins, a regular acting as moderator, repeats
  and pile-ons, emoji on some lines, rare typos. The writing rules and the numbers are in
  `swat-call-prose` (`references/live-chat.md`).

**What the engine needs** (requests, not built):

- `TreeThreat.chat` with the three phase threads (or `false`), `PressureSource.reactions` with
  `stopped`, `slowed`, `surged` and `dropped` pools, and a chat line that can carry its speaker and
  an `after` (`src/content/call-trees/types.ts`, `src/sim/scenario-types.ts`, the compiler's
  binding, `FillView.surged`). `FillView.stopped` today also means the owner is safe or out
  (`sim/clocks.ts`), so the request settles whether a stop pool means "the stream went dark".
- Later, `chatIf` on a threat: extra early lines when an earlier choice's mark is set, so the chat
  remembers that the door was seen or the lie was found (the same `when` shape as `promptIf`).
- A `{street}` token for the front street's name, so viewers can guess a street that matches the
  map. Until it exists, chat names no street.

**What a gate can and can't check.** Gates (a tooling request) cover shape and wording: every
reachable-with-the-stream threat has all three phases at their floor, line length in graphemes, the
banned characters and words, no repeated line or four-word run across the call's whole chat, the
emoji allow list and share, no emoji beside a harm word, the poster's line present and last, `after`
naming a real beat, and a state pool wherever any effect (a choice, a beat or a threat) can stop,
slow, surge or drop the stream. A playback test at both timer speeds checks that the first on-topic
line plays within 3 seconds, the reserved line plays before the landing, and no thread line plays
after its phase. Gates cannot judge whether a thread reads as real, whether it narrows, whether a
line leaks the outcome or a hidden fact, whether a beat is dramatized, or whether an emoji
trivializes. Those are the writer's read and `swat-writing-review`'s chat read.

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
