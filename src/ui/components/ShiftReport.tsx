// "While you were off" (B3): what happened to the people, the cases and the funding while the player was away,
// in that order. The numbers and lines come from screens/city/report.ts; this file lays them out. The old full
// report (courses, patrol training, shortages, kit, personnel) stays one tap down, so nothing it said is lost.
import { useEffect, useMemo } from 'react';
import type { GameState, GrantRecord, ShiftReport } from '../../sim/types';
import { DEV_NODES } from '../../content/dev-tree';
import { tierLabel } from '../../sim/development-tiers';
import { fullName } from '../../sim/officer';
import { COURSES } from '../../content/courses';
import { ITEMS } from '../../content/items';
import { Button, Chip } from './ui';
import { Disclosure } from './Disclosure';
import { Face } from './Face';
import { useToast } from './toast';
import { useNav } from './nav';
import { Icon, itemIcon } from '../icons';
import type { IconName } from '../icons';
import { duration, moneyFull } from '../format';
import { send } from '../store';
import { PATROL_GRADES, patrolProfile } from '../../sim/patrol';
import { useSettings } from '../settings/SettingsControls';
import { reportView, type LeadLine, type PeopleLine } from '../screens/city/report';
import '../styles/city-report.css';

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

/** An exact signed amount: +11,360, -900. */
export const signedExact = (n: number): string => { const v = Math.round(n); return v === 0 ? '0' : `${v > 0 ? '+' : '-'}${moneyFull(Math.abs(v))}`; };

/** Funding as the glyph and an exact signed number (the report prints whole amounts, not 11.4K). */
export function SignedFunds({ value }: { value: number }) {
  return <span className="funds"><Icon name="funds" size={16} className="funds-glyph" />{signedExact(value)}<span className="sr-only"> funding</span></span>;
}

interface Line { key: string; icon: IconName; text: string; tone?: 'mint' | 'warn' }

/** The few lines worth reading after the people, cases and funding: grants, promotions, courses, kit and the
 * pay cap, in the order a returning commander asks. */
export function welcomeLines(report: ShiftReport, g: Pick<GameState, 'officers'>): Line[] {
  const lines: Line[] = [];
  const name = (id: string) => (g.officers[id] ? fullName(g.officers[id]) : 'An officer');
  for (const grant of report.grants ?? []) lines.push({ key: `grant:${grant.nodeId}:${grant.tier}`, icon: 'star', text: `${grantName(grant)} granted at ${grant.milestone.replace(/^Level/, 'level').replace(/^Trust/, 'trust')}`, tone: 'mint' });
  const promoted = report.personnel.filter((p) => p.event === 'promoted');
  if (promoted.length === 1) lines.push({ key: 'promoted', icon: 'medal', text: promoted[0].detail.split('. ')[0], tone: 'mint' });
  else if (promoted.length > 1) lines.push({ key: 'promoted', icon: 'medal', text: `${promoted.length} officers promoted`, tone: 'mint' });
  if (report.completedCourses.length === 1) {
    const [c] = report.completedCourses;
    lines.push({ key: 'courses', icon: 'mortarboard', text: `${name(c.officerId)} finished ${COURSES[c.courseId]?.name ?? 'a course'}`, tone: 'mint' });
  } else if (report.completedCourses.length > 1) {
    lines.push({ key: 'courses', icon: 'mortarboard', text: `${report.completedCourses.length} officers finished training`, tone: 'mint' });
  }
  if (report.recovered.length === 1) lines.push({ key: 'rec', icon: 'heart', text: `${name(report.recovered[0])} is rested and back on the roster`, tone: 'mint' });
  else if (report.recovered.length > 1) lines.push({ key: 'rec', icon: 'heart', text: `${report.recovered.length} officers rested and back on the roster`, tone: 'mint' });
  const kit = (report.equipment ?? []).filter((e) => EQUIPMENT_EVENT[e.event].warn).length;
  if (kit) lines.push({ key: 'kit', icon: 'wrench', text: `${kit} piece${kit === 1 ? '' : 's'} of kit need${kit === 1 ? 's' : ''} service`, tone: 'warn' });
  const shortages = report.shortages.filter((line) => !/battery/i.test(line)).length;
  if (shortages) lines.push({ key: 'short', icon: 'box', text: `${shortages} restock${shortages === 1 ? '' : 's'} could not be bought`, tone: 'warn' });
  for (const p of report.personnel ?? []) {
    if (!PERSONNEL_EVENT[p.event].warn) continue;
    lines.push({ key: `p-${p.officerId}-${p.event}`, icon: PERSONNEL_EVENT[p.event].icon, text: `${name(p.officerId)} ${p.event === 'retired' ? 'has retired' : 'is retiring'}`, tone: 'warn' });
  }
  if (report.capped) lines.push({ key: 'cap', icon: 'clock', text: `Pay stopped after a day without orders. ${duration(report.accruedHours * 3600000)} counted.` });
  return lines;
}

/** One person line: the face (two for a pair), the surnames, what happened and the mono tag at the right. */
function PersonRow({ g, line, onOpen }: { g: GameState; line: PeopleLine; onOpen: () => void }) {
  const officers = line.officerIds.map((id) => g.officers[id]).filter((o) => !!o);
  return <li><button type="button" className="rpt-person" data-tone={line.tone} onClick={onOpen} aria-label={`${line.title}. ${line.text} ${line.tag.toLowerCase()}. Open the jacket`}>
    <span className="rpt-faces" aria-hidden="true">{officers.map((o) => <Face key={o.id} size={officers.length > 1 ? 'sm' : 'md'} kind="officer" officer={o} />)}</span>
    <span className="rpt-person-main"><b>{line.title}</b><span>{line.text}</span></span>
    <span className="rpt-tag" aria-hidden="true">{line.tag}</span>
  </button></li>;
}

function LeadCard({ lead, extra, onOpen }: { lead: LeadLine; extra: number; onOpen: () => void }) {
  return <button type="button" className="rpt-lead" onClick={onOpen}>
    <Icon name="search" size={22} />
    <span className="rpt-person-main"><b>{lead.title}</b><span>{lead.text}{extra > 0 ? ` ${extra} more ${extra === 1 ? 'lead is' : 'leads are'} open.` : ''}</span></span>
  </button>;
}

/** The B3 report: people first (at most three), then cases, then the funding net, then the rest in a line or
 * two. `acknowledge` adds the button that clears it; the welcome sheet passes its own footer instead. */
export function ShiftReportCard({ report, g, acknowledge = false, onDone }: { report: ShiftReport; g: GameState; acknowledge?: boolean; onDone?: () => void }) {
  const { act } = useToast();
  const nav = useNav();
  const { personalLives } = useSettings();
  const view = useMemo(() => reportView(g, report, personalLives), [g, report, personalLives]);
  // Showing a telegraph is what lets its fork open: the report is where the player reads it.
  const unseen = useMemo(() => view.people.flatMap((line) => line.imprintIds).filter((id) => g.people.imprints.some((i) => i.id === id && !i.seen)), [view, g.people.imprints]);
  useEffect(() => { if (unseen.length) send({ type: 'markTelegraphSeen', imprintIds: unseen }); }, [unseen]);
  const also = welcomeLines(report, g).slice(0, 3);
  const { cases, funding } = view;
  const settled = report.to - report.from > 0 || report.gross !== 0 || report.net !== 0;
  const done = () => {
    for (const line of view.people) for (const beatId of line.beatIds) send({ type: 'acknowledgeBeat', beatId });
    act({ type: 'acknowledgeReport' });
    onDone?.();
  };
  return (
    <div className="rpt">
      <p className="rpt-kicker rpt-span">{settled ? `${view.away} · ${view.span}` : 'JUST NOW'}</p>

      {view.people.length > 0 && <section className="rpt-group" aria-label="People">
        <h3 className="rpt-kicker rpt-kicker-people">PEOPLE</h3>
        <ul className="rpt-people">{view.people.map((line) => <PersonRow key={line.key} g={g} line={line} onOpen={() => nav.openOfficer(line.open)} />)}</ul>
      </section>}

      {(cases.opened > 0 || cases.closed > 0 || cases.crime || cases.leads.length > 0) && <section className="rpt-group" aria-label="Cases">
        <h3 className="rpt-kicker rpt-kicker-cases">CASES</h3>
        <div className="rpt-tiles">
          <div className="rpt-tile"><b>{cases.opened}</b><span>{cases.opened === 1 ? 'case opened' : 'cases opened'}</span></div>
          <div className="rpt-tile"><b>{cases.closed}</b><span>{cases.closed === 1 ? 'case closed' : 'cases closed'}</span></div>
          {cases.crime && <div className="rpt-tile"><b data-tone={cases.crime.after < cases.crime.before ? 'intel' : cases.crime.after > cases.crime.before ? 'warn' : undefined}>{cases.crime.after}</b><span>{cases.crime.name} crime, was {cases.crime.before}</span></div>}
        </div>
        {cases.leads.map((lead) => <LeadCard key={lead.leadId} lead={lead} extra={cases.moreLeads} onOpen={() => nav.go('ops')} />)}
      </section>}

      {view.quiet && <p className="rpt-quiet">A quiet stretch. Nothing needs you.</p>}

      <section className="rpt-funding" aria-label="Funding">
        <div className="rpt-funding-head"><span className="rpt-kicker rpt-kicker-funds">FUNDING, NET</span><b className={funding.net < 0 ? 'tone-danger' : 'tone-mint'}><SignedFunds value={funding.net} /></b></div>
        <dl className="rpt-rows">{funding.rows.map((row) => <div key={row.key}><dt>{row.label}</dt><dd>{signedExact(row.value)}</dd></div>)}</dl>
      </section>

      {also.length > 0 && <ul className="rpt-also" data-ui-list>{also.map((line) => <li key={line.key} data-tone={line.tone}><Icon name={line.icon} size={18} /><span>{line.text}</span></li>)}</ul>}

      <Disclosure name="report-details" summary="The full record" icon="list" className="rpt-details"><ReportDetails report={report} g={g} /></Disclosure>

      {acknowledge && <Button variant="primary" block onClick={done}>Back to the city</Button>}
    </div>
  );
}

/** The record the report used to open with: courses, patrol promotions, recoveries, shortages, kit and personnel. */
function ReportDetails({ report, g }: { report: ShiftReport; g: GameState }) {
  return (
    <div className="rpt-detail">
      {report.restockSpend > 0 && <p>Restocking cost {moneyFull(report.restockSpend)}.</p>}
      {(report.maintenanceSpend ?? 0) > 0 && <p>Equipment manager servicing cost {moneyFull(report.maintenanceSpend ?? 0)}.</p>}
      {(report.maintenanceStarted?.length ?? 0) > 0 && <p>Sent for service: {report.maintenanceStarted!.map((id) => g.units[id]?.serial ?? id).join(', ')}.</p>}
      {(report.grants ?? []).map((grant) => <p key={`${grant.nodeId}:${grant.tier}`} className="tone-mint">Granted at {grant.milestone}: {grantName(grant)}.</p>)}
      {report.capped && <p><Icon name="info" size={16} /> Capped: income and wages stop accruing after a stretch without orders ({duration(report.accruedHours * 3600000)} counted).</p>}
      {report.completedCourses.length > 0 && <DetailList icon="mortarboard" title="Completed courses" items={report.completedCourses.map((c, i) => ({ key: `c${i}`, text: `${g.officers[c.officerId]?.surname ?? 'Officer'}: ${COURSES[c.courseId]?.name ?? c.courseId}` }))} />}
      {(report.patrolTraining ?? []).length > 0 && <DetailList icon="patrol" title="Patrol training" items={report.patrolTraining!.map((completion) => {
        const profile = patrolProfile(completion.profileId);
        return { key: `${completion.employeeId}:${completion.completedAt}`, text: `${profile ? `${profile.firstName} ${profile.surname}` : 'Patrol employee'}: promoted to ${PATROL_GRADES[completion.grade].name}` };
      })} />}
      {report.recovered.length > 0 && <DetailList icon="pulse" title="Recovered, deployable again" items={report.recovered.map((id) => ({ key: id, text: g.officers[id] ? fullName(g.officers[id]) : id }))} />}
      {report.shortages.filter((line) => !/battery/i.test(line)).length > 0 && <DetailList icon="warning" title="Shortages" warn items={report.shortages.filter((line) => !/battery/i.test(line)).map((s, i) => ({ key: `s${i}`, text: s }))} />}
      {(report.equipment ?? []).length > 0 && <DetailList icon="wrench" title="Equipment" items={report.equipment.map((e, i) => {
        const u = g.units[e.unitId];
        const m = EQUIPMENT_EVENT[e.event];
        return { key: `e${i}`, icon: u ? itemIcon(u.itemId) : m.icon, text: `${u ? `${u.serial} ${ITEMS[u.itemId]?.name ?? u.itemId}` : e.unitId}: ${m.text}`, chip: <Chip tone={m.tone} icon={m.icon}>{m.chip}</Chip>, warn: m.warn };
      })} />}
      {(report.personnel ?? []).length > 0 && <DetailList icon="people" title="Personnel" items={report.personnel.map((p, i) => {
        const m = PERSONNEL_EVENT[p.event];
        return { key: `p${i}`, icon: m.icon, text: `${g.officers[p.officerId] ? fullName(g.officers[p.officerId]) : 'Officer'}: ${p.detail}`, chip: <Chip tone={m.tone} icon={m.icon}>{m.chip}</Chip>, warn: m.warn };
      })} />}
    </div>
  );
}

function DetailList({ icon, title, items, warn }: { icon: IconName; title: string; warn?: boolean; items: { key: string; text: string; icon?: IconName; chip?: React.ReactNode; warn?: boolean }[] }) {
  return <div className={`rpt-detail-list${warn ? ' rpt-detail-warn' : ''}`}>
    <h4><Icon name={icon} size={16} />{title}</h4>
    <ul>{items.map((item) => <li key={item.key} data-warn={item.warn || undefined}><Icon name={item.icon ?? 'check'} size={16} /><span>{item.text}</span>{item.chip}</li>)}</ul>
  </div>;
}
