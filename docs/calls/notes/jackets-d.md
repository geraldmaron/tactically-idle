# Service jackets, batch D (person_070 to person_100)

Officer record under `.agents/skills/swat-officer-stories/SKILL.md`. The text lives in
`src/content/people/jackets-d.ts` (`AUTHORED_D`, 31 jackets). Base commit 47d993a on claude/world-redesign.

## Batch table

Pronouns are each persona's own set. District, openness and tie kinds are authored per person and
never read from culture, appearance or pronouns. Pattern letters: A careful here/careless there,
B good at what they avoid, C precise with objects/loose with time, D loud off duty/spare on the
radio, E fixes for others, F open about others/closed about self, G tidy kit/chaotic locker,
H gives advice/skips it, I keeps things then gives them away.

| Id | Name | Set | Notices | Habit | Pattern | Length | District | Page 3 kind | Open |
|---|---|---|---|---|---|---|---|---|---|
| 070 | Eitan Levi | he | count | counts out loud | I | medium | larkin | first_call | yes |
| 071 | Miriam Rosen | she | words | repeats the last thing said | E | medium | oldmill | negotiated | no |
| 072 | Aleksei Morozov | he | sound | names the street | F | medium | eastgate | favorable_under_pressure | no |
| 073 | Kateryna Bondar | she | sound | names the next step | H | medium | pike | rescue | yes |
| 074 | Mateusz Zieliński | he | exits | says copy and nothing else | C | short | harbor | first_call | no |
| 075 | Ivana Kovač | she | faces | ends on a question | G | medium | oldmill | negotiated | yes |
| 076 | Luka Petrović | he | hands | describes hands first | I | short | pike | injured | no |
| 077 | Eszter Varga | she | words | repeats the last thing said | A | medium | larkin | mentored | yes |
| 078 | Nikos Papadakis | he | gear | reports gear before people | G | medium | oldmill | rescue | no |
| 079 | Francesca Moretti | she | exits | gives the clock time | B | medium | eastgate | rescue | no |
| 080 | Luca Romano | they | light | says copy and nothing else | G | short | pike | first_call | yes |
| 081 | Camille Dubois | they | light | names the street | B | medium | larkin | favorable_under_pressure | no |
| 082 | Étienne Laurent | he | words | repeats the last thing said | F | medium | oldmill | negotiated | yes |
| 083 | Inés García | she | faces | names the next step | E | medium | pike | person_lost | yes |
| 084 | Rafael Costa | he | hands | describes hands first | I | short | eastgate | favorable_under_pressure | yes |
| 085 | Luiza Almeida | she | time | says copy and nothing else | A | short | oldmill | injured | no |
| 086 | Valentina Rojas | she | light | ends on a question | H | medium | harbor | favorable_under_pressure | yes |
| 087 | Mateo Álvarez | he | exits | names the next step | D | medium | larkin | rescue | no |
| 088 | Emilio Vargas | he | gear | reports gear before people | A | medium | pike | mentored | no |
| 089 | Lucía Quispe | she | faces | counts out loud | C | medium | eastgate | first_call | yes |
| 090 | Thomas Beaulieu | he | time | gives the clock time | D | medium | harbor | person_lost | no |
| 091 | Marisol Nez | she | hands | reports gear before people | E | medium | oldmill | negotiated | yes |
| 092 | Evan Thomas | he | sound | ends on a question | B | short | larkin | favorable_under_pressure | no |
| 093 | Talia Williams | she | gear | names the next step | G | medium | pike | injured | yes |
| 094 | André Baptiste | he | count | counts out loud | I | short | harbor | mentored | no |
| 095 | Hugo O'Connell | he | exits | names the street | F | medium | oldmill | injured | no |
| 096 | Isaac Bell | he | words | ends on a question | H | medium | harbor | negotiated | yes |
| 097 | Hana Te Rangi | she | sound | says copy and nothing else | C | short | larkin | mentored | yes |
| 098 | Sione Tui | he | hands | describes hands first | E | short | pike | rescue | no |
| 099 | Moana Faumuina | she | time | gives the clock time | D | short | eastgate | favorable_under_pressure | yes |
| 100 | Noah Wilson | he | count | names the street | H | short | harbor | mentored | yes |

## Officer story record

```
Officer story record
- Scope: answered | person_070 to person_100, 31 jackets, 217 strings (7 per officer, radio counted at three bands)
- Schema: answered | fields used personalNote hobby kept in pressureLine, Jacket page1/page2/page3, openToRelationship, tieKinds, FactKind, DistrictId, TieKind | design only none added | requests none
- Predicate counts: not done | no trait, arc or callback written, so there is no predicate to count
- Seat: answered | 31 identity lines (pressure, contradiction, page 2) read against 5 roles and 6 traits plus none, role variants 0, implausible role beats 0. Page 3 lines only describe an object or habit after a recorded kind; the negotiated lines (071, 075, 082, 091, 096) hold for any seat because they describe how the officer behaves at a door, not a negotiator's part
- Calendar: answered | no age, years, rank, service or first-call claim in any line; "newcomer", "latest hire" and "whoever joins" are used for the mentored kind and carry no seat or experience claim, time claims 0
- Identity separation: answered | temperament, skill, trait or backstory from culture, appearance or pronouns 0. Districts were assigned by hand, and a read of the culture field for audit only finds no district holding more than two officers of one broad group
- Profiles: answered | 31, markers shown in Ready sample 31 of 31 (checked by the people-content test's habit and noticed-first matchers), copied markers 0 (Morozov's and Vargas's pressure lines adapt the conversions in profile-patterns.md section 3; their radio lines and markers are new), contradiction patterns A 3, B 3, C 3, D 3, E 4, F 3, G 4, H 4, I 4
- Origins and changes: not done | batch writes the profile, pages 2 and 3 only; no trait, strain or earned change
- Arc shape: not done | no arc written
- Fork: not done | no fork written
- Restraint: answered | no line costs an officer for waiting, talking or holding fire
- Civilian outcomes on cited calls: not done | no call is cited; page 3 lines fill {place} from the officer's own recorded fact at display time
- Ledger: answered | 31 page 3 lines, each keyed to one FactKind (first_call 4, rescue 5, injured 4, person_lost 2, negotiated 5, mentored 5, favorable_under_pressure 6), branches on a callback 0
- Nicknames: not done | none offered
- Repeats: answered | stock closer repeats per officer 0; three-word repeats across one officer's shown surfaces (pressure, contradiction, Ready radio, page 2, page 3) 0; the Ready, Strained and Overloaded radio forms intentionally share words, since one form renders at a time (22 repeat and 23 ngram hits from the string checker are all that); page 3 phrases repeated across the batch 0 outside the shared "he keeps a" frame inside page 2 lines
- Spread and collisions: answered | spread tally below; pronoun sets passed (13 she, 16 he, 2 they in this id range; the they lines use plural verbs, and the people-content test checks the other sets' pronouns); roster first names or surnames in any string 0; routed to human 2 (see below)
- Lines: answered | dashes 0, colons outside a clock time 0, word order hits 0 (inversion 0, fronted 0, bare it 0), over budget 0 (pressure 18 max, contradiction 12 max, Ready 10 max, Overloaded 4 max), pasted from the python checks run in the scratchpad (checks-d.py, checks2-d.py) and the game string checker
- Prose lint: answered | the game string checker ran with --lint-source src/gen/incident/gates/prose-lint.ts: unsafe 0, method 0, method-review 0, meta 0, accusation 0, settled 0. Owner decisions: 12 pressure lines at 16 words against the checker's house target of 15 (the skill allows 18 and aims 12 to 16), 14 straight apostrophes (the eight starter jackets use straight apostrophes too), and "garden" in Rosen's pressure line, which is the catalog note's own word ("community garden")
- Tells checked: not done | the written-voice checker is not installed in this worktree; read every line by eye against the tells list (no stock openers, no spaced dashes, no virtue words, no hype words)
- Tests: answered | npx tsc --noEmit -p . exit 0; npx vitest run src/content/people: 16 pass, 3 fail (the three starter-only assertions, listed below); the same file with those three assertions removed in a throwaway copy: 19 of 19 pass
- Handoff: swat-writing-review | requests none | callback intents passed to swat-call-prose 0
```

## Spread tally

Noticed first, 31 officers: count 3, words 4, sound 4, exits 4, faces 3, hands 4, gear 3, light 3,
time 3. Habit: counts out loud 3, repeats the last thing said 3, names the street 4, names the next
step 4, says copy and nothing else 4, ends on a question 4, describes hands first 3, reports gear
before people 3, gives the clock time 3. Districts: pike 7, oldmill 7, larkin 6, harbor 6,
eastgate 5. Open to a relationship: 16 of 31, chosen per officer from the object on page 2 and the
kind of life it suggests, not from identity.

Heavy page 3 lines (injured or person_lost): 6 of 31, one per officer at most: Petrović, Almeida,
O'Connell, Williams (injured), García, Beaulieu (person_lost). They fall on six different broad
culture groups when read for audit only. No fear, strain or loss line appears anywhere else in the
batch.

## Decisions, gaps and items for a human

1. **Habit "names the person" is not used.** The radio sample prints as written inside quotation
   marks on the jacket, and a person's name in it would collide with the roster. The nine other
   habits are spread evenly, and the one missing habit is the only gap in the set.
2. **Two person_lost lines go to a human reviewer** (skill rule, ledger-and-callbacks section 4):
   person_083 García ("After {place}, she kept one faded photograph unrestored in her back
   pocket.") and person_090 Beaulieu ("He still carries the card from {place}, with only the time
   written on it."). Both carry weight through an object, never the event, the cause or a feeling.
3. **Radio samples use a few civilians by description only** ("Man alone by the door", "Woman at
   the end looking away"). None depends on a role, and none suggests entry. The two question
   samples that could read as an entry suggestion were written as "Knock first?" and "Listen
   longer?" so none nudges toward force without a visible threat (E12).
4. **Hobby wording.** Where a note says "enjoys" the pressure line keeps the hobby noun and drops
   the verb ("cataloguing" became "catalogs", "enjoys photographing" became "photograph"). Three
   lines read a scene detail a player can picture (Zieliński's pry marks, Dubois's fresh paint,
   Quispe's people who stopped to look); none states a crime.
5. **Street names in radio** (Mercer Street, Alder Street, Linden Avenue, Maple Street) are
   generic and not read from the district data; if the city later fixes street names, swap them in
   the four samples that name a street.

## Existing tests that break by design

`src/content/people/people-content.test.ts`, three assertions that only hold for the eight starters:

- "cover the eight starting officers and nobody else" (the jackets now cover 39 personas).
- "give each officer different markers, a different contradiction pattern and a different radio
  voice": the first assertion, `noticesFirst` unique across jackets, cannot hold for more than nine
  officers. The later assertions in that test (unique patterns, unique habits) cannot hold either.
  Radio voice uniqueness does hold: all 39 Ready lines differ.
- "give every starter a second and third page...": the closing assertion that the opening district
  `pike` has exactly three home officers. Every district still has a home officer; pike now has ten
or more.

Suggested replacement for the middle one: assert uniqueness of Ready lines, and that no
`noticesFirst`, `habit` or `pattern` value is held by more than a fifth of the authored jackets.
