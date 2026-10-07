import { useState } from 'react';
import { useCampaigns, useGame } from '../store';
import { squadReadiness } from '../../sim/department-selectors';
import { hqOverview } from '../../sim/hq-selectors';
import { formatGameDate, gameDay } from '../../sim/calendar';
import { squadDeployed } from '../../sim/economy';
import { Sheet } from '../components/Sheet';
import { Portrait } from '../portraits/Portrait';
import './hq-overview.css';
import { COURSES } from '../../content/courses';
import type { Budget } from '../../sim/department-selectors';
import type { GameState, ShiftReport, SquadDuty, Squad } from '../../sim/types';
import { Button, Card, Chip, EmptyState, KV, Section, Segmented } from '../components/ui';
import { useToast } from '../components/toast';
import { useNav } from '../components/nav';
import { DUTIES, DUTY_META } from '../components/labels';
import { Icon, itemIcon } from '../icons';
import type { IconName } from '../icons';
import { ITEMS } from '../../content/items';
import { duration, money, perHour, plural, rate, signedMoney } from '../format';
import { fullName } from '../../sim/officer';
import { scenarioTitle } from './helpers';
import { SavedDebriefReview } from './OpsDebrief';
import { ScoreRing } from '../components/DebriefResults';
import { CommandStaff } from '../components/CommandStaff';

export function HQ() {
  const g = useGame();
  const saved = useCampaigns();
  const nav = useNav();
  const { act } = useToast();
  const [reportOpen, setReportOpen] = useState(false);
  const now = Date.now();
  const overview = hqOverview(g, now);
  const b = overview.budget;
  const campaign = saved.slots.find((slot) => slot?.campaignId === saved.campaignId);
  const attention: { text: string; action: string; tab: 'ops' | 'squad' | 'gear' | 'develop' }[] = [];
  if (overview.board.expiringSoon) attention.push({ text: `${overview.board.expiringSoon} incident${overview.board.expiringSoon === 1 ? '' : 's'} closing soon`, action:'Review calls',tab:'ops' });
  if (overview.radios.shortage) attention.push({ text:`All idle squads need ${overview.radios.required} radios; ${overview.radios.available} usable in stock`,action:'Review equipment',tab:'gear' });
  if (overview.unavailable) attention.push({ text:`${overview.unavailable} officer${overview.unavailable === 1 ? '' : 's'} unavailable for deployment`,action:'Review squad',tab:'squad' });
  if (overview.emptySeats) attention.push({ text:`${overview.emptySeats} open seats across staffed idle squads`,action:'Arrange squads',tab:'squad' });
  if (b.net < 0) attention.push({ text:`Current duties spend ${money(Math.abs(b.net))} more per hour than they earn`,action:'Review duties',tab:'squad' });
  return (
    <div className="page hq-page">
      <header className="hq-identity">
        <span className="hq-eyebrow">Department headquarters</span><h2>{g.department.name}</h2>
        <p>{formatGameDate(gameDay(g, Math.max(now, g.department.clockHighWater)))}{campaign ? ` · ${campaign.name}` : ''}</p>
        <div className="chips"><Chip icon="medal">Level {g.department.level}</Chip><Chip icon="people">Public trust {Math.round(g.department.trust)} / 100</Chip></div>
        <HeaderBudget g={g} b={b} />
        <RosterSummary g={g} overview={overview} />
      </header>
      {g.activeRun && <ActiveOpCard g={g} now={now} />}
      {g.equipmentPowerUpgrade && <Card className="hq-power-receipt"><strong>Power supplies are now included</strong><p>Your {g.equipmentPowerUpgrade.retiredUnits} separate battery units were retired. Unused stock was credited {money(g.equipmentPowerUpgrade.refundedFunding)} to department funding. Equipment no longer needs separate batteries.</p><Button size="sm" onClick={() => act({ type:'acknowledgePowerUpgrade' })}>Got it</Button></Card>}
      {g.report && <section className="hq-report-summary"><div><strong>Shift report ready</strong><p>{signedMoney(g.report.net)} net funding · {g.report.completedCourses.length} courses completed</p></div><Button size="sm" onClick={() => setReportOpen(true)}>Review report</Button></section>}
      <CommandStaff />
      <section className="hq-status-grid" aria-label="Department overview">
        <button onClick={() => nav.setSquadSection('roster')}><span>Staffed squads</span><strong>{overview.staffedSquads}<small> / {g.squads.length}</small></strong><small>{overview.squads.filter((squad) => squad.deployed).length} on operation</small></button>
        <button onClick={() => nav.openTraining()}><span>Training places</span><strong>{overview.training}<small> / {overview.trainingSlots}</small></strong><small>Officers currently in courses</small></button>
        <button onClick={() => nav.go('ops')}><span>Live incidents</span><strong>{overview.board.count}</strong><small>{overview.board.newCount} unseen · {overview.board.expiringSoon} closing soon</small></button>
      </section>
      {!!attention.length && <section className="hq-attention"><h2 className="section-title">Needs attention</h2>{attention.slice(0, 3).map((item) => <div key={item.text}><span>{item.text}</span><Button size="sm" onClick={() => nav.go(item.tab)}>{item.action}</Button></div>)}</section>}
      <DutySection squads={g.squads} g={g} />
      <Debriefs key={`${saved.campaignId ?? 'unsaved'}:${saved.session}`} g={g} now={now} />
      <Sheet open={reportOpen && !!g.report} onClose={() => setReportOpen(false)} title="Shift report">{g.report && <ShiftReportCard report={g.report} g={g} />}</Sheet>
    </div>
  );
}

/** Money at a glance in the department header: funding, net per hour and DP per hour. The full
 * hourly breakdown opens in place, so the budget is never a scroll away. */
function HeaderBudget({ g, b }: { g: GameState; b: Budget }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="hq-money">
      <button type="button" className="hq-money-row" aria-expanded={open} onClick={() => setOpen((value) => !value)} aria-label={`Funding ${money(g.department.funding)}, ${rate(b.net)} net, ${b.devPointsPerHour.toFixed(1)} development points per hour. ${open ? 'Hide' : 'Show'} hourly budget`}>
        <span className="hq-money-stat"><small>Funding</small><strong className="hq-money-funding">{money(g.department.funding)}</strong></span>
        <span className="hq-money-stat"><small>Net</small><strong className={b.net < 0 ? 'tone-danger' : 'tone-mint'}>{rate(b.net)}</strong></span>
        <span className="hq-money-stat"><small>Dev points</small><strong>{b.devPointsPerHour.toFixed(1)}/h</strong></span>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} className="hq-money-toggle" />
      </button>
      {open && <BudgetCard b={b} />}
    </div>
  );
}

/** Roster readiness that scales to a full headcount: one bar across every officer by state, a
 * stacked face group, and each squad's fit count. Tapping opens the roster. */
function RosterSummary({ g, overview }: { g: GameState; overview: ReturnType<typeof hqOverview> }) {
  const nav = useNav();
  const officers = Object.values(g.officers);
  const total = Math.max(1, overview.totalOfficers);
  const deployed = officers.filter((officer) => officer.squadId && squadDeployed(g, officer.squadId)).length;
  const resting = Math.max(0, overview.unavailable - deployed - overview.training);
  const segments = [
    { key: 'fresh', label: 'Fresh', value: overview.fresh },
    { key: 'strained', label: 'Strained', value: overview.strained },
    { key: 'training', label: 'Training', value: overview.training },
    { key: 'deployed', label: 'On operation', value: deployed },
    { key: 'resting', label: 'Resting or injured', value: resting },
  ].filter((segment) => segment.value > 0);
  const faces = officers.slice(0, 6);
  return (
    <button type="button" className="hq-roster" onClick={() => nav.setSquadSection('roster')} aria-label={`${overview.totalOfficers} officers: ${segments.map((segment) => `${segment.value} ${segment.label.toLowerCase()}`).join(', ')}. Open roster`}>
      <span className="hq-roster-top">
        <span className="hq-roster-faces" aria-hidden="true">{faces.map((officer) => <span key={officer.id} className="hq-roster-face"><Portrait officer={officer} size={28} /></span>)}{officers.length > faces.length && <span className="hq-roster-more">+{officers.length - faces.length}</span>}</span>
        <span className="hq-roster-count"><strong>{overview.deployable}</strong>/{overview.totalOfficers} ready</span>
      </span>
      <span className="hq-roster-bar" aria-hidden="true">{segments.map((segment) => <i key={segment.key} data-state={segment.key} style={{ flexGrow: segment.value / total }} />)}</span>
      <span className="hq-roster-legend" aria-hidden="true">{segments.map((segment) => <span key={segment.key} data-state={segment.key}><i />{segment.value} {segment.label}</span>)}</span>
      <span className="hq-roster-squads" aria-hidden="true">{overview.squads.filter((squad) => squad.total > 0).map((squad) => <span key={squad.squadId} className={squad.deployed ? 'hq-squad-out' : ''}><b>{squad.squadId}</b>{squad.deployed ? 'Out' : `${squad.fresh}/${squad.total}`}</span>)}</span>
    </button>
  );
}

type Tone = 'mint' | 'amber' | 'warn' | 'danger' | 'blue' | 'neutral';

const EQUIPMENT_EVENT: Record<ShiftReport['equipment'][number]['event'], { chip: string; text: string; icon: IconName; tone: Tone; warn: boolean }> = {
  unreliable: { chip: 'Unreliable', text: 'now unreliable and may malfunction', icon: 'warning', tone: 'warn', warn: true },
  failed: { chip: 'Failed', text: 'failed and cannot deploy until serviced', icon: 'xcircle', tone: 'danger', warn: true },
  expired: { chip: 'Expired', text: 'passed its shelf life', icon: 'wait', tone: 'danger', warn: true },
  serviced: { chip: 'Serviced', text: 'back from service', icon: 'wrench', tone: 'mint', warn: false },
};

const PERSONNEL_EVENT: Record<ShiftReport['personnel'][number]['event'], { chip: string; icon: IconName; tone: Tone; warn: boolean }> = {
  retirement_announced: { chip: 'Retiring', icon: 'retire', tone: 'warn', warn: true },
  retired: { chip: 'Retired', icon: 'door', tone: 'danger', warn: true },
  anniversary: { chip: 'Anniversary', icon: 'medal', tone: 'mint', warn: false },
  birthday: { chip: 'Birthday', icon: 'cake', tone: 'blue', warn: false },
};

function ShiftReportCard({ report, g }: { report: ShiftReport; g: GameState }) {
  const { act } = useToast();
  const elapsed = report.to - report.from;
  return (
    <section className="card card-amber report" aria-label="Shift report">
      <div className="section-head">
        <h2 className="section-title">
          <Icon name="list" size={18} />
          Shift report
        </h2>
        <Chip icon="clock">{duration(elapsed)} away</Chip>
      </div>
      <div className="report-net">
        <span className="report-net-label">
          <Icon name="cash" size={16} />
          Net funding
        </span>
        <span className={`report-net-val ${report.net < 0 ? 'tone-danger' : 'tone-mint'}`}>{signedMoney(report.net)}</span>
      </div>
      <KV icon="trend" k="Gross income" v={money(report.gross)} />
      <KV icon="people" k="Wages" v={`-${money(report.wages)}`} />
      <KV icon="gear" k="Operating costs" v={`-${money(report.operating)}`} />
      {report.restockSpend > 0 && <KV icon="box" k="Restocking" v={`-${money(report.restockSpend)}`} />}
      {(report.maintenanceSpend ?? 0) > 0 && <KV icon="wrench" k="Equipment manager servicing" v={`-${money(report.maintenanceSpend ?? 0)}`} />}
      {(report.maintenanceStarted?.length ?? 0) > 0 && <p className="dim">Sent for service: {report.maintenanceStarted!.map((id) => g.units[id]?.serial ?? id).join(', ')}.</p>}
      {report.devPoints > 0 && <KV icon="chart" k="Development points" v={`+${Math.round(report.devPoints * 10) / 10}`} tone="amber" />}
      {report.capped && (
        <p className="note note-amber">
          <Icon name="info" size={16} />
          Capped at 24h: income and wages stop accruing after a day without orders ({duration(report.accruedHours * 3600000)} counted).
        </p>
      )}
      {report.completedCourses.length > 0 && (
        <div className="report-list">
          <h3>
            <Icon name="mortarboard" size={15} />
            Completed courses
          </h3>
          <ul>
            {report.completedCourses.map((c, i) => (
              <li key={i}>
                <Icon name="check" size={14} />
                {g.officers[c.officerId]?.surname ?? 'Officer'}: {COURSES[c.courseId]?.name ?? c.courseId}
              </li>
            ))}
          </ul>
        </div>
      )}
      {report.recovered.length > 0 && (
        <div className="report-list">
          <h3>
            <Icon name="pulse" size={15} />
            Recovered, deployable again
          </h3>
          <ul>
            {report.recovered.map((id) => (
              <li key={id}>
                <Icon name="check" size={14} />
                {g.officers[id] ? fullName(g.officers[id]) : id}
              </li>
            ))}
          </ul>
        </div>
      )}
      {report.shortages.filter((line) => !/battery/i.test(line)).length > 0 && (
        <div className="report-list report-warn">
          <h3>
            <Icon name="warning" size={15} />
            Shortages
          </h3>
          <ul>
            {report.shortages.filter((line) => !/battery/i.test(line)).map((s, i) => (
              <li key={i}>
                <Icon name="warning" size={14} />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(report.equipment ?? []).length > 0 && (
        <div className="report-list">
          <h3>
            <Icon name="wrench" size={15} />
            Equipment
          </h3>
          <ul>
            {report.equipment.map((e, i) => {
              const u = g.units[e.unitId];
              const m = EQUIPMENT_EVENT[e.event];
              const name = u ? `${u.serial} ${ITEMS[u.itemId]?.name ?? u.itemId}` : e.unitId;
              return (
                <li key={i} className={m.warn ? 'report-bad' : ''}>
                  <Icon name={u ? itemIcon(u.itemId) : m.icon} size={14} />
                  <span>
                    {name}: {m.text}
                  </span>
                  <Chip tone={m.tone} icon={m.icon}>
                    {m.chip}
                  </Chip>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {(report.personnel ?? []).length > 0 && (
        <div className="report-list">
          <h3>
            <Icon name="people" size={15} />
            Personnel
          </h3>
          <ul>
            {report.personnel.map((p, i) => {
              const m = PERSONNEL_EVENT[p.event];
              const who = g.officers[p.officerId];
              return (
                <li key={i} className={m.warn ? 'report-bad' : ''}>
                  <Icon name={m.icon} size={14} />
                  <span>
                    {who ? fullName(who) : 'Officer'}: {p.detail}
                  </span>
                  <Chip tone={m.tone} icon={m.icon}>
                    {m.chip}
                  </Chip>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <Button variant="primary" block onClick={() => act({ type: 'acknowledgeReport' })}>
        Acknowledge
      </Button>
    </section>
  );
}

function ActiveOpCard({ g, now }: { g: GameState; now: number }) {
  const { go } = useNav();
  const run = g.activeRun!;
  const debrief = run.status === 'debrief';
  return (
    <button type="button" className="card card-link opcard" onClick={() => go('ops')}>
      <span className="opcard-icon">
        <Icon name="pin" size={26} />
      </span>
      <span className="opcard-main">
        <span className="opcard-kicker">Operation{debrief ? ' · debrief ready' : ' · live'}</span>
        <span className="opcard-title">{scenarioTitle(g, run.scenarioId, now).toUpperCase()}</span>
        <span className="opcard-sub">
          {plural(run.squadIds.length, 'squad')} deployed · {run.stage === 'debrief' ? 'Debrief' : `Stage: ${run.stage}`}
        </span>
      </span>
      <Icon name="chevronRight" size={20} />
    </button>
  );
}

function BudgetCard({ b }: { b: Budget }) {
  return (
    <Section title="Hourly budget" icon="cash" hint="Funding per hour while squads are on duty. Wages are paid whether or not you are watching.">
      <Card>
        <KV icon="cash" k="Base allocation" v={perHour(b.base)} />
        <KV icon="patrol" k="Patrol work" v={perHour(b.patrol)} />
        {b.nodeIncome !== 0 && <KV icon="chart" k="Development income" v={perHour(b.nodeIncome)} />}
        <KV icon="trend" k="Gross" v={perHour(b.gross)} strong />
        <KV icon="people" k="Officer wages" v={`-${perHour(b.wages)}`} />
        <KV icon="gear" k="Facilities" v={`-${perHour(b.operating)}`} />
        <KV icon="box" k="Routine supplies" v={`-${perHour(b.supplies)}`} />
        {b.staff > 0 && <KV icon="people" k="Command staff" v={`-${perHour(b.staff)}`} />}
        <KV icon="cash" k="Net" v={rate(b.net)} tone={b.net < 0 ? 'danger' : 'mint'} strong />
        <KV icon="chart" k="Development points" v={`${b.devPointsPerHour.toFixed(1)}/h`} />
      </Card>
    </Section>
  );
}

function DutySection({ squads, g }: { squads: Squad[]; g: GameState }) {
  const { act } = useToast();
  const { go } = useNav();
  return (
    <Section title="Squad duty" icon="patrol" hint="Patrol earns routine funding. Standby keeps a squad ready. Rest recovers stress fastest.">
      {squads.length === 0 ? (
        <Card>
          <EmptyState icon="people" title="No squads yet">
            Create a squad on the Squad tab.
            <Button size="sm" variant="secondary" onClick={() => go('squad')}>
              Open Squad
            </Button>
          </EmptyState>
        </Card>
      ) : (
        <div className="stack">
          {squads.map((s) => {
            const deployed = squadDeployed(g, s.id);
            const members = s.officerIds.map((id) => g.officers[id]).filter(Boolean);
            const readiness = squadReadiness(g, s.id, g.department.clockHighWater);
            return (
              <Card key={s.id} className="dutycard">
                <div className="dutycard-head">
                  <span className="squad-badge">{s.id}</span>
                  <div className="dutycard-name">
                    <strong>{s.name}</strong>
                    <span>
                      {plural(members.length, 'officer')}
                      {` · ${deployed ? 0 : readiness.ready} / ${members.length} deployable`}
                    </span>
                  </div>
                  {deployed && <Chip tone="amber">Deployed</Chip>}
                </div>
                <Segmented<SquadDuty>
                  label={`Duty for ${s.name}`}
                  value={s.duty}
                  onChange={(duty) => act({ type: 'setSquadDuty', squadId: s.id, duty })}
                  options={DUTIES.map((d) => ({
                    value: d,
                    disabled: !!deployed,
                    label: (
                      <>
                        <Icon name={DUTY_META[d].icon} size={16} />
                        {DUTY_META[d].label}
                      </>
                    ),
                  }))}
                />
                <p className="dutycard-blurb">{deployed ? 'Deployed squads cannot take routine duty.' : DUTY_META[s.duty].blurb}</p>
              </Card>
            );
          })}
        </div>
      )}
    </Section>
  );
}

export function Debriefs({ g, now }: { g: GameState; now: number }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const selected = g.debriefs.find((debrief) => debrief.runId === selectedId) ?? null;
  return (
    <Section title="Recent debriefs" icon="intel">
      {g.debriefs.length === 0 ? (
        <Card>
          <EmptyState icon="intel" title="No debriefs yet">
            Finished operations appear here with their results and causes.
          </EmptyState>
        </Card>
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
  const team = d.officerCondition.map((row) => g.officers[row.officerId]).filter((officer): officer is NonNullable<typeof officer> => !!officer).slice(0, 4);
  return (
    <button type="button" className={`debrief-tile debrief-tile-${tone}`} onClick={onOpen} aria-haspopup="dialog" aria-expanded={open} aria-label={`Review result: ${d.endingTitle}`}>
      <span className="debrief-rings" aria-hidden="true">
        <ScoreRing value={d.objective.score}><Icon name="flag" size={14} /></ScoreRing>
        <ScoreRing value={d.civilianSafety.score}><Icon name="civilian" size={14} /></ScoreRing>
      </span>
      <span className="debrief-tile-main">
        <span className="debrief-tile-kicker">{scenarioTitle(g, d.scenarioId, now)}</span>
        <strong className="debrief-tile-title">{d.endingTitle}</strong>
        <span className="debrief-tile-sub">Objective {d.objective.label.toLowerCase()} · Civilians {d.civilianSafety.label.toLowerCase()}</span>
        <span className="debrief-tile-foot">
          {team.length > 0 && <span className="debrief-team" aria-hidden="true">{team.map((officer) => <span key={officer.id} className="debrief-team-face"><Portrait officer={officer} size={24} /></span>)}</span>}
          <span className="debrief-reward tone-mint"><Icon name="cash" size={13} />{signedMoney(d.fundingReward)}</span>
          <span className={`debrief-reward ${d.trustDelta >= 0 ? '' : 'tone-danger'}`}><Icon name="shield" size={13} />{d.trustDelta >= 0 ? '+' : ''}{d.trustDelta}</span>
          {d.devPointReward > 0 && <span className="debrief-reward"><Icon name="chart" size={13} />+{d.devPointReward} DP</span>}
        </span>
      </span>
      <Icon name="chevronRight" size={16} className="debrief-tile-go" />
    </button>
  );
}

