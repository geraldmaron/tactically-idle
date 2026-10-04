import { describe, expect, it } from 'vitest';
import { TWO_FLOOR_FIXTURE } from '../../../content/locations/two-floor-fixture';
import { buildLocation, deriveLocation } from '../../../sim/location';
import { findStoryRoute } from '../../../sim/story-bindings';
import type { BuiltLocation } from '../../../sim/types';
import { generateIncident } from '../index';
import { storyDoorRoute, withArmedStory } from './armed';
import { withRescueStory } from './rescue';

function variant(family: string, edit: (built: BuiltLocation) => void): BuiltLocation {
  const built = structuredClone(buildLocation(family, 7));
  edit(built); built.derived = deriveLocation(built.location); return built;
}
function armedRouteFact(built: BuiltLocation) {
  const input = generateIncident({ type: 'active_armed_incident', familyId: 'market_row', buildingSeed: 7, seed: 0, tier: 2, contentVersion: 4 });
  input.facts[0].spaceId = built.location.objects.find(object => object.type === 'register')!.in;
  return withArmedStory(input, built).facts.find(fact => fact.id === 'v5_noise_f_route')!;
}

describe('authored access facts use shared live story-route rules', () => {
  it('uses an actual alternative side doorway and exterior path, then reports no route when every exit is blocked', () => {
    const alternate = variant('market_row', built => {
      for (const opening of built.location.openings) {
        if (opening.id === 'd_front' || opening.id === 'd_delivery') opening.state = 'blocked';
        if (opening.id === 'd_side') opening.state = 'open';
      }
    });
    const from = alternate.location.objects.find(object => object.type === 'register')!.in;
    const to = alternate.location.entries[0];
    expect(storyDoorRoute(alternate, from, to)).toEqual(['d_side', 'p_front_e']);
    expect(storyDoorRoute(alternate, from, to)).toEqual(findStoryRoute(alternate, from, to, 'walking'));
    expect(armedRouteFact(alternate).truth).toBe(true);
    const blocked = structuredClone(alternate);
    for (const opening of blocked.location.openings) if (opening.a === from || opening.b === from) opening.state = 'blocked';
    blocked.derived = deriveLocation(blocked.location);
    expect(storyDoorRoute(blocked, from, to)).toBeNull();
    expect(findStoryRoute(blocked, from, to, 'walking')).toBeNull();
    expect(armedRouteFact(blocked).truth).toBe(false);
  });

  it('keeps locked routes available as engine work, excludes windows, and ignores authored opening order', () => {
    const built = variant('market_row', built => {
      for (const opening of built.location.openings) if (opening.id === 'd_front') opening.state = 'locked';
    });
    const from = built.location.objects.find(object => object.type === 'register')!.in;
    const to = built.location.entries[0];
    expect(storyDoorRoute(built, from, to)).toEqual(['d_front']);
    expect(armedRouteFact(built).truth).toBe(true);
    const reordered = structuredClone(built); reordered.location.openings.reverse();
    expect(storyDoorRoute(reordered, from, to)).toEqual(storyDoorRoute(built, from, to));
    for (const opening of built.location.openings) if (opening.type !== 'window') opening.state = 'blocked';
    expect(storyDoorRoute(built, from, to)).toBeNull();
  });

  it('keeps the chair fact false for a walking-only doorway and preserves the shared floor restrictions', () => {
    const built = variant('juniper_court_v1', built => {
      for (const opening of built.location.openings) if (opening.a === 'living' || opening.b === 'living') {
        opening.state = 'open';
        const dx = opening.to.x - opening.from.x, dy = opening.to.y - opening.from.y;
        const length = Math.hypot(dx, dy);
        opening.to = { x: opening.from.x + dx / length * 2, y: opening.from.y + dy / length * 2 };
      }
    });
    const outside = built.location.entries[0];
    expect(storyDoorRoute(built, 'living', outside)).not.toBeNull();
    expect(storyDoorRoute(built, 'living', outside, true)).toBeNull();
    expect(storyDoorRoute(built, 'living', outside, true)).toEqual(findStoryRoute(built, 'living', outside, 'chair'));
    const input = generateIncident({ type: 'protected_rescue', familyId: 'juniper_court_v1', buildingSeed: 7, seed: 0, tier: 2, contentVersion: 4 });
    expect(withRescueStory(input, built).facts.find(fact => fact.id === 'v5_chair_f_chair_route')!.truth).toBe(false);
    const location = structuredClone(TWO_FLOOR_FIXTURE);
    const apartment: BuiltLocation = { location, derived: deriveLocation(location), issues: [] };
    const stair = apartment.location.openings.find(opening => opening.type === 'stair')!;
    expect(storyDoorRoute(apartment, stair.a, stair.b)).toEqual([stair.id]);
    expect(storyDoorRoute(apartment, stair.a, stair.b, true)).toBeNull();
  });
});
