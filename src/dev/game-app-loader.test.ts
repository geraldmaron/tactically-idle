// Review finding game-entry-loses-preloads: the plain build imports App statically, so index.html
// preloads the game; dev and a static lab build import it on demand, so the lab never loads the store.
// scripts/check-no-lab.mjs checks the built entry has no import() (part of `verify`).
import { describe, expect, it } from 'vitest';
import MAIN from '../main.tsx?raw';
import VITE_CONFIG from '../../vite.config.ts?raw';
import { runtimeImports } from './import-graph';
import { GAME_APP_ID, gameAppLoaderCode } from './game-app-loader';

describe('the game App loader', () => {
  it('imports App statically for a plain build and on demand otherwise', () => {
    const plain = gameAppLoaderCode(false), lazy = gameAppLoaderCode(true);
    expect(plain).toMatch(/^import \* as app from "\/src\/ui\/App\.tsx";/);
    expect(plain).not.toContain('import(');
    expect(lazy).toContain('import("/src/ui/App.tsx")');
    expect(lazy).not.toMatch(/^import /m);
  });
  it('is how main.tsx reaches App, and vite.config.ts serves it lazily in dev and build:lab', () => {
    expect(runtimeImports(MAIN)).toContain(GAME_APP_ID);
    expect(runtimeImports(MAIN).some(spec => /ui\/App/.test(spec))).toBe(false);
    expect(VITE_CONFIG).toMatch(/lazy = config\.command === 'serve' \|\| process\.env\.VITE_LAB === '1'/);
    expect(VITE_CONFIG).toContain('gameAppLoader()');
  });
});
