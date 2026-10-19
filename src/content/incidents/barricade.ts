import { BARRICADE_BOXES as tree } from '../call-trees/barricade-boxes';
import type { Clock, IncidentTemplate, SituationModel } from './types';

// Everything Goes Back as data (docs/calls/barricade-design.md). A barricade: the subject holds
// nobody. A mover is hiding in a bedroom, and whether the subject knows is the first hidden truth;
// whether the subject walks out once the list of the parent's things is taken down is the second.
// What the subject wants, nothing else carried out, is never concedable; the list is.
//
// Nothing public differs by situation (design row L): the subject's volatility and the demand are
// drawn the same way in all three, and the boxes clock runs at one rate everywhere.

/** The subject carrying boxes back in, room by room, toward the mover's door. The cue moves the
 * subject to that door where the team can see it; running out sends the call to `found`. */
const BOXES: Clock = {
  id: 'boxes', label: 'Boxes going back in', kind: 'deadline', owner: 'mover', start: 60, ratePerMin: 1, rateSpread: 0.3, rateKnown: false,
  cues: [{ at: 45, text: 'Through the side window, the team sees {subject.first} set a box down outside the {mover.room} door.', mark: 'in_hall',
    moveTo: { subject: { to: { doorOf: 'mover' }, seen: true } } }],
  onOut: { next: { node: 'found' } },
};

const DEMANDS = [
  { kind: 'person' as const, text: 'Nothing else carried out of the house', concedable: false },
  { kind: 'statement' as const, text: 'A list of the things {subject.he} {subject~wants|want} kept, passed to {sibling.first}', concedable: true },
];

export const BARRICADE_TEMPLATE: IncidentTemplate = {
  type: 'barricaded',
  label: 'Protective response',
  tree,
  cast: [
    { id: 'subjects', kind: 'subject', count: { min: 1, max: 1 }, keyRoles: ['subject'], person: {
      label: 'the late owner’s {subject^son|daughter|child}', age: 'adult', activity: 'barricaded',
      threat: { disposition: 'agitated', intent: 'barricade', awareness: 'aware', readiness: 'carried' },
      weapons: [{ kind: 'long_gun', real: 'real', where: 'in_hand', visible: true }],
      // The parent's hunting piece: some practice is likely. The self-harm screen applies (E4.5).
      proficiency: { pick: [['untrained', 35], ['some', 50], ['trained', 15]] }, noDeathOnCard: true,
      volatility: { pick: [['steady', 40], ['shifting', 40], ['volatile', 20]] },
      demands: DEMANDS,
      meters: { agitation: 65, rapport: 5, fatigue: 15, intoxication: 0, resolve: 60 },
      knowledge: {
        presence: { status: 'confirmed', source: 'Responding patrol' },
        weapons: { status: 'reported', source: 'Responding patrol', value: 'a long weapon', learnedBy: 'f_weapon' },
        demands: { status: 'reported', source: 'The crew’s driver', value: 'nothing else carried out' },
      },
    } },
    { id: 'trapped', kind: 'trapped', count: { min: 1, max: 1 }, keyRoles: ['mover'], person: {
      label: 'the mover in the bedroom', age: 'adult', meters: { condition: 100, composure: 45 },
      knowledge: {
        presence: { status: 'reported', source: 'The crew’s driver', value: 'in a bedroom closet' },
        awareness: { status: 'unknown', source: 'Nobody yet', learnedBy: 'f_knows_mover' },
      },
    } },
    { id: 'reporting', kind: 'reporting_party', count: { min: 1, max: 1 }, keyRoles: ['sibling'], person: {
      label: 'the sibling who sold the house', age: 'adult', relationshipToSubject: 'family',
      knowledge: { presence: { status: 'confirmed', source: 'With patrol' } },
    } },
  ],
  conditions: { timeOfDay: 'dusk', power: 'on', weather: 'clear', crowd: 1 },
  situations: ([
    { index: 0, people: { mover: { subjectAware: false } } },
    { index: 1, people: { mover: { subjectAware: true } } },
    { index: 2, people: { mover: { subjectAware: true } } },
  ] satisfies SituationModel[]).map((situation): SituationModel => ({ ...situation, clocks: [BOXES] })),
  complications: [],
};
