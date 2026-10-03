import { describe, expect, it } from 'vitest';
import { createEquipmentDetailNavigation, EQUIPMENT_DETAIL_HISTORY_KEY } from './equipment-detail-navigation';

function fixture() {
  const entries: unknown[] = [{ previousScreen: 'gear' }];
  let position = 0;
  let backCalls = 0;
  let focused = 0;
  let active = true;
  let selected: string | null = null;
  const history = {
    get state() { return entries[position]; },
    pushState(data: unknown) { entries.splice(position + 1); entries.push(data); position++; },
    replaceState(data: unknown) { entries[position] = data; },
    back() { backCalls++; },
  };
  const navigation = createEquipmentDetailNavigation(history, { owner: 'store-1', isActive: () => active, select: (id) => { selected = id; }, returnFocus: () => { focused++; } });
  return {
    navigation, entries,
    back: () => { position--; navigation.onPop(); },
    forward: () => { position++; navigation.onPop(); },
    deactivate: () => { active = false; },
    selected: () => selected, focused: () => focused, backCalls: () => backCalls,
  };
}

describe('equipment detail navigation', () => {
  it('returns focus after browser Back and reopens the same details on Forward', () => {
    const state = fixture();
    state.navigation.open('camera_drone');
    expect(state.selected()).toBe('camera_drone');
    state.back();
    expect(state.selected()).toBe(null);
    expect(state.focused()).toBe(1);
    state.forward();
    expect(state.selected()).toBe('camera_drone');
    expect(state.focused()).toBe(1);
  });
  it('Close requests one Back even on repeated presses and blocks a racing reopen', () => {
    const state = fixture();
    expect(state.navigation.open('camera_drone')).toBe(true);
    expect(state.navigation.open('camera_drone')).toBe(false);
    state.navigation.close(); state.navigation.close();
    expect(state.backCalls()).toBe(1);
    expect(state.navigation.open('thermal_imager')).toBe(false);
    state.back();
    expect(state.focused()).toBe(1);
    expect(state.navigation.open('thermal_imager')).toBe(true);
    expect(state.entries).toHaveLength(2);
  });
  it('training/development navigation does not focus the now-hidden equipment trigger', () => {
    const state = fixture();
    state.navigation.open('camera_drone');
    state.navigation.close(false);
    state.deactivate();
    state.back();
    expect(state.selected()).toBe(null);
    expect(state.focused()).toBe(0);
  });
  it('unmount cleans up only its own detail marker and preserves unrelated history state', () => {
    const state = fixture();
    state.navigation.open('camera_drone');
    expect(state.entries[1]).toMatchObject({ previousScreen: 'gear', [EQUIPMENT_DETAIL_HISTORY_KEY]: { owner: 'store-1', itemId: 'camera_drone' } });
    state.navigation.dispose();
    expect(state.entries[1]).toEqual({ previousScreen: 'gear' });
    expect(state.backCalls()).toBe(0);
  });
});
