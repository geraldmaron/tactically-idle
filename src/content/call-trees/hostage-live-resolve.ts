import { CHAT } from './hostage-live-chat';
import { BREAKING, CALM_ON_CAMERA, CHECKS, HOLDING, LIE_OPEN, MANAGER_IN, NEGOTIATOR, CLEAR, NO_PROOF, ON_STREAM, PROOF, STEADY_ON_CAMERA, STREAM_CUT, STREAM_DOWN, STREAM_ENDED, TOOK, check, clerkToo, foundOut, afterRefusal, forcedEntry, commandTakesDoor, managerToo, turnsOn, walkOutEnding } from './hostage-live-parts';
import { clerkOnLine, privateLine, putPickup, tellTook } from './hostage-live-admission';
import type { TreeEnding, TreeNode } from './types';

const { TALK, HOLD, PRESS, ENTER } = CHECKS;
const CLEAR_NO_PROOF = [CLEAR, NO_PROOF];

// Stage 3 of Going Live: the way out. What each exit costs depends on what the player learned on
// the way here. A walk-out the viewers saw cleared ends `out_cleared` only when they heard where the
// order went (walkOutEnding); a hidden truth never decides it. The lie told at clerk_talks settles on
// every exit that brings the courier out (foundOut), and it closes the filmed walk-out: a courier
// waiting for the clerk to say it on camera won't walk out on camera first.
export const RESOLVE_NODES: TreeNode[] = [
  { id: 'way_out', stage: 'resolve',
    threat: { chat: CHAT.way_out, label: 'The {outlet_short} crew goes live', minutes: 12, text: 'The {outlet_short} crew at the corner starts broadcasting. Its light snaps onto the front door and fills the glass, and {rider.first} steps back from it without lowering the handgun.', pressure: 5, bump: { stream: 18 },
      beats: [
        { id: 'medic', at: 1.8, by: 'radio', line: 'Medic staged down the block.' },
        { id: 'how_out', at: 3.4, by: 'rider', line: 'If I walk out, do I walk out on camera? Yes or no.', bump: { stream: 5 } },
        { id: 'camera_door', at: 4.6, by: 'radio', line: 'News camera on the front door. Light is up.', bump: { stream: 4 } },
      ],
      timeout: commandTakesDoor('{rider.first} asks the yes or no question again and gets no answer from outside. {rider.He} {rider~sits|sit} down with {rider.his} back to the door. Command gives the order, and the team goes in.') },
    prompt: '{rider.first} asks how to come out. {manager.first} is still beside the cooler, and a {outlet_short} crew is setting up at the corner.',
    exchange: [{ by: 'rider', line: 'I come out on camera or I don’t come out.' }, { by: 'negotiator', line: 'Tell me why the camera matters.' }, { by: 'rider', line: 'Because then you can’t say what happened.' }],
    // First match wins. The lie comes first so that nothing else the courier heard hides it.
    promptIf: [
      { when: { marks: ['asked_for_clerk'], notMarks: ['clerk_voiced'] }, prompt: '{rider.first} has put the phone down and stepped back from {manager.first}. {rider.He} {rider~wants|want} {clerk.first} on the register line, and {rider~keeps|keep} the handgun low and the door in sight.' },
      { when: { marks: ['saw_collect'], notMarks: ['rider_told', 'owned_up'] }, prompt: '{rider.first} asks how to come out and keeps telling the room {rider.he} never touched the bag. {clerk.first} says otherwise, and your squad knows it.' },
      { when: { marks: ['clerk_admitted'], notMarks: ['rider_told', 'admitted_live', 'admitted_quiet'] }, prompt: '{rider.first} asks how to come out. Then {rider.he} {rider~looks|look} at {manager.first} on the floor and asks why {manager.he} {manager~won’t|won’t} say where the bag went.' },
      { when: { marks: ['lied_clerk', 'proof_seen'] }, prompt: '{rider.first} has the porch clip on the screen and keeps asking when {clerk.first} will back {rider.him} on camera.' },
      { when: { marks: ['lied_clerk'] }, prompt: '{rider.first} keeps repeating that {clerk.first} backed {rider.him}, and wants {clerk.first} on camera to say so.' },
      { when: { marks: ['proof_seen'] }, prompt: 'The porch clip is up, and your squad has matched it to the order. {rider.first} wants to know who at {delivery_app} will see it, and which door to use.',
        exchange: [{ by: 'rider', line: 'It’s on the step. It’s right there on the step.' }, { by: 'negotiator', line: 'It is. The label matches your order.' }] },
      { when: { marks: ['admitted_live'] }, prompt: '{manager.first} named {clerk.first} on the stream, and the comments haven’t slowed since. {rider.first} looks from the count to the front door and back.',
        exchange: [{ by: 'rider', line: 'You heard it. Everybody heard it.' }, { by: 'negotiator', line: 'They did. Which door do you want to use?' }] },
      { when: { marks: ['admitted_quiet'] }, prompt: '{manager.first} told the line that the complaint protected {clerk.first}. {rider.first} asks whether anyone outside heard that, and which way is out.' },
      { when: { marks: ['exposed'] }, prompt: '{manager.first}’s accusation is all over the stream. {rider.first} has quit arguing with the comments. {rider.He} {rider~wants|want} to know which door, and who will be on the step when it opens.',
        exchange: [{ by: 'rider', line: 'If I walk out, they all watch me walk out.' }, { by: 'negotiator', line: 'You don’t want them watching you leave. What would make the door easier?' }] },
      { when: { marks: ['app_said'] }, prompt: '{manager.first} said {delivery_app} logged the order as delivered. {rider.first} keeps asking the line how a delivered bag goes missing.' },
      { when: { marks: ['held_back'] }, prompt: '{rider.first} asks why {manager.first} would not answer on camera. Then {rider.he} {rider~asks|ask} about the door.' },
      { when: { marks: ['clerk_named'], notSafe: ['clerk'] }, prompt: '{rider.first} keeps looking toward the stockroom, where {clerk.first} still is, and asks which door you will use for {clerk.him}.' },
      { when: { marks: ['clerk_named'], safe: ['clerk'] }, prompt: '{rider.first} asks where {clerk.first} is, and whether {clerk.first} heard what the comments said.' },
      { when: { marks: ['news_on'] }, prompt: '{outlet} has put the stream on its own channel. {rider.first} asks you which door to use.' },
      { when: { marks: ['phone_wall'] }, prompt: 'The stream shows the wall. {rider.first} asks the negotiator about the door.' },
      { when: { marks: ['turned_chat'] }, prompt: 'The comments have turned against {rider.first}. {rider.He} {rider~holds|hold} the phone in one hand and the handgun in the other, and {rider~asks|ask} the line how anyone walks out of here.' },
    ],
    choices: [
      // Not once the stream is down, and not while the courier waits for the clerk to say it on camera.
      { id: 'walk_live', title: 'Let {rider.him} walk out on the stream', icon: 'door', walks: 'manager', talksTo: 'rider', check: check(TALK, 4), minutes: 6, onlyIf: { notMarks: ['lied_clerk', 'lie_found', 'stream_down'] },
        modifiers: [{ label: 'The camera is on the wall', mark: 'phone_wall', value: -4 }, { label: 'The porch clip is already up', mark: 'proof_seen', value: 8 }, { label: '{manager.first} said it on camera', mark: 'admitted_live', value: 4 }, { label: 'Onlookers are close to the door', mark: 'crowd_close', value: -3 }],
        favors: [STEADY_ON_CAMERA],
        summary: 'Agree to a filmed walk-out. {manager.first} leaves first, then {rider.first} comes out with the handgun left inside, filmed by the stream and the {outlet_short} camera.',
        pull: 'The way out {rider.first} asked for, with the camera on the door.',
        cost: '{rider.first} keeps the phone during the release and can stop to answer the viewers.',
        preview: { favorable: '{manager.first} comes out first, and {rider.first} follows filming, the handgun left inside.', mixed: '{manager.first} walks out, and {rider.first} backs inside, armed.', adverse: '{rider.first} stops at the door and backs in, filming. Near breaking point, the handgun appears with {manager.first} still inside.' },
        outcomes: {
          favorable: [
            { text: '{manager.first} goes out first, one hand on the door frame. {rider.first} follows with the phone held high and the other hand empty, as the negotiator asked. Two officers take {rider.him} on the sidewalk under the {outlet_short} light.',
              safe: ['manager'], out: ['rider'], objective: 75, pressure: -12 },
            ...walkOutEnding(),
            clerkToo('A minute earlier {clerk.first} gets clear of the stockroom, off camera.'),
          ],
          mixed: [
            { text: '{manager.first} gets out. On the step {rider.first} sees the {outlet_short} camera on the door and backs inside, phone still held high. By the time the door closes, the handgun is back in {rider.his} hand.',
              safe: ['manager'], mark: ['still_armed', 'performing'], bump: { stream: 12 }, next: { node: 'last_word' }, objective: 40, pressure: 4 },
            clerkToo('{clerk.first} is already outside when the door opens.'),
          ],
          adverse: turnsOn({
            lead: 'Before {manager.first} reaches the door, {rider.first} steps in front of it and turns the phone onto {rider.himself}. “Watch this,” {rider.he} {rider~tells|tell} the stream. “Watch what they do to me next.”',
            threat: '{rider.first} raises the handgun in the doorway, with {manager.first} still inside behind {rider.him}.',
            quiet: '{rider.first} backs inside, filming, and shuts the door on the street.',
            quietNext: { node: 'last_word' },
            extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 20 }, pressure: 10 } }),
        } },
      { id: 'walk_dark', title: 'Leave the phone on the register', icon: 'door', walks: 'manager', talksTo: 'rider', check: check(TALK, 6), minutes: 5,
        modifiers: [{ label: 'The camera is already on the wall', mark: 'phone_wall', value: 6 }, { label: '{rider.first} is playing to the chat', mark: 'performing', value: -5 }, { label: '{outlet} reposted the stream', mark: 'news_on', value: -4 }, { label: 'You told {rider.him} {clerk.first} would say it', mark: 'lied_clerk', value: -6 }],
        favors: [CALM_ON_CAMERA],
        summary: '{lead} asks {rider.first} to lay the phone face down and walk out with no stream of {rider.his} own. The {outlet_short} camera can still film the front door.',
        pull: 'The phone stays inside, and so does whatever {rider.first} would have said to it.',
        cost: '{rider.first} gives up the one recording that is {rider.his} own.',
        preview: { favorable: '{rider.first} sets the phone down and walks out to you.', mixed: '{manager.first} leaves, and {rider.first} stays inside, armed, through another long call.', adverse: '{rider.first} won’t put the phone down, and command orders you in. A rush can hurt {rider.him}.' },
        outcomes: {
          favorable: [
            { text: '{rider.first} lays the phone face down on the register and sets the handgun beside it. {manager.first} walks out first. Then {rider.first} follows, hands open, through the {outlet_short} light, and asks the first officer to tell {friend.first} {rider.he} {rider~is|are} all right.',
              safe: ['manager'], out: ['rider'], stabilize: ['stream'], next: { ending: 'out_quiet' }, objective: 75, pressure: -12 },
            foundOut('On the sidewalk {rider.first} looks past the officers for {clerk.first}, with the camera still on {rider.him}.', { exchange: [{ by: 'rider', line: 'Is {clerk.first} here? Let {clerk.him} tell them. You told me {clerk.he} said it.' }, { by: 'negotiator', line: 'Nobody asked {clerk.him}. I said it to get you to that door, and I was wrong.' }] }),
            clerkToo('{clerk.first} gets out too while the phone lies face down.'),
          ],
          mixed: [
            { when: ON_STREAM, text: '{rider.first} keeps picking the phone back up to read the comments, until {friend.first} types that {friend.he} {friend~is|are} still at the tape. Then {rider.he} {rider~sends|send} {manager.first} out and keeps to the counter, phone in hand.', safe: ['manager'], mark: ['still_armed', 'performing'], next: { node: 'last_word' }, objective: 40, minutes: 25 },
            { when: STREAM_CUT, text: '{rider.first} talks on the register phone and asks twice whether the van is still there. Then {manager.first} walks out, and {rider.first} stays put with the dead phone and the handgun.', safe: ['manager'], mark: ['still_armed'], next: { node: 'last_word' }, objective: 40, minutes: 25 },
            { when: STREAM_ENDED, text: '{rider.first} turns the dark phone over twice. {manager.first} is sent out first. {rider.first} stays where {rider.he} {rider~is|are}.', safe: ['manager'], mark: ['still_armed'], next: { node: 'last_word' }, objective: 40, minutes: 25 },
            clerkToo('In that time {clerk.first} slips out of the stockroom and away.'),
          ],
          adverse: [
            { when: ON_STREAM, text: '{rider.first} says {rider.he} {rider~knows|know} what happens to people nobody films. {rider.He} {rider~settles|settle} on the floor beside {manager.first} and {rider~props|prop} the phone on {rider.his} knee to keep streaming.', moves: { rider: 'provoked' }, objective: 10 },
            { when: STREAM_CUT, text: '{rider.first} refuses, the dead phone in {rider.his} lap, and won’t move from beside {manager.first}.', moves: { rider: 'provoked' }, objective: 10 },
            { when: STREAM_ENDED, text: '{rider.first} won’t walk without a picture and sits down by {manager.first}, turning the phone over and over.', moves: { rider: 'provoked' }, objective: 10 },
            ...afterRefusal('{clerk.first} sits against the stockroom door frame.', 'Command stops waiting on the phone. {rider.first} is still turned toward the screen when the team enters, and officers take the handgun.'),
          ],
        } },
      // The honest alternative to the lie: only what command can do, said plainly, once the clip is checked.
      { id: 'send_clip', title: 'Tell {rider.him} the clip goes to {delivery_app}', icon: 'handover', talksTo: 'rider', check: check(TALK, 0), minutes: 5, onlyIf: { marks: ['proof_seen'] }, authority: { concede: 'statement' }, certBonus: NEGOTIATOR,
        modifiers: [{ label: '{rider.first} still expects {clerk.first} on camera', mark: 'lied_clerk', value: -6 }],
        summary: '{lead} tells {rider.first} that command will send the matched porch clip and the order number to {delivery_app} tonight. Nobody on the line can say what {delivery_app} does with it.',
        pull: 'The clip is real, and the call gets made tonight.',
        cost: '{rider.first} must leave before {delivery_app} answers.',
        preview: { favorable: '{manager.first} leaves first, and {rider.first} follows to you.', mixed: '{manager.first} leaves, and {rider.first} waits inside for word that the clip has gone.', adverse: '{rider.first} wants the account back, gets no promise, and stops answering. Command orders you in.' },
        outcomes: {
          favorable: [
            { text: '{rider.first} makes the negotiator read the order number twice. Then {rider.he} {rider~waves|wave} {manager.first} to the door and {rider~leaves|leave} the handgun by the register. {rider.He} {rider~comes|come} out behind {manager.him} with the phone held out, filming the officers who take {rider.him}.',
              exchange: [{ by: 'rider', line: 'You’ll send it tonight.' }, { by: 'negotiator', line: 'Tonight. I’ll tell you when it’s gone.' }], safe: ['manager'], out: ['rider'], mark: ['clip_promised'], next: { ending: 'out_cleared' }, objective: 75, pressure: -10 },
            foundOut('At the car {rider.first} still wants to hear it from {clerk.first}.', { exchange: [{ by: 'rider', line: 'You told me {clerk.first} backed me. Put {clerk.him} on, even for ten seconds.' }, { by: 'negotiator', line: 'I can’t get {clerk.him} for you. {clerk.first} never said it. All we have is the clip.' }] }),
            clerkToo('{clerk.first} is let out of the stockroom first.'),
          ],
          mixed: [
            { text: '{rider.first} sends {manager.first} out and sits down by the register, the handgun at {rider.his} knee. {rider.He} {rider~says|say} {rider.he} will wait until the clip has gone.',
              safe: ['manager'], mark: ['still_armed', 'clip_promised'], next: { node: 'last_word' }, objective: 40 },
            clerkToo('{clerk.first} goes with {manager.him}.'),
          ],
          adverse: forcedEntry({ text: '{rider.first} asks whether {rider.his} {delivery_app} account will reopen. The negotiator can’t promise that, and {rider.first} stops answering.', objective: 10 },
            '{clerk.first} stays in the stockroom doorway.', 'The line to the register goes quiet. Command sends the team in, and officers have {rider.first} and the handgun before {rider.he} can answer.'),
        } },
      // The lie taken back (temptation). Only while it is open. Taking it back settles it as owned, not found.
      { id: 'own_lie', title: 'Tell {rider.him} the truth about {clerk.first}', icon: 'radio', talksTo: 'rider', check: check(TALK, 0), minutes: 4, onlyIf: LIE_OPEN,
        summary: '{lead} tells {rider.first} that {clerk.first} was never asked. The account your squad gave {rider.him} was made up.',
        pull: 'Take back the lie before {rider.first} reads it in the comments.',
        cost: '{rider.first} learns the police made up {clerk.first}’s words.',
        preview: { favorable: '{rider.first} hears you out and asks how to walk out.', mixed: '{rider.first} stands up and asks whether to believe the police now.', adverse: '{rider.first} hears that the police lied and sits down hard. Near breaking point, {rider.first} lines the handgun up on {manager.first}.' },
        outcomes: {
          favorable: [{ text: '{rider.first} asks what {clerk.first} really said. Nobody has asked {clerk.him} yet, the negotiator says. {rider.first} is quiet for a long minute, then asks what {rider.he} would have to do to walk out.',
            breaks: ['clerk_backs'], mark: ['lie_owned', 'lie_settled'], moves: { rider: 'honest' }, next: { node: 'last_word' }, objective: 20 }],
          mixed: [{ text: '{rider.first} stands up and asks the negotiator whether {rider.he} should believe the police now, and doesn’t wait for the answer.',
            breaks: ['clerk_backs'], mark: ['lie_owned', 'lie_settled', 'performing'], moves: { rider: 'heard' }, bump: { stream: 10 }, next: { node: 'last_word' }, objective: 10 }],
          adverse: turnsOn({
            lead: '{rider.first} says the police lied to {rider.him} just like {delivery_app}.',
            threat: '{rider.first} levels the handgun on {manager.first} and keeps it there.',
            quiet: '{rider.first} pockets the phone and sits with {rider.his} back to the counter.',
            quietNext: { node: 'last_word' },
            extra: { breaks: ['clerk_backs'], mark: ['lie_owned', 'lie_settled'], moves: { rider: 'provoked' }, bump: { stream: 12 }, pressure: 8 } }),
        } },
      // Only after the courier ended the stream and asked what happens to people who lie to everyone.
      { id: 'honest_next', title: 'Tell {rider.him} what happens next', icon: 'radio', walks: 'manager', talksTo: 'rider', check: check(TALK, -2), minutes: 5, onlyIf: { marks: ['ended_it'] }, certBonus: NEGOTIATOR,
        modifiers: [{ label: 'Your squad’s story about {clerk.first} is still out', mark: 'lied_clerk', value: -6 }],
        summary: '{lead} answers {rider.first}’s question straight. Nobody at the door can decide the charges or get {rider.first} back on {delivery_app}.',
        pull: '{rider.first} asked you a straight question.',
        cost: '{rider.first} can refuse to leave without a promise, keeping {manager.first} inside.',
        preview: { favorable: '{manager.first} goes first, and {rider.first} walks out to you.', mixed: '{rider.first} lets {manager.first} out but stays behind the counter.', adverse: '{rider.first} sits down beside {manager.first} and stops talking, and the order to go in follows.' },
        outcomes: {
          favorable: [
            { text: '{rider.first} hears all of it without cutting in, then tells {manager.first} to go. When {manager.first} is clear, {rider.first} puts the handgun down, follows with empty hands and asks the first officer whether {friend.first} is outside.',
              safe: ['manager'], out: ['rider'], next: { ending: 'out_quiet' }, objective: 75, pressure: -10 },
            foundOut('At the bottom of the steps {rider.first} asks one more thing.', { exchange: [{ by: 'rider', line: 'And {clerk.first}? Does {clerk.he} still say what {clerk.he} said?' }, { by: 'negotiator', line: '{clerk.He} never said anything. I made it up, and you should hear that from me.' }] }),
            clerkToo('{clerk.first} leaves the stockroom ahead of {manager.him}.'),
          ],
          mixed: [
            { text: '{rider.first} tells {manager.first} to go, then settles on the floor by the register and asks the negotiator for a minute alone.',
              safe: ['manager'], mark: ['still_armed'], next: { node: 'last_word' }, objective: 40 },
            clerkToo('{clerk.first} goes out with {manager.him}.'),
          ],
          adverse: forcedEntry({ text: '“That’s what I figured,” {rider.first} says, and lowers {rider.himself} down beside {manager.first}. {rider.He} {rider~doesn’t|don’t} answer after that.', objective: 10 },
            '{clerk.first} keeps to the stockroom.', 'Nobody answers the register line, and command gives the order. The team goes in on {rider.first} sitting by the cooler and takes the handgun without a shot.'),
        } },
      // A staged exit, and a real trade: the manager leaves now, and the courier keeps the phone and the handgun.
      { id: 'manager_first', title: 'Get {manager.first} out first', icon: 'door', walks: 'manager', talksTo: 'rider', check: check(TALK, -2), minutes: 4,
        modifiers: [{ label: '{rider.first} wants {clerk.first} to speak first', mark: 'lied_clerk', value: -6 }],
        summary: '{lead} asks {rider.first} to send {manager.first} out now and stay on the line to talk about the rest. {rider.first} keeps the handgun.',
        pull: '{manager.first} is clear of the handgun in minutes.',
        cost: '{rider.first} stays inside with the handgun after {manager.first} leaves.',
        preview: { favorable: '{manager.first} gets out, and {rider.first} stays on the line.', mixed: '{rider.first} argues the whole way while {manager.first} leaves.', adverse: '{rider.first} refuses the release and sits between {manager.first} and the way out. Near breaking point, the handgun stays on {manager.first}.' },
        outcomes: {
          favorable: [
            { text: '{rider.first} looks at {manager.first}, then at the door. “Go,” {rider.he} {rider~says|say}. “Tell them I let you.” {manager.first} walks out past the {outlet_short} camera, and {rider.first} stays at the register, armed, with the phone propped up.',
              safe: ['manager'], mark: ['still_armed'], moves: { rider: 'released' }, next: { node: 'last_word' }, objective: 40, pressure: -6 },
            clerkToo('{clerk.first} slips out behind {manager.him}.'),
          ],
          mixed: [
            { when: ON_STREAM, text: '{manager.first} gets out, but {rider.first} turns the phone on {manager.him} the whole way to the door and reads the comments out. Then {rider.he} {rider~turns|turn} the phone back on the room.',
              safe: ['manager'], mark: ['still_armed', 'performing'], bump: { stream: 8 }, next: { node: 'last_word' }, objective: 35 },
            { when: STREAM_DOWN, text: '{manager.first} walks out while {rider.first} argues over the register line. {rider.first} stays at the counter.',
              safe: ['manager'], mark: ['still_armed'], next: { node: 'last_word' }, objective: 35 },
            clerkToo('{clerk.first} is outside already.'),
          ],
          adverse: turnsOn({
            lead: '“Not till {manager.he} {manager~says|say} it,” {rider.first} tells the negotiator, and doesn’t move.',
            threat: '{rider.first} holds the handgun on {manager.first} and refuses the release.',
            quiet: '{rider.first} sits down on the floor between {manager.first} and the door.',
            quietNext: { node: 'last_word' },
            extra: { moves: { rider: 'provoked' }, bump: { stream: 10 }, pressure: 8 } }),
        } },
      tellTook('way_out'),
      clerkOnLine(),
      putPickup('way_out'),
      privateLine(),
    ] },

  // ------------------------------------------------------------------ stage 3: accused on camera
  { id: 'cornered', stage: 'resolve',
    threat: { chat: CHAT.cornered, label: 'The clip spreads', minutes: 13, text: 'Someone clips {manager.first}’s accusation, and the clip spreads faster than the stream did. The phone buzzes on the counter with every share, and {manager.first} watches the handgun and not the screen.', pressure: 6, moves: { rider: 'provoked' }, bump: { stream: 15 },
      beats: [
        { id: 'thief', at: 1.2, by: 'radio', line: 'Comments calling subject a thief. Lots of them.' },
        { id: 'rider_quiet', at: 2.6, by: 'rider', line: 'They were all on my side. Every one of them.' },
      ],
      timeout: commandTakesDoor('{rider.first} plays the clip on a loop, and the negotiator gets no answer. Command ends the wait, and the team goes in through the front.') },
    prompt: '{rider.first} has stopped reading the comments out. {rider.He} {rider~stares|stare} at the phone with the handgun hanging at {rider.his} side. {manager.first} is on the floor by {rider.his} feet.',
    exchange: [{ by: 'negotiator', line: 'Are you thinking about suicide?' }, { by: 'rider', line: 'I’m thinking everybody saw that.' }],
    choices: [
      { id: 'off_camera', title: 'Ask {rider.him} to shut the stream off', icon: 'radio', talksTo: 'rider', check: check(HOLD, 2), minutes: 5, certBonus: NEGOTIATOR, favors: [STEADY_ON_CAMERA],
        summary: '{lead} asks {rider.first} to end the broadcast with {rider.his} own thumb and talk to one person instead of thousands. The viewers who backed {rider.first} all night are calling {rider.him} a liar.',
        pull: 'The comments stop reaching {rider.first} live.',
        cost: 'The broadcast ends while {manager.first} is still inside.',
        preview: { favorable: '{rider.first} switches the stream off and talks to you.', mixed: '{rider.first} goes off the air and stops answering the line.', adverse: '{rider.first} keeps scrolling and slides down against the counter. Near breaking point, the handgun swings at {manager.first}.' },
        outcomes: {
          favorable: [{ text: '{rider.first} ends the stream with {rider.his} own thumb. {rider.He} {rider~sets|set} the phone face up on the register, where {rider.he} can still see it. Then {rider.he} {rider~asks|ask} the negotiator what happens to people who lie to everybody.',
            stabilize: ['stream'], bump: { stream: -100 }, mark: ['ended_it', 'stream_off', 'stream_down'], moves: { rider: 'honest' }, next: { node: 'way_out' }, objective: 20, pressure: -10 }],
          mixed: [{ text: 'The stream goes off. {rider.first} stays at the register and lets the line ring and ring.',
            stabilize: ['stream'], bump: { stream: -100 }, mark: ['stream_off', 'stream_down'], moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 12 }],
          adverse: turnsOn({
            lead: '{rider.first} keeps scrolling through the comments and won’t look up from the screen.',
            threat: '{rider.first} lifts the handgun toward {manager.first} and reads the next comment to {manager.him}.',
            quiet: '{rider.first} slides down to sit against the counter with the phone held to {rider.his} chest.',
            quietNext: { node: 'last_word' },
            extra: { moves: { rider: 'provoked' }, bump: { stream: 10 }, pressure: 8 } }),
        } },
      { id: 'friend_stays', title: 'Tell {rider.him} {friend.first} is waiting', icon: 'radio', talksTo: 'rider', check: check(TALK, -2), minutes: 5,
        summary: 'Tell {rider.first} that {friend.first} hasn’t left the patrol line and is asking for {rider.him}. {manager.first} is still beside the handgun.',
        pull: '{friend.first} has stood at the line since the stream began.',
        cost: 'You talk about a friend at the tape while {manager.first} sits within reach of the handgun.',
        preview: { favorable: '{rider.first} asks for {friend.first} and lets {manager.first} leave.', mixed: '{rider.first} asks if {friend.first} is still there and goes quiet.', adverse: '{rider.first} rejects the question and hurls the phone away. Near breaking point, {rider.first} jabs the handgun toward {manager.first}.' },
        outcomes: {
          favorable: [{ text: '{rider.first} asks whether {friend.first} is really still at the line. The negotiator says {friend.first} hasn’t moved.',
            exchange: [{ by: 'rider', line: 'Tell {friend.first} to stay there. Don’t let {friend.him} leave.' }], safe: ['manager'], mark: ['friend_named', 'still_armed'], moves: { rider: 'heard' }, next: { node: 'last_word' }, objective: 40 },
            { text: 'Then {rider.first} waves {manager.first} toward the door.' },
            clerkToo('{clerk.first} follows {manager.first} out the front.')],
          mixed: [{ text: '{rider.first} asks if {friend.first} is still there and then stops. {rider.He} {rider~keeps|keep} the line open and {rider~reads|read} the comments to {rider.himself}.',
            moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 8 }],
          adverse: turnsOn({
            lead: '{rider.first} tells the negotiator {friend.first} should go home, then reads out the newest comment.',
            threat: '{rider.first} points the handgun at {manager.first} from a foot away.',
            quiet: '{rider.first} throws the phone across the floor, where it lands face down and keeps streaming.',
            quietNext: { node: 'last_word' },
            extra: { moves: { rider: 'provoked' }, bump: { stream: 10 }, pressure: 8 } }),
        } },
    ] },

  // ------------------------------------------------------------------ stage 3: the handgun is up
  // A threat to life the team saw or heard: command can approve going in. The other two options keep
  // talking, and they differ by pace: keep the line going, or ask for the handgun down now.
  { id: 'threat', stage: 'resolve',
    threat: { chat: CHAT.threat, label: 'The {outlet_short} light hits the window', minutes: 10, text: 'The {outlet_short} light swings onto the front window and fills it white. {rider.first} stands in the middle of it, and {manager.first} turns {manager.his} face from the glare.', pressure: 6, bump: { stream: 20 },
      timeout: commandTakesDoor('Every officer holds position, and the handgun stays level on {manager.first}. Command stops waiting and sends the team through the front.') },
    prompt: 'The handgun is on {manager.first} now, and {manager.first} is looking {rider.first} in the face.',
    exchange: [{ by: 'radio', line: 'Window. Handgun on the manager. Holding.' }, { by: 'manager', line: '{rider.first}, put the gun down. Please.' }],
    promptIf: [
      { when: { marks: ['no_picture'] }, prompt: 'The phone still faces the wall. Over the speaker {rider.first} says the handgun is on {manager.first}, and {manager.first} says {rider.first}’s name.',
        exchange: [{ by: 'radio', line: 'No picture. Audio says the manager is at gunpoint.' }] },
      { when: { marks: ['shot_inside'], notSafe: ['clerk'] }, prompt: '{clerk.first} is pressed against the stockroom door. Dust is still settling from the shot into the ceiling, and the handgun is level at {manager.first}.' },
      { when: { marks: ['shot_inside'] }, prompt: 'Ceiling dust covers the counter where the shot went up. {rider.first} holds the handgun level at {manager.first}.' },
      { when: { notSafe: ['clerk'] }, prompt: 'The handgun is pointed at {manager.first}. {clerk.first} has gone quiet behind the stockroom door.' },
    ],
    choices: [
      { id: 'talk_down', title: 'Keep talking from cover', icon: 'radio', talksTo: 'rider', check: check(TALK, 6), minutes: 4, stress: 4, consequenceLevel: 'high', certBonus: NEGOTIATOR, favors: [STEADY_ON_CAMERA],
        modifiers: [{ label: 'You know where the order went', mark: 'knows_truth', value: 6 }],
        summary: '{lead} keeps {rider.first} on the register line from behind the patrol car while command holds the emergency team ready.',
        pull: '{rider.first} has answered this voice all night.',
        cost: '{manager.first} stays in the handgun’s line for as long as you talk.',
        preview: { favorable: '{rider.first} sets the handgun down, and {manager.first} walks out first.', mixed: '{manager.first} gets out the front while {rider.first} backs off, armed.', adverse: '{rider.first} fires through the front window, and officers outside can be hit.' },
        outcomes: {
          favorable: [
            { text: '{rider.first} lays the handgun on the counter where the window can see it and lets {manager.first} out first. Then, on the negotiator’s word, {rider.he} {rider~follows|follow} {manager.him} to the door, where two officers are waiting.',
              safe: ['manager'], out: ['rider'], moves: { rider: 'released' }, next: { ending: 'out_on_camera' }, objective: 75, pressure: -12 },
            foundOut('In the doorway {rider.first} halts and asks for {clerk.first} before taking another step.', { exchange: [{ by: 'rider', line: 'Hold on. Where’s {clerk.first}? I walk out when {clerk.he} {clerk~says|say} I didn’t take it.' }, { by: 'negotiator', line: '{clerk.first} never said that. I did, and it wasn’t true. Walk out anyway.' }] }),
            clerkToo('{clerk.first} is already clear by then.'),
          ],
          mixed: [
            { text: '{manager.first} gets out the front door. {rider.first} backs away from the window with the handgun still up.',
              safe: ['manager'], mark: ['still_armed'], moves: { rider: 'released' }, next: { node: 'last_word' }, objective: 40 },
            clerkToo('{clerk.first} is out before {manager.him}.'),
          ],
          // One shot, and the fire draw decides whether it hits anyone (sim/drawn-effects.ts).
          adverse: [{ text: '{rider.first} turns toward the street and fires through the front window. The crack of it fills the shop, and people at the tape scream and scatter. {manager.first}, still inside, drops to the floor behind the counter.', fire: { from: 'rider', mark: 'officer_down' }, mark: ['shot_inside'], moves: { rider: 'shots' }, bump: { stream: 25 }, next: { node: 'fired_on' }, pressure: 10 }],
        } },
      { id: 'go_in', title: 'Send the team in', icon: 'shield', team: { to: 'scene', entry: 'rider' }, check: check(ENTER, 8), minutes: 2, stress: 6, tempo: 'urgent', consequenceLevel: 'severe',
        requires: { certs: ['entry_team'] }, authority: 'entry', equipment: [{ tag: 'shield', value: 6, label: 'Shield up front' }],
        modifiers: [{ label: 'Your squad is already close', mark: 'team_close', value: 8 }, { label: 'The phone faces the wall', mark: 'no_picture', value: -6 }],
        summary: 'Your squad goes through the front door for {manager.first}. Anyone in that room can be badly hurt, and command will review the entry.',
        pull: 'Reach {manager.first} before {rider.first} fires.',
        cost: '{manager.first} can be killed. Officers and {rider.first} can be badly hurt.',
        preview: { favorable: 'You reach {manager.first} and get {manager.him} out.', mixed: '{manager.first} is out, hurt on the way.', adverse: '{rider.first} turns on {manager.first} as you come in. Either of them can be badly hurt, and {manager.first} may die.' },
        outcomes: {
          favorable: [
            { text: 'The team reaches {manager.first} and brings {manager.him} outside. Officers have {rider.first}, with the handgun out of reach.', safe: ['manager'], out: ['rider'], next: { ending: 'entry_clean' }, objective: 50 },
            foundOut('{rider.first} lies on the tile and turns {rider.his} head toward the officers.', { exchange: [{ by: 'rider', line: '{clerk.first}. Somebody get {clerk.first}. {clerk.He} {clerk~knows|know} I didn’t take it.' }, { by: 'negotiator', line: '{clerk.He} never said that. I told you {clerk.he} did. It was a lie.' }] }),
            clerkToo('An officer gets {clerk.first} clear as the front door opens.'),
          ],
          mixed: [
            { text: '{manager.first} hits the cooler hard as the team pulls {manager.him} clear, and leaves cradling one arm. Officers take {rider.first} away from the counter.', safe: ['manager'], harm: { manager: 'wounded' }, out: ['rider'], next: { ending: 'entry_hurt' }, objective: 35 },
            foundOut('{rider.first} twists around on the way out, looking for {clerk.first} in the faces at the door.', { exchange: [{ by: 'rider', line: 'Where’s {clerk.first}? You said {clerk.he} {clerk~was|were} talking. Let me see {clerk.him}.' }, { by: 'negotiator', line: 'Nobody talked to {clerk.him} about the bag. I made that up.' }] }),
            clerkToo('Officers bring {clerk.first} out ahead of the others.'),
          ],
          adverse: [
            { if: HOLDING, text: '{rider.first} pulls {manager.first} down behind the register as the door gives. {manager.first} hits the floor hard, and {rider.first} lets go when the team reaches them.', safe: ['manager'], harm: { manager: 'serious' }, out: ['rider'], next: { ending: 'entry_hurt' }, objective: 20, civilian: -15 },
            { if: BREAKING, text: 'A shot cracks behind the counter as the team comes through. The door bangs back, and {rider.first} swings the handgun at the officers.', harm: { manager: 'fatal' }, force: { on: 'rider', next: { hurt: { ending: 'manager_killed_rider_hurt' }, none: { ending: 'manager_killed' } }, noFatal: true }, objective: 5 },
            { if: BREAKING, text: '', fire: { from: 'rider' } },
            foundOut('From the floor, {rider.first} calls for {clerk.first}.', { if: HOLDING, exchange: [{ by: 'rider', line: '{clerk.first}! Say it. Say it to them right now!' }, { by: 'negotiator', line: 'You didn’t hear it from {clerk.him}. You heard it from me, and I made it up.' }] }),
            clerkToo('Officers pull {clerk.first} out during the entry.'),
          ],
        } },
      // The ask the negotiator usually saves: the handgun down now, before anything else.
      { id: 'ask_down', title: 'Ask for the handgun down now', icon: 'radio', talksTo: 'rider', check: check(PRESS, 8), minutes: 2, stress: 4, consequenceLevel: 'high', certBonus: NEGOTIATOR, favors: [CALM_ON_CAMERA],
        summary: '{lead} asks {rider.first} to put the handgun on the counter and step back from {manager.first}, now, before anything else.',
        pull: 'The handgun off {manager.first} without a long talk.',
        cost: '{rider.first} can refuse outright and keep {manager.first} through the night.',
        preview: { favorable: '{rider.first} puts the handgun down and lets {manager.first} go.', mixed: '{rider.first} lowers the handgun but keeps {manager.first} beside {rider.him}, so command sends you in.', adverse: '{rider.first} refuses the handgun down, and you take the front. {rider.first} can be hurt.' },
        outcomes: {
          favorable: [
            { text: '{rider.first} looks at the handgun, then sets it on the counter and steps back. {manager.first} gets up and walks to the door, where officers bring {manager.him} out.',
              safe: ['manager'], mark: ['still_armed'], moves: { rider: 'released' }, next: { node: 'last_word' }, objective: 40, pressure: -6 },
            clerkToo('An officer brings {clerk.first} out right after.'),
          ],
          mixed: forcedEntry({ text: '{rider.first} lowers the handgun to {rider.his} side but won’t let {manager.first} up. The negotiator stays on the line.', objective: 15 },
            '{clerk.first} stays pressed against the stockroom door.', 'With the muzzle low, command takes the chance. The team crosses the floor and takes the handgun out of {rider.first}’s hand before it comes back up.'),
          adverse: forcedEntry({ text: '“No,” {rider.first} says, and the handgun stays on {manager.first}. Command keeps the team where it is.', moves: { rider: 'provoked' }, pressure: 8 },
            '{clerk.first} is still behind the stockroom door.', 'Officers come in low along the front glass and get between {rider.first} and the counter.'),
        } },
    ] },

  { id: 'fired_on', stage: 'resolve',
    threat: { chat: CHAT.fired_on, label: '{friend.first} calls {rider.first}', minutes: 10, text: '{friend.first}’s name lights up {rider.first}’s phone, a call from the patrol line. {rider.He} {rider~looks|look} at the screen and {rider~lets|let} it ring.', pressure: 8, bump: { stream: 15 },
      timeout: commandTakesDoor('Both phones ring out, {friend.first}’s and the negotiator’s. The order to go in comes over the radio.') },
    prompt: 'There’s a hole in the front window. {rider.first} is crouched behind the counter next to {manager.first}, handgun in hand, and not looking at anyone.',
    exchange: [{ by: 'radio', line: 'Shot through the front glass. Checking officers outside.' }, { by: 'rider', line: 'I didn’t mean it. I didn’t mean that.' }],
    promptIf: [{ when: { marks: ['officer_down'] }, prompt: 'The front window has a hole in it. An officer is down behind the patrol car, waiting for an ambulance. {rider.first} crouches by {manager.first} with the handgun in {rider.his} hand.' }],
    choices: [
      { id: 'go_in', title: 'Order the rescue', icon: 'shield', team: { to: 'scene', entry: 'rider' }, check: check(ENTER, 5), minutes: 2, stress: 6, tempo: 'urgent', consequenceLevel: 'severe',
        requires: { certs: ['entry_team'] }, authority: 'entry', equipment: [{ tag: 'shield', value: 6, label: 'Shield up front' }],
        modifiers: [{ label: 'Your squad is already close', mark: 'team_close', value: 8 }, { label: 'The phone faces the wall', mark: 'no_picture', value: -6 }],
        summary: '{rider.first} has fired once, with {manager.first} an arm’s length away. Your squad takes the front door, and the entry goes to review whatever happens.',
        pull: 'Reach {manager.first} before {rider.first} fires again.',
        cost: 'A second shot can kill {manager.first} during the entry, and officers can be hurt.',
        preview: { favorable: 'You get to {manager.first} first and bring {manager.him} out.', mixed: 'You bring {manager.first} out with an injury.', adverse: 'As you come in, {rider.first} turns on {manager.first}, who can be badly hurt or killed.' },
        outcomes: {
          favorable: [
            { text: 'Officers reach {manager.first} and bring {manager.him} outside. The team takes hold of {rider.first}.', safe: ['manager'], out: ['rider'], next: { ending: 'entry_clean' }, objective: 45 },
            foundOut('With an officer on each arm, {rider.first} asks for {clerk.first} again.', { exchange: [{ by: 'rider', line: 'You said {clerk.first} was with me. So where is {clerk.he}?' }, { by: 'negotiator', line: '{clerk.first} was never with you. Those words were mine, and they weren’t true.' }] }),
            clerkToo('{clerk.first} is brought out through the stockroom.'),
          ],
          mixed: [
            { text: '{manager.first} goes down against the cooler in the rush and comes out holding {manager.his} arm. Officers have {rider.first} on the floor.', safe: ['manager'], harm: { manager: 'wounded' }, out: ['rider'], next: { ending: 'entry_hurt' }, objective: 30 },
            foundOut('{rider.first} keeps asking for {clerk.first} as the officers walk {rider.him} out.', { exchange: [{ by: 'rider', line: 'Just one word from {clerk.first}. That’s all I wanted.' }, { by: 'negotiator', line: 'There isn’t one. {clerk.first} was never asked, and I told you different.' }] }),
            clerkToo('{clerk.first} gets out first.'),
          ],
          adverse: [
            { if: HOLDING, text: '{rider.first} drags {manager.first} to the floor as officers come in. {manager.first} is badly hurt when they pull {manager.him} free, and {rider.first} lets go.', safe: ['manager'], harm: { manager: 'serious' }, out: ['rider'], next: { ending: 'entry_hurt' }, objective: 15, civilian: -15 },
            { if: BREAKING, text: 'A second shot cracks behind the counter. {rider.first} turns toward the door with the handgun.', harm: { manager: 'fatal' }, force: { on: 'rider', next: { hurt: { ending: 'manager_killed_rider_hurt' }, none: { ending: 'manager_killed' } }, noFatal: true }, objective: 5 },
            { if: BREAKING, text: '', fire: { from: 'rider' } },
            foundOut('With officers over {rider.him} on the tile, {rider.first} asks for {clerk.first}.', { if: HOLDING, exchange: [{ by: 'rider', line: 'Did {clerk.first} say it? The truth. Did {clerk.he} say it?' }, { by: 'negotiator', line: 'No. Nobody asked {clerk.him}. What I told you about {clerk.him} was a lie.' }] }),
            clerkToo('{clerk.first} crawls out of the stockroom while officers fill the front.'),
          ],
        } },
      { id: 'hold_talk', title: 'Hold and keep {rider.him} talking', icon: 'radio', talksTo: 'rider', check: check(TALK, 0), minutes: 4, stress: 4, certBonus: NEGOTIATOR, favors: [STEADY_ON_CAMERA],
        summary: '{lead} keeps calling from cover. {rider.first} is still answering, but the handgun is still beside {manager.first}.',
        pull: 'The register line is still open.',
        cost: 'A second shot would reach {manager.first} before any officer could.',
        preview: { favorable: '{rider.first} lets {manager.first} go and puts the handgun down.', mixed: '{manager.first} gets out, and {rider.first} keeps the handgun.', adverse: 'Another shot can badly hurt or kill {manager.first} before your squad reaches the counter.' },
        outcomes: {
          favorable: [
            { text: 'The negotiator gets {rider.first} to put the handgun down by the register and send {manager.first} out. A few minutes later {rider.first} walks out with open hands.', safe: ['manager'], out: ['rider'], moves: { rider: 'released' }, next: { ending: 'out_on_camera' }, objective: 60 },
            foundOut('On the step {rider.first} holds out open hands and asks for {clerk.first}.', { exchange: [{ by: 'rider', line: 'I’m out. I did what you said. Now bring {clerk.first} where I can see {clerk.him}.' }, { by: 'negotiator', line: '{clerk.first} isn’t going to say it. Nobody asked {clerk.him}. I made it up.' }] }),
            clerkToo('{clerk.first} gets out during the call.'),
          ],
          mixed: [
            { text: '{manager.first} walks out the front at {rider.first}’s word. {rider.first} stays down by the register, still holding the handgun.', safe: ['manager'], mark: ['still_armed'], moves: { rider: 'released' }, next: { node: 'last_word' }, objective: 40 },
            clerkToo('{clerk.first} goes with {manager.first}.'),
          ],
          adverse: [
            // The courier stays inside: the manager gets out hurt, and nobody went in.
            { if: HOLDING, text: 'A shot hits the counter, and the register screen goes black. {manager.first} is hurt. {manager.He} {manager~gets|get} to the door on a knee and a hand, and officers pull {manager.him} clear. {rider.first} stays down behind the register.', safe: ['manager'], harm: { manager: 'serious' }, objective: 15, civilian: -15 },
            { if: HOLDING, text: 'Officers cross the floor while {rider.first} is down, and take the handgun out of reach.', out: ['rider'], next: { ending: 'entry_hurt' } },
            { if: BREAKING, text: 'A shot goes off behind the counter. The team goes in.', harm: { manager: 'fatal' }, force: { on: 'rider', next: { hurt: { ending: 'manager_killed_rider_hurt' }, none: { ending: 'manager_killed' } }, noFatal: true }, objective: 5 },
            { if: BREAKING, text: '', fire: { from: 'rider' } },
            clerkToo('{clerk.first} makes it out in the noise.'),
          ],
        } },
    ] },

  // ------------------------------------------------------------------ stage 3: the manager is out
  // The question is no longer which door. It is what the courier carries out of the room: a last word
  // to the audience, the phone left behind, or hands open at the front. Every exit settles who is still
  // inside: when the manager hasn't left yet, the courier sends them out first, and an adverse result
  // keeps them.
  { id: 'last_word', stage: 'resolve',
    threat: { chat: CHAT.last_word, label: '{rider.first} sits down', minutes: 13, text: '{rider.first} steps back out of the window’s sight. Something scrapes the tile behind the counter.', pressure: 4,
      timeout: commandTakesDoor('{rider.first} keeps low beside the register and stops answering the line. Command orders the entry.') },
    prompt: '{manager.first} is outside. The handgun is within {rider.first}’s reach.',
    exchange: [{ by: 'rider', line: 'What happens when I open that door?' }, { by: 'negotiator', line: 'You come out with empty hands, and officers meet you on the step.' }],
    promptIf: [
      { when: { notSafe: ['manager'], marks: ['lie_owned'] }, prompt: 'Nobody asked {clerk.first} anything, and {rider.first} knows it now. {manager.first} sits close by on the floor, watching the door.', exchange: [] },
      { when: { notSafe: ['manager'] }, prompt: '{manager.first} is on the floor beside {rider.first} behind the counter, and neither of them is talking.', exchange: [] },
      { when: { marks: ['clerk_voiced'] }, prompt: '{rider.first} heard {clerk.first} say sorry and nothing else. {rider.He} {rider~sits|sit} with the handgun at {rider.his} knee and {rider~asks|ask} what sorry is worth at the door.' },
      { when: { marks: ['clip_promised'] }, prompt: '{manager.first} is outside. {rider.first} sits by the register until the negotiator says the clip has gone, the handgun within reach.' },
      { when: { marks: ['lie_owned'] }, prompt: '{rider.first} knows now that nobody asked {clerk.first} anything. {rider.He} {rider~keeps|keep} the handgun close and {rider~asks|ask} what happens at the door.' },
      { when: { marks: ['let_go'] }, prompt: '{manager.first} walked out when {rider.first} stepped aside. {rider.first} has the handgun in reach and wants to know what happens at the door.' },
    ],
    choices: [
      // The audience gets one sentence of the courier's own, and the courier chooses it.
      { id: 'last_word_stream', title: 'Give {rider.him} one last word for the stream', icon: 'radio', talksTo: 'rider', check: check(TALK, 2), minutes: 4, onlyIf: ON_STREAM, certBonus: NEGOTIATOR, authority: { concede: 'statement' },
        modifiers: [{ label: 'The handgun is in reach', mark: 'still_armed', value: -8 }],
        summary: '{lead} lets {rider.first} say one thing to the viewers before walking out. The {outlet_short} camera hears it too.',
        pull: '{rider.first} came here to be heard, and this is the last chance.',
        cost: '{rider.first} can stop the walk-out to answer the next comments.',
        preview: { favorable: '{rider.first} says one thing to the stream and walks out.', mixed: '{rider.first} says it, then stays to read the replies, and you take the door.', adverse: '{rider.first} reads the comments aloud and won’t stop, so the entry is ordered.' },
        outcomes: {
          favorable: [
            { if: CLEAR_NO_PROOF, text: '{rider.first} faces the phone and says it. Then {rider.he} {rider~lays|lay} the handgun beside the register and {rider~walks|walk} out the front, holding the phone out to the officers.',
              exchange: [{ by: 'rider', line: 'I never had that bag. I wanted you all to hear me say it.' }], out: ['rider'], stabilize: ['stream'], objective: 40 },
            { if: PROOF, text: '{rider.first} faces the phone and holds up the screen with the porch clip on it. Then {rider.he} {rider~walks|walk} out the front without the handgun.',
              exchange: [{ by: 'rider', line: 'The bag was on that step. I left it there.' }], out: ['rider'], stabilize: ['stream'], objective: 40 },
            { if: TOOK, text: '{rider.first} faces the phone and starts to say it, then stops. {rider.He} {rider~turns|turn} the stream off with {rider.his} thumb and {rider~comes|come} out with nothing in {rider.his} hands.',
              exchange: [{ by: 'rider', line: 'I kept the bag. I told you all I never had it.' }], reveal: ['rider_clear'], out: ['rider'], stabilize: ['stream'], objective: 40 },
            ...walkOutEnding(),
            managerToo('{rider.first} sends {manager.first} out ahead of {rider.him}.'),
            foundOut('Halfway to the door {rider.first} asks when {clerk.first} will say it too.', { exchange: [{ by: 'rider', line: 'You said {clerk.first} would say it on here. Is {clerk.first} coming, or not?' }, { by: 'negotiator', line: '{clerk.He} {clerk~isn’t|aren’t}. Nobody asked {clerk.him}, and I let you go on believing it.' }] }),
            clerkToo('{clerk.first} is led out while {rider.first} talks.'),
          ],
          mixed: [
            { when: { safe: ['manager'] }, text: '{rider.first} says it, and the replies pour in. {rider.He} {rider~reads|read} the angriest ones out loud and {rider~stays|stay} put.',
              mark: ['performing'], bump: { stream: 12 }, objective: 10, minutes: 30 },
            ...forcedEntry({ when: MANAGER_IN, text: '{rider.first} gets the words out, then reads comments aloud, an arm’s reach from {manager.first}.', mark: ['performing'], bump: { stream: 12 }, objective: 10, minutes: 30 }, '{clerk.first} keeps still in the stockroom.', 'While {rider.first} reads, command sends the team in through the front. Officers have the handgun before the next comment loads.'),
            foundOut('One reply comes from {clerk.first}’s own account and says {clerk.he} never backed anyone. {rider.first} reads it out twice.', { exchange: [{ by: 'rider', line: 'That’s {clerk.first}. That’s {clerk.his} name. Read it again, somebody read it.' }, { by: 'negotiator', line: 'It’s real. I told you {clerk.he} had said it, and {clerk.he} hadn’t.' }] }),
          ],
          adverse: [
            { when: { safe: ['manager'] }, text: '{rider.first} starts to speak, then reads the comments to the camera instead. The negotiator can’t get a word in.',
              moves: { rider: 'provoked' }, bump: { stream: 14 }, objective: 5 },
            ...forcedEntry({ when: MANAGER_IN, text: '{rider.first} tries to speak and ends up reading comments aloud, with {manager.first} down at {rider.his} feet.', moves: { rider: 'provoked' }, bump: { stream: 14 }, objective: 5 }, '{clerk.first} stays out of sight in the stockroom.', 'The team comes in while {rider.first} is reading, and the phone is still lit when officers take the handgun.'),
            foundOut('{rider.first} reads out a second post from {clerk.first}’s account. It says the same.', { exchange: [{ by: 'rider', line: 'You told me {clerk.first} was with me. {clerk.He} just said {clerk.he} {clerk~wasn’t|weren’t}.' }, { by: 'negotiator', line: 'It was my line, not {clerk.his}. I should have said so an hour ago.' }] }),
          ],
        } },
      { id: 'phone_down', title: 'Leave the phone and come out', icon: 'door', talksTo: 'rider', check: check(TALK, 3), minutes: 6,
        modifiers: [{ label: 'The handgun is in reach', mark: 'still_armed', value: -8 }, { label: '{rider.first} keeps answering viewers', mark: 'performing', value: -4 }],
        summary: '{lead} asks {rider.first} to set the phone on the register and walk to the officers with empty hands. The {outlet_short} camera still covers the front.',
        pull: 'Empty hands, and no picture of {rider.him} giving up.',
        cost: '{rider.first} has no recording of {rider.his} own to show later.',
        preview: { favorable: '{rider.first} walks out with empty hands, and the phone stays inside.', mixed: '{rider.first} comes out carrying the phone.', adverse: '{rider.first} turns back at the door, and officers go in.' },
        outcomes: {
          favorable: [
            { text: '{rider.first} leaves the phone where it stands and walks to the door with open hands. Officers have {rider.him} on the step.', out: ['rider'], next: { ending: 'out_quiet' }, objective: 32 },
            managerToo('{rider.first} sends {manager.first} out the front first.'),
            foundOut('Outside, {rider.first} turns to the nearest officer and asks what {clerk.first} said about the bag.', { exchange: [{ by: 'rider', line: 'What did {clerk.first} say? Exactly. Word for word.' }, { by: 'negotiator', line: 'Nothing. {clerk.He} {clerk~wasn’t|weren’t} asked, and I said {clerk.he} had been.' }] }),
            clerkToo('Officers have {clerk.first} out before either of them.'),
          ],
          mixed: [
            { when: ON_STREAM, text: '{rider.first} comes out holding the phone in front of {rider.him}, still streaming, and films the officers as they take {rider.him}.', out: ['rider'], next: { ending: 'out_on_camera' }, objective: 26 },
            { when: STREAM_DOWN, text: '{rider.first} walks out carrying the dark phone. Officers take hold of {rider.him} on the step.', out: ['rider'], next: { ending: 'out_on_camera' }, objective: 26 },
            managerToo('{manager.first} is walked out the front before {rider.first} leaves the counter.'),
            foundOut('{rider.first} looks for {clerk.first} among the faces at the tape.', { exchange: [{ by: 'rider', line: 'Is {clerk.first} out here? Somebody tell {clerk.him} I came out.' }, { by: 'negotiator', line: '{clerk.first} can’t vouch for you. Nobody ever asked {clerk.him}, and that’s on me.' }] }),
            clerkToo('{clerk.first} is already outside.'),
          ],
          adverse: [
            { when: { safe: ['manager'] }, text: 'At the door {rider.first} stops. “This is how it happens,” {rider.he} {rider~says|say}. “To people nobody sees.” Then {rider.he} {rider~walks|walk} back to the register.' },
            ...forcedEntry({ when: MANAGER_IN, text: '{rider.first} stops short, says nobody would see what happens next, and goes back to {manager.first} on the floor.' }, '{clerk.first} keeps out of sight among the shelves.', 'At the door {rider.first} has turned back. Command gives the word, and officers take the handgun from the counter.'),
          ],
        } },
      { id: 'out_front_hands', title: 'Talk {rider.him} out the front, hands open', icon: 'radio', talksTo: 'rider', check: check(TALK, -2), minutes: 6,
        modifiers: [{ label: 'The handgun is in reach', mark: 'still_armed', value: -8 }, { label: '{friend.first} is waiting outside', mark: 'friend_named', value: 4 }, { label: 'The porch clip is up', mark: 'proof_seen', value: 6 }, { label: 'You took the lie back', mark: 'lie_owned', value: 4 }, { label: '{clerk.first} said sorry on the line', mark: 'clerk_voiced', value: 4 }],
        summary: '{lead} talks {rider.first} step by step to the front door, phone in a pocket, in view of the {outlet_short} camera. {rider.first} will be able to see {friend.first} at the tape.',
        pull: 'Plain steps, and a friend in sight the whole way.',
        cost: 'The {outlet_short} camera films {rider.first} walking out.',
        preview: { favorable: '{rider.first} walks out the front with empty hands.', mixed: '{rider.first} comes out, then goes silent at the camera.', adverse: '{rider.first} won’t walk out where the street can see, and command gives the word to go in.' },
        outcomes: {
          favorable: [
            { text: '{rider.first} steps out with open hands and looks for {friend.first} at the patrol line. Officers take {rider.first} by the arms on the step, in front of the {outlet_short} camera.', out: ['rider'], objective: 32 },
            ...walkOutEnding(),
            managerToo('{rider.first} lets {manager.first} walk out ahead of {rider.him}.'),
            foundOut('{rider.first} asks to have {clerk.first} brought to the patrol line before the cuffs go on.', { exchange: [{ by: 'rider', line: 'Bring {clerk.first} to the tape. I want {clerk.him} to see me walk.' }, { by: 'negotiator', line: '{clerk.first} never backed it. I told you that, and I lied.' }] }),
            clerkToo('{clerk.first} is brought out before {rider.first} reaches the step.'),
          ],
          mixed: [
            { text: '{rider.first} comes out with empty hands and stops answering when the camera turns toward the door. Officers take {rider.him} away from the entrance.', out: ['rider'], next: { ending: 'out_on_camera' }, objective: 25 },
            managerToo('{manager.first} is walked out first, past the camera.'),
            foundOut('{rider.first} asks one question at the edge of the camera’s light, and it is about {clerk.first}.', { exchange: [{ by: 'rider', line: 'Did {clerk.first} really say it? You can tell me no. I can take no.' }, { by: 'negotiator', line: 'No. Nobody asked {clerk.him}. I’m the one who said {clerk.he} {clerk~was|were} on your side.' }] }),
            clerkToo('{clerk.first} is outside already.'),
          ],
          adverse: [
            { when: { safe: ['manager'] }, text: '{rider.first} says {rider.he} won’t walk out in front of a TV camera and sits back down behind the counter.', objective: 5 },
            ...forcedEntry({ when: MANAGER_IN, text: '{rider.first} refuses to walk out where {outlet_short} can film and stays down beside {manager.first}.', objective: 5 }, '{clerk.first} waits behind the stockroom door.', 'The front stays shut. Command sends the team in the side way, and officers have {rider.first} before the camera swings round.'),
          ],
        } },
    ] },
];

export const ENDINGS: Record<string, TreeEnding> = {
  // Reached only after the viewers heard where the order went (walkOutEnding, send_clip): the matched
  // porch clip, or the manager naming the clerk on the stream.
  out_cleared: { title: 'Out, with the bag accounted for', disposition: 'resolved',
    summary: '{rider.first} is with the team outside, and the handgun stayed on the counter. {manager.first} and {clerk.first} have left {place}. The viewers heard where the order went.',
    epilogue: '{friend.first} had kept {friend.his} delivery bag on all night at the patrol line, and took it off when {rider.first} came out.',
    epilogueIf: [
      { when: { marks: ['owned_up'] }, epilogue: 'The bag came out from under the seat of {rider.first}’s scooter. {rider.first} watched an officer carry it to the patrol car and didn’t look away.' },
      { when: { marks: ['told_clear'] }, epilogue: '{rider.first} asked to see {clerk.first} before the car door closed. {clerk.first} stood at the tape with {clerk.his} arms folded tight, and {rider.first} nodded once.' },
      { when: { marks: ['lie_found'] }, epilogue: '{rider.first} asked who had told {rider.him} that {clerk.first} backed {rider.him}. Nobody in the car answered.' },
      { when: { marks: ['lie_owned'] }, epilogue: '{rider.first} asked the officer at the car what else the negotiator had made up.' },
      { when: { marks: ['clip_promised'] }, epilogue: '{rider.first} asked for the order number to stay with the clip.' },
      { when: { marks: ['proof_seen'] }, epilogue: '{friend.first} saved a copy of the porch clip to {friend.his} own phone.' },
      { when: { marks: ['admitted_live'] }, epilogue: '{manager.first} asked how to withdraw the complaint.' },
    ] },
  out_on_camera: { title: 'Out the front door', disposition: 'resolved',
    summary: 'The team has {rider.first} outside. {manager.first} and {clerk.first} are out of {place}.',
    epilogue: '{friend.first} followed the patrol car on foot as far as the corner before an officer waved {friend.him} back.',
    epilogueIf: [
      { when: { marks: ['lie_found'] }, epilogue: '{rider.first} asked the first officer whose idea it was to say {clerk.first} backed {rider.him}.' },
      { when: { marks: ['officer_down'] }, epilogue: 'The injured officer asked whether both staff had come out.' },
      { when: { marks: ['friend_named'] }, epilogue: '{friend.first} stayed at the patrol line until {rider.first}’s car was out of sight.' },
      { when: { marks: ['exposed'] }, epilogue: '{manager.first} stayed at the tape until the patrol car turned the corner.' },
    ] },
  out_quiet: { title: 'Out, phone left inside', disposition: 'resolved',
    summary: '{rider.first} is with the team. {manager.first} and {clerk.first} are outside. The phone is still on the register.',
    epilogue: '{friend.first} waved once from the patrol line when {rider.first} came out.',
    epilogueIf: [
      { when: { marks: ['owned_up'] }, epilogue: '{rider.first} told the first officer where the bag was before anyone asked.' },
      { when: { marks: ['told_clear'] }, epilogue: '{rider.first} asked an officer whether {clerk.first} was still at the tape. {clerk.He} {clerk~was|were}.' },
      { when: { marks: ['lie_found'] }, epilogue: '{clerk.first} never learned what the police had told {rider.first} {clerk.he} said.' },
      { when: { marks: ['lie_owned'] }, epilogue: '{rider.first} told the officers the negotiator had lied once, and said so first.' },
      { when: { marks: ['admitted_quiet'] }, epilogue: '{manager.first} wrote the complaint number on {manager.his} hand so {manager.he} wouldn’t lose it.' },
    ] },
  entry_clean: { title: 'Out through an entry', disposition: 'resolved',
    summary: '{manager.first} and {clerk.first} are outside, unhurt. The team has {rider.first}, and the handgun is out of reach.',
    epilogue: '{manager.first} sat on the curb next to {clerk.first} and kept a hand on {clerk.his} shoulder.',
    epilogueIf: [{ when: { marks: ['officer_down'] }, epilogue: 'The officer hit at the window wanted to know if {clerk.first} was out.' }] },
  entry_hurt: { title: 'Out, but hurt', disposition: 'resolved',
    summary: '{manager.first} is outside, hurt, and waiting for an ambulance. The team has {rider.first}, and {clerk.first} is safe.',
    epilogue: '{manager.first} sat on the back step of the ambulance, holding {manager.his} arm, and watched {rider.first}’s car pull away.' },
  manager_killed: { title: '{manager.first} died', disposition: 'relief_partial',
    remainingTasks: ['Stay with {clerk.first} until someone comes for {clerk.him}', 'Keep {place} closed for the investigators'],
    summary: '{manager.first} died behind the counter at {place}. The team has {rider.first}. {clerk.first} sits outside and asks an officer to stay.',
    epilogue: 'The whiteboard by the register still had the night’s pickup times on it, in {manager.first}’s handwriting.' },
  manager_killed_rider_hurt: { title: '{manager.first} died and {rider.first} is hurt', disposition: 'relief_partial',
    remainingTasks: ['See {rider.first} into an ambulance', 'Hold {place} for the investigators'],
    summary: '{manager.first} died inside {place}. {rider.first} is hurt and in the team’s hands, and the ambulance hasn’t come yet. {clerk.first} is outside and asks to call home.',
    epilogue: '{clerk.first} gave an officer the keys to {place} and asked who was going to lock up.' },
  // The rider refused and command ordered the door (forcedEntry, entryAlone): a drawn use of the team's
  // hands left the rider hurt. Everyone else is out.
  rider_hurt: { title: '{rider.first} is hurt', disposition: 'resolved',
    summary: 'The team has {rider.first}, hurt, with the medic on the floor beside {rider.him}. {manager.first} and {clerk.first} are on the sidewalk with patrol.',
    epilogue: '{friend.first} watched the medic cut {rider.first}’s sleeve open and asked an officer which hospital.' },
  // Nobody chose and command took the door at its own hour (commandTakesDoor). With the manager still
  // inside the run-out ends `entry_hurt` instead.
  door_taken: { title: 'Command took the door', disposition: 'resolved',
    summary: 'Command ordered the door after {rider.first} stopped answering. The team has {rider.him}, and {manager.first} and {clerk.first} are outside.',
    epilogue: '{manager.first} sat on the curb with a jacket over {manager.his} knees and asked an officer what time it was.' },
  handed_over: { title: 'Command holds the scene', disposition: 'unresolved', remainingTasks: ['Get everyone out safely'],
    summary: 'Command holds the street, and the negotiator keeps trying the register phone.',
    epilogue: '{friend.first} was still at the patrol line when the next shift arrived.' },
};
