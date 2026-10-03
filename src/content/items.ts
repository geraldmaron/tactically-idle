import { THERMAL_DESCRIPTION } from './capabilities';
import type { ItemDefinition } from '../sim/types';

// Abstract game equipment. Tags are what actions require; names are flavour.
// Wear and range values are proposed tuning. Each physical unit wears on its own.
export const ITEMS: Record<string, ItemDefinition> = {
  radio_kit: {
    id: 'radio_kit',
    helpsWith: ["One standard headset per deployed officer; supports linked squad coordination."],
    counters: ["Walls, floors, range and weak condition reduce the link. Spare radios do not stack."],
    category: 'comms',
    name: 'Radio headset',
    kind: 'equipment',
    cost: 400,
    tags: ['comms_kit'],
    description: 'Keeps squads in contact across rooms and with each other.',
    wear: { perUse: 6, perDay: 0.15, unreliableBelow: 45, failAt: 15, serviceHours: 3, serviceCost: 60, restoreTo: 92 },
    range: { effective: 600, max: 1500 },
  },
  loud_hailer: {
    id: 'loud_hailer',
    helpsWith: ["One-way exterior contact on authored contact actions."],
    counters: ["Noise and walls weaken contact. It does not provide private two-way contact or prove occupancy."],
    category: 'comms',
    name: 'Loud hailer',
    kind: 'equipment',
    cost: 250,
    tags: ['hailer'],
    description: 'One-way announcements from outside. Basic contact without a negotiator.',
    wear: { perUse: 3, perDay: 0.05, unreliableBelow: 40, failAt: 10, serviceHours: 2, serviceCost: 30, restoreTo: 95 },
    range: { effective: 60, max: 120 },
  },
  throw_phone: {
    id: 'throw_phone',
    helpsWith: ["A qualified negotiator uses a two-way contact link on supported actions."],
    counters: ["Needs a usable connection path and a qualified negotiator. It never guarantees cooperation."],
    category: 'comms',
    name: 'Throw phone',
    kind: 'equipment',
    cost: 900,
    tags: ['throw_phone'],
    requiresNode: 'field_contact_kit',
    requiresCerts: ['crisis_negotiation'],
    description: 'Two-way line for a qualified negotiator.',
    wear: { perUse: 10, perDay: 0.1, unreliableBelow: 50, failAt: 20, serviceHours: 4, serviceCost: 120, restoreTo: 90 },
    range: { effective: 20, max: 35 },
  },
  thermal_imager: {
    id: 'thermal_imager',
    helpsWith: ["Heat observation through usable sight paths, with one battery per declared action."],
    counters: ["Walls and glass block most thermal observation. Heat does not identify a person."],
    category: 'intel',
    name: 'Thermal imager',
    kind: 'equipment',
    cost: 1500,
    tags: ['thermal'],
    supplies: [{ itemId: 'battery_pack', qty: 1 }],
    requiresNode: 'intel_thermal',
    description: THERMAL_DESCRIPTION,
    wear: { perUse: 5, perDay: 0.2, unreliableBelow: 50, failAt: 20, serviceHours: 6, serviceCost: 200, restoreTo: 90 },
    range: { effective: 40, max: 80 },
  },
  camera_drone: {
    id: 'camera_drone',
    helpsWith: ["A certified operator observes a declared area using one battery per action."],
    counters: ["Blocked openings, range and worn condition limit observation; no automatic whole-building reveal."],
    category: 'intel',
    name: 'Camera drone',
    kind: 'equipment',
    cost: 2200,
    tags: ['drone'],
    supplies: [{ itemId: 'battery_pack', qty: 1 }],
    requiresNode: 'intel_drone',
    requiresCerts: ['drone_operator'],
    description: 'Indoor survey by a certified operator. Uses a battery pack.',
    wear: { perUse: 12, perDay: 0.1, unreliableBelow: 55, failAt: 25, serviceHours: 8, serviceCost: 260, restoreTo: 88 },
    range: { effective: 150, max: 300 },
  },
  ballistic_shield: {
    id: 'ballistic_shield',
    helpsWith: ["Helps authored protected actions, including confined-space support."],
    counters: ["Bulk and constrained capacity matter. Protection never provides immunity."],
    category: 'protection',
    name: 'Ballistic shield',
    kind: 'equipment',
    cost: 1200,
    tags: ['shield'],
    description: 'Reduces exposure for the lead officer in narrow spaces.',
    wear: { perUse: 4, perDay: 0.02, unreliableBelow: 40, failAt: 10, serviceHours: 4, serviceCost: 80, restoreTo: 95 },
  },
  door_ram: {
    id: 'door_ram',
    helpsWith: ["Reduces the time spent opening locked doors along a reachable route."],
    counters: ["Cannot bypass blocked openings, walls or inaccessible routes. It does not improve routine contact."],
    category: 'access',
    name: 'Door ram',
    kind: 'equipment',
    cost: 300,
    tags: ['entry_tool'],
    description: 'Opens a locked door quickly. Noisy.',
    wear: { perUse: 3, perDay: 0.01, unreliableBelow: 30, failAt: 5, serviceHours: 1, serviceCost: 20, restoreTo: 98 },
  },
  trauma_kit: {
    id: 'trauma_kit',
    helpsWith: ["One exact unit for a qualified stabilization action."],
    counters: ["First find and reach the patient. Consumed supplies cannot be serviced or reused."],
    category: 'medical',
    name: 'Trauma kit',
    kind: 'consumable',
    cost: 120,
    tags: ['medkit'],
    requiresCerts: ['advanced_first_aid'],
    description: 'Consumed when used for stabilisation.',
    wear: { perUse: 100, perDay: 0, unreliableBelow: 0, failAt: 0, serviceHours: 0, serviceCost: 0, restoreTo: 0, shelfLifeDays: 540 },
  },
  battery_pack: {
    id: 'battery_pack',
    helpsWith: ["One exact unit powers a declared thermal, camera or relay action."],
    counters: ["No passive score bonus. Expired batteries cannot be used or serviced."],
    category: 'supplies',
    name: 'Battery pack',
    kind: 'consumable',
    cost: 40,
    tags: ['battery'],
    description: 'Consumed by thermal and drone use.',
    wear: { perUse: 100, perDay: 0.4, unreliableBelow: 50, failAt: 20, serviceHours: 0, serviceCost: 0, restoreTo: 0, shelfLifeDays: 365 },
  },
  observation_binoculars: {
    "id": "observation_binoculars",
    "name": "Observation binoculars",
    "category": "intel",
    "kind": "equipment",
    "cost": 350,
    "tags": [
        "binoculars"
    ],
    "description": "A clear exterior view in daylight adds 4 observation points.",
    "helpsWith": [
        "A clear exterior view in daylight adds 4 observation points."
    ],
    "counters": [
        "Opaque barriers and darkness give no benefit."
    ],
    "wear": {
        "perUse": 3,
        "perDay": 0.05,
        "unreliableBelow": 40,
        "failAt": 10,
        "serviceHours": 2,
        "serviceCost": 60,
        "restoreTo": 95
    },
    "capabilities": [
        "visible_exterior"
    ]
},
  inspection_camera: {
    "id": "inspection_camera",
    "name": "Inspection camera",
    "category": "intel",
    "kind": "equipment",
    "cost": 1100,
    "tags": [
        "inspection_camera"
    ],
    "description": "A qualified operator inspects one accessible opening for +6 observation.",
    "helpsWith": [
        "A qualified operator inspects one accessible opening for +6 observation."
    ],
    "counters": [
        "No sealed-wall view or whole-building reveal."
    ],
    "wear": {
        "perUse": 6,
        "perDay": 0.15,
        "unreliableBelow": 40,
        "failAt": 10,
        "serviceHours": 4,
        "serviceCost": 150,
        "restoreTo": 92
    },
    "requiresNode": "intel_thermal",
    "requiresCerts": [
        "drone_operator"
    ],
    "capabilities": [
        "opening_inspection"
    ],
    "supplies": [
        {
            "itemId": "battery_pack",
            "qty": 1
        }
    ]
},
  portable_light: {
    "id": "portable_light",
    "name": "Portable scene light",
    "category": "intel",
    "kind": "equipment",
    "cost": 450,
    "tags": [
        "scene_light"
    ],
    "description": "Cancels up to 5 existing darkness penalty points on a visible scene.",
    "helpsWith": [
        "Cancels up to 5 existing darkness penalty points on a visible scene."
    ],
    "counters": [
        "No daylight benefit or illumination through opaque surfaces."
    ],
    "wear": {
        "perUse": 3,
        "perDay": 0.05,
        "unreliableBelow": 40,
        "failAt": 10,
        "serviceHours": 2,
        "serviceCost": 60,
        "restoreTo": 95
    },
    "capabilities": [
        "dark_visible_scene"
    ]
},
  radio_relay: {
    "id": "radio_relay",
    "name": "Portable radio relay",
    "category": "comms",
    "kind": "equipment",
    "cost": 1800,
    "tags": [
        "radio_relay"
    ],
    "description": "Recovers up to 5 lost coordination points on a weak radio link.",
    "helpsWith": [
        "Recovers up to 5 lost coordination points on a weak radio link."
    ],
    "counters": [
        "Needs working headsets on both squads; never exceeds clear-link baseline."
    ],
    "wear": {
        "perUse": 6,
        "perDay": 0.15,
        "unreliableBelow": 40,
        "failAt": 10,
        "serviceHours": 4,
        "serviceCost": 150,
        "restoreTo": 92
    },
    "requiresNode": "logistics_field_support",
    "capabilities": [
        "weak_radio_link"
    ],
    "supplies": [
        {
            "itemId": "battery_pack",
            "qty": 1
        }
    ]
},
  light_protection: {
    "id": "light_protection",
    "name": "Light protective kit",
    "category": "protection",
    "kind": "equipment",
    "cost": 650,
    "tags": [
        "light_protection"
    ],
    "description": "Adds 4 on declared protective-response work, with low bulk.",
    "helpsWith": [
        "Adds 4 on declared protective-response work, with low bulk."
    ],
    "counters": [
        "No contact or medical bonus; protective kits do not stack."
    ],
    "wear": {
        "perUse": 4,
        "perDay": 0.05,
        "unreliableBelow": 40,
        "failAt": 10,
        "serviceHours": 4,
        "serviceCost": 100,
        "restoreTo": 95
    },
    "requiresNode": "field_response_program",
    "capabilities": [
        "authorized_response"
    ]
},
  rescue_shield: {
    "id": "rescue_shield",
    "name": "Rescue shield",
    "category": "protection",
    "kind": "equipment",
    "cost": 900,
    "tags": [
        "rescue_shield"
    ],
    "description": "Adds 5 during exposed patient assistance led by a qualified medical officer.",
    "helpsWith": [
        "Adds 5 during exposed patient assistance led by a qualified medical officer."
    ],
    "counters": [
        "Bulk costs a game minute in constrained space; no routine contact bonus."
    ],
    "wear": {
        "perUse": 4,
        "perDay": 0.05,
        "unreliableBelow": 40,
        "failAt": 10,
        "serviceHours": 4,
        "serviceCost": 100,
        "restoreTo": 95
    },
    "requiresNode": "wellbeing_first_aid",
    "requiresCerts": [
        "advanced_first_aid"
    ],
    "capabilities": [
        "medical_exposure"
    ]
},
  service_sidearm: {
    "id": "service_sidearm",
    "name": "Service sidearm class",
    "category": "response",
    "kind": "equipment",
    "cost": 500,
    "tags": [
        "response_sidearm"
    ],
    "description": "Adds 3 on scenario-declared protective containment.",
    "helpsWith": [
        "Adds 3 on scenario-declared protective containment."
    ],
    "counters": [
        "No routine-call or contact bonus; one best response class applies."
    ],
    "wear": {
        "perUse": 5,
        "perDay": 0.05,
        "unreliableBelow": 40,
        "failAt": 10,
        "serviceHours": 3,
        "serviceCost": 90,
        "restoreTo": 95
    },
    "requiresNode": "field_response_program",
    "requiresCerts": [
        "entry_team"
    ],
    "capabilities": [
        "authorized_response"
    ]
},
  compact_carbine: {
    "id": "compact_carbine",
    "name": "Compact carbine class",
    "category": "response",
    "kind": "equipment",
    "cost": 1300,
    "tags": [
        "response_carbine"
    ],
    "description": "Adds 6 on declared high-risk containment, with one extra game minute of workload.",
    "helpsWith": [
        "Adds 6 on declared high-risk containment, with one extra game minute of workload."
    ],
    "counters": [
        "No routine-call advantage; one best response class applies."
    ],
    "wear": {
        "perUse": 5,
        "perDay": 0.05,
        "unreliableBelow": 40,
        "failAt": 10,
        "serviceHours": 3,
        "serviceCost": 90,
        "restoreTo": 95
    },
    "requiresNode": "field_response_program",
    "requiresCerts": [
        "entry_team"
    ],
    "capabilities": [
        "authorized_response"
    ]
},
  response_shotgun: {
    "id": "response_shotgun",
    "name": "Response shotgun class",
    "category": "response",
    "kind": "equipment",
    "cost": 1000,
    "tags": [
        "response_shotgun"
    ],
    "description": "Adds 5 in authored constrained response, or 2 in an open scene; one extra game minute.",
    "helpsWith": [
        "Adds 5 in authored constrained response, or 2 in an open scene; one extra game minute."
    ],
    "counters": [
        "No door-opening or alternate-payload mechanic; one best class applies."
    ],
    "wear": {
        "perUse": 5,
        "perDay": 0.05,
        "unreliableBelow": 40,
        "failAt": 10,
        "serviceHours": 3,
        "serviceCost": 90,
        "restoreTo": 95
    },
    "requiresNode": "field_response_program",
    "requiresCerts": [
        "entry_team"
    ],
    "capabilities": [
        "authorized_response"
    ]
},
  precision_support: {
    "id": "precision_support",
    "name": "Precision support rifle class",
    "category": "response",
    "kind": "equipment",
    "cost": 2600,
    "tags": [
        "precision_support"
    ],
    "description": "Adds 7 to a declared specialist support role with a clear view and separate supporting squad.",
    "helpsWith": [
        "Adds 7 to a declared specialist support role with a clear view and separate supporting squad."
    ],
    "counters": [
        "No concealed-target reveal; two game minutes of setup."
    ],
    "wear": {
        "perUse": 5,
        "perDay": 0.05,
        "unreliableBelow": 40,
        "failAt": 10,
        "serviceHours": 3,
        "serviceCost": 90,
        "restoreTo": 95
    },
    "requiresNode": "field_specialist_response",
    "requiresCerts": [
        "precision_support"
    ],
    "capabilities": [
        "specialist_support"
    ]
},
  conducted_energy_device: {
    "id": "conducted_energy_device",
    "name": "Conducted-energy device class",
    "category": "less_lethal",
    "kind": "equipment",
    "cost": 850,
    "tags": [
        "energy_device"
    ],
    "description": "Enables an authored intervention with one compatible cartridge; adds 4.",
    "helpsWith": [
        "Enables an authored intervention with one compatible cartridge; adds 4."
    ],
    "counters": [
        "Subject and adjacent-area uncertainty block use; adverse outcomes can injure."
    ],
    "wear": {
        "perUse": 5,
        "perDay": 0.05,
        "unreliableBelow": 40,
        "failAt": 10,
        "serviceHours": 3,
        "serviceCost": 90,
        "restoreTo": 95
    },
    "requiresNode": "field_less_lethal",
    "requiresCerts": [
        "less_lethal"
    ],
    "capabilities": [
        "less_lethal_device"
    ],
    "supplies": [
        {
            "itemId": "energy_cartridge",
            "qty": 1
        }
    ],
    "aliases": [
        "CED",
        "less lethal"
    ]
},
  impact_launcher: {
    "id": "impact_launcher",
    "name": "Less-lethal impact launcher class",
    "category": "less_lethal",
    "kind": "equipment",
    "cost": 1450,
    "tags": [
        "impact_launcher"
    ],
    "description": "Enables an authored alternative intervention for +5 and one game minute of setup.",
    "helpsWith": [
        "Enables an authored alternative intervention for +5 and one game minute of setup."
    ],
    "counters": [
        "Needs its own supply; uncertainty blocks use and injury remains possible."
    ],
    "wear": {
        "perUse": 5,
        "perDay": 0.05,
        "unreliableBelow": 40,
        "failAt": 10,
        "serviceHours": 3,
        "serviceCost": 90,
        "restoreTo": 95
    },
    "requiresNode": "field_less_lethal",
    "requiresCerts": [
        "advanced_less_lethal"
    ],
    "capabilities": [
        "less_lethal_impact"
    ],
    "supplies": [
        {
            "itemId": "impact_supply",
            "qty": 1
        }
    ]
},
  energy_cartridge: {
    "id": "energy_cartridge",
    "name": "Device cartridge",
    "category": "supplies",
    "kind": "consumable",
    "cost": 60,
    "tags": [
        "energy_cartridge"
    ],
    "description": "One exact stock unit per committed compatible device intervention.",
    "helpsWith": [
        "One exact stock unit per committed compatible device intervention."
    ],
    "counters": [
        "Cannot substitute for impact supply or be serviced."
    ],
    "wear": {
        "perUse": 100,
        "perDay": 0,
        "unreliableBelow": 0,
        "failAt": 0,
        "serviceHours": 0,
        "serviceCost": 0,
        "restoreTo": 0,
        "shelfLifeDays": 365
    },
    "requiresNode": "field_less_lethal"
},
  impact_supply: {
    "id": "impact_supply",
    "name": "Impact supply unit",
    "category": "supplies",
    "kind": "consumable",
    "cost": 75,
    "tags": [
        "impact_supply"
    ],
    "description": "One abstract supply unit per committed compatible impact intervention.",
    "helpsWith": [
        "One abstract supply unit per committed compatible impact intervention."
    ],
    "counters": [
        "Cannot substitute for device cartridges or be serviced."
    ],
    "wear": {
        "perUse": 100,
        "perDay": 0,
        "unreliableBelow": 0,
        "failAt": 0,
        "serviceHours": 0,
        "serviceCost": 0,
        "restoreTo": 0,
        "shelfLifeDays": 365
    },
    "requiresNode": "field_less_lethal"
},
  support_van: {
    "id": "support_van",
    "name": "Support van",
    "category": "vehicles",
    "kind": "equipment",
    "cost": 6500,
    "tags": [
        "support_van"
    ],
    "description": "In the explicit exterior support slot, reduces staged stores delivery from 3 to 2 game minutes.",
    "helpsWith": [
        "In the explicit exterior support slot, reduces staged stores delivery from 3 to 2 game minutes."
    ],
    "counters": [
        "No interior score bonus; one support vehicle per operation."
    ],
    "wear": {
        "perUse": 7,
        "perDay": 0.1,
        "unreliableBelow": 40,
        "failAt": 10,
        "serviceHours": 8,
        "serviceCost": 600,
        "restoreTo": 90
    },
    "requiresNode": "logistics_field_support",
    "requiresCerts": [
        "vehicle_operations"
    ],
    "supportOnly": true
},
  armored_rescue_vehicle: {
    "id": "armored_rescue_vehicle",
    "name": "Armored rescue vehicle",
    "category": "vehicles",
    "kind": "equipment",
    "cost": 18000,
    "tags": [
        "armored_rescue"
    ],
    "description": "Adds 8 to declared exterior protected evacuation; three game minutes of setup.",
    "helpsWith": [
        "Adds 8 to declared exterior protected evacuation; three game minutes of setup."
    ],
    "counters": [
        "Needs accessible exterior staging; no interior or upper-floor immunity."
    ],
    "wear": {
        "perUse": 7,
        "perDay": 0.1,
        "unreliableBelow": 40,
        "failAt": 10,
        "serviceHours": 8,
        "serviceCost": 1500,
        "restoreTo": 90
    },
    "requiresNode": "logistics_armored_support",
    "requiresCerts": [
        "vehicle_operations"
    ],
    "capabilities": [
        "vehicle_exterior"
    ],
    "supportOnly": true,
    "aliases": [
        "BearCat-style",
        "armored vehicle",
        "armoured rescue"
    ]
},
  command_van: {
    "id": "command_van",
    "name": "Mobile command van",
    "category": "vehicles",
    "kind": "equipment",
    "cost": 11000,
    "tags": [
        "command_van"
    ],
    "description": "Adds 5 on authored exterior coordination with two or more squads; two game minutes of setup.",
    "helpsWith": [
        "Adds 5 on authored exterior coordination with two or more squads; two game minutes of setup."
    ],
    "counters": [
        "No solo benefit or hidden-fact reveal; one support vehicle per operation."
    ],
    "wear": {
        "perUse": 7,
        "perDay": 0.1,
        "unreliableBelow": 40,
        "failAt": 10,
        "serviceHours": 8,
        "serviceCost": 900,
        "restoreTo": 90
    },
    "requiresNode": "logistics_field_support",
    "requiresCerts": [
        "vehicle_operations"
    ],
    "capabilities": [
        "scene_coordination"
    ],
    "supportOnly": true
},
  rescue_spreader: {
    "id": "rescue_spreader",
    "name": "Hydraulic rescue tool",
    "category": "access",
    "kind": "equipment",
    "cost": 1900,
    "tags": [
        "rescue_tool"
    ],
    "description": "Adds 5 to qualified, scenario-declared mechanical access on ordinary or steel doors; slower setup and lower pressure.",
    "helpsWith": [
        "Adds 5 to qualified, scenario-declared mechanical access on ordinary or steel doors; slower setup and lower pressure."
    ],
    "counters": [
        "No wall, glazing, floor or blocked-route shortcut."
    ],
    "wear": {
        "perUse": 6,
        "perDay": 0.15,
        "unreliableBelow": 40,
        "failAt": 10,
        "serviceHours": 4,
        "serviceCost": 150,
        "restoreTo": 92
    },
    "requiresNode": "field_controlled_access",
    "requiresCerts": [
        "controlled_access"
    ],
    "capabilities": [
        "permitted_door_access"
    ]
},
  door_charge: {
    "id": "door_charge",
    "name": "Abstract door charge",
    "category": "access",
    "kind": "consumable",
    "cost": 350,
    "tags": [
        "door_charge"
    ],
    "description": "One fictional access token: quicker authored ordinary-door resolution, but +8 pressure and greater collateral risk.",
    "helpsWith": [
        "One fictional access token: quicker authored ordinary-door resolution, but +8 pressure and greater collateral risk."
    ],
    "counters": [
        "Adjacent-area safety must be known; no reinforced-door or wall bypass."
    ],
    "wear": {
        "perUse": 100,
        "perDay": 0,
        "unreliableBelow": 0,
        "failAt": 0,
        "serviceHours": 0,
        "serviceCost": 0,
        "restoreTo": 0,
        "shelfLifeDays": 365
    },
    "requiresNode": "field_controlled_access",
    "requiresCerts": [
        "controlled_access"
    ],
    "capabilities": [
        "permitted_door_access"
    ],
    "aliases": [
        "breaching",
        "fictional charge"
    ]
},
};
