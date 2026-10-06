import { useEffect, useMemo, useState } from 'react';
import './casebook.css';
import type { ScenarioSituation } from '../../content/scenario-recipes';
import type { IncidentType } from '../../sim/scenario-types';
import type { CasebookBest, GameState } from '../../sim/types';
import { Button, Card, Chip, Section } from '../components/ui';
import { FloorsChip, familyBlurb, familyLabel, scenarioFloorCount, settingIcon } from '../components/incident';
import { Icon } from '../icons';
import {
  buildingOptionLabel, casebookRows, casebookTotals, featuredBestFromDebriefs, featuredOperation, filterRows, isGeneratedBuilding,
  localDateKey, practiceScenarioV10, practiceStartSeed,
} from './casebook-model';
import type { CasebookFilter, CasebookRow, FoundRow } from './casebook-model';
import { isUnlocked } from '../../content/unlocks';

const situationName = (situation: ScenarioSituation) => `Situation ${situation.variant + 1}${situation.characteristic === 'deliberate_answers' ? ' · slower answers' : ''}`;
const bestText = (best: CasebookBest | undefined) => best ? best.label : 'No result yet';

/** One row per framework: what was found, the best live result and where. Locked and
 * undiscovered rows show requirements and counts, never call content. */
export function Casebook({ state, onPrepare }: { state: GameState; onPrepare: (id: string) => void }) {
  const rows = useMemo(() => casebookRows(state), [state.casebook, state.debriefs, state.department.level, state.officers, state.units]);
  const totals = casebookTotals(rows);
  const [filter, setFilter] = useState<CasebookFilter>({ type: 'all', setting: 'all', status: 'all' });
  const [open, setOpen] = useState<IncidentType | null>(null);
  const shown = filterRows(rows, filter);
  return <Section title="Casebook" icon="book" hint="Calls your department has taken. Replay any situation you have found as practice on a fresh building, with virtual gear and no rewards or consequences.">
    <Card className="casebook-card">
      <p className="casebook-totals" role="status">
        <strong>{totals.frameworksFound} of {totals.frameworks}</strong> kinds of call found · <strong>{totals.situationsFound} of {totals.situations}</strong> situations
        {totals.locked > 0 && <> · {totals.locked} not yet dispatched</>}
      </p>
      <div className="casebook-filters">
        <label className="field">Framework
          <select value={filter.type} onChange={(event) => setFilter({ ...filter, type: event.target.value as CasebookFilter['type'] })}>
            <option value="all">All frameworks</option>
            {rows.map((row) => <option key={row.type} value={row.type}>{row.label}</option>)}
          </select>
        </label>
        <label className="field">Setting
          <select value={filter.setting} onChange={(event) => setFilter({ ...filter, setting: event.target.value as CasebookFilter['setting'] })}>
            <option value="all">All settings</option>
            <option value="homes">Homes</option>
            <option value="businesses">Businesses</option>
          </select>
        </label>
        <label className="field">Status
          <select value={filter.status} onChange={(event) => setFilter({ ...filter, status: event.target.value as CasebookFilter['status'] })}>
            <option value="all">All</option>
            <option value="found">Found</option>
            <option value="unfound">Still to find</option>
            <option value="locked">Not yet dispatched</option>
          </select>
        </label>
      </div>
      {shown.length === 0 ? <p className="dim">No frameworks match these filters.</p> : <ul className="casebook-rows">
        {shown.map((row) => <CasebookRowView key={row.type} row={row} open={open === row.type} onToggle={() => setOpen(open === row.type ? null : row.type)} onPrepare={onPrepare} />)}
      </ul>}
    </Card>
  </Section>;
}

function CasebookRowView({ row, open, onToggle, onPrepare }: { row: CasebookRow; open: boolean; onToggle: () => void; onPrepare: (id: string) => void }) {
  if (row.status === 'locked') return <li className="casebook-row casebook-locked" data-status="locked" data-type={row.type}>
    <div className="casebook-row-head">
      <span className="casebook-name"><Icon name="lock" size={15} />{row.label}</span>
      <Chip tone="warn">Locked</Chip>
    </div>
    <p className="casebook-line">Not yet dispatched to your department. Needs:</p>
    <ul className="casebook-needs">{row.missing.map((line) => <li key={line}>{line}</li>)}</ul>
  </li>;
  if (row.status === 'unfound') return <li className="casebook-row" data-status="unfound" data-type={row.type}>
    <div className="casebook-row-head">
      <span className="casebook-name"><Icon name="question" size={15} />{row.label}</span>
      <Chip>0 of {row.situationsTotal}</Chip>
    </div>
    <p className="casebook-line dim">Not taken yet · {row.situationsTotal} {row.situationsTotal === 1 ? 'situation' : 'situations'} to find</p>
  </li>;
  const left = row.situationsTotal - row.situations.length;
  return <li className="casebook-row" data-status="found" data-type={row.type}>
    <div className="casebook-row-head">
      <span className="casebook-name"><Icon name="check" size={15} />{row.label}</span>
      <Chip tone="mint">{row.situations.length} of {row.situationsTotal}</Chip>
    </div>
    <p className="casebook-line">Best: <strong>{bestText(row.best)}</strong>{left > 0 && <span className="dim"> · {left} more {left === 1 ? 'situation' : 'situations'} to find</span>}</p>
    <p className="casebook-line dim casebook-buildings">Visited: {row.buildings.map(familyLabel).join(', ')}</p>
    {row.missing.length > 0 && <p className="casebook-line dim">Not dispatched now. Needs {row.missing.join('; ').toLowerCase()}.</p>}
    <Button size="sm" icon="refresh" aria-expanded={open} onClick={onToggle}>{open ? 'Close practice' : 'Practice'}</Button>
    {open && <CasebookPractice row={row} onPrepare={onPrepare} />}
  </li>;
}

function CasebookPractice({ row, onPrepare }: { row: FoundRow; onPrepare: (id: string) => void }) {
  const options = row.situations.flatMap((situation) => situation.pacings);
  const [index, setIndex] = useState(0);
  const situation = options[Math.min(index, options.length - 1)];
  const visited = row.situations.find((entry) => entry.variant === situation.variant)?.buildings[0] ?? row.families[0];
  const [familyId, setFamilyId] = useState(row.families.includes(visited) ? visited : row.families[0]);
  const [layout, setLayout] = useState({ number: 1, fromSeed: practiceStartSeed(row.type, familyId, situation) });
  const { scenario, buildingSeed } = useMemo(() => practiceScenarioV10(row.type, familyId, situation, layout.fromSeed), [row.type, familyId, situation.variant, situation.characteristic, layout.fromSeed]);
  const authored = row.families.filter((id) => !isGeneratedBuilding(id));
  const generated = row.families.filter(isGeneratedBuilding);
  const chooseSituation = (next: number) => { setIndex(next); setLayout({ number: 1, fromSeed: practiceStartSeed(row.type, familyId, options[next]) }); };
  const chooseBuilding = (next: string) => { setFamilyId(next); setLayout({ number: 1, fromSeed: practiceStartSeed(row.type, next, situation) }); };
  return <div className="casebook-practice">
    <label className="field">Situation
      <select value={index} onChange={(event) => chooseSituation(Number(event.target.value))}>
        {options.map((option, i) => <option key={`${option.variant}/${option.characteristic}`} value={i}>{situationName(option)}</option>)}
      </select>
    </label>
    <label className="field">Building
      <select value={familyId} onChange={(event) => chooseBuilding(event.target.value)}>
        {generated.length ? <>
          <optgroup label="Fixed layouts">{authored.map((id) => <option key={id} value={id}>{buildingOptionLabel(id)}</option>)}</optgroup>
          <optgroup label="Generated layouts">{generated.map((id) => <option key={id} value={id}>{buildingOptionLabel(id)}</option>)}</optgroup>
        </> : authored.map((id) => <option key={id} value={id}>{buildingOptionLabel(id)}</option>)}
      </select>
    </label>
    {scenario ? <>
      <h3>{scenario.title}</h3>
      <p className="casebook-where">
        <Icon name={settingIcon(scenario.setting)} size={14} />
        <span>{familyBlurb(scenario.locationFamilyId)}</span>
        <FloorsChip floors={scenarioFloorCount(scenario)} />
      </p>
      <p>{scenario.summary}</p>
      <p className="dim">Layout {layout.number}. A new layout changes the building, names, furnishings, and placement while keeping this situation.</p>
      <div className="casebook-actions">
        <Button onClick={() => setLayout({ number: layout.number + 1, fromSeed: buildingSeed + 1 })}>New layout</Button>
        <Button variant="primary" onClick={() => onPrepare(scenario.id)}>Practice this call</Button>
      </div>
    </> : <p role="alert">This call could not be prepared. Choose another building.</p>}
  </div>;
}

// ---------------------------------------------------------------- featured operation

const FEATURED_BEST_KEY = 'tactically-idle/featured-best';
type FeaturedBest = CasebookBest & { ending: string };

function readFeaturedBest(dateKey: string): FeaturedBest | null {
  try {
    const all = JSON.parse(localStorage.getItem(FEATURED_BEST_KEY) ?? '{}') as Record<string, FeaturedBest>;
    const entry = all?.[dateKey];
    return entry && typeof entry.objective === 'number' && typeof entry.label === 'string' ? entry : null;
  } catch {
    return null;
  }
}

function writeFeaturedBest(dateKey: string, best: FeaturedBest): void {
  try {
    const all = JSON.parse(localStorage.getItem(FEATURED_BEST_KEY) ?? '{}') as Record<string, FeaturedBest>;
    const kept = Object.fromEntries(Object.entries(all && typeof all === 'object' ? all : {}).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 29));
    localStorage.setItem(FEATURED_BEST_KEY, JSON.stringify({ ...kept, [dateKey]: best }));
  } catch {
    // A private window or blocked storage only loses the remembered best.
  }
}

const better = (a: FeaturedBest | null, b: FeaturedBest | null) => !a ? b : !b ? a
  : a.completed !== b.completed ? (a.completed ? a : b) : a.objective !== b.objective ? (a.objective > b.objective ? a : b) : a.safety >= b.safety ? a : b;

/** Today's featured call: the same for every player on this calendar date, played as
 * practice. The best result is remembered on this device only. */
export function FeaturedOperationCard({ state, now, onPrepare }: { state: GameState; now: number; onPrepare: (id: string) => void }) {
  const dateKey = localDateKey(now);
  const featured = useMemo(() => featuredOperation(dateKey), [dateKey]);
  const scenario = featured.scenario;
  const fromDebriefs = scenario ? featuredBestFromDebriefs(state.debriefs, scenario.id) : null;
  const [stored, setStored] = useState<FeaturedBest | null>(() => readFeaturedBest(dateKey));
  const best = better(fromDebriefs, stored);
  useEffect(() => { setStored(readFeaturedBest(dateKey)); }, [dateKey]);
  useEffect(() => {
    if (fromDebriefs && better(fromDebriefs, stored) === fromDebriefs && (!stored || stored.objective !== fromDebriefs.objective || stored.completed !== fromDebriefs.completed || stored.safety !== fromDebriefs.safety)) {
      writeFeaturedBest(dateKey, fromDebriefs);
      setStored(fromDebriefs);
    }
  }, [dateKey, fromDebriefs?.objective, fromDebriefs?.completed, fromDebriefs?.safety]);
  const day = new Date(now).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const locked = !isUnlocked(state, featured.type);
  return <Section title="Featured operation" icon="star" hint="One call a day, the same for every department. Practice only: virtual gear, no rewards or consequences.">
    <Card className="featured-card" tone="amber">
      <div className="opboard-head">
        <span className="opboard-kind"><Icon name="calendar" size={18} />{day}</span>
        <span className="dim">{featured.label}</span>
      </div>
      {locked ? <p className="casebook-line">Today's featured call is not yet dispatched to your department.</p>
        : scenario ? <>
          <h3 className="opboard-title">{scenario.title}</h3>
          <p className="casebook-where">
            <Icon name={settingIcon(scenario.setting)} size={14} />
            <span>{familyBlurb(scenario.locationFamilyId)}</span>
            <FloorsChip floors={scenarioFloorCount(scenario)} />
          </p>
          <p className="opboard-summary">{scenario.summary}</p>
          <p className="casebook-line featured-best" data-best={best ? 'yes' : 'no'}>
            <Icon name="medal" size={15} />
            {best ? <span>Your best today: <strong>{best.label}</strong> · objective {best.objective}</span> : <span className="dim">No result today yet.</span>}
          </p>
          <Button variant="primary" block onClick={() => onPrepare(scenario.id)}>Practice featured operation</Button>
        </> : <p role="alert">Today's featured call could not be prepared.</p>}
    </Card>
  </Section>;
}
