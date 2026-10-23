import type { GameState, GrantRecord, ShiftReport } from '../../sim/types';
import { DEV_NODES } from '../../content/dev-tree';
import { tierLabel } from '../../sim/development-tiers';
import { fullName } from '../../sim/officer';
import { COURSES } from '../../content/courses';
import { ITEMS } from '../../content/items';
import { Button, Chip, KV } from './ui';
import { useToast } from './toast';
import { Icon, itemIcon } from '../icons';
import type { IconName } from '../icons';
import { duration, money, signedMoney } from '../format';
import { PATROL_GRADES, patrolProfile } from '../../sim/patrol';

type Tone = 'mint' | 'amber' | 'warn' | 'danger' | 'blue' | 'neutral';

export const EQUIPMENT_EVENT: Record<ShiftReport['equipment'][number]['event'], { chip: string; text: string; icon: IconName; tone: Tone; warn: boolean }> = {
  unreliable: { chip: 'Unreliable', text: 'now unreliable and may malfunction', icon: 'warning', tone: 'warn', warn: true },
  failed: { chip: 'Failed', text: 'failed and cannot deploy until serviced', icon: 'xcircle', tone: 'danger', warn: true },
  expired: { chip: 'Expired', text: 'passed its shelf life', icon: 'wait', tone: 'danger', warn: true },
  serviced: { chip: 'Serviced', text: 'back from service', icon: 'wrench', tone: 'mint', warn: false },
};

/** A granted development by name, with its tier when it has tiers: 'Training academy II'. */
export function grantName(grant: Pick<GrantRecord, 'nodeId' | 'tier'>): string {
  const node = DEV_NODES[grant.nodeId];
  return node ? `${node.name}${node.tiers ? ` ${tierLabel(grant.tier)}` : ''}` : grant.nodeId;
}

export const PERSONNEL_EVENT: Record<ShiftReport['personnel'][number]['event'], { chip: string; icon: IconName; tone: Tone; warn: boolean }> = {
  retirement_announced: { chip: 'Retiring', icon: 'retire', tone: 'warn', warn: true },
  retired: { chip: 'Retired', icon: 'door', tone: 'danger', warn: true },
  anniversary: { chip: 'Anniversary', icon: 'medal', tone: 'mint', warn: false },
  birthday: { chip: 'Birthday', icon: 'cake', tone: 'blue', warn: false },
  promoted: { chip: 'Promoted', icon: 'medal', tone: 'mint', warn: false },
};

/** The full shift report: money, courses, recoveries, shortages, equipment and personnel events.
 * `acknowledge` adds the button that clears it (HQ); the welcome-back sheet has its own Continue. */
export function ShiftReportCard({ report, g, acknowledge = true }: { report: ShiftReport; g: GameState; acknowledge?: boolean }) {
  const { act } = useToast();
  const elapsed = report.to - report.from;
  // A report opened when a debrief closed (a grant or promotion) has settled no time yet: no money rows.
  const settled = elapsed > 0 || report.gross !== 0 || report.net !== 0;
  return (
    <section className="card card-amber report" aria-label="Shift report">
      <div className="section-head">
        <h2 className="section-title">
          <Icon name="list" size={20} />
          Shift report
        </h2>
        {settled && <Chip icon="clock">{duration(elapsed)} away</Chip>}
      </div>
      {settled && <><div className="report-net">
        <span className="report-net-label">
          <Icon name="cash" size={16} />
          Net funding
        </span>
        <span className={`report-net-val ${report.net < 0 ? 'tone-danger' : 'tone-mint'}`}>{signedMoney(report.net)}</span>
      </div>
      <KV icon="trend" k="Gross income" v={money(report.gross)} />
      <KV icon="people" k="Wages" v={`-${money(report.wages)}`} />
      <KV icon="gear" k="Operating costs" v={`-${money(report.operating)}`} /></>}
      {report.restockSpend > 0 && <KV icon="box" k="Restocking" v={`-${money(report.restockSpend)}`} />}
      {(report.maintenanceSpend ?? 0) > 0 && <KV icon="wrench" k="Equipment manager servicing" v={`-${money(report.maintenanceSpend ?? 0)}`} />}
      {(report.maintenanceStarted?.length ?? 0) > 0 && <p className="dim">Sent for service: {report.maintenanceStarted!.map((id) => g.units[id]?.serial ?? id).join(', ')}.</p>}
      {(report.grants ?? []).map((grant) => <KV key={`${grant.nodeId}:${grant.tier}`} icon="star" k={`Granted at ${grant.milestone}`} v={grantName(grant)} tone="mint" />)}
      {report.capped && (
        <p className="note note-amber">
          <Icon name="info" size={16} />
          Capped at 24h: income and wages stop accruing after a day without orders ({duration(report.accruedHours * 3600000)} counted).
        </p>
      )}
      {report.completedCourses.length > 0 && (
        <div className="report-list">
          <h3>
            <Icon name="mortarboard" size={16} />
            Completed courses
          </h3>
          <ul>
            {report.completedCourses.map((c, i) => (
              <li key={i}>
                <Icon name="check" size={16} />
                {g.officers[c.officerId]?.surname ?? 'Officer'}: {COURSES[c.courseId]?.name ?? c.courseId}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(report.patrolTraining ?? []).length > 0 && (
        <div className="report-list">
          <h3>
            <Icon name="patrol" size={16} />
            Patrol training
          </h3>
          <ul>
            {report.patrolTraining!.map((completion) => {
              const profile = patrolProfile(completion.profileId);
              const name = profile ? `${profile.firstName} ${profile.surname}` : 'Patrol employee';
              return <li key={`${completion.employeeId}:${completion.completedAt}`}>
                <Icon name="check" size={16} />
                {name}: promoted to {PATROL_GRADES[completion.grade].name}
              </li>;
            })}
          </ul>
        </div>
      )}
      {report.recovered.length > 0 && (
        <div className="report-list">
          <h3>
            <Icon name="pulse" size={16} />
            Recovered, deployable again
          </h3>
          <ul>
            {report.recovered.map((id) => (
              <li key={id}>
                <Icon name="check" size={16} />
                {g.officers[id] ? fullName(g.officers[id]) : id}
              </li>
            ))}
          </ul>
        </div>
      )}
      {report.shortages.filter((line) => !/battery/i.test(line)).length > 0 && (
        <div className="report-list report-warn">
          <h3>
            <Icon name="warning" size={16} />
            Shortages
          </h3>
          <ul>
            {report.shortages.filter((line) => !/battery/i.test(line)).map((s, i) => (
              <li key={i}>
                <Icon name="warning" size={16} />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(report.equipment ?? []).length > 0 && (
        <div className="report-list">
          <h3>
            <Icon name="wrench" size={16} />
            Equipment
          </h3>
          <ul>
            {report.equipment.map((e, i) => {
              const u = g.units[e.unitId];
              const m = EQUIPMENT_EVENT[e.event];
              const name = u ? `${u.serial} ${ITEMS[u.itemId]?.name ?? u.itemId}` : e.unitId;
              return (
                <li key={i} className={m.warn ? 'report-bad' : ''}>
                  <Icon name={u ? itemIcon(u.itemId) : m.icon} size={16} />
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
            <Icon name="people" size={16} />
            Personnel
          </h3>
          <ul>
            {report.personnel.map((p, i) => {
              const m = PERSONNEL_EVENT[p.event];
              const who = g.officers[p.officerId];
              return (
                <li key={i} className={m.warn ? 'report-bad' : ''}>
                  <Icon name={m.icon} size={16} />
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
      {acknowledge && <Button variant="primary" block onClick={() => act({ type: 'acknowledgeReport' })}>
        Acknowledge
      </Button>}
    </section>
  );
}
