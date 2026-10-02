import type { DimLine } from './dimensions';
import { r2 } from './geometry';

const TICK = 0.42;
const FS = 1.7;

function Dim({ d }: { d: DimLine }) {
  const h = d.orient === 'h';
  const p = (along: number, fixed: number) => (h ? { x: along, y: fixed } : { x: fixed, y: along });
  const lineA = p(d.a, d.line);
  const lineB = p(d.b, d.line);
  const extDir = Math.sign(d.line - d.from) || 1;
  const extEnd = d.line + extDir * 0.45;
  const e0 = p(d.a, d.from);
  const e1 = p(d.b, d.from);
  const x0 = p(d.a, extEnd);
  const x1 = p(d.b, extEnd);
  const midAlong = (d.a + d.b) / 2;
  const tick = (along: number) => {
    const c = p(along, d.line);
    return h ? `M${r2(c.x - TICK)} ${r2(c.y + TICK)}L${r2(c.x + TICK)} ${r2(c.y - TICK)}` : `M${r2(c.x - TICK)} ${r2(c.y + TICK)}L${r2(c.x + TICK)} ${r2(c.y - TICK)}`;
  };
  // text: outside the sheet edge the line sits on
  let tx: number;
  let ty: number;
  if (d.side === 'top') [tx, ty] = [midAlong, d.line - 0.5];
  else if (d.side === 'bottom') [tx, ty] = [midAlong, d.line + 0.5 + FS * 0.72];
  else if (d.side === 'left') [tx, ty] = [d.line - 0.5, midAlong];
  else [tx, ty] = [d.line + 0.5 + FS * 0.72, midAlong];
  const span = Math.abs(d.b - d.a);
  const showText = span > 2.2;
  return (
    <g className="bp-dim">
      <path d={`M${r2(e0.x)} ${r2(e0.y)}L${r2(x0.x)} ${r2(x0.y)}M${r2(e1.x)} ${r2(e1.y)}L${r2(x1.x)} ${r2(x1.y)}`} className="bp-dim-ext" />
      <path d={`M${r2(lineA.x)} ${r2(lineA.y)}L${r2(lineB.x)} ${r2(lineB.y)}`} className="bp-dim-line" />
      <path d={`${tick(d.a)}${tick(d.b)}`} className="bp-dim-tick" />
      {showText && (
        <text x={r2(tx)} y={r2(ty)} textAnchor="middle" className="bp-dim-text" transform={h ? undefined : `rotate(-90 ${r2(tx)} ${r2(ty)})`}>
          {d.label}
        </text>
      )}
    </g>
  );
}

export function DimensionLines({ dims }: { dims: DimLine[] }) {
  return (
    <g className="bp-dims" aria-hidden="true" pointerEvents="none">
      {dims.map((d) => (
        <Dim key={d.id} d={d} />
      ))}
    </g>
  );
}

export function NorthArrow({ x, y }: { x: number; y: number }) {
  const R = 1.9;
  return (
    <g className="bp-north" aria-hidden="true" pointerEvents="none" transform={`translate(${r2(x)} ${r2(y)})`}>
      <circle r={R} className="bp-dim-line" fill="none" />
      <path d={`M0 ${-R * 0.95}L${R * 0.55} ${R * 0.7}L0 ${R * 0.28}L${-R * 0.55} ${R * 0.7}Z`} className="bp-north-arrow" />
      <text y={-R - 0.45} textAnchor="middle" className="bp-dim-text">
        N
      </text>
    </g>
  );
}
