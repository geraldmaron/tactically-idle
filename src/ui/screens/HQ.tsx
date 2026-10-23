import { useToast } from '../components/toast';
import { useState } from 'react';
import { useCampaigns, useGame } from '../store';
import { squadReadiness, storeOptions } from '../../sim/department-selectors';
import { hqOverview } from '../../sim/hq-selectors';
import { formatGameDate, gameDay } from '../../sim/calendar';
import { squadDeployed } from '../../sim/squads';
import { Sheet } from '../components/Sheet';
import { Portrait } from '../portraits/Portrait';
import './hq-overview.css';
import type { GameState, Id, SquadDuty, Squad, SquadId } from '../../sim/types';
import { commandStaffOf, managerView } from '../../sim/command-staff';
import { employedPatrol, patrolProfile, patrolRates } from '../../sim/patrol';
import { Button, EmptyState, Row, Section } from '../components/ui';
import { ChoiceRail } from '../components/ChoiceRail';
import { Face } from '../components/Face';
import { FinanceDetail } from '../components/Finance';
import { useNav, type NavApi } from '../components/nav';
import { DUTY_META } from '../components/labels';
import { Icon } from '../icons';
import { CallTypeBadge } from '../icons/CallTypeBadge';
import { OutcomeMark } from '../icons/marks';
import { getScenario } from '../../sim/scenario-registry';
import { duration, perHour, plural, rate, signedMoney } from '../format';
import { scenarioTitle } from './helpers';
import { callFlow } from './call-flow';
import { SavedDebriefReview } from './OpsDebrief';
import { ScoreRing } from '../components/DebriefResults';
import { Hub, type HubPin } from '../components/Hub';
import { ShiftReportCard } from '../components/ShiftReport';
import { PlateArt, sceneFor } from '../art/Plates';

/** HQ joins automatic patrol activity, the next department action and tactical readiness. */
export function HQ() {
  const g = useGame();
  const saved = useCampaigns();
  const nav = useNav();
  const [reportOpen, setReportOpen] = useState(false);
  const [financesOpen, setFinancesOpen] = useState(false);
  const now = Date.now();
  const at = Math.max(now, g.department.clockHighWater);
  const overview = hqOverview(g, now);
  return (
    <>
    <Hub pins={hubPins(g, overview, nav)} title={g.department.name} meta={formatGameDate(gameDay(g, at))} />
    <div className="page hq-page">
      <YourMove g={g} overview={overview} now={now} />
      {g.report && <Row className="hq-report" lead={<Icon name="dossier" size={20} />} title="Shift report" detail={reportSummary(g.report)} onClick={() => setReportOpen(true)} trail={<span className="hq-link">Review</span>} label={`Shift report: ${reportSummary(g.report)}. Review`} />}
      <DutySection squads={g.squads} g={g} />
      <PatrolRow g={g} onOpen={() => setFinancesOpen(true)} />
      <Debriefs key={`${saved.campaignId ?? 'unsaved'}:${saved.session}`} g={g} now={now} />
      <Sheet open={financesOpen} onClose={() => setFinancesOpen(false)} title="Finances"><FinanceDetail g={g} /></Sheet>
      <Sheet open={reportOpen && !!g.report} onClose={() => setReportOpen(false)} title="Shift report">{g.report && <ShiftReportCard report={g.report} g={g} />}</Sheet>
    </div>
    </>
  );
}

type Overview = ReturnType<typeof hqOverview>;
type Nav = ReturnType<typeof useNav>;

/** The plate speaks only about what the screen below does not already say: calls, squads and patrol
 * have their own rows. */
function hubPins(g: GameState, overview: Overview, nav: Nav): HubPin[] {
  const pins: HubPin[] = [];
  const resting = g.squads.filter((squad) => squad.duty === 'rest' && squad.officerIds.length > 0);
  if (overview.budget.net < 0) pins.push({ room: 'garage', text: 'Costs exceed income', tone: 'harm', onOpen: () => nav.setTeamSection('patrol') });
  else if (resting.length) pins.push({ room: 'garage', text: resting.length === 1 ? `${resting[0].name} resting` : `${resting.length} squads resting` });
  const worn = storeOptions(g).filter((option) => option.failed > 0).length;
  if (worn > 0) pins.push({ room: 'armory', text: worn === 1 ? '1 item needs service' : `${worn} items need service`, onOpen: () => nav.go('gear') });
  return pins;
}

/** Open one call's brief from HQ: the Calls tab, then the brief through `callFlow.openCall`, the path a board card takes. */
export function openCallBrief(nav: Pick<NavApi, 'go'>, scenarioId: Id) {
  nav.go('ops');
  callFlow.openCall(scenarioId);
}

/** The one "your move" card: the call that waits, else what keeps squads home, else money. */
function YourMove({ g, overview, now }: { g: GameState; overview: Overview; now: number }) {
  const nav = useNav();
  const run = g.activeRun;
  const t = Math.max(now, g.department.clockHighWater);
  const ready = overview.squads.filter((squad) => squad.deployable && !squad.deployed);
  const readyLine = ready.length === 0 ? 'No squad can deploy yet.' : ready.length === 1 ? `${ready[0].name} is ready.` : `${ready.length} squads are ready.`;
  let scene: string | null = null;
  let move: { title: string; line: string; action: string; onAct: () => void } | null = null;
  if (run) {
    scene = sceneFor(getScenario(run.scenarioId)?.incident?.type);
    const title = scenarioTitle(g, run.scenarioId, now);
    move = run.status === 'debrief'
      ? { title: `${title} is over`, line: 'The debrief waits. Next call settles it.', action: 'Open', onAct: () => nav.go('ops') }
      : { title: `${title} is live`, line: `${plural(run.squadIds.length, 'squad')} on scene.`, action: 'Return', onAct: () => nav.go('ops') };
  } else {
    const oldest = [...(g.incidents ?? [])].filter((card) => card.expiresAt > t).sort((a, b) => a.expiresAt - b.expiresAt)[0];
    if (oldest) {
      scene = sceneFor(oldest.type);
      move = { title: `${scenarioTitle(g, oldest.id, now)} is the oldest call`, line: `Expires in ${duration(oldest.expiresAt - t)}. ${readyLine}`, action: 'Open', onAct: () => openCallBrief(nav, oldest.id) };
    }
    else if (overview.squads.length > 0 && ready.length === 0) move = { title: 'No squad can deploy', line: 'Open Team to see who is out and why.', action: 'Team', onAct: () => nav.setTeamSection('swat') };
    else if (overview.budget.net < 0) move = { title: 'Costs exceed income', line: `Funding falls ${perHour(Math.abs(overview.budget.net))}. Review patrol coverage and costs.`, action: 'Patrol', onAct: () => nav.setTeamSection('patrol') };
    else move = { title: 'No call waiting', line: 'Funding can go to the next build.', action: 'Build', onAct: () => nav.go('develop') };
  }
  if (!move) return null;
  return <section className={`hq-move${scene ? ' hq-move-scene' : ''}`} aria-label="Your move">
    {scene && <PlateArt src={scene} />}
    <div className="hq-move-main"><strong>{move.title}</strong><span>{move.line}</span></div>
    <Button variant="primary" data-primary onClick={move.onAct}>{move.action}</Button>
  </section>;
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

/** One row per squad: its faces, its name, duty and readiness; the duty rail under it, and, once a
 * Watch Commander is hired, whether they run this squad's duty (the automation opt-out). */
function DutySection({ squads, g }: { squads: Squad[]; g: GameState }) {
  const { act } = useToast();
  const { go } = useNav();
  const watch = managerView(g, 'watch_commander');
  const policy = commandStaffOf(g).watch_commander.policy;
  const setManaged = (squadId: SquadId, managed: boolean) => {
    const optOut = managed ? policy.optOut.filter((id) => id !== squadId) : [...policy.optOut, squadId];
    act({ type: 'setManagerPolicy', patch: { managerId: 'watch_commander', optOut } }, managed ? 'Squad duty handed to the Watch Commander' : 'Squad kept on manual duty');
  };
  return (
    <section id="hq-duties" className="hq-duties" aria-labelledby="hq-duties-h">
      <div className="hq-head"><h2 id="hq-duties-h" className="section-title">SWAT readiness</h2></div>
      {squads.length === 0 ? (
        <EmptyState compact icon="people" title="No squads yet">
          Create a squad in Team.
          <Button size="sm" onClick={() => go('squad')}>Open Team</Button>
        </EmptyState>
      ) : squads.map((s) => {
        const deployed = squadDeployed(g, s.id);
        const readiness = squadReadiness(g, s.id, g.department.clockHighWater);
        const members = s.officerIds.map((id) => g.officers[id]).filter((officer): officer is NonNullable<typeof officer> => !!officer);
        const managed = watch.hired && !policy.optOut.includes(s.id);
        return (
          <div key={s.id} className="hq-squad">
            <Row className="hq-duty"
              lead={<span className="hq-faces" aria-hidden="true">{members.slice(0, 3).map((officer) => <Face key={officer.id} size="sm" kind="officer" officer={officer} />)}</span>}
              title={s.name}
              detail={deployed ? 'On a call' : `${readiness.ready} of ${members.length} ready`} />
            <ChoiceRail label={`Duty for ${s.name}`} value={s.duty}
              options={(['standby', 'rest'] as SquadDuty[]).map((d) => ({ value: d, label: DUTY_META[d].label, disabled: !!deployed }))}
              onChange={(duty) => act({ type: 'setSquadDuty', squadId: s.id, duty })} />
            {watch.hired && <label className="hq-duty-auto">
              <input type="checkbox" role="switch" checked={managed} onChange={(e) => setManaged(s.id, e.target.checked)} />
              <span className="toggle-ui" aria-hidden="true" />
              <span>{managed ? `Watch Commander${watch.on ? '' : ', off duty'}` : 'Set by hand'}</span>
            </label>}
          </div>
        );
      })}
    </section>
  );
}

/** Patrol as one income row: its faces, how many are covering, what it nets an hour. It opens Finances. */
function PatrolRow({ g, onOpen }: { g: GameState; onOpen: () => void }) {
  const employees = employedPatrol(g);
  const rates = patrolRates(g, g.department.clockHighWater);
  return <div data-patrol-funding-origin><Row className="hq-patrol"
    lead={<span className="hq-faces" aria-hidden="true">{employees.slice(0, 3).map((employee) => <Face key={employee.id} size="sm" kind="patrol" src={patrolProfile(employee.profileId)?.portrait} />)}</span>}
    title="Patrol coverage" detail={`${rates.productive} covering · ${rates.employed} employed`}
    trail={<span className="hq-patrol-rate"><strong>{rate(rates.net)}</strong></span>}
    onClick={onOpen} label={`Patrol coverage: ${rates.productive} covering, ${rate(rates.net)} after costs. Open finances`} /></div>;
}

export function Debriefs({ g, now }: { g: GameState; now: number }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const selected = g.debriefs.find((debrief) => debrief.runId === selectedId) ?? null;
  return (
    <Section title="Recent results" icon="chart">
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
  const team = d.officerCondition.map((row) => g.officers[row.officerId]).filter((officer): officer is NonNullable<typeof officer> => !!officer).slice(0, 4);
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
