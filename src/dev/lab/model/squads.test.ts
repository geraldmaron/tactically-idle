// The lab's squads: the reference squad (day-one squad A of campaign 719), lab cert grants to its
// first officer, the full kit, and the gate's own start left exactly as it was.
import { describe, expect, it } from 'vitest';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import { NOW, startGateRun } from '../../../gen/incident/gates/engine-driver';
import { createInitialState } from '../../../sim/department';
import { buildLocation } from '../../../sim/location';
import { getScenario } from '../../../sim/scenario-registry';
import { apply, startCmd, stockKit } from '../../../sim/test-fixtures';
import type { GameState } from '../../../sim/types';
import { parseLabUrl } from '../url';
import { KIT_ITEMS_FULL, readParams, resolveScenario, startLabRun } from './call';
import { currentFrame } from './session';
import { certWords, focusSquad, squadLine, squadOf, startCall } from './squads';
import { certSubjects } from './test-subjects';
import { CERT_FIXTURE } from '../../../gen/incident/gates/fixture-call';

const HOSTAGE = resolveScenario(readParams(new URLSearchParams('type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1'))).id!;

/** startGateRun exactly as it was before the lab's options (the content gates' start). */
function gateStartBefore(scenarioId: string, campaignSeed = 719): GameState {
  const s = getScenario(scenarioId)!;
  const before = createInitialState(NOW, campaignSeed);
  if (s.incident) before.incidents = [{ id: s.id, type: s.incident.type, familyId: s.incident.familyId, tier: s.incident.tier, arrivedAt: NOW, expiresAt: NOW + 3600000, seen: false }];
  const kit = stockKit(before, ['A']);
  const entry = buildLocation(s.locationFamilyId, s.locationSeed).location.entries[0];
  return apply(kit.state, startCmd(s.id, ['A'], { positions: { A: entry }, loadouts: kit.loadouts, units: kit.units })).state;
}


describe('the reference squad', () => {
  it('is squad A of campaign 719: Singh, Aung, Vann, Moretti', () => {
    const state = startCall(HOSTAGE, 'day1', { seed: 719, certs: [] });
    const squad = state.squads.find(entry => entry.id === 'A')!;
    expect(squad.officerIds.map(id => state.officers[id].surname)).toEqual(['Singh', 'Aung', 'Vann', 'Moretti']);
    expect(focusSquad(state)).toBe('A');
    const line = squadLine(state, { kind: 'reference', seed: 719, certs: [] });
    expect(line.label).toBe('Alpha (719)');
    expect(line.officers.map(o => o.name)).toEqual(['Harjit Singh', 'May Thiri Aung', 'Dara Vann', 'Francesca Moretti']);
    expect(line.officers[0].certs).toEqual(['crisis_negotiation']);
    expect(line.grants).toEqual([]);
  });

  it('reads the squad from the URL, keeping known certs once each', () => {
    const url = parseLabUrl('?type=hostage_crisis&squad=4242&certs=vehicle_operations,not_a_cert,vehicle_operations').url;
    expect(squadOf(url)).toEqual({ seed: 4242, certs: ['vehicle_operations'] });
  });

  it('leaves the gate\'s own start unchanged without options, and with empty ones', () => {
    // Every shipped call's default draw, so no one call's content is pinned.
    for (const id of Object.keys(INCIDENT_TEMPLATES).map(type => resolveScenario(readParams(new URLSearchParams(`type=${type}&tier=2`))).id!)) {
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
    // A cert the reference squad lacks (the certification fixture's), granted on the hostage call.
    const cert = CERT_FIXTURE.cert;
    const granted = startCall(HOSTAGE, 'day1', { seed: 719, certs: [cert] });
    const plain = startGateRun(HOSTAGE);
    const first = granted.squads.find(entry => entry.id === 'A')!.officerIds[0];
    expect(plain.officers[first].certs).not.toContain(cert);
    expect(granted.officers[first].certs).toEqual([...plain.officers[first].certs, cert]);
    expect(granted.activeRun!.rngState).toBe(plain.activeRun!.rngState);
    expect({ ...granted, officers: plain.officers }).toEqual(plain);
    expect(squadLine(granted, { kind: 'reference', seed: 719, certs: [cert] }).label).toBe(`Alpha (719) + ${certWords(cert)} (lab grant)`);
    expect(squadLine(granted, { kind: 'game', at: NOW }).label).toBe('Alpha (from game)');
  });

  // A choice that needs a cert squad A lacks, on a shipped call that has one and on the fixture.
  for (const subject of certSubjects()) it(`${subject.source}: makes a cert-gated choice eligible with the lab grant, and only then`, () => {
    subject.withSessions((bare, granted) => {
      const before = currentFrame(bare).views.find(view => view.id === subject.actionId)!;
      expect(before.eligible).toBe(false);
      expect(before.reason).toMatch(/qualified|certif/i);
      expect(currentFrame(granted).views.find(view => view.id === subject.actionId)!.eligible).toBe(true);
    });
  }, 30000);
});
