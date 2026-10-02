// The operations blueprint. Drawn entirely from built.location / built.derived plus the player's
// SpaceViews; nothing here is a bitmap of the house, so the drawing cannot drift from the rules.
import { useCallback, useId, useMemo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { BuiltLocation, Id, MapOverlay, SpaceView, SquadId, SquadTask, Vec } from '../../sim/types';
import './blueprint.css';
import { computeDimensions, sheetViewBox } from './dimensions';
import { DimensionLines, NorthArrow } from './DimensionLines';
import { ObjectLabels, ObjectSymbol, isFloorLayer } from './furniture';
import { bboxOf, polyPath, r2 } from './geometry';
import { computeFrame } from './frame';
import { computeLayout } from './layout';
import { FrontMark, MarkerLoop, NoteMark, PersonGlyph, SquadToken } from './markers';
import { MaterialLegend, WallMaterialRuns, WallPatternDefs, materialsInUse } from './materials';
import { OverlayLayer, placeOverlays } from './overlays';
import { OpeningsLayer } from './openings';
import { PaperBack, PaperDefs, PaperFront, ids } from './paper';
import { computeWalls } from './walls';
import { statusWord } from './RoomList';
import { useViewport } from './useViewport';

export interface BlueprintProps {
  built: BuiltLocation;
  /** Player-knowledge view per space (labels, markers, squads, targetable actions). */
  spaces: SpaceView[];
  squadTasks: SquadTask[];
  selectedSpaceId: Id | null;
  focusSquadId: SquadId | null;
  /** Spaces targeted by the currently selected action. */
  highlightSpaceIds?: Id[];
  onSelectSpace?: (id: Id) => void;
  /** Changes when a committed decision altered knowledge; animate these spaces once. */
  lastChange?: { revision: number; spaceIds: Id[] } | null;
  /** The selected action's spatial explanation (sightlines, ranges, paths). Drawn above rooms, below labels. */
  overlays?: MapOverlay[];
  /** Shows the MATERIALS key listing the wall, door and window patterns this plan uses. */
  showMaterials?: boolean;
  className?: string;
}

const DOUBLE_TAP_MS = 380;
const DRAG_SLOP_PX = 5;

export function Blueprint({ built, spaces, squadTasks, selectedSpaceId, focusSquadId, highlightSpaceIds, onSelectSpace, lastChange, overlays, showMaterials, className }: BlueprintProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const loc = built.location;
  const id = ids(uid);

  // Layout depends on what the player knows; key it on the fields it reads so store churn does not re-run the search.
  const sig = JSON.stringify([
    spaces.map((s) => [s.id, s.label, s.marker?.text ?? null, s.marker?.tone ?? null, s.marker?.subtext ?? null, (s.people ?? []).map((p) => [p.id, p.at, p.status, p.label])]),
    squadTasks,
    focusSquadId,
  ]);
  // The drawn frame: footprint plus the exterior ground actually used. Keyed like the layout.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const frame = useMemo(() => computeFrame(built, squadTasks, spaces), [built, sig]);
  const base = useMemo(() => sheetViewBox(loc, frame), [loc, frame]);
  const walls = useMemo(() => computeWalls(loc), [loc]);
  const dims = useMemo(() => computeDimensions(loc, frame), [loc, frame]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => computeLayout(built, spaces, squadTasks, focusSquadId, frame), [built, sig, frame]);
  const overlaySig = JSON.stringify(overlays ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const overlayItems = useMemo(() => placeOverlays(built, overlays ?? [], frame, layout.obstacles), [built, overlaySig, frame, layout]);
  const keyUse = useMemo(() => materialsInUse(loc, walls.runs), [loc, walls]);
  const stagingPoints = built.derived.stagingPoints ?? [];

  const viewById = useMemo(() => new Map(spaces.map((s) => [s.id, s])), [spaces]);
  const { view, zoom, zoomBy, reset, zoomToRect, panTo } = useViewport(base);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragged = useRef(false);
  const lastTap = useRef<{ id: Id; t: number } | null>(null);

  const changed = useMemo(() => new Set(lastChange?.spaceIds ?? []), [lastChange]);
  const revision = lastChange?.revision ?? 0;
  const highlight = useMemo(() => new Set(highlightSpaceIds ?? []), [highlightSpaceIds]);

  const polys = useMemo(() => {
    const out: { id: Id; poly: Vec[]; zone: boolean; type: string }[] = [];
    for (const z of loc.zones) out.push({ id: z.id, poly: z.polygon, zone: true, type: z.kind });
    for (const r of loc.rooms) out.push({ id: r.id, poly: r.polygon, zone: false, type: r.type });
    return out;
  }, [loc]);

  const floorObjects = useMemo(() => loc.objects.filter((o) => isFloorLayer(o.type)), [loc]);
  const upperObjects = useMemo(() => loc.objects.filter((o) => !isFloorLayer(o.type)), [loc]);

  // ------------------------------------------------------------ pan (only while zoomed)
  const onPointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (zoom < 1.05 || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const svg = svgRef.current;
      if (!svg) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const v0 = view;
      const perPx = v0.w / svg.clientWidth;
      dragged.current = false;
      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!dragged.current && Math.hypot(dx, dy) < DRAG_SLOP_PX) return;
        dragged.current = true;
        panTo(v0.x - dx * perPx, v0.y - dy * perPx);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        // let the click that follows a drag see the flag, then clear it
        window.setTimeout(() => {
          dragged.current = false;
        }, 0);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    },
    [zoom, view, panTo],
  );

  const choose = useCallback(
    (spaceId: Id, poly: Vec[]) => {
      if (dragged.current) return;
      onSelectSpace?.(spaceId);
      const now = performance.now();
      const prev = lastTap.current;
      if (prev && prev.id === spaceId && now - prev.t < DOUBLE_TAP_MS) {
        lastTap.current = null;
        if (zoom > 1.5) reset();
        else zoomToRect(bboxOf(poly));
      } else lastTap.current = { id: spaceId, t: now };
    },
    [onSelectSpace, zoom, reset, zoomToRect],
  );

  const ariaFor = (spaceId: Id): string => {
    const v = viewById.get(spaceId);
    const d = built.derived.spaces[spaceId];
    const label = v?.label ?? 'Unlabelled space';
    const parts = [label, v ? statusWord(v.status) : 'No report'];
    if (d) parts.push(`${Math.round(d.area)} square feet`);
    if (v?.squadsHere.length) parts.push(`Squad ${v.squadsHere.join(', ')} here`);
    if (v?.marker) parts.push(v.marker.subtext ? `${v.marker.text} ${v.marker.subtext}` : v.marker.text);
    for (const p of v?.people ?? []) {
      if (p.status === 'reported') parts.push('reported person, position approximate');
      else if (p.status === 'confirmed') parts.push(`${p.label} confirmed`);
      else if (p.status === 'disproved') parts.push('checked and clear');
    }
    return parts.join(', ');
  };

  const sheetCls = `bp-root ${zoom > 1.05 ? 'bp-zoomed' : ''} ${className ?? ''}`;
  const vbStr = `${r2(view.x)} ${r2(view.y)} ${r2(view.w)} ${r2(view.h)}`;
  const north = { x: frame.x + frame.w + 0.4, y: frame.y - 0.8 };

  return (
    <div className={sheetCls} style={{ aspectRatio: `${base.w} / ${base.h}` }}>
      <svg ref={svgRef} className="bp-svg" viewBox={vbStr} role="group" aria-label={`Floor plan of ${loc.name}`} onPointerDown={onPointerDown} preserveAspectRatio="xMidYMid meet">
        <PaperDefs uid={uid} vb={base} />
        <defs>
          <WallPatternDefs uid={uid} runs={walls.runs} />
        </defs>
        <mask id={id.wallMask} maskUnits="userSpaceOnUse" x={base.x} y={base.y} width={base.w} height={base.h}>
          <rect x={base.x} y={base.y} width={base.w} height={base.h} fill="#fff" />
          {walls.cuts.map((c, i) => (
            <polygon key={i} points={c} fill="#000" />
          ))}
        </mask>

        <PaperBack uid={uid} vb={base} />

        {/* property line */}
        <rect x={0} y={0} width={loc.bounds.w} height={loc.bounds.h} className="bp-lot" />

        {/* exterior zones */}
        <g className="bp-zones" aria-hidden="true">
          {polys
            .filter((p) => p.zone)
            .map((p) => (
              <g key={p.id}>
                <path d={polyPath(p.poly)} className={`bp-zone bp-zone-${p.type}`} />
                {p.type === 'porch' && <path d={polyPath(p.poly)} fill={`url(#${id.planks})`} stroke="none" />}
              </g>
            ))}
        </g>

        {/* room floors */}
        <g className="bp-floors" aria-hidden="true">
          {polys
            .filter((p) => !p.zone)
            .map((p) => (
              <g key={p.id}>
                <path d={polyPath(p.poly)} className="bp-floor" />
                {p.type === 'bathroom' && <path d={polyPath(p.poly)} fill={`url(#${id.tile})`} stroke="none" />}
                {p.type === 'kitchen' && <path d={polyPath(p.poly)} fill={`url(#${id.tileBig})`} stroke="none" />}
              </g>
            ))}
        </g>

        <g className="bp-furniture" aria-hidden="true">
          {floorObjects.map((o) => (
            <ObjectSymbol key={o.id} o={o} loc={loc} uid={uid} />
          ))}
          {upperObjects.map((o) => (
            <ObjectSymbol key={o.id} o={o} loc={loc} uid={uid} />
          ))}
          <ObjectLabels objects={upperObjects} />
        </g>

        {/* walls: thick hatched bands, openings cut out */}
        <g className="bp-walls" mask={`url(#${id.wallMask})`} aria-hidden="true">
          <path d={walls.extPath} className="bp-wall-casing" strokeWidth={walls.extT + 0.32} strokeLinejoin="miter" />
          <path d={walls.intPath} className="bp-wall-casing" strokeWidth={walls.intT + 0.32} strokeLinecap="square" />
          <path d={walls.extPath} className="bp-wall-fill" strokeWidth={walls.extT} strokeLinejoin="miter" />
          <path d={walls.intPath} className="bp-wall-fill" strokeWidth={walls.intT} strokeLinecap="square" />
          <WallMaterialRuns uid={uid} runs={walls.runs} />
        </g>
        <OpeningsLayer openings={walls.openings} />

        {/* every staging point, faint, only once the player has zoomed in */}
        {zoom >= 2 && stagingPoints.length > 0 && (
          <g className="bp-staging" pointerEvents="none" aria-hidden="true">
            {stagingPoints.map((sp) => (
              <circle key={sp.id} cx={r2(sp.at.x)} cy={r2(sp.at.y)} r="0.34" className="bp-staging-dot" />
            ))}
          </g>
        )}

        {/* the selected action's spatial explanation: above rooms, below labels */}
        <OverlayLayer key={overlaySig} items={overlayItems} uid={uid} frame={frame} />

        {/* labels */}
        <g className="bp-labels" aria-hidden="true" pointerEvents="none">
          {layout.zoneLabels.map((l) => (
            <text key={l.id} x={r2(l.x)} y={r2(l.y)} textAnchor="middle" className="bp-zone-label" transform={l.rot ? `rotate(${l.rot} ${r2(l.x)} ${r2(l.y)})` : undefined}>
              {l.text}
            </text>
          ))}
          {layout.roomLabels.map((l) => (
            <text key={l.id} x={r2(l.x)} y={r2(l.y)} textAnchor="middle" className="bp-room-label">
              {l.text}
            </text>
          ))}
        </g>

        <DimensionLines dims={dims} />
        <NorthArrow x={north.x} y={north.y} />

        {layout.notes.map((n) => (
          <NoteMark key={n.id} n={n} />
        ))}

        {layout.front && <FrontMark f={layout.front} roughId={id.rough} />}

        {/* knowledge markers */}
        <g className="bp-markers">
          {layout.markers.map((m) => {
            const draw = changed.has(m.spaceId);
            return <MarkerLoop key={`${m.spaceId}:${draw ? revision : 0}`} m={m} draw={draw} />;
          })}
        </g>

        {layout.people.map((p) => (
          <PersonGlyph key={p.id} p={p} />
        ))}

        {layout.squads.map((s) => (
          <SquadToken key={s.squadId} s={s} />
        ))}

        {/* selection + highlight outlines */}
        <g className="bp-outlines" pointerEvents="none" aria-hidden="true">
          {polys
            .filter((p) => highlight.has(p.id))
            .map((p) => (
              <path key={`h-${p.id}`} d={polyPath(p.poly)} className="bp-highlight" />
            ))}
          {polys
            .filter((p) => p.id === selectedSpaceId)
            .map((p) => (
              <g key={`s-${p.id}`}>
                <path d={polyPath(p.poly)} className="bp-select-glow" filter={`url(#${id.glow})`} />
                <path d={polyPath(p.poly)} className="bp-select" />
              </g>
            ))}
        </g>

        <PaperFront uid={uid} vb={base} />

        {/* hit targets: zones first so rooms win where they overlap */}
        <g className="bp-hits">
          {polys.map((p) => (
            <path
              key={p.id}
              d={polyPath(p.poly)}
              className="bp-hit"
              role="button"
              tabIndex={0}
              aria-label={ariaFor(p.id)}
              aria-pressed={p.id === selectedSpaceId}
              onClick={() => choose(p.id, p.poly)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectSpace?.(p.id);
                }
              }}
            />
          ))}
        </g>
      </svg>

      {showMaterials && <MaterialLegend uid={uid} use={keyUse} />}

      <div className="bp-zoomctl" role="group" aria-label="Map zoom">
        <button type="button" className="bp-zbtn" aria-label="Zoom in" onClick={() => zoomBy(1.6)} disabled={zoom >= 3.95}>
          <span aria-hidden="true">+</span>
        </button>
        <button type="button" className="bp-zbtn" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.6)} disabled={zoom <= 1.01}>
          <span aria-hidden="true">{'−'}</span>
        </button>
        <button type="button" className="bp-zbtn" aria-label="Reset zoom" onClick={reset} disabled={zoom <= 1.01}>
          <span aria-hidden="true">{'⤢'}</span>
        </button>
      </div>
    </div>
  );
}
