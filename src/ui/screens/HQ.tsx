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
import type { GameState, SquadDuty, Squad, SquadId } from '../../sim/types';
import { commandStaffOf, managerView } from '../../sim/command-staff';
import { Button, EmptyState, Row, Section } from '../components/ui';
import { useNav } from '../components/nav';
import { DUTIES, DUTY_META } from '../components/labels';
import { Icon } from '../icons';
import { CallTypeBadge } from '../icons/CallTypeBadge';
import { OutcomeMark } from '../icons/marks';
import { getScenario } from '../../sim/scenario-registry';
import { duration, perHour, plural, signedMoney } from '../format';
import { scenarioTitle } from './helpers';
import { SavedDebriefReview } from './OpsDebrief';
import { ScoreRing } from '../components/DebriefResults';
import { CommandStaff } from '../components/CommandStaff';
import { Hub, type HubPin } from '../components/Hub';
import { TabPlate } from '../art/TabPlate';
import { ShiftReportCard } from '../components/ShiftReport';
import { TapEarn } from '../components/TapEarn';

/** HQ is the department's status (docs/ui-ux-audit.md, "HQ"): the cutaway with a pin only where
 * something needs the player, one card for the most pressing move, the duty rows (the one place
 * duty is set by hand, with each squad's Watch Commander opt-out on its row) beside the paid
 * details they feed, Command Staff, and recent results. Funding, rate, trust and level live in the
 * resource bar; the shift report stays reopenable here after the welcome sheet. */
export function HQ() {
  const g = useGame();
  const saved = useCampaigns();
  const nav = useNav();
  const [reportOpen, setReportOpen] = useState(false);
  const now = Date.now();
  const at = Math.max(now, g.department.clockHighWater);
  const overview = hqOverview(g, now);
  const scrollToDuty = () => document.getElementById('hq-duties')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  return (
    <>
    <TabPlate tab="hq" level={1} title={g.department.name} meta={formatGameDate(gameDay(g, at))} />
    <Hub pins={hubPins(g, overview, nav)} />
    <div className="page hq-page">
      <YourMove g={g} overview={overview} now={now} onDuty={scrollToDuty} />
      {g.report && <Row className="hq-report" title="Shift report" detail={reportSummary(g.report)} onClick={() => setReportOpen(true)} trail={<span className="hq-link">Review</span>} label={`Shift report: ${reportSummary(g.report)}. Review`} />}
      <DutySection squads={g.squads} g={g} />
      <TapEarn />
      <CommandStaff />
      <Debriefs key={`${saved.campaignId ?? 'unsaved'}:${saved.session}`} g={g} now={now} />
      <Sheet open={reportOpen && !!g.report} onClose={() => setReportOpen(false)} title="Shift report">{g.report && <ShiftReportCard report={g.report} g={g} />}</Sheet>
    </div>
    </>
  );
}

type Overview = ReturnType<typeof hqOverview>;
type Nav = ReturnType<typeof useNav>;

/** Pins speak only when something in a room needs the player; the rooms are not buttons to tabs. */
function hubPins(g: GameState, overview: Overview, nav: Nav): HubPin[] {
  const pins: HubPin[] = [];
  const run = g.activeRun;
  if (run) pins.push({ room: 'dispatch', text: run.status === 'debrief' ? 'Debrief waiting' : 'Call in progress', tone: 'act', onOpen: () => nav.go('ops') });
  else if (overview.board.count > 0) pins.push({ room: 'dispatch', text: overview.board.count === 1 ? '1 call waiting' : `${overview.board.count} calls waiting`, tone: 'act', onOpen: () => nav.go('ops') });
  const out = overview.unavailable - overview.squads.filter((squad) => squad.deployed).reduce((n, squad) => n + squad.total, 0);
  if (out > 0) pins.push({ room: 'lockers', text: out === 1 ? '1 officer unavailable' : `${out} officers unavailable`, onOpen: () => nav.setSquadSection('roster') });
  else if (overview.strained > 0) pins.push({ room: 'lockers', text: overview.strained === 1 ? '1 officer strained' : `${overview.strained} officers strained`, onOpen: () => nav.setSquadSection('roster') });
  const resting = g.squads.filter((squad) => squad.duty === 'rest' && squad.officerIds.length > 0);
  if (overview.budget.net < 0) pins.push({ room: 'garage', text: 'Duty costs more than it earns', tone: 'harm' });
  else if (resting.length) pins.push({ room: 'garage', text: resting.length === 1 ? `${resting[0].name} resting` : `${resting.length} squads resting` });
  const worn = storeOptions(g).filter((option) => option.failed > 0).length;
  if (worn > 0) pins.push({ room: 'armory', text: worn === 1 ? '1 item needs service' : `${worn} items need service`, onOpen: () => nav.go('gear') });
  return pins;
}

/** The one "your move" card: the call that waits, else what keeps squads home, else money. */
function YourMove({ g, overview, now, onDuty }: { g: GameState; overview: Overview; now: number; onDuty: () => void }) {
  const nav = useNav();
  const run = g.activeRun;
  const t = Math.max(now, g.department.clockHighWater);
  const ready = overview.squads.filter((squad) => squad.deployable && !squad.deployed);
  const readyLine = ready.length === 0 ? 'No squad can deploy yet.' : ready.length === 1 ? `${ready[0].name} is ready.` : `${ready.length} squads are ready.`;
  let move: { title: string; line: string; action: string; onAct: () => void } | null = null;
  if (run) {
    const title = scenarioTitle(g, run.scenarioId, now);
    move = run.status === 'debrief'
      ? { title: `${title} is over`, line: 'The debrief waits. Done settles the call.', action: 'Open', onAct: () => nav.go('ops') }
      : { title: `${title} is live`, line: `${plural(run.squadIds.length, 'squad')} on scene.`, action: 'Return', onAct: () => nav.go('ops') };
  } else {
    const oldest = [...(g.incidents ?? [])].filter((card) => card.expiresAt > t).sort((a, b) => a.expiresAt - b.expiresAt)[0];
    if (oldest) move = { title: `${scenarioTitle(g, oldest.id, now)} is the oldest call`, line: `Expires in ${duration(oldest.expiresAt - t)}. ${readyLine}`, action: 'Open', onAct: () => nav.go('ops') };
    else if (overview.squads.length > 0 && ready.length === 0) move = { title: 'No squad can deploy', line: 'Open Officers to see who is out and why.', action: 'Officers', onAct: () => nav.go('squad') };
    else if (overview.budget.net < 0) move = { title: 'Duty costs more than it earns', line: `Funding falls ${perHour(Math.abs(overview.budget.net))}. Put a squad on patrol.`, action: 'Duty', onAct: onDuty };
  }
  if (!move) return null;
  return <section className="hq-move" aria-label="Your move">
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
      <div className="hq-head"><h2 id="hq-duties-h" className="section-title">On duty</h2><span className="hq-head-note">Duty sets income and recovery</span></div>
      {squads.length === 0 ? (
        <EmptyState spot="openSlot" title="No squads yet">
          Create a squad on the Officers tab.
          <Button size="sm" onClick={() => go('squad')}>Open Officers</Button>
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
                  {DUTIES.map((d) => <option key={d} value={d}>{DUTY_META[d].label}</option>)}
                </select>
              </label>
            </span>
          </div>
        );
      })}
      {squads.length > 0 && <p className="hq-duty-blurb">Patrol earns routine funding. Standby keeps a squad ready. Rest recovers stress fastest.</p>}
    </section>
  );
}

export function Debriefs({ g, now }: { g: GameState; now: number }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const selected = g.debriefs.find((debrief) => debrief.runId === selectedId) ?? null;
  return (
    <Section title="Recent results">
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
