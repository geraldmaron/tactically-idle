// Label, marker, token and note placement. Pure; operates on feet. Placement searches avoid furniture
// and previously placed text so annotations stay legible without hand tuning per location.
import type { BuiltLocation, Id, LocationDefinition, Polygon, PublicCarriedItem, SpaceView, SquadId, SquadTask, Vec } from '../../sim/types';
import { add, areaOutside, bboxOf, clipPolyToRect, distToPolygonEdges, distToSegment, hash32, inflate, isRectilinearBox, len, mid, mulberry32, perp, pointInPolygon, poleOfInaccessibility, rectsOverlapArea, scale, sub, unit, type Rect } from './geometry';
import { isFloorLayer, objectRect } from './furniture';
import { isPath } from './walls';

export const FONT = {
  room: 1.75,
  zone: 1.28,
  marker: 1.75,
  front: 1.95,
  note: 1.75,
  task: 1.2,
  badge: 1.4,
  sub: 1.3,
  person: 1.45,
  overlay: 1.35,
  chip: 1.1,
};

/** Squad token radius when it stands at an exact staging point (smaller than the room-centroid badge). */
export const TOKEN_R = 1.15;
/** Readable at phone fit scale while still small enough to attach beside a person. */
export const CARRIED_SCALE = 1.55;
export const CARRIED_W = 1.12 * CARRIED_SCALE;
export const CARRIED_H = 1.35 * CARRIED_SCALE;

// rough glyph-width factors (em) per face
const W_COND = 0.6;
const W_MARKER = 0.52;
const W_TASK = 0.46;

export interface LabelItem {
  id: Id;
  text: string;
  /** Wrapped lines (room labels that needed two lines to fit). Absent = one line, `text`. */
  lines?: string[];
  x: number;
  y: number;
  size: number;
  rot: number;
}

export interface MarkerItem {
  spaceId: Id;
  tone: 'amber' | 'mint';
  text: string;
  /** Exact room/zone boundary: a report concerns this space, never its bounding ellipse. */
  outline: Polygon;
  size: number;
  box: Rect;
  textX: number;
  textY: number;
  textW: number;
  /** Smaller marker lettering under the word, e.g. 'per neighbour'. */
  sub: { text: string; x: number; y: number } | null;
  /** Only used for a callout that cannot fit inside its own space. */
  arrow: { from: Vec; to: Vec } | null;
  glyphAt: Vec;
}

export interface FrontItem {
  openingId: Id;
  text: Vec;
  band: Rect;
  arrow: { from: Vec; to: Vec };
}

export interface NoteItem {
  id: Id;
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'end';
  rot: number;
  arrow: { from: Vec; to: Vec } | null;
}

export interface SquadItem {
  squadId: SquadId;
  spaceId: Id;
  task: string;
  badge: Vec;
  /** Baseline position of the first label line. */
  label: Vec;
  anchor: 'start' | 'middle' | 'end';
  lines: string[];
  focus: boolean;
  /** Token radius (feet). */
  r: number;
  /** Standing point when the squad holds an exact staging point; null = centroid-style placement. */
  at: Vec | null;
  /** Short tick from the token toward the opening the squad holds. */
  tick: { from: Vec; to: Vec } | null;
}

export type PersonKindKey = 'subject' | 'civilian' | 'child' | 'patient' | 'dog' | 'unknown';

export interface PersonItem {
  id: Id;
  status: 'reported' | 'confirmed' | 'disproved';
  at: Vec;
  /** A neutral human silhouette is used when no public kind is known. */
  kind: PersonKindKey | null;
  label: { text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end' } | null;
  carried: (PublicCarriedItem & { at: Vec })[];
  condition?: 'injured' | 'deceased';
  /** Armament chip, exactly what the data says (never inferred). */
  chip: { text: string; x: number; y: number; w: number; h: number } | null;
  /** A 'reported' person whose label says 'last seen': drawn faded with a 'last seen' caption. */
  stale: boolean;
  caption: { text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end' } | null;
}

export interface Layout {
  roomLabels: LabelItem[];
  zoneLabels: LabelItem[];
  markers: MarkerItem[];
  front: FrontItem | null;
  notes: NoteItem[];
  squads: SquadItem[];
  people: PersonItem[];
  /** Small head-and-shoulders marks for the crowd the environment says is outside (ground floor, street zone). */
  crowd: Vec[];
  /** Everything placed so far (furniture and text boxes); overlays place their labels around these. */
  obstacles: Rect[];
  /** The frame the layout was fitted to. */
  frame: Rect;
}

function spacePolygons(loc: LocationDefinition): Map<Id, { poly: Polygon; zone: boolean }> {
  const m = new Map<Id, { poly: Polygon; zone: boolean }>();
  for (const r of loc.rooms) m.set(r.id, { poly: r.polygon, zone: false });
  for (const z of loc.zones) m.set(z.id, { poly: z.polygon, zone: true });
  return m;
}

function boxInside(box: Rect, poly: Polygon, margin: number): boolean {
  const pts: Vec[] = [];
  for (const fx of [0, 0.5, 1]) for (const fy of [0, 0.5, 1]) pts.push({ x: box.x + box.w * fx, y: box.y + box.h * fy });
  return pts.every((p) => pointInPolygon(p, poly) && distToPolygonEdges(p, poly) >= margin);
}

interface Spot {
  center: Vec;
  overlap: number;
  fits: boolean;
}

/** Best centre for a w x h box inside `poly`, close to `pref`, away from `obstacles`. */
function findSpot(poly: Polygon, w: number, h: number, pref: Vec, obstacles: Rect[], margin = 0.45, keepClear: Rect[] = []): Spot {
  const bb = bboxOf(poly);
  let best: Spot | null = null;
  let bestScore = Infinity;
  const step = 0.5;
  for (let y = bb.y; y <= bb.y + bb.h; y += step) {
    for (let x = bb.x; x <= bb.x + bb.w; x += step) {
      const box = { x: x - w / 2, y: y - h / 2, w, h };
      if (!boxInside(box, poly, margin) || keepClear.some((r) => rectsOverlapArea(box, r) > 0)) continue;
      let overlap = 0;
      for (const o of obstacles) overlap += rectsOverlapArea(box, o);
      const score = overlap * 24 + len(sub({ x, y }, pref)) * 0.5;
      if (score < bestScore) {
        bestScore = score;
        best = { center: { x, y }, overlap, fits: true };
      }
    }
  }
  return best ?? { center: pref, overlap: 0, fits: false };
}

const textRect = (cx: number, cy: number, w: number, h: number): Rect => ({ x: cx - w / 2, y: cy - h / 2, w, h });

interface TextPlace {
  /** Anchor x for the text element and the baseline of its first line. */
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  rect: Rect;
  score: number;
}

/** Best of right / left / below / above of a point for a w x h text block: no overlaps, inside the frame. */
function placeBeside(at: Vec, gap: number, w: number, h: number, firstBaseline: number, frame: Rect, obstacles: Rect[]): TextPlace {
  const cands: { rect: Rect; anchor: TextPlace['anchor']; x: number }[] = [
    { rect: { x: at.x + gap, y: at.y - h / 2, w, h }, anchor: 'start', x: at.x + gap },
    { rect: { x: at.x - gap - w, y: at.y - h / 2, w, h }, anchor: 'end', x: at.x - gap },
    { rect: { x: at.x - w / 2, y: at.y + gap, w, h }, anchor: 'middle', x: at.x },
    { rect: { x: at.x - w / 2, y: at.y - gap - h, w, h }, anchor: 'middle', x: at.x },
  ];
  let best: TextPlace | null = null;
  cands.forEach((c, i) => {
    let overlap = 0;
    for (const o of obstacles) overlap += rectsOverlapArea(c.rect, o);
    const score = overlap * 24 + areaOutside(c.rect, frame) * 80 + i * 0.4;
    if (!best || score < best.score) best = { x: c.x, y: c.rect.y + firstBaseline, anchor: c.anchor, rect: c.rect, score };
  });
  return best!;
}

/** Person text stays in the person's public room; the inspector keeps the full wording. */
function placePersonText(at: Vec, gap: number, w: number, h: number, baseline: number, poly: Polygon, obstacles: Rect[]): TextPlace | null {
  const near = placeBeside(at, gap, w, h, baseline, inflate(bboxOf(poly), -.25), obstacles);
  if (boxInside(near.rect, poly, .25) && obstacles.every((r) => rectsOverlapArea(near.rect, r) < .000001)) return near;
  const spot = findSpot(poly, w, h, at, obstacles, .25, obstacles);
  if (!spot.fits || len(sub(spot.center, at)) > 8) return null;
  return { x: spot.center.x, y: spot.center.y - h / 2 + baseline, anchor: 'middle', rect: textRect(spot.center.x, spot.center.y, w, h), score: 0 };
}

/** A possession is attached to its holder and stays in the same space. Try compact groups
 * beside/above/below the silhouette. If a very tight space cannot fit them, the inspector
 * still lists every item; never move an icon into a neighbouring room. */
function placeCarriedItems(at: Vec, items: PublicCarriedItem[], poly: Polygon, frame: Rect, obstacles: Rect[]): PersonItem['carried'] {
  for (let count = Math.min(3, items.length); count > 0; count--) {
    const cands: Vec[][] = [
      Array.from({ length: count }, (_, i) => ({ x: at.x + 3.3 + i * 1.85, y: at.y + .2 })),
      Array.from({ length: count }, (_, i) => ({ x: at.x - 3.3 - i * 1.85, y: at.y + .2 })),
      ...[-1, 1].map((side) => Array.from({ length: count }, (_, i) => ({ x: at.x + (i - (count - 1) / 2) * 1.85, y: at.y + side * 3.45 }))),
      ...[-1, 1].map((side) => Array.from({ length: count }, (_, i) => ({ x: at.x + side * 3.3, y: at.y + (i - (count - 1) / 2) * 2.2 }))),
    ];
    const valid = cands.map((points, index) => {
      const boxes = points.map((p) => textRect(p.x, p.y, CARRIED_W, CARRIED_H));
      const fits = boxes.every((box) => boxInside(box, poly, .15) && areaOutside(box, frame) < 0.000001);
      const connected = points.every((p) => [0, .25, .5, .75, 1].every((t) => pointInPolygon({ x: at.x + (p.x - at.x) * t, y: at.y + (p.y - at.y) * t }, poly)));
      const overlap = boxes.reduce((total, box) => total + obstacles.reduce((n, obstacle) => n + rectsOverlapArea(box, obstacle), 0), 0);
      return { points, fits: fits && connected && overlap < .000001, score: index };
    }).filter((c) => c.fits).sort((a, b) => a.score - b.score);
    if (valid[0]) return items.slice(0, count).map((item, i) => ({ ...item, at: valid[0].points[i] }));
  }
  return [];
}

export interface LayoutOptions {
  /** Environment crowd level: 0 none, 1 some, 2 crowd. */
  crowd?: 0 | 1 | 2;
  /** Draw exterior zone labels and the crowd (ground floor only). */
  exterior?: boolean;
}

export function computeLayout(built: BuiltLocation, spaces: SpaceView[], squadTasks: SquadTask[], focusSquadId: SquadId | null, frameIn?: Rect, opts: LayoutOptions = {}): Layout {
  const loc = built.location;
  const derived = built.derived;
  const frame: Rect = frameIn ?? { x: 0, y: 0, w: loc.bounds.w, h: loc.bounds.h };
  const polys = spacePolygons(loc);
  const viewById = new Map(spaces.map((s) => [s.id, s]));

  // obstacles: every object that sits above the floor
  const placed: Rect[] = loc.objects.filter((o) => !isFloorLayer(o.type)).map((o) => inflate(objectRect(o), 0.12));
  const protectedRects: Rect[] = [];
  const add_ = (r: Rect) => { placed.push(r); protectedRects.push(r); };

  // ---- front entry
  const front = computeFront(loc);
  let frontItem: FrontItem | null = null;
  if (front) {
    const text = 'FRONT';
    const w = text.length * 0.62 * FONT.front;
    const h = FONT.front * 1.15;
    const dist = 6.1;
    let tc = add(front.center, scale(front.out, dist));
    tc = { x: Math.max(frame.x + w / 2 + 0.6, Math.min(frame.x + frame.w - w / 2 - 0.6, tc.x)), y: Math.max(frame.y + h, Math.min(frame.y + frame.h - h / 2 - 0.4, tc.y)) };
    const band: Rect = { x: tc.x - w / 2 - 0.8, y: tc.y - h / 2 - 0.35, w: w + 1.6, h: h + 0.7 };
    const aTo = front.center;
    const aFrom = exitPoint(band, tc, unit(sub(aTo, tc)));
    frontItem = { openingId: front.openingId, text: tc, band, arrow: { from: aFrom, to: aTo } };
    add_(band);
    add_({ x: Math.min(aFrom.x, aTo.x) - 0.6, y: Math.min(aFrom.y, aTo.y), w: Math.abs(aFrom.x - aTo.x) + 1.2, h: Math.abs(aFrom.y - aTo.y) });
  }

  // ---- fixed glyphs first: squads that stand at a staging point and people marks claim their spot, text dodges them
  for (const t of squadTasks) if (t.at) add_({ x: t.at.x - TOKEN_R - 0.15, y: t.at.y - TOKEN_R - 0.15, w: TOKEN_R * 2 + 0.3, h: TOKEN_R * 2 + 0.3 });
  // Reserve every visible actor before placing any possessions: actor iteration order
  // must not put the first person's item over a later person's silhouette.
  for (const sv of spaces) for (const pm of sv.people ?? []) {
    if (pm.status !== 'reported' && pm.status !== 'confirmed') continue;
    const r = pm.status === 'reported' ? 2.1 : 1.9;
    add_({ x: pm.at.x - r, y: pm.at.y - r, w: r * 2, h: r * 2 });
  }
  const peopleDrawn: { id: Id; status: PersonItem['status']; at: Vec; kind: PersonKindKey | null; armament: string | null; labelText: string; poly: Polygon; carried: PersonItem['carried']; condition: PersonItem['condition'] }[] = [];
  for (const sv of spaces) {
    for (const pm of sv.people ?? []) {
      if (pm.status !== 'reported' && pm.status !== 'confirmed' && pm.status !== 'disproved') continue; // 'unknown' is never drawn
      const kind = personKind(pm.kind);
      const carried = pm.status === 'disproved' ? [] : placeCarriedItems(pm.at, pm.carried ?? [], polys.get(sv.id)?.poly ?? rectPolygon(frame), frame, placed);
      peopleDrawn.push({ id: pm.id, status: pm.status, at: pm.at, kind, armament: pm.armament ?? null, labelText: (pm.label ?? '').trim(), poly: polys.get(sv.id)?.poly ?? rectPolygon(frame), carried, condition: pm.condition });
      for (const item of carried) add_(textRect(item.at.x, item.at.y, CARRIED_W + .05, CARRIED_H + .05));
    }
  }

  // ---- room labels. The anchor is the pole of inaccessibility for notched rooms (the centroid of an L can sit
  // outside it). If the name does not fit on one line it wraps, then rotates, then shrinks.
  const roomLabels: LabelItem[] = [];
  for (const room of loc.rooms) {
    const view = viewById.get(room.id);
    if (!view) continue;
    const text = view.label.toUpperCase();
    const rb = bboxOf(room.polygon);
    const boxy = isRectilinearBox(room.polygon);
    const pole = boxy ? null : poleOfInaccessibility(room.polygon);
    const pref = pole ? { x: pole.x, y: pole.y } : (derived.spaces[room.id]?.centroid ?? { x: rb.x + rb.w / 2, y: rb.y + rb.h / 2 });
    let first: { v: LabelVariant; spot: Spot } | null = null;
    let pick: { v: LabelVariant; spot: Spot } | null = null;
    for (const v of labelVariants(text)) {
      const w = v.rot ? v.h : v.w;
      const h = v.rot ? v.w : v.h;
      const spot = findSpot(room.polygon, w, h, pref, placed, v.size < FONT.room ? 0.35 : 0.6);
      if (!spot.fits) continue;
      first ??= { v, spot };
      if (spot.overlap === 0) {
        pick = { v, spot };
        break;
      }
    }
    const chosen = pick ?? first;
    if (!chosen) {
      // nowhere inside: put it at the anchor, smallest size, so the room is still named
      const v = labelVariants(text).at(-1)!;
      roomLabels.push({ id: room.id, text, x: pref.x, y: pref.y + v.size * 0.36, size: v.size, rot: 0 });
      add_(textRect(pref.x, pref.y, v.w, v.h));
      continue;
    }
    const { v, spot } = chosen;
    const lh = v.size * 1.15;
    const firstBase = spot.center.y + (v.rot ? 0 : v.size * 0.36 - ((v.lines.length - 1) * lh) / 2);
    roomLabels.push({ id: room.id, text, lines: v.lines.length > 1 ? v.lines : undefined, x: spot.center.x + (v.rot ? v.size * 0.36 : 0), y: firstBase, size: v.size, rot: v.rot });
    add_(textRect(spot.center.x, spot.center.y, v.rot ? v.h : v.w, v.rot ? v.w : v.h));
  }

  // ---- knowledge labels. Room names claim their space first. Reports use the actual boundary;
  // only a label placed outside its room needs a leader, ending on that same room.
  const markers: MarkerItem[] = [];
  for (const view of spaces) {
    if (!view.marker) continue;
    const sp = polys.get(view.id);
    if (!sp) continue;
    const poly = sp.zone ? clipPolyToRect(sp.poly, frame) : sp.poly;
    if (poly.length < 3) continue;
    const pole = poleOfInaccessibility(poly);
    const text = view.marker.text.toUpperCase();
    const subText = view.marker.subtext?.trim() || null;
    let chosen: { size: number; textW: number; w: number; h: number; spot: Spot } | null = null;
    for (const size of [FONT.marker, FONT.marker * 0.86]) {
      const textW = text.length * 0.62 * size;
      const subW = subText ? subText.length * W_MARKER * FONT.sub + 0.3 : 0;
      const w = Math.max(textW + 2.7, subW + 0.6);
      const h = size * 1.35 + (subText ? FONT.sub * 1.25 : 0) + 0.4;
      const spot = findSpot(poly, w, h, pole, placed, 0.6, protectedRects);
      if (!chosen || (!spot.fits && !chosen.spot.fits) || (spot.fits && (!chosen.spot.fits || spot.overlap < chosen.spot.overlap))) chosen = { size, textW, w, h, spot };
      if (spot.fits && spot.overlap === 0) break;
    }
    const { size, textW, w, h, spot } = chosen!;
    const outside = !spot.fits;
    const center = outside ? findSpot(rectPolygon(frame), w, h, pole, [...placed, inflate(bboxOf(poly), 0.7)], 0.35, protectedRects).center : spot.center;
    const box = textRect(center.x, center.y, w, h);
    const textX = box.x + 0.3;
    const textY = box.y + size + 0.2;
    let arrow: MarkerItem['arrow'] = null;
    if (outside) {
      const to = closestOnPolygon(center, poly);
      const dir = unit(sub(to, center));
      const from = exitPoint(box, center, dir);
      if (len(sub(to, from)) > 0.5) arrow = { from, to };
    }
    markers.push({
      spaceId: view.id, tone: view.marker.tone, text, outline: poly, size, box,
      textX, textY, textW,
      sub: subText ? { text: subText, x: textX, y: textY + FONT.sub * 1.25 } : null,
      arrow, glyphAt: { x: box.x + w - 1.15, y: box.y + size * 0.7 + 0.2 },
    });
    add_(inflate(box, 0.2));
  }

  // ---- zone labels (small; tall narrow zones read vertically)
  const zoneLabels: LabelItem[] = [];
  for (const zone of loc.zones) {
    if (opts.exterior === false) break;
    const view = viewById.get(zone.id);
    if (!view) continue;
    const text = view.label.toUpperCase();
    const size = FONT.zone;
    const tw = text.length * W_COND * size;
    const th = size * 1.1;
    const zp = clipPolyToRect(zone.polygon, frame); // only the part of the zone the sheet shows
    if (zp.length < 3) continue;
    const bb = bboxOf(zp);
    const vertical = bb.h > bb.w * 1.6 && tw > bb.w - 1;
    const bw = vertical ? th : tw;
    const bh = vertical ? tw : th;
    const cen = { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 };
    const spot = findSpot(zp, bw, bh, pointInPolygon(cen, zp) ? cen : (derived.spaces[zone.id]?.centroid ?? cen), placed, 0.3);
    zoneLabels.push({ id: zone.id, text, x: spot.center.x, y: spot.center.y + (vertical ? 0 : size * 0.36), size, rot: vertical ? -90 : 0 });
    add_(textRect(spot.center.x, spot.center.y, bw, bh));
  }

  // ---- notes
  const notes: NoteItem[] = [];
  const extObjects = loc.objects.filter((o) => loc.zones.some((z) => z.id === o.in));
  for (const n of loc.notes) {
    const size = FONT.note;
    const w = n.text.length * W_MARKER * size;
    const anchor: 'start' | 'end' = n.at.x < loc.bounds.w * 0.5 ? 'start' : 'end';
    const x0 = anchor === 'start' ? n.at.x : n.at.x - w;
    const shift = Math.max(frame.x + 0.6 - x0, Math.min(0, frame.x + frame.w - 0.6 - (x0 + w)));
    const ax = n.at.x + shift;
    const pref = { x: (anchor === 'start' ? ax : ax - w) + w / 2, y: n.at.y - size * 0.375 };
    const center = findSpot(rectPolygon(frame), w + 0.5, size * 1.4, pref, placed, 0.3, protectedRects).center;
    const rect = textRect(center.x, center.y, w + 0.5, size * 1.4);
    let target: Rect | null = null;
    let tDist = Infinity;
    const lower = n.text.toLowerCase();
    const named = extObjects.filter((o) => lower.includes(o.type) || o.tags.some((t) => lower.includes(t)));
    for (const o of named) {
      const r = objectRect(o);
      const cl = { x: Math.max(r.x, Math.min(r.x + r.w, center.x)), y: Math.max(r.y, Math.min(r.y + r.h, center.y)) };
      const d = len(sub(cl, center));
      // prefer a target far enough away for the arrow to read
      const score = d + (d < 3.2 ? 4 : 0);
      if (score < tDist) {
        tDist = score;
        target = r;
      }
    }
    let arrow: NoteItem['arrow'] = null;
    if (target && tDist < 18) {
      const aim = closestOnRect(center, target);
      const dir = unit(sub(aim, center));
      const exit = exitPoint(rect, center, dir);
      if (len(sub(aim, exit)) > 1) {
        const from = add(exit, scale(dir, 0.3));
        // End on the named object. A length cap left arrows pointing at unrelated empty ground.
        arrow = { from, to: aim };
        add_(inflate(bboxOf([from, aim]), 0.25));
      }
    }
    notes.push({ id: n.id, text: n.text, x: anchor === 'start' ? rect.x + 0.25 : rect.x + rect.w - 0.25, y: center.y + size * 0.375, anchor, rot: 0, arrow });
    add_(rect);
  }

  // ---- squad tokens
  const squads: SquadItem[] = [];
  const staging = built.derived.stagingPoints ?? [];
  const openingById = new Map(loc.openings.map((o) => [o.id, o]));
  for (const t of squadTasks) {
    if (t.at) {
      // exact placement: the token stands on its staging point; text finds room beside it
      const tw1 = (txt: string) => txt.length * (W_TASK * FONT.task + 0.07) + 0.2;
      const lh = FONT.task * 1.25;
      const words = t.task.split(' ');
      const variants: string[][] = [[t.task]];
      if (words.length > 1) {
        let best = 1;
        let bestW = Infinity;
        for (let i = 1; i < words.length; i++) {
          const w = Math.max(tw1(words.slice(0, i).join(' ')), tw1(words.slice(i).join(' ')));
          if (w < bestW) (best = i), (bestW = w);
        }
        variants.push([words.slice(0, best).join(' '), words.slice(best).join(' ')]);
      }
      let pick: { lines: string[]; place: TextPlace } | null = null;
      for (const lines of variants) {
        const w = Math.max(...lines.map(tw1));
        const h = lh * lines.length + 0.2;
        const place = placeBeside(t.at, TOKEN_R + 0.35, w, h, FONT.task * 0.92, frame, placed);
        if (!pick || place.score + (lines.length - 1) * 0.3 < pick.place.score) pick = { lines, place };
      }
      const place = pick!.place;
      // short tick from the token toward the opening it holds
      let tick: SquadItem['tick'] = null;
      const sp1 = t.stagingId ? staging.find((p) => p.id === t.stagingId) : staging.find((p) => Math.hypot(p.at.x - t.at!.x, p.at.y - t.at!.y) < 0.2);
      let op = sp1 ? openingById.get(sp1.openingId) : undefined;
      if (!op) {
        // no resolvable staging point: hold the nearest wall opening within reach
        const roomIds = new Set(loc.rooms.map((r) => r.id));
        let nd = 3.4;
        for (const o of loc.openings) {
          if (!roomIds.has(o.a) && !roomIds.has(o.b)) continue;
          const d0 = distToSegment(t.at, o.from, o.to);
          if (d0 < nd) (nd = d0), (op = o);
        }
      }
      if (op) {
        const target = mid(op.from, op.to);
        const toward = sub(target, t.at);
        const dist = len(toward);
        if (dist > 0.3) {
          const dir = scale(toward, 1 / dist);
          const from = add(t.at, scale(dir, TOKEN_R + 0.1));
          const reach = Math.min(dist, TOKEN_R + 1.7);
          if (reach > TOKEN_R + 0.1) tick = { from, to: add(t.at, scale(dir, reach)) };
        }
      }
      squads.push({ squadId: t.squadId, spaceId: t.positionId, task: t.task, badge: t.at, label: { x: place.x, y: place.y }, anchor: place.anchor, lines: pick!.lines, focus: t.squadId === focusSquadId, r: TOKEN_R, at: t.at, tick });
      add_(place.rect);
      continue;
    }
    const sp = polys.get(t.positionId);
    const ds = derived.spaces[t.positionId];
    if (!sp || !ds) continue;
    const textW = (txt: string) => txt.length * (W_TASK * FONT.task + 0.07) + 0.2;
    const labelW = textW(t.task);
    const d = FONT.badge * 2;
    const lh = FONT.task * 1.25;
    // horizontal: badge then label; stacked: badge above a centred label (narrow strips wrap to two lines)
    const hz = { w: d + 0.35 + labelW, h: d + 0.3 };
    let lines = [t.task];
    const avail = ds.bbox.w - 0.4;
    if (labelW > avail && t.task.includes(' ')) {
      const words = t.task.split(' ');
      let best = 1;
      let bestW = Infinity;
      for (let i = 1; i < words.length; i++) {
        const w = Math.max(textW(words.slice(0, i).join(' ')), textW(words.slice(i).join(' ')));
        if (w < bestW) (best = i), (bestW = w);
      }
      lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
    }
    const stW = Math.max(d, ...lines.map(textW)) + 0.1;
    const st = { w: stW, h: d + 0.2 + lh * lines.length + 0.2 };
    const cen = ds.centroid;
    const hSpot = findSpot(sp.poly, hz.w, hz.h, { x: cen.x + (hz.w - d) / 2, y: cen.y }, placed, 0.05);
    const sSpot = hSpot.fits && hSpot.overlap === 0 ? null : findSpot(sp.poly, st.w, st.h, cen, placed, 0.05);
    const useStack = sSpot !== null && sSpot.fits && (!hSpot.fits || sSpot.overlap < hSpot.overlap);
    let badge: Vec;
    let label: Vec;
    let rect: Rect;
    let anchor: SquadItem['anchor'] = 'start';
    let outLines = [t.task];
    if (useStack && sSpot) {
      const left = sSpot.center.x - st.w / 2;
      const top = sSpot.center.y - st.h / 2;
      badge = { x: sSpot.center.x, y: top + 0.1 + d / 2 };
      label = { x: sSpot.center.x, y: top + 0.1 + d + 0.2 + FONT.task * 0.9 };
      rect = { x: left, y: top, w: st.w, h: st.h };
      anchor = 'middle';
      outLines = lines;
    } else {
      const left = hSpot.center.x - hz.w / 2;
      badge = { x: left + d / 2, y: hSpot.center.y };
      label = { x: left + d + 0.35, y: hSpot.center.y + FONT.task * 0.36 };
      rect = { x: left, y: hSpot.center.y - hz.h / 2, w: hz.w, h: hz.h };
    }
    squads.push({ squadId: t.squadId, spaceId: t.positionId, task: t.task, badge, label, anchor, lines: outLines, focus: t.squadId === focusSquadId, r: FONT.badge, at: null, tick: null });
    add_(rect);
  }

  // ---- people marks (only what the player's knowledge allows; labels dodge everything placed so far)
  const people: PersonItem[] = [];
  for (const pd of peopleDrawn) {
    let label: PersonItem['label'] = null;
    let chip: PersonItem['chip'] = null;
    let caption: PersonItem['caption'] = null;
    const stale = pd.status === 'reported' && /last\s*seen/i.test(pd.labelText);
    if (pd.status === 'confirmed' || pd.status === 'disproved') {
      const text = pd.status === 'disproved' ? 'clear' : shortPersonLabel(pd.labelText);
      if (text) {
        const size = FONT.person;
        const w = text.length * W_MARKER * size * 0.95 + 0.4;
        const gap = pd.status === 'disproved' ? 1.05 : 1.65;
        const place = placePersonText(pd.at, gap, w, size * 1.15, size * 0.88, pd.poly, placed);
        if (place) { label = { text, x: place.x, y: place.y, anchor: place.anchor }; add_(place.rect); }
      }
    }
    if (pd.status === 'reported') {
      const text = stale ? 'Last seen' : 'Reported';
      const w = text.length * W_MARKER * FONT.sub * 0.95 + 0.4;
      const h = FONT.sub * 1.15;
      const place = placePersonText(pd.at, 2.0, w, h, FONT.sub * 0.88, pd.poly, placed);
      if (place) { caption = { text, x: place.x, y: place.y, anchor: place.anchor }; add_(place.rect); }
    }
    const chipText = pd.status === 'disproved' || pd.carried.some((item) => item.glyph === 'weapon') ? null : armamentText(pd.armament, pd.status);
    if (chipText) {
      const size = FONT.chip;
      const w = chipText.length * W_MARKER * size * 0.98 + 1.1;
      const h = size * 1.55;
      const place = placePersonText(pd.at, 1.9, w, h, 0, pd.poly, placed);
      if (place) { chip = { text: chipText, x: place.rect.x, y: place.rect.y, w, h }; add_(place.rect); }
    }
    people.push({ id: pd.id, status: pd.status, at: pd.at, kind: pd.kind, label, chip, stale, caption, carried: pd.carried, condition: pd.condition });
  }

  // ---- crowd outside (ground floor): a handful of small figures in the street zone, dodging everything placed
  const crowd = opts.exterior === false ? [] : crowdFigures(loc, frame, opts.crowd ?? 0, placed);

  return { roomLabels, zoneLabels, markers, front: frontItem, notes, squads, people, crowd, obstacles: placed, frame };
}


// ------------------------------------------------------------------ labels, people kinds, crowd

interface LabelVariant {
  lines: string[];
  size: number;
  rot: 0 | -90;
  /** Unrotated text block extent, feet. */
  w: number;
  h: number;
}

/** Candidate renderings of a room name, in order of preference. */
function labelVariants(text: string): LabelVariant[] {
  const out: LabelVariant[] = [];
  const words = text.split(/\s+/).filter(Boolean);
  const two = (): string[] | null => {
    if (words.length < 2) return null;
    let best = 1;
    let bestW = Infinity;
    for (let i = 1; i < words.length; i++) {
      const w = Math.max(words.slice(0, i).join(' ').length, words.slice(i).join(' ').length);
      if (w < bestW) (best = i), (bestW = w);
    }
    return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  };
  const make = (lines: string[], size: number, rot: 0 | -90): LabelVariant => ({
    lines,
    size,
    rot,
    w: Math.max(...lines.map((l) => l.length)) * W_COND * size,
    h: size * 1.1 + (lines.length - 1) * size * 1.15,
  });
  const l2 = two();
  out.push(make([text], FONT.room, 0));
  if (l2) out.push(make(l2, FONT.room, 0));
  out.push(make([text], FONT.room * 0.82, 0));
  out.push(make([text], FONT.room, -90));
  if (l2) out.push(make(l2, FONT.room * 0.82, 0));
  out.push(make([text], FONT.room * 0.66, 0));
  out.push(make([text], FONT.room * 0.66, -90));
  return out;
}

const KIND_ALIAS: Record<string, PersonKindKey> = {
  subject: 'subject',
  civilian: 'civilian',
  resident: 'civilian',
  elderly: 'civilian',
  staff: 'civilian',
  customer: 'civilian',
  held_person: 'civilian',
  child: 'child',
  patient: 'patient',
  dog: 'dog',
  dangerous_dog: 'dog',
  unknown: 'unknown',
};

/** PersonMark.kind (a free string from the sim) to a pictogram key; unrecognised text is 'unknown', absent is null. */
export function personKind(kind: string | undefined): PersonKindKey | null {
  if (!kind) return null;
  return KIND_ALIAS[kind.toLowerCase().trim()] ?? 'unknown';
}

function shortPersonLabel(label: string): string {
  return label.length > 24 ? `${label.slice(0, 23).trimEnd()}…` : label;
}

const ARMAMENT_TEXT: Record<string, string> = { none: 'UNARMED', blunt: 'BLUNT', edged: 'EDGED', handgun: 'HANDGUN', long_gun: 'LONG GUN', unknown: 'WEAPON?' };

/**
 * Chip text for a known armament, straight from the data. A reported (unverified) claim carries a '?'
 * so the chip never reads as confirmed. Nothing known, nothing drawn.
 */
export function armamentText(armament: string | null | undefined, status: 'reported' | 'confirmed' | 'disproved'): string | null {
  const a = (armament ?? '').trim();
  if (!a || a.toLowerCase() === 'unknown') return null;
  let t = ARMAMENT_TEXT[a.toLowerCase()] ?? a.replace(/_/g, ' ').toUpperCase();
  if (status === 'reported' && !t.endsWith('?')) t += '?';
  return t;
}

/** Street zone first, then alley, parking, yard: where a crowd stands. */
function crowdZone(loc: LocationDefinition): Polygon | null {
  for (const kind of ['street', 'alley', 'parking', 'yard'] as const) {
    const z = loc.zones.find((q) => q.kind === kind);
    if (z) return z.polygon;
  }
  return null;
}

function crowdFigures(loc: LocationDefinition, frame: Rect, level: 0 | 1 | 2, obstacles: Rect[]): Vec[] {
  if (!level) return [];
  const zone = crowdZone(loc);
  if (!zone) return [];
  const clip = clipPolyToRect(zone, inflate(frame, -0.8));
  if (clip.length < 3) return [];
  const bb = bboxOf(clip);
  const rnd = mulberry32(hash32(`crowd:${loc.id}:${loc.seed}`));
  const want = level === 2 ? 8 : 3;
  const out: Vec[] = [];
  for (let tries = 0; tries < 260 && out.length < want; tries++) {
    const p = { x: bb.x + rnd() * bb.w, y: bb.y + rnd() * bb.h };
    if (!pointInPolygon(p, clip) || distToPolygonEdges(p, clip) < 0.5) continue;
    const box: Rect = { x: p.x - 0.9, y: p.y - 0.9, w: 1.8, h: 1.8 };
    if (out.some((q) => len(sub(q, p)) < 2.0)) continue;
    if (obstacles.some((o) => rectsOverlapArea(box, o) > 0.01)) continue;
    out.push(p);
  }
  for (const p of out) obstacles.push({ x: p.x - 0.9, y: p.y - 0.9, w: 1.8, h: 1.8 });
  return out;
}

function exitPoint(r: Rect, c: Vec, dir: Vec): Vec {
  const tx = dir.x === 0 ? Infinity : (dir.x > 0 ? r.x + r.w - c.x : r.x - c.x) / dir.x;
  const ty = dir.y === 0 ? Infinity : (dir.y > 0 ? r.y + r.h - c.y : r.y - c.y) / dir.y;
  return add(c, scale(dir, Math.min(tx, ty)));
}

function rectPolygon(r: Rect): Polygon {
  return [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
}

function closestOnRect(p: Vec, r: Rect): Vec {
  return { x: Math.max(r.x, Math.min(r.x + r.w, p.x)), y: Math.max(r.y, Math.min(r.y + r.h, p.y)) };
}

function closestOnPolygon(p: Vec, poly: Polygon): Vec {
  let best = poly[0];
  let distance = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const d = sub(poly[(i + 1) % poly.length], a);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / (d.x * d.x + d.y * d.y || 1)));
    const q = add(a, scale(d, t));
    const dist = len(sub(p, q));
    if (dist < distance) { best = q; distance = dist; }
  }
  return best;
}

/** The entry door into the house, derived from data: a door from an entry zone (or its porch) into a room. */
export function computeFront(loc: LocationDefinition): { openingId: Id; center: Vec; out: Vec } | null {
  const zones = new Map(loc.zones.map((z) => [z.id, z]));
  const entrySet = new Set(loc.entries);
  // zones connected to an entry zone through exterior paths
  const reach = new Set<Id>(entrySet);
  let grew = true;
  while (grew) {
    grew = false;
    for (const o of loc.openings) {
      if (!isPath(o, new Set(zones.keys()))) continue;
      if (reach.has(o.a) && !reach.has(o.b)) (reach.add(o.b), (grew = true));
      else if (reach.has(o.b) && !reach.has(o.a)) (reach.add(o.a), (grew = true));
    }
  }
  const doors = loc.openings.filter((o) => (o.type === 'door' || o.type === 'doorway' || o.type === 'sliding') && ((zones.has(o.a) && !zones.has(o.b)) || (zones.has(o.b) && !zones.has(o.a))));
  const cands = doors
    .map((o) => {
      const zoneId = zones.has(o.a) ? o.a : o.b;
      const roomId = zones.has(o.a) ? o.b : o.a;
      return { o, zone: zones.get(zoneId)!, roomId };
    })
    .filter((c) => reach.has(c.zone.id));
  if (!cands.length) return null;
  const score = (c: (typeof cands)[number]) => (c.zone.kind === 'porch' ? 3 : 0) + (c.zone.tags.includes('street') ? 2 : 0) + (entrySet.has(c.zone.id) && c.zone.tags.includes('street') ? 1 : 0);
  cands.sort((p, q) => score(q) - score(p));
  const best = cands[0];
  const room = loc.rooms.find((r) => r.id === best.roomId);
  const m = mid(best.o.from, best.o.to);
  const dir = unit(sub(best.o.to, best.o.from));
  let out = perp(dir);
  if (room && pointInPolygon(add(m, scale(out, 0.7)), room.polygon)) out = scale(out, -1);
  return { openingId: best.o.id, center: m, out };
}
