import { SCENARIOS, SCENARIO_ORDER } from '../../content/scenarios';
import { LOCATION_FAMILIES } from '../location';
import { MS_OCCUPANCY } from './ms-occupancy';
import { MS_URGENT } from './ms-urgent';
import { MAPLE_STREET } from './maple-street';

// Authored Maple calls exercise isolated engine rules; none is dispatched or shipped.
for (const s of [MS_OCCUPANCY, MS_URGENT]) SCENARIOS[s.id] = s;
SCENARIO_ORDER.push(MS_OCCUPANCY.id, MS_URGENT.id);
LOCATION_FAMILIES[MAPLE_STREET.id] = MAPLE_STREET;
