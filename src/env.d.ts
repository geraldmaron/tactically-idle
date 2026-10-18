/** True only in a static lab build (`npm run build:lab`, `VITE_LAB=1`); vite.config.ts defines it. A
 * normal build folds every branch behind it away. */
declare const __LAB_BUILD__: boolean;

/** src/main.tsx's loader for the game's App (vite.config.ts, src/dev/game-app-loader.ts). */
declare module 'virtual:game-app' {
  export function loadApp(): Promise<typeof import('./ui/App')>;
}
