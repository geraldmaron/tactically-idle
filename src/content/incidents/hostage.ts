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
    { at: 22, text: 'Someone shares the stream to a neighborhood group, and {rider.first} reads out the new names.', moves: [{ personId: 'rider', event: 'watched' }] },
    { at: 48, text: 'Another courier shares the stream to a couriers’ group with a few thousand members.', moves: [{ personId: 'rider', event: 'watched' }] },
    { at: 76, text: '{outlet} reposts the stream from its own account, and {rider.first} reads the {outlet_short} name out to the viewers.', mark: 'news_on', moves: [{ personId: 'rider', event: 'watched' }] },
  ],
  source: {
    count: { from: 380, to: 42000, unit: 'watching' },
    surges: [{ flag: 'mark:performing', ratePerMin: 2.2 }, { flag: 'mark:turned_chat', ratePerMin: 2 }],
    // Contact and pressure: the rider can't be seen to back down. Coordination: every viewer is one
    // more pair of eyes on the stockroom door and the glass, so moving anyone unseen gets harder.
    odds: { kinds: ['contact', 'pressure', 'coordination'], atFull: 7 },
    reactions: {
      // One pool per cue heard, each line shown at most once a run (ui/screens/live-chat.ts), so
      // every pool holds at least REACTION_FLOOR lines (reactions.test.ts). The chat grows with the
      // count: the rider's own followers, then the handgun on camera, then the drivers' group, then
      // strangers off the {outlet} repost.
      byCue: [
        ['{rider.first} you ok??', 'wait where are you', 'looks like a corner store to me', 'they did you so dirty', 'stay safe {rider.first}', 'is the audio ok for everyone',
          'why is it so dark in there', 'is this real', 'just got here whats going on', 'they cut me off last year too', 'who is that on the floor',
          'battery at 9 percent cant leave now', 'turn your brightness up', 'answer your phone {rider.first}', 'same thing happened to me in march',
          'post the order number', 'whats with the lights outside 👀', 'thats your scooter out front right'],
        ['wait is that real', 'put it away please', 'cops all over outside', 'whats {manager.first} supposed to say', 'this is insane', 'my order from there was late too',
          'nah {rider.first} not like this', 'somebody report the stream', 'reporting doesnt do anything', 'i can hear sirens from my place',
          'anyone else in there??', 'who is that by the register', 'just walk out {rider.first}', 'how many people are in there',
          'what did {manager.first} even say', 'clipping this', 'my cousin works two blocks from there', 'dont post where this is'],
        ['so many patrol cars out there', 'let them go', '{rider.first} never took anything from anybody', 'why is the camera shaking', 'are they gonna rush it', 'i know that store',
          'here from the drivers group', 'half the east side drivers are on this', '{delivery_app} does this to everybody',
          'ok but why the gun tho', 'i deliver there fridays', 'whole block is taped off', 'hope everybody gets home tonight 🙏',
          'stop reading the comments {rider.first}', 'drop the timestamp {rider.first}', 'who has the apron on',
          'my kid keeps asking what im watching', 'more people here than the game 👀'],
        ['{outlet_short} is here', 'saw this on {outlet_short}', 'turn it off', 'somebody call {rider.first}s family', 'everybody calm down', 'i used to see {rider.first} every night',
          'whats going on why is this trending', 'no idea who this is but please put it down', 'my group chat just sent me this',
          'watching from three states away', '{outlet_short} comments are way worse', 'yall dont know the whole story', 'who else is in there with them',
          'how is this still up', 'please let everybody walk out', 'i used to work nights there', 'hope the negotiator knows what theyre doing', 'are there reporters outside'],
      ],
      spike: ['WHAT', 'wait', 'whoa', 'what is this', 'hang on', 'hello??', 'ok what', 'is that new', 'what was that', 'huh'],
      // Once, in order, when the stream's state begins: a cut, the camera turned to the wall, the rider
      // playing to the chat, or the count falling a seventh or more (a second phone taking over).
      stopped: ['wait where did the stream go', 'it says offline', 'did someone cut it', 'someone said {stream_app} pulled it'],
      slowed: ['why is it a wall now', 'cant see anything', '{rider.first} turn it around', 'the audio still works though'],
      surged: ['{rider.first} is reading us out loud', 'say hi to me', '{rider.first} answered my message', 'ok now everyone is typing'],
      dropped: ['half the chat just left', 'is the stream lagging', 'the count fell off a cliff', 'where did everybody go', 'my feed froze for a second'],
    },
  } };

const HANDGUN: Weapon = { kind: 'handgun', real: 'real', where: 'in_hand', visible: true };

/** The rider in every situation: the handgun, the stream, and what patrol and the 911 call said. */
const RIDER: Partial<PersonSpec> = {
  label: 'delivery courier',
  weapons: [HANDGUN],
  // Two years on a scooter, not a range: mostly untrained.
  proficiency: { pick: [['untrained', 65], ['some', 30], ['trained', 5]] },
  demands: [{ kind: 'statement', text: '{manager.first} saying on camera that {rider.he} didn’t take the bag', concedable: false }],
  meters: { agitation: 58, rapport: 8, fatigue: 25, intoxication: 0, resolve: 62 },
  knowledge: {
    presence: { status: 'confirmed', source: 'The stream' },
    weapons: { status: 'reported', source: 'Responding patrol', value: 'handgun', learnedBy: 'f_handgun' },
    demands: { status: 'reported', source: 'The 911 call', value: 'the manager saying it on camera', learnedBy: 'f_rider_clear' },
  },
};

export const HOSTAGE_TEMPLATE: IncidentTemplate = {
  type: 'hostage_crisis',
  label: 'Hostage crisis',
  tree,
  cast: [
    { id: 'subjects', kind: 'subject', count: { min: 1, max: 1 }, keyRoles: ['rider'], person: {
      label: 'delivery courier', age: 'adult', activity: 'holding',
      threat: { disposition: 'agitated', intent: 'barricade', awareness: 'aware', readiness: 'brandished' },
      record: { warrant: 'unknown', priorViolence: 'unknown' },
      // The self-harm screen applies to the rider (E4).
      noDeathOnCard: true,
      knowledge: { presence: { status: 'confirmed', source: 'The stream' } },
    } },
    { id: 'hostages', kind: 'hostage', count: { min: 1, max: 1 }, keyRoles: ['clerk'], person: {
      label: 'night clerk', age: 'adult',
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
      label: 'fellow courier', age: 'adult', relationshipToSubject: 'coworker',
      knowledge: { presence: { status: 'confirmed', source: 'At the patrol line' } },
    } },
  ],
  conditions: { timeOfDay: 'night', power: 'on', weather: 'clear', crowd: 2 },
  situations: [
    // The clerk took the bag, and the manager covered for the clerk.
    { index: 0, people: { rider: { ...RIDER, volatility: { pick: [['steady', 45], ['shifting', 55]] } } }, clocks: [STREAM] },
    // The rider took it. A rider who is right about the red light and wrong about the rest is the harder one to hold.
    { index: 1, people: { rider: { ...RIDER, volatility: 'volatile', threat: { disposition: 'hostile', intent: 'barricade', awareness: 'aware', readiness: 'brandished' } } }, clocks: [STREAM] },
    // Nobody took it: the bag went to the wrong porch, and a viewer has the clip.
    { index: 2, people: { rider: { ...RIDER, volatility: { pick: [['shifting', 60], ['volatile', 40]] } } }, clocks: [STREAM] },
  ],
  complications: [],
};
