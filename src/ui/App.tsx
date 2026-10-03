import { useState } from 'react';
import './app.css';
import './player-navigation.css';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { ToastProvider } from './components/toast';
import { OverlayRootContext } from './components/Sheet';
import { NavContext, usePlayerNavigation } from './components/nav';
import { Button } from './components/ui';
import { ITEMS } from '../content/items';
import { HQ } from './screens/HQ';
import { SquadScreen } from './screens/Squad';
import { OpsScreen } from './screens/Ops';
import { DevelopScreen } from './screens/Develop';
import { GearScreen } from './screens/Gear';
import { CampaignBar, SaveManager } from './components/SaveManager';
import { useCampaigns } from './store';

export function App() {
  const saved = useCampaigns();
  return <GameShell key={saved.session} />;
}

function GameShell() {
  const nav = usePlayerNavigation();
  const { tab } = nav;
  const [savesOpen, setSavesOpen] = useState(false);
  const [overlay, setOverlay] = useState<HTMLElement | null>(null);

  return (
    <div className="stage">
      <div className="app">
        <NavContext.Provider value={nav}>
          <OverlayRootContext.Provider value={overlay}>
            <ToastProvider>
              <TopBar />
              <CampaignBar onOpen={() => setSavesOpen(true)} />
              <main className={`screen screen-${tab}`} key={tab}>
                {nav.returnToItem && <div className="player-return"><Button onClick={nav.returnToEquipment}>Back to item · {ITEMS[nav.returnToItem]?.name ?? 'Equipment'}</Button></div>}
                {tab === 'hq' && <HQ />}
                {tab === 'squad' && <SquadScreen />}
                {tab === 'ops' && <OpsScreen />}
                {tab === 'develop' && <DevelopScreen highlightedNode={nav.developmentNode} highlightRequest={nav.developmentRequest} />}
                {tab === 'gear' && <GearScreen />}
              </main>
              <BottomNav />
              <SaveManager open={savesOpen} onClose={() => setSavesOpen(false)} />
            </ToastProvider>
          </OverlayRootContext.Provider>
        </NavContext.Provider>
        <div className="overlay-root" ref={setOverlay} />
      </div>
    </div>
  );
}
