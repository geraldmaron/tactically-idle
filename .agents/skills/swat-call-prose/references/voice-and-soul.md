# Voice and soul

The rules in SKILL.md make a call clean. They do not make it alive. A read of Going Live on
2026-10-24 (owner: "prose is the star of the app", "reads like a book") found a call that passes its
own checker and still reports instead of tells. This reference holds the gates that were missing.
Where it differs from SKILL.md it wins, and each override is named.

What the read measured on Going Live, after binding (the baseline to beat, not a quota):

| Finding | Count |
|---|---|
| Cold open: sentences opening on a name or pronoun | 6 of 11, none spoken |
| Uses of the courier's name against the courier's pronoun tokens | 469 against 133 |
| Previews carrying "can" or "may" | 28 of 32 |
| Adverse results sharing one lead, threat, quiet skeleton | 19 |
| One beat (the courier learns the clerk never backed him) written as separate one-liners | 18 |
| The clerk's spoken lines against the courier's | 8 against 39 |
| Resolved endings that close on a status line | 1 of 5, the best outcome |
| Profile details never used again (the card behind the license) | 1 |

## 1. A scene surface has five things in it

A scene surface is a cold open, a stage prompt that opens a stage, a result that turns the call, an
ending and an epilogue. Each holds all of these, or the record says which is missing and why.

1. **A want.** Each person in it wants one small, concrete thing in the next minute: to sit down, to
   get the phone back, to hear the clerk is okay. It shows in an act or in speech, beside the big
   thing the call is about.
2. **Something heard.** One direct quote, or one sound the scene owns (the ringing register phone, the
   cooler). A scene with no spoken line is a summary of a scene.
3. **Something touched.** An object a person holds, grips, sets down or lets go of on their own
   initiative. The case of water works because the clerk will not put it down.
4. **A cost in a body or a relationship.** Say what the loss does, never its status. "Came in with
   nothing to pick up" is the closed account. "The account was closed" is the status.
5. **A source.** The squad was not in the room. The text either says how it knows (the clerk's 911
   call, the first minute of the stream) or stays where the squad could be. The source also licenses
   a voice.

The pivotal act gets its own sentence. A gun, a refusal or a door opening never sits in a "when"
clause under a stage direction.

## 2. Feelings: what the ban covers (clarifies SKILL.md rule 3)

The ban is on the narrator naming a mood: feeling verbs, mood adjectives, feeling nouns, inference
("so he is"). It stays.

It does not cover anything a camera and a microphone could record. Write these:

- What a body does: sits down hard, keeps both hands on the water, won't look up from the screen.
- What a person says in their own words, including naming their own fear in a direct quote ("I
  didn't say anything to anybody. I didn't.").
- A silence with a cause: nobody answers because the phone is face down.

Test: if the line fails the camera test, it is narration of a feeling. If it passes, a mood word is
not needed and a flat verb is not enough either.

## 3. Cadence is a gate on long surfaces (overrides SKILL.md section 10, step 3)

SKILL.md says opener share and cadence are "reported, never chased". That kept writers from gaming
the checker, and it let the shipped cold open run 45% name-or-pronoun openers with no one fixing it.

On the cold open, every ending and epilogue, and any stage prompt over 25 words:

1. Names and pronouns open at most 35% of sentences (rule 11's own number, now enforced here).
2. Three sentences of six words or fewer in a row is flat. Merge two, or let one run to the noun
   that matters.
3. No two consecutive sentences open on the same word.
4. Fix by changing the sentence's subject (the phone, the door, the time of night, a second person),
   by putting speech first, or by merging. Never by reordering words inside a sentence (rule 11).

On short strings (titles, previews, labels) the numbers are still reported only.

Read each long surface under a she/she and a they/they draw before it ships. Two people in one
sentence can share a pronoun (SKILL.md section 8 says to name the second). Going Live's cold open
shipped "Destiny came out of the stockroom ... Veronica's jacket. She backed into the stockroom",
and with two women in the cast "She" reads as Veronica.

## 4. One document per scene, and a date

A cold open names at most one record: an email, a log, a complaint. Three documents in a row (the
complaint, the log, the email) make a case file, not a scene. Give a time a part of the day and a
day when the player must reason from it ("at 11:40" tells a reader nothing about night or noon).

## 5. A beat is written once and branches by clause (overrides SKILL.md section 8, variants)

The "no 4-word run across variants" rule exists to stop one flavor sentence repeating on every path.
Applied to exits that cannot both happen in one play, it forces the same beat to be reworded again
and again. Going Live has 18 reworded versions of "the courier asks for the clerk and learns the
clerk never backed him" and 30 versions of "the clerk is already outside". Each is a thin one-liner
because each had to differ from the last.

Rule: when one beat sits behind several mutually exclusive exits, write it once as a set piece (two
to four sentences, with a spoken line when it carries weight) in a single helper. Each exit adds
only what is its own: who is holding the person, where they stand, what the weather at that door is.
The repeat check should count a shared set piece once per path, because the player reads one exit.
It cannot today (backlog `shared-beats-checker`). Until it can, pass the shared lines to the checker
as kept motifs and record them.

A beat that matters gets the most words. The moment a man learns the police lied to him is worth more
than the exit's choreography.

## 6. Tics, counted and answered

After binding, list the five most repeated content words and phrases in the call and say for each
whether it is kept (and why) or varied. Going Live's list: the weapon noun 132 times, "stockroom" 40,
"still" 42, "nobody" 26, "the one" or "the only" 10, "reads out" 15, "props the phone" 7.

- The weapon noun is named in every preview whose worst band reaches it. Everywhere else the threat
  rides on position and act ("her hand comes up", "he points at Brandon"), as
  vocabulary-and-lint.md says.
- "Still" stays only where it marks a change of state ("with the water still in her arms").
- A prompt that restates where the phone, the cooler and the handgun are (a tableau) is cut to the
  one position that changed.

No fixed count is the rule. A repeated word the player notices is the failure.

## 7. Previews and costs say what happens, not what could

A preview that leads with "can" or "may" hedges the one thing the player is reading for. Use the
visible condition the card already shows.

| Hedged | Direct |
|---|---|
| "{manager.first} can be held at gunpoint for the camera." | "The line goes dead. Near breaking point, {rider.first} keeps the handgun on {manager.first} beside the phone." |
| "{rider.first} can refuse and keep {manager.first} beside the handgun." | "{rider.first} refuses the release and sits between {manager.first} and the way out. Near breaking point, the handgun stays on {manager.first}." |

Shape: the base case first, in the words of what the player will see if the stance is lower, then
one conditional sentence that opens with the stance label the card prints ("Near breaking point").
The 4-word repeat gate applies to previews too, so the second sentence varies its verb and
subject from one preview to the next, and the first sentence never copies the result it previews.

The condition has to be one the player can see (the stance meter, a mark, a visible object). A
preview stays true in every situation that reaches it (SKILL.md section 5).

Summaries: {lead} doing the risky part stays (SKILL.md section 6), and a menu does not open every
summary on it. Going Live opens 22 of 32 on {lead}, which turns the menu into a list of officer
actions. Open on the person the choice touches or the thing it changes, and keep {lead} for the one
or two options where the officer's own act is the risk.

A cost is a loss a person could say out loud, with the person in it. "Brandon answers on camera
before you can check it" beats "the viewers will hear the answer before you can check it".

## 8. Voices (extends SKILL.md section 6)

Every role gets a speech signature in its design notes, not in the player-facing text: sentence
length, what the person never says, one habit. Proposed signatures for Going Live (design, not yet
in the data):

| Role | Speaks in | Never says | Habit |
|---|---|---|---|
| Courier | short, to the camera, repeats a time | the word "sorry" before the shot | says the timestamp when afraid |
| Manager | practical complaints, a body that hurts | the clerk's name until it is said for her | asks to sit, to stand, to move |
| Clerk | a denial said twice | anything about the bag | asks about someone else first |
| Friend | typed, lowercase, no punctuation | a request | says where they are standing |

Balance: count the exchange lines each named person speaks and record the counts. A person who
speaks under a third as often as the most frequent speaker needs a stated reason. Going Live gives
the courier 39 lines and the clerk 8, and the clerk is the nineteen-year-old at the center of the
night. The call hardly lets that person talk.

Dialogue explains nothing it can dodge. If a person says the thing the scene is about in a full
sentence, rewrite it as the thing they say instead.

## 9. A good ending does not end on a status

The last sentence of an ending or epilogue is a human act on a named person present. It never ends
on a ticket, a process or a report ("The order number is still open on {delivery_app}'s side").
Going Live's best outcome ended that way. The worst outcomes had the strongest closing lines (the
whiteboard in the manager's handwriting, the clerk asking who will lock up). Write the good ending to
that standard.

## 10. Writing for people who persist

Calls will reuse people (backlog `going-live-city-cast`). Prose has two jobs there, and they stay
apart.

**Written, never read back.** An epilogue is authored once, shown once and is not evidence. It may
describe the night. It may not decide a person's future, because a persisting person has one: an
epilogue that says the clerk never went back to the night shift contradicts a record where the clerk
is still on the roster. Rewrite such a line as something the night itself contains, or turn it into a
world event the engine records and the epilogue then reads.

**Read, never invented.** A later call may refer to this one only through a recorded fact: a flag
the call set (`lie_found`, `admitted_live`, `proof_seen`, `officer_down`), the place, the officer
present, the ending title. Facts are short, past tense, name no civilian and sit inside the
80-character shapes of `src/content/people/facts.ts`. A callback line:

1. Cites one recorded fact and the officer who was there, never a memory the engine did not write.
2. Appears at most once per call, and never twice for the same person in a row.
3. States the fact plainly ("Reyes was on the Market Row call when the stream ended"), and lets the
   officer's own voice carry any feeling.
4. Never reads a hidden truth. What the call revealed (`reveal`) can persist. What it kept hidden
   cannot.

Contradictions to check before a call ships: a relationship that holds in only one situation (the
clerk is the manager's nephew in situation 1 only), a hidden fact a persisting person would have
across situations, and a clause that fixes a future the record owns.

## 11. Speech, references and idiom (from the owner's line edit of 2026-10-24)

The owner read the cold open and stopped on six lines. Each is a class of fault, and each now has a control
(Q5, Q6, Q7, L1 in docs/content-policy.md).

| What the owner said | The fault | The rule |
|---|---|---|
| "And the account. What account?" | A noun the reader was never given ("the account was closed") | The first mention names the thing: "shut off her courier account". |
| "Veronica read it next to her scooter" (the text said "the scooter") | A bare article where a person's own thing takes the possessive | Possessives for what a person owns. |
| "Ten minutes before closing feels more natural than ten minutes before close" | Officialese | Read the phrase as a person would say it. |
| "Say I didn't fucking take it, or something more aggressive. This needs to be felt heavy." | The central demand was polite and flat | The demand lands hard. Strong language is allowed in direct speech from a person under pressure (the app is 18+ and the questionnaire counts it). The weight comes from the face, the room and the phone still streaming, never from adjectives. |
| "Eleven-forty Sunday night I was at the light on Calloway. You know that. You know it. This makes no sense and feels disconnected." | A reference nobody had set up (the light, the map) and a time nobody says about a night they both lived | Plant the fact in an earlier surface (the cold open now says her own map had her stopped at a red light on Calloway when the order was logged), then speak it the way she would: "It's on my map. I showed you the map." |
| "Somebody called cass1996 wants the address. This feels like a very unnatural sentence." | A written sentence in a mouth: a noun phrase and a relative clause with no connective | Read it aloud as that person. "Somebody just asked where this is. It's cass1996. Say it, Brandon, or I tell them." |

**Reference audit (Q5), at the soul pass.** List every place, document, device, time and earlier event named in speech or
narration. For each, write the earlier surface that told the reader (the cold open, the briefing, an earlier node). If
there is none, plant it there or cut the reference. Speech never carries exposition the narration owes, and no person
explains a thing the other person already knows.

**Aloud test (Q6).** Say each line in that person's voice at speed. Fail on: a long noun phrase with a relative clause,
"Somebody called X wants", a sentence that lists what both people know, a line with no breath. Give speakers different
rhythms: the courier short and hot and repeating a word when afraid, the manager practical and tired, the clerk a denial
said twice, the friend typed.

**Strong language (L1).** In direct speech only, from a person under real pressure, about a person or a situation. Never
aimed at a group, never sexual or abusive in framing, never decoration or repetition. Every hit is counted:
`ratingProfile` carries the share of situations with strong language, the launch advisory names it, and it is a
question on the store forms.

**Heavy moments.** A moment is felt when the reader sees what the person's body and the room do (the smile gone, the phone
still streaming, the clerk backing away with the water in her arms) and hears one line that costs the speaker something.
Make the threat land through sound, distance and a person's reaction, inside V1, V4, V5 and V6: no wound detail, no named
method of harm, no repeated contact with a body part, no countdown or composed spectacle.

## 12. What the record adds

Add these lines to the Call prose record (SKILL.md closing gates):

```
- Voice: answered | scene surfaces <n>; want/heard/touched/cost/source present <n/n each>; missing <surface, which, why | none>
- Cadence on long surfaces: answered | name or pronoun openers <n%>, three short in a row <0>, same opener twice running <0>
- Shared beats: answered | <beat> written once in <helper>, exits <n>, exit-only clauses <n> | none
- Tics: answered | five most repeated <word xN, kept because | varied to>
- Voices: answered | exchange lines per named person <name n, ...>, smallest share <n%>
- Endings: answered | last sentence a human act on a named person <n/n>, status endings 0
- Persistence: answered | epilogue claims about a person's future 0, callbacks read recorded facts only, situation-only facts flagged <none | list>
```
