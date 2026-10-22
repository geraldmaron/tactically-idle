import { ChoiceRail } from '../components/ChoiceRail';
import { useMemo, useState } from 'react';
import './casebook.css';
import type { CasebookBest, GameState } from '../../sim/types';
import { Card, Chip, Section } from '../components/ui';
import { familyLabel } from '../components/incident';
import { CallTypeBadge } from '../icons/CallTypeBadge';
import { Icon } from '../icons';
import { casebookRows, casebookTotals, filterRows } from './casebook-model';
import type { CasebookFilter, CasebookRow } from './casebook-model';

const bestText = (best: CasebookBest | undefined) => best ? best.label : 'No result yet';

/** One row per framework: what was found, the best result and where. Locked and undiscovered
 * rows show requirements and counts, never call content. */
export function Casebook({ state }: { state: GameState }) {
  const rows = useMemo(() => casebookRows(state), [state.casebook, state.debriefs, state.department.level, state.officers, state.units]);
  const totals = casebookTotals(rows);
  const [filter, setFilter] = useState<CasebookFilter>({ type: 'all', setting: 'all', status: 'all' });
  const shown = filterRows(rows, filter);
  const filtered = filter.type !== 'all' || filter.setting !== 'all' || filter.status !== 'all';
  const share = totals.situations ? totals.situationsFound / totals.situations : 0;
  return <Section title="Casebook" icon="book" hint="The kinds of call your department has taken, the best result on each and the buildings visited.">
    <Card className="casebook-card">
      <div className="casebook-progress">
        <p className="casebook-totals" role="status">
          <strong>{totals.frameworksFound} of {totals.frameworks}</strong> kinds of call found · <strong>{totals.situationsFound} of {totals.situations}</strong> situations
          {totals.locked > 0 && <> · {totals.locked} not yet dispatched</>}
        </p>
        <span className="casebook-bar" aria-hidden="true"><i style={{ width: `${Math.round(share * 100)}%` }} /></span>
      </div>
      <div className="casebook-filters">
        <ChoiceRail kind="filter" label="Show calls" grow value={filter.status} onChange={(status) => setFilter({ ...filter, status })} options={[
          { value: 'all', label: 'All' }, { value: 'found', label: 'Found' }, { value: 'unfound', label: 'To find' }, { value: 'locked', label: 'Locked', accessibleLabel: 'Not yet dispatched' },
        ]} />
        <ChoiceRail kind="filter" label="Setting" grow value={filter.setting} onChange={(setting) => setFilter({ ...filter, setting })} options={[
          { value: 'all', label: 'Any setting' }, { value: 'homes', label: 'Homes' }, { value: 'businesses', label: 'Businesses' },
        ]} />
        {filtered && <p className="dim casebook-shown" role="status">{shown.length} shown</p>}
      </div>
      {shown.length === 0 ? <p className="dim">No frameworks match these filters.</p> : <ul className="casebook-rows">
        {shown.map((row) => <CasebookRowView key={row.type} row={row} />)}
      </ul>}
    </Card>
  </Section>;
}

/** Situations found as pips, so progress per kind of call reads at a glance. */
function SituationPips({ found, total }: { found: number; total: number }) {
  return <span className="casebook-pips" aria-hidden="true">{Array.from({ length: total }, (_, i) => <i key={i} className={i < found ? 'on' : undefined} />)}</span>;
}

function CasebookRowView({ row }: { row: CasebookRow }) {
  if (row.status === 'locked') return <li className="casebook-row casebook-locked" data-status="locked" data-type={row.type}>
    <div className="casebook-row-head">
      <span className="casebook-icon"><CallTypeBadge type={row.type} size={40} medallion /><Icon name="lock" size={13} className="casebook-lock" /></span>
      <span className="casebook-name">{row.label}</span>
    </div>
    <div className="casebook-meter"><Chip tone="warn">Locked</Chip></div>
    <p className="casebook-line">Not yet dispatched to your department. Needs:</p>
    <ul className="casebook-needs">{row.missing.map((line) => <li key={line}>{line}</li>)}</ul>
  </li>;
  if (row.status === 'unfound') return <li className="casebook-row" data-status="unfound" data-type={row.type}>
    <div className="casebook-row-head">
      <span className="casebook-icon"><CallTypeBadge type={row.type} size={40} medallion /></span>
      <span className="casebook-name">{row.label}</span>
    </div>
    <div className="casebook-meter"><SituationPips found={0} total={row.situationsTotal} /><Chip>0 of {row.situationsTotal}</Chip></div>
    <p className="casebook-line dim">Not taken yet · {row.situationsTotal} {row.situationsTotal === 1 ? 'situation' : 'situations'} to find</p>
  </li>;
  const left = row.situationsTotal - row.situations.length;
  return <li className="casebook-row casebook-found" data-status="found" data-type={row.type}>
    <div className="casebook-row-head">
      <span className="casebook-icon"><CallTypeBadge type={row.type} size={40} medallion /></span>
      <span className="casebook-name">{row.label}</span>
    </div>
    <div className="casebook-meter"><SituationPips found={row.situations.length} total={row.situationsTotal} /><Chip tone="mint">{row.situations.length} of {row.situationsTotal}</Chip></div>
    <p className="casebook-line">Best: <strong>{bestText(row.best)}</strong>{left > 0 && <span className="dim"> · {left} more {left === 1 ? 'situation' : 'situations'} to find</span>}</p>
    <p className="casebook-line dim casebook-buildings">Visited: {row.buildings.map(familyLabel).join(', ')}</p>
    {row.missing.length > 0 && <p className="casebook-line dim">Not dispatched now. Needs {row.missing.join('; ').toLowerCase()}.</p>}
  </li>;
}
