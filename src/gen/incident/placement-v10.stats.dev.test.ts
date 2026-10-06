import { describe, it } from 'vitest';
import { GENERATED_FAMILIES_V10 } from '../../content/scenario-types-v10';
import { baseFamilyIdV7 } from '../building';
import { buildLocation } from '../../sim/location';
import { selectStoryRoom } from '../../sim/story-bindings';
import { hashSeed } from '../../sim/rng';
import type { IncidentType } from '../../sim/scenario-types';
import { generateIncident } from './index';
import { placementKind } from './placement-v10';

// Developer measurement, skipped unless PLACEMENT_STATS is set:
//   PLACEMENT_STATS=60 npx vitest run src/gen/incident/placement-v10.stats.dev.test.ts --silent=false
const seeds = Number((import.meta.env as Record<string, string | undefined>).PLACEMENT_STATS ?? 0);
describe.skipIf(!seeds)('v10 placement variety on generated buildings', () => {
  it('reports distinct start rooms, upstairs share and first-seed failures per framework', () => {
    const rows: string[] = [];
    for (const [type, families] of Object.entries(GENERATED_FAMILIES_V10) as [IncidentType, readonly string[]][]) {
      const rooms = new Set<string>(), uses = new Set<string>(), v9Rooms = new Set<string>();
      let total = 0, upstairs = 0, twoFloor = 0, upstairsInTwoFloor = 0, misreported = 0, retried = 0;
      for (const familyId of families) for (let i = 0; i < seeds; i++) {
        const buildingSeed = hashSeed(`${familyId}:${i}:placement-stats`), seed = hashSeed(`${type}:${i}:call`);
        const s = generateIncident({ type, familyId, buildingSeed, seed, tier: 2, contentVersion: 10 });
        total++;
        if (baseFamilyIdV7(s.locationFamilyId) !== familyId || s.locationSeed !== buildingSeed) { retried++; continue; }
        const built = buildLocation(s.locationFamilyId, s.locationSeed);
        const person = Object.values(s.story!.bindings.people)[0];
        const room = built.location.rooms.find(r => r.id === person.initial.spaceId)!;
        rooms.add(`${familyId}:${room.type}@${room.floor}`);
        uses.add(`${familyId}:${placementKind(room, built.location)}@${room.floor}`);
        if (room.floor > 0) upstairs++;
        if (built.location.rooms.some(r => r.floor > 0)) { twoFloor++; if (room.floor > 0) upstairsInTwoFloor++; }
        if (person.reported!.spaceId !== person.initial.spaceId) misreported++;
        const old = selectStoryRoom(built, { floor: 0, types: built.location.setting === 'business' ? ['office', 'storage'] : ['living', 'bedroom'], reachableFromSpaceId: built.location.entries[0] }, hashSeed(`${seed}:scene-v9`));
        if (old) v9Rooms.add(`${familyId}:${old.type}@${old.floor}`);
      }
      const perFamily = (set: Set<string>) => families.map(f => [...set].filter(k => k.startsWith(f + ':')).length);
      const allKinds = new Set([...rooms].map(k => k.split(':')[1]));
      rows.push(`${type.padEnd(19)} calls=${total} firstSeedFail=${(100 * retried / total).toFixed(1)}% distinct(type@floor) all=${allKinds.size} perFamily=[${perFamily(rooms).join(',')}] use@floor perFamily=[${perFamily(uses).join(',')}] v9selector perFamily=[${perFamily(v9Rooms).join(',')}] upstairs=${(100 * upstairs / (total - retried)).toFixed(0)}% upstairsInTwoFloor=${twoFloor ? (100 * upstairsInTwoFloor / twoFloor).toFixed(0) : '-'}% wrongRoom=${(100 * misreported / (total - retried)).toFixed(0)}%  kinds=${[...allKinds].sort().join(' ')}`);
    }
    console.log(rows.join('\n'));
  }, 600000);
});
