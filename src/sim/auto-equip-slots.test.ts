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
    const plan = autoLoadout(state, scenarioId, ['A', 'B'], NOW);
    expect(plan.added).toBeGreaterThan(0);
    expect(state).toEqual(unchanged);
    const positions = { A: briefing(scenarioId).entries[0].id, B: briefing(scenarioId).entries[0].id };
    expect(saves.send({ type: 'startOperation', scenarioId, squadIds: ['A', 'B'], positions, loadouts: plan.loadouts, units: plan.units, practice: false }, NOW).ok).toBe(true);
    const reserved = saves.getSnapshot().state.reservations;
    expect(reserved.map((r) => r.unitId).sort()).toEqual(Object.values(plan.units).flat().sort());
    expect(new Set(reserved.map((r) => r.unitId)).size).toBe(reserved.length);
    expect(saves.getSnapshot().state.department.funding).toBe(unchanged.department.funding);
    const reloaded = new CampaignSlots(storage, NOW, () => 999);
    expect(reloaded.getSnapshot().activeSlotId).toBe(2);
    expect(reloaded.getSnapshot().state.reservations).toEqual(reserved);
    expect(reloaded.getSnapshot().state.activeRun).toEqual(saves.getSnapshot().state.activeRun);
    expect(JSON.parse(storage.getItem(SLOTS_KEY)!).slots[0]).toEqual(slotOneBefore);
    expect(reloaded.send({ type: 'cancelOperation' }, NOW).ok).toBe(true);
    expect(reloaded.getSnapshot().state.reservations).toEqual([]);
    for (const id of Object.values(plan.units).flat()) expect(reloaded.getSnapshot().state.units[id].status).toBe('ready');
    expect(JSON.parse(storage.getItem(SLOTS_KEY)!).slots[0]).toEqual(slotOneBefore);
  });
});
