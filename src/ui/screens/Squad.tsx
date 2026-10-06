import { useLayoutEffect, useRef, useState } from 'react';
import { getState, useGame } from '../store';
import { squadReadiness } from '../../sim/department-selectors';
import type { Id, Officer, Squad, SquadId } from '../../sim/types';
import { Button, Card, Chip, EmptyState, Section, OfficerStatusChip } from '../components/ui';
import { OfficerCard } from '../components/OfficerCard';
import { CareerMini } from '../components/Career';
import { useToast } from '../components/toast';
import { DUTY_META } from '../components/labels';
import { Icon } from '../icons';
import { fullName } from '../../sim/officer';
import { SQUAD_IDS } from '../../sim/types';
import { OfficerSheet } from './OfficerSheet';
import { Recruit } from './Recruit';
import { officerList } from './helpers';
import { useNav } from '../components/nav';
import { TrainingStore } from '../storefront/TrainingStore';
import { SquadOptimizer } from './SquadOptimizer';
import { ChoiceRail } from '../components/ChoiceRail';

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
      <div className="squad-arrangement-entry"><Button onClick={() => { setOfficerId(null); setArranging(true); }} disabled={g.squads.length === 0}>Arrange squads</Button></div>
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

      <Section title="Unassigned officers" icon="user" hint="Not in any squad. They do not patrol or deploy until assigned.">
        {unassigned.length === 0 ? (
          <Card>
            <EmptyState icon="user" title="Everyone is in a squad" />
          </Card>
        ) : (
          <div className="ogrid">
            {unassigned.map((o) => (
              <UnassignedCard key={o.id} o={o} squads={g.squads} onOpen={() => setOfficerId(o.id)} />
            ))}
          </div>
        )}
      </Section>

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
              <span>
                {r.ready}/{r.total || members.length} ready · {DUTY_META[squad.duty].label}
                {leader ? ` · led by ${leader.surname}` : ''}
              </span>
            </div>
            <button ref={renameButton} type="button" className="icon-btn" aria-label={`Rename ${squad.name}`} onClick={() => {
              requestedFocus.current = 'input';
              nav.updateSquadView({ type: 'rename', squadId: squad.id, name: squad.name });
            }}>
              <Icon name="edit" size={18} />
            </button>
          </>
        )}
      </div>
      <div className="chips">
        {deployed ? <OfficerStatusChip status="deployed" /> : r.deployable ? <Chip tone="mint" icon="checkcircle">Deployable</Chip> : <Chip tone="warn" icon="warning">Not deployable</Chip>}
        {r.issues.slice(0, 2).map((i, k) => (
          <Chip key={k} tone="warn">
            {i}
          </Chip>
        ))}
      </div>
      <div className="ogrid ogrid-roster">
        {Array.from({ length: slots }).map((_, i) => {
          const o = members[i];
          return o ? (
            <OfficerCard key={o.id} officer={o} now={now} variant="roster" leader={o.id === squad.leaderId} onClick={() => onOpen(o.id)} footer={
                <>
                  <span className="ocard-sub">{fullName(o)}</span>
                  <CareerMini officer={o} />
                </>
              }
            />
          ) : (
            <div key={`empty-${i}`} className="oslot" aria-label="Open slot">
              <Icon name="plus" size={20} />
              <span>Open slot</span>
              <span className="dim">Assign from below</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function UnassignedCard({ o, squads, onOpen }: { o: Officer; squads: Squad[]; onOpen: () => void }) {
  const { act } = useToast();
  const now = Date.now();
  return (
    <div className="ucard">
      <OfficerCard officer={o} now={now} variant="roster" onClick={onOpen} footer={<CareerMini officer={o} />} />
      <div className="ucard-actions">
        {squads.map((s) => (
          <Button key={s.id} size="sm" aria-label={`Add ${o.surname} to squad ${s.id}`} onClick={() => act({ type: 'assignToSquad', officerId: o.id, squadId: s.id })}>
            + {s.id}
          </Button>
        ))}
      </div>
    </div>
  );
}
