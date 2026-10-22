// Basic kit (owner decision 2026-10-21): part of every officer, never stock, never worn, no bonus.
import { describe, expect, it } from 'vitest';
import { ITEMS } from '../content/items';
import { DEV_NODES } from '../content/dev-tree';
import { issueKit, ROLE_TOOL } from '../content/issue-kit';
import { BASIC_KIT, basicUnits, isBasicKit, isBasicUnit, withoutBasicKit } from './basic-kit';
import { createInitialState } from './department';
import { storeOptions } from './department-selectors';
import { itemCheck } from './develop';
import { projectedCondition } from './equipment';
import { departmentUpkeep } from './equipment-manager-policy';
import { capabilityRuleEffect, type PublicEquipmentContext } from './equipment-requirements';
import { squadUnits } from './inventory';
import type { ActionDefinition, ScenarioDefinition } from './scenario-types';
import type { BuiltLocation, Role } from './types';

const NOW = Date.UTC(2026, 9, 21);

describe('basic kit', () => {
  it('is carried by every squad as one unit of each item, whatever is reserved', () => {
    const state = createInitialState(NOW, 3);
    for (const sid of ['A', 'B', 'C', 'D'] as const) {
      const carried = squadUnits(state, 'no_run', sid).map((unit) => unit.itemId);
      expect(carried.filter(isBasicKit).sort()).toEqual([...BASIC_KIT].sort());
    }
    expect(basicUnits('A').every((unit) => isBasicUnit(unit.id) && !state.units[unit.id])).toBe(true);
  });

  it('is never stock: not granted, issued, listed or for sale', () => {
    const state = createInitialState(NOW, 3);
    state.department.funding = 1_000_000;
    expect(Object.values(state.units).some((unit) => isBasicKit(unit.itemId))).toBe(false);
    expect(storeOptions(state).some((option) => isBasicKit(option.item.id))).toBe(false);
    for (const itemId of BASIC_KIT) expect(itemCheck(state, ITEMS[itemId], 1)).toEqual({ ok: false, reason: 'Every officer already carries this' });
    for (const role of Object.keys(ROLE_TOOL) as Role[]) expect(issueKit({ role, certs: [] }).some(isBasicKit)).toBe(false);
  });

  it('needs no certification or unlock, and the response program unlocks only the shotgun', () => {
    for (const itemId of BASIC_KIT) {
      expect(ITEMS[itemId].requiresCerts ?? []).toEqual([]);
      expect(ITEMS[itemId].requiresNode).toBeUndefined();
    }
    const unlocked = DEV_NODES.field_response_program.effects.flatMap((effect) => effect.kind === 'unlockItem' ? [effect.itemId] : []);
    expect(unlocked).toEqual(['response_shotgun']);
  });

  it('never wears', () => {
    const state = createInitialState(NOW, 3);
    const later = NOW + 400 * 24 * 3600_000;
    for (const unit of basicUnits('A')) expect(projectedCondition(state, unit, later, departmentUpkeep(state))).toBe(100);
  });

  it('meets a protective response requirement with no bonus; the shotgun carries the bonus', () => {
    const input = (responseContext: 'open' | 'constrained'): PublicEquipmentContext => ({
      action: { targetId: 'shop', check: { kind: 'execution' }, capabilities: { rules: ['authorized_response'], required: ['authorized_response'], responseContext } } as unknown as ActionDefinition,
      scenario: { environment: null } as unknown as ScenarioDefinition,
      built: { location: { openings: [] } } as unknown as BuiltLocation,
      squadCount: 1, supportCount: 0,
    });
    for (const itemId of BASIC_KIT.filter((id) => ITEMS[id].capabilities?.includes('authorized_response'))) {
      expect(capabilityRuleEffect(ITEMS[itemId], 'authorized_response', input('constrained'))).toMatchObject({ value: 0, minutes: 0, reason: null });
    }
    expect(capabilityRuleEffect(ITEMS.response_shotgun, 'authorized_response', input('constrained'))).toMatchObject({ value: 6, minutes: 1, reason: null });
    expect(capabilityRuleEffect(ITEMS.response_shotgun, 'authorized_response', input('open'))).toMatchObject({ value: 3, minutes: 1, reason: null });
  });

  it('is taken out of any deploy command that packs it', () => {
    const state = createInitialState(NOW, 3);
    const hailer = Object.values(state.units).find((unit) => unit.itemId === 'loud_hailer')!;
    const out = withoutBasicKit(state, { A: { radio_kit: 4, compact_carbine: 1, loud_hailer: 1 } }, { A: [hailer.id] });
    expect(out.loadouts).toEqual({ A: { loud_hailer: 1 } });
    expect(out.units).toEqual({ A: [hailer.id] });
  });
});
