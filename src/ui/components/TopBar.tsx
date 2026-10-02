import { assetUrl } from '../art/assetUrl';
import { useGame } from '../store';
import { budget } from '../../sim/department-selectors';
import { Icon } from '../icons';
import { money, pad2, rate } from '../format';

/** Wordmark, funding, net rate, trust, department level. Shown on every screen. */
export function TopBar() {
  const g = useGame();
  const b = budget(g);
  const d = g.department;
  return (
    <header className="topbar">
      <h1 className="wordmark"><img className="brand-lockup" src={assetUrl("brand/header-lockup-dark.svg")} alt="Tactically Idle" width="146" height="36" /></h1>
      <ul className="stats" aria-label="Department status">
        <li className="stat stat-cash" title="Funding">
          <Icon name="cash" size={18} />
          <span>{money(d.funding)}</span>
        </li>
        <li className={`stat stat-rate${b.net < 0 ? ' stat-neg' : ''}`} title="Net funding per hour">
          <Icon name="trend" size={16} />
          <span>{rate(b.net)}</span>
        </li>
        <li className="stat stat-trust" title="Public trust">
          <Icon name="shield" size={17} />
          <span>{Math.round(d.trust)}</span>
        </li>
      </ul>
      <div className="hexlevel" title={`Department level ${d.level}`} role="img" aria-label={`Department level ${d.level}`}>
        <svg viewBox="0 0 40 44" width="34" height="38" aria-hidden="true">
          <path d="M20 2l16 9.2v21.6L20 42 4 32.8V11.2z" fill="rgba(243,180,50,.08)" stroke="var(--amber)" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        <span>{pad2(d.level)}</span>
      </div>
    </header>
  );
}
