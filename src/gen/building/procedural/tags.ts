// The tag vocabulary of generated buildings. The incident generator places people and
// props by these tags, so tests hold every emitted tag to this list (see README.md).

export const ROOM_TAGS = [
  // what the room is for
  'sleeping', 'living', 'dining', 'cooking', 'water', 'wc', 'work', 'office', 'meeting', 'reception', 'shop', 'bar', 'storage', 'stock',
  'utility', 'laundry', 'server', 'cold', 'guest', 'ensuite', 'warehouse', 'stairs', 'circulation',
  // who it is for
  'public', 'private', 'service', 'staff', 'customer', 'residential', 'lockable',
  // how it sits in the plan
  'narrow', 'junction', 'open', 'interior', 'windowless', 'street_facing', 'rear_facing', 'chamfer', 'ground', 'upstairs', 'exterior_door', 'high_capacity',
  // what the furniture makes of it (derived from its objects)
  'valuables', 'hazard', 'concealment', 'cover',
] as const;

export const ZONE_TAGS = ['street', 'exposed', 'cover', 'fence', 'alley', 'vehicles', 'neighbour', 'party_wall', 'no_entry', 'corridor', 'common', 'stairwell', 'balcony', 'loading_bay', 'walkway', 'patio'] as const;

export const OBJECT_TAGS = ['blocks_space', 'blocks_sight', 'concealment', 'cover', 'valuables', 'hazard', 'storage', 'appliance', 'boiler', 'safe', 'server', 'shower', 'bar', 'equipment'] as const;
