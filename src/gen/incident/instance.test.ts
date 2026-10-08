import { describe, expect, it } from 'vitest';
import { INCIDENT_TEMPLATES } from '../../content/incidents';
import type { IncidentClass, IncidentTemplate } from '../../content/incidents/types';
import { buildLocation } from '../../sim/location';
import type { IncidentType } from '../../sim/scenario-types';
import { drawIncidentSpec, generateIncident } from './index';
import { aggregates, countTemplate, drawInstance, instanceOf, signature } from './instance';
import { placeCast, TOKEN, withCallTree } from './trees-v13/compile';
import type { CastDraw } from './trees-v13/compile';

const templates = Object.values(INCIDENT_TEMPLATES) as IncidentTemplate[];
const EXPECTED_CLASS: Partial<Record<IncidentType, IncidentClass>> = {
  hostage_crisis: 'victim', barricaded: 'barricade', active_armed_incident: 'active_threat', protected_rescue: 'rescue',
};

describe('incident templates', () => {
  for (const template of templates) describe(template.type, () => {
    it('binds every tree role to exactly one slot and models every situation', () => {
      const bound = template.cast.flatMap(slot => slot.keyRoles);
      expect([...bound].sort()).toEqual(template.tree.roles.map(role => role.id).sort());
      for (const slot of template.cast) expect(slot.count.min, slot.id).toBeGreaterThanOrEqual(Math.max(1, slot.keyRoles.length) - (slot.keyRoles.length ? 0 : 1));
      expect(template.situations.map(situation => situation.index).sort()).toEqual(template.tree.situations.map((_, index) => index));
    });

    it('draws on generated calls: the instance and the compiled scenario agree on who is where', () => {
      let state = 404;
      const signatures = new Set<string>();
      for (let i = 0; i < 24; i++) {
        const drawn = drawIncidentSpec(state, { level: 10, trust: 90, contentVersion: 13, unlockedTypes: [template.type] });
        state = drawn.state;
        const s = generateIncident(drawn.spec);
        const instance = instanceOf(s, buildLocation(s.locationFamilyId, s.locationSeed))!;
        expect(instance).not.toBeNull();
        for (const person of instance.people.filter(entry => entry.roleKey)) {
          const binding = s.story!.bindings.people[person.roleKey!];
          if (person.position.kind === 'offsite') continue;
          expect(person.position.spaceId, person.id).toBe(binding.initial.spaceId);
          expect(person.position.at, person.id).toEqual(binding.initial.at);
          expect(person.name?.first, person.id).toBe(s.story!.cast![person.roleKey!].firstName);
        }
        expect(aggregates(instance).incidentClass).toBe(EXPECTED_CLASS[template.type]);
        signatures.add(signature(instance));
      }
      expect(signatures.size).toBeGreaterThan(1);
    }, 120000);
  });

  // §13: who someone is never changes what happens. The same call compiled with everyone drawn as he,
  // as she and as they differs only in its words.
  it('compiles identical mechanics whoever is drawn', () => {
    const mechanics = (value: unknown): unknown => typeof value === 'string' ? '#' : Array.isArray(value) ? value.map(mechanics)
      : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, mechanics(entry)])) : value;
    for (const template of templates) {
      let state = 77;
      for (let i = 0; i < 6; i++) {
        const drawn = drawIncidentSpec(state, { level: 10, trust: 90, contentVersion: 13, unlockedTypes: [template.type] });
        state = drawn.state;
        const s = generateIncident(drawn.spec);
        const built = buildLocation(s.locationFamilyId, s.locationSeed);
        const spec = { ...s.incident!, familyId: s.locationFamilyId.split('__')[0], buildingSeed: s.locationSeed };
        const as = (pronouns: 'he' | 'she' | 'they'): CastDraw => Object.fromEntries(template.tree.roles.map(role => [role.id, { pronouns, age: 14 }]));
        const compiled = (['he', 'she', 'they'] as const).map(pronouns => mechanics(withCallTree({ ...s, incident: spec }, built, template.tree, placeCast(template.tree, built, spec, as(pronouns)))));
        expect(compiled[1], template.type).toEqual(compiled[0]);
        expect(compiled[2], template.type).toEqual(compiled[0]);
      }
    }
  }, 120000);

  it('draws pronouns the same way for every kind of person', () => {
    const tally: Record<string, Record<string, number>> = {};
    for (const template of templates) {
      let state = 9001;
      for (let i = 0; i < 80; i++) {
        const drawn = drawIncidentSpec(state, { level: 10, trust: 90, contentVersion: 13, unlockedTypes: [template.type] });
        state = drawn.state;
        const s = generateIncident(drawn.spec);
        const instance = drawInstance(template, buildLocation(s.locationFamilyId, s.locationSeed), { ...s.incident!, familyId: s.locationFamilyId.split('__')[0], buildingSeed: s.locationSeed });
        for (const person of instance.people) { tally[person.kind] ??= { he: 0, she: 0, they: 0 }; tally[person.kind][person.pronouns]++; }
      }
    }
    for (const [kind, counts] of Object.entries(tally)) {
      const total = counts.he + counts.she + counts.they;
      expect(counts.she / total, `${kind} drawn as she`).toBeGreaterThan(0.3);
      expect(counts.he / total, `${kind} drawn as he`).toBeGreaterThan(0.3);
      expect(counts.they, `${kind} drawn as they`).toBeGreaterThan(0);
    }
    expect(tally.subject.she, 'subjects can be women').toBeGreaterThan(0);
  }, 120000);

  it('writes template text with tokens, never a gendered word', () => {
    const GENDERED = /\b(he|him|his|himself|she|her|hers|herself|man|men|woman|women|boy|girl|son|daughter|mother|father|husband|wife)\b/i;
    const texts = (value: unknown, key = ''): string[] => typeof value === 'string' ? (['label', 'text', 'value', 'source', 'offsite', 'to'].includes(key) ? [value] : [])
      : Array.isArray(value) ? value.flatMap(entry => texts(entry, key)) : value && typeof value === 'object' ? Object.entries(value).flatMap(([k, entry]) => k === 'tree' ? [] : texts(entry, k)) : [];
    for (const template of templates) for (const text of texts(template)) expect(text.replace(TOKEN, ''), `${template.type}: "${text}"`).not.toMatch(GENDERED);
  });

  // Slice 5: nobody is drawn who isn't an engine person. Everyone past a slot's key roles is a member
  // of a group the tree names (groups.test.ts holds the members to the key roles' rules).
  it('refuses a slot that draws people past its key roles without a group to put them in', () => {
    // The barricade names no group (the hostage call does since the slice 5 pilot).
    const barricade = INCIDENT_TEMPLATES.barricaded!;
    const loose: IncidentTemplate = { ...barricade, cast: barricade.cast.map(slot => slot.id === 'subjects' ? { ...slot, count: { min: 2, max: 2 } } : slot) };
    const s = generateIncident(drawIncidentSpec(5, { level: 10, trust: 90, contentVersion: 13, unlockedTypes: ['barricaded'] }).spec);
    const spec = { ...s.incident!, familyId: s.locationFamilyId.split('__')[0], buildingSeed: s.locationSeed };
    expect(() => drawInstance(loose, buildLocation(s.locationFamilyId, s.locationSeed), spec)).toThrow(/names no group/);
  });

  it('counts what the four dispatched calls can produce', () => {
    const counts = templates.map(countTemplate);
    expect(counts.reduce((sum, count) => sum + count.setups, 0)).toBe(33);
    for (const count of counts) expect(count.signatures).toBe(count.setups * count.pacingVariants * count.castShapes * count.complicationSets);
  });
});
