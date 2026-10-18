# Batch audit

One player sees one call. The batch shows the sentence in ten calls, the surname on a
civilian and an officer in the same call, and the shift with two crisis calls. Run it for any
review of several calls or generated variants. Every threshold is a house target to tune in playtest,
never a research finding, and every count states its sample size.

## 1. Collect the batch

1. Look for an exporter first, in package.json and the scripts folder. `npm run check:strings`
   (scripts/check-strings.ts) builds every call's string rows with `callStringRows` in
   src/gen/incident/trees-v13/strings.ts and checks them one call at a time, but it writes no
   batch file, so it cannot find a sentence repeated across calls.
2. For a cross-call file, collect from the Scenario Lab's Script surface (`/lab?type=<type>&tab=script`,
   docs/scenario-lab.md). For each type, read each situation at two or more building seeds and
   both pacings, step the cast carousel, copy the column text and tag each string with its field.
   Script's line inspector shows each line's field path (such as
   `offer.take_courier.preview.mixed`), which makes a good tag.
3. Keep any collector script in scratch space and never commit it without the owner's say. If it
   proves useful, file an engineering request for a real strings export.
4. If you cannot collect two situations for every type, say so and put the sample size in every row.

## 2. Export format

One file per batch. A heading line per call, then one string per paragraph as field, a spaced
pipe and the text. The counters below parse exactly this.

```
# batch <scope> <date>

## call type=<type> situation=<n> seed=<s> pacing=<p> family=<building family> cast=<Full Name>;<Full Name> roster=<Surname>,<Surname>

card.title | <text>

card.summary | <text>

briefing.known[0] | <text>

adapt.act_on_report.summary | <text>

endings.acted_on_report.summary | <text>
```

`roster` lists the officers the player could see on that call. For the written-voice checker,
strip the tags into a plain .txt copy, one string per paragraph. Never feed it a .ts file.

## 3. Repeats, openers, near-synonyms, dashes and roster surnames

Save as batch_counts.py and run `python3 batch_counts.py batch.md`. A repeat counts distinct type
and field places, because pre-check text must repeat across one type's situations. Dashes are
matched by code point, so the script holds no literal dash.

```python
import collections, difflib, re, sys

HEADER = re.compile(r"^## call (.*)$")
PAIR = re.compile(r"(\w+)=(.*?)(?=\s\w+=|$)")
SENT = re.compile(r"(?<=[.!?])\s+")
DASHES = {chr(0x2014): "em dash", chr(0x2013): "en dash"}
QUOTES = chr(0x2019) + "'\""

def load(path):
    calls, meta = [], None
    for para in open(path, encoding="utf-8").read().split("\n\n"):
        para = para.strip()
        m = HEADER.match(para)
        if m:
            meta = dict(PAIR.findall(m.group(1)))
            meta["strings"] = []
            calls.append(meta)
        elif meta is not None and " | " in para:
            field, text = para.split(" | ", 1)
            meta["strings"].append((field.strip(), " ".join(text.split())))
    return calls

def names(meta, key):
    return [n.strip() for n in re.split(r"[;,]", meta.get(key, "")) if n.strip()]

def normalize(text, meta):
    for full in names(meta, "cast"):
        for part in [full] + full.split():
            text = re.sub(r"\b%s\b" % re.escape(part), "<name>", text)
    return text

calls = load(sys.argv[1])
sentences = []
for meta in calls:
    for field, text in meta["strings"]:
        for s in SENT.split(text):
            if s.strip():
                sentences.append((meta.get("type", "?"), field, normalize(s.strip(), meta)))
n_strings = sum(len(m["strings"]) for m in calls)
print(f"sample {len(calls)} calls, {n_strings} strings, {len(sentences)} sentences")

# A use is one distinct (type, field) place. Pre-check text must repeat across
# the situations of one type, so those repeats never count twice.
places, types = collections.defaultdict(set), collections.defaultdict(set)
for t, f, s in sentences:
    if len(s.split()) >= 4:
        places[s].add((t, f))
        types[s].add(t)
print("\n-- repeated sentences, 4+ words in 3+ places --")
for s, where in sorted(places.items(), key=lambda kv: -len(kv[1])):
    if len(where) < 3:
        break
    echo = " TEMPLATE ECHO" if len(types[s]) > 1 else ""
    print(f"{len(where)} places in {len(types[s])} type(s){echo} | {s}")

print("\n-- the same string in two fields of one call --")
for meta in calls:
    by_text = collections.defaultdict(list)
    for field, text in meta["strings"]:
        by_text[text].append(field)
    for text, fields in by_text.items():
        if len(fields) > 1:
            print(f"{meta.get('type')} s{meta.get('situation')} | {', '.join(fields)}")

print("\n-- openers at or above 3% of distinct sentences --")
unique = sorted(set(sentences))
first = collections.Counter(s.split()[0].lower().strip(QUOTES) for _, _, s in unique)
for w, n in first.most_common():
    if n < 3 or n / len(unique) < 0.03:
        break
    print(f"{w} {n} ({100 * n / len(unique):.0f}%)")

print("\n-- phrases of 3+ words repeated across strings of one call or path block --")
STOP = {"the", "a", "an", "and", "of", "to", "in", "on", "at", "is", "it", "his", "her", "their", "<name>"}
for meta in calls:
    seen = collections.defaultdict(set)
    for i, (field, text) in enumerate(meta["strings"]):
        toks = [w.strip(".,!?" + QUOTES).lower() for w in normalize(text, meta).split()]
        for j in range(len(toks) - 2):
            gram = tuple(toks[j:j + 3])
            if sum(w not in STOP for w in gram) >= 2:
                seen[" ".join(gram)].add(i)
    for gram, where in sorted(seen.items()):
        if len(where) > 1:
            print(f"{meta.get('type')} s{meta.get('situation')} {meta.get('path', '')} | {len(where)} strings | {gram}")

print("\n-- near-synonym pairs, 6+ words, ratio 0.85 or more, not identical --")
distinct = sorted({s for _, _, s in sentences if len(s.split()) >= 6})
buckets = collections.defaultdict(list)
for s in distinct:
    buckets[len(s.split()) // 3].append(s)
pairs = 0
for key, group in buckets.items():
    pool = group + buckets.get(key + 1, [])
    for i, a in enumerate(group):
        for b in pool[i + 1:]:
            r = difflib.SequenceMatcher(None, a.lower().split(), b.lower().split()).ratio()
            if r >= 0.85:
                pairs += 1
                print(f"{r:.2f} | {a} | {b}")
print(f"pairs {pairs}")

print("\n-- dashes, colons and roster surnames in game text --")
for meta in calls:
    for field, text in meta["strings"]:
        hits = [label for ch, label in DASHES.items() if ch in text]
        hits += ["spaced hyphen"] if re.search(r"\w - \w", text) else []
        hits += ["colon outside a clock time"] if re.search(r"(?<!\d):|:(?!\d)", text) else []
        hits += ["roster surname " + s for s in names(meta, "roster") if re.search(r"\b%s\b" % re.escape(s), text)]
        if hits:
            print(f"{meta.get('type')} s{meta.get('situation')} seed {meta.get('seed')} {field} | {', '.join(hits)}")
```

How to read it. A count over target cannot be downgraded to a note by the author of the strings,
whatever the reason given ("the name tells the player who acted"). Only a separate reader can
downgrade it, and the finding row names that reader. Observed in a proof draft on 2026-10-06. The
subject's name opened 88 of 332 sentences, and the author filed it as a kept note.

The fix for an over-used name opener is never to turn the sentence around. Write the finding's
fix as data that hands the sentence to another person or object on scene (the negotiator, the
phone, the door), and leave plain subject, verb, object sentences alone. Observed on 2026-10-07.
A round-two draft answered this count with more than 30 inverted and fronted sentences ("Out
comes Ben", "Unhurt, Lewis is outside"), which read as a machine within two taps. Run the G15
count after any opener fix, and treat a rise as a new finding.

To scope the phrase counter to one path, export that path's strings in play order as their own
block and add `path=P<n>` to its heading line.

| Section | House target | Finding when over |
| --- | --- | --- |
| Repeated sentences | 0 flavor sentences in 3+ places | fix before ship, route swat-call-prose, or engineering when the sentence is compiler-owned |
| TEMPLATE ECHO | 0 | fix before ship. One sentence across types means a template carries flavor |
| Same string in two fields | 0, except fields the compiler copies by design | note to engineering when the compiler copies, line finding otherwise |
| Phrases of 3+ words in 2+ strings of one path | 0 outside fixed formats and names | fix before ship, route swat-call-prose |
| Openers at 3% or more | none in narration | fix before ship, route swat-call-prose. A common opener points to a template or a subject name doing every sentence's work |
| Inverted or fronted openers (pattern G15) | 0 locative inversions, at most 2 fronted modifiers per path | fix before ship, route swat-call-prose. Count with the cliche runner. A rise here after an opener fix means the opener was fixed the wrong way |
| Near-synonym pairs | 0 across situations or types | fix before ship. Variants should differ by fact, not synonym |
| Dashes, colons, roster surnames | 0 dashes, colons only in clock times and stat rows, 0 surnames | G9 fixes are fix before ship. A surname is a block when that officer is on the call |

Observed on 2026-10-06 in the retired typed calls, as dated evidence. The waitFor sentence "It
takes much longer, but it does not depend on the next step going right." sat in 10 places across
10 types in the v12 depth layer. The act-on-report wrong text for false_intruder carried a colon.
Typed calls filled the card and the first known line from the same `opening` field. Call trees
write each of these themselves, so the same checks now find a repeat the writer made.

Also run the per-call checks in ../swat-call-prose/references/string-checks.md. If that file is
missing, this script stands in, and stock phrases are checked by eye against cliche-and-copaganda.md.

## 4. Name hygiene

Save as names_check.py and run `python3 names_check.py batch.md <repo root>`. It reports the pool
overlap and any pool first name used in a string where that name is not in the call's cast. Read
each hit, since some first names are also common words.

```python
import json, re, sys

export, repo = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else ".")
src = open(f"{repo}/src/content/call-trees/civilian-names.ts", encoding="utf-8").read()
end = src.index("export const CIVILIAN_SURNAMES")
head = src[:end]
pool_first = set(re.findall(r"'([^']+)'", head[head.index("export const CIVILIAN_FIRST_NAMES"):]))
tail = src[end:]
pool_sur = set(re.findall(r"'([^']+)'", tail[:tail.index("];")]))
roster = json.load(open(f"{repo}/src/content/personas.json", encoding="utf-8"))
roster_sur = {p["surname"] for p in roster}
print(f"pool first names {len(pool_first)}, pool surnames {len(pool_sur)}, "
      f"roster surnames {len(roster_sur)}, roster surnames also in the pool {len(roster_sur & pool_sur)}")

HEADER = re.compile(r"^## call (.*)$")
PAIR = re.compile(r"(\w+)=(.*?)(?=\s\w+=|$)")
WORD = re.compile(r"\b[^\W\d_]{2,}\b")
meta, cast_first = None, set()
for para in open(export, encoding="utf-8").read().split("\n\n"):
    para = para.strip()
    m = HEADER.match(para)
    if m:
        meta = dict(PAIR.findall(m.group(1)))
        cast_first = {n.split()[0] for n in re.split(r"[;,]", meta.get("cast", "")) if n.strip()}
        continue
    if meta is None or " | " not in para:
        continue
    field, text = para.split(" | ", 1)
    for word in sorted(set(WORD.findall(text))):
        if word[0].isupper() and word in pool_first and word not in cast_first:
            print(f"pool first name outside the cast | {meta.get('type')} s{meta.get('situation')} {field} | {word}")
```

Since 2026-10-17 the civilian pools in src/content/call-trees/civilian-names.ts are disjoint from
the officer catalog, and a test in src/gen/incident/trees-v13/call-trees.test.ts ("share no first
name or surname with any officer") holds them apart. The script's first line should therefore
report 0 roster surnames in the pool. A nonzero count means the gate was bypassed. (On 2026-10-06
the retired scenario pool held all 100 roster surnames.)

Also check by reading. Cast names that are common words ("Grant", "Rose", "Will") break binding
when a sentence opens with that word, because binding replaces whole capitalized words. Pronouns
match the cast slot in every string. Names print as authored, diacritics included.

## 5. Identity-by-role skew

Two tallies, both mechanical, both run before anything goes to a human. A person reads the lines
and the counts afterward. "A human should read a sample" never replaces a count you could run.

**Stated identity.** Tally only what a string states (pronoun set, age, a stated condition or
disability, a stated faith or culture, an accent or language mention) and the building or setting
type, which stands in for the "dangerous neighborhood" pattern.

```
Skew tally <scope>, sample <n> calls (judge only at 30 or more)
| Attribute stated in text | Caller | Subject | Victim or harmed | Blamed or accused | Helper | All roles | Share of blamed vs all |
| <pronoun set, one row each> | | | | | | | |
| <age band, stated condition, stated faith or culture> | | | | | | | |
| setting <building type> | | | | | | | |
```

**Pronoun draw by role.** Call-tree names are drawn by pronoun set only, from pools that carry no
persona background (civilian-names.ts says identity never determines a role, danger, cooperation
or any score). The retired cast code drew names from the persona catalog, so a name signaled a
background, and the tally it needed (5 groups over twice their expected count in the hostage
subject slot on 2026-10-06) no longer applies. What can still skew is the pronoun draw per role.
Draw at least 300 calls per type before judging a role.

Step 1, draw. The cast draw is `drawInstance` in src/gen/incident/instance.ts, reached through
`generateIncident` and `instanceOf` (search the symbols if they moved). Save this in scratch space
outside the repo as cast-draw.ts, replace `<repo>` with the repo root, run
`bun cast-draw.ts | grep '^DRAW' > draws.txt` from the repo root, and never commit it. Change
`type` for each call in scope.

```ts
import { buildLocation } from '<repo>/src/sim/location';
import { drawIncidentSpec, generateIncident } from '<repo>/src/gen/incident/index';
import { instanceOf } from '<repo>/src/gen/incident/instance';

const type = 'hostage_crisis', calls = 300;
let state = 1;
for (let i = 0; i < calls; i++) {
  const drawn = drawIncidentSpec(state, { level: 10, trust: 90, unlockedTypes: [type as never] });
  state = drawn.state;
  const s = generateIncident(drawn.spec);
  const instance = instanceOf(s, buildLocation(s.locationFamilyId, s.locationSeed))!;
  for (const p of instance.people.filter(entry => entry.roleKey && entry.name))
    console.log(`DRAW ${type} ${p.roleKey} ${p.pronouns} ${i} | ${p.name!.first} ${p.name!.surname}`);
}
```

Step 2, tally. Save as role_skew.py and run `python3 role_skew.py draws.txt`. It compares each
role's pronoun counts with the share that pronoun set has across all roles of the type, and
prints OVER 2x where a count is above twice its expectation (judged only when 5 or more were
expected). Counted-role members (others_1, others_2) are pooled.

```python
import collections, re, sys

LINE = re.compile(r"^DRAW (\S+) (\S+) (\S+) (\d+) \| (.+)$")
by_role, overall = collections.defaultdict(collections.Counter), collections.Counter()
for line in open(sys.argv[1], encoding="utf-8"):
    m = LINE.match(line.strip())
    if not m:
        continue
    kind, role, pron, _seed, _name = m.groups()
    by_role[f"{kind} {re.sub(r'_[0-9]+$', '', role)}"][pron] += 1
    overall[pron] += 1
total = sum(overall.values())
for role, counts in sorted(by_role.items()):
    n = sum(counts.values())
    for pron, seen in counts.items():
        expected = overall[pron] / total * n
        flag = "OVER 2x" if expected >= 5 and seen > 2 * expected else "ok"
        print(f"{flag} | {role} | {pron} | {seen} seen, {expected:.1f} expected from all roles | {n} draws")
```

Observed on 2026-10-18 for hostage_crisis, 300 calls, 1081 draws: every role within its
expected share, no OVER 2x line.

If you cannot run the draw, say so and record "tally not run | <reason>" in the Ethics line.

House target. No group's share in an armed, blamed or harmed slot runs above twice its expected
share. Over target goes to a human reviewer with route owner, to swat-call-design for the cast
plan, and to engineering when the draw itself is skewed.

## 6. Crisis frequency

A crisis call is one where a person may harm themselves. Tag by reading, since no field marks it.

1. If you can play or script several shifts, count crisis calls per shift. House target is at
   most one, never two in one shift.
2. If you cannot, record "not measured" with the reason, count crisis types in scope, and file a
   note asking engineering for a shift sampler.
3. Every crisis call keeps death off the card, with "transported in critical condition" as the
   worst shown outcome, per ../swat-call-design/references/ethics-and-authenticity.md.

## 7. Officer pressure spread

For officer text in scope, tally which personas carry the heavy lines.

```
Pressure spread <scope>, <n> personas, <m> lines
| Persona id | Pronouns | Loss lines | Injury lines | Fear or strain lines | Total | Ratio to mean |
```

House target. No persona above twice the mean, and no pronoun set or stated culture carrying more
of the heavy lines than its roster share. Over target routes to swat-officer-stories.

## 8. Spelling and hobby notes in unlinted data

Persona notes are not linted. Save as persona_notes.py and run `python3 persona_notes.py <repo root>`.
It flags British forms from the game's own spelling lists and notes whose verb is "enjoys", and
writes persona-notes.txt for the written-voice checker's unknown-word pass.

```python
import json, re, sys

repo = sys.argv[1] if len(sys.argv) > 1 else "."
people = json.load(open(f"{repo}/src/content/personas.json", encoding="utf-8"))
bridge = open(f"{repo}/src/content/american-english.ts", encoding="utf-8").read()
british = {k for k in re.findall(r'"([^"]+)":', bridge) if k.islower()}
lint = open(f"{repo}/src/gen/incident/gates/prose-lint.ts", encoding="utf-8").read()
extra = re.search(r"EXTRA_BRITISH = \[(.*?)\]", lint, re.S)
if extra:
    british |= set(re.findall(r"'([^']+)'", extra.group(1)))

flagged = 0
with open("persona-notes.txt", "w", encoding="utf-8") as out:
    for p in people:
        note = p.get("personalNote", "")
        out.write(note + "\n\n")
        words = note.split()
        flags = sorted(w for w in british if re.search(r"\b%s\b" % re.escape(w), note, re.I))
        flags = ["British form " + ", ".join(flags)] if flags else []
        if len(words) > 1 and words[1].lower() == "enjoys":
            flags.append("hobby verb")
        if flags:
            flagged += 1
            print(f"{p['id']} | {'; '.join(flags)} | {note}")
print(f"notes {len(people)}, flagged {flagged}, wrote persona-notes.txt")
```

Observed on 2026-10-06. 27 of 100 notes used "enjoys" as their verb, and one note (person_089)
used "pavement", a form the prose lint lists as British. Both route to swat-officer-stories.
Unknown words from the checker are candidates, not verdicts. A misspelled name is a bug.

## 9. Writing up the audit

Fill this table, with a finding row for every count over target. SKILL.md section 8 points here.

```
Batch audit <scope>, sample <calls> calls and <strings> strings, from <sheet URLs | export file>
| Check | Count | House target | Finding row |
| Sentences of 4+ words used 3+ times | | 0 outside fixed formats | |
| Phrases of 3+ words repeated on one path | | 0 outside fixed formats | |
| Over-used openers | | none above 3% of sentences | |
| Inverted or fronted openers (G15) | | 0 inversions, at most 2 fronted per path | |
| Template echo across types | | 0 flavor sentences | |
| Near-synonym variants | | 0 pairs | |
| Roster surnames in civilian casts | | 0 against the visible roster (the name gate should hold this at 0) | |
| Pool first names outside the cast | | 0 | |
| Identity-by-role skew | | no group over 2x its expected share in armed, blamed or harmed roles | |
| Crisis calls per shift | | at most 1 | |
| Officer pressure spread | | no officer over 2x the mean | |
| Spelling in unlinted data | | 0 | |
| Dashes and colons in game text | | 0 outside fixed formats | |
```

If a counter could not run, say so in that row and the record, and check by eye on a stated
sample.
