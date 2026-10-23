import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Portrait, currentPortraitKey, portraitSource } from './Portrait';
import { GearArt } from '../art/GearArt';
import { assetUrl } from '../art/assetUrl';
import { PERSONAS } from '../../content/personas';
import portraitManifest from '../../../public/art/portraits/manifest.json';



const officer = { id: 'off_test', identityId: 'missing_test_person', firstName: 'Sam', surname: 'West', portrait: '/art/portraits/person_100.webp', role: 'lead' as const };
describe('honest portrait and art rendering', () => {
  it('renders a deliberate personnel file without making a broken-image request', () => {
    const html = renderToStaticMarkup(createElement(Portrait, { officer, size: 120, age: 45 }));
    expect(html).toContain('Sam West; no photo on file');
    // The stand-in is the shared role silhouette, never initials and no caption (callers crop and overlay the art).
    expect(html).toContain('class="silhouette');
    expect(html).not.toContain('>SW<');
    const small = renderToStaticMarkup(createElement(Portrait, { officer, size: 80 }));
    expect(small).toContain('Sam West; no photo on file');
    expect(small).toContain('class="silhouette');
    expect(small).not.toContain('>SW<');
    expect(small).not.toContain('NO PHOTO');
    expect(html).not.toContain('NO PHOTO');
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
        } else {
          expect(html).toContain('no photo on file');
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
      expect(html).toContain('no photo on file');
      expect(html).not.toContain('<img');
    }
  });
  it('requires an explicit current identity instead of inferring a person from an old seat', () => {
    for (const person of PERSONAS.filter((p) => p.legacyOfficerId)) {
      expect(currentPortraitKey({ ...officer, ...person, identityId: undefined, id: person.legacyOfficerId!, portrait: 'proc:old' })).toBeNull();
    }
  });

  it('retains semantic icons if an equipment image is not available', () => {
    const html = renderToStaticMarkup(createElement(GearArt, { itemId: 'unknown_item' }));
    expect(html).toContain('<svg');
    expect(html).not.toContain('<img');
  });
});
