import { describe, expect, it, vi } from 'vitest';
import { createSaveEnvironment, RESPONSIVE_PREVIEW_PARAM } from './save-environment';
import { createQaCampaign, initializeQaCampaign, QA_CAMPAIGN_PARAM, qaCampaignPreset } from './qa-campaign';
import { CampaignSlots } from '../sim/campaign-slots';
import { deserialize, serialize } from '../sim/save';
import { dispatch } from '../sim/game';
import { actionViews, briefing } from '../sim/operation-selectors';

const now = Date.UTC(2026, 9, 3, 22);
const search = `?${RESPONSIVE_PREVIEW_PARAM}=1&${QA_CAMPAIGN_PARAM}=equipped`;

describe('bounded equipped QA campaign', () => {
  it('cannot touch a save library from a root query, a normal frame, or an unknown preset', () => {
    const campaigns = { importGame: vi.fn(), load: vi.fn() };
    for (const context of [
      { temporary: false, framed: false, search },
      { temporary: false, framed: true, search },
      { temporary: true, framed: false, search },
      { temporary: true, framed: true, search: '?ti-qa-campaign=unknown' },
    ]) {
      expect(qaCampaignPreset(context)).toBeNull();
      expect(initializeQaCampaign(campaigns, context, now)).toBeNull();
    }
    expect(campaigns.importGame).not.toHaveBeenCalled();
    expect(campaigns.load).not.toHaveBeenCalled();
  });

  it('only initializes the isolated memory slots, never consulting real saves or locks', () => {
    const getLocalStorage = vi.fn(() => { throw new Error('Real storage was touched'); });
    const getLocks = vi.fn(() => { throw new Error('Real locks were touched'); });
    const environment = createSaveEnvironment({ search, framed: true, getLocalStorage, getLocks });
    const campaigns = new CampaignSlots(environment.storage(), now, () => 99);
    const untouchedSlotOne = campaigns.exportSlot(1);
    expect(initializeQaCampaign(campaigns, { temporary: environment.temporary, framed: true, search }, now)?.ok).toBe(true);
    expect(campaigns.getSnapshot().state.department.name).toBe('TEST · Equipped team');
    expect(campaigns.getSnapshot().activeSlotId).toBe(2);
    expect(campaigns.exportSlot(1)).toBe(untouchedSlotOne);
    expect(getLocalStorage).not.toHaveBeenCalled();
    expect(getLocks).not.toHaveBeenCalled();
    expect(campaigns.getSnapshot().issue).toBeNull();
  });

  it('creates a deterministic, valid equipped department while keeping ordinary ratings and no active run', () => {
    const fresh = createQaCampaign(now, 'fresh');
    const equipped = createQaCampaign(now, 'equipped');
    expect(createQaCampaign(now, 'equipped')).toEqual(equipped);
    expect(deserialize(serialize(equipped, now))).not.toBeNull();
    expect(equipped.activeRun).toBeNull();
    expect(equipped.reservations).toEqual([]);
    expect(equipped.officers).not.toEqual(fresh.officers);
    for (const officer of Object.values(equipped.officers)) {
      expect(officer.ratings).toEqual(fresh.officers[officer.id].ratings);
      expect(officer.certs).toEqual(expect.arrayContaining(['vehicle_operations', 'advanced_less_lethal', 'controlled_access', 'precision_support', 'advanced_first_aid']));
    }
    for (const itemId of ['armored_rescue_vehicle', 'impact_launcher', 'impact_supply', 'trauma_kit']) expect(Object.values(equipped.units).some((unit) => unit.itemId === itemId && unit.condition === 100)).toBe(true);
  });

  it('uses real owned units, reservations and decisions for a field deployment', () => {
    const equipped = createQaCampaign(now, 'equipped');
    const vehicle = Object.values(equipped.units).find((unit) => unit.itemId === 'armored_rescue_vehicle')!;
    const started = dispatch(equipped, { type: 'startOperation', scenarioId: 'ms_occupancy', squadIds: ['A'], positions: { A: briefing('ms_occupancy').entries[0].id }, loadouts: { A: { radio_kit: 1, throw_phone: 1, impact_launcher: 1, impact_supply: 2, trauma_kit: 2 } }, supportUnitIds: [vehicle.id], practice: false }, { now });
    expect(started.result.ok).toBe(true);
    expect(started.state.activeRun!.supportUnitIds).toContain(vehicle.id);
    expect(started.state.reservations.length).toBeGreaterThan(0);
    const action = actionViews(started.state, now, 'A').find((view) => view.eligible)!;
    const decided = dispatch(started.state, { type: 'decide', actionId: action.id, actingSquadIds: action.actingSquadIds, supportSquadIds: action.supportSquadIds }, { now });
    expect(decided.result.ok).toBe(true);
    expect(decided.state.activeRun!.history).toHaveLength(1);
    expect(equipped.activeRun).toBeNull();
  });
});
