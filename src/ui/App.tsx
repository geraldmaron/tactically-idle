import { useMemo, useState } from 'react';
import './app.css';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { ToastProvider } from './components/toast';
import { OverlayRootContext } from './components/Sheet';
import { NavContext } from './components/nav';
import type { Tab } from './components/nav';
import { HQ } from './screens/HQ';
import { SquadScreen } from './screens/Squad';
import { OpsScreen } from './screens/Ops';
import { DevelopScreen } from './screens/Develop';
import { GearScreen } from './screens/Gear';

export function App() {
  const [tab, setTab] = useState<Tab>('hq');
  const [overlay, setOverlay] = useState<HTMLElement | null>(null);
  const nav = useMemo(() => ({ tab, go: setTab }), [tab]);

  return (
    <div className="stage">
      <div className="app">
        <NavContext.Provider value={nav}>
          <OverlayRootContext.Provider value={overlay}>
            <ToastProvider>
              <TopBar />
              <main className={`screen screen-${tab}`} key={tab}>
                {tab === 'hq' && <HQ />}
                {tab === 'squad' && <SquadScreen />}
                {tab === 'ops' && <OpsScreen />}
                {tab === 'develop' && <DevelopScreen />}
                {tab === 'gear' && <GearScreen />}
              </main>
              <BottomNav />
            </ToastProvider>
          </OverlayRootContext.Provider>
        </NavContext.Provider>
        <div className="overlay-root" ref={setOverlay} />
      </div>
    </div>
  );
}
