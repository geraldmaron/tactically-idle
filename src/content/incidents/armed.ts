import { ARMED_NOISE as tree } from '../call-trees/armed-noise';
import type { IncidentTemplate } from './types';

// After the Noise as data. An active threat: the shooter is at the lock of the room the worker is
// trapped in. The door is a structural clock whose rate is the hidden truth. When the bolt holds it
// outlasts any call; when the frame is splitting it gives in about twenty minutes of the shooter
// working at it, give or take a quarter, and the worker says so on the line a few minutes in. The
// tree reads it wherever the shooter goes back to the door (doorFork in armed-noise.ts).
const holding = { id: 'door', label: 'The {scene} door', kind: 'structural' as const, start: 100, ratePerMin: 0.2, rateKnown: false, factKey: 'door_holds',
  cues: [{ at: 40, text: tree.facts.door_holds.confirmed, mark: 'door_strong', reveal: true as const }] };
// Once the splitting frame's cue has fired, command won't wait for talking (sim/authorization.ts).
// The holding door never gets an urgent line: its only cue says the bolt holds.
const splitting = { id: 'door', label: 'The {scene} door', kind: 'structural' as const, start: 50, ratePerMin: 2.5, rateSpread: 0.25, rateKnown: false, factKey: 'door_holds',
  urgent: 'the frame around {worker.first}’s door is splitting',
  cues:[{ at: 35, text: tree.facts.door_holds.disproved, mark: 'door_weak', reveal: true as const }] };

export const ARMED_TEMPLATE: IncidentTemplate = {
  type: 'active_armed_incident',
  label: 'Active armed incident',
  tree,
  cast: [
    { id: 'subjects', kind: 'subject', count: { min: 1, max: 1 }, keyRoles: ['shooter'], person: {
      label: 'armed {shooter^man|woman|person}', age: 'adult', activity: 'seeking',
      threat: { disposition: 'agitated', intent: 'harm_others', awareness: 'aware', readiness: 'brandished' },
      weapons: [{ kind: 'handgun', real: 'real', where: 'in_hand', visible: true }],
      record: { warrant: 'unknown', priorViolence: 'unknown' },
      proficiency: { pick: [['untrained', 45], ['some', 40], ['trained', 15]] },
      demands: [{ kind: 'item', text: 'The cash box', concedable: false }],
      meters: { agitation: 80, rapport: 0, fatigue: 20, intoxication: 0, resolve: 70 },
      knowledge: {
        presence: { status: 'confirmed', source: 'Responding patrol' },
        weapons: { status: 'reported', source: 'Shots heard by patrol', value: 'firearm', learnedBy: 'f_shots' },
        disposition: { status: 'unknown', source: 'Nobody yet', learnedBy: 'f_gives_up' },
      },
    } },
    { id: 'trapped', kind: 'trapped', count: { min: 1, max: 1 }, keyRoles: ['worker'], person: {
      label: 'closing shift', age: 'adult', subjectAware: true, relationshipToSubject: 'customer', meters: { condition: 100, composure: 35 },
      knowledge: { presence: { status: 'confirmed', source: '{worker.His} 911 call' }, position: { status: 'confirmed', source: '{worker.His} 911 call', value: 'locked in the {scene}' } },
    } },
  ],
  conditions: { timeOfDay: 'night', power: 'on', weather: 'clear', crowd: 0 },
  situations: [
    { index: 0, people: { shooter: { volatility: 'shifting' } }, clocks: [holding] },
    { index: 1, people: { shooter: { volatility: 'steady', threat: { disposition: 'hostile', intent: 'harm_others', awareness: 'aware', readiness: 'brandished' } } }, clocks: [holding] },
    { index: 2, people: { shooter: { volatility: 'volatile', threat: { disposition: 'hostile', intent: 'harm_others', awareness: 'aware', readiness: 'brandished' } } }, clocks: [splitting] },
  ],
  complications: [],
};
