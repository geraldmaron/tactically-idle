import { useEffect, useId, useRef, useState } from 'react';
import { useGame } from '../store';
import { budget } from '../../sim/department-selectors';
import type { GameState } from '../../sim/types';
import { funding, fundingPerHour, liveMoney, money, rate } from '../format';
import { Sheet } from './Sheet';
import { Meter } from './ui';
import { levelProgress } from '../../sim/department-level';
import { frameworksOpeningAt } from '../../content/unlocks';
import './topbar-help.css';
import { FinanceDetail, FundingDeltas, useLiveFunding } from './Finance';
import { MenuButton } from './SaveManager';
import { Icon } from '../icons';
import { RESOURCE_ICON } from '../icons/kit';

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

/** The bar on every desk screen (night-city look): the unit's name in the display face at the left with
 * its level and trust as two small mono readouts under it, funding at the right as the coin glyph and the
 * balance with the net rate under it in mono mint, then the menu. Each readout opens its explanation. */
export function TopBar({ onOpenMenu }: { onOpenMenu?: () => void }) {
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
  const cash = useRef<HTMLButtonElement>(null);

  return <DepartmentStatusBar fundingRef={cash} g={g} live={live} topic={topic} onOpen={(next) => navigation.current?.open(next)} onClose={() => navigation.current?.close()} onOpenMenu={onOpenMenu} />;
}

export function DepartmentStatusBar({ fundingRef, g, topic, onOpen, onClose, onOpenMenu, live = { shown: g.department.funding, deltas: [] } }: { fundingRef?: React.Ref<HTMLButtonElement>; g: GameState; topic: DepartmentStat | null; onOpen: (topic: DepartmentStat) => void; onClose: () => void; onOpenMenu?: () => void; live?: ReturnType<typeof useLiveFunding> }) {
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
    <header className="topbar resource-bar">
      <div className="bar-id">
        <p className="bar-unit">{d.name}</p>
        <ul className="bar-kickers" aria-label="Department standing">
          <li><button className="stat stat-level" {...helpProps('level', String(d.level))}>
            <span className="kicker">Level <span className="res-value">{d.level}</span></span>
          </button></li>
          <li><button className="stat stat-trust" {...helpProps('trust', `${Math.round(d.trust)} out of 100`)}>
            <span className="kicker">Trust <span className="res-value">{Math.round(d.trust)}</span></span>
          </button></li>
        </ul>
      </div>
      <ul className="stats" aria-label="Department funding">
        <li><button ref={fundingRef} data-funding-target className="stat stat-cash" {...helpProps('funding', `${funding(d.funding)}, ${b.net < 0 ? 'minus ' : ''}${fundingPerHour(Math.abs(b.net))}`)}>
          <span className="bar-funds" data-ui-pill>
            <span className="bar-funds-main">
              <Icon name={RESOURCE_ICON.funds} size={18} className="res-icon" />
              {/* The narrowest phones show the balance short (13.4K) so the hourly rate stays readable. */}
              <span className="res-value stat-cash-value">{liveMoney(live.shown)}</span>
              <span className="res-value stat-cash-short" aria-hidden="true">{money(live.shown)}</span>
            </span>
            <span className={`res-suffix stat-rate${b.net < 0 ? ' stat-neg' : ''}`}>{rate(b.net)}</span>
          </span>
          <FundingDeltas deltas={live.deltas} />
        </button></li>
      </ul>
      {onOpenMenu && <MenuButton onOpen={onOpenMenu} />}
    </header>
    <Sheet open={topic !== null} onClose={onClose} title={topic === 'funding' || topic === 'income' ? 'Finances' : topic ? STAT_TITLES[topic] : 'Department status'} className="department-stat-sheet">
      {topic && <DepartmentStatHelp g={g} topic={topic} />}
    </Sheet>
    </>
  );
}

export function DepartmentStatHelp({ g, topic }: { fundingRef?: React.Ref<HTMLButtonElement>; g: GameState; topic: DepartmentStat }) {
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
