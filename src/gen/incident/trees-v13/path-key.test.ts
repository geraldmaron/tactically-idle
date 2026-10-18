import { describe, expect, it } from 'vitest';
import { SCENARIO_TYPES } from '../../../content/scenario-types';
import { stanceOf } from '../../../sim/meters';
import type { GameState } from '../../../sim/types';
import { specForSituation } from '../gates/catalog';
import { startGateRun } from '../gates/engine-driver';
import { generateIncident } from '../index';
import { pathStateKey } from './path-key';

// Situation 1 of the hostage call runs the owner's clock, and the taker has meters.
const family = SCENARIO_TYPES.find(info => info.type === 'hostage_crisis')!.families[0];
const start = startGateRun(generateIncident(specForSituation('hostage_crisis', family, 1)).id);
const edit = (change: (run: NonNullable<GameState['activeRun']>) => void): GameState => {
  const next = structuredClone(start);
  change(next.activeRun!);
  return next;
};

describe('path state key', () => {
  it('is the same for the same place in a call', () => {
    expect(pathStateKey(start)).toBe(pathStateKey(structuredClone(start)));
    // Flag order and other bookkeeping don't make a different place.
    expect(pathStateKey(edit(run => { run.flags.reverse(); run.revision += 3; }))).toBe(pathStateKey(start));
  });

  it('tells apart states that differ only by a subject’s stance', () => {
    expect(start.activeRun!.meters?.taker).toBeDefined();
    const heard = edit(run => { run.meters!.taker.moved = { heard: { agitation: 0, rapport: 0 } }; });
    const breaking = edit(run => { run.meters!.taker.moved = { heard: { agitation: 0, rapport: 0 } }; run.meters!.taker.agitation = 90; });
    expect(stanceOf(heard.activeRun!.meters!.taker)).not.toBe(stanceOf(start.activeRun!.meters!.taker));
    expect(stanceOf(breaking.activeRun!.meters!.taker)).toBe('breaking');
    expect(new Set([start, heard, breaking].map(pathStateKey)).size).toBe(3);
    // A move inside the same stance is the same place.
    expect(pathStateKey(edit(run => { run.meters!.taker.rapport += 1; }))).toBe(pathStateKey(start));
  });

  it('tells apart states that differ only by a clock cue, running out, or ten minutes of clock', () => {
    const clock = Object.keys(start.activeRun!.clocks ?? {})[0];
    expect(clock).toBe('owner_condition');
    const cued = edit(run => { run.clocks![clock].cued += 1; });
    const out = edit(run => { run.clocks![clock].value = 0; });
    const later = edit(run => { run.clocks![clock].value -= 10; });
    expect(new Set([start, cued, out, later].map(pathStateKey)).size).toBe(4);
    expect(pathStateKey(edit(run => { run.clocks![clock].value -= 0.1; }))).toBe(pathStateKey(edit(run => { run.clocks![clock].value -= 0.2; })));
  });

  it('tells apart an ending from another with the same flags', () => {
    expect(pathStateKey(edit(run => { run.endingId = 'handed_over'; }))).not.toBe(pathStateKey(start));
  });
});
