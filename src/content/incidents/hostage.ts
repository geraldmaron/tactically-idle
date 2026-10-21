import { HOSTAGE_LIVE as tree } from '../call-trees/hostage-live';
import type { Clock, IncidentTemplate, PersonSpec, Weapon } from './types';

// Going Live as data (design sheet: docs/calls/going-live-design.md). The rider holds the manager
// because the grievance is with them (an expressive hold, so the manager is a victim) and the clerk
// only because the clerk was there (incidental). The demand is one sentence said on camera, which
// nobody on the team can say for anyone.
//
// The pressure source (docs/call-pressure.md, "Pressure sources"):
// - The stream: the rider's own phone, propped on the register, on {stream_app}. Talking on it feeds
//   it, a turn to the wall slows it, the chat turning on the rider and the rider playing to it speed
//   it up, and command or the rider can end it. The more people watch, the harder talk and pressure
//   checks get, because the rider can't be seen to back down, and the harder it is to move anyone
//   unseen. The news reaches the scene through it:
//   the {outlet} repost cue here, and the van on the call's own threats.

/** The rider's stream, counted the way the phone counts it. */
const STREAM: Clock = { id: 'stream', label: '{rider.first}’s stream', kind: 'crowd', direction: 'fill', owner: 'rider', start: 8, ratePerMin: 1.1, rateSpread: 0.2, rateKnown: false,
  rateFlags: [{ flag: 'mark:phone_wall', ratePerMin: 0.2 }],
  cues: [
    { at: 22, text: '{rider.first} reads a comment out loud. Someone wants to know if the handgun is real. {rider.He} {rider~holds|hold} it up to the camera to show them.', moves: [{ personId: 'rider', event: 'watched' }] },
    { at: 48, text: 'Another rider shares the stream to a group of a few thousand drivers, and the count under the picture jumps twice in a minute.', moves: [{ personId: 'rider', event: 'watched' }] },
    { at: 76, text: 'The account for {outlet} reposts the stream. {rider.first} reads the name off the screen, then reads it again.', mark: 'news_on', moves: [{ personId: 'rider', event: 'watched' }] },
  ],
  source: {
    count: { from: 380, to: 42000, unit: 'watching' },
    surges: [{ flag: 'mark:performing', ratePerMin: 2.2 }, { flag: 'mark:turned_chat', ratePerMin: 2 }],
    // Contact and pressure: the rider can't be seen to back down. Coordination: every viewer is one
    // more pair of eyes on the stockroom door and the glass, so moving anyone unseen gets harder.
    odds: { kinds: ['contact', 'pressure', 'coordination'], atFull: 7 },
    reactions: {
      byCue: [
        ['{rider.first} you good??', 'where is this', 'is that the place on 9th', 'they did you so dirty', 'stay safe bro', 'say it louder'],
        ['wait is that real', 'put it down man', 'cops everywhere outside', 'make her say it', 'this is crazy', 'my order from there was late too'],
        ['twelve cop cars, i counted', 'just let her go', 'he never stole from anybody', 'why is the camera shaking', 'they gonna rush it', 'i know that store'],
        ['{outlet_short} is here', 'this is not how you prove it', 'turn it off', 'somebody call his mom', 'everybody calm down', 'i used to see him every night'],
      ],
      spike: ['WHAT', 'did he just', 'oh no', 'is everybody ok', 'nooo'],
    },
  } };

const HANDGUN: Weapon = { kind: 'handgun', real: 'real', where: 'in_hand', visible: true };

/** The rider in every situation: the handgun, the stream, and what patrol and the 911 call said. */
const RIDER: Partial<PersonSpec> = {
  label: 'delivery rider',
  weapons: [HANDGUN],
  // Two years on a scooter, not a range: mostly untrained.
  proficiency: { pick: [['untrained', 65], ['some', 30], ['trained', 5]] },
  demands: [{ kind: 'statement', text: '{manager.first} saying on camera that {rider.he} didn’t take the bag', concedable: false }],
  meters: { agitation: 58, rapport: 8, fatigue: 25, intoxication: 0, resolve: 62 },
  knowledge: {
    presence: { status: 'confirmed', source: 'The stream' },
    weapons: { status: 'reported', source: 'Responding patrol', value: 'handgun', learnedBy: 'f_handgun' },
    demands: { status: 'reported', source: 'The 911 call', value: 'the manager saying it on camera', learnedBy: 'f_rider_clear' },
    disposition: { status: 'unknown', source: 'Nobody yet', learnedBy: 'f_raised' },
  },
};

export const HOSTAGE_TEMPLATE: IncidentTemplate = {
  type: 'hostage_crisis',
  label: 'Hostage crisis',
  tree,
  cast: [
    { id: 'subjects', kind: 'subject', count: { min: 1, max: 1 }, keyRoles: ['rider'], person: {
      label: 'delivery rider', age: 'adult', activity: 'holding',
      threat: { disposition: 'agitated', intent: 'barricade', awareness: 'aware', readiness: 'brandished' },
      record: { warrant: 'unknown', priorViolence: 'unknown' },
      // The self-harm screen applies to the rider (E4).
      noDeathOnCard: true,
      knowledge: { presence: { status: 'confirmed', source: 'The stream' } },
    } },
    { id: 'hostages', kind: 'hostage', count: { min: 1, max: 1 }, keyRoles: ['clerk'], person: {
      label: 'clerk', age: 'adult',
      hold: { by: 'rider', kind: 'incidental', restraint: 'watched', relationship: 'stranger' },
      relationshipToSubject: 'stranger', meters: { condition: 100, composure: 45 },
      knowledge: { presence: { status: 'reported', source: 'The 911 call' }, position: { status: 'reported', source: 'The 911 call', value: 'by the stockroom door' } },
    } },
    { id: 'victims', kind: 'victim', count: { min: 1, max: 1 }, keyRoles: ['manager'], person: {
      label: 'night manager', age: 'adult',
      hold: { by: 'rider', kind: 'expressive', restraint: 'watched', relationship: 'acquaintance' },
      relationshipToSubject: 'acquaintance', meters: { condition: 100, composure: 55 },
      knowledge: { presence: { status: 'confirmed', source: 'The stream' } },
    } },
    // At the patrol line, typing in the comments. Can speak on the line as a gamble, once the stream turns.
    { id: 'kin', kind: 'bystander', count: { min: 1, max: 1 }, keyRoles: ['friend'], person: {
      label: 'rider friend', age: 'adult', relationshipToSubject: 'coworker',
      knowledge: { presence: { status: 'confirmed', source: 'At the patrol line' } },
    } },
  ],
  conditions: { timeOfDay: 'night', power: 'on', weather: 'clear', crowd: 2 },
  situations: [
    // The clerk took the bag; a refusal leaves the rider pacing.
    { index: 0, people: { rider: { ...RIDER, volatility: { pick: [['steady', 45], ['shifting', 55]] } } }, clocks: [STREAM] },
    // The rider took it; a refusal on camera turns the handgun on the manager.
    { index: 1, people: { rider: { ...RIDER, volatility: 'volatile', threat: { disposition: 'hostile', intent: 'barricade', awareness: 'aware', readiness: 'brandished' } } }, clocks: [STREAM] },
  ],
  complications: [],
};
