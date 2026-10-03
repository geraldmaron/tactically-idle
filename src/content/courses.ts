import type { Course, Id } from '../sim/types';

/** Rating courses stop being offered once an officer's rating reaches this value. */
export const COURSE_RATING_CEILING = 85;

/** Completion retains the full authored gain; 85 is the enrolment cutoff, not a grant cap. */
export function courseRatingAfter(current: number, gain: number): number {
  return Math.min(100, current + gain);
}

/** Every completed course also contributes XP to the existing career growth system. */
export function courseXpGain(hours: number): number {
  return Math.round(hours * 5);
}

// Courses are offered by development nodes (requiresNode) or are always available
// (refreshers). Unlocking a node never qualifies anyone: the grant lands only when
// the course finishes (see economy.settle).
export const COURSES: Record<Id, Course> = {
  crisis_negotiation_course: {
    id: 'crisis_negotiation_course',
    name: 'Crisis negotiation',
    hours: 6,
    cost: 1500,
    requiresNode: 'personnel_negotiation',
    grants: { cert: 'crisis_negotiation' },
  },
  entry_course: {
    id: 'entry_course',
    name: 'Entry team qualification',
    hours: 8,
    cost: 1800,
    requiresNode: 'field_entry_course',
    grants: { cert: 'entry_team' },
  },
  drone_course: {
    id: 'drone_course',
    name: 'Drone operator licence',
    hours: 10,
    cost: 2200,
    requiresNode: 'intel_drone',
    grants: { cert: 'drone_operator' },
  },
  first_aid_course: {
    id: 'first_aid_course',
    name: 'Advanced first aid',
    hours: 6,
    cost: 1200,
    requiresNode: 'wellbeing_first_aid',
    grants: { cert: 'advanced_first_aid' },
  },
  composure_workshop: {
    id: 'composure_workshop',
    name: 'Composure workshop',
    hours: 4,
    cost: 600,
    grants: { rating: { key: 'composure', delta: 3 } },
  },
  communication_refresher: {
    id: 'communication_refresher',
    name: 'Communication refresher',
    hours: 4,
    cost: 600,
    grants: { rating: { key: 'communication', delta: 3 } },
  },
  range_qualification: {
    id: 'range_qualification',
    name: 'Range qualification',
    hours: 4,
    cost: 600,
    grants: { rating: { key: 'shooting', delta: 3 } },
  },
  less_lethal_course: {
    "id": "less_lethal_course",
    "name": "Less-lethal response",
    "hours": 6,
    "cost": 1200,
    "requiresNode": "field_less_lethal",
    "requiresCerts": [],
    "grants": {
        "cert": "less_lethal"
    }
},
  advanced_less_lethal_course: {
    "id": "advanced_less_lethal_course",
    "name": "Advanced less-lethal response",
    "hours": 8,
    "cost": 1700,
    "requiresNode": "field_less_lethal",
    "requiresCerts": [
        "less_lethal"
    ],
    "grants": {
        "cert": "advanced_less_lethal"
    }
},
  deescalation_course: {
    "id": "deescalation_course",
    "name": "De-escalation",
    "hours": 6,
    "cost": 1000,
    "requiresNode": "personnel_negotiation",
    "requiresCerts": [],
    "grants": {
        "cert": "deescalation"
    }
},
  vehicle_operations_course: {
    "id": "vehicle_operations_course",
    "name": "Support vehicle operations",
    "hours": 6,
    "cost": 1300,
    "requiresNode": "logistics_field_support",
    "requiresCerts": [],
    "grants": {
        "cert": "vehicle_operations"
    }
},
  precision_support_course: {
    "id": "precision_support_course",
    "name": "Precision support qualification",
    "hours": 10,
    "cost": 2200,
    "requiresNode": "field_specialist_response",
    "requiresCerts": [
        "entry_team"
    ],
    "grants": {
        "cert": "precision_support"
    }
},
  controlled_access_course: {
    "id": "controlled_access_course",
    "name": "Controlled access qualification",
    "hours": 8,
    "cost": 1800,
    "requiresNode": "field_controlled_access",
    "requiresCerts": [
        "entry_team"
    ],
    "grants": {
        "cert": "controlled_access"
    }
},
};
