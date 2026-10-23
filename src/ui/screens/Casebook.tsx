import { ChoiceRail } from '../components/ChoiceRail';
import { useMemo, useState } from 'react';
import './casebook.css';
import type { CasebookBest, GameState } from '../../sim/types';
import { Card, Chip, Row, Section } from '../components/ui';
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
      {shown.length === 0 ? <p className="dim">No frameworks match these filters.</p> : <ul className="casebook-rows" data-ui-list>
        {shown.map((row) => <CasebookRowView key={row.type} row={row} />)}
      </ul>}
    </Card>
  </Section>;
}

const lead = (row: CasebookRow) => <span className="casebook-icon"><CallTypeBadge type={row.type} size={40} medallion />{row.status === 'locked' && <Icon name="lock" size={13} className="casebook-lock" />}</span>;

/** One kind of call as a row: its badge, the best result or what it needs, and the situations found. */
function CasebookRowView({ row }: { row: CasebookRow }) {
  if (row.status === 'locked') return <li className="casebook-row casebook-locked" data-status="locked" data-type={row.type}>
    <Row lead={lead(row)} title={row.label} detail="Not yet dispatched to your department. Needs:" trail={<Chip tone="warn">Locked</Chip>} />
    <ul className="casebook-needs">{row.missing.map((line) => <li key={line}>{line}</li>)}</ul>
  </li>;
  if (row.status === 'unfound') return <li className="casebook-row" data-status="unfound" data-type={row.type}>
    <Row lead={lead(row)} title={row.label} detail={`Not taken yet · ${row.situationsTotal} ${row.situationsTotal === 1 ? 'situation' : 'situations'} to find`} trail={<Chip>0 of {row.situationsTotal}</Chip>} />
  </li>;
  const left = row.situationsTotal - row.situations.length;
  return <li className="casebook-row casebook-found" data-status="found" data-type={row.type}>
    <Row lead={lead(row)} title={row.label}
      detail={<>Best: <strong>{bestText(row.best)}</strong>{left > 0 ? ` · ${left} more ${left === 1 ? 'situation' : 'situations'} to find` : ''}</>}
      trail={<Chip tone="mint">{row.situations.length} of {row.situationsTotal}</Chip>} />
    <p className="casebook-line dim casebook-buildings">Visited: {row.buildings.map(familyLabel).join(', ')}</p>
    {row.missing.length > 0 && <p className="casebook-line dim">Not dispatched now. Needs {row.missing.join('; ').toLowerCase()}.</p>}
  </li>;
}
