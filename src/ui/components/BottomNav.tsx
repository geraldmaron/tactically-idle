import { useGame } from '../store';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import type { Tab } from './nav';
import { useNav } from './nav';
import { nodeOptions } from '../../sim/department-selectors';
import { hqOverview } from '../../sim/hq-selectors';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'hq', label: 'HQ', icon: 'house' },
  { id: 'squad', label: 'Squad', icon: 'people' },
  { id: 'ops', label: 'Ops', icon: 'pin' },
  { id: 'develop', label: 'Develop', icon: 'chart' },
  { id: 'gear', label: 'Gear', icon: 'gear' },
];

/** The five destinations, with Ops raised in the center as the game's main action, as management
 * games put their primary button. A badge or dot appears only for something the player can act on
 * now: new calls, an upgrade they can afford, a radio shortage that blocks a deployment. */
export function BottomNav() {
  const { tab, go } = useNav();
  const g = useGame();
  const live = g.activeRun !== null;
  const fresh = ((g as { incidents?: { seen: boolean; expiresAt: number }[] }).incidents ?? []).filter((i) => !i.seen).length;
  const affordable = nodeOptions(g).some((o) => o.targetTier && o.status !== 'locked' && o.quote.ok);
  const shortRadios = hqOverview(g, Date.now()).radios.shortage;
  const dot: Partial<Record<Tab, string>> = {
    ...(affordable ? { develop: 'An upgrade is ready to buy' } : {}),
    ...(shortRadios ? { gear: 'Radios are short for a deployment' } : {}),
  };
  return (
    <nav className="bottomnav" aria-label="Main">
      {TABS.map((t) => {
        const on = tab === t.id;
        const primary = t.id === 'ops';
        return (
          <button
            key={t.id}
            type="button"
            className={`navbtn${on ? ' navbtn-on' : ''}${primary ? ' navbtn-primary' : ''}`}
            aria-current={on ? 'page' : undefined}
            onClick={() => go(t.id)}
          >
            <span className="navicon">
              <Icon name={t.icon} size={primary ? 26 : 24} />
              {/* The one motion signal: a call waits on the player and they are looking elsewhere. */}
              {primary && live && !on && <span className="live-dot" role="img" aria-label={g.activeRun?.status === 'debrief' ? 'A debrief is waiting' : 'A call is waiting on you'} />}
              {primary && !live && fresh > 0 && !on && (
                <span className="navbadge" role="img" aria-label={`${fresh} new incident${fresh === 1 ? '' : 's'}`}>
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
