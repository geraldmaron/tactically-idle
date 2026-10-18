# Table read protocol

The read, step by step, for one reviewer working alone. Each step names what to write down,
because a read that leaves no notes cannot be checked. Sections 1 to 4 set up the surface.
Sections 5 to 10 are the reading itself. Section 11 covers officer text.

## 1. Set up the rendered read

1. Run `npm run lab`. Open `/lab?type=<type>` on the dev server (docs/scenario-lab.md).
2. The page opens on Play. The Director on the left sets building and seed, situation, turn,
   group size, pacing, tier, squad and kit; the frame in the middle is the game's own screens;
   the X-ray rail on the right holds the hidden truth and each choice's routes. The URL holds
   the whole draw (`type`, `family`, `seed`, `variant`, `pacing`, `tier`, `call`) and the moves
   played (`path`). Write each read's URL into the record so another reader can open the same
   call at the same step. Script (`tab=script`) lists every line in player order.
3. Read situations 1, 2 and 3. If the cast has a deliberate_answers member, read both pacings.
   Read at least two building families, one authored and one generated.
4. Note the squad. The call strip's squad chip reads "Squad A (719)" and the Director lists its
   four officers (on 2026-10-09 Singh, Aung, Vann and Moretti). You need those surnames for the
   name collision check.

## 2. Know what each lab surface does not show

Play's frame is the game's own components at 390 or 430px, so the clamps below show there as in
the game, but it has no campaign bar or bottom navigation, and the game's short-screen rules
follow the lab window, not the frame (a chip warns when they are on). Script shows every line in
a 390px column with the game's text styles, not inside the game's components, so it shows no
clamps, hidden summaries or chips. Check these on Play or in the running game at a 390px viewport, or
approximate them from exported text and say so.
Values come from the engine contract read for this skill set. Re-check them if the UI changed.

| Surface | What hides or cuts text | How to approximate without the game |
| --- | --- | --- |
| Card hook, board and live panel | Live summary clamps to 3 lines at 14px | Count characters. Past about 130, the end is at risk |
| Choice summary, locked | Clamps to 2 lines | Past about 80 characters, the cost may be cut off |
| Choice summary, unlocked | Hidden when it equals the favorable preview | Compare the two strings. If equal, the player sees one, not two |
| Stage label | Uppercase, two-line clamp, three across | About 24 characters before it breaks badly |
| Chips | variantLabel shows only when it differs from the title | Note whether a chip exists at all |
| Map markers | Uppercase, short | 12 characters or fewer, one word, a question mark while reported |
| Decision log | Shows "Title" then the result line in the UI's own format | Read title and result together as one line |
| Debrief | "Told" and "Not reported" lines built from claims | Read each claim as the player's last word on the call |

## 3. Fallback when you cannot render

Say so in one sentence first. Then export the strings for each call in player order, in the
format defined in batch-audit.md under "Export format". Use this order.

1. Card title and card summary.
2. Dispatch reason, known lines, unknown lines, responsibilities and the fact label.
3. For each stage, its label and prompt, then any context prompts.
4. For each option, its title and summary, then the favorable, mixed and adverse previews.
5. Result texts, then endings with their remaining tasks, then debrief lines.

Write the unseen list into the record, choosing from this set. Card clamp, live summary clamp,
locked summary clamp, hidden summaries, stage label clamp, chips, map markers on the plan,
decision log, debrief layout, odds as the player sees them.

## 4. The fresh-reader rule for one agent

If you drafted any of the text, you are not a fresh reader. Declare the self-read in the record
and do three things before anything else.

1. Do other work first, then export the strings to plain text. Do not open the source files.
2. Run the cold read (step 5) on the export before reading any design or prose record.
3. Read the records only after the cold read is written down.

What a self-read cannot do, whatever the care taken.

- Clear the choice pass. Run the choice table anyway, record the block count as "unverified,
  self-read", and hold the verdict at edit until a second reader or a played build confirms it.
  A proof round on 2026-10-06 signed off a dominant option and an ordering stage as "clear" on a
  self-read.
- Downgrade a measured count. A count over a batch-audit threshold stays fix before ship. The
  author's reason for keeping it goes in the row for the second reader to judge.
- Self-certify ethics. Every ethics and officer-ethics "yes" carries a quoted line as evidence.

The owner reads the first few self-read records personally. Write them expecting that.

## 5. Timed cold read

1. Show only the card. Count three seconds at speaking pace. Look away.
2. Show the briefing. Count ten seconds. Look away.
3. Fill the cold read block from SKILL.md section 3 without looking back.
4. Then look back and note what you missed. Something you missed twice across calls is a
   pattern finding for the batch.

A blank is data. Do not fill a slot from the source or the design sheet. The player never sees
those.

## 6. The path log

1. Open Outcomes and copy its endings line (written, reachable in this call) and each ending's
   shortest path. Flow in Reach mode shows how often runs take each route, and once runs are
   cached the Calls findings and Flow's pins list flat odds, endings no run reached and stuck
   runs.
2. List each explored path in order, with the band at each step.
3. For each stage, force one adverse result on Play (select the row and press `B`, or Goes
   badly in its note; `W` goes well, `C` complications, `R` rolls) and read where it leads.
4. For each offered option, write the reason-to-pick line. Write it before reading the odds.
5. For each mixed and adverse result, fill a cue trace row.

Endings Outcomes shows under "Not in this call", or at 0 runs, still get read (Script lists
every ending). Note which draw, squad or kit would reach them (Find a draw with it, Grant cert).

## 7. Situations side by side

The leak check needs a strict comparison, not a skim.

1. Export the pre-check fields of situation 1 and situation 2 for the same building and seed
   into two text files (s1.txt and s2.txt), one string per paragraph, in the same order.
2. Replace bound names with a placeholder in both files, since binding differs by call seed.
3. Diff them with this standard-library snippet. Any line it prints, other than rooms and
   building names, is a leak.

```python
import difflib, sys
a = open(sys.argv[1], encoding="utf-8").read().splitlines()
b = open(sys.argv[2], encoding="utf-8").read().splitlines()
for line in difflib.unified_diff(a, b, "situation_a", "situation_b", lineterm="", n=0):
    print(line)
```

Run it as `python3 diff_situations.py s1.txt s2.txt`, then repeat for situation 3. If you cannot
run python3, read the two exports line by line in two columns and record the comparison as done
by eye.

## 8. Voices, by speaker and then in order

Write the speaker list first.

```
Speakers <call>
| Speaker | Kind (caller, bystander, subject, radio, negotiator, officer, narration) | Lines | Voice markers source |
```

Then read each speaker's lines in a row, aloud or at speaking pace in your head. Drift shows up
here, such as a caller who is frightened in one line and composed in the next. Then read the
scene in order. Checks by kind of speaker follow.

- Callers and bystanders. Fragments, landmarks rather than floor plans, the one fear repeated,
  how they know ("I heard him", "his car’s here"), and sometimes wrong. A full sentence of
  exposition from a caller is a break.
- Subjects. One need or grievance, said plainly and often repeated. No speech, no explained
  motive, no self-diagnosis. "Nobody’s coming in" carries more than a paragraph.
- Radio. Position, status, need, in that order, under ten words. No ten-codes, no war words.
- Negotiators. The order is paraphrase, mirror, label, pause, open question. A negotiator never
  argues, lectures or promises without command. An ultimatum from a negotiator is a break.
- Officers. Each line matches the officer's three markers (sentence length, what they notice
  first, one verbal habit) from ../swat-officer-stories/references/profile-patterns.md. A
  strained officer's calls get shorter. With no markers on file, the line stays neutral.
- Team humor. Inside the team only, exact, never on a victim or a subject. None under threat.
- Attribution. "Said" or the UI's speaker format. No fancier verb, no adverb on said.
- Regional voice. Word choice only, never phonetic spelling.
- Narration in call text. Prompts, previews, results and fact lines are read as narration. Listen
  for engine words (disputed point, agreed step, recorded need, assigned, qualified, verified)
  and for a mechanic narrated as a mechanic.

Log breaks as rows of speaker, line as written, break, rule.

## 9. The ending, last and alone

Read each ending on its own after everything else, as the line the player will remember.

1. Does it name each person's actual state?
2. Does it keep one lasting detail, something seen or said?
3. Does it claim only what the team did (honesty list H1 to H10 in SKILL.md), and is it true on every path that reaches it?
4. Does it leave one thread open?
5. Does the last sentence state a lesson? If so, it is a sermon (pattern G4).

## 10. One reviewer, three seats

A single reviewer rotates through three seats with one pass in each. Note which seat produced
each finding.

| Seat | Reads as | Asks |
| --- | --- | --- |
| Player | Someone with a phone and ten seconds | Who is this, what do I do, why would I pick that? |
| Caller or subject | The person on the worst night of their year | Would I say this? Do I sound like me in every line? |
| Officer | A professional on the radio and at the door | Would I say this? Is the order of work right? Is anything here a method? |

## 11. Reading officer text in context

Officer text is read where the player meets it, in this order.

1. Recruit card. One pressure line, about 18 words. Does it give a call something to test? Does
   it fit all 5 roles and all 6 traits?
2. Sheet tiers. Each layer adds one fact. Does a later layer contradict an earlier one or the
   calendar?
3. Shift report entry. About 15 words naming who and what changed. Does it cite a recorded event?
4. Debrief callback. One per operation, in the briefing or debrief only. Does it resolve to a
   ledger fact? If the engine has no ledger yet, any callback text is design only and must say
   so.

Read every pronoun set the template will receive (she, he, they) and every name with
diacritics. Then run the officer read order and the four officer-ethics checks in
review-rubric.md section 8. Route findings to swat-officer-stories.
