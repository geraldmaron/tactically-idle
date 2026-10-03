import { THERMAL_DESCRIPTION } from './capabilities';
import type { DevelopmentNode, Id } from '../sim/types';

// Non-exclusive nodes across five branches. Costs are proposed tuning values.
// Starting devPoints are 3, so the first purchase is a real choice, not a forced order.
export const DEV_NODES: Record<Id, DevelopmentNode> = {
  // ---- personnel
  personnel_negotiation: {
    id: 'personnel_negotiation',
    branch: 'personnel',
    name: 'Negotiation training',
    description: 'Lets the department train officers in crisis negotiation so more than one person can open contact.',
    cost: { dp: 2, funding: 800 },
    requires: [],
    effects: [{ kind: 'unlockCourse', courseId: 'crisis_negotiation_course' }, { kind: 'unlockCourse', courseId: 'deescalation_course' }],
  },
  personnel_academy: {
    id: 'personnel_academy',
    branch: 'personnel',
    name: 'Training academy',
    description: 'Expand the academy to train two, three, then four officers at once.',
    cost: { dp: 3, funding: 2500 },
    requires: [],
    effects: [{ kind: 'trainingSlots', delta: 1 }],
    tiers: [
      { cost: { dp: 3, funding: 2500 }, effects: [{ kind: 'trainingSlots', delta: 1 }] },
      { cost: { dp: 4, funding: 4000 }, effects: [{ kind: 'trainingSlots', delta: 2 }] },
      { cost: { dp: 6, funding: 6500 }, effects: [{ kind: 'trainingSlots', delta: 3 }] },
    ],
  },
  personnel_recruiting: {
    id: 'personnel_recruiting',
    branch: 'personnel',
    name: 'Recruiting office',
    description: 'More desks and a wider outreach: room for more officers and a larger candidate pool.',
    cost: { dp: 2, funding: 1500 },
    requires: [],
    effects: [
      { kind: 'rosterCap', delta: 2 },
      { kind: 'candidatePool', delta: 1 },
    ],
  },
  personnel_fourth_squad: {
    id: 'personnel_fourth_squad',
    branch: 'personnel',
    name: 'Expanded barracks',
    description: 'Four extra roster places. With the recruiting office, the roster reaches 18, enough to staff the four available squads.',
    cost: { dp: 3, funding: 3000 },
    requires: ['personnel_recruiting'],
    effects: [{ kind: 'rosterCap', delta: 4 }],
  },
  // ---- field capability
  field_contact_kit: {
    id: 'field_contact_kit',
    branch: 'field',
    name: 'Contact kit',
    description: 'Approves throw phones for two-way contact with a qualified negotiator.',
    cost: { dp: 1, funding: 600 },
    requires: [],
    effects: [{ kind: 'unlockItem', itemId: 'throw_phone' }],
  },
  field_entry_course: {
    id: 'field_entry_course',
    branch: 'field',
    name: 'Entry team course',
    description: 'Lets the department qualify more officers for entry team duty.',
    cost: { dp: 2, funding: 1200 },
    requires: [],
    effects: [{ kind: 'unlockCourse', courseId: 'entry_course' }],
  },
  // ---- intelligence
  intel_thermal: {
    id: 'intel_thermal',
    branch: 'intel',
    name: 'Thermal imaging',
    description: THERMAL_DESCRIPTION,
    cost: { dp: 2, funding: 1500 },
    requires: [],
    effects: [{ kind: 'unlockItem', itemId: 'thermal_imager' }, { kind: 'unlockItem', itemId: 'inspection_camera' }],
  },
  intel_drone: {
    id: 'intel_drone',
    branch: 'intel',
    name: 'Drone program',
    description: 'Approves camera drones and the course that licenses operators.',
    cost: { dp: 3, funding: 2200 },
    requires: ['intel_thermal'],
    effects: [
      { kind: 'unlockItem', itemId: 'camera_drone' },
      { kind: 'unlockCourse', courseId: 'drone_course' },
    ],
  },
  intel_records: {
    id: 'intel_records',
    branch: 'intel',
    name: 'Records office',
    description: 'Digitised case records cut paperwork and bring in small service fees.',
    cost: { dp: 1, funding: 1000 },
    requires: [],
    effects: [{ kind: 'income', perHour: 60 }],
    tiers: [
      { cost: { dp: 1, funding: 1000 }, effects: [{ kind: 'income', perHour: 60 }] },
      { cost: { dp: 3, funding: 3000 }, effects: [{ kind: 'income', perHour: 120 }] },
      { cost: { dp: 5, funding: 6000 }, effects: [{ kind: 'income', perHour: 200 }] },
    ],
  },
  // ---- logistics
  logistics_equipment_manager: {
    id: 'logistics_equipment_manager',
    branch: 'logistics',
    name: 'Equipment manager',
    description: 'Improve the maintenance workshop for cheaper repairs, slower reusable-gear wear, and more automatic service jobs. Choose the optional hourly spending ceiling on Gear.',
    cost: { dp: 3, funding: 2500 },
    requires: [],
    effects: [{ kind: 'equipmentManager', repairMultiplier: 0.75, wearMultiplier: 0.8, maxConcurrentServices: 2 }],
    tiers: [
      { cost: { dp: 3, funding: 2500 }, effects: [{ kind: 'equipmentManager', repairMultiplier: 0.75, wearMultiplier: 0.8, maxConcurrentServices: 2 }] },
      { cost: { dp: 5, funding: 4500 }, effects: [{ kind: 'equipmentManager', repairMultiplier: 0.65, wearMultiplier: 0.7, maxConcurrentServices: 3 }] },
      { cost: { dp: 7, funding: 7500 }, effects: [{ kind: 'equipmentManager', repairMultiplier: 0.55, wearMultiplier: 0.6, maxConcurrentServices: 4 }] },
    ],
  },
  logistics_presets: {
    id: 'logistics_presets',
    branch: 'logistics',
    name: 'Loadout presets',
    description: 'Save a standard loadout for each squad so deployments need fewer taps.',
    cost: { dp: 1, funding: 500 },
    requires: [],
    effects: [{ kind: 'loadoutPresets' }],
  },
  logistics_restock: {
    id: 'logistics_restock',
    branch: 'logistics',
    name: 'Supply restocking',
    description: 'Set a target stock and a spending ceiling; the department reorders hourly, never overspending.',
    cost: { dp: 2, funding: 900 },
    requires: ['logistics_presets'],
    effects: [{ kind: 'restockRules' }],
  },
  // ---- wellbeing
  wellbeing_peer_support: {
    id: 'wellbeing_peer_support',
    branch: 'wellbeing',
    name: 'Peer support program',
    description: 'Debriefs and peer check-ins help officers recover from strain faster.',
    cost: { dp: 2, funding: 1000 },
    requires: [],
    effects: [{ kind: 'recoveryRate', mult: 1.5 }],
    tiers: [
      { cost: { dp: 2, funding: 1000 }, effects: [{ kind: 'recoveryRate', mult: 1.5 }] },
      { cost: { dp: 4, funding: 2800 }, effects: [{ kind: 'recoveryRate', mult: 1.75 }] },
      { cost: { dp: 6, funding: 5000 }, effects: [{ kind: 'recoveryRate', mult: 2 }] },
    ],
  },
  wellbeing_first_aid: {
    id: 'wellbeing_first_aid',
    branch: 'wellbeing',
    name: 'Medical training',
    description: 'Lets the department train officers in advanced first aid so a second medic is possible.',
    cost: { dp: 2, funding: 1100 },
    requires: ['wellbeing_peer_support'],
    effects: [{ kind: 'unlockCourse', courseId: 'first_aid_course' }, { kind: 'unlockItem', itemId: 'rescue_shield' }],
  },
  field_less_lethal: {
    "id": "field_less_lethal",
    "branch": "field",
    "name": "Less-lethal response program",
    "description": "Approves situational equipment and related training. Officers must complete their own required qualifications; buying this program grants no certification.",
    "cost": {
        "dp": 2,
        "funding": 1000
    },
    "requires": [],
    "effects": [
        {
            "kind": "unlockItem",
            "itemId": "conducted_energy_device"
        },
        {
            "kind": "unlockItem",
            "itemId": "impact_launcher"
        },
        {
            "kind": "unlockItem",
            "itemId": "energy_cartridge"
        },
        {
            "kind": "unlockItem",
            "itemId": "impact_supply"
        },
        {
            "kind": "unlockCourse",
            "courseId": "less_lethal_course"
        },
        {
            "kind": "unlockCourse",
            "courseId": "advanced_less_lethal_course"
        }
    ]
},
  field_response_program: {
    "id": "field_response_program",
    "branch": "field",
    "name": "Protective response program",
    "description": "Approves situational equipment and related training. Officers must complete their own required qualifications; buying this program grants no certification.",
    "cost": {
        "dp": 2,
        "funding": 1000
    },
    "requires": [
        "field_entry_course"
    ],
    "effects": [
        {
            "kind": "unlockItem",
            "itemId": "service_sidearm"
        },
        {
            "kind": "unlockItem",
            "itemId": "compact_carbine"
        },
        {
            "kind": "unlockItem",
            "itemId": "response_shotgun"
        },
        {
            "kind": "unlockItem",
            "itemId": "light_protection"
        }
    ]
},
  field_specialist_response: {
    "id": "field_specialist_response",
    "branch": "field",
    "name": "Specialist response program",
    "description": "Approves situational equipment and related training. Officers must complete their own required qualifications; buying this program grants no certification.",
    "cost": {
        "dp": 2,
        "funding": 1400
    },
    "requires": [
        "field_response_program"
    ],
    "effects": [
        {
            "kind": "unlockItem",
            "itemId": "precision_support"
        },
        {
            "kind": "unlockCourse",
            "courseId": "precision_support_course"
        }
    ]
},
  field_controlled_access: {
    "id": "field_controlled_access",
    "branch": "field",
    "name": "Controlled access program",
    "description": "Approves situational equipment and related training. Officers must complete their own required qualifications; buying this program grants no certification.",
    "cost": {
        "dp": 2,
        "funding": 1200
    },
    "requires": [
        "field_entry_course"
    ],
    "effects": [
        {
            "kind": "unlockItem",
            "itemId": "rescue_spreader"
        },
        {
            "kind": "unlockItem",
            "itemId": "door_charge"
        },
        {
            "kind": "unlockCourse",
            "courseId": "controlled_access_course"
        }
    ]
},
  logistics_field_support: {
    "id": "logistics_field_support",
    "branch": "logistics",
    "name": "Field support program",
    "description": "Approves situational equipment and related training. Officers must complete their own required qualifications; buying this program grants no certification.",
    "cost": {
        "dp": 2,
        "funding": 1500
    },
    "requires": [],
    "effects": [
        {
            "kind": "unlockItem",
            "itemId": "support_van"
        },
        {
            "kind": "unlockItem",
            "itemId": "command_van"
        },
        {
            "kind": "unlockItem",
            "itemId": "radio_relay"
        },
        {
            "kind": "unlockCourse",
            "courseId": "vehicle_operations_course"
        }
    ]
},
  logistics_armored_support: {
    "id": "logistics_armored_support",
    "branch": "logistics",
    "name": "Armored rescue support",
    "description": "Approves situational equipment and related training. Officers must complete their own required qualifications; buying this program grants no certification.",
    "cost": {
        "dp": 3,
        "funding": 2500
    },
    "requires": [
        "logistics_field_support"
    ],
    "effects": [
        {
            "kind": "unlockItem",
            "itemId": "armored_rescue_vehicle"
        }
    ]
},
};
