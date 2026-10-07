# Vocabulary and the lint

Which words to use, which to avoid, and how to keep tension inside the word
lists the typed-package lint enforces. The live lists are in
src/gen/incident/gates/prose-lint.ts (search UNSAFE_DETAIL, ACCUSATION,
SETTLED, META_PHRASING, EXTRA_BRITISH) and the plain-language bans are in
plain-language-v3.test.ts (search "qualified"). Read them before a session of
writing. When this file and the code disagree, the code wins. These notes were
read on 2026-10-06.

## Use

| Word | Plain meaning | Where it fits |
|---|---|---|
| call-out | the team is summoned to a live incident | dispatch reason, debrief |
| barricade, shut in | a person has closed themselves in and won't come out | hook, briefing |
| subject, person in crisis | someone at the center of a call with no crime alleged | design notes, while game text uses their name once known |
| command post | where command, negotiators and medics work, set back from the scene | briefing, radio |
| incident commander, command | the one person who approves any move that isn't an emergency | prompts, results |
| negotiator | the officer on the phone or at the door | prompts, dialogue |
| primary, secondary, scribe | the negotiator who talks, the one passing notes, the one logging | results, debrief |
| impasse | talking has stopped working | stage prompt, sparingly |
| patrol | the officers holding the scene before and around the team | anywhere |
| medics, the EMS crew | the ambulance team who take over care, never "his medical crew" | results, endings |
| key holder | the person with keys and the right to open the building | anywhere |
| tape | the line holding onlookers back, a place only ("at the tape", "behind the tape") | prompts, results. Never the subject of see, film, watch or hear. Name the people, "the neighbors at the tape", "a man filming" |

## Avoid

| Avoid | Why | Write instead |
|---|---|---|
| ten-codes and invented codes | meanings differ by agency | plain words for what, where, who |
| tango, neutralize, hostiles, breach and clear, take down | war vocabulary that glamorizes force | the act and its result, "he’s sitting down, hands empty" |
| perp, psycho, crazed, unhinged, deranged, lunatic, "a schizophrenic" | stigmatizing | the person's name, and behavior you can see |
| committed suicide, successful or failed attempt, jumper, cry for help | stigmatizing | what the person says or does, inside the crisis rules |
| "suicide by cop" as a label | turns a person into a category | what the person says to the team |
| snapped, crime of passion | hides an abuser's choices | the pattern, "third call from this address since June" |
| hostage situation, for every barricade | most crisis calls have no hostage | "has shut himself in", "won’t let his sister leave" |
| eerie, palpable, tension, ominous, a sense of | mood in place of evidence | the observable thing |
| every minute counts, time is running out | stock urgency | the near consequence for a named person |
| brave, heroic, by the book, selfless | virtue words | what the officer did |
| suspect, for someone with no alleged crime | prejudges | the name, or "the man in 4B" |
| arrested, charged, confessed, recovered, diagnosed, when the step did not do it | invented outcomes | what the team did and what is still open |
| apparently, of course, naturally, somehow, seemingly, it seems | narrator hedges that give the narrator an attitude | report it as fact, or as a named person's words ("Nate said Moose sleeps on his boots") |
| off the board, costs time, takes longer, extra minutes | a mechanic said as a mechanic | who waits or what does not happen ("Nobody from this squad takes another call until Alex decides") |
| dead air, ring after ring, then nothing, sat in the truck a long time | stock thriller beats | the specific sound or act this call has |

## The lane word lists

| List | What it catches | Applies where | How to keep the tension |
|---|---|---|---|
| UNSAFE_DETAIL | injury, weapon, death, restraint and medical procedure words | every typed-lane field, before and after the check | write the decision and its cost, see the table below |
| ACCUSATION | theft, break-in, burglar, assault, threaten, suspect, intruder, trespass and kin | any pre-check sentence without a hedge or a negation | put the source in the same sentence, "the neighbor says", "reported" |
| SETTLED | arrest, charged with, convicted, guilty, caught the | anywhere, unless negated | "Nobody is arrested." or say who takes over |
| META_PHRASING | this scenario, the player, fictional, is claimed, in-game | everywhere | stay in the world and say what happened |
| AMERICAN_ENGLISH and EXTRA_BRITISH | mum, whilst, queue, torch, rang, pavement, car park, flatmate | everywhere | mom, while, line, flashlight, called, sidewalk, parking lot, roommate |
| Plain-language bans | qualified, accompanied, verified, context-gated, checked account, follow-through, resolution plan, explicitly, context | titles, summaries and stage prompts | say what the person did |

The plain-language test runs on the welfare, medical and barricade calls only.
Treat it as house style everywhere anyway.

## American word choice

The game is set in the US. AMERICAN_ENGLISH lists spellings, so a correctly
spelled British word passes it. The vendored checker flags these words.

| British | American |
|---|---|
| garden, front garden, back garden | yard, front yard, backyard |
| key safe | lockbox |
| rear lane, back lane | alley |
| letterbox | mail slot |
| teatime, since teatime | dinner, since dinner |
| ambulance crew | medics, the EMS crew |
| carry chair | stair chair |
| mum | mom |
| flat (a home) | apartment |
| pavement | sidewalk |
| car park | parking lot |
| lorry, torch, queue, whilst, rang | truck, flashlight, line, while, called |
| patrol at curb | patrol at the curb |

## Words that never reach a player surface

Four kinds of working vocabulary leak into game text. All are banned on every
player surface.

| Kind | Words | Swap |
|---|---|---|
| Engine terms | step, steps, strain note, note clears, leaning, progress, tempo, band, the check, roll, odds | the condition itself. "More strain on forced-entry steps" becomes "Slower through doors lately". "Strain note cleared" becomes what the officer now does |
| Design-sheet terms | her say, his say, own say, consent, rapport, agency, autonomy, the value, the dilemma, the turn | the act. "Left on her own say" becomes "She held the door for the medic herself" |
| Emotion adjectives in results and endings | furious, frantic, frightened, terrified, upset, relieved | a behavior. "She is furious" becomes "She hangs up on him twice" |
| Policy voice | nobody promises, not a finding, is in the record, approves on, per policy | the scene. "Nobody promises him anything" becomes "He asks for the letter. The negotiator says no." |

## Marker words

Markers name the claim while reported and the checked fact after, in neutral
words. Never a cast name (LUCIA? fails, ARMED? passes) and never a judgment of
motive or character. Avoid GRUDGE, REVENGE, LIAR, CRAZY, ANGRY, UNSTABLE,
DANGER. Write NO JOB or NO DEMAND instead.

## Clock times

A clock time is written one way in narration across a call. Pick "6" or "six
o’clock", record the choice, and use it in every label, prompt and result.
Speech may say "That’s six" inside quotation marks. Never write an absolute
time ("arrives at 2:10") in a call with no fixed start time. Say the
interval instead.

## Lint-safe ways to say hard things

| Banned family | Write instead |
|---|---|
| gun, firearm, pistol, rifle, shotgun, ammunition, bullet | "armed", "a weapon", "something in his right hand", "patrol says there may be a weapon" |
| knife, knives, blade | same as above |
| shoot, shot dead, kill | the sound and its stop, "a bang from the back, then nothing" |
| blood, bleed, wound, wounded, gore | "hurt", "injured", "can’t stand on that leg", "the medic wants a crew now" |
| unconscious, not breathing, CPR, chest compressions, defibrillator | "not responding", "the medic starts working on him", "the crew takes over" |
| restrain, handcuff, taser, baton, pepper spray, chokehold | "patrol takes over", "he leaves with patrol" |
| suicide, overdose | what the person says, "says she doesn’t want to be alive", and the medic's need, never a method |
| fracture, broken bone, concussion | "can’t put weight on it", "asks the same question twice" |
| dosage, milligrams, tourniquet | never, in any lane |

When a lane-safe generic noun such as "weapon" must recur, use it at most
twice on any one path. Carry the threat through position and action, "his
hand comes up", "he points at Mara", "the case from the closet is on the
counter now". "Weapon" is a radio and briefing word. A civilian never says
it, so a reported claim keeps the person's framing or talks around the object
(see dialogue-and-radio.md).

### The object needs a name, never a bare "it"

Each string is read alone on a card, often after the player skipped the
field that named the object. So a lint-blocked noun is replaced by a
lane-safe noun phrase, never by a pronoun.

1. Give the object a physical name the civilian would use, and repeat that
   name. "Their dad’s old hunting piece", "the long case from the closet",
   "what he took off the wall", "what he’s holding", "the thing in his right
   hand". In briefing and radio only, "the weapon".
2. A pronoun for the object needs its noun earlier in the same string. An
   antecedent in another field does not count.
3. At most two "it" references to the object per path, each inside a string
   that names it first.
4. In any string that sets or cues a threat flag, the object is a noun
   phrase, never a pronoun. "From the window, patrol sees him point it at her"
   after "Pick up the pen" makes the pen the threat. The checker blocks
   "point it", "aim it", "raise it", "level it".
5. Never let "it" follow another object noun in the same string. The
   less-lethal round, the phone and the weapon never share a pronoun in
   adjacent strings.
6. If an owner decision (O1) removes the only naming line, rewrite every
   string that leaned on it in the same pass.
7. The object has one location per situation. Read it from the design
   sheet's location row, or list it at the top of the strings file and send a
   note to swat-call-design if the sheet has none. Check every result against
   it. "Across the room" in one string and "in the closet" in the same
   situation is a continuity fault.

Before "It was across his knees, and he did not lift it." After "The long
case was open across his knees, and he did not lift what was in it."

## Reporting lint results

For every flagged word, report the regex result verbatim, "matches
UNSAFE_DETAIL" or "matches none", and name the lane the lint covers (typed
packages only, as of 2026-10-06). For a hand-authored hit, also name the lane
that would start enforcing it if the lint is extended (the hand-authored
lane), and write the lint-safe fallback beside it, so the owner can choose
either without another writing pass. A word outside every regex is an owner
policy question, not a lint collision, and the record says which.

The UNSAFE_DETAIL source comment allows "weapon" only in a negative report.
Treat every affirmative weapon mention ("patrol saw a weapon in his hand") as
an owner decision even though the regex passes it. The same holds for subject
death lines ("may die", "died at the scene") under E7 and E9. If the call
needs the lint extended to the hand-authored lane, mark each string that
would fail under it. All of these go on the record's Lint policy collisions
line, which never blocks handoff on its own.

## Gaps are not licenses

The weapon pattern matches whole words, so compound words such as "handgun"
and "gunfire" pass it. Hand-authored stories already use both, because the lint
does not run on them. In the typed lane, avoid any word that slips past a
pattern while carrying the banned meaning. In the hand-authored lane, apply
the same lists by hand and flag every exception to the owner in the prose
record. A lint that misses a word is a finding for engineering, never a way
around the rule.

## Open owner decisions

Two questions belong to the owner, so a writer flags them and never settles
them alone.

1. Whether armed and hand-authored calls may use plain clinical words the
   typed lint bans ("bleeding from the arm", "not breathing").
2. Where a crisis support line appears, if anywhere. 988 is a US-only line,
   and no surface for it exists today.

## Binding hazards

- The binder swaps the authored full and first name as whole, case-sensitive
  words. A cast first name that is also an ordinary word (Grant, Will, Mark,
  Faith, Hope, Bill) renames any sentence that starts with that word.
- {lead} becomes the lead officer's surname, or "Squad" when there is none.
- Slow-answer pacing appends a sentence to conversation summaries.
- No pool first name may appear outside the cast, so leave dispatchers, patrol
  and neighbors unnamed.
- The eight v9 frameworks use singular they for the person.
- The lint measures every string with the longest drawable names bound in.

## Procedural details, written as decisions

One true procedural detail per stage makes a call feel lived in. Write it as a
choice with a cost, never as a method. No entry sequences, no breaching
techniques, no munitions.

1. The door opens toward the team, so whoever opens it stands in the doorway.
2. One voice holds the phone line. Changing who talks costs the rapport built
   so far.
3. The medic waits out of sight, close enough to reach the door, and is not
   doing anything else while waiting.
4. Command approves every move that isn't an emergency, so going early means
   asking first.
5. The negotiator can't promise anything command hasn't approved.
6. Patrol holds the tape. Moving the crowd back takes officers off the
   perimeter.
7. Neighbors are moved out before anyone talks, which takes time and tells the
   person inside something is happening.
8. The command post is set back, so the commander sees less than the team at
   the door.
9. A second exit gets covered before the first knock.
10. Lights are left as found, because a change tells the person inside
    something.
11. Keeping the caller on the line keeps your best source. Sending them out
    keeps them safe.
12. The key holder is twenty minutes out. The ram is on the truck.

## Ethics minimum when the rulebook is missing

The full rulebook is ../swat-call-design/references/ethics-and-authenticity.md,
owned by swat-call-design, cited by E number. If it is missing, say so in the
record and apply this minimum.

- E1 No manual. The choice and its cost, never a method or munition.
- E2 Force is never the reward. The best ending is everyone walking out.
- E3 Identity never signals danger. Threat comes from behavior.
- E4 Crisis lines carry no method, single cause or release.
- E5 Abuse reads as a pattern of control. Never "snapped".
- E6 Forced entry costs someone, and the line says who.
- E7 No gore. Injury is seen through what the medic does.
- E8 Composites only. No real incident, victim or agency.
- E9 The subject's life counts in every ending line.
- E10 Negotiators, medics, command and review are never obstacles.
