import type { CapabilityId, ItemCategory } from '../sim/types';

export const ITEM_CATEGORIES: ItemCategory[] = ['comms', 'intel', 'protection', 'access', 'medical', 'response', 'less_lethal', 'vehicles', 'supplies'];
export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = { comms: 'Comms', intel: 'Intel', protection: 'Protection', access: 'Access', medical: 'Medical', response: 'Response classes', less_lethal: 'Less-lethal', vehicles: 'Vehicles', supplies: 'Supplies' };
export const THERMAL_DESCRIPTION = 'Reads heat signatures in line of sight. Walls and glass block most of it; an open door or gap works best. Uses a battery pack.';
export interface CapabilityDefinition { id: CapabilityId; name: string; description: string; counters: string[] }
const rule = (id: CapabilityId, name: string, description: string, ...counters: string[]): CapabilityDefinition => ({ id, name, description, counters });
/** Shared public explanations. Scores are fictional game tuning, never real equipment performance. */
export const CAPABILITIES: Record<CapabilityId, CapabilityDefinition> = {
  visible_exterior: rule('visible_exterior', 'Exterior observation', '+4 observation with a clear visual path in useful light.', 'Opaque surfaces block sight', 'Darkness removes binocular benefit'),
  dark_visible_scene: rule('dark_visible_scene', 'Scene lighting', 'Recovers up to 5 existing darkness penalty points on a visible scene.', 'No daylight benefit', 'Cannot light through opaque surfaces'),
  opening_inspection: rule('opening_inspection', 'Opening inspection', '+6 observation through an accessible open door or opening; uses one battery.', 'Sealed or blocked openings', 'Only the declared local view'),
  weak_radio_link: rule('weak_radio_link', 'Radio relay', 'Recovers up to 5 lost radio coordination points; uses one battery.', 'Needs headsets on both squads', 'No improvement above a clear link'),
  medical_exposure: rule('medical_exposure', 'Protected medical assistance', '+5 for an exposed patient-assistance action.', 'Needs a medical-qualified acting officer', 'Bulk adds work in constrained space'),
  authorized_response: rule('authorized_response', 'Protective response', 'One best response class and one best protective kit help declared protective containment.', 'No routine contact or observation bonus', 'Class setup and confined-space workload still apply'),
  specialist_support: rule('specialist_support', 'Specialist support', '+7 for a qualified, separately supported role with a clear sightline.', 'Needs a separate support squad', 'Blocked sight and unresolved subject facts'),
  less_lethal_device: rule('less_lethal_device', 'Device intervention', '+4 for an authored device-class intervention, consuming one cartridge.', 'Known subject and adjacent-area safety required', 'Uncertain outcome; injury remains possible'),
  less_lethal_impact: rule('less_lethal_impact', 'Impact intervention', '+5 for an authored impact-class intervention, consuming one compatible supply.', 'Known subject and adjacent-area safety required', 'Setup and collateral risk remain'),
  permitted_door_access: rule('permitted_door_access', 'Controlled door access', 'Qualified mechanical access or one fictional single-use access token on a declared door.', 'No walls, floors, glazing or blocked openings', 'Charge needs ordinary compatible door and known adjacent safety'),
  vehicle_exterior: rule('vehicle_exterior', 'Protected exterior evacuation', '+8 for a declared accessible exterior evacuation using the single support slot.', 'No interior or upper-floor effect', 'Three game minutes of setup'),
  scene_coordination: rule('scene_coordination', 'Mobile scene coordination', '+5 for an authored exterior coordination action with at least two squads.', 'No solo advantage or hidden information', 'Two game minutes of setup'),
};
