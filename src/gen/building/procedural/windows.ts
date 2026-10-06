import type { Glazing, Opening, WindowCovering } from '../../../sim/types';
import type { Run } from './assemble';
import { type Seg, type Vec, EPS, norm, lerp, segLen, snap, vec } from './geom';
import type { Rand } from './rand';
import type { PRoom, Policy, WindowKind } from './types';
import type { ZoneSet } from './zones';

interface Span {
  seg: Seg;
  zone: string;
  len: number;
}

const isAxis = (s: Seg) => Math.abs(s.a.x - s.b.x) < EPS || Math.abs(s.a.y - s.b.y) < EPS;

/** Parameter range [t0, t1] along `seg` (feet from seg.a) → sub-segment. */
function sub(seg: Seg, t0: number, t1: number): Seg {
  const len = segLen(seg);
  const ax = isAxis(seg);
  const a = ax ? snap(t0) : t0;
  const b = ax ? snap(t1) : t1;
  return { a: lerp(seg.a, seg.b, a / len), b: lerp(seg.a, seg.b, b / len) };
}

/** Cut each exterior run where the zone behind it changes and where doors sit. */
function spansFor(room: PRoom, runs: Run[], zones: ZoneSet, doors: Opening[], marginDoor: number): Span[] {
  const out: Span[] = [];
  for (const run of runs) {
    if (run.room !== room.id) continue;
    const len = run.len;
    const n = Math.round(len / 0.5);
    let startT = 0;
    let curZone: string | null | undefined;
    const flush = (endT: number) => {
      if (curZone && endT - startT > 0.01) out.push({ seg: sub(run.seg, startT, endT), zone: curZone, len: endT - startT });
    };
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) * 0.5;
      const p = lerp(run.seg.a, run.seg.b, t / len);
      const probe = vec(p.x + run.normal.x * 0.5, p.y + run.normal.y * 0.5);
      let z = zones.at(probe);
      if (z && /^(neighbor|corridor|stairwell)/.test(zones.classOf.get(z) ?? '')) z = null;
      let blocked = false;
      for (const d of doors) {
        if (d.a !== room.id && d.b !== room.id) continue;
        const dm = lerp(d.from, d.to, 0.5);
        const half = segLen({ a: d.from, b: d.to }) / 2;
        if (norm(dm.x - p.x, dm.y - p.y) < half + marginDoor) blocked = true;
      }
      const zz = blocked ? null : z;
      if (zz !== curZone) {
        flush(k * 0.5);
        startT = k * 0.5;
        curZone = zz;
      }
    }
    flush(n * 0.5);
  }
  return out.filter((s) => s.len >= 2);
}

const RANGE: Record<WindowKind, [number, number]> = {
  none: [0, 0],
  small: [2, 3],
  normal: [3, 5],
  large: [4, 7],
  storefront: [6, 10],
  high: [3, 5],
};

function countFor(kind: WindowKind, total: number, rng: Rand, front: boolean): number {
  switch (kind) {
    case 'none':
      return 0;
    case 'small':
      return 1;
    case 'normal':
      return 1 + (total >= 11 && rng.chance(0.55) ? 1 : 0) + (total >= 20 && rng.chance(0.3) ? 1 : 0);
    case 'large':
      return 1 + (total >= 12 && rng.chance(0.6) ? 1 : 0) + (total >= 22 && rng.chance(0.4) ? 1 : 0);
    case 'storefront':
      return front ? Math.max(1, Math.min(4, Math.floor(total / 9))) : 1 + (total >= 12 && rng.chance(0.5) ? 1 : 0);
    case 'high':
      return Math.max(1, Math.min(9, Math.floor(total / 9)));
  }
}

export function placeWindows(rooms: PRoom[], runs: Run[], zones: ZoneSet, doors: Opening[], policy: Policy, rng: Rand): Opening[] {
  const out: Opening[] = [];
  const style = (key: string) => policy.windowStyle[key] ?? policy.windowStyle.default;
  for (const room of rooms) {
    const kind = room.seed.windows;
    if (kind === 'none') continue;
    const spans = spansFor(room, runs, zones, doors, 1.0).filter((s) => s.len >= RANGE[kind][0] + 1.5 || (kind === 'small' && s.len >= 3));
    if (spans.length === 0) continue;
    const total = spans.reduce((a, s) => a + s.len, 0);
    const street = spans.filter((s) => runs.some((r) => r.room === room.id && r.side !== 'n' && norm(r.seg.a.x - s.seg.a.x, r.seg.a.y - s.seg.a.y) < 0.01 + r.len));
    void street;
    const want = countFor(kind, total, rng, kind === 'storefront');
    // remaining free intervals per span, as [t0, t1] in feet from span start
    const free = spans.map((s) => [[1, s.len - 1]] as [number, number][]);
    let placed = 0;
    for (let guard = 0; guard < want * 3 && placed < want; guard++) {
      let bestSpan = -1;
      let bestLen = 0;
      spans.forEach((_, si) =>
        free[si].forEach(([a, b]) => {
          if (b - a > bestLen) {
            bestLen = b - a;
            bestSpan = si;
          }
        }),
      );
      if (bestSpan < 0 || bestLen < RANGE[kind][0] - 0.01) break;
      const si = bestSpan;
      const ivIdx = free[si].findIndex(([a, b]) => b - a === bestLen);
      const [a, b] = free[si][ivIdx];
      const w = Math.min(snap(rng.snapped(RANGE[kind][0], RANGE[kind][1])), Math.floor((b - a) / 0.5) * 0.5);
      if (w < Math.min(2, RANGE[kind][0])) break;
      const slack = b - a - w;
      const t0 = a + (slack > 0 ? rng.float() * slack : 0);
      const seg = sub(spans[si].seg, t0, t0 + w);
      const g = rng.weighted(style(room.seed.key).glazing as [Glazing, number][]);
      const c = rng.weighted(style(room.seed.key).covering as [WindowCovering, number][]);
      placed++;
      out.push({
        id: `w_${room.id}_${placed}`,
        type: 'window',
        a: room.id,
        b: spans[si].zone,
        from: seg.a,
        to: seg.b,
        state: 'closed',
        glazing: g,
        covering: c,
        ...(room.floor > 0 ? { floor: room.floor } : {}),
      });
      free[si].splice(ivIdx, 1, ...([[a, t0 - 1], [t0 + w + 1, b]].filter(([x, y]) => y - x >= 2) as [number, number][]));
    }
  }
  return out;
}

export type { Vec };
