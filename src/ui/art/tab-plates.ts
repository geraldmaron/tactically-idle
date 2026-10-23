// Which tab roots open on a plate, and from which banner. The owner picks both: set a tab to false
// to drop its plate, and change `--plate-h` in theme.css for the height (owner-visual-picks).
import type { TabKey } from '../icons/kit';
import type { BannerId } from './Plates';

export const TAB_PLATES: Record<TabKey, boolean> = { hq: false, calls: false, officers: false, build: false };

/** The painted room behind each plate. Build opens on the room of its current segment. */
export const TAB_BANNER: Record<'hq' | 'calls' | 'officers' | 'upgrades' | 'armory', BannerId> = {
  hq: 'hq', calls: 'ops', officers: 'squad', upgrades: 'develop', armory: 'gear',
};
