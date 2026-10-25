import { CHAT } from './hostage-live-chat';
import { BREAKING, CALM_ON_CAMERA, CHECKS, CLEAR, HOLDING, NEGOTIATOR, NO_PROOF, OBSERVANT_ON_CHAT, PROOF, STEADY_ON_CAMERA, SURVEILLANCE, TOOK, check, clerkToo, turnsOn } from './hostage-live-parts';
import type { TreeNode } from './types';

const { TALK, HOLD, ASK, MOVE, PRESS, READ } = CHECKS;
const CLEAR_NO_PROOF = [CLEAR, NO_PROOF];
const CLEAR_PROOF = [CLEAR, PROOF];

// Stages 1 and 2 of Going Live. The player meets the courier on the courier's own stage, learns that
// the stream is both what protects the courier and what traps the courier, and is made to choose
// between hearing what happened to the bag and keeping the room quiet. Each way of asking costs a
// different person something: the manager an answer heard before anyone checks it, the clerk a
// night of questions, the crowd its patience, the courier the audience.
//
// Marks this file sets and who reads them (sol review, 2026-10-24: one meaning per mark):
// - counter_seen: the squad has its own view of the counter (watch_feed, move_up_dark). camera_wall is
//   offered only without it, so its cost, losing the only picture, is true wherever it shows.
// - no_picture: the phone faces the wall and the squad has no view of its own (go_in -6, threat prompt).
// - admitted_live / admitted_quiet: the manager named the clerk on the stream / on the register line.
// - exposed: the manager accused the courier on the stream. An accusation, never proof.
// - address_posted: the store's address went out (move_up_dark -4). crowd_close: the courier waved the
//   corner up to the glass (walk_live -3).
export const APPROACH_NODES: TreeNode[] = [
  // ------------------------------------------------------------------ stage 1
  { id: 'going_live', stage: 'assess',
    // The address threat: a named commenter posts where the store is. The beats are the comments
    // closing in on it, read out by the courier, so the countdown is the guess getting warmer.
    threat: { chat: CHAT.going_live, label: 'The address goes out', minutes: 11, text: 'A comment from {handle} puts the street address of {place} under the picture. {rider.first} reads it out loud before anyone can say don’t. The shares come fast. At the corner, patrol starts turning cars around.', pressure: 4, mark: ['address_posted'], bump: { stream: 10 },
      beats: [
        { id: 'where_is_this', at: 1.2, by: 'rider', line: 'Somebody called {handle} wants the address. Say it, {manager.first}, and I won’t.', bump: { stream: 4 } },
        { id: 'manager_low', at: 3.4, by: 'manager', line: 'Those people don’t pay your rent, {rider.first}.', moves: { rider: 'provoked' }, bump: { stream: 5 } },
        { id: 'cross_streets', at: 6.8, by: 'radio', line: 'Comments are guessing cross streets. One of them is right.', bump: { stream: 6 } },
      ],
      timeout: { text: '{rider.first} leaves the callback unanswered and asks the viewers what to do.', next: { node: 'address_out' } } },
    prompt: 'The register phone rings beside the streaming phone. {rider.first} lets it ring and talks to the phone propped on the counter, louder each time the ringing starts again. {manager.first} is down by the drinks cooler and looks toward the stockroom door whenever the camera turns away.',
    exchange: [{ by: 'rider', line: 'Eleven-forty I was at the light on Calloway. You know that. You know it.' }, { by: 'manager', line: 'Put the phone down, {rider.first}. Whatever you want, you can ask me without them.' }, { by: 'rider', line: 'Without them? Without them you called me a thief.' }, { by: 'radio', line: 'Callback ringing. Subject at the counter, handgun out.' }],
    choices: [
      { id: 'on_stream', title: 'Call the register on speaker', icon: 'radio', talksTo: 'rider', check: check(TALK, 6), minutes: 4, certBonus: NEGOTIATOR, favors: [CALM_ON_CAMERA],
        summary: '{lead} rings again. {rider.first} answers only on speaker, so every question goes out live, and so does every answer.',
        pull: 'Contact now, on the line {rider.first} chose.',
        cost: 'The viewers hear your questions and {manager.first}’s answers.',
        preview: { favorable: '{rider.first} tells you what {rider.he} came for, out loud.', mixed: '{rider.first} answers the comments instead of you.', adverse: 'The camera stays on {manager.first}, and the handgun can be aimed at {manager.him}.' },
        outcomes: {
          favorable: [{ text: '{rider.first} answers the register phone and switches on the speaker. The viewers hear the negotiator ask what {rider.he} {rider~needs|need}.',
            exchange: [{ by: 'rider', line: 'Now you call. Eleven-forty, okay? Eleven-forty I was two blocks away. Write it down.' }, { by: 'rider', line: '{manager.first} says one sentence and I walk out. That’s all. One.' }, { by: 'negotiator', line: 'What would let {manager.first} speak without the handgun beside {manager.him}?' }],
            mark: ['terms'], moves: { rider: 'heard' }, bump: { stream: 10 }, next: { node: 'on_air' }, objective: 15 }],
          mixed: [{ text: '{rider.first} reads each question out to the comments and answers there. Somebody types that the police are stalling, and {rider.first} turns back to the phone to ask if that’s true.',
            exchange: [{ by: 'rider', line: 'They’re asking if you’re stalling. Are you? Because it sounds like stalling.' }], mark: ['performing'], moves: { rider: 'heard' }, bump: { stream: 14 }, next: { node: 'on_air' }, objective: 8 }],
          adverse: turnsOn({
            lead: '{rider.first} lifts the phone off the register and holds the camera on {manager.first}’s face while the negotiator talks.',
            threat: '{rider.first} brings the handgun down next to the phone, aimed at {manager.first}, so the stream gets both in one frame.',
            quiet: '{rider.first} hangs up in the middle of a question and turns back to the window to talk to the people who stayed.',
            quietNext: { node: 'on_air' },
            extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 16 }, pressure: 8 } }),
        } },
      { id: 'clerk_out', title: 'Bring {clerk.first} out of the stockroom', icon: 'door', walks: 'clerk', team: { to: 'escort' }, check: check(MOVE, -2), minutes: 4, consequenceLevel: 'moderate',
        summary: '{lead} takes two officers in for {clerk.first} and walks {clerk.him} out. The stockroom door shows at the edge of the stream.',
        pull: '{clerk.first} is nineteen and one door away from the handgun.',
        cost: 'If that door moves on camera, {rider.first} sees {clerk.first} leaving.',
        preview: { favorable: '{clerk.first} gets out, and the door stays out of the picture.', mixed: '{clerk.first} is out, but the door swings where the stream can see.', adverse: '{clerk.first} stops on camera, and {rider.first} can fire.' },
        outcomes: {
          favorable: [{ text: '{clerk.first} sets the case of water down on the stockroom floor and walks out between two officers. Behind the patrol car {clerk.he} {clerk~asks|ask} for {clerk.his} phone.',
            exchange: [{ by: 'clerk', line: 'I didn’t say anything to anybody. I didn’t.' }], safe: ['clerk'], next: { turn: 'clerk_out' }, objective: 30, pressure: -3 }],
          mixed: [{ text: '{clerk.first} gets out, but the stockroom door swings shut in a corner of the frame. Viewers catch it first. {rider.first} reads their comments out and turns to look at the stockroom.',
            exchange: [{ by: 'rider', line: 'Who’s back there? Hey. Who is back there?' }], safe: ['clerk'], mark: ['seen_back'], moves: { rider: 'team_seen' }, bump: { stream: 12 }, next: { turn: 'clerk_out' }, objective: 25, pressure: 4 }],
          // The shot needs a courier past breaking point, as every threat does. Otherwise the clerk is
          // stuck in the doorway and the officers can't bring the clerk on without crossing the picture.
          adverse: [
            { text: '{clerk.first} gets one step into the shop and stops dead, inside the edge of the picture.', moves: { rider: 'team_seen' }, bump: { stream: 14 }, pressure: 6 },
            { if: BREAKING, text: '{rider.first} sees {clerk.first} on the phone screen, turns and fires into the ceiling tiles. {clerk.first} drops to the floor in the doorway.',
              mark: ['shot_inside'], moves: { rider: 'shots' }, bump: { stream: 11 }, next: { node: 'threat' }, back: true, pressure: 8, civilian: -6 },
            { if: HOLDING, text: '{rider.first} shouts at the doorway, and {clerk.first} backs into the stockroom. The officers can’t reach {clerk.him} again without walking into the frame.',
              mark: ['seen_back'], next: { node: 'on_air' }, back: true, objective: 4 },
          ],
        } },
      // The look the call plants: who the manager watches. Quiet, cheap, and the only way to see it.
      { id: 'watch_feed', title: 'Watch the counter before calling', icon: 'search', team: { to: { vantage: 'scene' }, signal: { channel: 'visual', to: 'rider' } }, check: check(ASK, -4), minutes: 3, consequenceLevel: 'moderate',
        certBonus: SURVEILLANCE,
        summary: '{lead} takes your squad to the corner to watch through the glass, with the stream open on a tablet. Nobody answers the register while you look.',
        pull: 'Find out who looks where before anyone talks.',
        cost: '{rider.first} waits for the callback while viewers ask where the police are.',
        preview: { favorable: 'You see where the handgun points and who {manager.first} keeps looking at.', mixed: 'The chat spots police at the corner while you watch.', adverse: '{rider.first} gives up on the callback and may raise the handgun at {manager.first}.' },
        outcomes: {
          favorable: [
            { text: 'From the corner the squad has the counter twice, through the glass and on the tablet. The handgun is in {rider.first}’s right hand, pointed at the floor. Each time {rider.first} turns away, {manager.first} looks at the stockroom doorway, and once at the whiteboard behind the register.',
              reveal: ['handgun'], mark: ['glance', 'counter_seen'], moves: { rider: 'contact' }, next: { node: 'on_air' }, objective: 10 },
            { when: { lead: ['observant'] }, text: 'The lead officer can read the pickup whiteboard. One time on it has been rubbed out and written again.', mark: ['board_seen'] },
          ],
          mixed: [{ text: 'The squad gets a clear look at the counter and the handgun. So does the chat, which spots a helmet at the edge of the picture. {rider.first} swings the phone toward the street and tells the police to wave.',
            reveal: ['handgun'], mark: ['performing', 'counter_seen'], moves: { rider: 'team_seen' }, bump: { stream: 12 }, next: { node: 'on_air' }, objective: 4, pressure: 4 }],
          adverse: turnsOn({
            lead: 'The register rings out on the stream, and {rider.first} holds the phone up to the silence.',
            threat: '{rider.first} raises the handgun at {manager.first} and tells the camera the police had their chance.',
            quiet: '{rider.first} switches off the ringer, props the phone up and talks to the comments instead.',
            quietNext: { node: 'on_air' },
            extra: { exchange: [{ by: 'rider', line: 'That’s it? They just stop? You saw that. You all saw that.' }], mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 10 }, pressure: 8 } }),
        } },
    ] },

  // Stage 1, run out: the address is out, and strangers came to look.
  { id: 'address_out', stage: 'assess',
    threat: { chat: CHAT.address_out, label: 'More people reach the tape', minutes: 12, text: 'Patrol stops another person at the corner. {rider.first} reads the arrival out to the viewers.', pressure: 5, moves: { rider: 'provoked' }, bump: { stream: 12 },
      beats: [
        { id: 'past_tape', at: 3.2, by: 'radio', line: 'One on foot at the tape. Patrol has them.', bump: { stream: 4 } },
        { id: 'see_store', at: 6.6, by: 'rider', line: 'Somebody says they can see me through the glass. Can they? Can they see me?' },
      ],
      timeout: { text: '{rider.first} gives up on the police line and talks to the phone with {rider.his} back to the glass.', next: { node: 'on_air' } } },
    prompt: 'Two cars have pulled up at the corner with phones out the windows. Patrol waves them on, and they don’t go. {rider.first} reads the comments aloud as fast as they land.',
    exchange: [{ by: 'rider', line: 'They came. Look at that, they actually came. For me.' }, { by: 'radio', line: 'Corner. More on foot now, phones up.' }],
    choices: [
      { id: 'call_back', title: 'Call {rider.him} back now', icon: 'radio', talksTo: 'rider', check: check(TALK, 2), minutes: 4, certBonus: NEGOTIATOR, favors: [CALM_ON_CAMERA],
        summary: '{lead} rings the register and talks to {rider.first}, while the people at the corner listen on their own phones.',
        pull: '{rider.first} hasn’t stopped answering yet.',
        cost: '{rider.first} can repeat the call to the people gathering outside.',
        preview: { favorable: '{rider.first} picks up and tells you what {rider.he} {rider~wants|want}.', mixed: '{rider.first} answers, then waves the corner closer to the glass.', adverse: '{rider.first} hangs up, and {manager.first} can be held at gunpoint for the camera.' },
        outcomes: {
          favorable: [{ text: '{rider.first} picks up on the first ring and lets the negotiator wait before saying anything. Then it comes out in a rush, starting with the red light at 11:40.',
            exchange: [{ by: 'rider', line: 'Now there’s people outside, now you call. Now.' }, { by: 'rider', line: '{manager.first} says it on camera and I walk. I swear I walk.' }], mark: ['terms'], moves: { rider: 'heard' }, bump: { stream: 8 }, next: { node: 'on_air' }, objective: 12 }],
          mixed: [{ text: '{rider.first} picks up and talks right past the negotiator to the people at the corner, waving them toward the glass. Patrol has to move the line back a car length.',
            mark: ['performing', 'crowd_close'], moves: { rider: 'heard' }, bump: { stream: 12 }, next: { node: 'on_air' }, objective: 6 }],
          adverse: turnsOn({
            lead: '{rider.first} lets the negotiator talk for a minute, then tells the comments the police only call once a crowd shows up.',
            threat: '{rider.first} brings the handgun up at {manager.first} and holds the phone beside it, so the corner can see both.',
            quiet: '{rider.first} hangs up and swings the camera around to the street, to show the people who came.',
            quietNext: { node: 'on_air' },
            extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 14 }, pressure: 8 } }),
        } },
      { id: 'take_down', title: 'Ask {stream_app} to end the broadcast', icon: 'handover', check: check(PRESS, 4), minutes: 6, tempo: 'waiting', consequenceLevel: 'moderate',
        summary: 'Command asks {stream_app} to stop this broadcast. {lead} keeps ringing the register while the request is handled.',
        pull: 'Strangers stop watching {place} from their phones.',
        cost: 'The broadcast may disappear before {rider.first} speaks to the negotiator.',
        preview: { favorable: 'The picture goes black, and {rider.first} answers the register phone.', mixed: 'The broadcast ends, and {rider.first} starts another on {manager.first}’s phone.', adverse: 'The screen goes dark, and {rider.first} can pull {manager.first} up with the handgun against {manager.him}.' },
        outcomes: {
          favorable: [{ text: 'The picture goes black halfway through a comment. When the negotiator rings, {rider.first} answers before the first ring is over.',
            exchange: [{ by: 'rider', line: 'Where’d it go? Who turned it off? Was that you?' }], mark: ['cut', 'stream_down'], stabilize: ['stream'], bump: { stream: -100 }, moves: { rider: 'provoked' }, next: { node: 'off_air' }, objective: 8, pressure: 2 }],
          mixed: [{ text: 'The picture stays dark for about a minute. Then {rider.first} takes {manager.first}’s phone from {manager.his} pocket. The new broadcast runs on {manager.first}’s account, which the request never named.',
            mark: ['performing'], bump: { stream: -30 }, moves: { rider: 'provoked' }, next: { node: 'on_air' }, objective: 3, pressure: 6 }],
          adverse: turnsOn({
            lead: '{rider.first} watches the picture die. “That’s what you came here to do,” {rider.he} {rider~tells|tell} the room. “Take the people away.”',
            threat: '{rider.first} pulls {manager.first} up against the counter with the handgun under {manager.his} arm, facing the street.',
            quiet: 'The dead phone hits the stockroom door and drops to the tile. The register keeps ringing, and {rider.first} lets it.',
            quietNext: { node: 'off_air' },
            extra: { mark: ['cut', 'stream_down'], stabilize: ['stream'], bump: { stream: -100 }, moves: { rider: 'provoked' }, pressure: 10 } }),
        } },
    ] },

  // ------------------------------------------------------------------ stage 2: the stream is up, and the question is the bag
  { id: 'on_air', stage: 'adapt',
    threat: { chat: CHAT.on_air, label: 'Viewers ask for the staff', minutes: 11, text: 'Viewers start asking {rider.first} to let the staff leave. {rider.first} reads each request aloud instead of answering the negotiator.', pressure: 5, mark: ['turned_chat'], moves: { rider: 'provoked' }, bump: { stream: 10 },
      beats: [
        { id: 'friend_types', at: 1.4, by: 'rider', line: '{friend.first} says come out, I got you. {friend.first}, I can’t.' },
        { id: 'count_two', at: 2.8, by: 'radio', line: 'Stream climbing fast. {outlet_short} van two blocks out.', bump: { stream: 6 } },
        { id: 'manager_asks', at: 3.9, by: 'manager', line: 'Can I stand up? My knees, {rider.first}.', moves: { rider: 'contact' } },
      ],
      timeout: { text: 'The police say nothing on the stream while the requests pile up. {rider.first} tells the viewers the police have nothing to say.', next: { node: 'chat_turned' } } },
    prompt: '{rider.first} holds the streaming phone toward {manager.first}. {manager.first} asks whether the camera has to stay on.',
    exchange: [{ by: 'rider', line: 'Tell them. Tell them what you told {delivery_app}.' }, { by: 'manager', line: 'Not with that in your hand.' }],
    promptIf: [
      { when: { marks: ['lied_clerk'] }, prompt: '{rider.first} repeats the claim that {clerk.first} backed the story, then turns the phone on {manager.first} for the rest.' },
      { when: { marks: ['terms'] }, prompt: '{rider.first} has told the stream what ends this. One sentence from {manager.first}, and {rider.he} {rider~walks|walk} out. {manager.first} hasn’t said a word since.' },
      { when: { marks: ['glance'] }, prompt: 'Through the glass, {manager.first} looks at the stockroom door again. The comments keep asking {rider.first} where {rider.he} {rider~was|were} at 11:40.' },
    ],
    choices: [
      // An answer, out loud, from the one person who filed the complaint. It can't be taken back.
      { id: 'manager_speaks', title: 'Ask whether {manager.first} wants to answer', icon: 'radio', talksTo: 'manager', check: check(TALK, 4), minutes: 3, consequenceLevel: 'high',
        modifiers: [{ label: 'You saw who {manager.he} {manager~watches|watch}', mark: 'glance', value: 6 }, { label: 'You saw the rubbed-out time', mark: 'board_seen', value: 3 }],
        summary: 'Ask {rider.first} to let {manager.first} answer on the stream, if {manager.first} chooses to. Nobody knows what {manager.he} will say, and the handgun is still in the room.',
        pull: '{rider.first} hears {manager.first} speak for {manager.himself}.',
        cost: 'The viewers will hear the answer before you can check it.',
        preview: { favorable: '{manager.first} answers into the phone, as much as {manager.he} {manager~decides|decide} to.', mixed: '{manager.first} starts to answer, and what comes out isn’t what {rider.first} wanted.', adverse: '{manager.first} won’t answer beside the handgun, and {rider.first} may aim the handgun at {manager.him}.' },
        outcomes: {
          favorable: [
            // The clerk took it, and the manager reported the courier to keep the clerk's job.
            { if: CLEAR_NO_PROOF, text: '{manager.first} gets up using the cooler handle, faces the phone and names {clerk.first}. Then {manager.he} {manager~looks|look} at the stockroom door, and the stream sees where.',
              exchange: [{ by: 'manager', line: 'You didn’t take it. {clerk.first} did. {clerk.He} {clerk~is|are} my {clerk^nephew|niece|relative}, and {clerk.he} {clerk~is|are} nineteen.' }], reveal: ['rider_clear'], mark: ['admitted_live', 'knows_truth'], moves: { rider: 'honest' }, next: { node: 'way_out' }, objective: 20, pressure: -6 },
            // The courier kept it. The manager keeps it off the stream if the stream lets the manager.
            { if: TOOK, text: '{manager.first} gets up holding the cooler door, faces the phone, then turns away from it. {manager.He} {manager~says|say} the rest is for the police and {manager~sits|sit} back down.',
              exchange: [{ by: 'manager', line: 'Not on camera. I won’t do that to you. Put that down and ask me again.' }], mark: ['held_back'], moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 8 },
            // Nobody took it: the manager only knows what the app said.
            { if: CLEAR_PROOF, text: '{manager.first} stands, faces the phone and reads out what the {delivery_app} screen says. The whiteboard behind {manager.him} has the same time. “So who’s lying?” {rider.first} asks, and nobody in the store has an answer.',
              exchange: [{ by: 'manager', line: '{delivery_app} said delivered. I wrote down what it said. That’s all I did.' }], mark: ['app_said'], moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 12 },
          ],
          mixed: [
            { if: CLEAR, text: '{manager.first} gets as far as {rider.first}’s name. {rider.first} talks right over {manager.him}, back to the red light and the timestamp. {rider.He} {rider~tells|tell} {manager.him} to stand up if {manager.he} {manager~means|mean} it.',
              mark: ['performing'], moves: { rider: 'heard' }, bump: { stream: 8 }, next: { node: 'way_out' }, objective: 8 },
            // The accusation the courier didn't want goes out anyway. It is the manager's account, not proof.
            { if: TOOK, text: '{manager.first} stands with a hand on the cooler door and talks to the camera, not to {rider.first}. {manager.He} {manager~says|say} the store camera has {rider.first} collecting the bag, and {delivery_app} has it delivered. The comments come faster than {rider.first} can read.',
              exchange: [{ by: 'manager', line: 'You collected it just after eleven-forty and marked it delivered. Ask the customer.' }], mark: ['exposed'], moves: { rider: 'provoked' }, bump: { stream: 15 }, next: { node: 'cornered' }, objective: 10 },
          ],
          adverse: turnsOn({
            lead: '{manager.first} tells the phone {manager.he} won’t answer anything while the handgun is beside {manager.him}.',
            threat: '{rider.first} brings the handgun up level with {manager.first}, in full view of the stream.',
            quiet: '{rider.first} turns the camera back on {rider.himself} and tells the viewers {manager.first} won’t say it.',
            quietNext: { node: 'way_out' },
            extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 18 }, pressure: 10 } }),
        } },
      // The crowd as a source: slow, public, and worth something only once the squad has checked it.
      { id: 'ask_chat', title: 'Look for a delivery witness', icon: 'search', check: check(READ, 4), minutes: 5, certBonus: SURVEILLANCE, favors: [OBSERVANT_ON_CHAT],
        modifiers: [{ label: 'The clerk couldn’t say', mark: 'clerk_unsure', value: 4 }],
        summary: '{lead} reads the comments on a tablet for anyone who saw the order after it left {place}. Your squad checks each claim before it counts.',
        pull: 'A viewer may have seen what nobody in the store did.',
        cost: '{manager.first} stays on the floor while you sort through strangers.',
        preview: { favorable: 'You find a claim your squad can check.', mixed: 'A name turns up in the comments, and {rider.first} reads it out.', adverse: 'The comments hand {rider.first} more to perform, and the handgun can come up at {manager.first}.' },
        outcomes: {
          favorable: [
            { if: PROOF, text: 'A comment from {handle} links a porch camera clip from the customer’s street. A bag sits on a step two doors down at 11:52, and at 12:10 a neighbor carries it inside. The team checks the address against the order and the label number on the bag. Both match.',
              exchange: [{ by: 'rider', line: 'That’s my bag. That’s my bag on that step. I delivered it.' }], reveal: ['proof', 'rider_clear'], mark: ['proof_seen', 'knows_truth'], moves: { rider: 'honest' }, bump: { stream: 10 }, next: { node: 'way_out' }, objective: 25, pressure: -8 },
            { if: CLEAR_NO_PROOF, text: 'A viewer called {handle} used to work nights at {place} and writes that the night clerk ate from the cooler on shift. The team writes the account down and asks for an order number. Nobody posts one.',
              reveal: ['proof'], moves: { rider: 'heard' }, bump: { stream: 8 }, next: { node: 'way_out' }, objective: 8 },
            { if: TOOK, text: 'Under the picture, {handle} links {rider.first}’s own stream from Tuesday. At 12:20 the handlebar camera shows a bag strapped on the back, after {delivery_app} had the order delivered at 11:58. The team freezes the frame, and the label number matches. {rider.first} says it was a different bag.',
              reveal: ['proof', 'rider_clear'], mark: ['knows_truth'], moves: { rider: 'provoked' }, bump: { stream: 8 }, next: { node: 'way_out' }, objective: 8 },
          ],
          mixed: [{ text: 'The squad finds a comment naming {clerk.first} as the one on the register that night. {rider.first} reads it out and asks the line where {clerk.first} is now.',
            mark: ['clerk_named', 'performing'], moves: { rider: 'provoked' }, bump: { stream: 12 }, next: { node: 'way_out' }, objective: 4, pressure: 4 }],
          adverse: turnsOn({
            lead: 'A viewer posts a photo of the patrol cars at the corner, and {rider.first} holds it up to the camera.',
            threat: '{rider.first} points the handgun toward {manager.first} and asks the viewers who else is out there.',
            quiet: '{rider.first} keeps interrupting the call to read new comments.',
            quietNext: { node: 'way_out' },
            extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 20 }, pressure: 8 } }),
        } },
      // Only while the stream is the squad's one picture of the counter: there, walling the camera
      // costs that picture. With the squad's own view, the ask would cost nothing and is not offered.
      { id: 'camera_wall', title: 'Turn the camera off {manager.first}', icon: 'radio', talksTo: 'rider', check: check(TALK, 14), minutes: 4, certBonus: NEGOTIATOR, favors: [STEADY_ON_CAMERA],
        onlyIf: { notMarks: ['counter_seen'] },
        summary: '{lead} asks {rider.first} to face the phone at the plaster and leave the sound on. The stream stops showing {manager.first}, and the handgun goes out of frame with {manager.him}.',
        pull: 'The viewers no longer see {manager.first} on the floor.',
        cost: 'Your squad loses its only picture of {rider.first}’s hands.',
        preview: { favorable: '{rider.first} faces the phone at the wall and answers you.', mixed: 'The phone turns away, then back when the comments complain.', adverse: '{rider.first} keeps the picture and may aim the handgun at {manager.first}.' },
        outcomes: {
          favorable: [
            { text: '{rider.first} props the phone against the plaster beside the register, sound still on. Comments keep scrolling, and nobody reads them out. For once, the negotiator is who {rider.first} answers.',
              mark: ['phone_wall', 'no_picture'], moves: { rider: 'contact' }, next: { node: 'way_out' }, objective: 15, pressure: -5 },
            { when: { lead: ['steady'] }, text: 'The negotiator keeps the same even pace through the noise from the speaker.' },
          ],
          mixed: [{ text: '{rider.first} turns the phone away, then picks it up to check the comments and points the camera back at the counter.',
            mark: ['performing'], moves: { rider: 'heard' }, bump: { stream: 6 }, next: { node: 'way_out' }, objective: 6 }],
          adverse: turnsOn({
            lead: '{rider.first} tells the camera the police want the viewers gone too, after {delivery_app} took the job.',
            threat: 'Then {rider.he} {rider~points|point} the handgun at {manager.first} and {rider~asks|ask} the stream what happens now.',
            quiet: 'A few comments call {rider.first} a coward for hiding the picture. {rider.first} props the phone higher on the register to take in more of the room.',
            quietNext: { node: 'way_out' },
            extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 12 }, pressure: 8 } }),
        } },
      // Command can end the stream; the courier can't stop it, and will know who did.
      { id: 'cut_feed', title: 'Have command take the stream down', icon: 'handover', check: check(PRESS, 2), minutes: 6, tempo: 'waiting', consequenceLevel: 'moderate',
        summary: 'Command contacts {stream_app} while {lead} stays on the register line. {rider.first} has not agreed to end anything.',
        pull: 'Take away the audience {rider.first} talks to.',
        cost: 'The stream can vanish while {manager.first} is still beside {rider.first}.',
        preview: { favorable: 'The stream cuts out, and {rider.first} picks up your line.', mixed: '{rider.first} gets a second phone streaming within minutes.', adverse: '{rider.first} watches the stream end and can hold the handgun on {manager.first} at the window.' },
        outcomes: {
          favorable: [{ text: 'The stream cuts out in the middle of a sentence. {rider.first} stares at the black screen, then grabs the register phone when it rings and asks for the stream back.',
            exchange: [{ by: 'rider', line: 'Put it back. Put it back and I’ll talk.' }], mark: ['cut', 'stream_down'], stabilize: ['stream'], bump: { stream: -100 }, moves: { rider: 'provoked' }, next: { node: 'off_air' }, objective: 10, pressure: 4 }],
          mixed: [
            { when: { notSafe: ['clerk'] }, text: 'The stream goes black. {rider.first} shouts for {clerk.first} to slide {clerk.his} phone out of the stockroom and starts again from {clerk.his} account. The old viewers find it within minutes.',
              exchange: [{ by: 'rider', line: 'You can’t turn off two phones.' }], mark: ['performing'], bump: { stream: -30 }, moves: { rider: 'provoked' }, next: { node: 'way_out' }, objective: 4, pressure: 6 },
            { when: { safe: ['clerk'] }, text: 'The stream goes black. {rider.first} pulls {manager.first}’s phone from {manager.his} pocket and starts again from that account. Within minutes the old viewers are back.',
              exchange: [{ by: 'rider', line: 'You can’t turn off every phone in here.' }], mark: ['performing'], bump: { stream: -30 }, moves: { rider: 'provoked' }, next: { node: 'way_out' }, objective: 4, pressure: 6 },
          ],
          adverse: turnsOn({
            lead: '{rider.first} watches the stream end on the screen, then turns to the front window.',
            threat: '{rider.first} drags {manager.first} up by the collar and puts the handgun against {manager.his} back, facing the glass.',
            quiet: '{rider.first} sweeps the dead phone off the counter and stands over {manager.first} without answering the line.',
            quietNext: { node: 'off_air' },
            extra: { mark: ['cut', 'stream_down'], stabilize: ['stream'], bump: { stream: -100 }, moves: { rider: 'provoked' }, pressure: 10 } }),
        } },
    ] },

  // Stage 2, run out: the comments went on without an answer.
  { id: 'chat_turned', stage: 'adapt',
    threat: { chat: CHAT.chat_turned, label: 'Viewers guess about the handgun', minutes: 11, text: 'Viewers start guessing where {rider.first} got the handgun and whether the police will use theirs. {rider.first} answers every guess to the camera.', pressure: 6, moves: { rider: 'provoked' }, bump: { stream: 12 },
      beats: [
        { id: 'three_k', at: 3.0, by: 'radio', line: 'More people at the corner. Patrol is holding the line.', bump: { stream: 4 } },
        { id: 'knees', at: 6.2, by: 'manager', line: 'Let me sit up at least. Please, {rider.first}.', moves: { rider: 'contact' } },
      ],
      timeout: { text: 'The guesses run out before the police say anything. {rider.first} gets to {rider.his} feet, holding the phone and the handgun.', next: { node: 'way_out' } } },
    prompt: '{rider.first} crouches by the cooler and reads comments to {manager.first}, holding the screen up to {manager.his} face.',
    exchange: [{ by: 'rider', line: 'This one says I took it. Tell them who took it.' }, { by: 'manager', line: 'I can’t read it from down here.' }],
    choices: [
      { id: 'say_true', title: 'Address the viewers on speaker', icon: 'radio', talksTo: 'rider', check: check(TALK, 2), minutes: 3, certBonus: NEGOTIATOR, favors: [STEADY_ON_CAMERA],
        summary: '{lead} asks for the register phone on speaker and talks to the viewers. {rider.first} can end the call at any point.',
        pull: 'The chat argues with you instead of with {rider.first}.',
        cost: '{rider.first} can cut off the negotiator in front of everyone watching.',
        preview: { favorable: '{rider.first} answers the negotiator while the viewers argue about the call.', mixed: 'Comments argue with you, and {rider.first} reads the angriest ones out.', adverse: '{rider.first} cuts off the speaker and may turn the handgun on {manager.first}.' },
        outcomes: {
          favorable: [{ text: 'The negotiator tells the viewers that officers are outside and listening, and asks them to stop guessing. For a few seconds the comments argue with the police, and {rider.first} gets up from the cooler to answer the line.',
            moves: { rider: 'heard' }, bump: { stream: -6 }, next: { node: 'way_out' }, objective: 12, pressure: -4 }],
          mixed: [{ text: 'The chat fills with people arguing about the negotiator’s voice. {rider.first} reads the meanest ones out, standing between the phone and {manager.first} again.',
            mark: ['performing'], moves: { rider: 'heard' }, bump: { stream: 8 }, next: { node: 'way_out' }, objective: 5 }],
          adverse: turnsOn({
            lead: '{rider.first} grabs the phone off the register before the negotiator finishes and tells the stream the police are reading from a script.',
            threat: '{rider.first} swings the handgun to {manager.first} and asks the chat whether that sounds scripted.',
            quiet: '{rider.first} mutes the speaker and goes on reading to {manager.first}.',
            quietNext: { node: 'way_out' },
            extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 14 }, pressure: 8 } }),
        } },
      { id: 'let_go_now', title: 'Ask for {manager.first} to leave', icon: 'door', talksTo: 'rider', check: check(TALK, 6), minutes: 4, consequenceLevel: 'high',
        summary: 'Ask {rider.first} to let {manager.first} walk out now, on camera, while the comments argue. {rider.first} came here to hear {manager.first} say one sentence.',
        pull: '{manager.first} out of reach of the handgun, now.',
        cost: '{rider.first} can refuse and keep {manager.first} beside the handgun.',
        preview: { favorable: '{rider.first} steps aside, and {manager.first} makes it out the front.', mixed: '{rider.first} says no and keeps {manager.first} by the cooler.', adverse: '{manager.first} stays trapped, and {rider.first} can bring the handgun up.' },
        outcomes: {
          favorable: [{ text: '{rider.first} steps back from the cooler. {manager.first} pulls up on the handle and walks to the door, and two officers bring {manager.him} out onto the sidewalk.',
            safe: ['manager'], mark: ['still_armed', 'let_go'], moves: { rider: 'released' }, next: { node: 'last_word' }, objective: 40, pressure: -6 },
            clerkToo('{clerk.first} hurries out a step behind {manager.him}.')],
          mixed: [{ text: '{rider.first} says {manager.first} stays until {manager.he} {manager~says|say} it. {manager.first} doesn’t say it. The handgun stays low, by {rider.first}’s leg.',
            moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 5 }],
          adverse: turnsOn({
            lead: '{rider.first} reads the request back to the chat and asks them what the police want with {manager.first}.',
            threat: '{rider.first} puts the handgun on {manager.first} and says now nobody is leaving.',
            quiet: '{rider.first} drops down beside {manager.first}, between {manager.him} and the door.',
            quietNext: { node: 'way_out' },
            extra: { moves: { rider: 'provoked' }, bump: { stream: 10 }, pressure: 8 } }),
        } },
    ] },

  // ------------------------------------------------------------------ stage 2: the stream is down
  // Reached only after command cut the stream (take_down, cut_feed), so every prompt reads `cut`.
  { id: 'off_air', stage: 'adapt',
    threat: { chat: CHAT.off_air, label: '{rider.first} stands over {manager.first}', minutes: 12, text: '{rider.first} stops pacing and plants {rider.himself} over {manager.first}. “Who took it?” {rider.he} {rider~asks|ask}, again and again.', pressure: 6, moves: { rider: 'provoked' },
      beats: [
        { id: 'stops_twice', at: 1.5, by: 'radio', line: 'Window. Subject standing over the manager again.' },
        { id: 'no_one', at: 3.1, by: 'rider', line: 'There’s no camera now. You get that?' },
      ],
      timeout: { text: 'The register phone doesn’t ring. {rider.first} asks again, and this time {manager.first} lifts {manager.his} head to answer.', next: { node: 'way_out' } } },
    prompt: 'Command ended the broadcast. {rider.first} paces the length of the counter and stops each time {rider.he} {rider~reaches|reach} {manager.first}.',
    exchange: [{ by: 'rider', line: 'You did that. You took them away.' }, { by: 'negotiator', line: 'This line is still open, {rider.first}.' }],
    promptIf: [
      { when: { notSafe: ['clerk'] }, prompt: 'The broadcast is gone. {rider.first} walks between {manager.first} on the floor and the stockroom, where {clerk.first} is hiding.' },
    ],
    choices: [
      { id: 'own_it', title: 'Tell {rider.him} it was command', icon: 'radio', talksTo: 'rider', check: check(TALK, 2), minutes: 4, certBonus: NEGOTIATOR, favors: [CALM_ON_CAMERA],
        summary: '{lead} tells {rider.first} that command ended the stream and won’t bring it back, then asks for {manager.first}.',
        pull: 'A true answer, when {rider.first} asks who did it.',
        cost: '{rider.first} can refuse the register call while {manager.first} is still inside.',
        preview: { favorable: '{rider.first} talks to you and lets {manager.first} walk out.', mixed: '{rider.first} believes you and goes back to pacing.', adverse: 'The line stays open, but {rider.first} can press the handgun against {manager.first}.' },
        outcomes: {
          favorable: [{ text: 'The negotiator explains the takedown, then asks for {manager.first} to leave. {rider.first} tells the whole story again from the red light, slower, with nobody typing back. At the end {rider.he} {rider~tells|tell} {manager.first} to get up and go, and {manager.first} goes.',
            safe: ['manager'], mark: ['still_armed'], moves: { rider: 'honest' }, next: { node: 'last_word' }, objective: 40, pressure: -6 },
            clerkToo('{clerk.first} comes out of the stockroom and leaves by the front with {manager.him}.')],
          mixed: [{ text: '{rider.first} says {rider.he} {rider~believes|believe} the negotiator, and that the police are no better than {delivery_app}. {rider.He} {rider~goes|go} back to pacing with the line open.',
            moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 8 }],
          adverse: turnsOn({
            lead: '{rider.first} drops the receiver on the counter. “Stop calling,” {rider.he} {rider~says|say}. “I’m done being talked to.”',
            threat: 'Then {rider.he} {rider~kneels|kneel} beside {manager.first} and {rider~presses|press} the handgun to {manager.his} shoulder.',
            quiet: 'The receiver lies on the counter, the line still open, and neither end says a word.',
            quietNext: { node: 'way_out' },
            extra: { moves: { rider: 'provoked' }, pressure: 8 } }),
        } },
      // No audience, so the manager can answer on the line. A statement the negotiator hears, not a public one.
      { id: 'manager_quiet', title: 'Hear {manager.first} off the stream', icon: 'radio', talksTo: 'manager', check: check(HOLD, 2), minutes: 4,
        modifiers: [{ label: 'You saw a time rewritten on the board', mark: 'board_seen', value: 3 }],
        summary: 'Offer {manager.first} the register line instead, if {manager.he} {manager~wants|want} to answer. The negotiator hears it at the same moment {rider.first} does.',
        pull: '{manager.first} can answer without any viewers.',
        cost: '{rider.first} wants a public statement and can reject a private one.',
        preview: { favorable: '{manager.first} answers plainly on the line, and {rider.first} hears it.', mixed: '{manager.first} answers, and {rider.first} doesn’t believe it.', adverse: '{manager.first} refuses, and {rider.first} can point the handgun at {manager.him}.' },
        outcomes: {
          favorable: [
            { if: CLEAR_NO_PROOF, text: '{manager.first} stays on the floor and answers on the line. {rider.first} stops pacing. {manager.first} says the complaint protected {clerk.first}.',
              exchange: [{ by: 'manager', line: 'I reported you to keep {clerk.him} in {clerk.his} job. I should have said so when I filed it.' }], reveal: ['rider_clear'], mark: ['admitted_quiet', 'knows_truth'], moves: { rider: 'honest' }, next: { node: 'way_out' }, objective: 20, pressure: -6 },
            { if: TOOK, text: '{manager.first} says the store camera caught {rider.first} at the pickup, and {delivery_app} logged the drop. {rider.first} says nothing, then asks who else has seen the clip.',
              exchange: [{ by: 'manager', line: 'I kept the clip. I didn’t want to use it.' }], mark: ['app_said'], moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 10 },
            { if: CLEAR_PROOF, text: '{manager.first} repeats what {delivery_app} told {manager.him}. {rider.first} asks who the company is lying to, and {manager.first} says {manager.he} {manager~doesn’t|don’t} know.',
              exchange: [{ by: 'manager', line: 'It said delivered, so that’s what I wrote. I don’t know where the bag went.' }], mark: ['app_said'], moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 12 },
          ],
          mixed: [{ text: '{manager.first} answers in two sentences. “That’s what you told {delivery_app},” {rider.first} says, and goes back to pacing.',
            moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 6 }],
          adverse: turnsOn({
            lead: '{manager.first} won’t answer. {rider.first} asks again from a foot away, louder.',
            threat: '{rider.first} levels the handgun at {manager.first} and starts counting to ten.',
            quiet: '{rider.first} sits on the counter above {manager.first} and says nothing at all.',
            quietNext: { node: 'way_out' },
            extra: { moves: { rider: 'provoked' }, pressure: 8 } }),
        } },
      // Off the stream the squad can close in without a picture of the move, if the courier misses it.
      { id: 'move_up_dark', title: 'Move closer with the stream down', icon: 'perimeter', team: { to: { vantage: 'scene' }, signal: { channel: 'visual', to: 'rider' } }, check: check(MOVE, 2), minutes: 4, consequenceLevel: 'moderate',
        certBonus: SURVEILLANCE,
        modifiers: [{ label: 'Onlookers at the corner are filming', mark: 'address_posted', value: -4 }],
        summary: '{lead} walks officers up to both sides of the front door. If {rider.first} spots one helmet in the glass, {manager.first} is right beside {rider.him}.',
        pull: 'Your squad is closer if command has to order a rescue.',
        cost: 'One helmet in the window, and {rider.first} is standing over {manager.first}.',
        preview: { favorable: 'Your squad reaches both sides of the door unseen.', mixed: '{rider.first} catches a glint at the window and stands over {manager.first}.', adverse: '{rider.first} spots the move and can pull {manager.first} against the window with the handgun.' },
        outcomes: {
          favorable: [{ text: 'Officers come up the sidewalk and split to both sides of the door. Through the glass the handgun hangs at {rider.first}’s side, and {manager.first} glances at the stockroom whenever {rider.first} turns away.',
            reveal: ['handgun'], mark: ['team_close', 'counter_seen'], next: { node: 'way_out' }, objective: 10 }],
          mixed: [{ text: 'Officers reach the door, and the cooler light catches the edge of a helmet. {rider.first} plants {rider.himself} over {manager.first} and asks the negotiator who’s out there.',
            reveal: ['handgun'], mark: ['team_close', 'counter_seen'], moves: { rider: 'team_seen' }, next: { node: 'way_out' }, objective: 6, pressure: 4 }],
          adverse: turnsOn({
            lead: '{rider.first} sees two helmets in the glass and stops pacing. {rider.He} {rider~says|say} there’s no camera now to see what happens next.',
            threat: '{rider.first} hauls {manager.first} off the floor and holds the handgun to {manager.his} side in front of the window.',
            quiet: '{rider.first} moves away from the glass and stops answering questions.',
            quietNext: { node: 'way_out' },
            extra: { mark: ['team_close'], moves: { rider: 'team_seen' }, pressure: 10 } }),
        } },
    ] },

  // ------------------------------------------------------------------ stage 2: the clerk is out (the turn)
  { id: 'clerk_talks', stage: 'adapt',
    threat: { chat: CHAT.clerk_talks, label: '{rider.first} asks for the clerk', minutes: 10, text: '{rider.first} asks the negotiator where {clerk.first} went and waits for an answer.', pressure: 4, bump: { stream: 6 },
      beats: [
        { id: 'clerk_shakes', at: 1.6, by: 'clerk', line: 'Is {manager.first} okay? Just tell me {manager.first} is okay.' },
        { id: 'rider_asks', at: 3.2, by: 'rider', line: 'Where’s the kid? Somebody took the kid.', moves: { rider: 'team_seen' }, bump: { stream: 6 } },
      ],
      timeout: { text: '{rider.first} gets no answer about {clerk.first} and turns back to {manager.first}.', next: { node: 'on_air' } } },
    prompt: '{clerk.first} sits behind the patrol car with an officer, watching the stream on the officer’s phone. {clerk.He} {clerk~keeps|keep} saying {clerk.he} didn’t say anything to anybody.',
    exchange: [{ by: 'negotiator', line: 'What didn’t you say?' }, { by: 'clerk', line: 'About the bag. About that night.' }],
    promptIf: [{ when: { marks: ['seen_back'] }, prompt: '{clerk.first} is out, and the stream showed the stockroom door moving. Inside, {rider.first} is asking the comments where the kid went.',
      exchange: [{ by: 'rider', line: 'They took the kid. What else are they doing back there?' }, { by: 'clerk', line: 'I didn’t tell them anything. I swear I didn’t.' }] }],
    choices: [
      { id: 'clerk_asked', title: 'Ask {clerk.first} what happened at 11:40', icon: 'search', talksTo: 'clerk', check: check(ASK, -2), minutes: 4,
        summary: '{lead} sits on the bumper beside {clerk.first} and asks about the night the bag went missing. {clerk.first} keeps one eye on the stream the whole time.',
        pull: '{clerk.first} worked the register that night.',
        cost: '{manager.first} remains inside while {clerk.first} tries to explain the order.',
        preview: { favorable: 'You hear what {clerk.first} saw at the register.', mixed: '{clerk.first} starts to answer and asks for {manager.first} instead.', adverse: '{clerk.first} stops answering and asks for the stream to be put away.' },
        outcomes: {
          favorable: [
            { if: CLEAR_NO_PROOF, text: '{clerk.first} answers looking at the ground. The bag sat on the counter for twenty minutes. At 11:40 {clerk.he} logged it collected and took it, and when {rider.first} came in, {clerk.he} said another courier had it. The next day {manager.first} found the receipt in {clerk.his} apron.',
              exchange: [{ by: 'clerk', line: 'I took the bag. {manager.first} said to let the complaint stand.' }, { by: 'clerk', line: '{manager.He} {manager~is|are} my {manager^uncle|aunt|relative}.' }], reveal: ['rider_clear'], mark: ['knows_truth'], next: { node: 'on_air' }, objective: 15 },
            { if: TOOK, text: '{clerk.first} saw {rider.first} collect the bag a few minutes after 11:40, like any other night. After that {clerk.he} only saw {delivery_app} say delivered. {manager.first} kept the store camera clip and told {clerk.him} not to post it.',
              exchange: [{ by: 'clerk', line: 'I didn’t say anything. I didn’t want {rider.him} to get in trouble.' }], mark: ['clerk_unsure'], next: { node: 'on_air' }, objective: 12 },
            { if: CLEAR_PROOF, text: '{clerk.first} says {rider.first} came in just after 11:40 and left with the bag. After that {clerk.he} only {clerk~knows|know} the order sheet, which says delivered.',
              exchange: [{ by: 'clerk', line: '{rider.He} took it. Like always. After that I don’t know. I didn’t want to say I didn’t know.' }], mark: ['clerk_unsure'], next: { node: 'on_air' }, objective: 8 },
          ],
          mixed: [{ text: '{clerk.first} gets as far as the register that night, then stops and asks if {manager.first} is all right. {clerk.He} won’t say another word until somebody answers.',
            next: { node: 'on_air' }, objective: 6 }],
          adverse: [{ text: '{clerk.first} turns the officer’s phone face down and won’t talk to anyone. On the stream the count keeps climbing.',
            bump: { stream: 10 }, next: { node: 'on_air' }, objective: 3, pressure: 4 }],
        } },
      // The temptation (dilemma pattern 15): a story that ends the stand-off, if it is true. It is
      // true in no situation, and it settles on every road out (hostage-live-parts.ts foundOut).
      { id: 'say_clerk_backs', title: 'Tell {rider.him} {clerk.first} backs {rider.him}', icon: 'radio', talksTo: 'rider', deceives: true, check: check(TALK, 4), minutes: 2, consequenceLevel: 'high',
        summary: 'Nobody has asked {clerk.first} about the bag. {lead} tells {rider.first} the clerk has already backed the story.',
        pull: '{rider.first} hears the words {rider.he} came for.',
        cost: '{clerk.first} can contradict the account your squad made up.',
        preview: { favorable: '{rider.first} sits down and starts talking about walking out.', mixed: '{rider.first} wants {clerk.first} to say it in person.', adverse: '{clerk.first} contradicts the claim, and {manager.first} can face the handgun while {rider.first} reads it.' },
        outcomes: {
          favorable: [{ text: '{rider.first} makes the negotiator say it twice. Then {rider.he} {rider~says|say} it to the camera {rider.himself} and sits down on the floor with {rider.his} back against the cooler.',
            promise: { id: 'clerk_backs', to: 'rider', kind: 'lie' }, mark: ['lied_clerk'], moves: { rider: 'released' }, next: { node: 'on_air' }, objective: 15, pressure: -8 }],
          mixed: [{ text: '{rider.first} wants to hear it in {clerk.first}’s own voice. The negotiator says {clerk.first} is still with officers, and {rider.first} says {rider.he} will wait.',
            promise: { id: 'clerk_backs', to: 'rider', kind: 'lie' }, mark: ['lied_clerk'], moves: { rider: 'heard' }, next: { node: 'on_air' }, objective: 8 }],
          adverse: turnsOn({
            lead: 'A comment lands under the picture from {clerk.first}’s own account, typed behind the patrol car. It says {clerk.first} hasn’t told the police anything about the bag. {rider.first} reads it out slowly.',
            threat: '{rider.first} aims the handgun at {manager.first} while telling the camera this is what the police do.',
            quiet: '{rider.first} hangs up and lets the callback ring.',
            quietNext: { node: 'on_air' },
            extra: { mark: ['lie_found', 'lie_settled'], moves: { rider: 'provoked' }, bump: { stream: 14 }, pressure: 10 } }),
        } },
    ] },
];
