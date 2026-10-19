import { useState } from 'react';
import type { ReactNode } from 'react';
import './app.css';
import './player-navigation.css';
import './skin.css';
import { textureVars } from './art/Plates';
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
import { OfficerSheet } from './screens/OfficerSheet';
import { SaveManager, SaveWarning } from './components/SaveManager';
import { useCampaigns, useGame } from './store';
import { DepartmentContext } from './components/department-context';

export function App() {
  const saved = useCampaigns();
  return <GameShell key={saved.session} />;
}

/** The department for store-free components (OfficerCard's aged portraits). Only this provider
 * follows the game, so the shell around it does not re-render on every tick. */
function DepartmentScope({ children }: { children: ReactNode }) {
  const g = useGame();
  return <DepartmentContext.Provider value={g.department}>{children}</DepartmentContext.Provider>;
}

/** The skin's texture URLs (skin.css), resolved once against the base path. */
const TEXTURES = textureVars() as React.CSSProperties;

function GameShell() {
  const nav = usePlayerNavigation();
  const { tab } = nav;
  const [savesOpen, setSavesOpen] = useState(false);
  const [overlay, setOverlay] = useState<HTMLElement | null>(null);

  return (
    <div className="stage">
      <div className="app" style={TEXTURES}>
        <NavContext.Provider value={nav}>
          <DepartmentScope>
            <OverlayRootContext.Provider value={overlay}>
              <ToastProvider>
                <TopBar onOpenSaves={() => setSavesOpen(true)} />
                <SaveWarning onOpen={() => setSavesOpen(true)} />
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
                <OfficerSheet officerId={nav.officerId} onClose={nav.closeOfficer} />
              </ToastProvider>
            </OverlayRootContext.Provider>
          </DepartmentScope>
        </NavContext.Provider>
        <div className="overlay-root" ref={setOverlay} />
      </div>
    </div>
  );
}
