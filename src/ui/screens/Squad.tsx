import { useEffect, useState } from 'react';
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

const DEFAULT_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta'];

export function SquadScreen() {
  const g = useGame();
  const nav = useNav();
  const [sel, setSel] = useState<SquadId | null>(g.squads[0]?.id ?? null);
  const [officerId, setOfficerId] = useState<Id | null>(null);
  const [creating, setCreating] = useState(false);
  const [arranging, setArranging] = useState(false);
  const { notify } = useToast();
  const full = g.squads.length >= SQUAD_IDS.length;
  const active = g.squads.find((s) => s.id === sel) ?? g.squads[0];

  useEffect(() => {
    if (!active && g.squads[0]) setSel(g.squads[0].id);
  }, [active, g.squads]);

  const unassigned = officerList(g).filter((o) => o.squadId === null);

  return (
    <div className="page squad-page">
      <nav className="player-sections" aria-label="Squad sections">
        <Button variant={nav.squadSection === 'roster' ? 'primary' : 'secondary'} aria-current={nav.squadSection === 'roster' ? 'page' : undefined} onClick={() => nav.setSquadSection('roster')}>Roster</Button>
        <Button variant={nav.squadSection === 'training' ? 'primary' : 'secondary'} aria-current={nav.squadSection === 'training' ? 'page' : undefined} onClick={() => nav.setSquadSection('training')}>Training</Button>
      </nav>
      {nav.squadSection === 'training' ? <TrainingStore /> : <>
      <div className="squad-arrangement-entry"><Button onClick={() => { setOfficerId(null); setArranging(true); }} disabled={g.squads.length === 0}>Arrange squads</Button></div>
      <div className={`squadtabs${g.squads.length >= 4 ? ' squadtabs-4' : ''}`} role="tablist" aria-label="Squads">
        {g.squads.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-label={`Squad ${s.id}, ${s.name}`}
            aria-selected={active?.id === s.id}
            className={`squadtab${active?.id === s.id ? ' squadtab-on' : ''}`}
            onClick={() => setSel(s.id)}
          >
            <b>{s.id}</b>
            <span>{s.name}</span>
          </button>
        ))}
        <button
          type="button"
          className={`squadtab squadtab-add${full ? ' squadtab-full' : ''}`}
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
          <span>Squad</span>
        </button>
      </div>
      {creating && <CreateSquad count={g.squads.length} onDone={(id) => { setCreating(false); if (id) setSel(id); }} />}

      {active ? (
        <SquadPanel squad={active} onOpen={setOfficerId} />
      ) : (
        <Card>
          <EmptyState icon="people" title="No squads yet">
            Create up to four squads, then assign officers to them.
          </EmptyState>
        </Card>
      )}

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

function SquadPanel({ squad, onOpen }: { squad: Squad; onOpen: (id: Id) => void }) {
  const g = useGame();
  const { act } = useToast();
  const now = Date.now();
  const r = squadReadiness(g, squad.id, now);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(squad.name);
  useEffect(() => setName(squad.name), [squad.name]);
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
            onSubmit={(e) => {
              e.preventDefault();
              if (act({ type: 'renameSquad', squadId: squad.id, name: name.trim() }, 'Squad renamed').ok) setRenaming(false);
            }}
          >
            <input aria-label="Squad name" value={name} maxLength={20} autoFocus onChange={(e) => setName(e.target.value)} />
            <Button type="submit" size="sm" variant="primary">
              Save
            </Button>
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
            <button type="button" className="icon-btn" aria-label={`Rename ${squad.name}`} onClick={() => setRenaming(true)}>
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
