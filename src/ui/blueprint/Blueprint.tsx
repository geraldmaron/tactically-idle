// The operations blueprint. Drawn entirely from built.location / built.derived plus the player's
// SpaceViews; nothing here is a bitmap of the house, so the drawing cannot drift from the rules.
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import type { EnvironmentDefinition } from '../../sim/scenario-types';
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
import { personDescription, statusWord } from './RoomList';
import { useViewport } from './useViewport';
import { useBlueprintNavigation } from './useBlueprintNavigation';
import { floorBadges, floorCount, floorGeometry, floorKnowledge, floorWord } from './floors';
import { FloorTabs } from './FloorTabs';
import { StairGhosts, StairLayer } from './stairs';
import { PlanLabel } from './labels';

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
  /** Floor shown (0 ground, 1 upper) when the location has two floors. Controlled when given; otherwise the map keeps its own. */
  floor?: number;
  onFloorChange?: (floor: number) => void;
  /** Conditions drawn on the sheet: dusk/night wash, weather hatch outside, crowd, and a row of chips. */
  environment?: EnvironmentDefinition;
  /** Pixels from the map's top edge where the chips / floor tabs row starts: the live screen's clock and pressure pills sit above it. */
  stripTop?: number;
}


const DOUBLE_TAP_MS = 380;

export function Blueprint({ built: allBuilt, spaces: allSpaces, squadTasks: allSquadTasks, selectedSpaceId, focusSquadId, highlightSpaceIds, onSelectSpace, lastChange, overlays: allOverlays, showMaterials, className, floor: controlledFloor, onFloorChange }: BlueprintProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [localFloor, setLocalFloor] = useState({ location: allBuilt.location.id, floor: 0 });
  const count = floorCount(allBuilt.location);
  const floor = Math.min(count - 1, Math.max(0, controlledFloor ?? (localFloor.location === allBuilt.location.id ? localFloor.floor : 0)));
  const { built, plan } = useMemo(() => floorGeometry(allBuilt, floor), [allBuilt, floor]);
  const { spaces, squadTasks, overlays } = useMemo(
    () => floorKnowledge(allBuilt.location, allSpaces, allSquadTasks, allOverlays ?? [], floor),
    [allBuilt.location, allSpaces, allSquadTasks, allOverlays, floor],
  );
  const loc = built.location;
  const badges = floorBadges(allBuilt.location, allSpaces);
  const changeFloor = (next: number) => {
    setLocalFloor({ location: allBuilt.location.id, floor: next });
    onFloorChange?.(next);
  };
  const id = ids(uid);

  // Layout depends on what the player knows; key it on the fields it reads so store churn does not re-run the search.
  const sig = JSON.stringify([
    spaces.map((s) => [s.id, s.label, s.marker?.text ?? null, s.marker?.tone ?? null, s.marker?.subtext ?? null, (s.people ?? []).map((p) => [p.id, p.at, p.status, p.label, p.kind, p.armament, p.carried, p.condition])]),
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
  const sceneKey = `${allBuilt.location.id}:${floor}`;
  const camera = useViewport(base, sceneKey);
  const { view, zoom, zoomBy, reset, zoomToRect } = camera;
  const svgRef = useRef<SVGSVGElement>(null);
  const lastTap = useRef<{ id: Id; t: number } | null>(null);
  useBlueprintNavigation(svgRef, camera, `${sceneKey}:${base.x},${base.y},${base.w},${base.h}`, () => { lastTap.current = null; });

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

  const choose = useCallback(
    (spaceId: Id, poly: Vec[]) => {
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
      const description = personDescription(p);
      if (description) parts.push(description);
    }
    return parts.join(', ');
  };

  const sheetCls = `bp-root ${count > 1 ? 'bp-multifloor' : ''} ${zoom > 1.05 ? 'bp-zoomed' : ''} ${className ?? ''}`;
  const vbStr = `${view.x} ${view.y} ${view.w} ${view.h}`;
  const north = { x: frame.x + frame.w + 0.4, y: frame.y - 0.8 };

  return (
    <div className={sheetCls} style={{ aspectRatio: `${base.w} / ${base.h}` }}>
      <div className="bp-canvas">
        <svg ref={svgRef} className="bp-svg" viewBox={vbStr} role="group" tabIndex={0} aria-label={`Floor plan of ${loc.name}${count > 1 ? `, ${floorWord(floor).toLowerCase()}` : ''}`} aria-describedby={`${uid}-navigation-help`} aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home" data-floor={floor} preserveAspectRatio="xMidYMid meet">
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

          <StairGhosts polys={plan.ghostStairs} outline={plan.ghostOutline} />

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
          <StairLayer stairs={plan.stairs} />

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
            {layout.zoneLabels.map((l) => <PlanLabel key={l.id} label={l} kind="zone" />)}
            {layout.roomLabels.map((l) => <PlanLabel key={l.id} label={l} kind="room" />)}
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
      </div>

      {count > 1 && <div className="bp-floor-controls"><FloorTabs floors={count} floor={floor} badges={badges} onChange={changeFloor} /></div>}

      {showMaterials && <MaterialLegend uid={uid} use={keyUse} />}

      <p className="bp-nav-help" id={`${uid}-navigation-help`}>Tap a room to inspect · Drag to pan · Pinch to zoom<span className="bp-sr-only">. Keyboard: + and − to zoom, arrow keys to pan, Home to fit the map. Tab to a room and press Enter to inspect its people and carried items. Use the Rooms list for a text alternative. Scroll to zoom. Double-tap a room to zoom in or fit the map.</span></p>

      <div className="bp-zoomctl" role="group" aria-label="Map zoom">
        <button type="button" className="bp-zbtn" aria-label="Zoom in" title="Zoom in (+)" onClick={() => { lastTap.current = null; zoomBy(1.6); }} disabled={zoom >= 3.95}>
          <span aria-hidden="true">+</span>
        </button>
        <button type="button" className="bp-zbtn" aria-label="Zoom out" title="Zoom out (−)" onClick={() => { lastTap.current = null; zoomBy(1 / 1.6); }} disabled={zoom <= 1.01}>
          <span aria-hidden="true">{'−'}</span>
        </button>
        <button type="button" className="bp-zbtn" aria-label="Fit map" title="Fit map (Home)" onClick={() => { lastTap.current = null; reset(); }} disabled={zoom <= 1.01}>
          <span aria-hidden="true">{'⤢'}</span>
        </button>
      </div>
    </div>
  );
}
