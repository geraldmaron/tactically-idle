# Ledger and callbacks

How officer text may use the game's memory. The rule under all of it is that a callback repeats
something the game recorded. It never invents a shared history, because a player who remembers the
call will catch the lie, and a player who does not will stop trusting the next callback.

The ledger is design only. Until engineering builds it, a callback can draw only on the 10
debriefs the save keeps.

## 1. What counts as a recorded fact

These `DebriefResult` fields were read on 2026-10-06 (search `interface DebriefResult` in the
types file). A ledger entry derives from one of them and from nothing else.

| Field | What it records | Ledger kinds it can feed |
|---|---|---|
| `officerCondition` | each officer's stress before and after, and experience gained | first_call, favorable_under_pressure |
| `officerCasualties` | officer injury severity, label, care and recovery time | injured |
| `personCasualties` | subject or civilian harm, including fatal, with care state | person_lost |
| `civilianOutcomes` | each civilian's end state, from needs help to safe or deceased | rescue, person_lost |
| `disposition` | resolved, care accepted, follow-up agreed, partial relief or unresolved | negotiated |
| `decisions` | the decision log, step by step | negotiated, rescue, mentored |
| `endingTitle` | the ending the call reached | detail wording only |

## 2. Ledger kinds

| Kind | Recorded when |
|---|---|
| first_call | the officer's first debrief with this department |
| rescue | a civilian moved from needs help to safe on a step this officer took |
| injured | an officer casualty record names this officer |
| person_lost | a fatal or deceased record on a call this officer worked |
| negotiated | a contact step by this officer, no force step, disposition resolved or care accepted |
| mentored | a set number of shared operations beside a named mentor while in the Rookie band |
| favorable_under_pressure | a favorable band with pressure at 50 or more, officer on a step |

Detail shapes. Each kind has at least three, and no two shapes for one kind share a three-word
phrase. Pick the shape that fits the one specific the call recorded.

| Kind | Shape A, an object | Shape B, a time | Shape C, a room or position | Shape D, what was said |
|---|---|---|---|---|
| first_call | First call here was the water leak on Calder Street. | Started on a Tuesday night shift at the Ashby Road laundromat. | First post was the side gate at Fennel Street. | First radio call here was one word at Bram Row. |
| rescue | Carried the resident's oxygen bottle down at Ashby Road. | Had the resident outside four minutes after the door opened. | Brought the resident down the back stairs at Ashby Road. | The resident at Ashby Road asked for her glasses first. |
| injured | Hurt on the cellar steps at Wren Court. | Hurt at Wren Court. Back on duty nine days later. | Hurt in the hallway at Wren Court, near the meter box. | Called in their own injury at Wren Court and kept the post. |
| person_lost | Was on the rear at Calder Street. | Was at Calder Street through the night. | Held the side yard at Calder Street. | none, a person_lost detail never quotes anyone |
| negotiated | Kept the phone line open for forty minutes at Wren Court. | Talked from 9:10 until the door opened at Wren Court. | Talked through the kitchen door at Wren Court. | The man at Wren Court asked for his jacket, then came out. |
| mentored | Learned the rear-door call beside Okafor. | Ran six calls beside Okafor in the first month. | Stood the second post beside Okafor at Bram Row. | Okafor said "your door" at Bram Row, and it was. |
| favorable_under_pressure | Kept the stair light working at Wren Court with the clock high. | Held the rear at Wren Court for forty minutes. | Held the landing at Wren Court while the hall filled with smoke. | Called "two inside" at Wren Court before anyone else. |

The person_lost row never names the person's fate in the detail itself. The debrief already said
it, and the ledger only places the officer.

Detail line rules.

1. 80 characters at most, past tense, one fact.
2. Names one specific of that call (an object, a time, a room or position, or what was said). A
   detail that would fit any call is rejected.
3. Names the call by its place, never by the civilian's bound name. The civilian name pools are
   the roster's own names, so a bound name can belong to a serving officer.
4. No judgment words. "Bravely", "heroically" and "nearly" all fail.
5. Written once at debrief and frozen. A later rename of the place does not rewrite it.
6. A person_lost detail never names a cause of death, a method or the officer's feelings, and
   never appears in a briefing.
7. Stock closers ("everyone walked out", "everyone went home", "nobody got hurt") appear at most
   once per officer and once per shift report. Prefer the concrete close. "The man came down the
   stairs on his own." "Both kids were in the car by ten."
8. No three-word phrase appears in more than one surface for the same officer, and no three-word
   phrase outside names and places appears in the ledger lines of more than 1 officer in 20 in a
   batch. Two entries for one officer never share a sentence frame. The check is the phrase repeat
   script in representation-checks.md.

## 3. Callback rules

Ownership. This skill writes the ledger fact and the callback intent, meaning which entry, which
surface and what edge it informs. swat-call-prose writes any spoken line from that fact in the
officer's markers, and its surface tests apply to it. This file's templates are narration, never
speech.

```
Callback intent
- Officer: <surname>
- Entry: <ledger kind> at <place>, <game date>
- Surface: briefing callback component | debrief
- Edge it informs: <what this officer brings to this kind of step, in one clause>
- Backed by: <contributor line> | none, so debrief only
- Role on that step: <the officer's role this campaign, and whether the decision log put them on it>
- Spoken line wanted: no | yes, handed to swat-call-prose
```

1. One callback per operation, in the briefing callback component or the debrief, never in a
   choice label or a stage prompt. Choices stay about the dilemma.
2. Briefing callbacks render in a UI component beside the briefing, fed by `OfficerHooksView` at
   display time. They never go into `ScenarioDefinition` fields (`known`, `dispatchReason`,
   `summary`), so issued fingerprints and the distinctness gate are untouched. The component is
   request R15.
3. No branch depends on a callback. The call plays the same without it.
4. The same ledger entry is not reused for one officer within 5 operations (proposal).
5. A callback agrees with the officer's state now. An officer still recovering is never "back on
   duty", and a retired officer is never "on the rear".
6. A briefing callback informs the decision. It names an edge the officer has on this kind of
   call, and the contributor line shows the same edge. If no contributor line backs it, use the
   debrief.
7. Role plausibility. A callback that claims a contact or negotiation part is shown only when the
   officer's role is comms or lead, or the decision log put them on the contact step. Otherwise
   the callback names what they did in their own role. For a breach seat, "Okafor held the stairs
   at Larkin Court while comms talked." Crisis negotiation is its own trained part on real teams.
8. Civilians in callbacks are named by role ("the man on the landing", "the resident").

## 4. Templates by kind

Slots in braces fill from the ledger entry or the officer. `{month}` is the month of the game
date. Each template uses the surname as subject, so no pronoun agreement is needed.

| Kind | Briefing callback | Debrief |
|---|---|---|
| first_call | none, a first call informs nothing | {Surname}'s first call with the department. |
| rescue | {Surname} brought someone out of {place} in {month}. | {Surname} has done this before, at {place}. |
| injured | {Surname} was hurt on a call like this in {month}. | {Surname}'s first {call type} since {place}. |
| person_lost | none, never | {Surname}'s first {call type} since {place}. |
| negotiated | {Surname} talked a door open at {place} in {month}. | Same street pattern as {place}. {Surname} had the phone again. |
| mentored | {Surname} learned this call beside {Mentor}. | {Mentor} and {Surname}, on the same door again. |
| favorable_under_pressure | {Surname} was on the stairs at {place} when the clock ran high. | Twice now. {place}, and tonight. |

The person_lost debrief template is used only when the current call ended with every person safe,
and it goes to a human reviewer before it ships.

## 5. Pair beats

A pair beat is a two-line debrief exchange between two officers after shared operations (proposal,
8 shared). It is the only place two officers talk to each other outside a call.

The UI has no speaker format today. A pair beat is design only and needs a layout with an officer
chip beside each line (request R14). On a sheet, write the speaker in its own column, never with a
colon.

| Speaker | Line, 10 words max, in that speaker's markers |
|---|---|
| Chen | You checked that handset twice. |
| Brooks | Three times. You were talking. |

| Speaker | Line |
|---|---|
| Hale | You called the rear before I did. |
| Kaur | I heard the window. You saw it. |

Rules. Both lines stay on the work. Humor stays inside the team and lands on neither a civilian
nor a subject. Neither line explains the friendship. No line is a stock cop-show exchange ("I've got
your back", "not on my watch"). A pair beat never repeats for the same pair inside 10 operations.

## 6. Earned nicknames

A nickname is offered after a ledger event, and the player accepts it, types another or declines.
Players attach to soldiers they name themselves, so the offer is a door, not a verdict.

```
Nickname offer
- Officer: <full name as authored>
- From: <ledger kind> at <place>, <game date>
- Traces to: <the exact ledger detail, debrief line or radio sample the player saw>
- Offer: <one or two words, every word found in or pointing straight to the Traces to line>
- Idiom check: <none | the common meaning, and why it is safe>
- Player: accept | rename | decline
```

Hard checks.

1. Every word of the offer appears in, or points straight to, the Traces to line. Print that line
   beside the offer on the sheet.
2. Read the offer cold. A player must be able to say where it came from in one second.
3. Reject any name with a common idiomatic meaning, and above all one that suggests secrecy,
   corruption, violence, or a body or identity trait.

| From | Traces to | Offer | Verdict |
|---|---|---|---|
| checks_gear habit plus a favorable call where a handset failed | pressure line "He checks every handset twice." | Twice | keep, names the habit the player has watched |
| negotiated at Wren Court | detail "Talked through the kitchen door at Wren Court." | Wren | keep, the place, short on the radio |
| knows_routes plus a rescue | detail "Brought the resident down the back stairs at Ashby Road." | Back Stairs | keep, a place and an act the player read |
| favorable_under_pressure, gives the clock time | radio sample "Kitchen clear at 2:14." | Clock | keep, the marker becomes the name |
| negotiated at Larkin Court | detail names no room | Back Room | reject, traces to nothing, and "back-room deal" suggests secrecy |
| a long wait that ended well | detail "Held the rear for forty minutes." | Cold Feet | reject, the idiom means losing nerve |

Never offer a name from body, age, accent, faith, culture, family or pronouns. Never use war
vocabulary or a weapon. Never name a death or an injury. Never offer two names within a game week.

## 7. Exit lines

The engine builds personnel details in code. These are the strings as read, quoted so a writer
knows what the player sees today.

```
anniversary            <Full name>: <n> years of service. Wage +$1/h (now $49/h). Now Seasoned
birthday               <Full name> turned 55: Recovers 10% slower
retirement, service    <Full name> will retire on <date> after <n> years of service. A retention offer is possible.
retirement, age        <Full name> reaches the mandatory retirement age of 60. Retiring on <date>.
retirement, burnout    <Full name> is burning out (stress above 70 for 20 days) and will retire on <date>.
retired                <Full name> retired after <n> years of service.
retention refused      <Full name> is leaving from strain; a raise will not change that
```

The shift report prints the full name before each detail, so the player likely reads the name
twice. That was read in source and not seen rendered. File it as an engineering request.

Proposed additions keep the engine's stat and append one ledger fact, inside 15 words, without the
name.

| Reason | Proposed detail |
|---|---|
| age | Retires at 60 on 2 Jun. Held the Wren Court rear for forty minutes. |
| service | Retires 3 Jun after 26 years. First call here was the Calder Street flood. |
| burnout | Leaves 2 Apr from strain. Three hard calls in five, the last at Calder Street. |
| retired | Retired after 26 years. Kept the stair light working at Wren Court. |

A burnout line names what the officer carried, never a weakness. "Is burning out" is plain, and
"leaves from strain" puts the cause in the job. Never write "cracked", "broke", "couldn't hack it"
or "lost their nerve".

## 8. Name hygiene

1. Callbacks, details and pair beats name civilians by role.
2. Before a batch ships, run the collision check in representation-checks.md and list any civilian
   whose surname matches a deployed officer's.
3. Ask engineering to exclude deployed surnames from the civilian cast draw. Until then, review
   catches it.
