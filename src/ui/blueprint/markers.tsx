// Hand-drawn annotation layer: marker loops, arrows, glyphs, the FRONT highlighter, notes, squad tokens.
import { add, perp, r2, scale, seeded, smoothPath, sub, unit, type Rect } from './geometry';
import type { Vec } from '../../sim/types';
import type { FrontItem, MarkerItem, NoteItem, PersonItem, PersonKindKey, SquadItem } from './layout';
import { FONT } from './layout';

const toneVar = (tone: 'amber' | 'mint') => (tone === 'amber' ? 'var(--marker-amber)' : 'var(--marker-mint)');

function loopPoints(m: MarkerItem, key: string, sweep: number, grow: number, start: number): Vec[] {
  const rnd = seeded(`${m.spaceId}:${key}`);
  const p1 = rnd() * 6.28;
  const p2 = rnd() * 6.28;
  const tilt = (m.tilt * Math.PI) / 180;
  const N = 30;
  const pts: Vec[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const th = start + t * sweep * Math.PI * 2;
    const g = 1 + (t - 0.5) * grow;
    const j = 1 + 0.035 * Math.sin(2 * th + p1) + 0.028 * Math.sin(3 * th + p2) + (rnd() - 0.5) * 0.018;
    const ex = Math.cos(th) * m.rx * g * j;
    const ey = Math.sin(th) * m.ry * g * j;
    pts.push({ x: m.cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), y: m.cy + ex * Math.sin(tilt) + ey * Math.cos(tilt) });
  }
  return pts;
}

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
  const main = smoothPath(loopPoints(m, 'a', 1.1, 0.1, -0.35 * Math.PI));
  const second = smoothPath(loopPoints(m, 'b', 0.82, 0.05, 0.1 * Math.PI));
  const cls = draw ? 'bp-draw' : '';
  const arrow = arrowShape(m.arrow.from, m.arrow.to, 0.5, 0.75);
  const tcx = m.textX + m.textW / 2;
  return (
    <g className={`bp-marker bp-marker-${m.tone}`} data-space={m.spaceId} pointerEvents="none" color={color} aria-hidden="true">
      <path d={main} pathLength={1} className={`bp-mloop ${cls}`} stroke={color} />
      <path d={second} pathLength={1} className={`bp-mloop bp-mloop-2 ${cls}`} stroke={color} />
      <g className={draw ? 'bp-fade' : ''}>
        <path d={arrow.shaft} className="bp-mline" stroke={color} />
        <path d={arrow.head} className="bp-mline" stroke={color} />
        <text x={r2(m.textX)} y={r2(m.textY)} className="bp-marker-text" fill={color} transform={`rotate(${r2(m.tilt)} ${r2(tcx)} ${r2(m.textY)})`}>
          {m.text}
        </text>
        {m.sub && (
          <text x={r2(m.sub.x)} y={r2(m.sub.y)} className="bp-marker-sub" fill={color} transform={`rotate(${r2(m.tilt)} ${r2(tcx)} ${r2(m.textY)})`}>
            {m.sub.text}
          </text>
        )}
        <g transform={`translate(${r2(m.glyphAt.x)} ${r2(m.glyphAt.y)}) rotate(${r2(m.tilt)})`}>
          <circle r="0.95" className="bp-mline" stroke={color} fill="rgba(10,30,90,0.55)" />
          {m.tone === 'mint' ? <path d="M-0.45 0.05 L-0.1 0.45 L0.52 -0.42" className="bp-mline bp-check" stroke={color} /> : <text y="0.36" textAnchor="middle" className="bp-glyph-q" fill={color}>?</text>}
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
// Simple marker-style pictograms in a ~2.4 ft box centred on (0,0). Shapes differ by kind so the kind never
// rests on colour: subject = figure in a diamond, civilian = bare figure, child = small figure, patient = lying
// figure with a cross, dog = four-legged side view, unknown = dashed figure with '?'.

function Figure({ k = 1, dy = 0 }: { k?: number; dy?: number }) {
  return (
    <g transform={`translate(0 ${dy}) scale(${k})`}>
      <circle cx="0" cy="-0.62" r="0.52" />
      <path d="M-0.98 0.98 C-0.98 0.2 -0.58 -0.08 0 -0.08 C0.58 -0.08 0.98 0.2 0.98 0.98 Z" />
    </g>
  );
}

export function KindGlyph({ kind }: { kind: PersonKindKey | null }) {
  switch (kind) {
    case 'subject':
      return (
        <g>
          <Figure k={0.82} dy={0.05} />
          <path d="M0 -1.5 L1.5 0 L0 1.5 L-1.5 0 Z" className="bp-pg-line" />
        </g>
      );
    case 'child':
      return <Figure k={0.68} dy={0.34} />;
    case 'patient':
      return (
        <g>
          <circle cx="-0.95" cy="0.1" r="0.46" />
          <rect x="-0.42" y="-0.38" width="1.7" height="0.9" rx="0.4" />
          <path d="M0.55 -1.0 V-0.5 M0.3 -0.75 H0.8" className="bp-pg-line" />
        </g>
      );
    case 'dog':
      return (
        <g>
          <rect x="-1.0" y="-0.42" width="1.75" height="0.78" rx="0.38" />
          <circle cx="1.0" cy="-0.56" r="0.4" />
          <path d="M1.3 -0.5 L1.75 -0.36" className="bp-pg-line" />
          <path d="M0.9 -0.9 L1.05 -1.2 L1.22 -0.88" />
          <path d="M-1.0 -0.3 Q-1.45 -0.8 -1.55 -0.95 M-0.7 0.35 V0.95 M-0.2 0.35 V0.95 M0.35 0.35 V0.95 M0.65 0.35 V0.95" className="bp-pg-line" />
        </g>
      );
    case 'unknown':
      return (
        <g>
          <Figure k={0.9} />
          <text y="0.58" textAnchor="middle" className="bp-pg-q">
            ?
          </text>
        </g>
      );
    default:
      return <Figure />;
  }
}

/**
 * People the player's knowledge allows on the map.
 *  reported  = dashed amber ring with a '?'; a known kind is drawn inside it as a dashed outline. A report
 *              whose label says 'last seen' is faded and captioned 'last seen'.
 *  confirmed = mint pictogram by kind, with its label.
 *  disproved = small mint cross and 'clear'.
 * An armament chip is drawn only when the data names one.
 */
export function PersonGlyph({ p }: { p: PersonItem }) {
  const { x, y } = p.at;
  const chip = p.chip && (
    <g className={`bp-chip bp-chip-${p.status}`}>
      <rect x={r2(p.chip.x)} y={r2(p.chip.y)} width={r2(p.chip.w)} height={r2(p.chip.h)} rx="0.35" className="bp-chip-box" />
      <text x={r2(p.chip.x + p.chip.w / 2)} y={r2(p.chip.y + p.chip.h * 0.7)} textAnchor="middle" className="bp-chip-text">
        {p.chip.text}
      </text>
    </g>
  );
  if (p.status === 'reported') {
    return (
      <g className={`bp-person bp-person-reported${p.stale ? ' bp-person-stale' : ''}`} data-person={p.id} data-kind={p.kind ?? ''} pointerEvents="none" aria-hidden="true">
        <path d={wobbleRing(x, y, 1.75, `${p.id}:ring`)} className="bp-person-ring" />
        {p.kind ? (
          <>
            <g transform={`translate(${r2(x)} ${r2(y + 0.1)}) scale(0.74)`} className="bp-pg bp-pg-rep">
              <KindGlyph kind={p.kind} />
            </g>
            <text x={r2(x + 1.45)} y={r2(y - 0.95)} textAnchor="middle" className="bp-person-q bp-person-q-sm">
              ?
            </text>
          </>
        ) : (
          <text x={r2(x)} y={r2(y + 0.72)} textAnchor="middle" className="bp-person-q">
            ?
          </text>
        )}
        {p.caption && (
          <text x={r2(p.caption.x)} y={r2(p.caption.y)} className="bp-person-caption" textAnchor="middle">
            {p.caption.text}
          </text>
        )}
        {chip}
      </g>
    );
  }
  if (p.status === 'confirmed') {
    return (
      <g className="bp-person bp-person-confirmed" data-person={p.id} data-kind={p.kind ?? ''} pointerEvents="none" aria-hidden="true">
        <g transform={`translate(${r2(x)} ${r2(y)}) scale(1.12)`} className="bp-pg bp-pg-conf">
          <KindGlyph kind={p.kind} />
        </g>
        {p.label && (
          <text x={r2(p.label.x)} y={r2(p.label.y)} textAnchor={p.label.anchor} className="bp-person-label">
            {p.label.text}
          </text>
        )}
        {chip}
      </g>
    );
  }
  return (
    <g className="bp-person bp-person-clear" data-person={p.id} pointerEvents="none" aria-hidden="true">
      <path d={`M${r2(x - 0.55)} ${r2(y - 0.55)} L${r2(x + 0.55)} ${r2(y + 0.55)} M${r2(x + 0.55)} ${r2(y - 0.55)} L${r2(x - 0.55)} ${r2(y + 0.55)}`} className="bp-person-x" />
      {p.label && (
        <text x={r2(p.label.x)} y={r2(p.label.y)} textAnchor={p.label.anchor} className="bp-person-label bp-person-label-sm">
          {p.label.text}
        </text>
      )}
    </g>
  );
}

/** One member of the crowd outside: a tiny neutral figure. */
export function CrowdFigure({ at }: { at: Vec }) {
  return (
    <g className="bp-crowd-fig" transform={`translate(${r2(at.x)} ${r2(at.y)}) scale(0.72)`}>
      <Figure />
    </g>
  );
}
