// Visual QA entry point: /harness.html. Separate from normal game navigation.
import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/theme.css';
import { buildLocation } from './sim/location';
import type { BuiltLocation, Id, MapOverlay, PersonMark, SpaceView, SquadTask, Vec } from './sim/types';
import { Blueprint } from './ui/blueprint/Blueprint';
import { RoomList } from './ui/blueprint/RoomList';
import { Portrait } from './ui/portraits/Portrait';
import { PERSONAS } from './content/personas';
import { RESPONSIVE_PREVIEW_PARAM, RESPONSIVE_PREVIEW_SANDBOX } from './ui/save-environment';

/**
 * Staging point for an opening: from derived.stagingPoints when the spatial agent has landed them,
 * otherwise 1.6 ft out from the opening midpoint on the side of `spaceId` (graceful fallback).
 */
function stagingFor(built: BuiltLocation, openingId: Id, spaceId: Id): { id: Id | null; at: Vec } {
  const hit = (built.derived.stagingPoints ?? []).find((p) => p.openingId === openingId && p.spaceId === spaceId);
  if (hit) return { id: hit.id, at: hit.at };
  const o = built.location.openings.find((x) => x.id === openingId)!;
  const mid = { x: (o.from.x + o.to.x) / 2, y: (o.from.y + o.to.y) / 2 };
  const dx = o.to.x - o.from.x;
  const dy = o.to.y - o.from.y;
  const l = Math.hypot(dx, dy) || 1;
  const n = { x: -dy / l, y: dx / l };
  const room = built.location.rooms.find((r) => r.id === spaceId);
  const zone = built.location.zones.find((z) => z.id === spaceId);
  const poly = (room ?? zone)!.polygon;
  const inside = (p: Vec) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i];
      const b = poly[j];
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  };
  const probe = { x: mid.x + n.x * 1.6, y: mid.y + n.y * 1.6 };
  const sign = inside(probe) ? 1 : -1;
  return { id: null, at: { x: mid.x + n.x * 1.6 * sign, y: mid.y + n.y * 1.6 * sign } };
}

/** Player-knowledge views for the sample: every space known by name, several with annotations and people. */
function sampleSpaces(built: BuiltLocation, withPeople = true): SpaceView[] {
  const loc = built.location;
  const here: Record<Id, SpaceView['squadsHere']> = { porch: ['A'], side_yard_e: ['B'] };
  const people: Record<Id, PersonMark[]> = withPeople
    ? {
        // reported: approximate position, never a name
        kitchen: [{ id: 'p_kitchen', at: { x: 41, y: 22 }, label: 'Second person', status: 'reported' }],
        // confirmed: a position and a label
        living: [{ id: 'p_living', at: { x: 14, y: 25.5 }, label: 'Resident', status: 'confirmed' }],
        // disproved: checked and empty
        bedroom_w: [{ id: 'p_bedw', at: { x: 14, y: 11 }, label: 'Nobody', status: 'disproved' }],
      }
    : {};
  return [...loc.rooms.map((r) => ({ id: r.id, label: r.label })), ...loc.zones.map((z) => ({ id: z.id, label: z.label }))].map(({ id, label }) => {
    const base: SpaceView = { id, label, status: 'none', marker: null, squadsHere: here[id] ?? [], facts: [], people: people[id] ?? [], actionIds: [] };
    if (id === 'bedroom_e') return { ...base, status: 'unknown', marker: { text: 'UNKNOWN', tone: 'amber' } };
    if (id === 'kitchen') return { ...base, status: 'reported', marker: { text: 'MOVEMENT?', tone: 'amber', subtext: 'per neighbour' } };
    if (id === 'living') return { ...base, status: 'confirmed', marker: { text: 'CLEAR', tone: 'mint' } };
    return base;
  });
}

function sampleTasks(built: BuiltLocation): SquadTask[] {
  const a = stagingFor(built, 'd_front', 'porch');
  const b = stagingFor(built, 'd_back', 'side_yard_e');
  return [
    { squadId: 'A', positionId: 'porch', task: 'Front door', stagingId: a.id, at: a.at },
    { squadId: 'B', positionId: 'side_yard_e', task: 'Back door', stagingId: b.id, at: b.at },
  ];
}

type OverlayMode = 'none' | 'blocked' | 'clear' | 'range' | 'path' | 'all';

function sampleOverlays(built: BuiltLocation, mode: OverlayMode): MapOverlay[] {
  const b = stagingFor(built, 'd_back', 'side_yard_e').at;
  const a = stagingFor(built, 'd_front', 'porch').at;
  const blocked: MapOverlay = { kind: 'line', from: { x: 22, y: 17.6 }, to: { x: 35, y: 13.4 }, tone: 'blocked', label: 'Wall blocks sight' };
  const clear: MapOverlay = { kind: 'line', from: { x: 22, y: 16.4 }, to: { x: 16.5, y: 25 }, tone: 'clear', label: 'Hall door open' };
  const partial: MapOverlay = { kind: 'line', from: b, to: { x: 36, y: 21 }, tone: 'partial', label: 'Through glass door' };
  const ranges: MapOverlay[] = [
    { kind: 'range', at: b, radius: 14, tone: 'effective', label: 'Hailer' },
    { kind: 'range', at: b, radius: 26, tone: 'max', label: 'max' },
  ];
  const path: MapOverlay = { kind: 'path', points: [a, { x: 30, y: 34.6 }, { x: 44, y: 33.4 }, { x: b.x, y: b.y + 2.5 }], label: 'Move to back door' };
  switch (mode) {
    case 'blocked':
      return [blocked];
    case 'clear':
      return [clear];
    case 'range':
      return ranges;
    case 'path':
      return [path];
    case 'all':
      return [blocked, clear, partial, ...ranges, path];
    default:
      return [];
  }
}

function Column({ title, width, seed, materials = false, overlay = 'none' }: { title: string; width: number; seed: number; materials?: boolean; overlay?: OverlayMode }) {
  const built = useMemo(() => {
    const b = buildLocation('maple_street', seed);
    // ?door=blocked|locked|open|closed overrides the back door state to eyeball each glyph
    const state = new URLSearchParams(window.location.search).get('door');
    if (state) {
      const o = b.location.openings.find((x) => x.id === 'd_back');
      if (o) o.state = state as typeof o.state;
    }
    // ?nostaging=1 empties derived.stagingPoints to prove the renderer falls back to opening midpoints
    if (new URLSearchParams(window.location.search).get('nostaging')) b.derived.stagingPoints = [];
    // ?variety=1 swaps in every material so each pattern, door leaf and glazing can be eyeballed together
    if (new URLSearchParams(window.location.search).get('variety')) {
      const L = b.location;
      L.materials = { exterior: 'brick', interior: 'wood_frame', overrides: [{ a: 'bath', b: 'bedroom_e', material: 'plaster' }, { a: 'hall', b: 'living', material: 'concrete' }, { a: 'living', b: 'kitchen', material: 'drywall' }, { a: 'bedroom_w', b: 'side_yard_w', material: 'concrete' }] };
      const set = (id: string, patch: Partial<(typeof L.openings)[number]>) => Object.assign(L.openings.find((x) => x.id === id) ?? {}, patch);
      set('d_hall_bath', { material: 'steel' });
      set('d_hall_bedw', { material: 'glass', state: 'open' });
      set('d_hall_bede', { material: 'solid_core' });
      set('w_bath_n', { glazing: 'security' });
      set('w_kitchen_e', { glazing: 'single', covering: 'blinds' });
      set('w_bedw_n', { glazing: 'single', covering: 'curtains' });
    }
    return b;
  }, [seed]);
  const spaces = useMemo(() => sampleSpaces(built), [built]);
  const tasks = useMemo(() => {
    const t = sampleTasks(built);
    // ?noat=1 drops the exact standing points to exercise the room-centroid fallback
    return new URLSearchParams(window.location.search).get('noat') ? t.map((x) => ({ ...x, at: null, stagingId: null })) : t;
  }, [built]);
  const [selected, setSelected] = useState<Id | null>('living');
  const [rev, setRev] = useState(0);
  const [mat, setMat] = useState(materials);
  const [ov, setOv] = useState<OverlayMode>(overlay);
  const overlays = useMemo(() => sampleOverlays(built, ov), [built, ov]);
  return (
    <section style={{ width }} className="h-col">
      <h2>{title}</h2>
      <Blueprint
        built={built}
        spaces={spaces}
        squadTasks={tasks}
        selectedSpaceId={selected}
        focusSquadId="A"
        highlightSpaceIds={['hall']}
        onSelectSpace={setSelected}
        lastChange={rev ? { revision: rev, spaceIds: ['bedroom_e'] } : null}
        overlays={overlays}
        showMaterials={mat}
      />
      <div className="h-ctl">
        <button type="button" className="h-btn" aria-pressed={mat} onClick={() => setMat((m) => !m)}>
          Materials
        </button>
        {(['none', 'blocked', 'clear', 'range', 'path', 'all'] as OverlayMode[]).map((m) => (
          <button key={m} type="button" className="h-btn" aria-pressed={ov === m} onClick={() => setOv(m)}>
            {m}
          </button>
        ))}
      </div>
      <button type="button" className="h-btn" onClick={() => setRev((r) => r + 1)}>
        Replay marker draw-in (bedroom_e)
      </button>
      <p className="h-note">
        Seed {seed}: wall issues {built.issues.length}. Selected: {selected ?? 'none'}. Staging points in derived: {(built.derived.stagingPoints ?? []).length}
      </p>
    </section>
  );
}

function PortraitGrid() {
  const count = Number(new URLSearchParams(window.location.search).get('n') ?? 24);
  return (
    <section className="h-col" style={{ width: 358 }}>
      <h2>Personnel files · authored identities</h2>
      <p>File portraits stay attached to the same person. Missing photographs use a personnel-file card.</p>
      <div className="h-grid">
        {PERSONAS.slice(0, count).map((p) => (
          <figure key={p.id} className="h-fig">
            <Portrait officer={{ ...p, identityId: p.id, role: 'lead' }} size={80} age={p.ageAtStart} />
            <figcaption>{p.firstName} {p.surname}<br />{Math.floor(p.ageAtStart)} at introduction</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

const DEVICE_SIZES = [
  { label: 'Small phone', width: 320, height: 568 },
  { label: 'Phone', width: 375, height: 667 },
  { label: 'Design phone', width: 390, height: 844 },
  { label: 'Large phone', width: 430, height: 932 },
  { label: 'Tablet', width: 768, height: 1024 },
  { label: 'Desktop', width: 1280, height: 800 },
] as const;

function dimension(value: string | null, fallback: number, min: number, max: number) {
  const n = Number(value);
  return value !== null && Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
}

/** A real child viewport; constraining a div would not exercise viewport media queries. */
function ResponsiveGame() {
  const q = new URLSearchParams(window.location.search);
  // A new disposable session must read the current entry HTML after deployment.
  // Keep its URL stable while resizing so the in-memory campaign is preserved.
  const [previewUrl] = useState(() => `${import.meta.env.BASE_URL}?${RESPONSIVE_PREVIEW_PARAM}=1&preview-load=${Date.now().toString(36)}`);
  const [size, setSize] = useState({
    width: dimension(q.get('w'), 390, 240, 1920),
    height: dimension(q.get('h'), 844, 320, 1440),
  });
  return (
    <div className="h-page h-responsive">
      <h1>Game viewport · {size.width} × {size.height}</h1>
      <p className="h-note">The frame runs the real app with ten temporary in-memory save slots. Its sandbox blocks access to normal browser saves; closing or reloading it discards every test slot. Changing size keeps that campaign.</p>
      <div className="h-ctl" role="group" aria-label="Test viewport">
        {DEVICE_SIZES.map((device) => (
          <button key={device.width} type="button" className="h-btn" aria-pressed={size.width === device.width && size.height === device.height} onClick={() => setSize(device)}>
            {device.label} · {device.width} × {device.height}
          </button>
        ))}
      </div>
      <p className="h-note">Check all five tabs, squad rename, officer and gear sheets, saves, preparation, live action details, Rooms, Materials and zoom. Wider frames can be panned in the inspection area below. No result here implies those checks passed.</p>
      <div className="h-viewport-scroll">
        <iframe
          title={`Tactically Idle test viewport ${size.width} by ${size.height}`}
          src={previewUrl}
          sandbox={RESPONSIVE_PREVIEW_SANDBOX}
          width={size.width}
          height={size.height}
          className="h-game-frame"
        />
      </div>
      <p className="h-note">A blank frame means this host may block module loads from the sandbox’s opaque origin. Check its console and CORS response before treating the harness as usable. Keep the storage sandbox intact.</p>
    </div>
  );
}

function Harness() {
  const built = useMemo(() => buildLocation('maple_street', 0), []);
  const spaces = useMemo(() => sampleSpaces(built), [built]);
  const [sel, setSel] = useState<Id | null>(null);
  // ?only=map&w=760&seed=0 shows one large map; ?only=portraits shows just the portrait grid.
  const q = new URLSearchParams(window.location.search);
  const only = q.get('only');
  if (only === 'app') return <ResponsiveGame />;
  if (only === 'map') {
    const w = Number(q.get('w') ?? 760);
    return (
      <div className="h-page">
        <Column title={`Maple Street at ${w} px`} width={w} seed={Number(q.get('seed') ?? 0)} materials={q.get('materials') === '1'} overlay={(q.get('ov') ?? 'none') as OverlayMode} />
      </div>
    );
  }
  if (only === 'portraits') {
    return (
      <div className="h-page">
        <PortraitGrid />
      </div>
    );
  }
  return (
    <div className="h-page">
      <h1>Blueprint harness</h1>
      <div className="h-row">
        <Column title="Maple Street, seed 0, 358 px (overlays)" width={358} seed={0} overlay="all" />
        <Column title="Maple Street, seed 7, 358 px (materials key)" width={358} seed={7} materials />
        <Column title="Maple Street, seed 0, 288 px" width={288} seed={0} materials overlay="blocked" />
        <section className="h-col" style={{ width: 358 }}>
          <h2>RoomList (text alternative)</h2>
          <RoomList spaces={spaces} built={built} selectedSpaceId={sel} onSelectSpace={setSel} />
        </section>
        <PortraitGrid />
      </div>
    </div>
  );
}

const css = `
.h-page { padding: 16px; min-height: 100%; background: var(--bg); }
.h-page h1 { font-family: var(--font-display); font-size: 22px; margin: 0 0 12px; }
.h-row { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; }
.h-col h2 { font-family: var(--font-cond); font-size: 14px; letter-spacing: .08em; text-transform: uppercase; color: var(--text-dim); margin: 0 0 8px; }
.h-note { font: 12px var(--font-ui); color: var(--muted); margin: 6px 0 0; }
.h-btn { margin-top: 8px; min-height: 44px; padding: 0 12px; background: var(--panel-2); border: 1px solid var(--line-strong); border-radius: 8px; color: var(--text); }
.h-btn[aria-pressed='true'] { border-color: var(--amber); }
.h-ctl { display: flex; flex-wrap: wrap; gap: 6px; }
.h-grid { display: grid; grid-template-columns: repeat(4, 80px); gap: 14px 10px; margin-bottom: 14px; }
.h-big { display: flex; flex-wrap: wrap; gap: 12px; width: 760px; }
.h-fig { margin: 0; font: 11px var(--font-ui); color: var(--muted); text-align: center; }
.h-fig figcaption { margin-top: 3px; }
.h-responsive { min-width: 0; }
.h-responsive > .h-note { max-width: 760px; line-height: 1.5; }
.h-viewport-scroll { max-width: 100%; margin-top: 16px; overflow: auto; border: 1px solid var(--line); }
.h-game-frame { display: block; border: 0; max-width: none; }
`;

const host = document.getElementById('root')! as HTMLElement & { __root?: ReturnType<typeof createRoot> };
host.__root ??= createRoot(host);
host.__root.render(
  <StrictMode>
    <style>{css}</style>
    <Harness />
  </StrictMode>,
);
