// The drawn frame: the part of the lot the sheet actually shows. The house fills the sheet; only the
// exterior ground the scenario really uses (porch, steps, entries' staging points, squads, people, notes,
// the FRONT mark, planting, fence) extends the frame beyond a thin ring of yard around the footprint.
import type { BuiltLocation, SpaceView, SquadTask, Vec } from '../../sim/types';
import { bboxOf, clipPolyToRect, inflate, type Rect } from './geometry';
import { objectRect } from './furniture';
import { FONT, computeFront } from './layout';

/** Yard ring kept around the footprint, feet. Holds window-side staging points and the dimension rows' extension lines. */
export const FRAME_PAD = 2.3;
/**
 * Depth of street, alley and parking ground kept in frame where the building actually meets it (an entry zone,
 * or a zone a door opens onto). These zones can be lot-sized; only this band around the footprint is drawn.
 */
export const BAND_PAD = 4.2;

const W_MARKER = 0.52;

/** Rough text extent of an authored note, matching layout.ts. */
export function noteRect(loc: BuiltLocation['location'], n: BuiltLocation['location']['notes'][number]): Rect {
  const size = FONT.note;
  const w = n.text.length * W_MARKER * size;
  const anchor = n.at.x < loc.bounds.w * 0.5 ? 'start' : 'end';
  const x0 = anchor === 'start' ? n.at.x : n.at.x - w;
  const shift = Math.max(0.6 - x0, Math.min(0, loc.bounds.w - 0.6 - (x0 + w)));
  const ax = n.at.x + shift;
  return { x: anchor === 'start' ? ax : ax - w, y: n.at.y - size, w, h: size * 1.4 };
}

export function computeFrame(built: BuiltLocation, squadTasks: SquadTask[], spaces: SpaceView[]): Rect {
  const loc = built.location;
  const fp = bboxOf(loc.footprint);
  let x0 = fp.x - FRAME_PAD;
  let y0 = fp.y - FRAME_PAD;
  let x1 = fp.x + fp.w + FRAME_PAD;
  let y1 = fp.y + fp.h + FRAME_PAD;
  const grow = (r: Rect) => {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  };
  const point = (p: Vec, r: number) => grow({ x: p.x - r, y: p.y - r, w: r * 2, h: r * 2 });

  for (const z of loc.zones) if (z.kind === 'porch') grow(bboxOf(z.polygon));
  if (loc.upperFootprint?.length) grow(bboxOf(loc.upperFootprint));
  // street / alley / parking: the band of those zones next to the building where it opens onto them
  const doorZones = new Set<string>(loc.entries);
  for (const o of loc.openings) if (o.type !== 'window' && o.type !== 'stair') (doorZones.add(o.a), doorZones.add(o.b));
  const band = inflate(fp, BAND_PAD);
  for (const z of loc.zones) {
    if (z.kind !== 'street' && z.kind !== 'alley' && z.kind !== 'parking') continue;
    if (!doorZones.has(z.id)) continue;
    const clip = clipPolyToRect(z.polygon, band);
    if (clip.length < 3) continue;
    // a strip along one side deepens the frame on that side only, not along the building's length
    const cb = bboxOf(clip);
    if (cb.w >= cb.h) grow({ x: x0, y: cb.y, w: x1 - x0, h: cb.h });
    else grow({ x: cb.x, y: y0, w: cb.w, h: y1 - y0 });
  }
  const zoneIds = new Set(loc.zones.map((z) => z.id));
  for (const o of loc.objects) if (zoneIds.has(o.in)) grow(objectRect(o));
  for (const n of loc.notes) grow(noteRect(loc, n));

  const front = computeFront(loc);
  if (front) {
    const w = 5 * 0.62 * FONT.front;
    const c = { x: front.center.x + front.out.x * 6.1, y: front.center.y + front.out.y * 6.1 };
    grow({ x: c.x - w / 2 - 0.9, y: c.y - FONT.front, w: w + 1.8, h: FONT.front * 2 });
  }

  for (const t of squadTasks) if (t.at) point(t.at, 2.4);
  for (const s of spaces) for (const p of s.people ?? []) point(p.at, 2.3);

  // never wider than the lot, snapped outward to half feet so tiny state changes do not shift the sheet
  x0 = Math.max(0, Math.floor(x0 * 2) / 2);
  y0 = Math.max(0, Math.floor(y0 * 2) / 2);
  x1 = Math.min(loc.bounds.w, Math.ceil(x1 * 2) / 2);
  y1 = Math.min(loc.bounds.h, Math.ceil(y1 * 2) / 2);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
