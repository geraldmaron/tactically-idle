import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PERSONA_BY_ID, personaNote } from '../../content/personas';
import { createInitialState } from '../../sim/department';
import { fullName } from '../../sim/officer';
import { deserialize, serialize } from '../../sim/save';
import { type GameState } from '../../sim/types';
import { OfficerCard } from './OfficerCard';
import { DepartmentContext } from './department-context';
import { currentPortraitKey } from '../portraits/Portrait';
import portraitManifest from '../../../public/art/portraits/manifest.json';

let state: GameState;
const NOW = Date.UTC(2026, 9, 5);
const escaped = (text: string) => renderToStaticMarkup(createElement('span', null, text)).slice(6, -7);

describe('sampled campaign identities in roster presentation', () => {
  it('keeps sampled names, biographies, ages and portraits authoritative over historical seat IDs after reload', () => {
    const original = createInitialState(NOW, 120);
    expect(original.officers.off_chen.identityId).not.toBe('person_001');
    state = deserialize(serialize(original, NOW))!;
    expect(state.officers).toEqual(original.officers);
    let ready = 0, fallback = 0;
    for (const officer of Object.values(state.officers)) {
      const person = PERSONA_BY_ID[officer.identityId!];
      const name = `${person.firstName} ${person.surname}`;
      expect(fullName(officer)).toBe(name);
      expect(personaNote(officer.identityId)).toBe(person.personalNote);
      // The game provides its department (App.tsx); the card ages the portrait from it.
      const html = renderToStaticMarkup(createElement(DepartmentContext.Provider, { value: state.department }, createElement(OfficerCard, { officer, now: NOW, variant: 'roster' })));
      expect(html).toContain(`aria-label="${escaped(name)},`);
      expect(html).toContain(`${escaped(name)} · age ${Math.floor(-officer.bornDay / 365)}`);
      if (portraitManifest.readyIds.includes(person.id)) {
        ready++;
        expect(currentPortraitKey(officer)).toBe(person.portrait);
        expect(html).toContain(`File portrait of ${escaped(name)}`);
      } else {
        fallback++;
        expect(currentPortraitKey(officer)).toBeNull();
        expect(html).toContain(`Personnel file for ${escaped(name)}; no photo on file`);
        expect(html).not.toContain('<img');
      }
      if (person.legacyOfficerId !== officer.id) {
        expect(currentPortraitKey({ ...officer, identityId: undefined })).toBeNull();
      }
    }
    expect(ready).toBe(Object.keys(state.officers).length);
    expect(fallback).toBe(0);
  });


});
