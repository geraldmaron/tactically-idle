# Representation checks

Rules and runnable checks for officer text. swat-writing-review reads officer text against this
file. Every script uses only the Python standard library, runs from the repo root, and writes dash
characters by code point so no literal dash enters this file. If python3 is missing, say so, do
the check by eye from the rule above each script, and record "not run" with the reason.

Paths were read on 2026-10-06. If the persona catalog moved, search for `personalNote`. If the
civilian name pools moved, search for `SCENARIO_SURNAMES`.

## 1. Rules

1. Culture, appearance and pronouns never set temperament, skill, trait odds or backstory. The
   persona type says so in a code comment, and a persona test checks that builds ignore them.
2. Specific beats general. A grandmother's recipes in pencil belong to one person. A national or
   ethnic trait belongs to a stereotype.
3. Faith, family, disability and sexuality may be specifics an officer owns. They are never a
   punchline, never a cause of weakness and never the reason an arc goes badly.
4. No phonetic accents in any line. Cadence lives in word choice.
5. Pressure spreads evenly. No officer carries loss, fear or injury lines far above the roster's
   median, and no group, read from the culture field during audit only, carries them either.
6. Names print as authored, diacritics included.
7. Strain is a job injury, recoverable and supported, and is written with dignity.
8. Lines that touch culture, faith, disability or sexuality go to a human reviewer before they
   ship.

The audit reads identity fields. Writing never does.

## 2. Spread tally

Tag every officer line that carries loss, fear, injury or strain. Then tally per officer and per
culture field. Flag any officer above twice the median, and any culture group whose share of these
lines exceeds its share of the roster by more than half again.

```
Spread tally: DRAFT until reviewed
| Persona id | Lines total | Loss | Fear | Injury | Strain | Flag |
|---|---|---|---|---|---|---|
| <id> | <n> | <n> | <n> | <n> | <n> | <none | above 2x median | group skew> |
Median heavy lines per officer: <n>
Groups checked: <n>, skew flags <n>
```

```
python3 - <<'PY'
import json, statistics, collections
tags = json.load(open('officer-line-tags.json'))   # {"person_002": {"loss": 0, "fear": 1, "injury": 0, "strain": 1}, ...}
people = {p['id']: p for p in json.load(open('src/content/personas.json'))}
heavy = {pid: sum(t.values()) for pid, t in tags.items()}
med = statistics.median(heavy.values()) if heavy else 0
for pid, n in sorted(heavy.items(), key=lambda kv: -kv[1]):
    if med and n > 2 * med: print('above 2x median', pid, n)
by_group = collections.Counter(); roster = collections.Counter()
for pid in tags:
    g = people[pid]['culture'].split(';')[0]
    roster[g] += 1; by_group[g] += heavy[pid]
total_lines, total_people = sum(by_group.values()) or 1, sum(roster.values())
for g in roster:
    if by_group[g] / total_lines > 1.5 * roster[g] / total_people and by_group[g] >= 3:
        print('group skew', g, by_group[g], 'of', total_lines)
PY
```

## 3. Pronoun agreement

Bind every template to one persona from each pronoun set and read the result. The script flags the
common breaks, a they with a singular verb and a she or he with a plural one.

```
python3 - <<'PY'
import re
templates = [l.strip() for l in open('officer-templates.txt') if l.strip()]
forms = {
  'she':  {'{p}': 'she',  '{P}': 'She',  '{obj}': 'her',  '{pos}': 'her'},
  'he':   {'{p}': 'he',   '{P}': 'He',   '{obj}': 'him',  '{pos}': 'his'},
  'they': {'{p}': 'they', '{P}': 'They', '{obj}': 'them', '{pos}': 'their'},
}
bad_they = re.compile(r'\b[Tt]hey (is|was|has|does|\w+[^s]s)\b')
bad_one = re.compile(r'\b(She|He|she|he) (are|were|have|do)\b')
for t in templates:
    for setname, f in forms.items():
        s = t
        for k, v in f.items(): s = s.replace(k, v)
        if setname == 'they' and bad_they.search(s): print('they agreement', s)
        if setname != 'they' and bad_one.search(s): print(setname, 'agreement', s)
PY
```

The regex catches the usual slips, not all of them, and it can flag a plural verb that happens to
end in s, such as "focus". Read every bound line in the they set by eye. Prefer the surname as
subject, which needs no agreement at all.

## 4. Diacritics

Ten personas carry diacritics as read. Any export that drops them is a bug.

```
python3 - <<'PY'
import json, unicodedata
names = [p['firstName'] + ' ' + p['surname'] for p in json.load(open('src/content/personas.json'))]
marked = [n for n in names if any(ord(c) > 127 for c in n)]
print(len(marked), marked)
text = open('officer-strings.txt', encoding='utf-8').read()
for n in marked:
    plain = ''.join(c for c in unicodedata.normalize('NFD', n) if not unicodedata.combining(c))
    if plain in text and n not in text: print('stripped diacritic', n)
PY
```

## 5. Persona note check

Runs over the catalog after any rewrite of `personalNote`. The persona test enforces the pronoun
opener. Everything else here is enforced only by running this.

```
python3 - <<'PY'
import json, re
virtue = re.compile(r'\b(brave|fearless|dedicated|tireless|heroic|selfless|loyal|by the book|natural leader)\b', re.I)
seat = re.compile(r'\b(years?|veteran|rookie|seasoned|first call|sergeant|breacher|medic|negotiator|sniper)\b', re.I)
for p in json.load(open('src/content/personas.json')):
    n, bad = p['personalNote'], []
    if not re.match(r'(She|He|They) ', n): bad.append('pronoun opener')
    if len(n.split()) > 18: bad.append('over 18 words')
    if n.split()[1] in ('enjoys', 'enjoy', 'likes'): bad.append('hobby-card opener')
    if re.search('[\u2013\u2014:;]', n): bad.append('dash, colon or semicolon')
    if virtue.search(n): bad.append('virtue word')
    if seat.search(n): bad.append('time, rank or role claim')
    if bad: print(p['id'], ', '.join(bad))
PY
```

On the catalog as read, the hobby-card opener check alone flags 37 notes (27 "enjoys", 3 "enjoy",
7 "likes"). That count is the size of the rewrite, not a failure of the people who wrote them.

## 6. Dash, colon and phrase repeat count

Export each string exactly as it renders, prefixes included. If the UI prints a name before the
detail, the export prints it too, so the count here matches what the player reads. Paste the
script output verbatim into the officer record, and use the same numbers in any checks table.

```
python3 - <<'PY'
import re
text = open('officer-strings.txt', encoding='utf-8').read()
dashes = re.findall('[–—]|(?<=\\w) - (?=\\w)', text)
colons = [l for l in text.splitlines() if re.search(r':(?!\d\d)', l)]
print('dashes', len(dashes))
print('lines with a colon outside a clock time', len(colons))
for l in colons: print('  ', l[:100])
PY
```

A colon is allowed only in a string the engine already builds with one, such as the contributor
label `Hale: steady, less strain while facts are open` or the decision log. The UI has no speaker
format, so every other colon is a finding.

Phrase repeats. officer-strings.txt groups strings under a `# person_id` heading per officer. The
script flags any three-word phrase that appears in two surfaces for one officer, any phrase in the
lines of more than 1 officer in 20, and any stock closer used more than once per officer. Names and
places will show up as repeats, so list those as kept.

```
python3 - <<'PY'
import re, collections
STOCK = ['everyone walked out', 'everyone went home', 'nobody got hurt', 'walked out',
         'let me do the talking', "i'm not going anywhere", 'take your time', 'got your back']
groups, cur = collections.defaultdict(list), None
for line in open('officer-strings.txt', encoding='utf-8'):
    line = line.strip()
    if line.startswith('# '): cur = line[2:]; continue
    if line and cur: groups[cur].append(line)
def grams(t):
    w = re.findall(r"[a-z']+", t.lower())
    return {' '.join(w[i:i+3]) for i in range(len(w) - 2)}
across = collections.Counter()
for pid, lines in groups.items():
    seen = collections.Counter()
    for l in lines:
        for g in grams(l): seen[g] += 1
    for g, n in seen.items():
        if n > 1: print('officer repeat', pid, n, g)
    for g in seen: across[g] += 1
    low = ' '.join(lines).lower()
    for st in STOCK:
        if low.count(st) > 1: print('stock closer', pid, low.count(st), st)
limit = max(1, len(groups) // 20)
for g, n in across.most_common():
    if n > limit: print('batch repeat', n, 'officers', g)
PY
```

Prose lint words. Every string that can render on a call surface (a callback, an in-call line, a
debrief line) runs through the prose lint's patterns. Use the game string checker that
swat-call-prose keeps in its references/string-checks.md, run with `--lint-source` pointed at
src/gen/incident/gates/prose-lint.ts. It reads UNSAFE_DETAIL, ACCUSATION, SETTLED and
META_PHRASING from the live file, exported or not. Record every hit. A hit is an owner decision
("wounded" in an injury exit line, for example), never a silent rewrite.

Word order and antecedents. This flags the three failing shapes in profile-patterns.md section 2
and any sentence whose first word is a bare "it". It is a net with false positives, so read every
hit and record each as fixed or kept, with the reason for a kept hit on the sheet.

```
python3 - <<'PY'
import re
INV = re.compile(r"^(Out|In|Inside|Down|Up|Off|Back|Away) (comes|goes|walks|steps|runs|go|come)\b")
FRONT = re.compile(r"^(Folded|Held|Kept|Left|Set|Unread|Unhurt|Upright|Quiet|Short|Angry|Calm|Gone)\b[^.?!]{0,40},")
LY_ED = re.compile(r"^[A-Z][a-z]+(ed|en|ly)( and [a-z]+)?, [A-Z]")
for line in open('officer-strings.txt', encoding='utf-8'):
    l = line.strip()
    if not l or l.startswith('# '): continue
    for s in re.split(r'(?<=[.?!])\s+', l):
        if INV.match(s): print('inversion |', s)
        elif FRONT.match(s) or LY_ED.match(s): print('fronted |', s)
        if re.match(r"(It|It's|Its) ", s): print('bare it |', s)
PY
```

## 7. Name collisions

As read on 2026-10-06, the civilian surname pool holds the same 100 surnames as the persona
catalog, and 98 civilian first names all come from it too. The cast draw does not exclude anyone
on the roster. So a civilian can share a deployed officer's surname on the same call.

```
python3 - <<'PY'
import json, re
roster = {p['surname'] for p in json.load(open('src/content/personas.json'))}
src = open('src/content/scenario-names.ts', encoding='utf-8').read()
pool = set(re.findall(r'"([^"]+)"', src[src.index('SCENARIO_SURNAMES'):]))
print('roster surnames also in the civilian pool', len(roster & pool), 'of', len(roster))
PY
```

For a review batch, list each call's bound civilian names and its deployed squads, then flag any
match.

```
Collision log
| Call and seed | Civilian full name | Deployed officer with that surname | Route |
|---|---|---|---|
| <type, seed> | <name> | <officer> | engineering request R9 |
```

The writing fix is to name civilians by role in every officer line. The real fix is the R9 request
in officer-data-proposal.md.

## 8. Contradiction diff

List the batch's contradictions one per line in contradictions.txt and diff them against the
pattern table in profile-patterns.md section 4. The script flags a shared word with an example row
and any two officers whose contradictions open with the same two words. Read every flag by eye.

```
python3 - <<'PY'
import re
src = open('.agents/skills/swat-officer-stories/references/profile-patterns.md', encoding='utf-8').read()
table = src.split('## 4.')[1].split('## 5.')[0]
rows = [r.split('|')[2].strip() for r in table.splitlines() if r.startswith('| ') and r.count('|') == 3][1:]
lines = [l.strip() for l in open('contradictions.txt', encoding='utf-8') if l.strip()]
words = lambda t: set(re.findall(r"[a-z']{4,}", t.lower()))
for l in lines:
    if re.search(r"\b(loses|forgets|misplaces)\b.*\b(daily|weekly|keys|cup|phone|car|parked)\b", l, re.I):
        print('worn frame', l)
    for r in rows:
        if words(l) & words(r): print('shares', sorted(words(l) & words(r)), 'with', r)
heads = {}
for l in lines: heads.setdefault(' '.join(l.lower().split()[:2]), []).append(l)
for h, ls in heads.items():
    if len(ls) > 1: print('shared frame', h, ls)
PY
```

If the skill folder moved, point the script at wherever profile-patterns.md now lives.

## 9. Spelling by hand

Persona notes are not read by the prose lint, which covers typed call packages only. Spell-check
them by hand against American spelling. As read, the notes for person_070 and person_090 say
"cataloguing", which American spelling writes as "cataloging".

## 10. Human review routing

A line goes to a human reviewer when it touches culture, faith, disability or sexuality, when it
is built on a person_lost entry, or when a contradiction or layer line refers to family. The
reviewer is a person, not another pass of the same model. Record it.

```
Human review: <n> lines routed | reviewer <name or role> | verdict <approve | edit | reject> | date <date>
```

If no human reviewer is available, the line does not ship. Say so in the officer record.
