// "While you were away" (welcome-back): the shift report as a sheet when the player comes back.
// Earnings were applied when the time settled, so there is nothing to collect: the sheet shows what
// changed and Continue acknowledges it. It opens on load and after the page was hidden for at least
// the settlement's own report threshold, never mid-play when a course finishing adds to the report.
// Closing it without Continue keeps the report on HQ.
import { useEffect, useRef, useState } from 'react';
import type { GameState, ShiftReport } from '../../sim/types';
import { ECONOMY_TUNING } from '../../sim/economy';
import { fullName } from '../../sim/officer';
import { COURSES } from '../../content/courses';
import { useGame } from '../store';
import { Sheet } from './Sheet';
import { Button } from './ui';
import { Disclosure } from './Disclosure';
import { useToast } from './toast';
import { ShiftReportCard, EQUIPMENT_EVENT, PERSONNEL_EVENT } from './ShiftReport';
import { PlateArt, plateUrl } from '../art/Plates';
import { Icon, type IconName } from '../icons';
import { duration, money, signedMoney } from '../format';
import './welcome-back.css';

/** How long after load or return a report may still arrive and open the sheet. The store settles
 * on load and on return (store.ts), so the report is normally there on the next render. */
const ARM_MS = 4000;

export function WelcomeBack() {
  const g = useGame();
  const { act } = useToast();
  const [shownFor, setShownFor] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const armedUntil = useRef(Date.now() + ARM_MS);
  const hiddenAt = useRef<number | null>(null);
  const [returns, rearm] = useState(0);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') { hiddenAt.current = Date.now(); return; }
      const away = hiddenAt.current === null ? 0 : Date.now() - hiddenAt.current;
      hiddenAt.current = null;
      if (away >= ECONOMY_TUNING.reportMinMs) { armedUntil.current = Date.now() + ARM_MS; rearm((n) => n + 1); }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const report = g.report;
  useEffect(() => {
    if (!report || open || Date.now() > armedUntil.current) return;
    // One sheet per return: a report already shown up to this point stays on HQ.
    if (shownFor !== null && report.to <= shownFor) return;
    armedUntil.current = 0;
    setShownFor(report.to);
    setOpen(true);
  }, [report, open, shownFor, returns]);

  if (!report) return null;
  const close = () => setOpen(false);
  const proceed = () => { act({ type: 'acknowledgeReport' }); setOpen(false); };
  return <Sheet open={open} onClose={close} title="While you were away" className="welcome-sheet"
    footer={<Button variant="primary" block onClick={proceed}>Continue</Button>}>
    <WelcomeSummary report={report} g={g} />
  </Sheet>;
}

interface Line { key: string; icon: IconName; text: string; tone?: 'mint' | 'warn' }

/** The few lines worth reading first, in the order a returning commander asks: money, people, kit. */
export function welcomeLines(report: ShiftReport, g: Pick<GameState, 'officers'>): Line[] {
  const lines: Line[] = [];
  const name = (id: string) => (g.officers[id] ? fullName(g.officers[id]) : 'An officer');
  if (report.devPoints > 0) lines.push({ key: 'dp', icon: 'chart', text: `${Math.round(report.devPoints * 10) / 10} development points banked`, tone: 'mint' });
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

function WelcomeSummary({ report, g }: { report: ShiftReport; g: GameState }) {
  const lines = welcomeLines(report, g);
  const expenses = report.wages + report.operating + report.restockSpend + (report.maintenanceSpend ?? 0);
  return <div className="welcome">
    <div className="plate plate-grain welcome-hero">
      <PlateArt src={plateUrl('hub_hq')} />
      <span className="welcome-away"><Icon name="clock" size={14} />{duration(report.to - report.from)} away</span>
      <span className="welcome-net-label">Net funding</span>
      <strong className={`welcome-net ${report.net < 0 ? 'tone-danger' : 'tone-mint'}`}>{signedMoney(report.net)}</strong>
      <span className="welcome-flow">{money(report.gross)} earned · {money(expenses)} spent</span>
    </div>
    {lines.length > 0 ? <ul className="welcome-lines">{lines.map((line) => <li key={line.key} data-tone={line.tone}>
      <Icon name={line.icon} size={16} /><span>{line.text}</span>
    </li>)}</ul> : <p className="dim welcome-quiet">A quiet shift. Nothing needs you.</p>}
    <Disclosure name="welcome-full-report" summary="Full shift report" icon="list">
      <ShiftReportCard report={report} g={g} acknowledge={false} />
    </Disclosure>
  </div>;
}
