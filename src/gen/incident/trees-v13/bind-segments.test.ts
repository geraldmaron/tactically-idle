// bindRoleSegments is the oracle for the people-name matcher: the same binding as bindRoleTokens,
// with each name tagged by the person it came from. These tests hold it to two things on every
// string of every call tree, under three casts: the parts join to exactly what binding produced
// before segments existed (a frozen copy below), and every tagged part is a name of that person.
import { describe, expect, it } from 'vitest';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import { CASCADE_LINES, countWord, FIRE_LINES, FORCE_LINES, asRole, listOf } from '../../../content/incidents/lines';
import type { IncidentTemplate } from '../../../content/incidents/types';
import { bindRoleSegments, bindRoleTokens, memberId, TOKEN, type CastIdentity } from './compile';
import { callStringRows } from './strings';

// ---------------------------------------------------------------- frozen reference
// bindRoleTokens as it was before it became the join of bindRoleSegments (compile.ts, 2026-10-08).
// Do not edit: it is the byte-for-byte baseline the segments must reproduce.
const PRONOUN_FORMS: Record<string, Record<'he' | 'she' | 'they', string>> = {
  he: { he: 'he', she: 'she', they: 'they' }, him: { he: 'him', she: 'her', they: 'them' }, his: { he: 'his', she: 'her', they: 'their' },
  hers: { he: 'his', she: 'hers', they: 'theirs' }, himself: { he: 'himself', she: 'herself', they: 'themselves' },
};
const ENGINE_TOKENS = new Set(['lead']);
function referenceBind(text: string, cast: Record<string, CastIdentity>, place = '', rooms: Record<string, string> = {}, groups: Record<string, readonly string[]> = {}): string {
  return text.replace(TOKEN, (match: string, role: string, part?: string, singular?: string, plural?: string, heForm?: string, sheForm?: string, theyForm?: string, oneForm?: string, manyForm?: string) => {
    const bare = !part && singular === undefined && heForm === undefined && oneForm === undefined;
    if (ENGINE_TOKENS.has(role) && bare) return match;
    if (role === 'place' && bare && place) return place;
    if (role === 'scene' && bare && rooms.scene) return rooms.scene;
    if (part === 'room' && rooms[role]) return rooms[role];
    if (groups[role]) {
      const members = groups[role].map(id => cast[id]);
      if (!members.length || members.some(member => !member)) throw new Error(`No members of ${role} in this call for ${match} in "${text}"`);
      if (oneForm !== undefined) return members.length === 1 ? oneForm : manyForm!;
      const one = members.length === 1 ? members[0].pronouns : null;
      if (singular !== undefined) return one === 'he' || one === 'she' ? singular : plural!;
      if (heForm !== undefined) {
        if (!one) throw new Error(`A gendered word for ${members.length} members of ${role}: ${match} in "${text}" needs a count condition with max 1`);
        return one === 'he' ? heForm : one === 'she' ? sheForm! : theyForm!;
      }
      if (part === 'n') return countWord(members.length);
      if (part === 'first') return members[0].firstName;
      if (part === 'last') return members[0].surname;
      if (part && PRONOUN_FORMS[part.toLowerCase()]) {
        const word = PRONOUN_FORMS[part.toLowerCase()][one ?? 'they'];
        return part[0] === part[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word;
      }
      if (part) throw new Error(`Unknown group token ${match} in "${text}"`);
      return listOf(members.map(member => member.firstName));
    }
    const who = cast[role];
    if (!who || part === 'room' || part === 'n') throw new Error(`Unknown token ${match} in "${text}"`);
    if (oneForm !== undefined) return oneForm;
    if (singular !== undefined) return who.pronouns === 'they' ? plural! : singular;
    if (heForm !== undefined) return who.pronouns === 'he' ? heForm : who.pronouns === 'she' ? sheForm! : theyForm!;
    if (part === 'age') { if (who.age === undefined) throw new Error(`No age drawn for ${role} in "${text}"`); return String(who.age); }
    if (part && PRONOUN_FORMS[part.toLowerCase()]) {
      const word = PRONOUN_FORMS[part.toLowerCase()][who.pronouns];
      return part[0] === part[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word;
    }
    return part === 'first' ? who.firstName : part === 'last' ? who.surname : `${who.firstName} ${who.surname}`;
  });
}

// ---------------------------------------------------------------- casts
// Names that trip a matcher: two-word first names, diacritics, apostrophes, ordinary words.
const NAMES: readonly [string, string][] = [
  ['May Thiri', 'O\'Connell'], ['Joël', 'Zieliński'], ['Anahí', 'Gonçalves'], ['Mercy', 'Park'], ['Te Rangi', 'Bell'],
  ['Rowan', 'Wren'], ['Nur Aisyah', 'Lee'], ['Sol', 'Ines'], ['Ash', 'Moretti'], ['Ruth', 'Vann'], ['Ana', 'Singh'], ['Lee', 'Aung'],
];
const PRONOUNS = ['he', 'she', 'they'] as const;

interface Draw { label: string; size: (max: number) => number; pronouns: (i: number) => 'he' | 'she' | 'they'; name: (i: number) => [string, string] }
const DRAWS: readonly Draw[] = [
  { label: 'mixed pronouns, groups at their largest', size: max => max, pronouns: i => PRONOUNS[i % 3], name: i => NAMES[i % NAMES.length] },
  { label: 'everyone they, groups of one', size: max => Math.min(1, max), pronouns: () => 'they', name: i => NAMES[(i + 5) % NAMES.length] },
  // Shared surnames: every second person shares the one before's.
  { label: 'she and he, groups of two, shared surnames', size: max => Math.min(2, max), pronouns: i => i % 2 ? 'he' : 'she', name: i => [NAMES[(i + 3) % NAMES.length][0], NAMES[Math.floor(i / 2) % NAMES.length][1]] },
];

function bindingFor(template: IncidentTemplate, draw: Draw) {
  const groups = Object.fromEntries(Object.entries(template.tree.groups ?? {}).map(([group, spec]) => {
    const slot = template.cast.find(entry => entry.id === spec.slot);
    const size = draw.size(slot ? Math.max(0, slot.count.max - slot.keyRoles.length) : 0);
    return [group, Array.from({ length: size }, (_, i) => memberId(group, i + 1))];
  }));
  const ids = [...template.tree.roles.map(role => role.id), ...Object.values(groups).flat()];
  const cast: Record<string, CastIdentity> = Object.fromEntries(ids.map((id, i) => {
    const [firstName, surname] = draw.name(i);
    return [id, { firstName, surname, pronouns: draw.pronouns(i), age: 30 + i }];
  }));
  const rooms = { scene: 'storage room', ...Object.fromEntries([...ids, ...Object.keys(groups)].map(id => [id, 'sales floor'])) };
  const counts = Object.fromEntries(Object.entries(groups).map(([group, members]) => [group, members.length]));
  return { cast, groups, rooms, counts: Object.keys(counts).length ? counts : undefined, place: 'Cedar Park Apartments' };
}

/** Every name form a person can be written as. */
const formsOf = (who: CastIdentity) => [who.firstName, who.surname, `${who.firstName} ${who.surname}`];

const TEMPLATES = Object.values(INCIDENT_TEMPLATES).filter((template): template is IncidentTemplate => !!template?.tree);

describe('bindRoleSegments', () => {
  it('covers the four call trees', () => {
    expect(TEMPLATES.map(template => template.type).sort()).toEqual(['active_armed_incident', 'barricaded', 'hostage_crisis', 'protected_rescue']);
  });

  for (const template of TEMPLATES) for (const draw of DRAWS) {
    it(`${template.type}, ${draw.label}: joins to the frozen binding and tags only that person's names`, () => {
      const { cast, groups, rooms, counts, place } = bindingFor(template, draw);
      const rows = callStringRows(template.tree, text => text, counts);
      expect(rows.length).toBeGreaterThan(50);
      let named = 0;
      for (const row of rows) {
        const parts = bindRoleSegments(row.text, cast, place, rooms, groups);
        const bound = referenceBind(row.text, cast, place, rooms, groups);
        expect(parts.map(part => part.text).join(''), row.where).toBe(bound);
        expect(bindRoleTokens(row.text, cast, place, rooms, groups), row.where).toBe(bound);
        for (const [i, part] of parts.entries()) {
          expect(part.text, `empty part in ${row.where}`).not.toBe('');
          if (i > 0) expect(!!part.role || !!parts[i - 1].role, `unmerged plain parts in ${row.where}`).toBe(true);
          if (!part.role) continue;
          named++;
          expect(cast[part.role], `${part.role} in ${row.where}`).toBeDefined();
          expect(formsOf(cast[part.role]), `${part.role} in ${row.where}`).toContain(part.text);
          if (part.group) expect(groups[part.group], `${part.group} in ${row.where}`).toContain(part.role);
          else expect(Object.values(groups).flat(), `${part.role} in ${row.where} is a member without its group`).not.toContain(part.role);
        }
      }
      expect(named).toBeGreaterThan(10);
    });
  }

  it('tags each member of a group list and keeps listOf joining them', () => {
    const cast: Record<string, CastIdentity> = {
      lead: { firstName: 'Ruth', surname: 'Vann', pronouns: 'she' },
      others_1: { firstName: 'Sol', surname: 'Ines', pronouns: 'he' },
      others_2: { firstName: 'May Thiri', surname: 'Aung', pronouns: 'they' },
      others_3: { firstName: 'Joël', surname: 'O\'Connell', pronouns: 'she' },
    };
    const three = { others: ['others_1', 'others_2', 'others_3'] };
    expect(bindRoleSegments('{others} {others#waits|wait} with {owner.first}.', { ...cast, owner: cast.lead }, '', {}, three)).toEqual([
      { text: 'Sol', role: 'others_1', group: 'others' }, { text: ', ' },
      { text: 'May Thiri', role: 'others_2', group: 'others' }, { text: ' and ' },
      { text: 'Joël', role: 'others_3', group: 'others' }, { text: ' wait with ' },
      { text: 'Ruth', role: 'owner' }, { text: '.' },
    ]);
    expect(bindRoleSegments('{others}, {others.first} and {others_2.last}', cast, '', {}, { others: ['others_2'] })).toEqual([
      { text: 'May Thiri', role: 'others_2', group: 'others' }, { text: ', ' },
      { text: 'May Thiri', role: 'others_2', group: 'others' }, { text: ' and ' },
      { text: 'Aung', role: 'others_2', group: 'others' },
    ]);
  });

  it('leaves pronouns, verb forms, places, rooms, counts and engine tokens plain', () => {
    const cast: Record<string, CastIdentity> = { taker: { firstName: 'Lee', surname: 'Park', pronouns: 'they', age: 41 }, others_1: { firstName: 'Sol', surname: 'Ines', pronouns: 'he' } };
    const parts = bindRoleSegments('{taker.He} {taker~keeps|keep} {taker.his} {taker^man|woman|person} ({taker.age}) in {taker.room} at {place}, {others.n} with {others.him}. {lead} calls {taker}.',
      cast, 'Cedar Park Apartments', { taker: 'the back office' }, { others: ['others_1'] });
    expect(parts).toEqual([
      { text: 'They keep their person (41) in the back office at Cedar Park Apartments, one with him. {lead} calls ' },
      { text: 'Lee Park', role: 'taker' }, { text: '.' },
    ]);
  });

  it('throws exactly as binding did on an unknown token', () => {
    const cast: Record<string, CastIdentity> = { taker: { firstName: 'Lee', surname: 'Park', pronouns: 'he' } };
    for (const text of ['{nobody} waits.', '{taker.n}', '{others} wait.', '{taker.age}'])
      expect(() => bindRoleSegments(text, cast, '', {}, { others: [] })).toThrow(String((() => { try { referenceBind(text, cast, '', {}, { others: [] }); } catch (error) { return (error as Error).message; } return 'no error'; })()));
  });

  it('starts at the beginning whatever TOKEN.lastIndex a caller left behind', () => {
    const cast: Record<string, CastIdentity> = { taker: { firstName: 'Lee', surname: 'Park', pronouns: 'he' } };
    TOKEN.lastIndex = 5;
    try {
      expect(bindRoleTokens('{taker} and {taker.first}', cast)).toBe('Lee Park and Lee');
    } finally {
      TOKEN.lastIndex = 0;
    }
  });

  it('binds the standard drawn-consequence lines the same as before', () => {
    const lines = [...Object.values(FIRE_LINES), ...Object.values(FORCE_LINES).flatMap(entry => Object.values(entry)),
      ...Object.values(CASCADE_LINES).flatMap(entry => [entry.one, entry.many])].map(line => asRole(line, 'x').replace('{names}', '{others}'));
    for (const pronouns of PRONOUNS) for (const size of [1, 2, 3]) {
      const others = Array.from({ length: size }, (_, i) => memberId('others', i + 1));
      const cast: Record<string, CastIdentity> = { x: { firstName: 'Ash', surname: 'Lee', pronouns }, ...Object.fromEntries(others.map((id, i) => [id, { firstName: NAMES[i][0], surname: NAMES[i][1], pronouns }])) };
      for (const line of lines) expect(bindRoleTokens(line, cast, '', {}, { others }), line).toBe(referenceBind(line, cast, '', {}, { others }));
    }
  });
});
