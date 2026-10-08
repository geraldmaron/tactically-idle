import { useState } from 'react';
import { COURSES } from '../../content/courses';
import { COMMAND_STAFF, commandStaffOf, managerView, managerViews, type ManagerId, type ManagerView } from '../../sim/command-staff';
import { isNodeUnlocked, squadDeployed } from '../../sim/economy';
import { EQUIPMENT_MANAGER, equipmentManagerBenefits, maintenanceBudget } from '../../sim/equipment-manager-policy';
import type { GameState, SquadId } from '../../sim/types';
import { ManagerPortrait } from '../art/ManagerArt';
import { money, moneyFull, perHour, relativeTime } from '../format';
import { Icon, type IconName } from '../icons';
import { useGame } from '../store';
import { ChoiceRail } from './ChoiceRail';
import { DUTY_META } from './labels';
import { useNav } from './nav';
import { Sheet } from './Sheet';
import { useToast } from './toast';
import { Button, Chip } from './ui';
import './command-staff.css';

const LOOP_ICON: Record<ManagerId, IconName> = { watch_commander: 'patrol', training_sergeant: 'mortarboard', quartermaster: 'wrench' };
const STATUS_LABEL: Record<ManagerView['status'], string> = { on: 'On', off: 'Off', not_hired: 'Not hired' };

/** HQ roster of hireable managers: a face, a status pill, the loop each automates and its latest action. */
export function CommandStaff() {
  const g = useGame();
  const [openId, setOpenId] = useState<ManagerId | null>(null);
  const now = Date.now();
  const views = managerViews(g);
  const hired = views.filter((view) => view.hired).length;
  return <section className="command-staff" aria-labelledby="command-staff-title">
    <div className="section-head">
      <h2 id="command-staff-title" className="section-title"><Icon name="people" size={18} />Command staff</h2>
      <span className="command-staff-count" aria-label={`${hired} of ${views.length} hired`}>{hired}/{views.length}</span>
    </div>
    <div className="staff-grid">
      {views.map((view) => <StaffCard key={view.profile.id} view={view} now={now} open={openId === view.profile.id} onOpen={() => setOpenId(view.profile.id)} />)}
    </div>
    {openId && <ManagerSheet id={openId} g={g} now={now} onClose={() => setOpenId(null)} />}
  </section>;
}

function StaffCard({ view, now, open, onOpen }: { view: ManagerView; now: number; open: boolean; onOpen: () => void }) {
  const { profile, status } = view;
  const latest = view.log[0];
  return <button type="button" className={`staff-card staff-card-${status}`} onClick={onOpen} aria-haspopup="dialog" aria-expanded={open}
    aria-label={`${profile.title} ${profile.name}: ${STATUS_LABEL[status]}. Automating ${profile.loop.toLowerCase()}. ${latest ? latest.text : view.activity}`}>
    <span className="staff-card-art">
      <ManagerPortrait id={profile.id} size={64} hired={view.hired} />
      <span className={`staff-pill staff-pill-${status}`}>{STATUS_LABEL[status]}</span>
    </span>
    <strong className="staff-card-title">{profile.title}</strong>
    <span className="staff-card-name">{profile.name}</span>
    <span className="staff-card-loop"><Icon name={LOOP_ICON[profile.id]} size={13} /><span><span className="sr-only">Automating: </span>{profile.loop}</span></span>
    <span className="staff-card-log">{latest ? <>{latest.text}<span className="staff-card-when"> · {relativeTime(latest.at, now)}</span></> : view.activity}</span>
  </button>;
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`staff-switch${on ? ' staff-switch-on' : ''}`} onClick={() => onChange(!on)}>
    <span className="staff-switch-track" aria-hidden="true"><span className="staff-switch-knob" /></span>
  </button>;
}

export function ManagerSheet({ id, g, now, onClose, inGear = false }: { id: ManagerId; g: GameState; now: number; onClose: () => void; inGear?: boolean }) {
  const view = managerView(g, id);
  const { profile } = view;
  const { act } = useToast();
  const nav = useNav();
  return <Sheet open onClose={onClose} title={profile.title} subtitle={profile.name} className="staff-sheet">
    <div className="stack staff-detail">
      <div className="staff-hero">
        <ManagerPortrait id={id} size={84} hired={view.hired} />
        <div className="staff-hero-main">
          <span className={`staff-pill staff-pill-${view.status}`}>{STATUS_LABEL[view.status]}</span>
          <p className="staff-hero-loop"><Icon name={LOOP_ICON[id]} size={15} />Automates {profile.loop.toLowerCase()}</p>
          <p className="dim">{profile.salaryPerHour > 0 ? `Salary ${perHour(profile.salaryPerHour)} while on, paid with payroll` : 'No salary: pays only for the servicing it orders'}</p>
        </div>
      </div>
      <p>{profile.duty}</p>
      <p className="dim staff-never"><Icon name="shield" size={14} />{profile.never}</p>
      {!view.hired ? <HireCard view={view} onHire={() => { onClose(); nav.openDevelopment(profile.nodeId); }} /> : <>
        <div className="staff-switch-row">
          <span><strong>{view.on ? 'On duty' : 'Off duty'}</strong><span className="dim">{view.activity}</span></span>
          <Switch on={view.on} label={`${profile.title} on duty`} onChange={(on) => act({ type: 'setManagerEnabled', managerId: id, enabled: on }, `${profile.title} ${on ? 'on duty' : 'off duty'}`)} />
        </div>
        {id === 'watch_commander' && <WatchCommanderPolicy g={g} />}
        {id === 'training_sergeant' && <TrainingSergeantPolicy g={g} />}
        {id === 'quartermaster' && <QuartermasterPolicy g={g} onOpenGear={inGear ? undefined : () => { onClose(); nav.setGearSection('inventory'); }} />}
      </>}
      <section className="staff-log" aria-label={`${profile.title} activity log`}>
        <h3>Activity log</h3>
        {view.log.length ? <ol>{view.log.map((entry, index) => <li key={`${entry.at}-${index}`}><span>{entry.text}</span><time className="dim">{relativeTime(entry.at, now)}</time></li>)}</ol>
          : <p className="dim">{view.hired ? 'Nothing yet. Actions appear here after each clock-hour check.' : 'Actions appear here once hired.'}</p>}
      </section>
    </div>
  </Sheet>;
}

function HireCard({ view, onHire }: { view: ManagerView; onHire: () => void }) {
  return <div className="staff-hire">
    {view.hire && <div className="chips"><Chip icon="chart">{view.hire.dp} DP</Chip><Chip icon="cash">{moneyFull(view.hire.funding)}</Chip></div>}
    {view.hire?.reason && <p className="reason">{view.hire.reason}</p>}
    <Button variant="primary" block onClick={onHire}>Hire in Develop</Button>
  </div>;
}

function WatchCommanderPolicy({ g }: { g: GameState }) {
  const { act } = useToast();
  const policy = commandStaffOf(g).watch_commander.policy;
  const { restChoices, returnBelow } = COMMAND_STAFF.watchCommander;
  const choices = [...new Set([...restChoices, policy.restAt])].sort((a, b) => a - b);
  const setOptOut = (squadId: SquadId, managed: boolean) => {
    const optOut = managed ? policy.optOut.filter((id) => id !== squadId) : [...policy.optOut, squadId];
    act({ type: 'setManagerPolicy', patch: { managerId: 'watch_commander', optOut } }, managed ? 'Squad duty handed to the Watch Commander' : 'Squad kept on manual duty');
  };
  return <div className="staff-policy">
    <h3>Rest a squad when anyone reaches</h3>
    <ChoiceRail label="Stress limit" grow value={String(policy.restAt)} onChange={(value) => act({ type: 'setManagerPolicy', patch: { managerId: 'watch_commander', restAt: Number(value) } }, `Rests squads at ${value} stress`)}
      options={choices.map((value) => ({ value: String(value), label: <>{value}<span className="dim">{value === 30 ? ' Strained' : value === 60 ? ' Overloaded' : ''}</span></>, accessibleLabel: `${value} stress` }))} />
    <p className="dim">Rested squads go back to their earlier duty (Patrol if unknown) once everyone is below {returnBelow}.</p>
    <h3>Squads</h3>
    {g.squads.length === 0 ? <p className="dim">No squads yet.</p> : <ul className="staff-squads">
      {g.squads.map((squad) => {
        const managed = !policy.optOut.includes(squad.id);
        const deployed = squadDeployed(g, squad.id);
        return <li key={squad.id}>
          <span className="squad-badge">{squad.id}</span>
          <span className="staff-squad-main"><strong>{squad.name}</strong><span className="dim"><Icon name={DUTY_META[squad.duty].icon} size={13} />{deployed ? 'Deployed: not touched' : DUTY_META[squad.duty].label}{managed ? '' : ' · manual'}</span></span>
          <Switch on={managed} label={`Watch Commander manages ${squad.name}`} onChange={(on) => setOptOut(squad.id, on)} />
        </li>;
      })}
    </ul>}
  </div>;
}

function TrainingSergeantPolicy({ g }: { g: GameState }) {
  const { act } = useToast();
  const nav = useNav();
  const policy = commandStaffOf(g).training_sergeant.policy;
  const courses = Object.values(COURSES).filter((course) => !course.requiresNode || isNodeUnlocked(g, course.requiresNode));
  const { reserveChoices } = COMMAND_STAFF.trainingSergeant;
  const reserves = [...new Set([...reserveChoices, policy.reserve])].sort((a, b) => a - b);
  return <div className="staff-policy">
    <label className="field">
      <span className="field-label">Course to fill places with</span>
      <select value={policy.courseId ?? ''} onChange={(event) => {
        const courseId = event.target.value || null;
        act({ type: 'setManagerPolicy', patch: { managerId: 'training_sergeant', courseId } }, courseId ? `Enrolling officers in ${COURSES[courseId].name}` : 'No course chosen');
      }}>
        <option value="">Choose a course</option>
        {courses.map((course) => <option key={course.id} value={course.id}>{course.name} · {course.hours}h · {money(course.cost)}</option>)}
      </select>
    </label>
    <h3>Keep funding above</h3>
    <ChoiceRail label="Funding reserve" grow value={String(policy.reserve)} onChange={(value) => act({ type: 'setManagerPolicy', patch: { managerId: 'training_sergeant', reserve: Number(value) } }, `Keeps ${moneyFull(Number(value))} in reserve`)}
      options={reserves.map((value) => ({ value: String(value), label: money(value), accessibleLabel: `${moneyFull(value)} reserve` }))} />
    <p className="dim">Picks the officer with the lowest stress below Strained who meets the course rules: not deployed, injured or already training.</p>
    <Button size="sm" onClick={() => nav.openTraining()}>Open Training</Button>
  </div>;
}

function QuartermasterPolicy({ g, onOpenGear }: { g: GameState; onOpenGear?: () => void }) {
  const { act } = useToast();
  const current = maintenanceBudget(g) || commandStaffOf(g).quartermaster.resumeBudget;
  const options = [...new Set([50, 100, 200, 300, 500, current])].sort((a, b) => a - b);
  const benefits = equipmentManagerBenefits(g);
  return <div className="staff-policy">
    <p className="staff-benefits">Tier {benefits.tier}: {Math.round((1 - benefits.repairMultiplier) * 100)}% cheaper servicing and {Math.round((1 - benefits.wearMultiplier) * 100)}% less wear on reusable equipment. Starts a job only while fewer than {benefits.maxConcurrentServices} repairs are underway, counting manual jobs.</p>
    <label className="field">
      <span className="field-label">Hourly service spending ceiling</span>
      <select value={current} onChange={(event) => act({ type: 'setManagerPolicy', patch: { managerId: 'quartermaster', budgetPerHour: Number(event.target.value) } }, `Service ceiling ${money(Number(event.target.value))}/hour`)}>
        {options.map((value) => <option key={value} value={value}>{money(value)}/hour maximum</option>)}
      </select>
    </label>
    <p className="dim">Services idle gear below {EQUIPMENT_MANAGER.serviceBelow}% condition and keeps {moneyFull(EQUIPMENT_MANAGER.fundingReserve)} in reserve. Restock rules set: {g.department.restockRules.length || 'none'}.</p>
    {onOpenGear && <Button size="sm" onClick={onOpenGear}>Open Gear maintenance</Button>}
  </div>;
}
