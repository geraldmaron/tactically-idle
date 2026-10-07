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
    description: "Adds courses in crisis negotiation and calming tense situations. Officers must complete the courses before they gain the qualifications.",
    cost: { dp: 2, funding: 800 },
    requires: [],
    effects: [{ kind: 'unlockCourse', courseId: 'crisis_negotiation_course' }, { kind: 'unlockCourse', courseId: 'deescalation_course' }],
  },
  personnel_academy: {
    id: 'personnel_academy',
    branch: 'personnel',
    name: 'Training academy',
    description: "Train 2, 3, then 4 officers at once as you buy each upgrade.",
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
    description: "Adds room for 2 more officers and 1 more candidate to choose from when recruiting.",
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
    description: "Adds room for 4 more officers. With the Recruiting office, you can employ 18 officers to staff the four available squads.",
    cost: { dp: 3, funding: 3000 },
    requires: ['personnel_recruiting'],
    effects: [{ kind: 'rosterCap', delta: 4 }],
  },
  // Command Staff hires (src/sim/command-staff.ts). Each manager has an on/off switch on HQ.
  personnel_watch_commander: {
    id: 'personnel_watch_commander',
    branch: 'personnel',
    name: 'Watch commander',
    description: "Hire a watch commander who rests idle squads when someone is worn down and puts them back on duty once everyone is fresh. Paid $45 per hour while on duty. Never touches a squad on a call.",
    cost: { dp: 2, funding: 1500 },
    requires: [],
    effects: [{ kind: 'commandStaff', managerId: 'watch_commander' }],
  },
  personnel_training_sergeant: {
    id: 'personnel_training_sergeant',
    branch: 'personnel',
    name: 'Training sergeant',
    description: "Hire a training sergeant who fills free training places with your most rested officers, in the course you choose, while keeping a funding reserve. Paid $45 per hour while on duty.",
    cost: { dp: 2, funding: 1800 },
    requires: ['personnel_academy'],
    effects: [{ kind: 'commandStaff', managerId: 'training_sergeant' }],
  },
  // ---- field capability
  field_contact_kit: {
    id: 'field_contact_kit',
    branch: 'field',
    name: 'Contact kit',
    description: "Makes throw phones available to buy for two-way conversations. An officer still needs crisis negotiation training to use one.",
    cost: { dp: 1, funding: 600 },
    requires: [],
    effects: [{ kind: 'unlockItem', itemId: 'throw_phone' }],
  },
  field_entry_course: {
    id: 'field_entry_course',
    branch: 'field',
    name: 'Entry team course',
    description: "Adds the entry team training course. Officers must complete it before they qualify for entry team duty.",
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
    description: "Makes camera drones available to buy and adds the drone operator course. Officers must complete the course before using a drone.",
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
    description: "Earn service fees from better case records. The three upgrades bring in $60, $120 and $200 per hour in total.",
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
    description: "Pay less for repairs, slow equipment wear and repair more items at once. Each upgrade improves all three. Choose an hourly repair budget in Gear to turn on automatic repairs.",
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
    name: 'Saved equipment sets',
    description: "Save a usual set of equipment for each squad to make preparing for calls quicker.",
    cost: { dp: 1, funding: 500 },
    requires: [],
    effects: [{ kind: 'loadoutPresets' }],
  },
  logistics_restock: {
    id: 'logistics_restock',
    branch: 'logistics',
    name: 'Supply restocking',
    description: "Choose how many items to keep in stock and an hourly spending limit. The department buys replacements each hour within that limit and its available funds.",
    cost: { dp: 2, funding: 900 },
    requires: ['logistics_presets'],
    effects: [{ kind: 'restockRules' }],
  },
  // ---- wellbeing
  wellbeing_peer_support: {
    id: 'wellbeing_peer_support',
    branch: 'wellbeing',
    name: 'Peer support program',
    description: "Help officers recover from stress between calls. The three upgrades make recovery 50%, 75% and 100% faster.",
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
    description: "Adds the advanced first aid course and makes rescue shields available to buy. Officers must complete the course before providing advanced first aid or using a rescue shield.",
    cost: { dp: 2, funding: 1100 },
    requires: ['wellbeing_peer_support'],
    effects: [{ kind: 'unlockCourse', courseId: 'first_aid_course' }, { kind: 'unlockItem', itemId: 'rescue_shield' }],
  },
  field_less_lethal: {
    "id": "field_less_lethal",
    "branch": "field",
    "name": "Less-lethal response program",
    "description": "Makes less-lethal devices, launchers and their supplies available to buy, and adds their training courses. Officers must complete the required training before using the equipment.",
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
    "description": "Makes sidearms, carbines, response shotguns and light protective kits available to buy. Weapons still require an officer trained for entry team duty.",
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
    "description": "Makes precision support rifles available to buy and adds their training course. Officers must complete the required training before using the equipment.",
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
    "description": "Makes hydraulic rescue tools and single-use door charges available to buy, and adds their training course. Officers must complete the required training before using either item.",
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
    "description": "Makes support vans, command vans and radio relays available to buy, and adds vehicle training. Officers must complete the course before operating a support vehicle.",
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
    "description": "Makes armored rescue vehicles available to buy for rescues outside buildings. A trained vehicle operator is still required.",
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
