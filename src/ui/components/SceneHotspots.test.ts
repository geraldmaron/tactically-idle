// SceneHotspots: real buttons placed by percent, 44px to hit, named with their state, art optional.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { stylesheetsUnder } from '../../dev/lab/css-rules';
import { HOTSPOT_STATUS, hotspotName, SceneHotspots, type Hotspot } from './SceneHotspots';

const CSS = stylesheetsUnder('src/ui')['components/scene-hotspots.css'];
const spot = (patch: Partial<Hotspot> = {}): Hotspot => ({ id: 'academy', label: 'Training academy', state: 'lit', x: 10, y: 20, w: 25, h: 30, onSelect: vi.fn(), ...patch });
const render = (hotspots: Hotspot[], extra = {}) => renderToStaticMarkup(createElement(SceneHotspots, { plate: 'hub_hq', label: 'Station', hotspots, ...extra }));

describe('SceneHotspots markup', () => {
  it('draws one real button per place, named with its state, inside a labelled list', () => {
    const html = render([spot(), spot({ id: 'range', label: 'Range', state: 'dark' }), spot({ id: 'garage', label: 'Garage', state: 'ready' })]);
    expect(html.match(/<button type="button"/g)).toHaveLength(3);
    expect(html).toContain('aria-label="Training academy, open"');
    expect(html).toContain('aria-label="Range, not built"');
    expect(html).toContain('aria-label="Garage, ready to build"');
    expect(html).toContain('<ul class="scene-spots" aria-label="Station">');
    expect(html).toContain('scene-spot-lit');
    expect(html).toContain('scene-spot-dark');
    expect(html).toContain('scene-spot-ready');
  });

  it('places each box by percent of the plate and clamps to the plate', () => {
    const html = render([spot({ x: 10, y: 20, w: 25, h: 30 }), spot({ id: 'b', x: -5, y: 120, w: 150, h: 4 })]);
    expect(html).toContain('left:10%;top:20%;width:25%;height:30%');
    expect(html).toContain('left:0%;top:100%;width:100%;height:4%');
  });

  it('says a custom status aloud instead of the default', () => {
    expect(hotspotName(spot({ status: 'Locked until level 3', state: 'dark' }))).toBe('Training academy, Locked until level 3');
    expect(Object.keys(HOTSPOT_STATUS)).toEqual(['lit', 'dark', 'ready']);
  });

  it('hides the painted names from assistive technology, since the label says them, and can drop them', () => {
    expect(render([spot()])).toMatch(/<span class="scene-spot-name" aria-hidden="true">Training academy<\/span>/);
    expect(render([spot()], { names: false })).not.toContain('scene-spot-name');
  });

  it('puts a commissioned image over a place only when one is given, decorative', () => {
    expect(render([spot()])).not.toContain('scene-spot-img');
    const html = render([spot({ image: 'art/rooms/academy.webp' })]);
    expect(html).toMatch(/<img class="scene-spot-img" src="[^"]*art\/rooms\/academy\.webp" alt="" aria-hidden="true"/);
  });

  it('keeps the places when the plate is not ready, on the flat tone', () => {
    const html = renderToStaticMarkup(createElement(SceneHotspots, { plate: 'not_a_plate', label: 'Station', hotspots: [spot()] }));
    expect(html).not.toContain('plate-art');
    expect(html).toContain('aria-label="Training academy, open"');
  });

  it('paints the plate as decorative art when it is ready', () => {
    expect(render([spot()])).toMatch(/<img class="plate-art"[^>]*alt=""[^>]*aria-hidden="true"/);
  });
});

describe('SceneHotspots styles', () => {
  it('keeps every hit area at least 44px, centred on the box', () => {
    expect(CSS).toMatch(/\.scene-spot \{[^}]*width: max\(100%, var\(--touch\)\);[^}]*height: max\(100%, var\(--touch\)\);/);
    expect(CSS).toMatch(/\.scene-spot \{[^}]*transform: translate\(-50%, -50%\)/);
  });

  it('pulses the ready ring a finite number of times and stops it under reduced motion', () => {
    expect(CSS).toMatch(/\.scene-spot-ready \.scene-spot-fill \{[^}]*animation: scene-ready 1\.6s ease-out 2;/);
    expect(CSS).not.toMatch(/infinite/);
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.scene-spot-ready \.scene-spot-fill \{ animation: none !important; \}/);
  });

  it('shows a focus ring for keyboard users', () => {
    expect(CSS).toMatch(/\.scene-spot:focus-visible \{ outline: 2px solid var\(--act-hi\)/);
  });
});
