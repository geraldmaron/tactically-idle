// Visual QA entry point: /locations.html. A contact sheet of real Blueprint drawings for one
// building family across many seeds, so generated plans can be reviewed side by side with the
// authored ones. Dev-only page; not linked from the game and not part of the app entry.
//
//   /locations.html?family=bungalow_g1&seeds=1-24&floor=0
//   optional: &w=360 (cell width px), &furnished=0 (bare plan), &seeds=3,9,12, &chrome=1 (keep map hint + zoom buttons)
import { StrictMode, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import '../ui/theme.css';
import './location-sheet.css';
import { buildLocation } from '../sim/location';
import type { BuiltLocation, Id, SpaceView } from '../sim/types';
import { Blueprint } from '../ui/blueprint/Blueprint';
import { BUILDING_FAMILIES, PROCEDURAL_FAMILIES, furnishedFamilyIdV7 } from '../gen/building';
import { plausibilityReport } from '../gen/building/procedural';

const AUTHORED = [{ id: 'maple_street', label: 'Maple Street' }, ...BUILDING_FAMILIES];
const PROCEDURAL_IDS = new Set(PROCEDURAL_FAMILIES.map((f) => f.id));

export interface SheetCell {
  seed: number;
  ok: boolean;
  error?: string;
  floors: number;
  rooms: number;
  roomsByFloor: number[];
  entries: Id[];
  exteriorDoors: number;
  /** Independent cycles in the room graph (doors, cased openings, stairs between rooms). */
  interiorLoops: number;
  /** Independent cycles once every exterior zone is treated as one "outside" node. */
  loopsViaOutside: number;
  /** Rooms with no finite route from any entry zone. */
  unreachable: Id[];
  /** Rooms outside the largest indoor-connected group: reachable only by going outside
   * (expected for motel units, a defect in a house). */
  detached: Id[];
  objects: number;
  issues: { severity: string; code: string; message: string; ref?: string }[];
  plausibility: { score: number; notes: string[] } | null;
}

export function parseSeeds(spec: string | null): number[] {
  const out: number[] = [];
  for (const part of (spec ?? '1-24').split(',')) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    for (let s = Math.min(a, b); s <= Math.max(a, b) && out.length < 200; s++) out.push(s);
  }
  return [...new Set(out)];
}

const TRAVERSABLE = new Set(['door', 'doorway', 'sliding', 'stair']);

/** Connected groups of an undirected graph, largest first. */
function components(nodes: Id[], edges: [Id, Id][]): Id[][] {
  const parent = new Map(nodes.map((n) => [n, n]));
  const find = (x: Id): Id => (parent.get(x) === x ? x : find(parent.get(x)!));
  for (const [a, b] of edges) if (parent.has(a) && parent.has(b)) parent.set(find(a), find(b));
  const groups = new Map<Id, Id[]>();
  for (const n of nodes) (groups.get(find(n)) ?? groups.set(find(n), []).get(find(n))!).push(n);
  return [...groups.values()].sort((a, b) => b.length - a.length);
}

/** Cycle rank E - V + C of an undirected multigraph. */
function cycleRank(nodes: Id[], edges: [Id, Id][]): number {
  const parent = new Map(nodes.map((n) => [n, n]));
  const find = (x: Id): Id => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  let used = 0;
  for (const [a, b] of edges) {
    if (!parent.has(a) || !parent.has(b)) continue;
    used++;
    parent.set(find(a), find(b));
  }
  const components = new Set(nodes.map(find)).size;
  return used - nodes.length + components;
}

function summarise(seed: number, built: BuiltLocation, procedural: boolean): SheetCell {
  const loc = built.location;
  const roomIds = new Set(loc.rooms.map((r) => r.id));
  const zoneIds = new Set(loc.zones.map((z) => z.id));
  const floors = Math.max(loc.floors ?? 1, ...loc.rooms.map((r) => (r.floor ?? 0) + 1));
  const roomsByFloor = Array.from({ length: floors }, (_, f) => loc.rooms.filter((r) => (r.floor ?? 0) === f).length);
  const passable = loc.openings.filter((o) => TRAVERSABLE.has(o.type) && o.state !== 'blocked');
  const interior = passable.filter((o) => roomIds.has(o.a) && roomIds.has(o.b)).map((o) => [o.a, o.b] as [Id, Id]);
  const outside = (id: Id) => (zoneIds.has(id) ? '__outside' : id);
  const withOutside = passable
    .filter((o) => (roomIds.has(o.a) || zoneIds.has(o.a)) && (roomIds.has(o.b) || zoneIds.has(o.b)))
    .map((o) => [outside(o.a), outside(o.b)] as [Id, Id])
    .filter(([a, b]) => a !== b);
  const exteriorDoors = passable.filter((o) => o.type !== 'stair' && roomIds.has(o.a) !== roomIds.has(o.b)).length;
  const unreachable = loc.rooms
    .map((r) => r.id)
    .filter((id) => !loc.entries.some((e) => Number.isFinite(built.derived.distance[e]?.[id] ?? Infinity)));
  let plausibility: SheetCell['plausibility'] = null;
  if (procedural) {
    try {
      // plausibilityReport keys family limits (motel/warehouse exterior doors) on the unversioned
      // spec id, while built locations carry `<spec>_g1`; score the plan under the id it was generated as.
      const report = plausibilityReport({ ...loc, familyId: loc.familyId.replace(/_g\d+$/, '') });
      plausibility = { score: Math.round(report.score), notes: report.notes };
    } catch (e) {
      plausibility = { score: -1, notes: [`plausibilityReport threw: ${String(e)}`] };
    }
  }
  return {
    seed,
    ok: true,
    floors,
    rooms: loc.rooms.length,
    roomsByFloor,
    entries: loc.entries,
    exteriorDoors,
    interiorLoops: cycleRank([...roomIds], interior),
    loopsViaOutside: cycleRank([...roomIds, '__outside'], withOutside),
    unreachable,
    detached: components([...roomIds], interior).slice(1).flat(),
    objects: loc.objects.length,
    issues: built.issues.map((i) => ({ severity: i.severity, code: i.code, message: i.message, ref: i.ref })),
    plausibility,
  };
}

/** Every room and zone known by its real label, no reports: the plan as a briefing would show it. */
function plainSpaces(built: BuiltLocation): SpaceView[] {
  const loc = built.location;
  return [...loc.rooms, ...loc.zones].map((s) => ({ id: s.id, label: s.label, status: 'none', marker: null, squadsHere: [], facts: [], people: [], actionIds: [] }));
}

function Cell({ familyId, seed, floor, furnished, chrome }: { familyId: string; seed: number; floor: number; furnished: boolean; chrome: boolean }) {
  const procedural = PROCEDURAL_IDS.has(familyId);
  const result = useMemo(() => {
    const id = furnished ? furnishedFamilyIdV7(familyId) : familyId;
    try {
      const built = buildLocation(id, seed);
      return { built, cell: summarise(seed, built, procedural), spaces: plainSpaces(built) };
    } catch (e) {
      const cell: SheetCell = { seed, ok: false, error: String(e), floors: 0, rooms: 0, roomsByFloor: [], entries: [], exteriorDoors: 0, interiorLoops: 0, loopsViaOutside: 0, unreachable: [], detached: [], objects: 0, issues: [], plausibility: null };
      return { built: null, cell, spaces: [] };
    }
  }, [familyId, seed, furnished, procedural]);
  const { built, cell, spaces } = result;
  useEffect(() => registerCell(cell), [cell]);
  const missingFloor = built !== null && floor >= cell.floors;
  const errors = cell.issues.filter((i) => i.severity === 'error').length;
  return (
    <figure className={`ls-cell ${errors || !cell.ok ? 'ls-bad' : cell.issues.length ? 'ls-warn' : ''}`} data-seed={seed} data-floors={cell.floors}>
      <div className="ls-map">
        {!built && <p className="ls-empty">buildLocation threw</p>}
        {built && missingFloor && <p className="ls-empty">Single storey: no upper floor</p>}
        {built && !missingFloor && (
          <Blueprint built={built} spaces={spaces} squadTasks={[]} selectedSpaceId={null} focusSquadId={null} floor={floor} className={chrome ? undefined : 'ls-static'} />
        )}
      </div>
      <figcaption>
        <strong>
          {familyId} · seed {seed}
          {cell.floors > 1 ? ` · ${floor === 0 ? 'ground' : 'upper'}` : ''}
        </strong>
        {cell.ok ? (
          <>
            <span>
              {cell.floors} floor{cell.floors === 1 ? '' : 's'} · {cell.rooms} rooms{cell.floors > 1 ? ` (${cell.roomsByFloor.join(' + ')})` : ''} · {cell.objects} objects
            </span>
            <span>
              entries {cell.entries.length} ({cell.entries.join(', ')}) · ext doors {cell.exteriorDoors} · loops {cell.interiorLoops} inside / {cell.loopsViaOutside} via outside
            </span>
            {cell.plausibility && <span>plausibility {cell.plausibility.score}</span>}
            {cell.unreachable.length > 0 && <span className="ls-err">unreachable: {cell.unreachable.join(', ')}</span>}
            {cell.detached.length > 0 && <span className="ls-warn-text">only reachable via outside: {cell.detached.join(', ')}</span>}
            {cell.issues.length === 0 ? (
              <span className="ls-ok">validation: no issues</span>
            ) : (
              <ul className="ls-issues">
                {cell.issues.map((i, n) => (
                  <li key={n} className={i.severity === 'error' ? 'ls-err' : 'ls-warn-text'}>
                    {i.severity} {i.code}
                    {i.ref ? ` [${i.ref}]` : ''}: {i.message}
                  </li>
                ))}
              </ul>
            )}
            {cell.plausibility && cell.plausibility.notes.length > 0 && (
              <ul className="ls-notes">
                {cell.plausibility.notes.map((n, k) => (
                  <li key={k}>{n}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <span className="ls-err">{cell.error}</span>
        )}
      </figcaption>
    </figure>
  );
}

// Summary exposed for scripts/capture-locations.mjs. Cells register during render; the sheet
// flips `ready` after mount so a capture can wait on it.
interface SheetState {
  family: string;
  floor: number;
  furnished: boolean;
  seeds: number[];
  cells: Record<number, SheetCell>;
  ready: boolean;
}
declare global {
  interface Window {
    __locationSheet?: SheetState;
  }
}
function registerCell(cell: SheetCell) {
  if (window.__locationSheet) window.__locationSheet.cells[cell.seed] = cell;
}

function Picker({ family, query }: { family: string; query: URLSearchParams }) {
  const go = (next: Record<string, string>) => {
    const q = new URLSearchParams(query);
    for (const [k, v] of Object.entries(next)) q.set(k, v);
    window.location.search = q.toString();
  };
  const floor = query.get('floor') ?? '0';
  return (
    <div className="ls-controls">
      <label>
        Family
        <select name="family" value={family} onChange={(e) => go({ family: e.target.value })}>
          <optgroup label="Generated (procedural g1)">
            {PROCEDURAL_FAMILIES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label} · {f.id} · {f.floors[0] === f.floors[1] ? f.floors[0] : f.floors.join('-')} fl
              </option>
            ))}
          </optgroup>
          <optgroup label="Authored">
            {AUTHORED.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label} · {f.id}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <label>
        Floor
        <select value={floor} onChange={(e) => go({ floor: e.target.value })}>
          <option value="0">Ground</option>
          <option value="1">Upper</option>
        </select>
      </label>
      <label>
        Seeds
        <input defaultValue={query.get('seeds') ?? '1-24'} onKeyDown={(e) => e.key === 'Enter' && go({ seeds: e.currentTarget.value })} />
      </label>
    </div>
  );
}

function Sheet() {
  const query = new URLSearchParams(window.location.search);
  const family = query.get('family') ?? PROCEDURAL_FAMILIES[0]?.id ?? 'maple_street';
  const seeds = parseSeeds(query.get('seeds'));
  const floor = query.get('floor') === '1' ? 1 : 0;
  const furnished = query.get('furnished') !== '0';
  // The map's gesture hint and zoom buttons cover part of a small plan; ?chrome=1 keeps them.
  const chrome = query.get('chrome') === '1';
  const width = Math.max(200, Math.min(900, Number(query.get('w')) || 360));
  window.__locationSheet ??= { family, floor, furnished, seeds, cells: {}, ready: false };
  // Parent effects run after every child Cell's effect, so all cells are registered by now.
  useEffect(() => {
    requestAnimationFrame(() => {
      window.__locationSheet!.ready = true;
      document.body.dataset.ready = '1';
    });
  }, []);
  const known = PROCEDURAL_IDS.has(family) || AUTHORED.some((f) => f.id === family);
  return (
    <div className="ls-page" style={{ ['--ls-cell' as string]: `${width}px` }}>
      <header>
        <h1>
          {family}
          {furnished ? ' (furnished v7)' : ' (bare plan)'} · {floor === 0 ? 'ground floor' : 'upper floor'} · seeds {query.get('seeds') ?? '1-24'}
        </h1>
        <Picker family={family} query={query} />
        {!known && <p className="ls-err">Unknown family id; the sheet will show build errors.</p>}
      </header>
      <div className="ls-grid">
        {seeds.map((seed) => (
          <Cell key={seed} familyId={family} seed={seed} floor={floor} furnished={furnished} chrome={chrome} />
        ))}
      </div>
    </div>
  );
}

const host = document.getElementById('root')! as HTMLElement & { __root?: ReturnType<typeof createRoot> };
host.__root ??= createRoot(host);
host.__root.render(
  <StrictMode>
    <Sheet />
  </StrictMode>,
);
