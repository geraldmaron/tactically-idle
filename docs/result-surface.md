# The result surface: knowing how a decision went at a glance

Owner request, 2026-10-24: move "What happened" higher, give the player a quick way to read how a
decision went (a color ring around the screen frame on first load), make every transition smooth,
and give page sections some texture so they stop feeling flat. Define an approach, pit it against
what is in place, break both, and let sol challenge the path.

Status: built 2026-10-24 on sol's path (the decision at the end). The first draft below is kept with its
red team, because the decision cuts most of it.

## What is in place (measured on 2026-10-24, 390 wide)

- Result beat order: pinned header, strip, the scene panel (building art, map, four faces), the
  people panel, then "What happened", then Continue (`LiveView.tsx` `sceneSection` before `story`).
  On a phone "What happened" starts about two screens down, so the first thing after a commit is a
  scene the player has already read. A lapse ("No call made", "Time ran out") is invisible until the
  player scrolls.
- The verdict is one small chip inside the card (`ResultPill`: Went well, Complications, Went badly,
  Time ran out). The decide beat folds the last result to one row above the prompt.
- The urgency ring already exists on the decide beat: `.live-urgency-*::before` is a red fixed inset
  glow that tightens as the threat closes, and a red-and-blue wash on hot calls.
- Beat changes swap content at once and `revealLastDecision` jumps the scroll. The strip's drain bar
  and the pill transition their own widths and colors, nothing else does.
- Sections (`.section`, `.section-head`, `.panel-well`) are flat fills with a hairline and a top lift
  edge. The only depth is the lift shadow and the pressed well.

## Approach: verdict first, one ring, one telling

1. **Order.** On the result beat the verdict band sits directly under the strip and "What happened"
   follows it, then Continue, then the scene folded to its one-line form. The decide beat keeps the
   scene first (owner 2026-10-24), and its folded "Last decision" row takes the verdict color on its
   top edge, so the last result stays readable while choosing.
2. **Verdict band.** One row, the same height every time: the band icon, the word (Went well,
   Complications, Went badly, Time ran out), the decision's name, and the moved scores as pills.
   It is the one telling of the band. The card below keeps the story and drops its own chip.
3. **Verdict ring.** On entering the result beat a ring in the verdict color draws around the
   frame of the live column (not the browser window): 4px at full strength for about 1.2 seconds,
   then it settles to a 2px edge held for the beat and fades out on Continue. Colors are tokens
   (mint, amber, harm, and a neutral blue-gray for a lapse) and never carry the meaning alone: the
   band has an icon and a word. Under reduced motion it appears at the settled 2px and never draws.
4. **Smooth transitions.** One shared 240 ms ease for the beat swap: the outgoing stack fades and the
   incoming one rises 8px as it fades in. Scroll to the band is `scrollIntoView` with smooth
   behavior (instant under reduced motion). The ring and the urgency glow crossfade over 300 ms
   instead of switching.
5. **Texture.** One surface treatment from tokens: a fine grain tile (inline SVG noise, no color
   literals, 4% opacity, no blend modes) under the section body, a 1px light edge on the top of the
   section head, and a faint diagonal hatch in the head only. Text always sits on a solid-enough
   fill, so contrast is measured on the flattest part of the grain.

## Breaking what is in place

| Attack | What fails |
|---|---|
| Read the first screen after a commit | It shows a scene the player has seen. The outcome is two scrolls away. This is the owner's complaint and it is true. |
| Miss a lapse | A lapse changes who is inside and nothing at the top of the screen says so. |
| Color blind or glancing | The only band signal is a small chip in the middle of a card. Nothing works at arm's length. |
| Replay a long call | Ten decisions in, the player has no sense of the run's shape: the log is a sheet behind a button. |
| Reduced motion or slow phone | Fine, because almost nothing animates. That is a symptom: the jump scroll and the instant swap are abrupt. |

## Breaking the proposal

| Attack | What fails | Mitigation or verdict |
|---|---|---|
| Three tellings | Ring, band and card chip all say the band. `docs/ops-experience.md` ("The result beat: one telling") bans repeating the result. | The band is the one telling, the card drops its chip, and the ring is a frame, not text. Accepted with controls. |
| Two red rings | Urgency glow on the decide beat is red, a "Went badly" ring is red. A lapse after a critical drain would look like the same signal continuing. | Verdict ring is a solid inset line, urgency stays a soft glow. They never share a beat. The adverse ring uses the harm token. Needs validation in a screenshot at both. |
| Ring on a desktop window | `position: fixed; inset: 0` rings the browser, not the phone column, and the Lab frame. | Attach to `.live`, which is the column. Needs validation in the Lab at desktop. |
| Order flip breaks muscle memory | Players who learned "scene, then story" now see the story first on one beat and the scene first on the other. | The scene stays one line under Continue on the result beat, and the decide beat is unchanged. The risk is real and is the strongest argument against. |
| Flashing | A 1.2 second ring plus the wash on a hot call. | One draw, no loop, under 3 flashes a second, off with Flashing lights, static under reduced motion. Accepted. |
| Texture costs paint | A grain tile behind every section on a low-end phone. | Static tile, scroll attachment, no blend. Needs a measure on the oldest target phone. |
| Texture hurts reading | Grain under 16px text drops contrast. | Measure on the flattest and brightest grain pixel against 4.5:1. Cap opacity where it fails. |
| The ui gates | R8 (no color literals), R1 (no raw spacing), the tap budget, `ui-debt.json`. | Tokens only, no new raw lengths, one new band row adds no tap. |
| Scroll anchor | The sticky Continue and the band both want the first screen. | The band is 56px, Continue is pinned, the card scrolls between them. Needs validation at 320x568. |

## Open for sol

1. Is "verdict first" the right order, or should the band pin to the strip across the decide beat too?
2. Is a ring around the frame the right quick reference, or is it a gimmick next to a band that
   already says the same thing? What would you cut?
3. Break the texture plan. Is grain the wrong tool for flat panels? What else would give depth
   without paint cost (layered surfaces, shadow, a per-panel tint by tone)?
4. Which of the two (what is in place, the proposal) breaks worse, and what is the smallest path
   that fixes the owner's complaint?

## Sol's challenge and the decision (2026-10-24)

Sol read the files and broke both designs. Verified by reading code, not by running it. What it found:

- **Current.** The result loses to reference material (`LiveView.tsx`: the scene and people panels render
  before the story). The Flashing lights setting gated the wash but not the light bar. The amber pill
  has no amber (`.chip-amber` only sets text color). The jump scroll was already smooth, and the panel
  tokens were deliberately flat (`--shadow-panel: none`), which is why sections read flat.
- **Proposal.** Four verdict colors cannot say a task worked but someone was hurt. A fixed 56px band
  clips at 320. `.live` grows, so a ring on it surrounds the content, not the screen. The wash could
  survive into the result through the gauges. Crossfading urgency into the verdict contradicts "never
  share a beat". A separate band repeats what the card's pill already says.

Decision, accepted with controls:

1. **Order.** On the result beat "What happened" is the first thing under the strip, the existing card
   unchanged, with the scene and people under it and Continue pinned at the foot of the whole call.
   The decide beat is unchanged. No new band.
2. **Frame.** One steady 2px edge around the phone column in the verdict's color, fading in once with
   the result. `.live::before` is fixed, and `.app` contains its fixed children (it is a size container),
   so the edge follows the phone column on desktop and inside the scaled Lab. The decide beat's urgency
   glow uses the same layer and the two never share a beat. The wash is off on the result beat.
3. **Verdict color** is read from the saved decision (`verdict.ts`): a band, a lapse as amber, a task
   that hurt someone never green (wounded is amber, serious or fatal is the harm color), and a drawn
   use of force or an authored event neutral. The words (pill and title) say the same, so color never
   carries it alone.
4. **Transitions.** One opacity fade for the result card, keyed to its revision, and the frame's own
   fade. No translation, no crossfade, no View Transitions. Reduced motion shows both at once.
5. **Texture.** No noise or hatch. The panel, bar and well tokens carry depth: a panel is lit from above
   with a 1px light line and a soft lift, the bar is a plate with the same line, a well is pressed in.
   Gradients and shadows cost no paint beyond the flat fills.
6. **Also fixed:** the light bar follows the Flashing lights setting.

Residual risk: rendered fit at 320x568, contrast of the light line on the brightest panel, and paint on
an old phone were not measured. The ring and order were checked in the Lab at 390 only.

## The people list (owner, 2026-10-24: "too prevalent, large and overbearing on so many screens")

Sol's read (code only, nothing run): the live "People inside" panel lists out-and-safe people as if they
were inside, repeats the briefing's identities on every decide, and spends about 320 to 380px at 390
wide before the prompt. The briefing's rows earn their space (they carry the orders). A faces-only strip
fails on identity (seeded silhouettes), on status (the Unverified and Confirmed chips are real
information) and on taps. Built from that, in the small:

1. **Live result beat:** no roster. The result card names who changed, and the next decide shows the roster.
2. **Live decide beat:** the panel lists only people still inside or unaccounted for, two lines a row (name
   with its kind, then where and how), and counts the people who are out in its tally ("2 out"). When
   everyone named is out it is one line, "Everyone named is out."
3. **Briefing:** unchanged (one list, orders on the rows).

Not done, and the next steps if the owner still finds it heavy after a look: debrief outcome rows to
64 to 80px and ahead of the rewards, the changed people's faces inside "What happened", and the Lab
frame showing the same one roster as production. Heights above are CSS estimates, not measurements.
