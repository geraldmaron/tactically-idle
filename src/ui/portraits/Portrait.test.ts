import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Portrait, currentPortraitKey, portraitSource } from './Portrait';
import { GearArt } from '../art/GearArt';
import { assetUrl } from '../art/assetUrl';
import { PERSONAS } from '../../content/personas';
import portraitManifest from '../../../public/art/portraits/manifest.json';
import { createInitialState } from '../../sim/department';
import { deserialize, serialize } from '../../sim/save';
import { dispatch } from '../../sim/game';

const officer = { id: 'off_test', identityId: 'missing_test_person', firstName: 'Sam', surname: 'West', portrait: '/art/portraits/person_100.webp', role: 'lead' as const };
describe('honest portrait and art rendering', () => {
  it('renders a deliberate personnel file without making a broken-image request', () => {
    const html = renderToStaticMarkup(createElement(Portrait, { officer, size: 80, age: 45 }));
    expect(html).toContain('NO PHOTO');
    expect(html).toContain('ON FILE');
    expect(html).toContain('Sam West; no photo on file');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('legacy-procedural');
  });
  it('keeps old painted URLs and uses BASE_URL for leading-slash new paths', () => {
    expect(portraitSource('chen')).toBe(`${import.meta.env.BASE_URL}portraits/chen.png`);
    expect(portraitSource('/art/portraits/person_001.webp')).toBe(`${import.meta.env.BASE_URL}art/portraits/person_001.webp`);
    expect(assetUrl('https://example.test/art.webp')).toBe('https://example.test/art.webp');
  });
  it('uses every ready catalog photograph even when the saved portrait is procedural, stale or wrong', () => {
    for (const person of PERSONAS) {
      for (const portrait of ['proc:1234', 'chen', '/art/portraits/person_100.webp']) {
        const saved = { ...officer, ...person, identityId: person.id, portrait };
        const before = structuredClone(saved);
        const html = renderToStaticMarkup(createElement(Portrait, { officer: saved }));
        if (portraitManifest.readyIds.includes(person.id)) {
          expect(html).toContain(`src="${assetUrl(person.portrait)}"`);
          expect(html).not.toContain('NO PHOTO');
        } else {
          expect(html).toContain('NO PHOTO');
          expect(html).not.toContain('<img');
        }
        expect(html).not.toContain('legacy-procedural');
        expect(saved).toEqual(before);
      }
    }
  });
  it('never identifies a legacy person by a borrowed portrait, matching name alone, or mismatched identity', () => {
    for (const saved of [
      { ...officer, identityId: undefined, portrait: 'proc:1234' },
      { ...officer, identityId: undefined, portrait: 'chen' },
      { ...officer, identityId: 'person_001', portrait: 'chen' },
      { ...officer, identityId: undefined, firstName: 'Mei', surname: 'Chen', portrait: 'chen' },
      { ...officer, identityId: undefined, id: 'off_chen', portrait: 'chen' },
    ]) {
      const html = renderToStaticMarkup(createElement(Portrait, { officer: saved }));
      expect(html).toContain('NO PHOTO');
      expect(html).not.toContain('<img');
      expect(html).not.toContain('<svg');
    }
  });
  it('upgrades exact legacy starter identities without needing to rewrite the save first', () => {
    for (const person of PERSONAS.filter((p) => p.legacyOfficerId)) {
      expect(currentPortraitKey({ ...officer, ...person, identityId: undefined, id: person.legacyOfficerId!, portrait: 'proc:old' })).toBe(person.portrait);
    }
  });
  it.each([3, 4])('keeps a v%i legacy recruit, shortlist and hire unchanged while replacing its procedural rendering', (version) => {
    const now = Date.UTC(2026, 9, 2);
    const saved = createInitialState(now, 18);
    saved.saveVersion = version;
    if (version === 3) {
      delete saved.personnel;
      for (const o of Object.values(saved.officers)) delete o.identityId;
    }
    const candidate = saved.candidates[0];
    delete candidate.officer.identityId;
    candidate.officer.id = 'off_old_recruit';
    candidate.officer.firstName = 'Sam';
    candidate.officer.surname = 'West';
    candidate.officer.portrait = 'proc:1234';
    candidate.shortlisted = true;
    const original = structuredClone(candidate);
    const migrated = deserialize(serialize(saved, now))!;
    expect(migrated).not.toBeNull();
    expect(migrated.candidates[0]).toEqual(original);
    expect(migrated.rngState).toBe(saved.rngState);
    expect(currentPortraitKey(migrated.candidates[0].officer)).toBeNull();
    const hired = dispatch(migrated, { type: 'hire', candidateId: original.id }, { now });
    expect(hired.result.ok).toBe(true);
    const person = hired.state.officers[original.officer.id];
    expect(person).toEqual({ ...original.officer, hiredAt: now });
    const reloaded = deserialize(serialize(hired.state, now))!;
    expect(reloaded.officers[person.id]).toEqual(person);
    const html = renderToStaticMarkup(createElement(Portrait, { officer: reloaded.officers[person.id] }));
    expect(html).toContain('Personnel file for Sam West; no photo on file');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('<img');
  });
  it('retains semantic icons if an equipment image is not available', () => {
    const html = renderToStaticMarkup(createElement(GearArt, { itemId: 'unknown_item' }));
    expect(html).toContain('<svg');
    expect(html).not.toContain('<img');
  });
});
