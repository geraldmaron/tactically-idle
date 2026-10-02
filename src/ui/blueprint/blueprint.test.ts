import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MAPLE_STREET } from '../../content/locations/maple-street';
import { TWO_FLOOR_FIXTURE } from '../../content/locations/two-floor-fixture';
import { VALID_TINY } from '../../content/locations/test-fixtures';
import { BUILDING_FAMILIES, generateBuilding } from '../../gen/building';
import { deriveLocation } from '../../sim/location';
import type { BuiltLocation, LocationDefinition, SpaceView } from '../../sim/types';
import { Blueprint } from './Blueprint';
import { floorScene } from './floors';
import { computeFrame } from './frame';
import { bboxOf, distToPolygonEdges, pointInPolygon, rectsOverlapArea } from './geometry';
import { computeLayout, type LabelItem } from './layout';
import { PlanLabel } from './labels';
import { placeOverlays } from './overlays';
import { unitsPerPixel } from './useViewport';

const build = (location: LocationDefinition): BuiltLocation => ({ location, derived: deriveLocation(location), issues: [] });
const views = (loc: LocationDefinition): SpaceView[] => [...loc.rooms, ...loc.zones].map((s) => ({ id: s.id, label: s.label, status: 'none', marker: null, squadsHere: [], facts: [], people: [], actionIds: [] }));
const labelBox = (l: LabelItem) => {
  const lines = l.lines ?? [l.text];
  const w = Math.max(...lines.map((line) => line.length)) * 0.6 * l.size;
  const h = l.size * 1.1 + (lines.length - 1) * l.size * 1.15;
  const cx = l.x - (l.rot ? l.size * 0.36 : 0);
  const cy = l.y + (l.rot ? 0 : -l.size * 0.36 + (lines.length - 1) * l.size * 1.15 / 2);
  return { x: cx - (l.rot ? h : w) / 2, y: cy - (l.rot ? w : h) / 2, w: l.rot ? h : w, h: l.rot ? w : h };
};
const markup = (built: BuiltLocation, spaces: SpaceView[], floor = 0) => renderToStaticMarkup(createElement(Blueprint, { built, spaces, squadTasks: [], selectedSpaceId: null, focusSquadId: null, floor }));

describe('blueprint label rendering', () => {
  it('renders long room names with the wrapping and type size that actually fit their room', () => {
    const loc = structuredClone(VALID_TINY);
    loc.objects = [];
    loc.rooms[1].label = 'Guest bedroom';
    const built = build(loc);
    const labels = computeLayout(built, views(loc), [], null).roomLabels;
    const label = labels.find((l) => l.id === 'b')!;
    expect(label.lines).toEqual(['GUEST', 'BEDROOM']);
    const html = renderToStaticMarkup(createElement(PlanLabel, { label, kind: 'room' }));
    expect(html).toContain('>GUEST</tspan>');
    expect(html).toContain('>BEDROOM</tspan>');
    expect(html).not.toContain('>GUEST BEDROOM<');
    expect(html).toContain(`font-size:${label.size}px`);
  });

  it('uses vertical lettering for a narrow room rather than spilling across its neighbours', () => {
    const loc = structuredClone(VALID_TINY);
    loc.objects = [];
    loc.rooms = [{ ...loc.rooms[0], label: 'Hallway', polygon: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 10 }, { x: 0, y: 10 }] }];
    const label = computeLayout(build(loc), views(loc), [], null).roomLabels[0];
    expect(label.rot).toBe(-90);
    const html = renderToStaticMarkup(createElement(PlanLabel, { label, kind: 'room' }));
    expect(html).toContain('transform="rotate(-90 ');
  });
});

describe('annotations refer to actual geometry', () => {
  it('marks the complete concave room without circling a different room in its bounding box', () => {
    const loc = structuredClone(VALID_TINY);
    loc.objects = [];
    const poly = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 3 }, { x: 4, y: 3 }, { x: 4, y: 15 }, { x: 0, y: 15 }];
    loc.rooms = [{ ...loc.rooms[0], polygon: poly, label: 'Shop' }];
    const spaces = views(loc);
    spaces[0].marker = { text: 'Reported', tone: 'amber' };
    const marker = computeLayout(build(loc), spaces, [], null).markers[0];
    expect(marker.outline).toEqual(poly);
    if (marker.arrow) expect(distToPolygonEdges(marker.arrow.to, poly)).toBeLessThan(0.001);
    else expect(pointInPolygon({ x: marker.box.x + marker.box.w / 2, y: marker.box.y + marker.box.h / 2 }, poly)).toBe(true);
  });

  it('keeps Maple Street knowledge text within its own room and apart from other markers', () => {
    const built = build(MAPLE_STREET.base);
    const spaces = views(built.location);
    spaces.find((s) => s.id === 'bedroom_e')!.marker = { text: 'Unknown', tone: 'amber' };
    spaces.find((s) => s.id === 'kitchen')!.marker = { text: 'Movement?', tone: 'amber', subtext: 'per neighbour' };
    const layout = computeLayout(built, spaces, [], null, computeFrame(built, [], spaces));
    for (const marker of layout.markers) {
      const poly = built.location.rooms.find((r) => r.id === marker.spaceId)!.polygon;
      for (const x of [marker.box.x, marker.box.x + marker.box.w]) for (const y of [marker.box.y, marker.box.y + marker.box.h]) expect(pointInPolygon({ x, y }, poly)).toBe(true);
      expect(marker.arrow).toBeNull();
    }
    expect(rectsOverlapArea(layout.markers[0].box, layout.markers[1].box)).toBe(0);
  });

  it.each(BUILDING_FAMILIES.map((family) => family.id))('keeps knowledge text clear of room names in %s', (family) => {
    for (const seed of [0, 2, 17]) {
      const loc = generateBuilding(family, seed);
      const built = build(loc);
      const spaces = views(loc);
      const target = spaces.find((s) => s.id === 'bedroom_e' || s.id === 'bedroom' || s.id === 'shop')!;
      target.marker = { text: 'Movement?', tone: 'amber', subtext: 'per caller' };
      const layout = computeLayout(built, spaces, [], null, computeFrame(built, [], spaces));
      expect(layout.markers).toHaveLength(1);
      for (const label of layout.roomLabels) expect(rectsOverlapArea(layout.markers[0].box, labelBox(label)), `${family} seed ${seed}: ${label.id}`).toBe(0);
      for (const label of layout.roomLabels) {
        const r = labelBox(label);
        const poly = loc.rooms.find((room) => room.id === label.id)!.polygon;
        for (const x of [r.x, r.x + r.w]) for (const y of [r.y, r.y + r.h]) expect(pointInPolygon({ x, y }, poly), `${family} seed ${seed}: ${label.id}`).toBe(true);
      }
    }
  });

  it('does not invent a target for a general note and reaches the actual named fence', () => {
    const loc = structuredClone(MAPLE_STREET.base);
    loc.notes.push({ id: 'general', text: 'Access report', at: { x: 5, y: 3 }, decorative: true });
    const built = build(loc);
    const layout = computeLayout(built, views(loc), [], null, computeFrame(built, [], views(loc)));
    expect(layout.notes.find((n) => n.id === 'general')!.arrow).toBeNull();
    const arrow = layout.notes.find((n) => n.id === 'n_fence')!.arrow!;
    expect(arrow).not.toBeNull();
    expect(arrow.to.x).toBe(48.5);
    expect(arrow.to.y).toBeGreaterThanOrEqual(6);
    expect(arrow.to.y).toBeLessThanOrEqual(42);
    const frontDoor = loc.openings.find((o) => o.id === layout.front!.openingId)!;
    expect(layout.front!.arrow.to).toEqual({ x: (frontDoor.from.x + frontDoor.to.x) / 2, y: (frontDoor.from.y + frontDoor.to.y) / 2 });
  });

  it('preserves an exact reported blocker and never invents a blocker in empty space', () => {
    const built = build(VALID_TINY);
    const frame = { x: 0, y: 0, w: 30, h: 20 };
    const at = { x: 12, y: 8 };
    const overlays = placeOverlays(built, [{ kind: 'line', tone: 'blocked', from: { x: 1, y: 8 }, to: { x: 17, y: 8 }, blockedAt: at }], frame, []);
    expect(overlays[0].kind === 'line' && overlays[0].blockAt).toEqual(at);
    const empty = placeOverlays(built, [{ kind: 'line', tone: 'blocked', from: { x: 21, y: 18 }, to: { x: 28, y: 18 } }], frame, []);
    expect(empty[0].kind === 'line' && empty[0].blockAt).toBeNull();
  });

  it('keeps travel routes on their supplied corners instead of curving through walls', () => {
    const item = placeOverlays(build(VALID_TINY), [{ kind: 'path', points: [{ x: 2, y: 2 }, { x: 2, y: 8 }, { x: 8, y: 8 }] }], { x: 0, y: 0, w: 30, h: 20 }, [])[0];
    expect(item.d).toBe('M2 2 L2 8 L8 8');
  });
});

describe('floor isolation and map interaction geometry', () => {
  it('only draws and targets the selected storey while keeping tabs, stairs and knowledge available', () => {
    const built = build(TWO_FLOOR_FIXTURE);
    const spaces = views(built.location);
    spaces.find((s) => s.id === 'bedroom_u')!.marker = { text: 'Unknown', tone: 'amber' };
    const ground = markup(built, spaces, 0);
    const upper = markup(built, spaces, 1);
    expect(ground).toContain('data-space-label="living"');
    expect(ground).not.toContain('data-space-label="bedroom_u"');
    expect(ground).not.toContain('aria-label="Upstairs bedroom,');
    expect(upper).toContain('data-space-label="bedroom_u"');
    expect(upper).not.toContain('data-space-label="living"');
    expect(upper).not.toContain('aria-label="Living room,');
    expect(upper).not.toContain('aria-label="Front yard,');
    expect(ground).toContain('data-dir="up"');
    expect(upper).toContain('data-dir="down"');
    expect(ground).toContain('Upper floor, 1 unresolved marker');
    expect(upper).toContain('data-space="bedroom_u"');
  });

  it('filters squads, people, staging dots and action overlays together with rooms', () => {
    const built = build(TWO_FLOOR_FIXTURE);
    const spaces = views(built.location);
    spaces.find((s) => s.id === 'living')!.people = [{ id: 'down', at: { x: 20, y: 10 }, label: 'Resident', status: 'reported', floor: 0 }];
    spaces.find((s) => s.id === 'bedroom_u')!.people = [{ id: 'up', at: { x: 20, y: 10 }, label: 'Resident', status: 'reported', floor: 1 }];
    const scene = floorScene(built, spaces, [{ squadId: 'A', positionId: 'living', task: 'Search', stagingId: null, at: null }, { squadId: 'B', positionId: 'bedroom_u', task: 'Search', stagingId: null, at: null }], [{ kind: 'range', at: { x: 20, y: 10 }, radius: 10, tone: 'effective', floor: 0 }, { kind: 'range', at: { x: 20, y: 10 }, radius: 5, tone: 'effective', floor: 1 }], 1);
    expect(scene.squadTasks.map((t) => t.squadId)).toEqual(['B']);
    expect(scene.spaces.flatMap((s) => s.people.map((p) => p.id))).toEqual(['up']);
    expect(scene.overlays).toHaveLength(1);
    expect(scene.built.derived.stagingPoints.every((p) => p.floor === 1)).toBe(true);
    expect(scene.built.location.objects.map((o) => o.id)).toEqual(['o_bed_u']);
    expect(bboxOf(scene.built.location.footprint).h).toBe(8);
  });

  it('pans by the visible SVG scale when a portrait plan is letterboxed in a wide panel', () => {
    const view = { x: 0, y: 0, w: 50, h: 50 };
    expect(unitsPerPixel(view, 400, 200)).toBe(0.25);
    expect(unitsPerPixel(view, 200, 400)).toBe(0.25);
    expect(unitsPerPixel({ ...view, w: 25, h: 25 }, 400, 200)).toBe(0.125);
  });
});
