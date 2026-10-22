import { describe, expect, it } from 'vitest';
import { autoLoadout } from './auto-equip';
import { CampaignSlots, SLOTS_KEY } from './campaign-slots';
import { briefing } from './operation-selectors';
import { SCENARIO_ORDER } from '../content/scenarios';

const NOW = Date.UTC(2026, 9, 2);

describe('auto-equip local campaign integration', () => {
  it('reserves exactly the previewed units, reloads them, and leaves other slots untouched', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    let seed = 41;
    const saves = new CampaignSlots(storage, NOW, () => seed++);
    expect(saves.newGame(2, 'Auto-equip QA', NOW).ok).toBe(true);
    const slotOneBefore = JSON.parse(storage.getItem(SLOTS_KEY)!).slots[0];
    const state = saves.getSnapshot().state;
    const unchanged = structuredClone(state);
    const scenarioId = SCENARIO_ORDER[0];
    const plan = autoLoadout(state, scenarioId, ['A'], NOW);
    expect(plan.added).toBeGreaterThan(0);
    expect(state).toEqual(unchanged);
    const positions = { A: briefing(scenarioId).entries[0].id, B: briefing(scenarioId).entries[0].id };
    expect(saves.send({ type: 'startOperation', scenarioId, squadIds: ['A'], positions, loadouts: plan.loadouts, units: plan.units }, NOW).ok).toBe(true);
    const reserved = saves.getSnapshot().state.reservations;
    expect(reserved.map((r) => r.unitId).sort()).toEqual(Object.values(plan.units).flat().sort());
    expect(new Set(reserved.map((r) => r.unitId)).size).toBe(reserved.length);
    expect(saves.getSnapshot().state.department.funding).toBe(unchanged.department.funding);
    const reloaded = new CampaignSlots(storage, NOW, () => 999);
    expect(reloaded.getSnapshot().activeSlotId).toBe(2);
    expect(reloaded.getSnapshot().state.reservations).toEqual(reserved);
    // The stored call comes back with its stall paused at the save (sim/save.ts freezeStall).
    expect(reloaded.getSnapshot().state.activeRun).toEqual({ ...saves.getSnapshot().state.activeRun, decisionPausedAt: expect.any(Number) });
    expect(JSON.parse(storage.getItem(SLOTS_KEY)!).slots[0]).toEqual(slotOneBefore);
    expect(reloaded.send({ type: 'cancelOperation' }, NOW).ok).toBe(true);
    expect(reloaded.getSnapshot().state.reservations).toEqual([]);
    for (const id of Object.values(plan.units).flat()) expect(reloaded.getSnapshot().state.units[id].status).toBe('ready');
    expect(JSON.parse(storage.getItem(SLOTS_KEY)!).slots[0]).toEqual(slotOneBefore);
  });

  it('deploys both squads on day one with nothing packed, since basic kit is part of every officer (starter-kit)', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const saves = new CampaignSlots(storage, NOW, () => 72);
    expect(saves.newGame(2, 'Standard kit QA', NOW).ok).toBe(true);
    const slotOne = JSON.parse(storage.getItem(SLOTS_KEY)!).slots[0];
    const before = saves.getSnapshot().state;
    expect(Object.values(before.units).filter((unit) => unit.itemId === 'radio_kit')).toHaveLength(0);
    const scenarioId = SCENARIO_ORDER[0];
    const positions = { A: briefing(scenarioId).entries[0].id, B: briefing(scenarioId).entries[0].id };
    const command = { type: 'startOperation' as const, scenarioId, squadIds: ['A' as const, 'B' as const], positions, loadouts: {} };
    expect(saves.send(command, NOW).ok).toBe(true);
    const deployed = saves.getSnapshot().state;
    expect(deployed.department.funding).toBe(before.department.funding);
    expect(deployed.activeRun).not.toBeNull();
    expect(deployed.reservations).toEqual([]);
    const restored = new CampaignSlots(storage, NOW, () => 99);
    expect(restored.getSnapshot().state.activeRun).toEqual({ ...deployed.activeRun, decisionPausedAt: expect.any(Number) });
    expect(restored.send({ type: 'cancelOperation' }, NOW).ok).toBe(true);
    expect(restored.getSnapshot().state.activeRun).toBeNull();
    expect(JSON.parse(storage.getItem(SLOTS_KEY)!).slots[0]).toEqual(slotOne);
  });


});
