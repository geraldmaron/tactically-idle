// The lab's squads: the reference squad (day-one squad A of campaign 719), lab cert grants to its
// first officer, the full kit, and the gate's own start left exactly as it was.
import { describe, expect, it } from 'vitest';
import { NOW, startGateRun } from '../../../gen/incident/gates/engine-driver';
import { choiceActionId } from '../../../gen/incident/trees-v13/compile';
import { createInitialState } from '../../../sim/department';
import { buildLocation } from '../../../sim/location';
import { getScenario } from '../../../sim/scenario-registry';
import { apply, startCmd, stockKit } from '../../../sim/test-fixtures';
import type { GameState } from '../../../sim/types';
import { liveDecisions } from '../../../ui/screens/live-model';
import { parseLabUrl } from '../url';
import { KIT_ITEMS_FULL, readParams, resolveScenario, startLabRun } from './call';
import { explore } from './explore';
import { currentFrame, openSession, replayTokens } from './session';
import type { Session } from './session';
import { focusSquad, squadLine, squadOf, startCall } from './squads';

const HOSTAGE = resolveScenario(readParams(new URLSearchParams('type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1'))).id!;
const RESCUE = resolveScenario(readParams(new URLSearchParams('type=protected_rescue&tier=2'))).id!;

/** startGateRun exactly as it was before the lab's options (the content gates' start). */
function gateStartBefore(scenarioId: string, campaignSeed = 719): GameState {
  const s = getScenario(scenarioId)!;
  const before = createInitialState(NOW, campaignSeed);
  if (s.incident) before.incidents = [{ id: s.id, type: s.incident.type, familyId: s.incident.familyId, tier: s.incident.tier, arrivedAt: NOW, expiresAt: NOW + 3600000, seen: false }];
  const kit = stockKit(before, ['A']);
  const entry = buildLocation(s.locationFamilyId, s.locationSeed).location.entries[0];
  return apply(kit.state, startCmd(s.id, ['A'], { positions: { A: entry }, loadouts: kit.loadouts, units: kit.units })).state;
}

function open(query: string): Session {
  const opened = openSession(parseLabUrl(`?${query}`).url, null);
  if (!('frames' in opened)) throw new Error(opened.message);
  return opened;
}

describe('the reference squad', () => {
  it('is squad A of campaign 719: Singh, Aung, Vann, Moretti', () => {
    const state = startCall(HOSTAGE, 'day1', { seed: 719, certs: [] });
    const squad = state.squads.find(entry => entry.id === 'A')!;
    expect(squad.officerIds.map(id => state.officers[id].surname)).toEqual(['Singh', 'Aung', 'Vann', 'Moretti']);
    expect(focusSquad(state)).toBe('A');
    const line = squadLine(state, { kind: 'reference', seed: 719, certs: [] });
    expect(line.label).toBe('Squad A (719)');
    expect(line.officers.map(o => o.name)).toEqual(['Harjit Singh', 'May Thiri Aung', 'Dara Vann', 'Francesca Moretti']);
    expect(line.officers[0].certs).toEqual(['crisis_negotiation']);
    expect(line.grants).toEqual([]);
  });

  it('reads the squad from the URL, keeping known certs once each', () => {
    const url = parseLabUrl('?type=hostage_crisis&squad=4242&certs=vehicle_operations,not_a_cert,vehicle_operations').url;
    expect(squadOf(url)).toEqual({ seed: 4242, certs: ['vehicle_operations'] });
  });

  it('leaves the gate\'s own start unchanged without options, and with empty ones', () => {
    for (const id of [HOSTAGE, RESCUE]) {
      const before = gateStartBefore(id);
      expect(startGateRun(id)).toEqual(before);
      expect(startGateRun(id, 719, {})).toEqual(before);
      expect(startCall(id, 'day1', { seed: 719, certs: [] })).toEqual(before);
      expect(startGateRun(id, 4242)).toEqual(gateStartBefore(id, 4242));
    }
  });

  it('stocks every item for the full kit, and grants certs without touching the dice', () => {
    const full = startCall(HOSTAGE, 'full', { seed: 719, certs: [] });
    expect(full).toEqual(startLabRun(HOSTAGE, 'full'));
    const units = new Set(Object.values(full.units).map(unit => unit.itemId));
    for (const item of KIT_ITEMS_FULL) expect(units.has(item)).toBe(true);
    const granted = startCall(RESCUE, 'day1', { seed: 719, certs: ['vehicle_operations'] });
    const plain = startGateRun(RESCUE);
    const first = granted.squads.find(entry => entry.id === 'A')!.officerIds[0];
    expect(granted.officers[first].certs).toEqual(['crisis_negotiation', 'vehicle_operations']);
    expect(granted.activeRun!.rngState).toBe(plain.activeRun!.rngState);
    expect({ ...granted, officers: plain.officers }).toEqual(plain);
    expect(squadLine(granted, { kind: 'reference', seed: 719, certs: ['vehicle_operations'] }).label).toBe('Squad A (719) + vehicle operations (lab grant)');
    expect(squadLine(granted, { kind: 'game', at: NOW }).label).toBe('Your squad (from game)');
  });

  it('makes both rescue vehicle choices eligible with a vehicle operations grant, and only then', () => {
    const vehicle = choiceActionId('protected_rescue', 'wont_leave', 'vehicle');
    const tree = open('type=protected_rescue&tier=2').tree;
    const screen = tree.nodes.flatMap(node => node.choices.filter(choice => choice.id === 'screen_first').map(choice => choiceActionId(tree.type, node.id, choice.id)))[0];
    expect(screen).toBeDefined();
    for (const [query, eligible] of [['type=protected_rescue&tier=2', false], ['type=protected_rescue&tier=2&certs=vehicle_operations', true]] as const) {
      const s = open(query);
      const root = currentFrame(s).views.find(view => view.id === vehicle)!;
      expect(root.eligible).toBe(eligible);
      if (!eligible) expect(root.reason).toContain('qualified vehicle operator');
      const found = explore(s.frames[0].state, { offered: screen });
      expect(found.path).not.toBeNull();
      const there = currentFrame(replayTokens(s, found.path!));
      expect(liveDecisions(there.state, NOW, 'A').find(view => view.id === screen)!.eligible).toBe(eligible);
    }
  }, 30000);
});
