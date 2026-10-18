// One matcher for people's names in call text (spec 8), used by the game (PeopleText) and the
// Scenario Lab. Who each name is comes from public data only: the call's cast, each person's public
// kind and whether the team has a location for them, plus the deployed officers. Places are masked
// before people, so "Cedar Park Apartments" never colors officer Park. Pure: no React, no store.
import { getBuilt } from '../../sim/resolution';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import type { OperationRun, SquadId } from '../../sim/types';

export type PeopleKind = 'subject' | 'civilian' | 'person' | 'officer' | 'withheld';
export interface LexiconEntry { id: string; kind: PeopleKind; forms: string[]; squad?: SquadId }
export interface Lexicon {
  entries: LexiconEntry[];
  places: string[];
  /** One pass over the text for every name form, longest first; null when nobody can be named. */
  pattern: RegExp | null;
  /** Forms of people the text may name who stay uncolored (no location yet, or no public kind).
   * They are matched like everyone else, so a longer uncolored name is never split into a shorter
   * colored one, and then left plain. */
  masked?: string[];
}
export interface LexiconOfficer { id: string; firstName: string; surname: string; squad: SquadId }

/** The public kinds a story binding can carry, as the colors read them. Hostage, victim and
 * trapped are not public kinds; held people are civilians (spec 8.4, rule 4). */
const PUBLIC_KIND: Record<string, PeopleKind> = { subject: 'subject', civilian: 'civilian', patient: 'civilian', person: 'person' };

/** The hover label and screen-reader word for each kind (spec 8.2). */
export function peopleLabel(kind: PeopleKind, squad?: SquadId): string {
  switch (kind) {
    case 'subject': return 'Subject';
    case 'civilian': return 'Civilian';
    case 'person': return 'Person at the scene';
    case 'officer': return squad ? `Squad ${squad}` : 'Officer';
    case 'withheld': return 'Named; role not confirmed';
  }
}

// A name starts after anything but a letter, mark, apostrophe or hyphen (so "O'Connell" never
// yields "Connell") and ends before anything but a letter or mark; a possessive "’s" goes with it.
const BEFORE = "(?<![\\p{L}\\p{M}'’-])";
const AFTER = "(?:['’]s)?(?![\\p{L}\\p{M}])";
const escapeForm = (form: string) => form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['’]/g, "['’]");
/** Straight and curly apostrophes are the same letter for lookup. */
const keyOf = (text: string) => text.replace(/’/g, "'");
const longestFirst = (a: string, b: string) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0);

function alternation(forms: readonly string[]): RegExp | null {
  if (!forms.length) return null;
  return new RegExp(`${BEFORE}(${[...forms].sort(longestFirst).map(escapeForm).join('|')})${AFTER}`, 'gu');
}

/** Full name, first name (a two-word first name stays whole: "May Thiri", never "May"), surname. */
const formsOf = (who: { firstName: string; surname: string }) =>
  [...new Set([`${who.firstName} ${who.surname}`.trim(), who.firstName.trim(), who.surname.trim()].filter(Boolean))];

/** Build a lexicon from plain inputs. `cast` is every named person in the call; `publicKind`,
 * `withheld` (group followers) and `located` decide who is colored; a form two people share (a
 * surname from one family, say) names neither, so it is never colored. `words` are forms the
 * call's own text already uses as ordinary words (see formsInText): they name nobody either. */
export function buildLexicon(input: { cast: Record<string, { firstName: string; surname: string }>;
  publicKind: Record<string, string | undefined>; withheld: ReadonlySet<string>; located: ReadonlySet<string>;
  officers: readonly LexiconOfficer[]; places: readonly string[]; words?: readonly string[] }): Lexicon {
  const people: { id: string; kind: PeopleKind | null; forms: string[]; squad?: SquadId }[] = [];
  for (const [id, who] of Object.entries(input.cast)) {
    const known = input.withheld.has(id) ? 'withheld' : PUBLIC_KIND[input.publicKind[id] ?? ''] ?? null;
    people.push({ id, kind: known && input.located.has(id) ? known : null, forms: formsOf(who) });
  }
  for (const officer of input.officers) people.push({ id: officer.id, kind: 'officer', forms: formsOf(officer), squad: officer.squad });

  const owners = new Map<string, Set<string>>();
  for (const word of input.words ?? []) owners.set(keyOf(word), new Set(['(the call’s own text)']));
  for (const person of people) for (const form of person.forms) {
    const key = keyOf(form);
    owners.set(key, (owners.get(key) ?? new Set()).add(person.id));
  }
  const own = (person: (typeof people)[number]) => person.forms.filter((form) => { const by = owners.get(keyOf(form))!; return by.size === 1 && by.has(person.id); }).sort(longestFirst);

  const entries: LexiconEntry[] = [], masked: string[] = [];
  for (const person of people) {
    const forms = own(person);
    if (!forms.length) continue;
    if (person.kind) entries.push({ id: person.id, kind: person.kind, forms, ...(person.squad ? { squad: person.squad } : {}) });
    else masked.push(...forms);
  }
  const places = [...new Set(input.places.map((place) => place.trim()).filter(Boolean))].sort(longestFirst);
  const pattern = entries.length ? alternation([...entries.flatMap((entry) => entry.forms), ...masked]) : null;
  return { entries, places, pattern, ...(masked.length ? { masked } : {}) };
}

/** Place names the text can carry: the building's name and its room and zone labels, as written
 * and lowercased (the binder writes {scene} and {role.room} in lower case). */
export function placesOf(scenario: Pick<ScenarioDefinition, 'locationFamilyId' | 'locationSeed'>): string[] {
  try {
    const { location } = getBuilt(scenario.locationFamilyId, scenario.locationSeed);
    const labels = [...location.rooms, ...location.zones].map((space) => space.label).filter(Boolean);
    return [location.name, ...labels, ...labels.map((label) => label.toLowerCase())].filter(Boolean);
  } catch {
    return [];
  }
}

/** The forms that occur in `text` as whole, case-sensitive words. A call's text never names an
 * officer (it keeps `{lead}` as a token until play), so an officer form found there is a word of
 * that call ("Park the vehicle at the door first" with officer Park deployed) and names nobody. */
export function formsInText(forms: readonly string[], text: string): string[] {
  // A plain substring check first: most forms are nowhere in the text, and the word test on a
  // whole call's text costs about 1.6 ms (bun, 2026-10-09).
  return forms.filter((form) => (/['’]/.test(form) || text.includes(form)) && new RegExp(`${BEFORE}${escapeForm(form)}${AFTER}`, 'u').test(text));
}

/** All of a call's text in one string, once per scenario. */
const corpora = new WeakMap<ScenarioDefinition, string>();
function corpusOf(scenario: ScenarioDefinition): string {
  let text = corpora.get(scenario);
  if (text === undefined) corpora.set(scenario, text = JSON.stringify({ ...scenario, story: undefined, incidentPeople: undefined }));
  return text;
}

const memo = new WeakMap<ScenarioDefinition, Map<string, Lexicon>>();

/** The lexicon for one call as the team knows it now: its cast by public kind, colored once their
 * person fact is reported or confirmed (the map's rule), group followers always "named, kind
 * withheld", plus the deployed officers. Memoized per scenario, knowledge and officers. */
export function lexiconFor(scenario: ScenarioDefinition, run: Pick<OperationRun, 'knowledge'> | null,
  officers: readonly LexiconOfficer[], places?: readonly string[]): Lexicon {
  const cast = scenario.story?.cast ?? {};
  const bindings = scenario.story?.bindings.people ?? {};
  const initial = new Map(scenario.facts.map((fact) => [fact.id, fact.initial]));
  const located = new Set(Object.keys(cast).filter((id) => {
    const factId = bindings[id]?.locationFactId;
    const status = factId ? run?.knowledge[factId] ?? initial.get(factId) : undefined;
    return status === 'reported' || status === 'confirmed';
  }));
  const key = JSON.stringify([[...located].sort(), officers.map((officer) => [officer.id, officer.squad, officer.firstName, officer.surname]), places ?? null]);
  let byKey = memo.get(scenario);
  if (!byKey) memo.set(scenario, byKey = new Map());
  const cached = byKey.get(key);
  if (cached) return cached;
  // Followers of a group: location knowledge is not kind knowledge (spec 8.4, rule 3).
  const withheld = new Set((scenario.incidentPeople ?? []).filter((person) => person.group && person.group.role !== 'leader' && person.group.role !== 'lone').map((person) => person.id));
  const publicKind = Object.fromEntries(Object.entries(bindings).map(([id, binding]) => [id, binding.publicKind]));
  const words = formsInText(officers.flatMap(formsOf), corpusOf(scenario));
  const lexicon = buildLexicon({ cast, publicKind, withheld, located, officers, places: places ?? placesOf(scenario), words });
  byKey.set(key, lexicon);
  return lexicon;
}

/** What each matched form names, and the place mask, per lexicon. */
const lookups = new WeakMap<Lexicon, { byForm: Map<string, LexiconEntry>; places: RegExp | null }>();
function lookupOf(lex: Lexicon) {
  let found = lookups.get(lex);
  if (!found) {
    const byForm = new Map<string, LexiconEntry>();
    for (const entry of lex.entries) for (const form of entry.forms) byForm.set(keyOf(form), entry);
    lookups.set(lex, found = { byForm, places: alternation(lex.places) });
  }
  return found;
}

/** The text in order, each colored name its own part with who it is and whether it is that
 * person's first mention in this text. Joining the parts' text gives the input back. */
export function segmentPeople(text: string, lex: Lexicon): { text: string; person?: { id: string; kind: PeopleKind; first: boolean } }[] {
  if (!text || !lex.pattern) return [{ text }];
  const { byForm, places } = lookupOf(lex);
  // Mask places first, keeping every index where it was.
  const scan = places ? text.replace(places, (match) => '\u0000'.repeat(match.length)) : text;
  const parts: { text: string; person?: { id: string; kind: PeopleKind; first: boolean } }[] = [];
  const seen = new Set<string>();
  let at = 0;
  for (const match of scan.matchAll(lex.pattern)) {
    const entry = byForm.get(keyOf(match[1]));
    if (!entry) continue;
    const start = match.index!, end = start + match[1].length;
    if (start > at) parts.push({ text: text.slice(at, start) });
    parts.push({ text: text.slice(start, end), person: { id: entry.id, kind: entry.kind, first: !seen.has(entry.id) } });
    seen.add(entry.id);
    at = end;
  }
  if (!parts.length) return [{ text }];
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}
