# Profile patterns

This file owns the voice-marker spec. swat-call-prose reads officer markers from here and applies
them to every line an officer speaks inside a call. Change the spec here and nowhere else.

Every example below is illustrative. Persona notes are quoted from the persona catalog as read on
2026-10-06. Rewritten lines are proposals, and none ships until swat-writing-review approves it.

## 1. The profile formula

A recruit card line is the catalog hobby plus what that hobby does on a call. The officer sheet
adds one light contradiction, three voice markers and a radio sample. Deeper layers open with
service and are design only until engineering adds story fields.

The sheet runs in this order.

1. Pressure line, 18 words at most, opening with She, He or They.
2. Contradiction, 12 words at most.
3. Voice markers, exactly three.
4. Radio sample at Ready, 10 words at most.
5. The same sample at Overloaded, 4 words at most.
6. Layer 2 and Layer 3, each one sentence, design only.

A pressure line passes when a reader can name the call that would test it. "He checks every
handset twice" is tested the first time a radio fails. "He is dedicated" is tested by nothing.

The line turns from the hobby to a call moment the player can picture (a room, a voice, a door). A
hobby clause alone fails. Read it aloud and ask what you would expect this officer to notice on the
next call. If the answer is vague, rewrite.

- Before. "He plays cooperative board games with neighbors and always asks who hasn't had a turn
  yet." Warm, and it names nothing a call would test.
- After. "He plays cooperative board games. In a crowded room he finds the one who hasn't spoken."

## 2. The voice-marker spec

```
Voice markers
- length: short | medium
- noticesFirst: exits | hands | sound | time | gear | words | faces | light | count
- habit: <one verbal habit, 6 words max, from the approved list or reviewed before use>
- from: <the words of the pressure line each marker grows from>
- sample: <radio line at Ready, 10 words max>
- overloaded: <the sample cut to the noticed thing, 4 words max>
```

Length means words per radio call. Short is 2 to 5. Medium is 6 to 10. Spoken lines outside the
radio may run to 15 words, per the surface budgets owned by swat-call-prose.

Notices first is the first fact the officer reports. Two officers in one squad should differ here
so the player can tell them apart on the radio.

Pick markers from the persona's own pressure line, and write on the sheet which words each grows
from. A marker copied from an example set in this file or in SKILL.md needs a stated reason. The
Ready sample shows all three markers, and the sheet points to each one in it.

Approved habits, each a thing the listener can hear.

| Habit | Sounds like |
|---|---|
| counts out loud | "Front room. Two inside, both talking." |
| names the person | "Ruiz has both hands on the rail." |
| ends on a question | "She's at the window. Want me to ask her?" |
| reports gear before people | "Shield's here, bag's here. Two of us." |
| gives the clock time | "Kitchen clear at 2:14." |
| repeats the last thing said | "'Not tonight.' He said it twice." |
| names the street | "Rear's clear to Dace Street." |
| says copy and nothing else | "Copy." |
| describes hands first | "Hands empty. He's sitting down." |
| names the next step | "Back stairs next." |

Radio grammar is position, then status, then need, in that order, under ten words. The marker
shapes word choice inside that order and never replaces it. A spoken line carries one beat.

Cold-read test. A stranger hearing only the line can say where the officer is and what they see.
"Clear. Counting two. Both talking." fails, since nobody can say where, or two of what. "Kitchen.
Two people, both talking. One quiet by the door." passes.

Reserve "clear" for an empty or secured space. Never follow clear with occupants. Radio coinages
that fail on sight include "counting N" as a status and "clear" beside an occupant count.

Under strain, drop the need clause or repeat the status once. Never strain a line by repeating a
bare number ("Two. Two."), which reads as noise. Neither carries a quip under threat, war vocabulary (tango, hostiles, neutralize, breach and
clear), a ten-code or phonetic spelling. Regional voice lives in word choice. A habit appears once
per call at most, because a catchphrase heard three times stops being a person.

Plain word order. Every officer line, bio, callback and shift entry runs subject, verb, object,
the way a person talks on a radio or writes a log. Repeating a name or a pronoun across lines is
normal. Dodging it with a twisted sentence is the tell a player hears within two taps. Three
shapes fail on sight.

| Shape | Fails | Write instead |
|---|---|---|
| Locative inversion | "Out comes Hale." "Down goes the ladder." | "Hale is out." "The ladder is down." |
| Fronted modifier on the subject | "Quiet now, Hale holds the rear." "Unhurt, Reyes is outside." | "Hale holds the rear. They've gone quiet." "Reyes is outside and unhurt." |
| Dangling modifier | "Folded in his pocket, Vann keeps the note." | "Vann keeps the note folded in his pocket." |

A radio status may drop its verb ("Kitchen. Two people, both talking."), because radio grammar is
position, status, need. A shift entry may drop its subject, because the UI prints the name. Neither
license covers the three shapes above.

Name the object. Every "it", "that" or "one" points to a noun earlier in the same string. A weapon,
a door or a handset is named in the line that asks the player to act on it, never carried by "it"
from an earlier card. "Reyes says it's pointed at the door" fails. "Reyes says the rifle is pointed
at the door" passes, and the object noun comes from the call's facts, never invented here.

The stress ladder is the same for every officer.

| Band | What the line keeps |
|---|---|
| Ready, under 30 | all three markers |
| Strained, 30 to 59 | length and noticed thing, habit drops |
| Overloaded, 60 to 79 | the overloaded form only |
| Mandatory recovery, 80 and up | no lines, the officer cannot deploy |

A trait change also moves the voice, shown in the line and never narrated.

- Gaining steady removes repetition. The count is given once.
- A scoped strain trait shortens lines on that call type only.
- Leaving rookie lets the habit appear for the first time.
- Losing impatient lets a waiting line run its full length.

With no markers on file, in-call lines stay neutral, with no habit and no invented quirk.

## 3. Conversions from the catalog

Sixteen conversions, six of them from the 27 notes that open with "enjoys". Each keeps the hobby,
adds what it does on a call, and was read against all 5 roles and all 6 traits plus none.

| Persona | Catalog note | Pressure line | Hook |
|---|---|---|---|
| person_002 Marcus Brooks, he | He restores old radios on quiet weekends. | He restores old radios and trusts nothing he hasn't opened up himself. He checks every handset twice. | checks_gear |
| person_001 Mei Chen, she | She keeps a sketchbook of neighborhood shopfronts. | She sketches shopfronts on her days off. She's the first to say a lock is new. | notices_change |
| person_004 Daniel Vale, he | He enjoys repairing mechanical clocks. | He repairs old clocks. In a quiet room he hears the one thing still running. | hears_sound |
| person_005 Naomi Okafor, she | She maintains a collection of handwritten family recipes. | She keeps her grandmother's recipes in pencil, and she won't sign a form she hasn't read. | reads_paper |
| person_010 Amandeep Kaur, she | She enjoys identifying birds by their songs. | She names birds by song alone, and hears an upstairs window open before the radio does. | hears_sound |
| person_056 Dara Vann, they | They keep a notebook of amusing overheard phrases. | They write down what strangers say, word for word, and can repeat a caller back exactly. | remembers_words |
| person_011 Jordan Ellis, they | They make tiny ceramic bowls at a community studio. | They glaze bowls at a community studio and can tell by touch when a surface is still warm. | reads_touch |
| person_012 Morgan Hale, they | They walk a different city footpath every Sunday. | They walk a different footpath every Sunday and know three ways out of most blocks downtown. | knows_routes |
| person_068 Elif Demir, she | She enjoys photographing colorful doors. | She photographs doors and can say which way one opens before anyone touches it. | knows_doors |
| person_072 Aleksei Morozov, he | He collects recordings of unusual mechanical sounds. | He records odd machine noises and can pick a running engine out of a whole street. | hears_sound |
| person_045 Yuki Tanaka, she | She likes following the history of neighborhood street names. | She learns what every street used to be called, so callers' old landmarks still make sense. | knows_routes |
| person_067 Aram Sarkisian, he | He repairs old chess sets with missing pieces. | He repairs chess sets with missing pieces. He counts what's on the board before what's gone. | counts_things |
| person_049 Jian Wu, he | He enjoys taking long-exposure photographs of city lights. | He takes long-exposure photos of city lights, so he counts seconds without a watch. | tracks_time |
| person_088 Emilio Vargas, he | He enjoys repairing and polishing old hand tools. | He restores old hand tools and always knows which one is missing from a bench. | notices_change |
| person_062 Youssef Mansouri, he | He enjoys collecting and repairing old fountain pens. | He repairs old fountain pens and reads anyone's handwriting, even a note left in a hurry. | reads_paper |
| person_033 Farah Qureshi, she | She keeps a journal of interesting cloud formations. | She logs clouds every morning and is the first to say when smoke isn't weather. | reads_light |

Seat reads that needed a second look.

- Okafor. "Won't sign a form she hasn't read" is a habit about paper, not a claim of steadiness,
  so it stands beside impatient. It also carries family without making family a wound.
- Vann. Every officer hears the briefing, so repeating a caller back fits a medic or an entry
  officer as well as comms.
- Demir. Which way a door opens is a decision detail, not an entry method, so it passes the
  no-manual rule and fits a medic.
- Brooks. "Trusts nothing he hasn't opened up himself" is mild distrust of objects, not people. A
  version about people would read as a temperament and fail.
- Wu. "Counts seconds without a watch" could read as impatience. It reads as precision beside
  steady and as restlessness beside impatient, and both are fair.

Hook spread in this set is three hears_sound, two each of notices_change, reads_paper and
knows_routes, and one of the rest. In a full pass over 100 notes, cap any single hook at about 12
so the roster does not hear the same officer five times.

Hook vocabulary, identity-level only and never cultural. checks_gear, notices_change, hears_sound,
reads_paper, remembers_words, reads_touch, knows_routes, knows_doors, counts_things, tracks_time,
reads_light, reads_faces.

## 4. Contradiction patterns

A contradiction makes the officer a person rather than a function. It stays light, runs 12 words
at most, and must not restate or deny a trait chip.

The examples show shape only. Never reuse the second clause's object or its frequency word.

| Pattern | Example, shape only |
|---|---|
| careful here, careless there | Labels every drawer in the van. Her own glovebox is a landfill. |
| good at what they avoid | Hates the phone. Dispatch asks for her anyway. |
| precise with objects, loose with time | Knows every strap on the van. Late to every birthday. |
| loud off duty, spare on the radio | Longest stories at lunch. Four words on the radio. |
| fixes for others, ignores their own | Fixes every squadmate's zipper. His own jacket hangs open. |
| open about others, closed about self | Quotes strangers all day. Tells nobody what's in the notebook. |
| tidy kit, chaotic locker | Kit packed to the gram. Locker shelf is a landslide. |
| gives advice, skips it | Tells everyone to eat before a long call. Never does. |
| keeps things, then gives them away | Fixes bikes for months, then hands them to whoever asks. |

Rules.

1. Careful here, careless there is limited to one officer in ten in a batch.
2. The contradiction names an object or moment unique to this persona's hobby. The careless half
   must be as specific as the careful half. If it could be swapped onto any other officer, rewrite.
3. A misplaced everyday item (keys, cup, phone, car, parking spot) is rejected. The frame "loses
   his own X daily" or "weekly" is worn out.
4. Never a vice (drink, gambling, debt), misconduct of any size, a health condition, a
   relationship in trouble or a trauma. "Patient at work, impatient at home" fails because it
   argues with the trait chip, which changes per campaign.

Review check. Diff each contradiction against the rows above. A shared verb or object with an
example row needs a stated reason, and a shared frame with another officer in the batch fails.

## 5. Six marker sets

| Set | Length | Notices first | Habit | Ready | Strained | Overloaded |
|---|---|---|---|---|---|---|
| A | short | exits | counts out loud | "Hallway. Two doors, one window. Three inside." | "Hallway. Three inside." | "Two doors." |
| B | medium | hands | names the person | "Ruiz has both hands on the rail. Still talking." | "Both hands on the rail." | "Hands on rail." |
| C | short | sound | says copy and nothing else | "Upstairs. TV's off. Copy." | "Upstairs. TV's off." | "Quiet upstairs." |
| D | medium | time | names the next step | "Kitchen clear at 2:14. Back stairs next, two minutes." | "Kitchen clear at 2:14." | "Kitchen, 2:14." |
| E | short | gear | reports gear before people | "Front steps. Shield, bag, two of us." | "Front steps. Two of us." | "Front steps." |
| F | medium | faces | ends on a question | "Porch. She's watching the window, not us. Ask her?" | "Porch. She's watching the window." | "Watching the window." |

Set B uses a bound cast name as a placeholder. In data the name comes from the call's cast at
binding, never from the officer file.

## 6. Three-layer reveals

Layers open in tiers, the way a character file opens as trust rises. Layer 1 is free on the
recruit card. Layer 2 opens after shared operations (proposal, 5). Layer 3 opens after a recorded
event of one ledger kind and carries a slot filled from that entry. Layers 2 and 3 are design
only.

| Layer | Marcus Brooks, he | Amandeep Kaur, she | Dara Vann, they |
|---|---|---|---|
| 1, recruit card | He restores old radios and trusts nothing he hasn't opened up himself. He checks every handset twice. | She names birds by song alone, and hears an upstairs window open before the radio does. | They write down what strangers say, word for word, and can repeat a caller back exactly. |
| 2, after 5 shared operations | He keeps a spare handset in his bag, wrapped in a dish towel. | She hums when she counts. When the humming stops, she's lost the count. | Their notebook has a page for every call and no names in it. |
| 3, after a ledger event | (negotiated) Since {place}, he hands the spare to whoever is doing the talking. | (rescue) Since {place}, she asks for one quiet minute at every door. | (person_lost) They kept the page from {place}. Nothing else is written on it. |

A layer shows one object or act and stops. No because, so or which-means clause. If the line needs
its reason stated, the image is wrong.

- Before. "His score pad has one column, because his games only have one team."
- After. "His score pad has one column."

Layer 3 lines built on person_lost go to a human reviewer before they ship. They carry weight
through an object or a habit, never the event, never blame and never the officer's feelings.

## 7. Banned words and what to write instead

| Banned | Why | Write instead |
|---|---|---|
| brave, fearless | a virtue claim that reads false on a strained officer | the act, only when a ledger fact backs it |
| dedicated, tireless, hardworking | resume words that no call can test | the habit, such as "checks every handset twice" |
| by the book | a trait claim and a cliché | the specific rule kept, "won't sign a form she hasn't read" |
| heroic, selfless | judges for the player | what happened, by place |
| natural leader, born medic | assumes a role the seat may not give | nothing, the role chip says it |
| rock, anchor, ice in the veins | the steady chip in metaphor | nothing, the trait chip says it |
| hothead, short fuse | the impatient chip as an insult | nothing |
| haunted, broken, damaged | trauma as the whole personality | weight shown in behavior, from the ledger |
| veteran, rookie, green, seasoned | calendar and seat claims | nothing, the career panel says it |

## 8. Rejected profiles, with repairs

1. **The resume.** "Decorated twelve-year officer with expertise in entry and crisis negotiation."
   It claims service, a role and two certs that the seat may not give. Repair with a pressure line
   from the hobby.
2. **The role-assuming bio.** "First through every door, she has never lost a stack." It fails on
   a medic and treats force as the reward. Repair with "She photographs doors and can say which
   way one opens before anyone touches it."
3. **Trauma as personality.** "Still haunted by the call that went wrong, he trusts no one." It
   invents history and makes damage the whole person. Repair by keeping the hobby. Weight arrives
   later, from the ledger, if the player's calls earn it.
4. **Culture as temperament.** "Her upbringing made her disciplined and respectful of authority."
   It draws temperament from identity, which the ethics rules forbid. Repair with the specific she
   owns, the recipes in pencil and the form she reads.
5. **An age that breaks the calendar.** "After twenty years on the job, Hana has seen it all."
   Hana Park is 24 in the catalog, and any persona's service varies per campaign. Repair with no
   time claim, as in "She folds paper buildings and notices when a real one has a window that
   doesn't match."

## 9. Pronoun forms for templates

The catalog has 44 she, 43 he and 13 they. A template that uses the surname as its subject needs
no agreement ("Hale checks the rear"), so prefer that shape. When a pronoun is unavoidable, use
this table and test all three sets.

| Form | she | he | they |
|---|---|---|---|
| subject with verb | she checks | he checks | they check |
| to be | she is, she's | he is, he's | they are, they're |
| to have | she has | he has | they have |
| object | her | him | them |
| possessive | her radio | his radio | their radio |
| reflexive | keep out of templates | keep out of templates | keep out of templates |

Authored per-persona lines may use a reflexive, as Brooks's "himself" does, because they are
written for one pronoun set and never bound.
