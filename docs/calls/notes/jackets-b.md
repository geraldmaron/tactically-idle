# Officer story record: jackets batch B

Personas person_009 through person_038 (30 officers), written into `src/content/people/jackets-b.ts` under
`swat-officer-stories`. Base commit 47d993a on claude/world-redesign. Each jacket is page 1 (pressure line,
contradiction, three voice markers, radio sample at Ready, Strained and Overloaded), page 2 (a habit or object
line and a home district), page 3 (a ledger kind and a `{place}` line), `openToRelationship` and two `tieKinds`.

## Officer sheets

Noticed first, habit and length are the three voice markers. Every Ready sample shows all three; the test in
`people-content.test.ts` checks each one by pattern, and the table's last two columns are the page 3 kind and
the home district.

| Id | Name, set | Hobby kept | Contradiction pattern | Noticed first | Habit | Length | Page 3 kind | District |
|---|---|---|---|---|---|---|---|---|
| 009 | Harjit Singh, he | model train tracks | precise with objects, loose with time | exits | names the next step | medium | rescue | eastgate |
| 010 | Amandeep Kaur, she | birds by song | gives advice, skips it | sound | counts out loud | short | mentored | larkin |
| 011 | Jordan Ellis, they | ceramic bowls | keeps things, then gives them away | hands | describes hands first | medium | injured | oldmill |
| 012 | Morgan Hale, they | city footpaths | open about others, closed about self | exits | names the street | short | first_call | pike |
| 013 | Samira Haddad, she | movie soundtracks | tidy kit, chaotic locker | time | gives the clock time | short | favorable_under_pressure | pike |
| 014 | Omar Farouk, he | worn book bindings | careful here, careless there | gear | reports gear before people | short | injured | oldmill |
| 015 | Yasmin Abdi, she | window pot herbs | fixes for others | light | says copy and nothing else | short | first_call | larkin |
| 016 | Idris Mensah, he | cooperative board games | gives advice, skips it | faces | ends on a question | short | negotiated | pike |
| 017 | Zainab Suleiman, she | staircase postcards | good at what they avoid | count | names the next step | medium | rescue | larkin |
| 018 | Kofi Boateng, he | wooden chairs | fixes for others | hands | describes hands first | medium | mentored | harbor |
| 019 | Amina Diallo, she | rain reflections | precise with objects, loose with time | faces | names the street | medium | first_call | harbor |
| 020 | Amadou Traoré, he | record storage boxes | careful here, careless there | count | reports gear before people | medium | favorable_under_pressure | pike |
| 021 | Thandiwe Ndlovu, she | community seed exchange | gives advice, skips it | faces | counts out loud | short | rescue | larkin |
| 022 | Sipho Dlamini, he | old map jigsaws | tidy kit, chaotic locker | count | gives the clock time | short | first_call | eastgate |
| 023 | Naledi Mokoena, she | macro photographs | precise with objects, loose with time | count | ends on a question | medium | favorable_under_pressure | pike |
| 024 | Kabelo Molefe, they | balcony succulents | open about others, closed about self | time | says copy and nothing else | short | negotiated | oldmill |
| 025 | Asha Mwangi, she | cinema oral histories | loud off duty, spare on the radio | words | repeats the last thing said | short | negotiated | harbor |
| 026 | Daniel Otieno, he | carved scrap wood | good at what they avoid | hands | describes hands first | medium | injured | larkin |
| 027 | Selam Tesfaye, she | transit stations from memory | open about others, closed about self | exits | counts out loud | short | mentored | eastgate |
| 028 | Dawit Bekele, he | train journey playlists | loud off duty, spare on the radio | time | names the next step | short | favorable_under_pressure | eastgate |
| 029 | Nuru Mfinanga, they | handmade bookmarks | tidy kit, chaotic locker | words | repeats the last thing said | medium | negotiated | oldmill |
| 030 | Joël Kamau, he | road atlases | fixes for others | words | names the street | medium | rescue | eastgate |
| 031 | Priya Raman, she | cyanotype leaf prints | keeps things, then gives them away | light | says copy and nothing else | short | injured | pike |
| 032 | Arjun Desai, he | vintage desk lamps | careful here, careless there | gear | reports gear before people | short | injured | larkin |
| 033 | Farah Qureshi, she | cloud journal | good at what they avoid | light | ends on a question | medium | rescue | oldmill |
| 034 | Imran Rahman, he | mechanical toys | gives advice, skips it | sound | gives the clock time | short | first_call | harbor |
| 035 | Nisha Perera, she | illustrated recipe cards | good at what they avoid | hands | describes hands first | medium | mentored | pike |
| 036 | Sahan Fernando, he | recycled paper kites | keeps things, then gives them away | sound | ends on a question | medium | favorable_under_pressure | pike |
| 037 | Anika Shrestha, she | public fountain photos | open about others, closed about self | faces | repeats the last thing said | medium | negotiated | larkin |
| 038 | Tenzin Dorje, he | old bicycles | fixes for others | gear | counts out loud | medium | mentored | harbor |

Persona names print as authored (Amadou Traoré and Joël Kamau carry diacritics; the names appear only in code
comments and this table, never in a player string).

## Spread tally for the batch

Counts printed by a throwaway test run over `AUTHORED_B` (deleted before commit).

- Noticed first: hands 4, faces 4, count 4, exits 3, sound 3, time 3, gear 3, words 3, light 3.
- Habit: counts out loud 4, describes hands first 4, ends on a question 4, and 3 each for names the next step,
  names the street, gives the clock time, reports gear before people, says copy and nothing else, repeats the
  last thing said. "Names the person" is not used (see Decisions, item 1).
- Contradiction pattern: gives advice 4, open about others 4, good at what they avoid 4, fixes for others 4,
  precise with objects 3, tidy kit 3, keeps things 3, careful here 3 (the 1 in 10 cap holds), loud off duty 2.
- Home district: pike 8, larkin 7, harbor 5, eastgate 5, oldmill 5.
- Page 3 kind: rescue, mentored, injured, first_call, favorable_under_pressure and negotiated, 5 each.
  person_lost is not used, because its Layer 3 line needs a human reviewer.
- Length: short 15, medium 15.
- openToRelationship: 15 true, 15 false, set per person from the sheet, never from the identity fields. By set:
  she 8 open and 5 closed, he 5 open and 8 closed, they 2 open and 2 closed.
- Tie kinds: two per officer from gym, neighbor, school, family_friend and old_job. No church.

## The record

```
Officer story record: jackets batch B
- Scope: answered | person_009 to person_038, 30 officers, 210 strings (5 profile strings plus 2 page strings each)
- Schema: answered | fields used personaId, page1 (pressureLine, contradiction, pattern, markers, radio), page2, page3, openToRelationship, tieKinds | design only none | requests none
- Predicate counts: not done | no arc or scoped trait written; this lane is jacket pages only
- Seat: answered | 30 identity lines read against 5 roles and 6 traits plus none by the test's role and trait word check and by eye, role variants 0, implausible role beats 0
- Calendar: answered | no age, years, rank or first call claimed in any line, time claims 0
- Identity separation: answered | culture, appearance and pronoun set were never used to choose a hobby reading, marker, pattern, district, tie or openness; temperament, skill, trait or backstory from identity 0
- Profiles: answered | 30, markers shown in Ready sample 30 of 30, copied markers 0 (every marker grows from the persona's own hobby, grewFrom field), contradiction patterns spread as tallied above
- Origins and changes: not done | no trait change, origin line or earned trait in a jacket
- Arc shape: not done | arcs are outside a jacket
- Fork: not done | outside a jacket
- Restraint: answered | costs for waiting, talking or holding fire 0
- Civilian outcomes on cited calls: not done | no call is cited; page 3 lines open only on a recorded fact of their kind
- Ledger: answered | 30 page 3 lines, each keyed to one of six ledger kinds, branches on a callback 0, person_lost used 0
- Nicknames: not done | outside a jacket
- Repeats: answered | stock closer repeats per officer 0, three-word repeats per officer 0 after edits, batch three-word repeats only the shared frame "Since {place}, he/she/they" (30 of 30, the page 3 slot) plus "she keeps a" 3 and "she carries a" 3 in page 2 openers; four-word runs across officers 0
- Spread and collisions: answered | tally above, pronoun sets she/he/they all passed (no he, him, his in a she line, no she, her in a he line, no gendered pronoun in a they line), roster surnames in casts 0 (no civilian is named; the street names Orchard Road, Alder Street, Ash Road, Ash Court are authored place names, flagged below for a collision check), routed to human 0
- Lines: answered | dashes 0, colons 0 outside clock times (radio only), word order hits 0, over budget 0 (pressure 18 words, contradiction 12, Ready radio 10, Overloaded 4)
- Prose lint: answered | the game string checker, run with --lint-source src/gen/incident/gates/prose-lint.ts, hits 0 on unsafe, method, accusation, settled, meta and engine words after fixes (the engine-word and word-choice hits on roll, leaning and flat were rewritten); the remaining output is over-target (34, the checker's 15 word call target, where an officer pressure line has its own 18 word budget), ngram (20, each the same radio sample at Ready and Strained) and apostrophe (13, see Decisions item 3)
- Tells checked: answered | voice-check.py ran with the joined allow list (its list, game-allow-words.txt and the 60 persona name words); banned tics none, stock phrases none, filler adverbs none, em dashes 0, rule-of-three 0, negate-then-correct 1 (the radio line "Not moving." after a hands status, kept)
- Tests: answered | npx tsc --noEmit -p . exit 0; npx vitest run src/content/people 16 passed and 3 failed (the 3 are impossible at 38 jackets, listed below)
- Handoff: swat-writing-review | requests none | callback intents passed to swat-call-prose 0
```

## Test results at 38 jackets

`npx vitest run src/content/people`: 16 passed, 3 failed. All three failures are checks written for the eight
starting officers, and none can hold across 100 officers. I did not touch the test.

1. "cover the eight starting officers and nobody else" expects exactly the eight persona ids with a
   `legacyOfficerId`. With batches B, C and D it expects 100.
2. "give each officer different markers, a different contradiction pattern and a different radio voice" asserts
   one distinct `noticesFirst`, one distinct pattern and one distinct habit per jacket. There are 9 noticed-first
   values, 9 patterns and 9 habits wired into the type, so uniqueness fails at the first assertion (9 distinct of
   38). The brief already releases this one. Its ready-line uniqueness assert (no two officers share a Ready
   sample) does hold: I checked it across the 30 in a throwaway run, and no Ready line repeats.
3. "give every starter a second and third page, each with a home district" asserts exactly three jackets at pike.
   Batch B has eight, so the count is a per roster rule; it should be rewritten as "every district has at least
   one home officer" (true for B alone).

I also ran the test's own checks for the rest of its list against only my 30, in a throwaway test file that is
not committed. All pass: dash and colon rule, banned words, prose lint word lists, no because clause, pressure
line pronoun opener and 18 word cap, 12 word contradiction cap, no role or trait or service word in an identity
line, pronoun set, radio grammar and per habit and per noticed-first pattern checks, and short at 7 words or
fewer and medium at 8 to 10.

One more note on the existing test: "keep the hobby the catalog already has" only carries stems for the eight
starters, so it does not test batch B. I checked the hobby by eye against each `personalNote` (the sheet above
names the hobby kept).

## Decisions for the owner

1. **"Names the person" is unused.** Its radio sample needs a name bound from a call's cast, and a static
   sample cannot carry one without risking a roster name. Nine of the ten approved habits appear in the batch.
2. **Radio samples under the test's regexes.** The test's gear category only matches handset, shield, bag or
   radio, its exits category does not match a plural "exits", and its names-the-street habit needs Street, Road
   or Avenue. I wrote to those patterns. Tesfaye's exits sample reads "Three ways out, one door chained." for
   that reason.
3. **Straight apostrophes.** The string checker wants curly apostrophes in call data. `jackets.ts` and the people
   test both use straight ones (the repeat habit test even depends on a straight quote), so batch B matches the
   existing file. Thirteen strings carry one.
4. **Place names in radio samples.** Orchard Road (person_012), Alder Street (019), Ash Road and Ash Court (030)
   are invented for the radio samples. I did not check them against the generated place pool or the call
   locations, so a collision is possible.
5. **Four hands officers.** Ellis, Boateng, Otieno and Perera all notice hands and three describe hands first.
   Their pressure lines and Ready samples differ (hands before faces, a grip on a chair arm, the shape a hand is
   making, what a hand carries), but a squad with two of them will sound alike on the radio.

## Personas I could not do as well as the others

- **person_034 Imran Rahman** (mechanical toys). The strongest sound line, an unwinding spring, is already
  Vale's clock line, so I moved Rahman to a door spring in a hallway. It works but is the plainest in the batch.
- **person_025 Asha Mwangi, person_029 Nuru Mfinanga and person_037 Anika Shrestha** all carry "repeats the last
  thing said". That habit's Ready sample always has the shape "X said 'Y.' Y." (the test's regex requires it), so
  the three radio lines share a frame. They differ in words and scene, and no four word run repeats, but the
  frame itself cannot vary under the test.
- **person_028 Dawit Bekele** (long train playlists) and person_013 Samira Haddad (soundtrack timing) both read
  time. Haddad logs when things happen, Bekele how long until the next stop, and their samples differ, but the
  two hobbies sit close together.

## Not done

Layer 2 and Layer 3 sits as page 2 and page 3 here, so no separate layer text exists. No arcs, forks,
nicknames, callbacks, pair beats, exit lines or strain text were written. Those belong to other lanes.
