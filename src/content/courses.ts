import type { Course, Id } from '../sim/types';

/** Rating courses stop being offered once an officer's rating reaches this value. */
export const COURSE_RATING_CEILING = 85;

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
};
