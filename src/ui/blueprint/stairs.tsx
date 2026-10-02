// Stairs in drafting style: the flight outlined, a tread line every ~foot, a centre arrow and "UP" (from the
// lower floor) or "DN" (from the upper). The other floor's stairwell is drawn as a faint dashed outline.
import { add, perp, polyPath, r2, scale } from './geometry';
import type { Polygon } from '../../sim/types';
import type { StairModel } from './floors';
import { arrowShape } from './markers';

const TREAD = 0.95;

export function StairGhosts({ polys, outline }: { polys: Polygon[]; outline: Polygon | null }) {
  if (!polys.length && !outline) return null;
  return (
    <g className="bp-ghosts" pointerEvents="none" aria-hidden="true">
      {outline && <path d={polyPath(outline)} className="bp-ghost-outline" />}
      {polys.map((p, i) => (
        <path key={i} d={polyPath(p)} className="bp-ghost-stair" />
      ))}
    </g>
  );
}

export function StairSymbol({ s }: { s: StairModel & { dir: 'up' | 'down' } }) {
  const n = Math.max(3, Math.round(s.length / TREAD));
  const hw = s.width / 2;
  const side = perp(s.axis);
  const treads: string[] = [];
  for (let i = 1; i < n; i++) {
    const c = add(s.foot, scale(s.axis, (s.length * i) / n));
    const a = add(c, scale(side, hw));
    const b = add(c, scale(side, -hw));
    treads.push(`M${r2(a.x)} ${r2(a.y)}L${r2(b.x)} ${r2(b.y)}`);
  }
  // centre arrow, pointing the way you go: up from the foot, or down toward it
  const inset = Math.min(1.1, s.length * 0.12);
  const lo = add(s.foot, scale(s.axis, inset));
  const hi = add(s.head, scale(s.axis, -inset));
  const up = s.dir === 'up';
  const from = up ? lo : hi;
  const to = up ? hi : lo;
  const arrow = arrowShape(from, to, 0, 0.95);
  // the word sits at the tail of the arrow, over the treads on a paper-coloured knock-out
  const tail = add(from, scale(s.axis, (up ? 1 : -1) * Math.min(1.9, s.length * 0.2)));
  return (
    <g className="bp-stair" data-stair={s.id} data-dir={s.dir} pointerEvents="none" aria-hidden="true">
      <path d={polyPath(s.poly)} className="bp-stair-box" />
      <path d={treads.join('')} className="bp-stair-tread" />
      <path d={`M${r2(from.x)} ${r2(from.y)}L${r2(to.x)} ${r2(to.y)}`} className="bp-stair-arrow" />
      <path d={arrow.head} className="bp-stair-arrow" />
      <text x={r2(tail.x)} y={r2(tail.y + 0.46)} textAnchor="middle" className="bp-stair-label">
        {up ? 'UP' : 'DN'}
      </text>
    </g>
  );
}

export function StairLayer({ stairs }: { stairs: (StairModel & { dir: 'up' | 'down' })[] }) {
  if (!stairs.length) return null;
  return (
    <g className="bp-stairs" aria-hidden="true">
      {stairs.map((s) => (
        <StairSymbol key={s.id} s={s} />
      ))}
    </g>
  );
}
