import { BuildScreen } from '../screens/Build';
import { GearScreen } from '../screens/Gear';
import { TrainingStore } from '../storefront/TrainingStore';
import { ChoiceRail } from '../components/ChoiceRail';
import { useNav } from '../components/nav';
import type { HqSection } from '../components/nav';
import './shell.css';

const SECTIONS: { value: HqSection; label: string }[] = [
  { value: 'build', label: 'Build' },
  { value: 'gear', label: 'Gear' },
  { value: 'training', label: 'Training' },
];

/** The HQ tab: what the department builds, carries and learns. A section rail over the three existing
 * screens (Build, Gear, Training); the hq-store-settings lane replaces this with the rebuilt HQ. */
export function HeadquartersTab() {
  const nav = useNav();
  return <>
    <header className="shell-head">
      <h1 className="shell-title">HQ</h1>
      <ChoiceRail value={nav.hqSection} kind="navigation" label="HQ sections" grow onChange={nav.setHqSection} options={SECTIONS} />
    </header>
    {nav.hqSection === 'gear' ? <GearScreen compactTools />
      : nav.hqSection === 'training' ? <div className="page training-page"><TrainingStore /></div>
      : <BuildScreen />}
  </>;
}
