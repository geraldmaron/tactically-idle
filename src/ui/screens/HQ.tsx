import { useGame } from '../store';
import { budget } from '../../sim/department-selectors';
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
import { fullName, stressBand } from '../../sim/officer';
import { scenarioTitle } from './helpers';

export function HQ() {
  const g = useGame();
  const now = Date.now();
  const b = budget(g);
  return (
    <div className="page">
      {g.report && <ShiftReportCard report={g.report} g={g} />}
      {g.activeRun && <ActiveOpCard g={g} now={now} />}
      <BudgetCard b={b} />
      <DutySection squads={g.squads} g={g} />
      <Debriefs g={g} now={now} />
    </div>
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
      {report.shortages.length > 0 && (
        <div className="report-list report-warn">
          <h3>
            <Icon name="warning" size={15} />
            Shortages
          </h3>
          <ul>
            {report.shortages.map((s, i) => (
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
        <span className="opcard-kicker">{run.practice ? 'Practice operation' : 'Operation'}{debrief ? ' · debrief ready' : ' · live'}</span>
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
            const deployed = g.activeRun?.squadIds.includes(s.id) && g.activeRun.status !== 'closed';
            const members = s.officerIds.map((id) => g.officers[id]).filter(Boolean);
            const strained = members.filter((o) => stressBand(o.stress) !== 'ready').length;
            return (
              <Card key={s.id} className="dutycard">
                <div className="dutycard-head">
                  <span className="squad-badge">{s.id}</span>
                  <div className="dutycard-name">
                    <strong>{s.name}</strong>
                    <span>
                      {plural(members.length, 'officer')}
                      {strained > 0 ? ` · ${strained} not at full readiness` : ''}
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

function Debriefs({ g, now }: { g: GameState; now: number }) {
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
          {g.debriefs.slice(0, 5).map((d) => (
            <Card key={d.runId} className="debrief-row">
              <div className="debrief-row-head">
                <strong>{d.endingTitle}</strong>
                {d.practice ? <Chip>Practice</Chip> : <Chip tone="mint">{signedMoney(d.fundingReward)}</Chip>}
              </div>
              <span className="debrief-row-sub">
                {scenarioTitle(g, d.scenarioId, now)} · objective {d.objective.label} · civilians {d.civilianSafety.label}
              </span>
              {!d.practice && (
                <span className="debrief-row-sub">
                  Trust {d.trustDelta >= 0 ? '+' : ''}
                  {d.trustDelta} · {d.devPointReward} dev point{d.devPointReward === 1 ? '' : 's'}
                </span>
              )}
              {d.causes[0] && <span className="debrief-row-cause">{d.causes[0]}</span>}
            </Card>
          ))}
        </div>
      )}
    </Section>
  );
}
