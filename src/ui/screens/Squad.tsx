import { useLayoutEffect, useRef, useState } from 'react';
import { getState, useGame } from '../store';
import { recoveryInfo, squadReadiness } from '../../sim/department-selectors';
import type { Id, Officer, Squad, SquadId } from '../../sim/types';
import { Button, Card, Chip, EmptyState, OfficerStatusChip } from '../components/ui';
import { OfficerCard } from '../components/OfficerCard';
import { useToast } from '../components/toast';
import { DUTY_META, RATING_META, ROLE_META, ratingTone } from '../components/labels';
import { Icon } from '../icons';
import { SQUAD_IDS } from '../../sim/types';
import { OfficerSheet } from './OfficerSheet';
import { Recruit } from './Recruit';
import { officerList } from './helpers';
import { useNav } from '../components/nav';
import { TrainingStore } from '../storefront/TrainingStore';
import { SquadOptimizer } from './SquadOptimizer';
import { ChoiceRail } from '../components/ChoiceRail';
import { Portrait } from '../portraits/Portrait';
import { StressDisplay } from '../components/StressDisplay';
import { ROSTER_FILTER_LABEL, ROSTER_SORT_LABEL, filterRoster, squadCoverage, sortRoster, type RosterFilter, type RosterSort } from './squad-model';
import './squad-visual.css';

const DEFAULT_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta'];

export function SquadScreen() {
  const g = useGame();
  const nav = useNav();
  const setSel = (squadId: SquadId) => nav.updateSquadView({ type: 'select', squadId });
  const [officerId, setOfficerId] = useState<Id | null>(null);
  const [creating, setCreating] = useState(false);
  const [arranging, setArranging] = useState(false);
  const { notify } = useToast();
  const full = g.squads.length >= SQUAD_IDS.length;
  const active = g.squads.find((s) => s.id === nav.squadView.selectedId) ?? g.squads[0];

  const unassigned = officerList(g).filter((o) => o.squadId === null);

  return (
    <div className="page squad-page">
      <ChoiceRail value={nav.squadSection} kind="navigation" label="Squad sections" grow onChange={nav.setSquadSection} options={[
        { value: 'roster', label: 'Roster' }, { value: 'training', label: 'Training' },
      ]} />
      {nav.squadSection === 'training' ? <TrainingStore /> : <>
      <div className="squad-navigation">
        <ChoiceRail value={active?.id ?? 'A'} kind="tabs" label="Squads" panelId="selected-squad-panel" onChange={setSel} options={g.squads.map((s) => ({
          value: s.id, accessibleLabel: `Squad ${s.id}, ${s.name}`, label: <><b>{s.id}</b><span className="squad-tab-name">{s.name}</span></>,
        }))} />
        <button
          type="button"
          className={`squad-add-control${full ? ' squadtab-full' : ''}`}
          aria-label={full ? 'All four squad slots are in use' : 'Create squad'}
          onClick={() => {
            if (full) {
              setCreating(false);
              notify(`All ${SQUAD_IDS.length} squad slots are in use`, { tone: 'error' });
              return;
            }
            setCreating((v) => !v);
          }}
          aria-expanded={full ? undefined : creating}
        >
          <Icon name="plus" size={18} />
        </button>
        <button type="button" className="squad-add-control squad-arrange-control" aria-label="Arrange squads" disabled={g.squads.length === 0} onClick={() => { setOfficerId(null); setArranging(true); }}>
          <Icon name="nodes" size={16} /><span>Arrange</span>
        </button>
      </div>
      {creating && <CreateSquad count={g.squads.length} onDone={(id) => { setCreating(false); if (id) setSel(id); }} />}

      <div id="selected-squad-panel" role="tabpanel" aria-labelledby={active ? `selected-squad-panel-tab-${active.id}` : undefined} aria-label={active ? undefined : 'Squads'} tabIndex={0}>{active ? (
        <SquadPanel key={active.id} squad={active} onOpen={setOfficerId} />
      ) : (
        <Card>
          <EmptyState icon="people" title="No squads yet">
            Create up to four squads, then assign officers to them.
          </EmptyState>
        </Card>
      )}</div>

      {unassigned.length > 0 && <section className="squad-bench" aria-labelledby="squad-bench-h">
        <h2 id="squad-bench-h" className="squad-block-title"><Icon name="user" size={16} />Unassigned <span className="squad-block-count">{unassigned.length}</span></h2>
        <p className="squad-block-hint">Off duty until assigned to a squad.</p>
        <ul className="bench-list">
          {unassigned.map((o) => <BenchRow key={o.id} o={o} squads={g.squads} onOpen={() => setOfficerId(o.id)} />)}
        </ul>
      </section>}

      <RosterGrid onOpen={setOfficerId} />

      <Recruit />
      <OfficerSheet officerId={officerId} onClose={() => setOfficerId(null)} />
      {arranging && <SquadOptimizer open onClose={() => setArranging(false)} />}
      </>}
    </div>
  );
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
    // Only an explicit edit/save/cancel moves focus. Returning to a squad keeps it on the tab.
    const target = requestedFocus.current === 'input' ? renameInput.current : requestedFocus.current === 'button' ? renameButton.current : null;
    target?.focus({ preventScroll: true });
    requestedFocus.current = null;
  }, [renaming]);
  const finishRename = () => {
    requestedFocus.current = 'button';
    nav.updateSquadView({ type: 'finishRename', squadId: squad.id });
  };
  const members = squad.officerIds.map((id) => g.officers[id]).filter((o): o is Officer => !!o);
  const leader = squad.leaderId ? g.officers[squad.leaderId] : undefined;
  const slots = Math.max(4, members.length);
  const deployed = g.activeRun?.squadIds.includes(squad.id) && g.activeRun.status !== 'closed';
  const duty = DUTY_META[squad.duty];
  const total = r.total || members.length;

  return (
    <section className="card squadpanel" aria-label={`Squad ${squad.id}`}>
      <div className="squadpanel-head">
        <span className="squad-badge squad-badge-lg">{squad.id}</span>
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
            <div className="squadpanel-name">
              <strong>{squad.name}</strong>
              <span className="squadpanel-facts">
                <span className="squadpanel-duty"><Icon name={duty.icon} size={13} />{duty.label}</span>
                {leader && <span className="squadpanel-lead"><Icon name="star" size={12} />{leader.surname}</span>}
              </span>
            </div>
            <span className="squad-ready" role="img" aria-label={`${r.ready} of ${total} ready`}>
              <span className="squad-ready-pips" aria-hidden="true">{members.map((o) => <i key={o.id} className={recoveryInfo(g, o.id, Math.max(now, g.department.clockHighWater)).blocker === null ? 'on' : ''} />)}</span>
              <b>{r.ready}/{total}</b>
            </span>
            <button ref={renameButton} type="button" className="icon-btn" aria-label={`Rename ${squad.name}`} onClick={() => {
              requestedFocus.current = 'input';
              nav.updateSquadView({ type: 'rename', squadId: squad.id, name: squad.name });
            }}>
              <Icon name="edit" size={18} />
            </button>
          </>
        )}
      </div>
      <div className="chips squadpanel-state">
        {deployed ? <OfficerStatusChip status="deployed" /> : r.deployable ? <Chip tone="mint" icon="checkcircle">Deployable</Chip> : <Chip tone="warn" icon="warning">Not deployable</Chip>}
        {r.issues.slice(0, 2).map((i, k) => (
          <Chip key={k} tone="warn">
            {i}
          </Chip>
        ))}
      </div>
      <div className="ogrid ogrid-tiles">
        {Array.from({ length: slots }).map((_, i) => {
          const o = members[i];
          return o ? (
            <OfficerCard key={o.id} officer={o} now={now} variant="tile" leader={o.id === squad.leaderId} onClick={() => onOpen(o.id)} />
          ) : (
            <div key={`empty-${i}`} className="oslot oslot-tile" role="img" aria-label="Open slot">
              <Icon name="plus" size={18} />
              <span>Open</span>
            </div>
          );
        })}
      </div>
      <SquadCoverageStrip members={members} />
    </section>
  );
}

/** Roles held and the best rating in the squad for each skill, as shapes. */
export function SquadCoverageStrip({ members }: { members: Officer[] }) {
  const coverage = squadCoverage(members);
  if (!members.length) return null;
  return (
    <div className="squad-coverage">
      <div className="squad-coverage-group"><span className="squad-coverage-label" aria-hidden="true">Roles</span><ul className="squad-roles" aria-label="Roles in this squad">
        {coverage.roles.map(({ role, count }) => (
          <li key={role} className={count ? 'on' : ''} title={ROLE_META[role].label} aria-label={`${ROLE_META[role].label}: ${count ? count : 'none'}`}>
            <Icon name={ROLE_META[role].icon} size={15} />
            {count > 1 && <b aria-hidden="true">{count}</b>}
          </li>
        ))}
      </ul></div>
      <div className="squad-coverage-group"><span className="squad-coverage-label" aria-hidden="true">Best skill</span><ul className="squad-best" aria-label="Best rating in the squad for each skill">
        {coverage.best.map(({ key, value }) => {
          const meta = RATING_META.find((entry) => entry.key === key)!;
          return (
            <li key={key} aria-label={`${meta.label} best ${value}`} title={meta.label}>
              <Icon name={meta.icon} size={12} />
              <span className={`squad-best-bar meter-${ratingTone(value)}`} aria-hidden="true"><i style={{ height: `${Math.max(6, value)}%` }} /></span>
              <b aria-hidden="true">{value}</b>
            </li>
          );
        })}
      </ul></div>
    </div>
  );
}

function BenchRow({ o, squads, onOpen }: { o: Officer; squads: Squad[]; onOpen: () => void }) {
  const { act } = useToast();
  return (
    <li className="bench-row">
      <button type="button" className="bench-open" onClick={onOpen} aria-label={`${o.firstName} ${o.surname}, ${ROLE_META[o.role].label}. Open file`}>
        <span className="bench-face"><Portrait officer={o} size={40} /></span>
        <span className="bench-name">
          <strong>{o.surname}</strong>
          <span><Icon name={ROLE_META[o.role].icon} size={12} />{ROLE_META[o.role].short}</span>
        </span>
        <StressDisplay value={o.stress} compact />
      </button>
      <span className="bench-assign">
        {squads.map((s) => (
          <button key={s.id} type="button" className="bench-add" aria-label={`Add ${o.surname} to squad ${s.id}`} onClick={() => act({ type: 'assignToSquad', officerId: o.id, squadId: s.id })}>
            <Icon name="plus" size={12} />{s.id}
          </button>
        ))}
      </span>
    </li>
  );
}

/** Every officer in one dense grid, with squad letters, so the whole department reads at a glance. */
function RosterGrid({ onOpen }: { onOpen: (id: Id) => void }) {
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
      <div className="squad-roster-head">
        <h2 id="squad-roster-h" className="squad-block-title"><Icon name="people" size={16} />Roster <span className="squad-block-count">{officers.length}/{g.department.rosterCap}</span></h2>
        <label className="squad-sort">
          <span className="sr-only">Sort roster</span>
          <Icon name="list" size={14} />
          <select value={sort} onChange={(event) => setSort(event.target.value as RosterSort)}>
            {(Object.keys(ROSTER_SORT_LABEL) as RosterSort[]).map((value) => <option key={value} value={value}>{ROSTER_SORT_LABEL[value]}</option>)}
          </select>
        </label>
      </div>
      <ChoiceRail value={filter} label="Show officers" grow onChange={setFilter} options={(Object.keys(ROSTER_FILTER_LABEL) as RosterFilter[]).map((value) => ({
        value, accessibleLabel: `${ROSTER_FILTER_LABEL[value]}, ${count(value)}`, label: <>{ROSTER_FILTER_LABEL[value]}<span className="choice-rail-count">{count(value)}</span></>,
      }))} />
      {shown.length === 0 ? <p className="squad-block-hint">No officers here.</p> : <div className="ogrid ogrid-tiles">
        {shown.map((o) => <OfficerCard key={o.id} officer={o} now={now} variant="tile" squadId={o.squadId} leader={leaders.has(o.id)} onClick={() => onOpen(o.id)} />)}
      </div>}
    </section>
  );
}
