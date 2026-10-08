import { HOSTAGE_SIGNATURE as tree } from '../call-trees/hostage-signature';
import type { IncidentTemplate, PersonSpec, Weapon } from './types';

// One Last Signature as data (design sheet: docs/calls/hostage-signature-design.md). The taker holds
// the owner because the grievance is with them (an expressive hold, so this is a victim incident),
// and the courier only because the courier was there (incidental). The demand is a written account,
// which command can give; in the third situation it is the owner's signature and nothing less, which
// nobody can.
//
// One to three people come in: the taker, and up to two coworkers from the last shift who came to
// back the taker's story (the counted group `others`). A lone taker stays the most common call.

const HANDGUN: Weapon = { kind: 'handgun', real: 'real', where: 'in_hand', visible: true };
/** Something heavy from behind the counter. Only the taker brought a handgun. */
const HEAVY: Weapon = { kind: 'blunt', real: 'real', where: 'in_hand', visible: true };

/** The taker in every situation: the handgun, the statement, and what patrol and the 911 call said. */
const TAKER: Partial<PersonSpec> = {
  label: 'former employee',
  weapons: [HANDGUN],
  // Six years behind a counter, not a range: mostly untrained.
  proficiency: { pick: [['untrained', 60], ['some', 32], ['trained', 8]] },
  demands: [{ kind: 'statement', text: 'A written account that {taker.he} took nothing from the till', concedable: true }],
  meters: { agitation: 60, rapport: 10, fatigue: 20, intoxication: 0, resolve: 60 },
  knowledge: {
    presence: { status: 'confirmed', source: 'Responding patrol' },
    weapons: { status: 'reported', source: 'Responding patrol', value: 'handgun', learnedBy: 'f_handgun' },
    demands: { status: 'reported', source: 'The 911 call', value: 'a statement clearing {taker.him}', learnedBy: 'f_lets_go' },
    disposition: { status: 'unknown', source: 'Nobody yet', learnedBy: 'f_raised' },
  },
};

/** The others: coworkers from the last shift, how tightly the taker holds them set per situation. No
 * demand of their own, and something heavy in hand or nothing. */
const OTHERS = (influence: { min: number; max: number }): Partial<PersonSpec> => ({
  label: 'coworker from the last shift',
  weapons: { pick: [[[], 60], [[HEAVY], 40]] },
  proficiency: 'untrained',
  volatility: 'shifting',
  demands: [],
  relationshipToSubject: 'coworker',
  threat: { disposition: 'distressed', intent: 'barricade', awareness: 'aware', readiness: 'carried' },
  meters: { agitation: 55, rapport: 10, fatigue: 20, intoxication: 0, resolve: 30 },
  knowledge: { presence: { status: 'reported', source: 'Responding patrol' } },
  group: { role: { pick: [['follower', 70], ['lookout', 30]] }, influence },
});

export const HOSTAGE_TEMPLATE: IncidentTemplate = {
  type: 'hostage_crisis',
  label: 'Hostage crisis',
  tree,
  cast: [
    // 1 to 3 people: a lone taker 55%, a pair 30%, three 15% (argued in the design sheet, row L).
    { id: 'subjects', kind: 'subject', count: { min: 1, max: 3, weights: [55, 30, 15] }, keyRoles: ['taker'], person: {
      label: 'former employee', age: 'adult', activity: 'holding',
      threat: { disposition: 'agitated', intent: 'barricade', awareness: 'aware', readiness: 'brandished' },
      record: { warrant: 'unknown', priorViolence: 'unknown' },
      // The self-harm screen applies to the taker (E4); the others are screened in conservatively.
      noDeathOnCard: true,
      knowledge: { presence: { status: 'reported', source: 'Responding patrol' } },
      group: { role: { pick: [['follower', 70], ['lookout', 30]] }, influence: { min: 0.4, max: 0.8 } },
    } },
    { id: 'hostages', kind: 'hostage', count: { min: 1, max: 1 }, keyRoles: ['courier'], person: {
      label: 'courier', age: 'adult',
      hold: { by: 'taker', kind: 'incidental', restraint: 'watched', relationship: 'stranger' },
      relationshipToSubject: 'stranger', meters: { condition: 100, composure: 60 },
      knowledge: { presence: { status: 'reported', source: 'Dispatch' }, position: { status: 'reported', source: 'Dispatch', value: 'by the door' } },
    } },
    { id: 'victims', kind: 'victim', count: { min: 1, max: 1 }, keyRoles: ['owner'], person: {
      label: 'shop owner', age: 'adult',
      hold: { by: 'taker', kind: 'expressive', restraint: 'watched', relationship: 'employer' },
      relationshipToSubject: 'employer', meters: { condition: 100, composure: 50 },
      knowledge: { presence: { status: 'reported', source: 'Dispatch' }, needs: { status: 'unknown', source: 'Nobody yet', learnedBy: 'f_owner_faint' } },
    } },
  ],
  conditions: { timeOfDay: 'day', power: 'on', weather: 'clear', crowd: 1 },
  situations: [
    // Steady or shifting: a taker who would trade can still be pushed past breaking point.
    { index: 0, people: { taker: { ...TAKER, volatility: { pick: [['steady', 50], ['shifting', 50]] } }, others: OTHERS({ min: 0.55, max: 0.9 }) } },
    // The owner's heart: a medical clock, about forty minutes to an hour (±25%). The team sees the
    // first sign through the glass a few minutes in, and command will approve going in from then.
    // The long holds fork on it; anywhere else running out records the collapse and marks it.
    { index: 1, people: { taker: { ...TAKER, volatility: 'volatile' }, others: OTHERS({ min: 0.4, max: 0.8 }), owner: { needs: ['cardiac'], meters: { condition: 60, composure: 40 } } },
      clocks: [{ id: 'owner_condition', label: '{owner.first}’s condition', kind: 'medical', owner: 'owner', start: 60, ratePerMin: 1.2, rateSpread: 0.25, rateKnown: false, factKey: 'owner_faint',
        urgent: '{owner.first} is down on the tiles behind the counter and can’t wait',
        cues: [{ at: 55, text: 'Through the glass, the team sees {owner.first} get down from the stool and sit on the tiles.', mark: 'owner_unwell' }],
        onOut: { harm: 'serious', mark: 'owner_down' } }] },
    { index: 2, people: {
      taker: { ...TAKER, volatility: 'volatile', threat: { disposition: 'hostile', intent: 'barricade', awareness: 'aware', readiness: 'brandished' },
        demands: [{ kind: 'statement', text: '{owner.His} signature on a statement clearing {taker.him}, and nothing less', concedable: false }] },
      // The taker has stopped listening to them; they freeze when the taker walks.
      others: OTHERS({ min: 0.1, max: 0.45 }) } },
  ],
  complications: [],
};
