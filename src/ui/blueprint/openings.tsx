// Doors (leaf + swing arc), windows (glazing lines + coverings), doorways (clean gap) with state glyphs.
// Leaf thickness, glazing lines and coverings are drawn from the opening's own data so the plan can be read
// like a drawing key: solid-core leaf heavy, hollow-core thin, steel with an 'S' plate, glass with glazing ticks.
import { Fragment } from 'react';
import type { DoorMaterial, Glazing, Vec, WindowCovering } from '../../sim/types';
import { add, cross, perp, r2, scale, sub } from './geometry';
import type { OpeningGeom } from './walls';
import { WALL_INK } from './walls';

const P = (v: Vec) => `${r2(v.x)} ${r2(v.y)}`;

/** Leaf thickness in feet (drawn, not authored). */
export const LEAF_T: Record<DoorMaterial, number> = { hollow_core: 0.13, solid_core: 0.34, steel: 0.22, glass: 0.12 };

function Jambs({ g }: { g: OpeningGeom }) {
  const n = perp(g.dir);
  const h = g.thickness / 2 + WALL_INK * 0.5;
  const a1 = add(g.from, scale(n, h));
  const a2 = add(g.from, scale(n, -h));
  const b1 = add(g.to, scale(n, h));
  const b2 = add(g.to, scale(n, -h));
  return <path d={`M${P(a1)}L${P(a2)}M${P(b1)}L${P(b2)}`} className="bp-jamb" />;
}

/** Zig-zag (blinds) or wavy (curtains) line drawn just inside the glass, on the room side. */
export function coveringPath(from: Vec, to: Vec, dir: Vec, normal: Vec, offset: number, covering: WindowCovering): string | null {
  if (covering === 'none') return null;
  const span = Math.hypot(to.x - from.x, to.y - from.y);
  const inset = 0.22;
  const a = add(add(from, scale(dir, inset)), scale(normal, offset));
  const usable = Math.max(0.1, span - inset * 2);
  const at = (s: number, o: number): Vec => add(add(a, scale(dir, s)), scale(normal, o));
  if (covering === 'blinds') {
    const step = 0.3;
    const n = Math.max(2, Math.round(usable / step));
    const amp = 0.17;
    let d = `M${P(at(0, 0))}`;
    for (let i = 1; i <= n; i++) d += `L${P(at((usable * i) / n, i % 2 ? amp : -amp))}`;
    return d;
  }
  const wave = 1.05;
  const n = Math.max(2, Math.round(usable / (wave / 2)));
  const amp = 0.24;
  let d = `M${P(at(0, 0))}`;
  for (let i = 0; i < n; i++) {
    const s0 = (usable * i) / n;
    const s1 = (usable * (i + 1)) / n;
    d += `Q${P(at((s0 + s1) / 2, i % 2 ? -amp * 2 : amp * 2))} ${P(at(s1, 0))}`;
  }
  return d;
}

export function WindowSymbol({ g }: { g: OpeningGeom }) {
  const n = perp(g.dir);
  const t = g.thickness / 2;
  const line = (o: number) => `M${P(add(g.from, scale(n, o)))}L${P(add(g.to, scale(n, o)))}`;
  const sliding = g.o.type === 'sliding';
  const glazing: Glazing = g.o.glazing ?? 'double';
  const covering: WindowCovering = g.o.covering ?? 'none';
  const inN = g.interiorNormal ?? n;
  const cover = coveringPath(g.from, g.to, g.dir, inN, t + 0.34, covering);
  // single = 2 lines, double = 3, security = 3 plus a bar. Sliding keeps its two offset panes.
  const centre = sliding ? `${line(t * 0.28)}${line(-t * 0.28)}` : glazing === 'single' ? '' : line(0);
  const m = add(g.from, scale(g.dir, g.width / 2));
  const bar = !sliding && glazing === 'security' ? `M${P(add(m, scale(n, t + 0.12)))}L${P(add(m, scale(n, -t - 0.12)))}` : '';
  return (
    <g data-glazing={glazing} data-covering={covering}>
      <Jambs g={g} />
      <path d={`${line(t)}${line(-t)}`} className="bp-win-face" />
      {centre && <path d={centre} className="bp-win-glass" />}
      {bar && <path d={bar} className="bp-win-bar" />}
      {cover && <path d={cover} className="bp-win-cover" />}
    </g>
  );
}

function Lock({ at }: { at: Vec }) {
  return (
    <g transform={`translate(${P(at)})`} className="bp-lock">
      <rect x="-0.55" y="-0.1" width="1.1" height="0.85" rx="0.12" className="bp-lock-body" />
      <path d="M-0.3 -0.1 V-0.45 A0.3 0.3 0 0 1 0.3 -0.45 V-0.1" className="bp-lock-shackle" />
    </g>
  );
}

/** Marks on a door leaf that say what it is made of: 'S' plate for steel, ticks for glass. */
export function LeafMarks({ hinge, tip, side, leafT, material }: { hinge: Vec; tip: Vec; side: Vec; leafT: number; material: DoorMaterial }) {
  const u = sub(tip, hinge);
  const w = Math.hypot(u.x, u.y) || 1;
  const ul = { x: u.x / w, y: u.y / w };
  const at = (f: number, o: number): Vec => add(add(hinge, scale(ul, w * f)), scale(side, o));
  if (material === 'steel') {
    const c = at(0.55, leafT / 2);
    const s = 0.95;
    return (
      <g className="bp-steel-plate">
        <rect x={r2(c.x - s / 2)} y={r2(c.y - s / 2)} width={s} height={s} rx="0.16" className="bp-steel-plate-bg" />
        <text x={r2(c.x)} y={r2(c.y + 0.3)} textAnchor="middle" className="bp-steel-plate-s">
          S
        </text>
      </g>
    );
  }
  if (material === 'glass') {
    const tk = 0.34;
    const d = [0.25, 0.5, 0.75].map((f) => `M${P(at(f, leafT / 2 + tk))}L${P(at(f, leafT / 2 - tk))}`).join('');
    return <path d={d} className="bp-glass-tick" />;
  }
  return null;
}

function DoorSymbol({ g }: { g: OpeningGeom }) {
  const { o, hinge, free, swingNormal } = g;
  if (!hinge || !free || !swingNormal) return <Jambs g={g} />;
  const material: DoorMaterial = o.material ?? 'hollow_core';
  const w = g.width;
  const u = sub(free, hinge);
  const ul = { x: u.x / w, y: u.y / w };
  const open = o.state === 'open';
  const ang = open ? (60 * Math.PI) / 180 : Math.PI / 2;
  const dirTip = { x: ul.x * Math.cos(ang) + swingNormal.x * Math.sin(ang), y: ul.y * Math.cos(ang) + swingNormal.y * Math.sin(ang) };
  const tip = add(hinge, scale(dirTip, w));
  const sweep = cross(ul, swingNormal) > 0 ? 1 : 0;
  const leafT = LEAF_T[material];
  const off = perp(dirTip);
  const sgn = Math.sign(cross(dirTip, ul)) || 1; // keep the leaf thickness on the side facing the opening
  const side = scale(off, sgn);
  const l1 = hinge;
  const l2 = tip;
  const l3 = add(tip, scale(side, leafT));
  const l4 = add(hinge, scale(side, leafT));
  const arc = `M${P(free)} A${r2(w)} ${r2(w)} 0 0 ${sweep} ${P(tip)}`;
  const wedge = `M${P(hinge)} L${P(free)} A${r2(w)} ${r2(w)} 0 0 ${sweep} ${P(tip)} Z`;
  return (
    <g className={`bp-door bp-door-${o.state} bp-door-${material}`} data-material={material}>
      <Jambs g={g} />
      {open && <path d={wedge} className="bp-door-wedge" />}
      <path d={arc} className={open ? 'bp-door-arc bp-door-arc-open' : 'bp-door-arc'} />
      <path d={`M${P(l1)}L${P(l2)}L${P(l3)}L${P(l4)}Z`} className={`bp-door-leaf bp-leaf-${material}`} />
      <LeafMarks hinge={hinge} tip={tip} side={side} leafT={leafT} material={material} />
      {o.state === 'locked' && <Lock at={add(g.center, scale(swingNormal, 1.15))} />}
      {o.state === 'blocked' && (
        <g className="bp-blocked">
          <path
            d={`M${P(add(add(g.from, scale(swingNormal, 0.75)), scale(ul, 0.1)))}L${P(add(add(g.to, scale(swingNormal, -0.75)), scale(ul, -0.1)))}M${P(add(add(g.from, scale(swingNormal, -0.75)), scale(ul, 0.1)))}L${P(add(add(g.to, scale(swingNormal, 0.75)), scale(ul, -0.1)))}`}
            className="bp-blocked-x"
          />
        </g>
      )}
    </g>
  );
}

export function OpeningsLayer({ openings }: { openings: OpeningGeom[] }) {
  return (
    <g className="bp-openings" aria-hidden="true">
      {openings.map((g) => (
        <Fragment key={g.o.id}>
          {g.o.type === 'door' ? <DoorSymbol g={g} /> : g.o.type === 'window' || g.o.type === 'sliding' ? <WindowSymbol g={g} /> : <Jambs g={g} />}
        </Fragment>
      ))}
    </g>
  );
}
