// The return moment. Earnings were applied when the time settled, so there is nothing to collect: the report
// shows what changed, people first (B3, a sheet), or after a week or more away the page that says where the
// player left it (B4). It opens on load and after the page was hidden for at least the settlement's own report
// threshold, never mid-play when a course finishing adds to the report. Closing it without the button keeps the
// report on the City, one tap from opening again.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ECONOMY_TUNING } from '../../sim/economy';
import { useGame, send } from '../store';
import { Sheet } from './Sheet';
import { Button } from './ui';
import { Face } from './Face';
import { useNav } from './nav';
import { useToast } from './toast';
import { ShiftReportCard, SignedFunds, welcomeLines } from './ShiftReport';
import { PlateArt, plateUrl } from '../art/Plates';
import { LONG_AWAY_MS, reportView, welcomeView, type WelcomeLine } from '../screens/city/report';
import { useSettings } from '../settings/SettingsControls';
import { Icon } from '../icons';
import '../styles/city-report.css';

export { welcomeLines };

/** How long after load or return a report may still arrive and open the sheet. The store settles
 * on load and on return (store.ts), so the report is normally there on the next render. */
const ARM_MS = 4000;

// Whether the report is open lives outside the component so the City's "While you were off" row can reopen it.
let reportOpen = false;
const listeners = new Set<() => void>();
const setOpen = (open: boolean) => { reportOpen = open; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const openReport = () => setOpen(true);
export const useReportOpen = (): boolean => useSyncExternalStore(subscribe, () => reportOpen, () => false);

export function WelcomeBack() {
  const g = useGame();
  const { act } = useToast();
  const nav = useNav();
  const { personalLives } = useSettings();
  const open = useReportOpen();
  const [shownFor, setShownFor] = useState<number | null>(null);
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
    // One sheet per return: a report already shown up to this point stays on the City.
    if (shownFor !== null && report.to <= shownFor) return;
    armedUntil.current = 0;
    setShownFor(report.to);
    setOpen(true);
  }, [report, open, shownFor, returns]);
  // A report that is acknowledged elsewhere closes the sheet with it.
  useEffect(() => { if (!report && reportOpen) setOpen(false); }, [report]);

  const view = useMemo(() => (report ? reportView(g, report, personalLives) : null), [g, report, personalLives]);
  if (!report || !view) return null;
  const close = () => setOpen(false);
  const proceed = (to?: () => void) => {
    for (const line of view.people) for (const beatId of line.beatIds) send({ type: 'acknowledgeBeat', beatId });
    act({ type: 'acknowledgeReport' });
    setOpen(false);
    to?.();
  };
  const toCity = () => proceed(() => { if (!g.activeRun) nav.go('city'); });

  if (report.to - report.from >= LONG_AWAY_MS) {
    const welcome = welcomeView(g, report);
    return <Sheet open={open} onClose={close} title="Where you left it" className="welcome-page"
      footer={<div className="welcome-foot">
        {welcome.pickUp && <Button variant="primary" block onClick={() => proceed(() => nav.openOfficer(welcome.pickUp!.officerId))}>{`Pick up with ${welcome.pickUp.surname}`}</Button>}
        <Button variant={welcome.pickUp ? 'quiet' : 'primary'} block onClick={toCity}>Show me the city</Button>
      </div>}>
      <WelcomePage welcome={welcome} g={g} />
    </Sheet>;
  }
  return <Sheet open={open} onClose={close} title="While you were off" className="welcome-sheet"
    footer={<Button variant="primary" block onClick={toCity}>Back to the city</Button>}>
    <ShiftReportCard report={report} g={g} />
  </Sheet>;
}

function WelcomeRow({ line, g }: { line: WelcomeLine; g: ReturnType<typeof useGame> }) {
  const officer = line.officerId ? g.officers[line.officerId] : undefined;
  return <li className="welcome-line" data-kind={line.kind}>
    {officer ? <Face size="md" kind="officer" officer={officer} />
      : line.kind === 'funding' ? <span className="welcome-mark welcome-mark-funds" aria-hidden="true"><Icon name="funds" size={20} /></span>
      : <span className="welcome-mark welcome-mark-crew" aria-hidden="true">{line.crest}</span>}
    <span>{line.before}{line.amount !== undefined ? <b><SignedFunds value={line.amount} /></b> : line.bold ? <b>{line.bold}</b> : null}{line.after}</span>
  </li>;
}

/** B4: the painted garage, how long away, one sentence on what held still, and three lines at most. */
function WelcomePage({ welcome, g }: { welcome: ReturnType<typeof welcomeView>; g: ReturnType<typeof useGame> }) {
  return <div className="welcome-body">
    <div className="welcome-plate plate" aria-hidden="true"><PlateArt src={plateUrl('scene_patrol_garage')} /></div>
    <div className="welcome-copy">
      <span className="welcome-kicker">{welcome.days}</span>
      <h2 className="welcome-title">Where you left it</h2>
      <p className="welcome-intro">{welcome.intro}</p>
      <ol className="welcome-lines">{welcome.lines.map((line) => <WelcomeRow key={line.key} line={line} g={g} />)}</ol>
    </div>
  </div>;
}
