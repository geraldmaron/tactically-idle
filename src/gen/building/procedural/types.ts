import type { DoorMaterial, FloorMaterial, Glazing, LocationDefinition, RoomType, WallMaterial, WindowCovering } from '../../../sim/types';
import type { Rand } from './rand';
import type { Rect, Vec } from './geom';

/** Building generator version, saved with the location record. Bump when output changes. */
export const GEN_VERSION = 1;

/**
 * circ: halls, landings, stairs. pub: rooms people pass through (living, kitchen, shop
 * floor). leaf: rooms entered and left by one door (bedrooms, baths, offices, stores).
 */
export type RoomClass = 'circ' | 'pub' | 'leaf';

export type WindowKind = 'none' | 'small' | 'normal' | 'large' | 'storefront' | 'high';

export interface RoomSeed {
  /** Id stem: 'bedroom' becomes bedroom_1, bedroom_2; singletons keep the bare key. */
  key: string;
  type: RoomType;
  label: string;
  cls: RoomClass;
  area: number;
  minArea: number;
  maxArea: number;
  /** Shortest side, feet. */
  minW: number;
  maxAspect: number;
  /** 0 = rear, 1 = street side. */
  front: number;
  /** Must touch a hall or landing. */
  needsHall: boolean;
  /** May sit in a cap piece (the piece beyond a hall's end). */
  capOk: boolean;
  required: boolean;
  /** Inclusion probability for optional rooms. */
  prob: number;
  tags: string[];
  /** Furnishing kit name (furnish.ts). */
  kit: string;
  windows: WindowKind;
  /** A bath carved from the far end of this room (an ensuite). */
  ensuite?: RoomSeed;
}

export interface PRoom {
  id: string;
  seed: RoomSeed;
  floor: number;
  rect: Rect;
  poly: Vec[];
  tags: string[];
  label: string;
  /** Id of the bedroom this bath belongs to. */
  ensuiteOf?: string;
}

export interface WindowStyle {
  glazing: [Glazing, number][];
  covering: [WindowCovering, number][];
}

/** Everything the assembly stages need to know about a family beyond the geometry. */
export interface Policy {
  /** [material, weight] */
  extWall: [WallMaterial, number][];
  intWall: [WallMaterial, number][];
  floorCeiling?: FloorMaterial;
  /** Room keys that can hold the front door, with weights. */
  frontRooms: [string, number][];
  frontDoor: { material: [DoorMaterial, number][]; width: [number, number]; sliding?: boolean };
  /** Probability of a back or side door, and the room keys that can hold one. */
  backChance: number;
  backRooms: [string, number][];
  backDoor: { material: [DoorMaterial, number][]; width: [number, number]; state?: 'closed' | 'locked' };
  /** Chance of a second side door, 0 for none. */
  sideChance: number;
  /** A door to the outside for every room with this key (motel units). */
  perRoom?: { key: string; sides: ('n' | 's' | 'e' | 'w')[]; door: { material: [DoorMaterial, number][]; width: [number, number] } }[];
  /** Further exterior doors (a shop's separate flat entrance, a service door). */
  extraDoors?: {
    kind: string;
    chance: number;
    rooms: [string, number][];
    sides: ('n' | 's' | 'e' | 'w' | 'd')[];
    door: { material: [DoorMaterial, number][]; width: [number, number]; state?: 'closed' | 'locked'; sliding?: boolean };
    /** Extra wall length beyond the door the run must offer. */
    spare?: number;
  }[];
  /** Sliding glass door to a balcony on a south wall (apartments). */
  balcony?: { chance: number; rooms: [string, number][]; width: [number, number] };
  intDoor: { material: DoorMaterial; width: [number, number] };
  /** Room keys (or types) that get steel interior doors. */
  steelDoors?: string[];
  /** Room-key pairs that join through a wide cased opening instead of a door, with the chance of it. */
  openPairs: [string, string, number][];
  /** Edge preference by 'keyA|keyB' (keys sorted); lower is preferred. Default rules apply when absent. */
  pairWeights?: Record<string, number>;
  /** Room keys that sit behind glass partitions on walls they share with public rooms. */
  glass?: string[];
  windowStyle: Record<string, WindowStyle> & { default: WindowStyle };
  /** Maximum extra loop doors. */
  loops: number;
}

export interface FamilyInfo {
  id: string;
  label: string;
  setting: LocationDefinition['setting'];
  floors: [number, number];
  blurb: string;
}

export interface Plan {
  /** Lot coordinates throughout. */
  floors: 1 | 2;
  footprint: Vec[];
  /** Footprint before the chamfer, used to lay out the yards. Set by finalizeRooms. */
  footprintSq?: Vec[];
  upperFootprint?: Vec[];
  rooms: PRoom[];
  /** Ground-floor stair room id and upper stair id when floors === 2. */
  stair?: { lower: string; upper: string };
  /** Rooms (by id) allowed to hold exterior doors, in addition to the policy's lists. */
  chamfer?: { corner: Vec; leg: number };
  /** Side of the building shared with a neighbour (semi, apartment). */
  partyWalls: ('e' | 'w')[];
}

export interface LotSpec {
  /** Building origin in lot coordinates. */
  ox: number;
  oy: number;
  /** Lot extents. */
  w: number;
  h: number;
}

export interface FamilySpec extends FamilyInfo {
  /** Footprint shapes the family can produce ('rect', 'L', 'T', 'U', 'chamfer'); tests require each to appear. */
  shapes: string[];
  fallbackSeed: number;
  /** Sides of the building the front door may face (default south, or the chamfer). */
  frontSides?: ('n' | 's' | 'e' | 'w' | 'd')[];
  /** Sides back and side doors may face (default north, east, west). */
  backSides?: ('n' | 's' | 'e' | 'w' | 'd')[];
  policy: Policy;
  /** Generate rooms and outlines; null when this draw cannot be completed. */
  plan(rng: Rand, why?: (reason: string) => void): { plan: Plan; lot: LotSpec; ext: ExteriorSpec } | null;
  /** Name shown on the incident card. */
  name(rng: Rand): string;
}

/** Exterior layout options, interpreted by exterior.ts. */
export interface ExteriorSpec {
  kind: 'house' | 'semi' | 'shop' | 'bar' | 'office' | 'warehouse' | 'motel' | 'apartment';
  /** Street depth strip at the bottom of the lot (0 for none). */
  streetDepth: number;
  /** Alley depth at the top of the lot (0 for none). */
  alleyDepth: number;
  /** Driveway side, or null. */
  driveway: 'e' | 'w' | null;
  /** Side street on this side (corner lots). */
  sideStreet: 'e' | 'w' | null;
  porch: boolean;
  fences: boolean;
  parking: boolean;
  /** A walkway along unit doors (motels), lot coordinates. */
  walkway?: { x0: number; y0: number; x1: number; y1: number };
  /** Extra decorative note texts to try. */
  notes: string[];
  /** Neighbour zones along these sides (party walls). */
  neighbours: ('e' | 'w')[];
  /** Apartments: a common corridor along the north wall. */
  corridor: boolean;
  /** Loading bay depth on the north or a side (warehouse). */
  bay: 'n' | 'e' | 'w' | null;
  /** Courtyard policy for voids. */
  voidClass: 'front' | 'back' | 'courtyard';
}
