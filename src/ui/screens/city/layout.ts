// Where the five districts sit on the city map. The map is an SVG drawn from this data and from the district
// views: no image, so a new district is a new entry here. Every point is in the 390 by 330 map box; labels are
// placed in percent of it so the map scales with the phone.
import type { DistrictId } from '../../../sim/world/types';

export const MAP_W = 390;
export const MAP_H = 330;

export type Point = readonly [x: number, y: number];

export interface DistrictShape {
  /** Polygon corners, drawn clockwise. */
  points: readonly Point[];
  /** Top left of the tappable name on the map. */
  label: Point;
  /** Patrol dots, filled in order as units are assigned. */
  dots: readonly Point[];
  /** Where a live call is pinned. */
  pin: Point;
  /** Where a squad's letter badge sits. */
  badge: Point;
}

export const CITY_LAYOUT: Readonly<Record<DistrictId, DistrictShape>> = {
  larkin: {
    points: [[30, 20], [220, 12], [258, 128], [150, 158], [0, 176], [0, 40]],
    label: [40, 30],
    dots: [[100, 104], [172, 96], [60, 128], [130, 128], [204, 70], [206, 118]],
    pin: [176, 82],
    badge: [118, 96],
  },
  pike: {
    points: [[150, 158], [258, 128], [292, 228], [232, 300], [168, 236]],
    label: [196, 136],
    dots: [[196, 196], [252, 204], [222, 230], [240, 262], [192, 226], [226, 206]],
    pin: [222, 252],
    badge: [187, 219],
  },
  harbor: {
    points: [[0, 176], [150, 158], [168, 236], [124, 330], [0, 330]],
    label: [16, 186],
    dots: [[60, 256], [108, 246], [34, 270], [92, 296], [30, 306], [134, 268]],
    pin: [78, 282],
    badge: [40, 244],
  },
  eastgate: {
    points: [[220, 12], [390, 6], [390, 180], [292, 228], [258, 128]],
    label: [284, 90],
    dots: [[300, 50], [352, 44], [264, 70], [330, 160], [300, 150], [372, 150]],
    pin: [322, 74],
    badge: [352, 150],
  },
  oldmill: {
    points: [[292, 228], [390, 180], [390, 330], [232, 330], [232, 300]],
    label: [300, 236],
    dots: [[270, 322], [304, 314], [332, 326], [374, 318], [376, 290], [300, 290]],
    pin: [352, 298],
    badge: [254, 312],
  },
};

/** The river along the bottom edge of the city, and the streets drawn over the districts. */
export const RIVER_PATH = 'M0 296 C 50 286, 90 318, 140 306 S 210 322, 232 316';
export const STREETS_PATH = 'M40 60 L230 54 M20 120 L250 100 M90 20 L120 170 M180 14 L200 150 M160 190 L280 172 M190 160 L210 290 M20 230 L160 214 M60 180 L50 320';

export const polygonPoints = (points: readonly Point[]): string => points.map(([x, y]) => `${x},${y}`).join(' ');
export const percentX = (x: number): string => `${(x / MAP_W) * 100}%`;
export const percentY = (y: number): string => `${(y / MAP_H) * 100}%`;
