import { useEffect, useId, useRef, useState } from 'react';
import { assetUrl } from '../art/assetUrl';
import { useGame } from '../store';
import { budget } from '../../sim/department-selectors';
import type { GameState } from '../../sim/types';
import { Icon } from '../icons';
import { liveMoney, moneyFull, pad2, ratePerMinute } from '../format';
import { Sheet } from './Sheet';
import { Meter } from './ui';
import { levelProgress } from '../../sim/department-level';
import { frameworksOpeningAt } from '../../content/unlocks';
import './topbar-help.css';
import { FinanceDetail, FundingDeltas, useLiveFunding } from './Finance';
import { CampaignButton } from './SaveManager';

export type DepartmentStat = 'funding' | 'income' | 'trust' | 'level';
const STAT_TITLES: Record<DepartmentStat, string> = { funding: 'Funding', income: 'Income after costs', trust: 'Public trust', level: 'Department level' };
export const TOPBAR_HELP_HISTORY_KEY = 'tacticallyIdleDepartmentHelp';
type HistoryPort = Pick<History, 'state' | 'pushState' | 'replaceState' | 'back'>;

/** A help sheet occupies one history entry without changing the current player route. */
export function createDepartmentHelpNavigation(history: HistoryPort, owner: string, select: (topic: DepartmentStat | null) => void) {
  let closing = false;
  const owned = () => {
    const value = history.state?.[TOPBAR_HELP_HISTORY_KEY];
    return value?.owner === owner && Object.hasOwn(STAT_TITLES, value.topic) ? value as { owner: string; topic: DepartmentStat } : null;
  };
  const clearOwnedMarker = () => {
    if (!owned()) return;
    const next = { ...history.state };
    delete next[TOPBAR_HELP_HISTORY_KEY];
    history.replaceState(next, '');
  };
  return {
    initialize() {
      // Reloading resets the transient sheet. Reconcile its retained history
      // marker as well; a repeated useId must not make its trigger a no-op.
      closing = false;
      clearOwnedMarker();
      select(null);
    },
    open(topic: DepartmentStat) {
      const current = owned();
      if (closing) return false;
      if (current?.topic === topic) { select(topic); return false; }
      const next = { ...history.state, [TOPBAR_HELP_HISTORY_KEY]: { owner, topic } };
      if (current) history.replaceState(next, ''); else history.pushState(next, '');
      select(topic);
      return true;
    },
    close() {
      if (closing) return;
      if (owned()) { closing = true; history.back(); }
      else select(null);
    },
    onPop() { closing = false; select(owned()?.topic ?? null); },
    dispose: clearOwnedMarker,
  };
}

/** Mark, funding, net rate, trust, department level and saves, in one row on every screen. */
export function TopBar({ onOpenSaves }: { onOpenSaves?: () => void }) {
  const g = useGame();
  const owner = useId();
  const [topic, setTopic] = useState<DepartmentStat | null>(null);
  const navigation = useRef<ReturnType<typeof createDepartmentHelpNavigation> | null>(null);
  if (!navigation.current && typeof window !== 'undefined') navigation.current = createDepartmentHelpNavigation(window.history, owner, setTopic);
  useEffect(() => {
    const current = navigation.current;
    if (!current) return;
    current.initialize();
    window.addEventListener('popstate', current.onPop);
    return () => { window.removeEventListener('popstate', current.onPop); current.dispose(); };
  }, []);
  const live = useLiveFunding(g);
  return <DepartmentStatusBar g={g} live={live} topic={topic} onOpen={(next) => navigation.current?.open(next)} onClose={() => navigation.current?.close()} onOpenSaves={onOpenSaves} />;
}

export function DepartmentStatusBar({ g, topic, onOpen, onClose, onOpenSaves, live = { shown: g.department.funding, deltas: [] } }: { g: GameState; topic: DepartmentStat | null; onOpen: (topic: DepartmentStat) => void; onClose: () => void; onOpenSaves?: () => void; live?: ReturnType<typeof useLiveFunding> }) {
  const b = budget(g);
  const d = g.department;
  const helpProps = (stat: DepartmentStat, value: string) => ({
    type: 'button' as const,
    'aria-label': `${STAT_TITLES[stat]}: ${value}. Show explanation`,
    'aria-haspopup': 'dialog' as const,
    'aria-expanded': topic === stat,
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => { event.currentTarget.focus({ preventScroll: true }); onOpen(stat); },
  });
  return (
    <>
    <header className="topbar topbar-help">
      <h1 className="wordmark"><img className="brand-mark" src={assetUrl("brand/mark-dark.svg")} alt="Tactically Idle" width="34" height="34" /></h1>
      <ul className="stats" aria-label="Department status">
        <li><button className="stat stat-cash topbar-stat-button" {...helpProps('funding', moneyFull(d.funding))}>
          <Icon name="cash" size={18} />
          <span className="stat-cash-value">{liveMoney(live.shown)}</span>
          <FundingDeltas deltas={live.deltas} />
        </button></li>
        <li><button className={`stat stat-rate topbar-stat-button${b.net < 0 ? ' stat-neg' : ''}`} {...helpProps('income', `${ratePerMinute(b.net)} a real minute, ${moneyFull(b.net)} an hour`)}>
          <Icon name="trend" size={16} />
          <span>{ratePerMinute(b.net)}</span>
        </button></li>
        <li><button className="stat stat-trust topbar-stat-button" {...helpProps('trust', `${Math.round(d.trust)} out of 100`)}>
          <Icon name="shield" size={17} />
          <span>{Math.round(d.trust)}</span>
        </button></li>
      </ul>
      <button className="hexlevel topbar-level-button" {...helpProps('level', String(d.level))}>
        <svg viewBox="0 0 40 44" width="34" height="38" aria-hidden="true">
          <path d="M20 2l16 9.2v21.6L20 42 4 32.8V11.2z" fill="rgba(243,180,50,.08)" stroke="var(--amber)" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        <span>{pad2(d.level)}</span>
      </button>
      {onOpenSaves && <CampaignButton onOpen={onOpenSaves} />}
    </header>
    <Sheet open={topic !== null} onClose={onClose} title={topic === 'funding' || topic === 'income' ? 'Finances' : topic ? STAT_TITLES[topic] : 'Department status'} className="department-stat-sheet">
      {topic && <DepartmentStatHelp g={g} topic={topic} />}
    </Sheet>
    </>
  );
}

export function DepartmentStatHelp({ g, topic }: { g: GameState; topic: DepartmentStat }) {
  if (topic === 'funding' || topic === 'income') return <div className="department-stat-help"><FinanceDetail g={g} /></div>;
  if (topic === 'trust') return <div className="department-stat-help">
    <p className="department-stat-value">{Math.round(g.department.trust)} <span>out of 100</span></p>
    <p>Public confidence in your department, on a scale from 0 to 100. Higher means more trust.</p>
    <p>Completed operations can raise or lower public trust.</p>
  </div>;
  if (topic === 'level') {
    const p = levelProgress(g.department);
    const opens = frameworksOpeningAt(p.level + 1);
    return <div className="department-stat-help">
      <p className="department-stat-value">Level {p.level}</p>
      <p>Your department earns service on every live call. Completing the agreed step on a harder call earns the most.</p>
      {p.next === null ? <p>Your department is at the top level.</p> : <>
        <p><strong>{p.service - p.floor} of {p.next - p.floor}</strong> service toward level {p.level + 1}.</p>
        <Meter value={(100 * (p.service - p.floor)) / (p.next - p.floor)} tone="mid" label="Service toward the next level" valueText={`${p.service - p.floor} of ${p.next - p.floor}`} />
        {opens.length > 0 && <p>Level {p.level + 1} opens {opens.join(', ')}.</p>}
      </>}
      <p>Higher levels also bring harder calls, which pay more. Level is separate from public trust and from an officer’s experience.</p>
    </div>;
  }
  return null;
}
