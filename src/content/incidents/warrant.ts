import { WARRANT_ROOM as tree } from '../call-trees/warrant';
import type { IncidentTemplate, PersonSpec, Weapon } from './types';

// The Room Next Door as data (design sheet: docs/calls/warrant-design.md). A warrant service on a
// crew lieutenant who won't open his door, with a parent and child asleep in the rooms beside his.
// The world sends it (worldOnly): the board never draws it at random. The world-calls lane casts the
// lead's subject into `lt` through IncidentSpec.cast; the template's own draw is only the fallback
// for the lab and the gates.
//
// No pressure source here: the pressure is the parent's alarm, the street waking up and the family
// a wall away, carried by each node's threat. A camera or a crowd would be a second call.

/** On the bed, in a jacket pocket, at his side: carried, not pointed, until a choice brings it out. */
const HANDGUN: Weapon = { kind: 'handgun', real: 'real', where: 'within_reach', visible: false };

/** The man on the warrant in every situation. */
const LT: Partial<PersonSpec> = {
  label: 'crew lieutenant',
  // A year on the corner, some range time with the crew: mostly some practice.
  proficiency: { pick: [['untrained', 35], ['some', 50], ['trained', 15]] },
  meters: { agitation: 45, rapport: 5, fatigue: 30, intoxication: 0, resolve: 60 },
  knowledge: {
    presence: { status: 'confirmed', source: 'Answered the knock' },
    weapons: { status: 'reported', source: 'The warrant', value: 'handgun', learnedBy: 'f_handgun' },
  },
};

export const WARRANT_TEMPLATE: IncidentTemplate = {
  type: 'barricaded',
  label: 'Warrant service',
  tree,
  worldOnly: true,
  cast: [
    { id: 'subjects', kind: 'subject', count: { min: 1, max: 1 }, keyRoles: ['lt'], person: {
      label: 'crew lieutenant', age: 'adult', activity: 'barricaded',
      threat: { disposition: 'agitated', intent: 'barricade', awareness: 'aware', readiness: 'carried' },
      record: { warrant: 'unknown', priorViolence: 'unknown' },
      // Force against him is spared (noFatal in the tree), so the card never shows his death.
      noDeathOnCard: true,
      knowledge: { presence: { status: 'confirmed', source: 'Answered the knock' } },
    } },
    { id: 'neighbor', kind: 'trapped', count: { min: 1, max: 1 }, keyRoles: ['parent'], person: {
      label: 'neighbor next door', age: 'adult', subjectAware: true, relationshipToSubject: 'neighbor', meters: { condition: 100, composure: 50 },
      knowledge: { presence: { status: 'reported', source: 'The landlord', value: 'asleep next door' } },
    } },
    { id: 'child', kind: 'trapped', count: { min: 1, max: 1 }, keyRoles: ['kid'], person: {
      label: 'child next door', age: 'child', identity: { years: { min: 8, max: 12 } }, subjectAware: true, relationshipToSubject: 'neighbor', meters: { condition: 100, composure: 40 },
      knowledge: { presence: { status: 'reported', source: 'The landlord', value: 'asleep next door' } },
    } },
    { id: 'reporting', kind: 'reporting_party', count: { min: 1, max: 1 }, keyRoles: ['landlord'], person: {
      label: 'landlord', age: 'adult', relationshipToSubject: 'acquaintance',
      knowledge: { presence: { status: 'confirmed', source: 'With patrol' } },
    } },
  ],
  conditions: { timeOfDay: 'night', power: 'on', weather: 'clear', crowd: 0 },
  situations: [
    // Leaving: armed, dressed, and going out through the family's window.
    { index: 0, people: { lt: { ...LT, weapons: [HANDGUN], volatility: { pick: [['steady', 40], ['shifting', 60]] },
      threat: { disposition: 'agitated', intent: 'escape', awareness: 'aware', readiness: 'carried' },
      demands: [{ kind: 'none', text: 'Ten minutes, to call {lt.his} grandmother', concedable: false }] } } },
    // The kid: unarmed, and won't be taken where the child next door can see.
    { index: 1, people: { lt: { ...LT, weapons: [], volatility: 'steady',
      threat: { disposition: 'distressed', intent: 'barricade', awareness: 'aware', readiness: 'carried' },
      demands: [{ kind: 'statement', text: 'For {kid.first} to be out of sight of the stairs', concedable: true }] } } },
    // Witnesses: armed, and will only walk out in daylight with the street watching.
    { index: 2, people: { lt: { ...LT, weapons: [HANDGUN], volatility: { pick: [['shifting', 60], ['volatile', 40]] },
      demands: [{ kind: 'statement', text: 'To walk out in daylight, with the street watching', concedable: true }] } } },
  ],
  complications: [],
};
