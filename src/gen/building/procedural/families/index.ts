import type { FamilySpec } from '../types';
import { APARTMENT } from './apartment_unit';
import { BAR_RESTAURANT } from './bar_restaurant';
import { BUNGALOW } from './bungalow';
import { CORNER_STORE } from './corner_store_flat';
import { MOTEL_ROW } from './motel_row';
import { SEMI } from './semi_detached';
import { WAREHOUSE } from './warehouse';
import { SMALL_OFFICE } from './small_office';
import { TWO_STOREY } from './two_storey_house';

export const FAMILIES: FamilySpec[] = [BUNGALOW, TWO_STOREY, SEMI, APARTMENT, CORNER_STORE, SMALL_OFFICE, BAR_RESTAURANT, WAREHOUSE, MOTEL_ROW];
