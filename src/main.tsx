import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/theme.css';
import { loadApp } from 'virtual:game-app';
import { isLabLocation } from './lab-entry';
import { initCandidates } from './ui/settings/candidates';

const root = createRoot(document.getElementById('root')!);
// Dev builds: the design candidates under comparison (docs/ops-experience.md).
initCandidates();

// Decide before importing either app: the game's store opens, ticks and saves the campaign as soon as
// it loads, so the lab must never pull it in. A normal build folds the lab branch away.
if ((import.meta.env.DEV || __LAB_BUILD__) && isLabLocation(location.pathname, location.search, import.meta.env.BASE_URL)) {
  // /lab?station is the station-rebuild primitives page (src/dev/station-lab); folded away with the lab.
  if (new URLSearchParams(location.search).has('station')) {
    const { StationLab } = await import('./dev/station-lab/StationLab');
    root.render(
      <StrictMode>
        <StationLab />
      </StrictMode>,
    );
  } else {
    const { LabApp } = await import('./dev/lab/LabApp');
    root.render(
      <StrictMode>
        <LabApp />
      </StrictMode>,
    );
  }
} else {
  // The retired daily featured operation kept its best results here; clear them once.
  try {
    localStorage.removeItem('tactically-idle/featured-best');
  } catch {
    // Blocked storage has nothing to clear.
  }

  // A plain build imports App statically through this (so index.html preloads the game); dev and a
  // static lab build import it here, on demand (src/dev/game-app-loader.ts).
  const { App } = await loadApp();
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
