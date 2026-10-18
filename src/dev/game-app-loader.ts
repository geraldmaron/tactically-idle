// How src/main.tsx loads the game's App (the `virtual:game-app` module vite.config.ts serves). A plain
// `vite build` imports App statically, so index.html preloads the game's chunks and stylesheets as it
// did before the lab existed; dev and a static lab build import it dynamically, so the lab at /lab
// never loads the game's store (src/ui/store.ts opens, ticks and saves the campaign on import).
// Nothing in the game or the lab imports this file; vite.config.ts and its test do.

export const GAME_APP_ID = 'virtual:game-app';
const APP = '/src/ui/App.tsx';

/** The module's code: `loadApp()` resolves to App's module, lazily (dev, `build:lab`) or from a
 * static import (a plain build, where the lab branch is folded away). */
export function gameAppLoaderCode(lazy: boolean): string {
  return lazy
    ? `export const loadApp = () => import(${JSON.stringify(APP)});\n`
    : `import * as app from ${JSON.stringify(APP)};\nexport const loadApp = () => Promise.resolve(app);\n`;
}
