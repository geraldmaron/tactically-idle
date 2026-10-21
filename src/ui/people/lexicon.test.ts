// The people matcher against its oracle (spec 8.1): bindRoleSegments tags every name the binder
// writes with the person it came from. On every string of all four call trees, under twelve drawn
// casts, a cast of awkward names and a cast of the longest names, every colored span must be a span
// the oracle tagged with that same person (no false matches), and every tagged name must be colored
// unless its form is shared by two people (a family surname), which names nobody.
import { describe, expect, it } from 'vitest';
import { INCIDENT_TEMPLATES } from '../../content/incidents';
import type { IncidentTemplate } from '../../content/incidents/types';
import { CIVILIAN_FIRST_NAMES, CIVILIAN_SURNAMES } from '../../content/call-trees/civilian-names';
import { bindRoleSegments, drawTreeCast, memberId, type CastIdentity } from '../../gen/incident/trees-v13/compile';
import { callStringRows } from '../../gen/incident/trees-v13/strings';
import { fixtureCalls } from '../../gen/incident/trees-v13/house-call-fixture';
import { GROUP_TEMPLATE } from '../../gen/incident/trees-v13/group-fixture';
import { getBuilt } from '../../sim/resolution';
import type { IncidentSpec, ScenarioDefinition } from '../../sim/scenario-types';
import { buildLexicon, formsInText, lexiconFor, segmentPeople, type Lexicon, type LexiconOfficer } from './lexicon';

const TEMPLATES = Object.values(INCIDENT_TEMPLATES).filter((template): template is IncidentTemplate => !!template?.tree);
const PLACE = 'Cedar Park Apartments';
/** Officers whose names are ordinary words; Park also sits inside the building's name. */
const OFFICERS: LexiconOfficer[] = [
  { id: 'off_park', firstName: 'Dana', surname: 'Park', squad: 'A' },
  { id: 'off_bell', firstName: 'Sam', surname: 'Bell', squad: 'A' },
  { id: 'off_may', firstName: 'May Thiri', surname: 'Hale', squad: 'B' },
  { id: 'off_vale', firstName: 'Te Rangi', surname: 'Vale', squad: 'B' },
];

/** Each group at `size(max)` members, as the instance would draw them. */
function groupsFor(template: IncidentTemplate, size: (max: number) => number): Record<string, string[]> {
  return Object.fromEntries(Object.entries(template.tree.groups ?? {}).map(([group, spec]) => {
    const slot = template.cast.find(entry => entry.id === spec.slot);
    return [group, Array.from({ length: size(slot ? Math.max(0, slot.count.max - slot.keyRoles.length) : 0) }, (_, i) => memberId(group, i + 1))];
  }));
}

/** Twelve casts drawn the way calls draw them (shared surnames inside a surname group). */
function drawnCasts(template: IncidentTemplate): { label: string; cast: Record<string, CastIdentity>; groups: Record<string, string[]> }[] {
  return Array.from({ length: 12 }, (_, k) => {
    const groups = groupsFor(template, max => k % (max + 1));
    const spec = { type: template.type, familyId: 'market_row', buildingSeed: k, seed: 900 + k, tier: 2, contentVersion: 13 } as IncidentSpec;
    return { label: `drawn cast ${k}`, cast: drawTreeCast(template.tree, spec, {}, Object.values(groups).flat()), groups };
  });
}

/** Names that trip a matcher: two-word first names, diacritics, apostrophes, ordinary words, a
 * surname shared by two unrelated people, and a first name that is a surname elsewhere. */
const AWKWARD: readonly [string, string][] = [
  ['May Thiri', "O'Connell"], ['Joël', 'Zieliński'], ['Anahí', 'Gonçalves'], ['Mercy', 'Bell'], ['Rowan', 'Park'], ['Wren', 'Lee'],
  ['Nur Aisyah', 'Gonçalves'], ['Ruth', 'Vann'], ['Joaquín', 'Grünewald'], ['Ines', 'Moretti'], ['Lee', 'Aung'], ['Ramón', 'Sepúlveda'],
  ['Patience', 'Echeverría'], ['Juniper', 'Arbeláez'], ['Briar', 'Valdés'], ['Indigo', 'Okafor'], ['Reese', 'Lindqvist'], ['Darby', 'Haddad'],
  ['Florence', 'Tamura'], ['Benedict', 'Achebe'], ['Peyton', 'Novak'], ['Jasmine', 'Ferreira'], ['Te Aroha', 'Kowalczyk'], ['Mei Ling', 'Brandt'],
];
function awkwardCast(template: IncidentTemplate): Record<string, CastIdentity> {
  const groups = groupsFor(template, max => max);
  const ids = [...template.tree.roles.map(role => role.id), ...Object.values(groups).flat()];
  expect(ids.length).toBeLessThanOrEqual(AWKWARD.length);
  return Object.fromEntries(ids.map((id, i) => [id, { firstName: AWKWARD[i][0], surname: AWKWARD[i][1], pronouns: 'they' as const, age: 30 }]));
}

/** The longest names in the civilian pools, one person each, so every name stays someone's. */
function longestCast(template: IncidentTemplate): Record<string, CastIdentity> {
  const groups = groupsFor(template, max => max);
  const ids = [...template.tree.roles.map(role => role.id), ...Object.values(groups).flat()];
  const byLength = (names: readonly string[]) => [...new Set(names)].sort((a, b) => b.length - a.length || a.localeCompare(b));
  const firsts = byLength([...CIVILIAN_FIRST_NAMES.she, ...CIVILIAN_FIRST_NAMES.he, ...CIVILIAN_FIRST_NAMES.they]);
  const surnames = byLength(CIVILIAN_SURNAMES);
  return Object.fromEntries(ids.map((id, i) => [id, { firstName: firsts[i], surname: surnames[i], pronouns: 'they' as const, age: 17 }]));
}

/** Public kind per cast id, as the compiler writes it: bystanders are people at the scene, group
 * members take their leader's kind. */
function publicKinds(template: IncidentTemplate, cast: Record<string, CastIdentity>): Record<string, string> {
  const kindOf = (id: string): string => {
    const role = template.tree.roles.find(entry => entry.id === id);
    if (role) return role.kind === 'bystander' ? 'person' : role.kind;
    const group = Object.entries(template.tree.groups ?? {}).find(([name]) => id.startsWith(`${name}_`));
    return group ? kindOf(group[1].leader) : 'civilian';
  };
  return Object.fromEntries(Object.keys(cast).map(id => [id, kindOf(id)]));
}

interface Span { start: number; end: number; id: string }
function colored(text: string, lex: Lexicon): Span[] {
  const spans: Span[] = [];
  let at = 0;
  for (const part of segmentPeople(text, lex)) {
    if (part.person) spans.push({ start: at, end: at + part.text.length, id: part.person.id });
    at += part.text.length;
  }
  return spans;
}

describe('people lexicon against the binder oracle', () => {
  it('covers every call tree', () => {
    expect(TEMPLATES.map(template => template.type).sort()).toEqual(Object.keys(INCIDENT_TEMPLATES).sort());
  });

  for (const template of TEMPLATES) {
    it(`${template.type}: every string, 14 casts, colors exactly the people the binder named`, () => {
      const casts = [
        ...drawnCasts(template),
        { label: 'awkward names', cast: awkwardCast(template), groups: groupsFor(template, max => max) },
        { label: 'longest names', cast: longestCast(template), groups: groupsFor(template, max => max) },
      ];
      let tagged = 0, matched = 0, shared = 0;
      // The tree's own words, as the game reads them from the call's text: "Park the vehicle at
      // the door first" makes officer Park's surname a word in a rescue call.
      const words = formsInText(OFFICERS.flatMap(officer => [`${officer.firstName} ${officer.surname}`, officer.firstName, officer.surname]),
        callStringRows(template.tree, text => text).map(row => row.text).join('\n'));
      for (const { label, cast, groups } of casts) {
        const rooms = { scene: 'storage room', ...Object.fromEntries([...Object.keys(cast), ...Object.keys(groups)].map(id => [id, 'sales floor'])) };
        const followers = new Set(Object.values(groups).flatMap(ids => ids.slice(1)));
        const lex = buildLexicon({ cast, publicKind: publicKinds(template, cast), withheld: followers, located: new Set(Object.keys(cast)), officers: OFFICERS, places: [PLACE, 'storage room', 'sales floor'], words });
        const counts = Object.fromEntries(Object.entries(groups).map(([group, ids]) => [group, ids.length]));
        for (const row of callStringRows(template.tree, text => text, Object.keys(counts).length ? counts : undefined)) {
          const parts = bindRoleSegments(row.text, cast, PLACE, rooms, groups);
          const text = parts.map(part => part.text).join('');
          const expected: Span[] = [];
          let at = 0;
          for (const part of parts) {
            if (part.role) expected.push({ start: at, end: at + part.text.length, id: part.role });
            at += part.text.length;
          }
          const got = colored(text, lex);
          const where = `${label} · ${row.where}: ${text}`;
          // No false matches: every colored span is a name the binder wrote for that person.
          for (const span of got) expect(expected, `false match ${text.slice(span.start, span.end)} (${span.id}) in ${where}`).toContainEqual(span);
          for (const span of expected) {
            tagged++;
            const form = text.slice(span.start, span.end);
            const owned = lex.entries.find(entry => entry.id === span.id)?.forms.includes(form);
            if (!owned) { shared++; expect(got.some(entry => entry.start === span.start), `a shared form is colored in ${where}`).toBe(false); continue; }
            expect(got, `missed ${form} (${span.id}) in ${where}`).toContainEqual(span);
            matched++;
          }
        }
      }
      // Every name the binder wrote is colored, or uncolored because its form is shared.
      expect(tagged).toBeGreaterThan(500);
      expect(matched + shared).toBe(tagged);
      expect(matched).toBeGreaterThan(shared);
    });
  }
});

describe('people lexicon rules', () => {
  const cast: Record<string, CastIdentity> = {
    taker: { firstName: 'Joël', surname: 'Zieliński', pronouns: 'he' },
    owner: { firstName: 'Anahí', surname: 'Gonçalves', pronouns: 'she' },
    son: { firstName: 'Nur Aisyah', surname: 'Gonçalves', pronouns: 'they' },
    neighbor: { firstName: 'Mercy', surname: "O'Connell", pronouns: 'she' },
    caller: { firstName: 'Rowan', surname: 'Wren', pronouns: 'they' },
    others_1: { firstName: 'Ana', surname: 'Lindqvist', pronouns: 'they' },
    others_2: { firstName: 'Bea', surname: 'Haddad', pronouns: 'they' },
    others_3: { firstName: 'Cal', surname: 'Novak', pronouns: 'they' },
  };
  const publicKind = { taker: 'subject', owner: 'civilian', son: 'patient', neighbor: 'person', caller: 'person', others_1: 'subject', others_2: 'subject', others_3: 'subject' };
  const lex = buildLexicon({ cast, publicKind, withheld: new Set(['others_2', 'others_3']), located: new Set(Object.keys(cast).filter(id => id !== 'caller')), officers: OFFICERS, places: [PLACE, 'storage room'] });
  const people = (text: string) => segmentPeople(text, lex).filter(part => part.person).map(part => `${part.text}=${part.person!.kind}${part.person!.first ? '*' : ''}`);

  it('keeps every character: the parts join back to the text', () => {
    const text = "Joël Zieliński’s cousin calls Anahí. Park radios from Cedar Park Apartments, may it hold.";
    expect(segmentPeople(text, lex).map(part => part.text).join('')).toBe(text);
  });

  it('matches diacritics, apostrophes and possessives on whole names', () => {
    expect(people('Joël Zieliński’s hands shake. Zieliński waits.')).toEqual(['Joël Zieliński=subject*', 'Zieliński=subject']);
    expect(people("Mercy O'Connell and O’Connell’s dog.")).toEqual(["Mercy O'Connell=person*", 'O’Connell=person']);
    expect(people('Connell and Joëlle and AnahíX stay plain.')).toEqual([]);
  });

  it('takes two-word first names whole, never their first word alone', () => {
    expect(people('May Thiri Hale and May Thiri cover the door. May we go?')).toEqual(['May Thiri Hale=officer*', 'May Thiri=officer']);
    expect(people('Nur Aisyah is hurt. Nur waits.')).toEqual(['Nur Aisyah=civilian*']);
  });

  it('is case-sensitive, so ordinary words stay words', () => {
    expect(people('mercy, a bell and a wren in the park.')).toEqual([]);
    expect(people('Mercy rings the bell.')).toEqual(['Mercy=person*']);
  });

  it('never colors a shared surname, only the full names', () => {
    expect(people('Gonçalves calls Anahí Gonçalves and Nur Aisyah Gonçalves.')).toEqual(['Anahí Gonçalves=civilian*', 'Nur Aisyah Gonçalves=civilian*']);
  });

  it('leaves an officer form the call uses as a word uncolored', () => {
    const words = formsInText(OFFICERS.flatMap(officer => [officer.firstName, officer.surname]), 'Park the vehicle at the door first.');
    expect(words).toEqual(['Park']);
    const withWords = buildLexicon({ cast: {}, publicKind: {}, withheld: new Set(), located: new Set(), officers: OFFICERS, places: [], words });
    expect(segmentPeople('Park the vehicle. Dana Park waits.', withWords).filter(part => part.person).map(part => part.text)).toEqual(['Dana Park']);
  });

  it('masks places first, so the building never colors officer Park', () => {
    expect(people('Squads stage at Cedar Park Apartments. Park and Dana take the door.')).toEqual(['Park=officer*', 'Dana=officer']);
    expect(segmentPeople('Park', lex)[0].person?.id).toBe('off_park');
  });

  it('colors each member of a group list on its own', () => {
    expect(people('Ana, Bea and Cal stay with Joël.')).toEqual(['Ana=subject*', 'Bea=withheld*', 'Cal=withheld*', 'Joël=subject*']);
  });

  it('withholds followers and leaves people without a location uncolored', () => {
    expect(lex.entries.find(entry => entry.id === 'others_2')?.kind).toBe('withheld');
    expect(people('Rowan Wren called it in. Rowan waits.')).toEqual([]);
    expect(lex.masked).toEqual(expect.arrayContaining(['Rowan Wren', 'Rowan', 'Wren']));
    expect(lex.entries.find(entry => entry.id === 'son')?.kind).toBe('civilian');
  });

  it('marks only the first mention of each person in a text block', () => {
    expect(people('Joël, then Anahí, then Joël again.')).toEqual(['Joël=subject*', 'Anahí=civilian*', 'Joël=subject']);
  });
});

describe('lexiconFor on generated calls', () => {
  /** A call whose group drew followers. Going Live has no counted group, so the engine's group
   * fixture hosts it. */
  function hostageWithFollowers(): ScenarioDefinition {
    for (const scenario of fixtureCalls(GROUP_TEMPLATE, 40, 1, 'lexicon-group', 2))
      if (scenario.incidentPeople?.some(person => person.group?.role === 'follower' || person.group?.role === 'lookout')) return scenario;
    throw new Error('no group call with followers in 40 draws');
  }
  const scenario = hostageWithFollowers();
  const officers: LexiconOfficer[] = [{ id: 'off_a', firstName: 'Wen', surname: 'Liu', squad: 'A' }];

  it('colors by public kind, withholds every follower, and adds the deployed officers', () => {
    const lex = lexiconFor(scenario, null, officers);
    const followers = scenario.incidentPeople!.filter(person => person.group && person.group.role !== 'leader' && person.group.role !== 'lone').map(person => person.id);
    expect(followers.length).toBeGreaterThan(0);
    for (const id of followers) expect(lex.entries.find(entry => entry.id === id)?.kind).toBe('withheld');
    for (const [id, binding] of Object.entries(scenario.story!.bindings.people)) {
      if (followers.includes(id)) continue;
      const kind = lex.entries.find(entry => entry.id === id)?.kind;
      if (kind) expect(kind).toBe(binding.publicKind === 'patient' ? 'civilian' : binding.publicKind);
    }
    expect(lex.entries.find(entry => entry.id === 'off_a')).toMatchObject({ kind: 'officer', squad: 'A' });
    expect(lex.places).toContain(getBuilt(scenario.locationFamilyId, scenario.locationSeed).location.name);
  });

  it('leaves a person uncolored until their location is reported', () => {
    const [id, binding] = Object.entries(scenario.story!.bindings.people)[0];
    const located = lexiconFor(scenario, { knowledge: {} }, officers);
    const unlocated = lexiconFor(scenario, { knowledge: { [binding.locationFactId]: 'unknown' } }, officers);
    expect(located.entries.some(entry => entry.id === id)).toBe(true);
    expect(unlocated.entries.some(entry => entry.id === id)).toBe(false);
    const name = `${scenario.story!.cast![id].firstName} ${scenario.story!.cast![id].surname}`;
    expect(segmentPeople(name, unlocated).some(part => part.person)).toBe(false);
  });

  it('never reads hidden truth: changing kinds, holds and threats changes nothing', () => {
    const before = lexiconFor(scenario, null, officers);
    const altered = structuredClone(scenario);
    for (const person of altered.incidentPeople ?? []) {
      person.kind = person.kind === 'subject' ? 'hostage' : 'subject';
      person.hold = { by: 'nobody', kind: 'expressive' };
      person.threat = { armament: 'firearm', readiness: 'ready', disposition: 'hostile', intent: 'harm_others', awareness: 'aware' } as never;
    }
    const after = lexiconFor(altered, null, officers);
    expect(after.entries).toEqual(before.entries);
  });

  it('memoizes per scenario, knowledge and officers', () => {
    expect(lexiconFor(scenario, null, officers)).toBe(lexiconFor(scenario, { knowledge: {} }, officers));
    expect(lexiconFor(scenario, null, [])).not.toBe(lexiconFor(scenario, null, officers));
  });
});
