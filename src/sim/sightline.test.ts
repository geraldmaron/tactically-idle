// A sightline from across the street (spatial-factors.ts sightFromStreet) and what the scene's
// light and weather leave of a signal (environment.ts signalCarry).
import { describe, expect, it } from 'vitest';
import { buildLocation } from './location';
import { sightFromStreet, streetVantage } from './sightlines';
import { ENV_TUNING, signalCarry } from './environment';
import type { EnvironmentDefinition } from './scenario-types';
import type { BuiltLocation, PlacedObject } from './types';

// An authored house whose front door opens onto the front yard (content/locations).
const house = () => buildLocation('juniper_court_v1', 1);
const frontDoor = (built: BuiltLocation) => built.location.openings.find(opening => opening.id === 'd_front')!;
const ACROSS = { acrossFt: 45, alongFt: 0, fieldDeg: 25 };

describe('a sightline from across the street', () => {
  it('sees a front door straight across with nothing in the yard between', () => {
    const built = house();
    expect(sightFromStreet(built, 'front_yard', ACROSS, frontDoor(built).id)).toEqual({ clear: true, blockedBy: null });
  });

  it('loses the door past the window’s field of view', () => {
    const built = house();
    expect(sightFromStreet(built, 'front_yard', { ...ACROSS, alongFt: 200 }, frontDoor(built).id)).toEqual({ clear: false, blockedBy: 'the window frame' });
  });

  it('is blocked by a tree in the yard on the line', () => {
    const built = structuredClone(house());
    const door = frontDoor(built), from = streetVantage(built, 'front_yard', ACROSS).at;
    const mid = { x: ((door.from.x + door.to.x) / 2 + from.x) / 2, y: ((door.from.y + door.to.y) / 2 + from.y) / 2 };
    // Put it inside the lot, between the door and the street.
    const at = { x: (door.from.x + door.to.x) / 2 * 0.8 + mid.x * 0.2, y: (door.from.y + door.to.y) / 2 * 0.8 + mid.y * 0.2 };
    const tree: PlacedObject = { id: 'test_tree', type: 'tree', in: 'front_yard', x: at.x - 2, y: at.y - 2, w: 4, h: 4, rotation: 0, mechanical: true, tags: ['blocks_space', 'blocks_sight', 'cover'] };
    built.location.objects.push(tree);
    expect(sightFromStreet(built, 'front_yard', ACROSS, door.id)).toEqual({ clear: false, blockedBy: 'tree' });
  });

  it('faces the lot from the street side the team arrives on', () => {
    const built = house();
    const { front, at } = streetVantage(built, 'front_yard', ACROSS);
    const { w, h } = built.location.bounds;
    expect(front === 'N' ? at.y < 0 : front === 'S' ? at.y > h : front === 'W' ? at.x < 0 : at.x > w).toBe(true);
  });
});

describe('what the scene leaves of a signal', () => {
  const env = (patch: Partial<EnvironmentDefinition>): EnvironmentDefinition => ({ timeOfDay: 'day', weather: 'clear', power: 'on', clutter: 0, hazards: [], communication: 'normal',
    crowd: 0, keyholder: false, plansOnFile: false, alarm: 'none', cctv: false, ...patch });

  it('carries everything in daylight and clear weather', () => {
    for (const channel of ['visual', 'sound'] as const) for (const outdoors of [true, false]) expect(signalCarry(env({}), channel, outdoors)).toEqual({ factor: 1, label: null });
  });

  it('dims a sightline at dusk with the power out, inside and out', () => {
    const carry = signalCarry(env({ timeOfDay: 'dusk', power: 'off' }), 'visual', false);
    expect(carry.factor).toBeCloseTo(ENV_TUNING.light.dusk * ENV_TUNING.light.powerOff);
    expect(carry.label).toContain('power out');
  });

  it('lets the weather in only from outside', () => {
    expect(signalCarry(env({ weather: 'rain' }), 'sound', true).factor).toBe(ENV_TUNING.weatherSound.rain);
    expect(signalCarry(env({ weather: 'rain' }), 'sound', false).factor).toBe(1);
    expect(signalCarry(env({ weather: 'fog' }), 'visual', true).factor).toBe(ENV_TUNING.weatherVisual.fog);
    expect(signalCarry(env({ timeOfDay: 'night', weather: 'fog' }), 'thermal', true).factor).toBe(1);
  });
});
