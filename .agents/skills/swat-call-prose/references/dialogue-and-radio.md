# Dialogue and radio

Rules and paired examples for every line a person says aloud in a call. Spoken
lines live inside ordinary fields (a known line, a stage prompt, a result), so
they inherit that field's ceiling in surface-budgets.md. On top of that, a
radio line stays under 10 words and a spoken line under 15.

Every after line here is illustrative. Never paste one into data.

## Attribution and format

- Attribute with "said" or "says", or with the speaker format the UI prints.
  No fancier verb, no adverb on "said".
- Reported speech without quotation marks ("Ten more minutes, Lewis says") is
  tagged at most once per stage per speaker. Use a direct quote for the line
  that matters, at most one per result. An untagged sentence in a speaker's
  voice reads as narrator fact, so it quotes and names the speaker or is
  recast as narration. The checker counts ", <name> says/tells/decides" and
  flags a speaker over 6 per call.
- Quotation marks are curly, as in the exemplars. “Like this.”
- A writer never types a colon to introduce speech. Use a comma or a new
  sentence. "Ben told the dispatcher, “I only needed one signature.”"
- Regional voice comes through word choice and rhythm, never phonetic
  spelling. "Wasn’t nobody home" is word choice. Dropped letters with
  apostrophes are phonetic spelling.
- The lint checks accusation words sentence by sentence. Keep the speaker in
  the same sentence as the accusation. "The neighbor says a man broke the
  side window." passes. A bare quote of “He broke in.” followed by a separate
  attribution does not.

## Callers and bystanders

Callers talk in fragments. They repeat the one thing they fear and answer the
question they care about rather than the one asked. They place things by habit
and landmark, never by floor plan. They say how they know, and some are wrong.
They never deliver exposition.

1. Before "My father, who has a heart condition, has collapsed in the
   kitchen." After "He’s on the kitchen floor. He’s got the pacemaker. The back
   door’s stuck."
2. Before "I believe there is an unknown individual inside my neighbor’s
   residence." After "There’s a guy in Dot’s place. Dot’s at her sister’s. I
   saw him through the blinds."
3. Before "The man is armed and extremely dangerous." After "He had something
   in his hand. Could’ve been his phone. I don’t know."

The third pair matters. A caller who might be wrong is the cheapest honest
source of doubt in the game, and it keeps the briefing from settling the
truth.

"Weapon" is a radio and briefing word. Civilians never say it. In a reported
claim, keep the person's framing ("she says she has Walt’s old pistol", where
the owner's armed-word decision allows it) or talk around the object ("what’s
in my pocket", "what my husband kept"). Until that decision is made, flag
each such line rather than substitute "weapon".

4. Before "Lucia says she has her late husband’s weapon." After "Lucia
   told the medics she has what Walt kept in the nightstand."

## Subjects

A subject is a person on the worst night of their year. Give them one need or
grievance, said plainly and often repeated. No monologue, no self-diagnosis,
no explained motive. The writer knows the private logic from the design sheet,
and the line obeys it without stating it.

1. Before "I am in here because I lost custody of my children and the system
   has failed me." After "They took the kids. Nobody’s coming in."
2. Before "I have depression and nothing left to live for." After "I’m tired.
   Tell my sister I’m tired."
3. Before "You’ll never take me alive!" After "Go home. All of you, just go
   home."

Crisis rules apply inside quotes too. No method words, no single cause, and
the person stays the stake. A subject's line never explains their illness,
because mental illness is never the story's explanation.

## Radio

Radio gives position, status and need, in that order, in plain language. No
ten-codes, which differ by agency. No war words.

1. Before "I am currently positioned at the rear entrance of the building and
   the door appears to be locked." After "Two at the back. Locked. Need the key
   holder."
2. Before "Possible ten-thirty-two in the vicinity." After "Car in the alley,
   engine running. Nobody in it."
3. Before "Hostile spotted on the second floor, engaging." After "Second floor,
   east window. Man at the glass. Holding."

Release in one line. When something happens fast, the radio says it once and
stops. "He’s out. He’s sitting down." The next line belongs to the medic.

## Contact channels and who stands where

Contact with a person inside runs only through these channels.

1. A phone, the subject's own, a hostage's, or the team's throw phone.
2. An amplified voice from cover.
3. A negotiator's voice through a barrier, only from a covered position.

Patrol hands contact to the negotiator when the team arrives and holds the
outer perimeter. Pre-call-out door contact by patrol may appear only in the
dispatch and fact claims, framed as the first knock ("At the first knock, he
told patrol to leave"). From stage 1 on, every observation inside the
perimeter belongs to the team ({lead}, "the team on the stairs", "the officers
at his door") or to the negotiator on the phone. Patrol never calls the
subject's name, never watches through the window and is never asked a
question by the subject. The checker blocks "patrol hears", "patrol sees",
"asks patrol" and kin outside the card and briefing surfaces.

The negotiator never leaves cover to escort or receive a subject. The team
does that. Medics and negotiators carry no message or object from the
subject. "He asks a medic to post his daughter’s letter" becomes "He leaves
the letter on the counter for his daughter."

A sensory claim names a sense the speaker could have from where they stand.
Officers in a corridor hear footsteps through a wall. They cannot know the
path ("from the window to the door"). Write "Footsteps, back and forth, on the
other side of his door."

### The contact device

The design sheet names the contact device once with its properties (his own
cell, a landline, the team's throw phone). If it does not, name it at the top
of the strings file and send a note to swat-call-design. Every line that
touches the line matches those properties.

- A cell is hung up, switched off, left ringing or goes to voicemail. It has
  no cord.
- A landline or throw phone is unplugged, pulled from the wall or left off
  the hook.

Before "The negotiator rings his cell. Nate yanked the cord." After "The
negotiator rings his cell. Nate switched it off after two rings."

For every action line, name who does it and where they stand. If that role
could not physically do it from that position, rewrite the line or give it to
the role that could. Patrol at the tape cannot check a weapon held inside.
Once the team is on scene, it places its own observers, so "Ask patrol what
they can see" becomes "Put {lead} on the side window".

## Negotiators

The negotiator earns influence by listening before offering any way out. Write
the moves in this order across a call. Paraphrase, mirror, label, pause, then
an open question. The negotiator never argues, lectures, gives an ultimatum or
promises anything command has not approved. Not promising also buys time.

1. Paraphrase. Before "Calm down and come out. This won’t end well for you."
   After "You’ve been up since Tuesday and nobody’s called you back."
2. Mirror. The subject says “Nobody listens to me.” Before "Why would you say
   that?" After "Nobody listens?"
3. Label. Before "I understand exactly how you feel." After "Sounds like
   you’re worn out with being told to wait."
4. Open question, no promise. Before "Come out and I promise nobody gets
   charged." After "What would you need to see before you open the door?"

The negotiator gathers from family and bystanders but never relays one
person's claim about another to the subject, and shares nothing command has
not approved. A line where the negotiator passes on "her son says he had the
till keys" endangers the son and settles an allegation from hearsay. Write the
negotiator hearing it and keeping it, and send the structure to
swat-call-design if the path depends on relaying it.

Compliance is shown, never announced. Before "Nobody promises him anything."
After "He asks for the letter by 6. The negotiator lets the line go quiet."

## Genre stock lines

Banned in any spoken text, officer or civilian, because every cop show has
said them. The vendored checker flags them.

I’m not going anywhere. Let me do the talking. I’ve got this. Talk to me.
Nobody has to get hurt. Stay with me. We’re going in. It’s over. Stand down.
Cover me. On my mark. Let’s go to work. You don’t want to do this. Just put
it down.

A spoken line carries a fact only this call has, a name, an object, a time or
something the person said. Before "Let me do the talking." After "He answered
me twice at Larkin Court. Let me keep the line." Before "I’m not going
anywhere. Go ahead." After "I’m on the stairs by your door. Tell me about
the dog."

A pause is a direction, never a line of text. Write it into the result. "She
lets the line go quiet. After a while he starts talking about the dog."

## Team humor

Gallows humor stays inside the team and lands on the team. It never touches
the person being helped, the person in crisis or anyone hurt. It has to be
exact to be funny, and it never happens while someone is in danger.

1. Before "Guess grandpa really wanted that last biscuit." After "Ten years on
   the team and Pruitt still can’t fold a stretcher."
2. Before "“Knock knock,” Vance says with a grin at the door." After "Vance
   knocks twice and says his name."
3. Before "Another day, another crazy." After "Somebody owes the bakery for
   those rolls."

## Officer voice markers

swat-officer-stories defines three markers per officer and publishes them in
its profile-patterns reference. This skill only applies them. The three are
sentence length, what the officer notices first and one verbal habit.

How a marker set shapes a line, with one illustrative set (medium length,
notices exits first, counts out loud). The marker values come from that
skill's spec, where short means 2 to 5 words a call and medium 6 to 10.

| Stress band | Line |
|---|---|
| Ready | "Two exits, both shut. Counting three in the hall." |
| Strained | "Two exits. Three in the hall." |
| Overloaded | "Two exits." |
| After gaining steady | "Hall’s clear. Two exits." |

A second illustrative set (medium length, notices faces first, ends on a
question). Ready "Man by the van keeps checking. Who’s he waiting on?"
Strained "Man by the van. Waiting on who?"

Rules for applying markers.

1. A strained officer's lines get shorter. Never narrate the strain.
2. A trait change shows in the voice on the next call, not in a sentence about
   the officer.
3. With no markers on file, the line stays neutral. Never invent a habit.
4. Two officers can disagree like two professionals giving command different
   clocks. "Negotiator wants twenty more minutes." "Smoke’s getting thicker
   on two."
5. Today the only officer token in call text is {lead}, inside an action
   summary. Marker-driven officer lines are design only until engineering
   adds a field, and the prose record says so.

## Checking spoken lines

1. Read every line aloud at speaking pace. If you run out of breath, cut.
2. Read each speaker's lines in a row to hear drift, then read the scene in
   order.
3. Count words against the radio and speech targets.
4. Run the lane lists over quotes as well as narration.
5. For every action line, say who does it and where they stand, and check a
   person in that role could do it from there.
6. Record kept-on-purpose fragments (a caller's repeated fear) in the Tells
   checked line, because the checker may flag them.
