import type { DistrictId } from '../../sim/world/types';
import type { DistrictDef } from './types';

/** The five districts. Pike Street is open from the first day; the others open with the department level. */
export const DISTRICTS: Readonly<Record<DistrictId, DistrictDef>> = {
  pike: {
    id: 'pike',
    name: 'Pike Street',
    blurb: 'A long commercial strip of walk-ups, a laundromat and a bakery, busy from the first bus to the last.',
    openAtLevel: 1,
    startCrime: 50,
    crews: [{ archetype: 'street_crew', name: 'Pike Street Kings' }],
    residents: ['Ninth Street Bakery', 'Wash House Laundromat', 'Pike Street Barbershop'],
  },
  larkin: {
    id: 'larkin',
    name: 'Larkin Heights',
    blurb: 'Hillside apartment blocks above the river, with a pharmacy at the bottom of the stairs.',
    openAtLevel: 2,
    startCrime: 58,
    crews: [{ archetype: 'theft_ring', name: 'Hilltop Boosters' }],
    residents: ['Heights Pharmacy', 'Larkin Recreation Center', 'Stair Street Grocery'],
  },
  harbor: {
    id: 'harbor',
    name: 'Harbor Flats',
    blurb: 'Warehouses, a fish market and long loading docks that empty out after the last ferry.',
    openAtLevel: 3,
    startCrime: 52,
    crews: [{ archetype: 'supply_network', name: 'Pier Six Runners' }],
    residents: ['Pier Six Diner', 'Flats Cold Storage', 'Harbor Chandlery'],
  },
  eastgate: {
    id: 'eastgate',
    name: 'Eastgate',
    blurb: 'A rail yard and transit hub with a newsstand, a clinic and three bus lines that all end here.',
    openAtLevel: 4,
    startCrime: 47,
    crews: [{ archetype: 'street_crew', name: 'Gate Street Crew' }],
    residents: ['Eastgate Newsstand', 'Gate Street Clinic', 'Yard Lane Hardware'],
  },
  oldmill: {
    id: 'oldmill',
    name: 'Old Mill',
    blurb: 'A shuttered mill and the loft conversions around it, where the lights come on late.',
    openAtLevel: 7,
    startCrime: 60,
    crews: [{ archetype: 'syndicate', name: 'The Mill Table' }],
    residents: ['Mill Race Coffee', 'Foundry Lofts Co-op', 'Millwright Print Shop'],
  },
};

export const DISTRICT_LIST: readonly DistrictDef[] = Object.values(DISTRICTS);
