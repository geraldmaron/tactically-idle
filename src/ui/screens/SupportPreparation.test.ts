import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../content/items';
import { briefing, builtForScenario } from '../../sim/operation-selectors';
import type { StartOperationCommand } from '../../sim/operation-selectors';
import { makeState, NOW, unitId } from '../../sim/test-fixtures';
import { handCarriedLoadout, supportChoices, SupportPreparation } from './SupportPreparation';

function command(scenarioId = 'ms_occupancy'): StartOperationCommand {
  return { type: 'startOperation', scenarioId, squadIds: ['A'], positions: { A: briefing(scenarioId).entries[0].id }, loadouts: {} };
}

function supportedState() {
  const state = makeState({ inventory: { support_van: 2, armored_rescue_vehicle: 1 } });
  state.officers.off_vale.certs.push('vehicle_operations');
  return state;
}

describe('operation support preparation', () => {
  it('keeps exact owned ready units selectable even with insufficient purchase funding', () => {
    const state = supportedState();
    state.department.funding = 0;
    state.units[unitId('support_van', 2)].condition = 65;
    const before = structuredClone(state);
    const choices = supportChoices(state, NOW, command(), ITEMS.support_van);
    expect(choices.map((choice) => choice.id)).toEqual([unitId('support_van'), unitId('support_van', 2)]);
    expect(choices.every((choice) => choice.issues.length === 0)).toBe(true);
    expect(choices.map((choice) => choice.condition)).toEqual([100, 65]);
    expect(state).toEqual(before);
  });

  it('shows unavailable owned units without substituting a different selected vehicle', () => {
    const state = supportedState();
    const selectedId = unitId('support_van');
    state.units[selectedId].status = 'service';
    const cmd = { ...command(), supportUnitIds: [selectedId] };
    const choices = supportChoices(state, NOW, cmd, ITEMS.support_van);
    expect(choices.find((choice) => choice.id === selectedId)?.issues.join(' ')).toMatch(/service/);
    expect(choices.find((choice) => choice.id === unitId('support_van', 2))?.issues).toEqual([]);
    const html = renderToStaticMarkup(createElement(SupportPreparation, { state, now: NOW, cmd, built: builtForScenario(cmd.scenarioId), onSelect: () => {} }));
    expect(html).toContain(`value="${selectedId}" disabled="" selected=""`);
    expect(html).toContain('Clear support');
    expect(cmd.supportUnitIds).toEqual([selectedId]);
  });

  it('requires the certified operator to belong to a selected squad', () => {
    const state = supportedState();
    const cmd = { ...command(), squadIds: ['B'] as const, positions: { B: command().positions.A } };
    const choices = supportChoices(state, NOW, { ...cmd, squadIds: [...cmd.squadIds] }, ITEMS.support_van);
    expect(choices.every((choice) => choice.issues.some((issue) => /deployed officer.*vehicle operations/.test(issue)))).toBe(true);
  });

  it('explains invalid interior staging through the engine check', () => {
    const state = supportedState();
    const cmd = { ...command(), positions: { A: 'living' } };
    expect(supportChoices(state, NOW, cmd, ITEMS.support_van)[0].issues).toEqual(['Support vehicle needs accessible exterior staging with the lead squad']);
  });

  it('offers only owned units: no vehicle without stock, and none for hand-carried items', () => {
    const state = makeState();
    state.officers.off_vale.certs.push('vehicle_operations');
    expect(supportChoices(state, NOW, command(), ITEMS.armored_rescue_vehicle)).toEqual([]);
    expect(supportChoices(supportedState(), NOW, command(), ITEMS.radio_kit)).toEqual([]);
  });

  it('explains stock, funding and qualification separately without a purchase control', () => {
    const state = makeState();
    state.department.funding = 0;
    const cmd = command();
    const html = renderToStaticMarkup(createElement(SupportPreparation, { state, now: NOW, cmd, built: builtForScenario(cmd.scenarioId), onSelect: () => {} }));
    expect(html).toContain('No support vehicle selected');
    expect(html).toContain('No owned stock');
    expect(html).toContain('Available funding: $0');
    expect(html).toContain('more funding');
    expect(html).toContain('officer trained in vehicle operations');
    expect(html).toContain('Exterior staging:');
    expect(html).not.toContain('<button');
  });

  it('filters support assets from backpack quantities without changing radios, manual zeroes or other choices', () => {
    const input = { radio_kit: 4, thermal_imager: 2, trauma_kit: 0, support_van: 1, command_van: 1 };
    expect(handCarriedLoadout(input)).toEqual({ radio_kit: 4, thermal_imager: 2, trauma_kit: 0 });
    expect(input.support_van).toBe(1);
  });
});
