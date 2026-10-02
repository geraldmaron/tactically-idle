// Material drawing: wall hatch patterns per WallMaterial, the wall-material layer, and the "MATERIALS" key.
// Everything is read from LocationDefinition (and the wall model derived from it), so the key cannot list a
// material the plan does not use and the plan cannot show one the rules do not know about.
import type { DoorMaterial, Glazing, LocationDefinition, Opening, WallMaterial, WindowCovering } from '../../sim/types';
import { COVERINGS, DOORS, GLAZING, WALLS } from '../../content/materials';
import { add, r2 } from './geometry';
import { LEAF_T, LeafMarks, WindowSymbol, coveringPath } from './openings';
import type { OpeningGeom, WallRun } from './walls';

export const wallPatternId = (uid: string, material: WallMaterial, angle: number) => `${uid}-wm-${material}-${angle}`;

/** Materials that are drawn with a tiled hatch; the others read as a plain (double-line) wall. */
const PATTERNED: WallMaterial[] = ['brick', 'wood_frame', 'concrete'];

const STROKE = 'var(--chalk)';

function PatternFor({ id, material, angle }: { id: string; material: WallMaterial; angle: number }) {
  const rot = angle ? `rotate(${angle})` : undefined;
  if (material === 'brick') {
    // running bond: two courses per tile, head joints staggered by half a brick
    return (
      <pattern id={id} width="0.9" height="0.78" patternUnits="userSpaceOnUse" patternTransform={rot}>
        <path d="M0 0H0.9M0 0.39H0.9M0.45 0V0.39M0 0.39V0.78M0.9 0.39V0.78" stroke={STROKE} strokeWidth="0.075" strokeOpacity="0.95" fill="none" />
      </pattern>
    );
  }
  if (material === 'wood_frame') {
    // studs at roughly 16 in on centre
    return (
      <pattern id={id} width="1.33" height="1" patternUnits="userSpaceOnUse" patternTransform={rot}>
        <path d="M0.665 -0.1V1.1" stroke={STROKE} strokeWidth="0.15" strokeOpacity="1" fill="none" />
      </pattern>
    );
  }
  return (
    <pattern id={id} width="0.7" height="0.7" patternUnits="userSpaceOnUse" patternTransform={rot}>
      {[
        [0.12, 0.14, 0.085],
        [0.46, 0.07, 0.07],
        [0.6, 0.4, 0.085],
        [0.27, 0.48, 0.07],
        [0.5, 0.64, 0.07],
        [0.07, 0.66, 0.085],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={STROKE} fillOpacity="0.95" />
      ))}
    </pattern>
  );
}

/** One pattern per (patterned material, wall direction) that actually occurs. */
export function WallPatternDefs({ uid, runs }: { uid: string; runs: WallRun[] }) {
  const seen = new Set<string>();
  const out: { id: string; material: WallMaterial; angle: number }[] = [];
  for (const r of runs) {
    if (!PATTERNED.includes(r.material)) continue;
    const id = wallPatternId(uid, r.material, r.angle);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, material: r.material, angle: r.angle });
  }
  return (
    <>
      {out.map((p) => (
        <PatternFor key={p.id} {...p} />
      ))}
    </>
  );
}

/** Hatch / core-line overlay per material run. Drawn inside the masked wall group, over the casing and fill. */
export function WallMaterialRuns({ uid, runs }: { uid: string; runs: WallRun[] }) {
  return (
    <>
      {runs.map((r) => {
        const key = `${r.material}|${r.kind}|${r.angle}`;
        if (PATTERNED.includes(r.material)) {
          return <path key={key} d={r.path} stroke={`url(#${wallPatternId(uid, r.material, r.angle)})`} className={`bp-wall-hatch bp-wall-${r.material}`} strokeWidth={r.thickness} strokeLinecap={r.kind === 'ext' ? 'square' : 'butt'} data-material={r.material} />;
        }
        if (r.material === 'plaster') return <path key={key} d={r.path} className="bp-wall-core bp-wall-plaster" strokeLinecap="butt" data-material={r.material} />;
        if (r.material === 'glass_partition') {
          return (
            <g key={key} data-material={r.material}>
              <path d={r.path} className="bp-wall-glassfill" strokeWidth={r.thickness * 0.55} strokeLinecap="butt" />
              <path d={r.path} className="bp-wall-core" strokeLinecap="butt" />
            </g>
          );
        }
        return null; // drywall: the double line of the casing is the drawing
      })}
    </>
  );
}

// ------------------------------------------------------------------ key (legend)

const WALL_ORDER: WallMaterial[] = ['brick', 'wood_frame', 'concrete', 'drywall', 'plaster', 'glass_partition'];
const DOOR_ORDER: DoorMaterial[] = ['hollow_core', 'solid_core', 'steel', 'glass'];
const GLAZING_ORDER: Glazing[] = ['single', 'double', 'security'];
const COVER_ORDER: WindowCovering[] = ['blinds', 'curtains'];

export interface KeyUse {
  walls: WallMaterial[];
  doors: DoorMaterial[];
  glazing: Glazing[];
  coverings: WindowCovering[];
}

/** Which materials the plan actually shows. */
export function materialsInUse(loc: LocationDefinition, runs: WallRun[]): KeyUse {
  const walls = new Set(runs.map((r) => r.material));
  const doors = new Set<DoorMaterial>();
  const glazing = new Set<Glazing>();
  const cover = new Set<WindowCovering>();
  for (const o of loc.openings) {
    if (o.type === 'door') doors.add(o.material ?? 'hollow_core');
    if (o.type === 'window') {
      glazing.add(o.glazing ?? 'double');
      if (o.covering && o.covering !== 'none') cover.add(o.covering);
    }
  }
  return {
    walls: WALL_ORDER.filter((m) => walls.has(m)),
    doors: DOOR_ORDER.filter((m) => doors.has(m)),
    glazing: GLAZING_ORDER.filter((m) => glazing.has(m)),
    coverings: COVER_ORDER.filter((m) => cover.has(m)),
  };
}

const V = { x: 0, y: 1 };

function WallSwatch({ uid, material }: { uid: string; material: WallMaterial }) {
  const T = 0.8;
  const run: WallRun = { material, kind: 'int', angle: 0, thickness: T, path: 'M0 1.1H6' };
  return (
    <svg className="bp-swatch" viewBox="0 0 6 2.2" width="34" height="12.5" aria-hidden="true" focusable="false">
      <defs>
        <WallPatternDefs uid={`${uid}-sw`} runs={[run]} />
      </defs>
      <path d={run.path} className="bp-wall-casing" strokeWidth={T + 0.32} />
      <path d={run.path} className="bp-wall-fill" strokeWidth={T} />
      <WallMaterialRuns uid={`${uid}-sw`} runs={[run]} />
    </svg>
  );
}

function fakeGeom(o: Partial<Opening>, y: number): OpeningGeom {
  const from = { x: 0.5, y };
  const to = { x: 5.5, y };
  return {
    o: { id: 'k', type: 'window', a: 'a', b: 'b', from, to, state: 'closed', ...o } as Opening,
    from,
    to,
    center: { x: 3, y },
    dir: { x: 1, y: 0 },
    width: 5,
    exterior: true,
    thickness: 0.9,
    swingNormal: null,
    interiorNormal: V,
    hinge: null,
    free: null,
  };
}

function WindowSwatch({ glazing, covering }: { glazing: Glazing; covering?: WindowCovering }) {
  const g = fakeGeom({ type: 'window', glazing, covering: covering ?? 'none' }, 0.9);
  return (
    <svg className="bp-swatch" viewBox="0 0 6 2.2" width="34" height="12.5" aria-hidden="true" focusable="false">
      <WindowSymbol g={g} />
    </svg>
  );
}

function CoveringSwatch({ covering }: { covering: WindowCovering }) {
  const g = fakeGeom({ type: 'window', glazing: 'double', covering }, 0.7);
  const d = coveringPath(g.from, g.to, g.dir, V, 0.85, covering);
  return (
    <svg className="bp-swatch" viewBox="0 0 6 2.2" width="34" height="12.5" aria-hidden="true" focusable="false">
      <path d={`M0.5 0.25H5.5M0.5 1.15H5.5`} className="bp-win-face" />
      {d && <path d={d} className="bp-win-cover" transform="translate(0 0.2)" />}
    </svg>
  );
}

function DoorSwatch({ material }: { material: DoorMaterial }) {
  const T = LEAF_T[material];
  const hinge = { x: 0.5, y: 0.7 };
  const tip = { x: 5.5, y: 0.7 };
  const p = (v: { x: number; y: number }) => `${r2(v.x)} ${r2(v.y)}`;
  return (
    <svg className="bp-swatch" viewBox="0 0 6 2.2" width="34" height="12.5" aria-hidden="true" focusable="false">
      <path d={`M0.5 0.1V1.3M5.5 0.1V1.3`} className="bp-jamb" />
      <path d={`M${p(hinge)}L${p(tip)}L${p(add(tip, { x: 0, y: T }))}L${p(add(hinge, { x: 0, y: T }))}Z`} className={`bp-door-leaf bp-leaf-${material}`} />
      <LeafMarks hinge={hinge} tip={tip} side={V} leafT={T} material={material} />
    </svg>
  );
}

function Row({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <li className="bp-key-row">
      {swatch}
      <span className="bp-key-label">{label}</span>
    </li>
  );
}

export function MaterialLegend({ uid, use }: { uid: string; use: KeyUse }) {
  return (
    <div className="bp-key" role="group" aria-label="Materials key">
      <p className="bp-key-title">Materials</p>
      <ul className="bp-key-list">
        {use.walls.map((m) => (
          <Row key={m} swatch={<WallSwatch uid={uid} material={m} />} label={WALLS[m].label} />
        ))}
        {use.doors.map((m) => (
          <Row key={m} swatch={<DoorSwatch material={m} />} label={DOORS[m].label} />
        ))}
        {use.glazing.map((m) => (
          <Row key={m} swatch={<WindowSwatch glazing={m} />} label={GLAZING[m].label} />
        ))}
        {use.coverings.map((m) => (
          <Row key={m} swatch={<CoveringSwatch covering={m} />} label={COVERINGS[m].label} />
        ))}
      </ul>
    </div>
  );
}
