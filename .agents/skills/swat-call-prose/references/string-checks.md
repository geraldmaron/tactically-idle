# String checks

The literal procedure for checking call strings before handoff. The checker
ships in this skill folder as scripts/game_string_checks.py, so the skill works
on its own in any harness with python3. It covers the rules nothing in the
repo enforces yet (dashes, colons, stock lines, repeats, budgets, band
coverage, address, clock form, officer presence) and the tell checks game
strings need (cadence, opener share, rule-of-three, a stock lexicon). It also
runs the typed lint's word lists over any lane. This skill runs it on one call
and swat-writing-review on whole batches, from this one copy. Without python3,
use section 7 and record the gap.

The written-voice checker is an optional extra pass. The vendored script is
the required one, and "not run" is allowed in the record only when python3
itself is unavailable.

## 1. The strings file

Draft every string in a tab-separated file with a header row. Checks run on
the draft, then the clean text moves into the .ts file. Never feed a .ts file
to any checker.

| Column | Required | Holds |
|---|---|---|
| situation | yes | s1, s2 or s3, or all when the string reads the same in every situation |
| where | yes | the engine field path, such as stage2.go_in.outcomes.adverse.text |
| surface | yes | one key from the list below |
| text | yes | the string exactly as the player reads it, authored name in place |
| stage | no | the stage id, used for per-stage limits (defaults to the first part of where) |
| action | for results and previews | the action id, so the script can count bands |
| band | for results and previews | favorable, mixed or adverse |
| path | no | path ids this string sits on, comma separated, in reading order |
| locked | for summaries | y when the action has a requires reason |

Surface keys, matching surface-budgets.md. title, hook, dispatch, known,
unknown, team_job, fact_label, fact_claim, fact_note, fact_source,
fact_result, marker, map_task, stage_label, prompt, choice_title, summary,
preview, requirement, modifier, cert_bonus, support, equipment, result,
result_label, officer_harm, ending_title, ending_summary, still_needed,
objective, civilian_outcome, radio, speech, service, debrief, pressure_label.

Every row maps to a field the engine reads. A design-doc row with no engine
field (a "What it risks" column, for example) is never in this file. Cut it,
or bind it to a real field such as hazardReason.

Example rows (tabs shown as wide gaps, illustrative call).

```
situation  where                      surface   text                                                             stage  action  band     path   locked
all        bakery.title               title     The Latched Storeroom                                            card
all        bakery.opening             hook      Lena Sorensen wants her bakery open by 5. The storeroom is ...    card                    P1,P2
s1         adapt.prompt               prompt    The latch lifts an inch, then drops. Lena reaches for the handle.  adapt                   P1
all        adapt.talk.summary         summary   {lead} talks through the door while Lena waits by the ovens.     adapt  talk            P1     y
s1         adapt.talk.adverse         result    The voice goes quiet. Lena slips past patrol with her key.       adapt  talk    adverse  P1
```

Rows run in player reading order, card first, ending last. A field that
varies by situation gets one row per situation. A result that reads the same
in every situation may use situation all, and the band count treats it as
covering every situation. Write curly apostrophes and quotes as the data will
hold them. No exporter script exists in package.json as of 2026-10-06, so
search the repo for one, or copy the strings by hand. Never commit a scratch
exporter without the owner's say.

## 2. Run the checks

From the repo root, run the vendored script with the lint source so it reads
the live word lists instead of a copy. Pass every cast first and last name and
any deliberate motif.

```
python3 .agents/skills/swat-call-prose/scripts/game_string_checks.py strings.tsv \
  --lint-source src/gen/incident/gates/prose-lint.ts --write-txt strings.txt \
  --cast lena sorensen --keep "yesterday’s rolls" --hand-authored \
  --call-nouns door storeroom latch --bind "Lena Sorensen=<longest pool full name>"
```

--call-nouns lists the call's own nouns (the door, the medic, the team) so
path repeats skip them. --bind measures every budget with the longest full
name in the cast pool for each slot, and with the longest location swap if
the call has one. The output gives the authored length and the worst bound
length, and both go in the record.

If the skill folder moved, find game_string_checks.py beside this file's
parent. If prose-lint.ts moved, search for UNSAFE_DETAIL. If some patterns are
reported missing, the file changed shape, so read it and say so in the record.

It exits 1 when a blocking check fires. Blocking checks are over-limit,
sentence-lint, dash, placeholder, missing-band, marker-name, marker-judge,
ngram, path-echo, address-mix, clock-mix, stock-spoken, unsafe, accusation,
settled, meta, inversion, fronted (above 1 per call), nothing-alone,
fragments, fragment-open, mechanic, vague-preview, ending-status,
role-position, threat-it, tape-subject and aphorism. Opener share and cadence
are reported, never blocking. In the hand-authored lane, unsafe, accusation
and settled are fixed or flagged to the owner instead.

## 3. Optional, written-voice's checker

If the written-voice skill is installed where you work, run its checker on
strings.txt as a second pass, joining its allow list with
game-allow-words.txt and the cast names (its allow flag replaces the default
list). Ignore its paragraph lines. If it is not installed, skip it and say so.
The vendored script already covers the tells game strings need.

## 4. Reading the output

| Check | Pass condition | What to do |
|---|---|---|
| over-limit | 0 | counted characters, spaces included. Markers 10, map tasks 12 |
| over-target | each named | allowed with a reason in the record |
| locked-clamp | 0, or each confirmed | a locked summary over 80 chars loses its end, so lead with the cost or cut to 80 |
| sentence-lint, sentence-long | 0, each named | over 34 words blocks, over 22 needs a reason |
| dash | 0 | even though written-voice lets two through |
| colon | 0 | clock times are skipped |
| apostrophe, semicolon, exclamation | 0, almost never, inside a quote only | data uses curly marks |
| stock, stock-spoken | 0 | rewrite with the observable thing, or a line only this call has |
| feeling | 0 | replace with a behavior, "she stops reading the page aloud" |
| sheet-term | 0 | design vocabulary (her say, consent, rapport) becomes the act |
| engine-word | 0 | steps, strain note, leaning, band and kin become the condition itself |
| policy-voice | 0 | the ethics screen is never narrated, show the behavior |
| defer | 0 | a preview never points to the record, the report or later |
| delay-only | 0 | a mixed line names what changed besides the clock |
| word-choice | 0 | US word choice, see vocabulary-and-lint.md |
| weapon-speech | 0 | civilians never say weapon |
| placeholder | 0 | no parenthetical, "as favorable" or "same as" stands in for text |
| missing-band | 0 | every action has all three bands in every situation it reaches, plus an adverse preview |
| marker-name, marker-judge | 0 | markers name the claim neutrally |
| repeat, ngram | 0 outside --keep | no 4-word run repeats across fields or situations |
| motif | each motif 2 uses or fewer | a kept motif is listed in the record |
| path-repeat | each named | counted per path, the strings one player reads. A concrete image (socks, clock, slip) twice on a path fails unless it changes state. Pass the call's own nouns with --call-nouns |
| negation-openers | 5% or less | Nobody, No and Nothing opening sentences across the call. Recast some as what did happen |
| path-echo | 0 | consecutive strings on a path share no 3-word run (card, briefing, first prompt included) |
| address-mix | 0 | "you" in prompts, summaries and previews, the team or a role in results and endings |
| clock-mix | 0 | one written form per hour in narration |
| cost-template | 0 | "may" once per stage in summaries, one bare speed word per call |
| lead uses | 3 or more, hand-authored | at least one summary per stage names {lead} doing the risky part |
| opener share | reported. No word over 20%, names and pronouns 35% or less | change the subject, never the word order. Let another person, an object or a sound act. If the share is still high, report it and leave it. A natural 22% beats a contorted 18% |
| cadence | reported, variation 0.55 or more | vary by merging or splitting sentences, never by fragments or inversion. Explain FLAT in the record |
| inversion, fronted | 0 inversions, at most 1 fronted clause per call | "Out comes Ben" becomes "Ben comes out". "Angry to be called, Lewis says" becomes "Lewis says ten more minutes and hangs up". Force, harm and surrender lines always run subject then verb |
| nothing-alone, fragments, fragment-open | 0, 2 or fewer, 0 | "Nothing." never stands alone. At most two strings per call are only fragments. A result's first sentence has a subject and a verb |
| narrator-hedge | 0 | apparently, of course, somehow and kin. Report it as fact or as someone's words |
| mechanic | 0 | off the board, costs time, takes longer, extra minutes. Say who waits or what does not happen |
| vague-preview | 0 | something, somewhere else, little or nothing, the talk breaks. Name a person and a visible act |
| ending-status | 0 | review status and "finally" never close an ending |
| role-position | 0 | patrol seeing, hearing or calling after call-out, "asks patrol", a negotiator escorting. See dialogue-and-radio.md |
| threat-it, it-check | 0, each read | a threat names the object. Read every it-check string alone and confirm the referent is inside it |
| tense-mix, tense-call | 0, 0 | one tense for results across the call, never two in one string |
| speech-tag | 6 or fewer per speaker | quote the line that matters instead of tagging paraphrase |
| tape-subject, aphorism | 0 | the tape is a place. No slogan, chiasmus or "no X, just Y" |
| rule-of-three | 3 or fewer | break some lists into two or four |
| lint policy candidates | listed | each goes on the Lint policy collisions line |

Opener share and cadence count only when the call has 10 or more sentences.
A FLAT verdict is never just read. Vary sentence length in results and
endings first, because those carry the most sentences, by merging or splitting
real sentences. Proof round 2 showed what chasing these numbers does. Writers
inverted syntax ("Down goes Lewis") and stacked fragments ("Ring after ring.
Nothing.") to move a metric, and judges read both as a machine voice. A
number is never worth a sentence nobody would say.

## 5. Checks the script cannot make

Read these by eye and count them in the record.

1. Preview against result. For every action, read each band's preview beside
   that band's result in every situation. A preview false in any situation
   fails. When the truth decides what the team finds, previews describe how
   well the team executes and the summary names the truth risk once as a
   public doubt ("If she is armed, ...").
2. Ending against path. Read each ending beside every path that reaches it.
   A time, an arrival or a presence the path does not guarantee fails.
3. Who and where. For every action line, name who does it and where they
   stand. If that role could not do it from that position, rewrite it.
4. Swap and tone, as in punch-up pass 5.
5. Severity. For each action and band, find the worst situation's result. If
   it puts a person at the point of harm, a weapon in hand or a near miss, the
   preview names that tier of danger ("He still has it in reach when you get
   to him"), even when other situations are milder. Count severity mismatches
   apart from falsity.
6. Antecedents. Read each result, summary and preview with no other field
   visible. Any "it" with no referent inside the string fails.
7. Continuity. List every object that recurs (phone, key, door, stairs, the
   weapon) with its stated properties and its location per situation. Flag
   any string that contradicts them, such as a cord on a cell phone.
8. Cost collision. For each stage menu, write each summary's cost holder and
   harm. Two options naming the same holder and the same harm fail unless
   the degree clearly differs (14 minutes against one refusal).
9. Images. List each concrete image (clock, letter, chair, slip) by path and
   stage. One that recurs must change state (the clock stops, the letter turns
   face down) or it fails.
10. Read aloud. Read every prompt, preview, result and ending in path order,
    one path per ending, in one breath each. List any sentence whose word
    order you would not say out loud, any maxim with an abstract noun as its
    object (silence, waiting, quiet), any stock aftermath beat and any clause
    with no subject. The record names, for each tell family (feelings, policy
    voice, stock spoken, inversions), whether the 0 came from the script, the
    read, or both. A script-only 0 is recorded as "script only, not read".

## 6. Repo commands after the checks

```
npx vitest run content-gates content-playability issued catalog-v9
npm run verify
```

The first runs the content gates and issued fingerprint suites by file name.
The second runs everything and goes before any pull request. Record each
command with its exit code.

## 7. Fallback without python3

```
perl -CSD -ne 'print "$.\t$_" if /[\x{2012}-\x{2015}]|\S \x2d \S|\x2d\x2d/' strings.tsv
perl -CSD -ne 'print "$.\t$_" if /(?<!\d)\x3a|\x3a(?!\d)/' strings.tsv
perl -CSD -ne 'print "$.\t$_" if /every minute counts|time is running out|eerie|palpable|tension|not going anywhere|do the talking/i' strings.tsv
perl -CSD -ne 'print "$.\t$_" if /\bgarden\b|key safe|rear lane|letterbox|teatime|ambulance crew|carry chair|\bmum\b|pavement|car park/i' strings.tsv
perl -CSD -ne 'print "$.\t$_" if /\t\(|as favorable|same as|\bfeels?\b|\bfurious\b|\bfrantic\b|nobody promises|in the record/i' strings.tsv
perl -CSD -ne 'print "$.\t$_" if /\t(Out|In|Down|Up|Inside|Gone) (comes|goes|walks)|off the board|takes longer|apparently|point it|patrol (sees|hears)|under review/' strings.tsv
```

perl ships with most systems and reads code points directly. Count bands,
openers and repeats by hand from the file. With neither tool, check every
string by eye and record each check as "checked by eye".

## 8. Batch use by review

swat-writing-review runs the script over a whole version's strings with
`--min-repeat 3` to find template echo across frameworks, and states the
sample size. Its thresholds are house targets, not research findings.
