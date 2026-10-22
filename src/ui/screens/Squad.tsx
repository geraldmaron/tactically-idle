import { useLayoutEffect, useRef, useState } from 'react';
import { getState, useGame } from '../store';
import { squadReadiness } from '../../sim/department-selectors';
import type { Id, Officer, Squad, SquadId } from '../../sim/types';
import './officers.css';
import { Button, EmptyState } from '../components/ui';
import { OfficerRow } from '../components/OfficerRow';
import { useToast } from '../components/toast';
import { DUTY_META } from '../components/labels';
import { Icon } from '../icons';
import { SQUAD_IDS } from '../../sim/types';
import { Recruit } from './Recruit';
import { officerList, staysHomeLine } from './helpers';
import { useNav } from '../components/nav';
import { TrainingStore } from '../storefront/TrainingStore';
import { SquadOptimizer } from './SquadOptimizer';
import { ChoiceRail } from '../components/ChoiceRail';
import { ROSTER_FILTER_LABEL, ROSTER_SORT_LABEL, filterRoster, sortRoster, type RosterFilter, type RosterSort } from './squad-model';
import './squad-visual.css';

const DEFAULT_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta'];

/** The Officers tab: Squads, Roster, Hire and Training as segments (docs/ui-ux-audit.md,
 * "Officers"). Each officer shows once per view. Tapping an officer opens their sheet, the one
 * place an officer is moved between squads or made leader; Arrange proposes a whole arrangement. */
export function SquadScreen() {
  const nav = useNav();
  return (
    <div className="page squad-page officers-page">
      <ChoiceRail value={nav.squadSection} kind="navigation" label="Officers sections" grow onChange={nav.setSquadSection} options={[
        { value: 'squads', label: 'Squads' }, { value: 'roster', label: 'Roster' }, { value: 'hire', label: 'Hire' }, { value: 'training', label: 'Training' },
      ]} />
      {nav.squadSection === 'training' ? <TrainingStore />
        : nav.squadSection === 'hire' ? <Recruit />
        : nav.squadSection === 'roster' ? <RosterList onOpen={nav.openOfficer} />
        : <SquadsView />}
    </div>
  );
}

function SquadsView() {
  const g = useGame();
  const nav = useNav();
  const [creating, setCreating] = useState(false);
  const [arranging, setArranging] = useState(false);
  const full = g.squads.length >= SQUAD_IDS.length;
  const unassigned = officerList(g).filter((o) => o.squadId === null);
  const now = Date.now();
  return <>
    <QueuedMoves />
    <div className="officers-head">
      <h2 className="section-title">{g.squads.length === 1 ? '1 squad' : `${g.squads.length} squads`}</h2>
      {g.squads.length > 0 && <button type="button" className="text-link" onClick={() => { nav.closeOfficer(); setArranging(true); }}>Arrange</button>}
    </div>
    {g.squads.length === 0 && <EmptyState icon="people" title="No squads yet">Create up to four squads, then open an officer to put them in one.</EmptyState>}
    {g.squads.map((squad) => <SquadPanel key={squad.id} squad={squad} onOpen={nav.openOfficer} />)}
    {unassigned.length > 0 && <section className="squad-block" aria-labelledby="squad-bench-h">
      <div className="squad-block-head">
        <span className="squad-badge" aria-hidden="true"><Icon name="user" size={14} /></span>
        <h2 id="squad-bench-h" className="squad-block-name">Unassigned</h2>
        <span className="squad-block-meta">Off duty until in a squad</span>
      </div>
      {unassigned.map((o) => <OfficerRow key={o.id} officer={o} now={now} onClick={() => nav.openOfficer(o.id)} />)}
    </section>}
    {creating ? <CreateSquad count={g.squads.length} onDone={() => setCreating(false)} />
      : !full && <Button variant="quiet" icon="plus" onClick={() => setCreating(true)}>New squad</Button>}
    {arranging && <SquadOptimizer open onClose={() => setArranging(false)} />}
  </>;
}

function CreateSquad({ count, onDone }: { count: number; onDone: (id?: SquadId) => void }) {
  const { act } = useToast();
  const [name, setName] = useState(DEFAULT_NAMES[count] ?? 'New squad');
  const submit = () => {
    const res = act({ type: 'createSquad', name: name.trim() || DEFAULT_NAMES[count] || 'Squad' }, 'Squad created');
    if (res.ok) onDone(getState().squads.at(-1)?.id);
  };
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="field">
        <span>Squad name</span>
        <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
      </label>
      <Button type="submit" variant="primary">
        Create
      </Button>
      <Button variant="ghost" onClick={() => onDone()}>
        Cancel
      </Button>
    </form>
  );
}

/** One squad as a block of rows: the letter, the name (renamed in place), duty and readiness on
 * the heading, what keeps it from deploying under it, then its officers with the leader starred. */
export function SquadPanel({ squad, onOpen }: { squad: Squad; onOpen: (id: Id) => void }) {
  const g = useGame();
  const nav = useNav();
  const { act } = useToast();
  const now = Date.now();
  const r = squadReadiness(g, squad.id, now);
  const name = nav.squadView.renameDrafts[squad.id];
  const renaming = name !== undefined;
  const renameInput = useRef<HTMLInputElement>(null);
  const renameButton = useRef<HTMLButtonElement>(null);
  const requestedFocus = useRef<'input' | 'button' | null>(null);
  useLayoutEffect(() => {
    // Only an explicit edit/save/cancel moves focus.
    const target = requestedFocus.current === 'input' ? renameInput.current : requestedFocus.current === 'button' ? renameButton.current : null;
    target?.focus({ preventScroll: true });
    requestedFocus.current = null;
  }, [renaming]);
  const finishRename = () => {
    requestedFocus.current = 'button';
    nav.updateSquadView({ type: 'finishRename', squadId: squad.id });
  };
  const members = squad.officerIds.map((id) => g.officers[id]).filter((o): o is Officer => !!o);
  const deployed = g.activeRun?.squadIds.includes(squad.id) && g.activeRun.status !== 'closed';
  const total = r.total || members.length;
  const open = Math.max(0, 4 - members.length);
  const problems = deployed ? ['On a call'] : [...(r.deployable ? [] : r.issues.slice(0, 2)), ...(r.deployable && r.staysHome.length > 0 ? [staysHomeLine(g, r.staysHome)] : [])];

  return (
    <section className="squad-block squadpanel" aria-label={`Squad ${squad.id}, ${squad.name}`}>
      <div className="squad-block-head">
        <span className="squad-badge" aria-hidden="true">{squad.id}</span>
        {renaming ? (
          <form
            className="rename"
            onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); finishRename(); } }}
            onSubmit={(e) => {
              e.preventDefault();
              if (act({ type: 'renameSquad', squadId: squad.id, name: name.trim() }, 'Squad renamed').ok) finishRename();
            }}
          >
            <input ref={renameInput} aria-label={`Squad ${squad.id} name`} value={name} maxLength={20} onChange={(e) => nav.updateSquadView({ type: 'rename', squadId: squad.id, name: e.target.value })} />
            <Button type="submit" size="sm" variant="primary">
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={finishRename}>Cancel</Button>
          </form>
        ) : (
          <>
            <h2 className="squad-block-name">
              <button ref={renameButton} type="button" className="squad-rename" aria-label={`Rename ${squad.name}`} onClick={() => {
                requestedFocus.current = 'input';
                nav.updateSquadView({ type: 'rename', squadId: squad.id, name: squad.name });
              }}>{squad.name}<Icon name="edit" size={14} /></button>
            </h2>
            <span className="squad-block-meta">{DUTY_META[squad.duty].label} · {r.ready} of {total} ready</span>
          </>
        )}
      </div>
      {problems.length > 0 && <p className="squad-block-issue"><Icon name="warning" size={16} />{problems.join('. ')}</p>}
      {members.map((o) => <OfficerRow key={o.id} officer={o} now={now} leader={o.id === squad.leaderId} onClick={() => onOpen(o.id)} />)}
      {open > 0 && <p className="squad-block-open">{open === 1 ? '1 open place' : `${open} open places`}</p>}
    </section>
  );
}

/** Squad moves waiting for a call to end, and moves that could not apply when it did. */
function QueuedMoves() {
  const g = useGame();
  const { act } = useToast();
  const moves = g.pendingSquadMoves ?? [];
  if (!moves.length) return null;
  const squadName = (id: SquadId | null) => id ? g.squads.find((s) => s.id === id)?.name ?? `Squad ${id}` : 'Unassigned';
  return (
    <section className="card squad-queue" aria-labelledby="squad-queue-h">
      <h2 id="squad-queue-h" className="squad-block-title"><Icon name="clock" size={16} />After the call <span className="squad-block-count">{moves.length}</span></h2>
      <ul className="squad-queue-list">
        {moves.map((m) => {
          const o = g.officers[m.officerId];
          const who = o ? o.surname : 'Former officer';
          return (
            <li key={m.officerId} className={m.dropped ? 'squad-queue-dropped' : undefined}>
              <span className="squad-queue-move">
                <strong>{who}</strong>
                <span>{o?.squadId ? squadName(o.squadId) : 'Unassigned'}<span aria-hidden="true"> → </span>{squadName(m.squadId)}</span>
                {m.dropped && <span className="squad-queue-reason"><Icon name="warning" size={12} />Not moved. {m.dropped}</span>}
              </span>
              <Button size="sm" variant="ghost" aria-label={`${m.dropped ? 'Clear' : 'Cancel'} the move for ${who}`} onClick={() => act({ type: 'cancelPendingSquadMove', officerId: m.officerId }, m.dropped ? undefined : 'Move cancelled')}>
                {m.dropped ? 'Clear' : 'Cancel'}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Every officer once, filtered and sorted, with their squad letter. */
function RosterList({ onOpen }: { onOpen: (id: Id) => void }) {
  const g = useGame();
  const now = Date.now();
  const [filter, setFilter] = useState<RosterFilter>('all');
  const [sort, setSort] = useState<RosterSort>('squad');
  const officers = officerList(g);
  const shown = sortRoster(filterRoster(officers, filter, now), sort);
  const leaders = new Set(g.squads.map((squad) => squad.leaderId).filter(Boolean));
  const count = (value: RosterFilter) => filterRoster(officers, value, now).length;
  return (
    <section className="squad-roster" aria-labelledby="squad-roster-h">
      <div className="officers-head">
        <h2 id="squad-roster-h" className="section-title">{officers.length} of {g.department.rosterCap} officers</h2>
        <label className="squad-sort">
          <span className="sr-only">Sort roster</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as RosterSort)}>
            {(Object.keys(ROSTER_SORT_LABEL) as RosterSort[]).map((value) => <option key={value} value={value}>By {ROSTER_SORT_LABEL[value].toLowerCase()}</option>)}
          </select>
        </label>
      </div>
      <ChoiceRail value={filter} label="Show officers" grow onChange={setFilter} options={(Object.keys(ROSTER_FILTER_LABEL) as RosterFilter[]).map((value) => ({
        value, accessibleLabel: `${ROSTER_FILTER_LABEL[value]}, ${count(value)}`, label: <>{ROSTER_FILTER_LABEL[value]}<span className="choice-rail-count">{count(value)}</span></>,
      }))} />
      {shown.length === 0 ? <p className="squad-block-open">No officers here.</p> : <div className="officer-rows">
        {shown.map((o) => <OfficerRow key={o.id} officer={o} now={now} squadId={o.squadId} leader={leaders.has(o.id)} onClick={() => onOpen(o.id)} />)}
      </div>}
    </section>
  );
}
