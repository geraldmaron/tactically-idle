// Label, marker, token and note placement. Pure; operates on feet. Placement searches avoid furniture
// and previously placed text so annotations stay legible without hand tuning per location.
import type { BuiltLocation, Id, LocationDefinition, Polygon, SpaceView, SquadId, SquadTask, Vec } from '../../sim/types';
import { add, areaOutside, bboxOf, clipPolyToRect, distToPolygonEdges, distToSegment, hash32, inflate, len, mid, perp, pointInPolygon, rectsOverlapArea, scale, sub, unit, type Rect } from './geometry';
import { isFloorLayer, objectRect } from './furniture';
import { isPath } from './walls';

export const FONT = {
  room: 1.75,
  zone: 1.28,
  marker: 2.15,
  front: 1.95,
  note: 1.75,
  task: 1.2,
  badge: 1.4,
  sub: 1.3,
  person: 1.45,
  overlay: 1.35,
};

/** Squad token radius when it stands at an exact staging point (smaller than the room-centroid badge). */
export const TOKEN_R = 1.15;

// rough glyph-width factors (em) per face
const W_COND = 0.6;
const W_MARKER = 0.52;
const W_TASK = 0.46;

export interface LabelItem {
  id: Id;
  text: string;
  x: number;
  y: number;
  size: number;
  rot: number;
}

export interface MarkerItem {
  spaceId: Id;
  tone: 'amber' | 'mint';
  text: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  tilt: number;
  textX: number;
  textY: number;
  textW: number;
  /** Smaller marker lettering under the word, e.g. 'per neighbour'. */
  sub: { text: string; x: number; y: number } | null;
  arrow: { from: Vec; to: Vec };
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

export interface PersonItem {
  id: Id;
  status: 'reported' | 'confirmed' | 'disproved';
  at: Vec;
  label: { text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end' } | null;
}

export interface Layout {
  roomLabels: LabelItem[];
  zoneLabels: LabelItem[];
  markers: MarkerItem[];
  front: FrontItem | null;
  notes: NoteItem[];
  squads: SquadItem[];
  people: PersonItem[];
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
function findSpot(poly: Polygon, w: number, h: number, pref: Vec, obstacles: Rect[], margin = 0.45): Spot {
  const bb = bboxOf(poly);
  let best: Spot | null = null;
  let bestScore = Infinity;
  const step = 0.5;
  for (let y = bb.y; y <= bb.y + bb.h; y += step) {
    for (let x = bb.x; x <= bb.x + bb.w; x += step) {
      const box = { x: x - w / 2, y: y - h / 2, w, h };
      if (!boxInside(box, poly, margin)) continue;
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

export function computeLayout(built: BuiltLocation, spaces: SpaceView[], squadTasks: SquadTask[], focusSquadId: SquadId | null, frameIn?: Rect): Layout {
  const loc = built.location;
  const derived = built.derived;
  const frame: Rect = frameIn ?? { x: 0, y: 0, w: loc.bounds.w, h: loc.bounds.h };
  const polys = spacePolygons(loc);
  const viewById = new Map(spaces.map((s) => [s.id, s]));

  // obstacles: every object that sits above the floor
  const placed: Rect[] = loc.objects.filter((o) => !isFloorLayer(o.type)).map((o) => inflate(objectRect(o), 0.12));
  const add_ = (r: Rect) => placed.push(r);

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
    const aFrom = add(tc, scale(front.out, -(h / 2 + 0.55)));
    const aTo = add(front.center, scale(front.out, 1.2));
    frontItem = { openingId: front.openingId, text: tc, band, arrow: { from: aFrom, to: aTo } };
    add_(band);
    add_({ x: Math.min(aFrom.x, aTo.x) - 0.6, y: Math.min(aFrom.y, aTo.y), w: Math.abs(aFrom.x - aTo.x) + 1.2, h: Math.abs(aFrom.y - aTo.y) });
  }

  // ---- fixed glyphs first: squads that stand at a staging point and people marks claim their spot, text dodges them
  for (const t of squadTasks) if (t.at) add_({ x: t.at.x - TOKEN_R - 0.15, y: t.at.y - TOKEN_R - 0.15, w: TOKEN_R * 2 + 0.3, h: TOKEN_R * 2 + 0.3 });
  const peopleDrawn: { id: Id; status: PersonItem['status']; at: Vec }[] = [];
  for (const sv of spaces) {
    for (const pm of sv.people ?? []) {
      if (pm.status !== 'reported' && pm.status !== 'confirmed' && pm.status !== 'disproved') continue; // 'unknown' is never drawn
      peopleDrawn.push({ id: pm.id, status: pm.status, at: pm.at });
      const r = pm.status === 'reported' ? 2.1 : 1.35;
      add_({ x: pm.at.x - r, y: pm.at.y - r, w: r * 2, h: r * 2 });
    }
  }

  // ---- markers
  const markers: MarkerItem[] = [];
  for (const view of spaces) {
    if (!view.marker) continue;
    const sp = polys.get(view.id);
    const ds = derived.spaces[view.id];
    if (!sp || !ds) continue;
    const bb = ds.bbox;
    let cx = bb.x + bb.w / 2;
    let cy = bb.y + bb.h / 2;
    let rx = (bb.w / 2) * 0.98 + 0.25;
    let ry = (bb.h / 2) * 0.98 + 0.25;
    if (sp.zone || bb.w > 17.5 || bb.h > 14) {
      // large or L-shaped spaces: loop the centroid region only
      const c = ds.centroid;
      cx = c.x;
      cy = c.y;
      rx = Math.min(rx, 8.2);
      ry = Math.min(ry, 6.2);
    }
    const text = view.marker.text.toUpperCase();
    const subText = view.marker.subtext?.trim() ? view.marker.subtext.trim() : null;
    const size = FONT.marker;
    const textW = text.length * W_MARKER * size;
    const subW = subText ? subText.length * W_MARKER * FONT.sub * 0.92 + 0.6 : 0;
    const tw = Math.max(textW + 3.4, subW + 0.4); // text plus glyph
    const th = size * 1.1 + (subText ? FONT.sub * 1.15 : 0);
    const pref = { x: cx + rx * 0.35, y: cy + ry * 0.74 };
    const area: Polygon = ellipsePolygon(cx, cy, rx + 2.4, ry + 3.2);
    const spot = findSpot(area, tw, th, pref, placed, 0.2);
    const tcx = spot.center.x;
    const tcy = spot.center.y;
    const left = tcx - tw / 2;
    const textY = subText ? tcy - th / 2 + size * 0.88 : tcy + size * 0.34;
    const glyphAt = { x: left + textW + 2.0, y: subText ? textY - size * 0.38 : tcy - 0.1 };
    const aFrom = { x: left - 0.35, y: (subText ? textY - size * 0.38 : tcy) - 0.35 };
    const aTo = { x: aFrom.x - 1.9, y: aFrom.y - 1.5 };
    markers.push({
      spaceId: view.id,
      tone: view.marker.tone,
      text,
      cx,
      cy,
      rx,
      ry,
      tilt: -6 + ((hash32(view.id) % 5) - 2),
      textX: left,
      textY,
      textW,
      sub: subText ? { text: subText, x: left + 0.15, y: textY + FONT.sub * 1.18 } : null,
      arrow: { from: aFrom, to: aTo },
      glyphAt,
    });
    add_(textRect(tcx, tcy, tw + 2.2, th));
  }

  // ---- room labels
  const roomLabels: LabelItem[] = [];
  for (const room of loc.rooms) {
    const view = viewById.get(room.id);
    if (!view) continue;
    const text = view.label.toUpperCase();
    const size = FONT.room;
    const w = text.length * W_COND * size;
    const h = size * 1.1;
    const rb = bboxOf(room.polygon);
    const pref = derived.spaces[room.id]?.centroid ?? { x: rb.x + rb.w / 2, y: rb.y + rb.h / 2 };
    const spot = findSpot(room.polygon, w, h, pref, placed, 0.6);
    roomLabels.push({ id: room.id, text, x: spot.center.x, y: spot.center.y + size * 0.36, size, rot: 0 });
    add_(textRect(spot.center.x, spot.center.y, w, h));
  }

  // ---- zone labels (small; tall narrow zones read vertically)
  const zoneLabels: LabelItem[] = [];
  for (const zone of loc.zones) {
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
    const rect: Rect = { x: (anchor === 'start' ? ax : ax - w), y: n.at.y - size, w, h: size * 1.25 };
    const center = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    let target: Rect | null = null;
    let tDist = Infinity;
    const lower = n.text.toLowerCase();
    const named = extObjects.filter((o) => lower.includes(o.type) || o.tags.some((t) => lower.includes(t)));
    for (const o of named.length ? named : extObjects) {
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
      const compact = Math.max(target.w, target.h) < 4 * Math.min(target.w, target.h) + 2;
      const aim = compact
        ? { x: target.x + target.w / 2, y: target.y + target.h / 2 }
        : { x: Math.max(target.x, Math.min(target.x + target.w, center.x)), y: Math.max(target.y, Math.min(target.y + target.h, center.y)) };
      const dir = unit(sub(aim, center));
      const exit = exitPoint(rect, center, dir);
      const reach = len(sub(aim, exit)) - (compact ? (Math.min(target.w, target.h) / 2) * 0.9 : 0.5) - 0.15;
      if (reach > 1.5) {
        const from = add(exit, scale(dir, 0.45));
        const to = add(exit, scale(dir, Math.min(reach, 6.5)));
        arrow = { from, to };
        add_({ x: Math.min(from.x, to.x) - 0.4, y: Math.min(from.y, to.y) - 0.4, w: Math.abs(from.x - to.x) + 0.8, h: Math.abs(from.y - to.y) + 0.8 });
      }
    }
    notes.push({ id: n.id, text: n.text, x: ax, y: n.at.y, anchor, rot: -5, arrow });
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
          const reach = Math.max(TOKEN_R + 0.75, Math.min(dist - 0.1, TOKEN_R + 1.7));
          tick = { from, to: add(t.at, scale(dir, reach)) };
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
  const labelOf = new Map<Id, string>();
  for (const sv of spaces) for (const pm of sv.people ?? []) labelOf.set(pm.id, pm.label);
  for (const pd of peopleDrawn) {
    let label: PersonItem['label'] = null;
    if (pd.status === 'confirmed' || pd.status === 'disproved') {
      const text = pd.status === 'disproved' ? 'clear' : (labelOf.get(pd.id) ?? '').trim();
      if (text) {
        const size = FONT.person;
        const w = text.length * W_MARKER * size * 0.95 + 0.4;
        const gap = pd.status === 'disproved' ? 1.05 : 1.45;
        const place = placeBeside(pd.at, gap, w, size * 1.15, size * 0.88, frame, placed);
        label = { text, x: place.x, y: place.y, anchor: place.anchor };
        add_(place.rect);
      }
    }
    people.push({ id: pd.id, status: pd.status, at: pd.at, label });
  }

  return { roomLabels, zoneLabels, markers, front: frontItem, notes, squads, people, obstacles: placed, frame };
}

function exitPoint(r: Rect, c: Vec, dir: Vec): Vec {
  const tx = dir.x === 0 ? Infinity : (dir.x > 0 ? r.x + r.w - c.x : r.x - c.x) / dir.x;
  const ty = dir.y === 0 ? Infinity : (dir.y > 0 ? r.y + r.h - c.y : r.y - c.y) / dir.y;
  return add(c, scale(dir, Math.min(tx, ty)));
}

function ellipsePolygon(cx: number, cy: number, rx: number, ry: number): Polygon {
  const pts: Polygon = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return pts;
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
