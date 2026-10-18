// The Flow canvas (spec 3.3): night blueprint paper, lanes labelled by hand, node cards, ribbons and
// the current Play path as an amber track. Pan by dragging, zoom with the wheel or the buttons, 0 fits.
// Text never shrinks below a readable size: when zoomed out, cards keep their title and reach at a
// fixed screen size and drop the prompt (semantic zoom). Hovering a box lights its cone (everything
// upstream and downstream of a node, upstream of an ending, downstream of a choice) and fades the rest.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type { Weight } from '../../../../gen/incident/trees-v13/balance';
import { WEIGHTS } from '../../../../gen/incident/trees-v13/balance';
import type { ReachTally } from '../../jobs/tally';
import { endingGrowth, fitView, traceCone } from '../../model/flow-layout';
import type { FlowBox, FlowLane, FlowLayout, FlowPath } from '../../model/flow-layout';
import { useMedia } from '../../shell/media';
import { cx, Glyph, LintGlyph } from '../../viz';
import type { Pins } from './flow-text';
import { worstSeverity } from './flow-text';

/** What a box says. `share`: the reach figure; `title` for hover holds the full words. */
export interface BoxLabel { title: string; lead?: ReactNode; meta?: ReactNode; share?: string; shareTitle?: string; aria: string; icon?: ReactNode; sub?: string }
export interface StateMarks { writers: Map<string, number>; readers: Map<string, number>; arcs: [from: string, to: string][] }
export interface View { k: number; x: number; y: number }

const LANE_WORDS: Record<FlowLane, string> = { assess: 'Assess', adapt: 'Adapt', resolve: 'Resolve', endings: 'Endings' };
const MIN_K = 0.18, MAX_K = 1.6;
/** An ending row shorter than this on screen shows its title on one line (14px · 1.12), with an
 * ellipsis and the whole title on hover; two lines need this much. Fit's floor and the ending rows'
 * screen width are fitView's (model/flow-layout.ts). */
const TWO_LINES_PX = 2 * 14 + 2;
/** A node card shorter than this on screen tightens its padding and grows to hold its title and
 * share (14px · 1.15 over 12px · 1.15, about 34px), into the gap below it rather than over them. */
const NODE_ROWS_PX = 16 + 14 + 2 + 10;

/** The viewport's width and height less what the inspector covers (its left edge when it lies over
 * the right side, its top when it lies over the bottom). */
function visibleArea(el: HTMLElement): { w: number; h: number } {
  const rect = el.getBoundingClientRect();
  const cover = el.parentElement?.querySelector('.lab-flow-inspector')?.getBoundingClientRect();
  const beside = !!cover && cover.left > rect.left + 40 && cover.left < rect.right;
  return {
    w: beside ? cover!.left - rect.left : rect.width,
    h: cover && cover.top > rect.top + 40 && cover.top < rect.bottom ? cover.top - rect.top : rect.height,
  };
}
/** Below this zoom the prompt lead is dropped and titles and figures keep a fixed screen size. */
const NEAR = 0.72;

export function FlowCanvas({ layout, labels, pins, color, tally, selected, track, state, fitKey, onSelect, onExpand, expanded, view, onView }: {
  layout: FlowLayout; labels: Map<string, BoxLabel>; pins: Map<string, Pins>; color: 'band' | 'fate'; tally: ReachTally | null;
  selected: string | null; track: string[]; state: StateMarks | null; fitKey: string; expanded: ReadonlySet<string>;
  onSelect(id: string): void; onExpand(node: string): void; view: View | null; onView(view: View): void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const v = view ?? { k: 0.5, x: 0, y: 0 };
  /** True until the person pans or zooms: a resize refits only then. */
  const fitted = useRef(true);
  const viewRef = useRef(v);
  viewRef.current = v;

  /** Fit the whole call, endings included, into the part of the canvas the inspector leaves
   * visible (it lies over the right side at 1440 and the bottom at 900). Returns the view it set. */
  const fit = useCallback((): View | null => {
    const el = viewport.current;
    if (!el) return null;
    const { w, h } = visibleArea(el);
    const next = fitView(layout, w, h);
    onView(next);
    return next;
  }, [layout, onView]);

  // The inspector opens and closes with the selection: a fitted view refits to the room it leaves,
  // and a selection it would still cover is panned into the part of the canvas that stays visible.
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const box = selected ? layout.boxes[selected] : null;
    const frame = window.requestAnimationFrame(() => {
      const cur = fitted.current ? fit() ?? viewRef.current : viewRef.current;
      if (!box) return;
      const { w: right, h: bottom } = visibleArea(el);
      const left = cur.x + box.x * cur.k, top = cur.y + box.y * cur.k, w = box.w * cur.k, h = box.h * cur.k;
      if (left >= 8 && top >= 8 && left + w <= right - 8 && top + h <= bottom - 8) return;
      setView({ k: cur.k, x: right / 2 - (box.x + box.w / 2) * cur.k, y: bottom / 2 - (box.y + box.h / 2) * cur.k });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selected]);

  // Fit on first paint and whenever the call or the mode changes what is drawn; keep the view otherwise.
  useLayoutEffect(() => { fit(); }, [fitKey]);
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const observer = new ResizeObserver(() => { if (fitted.current) fit(); });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fit]);
  const setView = (next: View) => { fitted.current = false; onView(next); };

  const zoomAt = (factor: number, cx0?: number, cy0?: number) => {
    const el = viewport.current;
    if (!el) return;
    const px = cx0 ?? el.clientWidth / 2, py = cy0 ?? el.clientHeight / 2;
    const k = Math.max(MIN_K, Math.min(MAX_K, v.k * factor));
    setView({ k, x: px - (px - v.x) * (k / v.k), y: py - (py - v.y) * (k / v.k) });
  };
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const cur = viewRef.current;
      const k = Math.max(MIN_K, Math.min(MAX_K, cur.k * Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0015))));
      const px = event.clientX - rect.left, py = event.clientY - rect.top;
      fitted.current = false;
      onView({ k, x: px - (px - cur.x) * (k / cur.k), y: py - (py - cur.y) * (k / cur.k) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onView]);

  // The viewport clips; focusing an off-screen card would scroll it under the transform. Turn any
  // such scroll into a pan, so the view and the paper never disagree.
  const onScroll = () => {
    const el = viewport.current;
    if (!el || (!el.scrollLeft && !el.scrollTop)) return;
    const cur = viewRef.current;
    const dx = el.scrollLeft, dy = el.scrollTop;
    el.scrollLeft = 0;
    el.scrollTop = 0;
    setView({ k: cur.k, x: cur.x - dx, y: cur.y - dy });
  };

  // Drag the paper to pan.
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('.lab-flow-box, .lab-flow-tools, .lab-flow-legend, .lab-flow-hitpath')) return;
    drag.current = { x: event.clientX, y: event.clientY, vx: v.x, vy: v.y, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.x, dy = event.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true;
    if (d.moved) setView({ k: v.k, x: d.vx + dx, y: d.vy + dy });
  };
  const onPointerUp = () => { drag.current = null; };

  // Center the selection when asked (`.` key), from the parent through a custom event.
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onCenter = () => {
      const box = selected ? layout.boxes[selected] : null;
      if (!box) return;
      setView({ k: v.k, x: el.clientWidth / 2 - (box.x + box.w / 2) * v.k, y: el.clientHeight / 2 - (box.y + box.h / 2) * v.k });
    };
    const onFit = () => { fitted.current = true; fit(); };
    const onZoom = (event: Event) => zoomAt((event as CustomEvent<number>).detail);
    el.addEventListener('lab-flow-center', onCenter);
    el.addEventListener('lab-flow-fit', onFit);
    el.addEventListener('lab-flow-zoom', onZoom);
    return () => { el.removeEventListener('lab-flow-center', onCenter); el.removeEventListener('lab-flow-fit', onFit); el.removeEventListener('lab-flow-zoom', onZoom); };
  });

  // Hover cones.
  const cone = useMemo(() => {
    if (!hover) return null;
    const box = layout.boxes[hover];
    if (box) return traceCone(layout, hover, box.kind === 'ending' ? 'up' : box.kind === 'choice' ? 'down' : 'both');
    const path = layout.paths.find(p => p.id === hover);
    if (!path) return null;
    const up = traceCone(layout, path.from, 'up'), down = traceCone(layout, path.to, 'down');
    return { boxes: new Set([...up.boxes, ...down.boxes]), paths: new Set([...up.paths, ...down.paths, path.id]) };
  }, [hover, layout]);
  const lit = (id: string, kind: 'box' | 'path') => !cone || (kind === 'box' ? cone.boxes.has(id) : cone.paths.has(id));

  const level = v.k < NEAR ? 'far' : 'near';
  const inv = 1 / v.k;
  const grow = endingGrowth(layout, v.k);
  const worldStyle = { width: layout.width + grow, height: layout.height, transform: `translate(${v.x}px, ${v.y}px) scale(${v.k})`, '--lab-flow-inv': inv } as CSSProperties;

  const boxes = Object.values(layout.boxes);
  const centre = (id: string) => { const b = layout.boxes[id]; return b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : null; };
  const trackPoints = track.map(centre).filter((p): p is { x: number; y: number } => !!p);

  return (
    <div ref={viewport} className={cx('lab-flow-viewport', drag.current?.moved && 'lab-flow-dragging')} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onScroll={onScroll} data-zoom={v.k.toFixed(2)} data-level={level}>
      <div className={cx('lab-flow-world', `lab-flow-${level}`, v.k < 0.5 && 'lab-flow-tiny', reduced && 'lab-flow-still', cone && 'lab-flow-coned')} style={worldStyle}>
        {layout.lanes.map((lane, i) => (
          <div key={lane.lane} className={cx('lab-flow-lane', i % 2 === 1 && 'lab-flow-lane-alt')} style={{ left: lane.x, width: lane.w + (lane.lane === 'endings' ? grow : 0), height: layout.height }}>
            <span className="lab-flow-lane-label">{LANE_WORDS[lane.lane]}</span>
          </div>
        ))}
        <svg className="lab-flow-svg" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
          {layout.paths.map(p => <Ribbon key={p.id} path={p} color={color} tally={tally} lit={lit(p.id, 'path')} selected={selected === p.id} />)}
          {state && <StateArcs layout={layout} arcs={state.arcs} />}
          {trackPoints.length > 1 && <polyline className="lab-flow-track" points={trackPoints.map(p => `${p.x},${p.y}`).join(' ')} />}
          {layout.paths.map(p => (
            <path key={`hit-${p.id}`} className="lab-flow-hitpath" d={p.d} strokeWidth={Math.max(10, p.width + 6)}
              onPointerEnter={() => setHover(p.id)} onPointerLeave={() => setHover(h => (h === p.id ? null : h))} onClick={() => onSelect(p.id)}>
              <title>{pathTitle(p, labels)}</title>
            </path>
          ))}
        </svg>
        {boxes.map(box => (
          <BoxView key={box.id} box={box} label={labels.get(box.id)} pins={pins.get(box.id)} selected={selected === box.id} faded={!lit(box.id, 'box')}
            short={level === 'far' && (box.kind === 'ending' ? box.h * v.k < TWO_LINES_PX : box.kind === 'node' && box.h * v.k < NODE_ROWS_PX)} grow={box.kind === 'ending' ? grow : 0}
            writes={state?.writers.get(box.id) ?? 0} reads={state?.readers.get(box.id) ?? 0} expanded={box.kind === 'node' && expanded.has(box.treeId)}
            onSelect={() => onSelect(box.id)} onExpand={() => box.node && onExpand(box.node)} onHover={on => setHover(h => (on ? box.id : h === box.id ? null : h))} />
        ))}
        {track.map((id, i) => {
          const b = layout.boxes[id];
          if (!b) return null;
          return <span key={`${id}-${i}`} className="lab-flow-bead" style={{ left: b.x - 9, top: b.y - 9 }} title={`Play path, step ${i}`}>{i}</span>;
        })}
      </div>
      <div className="lab-flow-tools" role="toolbar" aria-label="Zoom">
        <button type="button" className="lab-icon-button" onClick={() => zoomAt(1.25)} aria-label="Zoom in" title="Zoom in (+)"><span aria-hidden="true">+</span></button>
        <button type="button" className="lab-icon-button" onClick={() => zoomAt(0.8)} aria-label="Zoom out" title="Zoom out (−)"><span aria-hidden="true">−</span></button>
        <button type="button" className="lab-button lab-button-quiet lab-flow-fit" onClick={() => { fitted.current = true; fit(); }} title="Fit the whole call (0)">
          <Glyph name="scan" size={13} />Fit
        </button>
        <span className="lab-flow-zoom">{Math.round(v.k * 100)}%</span>
      </div>
      <Legend color={color} />
    </div>
  );
}

function pathTitle(p: FlowPath, labels: Map<string, BoxLabel>): string {
  const from = labels.get(p.from)?.title ?? p.from, to = labels.get(p.to)?.title ?? p.to;
  const what = p.kind === 'drawn' ? `drawn result: ${p.drawn ?? ''}` : p.kind === 'turn' ? 'turn drawn per call' : p.kind === 'choice' ? 'choice taken' : p.band ? BAND_TEXT[p.band] : '';
  const runs = p.n === null ? '' : p.n === 0 ? ' · never taken in these runs' : ` · ${p.n.toLocaleString('en-US')} runs${p.p !== null ? ` (≈${Math.round(p.p * 100)}%)` : ''}`;
  return `${from} → ${to} · ${what}${runs}${p.ghost ? ' · dropped in this call' : ''}${p.blocked ? ' · needs a hidden fact this situation doesn’t have' : ''}`;
}
const BAND_TEXT = { favorable: 'goes well', mixed: 'complications', adverse: 'goes badly' } as const;

function Ribbon({ path: p, color, tally, lit, selected }: { path: FlowPath; color: 'band' | 'fate'; tally: ReachTally | null; lit: boolean; selected: boolean }) {
  const tone = p.kind === 'ribbon' && p.band ? p.band : p.kind === 'drawn' ? 'drawn' : p.kind === 'turn' ? 'turn' : 'choice';
  const zero = p.dashed && !p.ghost;
  const cls = cx('lab-flow-path', `lab-flow-path-${tone}`, p.ghost && 'lab-flow-path-ghost', zero && 'lab-flow-path-zero', p.blocked && !zero && 'lab-flow-path-blocked', p.arc && 'lab-flow-path-arc',
    !lit && 'lab-flow-faded', selected && 'lab-flow-path-on');
  const width = zero ? 1 : p.width;
  // Fate: the ribbon split into stripes by the run classes of the runs that took it.
  if (color === 'fate' && tally?.edgeFate && p.kind === 'ribbon' && !p.ghost && !zero && (p.n ?? 0) > 0) {
    const mix: Record<Weight, number> = { death: 0, hurt: 0, unresolved: 0, costly: 0, clean: 0 };
    for (const key of p.keys) { const fate = tally.edgeFate[key]; if (fate) for (const w of WEIGHTS) mix[w] += fate[w] ?? 0; }
    const total = WEIGHTS.reduce((n, w) => n + mix[w], 0);
    if (total > 0) {
      let offset = -width / 2;
      return (
        <g className={cx('lab-flow-fate', !lit && 'lab-flow-faded')}>
          {[...WEIGHTS].reverse().filter(w => mix[w] > 0).map(w => {
            const stripe = (width * mix[w]) / total;
            const dy = offset + stripe / 2;
            offset += stripe;
            return <path key={w} className={`lab-flow-path lab-flow-fate-${w}`} d={p.d} strokeWidth={stripe} transform={`translate(0 ${dy.toFixed(2)})`} />;
          })}
        </g>
      );
    }
  }
  return <path className={cls} d={p.d} strokeWidth={width} />;
}

function StateArcs({ layout, arcs }: { layout: FlowLayout; arcs: [string, string][] }) {
  return (
    <g className="lab-flow-state-arcs">
      {arcs.map(([from, to]) => {
        const a = layout.boxes[from], b = layout.boxes[to];
        if (!a || !b) return null;
        const x1 = a.x + a.w / 2, y1 = a.y + a.h, x2 = b.x + b.w / 2, y2 = b.y + b.h;
        const dip = Math.max(y1, y2) + 40 + Math.abs(x2 - x1) * 0.08;
        return <path key={`${from}>${to}`} className="lab-flow-state-arc" d={`M${x1},${y1} C${x1},${dip} ${x2},${dip} ${x2},${y2}`} markerEnd="" />;
      })}
    </g>
  );
}

function BoxView({ box, label, pins, selected, faded, short, grow, writes, reads, expanded, onSelect, onExpand, onHover }: {
  box: FlowBox; label?: BoxLabel; pins?: Pins; selected: boolean; faded: boolean; short: boolean; grow: number; writes: number; reads: number; expanded: boolean;
  onSelect(): void; onExpand(): void; onHover(on: boolean): void;
}) {
  if (!label) return null;
  const style: CSSProperties = { left: box.x, top: box.y, width: box.w + grow, height: box.h };
  const severity = pins ? worstSeverity(pins.lint) : null;
  const zero = box.n === 0 && !box.ghost;
  return (
    <div className={cx('lab-flow-box', `lab-flow-${box.kind}`, box.ghost && 'lab-flow-ghost', selected && 'lab-flow-selected', faded && 'lab-flow-faded',
      zero && 'lab-flow-zero', box.weight && `lab-flow-w-${box.weight}`, short && 'lab-flow-short')} style={style}
      onPointerEnter={() => onHover(true)} onPointerLeave={() => onHover(false)} data-box={box.id}>
      <button type="button" className="lab-flow-hit" onClick={onSelect} onDoubleClick={box.kind === 'node' ? onExpand : undefined}
        aria-label={label.aria} aria-pressed={selected} title={box.ghost && box.reason ? `${label.title}: ${box.reason}` : label.shareTitle ?? label.title} />
      {box.kind === 'node' && <>
        <span className="lab-flow-node-title">{label.title}</span>
        {label.lead && <span className="lab-flow-node-lead">{label.lead}</span>}
        <span className="lab-flow-node-meta">{label.share && <b>{label.share}</b>}{label.meta}</span>
        {box.ghost && box.reason && <span className="lab-flow-ghost-note">{box.reason}</span>}
        <button type="button" className="lab-flow-expand" onClick={onExpand} aria-label={expanded ? `Fold ${label.title}'s choices` : `Show ${label.title}'s choices`}
          title={expanded ? 'Fold the choices (Enter)' : 'Show the choices (Enter)'}>{expanded ? '−' : '+'}</button>
      </>}
      {box.kind === 'ending' && <>
        <span className="lab-flow-end-stripe" aria-hidden="true" />
        {label.icon}
        <span className="lab-flow-end-title">{label.title}</span>
        {label.share && <span className="lab-flow-end-share">{label.share}</span>}
      </>}
      {box.kind === 'choice' && <>
        {label.icon}
        <span className="lab-flow-choice-title">{label.title}</span>
        {label.meta && <span className="lab-flow-choice-meta">{label.meta}</span>}
      </>}
      {box.kind === 'turn' && <>
        <Glyph name="turn" size={18} />
        <span className="lab-flow-turn-label">{label.title}{label.sub && <small>{label.sub}</small>}</span>
      </>}
      {box.kind === 'junction' && <Glyph name="drawn" size={14} />}
      {(severity || (pins?.notes ?? 0) > 0 || writes > 0 || reads > 0) && (
        <span className="lab-flow-pins">
          {writes > 0 && <span className="lab-flow-pin lab-flow-pin-write" title={`Writes this key (${writes} ${writes === 1 ? 'place' : 'places'})`}><Glyph name="writes" size={12} />{writes > 1 ? writes : ''}</span>}
          {reads > 0 && <span className="lab-flow-pin lab-flow-pin-read" title={`Reads this key (${reads} ${reads === 1 ? 'place' : 'places'})`}><Glyph name="reads" size={12} />{reads > 1 ? reads : ''}</span>}
          {severity && <span className="lab-flow-pin" title={pins!.lint.map(f => f.message).join('\n')}><LintGlyph severity={severity} size={12} />{pins!.lint.length > 1 ? pins!.lint.length : ''}</span>}
          {(pins?.notes ?? 0) > 0 && <span className="lab-flow-pin lab-flow-pin-note" title={`${pins!.notes} review ${pins!.notes === 1 ? 'note' : 'notes'}`}><Glyph name="note" size={12} />{pins!.notes}</span>}
        </span>
      )}
    </div>
  );
}

function Legend({ color }: { color: 'band' | 'fate' }) {
  const swatch = (cls: string) => <svg width="26" height="8" aria-hidden="true"><path className={cx('lab-flow-path', cls)} d="M1,4 H25" strokeWidth={cls.includes('zero') ? 1 : 3} /></svg>;
  return (
    <div className="lab-flow-legend" aria-label="Legend">
      {color === 'band' ? <>
        <span>{swatch('lab-flow-path-favorable')}Goes well</span>
        <span>{swatch('lab-flow-path-mixed')}Complications</span>
        <span>{swatch('lab-flow-path-adverse')}Goes badly</span>
      </> : <>
        {(['clean', 'costly', 'unresolved', 'hurt', 'death'] as const).map(w => <span key={w}>{swatch(`lab-flow-fate-${w}`)}{w[0].toUpperCase() + w.slice(1)}</span>)}
      </>}
      <span>{swatch('lab-flow-path-drawn')}<Glyph name="drawn" size={11} />Drawn</span>
      <span>{swatch('lab-flow-path-zero')}Never taken</span>
      <span title="Every route behind it needs a hidden fact this call’s situation doesn’t have">{swatch('lab-flow-path-favorable lab-flow-path-blocked')}Not in this situation</span>
    </div>
  );
}
