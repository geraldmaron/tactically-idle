import { BuildScreen } from '../screens/Build';
import { GearScreen } from '../screens/Gear';
import { TrainingStore } from '../storefront/TrainingStore';
import { PlateArt, plateUrl } from '../art/Plates';
import { ChoiceRail } from '../components/ChoiceRail';
import { useNav } from '../components/nav';
import type { HqSection } from '../components/nav';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import './shell.css';

/** What each section opens on: its painted room, the word on the plate, and one plain line. */
const SECTIONS: { value: HqSection; label: string; icon: IconName; plate: string; title: string; line: string }[] = [
  { value: 'build', label: 'Build', icon: 'build', plate: 'banner_develop', title: 'Facilities', line: 'Rooms and upgrades. The one worth building next comes first.' },
  { value: 'gear', label: 'Gear', icon: 'box', plate: 'banner_gear', title: 'Armory', line: 'What the department owns and what each squad carries.' },
  { value: 'training', label: 'Training', icon: 'mortarboard', plate: 'room_training_lit', title: 'Training floor', line: 'Courses that make an officer better at one thing.' },
];

/** The HQ tab (canvas, HQ): what the department builds, carries and learns. A painted plate for the
 * section, the section rail with a picture on each choice, then the screen itself. */
export function HeadquartersTab() {
  const nav = useNav();
  const section = SECTIONS.find((s) => s.value === nav.hqSection) ?? SECTIONS[0]!;
  return <>
    <header className="hq-head">
      <div className="hq-plate plate plate-grain" data-section={section.value}>
        <PlateArt src={plateUrl(section.plate)} />
        <span className="hq-kicker">Headquarters</span>
        <h1 className="hq-title"><Icon name={section.icon} size={24} />{section.title}</h1>
        <p className="hq-line">{section.line}</p>
      </div>
      <ChoiceRail value={nav.hqSection} kind="navigation" label="HQ sections" grow onChange={nav.setHqSection}
        options={SECTIONS.map((s) => ({ value: s.value, label: <><Icon name={s.icon} size="md" />{s.label}</> }))} />
    </header>
    {nav.hqSection === 'gear' ? <GearScreen compactTools />
      : nav.hqSection === 'training' ? <div className="page training-page"><TrainingStore /></div>
      : <BuildScreen />}
  </>;
}
