// Seeking a call seed for a wanted draw (a turn member, a group size, a situation) that keeps the rest
// of the call's draw, and a campaign seed whose squad A holds a cert.
import { describe, expect, it } from 'vitest';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import type { IncidentTemplate } from '../../../content/incidents/types';
import { countCombos } from '../../../gen/incident/trees-v13/dependencies';
import { parseLabUrl } from '../url';
import { drawOf, seekCallSeed, seekSquadSeed } from './seek';
import type { DrawWant } from './seek';
import { openSession } from './session';
import type { Session } from './session';

function open(query: string): Session {
  const opened = openSession(parseLabUrl(`?${query}`).url, null);
  if (!('frames' in opened)) throw new Error(opened.message);
  return opened;
}

describe('seekCallSeed', () => {
  for (const template of Object.values(INCIDENT_TEMPLATES) as IncidentTemplate[]) {
    it(`${template.type}: finds every turn member and group size, keeping the rest of the draw`, () => {
      const base = open(`type=${template.type}&tier=2&variant=1`);
      const spec = base.resolved.spec!;
      const at = { family: spec.familyId, seed: spec.buildingSeed, tier: spec.tier, call: spec.seed };
      const wants: DrawWant[] = [
        ...Object.entries(template.tree.turns ?? {}).flatMap(([group, members]) => members.map(node => ({ turns: { [group]: node } }))),
        ...[...new Set(countCombos(template).flatMap(combo => Object.entries(combo).map(entry => JSON.stringify(entry))))]
          .map(text => JSON.parse(text) as [string, number]).map(([group, n]) => ({ counts: { [group]: n } })),
      ];
      expect(wants.length).toBeGreaterThan(1);
      for (const want of wants) {
        const found = seekCallSeed(template.type, at, want);
        expect(found, JSON.stringify(want)).not.toBeNull();
        const s = open(`type=${template.type}&family=${spec.familyId}&seed=${spec.buildingSeed}&tier=2&call=${found!.call}`);
        for (const [group, node] of Object.entries(want.turns ?? {})) expect(s.turnDrawn[group]).toBe(node);
        for (const [group, n] of Object.entries(want.counts ?? {})) expect(s.counts[group]).toBe(n);
        // The rest of the draw is kept: situation, pacing, the other groups and turns.
        expect(s.situation).toBe(base.situation);
        expect(s.resolved.situation).toEqual(base.resolved.situation);
        // Group sizes are the draw a search keeps. The call's other compile-time facts (callCounts:
        // armed members, who starts upstairs) follow the seed, so they may change with it.
        const sized = (counts: Record<string, number>) => Object.fromEntries(Object.keys(template.tree.groups ?? {}).map(group => [group, { ...counts, ...want.counts }[group]]));
        expect(sized(s.counts)).toEqual(sized(base.counts));
        expect({ ...s.turnDrawn, ...want.turns }).toEqual({ ...base.turnDrawn, ...want.turns });
        // The building hosts it in place, and a changed seed says whose names changed.
        expect(s.scenario.locationSeed).toBe(spec.buildingSeed);
        if (found!.call !== spec.seed) for (const line of found!.changed) expect(line).toMatch(/^names \S.* → \S/);
      }
    }, 60000);
  }

  it('returns the base call itself when it already has the draw, and null when nothing in range does', () => {
    const base = open('type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1');
    const spec = base.resolved.spec!;
    const at = { family: 'market_row', seed: 7, tier: 2, call: spec.seed };
    expect(seekCallSeed('hostage_crisis', at, { turns: { ...base.turnDrawn } })).toEqual({ call: spec.seed, changed: [] });
    expect(seekCallSeed('hostage_crisis', at, { counts: { others: 9 } }, { limit: 200 })).toBeNull();
    // Situation from params: the base call is the one the situation draw picks.
    const byVariant = seekCallSeed('hostage_crisis', { family: 'market_row', seed: 7, tier: 2, variant: 1 }, {});
    expect(byVariant?.call).toBe(spec.seed);
  });

  it('with no base call, steps through seeds with a situation from `from` (the casts job)', () => {
    const template = INCIDENT_TEMPLATES.hostage_crisis!;
    const seeds: number[] = [];
    for (let from = 1; seeds.length < 4; from = seeds[seeds.length - 1] + 1) {
      const found = seekCallSeed('hostage_crisis', { family: 'market_row', seed: 7, tier: 2 }, { variant: 2 }, { from });
      expect(found!.changed).toEqual([]);
      seeds.push(found!.call);
    }
    expect(new Set(seeds).size).toBe(4);
    for (const call of seeds) expect(drawOf(template, { type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed: call, tier: 2, contentVersion: 13 }).variant).toBe(2);
  });
});

describe('seekSquadSeed', () => {
  it('finds a campaign whose squad A holds a cert, or reports how many it tried', () => {
    expect(seekSquadSeed('crisis_negotiation')).toEqual({ seed: 1, tried: 1 });
    // No day-one squad A holds vehicle operations (0 of 61 seeds when measured): the search says so.
    expect(seekSquadSeed('vehicle_operations')).toEqual({ seed: null, tried: 500 });
    expect(seekSquadSeed('vehicle_operations', { from: 600, limit: 20 })).toEqual({ seed: null, tried: 20 });
  }, 30000);
});
