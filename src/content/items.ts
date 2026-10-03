import { THERMAL_DESCRIPTION } from './capabilities';
import type { ItemDefinition } from '../sim/types';

// Abstract game equipment. Tags are what actions require; names are flavour.
// Wear and range values are proposed tuning. Each physical unit wears on its own.
export const ITEMS: Record<string, ItemDefinition> = {
  radio_kit: {
    id: 'radio_kit',
    helpsWith: ["Each deployed officer needs a working headset for squad coordination."],
    counters: ["Walls, floors, distance and worn equipment weaken the connection. Extra radios do not add another bonus."],
    category: 'comms',
    name: 'Radio headset',
    kind: 'equipment',
    cost: 400,
    tags: ['comms_kit'],
    description: "Keeps officers and squads in contact during a call.",
    wear: { perUse: 6, perDay: 0.15, unreliableBelow: 45, failAt: 15, serviceHours: 3, serviceCost: 60, restoreTo: 92 },
    range: { effective: 600, max: 1500 },
  },
  loud_hailer: {
    id: 'loud_hailer',
    helpsWith: ["Makes announcements on calls that offer this contact option, without needing a negotiator."],
    counters: ["Noise and walls make it harder to hear. It cannot provide private two-way contact or confirm whether anyone is inside."],
    category: 'comms',
    name: 'Loud hailer',
    kind: 'equipment',
    cost: 250,
    tags: ['hailer'],
    description: "Lets officers speak to people inside from outside the building.",
    wear: { perUse: 3, perDay: 0.05, unreliableBelow: 40, failAt: 10, serviceHours: 2, serviceCost: 30, restoreTo: 95 },
    range: { effective: 60, max: 120 },
  },
  throw_phone: {
    id: 'throw_phone',
    helpsWith: ["Supports two-way contact when the call offers a phone option."],
    counters: ["Needs a usable connection and an officer trained in crisis negotiation. It never guarantees cooperation."],
    category: 'comms',
    name: 'Throw phone',
    kind: 'equipment',
    cost: 900,
    tags: ['throw_phone'],
    requiresNode: 'field_contact_kit',
    requiresCerts: ['crisis_negotiation'],
    description: "Lets a trained negotiator have a two-way conversation with someone inside.",
    wear: { perUse: 10, perDay: 0.1, unreliableBelow: 50, failAt: 20, serviceHours: 4, serviceCost: 120, restoreTo: 90 },
    range: { effective: 20, max: 35 },
  },
  thermal_imager: {
    id: 'thermal_imager',
    helpsWith: ["Shows heat where the camera has a clear view. Power is included."],
    counters: ["Walls and glass block most heat readings. A heat reading cannot identify a person."],
    category: 'intel',
    name: 'Thermal imager',
    kind: 'equipment',
    cost: 1500,
    tags: ['thermal'],
    requiresNode: 'intel_thermal',
    description: THERMAL_DESCRIPTION,
    wear: { perUse: 5, perDay: 0.2, unreliableBelow: 50, failAt: 20, serviceHours: 6, serviceCost: 200, restoreTo: 90 },
    range: { effective: 40, max: 80 },
  },
  camera_drone: {
    id: 'camera_drone',
    helpsWith: ["Checks the area covered by the selected camera option."],
    counters: ["Blocked openings, distance and worn equipment limit the view. It cannot reveal the whole building at once."],
    category: 'intel',
    name: 'Camera drone',
    kind: 'equipment',
    cost: 2200,
    tags: ['drone'],
    requiresNode: 'intel_drone',
    requiresCerts: ['drone_operator'],
    description: "Lets a trained drone operator look around part of a building. Power is included.",
    wear: { perUse: 12, perDay: 0.1, unreliableBelow: 55, failAt: 25, serviceHours: 8, serviceCost: 260, restoreTo: 88 },
    range: { effective: 150, max: 300 },
  },
  ballistic_shield: {
    id: 'ballistic_shield',
    helpsWith: ["Adds protection in supported actions, including work in tight spaces."],
    counters: ["Its bulk makes tight spaces harder to work in. It never makes an officer immune to harm."],
    category: 'protection',
    name: 'Ballistic shield',
    kind: 'equipment',
    cost: 1200,
    tags: ['shield'],
    description: "Helps protect the lead officer during actions that allow shield support.",
    wear: { perUse: 4, perDay: 0.02, unreliableBelow: 40, failAt: 10, serviceHours: 4, serviceCost: 80, restoreTo: 95 },
  },
  door_ram: {
    id: 'door_ram',
    helpsWith: ["Speeds up opening a locked door the squad can reach."],
    counters: ["Cannot get through walls, blocked openings or unreachable routes. It does not help routine conversations."],
    category: 'access',
    name: 'Door ram',
    kind: 'equipment',
    cost: 300,
    tags: ['entry_tool'],
    description: "Helps open locked doors more quickly, but makes noise.",
    wear: { perUse: 3, perDay: 0.01, unreliableBelow: 30, failAt: 5, serviceHours: 1, serviceCost: 20, restoreTo: 98 },
  },
  trauma_kit: {
    id: 'trauma_kit',
    helpsWith: ["Uses one kit when the officer gives first aid."],
    counters: ["The officer must find and reach the patient first. A used kit cannot be repaired or reused."],
    category: 'medical',
    name: 'Trauma kit',
    kind: 'consumable',
    cost: 120,
    tags: ['medkit'],
    requiresCerts: ['advanced_first_aid'],
    description: "Supplies for an officer trained in advanced first aid to help an injured person.",
    wear: { perUse: 100, perDay: 0, unreliableBelow: 0, failAt: 0, serviceHours: 0, serviceCost: 0, restoreTo: 0, shelfLifeDays: 540 },
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
    "description": "Helps officers get a clearer view of the scene from outside in daylight.",
    "helpsWith": ["Useful when the squad has a clear view of the area it is checking.", "Game bonus: +4 to the observation score."],
    "counters": ["Cannot see through solid barriers and gives no bonus in darkness."],
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
    "description": "Lets a trained camera operator check the area beyond an open doorway.",
    "helpsWith": ["Shows the nearby area through an opening the officer can reach.", "Game bonus: +6 to the observation score."],
    "counters": ["Requires the drone operator qualification. Cannot see through sealed or blocked openings, or reveal the whole building."],
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
    "description": "Helps officers see a dark area more clearly.",
    "helpsWith": ["Reduces the disadvantage from darkness when the area is in view.", "Game bonus: removes up to 5 points of the darkness penalty."],
    "counters": ["Gives no bonus in daylight and cannot shine through solid barriers."],
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
    "description": "Helps squads stay in touch when their radio connection is weak.",
    "helpsWith": ["Improves an existing weak connection between squads.", "Game bonus: restores up to 5 lost coordination points."],
    "counters": ["Both squads still need working headsets. It cannot improve a connection beyond a normal clear signal."],
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
    "description": "Lightweight protection for calls that include a protective response.",
    "helpsWith": ["Helps protect officers during the available protective response option.", "Game bonus: +4 to that action score."],
    "counters": ["Gives no bonus to conversation or first aid. Only the strongest suitable protective kit counts; extra kits do not add bonuses."],
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
    "description": "Helps protect an officer giving first aid in an exposed area.",
    "helpsWith": ["Requires an officer trained in advanced first aid.", "Game bonus: +5 to the first-aid action score."],
    "counters": ["Adds 1 minute in tight spaces. Gives no bonus to routine conversations."],
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
    "name": "Service sidearm",
    "category": "response",
    "kind": "equipment",
    "cost": 500,
    "tags": [
        "response_sidearm"
    ],
    "description": "Supports trained officers on calls that include a protective response.",
    "helpsWith": ["Requires an officer trained for entry team duty and a suitable response option.", "Game bonus: +3 to that action score."],
    "counters": ["Gives no bonus on routine calls or during conversations. Only the best suitable response weapon counts; extra weapons do not add bonuses."],
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
    "name": "Compact carbine",
    "category": "response",
    "kind": "equipment",
    "cost": 1300,
    "tags": [
        "response_carbine"
    ],
    "description": "Supports trained officers on high-risk calls that include a protective response.",
    "helpsWith": ["Requires an officer trained for entry team duty and a suitable response option.", "Game bonus: +6 to that action score."],
    "counters": ["Adds 1 minute to the action. Gives no bonus on routine calls. Only the best suitable response weapon counts."],
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
    "name": "Response shotgun",
    "category": "response",
    "kind": "equipment",
    "cost": 1000,
    "tags": [
        "response_shotgun"
    ],
    "description": "Supports trained officers when a call offers a protective response, with a larger game bonus in tight spaces.",
    "helpsWith": ["Requires an officer trained for entry team duty.", "Game bonus: +5 to the response action score in tight spaces, or +2 in an open area."],
    "counters": ["Adds 1 minute. Cannot open doors or use other ammunition types in this game. Only the best suitable response weapon counts."],
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
    "name": "Precision support rifle",
    "category": "response",
    "kind": "equipment",
    "cost": 2600,
    "tags": [
        "precision_support"
    ],
    "description": "Supports a trained specialist when the call offers a specialist response and another squad can help.",
    "helpsWith": ["Requires a clear view, a specialist-qualified officer and a separate supporting squad.", "Game bonus: +7 to the specialist action score."],
    "counters": ["Adds 2 minutes to set up. Cannot reveal hidden people, and details about the person involved must be checked before use."],
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
    "name": "Conducted-energy device",
    "category": "less_lethal",
    "kind": "equipment",
    "cost": 850,
    "tags": [
        "energy_device"
    ],
    "description": "Offers a less-lethal response when the call allows it. Requires a trained officer and a matching cartridge.",
    "helpsWith": ["Uses one device cartridge each time the action is taken.", "Game bonus: +4 to that action score."],
    "counters": ["Requires less-lethal training and a clear view. Cannot be used until the person and safety of the nearby area are checked. Injury is still possible."],
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
    "name": "Less-lethal impact launcher",
    "category": "less_lethal",
    "kind": "equipment",
    "cost": 1450,
    "tags": [
        "impact_launcher"
    ],
    "description": "Offers another less-lethal response when the call allows it. Requires advanced training and matching launcher supplies.",
    "helpsWith": ["Uses one launcher supply each time the action is taken.", "Game bonus: +5 to that action score."],
    "counters": ["Requires advanced less-lethal training and a clear view. Adds 1 minute to set up. Cannot be used until the person and safety of the nearby area are checked. Injury is still possible."],
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
    "description": "A single-use cartridge for the conducted-energy device.",
    "helpsWith": ["One cartridge is used each time an officer takes the matching device action."],
    "counters": ["Does not work with the impact launcher. Used cartridges cannot be repaired or reused."],
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
    "name": "Launcher supply",
    "category": "supplies",
    "kind": "consumable",
    "cost": 75,
    "tags": [
        "impact_supply"
    ],
    "description": "Single-use supplies for the less-lethal impact launcher.",
    "helpsWith": ["One supply is used each time an officer takes the matching launcher action."],
    "counters": ["Does not work with the conducted-energy device. Used supplies cannot be repaired or reused."],
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
    "description": "Brings requested supplies to squads more quickly during a call.",
    "helpsWith": ["Use the operation support slot to send the van with a trained vehicle operator.", "Cuts supply delivery from 3 minutes to 2."],
    "counters": ["Works from outside and gives no bonus to actions inside. Only one support vehicle can join an operation."],
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
    "description": "Helps protect people being moved to safety outside a building.",
    "helpsWith": ["Requires a trained vehicle operator, a suitable rescue option and an outside area the vehicle can reach.", "Game bonus: +8 to the outside evacuation action score."],
    "counters": ["Adds 3 minutes to set up. Gives no protection inside buildings or on upper floors. Only one support vehicle can join an operation."],
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
    "description": "Helps two or more squads work together from outside a building.",
    "helpsWith": ["Requires a trained vehicle operator and an outside coordination option the vehicle can reach.", "Game bonus: +5 to the coordination action score."],
    "counters": ["Adds 2 minutes to set up. Gives no bonus to a lone squad and cannot reveal hidden information. Only one support vehicle can join an operation."],
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
    "description": "A reusable tool that helps trained officers open ordinary or steel doors when that entry option is available.",
    "helpsWith": ["Requires controlled-access training. Opening the door takes longer but creates less pressure than a door charge.", "Game bonus: +5 to the entry action score, with 2 extra minutes to set up."],
    "counters": ["Cannot get through walls, glass, floors or blocked routes."],
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
    "name": "Door charge",
    "category": "access",
    "kind": "consumable",
    "cost": 350,
    "tags": [
        "door_charge"
    ],
    "description": "A single-use door charge for supported entry options. Opens some ordinary doors faster, but increases pressure and the risk of harm.",
    "helpsWith": ["Requires controlled-access training and a suitable ordinary door.", "Game effect: +5 to the entry action score, 1 minute faster and +8 pressure."],
    "counters": ["The nearby area must be checked first. Cannot get through reinforced doors, walls, glass, floors or blocked openings."],
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
