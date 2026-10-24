import { CHAT } from './hostage-live-chat';
import { CALM_ON_CAMERA, CHECKS, CLEAR, NEGOTIATOR, NO_PROOF, OBSERVANT_ON_CHAT, PROOF, STEADY_ON_CAMERA, SURVEILLANCE, TOOK, check, clerkToo, turnsOn } from './hostage-live-parts';
import type { TreeNode } from './types';

const { TALK, HOLD, ASK, MOVE, PRESS, READ } = CHECKS;
const CLEAR_NO_PROOF = [CLEAR, NO_PROOF];
const CLEAR_PROOF = [CLEAR, PROOF];

// Stages 1 and 2 of Going Live. The player meets the rider on the rider's own stage, learns that the
// stream is both what protects the rider and what traps the rider, and is made to choose between
// hearing what happened to the bag and keeping the room quiet. Each way of asking costs a different
// person something: the manager her pride, the clerk his job, the crowd its patience, the rider his
// audience.
export const APPROACH_NODES: TreeNode[] = [
  // ------------------------------------------------------------------ stage 1
  { id: 'going_live', stage: 'assess',
    // The address threat: a named commenter posts where the store is. The beats are the comments
    // closing in on it, read out by the rider, so the countdown is the guess getting warmer.
    threat: { chat: CHAT.going_live, label: 'The address goes out', minutes: 11, text: 'A comment from {handle} puts the street address of {place} under the picture, and {rider.first} reads it out loud before anyone can say don’t. The shares come fast. At the corner, patrol starts turning cars around.', pressure: 4, bump: { stream: 10 },
      beats: [
        { id: 'where_is_this', at: 1.2, by: 'rider', line: 'Somebody called {handle} wants to know where this is. Should I tell them?', bump: { stream: 4 } },
        { id: 'manager_low', at: 3.4, by: 'manager', line: 'Those people don’t pay your rent, {rider.first}.', moves: { rider: 'provoked' }, bump: { stream: 5 } },
        { id: 'cross_streets', at: 6.8, by: 'radio', line: 'Comments are guessing cross streets. One of them is right.', bump: { stream: 6 } },
      ],
      timeout: { text: 'The register phone stays silent. {rider.first} stops waiting for the police and asks the comments what to do.', next: { node: 'address_out' } } },
    prompt: 'The register phone rings and rings. {rider.first} watches it with a thumb on the screen and keeps talking to the people who aren’t in the room. Down by the drinks cooler, {manager.first} keeps glancing at the stockroom door.',
    exchange: [{ by: 'rider', line: 'Eleven-forty. Red light on Calloway. Four hundred people have seen the screenshot.' }, { by: 'manager', line: 'Put the phone down, {rider.first}. Whatever you want, you can ask me without them.' }, { by: 'radio', line: 'Callback ringing. Subject at the counter, handgun out.' }],
    choices: [
      { id: 'on_stream', title: 'Talk to {rider.him} on the stream', icon: 'radio', talksTo: 'rider', check: check(TALK, 6), minutes: 4, certBonus: NEGOTIATOR, favors: [CALM_ON_CAMERA],
        summary: '{lead} rings the register again. {rider.first} only picks up on speaker, so what you say goes out live, and what {rider.he} {rider~says|say} back goes to the same crowd.',
        pull: '{rider.first} is waiting for this call.',
        cost: 'Four hundred strangers hear every question you ask.',
        preview: { favorable: '{rider.first} tells you what {rider.he} came for, out loud.', mixed: '{rider.first} answers the comments instead of you.', adverse: '{rider.first} reads your questions out for the stream and turns the camera on {manager.first}.' },
        outcomes: {
          favorable: [{ text: '{rider.first} picks up on the second ring and tilts the phone so the stream can hear. It’s the first time tonight {rider.he} {rider~talks|talk} to someone who can answer back.',
            exchange: [{ by: 'rider', line: 'Eleven-forty, red light on Calloway, two blocks from here. {delivery_app} has the timestamp.' }, { by: 'rider', line: 'One sentence from {manager.first}. That’s all this is.' }, { by: 'negotiator', line: 'Then let’s work out how {manager.he} {manager~gets|get} to say it.' }],
            mark: ['terms'], moves: { rider: 'heard' }, bump: { stream: 10 }, next: { node: 'on_air' }, objective: 15 }],
          mixed: [{ text: '{rider.first} reads each of your questions out to the comments and answers them there. Somebody types that the police are stalling, and {rider.first} turns back to the phone to ask if it’s true.',
            exchange: [{ by: 'rider', line: 'They want to know if you’re stalling. Are you stalling?' }], mark: ['performing'], moves: { rider: 'heard' }, bump: { stream: 14 }, next: { node: 'on_air' }, objective: 8 }],
          adverse: turnsOn({
            lead: '{rider.first} lifts the phone off the register and holds the camera on {manager.first}’s face while you talk.',
            threat: '{rider.first} brings the handgun down next to the phone, aimed at {manager.first}, so the stream gets both in one frame.',
            quiet: '{rider.first} hangs up in the middle of your question and turns back to the window, talking to the people who stayed.',
            quietNext: { node: 'on_air' },
            extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 16 }, pressure: 8 } }),
        } },
      { id: 'clerk_out', title: 'Get {clerk.first} out the back', icon: 'door', walks: 'clerk', team: { to: 'escort' }, check: check(MOVE, -2), minutes: 4, consequenceLevel: 'moderate',
        summary: 'The camera faces the counter, so {lead} takes two officers in through the back to walk {clerk.first} out of the stockroom. If that door moves on the stream, {rider.first} hears it from strangers before {rider.he} {rider~sees|see} it.',
        pull: '{clerk.first} is nineteen and a few steps from the back door.',
        cost: 'The comments may spot the stockroom door before {rider.first} does.',
        preview: { favorable: '{clerk.first} walks out the back unseen.', mixed: '{clerk.first} is out, but the door swings in the corner of the picture.', adverse: '{clerk.first} freezes in the doorway on camera, and {rider.first} fires a shot.' },
        outcomes: {
          favorable: [{ text: '{clerk.first} puts the case of water down on the stockroom floor and walks out the back between two officers. Behind the patrol car {clerk.he} {clerk~asks|ask} for {clerk.his} phone.',
            exchange: [{ by: 'clerk', line: 'I didn’t say anything to anybody. I didn’t.' }], safe: ['clerk'], next: { turn: 'clerk_out' }, objective: 30, pressure: -3 }],
          mixed: [{ text: '{clerk.first} gets out, but the stockroom door swings shut in the corner of the picture. The comments catch it before {rider.first} does. {rider.first} reads them out and turns to look at the stockroom.',
            safe: ['clerk'], mark: ['seen_back'], moves: { rider: 'team_seen' }, bump: { stream: 12 }, next: { turn: 'clerk_out' }, objective: 25, pressure: 4 }],
          adverse: [{ text: '{clerk.first} gets one step past the doorway and stops dead in the middle of the picture. {rider.first} sees {clerk.him} on the phone screen before turning around, and the shot goes into the ceiling tiles. {clerk.first} drops to the floor where {clerk.he} {clerk~stands|stand}.',
            mark: ['shot_inside'], moves: { rider: 'shots' }, bump: { stream: 25 }, next: { node: 'threat' }, pressure: 14, civilian: -6 }],
        } },
      // The look the call plants: who the manager watches. Quiet, cheap, and the only way to see it.
      { id: 'watch_feed', title: 'Watch the counter before you answer', icon: 'search', team: { to: { vantage: 'scene' }, signal: { channel: 'visual', to: 'rider' } }, check: check(ASK, -4), minutes: 3, consequenceLevel: 'moderate',
        certBonus: SURVEILLANCE,
        summary: 'Let the callback ring out while your squad watches the counter from the corner, through the glass, with the stream open on a tablet. The glass shows what the camera leaves out.',
        pull: 'Find out who looks where before you say a word.',
        cost: 'The register phone rings out while the comments ask why you haven’t answered.',
        preview: { favorable: 'You see where the handgun points and who {manager.first} keeps looking at.', mixed: 'The chat sees police at the corner while you watch.', adverse: 'The ringing reads as no answer, and the stream shows it.' },
        outcomes: {
          favorable: [
            { text: 'From the corner your squad has the counter twice, through the glass and on the tablet. The handgun is in {rider.first}’s right hand, pointed at the floor. Each time {rider.first} turns away, {manager.first} looks at the stockroom doorway, and when nobody’s watching {manager.him}, at the whiteboard behind the register.',
              reveal: ['handgun'], mark: ['glance'], moves: { rider: 'contact' }, next: { node: 'on_air' }, objective: 10 },
            { when: { lead: ['observant'] }, text: 'The lead officer can read the pickup whiteboard by the register. One time on it has been rubbed out.' },
          ],
          mixed: [{ text: 'Your squad gets a clear look at the counter and the handgun. So does the chat, which spots a helmet at the edge of the picture. {rider.first} swings the phone toward the street and tells the police to wave.',
            reveal: ['handgun'], mark: ['performing'], moves: { rider: 'team_seen' }, bump: { stream: 12 }, next: { node: 'on_air' }, objective: 4, pressure: 4 }],
          adverse: turnsOn({
            lead: 'The callback rings out on the stream, and {rider.first} tells the viewers that’s the police’s answer.',
            threat: '{rider.first} raises the handgun at {manager.first} and tells the camera the police had their chance.',
            quiet: '{rider.first} switches off the ringer, props the phone up and talks to the comments instead.',
            quietNext: { node: 'on_air' },
            extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 10 }, pressure: 8 } }),
        } },
    ] },

  // Stage 1, run out: the address is out, and a stranger came to look.
  { id: 'address_out', stage: 'assess',
    threat: { chat: CHAT.address_out, label: 'The crowd pushes closer', minutes: 12, text: 'Somebody ducks the tape and presses a phone against the front glass to film inside. Patrol hauls them back to the corner, and the stream shows every second of it.', pressure: 5, moves: { rider: 'provoked' }, bump: { stream: 12 },
      beats: [
        { id: 'past_tape', at: 3.2, by: 'radio', line: 'One on foot past the line. Patrol has them.', bump: { stream: 4 } },
        { id: 'see_store', at: 6.6, by: 'rider', line: 'Somebody out there says they can see the store. Is that true?' },
      ],
      timeout: { text: '{rider.first} gives up on the police line and turns {rider.his} back to the window to talk to the phone.', next: { node: 'on_air' } } },
    prompt: 'Two cars have pulled up at the corner with phones out the windows. Patrol waves them on, and they don’t go. {rider.first} reads the comments aloud as fast as they land, and smiles a little at the ones that say they’re coming.',
    exchange: [{ by: 'rider', line: 'They’re here. Some of them actually came.' }, { by: 'radio', line: 'Corner. More on foot now, phones up.' }],
    choices: [
      { id: 'call_back', title: 'Call {rider.him} back now', icon: 'radio', talksTo: 'rider', check: check(TALK, 2), minutes: 4, certBonus: NEGOTIATOR, favors: [CALM_ON_CAMERA],
        summary: '{lead} rings the register back and starts by owning the silence. The people at the corner can hear the call on their own phones.',
        pull: '{rider.first} hasn’t stopped answering yet.',
        cost: '{rider.first} wants to know why the police let it ring.',
        preview: { favorable: '{rider.first} picks up and tells you what {rider.he} {rider~wants|want}.', mixed: '{rider.first} answers, then talks to the corner instead of you.', adverse: '{rider.first} mocks the late call for the people at the corner.' },
        outcomes: {
          favorable: [{ text: '{rider.first} picks up on the first ring and lets the negotiator wait a beat before saying anything. Then it comes out in a rush. The red light at 11:40, the timestamp, the one sentence {rider.he} {rider~needs|need} from {manager.first}.',
            exchange: [{ by: 'rider', line: 'Took you long enough. Write this down.' }], mark: ['terms'], moves: { rider: 'heard' }, bump: { stream: 8 }, next: { node: 'on_air' }, objective: 12 }],
          mixed: [{ text: '{rider.first} picks up and talks right past the negotiator, to the people at the corner, and waves them in toward the glass.',
            mark: ['performing'], moves: { rider: 'heard' }, bump: { stream: 12 }, next: { node: 'on_air' }, objective: 6 }],
          adverse: turnsOn({
            lead: '{rider.first} lets the negotiator talk for a minute, then tells the comments the police only call once a crowd shows up.',
            threat: '{rider.first} brings the handgun up at {manager.first} and holds the phone beside it, so the corner can see both.',
            quiet: '{rider.first} hangs up and swings the camera around to the street, to show the people who came.',
            quietNext: { node: 'on_air' },
            extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 14 }, pressure: 8 } }),
        } },
      { id: 'take_down', title: 'Shut the stream down now', icon: 'handover', check: check(PRESS, 4), minutes: 6, tempo: 'waiting', consequenceLevel: 'moderate',
        summary: 'Strangers keep pulling up, so command asks {stream_app} to end the stream before more come. Your squad waits on the company while the corner fills, and {rider.first} loses the picture without hearing a word from you.',
        pull: 'The stream stops leading strangers to {place}.',
        cost: 'Your first move toward {rider.first} is to take something away.',
        preview: { favorable: 'The stream ends, and the corner stops filling.', mixed: 'The stream dies, and {manager.first}’s phone brings it back.', adverse: '{rider.first} sees the screen go dark and decides who did it.' },
        outcomes: {
          favorable: [{ text: 'The picture goes black in the middle of a comment. At the corner a couple of cars pull away, as if the show had ended. When the negotiator rings, {rider.first} answers before the first ring is over.',
            exchange: [{ by: 'rider', line: 'Who turned it off? Was that you?' }], mark: ['cut'], stabilize: ['stream'], bump: { stream: -100 }, moves: { rider: 'provoked' }, next: { node: 'off_air' }, objective: 8, pressure: 2 }],
          mixed: [{ text: 'The picture stays dark for about a minute. Then {rider.first} reaches down, takes {manager.first}’s phone out of {manager.his} pocket and starts again on that.',
            mark: ['performing'], bump: { stream: -30 }, moves: { rider: 'provoked' }, next: { node: 'on_air' }, objective: 3, pressure: 6 }],
          adverse: turnsOn({
            lead: '{rider.first} watches the picture die. “That’s what you came here to do,” {rider.he} {rider~tells|tell} the room. “Take the people away.”',
            threat: '{rider.first} pulls {manager.first} up against the counter with the handgun under {manager.his} arm, facing the street.',
            quiet: 'The dead phone hits the stockroom door and drops to the tile. The register keeps ringing, and {rider.first} lets it.',
            quietNext: { node: 'off_air' },
            extra: { mark: ['cut'], stabilize: ['stream'], bump: { stream: -100 }, moves: { rider: 'provoked' }, pressure: 10 } }),
        } },
    ] },

  // ------------------------------------------------------------------ stage 2: the stream is up, and the question is the bag
  { id: 'on_air', stage: 'adapt',
    threat: { chat: CHAT.on_air, label: 'The comments turn', minutes: 11, text: 'The comments turn. Viewers start asking why {rider.first} needs a handgun if {rider.he} did nothing wrong, and {rider.first} answers every one of them out loud.', pressure: 5, mark: ['turned_chat'], moves: { rider: 'provoked' }, bump: { stream: 10 },
      beats: [
        { id: 'friend_types', at: 1.4, by: 'rider', line: '{friend.first} says come out, I got you. {friend.first}, I can’t.' },
        { id: 'count_two', at: 2.8, by: 'radio', line: 'Stream climbing fast. {outlet_short} van two blocks out.', bump: { stream: 6 } },
        { id: 'manager_asks', at: 3.9, by: 'manager', line: 'Can I stand up? My knees, {rider.first}.', moves: { rider: 'contact' } },
      ],
      timeout: { text: 'The police say nothing to the chat while it turns. {rider.first} tells the chat the police have nothing to say.', next: { node: 'chat_turned' } } },
    prompt: '{rider.first} has planted {rider.himself} between the camera and {manager.first}, close enough to touch the screen. The ask hasn’t changed since the first minute. One sentence, said into the phone.',
    exchange: [{ by: 'rider', line: 'Tell them. Tell them what you told {delivery_app}.' }, { by: 'manager', line: 'Not with that in your hand.' }],
    promptIf: [
      { when: { marks: ['lied_clerk'] }, prompt: '{rider.first} believes {clerk.first} is on {rider.his} side, and has turned to {manager.first} for the rest. {rider.He} {rider~wants|want} the sentence said on camera, now.' },
      { when: { marks: ['terms'] }, prompt: '{rider.first} has told the stream exactly what ends this. One sentence from {manager.first}, and {rider.he} {rider~walks|walk} out the door. {manager.first} hasn’t said a word since.' },
      { when: { marks: ['glance'] }, prompt: 'Through the glass, {manager.first} looks at the stockroom door again. The comments keep asking {rider.first} where {rider.he} {rider~was|were} at 11:40.' },
    ],
    choices: [
      // The truth, out loud, from the one person who filed it. It can't be taken back.
      { id: 'manager_speaks', title: 'Let {manager.first} answer on camera', icon: 'radio', talksTo: 'manager', check: check(TALK, 4), minutes: 3, consequenceLevel: 'high',
        modifiers: [{ label: 'You saw who {manager.he} {manager~watches|watch}', mark: 'glance', value: 6 }],
        summary: 'Ask {rider.first} to let {manager.first} stand and answer on the stream. You don’t know what {manager.first} will say, and neither does {rider.first}. Everyone watching hears it with the handgun still in the room.',
        pull: '{rider.first} hears {manager.first} answer for {manager.himself}.',
        cost: 'You can’t take back a word {manager.first} says on camera.',
        preview: { favorable: '{manager.first} answers into the phone, and the stream hears what {manager.he} {manager~chooses|choose} to say.', mixed: '{manager.first} starts to answer, and what comes out may not be what {rider.first} wanted.', adverse: '{manager.first} says the wrong thing on camera, and {rider.first} may aim the handgun at {manager.him}.' },
        outcomes: {
          favorable: [
            // The clerk took it, and the manager reported the rider to keep the clerk's job.
            { if: CLEAR_NO_PROOF, text: '{manager.first} gets up using the cooler handle and turns to face the phone. It comes out fast, like something {manager.he} {manager~has|have} been carrying across the shop for days. When it’s out, {manager.he} {manager~looks|look} at the stockroom door, and four hundred people watch where.',
              exchange: [{ by: 'manager', line: 'You didn’t take it. I knew you didn’t. {clerk.He} {clerk~is|are} my {clerk^nephew|niece|relative}, and {clerk.he} {clerk~is|are} nineteen.' }], reveal: ['rider_clear'], mark: ['admitted', 'knows_truth'], moves: { rider: 'honest' }, next: { node: 'way_out' }, objective: 20, pressure: -6 },
            // The rider kept it and marked it delivered. The manager keeps it off the stream if the stream lets her.
            { if: TOOK, text: '{manager.first} gets up holding the cooler door and faces the phone, then turns away from it. The rest, {manager.he} {manager~says|say}, is for the police to hear, and {manager.he} {manager~sits|sit} back down.',
              exchange: [{ by: 'manager', line: 'Not on camera. I won’t do that to you. Put that down and ask me again.' }], mark: ['held_back'], moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 8 },
            // Nobody took it: the manager only knows what the delivery app told her.
            { if: CLEAR_PROOF, text: '{manager.first} stands, faces the phone and reads out what the {delivery_app} screen says. The whiteboard behind {manager.him} says the same. “So who’s lying?” {rider.first} asks, and nobody in the store has an answer.',
              exchange: [{ by: 'manager', line: '{delivery_app} said delivered. I wrote down what {delivery_app} said. That’s all I did.' }], mark: ['app_said'], moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 12 },
          ],
          mixed: [
            { if: CLEAR, text: '{manager.first} gets as far as {rider.first}’s name. {rider.first} talks right over {manager.him}, back to the red light and the timestamp, and tells {manager.him} to stand up if {manager.he} {manager~means|mean} it.',
              mark: ['performing'], moves: { rider: 'heard' }, bump: { stream: 8 }, next: { node: 'way_out' }, objective: 8 },
            // The answer the rider didn't want comes out anyway, in front of everyone.
            { if: TOOK, text: '{manager.first} stands with a hand on the cooler door and talks to the camera, not to {rider.first}. For a second the comments stop. Then they come faster than {rider.first} can read, and most of them say {rider.he} took the bag.',
              exchange: [{ by: 'manager', line: 'You picked it up at 11:40 and you marked it delivered. It’s on the camera.' }], reveal: ['rider_clear'], mark: ['exposed', 'knows_truth'], moves: { rider: 'provoked' }, bump: { stream: 15 }, next: { node: 'cornered' }, objective: 10 },
          ],
          adverse: turnsOn({
            lead: '{manager.first} stands up, looks straight into the phone and calls {rider.first} a coward with a handgun.',
            threat: '{rider.first} brings the handgun up level with {manager.first}’s chest, in full view of the stream.',
            quiet: '{rider.first} pushes {manager.first} back down to the floor and holds the camera on {manager.his} face until {manager.he} {manager~looks|look} away.',
            quietNext: { node: 'way_out' },
            extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 18 }, pressure: 10 } }),
        } },
      // The crowd as a source: slow, public, and only worth it while it can still be read.
      { id: 'ask_chat', title: 'Read the comments for who knows', icon: 'search', check: check(READ, 4), minutes: 5, certBonus: SURVEILLANCE, favors: [OBSERVANT_ON_CHAT],
        modifiers: [{ label: 'The clerk couldn’t say', mark: 'clerk_unsure', value: 4 }],
        onlyIf: { notMarks: ['cut', 'stream_off'] },
        summary: '{lead} scrolls the comments on a tablet, looking for anyone who has laid eyes on that bag since Tuesday. {rider.first} is watching the same feed and reads aloud the comments {rider.he} {rider~likes|like}. It takes five minutes, and {manager.first} spends them on the floor.',
        pull: 'Four hundred people may know something nobody in the store does.',
        cost: 'The count keeps climbing while you read, and {rider.first} hears which comments you stopped on.',
        preview: { favorable: 'You find the comment that answers who has seen the bag.', mixed: 'You find a name in the comments, and not a good one.', adverse: 'A comment you stop on gives {rider.first} a bigger audience.' },
        outcomes: {
          favorable: [
            { if: PROOF, text: 'A comment from {handle} says a relative lives two doors down from the customer. The porch camera there has the bag sitting on the step at 11:52, and the clip is posted right under the comment. At 12:10 a neighbor’s arm reaches in and takes it inside. {rider.first} watches it twice, then stops talking.',
              exchange: [{ by: 'rider', line: 'That’s my bag. That’s my bag on the step. I delivered it.' }], reveal: ['proof', 'rider_clear'], mark: ['proof_seen', 'knows_truth'], moves: { rider: 'honest' }, bump: { stream: 10 }, next: { node: 'way_out' }, objective: 25, pressure: -8 },
            { if: [CLEAR, NO_PROOF], text: 'A comment from {handle} says {handle} used to work nights at {place}, and that the clerk who got the job through the manager ate out of the cooler every shift. {rider.first} reads it out, reads it again slower, and looks at the stockroom door.',
              reveal: ['proof'], moves: { rider: 'heard' }, bump: { stream: 8 }, next: { node: 'way_out' }, objective: 8 },
            { if: TOOK, text: 'A comment from {handle} says {rider.first}’s own Tuesday stream shows a bag on the handlebars at midnight. {rider.first} reads the comment out and says it was a different bag. Then, for about a minute, nobody types anything.',
              reveal: ['proof'], moves: { rider: 'provoked' }, bump: { stream: 8 }, next: { node: 'way_out' }, objective: 8 },
          ],
          mixed: [{ text: 'Your squad finds a comment naming {clerk.first} as whoever worked the register that night. {rider.first} reads it out loud and turns toward the stockroom door.',
            mark: ['clerk_named', 'performing'], moves: { rider: 'provoked' }, bump: { stream: 12 }, next: { node: 'way_out' }, objective: 4, pressure: 4 }],
          adverse: turnsOn({
            lead: 'While your squad is scrolling, a viewer posts the store’s street address under the picture. {rider.first} reads it out to the camera before anyone can stop {rider.him}.',
            threat: '{rider.first} lifts the handgun toward {manager.first} and asks the street to come and see.',
            quiet: '{rider.first} turns the phone so the comments scroll off the screen, and reads them aloud from memory.',
            quietNext: { node: 'way_out' },
            extra: { mark: ['turned_chat'], moves: { rider: 'provoked' }, bump: { stream: 20 }, pressure: 8 } }),
        } },
      { id: 'camera_wall', title: 'Ask {rider.him} to turn the camera to the wall', icon: 'radio', talksTo: 'rider', check: check(TALK, 14), minutes: 4, certBonus: NEGOTIATOR, favors: [STEADY_ON_CAMERA],
        summary: '{lead} asks {rider.first} to turn the phone to the wall and leave the sound on, so the stream hears {manager.first} and nobody sees {manager.him}. The same picture is the only view of the counter your squad has.',
        pull: 'Strangers stop watching {manager.first} on the floor.',
        cost: 'Your squad loses its only view of the counter and works from sound until the phone turns back.',
        preview: { favorable: '{rider.first} faces the phone at the wall and answers you.', mixed: 'The phone turns away, then back when the comments complain.', adverse: 'The viewers {rider.first} came for turn on {rider.him} for hiding.' },
        outcomes: {
          favorable: [
            { text: '{rider.first} turns the phone to face the plaster beside the register, sound still on. The comments keep scrolling and nobody reads them out loud. For once, the negotiator is who {rider.first} answers.',
              mark: ['phone_wall'], moves: { rider: 'contact' }, next: { node: 'way_out' }, objective: 15, pressure: -5 },
            { when: { lead: ['steady'] }, text: 'The negotiator keeps the same even pace through the noise from the speaker.' },
          ],
          mixed: [{ text: '{rider.first} turns the phone to the wall, then picks the phone up to check the comments and turns the camera back toward the counter.',
            mark: ['performing'], moves: { rider: 'heard' }, bump: { stream: 6 }, next: { node: 'way_out' }, objective: 6 }],
          adverse: turnsOn({
            lead: '{rider.first} tells the camera the police want to take the viewers away too, after {delivery_app} took the job.',
            threat: 'Then {rider.he} {rider~points|point} the handgun at {manager.first} and {rider~asks|ask} the stream what happens now.',
            quiet: 'The comments split on it. A few call {rider.first} a coward for hiding the picture, and {rider.first} props the phone higher on the register to take in more of the room.',
            quietNext: { node: 'way_out' },
            extra: { mark: ['turned_chat'], moves: { rider: 'provoked' }, bump: { stream: 12 }, pressure: 8 } }),
        } },
      // Command can end the stream; the rider can't stop it, and will know who did.
      { id: 'cut_feed', title: 'Have command take the stream down', icon: 'handover', check: check(PRESS, 2), minutes: 6, tempo: 'waiting', consequenceLevel: 'moderate',
        summary: 'Your squad waits while command gets {stream_app} on the phone, two time zones away, to end the stream. The picture goes black in front of {rider.first}, mid-sentence, and {rider.first} will know who did it.',
        pull: 'Take away the audience {rider.first} talks to.',
        cost: 'You take the stream from {rider.first} without asking, and the comments go with it.',
        preview: { favorable: 'The picture goes black, and {rider.first} picks up your line.', mixed: '{rider.first} gets a second phone streaming within minutes.', adverse: '{rider.first} watches the stream end and decides who did it.' },
        outcomes: {
          favorable: [{ text: 'The stream cuts out in the middle of a sentence. {rider.first} stares at the black screen, then grabs the register phone when it rings and asks for the stream back.',
            exchange: [{ by: 'rider', line: 'Put it back. Put it back and I’ll talk.' }], mark: ['cut'], stabilize: ['stream'], bump: { stream: -100 }, moves: { rider: 'provoked' }, next: { node: 'off_air' }, objective: 10, pressure: 4 }],
          mixed: [
            { when: { notSafe: ['clerk'] }, text: 'The stream goes black. {rider.first} makes {clerk.first} hand over the phone from {clerk.his} apron and starts a new stream on it. The old viewers find it within minutes, and more come with them.',
              exchange: [{ by: 'rider', line: 'You can’t turn off two phones.' }], mark: ['performing'], bump: { stream: -30 }, moves: { rider: 'provoked' }, next: { node: 'way_out' }, objective: 4, pressure: 6 },
            { when: { safe: ['clerk'] }, text: 'The stream goes black. {rider.first} pulls {manager.first}’s phone from {manager.his} pocket and starts a new stream on it. The old viewers find it within minutes, and more come with them.',
              exchange: [{ by: 'rider', line: 'You can’t turn off two phones.' }], mark: ['performing'], bump: { stream: -30 }, moves: { rider: 'provoked' }, next: { node: 'way_out' }, objective: 4, pressure: 6 },
          ],
          adverse: turnsOn({
            lead: '{rider.first} watches the stream end on the screen, then turns to the front window.',
            threat: '{rider.first} drags {manager.first} up by the collar and puts the handgun against {manager.his} back, facing the glass.',
            quiet: '{rider.first} sweeps the dead phone off the counter and stands over {manager.first} without answering the line.',
            quietNext: { node: 'off_air' },
            extra: { mark: ['cut'], stabilize: ['stream'], bump: { stream: -100 }, moves: { rider: 'provoked' }, pressure: 10 } }),
        } },
    ] },

  // Stage 2, run out: the comments went on without an answer.
  { id: 'chat_turned', stage: 'adapt',
    threat: { chat: CHAT.chat_turned, label: 'The chat starts guessing', minutes: 11, text: 'The chat starts guessing where {rider.first} got the handgun and whether the police will use theirs. {rider.first} answers every guess to the camera, and each answer pushes the count up.', pressure: 6, moves: { rider: 'provoked' }, bump: { stream: 12 },
      beats: [
        { id: 'three_k', at: 3.0, by: 'radio', line: 'Count’s climbing past anything patrol can turn away.', bump: { stream: 4 } },
        { id: 'knees', at: 6.2, by: 'manager', line: 'Let me sit up at least. Please, {rider.first}.', moves: { rider: 'contact' } },
      ],
      timeout: { text: 'The guesses run out before the police say anything. {rider.first} gets to {rider.his} feet, holding the phone and the handgun.', next: { node: 'way_out' } } },
    prompt: '{rider.first} crouches by the cooler and reads the worst comments out to {manager.first}, holding the screen up to {manager.his} face.',
    exchange: [{ by: 'rider', line: 'This one says I took it. Tell them who took it.' }, { by: 'manager', line: 'I can’t read it from down here.' }],
    choices: [
      { id: 'say_true', title: 'Say one true thing to the stream', icon: 'radio', talksTo: 'rider', check: check(TALK, 2), minutes: 3, certBonus: NEGOTIATOR, favors: [STEADY_ON_CAMERA],
        summary: '{lead} asks {rider.first} for ten seconds on speaker and tells the stream that nobody inside is hurt and the police are listening. It gives the chat something to argue with besides {rider.first}, on the channel {rider.first} built to be heard on.',
        pull: 'The chat argues with you instead of with {rider.first}.',
        cost: 'A police voice on {rider.first}’s own channel.',
        preview: { favorable: '{rider.first} turns from {manager.first} back to the phone, and the comments slow.', mixed: 'The comments argue with you, and {rider.first} reads the worst ones out.', adverse: '{rider.first} calls the police voice a script and turns on the room.' },
        outcomes: {
          favorable: [{ text: 'The negotiator says it plainly, once, and stops. For a few seconds the comments argue with the police instead of with {rider.first}, and {rider.first} gets up from the cooler to answer the line.',
            moves: { rider: 'heard' }, bump: { stream: -6 }, next: { node: 'way_out' }, objective: 12, pressure: -4 }],
          mixed: [{ text: 'The comments fill with people arguing about the negotiator’s voice. {rider.first} reads the angriest ones out, standing between the phone and {manager.first} again.',
            mark: ['performing'], moves: { rider: 'heard' }, bump: { stream: 8 }, next: { node: 'way_out' }, objective: 5 }],
          adverse: turnsOn({
            lead: '{rider.first} grabs the phone off the register before the negotiator finishes and tells the stream the police are reading from a script.',
            threat: '{rider.first} swings the handgun to {manager.first} and asks the chat whether that sounds scripted.',
            quiet: '{rider.first} mutes the speaker and goes on reading to {manager.first}.',
            quietNext: { node: 'way_out' },
            extra: { mark: ['performing'], moves: { rider: 'provoked' }, bump: { stream: 14 }, pressure: 8 } }),
        } },
      { id: 'let_go_now', title: 'Ask {rider.him} to free {manager.first} now', icon: 'door', talksTo: 'rider', check: check(TALK, 6), minutes: 4, consequenceLevel: 'high',
        summary: 'Ask {rider.first} to let {manager.first} walk out now, on camera, while the chat calls {rider.him} a liar. {manager.first} is the one person {rider.he} came here to hear say it.',
        pull: '{manager.first} out of reach of the handgun, now.',
        cost: '{rider.first} gives up the person who owes {rider.him} the sentence.',
        preview: { favorable: '{rider.first} steps aside, and {manager.first} makes it out the front.', mixed: '{rider.first} says no and keeps {manager.first} by the cooler.', adverse: '{rider.first} hears a trick and stands over {manager.first}.' },
        outcomes: {
          favorable: [{ text: '{rider.first} steps back from the cooler. {manager.first} pulls up on the handle and walks to the door, and two officers bring {manager.him} out onto the sidewalk.',
            safe: ['manager'], mark: ['still_armed'], moves: { rider: 'released' }, next: { node: 'last_word' }, objective: 40, pressure: -6 },
            clerkToo('{clerk.first} goes out the front a step behind {manager.him}.')],
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
  { id: 'off_air', stage: 'adapt',
    threat: { chat: CHAT.off_air, label: '{rider.first} stands over {manager.first}', minutes: 12, text: '{rider.first} stops pacing and plants {rider.himself} over {manager.first}. “Who took it?” {rider.he} {rider~asks|ask}, again and again.', pressure: 6, moves: { rider: 'provoked' },
      beats: [
        { id: 'stops_twice', at: 1.5, by: 'radio', line: 'Window. Subject standing over the manager again.' },
        { id: 'no_one', at: 3.1, by: 'rider', line: 'There’s no camera now. You get that?' },
      ],
      timeout: { text: 'The register phone doesn’t ring. {rider.first} asks again, and this time {manager.first} lifts {manager.his} head to answer.', next: { node: 'way_out' } } },
    prompt: 'The stream is gone. {rider.first} paces the length of the counter and stops each time {rider.he} {rider~reaches|reach} {manager.first}.',
    exchange: [{ by: 'rider', line: 'No more stream. So who sees what happens to {manager.first}?' }, { by: 'negotiator', line: 'You wanted witnesses. What do you need me to hear now?' }],
    promptIf: [
      { when: { marks: ['cut'] }, prompt: 'Command took the stream down. {rider.first} props the dead phone back against the register and checks the screen again.',
        exchange: [{ by: 'rider', line: 'You did that. You took them away.' }, { by: 'negotiator', line: 'I want to hear you without them.' }] },
      { when: { notSafe: ['clerk'] }, prompt: 'The stream is down. {rider.first} paces between {manager.first} on the floor and {clerk.first} in the stockroom doorway.' },
    ],
    choices: [
      { id: 'own_it', title: 'Tell {rider.him} it was command', icon: 'radio', talksTo: 'rider', check: check(TALK, 2), minutes: 4, certBonus: NEGOTIATOR, favors: [CALM_ON_CAMERA],
        summary: '{lead} tells {rider.first} that command ended the stream. {rider.first} wants the viewers back, and you can’t give them back.',
        pull: 'A true answer, when {rider.first} asks who did it.',
        cost: '{rider.first} hears that you took {rider.his} viewers away.',
        preview: { favorable: '{rider.first} talks to you and lets {manager.first} walk out.', mixed: '{rider.first} believes you and goes back to pacing.', adverse: '{rider.first} drops the phone, and nothing stands between {manager.first} and {rider.him}.' },
        outcomes: {
          favorable: [{ text: '{rider.first} doesn’t answer until the negotiator asks if the line is still open. Then the whole story comes out again from the red light, slower this time, with nobody typing back. At the end {rider.he} {rider~tells|tell} {manager.first} to get up and go, and {manager.first} goes.',
            safe: ['manager'], mark: ['still_armed'], moves: { rider: 'honest' }, next: { node: 'last_word' }, objective: 40, pressure: -6 },
            clerkToo('{clerk.first} leaves by the front door with {manager.him}.')],
          mixed: [{ text: '{rider.first} says {rider.he} {rider~believes|believe} the negotiator, and that the police are no better than {delivery_app}. {rider.He} {rider~goes|go} back to pacing with the line open.',
            moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 8 }],
          adverse: turnsOn({
            lead: '{rider.first} drops the phone on the counter. “Stop calling,” {rider.he} {rider~says|say}. “I’m done being talked to.”',
            threat: 'Then {rider.he} {rider~kneels|kneel} beside {manager.first} and {rider~presses|press} the handgun to {manager.his} shoulder.',
            quiet: 'The receiver lies on the counter, the line still open, and neither end says a word.',
            quietNext: { node: 'way_out' },
            extra: { moves: { rider: 'provoked' }, pressure: 8 } }),
        } },
      // No audience, so the manager can say it plainly. The truth, in private, with nobody to prove it to.
      { id: 'manager_quiet', title: 'Let {manager.first} answer with nobody watching', icon: 'radio', talksTo: 'manager', check: check(HOLD, 2), minutes: 4,
        summary: 'Ask {rider.first} to let {manager.first} answer the question out loud, on the line, with the stream down. {manager.first} says it to the room, and only the room hears.',
        pull: 'No audience for {manager.first} to play to, or for {rider.first} to.',
        cost: 'Whatever {manager.first} says helps nobody prove anything.',
        preview: { favorable: '{manager.first} answers plainly, and {rider.first} hears it.', mixed: '{manager.first} answers, and {rider.first} doesn’t believe it.', adverse: '{manager.first} says nothing, and {rider.first} asks again, closer.' },
        outcomes: {
          favorable: [
            { if: CLEAR_NO_PROOF, text: '{manager.first} stays on the floor and answers the room. {rider.first} stops pacing. {manager.first} says {clerk.first} took the bag and {manager.he} {manager~covered|cover} for {clerk.him}.',
              exchange: [{ by: 'manager', line: 'I reported you to keep {clerk.him} in {clerk.his} job. I should have said so when I filed it.' }], reveal: ['rider_clear'], mark: ['admitted', 'knows_truth'], moves: { rider: 'honest' }, next: { node: 'way_out' }, objective: 20, pressure: -6 },
            { if: TOOK, text: '{manager.first} says it plainly from the floor. The pickup is on the store camera, and the order says delivered. {rider.first} says nothing, then asks who else has seen the clip.',
              exchange: [{ by: 'manager', line: 'I kept the clip. I didn’t want to use it.' }], reveal: ['rider_clear'], mark: ['knows_truth'], moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 10 },
            { if: CLEAR_PROOF, text: '{manager.first} tells the room what {delivery_app} told {manager.him}. {rider.first} asks who {delivery_app} is lying to, and {manager.first} says {manager.he} {manager~doesn’t|don’t} know.',
              exchange: [{ by: 'manager', line: 'I wrote down what it said. I don’t know where the bag went.' }], mark: ['app_said'], moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 12 },
          ],
          mixed: [{ text: '{manager.first} answers in two sentences. “That’s what you told {delivery_app},” {rider.first} says, and goes back to pacing.',
            moves: { rider: 'heard' }, next: { node: 'way_out' }, objective: 6 }],
          adverse: turnsOn({
            lead: '{manager.first} won’t answer. {rider.first} asks again from a foot away, louder.',
            threat: '{rider.first} puts the handgun on {manager.first} and says {manager.he} {manager~has|have} until the count of ten.',
            quiet: '{rider.first} sits on the counter above {manager.first} and says nothing at all.',
            quietNext: { node: 'way_out' },
            extra: { moves: { rider: 'provoked' }, pressure: 8 } }),
        } },
      // Off the stream the squad can move unseen, and the rider just said why that frightens them.
      { id: 'move_up_dark', title: 'Move your squad up while nobody films', icon: 'perimeter', team: { to: { vantage: 'scene' }, signal: { channel: 'visual', to: 'rider' } }, check: check(MOVE, 2), minutes: 4, consequenceLevel: 'moderate',
        certBonus: SURVEILLANCE,
        summary: 'With the stream down, {lead} walks officers up the dark sidewalk to the door, near enough to pull {manager.first} out. If {rider.first} spots one helmet in the glass, {manager.first} is right beside {rider.him}.',
        pull: '{manager.first} within reach, and no picture of the move.',
        cost: 'One helmet in the dark glass, and {rider.first} is standing over {manager.first}.',
        preview: { favorable: 'Your squad reaches both sides of the door without being seen.', mixed: '{rider.first} catches a glint at the window and stands over {manager.first}.', adverse: '{rider.first} spots helmets in the dark glass.' },
        outcomes: {
          favorable: [
            { text: 'Officers come up the dark sidewalk and split to both sides of the door. Through the glass the handgun hangs at {rider.first}’s side, and {manager.first} glances at the stockroom whenever {rider.first} turns away.',
              reveal: ['handgun'], mark: ['team_close'], next: { node: 'way_out' }, objective: 10 },
            { when: { lead: ['observant'] }, text: 'From the door the lead officer can make out the whiteboard behind the register. Someone has smudged one of the pickup times.' },
          ],
          mixed: [{ text: 'Officers reach the door, and the cooler light catches the edge of a helmet. {rider.first} plants {rider.himself} over {manager.first} and asks the negotiator who’s out there.',
            reveal: ['handgun'], mark: ['team_close'], moves: { rider: 'team_seen' }, next: { node: 'way_out' }, objective: 6, pressure: 4 }],
          adverse: turnsOn({
            lead: '{rider.first} sees two helmets in the dark glass and stops pacing. {rider.He} {rider~says|say} there’s no camera now to see what happens next.',
            threat: '{rider.first} hauls {manager.first} off the floor and holds the handgun to {manager.his} side in front of the window.',
            quiet: '{rider.first} switches off the store lights and waits in the dark by the register.',
            quietNext: { node: 'way_out' },
            extra: { mark: ['team_close'], moves: { rider: 'team_seen' }, pressure: 10 } }),
        } },
    ] },

  // ------------------------------------------------------------------ stage 2: the clerk is out (the turn)
  { id: 'clerk_talks', stage: 'adapt',
    threat: { chat: CHAT.clerk_talks, label: 'The clerk’s phone lights up', minutes: 10, text: '{clerk.first}’s phone buzzes in an officer’s hand. {manager.first}’s name is on the screen, calling from inside the store.', pressure: 4, bump: { stream: 6 },
      beats: [
        { id: 'clerk_shakes', at: 1.6, by: 'clerk', line: 'Is {manager.first} okay? Just tell me {manager.first} is okay.' },
        { id: 'rider_asks', at: 3.2, by: 'rider', line: 'Where’s the kid? Somebody took the kid.', moves: { rider: 'team_seen' }, bump: { stream: 6 } },
      ],
      timeout: { text: 'The phone rings out in the officer’s hand. {clerk.first} asks to call {manager.first} back.', next: { node: 'on_air' } } },
    prompt: '{clerk.first} sits behind the patrol car in a blanket, watching the stream on an officer’s phone. {clerk.He} {clerk~keeps|keep} telling the officer {clerk.he} didn’t say anything to anybody.',
    exchange: [{ by: 'negotiator', line: 'What didn’t you say?' }, { by: 'clerk', line: 'About the bag. About that night.' }],
    promptIf: [{ when: { marks: ['seen_back'] }, prompt: '{clerk.first} is out, and the stream showed the stockroom door moving. Inside, {rider.first} is asking the comments where the kid went.',
      exchange: [{ by: 'rider', line: 'They took the kid. What else are they doing back there?' }, { by: 'clerk', line: 'I didn’t tell them anything. I swear I didn’t.' }] }],
    choices: [
      { id: 'clerk_asked', title: 'Ask {clerk.first} what happened at 11:40', icon: 'search', talksTo: 'clerk', check: check(ASK, -2), minutes: 4,
        summary: '{lead} sits on the bumper beside {clerk.first} and asks about the night the bag went missing. {clerk.first} is nineteen, shaking, and watching the stream on an officer’s phone the whole time.',
        pull: '{clerk.first} worked the register at 11:40 that night.',
        cost: 'You question a nineteen-year-old while {manager.first} is held inside.',
        preview: { favorable: 'You hear what {clerk.first} saw at the register.', mixed: '{clerk.first} starts to answer and asks for {manager.first} instead.', adverse: '{clerk.first} stops talking, and inside the count keeps climbing.' },
        outcomes: {
          favorable: [
            { if: CLEAR_NO_PROOF, text: '{clerk.first} answers looking at the floor. The bag sat on the counter for twenty minutes, {clerk.he} {clerk~says|say}, and {clerk.he} {clerk~was|were} hungry, so {clerk.he} {clerk~took|take} it before the courier came. The next day {manager.first} found the receipt in {clerk.his} apron, and called {delivery_app} about {rider.first} instead.',
              exchange: [{ by: 'clerk', line: '{manager.He} said they’d never fire me if it was the courier. {manager.He} {manager~is|are} my {manager^uncle|aunt|relative}.' }], reveal: ['rider_clear'], mark: ['knows_truth'], next: { node: 'on_air' }, objective: 15 },
            { if: TOOK, text: '{clerk.first} says {rider.first} picked the bag up at 11:40 like any other night. The customer called later to say it never came, though {delivery_app} showed it delivered. {clerk.He} saw the pickup on the store camera, and {manager.first} kept the clip.',
              exchange: [{ by: 'clerk', line: 'I didn’t say anything. I didn’t want {rider.him} to get in trouble.' }], reveal: ['rider_clear'], mark: ['knows_truth'], next: { node: 'on_air' }, objective: 12 },
            { if: CLEAR_PROOF, text: '{clerk.first} says {rider.first} picked the bag up at 11:40 like any other night. After that {clerk.he} {clerk~doesn’t|don’t} know. The order sheet says delivered, and {clerk.he} {clerk~doesn’t|don’t} look at it again.',
              exchange: [{ by: 'clerk', line: '{rider.He} took it. Like always. After that I don’t know. I didn’t want to say I didn’t know.' }], mark: ['clerk_unsure'], next: { node: 'on_air' }, objective: 8 },
          ],
          mixed: [{ text: '{clerk.first} gets as far as the register that night, then stops and asks if {manager.first} is all right. {clerk.He} won’t say another word until somebody answers.',
            next: { node: 'on_air' }, objective: 6 }],
          adverse: [{ text: '{clerk.first} pulls the blanket over {clerk.his} head and won’t talk to anyone. On the officer’s phone the count keeps climbing, and nobody can say who’s watching.',
            bump: { stream: 10 }, next: { node: 'on_air' }, objective: 3, pressure: 4 }],
        } },
      // The temptation (dilemma pattern 15): a story that ends the stand-off, if it is true. It is true in no situation.
      { id: 'say_clerk_backs', title: 'Tell {rider.him} {clerk.first} backs {rider.him}', icon: 'radio', talksTo: 'rider', deceives: true, check: check(TALK, 4), minutes: 2, consequenceLevel: 'high',
        summary: '{clerk.first} hasn’t said a word about the bag, so this is a lie until someone checks. {lead} tells {rider.first} that {clerk.first} is outside saying {rider.first} didn’t take it. If {clerk.first} types otherwise, {rider.first} reads it out live.',
        pull: '{rider.first} hears the words {rider.he} came for.',
        cost: 'A claim you haven’t checked, said to thousands of people who will.',
        preview: { favorable: '{rider.first} sits down and starts talking about walking out.', mixed: '{rider.first} wants {clerk.first} to say it in person.', adverse: '{clerk.first} contradicts you on the stream.' },
        outcomes: {
          favorable: [{ text: '{rider.first} makes the negotiator say it twice. Then {rider.he} {rider~says|say} it to the camera {rider.himself} and sits down on the floor with {rider.his} back against the cooler.',
            promise: { id: 'clerk_backs', to: 'rider', kind: 'lie' }, mark: ['lied_clerk'], moves: { rider: 'released' }, next: { node: 'on_air' }, objective: 15, pressure: -8 }],
          mixed: [{ text: '{rider.first} wants to hear it in {clerk.first}’s own voice. The negotiator says {clerk.first} is with the medic, and {rider.first} says {rider.he} will wait.',
            promise: { id: 'clerk_backs', to: 'rider', kind: 'lie' }, mark: ['lied_clerk'], moves: { rider: 'heard' }, next: { node: 'on_air' }, objective: 8 }],
          adverse: turnsOn({
            lead: 'A comment lands under the picture from {clerk.first}’s own account, typed in the back of the patrol car. It says {clerk.first} hasn’t told the police anything about the bag. {rider.first} reads it out slowly.',
            threat: '{rider.first} aims the handgun at {manager.first} while telling the camera this is what the police do.',
            quiet: '{rider.first} hangs up and lets the callback ring.',
            quietNext: { node: 'on_air' },
            extra: { mark: ['lie_found'], moves: { rider: 'provoked' }, bump: { stream: 14 }, pressure: 10 } }),
        } },
    ] },
];

