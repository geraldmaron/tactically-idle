import { CALM_ON_CAMERA, CHECKS, LIE_OPEN, NEGOTIATOR, ON_STREAM, STREAM_DOWN, check, turnsOn } from './hostage-live-parts';
import type { TreeChoice, TreeOutcome } from './types';

const { TALK } = CHECKS;

// What the squad does once it knows the clerk took the bag (the `clerk_admitted` mark, set when the clerk
// answers at clerk_talks). Two ways to spend it, and neither is free. Telling the courier is quick and
// secondhand: the police have already lied to this man once, and he learns that the manager knew. Putting the
// clerk on the line is the voice he has asked for all night, from a nineteen-year-old who has to say it to a man
// holding {manager.first} at gunpoint. Each can end in a walk-out, a staged release that waits on the other,
// or the courier's anger landing on the manager.
//
// Marks and who reads them:
// - rider_told: the courier knows. Ends the offer of tell_took.
// - asked_for_clerk: the courier wants the clerk's own voice (clerk_on_line modifier, last_word prompt).
// - clerk_voiced: the clerk has been on the line, whatever she managed (ends the offer; last_word prompt and
//   out_front_hands modifier).
// - told_clear: the courier heard it and stood down (the out_cleared and out_quiet epilogues).
// admitted_live and admitted_quiet are the manager's confirmation, read by walkOutEnding as before.

/** The squad owns an earlier lie while the courier walks out: the same row foundOut writes, for a truth told. */
const ownedLie = (text: string) => ({ when: LIE_OPEN, breaks: ['clerk_backs'], mark: ['lie_owned', 'lie_settled'], text });

/** `at` is the node it sits in: a choice never routes back to its own node, so a mixed result from on_air keeps the
 * manager inside and waits at way_out, and from way_out it sends the manager out and waits at last_word. */
export const tellTook = (at: 'on_air' | 'way_out'): TreeChoice => ({
  id: 'tell_took', title: 'Name {clerk.first} to {rider.him}', icon: 'radio', talksTo: 'rider', check: check(TALK, 9), minutes: 4, consequenceLevel: 'high', certBonus: NEGOTIATOR, favors: [CALM_ON_CAMERA],
  onlyIf: { marks: ['clerk_admitted'], notMarks: ['rider_told', 'admitted_live', 'admitted_quiet'] },
  modifiers: [{ label: 'You told {rider.him} {clerk.first} backed {rider.him}', mark: 'lied_clerk', value: -6 }, { label: '{rider.first} is playing to the chat', mark: 'performing', value: -4 }],
  summary: '{lead} tells {rider.first} what {clerk.first} told the officer behind the patrol car. {clerk.first} logged the bag collected and took it, and {manager.first} found the receipt in {clerk.his} apron. It is {clerk.first}’s word, passed on.',
  pull: '{rider.first} came here for this answer, and you have it.',
  cost: '{rider.first} learns {manager.first} knew, and {manager.first} is on the floor at {rider.his} feet.',
  preview: { favorable: '{rider.first} hears it, sets the handgun on the register and lets {manager.first} walk out.', mixed: '{rider.first} wants to hear it from {clerk.first}, not from the police, and keeps the handgun until then.', adverse: '{rider.first} turns on {manager.first}. Near breaking point, the handgun comes up in {manager.his} face.' },
  outcomes: {
    favorable: [
      ownedLie('The negotiator starts with the part that costs. What the squad said earlier about {clerk.first} is made up. Nobody has asked {clerk.him} until now.'),
      { text: 'The negotiator says it once, plainly. {rider.first} doesn’t answer. {rider.He} {rider~crouches|crouch} in front of {manager.first} and holds the phone to {manager.his} face, the handgun hanging from the other hand.',
        exchange: [{ by: 'negotiator', line: '{clerk.first} took the bag and logged it collected. {manager.first} found the receipt.' }, { by: 'rider', line: 'Is that true? Look at me, {manager.first}. Is it true?' }, { by: 'manager', line: 'It’s true. I told {clerk.him} to leave the complaint alone. I should’ve told you Tuesday.' }, { by: 'rider', line: 'Nineteen. {clerk.first} is nineteen, and I’m the one who got shut off.' }],
        safe: ['manager'], mark: ['rider_told', 'told_clear'], moves: { rider: 'honest' } },
      { when: ON_STREAM, text: '{rider.first} stands and sets the handgun on the register beside the phone, then turns the screen to the room. “You all heard that,” {rider.he} {rider~says|say}. “Every word.” {manager.first} goes out first with an officer at each elbow, and {rider.first} follows with open hands into the {outlet_short} light.',
        mark: ['admitted_live'], out: ['rider'], stabilize: ['stream'], next: { ending: 'out_cleared' }, objective: 72, pressure: -12 },
      { when: STREAM_DOWN, text: '{rider.first} gets to {rider.his} feet, lays the handgun down by the register and leaves the dead phone beside it. {manager.first} walks out first. {rider.first} comes out behind {manager.him}, hands open, until an officer takes hold of {rider.him} on the step.',
        mark: ['admitted_quiet'], out: ['rider'], next: { ending: 'out_quiet' }, objective: 72, pressure: -12 },
    ],
    mixed: [
      ownedLie('The negotiator starts with the part that costs. What the squad said earlier about {clerk.first} is made up. Nobody has asked {clerk.him} until now.'),
      ...((at === 'on_air'
        ? [{ text: '“That’s the police saying it,” {rider.first} says. “That’s not {clerk.first}.” {rider.He} {rider~puts|put} the phone face up on the register, {rider~takes|take} a step back from {manager.first} and {rider~keeps|keep} the handgun low. “Get {clerk.him} on that line.”',
            mark: ['rider_told', 'asked_for_clerk'], moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 30, pressure: -3 }]
        : [{ text: '“That’s the police saying it,” {rider.first} says. “That’s not {clerk.first}.” {rider.He} {rider~sends|send} {manager.first} out ahead of {rider.him}. {rider.He} won’t wait for {clerk.first} with {manager.him} watching. Then {rider.he} {rider~sits|sit} on the floor by the register, the handgun at {rider.his} knee.',
            safe: ['manager'], mark: ['rider_told', 'asked_for_clerk', 'still_armed'], moves: { rider: 'heard' }, next: { node: 'last_word' }, objective: 40, pressure: -4 }]) as TreeOutcome[]),
    ],
    adverse: [
      ...turnsOn({
        lead: '“A kid,” {rider.first} says. {rider.He} {rider~says|say} it again, down at {manager.first} this time and not to the phone. “You let them take my account for a kid.”',
        threat: '{rider.first} brings the handgun up level with {manager.first}’s face. “Say what you did,” {rider.he} {rider~tells|tell} {manager.him}. “Say it out loud.”',
        quiet: '{rider.first} stops talking and sits down with {rider.his} back to the cooler, between {manager.first} and the door.',
        quietNext: { node: at === 'on_air' ? 'way_out' : 'last_word' },
        extra: { mark: ['rider_told'], moves: { rider: 'provoked' }, bump: { stream: 12 }, pressure: 8 } }),
      ownedLie('Then the negotiator owns up. What the squad said about {clerk.first} earlier is made up, and nobody has asked {clerk.him} anything.'),
    ],
  },
});

export const clerkOnLine = (): TreeChoice => ({
  id: 'clerk_on_line', title: 'Put {clerk.first} on the line', icon: 'radio', talksTo: 'rider', check: check(TALK, 2), minutes: 7, consequenceLevel: 'high', certBonus: NEGOTIATOR, favors: [CALM_ON_CAMERA],
  onlyIf: { marks: ['clerk_admitted'], safe: ['clerk'], notMarks: ['told_clear', 'clerk_voiced'] },
  modifiers: [{ label: '{rider.first} wants {clerk.first}’s voice', mark: 'asked_for_clerk', value: 6 }, { label: 'You told {rider.him} {clerk.first} backed {rider.him}', mark: 'lied_clerk', value: -6 }],
  summary: '{lead} asks {clerk.first} to say it to {rider.first} on the register line, in {clerk.his} own voice. {clerk.first} has said it once, to one officer.',
  pull: '{rider.first} wants {clerk.first}’s own words, not the police’s.',
  cost: '{clerk.first}, nineteen, has to say it aloud to {rider.first}, who is holding {manager.first} at gunpoint.',
  preview: { favorable: '{clerk.first} says it, and {rider.first} lets {manager.first} walk out.', mixed: '{clerk.first} gets out an apology and no more, and {rider.first} keeps the handgun.', adverse: '{clerk.first} hangs up mid-sentence. Near breaking point, {rider.first} puts the handgun on {manager.first} and tells {manager.him} to say it.' },
  outcomes: {
    favorable: [
      ownedLie('First the negotiator owns up. What the squad said earlier about {clerk.first} is made up. This is the first time anyone asks {clerk.him}.'),
      { text: 'An officer walks {clerk.first} to the register line and holds out the receiver. For a few seconds nobody says anything. Then {clerk.first} says it, fast, with no breath between the words.',
        exchange: [{ by: 'clerk', line: 'It was me, {rider.first}. I took the bag. I told you it was another courier.' }, { by: 'clerk', line: '{manager.first} said leave it alone, and I did. I’m sorry. I’m so sorry.' }, { by: 'rider', line: 'Say my name. Say I didn’t take it. Say it so they all hear.' }],
        safe: ['manager'], mark: ['rider_told', 'clerk_voiced', 'told_clear'], moves: { rider: 'honest' } },
      { when: ON_STREAM, text: '{clerk.first}’s voice goes out over the speaker, and the comments under the phone stop scrolling. {rider.first} sets the handgun on the register and tells {manager.first} to get up. “You go first. I want them to see you walk out, and me after.” Officers take {manager.him} at the door, and {rider.first} follows with open hands into the {outlet_short} light.',
        mark: ['admitted_live'], out: ['rider'], stabilize: ['stream'], next: { ending: 'out_cleared' }, objective: 75, pressure: -12 },
      { when: STREAM_DOWN, text: '{rider.first} listens with the receiver pressed to {rider.his} ear and says nothing more. Then {rider.he} {rider~sets|set} the handgun down by the register, {rider~tells|tell} {manager.first} to go, and {rider~walks|walk} out after {manager.him} with both hands open.',
        mark: ['admitted_quiet'], out: ['rider'], next: { ending: 'out_quiet' }, objective: 75, pressure: -12 },
    ],
    mixed: [
      ownedLie('First the negotiator owns up. What the squad said earlier about {clerk.first} is made up.'),
      { text: '{clerk.first} gets as far as “I’m sorry” and can’t say what for. {rider.first} says {clerk.first}’s name twice and gets breath on the line. {rider.He} {rider~takes|take} that as an answer, and not enough of one, and sends {manager.first} out ahead of {rider.him}.',
        safe: ['manager'], mark: ['rider_told', 'clerk_voiced', 'still_armed'], moves: { rider: 'heard' }, next: { node: 'last_word' }, objective: 45, pressure: -6 },
    ],
    adverse: [
      ...turnsOn({
        lead: 'An officer holds out the receiver, and the line clicks dead before {clerk.first} finishes a sentence. {rider.first} looks at the register phone.',
        threat: '“{clerk.first} hung up,” {rider.first} says, and puts the handgun on {manager.first}. “You tell {clerk.him} to call back. You tell {clerk.him} now.”',
        quiet: '{rider.first} sets the receiver on the counter and sits on the floor facing the front door, and for a while nobody talks.',
        quietNext: { node: 'last_word' },
        extra: { mark: ['rider_told', 'clerk_voiced'], moves: { rider: 'provoked' }, pressure: 8 } }),
      ownedLie('Then the negotiator owns up. What the squad said earlier about {clerk.first} is made up.'),
    ],
  },
});

// The other situation: the courier did collect the bag, kept it when the drop failed and told the stream he never
// had it. The clerk watched him take it off the counter (`saw_collect`, set when the clerk answers at clerk_talks and
// when the team checks a viewer's clip). The truth now costs the courier, so the two choices are two ways of letting
// him say it. Putting the pickup to him is quick, in front of whoever is listening, and the exposure can break him
// toward the manager who sat on the store camera clip. Giving him the line alone asks him to end the stream, which
// is the audience he came for, and the line is recorded either way.
//
// Marks and who reads them:
// - saw_collect: the squad can put the pickup to the courier (gates both choices).
// - owned_up: the courier said where the bag is (ends both offers; the out_cleared and out_quiet epilogues).
// - private_refused: he kept the phone up and played to the stream (ends the offer of the line alone).
// rider_told and performing are the marks the first pair and the approach nodes already set and read.

export const putPickup = (at: 'on_air' | 'way_out'): TreeChoice => ({
  id: 'put_pickup', title: 'Put the pickup to {rider.him}', icon: 'radio', talksTo: 'rider', check: check(TALK, 8), minutes: 4, consequenceLevel: 'high', certBonus: NEGOTIATOR, favors: [CALM_ON_CAMERA],
  onlyIf: { marks: ['saw_collect'], notMarks: ['rider_told', 'owned_up'] },
  modifiers: [{ label: 'You told {rider.him} {clerk.first} backed {rider.him}', mark: 'lied_clerk', value: -6 }, { label: '{rider.first} is playing to the chat', mark: 'performing', value: -4 }],
  summary: '{lead} tells {rider.first} that {clerk.first} watched {rider.him} take the bag off the counter a few minutes after 11:40 PM. What happened to the bag after that is {rider.first}’s to say.',
  pull: '{rider.first} can still be the one who tells it.',
  cost: 'Everything {rider.first} told the viewers about the bag is on the line.',
  preview: { favorable: '{rider.first} tells it straight, sets the handgun on the register and lets {manager.first} walk out.', mixed: '{rider.first} says it was a different bag and keeps the handgun.', adverse: '{rider.first} hears that {clerk.first} was watching. Near breaking point, the handgun comes up on {manager.first}.' },
  outcomes: {
    favorable: [
      ownedLie('The negotiator starts with the part that costs. What the squad said earlier about {clerk.first} is made up. Nobody has asked {clerk.him} until now.'),
      { text: 'The negotiator says it once, plainly. {rider.first} doesn’t move. {rider.He} {rider~looks|look} at the phone, then at the floor between {rider.his} feet, and the handgun sinks to {rider.his} knee.',
        exchange: [{ by: 'negotiator', line: '{clerk.first} watched you take the bag off the counter after 11:40.' }, { by: 'rider', line: 'I picked it up. Okay? I picked it up.' }, { by: 'negotiator', line: 'What happened to it after that?' }, { by: 'rider', line: 'Nobody answered the door. I marked it delivered. It’s under my scooter seat.' }],
        reveal: ['rider_clear'], safe: ['manager'], mark: ['rider_told', 'owned_up'], moves: { rider: 'honest' } },
      { when: ON_STREAM, text: '{rider.first} lifts the phone and tells the room about the bag, the door nobody answered and the delivery {rider.he} marked done. Then {rider.he} {rider~sets|set} the handgun by the register, {rider~sends|send} {manager.first} out ahead and {rider~follows|follow} with open hands into the {outlet_short} light.',
        out: ['rider'], stabilize: ['stream'], next: { ending: 'out_cleared' }, objective: 70, pressure: -12 },
      { when: STREAM_DOWN, text: '{rider.first} turns the dark phone face down. Then {rider.he} {rider~lays|lay} the handgun by the register, {rider~tells|tell} {manager.first} to go and {rider~walks|walk} out behind {manager.him}, hands open.',
        out: ['rider'], next: { ending: 'out_quiet' }, objective: 70, pressure: -12 },
    ],
    mixed: [
      ownedLie('The negotiator starts with the part that costs. What the squad said earlier about {clerk.first} is made up.'),
      ...((at === 'on_air'
        ? [{ text: '“I picked up a bag,” {rider.first} says. “Everybody picks up bags. That doesn’t make it that one.” {rider.He} {rider~keeps|keep} the handgun low at {rider.his} side and {rider~tells|tell} the room the police are building a story.',
            mark: ['rider_told', 'performing'], moves: { rider: 'heard' }, bump: { stream: 8 }, next: { node: 'way_out' }, objective: 25, pressure: 2 }]
        : [{ text: '“I picked up a bag,” {rider.first} says. “Everybody picks up bags. That doesn’t make it that one.” {rider.He} {rider~sends|send} {manager.first} out ahead of {rider.him} and sits by the register, the handgun at {rider.his} knee.',
            safe: ['manager'], mark: ['rider_told', 'performing', 'still_armed'], moves: { rider: 'heard' }, bump: { stream: 8 }, next: { node: 'last_word' }, objective: 35, pressure: 2 }]) as TreeOutcome[]),
    ],
    adverse: [
      ...turnsOn({
        lead: '“Watching,” {rider.first} says. “Everybody was watching. Nobody said a word to me.”',
        threat: '{rider.first} brings the handgun level with {manager.first} and asks what else {manager.he} {manager~kept|keep} from {rider.him}.',
        quiet: '{rider.first} sets the phone face down on {rider.his} knee and stares at the front door.',
        quietNext: { node: at === 'on_air' ? 'way_out' : 'last_word' },
        extra: { mark: ['rider_told'], moves: { rider: 'provoked' }, bump: { stream: 12 }, pressure: 8 } }),
      ownedLie('Then the negotiator owns up. What the squad said about {clerk.first} earlier is made up.'),
    ],
  },
});

export const privateLine = (): TreeChoice => ({
  id: 'private_line', title: 'Give {rider.him} the line alone', icon: 'radio', talksTo: 'rider', check: check(TALK, 6), minutes: 6, consequenceLevel: 'high', certBonus: NEGOTIATOR, favors: [CALM_ON_CAMERA],
  onlyIf: { marks: ['saw_collect'], notMarks: ['private_refused', 'owned_up'] },
  modifiers: [{ label: '{rider.first} is playing to the chat', mark: 'performing', value: -5 }, { label: 'You told {rider.him} {clerk.first} backed {rider.him}', mark: 'lied_clerk', value: -6 }],
  summary: '{lead} asks {rider.first} to end the stream and take the register line alone. What {rider.he} {rider~says|say} on it goes to the negotiator and the police, not to the viewers.',
  pull: 'No audience to lose face in front of.',
  cost: '{rider.first} loses the viewers for good, and the line is recorded.',
  preview: { favorable: '{rider.first} ends the stream and tells you where the bag is.', mixed: '{rider.first} ends the stream and talks about everything but the bag.', adverse: '{rider.first} keeps the phone up and tells the viewers the police want {rider.him} alone. Near breaking point, the handgun comes up on {manager.first}.' },
  outcomes: {
    favorable: [
      ownedLie('First the negotiator owns up. What the squad said earlier about {clerk.first} is made up.'),
      { when: ON_STREAM, text: '{rider.first} ends the stream with {rider.his} thumb and sets the phone face down on the register. The count under it drops to nothing. “It’s just us, then,” {rider.he} {rider~says|say}.',
        stabilize: ['stream'], bump: { stream: -100 }, mark: ['stream_off', 'stream_down'] },
      { when: STREAM_DOWN, text: '{rider.first} sets the dead phone face down on the register and takes the receiver in both hands.' },
      { text: '{rider.first} talks low and fast, with {manager.first} on the floor listening. A Sunday night, a customer who never answered, a bag that stayed on a scooter. Then {rider.he} {rider~lays|lay} the handgun by the phone, {rider~sends|send} {manager.first} out first and {rider~follows|follow} with open hands.',
        exchange: [{ by: 'rider', line: 'Nobody answered the door. I marked it delivered. It’s under my scooter seat.' }, { by: 'rider', line: 'I told them I never had it. I told everybody.' }, { by: 'negotiator', line: 'You’re telling me now. Keep telling me on the way out.' }],
        reveal: ['rider_clear'], safe: ['manager'], out: ['rider'], mark: ['rider_told', 'owned_up'], moves: { rider: 'honest' }, next: { ending: 'out_quiet' }, objective: 72, pressure: -12 },
    ],
    mixed: [
      ownedLie('First the negotiator owns up. What the squad said earlier about {clerk.first} is made up.'),
      { when: ON_STREAM, text: '{rider.first} ends the stream and sets the phone face down. The count under it drops to nothing.',
        stabilize: ['stream'], bump: { stream: -100 }, mark: ['stream_off', 'stream_down'] },
      { text: '{rider.first} talks into the receiver about the account, the form email and two years of Sundays. Each time the negotiator asks about the bag, {rider.he} {rider~says|say} {rider.he} will answer on camera or not at all. Then {rider.he} {rider~sends|send} {manager.first} out ahead of {rider.him}.',
        safe: ['manager'], mark: ['rider_told', 'still_armed'], moves: { rider: 'heard' }, next: { node: 'last_word' }, objective: 40, pressure: -4 },
    ],
    adverse: [
      ...turnsOn({
        lead: '{rider.first} holds the phone up to the room. “They want me alone,” {rider.he} {rider~tells|tell} the stream. “You know why they want me alone.”',
        threat: '{rider.first} puts the handgun on {manager.first} with the phone still up, so everyone watching sees the two together.',
        quiet: '{rider.first} keeps the phone up and says nothing, and the count keeps climbing.',
        quietNext: { node: 'last_word' },
        extra: { when: ON_STREAM, mark: ['private_refused', 'performing'], moves: { rider: 'provoked' }, bump: { stream: 14 }, pressure: 8 } }),
      { when: STREAM_DOWN, text: '{rider.first} holds the dead phone up like a camera and tells the room the police want {rider.him} alone.', mark: ['private_refused'], moves: { rider: 'provoked' }, pressure: 8 },
      ownedLie('Then the negotiator owns up. What the squad said about {clerk.first} earlier is made up.'),
    ],
  },
});
