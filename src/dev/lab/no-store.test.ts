// The lab never loads the game's store (spec 9.1, rule 3). src/ui/store.ts opens, ticks and saves the
// owner's campaign as soon as it is imported, and the lab runs on the same origin, so one import
// chain to it would let the lab tick and save a real save. This walks every import (static, side
// effect, re-export, dynamic and worker URL) from the lab's two entries and fails with the chain.
import { describe, expect, it } from 'vitest';
import { importChain, runtimeImports, SOURCES, STORE_MODULES, walkImports } from '../import-graph';

const ENTRIES = ['/src/dev/lab/LabApp.tsx', '/src/dev/lab/lab.worker.ts'];

describe('the lab never imports the game store', () => {
  it('reads imports the way the bundler loads them', () => {
    expect(runtimeImports(`import type { A } from './a';\nimport { type B, type C } from './b';\nimport { D, type E } from './d';\nimport './e.css';\n`
      + `export type { F } from './f';\nexport { G } from './g';\nconst L = lazy(() => import('./l'));\n// import { X } from './x';\nnew Worker(new URL('./w.ts', import.meta.url));`))
      .toEqual(['./d', './g', './e.css', './l', './w.ts']);
  });

  const { parent, unresolved } = walkImports(ENTRIES);
  it('walks the whole lab graph', () => {
    expect(unresolved).toEqual([]);
    expect(ENTRIES.every(entry => entry in SOURCES)).toBe(true);
    expect(parent.has('/src/dev/lab/shell/TopBar.tsx')).toBe(true);
    expect(parent.has('/src/dev/lab/surfaces/play/index.tsx')).toBe(true);
    expect(parent.has('/src/dev/lab/jobs/runners.ts')).toBe(true);
  });

  for (const target of STORE_MODULES) {
    it(`never reaches ${target}`, () => {
      expect(parent.has(target) ? `the lab reaches it through\n  ${importChain(parent, target)}` : null).toBeNull();
    });
  }
});
