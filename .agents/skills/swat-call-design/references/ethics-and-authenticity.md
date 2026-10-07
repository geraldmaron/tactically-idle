# Ethics and authenticity rulebook

The single rulebook for how Tactically Idle portrays police work, crisis and violence. It is
owned by swat-call-design. swat-call-prose, swat-writing-review and swat-officer-stories cite
its rules by number (E4, E4.5, P3, O2) and never keep their own copies. Each of those skills
carries a ten-line inline minimum, E1 to E10 in this order, so it still works if copied alone.
swat-call-design's screen adds E12.1 to E12.5 as lines 11 to 13, and the other skills should
carry a one-line version of E12.3 (intermediaries) and E12.5 (no force without a threat) beside
their ten.

The house position in one line. Most real tactical work is holding a scene, waiting, talking
and asking permission, so the game writes the clock and the conversation, and the best outcome
is everyone walking out.

Source tags in brackets point to [sources.md](sources.md). Lines marked (house) are design
choices for this game, not findings.

## The ten screen rules

### E1. No manual

Never describe breaching methods, entry sequences, munitions, or ways to defeat police, locks
or alarms. Write the decision and its cost. "Go in now, and he may still be holding it" is a
decision. A list of steps is a manual. Tension comes from medical clocks, deadlines a person
sets and then lets pass, a voice slowing as rapport builds, the urge to act when waiting feels
wrong, and onlookers at the tape [AU1][AU4].

### E2. Force is never the reward

- The best grade goes to the ending where everyone walks out, which is also the usual real
  outcome. LAPD SWAT resolved 92 percent of incidents from 2012 to 2022 without any force
  [AU1].
- Restraint is the big scene. In one observed call a man fired at the team. The team held fire,
  and he surrendered [AU1].
- Force leaves a bill (house). When it happens, the aftermath is told in one plain sentence,
  never choreographed or savored.
- E2.1 Order of the bill (house). When the team's force hurts or kills anyone, the ending
  summary itself, not only an epilogue, states that person's state before any property cost.
  The debrief carries one plain line that the use of force goes to review, with no verdict.
  Shape, for a subject with no self-harm risk. "The man with the bat died at the scene. The
  entry goes to review." When row B marks self-harm risk present, E4.5 overrides this shape.
- E2.2 Every death has weight (house, all calls). Any death that can occur on any path is
  written as its weight on a named person present, in one sentence, and is read by a human
  before freeze.
- E2.3 The clean near-miss (house). When entry meets a weapon in hand, the moment carries its
  real weight. Officers carry strain (an ending's `strain`, or `officerCare`), restraint is
  named as the officers' choice (E14), and no civilian or medic gesture defuses a drawn weapon.
  A favorable grade on an entry that meets a drawn weapon is justified on the sheet.
- Engine tie. `EndingDefinition.trustAdjust` exists so restraint earns trust and needless force
  costs it. Never set it the other way.

### E3. Identity never signals danger

- Draw race, religion, accent, disability, diagnosis, immigration status and neighborhood
  separately from a character's role.
- Threat comes only from behavior, such as a weapon, a threat, or a history with this victim.
- Crime drama casts people of color as perpetrators more than as victims [TV16]. Check variants
  for that skew (swat-writing-review's batch audit).
- The record slot for E3 reads "clear, tally <n seeds, subject-role distribution by culture>" or
  "pending batch tally". A bare "clear" is not allowed until that batch audit has run on the
  subject role for this type, because one bound seed shows nothing about skew.
- One FBI risk list includes cultural background [AU4]. Write that as one person's own words
  and history, never as a group trait.
- Engine tie. Reported characteristics change the work and never a demographic score. They
  never imply danger (comment in `applyRecipeCharacteristic`).

### E4. The crisis rules apply

A crisis call is any call where the subject may harm themselves, judged from the private logic
and from risk signs, never only from words said. Risk signs include no real demand, a grievance
against a known victim, recent loss, shame or public accusation, saying goodbye, and wanting to
be remembered. E4 also applies as a screen whenever weapon access meets a loss event
(bereavement, losing a home, illness, a breakup) and a refusal. Rules E4.1 to E4.6 draw on
[AU8] and [AU9].

- E4.0 The screen. Sheet row B states self-harm risk for every armed or weapon-reaching person.
  If it is present, E4.2 to E4.5 and E4.7 apply, along with E12.5, and any path where force
  can kill the subject is read as possible suicide by cop. Never reward that path, and never make it the
  only end of a branch. Marking E4 not applicable needs a person-card reason, plus a note on
  whether the negotiator asks the direct question off-card. Asking is standard practice, and a
  call that never asks reads false. The record slot is "applies" or "screened, <reason>",
  never a bare n/a.

- E4.1 No method detail. "Armed" and "hurt himself" are enough. Never name pills, amounts,
  means, where they came from, or an unusual method. Never imply a new act of self-harm between
  beats. If his condition worsens off-screen, the text ties it to the injury already disclosed
  ("The medic says the injury from before is worse.").
- E4.2 Never a release, a reward or a single cause. Death brings no peace, reunion or revenge.
  Give two or three stressors, lightly.
- E4.3 The person is the stake. Name them. Their survival is the win condition.
- E4.4 Show the way out. The best path is the person choosing help, and recovery is shown as
  slow. Leaving is a valid ending when no crime occurred [AU1].
- E4.4a The medical window (house, after common EMS practice). When a reveal confirms harm, a
  context prompt keyed to the reveal flag gives the medic's window in plain words ("The medic
  wants to reach him within the hour."). Choosing help himself earns the best grade only inside
  that window. A path that waits past it carries the delay's cost in its ending summary, as
  what the medic found, and earns no better trust than a timely reach.
- E4.5 Death stays off the card. The worst crisis outcome shown is the medic still working as
  he is carried out ("The crew took him with the medic still working."), never a hospital grade
  such as critical or serious (E11). If a death belongs to a story, E2.2 applies, and the act is
  never shown. This rule overrides E2.1 and E2.2 whenever row B marks self-harm risk present. A
  death the force draw can produce goes to request R10 (engine-map.md), never to a death card.
  The record carries "E4.5 vs E2.1 checked".
- E4.6 Frequency cap. A run of these stories can make it seem normal. Cap crisis calls across
  variants and never put two in one shift (house; no engine field yet).
- E4.7 Point to help. Add a content note, and a support line in crisis-call debriefs. In the US
  that is 988, by call or text, free and always open [AU15]. It is US-only, and no surface
  exists for it yet (O2, R5). Even without a surface, the sheet writes both drafts in row M and
  marks them pending O2 and R5. The content-note line, and the debrief support line ("If this
  call brought something up for you, in the US you can call or text 988. Elsewhere, contact
  local emergency or crisis services."). A crisis call's record is incomplete without both, and
  their absence is fix before freeze, never a note.
- E4.8 Mental illness is not the explanation. About 96 percent of violence is not committed by
  people with severe mental illness [AU10]. Name other factors such as drinking, loss or missed
  treatment. Never diagnose someone because what they did was shocking.
- E4.9 Language. Avoid "committed suicide", "successful" or "failed attempt", "jumper", "cry
  for help", and "suicide by cop" as a label in player text [AU8][AU2]. Show what the person
  says instead.
- E4.10 Inside the lint. The typed lane bans the words suicide and overdose. Write what the
  person said and did ("He told his sister he won’t be here tomorrow"). Use in the
  hand-authored lane is an owner decision (O1).

Most crisis calls involve no hostage. They are driven by emotion, not bargaining, such as
partner disputes, custody fights, intoxication or suicide [AU3]. In older national data, people
at these scenes died by their own hand more than 2.5 times as often as by SWAT gunfire [AU2].
The usual demand is to be left alone [AU3].

### E5. Domestic abuse is a pattern of control

- Show prior calls and a protective order. The victim has a name and a life [AU11].
- Never frame the couple as a romance, and never sexualize anyone.
- Avoid "snapped" and "crime of passion". They hide the abuser's choices [AU11].
- These are among the highest-risk calls, and they read that way. Risk climbs when the victim
  was chosen and is known to the subject, when there is a history of abuse, when threats come
  with no real demand, and when the subject talks about dying or puts affairs in order [AU4].
- Inside the lint. "Abuse" and "threaten" need a source, a hedge or a negation before the
  check. "Her sister says this is the third call this year" carries the history.

### E6. Forced entry costs someone

- A forced door has a cost, and the text says who pays. The child in the next room, the family
  left with the damage, the person whose home it was.
- An ACLU review of 2011 to 2012 deployments found 79 percent were search warrants and 7
  percent hostage, barricade or active-shooter calls. Drug searches involved forced entry 65
  percent of the time, and where officers expected a weapon they found one in 35 percent
  [AU14]. ACLU is an advocacy group.
- E6.1 Entry against a refusal (house, after common EMS and emergency-aid practice). This
  covers a refusal of care and a refusal of entry by a barricaded subject alike. One
  player-facing line says why command judged the move necessary, for example "The medic says
  she can't get up, and the cold is getting worse." Capacity and immediate danger are the
  reasons. Impatience never is. A re-entry after a withdrawal carries its own command line.
  For an armed or barricaded subject, E12.5 decides when the option may be visible at all.
- A repo line that does this well, in the v12 depth layer. "If the leak has stopped, the team
  has entered a home it didn’t need to and has to explain why."

### E7. No gore

Injuries are brief and plain, seen through what the medic does. Stakes come from who is at
risk, never from wounds [TV1]. The typed lane bans clinical words outright (see engine-map.md
section 6). Hand-authored labels such as "Wounded during the urgent response at Market Row"
show the plain register.

### E8. Composites only

Never retell a real incident, victim or agency. Borrow the call type and invent every
particular [TV1]. No real agency names, real addresses or identifiable events.

### E9. The subject's life always counts

Preserving the subject's life counts toward the best outcome, including when they are the
reason everyone is there. Responders go anyway, for people nobody likes [TV14].

### E10. Oversight can be right

Reviewers, negotiators, medics, lawyers and command can be right. A wrongful act triggers
review or a cost. Remorse alone does not count as accountability. In one study of crime drama,
wrongful acts were mostly committed by sympathetic leads and shown as the cost of doing
business, and only 13 of 453 were investigated [TV16]. A deadline speeds a decision and never
excuses abuse.

## Rules the screen points to

### E11. Honest outcomes

- No invented arrest, charge, confession, diagnosis, recovery, returned property, eviction,
  completed handover, kept promise or unnamed superior team.
- A request is not a completion (accountable-response-v4 in the repo docs).
- Allegations carry who says so until someone checks. Arrest words appear only negated.
- Each ending names every person's actual state, and who is still on scene and responsible
  for each person still at risk.
- No handoff to another team, unit or specialist that resolves things off-screen. A live
  medical or armed scene is never handed off or abandoned unless the engine has a service that
  does so. An unresolved ending names who is still waiting and where, and writes the impasse
  as command's decision with its cost. "Command orders the door opened for the medic. Lucia
  never agreed."
- No diagnosis. "In serious condition" and similar grades belong to the hospital, not the
  scene. Say what the medic did or saw.
- E11.1 Surrender is a directed walk-out (house). The team tells the person how to come out,
  hands visible, and the team or patrol takes hold of him before any care. One plain line
  ("He comes out the way {lead} tells him, hands open, and the team has him."). When a crime
  is alleged on scene, no ending implies release, such as sitting on a curb or leaving with the
  medics alone. Until the owner rules on custody (O4), the approved neutral line is "<name> is
  with the team now. What happens next is not this call's to decide." swat-writing-review should
  accept that one line under its implied-custody check. If its copy disagrees, file the drift.

### E12. Real call flow

- Contain, then talk, then resolve [AU1]. Teams stage, deploy and work the problem [AU2].
- The incident commander approves every move that is not an emergency [AU1][AU2]. Commanders do
  not negotiate. The negotiator promises nothing without command, which also buys time [AU6].
- Concessions (house, after [AU6]). Any offer, trade or concession option names command's
  approval in its summary or result ("Command agrees the negotiator can take down his
  account."). It offers only what the team itself can do, writing something down and passing
  it on, and never delivers a third party's process (a board, a court, an employer). A held
  person is never asked to bargain, sign or perform a concession. Proof-of-life contact, and a
  held person speaking for themselves when they choose to, are fine. Row M records who
  approves, what the team can deliver, and that no held person is a party.
- Containment is the default (house, after [AU1][AU2]). After the call-out the perimeter and a
  staged emergency team exist. Having one is never a choice. Dilemmas sit on how close, how
  visible and when to use it ("Move the team up to the back door, where Lewis may hear
  them").
- Moving from talk to rescue needs a life visibly threatened and the commander's approval
  [AU1]. An impasse, when talking has stopped working, is a command decision, never a timer.
- E12.1 Call-out earned. LAPD considers a call-out when four conditions hold together. The
  person is armed or can reach a weapon, there is probable cause of a crime or a stated threat,
  they hold a position of advantage, and they refuse lawful arrest [AU1]. The sheet quotes the
  player-facing line that shows each one. If any is missing from the text, the call belongs to
  patrol, a crisis-trained officer or EMS. Add a sourced threat line, or change the call type.
  Possession plus a refusal of care is not a threat.
- E12.2 Stage back, and keep the geography true (house, after common incident practice).
  Civilian medics stage at the command post or the curb until command calls them forward.
  Nobody (medics, negotiators, evacuating civilians, observers) is placed within reach or line
  of sight of an unresolved weapon report unless the risk is named as a command decision on the
  option that puts them there. Inside the perimeter the only medical presence is the squad's
  own medic. The sheet names the advantage line once (row C) and places every role against it.
  Every later mention of stairs, exits or doors agrees with it. If the subject's door covers the
  only stairs, an evacuation down those stairs walks people through his line of sight, and that
  is the option's stated cost.
- E12.3 No intermediaries, no hearsay as a key (house, after [AU6]). Family and friends at the
  tape are interviewed for information. They are never put on the line and never carry
  messages. The team never tells the subject anything that implicates another person. Anything
  passed to the subject needs command approval, is checked first when it can be, and never
  settles an allegation on scene.
- E12.4 Clocks never create the threat (house). Pressure and deadlines may cost time, rapport
  and civilian condition. They never by themselves create the visible threat that opens force.
  A threat flag is set only by a truth branch tied to the subject's private logic and planted
  earlier, never by `pressureAtLeast` alone. Most deadlines pass, so a hold or a talk past the
  deadline is favorable in most draws.
- E12.5 No force or entry without a visible threat to life (house, after [AU1]). An impasse
  never opens force by itself. An entry, rescue or force option against a subject's refusal is
  visible only under a `Condition` that shows a life visibly threatened. That is a confirmed
  injury, silence after a stated harm, or a threat to a named third party, each set by a truth
  branch whose text shows it. Any flag that makes such an option visible, including a derived
  either-or flag, requires that threat flag. When E4 applies and a situation's truth is
  self-directed, no force option is visible in it. Talk failure there leads to a partial ending
  with named responsibility, or to a medical or containment hold. In every situation where the
  subject is talking and the truth shows no threat to life, the entry option is hidden. The
  summary or the context prompt that unlocks entry names command's reason in one line. No
  player-facing line justifies entry by elapsed time ("too long", "has waited", "out of time").
  Row F lists every force and entry action with its `visibleWhen` per situation and quotes the
  threat line that sets each flag. A situation with no quoted threat line shows force as not
  visible. E4.0 fails whenever an armed crisis subject can be entered on before that.
- In an active-shooter call, patrol now goes in first, because assembling a team takes too long
  [AU1].
- Contact by a trained negotiator or by phone went with negotiated endings, and bullhorn
  contact with tactical ones, in one analysis of FBI data [AU5] (read from a summary).
- Write disagreement as two professionals giving command different clocks (house). One observed
  debrief stayed professional, with no personal criticism [AU1]. At the stage where talk can
  turn to entry, one context prompt sets the negotiator's clock against the medic's ("The
  negotiator wants twenty more minutes. The medic says he can't wait that long.") so the
  player's choice reads as command's.

### E13. Trauma-informed writing

Safety, transparency and choice, with attention to culture, history and gender, shape how
survivors and officers are written [AU12]. Offer the person a choice where the scene allows
one, and say what is happening to them before it happens.

### E14. Restraint never costs character

Holding fire, waiting or talking when everyone lived never produces a negative trait, line or
framing for an officer. Stress may read as honest weight. swat-officer-stories applies this
rule to arcs.

### E15. Register

| Use | Plain meaning |
|---|---|
| call-out | the team is summoned to a live incident [AU1] |
| barricade | an armed person has shut themselves in and won't come out [AU1] |
| subject, person in crisis | no crime alleged; the name once known; "suspect" only for an alleged crime [AU1] |
| command post | where command, negotiators and medics work, set back from the scene [AU1] |
| incident commander | the one person who approves any non-emergency action [AU1][AU2] |
| primary, secondary, scribe | the negotiator who talks, the one passing notes, the one logging [AU1][AU6] |
| impasse | talking has stopped working [AU1] |

| Avoid | Why |
|---|---|
| 10-codes, invented codes | meanings vary by agency; plain language replaces them [AU7] |
| tango down, neutralize, hostiles, breach and clear | war vocabulary that glamorizes force (house) |
| perp, psycho, crazed, unhinged, deranged, lunatic, "a schizophrenic" | stigmatizing; say "a person with" a condition [AU10] |
| snapped, crime of passion | hides the abuser's choices [AU11] |
| "hostage situation" for every barricade | most crisis calls have no hostage [AU3] |

Radio is short plain sentences giving what, where, who and weapon, with the doubt flagged
(house, after [AU7]). Negotiators listen first and show real empathy before offering any way
out [AU3]. In one case officers told a man that medics were there and he wasn't in trouble
[AU1].

## Copaganda patterns as rules

swat-writing-review holds the detector form of these in its cliche-and-copaganda reference.
Each pattern breaks the rule beside it.

| Id | Pattern | Rule |
|---|---|---|
| P1 | The rule-breaker rewarded | E10 |
| P2 | Clean force, shown as rare and harmless [TV16]. Includes the clean near-miss, a drawn weapon at entry defused by a gesture (E2.3) | E2 |
| P3 | Quips at gunpoint. People under threat speak short and plain [TV1] | E2, E15 |
| P4 | Gore as stakes | E7 |
| P5 | The dangerous neighborhood and skewed victims [TV16] | E3 |
| P6 | Crisis as menace | E4 |
| P7 | Neat closure and reassurance [TV2][TV3] | E11 |
| P8 | Hardware worship. Describe equipment by what it lets officers avoid [TV12] | E2 |
| P9 | The deadline as license, in wording or in structure (an effect that sets a danger or threat flag under a `pressureAtLeast` condition) | E10, E12.4 |
| P11 | Hearsay as the key. A path that wins by passing the subject a third party's words that implicate someone | E12.3 |
| P10 | Oversight as obstacle | E10 |

## Open owner decisions

- O1. Clinical words. The typed lint bans plain words such as bleeding and gun, while
  hand-authored stories use "handgun", "gunfire" and "Wounded". Which words the armed and
  hand-authored lanes may use is the owner's call. Until then, flag every such line. The list
  sent to the owner names the exact strings with their field paths, never only the words, and
  separates force and death register lines (titles such as "Go in with weapons up") from
  single words.
- O2. A support line. Where it appears, what it says outside the US, and whether a content note
  precedes crisis calls. No surface exists (R5).
- O3. Whether the newest content version is still open for prose changes.
- O4. Custody. What an ending may say about a person who surrendered after an alleged crime.
  E11.1 holds the neutral line until then.

## Evidence limits

- LAPD's team is large and full-time. In the NIJ survey 88 percent of teams were part-time
  [AU2]. Do not generalize LAPD numbers to every team.
- The NIJ counts come from 1986 to 1998 data with large gaps. Teams then averaged 14.1
  warrants, 3.5 barricades and 0.5 hostage incidents a year [AU2].
- The HOBAS finding [AU5] comes from a university summary. The paper was not opened.
- ACLU [AU14] and Color of Change [TV16] are advocacy sources. Cite them as such.
- 988 [AU15] is US-only.
