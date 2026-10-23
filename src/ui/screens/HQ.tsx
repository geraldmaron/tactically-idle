import { useToast } from '../components/toast';
import { useState } from 'react';
import { useCampaigns, useGame } from '../store';
import { squadReadiness, storeOptions } from '../../sim/department-selectors';
import { hqOverview } from '../../sim/hq-selectors';
import { formatGameDate, gameDay } from '../../sim/calendar';
import { squadDeployed } from '../../sim/squads';
import { ECONOMY_TUNING, HOUR_MS } from '../../sim/economy';
import { Sheet } from '../components/Sheet';
import { Portrait } from '../portraits/Portrait';
import './hq-overview.css';
import type { GameState, Id, Officer, SquadDuty, SquadId } from '../../sim/types';
import { commandStaffOf, managerView, managerViews } from '../../sim/command-staff';
import { employedPatrol, PATROL_BOOSTS, patrolCandidates, patrolCapacity, patrolHireQuote, patrolProfile, patrolRates, patrolTrainingQuote } from '../../sim/patrol';
import { stressBand } from '../../sim/officer';
import { levelProgress } from '../../sim/department-level';
import { STRESS_LABEL } from '../components/StressDisplay';
import { bestFitSquad } from './operation-squads';
import { Button, Card, Chip, EmptyState, Meter, Row, Section } from '../components/ui';
import { ChoiceRail } from '../components/ChoiceRail';
import { Face } from '../components/Face';
import { FinanceDetail } from '../components/Finance';
import { useNav, type NavApi } from '../components/nav';
import { DUTY_META } from '../components/labels';
import { Icon, type IconName } from '../icons';
import { CallTypeBadge } from '../icons/CallTypeBadge';
import { OutcomeMark } from '../icons/marks';
import { getScenario } from '../../sim/scenario-registry';
import { duration, moneyFull, perHour, plural, rate, signed, signedMoney } from '../format';
import { scenarioTitle } from './helpers';
import { callFlow } from './call-flow';
import { SavedDebriefReview } from './OpsDebrief';
import { ScoreRing } from '../components/DebriefResults';
import { Hub, type HubPin } from '../components/Hub';
import { ShiftReportCard } from '../components/ShiftReport';
import { ManagerPortrait } from '../art/ManagerArt';
import { PlateArt, sceneFor } from '../art/Plates';

type Overview = ReturnType<typeof hqOverview>;
type Nav = ReturnType<typeof useNav>;
const present = (o: Officer | undefined): o is Officer => !!o;

/** HQ is the department at a glance, top to bottom: the building, the one move that matters now,
 * anything waiting to be read, SWAT readiness with the duty switch, patrol income and the department
 * net, trust and level, command staff, and recent results. Each block opens the screen that owns it. */
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
      <Notices g={g} now={now} onReport={() => setReportOpen(true)} onFinances={openFinances} />
      <SwatReadiness g={g} overview={overview} />
      <PatrolFunding g={g} net={overview.budget.net} onFinances={openFinances} />
      <Vitals g={g} />
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

const officersOf = (g: GameState, squadIds: SquadId[]) => squadIds.flatMap((id) => g.squads.find((s) => s.id === id)?.officerIds ?? []).map((id) => g.officers[id]).filter(present);

/** The one move that matters now: the live call, the debrief, the call closest to expiring, else what
 * keeps squads home, else money. A waiting call carries its pay, XP, difficulty, clock and best-fit squad,
 * and the card says how many more calls wait behind it. */
function YourMove({ g, overview, now }: { g: GameState; overview: Overview; now: number }) {
  const nav = useNav();
  const run = g.activeRun;
  const t = Math.max(now, g.department.clockHighWater);
  const ready = overview.squads.filter((squad) => squad.deployable && !squad.deployed);
  let scene: string | null = null;
  let chips: { icon: IconName; text: string; tone?: 'warn' }[] = [];
  let faces: Officer[] = [];
  let more = 0;
  let move: { title: string; line: string; action: string; onAct: () => void };
  if (run) {
    scene = sceneFor(getScenario(run.scenarioId)?.incident?.type);
    faces = officersOf(g, run.squadIds);
    const title = scenarioTitle(g, run.scenarioId, now);
    move = run.status === 'debrief'
      ? { title: `${title} is over`, line: 'The debrief waits. Next call settles it.', action: 'Debrief', onAct: () => nav.go('ops') }
      : { title: `${title} is live`, line: `${plural(run.squadIds.length, 'squad')} on scene.`, action: 'Return', onAct: () => nav.go('ops') };
    chips = [{ icon: run.status === 'debrief' ? 'dossier' : 'radio', text: run.status === 'debrief' ? 'Debrief' : 'Live' }];
  } else {
    const live = [...(g.incidents ?? [])].filter((card) => card.expiresAt > t).sort((a, b) => a.expiresAt - b.expiresAt);
    const oldest = live[0];
    if (oldest) {
      more = live.length - 1;
      scene = sceneFor(oldest.type);
      const def = getScenario(oldest.id);
      const best = bestFitSquad(g.squads.map((s) => ({ id: s.id, ...squadReadiness(g, s.id, t) })));
      faces = best ? officersOf(g, [best]) : [];
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
    <div className="hq-move-foot">
      {faces.length > 0 && <span className="hq-faces" aria-hidden="true">{faces.map((officer) => <Face key={officer.id} size="sm" kind="officer" officer={officer} />)}</span>}
      <Button variant="primary" data-primary onClick={move.onAct}>{move.action}</Button>
    </div>
    {more > 0 && <button type="button" className="hq-move-more" onClick={() => nav.go('ops')}>
      <Icon name="calls" size={16} /><span>{more === 1 ? '1 more call waiting' : `${more} more calls waiting`}</span><Icon name="chevronRight" size={16} />
    </button>}
  </section>;
}

/** Things waiting to be read: the shift report, and the income window when it is about to close or has. */
function Notices({ g, now, onReport, onFinances }: { g: GameState; now: number; onReport: () => void; onFinances: () => void }) {
  const left = g.department.lastInteractionAt + ECONOMY_TUNING.capMs - now;
  const windowLine = left <= 0 ? 'Paused. Your next order resumes it.' : left < 6 * HOUR_MS ? `Stops in ${duration(left)} unless you give an order.` : null;
  if (!g.report && !windowLine) return null;
  return <div className="hq-notices">
    {g.report && <Row className="hq-report" lead={<Icon name="dossier" size={20} />} title="Shift report" detail={reportSummary(g.report)} onClick={onReport} trail={<span className="hq-link">Review</span>} label={`Shift report: ${reportSummary(g.report)}. Review`} />}
    {windowLine && <Row className={`hq-window${left <= 0 ? ' hq-window-paused' : ''}`} lead={<Icon name="hourglass" size={20} className={left <= 0 ? 'hq-window-paused-icon' : 'hq-window-icon'} />} title="Hourly income" detail={windowLine} onClick={onFinances} trail={<Icon name="chevronRight" size={16} />} label={`Hourly income: ${windowLine} Open finances`} />}
  </div>;
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
    ...(overview.strained > 0 ? [{ icon: 'strained' as const, text: `${overview.strained} strained`, tone: 'warn' as const, onOpen: () => nav.setSquadSection('roster') }] : []),
    ...(overview.training > 0 ? [{ icon: 'mortarboard' as const, text: `${overview.training} in training`, tone: 'neutral' as const, onOpen: () => nav.setSquadSection('training') }] : []),
    ...(overview.emptySeats > 0 ? [{ icon: 'plus' as const, text: plural(overview.emptySeats, 'open seat'), tone: 'neutral' as const, onOpen: () => nav.setSquadSection('hire') }] : []),
  ];
  return (
    <Section id="hq-duties-h" title="SWAT readiness" icon="people" count={`${overview.deployable} of ${overview.totalOfficers} ready`}
      action={<Button size="sm" variant="quiet" onClick={() => nav.setTeamSection('swat')}>Team</Button>}>
      {summary.length > 0 && <div className="hq-summary">{summary.map((s) => <button key={s.text} type="button" className="hq-summary-item" onClick={s.onOpen}><Chip tone={s.tone} icon={s.icon}>{s.text}</Chip></button>)}</div>}
      <div id="hq-duties" className="hq-duties">
      {g.squads.length === 0 ? (
        <EmptyState compact icon="people" title="No squads yet">
          Create a squad in Team.
          <Button size="sm" onClick={() => nav.go('squad')}>Open Team</Button>
        </EmptyState>
      ) : g.squads.map((s) => {
        const deployed = squadDeployed(g, s.id);
        const readiness = squadReadiness(g, s.id, g.department.clockHighWater);
        const members = s.officerIds.map((id) => g.officers[id]).filter(present);
        const managed = watch.hired && !policy.optOut.includes(s.id);
        const strained = members.filter((o) => stressBand(o.stress) !== 'ready');
        const last = g.debriefs.find((d) => d.officerCondition.some((c) => s.officerIds.includes(c.officerId)));
        const allReady = !deployed && members.length > 0 && readiness.ready === members.length;
        return (
          <Card key={s.id} tone={allReady ? 'good' : undefined} className="hq-squad hq-duty">
            <button type="button" className="hq-squad-open" onClick={() => nav.setSquadSection('squads')} aria-label={`${s.name}: ${deployed ? 'on a call' : `${readiness.ready} of ${members.length} ready`}. Open the squad`}>
              <span className="hq-faces hq-faces-md" aria-hidden="true">{members.map((officer) => <Face key={officer.id} size="md" kind="officer" officer={officer} />)}</span>
              <span className="hq-squad-name"><strong>{s.name}</strong><Icon name="chevronRight" size={16} /></span>
              {deployed ? <Chip tone="neutral" icon="bell">On a call</Chip> : <Chip tone={allReady ? 'good' : 'warn'} icon={allReady ? 'check' : 'warning'}>{`${readiness.ready} of ${members.length} ready`}</Chip>}
            </button>
            <p className="hq-squad-note">
              {strained.length > 0
                ? <span className="hq-squad-strain"><Icon name="warning" size={16} />{strained.map((o) => `${o.surname}: ${STRESS_LABEL[stressBand(o.stress)].toLowerCase()}`).join(', ')}</span>
                : <span><Icon name="check" size={16} />Everyone fit</span>}
              {last && <span><Icon name="flag" size={16} />{last.endingTitle}</span>}
            </p>
            <ChoiceRail label={`Duty for ${s.name}`} value={s.duty} grow
              options={(['standby', 'rest'] as SquadDuty[]).map((d) => ({ value: d, accessibleLabel: `${DUTY_META[d].label}. ${DUTY_META[d].blurb}`, label: <><Icon name={DUTY_META[d].icon} size={16} className="hq-duty-icon" /><span className="hq-duty-word">{DUTY_META[d].label}</span></>, disabled: !!deployed }))}
              onChange={(duty) => act({ type: 'setSquadDuty', squadId: s.id, duty })} />
            {watch.hired && <label className="hq-duty-auto">
              <input type="checkbox" role="switch" checked={managed} onChange={(e) => setManaged(s.id, e.target.checked)} />
              <span className="toggle-ui" aria-hidden="true" />
              <span>{managed ? `Watch Commander${watch.on ? '' : ', off duty'}` : 'Set by hand'}</span>
            </label>}
          </Card>
        );
      })}
      </div>
    </Section>
  );
}

/** Patrol pays the department: who is covering, open posts and training, any active grant, the
 * department net after every cost, and patrol's next step (train, hire or manage). The top opens Finances. */
function PatrolFunding({ g, net, onFinances }: { g: GameState; net: number; onFinances: () => void }) {
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
  const next = trainee ? { label: 'Train', detail: `${traineeName ? `${traineeName.firstName} ${traineeName.surname}` : 'An officer'} can move up a grade.`, icon: 'mortarboard' as const, act: () => nav.openPatrol({ kind: 'training', employeeId: trainee.id }) }
    : hire?.ok ? { label: 'Hire', detail: `${plural(open, 'open post')}. ${moneyFull(hire.upfront)} adds ${rate(hire.netDelta)}.`, icon: 'plus' as const, act: () => nav.openPatrol({ kind: 'hire' }) }
      : { label: 'Manage', detail: open > 0 ? `${plural(open, 'open post')}. ${hire?.reason ?? 'No candidate on offer.'}` : `All ${capacity} posts filled.`, icon: 'patrol' as const, act: () => nav.setTeamSection('patrol') };
  const detail = [`${rates.productive} covering`, open > 0 ? `${open} open` : '', training > 0 ? `${training} in training` : ''].filter(Boolean).join(' · ');
  return <Section title="Patrol and funding" icon="patrol" action={<Button size="sm" variant="quiet" onClick={() => nav.setTeamSection('patrol')}>Patrol</Button>}>
    <div className="hq-patrol" data-patrol-funding-origin>
      <button type="button" className="hq-patrol-top" onClick={onFinances} aria-label={`Patrol coverage: ${detail}. Department net ${rate(net)}. Open finances`}>
        <span className="hq-faces" aria-hidden="true">{employees.slice(0, 4).map((employee) => <Face key={employee.id} size="sm" kind="patrol" src={patrolProfile(employee.profileId)?.portrait} />)}</span>
        <span className="hq-patrol-main"><strong>Patrol coverage</strong><span>{detail}</span></span>
        <span className="hq-patrol-rate"><span>Department net</span><strong className={net < 0 ? 'tone-danger' : undefined}>{rate(net)}</strong></span>
      </button>
      <dl className="hq-patrol-lines">
        <div><dt>Patrol gross</dt><dd>{rate(rates.gross)}</dd></div>
        <div><dt>Patrol costs</dt><dd>-{perHour(rates.wages + rates.operating)}</dd></div>
        <div><dt>Patrol net</dt><dd>{rate(rates.net)}</dd></div>
      </dl>
      {boost && <p className="hq-patrol-boost"><Icon name="trend" size={16} />{`Community grant ×${PATROL_BOOSTS[boost.id]?.factor ?? boost.factor} · ${duration(boost.expiresAt - at)} left`}</p>}
      <div className="hq-patrol-next"><span>{next.detail}</span><Button size="sm" icon={next.icon} onClick={next.act}>{next.label}</Button></div>
    </div>
  </Section>;
}

/** What the department stands on: public trust, and service toward the next level. Each opens where it matters. */
function Vitals({ g }: { g: GameState }) {
  const nav = useNav();
  const d = g.department;
  const p = levelProgress(d);
  const trust = Math.round(d.trust);
  const lastTrust = g.debriefs[0]?.trustDelta;
  const toNext = p.next === null ? null : Math.max(0, p.next - p.service);
  return <div className="hq-vitals">
    <Card className="hq-vital" onClick={() => document.getElementById('hq-results')?.scrollIntoView({ block: 'start', behavior: 'smooth' })} label={`Public trust ${trust} of 100. See recent results`}>
      <span className="hq-vital-head"><Icon name="trust" size={20} />Trust</span>
      <strong className="hq-vital-value">{trust}</strong>
      <Meter value={trust} tone="mid" label="Public trust" valueText={`${trust} of 100`} />
      <span className="hq-vital-sub">{lastTrust ? `Last call ${signed(lastTrust, 1)}` : 'No calls yet'}</span>
    </Card>
    <Card className="hq-vital" onClick={() => nav.go('develop')} label={`Department level ${p.level}${toNext === null ? '' : `, ${toNext} service to level ${p.level + 1}`}. Open Build`}>
      <span className="hq-vital-head"><Icon name="medal" size={20} />Level</span>
      <strong className="hq-vital-value">{p.level}</strong>
      <Meter value={p.next === null ? 100 : (100 * (p.service - p.floor)) / (p.next - p.floor)} tone="mid" label="Service toward the next level" valueText={toNext === null ? 'top level' : `${toNext} to go`} />
      <span className="hq-vital-sub">{toNext === null ? 'Top level' : `${toNext} to level ${p.level + 1}`}</span>
    </Card>
  </div>;
}

/** Command staff as one strip: every post's face (or an empty seat), how many are hired and on duty,
 * and the next post to fill. It opens Team's command room, which holds the detail. */
function CommandStaffStrip({ g }: { g: GameState }) {
  const nav = useNav();
  const views = managerViews(g);
  const hired = views.filter((v) => v.hired);
  const off = hired.filter((v) => !v.on).length;
  const vacant = views.find((v) => v.open && !v.hired);
  const line = hired.length === 0
    ? vacant ? `${vacant.profile.title} post is open. Choose a candidate.` : 'No posts open yet. Build opens them.'
    : [`${hired.length - off} on duty`, off ? `${off} off duty` : '', vacant ? `${vacant.profile.title} vacant` : ''].filter(Boolean).join(' · ');
  return <Section title="Command staff" icon="leadership" count={`${hired.length} of ${views.length} hired`}>
    <Card className="hq-staff" onClick={() => nav.setTeamSection('command')} label={`Command staff: ${hired.length} of ${views.length} hired. ${line}. Open command`}>
      <span className="hq-staff-faces" aria-hidden="true">{views.map((v) => <span key={v.profile.id} className={`hq-staff-face${v.hired ? (v.on ? '' : ' hq-staff-face-off') : ' hq-staff-face-empty'}`}><ManagerPortrait person={v.holder?.person ?? null} size={40} /></span>)}</span>
      <span className="hq-staff-line">{line}</span>
    </Card>
  </Section>;
}

export function Debriefs({ g, now }: { g: GameState; now: number }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const selected = g.debriefs.find((debrief) => debrief.runId === selectedId) ?? null;
  return (
    <Section id="hq-results" title="Recent results" icon="chart">
      {g.debriefs.length === 0 ? (
        <EmptyState compact icon="chart" title="No results yet">
          Finished calls appear here with their results and causes.
        </EmptyState>
      ) : (
        <div className="stack">
          {(expanded ? g.debriefs : g.debriefs.slice(0, 5)).map((d) => (
            <DebriefTile key={d.runId} g={g} d={d} now={now} open={selectedId === d.runId} onOpen={() => setSelectedId(d.runId)} />
          ))}
          {g.debriefs.length > 5 && <Button onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>{expanded ? 'Show recent five' : `Show all ${g.debriefs.length} saved results`}</Button>}
        </div>
      )}
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
        <ScoreRing value={d.objective.score}><Icon name="flag" size={16} /></ScoreRing>
        <ScoreRing value={d.civilianSafety.score}><Icon name="civilian" size={16} /></ScoreRing>
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
