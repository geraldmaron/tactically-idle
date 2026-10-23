import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EmblemArt } from './EmblemArt';
import { GearArt } from './GearArt';
import { ManagerPortrait } from './ManagerArt';

describe('art fallbacks keep the set frame and the icon grid', () => {
  it('a vacant seat is a silhouette with the post icon, never initials', () => {
    for (const size of [40, 60, 108]) {
      const html = renderToStaticMarkup(createElement(ManagerPortrait, { person: null, size, emptyIcon: 'star' }));
      expect(html).toContain('data-portrait="unavailable"');
      expect(html).toContain('class="silhouette');
      expect(html).toContain('class="icon');
      expect(html).not.toContain('manager-initials');
    }
  });
  it('gear without a painting is a kit icon on round enamel at a kit size', () => {
    for (const [size, px] of [[24, 16], [34, 20], [128, 24]] as const) {
      const html = renderToStaticMarkup(createElement(GearArt, { itemId: 'unknown_item', size }));
      expect(html).toContain('art-fallback');
      expect(html).toContain(`width:${size}px`);
      expect(html).toMatch(new RegExp(`<svg[^>]*width="${px}"`));
      expect(html).not.toContain('<img');
    }
  });
  it('an emblem without a painting snaps the icon to the kit sizes', () => {
    for (const [iconSize, px] of [[14, 16], [18, 20], [22, 24], [40, 24]] as const) {
      const html = renderToStaticMarkup(createElement(EmblemArt, { id: 'no_such_emblem', icon: 'mortarboard', size: 48, iconSize }));
      expect(html).toContain('art-fallback');
      expect(html).toMatch(new RegExp(`<svg[^>]*width="${px}"`));
    }
  });
});
