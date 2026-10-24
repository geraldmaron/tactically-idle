import { GearScreen } from './Gear';
import { PatrolBoosts } from './Patrol';
import { ChoiceRail } from '../components/ChoiceRail';
import { useNav } from '../components/nav';
import './store.css';

/** One destination for equipment purchases, stock, service and standing restock tools. */
export function StoreScreen() {
  const nav = useNav();
  return <>
    {/* A tab root carries no page title (contract 11): the tab bar names the screen, the rail is the second level. */}
    <header className="store-screen-head">
      <h1 className="sr-only">Store</h1>
      <ChoiceRail value={nav.storeSection} kind="navigation" label="Store sections" grow onChange={nav.setStoreSection} options={[
        { value: 'equipment', label: 'Equipment' }, { value: 'boosts', label: 'Boosts' },
      ]} />
    </header>
    {nav.storeSection === 'boosts' ? <div className="page"><PatrolBoosts /></div> : <GearScreen compactTools />}
  </>;
}
