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
import { employedPatrol, patrolRates } from '../../sim/patrol';
import { Button, EmptyState, Row, Section } from '../components/ui';
import { useNav, type NavApi } from '../components/nav';
import { DUTY_META } from '../components/labels';
import { Icon } from '../icons';
import { CallTypeBadge } from '../icons/CallTypeBadge';
import { OutcomeMark } from '../icons/marks';
import { getScenario } from '../../sim/scenario-registry';
import { duration, perHour, plural, signedMoney } from '../format';
import { scenarioTitle } from './helpers';
import { callFlow } from './call-flow';
import { SavedDebriefReview } from './OpsDebrief';
import { ScoreRing } from '../components/DebriefResults';
import { Hub, type HubPin } from '../components/Hub';
import { ShiftReportCard } from '../components/ShiftReport';
import { PatrolActivity } from './Patrol';
import { PlateArt, sceneFor } from '../art/Plates';

/** HQ joins automatic patrol activity, the next department action and tactical readiness. */
export function HQ() {
  const g = useGame();
  const saved = useCampaigns();
  const nav = useNav();
  const [reportOpen, setReportOpen] = useState(false);
  const now = Date.now();
  const at = Math.max(now, g.department.clockHighWater);
  const overview = hqOverview(g, now);
  return (
    <>
    <Hub pins={hubPins(g, overview, nav)} title={g.department.name} meta={formatGameDate(gameDay(g, at))} />
    <div className="page hq-page">
      <PatrolActivity game={g} departmentNet={overview.budget.net} />
      <YourMove g={g} overview={overview} now={now} />
      {g.report && <Row className="hq-report" lead={<Icon name="dossier" size="md" />} title="Shift report" detail={reportSummary(g.report)} onClick={() => setReportOpen(true)} trail={<span className="hq-link">Review</span>} label={`Shift report: ${reportSummary(g.report)}. Review`} />}
      <DutySection squads={g.squads} g={g} />
      <Debriefs key={`${saved.campaignId ?? 'unsaved'}:${saved.session}`} g={g} now={now} />
      <Sheet open={reportOpen && !!g.report} onClose={() => setReportOpen(false)} title="Shift report">{g.report && <ShiftReportCard report={g.report} g={g} />}</Sheet>
    </div>
    </>
  );
}

type Overview = ReturnType<typeof hqOverview>;
type Nav = ReturnType<typeof useNav>;

/** Department state is factual; the painting does not assign these states to rooms. */
function hubPins(g: GameState, overview: Overview, nav: Nav): HubPin[] {
  const pins: HubPin[] = [];
  const run = g.activeRun;
  if (run) pins.push({ room: 'dispatch', text: run.status === 'debrief' ? 'Debrief waiting' : 'Call in progress', tone: 'act', onOpen: () => nav.go('ops') });
  else if (overview.board.count > 0) pins.push({ room: 'dispatch', text: overview.board.count === 1 ? '1 call waiting' : `${overview.board.count} calls waiting`, tone: 'act', onOpen: () => nav.go('ops') });
  const out = overview.unavailable - overview.squads.filter((squad) => squad.deployed).reduce((n, squad) => n + squad.total, 0);
  const ready = overview.squads.filter((squad) => squad.deployable && !squad.deployed).length;
  pins.push({ room: 'lockers', text: `${ready} SWAT ready`, detail: out > 0 ? `${out} unavailable` : overview.strained > 0 ? `${overview.strained} strained` : 'Squads available', onOpen: () => nav.setSquadSection('roster') });
  const patrol = patrolRates(g, g.department.clockHighWater);
  pins.push({ room: 'briefing', text: `${patrol.productive} patrol covering`, detail: `${employedPatrol(g).length} employed`, onOpen: () => nav.setTeamSection('patrol') });
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
      ? { title: `${title} is over`, line: 'The debrief waits. Done settles the call.', action: 'Open', onAct: () => nav.go('ops') }
      : { title: `${title} is live`, line: `${plural(run.squadIds.length, 'squad')} on scene.`, action: 'Return', onAct: () => nav.go('ops') };
  } else {
    const oldest = [...(g.incidents ?? [])].filter((card) => card.expiresAt > t).sort((a, b) => a.expiresAt - b.expiresAt)[0];
    if (oldest) {
      scene = sceneFor(oldest.type);
      move = { title: `${scenarioTitle(g, oldest.id, now)} is the oldest call`, line: `Expires in ${duration(oldest.expiresAt - t)}. ${readyLine}`, action: 'Open', onAct: () => openCallBrief(nav, oldest.id) };
    }
    else if (overview.squads.length > 0 && ready.length === 0) move = { title: 'No squad can deploy', line: 'Open Team to see who is out and why.', action: 'Team', onAct: () => nav.setTeamSection('swat') };
    else if (overview.budget.net < 0) move = { title: 'Costs exceed income', line: `Funding falls ${perHour(Math.abs(overview.budget.net))}. Review patrol coverage and costs.`, action: 'Patrol', onAct: () => nav.setTeamSection('patrol') };
  }
  if (!move) return null;
  return <section className={`hq-move${scene ? ' hq-move-scene' : ''}`} aria-label="Your move">
    {scene && <PlateArt src={scene} />}
    <div className="hq-move-main"><strong>{move.title}</strong><span>{move.line}</span></div>
    <Button variant="primary" onClick={move.onAct}>{move.action}</Button>
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

/** Duty is set here by hand, one row per squad: duty and readiness, the duty control, and, once a
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
      <div className="hq-head"><h2 id="hq-duties-h" className="section-title">SWAT readiness</h2><span className="hq-head-note">Standby or recovery</span></div>
      {squads.length === 0 ? (
        <EmptyState spot="openSlot" title="No squads yet">
          Create a squad in Team.
          <Button size="sm" onClick={() => go('squad')}>Open Team</Button>
        </EmptyState>
      ) : squads.map((s) => {
        const deployed = squadDeployed(g, s.id);
        const readiness = squadReadiness(g, s.id, g.department.clockHighWater);
        const total = s.officerIds.filter((id) => g.officers[id]).length;
        const managed = watch.hired && !policy.optOut.includes(s.id);
        return (
          <div key={s.id} className="ui-row hq-duty">
            <span className="ui-row-lead"><span className="squad-badge" aria-hidden="true">{s.id}</span></span>
            <span className="ui-row-main">
              <span className="ui-row-title">{s.name}</span>
              <span className="ui-row-detail">{deployed ? 'On a call' : DUTY_META[s.duty].label} · {deployed ? 0 : readiness.ready} of {total} ready</span>
              {watch.hired && <label className="hq-duty-auto">
                <input type="checkbox" role="switch" checked={managed} onChange={(e) => setManaged(s.id, e.target.checked)} />
                <span className="toggle-ui" aria-hidden="true" />
                <span>{managed ? `Watch Commander${watch.on ? '' : ', off duty'}` : 'Set by hand'}</span>
              </label>}
            </span>
            <span className="ui-row-trail">
              <label className="hq-duty-select">
                <span className="sr-only">Duty for {s.name}</span>
                <select value={s.duty} disabled={!!deployed} onChange={(e) => act({ type: 'setSquadDuty', squadId: s.id, duty: e.target.value as SquadDuty })}>
                  {(['standby', 'rest'] as SquadDuty[]).map((d) => <option key={d} value={d}>{DUTY_META[d].label}</option>)}
                </select>
              </label>
            </span>
          </div>
        );
      })}
      {squads.length > 0 && <p className="hq-duty-blurb">Standby keeps SWAT available. Rest speeds recovery. SWAT wages continue in either duty.</p>}
    </section>
  );
}

export function Debriefs({ g, now }: { g: GameState; now: number }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const selected = g.debriefs.find((debrief) => debrief.runId === selectedId) ?? null;
  return (
    <Section title="Recent results" icon="chart">
      {g.debriefs.length === 0 ? (
        <EmptyState spot="noDebriefs" title="No results yet">
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
        <ScoreRing value={d.objective.score}><Icon name="flag" size={14} /></ScoreRing>
        <ScoreRing value={d.civilianSafety.score}><Icon name="civilian" size={14} /></ScoreRing>
      </span>
      <span className="debrief-tile-main">
        <span className="debrief-tile-kicker">{type && <CallTypeBadge type={type} size={18} />}{scenarioTitle(g, d.scenarioId, now)}</span>
        <strong className="debrief-tile-title">{d.endingTitle}</strong>
        <span className="debrief-tile-sub"><OutcomeMark band={band} label={`${d.objective.label}`} showLabel={false} size={14} />Objective {d.objective.label.toLowerCase()} · Civilians {d.civilianSafety.label.toLowerCase()}</span>
        <span className="debrief-tile-foot">
          {team.length > 0 && <span className="debrief-team" aria-hidden="true">{team.map((officer) => <span key={officer.id} className="debrief-team-face"><Portrait officer={officer} size={24} /></span>)}</span>}
          <span className="debrief-reward tone-mint"><Icon name="cash" size={13} />{signedMoney(d.fundingReward)}</span>
          <span className={`debrief-reward ${d.trustDelta >= 0 ? '' : 'tone-danger'}`}><Icon name="shield" size={13} />{d.trustDelta >= 0 ? '+' : ''}{d.trustDelta}</span>
        </span>
      </span>
      <Icon name="chevronRight" size={16} className="debrief-tile-go" />
    </button>
  );
}
