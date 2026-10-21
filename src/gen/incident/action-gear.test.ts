import { describe, expect, it } from 'vitest';
import { CALL_TREES } from '../../content/call-trees';
import { getScenario } from '../../sim/scenario-registry';
import { actionViews } from '../../sim/operation-selectors';
import { NOW } from '../../sim/test-fixtures';
import { startGateRun } from './gates/engine-driver';
import { drawCalls } from './trees-v13/balance';
import { fixtureCalls } from './trees-v13/house-call-fixture';
import { ARMED_TEMPLATE } from './trees-v13/armed-fixture';
import { derivedGear, GEAR_BY_ACTION, gearFor, WATCH_CAPABILITY } from './action-gear';

describe('gear by what a choice physically does', () => {
  it('a phone call, a text or a wait asks nothing of carried gear', () => {
    expect(gearFor({})).toEqual({});
    expect(gearFor({ team: {} })).toEqual({});
  });

  it('a team that goes into the building, or in to bring someone out, leads with a shield', () => {
    for (const to of ['scene', 'escort', { room: 'subject' }] as const)
      expect(gearFor({ team: { to } }).equipment, JSON.stringify(to)).toEqual([GEAR_BY_ACTION.move]);
  });

  it('a voice sent through the walls uses the hailer, range permitting', () => {
    expect(gearFor({ team: { signal: { channel: 'voice', to: 'subject' } } })).toEqual({ equipment: [GEAR_BY_ACTION.voice] });
    expect(GEAR_BY_ACTION.voice.range).toBe('target');
  });

  it('a watch from outside uses exterior observation aids, a voice from a vantage does not', () => {
    expect(gearFor({ team: { to: { vantage: 'scene' } } })).toEqual({ capabilities: { rules: [WATCH_CAPABILITY] } });
    expect(gearFor({ team: { signal: { channel: 'visual', to: 'subject' } } })).toEqual({ capabilities: { rules: [WATCH_CAPABILITY] } });
    expect(gearFor({ team: { to: { vantage: 'scene' }, signal: { channel: 'voice', to: 'subject' } } })).toEqual({ equipment: [GEAR_BY_ACTION.voice] });
  });

  it('what a choice authors wins over what its act brings, by tag or group', () => {
    const authored = { tag: 'shield', value: 6, label: 'Shield up front' };
    expect(gearFor({ team: { to: 'scene' }, equipment: [authored] }).equipment).toEqual([authored]);
    const line = { tag: 'throw_phone', value: 8, group: 'voice', label: 'A line into the room' };
    expect(gearFor({ team: { signal: { channel: 'voice', to: 'subject' } }, equipment: [line] }).equipment).toEqual([line]);
    const capabilities = { rules: ['opening_inspection' as const], openingId: 'o1' };
    expect(gearFor({ team: { to: { vantage: 'scene' } }, capabilities }).capabilities).toEqual({ rules: ['opening_inspection', WATCH_CAPABILITY], openingId: 'o1' });
  });

  it('never shares an object with the authored choice or the table', () => {
    const authored = { tag: 'shield', value: 6, label: 'Shield up front' };
    const gear = gearFor({ team: { to: 'scene', signal: { channel: 'voice', to: 'subject' } }, equipment: [authored] });
    expect(gear.equipment![0]).not.toBe(authored);
    expect(gear.equipment![1]).not.toBe(GEAR_BY_ACTION.voice);
  });
});

describe('compiled calls carry the gear their choices bring', () => {
  it('every compiled action holds its choice’s authored and derived gear', () => {
    let checked = 0;
    for (const tree of Object.values(CALL_TREES)) {
      const [{ scenarioId }] = drawCalls(tree!, 3, 1);
      const actions = new Map(Object.values(getScenario(scenarioId)!.stages).flatMap(stage => stage.actions).map(action => [action.id, action]));
      for (const node of tree!.nodes) for (const choice of node.choices) {
        const action = actions.get(`t13_${tree!.type}_${node.id}_${choice.id}`);
        if (!action) continue;
        checked++;
        const tags = (action.equipment ?? []).map(effect => effect.tag);
        for (const effect of [...choice.equipment ?? [], ...derivedGear(choice).equipment]) expect(tags, action.id).toContain(effect.tag);
        if (derivedGear(choice).watch) expect(action.capabilities?.rules, action.id).toContain(WATCH_CAPABILITY);
      }
    }
    // Going Live has 31 choices, nearly all compiled into a call drawn at tier 3.
    expect(checked).toBeGreaterThan(20);
  });
});

describe('the hailer only carries as far as its range', () => {
  // A voice sent through the walls derives a hailer, which reaches the subject only within the item's
  // range. Going Live's voice choices sit past its first stage, so the frozen armed fixture's opening
  // announcement carries the case.
  const [{ id: scenarioId }] = fixtureCalls(ARMED_TEMPLATE, 1, 1, 'hailer', 3);
  const announce = (far: boolean) => {
    const state = startGateRun(scenarioId);
    if (far) for (const task of state.activeRun!.squadTasks) { const at = task.at ?? { x: 0, y: 0 }; task.stagingId = null; task.at = { x: at.x + 1000, y: at.y + 1000 }; }
    return actionViews(state, NOW, 'A').find(view => view.id.endsWith('_shots_announce'))!;
  };

  it('is open from where the squad deploys', () => {
    expect(announce(false).eligible).toBe(true);
  });

  it('closes, with the reason, when the squad stands beyond it', () => {
    // The announcement requires the hailer, so out of range it closes instead of only getting harder.
    const far = announce(true);
    expect(far.eligible).toBe(false);
    expect(far.reason).toBeTruthy();
  });
});
