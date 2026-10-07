# Cliche and copaganda detectors

The detector form of the ethics rules and the game's most common tells. Each pattern has an id
for findings (`rule C2`, `rule G1`), what it looks like in a field, how to catch it, a before and
after, and the rule it breaks. The ethics rules are numbered in
../swat-call-design/references/ethics-and-authenticity.md. Cite that rule's E number when the
file is present, and the inline minimum number from review-rubric.md section 5 when it is missing. On
2026-10-06 the two numberings matched (inline 2 is E2), and C1 to C10 here were the detector
form of P1 to P10 in the rulebook's copaganda table, in the same order.

Before lines tagged (repo) were read in the repo on 2026-10-06 with the file named. Every other
before and after is illustrative. Never copy an after line into data. It shows the move, and the
owning skill writes the real line for the real call.

A regex finds candidates and never a verdict. Read every hit in its field. Patterns marked "read
only" have no reliable text signal, so the reviewer walks them by hand on every call.

## Pattern runner

Save as pattern_scan.py and run `python3 pattern_scan.py batch.md` on an export in the format
from batch-audit.md. It prints pattern ids, the call, the field and the start of the string.

```python
import re, sys

APOS = "[" + chr(0x2019) + "']"
PATTERNS = {
    "C1": r"\b(ignor|overrid|skip|bypass)\w* (the )?(command|commander|orders?|negotiator|review|warrant)\b|\bgo(es)? rogue\b|\bbreak\w* the rules\b",
    "C2": r"\b(clean|textbook|flawless|surgical) (entry|takedown|operation)\b|\bin (seconds|moments)\b|\bnever saw (it|us|them) coming\b",
    "C4": r"\b(pool of|soak\w*|spatter\w*|gaping|mangled|gruesome|grisly)\b",
    "C5": r"\b(bad|rough|dangerous|sketchy|notorious|high.crime|crime.ridden) (neighborhood|area|part of town|block|street)\b|\bthe projects\b",
    "C6": r"\b(psycho\w*|crazed|unhinged|deranged|lunatic|maniac|snapped|mental case|a schizophrenic|suicide by cop|jumper|committed suicide)\b",
    "C7": r"\b(justice (is|was) (done|served)|case closed|back to normal|all is well|safe and sound|full recovery)\b",
    "C8": r"\b(state.of.the.art|military.grade|high.powered|top.of.the.line) (gear|rifles?|weapons?|kit|vehicles?|armor|equipment)\b",
    "C11": r"\b(held (their |its )?fire|nobody fired|no shots?( were)? fired|without (a shot|firing)|hands up)\b",
    "C10": r"\b(red tape|paperwork|bureaucra\w*|desk jockey\w*|the suits|pencil.push\w*)\b",
    "G1": r"\b(disputed point|agreed (next )?step|recorded need|assigned|qualified|verified|participating|serviceable|actually connected)\b",
    "G2": r"^.{0,160}\b(doesn" + APOS + r"?t|does not|isn" + APOS + r"?t|is not) (mean|prove|confirm)\b",
    "G4": r"\b(sometimes the|the bravest|what matters|the real (hero|lesson)|reminds? us|proved? (that|stronger))\b",
    "G5": r"\b(tango\w*|hostiles?|neutrali[sz]\w*|enem(y|ies)|kill zone|breach and clear|take (him|her|them) out)\b",
    "G6": r"\bhostages?\b",
    "G7": r"^(play it safe|take a (calculated )?risk|trust your (gut|instincts)|go in hot|be bold|be careful|stay cautious|act fast)$",
    "G8": r"\b(feels?|felt) (uneasy|nervous|afraid|scared|angry|anxious|determined|relieved)\b|\bis (nervous|uneasy|afraid|scared|anxious) (about|of)\b",
    "G10": r"\b(every (minute|second) counts|time is running out|no time to lose|eerie|eerily|palpable|barely above a whisper|the weight of|a sense of)\b",
    "G11": r"\b(released|in custody|booked|bail|to the (car|cruiser)|in the cruiser|in cuffs|cuffed|taken in|held overnight|charged|faces charges|convicted|out of danger|recovering)\b",
    "G12": r"^\(.*\)$|^\[.*\]$|\b(placeholder|TBD|TODO|replaced by|compiler.style|lorem)\b",
    "G14": r"\b(voice (breaks|broke|shakes|shook|cracks|cracked)|thanks for trying|done with (all of )?it|impasse)\b|\bThen (nothing|silence)\.",
    "G15": r"(?:^|(?<=[.!?] ))((Out|In|Inside|Down|Up|Back|Off|Away) (comes|goes|walks|steps|runs|falls|drops)\b|(Out|Gone|Gone inside)\.|([A-Z][a-z]+|The [a-z]+)( [a-z]+){0,4}, ([A-Z][a-z]+|the [a-z]+) (says|sets|walks|keeps|is|stays|tells|goes|comes|puts|sits|stands|waits)\b)",
    "G16": r"\b(point(s|ed)?|level(s|ed)?|aim(s|ed)?|holding|rais(es|ed)|set(s)?|drop(s|ped)?) it\b|(?:^|(?<=[.!?] ))It (stays|is pointed|doesn" + APOS + r"?t)\b",
    "G13": r"\b(i" + APOS + r"?m not going anywhere|let me do the talking|talk to me|nobody (has|needs) to get hurt|stay with me|i" + APOS + r"?ve got (your|you)|we" + APOS + r"?re going to get you out|hang in there|it" + APOS + r"?s going to be (okay|ok|alright)|cover me|go,? go,? go|on my (mark|go)|we do this by the book|not on my watch|we" + APOS + r"?ve got this)\b",
}
HEDGE = re.compile(r"\b(doesn" + APOS + r"?t prove|may or may not|might|could be|possibly|not necessarily|it is unclear)\b", re.I)
COMPILED = {k: re.compile(v, 0 if k == "G15" else re.I) for k, v in PATTERNS.items()}

meta = ""
for para in open(sys.argv[1], encoding="utf-8").read().split("\n\n"):
    para = para.strip()
    if para.startswith("## call "):
        meta = para[8:]
        continue
    if " | " not in para:
        continue
    field, text = para.split(" | ", 1)
    hits = [k for k, rx in COMPILED.items() if rx.search(text)]
    if len(HEDGE.findall(text)) >= 2:
        hits.append("G3")
    if hits:
        print(f"{' '.join(hits)} | {meta.split(' seed=')[0]} | {field} | {text[:90]}")
```

## Copaganda patterns

These come from screen-craft research and the Color of Change study of crime television. They
describe what fiction about police tends to normalize. Each one is a red line or close to it.

**C1. The rule-breaker rewarded.** Looks like an option that skips command, a review or a
warrant and lands favorable with no cost. Caught by the runner on defy-command wording, but the
real test is structural, so read every option that moves without approval. Before (illustrative)
"Ignore command and go in. Favorable, Eli is out and nobody asks." After "Ask command to approve
entry now. Faster than the negotiator, and if command says no, the minute is gone." Rule inline
10 and inline 2.

**C2. Clean force.** Looks like force that is fast, neat and free. Runner catches "textbook
entry", "in seconds", "never saw it coming". Before (illustrative) "The team clears the room in
seconds. Nobody gets hurt." After "The door gives on the third try. Sam is on the kitchen floor
and the neighbor’s window is broken." Rule inline 2 and inline 6. Never reach for a surrender
pose ("came out with his hands up") as the after. It frames a person in crisis as a suspect.

**C3. Quips at gunpoint.** Looks like wordplay or a one-liner spoken while a weapon is present.
Read only. Read every line spoken in an armed stage aloud. People under a gun speak short and
plain. Before (illustrative) "Looks like your evening just got cancelled." After "Put it on the
floor. Step back to the wall." Rule inline 2.

**C4. Gore as stakes.** Looks like wounds, fluids or bodies carrying the tension. Runner adds
gore words to the typed lint's unsafe list, which is in `UNSAFE_DETAIL` in prose-lint.ts. Before
(illustrative) "It soaks the carpet where he fell." After "The medic kneels by him and asks his
name. He answers." Rule inline 7.

**C5. The dangerous neighborhood.** Looks like a place, block or building type standing in for
threat. Runner catches "rough block" and similar. Before (illustrative) "Units avoid this rough
block after dark." After "The streetlight on Pine has been out a month. The caller can’t see her
own porch." Rule inline 3. Tally settings in the batch skew table too.

**C6. Crisis as menace.** Looks like a person in crisis written as a villain, or a diagnosis as
the explanation. Runner catches stigmatizing labels. Before (illustrative) "An unhinged man has
barricaded himself in." After "Dev Arora hasn’t slept in three days. He has locked the bathroom
and talks to his brother through the door." Rule inline 3 and inline 4. A line naming a
condition also goes to a human reviewer.

**C7. Neat closure.** Looks like an ending that settles everything, promises recovery or
announces justice. Runner catches "case closed", "safe and sound", "justice was served". Before
(illustrative) "Case closed. The family is safe and sound." After "Mara is at her sister’s
tonight. The protective order hearing is Thursday." Rule H2, H4 and the open-loop rule.

**C8. Hardware worship.** Looks like gear praised for power. Runner catches "military-grade" and
similar. Before (illustrative) "The team rolls up with high-powered rifles ready." After "The
shield lets Okafor stay in the doorway long enough to talk." Describe gear by what it lets the
team avoid. Rule inline 2.

**C9. The deadline as license.** Looks like a clock that makes a red line acceptable. Read only.
Read every option beside a stage prompt that names a clock. Before (illustrative) "No time for
the negotiator. Force the door and make him talk." After "The negotiator is four minutes out.
Hold the door, or go in now and lose the chance to talk." Rule inline 2 and inline 10.

**C10. Oversight as obstacle.** Looks like command, negotiators, medics or reviewers written as
friction. Runner catches "red tape" and "paperwork". Before (illustrative) "Command’s red tape
is slowing everything down." After "Command wants to know who else is inside before approving
entry. Nobody has asked the neighbor." Rule inline 10.

**C11. Restraint as headline.** Looks like an ending title, result or summary built on what the
team did not do, or a surrender pose. Runner catches "held fire", "nobody fired", "without
firing", "hands up". Before (proof draft, 2026-10-07) an ending titled "Nobody fired" and the
result "The team held fire and backed out." After "He put it down and pushed it away with his
foot." Show what the subject did. Never title an ending after what the team didn't do, because
that narrates compliance and puts the team at the center of a stranger's worst night. Rule
inline 2, and swat-call-prose's ban on lines whose only job is to show the team complied.

## Game-specific patterns

These are the tells this game's own text falls into, most found in shipped lines.

**G1. Process narration.** Looks like engine or form words in a prompt, summary or result.
Runner catches "disputed point", "agreed step", "qualified", "verified", "assigned". Before
(repo, compiler stage prompt in src/gen/incident/frameworks-v9.ts) "Check the disputed point in
person." After "Taylor holds out a phone with the resident’s number on it. The neighbor wants
Taylor out first." Rule G1. Compiler-owned lines route to engineering for an override field.

**G2. A disclaimer as the hook.** Looks like a card that says what the call does not prove.
Runner catches "doesn’t mean" and "doesn’t prove" near the start. Before (repo, burglary opening
in src/content/incident-frameworks-v9.ts) "An alarm on its own doesn’t mean someone broke in,
took anything or is still inside." After "Casey Bell, the keyholder, wants to open up and count
the stock. The back door sensor tripped at 9:40 and hasn’t reset." Rule cold read.

**G3. Stacked hedges.** Looks like two or more hedges in one string. Runner flags two hedge
phrases in one string. Before (repo, false_intruder opening) "Having a key doesn’t prove the
visit is welcome, and a neighbor not recognizing someone doesn’t prove it isn’t." After "The
neighbor has never seen Taylor before. Nobody has reached the resident yet." Source once, then
speak plainly.

**G4. The sermon ending.** Looks like a last sentence that states a lesson. Runner catches
"sometimes the", "the bravest", "proved stronger". Before (illustrative) "In the end, listening
proved stronger than force." After "Two hours on the stairs. Ana came down carrying her coat and
the cat." Rule G4 and peak-end, since the last line is the one remembered.

**G5. War vocabulary.** Looks like military slang for people or places. Runner catches "tango",
"hostiles", "neutralize". It does not flag "breach" alone, which is a role name. Before
(illustrative) "Tango in the kitchen. Neutralize on sight." After "One man in the kitchen. Hands
empty. Holding." Rule inline 2.

**G6. A hostage frame on every barricade.** Looks like "hostage" on a call where nobody is held.
Runner flags every "hostage". Keep the hits outside hostage_crisis calls and read whether anyone
is held. Before (illustrative) "Hostage situation at 12 Elm." After "One man alone at 12 Elm. He
says he will talk to his sister." Most crisis calls involve no hostage.

**G7. Mood-label choices.** Looks like a choice title with an attitude and no action. Runner
catches the stock labels, and any title without a verb is a hit by reading. Before
(illustrative) "Play it safe" beside "Take a calculated risk". After "Ask the super for the
master key" beside "Force the back door now". Rule fake-choice 4 and fake-choice 8.

**G8. An officer narrated as feeling.** Looks like a sentence telling the player what an officer
feels. Runner catches "is nervous about" and "feels uneasy". Before (illustrative) "Okafor is
nervous about the stairwell." After "Okafor asks for the stairwell light before she moves." Show
the behavior, and let the officer's voice markers carry it.

**G9. The dash and colon habit.** Looks like an em dash, an en dash, a spaced hyphen or a colon
joining clauses in game text. batch_counts.py catches all four by code point. Before (repo,
false_intruder act-on-report wrong text in src/content/framework-depth-v12.ts) "The resident
calls back: the key was for another day." After "The resident calls back. The key was for
another day."

**G10. Stock urgency and mood words.** Looks like urgency stated instead of shown. Runner catches
a short list. The full stock phrase list belongs to ../swat-call-prose/references/string-checks.md.
Before (repo, src/content/scenarios/ms-urgent.ts) "The caller says kitchen. Every minute counts."
After "The caller says kitchen. He stopped answering her two minutes ago."

**G11. Implied custody or recovery.** Looks like an outcome the step never produced, said
sideways. Runner catches "released", "in custody", "to the car", "bail", "recovering". A hit is
fine when negated or when the call shows the step that caused it. Before (proof draft,
2026-10-06) "Patrol walks him to the car." After "Lewis sits on the curb with patrol. Mara is in
the ambulance with the doors open." Rule H1, H2. A call that needs a custody ending goes to the
owner.

**G12. Placeholder text.** Looks like a note about a string sitting where the string should be.
Runner catches text wrapped in parentheses or brackets and words like "placeholder", "TBD",
"replaced by". Before (proof draft, 2026-10-06) "(compiler-style late text replaced by the
summary's cost)". Every hit is a block, and a record that called the set complete is a second
finding.

**G13. Genre stock lines.** Looks like dialogue every TV negotiator and team lead has said.
Runner catches a short list. Before (proof draft officer sheet, 2026-10-06) "Okay. I'm not going
anywhere. Go ahead." After a line built from the officer's own voice markers and the scene's
facts, such as "Dev, it's Okafor from the stairs last Tuesday. Is the radiator still banging?"
(illustrative).
The canonical stock list belongs to ../swat-call-prose/references/string-checks.md, whose STOCK
list held no spoken lines on 2026-10-06. Until it does, this pattern stands in, and the review
files a consistency note asking swat-call-prose to own the spoken list.

**G14. Melodrama beats.** Looks like the stock emotional moment from a hundred crime dramas, or a
jargon word standing in for drama. Runner catches "voice breaks", "thanks for trying", "done with
all of it", "Then nothing.", "impasse". Before (proof draft, 2026-10-07) "Mara’s voice breaks."
After what she says or stops saying ("Mara stops reading at the second line."). Before "Thanks
for trying, Lewis tells the negotiator. Then nothing." After a concrete act ("Lewis sets the
phone face down on the counter."). Before "Command calls it an impasse." After the fact behind
it ("Lewis has not answered in twenty minutes."). Phrases that carry a suicide risk ("done with
all of it") also go through the crisis rules in E4, never as a beat for effect.

**G15. Inverted and fronted syntax.** Looks like a sentence turned around to avoid opening on a
name. Locative inversions ("Out comes Ben", "Down goes Lewis", "Inside goes the phone"),
fragments ("Gone inside.", "Out."), and fronted modifiers ("Short with you, Lewis sets a new
limit", "Unhurt, Lewis is outside"). Runner catches the common shapes. Before (proof draft,
2026-10-07) "Folded in his pocket, Lewis keeps it while patrol stays with him." which dangles,
since Lewis is not folded. After "Lewis keeps the page folded in his pocket. Patrol stays with
him." Read in sequence across one call, this is the loudest machine tell in a file, and more than
two on one path is fix before freeze. The cause is usually an over-used opener count fixed the
wrong way. Fix a name-heavy opener count by giving another person or object the sentence (the
negotiator, the phone, the door), never by inverting the clause. A plain subject, verb, object
sentence that starts with a name is normal English.

**G16. The orphaned it.** Looks like a weapon or threat carried by "it" with no antecedent in
the same string, or with the wrong one. Runner flags "point it", "level it", "holding it", "It
stays" as candidates, and the reviewer reads each one for its antecedent. Before (proof draft,
2026-10-07) "Pick up the pen, Lewis tells Mara. From the window, patrol sees him point it at
her." which makes the pen the threat. After "Pick up the pen, Lewis tells Mara. From the window,
patrol sees him point the gun at her." Name the object in every string that shows it, since a
card is read alone in seconds and a misread threat is a meaning failure, not a style one. A
string that uses "it" for a second object (the less-lethal round) in the same call is the same
finding.

## The target, from the repo

Two hand-authored lines show the register every pattern above falls short of. Both were read in
src/gen/incident/stories-v5 on 2026-10-06. "Ben told the dispatcher" followed by his own words,
"I only needed one signature." And "The gunfire stops. Eli does not come out." Each names what a
person on scene could hear or see, carries no adjective doing the work, and leaves one question.

## Sources and caveats

- Color of Change, Normalizing Injustice (2020), for C1, C2, C5 and C10. An advocacy
  organization's content study. Its figures are counts from the episodes it sampled.
- Dick Wolf, NPR interview (2003), for C3 and C4. One producer's account.
- Steven Bochco, NPR interview (1989), and Jed Mercurio, Den of Geek interview, for C7.
- Aaron Rahsaan Thomas, Inlander article, for C8. Reported speech in a news piece.
- Mindframe guidelines (Everymind, 2020) and Samaritans drama guidance, for C6 and the crisis rules.
- CISA SAFECOM plain language guide, for G5 and radio wording.
- Kahneman and colleagues (1993) on peak and end, for G4.

Full citations with URLs are in sources.md. They were opened by the research pass for this skill
set on 2026-10-06 and are listed there with what each one supports.
