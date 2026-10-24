import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import { PlateArt, plateUrl } from '../art/Plates';
import { duration, funding, fundingPerHour, moneyFull, perHour, relativeTime } from '../format';
import { Funds } from './Funds';
import { lastActionLine, seatPreview } from '../screens/team-model';
import { staffSignedBeat } from '../screens/team-beats';
import { useBeat } from './Beat';
import { Icon, type IconName } from '../icons';
import { useGame } from '../store';
import { ChoiceRail } from './ChoiceRail';
import { DUTY_META, ROLE_META } from './labels';
import { useNav } from './nav';
import { Sheet } from './Sheet';
import { useToast } from './toast';
import { Button, Chip, Section } from './ui';
import './command-staff.css';

export const LOOP_ICON: Record<ManagerId, IconName> = { watch_commander: 'patrol', training_sergeant: 'mortarboard', quartermaster: 'wrench', peer_support_lead: 'heart', recruiter: 'people' };
const STATUS_LABEL: Record<ManagerView['status'], string> = { on: 'On', off: 'Off', not_hired: 'Not hired' };
const statusLabel = (view: ManagerView) => view.status === 'not_hired' && view.open ? 'Vacant' : STATUS_LABEL[view.status];
const personName = (view: ManagerView) => view.holder ? `${view.holder.person.firstName} ${view.holder.person.surname}` : null;
const ARCHETYPE: Record<StaffArchetype, { label: string; line: string }> = {
  seasoned: { label: 'Seasoned', line: 'Strong at both, costs the most' },
  specialist: { label: 'Specialist', line: 'Excellent at one, weak at the other' },
  steady: { label: 'Steady', line: 'Modest at both, costs the least' },
};

/** The same posts and detail sheets support a compact list and Team's full command hierarchy. */
export function CommandStaff({ allPosts = false, composition = 'list', scene }: { allPosts?: boolean; composition?: 'list' | 'room'; scene?: (posts: ReactNode) => ReactNode } = {}) {
  const g = useGame();
  const nav = useNav();
  const [openId, setOpenId] = useState<ManagerId | null>(null);
  const [all, setAll] = useState(false);
  const now = Date.now();
  const views = [...managerViews(g)].sort((x, y) => Number(y.hired) - Number(x.hired) || Number(y.open) - Number(x.open));
  const hired = views.filter((view) => view.hired).length;
  const shown = allPosts || all ? views : views.slice(0, Math.min(views.length, hired + 1));
  // The room (canvas pass, 2026-10-24): every post as a compact seat in one strip, in the posts' own order,
  // each opening its sheet. What the posts do and cost sits below, in Working and Posts to fill.
  const posts = <div className="command-seats command-room-seats">{managerViews(g).map((view) => <CommandPost key={view.profile.id} view={view} onOpen={() => setOpenId(view.profile.id)} compact inRoom />)}</div>;
  return <section className="command-staff" aria-labelledby="command-staff-title">
    <div className={scene ? 'section-head sr-only' : 'section-head'}>
      <h2 id="command-staff-title" className="section-title">Command staff</h2>
      <span className="section-count">{hired} of {views.length} hired</span>
    </div>
    {composition === 'room' ? <>
      {scene ? scene(posts) : <div className="command-room" aria-label="Command room"><PlateArt src={plateUrl('scene_command_room')} />{posts}</div>}
      {hired > 0 && <WorkingPosts views={views.filter((view) => view.hired)} now={now} onOpen={setOpenId} />}
      {hired < views.length && <PostsToFill views={views.filter((view) => !view.hired)} g={g} onOpen={setOpenId} onBuild={(view) => nav.openDevelopment(view.profile.nodeId)} />}
    </> : <ul className="staff-list">
      {shown.map((view) => <StaffRow key={view.profile.id} view={view} now={now} open={openId === view.profile.id} onOpen={() => setOpenId(view.profile.id)} />)}
    </ul>}
    {composition === 'list' && shown.length < views.length && <button type="button" className="staff-more" onClick={() => setAll(true)}>Show all {views.length} posts</button>}
    {openId && <ManagerSheet id={openId} g={g} now={now} onClose={() => setOpenId(null)} />}
  </section>;
}

const COMMAND_POST_SHORT: Record<ManagerId, string> = { watch_commander: 'Watch Commander', training_sergeant: 'Train', quartermaster: 'Gear', peer_support_lead: 'Support', recruiter: 'Hiring' };
/** A post's state in a few words: who holds it and whether they are on duty, a vacancy, the price to
 * open it when it can be opened now, or that it is still locked (ManagerView, never assumed). */
export function postState(view: ManagerView): string {
  if (view.holder) return `${view.holder.person.firstName} · ${view.on ? 'On duty' : 'Off duty'}`;
  if (view.open) return 'Vacant';
  return view.hire && !view.hire.reason ? `Opens for ${funding(view.hire.funding)}` : 'Not open yet';
}

/** The one short line under a seat on HQ: duty, a vacancy, what building the post costs, or that it is locked. */
function compactState(view: ManagerView): string {
  if (view.holder) return view.on ? 'On duty' : 'Off duty';
  if (view.open) return 'Vacant';
  return view.hire && !view.hire.reason ? `Build · ${funding(view.hire.funding)}` : 'Locked';
}

function CommandPost({ view, onOpen, g, now = 0, primary = false, compact = false, inRoom = false }: { view: ManagerView; onOpen: () => void; g?: GameState; now?: number; primary?: boolean; compact?: boolean;
  /** A compact seat in Team's command room: it opens its post's sheet rather than the room. */
  inRoom?: boolean }) {
  // From its seat (station rebuild): a hired manager says what they last did; an empty seat says what the post
  // would do now, in words from the post's own duty text. HQ's compact seats keep to the one short state.
  const said = compact || !g ? null : view.holder ? (view.log[0] ? `${view.log[0].text}, ${relativeTime(view.log[0].at, now)}` : lastActionLine([], view.activity)) : seatPreview(g, view.profile.id, view.profile.duty);
  return <button type="button" className={`command-room-post command-room-post-${view.status}${view.open ? '' : ' command-room-post-closed'}${primary ? ' command-room-post-primary' : ''}${compact ? ' command-room-post-compact' : ''}`} onClick={onOpen} aria-label={`${view.profile.title}, ${personName(view) ?? (view.open ? 'vacant post' : 'post not open')}. ${postState(view)}. ${said ? `${said} ` : ''}${compact && !inRoom ? 'Open command' : 'Inspect post'}`} aria-haspopup={compact && !inRoom ? undefined : 'dialog'}>
    <span className="command-room-portrait"><ManagerPortrait person={view.holder?.person ?? null} size={compact ? 40 : primary ? 80 : 52} emptyIcon={LOOP_ICON[view.profile.id]} /></span>
    <strong>{compact && view.profile.id === 'watch_commander' ? 'Watch' : compact ? COMMAND_POST_SHORT[view.profile.id] : view.profile.title}</strong>
    <span className="command-room-state">{compact && !view.holder && !view.open && view.hire && !view.hire.reason ? <>Build · <Funds value={view.hire.funding} /></> : compact ? compactState(view) : postState(view)}</span>
    {said && <span className="command-room-said">{said}</span>}
  </button>;
}

/** Every command post as one row of seats, for HQ: the holder's face, or the post's own icon on an
 * empty seat, and its state. Each opens Team's command room. */
export function CommandSeats({ views, onOpen }: { views: ManagerView[]; onOpen: () => void }) {
  return <div className="command-seats">{views.map((view) => <CommandPost key={view.profile.id} view={view} onOpen={onOpen} compact />)}</div>;
}

function StaffRow({ view, now, open, onOpen }: { view: ManagerView; now: number; open: boolean; onOpen: () => void }) {
  const { profile, status } = view;
  const latest = view.log[0];
  const detail = view.hired ? `${personName(view)}${status === 'off' ? ', off duty' : ''} · ${latest ? `${latest.text}, ${relativeTime(latest.at, now)}` : view.activity}` : view.open ? `Post vacant · ${view.activity}` : view.activity;
  return <li><button type="button" className={`ui-row staff-row staff-row-${status}`} onClick={onOpen} aria-haspopup="dialog" aria-expanded={open}
    aria-label={`${profile.title}${view.hired ? ` ${personName(view)}` : ', post vacant'}: ${statusLabel(view)}. Automating ${profile.loop.toLowerCase()}. ${latest ? latest.text : view.activity}`}>
    <span className="ui-row-lead"><ManagerPortrait person={view.holder?.person ?? null} size={60} /></span>
    <span className="ui-row-main" aria-hidden="true">
      <span className="ui-row-title">{profile.title}</span>
      <span className={`staff-pill staff-pill-${status}${view.open && !view.hired ? ' staff-pill-vacant' : ''}`}>{statusLabel(view)}</span>
      <span className="ui-row-detail">{detail}</span>
    </span>
    <span className="ui-row-trail" aria-hidden="true"><Icon name="chevronRight" size={16} /></span>
  </button></li>;
}

/** "1 open · 2 to build · 2 locked", leaving out the parts that are zero. */
function fillCount(views: ManagerView[]): string {
  const open = views.filter((view) => view.open).length;
  const build = views.filter((view) => !view.open && !!view.hire && !view.hire.reason).length;
  const locked = views.length - open - build;
  return [open && `${open} open`, build && `${build} to build`, locked && `${locked} locked`].filter(Boolean).join(' · ');
}

/** Every post nobody holds, as one row each (canvas pass, 2026-10-24): the post's own icon, its state and what
 * it would do now in its own duty words, and the one move it allows: choose a candidate for an open post, open
 * it in Build for its price, or wait while it is locked. The row opens the post's sheet. */
function PostsToFill({ views, g, onOpen, onBuild }: { views: ManagerView[]; g: GameState; onOpen: (id: ManagerId) => void; onBuild: (view: ManagerView) => void }) {
  return <Section className="command-working command-fill" id="command-fill-h" level="h3" title="Posts to fill" icon="officers" count={fillCount(views)} well>
    <ul className="command-working-list" data-ui-list>{views.map((view) => {
      const buildable = !view.open && !!view.hire && !view.hire.reason;
      return <li key={view.profile.id} className={`command-working-row${view.open || buildable ? '' : ' command-fill-locked'}`}>
        <button type="button" className="command-working-open" onClick={() => onOpen(view.profile.id)} aria-haspopup="dialog" aria-label={`${view.profile.title}. ${postState(view)}. Inspect post`}>
          <ManagerPortrait person={null} size={44} emptyIcon={LOOP_ICON[view.profile.id]} />
          <span className="command-working-main">
            <strong>{view.profile.title}</strong>
            {view.open && <span className="command-working-detail">{postState(view)}</span>}
            <span className="command-working-said">{seatPreview(g, view.profile.id, view.profile.duty)}</span>
          </span>
        </button>
        {view.open ? <Button size="sm" variant="primary" className="command-fill-action" onClick={() => onOpen(view.profile.id)}>Choose</Button>
          : buildable ? <Button size="sm" className="command-fill-action" onClick={() => onBuild(view)} aria-label={`Open the ${view.profile.title} post in Build for ${funding(view.hire!.funding)}`}>Open · <Funds value={view.hire!.funding} /></Button>
          : <span className="command-fill-action"><Chip icon="lock">Locked</Chip></span>}
      </li>;
    })}</ul>
  </Section>;
}

/** The posts at work, under the room (canvas pass, 2026-10-24): each hired post as one row with its
 * holder, the loop it runs and its cost, a switch for duty, and the last thing it did. The row opens the
 * post's sheet for its policy and log; the switch works in place. */
function WorkingPosts({ views, now, onOpen }: { views: ManagerView[]; now: number; onOpen: (id: ManagerId) => void }) {
  const { act } = useToast();
  return <Section className="command-working" id="command-working-h" level="h3" title="Working" icon="ready" tone="act" count={`${views.length} on post`} well>
    <ul className="command-working-list" data-ui-list>{views.map((view) => {
      const latest = view.log[0];
      const salary = view.holder?.salaryPerHour ?? 0;
      return <li key={view.profile.id} className={`command-working-row${view.on ? '' : ' command-working-off'}`}>
        <button type="button" className="command-working-open" onClick={() => onOpen(view.profile.id)} aria-haspopup="dialog" aria-label={`${view.profile.title}, ${personName(view)}. ${statusLabel(view)}. Open its policy and log`}>
          <ManagerPortrait person={view.holder?.person ?? null} size={44} />
          <span className="command-working-main">
            <strong>{view.profile.title}</strong>
            <span className="command-working-detail">{view.profile.loop}{salary > 0 ? <> · <Funds value={salary} format="perHour" /></> : null}</span>
            <span className="command-working-said">{latest ? `${latest.text}, ${relativeTime(latest.at, now)}` : view.activity}</span>
          </span>
        </button>
        <Switch on={view.on} label={`${view.profile.title} on duty`} onChange={(on) => act({ type: 'setManagerEnabled', managerId: view.profile.id, enabled: on }, `${view.profile.title} ${on ? 'on duty' : 'off duty'}`)} />
      </li>;
    })}</ul>
  </Section>;
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
  const [hireReceipt, setHireReceipt] = useState<string | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (hireReceipt) heroRef.current?.scrollIntoView({ block: 'start' }); }, [hireReceipt]);
  return <Sheet open onClose={onClose} title={profile.title} subtitle={personName(view) ?? 'Post vacant'} className="staff-sheet">
    <div className="stack staff-detail">
      <div ref={heroRef} className="staff-hero">
        <ManagerPortrait person={holder?.person ?? null} size={108} />
        <div className="staff-hero-main">
          <span className={`staff-pill staff-pill-${view.status}${view.open && !view.hired ? ' staff-pill-vacant' : ''}`}>{statusLabel(view)}</span>
          <p className="staff-hero-loop"><Icon name={LOOP_ICON[id]} size={16} />Automates {profile.loop.toLowerCase()}</p>
          {holder && <p className="dim">{ARCHETYPE[holder.archetype].label} · {holder.salaryPerHour > 0 ? <><Funds value={holder.salaryPerHour} format="perHour" /> while on, paid with payroll</> : 'No salary: pays only for the servicing it orders'}</p>}
        </div>
      </div>
      {hireReceipt && <p className="staff-hire-receipt" role="status"><Icon name="check" size={20} />{hireReceipt}</p>}
      <section className="staff-duty" aria-label="What the post does">
        <p className="staff-duty-text">{profile.duty}</p>
        <p className="staff-never"><Icon name="shield" size={16} />{profile.never}</p>
      </section>
      {!view.open ? <HireCard view={view} onHire={() => { onClose(); nav.openDevelopment(profile.nodeId); }} />
        : !holder ? <CandidatePicker id={id} g={g} now={now} view={view} onHired={setHireReceipt} />
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
            {id === 'quartermaster' && <QuartermasterPolicy g={g} onOpenGear={inGear ? undefined : () => { onClose(); nav.go('gear'); }} />}
            <ReplaceCard id={id} g={g} name={personName(view)!} severance={staffSeverance(holder)} />
          </>}
      <section className="staff-log" aria-label={`${profile.title} activity log`}>
        <h3><Icon name="list" size={16} />Activity log</h3>
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
function CandidatePicker({ id, g, now, view, onHired }: { id: ManagerId; g: GameState; now: number; view: ManagerView; onHired: (message: string) => void }) {
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
      : <ul className="staff-candidates">{view.pool.map((candidate) => <CandidateCard key={candidate.id} id={id} g={g} candidate={candidate} net={net} now={now} onHired={onHired} />)}</ul>}
  </section>;
}

function CandidateCard({ id, g, candidate, net, onHired }: { id: ManagerId; g: GameState; candidate: StaffCandidate; net: number; now: number; onHired: (message: string) => void }) {
  const beat = useBeat();
  const { person } = candidate;
  const name = `${person.firstName} ${person.surname}`;
  const reason = staffHireCheck(g, id, candidate.id);
  const kind = ARCHETYPE[candidate.archetype];
  return <li className="staff-candidate">
    <div className="staff-candidate-head">
      <ManagerPortrait person={person} size={76} />
      <div className="staff-candidate-who">
        <strong>{name}</strong>
        <span className={`staff-archetype staff-archetype-${candidate.archetype}`}>{kind.label}</span>
        <span className="dim">{kind.line}</span>
      </div>
    </div>
    {person.note && <p className="staff-candidate-note">{person.note}</p>}
    <LeverRows id={id} levers={candidate.levers} />
    <div className="chips">
      {candidate.salaryPerHour > 0 && <Chip icon="funds">{perHour(candidate.salaryPerHour)} salary</Chip>}
      <Chip icon="funds">{moneyFull(candidate.signingCost)} to sign</Chip>
      {candidate.salaryPerHour > 0 && <Chip tone={net - candidate.salaryPerHour < 0 ? 'danger' : 'neutral'} icon="trend">Net after hire <Funds value={net - candidate.salaryPerHour} format="rate" /></Chip>}
    </div>
    {reason && <p className="reason">{reason}</p>}
    <Button variant="primary" block disabled={!!reason} onClick={() => {
      // SIGNED replaces the success toast; the sheet still keeps its receipt line.
      const result = beat.act({ type: 'hireStaff', managerId: id, candidateId: candidate.id }, staffSignedBeat(person, MANAGERS[id].title));
      if (result.ok) onHired(`${name} hired as ${MANAGERS[id].title}`);
    }}>Hire {person.firstName} · <Funds value={candidate.signingCost} format="full" /></Button>
  </li>;
}

/** Let the person go and reopen the post; asks once, naming the severance. */
function ReplaceCard({ id, g, name, severance }: { id: ManagerId; g: GameState; name: string; severance: number }) {
  const { act } = useToast();
  const [confirming, setConfirming] = useState(false);
  const short = g.department.funding < severance;
  if (!confirming) return <Button size="sm" onClick={() => setConfirming(true)}>Replace {name.split(' ')[0]}</Button>;
  return <div className="staff-replace">
    <p>{name} leaves the post{severance ? ` with ${funding(severance)} as severance` : ''}, and three new candidates are offered.</p>
    <div className="row-actions">
      <Button size="sm" onClick={() => setConfirming(false)}>Keep {name.split(' ')[0]}</Button>
      <Button size="sm" variant="primary" disabled={short} onClick={() => { setConfirming(false); act({ type: 'dismissStaff', managerId: id }, `${name} left the post`); }}>{short ? <>Needs <Funds value={severance} format="full" /></> : 'Let them go'}</Button>
    </div>
  </div>;
}

function HireCard({ view, onHire }: { view: ManagerView; onHire: () => void }) {
  return <div className="staff-hire">
    {view.hire && <div className="chips"><Chip icon="funds">{moneyFull(view.hire.funding)}</Chip></div>}
    {view.hire?.reason && <p className="reason">{view.hire.reason}</p>}
    <p className="dim">Opening the post puts three candidates on offer. You choose who to hire.</p>
    <Button variant="primary" block onClick={onHire}>Open the post in Upgrades</Button>
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
    <p className="dim">Rested squads return to standby once everyone is below {returnBelow}.</p>
    <h3>Squads</h3>
    {g.squads.length === 0 ? <p className="dim">No squads yet.</p> : <ul className="staff-squads">
      {g.squads.map((squad) => {
        const managed = !policy.optOut.includes(squad.id);
        const deployed = squadDeployed(g, squad.id);
        return <li key={squad.id}>
          <span className="squad-badge">{squad.id}</span>
          <span className="staff-squad-main"><strong>{squad.name}</strong><span className="dim"><Icon name={DUTY_META[squad.duty].icon} size={16} />{deployed ? 'Deployed: not touched' : DUTY_META[squad.duty].label}{managed ? '' : ' · manual'}</span></span>
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
        {courses.map((course) => <option key={course.id} value={course.id}>{course.name} · {course.hours}h · {funding(courseFee(g, course.cost))}</option>)}
      </select>
    </label>
    <h3>Keep funding above</h3>
    <ChoiceRail label="Funding reserve" grow value={String(policy.reserve)} onChange={(value) => act({ type: 'setManagerPolicy', patch: { managerId: 'training_sergeant', reserve: Number(value) } }, `Keeps ${funding(Number(value))} in reserve`)}
      options={reserves.map((value) => ({ value: String(value), label: <Funds value={value} format="money" />, accessibleLabel: `${funding(value)} reserve` }))} />
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
    <ChoiceRail label="Funding reserve" grow value={String(policy.reserve)} onChange={(value) => act({ type: 'setManagerPolicy', patch: { managerId: 'peer_support_lead', reserve: Number(value) } }, `Keeps ${funding(Number(value))} in reserve`)}
      options={reserves.map((value) => ({ value: String(value), label: <Funds value={value} format="money" />, accessibleLabel: `${funding(value)} reserve` }))} />
    <p className="dim">Up to {sessionsPerHour} {sessionsPerHour === 1 ? 'session' : 'sessions'} an hour, <Funds value={sessionCost} format="money" /> each, {relief} stress off. Only idle officers, most strained first.</p>
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
    <ChoiceRail label="Funding reserve" grow value={String(policy.reserve)} onChange={(value) => act({ type: 'setManagerPolicy', patch: { managerId: 'recruiter', reserve: Number(value) } }, `Keeps ${funding(Number(value))} in reserve`)}
      options={reserves.map((value) => ({ value: String(value), label: <Funds value={value} format="money" />, accessibleLabel: `${funding(value)} reserve` }))} />
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
      <select value={current} onChange={(event) => act({ type: 'setManagerPolicy', patch: { managerId: 'quartermaster', budgetPerHour: Number(event.target.value) } }, `Service ceiling ${fundingPerHour(Number(event.target.value))}`)}>
        {options.map((value) => <option key={value} value={value}>Up to {fundingPerHour(value)}</option>)}
      </select>
    </label>
    <p className="dim">Services idle gear below {EQUIPMENT_MANAGER.serviceBelow}% condition and keeps {funding(EQUIPMENT_MANAGER.fundingReserve)} in reserve. Restock rules set: {g.department.restockRules.length || 'none'}.</p>
    {onOpenGear && <Button size="sm" onClick={onOpenGear}>Open the Armory</Button>}
  </div>;
}
