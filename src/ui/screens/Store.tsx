import { Icon } from '../icons';
import { GearScreen } from './Gear';
import { PatrolBoosts } from './Patrol';
import { ChoiceRail } from '../components/ChoiceRail';
import { useNav } from '../components/nav';
import { PlateArt, plateUrl } from '../art/Plates';
import './store.css';

/** One destination for equipment purchases, stock, service and standing restock tools. */
export function StoreScreen() {
  const nav = useNav();
  return <>
    <header className={`store-screen-head${nav.storeSection === 'equipment' ? ' store-screen-counter plate' : ''}`}>
      {nav.storeSection === 'equipment' && <PlateArt src={plateUrl('scene_armory_counter')} />}
      <h1 className="section-title store-screen-title"><Icon name="store" size={24} />Store</h1>
      <ChoiceRail value={nav.storeSection} kind="navigation" label="Store sections" grow onChange={nav.setStoreSection} options={[
        { value: 'equipment', label: 'Equipment' }, { value: 'boosts', label: 'Boosts' },
      ]} />
    </header>
    {nav.storeSection === 'boosts' ? <div className="page"><PatrolBoosts /></div> : <GearScreen compactTools />}
  </>;
}
