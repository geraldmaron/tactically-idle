import { useLayoutEffect, useRef, useState } from 'react';
import { getState, useGame } from '../store';
import { squadReadiness } from '../../sim/department-selectors';
import type { Id, Officer, Squad, SquadId } from '../../sim/types';
import './officers.css';
import { Button, Card, Chip, EmptyState, Row, Section } from '../components/ui';
import { OfficerCard } from '../components/OfficerCard';
import { OfficerRow } from '../components/OfficerRow';
import { useToast } from '../components/toast';
import { DUTY_META } from '../components/labels';
import { officerFaceStatus } from '../components/face-status';
import type { SquadDuty } from '../../sim/types';
import { Icon } from '../icons';
import { SQUAD_IDS } from '../../sim/types';
import { Recruit } from './Recruit';
import { officerList, staysHomeLine } from './helpers';
import { useNav } from '../components/nav';
import { TrainingStore } from '../storefront/TrainingStore';
import { SquadOptimizer } from './SquadOptimizer';
import { ChoiceRail } from '../components/ChoiceRail';
import { squadName as squadNameOf } from '../../sim/squad-names';
import { ROSTER_FILTER_LABEL, ROSTER_SORT_LABEL, filterRoster, sortRoster, type RosterFilter, type RosterSort } from './squad-model';
import './squad-visual.css';

const DEFAULT_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta'];

/** The SWAT section: Squads, Roster, Hire and Training. Each officer shows once per view.
 * Tapping an officer opens their sheet, the one
 * place an officer is moved between squads or made leader; Arrange proposes a whole arrangement. */
export function SquadScreen() {
  const nav = useNav();
  return (<>
    <div className="page squad-page officers-page">
      <h2 className="sr-only officers-title">SWAT</h2>
      <ChoiceRail size="sm" value={nav.squadSection} kind="navigation" label="SWAT sections" grow onChange={nav.setSquadSection} options={[
        { value: 'squads', label: 'Squads' }, { value: 'roster', label: 'Roster' }, { value: 'hire', label: 'Hire' }, { value: 'training', label: 'Training' },
      ]} />
      {nav.squadSection === 'training' ? <TrainingStore />
        : nav.squadSection === 'hire' ? <Recruit />
        : nav.squadSection === 'roster' ? <RosterList onOpen={nav.openOfficer} />
        : <SquadsView />}
    </div>
  </>);
}

function SquadsView() {
  const g = useGame();
  const nav = useNav();
  const [creating, setCreating] = useState(false);
  const [arranging, setArranging] = useState(false);
  const full = g.squads.length >= SQUAD_IDS.length;
  const unassigned = officerList(g).filter((o) => o.squadId === null);
  const now = Date.now();
  const ready = g.squads.reduce((n, squad) => n + squadReadiness(g, squad.id, now).ready, 0);
  const total = g.squads.reduce((n, squad) => n + squad.officerIds.length, 0);
  return <>
    <QueuedMoves />
    <Section id="squads-h" title="Squads" icon="people" count={g.squads.length > 0 ? `${g.squads.length === 1 ? '1 squad' : `${g.squads.length} squads`} · ${ready} of ${total} ready` : undefined}
      action={g.squads.length > 0 ? <button type="button" className="section-link" onClick={() => { nav.closeOfficer(); setArranging(true); }}>Arrange</button> : undefined}>
      {g.squads.length === 0 && <EmptyState spot="openSlot" title="No squads yet">Create up to four squads, then open an officer to put them in one.</EmptyState>}
      {g.squads.length > 0 && <div className="squad-list" data-ui-list>{g.squads.map((squad) => <SquadPanel key={squad.id} squad={squad} onOpen={nav.openOfficer} />)}</div>}
    </Section>
    {unassigned.length > 0 && <Section id="squad-bench-h" title="Unassigned" icon="user" count="Off duty until in a squad">
      <div className="officer-character-grid">{unassigned.map((o) => <OfficerCard key={o.id} variant="tile" officer={o} now={now} faceStatus={officerFaceStatus(g, o.id, g.department.clockHighWater)} onClick={() => nav.openOfficer(o.id)} />)}</div>
    </Section>}
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
  const problems = deployed ? [] : [...(r.deployable ? [] : r.issues.slice(0, 2)), ...(r.deployable && r.staysHome.length > 0 ? [staysHomeLine(g, r.staysHome)] : [])];

  const leader = members.find((o) => o.id === squad.leaderId);
  return (
    <Card className="squadpanel">
      <section aria-label={`Squad ${squad.id}, ${squad.name}`} className="squad-block">
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
          <Row className="hq-duty hq-squad-row"
            lead={<span className="squad-badge squad-badge-lg" aria-hidden="true">{squad.id}</span>}
            title={<h2 className="squad-block-name">
              <button ref={renameButton} type="button" className="squad-rename" aria-label={`Rename ${squad.name}`} onClick={() => {
                requestedFocus.current = 'input';
                nav.updateSquadView({ type: 'rename', squadId: squad.id, name: squad.name });
              }}>{squad.name}<Icon name="edit" size={14} /></button>
            </h2>}
            detail={[deployed ? 'On a call' : r.ready === members.length && members.length > 0 ? `All ${members.length} ready` : `${r.ready} of ${total} ready`, leader ? `${leader.surname} leads` : null, open > 0 ? (open === 1 ? '1 open place' : `${open} open places`) : null].filter(Boolean).join(' · ')}
            trail={deployed ? <Chip tone="neutral" icon="deployed">On a call</Chip> : <ChoiceRail size="sm" label={`Duty for ${squad.name}`} value={squad.duty}
              options={(['standby', 'rest'] as SquadDuty[]).map((d) => ({ value: d, accessibleLabel: `${DUTY_META[d].label}. ${DUTY_META[d].blurb}`, label: <><Icon name={DUTY_META[d].icon} size={16} /><span>{DUTY_META[d].label}</span></> }))}
              onChange={(duty) => act({ type: 'setSquadDuty', squadId: squad.id, duty })} />}
          />
        )}
        {problems.length > 0 && <p className="squad-block-issue"><Icon name="warning" size={16} />{problems.join('. ')}</p>}
        <div className="officer-character-grid">{members.map((o) => <OfficerCard key={o.id} variant="tile" officer={o} now={now} faceStatus={officerFaceStatus(g, o.id, g.department.clockHighWater)} leader={o.id === squad.leaderId} onClick={() => onOpen(o.id)} />)}</div>
      </section>
    </Card>
  );
}

/** Squad moves waiting for a call to end, and moves that could not apply when it did. */
function QueuedMoves() {
  const g = useGame();
  const { act } = useToast();
  const moves = g.pendingSquadMoves ?? [];
  if (!moves.length) return null;
  const squadName = (id: SquadId | null) => id ? squadNameOf(g.squads, id) : 'Unassigned';
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
    <Section id="squad-roster-h" title="Roster" icon="people" count={`${officers.length} of ${g.department.rosterCap} officers`}>
      <div className="roster-bar">
        <ChoiceRail size="sm" value={filter} label="Show officers" onChange={setFilter} options={(Object.keys(ROSTER_FILTER_LABEL) as RosterFilter[]).map((value) => ({
          value, accessibleLabel: `${ROSTER_FILTER_LABEL[value]}, ${count(value)}`, label: <>{ROSTER_FILTER_LABEL[value]}<span className="choice-rail-count">{count(value)}</span></>,
        }))} />
        <label className="squad-sort">
          <span className="sr-only">Sort roster</span>
          <Icon name="sort" size={16} />
          <select value={sort} onChange={(event) => setSort(event.target.value as RosterSort)}>
            {(Object.keys(ROSTER_SORT_LABEL) as RosterSort[]).map((value) => <option key={value} value={value}>By {ROSTER_SORT_LABEL[value].toLowerCase()}</option>)}
          </select>
        </label>
      </div>
      {shown.length === 0 ? <p className="squad-block-open">No officers here.</p> : <Card className="officer-roster-card"><div className="officer-rows" data-ui-list>
        {shown.map((o) => <OfficerRow key={o.id} officer={o} now={now} faceStatus={officerFaceStatus(g, o.id, g.department.clockHighWater)} squadId={o.squadId} leader={leaders.has(o.id)} onClick={() => onOpen(o.id)} />)}
      </div></Card>}
    </Section>
  );
}
