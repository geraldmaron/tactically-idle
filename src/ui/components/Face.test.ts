import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Face } from './Face';

describe('Face', () => {
  it('draws a role silhouette, never initials, when there is no photograph', () => {
    for (const kind of ['officer', 'subject', 'civilian', 'person', 'patrol'] as const) {
      const html = renderToStaticMarkup(createElement(Face, { kind, name: 'Ana Reyes' }));
      expect(html).toContain('data-face="silhouette"');
      expect(html).toContain('face-silhouette');
      expect(html).not.toMatch(/>AR</);
    }
  });
  it('draws an officer with no file portrait as the officer silhouette, not initials', () => {
    const officer = { id: 'o1', firstName: 'Ana', surname: 'Reyes', portrait: 'missing', role: 'entry' } as never;
    const html = renderToStaticMarkup(createElement(Face, { kind: 'officer', officer }));
    expect(html).toContain('data-face="silhouette"');
    expect(html).not.toMatch(/>AR</);
  });
  it('comes in three sizes and is decorative unless it is named', () => {
    expect(renderToStaticMarkup(createElement(Face, { size: 'sm' }))).toContain('face-sm');
    expect(renderToStaticMarkup(createElement(Face, { size: 'lg' }))).toContain('face-lg');
    expect(renderToStaticMarkup(createElement(Face, {}))).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(createElement(Face, { name: 'Ana Reyes' }))).toContain('aria-label="Ana Reyes"');
  });
});
