import { describe, expect, it } from 'vitest';
import { createQaCampaign } from '../qa-campaign';
import { getScenario } from '../../sim/scenario-registry';
import { scenarioActions, type ActionDefinition } from '../../sim/scenario-types';
import { preparationOptions } from './preparation-options';
import { testCallId } from '../../sim/test-fixtures';
import type { ItemUnit } from '../../sim/types';

const now = Date.UTC(2026, 9, 3, 22);
function fixture() {
  const state = createQaCampaign(now, 'equipped');
  const scenario = getScenario(testCallId('activeArmedV4'))!;
  return { state, now, actions: scenarioActions(scenario), chosen: ['A' as const], loadouts: { A: {} }, picks: {}, warnings: [] };
}
function capabilityChoice(): ActionDefinition {
  return { ...getScenario(testCallId('activeArmedV4'))!.stages.assess.actions[0], id: 'optional_device', title: 'Use the checked device option', requires: {},
    capabilities: { rules: ['less_lethal_device'], required: ['less_lethal_device'], responseContext: 'open', safetyFactIds: ['checked_safety'], subjectFactIds: ['checked_subject'] }, consumes: [],
  };
}

describe('v4 preparation options', () => {
  it('removes future action-state failures but preserves genuine non-action notices', () => {
    const args = fixture();
    const warnings = args.actions.map((action) => `${action.title}: No injured officer needs care yet`);
    warnings.push('Squad A has no radio kit: coordination with other squads will be slower');
    const before = structuredClone(args.state);
    const result = preparationOptions({ ...args, warnings });
    expect(result.warnings).toEqual(['Squad A has no radio kit: coordination with other squads will be slower']);
    expect(result.equipment.length).toBeGreaterThan(0);
    expect(result.equipment.length).toBeLessThan(args.actions.length);
    expect(JSON.stringify(result)).not.toContain('No injured officer');
    expect(args.state).toEqual(before);
  });

  it('finds a capability-only physical bundle even when the engine warning names future context', () => {
    const action = capabilityChoice();
    const result = preparationOptions({ ...fixture(), actions: [action], warnings: [`${action.title}: The subject context has not been checked`] });
    expect(result.warnings).toEqual([]);
    expect(result.equipment).toHaveLength(1);
    expect(result.equipment[0].fix.plan.issue).toBeNull();
    expect(result.equipment[0].fix.plan.explicit.conducted_energy_device).toHaveLength(1);
    expect(result.equipment[0].fix.plan.explicit.energy_cartridge).toHaveLength(1);
  });

  it('offers the same actual stock repair once across repeated and future-stage choices', () => {
    const first = capabilityChoice();
    const second = { ...first, id: 'revised_device', title: 'Use the revised device option', stage: 'resolve' as const, requires: { flags: [{ flag: 'after_setback', reason: 'Reassess the failed attempt first' }] } };
    const result = preparationOptions({ ...fixture(), actions: [first, second], warnings: [`${first.title}: Missing gear`, `${second.title}: Reassess the failed attempt first`] });
    expect(result.equipment).toHaveLength(1);
    expect(result.equipment[0].actionTitles).toEqual([first.title, second.title]);
  });

  it('does not suggest already carried gear to fix a knowledge, support or care-state failure', () => {
    const args = fixture();
    const action = capabilityChoice();
    const device = Object.values(args.state.units).find((unit) => unit.itemId === 'conducted_energy_device')!;
    const cartridge = Object.values(args.state.units).find((unit) => unit.itemId === 'energy_cartridge')!;
    const picks: { A: Record<string, ItemUnit[]> } = { A: { conducted_energy_device: [device], energy_cartridge: [cartridge] } };
    const result = preparationOptions({ ...args, actions: [action], picks, loadouts: { A: { conducted_energy_device: 1, energy_cartridge: 1 } }, warnings: [`${action.title}: The checked context is not ready`] });
    expect(result.equipment).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('keeps a real stock shortage discoverable without offering a partial equipment fix', () => {
    const args = fixture();
    for (const [id, unit] of Object.entries(args.state.units)) if (unit.itemId === 'energy_cartridge') delete args.state.units[id];
    const result = preparationOptions({ ...args, actions: [capabilityChoice()] });
    expect(result.equipment).toHaveLength(1);
    expect(result.equipment[0].fix.plan.issue).toContain('stock');
    expect(result.equipment[0].fix.plan.added).toBe(0);
  });

  it('offers nothing until a squad is chosen, and never repeats future-state warnings', () => {
    const args = fixture();
    expect(preparationOptions({ ...args, chosen: [], warnings: args.actions.map((action) => `${action.title}: Future state is not ready`) })).toEqual({ warnings: [], equipment: [] });
  });
});
