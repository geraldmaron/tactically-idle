# Content warnings, support and push-back lines: draft for owner approval

Sections 1 to 3 APPROVED by the owner as drafted, 2026-10-20, with the three decisions below.
Section 4 (push-back lines) is a DRAFT under the revised rule and is not approved yet. Written under
`.agents/skills/swat-call-prose` (strings) and checked with `.agents/skills/swat-writing-review`
as a self-read, plus a separate Codex read (end of file). Design source: `docs/content-rating.md`
("Warnings and support", "First launch and Settings") and `docs/call-pressure.md`
("Push-back lines"). Ethics rules cited by number from
`.agents/skills/swat-call-design/references/ethics-and-authenticity.md`.

Curly apostrophes are used below, as call data holds them. `src/ui/settings/labels.ts` writes
straight ones today; whoever moves these into code follows that file's convention.

## Owner decisions, 2026-10-20

The owner's answers, in their words: "Allow on these four" (the word suicide), "Whole call"
(warning scope), "Approve as drafted" (sections 1 to 3), and "Revisit the self-harm rule"
(push-back from people other than the person at risk). The questions as they were put:

1. **The word "suicide" on these surfaces.** The prose lint bans `suicid\w*` in call text
   (`UNSAFE_DETAIL` in `src/gen/incident/gates/prose-lint.ts`; E4.10, kept by E17). The card
   warning, the advisory, Settings and the debrief support line are not call text and the lint
   doesn't run on them, so this is an owner decision, not a lint failure. Recommendation: allow
   it on these four surfaces only. A warning has to name the topic to work, and the 988 Lifeline
   names itself with the word. Fallback if not: "self-harm risk" on the card, and "a person at
   risk of hurting themselves" in the advisory.
2. **Warn by call, not by drawn situation.** See the spoiler finding below. Recommendation: the
   card warns with the union of the call's situations' descriptors.
3. **Push-back lines.** Under the suppression rule no shipped call can carry them today (section 4).
   Confirm that is the intended outcome.

## 1. The call card warning

Shown on the board card before the player accepts, when warnings are on (the default). It names
topics, never plot.

### Spoiler finding: warn per call, never per situation

Descriptors are tagged per situation, and the derived ones differ between situations of the same
call. A card that warned with its drawn situation's list would leak the hidden truth before the
first choice.

- Hostage: `death` is reachable only in situation 3, where the taker won't let the owner go. A
  card reading "death" tells the player which situation they drew.
- Barricade: `police_gunfire` is reachable only in situation 3,
  where the subject won't come out.

This is a block under swat-writing-review gate 7 (any pre-check field that differs across
situations is a leak). Fix as data: the card warns with the union of the call's three situations.
Filtering stays per situation; it can't leak, because a filtered situation never reaches the board.
Today the avoidable themes are the same in all three situations of each call, so the union changes
nothing a player can avoid.

### The phrase for each descriptor

| Descriptor | Card phrase | Why this wording |
|---|---|---|
| `suicide_self_harm` | suicide risk | Names the topic in two words. Matches the advisory's list |
| `child_at_risk` | a child in danger | What the player will meet, not the mechanism |
| `domestic_violence` | domestic violence | The plain term. The call shows the pattern (E5); the card names the topic |
| `death` | death | |
| `police_gunfire` | police gunfire | The descriptor's own meaning. The force draw can be less-lethal by gear, but gunfire is possible wherever the descriptor is set, so the warning is true (Codex finding 1) |
| `injury` | injury | |

### Combining several on one card

1. One line, opening "Involves", then the phrases joined with commas and a final "and", no serial
   comma ("A, B and C"), ending in a period.
2. Order: the avoidable themes first in `AVOIDABLE_THEMES` order (suicide risk, a child in danger,
   domestic violence), then death, police gunfire, injury. A player scanning for a theme they
   care about finds it first.
3. At most two lines at 390px. The board hook is 13.5px and clamps at 3 lines, about 50 characters
   a line (`.optile .opboard-summary`, `src/ui/screens/ops-visual.css`), less the card's padding
   and badge. The longest card today is 87 characters, so about two lines; unverified until
   rendered. Never clamp a warning: if a future call needs more than two lines, the
   card shows the line in full and the hook clamps instead.
4. No warning line when a call carries no descriptor.

Why "Involves" and not "This call involves": the full sentence takes the barricade line to 97
characters, likely a third line on the narrowest card. The subject is the card itself.

The four cards today (union of each call's situations):

| Call | Warning line | Characters |
|---|---|---|
| One Last Signature (hostage) | Involves suicide risk, death, police gunfire and injury. | 56 |
| Behind the Bathroom Door (barricade) | Involves suicide risk, a child in danger, domestic violence, police gunfire and injury. | 87 |
| After the Noise (armed) | Involves death, police gunfire and injury. | 42 |
| My Chair Comes Too (rescue) | Involves death and injury. | 26 |

### Leaving a call costs nothing

Under the warning, on every card that carries one:

> No penalty for skipping this call.

34 characters, so one line on a phone card; unverified until rendered, and it sits outside any
clamp. True today: a card the player ignores expires silently and is never
penalized (`src/sim/incidents.ts`, header comment). If novelty or reputation weighting ever starts
charging for ignored cards, this line becomes false and has to change with it.

## 2. Launch advisory

Reviewed against the draft on `claude/ui-settings-bdfcf6`, `src/ui/settings/labels.ts` and
`FirstRun.tsx`. Facts kept. Only strings that change are listed; the rest stand as drafted.

| Key | Current | Proposed | Reason |
|---|---|---|---|
| `advisoryIntro` | You run a police tactical team. Its calls deal with these themes. | You run a police tactical team. Its calls include these themes. | "Deal with" is vaguer than it needs to be |
| `leaveCalls` | You can always leave a call on the board. Calls you don't take end on their own and cost you nothing. | You can leave any call on the board. Calls expire without a penalty. | "End on their own" read as the incident resolving; the card only expires (Codex finding 2) |
| `notAgeCheck` | The choices below are your own preferences. They are not an age check, and nothing here is verified. | These settings are your preferences. We don’t check your age. | "Nothing here is verified" could read as doubting the warnings or the support details (Codex finding 3) |
| `acknowledgeHint` | Tick the box above to continue. | Check the box above to continue. | "Tick" is British (American word choice, swat-call-prose rule 10) |
| `changeLater` | You can change these later in Settings, from the saves button at the top of the screen. Settings also lists where to find support. | You can change these later in Settings, from the saves button at the top of the screen. Settings also has a Support entry. | Names the entry the player will look for |
| new `avoidMechanics` | none | Death, injury and police gunfire run through most calls. Warnings name them, but you can’t avoid them. | Says why three of the six advisory themes have no switch, so the missing toggles don't read as a bug. Shown under the avoid list |
| `ADVISORY_THEMES` | Police use of force, Death, Injury, Suicide risk, Children in danger, Domestic violence | Suicide risk, Children in danger, Domestic violence, Death, Police use of force, including gunfire, Injury | Same order as the card warning. The advisory keeps the broader "use of force" and names gunfire in it |
| `THEME_LABELS.child_at_risk.name` | A child at risk | A child in danger | Same words as the card and the advisory |

Kept as drafted: the kicker, title, acknowledgement, continue button, the warning and timer labels,
`avoidHint` and the other two theme labels. The advisory says it is not an age check, which
`docs/content-rating.md` requires.

## 3. Support entry and debrief line

988 wording checked at [988lifeline.org](https://988lifeline.org/) on 2026-10-20. The site names it
the "988 Suicide & Crisis Lifeline", offers call, text (`sms:988`) and chat
(chat.988lifeline.org), says it is "available 24/7/365", and calls conversations "free and
confidential". 988 is US-only (E4.7, sources AU15). For outside the US this draft points to local
services and names no other line, because no international directory was opened for this draft.
A named directory can be added once one is checked.

### Support entry in Settings (always available)

| Key | Text |
|---|---|
| `heading` | Support |
| `lead` (new) | If a call brings something up for you, or you’re thinking about suicide, you can talk to someone. |
| `us` | In the US, call or text 988 to reach the 988 Suicide & Crisis Lifeline. It’s free and confidential, at any hour. |
| `elsewhere` | Outside the US, contact a crisis line where you live. If you’re in immediate danger, contact local emergency services. |
| buttons | Call 988 · Text 988 · Chat online (opens chat.988lifeline.org) |

Changes from the UI draft: the name matches the Lifeline's own ("&", not "and"), the free,
confidential and any-hour facts come from the site, and the lead sentence is split off so the US
line stands alone for a player outside the US. The middle dots above separate buttons in this table
only.

### Debrief support line (situations with `suicide_self_harm`, whatever the warning setting)

> If this call brought something up for you, you can call or text 988 in the US, at any hour.
> Outside the US, contact a local crisis line. If you’re in immediate danger, contact local
> emergency services.

This is the E4.7 draft, with "at any hour" from the site, and crisis support kept apart from
emergency services, so nobody reads the police as the first place to turn (Codex finding 4). The
debrief shows it in full, never clamped. It names no outcome, so it
reads the same after every ending, including the ones where the subject walks out.

## 4. Push-back lines (DRAFT, not yet approved)

### The rule (owner, 2026-10-20)

Any speaker may have a push-back line, the taker included. Lines are not suppressed by situation;
a player who doesn't want the hostage call's themes filters them in Settings
(`docs/call-pressure.md`, `docs/content-rating.md`). The lines still follow `swat-call-prose` and
the prose lint as they stand. An earlier draft of this section, written while the taker was
excluded, is in this file's history (commit 6d97111).

### How the lines work

- One line per threat, fired once when dither reaches half the threat's minutes, rounded down,
  never under 2. No hostage threat is 2 minutes or less, so every threat gets one.
- Each line is a transcript line (`{ by, line }`, the shape of `TreeLine`): no quotation marks, no
  speaker tag, the UI prints the name. The field it lands in is engine-dither's to name.
- A line reacts to the scene and foreshadows its threat, so when the threat lands the player has
  already heard it coming (swat-call-design's cue-trace rule). It never talks about the player
  taking their time.
- The taker speaks only at nodes where they are on the phone on every route in (offer, one_door,
  talking, owner_down). Where some route arrives with the line cut, silent or unanswered (out_keys,
  both_inside, standoff, out_cousin, threat), someone else speaks.

### The lines

| Node | Threat minutes | Threshold | Speaker | Line | Where the speaker is | What it warns of |
|---|---|---|---|---|---|---|
| offer | 4 | 2 | taker | Courier. I can see you looking at the door. | on the counter phone; the courier inside can hear | the courier edging for the door |
| out_back_door | 4 | 2 | radio | Alley door. Handle’s turning again. Nobody out. | the team watching the alley door | the alley door opening |
| out_keys | 5 | 2 | courier | When I left, {taker.he} {taker~was|were} lining up the twenties. | outside behind the patrol car | the count at the till |
| out_six_years | 4 | 2 | courier | Eleven stops left. My van’s still running at the curb. | outside by the cruiser, bag still on | the courier pressing patrol about the van |
| out_cousin | 4 | 2 | cousin | That glass. {taker.He} can’t see my face from back here. | at the tape, in uniform from the depot | the cousin going for the step |
| both_inside | 5 | 2 | radio | Front glass. Hand on the blinds. Need another view. | the team at the corner, on the front glass | the blinds |
| his_side | 5 | 2 | owner | I don’t have my ledger. I can’t give the count from memory. | inside at the counter; heard over the phone, as in the node’s own exchange | the count read aloud again |
| one_door | 3 | 2 | taker | Courier. That door’s open now. It won’t stay open. | on the receiver in every variant | the deadline on the clock |
| talking | 5 | 2 | taker | Keep those phones away from the glass. | on the phone with the negotiator | the filming |
| standoff | 10 | 5 | regular | It’ll be dark soon. {owner.first} never stays open past dark. | at the tape | dark |
| threat | 3 | 2 | radio | More units inbound with sirens on. Need them cut. | the team, asking command | the sirens |
| fired_on | 5 | 2 | cousin | Curtains keep moving upstairs. More faces at the windows. | at the tape | the neighbors at their windows |
| owner_down | 4 | 2 | taker | I said an ambulance. Stop asking me questions. | shouting into the phone | the shouting getting louder |
| last_one | 5 | 2 | owner | When the rush got bad, {taker.first} would sit down where nobody could see. | outside in a blanket from the medic | the taker sitting down out of sight |
| stayed_behind | 5 | 2 | radio | Till. One coworker watching the exit. Need contact. | the team on the glass | the argument inside |
| nobody_followed | 5 | 2 | radio | Front door. Hands on the table. Keep the exit clear. | the team on the front door | the table across the door |

Lengths are 38 to 71 characters with the longest pool first names bound and pronouns bound as
"they", inside the 90-character transcript budget. Speakers: radio 5, taker 4, courier 2, owner 2,
cousin 2, regular 1.

### Ethics screen, line by line

The settings filter now covers the call's themes, so E4 no longer silences anyone. The rules on
how a crisis is written still hold inside any line:

| Check | Result |
|---|---|
| E4.1 no method | 0 method words; the handgun is never named in these lines |
| E4.2 no single cause, no release | 0. The taker's four lines are about the courier, the door, the filming and the ambulance, never about themselves |
| E4.9 language | 0 hits on the avoid list |
| E2, force never the reward | 0. No line praises or urges force |
| E12.4, a clock never creates the threat | Each line foreshadows a threat already in the tree; none sets a threat mark |

### Prose gates on these lines

String checker (`game_string_checks.py`, live lint source), the final 16 lines bound as "they": exit
0. Dash 0, colon 0, stock-spoken 0, feeling 0, engine-word 0, word-choice 0, weapon-speech 0, unsafe 0.
Binding as "they" caught one agreement slip ("they was"), fixed with a verb token.

Path check: each line placed on its node's path (prompt, the node's exchange, the line, then the
threat's text). One echo ("at the tape" in the talking line) was rewritten; path-echo 0. The other
checker hits on those paths are in existing tree text: "flat" in the talking prompt, "leaning" in
the fired_on threat, past tense in the out_cousin threat, and "asks patrol" in the out_six_years
threat. Worth a later prose pass on the tree.

written-voice `voice-check.py`: 0 dashes, 0 stock phrases, 0 tics, 0 triads. Spelling candidates are
the two bound names and "coworker", a real word.

### Second Codex read (lines from commit b4d5f92) and what changed

Codex, configured default model, read-only, fresh thread, 2026-10-20. Verdict: edit, one block. It
found no civilian saying weapon, no method detail, no stock line and no E4.2 or E4.9 problem.

| # | Node | Finding | Severity | My verdict | Now |
|---|---|---|---|---|---|
| 1 | offer | "Not yet" seems to take back the taker's own "The courier can go" | fix before ship | accepted | “Courier. I can see you looking at the door.” |
| 2 | out_back_door | Radio line has no need | fix before ship | rejected. The tree's own radio lines report status without a need ("Courier sat back down. Can’t see the taker’s hands."), and "Need cover" adds nothing the team doesn't already have | unchanged |
| 3 | out_keys | An open drawer is a weak cue for the count | fix before ship | accepted | “When I left, {taker.he} {taker~was\|were} lining up the twenties.” |
| 4, 5, 7, 10, 12, 14 | out_six_years, out_cousin, his_side, standoff, fired_on, last_one | Hold in every variant | note | retained | unchanged |
| 6 | both_inside | The line starts the threat's action | fix before ship | accepted | “Front glass. Hand on the blinds. Need another view.” |
| 8 | one_door | No channel for the team to hear the courier; "that clock" leans on context | fix before ship | accepted, with a different taker line: Codex's "Watch the clock over the register" echoes the threat text word for word | “Courier. That door’s open now. It won’t stay open.” |
| 9 | talking | The taker "hasn’t looked toward the street" in the cousin_seen variant | fix before ship | accepted | “Keep those phones away from the glass.” |
| 11 | threat | **Block.** The phone is not open on every route in (one route arrives with it ringing unanswered) | block | accepted; the radio line Codex approved in the first read returns | “More units inbound with sirens on. Need them cut.” |
| 13 | owner_down | The line repeats the prompt's beat | fix before ship | accepted | “I said an ambulance. Stop asking me questions.” |
| 15 | stayed_behind | No need; and the tree's threat text ("the ones who stayed arguing") is wrong when one coworker stays | fix before ship | accepted for the line. The threat text's count problem is a finding for the tree, routed to swat-call-design: it needs a one-member variant | “Till. One coworker watching the exit. Need contact.” |
| 16 | nobody_followed | "Movement" is vague | fix before ship | accepted | “Front door. Hands on the table. Keep the exit clear.” |

### First Codex read (lines from commit 6d97111) and what changed

Codex, configured default model, read-only, 2026-10-20. Verdict: edit. It found no line that blamed
the player, pressed guilt, carried method detail or a stock line, and confirmed every threshold.

| # | Node | Finding | Severity | My verdict | Now |
|---|---|---|---|---|---|
| 1 to 3 | offer, out_back_door, out_keys | Placement and foreshadowing hold | note | retained, except offer, which now goes to the taker for more pressure | see table |
| 4 | out_six_years | The courier's phone may still be inside, so they can't know about four calls; the line asks the negotiator a question | fix before ship | accepted | “Eleven stops left. My van’s still running at the curb.” |
| 5 | out_cousin | "Let me" asks the team for permission | fix before ship | accepted | “That glass. {taker.He} can’t see my face from back here.” |
| 6 to 11 | both_inside, his_side, one_door, talking, standoff, threat | Placement and foreshadowing hold | note | retained, except talking and threat, which now go to the taker | see table |
| 12 | fired_on | The line announces the whole threat before it lands | fix before ship | accepted, "glass" changed to "windows" so it can't be read as the shop front | “Curtains keep moving upstairs. More faces at the windows.” |
| 13 | owner_down | Both facts already in the prompt; the missing cue is the shouting getting louder | fix before ship | accepted, with a different line: the taker's own voice is the cue | “{owner.first} won’t answer me. Where’s that ambulance?” |
| 14 | last_one | Foreshadows a work habit more than sitting down out of sight | note | accepted, with a different line from the owner | “When the rush got bad, {taker.first} would sit down where nobody could see.” |
| 15 | stayed_behind | No listening channel established, and "voices" is wrong when one coworker stays. The tree's own threat text has the same count problem | fix before ship | accepted. The threat text's count problem is a finding for the tree | “Till. One coworker keeps looking back toward the door.” |
| 16 | nobody_followed | Audibility from the tape not established; "dragging" starts the threat itself | fix before ship | accepted, radio, without Codex's plural "coworkers", which is wrong with one member | “Front door. Movement by the big table.” |

## 5. Review record (self-read, plus the Codex read below)

Self-read declared: I drafted these strings and the descriptor tags they depend on. Per the
swat-writing-review self-read limits, my verdict can't be better than edit.

```
Writing review record (scaled: UI strings, no call text)
- Scope: answered | card warning x4 calls, leave line, advisory deltas, support entry, debrief support line; no call-tree text changed; fingerprints unchanged
- Reader: answered | self-read declared; separate read by Codex below
- Read surface: answered | exported text; not rendered because the UI that shows these strings is being edited by ui-settings and engine-dither; unseen: board card, advisory, Settings, debrief
- Cold read: answered | 4 cards read for topic only; each names what a player could meet, none names an event, ending or person
- Path and choice read: not applicable | no choices
- Choice table: not applicable | no choices
- Table read: answered | 16 push-back lines read per speaker and in node order; voice breaks 0; stock lines 0; taker lines only at nodes where the phone is open in every variant
- Spoilers and honesty: answered | leaks 1 (per-situation warning, block, fix as data in section 1); invented outcomes 0; "costs you nothing" checked against src/sim/incidents.ts
- Ethics: answered | E4.1 no method 0 hits; E4.7 support line and content warning present; E4.9 language: no "committed", no "attempt"; E4.10 "suicide" outside the lint, owner decision 1; E5 named as a topic only
- Batch audit: not applicable | 16 strings
- Engine gates: not applicable | no code or content changed in this branch
- Tells checked: answered | written-voice voice-check.py on the revised export: 0 dashes, 0 stock, 0 tics, 0 triads; 1 spelling candidate (box), a real word
- Findings: self-read 1 block (spoiler, data fix proposed); Codex 6 fix before ship and 1 note, all applied; 2 notes stand (repeated danger line kept on purpose; "suicide" owner decision)
- Owner decisions surfaced: "suicide" on UI surfaces; warn per call; push-back for rescue civilians
- Verdict: edit | block 1 with data fix | fix before ship 0 open (6 applied) | note 2 | fingerprints recapture no
```

String checker: `python3 .agents/skills/swat-call-prose/scripts/game_string_checks.py` with the live
lint source, rerun on the 15 revised strings after the Codex edits, exit 1. What fired, and why each
stands:

- `unsafe` x4, "suicide" in two card lines and two support strings. Matches `UNSAFE_DETAIL`
  (`suicid\w*`). The lint enforces it on call text only, through `npm run check:strings`; these
  surfaces sit outside it. Owner decision 1 above, with the fallback wording.
- `repeat` and `ngram` x1, "If you’re in immediate danger, contact local emergency services." in
  both the Support entry and the debrief line. Kept word for word on purpose: the same guidance in
  two places should read the same (swat-call-prose rule 12). Note.
- `address-mix` x8 and `over-target` x9. The checker has no surface key for UI chrome, so the
  strings ran under the `debrief` key, whose rules are written for ending text. They address the
  player as "you" on purpose. Not findings.
- Clean: dash 0, colon 0, stock 0, feeling 0, policy-voice 0, word-choice 0, sentence-long 0,
  triad 0. Sentence lengths 4 to 20 words. Cadence reads FLAT (variation 0.49) across 15 unrelated
  UI strings, which share no reading path. Reported, not chased.
- written-voice `voice-check.py` on the export: 0 dashes, 0 stock phrases, 0 banned tics, 0 triads,
  1 spelling candidate ("box"), a real word.

## 6. Separate read (Codex)

Codex task, configured default model, read-only, fresh thread, 2026-10-20, on commit 5b93661. It
read the skills and docs named above, then the draft as exported text (not rendered). Verdict: edit.
It confirmed the per-call union leaks nothing, the "costs nothing" claim against
`applyIncidentsDue`, and the push-back conclusions against the trees; found no dashes, colons,
British words or E4.9 labels; and left "suicide" on these surfaces as the owner's decision.

| # | Codex finding | Severity | My verdict | What changed |
|---|---|---|---|---|
| 1 | "police use of force" is too broad to warn about gunfire | fix before ship | accepted with a change | Card uses "police gunfire" (shorter than the proposed "police force, including gunfire"); the advisory keeps "Police use of force, including gunfire" |
| 2 | "ends on its own" suggests the incident resolves | fix before ship | accepted | `leaveCalls` says calls expire without a penalty |
| 3 | "Nothing here is verified" has unclear scope | fix before ship | accepted | "These settings are your preferences. We don’t check your age." |
| 4 | Support lines put emergency services beside crisis support without saying when | fix before ship | accepted | Crisis line first, emergency services only for immediate danger, in both the Support entry and the debrief line |
| 5 | Threshold rule fails for threats of 2 minutes or less, and on resume | fix before ship | accepted | Short threats stay silent; a push-back whose threat already landed is dropped on resume |
| 6 | "Two minutes clears the reading floor" is unsupported | fix before ship | accepted | Rationale now says dither starts after the floor and the margin needs testing |
| 7 | Card length claims unverified; shorter leave line | note | accepted | Leave line is "No penalty for skipping this call."; every width claim marked unverified until rendered |

After these edits the string checker was rerun on the revised strings (section 5).
