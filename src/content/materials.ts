import type { DoorMaterial, FloorMaterial, Glazing, WallMaterial, WindowCovering } from '../sim/types';

// Abstract game properties of construction materials. Transmission values are
// 0..1 multipliers on a signal passing through one layer; they are game
// abstractions chosen to be plausible, not engineering data.
//   sound   — voice / hailer / phone audibility
//   thermal — heat-signature readout (glass and masonry block it almost entirely)
//   radio   — handheld radio signal between squads
//   visual  — seeing through (1 = clear line of sight)

export interface Transmission {
  sound: number;
  thermal: number;
  radio: number;
  visual: number;
}

export const WALLS: Record<WallMaterial, Transmission & { label: string }> = {
  brick: { label: 'Brick', sound: 0.15, thermal: 0.02, radio: 0.55, visual: 0 },
  wood_frame: { label: 'Timber frame', sound: 0.3, thermal: 0.08, radio: 0.85, visual: 0 },
  drywall: { label: 'Drywall', sound: 0.45, thermal: 0.12, radio: 0.9, visual: 0 },
  plaster: { label: 'Lath and plaster', sound: 0.3, thermal: 0.08, radio: 0.8, visual: 0 },
  concrete: { label: 'Concrete', sound: 0.08, thermal: 0.01, radio: 0.35, visual: 0 },
  glass_partition: { label: 'Glass partition', sound: 0.35, thermal: 0.02, radio: 0.95, visual: 0.9 },
};

/** Door leaves: transmission when closed, plus abstract minutes to force when locked. */
export const DOORS: Record<DoorMaterial, Transmission & { label: string; forceMinutes: number; forceMinutesWithTool: number }> = {
  hollow_core: { label: 'Hollow-core door', sound: 0.55, thermal: 0.1, radio: 0.95, visual: 0, forceMinutes: 2, forceMinutesWithTool: 0.5 },
  solid_core: { label: 'Solid-core door', sound: 0.3, thermal: 0.05, radio: 0.9, visual: 0, forceMinutes: 6, forceMinutesWithTool: 1.5 },
  steel: { label: 'Steel door', sound: 0.15, thermal: 0.02, radio: 0.5, visual: 0, forceMinutes: 20, forceMinutesWithTool: 6 },
  glass: { label: 'Glazed door', sound: 0.4, thermal: 0.02, radio: 0.95, visual: 0.85, forceMinutes: 3, forceMinutesWithTool: 1 },
};

export const GLAZING: Record<Glazing, Transmission & { label: string }> = {
  single: { label: 'Single glazed', sound: 0.5, thermal: 0.02, radio: 0.95, visual: 0.95 },
  double: { label: 'Double glazed', sound: 0.25, thermal: 0.01, radio: 0.9, visual: 0.9 },
  security: { label: 'Security glazing', sound: 0.12, thermal: 0.01, radio: 0.8, visual: 0.85 },
};

/** Coverings multiply visual transmission only. */
export const COVERINGS: Record<WindowCovering, { label: string; visual: number }> = {
  none: { label: 'Uncovered', visual: 1 },
  blinds: { label: 'Blinds drawn', visual: 0.25 },
  curtains: { label: 'Curtains drawn', visual: 0.05 },
};

/** Open openings pass everything; closed/locked leaves use their material. */
export const OPEN_AIR: Transmission = { sound: 1, thermal: 1, radio: 1, visual: 1 };

/** Per-foot falloff of a channel through open air inside a building (abstract). */
export const AIR_FALLOFF_PER_FT: Transmission = { sound: 0.012, thermal: 0.02, radio: 0.002, visual: 0.004 };

/** Floor/ceiling between storeys. Signals between floors pass one of these (stairs pass open air). */
export const FLOORS: Record<FloorMaterial, Transmission & { label: string }> = {
  timber_joist: { label: 'Timber floor', sound: 0.35, thermal: 0.04, radio: 0.85, visual: 0 },
  concrete_slab: { label: 'Concrete slab', sound: 0.1, thermal: 0.01, radio: 0.45, visual: 0 },
};

/** Abstract minutes to climb one flight of stairs, cautiously. */
export const STAIR_MINUTES = 1.2;
