import { useGame } from '../store';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import type { Tab } from './nav';
import { useNav } from './nav';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'hq', label: 'HQ', icon: 'house' },
  { id: 'squad', label: 'Squad', icon: 'people' },
  { id: 'ops', label: 'Ops', icon: 'pin' },
  { id: 'develop', label: 'Develop', icon: 'chart' },
  { id: 'gear', label: 'Gear', icon: 'gear' },
];

export function BottomNav() {
  const { tab, go } = useNav();
  const live = useGame().activeRun !== null;
  return (
    <nav className="bottomnav" aria-label="Main">
      {TABS.map((t) => {
        const on = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            className={`navbtn${on ? ' navbtn-on' : ''}`}
            aria-current={on ? 'page' : undefined}
            onClick={() => go(t.id)}
          >
            <span className="navicon">
              <Icon name={t.icon} size={24} />
              {t.id === 'ops' && live && <span className="live-dot" role="img" aria-label="Operation in progress" />}
            </span>
            <span className="navlabel">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
