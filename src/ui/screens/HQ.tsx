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
import { commandStaffOf, managerView } from '../../sim/command-staff';
import { employedPatrol, patrolProfile } from '../../sim/patrol';
import { stageProgress } from '../../sim/operation-selectors';
import { bestFitSquad } from './operation-squads';
import { Button, Chip, EmptyState, Ring, Row, Section } from '../components/ui';
import { ChoiceRail } from '../components/ChoiceRail';
import { Face } from '../components/Face';
import { SquadCrest } from '../components/SquadCrest';
import { officerFaceStatus, type FaceStatus } from '../components/face-status';
import { FinanceDetail } from '../components/Finance';
import { useNav, type NavApi } from '../components/nav';
import { DUTY_META } from '../components/labels';
import { Icon, type IconName } from '../icons';
import { CallTypeBadge } from '../icons/CallTypeBadge';
import { OutcomeMark } from '../icons/marks';
import { getScenario } from '../../sim/scenario-registry';
import { duration, fundingPerHour, fundingRate, plural, signedMoney } from '../format';
import { Funds } from '../components/Funds';
import { welcomeLines } from '../components/WelcomeBack';
import { scenarioTitle } from './helpers';
import { callFlow } from './call-flow';
import { SavedDebriefReview } from './OpsDebrief';
import { Hub, type HubPin } from '../components/Hub';
import { ShiftReportCard } from '../components/ShiftReport';
import { PlateArt, placeFor, sceneFor } from '../art/Plates';
import { placeTags, scenarioFloorCount, scenarioPlaceName } from '../components/incident';
import { STRESS_BANDS } from '../../sim/officer';

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
      <SinceYouLeft g={g} onReport={() => setReportOpen(true)} />
      {/* The canvas HQ (2026-10-24): the next call, the shift in four tiles, the squads with their duty
          switch, what is on the clock, then recent results (kept: the only way back to a saved debrief,
          sol challenge). Patrol funding and command staff live in full under Team. */}
      <YourMove g={g} overview={overview} now={now} />
      <NeedsYou g={g} overview={overview} now={now} onFinances={openFinances} />
      <ShiftTiles g={g} overview={overview} onFinances={openFinances} />
      <SwatReadiness g={g} overview={overview} />
      <Clocks g={g} overview={overview} now={now} onFinances={openFinances} />
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
    if (oldest) return <UpNext g={g} card={oldest} waiting={live.length} at={t} now={now} />;
    if (overview.squads.length > 0 && ready.length === 0) move = { title: 'No squad can deploy', line: 'Open Team to see who is out and why.', action: 'Team', onAct: () => nav.setTeamSection('swat') };
    else if (overview.budget.net < 0) move = { title: 'Costs exceed income', line: `The department loses ${fundingPerHour(Math.abs(overview.budget.net))}. Review patrol coverage and costs.`, action: 'Patrol', onAct: () => nav.setTeamSection('patrol') };
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
/** The return moment. Earnings were applied while the player was away, so this says what changed, in
 * the order a returning commander asks (money, people, kit), and nothing to collect. It stays until
 * the player says "Got it", even if the welcome sheet was closed unread. */
function SinceYouLeft({ g, onReport }: { g: GameState; onReport: () => void }) {
  const { act } = useToast();
  const report = g.report;
  if (!report) return null;
  const lines = welcomeLines(report, g);
  const shown = lines.slice(0, 3);
  const expenses = report.wages + report.operating + report.restockSpend + (report.maintenanceSpend ?? 0);
  return <section className="hq-since" aria-label="Since you left">
    <header className="hq-since-head">
      <span className="hq-since-away"><Icon name="clock" size={16} />Since you left<small>{duration(report.to - report.from)} ago</small></span>
      <span className="hq-since-net"><strong className={report.net < 0 ? 'tone-danger' : 'tone-mint'}><Funds value={report.net} format="signed" /></strong><small><Funds value={report.gross} /> earned · <Funds value={expenses} /> spent</small></span>
    </header>
    {shown.length > 0
      ? <ul className="hq-since-lines" data-ui-list>{shown.map((line) => <li key={line.key} data-tone={line.tone}><Icon name={line.icon} size={18} /><span>{line.text}</span></li>)}</ul>
      : <p className="hq-since-quiet">A quiet shift. Nothing needs you.</p>}
    <footer className="hq-since-foot">
      <Button size="sm" variant="quiet" onClick={onReport}>{lines.length > shown.length ? `Full report (${lines.length - shown.length} more)` : 'Full report'}</Button>
      <Button size="sm" variant="primary" onClick={() => act({ type: 'acknowledgeReport' })}>Got it</Button>
    </footer>
  </section>;
}

/** Only what needs the player's hand, each a row that opens the place to fix it. Nothing here when
 * the department is fine, so a quiet department is a short screen. */
function NeedsYou({ g, overview, now, onFinances }: { g: GameState; overview: Overview; now: number; onFinances: () => void }) {
  const nav = useNav();
  const incomeLeft = g.department.lastInteractionAt + ECONOMY_TUNING.capMs - now;
  const worn = storeOptions(g).filter((option) => option.failed > 0).length;
  const onCall = overview.squads.filter((squad) => squad.deployed).reduce((n, squad) => n + squad.total, 0);
  const out = Math.max(0, overview.unavailable - onCall);
  const items: { key: string; icon: IconName; title: string; detail: string; tone: 'warn' | 'harm'; onOpen: () => void }[] = [
    ...(incomeLeft <= 0 ? [{ key: 'income', icon: 'hourglass' as const, title: 'Income is paused', detail: 'It restarts when you give an order.', tone: 'harm' as const, onOpen: onFinances }]
      : incomeLeft < 6 * HOUR_MS ? [{ key: 'income', icon: 'hourglass' as const, title: `Income stops in ${duration(incomeLeft)}`, detail: 'Give any order to keep it running.', tone: 'warn' as const, onOpen: onFinances }] : []),
    ...(overview.budget.net < 0 ? [{ key: 'costs', icon: 'cash' as const, title: 'Costs exceed income', detail: `The department loses ${fundingPerHour(Math.abs(overview.budget.net))}.`, tone: 'harm' as const, onOpen: onFinances }] : []),
    ...(out > 0 ? [{ key: 'out', icon: 'injured' as const, title: out === 1 ? '1 officer is out of action' : `${out} officers are out of action`, detail: 'They are not available for calls until they recover.', tone: 'warn' as const, onOpen: () => nav.setSquadSection('roster') }] : []),
    ...(worn > 0 ? [{ key: 'kit', icon: 'wrench' as const, title: worn === 1 ? '1 item needs service' : `${worn} items need service`, detail: 'Worn kit can fail on a call.', tone: 'warn' as const, onOpen: () => nav.go('gear') }] : []),
  ].slice(0, 3);
  if (items.length === 0) return null;
  return <Section title="Needs you" icon="warning">
    <div className="hq-list panel-well hq-needs" data-ui-list>{items.map((item) => <Row key={item.key} className={`hq-need hq-need-${item.tone}`} onClick={item.onOpen}
      lead={<Icon name={item.icon} size={22} />} title={item.title} detail={item.detail} trail={<Icon name="chevronRight" size={16} />} />)}</div>
  </Section>;
}

/** "Up next" (canvas HQ): the call closest to expiring as one card. The building with the call's
 * type, the title and the time left, the place, the time draining, what it pays, then who would go
 * (the best-fit squad's faces and its letter) and Open. The header counts what waits behind it. */
function UpNext({ g, card, waiting, at, now }: { g: GameState; card: GameState['incidents'][number]; waiting: number; at: number; now: number }) {
  const nav = useNav();
  const def = getScenario(card.id);
  const type = def?.incident?.type ?? card.type;
  const familyId = def?.locationFamilyId ?? def?.incident?.familyId ?? card.familyId;
  const tags = placeTags(familyId, scenarioPlaceName(def));
  const floors = scenarioFloorCount(def);
  const place = [tags.name, tags.kind, floors > 1 ? `${floors} floors` : null].filter(Boolean).join(' · ');
  const left = card.expiresAt - at;
  const span = card.expiresAt - card.arrivedAt;
  const soon = left < HOUR_MS;
  const best = bestFitSquad(g.squads.map((s) => ({ id: s.id, ...squadReadiness(g, s.id, at) })));
  const squad = best ? g.squads.find((s) => s.id === best) : undefined;
  const faces = best ? officersFrom(g, deployRoster(g, best, at).goes) : [];
  const readiness = best ? squadReadiness(g, best, at) : null;
  const ready = g.squads.filter((s) => squadReadiness(g, s.id, at).deployable && !squadDeployed(g, s.id)).length;
  const title = scenarioTitle(g, card.id, now);
  const open = () => openCallBrief(nav, card.id);
  return <Section title="Up next" icon="calls" action={<button type="button" className="section-link" onClick={() => nav.go('ops')}>{waiting === 1 ? '1 waiting' : `${waiting} waiting`}</button>}>
    <article className="hq-next" aria-label={`Up next: ${title}`}>
      <div className="hq-next-top">
        <span className="hq-next-thumb plate" aria-hidden="true"><PlateArt src={placeFor(familyId) ?? sceneFor(type)} />{type && <CallTypeBadge type={type} size={20} />}</span>
        <div className="hq-next-main">
          <div className="hq-next-head"><strong className="hq-next-title">{title}</strong><span className={`hq-next-left${soon ? ' hq-tone-warn' : ''}`}>{duration(left)}</span></div>
          {place && <span className="hq-next-place">{place}</span>}
          {span > 0 && <span className={`hq-next-time${soon ? ' hq-next-time-soon' : ''}`} role="img" aria-label={`${duration(left)} left`}><i style={{ width: `${Math.round(Math.max(0, Math.min(1, left / span)) * 100)}%` }} /></span>}
          {def?.rewards && <span className="hq-next-pay"><b className="tone-mint"><Funds value={def.rewards.funding} /></b><b className="hq-next-xp">{def.rewards.xp} XP</b>{def.difficulty && <span>{`${def.difficulty.band[0].toUpperCase()}${def.difficulty.band.slice(1)}`}</span>}</span>}
        </div>
      </div>
      <div className="hq-next-foot">
        {faces.length > 0 && <span className="hq-faces" role="group" aria-label="Would go">{faces.map((officer) => <Face key={officer.id} size="sm" kind="officer" officer={officer} name={officer.surname} status={officerFaceStatus(g, officer.id, at)} />)}</span>}
        <span className="hq-next-who">
          <strong>{squad ? `${squad.name} fits best` : ready === 0 ? 'No squad can deploy yet' : `${plural(ready, 'squad')} ready`}</strong>
          {squad && readiness && <span>{readiness.ready === readiness.total ? `All ${readiness.total} ready` : `${readiness.ready} of ${readiness.total} ready`}{squad.leaderId && g.officers[squad.leaderId] ? ` · ${g.officers[squad.leaderId].surname} leads` : ''}</span>}
        </span>
        <Button variant="primary" data-primary onClick={open} aria-label={`Open ${title}`}>Open</Button>
      </div>
    </article>
  </Section>;
}

/** The shift in four tiles (canvas HQ), each a real number and a tap to the screen that owns it: the
 * department's net rate, calls resolved, who is ready, and who is strained. Strain counts the whole
 * roster, on a call or off, so "None" is never hiding a strained officer (sol challenge). The canvas's
 * "Safe out" has no selector yet, so ready takes its place. */
function ShiftTiles({ g, overview, onFinances }: { g: GameState; overview: Overview; onFinances: () => void }) {
  const nav = useNav();
  const net = overview.budget.net;
  const strained = Object.values(g.officers).filter((officer) => officer.stress >= STRESS_BANDS.strained).length;
  const tiles: { key: string; label: string; value: ReactNode; spoken: string; tone?: 'good' | 'warn' | 'harm'; onOpen: () => void }[] = [
    { key: 'net', label: 'Net', value: <><Funds value={net} format="signed" /><small>/h</small></>, spoken: `Net ${fundingRate(net)}`, tone: net < 0 ? 'harm' : 'good', onOpen: onFinances },
    { key: 'resolved', label: 'Resolved', value: g.department.callsResolved, spoken: `${g.department.callsResolved} calls resolved`, onOpen: () => nav.go('ops') },
    { key: 'ready', label: 'Ready', value: <>{overview.deployable}<small>/{overview.totalOfficers}</small></>, spoken: `${overview.deployable} of ${overview.totalOfficers} officers ready`, tone: overview.deployable === 0 ? 'harm' : undefined, onOpen: () => nav.setTeamSection('swat') },
    { key: 'strain', label: 'Strained', value: strained === 0 ? 'None' : strained, spoken: strained === 0 ? 'No officer strained' : `${plural(strained, 'officer')} strained`, tone: strained > 0 ? 'warn' : undefined, onOpen: () => nav.setSquadSection('roster') },
  ];
  return <div className="hq-shift" role="group" aria-label="This shift">{tiles.map((tile) => <button key={tile.key} type="button" className="hq-shift-tile" data-tone={tile.tone} onClick={tile.onOpen} aria-label={tile.spoken}>
    <span aria-hidden="true">{tile.label}</span><strong aria-hidden="true">{tile.value}</strong>
  </button>)}</div>;
}

interface Clock { key: string; lead: ReactNode; title: string; detail: string; at: number; fraction: number | null; tone?: 'warn' | 'harm'; onOpen: () => void;
  /** The row's value at its trail (canvas HQ): the time left, or for income the net rate. */
  value: ReactNode }
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
    detail: incomeLeft <= 0 ? 'Paused until you give an order' : `Earning for another ${duration(incomeLeft)}`,
    value: <span className={overview.budget.net < 0 ? 'tone-danger' : 'tone-mint'}><Funds value={overview.budget.net} format="rate" /></span>,
    fraction: Math.max(0, Math.min(1, incomeLeft / ECONOMY_TUNING.capMs)),
    ...(incomeLeft <= 0 ? { tone: 'harm' as const } : incomeLeft < 6 * HOUR_MS ? { tone: 'warn' as const } : {}),
  };
  const next = overview.board.nextArrivalAt;
  const call: Clock[] = next ? [{ key: 'call', lead: <Icon name="calls" size={20} />, title: 'Next call', detail: 'A new call lands on the board', value: duration(Math.max(0, next - t)), at: next, fraction: null, onOpen: () => nav.go('ops') }] : [];
  const people: Clock[] = [];
  for (const officer of Object.values(g.officers)) {
    const status = officerFaceStatus(g, officer.id, t);
    if (!status?.until || status.until <= t || (status.mark !== 'injured' && status.mark !== 'resting' && status.mark !== 'training')) continue;
    const training = status.mark === 'training' && officer.assignment && 'startedAt' in officer.assignment ? officer.assignment : null;
    people.push({
      key: officer.id, lead: <Face size="sm" kind="officer" officer={officer} />, at: status.until,
      title: `${officer.surname} ${status.mark === 'training' ? 'trains' : 'is back'}`, detail: status.mark === 'training' ? 'Course ends' : status.mark === 'injured' ? 'Back from injury' : 'Back from rest', value: duration(status.until - t),
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
      title: `${profile?.surname ?? 'Patrol'} trains`, detail: 'Patrol course ends', value: duration(course.endsAt - t),
      fraction: share(course.startedAt, course.endsAt, t), onOpen: () => nav.setTeamSection('patrol'),
    });
  }
  people.sort((a, b) => a.at - b.at);
  const clocks = [income, ...call, ...people].slice(0, MAX_CLOCKS);
  return <Section title="On the clock" icon="clock" count={`${clocks.length} running`}>
    <div className="hq-list panel-well" data-ui-list>{clocks.map((clock) => <Row key={clock.key} className={`hq-clock${clock.tone ? ` hq-clock-${clock.tone}` : ''}`} onClick={clock.onOpen}
      label={`${clock.title}. ${clock.detail}${clock.key === 'income' ? `, net ${fundingRate(overview.budget.net)}` : `, in ${typeof clock.value === 'string' ? clock.value : ''}`}${clock.key === 'income' && incomeLeft <= 0 ? '. Any order resumes it' : ''}`}
      lead={clock.fraction === null ? <span className="hq-clock-open">{clock.lead}</span> : <Ring value={clock.fraction * 100} size={40} tone={clock.tone === 'harm' ? 'harm' : clock.tone === 'warn' ? 'warn' : 'act'}>{clock.lead}</Ring>}
      title={clock.title} detail={clock.tone ? <span className={`hq-tone-${clock.tone}`}>{clock.detail}</span> : clock.detail} trail={<strong className="hq-clock-value">{clock.value}</strong>} />)}</div>
  </Section>;
}

/** The HQ line for a waiting report: money and courses, then grants and promotions when there are any. */
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
    <Section id="hq-duties-h" title="Squads" icon="people" count={`${overview.deployable} of ${overview.totalOfficers} ready`}
      action={<button type="button" className="section-link" onClick={() => nav.setTeamSection('swat')}>Team<Icon name="chevronRight" size={16} /></button>}>
      {summary.length > 0 && <div className="hq-summary">{summary.map((s) => <button key={s.text} type="button" className={`hq-summary-item hq-summary-${s.tone}`} onClick={s.onOpen}><Icon name={s.icon} size={16} />{s.text}</button>)}</div>}
      {g.squads.length === 0 ? (
        <EmptyState compact icon="people" title="No squads yet">
          Create a squad in Team.
          <Button size="sm" onClick={() => nav.go('squad')}>Open Team</Button>
        </EmptyState>
      ) : <div id="hq-duties" className="hq-list panel-well" data-ui-list>{g.squads.map((s) => {
        const deployed = squadDeployed(g, s.id);
        const readiness = squadReadiness(g, s.id, g.department.clockHighWater);
        const members = s.officerIds.map((id) => g.officers[id]).filter(present);
        const statuses = members.map((o) => officerFaceStatus(g, o.id, g.department.clockHighWater));
        const strained = statuses.filter((status) => status?.mark === 'strained').length;
        // Back at full means everyone is back: the latest return, not the first (sol challenge).
        const back = statuses.filter((status): status is FaceStatus & { until: number } => !!status?.until && status.until > g.department.clockHighWater).sort((a, b) => b.until - a.until)[0];
        const allReady = !deployed && members.length > 0 && readiness.ready === members.length;
        const leader = s.leaderId ? g.officers[s.leaderId] : undefined;
        // One line of facts (canvas HQ): readiness, who leads, strain, and when the squad is whole again.
        const facts = [
          deployed ? `${plural(runRosterCount(g, s.id), 'officer')} on scene` : allReady ? `${members.length} ready` : `${readiness.ready} of ${members.length} ready`,
          strained ? `${strained} strained` : '',
          back ? `back at full in ${duration(back.until - g.department.clockHighWater)}` : '',
          leader ? `${leader.surname} leads` : '',
        ].filter(Boolean).join(' · ');
        return <Row key={s.id} className={`hq-duty hq-squad-row${deployed ? ' hq-squad-out' : ''}`}
          lead={<SquadCrest id={s.id} size={40} />}
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

export function Debriefs({ g, now }: { g: GameState; now: number }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const selected = g.debriefs.find((debrief) => debrief.runId === selectedId) ?? null;
  // Nothing played yet: the empty state alone, without a heading that says the same thing.
  if (g.debriefs.length === 0) return <EmptyState compact icon="chart" title="No results yet">Your first finished call shows here with what decided it.</EmptyState>;
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
          <span className="debrief-reward tone-mint"><Icon name="funds" size={16} />{signedMoney(d.fundingReward)}</span>
          <span className={`debrief-reward ${d.trustDelta >= 0 ? '' : 'tone-danger'}`}><Icon name="shield" size={16} />{d.trustDelta >= 0 ? '+' : ''}{d.trustDelta}</span>
        </span>
      </span>
      <Icon name="chevronRight" size={16} className="debrief-tile-go" />
    </button>
  );
}
