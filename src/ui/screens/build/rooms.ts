// The station's rooms: which painting, which development branch, where it sits on the diorama.
// Positions are in pixels of the 1200 x 800 plates (scene_facilities_plan and its dark twin share one
// camera), so a region can be read straight off the painting and the percentages are derived.
import type { DevBranch } from '../../../sim/types';
import type { IconName } from '../../icons';

export type RoomId = 'personnel' | 'training' | 'information' | 'recovery' | 'equipment' | 'garage';
export const ROOM_IDS: readonly RoomId[] = ['personnel', 'training', 'information', 'recovery', 'equipment', 'garage'];

export const PLATE_W = 1200;
export const PLATE_H = 800;
export type Point = readonly [number, number];

export interface RoomDef {
  id: RoomId;
  /** The development branch the room is the home of; the garage has none (it is patrol capacity). */
  branch: DevBranch | null;
  name: string;
  icon: IconName;
  /** One line on what the room does for people. Never the name of a development. */
  line: string;
  /** The room's outline on the plate, clockwise. The lit painting shows through it once the room is open. */
  region: readonly Point[];
  /** Where the tap target sits: centre, in plate pixels. Centres are at least 185 apart in x or y, so the
   * 44px targets never overlap at 320px wide (the plate is 286px across there). */
  at: Point;
}

export const ROOMS: readonly RoomDef[] = [
  { id: 'personnel', branch: 'personnel', name: 'Personnel office', icon: 'desk',
    line: 'Where recruits sign and courses are run.',
    region: [[316, 284], [520, 256], [606, 350], [560, 378], [330, 378]], at: [440, 290] },
  { id: 'training', branch: 'field', name: 'Training floor', icon: 'shooting',
    line: 'A floor to practise on before the door.',
    region: [[730, 236], [875, 214], [978, 296], [812, 318]], at: [866, 268] },
  { id: 'information', branch: 'intel', name: 'Information room', icon: 'binoculars',
    line: 'Records, cameras and thermal for the team.',
    region: [[492, 410], [670, 412], [672, 458], [660, 508], [498, 510]], at: [590, 478] },
  { id: 'recovery', branch: 'wellbeing', name: 'Recovery room', icon: 'bed',
    line: 'Somewhere to sit down after a bad call.',
    region: [[318, 382], [488, 396], [488, 510], [440, 510], [312, 392]], at: [394, 478] },
  { id: 'equipment', branch: 'logistics', name: 'Equipment bay', icon: 'van',
    line: 'Kit mended and restocked before it is missed.',
    region: [[526, 262], [716, 233], [810, 312], [598, 352]], at: [668, 278] },
  { id: 'garage', branch: null, name: 'Garage', icon: 'car',
    line: 'Patrol cars on the street, the van out front.',
    region: [[668, 356], [810, 322], [978, 298], [1078, 372], [1064, 462], [980, 482], [840, 488], [722, 494], [668, 456]], at: [852, 470] },
];

export const roomOf = (id: RoomId): RoomDef => ROOMS.find((room) => room.id === id)!;
export const roomOfBranch = (branch: DevBranch): RoomDef => ROOMS.find((room) => room.branch === branch)!;

export const roomLit = (id: RoomId): string => `art/plates/room_${id}_lit.webp`;
export const roomDark = (id: RoomId): string => `art/plates/room_${id}_dark.webp`;

export const pctX = (x: number): number => (x / PLATE_W) * 100;
export const pctY = (y: number): number => (y / PLATE_H) * 100;

/** CSS clip-path polygon for a region, in percent of the plate. */
export function clipPolygon(region: readonly Point[]): string {
  return `polygon(${region.map(([x, y]) => `${pctX(x).toFixed(2)}% ${pctY(y).toFixed(2)}%`).join(', ')})`;
}
