// The compact plate a tab root opens on: its painted room, the tab's icon and name, and at most one
// short chip (the date on HQ). No kicker and no paragraph. Height is `--plate-h` (theme.css); which
// tabs carry one is TAB_PLATES (tab-plates.ts). A missing painting leaves the flat gradient.
import type { ReactNode } from 'react';
import { Icon } from '../icons';
import { TAB_ICON } from '../icons/kit';
import type { TabKey } from '../icons/kit';
import { PlateArt, plateUrl } from './Plates';
import { TAB_BANNER, TAB_PLATES } from './tab-plates';

type Surface = keyof typeof TAB_BANNER;

export function TabPlate({ tab, surface = tab === 'build' ? 'upgrades' : tab, title, meta, level = 2 }: { tab: TabKey; surface?: Surface; title: ReactNode; meta?: ReactNode; level?: 1 | 2 }) {
  if (!TAB_PLATES[tab]) return null;
  const Heading = level === 1 ? 'h1' : 'h2';
  return <header className="plate plate-grain tab-plate" data-tab-plate={tab}>
    <PlateArt src={plateUrl(`banner_${TAB_BANNER[surface]}`)} />
    <Heading className="tab-plate-title"><Icon name={TAB_ICON[tab]} size={24} />{title}</Heading>
    {meta && <span className="tab-plate-meta">{meta}</span>}
  </header>;
}
