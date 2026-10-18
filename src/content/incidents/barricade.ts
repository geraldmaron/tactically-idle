import { BARRICADE_ORDER as tree } from '../call-trees/barricade-order';
import type { IncidentTemplate, SituationModel } from './types';

// Behind the Bathroom Door as data. A barricade: he holds nobody; the son is trapped, hiding, and
// whether the subject knows he is there is the first hidden truth. What he wants (her, at the
// door) is never concedable: family never goes on the line.
export const BARRICADE_TEMPLATE: IncidentTemplate = {
  type: 'barricaded',
  label: 'Protective response',
  tree,
  cast: [
    { id: 'subjects', kind: 'subject', count: { min: 1, max: 1 }, keyRoles: ['subject'], person: {
      label: '{ex.his} ex-partner', age: 'adult', activity: 'barricaded',
      threat: { disposition: 'agitated', intent: 'barricade', awareness: 'aware', readiness: 'brandished' },
      weapons: [{ kind: 'long_gun', real: 'real', where: 'in_hand', visible: true }],
      record: { warrant: 'unknown', priorViolence: 'unknown', protectiveOrder: true },
      // A rifle owner: some practice is likely. The self-harm screen applies (E4.5).
      proficiency: { pick: [['untrained', 30], ['some', 50], ['trained', 20]] }, noDeathOnCard: true,
      demands: [{ kind: 'person', text: 'For {ex.first} to come to the door and talk to {subject.him}', concedable: false }],
      meters: { agitation: 70, rapport: 5, fatigue: 10, intoxication: 0, resolve: 60 },
      knowledge: {
        presence: { status: 'confirmed', source: 'Responding patrol' },
        weapons: { status: 'reported', source: 'Responding patrol', value: 'rifle', learnedBy: 'f_rifle' },
        record: { status: 'reported', source: 'Dispatch', value: 'protective order' },
        demands: { status: 'reported', source: 'Shouted at the window', value: 'to talk to {ex.him}' },
      },
    } },
    { id: 'trapped', kind: 'trapped', count: { min: 1, max: 1 }, keyRoles: ['child'], person: {
      label: 'the child in the bathroom', age: 'teen', identity: { years: { min: 9, max: 17 } }, relationshipToSubject: 'acquaintance', meters: { condition: 100, composure: 45 },
      knowledge: {
        presence: { status: 'reported', source: '{ex.first}, {child.his} {ex^father|mother|parent}', value: 'in the bathroom' },
        awareness: { status: 'unknown', source: 'Nobody yet', learnedBy: 'f_knows_son' },
      },
    } },
    { id: 'reporting', kind: 'reporting_party', count: { min: 1, max: 1 }, keyRoles: ['ex'], person: {
      label: 'the resident', age: 'adult', relationshipToSubject: 'former_partner',
      knowledge: { presence: { status: 'confirmed', source: 'With patrol' } },
    } },
  ],
  conditions: { timeOfDay: 'dusk', power: 'on', weather: 'clear', crowd: 1 },
  situations: ([
    { index: 0, people: { child: { subjectAware: false }, subject: { volatility: 'steady',
      demands: [{ kind: 'person', text: 'For {ex.first} to come to the door and talk to {subject.him}', concedable: false }, { kind: 'statement', text: 'A written message for {ex.first}, in the report', concedable: true }] } } },
    { index: 1, people: { child: { subjectAware: true }, subject: { volatility: 'shifting',
      demands: [{ kind: 'person', text: 'For {ex.first} to come to the door and talk to {subject.him}', concedable: false }, { kind: 'statement', text: 'A written message for {ex.first}, in the report', concedable: true }] } } },
    { index: 2, people: { child: { subjectAware: true }, subject: { volatility: 'volatile', threat: { disposition: 'hostile', intent: 'barricade', awareness: 'aware', readiness: 'brandished' } } } },
  // The phone battery: the tree's own outcomes still run it down (son_dark), so it stays a story
  // clock until those outcomes read it.
  ] satisfies SituationModel[]).map((situation): SituationModel => ({ ...situation, clocks: [{ id: 'son_phone', label: '{child.first}’s phone battery', kind: 'battery' as const, owner: 'child', start: 12, ratePerMin: 0.3, rateKnown: true, story: true,
    cues: [{ at: 2, text: '{child.first}’s last text says {child.his} battery is at 2 percent.' }] }] })),
  complications: [],
};
