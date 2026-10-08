import { RESCUE_CHAIR as tree } from '../call-trees/rescue-chair';
import type { IncidentTemplate } from './types';

// My Chair Comes Too as data. A rescue: the subject is outside the building (another unit's
// problem), and the resident is trapped by the shooter, by the chair and by the oxygen. Whether the
// shooter can see the front door is a sightline the building will compute later; until then it is
// the situation's truth. The block's power is out, as the briefing says.
//
// The spare tank is a supply clock. Full, it outlasts any call. Short, it has about forty minutes,
// give or take a fifth: the gauge reads red ten minutes in (the tree's gauge forks read `low`), and
// the resident says when it is empty (all_night reads `out`). It stops once they are out. Where it
// runs out and no fork reads it (a long wait in the hallway), the resident is seriously hurt and
// still inside: the engine records it and sets `tank_empty`, which the last prompts read.
const tank = (start: number, ratePerMin: number, rateKnown: boolean, rateSpread?: number) => ({ id: 'oxygen', label: '{resident.first}’s spare tank', kind: 'supply' as const, owner: 'resident',
  start, ratePerMin, rateKnown, ...(rateSpread ? { rateSpread } : {}), factKey: 'oxygen_low', onOut: { harm: 'serious' as const, mark: 'tank_empty' },
  // Once the gauge is in the red, command won't wait for the shooting to stop (sim/authorization.ts).
  urgent: '{resident.first}’s spare tank is in the red',
  cues:[{ at: 30, text: '{resident.first} taps the tank’s gauge. The needle sits in the red.', mark: 'running_low' }, { at: 0, text: 'The hiss from {resident.first}’s spare tank stops.', mark: 'tank_empty' }] });
const shooterSees = (clear: boolean) => ({ sightlines: [{ to: 'the front door', clear }] });

export const RESCUE_TEMPLATE: IncidentTemplate = {
  type: 'protected_rescue',
  label: 'Protected rescue',
  tree,
  cast: [
    { id: 'trapped', kind: 'trapped', count: { min: 1, max: 1 }, keyRoles: ['resident'], person: {
      label: 'resident', age: 'adult', mobility: 'chair', needs: ['oxygen'], subjectAware: false, meters: { condition: 90, composure: 55 },
      knowledge: { presence: { status: 'confirmed', source: 'Dispatch' }, needs: { status: 'unknown', source: 'Nobody yet', learnedBy: 'f_oxygen_low' } },
    } },
    { id: 'reporting', kind: 'reporting_party', count: { min: 1, max: 1 }, keyRoles: ['neighbor'], person: {
      label: 'the neighbor who called', age: 'adult', relationshipToSubject: 'stranger',
      knowledge: { presence: { status: 'confirmed', source: 'With patrol' } },
    } },
    { id: 'subjects', kind: 'subject', count: { min: 1, max: 1 }, keyRoles: ['shooter'], person: {
      label: 'the person firing across the street', age: 'adult', offsite: 'an upstairs window across the street', activity: 'offsite',
      threat: { disposition: 'hostile', intent: 'harm_others', awareness: 'aware', readiness: 'brandished' },
      weapons: [{ kind: 'unknown', real: 'real', where: 'in_hand', visible: false }],
      proficiency: { pick: [['untrained', 50], ['some', 35], ['trained', 15]] },
      knowledge: {
        presence: { status: 'confirmed', source: 'Responding patrol' },
        weapons: { status: 'reported', source: 'Responding patrol', value: 'firing at cars', learnedBy: 'f_shots' },
      },
    } },
  ],
  conditions: { timeOfDay: 'dusk', power: 'off', weather: 'clear', crowd: 0 },
  situations: [
    { index: 0, people: { shooter: shooterSees(false) }, clocks: [tank(100, 0.2, true)] },
    { index: 1, people: { shooter: shooterSees(true) }, clocks: [tank(100, 0.2, true)] },
    { index: 2, people: { shooter: shooterSees(true) }, clocks: [tank(40, 1, false, 0.2)] },
  ],
  complications: [],
};
