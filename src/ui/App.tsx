import { useEffect, useState } from 'react';
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
import { ChromeProvider, useChromeShell } from './components/chrome';
import { Button } from './components/ui';
import { ITEMS } from '../content/items';
import { HQ } from './screens/HQ';
import { SquadScreen } from './screens/Squad';
import { OpsScreen } from './screens/Ops';
import { DevelopScreen } from './screens/Develop';
import { GearScreen } from './screens/Gear';
import { OfficerSheet } from './screens/OfficerSheet';
import { SaveManager, SaveWarning } from './components/SaveManager';
import { WelcomeBack } from './components/WelcomeBack';
import { GrantToasts } from './components/GrantToasts';
import { useCampaigns, useGame } from './store';
import { DepartmentContext } from './components/department-context';
import { FirstRun } from './settings/FirstRun';
import { SettingsSheet } from './settings/SettingsSheet';
import { useSettings } from './settings/SettingsControls';

export function App() {
  const saved = useCampaigns();
  return <FirstRunGate key={saved.session} />;
}

/** The first launch asks for the player's settings before the department opens. Keyed by session
 * in App, so New and Load still remount the shell. */
function FirstRunGate() {
  if (!useSettings().firstRunDone) return <div className="stage"><div className="app" style={TEXTURES}><FirstRun /></div></div>;
  return <GameShell />;
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [overlay, setOverlay] = useState<HTMLElement | null>(null);
  const chrome = useChromeShell();
  const { mode } = chrome.api;
  const [app, setApp] = useState<HTMLDivElement | null>(null);
  useChromeInsets(app, chrome.api.head, chrome.api.foot);

  return (
    <div className="stage">
      <div className="app" style={TEXTURES} ref={setApp} data-chrome={mode}>
        <NavContext.Provider value={nav}>
          <ChromeProvider value={chrome.api}>
          <DepartmentScope>
            <OverlayRootContext.Provider value={overlay}>
              <ToastProvider>
                <div className="chrome-head" ref={chrome.setHead}>
                  {mode === 'desk' && <TopBar onOpenSaves={() => setSavesOpen(true)} />}
                </div>
                <SaveWarning onOpen={() => setSavesOpen(true)} />
                <main className={`screen screen-${tab}`} key={tab}>
                  {nav.returnToItem && <div className="player-return"><Button onClick={nav.returnToEquipment}>Back to item · {ITEMS[nav.returnToItem]?.name ?? 'Equipment'}</Button></div>}
                  {tab === 'hq' && <HQ />}
                  {tab === 'squad' && <SquadScreen />}
                  {tab === 'ops' && <OpsScreen />}
                  {tab === 'develop' && <DevelopScreen highlightedNode={nav.developmentNode} highlightRequest={nav.developmentRequest} />}
                  {tab === 'gear' && <GearScreen />}
                </main>
                <div className="chrome-foot" ref={chrome.setFoot}>
                  {mode === 'desk' && <BottomNav />}
                </div>
                <SaveManager open={savesOpen} onClose={() => setSavesOpen(false)} onOpenSettings={() => { setSavesOpen(false); setSettingsOpen(true); }} />
                <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
                <OfficerSheet officerId={nav.officerId} onClose={nav.closeOfficer} />
                <WelcomeBack />
                <GrantToasts />
              </ToastProvider>
            </OverlayRootContext.Provider>
          </DepartmentScope>
          </ChromeProvider>
        </NavContext.Provider>
        <div className="overlay-root" ref={setOverlay} />
      </div>
    </div>
  );
}

/** The heights of the head and foot slots as `--chrome-head-h` and `--chrome-foot-h`, so toasts
 * stand clear of both. `--nav-h` keeps its old meaning (the foot without the safe area), so
 * nonmodal sheets sit above whatever holds the foot. */
function useChromeInsets(app: HTMLElement | null, head: HTMLElement | null, foot: HTMLElement | null) {
  useEffect(() => {
    if (!app || !head || !foot || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      app.style.setProperty('--chrome-head-h', `${head.offsetHeight}px`);
      app.style.setProperty('--chrome-foot-h', `${foot.offsetHeight}px`);
      app.style.setProperty('--nav-h', `calc(${foot.offsetHeight}px - env(safe-area-inset-bottom))`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(head);
    observer.observe(foot);
    return () => observer.disconnect();
  }, [app, head, foot]);
}
