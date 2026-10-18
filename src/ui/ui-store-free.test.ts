// The player components the Scenario Lab renders never load the game's store (spec 10.2, Stream G).
// src/ui/store.ts opens, ticks and saves the campaign as soon as it is imported, so one import chain
// to it from these files would let the lab tick and save a real save. This walks every runtime
// import (src/dev/import-graph.ts, shared with src/dev/lab/no-store.test.ts, which guards the lab's
// own entries the same way) and fails with the chain.
import { describe, expect, it } from 'vitest';
import { importChain, SOURCES, STORE_MODULES, walkImports } from '../dev/import-graph';

const ENTRIES = [
  '/src/ui/screens/LiveView.tsx', '/src/ui/screens/DecisionList.tsx', '/src/ui/screens/CallTile.tsx', '/src/ui/screens/PrepBriefing.tsx',
  '/src/ui/screens/DebriefContents.tsx', '/src/ui/people/PeopleText.tsx', '/src/ui/components/ToastView.tsx',
  // Also pure by contract: the model, the groups, the matcher, the department context and the handoff.
  '/src/ui/screens/live-model.ts', '/src/ui/screens/contributor-groups.ts', '/src/ui/people/lexicon.ts', '/src/ui/components/department-context.ts', '/src/ui/lab-handoff.ts',
];
/** Every module reachable from one entry, with the module that first imported it. */
const walk = (entry: string) => walkImports([entry]).parent;

describe('the player components the lab renders are store-free', () => {
  it('reads every entry', () => {
    expect(ENTRIES.filter(entry => !(entry in SOURCES))).toEqual([]);
    // The walk sees through to the shared pieces (a sanity check that it follows imports at all).
    expect(walk('/src/ui/screens/LiveView.tsx').has('/src/ui/components/OfficerCard.tsx')).toBe(true);
    expect(walk('/src/ui/screens/LiveView.tsx').has('/src/ui/screens/DecisionList.tsx')).toBe(true);
  });

  it('finds a store import when there is one', () => {
    expect(walk('/src/ui/screens/OpsLive.tsx').has('/src/ui/store.ts')).toBe(true);
  });

  for (const entry of ENTRIES) {
    it(entry.replace('/src/ui/', ''), () => {
      const parent = walk(entry);
      for (const target of STORE_MODULES) expect(parent.has(target) ? `${entry} reaches ${target} through\n  ${importChain(parent, target)}` : null).toBeNull();
    });
  }
});
