import { THERMAL_DESCRIPTION } from './capabilities';
import type { DevelopmentNode, Id } from '../sim/types';

// Non-exclusive nodes across five branches. Costs are proposed tuning values (save v12): each is
// the old funding price plus $800 for every development point it used to need, rounded to $100.
// Each tier is bought with cash now, or granted free when its milestone holds (sim/grants.ts).
// No milestone holds at the start (level 1, no calls resolved, trust 78). Trust moves up to about
// 8 a call, so the one trust milestone sits near the top of the scale.
export const DEV_NODES: Record<Id, DevelopmentNode> = {
  // ---- personnel
  personnel_negotiation: {
    id: 'personnel_negotiation',
    branch: 'personnel',
    name: 'Negotiation training',
    description: "Adds courses in crisis negotiation and calming tense situations. Officers must complete the courses before they gain the qualifications.",
    cost: { funding: 2400 },
    grant: { level: 1, resolved: 4 },
    requires: [],
    effects: [{ kind: 'unlockCourse', courseId: 'crisis_negotiation_course' }, { kind: 'unlockCourse', courseId: 'deescalation_course' }],
  },
  personnel_academy: {
    id: 'personnel_academy',
    branch: 'personnel',
    name: 'Training academy',
    description: "Train 2, 3, then 4 officers at once as you buy each upgrade.",
    cost: { funding: 4900 },
    grant: { level: 3 },
    requires: [],
    effects: [{ kind: 'trainingSlots', delta: 1 }],
    tiers: [
      { cost: { funding: 4900 }, grant: { level: 3 }, effects: [{ kind: 'trainingSlots', delta: 1 }] },
      { cost: { funding: 7200 }, grant: { level: 5 }, effects: [{ kind: 'trainingSlots', delta: 2 }] },
      { cost: { funding: 11300 }, grant: { level: 7 }, effects: [{ kind: 'trainingSlots', delta: 3 }] },
    ],
  },
  personnel_recruiting: {
    id: 'personnel_recruiting',
    branch: 'personnel',
    name: 'Recruiting office',
    description: "Adds room for 2 more officers and 1 more candidate to choose from when recruiting.",
    cost: { funding: 3100 },
    grant: { level: 2 },
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
    cost: { funding: 5400 },
    grant: { level: 5 },
    requires: ['personnel_recruiting'],
    effects: [{ kind: 'rosterCap', delta: 4 }],
  },
  // Command Staff hires (src/sim/command-staff.ts). Each manager has an on/off switch on HQ.
  personnel_watch_commander: {
    id: 'personnel_watch_commander',
    branch: 'personnel',
    name: 'Watch commander',
    description: "Open a watch commander post. You choose who fills it from three candidates; whoever you hire rests idle squads when someone is worn down and puts them back on duty once everyone is fresh. Never touches a squad on a call.",
    cost: { funding: 1600 },
    grant: { level: 1, resolved: 5 },
    requires: [],
    effects: [{ kind: 'commandStaff', managerId: 'watch_commander' }],
  },
  personnel_training_sergeant: {
    id: 'personnel_training_sergeant',
    branch: 'personnel',
    name: 'Training sergeant',
    description: "Open a training sergeant post. You choose who fills it from three candidates; whoever you hire fills free training places with your most rested officers, in the course you choose, while keeping a funding reserve.",
    cost: { funding: 1600 },
    grant: { level: 4 },
    requires: ['personnel_academy'],
    effects: [{ kind: 'commandStaff', managerId: 'training_sergeant' }],
  },
  personnel_peer_support_lead: {
    id: 'personnel_peer_support_lead',
    branch: 'personnel',
    name: 'Peer support lead',
    description: "Open a peer support lead post. You choose who fills it from three candidates; whoever you hire offers sessions to your most strained idle officers each hour, taking stress off faster than rest alone for $80 a session, above a funding reserve you set.",
    cost: { funding: 1600 },
    grant: { level: 1, trust: 95 },
    requires: [],
    effects: [{ kind: 'commandStaff', managerId: 'peer_support_lead' }],
  },
  personnel_recruiter: {
    id: 'personnel_recruiter',
    branch: 'personnel',
    name: 'Recruiter',
    description: "Open a recruiter post. You choose who fills it from three candidates; whoever you hire signs the best candidate for the role you choose whenever the roster has room, keeping funding above a reserve you set.",
    cost: { funding: 1600 },
    grant: { level: 4 },
    requires: ['personnel_recruiting'],
    effects: [{ kind: 'commandStaff', managerId: 'recruiter' }],
  },
  // ---- field capability
  field_contact_kit: {
    id: 'field_contact_kit',
    branch: 'field',
    name: 'Contact kit',
    description: "Makes throw phones available to buy for two-way conversations. An officer still needs crisis negotiation training to use one.",
    cost: { funding: 1400 },
    grant: { level: 1, resolved: 2 },
    requires: [],
    effects: [{ kind: 'unlockItem', itemId: 'throw_phone' }],
  },
  field_entry_course: {
    id: 'field_entry_course',
    branch: 'field',
    name: 'Entry team course',
    description: "Adds the entry team training course. Officers must complete it before they qualify for entry team duty.",
    cost: { funding: 2800 },
    grant: { level: 2 },
    requires: [],
    effects: [{ kind: 'unlockCourse', courseId: 'entry_course' }],
  },
  // ---- intelligence
  intel_thermal: {
    id: 'intel_thermal',
    branch: 'intel',
    name: 'Thermal imaging',
    description: THERMAL_DESCRIPTION,
    cost: { funding: 3100 },
    grant: { level: 3 },
    requires: [],
    effects: [{ kind: 'unlockItem', itemId: 'thermal_imager' }, { kind: 'unlockItem', itemId: 'inspection_camera' }],
  },
  intel_drone: {
    id: 'intel_drone',
    branch: 'intel',
    name: 'Drone program',
    description: "Makes camera drones available to buy and adds the drone operator course. Officers must complete the course before using a drone.",
    cost: { funding: 4600 },
    grant: { level: 6 },
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
    cost: { funding: 1800 },
    grant: { level: 3 },
    requires: [],
    effects: [{ kind: 'income', perHour: 60 }],
    tiers: [
      { cost: { funding: 1800 }, grant: { level: 3 }, effects: [{ kind: 'income', perHour: 60 }] },
      { cost: { funding: 5400 }, grant: { level: 5 }, effects: [{ kind: 'income', perHour: 120 }] },
      { cost: { funding: 10000 }, grant: { level: 8 }, effects: [{ kind: 'income', perHour: 200 }] },
    ],
  },
  // ---- logistics
  logistics_equipment_manager: {
    id: 'logistics_equipment_manager',
    branch: 'logistics',
    name: 'Equipment manager',
    description: "Pay less for repairs, slow equipment wear and repair more items at once. Each upgrade improves all three. Choose an hourly repair budget in Gear to turn on automatic repairs.",
    cost: { funding: 4900 },
    grant: { level: 1, resolved: 8 },
    requires: [],
    effects: [{ kind: 'equipmentManager', repairMultiplier: 0.75, wearMultiplier: 0.8, maxConcurrentServices: 2 }],
    tiers: [
      { cost: { funding: 4900 }, grant: { level: 1, resolved: 8 }, effects: [{ kind: 'equipmentManager', repairMultiplier: 0.75, wearMultiplier: 0.8, maxConcurrentServices: 2 }] },
      { cost: { funding: 8500 }, grant: { level: 1, resolved: 20 }, effects: [{ kind: 'equipmentManager', repairMultiplier: 0.65, wearMultiplier: 0.7, maxConcurrentServices: 3 }] },
      { cost: { funding: 13100 }, grant: { level: 1, resolved: 40 }, effects: [{ kind: 'equipmentManager', repairMultiplier: 0.55, wearMultiplier: 0.6, maxConcurrentServices: 4 }] },
    ],
  },
  logistics_presets: {
    id: 'logistics_presets',
    branch: 'logistics',
    name: 'Saved equipment sets',
    description: "Save a usual set of equipment for each squad to make preparing for calls quicker.",
    cost: { funding: 1300 },
    grant: { level: 1, resolved: 3 },
    requires: [],
    effects: [{ kind: 'loadoutPresets' }],
  },
  logistics_restock: {
    id: 'logistics_restock',
    branch: 'logistics',
    name: 'Supply restocking',
    description: "Choose how many items to keep in stock and an hourly spending limit. The department buys replacements each hour within that limit and its available funds.",
    cost: { funding: 2500 },
    grant: { level: 1, resolved: 10 },
    requires: ['logistics_presets'],
    effects: [{ kind: 'restockRules' }],
  },
  // ---- wellbeing
  wellbeing_peer_support: {
    id: 'wellbeing_peer_support',
    branch: 'wellbeing',
    name: 'Peer support program',
    description: "Help officers recover from stress between calls. The three upgrades make recovery 50%, 75% and 100% faster.",
    cost: { funding: 2600 },
    grant: { level: 2 },
    requires: [],
    effects: [{ kind: 'recoveryRate', mult: 1.5 }],
    tiers: [
      { cost: { funding: 2600 }, grant: { level: 2 }, effects: [{ kind: 'recoveryRate', mult: 1.5 }] },
      { cost: { funding: 6000 }, grant: { level: 4 }, effects: [{ kind: 'recoveryRate', mult: 1.75 }] },
      { cost: { funding: 9800 }, grant: { level: 7 }, effects: [{ kind: 'recoveryRate', mult: 2 }] },
    ],
  },
  wellbeing_first_aid: {
    id: 'wellbeing_first_aid',
    branch: 'wellbeing',
    name: 'Medical training',
    description: "Adds the advanced first aid course and makes rescue shields available to buy. Officers must complete the course before providing advanced first aid or using a rescue shield.",
    cost: { funding: 2700 },
    grant: { level: 3 },
    requires: ['wellbeing_peer_support'],
    effects: [{ kind: 'unlockCourse', courseId: 'first_aid_course' }, { kind: 'unlockItem', itemId: 'rescue_shield' }],
  },
  field_less_lethal: {
    "id": "field_less_lethal",
    "branch": "field",
    "name": "Less-lethal response program",
    "description": "Makes less-lethal devices, launchers and their supplies available to buy, and adds their training courses. Officers must complete the required training before using the equipment.",
    cost: { funding: 2600 },
    grant: { level: 4 },
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
    "description": "Makes carbines and response shotguns available to buy. Weapons still require an officer trained for entry team duty. Sidearms and light protective kits are issued from the first day.",
    cost: { funding: 2600 },
    grant: { level: 1, resolved: 12 },
    "requires": [
        "field_entry_course"
    ],
    "effects": [
        {
            "kind": "unlockItem",
            "itemId": "compact_carbine"
        },
        {
            "kind": "unlockItem",
            "itemId": "response_shotgun"
        }
    ]
},
  field_specialist_response: {
    "id": "field_specialist_response",
    "branch": "field",
    "name": "Specialist response program",
    "description": "Makes precision support rifles available to buy and adds their training course. Officers must complete the required training before using the equipment.",
    cost: { funding: 3000 },
    grant: { level: 7 },
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
    cost: { funding: 2800 },
    grant: { level: 5 },
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
    cost: { funding: 3100 },
    grant: { level: 1, resolved: 6 },
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
    cost: { funding: 4900 },
    grant: { level: 6 },
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
