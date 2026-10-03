import { useEffect, useId, useRef, useState } from 'react';
import { assetUrl } from '../art/assetUrl';
import { useGame } from '../store';
import { budget } from '../../sim/department-selectors';
import type { GameState } from '../../sim/types';
import { Icon } from '../icons';
import { money, moneyFull, pad2, rate } from '../format';
import { Sheet } from './Sheet';
import './topbar-help.css';

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

/** Wordmark, funding, net rate, trust, department level. Shown on every screen. */
export function TopBar() {
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
  return <DepartmentStatusBar g={g} topic={topic} onOpen={(next) => navigation.current?.open(next)} onClose={() => navigation.current?.close()} />;
}

export function DepartmentStatusBar({ g, topic, onOpen, onClose }: { g: GameState; topic: DepartmentStat | null; onOpen: (topic: DepartmentStat) => void; onClose: () => void }) {
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
      <h1 className="wordmark"><img className="brand-lockup" src={assetUrl("brand/header-lockup-dark.svg")} alt="Tactically Idle" width="146" height="36" /></h1>
      <ul className="stats" aria-label="Department status">
        <li><button className="stat stat-cash topbar-stat-button" {...helpProps('funding', moneyFull(d.funding))}>
          <Icon name="cash" size={18} />
          <span>{money(d.funding)}</span>
        </button></li>
        <li><button className={`stat stat-rate topbar-stat-button${b.net < 0 ? ' stat-neg' : ''}`} {...helpProps('income', `${moneyFull(b.net)} per real hour`)}>
          <Icon name="trend" size={16} />
          <span>{rate(b.net)}</span>
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
    </header>
    <Sheet open={topic !== null} onClose={onClose} title={topic ? STAT_TITLES[topic] : 'Department status'} className="department-stat-sheet">
      {topic && <DepartmentStatHelp g={g} topic={topic} />}
    </Sheet>
    </>
  );
}

export function DepartmentStatHelp({ g, topic }: { g: GameState; topic: DepartmentStat }) {
  const b = budget(g);
  if (topic === 'funding') return <div className="department-stat-help">
    <p className="department-stat-value">{moneyFull(g.department.funding)} <span>available</span></p>
    <p>Money available to run your department. Hiring, training, equipment and development purchases spend this balance.</p>
    <p>Income and running costs change your funding over real time.</p>
  </div>;
  if (topic === 'trust') return <div className="department-stat-help">
    <p className="department-stat-value">{Math.round(g.department.trust)} <span>out of 100</span></p>
    <p>Public confidence in your department, on a scale from 0 to 100. Higher means more trust.</p>
    <p>Completed operations can raise or lower public trust.</p>
  </div>;
  if (topic === 'level') return <div className="department-stat-help">
    <p className="department-stat-value">Level {g.department.level}</p>
    <p>The level recorded for your department in this campaign. It’s separate from public trust and an individual officer’s experience.</p>
  </div>;
  const perRealHour = (value: number) => `${moneyFull(value)} / real hour`;
  return <div className="department-stat-help">
    <p className={`department-stat-value${b.net < 0 ? ' tone-danger' : ' tone-mint'}`}>{b.net > 0 ? '+' : ''}{moneyFull(b.net)} <span>per real hour</span></p>
    <p>{b.net > 0 ? 'Funding grows by this amount each real hour after wages and running costs.' : b.net < 0 ? 'Funding falls by this amount each real hour because costs exceed income.' : 'Income currently covers wages and running costs exactly.'}</p>
    <dl className="department-stat-budget">
      <div><dt>Base allocation</dt><dd>{perRealHour(b.base)}</dd></div>
      <div><dt>Patrol income</dt><dd>{perRealHour(b.patrol)}</dd></div>
      <div><dt>Development income</dt><dd>{perRealHour(b.nodeIncome)}</dd></div>
      <div className="department-stat-subtotal"><dt>Total income</dt><dd>{perRealHour(b.gross)}</dd></div>
      <div><dt>Officer wages</dt><dd>{perRealHour(b.wages)}</dd></div>
      <div><dt>Operating costs</dt><dd>{perRealHour(b.operating)}</dd></div>
      <div><dt>Supply costs</dt><dd>{perRealHour(b.supplies)}</dd></div>
    </dl>
    <p className="department-stat-note">This is the current rate. Hiring, patrol duty and developments can change it. One-off purchases reduce your balance separately.</p>
  </div>;
}
