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

### The rule, as revised by the owner on 2026-10-20

In a situation with `suicide_self_harm`, the person at risk never speaks a push-back line. Others
on scene may, under E4: no line blames the player for the at-risk person's harm, and no line
presses guilt about looking away (`docs/call-pressure.md`, "Push-back lines"). All three hostage
situations carry `suicide_self_harm` because of the taker, so no line below is the taker's, and
every speaker is someone else on scene: the courier, the owner, the cousin, the regular, or the
team on the radio.

### How the lines work

- One line per threat, fired once when dither reaches the threshold: half the threat's minutes,
  rounded down, never under 2. No hostage threat is 2 minutes or less, so every threat gets one.
- Each line is a transcript line (`{ by, line }`, the shape of `TreeLine`): no quotation marks,
  no speaker tag, the UI prints the name. The field it lands in is engine-dither's to name; this
  draft assumes one line and one threshold on each `TreeThreat`.
- A line never mentions the player, the time spent deciding or anyone looking away. It reacts to
  what is happening on scene, and it foreshadows the threat it sits on, so when the threat lands
  the player has already heard it coming (the cue-trace rule in swat-call-design).
- A line holds in every state that reaches its node. The speaker is in the same place in every
  prompt variant of that node, and the line names nothing a variant contradicts.

### The lines

| Node | Threat minutes | Threshold | Speaker | Line | Where the speaker is | What it warns of |
|---|---|---|---|---|---|---|
| offer | 4 | 2 | courier | The van’s running out front. I left it running. | inside, in the doorway; heard over the open counter phone | the courier edging for the door |
| out_back_door | 4 | 2 | radio | Alley door. Handle’s turning again. Nobody out. | the team watching the alley door | the alley door opening |
| out_keys | 5 | 2 | courier | When I left, {taker.he} had the till drawer open. | outside behind the patrol car, talking to the negotiator | the count at the till |
| out_six_years | 4 | 2 | courier | My dispatcher’s called four times. What do I tell them? | outside by the cruiser, bag still on | the courier pressing patrol about the van |
| out_cousin | 4 | 2 | cousin | Let me go up to the glass. {taker.He}’ll know it’s me. | at the tape, in uniform from the depot | the cousin going for the step |
| both_inside | 5 | 2 | radio | Front glass. Blinds coming down. Losing our view. | the team at the corner, watching the front glass | the blinds |
| his_side | 5 | 2 | owner | I don’t have my ledger. I can’t give the count from memory. | inside at the counter; heard over the phone, as in the node’s own exchange | the count read aloud again |
| one_door | 3 | 2 | courier | {taker.He} {taker~has|have} looked up at that clock six times now. | inside by the door; heard over the phone | the deadline on the clock |
| talking | 5 | 2 | regular | People back here are getting their phones out. | at the tape with the other regulars | the filming |
| standoff | 10 | 5 | regular | It’ll be dark soon. {owner.first} never stays open past dark. | at the tape | dark |
| threat | 3 | 2 | radio | More units inbound with sirens on. Need them cut. | the team, asking command | the sirens |
| fired_on | 5 | 2 | cousin | Every window on this block is open, with people hanging out of them. | at the tape | the neighbors at their windows |
| owner_down | 4 | 2 | radio | The taker’s yelling for a medic. Door’s still bolted. | the team at the corner, with the medic | the taker shouting down the phone |
| last_one | 5 | 2 | owner | Every night {taker.first} sat down back there to count the drawer. | outside in a blanket from the medic | the taker sitting down out of sight |
| stayed_behind | 5 | 2 | radio | Near the till. Voices going up inside. | the team watching the glass | the argument inside |
| nobody_followed | 5 | 2 | regular | Hear that scraping? Somebody’s dragging the big table. | at the tape; nine years of mornings in the place | the table across the door |

Lengths are 38 to 68 characters with the longest pool first names bound and pronouns bound as
"they", inside the 90-character transcript budget. Speakers across the call: courier 4, radio 5,
regular 3, owner 2, cousin 2.

### E4 screen, line by line

| Check | Result |
|---|---|
| The taker never speaks a push-back line | 0 of 16 lines are the taker's |
| No line blames the player for the taker's harm | 0. No line mentions the taker's safety, and none is addressed to the player |
| No guilt about looking away | 0. No line mentions time passing on the player's side, waiting, or anyone being ignored |
| E4.1 no method | 0 method words. The handgun is never named in these lines |
| E4.2 no single cause, no release | 0. One line touches the taker's past (the nightly count, at last_one), as a habit, never a reason |
| E4.3 the person is the stake | The last_one line is the owner remembering the taker's nightly count, a person, not a threat |
| E4.9 language | 0 hits on the avoid list |
| Lines near the at-risk person's worst moments (threat, owner_down, last_one) | Spoken by the team or the owner, about the scene (sirens, the bolted door, the habit), never about what the taker might do to themselves |

### Prose gates on these lines

String checker (`game_string_checks.py`, live lint source), 16 lines bound as "they": exit 0.
Dash 0, colon 0, stock-spoken 0, feeling 0, engine-word 0, word-choice 0, weapon-speech 0, unsafe 0.
Cadence FLAT (0.53) across 16 lines that never share a path. Reported, not chased.

Path check: each line placed on its node's path (prompt, the node's exchange, the line, then the
threat's text) and checked for echoes. Three echoes in my first draft were rewritten (the clock
over the register, on the floor, by the register). Now path-echo 0. The checker's other hits on
those paths are all in existing tree text, not these lines: "flat" in the talking prompt and
"leaning" in the fired_on threat, worth a later prose pass.

Continuity by hand: the standoff line first said the owner "always has the lights on by now",
which assumed the shop lights were off, and nothing in the tree says so. It now says the owner
never stays open past dark. The nobody_followed line first placed the table "from the window";
the tree only says a table, so the line says "the big table".

written-voice `voice-check.py`: 0 dashes, 0 stock phrases, 0 tics, 0 triads. Spelling candidates
are the two bound names only.

### What the lines need from engine-dither

- A field on `TreeThreat` holding one `{ by, line }` and its threshold in dither minutes.
- The gate that refuses a line whose speaker is the at-risk subject in a `suicide_self_harm`
  situation (owner rule above). For this call that is the taker.
- The resume rule: a line whose threat has already landed is dropped.

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
- Table read: answered | 16 push-back lines read per speaker and in node order; voice breaks 0; stock lines 0
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
