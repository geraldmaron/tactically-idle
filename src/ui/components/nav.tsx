import { createContext, useContext } from 'react';

export type Tab = 'hq' | 'squad' | 'ops' | 'develop' | 'gear';

export interface NavApi {
  tab: Tab;
  go: (t: Tab) => void;
}

export const NavContext = createContext<NavApi>({ tab: 'hq', go: () => {} });
export const useNav = () => useContext(NavContext);
