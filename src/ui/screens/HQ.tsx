import { useToast } from '../components/toast';
import { useState, type ReactNode } from 'react';
import { useCampaigns, useGame } from '../store';
import { squadReadiness, storeOptions } from '../../sim/department-selectors';
import { hqOverview } from '../../sim/hq-selectors';
import { formatGameDate, gameDay } from '../../sim/calendar';
import { deployRoster, runRoster, squadDeployed } from '../../sim/squads';
import { ECONOMY_TUNING, HOUR_MS } from '../../sim/economy';
import { Sheet } from '../components/Sheet';
import { Portrait } from '../portraits/Portrait';
import './hq-overview.css';
import type { GameState, Id, Officer, SquadDuty, SquadId } from '../../sim/types';
import { commandStaffOf, managerView, managerViews } from '../../sim/command-staff';
import { employedPatrol, PATROL_BOOSTS, patrolCandidates, patrolCapacity, patrolHireQuote, patrolProfile, patrolRates, patrolTrainingQuote } from '../../sim/patrol';
import { stageProgress } from '../../sim/operation-selectors';
import { bestFitSquad } from './operation-squads';
import { Button, Chip, EmptyState, Ring, Row, Section } from '../components/ui';
import { ChoiceRail } from '../components/ChoiceRail';
import { Face } from '../components/Face';
import { officerFaceStatus, type FaceStatus } from '../components/face-status';
import { FinanceDetail } from '../components/Finance';
import { useNav, type NavApi } from '../components/nav';
import { DUTY_META } from '../components/labels';
import { Icon, type IconName } from '../icons';
import { CallTypeBadge } from '../icons/CallTypeBadge';
import { OutcomeMark } from '../icons/marks';
import { getScenario } from '../../sim/scenario-registry';
import { duration, moneyFull, perHour, plural, rate, signedMoney } from '../format';
import { scenarioTitle } from './helpers';
import { callFlow } from './call-flow';
import { SavedDebriefReview } from './OpsDebrief';
import { Hub, type HubPin } from '../components/Hub';
import { ShiftReportCard } from '../components/ShiftReport';
import { CommandSeats, LOOP_ICON } from '../components/CommandStaff';
import { PlateArt, sceneFor } from '../art/Plates';

type Overview = ReturnType<typeof hqOverview>;
type Nav = ReturnType<typeof useNav>;
const present = (o: Officer | undefined): o is Officer => !!o;

/** HQ is the department at a glance, top to bottom: the building, the one move that matters now,
 * anything waiting to be read, what is on the clock, SWAT readiness with the duty switch, patrol
 * income, command staff, and recent results. Funding, the net rate, trust and level live in the
 * resource bar and are not repeated here. Each block opens the screen that owns it. */
export function HQ() {
  const g = useGame();
  const saved = useCampaigns();
  const nav = useNav();
  const [reportOpen, setReportOpen] = useState(false);
  const [financesOpen, setFinancesOpen] = useState(false);
  const now = Date.now();
  const at = Math.max(now, g.department.clockHighWater);
  const overview = hqOverview(g, now);
  const openFinances = () => setFinancesOpen(true);
  return (
    <>
    <Hub pins={hubPins(g, overview, nav, openFinances)} title={g.department.name} meta={formatGameDate(gameDay(g, at))} />
    <div className="page hq-page">
      <YourMove g={g} overview={overview} now={now} />
      <Notices g={g} onReport={() => setReportOpen(true)} />
      <Clocks g={g} overview={overview} now={now} onFinances={openFinances} />
      <SwatReadiness g={g} overview={overview} />
      <PatrolFunding g={g} />
      <CommandStaffStrip g={g} />
      <Debriefs key={`${saved.campaignId ?? 'unsaved'}:${saved.session}`} g={g} now={now} />
      <Sheet open={financesOpen} onClose={() => setFinancesOpen(false)} title="Finances"
        footer={<div className="row-actions"><Button icon="patrol" onClick={() => { setFinancesOpen(false); nav.setTeamSection('patrol'); }}>Patrol team</Button><Button icon="box" onClick={() => { setFinancesOpen(false); nav.go('develop'); }}>Build</Button></div>}><FinanceDetail g={g} /></Sheet>
      <Sheet open={reportOpen && !!g.report} onClose={() => setReportOpen(false)} title="Shift report">{g.report && <ShiftReportCard report={g.report} g={g} />}</Sheet>
    </div>
    </>
  );
}

/** The plate speaks only about trouble the blocks below do not already headline. */
function hubPins(g: GameState, overview: Overview, nav: Nav, onFinances: () => void): HubPin[] {
  const pins: HubPin[] = [];
  if (overview.budget.net < 0) pins.push({ room: 'garage', text: 'Costs exceed income', tone: 'harm', onOpen: onFinances });
  const worn = storeOptions(g).filter((option) => option.failed > 0).length;
  if (worn > 0) pins.push({ room: 'armory', text: worn === 1 ? '1 item needs service' : `${worn} items need service`, onOpen: () => nav.go('gear') });
  return pins;
}

/** Open one call's brief from HQ: the Calls tab, then the brief through `callFlow.openCall`, the path a board card takes. */
export function openCallBrief(nav: Pick<NavApi, 'go'>, scenarioId: Id) {
  nav.go('ops');
  callFlow.openCall(scenarioId);
}

/** A face's status for a crew already on the call: the stress ring stays, the on-a-call badge goes. */
const onScene = (status: FaceStatus | null): FaceStatus | null => status && status.mark === 'deployed' ? { ...status, mark: null } : status;
/** On the live call an injury on this call (the run's casualty record) shows as the injury badge. */
function crewStatus(g: GameState, id: Id, at: number): FaceStatus | null {
  const status = onScene(officerFaceStatus(g, id, at));
  const casualty = g.activeRun?.officerCasualties?.[id];
  return status && casualty ? { ...status, mark: 'injured', label: `${status.surname}, out of action on this call` } : status;
}

const runRosterCount = (g: GameState, squadId: SquadId) => g.activeRun ? runRoster(g, g.activeRun, squadId).length : 0;
const officersFrom = (g: GameState, ids: Id[]) => ids.map((id) => g.officers[id]).filter(present);

/** The one move that matters now: the live call, the debrief, the call closest to expiring, else what
 * keeps squads home, else money. A live call carries its minute, the threat now draining, and the three
 * steps with the current one lit; a waiting call carries its pay, XP, difficulty, clock and best-fit
 * squad, and the card says how many more calls wait behind it. Faces carry each officer's stress. */
function YourMove({ g, overview, now }: { g: GameState; overview: Overview; now: number }) {
  const nav = useNav();
  const run = g.activeRun;
  const t = Math.max(now, g.department.clockHighWater);
  const ready = overview.squads.filter((squad) => squad.deployable && !squad.deployed);
  let scene: string | null = null;
  let chips: { icon: IconName; text: string; tone?: 'warn' }[] = [];
  let faces: Officer[] = [];
  let more = 0;
  let stages: ReturnType<typeof stageProgress>['stages'] = [];
  let move: { title: string; line: string; action: string; onAct: () => void };
  if (run) {
    scene = sceneFor(getScenario(run.scenarioId)?.incident?.type);
    // Who went: the run's roster, not every squad member (a short squad leaves the unfit at home).
    faces = officersFrom(g, run.squadIds.flatMap((id) => runRoster(g, run, id)));
    const progress = stageProgress(g);
    stages = progress.stages;
    const title = scenarioTitle(g, run.scenarioId, now);
    if (run.status === 'debrief') {
      move = { title, line: 'The call is over. The debrief settles it.', action: 'Debrief', onAct: () => nav.go('ops') };
      chips = [{ icon: 'dossier', text: 'Debrief ready' }];
    } else {
      move = { title, line: run.decisionPending ? 'The result of your last order is ready to read.' : 'A decision is waiting on you.', action: 'Return', onAct: () => nav.go('ops') };
      chips = [
        { icon: 'radio', text: 'Live' },
        { icon: 'clock', text: `Minute ${Math.floor(run.clock)}` },
        ...(progress.threat ? [{ icon: 'warning' as const, text: progress.threat.label, tone: 'warn' as const }] : []),
      ];
    }
  } else {
    const live = [...(g.incidents ?? [])].filter((card) => card.expiresAt > t).sort((a, b) => a.expiresAt - b.expiresAt);
    const oldest = live[0];
    if (oldest) {
      more = live.length - 1;
      scene = sceneFor(oldest.type);
      const def = getScenario(oldest.id);
      const best = bestFitSquad(g.squads.map((s) => ({ id: s.id, ...squadReadiness(g, s.id, t) })));
      // Who would go: the best-fit squad's deploy roster.
      faces = best ? officersFrom(g, deployRoster(g, best, t).goes) : [];
      const left = oldest.expiresAt - t;
      chips = [
        { icon: 'clock', text: `${duration(left)} left`, ...(left < HOUR_MS ? { tone: 'warn' as const } : {}) },
        ...(def?.rewards ? [{ icon: 'cash' as const, text: signedMoney(def.rewards.funding) }, { icon: 'medal' as const, text: `${def.rewards.xp} XP` }] : []),
        ...(def?.difficulty ? [{ icon: 'gauge' as const, text: `${def.difficulty.band[0].toUpperCase()}${def.difficulty.band.slice(1)}` }] : []),
      ];
      const line = best ? `${g.squads.find((s) => s.id === best)?.name ?? best} is the best fit.` : ready.length === 0 ? 'No squad can deploy yet.' : `${plural(ready.length, 'squad')} ready.`;
      move = { title: scenarioTitle(g, oldest.id, now), line, action: 'Open', onAct: () => openCallBrief(nav, oldest.id) };
    }
    else if (overview.squads.length > 0 && ready.length === 0) move = { title: 'No squad can deploy', line: 'Open Team to see who is out and why.', action: 'Team', onAct: () => nav.setTeamSection('swat') };
    else if (overview.budget.net < 0) move = { title: 'Costs exceed income', line: `Funding falls ${perHour(Math.abs(overview.budget.net))}. Review patrol coverage and costs.`, action: 'Patrol', onAct: () => nav.setTeamSection('patrol') };
    else {
      const next = overview.board.nextArrivalAt;
      move = { title: 'No call waiting', line: next ? `The next call comes in about ${duration(Math.max(0, next - t))}. Funding can go to the next build.` : 'Funding can go to the next build.', action: 'Build', onAct: () => nav.go('develop') };
    }
  }
  return <section className={`hq-move${scene ? ' hq-move-scene' : ''}`} aria-label="Your move">
    {scene && <PlateArt src={scene} />}
    {chips.length > 0 && <div className="hq-move-top">{chips.map((c) => <Chip key={c.text} tone={c.tone ?? 'neutral'} icon={c.icon}>{c.text}</Chip>)}</div>}
    <div className="hq-move-main"><strong>{move.title}</strong><span>{move.line}</span></div>
    {stages.length > 0 && <ol className="hq-stages" aria-label="Call steps">{stages.map((stage) => <li key={stage.id} className={`hq-stage hq-stage-${stage.state}`} aria-current={stage.state === 'current' ? 'step' : undefined}><span className="hq-stage-bar" aria-hidden="true" /><span>{stage.label}</span></li>)}</ol>}
    <div className="hq-move-foot">
      {faces.length > 0 && <span className="hq-faces hq-move-faces" role="group" aria-label={run ? 'On scene' : 'Would go'}>{faces.map((officer) => <Face key={officer.id} size={faces.length > 4 ? 'sm' : 'md'} kind="officer" officer={officer} name={officer.surname} status={crewStatus(g, officer.id, t)} />)}</span>}
      <Button variant="primary" data-primary onClick={move.onAct}>{move.action}</Button>
    </div>
    {more > 0 && <button type="button" className="hq-move-more" onClick={() => nav.go('ops')}>
      <Icon name="calls" size={16} /><span>{more === 1 ? '1 more call waiting' : `${more} more calls waiting`}</span><Icon name="chevronRight" size={16} />
    </button>}
  </section>;
}

/** Things waiting to be read: the shift report. */
function Notices({ g, onReport }: { g: GameState; onReport: () => void }) {
  if (!g.report) return null;
  return <div className="hq-notices">
    <Row className="hq-report" lead={<Icon name="dossier" size={20} />} title="Shift report" detail={reportSummary(g.report)} onClick={onReport} trail={<span className="hq-link">Review</span>} label={`Shift report: ${reportSummary(g.report)}. Review`} />
  </div>;
}

interface Clock { key: string; lead: ReactNode; title: string; detail: string; at: number; fraction: number | null; tone?: 'warn' | 'harm'; onOpen: () => void }
const MAX_CLOCKS = 4;
const share = (from: number, to: number, at: number) => to > from ? Math.max(0, Math.min(1, (at - from) / (to - from))) : null;

/** What is on the clock, soonest first after the income window: each tile a ring that fills (or, for
 * income, drains) toward its time, so the department visibly moves between visits. Income always shows;
 * then the next call's arrival, and officers and patrol coming back from injury, rest or training. */
function Clocks({ g, overview, now, onFinances }: { g: GameState; overview: Overview; now: number; onFinances: () => void }) {
  const nav = useNav();
  const t = Math.max(now, g.department.clockHighWater);
  const incomeLeft = g.department.lastInteractionAt + ECONOMY_TUNING.capMs - now;
  const income: Clock = {
    key: 'income', lead: <Icon name="hourglass" size={20} />, at: 0, onOpen: onFinances,
    title: 'Income',
    detail: incomeLeft <= 0 ? 'Paused' : `Runs ${duration(incomeLeft)}`,
    fraction: Math.max(0, Math.min(1, incomeLeft / ECONOMY_TUNING.capMs)),
    ...(incomeLeft <= 0 ? { tone: 'harm' as const } : incomeLeft < 6 * HOUR_MS ? { tone: 'warn' as const } : {}),
  };
  const next = overview.board.nextArrivalAt;
  const call: Clock[] = next ? [{ key: 'call', lead: <Icon name="calls" size={20} />, title: 'Next call', detail: `In ${duration(Math.max(0, next - t))}`, at: next, fraction: null, onOpen: () => nav.go('ops') }] : [];
  const people: Clock[] = [];
  for (const officer of Object.values(g.officers)) {
    const status = officerFaceStatus(g, officer.id, t);
    if (!status?.until || status.until <= t || (status.mark !== 'injured' && status.mark !== 'resting' && status.mark !== 'training')) continue;
    const training = status.mark === 'training' && officer.assignment && 'startedAt' in officer.assignment ? officer.assignment : null;
    people.push({
      key: officer.id, lead: <Face size="sm" kind="officer" officer={officer} />, at: status.until,
      title: `${officer.surname} ${status.mark === 'training' ? 'trains' : 'is back'}`, detail: `In ${duration(status.until - t)}`,
      fraction: training ? share(training.startedAt, training.endsAt, t) : null,
      onOpen: () => nav.setSquadSection(status.mark === 'training' ? 'training' : 'roster'),
    });
  }
  for (const employee of employedPatrol(g)) {
    const course = employee.training;
    if (!course || course.endsAt <= t) continue;
    const profile = patrolProfile(employee.profileId);
    people.push({
      key: employee.id, lead: <Face size="sm" kind="patrol" src={profile?.portrait} />, at: course.endsAt,
      title: `${profile?.surname ?? 'Patrol'} trains`, detail: `In ${duration(course.endsAt - t)}`,
      fraction: share(course.startedAt, course.endsAt, t), onOpen: () => nav.setTeamSection('patrol'),
    });
  }
  people.sort((a, b) => a.at - b.at);
  const clocks = [income, ...call, ...people].slice(0, MAX_CLOCKS);
  return <Section title="On the clock" icon="clock" count={plural(clocks.length, 'timer')}>
    <div className="hq-list" data-ui-list>{clocks.map((clock) => <Row key={clock.key} className={`hq-clock${clock.tone ? ` hq-clock-${clock.tone}` : ''}`} onClick={clock.onOpen}
      label={`${clock.title}. ${clock.detail}${clock.key === 'income' && incomeLeft <= 0 ? '. Any order resumes it' : ''}`}
      lead={clock.fraction === null ? <span className="hq-clock-open">{clock.lead}</span> : <Ring value={clock.fraction * 100} size={40} tone={clock.tone === 'harm' ? 'harm' : clock.tone === 'warn' ? 'warn' : 'act'}>{clock.lead}</Ring>}
      title={clock.title} detail={clock.tone ? <span className={`hq-tone-${clock.tone}`}>{clock.detail}</span> : clock.detail} trail={<Icon name="chevronRight" size={16} />} />)}</div>
  </Section>;
}

/** The HQ line for a waiting report: money and courses, then grants and promotions when there are any. */
function reportSummary(report: NonNullable<GameState['report']>): string {
  const promoted = report.personnel.filter((p) => p.event === 'promoted').length;
  const grants = report.grants?.length ?? 0;
  return [
    report.to > report.from || report.net !== 0 ? `${signedMoney(report.net)} net funding` : '',
    report.completedCourses.length ? `${report.completedCourses.length} course${report.completedCourses.length === 1 ? '' : 's'} completed` : '',
    (report.patrolTraining?.length ?? 0) ? `${report.patrolTraining!.length} patrol promotion${report.patrolTraining!.length === 1 ? '' : 's'}` : '',
    grants ? `${grants} granted` : '',
    promoted ? `${promoted} promoted` : '',
  ].filter(Boolean).join(' · ') || 'Nothing new';
}

/** SWAT readiness: a summary line for the whole roster (who is strained, out, training, and empty seats),
 * then the squads two to a row. A tile is the squad's faces, name and readiness, whoever is under strain,
 * the last call it ran, the duty switch and, once hired, the Watch Commander opt-out. */
function SwatReadiness({ g, overview }: { g: GameState; overview: Overview }) {
  const { act } = useToast();
  const nav = useNav();
  const watch = managerView(g, 'watch_commander');
  const policy = commandStaffOf(g).watch_commander.policy;
  const setManaged = (squadId: SquadId, managed: boolean) => {
    const optOut = managed ? policy.optOut.filter((id) => id !== squadId) : [...policy.optOut, squadId];
    act({ type: 'setManagerPolicy', patch: { managerId: 'watch_commander', optOut } }, managed ? 'Squad duty handed to the Watch Commander' : 'Squad kept on manual duty');
  };
  const onCall = overview.squads.filter((squad) => squad.deployed).reduce((n, squad) => n + squad.total, 0);
  const out = Math.max(0, overview.unavailable - onCall);
  const summary: { icon: IconName; text: string; tone: 'warn' | 'neutral' | 'harm'; onOpen: () => void }[] = [
    ...(out > 0 ? [{ icon: 'injured' as const, text: `${out} out`, tone: 'harm' as const, onOpen: () => nav.setSquadSection('roster') }] : []),
    ...(overview.training > 0 ? [{ icon: 'mortarboard' as const, text: `${overview.training} in training`, tone: 'neutral' as const, onOpen: () => nav.setSquadSection('training') }] : []),
    ...(overview.emptySeats > 0 ? [{ icon: 'plus' as const, text: plural(overview.emptySeats, 'open seat'), tone: 'neutral' as const, onOpen: () => nav.setSquadSection('hire') }] : []),
  ];
  return (
    <Section id="hq-duties-h" title="SWAT readiness" icon="people" count={`${overview.deployable} of ${overview.totalOfficers} ready`}
      action={<button type="button" className="section-link" onClick={() => nav.setTeamSection('swat')}>Team<Icon name="chevronRight" size={16} /></button>}>
      {summary.length > 0 && <div className="hq-summary">{summary.map((s) => <button key={s.text} type="button" className={`hq-summary-item hq-summary-${s.tone}`} onClick={s.onOpen}><Icon name={s.icon} size={16} />{s.text}</button>)}</div>}
      {g.squads.length === 0 ? (
        <EmptyState compact icon="people" title="No squads yet">
          Create a squad in Team.
          <Button size="sm" onClick={() => nav.go('squad')}>Open Team</Button>
        </EmptyState>
      ) : <div id="hq-duties" className="hq-list" data-ui-list>{g.squads.map((s) => {
        const deployed = squadDeployed(g, s.id);
        const readiness = squadReadiness(g, s.id, g.department.clockHighWater);
        const members = s.officerIds.map((id) => g.officers[id]).filter(present);
        const statuses = members.map((o) => officerFaceStatus(g, o.id, g.department.clockHighWater));
        const strained = statuses.filter((status) => status?.mark === 'strained').length;
        const back = statuses.filter((status): status is FaceStatus & { until: number } => !!status?.until && status.until > g.department.clockHighWater).sort((a, b) => a.until - b.until)[0];
        const last = g.debriefs.find((d) => d.officerCondition.some((c) => s.officerIds.includes(c.officerId)));
        const allReady = !deployed && members.length > 0 && readiness.ready === members.length;
        // One line of facts: readiness, strain, who comes back next, and how the squad's last call ended.
        const facts = [
          deployed ? `${plural(runRosterCount(g, s.id), 'officer')} on scene` : allReady ? `All ${members.length} ready` : `${readiness.ready} of ${members.length} ready`,
          strained ? `${strained} strained` : '',
          back ? `${back.surname} back in ${duration(back.until - g.department.clockHighWater)}` : '',
          last ? last.endingTitle : '',
        ].filter(Boolean).join(' · ');
        return <Row key={s.id} className={`hq-duty hq-squad-row${deployed ? ' hq-squad-out' : ''}`}
          lead={<span className="hq-faces hq-faces-stack">{members.map((officer, i) => <Face key={officer.id} size="sm" kind="officer" officer={officer} status={deployed ? onScene(statuses[i]) : statuses[i]} />)}</span>}
          title={<button type="button" className="hq-row-link" onClick={() => nav.setSquadSection('squads')} aria-label={`${s.name}: ${facts}. Open the squad`}>{s.name}<Icon name="chevronRight" size={16} /></button>}
          detail={facts}
          trail={deployed ? <Chip tone="neutral" icon="deployed">On a call</Chip> : <ChoiceRail size="sm" label={`Duty for ${s.name}`} value={s.duty}
            options={(['standby', 'rest'] as SquadDuty[]).map((d) => ({ value: d, accessibleLabel: `${DUTY_META[d].label}. ${DUTY_META[d].blurb}`, label: <><Icon name={DUTY_META[d].icon} size={16} /><span>{DUTY_META[d].label}</span></> }))}
            onChange={(duty) => act({ type: 'setSquadDuty', squadId: s.id, duty })} />} />;
      })}</div>}
      {/* The Watch Commander's hand on duty: one switch per squad under the list, not a second trail. */}
      {watch.hired && g.squads.length > 0 && <div className="hq-watch" role="group" aria-label="Duty set by the Watch Commander">
        <span className="hq-watch-head"><Icon name="patrol" size={16} />{`Watch Commander${watch.on ? '' : ', off duty'}`}</span>
        {g.squads.map((s) => { const managed = !policy.optOut.includes(s.id); return <label key={s.id} className="hq-duty-auto">
          <input type="checkbox" role="switch" checked={managed} onChange={(e) => setManaged(s.id, e.target.checked)} />
          <span className="toggle-ui" aria-hidden="true" />
          <span>{s.name}</span>
        </label>; })}
      </div>}
    </Section>
  );
}

/** Patrol pays the department: who is covering with every open post drawn as an empty seat, patrol's
 * own net, the split of what patrol earns into costs and what it keeps, any active grant, and patrol's
 * next step (train, hire or manage). The department net is the resource bar's; it is not repeated. */
function PatrolFunding({ g }: { g: GameState }) {
  const nav = useNav();
  const at = g.department.clockHighWater;
  const employees = employedPatrol(g);
  const rates = patrolRates(g, at);
  const capacity = patrolCapacity(g);
  const open = capacity - employees.length;
  const training = employees.filter((e) => e.training && e.training.endsAt > at).length;
  const boost = g.patrol.boosts.filter((b) => b.expiresAt > at).sort((a, b) => b.expiresAt - a.expiresAt)[0];
  const trainee = employees.find((employee) => patrolTrainingQuote(g, employee.id).ok);
  const candidate = patrolCandidates(g)[0];
  const hire = open > 0 && candidate ? patrolHireQuote(g, candidate.id) : null;
  const traineeName = trainee ? patrolProfile(trainee.profileId) : undefined;
  // Payback counts covered (productive) hours, the hours patrol earns in, not wall-clock time.
  const payback = hire?.ok && hire.netDelta > 0 ? `, paid back after ${duration((hire.upfront / hire.netDelta) * HOUR_MS)} of coverage` : '';
  const next = trainee ? { label: 'Train', detail: `${traineeName ? `${traineeName.firstName} ${traineeName.surname}` : 'An officer'} can move up a grade.`, icon: 'mortarboard' as const, act: () => nav.openPatrol({ kind: 'training', employeeId: trainee.id }) }
    : hire?.ok ? { label: 'Hire', detail: `${plural(open, 'open post')}. ${moneyFull(hire.upfront)} adds ${rate(hire.netDelta)}${payback}.`, icon: 'plus' as const, act: () => nav.openPatrol({ kind: 'hire' }) }
      : { label: 'Manage', detail: open > 0 ? `${plural(open, 'open post')}. ${hire?.reason ?? 'No candidate on offer.'}` : `All ${capacity} posts filled.`, icon: 'patrol' as const, act: () => nav.setTeamSection('patrol') };
  const detail = [`${rates.productive} covering`, open > 0 ? `${open} open` : '', training > 0 ? `${training} in training` : ''].filter(Boolean).join(' · ');
  const costs = rates.wages + rates.operating;
  // Of what patrol earns, the share it keeps and the share costs take. Costs at or above earnings draw a
  // full cost bar; no earnings and no costs draws no bar.
  const kept = rates.gross > 0 ? Math.max(0, Math.min(100, (100 * (rates.gross - costs)) / rates.gross)) : 0;
  const split = rates.gross <= 0 && costs <= 0 ? 'none' : costs >= rates.gross ? 'loss' : 'kept';
  const seats = [...employees.map((employee) => ({ key: employee.id, employee })), ...Array.from({ length: Math.max(0, open) }, (_, i) => ({ key: `open-${i}`, employee: null }))];
  const SEATS_SHOWN = 6;
  const extra = Math.max(0, seats.length - SEATS_SHOWN);
  return <Section title="Patrol and funding" icon="patrol">
    <div className="hq-patrol" data-patrol-funding-origin>
      <button type="button" className="hq-patrol-top" onClick={() => nav.setTeamSection('patrol')} aria-label={`Patrol coverage: ${detail}. Patrol net ${rate(rates.net)}. Open the patrol team`}>
        <span className="hq-faces" aria-hidden="true">
          {seats.slice(0, SEATS_SHOWN).map((seat) => seat.employee ? <Face key={seat.key} size="sm" kind="patrol" src={patrolProfile(seat.employee.profileId)?.portrait} /> : <span key={seat.key} className="hq-seat hq-seat-sm"><Icon name="plus" size={16} /></span>)}
          {extra > 0 && <span className="hq-seat hq-seat-sm hq-seat-more">{`+${extra}`}</span>}
        </span>
        <span className="hq-patrol-main"><strong>Patrol coverage</strong><span>{detail}</span></span>
        <span className="hq-patrol-rate"><span>Patrol net</span><strong className={rates.net < 0 ? 'tone-danger' : undefined}>{rate(rates.net)}</strong></span>
      </button>
      {split === 'none' ? <EmptyState compact icon="patrol" title="No patrol pay or costs right now" />
        : <div className="hq-patrol-split" role="img" aria-label={`Patrol earns ${rate(rates.gross)}. Costs take ${perHour(costs)}. Patrol keeps ${rate(rates.net)}`}>
          <span className="hq-patrol-bar" aria-hidden="true">{split === 'kept' && <span className="hq-patrol-kept" style={{ width: `${kept}%` }} />}<span className="hq-patrol-cost" style={{ width: split === 'kept' ? `${100 - kept}%` : '100%' }} /></span>
          <span className="hq-patrol-legend" aria-hidden="true">
            <span><i className="hq-key hq-key-kept" />{`${rate(rates.net)} kept`}</span>
            <span><i className="hq-key hq-key-cost" />{`-${perHour(costs)} costs`}</span>
            <span className="hq-patrol-gross">{`of ${rate(rates.gross)} earned`}</span>
          </span>
        </div>}
      {boost && <p className="hq-patrol-boost"><Icon name="trend" size={16} />{`Community grant ×${PATROL_BOOSTS[boost.id]?.factor ?? boost.factor} · ${duration(boost.expiresAt - at)} left`}</p>}
      <div className="hq-patrol-next"><span>{next.detail}</span><Button size="sm" icon={next.icon} onClick={next.act}>{next.label}</Button></div>
    </div>
  </Section>;
}

/** Command staff as a full card: every post as a seat (the holder's face, or the post's own icon on an
 * empty seat, with its state), then the next step. Choosing a candidate fills an open post; opening a
 * closed post is a Build upgrade, never a hire, and its price and conditions come from the post's view. */
function CommandStaffStrip({ g }: { g: GameState }) {
  const nav = useNav();
  const views = managerViews(g);
  const hired = views.filter((v) => v.hired).length;
  const vacant = views.find((v) => v.open && !v.hired);
  const closed = views.find((v) => !v.open);
  const openRoom = () => nav.setTeamSection('command');
  const buyable = !!closed?.hire && !closed.hire.reason;
  const next = vacant ? { title: `Choose a ${vacant.profile.title}`, detail: `${plural(vacant.pool.length, 'candidate')} on offer. Automates ${vacant.profile.loop.toLowerCase()}.`, label: 'Choose', icon: LOOP_ICON[vacant.profile.id], act: openRoom }
    : closed ? { title: `Next post · ${closed.profile.title}`, detail: closed.activity, label: buyable ? `Open · ${moneyFull(closed.hire!.funding)}` : 'View', icon: LOOP_ICON[closed.profile.id], act: () => buyable ? nav.openDevelopment(closed.profile.nodeId) : openRoom() }
      : null;
  return <Section title="Command staff" icon="leadership" count={`${hired} of ${views.length} hired`}>
    <div className="hq-staff">
      <CommandSeats views={views} onOpen={openRoom} />
      {next && <div className="hq-staff-next"><span className="hq-staff-next-text"><strong>{next.title}</strong><span>{next.detail}</span></span><Button size="sm" icon={next.icon} onClick={next.act}>{next.label}</Button></div>}
    </div>
  </Section>;
}

export function Debriefs({ g, now }: { g: GameState; now: number }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const selected = g.debriefs.find((debrief) => debrief.runId === selectedId) ?? null;
  // Nothing played yet: the empty state alone, without a heading that says the same thing.
  if (g.debriefs.length === 0) return <EmptyState compact icon="chart" title="No results yet">Finished calls land here with what caused them.</EmptyState>;
  return (
    <Section id="hq-results" title="Recent results" icon="chart">
      <div className="stack">
        {(expanded ? g.debriefs : g.debriefs.slice(0, 5)).map((d) => (
          <DebriefTile key={d.runId} g={g} d={d} now={now} open={selectedId === d.runId} onOpen={() => setSelectedId(d.runId)} />
        ))}
        {g.debriefs.length > 5 && <Button onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>{expanded ? 'Show recent five' : `Show all ${g.debriefs.length} saved results`}</Button>}
      </div>
      <SavedDebriefReview debrief={selected} officers={g.officers} onClose={() => setSelectedId(null)} />
    </Section>
  );
}

/** Result as a glance: tone stripe, two score rings, who went, and rewards as icon chips. The ending
 * title stays the headline; the full record opens on tap. */
function DebriefTile({ g, d, now, open, onOpen }: { g: GameState; d: GameState['debriefs'][number]; now: number; open: boolean; onOpen: () => void }) {
  const worst = Math.min(d.objective.score, d.civilianSafety.score);
  const tone = worst >= 80 ? 'good' : worst >= 50 ? 'mixed' : 'poor';
  const band = tone === 'good' ? 'favorable' : tone === 'mixed' ? 'mixed' : 'adverse';
  const type = getScenario(d.scenarioId)?.incident?.type;
  const team = d.officerCondition.map((row) => g.officers[row.officerId]).filter(present).slice(0, 4);
  return (
    <button type="button" className={`debrief-tile debrief-tile-${tone}`} onClick={onOpen} aria-haspopup="dialog" aria-expanded={open} aria-label={`Review result: ${d.endingTitle}`}>
      <span className="debrief-rings" aria-hidden="true">
        <Ring value={d.objective.score}><Icon name="flag" size={16} /></Ring>
        <Ring value={d.civilianSafety.score}><Icon name="civilian" size={16} /></Ring>
      </span>
      <span className="debrief-tile-main">
        <span className="debrief-tile-kicker">{type && <CallTypeBadge type={type} size={18} />}{scenarioTitle(g, d.scenarioId, now)}</span>
        <strong className="debrief-tile-title">{d.endingTitle}</strong>
        <span className="debrief-tile-sub"><OutcomeMark band={band} label={`${d.objective.label}`} showLabel={false} size={14} />Objective {d.objective.label.toLowerCase()} · Civilians {d.civilianSafety.label.toLowerCase()}</span>
        <span className="debrief-tile-foot">
          {team.length > 0 && <span className="debrief-team" aria-hidden="true">{team.map((officer) => <span key={officer.id} className="debrief-team-face"><Portrait officer={officer} size={24} /></span>)}</span>}
          <span className="debrief-reward tone-mint"><Icon name="cash" size={16} />{signedMoney(d.fundingReward)}</span>
          <span className={`debrief-reward ${d.trustDelta >= 0 ? '' : 'tone-danger'}`}><Icon name="shield" size={16} />{d.trustDelta >= 0 ? '+' : ''}{d.trustDelta}</span>
        </span>
      </span>
      <Icon name="chevronRight" size={16} className="debrief-tile-go" />
    </button>
  );
}
