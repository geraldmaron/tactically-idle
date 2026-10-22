import { ChoiceRail } from '../components/ChoiceRail';
import { useNav } from '../components/nav';
import { TabPlate } from '../art/TabPlate';
import { DevelopScreen } from './Develop';
import { GearScreen } from './Gear';

/** The Build tab: Upgrades and the Armory, the two ways to spend funding to grow the department
 * (docs/ui-ux-audit.md, "Four destinations"). Each segment keeps its own route id, so
 * `nav.go('gear')` and `nav.openDevelopment(id)` land on the right one. */
export function BuildScreen() {
  const nav = useNav();
  const segment = nav.tab === 'gear' ? 'gear' : 'develop';
  return <>
    <TabPlate tab="build" surface={segment === 'gear' ? 'armory' : 'upgrades'} title="Build" />
    <div className="build-segments">
      <ChoiceRail value={segment} kind="navigation" label="Build sections" grow onChange={(next) => nav.go(next)} options={[
        { value: 'develop', label: 'Upgrades' }, { value: 'gear', label: 'Armory' },
      ]} />
    </div>
    {segment === 'gear' ? <GearScreen /> : <DevelopScreen highlightedNode={nav.developmentNode} highlightRequest={nav.developmentRequest} />}
  </>;
}
