import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Portrait, portraitSource } from './Portrait';
import { GearArt } from '../art/GearArt';
import { assetUrl } from '../art/assetUrl';

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
  it('preserves saved legacy procedural faces even after a known-identity migration', () => {
    const html = renderToStaticMarkup(createElement(Portrait, { officer: { ...officer, identityId: 'person_005', portrait: 'proc:1234' } }));
    expect(html).toContain('legacy-procedural');
    expect(html).toContain('Legacy portrait of Sam West');
  });
  it('does not hide a saved legacy painted portrait when its catalog replacement is absent', () => {
    const html = renderToStaticMarkup(createElement(Portrait, { officer: { ...officer, portrait: 'chen' } }));
    expect(html).toContain('portraits/chen.png');
    expect(html).not.toContain('NO PHOTO');
  });
  it('retains semantic icons if an equipment image is not available', () => {
    const html = renderToStaticMarkup(createElement(GearArt, { itemId: 'unknown_item' }));
    expect(html).toContain('<svg');
    expect(html).not.toContain('<img');
  });
});
