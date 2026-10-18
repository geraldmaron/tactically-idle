import { describe, expect, it } from 'vitest';
import type { Vec } from '../../sim/types';
import { MIN_TARGET_PX, resolveTap, shortSidePx, type HitSpace } from './hit-resolve';

const rect = (x: number, y: number, w: number, h: number): Vec[] => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];

// A 4 ft corridor between a large dining room and a small office, with the street outside.
const spaces: HitSpace[] = [
  { id: 'street', poly: rect(-10, 30, 60, 10), zone: true },
  { id: 'dining', poly: rect(0, 10, 30, 20), zone: false },
  { id: 'corridor', poly: rect(30, 0, 4, 30), zone: false },
  { id: 'office', poly: rect(34, 0, 8, 7), zone: false },
  { id: 'far', poly: rect(34, 20, 10, 10), zone: false },
];
const PX = 4.7; // the 320px live map's scale on a bar or restaurant, px per foot

describe('resolveTap', () => {
  it('measures the drawn short side', () => {
    expect(shortSidePx(rect(0, 0, 4, 30), PX)).toBeCloseTo(18.8);
  });

  it('never gives a tap inside a large room to its small neighbour', () => {
    expect(shortSidePx(spaces[1].poly, PX)).toBeGreaterThanOrEqual(MIN_TARGET_PX);
    for (const x of [29.9, 29.5, 28, 25]) expect(resolveTap('dining', { x, y: 15 }, spaces, PX)).toEqual({ kind: 'select', id: 'dining' });
  });

  it('selects an exterior zone directly', () => {
    expect(resolveTap('street', { x: 32, y: 30.2 }, spaces, PX)).toEqual({ kind: 'select', id: 'street' });
  });

  it('offers the small room and the rooms within half a target of the tap', () => {
    // The radius is 22px, about 4.7 ft. At (33, 6) the office is 1 ft away and the dining room 5 ft;
    // at (31, 12) the dining room is 1 ft away and the office 5.8 ft.
    expect(resolveTap('corridor', { x: 33, y: 6 }, spaces, PX)).toEqual({ kind: 'choose', ids: ['corridor', 'office'] });
    expect(resolveTap('corridor', { x: 31, y: 12 }, spaces, PX)).toEqual({ kind: 'choose', ids: ['corridor', 'dining'] });
  });

  it('selects a small room when nothing else is near enough', () => {
    expect(resolveTap('office', { x: 40, y: 2 }, spaces.filter((s) => s.id !== 'corridor'), PX)).toEqual({ kind: 'select', id: 'office' });
  });

  it('stops offering choices once zoom makes the room big enough', () => {
    expect(resolveTap('corridor', { x: 33, y: 6 }, spaces, 12)).toEqual({ kind: 'select', id: 'corridor' });
  });
});
