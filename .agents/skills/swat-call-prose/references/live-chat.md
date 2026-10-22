# Live chat

Rules for every viewer line on a stream or crowd: the stream's cue pools, a threat's phase threads, the
state pools and the spike pool. The engine rule (what plays when) is in `docs/call-pressure.md`,
"Chat that follows the pressure". This file is how the lines are written and read. The shape is
specified and not yet built, so until it ships a call can write only the cue pools and the spike
pool, and the sections below on threads, `after` and the state pools are the plan for the rest.

Every example here is invented, from one call that is not in the game (a bartender streams from a
locked bar and the threat is "Bar named by {handle}"). Never copy one into data.

## What the chat is for

The strip shows a gauge that drains toward something. The chat is where the player sees why. If the
threat is that viewers work out where the bar is, the player watches them do it, and when the
landing text says it was posted, nothing in it is news. A chat that runs beside the gauge and talks
about something else tells the player the pressure is a number.

Two things follow. Every line belongs to a pool that is keyed to something the player can see (a
threat's phase, the stream's state, the stream's count), and every line stands alone, because the
strip shows two at a time and a reader who looks away misses the one before.

## The pools a call writes

| Pool | Keyed to | Lines | Order |
|---|---|---|---|
| Thread, early | a threat's drain under a third | 5 to 7, floor 5 | written order, once each |
| Thread, closing | a third up to two thirds | 5 to 7, floor 5 | written order |
| Thread, imminent | two thirds to the landing | 5 to 7, floor 5, last line reserved | written order |
| State: stopped, slowed, surged, dropped | the stream's state beginning, or the count falling a seventh | 3 to 5 each | written order, once |
| Cue pools | how many cues the stream has heard | 16 or more each | random, once each (as today) |
| Spike | a jump in the count | 8 or more | random, three at a time (as today) |

Why 5 to 7. A phase is 20 to 26 seconds at Standard and 40 to 52 at Relaxed, and the strip plays a
line every 2.2 to 5 seconds. Three ticks in four are thread. A longer thread gets its end cut off
at Standard, and its last line is the one that matters. Imminent has no filler.

Threads are written, not drawn: write them in reading order and let one line answer or echo the one
before. The first line of each thread carries the threat (a question, a guess, a name), because a
player who reads for 20 seconds is still in early and has to have seen it by then. A line that says
what a beat reveals carries `after: <beat id>` so it plays behind the radio's report, never ahead.
The cue pools are the filler between thread lines, so they hold what the audience at that count
would say about anything. The thread holds what they'd say about this threat. A threat with
no viewer cause (the rider stands over the manager, a call from home) still gets a thread: the chat
reacts to what the camera shows and to what it stops showing.

## The three phases

Write the phase before the line. Ask what the viewers know now, and what one more minute gives them.
The arc depends on what the threat is. Match it, and never run the same arc twice in a call.

| The threat is | The arc |
|---|---|
| Viewers finding something out (an address, a clip) | A question, guesses that narrow, the nearest one says less, the poster is typing |
| The chat turning on someone | One doubt, a few agree, a pile-on, the rider answering them (a role's line) |
| The rider doing something on camera | What the camera shows, a viewer who looks closer, a few asking someone to step in |
| The news arriving | A local viewer notices, others check, the count's register changes |
| The line going quiet (no sound, no one answering) | Questions about the silence, someone asks if the audio is out, a few leave |
| Something off camera (a call, a text) | What viewers can't see: "why is the phone face down", someone asks what that was |


- **Early.** The thing is noticed. One viewer asks, one guesses badly, one sets it aside, and most
  of the chat is somewhere else (battery, the bus, dinner). The poster and the viewers who will
  get it right don't appear yet or sound like everyone else.
- **Closing.** The guesses converge and the chat gets shorter and more sure. Someone gets a detail
  right, someone says they're nearby, someone objects, someone doubts. A wrong guess gets
  corrected. The one closest to the answer says less and less. Early off-topic lines thin out.
- **Imminent.** The answer is typed or about to be. Short lines, pile-ons, objections, a regular
  asking for a mod, and the poster's own line as the last thing in the phase. The poster says they
  have it or are typing it, and never says the landing. No off-topic lines here.

A thread stops one step short of the threat's text. If the threat text says the address is posted,
the chat never says it was. If the threat text says the rider reads it aloud, the chat never says
the rider did.

The example, three lines a phase, not a full thread.

```
Bar named by {handle}
early      which bar is this
           the one with the green door??
           no idea, every bar looks like this
closing    green door plus a train out back. thats the rail side
           ok im on the map, two bars by the tracks
           second one? 📍
imminent   {handle} you got it
           please dont post it
           i know it. typing it
```

Why these work. Each early line is a different person with a different amount of information. The
closing lines add one fact apiece (a door, a train, two bars, the second one). The imminent lines
are short, an objection comes before the poster's line, and the poster's line is last, the reserved
slot. None says the bar was named.

## Who is speaking

The UI puts a generated handle on a line, so a line carries no handle of its own. Two exceptions,
both a line that names its speaker in the data.

1. **The named poster.** When a threat's label or text uses `{handle}`, that commenter's line is the
   last line of the imminent thread, under that handle. The name on the gauge is a person in the
   chat.
2. **A role in the call.** The courier at the tape, a regular who acts as moderator. Their line
   goes under their own first name, which the player has already met in a beat.

A viewer replies to another by their handle ("{handle} you got it") at most one line in six, and
uses a role token's first name for the rider, never a gendered word.

## What a viewer can know

A table before writing. A line outside it is a leak or a mistake.

| Source | A viewer knows it | A viewer doesn't |
|---|---|---|
| The rider's phone | the picture, the sound, what the rider says to it | what is outside the frame, the stockroom, the street |
| The comments | what other viewers type | who is the person behind a handle |
| The news | what an outlet shows on air | what the police plan |
| The scene | what the nearby viewers and the courier at the tape report | radio traffic, positions, the hidden truth |

The chat is public and the same in every situation of the call, so no new hidden fact may be stated
as certain. A viewer may repeat a belief the call has already put on the page as the audience's
belief, and be wrong (the call's own text says four hundred people believe the rider, so a viewer
saying so is the audience, not a revelation). Report a rumor as a rumor ("someone said").

## How a real chat reads

An AI-written chat is polite, balanced and the same length. A real one is rough. Aim for these.

1. **Short.** Median 4 words, none past 60 graphemes (`Intl.Segmenter`, after binding, so an emoji
   with its variation selector is one). A third of lines are
   one to three words ("wait", "nooo", "who is that").
2. **Lowercase, with no apostrophes.** The existing pools' convention ("dont", "whats"). A shout is
   uppercase and short ("WHAT"). At most one shout and one stretched word ("nooooo") per phase.
3. **No dashes or colons** (the call's text rules). A question mark or two ("??") is fine, an
   exclamation mark at most once in ten lines.
4. **Replies and fragments.** A line answers the one before it, or answers one a minute ago. A
   question no one answers is real. A correction ("*9th") is real.
5. **Mixed minds.** Worry, nosiness, support, anger at someone on scene, the off-topic line. Don't
   rotate them in order. Two worried lines in a row is more real than worry, anger, joke.
6. **The first guess is wrong.** The chat is never right on the first try, and not everyone shifts
   when the right guess comes.
7. **Pile-ons.** At imminent and at a jump, three short lines close together that say nearly the
   same thing in different words ("dont", "please dont post it", "dont dont dont"). They never
   repeat a line word for word.
8. **A late arrival.** At most one "just got here what did i miss" a phase, and someone answers it
   in a short plain line.
9. **A regular acting as moderator.** At most one a call, from a role in the call. They ask people
   not to post it, in four to eight words, and they are ignored.
10. **A troll, rarely.** At most one in a threat's thread, never in imminent, about the spectacle and
    never about a person on scene. It is answered within the next two lines.
11. **Typos, sparingly.** One in eight lines at most: a swapped or dropped letter, the kind fast
    thumbs make. Never in the poster's line, a name, or a line about a person's danger. Never
    dialect spelled out. (The dialogue rule against phonetic spelling is for people speaking aloud
    on the call. It doesn't apply to chat, and a reviewer shouldn't flag a typo here as a tell.)
12. **Few names.** `{rider.first}` or another role token in at most one line in six, and the world
    tokens (`{delivery_app}`, `{stream_app}`, `{outlet_short}`) where a viewer would name them.
    Never a real brand, as everywhere.

AI-written chat tells to read for: every line a complete thought, every line a similar length,
every line reacting to the same event, a worried line then an angry then a funny one in rotation,
sympathy phrased the same way across lines ("praying for everyone"), a line that explains the
situation to the reader, slang that is already dated, a hashtag, an emoji on every line, a thread that narrows in the same three steps every time.

## Emoji

Emoji are on some lines and not most. The numbers are house targets to tune in the Lab.

- **Share.** Emoji on at most one line in five across a call's chat, and at least one thread
  phase with none. No line carries more than one kind. The same emoji may repeat up to three times
  in a line ("👀👀👀"). No skin tone or joined sequences.
- **Allowed.** 👀 📍 🙏 😳 😬 😢 😮 🤞 ❤️. Each on a line of the kind below.
  - 📍 on a question or a guess about where, never on a line that confirms or approves one.
  - 👀 on something new on screen or a jump in the count.
  - 😳 😬 😮 on disbelief about the spectacle or the news.
  - 🙏 ❤️ 😢 on worry for a person, in plain words, never as the whole line.
  Put some emoji on ordinary chatter (the bus, the battery, who just joined), not only on the
  threat's lines.
- **Banned.** 😂 🤣 💀 😭 🔥 🍿 👏 🔫 🩸 👍 ✅ and any weapon, blood, cheering or approving
  emoji. 😭 and 💀 are how people type laughing, 🔥 🍿 👏 cheer or watch for fun, and 👍 ✅ reward
  a correct guess, which here is the chat finding where the hostages are.
- **Never on** a line about a named person's danger or fear, the handgun, harm, the subject's
  state of mind, or what the police might do. Never on the poster's line. Never as a reply to
  harm. Never on a line that follows a harm line directly, or that confirms or celebrates what
  another viewer found. Read each emoji line against the two lines around it, not alone.
- **Counted as one grapheme.** A line that needs an emoji to be understood is rewritten.

## Ethics, in the chat

These are the rules every line is read against. E numbers are in
`../../swat-call-design/references/ethics-and-authenticity.md`.

- **Nothing glorifies the subject or force** (E2, E16). No hero, legend or "go off". No line asks
  for, predicts with relish or counts down force. A viewer may ask what the police will do ("are
  they going in?"), because real people ask.
- **No harm as a joke, to a named person, ever** (E7, E16). That is the manager, the clerk and the
  rider. A troll jokes about the spectacle, not them.
- **Self-harm** (E4.1, E4.2, E4.9). No viewer says the rider should hurt themselves or anyone, no
  one dares them, no countdown, no method, no "nothing to lose", no "suicide by cop". A viewer
  who is afraid says so about the person by name ("{rider.first} put it down"). The 988 line stays
  in the debrief (E4.7), never staged in the chat.
- **No pressure on the people in the room.** No line tells the hostage to give in to the demand or
  the rider to keep going ("make her say it", "say it louder"). A viewer may ask the rider to put
  it down, or ask for everyone to be let go. The grievance lines that already exist in the stream
  pool are read for this in the same pass.
- **Nobody tells anyone to go to the scene.** One viewer may say they're nearby or on their way.
  The chat answers them ("stay home", "dont go over there").
- **The address is never printed.** Guesses are landmarks, a street, a corner. The poster's line
  never holds a full address. The call's own store is a business, and the viewers are what is
  wrong, which is the point. A private person's name, face or home is never in the chat (E8).
- **No identity guesses** (E3). No viewer infers race, accent or background from the picture or
  the voice.
- **No gore** (E7). A viewer says what they saw in plain words and no more.

## The write-and-read pass

1. Write the sheet first, a table of every line in reading order with its phase, its device
   (question, guess, correction, nearby, objection, off-topic, shout, pile-on, regular, troll,
   poster), its emoji and its typo, so spread and caps are counted, not guessed.
2. Write each phase from the table above, with the beats beside it. Each beat that reports the
   comments has two or three lines showing it, in the phase it fires in.
3. Cut every line that could sit in any thread. A line carries something this threat's viewers
   would say now.
4. Read each thread in order, aloud, at the strip's pace (about three seconds a line), covering
   all but two lines. Does each line stand alone? Does the thread narrow? Does the last imminent
   line stop short of the landing text?
5. Reread the filler. The cue pools and the spike pool are played between and after thread lines
   (not in imminent), so every line in them must be harmless beside any thread. The spike pool is
   played on any jump in the count, a good one as well as a bad one, so it holds only neutral
   shouts ("wait", "whoa", "what is this"), never "oh no" or "is everyone ok". Cut any line from
   the reference's tell list ("praying for everyone").
6. Read the whole call's chat for repeats: no line twice, no four-word run twice (emoji stripped),
   and each opener (first two words) at most four times.
7. Run the string checker in chat mode when it exists. Until then run the dash, colon, gendered
   and length checks by hand and record that it was by hand.
8. Hand over to `swat-writing-review` for a separate read of the chat in the Lab on Play at 390px,
   with the Stall scrubber at each phase, and record the Lab URL and the stall minutes read.

## What a gate can check and what only a reader can

A gate (a tooling request) can check: a thread exists per threat and phase at its floor (or the
node is reached only after the stream stops and says `chat: false`), length in graphemes, the banned characters, words and emoji, the share of emoji lines, no emoji beside a
harm word, no repeated line or four-word run across the call's chat, the poster's line is present
and last when the threat names `{handle}`, `after` names a real beat, a state pool exists wherever
any effect (a choice, a beat or a threat) can stop, slow, surge or drop the stream, and a playback
test at both timer speeds gets the first on-topic line up within 3 seconds and the reserved line
up before the landing.

Only a reader can check: whether it reads as real, whether the guesses narrow, whether the last
imminent line stops short, whether a beat is dramatized, whether a line leaks a hidden fact,
whether an emoji trivializes, and whether a line stands alone.
