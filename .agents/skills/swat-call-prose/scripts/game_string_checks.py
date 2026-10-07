#!/usr/bin/env python3
"""Game string checks for Tactically Idle call prose. Standard library only, Python 3.8+.

This file ships inside the swat-call-prose skill folder, so the skill works on
its own. It carries the tell checks game strings need (cadence, openers,
rule-of-three, stock lexicon) and the game rules no repo lint enforces yet.
The written-voice checker is an optional extra pass, never a substitute.

Usage:
  python3 game_string_checks.py strings.tsv [--lint-source PATH] [--write-txt OUT]
      [--cast NAME ...] [--keep PHRASE ...] [--min-repeat N] [--hand-authored]
      [--call-nouns WORD ...] [--bind "Authored Name=Longest Pool Name" ...]

Required TSV columns: situation, where, surface, text.
Optional columns: stage, action, band, path, locked.
See references/string-checks.md for what each column holds and how to read the output.
"""
import argparse
import collections
import csv
import re
import statistics
import sys

# surface: (hard limit in characters or None, house target in words or None, pre-check?)
BUDGETS = {
    "title": (34, 3, True), "hook": (None, None, True), "dispatch": (240, 35, True),
    "known": (260, 12, True), "unknown": (260, 12, True), "team_job": (260, 10, True),
    "fact_label": (40, 5, True), "fact_claim": (None, 20, True), "fact_note": (None, 12, True),
    "fact_source": (None, 6, True), "fact_result": (None, 20, False), "marker": (10, 1, True),
    "map_task": (12, 3, True), "stage_label": (24, 2, True), "prompt": (120, 18, True),
    "choice_title": (60, 5, True), "summary": (230, 20, True), "preview": (None, 20, True),
    "requirement": (None, 8, True), "modifier": (None, 6, True), "cert_bonus": (None, 6, True),
    "support": (None, 6, True), "equipment": (None, 6, True), "result": (240, 30, False),
    "result_label": (None, 4, False), "officer_harm": (None, 10, False),
    "ending_title": (60, 6, False), "ending_summary": (240, 35, False),
    "still_needed": (None, 8, False), "objective": (None, 8, True),
    "civilian_outcome": (None, 6, False), "radio": (None, 10, False), "speech": (None, 15, False),
    "service": (None, 15, True), "debrief": (None, 10, False), "pressure_label": (None, 4, True),
}
LOCKED_CLAMP = 80
HOOK_CHARS = 130
BANDS = ("favorable", "mixed", "adverse")
DASH_CHARS = "".join(chr(c) for c in (0x2012, 0x2013, 0x2014, 0x2015))
DASHES = re.compile("[" + DASH_CHARS + "]|(?<=\\S) \\x2d (?=\\S)|\\x2d\\x2d")
COLON = re.compile(r"(?<!\d):|:(?!\d)")
OQ, CQ, APOS = chr(0x201C), chr(0x201D), chr(0x2019)
SENT = re.compile(r"(?<=[.?!" + CQ + r"])\s+")
QUOTED = re.compile(OQ + "[^" + CQ + "]*" + CQ)

# Generic machine tells, a game-sized subset of the written-voice catalog.
TELLS = [
    "delve", "underscore", "meticulous", "intricate", "realm", "showcase", "leverage",
    "utilize", "tapestry", "testament", "seamless", "robust", "crucial", "pivotal", "vital",
    "landscape", "interplay", "vibrant", "nestled", "multifaceted", "holistic",
    "moreover", "furthermore", "additionally", "ultimately", "notably", "in essence",
    "quietly", "simply", "truly", "genuinely", "deeply", "incredibly", "profoundly",
]
# Genre and urgency stock, banned in narration.
STOCK = [
    "every minute counts", "every second counts", "time is running out", "eerie", "eerily",
    "palpable", "tension", "ominous", "barely above a whisper", "the weight of", "a sense of",
    "calculated risk", "trust your gut", "trust your instincts", "play it safe", "tango",
    "neutralize", "hostiles", "breach and clear", "heart pounding", "heart racing",
    "dead air", "ring after ring", "then nothing", "stared at the wall", "long shower",
    "a long time afterward",
]
STOCK_RE = re.compile(r"\bsat in the (truck|car|van) (for )?a long time\b", re.I)
# Narrator attitude adverbs and hedges. Results are fact or attributed speech.
NARRATOR_HEDGE = re.compile(r"\b(apparently|of course|naturally|somehow|seemingly|it seems)\b", re.I)
# Mechanics said as mechanics. Say who waits or what does not happen.
MECHANIC = re.compile(r"\b(off the board|costs? (some )?time|takes? longer|extra minutes?)\b", re.I)
# Previews that give the player no picture.
VAGUE_PREVIEW = re.compile(r"\b(something|somewhere else|little or nothing|not all of it|"
                           r"the talk (breaks|goes|turns)|takes? (it|the offer|that) seriously)\b", re.I)
# Process status as the last beat of an ending.
ENDING_STATUS = re.compile(r"\b(goes to review|under review|for review|finally)\b", re.I)
# Bystander metonym. The tape is a place, never a subject.
TAPE_SUBJECT = re.compile(r"\bthe tape (sees|saw|films|filmed|watches|watched|hears|heard|has|had)\b", re.I)
# Slogans in place of a person acting.
APHORISM = re.compile(r"\bno [\w" + "’" + r"' ]{1,20}, just\b|\bevery (minute|second|hour)\b[^.]*\bis an? (minute|second|hour)\b|"
                      r"\bno more waiting\b|\bwaiting on (silence|quiet)\b", re.I)
# Verb-first inversion and moved-predicate fragments, the opener-share dodge.
INVERSION = re.compile(r"^(Out|In|Down|Up|Inside|Back|Away|Off|Over|Gone) (comes|came|goes|went|walks|walked|steps|stepped|drops|dropped|falls|fell)\b")
MOVED_FRAGMENT = re.compile(r"^(Out|In|Down|Up|Inside|Gone|Gone inside|Back|Away)[.]$")
# A fronted clause may open on these words. Anything else before ", <name>" is a fronted modifier.
FRONT_OK = set("""at in on by after before when while if as until from with without through behind outside inside
for since once then now so but and still across under over near past during each every twice""".split())
# A threat carried by a pronoun.
THREAT_IT = re.compile(r"\b(point|points|pointed|pointing|aim|aims|aimed|level|levels|leveled|raise|raises|raised|"
                       r"lift|lifts|lifted|swing|swings|swung) it\b", re.I)
# Roles out of position once the team is on scene.
ROLE_POSITION = re.compile(r"\bpatrol\b[^.]{0,25}?\b(says|said|sees|saw|hears|heard|can see|can hear|could see|could hear|"
                           r"watches|watched|calls|called|knocks|knocked)\b|\basks? patrol\b|"
                           r"\bnegotiator (walks|walked|escorts|escorted|brings|brought|goes|went|carries|carried)\b", re.I)
PRE_CALLOUT = ("hook", "dispatch", "known", "unknown", "fact_label", "fact_claim", "fact_note", "fact_source", "title")
PAST = re.compile(r"\b(was|were|had|did|said|told|came|went|took|gave|left|got|kept|held|stood|sat|ran|heard|saw|\w+ed)\b", re.I)
PRESENT = re.compile(r"\b(is|are|has|does|says|tells|keeps|holds|stays|goes|comes|takes|gives|leaves|gets|stands|sits|hears|sees)\b", re.I)
NEGATION_OPEN = {"nobody", "no", "nothing", "none"}
PROSE_SURFACES = ("dispatch", "known", "unknown", "prompt", "summary", "preview", "result", "fact_result", "ending_summary")
PATH_STOP = set("""before after goes went comes came back more then again still with nothing about into while there
their them they were what when where which would could should until because through other""".split())
# Genre stock lines, banned in any spoken text (speech, radio, or inside quotes).
STOCK_SPOKEN = [
    "i'm not going anywhere", "let me do the talking", "i've got this", "talk to me",
    "nobody has to get hurt", "nobody needs to get hurt", "stay with me", "we're going in",
    "it's over", "stand down", "cover me", "on my mark", "let's go to work", "we've got this",
    "nobody else has to", "you don't want to do this", "just put it down",
]
FEELING = re.compile(r"\b(feels?|felt|upset|furious|frantic|frightened|terrified|panicked|relieved|relief|"
                     r"angry|anger|angrily|short with|seriously|scared|afraid|fear|ashamed|nervous|anxious|"
                     r"calms?( down)?|calmer|accepts the|talks? (him|her|them)self down|is heard|feels heard)\b", re.I)
SHEET_TERMS = ["her say", "his say", "their say", "own say", "rapport", "consent", "agency",
               "autonomy", "de-escalat", "the value", "the dilemma", "the turn", "the lever"]
ENGINE_WORDS = re.compile(r"\b((?:forced-entry|entry|contact|force|talk) steps?|strain note|notes? clears?|leaning|progress|tempo|bands?|"
                          r"the check|a check|checks? passe?s?|roll(ed|s)?|odds|pressure)\b", re.I)
POLICY_VOICE = ["nobody promises", "not a finding", "is in the record",
                "approves on", "nothing more is promised", "per policy", "as required"]
DEFER = re.compile(r"\b(in the record|the report|later|the debrief)\b", re.I)
DELAY_ONLY = re.compile(r"\b(a long (silence|pause|minute|time|while|exchange|wait)|eventually|"
                        r"after a (long )?(pause|while|wait)|for a long (minute|while|time))\b", re.I)
BRITISH_CHOICE = {
    "garden": "yard", "key safe": "lockbox", "rear lane": "alley", "letterbox": "mail slot",
    "teatime": "dinner", "ambulance crew": "medics or the EMS crew", "carry chair": "stair chair",
    "mum": "mom", "pavement": "sidewalk", "car park": "parking lot", "flat": "apartment (if a home)",
    "lorry": "truck", "torch": "flashlight", "rang": "called", "queue": "line", "whilst": "while",
    "at curb": "at the curb",
}
MARKER_JUDGE = ["GRUDGE", "REVENGE", "LIAR", "LIE", "CRAZY", "ANGRY", "DANGER", "PSYCHO", "UNSTABLE"]
NUM_WORDS = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve"
CLOCK_WORD = re.compile(r"\b(" + NUM_WORDS + r")( o" + APOS + r"clock|\b(?= (am|pm)))|\b(by|at|nearly|past|until) (" + NUM_WORDS + r")\b", re.I)
CLOCK_NUM = re.compile(r"\b(by|at|nearly|past|until) \d{1,2}(:\d\d)?\b|\b\d{1,2} o" + APOS + r"clock", re.I)
YOU = re.compile(r"\byou(r|rs)?\b", re.I)
TEAM = re.compile(r"\bthe (team|squad)\b", re.I)
TRIAD = re.compile(r"\b[\w" + APOS + r"'-]+(?:\s+[\w" + APOS + r"'-]+){0,3},\s+[\w" + APOS + r"'-]+(?:\s+[\w" + APOS + r"'-]+){0,3},\s+and\s+[\w" + APOS + r"'-]+", re.I)
STOP = set("""a an the and or but if then of to in on at by for with from into onto up down out off over
under as is are was were be been being it its it's this that these those he she they him her them his hers
their theirs you your we our i me my not no nobody one two three who what where when why how all any some
has have had do does did can could will would may might must still just now so than too very there here
says said say tells told asks asked""".split())
LINT_NAMES = ["UNSAFE_DETAIL", "ACCUSATION", "HEDGE", "SETTLED", "NEGATED", "META_PHRASING"]
# opener-share is reported, never blocking. Chasing it produced inverted syntax in proof round 2.
BLOCKING = ("over-limit", "sentence-lint", "dash", "placeholder", "missing-band", "marker-name",
            "marker-judge", "ngram", "path-echo", "address-mix", "clock-mix",
            "unsafe", "accusation", "settled", "meta", "stock-spoken", "inversion", "fronted",
            "nothing-alone", "fragments", "fragment-open", "mechanic", "vague-preview", "ending-status",
            "role-position", "threat-it", "tape-subject", "aphorism")


def sentences(text):
    return [s.strip() for s in SENT.split(text) if s.strip()]


VERBISH = re.compile(r"\b(is|are|was|were|be|been|has|had|have|do|does|did|can|could|will|would|"
                     r"\w+ed|\w+s|\w+[" + APOS + r"']s|\w+n[" + APOS + r"']t)\b", re.I)


def is_fragment(s):
    """Crude. Four words or fewer and nothing that looks like a verb. Plural nouns read as verbs, so it undercounts."""
    return len(s.split()) <= 4 and not VERBISH.search(s)


def toks(text):
    return re.findall(r"[a-z0-9" + APOS + r"']+", text.lower().replace(APOS, "'"))


def unquoted(text):
    return QUOTED.sub(" ", text)


def load_lint(path):
    src = open(path, encoding="utf-8").read()
    found = {}
    for name in LINT_NAMES:
        m = re.search(r"const " + name + r" = /(.+)/([a-z]*);", src)
        if m:
            found[name] = re.compile(m.group(1), re.I if "i" in m.group(2) else 0)
    return found


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("tsv")
    ap.add_argument("--lint-source")
    ap.add_argument("--write-txt")
    ap.add_argument("--cast", nargs="*", default=[], help="cast first and last names")
    ap.add_argument("--keep", nargs="*", default=[], help="deliberate motif phrases, max 2 uses each")
    ap.add_argument("--min-repeat", type=int, default=2)
    ap.add_argument("--hand-authored", action="store_true", help="require 3 or more {lead} uses")
    ap.add_argument("--call-nouns", nargs="*", default=[], help="the call's own nouns (door, medic, team) left out of path repeats")
    ap.add_argument("--bind", nargs="*", default=[], help="'Authored Name=Longest Pool Name' pairs, to measure the worst bound length")
    a = ap.parse_args()
    binds = [tuple(p.split("=", 1)) for p in a.bind if "=" in p]
    call_nouns = {w.lower() for w in a.call_nouns}

    def bound(text):
        for old, new in binds:
            text = re.sub(r"\b" + re.escape(old) + r"\b", new, text)
            first_old, first_new = old.split()[0], new.split()[0]
            text = re.sub(r"\b" + re.escape(first_old) + r"\b", first_new, text)
        return text
    with open(a.tsv, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f, delimiter="\t"))
    for r in rows:
        for k in ("stage", "action", "band", "path", "locked"):
            r[k] = (r.get(k) or "").strip()
        if not r["stage"]:
            r["stage"] = r["where"].split(".")[0]
    cast = {c.lower() for c in a.cast}
    keep = [k.lower() for k in a.keep]
    counts = collections.Counter()
    policy = []
    result_tense = collections.Counter()
    fragment_only = []
    speech_tags = collections.Counter()

    def flag(kind, row, detail):
        counts[kind] += 1
        where = row["where"] if row else ""
        sit = row["situation"] if row else ""
        print(f"{kind:<15} {sit:<4} {where:<36} {detail}")

    lint = load_lint(a.lint_source) if a.lint_source else {}
    if a.lint_source and len(lint) < len(LINT_NAMES):
        print("lint lists: some patterns not found, re-read prose-lint.ts", file=sys.stderr)

    # Per-row checks.
    for row in rows:
        text, surface = row["text"], row["surface"]
        if surface not in BUDGETS:
            flag("surface", row, f"unknown surface '{surface}'")
            continue
        limit, target, pre = BUDGETS[surface]
        low, bare = text.lower(), unquoted(text).lower()
        if not text.strip() or text.strip().startswith("(") or re.search(r"as favorable|tbd|todo|placeholder|same as", low):
            flag("placeholder", row, f"not player text: {text[:60]}")
        worst = len(bound(text))
        size = f"authored {len(text)}, worst bound {worst}" if binds else f"{len(text)}"
        if limit and worst > limit:
            flag("over-limit", row, f"{size} chars, limit {limit} (counted, spaces included)")
        if target and len(text.split()) > target:
            flag("over-target", row, f"{len(text.split())} words, house target {target}")
        if surface == "hook":
            if worst > HOOK_CHARS:
                flag("over-target", row, f"{size} chars, hook target about {HOOK_CHARS}")
            if sentences(text) and len(sentences(text)[0].split()) > 14:
                flag("over-target", row, "first sentence over 14 words")
        if surface == "summary" and row["locked"].lower() in ("y", "yes", "1", "true") and len(text) > LOCKED_CLAMP:
            flag("locked-clamp", row, f"{len(text)} chars; the clamp cuts after about {LOCKED_CLAMP}: '{text[LOCKED_CLAMP:LOCKED_CLAMP + 50]}' Is the cost before the cut?")
        if surface == "marker":
            if any(re.search(r"\b" + re.escape(c) + r"\b", low) for c in cast):
                flag("marker-name", row, "a marker names the claim, never a person")
            if any(re.search(r"\b" + w + r"\b", text.upper()) for w in MARKER_JUDGE):
                flag("marker-judge", row, "a marker states the fact neutrally, never a motive or character")
        for s in sentences(text):
            n = len(s.split())
            if n > 34:
                flag("sentence-lint", row, f"{n} words: {s[:60]}")
            elif n > 22:
                flag("sentence-long", row, f"{n} words: {s[:60]}")
        for m in DASHES.finditer(text):
            flag("dash", row, f"dash at {m.start()}")
        for m in COLON.finditer(text):
            flag("colon", row, f"...{text[max(0, m.start() - 20):m.start() + 20]}...")
        if ";" in text:
            flag("semicolon", row, "split the sentence")
        if "!" in text and OQ not in text:
            flag("exclamation", row, "only in shouted dialogue")
        if "'" in text:
            flag("apostrophe", row, "straight apostrophe, data uses curly")
        for p in TELLS + STOCK:
            if re.search(r"\b" + re.escape(p) + r"\b", bare):
                flag("stock", row, p)
        if STOCK_RE.search(bare):
            flag("stock", row, STOCK_RE.search(bare).group(0))
        if NARRATOR_HEDGE.search(bare):
            flag("narrator-hedge", row, f"'{NARRATOR_HEDGE.search(bare).group(0)}'; report it as fact or as someone's words")
        if MECHANIC.search(bare):
            flag("mechanic", row, f"'{MECHANIC.search(bare).group(0)}'; say who waits or what does not happen")
        if TAPE_SUBJECT.search(bare):
            flag("tape-subject", row, "the tape is a place; name the people at it")
        if APHORISM.search(bare) and surface in ("summary", "preview", "prompt", "result", "ending_summary"):
            flag("aphorism", row, f"'{APHORISM.search(bare).group(0)}'; a person doing a visible act instead")
        if THREAT_IT.search(bare):
            flag("threat-it", row, f"'{THREAT_IT.search(bare).group(0)}'; a threat line names the object in a noun phrase")
        if ROLE_POSITION.search(bare) and surface not in PRE_CALLOUT:
            flag("role-position", row, f"'{ROLE_POSITION.search(bare).group(0)}'; after call-out the team observes and the negotiator talks")
        if surface == "preview" and VAGUE_PREVIEW.search(bare):
            flag("vague-preview", row, f"'{VAGUE_PREVIEW.search(bare).group(0)}'; name a person and a visible act or position")
        if surface == "ending_summary" and ENDING_STATUS.search(bare):
            flag("ending-status", row, f"'{ENDING_STATUS.search(bare).group(0)}'; the last beat is a human detail")
        if surface in ("result", "summary", "preview", "prompt", "fact_result") and re.search(r"\bit\b", bare):
            flag("it-check", row, "read this string alone; does 'it' have a referent inside it?")
        for s in sentences(unquoted(text)):
            words = s.split()
            if INVERSION.search(s) or MOVED_FRAGMENT.search(s):
                flag("inversion", row, f"'{s[:50]}'; plain subject and verb")
            m = re.match(r"^([A-Z][\w" + APOS + r"']*)((?: [\w" + APOS + r"']+){0,6}), ([\w" + APOS + r"']+)\b", s)
            if m and m.group(1).lower() not in FRONT_OK and (m.group(3).lower() in cast or m.group(3).lower() in ("he", "she", "they")):
                flag("fronted", row, f"'{s[:50]}'; change the subject, never the word order")
            if re.fullmatch(r"nothing( at all)?[.]?", s.strip().lower()):
                flag("nothing-alone", row, "'Nothing.' never stands alone")
        if surface == "result" and sentences(unquoted(text)) and is_fragment(sentences(unquoted(text))[0]):
            flag("fragment-open", row, "a result's first sentence has a subject and a verb")
        if surface == "result":
            tenses = set()
            for s in re.split(r"[.?!]\s+|,\s+(?:and|but|so|while)\s+", unquoted(text)):
                p, q = bool(PAST.search(s)), bool(PRESENT.search(s))
                if p != q:
                    tenses.add("past" if p else "present")
            if len(tenses) == 2:
                flag("tense-mix", row, "past and present in one result; hold the call's tense")
            if len(tenses) == 1:
                result_tense[tenses.pop()] += 1
        if surface in PROSE_SURFACES and sentences(unquoted(text)) and all(is_fragment(s) for s in sentences(unquoted(text))):
            fragment_only.append(row)
        for c in cast:
            n = len(re.findall(r",\s+" + re.escape(c) + r"\s+(says|said|tells|told|decides|decided)\b", low))
            if n:
                speech_tags[c] += n
        spoken = [q.lower().replace(APOS, "'") for q in QUOTED.findall(text)]
        if surface in ("speech", "radio"):
            spoken = [low.replace(APOS, "'")]
        for q in sorted(set(spoken)):
            for p in STOCK_SPOKEN:
                if p in q:
                    flag("stock-spoken", row, p)
            if re.search(r"\bweapon\b", q) and surface != "radio":
                flag("weapon-speech", row, "civilians never say weapon; keep their framing or talk around it")
        if re.search(r"\bsays?\b[^.]*\bweapon\b", bare) and surface in ("hook", "known", "dispatch", "fact_claim"):
            flag("weapon-speech", row, "a reported civilian claim keeps the person's framing")
        if surface in ("result", "ending_summary", "ending_title", "summary", "preview", "debrief", "civilian_outcome"):
            m = FEELING.search(bare)
            if m:
                flag("feeling", row, f"'{m.group(0)}' tells a feeling; show the behavior")
        for t in SHEET_TERMS:
            if t in bare:
                flag("sheet-term", row, f"'{t}' is design vocabulary; show the act")
        m = ENGINE_WORDS.search(bare)
        if m and surface not in ("pressure_label",):
            flag("engine-word", row, f"'{m.group(0)}' is an engine term on a player surface")
        for p in POLICY_VOICE:
            if p in bare:
                flag("policy-voice", row, f"'{p}' narrates compliance; show the behavior")
        if surface in ("preview", "summary") and DEFER.search(bare):
            flag("defer", row, f"'{DEFER.search(bare).group(0)}' defers the consequence; say it plainly")
        if row["band"] == "mixed" and DELAY_ONLY.search(bare):
            flag("delay-only", row, f"'{DELAY_ONLY.search(bare).group(0)}'; name what changed besides the clock")
        for w, swap in BRITISH_CHOICE.items():
            if re.search(r"\b" + re.escape(w) + r"\b", bare):
                flag("word-choice", row, f"'{w}' reads British, use {swap}")
        if lint:
            for name in ("UNSAFE_DETAIL", "META_PHRASING"):
                if lint.get(name) and (m := lint[name].search(text)):
                    flag("unsafe" if name == "UNSAFE_DETAIL" else "meta", row, m.group(0))
            for s in sentences(text):
                neg = lint.get("NEGATED") and lint["NEGATED"].search(s)
                if pre and lint.get("ACCUSATION") and (m := lint["ACCUSATION"].search(s)):
                    if not (lint.get("HEDGE") and lint["HEDGE"].search(s)) and not neg:
                        flag("accusation", row, f"'{m.group(0)}' needs a source in the sentence")
                if lint.get("SETTLED") and (m := lint["SETTLED"].search(s)) and not neg:
                    flag("settled", row, m.group(0))
        for m in re.finditer(r"\b(weapon|armed|gun\w*|die|died|dead|dying|hurt|killed?)\b", bare):
            if not re.search(r"\b(no|not|never|without|empty)\b", bare):
                hits = [n for n in ("UNSAFE_DETAIL", "ACCUSATION", "SETTLED") if lint.get(n) and lint[n].search(m.group(0))]
                policy.append((row["where"], row["situation"], m.group(0), "matches " + "+".join(hits) if hits else "matches none"))

    # Call-level counts from the row pass.
    if len(fragment_only) > 2:
        for r in fragment_only:
            flag("fragments", r, f"fragment-only string ({len(fragment_only)} in the call, limit 2): {r['text'][:50]}")
    if len(result_tense) == 2:
        minority = min(result_tense, key=result_tense.get)
        flag("tense-call", None, f"results run {dict(result_tense)}; the {minority} ones break the call's tense")
    print(f"result tense: {dict(result_tense) or 'none detected'}")
    for c, n in speech_tags.items():
        if n > 6:
            flag("speech-tag", None, f"', {c} says/tells/decides' x{n}, limit 6 per call; quote the line that matters")

    # Band coverage per action and situation.
    sits = sorted({r["situation"] for r in rows if r["situation"] != "all"}) or ["all"]
    results, previews = collections.defaultdict(set), collections.defaultdict(set)
    for r in rows:
        if not r["action"]:
            continue
        cover = sits if r["situation"] == "all" else [r["situation"]]
        target = results if r["surface"] == "result" else previews if r["surface"] == "preview" else None
        if target is not None and r["band"]:
            for s in cover:
                target[r["action"]].add((s, r["band"]))
    for act, have in results.items():
        reached = {s for s, _ in have}
        for s in sorted(reached):
            for b in BANDS:
                if (s, b) not in have:
                    flag("missing-band", None, f"{act}: no {b} result in {s}")
    for act, have in previews.items():
        if not any(b == "adverse" for _, b in have):
            flag("missing-band", None, f"{act}: no adverse preview")

    # Repeats: whole sentences, 4-word runs across fields or situations, motifs, content words.
    seen = collections.defaultdict(set)
    grams = collections.defaultdict(set)
    for r in rows:
        key = (r["where"], r["situation"])
        for s in sentences(r["text"]):
            if len(s.split()) >= 4:
                seen[s].add(key)
        t = toks(r["text"])
        for i in range(len(t) - 3):
            g = " ".join(t[i:i + 4])
            if any(k in g for k in keep) or all(w in cast or w in STOP for w in t[i:i + 4]):
                continue
            grams[g].add(key)
    for s, keys in sorted(seen.items(), key=lambda kv: -len(kv[1])):
        if len(keys) >= a.min_repeat:
            flag("repeat", None, f"{len(keys)} strings  {s[:70]}")
    runs = collections.OrderedDict()
    for g, keys in sorted(grams.items(), key=lambda kv: -len(kv[1])):
        if len(keys) >= a.min_repeat:
            runs.setdefault(frozenset(keys), []).append(g)
    for keys, gs in runs.items():
        flag("ngram", None, f"{len(keys)} strings share a run starting '{gs[0]}' ({len(gs) + 3} words) in {', '.join(sorted(w for w, _ in keys))[:80]}")
    alltext = " ".join(r["text"] for r in rows).lower()
    for k in keep:
        n = alltext.count(k)
        if n > 2:
            flag("motif", None, f"'{k}' used {n} times, soft cap 2")
    # Echo along a path: consecutive strings on one path sharing a 3-word run.
    paths = collections.defaultdict(list)
    for r in rows:
        for p in (r["path"].split(",") if r["path"] else []):
            paths[p.strip()].append(r)

    # Repeats per reachable path, the strings one player reads. The call's own nouns are left out.
    for p, chain in paths.items():
        per = collections.Counter()
        for r in chain:
            for w in set(toks(r["text"])):
                if w not in STOP and w not in PATH_STOP and w not in cast and w not in call_nouns and len(w) > 3:
                    per[w] += 1
        for w, n in per.most_common():
            if n < 2:
                break
            flag("path-repeat", None, f"path {p}: '{w}' in {n} strings; an image recurs only if it changes state")
    sents_all = [s for r in rows for s in sentences(unquoted(r["text"]))]
    neg = sum(1 for s in sents_all if s.split() and s.split()[0].lower().strip(".,") in NEGATION_OPEN)
    if sents_all and neg / len(sents_all) > 0.05:
        flag("negation-openers", None, f"Nobody/No/Nothing open {neg} of {len(sents_all)} sentences ({neg / len(sents_all):.0%}), limit 5%")
    opening = [r for r in rows if r["surface"] in ("hook", "dispatch")]
    first_stage = next((r["stage"] for r in rows if r["surface"] == "prompt"), None)
    opening += [r for r in rows if r["surface"] == "prompt" and r["stage"] == first_stage]
    chains = list(paths.values()) + [opening]
    seen_pairs = set()
    for chain in chains:
        for x, y in zip(chain, chain[1:]):
            tx, ty = toks(x["text"]), toks(y["text"])
            gx = {" ".join(tx[i:i + 3]) for i in range(len(tx) - 2)}
            gy = {" ".join(ty[i:i + 3]) for i in range(len(ty) - 2)}
            shared = [g for g in gx & gy if not all(w in STOP or w in cast for w in g.split())]
            pair = (x["where"], x["situation"], y["where"], y["situation"])
            if shared and pair not in seen_pairs:
                seen_pairs.add(pair)
                flag("path-echo", y, f"repeats '{shared[0]}' from {x['where']}, read back to back")

    # Address: one address per surface type across the call.
    addressed = [r for r in rows if r["surface"] in ("prompt", "summary", "preview")]
    if any(YOU.search(unquoted(r["text"])) for r in addressed) and any(TEAM.search(unquoted(r["text"])) for r in addressed):
        flag("address-mix", None, "prompts, summaries and previews mix 'you' with 'the team'; pick 'you'")
    for r in rows:
        if r["surface"] in ("result", "ending_summary", "debrief") and YOU.search(unquoted(r["text"])):
            flag("address-mix", r, "results and endings name the team or the officer, never 'you'")

    # Clock form: one written form per call in narration.
    narr = " ".join(unquoted(r["text"]) for r in rows)
    if CLOCK_WORD.search(narr) and CLOCK_NUM.search(narr):
        flag("clock-mix", None, f"'{CLOCK_WORD.search(narr).group(0)}' and '{CLOCK_NUM.search(narr).group(0)}' both appear; pick one form")

    # Officer presence.
    lead = [r for r in rows if "{lead}" in r["text"]]
    lead_stages = sorted({r["stage"] for r in lead})
    print(f"lead uses: {len(lead)} across stages {', '.join(lead_stages) or 'none'}")
    if a.hand_authored and len(lead) < 3:
        flag("lead-thin", None, "hand-authored calls need 3 or more {lead} uses")

    # Cost constructions in summaries, per stage.
    stage_may = collections.Counter()
    bare_adj = 0
    for r in rows:
        if r["surface"] != "summary":
            continue
        stage_may[r["stage"]] += len(re.findall(r"\bmay\b", r["text"]))
        bare_adj += len(re.findall(r"(?:^|[.] )(Quick|Quicker|Slow|Slower|Fast|Faster|Safer|Riskier),", r["text"]))
    for st, n in stage_may.items():
        if n > 1:
            flag("cost-template", None, f"stage {st} uses 'may' {n} times in summaries, limit 1")
    if bare_adj > 1:
        flag("cost-template", None, f"{bare_adj} summaries open a cost clause on a bare speed word, limit 1")

    # Cadence and openers, vendored from the written-voice method.
    sents = [s for r in rows for s in sentences(r["text"])]
    lens = [len(s.split()) for s in sents]
    if len(lens) >= 2:
        cv = statistics.pstdev(lens) / statistics.mean(lens)
        print(f"sentence length: mean {statistics.mean(lens):.1f}, range {min(lens)}-{max(lens)}, variation {cv:.2f} {'OK' if cv >= 0.55 else 'FLAT'}")
        if cv < 0.55:
            counts["cadence-flat"] += 1
    openers = collections.Counter(re.sub(r"'s$", "", s.split()[0].strip(OQ + "\"").lower().replace(APOS, "'"))
                                  for s in sents if s.split())
    share = [(w, n, n / len(sents)) for w, n in openers.most_common(5)] if sents else []
    print("opener share: " + ", ".join(f"{w} {p:.0%}" for w, n, p in share))
    pron = {"she", "he", "they", "her", "his", "their"}
    for w, n, p in share:
        if p > 0.20 and len(sents) >= 10:
            flag("opener-share", None, f"'{w}' opens {p:.0%} of sentences (report). Change the subject, never the word order")
    pron_share = sum(n for w, n in openers.items() if w in pron or w in cast) / max(len(sents), 1)
    if pron_share > 0.35 and len(sents) >= 10:
        flag("opener-share", None, f"names and pronouns open {pron_share:.0%} of sentences (report). Let another person or object act, or leave it")
    triads = TRIAD.findall(" ".join(r["text"] for r in rows))
    print(f"rule-of-three lists: {len(triads)}")
    if len(triads) > 3:
        counts["triad"] += 1

    # Lint policy collisions for the owner.
    print("lint policy candidates (affirmative harm or weapon words, owner decision): "
          + (", ".join(f"{w}@{where}/{s} ({res})" for where, s, w, res in policy[:20]) or "none"))
    keys = ["over-limit", "over-target", "locked-clamp", "sentence-lint", "sentence-long", "dash", "colon",
            "semicolon", "exclamation", "apostrophe", "stock", "stock-spoken", "feeling", "sheet-term",
            "engine-word", "policy-voice", "defer", "delay-only", "word-choice", "weapon-speech",
            "placeholder", "missing-band", "marker-name", "marker-judge", "repeat", "ngram", "motif",
            "path-repeat", "path-echo", "address-mix", "clock-mix", "cost-template", "lead-thin",
            "opener-share", "cadence-flat", "triad", "unsafe", "meta", "accusation", "settled", "surface",
            "inversion", "fronted", "nothing-alone", "fragments", "fragment-open", "narrator-hedge",
            "mechanic", "vague-preview", "ending-status", "tape-subject", "aphorism", "threat-it",
            "role-position", "it-check", "tense-mix", "tense-call", "speech-tag", "negation-openers"]
    print("summary " + ", ".join(f"{k} {counts[k]}" for k in keys) + f", strings {len(rows)}")
    if a.write_txt:
        with open(a.write_txt, "w", encoding="utf-8") as out:
            out.write("\n\n".join(r["text"] for r in rows) + "\n")
    if counts["fronted"] <= 1:
        counts["fronted"] = 0
    return 1 if any(counts[k] for k in BLOCKING) else 0


if __name__ == "__main__":
    sys.exit(main())
