import { PatrolBoosts } from '../screens/Patrol';
import './shell.css';

/** The Store tab for now: the existing patrol boosts under a Store title. Equipment moved to HQ (Gear).
 * The hq-store-settings lane rebuilds this as the lifetime catalog. */
export function StoreTab() {
  return <>
    <header className="shell-head">
      <h1 className="shell-title">Store</h1>
    </header>
    <div className="page"><PatrolBoosts /></div>
  </>;
}
