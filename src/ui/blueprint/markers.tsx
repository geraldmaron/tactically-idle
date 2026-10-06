// Hand-drawn annotation layer: marker loops, arrows, glyphs, the FRONT highlighter, notes, squad tokens.
import { add, perp, polyPath, r2, scale, seeded, smoothPath, sub, unit, type Rect } from './geometry';
import type { PublicCarriedItem, Vec } from '../../sim/types';
import type { FrontItem, MarkerItem, NoteItem, PersonItem, PersonKindKey, SquadItem } from './layout';
import { CARRIED_SCALE, FONT } from './layout';

const toneVar = (tone: 'amber' | 'mint') => (tone === 'amber' ? 'var(--marker-amber)' : 'var(--marker-mint)');

export function arrowShape(from: Vec, to: Vec, bend: number, headLen = 0.85): { shaft: string; head: string } {
  const dir = unit(sub(to, from));
  const n = perp(dir);
  const c = add({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, scale(n, bend));
  const shaft = `M${r2(from.x)} ${r2(from.y)} Q${r2(c.x)} ${r2(c.y)} ${r2(to.x)} ${r2(to.y)}`;
  // tangent at the end of the quadratic
  const tan = unit(sub(to, c));
  const back = scale(tan, -headLen);
  const wing = (a: number) => {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    return add(to, { x: back.x * ca - back.y * sa, y: back.x * sa + back.y * ca });
  };
  const w1 = wing(0.5);
  const w2 = wing(-0.5);
  return { shaft, head: `M${r2(w1.x)} ${r2(w1.y)} L${r2(to.x)} ${r2(to.y)} L${r2(w2.x)} ${r2(w2.y)}` };
}

export function MarkerLoop({ m, draw }: { m: MarkerItem; draw: boolean }) {
  const color = toneVar(m.tone);
  const cls = draw ? 'bp-draw' : '';
  const arrow = m.arrow ? arrowShape(m.arrow.from, m.arrow.to, 0, 0.75) : null;
  return (
    <g className={`bp-marker bp-marker-${m.tone}`} data-space={m.spaceId} pointerEvents="none" color={color} aria-hidden="true">
      <path d={polyPath(m.outline)} pathLength={1} className={`bp-mloop ${cls}`} stroke={color} />
      <g className={draw ? 'bp-fade' : ''}>
        {arrow && <>
          <path d={arrow.shaft} className="bp-mline" stroke={color} />
          <path d={arrow.head} className="bp-mline" stroke={color} />
        </>}
        <rect x={r2(m.box.x)} y={r2(m.box.y)} width={r2(m.box.w)} height={r2(m.box.h)} rx="0.45" className="bp-marker-back" />
        <text x={r2(m.textX)} y={r2(m.textY)} className="bp-marker-text" fill={color} style={{ fontSize: `${m.size}px` }}>
          {m.text}
        </text>
        {m.sub && <text x={r2(m.sub.x)} y={r2(m.sub.y)} className="bp-marker-sub" fill={color}>{m.sub.text}</text>}
        <g transform={`translate(${r2(m.glyphAt.x)} ${r2(m.glyphAt.y)})`}>
          <circle r="0.8" className="bp-mline" stroke={color} fill="rgba(10,30,90,0.55)" />
          {m.tone === 'mint' ? <path d="M-0.4 0.05 L-0.1 0.4 L0.45 -0.36" className="bp-mline bp-check" stroke={color} /> : <text y="0.36" textAnchor="middle" className="bp-glyph-q" fill={color}>?</text>}
        </g>
      </g>
    </g>
  );
}

export function FrontMark({ f, roughId }: { f: FrontItem; roughId?: string }) {
  const b: Rect = f.band;
  const rnd = seeded('front-band');
  const j = () => (rnd() - 0.5) * 0.35;
  const d = `M${r2(b.x + j())} ${r2(b.y + 0.2 + j())} L${r2(b.x + b.w * 0.5)} ${r2(b.y - 0.05 + j())} L${r2(b.x + b.w + j())} ${r2(b.y + 0.1 + j())} L${r2(b.x + b.w - 0.35 + j())} ${r2(b.y + b.h + j())} L${r2(b.x + b.w * 0.5)} ${r2(b.y + b.h + 0.12 + j())} L${r2(b.x + 0.25 + j())} ${r2(b.y + b.h - 0.1 + j())} Z`;
  const arrow = arrowShape(f.arrow.from, f.arrow.to, 0.3, 1.0);
  return (
    <g className="bp-front" pointerEvents="none" aria-hidden="true">
      <path d={d} className="bp-hl" filter={roughId ? `url(#${roughId})` : undefined} />
      <path d={`M${r2(b.x + 0.5)} ${r2(b.y + b.h * 0.34)} L${r2(b.x + b.w - 0.6)} ${r2(b.y + b.h * 0.3)}`} className="bp-hl-streak" />
      <path d={`M${r2(b.x + 0.4)} ${r2(b.y + b.h * 0.7)} L${r2(b.x + b.w - 0.9)} ${r2(b.y + b.h * 0.74)}`} className="bp-hl-streak" />
      <text x={r2(f.text.x)} y={r2(f.text.y + FONT.front * 0.34)} textAnchor="middle" className="bp-front-text" transform={`rotate(-4 ${r2(f.text.x)} ${r2(f.text.y)})`}>
        FRONT
      </text>
      <path d={arrow.shaft} className="bp-front-arrow" />
      <path d={arrow.head} className="bp-front-arrow" />
    </g>
  );
}

export function NoteMark({ n }: { n: NoteItem }) {
  const arrow = n.arrow ? arrowShape(n.arrow.from, n.arrow.to, 0.6, 0.8) : null;
  return (
    <g className="bp-note" pointerEvents="none" aria-hidden="true">
      <text x={r2(n.x)} y={r2(n.y)} textAnchor={n.anchor} className="bp-note-text" transform={`rotate(${n.rot} ${r2(n.x)} ${r2(n.y)})`}>
        {n.text}
      </text>
      {arrow && (
        <g>
          <path d={arrow.shaft} className="bp-note-line" />
          <path d={arrow.head} className="bp-note-line" />
        </g>
      )}
    </g>
  );
}

function hexPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    pts.push(`${r2(cx + Math.cos(a) * r)} ${r2(cy + Math.sin(a) * r)}`);
  }
  return `M${pts.join('L')}Z`;
}

export function SquadToken({ s }: { s: SquadItem }) {
  const r = s.r;
  const exact = s.at !== null;
  return (
    <g className={`bp-squad ${s.focus ? 'bp-squad-focus' : ''} ${exact ? 'bp-squad-at' : ''}`} pointerEvents="none" aria-hidden="true" data-squad={s.squadId}>
      {s.tick && (
        <g className="bp-squad-tick">
          <path d={`M${r2(s.tick.from.x)} ${r2(s.tick.from.y)} L${r2(s.tick.to.x)} ${r2(s.tick.to.y)}`} className="bp-tick-halo" />
          <path d={`M${r2(s.tick.from.x)} ${r2(s.tick.from.y)} L${r2(s.tick.to.x)} ${r2(s.tick.to.y)}`} className="bp-tick" />
        </g>
      )}
      <path d={hexPath(s.badge.x, s.badge.y, r)} className="bp-badge" />
      <text x={r2(s.badge.x)} y={r2(s.badge.y + r * 0.37)} textAnchor="middle" className="bp-badge-letter" style={exact ? { fontSize: `${r2(r * 1.1)}px` } : undefined}>
        {s.squadId}
      </text>
      <text x={r2(s.label.x)} y={r2(s.label.y)} textAnchor={s.anchor} className="bp-task-text">
        {s.lines.map((ln, i) => (
          <tspan key={i} x={r2(s.label.x)} dy={i === 0 ? 0 : FONT.task * 1.25}>
            {ln.toUpperCase()}
          </tspan>
        ))}
      </text>
    </g>
  );
}

/** A hand-wobbled closed loop around (cx, cy). */
function wobbleRing(cx: number, cy: number, r: number, key: string): string {
  const rnd = seeded(key);
  const p1 = rnd() * 6.28;
  const p2 = rnd() * 6.28;
  const pts: Vec[] = [];
  const N = 22;
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    const k = 1 + 0.07 * Math.sin(2 * th + p1) + 0.05 * Math.sin(3 * th + p2) + (rnd() - 0.5) * 0.03;
    pts.push({ x: cx + Math.cos(th) * r * k, y: cy + Math.sin(th) * r * k * 0.96 });
  }
  return smoothPath(pts, true);
}

// ------------------------------------------------------------------ people pictograms
// Silhouettes show a person even when their identity or role is still only reported.
// Only an explicit deceased condition changes a human's posture.
function Figure({ k = 1, dy = 0 }: { k?: number; dy?: number }) {
  return <g transform={`translate(0 ${dy}) scale(${k})`} data-silhouette="person">
    <circle cx="0" cy="-1.03" r="0.42" />
    <path d="M-0.36 -0.48 Q0 -0.62 0.36 -0.48 L0.55 0.32 L0.33 0.45 L0.43 1.4 L0.06 1.4 L0 0.56 L-0.06 1.4 L-0.43 1.4 L-0.33 0.45 L-0.55 0.32 Z" />
    <path d="M-0.35 -0.37 L-0.76 0.37 M0.35 -0.37 L0.76 0.37" className="bp-pg-line" />
  </g>;
}

export function KindGlyph({ kind }: { kind: PersonKindKey | null }) {
  if (kind === 'dog') return <g data-silhouette="dog">
    <rect x="-1" y="-0.42" width="1.75" height="0.78" rx="0.38" />
    <circle cx="1" cy="-0.56" r="0.4" />
    <path d="M1.3 -0.5 L1.75 -0.36 M-1 -0.3 Q-1.45 -0.8 -1.55 -0.95 M-0.7 0.35 V0.95 M-0.2 0.35 V0.95 M0.35 0.35 V0.95 M0.65 0.35 V0.95" className="bp-pg-line" />
    <path d="M0.9 -0.9 L1.05 -1.2 L1.22 -0.88" />
  </g>;
  return <Figure k={kind === 'child' ? 0.76 : 1} dy={kind === 'child' ? 0.3 : 0} />;
}

/** A compact schematic icon; the inspector carries the full public item name and certainty. */
export function CarriedGlyph({ glyph }: { glyph: PublicCarriedItem['glyph'] }) {
  switch (glyph) {
    case 'phone': return <><rect x="-.3" y="-.5" width=".6" height="1" rx=".1" /><path d="M-.12 .3 H.12" /></>;
    case 'document': return <><path d="M-.37 -.5 H.16 L.4 -.25 V.5 H-.37 Z M.16 -.5 V-.25 H.4 M-.2 0 H.23 M-.2 .22 H.23" /></>;
    case 'keys': return <><circle cx="-.18" cy="-.24" r=".25" /><path d="M0 -.04 L.4 .4 M.25 .25 L.4 .1 M.36 .36 L.52 .2" /></>;
    case 'wheelchair': return <><circle cx="-.03" cy="-.45" r=".13" /><path d="M-.04 -.23 V.13 H.35 L.51 .45 M-.05 -.12 H.3" /><path d="M-.2 .03 A.34 .34 0 1 0 .22 .35" /></>;
    case 'weapon': return <path d="M-.5 -.22 H.5 V.01 H-.03 L-.13 .43 H-.4 L-.3 .01 H-.5 Z" />;
    case 'tool': return <path d="M-.28 -.5 A.24 .24 0 0 0 -.01 -.16 L.4 .35 L.23 .5 L-.2 -.02 A.24 .24 0 0 0 -.46 -.34 L-.27 -.19 L-.1 -.34 Z" />;
    default: return <><rect x="-.4" y="-.35" width=".8" height=".75" rx=".08" /><path d="M-.2 -.35 V-.5 H.2 V-.35" /></>;
  }
}

/** Render only public PersonItems. Unknown people are filtered by the layout. */
export function PersonGlyph({ p }: { p: PersonItem }) {
  const { x, y } = p.at;
  if (p.status === 'disproved') return <g className="bp-person bp-person-clear" data-person={p.id} pointerEvents="none" aria-hidden="true">
    <path d={`M${r2(x - .55)} ${r2(y - .55)} L${r2(x + .55)} ${r2(y + .55)} M${r2(x + .55)} ${r2(y - .55)} L${r2(x - .55)} ${r2(y + .55)}`} className="bp-person-x" />
    {p.label && <text x={r2(p.label.x)} y={r2(p.label.y)} textAnchor={p.label.anchor} className="bp-person-label bp-person-label-sm">{p.label.text}</text>}
  </g>;
  const reported = p.status === 'reported';
  const linkStart = p.carried.length ? add(p.at, scale(unit(sub(p.carried[0].at, p.at)), 1)) : p.at;
  return <g className={`bp-person bp-person-${p.status}${p.stale ? ' bp-person-stale' : ''}`} data-person={p.id} data-kind={p.kind ?? ''} data-condition={p.condition} pointerEvents="none" aria-hidden="true">
    {reported && <path d={wobbleRing(x, y, 1.75, `${p.id}:ring`)} className="bp-person-ring" />}
    <g transform={`translate(${r2(x)} ${r2(y)})${p.condition === 'deceased' ? ' rotate(90)' : ''}`} className={`bp-pg bp-pg-${reported ? 'rep' : 'conf'}`}>
      <KindGlyph kind={p.kind} />
    </g>
    {p.condition && <g transform={`translate(${r2(x - 1.3)} ${r2(y + 1.15)})`} className="bp-person-condition">
      <title>{p.condition === 'deceased' ? 'Deceased' : 'Injured'}</title>
      <circle r=".52" />
      <path d={p.condition === 'deceased' ? 'M-.2 -.2 L.2 .2 M.2 -.2 L-.2 .2' : 'M-.26 0 H.26 M0 -.26 V.26'} />
    </g>}
    {p.carried.length > 0 && <path className="bp-carried-link" d={`M${r2(linkStart.x)} ${r2(linkStart.y)} L${r2(p.carried[0].at.x)} ${r2(p.carried[0].at.y)}`} />}
    {p.carried.map((item) => <g key={item.id} transform={`translate(${r2(item.at.x)} ${r2(item.at.y)}) scale(${CARRIED_SCALE})`} className={`bp-carried bp-carried-${item.status}`} data-carried={item.id} data-holder={p.id} data-item-status={item.status}>
      <title>{`${item.label} · ${item.status}`}</title>
      <rect x="-.55" y="-.65" width="1.1" height="1.3" rx=".16" className="bp-carried-back" />
      <CarriedGlyph glyph={item.glyph} />
    </g>)}
    {p.label && <text x={r2(p.label.x)} y={r2(p.label.y)} textAnchor={p.label.anchor} className="bp-person-label">{p.label.text}</text>}
    {p.caption && <text x={r2(p.caption.x)} y={r2(p.caption.y)} textAnchor={p.caption.anchor} className="bp-person-caption">{p.caption.text}</text>}
    {p.chip && <g className={`bp-chip bp-chip-${p.status}`}>
      <rect x={r2(p.chip.x)} y={r2(p.chip.y)} width={r2(p.chip.w)} height={r2(p.chip.h)} rx=".35" className="bp-chip-box" />
      <text x={r2(p.chip.x + p.chip.w / 2)} y={r2(p.chip.y + p.chip.h * .7)} textAnchor="middle" className="bp-chip-text">{p.chip.text}</text>
    </g>}
  </g>;
}

/** One member of the crowd outside: a tiny neutral figure. */
export function CrowdFigure({ at }: { at: Vec }) {
  return (
    <g className="bp-crowd-fig" transform={`translate(${r2(at.x)} ${r2(at.y)}) scale(0.72)`}>
      <Figure />
    </g>
  );
}
