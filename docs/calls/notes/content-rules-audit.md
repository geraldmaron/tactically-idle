# Content rules audit

2026-10-20. Owner instruction, verbatim: "I approve auditing the content rules, skills and prose lint
and lifting the restrictions that settings filtering now covers. Keep the suicide method-detail
rule." The owner confirmed it directly in the session that ran this audit ("Yes. run the audit").

## Scope and method

Read in full: `.agents/skills/swat-call-design/references/ethics-and-authenticity.md` (E1 to E17,
the copaganda patterns, the open decisions), the content rules in `swat-call-design` (SKILL.md
sections 3, 7 and 10, `design-sheet.md` row M, `engine-map.md` requests), `swat-call-prose` (SKILL.md
section 7, `vocabulary-and-lint.md`, `string-checks.md`, `dialogue-and-radio.md`), `swat-writing-review`
(SKILL.md pass five, `review-rubric.md`, `batch-audit.md`, `path-and-honesty-checks.md`,
`cliche-and-copaganda.md`), and `src/gen/incident/gates/prose-lint.ts` with the checker that reads it
(`.agents/skills/swat-call-prose/scripts/game_string_checks.py`). `swat-officer-stories` restated one
E4 rule, so it was updated too.

Each rule went into one class:

- **(a) Topic restriction the settings filter now covers.** It kept a subject off the card, or
  softened naming it, for every player. Lifted: a player who doesn't want the subject filters its
  descriptor (`docs/content-rating.md`).
- **(b) Kept.** Craft and quality (repetition, voice, fake choices, honest previews, spoilers), and
  rules about *how* a subject is portrayed rather than *whether* it appears. A filter only decides
  whether a player meets a call; it can't make a stigmatizing, false or gratuitous line acceptable to
  the player who chose to meet it.
- **(c) Suicide method detail.** Kept by the owner's instruction, named as its own rule (E4.1), with
  its own lint pattern and test.

Where a rule's reason is a project instruction outside this audit's reach, that is the reason it is
kept. `AGENTS.md` ("Grounded. Consequences land plainly on named people, with no wound anatomy or
method.") is lead-owned and binds every lane, so wound anatomy stays banned.

## Lifted (class a)

| Rule | Action | Reason | Strongest objection |
|---|---|---|---|
| E4.5 Death stays off the card for a person at risk of self-harm | Lifted in the rulebook, E2.1, E16, the design screen, the review rubric, path-and-honesty check 5, engine request R10 retired | `death` and `suicide_self_harm` are both filterable and warned on the card. A blanket ban is the topic restriction the filter replaces | Safe-messaging guidance treats a depicted suicide death as the highest-risk portrayal, and a player who opted into "crisis calls" may not expect a death. Answer: the card warns with `death` for any call where one is reachable, E4.1 still bars the act and method, E4.2 still bars death as a release, and no current tree changes (the taker and the barricade subject keep `noFatal`; showing their deaths would be a deliberate content change with a fingerprint recapture) |
| E4.10 / `UNSAFE_DETAIL` `suicid\w*`: the word "suicide" banned in player text | Removed from the lint; E4.10 rewritten | The topic is filterable and warned; the owner already allowed the word on the four warning and support surfaces | Safe-messaging guides prefer showing behavior over the label. Answer: E4.9 (no "committed suicide", "successful attempt" and the rest) is kept, and the skills still say showing what the person said is the stronger line |
| `UNSAFE_DETAIL` procedure words: CPR, chest compressions, defibrillator, tourniquet | Removed from the lint; vocabulary table and O1 updated | `injury` is a filter descriptor; naming the medic's act plainly is not wound anatomy. Control: the injury switch is disabled today (filtering it empties the board), so for now this lift rests on the warning, not the filter | E7 said injury is seen through what the medic does, and procedure words can drift into a manual of care. Answer: E7 still bans anatomy, and E1 (no manual) still bans describing how |
| `UNSAFE_DETAIL` restraint words: restrain, handcuff, taser, pepper spray, baton, chokehold | Removed from the lint | Police force is filterable (`police_gunfire` is set by any force outcome) | "Handcuffed" implies custody, which O4 leaves open, and "chokehold" names a technique. Answer: implied custody is a block under writing-review H1, enforced by the human read (the SETTLED list does not catch "handcuffed"), and E1 still bars describing a technique. Control: a restraint shown only in prose doesn't derive `police_gunfire`, so batch audit item 5 now requires the descriptor be declared |
| `UNSAFE_DETAIL` ammunition, bullets | Removed from the lint | Gunfire is filterable; "a bullet hole in the ceiling" is a consequence, not a specification | E1 lists munitions. Answer: E1 is kept as written, so a munition's type, load or effect is still barred by review; only the bare noun is allowed |
| `UNSAFE_DETAIL` death words: shot dead, corpse, dead body | Removed from the lint | `death` is filterable (a death shown only in prose must declare it, batch audit item 5), and "shot" and "killed" were already allowed (E16) | "Corpse" and "dead body" are colder than the house register. Answer: E2.2 (every death is weight on a named person) is kept and reviewed by a human |
| `UNSAFE_DETAIL` stab | Removed from the lint | There is no "violence" descriptor; a stabbing is covered by `injury` or `death` when the outcome models it, and by batch audit item 5 when only the prose shows it. The pattern also matched "stable", a false positive on ordinary medic text | E7 still bars the wound itself |
| `UNSAFE_DETAIL` injury words: fracture, broken bone, concussion | Removed from the lint | `injury` is filterable; these are plain injury words, not anatomy in the gore sense | They name the body part hurt. Answer: E7 is kept for blood and wounds, and a broken leg is what a medic would say |
| Checker report "lint policy candidates (affirmative harm or weapon words, owner decision)" | Removed from `game_string_checks.py`; the record line now lists kept-rule hits the regex misses and method-review reads, and an unresolved E4.1 or E7 hit blocks handoff | It treated weapon, death and hurt words as owner decisions; O1 settled that on 2026-10-19 | The report was a cheap way to see every harm word in a call. Answer: the string checks still list every unsafe and method hit, and the review reads every death line (E2.2) |
| O2 support line placement | Marked settled | Settled by the owner on 2026-10-20 (`docs/content-rating.md`) | None |

## Kept (class b)

| Rule | Why it stays |
|---|---|
| E1 No manual | A method, entry sequence or munition specification is real-world harm to any reader. Not a topic |
| E2, E2.1 to E2.3 Force is never the reward; the bill; death has weight; the near miss | Game values and craft. The filter can't make force the reward acceptable |
| E3 Identity never signals danger | Bias, not topic |
| E4.6 Frequency cap, at most one crisis call per shift | First lifted, then restored on the Codex read: a filter decides whether a player meets crisis calls, not how often, and the cap's reason is normalization through repetition. Lifting it is a separate spacing decision for the owner |
| E12.5 clause: a self-directed crisis situation shows no force option | First lifted, then restored on the Codex read (its block): it governs how the game responds to a crisis, not whether a crisis appears, and a filter can't make an inappropriate force option justified |
| E4.0 The screen | It is how a situation gets its `suicide_self_harm` tag, which the filter and the warning depend on |
| E4.2 Never a release, a reward or a single cause | How a death is framed, not whether it appears. Glorification harms the player who chose the topic too |
| E4.3, E4.4, E4.4a The person is the stake; show the way out; the medical window | Craft of the crisis call |
| E4.7 Point to help | Not a restriction. Now carried by the descriptor (card warning and debrief line) |
| E4.8, E4.9 Mental illness is not the explanation; stigmatizing language | Accuracy and stigma, not topic |
| E5 Domestic abuse as a pattern of control | Portrayal accuracy; "snapped" hides the abuser's choices whatever the setting |
| E6 Forced entry costs someone | Craft and honesty |
| E7 No gore, no wound anatomy; `UNSAFE_DETAIL` blood, bleed, gore, gory | `AGENTS.md` "Grounded" binds every lane. The owner can lift it there |
| E8 Composites only | Legal and ethical, not topic |
| E9, E10, E11 (H1 to H11), E12, E13, E14, E15 | Craft, honesty and real call flow |
| E16, E17 house style verdicts | Updated in place to reflect the lifts; their kept rows are craft |
| `ACCUSATION`, `HEDGE`, `SETTLED`, `NEGATED`, `META_PHRASING` | Honesty and spoiler rules (E11) |
| Copaganda patterns P1 to P12, cliche patterns C1 to C11 and runner checks G1 to G16 | Craft. C4 (gore as stakes) and C6 (crisis as menace) are portrayal rules |
| Fake-choice checklist, the six named tests, preview honesty, spoiler pass, batch repeats | Craft and quality |
| Officer death not modeled (E16) | An engine scope decision, not a content ban |

## Kept as its own rule (class c)

| Rule | Action | Reason |
|---|---|---|
| E4.1 Suicide method detail | Renamed and given its reason in the rulebook. Two lint patterns in `prose-lint.ts`: `SUICIDE_METHOD` blocks phrasings with a self-directed method in them (lethal dose, noose, pills to die or to kill oneself, hanged or drowned oneself, shot oneself in the head, slit or cut wrists), flagged `method`, never accepted; `METHOD_REVIEW` reports words and phrasings that may name a method but also appear in ordinary medical, household or movement text (overdose, dosage, milligrams, sleeping pills, carbon monoxide, cut, shot, stabbed or poisoned oneself, jumped off a bridge, roof or garage), flagged `method-review` for a person to read. `prose-lint.test.ts` covers blocked phrasings, near misses ("heart pills", "hangs up", "the carbon monoxide alarm", "her sleeping pills from the pharmacy"), and runs the Python checker on real rows. The regex is a screen: swat-writing-review still reads every crisis call for method | The drama guidance the rulebook cites (Samaritans, AU8; Everymind Mindframe, AU9) singles out method detail as a risk to vulnerable readers, and that risk doesn't depend on whether they chose the topic, so a filter can't cover it |

## Effect on content

None. The audit lifts rules; it changes no call. Rerun after the Codex fixes: see below. `npm run check:strings` before and after differ only in
the removed policy report line and the new `method 0` count (unsafe 0 and method 0 in every call). No
compiled call changed, so the fingerprints were not recaptured. Today's trees still spare their crisis
subjects with `noFatal`; showing a death there now would be a design decision, made in the call and
recaptured on purpose.

## Follow-ups outside this audit's files

- `AGENTS.md` and the skills README say "no wound anatomy or method". Lead-owned; unchanged, and the
  reason E7 stays.
- `docs/incident-domain-model.md` lists "E4.5" among standing rules, and `docs/call-trees-v13.md`
  describes the current trees' no-death screen. Lead-owned docs; they now describe history.
- The engine still honors `noDeathOnCard` on a person and `noFatal` on force. Both stay as tools a
  design may choose; nothing requires them now.
- `src/gen/incident/gates/content-descriptors.ts` still cross-checks a `noFatal` adult subject against
  `suicide_self_harm` or a recorded reason. That is a tagging check (E4.0), kept.

## Codex read

Codex, configured default model, read-only, fresh thread, 2026-10-20, on commits 365180f to 0dfa9dc.
Verdict: **reject**, one block and eight fix before ship. It agreed E4.5 and the bare death, injury,
ammunition and procedure words fit class (a), and found no kept rule that should be lifted.

| # | Finding | Severity | My verdict | What changed |
|---|---|---|---|---|
| 1 | The E12.5 self-directed force clause governs the game's response to crisis, not topic access | block | accepted | Restored in the rulebook, design screen and record, review rubric and officer-stories check 7; moved to kept |
| 2 | E4.6's frequency cap has a portrayal purpose; a binary filter isn't a frequency control | fix before ship | accepted | Restored in the rulebook and batch audit; lifting it is left to the owner as a spacing decision |
| 3 | `SUICIDE_METHOD` missed "pills to kill himself", "cut his own wrist", "drown herself" | fix before ship | accepted | Added reflexive method verbs, "own" wrists, pills to kill, jumping off a bridge or roof, with tests |
| 4 | The pattern blocked ordinary text ("carbon monoxide alarm", "sleeping pills from the pharmacy", "dosage on her prescription") | fix before ship | accepted | Split: ambiguous words moved to `METHOD_REVIEW`, report only, read by a person; those lines are negative cases for the blocking pattern |
| 5 | Tests didn't run the Python checker | fix before ship | accepted | The test now runs the checker on rows: a method line reports `method` and exits 1; a review word reports `method-review`; lifted words pass |
| 6 | Lifted bans still restated in engine-map, the E7 text, vocabulary "Gaps are not licenses" and officer-stories | fix before ship | accepted | All four rewritten. writing-review's crisis-cap record slot stays, since the cap is restored |
| 7 | A known E4.1 violation the regex misses became nonblocking | fix before ship | accepted | Record line and vocabulary text: an unresolved E4.1 or E7 hit blocks handoff; the regex is a screen |
| 8 | Coverage claims ignore that `injury` is disabled and that derived descriptors read outcomes, not prose | fix before ship | accepted | Batch audit item 5 requires declaring a descriptor the prose shows but the data doesn't derive; the procedure, restraint, stab and death rows state these limits |
| 9 | `docs/content-rating.md` still said "suicide" nowhere else | fix before ship | accepted | Recorded that the audit supersedes "nowhere else", with E4.9 and E4.1 still holding |
| 10 | "Method detail is the one part tied to imitation" overstates; SETTLED doesn't catch "handcuffed" | note | accepted | Evidence claim qualified in E4.1 and this table; the custody answer now names the human read |

### Second Codex read, on the fixes (0dfa9dc to 68ea323)

Codex, configured default model, read-only, fresh thread, 2026-10-20. Verdict: **reject**, narrower:
findings 1, 2, 9 and 10 resolved, 3 resolved for the reported cases, 4 to 8 partly resolved, and one
new regression.

| # | Finding | Severity | My verdict | What changed |
|---|---|---|---|---|
| 3 | "shoot his own head" and "jump off the parking garage" match neither pattern | note | accepted | "shoot his own head" and "shot himself in the head" block; jumps from a garage, tower or cliff go to review |
| 4 | The blocking pattern still blocks ordinary text: "pills to kill the pain", "tablets to kill bacteria", "the medic cut herself on the broken window", "patrol jumped from the roof" | fix before ship | accepted | Blocking now needs a self-directed method (pills to die or to kill oneself, hanged or drowned oneself, wrists). Reflexive cut, shot, stab and poison, and jumps from a height, moved to review. All four lines are negative tests |
| 5 | The non-blocking checker test didn't assert exit 0 | note | accepted | Asserted |
| 6 | engine-map R10 let a fatal force draw kill a crisis subject "like any other", ignoring the restored E12.5 clause | fix before ship | accepted | R10 now applies only where E12.5 lets force be offered, never in a self-directed situation |
| 7 | vocabulary-and-lint still called any word outside the regex an owner policy question | fix before ship | accepted | Only a word no written rule covers is an owner question; a rule break is rewritten whatever the regex says |
| 8 | swat-call-prose section 7 still said the filter keeps every listed topic off the board | fix before ship | accepted | It now says the card warns, the filter works where it can (injury disabled), and prose-only content declares its descriptor |
| 11 | Restoring the self-directed rule dropped the rubric's separate "entry with no command reason" blocker | fix before ship | accepted | Both blockers are in the rubric |

No third Codex read was run. These fixes are checked by `prose-lint.test.ts` (71 tests, including the
four false positives as negative cases and the checker run on rows) and by `npm run check:strings`.