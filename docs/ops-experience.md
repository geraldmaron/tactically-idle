# Ops experience: audit, challenge and redesign

**Status (2026-10-21):** proposal. Nothing here is built. The work is in
[backlog.md](backlog.md) as `ops-experience-now` (accepted with controls) and
`ops-experience-compare` (needs the owner's comparison). This doc builds on
[call-presentation.md](call-presentation.md) and the decisions recorded in
[game-ux-direction.md](game-ux-direction.md). Where it reverses one of those, it says so.

## Recommendation

Keep the flow's structure (board, two-step Prepare, the live call in decide and result beats,
debrief) and the department navigation. Fix the five places where the screen puts the wrong thing
first:

1. **Result beat:** today the result text starts below the first screen. Put the result first.
2. **Review sheet:** put the cost and the three outcome previews above the map.
3. **Brief:** lead with the orders and the threat. The cold open stays whole.
4. **Team & gear:** turn the gear form into a kit summary per squad, with the full workspace one
   tap away.
5. **Board card:** shorten it to about 290px. It keeps everything the owner asked for on it.

Two changes need the owner to compare candidates before either ships. The first is how the live
decide beat shares space between the scene and the story. The second is whether the story text
gets a reading serif.

The first draft went much further: an "operation mode" that hid the navigation, a board of rows,
a brief that started with the map, and a scene cropped to the squad's area. Codex's adversarial
review rejected it as written, and its main objections held up against the code. The rest of this
doc shows what changed and why.

## Audit: the flow as played

*Going Live*, fresh campaign, squad A, 390x844, on `claude/content-warnings-draft` (42e37d1). The
captures were driven headless in a fresh browser context: the board, Prepare, every decide, review
and result beat, and the debrief. The contact sheets are in
[captures/ops-experience/current](captures/ops-experience/current/).

| Step | What was measured | Where the player loses time |
| --- | --- | --- |
| Board (`a-board`) | Three cards of about 420px each, all *Going Live* on different buildings (separate incidents, `boardPlan` in `src/ui/screens/helpers.ts`). Each card repeats the content warning and "No penalty for skipping this call". Under them the casebook has two filter rails for one entry | The decision (which call, is my squad fit) sits under repeated warnings. The hostage-crisis type mark is a padlock (`incidentMeta`, `src/ui/components/incident.tsx`), so the card reads as locked |
| Prepare: briefing (`b-brief`) | 2,396px. Cold open, threat, four people with full bios, then the orders about 1,400px down, unknowns, conditions, full dispatch, and the building map last | A player who skims never reaches the orders. The order (story, threat, people, orders, place) was kept on purpose in call-presentation.md, and that decision is reopened here for the orders only |
| Prepare: team (`c-team`) | 1,766px once a squad is picked. Squad cards, auto-equip, start position and staging point, eight gear steppers, support vehicle | The gear allocation is real and gates actions, but it takes the whole screen on every call |
| Live, decide (`d-live`, `g-decide`) | 1,806 to 1,969px. The story starts about 660px down, under the strip, the map (230px), the squad and the comms log. The first choice is at 1,282px | The prompt and the choices are not on the first screen on stage 1 |
| Review (`e-review`) | Title, odds, a small map (130 to 180px), summary, pull, then the requirements and Confirm | The cost and the outcomes come after the map |
| Result (`h-result3`) | The result text starts at 708px, where the pinned Continue footer begins | The first screen shows no result at all. Raw numbers follow ("Pressure −3.5") |
| Debrief (`i-debrief`) | Ending hero, support note, completion, people, rewards, scoring, officers, four disclosures, Close | The order is sound. It ends on Close with no next action |

Corrected after review: prompts are already 17.5px with 1.5 leading
(`src/ui/screens/live-call.css`), "Call resolved" is the completion and not a repeat of the
grade (force and partial closes cap the marks separately), and the leads on the choice cards
repeat a name but carry different skills.

## Challenged: what Codex rejected and what replaced it

Codex reviewed the first draft against the code and the decision docs. These are its verdicts,
and how each one was handled.

| Draft idea | Strongest failure (Codex) | Verdict | Now |
| --- | --- | --- | --- |
| Operation mode: hide the nav and the header from Prepare to Close, with only a stand-down exit | A player who wants Squad or Gear mid-call has to end the call. Cancel is refused once a decision lands (`src/sim/operation.ts`) | Rejected | Keep the nav and leave the call resumable. A focus mode is only possible later, with a leave-and-return action separate from cancel |
| Board as 96px rows, with the hook, warning and pay in a sheet | Players have to open each call to compare. The 3-line hook, the visible pay and warnings that are on by default are owner decisions | Rejected | Shorter cards that keep all of those (mockup 1) |
| Brief map first, with the cold open folded to 3 lines | A skimmer deploys without the person's motive, and the main draw becomes optional | Rejected | Orders and the threat first, the cold open whole, the map one tap from the header (mockup 2) |
| Kit as defaults | Scarce gear goes to the wrong squad, and a chip row hides shortages and gated actions | Accepted with controls | A summary per squad showing allocation and shortages. Adjust opens today's workspace with presets (still gated by their unlock) and undo. Start position and staging stay two labeled controls. Up to three squads (mockup 3) |
| Story first, with a cropped scene strip and What matters now deleted | A crop hides another squad or a civilian, and a 2-line radio excerpt drops a beat. Both reverse documented owner decisions | Needs validation | Two candidates for the owner to compare (mockups 4A and 4B). What matters now and the per-card leads stay |
| Review with outcomes first | Requirements, the lead, authorization and resupply are controls, not reference | Accepted with controls | Cost and previews first, every control kept, the map as a labeled inset (mockup 5) |
| Result first | A "Changed" summary of adjectives hides an injury or a used supply | Accepted with controls | The result and any recorded harm first, then facts, injuries, supplies and stress-band crossings. Raw numbers fold into Details. The final decision, which goes straight to the debrief, gets the same order (mockup 6) |
| After-action report with Rest and Back actions | Rest before settlement leaves officers assigned and the rewards unpaid | Accepted with controls | Close settles first (`closeDebrief`). A Rest offer follows, for anyone strained or worse, and it respects the Watch Commander's policy. Archived reports stay action-free |
| Reading serif and fewer bordered cards | A serif wraps longer and pushes the first choice down at 200% text | Needs validation | Same prompt in both faces (mockups 7A and 7B), judged at 320px and 200% text |

Codex also named things the draft missed, which every change below must hold:

- **Accessibility and sizes:** 44px targets; keyboard routes to anything a map tap does; focus
  return on sheets. Check at 320px, at 200% text, and with long names. Keep the strip's escape
  hatch: below 520px of height it scrolls with the page instead of pinning.
- **Stillness:** an inline radio line needs a reserved box, or new lines move the choices. The
  comms log does this today (`CommsLog`).
- **Motion:** the light bar and the source chat are approved signals beside the Ops ring. Each
  layout says what reduced motion does and where mute and the timer setting live.
- **Multiple squads:** focus changes who acts, and a supporting squad is chosen in the review.
  Every candidate is checked with two squads deployed.
- **Re-entry:** the result beat is local UI state, so leaving Ops and coming back lands on the
  decide beat (results stay in the log). The visibility pause lives inside `OpsLive`, which
  unmounts on a tab change. Test leave, reload and background on every candidate.
- **Scenario Lab:** it renders `CallTile`, `PrepBriefing`, `LiveView`, `ActionSheet` and
  `DebriefContents`. Changes go into those shared pieces, not into the app shell, or the Lab drifts.
- **Idle loop:** the empty board and the next-arrival line stay. So does access to department work
  between calls.

## The redesign, screen by screen

Mockups at 390x844 are in [captures/ops-experience](captures/ops-experience/), drawn from
[mockups/ops-experience/index.html](mockups/ops-experience/index.html) with the game's tokens and
*Going Live*'s text. The pink notes are annotations, not UI.

1. **Board card** (`board.png`). The type mark is a letter badge instead of the padlock. The hook
   keeps its 3 lines. The warning shrinks to one line. Place, squads and fitness ("1 squad, Alpha
   ready"), pay, expiry and Prepare stay on the card. "No penalty for skipping" is said once in
   the board header. The casebook keeps its always-visible filters, which follows the disclosure
   rule. Moving the casebook off the board is separable work.
2. **Brief** (`brief.png`). A "Your orders" panel comes first: the numbered orders and the threat
   in one line (holder, weapon, place, source). Then the cold open, whole. People, unknowns,
   conditions and the building follow in today's order. A Map chip in the header opens the map at
   any point.
3. **Team & gear** (`team.png`). Each chosen squad shows its faces and readiness, its kit as chips
   with shortages marked, and its start and staging in words. Adjust kit and Change staging open
   today's controls. Unpicked squads collapse to one row.
4. **Decide beat, two candidates.** Both keep the pinned strip as it is.
   - **4A, compact scene** (`decide-a.png`): the whole building at 150px beside the squad's faces
     and the last decision, then the prompt, a reserved radio line, and the choices. The prompt
     and the first choice are on the first screen.
   - **4B, scene folded** (`decide-b.png`): today's layout, with the map folded to its header from
     stage 2. It reopens itself when a result changes the scene, as it does now. This is the
     smallest change, and it keeps What matters now.
5. **Review** (`review.png`). Odds, harm and time, then the cost and the three previews (goes
   well, mixed, goes badly), then who acts and leads with Change, then the map inset with the
   room lit.
6. **Result** (`result.png`). What was chosen and how it went, the result in full, its transcript,
   then *What changed*: learned, injured, supplies, the team's stress bands (only crossings are
   named), and the scene. Continue names the next stage.
7. **Reading face** (`type-ui.png`, `type-serif.png`). The same stage 1 prompt in Barlow (now)
   and in Source Serif 4.

## How the comparisons get decided

For each of 4A against 4B, and 7A against 7B, build both behind a dev setting and play *Going
Live* through all three stages twice. Check at 390x844 and at 320x568, with 200% text, with two
squads deployed, and once with a threat that lands. The owner judges three things:

- Can they say who acts, who is in danger, and which choices the stream makes harder, without
  scrolling?
- Does anything move while they read?
- Does the prose read better? This one is for 7 only.

Record the verdict in this doc and delete the losing candidate.
