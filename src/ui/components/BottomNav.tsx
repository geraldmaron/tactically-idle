import { useGame } from '../store';
import type { TopTab } from './nav';
import { topTab, useNav } from './nav';
import { nodeOptions } from '../../sim/department-selectors';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import { TAB_ICON } from '../icons/kit';

const TABS: { id: TopTab; label: string; icon: IconName }[] = [
  { id: 'hq', label: 'HQ', icon: TAB_ICON.hq },
  { id: 'ops', label: 'Calls', icon: TAB_ICON.calls },
  { id: 'squad', label: 'Team', icon: TAB_ICON.officers },
  { id: 'build', label: 'Build', icon: TAB_ICON.build },
  { id: 'store', label: 'Store', icon: 'store' },
];

/** The five destinations, equal width. Calls carries a
 * count of new calls and, while a call or its debrief waits, the live ring. Other tabs get a dot
 * only for a move the player can make now; HQ never badges. */
export function BottomNav() {
  const nav = useNav();
  const current = topTab(nav.tab);
  const g = useGame();
  const live = g.activeRun !== null;
  const fresh = ((g as { incidents?: { seen: boolean; expiresAt: number }[] }).incidents ?? []).filter((i) => !i.seen).length;
  const affordable = nodeOptions(g).some((o) => o.targetTier && o.status !== 'locked' && o.quote.ok);
  const dot: Partial<Record<TopTab, string>> = {
    ...(affordable ? { build: 'An upgrade is ready to buy' } : {}),
  };
  const open = (id: TopTab) => {
    if (id === 'build') nav.go('develop');
    else nav.go(id);
  };
  return (
    <nav className="bottomnav" aria-label="Main">
      {TABS.map((t) => {
        const on = current === t.id;
        return (
          <button
            key={t.id}
            type="button"
            className={`navbtn${on ? ' navbtn-on' : ''}`}
            aria-current={on ? 'page' : undefined}
            onClick={() => open(t.id)}
          >
            <span className="navicon">
              <Icon name={t.icon} size={24} />
              {/* The one motion signal: a call or its debrief waits and the player is looking elsewhere. */}
              {t.id === 'ops' && live && !on && <span className="live-dot" role="img" aria-label={g.activeRun?.status === 'debrief' ? 'A debrief is waiting' : 'A call is waiting on you'} />}
              {t.id === 'ops' && !live && fresh > 0 && !on && (
                <span className="navbadge" role="img" aria-label={`${fresh} new call${fresh === 1 ? '' : 's'}`}>
                  {fresh}
                </span>
              )}
              {dot[t.id] && !on && <span className="navdot" role="img" aria-label={dot[t.id]} />}
            </span>
            <span className="navlabel">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
