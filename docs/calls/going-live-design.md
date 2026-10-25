DRAFT (the separate writing review at 390px, the Codex cold read and the owner's read of the 2026-10-24 rework are not done: `going-live-review`)

# Going Live: design sheet

> **Reworked 2026-10-24** after sol's review (`notes/going-live-sol-review-2026-10-24.md`, verdict
> reject). Sections below this box and the 2026-10-23 box describe earlier versions where they differ.
>
> **The ranked top ten, and what changed.**
>
> 1. `threat.talk_down` adverse: the fixed `officer: 'wounded'` is gone. One `fire` draw decides who
>    is hit, and the `fired_on` prompt says an officer is down and waiting for an ambulance, never
>    "with a medic". The option is now talking from cover on the register line, not standing at the glass.
> 2. The lie: `lied_clerk` settles once, as `lie_found` (discovered) or `lie_owned` (`own_lie`), both
>    setting `lie_settled`. Every outcome that brings the courier out while it is open carries
>    `foundOut`, which breaks `clerk_backs` with its own line, so a walk-out never leaves it held. The
>    lie also hides `walk_live` (the courier waits for the clerk on camera first) and costs -6 on
>    `walk_dark`, `send_clip`, `honest_next` and `manager_first`. **Owner decision O1** below covers
>    the two death endings.
> 3. `camera_wall` is offered only without `counter_seen` (set by `watch_feed` and `move_up_dark`),
>    so its cost, "Your squad loses its only picture of {rider}'s hands", is true wherever it shows.
>    It sets `no_picture`, read by both `go_in` options (-6) and the `threat` prompt (sound, no picture).
> 4. and 6. Evidence and endings: a walk-out ends `out_cleared` only after `proof_seen` (the porch
>    clip, its address and label checked) or `admitted_live` (the manager naming the clerk on the
>    stream), through `walkOutEnding`; hidden truth no longer picks the ending. Reveals of
>    `rider_clear` in situation 2 come only from evidence of retention: the courier's own Tuesday
>    stream with the bag after the delivery time (label matched), or the courier's own words.
>    Pickup footage and the app's entry reveal nothing. The cooler comment is recorded as an
>    account, never proof. `rider_clear` is now "kept the order", not "took the bag".
> 5. The cold open says the order is logged as collected at 11:40. In situation 1 the clerk logged it
>    and took it before the courier came; in 2 and 3 the courier collected it just after 11:40. The
>    courier's red light at 11:40 is true in all three and proves only that the log time is off.
> 7. Every preview whose band can reach `turnsOn`'s threat names the handgun.
> 8. Stream state: `cut` and `stream_off` both set `stream_down`; `ON_STREAM` and `STREAM_DOWN` gate
>    filming and comment lines (`manager_first` mixed, `phone_down` mixed, `last_word_stream`).
>    `off_camera` now drops the count to zero, so a stopped stream stops weighing on the odds.
> 9. Doors: the clerk starts in the stockroom (`place: { rooms: ['storage'] }`). The shortest way out
>    of it crosses the shop floor on 52 of 60 sampled buildings and back-door routes are not built
>    (R-R5, backlog `exit-doors`), so no line promises a back door, an alley or an unseen exit.
>    `phone_down` is now "Leave the phone and come out", with no team move.
> 10. Costs name a loss the player can weigh: who stays beside the handgun, who can refuse, what the
>     viewers hear before anyone checks it. "The person who owes the sentence" and "a police voice
>     on the channel" are gone.
>
> **Cross-option findings.** `admitted` split into `admitted_live` and `admitted_quiet`. `news_on`
> reads as the repost ("{outlet} reposted the stream"), never a van light. `still_armed` is charged on
> `last_word_stream` too. `send_clip` records `clip_promised`, never a sent clip. Medical lines say
> who needs an ambulance, never who is being cared for. `on_air` shows three options when the squad
> has its own view, four (one gated) without. `way_out` shows at most four, one gated.
> `go_dark` is cut (sol: no rationale for pulling officers back with the handgun on the manager); its
> slot is `ask_down`, asking for the handgun down now, a pressure act against `talk_down`'s slower talk.
> `manager_hurt_inside` now closes `hold_talk`'s adverse band, where the courier fires into the counter
> and stays inside. Marks added: `counter_seen`, `no_picture`, `board_seen`, `address_posted`,
> `crowd_close`, `let_go`, `clip_promised`, `friend_named` (was `friend_promise`), `stream_down`.
>
> **Owner decisions.**
>
> - **O1, the lie on the death endings.** On `manager_killed` and `manager_killed_rider_hurt` the
>   force path brings the courier out with the lie still open, so the engine records it as held
>   (`sim/outcome-score.ts`: 0 trust, +0.5 strain, "The lie told to {rider} held"). The call adds no
>   discovery line beside a death. Choose: accept, or have the engine never hold a lie
>   (`sim/commitments.ts`, one condition; `commitments.test.ts` and `outcome-score.test.ts` pin the
>   current rule).
> - **O2, Part 2.** The persistent city cast is backlog `going-live-city-cast`, with the review's
>   verdicts.
>
> **Gates, 2026-10-24.** `npm run check:strings` exits 0 on all three binding runs (it exited 1 on
> HEAD: ngram 48, path-echo 18, address-mix 8, fronted 2, role-position 1, ai-tell 1); repeated
> sentences 18 to 7, sentences over 22 words 32 to 2. A full engine walk (scratch, Lab explorer,
> both pacings, about 56,000 states, no cap hit) found no `out_cleared` without public evidence, no
> held lie on any walk-out, and no ending whose staff state contradicts its text. Not done: the
> separate `swat-writing-review` read at 390px (`going-live-review`), and the owner's read.

> **Rewritten 2026-10-23** (branch `claude/hostage-rewrite`, cut from `claude/feel-lead`) after the
> teardown rejected the first version (`notes/going-live-teardown.md`). The sections below describe the
> first version and are stale where this box differs. Strings: `src/content/call-trees/hostage-live.ts`
> with `-parts`, `-approach`, `-resolve` and `-chat` beside it.
>
> - **Three truths, three earlier scenes** (teardown 3 and 10). Facts `rider_clear` and `proof`, no
>   `raised`. Situation 1: the clerk took the bag and the manager covered. Situation 2: the rider
>   kept it and marked it delivered, and the red light is true. Situation 3: nobody took it, the bag
>   went to the wrong porch, and a viewer holds the clip. The stream the player tries to shut is the
>   only witness that clears the rider.
> - **One cause for the handgun** (teardown 1). It comes up on an adverse result only when the rider
>   is past breaking point, the stance the card shows (`turnsOn`). Every other adverse result costs what
>   the choice put at risk: the audience, the contact, the clerk's name, the manager's pride, cover.
> - **The turn is a real choice** (teardown 2, 9). `on_air`: the manager answers on camera
>   (irreversible), read the comments for who knows (the only way to the clip, costs the count and
>   closes if the picture is walled or cut), wall the camera (calm, loses the comments), cut the stream.
> - **The lie is charged in every situation** (teardown 6). `lied_clerk` taxes both exits, is found out
>   at the door whatever the truth, and two endings read it. The honest answer in situation 3 is
>   `send_clip`, only what command can do.
> - **Stage 3 asks different questions** (teardown 4, 5). `way_out` is which door and what it pays by the
>   truth (`out_cleared` against `out_on_camera`). `last_word` is what the rider carries out: a last
>   word to the stream, the phone left behind, or hands open at the front.
> - **Lapse nodes cut from ten to two** (teardown 13); other threats only drain or hold the night.
> - **Not done:** the stream cue "Is that handgun real?" is still order-blind (teardown 16, in
>   `incidents/hostage.ts`); the writing review, the tally of subject roles (E3) and the owner's read.

The first curated call, written 2026-10-21 after every old call was deleted, and reworked the same
day on the owner's feedback (names, the address threat, the riders at the tape, fewer choices).
Strings ship in `src/content/call-trees/hostage-live.ts` and `src/content/incidents/hostage.ts`; the
lines here are placeholders where they differ.

## Premise

```
Call type borrowed:  hostage at a counter
Person:              a delivery rider (pronouns drawn) wants one sentence said on camera: that the rider didn't take the bag
Wrong note:          the rider streams the stand-off on {stream_app}, from a phone propped on the register
Worse if they wait:  the count climbs, a commenter posts the store's address, and the rider can back down less with every viewer
Why a tactical team: "A rider the store got cut off is back with a handgun and won’t let {manager} or {clerk} leave."
Self-harm risk:      present: cut off from the only income, accused in public, a handgun, a refusal. E4 applied; noDeathOnCard; the negotiator asks the direct question off the card in `cornered`
Private logic:       four hundred people who believed the rider are the only thing {delivery_app} didn't take; the stream is proof and armor at once
Lenses:              L7 reframe (primary), L4 voice under pressure
Reframe:             s1 the manager's glances at the stockroom were about family, not the handgun; s2 the followers' faith is why the rider can't stop
Temptation:          tell the rider the clerk backs the rider's story (`say_clerk_backs`); cue: the clerk's unprompted "I didn't say anything"; breaks in s2 when the clerk's own comment appears on the stream (walk_live mixed, say_clerk_backs adverse), or when the team owns it (`own_lie`)
Iceberg tip:         the clerk's "I didn't say anything to anybody", via `clerk_out`
Planted turn:        the stage 1 prompt: the manager's eyes on the stockroom door, not the handgun
Closing fact:        who took the bag. NEVER PRINTED as a narrator fact
```

## Names

Calls bind the city's names from `src/content/world.ts`: `{delivery_app}` (Hotbag), `{stream_app}`
(Loopcast), `{outlet}` and `{outlet_short}` (Metro 6 News, Metro 6) and `{handle}`, one commenter
drawn per call. Each string names the thing the first time; a later mention in the same string may
use the role noun. No sentence opens with `{handle}`, which binds lowercase.

## People

- **Rider** (subject). Wants the sentence. Fears being hurt where nobody can see. Reads: plays to the
  chat as the count rises; sits down when told something true. Voice: short, to the camera, repeats
  the timestamp. Breaking point: the comments turning, or the stream cut out from under them.
- **Night manager** (held, the grievance). In s1 filed the complaint to cover the clerk, their
  nephew or niece. Anchor: the green marker on the pickup whiteboard.
- **Clerk** (held, incidental, nineteen). In s1 took the bag. Anchor: the case of water they never
  put down.
- **Rider friend** (outside, at the patrol line, alone). Types in the comments. Kept for one beat
  and one choice: the voice that hasn't turned when the stream does (`cornered`), and the endings'
  epilogues. Their stage 2 call (`friend_line`) was cut; see below.
- **{handle}** (a commenter, never on scene). Posts the address. A name in the chat, nothing more.

## Shape and choices

Two or three choices per visible state, four only where one is gated. Each line: stance, then the
cost the player reads.

### Stage 1, `going_live` (3)

Threat: **The address goes out** (11 min = fastest 3 + 8). A comment from {handle} puts the
street address of {place} under the picture, and the rider reads it out loud; the count jumps and
patrol starts turning cars away at the corner. Beats count it down: the rider reads out that
{handle} wants to know where this is (1.2), the manager's line about rent (3.4), radio says the
comments are guessing the cross streets and one guess is right (6.8).

| Choice | Kind | Min | Stance | Cost the player sees |
|---|---|---|---|---|
| `on_stream` | contact | 4 | talk where the rider is listening | "Every word goes out live, and the count climbs while you talk." |
| `clerk_out` | coordination, escort | 4 | one person out now | "If the stream sees it, {rider} sees you working behind {rider}." |
| `watch_feed` | observation, vantage | 3 | look before you speak | "An unanswered phone, on camera, with the chat asking why." |

### Stage 2, `on_air` (3, or 4 when `team_glass` shows)

| Choice | Kind | Min | Stance | Cost |
|---|---|---|---|---|
| `manager_speaks` | contact | 3 | let the sentence be said, live | "Whatever {manager} says goes out live before you can weigh it." |
| `camera_wall` | contact | 4 | ask for the audience to go | "{rider} gives up the witnesses {rider} came here for, on your word." |
| `cut_feed` | pressure | 6 | take the audience away | "{rider} watches the screen go black and knows who did it." |
| `team_glass` (gated: not after `watch_feed`) | coordination, vantage | 3 | get close | "The stream watches your squad move in, and {rider} watches the stream." |

### Stage 2, `off_air` (2), after command cut the stream

| Choice | Kind | Min | Stance | Cost |
|---|---|---|---|---|
| `own_it` | contact | 4 | the honest answer | "{rider} hears that you took away the only people on {rider}'s side." |
| `move_up_dark` | coordination, vantage | 4 | move while nobody films | "{rider} could catch a helmet in the glass, with {manager} in reach." |

### Stage 2, `clerk_talks` (2), the turn

`clerk_asked` (observation: hear what happened at 11:40; the clerk, nineteen, answers beside the
stream) and `say_clerk_backs` (the lie: the words the rider came for, before anyone knows).

### Stage 3, `way_out` (2 to 4)

| Choice | Kind | Min | Stance | Cost |
|---|---|---|---|---|
| `walk_live` (not after `lie_found` or `cut`) | contact | 6 | walk out where nobody can lie about it | "Every move your squad makes, live, with the {outlet_short} camera on the door." |
| `walk_dark` | contact | 5 | no audience, no show | "{rider} walks out to the police with nobody watching, on your word alone." |
| `wait_night` | contact (hold) | 45 | time | "{manager} spends the night on the floor in front of a camera." |
| `own_lie` or `honest_next` (each gated; never both) | contact | 4, 5 | take back the lie / the hard truth | as written |

Stage 3 `cornered` (2), `threat` (3), `fired_on` (2) and `last_word` (3) keep their menus; their
crowd lines now name the {outlet_short} van and the friend at the patrol line.

## Dominance grids (row F, abridged)

Costs quoted above; "who pays" is charged by the adverse band named.

- **Stage 1.** `on_stream` pays in the count (stream bump on every band) and the manager on adverse;
  `clerk_out` has the best odds and the biggest objective but the worst adverse (a shot into the
  ceiling, to `threat`); `watch_feed` is the safest adverse and the only source of `glance` (+6 on
  `manager_speaks`) at stage 1. None is beaten on every column.
- **Stage 2 on_air.** `manager_speaks` is hardest (+4) with the only reveal of who took the bag;
  `camera_wall` slows the count (`phone_wall`, read by the stream rate and `walk_dark` +6);
  `cut_feed` is slowest (6 min) and the only way off the stream (`off_air`); `team_glass` is the
  only `team_close` here (+8 on `go_in`). None dominated.
- **Stage 2 off_air.** `own_it` can free the manager outright (objective 40, to `last_word`);
  `move_up_dark` is easier on odds but only positions the squad (`team_close`), and its adverse is
  the rider's named fear. Two goods: honesty against reach.
- **Stage 3 way_out.** `walk_live` and `walk_dark` trade witnesses against no show; `wait_night`
  is slowest and leaves the manager on the floor all night, and is no longer near-certain (HOLD -2,
  was -6). The gated options carry the lie's two endings.

Fake-choice checklist: lines 1 to 10 clean on every visible set above, read by eye; swap test
passes on each pair of titles.

## What was cut, and why

- **The riders at the tape** (owner: cheesy). The `tape_riders` source and its cues, reactions and
  bumps, the `tape_back` mark, `push_tape`, every crowd line, and the crowd surge that hurt the
  friend on `walk_live` mixed. Reporting folds into the stream's own news events (the {outlet}
  repost cue, the {outlet_short} van on the stage 3 threats). No meter replaced it. The stream now
  also weighs on coordination checks (every viewer is another pair of eyes on the stockroom door and
  the glass), which keeps the wiring probe honest where the tape used to pull.
- **`hail`** (call through the glass). With the tape gone its cost ("the whole street hears it")
  had nothing left to charge it, and the rest was `on_stream` on another channel: the same act by
  the same person, two points harder.
- **`friend_line`** (stage 2). A second "trusted voice" option on a four-option menu; the friend's
  sharper moment is `cornered`, when everyone else has turned. Its `friend_promise` reader on
  `walk_live` went with it; `out_front` still reads the mark.
- **`manager_first`** (stage 3). Both walks already send the manager out first; its own stance
  (release one now) overlapped them, and it hosted the lie's discovery, which moved to `walk_live`
  mixed.
- **`cut_feed` moved** from stage 1 to `on_air`: the stance is the same, but stage 1 needed its
  observation option (`watch_feed`) for the three-kinds gate and the opening's team travel, and
  taking the stream down reads stronger once two thousand people are on it.

## Pressure

- **Stream** (`stream`, owner the rider): 380 to 42,000 watching. Talking on it, the chat turning
  and the rider playing to it speed it up; the camera on the wall slows it; command, the rider or
  the dark ends it. Pulls up to 7 points off contact, pressure and coordination checks.
- **Threats** carry two or three beats each; minutes are each node's fastest choice plus 8.

## Officers

Choices favor `steady` and `calm_voice`; a crisis negotiator is credited on the talk; surveillance
training on watching the counter and on both moves up to the glass. The physical acts (the escort,
the vantage moves, entry) read the building and the kit.

## Balance and wiring record

`call-tree-balance.test.ts` bands, tier 2, measured 2026-10-21 with `measure()` from
`src/gen/incident/trees-v13/balance.ts`.

| Style | Before rework | After |
|---|---|---|
| random (60) | clean 48.3%, bad 15.0%, harm 8.3% (hurt 5.0, death 3.3) | clean 45.0%, bad 15.0%, harm 3.3% (hurt 0, death 3.3) |
| best_odds (40) | clean 55% | clean 65% |
| fast (60) | clean 71.7%, harm 11.7% | clean 58.3%, harm 1.7% |
| patient (60) | out_by_dawn 85% | out_by_dawn 86.7% |

Random "bad" sits exactly on its 15% floor, as it did before, and harm (3.3%) is just over its 3%
floor: the crowd injury was the main hurt the random style met. Content changes that held it:
`walk_live` TALK -2 to 0, `wait_night` HOLD -6 to -2, `clerk_out` 3 to 4 minutes (the fast style
otherwise lies on every run and the economy calibration in `src/sim/outcome-score.test.ts` fails).

Wiring (`src/architecture/wiring.test.ts`, hostage share before → after): certs 0.31 → 0.22,
items 0.40 → 0.33, locked openings 0.33 → 0.33, building 0.27 → 0.22, intel 0.97 → 0.96,
source pull 1.0 → 1.0. All above their floors. The sample is three random plays, so stage 1 order
(talk, escort, watch) and its tie on minutes move these numbers; record it before reordering.

## Design record

- Lane and version: call tree, content v13; compiled fingerprints need a deliberate recapture (the
  test was already stale before this rework).
- Gates: `npx vitest run src/content src/gen/incident/trees-v13 src/architecture/wiring.test.ts
  src/gen/incident/gates src/sim` passes except `compiled-fingerprints.test.ts`.
- Gate edits: `call-trees.test.ts` accepts bare world tokens; `bind-segments.test.ts` fills them
  before its frozen binder; `team-moves.test.ts` reads `walk_dark` for the cut `manager_first`.
- `npm run check:strings` exits 1 before and after; every counted category is equal or lower after.
- Ethics: E2 force never rewarded (entry endings cost trust and go to review); E4 applied to the
  rider; E7 no gore; E12.5 entry only from `threat` and `fired_on`, behind a seen threat to life. The
  address threat posts the store's address, a public business; no home address and no family peril.
- Not done: the `swat-writing-review` verdict, the Codex cold read, the E3 batch tally, and the
  owner's read of both death endings and of this rework.
