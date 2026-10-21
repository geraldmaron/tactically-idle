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
| E4.5 Death stays off the card for a person at risk of self-harm | Lifted in the rulebook, E2.1, E16, the design screen, the review rubric, path-and-honesty check 5, batch audit item 3, engine request R10 retired | `death` and `suicide_self_harm` are both filterable and warned on the card. A blanket ban is the topic restriction the filter replaces | Safe-messaging guidance treats a depicted suicide death as the highest-risk portrayal, and a player who opted into "crisis calls" may not expect a death. Answer: the card warns with `death` for any call where one is reachable, E4.1 still bars the act and method, E4.2 still bars death as a release, and no current tree changes (the taker and the barricade subject keep `noFatal`; showing their deaths would be a deliberate content change with a fingerprint recapture) |
| E4.6 At most one crisis call per shift | Lifted in the rulebook; batch audit section 6 now checks tagging instead | The cap limited exposure for everyone; the filter lets each player set their own | A run of crisis calls can normalize them for a player who leaves the filter off, and that was the cap's stated reason. Answer: the warning names the topic on every such card, and `calls-per-kind` will widen the pool; if playtests show clustering, a draw-side spacing rule can return as tuning, not a content ban |
| E12.5 clause: a self-directed crisis situation shows no force option | Lifted in the rulebook, design screen line 13 and record, review rubric, officer-stories check 7 | It kept police force against a person at risk of self-harm out of the game. `police_gunfire` and `suicide_self_harm` are filterable. The rest of E12.5 stays: force still needs a visible threat to life (now including the subject's own) and command's reason | This reopens the "suicide by cop" path the clause closed, and E4.0 says that path must never be rewarded. Answer: E4.0's "never reward that path, never the only end of a branch" and E2 (force is never the reward) are kept, so the path can exist only as a cost |
| E4.10 / `UNSAFE_DETAIL` `suicid\w*`: the word "suicide" banned in player text | Removed from the lint; E4.10 rewritten | The topic is filterable and warned; the owner already allowed the word on the four warning and support surfaces | Safe-messaging guides prefer showing behavior over the label. Answer: E4.9 (no "committed suicide", "successful attempt" and the rest) is kept, and the skills still say showing what the person said is the stronger line |
| `UNSAFE_DETAIL` procedure words: CPR, chest compressions, defibrillator, tourniquet | Removed from the lint; vocabulary table and O1 updated | Injury is filterable; naming the medic's act plainly is not wound anatomy | E7 said injury is seen through what the medic does, and procedure words can drift into a manual of care. Answer: E7 still bans anatomy, and E1 (no manual) still bans describing how |
| `UNSAFE_DETAIL` restraint words: restrain, handcuff, taser, pepper spray, baton, chokehold | Removed from the lint | Police force is filterable (`police_gunfire` is set by any force outcome) | "Handcuffed" implies custody, which O4 leaves open, and "chokehold" names a technique. Answer: implied custody is still a block under writing-review H1 and the SETTLED list, and E1 still bars describing a technique |
| `UNSAFE_DETAIL` ammunition, bullets | Removed from the lint | Gunfire is filterable; "a bullet hole in the ceiling" is a consequence, not a specification | E1 lists munitions. Answer: E1 is kept as written, so a munition's type, load or effect is still barred by review; only the bare noun is allowed |
| `UNSAFE_DETAIL` death words: shot dead, corpse, dead body | Removed from the lint | `death` is filterable, and "shot" and "killed" were already allowed (E16) | "Corpse" and "dead body" are colder than the house register. Answer: E2.2 (every death is weight on a named person) is kept and reviewed by a human |
| `UNSAFE_DETAIL` stab | Removed from the lint | Violence is filterable. The pattern also matched "stable", a false positive on ordinary medic text | None beyond E7, which still bars the wound itself |
| `UNSAFE_DETAIL` injury words: fracture, broken bone, concussion | Removed from the lint | `injury` is filterable; these are plain injury words, not anatomy in the gore sense | They name the body part hurt. Answer: E7 is kept for blood and wounds, and a broken leg is what a medic would say |
| Checker report "lint policy candidates (affirmative harm or weapon words, owner decision)" | Removed from `game_string_checks.py`; record line repurposed for words a kept rule bans that the regex misses | It treated weapon, death and hurt words as owner decisions; O1 settled that on 2026-10-19 | The report was a cheap way to see every harm word in a call. Answer: the string checks still list every unsafe and method hit, and the review reads every death line (E2.2) |
| O2 support line placement | Marked settled | Settled by the owner on 2026-10-20 (`docs/content-rating.md`) | None |

## Kept (class b)

| Rule | Why it stays |
|---|---|
| E1 No manual | A method, entry sequence or munition specification is real-world harm to any reader. Not a topic |
| E2, E2.1 to E2.3 Force is never the reward; the bill; death has weight; the near miss | Game values and craft. The filter can't make force the reward acceptable |
| E3 Identity never signals danger | Bias, not topic |
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
| E4.1 Suicide method detail | Renamed and given its reason in the rulebook; new `SUICIDE_METHOD` pattern in `prose-lint.ts` (overdose, dosage, milligrams, lethal dose, sleeping pills, pills to die, noose, hanged oneself, slit or cut wrists, carbon monoxide); the checker flags it as `method`, blocking and never accepted; `prose-lint.test.ts` covers matches, near misses ("heart pills", "hangs up", "cut the cord") and the checker reading the pattern | Method detail is the part of a suicide portrayal tied to imitation in the evidence the rulebook cites (Samaritans, AU8; Everymind Mindframe, AU9). It harms a reader whether or not they chose the topic, so a filter can't cover it |

## Effect on content

None. The audit lifts rules; it changes no call. `npm run check:strings` before and after differ only in
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

Pending; recorded below when it returns.
