import type { ExteriorZone, Opening, ZoneKind } from '../../../sim/types';
import type { PendingExterior } from './openings';
import { GRID, type Vec, EPS, norm, lerp, pointInPoly, polyBBox, sharedSegments, segLen, snap, traceCells, vec } from './geom';
import type { Rand } from './rand';
import type { ExteriorSpec, LotSpec, Plan } from './types';

interface ZoneDef {
  id: string;
  label: string;
  kind: ZoneKind;
  tags: string[];
  /** No walkable path joins this zone to its neighbors. */
  isolated?: boolean;
}

const FRONT_LABEL: Record<ExteriorSpec['kind'], string> = {
  house: 'Front yard',
  semi: 'Front yard',
  shop: 'Sidewalk',
  bar: 'Front lot',
  office: 'Front lot',
  warehouse: 'Yard',
  motel: 'Front lot',
  apartment: 'Frontage',
};

function defs(kind: ExteriorSpec['kind']): Record<string, ZoneDef> {
  const house = kind === 'house' || kind === 'semi';
  return {
    front: { id: house ? 'front_yard' : 'forecourt', label: FRONT_LABEL[kind], kind: house ? 'yard' : kind === 'shop' ? 'street' : 'parking', tags: house ? ['street'] : kind === 'shop' ? ['street', 'exposed'] : ['street', 'exposed'] },
    back: { id: 'back_yard', label: kind === 'house' || kind === 'semi' ? 'Back yard' : 'Rear yard', kind: 'yard', tags: [] },
    west: { id: 'side_yard_w', label: 'West side', kind: 'yard', tags: [] },
    east: { id: 'side_yard_e', label: 'East side', kind: 'yard', tags: [] },
    street: { id: 'street', label: 'Street', kind: 'street', tags: ['street', 'exposed'] },
    side_street: { id: 'side_street', label: 'Side street', kind: 'street', tags: ['street', 'exposed'] },
    alley: { id: 'alley', label: 'Back alley', kind: 'alley', tags: ['alley'] },
    porch: { id: 'porch', label: 'Porch', kind: 'porch', tags: ['exposed'] },
    back_step: { id: 'back_step', label: 'Back step', kind: 'porch', tags: [] },
    driveway: { id: 'driveway', label: 'Driveway', kind: 'parking', tags: ['vehicles'] },
    parking: { id: 'parking', label: 'Parking', kind: 'parking', tags: ['vehicles', 'exposed'] },
    neighbor_w: { id: 'neighbor_w', label: 'Neighbor', kind: 'yard', tags: ['neighbor', 'party_wall', 'no_entry'], isolated: true },
    neighbor_e: { id: 'neighbor_e', label: 'Neighbor', kind: 'yard', tags: ['neighbor', 'party_wall', 'no_entry'], isolated: true },
    corridor: { id: 'corridor', label: 'Common corridor', kind: 'porch', tags: ['corridor', 'common'] },
    stairwell: { id: 'stairwell', label: 'Stairwell', kind: 'porch', tags: ['stairwell', 'common'] },
    balcony: { id: 'balcony', label: 'Balcony', kind: 'porch', tags: ['balcony', 'exposed'], isolated: true },
    bay: { id: 'loading_bay', label: 'Loading bay', kind: 'parking', tags: ['loading_bay', 'vehicles'] },
    walkway: { id: 'walkway', label: 'Walkway', kind: 'porch', tags: ['walkway', 'exposed'] },
    patio: { id: 'patio', label: 'Patio', kind: 'yard', tags: ['patio', 'exposed'] },
  };
}

export interface ZoneSet {
  zones: ExteriorZone[];
  /** Zone containing a point, or null (the building, or off the lot). */
  at(p: Vec): string | null;
  paths: Opening[];
  /** Zone id to class name. */
  classOf: Map<string, string>;
}

/** Insert `apex` between the two points (both on one polygon edge). */
function insertBetween(poly: Vec[], p: Vec, q: Vec, apex: Vec): Vec[] | null {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const len = norm(b.x - a.x, b.y - a.y);
    if (len < EPS) continue;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    const t = (v: Vec) => (v.x - a.x) * ux + (v.y - a.y) * uy;
    const off = (v: Vec) => Math.abs((v.x - a.x) * -uy + (v.y - a.y) * ux);
    if (off(p) > 1e-6 || off(q) > 1e-6 || t(p) < -1e-6 || t(q) < -1e-6 || t(p) > len + 1e-6 || t(q) > len + 1e-6) continue;
    const [first, second] = t(p) <= t(q) ? [p, q] : [q, p];
    const ins = [first, apex, second].filter((v, k, arr) => k === 0 || norm(v.x - arr[k - 1].x, v.y - arr[k - 1].y) > EPS);
    const base = poly.slice(0, i + 1).filter((v) => norm(v.x - first.x, v.y - first.y) > EPS || v === a);
    const rest = poly.slice(i + 1);
    const res = [...base, ...ins, ...rest].filter((v, k, arr) => k === 0 || norm(v.x - arr[k - 1].x, v.y - arr[k - 1].y) > EPS);
    return res;
  }
  return null;
}

/** Classify the lot into zones and trace each as a polygon. Null when any outline is invalid. */
export function buildZones(plan: Plan, lot: LotSpec, ext: ExteriorSpec, doors: PendingExterior[], rng: Rand): ZoneSet | null {
  const nI = Math.round(lot.w / GRID);
  const nJ = Math.round(lot.h / GRID);
  const names: string[] = ['bldg'];
  const idx = (name: string) => {
    const k = names.indexOf(name);
    if (k >= 0) return k;
    names.push(name);
    return names.length - 1;
  };
  const grid = new Int16Array(nI * nJ);
  const fp = plan.footprintSq ?? plan.footprint;
  const bb = polyBBox(fp);
  // Ground-floor rooms tile the (unchamfered) footprint, so their rectangles give the building mask.
  const building = new Uint8Array(nI * nJ);
  for (const r of plan.rooms)
    if (r.floor === 0)
      for (let j = Math.round(r.rect.y0 / GRID); j < Math.round(r.rect.y1 / GRID); j++)
        for (let i = Math.round(r.rect.x0 / GRID); i < Math.round(r.rect.x1 / GRID); i++) building[j * nI + i] = 1;
  const FRONT = idx('front');
  const BACK = idx('back');
  const WEST = idx('west');
  const EAST = idx('east');
  const voidCells: number[] = [];
  for (let j = 0; j < nJ; j++)
    for (let i = 0; i < nI; i++) {
      if (building[j * nI + i] === 1) continue;
      const cx = (i + 0.5) * GRID;
      const cy = (j + 0.5) * GRID;
      if (cy >= bb.y1) grid[j * nI + i] = FRONT;
      else if (cy < bb.y0) grid[j * nI + i] = BACK;
      else if (cx < bb.x0) grid[j * nI + i] = WEST;
      else if (cx >= bb.x1) grid[j * nI + i] = EAST;
      else {
        grid[j * nI + i] = -1;
        voidCells.push(j * nI + i);
      }
    }
  // Notches and courtyards join the yard on the side they open toward.
  const seen = new Set<number>();
  for (const start of voidCells) {
    if (seen.has(start)) continue;
    const comp: number[] = [];
    const stack = [start];
    seen.add(start);
    let south = false;
    let north = false;
    let west = false;
    let east = false;
    while (stack.length) {
      const k = stack.pop() as number;
      comp.push(k);
      const i = k % nI;
      const j = Math.floor(k / nI);
      const cx = (i + 0.5) * GRID;
      const cy = (j + 0.5) * GRID;
      if (cy + GRID >= bb.y1 - EPS) south = true;
      if (cy - GRID <= bb.y0 + EPS) north = true;
      if (cx - GRID <= bb.x0 + EPS) west = true;
      if (cx + GRID >= bb.x1 - EPS) east = true;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const kk = (j + dj) * nI + (i + di);
        if (i + di < 0 || j + dj < 0 || i + di >= nI || j + dj >= nJ) continue;
        if (grid[kk] === -1 && !seen.has(kk)) {
          seen.add(kk);
          stack.push(kk);
        }
      }
    }
    // A sliver (a wing stepped in by a foot) joins the yard along its long side: as part of the rear
    // yard it was a 1 ft dead end the router cannot enter, and a back door could open into it.
    let ci0 = nI;
    let ci1 = 0;
    let cj0 = nJ;
    let cj1 = 0;
    for (const k of comp) {
      ci0 = Math.min(ci0, k % nI);
      ci1 = Math.max(ci1, (k % nI) + 1);
      cj0 = Math.min(cj0, Math.floor(k / nI));
      cj1 = Math.max(cj1, Math.floor(k / nI) + 1);
    }
    const cw = (ci1 - ci0) * GRID;
    const ch = (cj1 - cj0) * GRID;
    const sliverX = cw < 3 && ch > cw && (west || east);
    const sliverY = ch < 3 && cw > ch && (south || north);
    const cls = sliverX ? (west ? WEST : EAST) : sliverY ? (south ? FRONT : BACK) : ext.voidClass === 'courtyard' && !south ? idx('patio') : south ? FRONT : north ? BACK : west ? WEST : east ? EAST : BACK;
    for (const k of comp) grid[k] = cls;
  }

  const paint = (name: string, pred: (x: number, y: number) => boolean, only?: string[]) => {
    const target = idx(name);
    const allowed = only?.map(idx);
    for (let j = 0; j < nJ; j++)
      for (let i = 0; i < nI; i++) {
        const cur = grid[j * nI + i];
        if (cur === 0 || (allowed && !allowed.includes(cur))) continue;
        if (pred((i + 0.5) * GRID, (j + 0.5) * GRID)) grid[j * nI + i] = target;
      }
  };

  const ground = ['front', 'back', 'west', 'east', 'patio'];
  const sideStreetX = ext.sideStreet === 'e' ? (x: number) => x >= lot.w - ext.streetDepth : ext.sideStreet === 'w' ? (x: number) => x < ext.streetDepth : null;
  if (ext.streetDepth > 0 && ext.kind !== 'apartment') {
    paint('street', (_x, y) => y >= lot.h - ext.streetDepth, ground);
    if (sideStreetX) paint('side_street', (x, y) => sideStreetX(x) && y < lot.h - ext.streetDepth, ground);
  } else if (ext.streetDepth > 0) paint('street', (_x, y) => y >= lot.h - ext.streetDepth, ground);
  if (ext.alleyDepth > 0) paint('alley', (_x, y) => y < ext.alleyDepth, ground);
  if (ext.driveway) {
    const west = ext.driveway === 'w';
    paint('driveway', (x, y) => (west ? x < bb.x0 : x >= bb.x1) && (y >= bb.y0 || false) && y >= bb.y0 - 0.01, ['front', 'west', 'east']);
  }
  for (const side of ext.neighbours) {
    const west = side === 'w';
    paint(west ? 'neighbor_w' : 'neighbor_e', (x, y) => y >= bb.y0 && y < bb.y1 && (west ? x < bb.x0 && x >= bb.x0 - 6 : x >= bb.x1 && x < bb.x1 + 6), ['west', 'east']);
  }
  if (ext.corridor) {
    const stairW = rng.snapped(8, 11);
    const west = rng.chance(0.5);
    const x0 = bb.x0;
    const x1 = bb.x1;
    paint('corridor', (x, y) => y >= bb.y0 - 5 && y < bb.y0 && x >= x0 && x < x1, ['back']);
    paint('stairwell', (x, y) => y >= bb.y0 - 5 && y < bb.y0 && (west ? x < x0 && x >= x0 - stairW : x >= x1 && x < x1 + stairW), ['back']);
  }
  if (ext.bay) {
    const drawn = rng.snapped(10, 14);
    // As with steps: leave 3 ft of yard beyond the bay or take the yard's full depth, never a sliver.
    const avail = ext.bay === 'n' ? bb.y0 : ext.bay === 'e' ? lot.w - bb.x1 : bb.x0;
    const d = avail - drawn >= 3 ? drawn : avail - 3 >= 10 ? snap(avail - 3) : avail;
    if (ext.bay === 'n') paint('bay', (x, y) => y >= bb.y0 - d && y < bb.y0 && x >= bb.x0 && x < bb.x1, ['back']);
    else if (ext.bay === 'e') paint('bay', (x, y) => x >= bb.x1 && x < bb.x1 + d && y >= bb.y0 && y < bb.y1, ['east']);
    else paint('bay', (x, y) => x < bb.x0 && x >= bb.x0 - d && y >= bb.y0 && y < bb.y1, ['west']);
  }
  if (ext.parking) {
    // A 5 ft apron between the facade and the parked cars: the squad router keeps 1 ft off every zone
    // edge, so a 2 ft strip left no standing room outside the front door.
    paint('parking', (x, y) => y >= bb.y1 + 5 && (ext.kind === 'motel' || ext.kind === 'bar' || ext.kind === 'office' || ext.kind === 'warehouse') && x >= bb.x0 - 2 && x < bb.x1 + 2, ['front']);
  }
  if (ext.kind === 'motel') {
    const wk = ext.walkway ?? { x0: bb.x0, y0: bb.y1, x1: bb.x1, y1: bb.y1 + 5 };
    paint('walkway', (x, y) => y >= wk.y0 && y < wk.y1 && x >= wk.x0 && x < wk.x1, ['front', 'parking']);
  }
  if (ext.kind === 'bar' && ext.parking === false) {
    const side = rng.chance(0.5);
    paint('patio', (x, y) => y >= bb.y1 && y < bb.y1 + 7 && (side ? x >= bb.x0 && x < bb.x0 + 14 : x >= bb.x1 - 14 && x < bb.x1), ['front']);
  }
  const STEP_OVER = ['front', 'back', 'west', 'east', 'driveway'];
  /**
   * Side of a porch or step: from `edge`, walk outward (`dir`) along the wall up to 3 ft. If the
   * building, the lot edge or a different zone class comes first, the step takes that strip too: a
   * yard sliver under 3 ft beside a step has no walking line for the router, and a zone link landing
   * in it (bungalow notches) was unusable. `alongX`: the door is on a north or south wall; the band
   * [b0, b1) is the step's depth.
   */
  const sideReach = (edge: number, dir: -1 | 1, b0: number, b1: number, alongX: boolean): number => {
    const cellAt = (u: number, v: number) => (alongX ? Math.floor(v / GRID) * nI + Math.floor(u / GRID) : Math.floor(u / GRID) * nI + Math.floor(v / GRID));
    const max = alongX ? lot.w : lot.h;
    const firstU = edge + dir * (GRID / 2);
    if (firstU < 0 || firstU > max) return edge;
    const yardCls = grid[cellAt(firstU, b0 + GRID / 2)];
    for (let g = 0; g < 3 - EPS; g += GRID) {
      const u = edge + dir * (g + GRID / 2);
      if (u < 0 || u > max) return edge + dir * g;
      for (let v = b0 + GRID / 2; v < b1; v += GRID) {
        const k = cellAt(u, v);
        if (building[k] === 1 || grid[k] !== yardCls) return edge + dir * g;
      }
    }
    return edge;
  };
  for (const d of doors) {
    if (d.kind === 'balcony') {
      const bx0 = Math.min(d.from.x, d.to.x) - 1;
      const bx1 = Math.max(d.from.x, d.to.x) + 1;
      paint('balcony', (x, y) => y >= bb.y1 && y < bb.y1 + 4 && x >= bx0 && x < bx1, ['front']);
      continue;
    }
    if (d.type === 'sliding' && d.kind === 'front') continue;
    const mid = lerp(d.from, d.to, 0.5);
    const lo = Math.min(d.from.x, d.to.x);
    const hi = Math.max(d.from.x, d.to.x);
    const ylo = Math.min(d.from.y, d.to.y);
    const yhi = Math.max(d.from.y, d.to.y);
    const drawn = rng.snapped(3.5, 5);
    // A step or porch either leaves 3 ft of yard beyond it (two 1 ft router margins and a walking
    // line) or runs to the lot edge and splits the yard cleanly; a 1 ft neck behind it sealed the yard.
    const avail = Math.abs(d.normal.y) > 0.9 ? (d.normal.y > 0 ? lot.h - mid.y : mid.y) : d.normal.x > 0 ? lot.w - mid.x : mid.x;
    const dpt = avail - drawn >= 3 ? drawn : avail - 3 >= 3.5 ? snap(avail - 3) : avail;
    if (Math.abs(d.normal.y) > 0.9 && !(ext.kind === 'shop' || ext.kind === 'bar' || ext.kind === 'office' || ext.kind === 'warehouse' || ext.kind === 'motel' || ext.kind === 'apartment')) {
      const south = d.normal.y > 0;
      const name = d.kind === 'front' ? 'porch' : 'back_step';
      if (d.kind === 'front' && !ext.porch) continue;
      if (d.kind !== 'front' && !rng.chance(0.55)) continue;
      const w = d.kind === 'front' ? 1.5 : 1;
      const [b0, b1] = south ? [mid.y, mid.y + dpt] : [mid.y - dpt, mid.y];
      const x0 = sideReach(lo - w, -1, b0, b1, true);
      const x1 = sideReach(hi + w, 1, b0, b1, true);
      paint(name, (x, y) => x >= x0 && x < x1 && y >= b0 && y < b1, STEP_OVER);
    } else if (Math.abs(d.normal.x) > 0.9 && d.kind !== 'front' && (ext.kind === 'house' || ext.kind === 'semi') && rng.chance(0.55)) {
      const east = d.normal.x > 0;
      const [b0, b1] = east ? [mid.x, mid.x + dpt] : [mid.x - dpt, mid.x];
      const y0 = sideReach(ylo - 1, -1, b0, b1, false);
      const y1 = sideReach(yhi + 1, 1, b0, b1, false);
      paint('back_step', (x, y) => y >= y0 && y < y1 && x >= b0 && x < b1, STEP_OVER);
    }
  }

  // Components, in scan order, become zones.
  const D = defs(ext.kind);
  const zones: ExteriorZone[] = [];
  const classOf = new Map<string, string>();
  const labelSeen = new Map<string, number>();
  const visited = new Uint8Array(nI * nJ);
  const comp = new Int16Array(nI * nJ);
  let compId = 0;
  const found: { cls: number; key: number }[] = [];
  const compCells = new Map<number, number[]>();
  for (let j = 0; j < nJ; j++)
    for (let i = 0; i < nI; i++) {
      const k = j * nI + i;
      if (visited[k] || grid[k] === 0) continue;
      const cls = grid[k];
      const cells: number[] = [];
      const stack = [k];
      visited[k] = 1;
      while (stack.length) {
        const q = stack.pop() as number;
        cells.push(q);
        const qi = q % nI;
        const qj = Math.floor(q / nI);
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = qi + di;
          const nj = qj + dj;
          if (ni < 0 || nj < 0 || ni >= nI || nj >= nJ) continue;
          const kk = nj * nI + ni;
          if (!visited[kk] && grid[kk] === cls) {
            visited[kk] = 1;
            stack.push(kk);
          }
        }
      }
      found.push({ cls, key: k });
      compCells.set(k, cells);
    }
  for (const f of found) {
    const name = names[f.cls];
    const def = D[name];
    if (!def) return null;
    const cells = compCells.get(f.key) as number[];
    if (cells.length < 4) return null;
    const label = ++compId;
    for (const k of cells) comp[k] = label;
    let i0 = nI;
    let j0 = nJ;
    let i1 = 0;
    let j1 = 0;
    for (const k of cells) {
      const i = k % nI;
      const j = Math.floor(k / nI);
      i0 = Math.min(i0, i);
      i1 = Math.max(i1, i + 1);
      j0 = Math.min(j0, j);
      j1 = Math.max(j1, j + 1);
    }
    const poly = traceCells((i, j) => i >= 0 && j >= 0 && i < nI && j < nJ && comp[j * nI + i] === label, i0, j0, i1, j1);
    if (!poly) return null;
    const n = (labelSeen.get(def.id) ?? 0) + 1;
    labelSeen.set(def.id, n);
    const id = n === 1 ? def.id : `${def.id}_${n}`;
    zones.push({ id, label: n === 1 ? def.label : `${def.label} ${n}`, kind: def.kind, polygon: poly, tags: [...def.tags] });
    classOf.set(id, name);
  }

  // The chamfer hands its triangle to a street zone (or the zone on the longer wall).
  if (plan.chamfer && plan.footprintSq) {
    const { corner, leg } = plan.chamfer;
    const n = plan.footprintSq.length;
    const idx0 = plan.footprintSq.findIndex((p) => p.x === corner.x && p.y === corner.y);
    if (idx0 < 0) return null;
    const prev = plan.footprintSq[(idx0 + n - 1) % n];
    const next = plan.footprintSq[(idx0 + 1) % n];
    const toward = (to: Vec) => {
      const d = norm(to.x - corner.x, to.y - corner.y);
      return vec(corner.x + ((to.x - corner.x) / d) * leg, corner.y + ((to.y - corner.y) / d) * leg);
    };
    const p1 = toward(prev);
    const p2 = toward(next);
    const zoneBeyond = (a: Vec) => {
      const m = vec((a.x + corner.x) / 2, (a.y + corner.y) / 2);
      for (const nn of [vec(0.4, 0), vec(-0.4, 0), vec(0, 0.4), vec(0, -0.4)]) {
        const q = vec(m.x + nn.x, m.y + nn.y);
        if (!pointInPoly(q, fp)) {
          const z = zones.find((zz) => pointInPoly(q, zz.polygon));
          if (z) return z;
        }
      }
      return undefined;
    };
    const zA = zoneBeyond(p1);
    const zB = zoneBeyond(p2);
    if (!zA || !zB) return null;
    const pick = zA.kind === 'street' ? zA : zB.kind === 'street' ? zB : zA;
    const res = pick === zA ? insertBetween(pick.polygon, p1, corner, p2) : insertBetween(pick.polygon, p2, corner, p1);
    if (!res) return null;
    pick.polygon = res;
  }

  const zoneAt = (p: Vec): string | null => zones.find((z) => pointInPoly(p, z.polygon))?.id ?? null;

  // Walkable paths between neighboring zones, drawn like Maple Street's zone-to-zone doorways.
  const paths: Opening[] = [];
  for (let a = 0; a < zones.length; a++)
    for (let b = a + 1; b < zones.length; b++) {
      const za = zones[a];
      const zb = zones[b];
      const da = D[classOf.get(za.id) as string];
      const db = D[classOf.get(zb.id) as string];
      if (da.isolated || db.isolated) continue;
      const segs = sharedSegments(za.polygon, zb.polygon, 2).sort((p, q) => segLen(q) - segLen(p));
      if (segs.length === 0) continue;
      const seg = segs[0];
      const len = segLen(seg);
      const w = Math.min(len, 4);
      const t = snap((len - w) / 2);
      paths.push({
        id: `p_${za.id}_${zb.id}`,
        type: 'doorway',
        a: za.id,
        b: zb.id,
        from: lerp(seg.a, seg.b, t / len),
        to: lerp(seg.a, seg.b, (t + w) / len),
        state: 'open',
      });
    }
  return { zones, at: zoneAt, paths, classOf };
}
