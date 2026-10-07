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
    expect(reloaded.getSnapshot().state.activeRun).toEqual(saves.getSnapshot().state.activeRun);
    expect(JSON.parse(storage.getItem(SLOTS_KEY)!).slots[0]).toEqual(slotOneBefore);
    expect(reloaded.send({ type: 'cancelOperation' }, NOW).ok).toBe(true);
    expect(reloaded.getSnapshot().state.reservations).toEqual([]);
    for (const id of Object.values(plan.units).flat()) expect(reloaded.getSnapshot().state.units[id].status).toBe('ready');
    expect(JSON.parse(storage.getItem(SLOTS_KEY)!).slots[0]).toEqual(slotOneBefore);
  });

  it('keeps six starting radios, blocks two squads, and deploys after an explicit two-radio purchase', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const saves = new CampaignSlots(storage, NOW, () => 72);
    expect(saves.newGame(2, 'Standard kit QA', NOW).ok).toBe(true);
    const slotOne = JSON.parse(storage.getItem(SLOTS_KEY)!).slots[0];
    const before = saves.getSnapshot().state;
    expect(Object.values(before.units).filter((unit) => unit.itemId === 'radio_kit')).toHaveLength(6);
    const scenarioId = SCENARIO_ORDER[0];
    const positions = { A: briefing(scenarioId).entries[0].id, B: briefing(scenarioId).entries[0].id };
    const command = { type: 'startOperation' as const, scenarioId, squadIds: ['A' as const, 'B' as const], positions, loadouts: {} };
    expect(saves.send(command, NOW)).toMatchObject({ ok: false, reason: expect.stringContaining('2 short') });
    expect(saves.getSnapshot().state.department.funding).toBe(before.department.funding);
    expect(saves.send({ type: 'buyItem', itemId: 'radio_kit', qty: 2 }, NOW).ok).toBe(true);
    expect(saves.getSnapshot().state.department.funding).toBe(before.department.funding - 800);
    expect(saves.send(command, NOW).ok).toBe(true);
    const deployed = saves.getSnapshot().state;
    expect(deployed.reservations).toHaveLength(8);
    expect(new Set(deployed.reservations.map((reservation) => reservation.unitId)).size).toBe(8);
    const restored = new CampaignSlots(storage, NOW, () => 99);
    expect(restored.getSnapshot().state.reservations).toEqual(deployed.reservations);
    expect(restored.send({ type: 'cancelOperation' }, NOW).ok).toBe(true);
    expect(restored.getSnapshot().state.reservations).toEqual([]);
    expect(JSON.parse(storage.getItem(SLOTS_KEY)!).slots[0]).toEqual(slotOne);
  });

});
