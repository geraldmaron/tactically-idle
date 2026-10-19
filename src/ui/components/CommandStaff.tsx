import { useState } from 'react';
import { COURSES } from '../../content/courses';
import { COMMAND_STAFF, MANAGERS, commandStaffOf, leverLines, managerView, managerViews, staffHireCheck, staffRefreshAt, staffSeverance, type ManagerId, type ManagerView } from '../../sim/command-staff';
import { courseFee, staffLever, type StaffArchetype, type StaffCandidate } from '../../sim/staff-pool';
import { netRate } from '../../sim/economy';
import { simNow } from '../../sim/calendar';
import { isNodeUnlocked } from '../../sim/economy';
import { squadDeployed } from '../../sim/squads';
import { EQUIPMENT_MANAGER, equipmentManagerBenefits, maintenanceBudget } from '../../sim/equipment-manager-policy';
import type { GameState, Role, SquadId } from '../../sim/types';
import { ROLES } from '../../content/recruits';
import { ManagerPortrait } from '../art/ManagerArt';
import { duration, money, moneyFull, perHour, rate, relativeTime } from '../format';
import { Icon, type IconName } from '../icons';
import { useGame } from '../store';
import { ChoiceRail } from './ChoiceRail';
import { DUTY_META, ROLE_META } from './labels';
import { useNav } from './nav';
import { Sheet } from './Sheet';
import { useToast } from './toast';
import { Button, Chip } from './ui';
import './command-staff.css';

const LOOP_ICON: Record<ManagerId, IconName> = { watch_commander: 'patrol', training_sergeant: 'mortarboard', quartermaster: 'wrench', peer_support_lead: 'heart', recruiter: 'people' };
const STATUS_LABEL: Record<ManagerView['status'], string> = { on: 'On', off: 'Off', not_hired: 'Not hired' };
const statusLabel = (view: ManagerView) => view.status === 'not_hired' && view.open ? 'Vacant' : STATUS_LABEL[view.status];
const personName = (view: ManagerView) => view.holder ? `${view.holder.person.firstName} ${view.holder.person.surname}` : null;
const ARCHETYPE: Record<StaffArchetype, { label: string; line: string }> = {
  seasoned: { label: 'Seasoned', line: 'Strong at both, costs the most' },
  specialist: { label: 'Specialist', line: 'Excellent at one, weak at the other' },
  steady: { label: 'Steady', line: 'Modest at both, costs the least' },
};

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
    <ul className="staff-list">
      {[...views].sort((x, y) => Number(y.hired) - Number(x.hired)).map((view) => <StaffCard key={view.profile.id} view={view} now={now} open={openId === view.profile.id} onOpen={() => setOpenId(view.profile.id)} />)}
    </ul>
    {openId && <ManagerSheet id={openId} g={g} now={now} onClose={() => setOpenId(null)} />}
  </section>;
}

function StaffCard({ view, now, open, onOpen }: { view: ManagerView; now: number; open: boolean; onOpen: () => void }) {
  const { profile, status } = view;
  const latest = view.log[0];
  return <li><button type="button" className={`staff-card staff-card-${status}`} onClick={onOpen} aria-haspopup="dialog" aria-expanded={open}
    aria-label={`${profile.title}${view.hired ? ` ${personName(view)}` : ', post vacant'}: ${statusLabel(view)}. Automating ${profile.loop.toLowerCase()}. ${latest ? latest.text : view.activity}`}>
    <ManagerPortrait person={view.holder?.person ?? null} size={44} />
    <span className="staff-card-main">
      <span className="staff-card-top">
        <strong className="staff-card-title">{profile.title}</strong>
        <span className={`staff-pill staff-pill-${status}${view.open && !view.hired ? ' staff-pill-vacant' : ''}`}>{statusLabel(view)}</span>
      </span>
      <span className="staff-card-loop"><Icon name={LOOP_ICON[profile.id]} size={13} /><span>{view.hired ? <>{personName(view)} · </> : <span className="staff-card-vacant">Post vacant · </span>}{profile.loop}</span></span>
      <span className="staff-card-log">{latest ? <>{latest.text}<span className="staff-card-when"> · {relativeTime(latest.at, now)}</span></> : view.activity}</span>
    </span>
    <Icon name="chevronRight" size={16} className="staff-card-go" />
  </button></li>;
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`staff-switch${on ? ' staff-switch-on' : ''}`} onClick={() => onChange(!on)}>
    <span className="staff-switch-track" aria-hidden="true"><span className="staff-switch-knob" /></span>
  </button>;
}

export function ManagerSheet({ id, g, now, onClose, inGear = false }: { id: ManagerId; g: GameState; now: number; onClose: () => void; inGear?: boolean }) {
  const view = managerView(g, id);
  const { profile, holder } = view;
  const { act } = useToast();
  const nav = useNav();
  return <Sheet open onClose={onClose} title={profile.title} subtitle={personName(view) ?? 'Post vacant'} className="staff-sheet">
    <div className="stack staff-detail">
      <div className="staff-hero">
        <ManagerPortrait person={holder?.person ?? null} size={84} />
        <div className="staff-hero-main">
          <span className={`staff-pill staff-pill-${view.status}${view.open && !view.hired ? ' staff-pill-vacant' : ''}`}>{statusLabel(view)}</span>
          <p className="staff-hero-loop"><Icon name={LOOP_ICON[id]} size={15} />Automates {profile.loop.toLowerCase()}</p>
          {holder && <p className="dim">{ARCHETYPE[holder.archetype].label} · {holder.salaryPerHour > 0 ? `${perHour(holder.salaryPerHour)} while on, paid with payroll` : 'No salary: pays only for the servicing it orders'}</p>}
        </div>
      </div>
      <p>{profile.duty}</p>
      <p className="dim staff-never"><Icon name="shield" size={14} />{profile.never}</p>
      {!view.open ? <HireCard view={view} onHire={() => { onClose(); nav.openDevelopment(profile.nodeId); }} />
        : !holder ? <CandidatePicker id={id} g={g} now={now} view={view} />
          : <>
            <LeverRows id={id} levers={holder.levers} />
            <div className="staff-switch-row">
              <span><strong>{view.on ? 'On duty' : 'Off duty'}</strong><span className="dim">{view.activity}</span></span>
              <Switch on={view.on} label={`${profile.title} on duty`} onChange={(on) => act({ type: 'setManagerEnabled', managerId: id, enabled: on }, `${profile.title} ${on ? 'on duty' : 'off duty'}`)} />
            </div>
            {id === 'watch_commander' && <WatchCommanderPolicy g={g} />}
            {id === 'training_sergeant' && <TrainingSergeantPolicy g={g} />}
            {id === 'peer_support_lead' && <PeerSupportPolicy g={g} />}
            {id === 'recruiter' && <RecruiterPolicy g={g} />}
            {id === 'quartermaster' && <QuartermasterPolicy g={g} onOpenGear={inGear ? undefined : () => { onClose(); nav.setGearSection('inventory'); }} />}
            <ReplaceCard id={id} g={g} name={personName(view)!} severance={staffSeverance(holder)} />
          </>}
      <section className="staff-log" aria-label={`${profile.title} activity log`}>
        <h3>Activity log</h3>
        {view.log.length ? <ol>{view.log.map((entry, index) => <li key={`${entry.at}-${index}`}><span>{entry.text}</span><time className="dim">{relativeTime(entry.at, now)}</time></li>)}</ol>
          : <p className="dim">{view.hired ? 'Nothing yet. Actions appear here after each clock-hour check.' : 'Actions appear here once someone is hired.'}</p>}
      </section>
    </div>
  </Sheet>;
}

/** The two levers that set this person apart, as a value and a bar from the post's low to high. */
function LeverRows({ id, levers }: { id: ManagerId; levers: [number, number] }) {
  return <ul className="staff-levers">
    {leverLines(id, levers).map((line) => <li key={line.label}>
      <span className="staff-lever-label">{line.label}</span>
      <strong>{line.value}</strong>
      <span className="staff-lever-bar" aria-hidden="true"><i style={{ width: `${Math.max(4, Math.round(line.position * 100))}%` }} /></span>
    </li>)}
  </ul>;
}

/** Three people for a vacant post, one of each kind, compared on the same rows. */
function CandidatePicker({ id, g, now, view }: { id: ManagerId; g: GameState; now: number; view: ManagerView }) {
  const { act } = useToast();
  const t = simNow(g);
  const refreshAt = staffRefreshAt(g, id);
  const net = netRate(g);
  return <section className="staff-pool" aria-label="Candidates">
    <div className="staff-pool-head">
      <h3>Choose who fills the post</h3>
      <Button size="sm" icon="refresh" disabled={t < refreshAt} onClick={() => act({ type: 'refreshStaffPool', managerId: id }, 'New candidates')}>
        {t < refreshAt ? `New search in ${duration(refreshAt - t)}` : 'Search again'}
      </Button>
    </div>
    {view.pool.length === 0 ? <p className="dim">Nobody is available for this post right now.</p>
      : <ul className="staff-candidates">{view.pool.map((candidate) => <CandidateCard key={candidate.id} id={id} g={g} candidate={candidate} net={net} now={now} />)}</ul>}
  </section>;
}

function CandidateCard({ id, g, candidate, net }: { id: ManagerId; g: GameState; candidate: StaffCandidate; net: number; now: number }) {
  const { act } = useToast();
  const { person } = candidate;
  const name = `${person.firstName} ${person.surname}`;
  const reason = staffHireCheck(g, id, candidate.id);
  const kind = ARCHETYPE[candidate.archetype];
  return <li className="staff-candidate">
    <div className="staff-candidate-head">
      <ManagerPortrait person={person} size={52} />
      <div className="staff-candidate-who">
        <strong>{name}</strong>
        <span className={`staff-archetype staff-archetype-${candidate.archetype}`}>{kind.label}</span>
        <span className="dim">{kind.line}</span>
      </div>
    </div>
    {person.note && <p className="staff-candidate-note">{person.note}</p>}
    <LeverRows id={id} levers={candidate.levers} />
    <div className="chips">
      {candidate.salaryPerHour > 0 && <Chip icon="cash">{perHour(candidate.salaryPerHour)} salary</Chip>}
      <Chip icon="cash">{moneyFull(candidate.signingCost)} to sign</Chip>
      {candidate.salaryPerHour > 0 && <Chip tone={net - candidate.salaryPerHour < 0 ? 'danger' : 'neutral'} icon="trend">Net after hire {rate(net - candidate.salaryPerHour)}</Chip>}
    </div>
    {reason && <p className="reason">{reason}</p>}
    <Button variant="primary" block disabled={!!reason} onClick={() => act({ type: 'hireStaff', managerId: id, candidateId: candidate.id }, `${name} hired as ${MANAGERS[id].title}`)}>Hire {person.firstName} · {moneyFull(candidate.signingCost)}</Button>
  </li>;
}

/** Let the person go and reopen the post; asks once, naming the severance. */
function ReplaceCard({ id, g, name, severance }: { id: ManagerId; g: GameState; name: string; severance: number }) {
  const { act } = useToast();
  const [confirming, setConfirming] = useState(false);
  const short = g.department.funding < severance;
  if (!confirming) return <Button size="sm" onClick={() => setConfirming(true)}>Replace {name.split(' ')[0]}</Button>;
  return <div className="staff-replace">
    <p>{name} leaves the post{severance ? ` with ${moneyFull(severance)} severance` : ''}, and three new candidates are offered.</p>
    <div className="row-actions">
      <Button size="sm" onClick={() => setConfirming(false)}>Keep {name.split(' ')[0]}</Button>
      <Button size="sm" variant="primary" disabled={short} onClick={() => { setConfirming(false); act({ type: 'dismissStaff', managerId: id }, `${name} left the post`); }}>{short ? `Needs ${moneyFull(severance)}` : 'Let them go'}</Button>
    </div>
  </div>;
}

function HireCard({ view, onHire }: { view: ManagerView; onHire: () => void }) {
  return <div className="staff-hire">
    {view.hire && <div className="chips"><Chip icon="chart">{view.hire.dp} DP</Chip>{view.hire.funding > 0 && <Chip icon="cash">{moneyFull(view.hire.funding)}</Chip>}</div>}
    {view.hire?.reason && <p className="reason">{view.hire.reason}</p>}
    <p className="dim">Opening the post puts three candidates on offer. You choose who to hire.</p>
    <Button variant="primary" block onClick={onHire}>Open the post in Develop</Button>
  </div>;
}

function WatchCommanderPolicy({ g }: { g: GameState }) {
  const { act } = useToast();
  const policy = commandStaffOf(g).watch_commander.policy;
  const { restChoices } = COMMAND_STAFF.watchCommander;
  const returnBelow = staffLever(g, 'watch_commander', 1) ?? COMMAND_STAFF.watchCommander.returnBelow;
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
        {courses.map((course) => <option key={course.id} value={course.id}>{course.name} · {course.hours}h · {money(courseFee(g, course.cost))}</option>)}
      </select>
    </label>
    <h3>Keep funding above</h3>
    <ChoiceRail label="Funding reserve" grow value={String(policy.reserve)} onChange={(value) => act({ type: 'setManagerPolicy', patch: { managerId: 'training_sergeant', reserve: Number(value) } }, `Keeps ${moneyFull(Number(value))} in reserve`)}
      options={reserves.map((value) => ({ value: String(value), label: money(value), accessibleLabel: `${moneyFull(value)} reserve` }))} />
    <p className="dim">Picks the officer with the lowest stress below Strained who meets the course rules: not deployed, injured or already training.</p>
    <Button size="sm" onClick={() => nav.openTraining()}>Open Training</Button>
  </div>;
}

function PeerSupportPolicy({ g }: { g: GameState }) {
  const { act } = useToast();
  const policy = commandStaffOf(g).peer_support_lead.policy;
  const { supportChoices, reserveChoices, sessionCost } = COMMAND_STAFF.peerSupportLead;
  const sessionsPerHour = staffLever(g, 'peer_support_lead', 0) ?? 0;
  const relief = staffLever(g, 'peer_support_lead', 1) ?? 0;
  const reserves = [...new Set([...reserveChoices, policy.reserve])].sort((a, b) => a - b);
  return <div className="staff-policy">
    <h3>Offer sessions at</h3>
    <ChoiceRail label="Stress to offer a session" grow value={String(policy.supportAt)} onChange={(value) => act({ type: 'setManagerPolicy', patch: { managerId: 'peer_support_lead', supportAt: Number(value) } }, `Offers sessions at ${value} stress`)}
      options={supportChoices.map((value) => ({ value: String(value), label: String(value), accessibleLabel: `${value} stress` }))} />
    <h3>Keep funding above</h3>
    <ChoiceRail label="Funding reserve" grow value={String(policy.reserve)} onChange={(value) => act({ type: 'setManagerPolicy', patch: { managerId: 'peer_support_lead', reserve: Number(value) } }, `Keeps ${moneyFull(Number(value))} in reserve`)}
      options={reserves.map((value) => ({ value: String(value), label: money(value), accessibleLabel: `${moneyFull(value)} reserve` }))} />
    <p className="dim">Up to {sessionsPerHour} {sessionsPerHour === 1 ? 'session' : 'sessions'} an hour, {money(sessionCost)} each, {relief} stress off. Only idle officers, most strained first.</p>
  </div>;
}

function RecruiterPolicy({ g }: { g: GameState }) {
  const { act } = useToast();
  const policy = commandStaffOf(g).recruiter.policy;
  const { reserveChoices } = COMMAND_STAFF.recruiter;
  const reserves = [...new Set([...reserveChoices, policy.reserve])].sort((a, b) => a - b);
  return <div className="staff-policy">
    <label className="field">
      <span className="field-label">Role to recruit</span>
      <select value={policy.role ?? ''} onChange={(event) => {
        const role = (event.target.value || null) as Role | null;
        act({ type: 'setManagerPolicy', patch: { managerId: 'recruiter', role } }, role ? `Recruiting ${ROLE_META[role].label}` : 'Recruiting any role');
      }}>
        <option value="">Any role</option>
        {ROLES.map((role) => <option key={role} value={role}>{ROLE_META[role].label}</option>)}
      </select>
    </label>
    <h3>Keep funding above</h3>
    <ChoiceRail label="Funding reserve" grow value={String(policy.reserve)} onChange={(value) => act({ type: 'setManagerPolicy', patch: { managerId: 'recruiter', reserve: Number(value) } }, `Keeps ${moneyFull(Number(value))} in reserve`)}
      options={reserves.map((value) => ({ value: String(value), label: money(value), accessibleLabel: `${moneyFull(value)} reserve` }))} />
    <p className="dim">Signs the candidate with the strongest ratings while the roster has room and the department stays in the black.</p>
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
